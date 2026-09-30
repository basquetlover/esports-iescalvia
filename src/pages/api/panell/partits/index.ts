import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
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

type TipoOrigen =
  | "EQUIPO"
  | "POSICION_GRUPO"
  | "POSICION_FASE"
  | "GANADOR_PARTIDO"
  | "PERDEDOR_PARTIDO"
  | "LIBRE";

type LadoPartido = "LOCAL" | "VISITANTE";

type EstadoEditable = "BORRADOR" | "PROGRAMADO" | "SUSPENDIDO" | "CANCELADO";

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

type RondaDB = {
  id: string;
  fase_id: string;
  tipo: string;
  nombre: string;
  orden: number;
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

  estado: string;

  fecha_hora: string | null;

  /*
   * Fuente de verdad.
   */
  pista_id: string | null;

  /*
   * Campo antiguo.
   *
   * Se mantiene únicamente por compatibilidad.
   * Nunca acepta texto introducido por el usuario.
   */
  pista: string | null;

  duracion_estimada_min: number | null;

  publicado: boolean;

  finalizado_at: string | null;

  created_at: string | null;

  updated_at: string | null;
};

type PlazaDB = {
  id: string;

  edicion_id: string;

  destino_fase_id: string;

  destino_tipo: "GRUPO" | "PARTIDO";

  grupo_id: string | null;

  partido_id: string | null;

  lado: LadoPartido | null;

  orden: number;

  origen_tipo: TipoOrigen;

  equipo_origen_id: string | null;

  origen_grupo_id: string | null;

  origen_fase_id: string | null;

  origen_posicion: number | null;

  origen_partido_id: string | null;

  equipo_resuelto_id: string | null;

  resuelta_at: string | null;
};

type PistaDB = {
  id: string;
  torneo_id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  activa: boolean;
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

const TIPOS_FASE: readonly TipoFase[] = ["GRUPOS", "ELIMINATORIA"];

const ESTADOS_EDITABLES: readonly EstadoEditable[] = [
  "BORRADOR",
  "PROGRAMADO",
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

function errorRespuesta(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,

        mensaje: error.message,
      },
      error.estado,
    );
  }

  const codigo =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;

  const constraint =
    typeof error === "object" &&
    error !== null &&
    "constraint" in error &&
    typeof error.constraint === "string"
      ? error.constraint
      : "";

  console.error("Error Calendari i resultats:", error);

  if (codigo === "23503") {
    return responder(
      {
        success: false,

        mensaje:
          "Aquest partit està relacionat amb altres dades de la competició.",
      },
      409,
    );
  }

  if (codigo === "23505") {
    return responder(
      {
        success: false,

        mensaje: "Ja existeix un partit o una relació amb aquestes dades.",
      },
      409,
    );
  }

  if (codigo === "23514") {
    if (constraint.toLowerCase().includes("tipo")) {
      return responder(
        {
          success: false,

          mensaje: "El tipus de partit no coincideix amb la fase seleccionada.",
        },
        400,
      );
    }

    return responder(
      {
        success: false,

        mensaje:
          "La configuració del partit no compleix les regles de la competició.",
      },
      400,
    );
  }

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

function identificador(valor: unknown, nombre: string): string {
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
): string {
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

function enteroPositivo(valor: unknown, nombre: string): number {
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

function booleano(valor: unknown, nombre: string) {
  if (typeof valor !== "boolean") {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  return valor;
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

function tipoFase(valor: unknown): TipoFase {
  const tipo = texto(valor, "tipus", 30, true).toUpperCase();

  if (!TIPOS_FASE.includes(tipo as TipoFase)) {
    throw new ErrorAPI(400, "El tipus de partit no és vàlid.");
  }

  return tipo as TipoFase;
}

function estadoEditable(valor: unknown): EstadoEditable {
  const estado = texto(valor, "estat", 30, true).toUpperCase();

  if (!ESTADOS_EDITABLES.includes(estado as EstadoEditable)) {
    throw new ErrorAPI(
      400,
      "Aquest estat no es pot establir des del calendari.",
    );
  }

  return estado as EstadoEditable;
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
// ESTRUCTURA
// ============================================================

async function exigirFase(
  faseID: string,
  edicionID: string,
  tipoEsperado?: TipoFase,
): Promise<FaseDB> {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select("id,edicion_id,nombre,tipo,orden,estado,publicada")
    .eq("id", faseID)
    .eq("edicion_id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat la fase.");
  }

  if (tipoEsperado && data.tipo !== tipoEsperado) {
    throw new ErrorAPI(
      409,
      "La fase no correspon al tipus de partit seleccionat.",
    );
  }

  return data as FaseDB;
}

async function exigirGrupo(grupoID: string, edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_grupos")
    .select("id,fase_id,nombre,orden,estado")
    .eq("id", grupoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el grup.");
  }

  const fase = await exigirFase(data.fase_id, edicionID, "GRUPOS");

  return {
    grupo: data as GrupoDB,

    fase,
  };
}

async function exigirPartido(
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
// PISTAS
// ============================================================

async function exigirPista(
  pistaID: string,
  torneoID: string,
  permitirInactiva = false,
): Promise<PistaDB> {
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

  if (!permitirInactiva && !data.activa) {
    throw new ErrorAPI(409, "La pista seleccionada està inactiva.");
  }

  return data as PistaDB;
}

async function obtenerPistas(torneoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_pistas")
    .select(SELECT_PISTA)
    .eq("torneo_id", torneoID)
    .order("activa", {
      ascending: false,
    })
    .order("nombre", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as PistaDB[];
}

// ============================================================
// EQUIPOS
// ============================================================

async function obtenerEquiposActivos(edicionID: string) {
  const { data: registros, error } = await supabaseAdmin
    .from("competicion_equipos")
    .select("equipo_id,estado,seed")
    .eq("edicion_id", edicionID)
    .eq("estado", "ACTIVO");

  if (error) {
    throw error;
  }

  const ids = (registros ?? [])
    .map((registro) => registro.equipo_id)
    .filter((id): id is string => typeof id === "string" && Boolean(id));

  if (ids.length === 0) {
    return [];
  }

  const { data: equipos, error: errorEquipos } = await supabaseAdmin
    .from("equipos")
    .select("id,nombre,escudo")
    .in("id", ids);

  if (errorEquipos) {
    throw errorEquipos;
  }

  const mapa = new Map((equipos ?? []).map((equipo) => [equipo.id, equipo]));

  return (registros ?? [])
    .flatMap((registro) => {
      const equipo = mapa.get(registro.equipo_id);

      if (!equipo) {
        return [];
      }

      return [
        {
          id: equipo.id,

          nombre: equipo.nombre ?? "Equip sense nom",

          escudo: equipo.escudo ?? null,

          seed: registro.seed ?? null,
        },
      ];
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "ca"));
}

async function exigirEquipoActivo(edicionID: string, equipoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_equipos")
    .select("equipo_id,estado")
    .eq("edicion_id", edicionID)
    .eq("equipo_id", equipoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.estado !== "ACTIVO") {
    throw new ErrorAPI(409, "Aquest equip no forma part de la competició.");
  }
}

async function idsEquiposGrupo(edicionID: string, grupoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select("equipo_resuelto_id")
    .eq("edicion_id", edicionID)
    .eq("destino_tipo", "GRUPO")
    .eq("grupo_id", grupoID);

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .map((plaza) => plaza.equipo_resuelto_id)
      .filter((id): id is string => Boolean(id)),
  );
}

async function validarPartidoGrupo(
  edicionID: string,
  grupoID: string,
  localID: string,
  visitanteID: string,
) {
  if (localID === visitanteID) {
    throw new ErrorAPI(409, "Un equip no pot jugar contra si mateix.");
  }

  await Promise.all([
    exigirEquipoActivo(edicionID, localID),

    exigirEquipoActivo(edicionID, visitanteID),
  ]);

  const equipos = await idsEquiposGrupo(edicionID, grupoID);

  if (!equipos.has(localID)) {
    throw new ErrorAPI(409, "L'equip local no pertany al grup seleccionat.");
  }

  if (!equipos.has(visitanteID)) {
    throw new ErrorAPI(409, "L'equip visitant no pertany al grup seleccionat.");
  }
}

// ============================================================
// ORDEN
// ============================================================

async function siguienteOrdenGrupo(grupoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select("orden")
    .eq("grupo_id", grupoID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? -1) + 1;
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

  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .insert([
      {
        edicion_id: partido.edicion_id,

        destino_fase_id: partido.fase_id,

        destino_tipo: "PARTIDO",

        grupo_id: null,

        partido_id: partido.id,

        lado: "LOCAL",

        orden: 1,

        origen_tipo: "EQUIPO",

        equipo_origen_id: localID,

        origen_grupo_id: null,

        origen_fase_id: null,

        origen_posicion: null,

        origen_partido_id: null,

        equipo_resuelto_id: localID,

        resuelta_at: ahora,
      },

      {
        edicion_id: partido.edicion_id,

        destino_fase_id: partido.fase_id,

        destino_tipo: "PARTIDO",

        grupo_id: null,

        partido_id: partido.id,

        lado: "VISITANTE",

        orden: 2,

        origen_tipo: "EQUIPO",

        equipo_origen_id: visitanteID,

        origen_grupo_id: null,

        origen_fase_id: null,

        origen_posicion: null,

        origen_partido_id: null,

        equipo_resuelto_id: visitanteID,

        resuelta_at: ahora,
      },
    ])
    .select(SELECT_PLAZA);

  if (error) {
    throw error;
  }

  return data ?? [];
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
    throw new ErrorAPI(
      409,
      "Indica la data i l'hora abans de programar o publicar el partit.",
    );
  }

  if (!pistaID) {
    throw new ErrorAPI(409, "Selecciona una pista configurada per al torneig.");
  }

  /*
   * Aquí permitimos una pista actualmente inactiva
   * si ya estaba vinculada históricamente.
   *
   * Una pista nueva/recién seleccionada se valida
   * como activa en exigirPista() durante el PATCH/POST.
   */
  await exigirPista(pistaID, torneoID, true);

  const plazas = await obtenerPlazasPartido(partidoID);

  if (
    !plazas.some((plaza) => plaza.lado === "LOCAL") ||
    !plazas.some((plaza) => plaza.lado === "VISITANTE")
  ) {
    throw new ErrorAPI(
      409,
      "Configura el local i el visitant abans de programar el partit.",
    );
  }
}

// ============================================================
// CONFLICTOS
// ============================================================

function intervalosSolapan(
  inicioA: Date,
  duracionA: number | null,
  inicioB: Date,
  duracionB: number | null,
) {
  const minutosA = Math.max(duracionA ?? 1, 1);

  const minutosB = Math.max(duracionB ?? 1, 1);

  const finA = new Date(inicioA.getTime() + minutosA * 60_000);

  const finB = new Date(inicioB.getTime() + minutosB * 60_000);

  return inicioA < finB && inicioB < finA;
}

async function equiposResueltosPartido(partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select("equipo_resuelto_id")
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID)
    .not("equipo_resuelto_id", "is", null);

  if (error) {
    throw error;
  }

  return new Set(
    (data ?? [])
      .map((plaza) => plaza.equipo_resuelto_id)
      .filter((id): id is string => typeof id === "string" && Boolean(id)),
  );
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

  const inicioActual = new Date(partido.fecha_hora);

  if (Number.isNaN(inicioActual.getTime())) {
    return [];
  }

  const { data: candidatos, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("edicion_id", partido.edicion_id)
    .neq("id", partido.id)
    .not("fecha_hora", "is", null)
    .not("estado", "in", '("CANCELADO","SUSPENDIDO")');

  if (error) {
    throw error;
  }

  const solapados = (candidatos ?? [])
    .map((candidato) => candidato as PartidoDB)
    .filter((otro) => {
      if (!otro.fecha_hora) {
        return false;
      }

      const inicioOtro = new Date(otro.fecha_hora);

      if (Number.isNaN(inicioOtro.getTime())) {
        return false;
      }

      return intervalosSolapan(
        inicioActual,
        partido.duracion_estimada_min,
        inicioOtro,
        otro.duracion_estimada_min,
      );
    });

  if (solapados.length === 0) {
    return [];
  }

  const avisos: AvisoConflicto[] = [];

  // ========================================================
  // MISMA PISTA
  // ========================================================

  if (partido.pista_id) {
    for (const otro of solapados) {
      if (otro.pista_id === partido.pista_id) {
        avisos.push({
          tipo: "PISTA",

          mensaje: `La pista ja està ocupada pel partit "${otro.nombre ?? otro.codigo}" en un horari que se solapa.`,

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
  }

  // ========================================================
  // MISMO EQUIPO
  // ========================================================

  const equiposActual = await equiposResueltosPartido(partido.id);

  if (equiposActual.size === 0) {
    return avisos;
  }

  const idsPartidos = solapados.map((otro) => otro.id);

  const { data: plazasOtros, error: errorPlazas } = await supabaseAdmin
    .from("competicion_plazas")
    .select("partido_id,equipo_resuelto_id")
    .in("partido_id", idsPartidos)
    .not("equipo_resuelto_id", "is", null);

  if (errorPlazas) {
    throw errorPlazas;
  }

  const equiposPorPartido = new Map<string, Set<string>>();

  for (const plaza of plazasOtros ?? []) {
    if (!plaza.partido_id || !plaza.equipo_resuelto_id) {
      continue;
    }

    if (!equiposPorPartido.has(plaza.partido_id)) {
      equiposPorPartido.set(plaza.partido_id, new Set());
    }

    equiposPorPartido.get(plaza.partido_id)?.add(plaza.equipo_resuelto_id);
  }

  const equiposConConflicto = new Set<string>();

  for (const otro of solapados) {
    const equiposOtro = equiposPorPartido.get(otro.id);

    if (!equiposOtro) {
      continue;
    }

    for (const equipoID of equiposActual) {
      if (!equiposOtro.has(equipoID)) {
        continue;
      }

      equiposConConflicto.add(equipoID);

      avisos.push({
        tipo: "EQUIPO",

        equipo_id: equipoID,

        mensaje: `Un equip té el partit "${otro.nombre ?? otro.codigo}" en un horari que se solapa.`,

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

  if (equiposConConflicto.size > 0) {
    const { data: equipos, error: errorEquipos } = await supabaseAdmin
      .from("equipos")
      .select("id,nombre")
      .in("id", Array.from(equiposConConflicto));

    if (errorEquipos) {
      throw errorEquipos;
    }

    const nombres = new Map(
      (equipos ?? []).map((equipo) => [equipo.id, equipo.nombre ?? "Equip"]),
    );

    for (const aviso of avisos) {
      if (aviso.tipo !== "EQUIPO" || !aviso.equipo_id) {
        continue;
      }

      aviso.mensaje =
        `${nombres.get(aviso.equipo_id) ?? "L'equip"} té el partit ` +
        `"${aviso.partido.nombre ?? aviso.partido.codigo}" en un horari que se solapa.`;
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
      plazasPartidoRespuesta,
      plazasGrupoRespuesta,
      equipos,
      pistas,
    ] = await Promise.all([
      supabaseAdmin
        .from("competicion_fases")
        .select("id,edicion_id,nombre,tipo,orden,estado,publicada")
        .eq("edicion_id", edicionID)
        .order("orden", {
          ascending: true,
        }),

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
        .eq("destino_tipo", "GRUPO")
        .order("orden", {
          ascending: true,
        }),

      obtenerEquiposActivos(edicionID),

      obtenerPistas(torneoID),
    ]);

    if (fasesRespuesta.error) {
      throw fasesRespuesta.error;
    }

    if (partidosRespuesta.error) {
      throw partidosRespuesta.error;
    }

    if (plazasPartidoRespuesta.error) {
      throw plazasPartidoRespuesta.error;
    }

    if (plazasGrupoRespuesta.error) {
      throw plazasGrupoRespuesta.error;
    }

    const fases = (fasesRespuesta.data ?? []) as FaseDB[];

    const idsFases = fases.map((fase) => fase.id);

    let grupos: GrupoDB[] = [];

    let rondas: RondaDB[] = [];

    if (idsFases.length > 0) {
      const [gruposRespuesta, rondasRespuesta] = await Promise.all([
        supabaseAdmin
          .from("competicion_grupos")
          .select("id,fase_id,nombre,orden,estado")
          .in("fase_id", idsFases)
          .order("orden", {
            ascending: true,
          }),

        supabaseAdmin
          .from("competicion_rondas")
          .select("id,fase_id,tipo,nombre,orden")
          .in("fase_id", idsFases)
          .order("orden", {
            ascending: true,
          }),
      ]);

      if (gruposRespuesta.error) {
        throw gruposRespuesta.error;
      }

      if (rondasRespuesta.error) {
        throw rondasRespuesta.error;
      }

      grupos = (gruposRespuesta.data ?? []) as GrupoDB[];

      rondas = (rondasRespuesta.data ?? []) as RondaDB[];
    }

    const partidos = (partidosRespuesta.data ?? [])
      .map((partido) => partido as PartidoDB)
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

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      capacidades: {
        /*
         * Crear desde calendario solo afecta
         * a partidos de grupo.
         */
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
          (partido) =>
            partido.estado === "FINALIZADO" || Boolean(partido.finalizado_at),
        ).length,
      },

      equipos,

      /*
       * Selector de pista del calendario.
       */
      pistas,

      fases: fases.map((fase) => ({
        ...fase,

        grupos: grupos.filter((grupo) => grupo.fase_id === fase.id),

        rondas: rondas.filter((ronda) => ronda.fase_id === fase.id),
      })),

      partidos,

      plazas: plazasPartidoRespuesta.data ?? [],

      plazasGrupo: plazasGrupoRespuesta.data ?? [],
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// POST
// ============================================================
//
// IMPORTANTE:
//
// Desde Calendari i resultats solamente se crean partidos
// de GRUPO.
//
// Los partidos eliminatorios se crean desde:
//   Format de competició -> Eliminatòria
//
// Así no se puede romper accidentalmente un bracket generado.
// ============================================================

export const POST: APIRoute = async ({ cookies, request, url }) => {
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

    const tipo = tipoFase(entrada.tipo);

    if (tipo !== "GRUPOS") {
      throw new ErrorAPI(
        409,
        "Els partits eliminatoris s'han de crear des de Format de competició.",
      );
    }

    const nombre = texto(entrada.nombre, "nom", 120);

    const fechaHora = fechaISO(entrada.fechaHora) ?? null;

    const duracion = enteroOpcional(entrada.duracion, "duració") ?? null;

    const jornada = enteroPositivo(entrada.jornada, "jornada");

    const grupoID = identificador(entrada.grupoID, "grup");

    const localID = identificador(entrada.localID, "equip local");

    const visitanteID = identificador(entrada.visitanteID, "equip visitant");

    const pistaID = identificadorOpcional(entrada.pistaID, "pista") ?? null;

    /*
     * Si se selecciona una pista para un nuevo partido,
     * debe existir, pertenecer al torneo y estar activa.
     */
    let pista: PistaDB | null = null;

    if (pistaID) {
      pista = await exigirPista(pistaID, torneoID);
    }

    const publicar = entrada.publicado === true;

    const { grupo, fase } = await exigirGrupo(grupoID, edicionID);

    await validarPartidoGrupo(edicionID, grupo.id, localID, visitanteID);

    const orden = await siguienteOrdenGrupo(grupo.id);

    const codigo =
      `F${fase.orden + 1}` +
      `-G${grupo.orden + 1}` +
      `-J${jornada}` +
      `-P${orden + 1}`;

    const { data, error } = await supabaseAdmin
      .from("competicion_partidos")
      .insert({
        edicion_id: edicionID,

        fase_id: fase.id,

        fase_tipo: "GRUPOS",

        tipo: "GRUPO",

        grupo_id: grupo.id,

        ronda_id: null,

        codigo,

        nombre:
          nombre ||
          `${grupo.nombre} · Jornada ${jornada} · Partit ${orden + 1}`,

        orden,

        jornada,

        estado: "BORRADOR",

        fecha_hora: fechaHora,

        /*
         * Fuente de verdad.
         */
        pista_id: pista?.id ?? null,

        /*
         * Compatibilidad con código antiguo.
         *
         * Nunca viene directamente del usuario.
         */
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

    try {
      const plazas = await crearPlazasGrupo(partido, localID, visitanteID);

      let partidoFinal = partido;

      if (publicar) {
        await validarProgramable(
          partido.id,
          fechaHora,
          pista?.id ?? null,
          torneoID,
        );

        const { data: actualizado, error: errorActualizar } =
          await supabaseAdmin
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

      const avisos = await detectarConflictos(partidoFinal);

      return responder(
        {
          success: true,

          partido: partidoFinal,

          plazas,

          /*
           * Los conflictos no bloquean.
           */
          avisos,
        },
        201,
      );
    } catch (error) {
      await eliminarPlazasPartido(partido.id);

      await supabaseAdmin
        .from("competicion_partidos")
        .delete()
        .eq("id", partido.id);

      throw error;
    }
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// PATCH
// ============================================================
//
// Permite programar:
// - partidos de grupo
// - partidos de bracket
// - tercer puesto
// - partidos de consolación
//
// NO permite cambiar la estructura del bracket.
// Eso se hace desde Format de competició.
// ============================================================

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
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
    // BLOQUEADOS POR RESULTADO / ACTA
    // ======================================================

    if (
      partido.estado === "FINALIZADO" ||
      partido.estado === "EN_CURSO" ||
      partido.finalizado_at
    ) {
      throw new ErrorAPI(
        409,
        "Aquest partit ja no es pot modificar des del calendari.",
      );
    }

    // ======================================================
    // CAMBIAR ESTADO
    // ======================================================

    if (entrada.accion === "cambiar_estado") {
      const estado = estadoEditable(entrada.estado);

      const cambios: Record<string, unknown> = {
        estado,
      };

      if (estado === "PROGRAMADO") {
        await validarProgramable(
          partido.id,
          partido.fecha_hora,
          partido.pista_id,
          torneoID,
        );

        cambios.publicado = true;
      }

      if (estado === "BORRADOR") {
        cambios.publicado = false;
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

      const avisos = await detectarConflictos(actualizado);

      return responder({
        success: true,

        partido: actualizado,

        avisos,
      });
    }

    if (entrada.accion !== "editar_partido") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    const cambios: Record<string, unknown> = {};

    // ======================================================
    // NOMBRE
    // ======================================================

    if (entrada.nombre !== undefined) {
      const nombre = texto(entrada.nombre, "nom", 120);

      cambios.nombre = nombre || null;
    }

    // ======================================================
    // FECHA / HORA
    // ======================================================

    const nuevaFecha = fechaISO(entrada.fechaHora);

    if (nuevaFecha !== undefined) {
      cambios.fecha_hora = nuevaFecha;
    }

    // ======================================================
    // PISTA
    // ======================================================
    //
    // No existe entrada.pista.
    //
    // Solo aceptamos pistaID.
    // ======================================================

    let nuevaPistaID: string | null | undefined = undefined;

    if (entrada.pistaID !== undefined) {
      nuevaPistaID = identificadorOpcional(entrada.pistaID, "pista");

      if (nuevaPistaID === null) {
        cambios.pista_id = null;

        cambios.pista = null;
      } else if (nuevaPistaID) {
        /*
         * Si el usuario cambia realmente de pista,
         * la nueva debe estar activa.
         *
         * Si simplemente conserva una pista antigua
         * actualmente desactivada, permitimos conservarla.
         */
        const esLaMisma = nuevaPistaID === partido.pista_id;

        const pista = await exigirPista(nuevaPistaID, torneoID, esLaMisma);

        cambios.pista_id = pista.id;

        /*
         * Solo espejo de compatibilidad.
         */
        cambios.pista = pista.nombre;
      }
    }

    // ======================================================
    // DURACIÓN
    // ======================================================

    const duracion = enteroOpcional(entrada.duracion, "duració");

    if (duracion !== undefined) {
      cambios.duracion_estimada_min = duracion;
    }

    // ======================================================
    // JORNADA
    // ======================================================
    //
    // TODOS los partidos tienen jornada.
    // ======================================================

    if (entrada.jornada !== undefined) {
      cambios.jornada = enteroPositivo(entrada.jornada, "jornada");
    }

    // ======================================================
    // CAMBIO EQUIPOS PARTIDO DE GRUPO
    // ======================================================

    if (entrada.localID !== undefined || entrada.visitanteID !== undefined) {
      if (partido.tipo !== "GRUPO") {
        throw new ErrorAPI(
          409,
          "Els participants dels partits eliminatoris es configuren des de Format de competició.",
        );
      }

      if (partido.publicado || partido.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Despublica el partit abans de modificar els equips.",
        );
      }

      if (!partido.grupo_id) {
        throw new ErrorAPI(409, "El partit no té grup.");
      }

      const localID = identificador(entrada.localID, "equip local");

      const visitanteID = identificador(entrada.visitanteID, "equip visitant");

      await validarPartidoGrupo(
        edicionID,
        partido.grupo_id,
        localID,
        visitanteID,
      );

      await eliminarPlazasPartido(partido.id);

      await crearPlazasGrupo(partido, localID, visitanteID);
    }

    // ======================================================
    // BLOQUEAR EDICIÓN DEL BRACKET DESDE CALENDARIO
    // ======================================================

    if (entrada.local !== undefined || entrada.visitante !== undefined) {
      throw new ErrorAPI(
        409,
        "Els encreuaments eliminatoris s'han de modificar des de Format de competició.",
      );
    }

    // ======================================================
    // PUBLICACIÓN
    // ======================================================

    if (entrada.publicado !== undefined) {
      const publicar = booleano(entrada.publicado, "publicat");

      cambios.publicado = publicar;

      if (publicar && partido.estado === "BORRADOR") {
        cambios.estado = "PROGRAMADO";
      }

      if (!publicar && partido.estado === "PROGRAMADO") {
        cambios.estado = "BORRADOR";
      }
    }

    // ======================================================
    // CALCULAR ESTADO FINAL ANTES DE GUARDAR
    // ======================================================

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

    /*
     * Un partido PROGRAMADO o PUBLICADO siempre
     * necesita:
     *
     * - fecha/hora
     * - pista configurada
     * - local y visitante
     */
    if (estadoFinal === "PROGRAMADO" || publicadoFinal) {
      await validarProgramable(partido.id, fechaFinal, pistaFinal, torneoID);
    }

    // ======================================================
    // SIN CAMBIOS
    // ======================================================

    if (Object.keys(cambios).length === 0) {
      const actual = await exigirPartido(partido.id, edicionID);

      return responder({
        success: true,

        partido: actual,

        plazas: await obtenerPlazasPartido(partido.id),

        avisos: await detectarConflictos(actual),
      });
    }

    // ======================================================
    // ACTUALIZAR
    // ======================================================

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

    const avisos = await detectarConflictos(actualizado);

    return responder({
      success: true,

      partido: actualizado,

      plazas: await obtenerPlazasPartido(partido.id),

      /*
       * Solo advertencias.
       * Nunca bloquean el guardado.
       */
      avisos,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// DELETE
// ============================================================
//
// Desde calendario solamente permitimos eliminar partidos
// manuales de grupo.
//
// Los eliminatorios pertenecen a la estructura del bracket
// y deben gestionarse desde Format de competició.
// ============================================================

export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "eliminar");

    if (entrada.accion !== "eliminar_partido") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    const partidoID = identificador(entrada.partidoID, "partit");

    const partido = await exigirPartido(partidoID, edicionID);

    if (partido.tipo === "ELIMINATORIA") {
      throw new ErrorAPI(
        409,
        "Els partits eliminatoris s'han de gestionar des de Format de competició.",
      );
    }

    if (partido.estado !== "BORRADOR" || partido.publicado) {
      throw new ErrorAPI(
        409,
        "Només es poden eliminar partits en esborrany i sense publicar.",
      );
    }

    const { count, error: errorDependencias } = await supabaseAdmin
      .from("competicion_plazas")
      .select("id", {
        count: "exact",

        head: true,
      })
      .eq("edicion_id", edicionID)
      .eq("origen_partido_id", partido.id);

    if (errorDependencias) {
      throw errorDependencias;
    }

    if ((count ?? 0) > 0) {
      throw new ErrorAPI(
        409,
        "No es pot eliminar perquè un altre partit depèn del seu guanyador o perdedor.",
      );
    }

    await eliminarPlazasPartido(partido.id);

    const { data, error } = await supabaseAdmin
      .from("competicion_partidos")
      .delete()
      .eq("id", partido.id)
      .select("id,codigo,nombre")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ErrorAPI(409, "El partit no s'ha pogut eliminar.");
    }

    return responder({
      success: true,

      partido: data,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};
