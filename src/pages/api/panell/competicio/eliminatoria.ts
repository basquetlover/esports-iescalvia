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

type TipoRonda =
  | "TREINTADOSAVOS"
  | "DIECISEISAVOS"
  | "OCTAVOS"
  | "CUARTOS"
  | "SEMIFINAL"
  | "FINAL"
  | "TERCER_PUESTO"
  | "CLASIFICACION"
  | "PERSONALIZADA";

type TipoRondaPrincipal =
  | "TREINTADOSAVOS"
  | "DIECISEISAVOS"
  | "OCTAVOS"
  | "CUARTOS"
  | "SEMIFINAL"
  | "FINAL";

type TipoOrigen =
  | "EQUIPO"
  | "POSICION_GRUPO"
  | "POSICION_FASE"
  | "GANADOR_PARTIDO"
  | "PERDEDOR_PARTIDO"
  | "LIBRE";

type LadoPartido = "LOCAL" | "VISITANTE";

type EstadoPartido =
  | "BORRADOR"
  | "PROGRAMADO"
  | "EN_CURSO"
  | "FINALIZADO"
  | "SUSPENDIDO"
  | "CANCELADO";

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Registro = Record<string, unknown>;

type DefinicionRonda = {
  tipo: TipoRondaPrincipal;
  nombre: string;
  partidos: number;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  fase_id: string;
  fase_tipo: string;
  tipo: string;
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

const TIPOS_RONDA: readonly TipoRonda[] = [
  "TREINTADOSAVOS",
  "DIECISEISAVOS",
  "OCTAVOS",
  "CUARTOS",
  "SEMIFINAL",
  "FINAL",
  "TERCER_PUESTO",
  "CLASIFICACION",
  "PERSONALIZADA",
];

const TIPOS_ORIGEN: readonly TipoOrigen[] = [
  "EQUIPO",
  "POSICION_GRUPO",
  "POSICION_FASE",
  "GANADOR_PARTIDO",
  "PERDEDOR_PARTIDO",
  "LIBRE",
];

const LADOS: readonly LadoPartido[] = ["LOCAL", "VISITANTE"];

const ESTADOS_PARTIDO: readonly EstadoPartido[] = [
  "BORRADOR",
  "PROGRAMADO",
  "EN_CURSO",
  "FINALIZADO",
  "SUSPENDIDO",
  "CANCELADO",
];

const RONDAS_GENERADOR: readonly DefinicionRonda[] = [
  {
    tipo: "TREINTADOSAVOS",
    nombre: "Trenta-dosens de final",
    partidos: 32,
  },
  {
    tipo: "DIECISEISAVOS",
    nombre: "Setzens de final",
    partidos: 16,
  },
  {
    tipo: "OCTAVOS",
    nombre: "Vuitens de final",
    partidos: 8,
  },
  {
    tipo: "CUARTOS",
    nombre: "Quarts de final",
    partidos: 4,
  },
  {
    tipo: "SEMIFINAL",
    nombre: "Semifinals",
    partidos: 2,
  },
  {
    tipo: "FINAL",
    nombre: "Final",
    partidos: 1,
  },
];

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista_id,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at";

const SELECT_PLAZA =
  "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at";

// ============================================================
// RESPUESTAS
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

  if (codigo === "23503") {
    return responder(
      {
        success: false,
        mensaje:
          "Aquest element està relacionat amb altres dades de la competició.",
      },
      409,
    );
  }

  if (codigo === "23505") {
    return responder(
      {
        success: false,
        mensaje: "Ja existeix un element amb aquestes dades.",
      },
      409,
    );
  }

  if (codigo === "23514") {
    return responder(
      {
        success: false,
        mensaje: "Les dades no compleixen les regles de la competició.",
      },
      400,
    );
  }

  console.error("Error gestionant l'eliminatòria:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

// ============================================================
// VALIDACIONES BÁSICAS
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

function identificadorONull(valor: unknown, nombre: string): string | null {
  if (valor === null || valor === undefined || valor === "") {
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

function enteroPositivoONull(valor: unknown, nombre: string): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  return enteroPositivo(valor, nombre);
}

function booleano(valor: unknown, defecto = false): boolean {
  return typeof valor === "boolean" ? valor : defecto;
}

function fechaHoraONull(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (typeof valor !== "string") {
    throw new ErrorAPI(400, "La data i hora no són vàlides.");
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw new ErrorAPI(400, "La data i hora no són vàlides.");
  }

  return fecha.toISOString();
}

// ============================================================
// VALIDACIONES ENUM
// ============================================================

function tipoRonda(valor: unknown): TipoRonda {
  const tipo = texto(valor, "tipus de ronda", 40, true).toUpperCase();

  if (!TIPOS_RONDA.includes(tipo as TipoRonda)) {
    throw new ErrorAPI(400, "El tipus de ronda no és vàlid.");
  }

  return tipo as TipoRonda;
}

function rondaInicial(valor: unknown): TipoRondaPrincipal {
  const tipo = tipoRonda(valor);

  const existe = RONDAS_GENERADOR.some((ronda) => ronda.tipo === tipo);

  if (!existe) {
    throw new ErrorAPI(400, "La ronda inicial no és vàlida.");
  }

  return tipo as TipoRondaPrincipal;
}

function tipoOrigen(valor: unknown): TipoOrigen {
  const tipo = texto(valor, "origen", 40, true).toUpperCase();

  if (!TIPOS_ORIGEN.includes(tipo as TipoOrigen)) {
    throw new ErrorAPI(400, "L'origen de la plaça no és vàlid.");
  }

  return tipo as TipoOrigen;
}

function ladoPartido(valor: unknown): LadoPartido {
  const lado = texto(valor, "costat", 20, true).toUpperCase();

  if (!LADOS.includes(lado as LadoPartido)) {
    throw new ErrorAPI(400, "El costat del partit no és vàlid.");
  }

  return lado as LadoPartido;
}

function estadoPartido(valor: unknown): EstadoPartido {
  const estado = texto(valor, "estat", 30, true).toUpperCase();

  if (!ESTADOS_PARTIDO.includes(estado as EstadoPartido)) {
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
  accion: "ver" | "editar",
) {
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "competicio", accion, torneoID)) {
    throw new ErrorAPI(
      403,
      accion === "editar"
        ? "No tens permís per modificar la competició."
        : "No tens permís per consultar la competició.",
    );
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

  if (
    !edicionRespuesta.data ||
    edicionRespuesta.data.torneo_id?.toLowerCase() !== torneoID
  ) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig seleccionat.");
  }

  return {
    torneo: torneoRespuesta.data,

    edicion: edicionRespuesta.data,
  };
}

// ============================================================
// FASE
// ============================================================

async function exigirFase(faseID: string, edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select(
      "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at,created_at,updated_at",
    )
    .eq("id", faseID)
    .eq("edicion_id", edicionID)
    .eq("tipo", "ELIMINATORIA")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat l'eliminatòria.");
  }

  return data;
}

// ============================================================
// RONDA
// ============================================================

async function exigirRonda(rondaID: string, edicionID: string) {
  const { data: ronda, error } = await supabaseAdmin
    .from("competicion_rondas")
    .select("id,fase_id,tipo,nombre,orden,created_at,updated_at")
    .eq("id", rondaID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!ronda) {
    throw new ErrorAPI(404, "No s'ha trobat la ronda.");
  }

  const fase = await exigirFase(ronda.fase_id, edicionID);

  return {
    ronda,
    fase,
  };
}

// ============================================================
// PARTIDO
// ============================================================

async function exigirPartido(
  partidoID: string,
  edicionID: string,
): Promise<PartidoDB> {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .eq("edicion_id", edicionID)
    .eq("tipo", "ELIMINATORIA")
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
// PISTA
// ============================================================

async function exigirPista(pistaID: string, torneoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_pistas")
    .select("id,torneo_id,nombre,descripcion,ubicacion,activa")
    .eq("id", pistaID)
    .eq("torneo_id", torneoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat la pista.");
  }

  return data;
}

// ============================================================
// EQUIPO ACTIVO
// ============================================================

async function exigirEquipoActivo(edicionID: string, equipoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_equipos")
    .select("equipo_id,estado")
    .eq("edicion_id", edicionID)
    .eq("equipo_id", equipoID)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(409, "Aquest equip no forma part de la competició.");
  }

  return data;
}

// ============================================================
// ÓRDENES
// ============================================================

async function siguienteOrdenFase(edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select("orden")
    .eq("edicion_id", edicionID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? -1) + 1;
}

async function siguienteOrdenRonda(faseID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_rondas")
    .select("orden")
    .eq("fase_id", faseID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? -1) + 1;
}

async function siguienteOrdenPartido(rondaID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select("orden")
    .eq("ronda_id", rondaID)
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
// VALIDAR ORÍGENES
// ============================================================

async function validarGrupoOrigenAnterior(
  grupoID: string,
  partidoDestino: PartidoDB,
  edicionID: string,
) {
  const { data: grupo, error: errorGrupo } = await supabaseAdmin
    .from("competicion_grupos")
    .select("id,fase_id,nombre,orden,estado")
    .eq("id", grupoID)
    .maybeSingle();

  if (errorGrupo) {
    throw errorGrupo;
  }

  if (!grupo) {
    throw new ErrorAPI(404, "No s'ha trobat el grup.");
  }

  const { data: faseOrigen, error: errorFase } = await supabaseAdmin
    .from("competicion_fases")
    .select("id,edicion_id,tipo,orden,nombre")
    .eq("id", grupo.fase_id)
    .eq("edicion_id", edicionID)
    .eq("tipo", "GRUPOS")
    .maybeSingle();

  if (errorFase) {
    throw errorFase;
  }

  if (!faseOrigen) {
    throw new ErrorAPI(409, "El grup d'origen no pertany a aquesta edició.");
  }

  const faseDestino = await exigirFase(partidoDestino.fase_id, edicionID);

  if (faseOrigen.orden >= faseDestino.orden) {
    throw new ErrorAPI(
      409,
      "El grup d'origen ha de pertànyer a una fase anterior.",
    );
  }

  return {
    grupo,
    faseOrigen,
  };
}

async function validarFaseOrigenAnterior(
  faseOrigenID: string,
  partidoDestino: PartidoDB,
  edicionID: string,
) {
  const { data: faseOrigen, error } = await supabaseAdmin
    .from("competicion_fases")
    .select("id,edicion_id,tipo,orden,nombre")
    .eq("id", faseOrigenID)
    .eq("edicion_id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!faseOrigen) {
    throw new ErrorAPI(404, "No s'ha trobat la fase d'origen.");
  }

  const faseDestino = await exigirFase(partidoDestino.fase_id, edicionID);

  if (faseOrigen.orden >= faseDestino.orden) {
    throw new ErrorAPI(409, "La fase d'origen ha de ser anterior.");
  }

  return faseOrigen;
}

async function validarPartidoOrigenAnterior(
  partidoOrigenID: string,
  partidoDestino: PartidoDB,
  edicionID: string,
) {
  if (partidoOrigenID === partidoDestino.id) {
    throw new ErrorAPI(409, "Un partit no pot dependre de si mateix.");
  }

  const partidoOrigen = await exigirPartido(partidoOrigenID, edicionID);

  const [faseOrigen, faseDestino] = await Promise.all([
    exigirFase(partidoOrigen.fase_id, edicionID),

    exigirFase(partidoDestino.fase_id, edicionID),
  ]);

  if (faseOrigen.orden < faseDestino.orden) {
    return partidoOrigen;
  }

  if (faseOrigen.id !== faseDestino.id) {
    throw new ErrorAPI(409, "El partit d'origen ha de ser anterior.");
  }

  if (!partidoOrigen.ronda_id || !partidoDestino.ronda_id) {
    throw new ErrorAPI(409, "Els partits han de pertànyer a una ronda.");
  }

  const [rondaOrigen, rondaDestino] = await Promise.all([
    exigirRonda(partidoOrigen.ronda_id, edicionID),

    exigirRonda(partidoDestino.ronda_id, edicionID),
  ]);

  if (rondaOrigen.ronda.orden >= rondaDestino.ronda.orden) {
    throw new ErrorAPI(
      409,
      "El partit d'origen ha de pertànyer a una ronda anterior.",
    );
  }

  return partidoOrigen;
}

// ============================================================
// CONFIGURAR PLAZA
// ============================================================

async function configurarPlaza({
  edicionID,
  partidoID,
  lado,
  origenTipo,
  entrada,
}: {
  edicionID: string;
  partidoID: string;
  lado: LadoPartido;
  origenTipo: TipoOrigen;
  entrada: Registro;
}) {
  const partido = await exigirPartido(partidoID, edicionID);

  if (partido.estado !== "BORRADOR") {
    throw new ErrorAPI(
      409,
      "Només es poden modificar els participants d'un partit en esborrany.",
    );
  }

  const payload: Record<string, unknown> = {
    edicion_id: edicionID,

    destino_fase_id: partido.fase_id,

    destino_tipo: "PARTIDO",

    grupo_id: null,

    partido_id: partido.id,

    lado,

    orden: lado === "LOCAL" ? 1 : 2,

    origen_tipo: origenTipo,

    equipo_origen_id: null,

    origen_grupo_id: null,

    origen_fase_id: null,

    origen_posicion: null,

    origen_partido_id: null,

    equipo_resuelto_id: null,

    resuelta_at: null,
  };

  // ========================================================
  // EQUIPO
  // ========================================================

  if (origenTipo === "EQUIPO") {
    const equipoID = identificador(entrada.equipoID, "equip");

    await exigirEquipoActivo(edicionID, equipoID);

    const otroLado = lado === "LOCAL" ? "VISITANTE" : "LOCAL";

    const { data: plazaOtroLado, error } = await supabaseAdmin
      .from("competicion_plazas")
      .select("equipo_resuelto_id")
      .eq("edicion_id", edicionID)
      .eq("destino_tipo", "PARTIDO")
      .eq("partido_id", partido.id)
      .eq("lado", otroLado)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (plazaOtroLado?.equipo_resuelto_id === equipoID) {
      throw new ErrorAPI(
        409,
        "Un equip no pot ocupar els dos costats del mateix partit.",
      );
    }

    payload.equipo_origen_id = equipoID;

    payload.equipo_resuelto_id = equipoID;

    payload.resuelta_at = new Date().toISOString();
  }

  // ========================================================
  // POSICIÓN GRUPO
  // ========================================================

  if (origenTipo === "POSICION_GRUPO") {
    const grupoID = identificador(entrada.grupoID, "grup");

    const posicion = enteroPositivo(entrada.posicion, "posició");

    const { grupo, faseOrigen } = await validarGrupoOrigenAnterior(
      grupoID,
      partido,
      edicionID,
    );

    payload.origen_grupo_id = grupo.id;

    payload.origen_fase_id = faseOrigen.id;

    payload.origen_posicion = posicion;
  }

  // ========================================================
  // POSICIÓN FASE
  // ========================================================

  if (origenTipo === "POSICION_FASE") {
    const faseOrigenID = identificador(entrada.faseOrigenID, "fase");

    const posicion = enteroPositivo(entrada.posicion, "posició");

    const faseOrigen = await validarFaseOrigenAnterior(
      faseOrigenID,
      partido,
      edicionID,
    );

    payload.origen_fase_id = faseOrigen.id;

    payload.origen_posicion = posicion;
  }

  // ========================================================
  // GANADOR / PERDEDOR
  // ========================================================

  if (origenTipo === "GANADOR_PARTIDO" || origenTipo === "PERDEDOR_PARTIDO") {
    const partidoOrigenID = identificador(
      entrada.partidoOrigenID,
      "partit d'origen",
    );

    const partidoOrigen = await validarPartidoOrigenAnterior(
      partidoOrigenID,
      partido,
      edicionID,
    );

    payload.origen_partido_id = partidoOrigen.id;
  }

  // ========================================================
  // UPSERT
  // ========================================================

  const { data: existente, error: errorExistente } = await supabaseAdmin
    .from("competicion_plazas")
    .select("id")
    .eq("edicion_id", edicionID)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partido.id)
    .eq("lado", lado)
    .maybeSingle();

  if (errorExistente) {
    throw errorExistente;
  }

  if (existente) {
    const { data, error } = await supabaseAdmin
      .from("competicion_plazas")
      .update(payload)
      .eq("id", existente.id)
      .select(SELECT_PLAZA)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .insert(payload)
    .select(SELECT_PLAZA)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// EQUIPOS
// ============================================================

async function obtenerEquiposActivos(edicionID: string) {
  const { data: registros, error: errorRegistros } = await supabaseAdmin
    .from("competicion_equipos")
    .select("equipo_id,estado")
    .eq("edicion_id", edicionID)
    .eq("estado", "ACTIVO");

  if (errorRegistros) {
    throw errorRegistros;
  }

  const ids = (registros ?? []).map((registro) => registro.equipo_id);

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from("equipos")
    .select("id,nombre,escudo")
    .in("id", ids)
    .order("nombre", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []).map((equipo) => ({
    id: equipo.id,

    nombre: equipo.nombre ?? "Equip",

    escudo: equipo.escudo ?? null,
  }));
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
  /*
   * Si no tenemos duración usamos 1 minuto.
   *
   * Así una coincidencia exacta sigue detectándose
   * y un partido sin duración dentro del intervalo de otro
   * también genera aviso.
   */
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

  const { data: candidatos, error: errorCandidatos } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("edicion_id", partido.edicion_id)
    .neq("id", partido.id)
    .not("fecha_hora", "is", null)
    .not("estado", "in", '("CANCELADO","SUSPENDIDO")');

  if (errorCandidatos) {
    throw errorCandidatos;
  }

  const solapados = (candidatos ?? [])
    .map((elemento) => elemento as PartidoDB)
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
  // PISTA
  // ========================================================

  if (partido.pista_id) {
    for (const otro of solapados) {
      if (otro.pista_id === partido.pista_id) {
        avisos.push({
          tipo: "PISTA",

          mensaje: `La pista ja té el partit "${otro.nombre ?? otro.codigo}" programat en un horari que se solapa.`,

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
  // EQUIPOS
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

  const equipoPorPartido = new Map<string, Set<string>>();

  for (const plaza of plazasOtros ?? []) {
    if (!plaza.partido_id || !plaza.equipo_resuelto_id) {
      continue;
    }

    if (!equipoPorPartido.has(plaza.partido_id)) {
      equipoPorPartido.set(plaza.partido_id, new Set());
    }

    equipoPorPartido.get(plaza.partido_id)?.add(plaza.equipo_resuelto_id);
  }

  const idsEquiposConflicto = new Set<string>();

  for (const otro of solapados) {
    const equiposOtro = equipoPorPartido.get(otro.id);

    if (!equiposOtro) {
      continue;
    }

    for (const equipoID of equiposActual) {
      if (equiposOtro.has(equipoID)) {
        idsEquiposConflicto.add(equipoID);

        avisos.push({
          tipo: "EQUIPO",

          equipo_id: equipoID,

          mensaje: `Un mateix equip té el partit "${otro.nombre ?? otro.codigo}" en un horari que se solapa.`,

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

  // Mejoramos los mensajes con nombre del equipo

  if (idsEquiposConflicto.size > 0) {
    const { data: equipos } = await supabaseAdmin
      .from("equipos")
      .select("id,nombre")
      .in("id", Array.from(idsEquiposConflicto));

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
// LIMPIEZA GENERADOR
// ============================================================

async function limpiarFaseGenerada(faseID: string) {
  await supabaseAdmin
    .from("competicion_plazas")
    .delete()
    .eq("destino_fase_id", faseID);

  await supabaseAdmin
    .from("competicion_partidos")
    .delete()
    .eq("fase_id", faseID);

  await supabaseAdmin.from("competicion_rondas").delete().eq("fase_id", faseID);

  await supabaseAdmin.from("competicion_fases").delete().eq("id", faseID);
}

// ============================================================
// GENERAR ELIMINATORIA
// ============================================================

async function generarEliminatoria({
  edicionID,
  nombreEntrada,
  rondaInicialTipo,
  crearTercerPuesto,
}: {
  edicionID: string;
  nombreEntrada: string;
  rondaInicialTipo: TipoRondaPrincipal;
  crearTercerPuesto: boolean;
}) {
  const indiceInicial = RONDAS_GENERADOR.findIndex(
    (ronda) => ronda.tipo === rondaInicialTipo,
  );

  if (indiceInicial < 0) {
    throw new ErrorAPI(400, "La ronda inicial no és vàlida.");
  }

  const definiciones = RONDAS_GENERADOR.slice(indiceInicial);

  const inicial = definiciones[0];

  const ordenFase = await siguienteOrdenFase(edicionID);

  const nombreFase = nombreEntrada || inicial.nombre;

  // ========================================================
  // FASE
  // ========================================================

  const { data: fase, error: errorFase } = await supabaseAdmin
    .from("competicion_fases")
    .insert({
      edicion_id: edicionID,

      nombre: nombreFase,

      tipo: "ELIMINATORIA",

      orden: ordenFase,

      estado: "BORRADOR",

      publicada: false,

      configuracion: {
        generada: true,

        ronda_inicial: rondaInicialTipo,

        tercer_puesto: crearTercerPuesto,
      },
    })
    .select(
      "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at",
    )
    .single();

  if (errorFase) {
    throw errorFase;
  }

  try {
    // ======================================================
    // RONDAS PRINCIPALES
    // ======================================================

    const { data: rondasPrincipales, error: errorRondas } = await supabaseAdmin
      .from("competicion_rondas")
      .insert(
        definiciones.map((definicion, indice) => ({
          fase_id: fase.id,

          tipo: definicion.tipo,

          nombre: definicion.nombre,

          orden: indice,
        })),
      )
      .select("id,fase_id,tipo,nombre,orden,created_at,updated_at");

    if (errorRondas) {
      throw errorRondas;
    }

    if (
      !rondasPrincipales ||
      rondasPrincipales.length !== definiciones.length
    ) {
      throw new Error("No s'han pogut crear totes les rondes.");
    }

    // ======================================================
    // PARTIDOS PRINCIPALES
    // ======================================================

    const partidosInsertar: Record<string, unknown>[] = [];

    for (const definicion of definiciones) {
      const ronda = rondasPrincipales.find(
        (elemento) => elemento.tipo === definicion.tipo,
      );

      if (!ronda) {
        throw new Error(`No s'ha trobat la ronda ${definicion.tipo}.`);
      }

      for (let i = 0; i < definicion.partidos; i++) {
        const numero = i + 1;

        partidosInsertar.push({
          edicion_id: edicionID,

          fase_id: fase.id,

          fase_tipo: "ELIMINATORIA",

          tipo: "ELIMINATORIA",

          grupo_id: null,

          ronda_id: ronda.id,

          codigo:
            `E${ordenFase + 1}` +
            `-R${ronda.orden + 1}` +
            `-P${numero}` +
            `-${ronda.id.slice(0, 4).toUpperCase()}`,

          nombre:
            definicion.tipo === "FINAL"
              ? "Final"
              : `${definicion.nombre} ${numero}`,

          orden: i,

          jornada: 1,

          estado: "BORRADOR",

          fecha_hora: null,

          pista_id: null,

          pista: null,

          duracion_estimada_min: null,

          publicado: false,
        });
      }
    }

    const { data: partidosPrincipales, error: errorPartidos } =
      await supabaseAdmin
        .from("competicion_partidos")
        .insert(partidosInsertar)
        .select(SELECT_PARTIDO);

    if (errorPartidos) {
      throw errorPartidos;
    }

    if (!partidosPrincipales) {
      throw new Error("No s'han pogut crear els partits.");
    }

    const partidos = partidosPrincipales as PartidoDB[];

    // ======================================================
    // CONEXIONES POR DEFECTO
    // ======================================================
    //
    // IMPORTANTE:
    //
    // Estas conexiones NO están bloqueadas.
    //
    // El administrador podrá sustituirlas posteriormente
    // mediante configurar_plaza.
    // ======================================================

    const plazas: Record<string, unknown>[] = [];

    for (
      let indiceRonda = 1;
      indiceRonda < definiciones.length;
      indiceRonda++
    ) {
      const anterior = definiciones[indiceRonda - 1];

      const actual = definiciones[indiceRonda];

      const rondaAnterior = rondasPrincipales.find(
        (ronda) => ronda.tipo === anterior.tipo,
      );

      const rondaActual = rondasPrincipales.find(
        (ronda) => ronda.tipo === actual.tipo,
      );

      if (!rondaAnterior || !rondaActual) {
        throw new Error("No s'han pogut relacionar les rondes.");
      }

      const partidosAnterior = partidos
        .filter((partido) => partido.ronda_id === rondaAnterior.id)
        .sort((a, b) => a.orden - b.orden);

      const partidosActual = partidos
        .filter((partido) => partido.ronda_id === rondaActual.id)
        .sort((a, b) => a.orden - b.orden);

      for (let i = 0; i < partidosActual.length; i++) {
        const destino = partidosActual[i];

        const local = partidosAnterior[i * 2];

        const visitante = partidosAnterior[i * 2 + 1];

        if (!local || !visitante) {
          throw new Error("L'estructura del bracket no és correcta.");
        }

        plazas.push(
          {
            edicion_id: edicionID,

            destino_fase_id: fase.id,

            destino_tipo: "PARTIDO",

            grupo_id: null,

            partido_id: destino.id,

            lado: "LOCAL",

            orden: 1,

            origen_tipo: "GANADOR_PARTIDO",

            equipo_origen_id: null,

            origen_grupo_id: null,

            origen_fase_id: null,

            origen_posicion: null,

            origen_partido_id: local.id,

            equipo_resuelto_id: null,

            resuelta_at: null,
          },

          {
            edicion_id: edicionID,

            destino_fase_id: fase.id,

            destino_tipo: "PARTIDO",

            grupo_id: null,

            partido_id: destino.id,

            lado: "VISITANTE",

            orden: 2,

            origen_tipo: "GANADOR_PARTIDO",

            equipo_origen_id: null,

            origen_grupo_id: null,

            origen_fase_id: null,

            origen_posicion: null,

            origen_partido_id: visitante.id,

            equipo_resuelto_id: null,

            resuelta_at: null,
          },
        );
      }
    }

    // ======================================================
    // TERCER PUESTO
    // ======================================================

    let rondaTercerPuesto: Record<string, any> | null = null;

    let partidoTercerPuesto: PartidoDB | null = null;

    const rondaSemifinal = rondasPrincipales.find(
      (ronda) => ronda.tipo === "SEMIFINAL",
    );

    if (crearTercerPuesto && rondaSemifinal) {
      const orden = await siguienteOrdenRonda(fase.id);

      const { data: ronda3, error: errorRonda3 } = await supabaseAdmin
        .from("competicion_rondas")
        .insert({
          fase_id: fase.id,

          tipo: "TERCER_PUESTO",

          nombre: "3r / 4t lloc",

          orden,
        })
        .select("id,fase_id,tipo,nombre,orden,created_at,updated_at")
        .single();

      if (errorRonda3) {
        throw errorRonda3;
      }

      rondaTercerPuesto = ronda3;

      const { data: partido3, error: errorPartido3 } = await supabaseAdmin
        .from("competicion_partidos")
        .insert({
          edicion_id: edicionID,

          fase_id: fase.id,

          fase_tipo: "ELIMINATORIA",

          tipo: "ELIMINATORIA",

          grupo_id: null,

          ronda_id: ronda3.id,

          codigo: `E${ordenFase + 1}-3P-1-${ronda3.id
            .slice(0, 4)
            .toUpperCase()}`,

          nombre: "3r / 4t lloc",

          orden: 0,

          jornada: 1,

          estado: "BORRADOR",

          fecha_hora: null,

          pista_id: null,

          pista: null,

          duracion_estimada_min: null,

          publicado: false,
        })
        .select(SELECT_PARTIDO)
        .single();

      if (errorPartido3) {
        throw errorPartido3;
      }

      partidoTercerPuesto = partido3 as PartidoDB;

      const semifinales = partidos
        .filter((partido) => partido.ronda_id === rondaSemifinal.id)
        .sort((a, b) => a.orden - b.orden);

      if (semifinales.length !== 2) {
        throw new Error("No s'han trobat les dues semifinals.");
      }

      /*
       * Valores por defecto.
       *
       * También serán editables posteriormente.
       */
      plazas.push(
        {
          edicion_id: edicionID,

          destino_fase_id: fase.id,

          destino_tipo: "PARTIDO",

          grupo_id: null,

          partido_id: partido3.id,

          lado: "LOCAL",

          orden: 1,

          origen_tipo: "PERDEDOR_PARTIDO",

          equipo_origen_id: null,

          origen_grupo_id: null,

          origen_fase_id: null,

          origen_posicion: null,

          origen_partido_id: semifinales[0].id,

          equipo_resuelto_id: null,

          resuelta_at: null,
        },

        {
          edicion_id: edicionID,

          destino_fase_id: fase.id,

          destino_tipo: "PARTIDO",

          grupo_id: null,

          partido_id: partido3.id,

          lado: "VISITANTE",

          orden: 2,

          origen_tipo: "PERDEDOR_PARTIDO",

          equipo_origen_id: null,

          origen_grupo_id: null,

          origen_fase_id: null,

          origen_posicion: null,

          origen_partido_id: semifinales[1].id,

          equipo_resuelto_id: null,

          resuelta_at: null,
        },
      );
    }

    // ======================================================
    // INSERT PLAZAS
    // ======================================================

    if (plazas.length > 0) {
      const { error } = await supabaseAdmin
        .from("competicion_plazas")
        .insert(plazas);

      if (error) {
        throw error;
      }
    }

    return {
      fase,

      rondas: [
        ...rondasPrincipales,
        ...(rondaTercerPuesto ? [rondaTercerPuesto] : []),
      ],

      partidos: [
        ...partidos,
        ...(partidoTercerPuesto ? [partidoTercerPuesto] : []),
      ],
    };
  } catch (error) {
    await limpiarFaseGenerada(fase.id);

    throw error;
  }
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    const contexto = await exigirContexto(usuario, torneoID, edicionID, "ver");

    // ==================================================
    // FASES ELIMINATORIAS
    // ==================================================

    const { data: fases, error: errorFases } = await supabaseAdmin
      .from("competicion_fases")
      .select(
        "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at,created_at,updated_at",
      )
      .eq("edicion_id", edicionID)
      .eq("tipo", "ELIMINATORIA")
      .order("orden", {
        ascending: true,
      });

    if (errorFases) {
      throw errorFases;
    }

    const idsFases = (fases ?? []).map((fase) => fase.id);

    // ==================================================
    // RONDAS
    // ==================================================

    let rondas: Record<string, any>[] = [];

    if (idsFases.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("competicion_rondas")
        .select("id,fase_id,tipo,nombre,orden,created_at,updated_at")
        .in("fase_id", idsFases)
        .order("orden", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      rondas = data ?? [];
    }

    // ==================================================
    // PARTIDOS
    // ==================================================

    const { data: partidos, error: errorPartidos } = await supabaseAdmin
      .from("competicion_partidos")
      .select(SELECT_PARTIDO)
      .eq("edicion_id", edicionID)
      .eq("tipo", "ELIMINATORIA")
      .order("orden", {
        ascending: true,
      });

    if (errorPartidos) {
      throw errorPartidos;
    }

    // ==================================================
    // PLAZAS
    // ==================================================

    const { data: plazas, error: errorPlazas } = await supabaseAdmin
      .from("competicion_plazas")
      .select(SELECT_PLAZA)
      .eq("edicion_id", edicionID)
      .eq("destino_tipo", "PARTIDO")
      .order("orden", {
        ascending: true,
      });

    if (errorPlazas) {
      throw errorPlazas;
    }

    // ==================================================
    // EQUIPOS
    // ==================================================

    const equipos = await obtenerEquiposActivos(edicionID);

    // ==================================================
    // PISTAS
    // ==================================================

    const { data: pistas, error: errorPistas } = await supabaseAdmin
      .from("competicion_pistas")
      .select("id,torneo_id,nombre,descripcion,ubicacion,activa")
      .eq("torneo_id", torneoID)
      .order("activa", {
        ascending: false,
      })
      .order("nombre", {
        ascending: true,
      });

    if (errorPistas) {
      throw errorPistas;
    }

    // ==================================================
    // GRUPOS COMO ORIGEN
    // ==================================================

    const { data: fasesGrupos, error: errorFasesGrupos } = await supabaseAdmin
      .from("competicion_fases")
      .select("id,nombre,orden")
      .eq("edicion_id", edicionID)
      .eq("tipo", "GRUPOS")
      .order("orden", {
        ascending: true,
      });

    if (errorFasesGrupos) {
      throw errorFasesGrupos;
    }

    const idsFasesGrupos = (fasesGrupos ?? []).map((fase) => fase.id);

    let grupos: Record<string, any>[] = [];

    if (idsFasesGrupos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("competicion_grupos")
        .select("id,fase_id,nombre,orden,estado")
        .in("fase_id", idsFasesGrupos)
        .order("orden", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      grupos = data ?? [];
    }

    const gruposOrigen = grupos.map((grupo) => {
      const fase = (fasesGrupos ?? []).find(
        (elemento) => elemento.id === grupo.fase_id,
      );

      return {
        ...grupo,

        faseNombre: fase?.nombre ?? "",

        faseOrden: fase?.orden ?? 0,
      };
    });

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      capacidades: {
        editar: tienePermiso(usuario, "competicio", "editar", torneoID),
      },

      fases: fases ?? [],

      rondas,

      partidos: partidos ?? [],

      plazas: plazas ?? [],

      equipos,

      pistas: pistas ?? [],

      gruposOrigen,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const accion = texto(entrada.accion, "acció", 60, true);

    // =================================================
    // GENERAR ELIMINATORIA
    // =================================================

    if (accion === "generar_eliminatoria") {
      const inicial = rondaInicial(entrada.rondaInicial);

      const nombre = texto(entrada.nombre, "nom", 120);

      const tercerPuesto = booleano(entrada.tercerPuesto);

      const resultado = await generarEliminatoria({
        edicionID,

        nombreEntrada: nombre,

        rondaInicialTipo: inicial,

        crearTercerPuesto: tercerPuesto,
      });

      return responder(
        {
          success: true,

          ...resultado,
        },
        201,
      );
    }

    // =================================================
    // PARTIDO DE CONSOLACIÓN
    // =================================================

    if (accion === "crear_partido_consolacion") {
      const faseID = identificador(entrada.faseID, "fase");

      const fase = await exigirFase(faseID, edicionID);

      if (fase.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Només es poden afegir partits mentre l'eliminatòria està en esborrany.",
        );
      }

      // ===============================================
      // BUSCAR / CREAR RONDA DE CONSOLACIÓN
      // ===============================================

      const { data: rondaExistente, error: errorRonda } = await supabaseAdmin
        .from("competicion_rondas")
        .select("id,fase_id,tipo,nombre,orden")
        .eq("fase_id", fase.id)
        .eq("tipo", "CLASIFICACION")
        .order("orden", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

      if (errorRonda) {
        throw errorRonda;
      }

      let ronda = rondaExistente;

      if (!ronda) {
        const orden = await siguienteOrdenRonda(fase.id);

        const { data, error } = await supabaseAdmin
          .from("competicion_rondas")
          .insert({
            fase_id: fase.id,

            tipo: "CLASIFICACION",

            nombre: "Partits de consolació",

            orden,
          })
          .select("id,fase_id,tipo,nombre,orden")
          .single();

        if (error) {
          throw error;
        }

        ronda = data;
      }

      const ordenPartido = await siguienteOrdenPartido(ronda.id);

      const nombreEntrada = texto(entrada.nombre, "nom", 120);

      const jornada =
        entrada.jornada === undefined
          ? 1
          : enteroPositivo(entrada.jornada, "jornada");

      const { data: partido, error } = await supabaseAdmin
        .from("competicion_partidos")
        .insert({
          edicion_id: edicionID,

          fase_id: fase.id,

          fase_tipo: "ELIMINATORIA",

          tipo: "ELIMINATORIA",

          grupo_id: null,

          ronda_id: ronda.id,

          codigo:
            `E${fase.orden + 1}` +
            `-C-P${ordenPartido + 1}` +
            `-${ronda.id.slice(0, 4).toUpperCase()}`,

          nombre: nombreEntrada || `Partit de consolació ${ordenPartido + 1}`,

          orden: ordenPartido,

          jornada,

          estado: "BORRADOR",

          fecha_hora: null,

          pista_id: null,

          pista: null,

          duracion_estimada_min: null,

          publicado: false,
        })
        .select(SELECT_PARTIDO)
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,

          ronda,

          partido,
        },
        201,
      );
    }

    // =================================================
    // CONFIGURAR PLAZA
    // =================================================

    if (accion === "configurar_plaza") {
      const partidoID = identificador(entrada.partidoID, "partit");

      const lado = ladoPartido(entrada.lado);

      const origen = tipoOrigen(entrada.origenTipo);

      /*
       * IMPORTANTE:
       *
       * También permite cambiar las plazas generadas
       * automáticamente en cuartos, semifinal, final,
       * tercer puesto, etc.
       */
      const plaza = await configurarPlaza({
        edicionID,

        partidoID,

        lado,

        origenTipo: origen,

        entrada,
      });

      const partido = await exigirPartido(partidoID, edicionID);

      const avisos = await detectarConflictos(partido);

      return responder({
        success: true,

        plaza,

        avisos,
      });
    }

    throw new ErrorAPI(400, "L'acció indicada no existeix.");
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// PATCH
// ============================================================

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const accion = texto(entrada.accion, "acció", 60, true);

    // =================================================
    // EDITAR FASE
    // =================================================

    if (accion === "editar_fase") {
      const faseID = identificador(entrada.faseID, "fase");

      await exigirFase(faseID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const { data, error } = await supabaseAdmin
        .from("competicion_fases")
        .update({
          nombre,
        })
        .eq("id", faseID)
        .eq("edicion_id", edicionID)
        .select(
          "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,
        fase: data,
      });
    }

    // =================================================
    // EDITAR RONDA
    // =================================================

    if (accion === "editar_ronda") {
      const rondaID = identificador(entrada.rondaID, "ronda");

      const { ronda } = await exigirRonda(rondaID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const { data, error } = await supabaseAdmin
        .from("competicion_rondas")
        .update({
          nombre,
        })
        .eq("id", ronda.id)
        .select("id,fase_id,tipo,nombre,orden")
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,
        ronda: data,
      });
    }

    // =================================================
    // EDITAR PARTIDO COMPLETO
    // =================================================

    if (accion === "editar_partido") {
      const partidoID = identificador(entrada.partidoID, "partit");

      const partidoActual = await exigirPartido(partidoID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const jornada = enteroPositivo(entrada.jornada, "jornada");

      const fechaHora = fechaHoraONull(entrada.fechaHora);

      const duracion = enteroPositivoONull(
        entrada.duracionEstimadaMin,
        "duració estimada",
      );

      const pistaID = identificadorONull(entrada.pistaID, "pista");

      const estado = estadoPartido(entrada.estado);

      const publicado =
        entrada.publicado === undefined
          ? partidoActual.publicado
          : booleano(entrada.publicado);

      let nombrePista: string | null = null;

      if (pistaID) {
        const pista = await exigirPista(pistaID, torneoID);

        nombrePista = pista.nombre;
      }

      let finalizadoAt = partidoActual.finalizado_at;

      if (estado === "FINALIZADO" && partidoActual.estado !== "FINALIZADO") {
        finalizadoAt = new Date().toISOString();
      }

      if (estado !== "FINALIZADO") {
        finalizadoAt = null;
      }

      const { data, error } = await supabaseAdmin
        .from("competicion_partidos")
        .update({
          nombre,

          jornada,

          fecha_hora: fechaHora,

          duracion_estimada_min: duracion,

          pista_id: pistaID,

          /*
           * Conservamos también pista TEXT por
           * compatibilidad con vistas antiguas.
           */
          pista: nombrePista,

          estado,

          publicado,

          finalizado_at: finalizadoAt,
        })
        .eq("id", partidoID)
        .eq("edicion_id", edicionID)
        .select(SELECT_PARTIDO)
        .single();

      if (error) {
        throw error;
      }

      const avisos = await detectarConflictos(data as PartidoDB);

      /*
       * Los conflictos NO bloquean.
       *
       * El partido ya está guardado y devolvemos
       * los avisos para mostrarlos en el modal.
       */
      return responder({
        success: true,

        partido: data,

        avisos,
      });
    }

    throw new ErrorAPI(400, "L'acció indicada no existeix.");
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// DELETE
// ============================================================

export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const accion = texto(entrada.accion, "acció", 60, true);

    // =================================================
    // ELIMINAR CONFIGURACIÓN DE PLAZA
    // =================================================

    if (accion === "eliminar_plaza") {
      const plazaID = identificador(entrada.plazaID, "plaça");

      const { data: plaza, error: errorPlaza } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id,partido_id")
        .eq("id", plazaID)
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "PARTIDO")
        .maybeSingle();

      if (errorPlaza) {
        throw errorPlaza;
      }

      if (!plaza || !plaza.partido_id) {
        throw new ErrorAPI(404, "No s'ha trobat la plaça.");
      }

      const partido = await exigirPartido(plaza.partido_id, edicionID);

      if (partido.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Només es poden modificar els participants d'un partit en esborrany.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("id", plaza.id);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // ELIMINAR PARTIDO DE CONSOLACIÓN
    // =================================================

    if (accion === "eliminar_partido_consolacion") {
      const partidoID = identificador(entrada.partidoID, "partit");

      const partido = await exigirPartido(partidoID, edicionID);

      if (!partido.ronda_id) {
        throw new ErrorAPI(409, "El partit no pertany a una ronda.");
      }

      const { ronda } = await exigirRonda(partido.ronda_id, edicionID);

      if (ronda.tipo !== "CLASIFICACION" && ronda.tipo !== "PERSONALIZADA") {
        throw new ErrorAPI(
          409,
          "Només es poden eliminar des d'aquesta acció els partits de consolació.",
        );
      }

      if (partido.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Només es poden eliminar partits en esborrany.",
        );
      }

      const { count: usos, error: errorUsos } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("edicion_id", edicionID)
        .eq("origen_partido_id", partido.id);

      if (errorUsos) {
        throw errorUsos;
      }

      if ((usos ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "Aquest partit és l'origen d'un altre encreuament.",
        );
      }

      const { error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("partido_id", partido.id);

      if (errorPlazas) {
        throw errorPlazas;
      }

      const { error: errorPartido } = await supabaseAdmin
        .from("competicion_partidos")
        .delete()
        .eq("id", partido.id);

      if (errorPartido) {
        throw errorPartido;
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // ELIMINAR ELIMINATORIA COMPLETA
    // =================================================

    if (accion === "eliminar_eliminatoria") {
      const faseID = identificador(entrada.faseID, "fase");

      const fase = await exigirFase(faseID, edicionID);

      if (fase.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Només es pot eliminar una eliminatòria en esborrany.",
        );
      }

      const { data: partidos, error: errorPartidos } = await supabaseAdmin
        .from("competicion_partidos")
        .select("id,estado")
        .eq("fase_id", fase.id);

      if (errorPartidos) {
        throw errorPartidos;
      }

      if ((partidos ?? []).some((partido) => partido.estado !== "BORRADOR")) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar l'eliminatòria perquè conté partits que ja no estan en esborrany.",
        );
      }

      const idsPartidos = (partidos ?? []).map((partido) => partido.id);

      // ===============================================
      // COMPROBAR REFERENCIAS DESDE OTRAS FASES
      // ===============================================

      if (idsPartidos.length > 0) {
        const { data: referencias, error: errorReferencias } =
          await supabaseAdmin
            .from("competicion_plazas")
            .select("id,destino_fase_id,origen_partido_id")
            .in("origen_partido_id", idsPartidos);

        if (errorReferencias) {
          throw errorReferencias;
        }

        const externa = (referencias ?? []).some(
          (referencia) => referencia.destino_fase_id !== fase.id,
        );

        if (externa) {
          throw new ErrorAPI(
            409,
            "No es pot eliminar l'eliminatòria perquè alimenta una altra fase.",
          );
        }
      }

      const { data: referenciasFase, error: errorReferenciasFase } =
        await supabaseAdmin
          .from("competicion_plazas")
          .select("id,destino_fase_id")
          .eq("origen_fase_id", fase.id);

      if (errorReferenciasFase) {
        throw errorReferenciasFase;
      }

      if (
        (referenciasFase ?? []).some(
          (referencia) => referencia.destino_fase_id !== fase.id,
        )
      ) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar l'eliminatòria perquè una altra fase depèn d'ella.",
        );
      }

      // ===============================================
      // ELIMINAR
      // ===============================================

      const { error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("destino_fase_id", fase.id);

      if (errorPlazas) {
        throw errorPlazas;
      }

      const { error: errorEliminarPartidos } = await supabaseAdmin
        .from("competicion_partidos")
        .delete()
        .eq("fase_id", fase.id);

      if (errorEliminarPartidos) {
        throw errorEliminarPartidos;
      }

      const { error: errorRondas } = await supabaseAdmin
        .from("competicion_rondas")
        .delete()
        .eq("fase_id", fase.id);

      if (errorRondas) {
        throw errorRondas;
      }

      const { error: errorFase } = await supabaseAdmin
        .from("competicion_fases")
        .delete()
        .eq("id", fase.id);

      if (errorFase) {
        throw errorFase;
      }

      return responder({
        success: true,
      });
    }

    throw new ErrorAPI(400, "L'acció indicada no existeix.");
  } catch (error) {
    return errorRespuesta(error);
  }
};
