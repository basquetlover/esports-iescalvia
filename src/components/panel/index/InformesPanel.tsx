import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPortal } from "react-dom";

type Informe = {
  id: string;
  torneoID: string;
  edicionID: string;
  partidoID: string;
  visibilidad: "INTERNO" | "PUBLICO";
  motivo: "GENERAL" | "SUSPENSION";
  contenido: string;
  autorNombre: string | null;
  equipoResponsableNombre: string | null;
  creadoAt: string;
  torneoNombre: string;
  edicionNombre: string;
  partidoNombre: string;
  puedeEliminar: boolean;
};

type Props = {
  torneoID?: string | null;
  edicionID?: string | null;
};

type Respuesta = {
  success?: boolean;
  informes?: Informe[];
  hasMore?: boolean;
  siguienteOffset?: number;
  mensaje?: string;
};

const RUTA = "/api/panell/acta/informes-resumen";

function fecha(valor: string): string {
  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return "Data desconeguda";
  }

  return date.toLocaleString("ca-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

export default function InformesPanel({
  torneoID = null,
  edicionID = null,
}: Props) {
  const [informes, setInformes] = useState<Informe[]>([]);
  const [cargando, setCargando] = useState(true);
  const [autorizado, setAutorizado] = useState(true);
  const [error, setError] = useState("");

  const [expandido, setExpandido] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroVisibilidad, setFiltroVisibilidad] = useState("TODOS");
  const [filtroTorneo, setFiltroTorneo] = useState("TODOS");
  const [filtroEdicion, setFiltroEdicion] = useState("TODOS");

  const [detalleID, setDetalleID] = useState<string | null>(null);
  const [informeEliminar, setInformeEliminar] = useState<Informe | null>(null);
  const [contrasena, setContrasena] = useState("");
  const [errorEliminar, setErrorEliminar] = useState("");
  const [eliminando, setEliminando] = useState(false);

  const solicitud = useRef<AbortController | null>(null);

  const cargar = useCallback(
    async (todos: boolean) => {
      solicitud.current?.abort();

      const controlador = new AbortController();
      solicitud.current = controlador;

      setCargando(true);
      setError("");
      setAutorizado(true);
      setInformes([]);

      try {
        const acumulados: Informe[] = [];
        let offset = 0;
        let mas = true;

        while (mas && !controlador.signal.aborted) {
          const parametros = new URLSearchParams({
            offset: String(offset),
            limit: String(todos ? 100 : 6),
          });

          if (torneoID) {
            parametros.set("torneoID", torneoID);
          }

          if (torneoID && edicionID) {
            parametros.set("edicionID", edicionID);
          }

          const respuesta = await fetch(`${RUTA}?${parametros.toString()}`, {
            credentials: "same-origin",
            cache: "no-store",
            signal: controlador.signal,
          });

          const datos = (await respuesta
            .json()
            .catch(() => null)) as Respuesta | null;

          if (
            !respuesta.ok ||
            datos?.success !== true ||
            !Array.isArray(datos.informes)
          ) {
            if (respuesta.status === 403) {
              setAutorizado(false);
            }

            throw new Error(
              datos?.mensaje ?? "No s'han pogut carregar els informes.",
            );
          }

          if (controlador.signal.aborted) return;

          acumulados.push(...datos.informes);
          setInformes([...acumulados]);

          mas = todos && datos.hasMore === true;

          const siguiente =
            datos.siguienteOffset ?? offset + datos.informes.length;

          if (mas && siguiente <= offset) {
            throw new Error("S'ha produït un error de paginació.");
          }

          offset = siguiente;
        }
      } catch (fallo) {
        if (!controlador.signal.aborted) {
          setError(
            fallo instanceof Error ? fallo.message : "Error de connexió.",
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    },
    [torneoID, edicionID],
  );

  useEffect(() => {
    setExpandido(false);
    setBusqueda("");
    setFiltroVisibilidad("TODOS");
    setFiltroTorneo("TODOS");
    setFiltroEdicion("TODOS");
    setDetalleID(null);

    void cargar(false);

    return () => {
      solicitud.current?.abort();
    };
  }, [cargar]);

  const torneos = useMemo(() => {
    return [
      ...new Map(informes.map((i) => [i.torneoID, i.torneoNombre])).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1], "ca"));
  }, [informes]);

  const ediciones = useMemo(() => {
    const base = informes.filter(
      (i) => filtroTorneo === "TODOS" || i.torneoID === filtroTorneo,
    );

    return [
      ...new Map(base.map((i) => [i.edicionID, i.edicionNombre])).entries(),
    ].sort((a, b) => a[1].localeCompare(b[1], "ca"));
  }, [informes, filtroTorneo]);

  const visibles = useMemo(() => {
    if (!expandido) return informes;

    const termino = busqueda.trim().toLocaleLowerCase("ca-ES");

    return informes.filter((informe) => {
      if (filtroTorneo !== "TODOS" && informe.torneoID !== filtroTorneo) {
        return false;
      }

      if (filtroEdicion !== "TODOS" && informe.edicionID !== filtroEdicion) {
        return false;
      }

      if (
        filtroVisibilidad !== "TODOS" &&
        informe.visibilidad !== filtroVisibilidad
      ) {
        return false;
      }

      if (!termino) return true;

      return [
        informe.partidoNombre,
        informe.torneoNombre,
        informe.edicionNombre,
        informe.contenido,
        informe.autorNombre,
        informe.equipoResponsableNombre,
      ].some((texto) => texto?.toLocaleLowerCase("ca-ES").includes(termino));
    });
  }, [
    informes,
    expandido,
    busqueda,
    filtroTorneo,
    filtroEdicion,
    filtroVisibilidad,
  ]);

  function cerrarEliminar() {
    if (eliminando) return;

    setInformeEliminar(null);
    setContrasena("");
    setErrorEliminar("");
  }

  async function confirmarEliminar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!informeEliminar || !contrasena || eliminando) {
      return;
    }

    setEliminando(true);
    setErrorEliminar("");

    try {
      const respuesta = await fetch(RUTA, {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          informeID: informeEliminar.id,
          contrasena,
        }),
      });

      const datos = (await respuesta
        .json()
        .catch(() => null)) as Respuesta | null;

      if (!respuesta.ok || datos?.success !== true) {
        throw new Error(datos?.mensaje ?? "No s'ha pogut eliminar l'informe.");
      }

      setInformeEliminar(null);
      setContrasena("");
      setDetalleID(null);

      await cargar(expandido);
    } catch (fallo) {
      setErrorEliminar(
        fallo instanceof Error ? fallo.message : "Error de connexió.",
      );
    } finally {
      setEliminando(false);
    }
  }

  if (!autorizado) return null;

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="text-lg font-bold text-neutral-titulos">
            {edicionID
              ? "Informes de l'edició"
              : torneoID
                ? "Informes del torneig"
                : "Informes dels partits"}
          </h2>

          <p className="mt-1 text-sm text-neutral">
            {edicionID
              ? "Informes públics i interns d'aquesta edició."
              : torneoID
                ? "Informes públics i interns de les edicions d'aquest torneig."
                : "Informes dels tornejos i edicions que tens permís per consultar."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cargando}
            onClick={() => void cargar(expandido)}
            className="rounded-lg border border-border px-3 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:opacity-50"
          >
            Actualitzar
          </button>

          <button
            type="button"
            disabled={cargando}
            onClick={() => {
              setExpandido(!expandido);
              void cargar(!expandido);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {expandido ? "Mostrar resum" : "Veure tots"}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="grid gap-3 border-b border-border bg-background/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <input
            type="search"
            aria-label="Cercar informes"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Cercar informes..."
            className="min-w-0 rounded-lg border border-border bg-card p-3 text-sm text-neutral-titulos"
          />

          <select
            aria-label="Filtrar per visibilitat"
            value={filtroVisibilidad}
            onChange={(e) => setFiltroVisibilidad(e.target.value)}
            className="min-w-0 rounded-lg border border-border bg-card p-3 text-sm text-neutral-titulos"
          >
            <option value="TODOS">Totes les visibilitats</option>
            <option value="PUBLICO">Públics</option>
            <option value="INTERNO">Interns</option>
          </select>

          {!torneoID && (
            <select
              aria-label="Filtrar per torneig"
              value={filtroTorneo}
              onChange={(e) => {
                setFiltroTorneo(e.target.value);
                setFiltroEdicion("TODOS");
              }}
              className="min-w-0 rounded-lg border border-border bg-card p-3 text-sm text-neutral-titulos"
            >
              <option value="TODOS">Tots els tornejos</option>
              {torneos.map(([id, nom]) => (
                <option key={id} value={id}>
                  {nom}
                </option>
              ))}
            </select>
          )}

          {!edicionID && (
            <select
              aria-label="Filtrar per edició"
              value={filtroEdicion}
              onChange={(e) => setFiltroEdicion(e.target.value)}
              className="min-w-0 rounded-lg border border-border bg-card p-3 text-sm text-neutral-titulos"
            >
              <option value="TODOS">Totes les edicions</option>
              {ediciones.map(([id, nom]) => (
                <option key={id} value={id}>
                  {nom}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {error && autorizado && (
        <p
          role="alert"
          className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {cargando && (
        <p role="status" className="p-4 text-sm text-neutral">
          Carregant informes... ({informes.length})
        </p>
      )}

      {!cargando && !error && visibles.length === 0 && (
        <p className="p-5 text-sm text-neutral">
          No hi ha informes per mostrar.
        </p>
      )}

      <div
        className={
          expandido
            ? "max-h-[70vh] divide-y divide-border overflow-y-auto"
            : "divide-y divide-border"
        }
      >
        {visibles.map((informe) => (
          <article key={informe.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-neutral-titulos">
                  {informe.partidoNombre}
                </p>

                <p className="mt-1 text-xs text-neutral">
                  {informe.torneoNombre} · {informe.edicionNombre}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-lg bg-background px-2 py-1 text-neutral-titulos">
                  {informe.visibilidad === "INTERNO" ? "Intern" : "Públic"}
                </span>

                <span className="rounded-lg bg-background px-2 py-1 text-neutral-titulos">
                  {informe.motivo === "SUSPENSION" ? "Suspensió" : "General"}
                </span>
              </div>
            </div>

            <p
              className={`mt-3 whitespace-pre-wrap break-words text-sm leading-6 ${
                detalleID === informe.id
                  ? "text-neutral-titulos"
                  : "line-clamp-2 text-neutral"
              }`}
            >
              {informe.contenido}
            </p>

            {detalleID === informe.id && informe.equipoResponsableNombre && (
              <p className="mt-2 text-xs text-neutral">
                Equip responsable: {informe.equipoResponsableNombre}
              </p>
            )}

            <p className="mt-2 text-xs text-neutral">
              {fecha(informe.creadoAt)}
              {informe.autorNombre ? ` · ${informe.autorNombre}` : ""}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {/* LLEGIR INFORME */}
              <button
                type="button"
                onClick={() =>
                  setDetalleID(detalleID === informe.id ? null : informe.id)
                }
                className="group inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-xs font-semibold text-neutral-titulos transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:text-primary active:scale-[0.98]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                  aria-hidden="true"
                >
                  {detalleID === informe.id ? (
                    <path d="m18 15-6-6-6 6" />
                  ) : (
                    <>
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>

                <span>
                  {detalleID === informe.id
                    ? "Mostrar menys"
                    : "Llegir informe"}
                </span>
              </button>

              {/* OBRIR ACTA */}
              <a
                href={`/panell/partits/${encodeURIComponent(
                  informe.partidoID,
                )}/acta?torneoID=${encodeURIComponent(
                  informe.torneoID,
                )}&edicionID=${encodeURIComponent(informe.edicionID)}`}
                className="group inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/40 hover:bg-primary/15 active:scale-[0.98]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8" />
                  <path d="M8 17h5" />
                </svg>

                <span>Obrir acta</span>
              </a>

              {/* ELIMINAR INFORME */}
              {informe.puedeEliminar && (
                <button
                  type="button"
                  onClick={() => {
                    setInformeEliminar(informe);
                    setContrasena("");
                    setErrorEliminar("");
                  }}
                  className="group inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 text-xs font-semibold text-red-600 transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-700 active:scale-[0.98] sm:ml-auto"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="shrink-0 transition-transform duration-200 group-hover:scale-110"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 10v6" />
                    <path d="M14 10v6" />
                  </svg>

                  <span>Eliminar</span>
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      {expandido && (
        <p className="border-t border-border p-4 text-center text-xs text-neutral">
          {cargando
            ? "Recuperant la llista completa..."
            : `${visibles.length} informes visibles · ${informes.length} carregats`}
        </p>
      )}

      {informeEliminar &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                cerrarEliminar();
              }
            }}
          >
            <form
              role="dialog"
              aria-modal="true"
              aria-labelledby="eliminar-informe-titol"
              onSubmit={(e) => void confirmarEliminar(e)}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <h3
                id="eliminar-informe-titol"
                className="text-lg font-bold text-neutral-titulos"
              >
                Eliminar informe
              </h3>

              <p className="mt-2 text-sm text-neutral">
                Vols eliminar definitivament l'informe del partit{" "}
                <strong>{informeEliminar.partidoNombre}</strong>? Aquesta acció
                no es pot desfer.
              </p>

              <label className="mt-5 block text-sm font-semibold text-neutral-titulos">
                Contrasenya del teu compte
                <input
                  type="password"
                  required
                  autoFocus
                  value={contrasena}
                  maxLength={4096}
                  autoComplete="current-password"
                  disabled={eliminando}
                  onChange={(e) => setContrasena(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm text-neutral-titulos"
                />
              </label>

              {errorEliminar && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {errorEliminar}
                </p>
              )}

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={eliminando}
                  onClick={cerrarEliminar}
                  className="rounded-xl border border-border px-4 py-2 text-sm text-neutral-titulos"
                >
                  Cancel·lar
                </button>

                <button
                  type="submit"
                  disabled={eliminando || !contrasena}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {eliminando ? "Eliminant..." : "Confirmar i eliminar"}
                </button>
              </div>
            </form>
          </div>,
          document.body,
        )}
    </section>
  );
}
