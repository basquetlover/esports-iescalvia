import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// TIPOS
// ============================================================

type Funcion = "ARBITRE" | "OFICIAL_TAULA";
type TipoPersona = "TODOS" | "VOLUNTARI" | "ADMINISTRADOR";
type OrdenPartidos = "competicion" | "fecha" | "pista";

type Props = {
  torneoID: string;
  edicionID: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type Persona = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  tipoAcceso?: "VOLUNTARI" | "ADMINISTRADOR";
};

type Designacion = {
  id: string;
  partido_id: string;
  usuario_id: string;
  funcion: Funcion;
  revocada_at?: string | null;
  motivo_revocacion?: string | null;
  usuario: Persona | null;
};

type Ronda = {
  id: string;
  nombre: string;
  tipo: string;
  orden: number;
};

type Fase = {
  id: string;
  nombre: string;
  tipo: string;
  orden: number;
  rondas: Ronda[];
};

type Partido = {
  id: string;
  codigo: string;
  nombre: string | null;
  fecha_hora: string | null;
  pista: string | null;
  estado: string;
  fase: Fase | null;
  ronda: {
    id: string;
    nombre: string;
  } | null;
  grupo: {
    id: string;
    nombre: string;
  } | null;
  designaciones: Designacion[];
  totales: {
    arbitres: number;
    oficialsTaula: number;
  };
};

type Permisos = {
  ver: boolean;
  asignar: boolean;
  revocar: boolean;
  revocacionDisponible: boolean;
};

type Listado = {
  success: true;
  partidos: Partido[];
  fases: Fase[];
  pagina: number;
  total: number;
  totalPaginas: number;
  permisos: Permisos;
};

type Detalle = {
  success: true;
  partidoID: string;
  designaciones: Designacion[];
  permisos: Permisos;
};

type Candidatos = {
  success: true;
  candidatos: Persona[];
  total: number;
};

type Asignacion = {
  success: true;
  mensaje: string;
  reutilizada: boolean;
};

type IconoTipo =
  | "buscar"
  | "filtro"
  | "actualizar"
  | "usuarios"
  | "usuario"
  | "calendario"
  | "reloj"
  | "pista"
  | "trofeo"
  | "check"
  | "mas"
  | "chevron"
  | "cerrar";

// ============================================================
// ESTILOS
// ============================================================

const ESTILOS = {
  tarjeta:
    "min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm",

  tarjetaInterior: "rounded-xl border border-border bg-background",

  campo:
    "w-full min-w-0 rounded-xl border border-border bg-background px-3.5 py-3 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50",

  etiqueta: "mb-1.5 block text-xs font-semibold text-neutral",

  boton:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50",

  primario:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",

  seccion: "text-sm font-bold text-neutral-titulos",
} as const;

// ============================================================
// ICONOS
// ============================================================

function Icono({
  tipo,
  className = "h-5 w-5",
}: {
  tipo: IconoTipo;
  className?: string;
}) {
  const formas: Record<IconoTipo, ReactNode> = {
    buscar: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),

    filtro: (
      <>
        <path d="M4 7h16" />
        <path d="M7 12h10" />
        <path d="M10 17h4" />
      </>
    ),

    actualizar: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.5 9a7 7 0 0 1 12-2L20 12" />
        <path d="M18.5 15a7 7 0 0 1-12 2L4 12" />
      </>
    ),

    usuarios: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2" />
        <path d="M17 5a3 3 0 0 1 0 6" />
        <path d="M18 14a5 5 0 0 1 3 5v1" />
      </>
    ),

    usuario: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),

    calendario: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18" />
      </>
    ),

    reloj: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    pista: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M12 4v16" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),

    trofeo: (
      <>
        <path d="M7 4h10v7a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4v3a4 4 0 0 0 4 4" />
        <path d="M17 6h3v3a4 4 0 0 1-4 4" />
        <path d="M12 16v4M8 20h8" />
      </>
    ),

    check: <path d="m5 12 4 4L19 6" />,

    mas: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),

    chevron: <path d="m9 5 7 7-7 7" />,

    cerrar: (
      <>
        <path d="M5 5 19 19" />
        <path d="M19 5 5 19" />
      </>
    ),
  };

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
      {formas[tipo]}
    </svg>
  );
}

// ============================================================
// UTILIDADES
// ============================================================

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function nombrePersona(persona: Persona | null | undefined): string {
  if (!persona) return "Usuari no disponible";

  return (
    [persona.nombre, persona.apellido1, persona.apellido2]
      .filter(Boolean)
      .join(" ")
      .trim() || "Sense nom"
  );
}

function iniciales(persona: Persona | null | undefined): string {
  if (!persona) return "?";

  const partes = [persona.nombre, persona.apellido1].filter(
    Boolean,
  ) as string[];

  return (
    partes
      .map((parte) => parte.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "?"
  );
}

function fecha(valor: string | null): string {
  if (!valor) return "Data pendent";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Data pendent";
  }

  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

function nombreEstado(valor: string): string {
  const estados: Record<string, string> = {
    BORRADOR: "Esborrany",
    PROGRAMADO: "Programat",
    EN_CURSO: "En curs",
    FINALIZADO: "Finalitzat",
    SUSPENDIDO: "Suspès",
    CANCELADO: "Cancel·lat",
  };

  return estados[valor] ?? valor;
}

function estiloEstado(valor: string): string {
  switch (valor) {
    case "EN_CURSO":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "FINALIZADO":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";

    case "SUSPENDIDO":
    case "CANCELADO":
      return "bg-red-500/10 text-red-700 dark:text-red-300";

    default:
      return "bg-background text-neutral";
  }
}

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "S'ha produït un error inesperat.";
}

async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  const contenido: unknown = await respuesta.json().catch(() => null);

  if (
    contenido === null ||
    typeof contenido !== "object" ||
    Array.isArray(contenido)
  ) {
    throw new Error("La resposta del servidor no és vàlida.");
  }

  const datos = contenido as Record<string, unknown>;

  if (!respuesta.ok || datos.success !== true) {
    throw new Error(
      typeof datos.mensaje === "string"
        ? datos.mensaje
        : "No s'ha pogut completar l'operació.",
    );
  }

  return contenido as T;
}

// ============================================================
// COMPONENTES REUTILIZABLES
// ============================================================

function Avatar({
  persona,
  size = "normal",
}: {
  persona: Persona | null | undefined;
  size?: "normal" | "small";
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary ${
        size === "small" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"
      }`}
    >
      {iniciales(persona)}
    </div>
  );
}

function BadgeEstado({ estado }: { estado: string }) {
  return (
    <span
      className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${estiloEstado(estado)}`}
    >
      {nombreEstado(estado)}
    </span>
  );
}

function Aviso({
  texto,
  tipo = "error",
}: {
  texto: string;
  tipo?: "error" | "exito";
}) {
  return (
    <div
      role={tipo === "error" ? "alert" : "status"}
      className={`rounded-xl border p-3.5 text-sm ${
        tipo === "error"
          ? "border-red-300/40 bg-red-500/5 text-red-700 dark:text-red-300"
          : "border-emerald-300/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
      }`}
    >
      {texto}
    </div>
  );
}

function Estadistica({
  titulo,
  valor,
  icono,
}: {
  titulo: string;
  valor: number;
  icono: IconoTipo;
}) {
  return (
    <div className={`${ESTILOS.tarjeta} flex items-center gap-3 p-4`}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icono tipo={icono} className="h-5 w-5" />
      </div>

      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-neutral-titulos">
          {valor}
        </p>

        <p className="text-xs text-neutral">{titulo}</p>
      </div>
    </div>
  );
}

function GrupoDesignaciones({
  titulo,
  funcion,
  designaciones,
}: {
  titulo: string;
  funcion: Funcion;
  designaciones: Designacion[];
}) {
  const registros = designaciones.filter(
    (designacion) =>
      designacion.funcion === funcion && !designacion.revocada_at,
  );

  return (
    <div className={`${ESTILOS.tarjetaInterior} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className={ESTILOS.seccion}>{titulo}</h3>

        <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          {registros.length}
        </span>
      </div>

      {registros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-5 text-center">
          <Icono tipo="usuario" className="mx-auto h-6 w-6 text-neutral" />

          <p className="mt-2 text-xs text-neutral">Cap persona designada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registros.map((designacion) => (
            <div
              key={designacion.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-2.5"
            >
              <Avatar persona={designacion.usuario} size="small" />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-titulos">
                  {nombrePersona(designacion.usuario)}
                </p>

                {designacion.usuario?.email && (
                  <p className="truncate text-xs text-neutral">
                    {designacion.usuario.email}
                  </p>
                )}
              </div>

              <Icono
                tipo="check"
                className="h-4 w-4 shrink-0 text-emerald-600"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// GESTOR PRINCIPAL
// ============================================================

export default function Gestor({
  torneoID,
  edicionID,
  supabaseUrl = "",
  supabaseAnonKey = "",
}: Props) {
  // ==========================================================
  // ESTADO DE PARTIDOS
  // ==========================================================

  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [fases, setFases] = useState<Fase[]>([]);
  const [permisos, setPermisos] = useState<Permisos | null>(null);

  const [seleccionadoID, setSeleccionadoID] = useState<string | null>(null);

  const [cargandoPartidos, setCargandoPartidos] = useState(true);

  const [errorPartidos, setErrorPartidos] = useState<string | null>(null);

  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const [busquedaPartidos, setBusquedaPartidos] = useState("");

  const [busquedaAplicada, setBusquedaAplicada] = useState("");

  const [faseID, setFaseID] = useState("");
  const [rondaID, setRondaID] = useState("");
  const [estado, setEstado] = useState("");
  const [orden, setOrden] = useState<OrdenPartidos>("competicion");

  // ==========================================================
  // ESTADO DE DESIGNACIONES
  // ==========================================================

  const [detalle, setDetalle] = useState<Designacion[]>([]);

  const [detallePartidoID, setDetallePartidoID] = useState<string | null>(null);

  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  const [historial, setHistorial] = useState(false);

  // ==========================================================
  // ESTADO DE PERSONAS
  // ==========================================================

  const [candidatos, setCandidatos] = useState<Persona[]>([]);

  const [cargandoPersonas, setCargandoPersonas] = useState(false);

  const [errorPersonas, setErrorPersonas] = useState<string | null>(null);

  const [busquedaPersona, setBusquedaPersona] = useState("");

  const [tipoPersona, setTipoPersona] = useState<TipoPersona>("TODOS");

  const [personaID, setPersonaID] = useState("");

  const [funcion, setFuncion] = useState<Funcion>("ARBITRE");

  const [limitePersonas, setLimitePersonas] = useState(8);

  // ==========================================================
  // OTROS ESTADOS
  // ==========================================================

  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const [aviso, setAviso] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const [versionPersonas, setVersionPersonas] = useState(0);

  const [realtimeConectado, setRealtimeConectado] = useState(false);

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(true);

  // ==========================================================
  // DATOS DERIVADOS
  // ==========================================================

  const parametrosBase = useMemo(
    () =>
      new URLSearchParams({
        torneoID,
        edicionID,
      }),
    [torneoID, edicionID],
  );

  const partidoSeleccionado = useMemo(
    () => partidos.find((partido) => partido.id === seleccionadoID) ?? null,
    [partidos, seleccionadoID],
  );

  const rondasDisponibles = useMemo(
    () => fases.find((fase) => fase.id === faseID)?.rondas ?? [],
    [fases, faseID],
  );

  const personasFiltradas = useMemo(() => {
    const texto = normalizar(busquedaPersona);

    return candidatos.filter((persona) => {
      if (tipoPersona !== "TODOS" && persona.tipoAcceso !== tipoPersona) {
        return false;
      }

      if (!texto) return true;

      return normalizar(
        `${nombrePersona(persona)} ${persona.email ?? ""}`,
      ).includes(texto);
    });
  }, [candidatos, busquedaPersona, tipoPersona]);

  const personasVisibles = useMemo(
    () => personasFiltradas.slice(0, limitePersonas),
    [personasFiltradas, limitePersonas],
  );

  const personaSeleccionada = useMemo(
    () => candidatos.find((persona) => persona.id === personaID) ?? null,
    [candidatos, personaID],
  );

  const detalleActual = detallePartidoID === seleccionadoID;

  const designacionesActivas = detalleActual
    ? detalle.filter((designacion) => !designacion.revocada_at)
    : [];

  const designacionesRevocadas = detalleActual
    ? detalle.filter((designacion) => Boolean(designacion.revocada_at))
    : [];

  const totalAsignacionesPagina = partidos.reduce(
    (total, partido) =>
      total + partido.totales.arbitres + partido.totales.oficialsTaula,
    0,
  );

  const partidosSinDesignar = partidos.filter(
    (partido) =>
      partido.totales.arbitres === 0 && partido.totales.oficialsTaula === 0,
  ).length;

  const filtrosActivos = [
    faseID,
    rondaID,
    estado,
    busquedaPartidos.trim(),
  ].filter(Boolean).length;

  const puedeAsignar = permisos?.asignar === true;

  // ==========================================================
  // RECARGA
  // ==========================================================

  const recargar = useCallback(() => {
    setVersion((actual) => actual + 1);
  }, []);

  const recargarTodo = useCallback(() => {
    recargar();

    setVersionPersonas((actual) => actual + 1);
  }, [recargar]);

  // ==========================================================
  // DEBOUNCE DE BÚSQUEDA
  // ==========================================================

  useEffect(() => {
    const temporizador = setTimeout(() => {
      setBusquedaAplicada(busquedaPartidos.trim());
    }, 300);

    return () => clearTimeout(temporizador);
  }, [busquedaPartidos]);

  // ==========================================================
  // CARGAR PARTIDOS
  // ==========================================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargandoPartidos(true);
      setErrorPartidos(null);

      try {
        const query = new URLSearchParams(parametrosBase);

        query.set("pagina", String(pagina));
        query.set("porPagina", "40");
        query.set("orden", orden);

        if (faseID) {
          query.set("faseID", faseID);
        }

        if (rondaID) {
          query.set("rondaID", rondaID);
        }

        if (estado) {
          query.set("estado", estado);
        }

        if (busquedaAplicada) {
          query.set("buscarPartido", busquedaAplicada);
        }

        const respuesta = await fetch(`/api/panell/designacions?${query}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        });

        const datos = await leerRespuesta<Listado>(respuesta);

        if (!Array.isArray(datos.partidos) || !Array.isArray(datos.fases)) {
          throw new Error(
            "L'API no retorna el llistat complet. " +
              "Revisa que estigui actualitzada.",
          );
        }

        if (controlador.signal.aborted) {
          return;
        }

        setPartidos(datos.partidos);
        setFases(datos.fases);
        setPermisos(datos.permisos);

        setTotal(datos.total);
        setTotalPaginas(Math.max(1, datos.totalPaginas));

        setSeleccionadoID((anterior) => {
          if (
            anterior &&
            datos.partidos.some((partido) => partido.id === anterior)
          ) {
            return anterior;
          }

          return datos.partidos[0]?.id ?? null;
        });
      } catch (error) {
        if (!controlador.signal.aborted) {
          setErrorPartidos(mensajeError(error));
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoPartidos(false);
        }
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [
    parametrosBase,
    pagina,
    orden,
    faseID,
    rondaID,
    estado,
    busquedaAplicada,
    version,
  ]);

  // ==========================================================
  // CARGAR PERSONAS AUTOMÁTICAMENTE
  // ==========================================================

  useEffect(() => {
    if (!puedeAsignar) {
      setCargandoPersonas(false);
      return;
    }

    const controlador = new AbortController();

    async function cargar() {
      setCargandoPersonas(true);
      setErrorPersonas(null);

      try {
        const query = new URLSearchParams(parametrosBase);

        query.set("candidatos", "true");

        const respuesta = await fetch(`/api/panell/designacions?${query}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        });

        const datos = await leerRespuesta<Candidatos>(respuesta);

        if (!Array.isArray(datos.candidatos)) {
          throw new Error(
            "L'API no ha retornat les persones disponibles. " +
              "Comprova que has actualitzat l'arxiu " +
              "api/panell/designacions/index.ts.",
          );
        }

        if (controlador.signal.aborted) {
          return;
        }

        setCandidatos(datos.candidatos);

        setPersonaID((anterior) =>
          datos.candidatos.some((persona) => persona.id === anterior)
            ? anterior
            : "",
        );
      } catch (error) {
        if (!controlador.signal.aborted) {
          setCandidatos([]);
          setErrorPersonas(mensajeError(error));
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoPersonas(false);
        }
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [parametrosBase, puedeAsignar, versionPersonas]);

  // ==========================================================
  // CARGAR DESIGNACIONES DEL PARTIDO
  // ==========================================================

  useEffect(() => {
    if (!seleccionadoID) {
      setDetalle([]);
      setDetallePartidoID(null);
      return;
    }

    const controlador = new AbortController();
    const partidoID = seleccionadoID;

    async function cargar() {
      setCargandoDetalle(true);
      setErrorDetalle(null);
      setDetallePartidoID(null);

      try {
        const query = new URLSearchParams(parametrosBase);

        query.set("partidoID", partidoID);
        query.set("incluirRevocadas", String(historial));

        const respuesta = await fetch(`/api/panell/designacions?${query}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        });

        const datos = await leerRespuesta<Detalle>(respuesta);

        if (!Array.isArray(datos.designaciones)) {
          throw new Error("La resposta de designacions no és vàlida.");
        }

        if (controlador.signal.aborted) {
          return;
        }

        setDetalle(datos.designaciones);
        setDetallePartidoID(partidoID);
      } catch (error) {
        if (!controlador.signal.aborted) {
          setDetalle([]);
          setErrorDetalle(mensajeError(error));
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargandoDetalle(false);
        }
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [parametrosBase, seleccionadoID, historial, version]);

  // ==========================================================
  // REINICIAR SELECCIÓN AL CAMBIAR DE PARTIDO
  // ==========================================================

  useEffect(() => {
    setPersonaID("");
    setAviso(null);
    setErrorAccion(null);
    setDetallePartidoID(null);
    setHistorial(false);
  }, [seleccionadoID]);

  // ==========================================================
  // REALTIME
  // ==========================================================

  useEffect(() => {
    if (!seleccionadoID || !supabaseUrl || !supabaseAnonKey) {
      setRealtimeConectado(false);
      return;
    }

    let activo = true;

    const cliente = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const canal = cliente
      .channel(`designacions-partit-${seleccionadoID}`)
      .on(
        "broadcast",
        {
          event: "actualitzada",
        },
        () => {
          if (activo) recargar();
        },
      )
      .subscribe((estadoCanal) => {
        if (!activo) return;

        if (estadoCanal === "SUBSCRIBED") {
          setRealtimeConectado(true);
          recargar();
        } else if (
          estadoCanal === "CHANNEL_ERROR" ||
          estadoCanal === "TIMED_OUT" ||
          estadoCanal === "CLOSED"
        ) {
          setRealtimeConectado(false);
        }
      });

    return () => {
      activo = false;
      void cliente.removeChannel(canal);
    };
  }, [seleccionadoID, supabaseUrl, supabaseAnonKey, recargar]);

  // ==========================================================
  // ACTUALIZAR AL REGRESAR A LA PESTAÑA
  // ==========================================================

  useEffect(() => {
    const comprobarVisibilidad = () => {
      if (document.visibilityState === "visible") {
        recargar();
      }
    };

    document.addEventListener("visibilitychange", comprobarVisibilidad);

    return () => {
      document.removeEventListener("visibilitychange", comprobarVisibilidad);
    };
  }, [recargar]);

  // ==========================================================
  // ASIGNAR PERSONA
  // ==========================================================

  const yaDesignado = (id: string) =>
    detalleActual &&
    designacionesActivas.some(
      (designacion) =>
        designacion.usuario_id === id && designacion.funcion === funcion,
    );

  async function asignar() {
    if (
      !seleccionadoID ||
      !personaID ||
      !puedeAsignar ||
      guardando ||
      cargandoDetalle ||
      !detalleActual ||
      yaDesignado(personaID)
    ) {
      return;
    }

    setGuardando(true);
    setErrorAccion(null);
    setAviso(null);

    try {
      const query = new URLSearchParams(parametrosBase);

      query.set("partidoID", seleccionadoID);

      const respuesta = await fetch(`/api/panell/designacions?${query}`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          usuarioID: personaID,
          funcion,
        }),
      });

      const datos = await leerRespuesta<Asignacion>(respuesta);

      setAviso(datos.mensaje);
      setPersonaID("");
      recargar();
    } catch (error) {
      setErrorAccion(mensajeError(error));
    } finally {
      setGuardando(false);
    }
  }

  // ==========================================================
  // FILTROS
  // ==========================================================

  function cambiarFiltro(
    campo: "estado" | "fase" | "ronda" | "orden",
    valor: string,
  ) {
    setPagina(1);

    switch (campo) {
      case "estado":
        setEstado(valor);
        break;

      case "fase":
        setFaseID(valor);
        setRondaID("");
        break;

      case "ronda":
        setRondaID(valor);
        break;

      case "orden":
        setOrden(valor as OrdenPartidos);
        break;
    }
  }

  function limpiarFiltros() {
    setBusquedaPartidos("");
    setBusquedaAplicada("");
    setFaseID("");
    setRondaID("");
    setEstado("");
    setOrden("competicion");
    setPagina(1);
  }

  function cambiarFiltroPersona() {
    setPersonaID("");
    setLimitePersonas(8);
  }

  // ==========================================================
  // RENDER PRINCIPAL
  // ==========================================================

  return (
    <main className="mx-auto w-full min-w-0 max-w-[1750px] space-y-5 px-3 pb-10 sm:px-5">
      {/* =====================================================
          CABECERA
          ===================================================== */}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icono tipo="usuarios" className="h-5 w-5" />
            </div>

            <span className="text-xs font-bold uppercase tracking-[0.15em] text-primary">
              Gestió de competició
            </span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-neutral-titulos sm:text-3xl">
            Designacions
          </h1>

          <p className="mt-1 text-sm leading-6 text-neutral">
            Organitza els àrbitres i oficials de taula de cada partit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {supabaseUrl && supabaseAnonKey && (
            <div className="flex items-center gap-2 text-xs text-neutral">
              <span
                className={`h-2 w-2 rounded-full ${
                  realtimeConectado ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />

              {realtimeConectado
                ? "Sincronització activa"
                : "Sincronització pendent"}
            </div>
          )}

          <button
            type="button"
            onClick={recargarTodo}
            className={ESTILOS.boton}
          >
            <Icono tipo="actualizar" className="h-4 w-4" />
            Actualitzar
          </button>
        </div>
      </header>

      {/* =====================================================
          RESUMEN
          ===================================================== */}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Estadistica
          titulo="Partits de l'edició"
          valor={total}
          icono="calendario"
        />

        <Estadistica
          titulo="Partits en aquesta pàgina"
          valor={partidos.length}
          icono="trofeo"
        />

        <Estadistica
          titulo="Assignacions en aquesta pàgina"
          valor={totalAsignacionesPagina}
          icono="usuarios"
        />

        <Estadistica
          titulo="Sense designacions en aquesta pàgina"
          valor={partidosSinDesignar}
          icono="usuario"
        />
      </div>

      {errorPartidos && <Aviso texto={errorPartidos} />}

      {/* =====================================================
          DOS COLUMNAS
          ===================================================== */}

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        {/* ===================================================
            COLUMNA IZQUIERDA — PARTIDOS
            =================================================== */}

        <section className={ESTILOS.tarjeta}>
          <div className="border-b border-border p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-neutral-titulos">
                  Partits
                </h2>

                <p className="mt-1 text-xs text-neutral">{total} resultats</p>
              </div>

              <button
                type="button"
                onClick={() => setFiltrosAbiertos((valor) => !valor)}
                className={ESTILOS.boton}
                aria-expanded={filtrosAbiertos}
              >
                <Icono tipo="filtro" className="h-4 w-4" />
                Filtres
                {filtrosActivos > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-white">
                    {filtrosActivos}
                  </span>
                )}
              </button>
            </div>

            {/* BUSCADOR */}

            <div className="relative mt-4">
              <Icono
                tipo="buscar"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral"
              />

              <input
                type="search"
                value={busquedaPartidos}
                onChange={(evento) => {
                  setBusquedaPartidos(evento.target.value);

                  setPagina(1);
                }}
                placeholder="Cerca partit, ronda, fase o pista..."
                aria-label="Cercar partits"
                className={`${ESTILOS.campo} pl-10`}
              />
            </div>

            {/* FILTROS AVANZADOS */}

            {filtrosAbiertos && (
              <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ordre-partits" className={ESTILOS.etiqueta}>
                      Ordenació
                    </label>

                    <select
                      id="ordre-partits"
                      value={orden}
                      onChange={(evento) =>
                        cambiarFiltro("orden", evento.target.value)
                      }
                      className={ESTILOS.campo}
                    >
                      <option value="competicion">Ordre de competició</option>

                      <option value="fecha">Data i hora</option>

                      <option value="pista">Pista</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="estat-partits" className={ESTILOS.etiqueta}>
                      Estat
                    </label>

                    <select
                      id="estat-partits"
                      value={estado}
                      onChange={(evento) =>
                        cambiarFiltro("estado", evento.target.value)
                      }
                      className={ESTILOS.campo}
                    >
                      <option value="">Tots els estats</option>

                      <option value="BORRADOR">Esborrany</option>

                      <option value="PROGRAMADO">Programat</option>

                      <option value="EN_CURSO">En curs</option>

                      <option value="FINALIZADO">Finalitzat</option>

                      <option value="SUSPENDIDO">Suspès</option>

                      <option value="CANCELADO">Cancel·lat</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="fase-partits" className={ESTILOS.etiqueta}>
                      Fase
                    </label>

                    <select
                      id="fase-partits"
                      value={faseID}
                      onChange={(evento) =>
                        cambiarFiltro("fase", evento.target.value)
                      }
                      className={ESTILOS.campo}
                    >
                      <option value="">Totes les fases</option>

                      {fases.map((fase) => (
                        <option key={fase.id} value={fase.id}>
                          {fase.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="ronda-partits" className={ESTILOS.etiqueta}>
                      Ronda
                    </label>

                    <select
                      id="ronda-partits"
                      value={rondaID}
                      disabled={!faseID || rondasDisponibles.length === 0}
                      onChange={(evento) =>
                        cambiarFiltro("ronda", evento.target.value)
                      }
                      className={ESTILOS.campo}
                    >
                      <option value="">Totes les rondes</option>

                      {rondasDisponibles.map((ronda) => (
                        <option key={ronda.id} value={ronda.id}>
                          {ronda.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={limpiarFiltros}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                  >
                    <Icono tipo="cerrar" className="h-3.5 w-3.5" />
                    Netejar filtres
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* =================================================
              LISTADO DE PARTIDOS
              ================================================= */}

          <div className="max-h-[720px] space-y-2 overflow-y-auto p-3">
            {cargandoPartidos && (
              <p role="status" className="p-5 text-center text-sm text-neutral">
                Carregant partits...
              </p>
            )}

            {!cargandoPartidos && partidos.length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <Icono tipo="buscar" className="mx-auto h-8 w-8 text-neutral" />

                <p className="mt-3 text-sm font-semibold text-neutral-titulos">
                  No s'han trobat partits
                </p>

                <p className="mt-1 text-xs text-neutral">
                  Prova de canviar els filtres.
                </p>
              </div>
            )}

            {partidos.map((partido) => {
              const seleccionado = seleccionadoID === partido.id;

              const asignados =
                partido.totales.arbitres + partido.totales.oficialsTaula;

              const faseNombre = partido.fase?.nombre ?? "Sense fase";

              const rondaNombre =
                partido.ronda?.nombre ?? partido.grupo?.nombre ?? "";

              return (
                <button
                  key={partido.id}
                  type="button"
                  onClick={() => setSeleccionadoID(partido.id)}
                  disabled={guardando}
                  aria-pressed={seleccionado}
                  className={`group w-full min-w-0 rounded-xl border p-4 text-left transition ${
                    seleccionado
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/40 hover:bg-primary/[0.025]"
                  } disabled:opacity-60`}
                >
                  {/* CABECERA TARJETA */}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-xs font-bold text-primary">
                        {partido.codigo}
                      </span>

                      {partido.fase?.tipo === "ELIMINATORIA" && (
                        <Icono
                          tipo="trofeo"
                          className="h-3.5 w-3.5 text-primary"
                        />
                      )}
                    </div>

                    <BadgeEstado estado={partido.estado} />
                  </div>

                  {/* TÍTULO */}

                  <div className="mt-2 flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-sm font-bold text-neutral-titulos">
                      {partido.nombre || `Partit ${partido.codigo}`}
                    </p>

                    <Icono
                      tipo="chevron"
                      className={`h-4 w-4 shrink-0 transition ${
                        seleccionado
                          ? "text-primary"
                          : "text-neutral group-hover:text-primary"
                      }`}
                    />
                  </div>

                  {/* FASE Y RONDA */}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                      {faseNombre}
                    </span>

                    {rondaNombre && (
                      <span className="rounded-md border border-border px-2 py-1 text-[11px] text-neutral">
                        {rondaNombre}
                      </span>
                    )}
                  </div>

                  {/* FECHA Y PISTA */}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral">
                    <span className="inline-flex items-center gap-1.5">
                      <Icono tipo="calendario" className="h-3.5 w-3.5" />

                      {fecha(partido.fecha_hora)}
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                      <Icono tipo="pista" className="h-3.5 w-3.5" />

                      {partido.pista || "Pista pendent"}
                    </span>
                  </div>

                  {/* PERSONAL ASIGNADO */}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-neutral">
                      <span>
                        <strong className="text-neutral-titulos">
                          {partido.totales.arbitres}
                        </strong>{" "}
                        àrbitres
                      </span>

                      <span>
                        <strong className="text-neutral-titulos">
                          {partido.totales.oficialsTaula}
                        </strong>{" "}
                        oficials
                      </span>
                    </div>

                    <span
                      className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                        asignados > 0
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      }`}
                    >
                      {asignados > 0
                        ? "Amb designacions"
                        : "Sense designacions"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* PAGINACIÓN */}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-3 sm:p-4">
            <p className="text-xs text-neutral">
              Pàgina <strong className="text-neutral-titulos">{pagina}</strong>{" "}
              de{" "}
              <strong className="text-neutral-titulos">{totalPaginas}</strong>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                className={ESTILOS.boton}
                disabled={pagina <= 1 || cargandoPartidos || guardando}
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
              >
                Anterior
              </button>

              <button
                type="button"
                className={ESTILOS.boton}
                disabled={
                  pagina >= totalPaginas || cargandoPartidos || guardando
                }
                onClick={() => setPagina((actual) => actual + 1)}
              >
                Següent
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================
            COLUMNA DERECHA — DESIGNACIONES
            =================================================== */}

        <section className={ESTILOS.tarjeta}>
          {!partidoSeleccionado ? (
            <div className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Icono tipo="calendario" className="h-8 w-8" />
              </div>

              <h2 className="mt-4 text-lg font-bold text-neutral-titulos">
                Selecciona un partit
              </h2>

              <p className="mt-2 max-w-sm text-sm text-neutral">
                Tria un partit de la llista per consultar les designacions i
                assignar-hi personal.
              </p>
            </div>
          ) : (
            <>
              {/* CABECERA DEL PARTIDO */}

              <div className="border-b border-border p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                    Fitxa de designacions
                  </p>

                  <BadgeEstado estado={partidoSeleccionado.estado} />
                </div>

                <h2 className="mt-2 text-xl font-bold text-neutral-titulos sm:text-2xl">
                  {partidoSeleccionado.nombre || partidoSeleccionado.codigo}
                </h2>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                    {partidoSeleccionado.fase?.nombre ?? "Sense fase"}
                  </span>

                  {(partidoSeleccionado.ronda || partidoSeleccionado.grupo) && (
                    <span className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-neutral">
                      {partidoSeleccionado.ronda?.nombre ??
                        partidoSeleccionado.grupo?.nombre}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral">
                  <span className="flex items-center gap-2">
                    <Icono tipo="calendario" className="h-4 w-4" />

                    {fecha(partidoSeleccionado.fecha_hora)}
                  </span>

                  <span className="flex items-center gap-2">
                    <Icono tipo="pista" className="h-4 w-4" />

                    {partidoSeleccionado.pista || "Pista pendent"}
                  </span>
                </div>
              </div>

              <div className="space-y-6 p-4 sm:p-5">
                {/* DESIGNACIONES ACTUALES */}

                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-neutral-titulos">
                        Personal designat
                      </h3>

                      <p className="mt-1 text-xs text-neutral">
                        {designacionesActivas.length} assignacions actives
                      </p>
                    </div>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral">
                      <input
                        type="checkbox"
                        checked={historial}
                        onChange={(evento) =>
                          setHistorial(evento.target.checked)
                        }
                        className="accent-primary"
                      />
                      Veure historial
                    </label>
                  </div>

                  {errorDetalle && <Aviso texto={errorDetalle} />}

                  {cargandoDetalle && (
                    <p role="status" className="py-4 text-sm text-neutral">
                      Carregant designacions...
                    </p>
                  )}

                  {!cargandoDetalle && detalleActual && (
                    <div className="grid gap-3 md:grid-cols-2">
                      <GrupoDesignaciones
                        titulo="Àrbitres"
                        funcion="ARBITRE"
                        designaciones={designacionesActivas}
                      />

                      <GrupoDesignaciones
                        titulo="Oficials de taula"
                        funcion="OFICIAL_TAULA"
                        designaciones={designacionesActivas}
                      />
                    </div>
                  )}

                  {/* HISTORIAL */}

                  {historial &&
                    detalleActual &&
                    !cargandoDetalle &&
                    designacionesRevocadas.length > 0 && (
                      <div className="mt-4 rounded-xl border border-border bg-background p-4">
                        <h4 className={ESTILOS.seccion}>
                          Designacions revocades
                        </h4>

                        <div className="mt-3 space-y-3">
                          {designacionesRevocadas.map((designacion) => (
                            <div
                              key={designacion.id}
                              className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                            >
                              <Avatar
                                persona={designacion.usuario}
                                size="small"
                              />

                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-neutral-titulos">
                                  {nombrePersona(designacion.usuario)}
                                </p>

                                <p className="mt-1 text-xs text-neutral">
                                  {designacion.funcion === "ARBITRE"
                                    ? "Àrbitre"
                                    : "Oficial de taula"}
                                </p>

                                {designacion.motivo_revocacion && (
                                  <p className="mt-1 text-xs text-neutral">
                                    Motiu: {designacion.motivo_revocacion}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* =================================================
                    NUEVA DESIGNACIÓN
                    ================================================= */}

                {puedeAsignar && (
                  <div className="border-t border-border pt-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icono tipo="mas" className="h-5 w-5" />
                      </div>

                      <div>
                        <h3 className="text-base font-bold text-neutral-titulos">
                          Nova designació
                        </h3>

                        <p className="text-xs text-neutral">
                          Selecciona una persona i una funció
                        </p>
                      </div>
                    </div>

                    {/* SELECTOR DE FUNCIÓN */}

                    <div className="mb-4">
                      <p className={ESTILOS.etiqueta}>Funció</p>

                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ["ARBITRE", "Àrbitre"],
                            ["OFICIAL_TAULA", "Oficial de taula"],
                          ] as const
                        ).map(([valor, titulo]) => (
                          <button
                            key={valor}
                            type="button"
                            disabled={guardando}
                            onClick={() => {
                              setFuncion(valor);
                              setPersonaID("");
                            }}
                            aria-pressed={funcion === valor}
                            className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                              funcion === valor
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-neutral hover:border-primary/40"
                            }`}
                          >
                            {titulo}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* BUSCAR PERSONAS */}

                    <div className="mb-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="cercar-persona"
                          className={ESTILOS.etiqueta}
                        >
                          Persones disponibles
                        </label>

                        <span className="text-xs text-neutral">
                          {personasFiltradas.length} resultats
                        </span>
                      </div>

                      <div className="relative">
                        <Icono
                          tipo="buscar"
                          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral"
                        />

                        <input
                          id="cercar-persona"
                          type="search"
                          value={busquedaPersona}
                          onChange={(evento) => {
                            setBusquedaPersona(evento.target.value);
                            cambiarFiltroPersona();
                          }}
                          placeholder="Nom, llinatges o correu..."
                          className={`${ESTILOS.campo} pl-10`}
                        />
                      </div>
                    </div>

                    {/* TIPO DE PERSONA */}

                    <div className="mb-4 flex flex-wrap gap-2">
                      {(
                        [
                          ["TODOS", "Tothom"],
                          ["VOLUNTARI", "Voluntaris"],
                          ["ADMINISTRADOR", "Administradors"],
                        ] as const
                      ).map(([valor, titulo]) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => {
                            setTipoPersona(valor);
                            cambiarFiltroPersona();
                          }}
                          aria-pressed={tipoPersona === valor}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                            tipoPersona === valor
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-neutral hover:border-primary/40"
                          }`}
                        >
                          {titulo}
                        </button>
                      ))}
                    </div>

                    {errorPersonas && (
                      <div className="space-y-2">
                        <Aviso texto={errorPersonas} />

                        <button
                          type="button"
                          onClick={() =>
                            setVersionPersonas((actual) => actual + 1)
                          }
                          className={ESTILOS.boton}
                        >
                          Tornar a carregar persones
                        </button>
                      </div>
                    )}

                    {/* TARJETAS DE PERSONAS */}

                    {cargandoPersonas ? (
                      <p
                        role="status"
                        className="rounded-xl border border-border bg-background p-5 text-center text-sm text-neutral"
                      >
                        Carregant persones disponibles...
                      </p>
                    ) : !errorPersonas ? (
                      <div className="space-y-2">
                        {candidatos.length === 0 && (
                          <div className="rounded-xl border border-dashed border-border p-6 text-center">
                            <Icono
                              tipo="usuarios"
                              className="mx-auto h-7 w-7 text-neutral"
                            />

                            <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                              No hi ha persones habilitades
                            </p>

                            <p className="mt-1 text-xs text-neutral">
                              Comprova les inscripcions, validacions i places
                              confirmades de voluntariat.
                            </p>
                          </div>
                        )}

                        {candidatos.length > 0 &&
                          personasFiltradas.length === 0 && (
                            <div className="rounded-xl border border-dashed border-border p-6 text-center">
                              <p className="text-sm text-neutral">
                                Cap persona coincideix amb els filtres.
                              </p>
                            </div>
                          )}

                        {personasVisibles.map((persona) => {
                          const seleccionada = personaID === persona.id;

                          const duplicada = yaDesignado(persona.id);

                          return (
                            <button
                              key={persona.id}
                              type="button"
                              disabled={
                                duplicada ||
                                guardando ||
                                cargandoDetalle ||
                                !detalleActual
                              }
                              onClick={() => setPersonaID(persona.id)}
                              aria-pressed={seleccionada}
                              className={`flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${
                                seleccionada
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-background hover:border-primary/40"
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <Avatar persona={persona} />

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-neutral-titulos">
                                  {nombrePersona(persona)}
                                </p>

                                <p className="truncate text-xs text-neutral">
                                  {persona.email || "Sense correu"}
                                </p>

                                <p className="mt-1 text-[11px] font-medium text-primary">
                                  {persona.tipoAcceso === "ADMINISTRADOR"
                                    ? "Administrador"
                                    : "Voluntari confirmat"}
                                </p>
                              </div>

                              {duplicada ? (
                                <span className="shrink-0 rounded-lg bg-background px-2 py-1 text-[10px] font-semibold text-neutral">
                                  Ja designat
                                </span>
                              ) : (
                                <span
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                    seleccionada
                                      ? "border-primary bg-primary text-white"
                                      : "border-border"
                                  }`}
                                >
                                  {seleccionada && (
                                    <Icono tipo="check" className="h-4 w-4" />
                                  )}
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {personasFiltradas.length > limitePersonas && (
                          <button
                            type="button"
                            onClick={() =>
                              setLimitePersonas((actual) => actual + 12)
                            }
                            className={`${ESTILOS.boton} w-full`}
                          >
                            Mostrar més persones
                          </button>
                        )}
                      </div>
                    ) : null}

                    {/* CONFIRMAR ASIGNACIÓN */}

                    {personaSeleccionada &&
                      !yaDesignado(personaSeleccionada.id) && (
                        <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                          <p className="text-xs font-semibold text-primary">
                            Designació preparada
                          </p>

                          <p className="mt-1 text-sm font-bold text-neutral-titulos">
                            {nombrePersona(personaSeleccionada)}
                          </p>

                          <p className="mt-1 text-xs text-neutral">
                            {funcion === "ARBITRE"
                              ? "Funció: Àrbitre"
                              : "Funció: Oficial de taula"}
                          </p>
                        </div>
                      )}

                    {errorAccion && (
                      <div className="mt-4">
                        <Aviso texto={errorAccion} />
                      </div>
                    )}

                    {aviso && (
                      <div className="mt-4">
                        <Aviso texto={aviso} tipo="exito" />
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => void asignar()}
                      disabled={
                        !personaID ||
                        guardando ||
                        cargandoDetalle ||
                        !detalleActual ||
                        yaDesignado(personaID)
                      }
                      className={`${ESTILOS.primario} mt-4 w-full`}
                    >
                      {guardando ? (
                        "Desant designació..."
                      ) : (
                        <>
                          <Icono tipo="check" className="h-5 w-5" />
                          Confirmar designació
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* REVOCACIONES PENDIENTES */}

                {permisos?.revocar && !permisos.revocacionDisponible && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs leading-5 text-neutral">
                      La revocació de designacions continua desactivada fins a
                      completar la protecció del control exclusiu de l'acta.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
