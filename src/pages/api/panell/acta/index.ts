import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
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

type LadoActa = {
  lado: LadoPartido;
  resuelto: boolean;
  plaza: PlazaPartido | null;
  equipo: EquipoActa | null;
};

// ============================================================
// SELECTS
//
// IMPORTANTE:
// Supabase necesita que estas cadenas se mantengan como
// literales para poder inferir correctamente sus tipos.
//
// No utilizar:
//
// [
//   "id",
//   "nombre"
// ].join(",")
//
// porque el parser de tipos de Supabase lo interpreta como
// string genérico y genera GenericStringError.
// ============================================================

const SELECT_TORNEO = "id,nombre,deporte,logo";

const SELECT_EDICION = "id,torneo_id,nombre,estado,sede,fecha_inicio,fecha_fin";

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at";

const SELECT_FASE = "id,nombre,tipo,orden,estado,publicada";

const SELECT_GRUPO = "id,fase_id,nombre,orden,estado";

const SELECT_RONDA = "id,fase_id,tipo,nombre,orden";

const SELECT_PARTICIPANTE =
  "id,equipo_id,nombre,apellido1,apellido2,tipo_participante,validacion_estado,orden,activo";

const SELECT_EQUIPO = "id,nombre,escudo";

const SELECT_PLAZA =
  "id,lado,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id";

const SELECT_ACTA =
  "id,partido_id,estado,nivel_estadisticas,operador_id,controlador_id,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,version,created_at,updated_at";

// ============================================================
// RESPUESTAS DE ERROR
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

  console.error("Error carregant l'acta digital:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut carregar l'acta digital.",
    },
    500,
  );
}

// ============================================================
// VALIDACIÓN UUID
// ============================================================

function identificador(valor: unknown, nombre: string) {
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
// PARÁMETROS URL
// ============================================================

function leerParametros(url: URL) {
  return {
    torneoID: identificador(url.searchParams.get("torneoID"), "torneig"),

    edicionID: identificador(url.searchParams.get("edicionID"), "edició"),

    partidoID: identificador(url.searchParams.get("partidoID"), "partit"),
  };
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirContexto(
  usuario: Usuario,
  torneoID: string,
  edicionID: string,
) {
  // ========================================================
  // ACCESO AL TORNEO
  // ========================================================

  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  // ========================================================
  // PERMISO ACTA
  // ========================================================

  if (!tienePermiso(usuario, "acta-digital", "ver", torneoID)) {
    throw new ErrorAPI(403, "No tens permís per consultar l'acta digital.");
  }

  // ========================================================
  // TORNEO + EDICIÓN
  // ========================================================

  const [respuestaTorneo, respuestaEdicion] = await Promise.all([
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
  ]);

  if (respuestaTorneo.error) {
    throw respuestaTorneo.error;
  }

  if (respuestaEdicion.error) {
    throw respuestaEdicion.error;
  }

  const torneo = respuestaTorneo.data as TorneoDB | null;

  const edicion = respuestaEdicion.data as EdicionDB | null;

  if (!torneo) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  if (!edicion) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició.");
  }

  /*
   * IMPORTANTE:
   *
   * torneos.id = UUID
   * ediciones.torneo_id = TEXT
   *
   * Desde Supabase ambos valores llegan a TypeScript
   * como string.
   */
  if (edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig seleccionat.");
  }

  return {
    torneo,
    edicion,
  };
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

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  return data as PartidoDB;
}

// ============================================================
// ESTRUCTURA DE COMPETICIÓN
// ============================================================

async function obtenerEstructura(partido: PartidoDB) {
  // ========================================================
  // FASE
  // ========================================================

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

  // ========================================================
  // GRUPO
  // ========================================================

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

  // ========================================================
  // RONDA
  // ========================================================

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
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

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

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const jugadores = await obtenerJugadores(data.id);

  return {
    id: data.id,

    nombre: data.nombre ?? "Equip sense nom",

    escudo: data.escudo ?? null,

    jugadores,
  };
}

// ============================================================
// PLAZAS DEL PARTIDO
// ============================================================

async function obtenerPlazasPartido(
  partidoID: string,
): Promise<PlazaPartido[]> {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID)
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as PlazaPartido[];
}

// ============================================================
// EQUIPOS DEL PARTIDO
// ============================================================

async function obtenerEquiposPartido(partidoID: string) {
  const plazas = await obtenerPlazasPartido(partidoID);

  const plazaLocal = plazas.find((plaza) => plaza.lado === "LOCAL") ?? null;

  const plazaVisitante =
    plazas.find((plaza) => plaza.lado === "VISITANTE") ?? null;

  const [equipoLocal, equipoVisitante] = await Promise.all([
    obtenerEquipo(plazaLocal?.equipo_resuelto_id ?? null),

    obtenerEquipo(plazaVisitante?.equipo_resuelto_id ?? null),
  ]);

  const local: LadoActa = {
    lado: "LOCAL",

    resuelto: Boolean(equipoLocal),

    plaza: plazaLocal,

    equipo: equipoLocal,
  };

  const visitante: LadoActa = {
    lado: "VISITANTE",

    resuelto: Boolean(equipoVisitante),

    plaza: plazaVisitante,

    equipo: equipoVisitante,
  };

  return {
    local,
    visitante,
  };
}

// ============================================================
// ACTA EXISTENTE
// ============================================================

async function obtenerActa(partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // =================================================
    // USUARIO
    // =================================================

    const usuario = await exigirUsuario(cookies);

    // =================================================
    // IDS
    // =================================================

    const { torneoID, edicionID, partidoID } = leerParametros(url);

    // =================================================
    // TORNEO + EDICIÓN + PERMISOS
    // =================================================

    const contexto = await exigirContexto(usuario, torneoID, edicionID);

    // =================================================
    // PARTIDO
    // =================================================

    const partido = await obtenerPartido(partidoID, edicionID);

    // =================================================
    // DATOS PARALELOS
    // =================================================

    const [estructura, equipos, acta] = await Promise.all([
      obtenerEstructura(partido),

      obtenerEquiposPartido(partidoID),

      obtenerActa(partidoID),
    ]);

    // =================================================
    // RESPUESTA
    // =================================================

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      partido,

      estructura,

      equipos,

      acta,
    });
  } catch (error) {
    return responderError(error);
  }
};
