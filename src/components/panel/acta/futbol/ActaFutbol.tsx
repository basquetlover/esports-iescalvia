import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  actualizarSincronizacionAnulacion,
  actualizarSincronizacionCreacion,
  anularEventoLocal,
  eliminarActaLocalTrasFinalizacion,
  guardarActaLocal,
  leerActaLocal,
  puedeIntentarFinalizacion,
  registrarEventoLocal,
  type ConfirmacionFinalizacionActa,
  type EventoLocalActa,
} from "@utils/acta/localStorage";

// ============================================================
// ICONOS DE EVENTOS
// ============================================================
//
// SOLO los iconos deportivos son archivos SVG externos.
//
// Se muestran directamente con <img>.
//
// NO se utiliza:
// - mask-image
// - Supabase en React
//
// El resto de iconos de interfaz siguen siendo SVG inline.
//
// ============================================================

const ICONOS_EVENTO = {
  gol: "/iconos/panell/acta/gol.svg",

  amarilla: "/iconos/panell/acta/tarjeta-amarilla.svg",

  roja: "/iconos/panell/acta/tarjeta-roja.svg",

  penaltiMarcado: "/iconos/panell/acta/penalti-marcado.svg",

  penaltiFallado: "/iconos/panell/acta/penalti-fallado.svg",
} as const;

// ============================================================
// SINCRONIZACIÓN
// ============================================================
//
// NUEVAS OPERACIONES:
//
//      LocalStorage
//          ↓
//      espera 3 s
//          ↓
//      API
//          ↓
//      DB
//
// Si durante esos 3 segundos se añaden más operaciones,
// se incluyen en el mismo lote.
//
// IMPORTANTE:
//
// - El temporizador empieza con la PRIMERA operación.
// - No se reinicia cada vez.
// - Máximo aproximado de espera: 3 segundos.
//
// Si un envío falla:
//
// - queda ERROR/PENDIENTE en LocalStorage;
// - NO se reintenta automáticamente;
// - aparecerá el botón de envío manual.
//
// ============================================================

const ESPERA_ENVIO_NUEVO_MS = 3000;

// ============================================================
// ACTUALIZACIÓN PARA USUARIOS QUE ESTÁN MIRANDO EL ACTA
// ============================================================
//
// Esto SOLO hace GET a nuestra API.
//
// NO manda datos.
//
// React:
// GET /api/panell/acta/eventos
//
// API:
// Supabase
//
// ============================================================

const INTERVALO_LECTURA_SERVIDOR_MS = 2000;

// ============================================================
// TIPOS
// ============================================================

type Jugador = {
  id: string;

  equipo_id: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  tipo_participante: string | null;

  validacion_estado: string | null;

  orden: number | null;

  activo: boolean | null;
};

type Equipo = {
  id: string;

  nombre: string;

  escudo: string | null;

  jugadores: Jugador[];
};

type Lado = {
  lado: "LOCAL" | "VISITANTE";

  resuelto: boolean;

  equipo: Equipo | null;
};

type Partido = {
  id: string;

  codigo: string;

  nombre: string | null;

  jornada: number | null;

  estado: string;

  fecha_hora: string | null;

  pista: string | null;
};

type Estructura = {
  fase: {
    nombre: string;

    tipo: string;
  } | null;

  grupo: {
    nombre: string;
  } | null;

  ronda: {
    nombre: string;

    tipo: string;
  } | null;
};

type Acta = {
  id: string;

  estado: string;

  version: number;
} | null;

type TipoEventoFutbol =
  | "GOL"
  | "TARJETA_AMARILLA"
  | "TARJETA_ROJA"
  | "PENALTI_MARCADO"
  | "PENALTI_FALLADO";

type AccionPendiente = {
  tipo: TipoEventoFutbol;

  equipo: Equipo;

  jugador: Jugador;
};

type Props = {
  partido: Partido;

  estructura: Estructura;

  equipos: {
    local: Lado;

    visitante: Lado;
  };

  acta: Acta;

  editable: boolean;
};

type EventoServidor = {
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

type RespuestaLectura = {
  success: true;

  servidorAhora: string;

  acta: {
    id: string;

    estado: string;

    version: number;

    secuenciaEventos: number;

    updatedAt: string;
  };

  control: {
    puedeEscribir: boolean;

    controlToken: string | null;
  };

  eventos: EventoServidor[];
};

type AccionOperacion = "CREAR" | "ANULAR";

type OperacionCrear = {
  accion: "CREAR";

  evento: {
    clienteEventoID: string;

    tipoEvento: string;

    equipoID: string | null;

    equipoNombre: string | null;

    jugadorID: string | null;

    jugadorNombre: string | null;

    periodo: number | null;

    minuto: number | null;

    tiempoJuegoSegundos: number | null;

    datos: Record<string, unknown>;

    createdAt: string;
  };
};

type OperacionAnular = {
  accion: "ANULAR";

  clienteEventoID: string;

  anuladoAt: string | null;

  motivoAnulacion: string | null;
};

type OperacionEnvio = OperacionCrear | OperacionAnular;

type ResultadoOperacionServidor = {
  success: boolean;

  accion: AccionOperacion;

  clienteEventoID: string | null;

  reutilizado: boolean;

  evento: EventoServidor | null;

  mensaje: string | null;
};

type RespuestaEnvio = {
  success: true;

  recibidas: number;

  correctas: number;

  errores: number;

  acta: {
    id: string;

    version: number;

    secuenciaEventos: number;
  };

  resultados: ResultadoOperacionServidor[];

  eventos: EventoServidor[];
};

// ============================================================
// ERROR HTTP
// ============================================================

class ErrorAPIActa extends Error {
  estado: number;

  constructor(
    estado: number,

    mensaje: string,
  ) {
    super(mensaje);

    this.estado = estado;
  }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function ActaFutbol({
  partido,
  estructura,
  equipos,
  acta,
  editable,
}: Props) {
  const [eventos, setEventos] = useState<EventoLocalActa[]>([]);

  const [cargandoLocal, setCargandoLocal] = useState(true);

  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const [errorSincronizacion, setErrorSincronizacion] = useState<string | null>(
    null,
  );

  const [accionPendiente, setAccionPendiente] =
    useState<AccionPendiente | null>(null);

  const [minutoAccion, setMinutoAccion] = useState("");

  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);

  const [controlToken, setControlToken] = useState<string | null>(null);

  const [permisoEscrituraServidor, setPermisoEscrituraServidor] = useState<
    boolean | null
  >(null);

  const [mostrarFinalizar, setMostrarFinalizar] = useState(false);

  const [finalizando, setFinalizando] = useState(false);

  const [errorFinalizar, setErrorFinalizar] = useState<string | null>(null);

  // ========================================================
  // REFS SINCRONIZACIÓN
  // ========================================================

  /*
   * IDs de operaciones NUEVAS creadas durante esta sesión
   * que todavía están dentro de la ventana automática.
   *
   * Los errores antiguos NO se incluyen aquí.
   */
  const idsEnvioAutomaticoRef = useRef<Set<string>>(new Set());

  const temporizadorEnvioAutomaticoRef = useRef<number | null>(null);

  const envioEnCursoRef = useRef(false);

  const lecturaEnCursoRef = useRef(false);

  // ========================================================
  // ¿SE PUEDE REGISTRAR?
  // ========================================================
  //
  // Si todavía no hemos podido consultar la API,
  // conservamos editable.
  //
  // Esto permite seguir registrando localmente aunque
  // momentáneamente se pierda la conexión.
  //
  // Si la API confirma que ya NO somos controlador:
  // se deshabilita la escritura.
  //
  // ========================================================

  const puedeRegistrar = editable && permisoEscrituraServidor !== false;

  // ========================================================
  // REFRESCAR LOCAL
  // ========================================================

  const refrescarLocal = useCallback(() => {
    const estado = leerActaLocal(partido.id);

    setEventos(estado.eventos);

    return estado;
  }, [partido.id]);

  // ========================================================
  // SERVIDOR -> EVENTO LOCAL
  // ========================================================

  const convertirEventoServidor = useCallback(
    (evento: EventoServidor): EventoLocalActa => {
      const ahora = new Date().toISOString();

      const datos =
        evento.datos &&
        typeof evento.datos === "object" &&
        !Array.isArray(evento.datos)
          ? evento.datos
          : {};

      const minutoDatos = datos.minuto;

      const minuto =
        typeof minutoDatos === "number" && Number.isSafeInteger(minutoDatos)
          ? minutoDatos
          : null;

      const anulado = evento.estado === "ANULADO";

      return {
        clienteEventoID: evento.cliente_evento_id.trim().toLowerCase(),

        tipoEvento: evento.tipo_evento.trim().toUpperCase(),

        equipoID: evento.equipo_id,

        equipoNombre: evento.equipo_nombre,

        jugadorID: evento.jugador_id,

        jugadorNombre: evento.jugador_nombre,

        periodo: evento.periodo,

        minuto,

        tiempoJuegoSegundos: evento.tiempo_juego_segundos,

        datos,

        estado: anulado ? "ANULADO" : "ACTIVO",

        createdAt: evento.created_at,

        anuladoAt: evento.anulado_at,

        motivoAnulacion: evento.motivo_anulacion,

        sincronizacionCreacion: {
          estado: "SINCRONIZADO",

          intentos: 0,

          sincronizadoAt: ahora,

          error: null,
        },

        servidorEventoID: evento.id,

        sincronizacionAnulacion: anulado
          ? {
              estado: "SINCRONIZADO",

              intentos: 0,

              sincronizadoAt: evento.anulado_at ?? ahora,

              error: null,
            }
          : null,
      };
    },
    [],
  );

  // ========================================================
  // RECONCILIAR DB -> LOCAL
  // ========================================================
  //
  // REGLA:
  //
  // DB MANDA.
  //
  // Se conservan únicamente como "capa local temporal"
  // las operaciones que TODAVÍA NO han llegado a la DB.
  //
  // Si una operación se consideraba SINCRONIZADA en local
  // pero no existe en DB:
  //
  //      se elimina del local.
  //
  // Si DB cambia un evento:
  //
  //      DB sustituye al local.
  //
  // ========================================================

  const reconciliarConServidor = useCallback(
    (eventosServidor: EventoServidor[]) => {
      const estadoLocal = leerActaLocal(partido.id);

      const localesPorID = new Map(
        estadoLocal.eventos.map((evento) => [evento.clienteEventoID, evento]),
      );

      const resultado: EventoLocalActa[] = [];

      const idsServidor = new Set<string>();

      // =================================================
      // PRIMERO: TODO LO QUE HAY EN DB
      // =================================================

      for (const eventoServidor of eventosServidor) {
        const oficial = convertirEventoServidor(eventoServidor);

        const id = oficial.clienteEventoID;

        idsServidor.add(id);

        const local = localesPorID.get(id);

        if (!local) {
          resultado.push(oficial);

          continue;
        }

        // =============================================
        // DB TIENE EL EVENTO.
        //
        // Por tanto la creación ya está sincronizada,
        // aunque el navegador no hubiera recibido la
        // respuesta anterior.
        // =============================================

        if (oficial.estado === "ANULADO") {
          /*
           * DB ya tiene también la anulación.
           *
           * DB gana completamente.
           */
          resultado.push(oficial);

          continue;
        }

        // =============================================
        // DB = ACTIVO
        //
        // Pero local puede tener una ANULACIÓN NUEVA
        // todavía pendiente de enviar.
        //
        // Esta es la única capa local que mantenemos.
        // =============================================

        const anulacionLocalPendiente =
          local.estado === "ANULADO" &&
          Boolean(
            local.sincronizacionAnulacion &&
            local.sincronizacionAnulacion.estado !== "SINCRONIZADO",
          );

        if (anulacionLocalPendiente) {
          resultado.push({
            ...oficial,

            estado: "ANULADO",

            anuladoAt: local.anuladoAt,

            motivoAnulacion: local.motivoAnulacion,

            sincronizacionAnulacion: local.sincronizacionAnulacion,
          });

          continue;
        }

        /*
         * No hay ninguna operación local pendiente.
         *
         * DB manda.
         */
        resultado.push(oficial);
      }

      // =================================================
      // SEGUNDO:
      // OPERACIONES LOCALES QUE TODAVÍA NO EXISTEN EN DB
      // =================================================

      for (const eventoLocal of estadoLocal.eventos) {
        if (idsServidor.has(eventoLocal.clienteEventoID)) {
          continue;
        }

        const creacionPendiente =
          eventoLocal.sincronizacionCreacion.estado !== "SINCRONIZADO";

        if (creacionPendiente) {
          /*
           * Aún no existe en DB.
           *
           * Se conserva porque es nuestra cola
           * local pendiente.
           */
          resultado.push(eventoLocal);

          continue;
        }

        /*
         * Local decía SINCRONIZADO pero DB no lo tiene.
         *
         * DB manda.
         *
         * NO se conserva.
         */
      }

      // =================================================
      // ORDEN VISUAL
      // =================================================

      resultado.sort(
        (a, b) =>
          fechaMilisegundos(a.createdAt) - fechaMilisegundos(b.createdAt),
      );

      const guardado = guardarActaLocal({
        ...estadoLocal,

        eventos: resultado,
      });

      setEventos(guardado.eventos);

      return guardado;
    },
    [partido.id, convertirEventoServidor],
  );

  // ========================================================
  // LEER SERVIDOR
  // ========================================================

  const leerServidor = useCallback(
    async (mostrarError = false) => {
      if (lecturaEnCursoRef.current || envioEnCursoRef.current) {
        return null;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return null;
      }

      lecturaEnCursoRef.current = true;

      try {
        const parametros = new URLSearchParams({
          partidoID: partido.id,
        });

        const respuesta = await fetch(
          `/api/panell/acta/eventos?${parametros.toString()}`,
          {
            method: "GET",

            credentials: "same-origin",

            cache: "no-store",
          },
        );

        const contenido = await respuesta.json().catch(() => null);

        if (!respuesta.ok || contenido?.success !== true) {
          throw new ErrorAPIActa(
            respuesta.status,

            contenido?.mensaje ||
              "No s'ha pogut actualitzar l'acta des del servidor.",
          );
        }

        const datos = contenido as RespuestaLectura;

        setPermisoEscrituraServidor(datos.control.puedeEscribir);

        setControlToken(datos.control.controlToken);

        reconciliarConServidor(datos.eventos);

        setErrorSincronizacion(null);

        return datos;
      } catch (error) {
        if (mostrarError) {
          setErrorSincronizacion(mensajeError(error));
        }

        return null;
      } finally {
        lecturaEnCursoRef.current = false;
      }
    },
    [partido.id, reconciliarConServidor],
  );

  // ========================================================
  // CONSTRUIR OPERACIONES
  // ========================================================

  function crearOperacionCreacion(evento: EventoLocalActa): OperacionCrear {
    return {
      accion: "CREAR",

      evento: {
        clienteEventoID: evento.clienteEventoID,

        tipoEvento: evento.tipoEvento,

        equipoID: evento.equipoID,

        equipoNombre: evento.equipoNombre,

        jugadorID: evento.jugadorID,

        jugadorNombre: evento.jugadorNombre,

        periodo: evento.periodo,

        minuto: evento.minuto,

        tiempoJuegoSegundos: evento.tiempoJuegoSegundos,

        datos: evento.datos,

        createdAt: evento.createdAt,
      },
    };
  }

  function crearOperacionAnulacion(evento: EventoLocalActa): OperacionAnular {
    return {
      accion: "ANULAR",

      clienteEventoID: evento.clienteEventoID,

      anuladoAt: evento.anuladoAt,

      motivoAnulacion: evento.motivoAnulacion,
    };
  }

  // ========================================================
  // OPERACIONES AUTOMÁTICAS
  // ========================================================
  //
  // SOLO:
  //
  // - IDs creados/modificados NUEVOS;
  // - estado PENDIENTE.
  //
  // ERROR no entra.
  //
  // De esta manera:
  //
  // un error anterior nunca se reintenta solo.
  //
  // ========================================================

  function construirOperacionesAutomaticas(ids: string[]) {
    const seleccion = new Set(ids);

    const estado = leerActaLocal(partido.id);

    const operaciones: OperacionEnvio[] = [];

    for (const evento of estado.eventos) {
      if (!seleccion.has(evento.clienteEventoID)) {
        continue;
      }

      const creacionPendiente =
        evento.sincronizacionCreacion.estado === "PENDIENTE";

      if (creacionPendiente) {
        operaciones.push(crearOperacionCreacion(evento));
      }

      const anulacionPendiente =
        evento.sincronizacionAnulacion?.estado === "PENDIENTE";

      /*
       * La anulación se puede mandar:
       *
       * - si la creación ya está sincronizada;
       * - o si la creación va incluida ahora mismo.
       */
      if (
        anulacionPendiente &&
        (evento.sincronizacionCreacion.estado === "SINCRONIZADO" ||
          creacionPendiente)
      ) {
        operaciones.push(crearOperacionAnulacion(evento));
      }
    }

    return operaciones;
  }

  // ========================================================
  // OPERACIONES MANUALES
  // ========================================================
  //
  // Botón "Enviar jugades pendents".
  //
  // Incluye:
  //
  // - PENDIENTE
  // - ERROR
  //
  // ========================================================

  function construirOperacionesManuales() {
    const estado = leerActaLocal(partido.id);

    const operaciones: OperacionEnvio[] = [];

    for (const evento of estado.eventos) {
      const estadoCreacion = evento.sincronizacionCreacion.estado;

      const enviarCreacion =
        estadoCreacion === "PENDIENTE" || estadoCreacion === "ERROR";

      if (enviarCreacion) {
        operaciones.push(crearOperacionCreacion(evento));
      }

      const estadoAnulacion = evento.sincronizacionAnulacion?.estado;

      const enviarAnulacion =
        estadoAnulacion === "PENDIENTE" || estadoAnulacion === "ERROR";

      if (
        enviarAnulacion &&
        (estadoCreacion === "SINCRONIZADO" || enviarCreacion)
      ) {
        operaciones.push(crearOperacionAnulacion(evento));
      }
    }

    return operaciones;
  }

  // ========================================================
  // MARCAR SINCRONIZANDO
  // ========================================================

  function marcarSincronizando(operaciones: OperacionEnvio[]) {
    for (const operacion of operaciones) {
      if (operacion.accion === "CREAR") {
        const evento = leerActaLocal(partido.id).eventos.find(
          (item) => item.clienteEventoID === operacion.evento.clienteEventoID,
        );

        if (!evento) {
          continue;
        }

        actualizarSincronizacionCreacion(partido.id, evento.clienteEventoID, {
          estado: "SINCRONIZANDO",

          intentos: evento.sincronizacionCreacion.intentos + 1,

          error: null,
        });

        continue;
      }

      const evento = leerActaLocal(partido.id).eventos.find(
        (item) => item.clienteEventoID === operacion.clienteEventoID,
      );

      if (!evento?.sincronizacionAnulacion) {
        continue;
      }

      actualizarSincronizacionAnulacion(partido.id, evento.clienteEventoID, {
        estado: "SINCRONIZANDO",

        intentos: evento.sincronizacionAnulacion.intentos + 1,

        error: null,
      });
    }

    refrescarLocal();
  }

  // ========================================================
  // MARCAR ERROR GENERAL
  // ========================================================

  function marcarErrorOperaciones(
    operaciones: OperacionEnvio[],

    error: string,
  ) {
    for (const operacion of operaciones) {
      if (operacion.accion === "CREAR") {
        actualizarSincronizacionCreacion(
          partido.id,
          operacion.evento.clienteEventoID,
          {
            estado: "ERROR",

            error,
          },
        );

        continue;
      }

      actualizarSincronizacionAnulacion(partido.id, operacion.clienteEventoID, {
        estado: "ERROR",

        error,
      });
    }

    refrescarLocal();
  }

  // ========================================================
  // PROCESAR RESULTADOS DEL SERVIDOR
  // ========================================================

  function procesarResultados(resultados: ResultadoOperacionServidor[]) {
    for (const resultado of resultados) {
      if (!resultado.clienteEventoID) {
        continue;
      }

      if (resultado.accion === "CREAR") {
        if (resultado.success) {
          actualizarSincronizacionCreacion(
            partido.id,
            resultado.clienteEventoID,
            {
              estado: "SINCRONIZADO",

              sincronizadoAt: new Date().toISOString(),

              servidorEventoID: resultado.evento?.id ?? null,

              error: null,
            },
          );
        } else {
          actualizarSincronizacionCreacion(
            partido.id,
            resultado.clienteEventoID,
            {
              estado: "ERROR",

              error: resultado.mensaje ?? "No s'ha pogut guardar la jugada.",
            },
          );
        }

        continue;
      }

      if (resultado.success) {
        actualizarSincronizacionAnulacion(
          partido.id,
          resultado.clienteEventoID,
          {
            estado: "SINCRONIZADO",

            sincronizadoAt: new Date().toISOString(),

            error: null,
          },
        );
      } else {
        actualizarSincronizacionAnulacion(
          partido.id,
          resultado.clienteEventoID,
          {
            estado: "ERROR",

            error: resultado.mensaje ?? "No s'ha pogut anul·lar la jugada.",
          },
        );
      }
    }
  }

  // ========================================================
  // ENVIAR LOTE
  // ========================================================

  const enviarOperaciones = useCallback(
    async (operaciones: OperacionEnvio[]) => {
      if (operaciones.length === 0) {
        return true;
      }

      if (envioEnCursoRef.current) {
        return false;
      }

      if (!controlToken) {
        setErrorSincronizacion(
          "No hi ha un control vàlid de l'acta. Les jugades es mantenen guardades localment.",
        );

        return false;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setErrorSincronizacion(
          "No hi ha connexió. Les jugades es mantenen guardades localment.",
        );

        return false;
      }

      envioEnCursoRef.current = true;

      setEnviando(true);

      marcarSincronizando(operaciones);

      try {
        const respuesta = await fetch("/api/panell/acta/eventos", {
          method: "POST",

          credentials: "same-origin",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            partidoID: partido.id,

            controlToken,

            operaciones,
          }),
        });

        const contenido = await respuesta.json().catch(() => null);

        if (!respuesta.ok || contenido?.success !== true) {
          throw new ErrorAPIActa(
            respuesta.status,

            contenido?.mensaje || "No s'han pogut enviar les jugades.",
          );
        }

        const datos = contenido as RespuestaEnvio;

        // =========================================
        // MARCAR RESULTADOS INDIVIDUALES
        // =========================================

        procesarResultados(datos.resultados);

        // =========================================
        // DB MANDA
        // =========================================

        reconciliarConServidor(datos.eventos);

        if (datos.errores > 0) {
          setErrorSincronizacion(
            `${datos.errores} operacions no s'han pogut guardar. Pots reintentar-les amb el botó de pendents.`,
          );
        } else {
          setErrorSincronizacion(null);
        }

        return datos.errores === 0;
      } catch (error) {
        const mensaje = mensajeError(error);

        // =========================================
        // NO REINTENTAR AUTOMÁTICAMENTE
        // =========================================

        marcarErrorOperaciones(operaciones, mensaje);

        setErrorSincronizacion(mensaje);

        return false;
      } finally {
        envioEnCursoRef.current = false;

        setEnviando(false);

        refrescarLocal();
      }
    },
    [controlToken, partido.id, reconciliarConServidor, refrescarLocal],
  );

  // ========================================================
  // CANCELAR VENTANA AUTOMÁTICA
  // ========================================================

  function cancelarTemporizadorAutomatico() {
    if (temporizadorEnvioAutomaticoRef.current !== null) {
      window.clearTimeout(temporizadorEnvioAutomaticoRef.current);

      temporizadorEnvioAutomaticoRef.current = null;
    }
  }

  // ========================================================
  // PROGRAMAR OPERACIÓN NUEVA
  // ========================================================
  //
  // IMPORTANTE:
  //
  // NO reiniciamos el timeout si aparece una segunda jugada.
  //
  // Ejemplo:
  //
  // 00.0 Gol
  // 02.0 Amarilla
  // 03.0 Se mandan las dos.
  //
  // ========================================================

  function programarEnvioNuevo(clienteEventoID: string) {
    idsEnvioAutomaticoRef.current.add(clienteEventoID);

    if (temporizadorEnvioAutomaticoRef.current !== null) {
      return;
    }

    temporizadorEnvioAutomaticoRef.current = window.setTimeout(() => {
      temporizadorEnvioAutomaticoRef.current = null;

      const ids = Array.from(idsEnvioAutomaticoRef.current);

      idsEnvioAutomaticoRef.current.clear();

      const operaciones = construirOperacionesAutomaticas(ids);

      void enviarOperaciones(operaciones);
    }, ESPERA_ENVIO_NUEVO_MS);
  }

  // ========================================================
  // ENVÍO MANUAL DE PENDIENTES
  // ========================================================

  async function enviarPendientesManualmente() {
    if (enviando) {
      return;
    }

    /*
     * El usuario ha pulsado manualmente.
     *
     * Cancelamos el lote automático porque este envío
     * ya recogerá todas las operaciones pendientes.
     */
    cancelarTemporizadorAutomatico();

    idsEnvioAutomaticoRef.current.clear();

    const operaciones = construirOperacionesManuales();

    if (operaciones.length === 0) {
      setErrorSincronizacion(null);

      return;
    }

    await enviarOperaciones(operaciones);
  }

  // ========================================================
  // CARGA INICIAL
  // ========================================================

  useEffect(() => {
    let activo = true;

    async function cargar() {
      try {
        const local = leerActaLocal(partido.id);

        if (activo) {
          setEventos(local.eventos);
        }

        /*
         * Intentamos obtener inmediatamente
         * la versión oficial de la DB.
         */
        await leerServidor(false);
      } catch (error) {
        if (activo) {
          setErrorLocal(mensajeError(error));
        }
      } finally {
        if (activo) {
          setCargandoLocal(false);
        }
      }
    }

    void cargar();

    return () => {
      activo = false;
    };
  }, [partido.id, leerServidor]);

  // ========================================================
  // POLLING DE LECTURA
  // ========================================================
  //
  // SOLO GET.
  //
  // Sirve para:
  //
  // - usuario en modo consulta;
  // - cambios realizados por otro cliente;
  // - asegurar que DB acaba imponiéndose sobre local.
  //
  // NO ENVÍA JUGADAS.
  //
  // ========================================================

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      void leerServidor(false);
    }, INTERVALO_LECTURA_SERVIDOR_MS);

    function alVolverOnline() {
      void leerServidor(false);
    }

    window.addEventListener("online", alVolverOnline);

    return () => {
      window.clearInterval(intervalo);

      window.removeEventListener("online", alVolverOnline);
    };
  }, [leerServidor]);

  // ========================================================
  // LIMPIAR TIMEOUT AL DESMONTAR
  // ========================================================

  useEffect(() => {
    return () => {
      cancelarTemporizadorAutomatico();
    };
  }, []);

  // ========================================================
  // EVENTOS ACTIVOS
  // ========================================================

  const activos = useMemo(
    () => eventos.filter((evento) => evento.estado === "ACTIVO"),
    [eventos],
  );

  // ========================================================
  // PENDIENTES
  // ========================================================

  const cantidadPendientes = useMemo(
    () => contarEventosPendientes(eventos),
    [eventos],
  );

  // ========================================================
  // MARCADOR
  // ========================================================

  const golesLocal = contarGolesEquipo(
    activos,
    equipos.local.equipo?.id ?? null,
  );

  const golesVisitante = contarGolesEquipo(
    activos,
    equipos.visitante.equipo?.id ?? null,
  );

  // ========================================================
  // ABRIR ACCIÓN
  // ========================================================

  function abrirAccion(
    tipo: TipoEventoFutbol,

    equipo: Equipo,

    jugador: Jugador,
  ) {
    if (!puedeRegistrar) {
      setErrorLocal("No tens el control de l'acta.");

      return;
    }

    setAccionPendiente({
      tipo,
      equipo,
      jugador,
    });

    setMinutoAccion("");

    setErrorAccion(null);
  }

  // ========================================================
  // CERRAR POPUP ACCIÓN
  // ========================================================

  function cerrarAccion() {
    setAccionPendiente(null);

    setMinutoAccion("");

    setErrorAccion(null);
  }

  // ========================================================
  // CONFIRMAR ACCIÓN
  // ========================================================

  function confirmarAccion() {
    if (!accionPendiente) {
      return;
    }

    let minuto: number | null = null;

    if (minutoAccion.trim()) {
      const numero = Number(minutoAccion);

      if (!Number.isSafeInteger(numero) || numero < 0 || numero > 200) {
        setErrorAccion("El minut ha de ser un nombre enter entre 0 i 200.");

        return;
      }

      minuto = numero;
    }

    try {
      const resultado = registrarEventoLocal(partido.id, {
        tipoEvento: accionPendiente.tipo,

        equipoID: accionPendiente.equipo.id,

        equipoNombre: accionPendiente.equipo.nombre,

        jugadorID: accionPendiente.jugador.id,

        jugadorNombre: nombreJugador(accionPendiente.jugador),

        minuto,

        periodo: null,

        tiempoJuegoSegundos: null,

        datos: {},
      });

      setEventos(resultado.estado.eventos);

      setErrorLocal(null);

      setErrorSincronizacion(null);

      cerrarAccion();

      // =================================================
      // ES UNA JUGADA NUEVA:
      //
      // puede enviarse automáticamente dentro de 3 s.
      // =================================================

      programarEnvioNuevo(resultado.evento.clienteEventoID);
    } catch (error) {
      setErrorAccion(mensajeError(error));
    }
  }

  // ========================================================
  // ANULAR
  // ========================================================

  function anular(id: string) {
    if (!puedeRegistrar) {
      return;
    }

    try {
      const resultado = anularEventoLocal(partido.id, id);

      setEventos(resultado.estado.eventos);

      setErrorLocal(null);

      setErrorSincronizacion(null);

      // =================================================
      // ANULACIÓN RECIÉN GENERADA
      // =================================================
      //
      // Si:
      //
      // - la creación ya está en DB:
      //      enviamos la anulación en la nueva ventana.
      //
      // - la creación sigue dentro del lote nuevo:
      //      CREAR + ANULAR irán juntas.
      //
      // - la creación era un ERROR ANTIGUO:
      //      NO reintentamos automáticamente.
      //
      // =================================================

      const evento = resultado.evento;

      const creacionSincronizada =
        evento.sincronizacionCreacion.estado === "SINCRONIZADO";

      const yaEraOperacionNueva = idsEnvioAutomaticoRef.current.has(
        evento.clienteEventoID,
      );

      if (creacionSincronizada || yaEraOperacionNueva) {
        programarEnvioNuevo(evento.clienteEventoID);
      }
    } catch (error) {
      setErrorLocal(mensajeError(error));
    }
  }

  // ========================================================
  // ABRIR CIERRE
  // ========================================================
  //
  // Abrir el cierre NO envía jugadas pendientes.
  //
  // Antes de mostrar la confirmación se consulta la API
  // para que la DB vuelva a imponerse sobre la copia local.
  //
  // ========================================================

  async function abrirFinalizacion() {
    if (!puedeRegistrar) {
      setErrorLocal("No tens el control de l'acta.");

      return;
    }

    if (enviando || envioEnCursoRef.current) {
      setErrorSincronizacion(
        "Espera que acabi l'enviament actual abans de finalitzar el partit.",
      );

      return;
    }

    if (!controlToken) {
      setErrorSincronizacion(
        "No hi ha un control vàlid de l'acta. No es pot finalitzar el partit.",
      );

      return;
    }

    setErrorFinalizar(null);

    /*
     * Si hay una jugada nueva dentro de la ventana automática,
     * NO la enviamos por cerrar el partido.
     *
     * Se abre el popup y quedará bloqueado hasta que:
     *
     * - termine su envío automático; o
     * - el usuario pulse "Enviar jugades pendents".
     */
    const servidor = await leerServidor(true);

    if (!servidor) {
      setErrorFinalizar(
        "No s'ha pogut comprovar l'estat actual del servidor. No es pot finalitzar el partit.",
      );
    }

    setMostrarFinalizar(true);
  }

  // ========================================================
  // FINALIZAR PARTIDO
  // ========================================================
  //
  // IMPORTANTE:
  //
  // - NO envía jugadas automáticamente.
  // - NO utiliza el marcador local como resultado oficial.
  // - La API vuelve a calcular todo desde acta_eventos.
  // - DB manda.
  //
  // ========================================================

  async function finalizarPartido() {
    if (finalizando) {
      return;
    }

    if (!puedeRegistrar || !controlToken) {
      setErrorFinalizar("No tens el control de l'acta.");

      return;
    }

    if (enviando || envioEnCursoRef.current) {
      setErrorFinalizar(
        "Hi ha un enviament en curs. Espera que acabi abans de finalitzar.",
      );

      return;
    }

    const estadoAntes = leerActaLocal(partido.id);

    if (contarEventosPendientes(estadoAntes.eventos) > 0) {
      setErrorFinalizar(
        "Hi ha jugades pendents d'enviar. Envia-les abans de finalitzar el partit.",
      );

      return;
    }

    setFinalizando(true);

    setErrorFinalizar(null);

    try {
      // =====================================================
      // ÚLTIMA COMPROBACIÓN CONTRA DB
      // =====================================================

      const servidor = await leerServidor(true);

      if (!servidor) {
        throw new Error("No s'ha pogut comprovar l'estat actual del servidor.");
      }

      const estadoActual = leerActaLocal(partido.id);

      if (
        contarEventosPendientes(estadoActual.eventos) > 0 ||
        !puedeIntentarFinalizacion(partido.id)
      ) {
        throw new Error(
          "Hi ha jugades pendents d'enviar. Envia-les abans de finalitzar el partit.",
        );
      }

      // =====================================================
      // CIERRE EN SERVIDOR
      // =====================================================

      const respuesta = await fetch("/api/panell/acta/finalizar", {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          partidoID: partido.id,

          controlToken,
        }),
      });

      const contenido = await respuesta.json().catch(() => null);

      if (
        !respuesta.ok ||
        contenido?.success !== true ||
        contenido?.finalizado !== true
      ) {
        throw new Error(
          contenido?.mensaje || "No s'ha pogut finalitzar el partit.",
        );
      }

      // =====================================================
      // BORRAR LOCALSTORAGE SOLO CON CONFIRMACIÓN COMPLETA
      // =====================================================

      const confirmacion = contenido as ConfirmacionFinalizacionActa;

      const eliminado = eliminarActaLocalTrasFinalizacion(
        partido.id,
        confirmacion,
      );

      if (!eliminado) {
        /*
         * El servidor ya ha confirmado el cierre.
         *
         * No borramos nada a la fuerza.
         * La copia local se conserva por seguridad.
         */
        console.warn(
          "El partit s'ha finalitzat, però la còpia local s'ha conservat perquè la resposta no ha superat totes les comprovacions de seguretat.",
        );
      }

      cancelarTemporizadorAutomatico();

      idsEnvioAutomaticoRef.current.clear();

      setMostrarFinalizar(false);

      /*
       * Conservamos torneoID / edicionID si estaban presentes
       * en la URL de la página del acta.
       */
      window.location.href = `/panell/partits${window.location.search}`;
    } catch (error) {
      setErrorFinalizar(mensajeError(error));
    } finally {
      setFinalizando(false);
    }
  }

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargandoLocal) {
    return (
      <div
        className="
                    flex
                    min-h-64
                    items-center
                    justify-center
                "
      >
        <IconoCargando
          className="
                        h-9
                        w-9
                        animate-spin
                        text-primary
                    "
        />
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <>
      <div className="space-y-5">
        {/* =============================================
                    MODO CONSULTA
                ============================================= */}

        {!puedeRegistrar && (
          <div
            className="
                            flex
                            items-start
                            gap-3
                            rounded-xl
                            border
                            border-amber-200
                            bg-amber-50
                            p-4
                            text-amber-900
                        "
          >
            <IconoCandado
              className="
                                mt-0.5
                                h-5
                                w-5
                                shrink-0
                            "
            />

            <div>
              <p
                className="
                                    text-sm
                                    font-bold
                                "
              >
                Acta en mode consulta
              </p>

              <p
                className="
                                    mt-1
                                    text-xs
                                "
              >
                No tens el control d'escriptura d'aquesta acta.
              </p>
            </div>
          </div>
        )}

        {/* =============================================
                    ESTADO SINCRONIZACIÓN
                ============================================= */}

        {(puedeRegistrar || cantidadPendientes > 0) && (
          <div
            className="
                            flex
                            flex-col
                            gap-3
                            rounded-xl
                            border
                            border-border
                            bg-card
                            p-4
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                        "
          >
            <div
              className="
                                flex
                                items-start
                                gap-3
                            "
            >
              {enviando ? (
                <IconoCargando
                  className="
                                        mt-0.5
                                        h-5
                                        w-5
                                        shrink-0
                                        animate-spin
                                        text-primary
                                    "
                />
              ) : cantidadPendientes > 0 ? (
                <IconoPendiente
                  className="
                                        mt-0.5
                                        h-5
                                        w-5
                                        shrink-0
                                        text-amber-600
                                    "
                />
              ) : (
                <IconoCheck
                  className="
                                        mt-0.5
                                        h-5
                                        w-5
                                        shrink-0
                                        text-green-600
                                    "
                />
              )}

              <div>
                <p
                  className="
                                        text-sm
                                        font-bold
                                        text-neutral-titulos
                                    "
                >
                  {enviando
                    ? "Enviant jugades..."
                    : cantidadPendientes > 0
                      ? `${cantidadPendientes} jugades pendents`
                      : "Acta sincronitzada"}
                </p>

                <p
                  className="
                                        mt-1
                                        text-xs
                                        text-neutral
                                    "
                >
                  {enviando
                    ? "S'estan guardant les jugades al servidor."
                    : cantidadPendientes > 0
                      ? "Les jugades continuen guardades al dispositiu fins que arribin al servidor."
                      : "No hi ha jugades pendents d'enviar."}
                </p>
              </div>
            </div>

            {cantidadPendientes > 0 && puedeRegistrar && (
              <button
                type="button"
                disabled={enviando || !controlToken}
                onClick={() => void enviarPendientesManualmente()}
                className="
                                        inline-flex
                                        h-10
                                        shrink-0
                                        items-center
                                        justify-center
                                        gap-2
                                        rounded-xl
                                        border
                                        border-border
                                        bg-background
                                        px-4
                                        text-sm
                                        font-bold
                                        text-neutral-titulos
                                        transition
                                        hover:border-primary
                                        disabled:cursor-not-allowed
                                        disabled:opacity-50
                                    "
              >
                <IconoEnviar
                  className="
                                            h-4
                                            w-4
                                        "
                />
                Enviar jugades pendents ({cantidadPendientes})
              </button>
            )}
          </div>
        )}

        {/* =============================================
                    ERROR
                ============================================= */}

        {(errorLocal || errorSincronizacion) && (
          <div
            className="
                            rounded-xl
                            border
                            border-red-200
                            bg-red-50
                            p-4
                            text-sm
                            text-red-700
                        "
          >
            {errorLocal ?? errorSincronizacion}
          </div>
        )}

        {/* =============================================
                    INFORMACIÓN DEL PARTIDO
                ============================================= */}

        <section
          className="
                        rounded-xl
                        border
                        border-border
                        bg-card
                        p-5
                    "
        >
          <div
            className="
                            flex
                            flex-col
                            gap-4
                            lg:flex-row
                            lg:items-center
                            lg:justify-between
                        "
          >
            <div>
              <p
                className="
                                    text-xs
                                    font-bold
                                    uppercase
                                    tracking-[0.14em]
                                    text-primary
                                "
              >
                Futbol · {nombreEstructura(estructura)}
              </p>

              <h2
                className="
                                    mt-2
                                    text-2xl
                                    font-bold
                                    text-neutral-titulos
                                "
              >
                {partido.nombre || partido.codigo}
              </h2>
            </div>

            <div
              className="
                                grid
                                gap-2
                                text-sm
                                text-neutral
                                sm:grid-cols-2
                            "
            >
              <Info
                icono="CALENDARIO"
                texto={formatFecha(partido.fecha_hora)}
              />

              <Info
                icono="UBICACION"
                texto={partido.pista || "Pista pendent"}
              />

              <Info
                icono="DOCUMENTO"
                texto={
                  acta
                    ? `Acta: ${nombreEstadoActa(acta.estado)}`
                    : "Acta no iniciada"
                }
              />
            </div>
          </div>
        </section>

        {/* =============================================
                    MARCADOR
                ============================================= */}

        <section
          className="
                        grid
                        overflow-hidden
                        rounded-xl
                        border
                        border-border
                        bg-card
                        md:grid-cols-[1fr_auto_1fr]
                    "
        >
          <EquipoMarcador lado="LOCAL" equipo={equipos.local.equipo} />

          <div
            className="
                            flex
                            items-center
                            justify-center
                            border-y
                            border-border
                            bg-background
                            px-8
                            py-8
                            md:border-x
                            md:border-y-0
                        "
          >
            <div
              className="
                                flex
                                items-center
                                gap-5
                            "
            >
              <span
                className="
                                    text-5xl
                                    font-black
                                    text-neutral-titulos
                                "
              >
                {golesLocal}
              </span>

              <span
                className="
                                    text-2xl
                                    font-bold
                                    text-neutral
                                "
              >
                -
              </span>

              <span
                className="
                                    text-5xl
                                    font-black
                                    text-neutral-titulos
                                "
              >
                {golesVisitante}
              </span>
            </div>
          </div>

          <EquipoMarcador lado="VISITANT" equipo={equipos.visitante.equipo} />
        </section>

        {/* =============================================
                    INFORMACIÓN ACCIONES
                ============================================= */}

        <section
          className="
                        rounded-xl
                        border
                        border-border
                        bg-card
                        p-5
                    "
        >
          <h3
            className="
                            font-bold
                            text-neutral-titulos
                        "
          >
            Registrar incidència
          </h3>

          <p
            className="
                            mt-1
                            text-sm
                            text-neutral
                        "
          >
            Selecciona una acció del jugador. Després podràs indicar el minut.
          </p>
        </section>

        {/* =============================================
                    LOCAL | HISTORIAL | VISITANTE
                ============================================= */}

        <div
          className="
                        grid
                        items-start
                        gap-5
                        xl:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)]
                    "
        >
          <Plantilla
            titulo="LOCAL"
            equipo={equipos.local.equipo}
            eventos={activos}
            editable={puedeRegistrar}
            onEvento={abrirAccion}
          />

          <Historial
            eventos={eventos}
            editable={puedeRegistrar}
            onAnular={anular}
          />

          <Plantilla
            titulo="VISITANT"
            equipo={equipos.visitante.equipo}
            eventos={activos}
            editable={puedeRegistrar}
            onEvento={abrirAccion}
          />
        </div>

        {/* =============================================
                    FINALIZAR PARTIDO
                ============================================= */}

        {puedeRegistrar && (
          <section
            className="
                        flex
                        flex-col
                        gap-4
                        rounded-xl
                        border
                        border-border
                        bg-card
                        p-5
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                    "
          >
            <div>
              <h3
                className="
                            font-bold
                            text-neutral-titulos
                        "
              >
                Finalitzar partit
              </h3>

              <p
                className="
                            mt-1
                            text-sm
                            text-neutral
                        "
              >
                Tanca l'acta quan el partit hagi acabat. El resultat oficial es
                calcularà amb les jugades guardades al servidor.
              </p>
            </div>

            <button
              type="button"
              disabled={enviando || finalizando || !controlToken}
              onClick={() => void abrirFinalizacion()}
              className="
                            inline-flex
                            h-11
                            shrink-0
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            bg-primary
                            px-5
                            text-sm
                            font-bold
                            text-white
                            transition
                            hover:opacity-90
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
            >
              <IconoBandera
                className="
                            h-5
                            w-5
                        "
              />
              Finalitzar partit
            </button>
          </section>
        )}
      </div>

      {/* =================================================
                POPUP MINUTO
            ================================================= */}

      {accionPendiente && (
        <PopupMinuto
          accion={accionPendiente}
          minuto={minutoAccion}
          error={errorAccion}
          onMinuto={setMinutoAccion}
          onCancelar={cerrarAccion}
          onConfirmar={confirmarAccion}
        />
      )}

      {/* =================================================
                POPUP FINALIZAR
            ================================================= */}

      {mostrarFinalizar && (
        <PopupFinalizar
          equipoLocal={equipos.local.equipo}
          equipoVisitante={equipos.visitante.equipo}
          golesLocal={golesLocal}
          golesVisitante={golesVisitante}
          pendientes={cantidadPendientes}
          enviando={enviando}
          finalizando={finalizando}
          error={errorFinalizar}
          onEnviarPendientes={() => void enviarPendientesManualmente()}
          onCancelar={() => {
            if (!finalizando) {
              setMostrarFinalizar(false);

              setErrorFinalizar(null);
            }
          }}
          onFinalizar={() => void finalizarPartido()}
        />
      )}
    </>
  );
}

// ============================================================
// POPUP MINUTO
// ============================================================

function PopupMinuto({
  accion,
  minuto,
  error,
  onMinuto,
  onCancelar,
  onConfirmar,
}: {
  accion: AccionPendiente;

  minuto: string;

  error: string | null;

  onMinuto: (valor: string) => void;

  onCancelar: () => void;

  onConfirmar: () => void;
}) {
  return (
    <div
      className="
                fixed
                inset-0
                z-[150]
                flex
                items-center
                justify-center
                bg-black/50
                p-4
                backdrop-blur-sm
            "
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-minuto-accion"
        className="
                    w-full
                    max-w-md
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-card
                    shadow-2xl
                "
        onKeyDown={(evento) => {
          if (evento.key === "Escape") {
            onCancelar();
          }

          if (evento.key === "Enter") {
            onConfirmar();
          }
        }}
      >
        <div
          className="
                        border-b
                        border-border
                        p-5
                    "
        >
          <div
            className="
                            flex
                            items-center
                            gap-3
                        "
          >
            <div
              className="
                                flex
                                h-11
                                w-11
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                bg-background
                            "
            >
              <IconoTipoEvento tipo={accion.tipo} grande />
            </div>

            <div className="min-w-0">
              <h2
                id="titulo-minuto-accion"
                className="
                                    font-bold
                                    text-neutral-titulos
                                "
              >
                {nombreEvento(accion.tipo)}
              </h2>

              <p
                className="
                                    mt-0.5
                                    truncate
                                    text-sm
                                    text-neutral
                                "
              >
                {nombreJugador(accion.jugador)}
              </p>

              <p
                className="
                                    truncate
                                    text-xs
                                    text-neutral
                                "
              >
                {accion.equipo.nombre}
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <label>
            <span
              className="
                                block
                                text-sm
                                font-semibold
                                text-neutral-titulos
                            "
            >
              Minut
            </span>

            <p
              className="
                                mt-1
                                text-xs
                                text-neutral
                            "
            >
              És opcional. Pots deixar-lo buit.
            </p>

            <div
              className="
                                relative
                                mt-3
                            "
            >
              <input
                type="number"
                min="0"
                max="200"
                autoFocus
                value={minuto}
                onChange={(evento) => onMinuto(evento.target.value)}
                placeholder="Ex. 34"
                className="
                                    h-12
                                    w-full
                                    rounded-xl
                                    border
                                    border-border
                                    bg-background
                                    px-4
                                    pr-12
                                    text-lg
                                    font-bold
                                    text-neutral-titulos
                                    outline-none
                                    transition
                                    focus:border-primary
                                "
              />

              <span
                className="
                                    pointer-events-none
                                    absolute
                                    right-4
                                    top-1/2
                                    -translate-y-1/2
                                    text-sm
                                    font-semibold
                                    text-neutral
                                "
              >
                min
              </span>
            </div>
          </label>

          {error && (
            <div
              className="
                                mt-4
                                rounded-xl
                                border
                                border-red-200
                                bg-red-50
                                p-3
                                text-sm
                                text-red-700
                            "
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="
                        flex
                        flex-col-reverse
                        gap-3
                        border-t
                        border-border
                        bg-background
                        p-4
                        sm:flex-row
                        sm:justify-end
                    "
        >
          <button
            type="button"
            onClick={onCancelar}
            className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-border
                            bg-card
                            px-5
                            text-sm
                            font-semibold
                            text-neutral-titulos
                            transition
                            hover:bg-background
                        "
          >
            Cancel·lar
          </button>

          <button
            type="button"
            onClick={onConfirmar}
            className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            bg-primary
                            px-5
                            text-sm
                            font-bold
                            text-white
                            transition
                            hover:opacity-90
                        "
          >
            <IconoCheck
              className="
                                h-5
                                w-5
                            "
            />
            Registrar
          </button>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// POPUP FINALIZAR
// ============================================================

function PopupFinalizar({
  equipoLocal,
  equipoVisitante,
  golesLocal,
  golesVisitante,
  pendientes,
  enviando,
  finalizando,
  error,
  onEnviarPendientes,
  onCancelar,
  onFinalizar,
}: {
  equipoLocal: Equipo | null;

  equipoVisitante: Equipo | null;

  golesLocal: number;

  golesVisitante: number;

  pendientes: number;

  enviando: boolean;

  finalizando: boolean;

  error: string | null;

  onEnviarPendientes: () => void;

  onCancelar: () => void;

  onFinalizar: () => void;
}) {
  const bloqueado = pendientes > 0 || enviando || finalizando;

  return (
    <div
      className="
                fixed
                inset-0
                z-[160]
                flex
                items-center
                justify-center
                bg-black/50
                p-4
                backdrop-blur-sm
            "
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-finalizar-partido"
        className="
                    w-full
                    max-w-lg
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-card
                    shadow-2xl
                "
        onKeyDown={(evento) => {
          if (evento.key === "Escape" && !finalizando) {
            onCancelar();
          }
        }}
      >
        <div
          className="
                        border-b
                        border-border
                        p-5
                    "
        >
          <div
            className="
                            flex
                            items-center
                            gap-3
                        "
          >
            <div
              className="
                                flex
                                h-11
                                w-11
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                bg-background
                                text-primary
                            "
            >
              <IconoBandera
                className="
                                    h-5
                                    w-5
                                "
              />
            </div>

            <div>
              <h2
                id="titulo-finalizar-partido"
                className="
                                    font-bold
                                    text-neutral-titulos
                                "
              >
                Finalitzar partit
              </h2>

              <p
                className="
                                    mt-0.5
                                    text-sm
                                    text-neutral
                                "
              >
                Confirma el tancament definitiu de l'acta.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* =============================================
                        MARCADOR
                    ============================================= */}

          <div
            className="
                            grid
                            grid-cols-[1fr_auto_1fr]
                            items-center
                            gap-4
                            rounded-xl
                            border
                            border-border
                            bg-background
                            p-4
                        "
          >
            <EquipPopupFinal equipo={equipoLocal} alineacion="DERECHA" />

            <div
              className="
                                flex
                                items-center
                                gap-3
                                whitespace-nowrap
                                text-2xl
                                font-black
                                text-neutral-titulos
                            "
            >
              <span>{golesLocal}</span>

              <span className="text-neutral">-</span>

              <span>{golesVisitante}</span>
            </div>

            <EquipPopupFinal equipo={equipoVisitante} alineacion="IZQUIERDA" />
          </div>

          {/* =============================================
                        PENDIENTES
                    ============================================= */}

          {pendientes > 0 && (
            <div
              className="
                                mt-4
                                rounded-xl
                                border
                                border-amber-200
                                bg-amber-50
                                p-4
                            "
            >
              <div
                className="
                                    flex
                                    items-start
                                    gap-3
                                "
              >
                <IconoPendiente
                  className="
                                        mt-0.5
                                        h-5
                                        w-5
                                        shrink-0
                                        text-amber-700
                                    "
                />

                <div className="min-w-0 flex-1">
                  <p
                    className="
                                            text-sm
                                            font-bold
                                            text-amber-900
                                        "
                  >
                    {pendientes} jugades pendents
                  </p>

                  <p
                    className="
                                            mt-1
                                            text-xs
                                            text-amber-800
                                        "
                  >
                    No es pot finalitzar el partit fins que totes les jugades
                    estiguin guardades al servidor.
                  </p>

                  <button
                    type="button"
                    disabled={enviando || finalizando}
                    onClick={onEnviarPendientes}
                    className="
                                            mt-3
                                            inline-flex
                                            h-10
                                            items-center
                                            justify-center
                                            gap-2
                                            rounded-xl
                                            border
                                            border-amber-300
                                            bg-white
                                            px-4
                                            text-sm
                                            font-bold
                                            text-amber-900
                                            transition
                                            hover:bg-amber-100
                                            disabled:cursor-not-allowed
                                            disabled:opacity-50
                                        "
                  >
                    {enviando ? (
                      <IconoCargando
                        className="
                                                    h-4
                                                    w-4
                                                    animate-spin
                                                "
                      />
                    ) : (
                      <IconoEnviar
                        className="
                                                    h-4
                                                    w-4
                                                "
                      />
                    )}

                    {enviando
                      ? "Enviant..."
                      : `Enviar jugades pendents (${pendientes})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* =============================================
                        CONFIRMACIÓN
                    ============================================= */}

          {pendientes === 0 && (
            <div
              className="
                                mt-4
                                rounded-xl
                                border
                                border-border
                                bg-background
                                p-4
                            "
            >
              <p
                className="
                                    text-sm
                                    font-semibold
                                    text-neutral-titulos
                                "
              >
                El resultat final es calcularà al servidor.
              </p>

              <p
                className="
                                    mt-1
                                    text-xs
                                    text-neutral
                                "
              >
                La base de dades és la font oficial. En finalitzar es
                confirmaran el resultat i les estadístiques i l'acta quedarà
                bloquejada.
              </p>
            </div>
          )}

          {error && (
            <div
              className="
                                mt-4
                                rounded-xl
                                border
                                border-red-200
                                bg-red-50
                                p-3
                                text-sm
                                text-red-700
                            "
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="
                        flex
                        flex-col-reverse
                        gap-3
                        border-t
                        border-border
                        bg-background
                        p-4
                        sm:flex-row
                        sm:justify-end
                    "
        >
          <button
            type="button"
            disabled={finalizando}
            onClick={onCancelar}
            className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-border
                            bg-card
                            px-5
                            text-sm
                            font-semibold
                            text-neutral-titulos
                            transition
                            hover:bg-background
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
          >
            Cancel·lar
          </button>

          <button
            type="button"
            disabled={bloqueado}
            onClick={onFinalizar}
            className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            bg-primary
                            px-5
                            text-sm
                            font-bold
                            text-white
                            transition
                            hover:opacity-90
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
          >
            {finalizando ? (
              <>
                <IconoCargando
                  className="
                                    h-5
                                    w-5
                                    animate-spin
                                "
                />
                Finalitzant...
              </>
            ) : (
              <>
                <IconoCheck
                  className="
                                    h-5
                                    w-5
                                "
                />
                Confirmar i finalitzar
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// EQUIPO POPUP FINAL
// ============================================================

function EquipPopupFinal({
  equipo,
  alineacion,
}: {
  equipo: Equipo | null;

  alineacion: "IZQUIERDA" | "DERECHA";
}) {
  const derecha = alineacion === "DERECHA";

  return (
    <div
      className={`
                flex
                min-w-0
                items-center
                gap-2
                ${derecha ? "justify-end text-right" : "justify-start text-left"}
            `}
    >
      {derecha && (
        <span
          className="
                        min-w-0
                        truncate
                        text-xs
                        font-bold
                        text-neutral-titulos
                    "
        >
          {equipo?.nombre ?? "Equip"}
        </span>
      )}

      {equipo?.escudo && (
        <img
          src={equipo.escudo}
          alt=""
          className="
                        h-9
                        w-9
                        shrink-0
                        object-contain
                    "
        />
      )}

      {!derecha && (
        <span
          className="
                        min-w-0
                        truncate
                        text-xs
                        font-bold
                        text-neutral-titulos
                    "
        >
          {equipo?.nombre ?? "Equip"}
        </span>
      )}
    </div>
  );
}

// ============================================================
// PLANTILLA
// ============================================================

function Plantilla({
  titulo,
  equipo,
  eventos,
  editable,
  onEvento,
}: {
  titulo: string;

  equipo: Equipo | null;

  eventos: EventoLocalActa[];

  editable: boolean;

  onEvento: (
    tipo: TipoEventoFutbol,

    equipo: Equipo,

    jugador: Jugador,
  ) => void;
}) {
  return (
    <section
      className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
            "
    >
      <div
        className="
                    border-b
                    border-border
                    p-4
                "
      >
        <div
          className="
                        flex
                        items-center
                        gap-3
                    "
        >
          {equipo?.escudo && (
            <div
              className="
                                flex
                                h-12
                                w-12
                                shrink-0
                                items-center
                                justify-center
                                overflow-hidden
                                rounded-lg
                                border
                                border-border
                                bg-white
                                p-1
                            "
            >
              <img
                src={equipo.escudo}
                alt={`Escut de ${equipo.nombre}`}
                className="
                                    h-full
                                    w-full
                                    object-contain
                                "
              />
            </div>
          )}

          <div className="min-w-0">
            <p
              className="
                                text-xs
                                font-bold
                                uppercase
                                tracking-[0.14em]
                                text-neutral
                            "
            >
              {titulo}
            </p>

            <h3
              className="
                                mt-1
                                truncate
                                font-bold
                                text-neutral-titulos
                            "
            >
              {equipo?.nombre ?? "Equip per determinar"}
            </h3>

            {equipo && (
              <p
                className="
                                    mt-1
                                    text-xs
                                    text-neutral
                                "
              >
                {equipo.jugadores.length} jugadors
              </p>
            )}
          </div>
        </div>
      </div>

      {!equipo ? (
        <p
          className="
                        p-6
                        text-sm
                        text-neutral
                    "
        >
          Equip pendent.
        </p>
      ) : equipo.jugadores.length === 0 ? (
        <p
          className="
                        p-6
                        text-sm
                        text-neutral
                    "
        >
          No hi ha jugadors disponibles.
        </p>
      ) : (
        <div
          className="
                        max-h-130
                        divide-y
                        divide-border
                        overflow-y-auto
                        overscroll-contain
                    "
        >
          {equipo.jugadores.map((jugador) => (
            <JugadorFila
              key={jugador.id}
              jugador={jugador}
              equipo={equipo}
              eventos={eventos}
              editable={editable}
              onEvento={onEvento}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// JUGADOR
// ============================================================

function JugadorFila({
  jugador,
  equipo,
  eventos,
  editable,
  onEvento,
}: {
  jugador: Jugador;

  equipo: Equipo;

  eventos: EventoLocalActa[];

  editable: boolean;

  onEvento: (
    tipo: TipoEventoFutbol,

    equipo: Equipo,

    jugador: Jugador,
  ) => void;
}) {
  const goles = contarJugador(eventos, jugador.id, "GOL");

  const amarillas = contarJugador(eventos, jugador.id, "TARJETA_AMARILLA");

  const rojas = contarJugador(eventos, jugador.id, "TARJETA_ROJA");

  const penaltisMarcados = contarJugador(
    eventos,
    jugador.id,
    "PENALTI_MARCADO",
  );

  const penaltisFallados = contarJugador(
    eventos,
    jugador.id,
    "PENALTI_FALLADO",
  );

  return (
    <div className="p-4">
      <div
        className="
                    flex
                    items-center
                    justify-between
                    gap-3
                "
      >
        <p
          className="
                        min-w-0
                        truncate
                        text-sm
                        font-semibold
                        text-neutral-titulos
                    "
        >
          {nombreJugador(jugador)}
        </p>

        <div
          className="
                        flex
                        shrink-0
                        flex-wrap
                        items-center
                        justify-end
                        gap-2
                    "
        >
          {goles > 0 && (
            <ContadorEvento
              icono={ICONOS_EVENTO.gol}
              cantidad={goles}
              className="text-neutral-titulos"
            />
          )}

          {amarillas > 0 && (
            <ContadorEvento
              icono={ICONOS_EVENTO.amarilla}
              cantidad={amarillas}
              className="text-yellow-500"
            />
          )}

          {rojas > 0 && (
            <ContadorEvento
              icono={ICONOS_EVENTO.roja}
              cantidad={rojas}
              className="text-red-600"
            />
          )}

          {penaltisMarcados > 0 && (
            <ContadorEvento
              icono={ICONOS_EVENTO.penaltiMarcado}
              cantidad={penaltisMarcados}
              className="text-secondary"
            />
          )}

          {penaltisFallados > 0 && (
            <ContadorEvento
              icono={ICONOS_EVENTO.penaltiFallado}
              cantidad={penaltisFallados}
              className="text-red-600"
            />
          )}
        </div>
      </div>

      <div
        className="
                    mt-3
                    grid
                    grid-cols-2
                    gap-2
                    sm:grid-cols-3
                "
      >
        <Boton
          disabled={!editable}
          texto="Gol"
          icono={ICONOS_EVENTO.gol}
          onClick={() => onEvento("GOL", equipo, jugador)}
        />

        <Boton
          disabled={!editable}
          texto="Groga"
          icono={ICONOS_EVENTO.amarilla}
          onClick={() => onEvento("TARJETA_AMARILLA", equipo, jugador)}
        />

        <Boton
          disabled={!editable}
          texto="Vermella"
          icono={ICONOS_EVENTO.roja}
          onClick={() => onEvento("TARJETA_ROJA", equipo, jugador)}
        />

        <Boton
          disabled={!editable}
          texto="Penal gol"
          icono={ICONOS_EVENTO.penaltiMarcado}
          onClick={() => onEvento("PENALTI_MARCADO", equipo, jugador)}
        />

        <Boton
          disabled={!editable}
          texto="Penal fallat"
          icono={ICONOS_EVENTO.penaltiFallado}
          onClick={() => onEvento("PENALTI_FALLADO", equipo, jugador)}
        />
      </div>
    </div>
  );
}

// ============================================================
// CONTADOR EVENTO
// ============================================================

function ContadorEvento({
  icono,
  cantidad,
  className,
}: {
  icono: string;

  cantidad: number;

  className: string;
}) {
  return (
    <span
      className={`
                inline-flex
                items-center
                gap-1
                text-xs
                font-bold
                ${className}
            `}
    >
      <img
        src={icono}
        alt=""
        draggable={false}
        className="
                    h-4
                    w-4
                    object-contain
                "
      />

      {cantidad}
    </span>
  );
}

// ============================================================
// HISTORIAL
// ============================================================

function Historial({
  eventos,
  editable,
  onAnular,
}: {
  eventos: EventoLocalActa[];

  editable: boolean;

  onAnular: (id: string) => void;
}) {
  const [revision, setRevision] = useState(0);

  // ========================================================
  // DESAPARECER ANULADOS A LOS 5 SEGUNDOS
  // ========================================================
  //
  // NO se borran del LocalStorage.
  //
  // Solamente dejan de mostrarse.
  //
  // ========================================================

  useEffect(() => {
    const ahora = Date.now();

    let siguiente: number | null = null;

    for (const evento of eventos) {
      if (evento.estado !== "ANULADO" || !evento.anuladoAt) {
        continue;
      }

      const fecha = new Date(evento.anuladoAt).getTime();

      if (Number.isNaN(fecha)) {
        continue;
      }

      const restante = 5000 - (ahora - fecha);

      if (restante <= 0) {
        continue;
      }

      if (siguiente === null || restante < siguiente) {
        siguiente = restante;
      }
    }

    if (siguiente === null) {
      return;
    }

    const temporizador = window.setTimeout(() => {
      setRevision((valor) => valor + 1);
    }, siguiente + 50);

    return () => {
      window.clearTimeout(temporizador);
    };
  }, [eventos, revision]);

  const visibles = eventos.filter((evento) => eventoVisibleHistorial(evento));

  const lista = [...visibles].reverse();

  return (
    <section
      className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
            "
    >
      <div
        className="
                    border-b
                    border-border
                    p-4
                    text-center
                "
      >
        <h3
          className="
                        font-bold
                        text-neutral-titulos
                    "
        >
          Historial
        </h3>

        <p
          className="
                        mt-1
                        text-xs
                        text-neutral
                    "
        >
          {visibles.length} incidències
        </p>
      </div>

      {lista.length === 0 ? (
        <p
          className="
                        p-6
                        text-center
                        text-sm
                        text-neutral
                    "
        >
          Encara no hi ha incidències.
        </p>
      ) : (
        <div
          className="
                        max-h-130
                        divide-y
                        divide-border
                        overflow-y-auto
                        overscroll-contain
                    "
        >
          {lista.map((evento) => (
            <div
              key={evento.clienteEventoID}
              className={`
                                    flex
                                    items-start
                                    justify-between
                                    gap-3
                                    p-4
                                    transition-opacity
                                    ${
                                      evento.estado === "ANULADO"
                                        ? "opacity-40"
                                        : ""
                                    }
                                `}
            >
              <div
                className="
                                        flex
                                        min-w-0
                                        gap-3
                                    "
              >
                <div
                  className="
                                            mt-0.5
                                            flex
                                            h-8
                                            w-8
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-lg
                                            bg-background
                                        "
                >
                  <IconoTipoEvento tipo={evento.tipoEvento} />
                </div>

                <div className="min-w-0">
                  <p
                    className="
                                                text-sm
                                                font-bold
                                                text-neutral-titulos
                                            "
                  >
                    {nombreEvento(evento.tipoEvento)}

                    {evento.minuto !== null ? ` · ${evento.minuto}'` : ""}
                  </p>

                  <p
                    className="
                                                mt-1
                                                truncate
                                                text-xs
                                                text-neutral
                                            "
                  >
                    {evento.jugadorNombre}
                  </p>

                  <p
                    className="
                                                truncate
                                                text-xs
                                                text-neutral
                                            "
                  >
                    {evento.equipoNombre}
                  </p>

                  {evento.estado === "ANULADO" && (
                    <p
                      className="
                                                    mt-1
                                                    text-[10px]
                                                    font-bold
                                                    uppercase
                                                    text-red-600
                                                "
                    >
                      Anul·lat
                    </p>
                  )}
                </div>
              </div>

              {editable && evento.estado === "ACTIVO" && (
                <button
                  type="button"
                  title="Anul·lar incidència"
                  aria-label="Anul·lar incidència"
                  onClick={() => onAnular(evento.clienteEventoID)}
                  className="
                                            flex
                                            h-8
                                            w-8
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-lg
                                            text-neutral
                                            transition
                                            hover:bg-background
                                            hover:text-red-600
                                        "
                >
                  <IconoDeshacer
                    className="
                                                h-4
                                                w-4
                                            "
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// EQUIPO MARCADOR
// ============================================================

function EquipoMarcador({
  lado,
  equipo,
}: {
  lado: string;

  equipo: Equipo | null;
}) {
  return (
    <div
      className="
                flex
                min-h-40
                flex-col
                items-center
                justify-center
                p-5
                text-center
            "
    >
      <p
        className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-neutral
                "
      >
        {lado}
      </p>

      {equipo?.escudo && (
        <div
          className="
                        mt-4
                        flex
                        h-16
                        w-16
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-xl
                        border
                        border-border
                        bg-white
                        p-1.5
                    "
        >
          <img
            src={equipo.escudo}
            alt={`Escut de ${equipo.nombre}`}
            className="
                            h-full
                            w-full
                            object-contain
                        "
          />
        </div>
      )}

      <h3
        className="
                    mt-3
                    text-lg
                    font-bold
                    text-neutral-titulos
                "
      >
        {equipo?.nombre ?? "Equip pendent"}
      </h3>
    </div>
  );
}

// ============================================================
// BOTÓN ACCIÓN
// ============================================================

function Boton({
  texto,
  icono,
  disabled,
  onClick,
}: {
  texto: string;

  icono: string;

  disabled: boolean;

  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="
                flex
                min-h-10
                items-center
                justify-center
                gap-2
                rounded-lg
                border
                border-border
                bg-background
                px-2
                text-xs
                font-bold
                text-neutral-titulos
                transition
                hover:border-primary
                disabled:cursor-not-allowed
                disabled:opacity-40
            "
    >
      <img
        src={icono}
        alt=""
        draggable={false}
        className="
                    h-4
                    w-4
                    shrink-0
                    object-contain
                "
      />

      <span>{texto}</span>
    </button>
  );
}

// ============================================================
// INFO
// ============================================================

function Info({
  icono,
  texto,
}: {
  icono: "CALENDARIO" | "UBICACION" | "DOCUMENTO";

  texto: string;
}) {
  return (
    <div
      className="
                flex
                items-center
                gap-2
            "
    >
      {icono === "CALENDARIO" && (
        <IconoCalendario
          className="
                        h-4
                        w-4
                    "
        />
      )}

      {icono === "UBICACION" && (
        <IconoUbicacion
          className="
                        h-4
                        w-4
                    "
        />
      )}

      {icono === "DOCUMENTO" && (
        <IconoDocumento
          className="
                        h-4
                        w-4
                    "
        />
      )}

      <span>{texto}</span>
    </div>
  );
}

// ============================================================
// ICONO TIPO EVENTO
// ============================================================

function IconoTipoEvento({
  tipo,
  grande = false,
}: {
  tipo: string;

  grande?: boolean;
}) {
  let ruta: string = ICONOS_EVENTO.gol;

  if (tipo === "TARJETA_AMARILLA") {
    ruta = ICONOS_EVENTO.amarilla;
  }

  if (tipo === "TARJETA_ROJA") {
    ruta = ICONOS_EVENTO.roja;
  }

  if (tipo === "PENALTI_MARCADO") {
    ruta = ICONOS_EVENTO.penaltiMarcado;
  }

  if (tipo === "PENALTI_FALLADO") {
    ruta = ICONOS_EVENTO.penaltiFallado;
  }

  return (
    <img
      src={ruta}
      alt=""
      draggable={false}
      className={`
                object-contain
                ${grande ? "h-6 w-6" : "h-5 w-5"}
            `}
    />
  );
}

// ============================================================
// SVG INLINE
// ============================================================

type IconProps = {
  className?: string;
};

function IconoCargando({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.2"
      />

      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoCandado({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5" y="10" width="14" height="10" rx="2" />

      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function IconoCalendario({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />

      <path d="M8 3v4" />

      <path d="M16 3v4" />

      <path d="M3 10h18" />
    </svg>
  );
}

function IconoUbicacion({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconoDocumento({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h8l4 4v14H6z" />

      <path d="M14 3v5h5" />

      <path d="M9 13h6" />

      <path d="M9 17h6" />
    </svg>
  );
}

function IconoDeshacer({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M9 7 4 12l5 5" />

      <path d="M4 12h9a7 7 0 0 1 7 7" />
    </svg>
  );
}

function IconoCheck({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />

      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

function IconoPendiente({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />

      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconoEnviar({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />

      <path d="M22 2 11 13" />
    </svg>
  );
}

function IconoBandera({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M5 21V4" />

      <path d="M5 5h11l-2 4 2 4H5" />
    </svg>
  );
}

// ============================================================
// HELPERS
// ============================================================

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "S'ha produït un error.";
}

function fechaMilisegundos(valor: string) {
  const fecha = new Date(valor).getTime();

  return Number.isNaN(fecha) ? 0 : fecha;
}

// ============================================================
// CONTAR EVENTOS PENDIENTES
// ============================================================
//
// Se cuentan EVENTOS, no operaciones.
//
// Si un evento tiene:
//
// creación pendiente + anulación pendiente
//
// el botón indica:
//
// 1 jugada pendiente
//
// ============================================================

function contarEventosPendientes(eventos: EventoLocalActa[]) {
  return eventos.filter((evento) => {
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
  }).length;
}

// ============================================================
// HISTORIAL VISIBLE
// ============================================================

function eventoVisibleHistorial(evento: EventoLocalActa) {
  if (evento.estado === "ACTIVO") {
    return true;
  }

  if (evento.estado !== "ANULADO" || !evento.anuladoAt) {
    return false;
  }

  const fecha = new Date(evento.anuladoAt).getTime();

  if (Number.isNaN(fecha)) {
    return false;
  }

  return Date.now() - fecha < 5000;
}

// ============================================================
// CONTADORES
// ============================================================

function contarEquipo(
  eventos: EventoLocalActa[],

  equipoID: string | null,

  tipo: string,
) {
  if (!equipoID) {
    return 0;
  }

  return eventos.filter(
    (evento) => evento.equipoID === equipoID && evento.tipoEvento === tipo,
  ).length;
}

function contarGolesEquipo(
  eventos: EventoLocalActa[],

  equipoID: string | null,
) {
  return (
    contarEquipo(eventos, equipoID, "GOL") +
    contarEquipo(eventos, equipoID, "PENALTI_MARCADO")
  );
}

function contarJugador(
  eventos: EventoLocalActa[],

  jugadorID: string,

  tipo: string,
) {
  return eventos.filter(
    (evento) => evento.jugadorID === jugadorID && evento.tipoEvento === tipo,
  ).length;
}

// ============================================================
// NOMBRES
// ============================================================

function nombreJugador(jugador: Jugador) {
  return (
    [jugador.nombre, jugador.apellido1, jugador.apellido2]
      .filter(
        (parte): parte is string =>
          typeof parte === "string" && Boolean(parte.trim()),
      )
      .join(" ") || "Jugador sense nom"
  );
}

function nombreEvento(tipo: string) {
  switch (tipo) {
    case "GOL":
      return "Gol";

    case "TARJETA_AMARILLA":
      return "Targeta groga";

    case "TARJETA_ROJA":
      return "Targeta vermella";

    case "PENALTI_MARCADO":
      return "Penal marcat";

    case "PENALTI_FALLADO":
      return "Penal fallat";

    default:
      return tipo;
  }
}

function nombreEstadoActa(estado: string) {
  switch (estado) {
    case "NO_INICIADA":
      return "No iniciada";

    case "EN_CURSO":
      return "En curs";

    case "BLOQUEADA":
      return "Bloquejada";

    case "FINALIZADA":
      return "Finalitzada";

    default:
      return estado;
  }
}

function nombreEstructura(estructura: Estructura) {
  return (
    estructura.ronda?.nombre ||
    estructura.grupo?.nombre ||
    estructura.fase?.nombre ||
    "Sense fase"
  );
}

function formatFecha(valor: string | null) {
  if (!valor) {
    return "Data pendent";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Data pendent";
  }

  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(fecha);
}
