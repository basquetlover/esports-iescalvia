import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeBroadcast } from "@components/realtime/SupabaseRealtime";

// src/components/panel/partits/ActesActives.tsx
// Llistat administratiu, bloqueig, control i supervisió en directe.

type Props = {
  torneoID: string;
  edicionID: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type Usuario = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
};

type Acta = {
  id: string;
  partidoID: string;
  estado: string;
  estadoOperativo: string | null;
  iniciadaAt: string | null;
  actualizadaAt: string | null;
  version: number;
  controlador: Usuario | null;
  operador: Usuario | null;
  esControlador: boolean;
  tieneControlador: boolean;
  partido: {
    id: string;
    codigo: string;
    nombre: string | null;
    estado: string;
    fechaHora: string | null;
    pista: string | null;
    fase: string | null;
    ronda: string | null;
    equipos: {
      local: string | null;
      visitante: string | null;
    };
  };
};

type Permisos = {
  ver: boolean;
  supervisar: boolean;
  controlar: boolean;
  transferirControl: boolean;
  bloquear: boolean;
  desbloquear: boolean;
  expulsar: boolean;
  revisar: boolean;
  autorizarRevision: boolean;
  cerrarRevision: boolean;
  verAuditoria: boolean;
  operacionesDisponibles: boolean;
};

type EventoServidor = {
  id: string;
  cliente_evento_id: string;
  orden: number;
  tipo_evento: string;
  equipo_nombre: string | null;
  jugador_nombre: string | null;
  periodo: number | null;
  tiempo_juego_segundos: number | null;
  datos: Record<string, unknown> | null;
  estado: string;
  created_at: string;
  anulado_at: string | null;
};

type Accion = "bloquear" | "desbloquear" | "tomar";
type FiltroEstado =
  | "TODOS"
  | "DISPONIBLE"
  | "CONTROLADA"
  | "EN_SUPERVISION"
  | "EN_REVISION"
  | "BLOQUEADA";
type FiltroControlador =
  | "TODOS"
  | "CON_CONTROLADOR"
  | "SIN_CONTROLADOR"
  | "CONTROL_PROPIO";
type Orden = "ACTUALIZACION" | "FECHA" | "CODIGO";

const TARJETA = "rounded-2xl border border-border bg-card shadow-sm";

const CAMPO =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const BOTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50";

const PRIMARIO =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

function nombreUsuario(usuario: Usuario | null): string {
  return usuario
    ? [usuario.nombre, usuario.apellido1, usuario.apellido2]
        .filter(Boolean)
        .join(" ")
        .trim() || "Usuari sense nom"
    : "Sense controlador";
}

function fecha(valor: string | null): string {
  if (!valor) return "Data pendent";

  const d = new Date(valor);

  return Number.isNaN(d.getTime())
    ? "Data pendent"
    : new Intl.DateTimeFormat("ca-ES", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Madrid",
      }).format(d);
}

function hora(valor: string | null): string {
  if (!valor) return "—";

  const d = new Date(valor);

  return Number.isNaN(d.getTime())
    ? "—"
    : new Intl.DateTimeFormat("ca-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Madrid",
      }).format(d);
}

function clave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function estadoActa(acta: Acta): string {
  return acta.estadoOperativo === "BLOQUEADA" || acta.estado === "BLOQUEADA"
    ? "BLOQUEADA"
    : (acta.estadoOperativo ?? "DISPONIBLE");
}

function nombreEstado(estado: string): string {
  return (
    (
      {
        DISPONIBLE: "Disponible",
        CONTROLADA: "Controlada",
        EN_SUPERVISION: "En supervisió",
        EN_REVISION: "En revisió",
        BLOQUEADA: "Bloquejada",
        FINALIZADA: "Finalitzada",
      } as Record<string, string>
    )[estado] ?? estado
  );
}

function colorEstado(estado: string): string {
  return estado === "BLOQUEADA"
    ? "bg-red-500/10 text-red-700"
    : estado === "CONTROLADA"
      ? "bg-emerald-500/10 text-emerald-700"
      : estado === "EN_SUPERVISION"
        ? "bg-blue-500/10 text-blue-700"
        : estado === "EN_REVISION"
          ? "bg-violet-500/10 text-violet-700"
          : "bg-amber-500/10 text-amber-700";
}

function enlaceActa(acta: Acta, torneoID: string, edicionID: string): string {
  return (
    `/panell/partits/${encodeURIComponent(acta.partidoID)}/acta?` +
    new URLSearchParams({ torneoID, edicionID })
  );
}

async function leerJSON(respuesta: Response): Promise<Record<string, unknown>> {
  const contenido: unknown = await respuesta.json().catch(() => null);

  if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) {
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

  return datos;
}

function EtiquetaEstat({ acta }: { acta: Acta }) {
  const estado = estadoActa(acta);

  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${colorEstado(estado)}`}
    >
      {nombreEstado(estado)}
    </span>
  );
}

// ============================================================
// VISOR DE SUPERVISIÓN — SOLO LECTURA
// ============================================================

function SupervisioEnDirecte({
  acta,
  torneoID,
  edicionID,
  onTancar,
}: {
  acta: Acta;
  torneoID: string;
  edicionID: string;
  onTancar: () => void;
}) {
  const [eventos, setEventos] = useState<EventoServidor[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [ultimaLectura, setUltimaLectura] = useState<string | null>(null);
  const [mostrarAnulados, setMostrarAnulados] = useState(true);

  const actualizar = useCallback(() => setRevision((n) => n + 1), []);

  const realtimeJugadas = useRealtimeBroadcast({
    canal: `acta-jugades-partit-${acta.partidoID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  const realtimeEstado = useRealtimeBroadcast({
    canal: `acta-estat-partit-${acta.partidoID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function cargar() {
      setActualizando(true);

      try {
        const respuesta = await fetch(
          `/api/panell/acta/eventos?partidoID=${encodeURIComponent(acta.partidoID)}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const datos = await leerJSON(respuesta);

        if (!Array.isArray(datos.eventos)) {
          throw new Error("No s'ha rebut l'historial de jugades.");
        }

        if (controller.signal.aborted) return;

        setEventos(datos.eventos as EventoServidor[]);
        setUltimaLectura(new Date().toISOString());
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error
              ? e.message
              : "No s'han pogut llegir les jugades.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCargando(false);
          setActualizando(false);
        }
      }
    }

    void cargar();

    return () => controller.abort();
  }, [acta.partidoID, revision]);

  // Recuperación ante desconexiones y avisos perdidos.
  // Nunca modifica las jugadas.

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        actualizar();
      }
    }, 12000);

    const recuperar = () => actualizar();

    window.addEventListener("online", recuperar);
    window.addEventListener("focus", recuperar);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", recuperar);
      window.removeEventListener("focus", recuperar);
    };
  }, [actualizar]);

  const totalActivos = eventos.filter((e) => e.estado === "ACTIVO").length;

  const anulados = eventos.length - totalActivos;

  const visibles = useMemo(
    () =>
      eventos
        .filter((e) => mostrarAnulados || e.estado === "ACTIVO")
        .sort((a, b) => b.orden - a.orden)
        .slice(0, 150),
    [eventos, mostrarAnulados],
  );

  return (
    <div
      className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onTancar();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-supervisio"
        className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-neutral-titulos shadow-2xl sm:max-h-[92dvh]"
      >
        <header className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              Supervisió en directe · {acta.partido.codigo}
            </p>

            <h2
              id="titulo-supervisio"
              className="mt-1 text-xl font-black sm:text-2xl"
            >
              {acta.partido.nombre || "Acta del partit"}
            </h2>

            <p className="mt-2 text-sm text-neutral">
              {acta.partido.equipos.local ?? "Local"} —{" "}
              {acta.partido.equipos.visitante ?? "Visitant"}
            </p>
          </div>

          <button
            type="button"
            onClick={onTancar}
            className={BOTON}
            aria-label="Tancar la supervisió"
          >
            Tancar ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)]">
            <aside className="space-y-3">
              <div className={`${TARJETA} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <EtiquetaEstat acta={acta} />

                  <span className="text-xs text-neutral">
                    {fecha(acta.partido.fechaHora)}
                  </span>
                </div>

                <p className="mt-3 text-xs text-neutral">Controlador</p>

                <p className="mt-1 font-bold">
                  {nombreUsuario(acta.controlador)}
                </p>

                <p className="mt-3 text-xs text-neutral">
                  {acta.partido.pista || "Pista pendent"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`${TARJETA} p-4`}>
                  <p className="text-xs text-neutral">Jugades actives</p>

                  <p className="mt-1 text-3xl font-black tabular-nums">
                    {totalActivos}
                  </p>
                </div>

                <div className={`${TARJETA} p-4`}>
                  <p className="text-xs text-neutral">Anul·lades</p>

                  <p className="mt-1 text-3xl font-black tabular-nums">
                    {anulados}
                  </p>
                </div>
              </div>

              <div className={`${TARJETA} flex flex-col gap-2 p-4`}>
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      realtimeJugadas === "CONECTADO"
                        ? "bg-emerald-500"
                        : "bg-amber-500"
                    }`}
                  />

                  {realtimeJugadas === "CONECTADO"
                    ? "Jugades en directe"
                    : "Recuperació de connexió activa"}
                </div>

                <p className="text-xs text-neutral">
                  {realtimeEstado === "CONECTADO"
                    ? "Estat del partit connectat"
                    : "Comprovant l'estat del partit"}
                </p>

                <p className="text-xs text-neutral">
                  Última lectura: {hora(ultimaLectura)}
                </p>

                {actualizando && (
                  <p className="text-xs text-primary">
                    Actualitzant les jugades...
                  </p>
                )}

                <button
                  type="button"
                  onClick={actualizar}
                  disabled={actualizando}
                  className={BOTON}
                >
                  Actualitzar ara
                </button>

                <a
                  href={enlaceActa(acta, torneoID, edicionID)}
                  className={PRIMARIO}
                >
                  Obrir l'editor del partit
                </a>
              </div>
            </aside>

            <div className={`${TARJETA} min-w-0 overflow-hidden`}>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                <div>
                  <h3 className="font-bold">Historial de jugades</h3>

                  <p className="mt-1 text-xs text-neutral">
                    Actualització automàtica, sense editar
                  </p>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-neutral">
                  <input
                    type="checkbox"
                    checked={mostrarAnulados}
                    onChange={(e) => setMostrarAnulados(e.target.checked)}
                  />
                  Mostrar anul·lades
                </label>
              </div>

              <div className="max-h-[57dvh] space-y-2 overflow-y-auto p-3 sm:p-4">
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-400/40 bg-red-500/5 p-3 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}

                {cargando && eventos.length === 0 && (
                  <p className="p-5 text-center text-sm text-neutral">
                    Carregant jugades...
                  </p>
                )}

                {!cargando && visibles.length === 0 && (
                  <p className="p-7 text-center text-sm text-neutral">
                    Encara no hi ha jugades registrades.
                  </p>
                )}

                {visibles.map((evento) => {
                  const anulada = evento.estado !== "ACTIVO";

                  const tipus = evento.tipo_evento.replace(/_/g, " ");

                  return (
                    <article
                      key={evento.id}
                      className={`rounded-xl border p-3 ${
                        anulada
                          ? "border-border bg-background/50 opacity-65"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-black text-primary">
                              #{evento.orden}
                            </span>

                            <span
                              className={`text-sm font-bold ${
                                anulada ? "line-through" : ""
                              }`}
                            >
                              {tipus}
                            </span>

                            {anulada && (
                              <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-xs font-bold text-red-700">
                                Anul·lada
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm font-semibold">
                            {evento.jugador_nombre || "Jugador no especificat"}
                          </p>

                          <p className="mt-1 text-xs text-neutral">
                            {evento.equipo_nombre || "Equip no especificat"}
                            {evento.periodo != null
                              ? ` · Període/set ${evento.periodo}`
                              : ""}
                          </p>
                        </div>

                        <time
                          className="shrink-0 text-xs text-neutral"
                          dateTime={evento.created_at}
                        >
                          {hora(evento.created_at)}
                        </time>
                      </div>
                    </article>
                  );
                })}

                {eventos.length > 150 && (
                  <p className="py-3 text-center text-xs text-neutral">
                    Es mostren les 150 jugades més recents.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 text-xs text-neutral sm:px-6">
          Les jugades es llegeixen de la base de dades. La supervisió no
          assumeix el control ni envia operacions.
        </footer>
      </section>
    </div>
  );
}

// ============================================================
// LISTADO Y ACCIONES ADMINISTRATIVAS
// ============================================================

export default function ActesActives({ torneoID, edicionID }: Props) {
  const [actas, setActas] = useState<Acta[]>([]);
  const [permisos, setPermisos] = useState<Permisos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(
    null,
  );
  const [revision, setRevision] = useState(0);

  const [dialogo, setDialogo] = useState<{
    accion: Accion;
    acta: Acta;
  } | null>(null);

  const [supervisada, setSupervisada] = useState<Acta | null>(null);

  const [motivo, setMotivo] = useState("");
  const [errorAccion, setErrorAccion] = useState("");
  const [ejecutando, setEjecutando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("TODOS");
  const [filtroControlador, setFiltroControlador] =
    useState<FiltroControlador>("TODOS");
  const [orden, setOrden] = useState<Orden>("ACTUALIZACION");

  const actualizar = useCallback(() => setRevision((n) => n + 1), []);

  const estadoRealtime = useRealtimeBroadcast({
    canal: `actes-actives-edicio-${edicionID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function cargar() {
      setActualizando(true);

      try {
        const params = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(`/api/panell/acta/actives?${params}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        const datos = await leerJSON(respuesta);

        if (!Array.isArray(datos.actas) || !datos.permisos) {
          throw new Error("No s'han rebut les actes i els permisos.");
        }

        if (controller.signal.aborted) return;

        setActas(datos.actas as Acta[]);
        setPermisos(datos.permisos as Permisos);
        setLimiteAlcanzado(datos.limiteAlcanzado === true);
        setUltimaActualizacion(new Date().toISOString());
        setError("");
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error
              ? e.message
              : "No s'han pogut carregar les actes.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setActualizando(false);
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => controller.abort();
  }, [torneoID, edicionID, revision]);

  useEffect(() => {
    const recuperar = () => actualizar();

    window.addEventListener("online", recuperar);
    window.addEventListener("focus", recuperar);

    return () => {
      window.removeEventListener("online", recuperar);
      window.removeEventListener("focus", recuperar);
    };
  }, [actualizar]);

  useEffect(() => {
    if (!dialogo && !supervisada) return;

    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const escapar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ejecutando) {
        setDialogo(null);
        setSupervisada(null);
        setErrorAccion("");
      }
    };

    window.addEventListener("keydown", escapar);

    return () => {
      document.body.style.overflow = anterior;
      window.removeEventListener("keydown", escapar);
    };
  }, [dialogo, supervisada, ejecutando]);

  const visibles = useMemo(() => {
    const texto = clave(busqueda);

    const filtradas = actas.filter((acta) => {
      if (filtroEstado !== "TODOS" && estadoActa(acta) !== filtroEstado) {
        return false;
      }

      if (filtroControlador === "CON_CONTROLADOR" && !acta.tieneControlador) {
        return false;
      }

      if (filtroControlador === "SIN_CONTROLADOR" && acta.tieneControlador) {
        return false;
      }

      if (filtroControlador === "CONTROL_PROPIO" && !acta.esControlador) {
        return false;
      }

      return (
        !texto ||
        clave(
          [
            acta.partido.codigo,
            acta.partido.nombre,
            acta.partido.pista,
            acta.partido.fase,
            acta.partido.ronda,
            acta.partido.equipos.local,
            acta.partido.equipos.visitante,
            nombreUsuario(acta.controlador),
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(texto)
      );
    });

    if (orden === "FECHA") {
      filtradas.sort((a, b) =>
        (a.partido.fechaHora ?? "9999").localeCompare(
          b.partido.fechaHora ?? "9999",
        ),
      );
    } else if (orden === "CODIGO") {
      filtradas.sort((a, b) =>
        a.partido.codigo.localeCompare(b.partido.codigo, "ca", {
          numeric: true,
        }),
      );
    } else {
      filtradas.sort((a, b) =>
        (b.actualizadaAt ?? "").localeCompare(a.actualizadaAt ?? ""),
      );
    }

    return filtradas;
  }, [actas, busqueda, filtroEstado, filtroControlador, orden]);

  const resum = useMemo(
    () => ({
      total: actas.length,
      controlades: actas.filter((a) => estadoActa(a) === "CONTROLADA").length,
      bloquejades: actas.filter((a) => estadoActa(a) === "BLOQUEADA").length,
      supervisio: actas.filter((a) =>
        ["EN_SUPERVISION", "EN_REVISION"].includes(estadoActa(a)),
      ).length,
    }),
    [actas],
  );

  function abrirDialogo(acta: Acta, accion: Accion) {
    setDialogo({ acta, accion });
    setMotivo("");
    setErrorAccion("");
    setExito("");
  }

  async function ejecutarAccion() {
    if (!dialogo || ejecutando) return;

    const { acta, accion } = dialogo;

    if (
      accion === "bloquear" &&
      (!motivo.trim() || motivo.trim().length > 500)
    ) {
      setErrorAccion("Escriu un motiu d'entre 1 i 500 caràcters.");
      return;
    }

    setEjecutando(true);
    setErrorAccion("");

    try {
      const respuesta = await fetch(
        accion === "tomar"
          ? "/api/panell/acta/control"
          : "/api/panell/acta/bloqueo",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            torneoID,
            edicionID,
            partidoID: acta.partidoID,
            accion,
            ...(accion === "bloquear" ? { motivo: motivo.trim() } : {}),
          }),
        },
      );

      await leerJSON(respuesta);

      setDialogo(null);

      setExito(
        accion === "bloquear"
          ? `L'acta ${acta.partido.codigo} s'ha bloquejat.`
          : accion === "desbloquear"
            ? `L'acta ${acta.partido.codigo} s'ha desbloquejat.`
            : `Has assumit el control de l'acta ${acta.partido.codigo}.`,
      );

      actualizar();
    } catch (e) {
      setErrorAccion(
        e instanceof Error ? e.message : "No s'ha pogut completar l'operació.",
      );
    } finally {
      setEjecutando(false);
    }
  }

  const dialogActa = dialogo?.acta;
  const dialogAccion = dialogo?.accion;

  const hayTransferencia = Boolean(
    dialogAccion === "tomar" &&
    dialogActa?.tieneControlador &&
    !dialogActa?.esControlador,
  );

  const supervisadaActual = supervisada
    ? (actas.find((a) => a.id === supervisada.id) ?? supervisada)
    : null;

  return (
    <div className="w-full min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Supervisió i control
          </p>
          <h2 className="mt-1 text-2xl font-black text-neutral-titulos">
            Actes en actiu
          </h2>
        </div>

        <button
          type="button"
          disabled={actualizando}
          onClick={actualizar}
          className={BOTON}
        >
          {actualizando ? "Actualitzant..." : "Actualitzar"}
        </button>
      </header>

      <section
        className={`${TARJETA} flex flex-wrap items-center justify-between gap-2 p-3`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              estadoRealtime === "CONECTADO" ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          <span className="text-xs font-semibold">
            {estadoRealtime === "CONECTADO"
              ? "Realtime connectat"
              : "Esperant connexió Realtime"}
          </span>
        </div>

        <span className="text-xs text-neutral">
          Última càrrega: {hora(ultimaActualizacion)}
        </span>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            ["Actes obertes", resum.total],
            ["Controlades", resum.controlades],
            ["Bloquejades", resum.bloquejades],
            ["Supervisió/revisió", resum.supervisio],
          ] as const
        ).map(([nom, valor]) => (
          <div key={nom} className={`${TARJETA} p-4`}>
            <p className="text-xs text-neutral">{nom}</p>
            <p className="mt-1 text-2xl font-black tabular-nums">{valor}</p>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-400/40 bg-red-500/5 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {exito && (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/5 p-4 text-sm text-emerald-700"
        >
          {exito}
        </div>
      )}

      {limiteAlcanzado && (
        <p className="rounded-xl border border-amber-400/40 p-4 text-sm text-amber-700">
          El llistat ha arribat al límit de consulta.
        </p>
      )}

      <section
        className={`${TARJETA} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}
      >
        <label className="text-xs font-semibold text-neutral">
          Cercar
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Partit, equip, controlador..."
            type="search"
            className={`${CAMPO} mt-1.5`}
          />
        </label>

        <label className="text-xs font-semibold text-neutral">
          Estat de l'acta
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
            className={`${CAMPO} mt-1.5`}
          >
            <option value="TODOS">Tots els estats</option>
            <option value="DISPONIBLE">Disponibles</option>
            <option value="CONTROLADA">Controlades</option>
            <option value="EN_SUPERVISION">En supervisió</option>
            <option value="EN_REVISION">En revisió</option>
            <option value="BLOQUEADA">Bloquejades</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-neutral">
          Controlador
          <select
            value={filtroControlador}
            onChange={(e) =>
              setFiltroControlador(e.target.value as FiltroControlador)
            }
            className={`${CAMPO} mt-1.5`}
          >
            <option value="TODOS">Totes les actes</option>
            <option value="CON_CONTROLADOR">Amb controlador</option>
            <option value="SIN_CONTROLADOR">Sense controlador</option>
            <option value="CONTROL_PROPIO">Amb el meu control</option>
          </select>
        </label>

        <label className="text-xs font-semibold text-neutral">
          Ordenació
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            className={`${CAMPO} mt-1.5`}
          >
            <option value="ACTUALIZACION">Última actualització</option>
            <option value="FECHA">Data del partit</option>
            <option value="CODIGO">Codi del partit</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold">Actes de l'edició</h3>
          <span className="text-xs text-neutral">
            {visibles.length} resultats
          </span>
        </div>

        {cargando && (
          <div className={`${TARJETA} p-10 text-center text-sm text-neutral`}>
            Carregant les actes...
          </div>
        )}

        {!cargando && visibles.length === 0 && (
          <div className={`${TARJETA} p-10 text-center text-sm text-neutral`}>
            No hi ha actes per mostrar.
          </div>
        )}

        {!cargando &&
          visibles.map((acta) => {
            const estado = estadoActa(acta);
            const bloqueada = estado === "BLOQUEADA";
            const finalizada =
              acta.estado === "FINALIZADA" || estado === "FINALIZADA";
            const revisionActiva = estado === "EN_REVISION";

            const controlable = [
              "DISPONIBLE",
              "CONTROLADA",
              "EN_SUPERVISION",
            ].includes(estado);

            const puedeBloquear = Boolean(
              permisos?.bloquear && controlable && !bloqueada && !finalizada,
            );

            const puedeDesbloquear = Boolean(
              permisos?.desbloquear && bloqueada && !finalizada,
            );

            const puedeTomar = Boolean(
              permisos?.controlar &&
              controlable &&
              !bloqueada &&
              !finalizada &&
              !revisionActiva &&
              (acta.esControlador ||
                !acta.tieneControlador ||
                (permisos.transferirControl && permisos.expulsar)),
            );

            const etiquetaControl = acta.esControlador
              ? "Recuperar control"
              : acta.tieneControlador
                ? "Transferir el control"
                : "Agafar el control";

            return (
              <article key={acta.id} className={`${TARJETA} overflow-hidden`}>
                <div className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-primary">
                      {acta.partido.codigo}
                    </span>

                    <EtiquetaEstat acta={acta} />

                    {acta.esControlador && (
                      <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                        Tens el control
                      </span>
                    )}
                  </div>

                  <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,.55fr)]">
                    <div className="min-w-0">
                      <h4 className="text-lg font-bold">
                        {acta.partido.nombre || acta.partido.codigo}
                      </h4>

                      <p className="mt-1 text-sm font-semibold">
                        {acta.partido.equipos.local || "Equip local pendent"} —{" "}
                        {acta.partido.equipos.visitante ||
                          "Equip visitant pendent"}
                      </p>

                      <p className="mt-3 text-xs text-neutral">
                        {fecha(acta.partido.fechaHora)} ·{" "}
                        {acta.partido.pista || "Pista pendent"}
                        {acta.partido.fase ? ` · ${acta.partido.fase}` : ""}
                        {acta.partido.ronda ? ` · ${acta.partido.ronda}` : ""}
                      </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-3">
                      <p className="text-xs text-neutral">Controlador actual</p>

                      <p className="mt-2 font-bold">
                        {nombreUsuario(acta.controlador)}
                      </p>

                      <p className="mt-2 text-xs text-neutral">
                        Actualitzada: {fecha(acta.actualizadaAt)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background/50 p-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setSupervisada(acta)}
                    className={PRIMARIO}
                  >
                    Supervisar en directe
                  </button>

                  <a
                    href={enlaceActa(acta, torneoID, edicionID)}
                    className={BOTON}
                  >
                    Obrir acta
                  </a>

                  {puedeBloquear && (
                    <button
                      type="button"
                      onClick={() => abrirDialogo(acta, "bloquear")}
                      className={BOTON}
                    >
                      Bloquejar
                    </button>
                  )}

                  {puedeDesbloquear && (
                    <button
                      type="button"
                      onClick={() => abrirDialogo(acta, "desbloquear")}
                      className={BOTON}
                    >
                      Desbloquejar
                    </button>
                  )}

                  {puedeTomar && (
                    <button
                      type="button"
                      onClick={() => abrirDialogo(acta, "tomar")}
                      className={BOTON}
                    >
                      {etiquetaControl}
                    </button>
                  )}

                  {permisos?.revisar && revisionActiva && (
                    <span className="rounded-lg border border-violet-400/30 bg-violet-500/5 px-3 py-2 text-xs text-violet-700">
                      Revisió activa · gestió pendent
                    </span>
                  )}
                </div>
              </article>
            );
          })}
      </section>

      <p className="text-xs text-neutral">
        Les jugades de la supervisió es reben pel canal Realtime del partit, amb
        recuperació de lectura després de desconnexions. Les accions
        administratives sempre es validen al servidor.
      </p>

      {supervisadaActual && (
        <SupervisioEnDirecte
          acta={supervisadaActual}
          torneoID={torneoID}
          edicionID={edicionID}
          onTancar={() => setSupervisada(null)}
        />
      )}

      {dialogo && dialogActa && (
        <div
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !ejecutando) {
              setDialogo(null);
            }
          }}
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="titol-accio-acta"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 text-neutral-titulos shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Gestió de l'acta · {dialogActa.partido.codigo}
                </p>

                <h2 id="titol-accio-acta" className="mt-2 text-xl font-bold">
                  {dialogAccion === "bloquear"
                    ? "Bloquejar acta"
                    : dialogAccion === "desbloquear"
                      ? "Desbloquejar acta"
                      : "Agafar el control"}
                </h2>
              </div>

              <button
                type="button"
                disabled={ejecutando}
                onClick={() => setDialogo(null)}
                className={BOTON}
                aria-label="Tancar"
              >
                ✕
              </button>
            </div>

            <p className="mt-4 text-sm font-semibold">
              {dialogActa.partido.equipos.local || "Local"} —{" "}
              {dialogActa.partido.equipos.visitante || "Visitant"}
            </p>

            {dialogAccion === "bloquear" && (
              <>
                <p className="mt-3 text-sm leading-6 text-neutral">
                  El bloqueig impedirà registrar jugades i invalidarà el token
                  actual.
                </p>

                <label className="mt-4 block text-sm font-semibold">
                  Motiu del bloqueig *
                  <textarea
                    autoFocus
                    rows={4}
                    maxLength={500}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className={`${CAMPO} mt-2 resize-y`}
                    placeholder="Indica el motiu..."
                  />
                </label>

                <p className="mt-1 text-right text-xs text-neutral">
                  {motivo.length}/500
                </p>
              </>
            )}

            {dialogAccion === "desbloquear" && (
              <p className="mt-4 text-sm text-neutral">
                Es retirarà el bloqueig, però el controlador haurà de recuperar
                un token vàlid abans de tornar a escriure.
              </p>
            )}

            {dialogAccion === "tomar" && (
              <p className="mt-4 text-sm leading-6 text-neutral">
                {hayTransferencia
                  ? `Substituiràs ${nombreUsuario(dialogActa.controlador)} i invalidaràs el token anterior. El servidor comprovarà que tens permisos i jerarquia superior.`
                  : dialogActa.esControlador
                    ? "Es recuperarà el teu control si continua disponible."
                    : "Passaràs a controlar el partit i podràs registrar jugades."}
              </p>
            )}

            {errorAccion && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-400/40 bg-red-500/5 p-3 text-sm text-red-700"
              >
                {errorAccion}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={ejecutando}
                onClick={() => setDialogo(null)}
                className={BOTON}
              >
                Cancel·lar
              </button>

              <button
                type="button"
                disabled={
                  ejecutando || (dialogAccion === "bloquear" && !motivo.trim())
                }
                onClick={() => void ejecutarAccion()}
                className={
                  dialogAccion === "bloquear"
                    ? `${BOTON} bg-red-600 text-white hover:bg-red-700`
                    : PRIMARIO
                }
              >
                {ejecutando ? "Processant..." : "Confirmar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
