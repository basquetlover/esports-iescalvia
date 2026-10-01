import { useCallback, useEffect, useMemo, useState } from "react";

import Cargando from "@components/Cargando";

// ============================================================
// TIPOS
// ============================================================

type Equipo = {
  id: string;
  nombre: string;
};

type Participacion = {
  jugador: boolean;
  voluntario: boolean;
  equipos: Equipo[];
  voluntariados: string[];
};

type Alumno = {
  id: string;

  nombre: string;
  apellido1: string;
  apellido2: string;

  nombre_completo: string;

  email: string;

  curso: string;
  grupo: string;

  participacion: Participacion;
};

type Curso = {
  curso: string;

  total: number;

  alumnos: Alumno[];
};

type Resumen = {
  total: number;

  jugadores: number;

  voluntarios: number;

  ambos: number;

  cursos: number;
};

type Respuesta = {
  success: boolean;

  mensaje?: string;

  torneoID?: string;

  edicion?: {
    id: string;
    nombre: string | null;
  };

  resumen?: Resumen;

  cursos?: Curso[];
};

type Props = {
  torneoID: string;

  edicionID: string;
};

type FiltroParticipacion = "TODOS" | "JUGADORES" | "VOLUNTARIOS" | "AMBOS";

// ============================================================
// NORMALIZAR
// ============================================================

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ca")
    .trim();
}

// ============================================================
// FILTRO PARTICIPACIÓN
// ============================================================

function cumpleFiltro(
  alumno: Alumno,

  filtro: FiltroParticipacion,
) {
  switch (filtro) {
    case "JUGADORES":
      return alumno.participacion.jugador;

    case "VOLUNTARIOS":
      return alumno.participacion.voluntario;

    case "AMBOS":
      return alumno.participacion.jugador && alumno.participacion.voluntario;

    default:
      return true;
  }
}

// ============================================================
// BÚSQUEDA
// ============================================================

function coincideBusqueda(
  alumno: Alumno,

  busqueda: string,
) {
  if (!busqueda) {
    return true;
  }

  const valores = [
    alumno.nombre,
    alumno.apellido1,
    alumno.apellido2,
    alumno.nombre_completo,
    alumno.email,
    alumno.curso,
    alumno.grupo,

    ...alumno.participacion.equipos.map((equipo) => equipo.nombre),

    ...alumno.participacion.voluntariados,
  ];

  return valores.some((valor) => normalizar(valor).includes(busqueda));
}

// ============================================================
// TARJETA RESUMEN
// ============================================================

function TarjetaResumen({
  titulo,
  valor,
}: {
  titulo: string;

  valor: number;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral">
        {titulo}
      </p>

      <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-titulos">
        {valor}
      </p>
    </div>
  );
}

// ============================================================
// ETIQUETAS
// ============================================================

function EtiquetasParticipacion({ alumno }: { alumno: Alumno }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {alumno.participacion.jugador && (
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          Jugador
        </span>
      )}

      {alumno.participacion.voluntario && (
        <span className="inline-flex items-center rounded-full bg-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-secondary">
          Voluntari
        </span>
      )}
    </div>
  );
}

// ============================================================
// DETALLE PARTICIPACIÓN
// ============================================================

function DetallesParticipacion({ alumno }: { alumno: Alumno }) {
  const { equipos, voluntariados } = alumno.participacion;

  if (equipos.length === 0 && voluntariados.length === 0) {
    return <span className="text-sm text-neutral">—</span>;
  }

  return (
    <div className="space-y-1">
      {equipos.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
          <span className="font-semibold text-neutral-titulos">Equip:</span>

          <span className="text-neutral">
            {equipos.map((equipo) => equipo.nombre).join(", ")}
          </span>
        </div>
      )}

      {voluntariados.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-1 text-xs">
          <span className="font-semibold text-neutral-titulos">
            Voluntariat:
          </span>

          <span className="text-neutral">{voluntariados.join(", ")}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// FILA ESCRITORIO
// ============================================================

function FilaAlumno({ alumno }: { alumno: Alumno }) {
  return (
    <tr className="border-t border-border/40 transition hover:bg-primary/[0.025]">
      <td className="px-4 py-3.5 align-top">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-titulos">
            {alumno.nombre_completo}
          </p>

          {alumno.email && (
            <p className="mt-0.5 break-all text-xs text-neutral">
              {alumno.email}
            </p>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5 align-top">
        <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-background px-2 py-1 text-xs font-semibold text-neutral-titulos">
          {alumno.grupo || "—"}
        </span>
      </td>

      <td className="px-4 py-3.5 align-top">
        <EtiquetasParticipacion alumno={alumno} />
      </td>

      <td className="px-4 py-3.5 align-top">
        <DetallesParticipacion alumno={alumno} />
      </td>
    </tr>
  );
}

// ============================================================
// TARJETA MÓVIL
// ============================================================

function TarjetaAlumno({ alumno }: { alumno: Alumno }) {
  return (
    <article className="rounded-xl border border-border/50 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-neutral-titulos">
            {alumno.nombre_completo}
          </h3>

          {alumno.email && (
            <p className="mt-1 break-all text-xs text-neutral">
              {alumno.email}
            </p>
          )}
        </div>

        {alumno.grupo && (
          <span className="shrink-0 rounded-md bg-card px-2 py-1 text-xs font-semibold text-neutral-titulos">
            Grup {alumno.grupo}
          </span>
        )}
      </div>

      <div className="mt-3">
        <EtiquetasParticipacion alumno={alumno} />
      </div>

      <div className="mt-3 border-t border-border/40 pt-3">
        <DetallesParticipacion alumno={alumno} />
      </div>
    </article>
  );
}

// ============================================================
// TABLA DEL CURSO
// ============================================================

function TablaCurso({ curso }: { curso: Curso }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      {/* CABECERA */}

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-primary/[0.035] px-4 py-4 md:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />

              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
          </span>

          <div>
            <h2 className="text-lg font-bold tracking-tight text-neutral-titulos">
              {curso.curso}
            </h2>

            <p className="mt-0.5 text-xs text-neutral">
              {curso.total}{" "}
              {curso.total === 1
                ? "alumne participant"
                : "alumnes participants"}
            </p>
          </div>
        </div>

        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {curso.total}
        </span>
      </div>

      {/* ESCRITORIO */}

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-[0.07em] text-neutral">
              <th className="px-4 py-3">Alumne</th>

              <th className="w-24 px-4 py-3">Grup</th>

              <th className="w-48 px-4 py-3">Participació</th>

              <th className="w-[32%] px-4 py-3">Detall</th>
            </tr>
          </thead>

          <tbody>
            {curso.alumnos.map((alumno) => (
              <FilaAlumno key={alumno.id} alumno={alumno} />
            ))}
          </tbody>
        </table>
      </div>

      {/* MÓVIL */}

      <div className="space-y-3 p-3 md:hidden">
        {curso.alumnos.map((alumno) => (
          <TarjetaAlumno key={alumno.id} alumno={alumno} />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Lista({ torneoID, edicionID }: Props) {
  // ========================================================
  // ESTADO
  // ========================================================

  const [datos, setDatos] = useState<Respuesta | null>(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState("");

  const [filtro, setFiltro] = useState<FiltroParticipacion>("TODOS");

  const [cursoSeleccionado, setCursoSeleccionado] = useState<string>("");

  // ========================================================
  // CARGAR
  // ========================================================

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);

      setError("");

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(
          `/api/panell/alumnes?${parametros.toString()}`,
          {
            credentials: "same-origin",

            cache: "no-store",

            signal,
          },
        );

        const contenido: Respuesta = await respuesta.json();

        if (!respuesta.ok || !contenido.success) {
          throw new Error(
            contenido.mensaje ||
              "No s'ha pogut carregar l'alumnat participant.",
          );
        }

        if (signal?.aborted) {
          return;
        }

        setDatos(contenido);

        /*
         * Si todavía no hay ningún curso seleccionado,
         * seleccionamos automáticamente el primero.
         */

        setCursoSeleccionado((actual) => {
          if (
            actual &&
            contenido.cursos?.some((curso) => curso.curso === actual)
          ) {
            return actual;
          }

          return contenido.cursos?.[0]?.curso ?? "";
        });
      } catch (causa) {
        if (signal?.aborted) {
          return;
        }

        setError(
          causa instanceof Error
            ? causa.message
            : "No s'ha pogut carregar l'alumnat participant.",
        );
      } finally {
        if (!signal?.aborted) {
          setCargando(false);
        }
      }
    },
    [torneoID, edicionID],
  );

  // ========================================================
  // USE EFFECT
  // ========================================================

  useEffect(() => {
    const controlador = new AbortController();

    void cargar(controlador.signal);

    return () => controlador.abort();
  }, [cargar]);

  // ========================================================
  // CURSO ACTUAL ORIGINAL
  // ========================================================

  const cursoActual = useMemo(() => {
    return (
      (datos?.cursos ?? []).find(
        (curso) => curso.curso === cursoSeleccionado,
      ) ?? null
    );
  }, [datos, cursoSeleccionado]);

  // ========================================================
  // FILTRAR ALUMNOS DEL CURSO ACTUAL
  // ========================================================

  const alumnosFiltrados = useMemo(() => {
    if (!cursoActual) {
      return [];
    }

    const consulta = normalizar(busqueda);

    return cursoActual.alumnos.filter(
      (alumno) =>
        cumpleFiltro(alumno, filtro) && coincideBusqueda(alumno, consulta),
    );
  }, [cursoActual, busqueda, filtro]);

  // ========================================================
  // CURSO VISIBLE
  // ========================================================

  const cursoVisible: Curso | null = cursoActual
    ? {
        ...cursoActual,

        total: alumnosFiltrados.length,

        alumnos: alumnosFiltrados,
      }
    : null;

  // ========================================================
  // RENDER CARGA
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="w-full px-4 py-14">
        <Cargando />
      </div>
    );
  }

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <section className="w-full px-4 pb-10" aria-label="Alumnat participant">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        {/* ERROR */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error"
          >
            {error}
          </div>
        )}

        {/* RESUMEN GENERAL */}

        {datos?.resumen && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <TarjetaResumen titulo="Alumnes" valor={datos.resumen.total} />

            <TarjetaResumen titulo="Jugadors" valor={datos.resumen.jugadores} />

            <TarjetaResumen
              titulo="Voluntaris"
              valor={datos.resumen.voluntarios}
            />

            <TarjetaResumen
              titulo="Ambdues coses"
              valor={datos.resumen.ambos}
            />

            <TarjetaResumen titulo="Cursos" valor={datos.resumen.cursos} />
          </div>
        )}

        {/* ==================================================
                    MENÚ SUPERIOR DE CURSOS
                ================================================== */}

        {(datos?.cursos ?? []).length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
            <div className="border-b border-border/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral">
                Selecciona un curs
              </p>
            </div>

            <nav className="overflow-x-auto" aria-label="Cursos">
              <div className="flex min-w-max px-2">
                {(datos?.cursos ?? []).map((curso) => {
                  const activo = curso.curso === cursoSeleccionado;

                  return (
                    <button
                      key={curso.curso}
                      type="button"
                      onClick={() => {
                        setCursoSeleccionado(curso.curso);

                        setBusqueda("");

                        setFiltro("TODOS");
                      }}
                      aria-current={activo ? "page" : undefined}
                      className={[
                        "relative flex items-center gap-2 whitespace-nowrap px-4 py-3.5 text-sm font-semibold transition-colors",

                        activo
                          ? "text-primary"
                          : "text-neutral hover:text-neutral-titulos",
                      ].join(" ")}
                    >
                      <span>{curso.curso}</span>

                      <span
                        className={[
                          "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",

                          activo
                            ? "bg-primary/10 text-primary"
                            : "bg-background text-neutral",
                        ].join(" ")}
                      >
                        {curso.total}
                      </span>

                      {activo && (
                        <span
                          className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>
        )}

        {/* FILTROS DEL CURSO SELECCIONADO */}

        {cursoActual && (
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                {cursoActual.curso}
              </p>

              <p className="mt-1 text-sm text-neutral">
                {cursoActual.total}{" "}
                {cursoActual.total === 1
                  ? "alumne en aquest curs"
                  : "alumnes en aquest curs"}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px]">
              <label className="block">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Cercar alumne
                </span>

                <div className="relative mt-1.5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="11" cy="11" r="8" />

                    <path d="m21 21-4.3-4.3" />
                  </svg>

                  <input
                    type="search"
                    value={busqueda}
                    onChange={(evento) => setBusqueda(evento.target.value)}
                    placeholder={`Cercar dins ${cursoActual.curso}...`}
                    className="block w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Participació
                </span>

                <select
                  value={filtro}
                  onChange={(evento) =>
                    setFiltro(evento.target.value as FiltroParticipacion)
                  }
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                >
                  <option value="TODOS">Tots</option>

                  <option value="JUGADORES">Jugadors</option>

                  <option value="VOLUNTARIOS">Voluntaris</option>

                  <option value="AMBOS">Jugadors i voluntaris</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
              <p className="text-xs text-neutral">
                {alumnosFiltrados.length}{" "}
                {alumnosFiltrados.length === 1
                  ? "alumne visible"
                  : "alumnes visibles"}
              </p>

              {(busqueda || filtro !== "TODOS") && (
                <button
                  type="button"
                  onClick={() => {
                    setBusqueda("");

                    setFiltro("TODOS");
                  }}
                  className="text-xs font-semibold text-primary transition hover:opacity-70"
                >
                  Netejar filtres
                </button>
              )}
            </div>
          </div>
        )}

        {/* SIN CURSOS */}

        {!cargando && (datos?.cursos ?? []).length === 0 && (
          <div className="rounded-2xl border border-border/50 bg-card px-6 py-14 text-center shadow-sm">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="9" cy="8" r="3" />

                <path d="M3 21v-3a6 6 0 0 1 12 0v3" />

                <path d="M16 5a3 3 0 0 1 0 6" />

                <path d="M17 15a5 5 0 0 1 4 5v1" />
              </svg>
            </span>

            <h2 className="mt-4 font-bold text-neutral-titulos">
              No hi ha alumnes
            </h2>

            <p className="mx-auto mt-1 max-w-md text-sm text-neutral">
              Encara no hi ha alumnes amb una plaça confirmada en aquesta
              edició.
            </p>
          </div>
        )}

        {/* SIN RESULTADOS EN EL CURSO */}

        {cursoActual && cursoVisible && cursoVisible.alumnos.length === 0 && (
          <div className="rounded-2xl border border-border/50 bg-card px-6 py-12 text-center shadow-sm">
            <h2 className="font-bold text-neutral-titulos">
              Cap alumne coincideix
            </h2>

            <p className="mt-1 text-sm text-neutral">
              No hi ha cap alumne de <strong>{cursoActual.curso}</strong> que
              coincideixi amb els filtres seleccionats.
            </p>
          </div>
        )}

        {/* TABLA CURSO SELECCIONADO */}

        {cursoVisible && cursoVisible.alumnos.length > 0 && (
          <TablaCurso curso={cursoVisible} />
        )}
      </div>
    </section>
  );
}
