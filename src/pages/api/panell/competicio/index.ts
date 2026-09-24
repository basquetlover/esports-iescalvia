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

type LadoPartido = "LOCAL" | "VISITANTE";

type TipoOrigenPlaza =
  | "EQUIPO"
  | "POSICION_GRUPO"
  | "POSICION_FASE"
  | "GANADOR_PARTIDO"
  | "PERDEDOR_PARTIDO"
  | "LIBRE";

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Registro = Record<string, unknown>;

type EquipoInscripcionDB = {
  id: string;
  formulario_id: string;
  nombre: string | null;
  escudo: string | null;
  validacion_estado: string | null;
  plaza_estado: string | null;
};

// ============================================================
// CONSTANTES
// ============================================================

const TIPOS_FASE: readonly TipoFase[] = ["GRUPOS", "ELIMINATORIA"];

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

const TIPOS_ORIGEN: readonly TipoOrigenPlaza[] = [
  "EQUIPO",
  "POSICION_GRUPO",
  "POSICION_FASE",
  "GANADOR_PARTIDO",
  "PERDEDOR_PARTIDO",
  "LIBRE",
];

const LADOS_PARTIDO: readonly LadoPartido[] = ["LOCAL", "VISITANTE"];

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

  console.error("Error gestionant la competició:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

// ============================================================
// VALIDACIONES
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

function tipoFase(valor: unknown): TipoFase {
  const tipo = texto(valor, "tipus de fase", 30, true).toUpperCase();

  if (!TIPOS_FASE.includes(tipo as TipoFase)) {
    throw new ErrorAPI(400, "El tipus de fase no és vàlid.");
  }

  return tipo as TipoFase;
}

function tipoRonda(valor: unknown): TipoRonda {
  const tipo = texto(valor, "tipus de ronda", 40, true).toUpperCase();

  if (!TIPOS_RONDA.includes(tipo as TipoRonda)) {
    throw new ErrorAPI(400, "El tipus de ronda no és vàlid.");
  }

  return tipo as TipoRonda;
}

function tipoOrigen(valor: unknown): TipoOrigenPlaza {
  const tipo = texto(valor, "origen", 40, true).toUpperCase();

  if (!TIPOS_ORIGEN.includes(tipo as TipoOrigenPlaza)) {
    throw new ErrorAPI(400, "L'origen de la plaça no és vàlid.");
  }

  return tipo as TipoOrigenPlaza;
}

function ladoPartido(valor: unknown): LadoPartido {
  const lado = texto(valor, "costat del partit", 20, true).toUpperCase();

  if (!LADOS_PARTIDO.includes(lado as LadoPartido)) {
    throw new ErrorAPI(400, "El costat del partit no és vàlid.");
  }

  return lado as LadoPartido;
}

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function estadoNormalizado(valor: string | null | undefined) {
  return valor?.trim().toUpperCase() ?? "";
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
      accion === "ver"
        ? "No tens permís per consultar el format de competició."
        : "No tens permís per modificar el format de competició.",
    );
  }

  const [torneoRespuesta, edicionRespuesta, configuracionRespuesta] =
    await Promise.all([
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

      supabaseAdmin
        .from("configuracion_ediciones")
        .select("edicion_id,competicion")
        .eq("edicion_id", edicionID)
        .maybeSingle(),
    ]);

  if (torneoRespuesta.error) {
    throw torneoRespuesta.error;
  }

  if (edicionRespuesta.error) {
    throw edicionRespuesta.error;
  }

  if (configuracionRespuesta.error) {
    throw configuracionRespuesta.error;
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

    configuracion: esRegistro(configuracionRespuesta.data?.competicion)
      ? configuracionRespuesta.data.competicion
      : {},
  };
}

// ============================================================
// FASE
// ============================================================

async function exigirFase(
  faseID: string,
  edicionID: string,
  tipoEsperado?: TipoFase,
) {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select(
      "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at,created_at,updated_at",
    )
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
    throw new ErrorAPI(400, "La fase no és del tipus esperat.");
  }

  return data;
}

// ============================================================
// GRUPO
// ============================================================

async function exigirGrupo(grupoID: string, edicionID: string) {
  const { data: grupo, error: errorGrupo } = await supabaseAdmin
    .from("competicion_grupos")
    .select("id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at")
    .eq("id", grupoID)
    .maybeSingle();

  if (errorGrupo) {
    throw errorGrupo;
  }

  if (!grupo) {
    throw new ErrorAPI(404, "No s'ha trobat el grup.");
  }

  const fase = await exigirFase(grupo.fase_id, edicionID, "GRUPOS");

  return {
    grupo,
    fase,
  };
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

  const fase = await exigirFase(ronda.fase_id, edicionID, "ELIMINATORIA");

  return {
    ronda,
    fase,
  };
}

// ============================================================
// PARTIDO
// ============================================================

async function exigirPartido(partidoID: string, edicionID: string) {
  const { data: partido, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select(
      "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at",
    )
    .eq("id", partidoID)
    .eq("edicion_id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  return partido;
}

// ============================================================
// ORDENES
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

async function siguienteOrdenGrupo(faseID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_grupos")
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

async function siguienteOrdenPlazaGrupo(grupoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select("orden")
    .eq("destino_tipo", "GRUPO")
    .eq("grupo_id", grupoID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? 0) + 1;
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
// EQUIPOS
// ============================================================

async function obtenerEquiposCompeticion(edicionID: string) {
  const { data: formularios, error: errorFormularios } = await supabaseAdmin
    .from("formularios")
    .select("id,estado")
    .eq("edicion_id", edicionID)
    .eq("tipo", "EQUIPO");

  if (errorFormularios) {
    throw errorFormularios;
  }

  const idsFormularios = (formularios ?? []).map((formulario) => formulario.id);

  let equipos: EquipoInscripcionDB[] = [];

  if (idsFormularios.length > 0) {
    const { data, error } = await supabaseAdmin
      .from("equipos")
      .select("id,formulario_id,nombre,escudo,validacion_estado,plaza_estado")
      .in("formulario_id", idsFormularios);

    if (error) {
      throw error;
    }

    equipos = (data ?? []) as EquipoInscripcionDB[];
  }

  const { data: equiposCompeticion, error: errorCompeticion } =
    await supabaseAdmin
      .from("competicion_equipos")
      .select("equipo_id,estado,seed,origen,created_at,updated_at")
      .eq("edicion_id", edicionID);

  if (errorCompeticion) {
    throw errorCompeticion;
  }

  const formularioPorID = new Map(
    (formularios ?? []).map((formulario) => [formulario.id, formulario]),
  );

  const competicionPorEquipo = new Map(
    (equiposCompeticion ?? []).map((equipo) => [equipo.equipo_id, equipo]),
  );

  return equipos
    .map((equipo) => {
      const formulario = formularioPorID.get(equipo.formulario_id);

      const registroCompeticion = competicionPorEquipo.get(equipo.id) ?? null;

      const elegible =
        estadoNormalizado(formulario?.estado) === "APROBADO" &&
        estadoNormalizado(equipo.validacion_estado) === "APROBADO" &&
        estadoNormalizado(equipo.plaza_estado) === "CONFIRMADA";

      return {
        id: equipo.id,

        nombre: equipo.nombre ?? "Equip sense nom",

        escudo: equipo.escudo ?? null,

        formulario_estado: formulario?.estado ?? null,

        validacion_estado: equipo.validacion_estado ?? null,

        plaza_estado: equipo.plaza_estado ?? null,

        elegible,

        competicion: registroCompeticion
          ? {
              estado: registroCompeticion.estado,

              seed: registroCompeticion.seed,

              origen: registroCompeticion.origen,
            }
          : null,
      };
    })
    .filter((equipo) => equipo.elegible || equipo.competicion !== null)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "ca"));
}

async function exigirEquipoElegible(edicionID: string, equipoID: string) {
  const { data: equipo, error: errorEquipo } = await supabaseAdmin
    .from("equipos")
    .select("id,formulario_id,nombre,validacion_estado,plaza_estado")
    .eq("id", equipoID)
    .maybeSingle();

  if (errorEquipo) {
    throw errorEquipo;
  }

  if (!equipo) {
    throw new ErrorAPI(404, "No s'ha trobat l'equip.");
  }

  const { data: formulario, error: errorFormulario } = await supabaseAdmin
    .from("formularios")
    .select("id,edicion_id,tipo,estado")
    .eq("id", equipo.formulario_id)
    .maybeSingle();

  if (errorFormulario) {
    throw errorFormulario;
  }

  if (
    !formulario ||
    formulario.edicion_id !== edicionID ||
    formulario.tipo !== "EQUIPO"
  ) {
    throw new ErrorAPI(404, "L'equip no pertany a aquesta edició.");
  }

  if (
    estadoNormalizado(formulario.estado) !== "APROBADO" ||
    estadoNormalizado(equipo.validacion_estado) !== "APROBADO" ||
    estadoNormalizado(equipo.plaza_estado) !== "CONFIRMADA"
  ) {
    throw new ErrorAPI(
      409,
      "L'equip ha d'estar aprovat i tenir la plaça confirmada.",
    );
  }

  return equipo;
}

async function exigirEquipoActivoCompeticion(
  edicionID: string,
  equipoID: string,
) {
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

  return data;
}

// ============================================================
// VALIDAR ORÍGENES
// ============================================================

async function validarGrupoOrigenAnterior(
  grupoID: string,
  partidoDestino: Awaited<ReturnType<typeof exigirPartido>>,
  edicionID: string,
) {
  const { grupo, fase: faseOrigen } = await exigirGrupo(grupoID, edicionID);

  const faseDestino = await exigirFase(
    partidoDestino.fase_id,
    edicionID,
    "ELIMINATORIA",
  );

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
  partidoDestino: Awaited<ReturnType<typeof exigirPartido>>,
  edicionID: string,
) {
  const faseOrigen = await exigirFase(faseOrigenID, edicionID);

  const faseDestino = await exigirFase(
    partidoDestino.fase_id,
    edicionID,
    "ELIMINATORIA",
  );

  if (faseOrigen.orden >= faseDestino.orden) {
    throw new ErrorAPI(
      409,
      "La fase d'origen ha de ser anterior a la fase del partit.",
    );
  }

  return faseOrigen;
}

async function validarPartidoOrigenAnterior(
  partidoOrigenID: string,
  partidoDestino: Awaited<ReturnType<typeof exigirPartido>>,
  edicionID: string,
) {
  if (partidoOrigenID === partidoDestino.id) {
    throw new ErrorAPI(409, "Un partit no pot dependre de si mateix.");
  }

  const partidoOrigen = await exigirPartido(partidoOrigenID, edicionID);

  if (partidoOrigen.tipo !== "ELIMINATORIA") {
    throw new ErrorAPI(409, "El partit d'origen ha de ser eliminatori.");
  }

  const [faseOrigen, faseDestino] = await Promise.all([
    exigirFase(partidoOrigen.fase_id, edicionID, "ELIMINATORIA"),

    exigirFase(partidoDestino.fase_id, edicionID, "ELIMINATORIA"),
  ]);

  if (faseOrigen.orden < faseDestino.orden) {
    return partidoOrigen;
  }

  if (faseOrigen.id !== faseDestino.id) {
    throw new ErrorAPI(
      409,
      "El partit d'origen ha de pertànyer a una fase anterior.",
    );
  }

  if (!partidoOrigen.ronda_id || !partidoDestino.ronda_id) {
    throw new ErrorAPI(
      409,
      "Els partits eliminatoris han de pertànyer a una ronda.",
    );
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
// CONFIGURAR PLAZA PARTIDO
// ============================================================

async function configurarPlazaPartido({
  edicionID,
  partidoID,
  lado,
  origenTipo,
  entrada,
}: {
  edicionID: string;
  partidoID: string;
  lado: LadoPartido;
  origenTipo: TipoOrigenPlaza;
  entrada: Registro;
}) {
  const partido = await exigirPartido(partidoID, edicionID);

  if (partido.tipo !== "ELIMINATORIA" || !partido.ronda_id) {
    throw new ErrorAPI(409, "Aquest partit no és un partit eliminatori.");
  }

  if (partido.estado !== "BORRADOR") {
    throw new ErrorAPI(
      409,
      "Només es poden modificar els encreuaments d'un partit en esborrany.",
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

  if (origenTipo === "EQUIPO") {
    const equipoID = identificador(entrada.equipoID, "equip");

    await exigirEquipoActivoCompeticion(edicionID, equipoID);

    const otroLado = lado === "LOCAL" ? "VISITANTE" : "LOCAL";

    const { data: plazaOtroLado, error: errorOtroLado } = await supabaseAdmin
      .from("competicion_plazas")
      .select("id,equipo_resuelto_id")
      .eq("edicion_id", edicionID)
      .eq("destino_tipo", "PARTIDO")
      .eq("partido_id", partido.id)
      .eq("lado", otroLado)
      .maybeSingle();

    if (errorOtroLado) {
      throw errorOtroLado;
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

  if (origenTipo === "POSICION_FASE") {
    const faseOrigenID = identificador(entrada.faseOrigenID, "fase d'origen");

    const posicion = enteroPositivo(entrada.posicion, "posició");

    const faseOrigen = await validarFaseOrigenAnterior(
      faseOrigenID,
      partido,
      edicionID,
    );

    payload.origen_fase_id = faseOrigen.id;

    payload.origen_posicion = posicion;
  }

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
      .select(
        "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at",
      )
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .insert(payload)
    .select(
      "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at",
    )
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// ============================================================
// CONTAR
// ============================================================

async function contar(tabla: string, columna: string, id: string) {
  const { count, error } = await supabaseAdmin
    .from(tabla)
    .select("id", {
      count: "exact",

      head: true,
    })
    .eq(columna, id);

  if (error) {
    throw error;
  }

  return count ?? 0;
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

    const { data: fases, error: errorFases } = await supabaseAdmin
      .from("competicion_fases")
      .select(
        "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at,created_at,updated_at",
      )
      .eq("edicion_id", edicionID)
      .order("orden", {
        ascending: true,
      });

    if (errorFases) {
      throw errorFases;
    }

    const idsFases = (fases ?? []).map((fase) => fase.id);

    let grupos: Record<string, unknown>[] = [];

    let rondas: Record<string, unknown>[] = [];

    if (idsFases.length > 0) {
      const [gruposRespuesta, rondasRespuesta] = await Promise.all([
        supabaseAdmin
          .from("competicion_grupos")
          .select(
            "id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at,created_at,updated_at",
          )
          .in("fase_id", idsFases)
          .order("orden", {
            ascending: true,
          }),

        supabaseAdmin
          .from("competicion_rondas")
          .select("id,fase_id,tipo,nombre,orden,created_at,updated_at")
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

      grupos = gruposRespuesta.data ?? [];

      rondas = rondasRespuesta.data ?? [];
    }

    const equipos = await obtenerEquiposCompeticion(edicionID);

    const { data: plazasGrupo, error: errorPlazasGrupo } = await supabaseAdmin
      .from("competicion_plazas")
      .select(
        "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at",
      )
      .eq("edicion_id", edicionID)
      .eq("destino_tipo", "GRUPO")
      .order("orden", {
        ascending: true,
      });

    if (errorPlazasGrupo) {
      throw errorPlazasGrupo;
    }

    const { data: partidos, error: errorPartidos } = await supabaseAdmin
      .from("competicion_partidos")
      .select(
        "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at",
      )
      .eq("edicion_id", edicionID)
      .order("orden", {
        ascending: true,
      });

    if (errorPartidos) {
      throw errorPartidos;
    }

    const { data: plazasPartido, error: errorPlazasPartido } =
      await supabaseAdmin
        .from("competicion_plazas")
        .select(
          "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at",
        )
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "PARTIDO")
        .order("orden", {
          ascending: true,
        });

    if (errorPlazasPartido) {
      throw errorPlazasPartido;
    }

    const fasesSalida = (fases ?? []).map((fase) => ({
      ...fase,

      grupos: grupos.filter((grupo) => grupo.fase_id === fase.id),

      rondas: rondas.filter((ronda) => ronda.fase_id === fase.id),
    }));

    const equiposActivos = equipos.filter(
      (equipo) => equipo.competicion?.estado === "ACTIVO",
    ).length;

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      configuracion: contexto.configuracion,

      resumen: {
        fases: fasesSalida.length,

        grupos: grupos.length,

        rondas: rondas.length,

        equipos: equiposActivos,

        partidos: (partidos ?? []).length,
      },

      capacidades: {
        editar: tienePermiso(usuario, "competicio", "editar", torneoID),
      },

      equipos,

      plazasGrupo: plazasGrupo ?? [],

      partidos: partidos ?? [],

      plazasPartido: plazasPartido ?? [],

      fases: fasesSalida,
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
    // CREAR FASE
    // =================================================

    if (accion === "crear_fase") {
      const nombre = texto(entrada.nombre, "nom", 120, true);

      const tipo = tipoFase(entrada.tipo);

      const orden = await siguienteOrdenFase(edicionID);

      const { data, error } = await supabaseAdmin
        .from("competicion_fases")
        .insert({
          edicion_id: edicionID,

          nombre,

          tipo,

          orden,

          estado: "BORRADOR",

          publicada: false,

          configuracion: {},
        })
        .select(
          "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at,created_at,updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,

          fase: data,
        },
        201,
      );
    }

    // =================================================
    // CREAR GRUPO
    // =================================================

    if (accion === "crear_grupo") {
      const faseID = identificador(entrada.faseID, "fase");

      await exigirFase(faseID, edicionID, "GRUPOS");

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const orden = await siguienteOrdenGrupo(faseID);

      const { data, error } = await supabaseAdmin
        .from("competicion_grupos")
        .insert({
          fase_id: faseID,

          nombre,

          orden,

          estado: "PREPARADO",
        })
        .select(
          "id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at,created_at,updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,

          grupo: data,
        },
        201,
      );
    }

    // =================================================
    // CREAR RONDA
    // =================================================

    if (accion === "crear_ronda") {
      const faseID = identificador(entrada.faseID, "fase");

      await exigirFase(faseID, edicionID, "ELIMINATORIA");

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const tipo = tipoRonda(entrada.tipo);

      const orden = await siguienteOrdenRonda(faseID);

      const { data, error } = await supabaseAdmin
        .from("competicion_rondas")
        .insert({
          fase_id: faseID,

          nombre,

          tipo,

          orden,
        })
        .select("id,fase_id,tipo,nombre,orden,created_at,updated_at")
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,

          ronda: data,
        },
        201,
      );
    }

    // =================================================
    // CREAR PARTIDO
    // =================================================

    if (accion === "crear_partido") {
      const rondaID = identificador(entrada.rondaID, "ronda");

      const { ronda, fase } = await exigirRonda(rondaID, edicionID);

      if (fase.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Només es poden crear partits mentre la fase està en esborrany.",
        );
      }

      const orden = await siguienteOrdenPartido(ronda.id);

      const nombreEntrada = texto(entrada.nombre, "nom", 120);

      const nombre = nombreEntrada || `${ronda.nombre} ${orden + 1}`;

      const codigo = `E${fase.orden + 1}-R${ronda.orden + 1}-P${orden + 1}-${ronda.id
        .slice(0, 4)
        .toUpperCase()}`;

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

          nombre,

          orden,

          jornada: null,

          estado: "BORRADOR",

          publicado: false,
        })
        .select(
          "id,edicion_id,fase_id,fase_tipo,tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,duracion_estimada_min,publicado,finalizado_at,created_at,updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,

          partido: data,
        },
        201,
      );
    }

    // =================================================
    // CONFIGURAR PLAZA PARTIDO
    // =================================================

    if (accion === "configurar_plaza_partido") {
      const partidoID = identificador(entrada.partidoID, "partit");

      const lado = ladoPartido(entrada.lado);

      const origenTipo = tipoOrigen(entrada.origenTipo);

      const plaza = await configurarPlazaPartido({
        edicionID,
        partidoID,
        lado,
        origenTipo,
        entrada,
      });

      return responder(
        {
          success: true,

          plaza,
        },
        201,
      );
    }

    // =================================================
    // ACTIVAR EQUIPO
    // =================================================

    if (accion === "activar_equipo") {
      const equipoID = identificador(entrada.equipoID, "equip");

      await exigirEquipoElegible(edicionID, equipoID);

      const { data: existente, error: errorExistente } = await supabaseAdmin
        .from("competicion_equipos")
        .select("equipo_id,estado")
        .eq("edicion_id", edicionID)
        .eq("equipo_id", equipoID)
        .maybeSingle();

      if (errorExistente) {
        throw errorExistente;
      }

      if (existente) {
        const { error } = await supabaseAdmin
          .from("competicion_equipos")
          .update({
            estado: "ACTIVO",
          })
          .eq("edicion_id", edicionID)
          .eq("equipo_id", equipoID);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabaseAdmin
          .from("competicion_equipos")
          .insert({
            edicion_id: edicionID,

            equipo_id: equipoID,

            estado: "ACTIVO",

            origen: "INSCRIPCION",
          });

        if (error) {
          throw error;
        }
      }

      return responder(
        {
          success: true,
        },
        201,
      );
    }

    // =================================================
    // ASIGNAR EQUIPO A GRUPO
    // =================================================

    if (accion === "asignar_equipo_grupo") {
      const grupoID = identificador(entrada.grupoID, "grup");

      const equipoID = identificador(entrada.equipoID, "equip");

      const { grupo, fase } = await exigirGrupo(grupoID, edicionID);

      if (grupo.estado !== "PREPARADO") {
        throw new ErrorAPI(
          409,
          "Només es pot modificar un grup en preparació.",
        );
      }

      await exigirEquipoActivoCompeticion(edicionID, equipoID);

      const { data: existente, error: errorExistente } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id")
        .eq("edicion_id", edicionID)
        .eq("destino_fase_id", fase.id)
        .eq("destino_tipo", "GRUPO")
        .eq("equipo_resuelto_id", equipoID)
        .limit(1)
        .maybeSingle();

      if (errorExistente) {
        throw errorExistente;
      }

      if (existente) {
        throw new ErrorAPI(
          409,
          "Aquest equip ja està assignat a un grup d'aquesta fase.",
        );
      }

      const orden = await siguienteOrdenPlazaGrupo(grupo.id);

      const ahora = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("competicion_plazas")
        .insert({
          edicion_id: edicionID,

          destino_fase_id: fase.id,

          destino_tipo: "GRUPO",

          grupo_id: grupo.id,

          partido_id: null,

          lado: null,

          orden,

          origen_tipo: "EQUIPO",

          equipo_origen_id: equipoID,

          origen_grupo_id: null,

          origen_fase_id: null,

          origen_posicion: null,

          origen_partido_id: null,

          equipo_resuelto_id: equipoID,

          resuelta_at: ahora,
        })
        .select(
          "id,edicion_id,destino_fase_id,grupo_id,orden,origen_tipo,equipo_origen_id,equipo_resuelto_id,resuelta_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,

          plaza: data,
        },
        201,
      );
    }

    throw new ErrorAPI(400, "L'acció sol·licitada no és vàlida.");
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
        .select("id,nombre,tipo,orden,estado,publicada,updated_at")
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,

        fase: data,
      });
    }

    if (accion === "editar_grupo") {
      const grupoID = identificador(entrada.grupoID, "grup");

      await exigirGrupo(grupoID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const { data, error } = await supabaseAdmin
        .from("competicion_grupos")
        .update({
          nombre,
        })
        .eq("id", grupoID)
        .select(
          "id,fase_id,nombre,orden,estado,version_clasificacion,updated_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,

        grupo: data,
      });
    }

    if (accion === "editar_ronda") {
      const rondaID = identificador(entrada.rondaID, "ronda");

      await exigirRonda(rondaID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const tipo = entrada.tipo === undefined ? null : tipoRonda(entrada.tipo);

      const cambios: Record<string, unknown> = {
        nombre,
      };

      if (tipo) {
        cambios.tipo = tipo;
      }

      const { data, error } = await supabaseAdmin
        .from("competicion_rondas")
        .update(cambios)
        .eq("id", rondaID)
        .select("id,fase_id,tipo,nombre,orden,updated_at")
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,

        ronda: data,
      });
    }

    if (accion === "editar_partido") {
      const partidoID = identificador(entrada.partidoID, "partit");

      const partido = await exigirPartido(partidoID, edicionID);

      if (partido.estado !== "BORRADOR") {
        throw new ErrorAPI(409, "Només es pot editar un partit en esborrany.");
      }

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const { data, error } = await supabaseAdmin
        .from("competicion_partidos")
        .update({
          nombre,
        })
        .eq("id", partido.id)
        .eq("edicion_id", edicionID)
        .select("id,codigo,nombre,orden,estado,updated_at")
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,

        partido: data,
      });
    }

    throw new ErrorAPI(400, "L'acció sol·licitada no és vàlida.");
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
    // ELIMINAR PLAZA PARTIDO
    // =================================================

    if (accion === "eliminar_plaza_partido") {
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
          "No es pot modificar un partit que ja ha començat.",
        );
      }

      const { data: eliminada, error } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("id", plaza.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!eliminada) {
        throw new ErrorAPI(409, "La plaça no s'ha pogut eliminar.");
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // ELIMINAR PARTIDO
    // =================================================

    if (accion === "eliminar_partido") {
      const partidoID = identificador(entrada.partidoID, "partit");

      const partido = await exigirPartido(partidoID, edicionID);

      if (partido.estado !== "BORRADOR") {
        throw new ErrorAPI(
          409,
          "Només es poden eliminar partits en esborrany.",
        );
      }

      /*
       * Antes de eliminar el partido debemos
       * comprobar si otro cruce depende de él.
       *
       * Ejemplo:
       *
       * QF1 -> ganador -> SF1
       */

      const { count: usosComoOrigen, error: errorUsos } = await supabaseAdmin
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

      if ((usosComoOrigen ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar aquest partit perquè el seu guanyador o perdedor alimenta un altre encreuament. Desconnecta primer aquest encreuament.",
        );
      }

      /*
       * El partido está en BORRADOR.
       *
       * Eliminamos primero sus dos posibles plazas:
       * LOCAL y VISITANTE.
       */

      const { error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "PARTIDO")
        .eq("partido_id", partido.id);

      if (errorPlazas) {
        throw errorPlazas;
      }

      /*
       * Finalmente eliminamos el partido.
       *
       * .select().maybeSingle() sirve también
       * para comprobar que Supabase realmente
       * ha eliminado la fila.
       */

      const { data: eliminado, error: errorEliminar } = await supabaseAdmin
        .from("competicion_partidos")
        .delete()
        .eq("id", partido.id)
        .eq("edicion_id", edicionID)
        .select("id,codigo,nombre")
        .maybeSingle();

      if (errorEliminar) {
        throw errorEliminar;
      }

      if (!eliminado) {
        throw new ErrorAPI(409, "El partit no s'ha pogut eliminar.");
      }

      return responder({
        success: true,

        partido: eliminado,
      });
    }

    // =================================================
    // ELIMINAR FASE
    // =================================================

    if (accion === "eliminar_fase") {
      const faseID = identificador(entrada.faseID, "fase");

      await exigirFase(faseID, edicionID);

      const [grupos, rondas, partidos] = await Promise.all([
        contar("competicion_grupos", "fase_id", faseID),

        contar("competicion_rondas", "fase_id", faseID),

        contar("competicion_partidos", "fase_id", faseID),
      ]);

      const { count: plazas, error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id", {
          count: "exact",

          head: true,
        })
        .or(`destino_fase_id.eq.${faseID},origen_fase_id.eq.${faseID}`);

      if (errorPlazas) {
        throw errorPlazas;
      }

      if (grupos > 0 || rondas > 0 || partidos > 0 || (plazas ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar la fase perquè encara conté dades.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_fases")
        .delete()
        .eq("id", faseID)
        .eq("edicion_id", edicionID);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // ELIMINAR GRUPO
    // =================================================

    if (accion === "eliminar_grupo") {
      const grupoID = identificador(entrada.grupoID, "grup");

      const { grupo } = await exigirGrupo(grupoID, edicionID);

      const [partidos, clasificaciones] = await Promise.all([
        contar("competicion_partidos", "grupo_id", grupoID),

        contar("competicion_clasificaciones", "grupo_id", grupoID),
      ]);

      const { count: plazas, error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id", {
          count: "exact",

          head: true,
        })
        .or(`grupo_id.eq.${grupoID},origen_grupo_id.eq.${grupoID}`);

      if (errorPlazas) {
        throw errorPlazas;
      }

      if (partidos > 0 || clasificaciones > 0 || (plazas ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar el grup perquè ja té dades associades.",
        );
      }

      if (grupo.estado !== "PREPARADO") {
        throw new ErrorAPI(
          409,
          "No es pot eliminar un grup que ja ha començat.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_grupos")
        .delete()
        .eq("id", grupo.id);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // ELIMINAR RONDA
    // =================================================

    if (accion === "eliminar_ronda") {
      const rondaID = identificador(entrada.rondaID, "ronda");

      const { ronda } = await exigirRonda(rondaID, edicionID);

      const partidos = await contar(
        "competicion_partidos",
        "ronda_id",
        ronda.id,
      );

      if (partidos > 0) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar la ronda perquè conté partits.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_rondas")
        .delete()
        .eq("id", ronda.id);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // RETIRAR EQUIPO
    // =================================================

    if (accion === "retirar_equipo") {
      const equipoID = identificador(entrada.equipoID, "equip");

      await exigirEquipoActivoCompeticion(edicionID, equipoID);

      const { count, error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id", {
          count: "exact",

          head: true,
        })
        .eq("edicion_id", edicionID)
        .or(
          `equipo_origen_id.eq.${equipoID},equipo_resuelto_id.eq.${equipoID}`,
        );

      if (errorPlazas) {
        throw errorPlazas;
      }

      if ((count ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "Abans de retirar l'equip l'has de llevar dels grups i dels encreuaments.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_equipos")
        .update({
          estado: "RETIRADO",
        })
        .eq("edicion_id", edicionID)
        .eq("equipo_id", equipoID);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    // =================================================
    // QUITAR EQUIPO GRUPO
    // =================================================

    if (accion === "quitar_equipo_grupo") {
      const plazaID = identificador(entrada.plazaID, "plaça");

      const { data: plaza, error: errorPlaza } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id,grupo_id")
        .eq("id", plazaID)
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "GRUPO")
        .maybeSingle();

      if (errorPlaza) {
        throw errorPlaza;
      }

      if (!plaza || !plaza.grupo_id) {
        throw new ErrorAPI(404, "No s'ha trobat l'assignació.");
      }

      const { grupo } = await exigirGrupo(plaza.grupo_id, edicionID);

      if (grupo.estado !== "PREPARADO") {
        throw new ErrorAPI(
          409,
          "No es pot modificar la composició d'un grup que ja ha començat.",
        );
      }

      const { data: eliminada, error } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("id", plaza.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!eliminada) {
        throw new ErrorAPI(409, "L'assignació no s'ha pogut eliminar.");
      }

      return responder({
        success: true,
      });
    }

    throw new ErrorAPI(400, "L'acció sol·licitada no és vàlida.");
  } catch (error) {
    return errorRespuesta(error);
  }
};
