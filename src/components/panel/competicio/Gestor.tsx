import Cargando from "@components/Cargando";

import { useCallback, useEffect, useState } from "react";

import Eliminatoria from "./Eliminatoria";
import FaseGrups from "./FaseGrups";
import Pistas from "./Pistas";

// ============================================================
// TIPOS
// ============================================================

type Seccion = "GRUPOS" | "ELIMINATORIA";

type EquipoCompeticion = {
  id: string;

  nombre: string;

  escudo: string | null;

  formulario_estado: string | null;

  validacion_estado: string | null;

  plaza_estado: string | null;

  elegible: boolean;

  competicion: {
    estado: string;

    seed: number | null;

    origen: string;
  } | null;
};

type Datos = {
  success: true;

  capacidades: {
    editar: boolean;
  };

  equipos: EquipoCompeticion[];
};

type Props = {
  torneoID: string;

  edicionID: string;
};

// ============================================================
// API
// ============================================================

const API = "/api/panell/competicio";

// ============================================================
// COMPONENTE
// ============================================================

export default function Gestor({ torneoID, edicionID }: Props) {
  const [seccion, setSeccion] = useState<Seccion>("GRUPOS");

  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  /*
   * Cada vez que cambian participantes o pistas,
   * incrementamos la versión.
   *
   * De esta manera FaseGrups / Eliminatoria
   * se vuelven a montar y consultan sus APIs.
   */
  const [version, setVersion] = useState(0);

  // ========================================================
  // CARGAR PARTICIPANTES
  // ========================================================

  const cargarParticipantes = useCallback(
    async (mostrarCarga = true) => {
      if (mostrarCarga) {
        setCargando(true);
      }

      setError("");

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(`${API}?${parametros.toString()}`, {
          credentials: "same-origin",

          cache: "no-store",
        });

        const json = await respuesta.json().catch(() => null);

        if (!respuesta.ok || json?.success !== true) {
          throw new Error(
            json?.mensaje ?? "No s'han pogut carregar els participants.",
          );
        }

        setDatos({
          success: true,

          capacidades: json.capacidades,

          equipos: json.equipos,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No s'han pogut carregar els participants.",
        );
      } finally {
        if (mostrarCarga) {
          setCargando(false);
        }
      }
    },
    [torneoID, edicionID],
  );

  useEffect(() => {
    void cargarParticipantes();
  }, [cargarParticipantes]);

  // ========================================================
  // PETICIONES PARTICIPANTES
  // ========================================================

  async function peticionParticipante(
    metodo: "POST" | "DELETE",

    cuerpo: Record<string, unknown>,
  ) {
    const respuesta = await fetch(API, {
      method: metodo,

      credentials: "same-origin",

      cache: "no-store",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        torneoID,
        edicionID,
        ...cuerpo,
      }),
    });

    const json = await respuesta.json().catch(() => null);

    if (!respuesta.ok || json?.success !== true) {
      throw new Error(json?.mensaje ?? "No s'ha pogut completar l'operació.");
    }

    return json;
  }

  // ========================================================
  // ACTIVAR EQUIPO
  // ========================================================

  async function activarEquipo(equipo: EquipoCompeticion) {
    setGuardando(true);

    setError("");
    setMensaje("");

    try {
      await peticionParticipante("POST", {
        accion: "activar_equipo",

        equipoID: equipo.id,
      });

      setMensaje(`${equipo.nombre} s'ha afegit a la competició.`);

      await cargarParticipantes(false);

      /*
       * Puede afectar a:
       * - equipos disponibles en grupos
       * - equipos disponibles en eliminatorias
       */
      setVersion((anterior) => anterior + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No s'ha pogut afegir l'equip.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // RETIRAR EQUIPO
  // ========================================================

  async function retirarEquipo(equipo: EquipoCompeticion) {
    const confirmar = window.confirm(
      `Vols retirar "${equipo.nombre}" de la competició?`,
    );

    if (!confirmar) {
      return;
    }

    setGuardando(true);

    setError("");
    setMensaje("");

    try {
      await peticionParticipante("DELETE", {
        accion: "retirar_equipo",

        equipoID: equipo.id,
      });

      setMensaje(`${equipo.nombre} s'ha retirat de la competició.`);

      await cargarParticipantes(false);

      setVersion((anterior) => anterior + 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No s'ha pogut retirar l'equip.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // CAMBIO DE PISTAS
  // ========================================================

  function pistasActualizadas() {
    /*
     * Eliminatoria vuelve a consultar su API y recibe
     * inmediatamente las nuevas pistas.
     *
     * También dejamos preparado FaseGrups para cuando
     * integramos la programación de sus partidos.
     */
    setVersion((anterior) => anterior + 1);
  }

  // ========================================================
  // DERIVADOS
  // ========================================================

  const equiposActivos =
    datos?.equipos.filter(
      (equipo) => equipo.competicion?.estado === "ACTIVO",
    ) ?? [];

  const equiposDisponibles =
    datos?.equipos.filter(
      (equipo) => equipo.elegible && equipo.competicion?.estado !== "ACTIVO",
    ) ?? [];

  const equiposNoDisponibles =
    datos?.equipos.filter(
      (equipo) => !equipo.elegible && equipo.competicion?.estado !== "ACTIVO",
    ) ?? [];

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Cargando />
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="flex w-full flex-col gap-5 p-4 pt-0">
      {/* =================================================
          MENSAJES GENERALES
      ================================================= */}

      {error && (
        <div className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-medium text-secondary">
          {mensaje}
        </div>
      )}

      {/* =================================================
          PARTICIPANTES
      ================================================= */}

      {datos && (
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          {/* CABECERA */}

          <div className="border-b border-border/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Participants
            </p>

            <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
              Equips de la competició
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral">
              Selecciona els equips que participen en aquesta edició. Els equips
              actius es podran assignar als grups i als encreuaments
              eliminatoris.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <EtiquetaResumen texto={`${equiposActivos.length} actius`} />

              <EtiquetaResumen
                texto={`${equiposDisponibles.length} disponibles`}
              />

              {equiposNoDisponibles.length > 0 && (
                <EtiquetaResumen
                  texto={`${equiposNoDisponibles.length} no disponibles`}
                />
              )}
            </div>
          </div>

          {/* EQUIPOS */}

          <div className="p-4">
            {datos.equipos.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {datos.equipos.map((equipo) => {
                  const activo = equipo.competicion?.estado === "ACTIVO";

                  return (
                    <article
                      key={equipo.id}
                      className={
                        activo
                          ? "flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3"
                          : "flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3"
                      }
                    >
                      <EquipoAvatar equipo={equipo} />

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-semibold text-neutral-titulos">
                            {equipo.nombre}
                          </p>

                          {activo && (
                            <span className="shrink-0 rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold text-secondary">
                              Actiu
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs text-neutral">
                          {activo
                            ? "Forma part de la competició"
                            : equipo.elegible
                              ? "Disponible per participar"
                              : "No compleix els requisits actuals"}
                        </p>
                      </div>

                      {datos.capacidades.editar && (
                        <>
                          {activo ? (
                            <button
                              type="button"
                              disabled={guardando}
                              onClick={() => void retirarEquipo(equipo)}
                              className="shrink-0 rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Retirar
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={guardando || !equipo.elegible}
                              onClick={() => void activarEquipo(equipo)}
                              className="shrink-0 rounded-lg border border-primary/40 px-3 py-2 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Afegir
                            </button>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
                <p className="font-semibold text-neutral-titulos">
                  No hi ha equips disponibles
                </p>

                <p className="mt-1 text-sm text-neutral">
                  Els equips apareixeran aquí quan hi hagi inscripcions
                  disponibles.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =================================================
          PISTAS DEL TORNEO
      ================================================= */}

      <Pistas torneoID={torneoID} onChange={pistasActualizadas} />

      {/* =================================================
          FORMAT DE COMPETICIÓ
      ================================================= */}

      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="border-b border-border/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Format
          </p>

          <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
            Format de competició
          </h2>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral">
            Configura les fases de grups i els quadres eliminatoris d'aquesta
            edició.
          </p>
        </div>

        {/* SELECTOR */}

        <div className="grid gap-2 p-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSeccion("GRUPOS")}
            className={
              seccion === "GRUPOS"
                ? "rounded-xl bg-primary px-4 py-3 text-left text-white"
                : "rounded-xl px-4 py-3 text-left text-neutral transition hover:bg-background"
            }
          >
            <div className="flex items-center gap-3">
              <IconoGrupos activo={seccion === "GRUPOS"} />

              <div>
                <span className="block text-sm font-bold">Fase de grups</span>

                <span
                  className={
                    seccion === "GRUPOS"
                      ? "mt-0.5 block text-xs font-normal text-white/75"
                      : "mt-0.5 block text-xs font-normal text-neutral"
                  }
                >
                  Grups, equips i classificació
                </span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSeccion("ELIMINATORIA")}
            className={
              seccion === "ELIMINATORIA"
                ? "rounded-xl bg-primary px-4 py-3 text-left text-white"
                : "rounded-xl px-4 py-3 text-left text-neutral transition hover:bg-background"
            }
          >
            <div className="flex items-center gap-3">
              <IconoBracket activo={seccion === "ELIMINATORIA"} />

              <div>
                <span className="block text-sm font-bold">Eliminatòria</span>

                <span
                  className={
                    seccion === "ELIMINATORIA"
                      ? "mt-0.5 block text-xs font-normal text-white/75"
                      : "mt-0.5 block text-xs font-normal text-neutral"
                  }
                >
                  Brackets i partits de consolació
                </span>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* =================================================
          MÓDULO SELECCIONADO
      ================================================= */}

      {seccion === "GRUPOS" ? (
        <FaseGrups
          key={`grups-${version}`}
          torneoID={torneoID}
          edicionID={edicionID}
        />
      ) : (
        <Eliminatoria
          key={`eliminatoria-${version}`}
          torneoID={torneoID}
          edicionID={edicionID}
        />
      )}
    </div>
  );
}

// ============================================================
// EQUIPO AVATAR
// ============================================================

function EquipoAvatar({ equipo }: { equipo: EquipoCompeticion }) {
  if (equipo.escudo) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
        <img
          src={equipo.escudo}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      </div>
    );
  }

  const inicial = equipo.nombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
      {inicial}
    </div>
  );
}

// ============================================================
// ETIQUETA RESUMEN
// ============================================================

function EtiquetaResumen({ texto }: { texto: string }) {
  return (
    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-neutral">
      {texto}
    </span>
  );
}

// ============================================================
// ICONO GRUPOS
// ============================================================

function IconoGrupos({ activo }: { activo: boolean }) {
  return (
    <div
      className={
        activo
          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"
          : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="8" cy="7" r="3" />

        <circle cx="16" cy="7" r="3" />

        <path d="M3 20c0-3 2-5 5-5s5 2 5 5" />

        <path d="M11 20c0-3 2-5 5-5s5 2 5 5" />
      </svg>
    </div>
  );
}

// ============================================================
// ICONO BRACKET
// ============================================================

function IconoBracket({ activo }: { activo: boolean }) {
  return (
    <div
      className={
        activo
          ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15"
          : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M4 4h5v4H4z" />

        <path d="M4 16h5v4H4z" />

        <path d="M15 10h5v4h-5z" />

        <path d="M9 6h3v6h3" />

        <path d="M9 18h3v-6" />
      </svg>
    </div>
  );
}
