import type { APIRoute, AstroCookies } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

import { exigirPartidoDesignadoVoluntariat } from "@utils/voluntariat/acceso";

import { obtenerAccesoActa } from "@utils/acta/acceso";

import {
  calcularEstadoVoleibol,
  normalizarConfiguracionVoleibol,
  TIPOS_PUNTO_VOLEIBOL,
  type ConfiguracionVoleibol,
  type TipoPuntoVoleibol,
} from "@utils/acta/voleibol";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;
type Registro = Record<string, unknown>;

type DeporteActa = "FUTBOL" | "VOLEIBOL";
type AccionOperacion = "CREAR" | "ANULAR";

type TipoEventoFutbol =
  | "GOL"
  | "TARJETA_AMARILLA"
  | "TARJETA_ROJA"
  | "PENALTI_MARCADO"
  | "PENALTI_FALLADO";

type TipoEvento = TipoEventoFutbol | TipoPuntoVoleibol;

type EdicionDB = {
  id: string;
  torneo_id: string | null;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  estado: string;
  finalizado_at: string | null;
};

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;
  deporte: string;

  estado: string;
  estado_operativo: string;
  bloqueada_at: string | null;

  controlador_id: string | null;
  control_token: string | null;
  control_generacion: number;

  secuencia_eventos: number;
  version: number;
  updated_at: string;

  configuracion_snapshot: Registro | null;
};

type EventoDB = {
  id: string;
  acta_id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;
  deporte: string;

  cliente_evento_id: string;
  orden: number;
  tipo_evento: string;

  equipo_id: string | null;
  equipo_nombre: string | null;
  jugador_id: string | null;
  jugador_nombre: string | null;

  periodo: number | null;
  tiempo_juego_segundos: number | null;
  datos: Registro | null;

  estado: string;
  evento_relacionado_id: string | null;

  creado_por: string | null;
  creado_por_nombre: string | null;
  created_at: string;

  anulado_at: string | null;
  anulado_por: string | null;
  motivo_anulacion: string | null;
};

type PlazaDB = {
  lado: "LOCAL" | "VISITANTE" | null;
  equipo_resuelto_id: string | null;
};

type EquipoDB = {
  id: string;
  nombre: string | null;
};

type ParticipanteDB = {
  id: string;
  equipo_id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  tipo_participante: string | null;
  activo: boolean | null;
};

type ContextoParticipantes = {
  equipos: Map<string, EquipoDB>;
  participantes: Map<string, ParticipanteDB>;
  equipoLocalID: string | null;
  equipoVisitanteID: string | null;
};

type ResultadoOperacion = {
  success: boolean;
  accion: AccionOperacion;
  clienteEventoID: string | null;
  reutilizado: boolean;
  evento: EventoDB | null;
  mensaje: string | null;
};

type PermisoActa = {
  puedeConsultar: boolean;
  puedeEditar: boolean;
  puedeEscribir: boolean;
};

// ============================================================
// CONSULTAS
// ============================================================

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at" as const;

const SELECT_EDICION = "id,torneo_id" as const;

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,estado_operativo,bloqueada_at,controlador_id,control_token,control_generacion,secuencia_eventos,version,updated_at,configuracion_snapshot" as const;

const SELECT_EVENTO =
  "id,acta_id,partido_id,torneo_id,edicion_id,deporte,cliente_evento_id,orden,tipo_evento,equipo_id,equipo_nombre,jugador_id,jugador_nombre,periodo,tiempo_juego_segundos,datos,estado,evento_relacionado_id,creado_por,creado_por_nombre,created_at,anulado_at,anulado_por,motivo_anulacion" as const;

const MAX_OPERACIONES_LOTE = 250;

const TIPOS_EVENTO_FUTBOL: readonly TipoEventoFutbol[] = [
  "GOL",
  "TARJETA_AMARILLA",
  "TARJETA_ROJA",
  "PENALTI_MARCADO",
  "PENALTI_FALLADO",
];

// ============================================================
// ERRORES
// ============================================================

function responderError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error gestionant els esdeveniments de l'acta:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'han pogut gestionar les jugades de l'acta.",
    },
    500,
  );
}

// ============================================================
// VALIDACIONES
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
  if (valor === null || valor === undefined) {
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
    throw new ErrorAPI(400, `El camp ${nombre} és massa llarg.`);
  }

  return limpio;
}

function enteroOpcional(
  valor: unknown,
  nombre: string,
  minimo: number,
  maximo: number,
): number | null {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = typeof valor === "number" ? valor : Number(valor);

  if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  return numero;
}

function fechaOpcional(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor) {
    return null;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

function normalizarDeporte(valor: string | null): string {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? ""
  );
}

function leerDeporte(valor: string | null): DeporteActa {
  const deporte = normalizarDeporte(valor);

  if (deporte !== "FUTBOL" && deporte !== "VOLEIBOL") {
    throw new ErrorAPI(
      409,
      "Aquesta acta encara no admet jugades per aquest esport.",
    );
  }

  return deporte;
}

function leerTipoEvento(valor: unknown, deporte: DeporteActa): TipoEvento {
  const tipo = texto(valor, "tipus d'esdeveniment", 50, true).toUpperCase();

  if (
    deporte === "FUTBOL" &&
    TIPOS_EVENTO_FUTBOL.includes(tipo as TipoEventoFutbol)
  ) {
    return tipo as TipoEventoFutbol;
  }

  if (
    deporte === "VOLEIBOL" &&
    TIPOS_PUNTO_VOLEIBOL.includes(tipo as TipoPuntoVoleibol)
  ) {
    return tipo as TipoPuntoVoleibol;
  }

  throw new ErrorAPI(
    400,
    "El tipus d'esdeveniment no és vàlid per aquest esport.",
  );
}

function leerAccion(valor: unknown): AccionOperacion {
  const accion = texto(valor, "acció", 20, true).toUpperCase();

  if (accion !== "CREAR" && accion !== "ANULAR") {
    throw new ErrorAPI(400, "L'acció de la jugada no és vàlida.");
  }

  return accion;
}

function nombreParticipante(participante: ParticipanteDB): string | null {
  return (
    [participante.nombre, participante.apellido1, participante.apellido2]
      .filter(
        (parte): parte is string =>
          typeof parte === "string" && Boolean(parte.trim()),
      )
      .join(" ") || null
  );
}

// ============================================================
// CONFIGURACIÓN DE VOLEIBOL
// ============================================================

function reglasVoleibolActa(acta: ActaDB): ConfiguracionVoleibol {
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

    if (valor === undefined || valor === null) {
      continue;
    }

    if (typeof valor !== "number") {
      throw new ErrorAPI(
        409,
        "La configuració de voleibol de l'acta no és vàlida.",
      );
    }

    entrada[campo] = valor;
  }

  try {
    return normalizarConfiguracionVoleibol(entrada);
  } catch {
    throw new ErrorAPI(
      409,
      "La configuració de voleibol de l'acta no és vàlida.",
    );
  }
}

// ============================================================
// AUTORIZACIÓN: ADMINISTRACIÓN O VOLUNTARIADO
// ============================================================

async function autorizarActa(
  usuario: Usuario,
  cookies: AstroCookies,
  torneoID: string,
  edicionID: string,
  partidoID: string,
  escritura: boolean,
): Promise<PermisoActa> {
  const administradorLector =
    tieneAccesoTorneo(usuario, torneoID) &&
    tienePermiso(usuario, "panell", "ver", torneoID) &&
    tienePermiso(usuario, "partits", "ver", torneoID);

  const administradorEditor =
    administradorLector && tienePermiso(usuario, "partits", "editar", torneoID);

  // Quien tiene permisos de edición del panel
  // conserva el funcionamiento administrativo.

  if (administradorEditor) {
    return {
      puedeConsultar: true,
      puedeEditar: true,
      puedeEscribir: true,
    };
  }

  // Un administrador que solo puede consultar
  // también podría estar designado como voluntario.
  // Se comprueba esa posibilidad antes de devolver
  // únicamente permisos de lectura.

  try {
    const designacion = await exigirPartidoDesignadoVoluntariat(
      cookies,
      torneoID,
      edicionID,
      partidoID,
    );

    if (
      designacion.usuario.id !== usuario.id ||
      !designacion.funciones.some(
        (funcion) => funcion === "ARBITRE" || funcion === "OFICIAL_TAULA",
      )
    ) {
      throw new ErrorAPI(
        403,
        "No tens cap designació activa en aquest partit.",
      );
    }

    const acceso = await obtenerAccesoActa({
      usuario,
      torneoID,
      edicionID,
      partidoID,
    });

    if (
      !acceso.voluntarioConfirmado ||
      (!acceso.designadoArbitro && !acceso.designadoOficial)
    ) {
      throw new ErrorAPI(
        403,
        "Necessites una designació confirmada com a àrbitre o oficial de taula.",
      );
    }

    if (!acceso.puedeConsultar || acceso.bloqueadoAcceso) {
      throw new ErrorAPI(403, "No tens permís per consultar aquesta acta.");
    }

    if (escritura) {
      if (acceso.bloqueadoControl) {
        throw new ErrorAPI(
          423,
          "El control de l'acta està bloquejat per l'organització.",
        );
      }

      if (acceso.actaFinalizada || acceso.revisionActiva) {
        throw new ErrorAPI(
          409,
          "L'acta no està disponible per registrar jugades.",
        );
      }

      if (!acceso.puedeEscribir) {
        throw new ErrorAPI(
          403,
          "No tens el control necessari per modificar aquesta acta.",
        );
      }
    }

    return {
      puedeConsultar: true,
      puedeEditar: acceso.puedeControlar,
      puedeEscribir: acceso.puedeEscribir,
    };
  } catch (error) {
    // Un administrador con permiso de lectura
    // no pierde ese permiso si carece de
    // designación de voluntariado.
    //
    // No se utiliza esta excepción para
    // concederle permiso de escritura.

    if (
      administradorLector &&
      !escritura &&
      error instanceof ErrorAPI &&
      error.estado === 403
    ) {
      return {
        puedeConsultar: true,
        puedeEditar: false,
        puedeEscribir: false,
      };
    }

    throw error;
  }
}

// ============================================================
// CONTEXTO DEL PARTIDO Y DEL ACTA
// ============================================================

async function obtenerContexto(
  usuario: Usuario,
  cookies: AstroCookies,
  partidoID: string,
  escritura: boolean,
) {
  const { data: partidoData, error: errorPartido } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .maybeSingle();

  if (errorPartido) {
    throw errorPartido;
  }

  const partido = partidoData as PartidoDB | null;

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  const { data: edicionData, error: errorEdicion } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", partido.edicion_id)
    .maybeSingle();

  if (errorEdicion) {
    throw errorEdicion;
  }

  const edicion = edicionData as EdicionDB | null;

  if (!edicion) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició del partit.");
  }

  const torneoID = identificador(edicion.torneo_id, "torneig");

  const permisos = await autorizarActa(
    usuario,
    cookies,
    torneoID,
    edicion.id,
    partidoID,
    escritura,
  );

  if (!permisos.puedeConsultar) {
    throw new ErrorAPI(403, "No tens permís per consultar aquesta acta.");
  }

  if (escritura && !permisos.puedeEscribir) {
    throw new ErrorAPI(403, "No tens permís per modificar aquesta acta.");
  }

  const { data: actaData, error: errorActa } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (errorActa) {
    throw errorActa;
  }

  const acta = actaData as ActaDB | null;

  if (!acta) {
    throw new ErrorAPI(409, "L'acta encara no està iniciada.");
  }

  if (
    acta.partido_id !== partidoID ||
    acta.edicion_id !== partido.edicion_id ||
    acta.torneo_id !== torneoID
  ) {
    throw new ErrorAPI(409, "L'acta no correspon al partit seleccionat.");
  }

  return {
    torneoID,
    partido,
    edicion,
    acta,
    permisos,
  };
}

// ============================================================
// VALIDACIÓN DEL CONTROL
// ============================================================

function exigirControl(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  controlToken: string,
): void {
  if (
    partido.estado === "FINALIZADO" ||
    partido.estado === "CANCELADO" ||
    partido.finalizado_at
  ) {
    throw new ErrorAPI(409, "Aquest partit no admet més jugades.");
  }

  if (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null) {
    throw new ErrorAPI(423, "L'acta està bloquejada per l'organització.");
  }

  if (
    acta.estado !== "EN_CURSO" ||
    !["CONTROLADA", "EN_SUPERVISION"].includes(acta.estado_operativo)
  ) {
    throw new ErrorAPI(423, "L'acta no està disponible per escriure.");
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

// ============================================================
// REVALIDACIÓN CONTRA SUPABASE
// ============================================================

async function verificarControlActual(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  controlToken: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(
      "id,estado,estado_operativo,bloqueada_at,controlador_id,control_token,control_generacion,version",
    )
    .eq("id", acta.id)
    .eq("partido_id", partido.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "L'acta ja no està disponible.");
  }

  if (
    data.version !== acta.version ||
    data.control_generacion !== acta.control_generacion
  ) {
    throw new ErrorAPI(
      409,
      "L'acta ha canviat al servidor. Actualitza les jugades.",
    );
  }

  exigirControl(
    usuario,
    partido,
    {
      ...acta,
      ...data,
    },
    controlToken,
  );
}

// ============================================================
// REALTIME
// ============================================================

async function notificarCambios(
  partidoID: string,
  edicionID: string,
): Promise<void> {
  const canales = [
    `acta-jugades-partit-${partidoID}`,
    `actes-actives-edicio-${edicionID}`,
  ];

  await Promise.all(
    canales.map(async (nombreCanal) => {
      const canal = supabaseAdmin.channel(nombreCanal);

      try {
        await canal.httpSend("actualitzada", {});
      } catch (error) {
        console.error(`Error enviant l'avís Realtime (${nombreCanal}):`, error);
      } finally {
        try {
          await supabaseAdmin.removeChannel(canal);
        } catch (error) {
          console.error(`Error tancant el canal (${nombreCanal}):`, error);
        }
      }
    }),
  );
}

// ============================================================
// CONSULTAR EVENTOS
// ============================================================

async function obtenerEventos(actaID: string): Promise<EventoDB[]> {
  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .select(SELECT_EVENTO)
    .eq("acta_id", actaID)
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as EventoDB[];
}

async function obtenerEventoPorCliente(
  actaID: string,
  clienteEventoID: string,
): Promise<EventoDB | null> {
  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .select(SELECT_EVENTO)
    .eq("acta_id", actaID)
    .eq("cliente_evento_id", clienteEventoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as EventoDB | null;
}

// ============================================================
// PARTICIPANTES DEL PARTIDO
// ============================================================

async function obtenerParticipantesPartido(
  partidoID: string,
): Promise<ContextoParticipantes> {
  const { data: plazasData, error: plazasError } = await supabaseAdmin
    .from("competicion_plazas")
    .select("lado,equipo_resuelto_id")
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (plazasError) {
    throw plazasError;
  }

  const plazas = (plazasData ?? []) as PlazaDB[];

  const equipoLocalID =
    plazas.find((p) => p.lado === "LOCAL")?.equipo_resuelto_id ?? null;

  const equipoVisitanteID =
    plazas.find((p) => p.lado === "VISITANTE")?.equipo_resuelto_id ?? null;

  const equiposIDs = Array.from(
    new Set(
      plazas
        .map((p) => p.equipo_resuelto_id)
        .filter((id): id is string => typeof id === "string" && UUID.test(id))
        .map((id) => id.trim().toLowerCase()),
    ),
  );

  if (equiposIDs.length === 0) {
    return {
      equipos: new Map(),
      participantes: new Map(),
      equipoLocalID,
      equipoVisitanteID,
    };
  }

  const [respuestaEquipos, respuestaParticipantes] = await Promise.all([
    supabaseAdmin.from("equipos").select("id,nombre").in("id", equiposIDs),

    supabaseAdmin
      .from("participantes_equipo")
      .select(
        "id,equipo_id,nombre,apellido1,apellido2,tipo_participante,activo",
      )
      .in("equipo_id", equiposIDs)
      .eq("tipo_participante", "JUGADOR")
      .eq("activo", true),
  ]);

  if (respuestaEquipos.error) {
    throw respuestaEquipos.error;
  }

  if (respuestaParticipantes.error) {
    throw respuestaParticipantes.error;
  }

  return {
    equipos: new Map(
      ((respuestaEquipos.data ?? []) as EquipoDB[]).map((e) => [e.id, e]),
    ),

    participantes: new Map(
      ((respuestaParticipantes.data ?? []) as ParticipanteDB[]).map((p) => [
        p.id,
        p,
      ]),
    ),

    equipoLocalID,
    equipoVisitanteID,
  };
}

// ============================================================
// ORDEN DE EVENTOS
// ============================================================

async function obtenerOrdenMaximo(acta: ActaDB): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .select("orden")
    .eq("acta_id", acta.id)
    .order("orden", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Math.max(
    typeof data?.orden === "number" ? data.orden : 0,
    acta.secuencia_eventos ?? 0,
  );
}

function codigoErrorSupabase(error: unknown): string | null {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

// ============================================================
// VALIDACIÓN DE PUNTOS DE VOLEIBOL
// ============================================================

function validarPuntoVoleibol(
  acta: ActaDB,
  entrada: Registro,
  eventos: Map<string, EventoDB>,
  contexto: ContextoParticipantes,
): number {
  if (
    !contexto.equipoLocalID ||
    !contexto.equipoVisitanteID ||
    contexto.equipoLocalID === contexto.equipoVisitanteID
  ) {
    throw new ErrorAPI(
      409,
      "El partit ha de tenir dos equips diferents i resolts.",
    );
  }

  let estado: ReturnType<typeof calcularEstadoVoleibol>;

  try {
    estado = calcularEstadoVoleibol(
      [...eventos.values()],
      contexto.equipoLocalID,
      contexto.equipoVisitanteID,
      reglasVoleibolActa(acta),
    );
  } catch (error) {
    console.error("Historial de voleibol inconsistent:", error);

    throw new ErrorAPI(
      409,
      "L'historial de punts necessita revisió abans d'afegir jugades.",
    );
  }

  if (estado.finalizadoPorSets || !estado.setActual) {
    throw new ErrorAPI(
      409,
      "El partit ja té un guanyador per sets; no es poden afegir més punts.",
    );
  }

  const periodoSolicitado = enteroOpcional(entrada.periodo, "set", 1, 100);

  if (
    periodoSolicitado !== null &&
    periodoSolicitado !== estado.setActual.numero
  ) {
    throw new ErrorAPI(
      409,
      `Aquesta jugada correspon al set ${estado.setActual.numero}. Revisa la sincronització.`,
    );
  }

  return estado.setActual.numero;
}

// ============================================================
// INSERTAR EVENTO
// ============================================================

async function insertarEvento(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  controlToken: string,
  entrada: Registro,
  contexto: ContextoParticipantes,
  ordenInicial: number,
  eventos: Map<string, EventoDB>,
  deporte: DeporteActa,
) {
  const clienteEventoID = identificador(
    entrada.clienteEventoID,
    "esdeveniment",
  );

  const existente = await obtenerEventoPorCliente(acta.id, clienteEventoID);

  if (existente) {
    return {
      evento: existente,
      reutilizado: true,
      orden: Math.max(ordenInicial, existente.orden),
      modificado: false,
    };
  }

  const tipoEvento = leerTipoEvento(entrada.tipoEvento, deporte);

  const equipoID = identificador(entrada.equipoID, "equip");

  // Se conserva la atribución del jugador,
  // también para las jugadas de error.

  const jugadorID = identificador(entrada.jugadorID, "jugador");

  const equipo = contexto.equipos.get(equipoID);

  if (!equipo) {
    throw new ErrorAPI(
      400,
      "L'equip de la jugada no participa en aquest partit.",
    );
  }

  const participante = contexto.participantes.get(jugadorID);

  if (!participante || participante.equipo_id !== equipoID) {
    throw new ErrorAPI(400, "El jugador no pertany a l'equip indicat.");
  }

  const minuto = enteroOpcional(entrada.minuto, "minut", 0, 200);

  const tiempoJuegoSegundos = enteroOpcional(
    entrada.tiempoJuegoSegundos,
    "temps de joc",
    0,
    86400,
  );

  const datosEntrada = esRegistro(entrada.datos) ? entrada.datos : {};

  const createdAt =
    fechaOpcional(entrada.createdAt) ?? new Date().toISOString();

  let ultimoOrden = ordenInicial;

  for (let intento = 0; intento < 5; intento++) {
    const periodo =
      deporte === "VOLEIBOL"
        ? validarPuntoVoleibol(acta, entrada, eventos, contexto)
        : enteroOpcional(entrada.periodo, "període", 0, 100);

    const datos =
      deporte === "FUTBOL"
        ? {
            ...datosEntrada,
            minuto,
          }
        : {
            ...datosEntrada,

            equipoPuntuaID:
              tipoEvento === "ERROR"
                ? contexto.equipoLocalID === equipoID
                  ? contexto.equipoVisitanteID
                  : contexto.equipoLocalID
                : equipoID,
          };

    const orden = ultimoOrden + 1;

    // Revalidación del bloqueo y del token.

    await verificarControlActual(usuario, partido, acta, controlToken);

    const { data, error } = await supabaseAdmin
      .from("acta_eventos")
      .insert({
        acta_id: acta.id,
        partido_id: acta.partido_id,
        torneo_id: acta.torneo_id,
        edicion_id: acta.edicion_id,
        deporte: acta.deporte,

        cliente_evento_id: clienteEventoID,

        orden,
        tipo_evento: tipoEvento,

        equipo_id: equipoID,
        equipo_nombre: equipo.nombre ?? null,

        jugador_id: jugadorID,
        jugador_nombre: nombreParticipante(participante),

        periodo,
        tiempo_juego_segundos: tiempoJuegoSegundos,

        datos,

        estado: "ACTIVO",
        evento_relacionado_id: null,

        creado_por: usuario.id,
        creado_por_nombre: null,
        created_at: createdAt,

        anulado_at: null,
        anulado_por: null,
        motivo_anulacion: null,
      })
      .select(SELECT_EVENTO)
      .single();

    if (!error && data) {
      return {
        evento: data as EventoDB,
        reutilizado: false,
        orden,
        modificado: true,
      };
    }

    if (codigoErrorSupabase(error) === "23505") {
      const duplicado = await obtenerEventoPorCliente(acta.id, clienteEventoID);

      if (duplicado) {
        return {
          evento: duplicado,
          reutilizado: true,
          orden: Math.max(ultimoOrden, duplicado.orden),
          modificado: false,
        };
      }

      ultimoOrden = await obtenerOrdenMaximo(acta);

      // Refrescar el historial de voleibol
      // para calcular el set correcto.

      if (deporte === "VOLEIBOL") {
        eventos.clear();

        for (const evento of await obtenerEventos(acta.id)) {
          eventos.set(evento.cliente_evento_id, evento);
        }
      }

      continue;
    }

    throw error;
  }

  throw new ErrorAPI(409, "No s'ha pogut assignar l'ordre de la jugada.");
}

// ============================================================
// ANULAR EVENTO
// ============================================================

async function anularEvento(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  controlToken: string,
  entrada: Registro,
  eventos: Map<string, EventoDB>,
) {
  const clienteEventoID = identificador(
    entrada.clienteEventoID,
    "esdeveniment",
  );

  let evento = eventos.get(clienteEventoID) ?? null;

  if (!evento) {
    evento = await obtenerEventoPorCliente(acta.id, clienteEventoID);
  }

  if (!evento) {
    throw new ErrorAPI(
      409,
      "La jugada que vols anul·lar encara no existeix al servidor.",
    );
  }

  if (evento.estado === "ANULADO") {
    return {
      evento,
      reutilizado: true,
      modificado: false,
    };
  }

  const motivo = texto(entrada.motivoAnulacion, "motiu d'anul·lació", 1000);

  const anuladoAt =
    fechaOpcional(entrada.anuladoAt) ?? new Date().toISOString();

  await verificarControlActual(usuario, partido, acta, controlToken);

  const { data, error } = await supabaseAdmin
    .from("acta_eventos")
    .update({
      estado: "ANULADO",
      anulado_at: anuladoAt,
      anulado_por: usuario.id,
      motivo_anulacion: motivo || null,
    })
    .eq("id", evento.id)
    .eq("acta_id", acta.id)
    .eq("estado", "ACTIVO")
    .select(SELECT_EVENTO)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const actual = await obtenerEventoPorCliente(acta.id, clienteEventoID);

    if (actual?.estado === "ANULADO") {
      return {
        evento: actual,
        reutilizado: true,
        modificado: false,
      };
    }

    throw new ErrorAPI(409, "La jugada ha canviat mentre s'anul·lava.");
  }

  return {
    evento: data as EventoDB,
    reutilizado: false,
    modificado: true,
  };
}

// ============================================================
// ERRORES DE OPERACIÓN
// ============================================================

function mensajeErrorOperacion(error: unknown): string {
  if (error instanceof ErrorAPI) {
    return error.message;
  }

  console.error("Error processant una operació de l'acta:", error);

  return "No s'ha pogut guardar aquesta jugada.";
}

// ============================================================
// GET — CONSULTAR HISTORIAL
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    const partidoID = identificador(
      url.searchParams.get("partidoID"),
      "partit",
    );

    const { partido, acta, permisos } = await obtenerContexto(
      usuario,
      cookies,
      partidoID,
      false,
    );

    const eventos = await obtenerEventos(acta.id);

    const esControlador = acta.controlador_id === usuario.id;

    const bloqueada = Boolean(
      acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null,
    );

    const puedeEscribir = Boolean(
      permisos.puedeEscribir &&
      esControlador &&
      acta.estado === "EN_CURSO" &&
      ["CONTROLADA", "EN_SUPERVISION"].includes(acta.estado_operativo) &&
      !bloqueada &&
      partido.estado !== "FINALIZADO" &&
      partido.estado !== "CANCELADO" &&
      !partido.finalizado_at &&
      acta.control_token,
    );

    const respuesta = responder({
      success: true,

      servidorAhora: new Date().toISOString(),

      acta: {
        id: acta.id,

        estado: acta.estado,
        estadoOperativo: acta.estado_operativo,

        controlGeneracion: acta.control_generacion,

        version: acta.version,
        secuenciaEventos: acta.secuencia_eventos,

        updatedAt: acta.updated_at,
      },

      control: {
        puedeEscribir,

        controlToken: puedeEscribir ? acta.control_token : null,
      },

      eventos,
    });

    respuesta.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );

    return respuesta;
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// POST — REGISTRAR Y ANULAR JUGADAS
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  let huboCambios = false;

  let destinoRealtime: {
    partidoID: string;
    edicionID: string;
  } | null = null;

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

    if (!Array.isArray(contenido.operaciones)) {
      throw new ErrorAPI(400, "Falta la llista de jugades.");
    }

    if (contenido.operaciones.length === 0) {
      throw new ErrorAPI(400, "No hi ha cap jugada per enviar.");
    }

    if (contenido.operaciones.length > MAX_OPERACIONES_LOTE) {
      throw new ErrorAPI(
        400,
        `No es poden enviar més de ${MAX_OPERACIONES_LOTE} operacions a la vegada.`,
      );
    }

    // ========================================================
    // AUTORIZACIÓN ADMINISTRATIVA O POR DESIGNACIÓN
    // ========================================================

    const { torneoID, edicion, partido, acta } = await obtenerContexto(
      usuario,
      cookies,
      partidoID,
      true,
    );

    exigirControl(usuario, partido, acta, controlToken);

    destinoRealtime = {
      partidoID,
      edicionID: acta.edicion_id,
    };

    const deporte = leerDeporte(acta.deporte);

    const contexto = await obtenerParticipantesPartido(partidoID);

    const eventos = new Map<string, EventoDB>();

    for (const evento of await obtenerEventos(acta.id)) {
      eventos.set(evento.cliente_evento_id, evento);
    }

    let ultimoOrden = await obtenerOrdenMaximo(acta);

    const resultados: ResultadoOperacion[] = [];

    // ========================================================
    // ORDEN DE PROCESAMIENTO
    // ========================================================

    // Fútbol:
    // CREAR antes de ANULAR.
    //
    // Voleibol:
    // ANULAR primero los puntos existentes.
    //
    // Una jugada creada y anulada en el
    // mismo lote conserva CREAR -> ANULAR.

    const existentesAntesDelLote = new Set(eventos.keys());

    const prioridad = (valor: unknown): number => {
      if (!esRegistro(valor)) {
        return 3;
      }

      if (
        deporte === "VOLEIBOL" &&
        valor.accion === "ANULAR" &&
        typeof valor.clienteEventoID === "string" &&
        existentesAntesDelLote.has(valor.clienteEventoID.trim().toLowerCase())
      ) {
        return 0;
      }

      return valor.accion === "CREAR" ? 1 : 2;
    };

    const operaciones = [...contenido.operaciones].sort(
      (a, b) => prioridad(a) - prioridad(b),
    );

    // ========================================================
    // PROCESAR LOTE
    // ========================================================

    for (const entrada of operaciones) {
      // Comprobar que el gestor no haya
      // bloqueado el acta ni cambiado
      // su controlador o generación.

      await verificarControlActual(usuario, partido, acta, controlToken);

      if (!esRegistro(entrada)) {
        resultados.push({
          success: false,
          accion: "CREAR",
          clienteEventoID: null,
          reutilizado: false,
          evento: null,

          mensaje: "Una de les operacions no és vàlida.",
        });

        continue;
      }

      let accion: AccionOperacion = "CREAR";

      let clienteEventoID: string | null = null;

      try {
        accion = leerAccion(entrada.accion);

        // ====================================================
        // CREAR
        // ====================================================

        if (accion === "CREAR") {
          if (!esRegistro(entrada.evento)) {
            throw new ErrorAPI(400, "Les dades de la jugada no són vàlides.");
          }

          clienteEventoID = identificador(
            entrada.evento.clienteEventoID,
            "esdeveniment",
          );

          const resultado = await insertarEvento(
            usuario,
            partido,
            acta,
            controlToken,
            entrada.evento,
            contexto,
            ultimoOrden,
            eventos,
            deporte,
          );

          ultimoOrden = Math.max(ultimoOrden, resultado.orden);

          eventos.set(resultado.evento.cliente_evento_id, resultado.evento);

          if (resultado.modificado) {
            huboCambios = true;
          }

          resultados.push({
            success: true,
            accion,
            clienteEventoID,
            reutilizado: resultado.reutilizado,
            evento: resultado.evento,
            mensaje: null,
          });

          continue;
        }

        // ====================================================
        // ANULAR
        // ====================================================

        clienteEventoID = identificador(
          entrada.clienteEventoID,
          "esdeveniment",
        );

        const resultado = await anularEvento(
          usuario,
          partido,
          acta,
          controlToken,
          entrada,
          eventos,
        );

        eventos.set(resultado.evento.cliente_evento_id, resultado.evento);

        if (resultado.modificado) {
          huboCambios = true;
        }

        resultados.push({
          success: true,
          accion,
          clienteEventoID,
          reutilizado: resultado.reutilizado,
          evento: resultado.evento,
          mensaje: null,
        });
      } catch (error) {
        resultados.push({
          success: false,
          accion,
          clienteEventoID,
          reutilizado: false,
          evento: null,

          mensaje: mensajeErrorOperacion(error),
        });
      }
    }

    // ========================================================
    // ACTUALIZAR SECUENCIA Y VERSIÓN
    // ========================================================

    let version = acta.version;

    if (huboCambios) {
      // Volver a comprobar el permiso:
      // también detecta una designación
      // revocada durante el procesamiento.

      await autorizarActa(
        usuario,
        cookies,
        torneoID,
        edicion.id,
        partidoID,
        true,
      );

      await verificarControlActual(usuario, partido, acta, controlToken);

      const { data, error } = await supabaseAdmin
        .from("acta_partidos")
        .update({
          secuencia_eventos: ultimoOrden,

          version: acta.version + 1,

          updated_at: new Date().toISOString(),
        })
        .eq("id", acta.id)
        .eq("partido_id", partidoID)
        .eq("controlador_id", usuario.id)
        .eq("control_token", controlToken)
        .eq("estado", "EN_CURSO")
        .eq("estado_operativo", acta.estado_operativo)
        .eq("control_generacion", acta.control_generacion)
        .eq("version", acta.version)
        .is("bloqueada_at", null)
        .select("version,secuencia_eventos")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new ErrorAPI(
          409,
          "El control de l'acta ha canviat mentre s'enviaven les jugades.",
        );
      }

      version = data.version;
    }

    // ========================================================
    // CONSULTAR HISTORIAL OFICIAL
    // ========================================================

    const eventosServidor = await obtenerEventos(acta.id);

    const correctas = resultados.filter(
      (resultado) => resultado.success,
    ).length;

    // ========================================================
    // RESPUESTA COMPATIBLE CON LOS EDITORES
    // ========================================================

    return responder({
      success: true,

      recibidas: resultados.length,

      correctas,

      errores: resultados.length - correctas,

      acta: {
        id: acta.id,
        version,
        secuenciaEventos: ultimoOrden,
      },

      resultados,

      eventos: eventosServidor,
    });
  } catch (error) {
    return responderError(error);
  } finally {
    // Notificar si se han escrito jugadas,
    // incluso cuando ha fallado una operación
    // posterior del mismo lote.

    if (huboCambios && destinoRealtime) {
      await notificarCambios(
        destinoRealtime.partidoID,
        destinoRealtime.edicionID,
      );
    }
  }
};
