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

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Registro = Record<string, unknown>;

type TipoEventoFutbol =
  | "GOL"
  | "TARJETA_AMARILLA"
  | "TARJETA_ROJA"
  | "PENALTI_MARCADO"
  | "PENALTI_FALLADO";

type AccionOperacion = "CREAR" | "ANULAR";

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

  controlador_id: string | null;

  control_token: string | null;

  secuencia_eventos: number;

  version: number;

  updated_at: string;
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

  datos: Record<string, unknown> | null;

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

type ResultadoOperacion = {
  success: boolean;

  accion: AccionOperacion;

  clienteEventoID: string | null;

  reutilizado: boolean;

  evento: EventoDB | null;

  mensaje: string | null;
};

// ============================================================
// SELECTS
// ============================================================

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at";

const SELECT_EDICION = "id,torneo_id";

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,controlador_id,control_token,secuencia_eventos,version,updated_at";

const SELECT_EVENTO =
  "id,acta_id,partido_id,torneo_id,edicion_id,deporte,cliente_evento_id,orden,tipo_evento,equipo_id,equipo_nombre,jugador_id,jugador_nombre,periodo,tiempo_juego_segundos,datos,estado,evento_relacionado_id,creado_por,creado_por_nombre,created_at,anulado_at,anulado_por,motivo_anulacion";

const SELECT_EQUIPO = "id,nombre";

const SELECT_PARTICIPANTE =
  "id,equipo_id,nombre,apellido1,apellido2,tipo_participante,activo";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const MAX_OPERACIONES_LOTE = 250;

const TIPOS_EVENTO_FUTBOL: readonly TipoEventoFutbol[] = [
  "GOL",
  "TARJETA_AMARILLA",
  "TARJETA_ROJA",
  "PENALTI_MARCADO",
  "PENALTI_FALLADO",
];

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
// REGISTRO
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

// ============================================================
// UUID
// ============================================================

function identificador(
  valor: unknown,

  nombre: string,
) {
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
// UUID OPCIONAL
// ============================================================

function identificadorOpcional(
  valor: unknown,

  nombre: string,
) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  return identificador(valor, nombre);
}

// ============================================================
// TEXTO
// ============================================================

function texto(
  valor: unknown,

  nombre: string,

  maximo: number,

  obligatorio = false,
) {
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

// ============================================================
// ENTERO OPCIONAL
// ============================================================

function enteroOpcional(
  valor: unknown,

  nombre: string,

  minimo: number,

  maximo: number,
) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = typeof valor === "number" ? valor : Number(valor);

  if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  return numero;
}

// ============================================================
// FECHA OPCIONAL
// ============================================================

function fechaOpcional(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  if (typeof valor !== "string") {
    return null;
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha.toISOString();
}

// ============================================================
// NORMALIZAR DEPORTE
// ============================================================

function normalizarDeporte(valor: string | null) {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? ""
  );
}

// ============================================================
// TIPO EVENTO
// ============================================================

function leerTipoEvento(valor: unknown): TipoEventoFutbol {
  const tipo = texto(valor, "tipus d'esdeveniment", 50, true).toUpperCase();

  if (!TIPOS_EVENTO_FUTBOL.includes(tipo as TipoEventoFutbol)) {
    throw new ErrorAPI(400, "El tipus d'esdeveniment no és vàlid.");
  }

  return tipo as TipoEventoFutbol;
}

// ============================================================
// ACCIÓN
// ============================================================

function leerAccion(valor: unknown): AccionOperacion {
  const accion = texto(valor, "acció", 20, true).toUpperCase();

  if (accion !== "CREAR" && accion !== "ANULAR") {
    throw new ErrorAPI(400, "L'acció de la jugada no és vàlida.");
  }

  return accion;
}

// ============================================================
// NOMBRE PARTICIPANTE
// ============================================================

function nombreParticipante(participante: ParticipanteDB) {
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
// CONTEXTO
// ============================================================

async function obtenerContexto(
  usuario: Usuario,

  partidoID: string,

  escritura: boolean,
) {
  // ========================================================
  // PARTIDO
  // ========================================================

  const {
    data: partidoData,

    error: partidoError,
  } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .maybeSingle();

  if (partidoError) {
    throw partidoError;
  }

  const partido = partidoData as PartidoDB | null;

  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  // ========================================================
  // EDICIÓN
  // ========================================================

  const {
    data: edicionData,

    error: edicionError,
  } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", partido.edicion_id)
    .maybeSingle();

  if (edicionError) {
    throw edicionError;
  }

  const edicion = edicionData as EdicionDB | null;

  if (!edicion) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició del partit.");
  }

  if (!edicion.torneo_id || !UUID.test(edicion.torneo_id)) {
    throw new ErrorAPI(409, "El torneig de l'edició no és vàlid.");
  }

  const torneoID = edicion.torneo_id.trim().toLowerCase();

  // ========================================================
  // PERMISOS
  // ========================================================

  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID) ||
    !tienePermiso(usuario, "partits", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens permís per consultar aquesta acta.");
  }

  if (escritura && !tienePermiso(usuario, "partits", "editar", torneoID)) {
    throw new ErrorAPI(403, "No tens permís per modificar aquesta acta.");
  }

  // ========================================================
  // ACTA
  // ========================================================

  const {
    data: actaData,

    error: actaError,
  } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (actaError) {
    throw actaError;
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
    edicion,
    partido,
    acta,
  };
}

// ============================================================
// CONTROL DE ESCRITURA
// ============================================================

function exigirControl(
  usuario: Usuario,

  partido: PartidoDB,

  acta: ActaDB,

  controlToken: string,
) {
  if (partido.estado === "FINALIZADO" || partido.finalizado_at) {
    throw new ErrorAPI(409, "El partit ja està finalitzat.");
  }

  if (acta.estado !== "EN_CURSO") {
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
// EVENTOS DEL SERVIDOR
// ============================================================

async function obtenerEventos(actaID: string) {
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

// ============================================================
// EVENTO POR CLIENTE_EVENTO_ID
// ============================================================

async function obtenerEventoPorCliente(
  actaID: string,

  clienteEventoID: string,
) {
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
// CONTEXTO DE EQUIPOS Y JUGADORES
// ============================================================

async function obtenerParticipantesPartido(partidoID: string) {
  // ========================================================
  // EQUIPOS RESUELTOS
  // ========================================================

  const {
    data: plazasData,

    error: plazasError,
  } = await supabaseAdmin
    .from("competicion_plazas")
    .select("equipo_resuelto_id")
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (plazasError) {
    throw plazasError;
  }

  const equiposIDs = Array.from(
    new Set(
      ((plazasData ?? []) as PlazaDB[])
        .map((plaza) => plaza.equipo_resuelto_id)
        .filter(
          (valor): valor is string =>
            typeof valor === "string" && UUID.test(valor),
        )
        .map((valor) => valor.trim().toLowerCase()),
    ),
  );

  if (equiposIDs.length === 0) {
    return {
      equipos: new Map<string, EquipoDB>(),

      participantes: new Map<string, ParticipanteDB>(),
    };
  }

  // ========================================================
  // EQUIPOS
  // ========================================================

  const {
    data: equiposData,

    error: equiposError,
  } = await supabaseAdmin
    .from("equipos")
    .select(SELECT_EQUIPO)
    .in("id", equiposIDs);

  if (equiposError) {
    throw equiposError;
  }

  // ========================================================
  // JUGADORES
  // ========================================================

  const {
    data: participantesData,

    error: participantesError,
  } = await supabaseAdmin
    .from("participantes_equipo")
    .select(SELECT_PARTICIPANTE)
    .in("equipo_id", equiposIDs)
    .eq("tipo_participante", "JUGADOR")
    .eq("activo", true);

  if (participantesError) {
    throw participantesError;
  }

  const equipos = new Map<string, EquipoDB>();

  for (const equipo of (equiposData ?? []) as EquipoDB[]) {
    equipos.set(equipo.id, equipo);
  }

  const participantes = new Map<string, ParticipanteDB>();

  for (const participante of (participantesData ?? []) as ParticipanteDB[]) {
    participantes.set(participante.id, participante);
  }

  return {
    equipos,
    participantes,
  };
}

// ============================================================
// ORDEN MÁXIMO
// ============================================================

async function obtenerOrdenMaximo(acta: ActaDB) {
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

  const ordenDB = typeof data?.orden === "number" ? data.orden : 0;

  return Math.max(ordenDB, acta.secuencia_eventos ?? 0);
}

// ============================================================
// ERROR DE SUPABASE
// ============================================================

function codigoErrorSupabase(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (
      error as {
        code?: unknown;
      }
    ).code === "string"
  ) {
    return (
      error as {
        code: string;
      }
    ).code;
  }

  return null;
}

// ============================================================
// INSERTAR EVENTO
// ============================================================

async function insertarEvento(
  usuario: Usuario,

  acta: ActaDB,

  entrada: Registro,

  contextoParticipantes: Awaited<
    ReturnType<typeof obtenerParticipantesPartido>
  >,

  ordenInicial: number,
) {
  const clienteEventoID = identificador(
    entrada.clienteEventoID,
    "esdeveniment",
  );

  // ========================================================
  // IDEMPOTENCIA
  // ========================================================

  const existente = await obtenerEventoPorCliente(acta.id, clienteEventoID);

  if (existente) {
    return {
      evento: existente,

      reutilizado: true,

      orden: Math.max(ordenInicial, existente.orden),

      modificado: false,
    };
  }

  const tipoEvento = leerTipoEvento(entrada.tipoEvento);

  const equipoID = identificador(entrada.equipoID, "equip");

  const jugadorID = identificador(entrada.jugadorID, "jugador");

  const equipo = contextoParticipantes.equipos.get(equipoID);

  if (!equipo) {
    throw new ErrorAPI(
      400,
      "L'equip de la jugada no participa en aquest partit.",
    );
  }

  const participante = contextoParticipantes.participantes.get(jugadorID);

  if (!participante || participante.equipo_id !== equipoID) {
    throw new ErrorAPI(400, "El jugador no pertany a l'equip indicat.");
  }

  const periodo = enteroOpcional(entrada.periodo, "període", 0, 100);

  const minuto = enteroOpcional(entrada.minuto, "minut", 0, 200);

  const tiempoJuegoSegundos = enteroOpcional(
    entrada.tiempoJuegoSegundos,
    "temps de joc",
    0,
    86400,
  );

  const datosEntrada = esRegistro(entrada.datos) ? entrada.datos : {};

  /*
   * acta_eventos no tiene columna "minuto".
   *
   * En fútbol queda almacenado dentro de datos.
   */
  const datos = {
    ...datosEntrada,

    minuto,
  };

  const createdAt =
    fechaOpcional(entrada.createdAt) ?? new Date().toISOString();

  let ultimoOrden = ordenInicial;

  // ========================================================
  // INSERTAR
  // ========================================================
  //
  // cliente_evento_id evita duplicados.
  //
  // Si hubiese una colisión excepcional de "orden", se
  // vuelve a consultar el máximo y se reintenta.
  //
  // ========================================================

  for (let intento = 0; intento < 5; intento++) {
    const orden = ultimoOrden + 1;

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

    // ====================================================
    // UNIQUE
    // ====================================================

    if (codigoErrorSupabase(error) === "23505") {
      /*
       * Puede ser:
       *
       * - cliente_evento_id ya insertado;
       * - orden ocupado por otra petición.
       */

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

  acta: ActaDB,

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

  const motivo = texto(
    entrada.motivoAnulacion,
    "motiu d'anul·lació",
    1000,
    false,
  );

  const anuladoAt =
    fechaOpcional(entrada.anuladoAt) ?? new Date().toISOString();

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
    .select(SELECT_EVENTO)
    .single();

  if (error) {
    throw error;
  }

  return {
    evento: data as EventoDB,

    reutilizado: false,

    modificado: true,
  };
}

// ============================================================
// MENSAJE ERROR OPERACIÓN
// ============================================================

function mensajeErrorOperacion(error: unknown) {
  if (error instanceof ErrorAPI) {
    return error.message;
  }

  console.error("Error processant una operació de l'acta:", error);

  return "No s'ha pogut guardar aquesta jugada.";
}

// ============================================================
// GET
// ============================================================
//
// IMPORTANTE:
//
// Este GET es el que utilizará React para leer el estado
// autoritativo del servidor.
//
// React NO conecta directamente con Supabase.
//
// Para la visualización en directo, el componente podrá hacer:
//
// GET /api/panell/acta/eventos?partidoID=...
//
// periódicamente.
//
// Eso son únicamente LECTURAS.
//
// NO provoca ningún envío de jugadas.
//
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    const partidoID = identificador(
      url.searchParams.get("partidoID"),
      "partit",
    );

    const { torneoID, acta } = await obtenerContexto(usuario, partidoID, false);

    const eventos = await obtenerEventos(acta.id);

    // =================================================
    // CONTROL
    // =================================================

    const puedeEditar = tienePermiso(usuario, "partits", "editar", torneoID);

    const esControlador = acta.controlador_id === usuario.id;

    const puedeEscribir = Boolean(
      puedeEditar && esControlador && acta.estado === "EN_CURSO",
    );

    const respuesta = responder({
      success: true,

      servidorAhora: new Date().toISOString(),

      acta: {
        id: acta.id,

        estado: acta.estado,

        version: acta.version,

        secuenciaEventos: acta.secuencia_eventos,

        updatedAt: acta.updated_at,
      },

      control: {
        puedeEscribir,

        /*
         * No se guarda en LocalStorage.
         *
         * Solamente se mantiene en memoria
         * dentro del componente React.
         */
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
// POST
// ============================================================
//
// BODY:
//
// {
//     partidoID: "uuid",
//     controlToken: "uuid",
//     operaciones: [
//         {
//             accion: "CREAR",
//             evento: { ... }
//         },
//         {
//             accion: "CREAR",
//             evento: { ... }
//         },
//         {
//             accion: "ANULAR",
//             clienteEventoID: "uuid"
//         }
//     ]
// }
//
// De esta manera:
//
// Gol
// espera 3 s
// Tarjeta
//
// ==========================
//
// UNA petición HTTP:
//
// operaciones: [
//     Gol,
//     Tarjeta
// ]
//
// ============================================================

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

    const { partido, acta } = await obtenerContexto(usuario, partidoID, true);

    exigirControl(usuario, partido, acta, controlToken);

    if (normalizarDeporte(acta.deporte) !== "FUTBOL") {
      throw new ErrorAPI(
        409,
        "Aquesta API encara només està implementada per futbol.",
      );
    }

    // =================================================
    // EQUIPOS Y JUGADORES
    // =================================================

    const contextoParticipantes = await obtenerParticipantesPartido(partidoID);

    // =================================================
    // ESTADO ACTUAL DB
    // =================================================

    const eventosIniciales = await obtenerEventos(acta.id);

    const eventos = new Map<string, EventoDB>();

    for (const evento of eventosIniciales) {
      eventos.set(evento.cliente_evento_id, evento);
    }

    // =================================================
    // ORDEN
    // =================================================

    let ultimoOrden = await obtenerOrdenMaximo(acta);

    let huboCambios = false;

    const resultados: ResultadoOperacion[] = [];

    // =================================================
    // ORDEN DE PROCESAMIENTO
    // =================================================
    //
    // Siempre CREACIONES antes que ANULACIONES.
    //
    // Esto permite:
    //
    // 1. registrar una jugada;
    // 2. anularla antes de que salga el lote;
    // 3. mandar ambas operaciones juntas.
    //
    // =================================================

    const operacionesOrdenadas = [...contenido.operaciones].sort((a, b) => {
      const accionA = esRegistro(a) ? a.accion : null;

      const accionB = esRegistro(b) ? b.accion : null;

      const pesoA = accionA === "CREAR" ? 0 : 1;

      const pesoB = accionB === "CREAR" ? 0 : 1;

      return pesoA - pesoB;
    });

    // =================================================
    // PROCESAR LOTE
    // =================================================

    for (const operacionDesconocida of operacionesOrdenadas) {
      if (!esRegistro(operacionDesconocida)) {
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
        accion = leerAccion(operacionDesconocida.accion);

        // =========================================
        // CREAR
        // =========================================

        if (accion === "CREAR") {
          if (!esRegistro(operacionDesconocida.evento)) {
            throw new ErrorAPI(400, "Les dades de la jugada no són vàlides.");
          }

          clienteEventoID = identificador(
            operacionDesconocida.evento.clienteEventoID,
            "esdeveniment",
          );

          const resultado = await insertarEvento(
            usuario,
            acta,
            operacionDesconocida.evento,
            contextoParticipantes,
            ultimoOrden,
          );

          ultimoOrden = Math.max(ultimoOrden, resultado.orden);

          eventos.set(resultado.evento.cliente_evento_id, resultado.evento);

          if (resultado.modificado) {
            huboCambios = true;
          }

          resultados.push({
            success: true,

            accion: "CREAR",

            clienteEventoID,

            reutilizado: resultado.reutilizado,

            evento: resultado.evento,

            mensaje: null,
          });

          continue;
        }

        // =========================================
        // ANULAR
        // =========================================

        clienteEventoID = identificador(
          operacionDesconocida.clienteEventoID,
          "esdeveniment",
        );

        const resultado = await anularEvento(
          usuario,
          acta,
          operacionDesconocida,
          eventos,
        );

        eventos.set(resultado.evento.cliente_evento_id, resultado.evento);

        if (resultado.modificado) {
          huboCambios = true;
        }

        resultados.push({
          success: true,

          accion: "ANULAR",

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

    // =================================================
    // ACTUALIZAR ACTA
    // =================================================

    let version = acta.version;

    if (huboCambios) {
      const ahora = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("acta_partidos")
        .update({
          secuencia_eventos: ultimoOrden,

          version: acta.version + 1,

          updated_at: ahora,
        })
        .eq("id", acta.id)
        .eq("controlador_id", usuario.id)
        .eq("control_token", controlToken)
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

    // =================================================
    // ESTADO OFICIAL DESPUÉS DEL LOTE
    // =================================================

    const eventosServidor = await obtenerEventos(acta.id);

    const correctas = resultados.filter(
      (resultado) => resultado.success,
    ).length;

    const errores = resultados.length - correctas;

    return responder({
      success: true,

      recibidas: resultados.length,

      correctas,

      errores,

      acta: {
        id: acta.id,

        version,

        secuenciaEventos: ultimoOrden,
      },

      resultados,

      /*
       * Se devuelve también el historial oficial.
       *
       * React lo utilizará para hacer:
       *
       * LOCAL <- DB
       *
       * después de cada envío.
       */
      eventos: eventosServidor,
    });
  } catch (error) {
    return responderError(error);
  }
};
