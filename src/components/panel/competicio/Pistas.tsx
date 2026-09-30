import { useCallback, useEffect, useState } from "react";

import type { FormEvent } from "react";

type Pista = {
  id: string;
  torneo_id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  activa: boolean;
};

type Datos = {
  success: true;

  capacidades: {
    editar: boolean;
  };

  pistas: Pista[];
};

type Props = {
  torneoID: string;

  onChange?: () => void;
};

type BorradorPista = {
  nombre: string;
  descripcion: string;
  ubicacion: string;
  activa: boolean;
};

const API = "/api/panell/competicio/pistas";

const BORRADOR_VACIO: BorradorPista = {
  nombre: "",
  descripcion: "",
  ubicacion: "",
  activa: true,
};

export default function Pistas({ torneoID, onChange }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);

  const [pistaEditando, setPistaEditando] = useState<Pista | null>(null);

  const [borrador, setBorrador] = useState<BorradorPista>({
    ...BORRADOR_VACIO,
  });

  // ========================================================
  // CARGAR
  // ========================================================

  const cargar = useCallback(async () => {
    setCargando(true);

    setError("");

    try {
      const parametros = new URLSearchParams({
        torneoID,
      });

      const respuesta = await fetch(`${API}?${parametros.toString()}`, {
        credentials: "same-origin",

        cache: "no-store",
      });

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(json?.mensaje ?? "No s'han pogut carregar les pistes.");
      }

      setDatos(json as Datos);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'han pogut carregar les pistes.",
      );
    } finally {
      setCargando(false);
    }
  }, [torneoID]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ========================================================
  // MODAL
  // ========================================================

  function abrirNueva() {
    setPistaEditando(null);

    setBorrador({
      ...BORRADOR_VACIO,
    });

    setError("");

    setModalAbierto(true);
  }

  function abrirEditar(pista: Pista) {
    setPistaEditando(pista);

    setBorrador({
      nombre: pista.nombre,

      descripcion: pista.descripcion,

      ubicacion: pista.ubicacion,

      activa: pista.activa,
    });

    setError("");

    setModalAbierto(true);
  }

  function cerrarModal() {
    if (guardando) {
      return;
    }

    setModalAbierto(false);

    setPistaEditando(null);

    setBorrador({
      ...BORRADOR_VACIO,
    });
  }

  // ========================================================
  // GUARDAR
  // ========================================================

  async function guardar(evento: FormEvent) {
    evento.preventDefault();

    const nombre = borrador.nombre.trim();

    if (!nombre) {
      setError("El nom de la pista és obligatori.");

      return;
    }

    setGuardando(true);

    setError("");
    setMensaje("");

    try {
      const esEdicion = Boolean(pistaEditando);

      const respuesta = await fetch(API, {
        method: esEdicion ? "PATCH" : "POST",

        credentials: "same-origin",

        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          torneoID,

          ...(pistaEditando
            ? {
                pistaID: pistaEditando.id,
              }
            : {}),

          nombre,

          descripcion: borrador.descripcion.trim(),

          ubicacion: borrador.ubicacion.trim(),

          activa: borrador.activa,
        }),
      });

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(json?.mensaje ?? "No s'ha pogut guardar la pista.");
      }

      setMensaje(pistaEditando ? "Pista actualitzada." : "Pista creada.");

      cerrarModal();

      await cargar();

      onChange?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No s'ha pogut guardar la pista.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // ACTIVAR / DESACTIVAR
  // ========================================================

  async function cambiarEstado(pista: Pista) {
    setGuardando(true);

    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch(API, {
        method: "PATCH",

        credentials: "same-origin",

        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          torneoID,

          pistaID: pista.id,

          nombre: pista.nombre,

          descripcion: pista.descripcion,

          ubicacion: pista.ubicacion,

          activa: !pista.activa,
        }),
      });

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(json?.mensaje ?? "No s'ha pogut modificar la pista.");
      }

      setMensaje(pista.activa ? "Pista desactivada." : "Pista activada.");

      await cargar();

      onChange?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut modificar la pista.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <>
      <section className="rounded-2xl border border-border/50 bg-card">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Pistes
            </p>

            <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
              Pistes disponibles
            </h2>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral">
              Configura les pistes disponibles per a aquest torneig.
              S'utilitzaran per programar els partits de totes les edicions.
            </p>
          </div>

          {datos?.capacidades.editar && (
            <button
              type="button"
              onClick={abrirNueva}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              + Afegir pista
            </button>
          )}
        </div>

        <div className="p-4">
          {error && (
            <div className="mb-4 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="mb-4 rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-medium text-secondary">
              {mensaje}
            </div>
          )}

          {cargando ? (
            <div className="flex min-h-24 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-neutral">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                Carregant pistes...
              </div>
            </div>
          ) : datos && datos.pistas.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {datos.pistas.map((pista) => (
                <article
                  key={pista.id}
                  className={
                    pista.activa
                      ? "rounded-xl border border-border/50 bg-background/40 p-4"
                      : "rounded-xl border border-border/40 bg-background/20 p-4 opacity-60"
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-neutral-titulos">
                          {pista.nombre}
                        </h3>

                        <span
                          className={
                            pista.activa
                              ? "rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary"
                              : "rounded-full bg-neutral/10 px-2 py-0.5 text-[10px] font-semibold text-neutral"
                          }
                        >
                          {pista.activa ? "Activa" : "Inactiva"}
                        </span>
                      </div>

                      {pista.ubicacion && (
                        <p className="mt-2 text-xs font-medium text-neutral">
                          {pista.ubicacion}
                        </p>
                      )}
                    </div>
                  </div>

                  {pista.descripcion && (
                    <p className="mt-3 line-clamp-3 text-sm leading-5 text-neutral">
                      {pista.descripcion}
                    </p>
                  )}

                  {datos.capacidades.editar && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => abrirEditar(pista)}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => void cambiarEstado(pista)}
                        className={
                          pista.activa
                            ? "rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
                            : "rounded-lg border border-secondary/30 px-3 py-2 text-xs font-semibold text-secondary disabled:opacity-40"
                        }
                      >
                        {pista.activa ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center">
              <p className="font-semibold text-neutral-titulos">
                Encara no hi ha pistes configurades
              </p>

              <p className="mt-1 text-sm text-neutral">
                Afegeix les pistes que es podran seleccionar en programar els
                partits.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* =================================================
          MODAL
      ================================================= */}

      {modalAbierto && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={cerrarModal}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Pista
                </p>

                <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                  {pistaEditando ? "Editar pista" : "Nova pista"}
                </h2>
              </div>

              <button
                type="button"
                disabled={guardando}
                onClick={cerrarModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardar} className="flex flex-col gap-4 p-5">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Nom
                </span>

                <input
                  autoFocus
                  value={borrador.nombre}
                  disabled={guardando}
                  onChange={(evento) =>
                    setBorrador({
                      ...borrador,

                      nombre: evento.target.value,
                    })
                  }
                  placeholder="Pista 1"
                  className="rounded-lg border border-border bg-background px-3 py-2.5"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Ubicació
                </span>

                <input
                  value={borrador.ubicacion}
                  disabled={guardando}
                  onChange={(evento) =>
                    setBorrador({
                      ...borrador,

                      ubicacion: evento.target.value,
                    })
                  }
                  placeholder="Pavelló IES Calvià · Zona nord"
                  className="rounded-lg border border-border bg-background px-3 py-2.5"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Descripció
                </span>

                <textarea
                  rows={4}
                  value={borrador.descripcion}
                  disabled={guardando}
                  onChange={(evento) =>
                    setBorrador({
                      ...borrador,

                      descripcion: evento.target.value,
                    })
                  }
                  placeholder="Informació addicional sobre la pista..."
                  className="resize-none rounded-lg border border-border bg-background px-3 py-2.5"
                />
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3">
                <input
                  type="checkbox"
                  checked={borrador.activa}
                  disabled={guardando}
                  onChange={(evento) =>
                    setBorrador({
                      ...borrador,

                      activa: evento.target.checked,
                    })
                  }
                />

                <div>
                  <p className="text-sm font-semibold text-neutral-titulos">
                    Pista activa
                  </p>

                  <p className="text-xs text-neutral">
                    Les pistes inactives no es podran seleccionar en nous
                    partits.
                  </p>
                </div>
              </label>

              <div className="mt-2 flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={cerrarModal}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel·lar
                </button>

                <button
                  disabled={guardando}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {guardando ? "Guardant..." : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
