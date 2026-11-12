import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  responder,
} from "@utils/inscripcio/equipBase";

import { exigirPartidoDesignadoVoluntariat } from "@utils/voluntariat/acceso";

import { obtenerAccesoActa } from "@utils/acta/acceso";

import {
  normalizarConfiguracionVoleibol,
  type ConfiguracionVoleibol,
} from "@utils/acta/voleibol";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type NivelEstadisticas = "NINGUNA" | "EQUIPO" | "JUGADOR";

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;

  deporte: string;
  estado: string;
  estado_operativo: string;

  nivel_estadisticas: string;
  configuracion_snapshot: Registro | null;

  operador_id: string | null;
  controlador_id: string | null;
  control_token: string | null;
  control_generacion: number;

  iniciada_at: string | null;

  bloqueada_por: string | null;
  bloqueada_at: string | null;
  motivo_bloqueo: string | null;

  finalizada_por: string | null;
  finalizada_at: string | null;

  secuencia_eventos: number;
  version: number;

  created_at: string;
  updated_at: string;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  estado: string;
  finalizado_at: string | null;
};

type PlazaDB = {
  lado: "LOCAL" | "VISITANTE" | null;
  equipo_resuelto_id: string | null;
};

type Contexto = Awaited<ReturnType<typeof exigirPartidoDesignadoVoluntariat>>;

// ============================================================
// CONSULTAS
// ============================================================

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,estado_operativo,nivel_estadisticas,configuracion_snapshot,operador_id,controlador_id,control_token,control_generacion,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,secuencia_eventos,version,created_at,updated_at" as const;

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at" as const;

const SELECT_PLAZA = "lado,equipo_resuelto_id" as const;

// ============================================================
// RESPUESTAS
// ============================================================

function respuesta(datos: Record<string, unknown>, estado = 200): Response {
  const res = responder(datos, estado);

  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  return res;
}

function responderError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return respuesta(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error iniciant l'acta del voluntariat:", error);

  return respuesta(
    {
      success: false,
      mensaje: "No s'ha pogut iniciar l'acta.",
    },
    500,
  );
}

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function normalizarDeporte(valor: string | null): string {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? ""
  );
}

// ============================================================
// COMPROBAR AUTORIZACIÓN DEL VOLUNTARIO
// ============================================================

async function exigirControlVoluntario(contexto: Contexto): Promise<void> {
  const acceso = await obtenerAccesoActa({
    usuario: contexto.usuario,
    torneoID: contexto.torneoID,
    edicionID: contexto.edicionID,
    partidoID: contexto.partidoID,
  });

  // La autorización administrativa no sustituye
  // una designación válida para esta API.

  if (
    !acceso.voluntarioConfirmado ||
    (!acceso.designadoArbitro && !acceso.designadoOficial)
  ) {
    throw new ErrorAPI(
      403,
      "Has de tenir una designació activa com a àrbitre o oficial de taula.",
    );
  }

  if (!acceso.puedeConsultar || acceso.bloqueadoAcceso) {
    throw new ErrorAPI(403, "No tens accés a aquesta acta.");
  }

  if (acceso.bloqueadoControl || acceso.estadoOperativo === "BLOQUEADA") {
    throw new ErrorAPI(
      423,
      "El control de l'acta està bloquejat per l'organització.",
    );
  }

  if (acceso.actaFinalizada) {
    throw new ErrorAPI(409, "L'acta ja està finalitzada.");
  }

  if (acceso.revisionActiva) {
    throw new ErrorAPI(
      423,
      "L'acta està en revisió i no es pot iniciar des del voluntariat.",
    );
  }

  if (acceso.hayOtroControlador) {
    throw new ErrorAPI(423, "Un altre usuari té el control de l'acta.");
  }

  if (!acceso.puedeSolicitarControl) {
    throw new ErrorAPI(
      403,
      "No tens permís per assumir el control d'aquesta acta.",
    );
  }
}

// ============================================================
// CONSULTAR PARTIDO
// ============================================================

async function exigirPartidoDisponible(contexto: Contexto): Promise<PartidoDB> {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", contexto.partidoID)
    .eq("edicion_id", contexto.edicionID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  const partido = data as PartidoDB;

  if (
    ["CANCELADO", "FINALIZADO"].includes(partido.estado) ||
    partido.finalizado_at
  ) {
    throw new ErrorAPI(409, "Aquest partit no pot iniciar una acta.");
  }

  return partido;
}

// ============================================================
// COMPROBAR EQUIPOS
// ============================================================

async function exigirEquiposResueltos(partidoID: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (error) throw error;

  const plazas = (data ?? []) as PlazaDB[];

  const local = plazas.find(
    (plaza) => plaza.lado === "LOCAL",
  )?.equipo_resuelto_id;

  const visitante = plazas.find(
    (plaza) => plaza.lado === "VISITANTE",
  )?.equipo_resuelto_id;

  if (!local || !visitante || local === visitante) {
    throw new ErrorAPI(
      409,
      "El partit encara no té resolts dos equips diferents.",
    );
  }
}

// ============================================================
// CONSULTAR ACTA EXISTENTE
// ============================================================

async function obtenerActa(partidoID: string): Promise<ActaDB | null> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (error) throw error;

  return data as ActaDB | null;
}

// ============================================================
// COMPROBAR ESTADO DEL ACTA
// ============================================================

function exigirEstadoDisponible(acta: ActaDB): void {
  if (acta.estado === "FINALIZADA" || acta.finalizada_at) {
    throw new ErrorAPI(409, "L'acta ja està finalitzada.");
  }

  if (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null) {
    throw new ErrorAPI(423, "L'acta està bloquejada per l'organització.");
  }

  if (!["DISPONIBLE", "CONTROLADA"].includes(acta.estado_operativo)) {
    throw new ErrorAPI(
      423,
      "L'estat actual no permet assumir el control de l'acta.",
    );
  }

  if (
    !Number.isSafeInteger(acta.control_generacion) ||
    acta.control_generacion < 0
  ) {
    throw new ErrorAPI(409, "La generació de control de l'acta no és vàlida.");
  }
}

// ============================================================
// CONSULTAR DEPORTE
// ============================================================

async function obtenerDeporte(torneoID: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("torneos")
    .select("id,deporte")
    .eq("id", torneoID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  const deporte = normalizarDeporte(data.deporte);

  if (deporte !== "FUTBOL" && deporte !== "VOLEIBOL") {
    throw new ErrorAPI(409, "Aquest esport encara no disposa d'acta digital.");
  }

  return deporte;
}

// ============================================================
// CONFIGURACIÓN DE VOLEIBOL
// ============================================================

async function obtenerReglasVoleibol(
  edicionID: string,
): Promise<ConfiguracionVoleibol> {
  const { data, error } = await supabaseAdmin
    .from("configuracion_ediciones")
    .select("competicion")
    .eq("edicion_id", edicionID)
    .maybeSingle();

  if (error) throw error;

  const competicion: unknown = data?.competicion;

  const configuracion = esRegistro(competicion)
    ? competicion.voleibol
    : undefined;

  if (
    configuracion !== undefined &&
    configuracion !== null &&
    !esRegistro(configuracion)
  ) {
    throw new ErrorAPI(
      409,
      "La configuració de voleibol de l'edició no és vàlida.",
    );
  }

  const entrada: Partial<ConfiguracionVoleibol> = {};

  const campos = [
    "setsParaGanar",
    "puntosSet",
    "diferenciaSet",
    "puntosExtraSet",
    "diferenciaExtraSet",
  ] as const;

  if (esRegistro(configuracion)) {
    for (const campo of campos) {
      const valor = configuracion[campo];

      if (valor === undefined || valor === null) {
        continue;
      }

      if (typeof valor !== "number") {
        throw new ErrorAPI(409, `El valor de ${campo} no és vàlid.`);
      }

      entrada[campo] = valor;
    }
  }

  try {
    return normalizarConfiguracionVoleibol(entrada);
  } catch {
    throw new ErrorAPI(409, "Les regles dels sets de voleibol no són vàlides.");
  }
}

// ============================================================
// NIVEL DE ESTADÍSTICAS
// ============================================================

async function obtenerNivelEstadisticas(
  deporte: string,
  edicionID: string,
): Promise<NivelEstadisticas> {
  if (deporte === "FUTBOL") {
    return "JUGADOR";
  }

  if (deporte !== "VOLEIBOL") {
    return "NINGUNA";
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_estadisticas")
    .select("ambito")
    .eq("edicion_id", edicionID)
    .eq("activa", true);

  if (error) throw error;

  const ambitos = (data ?? []) as Array<{
    ambito: string;
  }>;

  if (ambitos.some(({ ambito }) => ambito === "INDIVIDUAL")) {
    return "JUGADOR";
  }

  if (ambitos.some(({ ambito }) => ambito === "EQUIPO")) {
    return "EQUIPO";
  }

  return "NINGUNA";
}

// ============================================================
// RESPUESTA DEL ACTA
// ============================================================

function actaPublica(acta: ActaDB) {
  return {
    id: acta.id,
    partido_id: acta.partido_id,

    estado: acta.estado,
    estado_operativo: acta.estado_operativo,

    nivel_estadisticas: acta.nivel_estadisticas,

    configuracion_snapshot: acta.configuracion_snapshot,

    operador_id: acta.operador_id,
    controlador_id: acta.controlador_id,

    control_generacion: acta.control_generacion,

    iniciada_at: acta.iniciada_at,

    bloqueada_por: acta.bloqueada_por,
    bloqueada_at: acta.bloqueada_at,
    motivo_bloqueo: acta.motivo_bloqueo,

    finalizada_por: acta.finalizada_por,
    finalizada_at: acta.finalizada_at,

    version: acta.version,

    created_at: acta.created_at,
    updated_at: acta.updated_at,
  };
}

function respuestaInicio(acta: ActaDB, reutilizado: boolean): Response {
  return respuesta({
    success: true,
    iniciado: true,
    reutilizado,

    acta: actaPublica(acta),

    control: {
      puedeEditar: true,
      esControlador: true,
      puedeEscribir: true,

      // Este token solo se entrega al
      // controlador autenticado.
      controlToken: acta.control_token,

      controlGeneracion: acta.control_generacion,
    },
  });
}

// ============================================================
// NOTIFICAR REALTIME
// ============================================================

async function notificarInicio(
  partidoID: string,
  edicionID: string,
): Promise<void> {
  const nombres = [
    `acta-estat-partit-${partidoID}`,
    `actes-actives-edicio-${edicionID}`,
  ];

  await Promise.all(
    nombres.map(async (nombre) => {
      const canal = supabaseAdmin.channel(nombre);

      try {
        await canal.httpSend("actualitzada", {});
      } catch (error) {
        // Un fallo de notificación no debe
        // repetir una escritura ya guardada.
        console.error(`Error enviant Realtime (${nombre}):`, error);
      } finally {
        try {
          await supabaseAdmin.removeChannel(canal);
        } catch (error) {
          console.error(`Error tancant Realtime (${nombre}):`, error);
        }
      }
    }),
  );
}

// ============================================================
// POST — INICIAR O RECUPERAR CONTROL
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    let contenido: unknown;

    try {
      contenido = await request.json();
    } catch {
      throw new ErrorAPI(400, "El cos de la petició no és vàlid.");
    }

    if (!esRegistro(contenido)) {
      throw new ErrorAPI(400, "Les dades de la petició no són vàlides.");
    }

    // ========================================================
    // SESIÓN, VOLUNTARIO Y DESIGNACIÓN
    // ========================================================

    const contexto = await exigirPartidoDesignadoVoluntariat(
      cookies,
      contenido.torneoID,
      contenido.edicionID,
      contenido.partidoID,
    );

    // Requiere un voluntario confirmado
    // y una designación vigente como
    // ARBITRE u OFICIAL_TAULA.

    await exigirControlVoluntario(contexto);

    const usuario = contexto.usuario;

    const { torneoID, edicionID, partidoID } = contexto;

    // ========================================================
    // COMPROBAR EL PARTIDO
    // ========================================================

    await exigirPartidoDisponible(contexto);

    await exigirEquiposResueltos(partidoID);

    let acta = await obtenerActa(partidoID);

    // ========================================================
    // ACTA EXISTENTE
    // ========================================================

    if (acta) {
      if (
        acta.partido_id !== partidoID ||
        acta.torneo_id !== torneoID ||
        acta.edicion_id !== edicionID
      ) {
        throw new ErrorAPI(409, "L'acta no correspon al partit seleccionat.");
      }

      exigirEstadoDisponible(acta);

      // Un voluntario no puede expulsar
      // ni sustituir a otro controlador.

      if (acta.controlador_id && acta.controlador_id !== usuario.id) {
        throw new ErrorAPI(423, "Un altre usuari té el control de l'acta.");
      }

      // ======================================================
      // CONTROL YA ACTIVO DEL MISMO USUARIO
      // ======================================================

      if (
        acta.estado === "EN_CURSO" &&
        acta.estado_operativo === "CONTROLADA" &&
        acta.controlador_id === usuario.id &&
        acta.control_token
      ) {
        // Comprobar que el estado oficial
        // sigue siendo el mismo antes
        // de devolver el token existente.

        const { data, error } = await supabaseAdmin
          .from("acta_partidos")
          .select(SELECT_ACTA)
          .eq("id", acta.id)
          .eq("partido_id", partidoID)
          .eq("version", acta.version)
          .eq("estado", "EN_CURSO")
          .eq("estado_operativo", "CONTROLADA")
          .eq("controlador_id", usuario.id)
          .eq("control_token", acta.control_token)
          .eq("control_generacion", acta.control_generacion)
          .is("bloqueada_at", null)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new ErrorAPI(409, "L'acta ha canviat. Actualitza les dades.");
        }

        return respuestaInicio(data as ActaDB, true);
      }

      // ======================================================
      // RECUPERAR O ASUMIR EL CONTROL
      // ======================================================

      // Revalidar los permisos antes
      // de modificar la base de datos.

      await exigirControlVoluntario(contexto);

      const ahora = new Date().toISOString();

      const token = randomUUID().toLowerCase();

      // Actualización condicional:
      // la versión, el estado y la generación
      // deben continuar siendo los mismos.

      let consulta = supabaseAdmin
        .from("acta_partidos")
        .update({
          estado: "EN_CURSO",
          estado_operativo: "CONTROLADA",

          operador_id: acta.operador_id ?? usuario.id,

          controlador_id: usuario.id,
          control_token: token,

          control_generacion: acta.control_generacion + 1,

          iniciada_at: acta.iniciada_at ?? ahora,

          version: acta.version + 1,
          updated_at: ahora,
        })
        .eq("id", acta.id)
        .eq("partido_id", partidoID)
        .eq("torneo_id", torneoID)
        .eq("edicion_id", edicionID)
        .eq("estado", acta.estado)
        .eq("estado_operativo", acta.estado_operativo)
        .eq("version", acta.version)
        .eq("control_generacion", acta.control_generacion)
        .is("bloqueada_at", null);

      // No permitir asumir el control
      // si otro usuario lo ha adquirido
      // desde la lectura inicial.

      if (acta.controlador_id) {
        consulta = consulta.eq("controlador_id", usuario.id);
      } else {
        consulta = consulta.is("controlador_id", null);
      }

      const { data, error } = await consulta.select(SELECT_ACTA).maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new ErrorAPI(
          409,
          "L'acta ha canviat o un altre usuari n'ha assumit el control.",
        );
      }

      acta = data as ActaDB;

      await notificarInicio(partidoID, edicionID);

      return respuestaInicio(acta, false);
    }

    // ========================================================
    // CREAR ACTA NUEVA
    // ========================================================

    const deporte = await obtenerDeporte(torneoID);

    const nivel = await obtenerNivelEstadisticas(deporte, edicionID);

    const reglas =
      deporte === "VOLEIBOL" ? await obtenerReglasVoleibol(edicionID) : null;

    // Comprobar de nuevo la designación
    // antes de crear el registro.

    await exigirControlVoluntario(contexto);

    const ahora = new Date().toISOString();

    const token = randomUUID().toLowerCase();

    const snapshot: Registro = {
      deporte,

      estadisticas: {
        nivel,
      },

      ...(reglas ? { voleibol: reglas } : {}),
    };

    const { data, error } = await supabaseAdmin
      .from("acta_partidos")
      .insert({
        partido_id: partidoID,
        torneo_id: torneoID,
        edicion_id: edicionID,

        deporte,

        estado: "EN_CURSO",
        estado_operativo: "CONTROLADA",

        nivel_estadisticas: nivel,
        configuracion_snapshot: snapshot,

        operador_id: usuario.id,
        controlador_id: usuario.id,

        control_token: token,
        control_generacion: 1,

        iniciada_at: ahora,

        secuencia_eventos: 0,
        version: 1,

        created_at: ahora,
        updated_at: ahora,
      })
      .select(SELECT_ACTA)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new ErrorAPI(
          409,
          "Ja existeix una acta per aquest partit. Actualitza les dades.",
        );
      }

      throw error;
    }

    acta = data as ActaDB;

    await notificarInicio(partidoID, edicionID);

    return respuestaInicio(acta, false);
  } catch (error) {
    return responderError(error);
  }
};
