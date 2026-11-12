import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

import {
  normalizarConfiguracionVoleibol,
  type ConfiguracionVoleibol,
} from "@utils/acta/voleibol";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Registro = Record<string, unknown>;

type NivelEstadisticas = "NINGUNA" | "EQUIPO" | "JUGADOR";

type TorneoDB = {
  id: string;
  nombre: string | null;
  deporte: string | null;
};

type EdicionDB = {
  id: string;
  torneo_id: string | null;
  nombre: string | null;
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

// ============================================================
// CONSULTAS
// ============================================================

const SELECT_TORNEO = "id,nombre,deporte" as const;

const SELECT_EDICION = "id,torneo_id,nombre" as const;

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at" as const;

const SELECT_PLAZA = "lado,equipo_resuelto_id" as const;

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,estado_operativo,nivel_estadisticas,configuracion_snapshot,operador_id,controlador_id,control_token,control_generacion,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,secuencia_eventos,version,created_at,updated_at" as const;

// ============================================================
// RESPUESTAS Y VALIDACIONES
// ============================================================

function responderError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error iniciant l'acta:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut iniciar l'acta.",
    },
    500,
  );
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim().toLowerCase())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
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
// CONTEXTO DEL PARTIDO
// ============================================================

async function exigirContexto(
  usuario: Usuario,
  torneoID: string,
  edicionID: string,
  partidoID: string,
) {
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "partits", "editar", torneoID)) {
    throw new ErrorAPI(403, "No tens permís per iniciar aquesta acta.");
  }

  const [torneoRes, edicionRes, partidoRes] = await Promise.all([
    supabaseAdmin
      .from("torneos")
      .select(SELECT_TORNEO)
      .eq("id", torneoID)
      .maybeSingle(),

    supabaseAdmin
      .from("ediciones")
      .select(SELECT_EDICION)
      .eq("id", edicionID)
      .maybeSingle(),

    supabaseAdmin
      .from("competicion_partidos")
      .select(SELECT_PARTIDO)
      .eq("id", partidoID)
      .eq("edicion_id", edicionID)
      .maybeSingle(),
  ]);

  if (torneoRes.error) throw torneoRes.error;
  if (edicionRes.error) throw edicionRes.error;
  if (partidoRes.error) throw partidoRes.error;

  const torneo = torneoRes.data as TorneoDB | null;

  const edicion = edicionRes.data as EdicionDB | null;

  const partido = partidoRes.data as PartidoDB | null;

  if (!torneo) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  if (!edicion || edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig.");
  }

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  if (
    partido.estado === "CANCELADO" ||
    partido.estado === "FINALIZADO" ||
    partido.finalizado_at
  ) {
    throw new ErrorAPI(409, "Aquest partit no pot iniciar una acta.");
  }

  return {
    torneo,
    edicion,
    partido,
  };
}

// ============================================================
// EQUIPOS RESUELTOS
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
// CONSULTAR ACTA
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
// ESTADO OPERATIVO
// ============================================================

function exigirActaDisponible(acta: ActaDB): void {
  if (acta.estado === "FINALIZADA") {
    throw new ErrorAPI(409, "L'acta ja està finalitzada.");
  }

  if (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null) {
    throw new ErrorAPI(423, "L'acta està bloquejada per l'organització.");
  }

  if (!["DISPONIBLE", "CONTROLADA"].includes(acta.estado_operativo)) {
    throw new ErrorAPI(423, "L'estat operatiu no permet iniciar aquesta acta.");
  }

  if (
    !Number.isInteger(acta.control_generacion) ||
    acta.control_generacion < 0
  ) {
    throw new ErrorAPI(409, "La generació de control de l'acta no és vàlida.");
  }
}

// ============================================================
// ACTA PÚBLICA
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
// ESTADÍSTICAS
// ============================================================

async function obtenerNivelEstadisticas(
  deporte: string,
  edicionID: string,
): Promise<NivelEstadisticas> {
  if (deporte !== "VOLEIBOL") {
    return deporte === "FUTBOL" ? "JUGADOR" : "NINGUNA";
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
// RESPUESTA DE INICIO
// ============================================================

function respuestaInicio(acta: ActaDB, reutilizado: boolean): Response {
  return responder({
    success: true,
    iniciado: true,
    reutilizado,

    acta: actaPublica(acta),

    control: {
      puedeEditar: true,
      esControlador: true,
      puedeEscribir: true,
      controlToken: acta.control_token,
    },
  });
}

// ============================================================
// REALTIME
// ============================================================

async function notificarInicio(
  partidoID: string,
  edicionID: string,
): Promise<void> {
  const canales = [
    `acta-estat-partit-${partidoID}`,
    `actes-actives-edicio-${edicionID}`,
  ];

  await Promise.all(
    canales.map(async (nombre) => {
      const canal = supabaseAdmin.channel(nombre);

      try {
        await canal.httpSend("actualitzada", {});
      } catch (error) {
        // El inicio ya está guardado.
        // Un fallo de Broadcast no debe
        // deshacer ni repetir la operación.
        console.error(`Error enviant Realtime (${nombre}):`, error);
      } finally {
        await supabaseAdmin.removeChannel(canal);
      }
    }),
  );
}

// ============================================================
// INICIAR ACTA
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    const partidoID = identificador(
      url.searchParams.get("partidoID"),
      "partit",
    );

    const contexto = await exigirContexto(
      usuario,
      torneoID,
      edicionID,
      partidoID,
    );

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

      exigirActaDisponible(acta);

      // ======================================================
      // CONTROL DE OTRO USUARIO
      // ======================================================

      if (acta.controlador_id && acta.controlador_id !== usuario.id) {
        throw new ErrorAPI(
          409,
          "L'acta està sent controlada per un altre usuari.",
        );
      }

      // ======================================================
      // MISMO CONTROLADOR Y TOKEN VIGENTE
      // ======================================================

      if (
        acta.controlador_id === usuario.id &&
        acta.estado === "EN_CURSO" &&
        acta.estado_operativo === "CONTROLADA" &&
        acta.control_token
      ) {
        // Releer el estado antes de devolver
        // un token reutilizado.
        const { data, error } = await supabaseAdmin
          .from("acta_partidos")
          .select(SELECT_ACTA)
          .eq("id", acta.id)
          .eq("version", acta.version)
          .eq("estado", "EN_CURSO")
          .eq("estado_operativo", "CONTROLADA")
          .eq("control_generacion", acta.control_generacion)
          .eq("controlador_id", usuario.id)
          .eq("control_token", acta.control_token)
          .is("bloqueada_at", null)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          throw new ErrorAPI(409, "L'acta ha canviat. Actualitza la pàgina.");
        }

        return respuestaInicio(data as ActaDB, true);
      }

      // ======================================================
      // SOLICITAR UN CONTROL NUEVO
      // ======================================================

      const ahora = new Date().toISOString();

      const token = randomUUID().toLowerCase();

      const { data, error } = await supabaseAdmin
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
        .eq("version", acta.version)
        .eq("estado_operativo", acta.estado_operativo)
        .eq("control_generacion", acta.control_generacion)
        .is("bloqueada_at", null)
        .select(SELECT_ACTA)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new ErrorAPI(409, "L'acta ha canviat. Actualitza la pàgina.");
      }

      acta = data as ActaDB;

      await notificarInicio(partidoID, edicionID);

      return respuestaInicio(acta, false);
    }

    // ========================================================
    // ACTA NUEVA
    // ========================================================

    const deporte = normalizarDeporte(contexto.torneo.deporte);

    const nivel = await obtenerNivelEstadisticas(deporte, edicionID);

    const reglas =
      deporte === "VOLEIBOL" ? await obtenerReglasVoleibol(edicionID) : null;

    const ahora = new Date().toISOString();

    const token = randomUUID().toLowerCase();

    const snapshot: Registro = {
      deporte,
      estadisticas: {
        nivel,
      },
      ...(reglas
        ? {
            voleibol: reglas,
          }
        : {}),
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
          "Ja existeix una acta per aquest partit. Actualitza la pàgina.",
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
