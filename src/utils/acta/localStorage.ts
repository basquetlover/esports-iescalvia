// ============================================================
// ACTA DIGITAL - LOCALSTORAGE
// ============================================================
//
// Este archivo es común para TODOS los deportes.
//
// Responsabilidades:
//
// - Guardar primero los eventos en el dispositivo.
// - Utilizar siempre la UUID REAL de competicion_partidos.id.
// - Dar una UUID independiente a cada evento.
// - Conservar eventos aunque se pierda Internet.
// - Conservar anulaciones.
// - Saber qué falta por sincronizar.
// - NO borrar nunca automáticamente un acta.
// - Borrar el LocalStorage únicamente después de que la API
//   confirme:
//
//      1. Partido finalizado.
//      2. Acta FINALIZADA.
//      3. Resultado CONFIRMADO.
//
// ============================================================

const VERSION_STORAGE = 1;

const PREFIJO_STORAGE = "esports-iescalvia:acta";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// TIPOS
// ============================================================

export type EstadoEventoLocal = "ACTIVO" | "ANULADO";

export type EstadoSincronizacion =
  | "PENDIENTE"
  | "SINCRONIZANDO"
  | "SINCRONIZADO"
  | "BLOQUEADO"
  | "ERROR";

// ============================================================
// ESTADO DE SINCRONIZACIÓN DE UNA OPERACIÓN
// ============================================================

export type SincronizacionOperacion = {
  estado: EstadoSincronizacion;

  intentos: number;

  sincronizadoAt: string | null;

  error: string | null;
};

// ============================================================
// EVENTO LOCAL
// ============================================================

export type EventoLocalActa = {
  /*
   * UUID generada en el navegador.
   *
   * Esta UUID acabará en:
   *
   * acta_eventos.cliente_evento_id
   *
   * y será utilizada para evitar duplicados cuando
   * una petición se reintente por mala conexión.
   */
  clienteEventoID: string;

  tipoEvento: string;

  // ========================================================
  // EQUIPO
  // ========================================================

  equipoID: string | null;

  equipoNombre: string | null;

  // ========================================================
  // JUGADOR
  // ========================================================

  jugadorID: string | null;

  jugadorNombre: string | null;

  // ========================================================
  // CONTEXTO DEPORTIVO
  // ========================================================

  /*
   * Set, parte, periodo...
   *
   * Puede quedar null.
   */
  periodo: number | null;

  /*
   * Fútbol:
   *
   * minuto opcional.
   *
   * Ej:
   *
   * 34
   * 45
   * 90
   */
  minuto: number | null;

  /*
   * Voleibol:
   *
   * tiempo del cronómetro en segundos.
   *
   * Fútbol normalmente lo dejará null.
   */
  tiempoJuegoSegundos: number | null;

  /*
   * Información adicional específica
   * de cada tipo de evento.
   */
  datos: Record<string, unknown>;

  // ========================================================
  // ESTADO DEL EVENTO
  // ========================================================

  estado: EstadoEventoLocal;

  createdAt: string;

  anuladoAt: string | null;

  motivoAnulacion: string | null;

  // ========================================================
  // SINCRONIZACIÓN DE LA CREACIÓN
  // ========================================================
  //
  // Incluso aunque el usuario anule una acción antes de que
  // llegue al servidor, conservamos la creación original.
  //
  // Esto permite que posteriormente el servidor mantenga
  // también el historial completo:
  //
  // GOL
  // ↓
  // EVENTO ANULADO
  //
  // ========================================================

  sincronizacionCreacion: SincronizacionOperacion;

  /*
   * UUID definitiva de acta_eventos.id
   * devuelta por el servidor.
   */
  servidorEventoID: string | null;

  // ========================================================
  // SINCRONIZACIÓN DE LA ANULACIÓN
  // ========================================================
  //
  // null:
  // el evento nunca se ha anulado.
  //
  // objeto:
  // existe una anulación que debe sincronizarse.
  // ========================================================

  sincronizacionAnulacion: SincronizacionOperacion | null;
};

// ============================================================
// ESTADO COMPLETO DEL PARTIDO EN LOCALSTORAGE
// ============================================================

export type EstadoLocalActa = {
  version: number;

  /*
   * UUID REAL:
   *
   * competicion_partidos.id
   */
  partidoID: string;

  eventos: EventoLocalActa[];

  createdAt: string;

  updatedAt: string;
};

// ============================================================
// NUEVO EVENTO
// ============================================================

export type NuevoEventoLocal = {
  tipoEvento: string;

  equipoID?: string | null;

  equipoNombre?: string | null;

  jugadorID?: string | null;

  jugadorNombre?: string | null;

  periodo?: number | null;

  minuto?: number | null;

  tiempoJuegoSegundos?: number | null;

  datos?: Record<string, unknown>;
};

// ============================================================
// CONFIRMACIÓN DE FINALIZACIÓN
// ============================================================
//
// Esta será la respuesta que deberá devolver posteriormente:
//
// /api/panell/acta/finalizar
//
// El LocalStorage solamente podrá borrarse si TODO esto
// está confirmado.
// ============================================================

export type ConfirmacionFinalizacionActa = {
  success: boolean;

  finalizado: boolean;

  partidoID: string;

  partido?: {
    id?: string;

    finalizado?: boolean;

    finalizado_at?: string | null;
  };

  acta?: {
    estado?: string;
  };

  resultado?: {
    estado?: string;
  };
};

// ============================================================
// UUID
// ============================================================

function normalizarUUID(valor: string, nombre: string) {
  const limpio = valor.trim().toLowerCase();

  if (!UUID.test(limpio)) {
    throw new Error(`La UUID de ${nombre} no és vàlida.`);
  }

  return limpio;
}

// ============================================================
// GENERAR UUID EVENTO
// ============================================================

function generarUUID() {
  if (
    typeof crypto === "undefined" ||
    typeof crypto.randomUUID !== "function"
  ) {
    throw new Error("El navegador no permet generar identificadors segurs.");
  }

  return crypto.randomUUID().toLowerCase();
}

// ============================================================
// LOCALSTORAGE
// ============================================================

function obtenerStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

// ============================================================
// CLAVE
// ============================================================
//
// EJEMPLO:
//
// esports-iescalvia:acta:
// 550e8400-e29b-41d4-a716-446655440000
// :v1
//
// ============================================================

export function obtenerClaveActaLocal(partidoID: string) {
  const id = normalizarUUID(partidoID, "partit");

  return `${PREFIJO_STORAGE}:` + `${id}:` + `v${VERSION_STORAGE}`;
}

// ============================================================
// ESTADO VACÍO
// ============================================================

function crearEstadoVacio(partidoID: string): EstadoLocalActa {
  const ahora = new Date().toISOString();

  return {
    version: VERSION_STORAGE,

    partidoID: normalizarUUID(partidoID, "partit"),

    eventos: [],

    createdAt: ahora,

    updatedAt: ahora,
  };
}

// ============================================================
// VALIDAR OPERACIÓN DE SINCRONIZACIÓN
// ============================================================

function esSincronizacionOperacion(
  valor: unknown,
): valor is SincronizacionOperacion {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return false;
  }

  const datos = valor as Partial<SincronizacionOperacion>;

  return (
    (datos.estado === "PENDIENTE" ||
      datos.estado === "SINCRONIZANDO" ||
      datos.estado === "SINCRONIZADO" ||
      datos.estado === "BLOQUEADO" ||
      datos.estado === "ERROR") &&
    typeof datos.intentos === "number"
  );
}

// ============================================================
// VALIDAR EVENTO RECUPERADO
// ============================================================

function esEventoLocal(valor: unknown): valor is EventoLocalActa {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    return false;
  }

  const evento = valor as Partial<EventoLocalActa>;

  if (
    typeof evento.clienteEventoID !== "string" ||
    !UUID.test(evento.clienteEventoID)
  ) {
    return false;
  }

  if (typeof evento.tipoEvento !== "string" || !evento.tipoEvento.trim()) {
    return false;
  }

  if (evento.estado !== "ACTIVO" && evento.estado !== "ANULADO") {
    return false;
  }

  if (!esSincronizacionOperacion(evento.sincronizacionCreacion)) {
    return false;
  }

  if (
    evento.sincronizacionAnulacion !== null &&
    evento.sincronizacionAnulacion !== undefined &&
    !esSincronizacionOperacion(evento.sincronizacionAnulacion)
  ) {
    return false;
  }

  return true;
}

// ============================================================
// NORMALIZAR OPERACIÓN RECUPERADA
// ============================================================

function normalizarSincronizacion(
  operacion: SincronizacionOperacion,
): SincronizacionOperacion {
  /*
   * Si el navegador se cerró justo cuando estaba
   * SINCRONIZANDO, al volver debe intentarse otra vez.
   */
  const estado =
    operacion.estado === "SINCRONIZANDO" ? "PENDIENTE" : operacion.estado;

  return {
    estado,

    intentos:
      Number.isSafeInteger(operacion.intentos) && operacion.intentos >= 0
        ? operacion.intentos
        : 0,

    sincronizadoAt:
      typeof operacion.sincronizadoAt === "string"
        ? operacion.sincronizadoAt
        : null,

    error: typeof operacion.error === "string" ? operacion.error : null,
  };
}

// ============================================================
// NORMALIZAR EVENTO RECUPERADO
// ============================================================

function normalizarEvento(evento: EventoLocalActa): EventoLocalActa {
  return {
    ...evento,

    clienteEventoID: evento.clienteEventoID.toLowerCase(),

    tipoEvento: evento.tipoEvento.trim().toUpperCase(),

    equipoID: typeof evento.equipoID === "string" ? evento.equipoID : null,

    equipoNombre:
      typeof evento.equipoNombre === "string" ? evento.equipoNombre : null,

    jugadorID: typeof evento.jugadorID === "string" ? evento.jugadorID : null,

    jugadorNombre:
      typeof evento.jugadorNombre === "string" ? evento.jugadorNombre : null,

    periodo: typeof evento.periodo === "number" ? evento.periodo : null,

    minuto: typeof evento.minuto === "number" ? evento.minuto : null,

    tiempoJuegoSegundos:
      typeof evento.tiempoJuegoSegundos === "number"
        ? evento.tiempoJuegoSegundos
        : null,

    datos:
      evento.datos &&
      typeof evento.datos === "object" &&
      !Array.isArray(evento.datos)
        ? evento.datos
        : {},

    createdAt:
      typeof evento.createdAt === "string"
        ? evento.createdAt
        : new Date().toISOString(),

    anuladoAt: typeof evento.anuladoAt === "string" ? evento.anuladoAt : null,

    motivoAnulacion:
      typeof evento.motivoAnulacion === "string"
        ? evento.motivoAnulacion
        : null,

    sincronizacionCreacion: normalizarSincronizacion(
      evento.sincronizacionCreacion,
    ),

    servidorEventoID:
      typeof evento.servidorEventoID === "string"
        ? evento.servidorEventoID
        : null,

    sincronizacionAnulacion: evento.sincronizacionAnulacion
      ? normalizarSincronizacion(evento.sincronizacionAnulacion)
      : null,
  };
}

// ============================================================
// LEER ACTA
// ============================================================

export function leerActaLocal(partidoID: string): EstadoLocalActa {
  const id = normalizarUUID(partidoID, "partit");

  const storage = obtenerStorage();

  if (!storage) {
    return crearEstadoVacio(id);
  }

  const contenido = storage.getItem(obtenerClaveActaLocal(id));

  if (!contenido) {
    return crearEstadoVacio(id);
  }

  try {
    const recuperado = JSON.parse(contenido) as Partial<EstadoLocalActa>;

    if (recuperado.partidoID !== id || !Array.isArray(recuperado.eventos)) {
      return crearEstadoVacio(id);
    }

    const eventos = recuperado.eventos
      .filter(esEventoLocal)
      .map(normalizarEvento);

    return {
      version: VERSION_STORAGE,

      partidoID: id,

      eventos,

      createdAt:
        typeof recuperado.createdAt === "string"
          ? recuperado.createdAt
          : new Date().toISOString(),

      updatedAt:
        typeof recuperado.updatedAt === "string"
          ? recuperado.updatedAt
          : new Date().toISOString(),
    };
  } catch (error) {
    console.error("LocalStorage de l'acta corrupte:", error);

    /*
     * No borramos automáticamente el contenido corrupto.
     *
     * Esto evita perder información sin que el usuario
     * haya finalizado correctamente el partido.
     */
    return crearEstadoVacio(id);
  }
}

// ============================================================
// GUARDAR ACTA
// ============================================================

export function guardarActaLocal(estado: EstadoLocalActa) {
  const storage = obtenerStorage();

  if (!storage) {
    throw new Error("LocalStorage no està disponible.");
  }

  const partidoID = normalizarUUID(estado.partidoID, "partit");

  const actualizado: EstadoLocalActa = {
    ...estado,

    version: VERSION_STORAGE,

    partidoID,

    updatedAt: new Date().toISOString(),
  };

  storage.setItem(
    obtenerClaveActaLocal(partidoID),
    JSON.stringify(actualizado),
  );

  return actualizado;
}

// ============================================================
// REGISTRAR EVENTO
// ============================================================

export function registrarEventoLocal(
  partidoID: string,

  entrada: NuevoEventoLocal,
) {
  const estado = leerActaLocal(partidoID);

  const tipoEvento = entrada.tipoEvento.trim().toUpperCase();

  if (!tipoEvento) {
    throw new Error("El tipus d'esdeveniment és obligatori.");
  }

  const evento: EventoLocalActa = {
    clienteEventoID: generarUUID(),

    tipoEvento,

    equipoID: entrada.equipoID ?? null,

    equipoNombre: entrada.equipoNombre ?? null,

    jugadorID: entrada.jugadorID ?? null,

    jugadorNombre: entrada.jugadorNombre ?? null,

    periodo: entrada.periodo ?? null,

    minuto: entrada.minuto ?? null,

    tiempoJuegoSegundos: entrada.tiempoJuegoSegundos ?? null,

    datos: entrada.datos ?? {},

    estado: "ACTIVO",

    createdAt: new Date().toISOString(),

    anuladoAt: null,

    motivoAnulacion: null,

    // =================================================
    // TODAVÍA NO HA LLEGADO AL SERVIDOR
    // =================================================

    sincronizacionCreacion: {
      estado: "PENDIENTE",

      intentos: 0,

      sincronizadoAt: null,

      error: null,
    },

    servidorEventoID: null,

    sincronizacionAnulacion: null,
  };

  estado.eventos.push(evento);

  const estadoGuardado = guardarActaLocal(estado);

  return {
    evento,

    estado: estadoGuardado,
  };
}

// ============================================================
// ANULAR EVENTO
// ============================================================

export function anularEventoLocal(
  partidoID: string,

  clienteEventoID: string,

  motivo?: string | null,
) {
  const eventoID = normalizarUUID(clienteEventoID, "esdeveniment");

  const estado = leerActaLocal(partidoID);

  const indice = estado.eventos.findIndex(
    (evento) => evento.clienteEventoID === eventoID,
  );

  if (indice === -1) {
    throw new Error("No s'ha trobat l'esdeveniment local.");
  }

  const actual = estado.eventos[indice];

  if (actual.estado === "ANULADO") {
    return {
      evento: actual,

      estado,
    };
  }

  const ahora = new Date().toISOString();

  const eventoActualizado: EventoLocalActa = {
    ...actual,

    estado: "ANULADO",

    anuladoAt: ahora,

    motivoAnulacion: motivo?.trim() || null,

    /*
     * La anulación se sincronizará después.
     *
     * Incluso si la creación todavía está PENDIENTE,
     * primero se enviará la creación y después la
     * anulación para mantener el historial completo.
     */
    sincronizacionAnulacion: {
      estado: "PENDIENTE",

      intentos: 0,

      sincronizadoAt: null,

      error: null,
    },
  };

  estado.eventos[indice] = eventoActualizado;

  const estadoGuardado = guardarActaLocal(estado);

  return {
    evento: eventoActualizado,

    estado: estadoGuardado,
  };
}

// ============================================================
// ACTUALIZAR SINCRONIZACIÓN DE CREACIÓN
// ============================================================

export function actualizarSincronizacionCreacion(
  partidoID: string,

  clienteEventoID: string,

  cambios: Partial<SincronizacionOperacion> & {
    servidorEventoID?: string | null;
  },
) {
  const eventoID = normalizarUUID(clienteEventoID, "esdeveniment");

  const estado = leerActaLocal(partidoID);

  const indice = estado.eventos.findIndex(
    (evento) => evento.clienteEventoID === eventoID,
  );

  if (indice === -1) {
    return null;
  }

  const actual = estado.eventos[indice];

  estado.eventos[indice] = {
    ...actual,

    servidorEventoID:
      cambios.servidorEventoID !== undefined
        ? cambios.servidorEventoID
        : actual.servidorEventoID,

    sincronizacionCreacion: {
      ...actual.sincronizacionCreacion,

      ...(cambios.estado !== undefined
        ? {
            estado: cambios.estado,
          }
        : {}),

      ...(cambios.intentos !== undefined
        ? {
            intentos: cambios.intentos,
          }
        : {}),

      ...(cambios.sincronizadoAt !== undefined
        ? {
            sincronizadoAt: cambios.sincronizadoAt,
          }
        : {}),

      ...(cambios.error !== undefined
        ? {
            error: cambios.error,
          }
        : {}),
    },
  };

  guardarActaLocal(estado);

  return estado.eventos[indice];
}

// ============================================================
// ACTUALIZAR SINCRONIZACIÓN DE ANULACIÓN
// ============================================================

export function actualizarSincronizacionAnulacion(
  partidoID: string,

  clienteEventoID: string,

  cambios: Partial<SincronizacionOperacion>,
) {
  const eventoID = normalizarUUID(clienteEventoID, "esdeveniment");

  const estado = leerActaLocal(partidoID);

  const indice = estado.eventos.findIndex(
    (evento) => evento.clienteEventoID === eventoID,
  );

  if (indice === -1) {
    return null;
  }

  const actual = estado.eventos[indice];

  if (!actual.sincronizacionAnulacion) {
    return null;
  }

  estado.eventos[indice] = {
    ...actual,

    sincronizacionAnulacion: {
      ...actual.sincronizacionAnulacion,

      ...cambios,
    },
  };

  guardarActaLocal(estado);

  return estado.eventos[indice];
}

// ============================================================
// EVENTOS CON CREACIÓN PENDIENTE
// ============================================================

export function obtenerEventosPendientesCreacion(partidoID: string) {
  return leerActaLocal(partidoID).eventos.filter((evento) => {
    const estado = evento.sincronizacionCreacion.estado;

    return estado === "PENDIENTE" || estado === "ERROR";
  });
}

// ============================================================
// EVENTOS CON ANULACIÓN PENDIENTE
// ============================================================

export function obtenerEventosPendientesAnulacion(partidoID: string) {
  return leerActaLocal(partidoID).eventos.filter((evento) => {
    const anulacion = evento.sincronizacionAnulacion;

    if (!anulacion) {
      return false;
    }

    return anulacion.estado === "PENDIENTE" || anulacion.estado === "ERROR";
  });
}

// ============================================================
// ¿HAY DATOS SIN SINCRONIZAR?
// ============================================================

export function hayCambiosPendientes(partidoID: string) {
  const estado = leerActaLocal(partidoID);

  return estado.eventos.some((evento) => {
    if (evento.sincronizacionCreacion.estado !== "SINCRONIZADO") {
      return true;
    }

    if (
      evento.sincronizacionAnulacion &&
      evento.sincronizacionAnulacion.estado !== "SINCRONIZADO"
    ) {
      return true;
    }

    return false;
  });
}

// ============================================================
// RESUMEN
// ============================================================

export function obtenerResumenActaLocal(partidoID: string) {
  const estado = leerActaLocal(partidoID);

  let pendientes = 0;

  let sincronizando = 0;

  let errores = 0;

  let bloqueados = 0;

  let sincronizados = 0;

  for (const evento of estado.eventos) {
    const operaciones = [
      evento.sincronizacionCreacion,
      evento.sincronizacionAnulacion,
    ].filter(
      (operacion): operacion is SincronizacionOperacion => operacion !== null,
    );

    for (const operacion of operaciones) {
      switch (operacion.estado) {
        case "PENDIENTE":
          pendientes++;
          break;

        case "SINCRONIZANDO":
          sincronizando++;
          break;

        case "ERROR":
          errores++;
          break;

        case "BLOQUEADO":
          bloqueados++;
          break;

        case "SINCRONIZADO":
          sincronizados++;
          break;
      }
    }
  }

  return {
    eventos: estado.eventos.length,

    pendientes,

    sincronizando,

    errores,

    bloqueados,

    sincronizados,

    completamenteSincronizado:
      pendientes === 0 &&
      sincronizando === 0 &&
      errores === 0 &&
      bloqueados === 0,
  };
}

// ============================================================
// ¿PUEDE INTENTARSE FINALIZAR?
// ============================================================
//
// Esto NO finaliza nada.
//
// Simplemente sirve para que la interfaz sepa si todavía
// existen operaciones locales que deben llegar al servidor.
//
// Antes de finalizar:
// 1. sincronizar.
// 2. volver a comprobar.
// 3. llamar a /finalizar.
// ============================================================

export function puedeIntentarFinalizacion(partidoID: string) {
  const resumen = obtenerResumenActaLocal(partidoID);

  return resumen.completamenteSincronizado;
}

// ============================================================
// COMPROBAR SI EXISTE COPIA LOCAL
// ============================================================

export function existeActaLocal(partidoID: string) {
  const storage = obtenerStorage();

  if (!storage) {
    return false;
  }

  return storage.getItem(obtenerClaveActaLocal(partidoID)) !== null;
}

// ============================================================
// ELIMINACIÓN INTERNA
// ============================================================
//
// IMPORTANTE:
//
// Esta función NO se exporta.
//
// Así evitamos que cualquier componente pueda hacer:
//
// localStorage.removeItem(...)
//
// accidentalmente.
//
// La única función pública capaz de borrar una acta local es:
//
// eliminarActaLocalTrasFinalizacion()
//
// ============================================================

function eliminarActaLocal(partidoID: string) {
  const storage = obtenerStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(obtenerClaveActaLocal(partidoID));
}

// ============================================================
// BORRAR TRAS FINALIZACIÓN CONFIRMADA
// ============================================================
//
// ESTA ES LA ÚNICA FORMA PÚBLICA DE BORRAR EL ACTA.
//
// Requisitos:
//
// ✓ respuesta.success === true
// ✓ respuesta.finalizado === true
// ✓ partidoID coincide
// ✓ partido finalizado
// ✓ acta FINALIZADA
// ✓ resultado CONFIRMADO
//
// Si cualquiera falla:
//
// ❌ NO borrar LocalStorage
//
// ============================================================

export function eliminarActaLocalTrasFinalizacion(
  partidoID: string,

  confirmacion: ConfirmacionFinalizacionActa,
) {
  const id = normalizarUUID(partidoID, "partit");

  const idRespuesta =
    typeof confirmacion.partidoID === "string"
      ? confirmacion.partidoID.trim().toLowerCase()
      : "";

  // ========================================================
  // RESPUESTA GENERAL
  // ========================================================

  if (confirmacion.success !== true || confirmacion.finalizado !== true) {
    return false;
  }

  // ========================================================
  // PARTIDO CORRECTO
  // ========================================================

  if (idRespuesta !== id) {
    return false;
  }

  // ========================================================
  // PARTIDO CERRADO
  // ========================================================

  const partidoFinalizado =
    confirmacion.partido?.finalizado === true &&
    typeof confirmacion.partido?.finalizado_at === "string" &&
    Boolean(confirmacion.partido.finalizado_at.trim());

  if (!partidoFinalizado) {
    return false;
  }

  // ========================================================
  // ACTA FINALIZADA
  // ========================================================

  if (confirmacion.acta?.estado !== "FINALIZADA") {
    return false;
  }

  // ========================================================
  // RESULTADO CONFIRMADO
  // ========================================================

  if (confirmacion.resultado?.estado !== "CONFIRMADO") {
    return false;
  }

  // ========================================================
  // TODO CONFIRMADO
  // ========================================================

  eliminarActaLocal(id);

  return true;
}
