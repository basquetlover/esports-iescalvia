import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const ESPERA_ENVIO_MS = 3000;
const INTERVALO_LECTURA_MS = 2500;
const NOMBRES_TIPO: Record<TipoPuntoVoleibol, string> = {
  DIRECTO: "Directe",
  BLOQUEO: "Bloqueig",
  REMATE: "Rematada",
  ERROR: "Error",
};
const ICONOS_TIPO: Record<TipoPuntoVoleibol, string> = {
  DIRECTO: "●",
  BLOQUEO: "▦",
  REMATE: "↗",
  ERROR: "×",
};
const BOTON =
  "touch-manipulation select-none rounded-xl border px-3 py-2.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45";
const PRIMARIO = `${BOTON} border-primary bg-primary text-white`;
const SECUNDARIO = `${BOTON} border-border bg-card text-neutral-titulos`;
const TARJETA = "rounded-2xl border border-border bg-card shadow-sm";

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
  const configuracion = useMemo(() => interpretarConfiguracion(acta), [acta]);
  const [eventos, setEventos] = useState<EventoLocalActa[]>([]);
  const [cargando, setCargando] = useState(true);
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
        }, ESPERA_ENVIO_MS);
      }
    }
  }, [partido.id, controlToken, editable, estadoServidor, refrescarLocal]);

  const programarEnvio = useCallback(() => {
    if (temporizadorRef.current !== null) return;
    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null;
      void sincronizar();
    }, ESPERA_ENVIO_MS);
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
    const intervalo = setInterval(() => {
      if (activo) void leerServidor(true);
    }, INTERVALO_LECTURA_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
      if (temporizadorRef.current !== null)
        clearTimeout(temporizadorRef.current);
      if (pulsacionRef.current !== null) clearTimeout(pulsacionRef.current);
    };
  }, [refrescarLocal, leerServidor, registroInformes, registroReloj]);

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

  function panelEquipo(equipo: Equipo | null, lado: "LOCAL" | "VISITANTE") {
    if (!equipo)
      return (
        <section className={`${TARJETA} p-5`}>
          Equip pendent de resoldre.
        </section>
      );
    const jugadores = [...equipo.jugadores].sort(
      (a, b) => (a.orden ?? 9999) - (b.orden ?? 9999),
    );
    return (
      <section className={`${TARJETA} flex min-w-0 flex-col overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-border bg-primary/5 p-3">
          {equipo.escudo ? (
            <img
              src={equipo.escudo}
              alt=""
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl text-primary">
              ◈
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {lado === "LOCAL" ? "Local" : "Visitant"}
            </p>
            <h3 className="break-words text-base font-extrabold text-neutral-titulos">
              {equipo.nombre}
            </h3>
          </div>
        </div>
        <div className="grid max-h-[610px] grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {jugadores.map((jugador) => {
            const seleccionado =
              jugadorSeleccionado?.jugador.id === jugador.id &&
              jugadorSeleccionado.equipoID === equipo.id;
            return (
              <button
                key={jugador.id}
                type="button"
                disabled={!puedeEscribir || !setActual}
                aria-pressed={seleccionado}
                onClick={() => seleccionarJugador(equipo.id, jugador)}
                className={`touch-manipulation flex min-h-24 min-w-0 select-none flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition active:scale-[0.97] disabled:opacity-45 ${
                  seleccionado
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-primary/5 text-neutral-titulos hover:border-primary"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-full text-xl ${
                    seleccionado ? "bg-white/20" : "bg-primary/10 text-primary"
                  }`}
                >
                  ●
                </span>
                <span className="line-clamp-2 break-words text-xs font-semibold leading-tight">
                  {nombreJugador(jugador)}
                </span>
              </button>
            );
          })}
          {jugadores.length === 0 && (
            <p className="col-span-full p-3 text-sm text-neutral">
              No hi ha jugadors actius.
            </p>
          )}
        </div>
      </section>
    );
  }

  if (cargando && !eventos.length) {
    return (
      <div className={`${TARJETA} p-8 text-center`}>Carregant acta...</div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1650px] space-y-4 pb-10">
      <header
        className={`${TARJETA} flex flex-wrap items-center justify-between gap-3 p-4`}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Acta digital · Voleibol
          </p>
          <h2 className="text-lg font-extrabold text-neutral-titulos">
            {partido.nombre ?? partido.codigo}
          </h2>
          <p className="text-xs text-neutral">
            {[
              estructura.fase?.nombre,
              estructura.grupo?.nombre,
              estructura.ronda?.nombre,
              partido.pista,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              sincronizando || pendientes
                ? "bg-amber-100 text-amber-900"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {sincronizando
              ? "Enviant..."
              : pendientes
                ? `${pendientes} operacions pendents`
                : "Sincronitzat"}
          </span>
          <button
            type="button"
            className={SECUNDARIO}
            onClick={() => void sincronizar()}
            disabled={!puedeEscribir || sincronizando || !pendientes}
          >
            Enviar pendents
          </button>
          <button
            type="button"
            className={SECUNDARIO}
            onClick={() => void leerServidor()}
          >
            Actualitzar
          </button>
        </div>
      </header>

      {!puedeEscribir && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Acta en mode consulta. No tens el control d'escriptura.
        </p>
      )}
      {errorServidor && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"
        >
          Servidor: {errorServidor}
        </p>
      )}
      {errorAccion && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          <span>{errorAccion}</span>
          <button
            type="button"
            onClick={() => setErrorAccion(null)}
            aria-label="Tancar avís"
          >
            ×
          </button>
        </div>
      )}
      {estadoCalculado.error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-900"
        >
          No es pot calcular el marcador: {estadoCalculado.error}
        </p>
      )}

      {pantalla === "ACTA" ? (
        <>
          <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)_minmax(0,1fr)]">
            <div className="order-2 min-w-0 lg:order-1">
              {panelEquipo(local, "LOCAL")}
            </div>
            <section
              className={`${TARJETA} order-1 min-w-0 overflow-hidden md:col-span-2 lg:order-2 lg:col-span-1`}
            >
              <div className="space-y-3 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-2 text-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-neutral">LOCAL</p>
                    <p className="text-5xl font-black tabular-nums text-neutral-titulos sm:text-6xl">
                      {setActual?.puntosLocal ?? 0}
                    </p>
                  </div>
                  <div className="flex flex-col items-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      SETS
                    </p>
                    <p className="text-2xl font-black tabular-nums text-primary">
                      {marcador?.setsGanadosLocal ?? 0} :{" "}
                      {marcador?.setsGanadosVisitante ?? 0}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-neutral">
                      {setActual
                        ? `${setActual.tipo === "EXTRA" ? "EXTRA SET" : "SET"} ${setActual.numero}`
                        : "Partit complet"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-neutral">VISITANT</p>
                    <p className="text-5xl font-black tabular-nums text-neutral-titulos sm:text-6xl">
                      {setActual?.puntosVisitante ?? 0}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-2 text-center text-xs text-neutral">
                  {marcador?.setsFinalizados
                    .map(
                      (s) =>
                        `S${s.numero}: ${s.puntosLocal}-${s.puntosVisitante}`,
                    )
                    .join(" · ") || "Encara no hi ha sets finalitzats"}
                </div>
                <button
                  type="button"
                  disabled={!puedeEscribir}
                  onClick={() =>
                    relojActivo ? detenerReloj() : setRelojActivo(true)
                  }
                  aria-label={
                    relojActivo ? "Aturar cronòmetre" : "Iniciar cronòmetre"
                  }
                  aria-pressed={relojActivo}
                  className={`mx-auto block touch-manipulation select-none rounded-xl px-5 py-1 text-5xl font-black tabular-nums transition disabled:opacity-45 ${
                    relojActivo ? "text-emerald-500" : "text-primary"
                  }`}
                >
                  {segundosTexto(relojSegundos)}
                </button>
                <p className="text-center text-xs text-neutral">
                  {relojActivo
                    ? "Toca el temps per aturar-lo"
                    : "Toca el temps per iniciar-lo"}
                </p>
              </div>
              <div className="space-y-3 p-3">
                <p className="text-center text-xs font-bold uppercase tracking-wide text-neutral">
                  Tipus de punt
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TIPOS_PUNTO_VOLEIBOL.map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      disabled={!puedeEscribir || !setActual}
                      aria-pressed={tipoSeleccionado === tipo}
                      onClick={() => seleccionarTipo(tipo)}
                      className={`touch-manipulation flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center transition active:scale-[0.97] disabled:opacity-45 ${
                        tipoSeleccionado === tipo
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-primary/5 text-neutral-titulos"
                      }`}
                    >
                      <span className="text-3xl font-bold" aria-hidden="true">
                        {ICONOS_TIPO[tipo]}
                      </span>
                      <span className="text-[11px] font-bold">
                        {NOMBRES_TIPO[tipo]}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="min-h-7 text-center text-xs text-neutral">
                  {tipoSeleccionado
                    ? `Ara selecciona un jugador: ${NOMBRES_TIPO[tipoSeleccionado]}.`
                    : jugadorSeleccionado
                      ? `Selecciona el tipus de punt de ${nombreJugador(jugadorSeleccionado.jugador)}.`
                      : "Selecciona tipus de punt i jugador, en qualsevol ordre."}
                  {tipoSeleccionado === "ERROR"
                    ? " El punt suma al contrari."
                    : ""}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className={SECUNDARIO}
                    onClick={() => {
                      setTipoSeleccionado(null);
                      setJugadorSeleccionado(null);
                    }}
                  >
                    Cancel·lar selecció
                  </button>
                  <button
                    type="button"
                    className={SECUNDARIO}
                    onClick={() => setDialogo("CONFIG")}
                  >
                    Configuració
                  </button>
                  <button
                    type="button"
                    className={SECUNDARIO}
                    onClick={() => setDialogo("INFORMES")}
                  >
                    Informes ({informes.length})
                  </button>
                </div>
              </div>

              <div className="border-t border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-neutral-titulos">
                      Historial de jugades
                    </h3>
                    <p className="text-[11px] text-neutral">
                      Mantén premuda una jugada per gestionar-la.
                    </p>
                  </div>
                  <span className="text-xs text-neutral">
                    {historial.length} punts
                  </span>
                </div>
                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto overscroll-contain">
                  {[...historial].reverse().map((punto) => {
                    const evento = eventos.find(
                      (e) =>
                        e.clienteEventoID === punto.clienteEventoID &&
                        e.estado === "ACTIVO",
                    );
                    if (!evento) return null;
                    const setCerrado = marcador?.setsFinalizados.find(
                      (s) => s.numero === punto.numeroSet,
                    );
                    const protegido = Boolean(setCerrado);
                    const ultimo =
                      ultimoEventoActivo?.clienteEventoID ===
                      punto.clienteEventoID;
                    return (
                      <div key={punto.clienteEventoID} className="space-y-1">
                        {punto.cierraSet && setCerrado && (
                          <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3">
                            <span className="text-xl" aria-hidden="true">
                              ⚑
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black uppercase tracking-wide text-primary">
                                Fi de set {setCerrado.numero}
                              </p>
                              <p className="text-xs text-neutral-titulos">
                                {setCerrado.puntosLocal} -{" "}
                                {setCerrado.puntosVisitante}
                              </p>
                            </div>
                            <button
                              type="button"
                              disabled={!puedeEscribir}
                              className="touch-manipulation rounded-lg border border-red-300 bg-red-50 px-2 py-2 text-xs font-bold text-red-800 disabled:opacity-45"
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
                          className={`flex min-h-14 select-none items-center gap-2 rounded-lg border border-border bg-primary/5 p-2 ${
                            protegido ? "opacity-65" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-neutral-titulos">
                              {evento.jugadorNombre ?? "Jugador"} ·{" "}
                              {NOMBRES_TIPO[
                                evento.tipoEvento as TipoPuntoVoleibol
                              ] ?? evento.tipoEvento}
                            </p>
                            <p className="text-[11px] text-neutral">
                              {evento.equipoNombre} · Set {punto.numeroSet} ·{" "}
                              {segundosTexto(evento.tiempoJuegoSegundos ?? 0)}
                            </p>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-primary">
                            {punto.puntosLocal}-{punto.puntosVisitante}
                          </span>
                          {protegido ? (
                            <span className="rounded-lg border border-border p-2 text-[11px] text-neutral">
                              🔒
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={!puedeEscribir}
                              className={`touch-manipulation rounded-lg border px-2 py-2 text-xs font-bold disabled:opacity-45 ${
                                ultimo
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-red-200 bg-red-50 text-red-800"
                              }`}
                              onClick={() =>
                                ultimo
                                  ? solicitarModificar(evento)
                                  : solicitarEliminar(evento)
                              }
                            >
                              {ultimo ? "Modificar" : "Eliminar"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {!historial.length && (
                    <p className="p-4 text-center text-xs text-neutral">
                      Encara no hi ha jugades.
                    </p>
                  )}
                </div>
              </div>
            </section>
            <div className="order-3 min-w-0">
              {panelEquipo(visitante, "VISITANTE")}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral">
              Punts totals: {marcador?.puntosTotalesLocal ?? 0} -{" "}
              {marcador?.puntosTotalesVisitante ?? 0}
            </p>
            <button
              type="button"
              className={PRIMARIO}
              disabled={!marcador || !puedeEscribir}
              onClick={() => {
                setPantalla("RESUMEN");
                setModoCierre("NORMAL");
                setConfirmadoForzado(false);
              }}
            >
              Revisar i finalitzar acta
            </button>
          </div>
        </>
      ) : (
        <section
          className={`${TARJETA} mx-auto max-w-3xl space-y-5 p-5 sm:p-8`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Pantalla 2 de 2
            </p>
            <h2 className="text-2xl font-black text-neutral-titulos">
              Resum i confirmació de l'acta
            </h2>
            <p className="mt-1 text-sm text-neutral">
              Revisa el marcador abans de confirmar el resultat definitiu.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            {[local, visitante].map((e, i) => (
              <div key={e?.id ?? i} className="rounded-xl bg-primary/5 p-4">
                <p className="truncate text-sm font-bold text-neutral-titulos">
                  {e?.nombre ?? "Equip"}
                </p>
                <p className="text-5xl font-black tabular-nums text-primary">
                  {i === 0
                    ? marcador?.setsGanadosLocal
                    : marcador?.setsGanadosVisitante}
                </p>
                <p className="text-xs text-neutral">Sets guanyats</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-primary/5">
                <tr>
                  <th className="p-3 text-left">Set</th>
                  <th className="p-3 text-right">Local</th>
                  <th className="p-3 text-right">Visitant</th>
                </tr>
              </thead>
              <tbody>
                {marcador?.setsFinalizados.map((s) => (
                  <tr key={s.numero} className="border-t border-border">
                    <td className="p-3">
                      {s.tipo === "EXTRA" ? "Extra set" : `Set ${s.numero}`}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {s.puntosLocal}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {s.puntosVisitante}
                    </td>
                  </tr>
                ))}
                {marcador?.setActual &&
                  marcador.setActual.puntosLocal +
                    marcador.setActual.puntosVisitante >
                    0 && (
                    <tr className="border-t border-border text-neutral">
                      <td className="p-3">
                        Set {marcador.setActual.numero} (en curs)
                      </td>
                      <td className="p-3 text-right">
                        {marcador.setActual.puntosLocal}
                      </td>
                      <td className="p-3 text-right">
                        {marcador.setActual.puntosVisitante}
                      </td>
                    </tr>
                  )}
                <tr className="border-t-2 border-primary font-bold text-neutral-titulos">
                  <td className="p-3">Total punts</td>
                  <td className="p-3 text-right">
                    {marcador?.puntosTotalesLocal}
                  </td>
                  <td className="p-3 text-right">
                    {marcador?.puntosTotalesVisitante}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`${BOTON} ${
                modoCierre === "NORMAL"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
              onClick={() => {
                setModoCierre("NORMAL");
                setConfirmadoForzado(false);
              }}
            >
              Tancament normal (sets)
            </button>
            <button
              type="button"
              className={`${BOTON} ${
                modoCierre === "FORZADO_PUNTOS"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card"
              }`}
              onClick={() => {
                setModoCierre("FORZADO_PUNTOS");
                setConfirmadoForzado(false);
              }}
            >
              Forçar tancament (punts totals)
            </button>
          </div>
          <p
            className={`rounded-xl border p-4 text-sm ${
              evaluacion?.permitido
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            {evaluacion?.mensaje ?? "No hi ha un marcador vàlid."}
          </p>
          {evaluacion?.ganadorEquipoID && (
            <p className="text-sm font-semibold text-neutral-titulos">
              Guanyador:{" "}
              {evaluacion.ganadorEquipoID === local?.id
                ? local?.nombre
                : visitante?.nombre}
            </p>
          )}
          {modoCierre === "FORZADO_PUNTOS" && (
            <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-primary"
                checked={confirmadoForzado}
                onChange={(e) => setConfirmadoForzado(e.target.checked)}
              />
              Confirm que vull tancar excepcionalment amb sets empatats i
              adjudicar el guanyador pels punts totals.
            </label>
          )}
          {pendientes > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Queden {pendientes} operacions per enviar.
            </p>
          )}
          {informePendiente && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Hi ha informes només al dispositiu; la sincronització d'informes
              encara no està disponible.
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              className={SECUNDARIO}
              onClick={() => setPantalla("ACTA")}
            >
              Tornar a l'acta
            </button>
            <button
              type="button"
              className={PRIMARIO}
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
      )}

      {avisoSet && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
        >
          <div
            className={`${TARJETA} w-full max-w-sm space-y-4 p-6 text-center`}
          >
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              Final de set
            </p>
            <h3 className="text-2xl font-black text-neutral-titulos">
              {avisoSet}
            </h3>
            <p className="text-sm text-neutral">
              {marcador?.finalizadoPorSets
                ? "El partit ja es pot finalitzar."
                : marcador?.requiereExtraSet
                  ? "Els sets estan empatats. Comença l'extra set."
                  : "Prepara el set següent."}
            </p>
            <button
              type="button"
              className={PRIMARIO}
              onClick={() => {
                setAvisoSet(null);
                if (marcador?.finalizadoPorSets) setPantalla("RESUMEN");
              }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {dialogo && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-5"
        >
          <div
            className={`${TARJETA} my-auto w-full max-w-lg space-y-4 p-4 sm:p-6`}
          >
            {dialogo === "CONFIG" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Configuració del partit
                </h3>
                <p className="text-sm text-neutral">
                  Regles fixades en iniciar l'acta. La modificació en servidor
                  encara no està implementada.
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {(
                    [
                      ["Sets per guanyar", configuracion.setsParaGanar],
                      ["Punts per set", configuracion.puntosSet],
                      ["Diferència normal", configuracion.diferenciaSet],
                      ["Punts extra set", configuracion.puntosExtraSet],
                      ["Diferència extra", configuracion.diferenciaExtraSet],
                    ] as const
                  ).map(([nom, valor]) => (
                    <div key={nom} className="rounded-xl bg-primary/5 p-3">
                      <dt className="text-neutral">{nom}</dt>
                      <dd className="text-lg font-bold text-neutral-titulos">
                        {valor}
                      </dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  className={SECUNDARIO}
                  onClick={() => setDialogo("RELOJ")}
                >
                  Reiniciar cronòmetre
                </button>
              </>
            )}
            {dialogo === "RELOJ" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Reiniciar cronòmetre
                </h3>
                <p className="text-sm text-neutral">
                  Posar el temps a 00:00 no canviarà el temps registrat a les
                  jugades.
                </p>
                <button
                  type="button"
                  className={PRIMARIO}
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
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Modificar la darrera jugada
                </h3>
                <p className="text-sm text-neutral">
                  Només es pot substituir la darrera jugada d'un set obert. Les
                  anteriors només es poden eliminar.
                </p>
                <label className="block text-sm font-semibold text-neutral-titulos">
                  Tipus de punt
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-card p-3"
                    value={edicionTipo}
                    onChange={(e) =>
                      setEdicionTipo(e.target.value as TipoPuntoVoleibol)
                    }
                  >
                    {TIPOS_PUNTO_VOLEIBOL.map((t) => (
                      <option key={t} value={t}>
                        {NOMBRES_TIPO[t]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-neutral-titulos">
                  Equip responsable
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-card p-3"
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
                <label className="block text-sm font-semibold text-neutral-titulos">
                  Jugador
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-card p-3"
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={PRIMARIO}
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
                    className={`${BOTON} border-red-200 bg-red-50 text-red-800`}
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
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Eliminar jugada
                </h3>
                <p className="text-sm text-neutral">
                  La jugada es marcarà com a anul·lada i el marcador es
                  recalcularà. Aquesta acció no esborra l'auditoria.
                </p>
                <button
                  type="button"
                  className={`${BOTON} border-red-300 bg-red-50 text-red-800`}
                  disabled={!idEditar || !puedeEscribir}
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
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Desfer fi de set {fiSetSeleccionado?.numero ?? ""}
                </h3>
                <p className="text-sm text-neutral">
                  El fi de set és una línia visual, no un esdeveniment de la
                  base de dades. Si confirmes, s'anul·larà la jugada real que va
                  tancar aquest set.
                </p>
                <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  Si hi ha jugades posteriors, es recalcularan tots els sets i
                  la línia de final de set pot canviar de lloc.
                </p>
                <button
                  type="button"
                  className={`${BOTON} border-red-300 bg-red-50 text-red-800`}
                  disabled={!puedeEscribir || !fiSetSeleccionado}
                  onClick={confirmarDeshacerFinSet}
                >
                  Confirmar i desfer fi de set
                </button>
              </>
            )}
            {dialogo === "INFORMES" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Informes del partit
                </h3>
                <p className="text-xs text-amber-800">
                  Els informes es conserven al dispositiu i es poden exportar.
                  Encara no existeix l'API de sincronització d'informes.
                </p>
                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {informes.map((inf) => (
                    <div
                      key={inf.id}
                      className="rounded-lg bg-primary/5 p-3 text-xs"
                    >
                      <p className="font-bold text-neutral-titulos">
                        {inf.tipo === "GENERIC"
                          ? "Informe general"
                          : "Suspensió"}{" "}
                        · Pendent d'enviar
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-neutral">
                        {inf.contenido}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`${BOTON} ${
                      tipoInforme === "GENERIC"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }`}
                    onClick={() => setTipoInforme("GENERIC")}
                  >
                    Informe general
                  </button>
                  <button
                    type="button"
                    className={`${BOTON} ${
                      tipoInforme === "SUSPENSION"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border"
                    }`}
                    onClick={() => setTipoInforme("SUSPENSION")}
                  >
                    Suspendre partit
                  </button>
                </div>
                {tipoInforme === "SUSPENSION" && (
                  <select
                    className="w-full rounded-lg border border-border bg-card p-3 text-sm"
                    value={equipoInforme}
                    onChange={(e) => setEquipoInforme(e.target.value)}
                  >
                    <option value="">Equip responsable</option>
                    {[local, visitante]
                      .filter((e): e is Equipo => e !== null)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.nombre}
                        </option>
                      ))}
                  </select>
                )}
                <textarea
                  rows={4}
                  maxLength={3000}
                  className="w-full rounded-lg border border-border bg-card p-3 text-sm"
                  placeholder="Descriu els fets..."
                  value={textoInforme}
                  onChange={(e) => setTextoInforme(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={PRIMARIO}
                    onClick={guardarInforme}
                    disabled={
                      !puedeEscribir ||
                      !textoInforme.trim() ||
                      (tipoInforme === "SUSPENSION" && !equipoInforme)
                    }
                  >
                    Desar informe local
                  </button>
                  <button
                    type="button"
                    className={SECUNDARIO}
                    disabled={!informes.length}
                    onClick={exportarInformes}
                  >
                    Exportar informes
                  </button>
                </div>
              </>
            )}
            <div className="flex justify-end border-t border-border pt-3">
              <button
                type="button"
                className={SECUNDARIO}
                onClick={() => setDialogo(null)}
              >
                Tancar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
