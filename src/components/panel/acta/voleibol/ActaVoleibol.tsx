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
  type TipoPuntoVoleibol,
  type ModoCierreVoleibol,
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
  equipos: {
    local: Lado;
    visitante: Lado;
  };
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
  acta: {
    estado: string;
    version: number;
  };
  control: {
    puedeEscribir: boolean;
    controlToken: string | null;
  };
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

type Seleccion = {
  equipoID: string;
  jugador: Jugador;
};

type Dialogo = "CONFIG" | "INFORMES" | "EDITAR" | "RELOJ" | null;

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

const BOTON_PRIMARIO = `${BOTON} border-primary bg-primary text-white`;

const BOTON_SECUNDARIO = `${BOTON} border-border bg-card text-neutral-titulos`;

const RECUADRO = "rounded-2xl border border-border bg-card shadow-sm";

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

function segundosTexto(total: number): string {
  const min = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");

  const seg = (total % 60).toString().padStart(2, "0");

  return `${min}:${seg}`;
}

function interpretarConfiguracion(acta: Props["acta"]): ConfiguracionVoleibol {
  const snapshot = acta?.configuracion_snapshot;
  const volei = snapshot?.voleibol;

  if (!volei || typeof volei !== "object" || Array.isArray(volei)) {
    return normalizarConfiguracionVoleibol();
  }

  const objeto = volei as Record<string, unknown>;
  const entrada: Partial<ConfiguracionVoleibol> = {};

  for (const campo of [
    "setsParaGanar",
    "puntosSet",
    "diferenciaSet",
    "puntosExtraSet",
    "diferenciaExtraSet",
  ] as const) {
    const valor = objeto[campo];

    if (typeof valor === "number") {
      entrada[campo] = valor;
    }
  }

  return normalizarConfiguracionVoleibol(entrada);
}

function eventoServidorALocal(evento: EventoServidor): EventoLocalActa {
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
  eventos: EventoServidor[],
): EventoLocalActa[] {
  const estado = leerActaLocal(partidoID);

  const mapa = new Map(
    estado.eventos.map((evento) => [evento.clienteEventoID, evento]),
  );

  const ordenados: EventoLocalActa[] = [];

  for (const remoto of [...eventos].sort((a, b) => a.orden - b.orden)) {
    const actual = mapa.get(remoto.cliente_evento_id);

    mapa.delete(remoto.cliente_evento_id);

    const convertido = eventoServidorALocal(remoto);

    if (actual?.estado === "ANULADO" && remoto.estado === "ACTIVO") {
      ordenados.push({
        ...convertido,
        estado: "ANULADO",
        anuladoAt: actual.anuladoAt,
        motivoAnulacion: actual.motivoAnulacion,
        sincronizacionAnulacion: actual.sincronizacionAnulacion,
      });
    } else {
      ordenados.push(convertido);
    }
  }

  estado.eventos = [...ordenados, ...mapa.values()];

  guardarActaLocal(estado);

  return estado.eventos;
}

function contarPendientes(eventos: EventoLocalActa[]): number {
  return eventos.reduce(
    (n, e) =>
      n +
      (e.sincronizacionCreacion.estado !== "SINCRONIZADO" ? 1 : 0) +
      (e.sincronizacionAnulacion &&
      e.sincronizacionAnulacion.estado !== "SINCRONIZADO"
        ? 1
        : 0),
    0,
  );
}

async function respuestaJSON(
  respuesta: Response,
): Promise<Record<string, unknown>> {
  const contenido: unknown = await respuesta.json().catch(() => null);

  if (
    !respuesta.ok ||
    !contenido ||
    typeof contenido !== "object" ||
    Array.isArray(contenido) ||
    (contenido as Record<string, unknown>).success !== true
  ) {
    const posible =
      contenido && typeof contenido === "object" && "mensaje" in contenido
        ? String(contenido.mensaje)
        : "No s'ha pogut contactar amb el servidor.";

    throw new Error(posible);
  }

  return contenido as Record<string, unknown>;
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

  const enviandoRef = useRef(false);
  const bloqueandoPulsacionRef = useRef(0);

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
    const guardado = leerActaLocal(partido.id);

    setEventos([...guardado.eventos]);

    return guardado.eventos;
  }, [partido.id]);

  const leerServidor = useCallback(
    async (silencioso = false): Promise<boolean> => {
      try {
        const respuesta = await fetch(
          `/api/panell/acta/eventos?partidoID=${encodeURIComponent(partido.id)}`,
          {
            credentials: "same-origin",
            cache: "no-store",
          },
        );

        const contenido = (await respuestaJSON(
          respuesta,
        )) as unknown as LecturaServidor;

        setPermisoServidor(contenido.control.puedeEscribir);

        setControlToken(contenido.control.controlToken);

        setEstadoServidor(contenido.acta.estado);

        const actualizados = fusionarServidor(partido.id, contenido.eventos);

        setEventos([...actualizados]);
        setErrorServidor(null);

        return true;
      } catch (error) {
        if (!silencioso) {
          setErrorServidor(mensajeError(error));
        }

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
    ) {
      return;
    }

    const creaciones = obtenerEventosPendientesCreacion(partido.id);

    const anulaciones = obtenerEventosPendientesAnulacion(partido.id);

    if (!creaciones.length && !anulaciones.length) {
      return;
    }

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

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          partidoID: partido.id,
          controlToken,
          operaciones,
        }),
      });

      const contenido = (await respuestaJSON(
        respuesta,
      )) as unknown as RespuestaEnvio;

      const errores: string[] = [];

      for (const resultado of contenido.resultados) {
        if (!resultado.clienteEventoID) {
          continue;
        }

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

        if (!resultado.success) {
          errores.push(resultado.mensaje ?? "No s'ha pogut enviar una jugada.");
        }
      }

      setEventos([...fusionarServidor(partido.id, contenido.eventos)]);

      if (errores.length) {
        setErrorAccion(errores.join(" "));
      }
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
        `Jugades desades al dispositiu, però pendents d'enviar: ${mensajeError(error)}`,
      );

      refrescarLocal();
    } finally {
      enviandoRef.current = false;
      setSincronizando(false);

      const nuevos = leerActaLocal(partido.id).eventos.some(
        (e) =>
          e.sincronizacionCreacion.estado === "PENDIENTE" ||
          e.sincronizacionAnulacion?.estado === "PENDIENTE",
      );

      if (nuevos && temporizadorRef.current === null) {
        temporizadorRef.current = setTimeout(() => {
          temporizadorRef.current = null;
          void sincronizar();
        }, ESPERA_ENVIO_MS);
      }
    }
  }, [partido.id, controlToken, editable, estadoServidor, refrescarLocal]);

  const programarEnvio = useCallback(() => {
    if (temporizadorRef.current !== null) {
      return;
    }

    temporizadorRef.current = setTimeout(() => {
      temporizadorRef.current = null;

      void sincronizar();
    }, ESPERA_ENVIO_MS);
  }, [sincronizar]);

  useEffect(() => {
    try {
      refrescarLocal();

      const guardados = window.localStorage.getItem(registroInformes);

      if (guardados) {
        const datos: unknown = JSON.parse(guardados);

        if (Array.isArray(datos)) {
          setInformes(datos as Informe[]);
        }
      }

      const reloj = window.localStorage.getItem(registroReloj);

      const valor = reloj ? Number(reloj) : 0;

      if (Number.isSafeInteger(valor) && valor >= 0 && valor <= 86400) {
        baseRelojRef.current = valor;
        setRelojSegundos(valor);
      }
    } catch (error) {
      setErrorAccion(
        `No s'ha pogut recuperar la còpia del dispositiu: ${mensajeError(error)}`,
      );
    }

    let activo = true;

    void leerServidor().finally(() => {
      if (activo) {
        setCargando(false);
      }
    });

    const intervalo = setInterval(() => {
      if (activo) {
        void leerServidor(true);
      }
    }, INTERVALO_LECTURA_MS);

    return () => {
      activo = false;

      clearInterval(intervalo);

      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current);
      }
    };
  }, [refrescarLocal, leerServidor, registroInformes, registroReloj]);

  useEffect(() => {
    if (!relojActivo) {
      return;
    }

    inicioRelojRef.current = Date.now();

    const intervalo = setInterval(() => {
      const desde = inicioRelojRef.current ?? Date.now();

      const actual =
        baseRelojRef.current + Math.floor((Date.now() - desde) / 1000);

      setRelojSegundos(actual);

      try {
        window.localStorage.setItem(registroReloj, String(actual));
      } catch {
        // El reloj no debe bloquear el acta.
      }
    }, 250);

    return () => clearInterval(intervalo);
  }, [relojActivo, registroReloj]);

  const detenerReloj = useCallback(() => {
    const desde = inicioRelojRef.current;

    if (desde !== null) {
      baseRelojRef.current += Math.floor((Date.now() - desde) / 1000);

      setRelojSegundos(baseRelojRef.current);

      try {
        window.localStorage.setItem(
          registroReloj,
          String(baseRelojRef.current),
        );
      } catch {
        // No afecta las jugadas.
      }
    }

    inicioRelojRef.current = null;
    setRelojActivo(false);
  }, [registroReloj]);

  const estadoCalculado = useMemo(() => {
    if (!local || !visitante) {
      return {
        estado: null,
        error: "Els dos equips encara no estan resolts.",
      };
    }

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
      return {
        estado: null,
        error: mensajeError(error),
      };
    }
  }, [eventos, local, visitante, configuracion]);

  const marcador = estadoCalculado.estado;
  const setActual = marcador?.setActual;

  const ultimoEventoActivo = [...eventos]
    .reverse()
    .find((e) => e.estado === "ACTIVO");

  const anotarPunto = useCallback(
    (tipo: TipoPuntoVoleibol, equipoID: string, jugador: Jugador) => {
      if (!puedeEscribir || !marcador?.setActual) {
        return;
      }

      if (Date.now() - bloqueandoPulsacionRef.current < 300) {
        return;
      }

      bloqueandoPulsacionRef.current = Date.now();

      try {
        registrarEventoLocal(partido.id, {
          tipoEvento: tipo,

          equipoID,

          equipoNombre:
            equipoID === local?.id ? local.nombre : (visitante?.nombre ?? null),

          jugadorID: jugador.id,
          jugadorNombre: nombreJugador(jugador),

          periodo: marcador.setActual.numero,
          tiempoJuegoSegundos: relojSegundos,

          datos: {},
        });

        const anterior = marcador.setsFinalizados.length;

        const nuevos = refrescarLocal();

        const calculado = calcularEstadoVoleibol(
          nuevos,
          local!.id,
          visitante!.id,
          configuracion,
        );

        if (calculado.setsFinalizados.length > anterior) {
          const ultimo = calculado.setsFinalizados.at(-1)!;

          setAvisoSet(
            `Set ${ultimo.numero} finalitzat: ${ultimo.puntosLocal} – ${ultimo.puntosVisitante}`,
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
      marcador,
      partido.id,
      local,
      visitante,
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
    setJugadorSeleccionado({
      equipoID,
      jugador,
    });

    if (tipoSeleccionado) {
      anotarPunto(tipoSeleccionado, equipoID, jugador);
    }
  }

  function anularPunto(eventoID: string) {
    if (!puedeEscribir) {
      return;
    }

    const jugada = marcador?.historial.find(
      (p) => p.clienteEventoID === eventoID,
    );

    const ultimoSet = marcador?.historial.at(-1)?.numeroSet;

    if (!jugada || jugada.numeroSet !== ultimoSet) {
      setErrorAccion(
        "No es poden corregir jugades d'un set anterior quan ja s'han registrat punts del següent set.",
      );
      return;
    }

    try {
      anularEventoLocal(partido.id, eventoID, "Correcció de l'acta digital");

      refrescarLocal();
      setDialogo(null);

      programarEnvio();
    } catch (error) {
      setErrorAccion(mensajeError(error));
    }
  }

  function abrirEdicion(evento: EventoLocalActa) {
    setIdEditar(evento.clienteEventoID);

    setEdicionTipo(evento.tipoEvento as TipoPuntoVoleibol);

    setEdicionEquipoID(evento.equipoID ?? "");

    setEdicionJugadorID(evento.jugadorID ?? "");

    setDialogo("EDITAR");
  }

  function corregirUltimoPunto() {
    if (!idEditar || !puedeEscribir || !local || !visitante) {
      return;
    }

    const original = eventos.find((e) => e.clienteEventoID === idEditar);

    if (!original || ultimoEventoActivo?.clienteEventoID !== idEditar) {
      return;
    }

    if (
      original.sincronizacionCreacion.estado !== "SINCRONIZADO" ||
      pendientes > 0
    ) {
      setErrorAccion(
        "Abans de modificar una jugada, envia les operacions pendents. Pots anul·lar-la directament.",
      );

      return;
    }

    const equipo = [local, visitante].find((e) => e.id === edicionEquipoID);

    const jugador = equipo?.jugadores.find((j) => j.id === edicionJugadorID);

    if (!equipo || !jugador) {
      return;
    }

    try {
      anularEventoLocal(partido.id, idEditar, "Substituïda per correcció");

      const restantes = leerActaLocal(partido.id).eventos;

      const recalculado = calcularEstadoVoleibol(
        restantes,
        local.id,
        visitante.id,
        configuracion,
      );

      if (!recalculado.setActual) {
        throw new Error(
          "No es pot afegir una jugada després del final del partit.",
        );
      }

      registrarEventoLocal(partido.id, {
        tipoEvento: edicionTipo,

        equipoID: equipo.id,
        equipoNombre: equipo.nombre,

        jugadorID: jugador.id,
        jugadorNombre: nombreJugador(jugador),

        periodo: recalculado.setActual.numero,

        tiempoJuegoSegundos: original.tiempoJuegoSegundos,
      });

      refrescarLocal();

      setDialogo(null);
      programarEnvio();
    } catch (error) {
      refrescarLocal();
      setErrorAccion(mensajeError(error));
    }
  }

  function guardarInformeLocal() {
    if (!puedeEscribir) {
      return;
    }

    if (!textoInforme.trim()) {
      return;
    }

    if (tipoInforme === "SUSPENSION" && !equipoInforme) {
      return;
    }

    const informe: Informe = {
      id: crypto.randomUUID(),
      tipo: tipoInforme,

      contenido: textoInforme.trim(),

      equipoResponsableID: tipoInforme === "SUSPENSION" ? equipoInforme : null,

      creadoAt: new Date().toISOString(),
      sincronizado: false,
    };

    const nuevos = [...informes, informe];

    try {
      window.localStorage.setItem(registroInformes, JSON.stringify(nuevos));

      setInformes(nuevos);
      setTextoInforme("");

      if (tipoInforme === "SUSPENSION") {
        detenerReloj();
      }
    } catch (error) {
      setErrorAccion(`No s'ha pogut desar l'informe: ${mensajeError(error)}`);
    }
  }

  function exportarInformes() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            partidoID: partido.id,
            informes,
          },
          null,
          2,
        ),
      ],
      {
        type: "application/json",
      },
    );

    const enlace = document.createElement("a");

    const url = URL.createObjectURL(blob);

    enlace.href = url;

    enlace.download = `informes-volei-${partido.codigo}.json`;

    enlace.click();

    URL.revokeObjectURL(url);
  }

  const evaluacion = marcador
    ? evaluarCierreVoleibol(marcador, modoCierre)
    : null;

  const informesPendientes = informes.some((informe) => !informe.sincronizado);

  async function finalizarPartido() {
    if (
      !puedeEscribir ||
      !controlToken ||
      !evaluacion?.permitido ||
      !marcador
    ) {
      return;
    }

    if (modoCierre === "FORZADO_PUNTOS" && !confirmadoForzado) {
      return;
    }

    if (
      enviandoRef.current ||
      pendientes !== 0 ||
      !puedeIntentarFinalizacion(partido.id)
    ) {
      setErrorAccion(
        "Hi ha jugades pendents. Envia-les abans de tancar el partit.",
      );

      return;
    }

    if (informesPendientes) {
      setErrorAccion(
        "Hi ha informes desats només al dispositiu. No es pot tancar fins que estiguin sincronitzats.",
      );

      return;
    }

    setFinalizando(true);
    setErrorAccion(null);

    try {
      const revisado = await leerServidor();

      if (!revisado || !puedeIntentarFinalizacion(partido.id)) {
        throw new Error(
          "No s'ha pogut verificar que totes les jugades estiguin desades al servidor.",
        );
      }

      const respuesta = await fetch("/api/panell/acta/finalizar", {
        method: "POST",
        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          partidoID: partido.id,
          controlToken,
          modoCierre,

          confirmarCierreForzado:
            modoCierre === "FORZADO_PUNTOS" && confirmadoForzado,
        }),
      });

      const contenido = await respuestaJSON(respuesta);

      const confirmado = contenido as unknown as ConfirmacionFinalizacionActa;

      if (!eliminarActaLocalTrasFinalizacion(partido.id, confirmado)) {
        console.warn(
          "El servidor ha finalitzat el partit, però s'ha mantingut la còpia local per seguretat.",
        );
      }

      if (temporizadorRef.current !== null) {
        clearTimeout(temporizadorRef.current);
      }

      window.location.href = `/panell/partits${window.location.search}`;
    } catch (error) {
      setErrorAccion(mensajeError(error));
    } finally {
      setFinalizando(false);
    }
  }

  function panelEquipo(equipo: Equipo | null, lado: "LOCAL" | "VISITANTE") {
    if (!equipo) {
      return (
        <section className={`${RECUADRO} p-4`}>
          Equip pendent de resoldre.
        </section>
      );
    }

    const esLocal = lado === "LOCAL";

    const jugadores = [...equipo.jugadores].sort(
      (a, b) => (a.orden ?? 9999) - (b.orden ?? 9999),
    );

    return (
      <section
        className={`${RECUADRO} flex min-w-0 flex-col overflow-hidden`}
        aria-label={`Jugadors ${equipo.nombre}`}
      >
        <div className="flex min-h-20 items-center gap-3 border-b border-border bg-primary/5 p-3">
          {equipo.escudo ? (
            <img
              src={equipo.escudo}
              alt=""
              className="h-14 w-14 shrink-0 object-contain"
            />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-2xl text-primary">
              ◈
            </span>
          )}

          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {esLocal ? "LOCAL" : "VISITANT"}
            </p>

            <h3 className="break-words text-base font-extrabold text-neutral-titulos">
              {equipo.nombre}
            </h3>
          </div>
        </div>

        <div
          className="grid max-h-[580px] grid-cols-2 gap-2 overflow-y-auto overscroll-contain p-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3"
          style={{
            WebkitOverflowScrolling: "touch",
          }}
        >
          {jugadores.map((jugador) => {
            const seleccionado =
              jugadorSeleccionado?.jugador.id === jugador.id &&
              jugadorSeleccionado.equipoID === equipo.id;

            return (
              <button
                key={jugador.id}
                type="button"
                disabled={!puedeEscribir || !marcador?.setActual}
                onClick={() => seleccionarJugador(equipo.id, jugador)}
                aria-pressed={seleccionado}
                className={`touch-manipulation flex min-h-24 min-w-0 select-none flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition active:scale-[0.97] disabled:opacity-50 ${
                  seleccionado
                    ? "border-primary bg-primary text-white ring-2 ring-primary/30"
                    : "border-border bg-primary/5 text-neutral-titulos hover:border-primary"
                }`}
              >
                <span
                  aria-hidden="true"
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
        </div>

        {jugadores.length === 0 && (
          <p className="p-4 text-sm text-neutral">
            Aquest equip no té jugadors actius.
          </p>
        )}
      </section>
    );
  }

  if (cargando && eventos.length === 0) {
    return (
      <div className={`${RECUADRO} p-8 text-center`}>Carregant acta...</div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1650px] space-y-4 pb-10">
      <header
        className={`${RECUADRO} flex flex-wrap items-center justify-between gap-3 p-4`}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            ACTA DIGITAL · VOLEIBOL
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
            className={BOTON_SECUNDARIO}
            onClick={() => void sincronizar()}
            disabled={!puedeEscribir || sincronizando || !pendientes}
          >
            Enviar pendents
          </button>

          <button
            type="button"
            className={BOTON_SECUNDARIO}
            onClick={() => void leerServidor()}
          >
            Actualitzar
          </button>
        </div>
      </header>

      {!puedeEscribir && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Acta en mode consulta.{" "}
          {errorServidor
            ? "No s'ha pogut comprovar el control amb el servidor."
            : "No tens el control d'escriptura de l'acta."}
        </div>
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
              className={`${RECUADRO} order-1 min-w-0 overflow-hidden md:col-span-2 lg:order-2 lg:col-span-1`}
            >
              <div className="space-y-4 bg-primary/5 p-4">
                <div className="flex items-center justify-center gap-3 text-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-neutral">
                      LOCAL
                    </p>

                    <p className="text-5xl font-black tabular-nums text-neutral-titulos sm:text-6xl">
                      {setActual?.puntosLocal ?? 0}
                    </p>
                  </div>

                  <div className="flex flex-col items-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary">
                      SETS
                    </p>

                    <p className="whitespace-nowrap text-2xl font-black tabular-nums text-primary">
                      {marcador?.setsGanadosLocal ?? 0}
                      {" : "}
                      {marcador?.setsGanadosVisitante ?? 0}
                    </p>

                    <p className="mt-1 text-xs font-semibold text-neutral">
                      {setActual
                        ? `${
                            setActual.tipo === "EXTRA" ? "EXTRA SET" : "SET"
                          } ${setActual.numero}`
                        : "Partit complet"}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-neutral">
                      VISITANT
                    </p>

                    <p className="text-5xl font-black tabular-nums text-neutral-titulos sm:text-6xl">
                      {setActual?.puntosVisitante ?? 0}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card px-3 py-2 text-center text-xs text-neutral">
                  {marcador?.setsFinalizados
                    .map(
                      (set) =>
                        `S${set.numero}: ${set.puntosLocal}-${set.puntosVisitante}`,
                    )
                    .join("  ·  ") || "Encara no hi ha sets finalitzats"}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={!puedeEscribir}
                    onClick={() =>
                      relojActivo ? detenerReloj() : setRelojActivo(true)
                    }
                    className="touch-manipulation rounded-xl px-3 py-2 text-4xl font-black tabular-nums text-primary disabled:opacity-45"
                    aria-label={
                      relojActivo ? "Aturar cronòmetre" : "Iniciar cronòmetre"
                    }
                  >
                    {segundosTexto(relojSegundos)}
                  </button>

                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      className={BOTON_SECUNDARIO}
                      disabled={!puedeEscribir}
                      onClick={() =>
                        relojActivo ? detenerReloj() : setRelojActivo(true)
                      }
                    >
                      {relojActivo ? "Pausa" : "Inicia"}
                    </button>

                    <button
                      type="button"
                      disabled={!puedeEscribir}
                      className="text-xs font-semibold text-neutral underline disabled:opacity-45"
                      onClick={() => setDialogo("RELOJ")}
                    >
                      Reinicia
                    </button>
                  </div>
                </div>

                <p className="text-center text-xs font-medium text-neutral">
                  {relojActivo ? "Cronòmetre en marxa" : "Cronòmetre aturat"}
                </p>
              </div>

              <div className="space-y-3 p-4">
                <p className="text-center text-xs font-bold uppercase tracking-wider text-neutral">
                  Tipus de punt
                </p>

                <div className="grid grid-cols-4 gap-2">
                  {TIPOS_PUNTO_VOLEIBOL.map((tipo) => (
                    <button
                      type="button"
                      key={tipo}
                      disabled={!puedeEscribir || !setActual}
                      aria-pressed={tipoSeleccionado === tipo}
                      onClick={() => seleccionarTipo(tipo)}
                      className={`touch-manipulation flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center transition active:scale-[0.96] disabled:opacity-45 ${
                        tipoSeleccionado === tipo
                          ? "border-primary bg-primary text-white ring-2 ring-primary/30"
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

                <p className="min-h-8 text-center text-xs text-neutral">
                  {tipoSeleccionado
                    ? `Ara toca un jugador per registrar: ${NOMBRES_TIPO[tipoSeleccionado]}.`
                    : jugadorSeleccionado
                      ? `Selecciona el tipus de punt de ${nombreJugador(jugadorSeleccionado.jugador)}.`
                      : "Selecciona un tipus de punt i un jugador, en qualsevol ordre."}

                  {tipoSeleccionado === "ERROR"
                    ? " El punt sumarà a l'equip contrari."
                    : ""}
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className={BOTON_SECUNDARIO}
                    onClick={() => {
                      setTipoSeleccionado(null);
                      setJugadorSeleccionado(null);
                    }}
                  >
                    Cancel·la selecció
                  </button>

                  <button
                    type="button"
                    className={BOTON_SECUNDARIO}
                    onClick={() => setDialogo("CONFIG")}
                  >
                    Configuració
                  </button>

                  <button
                    type="button"
                    className={BOTON_SECUNDARIO}
                    onClick={() => setDialogo("INFORMES")}
                  >
                    Informes ({informes.length})
                  </button>
                </div>
              </div>

              <div className="border-t border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-neutral-titulos">
                    Historial de jugades
                  </h3>

                  <span className="text-xs text-neutral">
                    {marcador?.historial.length ?? 0} punts
                  </span>
                </div>

                <div
                  className="flex max-h-64 flex-col-reverse gap-1 overflow-y-auto overscroll-contain"
                  style={{
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {eventos
                    .filter((e) => e.estado === "ACTIVO")
                    .map((evento) => {
                      const detalle = marcador?.historial.find(
                        (p) => p.clienteEventoID === evento.clienteEventoID,
                      );

                      return (
                        <div
                          key={evento.clienteEventoID}
                          className="flex min-h-14 items-center gap-2 rounded-lg border border-border bg-primary/5 p-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold text-neutral-titulos">
                              {evento.jugadorNombre ?? "Jugador"}
                              {" · "}
                              {NOMBRES_TIPO[
                                evento.tipoEvento as TipoPuntoVoleibol
                              ] ?? evento.tipoEvento}
                            </p>

                            <p className="text-[11px] text-neutral">
                              {evento.equipoNombre}
                              {" · "}
                              Set {detalle?.numeroSet ?? evento.periodo ?? "?"}
                              {" · "}
                              {segundosTexto(evento.tiempoJuegoSegundos ?? 0)}
                            </p>
                          </div>

                          <span className="text-sm font-bold tabular-nums text-primary">
                            {detalle
                              ? `${detalle.puntosLocal}-${detalle.puntosVisitante}`
                              : "—"}
                          </span>

                          <button
                            type="button"
                            className="touch-manipulation rounded-lg border border-border px-2 py-2 text-xs font-semibold text-neutral-titulos disabled:opacity-40"
                            disabled={!puedeEscribir}
                            onClick={() => abrirEdicion(evento)}
                          >
                            Corregeix
                          </button>
                        </div>
                      );
                    })}

                  {eventos.every((e) => e.estado !== "ACTIVO") && (
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
              Punts totals: {marcador?.puntosTotalesLocal ?? 0}
              {" – "}
              {marcador?.puntosTotalesVisitante ?? 0}
            </p>

            <button
              type="button"
              className={BOTON_PRIMARIO}
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
          className={`${RECUADRO} mx-auto max-w-3xl space-y-5 p-5 sm:p-8`}
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
            {[local, visitante].map((equipo, i) => (
              <div
                key={equipo?.id ?? i}
                className="rounded-xl bg-primary/5 p-4"
              >
                <p className="truncate text-sm font-bold text-neutral-titulos">
                  {equipo?.nombre ?? "Equip"}
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
              <thead className="bg-primary/5 text-neutral-titulos">
                <tr>
                  <th className="p-3 text-left">Set</th>
                  <th className="p-3 text-right">Local</th>
                  <th className="p-3 text-right">Visitant</th>
                </tr>
              </thead>

              <tbody>
                {marcador?.setsFinalizados.map((set) => (
                  <tr key={set.numero} className="border-t border-border">
                    <td className="p-3">
                      {set.tipo === "EXTRA" ? "Extra set" : `Set ${set.numero}`}
                    </td>

                    <td className="p-3 text-right tabular-nums">
                      {set.puntosLocal}
                    </td>

                    <td className="p-3 text-right tabular-nums">
                      {set.puntosVisitante}
                    </td>
                  </tr>
                ))}

                {marcador?.setActual &&
                  marcador.setActual.puntosLocal +
                    marcador.setActual.puntosVisitante >
                    0 && (
                    <tr className="border-t border-border text-neutral">
                      <td className="p-3">
                        {marcador.setActual.tipo === "EXTRA"
                          ? "Extra set"
                          : `Set ${marcador.setActual.numero}`}
                        {" (en curs)"}
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

          <div
            className={`rounded-xl border p-4 text-sm ${
              evaluacion?.permitido
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-bold">
              {evaluacion?.mensaje ?? "No hi ha un marcador vàlid."}
            </p>

            {evaluacion?.ganadorEquipoID && (
              <p className="mt-1">
                Guanyador:{" "}
                {evaluacion.ganadorEquipoID === local?.id
                  ? local?.nombre
                  : visitante?.nombre}
              </p>
            )}
          </div>

          {modoCierre === "FORZADO_PUNTOS" && (
            <label className="flex items-start gap-3 rounded-xl border border-border p-4 text-sm text-neutral-titulos">
              <input
                className="mt-1 h-5 w-5 accent-primary"
                type="checkbox"
                checked={confirmadoForzado}
                onChange={(e: {
                  target: {
                    checked: boolean;
                  };
                }) => setConfirmadoForzado(e.target.checked)}
              />
              Confirm que vull tancar el partit excepcionalment amb els sets
              empatats i adjudicar el guanyador per la suma de punts de tots els
              sets, inclòs un extra set iniciat.
            </label>
          )}

          {pendientes > 0 && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Queden {pendientes} operacions per enviar. Torna a l'acta i
              envia-les.
            </p>
          )}

          {informesPendientes && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Hi ha informes només al dispositiu; la integració d'informes amb
              l'API està pendent. Exporta'ls i conserva'ls. El tancament queda
              bloquejat fins que se sincronitzin.
            </p>
          )}

          <div className="flex flex-wrap justify-between gap-3">
            <button
              type="button"
              className={BOTON_SECUNDARIO}
              onClick={() => setPantalla("ACTA")}
            >
              Tornar a l'acta
            </button>

            <button
              type="button"
              className={BOTON_PRIMARIO}
              disabled={
                !puedeEscribir ||
                !evaluacion?.permitido ||
                finalizando ||
                pendientes > 0 ||
                informesPendientes ||
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
          className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`${RECUADRO} w-full max-w-sm space-y-4 p-6 text-center`}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-primary">
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
              className={BOTON_PRIMARIO}
              onClick={() => {
                setAvisoSet(null);

                if (marcador?.finalizadoPorSets) {
                  setPantalla("RESUMEN");
                }
              }}
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {dialogo && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`${RECUADRO} my-auto w-full max-w-lg space-y-4 p-4 sm:p-6`}
          >
            {dialogo === "CONFIG" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Configuració del partit
                </h3>

                <p className="text-sm text-neutral">
                  Regles fixades en iniciar l'acta segons l'edició. No es poden
                  modificar des d'aquesta pantalla sense una API autoritzada.
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
              </>
            )}

            {dialogo === "RELOJ" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Reiniciar cronòmetre
                </h3>

                <p className="text-sm text-neutral">
                  Vols posar el cronòmetre a 00:00? Les jugades i els seus temps
                  no canviaran.
                </p>

                <button
                  type="button"
                  className={BOTON_PRIMARIO}
                  disabled={!puedeEscribir}
                  onClick={() => {
                    detenerReloj();

                    baseRelojRef.current = 0;
                    setRelojSegundos(0);

                    try {
                      window.localStorage.setItem(registroReloj, "0");
                    } catch {
                      // No crítico.
                    }

                    setDialogo(null);
                  }}
                >
                  Posa a zero
                </button>
              </>
            )}

            {dialogo === "EDITAR" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Corregir jugada
                </h3>

                <p className="text-sm text-neutral">
                  Anul·la la jugada, que es conservarà al registre, o
                  substitueix la darrera jugada sincronitzada. El marcador es
                  recalcula.
                </p>

                <label className="block text-sm font-semibold text-neutral-titulos">
                  Tipus de punt
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-card p-3"
                    value={edicionTipo}
                    onChange={(e: {
                      target: {
                        value: string;
                      };
                    }) => setEdicionTipo(e.target.value as TipoPuntoVoleibol)}
                  >
                    {TIPOS_PUNTO_VOLEIBOL.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {NOMBRES_TIPO[tipo]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-neutral-titulos">
                  Equip responsable
                  <select
                    className="mt-1 w-full rounded-lg border border-border bg-card p-3"
                    value={edicionEquipoID}
                    onChange={(e: {
                      target: {
                        value: string;
                      };
                    }) => {
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
                    onChange={(e: {
                      target: {
                        value: string;
                      };
                    }) => setEdicionJugadorID(e.target.value)}
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
                    className={BOTON_PRIMARIO}
                    disabled={
                      !idEditar ||
                      idEditar !== ultimoEventoActivo?.clienteEventoID ||
                      pendientes > 0 ||
                      !edicionJugadorID
                    }
                    onClick={corregirUltimoPunto}
                  >
                    Substituir darrera jugada
                  </button>

                  <button
                    type="button"
                    className={`${BOTON} border-red-200 bg-red-50 text-red-800`}
                    onClick={() => {
                      if (idEditar) {
                        anularPunto(idEditar);
                      }
                    }}
                    disabled={!puedeEscribir}
                  >
                    Anul·lar jugada
                  </button>
                </div>
              </>
            )}

            {dialogo === "INFORMES" && (
              <>
                <h3 className="text-xl font-extrabold text-neutral-titulos">
                  Informes del partit
                </h3>

                <p className="text-xs text-amber-800">
                  Els informes es conserven al dispositiu i es poden exportar.
                  Encara no hi ha un endpoint de sincronització d'informes, per
                  això no consten com a enviats.
                </p>

                <div className="max-h-36 space-y-2 overflow-y-auto">
                  {informes.map((informe) => (
                    <div
                      key={informe.id}
                      className="rounded-lg bg-primary/5 p-3 text-xs"
                    >
                      <p className="font-bold text-neutral-titulos">
                        {informe.tipo === "GENERIC"
                          ? "Informe general"
                          : "Suspensió"}
                        {" · "}
                        Pendent d'enviar
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-neutral">
                        {informe.contenido}
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
                    onChange={(e: {
                      target: {
                        value: string;
                      };
                    }) => setEquipoInforme(e.target.value)}
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
                  onChange={(e: {
                    target: {
                      value: string;
                    };
                  }) => setTextoInforme(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={BOTON_PRIMARIO}
                    onClick={guardarInformeLocal}
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
                    className={BOTON_SECUNDARIO}
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
                className={BOTON_SECUNDARIO}
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
