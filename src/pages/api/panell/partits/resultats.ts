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
};

type EdicionDB = {
  id: string;

  torneo_id: string | null;

  nombre: string | null;
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

  publicado: boolean;

  finalizado_at: string | null;
};

type PlazaDB = {
  partido_id: string | null;

  lado: LadoPartido | null;

  equipo_resuelto_id: string | null;
};

type EquipoDB = {
  id: string;

  nombre: string;

  escudo: string | null;
};

type ResultadoDB = {
  id: string;

  partido_id: string;

  edicion_id: string;

  marcador_local: number | null;

  marcador_visitante: number | null;

  ganador_equipo_id: string | null;

  resultado_tipo: string;

  confirmado: boolean;

  confirmado_at: string | null;

  observaciones: string | null;

  created_at: string;

  updated_at: string;
};

type ActaDB = {
  id: string;

  partido_id: string;

  estado: string;

  operador_id: string | null;

  controlador_id: string | null;

  iniciada_at: string | null;

  bloqueada_at: string | null;

  finalizada_at: string | null;

  version: number;

  updated_at: string;
};

// ============================================================
// SELECTS
// ============================================================

const SELECT_TORNEO = "id,nombre,deporte";

const SELECT_EDICION = "id,torneo_id,nombre";

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,publicado,finalizado_at";

const SELECT_PLAZA = "partido_id,lado,equipo_resuelto_id";

const SELECT_EQUIPO = "id,nombre,escudo";

const SELECT_RESULTADO =
  "id,partido_id,edicion_id,marcador_local,marcador_visitante,ganador_equipo_id,resultado_tipo,confirmado,confirmado_at,observaciones,created_at,updated_at";

const SELECT_ACTA =
  "id,partido_id,estado,operador_id,controlador_id,iniciada_at,bloqueada_at,finalizada_at,version,updated_at";

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

  console.error("Error carregant resultats:", error);

  return responder(
    {
      success: false,

      mensaje: "No s'han pogut carregar els resultats.",
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
    throw new ErrorAPI(403, "No tens permís per consultar els resultats.");
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

  if (!edicion) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició.");
  }

  if (edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig.");
  }

  return {
    torneo,
    edicion,
  };
}

// ============================================================
// EQUIPOS
// ============================================================

async function obtenerEquipos(ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, EquipoDB>();
  }

  const idsUnicos = [...new Set(ids)];

  const { data, error } = await supabaseAdmin
    .from("equipos")
    .select(SELECT_EQUIPO)
    .in("id", idsUnicos);

  if (error) {
    throw error;
  }

  const equipos = (data ?? []) as unknown as EquipoDB[];

  return new Map<string, EquipoDB>(
    equipos.map((equipo) => [
      equipo.id,

      {
        id: equipo.id,

        nombre: equipo.nombre ?? "Equip sense nom",

        escudo: equipo.escudo ?? null,
      },
    ]),
  );
}

// ============================================================
// RESULTADOS
// ============================================================
//
// La tabla permite varios registros por partido.
//
// Para la pantalla:
//
// 1. Priorizamos resultado confirmado.
// 2. Si existen varios confirmados, usamos el actualizado
//    más recientemente.
// 3. Si no existe confirmado, usamos el provisional
//    más reciente.
// ============================================================

function crearMapaResultados(resultados: ResultadoDB[]) {
  const agrupados = new Map<string, ResultadoDB[]>();

  for (const resultado of resultados) {
    const lista = agrupados.get(resultado.partido_id) ?? [];

    lista.push(resultado);

    agrupados.set(resultado.partido_id, lista);
  }

  const mapa = new Map<string, ResultadoDB>();

  for (const [partidoID, lista] of agrupados) {
    lista.sort((a, b) => {
      // ====================================================
      // CONFIRMADO ANTES QUE PROVISIONAL
      // ====================================================

      if (a.confirmado !== b.confirmado) {
        return a.confirmado ? -1 : 1;
      }

      // ====================================================
      // MÁS RECIENTE PRIMERO
      // ====================================================

      const fechaA = new Date(a.updated_at).getTime();

      const fechaB = new Date(b.updated_at).getTime();

      return fechaB - fechaA;
    });

    const seleccionado = lista[0];

    if (seleccionado) {
      mapa.set(partidoID, seleccionado);
    }
  }

  return mapa;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // ======================================================
    // USUARIO
    // ======================================================

    const usuario = await exigirUsuario(cookies);

    // ======================================================
    // PARÁMETROS
    // ======================================================

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    // ======================================================
    // CONTEXTO
    // ======================================================

    const contexto = await exigirContexto(usuario, torneoID, edicionID);

    // ======================================================
    // CONSULTAS
    // ======================================================

    const [
      respuestaPartidos,
      respuestaPlazas,
      respuestaResultados,
      respuestaActas,
    ] = await Promise.all([
      // ==================================================
      // PARTIDOS
      // ==================================================

      supabaseAdmin
        .from("competicion_partidos")
        .select(SELECT_PARTIDO)
        .eq("edicion_id", edicionID),

      // ==================================================
      // PLAZAS
      // ==================================================

      supabaseAdmin
        .from("competicion_plazas")
        .select(SELECT_PLAZA)
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "PARTIDO"),

      // ==================================================
      // RESULTADOS
      // ==================================================

      supabaseAdmin
        .from("competicion_resultados")
        .select(SELECT_RESULTADO)
        .eq("edicion_id", edicionID),

      // ==================================================
      // ACTAS
      // ==================================================

      supabaseAdmin
        .from("acta_partidos")
        .select(SELECT_ACTA)
        .eq("edicion_id", edicionID),
    ]);

    // ======================================================
    // ERRORES
    // ======================================================

    if (respuestaPartidos.error) {
      throw respuestaPartidos.error;
    }

    if (respuestaPlazas.error) {
      throw respuestaPlazas.error;
    }

    if (respuestaResultados.error) {
      throw respuestaResultados.error;
    }

    if (respuestaActas.error) {
      throw respuestaActas.error;
    }

    // ======================================================
    // NORMALIZAR RESULTADOS
    // ======================================================

    const partidos = (respuestaPartidos.data ?? []) as unknown as PartidoDB[];

    const plazas = (respuestaPlazas.data ?? []) as unknown as PlazaDB[];

    const resultados = (respuestaResultados.data ??
      []) as unknown as ResultadoDB[];

    const actas = (respuestaActas.data ?? []) as unknown as ActaDB[];

    // ======================================================
    // EQUIPOS NECESARIOS
    // ======================================================

    const idsEquipos = plazas
      .map((plaza) => plaza.equipo_resuelto_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id));

    const equipoPorID = await obtenerEquipos(idsEquipos);

    // ======================================================
    // MAPA RESULTADOS
    // ======================================================

    const resultadoPorPartido = crearMapaResultados(resultados);

    // ======================================================
    // MAPA ACTAS
    // ======================================================

    const actaPorPartido = new Map<string, ActaDB>(
      actas.map((acta) => [acta.partido_id, acta]),
    );

    // ======================================================
    // CONSTRUIR PARTIDOS
    // ======================================================

    const lista = partidos
      .map((partido) => {
        // ==============================================
        // PLAZA LOCAL
        // ==============================================

        const plazaLocal =
          plazas.find(
            (plaza) =>
              plaza.partido_id === partido.id && plaza.lado === "LOCAL",
          ) ?? null;

        // ==============================================
        // PLAZA VISITANTE
        // ==============================================

        const plazaVisitante =
          plazas.find(
            (plaza) =>
              plaza.partido_id === partido.id && plaza.lado === "VISITANTE",
          ) ?? null;

        // ==============================================
        // EQUIPO LOCAL
        // ==============================================

        const equipoLocal = plazaLocal?.equipo_resuelto_id
          ? (equipoPorID.get(plazaLocal.equipo_resuelto_id) ?? null)
          : null;

        // ==============================================
        // EQUIPO VISITANTE
        // ==============================================

        const equipoVisitante = plazaVisitante?.equipo_resuelto_id
          ? (equipoPorID.get(plazaVisitante.equipo_resuelto_id) ?? null)
          : null;

        // ==============================================
        // RESULTADO
        // ==============================================

        const resultado = resultadoPorPartido.get(partido.id) ?? null;

        // ==============================================
        // ACTA
        // ==============================================

        const acta = actaPorPartido.get(partido.id) ?? null;

        // ==============================================
        // RESPUESTA
        // ==============================================

        return {
          ...partido,

          local: {
            equipo: equipoLocal,
          },

          visitante: {
            equipo: equipoVisitante,
          },

          resultado,

          acta,
        };
      })
      .sort((a, b) => {
        const fechaA = a.fecha_hora
          ? new Date(a.fecha_hora).getTime()
          : Number.MAX_SAFE_INTEGER;

        const fechaB = b.fecha_hora
          ? new Date(b.fecha_hora).getTime()
          : Number.MAX_SAFE_INTEGER;

        if (fechaA !== fechaB) {
          return fechaA - fechaB;
        }

        return a.orden - b.orden;
      });

    // ======================================================
    // PERMISOS
    // ======================================================

    /*
     * Permiso utilizado por Resultats.tsx para mostrar
     * acciones administrativas como "Eliminar acta".
     *
     * Debe coincidir con el permiso que comprueba
     * DELETE /api/panell/acta.
     */
    const puedeEditar = tienePermiso(usuario, "partits", "editar", torneoID);

    /*
     * Se mantienen los permisos antiguos de acta-digital
     * por compatibilidad con el sistema existente.
     */
    const puedeVerActa = tienePermiso(usuario, "acta-digital", "ver", torneoID);

    const puedeEditarActa = tienePermiso(
      usuario,
      "acta-digital",
      "editar",
      torneoID,
    );

    // ======================================================
    // RESPUESTA
    // ======================================================

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      capacidades: {
        editar: puedeEditar,

        puedeVerActa,

        puedeEditarActa,
      },

      partidos: lista,
    });
  } catch (error) {
    return responderError(error);
  }
};
