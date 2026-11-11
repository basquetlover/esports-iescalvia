import { useCallback, useEffect, useMemo, useState } from "react";
import { useRealtimeBroadcast } from "@components/realtime/SupabaseRealtime";

type Funcion = "ARBITRE" | "OFICIAL_TAULA";
type Filtro = "TOTS" | "PROPERS" | "EN_CURS" | "FINALITZATS";

type Acta = {
  estado: string;
  bloqueada: boolean;
  finalizada: boolean;
  esControlador: boolean;
};

type Partido = {
  id: string;
  codigo: string | null;
  nombre: string | null;
  fechaHora: string | null;
  jornada: number | null;
  orden: number | null;
  pista: string | null;
  estado: string | null;
  fase: string | null;
  ronda: string | null;
  local: string;
  visitante: string;
  funciones: Funcion[];
  acta: Acta | null;
};

type Respuesta = {
  success: boolean;
  mensaje?: string;
  partidos?: Partido[];
};

type Props = {
  torneoID: string;
  edicionID: string;
};

function ordenar(a: Partido, b: Partido): number {
  const aFecha = a.fechaHora ? Date.parse(a.fechaHora) : NaN;
  const bFecha = b.fechaHora ? Date.parse(b.fechaHora) : NaN;
  const aValida = Number.isFinite(aFecha);
  const bValida = Number.isFinite(bFecha);

  if (aValida && bValida && aFecha !== bFecha) {
    return aFecha - bFecha;
  }

  if (aValida !== bValida) return aValida ? -1 : 1;

  return (
    (a.jornada ?? Number.MAX_SAFE_INTEGER) -
      (b.jornada ?? Number.MAX_SAFE_INTEGER) ||
    (a.orden ?? Number.MAX_SAFE_INTEGER) -
      (b.orden ?? Number.MAX_SAFE_INTEGER) ||
    (a.codigo ?? "").localeCompare(b.codigo ?? "", "ca", {
      numeric: true,
    })
  );
}

function fechaPartido(fecha: string | null): string {
  if (!fecha || !Number.isFinite(Date.parse(fecha))) {
    return "Data pendent";
  }

  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(fecha));
}

function estadoPartido(partido: Partido): string {
  const estado = (partido.estado ?? "").toUpperCase();

  if (["CANCELADO", "CANCELAT"].includes(estado)) {
    return "Cancel·lat";
  }

  if (["FINALIZADO", "FINALITZAT"].includes(estado)) {
    return "Finalitzat";
  }

  if (["EN_CURSO", "EN_CURS"].includes(estado)) {
    return "En curs";
  }

  return "Programat";
}

function accionActa(partido: Partido): {
  titulo: string;
  disponible: boolean;
} {
  const estado = (partido.estado ?? "").toUpperCase();
  const acta = partido.acta;

  if (["CANCELADO", "CANCELAT"].includes(estado)) {
    return {
      titulo: "No disponible",
      disponible: false,
    };
  }

  if (!acta) {
    return {
      titulo: "Preparar acta",
      disponible: true,
    };
  }

  if (acta.finalizada) {
    return {
      titulo: "Consultar acta",
      disponible: true,
    };
  }

  if (acta.bloqueada) {
    return {
      titulo: "Veure acta bloquejada",
      disponible: true,
    };
  }

  if (acta.estado === "EN_CURSO") {
    return {
      titulo: acta.esControlador ? "Continuar acta" : "Accedir a l'acta",
      disponible: true,
    };
  }

  return {
    titulo: "Preparar acta",
    disponible: true,
  };
}

const FILTROS: Array<{ id: Filtro; nombre: string }> = [
  { id: "TOTS", nombre: "Tots" },
  { id: "PROPERS", nombre: "Pròxims" },
  { id: "EN_CURS", nombre: "En curs" },
  { id: "FINALITZATS", nombre: "Finalitzats" },
];

export default function PartitsDesignats({ torneoID, edicionID }: Props) {
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TOTS");
  const [revision, setRevision] = useState(0);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(
    null,
  );

  const solicitarActualizacion = useCallback(() => {
    setRevision((anterior) => anterior + 1);
  }, []);

  // ==========================================================
  // REALTIME DE ACTAS
  // ==========================================================

  const estadoActas = useRealtimeBroadcast({
    canal: `actes-actives-edicio-${edicionID}`,
    evento: "actualitzada",
    onCambio: solicitarActualizacion,
  });

  // ==========================================================
  // REALTIME DE DESIGNACIONES
  // ==========================================================

  const estadoDesignaciones = useRealtimeBroadcast({
    canal: `voluntariat-designacions-edicio-${edicionID}`,
    evento: "actualitzada",
    onCambio: solicitarActualizacion,
  });

  // ==========================================================
  // CARGA INICIAL + CAMBIOS REALTIME + BOTÓN MANUAL
  // ==========================================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setActualizando(true);
      setError("");

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(
          `/api/perfil/voluntariat/partits?${parametros}`,
          {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store",
            signal: controlador.signal,
          },
        );

        const datos = (await respuesta.json()) as Respuesta;

        if (!respuesta.ok || datos.success !== true) {
          throw new Error(
            datos.mensaje ?? "No s'han pogut carregar els partits.",
          );
        }

        if (!Array.isArray(datos.partidos)) {
          throw new Error("La resposta dels partits no és vàlida.");
        }

        if (controlador.signal.aborted) return;

        setPartidos(datos.partidos);
        setUltimaActualizacion(new Date());
      } catch (fallo) {
        if (controlador.signal.aborted) return;

        setPartidos([]);
        setError(
          fallo instanceof Error
            ? fallo.message
            : "No s'han pogut carregar els partits.",
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
          setActualizando(false);
        }
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [torneoID, edicionID, revision]);

  // ==========================================================
  // ORDEN Y FILTROS LOCALES
  // ==========================================================

  const ordenados = useMemo(() => [...partidos].sort(ordenar), [partidos]);

  const filtrados = useMemo(() => {
    return ordenados.filter((partido) => {
      const estado = (partido.estado ?? "").toUpperCase();

      if (filtro === "TOTS") return true;

      if (filtro === "FINALITZATS") {
        return (
          ["FINALIZADO", "FINALITZAT"].includes(estado) ||
          partido.acta?.finalizada === true
        );
      }

      if (filtro === "EN_CURS") {
        return (
          ["EN_CURSO", "EN_CURS"].includes(estado) ||
          (partido.acta?.estado === "EN_CURSO" && !partido.acta.bloqueada)
        );
      }

      if (filtro === "PROPERS") {
        if (
          ["FINALIZADO", "FINALITZAT", "CANCELADO", "CANCELAT"].includes(
            estado,
          ) ||
          partido.acta?.finalizada
        ) {
          return false;
        }

        return (
          !partido.fechaHora || Date.parse(partido.fechaHora) >= Date.now()
        );
      }

      return true;
    });
  }, [ordenados, filtro]);

  const realtimeConectado =
    estadoActas === "CONECTADO" && estadoDesignaciones === "CONECTADO";

  const rutaBase =
    `/perfil/voluntariat/${encodeURIComponent(torneoID)}` +
    `/${encodeURIComponent(edicionID)}`;

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-titulos">
            Els meus partits designats
          </h2>

          <p className="mt-1 text-sm text-neutral">
            {ordenados.length} partits · Ordenats per hora i jornada
          </p>
        </div>

        <button
          type="button"
          onClick={solicitarActualizacion}
          disabled={actualizando}
          className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-50"
        >
          {actualizando ? "Actualitzant..." : "Actualitzar"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral">
        <span className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeConectado ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {realtimeConectado
            ? "Actualització automàtica activa"
            : "Realtime no disponible o parcial"}
        </span>

        {ultimaActualizacion && (
          <span>
            Darrera actualització:{" "}
            {ultimaActualizacion.toLocaleTimeString("ca-ES", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "Europe/Madrid",
            })}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            onClick={() => setFiltro(opcion.id)}
            aria-pressed={filtro === opcion.id}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              filtro === opcion.id
                ? "bg-primary text-white"
                : "border border-border bg-card text-neutral hover:bg-primary/5"
            }`}
          >
            {opcion.nombre}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {cargando ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-neutral">
          Carregant les designacions...
        </div>
      ) : filtrados.length === 0 && !error ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <h3 className="font-bold text-neutral-titulos">
            No hi ha partits per mostrar
          </h3>
          <p className="mt-2 text-sm text-neutral">
            Quan tinguis designacions que coincideixin amb aquest filtre,
            apareixeran aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filtrados.map((partido) => {
            const accion = accionActa(partido);

            return (
              <article
                key={partido.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="flex-1 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary">
                      {partido.codigo ?? "Partit"}
                    </span>

                    <span className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold text-neutral">
                      {estadoPartido(partido)}
                    </span>
                  </div>

                  <h3 className="mt-3 text-lg font-bold text-neutral-titulos">
                    {partido.nombre || partido.codigo || "Partit"}
                  </h3>

                  <p className="mt-2 break-words text-sm font-medium text-neutral-titulos">
                    {partido.local}
                    <span className="mx-2 font-bold text-primary">—</span>
                    {partido.visitante}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {partido.funciones.map((funcion) => (
                      <span
                        key={funcion}
                        className="rounded-lg bg-secondary/10 px-2.5 py-1 text-xs font-semibold text-secondary"
                      >
                        {funcion === "ARBITRE" ? "Àrbitre" : "Oficial de taula"}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                    <div>
                      <p className="text-xs text-neutral">Data i hora</p>
                      <p className="mt-1 font-semibold text-neutral-titulos">
                        {fechaPartido(partido.fechaHora)}
                      </p>
                      {!partido.fechaHora && partido.jornada !== null && (
                        <p className="mt-1 text-xs text-primary">
                          Jornada {partido.jornada}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-neutral">Pista</p>
                      <p className="mt-1 font-semibold text-neutral-titulos">
                        {partido.pista || "Per determinar"}
                      </p>
                      {(partido.fase || partido.ronda) && (
                        <p className="mt-2 text-xs text-neutral">
                          {[partido.fase, partido.ronda]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-neutral">
                      Estat de l'acta:
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      {!partido.acta
                        ? "No iniciada"
                        : partido.acta.finalizada
                          ? "Finalitzada"
                          : partido.acta.bloqueada
                            ? "Bloquejada"
                            : partido.acta.estado === "EN_CURSO"
                              ? "En curs"
                              : "En preparació"}
                    </span>
                  </div>
                </div>

                <div className="border-t border-border bg-background/40 p-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a
                      href={`${rutaBase}/partits/${encodeURIComponent(partido.id)}`}
                      className="flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-3 py-2 text-sm font-semibold text-neutral-titulos hover:bg-primary/5"
                    >
                      Veure designació
                    </a>

                    {accion.disponible ? (
                      <a
                        href={`${rutaBase}/actes/${encodeURIComponent(partido.id)}`}
                        className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-white transition hover:opacity-90"
                      >
                        {accion.titulo}
                      </a>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex min-h-11 items-center justify-center rounded-xl bg-neutral/10 px-3 py-2 text-center text-sm font-semibold text-neutral/60"
                      >
                        {accion.titulo}
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
