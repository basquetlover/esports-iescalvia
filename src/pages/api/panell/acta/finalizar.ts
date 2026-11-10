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
import {
  calcularEstadoVoleibol,
  evaluarCierreVoleibol,
  normalizarConfiguracionVoleibol,
  type ConfiguracionVoleibol,
  type EstadoVoleibol,
  type ModoCierreVoleibol,
} from "@utils/acta/voleibol";

export const prerender = false;

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;
type Registro = Record<string, unknown>;
type Deporte = "FUTBOL" | "VOLEIBOL";
type Equipos = { local: string; visitante: string };

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
  controlador_id: string | null;
  control_token: string | null;
  finalizada_at: string | null;
  secuencia_eventos: number;
  version: number;
  configuracion_snapshot: Registro | null;
};

type EventoDB = {
  id: string;
  cliente_evento_id: string;
  orden: number;
  tipo_evento: string;
  equipo_id: string | null;
  jugador_id: string | null;
  periodo: number | null;
  estado: string;
};

type PlazaDB = {
  lado: "LOCAL" | "VISITANTE" | null;
  equipo_resuelto_id: string | null;
};

type PlazaDependienteDB = {
  id: string;
  origen_tipo: "GANADOR_PARTIDO" | "PERDEDOR_PARTIDO";
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
  observaciones: string | null;
};

type ResultadoCalculado = {
  local: number;
  visitante: number;
  ganadorEquipoID: string | null;
  observaciones: string | null;
  modoCierre: ModoCierreVoleibol | null;
  volei: EstadoVoleibol | null;
};

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at";
const SELECT_EDICION = "id,torneo_id";

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,controlador_id,control_token,finalizada_at,secuencia_eventos,version,configuracion_snapshot";

const SELECT_EVENTOS =
  "id,cliente_evento_id,orden,tipo_evento,equipo_id,jugador_id,periodo,estado";

const SELECT_PLAZAS = "lado,equipo_resuelto_id";
const SELECT_DEPENDENCIAS = "id,origen_tipo,equipo_resuelto_id";
const SELECT_ESTADISTICAS = "id,codigo,ambito,activa";

const SELECT_RESULTADO =
  "id,marcador_local,marcador_visitante,ganador_equipo_id,resultado_tipo,confirmado,confirmado_at,observaciones";

const CODIGOS_FUTBOL = {
  GOL: new Set(["gol", "goles", "gols"]),

  TARJETA_AMARILLA: new Set([
    "amarilla",
    "amarillas",
    "tarjeta_amarilla",
    "tarjetas_amarillas",
    "targeta_groga",
    "targetes_grogues",
  ]),

  TARJETA_ROJA: new Set([
    "roja",
    "rojas",
    "tarjeta_roja",
    "tarjetas_rojas",
    "targeta_vermella",
    "targetes_vermelles",
  ]),

  PENALTI_MARCADO: new Set([
    "penalti_marcado",
    "penaltis_marcados",
    "penalti_gol",
    "penals_marcats",
  ]),

  PENALTI_FALLADO: new Set([
    "penalti_fallado",
    "penaltis_fallados",
    "penalti_fallat",
    "penals_fallats",
  ]),
};

const CODIGOS_VOLEIBOL = {
  DIRECTO: new Set([
    "directo",
    "directos",
    "directe",
    "directes",
    "punt_directe",
    "punts_directes",
  ]),

  BLOQUEO: new Set([
    "bloqueo",
    "bloqueos",
    "bloqueig",
    "bloquejos",
    "bloqueigs",
  ]),

  REMATE: new Set(["remate", "remates", "rematada", "rematades"]),

  ERROR: new Set(["error", "errores", "errors"]),

  PUNTOS: new Set([
    "punto",
    "puntos",
    "punt",
    "punts",
    "puntos_totales",
    "punts_totals",
  ]),

  SETS: new Set(["set", "sets", "sets_ganados", "sets_guanyats"]),
};

type CodigoFutbol = keyof typeof CODIGOS_FUTBOL;
type CodigoVoleibol = keyof typeof CODIGOS_VOLEIBOL;

function responderError(error: unknown) {
  if (error instanceof ErrorAPI) {
    return responder({ success: false, mensaje: error.message }, error.estado);
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

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim().toLowerCase())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function normalizar(valor: string): string {
  return valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function leerDeporte(valor: string): Deporte {
  const deporte = normalizar(valor).toUpperCase();

  if (deporte !== "FUTBOL" && deporte !== "VOLEIBOL") {
    throw new ErrorAPI(
      409,
      "Aquest esport encara no permet finalitzar l'acta digital.",
    );
  }

  return deporte;
}

function leerModoCierre(valor: unknown, deporte: Deporte): ModoCierreVoleibol {
  if (deporte !== "VOLEIBOL") return "NORMAL";

  if (valor === undefined || valor === null || valor === "NORMAL") {
    return "NORMAL";
  }

  if (valor === "FORZADO_PUNTOS") return valor;

  throw new ErrorAPI(
    400,
    "La modalitat de tancament de voleibol no és vàlida.",
  );
}

function reglasVoleibol(acta: ActaDB): ConfiguracionVoleibol {
  const snapshot = acta.configuracion_snapshot;

  const origen =
    esRegistro(snapshot) && esRegistro(snapshot.voleibol)
      ? snapshot.voleibol
      : {};

  const entrada: Partial<ConfiguracionVoleibol> = {};

  const campos = [
    "setsParaGanar",
    "puntosSet",
    "diferenciaSet",
    "puntosExtraSet",
    "diferenciaExtraSet",
  ] as const;

  for (const campo of campos) {
    const valor = origen[campo];

    if (valor === undefined || valor === null) continue;

    if (typeof valor !== "number") {
      throw new ErrorAPI(409, "Les regles guardades de l'acta no són vàlides.");
    }

    entrada[campo] = valor;
  }

  try {
    return normalizarConfiguracionVoleibol(entrada);
  } catch {
    throw new ErrorAPI(409, "Les regles guardades de l'acta no són vàlides.");
  }
}

async function exigirContexto(usuario: Usuario, partidoID: string) {
  const { data: partidoData, error: errorPartido } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .maybeSingle();

  if (errorPartido) throw errorPartido;

  const partido = partidoData as PartidoDB | null;

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  const { data: edicionData, error: errorEdicion } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", partido.edicion_id)
    .maybeSingle();

  if (errorEdicion) throw errorEdicion;

  const edicion = edicionData as EdicionDB | null;

  if (!edicion?.torneo_id) {
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

  const { data: actaData, error: errorActa } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (errorActa) throw errorActa;

  const acta = actaData as ActaDB | null;

  if (!acta) {
    throw new ErrorAPI(409, "L'acta encara no està iniciada.");
  }

  if (
    acta.partido_id !== partidoID ||
    acta.edicion_id !== partido.edicion_id ||
    acta.torneo_id !== torneoID
  ) {
    throw new ErrorAPI(409, "L'acta no correspon al partit.");
  }

  return { partido, acta };
}

function exigirControl(usuario: Usuario, acta: ActaDB, controlToken: string) {
  // Permite reintentos si la primera respuesta se perdió tras finalizar.
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

async function obtenerEquipos(partidoID: string): Promise<Equipos> {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZAS)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (error) throw error;

  const plazas = (data ?? []) as PlazaDB[];

  const local = plazas.find((p) => p.lado === "LOCAL")?.equipo_resuelto_id;

  const visitante = plazas.find(
    (p) => p.lado === "VISITANTE",
  )?.equipo_resuelto_id;

  if (!local || !visitante || local === visitante) {
    throw new ErrorAPI(409, "El partit no té resolts dos equips diferents.");
  }

  return { local, visitante };
}

async function obtenerEventos(actaID: string): Promise<EventoDB[]> {
  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .select(SELECT_EVENTOS)
    .eq("acta_id", actaID)
    .order("orden", { ascending: true });

  if (error) throw error;

  return (data ?? []) as EventoDB[];
}

function calcularMarcadorFutbol(eventos: EventoDB[], equipoID: string): number {
  return eventos.reduce((total, evento) => {
    if (evento.estado !== "ACTIVO" || evento.equipo_id !== equipoID) {
      return total;
    }

    return (
      total +
      (evento.tipo_evento === "GOL" || evento.tipo_evento === "PENALTI_MARCADO"
        ? 1
        : 0)
    );
  }, 0);
}

function calcularResultado(
  deporte: Deporte,
  acta: ActaDB,
  equipos: Equipos,
  eventos: EventoDB[],
  modo: ModoCierreVoleibol,
): ResultadoCalculado {
  if (deporte === "FUTBOL") {
    const local = calcularMarcadorFutbol(eventos, equipos.local);

    const visitante = calcularMarcadorFutbol(eventos, equipos.visitante);

    return {
      local,
      visitante,
      ganadorEquipoID:
        local === visitante
          ? null
          : local > visitante
            ? equipos.local
            : equipos.visitante,
      observaciones: null,
      modoCierre: null,
      volei: null,
    };
  }

  let estado: EstadoVoleibol;

  try {
    estado = calcularEstadoVoleibol(
      eventos,
      equipos.local,
      equipos.visitante,
      reglasVoleibol(acta),
    );
  } catch (error) {
    const mensaje =
      error instanceof Error
        ? error.message
        : "L'historial de punts no és vàlid.";

    throw new ErrorAPI(409, `No es pot finalitzar l'acta: ${mensaje}`);
  }

  const evaluacion = evaluarCierreVoleibol(estado, modo);

  if (!evaluacion.permitido || !evaluacion.ganadorEquipoID) {
    throw new ErrorAPI(409, evaluacion.mensaje);
  }

  // La columna observaciones es TEXT.
  // JSON serializado conserva los sets y la modalidad sin
  // crear tablas ni asumir nuevos valores del enum resultado_tipo.
  const observaciones = JSON.stringify({
    deporte: "VOLEIBOL",
    modoCierre: modo,

    sets: estado.setsFinalizados.map((set) => ({
      numero: set.numero,
      tipo: set.tipo,
      puntosLocal: set.puntosLocal,
      puntosVisitante: set.puntosVisitante,
      ganadorEquipoID: set.ganadorEquipoID,
    })),

    setEnCurso:
      estado.setActual &&
      estado.historial.some((p) => p.numeroSet === estado.setActual?.numero)
        ? {
            numero: estado.setActual.numero,
            tipo: estado.setActual.tipo,
            puntosLocal: estado.setActual.puntosLocal,
            puntosVisitante: estado.setActual.puntosVisitante,
          }
        : null,

    puntosTotalesLocal: estado.puntosTotalesLocal,
    puntosTotalesVisitante: estado.puntosTotalesVisitante,
    ganadorEquipoID: evaluacion.ganadorEquipoID,
  });

  return {
    local: evaluacion.marcadorLocal,
    visitante: evaluacion.marcadorVisitante,
    ganadorEquipoID: evaluacion.ganadorEquipoID,
    observaciones,
    modoCierre: modo,
    volei: estado,
  };
}

function reconocerCodigoFutbol(valor: string): CodigoFutbol | null {
  const codigo = normalizar(valor);

  for (const clave of Object.keys(CODIGOS_FUTBOL) as CodigoFutbol[]) {
    if (CODIGOS_FUTBOL[clave].has(codigo)) {
      return clave;
    }
  }

  return null;
}

function reconocerCodigoVoleibol(valor: string): CodigoVoleibol | null {
  const codigo = normalizar(valor);

  for (const clave of Object.keys(CODIGOS_VOLEIBOL) as CodigoVoleibol[]) {
    if (CODIGOS_VOLEIBOL[clave].has(codigo)) {
      return clave;
    }
  }

  return null;
}

function sumarEstadisticaFutbol(
  codigo: CodigoFutbol,
  eventos: EventoDB[],
  predicado: (evento: EventoDB) => boolean,
): number {
  return eventos.reduce((total, evento) => {
    if (evento.estado !== "ACTIVO" || !predicado(evento)) {
      return total;
    }

    if (codigo === "GOL") {
      return (
        total +
        (evento.tipo_evento === "GOL" ||
        evento.tipo_evento === "PENALTI_MARCADO"
          ? 1
          : 0)
      );
    }

    return total + (evento.tipo_evento === codigo ? 1 : 0);
  }, 0);
}

function sumarEstadisticaVoleibol(
  codigo: CodigoVoleibol,
  eventos: EventoDB[],
  predicado: (evento: EventoDB) => boolean,
): number {
  return eventos.reduce((total, evento) => {
    if (evento.estado !== "ACTIVO" || !predicado(evento)) {
      return total;
    }

    if (codigo === "PUNTOS") {
      // Un error no acredita un punto al jugador que lo cometió.
      return total + (evento.tipo_evento !== "ERROR" ? 1 : 0);
    }

    if (codigo === "SETS") return total;

    return total + (evento.tipo_evento === codigo ? 1 : 0);
  }, 0);
}

async function guardarEstadisticas(
  partidoID: string,
  edicionID: string,
  deporte: Deporte,
  equipos: Equipos,
  eventos: EventoDB[],
  estadoVoleibol: EstadoVoleibol | null,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("competicion_estadisticas")
    .select(SELECT_ESTADISTICAS)
    .eq("edicion_id", edicionID)
    .eq("activa", true);

  if (error) throw error;

  for (const definicion of (data ?? []) as EstadisticaDB[]) {
    const codigoF =
      deporte === "FUTBOL" ? reconocerCodigoFutbol(definicion.codigo) : null;

    const codigoV =
      deporte === "VOLEIBOL"
        ? reconocerCodigoVoleibol(definicion.codigo)
        : null;

    if (!codigoF && !codigoV) continue;

    // Estadísticas por equipo.
    if (definicion.ambito === "EQUIPO") {
      const filas = [equipos.local, equipos.visitante].map((equipoID) => {
        let valor: number;

        if (codigoF) {
          valor = sumarEstadisticaFutbol(
            codigoF,
            eventos,
            (e) => e.equipo_id === equipoID,
          );
        } else if (codigoV === "PUNTOS" && estadoVoleibol) {
          valor =
            equipoID === equipos.local
              ? estadoVoleibol.puntosTotalesLocal
              : estadoVoleibol.puntosTotalesVisitante;
        } else if (codigoV === "SETS" && estadoVoleibol) {
          valor =
            equipoID === equipos.local
              ? estadoVoleibol.setsGanadosLocal
              : estadoVoleibol.setsGanadosVisitante;
        } else {
          valor = sumarEstadisticaVoleibol(
            codigoV!,
            eventos,
            (e) => e.equipo_id === equipoID,
          );
        }

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

      if (errorUpsert) throw errorUpsert;

      continue;
    }

    // Estadísticas por jugador.
    if (definicion.ambito !== "INDIVIDUAL" || codigoV === "SETS") {
      continue;
    }

    const { error: errorDelete } = await supabaseAdmin
      .from("competicion_estadisticas_individuales")
      .delete()
      .eq("partido_id", partidoID)
      .eq("estadistica_id", definicion.id);

    if (errorDelete) throw errorDelete;

    const participantes = new Map<string, string>();

    for (const evento of eventos) {
      if (evento.estado === "ACTIVO" && evento.jugador_id && evento.equipo_id) {
        participantes.set(evento.jugador_id, evento.equipo_id);
      }
    }

    const filas = [] as Array<{
      partido_id: string;
      edicion_id: string;
      equipo_id: string;
      participante_id: string;
      estadistica_id: string;
      ambito: string;
      valor: number;
    }>;

    for (const [participanteID, equipoID] of participantes) {
      const predicado = (e: EventoDB) => e.jugador_id === participanteID;

      const valor = codigoF
        ? sumarEstadisticaFutbol(codigoF, eventos, predicado)
        : sumarEstadisticaVoleibol(codigoV!, eventos, predicado);

      if (valor === 0) continue;

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

    if (filas.length > 0) {
      const { error: errorInsert } = await supabaseAdmin
        .from("competicion_estadisticas_individuales")
        .insert(filas);

      if (errorInsert) throw errorInsert;
    }
  }
}

async function confirmarResultado(
  partidoID: string,
  edicionID: string,
  resultado: ResultadoCalculado,
): Promise<ResultadoDB> {
  const { data, error } = await supabaseAdmin
    .from("competicion_resultados")
    .select(SELECT_RESULTADO)
    .eq("partido_id", partidoID)
    .eq("edicion_id", edicionID)
    .eq("confirmado", true)
    .order("confirmado_at", {
      ascending: false,
    });

  if (error) throw error;

  const existentes = (data ?? []) as ResultadoDB[];

  if (existentes.length > 0) {
    const actual = existentes[0];

    if (
      actual.marcador_local !== resultado.local ||
      actual.marcador_visitante !== resultado.visitante ||
      actual.ganador_equipo_id !== resultado.ganadorEquipoID ||
      (resultado.observaciones !== null &&
        actual.observaciones !== resultado.observaciones)
    ) {
      throw new ErrorAPI(
        409,
        "El partit ja té un resultat confirmat diferent del calculat per l'acta.",
      );
    }

    return actual;
  }

  const ahora = new Date().toISOString();

  const { data: nuevo, error: errorInsert } = await supabaseAdmin
    .from("competicion_resultados")
    .insert({
      partido_id: partidoID,
      edicion_id: edicionID,
      marcador_local: resultado.local,
      marcador_visitante: resultado.visitante,
      ganador_equipo_id: resultado.ganadorEquipoID,

      // Se conserva el valor aceptado por el sistema actual.
      // El modo forzado está en observaciones.
      resultado_tipo: "NORMAL",

      confirmado: true,
      confirmado_at: ahora,
      observaciones: resultado.observaciones,
    })
    .select(SELECT_RESULTADO)
    .single();

  if (errorInsert) throw errorInsert;

  return nuevo as ResultadoDB;
}

async function resolverSiguientePartido(
  partidoID: string,
  resultado: ResultadoDB,
  equipos: Equipos,
) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_DEPENDENCIAS)
    .eq("origen_partido_id", partidoID)
    .in("origen_tipo", ["GANADOR_PARTIDO", "PERDEDOR_PARTIDO"]);

  if (error) throw error;

  const plazas = (data ?? []) as PlazaDependienteDB[];

  if (plazas.length === 0) {
    return {
      plazasActualizadas: 0,
      ganadorEquipoID: resultado.ganador_equipo_id,
      perdedorEquipoID: null,
    };
  }

  const ganadorEquipoID = resultado.ganador_equipo_id;

  if (!ganadorEquipoID) {
    throw new ErrorAPI(
      409,
      "El partit alimenta un altre partit però no té cap guanyador resolt.",
    );
  }

  const perdedorEquipoID =
    ganadorEquipoID === equipos.local
      ? equipos.visitante
      : ganadorEquipoID === equipos.visitante
        ? equipos.local
        : null;

  if (!perdedorEquipoID) {
    throw new ErrorAPI(
      409,
      "El guanyador no correspon a cap dels equips del partit.",
    );
  }

  const ahora = new Date().toISOString();

  for (const origen of ["GANADOR_PARTIDO", "PERDEDOR_PARTIDO"] as const) {
    const ids = plazas
      .filter((plaza) => plaza.origen_tipo === origen)
      .map((plaza) => plaza.id);

    if (ids.length === 0) continue;

    const { error: errorUpdate } = await supabaseAdmin
      .from("competicion_plazas")
      .update({
        equipo_resuelto_id:
          origen === "GANADOR_PARTIDO" ? ganadorEquipoID : perdedorEquipoID,
        resuelta_at: ahora,
      })
      .in("id", ids);

    if (errorUpdate) throw errorUpdate;
  }

  return {
    plazasActualizadas: plazas.length,
    ganadorEquipoID,
    perdedorEquipoID,
  };
}

async function finalizarActa(usuario: Usuario, acta: ActaDB): Promise<string> {
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

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(
      409,
      "El control de l'acta ha canviat mentre es finalitzava.",
    );
  }

  return data.finalizada_at as string;
}

async function finalizarPartidoDB(
  partido: PartidoDB,
  finalizadaAt: string,
): Promise<string> {
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

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(409, "No s'ha pogut marcar el partit com a finalitzat.");
  }

  return data.finalizado_at as string;
}

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

    const deporte = leerDeporte(acta.deporte);

    const modoCierre = leerModoCierre(contenido.modoCierre, deporte);

    if (
      deporte === "VOLEIBOL" &&
      modoCierre === "FORZADO_PUNTOS" &&
      contenido.confirmarCierreForzado !== true
    ) {
      throw new ErrorAPI(
        400,
        "Has de confirmar expressament el tancament forçat de l'acta.",
      );
    }

    // Nunca aceptar el marcador ni el ganador del navegador.
    // El servidor vuelve a calcularlos desde las jugadas.
    const [equipos, eventos] = await Promise.all([
      obtenerEquipos(partidoID),
      obtenerEventos(acta.id),
    ]);

    const calculado = calcularResultado(
      deporte,
      acta,
      equipos,
      eventos,
      modoCierre,
    );

    await guardarEstadisticas(
      partidoID,
      partido.edicion_id,
      deporte,
      equipos,
      eventos,
      calculado.volei,
    );

    const resultado = await confirmarResultado(
      partidoID,
      partido.edicion_id,
      calculado,
    );

    const propagacion = await resolverSiguientePartido(
      partidoID,
      resultado,
      equipos,
    );

    const finalizadaAt = await finalizarActa(usuario, acta);

    const partidoFinalizadoAt = await finalizarPartidoDB(partido, finalizadaAt);

    // Contrato requerido por eliminarActaLocalTrasFinalizacion().
    // La copia local solo se elimina tras recibir esta confirmación.
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
        local: calculado.local,
        visitante: calculado.visitante,
        ganadorEquipoID: resultado.ganador_equipo_id,

        ...(calculado.volei
          ? {
              deporte: "VOLEIBOL",
              modoCierre: calculado.modoCierre,
              sets: calculado.volei.setsFinalizados,
              setEnCurso: calculado.volei.setActual,
              puntosTotalesLocal: calculado.volei.puntosTotalesLocal,
              puntosTotalesVisitante: calculado.volei.puntosTotalesVisitante,
            }
          : {}),
      },

      propagacion,
    });
  } catch (error) {
    return responderError(error);
  }
};
