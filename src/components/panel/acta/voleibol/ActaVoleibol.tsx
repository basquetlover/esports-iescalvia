import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";
import {
  actualizarSincronizacionAnulacion,
  actualizarSincronizacionCreacion,
  anularEventoLocal,
  eliminarActaLocalTrasFinalizacion,
  guardarActaLocal,
  leerActaLocal,
  obtenerEventosPendientesAnulacion,
  obtenerEventosPendientesCreacion,
  puedeIntentarFinalizacion,
  registrarEventoLocal,
  type ConfirmacionFinalizacionActa,
  type EventoLocalActa,
} from "@utils/acta/localStorage";
import {
  calcularEstadoVoleibol,
  evaluarCierreVoleibol,
  normalizarConfiguracionVoleibol,
  TIPOS_PUNTO_VOLEIBOL,
  type ConfiguracionVoleibol,
  type ModoCierreVoleibol,
  type TipoPuntoVoleibol,
} from "@utils/acta/voleibol";
import Informes from "../Informes";
type Jugador = {
  id: string;
  equipo_id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  orden: number | null;
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

type Props = {
  partido: {
    id: string;
    codigo: string;
    nombre: string | null;
    pista: string | null;
  };
  estructura: {
    fase: { nombre: string; tipo: string } | null;
    grupo: { nombre: string } | null;
    ronda: { nombre: string; tipo: string } | null;
  };
  equipos: { local: Lado; visitante: Lado };
  acta: {
    id: string;
    estado: string;
    configuracion_snapshot?: Record<string, unknown> | null;
  } | null;
  editable: boolean;
};

type EventoServidor = {
  id: string;
  cliente_evento_id: string;
  tipo_evento: string;
  equipo_id: string | null;
  equipo_nombre: string | null;
  jugador_id: string | null;
  jugador_nombre: string | null;
  periodo: number | null;
  tiempo_juego_segundos: number | null;
  datos: Record<string, unknown> | null;
  orden: number;
  estado: string;
  created_at: string;
  anulado_at: string | null;
  motivo_anulacion: string | null;
};

type LecturaServidor = {
  success: true;
  acta: { estado: string; version: number };
  control: { puedeEscribir: boolean; controlToken: string | null };
  eventos: EventoServidor[];
};

type ResultadoOperacion = {
  success: boolean;
  accion: "CREAR" | "ANULAR";
  clienteEventoID: string | null;
  evento: EventoServidor | null;
  mensaje: string | null;
};

type RespuestaEnvio = {
  success: true;
  resultados: ResultadoOperacion[];
  eventos: EventoServidor[];
};

type Informe = {
  id: string;
  tipo: "GENERIC" | "SUSPENSION";
  contenido: string;
  equipoResponsableID: string | null;
  creadoAt: string;
  sincronizado: boolean;
};

type Dialogo =
  | "CONFIG"
  | "RELOJ"
  | "EDITAR"
  | "ELIMINAR"
  | "FIN_SET"
  | "INFORMES"
  | null;

type Seleccion = { equipoID: string; jugador: Jugador };
type FinSetSeleccionado = { numero: number; cierreID: string };

// ============================================================
// CONFIGURACIÓN: REALTIME Y ENVÍO DE EVENTOS DE VOLEIBOL
// ============================================================
// Nunca se consulta el historial de forma periódica.
// - GET inicial: una vez cuando se abre el acta.
// - POST: después de cada jugada o anulación (con un pequeño debounce).
// - Realtime: sólo si está activado y existen variables PUBLIC_ de Supabase.
// - GET adicional: cuando Supabase avisa de un cambio, al reconectar
//   Realtime, al pulsar Actualitzar (si se añade) o antes del cierre.
// Las consultas periódicas que hay más abajo son EXCLUSIVAMENTE del reloj local.
const CONFIGURACION_REALTIME = {
  activado: true,
  esquema: "public",
  tabla: "acta_eventos",
  tablaActa: "acta_partidos",
  prefijoCanal: "acta-volei-",
  url: import.meta.env.PUBLIC_SUPABASE_URL ?? "",
  anonKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

const CONFIGURACION_ENVIO = {
  automatico: true,
  retrasoMs: 250, // Se agrupan toques próximos; NO es un intervalo de lectura.
} as const;
// Iconos personalizados opcionales (SVG o PNG): archivos en public/iconos/panell/acta/voleibol/punts/.
// Se conserva el icono SVG integrado si falta el archivo elegido.
const IMAGENES_PUNTO: Record<TipoPuntoVoleibol, string> = {
  DIRECTO: "/iconos/panell/acta/voleibol/punts/directe.svg",
  BLOQUEO: "/iconos/panell/acta/voleibol/punts/bloqueig.svg",
  REMATE: "/iconos/panell/acta/voleibol/punts/rematada.svg",
  ERROR: "/iconos/panell/acta/voleibol/punts/error.svg",
};

const NOMBRES_TIPO: Record<TipoPuntoVoleibol, string> = {
  DIRECTO: "Directe",
  BLOQUEO: "Bloqueig",
  REMATE: "Rematada",
  ERROR: "Error",
};
function nombreJugador(jugador: Jugador): string {
  return (
    [jugador.nombre, jugador.apellido1, jugador.apellido2]
      .filter(Boolean)
      .join(" ") || "Jugador"
  );
}

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "S'ha produït un error inesperat.";
}

function segundosTexto(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function interpretarConfiguracion(acta: Props["acta"]): ConfiguracionVoleibol {
  const volei = acta?.configuracion_snapshot?.voleibol;
  if (!volei || typeof volei !== "object" || Array.isArray(volei)) {
    return normalizarConfiguracionVoleibol();
  }
  const origen = volei as Record<string, unknown>;
  const entrada: Partial<ConfiguracionVoleibol> = {};
  for (const campo of [
    "setsParaGanar",
    "puntosSet",
    "diferenciaSet",
    "puntosExtraSet",
    "diferenciaExtraSet",
  ] as const) {
    const valor = origen[campo];
    if (typeof valor === "number") entrada[campo] = valor;
  }
  return normalizarConfiguracionVoleibol(entrada);
}

function convertirEvento(evento: EventoServidor): EventoLocalActa {
  return {
    clienteEventoID: evento.cliente_evento_id,
    tipoEvento: evento.tipo_evento,
    equipoID: evento.equipo_id,
    equipoNombre: evento.equipo_nombre,
    jugadorID: evento.jugador_id,
    jugadorNombre: evento.jugador_nombre,
    periodo: evento.periodo,
    minuto: null,
    tiempoJuegoSegundos: evento.tiempo_juego_segundos,
    datos: evento.datos ?? {},
    estado: evento.estado === "ANULADO" ? "ANULADO" : "ACTIVO",
    createdAt: evento.created_at,
    anuladoAt: evento.anulado_at,
    motivoAnulacion: evento.motivo_anulacion,
    sincronizacionCreacion: {
      estado: "SINCRONIZADO",
      intentos: 1,
      sincronizadoAt: evento.created_at,
      error: null,
    },
    servidorEventoID: evento.id,
    sincronizacionAnulacion:
      evento.estado === "ANULADO"
        ? {
            estado: "SINCRONIZADO",
            intentos: 1,
            sincronizadoAt: evento.anulado_at,
            error: null,
          }
        : null,
  };
}

function fusionarServidor(
  partidoID: string,
  remotos: EventoServidor[],
): EventoLocalActa[] {
  const estado = leerActaLocal(partidoID);
  const pendientes = new Map(estado.eventos.map((e) => [e.clienteEventoID, e]));
  const ordenados: EventoLocalActa[] = [];
  for (const remoto of [...remotos].sort((a, b) => a.orden - b.orden)) {
    const local = pendientes.get(remoto.cliente_evento_id);
    pendientes.delete(remoto.cliente_evento_id);
    const recibido = convertirEvento(remoto);
    if (local?.estado === "ANULADO" && remoto.estado === "ACTIVO") {
      ordenados.push({
        ...recibido,
        estado: "ANULADO",
        anuladoAt: local.anuladoAt,
        motivoAnulacion: local.motivoAnulacion,
        sincronizacionAnulacion: local.sincronizacionAnulacion,
      });
    } else {
      ordenados.push(recibido);
    }
  }
  estado.eventos = [...ordenados, ...pendientes.values()];
  guardarActaLocal(estado);
  return estado.eventos;
}

function contarPendientes(eventos: EventoLocalActa[]): number {
  return eventos.reduce(
    (total, evento) =>
      total +
      (evento.sincronizacionCreacion.estado === "SINCRONIZADO" ? 0 : 1) +
      (evento.sincronizacionAnulacion &&
      evento.sincronizacionAnulacion.estado !== "SINCRONIZADO"
        ? 1
        : 0),
    0,
  );
}

async function respuestaJSON(
  respuesta: Response,
): Promise<Record<string, unknown>> {
  const datos: unknown = await respuesta.json().catch(() => null);
  if (
    !respuesta.ok ||
    !datos ||
    typeof datos !== "object" ||
    Array.isArray(datos) ||
    (datos as Record<string, unknown>).success !== true
  ) {
    const mensaje =
      datos && typeof datos === "object" && "mensaje" in datos
        ? String(datos.mensaje)
        : "No s'ha pogut contactar amb el servidor.";
    throw new Error(mensaje);
  }
  return datos as Record<string, unknown>;
}

export default function ActaVoleibol({
  partido,
  estructura,
  equipos,
  acta,
  editable,
}: Props) {
  const local = equipos.local.equipo;
  const visitante = equipos.visitante.equipo;
  // El servidor conserva la configuración del acta. Sólo actualizamos el motor
  // cuando la futura API de configuración confirma el cambio.
  const configuracionInicial = useMemo(
    () => interpretarConfiguracion(acta),
    [acta],
  );
  const [configuracion, setConfiguracion] =
    useState<ConfiguracionVoleibol>(configuracionInicial);
  const [configuracionFormulario, setConfiguracionFormulario] =
    useState<ConfiguracionVoleibol>(configuracionInicial);
  const [guardandoConfiguracion, setGuardandoConfiguracion] = useState(false);
  useEffect(() => {
    setConfiguracion(configuracionInicial);
    setConfiguracionFormulario(configuracionInicial);
  }, [configuracionInicial]);
  const [eventos, setEventos] = useState<EventoLocalActa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [portalListo, setPortalListo] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [controlToken, setControlToken] = useState<string | null>(null);
  const [permisoServidor, setPermisoServidor] = useState(false);
  const [estadoServidor, setEstadoServidor] = useState(
    acta?.estado ?? "EN_CURSO",
  );
  const [sincronizando, setSincronizando] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] =
    useState<TipoPuntoVoleibol | null>(null);
  const [jugadorSeleccionado, setJugadorSeleccionado] =
    useState<Seleccion | null>(null);
  const [pantalla, setPantalla] = useState<"ACTA" | "RESUMEN">("ACTA");
  const [modoCierre, setModoCierre] = useState<ModoCierreVoleibol>("NORMAL");
  const [confirmadoForzado, setConfirmadoForzado] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [idEditar, setIdEditar] = useState<string | null>(null);
  const [fiSetSeleccionado, setFiSetSeleccionado] =
    useState<FinSetSeleccionado | null>(null);
  const [edicionTipo, setEdicionTipo] = useState<TipoPuntoVoleibol>("DIRECTO");
  const [edicionEquipoID, setEdicionEquipoID] = useState("");
  const [edicionJugadorID, setEdicionJugadorID] = useState("");
  const [avisoSet, setAvisoSet] = useState<string | null>(null);
  const [informes, setInformes] = useState<Informe[]>([]);
  const [tipoInforme, setTipoInforme] = useState<Informe["tipo"]>("GENERIC");
  const [textoInforme, setTextoInforme] = useState("");
  const [equipoInforme, setEquipoInforme] = useState("");
  const [relojSegundos, setRelojSegundos] = useState(0);
  const [relojActivo, setRelojActivo] = useState(false);
  const inicioRelojRef = useRef<number | null>(null);
  const baseRelojRef = useRef(0);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulsacionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enviandoRef = useRef(false);
  const ultimaPulsacionRef = useRef(0);
  // Únicamente el acta de VOLEIBOL se muestra a pantalla completa.
  // El portal evita que el layout del panel se superponga o recorte el acta.
  useEffect(() => {
    setPortalListo(true);
    const estabaBloqueado = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      if (!estabaBloqueado) document.body.classList.remove("overflow-hidden");
    };
  }, []);

  const registroInformes = `esports-iescalvia:acta:informes:${partido.id}`;
  const registroReloj = `esports-iescalvia:acta:reloj:${partido.id}`;

  const puedeEscribir =
    editable &&
    permisoServidor &&
    Boolean(controlToken) &&
    estadoServidor === "EN_CURSO" &&
    !finalizando;
  const pendientes = contarPendientes(eventos);

  const refrescarLocal = useCallback(() => {
    const local = leerActaLocal(partido.id).eventos;
    setEventos([...local]);
    return local;
  }, [partido.id]);

  const leerServidor = useCallback(
    async (silencioso = false): Promise<boolean> => {
      try {
        const respuesta = await fetch(
          `/api/panell/acta/eventos?partidoID=${encodeURIComponent(partido.id)}`,
          { credentials: "same-origin", cache: "no-store" },
        );
        const datos = (await respuestaJSON(
          respuesta,
        )) as unknown as LecturaServidor;
        setPermisoServidor(datos.control.puedeEscribir);
        setControlToken(datos.control.controlToken);
        setEstadoServidor(datos.acta.estado);
        setEventos([...fusionarServidor(partido.id, datos.eventos)]);
        setErrorServidor(null);
        return true;
      } catch (error) {
        if (!silencioso) setErrorServidor(mensajeError(error));
        refrescarLocal();
        return false;
      }
    },
    [partido.id, refrescarLocal],
  );

  const sincronizar = useCallback(async () => {
    if (
      enviandoRef.current ||
      !controlToken ||
      !editable ||
      estadoServidor !== "EN_CURSO"
    )
      return;
    const creaciones = obtenerEventosPendientesCreacion(partido.id);
    const anulaciones = obtenerEventosPendientesAnulacion(partido.id);
    if (!creaciones.length && !anulaciones.length) return;
    enviandoRef.current = true;
    setSincronizando(true);
    setErrorAccion(null);
    const operaciones = [
      ...creaciones.map((e) => ({
        accion: "CREAR" as const,
        evento: {
          clienteEventoID: e.clienteEventoID,
          tipoEvento: e.tipoEvento,
          equipoID: e.equipoID,
          equipoNombre: e.equipoNombre,
          jugadorID: e.jugadorID,
          jugadorNombre: e.jugadorNombre,
          periodo: e.periodo,
          minuto: null,
          tiempoJuegoSegundos: e.tiempoJuegoSegundos,
          datos: e.datos,
          createdAt: e.createdAt,
        },
      })),
      ...anulaciones.map((e) => ({
        accion: "ANULAR" as const,
        clienteEventoID: e.clienteEventoID,
        anuladoAt: e.anuladoAt,
        motivoAnulacion: e.motivoAnulacion,
      })),
    ];
    for (const e of creaciones) {
      actualizarSincronizacionCreacion(partido.id, e.clienteEventoID, {
        estado: "SINCRONIZANDO",
        intentos: e.sincronizacionCreacion.intentos + 1,
      });
    }
    for (const e of anulaciones) {
      actualizarSincronizacionAnulacion(partido.id, e.clienteEventoID, {
        estado: "SINCRONIZANDO",
        intentos: (e.sincronizacionAnulacion?.intentos ?? 0) + 1,
      });
    }
    refrescarLocal();
    try {
      const respuesta = await fetch("/api/panell/acta/eventos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoID: partido.id,
          controlToken,
          operaciones,
        }),
      });
      const datos = (await respuestaJSON(
        respuesta,
      )) as unknown as RespuestaEnvio;
      const errores: string[] = [];
      for (const resultado of datos.resultados) {
        if (!resultado.clienteEventoID) continue;
        const estado = resultado.success ? "SINCRONIZADO" : "ERROR";
        if (resultado.accion === "CREAR") {
          actualizarSincronizacionCreacion(
            partido.id,
            resultado.clienteEventoID,
            {
              estado,
              servidorEventoID: resultado.evento?.id ?? undefined,
              sincronizadoAt: resultado.success
                ? new Date().toISOString()
                : null,
              error: resultado.mensaje,
            },
          );
        } else {
          actualizarSincronizacionAnulacion(
            partido.id,
            resultado.clienteEventoID,
            {
              estado,
              sincronizadoAt: resultado.success
                ? new Date().toISOString()
                : null,
              error: resultado.mensaje,
            },
          );
        }
        if (!resultado.success)
          errores.push(resultado.mensaje ?? "Error en enviar una jugada.");
      }
      setEventos([...fusionarServidor(partido.id, datos.eventos)]);
      if (errores.length) setErrorAccion(errores.join(" "));
    } catch (error) {
      for (const e of creaciones) {
        actualizarSincronizacionCreacion(partido.id, e.clienteEventoID, {
          estado: "ERROR",
          error: mensajeError(error),
        });
      }
      for (const e of anulaciones) {
        actualizarSincronizacionAnulacion(partido.id, e.clienteEventoID, {
          estado: "ERROR",
          error: mensajeError(error),
        });
      }
      setErrorAccion(
        `Jugades desades al dispositiu, pendents d'enviar: ${mensajeError(error)}`,
      );
      refrescarLocal();
    } finally {
      enviandoRef.current = false;
      setSincronizando(false);
      const hiHaPendents = leerActaLocal(partido.id).eventos.some(
        (e) =>
          e.sincronizacionCreacion.estado === "PENDIENTE" ||
          e.sincronizacionAnulacion?.estado === "PENDIENTE",
      );
      if (hiHaPendents && temporizadorRef.current === null) {
        temporizadorRef.current = setTimeout(() => {
          temporizadorRef.current = null;
          void sincronizar();
        }, CONFIGURACION_ENVIO.retrasoMs);
      }
    }
  }, [partido.id, controlToken, editable, estadoServidor, refrescarLocal]);

  const programarEnvio = useCallback(() => {
    if (!CONFIGURACION_ENVIO.automatico || temporizadorRef.current !== null)
      return;
    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null;
      void sincronizar();
    }, CONFIGURACION_ENVIO.retrasoMs);
  }, [sincronizar]);

  useEffect(() => {
    try {
      refrescarLocal();
      const texto = window.localStorage.getItem(registroInformes);
      if (texto) {
        const recuperado: unknown = JSON.parse(texto);
        if (Array.isArray(recuperado)) setInformes(recuperado as Informe[]);
      }
      const reloj = Number(window.localStorage.getItem(registroReloj) ?? "0");
      if (Number.isSafeInteger(reloj) && reloj >= 0 && reloj <= 86400) {
        baseRelojRef.current = reloj;
        setRelojSegundos(reloj);
      }
    } catch (error) {
      setErrorAccion(
        `No s'ha pogut recuperar la còpia local: ${mensajeError(error)}`,
      );
    }
    let activo = true;
    void leerServidor().finally(() => {
      if (activo) setCargando(false);
    });
    // Sin polling de eventos: la siguiente lectura será por Realtime,
    // cierre de acta, o acción explícita. No se crea ningún setInterval aquí.
    return () => {
      activo = false;
      if (temporizadorRef.current !== null)
        clearTimeout(temporizadorRef.current);
      if (pulsacionRef.current !== null) clearTimeout(pulsacionRef.current);
    };
  }, [refrescarLocal, leerServidor, registroInformes, registroReloj]);

  useEffect(() => {
    const { activado, esquema, tabla, tablaActa, prefijoCanal, url, anonKey } =
      CONFIGURACION_REALTIME;
    if (!activado || !acta?.id || !url || !anonKey) return;

    // El navegador sólo usa la clave ANON PUBLIC; nunca service_role.
    // La lectura con permisos sigue haciéndose por la API del proyecto.
    const clienteRealtime = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let vigente = true;
    let consultando = false;
    let releerDespues = false;

    const actualizarPorCambio = async () => {
      if (!vigente) return;
      if (consultando) {
        releerDespues = true;
        return;
      }
      consultando = true;
      do {
        releerDespues = false;
        await leerServidor(true);
      } while (vigente && releerDespues);
      consultando = false;
    };

    const canal = clienteRealtime
      .channel(`${prefijoCanal}${acta.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: esquema,
          table: tabla,
          filter: `acta_id=eq.${acta.id}`,
        },
        () => {
          void actualizarPorCambio();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: esquema,
          table: tablaActa,
          filter: `id=eq.${acta.id}`,
        },
        () => {
          void actualizarPorCambio();
        },
      )
      .subscribe((estado) => {
        // Tras un corte, un GET recupera cambios perdidos. No hay polling.
        if (estado === "SUBSCRIBED") void actualizarPorCambio();
      });

    return () => {
      vigente = false;
      void clienteRealtime.removeChannel(canal);
    };
  }, [acta?.id, leerServidor]);

  useEffect(() => {
    if (!relojActivo) return;
    inicioRelojRef.current = Date.now();
    const intervalo = setInterval(() => {
      const actual =
        baseRelojRef.current +
        Math.floor(
          (Date.now() - (inicioRelojRef.current ?? Date.now())) / 1000,
        );
      setRelojSegundos(actual);
      try {
        window.localStorage.setItem(registroReloj, String(actual));
      } catch {
        /* opcional */
      }
    }, 250);
    return () => clearInterval(intervalo);
  }, [relojActivo, registroReloj]);

  const detenerReloj = useCallback(() => {
    if (inicioRelojRef.current !== null) {
      baseRelojRef.current += Math.floor(
        (Date.now() - inicioRelojRef.current) / 1000,
      );
      setRelojSegundos(baseRelojRef.current);
      try {
        window.localStorage.setItem(
          registroReloj,
          String(baseRelojRef.current),
        );
      } catch {
        /* opcional */
      }
    }
    inicioRelojRef.current = null;
    setRelojActivo(false);
  }, [registroReloj]);

  const estadoCalculado = useMemo(() => {
    if (!local || !visitante)
      return {
        estado: null,
        error: "Els dos equips encara no estan resolts.",
      };
    try {
      return {
        estado: calcularEstadoVoleibol(
          eventos,
          local.id,
          visitante.id,
          configuracion,
        ),
        error: null,
      };
    } catch (error) {
      return { estado: null, error: mensajeError(error) };
    }
  }, [eventos, local, visitante, configuracion]);

  const marcador = estadoCalculado.estado;
  const setActual = marcador?.setActual;
  const ultimoEventoActivo = [...eventos]
    .reverse()
    .find((e) => e.estado === "ACTIVO");
  const historial = marcador?.historial ?? [];
  const informePendiente = informes.some((e) => !e.sincronizado);
  const evaluacion = marcador
    ? evaluarCierreVoleibol(marcador, modoCierre)
    : null;

  const anotarPunto = useCallback(
    (tipo: TipoPuntoVoleibol, equipoID: string, jugador: Jugador) => {
      if (!puedeEscribir || !local || !visitante || !marcador?.setActual)
        return;
      if (Date.now() - ultimaPulsacionRef.current < 300) return;
      ultimaPulsacionRef.current = Date.now();
      try {
        registrarEventoLocal(partido.id, {
          tipoEvento: tipo,
          equipoID,
          equipoNombre: equipoID === local.id ? local.nombre : visitante.nombre,
          jugadorID: jugador.id,
          jugadorNombre: nombreJugador(jugador),
          periodo: marcador.setActual.numero,
          tiempoJuegoSegundos: relojSegundos,
          datos: {},
        });
        const nuevos = refrescarLocal();
        const calculado = calcularEstadoVoleibol(
          nuevos,
          local.id,
          visitante.id,
          configuracion,
        );
        if (
          calculado.setsFinalizados.length > marcador.setsFinalizados.length
        ) {
          const cerrado = calculado.setsFinalizados.at(-1)!;
          setAvisoSet(
            `Set ${cerrado.numero} finalitzat: ${cerrado.puntosLocal} - ${cerrado.puntosVisitante}`,
          );
          detenerReloj();
        }
        setTipoSeleccionado(null);
        setJugadorSeleccionado(null);
        programarEnvio();
      } catch (error) {
        setErrorAccion(mensajeError(error));
      }
    },
    [
      puedeEscribir,
      local,
      visitante,
      marcador,
      partido.id,
      relojSegundos,
      refrescarLocal,
      configuracion,
      detenerReloj,
      programarEnvio,
    ],
  );

  function abrirConfiguracion() {
    setConfiguracionFormulario({ ...configuracion });
    setDialogo("CONFIG");
  }

  async function guardarConfiguracion() {
    if (!puedeEscribir || !controlToken || guardandoConfiguracion) return;
    if (pendientes > 0 || sincronizando) {
      setErrorAccion(
        "Sincronitza les jugades pendents abans de modificar les regles.",
      );
      return;
    }
    if (!local || !visitante) return;
    let validada: ConfiguracionVoleibol;
    try {
      validada = normalizarConfiguracionVoleibol(configuracionFormulario);
      calcularEstadoVoleibol(eventos, local.id, visitante.id, validada);
    } catch (error) {
      setErrorAccion(`Configuració no vàlida: ${mensajeError(error)}`);
      return;
    }
    setGuardandoConfiguracion(true);
    setErrorAccion(null);
    try {
      const respuesta = await fetch("/api/panell/acta/configuracion", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoID: partido.id,
          controlToken,
          configuracion: validada,
        }),
      });
      const datos = await respuestaJSON(respuesta);
      const guardada = datos.configuracion as ConfiguracionVoleibol | undefined;
      setConfiguracion(normalizarConfiguracionVoleibol(guardada ?? validada));
      setDialogo(null);
    } catch (error) {
      setErrorAccion(`No s'han pogut desar les regles: ${mensajeError(error)}`);
    } finally {
      setGuardandoConfiguracion(false);
    }
  }

  function seleccionarTipo(tipo: TipoPuntoVoleibol) {
    setTipoSeleccionado(tipo);
    if (jugadorSeleccionado) {
      anotarPunto(
        tipo,
        jugadorSeleccionado.equipoID,
        jugadorSeleccionado.jugador,
      );
    }
  }

  function seleccionarJugador(equipoID: string, jugador: Jugador) {
    setJugadorSeleccionado({ equipoID, jugador });
    if (tipoSeleccionado) anotarPunto(tipoSeleccionado, equipoID, jugador);
  }

  // Las jugadas de un set cerrado SOLO se liberan deshaciendo su "Fi de set".
  function estaProtegida(eventoID: string): boolean {
    const punto = historial.find((p) => p.clienteEventoID === eventoID);
    return (
      !punto ||
      Boolean(
        marcador?.setsFinalizados.some((s) => s.numero === punto.numeroSet),
      )
    );
  }

  function anularPunto(eventoID: string, porCierre = false) {
    if (!puedeEscribir) return;
    if (!porCierre && estaProtegida(eventoID)) {
      setErrorAccion(
        "Aquesta jugada pertany a un set tancat. Primer desfés el fi de set.",
      );
      return;
    }
    try {
      anularEventoLocal(
        partido.id,
        eventoID,
        porCierre ? "Desfer fi de set" : "Correcció de l'acta digital",
      );
      refrescarLocal();
      setDialogo(null);
      setIdEditar(null);
      setFiSetSeleccionado(null);
      programarEnvio();
    } catch (error) {
      setErrorAccion(mensajeError(error));
    }
  }

  function solicitarEliminar(evento: EventoLocalActa) {
    if (!puedeEscribir || estaProtegida(evento.clienteEventoID)) return;
    setIdEditar(evento.clienteEventoID);
    setDialogo("ELIMINAR");
  }

  function solicitarDeshacerFinSet(numero: number, cierreID: string) {
    if (!puedeEscribir) return;
    setFiSetSeleccionado({ numero, cierreID });
    setDialogo("FIN_SET");
  }

  function confirmarDeshacerFinSet() {
    if (!fiSetSeleccionado || !marcador) return;
    const { numero, cierreID } = fiSetSeleccionado;
    const cierre = marcador.historial.find(
      (p) => p.clienteEventoID === cierreID,
    );
    if (
      !cierre ||
      !cierre.cierraSet ||
      cierre.numeroSet !== numero ||
      !marcador.setsFinalizados.some((s) => s.numero === numero)
    ) {
      setErrorAccion(
        "El fi de set ja no és el mateix. Actualitza l'historial.",
      );
      setDialogo(null);
      setFiSetSeleccionado(null);
      return;
    }
    // FIN_SET no existe en acta_eventos: se anula la jugada real que lo cerró.
    anularPunto(cierreID, true);
  }

  function solicitarModificar(evento: EventoLocalActa) {
    if (
      !puedeEscribir ||
      estaProtegida(evento.clienteEventoID) ||
      ultimoEventoActivo?.clienteEventoID !== evento.clienteEventoID
    )
      return;
    setIdEditar(evento.clienteEventoID);
    setEdicionTipo(evento.tipoEvento as TipoPuntoVoleibol);
    setEdicionEquipoID(evento.equipoID ?? "");
    setEdicionJugadorID(evento.jugadorID ?? "");
    setDialogo("EDITAR");
  }

  function cancelarPulsacion() {
    if (pulsacionRef.current !== null) clearTimeout(pulsacionRef.current);
    pulsacionRef.current = null;
  }

  function iniciarPulsacion(evento: EventoLocalActa) {
    if (!puedeEscribir || estaProtegida(evento.clienteEventoID)) return;
    cancelarPulsacion();
    pulsacionRef.current = setTimeout(() => {
      pulsacionRef.current = null;
      if (ultimoEventoActivo?.clienteEventoID === evento.clienteEventoID)
        solicitarModificar(evento);
      else solicitarEliminar(evento);
    }, 900);
  }

  function sustituirUltimaJugada() {
    if (
      !idEditar ||
      !puedeEscribir ||
      !local ||
      !visitante ||
      estaProtegida(idEditar) ||
      ultimoEventoActivo?.clienteEventoID !== idEditar
    )
      return;
    const original = eventos.find((e) => e.clienteEventoID === idEditar);
    if (!original) return;
    if (
      original.sincronizacionCreacion.estado !== "SINCRONIZADO" ||
      pendientes > 0
    ) {
      setErrorAccion(
        "Sincronitza les jugades pendents abans de substituir la darrera.",
      );
      return;
    }
    const equipo = [local, visitante].find((e) => e.id === edicionEquipoID);
    const jugador = equipo?.jugadores.find((j) => j.id === edicionJugadorID);
    if (!equipo || !jugador) return;
    try {
      anularEventoLocal(partido.id, idEditar, "Substituïda per correcció");
      const recalculado = calcularEstadoVoleibol(
        leerActaLocal(partido.id).eventos,
        local.id,
        visitante.id,
        configuracion,
      );
      if (!recalculado.setActual)
        throw new Error("No es pot afegir cap punt després del final.");
      registrarEventoLocal(partido.id, {
        tipoEvento: edicionTipo,
        equipoID: equipo.id,
        equipoNombre: equipo.nombre,
        jugadorID: jugador.id,
        jugadorNombre: nombreJugador(jugador),
        periodo: recalculado.setActual.numero,
        tiempoJuegoSegundos: original.tiempoJuegoSegundos,
        datos: {},
      });
      refrescarLocal();
      setDialogo(null);
      programarEnvio();
    } catch (error) {
      refrescarLocal();
      setErrorAccion(mensajeError(error));
    }
  }

  function guardarInforme() {
    if (
      !puedeEscribir ||
      !textoInforme.trim() ||
      (tipoInforme === "SUSPENSION" && !equipoInforme)
    )
      return;
    const nuevo: Informe = {
      id: crypto.randomUUID(),
      tipo: tipoInforme,
      contenido: textoInforme.trim(),
      equipoResponsableID: tipoInforme === "SUSPENSION" ? equipoInforme : null,
      creadoAt: new Date().toISOString(),
      sincronizado: false,
    };
    try {
      const siguientes = [...informes, nuevo];
      window.localStorage.setItem(registroInformes, JSON.stringify(siguientes));
      setInformes(siguientes);
      setTextoInforme("");
      if (tipoInforme === "SUSPENSION") detenerReloj();
    } catch (error) {
      setErrorAccion(`No s'ha pogut desar l'informe: ${mensajeError(error)}`);
    }
  }

  function exportarInformes() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ partidoID: partido.id, informes }, null, 2)], {
        type: "application/json",
      }),
    );
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `informes-volei-${partido.codigo}.json`;
    enlace.click();
    URL.revokeObjectURL(url);
  }

  async function finalizarPartido() {
    if (!puedeEscribir || !controlToken || !evaluacion?.permitido || !marcador)
      return;
    if (modoCierre === "FORZADO_PUNTOS" && !confirmadoForzado) return;
    if (
      enviandoRef.current ||
      pendientes > 0 ||
      !puedeIntentarFinalizacion(partido.id)
    ) {
      setErrorAccion("Envia totes les jugades pendents abans de finalitzar.");
      return;
    }
    if (informePendiente) {
      setErrorAccion(
        "Hi ha informes pendents de sincronitzar. No es pot tancar l'acta.",
      );
      return;
    }
    setFinalizando(true);
    setErrorAccion(null);
    try {
      const correcte = await leerServidor();
      if (!correcte || !puedeIntentarFinalizacion(partido.id)) {
        throw new Error(
          "No s'ha pogut confirmar la sincronització de les jugades.",
        );
      }
      const respuesta = await fetch("/api/panell/acta/finalizar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoID: partido.id,
          controlToken,
          modoCierre,
          confirmarCierreForzado:
            modoCierre === "FORZADO_PUNTOS" && confirmadoForzado,
        }),
      });
      const datos = await respuestaJSON(respuesta);
      const confirmado = datos as unknown as ConfirmacionFinalizacionActa;
      if (!eliminarActaLocalTrasFinalizacion(partido.id, confirmado)) {
        console.warn(
          "Finalitzat al servidor, però s'ha conservat la còpia local.",
        );
      }
      if (temporizadorRef.current !== null)
        clearTimeout(temporizadorRef.current);
      window.location.href = `/panell/partits${window.location.search}`;
    } catch (error) {
      setErrorAccion(mensajeError(error));
    } finally {
      setFinalizando(false);
    }
  }

  function Icono({ tipo, size = 25 }: { tipo: string; size?: number }) {
    const comunes = {
      width: size,
      height: size,
      viewBox: "0 0 48 48",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.8,
      strokeLinecap: "round" as const,
      strokeLinejoin: "round" as const,
      "aria-hidden": true as const,
    };

    const tamano = {
      width: size,
      height: size,
    };
    switch (tipo) {
      case "voleibol":
        return (
          <svg {...tamano} fill="currentColor" viewBox="0 -960 960 960">
            <path d="M782-582q-31-87-101-145.5T520-798v64zM320-434l120-70v-294q-32 3-62 14.5T320-756zm-134 78 54-32v-302q-39 44-59.5 98T160-480q0 32 6.5 63.5T186-356m134 152 280-160-120-70-254 148q20 25 43 46t51 36m160 44q75 0 142-34t112-94l-54-30-264 152q16 3 32 4.5t32 1.5m294-196q13-29 19.5-60.5T800-480L520-642v138zM480-80q-83 0-156-31.5T197-197t-85.5-127T80-480t31.5-156T197-763t127-85.5T480-880t156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80" />
          </svg>
        );
      case "jugador":
        return (
          <svg {...comunes} fill="currentColor" stroke="none">
            <circle cx="24" cy="16" r="10" />
            <path d="M7 42c0-13 7-18 17-18s17 5 17 18v2H7Z" />
          </svg>
        );
      case "entrenador":
        return (
          <svg {...comunes} fill="currentColor" stroke="none">
            <path d="M9 17 16 7l12-2 11 8-5 7-25-1Z" />
            <circle cx="24" cy="22" r="8" />
            <path d="M6 46c0-10 7-17 18-17s18 7 18 17" />
          </svg>
        );
      case "DIRECTO":
        return (
          <svg
            {...tamano}
            className=""
            fill="currentColor"
            viewBox="0 0 1254 1254"
          >
            <path d="M556.5 377.1c-33 3.2-62.7 12-92.4 27.5-50 26-89.4 67.4-115.1 120.7-8.7 17.8-13.1 30.1-18 49.2-6.4 25.1-7.5 33.9-7.5 60 .1 19.2.5 25.1 2.3 35.6 9.4 53.2 33.7 99.9 72.6 139.7 22.8 23.3 45.1 39.5 74.1 53.7 60.9 30 122 33.4 184 10.3 62.2-23.1 114.6-71.3 145-133.3 10.3-21 18.2-45.1 21.9-66.8l.7-3.7H945c66.6 0 121 .4 121 .8s-12.1 12.8-26.9 27.6c-23.1 23.1-27.3 27.7-29.6 32.7-4.9 11.1-5 22.9-.3 32.9 7.4 15.4 26.9 23.4 43.6 18.1 3.8-1.2 8-3 9.4-3.9 1.4-1 21.2-19.1 44-40.3 40.1-37.4 64-59.5 76.3-70.7 12.5-11.4 13.8-12.8 16.3-17.7 2.4-4.4 2.7-6.1 2.7-15 0-9.5-.2-10.3-3.4-16.3-2.2-4.1-5.5-8-9-11-10.5-8.9-58.7-53-98.3-90.2-11.5-10.7-23-21.2-25.6-23.3-7-5.5-14.2-8-23.7-8-7-.1-8.9.3-15 3.1-8.1 3.8-13.2 8.8-17.1 16.9-2.6 5.1-2.9 6.9-2.9 15.3 0 15.5.7 16.6 32.1 48 14.5 14.6 26.4 26.9 26.4 27.2 0 .4-54.1.6-120.2.5l-120.2-.2-2.2-11c-10.2-52.1-36.7-100.3-76-138.6-43.4-42.1-95.5-65.7-154.9-69.9-15.9-1.1-22.2-1.1-35 .1m18.4 42.3c-31.3 12.7-63.4 36-87.1 63.3-21.1 24.2-38.4 52.7-50.3 82.8-2.6 6.6-4.9 12.2-5.1 12.4s-3.7-2.1-7.7-5.2c-9.2-7.1-25.8-24.1-32.1-33l-4.9-6.8 2.8-5.2c4.3-8 14.7-23.3 22.2-32.7 31.8-39.7 78.3-67.9 127.1-76.9 14.2-2.6 15.4-2.8 31.7-2.9l14-.1zm79.3 11.2c25.1 10.7 50.9 28.2 68.3 46.3l3.9 4.1h-13.9c-28.4 0-56.6 7-84.5 21-20.2 10.1-35.3 21.2-52.6 38.4-17.9 18-32 37.7-43.1 60.3l-5.4 11.3h-3.7c-9.7 0-32.5-5.1-46.5-10.4-9.6-3.6-22.7-9.8-22.7-10.7 0-2.2 7.6-21.4 12.9-32.4 19.9-41.7 48.1-75 83.5-98.7 25.6-17.1 52.1-27.4 80.6-31.2 14.6-1.9 13.9-2 23.2 2m85.5 77.6 10.3 2.1 4.8 7.6c25.2 39.5 36.8 84.5 33.3 129.2-1.1 14.1-4.3 33.6-6.1 36.8-.4.8-1.2-2.1-1.9-7-4.3-29.3-15.5-62.7-29.8-88.5-14.7-26.5-28.8-45.2-50-66.1-16.3-16-16.1-14.7-1.8-16.3 11.3-1.2 29.2-.3 41.2 2.2m-72.6 15.7c35.8 29.9 64.9 72.3 79.2 115.6 9.4 28.4 12.2 45.8 12.2 76v23l-2.7 5.5c-6.8 13.6-31.9 42.6-49.8 57.5-7.8 6.5-18.8 14.5-20 14.5-.3 0 .6-3.9 2.1-8.6 5.4-16.4 7.2-27.5 7.7-46.6.3-13.8 0-20.1-1.3-28-4.7-28.2-17.2-52.4-38-73.2-24.5-24.6-55.1-39.4-91.9-44.2-6-.8-11.2-1.6-11.4-1.9-.7-.7 8.8-17.6 15.9-28 16.6-24.4 39.3-45.5 63.3-58.5 8.4-4.6 22.4-11 24.2-11 .6 0 5.3 3.5 10.5 7.9m-279.4 47.8c13.3 15 36.4 32.1 58.2 43.2 28.7 14.5 54.5 21 93 23.1 19.8 1.2 31.3 2.4 38.6 4.3l5 1.3.3 9c.3 10.2-1.9 31.6-4.8 45.3-1.9 8.7-7.7 30.1-8.5 30.9-1.1 1.2-18.4 3.3-31.5 3.8-34.7 1.5-69.8-6.2-101.9-22.2-27.8-13.9-48.2-29.6-68.5-52.8l-6-6.8.1-16.1c.1-18.2 1.3-29.2 4.9-45 2.6-11.2 6.9-25.8 8.6-29.1 1-1.9 1.2-1.8 3.5 1 1.4 1.6 5.4 6.1 9 10.1m226.1 85c22.7 13.3 41.8 34.6 50.6 56.3 13.5 33.3 10.4 71.4-9 110.2-2.5 5.1-5.3 10.1-6.2 11-2 2.4-22.7 9-38.7 12.4-12.1 2.6-14.6 2.8-36 2.8-23.2 0-30.2-.8-46.6-5.4l-3.7-1 7-6.8c41.9-40.2 71.2-107 75.4-172 .4-5.6 1.1-10.2 1.6-10.2s3 1.2 5.6 2.7m-220.7 56.8c32.1 23.1 70.4 37.8 111.4 42.5 12 1.4 35.1 1.7 45.8.6l7.8-.8-4.1 8.3c-12.1 24-31.2 48.2-49.7 63l-7.3 5.8-7.7-3.6c-44.6-20.5-88.5-65.1-109.1-110.8-3.9-8.7-9.2-21.5-9.2-22.2 0-.2 3.1 2.2 7 5.5 3.8 3.2 10.6 8.5 15.1 11.7" />
          </svg>
        );
      case "BLOQUEO":
        return (
          <svg
            {...tamano}
            className=""
            fill="currentColor"
            viewBox="0 0 1254 1254"
          >
            <path d="M605 111.1c-33 3.5-65.9 16.7-93.8 37.6-9.6 7.2-27.6 24.5-35.2 33.8-8 9.7-17.9 25.2-23.8 37-32.9 66-26.7 141 16.9 202 26.4 36.9 66.7 64.6 110.4 75.8 17.6 4.5 23.9 5.2 45.5 5.1 18.2 0 21.9-.4 33.1-2.7 37.6-7.9 69.4-24.7 96.8-51.2 17.9-17.3 30.4-34.3 41-55.8 21.3-43.2 26.2-88 14.5-134.2-12.1-47.6-43.7-91-86.4-118.8-35.5-23-77.2-33.1-119-28.6m25.5 31.7c-.6.5-3.2 1.7-6 2.7-7.9 2.8-26.1 12.9-36.5 20.3-11 7.8-28.6 24.4-37.3 35.2-12.9 16-24.4 36.2-32.2 56.2l-3.7 9.8-4.4-3.2c-9.7-6.9-22.2-21.6-26.4-31-1.2-2.5-.9-3.3 2.8-9.6 24-40.3 63.5-68.7 108.7-78.1 12.8-2.6 14-2.8 26-3 5.4 0 9.5.3 9 .7m59.1 15.1c14 6.8 23.8 13.1 36.1 23.5 14.4 12 14.4 11.2.7 12-54.9 3.3-105.8 37.2-131.9 87.8l-5.6 10.8h-5c-10.8 0-35-6.5-47.1-12.6L532 277l3.6-9.8c19.4-53.9 60.7-94 112.9-109.5 8.4-2.5 22.4-5.4 27-5.6 1.1-.1 7.5 2.6 14.1 5.8m59.2 56.6c9.3 1.9 9.9 2.5 17.6 17.9 11.4 22.9 16.6 43.5 17.3 69.1.4 14.2.2 19-1.5 29-1.2 6.6-2.5 13.1-3 14.5-.8 2.2-1 1.9-1.6-2.5-3-20.7-13.8-50.2-26.3-72-9.4-16.4-27.6-39.5-38.8-49.1-3-2.6-5.2-5-5-5.3.3-.2 3.1-1 6.3-1.7 8.1-1.8 25.9-1.7 35 .1m-59.9 13.2c22 17.8 37.8 37.1 50.3 61.8 15.2 29.9 22 60.7 21 95.1-.2 7-.3 7.3-6.4 16-9.5 13.5-40.2 43.4-42.3 41.2-.2-.2.2-2.7 1-5.6 4.4-17.1 4.5-41.5.1-58.4-4.9-19.1-14.7-36.1-29-50.4-18.6-18.6-42.6-30.3-67.3-33-3.5-.4-6.3-.9-6.3-1.3 0-1.4 10.5-18.2 15.6-24.8 7.2-9.4 22-23.4 31.8-30.2 7.2-5 24-14.1 26-14.1.5 0 3 1.7 5.5 3.7m-211.9 31c11.9 15.9 34.8 32.7 56.5 41.4 19.4 7.8 35.7 11 65 12.9 9.4.6 19.5 1.6 22.5 2.3l5.5 1.2.7 7c1.2 12.8-1.7 35-6.5 49.5l-2.2 6.5-7 .8c-10.9 1.3-36.5.1-49.3-2.2-22.1-4.2-45.8-13.6-63.7-25.6-8.9-6-21.5-17-29.5-25.8l-5.3-5.8-.5-9.3c-.5-9.7.9-24.3 3.3-36.1 1.9-9 5.6-21.5 6.4-21.5.3 0 2.2 2.2 4.1 4.7m178.2 69.9c3.9 2.5 10.8 8.2 15.2 12.7 28.5 28.6 34.5 69.6 15.8 107.7-5.4 10.9-6.8 11.9-22.7 16.5-14.9 4.3-27.1 5.8-43.5 5.2-13-.5-32-3.4-33.8-5.2-.3-.3 3.7-4.9 9-10.3 23.9-24.2 40.1-54.9 47.3-89.9 1.8-8.5 4.5-31 4.5-37 0-2.4.3-4.3.6-4.3s3.7 2.1 7.6 4.6m-156.9 47.2c28.4 16.2 59 24.2 93.9 24.5 9.8.1 17.8.3 17.8.4 0 1-7.8 14.5-11.8 20.5-9.1 13.5-29.1 32.6-35.9 34.4-3.9 1-23.6-10.2-37.3-21.3-20.9-16.9-40.1-42.7-49.6-66.9-1.9-4.8-3.4-8.9-3.4-9.1 0-.1 3.9 2.6 8.8 6.1 4.8 3.5 12.7 8.6 17.5 11.4" />
            <path d="M431.5 443.4c-10.8 2.7-21.2 10.6-26.7 20.4l-3 5.2-2.6-1.9c-7.2-5.1-19.2-7.6-28.7-6.1-23.6 3.8-39.3 25.3-35.8 49.2.5 4 .9 7.5.7 7.7s-3-.4-6.2-1.3c-20.1-5.6-41.3 4.5-50.5 24.2-2.5 5.4-3.2 8.3-3.5 15.3-.7 14.4-.5 14.8 27.7 65.2 15.2 27.1 16.3 29.4 18.2 38.5 2.9 13.6 10.4 36.2 15.1 45.7 4.5 8.9 10.1 17.6 16.1 24.8l3.9 4.7-3.2 15.8c-8.6 42.6-19 90.6-19.7 91.3-.5.5-30.5 1-66.8 1.1l-66 .3-7.8 3.7c-21.3 10.2-32.7 34.3-27.2 57.7 5 20.9 20.6 35 41.7 37.5l8.8 1v96.6c0 91.2.1 96.7 1.9 100.5 3.7 8.2 12.2 13.1 21.1 12.3 10.4-1 17.2-7.6 19.3-18.6l1.2-6.2h736.3l.4 5.9c.6 8.1 4.2 13.4 11.1 16.7 11.2 5.2 24.1 1.1 29.3-9.3 1.8-3.6 1.9-8.4 2.4-101.3l.5-97.5 8-.7c26.8-2.4 46.4-29.5 41.6-57.4-2.8-16-13.1-29.8-27.7-37l-7.8-3.9-66-.3c-36.3-.1-66.4-.6-66.8-1-.6-.6-15.3-66.6-21.9-98.1l-1.9-9.4 3.8-4.1c13.4-14.5 22.5-35.4 30.6-69.9 2.4-10.1 3.5-12.3 17.7-38 20.2-36.1 26.5-48.5 27.8-54.7 6.8-31.6-21.6-59.5-52.3-51.5-3.3.9-6.1 1.4-6.3 1.2-.2-.3.1-3.4.7-7.1 2.1-13.4-2-26.5-11.5-36.5-13.4-14-32-17.4-49.3-8.9-3.4 1.7-6.4 2.9-6.5 2.7-.2-.2-1.5-2.4-2.9-4.9-9.9-17.3-32.8-25.3-51.7-18.1-15.1 5.7-27.1 22.4-27.1 37.7 0 4.7-1.1 5.4-4.5 2.8-3.3-2.5-14.3-5.4-20.4-5.4-15.9 0-30.2 9.5-37.4 24.8-3 6.3-3.2 7.3-3.1 18.2 0 12.5-1.1 7.9 13.8 58.9 3.1 10.7 5.5 19.6 5.3 19.8-.2.1-4.1-1.9-8.6-4.6-10.3-6.2-18.5-9.1-28.1-9.8-14.5-1.1-27 3.6-36.3 13.7-8 8.6-10.2 14.7-10.2 28.1 0 10.2.1 10.8 3.8 18.2 3.5 7.1 5.2 9 22.8 25.4 10.5 9.8 26.9 26.4 36.6 37 15.1 16.7 22 23.2 34.4 32.8 2.6 2 2.6 2.2 4.3 26.5 1 13.5 2.5 35.3 3.5 48.5s1.6 24.3 1.4 24.7c-.2.5-54.4.8-120.4.8H507v-3.8c0-2 .7-12.7 1.5-23.7s2.2-31.6 3.1-45.7l1.8-25.7 4.2-3.1c9.6-6.9 18.3-15.2 32.3-30.9 8.1-9.1 20.5-22 27.7-28.6 22.7-21 29.9-28.6 32.6-34.5 8-17 4.9-34.9-8.2-47.4-14.6-13.9-34.2-16.5-54.7-7.1-3.9 1.8-9.2 4.7-11.8 6.5s-4.8 3-5.1 2.8c-.2-.3.9-4.7 2.5-9.9 9.2-29.8 15.8-53.9 17.5-64.1 1-5.4-1.1-16.5-4.4-23.5-4.1-8.8-10.8-15.6-19.9-20.1-7.1-3.5-8-3.7-17-3.7-9.6 0-10.7.3-23.7 6.1-.7.3-1.3-1.9-1.7-6.2-2.4-25.3-27.5-43.1-52.2-37m18.2 29.7c1.7 1.1 4.1 3.9 5.1 6.2 1.9 4 2.1 7.2 2.7 55.2.6 44 .9 51.2 2.3 52.7 1.6 1.9 5.8 2.3 8.1.9.7-.5 6.5-15.8 12.7-34.1 6.3-18.3 12.5-35.2 13.9-37.5 2.6-4.5 8.9-8.5 13.3-8.5 6.4 0 13.6 6.2 14.8 12.6.8 4.6-1.2 11.8-18.6 66.4-7.3 22.9-9.2 31.3-9.3 41.5-.2 14 4 20.5 13.1 20.5 5.3 0 4.9.2 30.8-17.8 17.6-12.2 22.9-15 30.2-15.8 9.6-1.1 18.3 6.8 16.8 15.2-.8 4.1-3.3 6.6-23.9 25.3-8.1 7.3-22.6 22-32.3 32.6-16.3 18-25.3 26.2-37.1 33.8-5.9 3.7-7.4 6.5-8.4 15.3-.4 4.2-1.1 7.9-1.4 8.3-.4.3-13.1.6-28.3.6-25.6 0-34.9-.6-60-3.6l-9.2-1.2.7-3.6c.5-2 .8-6.3.8-9.7v-6.1l-7.5-8c-15.4-16.6-24-36.6-29.6-68.8-.9-5.2-.1-3.7-24.5-46.1-19.4-33.7-20.9-36.7-20.9-41.2 0-12.3 12.6-18.9 23.4-12.3 2.5 1.6 8.8 10.1 23.2 31.6 14.8 22.1 20.3 29.5 22.2 30 2.8.7 6.8-1.5 7.6-4.3.5-1.6-9.9-55-16.3-83.9-2.7-11.9-2.7-18.8-.1-23.1 4.4-7.1 14.3-9.5 21.1-4.9 6.5 4.4 6.5 4.2 20.5 65.7 3.8 16.7 7.2 29.2 8.1 30.2 3.3 3.6 9.6 1.6 10.8-3.5.3-1.2.6-24.5.7-51.7.3-43.9.5-49.8 2-52.5 4.9-9 14-11.6 22.5-6.4m368.9-1.2c2.3 1 5.2 3.4 6.5 5.2 2.2 3.1 2.5 4.8 3.1 17.9.3 8 .7 31.5.7 52.2.1 36.4.2 37.9 2.1 39.8 2.5 2.5 7.2 2.6 9.2.2.8-.9 3.1-8.9 5.1-17.7 17.3-75.7 16-70.9 20.1-75.3 7.2-8 19.3-6.6 24.4 2.9 1.7 3.2 2.2 5.5 1.9 8.4-.2 2.2-4.6 24.6-9.7 49.7-5.8 28.7-9 46.7-8.6 48.3.9 3.4 4.8 5.2 8.1 3.7 1.6-.8 8.9-10.9 20.9-28.9 10.1-15.3 19.6-29 21.1-30.6 7.5-7.4 20.3-5.3 24.1 3.9 2.2 5.2 1.7 10.5-1.3 16.1-1.6 2.8-11.7 20.5-22.5 39.4l-19.7 34.4-3.1 14.6c-5.9 28.2-12.5 43-25.3 56.5-9.2 9.8-10.2 12.3-8.6 21.7.7 3.7 1 6.9.8 7.1-.7.7-26 3.4-43.4 4.7-14.9 1.1-52.1.6-53.4-.7-.3-.2-.8-3.9-1.2-8s-1.4-8.6-2.3-9.8c-.8-1.3-5.4-5-10.3-8.2-9.6-6.4-18.5-14.9-39.9-38-7.6-8.3-21.4-22-30.7-30.4-17.6-16.2-19.9-19.3-18.3-25.5 1.6-6.4 10.9-11.4 18.5-10 6.6 1.2 12.2 4.4 31.5 17.8 10.5 7.4 20.1 13.9 21.3 14.6 1.2.6 4.3 1.1 6.8 1.1 4 0 5.2-.5 8-3.3 4.6-4.6 6-11.9 4.5-23.5-1.4-10.8-1.8-12.7-8.5-33.7-2.9-9.4-8.5-27.2-12.4-39.6s-7.1-23.8-7.1-25.3c0-6.4 5.7-13.7 11.9-15.1 4.5-1 10.7 1.2 14.4 5 2.8 2.8 4.6 7.1 10.2 23.7 12.4 36.8 17.3 50.1 18.7 50.9 2.2 1.5 6.4 1 8.1-.9 1.5-1.6 1.7-7.6 2.3-53.1.7-49.3.8-51.5 2.8-55.5 1.5-2.9 3.4-4.8 6.6-6.4 5.3-2.7 7.3-2.7 12.6-.3M399.5 766.6c10.9 1.4 21.5 1.8 47.7 1.9H481v2.5c0 4.3-3.9 61.2-4.6 66.2l-.6 4.8h-55.4c-39.6 0-55.4-.3-55.4-1.1 0-1.3 14.9-73.7 15.6-75.8.2-.8 1.3-1.1 2.7-.8 1.2.3 8.5 1.4 16.2 2.3m478.7 20.9c2.7 12.6 6.4 30.1 8.2 38.7l3.3 15.8H778.2l-.6-5.3c-1-8.9-4.9-67.7-4.5-68 .2-.2 7.4 0 15.9.4 21.9 1 61.6-1.1 76.3-4.1 8.3-1.6 7.5-3 12.9 22.5m168.9 82.7c16.1 5.5 21 27 8.7 38.8-7.8 7.7 32.9 7-429.6 7-312.4 0-416.4-.3-419.3-1.2-5.2-1.5-11.3-6.8-13.8-12.1-5.8-11.9.8-27.9 13.1-32.4 4.7-1.7 835.9-1.8 840.9-.1M361 976v34H259.2l-.3-3.3c-.2-1.7-.3-17-.1-34l.3-30.7H361zm126 0v34H387v-68h100zm128 0v34H514v-68h101zm127 0v34H641v-68h101zm126 0v34l-49.7-.2-49.8-.3-.3-32.5c-.1-17.9 0-33 .3-33.7.3-1 11.1-1.3 50-1.3H868zm127 0v34H894v-68h101zm-634 93v32H258.5l.1-12.3c0-6.7.1-21.1.2-32l.2-19.7h102zm126 0v32H387v-64h100zm128 0v32H514v-64h101zm127 0v32H641v-64h101zm126 0v32H767.9l.2-32 .1-32H868zm128 0v32H894v-64h102z" />
          </svg>
        );
      case "REMATE":
        return (
          <svg
            {...tamano}
            className=""
            fill="currentColor"
            viewBox="0 0 1254 1254"
          >
            <path d="M450.2 235.1c-19.1 2-35.4 10.3-83.7 42.4-78 51.8-137.9 100.6-181.2 147.6-30.7 33.4-36.4 41.4-38 52.8-.8 5.6 0 27.5 1.2 32.9l.6 3.1 5.2-6.7c7.6-10 28.9-35.9 35-42.6 6.3-6.7 6.2-6.7 19.7-1.4 31.7 12.5 58.4 37.5 73.4 68.8 6.7 14.1 6.7 13.7-.6 19-34.4 24.7-66.8 56.9-86.6 85.8l-5.7 8.3 3.5 6.6c4.3 8.3 10.9 17.3 14.3 19.6l2.7 1.7 3.6-5.7c23-37 51.5-65.9 95.8-97.6 18.9-13.4 21.5-16.1 34.8-36.1 13.6-20.4 17.5-25.7 30.3-41.1 22.9-27.4 49.2-50 75.2-64.5l8.6-4.9 6.1 5.6c14.1 13.1 33.2 22.8 51.8 26.2l6.6 1.3-10.1 7.6c-12.6 9.4-34.8 31.5-44.7 44.2-26.9 34.8-44.6 72.5-52 110.6-2.7 13.9-5 35.4-5 46.7 0 45.6 15 96.2 40.8 136.7 13.7 21.5 40.3 50.5 60.9 66.3 28 21.3 60.3 37.6 90.8 45.7 43.3 11.6 93.8 8.2 142.2-9.5 23.1-8.4 54.3-26 73.8-41.5C879 815.6 914 742.1 914 664.3c0-75.3-35.4-148.8-94.4-195.7-5.3-4.2-9.6-7.8-9.6-8s1.6-2.7 3.5-5.6c4.5-6.7 6.5-13.6 6.5-22.5 0-16.2-5.7-25.3-32.4-52.1-19.2-19.1-35.6-33.7-55.5-49.2-30.9-24.1-45.2-30.8-96.1-45.2-40.3-11.4-69.5-20.8-102.5-33-44.5-16.4-61.8-20.1-83.3-17.9m29.8 31.3c5.8 1.3 27.6 8.5 48.5 15.9 51.5 18.2 70.2 24.1 113.7 35.6 37.3 9.9 50.1 16.4 82 41.7 25.2 20.1 62.1 54.2 66.9 62.1 4.7 7.6 4.6 14.4-.3 19.3-2.4 2.4-3.8 3-7.3 3-3.8 0-4.7-.4-6.6-3.3-8.8-12.6-35.2-41.2-55-59.4-24.6-22.6-37.4-31.3-46-31.3-5.2 0-6.9 1.3-6.9 5.2 0 2.3 1.2 3.7 6.2 7.6 19.4 14.8 43.7 37.7 65.6 61.7 14.8 16.2 20.2 23.9 20.2 28.9 0 3.4-3.9 10.1-6.9 11.9-7.3 4.3-20.2.2-23.7-7.6-4-8.9-24-32.2-46.1-53.7-27-26.5-45.3-39-56.9-39-5.9 0-7.7 1.4-7.2 5.7.2 2.3 2.2 4.1 10.5 9.8 15 10.4 29.8 23.3 49.9 43.7s26.8 28.1 28.3 32.2c2.6 6.8.4 14.2-5.2 17.6-3.8 2.3-11.3 2.6-16 .7-4.9-2.1-13.8-10.2-17.2-15.6-4.5-7.3-22.3-26.8-36.5-40.1-13.2-12.2-25.2-21.7-34.2-26.8-17.6-10-35.2-9.3-31.2 1.3.4.9 4.8 3.7 9.8 6.2 12.3 6.1 20.3 11.5 31.2 20.6 14.3 11.9 38.3 35.6 40.5 39.8 2.2 4.5 2.5 10.9.5 14.7-2.3 4.5-8.8 7.5-15 7-8.7-.7-13.4-3.9-33.3-22.5-29.9-27.9-35-30.5-62.8-32.8-19.1-1.6-24.4-2.8-35.1-7.9-16.5-7.8-29.6-21.4-42.3-43.8-11-19.5-19.9-25.1-25.8-16.1-1.4 2.1-1.8 4.7-1.8 12.3.1 9.1 1.8 16.2 6.9 28 .4 1.1-.9 2.3-4.8 4.3-3.1 1.6-10.1 5.9-15.8 9.6-34.3 22.5-68.3 57.5-98.7 101.9-4.6 6.7-8.5 12.2-8.7 12.2-.1 0-2.3-4.3-4.8-9.6-15.1-31.9-41.1-58.5-73.2-74.9-4.8-2.4-10.9-5.2-13.6-6.2-2.6-.9-4.8-2-4.8-2.4 0-.8 15-15.2 30.4-29.2 34.7-31.7 78.2-64.9 130.1-99.8 38.7-26 57.3-36.7 68.3-39.3 9.1-2.3 22.2-1.9 34.2.8m102.9 212.8c8.9 8.6 14.7 13.3 21.8 18.1l5.3 3.5-7.8 6.6c-29.4 24.8-51.6 53.4-68.5 88.6-3.3 6.9-6.2 12.7-6.3 12.9-.5.6-10.2-8-18.2-16.2-8.8-8.8-17.3-20.1-23.1-30.2l-4.2-7.3 4.7-7.4c14-21.8 38.7-46.4 61.4-61.3 5.9-3.9 25.3-14.5 26.4-14.5.5 0 4.3 3.3 8.5 7.2m205.4 11c9.2 6.2 22.6 17.8 31 26.8 4.2 4.6 7.7 8.6 7.7 8.9s-7.8.7-17.3.7c-38.7.3-74.8 11-110.8 32.9-13.4 8.1-22.7 15.4-35.7 28-16.5 15.9-28.6 31.6-39.1 50.8l-4.3 7.8-4.6-.6c-10.1-1.4-24.1-4.6-33.2-7.5-8.1-2.7-28.8-11.9-32.8-14.7-.9-.7-.2-3.1 3-10.4 19-41.9 46.5-74.8 83.3-99.6 3.3-2.2 7.9-4.4 10.1-4.7 4.5-.8 15.8-5.8 16.8-7.4.3-.6 2.9-1.8 5.7-2.7l5-1.7 6.2 2.8c5.6 2.6 7.3 2.9 16.7 2.9 12.6 0 17.6-1.6 25.7-8.2l5.5-4.5 6.4 2.1c13.2 4.3 28.9 1.9 37.6-5.9l4.3-3.8 3.5 2.1c1.9 1.1 6.1 3.8 9.3 5.9m45.5 62.3c12.7 3 15.5 4.8 20 12.8 15.8 27.9 25.2 65 25.2 99.7 0 15.9-4.4 45.5-8.7 58.5l-1.6 5-2.2-13c-9.6-56-36.1-108.4-74.9-148.3-7.1-7.3-12.7-13.4-12.4-13.7.2-.2 5.1-1.1 10.9-1.9 12.5-1.8 34.4-1.4 43.7.9m-73.5 16c14.3 12.5 31.1 32.2 43 50.5 29.7 45.9 46.1 107.2 40.3 150.9l-1.7 12.4-8.6 11.6c-15 20.1-42.3 45.4-61.4 56.9-4.7 2.9-5.2 2.8-3.5-.6 3-5.9 8.7-23.8 10.8-34.5 3.2-15.6 3.1-40.5 0-55.4-5.9-27.7-19.1-51.1-40.2-71.7-23.4-22.8-51.8-35.8-85.5-39.2-3.8-.3-7.3-.8-7.7-1.1-.8-.4 5.5-11.1 10.1-17.3 19.3-26 42.1-45.4 70.2-59.6 7.8-3.9 22.9-10.2 25-10.4.4 0 4.5 3.4 9.2 7.5m-286.7 19.8c12.6 17.7 31.5 35.8 51.2 49 11.4 7.6 34 18.7 47.2 23.1 15.8 5.2 31.8 8.2 59.9 11.1 14 1.4 28.6 3.3 32.4 4.1l7 1.6-.7 8c-1.4 16.6-7.3 41.1-14.2 59.2-3.1 8-4 9.5-6.2 10.1-5.6 1.3-40.9 1.7-51.3.6-59.6-6.8-114.4-35.7-146.5-77.3-4.4-5.6-4.4-5.7-4.4-13.6 0-18.2 3.3-38.5 9.4-57.5 3.2-10.2 9.7-25.7 10.6-25.6.3 0 2.8 3.2 5.6 7.2m227.8 101.2c12.8 7.7 26.4 20.6 34.8 32.9 6.2 9 13.6 25.4 16.4 36.3 3.6 13.5 4.3 32.3 1.9 46-4.1 23.2-13.7 45.1-27.6 62.8-4.6 5.9-4.9 6.1-13.2 8.3-39.1 10.2-72.7 10.8-103.7 1.8-4.7-1.3-9.8-2.9-11.3-3.5l-2.8-1.1 14.9-14.8c16.7-16.5 24.5-25.9 36.7-44.2 23.6-35.6 39.5-76.5 45.1-115.8.9-6.7 2-12.2 2.4-12.2.3 0 3.2 1.6 6.4 3.5m-236 36.9c24.8 19.4 54.8 34.9 84.5 43.6 23.9 7.1 44.3 9.9 71.3 10h18.7l-6.1 10.2c-9.8 16.2-20.1 29.3-34.2 43.3-12 11.9-29.4 25.5-32.6 25.5-1.8 0-17-9.4-26-16.1-31.8-23.5-59-58.4-74.6-95.3-5.1-12.1-10.6-27.6-9.7-27.6.3 0 4.2 2.9 8.7 6.4M532.4 1072c-6.1 1.9-12.6 7.3-15.8 13-2.7 4.8-3.1 6.5-3.1 13 0 6.4.4 8.3 2.9 12.7 1.6 2.9 5.7 7.9 9 11 3.4 3.1 23.9 23.3 45.6 44.8 36.5 36.2 39.9 39.3 45.3 41.3 7.4 2.8 15 2.8 22.3.1 5.1-1.9 9.4-5.8 50.7-46.7 24.9-24.5 46.4-46.4 47.9-48.5 12.8-18.4-2.3-44-24.4-41.4-10.5 1.3-12.1 2.6-49.5 40l-35.3 35.1-3.2-2.9c-1.8-1.7-17.8-17.4-35.6-35-22.1-22-33.7-32.7-36.9-34.4-5.3-2.6-14.8-3.6-19.9-2.1" />
          </svg>
        );
      case "ERROR":
        return (
          <svg
            {...tamano}
            className=""
            fill="currentColor"
            viewBox="0 0 1254 1254"
          >
            <path d="M625 302.4c-92.7 11.8-174.1 64.1-225.7 144.9-8 12.6-22.8 42.5-28.2 57.2-18.1 48.8-23.5 96.1-16.7 144.8 4.9 34.2 19 75.5 36.2 106C432.8 829.8 502.6 884 582 904c23 5.7 41.6 8 66.5 8 35.5 0 67.6-6 102.4-19.1 5.8-2.1 10.8-3.6 11.2-3.2.3.5 3.3 4.8 6.6 9.8 24.1 36 63.6 62.7 105.8 71.6 88.7 18.5 177.7-37.8 204-129 4.7-16.5 6.5-27.6 7.2-45.6 1.8-45.8-14.4-91.6-44.6-126.2-21.9-25.1-55.7-45.9-86.7-53.2l-5.1-1.2-.6-23.2c-.6-23.9-1.8-34.7-6.3-55.7-15.1-70.4-56.4-135.3-113.1-177.9-38.9-29.2-82.9-47.6-133.3-55.8-13.2-2.1-57-2.7-71-.9m43.3 43.2c6 .4 10.5 1 10 1.4-.4.4-5.7 2.4-11.7 4.4-54.5 18.5-104.3 56.8-141.3 108.4-13.6 19-27.5 44.7-36.4 67.7l-5.3 13.3-6-4.6c-12.7-9.8-35.8-35-45.3-49.4l-2.5-3.7 6.2-10.3c10.1-16.5 22.5-32.3 37-47.2 21.2-21.7 41.8-37.2 67-50.5 40.7-21.3 87.7-32.2 128.3-29.5m87 20.8c19.2 7.2 43.5 24.4 69.6 49.2l10.4 9.9-18.4.6c-38.8 1.4-69.2 9.4-103.9 27.5-50.2 26.2-90.1 67.8-114 118.8l-4.9 10.6-4.8-.6c-20.9-2.4-41.5-7.3-57-13.5-11.9-4.7-23.3-10.8-23.3-12.4 0-3.4 8.7-25.1 16.5-41 8.5-17.5 21.4-38 32.4-51.9C599.1 412 656.7 377.1 719 366c15.5-2.7 28.4-2.6 36.3.4M835 455c5.8.5 14 1.7 18.3 2.6l7.7 1.7 5.1 8.3c8.3 13.8 18.5 36 23.8 51.9 9 27.1 13 50.4 13.4 76.5l.2 16.5-6.5.7c-3.6.4-8 .8-9.8 1l-3.3.3-3.4-11c-15.3-50-47.8-101.4-86-135.8-7.6-6.9-9.8-9.4-8.6-9.8.9-.3 6.1-1.2 11.6-1.9 5.5-.6 10.7-1.3 11.5-1.5 3.3-.6 16.1-.4 26 .5m-77.3 19.2c33.1 26.6 64 66 81.3 103.8 7.7 16.9 16 40 16 44.6 0 .6-2.1 1.9-4.7 2.9-21.6 8.1-46.4 25.1-63.2 43.2l-7.8 8.4-6.6-9.8c-25.1-37.5-65.2-65.6-109.7-76.8-10.2-2.6-27.9-5.5-33.4-5.5-1.9 0-3.7-.4-4.1-.9-.7-1.2 6.2-14.4 13.8-26.6 19.4-31.1 53.7-62.2 87.7-79.5 6.7-3.5 21-9.8 22.2-9.9.4-.1 4.2 2.7 8.5 6.1m-334.1 50c28.8 33.7 59.7 56.6 97.6 72.2 11.8 4.9 30.9 10.3 44.3 12.6 10.3 1.8 18.2 2.5 56 5 14.1.9 26.6 2.7 35.9 5.1l3.9 1.1-.6 15.1c-.7 17.8-2.8 34.5-6.3 50.7-3.4 15.8-8.1 31.3-9.9 32.6-3.8 2.8-37.5 5.8-55 4.9-60-3.1-113.9-23.7-157.7-60.4-12.6-10.6-33.1-32.2-33.9-35.8-1.3-5.4-.9-33 .6-45.7 1.9-16.3 4.6-29.6 9-44 3.4-11.4 7.4-22.6 7.9-22.6.2 0 3.9 4.2 8.2 9.2M702 639.1c23.1 14.9 41.5 34.6 54.5 58.3l3.6 6.4-5.9 12.4c-8.8 18.5-13 31.3-16.2 50.1-3.6 21.3-2.4 50.4 3 71.7 1.5 5.7 1.6 7.6.7 8.2-2.4 1.6-26.5 10.7-34.7 13.2-22.4 6.8-39.9 9-65 8.3-20.3-.5-31.5-2.4-47.8-7.8l-6.3-2.1 14.8-15.2c23.1-23.6 37.4-43.8 52.4-73.6 19.6-39.1 30.8-78.8 34.1-121.3.8-9 1.6-14.7 2.3-14.7.6 0 5.3 2.8 10.5 6.1m238.8 11.8c46.9 9.7 86.7 45.8 102.5 93.2 13 38.8 9.3 80.8-10.5 117.9-7 13.2-12.7 20.9-24.3 32.8-27.8 28.7-61.1 43.2-99.5 43.2-67.5 0-124.1-50-136.1-120.1-1.8-10.4-2-14.9-1.6-27.9.8-21 4.8-38.2 13.6-57.3 20.8-45.2 63.7-77 112.6-83.6 10.7-1.5 31.5-.6 43.3 1.8m-513 46.4c35 26.9 83.6 46.6 131.2 53.3 14.3 2 47 2.8 61 1.6 6.3-.6 11.6-.9 11.8-.7.8.8-10.3 20.9-17.6 32.1-14.2 21.6-28.5 37.8-47.1 53.4l-10.4 8.8-6.6-3c-60.3-27-109.7-80.2-136-146.6-6.1-15.5-6.2-15.2 1-9.1 3.5 3 9.2 7.6 12.7 10.2" />
            <path d="M964.5 706.5c-2.2.8-4.2 1.5-4.5 1.5-.2 0-11.3 10.9-24.7 24.2L911 756.4l-3.2-2.9c-1.8-1.6-12.3-11.8-23.3-22.6s-21.5-20.4-23.3-21.3c-9.3-4.7-20.1-2.8-27.8 4.8-7.6 7.7-9.5 18.2-5 27.8 1 2 11.8 13.6 24.6 26.3l22.9 22.8-22.7 23.3c-13.7 14.1-23.7 25.2-25.2 28-8 15.3 3.9 34.4 21.5 34.4 9.3 0 10.6-.9 36-26.2 13.3-13.1 24.5-23.8 25-23.8s11.3 10.3 24 22.9c12.6 12.6 24.6 23.7 26.5 24.7 2.5 1.3 5.6 1.9 11 1.9 6.4 0 8.2-.4 12.2-2.8 8.6-5 12.4-12.6 11.6-23.1-.3-3.4-1.3-7.7-2.3-9.6s-12.3-13.9-25.2-26.5l-23.4-23 24-24.3c26.8-27.1 27.6-28.3 26.9-39.6-.8-12.3-9.4-21.3-21.5-22.2-3.7-.3-7.2.1-9.8 1.1" />
          </svg>
        );
      case "historico":
        return (
          <svg {...comunes}>
            <rect x="10" y="9" width="29" height="35" rx="3" />
            <path d="M17 5v9m14-9v9M17 22h14M17 29h14M17 36h9" />
          </svg>
        );
      case "volver":
        return (
          <svg {...comunes}>
            <path d="m23 8-16 16 16 16M8 24h34" />
          </svg>
        );
      case "reenviar":
        return (
          <svg {...comunes}>
            <path d="M40 19a17 17 0 0 0-30-5l-4 6M6 9v11h12M8 29a17 17 0 0 0 30 5l4-6m0 11V28H30" />
          </svg>
        );
      case "config":
        return (
          <svg {...comunes}>
            <path d="M20 3h8l2 6 6 2 6-2 4 7-5 5v6l5 5-4 7-6-2-6 2-2 6h-8l-2-6-6-2-6 2-4-7 5-5v-6l-5-5 4-7 6 2 6-2Z" />
            <circle cx="24" cy="24" r="7" />
          </svg>
        );
      case "informes":
        return (
          <svg {...comunes}>
            <path d="M7 43h34M12 36V22h6v14m5 0V12h7v24m5 0V5h6v31" />
          </svg>
        );
      case "finalizar":
        return (
          <svg {...comunes}>
            <path d="M10 43V7m0 3c9-8 18 6 29-2v25c-11 8-20-6-29 2M17 12v8m9-9v10m9-10v11M17 28v5m9-12v8m9-7v7" />
          </svg>
        );
      case "wifi":
        return (
          <svg {...comunes}>
            <path d="M5 17c11-10 27-10 38 0M11 24c7-7 19-7 26 0M18 31c4-3 8-3 12 0" />
            <circle cx="24" cy="38" r="2.5" fill="currentColor" stroke="none" />
          </svg>
        );
      case "lock":
        return (
          <svg {...comunes}>
            <rect x="10" y="20" width="28" height="24" rx="4" />
            <path d="M16 20v-7a8 8 0 0 1 16 0v7" />
          </svg>
        );
      default:
        return null;
    }
  }

  const sincronizacionTexto = sincronizando
    ? "Enviant..."
    : pendientes > 0
      ? `${pendientes} pendents`
      : errorServidor
        ? "Sense connexió"
        : "Sincronitzat";
  const resumSets =
    marcador?.setsFinalizados
      .map((set) => `S${set.numero}: ${set.puntosLocal}–${set.puntosVisitante}`)
      .join(" · ") || "Encara no hi ha sets finalitzats";
  const jugadorsLocals = [...(local?.jugadores ?? [])].sort(
    (a, b) => (a.orden ?? 9999) - (b.orden ?? 9999),
  );
  const jugadorsVisitants = [...(visitante?.jugadores ?? [])].sort(
    (a, b) => (a.orden ?? 9999) - (b.orden ?? 9999),
  );
  const fallada = errorAccion || errorServidor || estadoCalculado.error;

  // ÚNICO RETURN DE LA INTERFAZ. Las dos columnas de equipos, el centro,
  // el historial, los diálogos y el resumen viven dentro de este JSX.
  // Sólo VOLEIBOL crea este portal. Gestor/ActaFutbol no se modifican.
  return (
    <>
      {portalListo &&
        createPortal(
          <div
            className="fixed inset-0 z-2147483000 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_50%_-20%,#0a3845_0%,#031c2b_40%,#020e1b_86%)] font-['Geist','Inter',system-ui,sans-serif] text-[14px] leading-[1.35] text-[#eff9ff] [&_button]:cursor-pointer [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-[0.42] [&_button:focus-visible]:outline-[3px] [&_button:focus-visible]:outline-[#ffd13a] [&_button:focus-visible]:outline-offset-2 [&_input:focus-visible]:outline-[3px] [&_input:focus-visible]:outline-[#ffd13a] [&_select:focus-visible]:outline-[3px] [&_select:focus-visible]:outline-[#ffd13a]"
            lang="ca"
          >
            <header className="flex h-19 shrink-0 items-center gap-6.25 border-b border-[#117376] bg-[linear-gradient(100deg,#031423_30%,#062638_70%,#031a22)] px-7.25 max-[1180px]:gap-3.25 max-[1180px]:px-3.25 max-[900px]:h-16.25 max-[560px]:h-14.75 max-[560px]:gap-1.75 max-[560px]:px-2.5">
              <div
                className="flex shrink-0 items-center gap-3.25"
                aria-label="IES Calvià Esports"
              >
                <span
                  className="flex h-10 w-13.25 items-center gap-1.25 [&_img]:h-full [&_img]:w-full [&_img]:object-contain max-[900px]:h-7.25 max-[900px]:w-8 max-[560px]:hidden"
                  aria-hidden="true"
                >
                  <img
                    src="/logo-temporal.png"
                    alt="IES Calvià Esports"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div className="text-[19px] font-black leading-[1.08] tracking-[0.5px] [&_strong]:block [&_strong]:text-[#16d6c1] max-[900px]:text-[14px] max-[560px]:text-[12px]">
                  IES CALVIÀ<strong>ESPORTS</strong>
                </div>
              </div>
              <div
                className="h-9.5 w-px shrink-0 bg-[#b9dfe3]/70 max-[560px]:hidden"
                aria-hidden="true"
              />
              <h1 className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[clamp(17px,2.2vw,32px)] font-black uppercase tracking-[0.2px] max-[900px]:text-[19px] max-[560px]:text-[14px]">
                ACTA DIGITAL · VOLEIBOL
              </h1>
              <div className="flex shrink-0 items-center gap-[9px] whitespace-nowrap rounded-full border border-[#5a9aac] bg-[linear-gradient(90deg,#0b2331,#102d3d)] px-[17px] py-[9px] text-[15px] font-extrabold max-[1180px]:px-2 max-[1180px]:py-2 max-[1180px]:text-xs max-[900px]:hidden">
                <Icono tipo="voleibol" size={22} />
                {[
                  partido.pista,
                  estructura.ronda?.nombre ?? estructura.fase?.nombre,
                ]
                  .filter(Boolean)
                  .join(" · ") || partido.codigo}
              </div>
              <div
                className="h-[38px] w-px shrink-0 bg-[#b9dfe3]/70 max-[560px]:hidden"
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => void leerServidor()}
                aria-label="Actualitzar l'acta des del servidor"
                className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-[#1ac74f] bg-[linear-gradient(90deg,#063420,#073f34)] px-[17px] py-2 text-[15px] font-extrabold text-[#98ffac] max-[560px]:px-2 max-[560px]:text-[0px] max-[560px]:[&_svg]:w-[21px] ${pendientes || sincronizando || errorServidor ? "border-[#bb8c34] bg-[#3c2b11] text-[#ffe19b]" : ""}`}
                title={errorServidor ?? undefined}
                aria-live="polite"
              >
                <Icono tipo="wifi" size={24} />
                {sincronizacionTexto}
              </button>
            </header>

            {(fallada || (!cargando && !puedeEscribir)) && (
              <div
                className="absolute top-[79px] right-4 left-4 z-[3] mx-auto max-w-[740px] rounded-[10px] border border-[#db866d] bg-[#5d281f] px-[15px] py-[10px] text-[#fff2e4] shadow-[0_12px_20px_#0009] [&_button]:float-right [&_button]:ml-[18px] [&_button]:border-0 [&_button]:bg-transparent [&_button]:text-white"
                role="alert"
              >
                {fallada ||
                  "Acta en mode consulta: no tens el control d'escriptura."}
                {errorAccion && (
                  <button
                    type="button"
                    onClick={() => setErrorAccion(null)}
                    aria-label="Tancar avís"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {cargando && !eventos.length ? (
              <div className="grid flex-1 place-items-center text-[21px]">
                Carregant acta...
              </div>
            ) : pantalla === "ACTA" ? (
              <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(390px,1.26fr)_minmax(0,1fr)] gap-4 overflow-hidden px-[15px] pt-[23px] pb-[19px] max-[1180px]:grid-cols-[minmax(0,.9fr)_minmax(350px,1.2fr)_minmax(0,.9fr)] max-[1180px]:gap-[10px] max-[1180px]:p-[11px] max-[900px]:grid-cols-2 max-[900px]:content-start max-[900px]:gap-[11px] max-[900px]:overflow-auto max-[560px]:grid-cols-1 [@media(max-height:750px)_and_(min-width:901px)]:py-[10px]">
                {/* COLUMNA ESQUERRA: equip local */}
                <section
                  className="isolate flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[17px] border border-[#235169] bg-[linear-gradient(#031d2d,#031523)] max-[900px]:min-h-[420px] max-[560px]:min-h-[320px]"
                  aria-label="Jugadors de l'equip local"
                >
                  <div className="relative flex min-h-[124px] items-center gap-[17px] overflow-hidden border-b border-[#168e89] bg-[linear-gradient(110deg,#035958,#006c64_45%,#004d50)] px-[21px] py-[17px] before:pointer-events-none before:absolute before:top-[-27px] before:right-[36px] before:h-[190px] before:w-[21px] before:skew-x-[-29deg] before:bg-[#1fa99c55] before:content-[''] after:pointer-events-none after:absolute after:top-[-27px] after:right-[14px] after:h-[190px] after:w-[12px] after:skew-x-[-29deg] after:bg-[#0dc5b454] after:content-[''] max-[1180px]:min-h-[100px] max-[1180px]:gap-2 max-[1180px]:p-[10px] max-[900px]:min-h-20 [@media(max-height:750px)_and_(min-width:901px)]:min-h-[83px]">
                    <div className="grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#b9ffff] bg-[linear-gradient(140deg,#fff,#b5eff1)] text-[#008f8b] shadow-[0_5px_16px_#001c2aaa] [&_img]:h-[80%] [&_img]:w-[80%] [&_img]:object-contain max-[1180px]:h-[65px] max-[1180px]:w-[65px] max-[900px]:h-[55px] max-[900px]:w-[55px]">
                      {local?.escudo ? (
                        <img
                          src={local.escudo}
                          alt={`Escut de ${local.nombre}`}
                        />
                      ) : (
                        <Icono tipo="voleibol" size={64} />
                      )}
                    </div>
                    <div className="relative z-[1] min-w-0 [&_small]:block [&_small]:text-[16px] [&_small]:font-extrabold [&_small]:tracking-[0.5px] [&_small]:text-[#b6e4e3] [&_h2]:mt-[3px] [&_h2]:text-[clamp(15px,1.75vw,26px)] [&_h2]:leading-[1.1] [&_h2]:font-black [&_h2]:uppercase [&_h2]:[overflow-wrap:anywhere] max-[900px]:[&_h2]:text-[16px]">
                      <small>LOCAL ·</small>
                      <h2>{local?.nombre ?? "Equip pendent"}</h2>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto px-3 pt-5 pb-[10px] [scrollbar-color:#1a8b8e_transparent] [scrollbar-width:thin] [@media(max-height:750px)_and_(min-width:901px)]:pt-[10px]">
                    <div className="grid grid-cols-3 gap-[14px] max-[1180px]:gap-[7px] [@media(max-height:750px)_and_(min-width:901px)]:gap-2">
                      {jugadorsLocals.map((jugador) => {
                        const seleccionado =
                          jugadorSeleccionado?.jugador.id === jugador.id &&
                          jugadorSeleccionado.equipoID === local?.id;
                        return (
                          <button
                            key={jugador.id}
                            type="button"
                            className={`flex min-h-[125px] min-w-0 touch-manipulation flex-col items-center justify-center gap-[7px] rounded-2xl border border-[#527b90] bg-[linear-gradient(155deg,#183c4d,#092333)] px-1 py-[11px] text-white shadow-[inset_0_0_10px_#d5f9ff08] transition-[background,border-color,transform] duration-150 [&_svg]:h-[65px] [&_svg]:w-[65px] [&_svg]:shrink [&_svg]:text-[#d5e3ed] [&_svg]:drop-shadow-[0_3px_1px_#0004] [&_span]:text-center [&_span]:text-[clamp(12px,1.4vw,16px)] [&_span]:leading-[1.1] [&_span]:font-extrabold [&_span]:[overflow-wrap:anywhere] hover:enabled:-translate-y-[2px] hover:enabled:border-[#1cf6df] active:enabled:scale-[0.98] max-[1180px]:min-h-[107px] max-[1180px]:[&_svg]:h-12 max-[1180px]:[&_svg]:w-12 [@media(max-height:750px)_and_(min-width:901px)]:min-h-[93px] [@media(max-height:750px)_and_(min-width:901px)]:[&_svg]:h-[45px] [@media(max-height:750px)_and_(min-width:901px)]:[&_svg]:w-[45px] [@media(max-height:750px)_and_(min-width:901px)]:[&_span]:text-[15px] ${seleccionado ? "border-2 border-[#ffd13a] bg-[linear-gradient(140deg,#685218,#282b1b)] shadow-[0_0_0_2px_#ebc01e65,0_0_18px_#c99f2c32] [&_svg]:text-[#ffd13a]" : ""}`}
                            disabled={!puedeEscribir || !setActual}
                            aria-pressed={seleccionado}
                            onClick={() => {
                              if (local) seleccionarJugador(local.id, jugador);
                            }}
                          >
                            <Icono tipo="jugador" size={50} />
                            <span>{nombreJugador(jugador)}</span>
                          </button>
                        );
                      })}
                      {!jugadorsLocals.length && (
                        <p className="col-span-full text-center text-[#a9c3d1]">
                          Sense jugadors actius
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mx-3 mt-[9px] mb-5 flex min-h-[79px] items-center gap-[21px] rounded-[14px] border border-[#58849a] bg-[linear-gradient(150deg,#173b4e,#0c2939)] px-[26px] py-[14px] text-[19px] font-extrabold [&_svg]:h-10 [&_svg]:w-10 [&_svg]:text-[#60eddb] max-[1180px]:mx-2 max-[1180px]:mt-[7px] max-[1180px]:mb-[11px] max-[1180px]:min-h-[58px] max-[1180px]:p-[10px] max-[560px]:mb-[9px] max-[560px]:min-h-[65px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[55px] [@media(max-height:750px)_and_(min-width:901px)]:mb-[10px]">
                    <Icono tipo="entrenador" size={41} />
                    <span>Entrenador</span>
                  </div>
                </section>

                {/* COLUMNA CENTRAL: marcador, reloj, tipos, historial y acciones */}
                <div className="flex min-h-0 min-w-0 flex-col gap-3 max-[900px]:col-span-full max-[900px]:row-start-1 max-[900px]:min-h-[650px] max-[560px]:min-h-[630px]">
                  <section
                    className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#244b60] bg-[linear-gradient(170deg,#031523,#041c29)]"
                    aria-label="Marcador i controls del partit"
                  >
                    <div className="px-[22px] pt-[5px]">
                      <div className="grid grid-cols-[minmax(0,1fr)_128px_minmax(0,1fr)] items-center gap-[2px] text-center">
                        <div
                          className="text-[clamp(55px,6.9vw,94px)] leading-none font-black tracking-[-3px] tabular-nums max-[1180px]:text-[62px] max-[560px]:text-[57px]"
                          aria-label="Punts de l'equip local"
                        >
                          {String(setActual?.puntosLocal ?? 0).padStart(2, "0")}
                        </div>
                        <div>
                          <div className="text-[16px] font-extrabold tracking-[0.8px]">
                            SETS
                          </div>
                          <div className="text-[23px] leading-[1.1] font-black tabular-nums">
                            {marcador?.setsGanadosLocal ?? 0} –{" "}
                            {marcador?.setsGanadosVisitante ?? 0}
                          </div>
                          <span className="mx-auto mt-[7px] block max-w-[115px] rounded-full bg-[linear-gradient(120deg,#06ada7,#08e2c4)] px-[15px] py-[5px] text-[15px] font-black text-[#002b35]">
                            {setActual
                              ? setActual.tipo === "EXTRA"
                                ? "EXTRA SET"
                                : `SET ${setActual.numero}`
                              : "FINAL"}
                          </span>
                        </div>
                        <div
                          className="text-[clamp(55px,6.9vw,94px)] leading-none font-black tracking-[-3px] tabular-nums max-[1180px]:text-[62px] max-[560px]:text-[57px]"
                          aria-label="Punts de l'equip visitant"
                        >
                          {String(setActual?.puntosVisitante ?? 0).padStart(
                            2,
                            "0",
                          )}
                        </div>
                      </div>
                      <p
                        className="mx-auto mt-[9px] min-h-[25px] w-max max-w-full overflow-hidden rounded-full border border-[#6b94a2] px-[19px] py-1 text-center text-xs font-bold text-[#d2e4f0] text-ellipsis whitespace-nowrap"
                        title={resumSets}
                      >
                        {resumSets}
                      </p>
                    </div>

                    <div className="mx-5 h-px bg-[#6593a3]/80" />
                    <div className="flex flex-col items-center justify-center px-1 pb-[5px]">
                      <button
                        type="button"
                        className={`border-0 bg-transparent px-[18px] py-1 text-[clamp(60px,6.2vw,81px)] leading-[1.04] font-black tracking-[3px] tabular-nums text-[#10dfca] [text-shadow:0_0_28px_#0bcab262] [@media(max-height:750px)_and_(min-width:901px)]:text-[66px] ${relojActivo ? "" : "text-[#56a9b0] [text-shadow:0_0_20px_#3f9ca836]"}`}
                        disabled={!puedeEscribir}
                        aria-pressed={relojActivo}
                        aria-label={
                          relojActivo ? "Aturar el temps" : "Iniciar el temps"
                        }
                        onClick={() =>
                          relojActivo ? detenerReloj() : setRelojActivo(true)
                        }
                      >
                        {segundosTexto(relojSegundos)}
                      </button>
                      <div className="text-[11px] font-extrabold tracking-[1.7px] text-[#10d8c4] uppercase">
                        TOCA EL TEMPS PER {relojActivo ? "ATURAR" : "INICIAR"}
                      </div>
                    </div>

                    <div className="mx-[18px] mb-[7px] flex items-center gap-4 whitespace-nowrap text-[17px] font-black tracking-[0.5px] uppercase before:h-px before:flex-1 before:bg-[#75b5c5] before:content-[''] after:h-px after:flex-1 after:bg-[#75b5c5] after:content-[''] [@media(max-height:750px)_and_(min-width:901px)]:mb-[5px] [@media(max-height:750px)_and_(min-width:901px)]:text-[14px]">
                      TIPUS DE PUNT
                    </div>
                    <div className="grid grid-cols-4 gap-[9px] px-[19px]">
                      {TIPOS_PUNTO_VOLEIBOL.map((tipo) => (
                        <button
                          key={tipo}
                          type="button"
                          className={`flex h-[82px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-[13px] border-[1.5px] border-[#0bcabf] bg-[linear-gradient(#052936,#03222b)] text-white transition-all duration-150 hover:enabled:bg-[#05505a] [&_svg]:h-10 [&_svg]:w-11 [&_svg]:text-[#dfedf6] [&_span]:text-[17px] [&_span]:font-extrabold max-[1180px]:h-[75px] max-[1180px]:[&_svg]:h-[29px] max-[1180px]:[&_svg]:w-[29px] max-[560px]:h-[76px] [@media(max-height:750px)_and_(min-width:901px)]:h-[62px] [@media(max-height:750px)_and_(min-width:901px)]:[&_svg]:h-7 [@media(max-height:750px)_and_(min-width:901px)]:[&_svg]:w-7 ${tipoSeleccionado === tipo ? "border-[3px] border-[#ffce2b] bg-[linear-gradient(140deg,#554209,#221f0c)] text-[#fff1b2] shadow-[0_0_18px_#ecc02d61] [&_svg]:text-[#ffce2b]" : ""}`}
                          disabled={!puedeEscribir || !setActual}
                          aria-pressed={tipoSeleccionado === tipo}
                          onClick={() => seleccionarTipo(tipo)}
                        >
                          <span
                            className="relative grid h-[43px] w-12 place-items-center [&_svg]:h-10 [&_svg]:w-[43px] [&_img]:absolute [&_img]:inset-0 [&_img]:h-full [&_img]:w-full [&_img]:object-contain"
                            aria-hidden="true"
                          >
                            <Icono tipo={tipo} size={42} />
                            {/* <img
                              src={IMAGENES_PUNTO[tipo]}
                              alt=""
                              onError={(evento) => {
                                evento.currentTarget.classList.add("hidden");
                              }}
                            /> */}
                          </span>
                          <span>{NOMBRES_TIPO[tipo]}</span>
                        </button>
                      ))}
                    </div>
                    <div
                      className="flex min-h-[27px] items-center justify-center px-3 pt-[3px] pb-[5px] text-center text-xs text-[#aedbdc]"
                      aria-live="polite"
                    >
                      {tipoSeleccionado
                        ? `Ara selecciona un jugador · ${NOMBRES_TIPO[tipoSeleccionado]}${tipoSeleccionado === "ERROR" ? " (punt contrari)" : ""}`
                        : jugadorSeleccionado
                          ? `Selecciona el tipus de punt · ${nombreJugador(jugadorSeleccionado.jugador)}`
                          : "Selecciona un tipus de punt i un jugador, en qualsevol ordre"}
                      {(tipoSeleccionado || jugadorSeleccionado) && (
                        <button
                          type="button"
                          className="ml-[10px] border-0 bg-transparent font-extrabold text-[#ffcb54]"
                          onClick={() => {
                            setTipoSeleccionado(null);
                            setJugadorSeleccionado(null);
                          }}
                        >
                          Cancel·la
                        </button>
                      )}
                    </div>

                    <section
                      className="mt-[2px] flex min-h-[150px] flex-1 flex-col overflow-hidden rounded-[13px] border-t border-[#1e5d73] bg-[linear-gradient(#123142,#071c2b)] max-[900px]:min-h-[220px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[110px]"
                      aria-label="Historial de jugades"
                    >
                      <div className="flex items-center justify-between gap-2 px-[14px] pt-[9px] pb-[6px] text-[15px] font-black uppercase [&_svg]:h-[19px] [&_svg]:w-[19px] [&_em]:text-[11px] [&_em]:font-normal [&_em]:text-[#ced7df] [&_em]:normal-case max-[560px]:[&_em]:hidden">
                        <span className="flex items-center gap-2">
                          <Icono tipo="historico" size={19} /> HISTORIAL DE
                          JUGADES
                        </span>
                        <em>Mantén premut per corregir</em>
                      </div>
                      <div className="min-h-0 flex-1 overflow-auto px-3 pb-[10px] [scrollbar-color:#17b3b2_transparent] [scrollbar-width:thin]">
                        {[...historial].reverse().map((punto, indice) => {
                          const evento = eventos.find(
                            (e) =>
                              e.clienteEventoID === punto.clienteEventoID &&
                              e.estado === "ACTIVO",
                          );
                          if (!evento) return null;
                          const setCerrado = marcador?.setsFinalizados.find(
                            (set) => set.numero === punto.numeroSet,
                          );
                          const protegido = Boolean(setCerrado);
                          const ultimo =
                            ultimoEventoActivo?.clienteEventoID ===
                            punto.clienteEventoID;
                          return (
                            <div key={punto.clienteEventoID}>
                              {punto.cierraSet && setCerrado && (
                                <div className="mb-1 flex items-center gap-[10px] rounded-[7px] border border-[#10b4ac] bg-[linear-gradient(90deg,#0c5155,#064046)] p-[9px] text-xs font-black text-[#a5fff1] [&_button]:ml-auto [&_button]:rounded-[7px] [&_button]:border [&_button]:border-[#d69f7b] [&_button]:bg-[#6d282c] [&_button]:px-2 [&_button]:py-[5px] [&_button]:text-[11px] [&_button]:font-extrabold [&_button]:text-white">
                                  <Icono tipo="finalizar" size={22} />
                                  <span>FI DE SET {setCerrado.numero}</span>
                                  <span>
                                    {setCerrado.puntosLocal} –{" "}
                                    {setCerrado.puntosVisitante}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={!puedeEscribir}
                                    onClick={() =>
                                      solicitarDeshacerFinSet(
                                        setCerrado.numero,
                                        punto.clienteEventoID,
                                      )
                                    }
                                  >
                                    Desfer fi de set
                                  </button>
                                </div>
                              )}
                              <div
                                className={`mb-[3px] flex min-h-[37px] touch-pan-y select-none items-center gap-[10px] rounded-[7px] border border-[#173c4d] bg-[#071f2e] px-[10px] py-[5px] ${indice === 0 ? "border-[#c8aa2d] bg-[linear-gradient(90deg,#5b4a14,#372f13)] text-[#ffe5a4]" : ""} ${protegido ? "opacity-[0.57]" : ""}`}
                                onPointerDown={(e) => {
                                  if (
                                    e.target instanceof HTMLElement &&
                                    e.target.closest("button")
                                  )
                                    return;
                                  iniciarPulsacion(evento);
                                }}
                                onPointerUp={cancelarPulsacion}
                                onPointerCancel={cancelarPulsacion}
                                onPointerLeave={cancelarPulsacion}
                                onContextMenu={(e) => e.preventDefault()}
                              >
                                <span className="min-w-[47px] text-[13px] font-extrabold tabular-nums">
                                  {segundosTexto(
                                    evento.tiempoJuegoSegundos ?? 0,
                                  )}
                                </span>
                                <span className="grid min-w-[27px] place-items-center [&_svg]:h-[25px] [&_svg]:w-[25px] [&_svg]:text-[#d2e1e8]">
                                  <Icono tipo={evento.tipoEvento} size={24} />
                                </span>
                                <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px]">
                                  {evento.jugadorNombre ?? "Jugador"} ·{" "}
                                  {NOMBRES_TIPO[
                                    evento.tipoEvento as TipoPuntoVoleibol
                                  ] ?? evento.tipoEvento}
                                </span>
                                <span className="whitespace-nowrap text-[15px] font-black">
                                  {String(punto.puntosLocal).padStart(2, "0")} –{" "}
                                  {String(punto.puntosVisitante).padStart(
                                    2,
                                    "0",
                                  )}
                                </span>
                                {protegido ? (
                                  <span title="Set tancat">
                                    <Icono tipo="lock" size={16} />
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={!puedeEscribir}
                                    className={`rounded-md border border-[#4e7b8b] bg-transparent px-[5px] py-[3px] text-[11px] text-[#bdd8e0] ${ultimo ? "" : "border-[#a66a64] text-[#ffd3cb]"}`}
                                    onClick={() =>
                                      ultimo
                                        ? solicitarModificar(evento)
                                        : solicitarEliminar(evento)
                                    }
                                  >
                                    {ultimo ? "Editar" : "Eliminar"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!historial.length && (
                          <p className="text-center text-[#a6c8d5]">
                            Encara no hi ha jugades.
                          </p>
                        )}
                      </div>
                    </section>
                  </section>

                  <nav
                    className="grid grid-cols-5 gap-2 max-[900px]:mx-auto max-[900px]:w-full max-[900px]:max-w-[600px] max-[560px]:gap-[5px] [@media(max-height:750px)_and_(min-width:901px)]:gap-[5px]"
                    aria-label="Accions del partit"
                  >
                    <button
                      type="button"
                      className="flex min-h-[77px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#5b869d] bg-[linear-gradient(#183b4c,#092332)] text-xs font-extrabold text-[#f2f8fb] hover:enabled:border-[#16d6c1] hover:enabled:bg-[#154457] [&_svg]:h-[25px] [&_svg]:w-[25px] max-[560px]:p-1 max-[560px]:text-[10px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[58px]"
                      onClick={() => {
                        window.location.href = `/panell/partits${window.location.search}`;
                      }}
                    >
                      <Icono tipo="volver" /> Tornar
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[77px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#5b869d] bg-[linear-gradient(#183b4c,#092332)] text-xs font-extrabold text-[#f2f8fb] hover:enabled:border-[#16d6c1] hover:enabled:bg-[#154457] [&_svg]:h-[25px] [&_svg]:w-[25px] max-[560px]:p-1 max-[560px]:text-[10px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[58px]"
                      disabled={!puedeEscribir || !pendientes || sincronizando}
                      onClick={() => void sincronizar()}
                    >
                      <Icono tipo="reenviar" /> Reenviar
                    </button>
                    <button
                      type="button"
                      className="flex min-h-[77px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#5b869d] bg-[linear-gradient(#183b4c,#092332)] text-xs font-extrabold text-[#f2f8fb] hover:enabled:border-[#16d6c1] hover:enabled:bg-[#154457] [&_svg]:h-[25px] [&_svg]:w-[25px] max-[560px]:p-1 max-[560px]:text-[10px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[58px]"
                      onClick={abrirConfiguracion}
                    >
                      <Icono tipo="config" /> Configuració
                    </button>
                    <Informes
                      partidoID={partido.id}
                      controlToken={controlToken}
                      editable={puedeEscribir}
                      tema="oscuro"
                      equipos={[local, visitante]
                        .filter((equipo): equipo is Equipo => equipo !== null)
                        .map((equipo) => ({
                          id: equipo.id,
                          nombre: equipo.nombre,
                        }))}
                    />
                    <button
                      type="button"
                      className="flex min-h-[77px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#5b869d] bg-[linear-gradient(#183b4c,#092332)] text-xs font-extrabold text-[#f2f8fb] hover:enabled:border-[#16d6c1] hover:enabled:bg-[#154457] [&_svg]:h-[25px] [&_svg]:w-[25px] max-[560px]:p-1 max-[560px]:text-[10px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[58px] border-[#ff6269] bg-[linear-gradient(#a33740,#651722)]"
                      disabled={!marcador || !puedeEscribir}
                      onClick={() => {
                        setPantalla("RESUMEN");
                        setModoCierre("NORMAL");
                        setConfirmadoForzado(false);
                      }}
                    >
                      <Icono tipo="finalizar" /> Finalitzar
                    </button>
                  </nav>
                </div>

                {/* COLUMNA DRETA: equip visitant */}
                <section
                  className="isolate flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[17px] border border-[#235169] bg-[linear-gradient(#031d2d,#031523)] max-[900px]:min-h-[420px] max-[560px]:min-h-[320px]"
                  aria-label="Jugadors de l'equip visitant"
                >
                  <div className="relative flex min-h-[124px] items-center gap-[17px] overflow-hidden border-b border-[#168e89] bg-[linear-gradient(110deg,#035958,#006c64_45%,#004d50)] px-[21px] py-[17px] before:pointer-events-none before:absolute before:top-[-27px] before:right-[36px] before:h-[190px] before:w-[21px] before:skew-x-[-29deg] before:bg-[#1fa99c55] before:content-[''] after:pointer-events-none after:absolute after:top-[-27px] after:right-[14px] after:h-[190px] after:w-[12px] after:skew-x-[-29deg] after:bg-[#0dc5b454] after:content-[''] max-[1180px]:min-h-[100px] max-[1180px]:gap-2 max-[1180px]:p-[10px] max-[900px]:min-h-20 [@media(max-height:750px)_and_(min-width:901px)]:min-h-[83px]">
                    <div className="grid h-[88px] w-[88px] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#b9ffff] bg-[linear-gradient(140deg,#fff,#b5eff1)] text-[#008f8b] shadow-[0_5px_16px_#001c2aaa] [&_img]:h-[80%] [&_img]:w-[80%] [&_img]:object-contain max-[1180px]:h-[65px] max-[1180px]:w-[65px] max-[900px]:h-[55px] max-[900px]:w-[55px]">
                      {visitante?.escudo ? (
                        <img
                          src={visitante.escudo}
                          alt={`Escut de ${visitante.nombre}`}
                        />
                      ) : (
                        <Icono tipo="voleibol" size={64} />
                      )}
                    </div>
                    <div className="relative z-[1] min-w-0 [&_small]:block [&_small]:text-[16px] [&_small]:font-extrabold [&_small]:tracking-[0.5px] [&_small]:text-[#b6e4e3] [&_h2]:mt-[3px] [&_h2]:text-[clamp(15px,1.75vw,26px)] [&_h2]:leading-[1.1] [&_h2]:font-black [&_h2]:uppercase [&_h2]:[overflow-wrap:anywhere] max-[900px]:[&_h2]:text-[16px]">
                      <small>VISITANT ·</small>
                      <h2>{visitante?.nombre ?? "Equip pendent"}</h2>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto px-3 pt-5 pb-[10px] [scrollbar-color:#1a8b8e_transparent] [scrollbar-width:thin] [@media(max-height:750px)_and_(min-width:901px)]:pt-[10px]">
                    <div className="grid grid-cols-3 gap-[14px] max-[1180px]:gap-[7px] [@media(max-height:750px)_and_(min-width:901px)]:gap-2">
                      {jugadorsVisitants.map((jugador) => {
                        const seleccionado =
                          jugadorSeleccionado?.jugador.id === jugador.id &&
                          jugadorSeleccionado.equipoID === visitante?.id;
                        return (
                          <button
                            key={jugador.id}
                            type="button"
                            className={`flex min-h-[125px] min-w-0 touch-manipulation flex-col items-center justify-center gap-[7px] rounded-2xl border border-[#527b90] bg-[linear-gradient(155deg,#183c4d,#092333)] px-1 py-[11px] text-white shadow-[inset_0_0_10px_#d5f9ff08] transition-[background,border-color,transform] duration-150 [&_svg]:h-[65px] [&_svg]:w-[65px] [&_svg]:shrink [&_svg]:text-[#d5e3ed] [&_svg]:drop-shadow-[0_3px_1px_#0004] [&_span]:text-center [&_span]:text-[clamp(12px,1.4vw,16px)] [&_span]:leading-[1.1] [&_span]:font-extrabold [&_span]:[overflow-wrap:anywhere] hover:enabled:-translate-y-[2px] hover:enabled:border-[#1cf6df] active:enabled:scale-[0.98] max-[1180px]:min-h-[107px] max-[1180px]:[&_svg]:h-12 max-[1180px]:[&_svg]:w-12 [@media(max-height:750px)_and_(min-width:901px)]:min-h-[93px] [@media(max-height:750px)_and_(min-width:901px)]:[&_svg]:h-[45px] [@media(max-height:750px)_and_(min-width:901px)]:[&_svg]:w-[45px] [@media(max-height:750px)_and_(min-width:901px)]:[&_span]:text-[15px] ${seleccionado ? "border-2 border-[#ffd13a] bg-[linear-gradient(140deg,#685218,#282b1b)] shadow-[0_0_0_2px_#ebc01e65,0_0_18px_#c99f2c32] [&_svg]:text-[#ffd13a]" : ""}`}
                            disabled={!puedeEscribir || !setActual}
                            aria-pressed={seleccionado}
                            onClick={() => {
                              if (visitante)
                                seleccionarJugador(visitante.id, jugador);
                            }}
                          >
                            <Icono tipo="jugador" size={50} />
                            <span>{nombreJugador(jugador)}</span>
                          </button>
                        );
                      })}
                      {!jugadorsVisitants.length && (
                        <p className="col-span-full text-center text-[#a9c3d1]">
                          Sense jugadors actius
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mx-3 mt-[9px] mb-5 flex min-h-[79px] items-center gap-[21px] rounded-[14px] border border-[#58849a] bg-[linear-gradient(150deg,#173b4e,#0c2939)] px-[26px] py-[14px] text-[19px] font-extrabold [&_svg]:h-10 [&_svg]:w-10 [&_svg]:text-[#60eddb] max-[1180px]:mx-2 max-[1180px]:mt-[7px] max-[1180px]:mb-[11px] max-[1180px]:min-h-[58px] max-[1180px]:p-[10px] max-[560px]:mb-[9px] max-[560px]:min-h-[65px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[55px] [@media(max-height:750px)_and_(min-width:901px)]:mb-[10px]">
                    <Icono tipo="entrenador" size={41} />
                    <span>Entrenador</span>
                  </div>
                </section>
              </main>
            ) : (
              <main className="grid min-h-0 flex-1 grid-cols-1 place-items-start overflow-y-auto px-[15px] pt-[23px] pb-[19px] [&>*]:justify-self-center max-[560px]:p-[11px]">
                <section className="max-h-[min(90dvh,900px)] w-[min(100%,620px)] overflow-auto rounded-[20px] border border-[#378e95] bg-[linear-gradient(155deg,#0b3042,#061b2b)] p-[25px] shadow-[0_22px_80px_#000c] [&_h2]:mb-[9px] [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-[#f5fcff] [&_p]:my-2 [&_p]:text-[#c9dce5] [&_label]:my-3 [&_label]:block [&_label]:text-[13px] [&_label]:font-extrabold [&_label]:text-[#e7f5fd] [&_select]:mt-[5px] [&_select]:block [&_select]:w-full [&_select]:rounded-[9px] [&_select]:border [&_select]:border-[#5d8494] [&_select]:bg-[#071a28] [&_select]:px-3 [&_select]:py-[10px] [&_select]:text-white [&_textarea]:mt-[5px] [&_textarea]:block [&_textarea]:min-h-[100px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[9px] [&_textarea]:border [&_textarea]:border-[#5d8494] [&_textarea]:bg-[#071a28] [&_textarea]:px-3 [&_textarea]:py-[10px] [&_textarea]:text-white max-[560px]:p-4 relative max-h-none w-[min(100%,760px)]">
                  <h2>Resum i confirmació de l'acta</h2>
                  <p>
                    Revisa el marcador abans de confirmar el resultat definitiu.
                  </p>
                  <div className="my-[18px] grid grid-cols-2 gap-3 [&_div]:rounded-xl [&_div]:border [&_div]:border-[#34687a] [&_div]:bg-[#0d3040] [&_div]:p-4 [&_div]:text-center [&_strong]:block [&_strong]:text-[55px] [&_strong]:text-[#0de0c6] [&_span]:block [&_span]:text-xs [&_span]:text-[#b8d4e2]">
                    {[local, visitante].map((equipo, indice) => (
                      <div key={equipo?.id ?? indice}>
                        <p>{equipo?.nombre ?? "Equip"}</p>
                        <strong>
                          {indice === 0
                            ? marcador?.setsGanadosLocal
                            : marcador?.setsGanadosVisitante}
                        </strong>
                        <span>Sets guanyats</span>
                      </div>
                    ))}
                  </div>
                  <table className="mt-4 w-full border-collapse [&_th]:border-b [&_th]:border-[#35566a] [&_th]:p-[10px] [&_th]:text-center [&_td]:border-b [&_td]:border-[#35566a] [&_td]:p-[10px] [&_td]:text-center [&_th:first-child]:text-left [&_td:first-child]:text-left [&_thead]:bg-[#103849]">
                    <thead>
                      <tr>
                        <th>Set</th>
                        <th>Local</th>
                        <th>Visitant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marcador?.setsFinalizados.map((set) => (
                        <tr key={set.numero}>
                          <td>
                            {set.tipo === "EXTRA"
                              ? "Extra set"
                              : `Set ${set.numero}`}
                          </td>
                          <td>{set.puntosLocal}</td>
                          <td>{set.puntosVisitante}</td>
                        </tr>
                      ))}
                      {marcador?.setActual &&
                        marcador.setActual.puntosLocal +
                          marcador.setActual.puntosVisitante >
                          0 && (
                          <tr>
                            <td>Set {marcador.setActual.numero} (en curs)</td>
                            <td>{marcador.setActual.puntosLocal}</td>
                            <td>{marcador.setActual.puntosVisitante}</td>
                          </tr>
                        )}
                      <tr>
                        <td>
                          <strong>Total punts</strong>
                        </td>
                        <td>{marcador?.puntosTotalesLocal}</td>
                        <td>{marcador?.puntosTotalesVisitante}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-[18px] flex flex-wrap gap-[10px]">
                    <button
                      className={
                        modoCierre === "NORMAL"
                          ? "rounded-[10px] border border-[#20cdc0] bg-[#009d95] px-4 py-[11px] font-extrabold text-white"
                          : "rounded-[10px] border border-[#517d8d] bg-[#183a4d] px-4 py-[11px] font-extrabold text-white"
                      }
                      type="button"
                      onClick={() => {
                        setModoCierre("NORMAL");
                        setConfirmadoForzado(false);
                      }}
                    >
                      Tancament normal
                    </button>
                    <button
                      className={
                        modoCierre === "FORZADO_PUNTOS"
                          ? "rounded-[10px] border border-[#20cdc0] bg-[#009d95] px-4 py-[11px] font-extrabold text-white"
                          : "rounded-[10px] border border-[#517d8d] bg-[#183a4d] px-4 py-[11px] font-extrabold text-white"
                      }
                      type="button"
                      onClick={() => {
                        setModoCierre("FORZADO_PUNTOS");
                        setConfirmadoForzado(false);
                      }}
                    >
                      Forçar tancament per punts
                    </button>
                  </div>
                  <p className="rounded-[10px] border border-[#ae8e4d] bg-[#3b310d] p-3 text-[#ffe9ab]">
                    {evaluacion?.mensaje ?? "No hi ha marcador vàlid."}
                  </p>
                  {evaluacion?.ganadorEquipoID && (
                    <p>
                      Guanyador:{" "}
                      {evaluacion.ganadorEquipoID === local?.id
                        ? local?.nombre
                        : visitante?.nombre}
                    </p>
                  )}
                  {modoCierre === "FORZADO_PUNTOS" && (
                    <label>
                      <input
                        type="checkbox"
                        checked={confirmadoForzado}
                        onChange={(e) => setConfirmadoForzado(e.target.checked)}
                      />
                      Confirm que vull tancar excepcionalment per punts totals.
                    </label>
                  )}
                  {pendientes > 0 && (
                    <p className="rounded-[10px] border border-[#ae8e4d] bg-[#3b310d] p-3 text-[#ffe9ab]">
                      Queden {pendientes} operacions sense enviar.
                    </p>
                  )}
                  {informePendiente && (
                    <p className="rounded-[10px] border border-[#ae8e4d] bg-[#3b310d] p-3 text-[#ffe9ab]">
                      Hi ha informes locals pendents de sincronitzar.
                    </p>
                  )}
                  <div className="mt-[18px] flex flex-wrap gap-[10px]">
                    <button
                      className="rounded-[10px] border border-[#517d8d] bg-[#183a4d] px-4 py-[11px] font-extrabold text-white"
                      type="button"
                      onClick={() => setPantalla("ACTA")}
                    >
                      Tornar a l'acta
                    </button>
                    <button
                      className="rounded-[10px] border border-[#ed6574] bg-[#a63040] px-4 py-[11px] font-extrabold text-white"
                      type="button"
                      disabled={
                        !puedeEscribir ||
                        !evaluacion?.permitido ||
                        finalizando ||
                        pendientes > 0 ||
                        informePendiente ||
                        (modoCierre === "FORZADO_PUNTOS" && !confirmadoForzado)
                      }
                      onClick={() => void finalizarPartido()}
                    >
                      {finalizando
                        ? "Finalitzant..."
                        : "Confirmar i tancar definitivament"}
                    </button>
                  </div>
                </section>
              </main>
            )}

            <footer className="flex h-[52px] shrink-0 items-center justify-between gap-3 border-t border-[#0bb7ac] bg-[linear-gradient(110deg,#053d3b,#042c38_48%,#006158_100%)] px-[22px] max-[560px]:h-12 max-[560px]:px-[11px]">
              <span className="flex items-center gap-[7px] text-[13px] font-black text-[#8cff9b]">
                <Icono tipo="wifi" size={23} />
                {sincronizacionTexto}
                <span className="font-normal text-[#dcecee]">
                  · Dades del partit
                </span>
              </span>
              <small className="text-xs italic text-[#e2e7ee] max-[560px]:text-[9px]">
                Acta digital de voleibol · IES Calvià Esports
              </small>
            </footer>

            {avisoSet && (
              <div
                className="absolute inset-0 z-[9] grid place-items-center overflow-auto bg-[#00111fd9] p-[15px] backdrop-blur-[7px]"
                role="dialog"
                aria-modal="true"
                aria-label="Final de set"
              >
                <div className="max-h-[min(90dvh,900px)] w-[min(100%,620px)] overflow-auto rounded-[20px] border border-[#378e95] bg-[linear-gradient(155deg,#0b3042,#061b2b)] p-[25px] shadow-[0_22px_80px_#000c] [&_h2]:mb-[9px] [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-[#f5fcff] [&_p]:my-2 [&_p]:text-[#c9dce5] [&_label]:my-3 [&_label]:block [&_label]:text-[13px] [&_label]:font-extrabold [&_label]:text-[#e7f5fd] [&_select]:mt-[5px] [&_select]:block [&_select]:w-full [&_select]:rounded-[9px] [&_select]:border [&_select]:border-[#5d8494] [&_select]:bg-[#071a28] [&_select]:px-3 [&_select]:py-[10px] [&_select]:text-white [&_textarea]:mt-[5px] [&_textarea]:block [&_textarea]:min-h-[100px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[9px] [&_textarea]:border [&_textarea]:border-[#5d8494] [&_textarea]:bg-[#071a28] [&_textarea]:px-3 [&_textarea]:py-[10px] [&_textarea]:text-white max-[560px]:p-4 max-w-[420px] text-center">
                  <h2>{avisoSet}</h2>
                  <p>
                    {marcador?.finalizadoPorSets
                      ? "El partit ja es pot finalitzar."
                      : marcador?.requiereExtraSet
                        ? "Els sets estan empatats. Comença l'extra set."
                        : "Prepara el set següent."}
                  </p>
                  <div className="mt-[18px] flex flex-wrap gap-[10px] justify-center">
                    <button
                      type="button"
                      className="rounded-[10px] border border-[#20cdc0] bg-[#009d95] px-4 py-[11px] font-extrabold text-white"
                      onClick={() => {
                        setAvisoSet(null);
                        if (marcador?.finalizadoPorSets) setPantalla("RESUMEN");
                      }}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {dialogo && (
              <div
                className="absolute inset-0 z-[9] grid place-items-center overflow-auto bg-[#00111fd9] p-[15px] backdrop-blur-[7px]"
                role="dialog"
                aria-modal="true"
                aria-label="Opcions de l'acta"
              >
                <div className="max-h-[min(90dvh,900px)] w-[min(100%,620px)] overflow-auto rounded-[20px] border border-[#378e95] bg-[linear-gradient(155deg,#0b3042,#061b2b)] p-[25px] shadow-[0_22px_80px_#000c] [&_h2]:mb-[9px] [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-[#f5fcff] [&_p]:my-2 [&_p]:text-[#c9dce5] [&_label]:my-3 [&_label]:block [&_label]:text-[13px] [&_label]:font-extrabold [&_label]:text-[#e7f5fd] [&_select]:mt-[5px] [&_select]:block [&_select]:w-full [&_select]:rounded-[9px] [&_select]:border [&_select]:border-[#5d8494] [&_select]:bg-[#071a28] [&_select]:px-3 [&_select]:py-[10px] [&_select]:text-white [&_textarea]:mt-[5px] [&_textarea]:block [&_textarea]:min-h-[100px] [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-[9px] [&_textarea]:border [&_textarea]:border-[#5d8494] [&_textarea]:bg-[#071a28] [&_textarea]:px-3 [&_textarea]:py-[10px] [&_textarea]:text-white max-[560px]:p-4">
                  {dialogo === "CONFIG" && (
                    <>
                      <h2>Configuració del partit</h2>
                      <p>
                        Les regles s'apliquen només a aquest partit. El servidor
                        recalcularà el marcador abans de confirmar els canvis.
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["setsParaGanar", "Sets per guanyar", 1, 5],
                            ["puntosSet", "Punts per set", 1, 1000],
                            ["diferenciaSet", "Diferència normal", 0, 1000],
                            ["puntosExtraSet", "Punts extra set", 1, 1000],
                            ["diferenciaExtraSet", "Diferència extra", 0, 1000],
                          ] as const
                        ).map(([campo, titulo, minimo, maximo]) => (
                          <label
                            className="rounded-[10px] border border-[#315c70] bg-[#0c2738] p-3 [&_small]:block [&_small]:text-xs [&_small]:text-[#99b9c9] [&_input]:mt-[6px] [&_input]:block [&_input]:w-full [&_input]:rounded-[9px] [&_input]:border [&_input]:border-[#4d8794] [&_input]:bg-[#061b2a] [&_input]:px-3 [&_input]:py-2 [&_input]:text-xl [&_input]:font-extrabold [&_input]:text-white"
                            key={campo}
                          >
                            <small>{titulo}</small>
                            <input
                              type="number"
                              min={minimo}
                              max={maximo}
                              step={1}
                              value={configuracionFormulario[campo]}
                              disabled={
                                !puedeEscribir || guardandoConfiguracion
                              }
                              onChange={(e) =>
                                setConfiguracionFormulario((actual) => ({
                                  ...actual,
                                  [campo]: Number(e.target.value),
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <div className="mt-[18px] flex flex-wrap gap-[10px]">
                        <button
                          className="rounded-[10px] border border-[#20cdc0] bg-[#009d95] px-4 py-[11px] font-extrabold text-white"
                          type="button"
                          disabled={
                            !puedeEscribir ||
                            pendientes > 0 ||
                            sincronizando ||
                            guardandoConfiguracion
                          }
                          onClick={() => void guardarConfiguracion()}
                        >
                          {guardandoConfiguracion
                            ? "Desant..."
                            : "Guardar configuració"}
                        </button>
                        <button
                          type="button"
                          className="rounded-[10px] border border-[#517d8d] bg-[#183a4d] px-4 py-[11px] font-extrabold text-white"
                          onClick={() => setDialogo("RELOJ")}
                        >
                          Reiniciar cronòmetre
                        </button>
                      </div>
                    </>
                  )}
                  {dialogo === "RELOJ" && (
                    <>
                      <h2>Reiniciar cronòmetre</h2>
                      <p>
                        Vols posar el cronòmetre a 00:00? Les jugades
                        conservaran els temps originals.
                      </p>
                      <button
                        type="button"
                        className="rounded-[10px] border border-[#20cdc0] bg-[#009d95] px-4 py-[11px] font-extrabold text-white"
                        disabled={!puedeEscribir}
                        onClick={() => {
                          detenerReloj();
                          baseRelojRef.current = 0;
                          setRelojSegundos(0);
                          try {
                            window.localStorage.setItem(registroReloj, "0");
                          } catch {
                            /* opcional */
                          }
                          setDialogo(null);
                        }}
                      >
                        Posar a zero
                      </button>
                    </>
                  )}
                  {dialogo === "EDITAR" && (
                    <>
                      <h2>Modificar la darrera jugada</h2>
                      <p>
                        Només es pot substituir la darrera jugada d'un set
                        obert.
                      </p>
                      <label>
                        Tipus de punt
                        <select
                          value={edicionTipo}
                          onChange={(e) =>
                            setEdicionTipo(e.target.value as TipoPuntoVoleibol)
                          }
                        >
                          {TIPOS_PUNTO_VOLEIBOL.map((tipo) => (
                            <option key={tipo} value={tipo}>
                              {NOMBRES_TIPO[tipo]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Equip responsable
                        <select
                          value={edicionEquipoID}
                          onChange={(e) => {
                            setEdicionEquipoID(e.target.value);
                            setEdicionJugadorID("");
                          }}
                        >
                          <option value="">Selecciona equip</option>
                          {[local, visitante]
                            .filter((e): e is Equipo => e !== null)
                            .map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.nombre}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Jugador
                        <select
                          value={edicionJugadorID}
                          onChange={(e) => setEdicionJugadorID(e.target.value)}
                        >
                          <option value="">Selecciona jugador</option>
                          {[local, visitante]
                            .find((e) => e?.id === edicionEquipoID)
                            ?.jugadores.map((j) => (
                              <option key={j.id} value={j.id}>
                                {nombreJugador(j)}
                              </option>
                            ))}
                        </select>
                      </label>
                      <div className="mt-[18px] flex flex-wrap gap-[10px]">
                        <button
                          type="button"
                          className="rounded-[10px] border border-[#20cdc0] bg-[#009d95] px-4 py-[11px] font-extrabold text-white"
                          disabled={
                            !idEditar ||
                            !puedeEscribir ||
                            pendientes > 0 ||
                            idEditar !== ultimoEventoActivo?.clienteEventoID ||
                            estaProtegida(idEditar) ||
                            !edicionJugadorID
                          }
                          onClick={sustituirUltimaJugada}
                        >
                          Guardar correcció
                        </button>
                        <button
                          type="button"
                          className="rounded-[10px] border border-[#ed6574] bg-[#a63040] px-4 py-[11px] font-extrabold text-white"
                          disabled={!puedeEscribir || !idEditar}
                          onClick={() => setDialogo("ELIMINAR")}
                        >
                          Eliminar jugada
                        </button>
                      </div>
                    </>
                  )}
                  {dialogo === "ELIMINAR" && (
                    <>
                      <h2>Eliminar jugada</h2>
                      <p>
                        La jugada s'anul·larà i el marcador es recalcularà. El
                        registre d'auditoria es conserva.
                      </p>
                      <button
                        type="button"
                        className="rounded-[10px] border border-[#ed6574] bg-[#a63040] px-4 py-[11px] font-extrabold text-white"
                        disabled={!puedeEscribir || !idEditar}
                        onClick={() => {
                          if (idEditar) anularPunto(idEditar);
                        }}
                      >
                        Confirmar eliminació
                      </button>
                    </>
                  )}
                  {dialogo === "FIN_SET" && (
                    <>
                      <h2>
                        Desfer fi de set {fiSetSeleccionado?.numero ?? ""}
                      </h2>
                      <p>
                        El fi de set és una línia visual, no una jugada
                        guardada. Per desfer-la s'anul·larà el punt que va
                        tancar aquest set.
                      </p>
                      <p className="rounded-[10px] border border-[#ae8e4d] bg-[#3b310d] p-3 text-[#ffe9ab]">
                        Si hi ha jugades posteriors es recalcularan tots els
                        sets; el següent punt pot tornar a tancar el set.
                      </p>
                      <button
                        type="button"
                        className="rounded-[10px] border border-[#ed6574] bg-[#a63040] px-4 py-[11px] font-extrabold text-white"
                        disabled={!puedeEscribir || !fiSetSeleccionado}
                        onClick={confirmarDeshacerFinSet}
                      >
                        Confirmar i desfer fi de set
                      </button>
                    </>
                  )}

                  <div className="mt-[18px] flex flex-wrap gap-[10px] justify-end border-t border-[#426779] pt-[13px]">
                    <button
                      type="button"
                      className="rounded-[10px] border border-[#517d8d] bg-[#183a4d] px-4 py-[11px] font-extrabold text-white"
                      onClick={() => setDialogo(null)}
                    >
                      Tancar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
