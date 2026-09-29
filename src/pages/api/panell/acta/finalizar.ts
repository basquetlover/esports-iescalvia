import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

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

  operador_id: string | null;

  controlador_id: string | null;

  control_token: string | null;

  finalizada_por: string | null;

  finalizada_at: string | null;

  secuencia_eventos: number;

  version: number;
};

type EventoDB = {
  id: string;

  cliente_evento_id: string;

  tipo_evento: string;

  equipo_id: string | null;

  jugador_id: string | null;

  estado: string;
};

type PlazaDB = {
  lado: "LOCAL" | "VISITANTE" | null;

  equipo_resuelto_id: string | null;
};

type EstadisticaDB = {
  id: string;

  codigo: string;

  ambito: "EQUIPO" | "INDIVIDUAL";

  activa: boolean;
};

type ResultadoDB = {
  id: string;

  marcador_local: number | null;

  marcador_visitante: number | null;

  ganador_equipo_id: string | null;

  resultado_tipo: string;

  confirmado: boolean;

  confirmado_at: string | null;
};

// ============================================================
// SELECTS
// ============================================================

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at";

const SELECT_EDICION = "id,torneo_id";

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,operador_id,controlador_id,control_token,finalizada_por,finalizada_at,secuencia_eventos,version";

const SELECT_EVENTOS =
  "id,cliente_evento_id,tipo_evento,equipo_id,jugador_id,estado";

const SELECT_PLAZAS = "lado,equipo_resuelto_id";

const SELECT_ESTADISTICAS = "id,codigo,ambito,activa";

const SELECT_RESULTADO =
  "id,marcador_local,marcador_visitante,ganador_equipo_id,resultado_tipo,confirmado,confirmado_at";

// ============================================================
// CÓDIGOS DE ESTADÍSTICAS
// ============================================================

const CODIGOS = {
  goles: new Set(["gol", "goles", "gols"]),

  amarillas: new Set([
    "amarilla",
    "amarillas",
    "tarjeta_amarilla",
    "tarjetas_amarillas",
    "targeta_groga",
    "targetes_grogues",
  ]),

  rojas: new Set([
    "roja",
    "rojas",
    "tarjeta_roja",
    "tarjetas_rojas",
    "targeta_vermella",
    "targetes_vermelles",
  ]),

  penaltisMarcados: new Set([
    "penalti_marcado",
    "penaltis_marcados",
    "penalti_gol",
    "penals_marcats",
  ]),

  penaltisFallados: new Set([
    "penalti_fallado",
    "penaltis_fallados",
    "penalti_fallat",
    "penals_fallats",
  ]),
};

// ============================================================
// ERROR
// ============================================================

function responderError(error: unknown) {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,

        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error finalitzant l'acta:", error);

  return responder(
    {
      success: false,

      mensaje: "No s'ha pogut finalitzar el partit.",
    },
    500,
  );
}

// ============================================================
// REGISTRO
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

// ============================================================
// UUID
// ============================================================

function identificador(
  valor: unknown,

  nombre: string,
) {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim().toLowerCase();

  if (!UUID.test(limpio)) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return limpio;
}

// ============================================================
// NORMALIZAR
// ============================================================

function normalizar(valor: string) {
  return valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirContexto(
  usuario: Usuario,

  partidoID: string,
) {
  const {
    data: partidoData,

    error: partidoError,
  } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .maybeSingle();

  if (partidoError) {
    throw partidoError;
  }

  const partido = partidoData as PartidoDB | null;

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  const {
    data: edicionData,

    error: edicionError,
  } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", partido.edicion_id)
    .maybeSingle();

  if (edicionError) {
    throw edicionError;
  }

  const edicion = edicionData as EdicionDB | null;

  if (!edicion || !edicion.torneo_id) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició del partit.");
  }

  const torneoID = identificador(edicion.torneo_id, "torneig");

  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "partits", "editar", torneoID)) {
    throw new ErrorAPI(403, "No tens permís per finalitzar aquest partit.");
  }

  const {
    data: actaData,

    error: actaError,
  } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (actaError) {
    throw actaError;
  }

  const acta = actaData as ActaDB | null;

  if (!acta) {
    throw new ErrorAPI(409, "L'acta encara no està iniciada.");
  }

  if (acta.edicion_id !== partido.edicion_id || acta.torneo_id !== torneoID) {
    throw new ErrorAPI(409, "L'acta no correspon al partit.");
  }

  return {
    partido,
    edicion,
    torneoID,
    acta,
  };
}

// ============================================================
// CONTROL
// ============================================================

function exigirControl(
  usuario: Usuario,

  acta: ActaDB,

  controlToken: string,
) {
  /*
   * FINALIZADA también se acepta para que la petición
   * sea idempotente si el primer intento se cortó después
   * de finalizar el acta pero antes de recibir respuesta.
   */
  if (acta.estado !== "EN_CURSO" && acta.estado !== "FINALIZADA") {
    throw new ErrorAPI(
      423,
      "L'acta no es pot finalitzar en el seu estat actual.",
    );
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
}

// ============================================================
// EQUIPOS
// ============================================================

async function obtenerEquipos(partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZAS)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (error) {
    throw error;
  }

  const plazas = (data ?? []) as PlazaDB[];

  const local =
    plazas.find((plaza) => plaza.lado === "LOCAL")?.equipo_resuelto_id ?? null;

  const visitante =
    plazas.find((plaza) => plaza.lado === "VISITANTE")?.equipo_resuelto_id ??
    null;

  if (!local || !visitante) {
    throw new ErrorAPI(409, "El partit no té resolts els dos equips.");
  }

  return {
    local,
    visitante,
  };
}

// ============================================================
// EVENTOS
// ============================================================

async function obtenerEventos(actaID: string) {
  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .select(SELECT_EVENTOS)
    .eq("acta_id", actaID);

  if (error) {
    throw error;
  }

  return (data ?? []) as EventoDB[];
}

// ============================================================
// VALOR DE EVENTO
// ============================================================

function valorEvento(
  evento: EventoDB,

  codigo: string,
) {
  if (evento.estado !== "ACTIVO") {
    return 0;
  }

  const normalizado = normalizar(codigo);

  if (CODIGOS.goles.has(normalizado)) {
    return evento.tipo_evento === "GOL" ||
      evento.tipo_evento === "PENALTI_MARCADO"
      ? 1
      : 0;
  }

  if (CODIGOS.amarillas.has(normalizado)) {
    return evento.tipo_evento === "TARJETA_AMARILLA" ? 1 : 0;
  }

  if (CODIGOS.rojas.has(normalizado)) {
    return evento.tipo_evento === "TARJETA_ROJA" ? 1 : 0;
  }

  if (CODIGOS.penaltisMarcados.has(normalizado)) {
    return evento.tipo_evento === "PENALTI_MARCADO" ? 1 : 0;
  }

  if (CODIGOS.penaltisFallados.has(normalizado)) {
    return evento.tipo_evento === "PENALTI_FALLADO" ? 1 : 0;
  }

  return null;
}

// ============================================================
// MARCADOR
// ============================================================

function calcularMarcador(
  eventos: EventoDB[],

  equipoID: string,
) {
  return eventos.reduce((total, evento) => {
    if (evento.estado !== "ACTIVO" || evento.equipo_id !== equipoID) {
      return total;
    }

    if (
      evento.tipo_evento === "GOL" ||
      evento.tipo_evento === "PENALTI_MARCADO"
    ) {
      return total + 1;
    }

    return total;
  }, 0);
}

// ============================================================
// ESTADÍSTICAS
// ============================================================

async function guardarEstadisticas(
  partidoID: string,

  edicionID: string,

  equipos: {
    local: string;

    visitante: string;
  },

  eventos: EventoDB[],
) {
  const { data, error } = await supabaseAdmin
    .from("competicion_estadisticas")
    .select(SELECT_ESTADISTICAS)
    .eq("edicion_id", edicionID)
    .eq("activa", true);

  if (error) {
    throw error;
  }

  const definiciones = (data ?? []) as EstadisticaDB[];

  for (const definicion of definiciones) {
    const reconocida =
      eventos.some(
        (evento) => valorEvento(evento, definicion.codigo) !== null,
      ) ||
      CODIGOS.goles.has(normalizar(definicion.codigo)) ||
      CODIGOS.amarillas.has(normalizar(definicion.codigo)) ||
      CODIGOS.rojas.has(normalizar(definicion.codigo)) ||
      CODIGOS.penaltisMarcados.has(normalizar(definicion.codigo)) ||
      CODIGOS.penaltisFallados.has(normalizar(definicion.codigo));

    /*
     * Las estadísticas que no correspondan a eventos
     * gestionados por esta acta no se inventan.
     */
    if (!reconocida) {
      continue;
    }

    // ====================================================
    // EQUIPO
    // ====================================================

    if (definicion.ambito === "EQUIPO") {
      const filas = [equipos.local, equipos.visitante].map((equipoID) => {
        const valor = eventos.reduce((total, evento) => {
          if (evento.equipo_id !== equipoID) {
            return total;
          }

          const incremento = valorEvento(evento, definicion.codigo);

          return total + (incremento ?? 0);
        }, 0);

        return {
          partido_id: partidoID,

          edicion_id: edicionID,

          equipo_id: equipoID,

          estadistica_id: definicion.id,

          ambito: "EQUIPO",

          valor,
        };
      });

      const { error: errorUpsert } = await supabaseAdmin
        .from("competicion_estadisticas_equipo")
        .upsert(filas, {
          onConflict: "partido_id,equipo_id,estadistica_id",
        });

      if (errorUpsert) {
        throw errorUpsert;
      }

      continue;
    }

    // ====================================================
    // INDIVIDUAL
    // ====================================================

    /*
     * Primero se eliminan las filas de esta estadística
     * para el partido.
     *
     * Esto evita dejar una tarjeta/gol antiguo si después
     * la jugada fue anulada.
     */
    const { error: errorDelete } = await supabaseAdmin
      .from("competicion_estadisticas_individuales")
      .delete()
      .eq("partido_id", partidoID)
      .eq("estadistica_id", definicion.id);

    if (errorDelete) {
      throw errorDelete;
    }

    const participantes = new Map<string, string>();

    for (const evento of eventos) {
      if (
        evento.estado !== "ACTIVO" ||
        !evento.jugador_id ||
        !evento.equipo_id
      ) {
        continue;
      }

      participantes.set(evento.jugador_id, evento.equipo_id);
    }

    const filas: Array<{
      partido_id: string;

      edicion_id: string;

      equipo_id: string;

      participante_id: string;

      estadistica_id: string;

      ambito: string;

      valor: number;
    }> = [];

    for (const [participanteID, equipoID] of participantes) {
      const valor = eventos.reduce((total, evento) => {
        if (evento.jugador_id !== participanteID) {
          return total;
        }

        const incremento = valorEvento(evento, definicion.codigo);

        return total + (incremento ?? 0);
      }, 0);

      if (valor === 0) {
        continue;
      }

      filas.push({
        partido_id: partidoID,

        edicion_id: edicionID,

        equipo_id: equipoID,

        participante_id: participanteID,

        estadistica_id: definicion.id,

        ambito: "INDIVIDUAL",

        valor,
      });
    }

    if (filas.length === 0) {
      continue;
    }

    const { error: errorInsert } = await supabaseAdmin
      .from("competicion_estadisticas_individuales")
      .insert(filas);

    if (errorInsert) {
      throw errorInsert;
    }
  }
}

// ============================================================
// RESULTADO
// ============================================================

async function confirmarResultado(
  partidoID: string,

  edicionID: string,

  marcadorLocal: number,

  marcadorVisitante: number,

  equipos: {
    local: string;

    visitante: string;
  },
) {
  const { data, error } = await supabaseAdmin
    .from("competicion_resultados")
    .select(SELECT_RESULTADO)
    .eq("partido_id", partidoID)
    .eq("edicion_id", edicionID)
    .eq("confirmado", true)
    .order("confirmado_at", {
      ascending: false,
    });

  if (error) {
    throw error;
  }

  const existentes = (data ?? []) as ResultadoDB[];

  if (existentes.length > 0) {
    const actual = existentes[0];

    if (
      actual.marcador_local !== marcadorLocal ||
      actual.marcador_visitante !== marcadorVisitante
    ) {
      throw new ErrorAPI(
        409,
        "El partit ja té un resultat confirmat diferent del resultat calculat per l'acta.",
      );
    }

    return actual;
  }

  const ganadorEquipoID =
    marcadorLocal === marcadorVisitante
      ? null
      : marcadorLocal > marcadorVisitante
        ? equipos.local
        : equipos.visitante;

  const ahora = new Date().toISOString();

  const {
    data: resultadoData,

    error: resultadoError,
  } = await supabaseAdmin
    .from("competicion_resultados")
    .insert({
      partido_id: partidoID,

      edicion_id: edicionID,

      marcador_local: marcadorLocal,

      marcador_visitante: marcadorVisitante,

      ganador_equipo_id: ganadorEquipoID,

      resultado_tipo: "NORMAL",

      confirmado: true,

      confirmado_at: ahora,

      observaciones: null,
    })
    .select(SELECT_RESULTADO)
    .single();

  if (resultadoError) {
    throw resultadoError;
  }

  return resultadoData as ResultadoDB;
}

// ============================================================
// FINALIZAR ACTA
// ============================================================

async function finalizarActa(
  usuario: Usuario,

  acta: ActaDB,
) {
  if (acta.estado === "FINALIZADA" && acta.finalizada_at) {
    return acta.finalizada_at;
  }

  const ahora = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .update({
      estado: "FINALIZADA",

      finalizada_por: usuario.id,

      finalizada_at: ahora,

      version: acta.version + 1,

      updated_at: ahora,
    })
    .eq("id", acta.id)
    .eq("controlador_id", usuario.id)
    .eq("control_token", acta.control_token)
    .select("id,estado,finalizada_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(
      409,
      "El control de l'acta ha canviat mentre es finalitzava.",
    );
  }

  return data.finalizada_at as string;
}

// ============================================================
// FINALIZAR PARTIDO
// ============================================================

async function finalizarPartidoDB(
  partido: PartidoDB,

  finalizadaAt: string,
) {
  if (partido.estado === "FINALIZADO" && partido.finalizado_at) {
    return partido.finalizado_at;
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .update({
      estado: "FINALIZADO",

      finalizado_at: finalizadaAt,
    })
    .eq("id", partido.id)
    .eq("edicion_id", partido.edicion_id)
    .select("id,estado,finalizado_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(409, "No s'ha pogut marcar el partit com a finalitzat.");
  }

  return data.finalizado_at as string;
}

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
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

    const { partido, acta } = await exigirContexto(usuario, partidoID);

    exigirControl(usuario, acta, controlToken);

    if (normalizar(acta.deporte) !== "futbol") {
      throw new ErrorAPI(
        409,
        "La finalització automàtica encara només està preparada per futbol.",
      );
    }

    // =================================================
    // DB ES LA FUENTE DE VERDAD
    // =================================================

    const [equipos, eventos] = await Promise.all([
      obtenerEquipos(partidoID),

      obtenerEventos(acta.id),
    ]);

    // =================================================
    // MARCADOR
    // =================================================

    const marcadorLocal = calcularMarcador(eventos, equipos.local);

    const marcadorVisitante = calcularMarcador(eventos, equipos.visitante);

    // =================================================
    // ESTADÍSTICAS
    // =================================================

    await guardarEstadisticas(partidoID, partido.edicion_id, equipos, eventos);

    // =================================================
    // RESULTADO
    // =================================================

    const resultado = await confirmarResultado(
      partidoID,
      partido.edicion_id,
      marcadorLocal,
      marcadorVisitante,
      equipos,
    );

    // =================================================
    // ACTA
    // =================================================

    const finalizadaAt = await finalizarActa(usuario, acta);

    // =================================================
    // PARTIDO
    // =================================================

    const partidoFinalizadoAt = await finalizarPartidoDB(partido, finalizadaAt);

    // =================================================
    // RESPUESTA
    // =================================================
    //
    // Esta estructura coincide con lo que exige
    // eliminarActaLocalTrasFinalizacion().
    //
    // =================================================

    return responder({
      success: true,

      finalizado: true,

      partidoID,

      partido: {
        id: partidoID,

        finalizado: true,

        finalizado_at: partidoFinalizadoAt,
      },

      acta: {
        estado: "FINALIZADA",
      },

      resultado: {
        estado: "CONFIRMADO",

        id: resultado.id,

        local: marcadorLocal,

        visitante: marcadorVisitante,

        ganadorEquipoID: resultado.ganador_equipo_id,
      },
    });
  } catch (error) {
    return responderError(error);
  }
};
