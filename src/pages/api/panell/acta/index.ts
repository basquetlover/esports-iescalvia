import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";

import { verificarPassword } from "../../sesiones/iniciar";

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

  estado: string;

  nivel_estadisticas: string;

  operador_id: string | null;

  controlador_id: string | null;

  control_token: string | null;

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
// SELECTS
// ============================================================

const SELECT_TORNEO = "id,nombre,deporte,logo";

const SELECT_EDICION = "id,torneo_id,nombre,estado,sede,fecha_inicio,fecha_fin";

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista_id,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at";

const SELECT_FASE = "id,nombre,tipo,orden,estado,publicada";

const SELECT_GRUPO = "id,fase_id,nombre,orden,estado";

const SELECT_RONDA = "id,fase_id,tipo,nombre,orden";

const SELECT_PARTICIPANTE =
  "id,equipo_id,nombre,apellido1,apellido2,tipo_participante,validacion_estado,orden,activo";

const SELECT_EQUIPO = "id,nombre,escudo";

const SELECT_PLAZA =
  "id,lado,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id";

const SELECT_ACTA =
  "id,partido_id,estado,nivel_estadisticas,operador_id,controlador_id,control_token,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,secuencia_eventos,version,created_at,updated_at";

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

  console.error("Error en l'acta digital:", error);

  return responder(
    {
      success: false,

      mensaje: "No s'ha pogut completar l'operació amb l'acta.",
    },
    500,
  );
}

// ============================================================
// UUID
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
// PARÁMETROS
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
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "partits", "ver", torneoID)) {
    throw new ErrorAPI(403, "No tens permís per consultar aquest partit.");
  }

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

  if (!edicion || edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
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
// ESTRUCTURA
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

  if (error) {
    throw error;
  }

  return (data ?? []) as ParticipanteActa[];
}

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

  return {
    id: data.id,

    nombre: data.nombre ?? "Equip sense nom",

    escudo: data.escudo ?? null,

    jugadores: await obtenerJugadores(data.id),
  };
}

// ============================================================
// EQUIPOS PARTIDO
// ============================================================

async function obtenerEquiposPartido(partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID)
    .order("orden");

  if (error) {
    throw error;
  }

  const plazas = (data ?? []) as PlazaPartido[];

  const local = plazas.find((plaza) => plaza.lado === "LOCAL") ?? null;

  const visitante = plazas.find((plaza) => plaza.lado === "VISITANTE") ?? null;

  const [equipoLocal, equipoVisitante] = await Promise.all([
    obtenerEquipo(local?.equipo_resuelto_id ?? null),

    obtenerEquipo(visitante?.equipo_resuelto_id ?? null),
  ]);

  return {
    local: {
      lado: "LOCAL" as const,

      resuelto: Boolean(equipoLocal),

      plaza: local,

      equipo: equipoLocal,
    },

    visitante: {
      lado: "VISITANTE" as const,

      resuelto: Boolean(equipoVisitante),

      plaza: visitante,

      equipo: equipoVisitante,
    },
  };
}

// ============================================================
// ACTA
// ============================================================

async function obtenerActa(partidoID: string): Promise<ActaDB | null> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ActaDB | null;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    const { torneoID, edicionID, partidoID } = leerParametros(url);

    const contexto = await exigirContexto(usuario, torneoID, edicionID);

    const partido = await obtenerPartido(partidoID, edicionID);

    const [estructura, equipos, acta] = await Promise.all([
      obtenerEstructura(partido),

      obtenerEquiposPartido(partidoID),

      obtenerActa(partidoID),
    ]);

    const puedeEditar = tienePermiso(usuario, "partits", "editar", torneoID);

    const esControlador = Boolean(acta && acta.controlador_id === usuario.id);

    const puedeEscribir = Boolean(
      puedeEditar && acta && esControlador && acta.estado === "EN_CURSO",
    );

    const actaPublica = acta
      ? {
          id: acta.id,

          partido_id: acta.partido_id,

          estado: acta.estado,

          nivel_estadisticas: acta.nivel_estadisticas,

          operador_id: acta.operador_id,

          controlador_id: acta.controlador_id,

          iniciada_at: acta.iniciada_at,

          bloqueada_por: acta.bloqueada_por,

          bloqueada_at: acta.bloqueada_at,

          motivo_bloqueo: acta.motivo_bloqueo,

          finalizada_por: acta.finalizada_por,

          finalizada_at: acta.finalizada_at,

          version: acta.version,

          created_at: acta.created_at,

          updated_at: acta.updated_at,
        }
      : null;

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      partido,

      estructura,

      equipos,

      acta: actaPublica,

      control: {
        puedeEditar,

        puedeEliminarActa: puedeEditar && Boolean(acta),

        esControlador,

        puedeEscribir,

        controlToken: puedeEscribir ? (acta?.control_token ?? null) : null,
      },
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// VALIDAR CONTRASEÑA
// ============================================================

async function exigirPasswordUsuario(usuario: Usuario, contrasena: unknown) {
  if (
    typeof contrasena !== "string" ||
    !contrasena ||
    contrasena.length > 4096
  ) {
    throw new ErrorAPI(400, "Introdueix la teva contrasenya.");
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,activa,contrasena")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.activa !== true) {
    throw new ErrorAPI(403, "El teu compte no està actiu.");
  }

  const valido = await verificarPassword(contrasena, data.contrasena);

  if (!valido) {
    throw new ErrorAPI(401, "La contrasenya no és correcta.");
  }
}

// ============================================================
// DEPENDENCIAS DE BRACKET
// ============================================================

async function limpiarDependencias(partidoID: string) {
  const { data: plazas, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select("id,partido_id,origen_tipo")
    .eq("origen_partido_id", partidoID);

  if (error) {
    throw error;
  }

  const dependencias = (plazas ?? []).filter(
    (plaza) =>
      plaza.partido_id &&
      (plaza.origen_tipo === "GANADOR_PARTIDO" ||
        plaza.origen_tipo === "PERDEDOR_PARTIDO"),
  );

  for (const plaza of dependencias) {
    const partidoDestinoID = plaza.partido_id as string;

    const [actaDestino, resultadoDestino] = await Promise.all([
      supabaseAdmin
        .from("acta_partidos")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("partido_id", partidoDestinoID),

      supabaseAdmin
        .from("competicion_resultados")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("partido_id", partidoDestinoID)
        .eq("confirmado", true),
    ]);

    if (actaDestino.error) {
      throw actaDestino.error;
    }

    if (resultadoDestino.error) {
      throw resultadoDestino.error;
    }

    if ((actaDestino.count ?? 0) > 0 || (resultadoDestino.count ?? 0) > 0) {
      throw new ErrorAPI(
        409,
        "No es pot eliminar l'acta perquè un partit posterior del bracket ja té acta o resultat. Elimina primer l'acta del partit dependent.",
      );
    }
  }

  if (dependencias.length === 0) {
    return;
  }

  const ids = dependencias.map((plaza) => plaza.id);

  const { error: errorLimpiar } = await supabaseAdmin
    .from("competicion_plazas")
    .update({
      equipo_resuelto_id: null,

      resuelta_at: null,
    })
    .in("id", ids);

  if (errorLimpiar) {
    throw errorLimpiar;
  }
}

// ============================================================
// DELETE ACTA
// ============================================================

export const DELETE: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const { torneoID, edicionID, partidoID } = leerParametros(url);

    await exigirContexto(usuario, torneoID, edicionID);

    if (!tienePermiso(usuario, "partits", "editar", torneoID)) {
      throw new ErrorAPI(403, "No tens permís per eliminar actes.");
    }

    const entrada = await leerJSON(request);

    await exigirPasswordUsuario(usuario, entrada.contrasena);

    const partido = await obtenerPartido(partidoID, edicionID);

    const acta = await obtenerActa(partidoID);

    if (!acta) {
      throw new ErrorAPI(404, "Aquest partit no té cap acta.");
    }

    // ======================================================
    // COMPROBAR Y LIMPIAR BRACKET
    // ======================================================

    await limpiarDependencias(partido.id);

    // ======================================================
    // ESTADÍSTICAS INDIVIDUALES
    // ======================================================

    const { error: errorIndividuales } = await supabaseAdmin
      .from("competicion_estadisticas_individuales")
      .delete()
      .eq("partido_id", partido.id);

    if (errorIndividuales) {
      throw errorIndividuales;
    }

    // ======================================================
    // ESTADÍSTICAS EQUIPO
    // ======================================================

    const { error: errorEquipo } = await supabaseAdmin
      .from("competicion_estadisticas_equipo")
      .delete()
      .eq("partido_id", partido.id);

    if (errorEquipo) {
      throw errorEquipo;
    }

    // ======================================================
    // RESULTADOS
    // ======================================================

    const { error: errorResultados } = await supabaseAdmin
      .from("competicion_resultados")
      .delete()
      .eq("partido_id", partido.id)
      .eq("edicion_id", edicionID);

    if (errorResultados) {
      throw errorResultados;
    }

    // ======================================================
    // EVENTOS
    // ======================================================

    const { error: errorEventos } = await supabaseAdmin
      .from("acta_eventos")
      .delete()
      .eq("acta_id", acta.id);

    if (errorEventos) {
      throw errorEventos;
    }

    // ======================================================
    // ACTA
    // ======================================================

    const { error: errorActa } = await supabaseAdmin
      .from("acta_partidos")
      .delete()
      .eq("id", acta.id)
      .eq("partido_id", partido.id);

    if (errorActa) {
      throw errorActa;
    }

    // ======================================================
    // PARTIDO
    // ======================================================

    const nuevoEstado = partido.publicado ? "PROGRAMADO" : "BORRADOR";

    const { data: partidoActualizado, error: errorPartido } =
      await supabaseAdmin
        .from("competicion_partidos")
        .update({
          estado: nuevoEstado,

          finalizado_at: null,
        })
        .eq("id", partido.id)
        .eq("edicion_id", edicionID)
        .select(SELECT_PARTIDO)
        .single();

    if (errorPartido) {
      throw errorPartido;
    }

    return responder({
      success: true,

      mensaje: "L'acta s'ha eliminat correctament.",

      partido: partidoActualizado,
    });
  } catch (error) {
    return responderError(error);
  }
};
