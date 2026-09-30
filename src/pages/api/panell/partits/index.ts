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

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type TipoFase = "GRUPOS" | "ELIMINATORIA";

type TipoPartido = "GRUPO" | "ELIMINATORIA";

type EstadoPartido =
  | "BORRADOR"
  | "PROGRAMADO"
  | "EN_CURSO"
  | "FINALIZADO"
  | "SUSPENDIDO"
  | "CANCELADO";

type Lado = "LOCAL" | "VISITANTE";

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type FaseDB = {
  id: string;
  edicion_id: string;
  nombre: string;
  tipo: TipoFase;
  orden: number;
  estado: string;
  publicada: boolean;
};

type GrupoDB = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
  estado: string;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  fase_id: string;
  fase_tipo: TipoFase;
  tipo: TipoPartido;
  grupo_id: string | null;
  ronda_id: string | null;
  codigo: string;
  nombre: string | null;
  orden: number;
  jornada: number | null;
  estado: EstadoPartido;
  fecha_hora: string | null;
  pista_id: string | null;
  pista: string | null;
  duracion_estimada_min: number | null;
  publicado: boolean;
  finalizado_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PistaDB = {
  id: string;
  torneo_id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  activa: boolean;
};

type PlazaDB = {
  id: string;
  edicion_id: string;
  destino_fase_id: string;
  destino_tipo: "GRUPO" | "PARTIDO";
  grupo_id: string | null;
  partido_id: string | null;
  lado: Lado | null;
  orden: number;
  origen_tipo: string;
  equipo_origen_id: string | null;
  origen_grupo_id: string | null;
  origen_fase_id: string | null;
  origen_posicion: number | null;
  origen_partido_id: string | null;
  equipo_resuelto_id: string | null;
  resuelta_at: string | null;
};

type AvisoConflicto = {
  tipo: "PISTA" | "EQUIPO";
  mensaje: string;

  partido: {
    id: string;
    codigo: string;
    nombre: string | null;
    fecha_hora: string | null;
    duracion_estimada_min: number | null;
  };

  equipo_id?: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const ESTADOS: readonly EstadoPartido[] = [
  "BORRADOR",
  "PROGRAMADO",
  "EN_CURSO",
  "FINALIZADO",
  "SUSPENDIDO",
  "CANCELADO",
];

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista_id,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at";

const SELECT_PLAZA =
  "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at";

const SELECT_PISTA = "id,torneo_id,nombre,descripcion,ubicacion,activa";

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

  console.error("Error Calendari i resultats:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

// ============================================================
// VALIDACIÓN
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

function identificadorOpcional(
  valor: unknown,
  nombre: string,
): string | null | undefined {
  if (valor === undefined) {
    return undefined;
  }

  if (valor === null || valor === "") {
    return null;
  }

  return identificador(valor, nombre);
}

function texto(
  valor: unknown,
  nombre: string,
  maximo: number,
  obligatorio = false,
) {
  if (valor === undefined || valor === null) {
    if (obligatorio) {
      throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
    }

    return "";
  }

  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim();

  if (obligatorio && !limpio) {
    throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
  }

  if (limpio.length > maximo) {
    throw new ErrorAPI(
      400,
      `El camp ${nombre} supera els ${maximo} caràcters.`,
    );
  }

  return limpio;
}

function enteroPositivo(valor: unknown, nombre: string) {
  const numero = typeof valor === "number" ? valor : Number(valor);

  if (!Number.isSafeInteger(numero) || numero < 1) {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  return numero;
}

function enteroOpcional(
  valor: unknown,
  nombre: string,
): number | null | undefined {
  if (valor === undefined) {
    return undefined;
  }

  if (valor === null || valor === "") {
    return null;
  }

  return enteroPositivo(valor, nombre);
}

function fechaISO(valor: unknown): string | null | undefined {
  if (valor === undefined) {
    return undefined;
  }

  if (valor === null || valor === "") {
    return null;
  }

  if (typeof valor !== "string") {
    throw new ErrorAPI(400, "La data i hora no és vàlida.");
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorAPI(400, "La data i hora no és vàlida.");
  }

  return fecha.toISOString();
}

function estadoPartido(valor: unknown): EstadoPartido {
  const estado = texto(valor, "estat", 30, true).toUpperCase();

  if (!ESTADOS.includes(estado as EstadoPartido)) {
    throw new ErrorAPI(400, "L'estat del partit no és vàlid.");
  }

  return estado as EstadoPartido;
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirContexto(
  usuario: Usuario,
  torneoID: string,
  edicionID: string,
  accion: "ver" | "crear" | "editar" | "eliminar",
) {
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "partits", accion, torneoID)) {
    throw new ErrorAPI(403, "No tens permís per realitzar aquesta acció.");
  }

  const [torneoRespuesta, edicionRespuesta] = await Promise.all([
    supabaseAdmin
      .from("torneos")
      .select("id,nombre,deporte")
      .eq("id", torneoID)
      .maybeSingle(),

    supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id,nombre,estado,sede,fecha_inicio,fecha_fin")
      .eq("id", edicionID)
      .maybeSingle(),
  ]);

  if (torneoRespuesta.error) {
    throw torneoRespuesta.error;
  }

  if (edicionRespuesta.error) {
    throw edicionRespuesta.error;
  }

  if (!torneoRespuesta.data) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  if (!edicionRespuesta.data || edicionRespuesta.data.torneo_id !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig.");
  }

  return {
    torneo: torneoRespuesta.data,

    edicion: edicionRespuesta.data,
  };
}

// ============================================================
// PARTIDO
// ============================================================

async function exigirPartido(partidoID: string, edicionID: string) {
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

async function exigirGrupo(grupoID: string, edicionID: string) {
  const { data: grupo, error } = await supabaseAdmin
    .from("competicion_grupos")
    .select("id,fase_id,nombre,orden,estado")
    .eq("id", grupoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!grupo) {
    throw new ErrorAPI(404, "No s'ha trobat el grup.");
  }

  const { data: fase, error: errorFase } = await supabaseAdmin
    .from("competicion_fases")
    .select("id,edicion_id,nombre,tipo,orden,estado,publicada")
    .eq("id", grupo.fase_id)
    .eq("edicion_id", edicionID)
    .eq("tipo", "GRUPOS")
    .maybeSingle();

  if (errorFase) {
    throw errorFase;
  }

  if (!fase) {
    throw new ErrorAPI(409, "El grup no pertany a una fase de grups vàlida.");
  }

  return {
    grupo: grupo as GrupoDB,

    fase: fase as FaseDB,
  };
}

// ============================================================
// PISTAS
// ============================================================

async function exigirPista(
  pistaID: string,
  torneoID: string,
  permitirInactiva = false,
) {
  const { data, error } = await supabaseAdmin
    .from("competicion_pistas")
    .select(SELECT_PISTA)
    .eq("id", pistaID)
    .eq("torneo_id", torneoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(
      404,
      "La pista seleccionada no pertany a aquest torneig.",
    );
  }

  if (!permitirInactiva && data.activa !== true) {
    throw new ErrorAPI(409, "La pista seleccionada està inactiva.");
  }

  return data as PistaDB;
}

// ============================================================
// PLAZAS
// ============================================================

async function obtenerPlazasPartido(partidoID: string) {
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

  return (data ?? []) as PlazaDB[];
}

async function eliminarPlazasPartido(partidoID: string) {
  const { error } = await supabaseAdmin
    .from("competicion_plazas")
    .delete()
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (error) {
    throw error;
  }
}

async function crearPlazasGrupo(
  partido: PartidoDB,
  localID: string,
  visitanteID: string,
) {
  const ahora = new Date().toISOString();

  const { error } = await supabaseAdmin.from("competicion_plazas").insert([
    {
      edicion_id: partido.edicion_id,

      destino_fase_id: partido.fase_id,

      destino_tipo: "PARTIDO",

      partido_id: partido.id,

      lado: "LOCAL",

      orden: 1,

      origen_tipo: "EQUIPO",

      equipo_origen_id: localID,

      equipo_resuelto_id: localID,

      resuelta_at: ahora,
    },

    {
      edicion_id: partido.edicion_id,

      destino_fase_id: partido.fase_id,

      destino_tipo: "PARTIDO",

      partido_id: partido.id,

      lado: "VISITANTE",

      orden: 2,

      origen_tipo: "EQUIPO",

      equipo_origen_id: visitanteID,

      equipo_resuelto_id: visitanteID,

      resuelta_at: ahora,
    },
  ]);

  if (error) {
    throw error;
  }
}

// ============================================================
// EQUIPOS
// ============================================================

async function exigirEquipoGrupo(
  edicionID: string,
  grupoID: string,
  equipoID: string,
) {
  const { data: activo, error: errorActivo } = await supabaseAdmin
    .from("competicion_equipos")
    .select("equipo_id")
    .eq("edicion_id", edicionID)
    .eq("equipo_id", equipoID)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (errorActivo) {
    throw errorActivo;
  }

  if (!activo) {
    throw new ErrorAPI(409, "L'equip no forma part de la competició.");
  }

  const { data: plaza, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select("id")
    .eq("edicion_id", edicionID)
    .eq("destino_tipo", "GRUPO")
    .eq("grupo_id", grupoID)
    .eq("equipo_resuelto_id", equipoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!plaza) {
    throw new ErrorAPI(409, "L'equip no pertany al grup seleccionat.");
  }
}

// ============================================================
// DATOS DE JUEGO
// ============================================================

async function tieneDatosJuego(partidoID: string) {
  const [acta, resultado] = await Promise.all([
    supabaseAdmin
      .from("acta_partidos")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("partido_id", partidoID),

    supabaseAdmin
      .from("competicion_resultados")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("partido_id", partidoID),
  ]);

  if (acta.error) {
    throw acta.error;
  }

  if (resultado.error) {
    throw resultado.error;
  }

  return (acta.count ?? 0) > 0 || (resultado.count ?? 0) > 0;
}

// ============================================================
// PROGRAMACIÓN
// ============================================================

async function validarProgramable(
  partidoID: string,
  fechaHora: string | null,
  pistaID: string | null,
  torneoID: string,
) {
  if (!fechaHora) {
    throw new ErrorAPI(409, "Indica la data i l'hora del partit.");
  }

  if (!pistaID) {
    throw new ErrorAPI(409, "Selecciona una pista configurada.");
  }

  await exigirPista(pistaID, torneoID, true);

  const plazas = await obtenerPlazasPartido(partidoID);

  if (
    !plazas.some((plaza) => plaza.lado === "LOCAL") ||
    !plazas.some((plaza) => plaza.lado === "VISITANTE")
  ) {
    throw new ErrorAPI(409, "El partit necessita local i visitant.");
  }
}

// ============================================================
// CONFLICTOS
// ============================================================

function solapan(
  fechaA: string,
  duracionA: number | null,
  fechaB: string,
  duracionB: number | null,
) {
  const inicioA = new Date(fechaA);

  const inicioB = new Date(fechaB);

  const finA = new Date(
    inicioA.getTime() + Math.max(duracionA ?? 1, 1) * 60_000,
  );

  const finB = new Date(
    inicioB.getTime() + Math.max(duracionB ?? 1, 1) * 60_000,
  );

  return inicioA < finB && inicioB < finA;
}

async function detectarConflictos(
  partido: PartidoDB,
): Promise<AvisoConflicto[]> {
  if (
    !partido.fecha_hora ||
    partido.estado === "CANCELADO" ||
    partido.estado === "SUSPENDIDO"
  ) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("edicion_id", partido.edicion_id)
    .neq("id", partido.id)
    .not("fecha_hora", "is", null);

  if (error) {
    throw error;
  }

  const candidatos = (data ?? [])
    .map((item) => item as PartidoDB)
    .filter(
      (item) =>
        item.estado !== "CANCELADO" &&
        item.estado !== "SUSPENDIDO" &&
        item.fecha_hora &&
        solapan(
          partido.fecha_hora!,
          partido.duracion_estimada_min,
          item.fecha_hora,
          item.duracion_estimada_min,
        ),
    );

  const avisos: AvisoConflicto[] = [];

  for (const otro of candidatos) {
    if (partido.pista_id && otro.pista_id === partido.pista_id) {
      avisos.push({
        tipo: "PISTA",

        mensaje: `La pista coincideix amb "${otro.nombre ?? otro.codigo}".`,

        partido: {
          id: otro.id,

          codigo: otro.codigo,

          nombre: otro.nombre,

          fecha_hora: otro.fecha_hora,

          duracion_estimada_min: otro.duracion_estimada_min,
        },
      });
    }
  }

  const plazasActual = await obtenerPlazasPartido(partido.id);

  const equiposActual = new Set(
    plazasActual
      .map((plaza) => plaza.equipo_resuelto_id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const otro of candidatos) {
    const plazasOtro = await obtenerPlazasPartido(otro.id);

    const repetido = plazasOtro.find(
      (plaza) =>
        plaza.equipo_resuelto_id && equiposActual.has(plaza.equipo_resuelto_id),
    );

    if (repetido?.equipo_resuelto_id) {
      avisos.push({
        tipo: "EQUIPO",

        equipo_id: repetido.equipo_resuelto_id,

        mensaje: `Un equip també juga "${otro.nombre ?? otro.codigo}" en aquesta franja.`,

        partido: {
          id: otro.id,

          codigo: otro.codigo,

          nombre: otro.nombre,

          fecha_hora: otro.fecha_hora,

          duracion_estimada_min: otro.duracion_estimada_min,
        },
      });
    }
  }

  return avisos;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    const contexto = await exigirContexto(usuario, torneoID, edicionID, "ver");

    const [
      fasesRespuesta,
      partidosRespuesta,
      plazasRespuesta,
      plazasGrupoRespuesta,
      equiposRespuesta,
      pistasRespuesta,
    ] = await Promise.all([
      supabaseAdmin
        .from("competicion_fases")
        .select("id,edicion_id,nombre,tipo,orden,estado,publicada")
        .eq("edicion_id", edicionID)
        .order("orden"),

      supabaseAdmin
        .from("competicion_partidos")
        .select(SELECT_PARTIDO)
        .eq("edicion_id", edicionID),

      supabaseAdmin
        .from("competicion_plazas")
        .select(SELECT_PLAZA)
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "PARTIDO"),

      supabaseAdmin
        .from("competicion_plazas")
        .select(SELECT_PLAZA)
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "GRUPO"),

      supabaseAdmin
        .from("competicion_equipos")
        .select("equipo_id,seed,equipos(id,nombre,escudo)")
        .eq("edicion_id", edicionID)
        .eq("estado", "ACTIVO"),

      supabaseAdmin
        .from("competicion_pistas")
        .select(SELECT_PISTA)
        .eq("torneo_id", torneoID)
        .order("nombre"),
    ]);

    for (const respuesta of [
      fasesRespuesta,
      partidosRespuesta,
      plazasRespuesta,
      plazasGrupoRespuesta,
      equiposRespuesta,
      pistasRespuesta,
    ]) {
      if (respuesta.error) {
        throw respuesta.error;
      }
    }

    const fases = (fasesRespuesta.data ?? []) as FaseDB[];

    const idsFases = fases.map((fase) => fase.id);

    let grupos: GrupoDB[] = [];

    let rondas: Array<{
      id: string;
      fase_id: string;
      tipo: string;
      nombre: string;
      orden: number;
    }> = [];

    if (idsFases.length > 0) {
      const [gruposRespuesta, rondasRespuesta] = await Promise.all([
        supabaseAdmin
          .from("competicion_grupos")
          .select("id,fase_id,nombre,orden,estado")
          .in("fase_id", idsFases)
          .order("orden"),

        supabaseAdmin
          .from("competicion_rondas")
          .select("id,fase_id,tipo,nombre,orden")
          .in("fase_id", idsFases)
          .order("orden"),
      ]);

      if (gruposRespuesta.error) {
        throw gruposRespuesta.error;
      }

      if (rondasRespuesta.error) {
        throw rondasRespuesta.error;
      }

      grupos = (gruposRespuesta.data ?? []) as GrupoDB[];

      rondas = rondasRespuesta.data ?? [];
    }

    const partidos = (partidosRespuesta.data ?? []) as PartidoDB[];

    const equipos = (equiposRespuesta.data ?? []).flatMap((registro) => {
      const equipo = Array.isArray(registro.equipos)
        ? registro.equipos[0]
        : registro.equipos;

      if (!equipo) {
        return [];
      }

      return [
        {
          id: equipo.id,

          nombre: equipo.nombre ?? "Equip",

          escudo: equipo.escudo ?? null,

          seed: registro.seed ?? null,
        },
      ];
    });

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      capacidades: {
        crear: tienePermiso(usuario, "partits", "crear", torneoID),

        editar: tienePermiso(usuario, "partits", "editar", torneoID),

        eliminar: tienePermiso(usuario, "partits", "eliminar", torneoID),
      },

      resumen: {
        total: partidos.length,

        borradores: partidos.filter((partido) => partido.estado === "BORRADOR")
          .length,

        programados: partidos.filter(
          (partido) => partido.estado === "PROGRAMADO",
        ).length,

        publicados: partidos.filter((partido) => partido.publicado).length,

        finalizados: partidos.filter(
          (partido) => partido.estado === "FINALIZADO",
        ).length,
      },

      equipos,

      pistas: pistasRespuesta.data ?? [],

      fases: fases.map((fase) => ({
        ...fase,

        grupos: grupos.filter((grupo) => grupo.fase_id === fase.id),

        rondas: rondas.filter((ronda) => ronda.fase_id === fase.id),
      })),

      partidos,

      plazas: plazasRespuesta.data ?? [],

      plazasGrupo: plazasGrupoRespuesta.data ?? [],
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// POST — CREAR PARTIDO DE GRUPO
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "crear");

    if (entrada.accion !== "crear_partido") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    if (entrada.tipo !== "GRUPOS") {
      throw new ErrorAPI(
        409,
        "Els partits eliminatoris es creen des de Format de competició.",
      );
    }

    const grupoID = identificador(entrada.grupoID, "grup");

    const localID = identificador(entrada.localID, "equip local");

    const visitanteID = identificador(entrada.visitanteID, "equip visitant");

    if (localID === visitanteID) {
      throw new ErrorAPI(409, "Un equip no pot jugar contra si mateix.");
    }

    const { grupo, fase } = await exigirGrupo(grupoID, edicionID);

    await Promise.all([
      exigirEquipoGrupo(edicionID, grupoID, localID),

      exigirEquipoGrupo(edicionID, grupoID, visitanteID),
    ]);

    const { data: ultimo, error: errorOrden } = await supabaseAdmin
      .from("competicion_partidos")
      .select("orden")
      .eq("grupo_id", grupoID)
      .order("orden", {
        ascending: false,
      })
      .limit(1);

    if (errorOrden) {
      throw errorOrden;
    }

    const orden = (ultimo?.[0]?.orden ?? -1) + 1;

    const jornada = enteroPositivo(entrada.jornada, "jornada");

    const pistaID = identificadorOpcional(entrada.pistaID, "pista") ?? null;

    const pista = pistaID ? await exigirPista(pistaID, torneoID) : null;

    const fechaHora = fechaISO(entrada.fechaHora) ?? null;

    const duracion = enteroOpcional(entrada.duracion, "duració") ?? null;

    const nombre = texto(entrada.nombre, "nom", 120);

    const publicar = entrada.publicado === true;

    const { data, error } = await supabaseAdmin
      .from("competicion_partidos")
      .insert({
        edicion_id: edicionID,

        fase_id: fase.id,

        fase_tipo: "GRUPOS",

        tipo: "GRUPO",

        grupo_id: grupo.id,

        ronda_id: null,

        codigo: `F${fase.orden + 1}-G${grupo.orden + 1}-J${jornada}-P${orden + 1}`,

        nombre: nombre || `${grupo.nombre} · Jornada ${jornada}`,

        orden,

        jornada,

        estado: "BORRADOR",

        fecha_hora: fechaHora,

        pista_id: pista?.id ?? null,

        pista: pista?.nombre ?? null,

        duracion_estimada_min: duracion,

        publicado: false,
      })
      .select(SELECT_PARTIDO)
      .single();

    if (error) {
      throw error;
    }

    const partido = data as PartidoDB;

    await crearPlazasGrupo(partido, localID, visitanteID);

    let partidoFinal = partido;

    if (publicar) {
      await validarProgramable(
        partido.id,
        fechaHora,
        pista?.id ?? null,
        torneoID,
      );

      const { data: actualizado, error: errorActualizar } = await supabaseAdmin
        .from("competicion_partidos")
        .update({
          publicado: true,

          estado: "PROGRAMADO",
        })
        .eq("id", partido.id)
        .select(SELECT_PARTIDO)
        .single();

      if (errorActualizar) {
        throw errorActualizar;
      }

      partidoFinal = actualizado as PartidoDB;
    }

    return responder(
      {
        success: true,

        partido: partidoFinal,

        avisos: await detectarConflictos(partidoFinal),
      },
      201,
    );
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// PATCH
// ============================================================

export const PATCH: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const partidoID = identificador(entrada.partidoID, "partit");

    const partido = await exigirPartido(partidoID, edicionID);

    // ======================================================
    // CAMBIAR ESTADO
    // ======================================================

    if (entrada.accion === "cambiar_estado") {
      const estado = estadoPartido(entrada.estado);

      if (estado === "PROGRAMADO" || estado === "EN_CURSO") {
        await validarProgramable(
          partido.id,
          partido.fecha_hora,
          partido.pista_id,
          torneoID,
        );
      }

      const cambios: Record<string, unknown> = {
        estado,
      };

      if (estado === "BORRADOR") {
        cambios.publicado = false;

        cambios.finalizado_at = null;
      } else if (estado === "FINALIZADO") {
        cambios.finalizado_at =
          partido.finalizado_at ?? new Date().toISOString();
      } else {
        cambios.finalizado_at = null;
      }

      if (estado === "PROGRAMADO" || estado === "EN_CURSO") {
        cambios.publicado = true;
      }

      const { data, error } = await supabaseAdmin
        .from("competicion_partidos")
        .update(cambios)
        .eq("id", partido.id)
        .select(SELECT_PARTIDO)
        .single();

      if (error) {
        throw error;
      }

      const actualizado = data as PartidoDB;

      return responder({
        success: true,

        partido: actualizado,

        avisos: await detectarConflictos(actualizado),
      });
    }

    // ======================================================
    // EDITAR PARTIDO
    // ======================================================

    if (entrada.accion !== "editar_partido") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    const cambios: Record<string, unknown> = {};

    if (entrada.nombre !== undefined) {
      cambios.nombre = texto(entrada.nombre, "nom", 120) || null;
    }

    if (entrada.jornada !== undefined) {
      cambios.jornada = enteroPositivo(entrada.jornada, "jornada");
    }

    const fecha = fechaISO(entrada.fechaHora);

    if (fecha !== undefined) {
      cambios.fecha_hora = fecha;
    }

    const duracion = enteroOpcional(entrada.duracion, "duració");

    if (duracion !== undefined) {
      cambios.duracion_estimada_min = duracion;
    }

    // ======================================================
    // PISTA
    // ======================================================

    if (entrada.pistaID !== undefined) {
      const pistaID = identificadorOpcional(entrada.pistaID, "pista");

      if (!pistaID) {
        cambios.pista_id = null;

        cambios.pista = null;
      } else {
        const pista = await exigirPista(
          pistaID,
          torneoID,
          pistaID === partido.pista_id,
        );

        cambios.pista_id = pista.id;

        cambios.pista = pista.nombre;
      }
    }

    // ======================================================
    // EQUIPOS DE GRUPO
    // ======================================================

    if (entrada.localID !== undefined || entrada.visitanteID !== undefined) {
      if (partido.tipo !== "GRUPO") {
        throw new ErrorAPI(
          409,
          "Els participants d'una eliminatòria es modifiquen des de Format de competició.",
        );
      }

      if (!partido.grupo_id) {
        throw new ErrorAPI(409, "El partit no té cap grup.");
      }

      if (await tieneDatosJuego(partido.id)) {
        throw new ErrorAPI(
          409,
          "El partit ja té una acta o un resultat. Elimina l'acta abans de canviar els equips.",
        );
      }

      const localID = identificador(entrada.localID, "equip local");

      const visitanteID = identificador(entrada.visitanteID, "equip visitant");

      if (localID === visitanteID) {
        throw new ErrorAPI(409, "Un equip no pot jugar contra si mateix.");
      }

      await Promise.all([
        exigirEquipoGrupo(edicionID, partido.grupo_id, localID),

        exigirEquipoGrupo(edicionID, partido.grupo_id, visitanteID),
      ]);

      await eliminarPlazasPartido(partido.id);

      await crearPlazasGrupo(partido, localID, visitanteID);
    }

    // ======================================================
    // PUBLICADO
    // ======================================================

    if (entrada.publicado !== undefined) {
      if (typeof entrada.publicado !== "boolean") {
        throw new ErrorAPI(400, "El valor de publicació no és vàlid.");
      }

      cambios.publicado = entrada.publicado;

      if (entrada.publicado && partido.estado === "BORRADOR") {
        cambios.estado = "PROGRAMADO";
      }
    }

    const fechaFinal =
      "fecha_hora" in cambios
        ? (cambios.fecha_hora as string | null)
        : partido.fecha_hora;

    const pistaFinal =
      "pista_id" in cambios
        ? (cambios.pista_id as string | null)
        : partido.pista_id;

    const publicadoFinal =
      "publicado" in cambios ? Boolean(cambios.publicado) : partido.publicado;

    const estadoFinal =
      "estado" in cambios ? String(cambios.estado) : partido.estado;

    if (
      publicadoFinal ||
      estadoFinal === "PROGRAMADO" ||
      estadoFinal === "EN_CURSO"
    ) {
      await validarProgramable(partido.id, fechaFinal, pistaFinal, torneoID);
    }

    if (Object.keys(cambios).length === 0) {
      return responder({
        success: true,

        partido,

        avisos: await detectarConflictos(partido),
      });
    }

    const { data, error } = await supabaseAdmin
      .from("competicion_partidos")
      .update(cambios)
      .eq("id", partido.id)
      .select(SELECT_PARTIDO)
      .single();

    if (error) {
      throw error;
    }

    const actualizado = data as PartidoDB;

    return responder({
      success: true,

      partido: actualizado,

      avisos: await detectarConflictos(actualizado),
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// DELETE PARTIDO
// ============================================================

export const DELETE: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "eliminar");

    const partidoID = identificador(entrada.partidoID, "partit");

    const partido = await exigirPartido(partidoID, edicionID);

    if (partido.tipo === "ELIMINATORIA") {
      throw new ErrorAPI(
        409,
        "Els partits eliminatoris s'eliminen des de Format de competició.",
      );
    }

    if (await tieneDatosJuego(partido.id)) {
      throw new ErrorAPI(
        409,
        "El partit té una acta o un resultat. Elimina primer l'acta.",
      );
    }

    await eliminarPlazasPartido(partido.id);

    const { error } = await supabaseAdmin
      .from("competicion_partidos")
      .delete()
      .eq("id", partido.id);

    if (error) {
      throw error;
    }

    return responder({
      success: true,
    });
  } catch (error) {
    return responderError(error);
  }
};
