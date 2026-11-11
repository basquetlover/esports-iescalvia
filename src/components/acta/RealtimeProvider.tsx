import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createClient } from "@supabase/supabase-js";

// ============================================================
// TIPOS
// ============================================================

export type EstadoRealtime =
  | "sin-configuracion"
  | "conectando"
  | "conectado"
  | "desconectado";

export type OrigenAvisoRealtime =
  | "acta"
  | "eventos"
  | "reconexion"
  | "visibilidad"
  | "local";

export type AvisoRealtime = {
  partidoID: string;
  origen: OrigenAvisoRealtime;
  recibidoAt: number;
};

export type ConfiguracionRealtime = {
  partidoID: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  children: ReactNode;
};

type Escuchador = (aviso: AvisoRealtime) => void;

type ContextoRealtime = {
  partidoID: string;
  estado: EstadoRealtime;
  ultimoAviso: AvisoRealtime | null;
  suscribir: (escuchador: Escuchador) => () => void;
  notificarCambioLocal: () => void;
};

// ============================================================
// CONSTANTES
// ============================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESQUEMA = "public";

const TABLA_ACTAS = "acta_partidos";
const TABLA_EVENTOS = "acta_eventos";

// ============================================================
// CONTEXTO COMPARTIDO
// ============================================================

const RealtimeContext = createContext<ContextoRealtime | null>(null);

// ============================================================
// PROVEEDOR
// ============================================================

/**
 * Única raíz Realtime para los componentes React
 * que trabajan sobre un mismo partido.
 *
 * Las credenciales públicas deben recibirse como
 * propiedades desde la página Astro.
 *
 * No importa variables .env ni módulos de servidor.
 *
 * El cliente Supabase se usa exclusivamente para
 * recibir notificaciones de cambios.
 *
 * Las consultas privadas y todas las escrituras
 * deben realizarse desde APIs autenticadas de Astro.
 */
export function RealtimeProvider({
  partidoID,
  supabaseUrl,
  supabaseAnonKey,
  children,
}: ConfiguracionRealtime) {
  const [estado, setEstado] = useState<EstadoRealtime>("sin-configuracion");

  const [ultimoAviso, setUltimoAviso] = useState<AvisoRealtime | null>(null);

  const escuchadoresRef = useRef<Set<Escuchador>>(new Set());

  const idNormalizado = partidoID.trim().toLowerCase();

  // ==========================================================
  // PUBLICAR AVISOS ENTRE COMPONENTES
  // ==========================================================

  const emitirAviso = useCallback(
    (origen: OrigenAvisoRealtime) => {
      const aviso: AvisoRealtime = {
        partidoID: idNormalizado,
        origen,
        recibidoAt: Date.now(),
      };

      setUltimoAviso(aviso);

      for (const escuchador of Array.from(escuchadoresRef.current)) {
        try {
          escuchador(aviso);
        } catch (error) {
          console.error("Error en un escoltador Realtime:", error);
        }
      }
    },
    [idNormalizado],
  );

  const suscribir = useCallback((escuchador: Escuchador) => {
    escuchadoresRef.current.add(escuchador);

    return () => {
      escuchadoresRef.current.delete(escuchador);
    };
  }, []);

  const notificarCambioLocal = useCallback(() => {
    emitirAviso("local");
  }, [emitirAviso]);

  // ==========================================================
  // CONEXIÓN SUPABASE REALTIME
  // ==========================================================

  useEffect(() => {
    if (
      !UUID.test(idNormalizado) ||
      !supabaseUrl.trim() ||
      !supabaseAnonKey.trim()
    ) {
      setEstado("sin-configuracion");
      return;
    }

    let activo = true;

    setEstado("conectando");

    /**
     * El cliente se construye en React una sola vez
     * por instancia del proveedor.
     *
     * Solo recibe las credenciales públicas.
     * Nunca se utiliza la SERVICE_ROLE_KEY.
     */
    let cliente: ReturnType<typeof createClient>;

    try {
      cliente = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    } catch (error) {
      console.error("No s'ha pogut crear la connexió Realtime:", error);

      setEstado("desconectado");
      return;
    }

    let suscritoAnteriormente = false;

    const canal = cliente
      .channel(`esports-acta-${idNormalizado}`)

      // ======================================================
      // CAMBIOS EN EL ACTA
      // ======================================================

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: ESQUEMA,
          table: TABLA_ACTAS,
          filter: `partido_id=eq.${idNormalizado}`,
        },
        () => {
          if (!activo) return;

          /**
           * Incluye:
           * - Creación de la primera acta
           * - Cambio de controlador
           * - Bloqueo del acta
           * - Finalización
           * - Cambio de estado operativo
           *
           * El componente debe consultar la API
           * para obtener el estado autorizado.
           */
          emitirAviso("acta");
        },
      )

      // ======================================================
      // CAMBIOS EN LAS JUGADAS
      // ======================================================

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: ESQUEMA,
          table: TABLA_EVENTOS,
          filter: `partido_id=eq.${idNormalizado}`,
        },
        () => {
          if (!activo) return;

          /**
           * Incluye nuevas jugadas y modificaciones.
           *
           * No se confía directamente en el contenido
           * recibido desde Realtime.
           */
          emitirAviso("eventos");
        },
      )

      // ======================================================
      // ESTADO DE LA CONEXIÓN
      // ======================================================

      .subscribe((estadoCanal) => {
        if (!activo) return;

        if (estadoCanal === "SUBSCRIBED") {
          setEstado("conectado");

          /**
           * Al establecer la conexión o reconectar,
           * se solicita una nueva lectura.
           *
           * Así se recuperan posibles cambios
           * producidos mientras no había conexión.
           */
          if (suscritoAnteriormente) {
            emitirAviso("reconexion");
          } else {
            suscritoAnteriormente = true;
            emitirAviso("reconexion");
          }

          return;
        }

        if (
          estadoCanal === "CHANNEL_ERROR" ||
          estadoCanal === "TIMED_OUT" ||
          estadoCanal === "CLOSED"
        ) {
          setEstado("desconectado");
        }
      });

    // ========================================================
    // RECUPERACIÓN AL VOLVER A LA PESTAÑA
    // ========================================================

    const comprobarVisibilidad = () => {
      if (!activo) return;

      if (document.visibilityState === "visible") {
        emitirAviso("visibilidad");
      }
    };

    document.addEventListener("visibilitychange", comprobarVisibilidad);

    // ========================================================
    // LIMPIEZA
    // ========================================================

    return () => {
      activo = false;

      document.removeEventListener("visibilitychange", comprobarVisibilidad);

      void cliente.removeChannel(canal);
    };
  }, [idNormalizado, supabaseUrl, supabaseAnonKey, emitirAviso]);

  // ==========================================================
  // CONTEXTO DISPONIBLE PARA LOS COMPONENTES
  // ==========================================================

  const valor = useMemo<ContextoRealtime>(
    () => ({
      partidoID: idNormalizado,
      estado,
      ultimoAviso,
      suscribir,
      notificarCambioLocal,
    }),
    [idNormalizado, estado, ultimoAviso, suscribir, notificarCambioLocal],
  );

  return (
    <RealtimeContext.Provider value={valor}>
      {children}
    </RealtimeContext.Provider>
  );
}

// ============================================================
// HOOK PARA CONSULTAR EL CONTEXTO
// ============================================================

export function useActaRealtime(): ContextoRealtime {
  const contexto = useContext(RealtimeContext);

  if (!contexto) {
    throw new Error(
      "useActaRealtime s'ha d'utilitzar dins de RealtimeProvider.",
    );
  }

  return contexto;
}

// ============================================================
// HOOK PARA ESCUCHAR CAMBIOS
// ============================================================

/**
 * Permite escuchar cambios sin crear otro cliente
 * ni otro canal de Supabase.
 *
 * El callback puede cambiar entre renderizados:
 * se conserva siempre su versión más reciente.
 */
export function useAvisosActaRealtime(callback: Escuchador): void {
  const { suscribir } = useActaRealtime();

  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return suscribir((aviso) => {
      callbackRef.current(aviso);
    });
  }, [suscribir]);
}

export default RealtimeProvider;
