import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

import { ErrorAPI, responder } from "@utils/inscripcio/equipBase";

import { exigirPartidoDesignadoVoluntariat } from "@utils/voluntariat/acceso";

import { obtenerAccesoActa } from "@utils/acta/acceso";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type LadoPartido = "LOCAL" | "VISITANTE";

type TorneoDB = {
  id: string;
  nombre: string | null;
  deporte: string | null;
  logo: string | null;
};

type EdicionDB = {
  id: string;
  torneo_id: string | null;
  nombre: string | null;
  estado: string | null;
  sede: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  fase_id: string;
  fase_tipo: "GRUPOS" | "ELIMINATORIA";
  tipo: "GRUPO" | "ELIMINATORIA";
  grupo_id: string | null;
  ronda_id: string | null;
  codigo: string;
  nombre: string | null;
  orden: number;
  jornada: number | null;
  estado: string;
  fecha_hora: string | null;
  pista_id: string | null;
  pista: string | null;
  duracion_estimada_min: number | null;
  publicado: boolean;
  finalizado_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ParticipanteActa = {
  id: string;
  equipo_id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  tipo_participante: string | null;
  validacion_estado: string | null;
  orden: number | null;
  activo: boolean | null;
};

type EquipoActa = {
  id: string;
  nombre: string;
  escudo: string | null;
  jugadores: ParticipanteActa[];
};

type PlazaPartido = {
  id: string;
  lado: LadoPartido | null;
  origen_tipo: string | null;
  equipo_origen_id: string | null;
  origen_grupo_id: string | null;
  origen_fase_id: string | null;
  origen_posicion: number | null;
  origen_partido_id: string | null;
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

const SELECT_TORNEO = "id,nombre,deporte,logo" as const;

const SELECT_EDICION =
  "id,torneo_id,nombre,estado,sede,fecha_inicio,fecha_fin" as const;

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista_id,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at" as const;

const SELECT_FASE = "id,nombre,tipo,orden,estado,publicada" as const;

const SELECT_GRUPO = "id,fase_id,nombre,orden,estado" as const;

const SELECT_RONDA = "id,fase_id,tipo,nombre,orden" as const;

const SELECT_PARTICIPANTE =
  "id,equipo_id,nombre,apellido1,apellido2,tipo_participante,validacion_estado,orden,activo" as const;

const SELECT_EQUIPO = "id,nombre,escudo" as const;

const SELECT_PLAZA =
  "id,lado,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id" as const;

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,estado_operativo,nivel_estadisticas,configuracion_snapshot,operador_id,controlador_id,control_token,control_generacion,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,secuencia_eventos,version,created_at,updated_at" as const;

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

  console.error("Error consultant l'acta del voluntariat:", error);

  return respuesta(
    {
      success: false,
      mensaje: "No s'ha pogut carregar l'acta digital.",
    },
    500,
  );
}

// ============================================================
// TORNEO Y EDICIÓN
// ============================================================

async function obtenerTorneo(torneoID: string): Promise<TorneoDB> {
  const { data, error } = await supabaseAdmin
    .from("torneos")
    .select(SELECT_TORNEO)
    .eq("id", torneoID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  return data as TorneoDB;
}

async function obtenerEdicion(
  torneoID: string,
  edicionID: string,
): Promise<EdicionDB> {
  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", edicionID)
    .eq("torneo_id", torneoID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició dins aquest torneig.");
  }

  return data as EdicionDB;
}

// ============================================================
// PARTIDO
// ============================================================

async function obtenerPartido(
  partidoID: string,
  edicionID: string,
): Promise<PartidoDB> {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .eq("edicion_id", edicionID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  return data as PartidoDB;
}

// ============================================================
// ESTRUCTURA DEL PARTIDO
// ============================================================

async function obtenerEstructura(partido: PartidoDB) {
  const fasePromesa = partido.fase_id
    ? supabaseAdmin
        .from("competicion_fases")
        .select(SELECT_FASE)
        .eq("id", partido.fase_id)
        .maybeSingle()
    : Promise.resolve({
        data: null,
        error: null,
      });

  const grupoPromesa = partido.grupo_id
    ? supabaseAdmin
        .from("competicion_grupos")
        .select(SELECT_GRUPO)
        .eq("id", partido.grupo_id)
        .maybeSingle()
    : Promise.resolve({
        data: null,
        error: null,
      });

  const rondaPromesa = partido.ronda_id
    ? supabaseAdmin
        .from("competicion_rondas")
        .select(SELECT_RONDA)
        .eq("id", partido.ronda_id)
        .maybeSingle()
    : Promise.resolve({
        data: null,
        error: null,
      });

  const [respuestaFase, respuestaGrupo, respuestaRonda] = await Promise.all([
    fasePromesa,
    grupoPromesa,
    rondaPromesa,
  ]);

  if (respuestaFase.error) {
    throw respuestaFase.error;
  }

  if (respuestaGrupo.error) {
    throw respuestaGrupo.error;
  }

  if (respuestaRonda.error) {
    throw respuestaRonda.error;
  }

  return {
    fase: respuestaFase.data,
    grupo: respuestaGrupo.data,
    ronda: respuestaRonda.data,
  };
}

// ============================================================
// JUGADORES
// ============================================================

async function obtenerJugadores(equipoID: string): Promise<ParticipanteActa[]> {
  const { data, error } = await supabaseAdmin
    .from("participantes_equipo")
    .select(SELECT_PARTICIPANTE)
    .eq("equipo_id", equipoID)
    .eq("tipo_participante", "JUGADOR")
    .eq("activo", true)
    .order("orden");

  if (error) throw error;

  return (data ?? []) as ParticipanteActa[];
}

// ============================================================
// EQUIPO
// ============================================================

async function obtenerEquipo(
  equipoID: string | null,
): Promise<EquipoActa | null> {
  if (!equipoID) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("equipos")
    .select(SELECT_EQUIPO)
    .eq("id", equipoID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return null;
  }

  const jugadores = await obtenerJugadores(equipoID);

  return {
    id: data.id,
    nombre: data.nombre ?? "Equip sense nom",
    escudo: data.escudo ?? null,
    jugadores,
  };
}

// ============================================================
// EQUIPOS DEL PARTIDO
// ============================================================

async function obtenerEquiposPartido(partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID)
    .order("orden");

  if (error) throw error;

  const plazas = (data ?? []) as PlazaPartido[];

  const plazaLocal = plazas.find((plaza) => plaza.lado === "LOCAL") ?? null;

  const plazaVisitante =
    plazas.find((plaza) => plaza.lado === "VISITANTE") ?? null;

  const [equipoLocal, equipoVisitante] = await Promise.all([
    obtenerEquipo(plazaLocal?.equipo_resuelto_id ?? null),

    obtenerEquipo(plazaVisitante?.equipo_resuelto_id ?? null),
  ]);

  return {
    local: {
      lado: "LOCAL" as const,
      resuelto: Boolean(equipoLocal),
      plaza: plazaLocal,
      equipo: equipoLocal,
    },

    visitante: {
      lado: "VISITANTE" as const,
      resuelto: Boolean(equipoVisitante),
      plaza: plazaVisitante,
      equipo: equipoVisitante,
    },
  };
}

// ============================================================
// ACTA OFICIAL
// ============================================================

async function obtenerActa(
  torneoID: string,
  edicionID: string,
  partidoID: string,
): Promise<ActaDB | null> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return null;
  }

  const acta = data as ActaDB;

  if (
    acta.partido_id !== partidoID ||
    acta.torneo_id !== torneoID ||
    acta.edicion_id !== edicionID
  ) {
    throw new ErrorAPI(409, "L'acta no correspon al partit seleccionat.");
  }

  return acta;
}

// ============================================================
// DATOS PÚBLICOS DEL ACTA
// ============================================================

function actaPublica(acta: ActaDB) {
  // El token no se incluye aquí:
  // únicamente se devuelve al controlador
  // mediante el objeto control.

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

    secuencia_eventos: acta.secuencia_eventos,

    version: acta.version,

    created_at: acta.created_at,

    updated_at: acta.updated_at,
  };
}

// ============================================================
// GET — DATOS PARA EL REACT DEL VOLUNTARIO
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // ========================================================
    // IDENTIFICADORES Y DESIGNACIÓN
    // ========================================================

    const contexto = await exigirPartidoDesignadoVoluntariat(
      cookies,
      url.searchParams.get("torneoID"),
      url.searchParams.get("edicionID"),
      url.searchParams.get("partidoID"),
    );

    const { usuario, torneoID, edicionID, partidoID, funciones } = contexto;

    // ========================================================
    // PERMISOS DE ACTA
    // ========================================================

    const acceso = await obtenerAccesoActa({
      usuario,
      torneoID,
      edicionID,
      partidoID,
    });

    // Esta ruta exige voluntariado confirmado.
    // No basta con tener un rol administrativo.

    if (
      !acceso.voluntarioConfirmado ||
      (!acceso.designadoArbitro && !acceso.designadoOficial)
    ) {
      throw new ErrorAPI(
        403,
        "No tens una designació confirmada per gestionar aquesta acta.",
      );
    }

    if (!acceso.puedeConsultar || acceso.bloqueadoAcceso) {
      throw new ErrorAPI(403, "No tens permís per consultar aquesta acta.");
    }

    // ========================================================
    // DATOS OFICIALES
    // ========================================================

    const [torneo, edicion, partido, acta] = await Promise.all([
      obtenerTorneo(torneoID),
      obtenerEdicion(torneoID, edicionID),
      obtenerPartido(partidoID, edicionID),
      obtenerActa(torneoID, edicionID, partidoID),
    ]);

    const [estructura, equipos] = await Promise.all([
      obtenerEstructura(partido),
      obtenerEquiposPartido(partidoID),
    ]);

    // ========================================================
    // CONTROL DEL ACTA
    // ========================================================

    const esControlador = Boolean(
      acta && acceso.esControlador && acta.controlador_id === usuario.id,
    );

    const bloqueada = Boolean(
      acta &&
      (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null),
    );

    const estadoEscritura = Boolean(
      acta &&
      acta.estado === "EN_CURSO" &&
      ["CONTROLADA", "EN_SUPERVISION"].includes(acta.estado_operativo),
    );

    const puedeEscribir = Boolean(
      acceso.puedeEscribir &&
      esControlador &&
      estadoEscritura &&
      !bloqueada &&
      !acceso.bloqueadoControl &&
      !acceso.actaFinalizada &&
      !acceso.revisionActiva &&
      acta?.control_token,
    );

    const puedeSolicitarControl = Boolean(
      acceso.puedeSolicitarControl &&
      !acceso.bloqueadoControl &&
      !acceso.actaFinalizada &&
      !bloqueada,
    );

    // ========================================================
    // RESPUESTA COMPATIBLE CON EL EDITOR REACT
    // ========================================================

    return respuesta({
      success: true,

      servidorAhora: new Date().toISOString(),

      torneo,
      edicion,
      partido,
      estructura,
      equipos,

      acta: acta ? actaPublica(acta) : null,

      funciones,

      control: {
        puedeEditar: acceso.puedeControlar,

        puedeEliminarActa: false,

        puedeSolicitarControl,

        esControlador,

        hayOtroControlador: acceso.hayOtroControlador,

        puedeEscribir,

        bloqueadoControl: acceso.bloqueadoControl,

        controlGeneracion: acta?.control_generacion ?? null,

        // Nunca entregar el token
        // a otro voluntario ni durante
        // un bloqueo administrativo.
        controlToken: puedeEscribir ? (acta?.control_token ?? null) : null,
      },
    });
  } catch (error) {
    return responderError(error);
  }
};
