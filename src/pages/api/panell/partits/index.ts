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

type Registro = Record<string, unknown>;

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

type OrigenEntrada = {
  tipo: TipoOrigen;

  equipoID?: string;

  grupoID?: string;

  faseID?: string;

  posicion?: number;

  partidoID?: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const TIPOS_FASE: readonly TipoFase[] = ["GRUPOS", "ELIMINATORIA"];

const TIPOS_ORIGEN: readonly TipoOrigen[] = [
  "EQUIPO",
  "POSICION_GRUPO",
  "POSICION_FASE",
  "GANADOR_PARTIDO",
  "PERDEDOR_PARTIDO",
  "LIBRE",
];

const ESTADOS_EDITABLES: readonly EstadoEditable[] = [
  "BORRADOR",
  "PROGRAMADO",
  "SUSPENDIDO",
  "CANCELADO",
];

const SELECT_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at";

const SELECT_PLAZA =
  "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at";

// ============================================================
// ERRORES
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
          "La configuració del partit no compleix les regles de la competició. Revisa la fase, el grup o ronda i els equips seleccionats.",
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

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

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

async function exigirRonda(rondaID: string, edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_rondas")
    .select("id,fase_id,tipo,nombre,orden")
    .eq("id", rondaID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat la ronda.");
  }

  const fase = await exigirFase(data.fase_id, edicionID, "ELIMINATORIA");

  return {
    ronda: data as RondaDB,

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
// EQUIPOS
// ============================================================

async function obtenerEquiposActivos(edicionID: string) {
  const {
    data: registros,

    error,
  } = await supabaseAdmin
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

  const {
    data: equipos,

    error: errorEquipos,
  } = await supabaseAdmin
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

async function siguienteOrden(
  columna: "grupo_id" | "ronda_id",

  id: string,
) {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select("orden")
    .eq(columna, id)
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
// ORIGEN ELIMINATORIA
// ============================================================

function leerOrigen(valor: unknown, nombre: string): OrigenEntrada {
  if (!esRegistro(valor)) {
    throw new ErrorAPI(400, `Configura l'origen ${nombre}.`);
  }

  const tipo = texto(valor.tipo, "origen", 40, true).toUpperCase();

  if (!TIPOS_ORIGEN.includes(tipo as TipoOrigen)) {
    throw new ErrorAPI(400, "L'origen seleccionat no és vàlid.");
  }

  return {
    tipo: tipo as TipoOrigen,

    equipoID: typeof valor.equipoID === "string" ? valor.equipoID : undefined,

    grupoID: typeof valor.grupoID === "string" ? valor.grupoID : undefined,

    faseID: typeof valor.faseID === "string" ? valor.faseID : undefined,

    posicion:
      typeof valor.posicion === "number" || typeof valor.posicion === "string"
        ? Number(valor.posicion)
        : undefined,

    partidoID:
      typeof valor.partidoID === "string" ? valor.partidoID : undefined,
  };
}

async function crearPayloadOrigen({
  edicionID,
  partidoID,
  faseDestino,
  rondaDestino,
  lado,
  origen,
}: {
  edicionID: string;

  partidoID: string;

  faseDestino: FaseDB;

  rondaDestino: RondaDB;

  lado: LadoPartido;

  origen: OrigenEntrada;
}) {
  const payload: Record<string, unknown> = {
    edicion_id: edicionID,

    destino_fase_id: faseDestino.id,

    destino_tipo: "PARTIDO",

    grupo_id: null,

    partido_id: partidoID,

    lado,

    orden: lado === "LOCAL" ? 1 : 2,

    origen_tipo: origen.tipo,

    equipo_origen_id: null,

    origen_grupo_id: null,

    origen_fase_id: null,

    origen_posicion: null,

    origen_partido_id: null,

    equipo_resuelto_id: null,

    resuelta_at: null,
  };

  if (origen.tipo === "EQUIPO") {
    const equipoID = identificador(origen.equipoID, "equip");

    await exigirEquipoActivo(edicionID, equipoID);

    payload.equipo_origen_id = equipoID;

    payload.equipo_resuelto_id = equipoID;

    payload.resuelta_at = new Date().toISOString();

    return payload;
  }

  if (origen.tipo === "POSICION_GRUPO") {
    const grupoID = identificador(origen.grupoID, "grup");

    const posicion = enteroPositivo(origen.posicion, "posició");

    const { grupo, fase } = await exigirGrupo(grupoID, edicionID);

    if (fase.orden >= faseDestino.orden) {
      throw new ErrorAPI(
        409,
        "El grup d'origen ha de pertànyer a una fase anterior.",
      );
    }

    payload.origen_grupo_id = grupo.id;

    payload.origen_fase_id = fase.id;

    payload.origen_posicion = posicion;

    return payload;
  }

  if (origen.tipo === "POSICION_FASE") {
    const faseID = identificador(origen.faseID, "fase");

    const posicion = enteroPositivo(origen.posicion, "posició");

    const faseOrigen = await exigirFase(faseID, edicionID);

    if (faseOrigen.orden >= faseDestino.orden) {
      throw new ErrorAPI(409, "La fase d'origen ha de ser anterior.");
    }

    payload.origen_fase_id = faseOrigen.id;

    payload.origen_posicion = posicion;

    return payload;
  }

  if (origen.tipo === "GANADOR_PARTIDO" || origen.tipo === "PERDEDOR_PARTIDO") {
    const origenID = identificador(origen.partidoID, "partit d'origen");

    if (origenID === partidoID) {
      throw new ErrorAPI(409, "Un partit no pot dependre de si mateix.");
    }

    const partidoOrigen = await exigirPartido(origenID, edicionID);

    if (partidoOrigen.tipo !== "ELIMINATORIA") {
      throw new ErrorAPI(409, "El partit d'origen ha de ser eliminatori.");
    }

    const faseOrigen = await exigirFase(
      partidoOrigen.fase_id,
      edicionID,
      "ELIMINATORIA",
    );

    if (faseOrigen.orden > faseDestino.orden) {
      throw new ErrorAPI(
        409,
        "El partit d'origen no pot pertànyer a una fase posterior.",
      );
    }

    if (faseOrigen.id === faseDestino.id) {
      if (!partidoOrigen.ronda_id) {
        throw new ErrorAPI(409, "El partit d'origen no té ronda.");
      }

      const { ronda: rondaOrigen } = await exigirRonda(
        partidoOrigen.ronda_id,
        edicionID,
      );

      if (rondaOrigen.orden >= rondaDestino.orden) {
        throw new ErrorAPI(
          409,
          "El partit d'origen ha de pertànyer a una ronda anterior.",
        );
      }
    }

    payload.origen_partido_id = partidoOrigen.id;

    return payload;
  }

  return payload;
}

async function crearPlazasEliminatoria({
  partido,
  fase,
  ronda,
  local,
  visitante,
}: {
  partido: PartidoDB;

  fase: FaseDB;

  ronda: RondaDB;

  local: OrigenEntrada;

  visitante: OrigenEntrada;
}) {
  const [localPayload, visitantePayload] = await Promise.all([
    crearPayloadOrigen({
      edicionID: partido.edicion_id,

      partidoID: partido.id,

      faseDestino: fase,

      rondaDestino: ronda,

      lado: "LOCAL",

      origen: local,
    }),

    crearPayloadOrigen({
      edicionID: partido.edicion_id,

      partidoID: partido.id,

      faseDestino: fase,

      rondaDestino: ronda,

      lado: "VISITANTE",

      origen: visitante,
    }),
  ]);

  if (
    localPayload.equipo_resuelto_id &&
    visitantePayload.equipo_resuelto_id &&
    localPayload.equipo_resuelto_id === visitantePayload.equipo_resuelto_id
  ) {
    throw new ErrorAPI(
      409,
      "Un equip no pot ocupar les dues places del partit.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .insert([localPayload, visitantePayload])
    .select(SELECT_PLAZA);

  if (error) {
    throw error;
  }

  return data ?? [];
}

// ============================================================
// PUBLICACIÓN
// ============================================================

async function validarPublicable(partidoID: string, fechaHora: string | null) {
  if (!fechaHora) {
    throw new ErrorAPI(
      409,
      "Indica la data i l'hora abans de publicar el partit.",
    );
  }

  const plazas = await obtenerPlazasPartido(partidoID);

  if (
    !plazas.some((plaza) => plaza.lado === "LOCAL") ||
    !plazas.some((plaza) => plaza.lado === "VISITANTE")
  ) {
    throw new ErrorAPI(
      409,
      "Configura el local i el visitant abans de publicar.",
    );
  }
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

    const partidos = (partidosRespuesta.data ?? []).sort((a, b) => {
      const aFecha = a.fecha_hora
        ? new Date(a.fecha_hora).getTime()
        : Number.MAX_SAFE_INTEGER;

      const bFecha = b.fecha_hora
        ? new Date(b.fecha_hora).getTime()
        : Number.MAX_SAFE_INTEGER;

      if (aFecha !== bFecha) {
        return aFecha - bFecha;
      }

      return a.orden - b.orden;
    }) as PartidoDB[];

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
          (partido) =>
            partido.estado === "FINALIZADO" || Boolean(partido.finalizado_at),
        ).length,
      },

      equipos,

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

    const nombre = texto(entrada.nombre, "nom", 120);

    const fechaHora = fechaISO(entrada.fechaHora) ?? null;

    const pistaTexto = texto(entrada.pista, "pista", 120);

    const pista = pistaTexto || null;

    const duracion = enteroOpcional(entrada.duracion, "duració") ?? null;

    const publicar = entrada.publicado === true;

    // ======================================================
    // GRUPO
    // ======================================================

    if (tipo === "GRUPOS") {
      const grupoID = identificador(entrada.grupoID, "grup");

      const localID = identificador(entrada.localID, "equip local");

      const visitanteID = identificador(entrada.visitanteID, "equip visitant");

      const jornada = enteroPositivo(entrada.jornada, "jornada");

      const { grupo, fase } = await exigirGrupo(grupoID, edicionID);

      await validarPartidoGrupo(edicionID, grupo.id, localID, visitanteID);

      const orden = await siguienteOrden("grupo_id", grupo.id);

      const codigo = `F${fase.orden + 1}-G${grupo.orden + 1}-J${jornada}-P${orden + 1}`;

      // IMPORTANTE:
      // fase_tipo = GRUPOS
      // tipo       = GRUPO
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

          pista,

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

        if (publicar) {
          await validarPublicable(partido.id, fechaHora);

          const {
            data: actualizado,

            error: errorActualizar,
          } = await supabaseAdmin
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

          return responder(
            {
              success: true,

              partido: actualizado,

              plazas,
            },
            201,
          );
        }

        return responder(
          {
            success: true,

            partido,

            plazas,
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
    }

    // ======================================================
    // ELIMINATORIA
    // ======================================================

    const rondaID = identificador(entrada.rondaID, "ronda");

    const { ronda, fase } = await exigirRonda(rondaID, edicionID);

    const local = leerOrigen(entrada.local, "local");

    const visitante = leerOrigen(entrada.visitante, "visitant");

    const orden = await siguienteOrden("ronda_id", ronda.id);

    const codigo = `F${fase.orden + 1}-R${ronda.orden + 1}-P${orden + 1}`;

    const { data, error } = await supabaseAdmin
      .from("competicion_partidos")
      .insert({
        edicion_id: edicionID,

        fase_id: fase.id,

        fase_tipo: "ELIMINATORIA",

        tipo: "ELIMINATORIA",

        grupo_id: null,

        ronda_id: ronda.id,

        codigo,

        nombre: nombre || `${ronda.nombre} ${orden + 1}`,

        orden,

        jornada: null,

        estado: "BORRADOR",

        fecha_hora: fechaHora,

        pista,

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
      const plazas = await crearPlazasEliminatoria({
        partido,
        fase,
        ronda,
        local,
        visitante,
      });

      if (publicar) {
        await validarPublicable(partido.id, fechaHora);

        const {
          data: actualizado,

          error: errorActualizar,
        } = await supabaseAdmin
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

        return responder(
          {
            success: true,

            partido: actualizado,

            plazas,
          },
          201,
        );
      }

      return responder(
        {
          success: true,

          partido,

          plazas,
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
    // ESTADO
    // ======================================================

    if (entrada.accion === "cambiar_estado") {
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

      const estado = estadoEditable(entrada.estado);

      const cambios: Record<string, unknown> = {
        estado,
      };

      if (estado === "PROGRAMADO") {
        await validarPublicable(partido.id, partido.fecha_hora);

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

      return responder({
        success: true,

        partido: data,
      });
    }

    if (entrada.accion !== "editar_partido") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    if (
      partido.estado === "FINALIZADO" ||
      partido.estado === "EN_CURSO" ||
      partido.finalizado_at
    ) {
      throw new ErrorAPI(409, "Aquest partit ja no es pot editar.");
    }

    const cambios: Record<string, unknown> = {};

    if (entrada.nombre !== undefined) {
      const nombre = texto(entrada.nombre, "nom", 120);

      cambios.nombre = nombre || null;
    }

    const nuevaFecha = fechaISO(entrada.fechaHora);

    if (nuevaFecha !== undefined) {
      cambios.fecha_hora = nuevaFecha;
    }

    if (entrada.pista !== undefined) {
      const pista = texto(entrada.pista, "pista", 120);

      cambios.pista = pista || null;
    }

    const duracion = enteroOpcional(entrada.duracion, "duració");

    if (duracion !== undefined) {
      cambios.duracion_estimada_min = duracion;
    }

    if (entrada.jornada !== undefined) {
      if (partido.tipo !== "GRUPO") {
        throw new ErrorAPI(409, "Aquest partit no és de fase de grups.");
      }

      cambios.jornada = enteroPositivo(entrada.jornada, "jornada");
    }

    // ======================================================
    // CAMBIO EQUIPOS DE GRUPO
    // ======================================================

    if (
      partido.tipo === "GRUPO" &&
      (entrada.localID !== undefined || entrada.visitanteID !== undefined)
    ) {
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
    // CAMBIO ORIGEN ELIMINATORIA
    // ======================================================

    if (
      partido.tipo === "ELIMINATORIA" &&
      (entrada.local !== undefined || entrada.visitante !== undefined)
    ) {
      if (partido.publicado || partido.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Despublica el partit abans de modificar l'encreuament.",
        );
      }

      if (!partido.ronda_id) {
        throw new ErrorAPI(409, "El partit no té ronda.");
      }

      const { ronda, fase } = await exigirRonda(partido.ronda_id, edicionID);

      const local = leerOrigen(entrada.local, "local");

      const visitante = leerOrigen(entrada.visitante, "visitant");

      const [localPayload, visitantePayload] = await Promise.all([
        crearPayloadOrigen({
          edicionID,

          partidoID: partido.id,

          faseDestino: fase,

          rondaDestino: ronda,

          lado: "LOCAL",

          origen: local,
        }),

        crearPayloadOrigen({
          edicionID,

          partidoID: partido.id,

          faseDestino: fase,

          rondaDestino: ronda,

          lado: "VISITANTE",

          origen: visitante,
        }),
      ]);

      if (
        localPayload.equipo_resuelto_id &&
        visitantePayload.equipo_resuelto_id &&
        localPayload.equipo_resuelto_id === visitantePayload.equipo_resuelto_id
      ) {
        throw new ErrorAPI(409, "Un equip no pot ocupar les dues places.");
      }

      await eliminarPlazasPartido(partido.id);

      const { error } = await supabaseAdmin
        .from("competicion_plazas")
        .insert([localPayload, visitantePayload]);

      if (error) {
        throw error;
      }
    }

    // ======================================================
    // PUBLICACIÓN
    // ======================================================

    if (entrada.publicado !== undefined) {
      const publicar = booleano(entrada.publicado, "publicat");

      if (publicar) {
        const fechaFinal =
          nuevaFecha !== undefined ? nuevaFecha : partido.fecha_hora;

        await validarPublicable(partido.id, fechaFinal);

        cambios.publicado = true;

        if (partido.estado === "BORRADOR") {
          cambios.estado = "PROGRAMADO";
        }
      } else {
        cambios.publicado = false;

        if (partido.estado === "PROGRAMADO") {
          cambios.estado = "BORRADOR";
        }
      }
    }

    if (Object.keys(cambios).length === 0) {
      return responder({
        success: true,

        partido: await exigirPartido(partido.id, edicionID),

        plazas: await obtenerPlazasPartido(partido.id),
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

    return responder({
      success: true,

      partido: data,

      plazas: await obtenerPlazasPartido(partido.id),
    });
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

    await exigirContexto(usuario, torneoID, edicionID, "eliminar");

    if (entrada.accion !== "eliminar_partido") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    const partidoID = identificador(entrada.partidoID, "partit");

    const partido = await exigirPartido(partidoID, edicionID);

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
