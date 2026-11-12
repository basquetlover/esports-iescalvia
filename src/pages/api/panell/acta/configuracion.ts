import type { APIRoute, AstroCookies } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

import { exigirPartidoDesignadoVoluntariat } from "@utils/voluntariat/acceso";

import { obtenerAccesoActa } from "@utils/acta/acceso";

import {
  calcularEstadoVoleibol,
  normalizarConfiguracionVoleibol,
  type ConfiguracionVoleibol,
  type EstadoVoleibol,
  type EventoCompatibleVoleibol,
} from "@utils/acta/voleibol";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Registro = Record<string, unknown>;

type PartidoDB = {
  id: string;
  edicion_id: string;
  estado: string;
  finalizado_at: string | null;
};

type EdicionDB = {
  id: string;
  torneo_id: string | null;
};

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;

  deporte: string;
  estado: string;
  estado_operativo: string;

  controlador_id: string | null;
  control_token: string | null;
  control_generacion: number;

  bloqueada_at: string | null;

  configuracion_snapshot: Registro | null;

  secuencia_eventos: number;
  version: number;
};

type PlazaDB = {
  lado: string | null;
  equipo_resuelto_id: string | null;
};

type EventoDB = EventoCompatibleVoleibol & {
  cliente_evento_id: string;
  tipo_evento: string;
  equipo_id: string | null;
  jugador_id: string | null;
  estado: string;
  orden: number;
};

// ============================================================
// CONSTANTES
// ============================================================

const CAMPOS_CONFIGURACION = [
  "setsParaGanar",
  "puntosSet",
  "diferenciaSet",
  "puntosExtraSet",
  "diferenciaExtraSet",
] as const;

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at" as const;

const SELECT_EDICION = "id,torneo_id" as const;

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,estado_operativo,controlador_id,control_token,control_generacion,bloqueada_at,configuracion_snapshot,secuencia_eventos,version" as const;

const SELECT_PLAZA = "lado,equipo_resuelto_id" as const;

const SELECT_EVENTO =
  "cliente_evento_id,tipo_evento,equipo_id,jugador_id,estado,orden" as const;

// ============================================================
// VALIDACIONES
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim().toLowerCase())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

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

  console.error("Error actualitzant la configuració del voleibol:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut guardar la configuració.",
    },
    500,
  );
}

// ============================================================
// REGLAS ACTUALES
// ============================================================

function obtenerReglasActuales(acta: ActaDB): ConfiguracionVoleibol {
  const snapshot = acta.configuracion_snapshot;

  const origen =
    esRegistro(snapshot) && esRegistro(snapshot.voleibol)
      ? snapshot.voleibol
      : {};

  const entrada: Partial<ConfiguracionVoleibol> = {};

  for (const campo of CAMPOS_CONFIGURACION) {
    const valor = origen[campo];

    if (valor === null || valor === undefined) {
      continue;
    }

    if (typeof valor !== "number") {
      throw new ErrorAPI(409, "Les regles actuals de l'acta no són vàlides.");
    }

    entrada[campo] = valor;
  }

  try {
    return normalizarConfiguracionVoleibol(entrada);
  } catch {
    throw new ErrorAPI(409, "Les regles actuals de l'acta no són vàlides.");
  }
}

// ============================================================
// VALIDAR REGLAS NUEVAS
// ============================================================

function validarReglasNuevas(valor: unknown): ConfiguracionVoleibol {
  if (!esRegistro(valor)) {
    throw new ErrorAPI(400, "Falta la configuració del partit.");
  }

  const entrada: Partial<ConfiguracionVoleibol> = {};

  for (const campo of CAMPOS_CONFIGURACION) {
    const numero = valor[campo];

    if (typeof numero !== "number" || !Number.isSafeInteger(numero)) {
      throw new ErrorAPI(400, `El valor de ${campo} ha de ser un enter.`);
    }

    entrada[campo] = numero;
  }

  try {
    return normalizarConfiguracionVoleibol(entrada);
  } catch {
    throw new ErrorAPI(
      400,
      "Els punts, les diferències o el nombre de sets no són vàlids.",
    );
  }
}

// ============================================================
// AUTORIZACIÓN COMPARTIDA
// ============================================================

async function exigirPermisoConfiguracion(
  usuario: Usuario,
  cookies: AstroCookies,
  torneoID: string,
  edicionID: string,
  partidoID: string,
): Promise<void> {
  // ==========================================================
  // ADMINISTRACIÓN
  // ==========================================================

  const administrador =
    tieneAccesoTorneo(usuario, torneoID) &&
    tienePermiso(usuario, "panell", "ver", torneoID) &&
    tienePermiso(usuario, "partits", "ver", torneoID) &&
    tienePermiso(usuario, "partits", "editar", torneoID);

  if (administrador) {
    return;
  }

  // ==========================================================
  // VOLUNTARIADO
  // ==========================================================

  const designacion = await exigirPartidoDesignadoVoluntariat(
    cookies,
    torneoID,
    edicionID,
    partidoID,
  );

  if (
    designacion.usuario.id !== usuario.id ||
    !designacion.funciones.some(
      (funcion) => funcion === "ARBITRE" || funcion === "OFICIAL_TAULA",
    )
  ) {
    throw new ErrorAPI(403, "No tens una designació activa per aquest partit.");
  }

  const acceso = await obtenerAccesoActa({
    usuario,
    torneoID,
    edicionID,
    partidoID,
  });

  if (
    !acceso.voluntarioConfirmado ||
    (!acceso.designadoArbitro && !acceso.designadoOficial)
  ) {
    throw new ErrorAPI(
      403,
      "Necessites una designació confirmada com a àrbitre o oficial de taula.",
    );
  }

  if (!acceso.puedeConsultar || acceso.bloqueadoAcceso) {
    throw new ErrorAPI(403, "No tens permís per accedir a aquesta acta.");
  }

  if (acceso.bloqueadoControl || acceso.estadoOperativo === "BLOQUEADA") {
    throw new ErrorAPI(423, "L'acta està bloquejada per l'organització.");
  }

  if (acceso.actaFinalizada || acceso.revisionActiva) {
    throw new ErrorAPI(
      409,
      "L'acta no està disponible per modificar les regles.",
    );
  }

  if (!acceso.esControlador || !acceso.puedeEscribir) {
    throw new ErrorAPI(
      403,
      "No tens el control necessari per modificar les regles de l'acta.",
    );
  }
}

// ============================================================
// CONTEXTO DEL PARTIDO
// ============================================================

async function obtenerContexto(
  usuario: Usuario,
  cookies: AstroCookies,
  partidoID: string,
) {
  const { data: partidoData, error: errorPartido } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .maybeSingle();

  if (errorPartido) {
    throw errorPartido;
  }

  const partido = partidoData as PartidoDB | null;

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  const { data: edicionData, error: errorEdicion } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", partido.edicion_id)
    .maybeSingle();

  if (errorEdicion) {
    throw errorEdicion;
  }

  const edicion = edicionData as EdicionDB | null;

  if (!edicion) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició del partit.");
  }

  const torneoID = identificador(edicion.torneo_id, "torneig");

  // Ninguna comprobación se basa
  // en la URL desde la que llega
  // la petición.
  //
  // El servidor comprueba permisos
  // o designación real.

  await exigirPermisoConfiguracion(
    usuario,
    cookies,
    torneoID,
    edicion.id,
    partidoID,
  );

  const { data: actaData, error: errorActa } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (errorActa) {
    throw errorActa;
  }

  const acta = actaData as ActaDB | null;

  if (!acta) {
    throw new ErrorAPI(409, "L'acta encara no està iniciada.");
  }

  if (
    acta.partido_id !== partidoID ||
    acta.edicion_id !== partido.edicion_id ||
    acta.torneo_id !== torneoID
  ) {
    throw new ErrorAPI(409, "L'acta no correspon al partit seleccionat.");
  }

  if (acta.deporte.trim().toUpperCase() !== "VOLEIBOL") {
    throw new ErrorAPI(
      409,
      "Aquesta configuració només es pot modificar en actes de voleibol.",
    );
  }

  return {
    torneoID,
    edicion,
    partido,
    acta,
  };
}

// ============================================================
// CONTROL DE ESCRITURA
// ============================================================

function exigirControl(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  controlToken: string,
): void {
  if (
    partido.estado === "FINALIZADO" ||
    partido.estado === "CANCELADO" ||
    partido.finalizado_at
  ) {
    throw new ErrorAPI(409, "El partit no admet modificacions.");
  }

  if (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null) {
    throw new ErrorAPI(423, "L'acta està bloquejada per l'organització.");
  }

  if (
    acta.estado !== "EN_CURSO" ||
    !["CONTROLADA", "EN_SUPERVISION"].includes(acta.estado_operativo)
  ) {
    throw new ErrorAPI(423, "L'acta no està disponible per escriure.");
  }

  if (acta.controlador_id !== usuario.id) {
    throw new ErrorAPI(423, "Un altre usuari té el control de l'acta.");
  }

  if (
    !acta.control_token ||
    acta.control_token.trim().toLowerCase() !== controlToken
  ) {
    throw new ErrorAPI(409, "El control de l'acta ha canviat.");
  }

  if (
    !Number.isSafeInteger(acta.control_generacion) ||
    acta.control_generacion < 0
  ) {
    throw new ErrorAPI(409, "La generació de control no és vàlida.");
  }
}

// ============================================================
// VERIFICAR ESTADO OFICIAL
// ============================================================

async function verificarControlActual(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  controlToken: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(
      "estado,estado_operativo,bloqueada_at,controlador_id,control_token,control_generacion,version,secuencia_eventos",
    )
    .eq("id", acta.id)
    .eq("partido_id", partido.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "L'acta ja no està disponible.");
  }

  if (
    data.version !== acta.version ||
    data.secuencia_eventos !== acta.secuencia_eventos ||
    data.control_generacion !== acta.control_generacion
  ) {
    throw new ErrorAPI(
      409,
      "L'acta ha canviat al servidor. Actualitza les jugades abans de modificar les regles.",
    );
  }

  exigirControl(
    usuario,
    partido,
    {
      ...acta,
      ...data,
    },
    controlToken,
  );
}

// ============================================================
// EQUIPOS
// ============================================================

async function obtenerEquipos(partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (error) {
    throw error;
  }

  const plazas = (data ?? []) as PlazaDB[];

  const local = plazas.find(
    (plaza) => plaza.lado === "LOCAL",
  )?.equipo_resuelto_id;

  const visitante = plazas.find(
    (plaza) => plaza.lado === "VISITANTE",
  )?.equipo_resuelto_id;

  if (!local || !visitante || local === visitante) {
    throw new ErrorAPI(409, "El partit no té dos equips diferents resolts.");
  }

  return {
    local,
    visitante,
  };
}

// ============================================================
// EVENTOS EXISTENTES
// ============================================================

async function obtenerEventos(actaID: string): Promise<EventoDB[]> {
  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .select(SELECT_EVENTO)
    .eq("acta_id", actaID)
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as EventoDB[];
}

// ============================================================
// VALIDAR HISTORIAL
// ============================================================

function verificarHistorial(
  anterior: EstadoVoleibol,
  siguiente: EstadoVoleibol,
): void {
  // Cambiar las reglas no puede desplazar
  // jugadas entre sets ni modificar los
  // cierres ya registrados.

  if (anterior.historial.length !== siguiente.historial.length) {
    throw new ErrorAPI(409, "La configuració altera l'historial de jugades.");
  }

  for (let i = 0; i < anterior.historial.length; i++) {
    const antes = anterior.historial[i];

    const despues = siguiente.historial[i];

    if (
      antes.clienteEventoID !== despues.clienteEventoID ||
      antes.numeroSet !== despues.numeroSet ||
      antes.cierraSet !== despues.cierraSet
    ) {
      throw new ErrorAPI(
        409,
        "Les noves regles canvien un fi de set o el set d'una jugada existent. " +
          "Desfés el fi de set afectat abans de canviar-les.",
      );
    }
  }
}

// ============================================================
// REALTIME
// ============================================================

async function notificarConfiguracion(
  partidoID: string,
  edicionID: string,
): Promise<void> {
  const canales = [
    `acta-jugades-partit-${partidoID}`,
    `acta-estat-partit-${partidoID}`,
    `actes-actives-edicio-${edicionID}`,
  ];

  await Promise.all(
    canales.map(async (nombreCanal) => {
      const canal = supabaseAdmin.channel(nombreCanal);

      try {
        await canal.httpSend("actualitzada", {});
      } catch (error) {
        console.error(
          `Error notificant la configuració (${nombreCanal}):`,
          error,
        );
      } finally {
        try {
          await supabaseAdmin.removeChannel(canal);
        } catch (error) {
          console.error(`Error tancant el canal (${nombreCanal}):`, error);
        }
      }
    }),
  );
}

// ============================================================
// PATCH — ACTUALIZAR CONFIGURACIÓN
// ============================================================

export const PATCH: APIRoute = async ({ request, cookies, url }) => {
  let guardado = false;

  let destinoRealtime: {
    partidoID: string;
    edicionID: string;
  } | null = null;

  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    let contenido: unknown;

    try {
      contenido = await request.json();
    } catch {
      throw new ErrorAPI(400, "El cos de la petició no és vàlid.");
    }

    if (!esRegistro(contenido)) {
      throw new ErrorAPI(400, "Les dades de la petició no són vàlides.");
    }

    const partidoID = identificador(contenido.partidoID, "partit");

    const controlToken = identificador(contenido.controlToken, "control");

    const configuracion = validarReglasNuevas(contenido.configuracion);

    // ========================================================
    // CONTEXTO Y PERMISOS
    // ========================================================

    const { torneoID, edicion, partido, acta } = await obtenerContexto(
      usuario,
      cookies,
      partidoID,
    );

    exigirControl(usuario, partido, acta, controlToken);

    // ========================================================
    // EQUIPOS E HISTORIAL
    // ========================================================

    const { local, visitante } = await obtenerEquipos(partidoID);

    const eventos = await obtenerEventos(acta.id);

    const reglasAnteriores = obtenerReglasActuales(acta);

    let estadoAnterior: EstadoVoleibol;

    let estadoNuevo: EstadoVoleibol;

    try {
      estadoAnterior = calcularEstadoVoleibol(
        eventos,
        local,
        visitante,
        reglasAnteriores,
      );

      estadoNuevo = calcularEstadoVoleibol(
        eventos,
        local,
        visitante,
        configuracion,
      );
    } catch {
      throw new ErrorAPI(
        409,
        "No es poden aplicar aquestes regles a les jugades existents.",
      );
    }

    verificarHistorial(estadoAnterior, estadoNuevo);

    // ========================================================
    // REVALIDAR PERMISOS Y CONTROL
    // ========================================================

    await exigirPermisoConfiguracion(
      usuario,
      cookies,
      torneoID,
      edicion.id,
      partidoID,
    );

    await verificarControlActual(usuario, partido, acta, controlToken);

    // ========================================================
    // GUARDAR CON CONTROL DE CONCURRENCIA
    // ========================================================

    const snapshot: Registro = {
      ...(acta.configuracion_snapshot ?? {}),
      voleibol: configuracion,
    };

    const ahora = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("acta_partidos")
      .update({
        configuracion_snapshot: snapshot,

        version: acta.version + 1,

        updated_at: ahora,
      })
      .eq("id", acta.id)
      .eq("partido_id", partidoID)
      .eq("torneo_id", torneoID)
      .eq("edicion_id", edicion.id)
      .eq("estado", "EN_CURSO")
      .eq("estado_operativo", acta.estado_operativo)
      .is("bloqueada_at", null)
      .eq("controlador_id", usuario.id)
      .eq("control_token", controlToken)
      .eq("control_generacion", acta.control_generacion)
      .eq("version", acta.version)
      .eq("secuencia_eventos", acta.secuencia_eventos)
      .select("version,configuracion_snapshot,updated_at")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ErrorAPI(
        409,
        "L'acta ha canviat mentre desaves la configuració. " +
          "Actualitza les jugades i torna-ho a provar.",
      );
    }

    guardado = true;

    destinoRealtime = {
      partidoID,
      edicionID: edicion.id,
    };

    // ========================================================
    // RESPUESTA
    // ========================================================

    const respuesta = responder({
      success: true,

      partidoID,
      actaID: acta.id,

      configuracion,

      configuracion_snapshot: data.configuracion_snapshot,

      version: data.version,

      updatedAt: data.updated_at,

      marcador: {
        setsGanadosLocal: estadoNuevo.setsGanadosLocal,

        setsGanadosVisitante: estadoNuevo.setsGanadosVisitante,

        puntosLocal: estadoNuevo.setActual?.puntosLocal ?? 0,

        puntosVisitante: estadoNuevo.setActual?.puntosVisitante ?? 0,
      },
    });

    respuesta.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );

    return respuesta;
  } catch (error) {
    return responderError(error);
  } finally {
    if (guardado && destinoRealtime) {
      await notificarConfiguracion(
        destinoRealtime.partidoID,
        destinoRealtime.edicionID,
      );
    }
  }
};
