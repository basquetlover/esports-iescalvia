import { useCallback, useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import { useRealtimeBroadcast } from "@components/realtime/SupabaseRealtime";

import ActaFutbol from "@components/panel/acta/futbol/ActaFutbol";

import ActaVoleibol from "@components/panel/acta/voleibol/ActaVoleibol";

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

type Jugador = {
  id: string;
  equipo_id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  tipo_participante: string | null;
  validacion_estado: string | null;
  orden: number | null;
  activo: boolean | null;
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

type Partido = {
  id: string;
  codigo: string;
  nombre: string | null;
  jornada: number | null;
  estado: string;
  fecha_hora: string | null;
  pista: string | null;
};

type Estructura = {
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

type Acta = {
  id: string;
  partido_id: string;
  estado: string;
  estado_operativo: string;
  version: number;
  controlador_id: string | null;
  control_generacion: number;
  bloqueada_at: string | null;
  motivo_bloqueo: string | null;
  configuracion_snapshot: Record<string, unknown> | null;
};

type Control = {
  puedeEditar: boolean;
  puedeEscribir: boolean;
  puedeSolicitarControl?: boolean;
  esControlador: boolean;
  controlToken: string | null;
};

type DatosActa = {
  success: true;

  torneo: {
    id: string;
    nombre: string | null;
    deporte: string | null;
    logo: string | null;
  };

  edicion: {
    id: string;
    nombre: string | null;
  };

  partido: Partido;
  estructura: Estructura;

  equipos: {
    local: Lado;
    visitante: Lado;
  };

  acta: Acta | null;
  control: Control;
};

type RespuestaInicio = {
  success: true;
  iniciado: true;
  reutilizado: boolean;
  acta: Acta;
  control: Control;
};

type RespuestaError = {
  success?: boolean;
  mensaje?: string;
};

// ============================================================
// CONFIGURACIÓN
// ============================================================

const INTERVALO_CONTROL_MS = 6000;

// ============================================================
// UTILIDADES
// ============================================================

function normalizarDeporte(valor: string | null): string {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? ""
  );
}

async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  const contenido: unknown = await respuesta.json().catch(() => null);

  if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) {
    throw new Error("La resposta del servidor no és vàlida.");
  }

  const registro = contenido as RespuestaError;

  if (!respuesta.ok || registro.success !== true) {
    throw new Error(registro.mensaje ?? "No s'ha pogut carregar l'acta.");
  }

  return contenido as T;
}

function mateixEstat(anterior: DatosActa, siguiente: DatosActa): boolean {
  return (
    anterior.acta?.id === siguiente.acta?.id &&
    anterior.acta?.version === siguiente.acta?.version &&
    anterior.acta?.estado === siguiente.acta?.estado &&
    anterior.acta?.estado_operativo === siguiente.acta?.estado_operativo &&
    anterior.acta?.bloqueada_at === siguiente.acta?.bloqueada_at &&
    anterior.acta?.motivo_bloqueo === siguiente.acta?.motivo_bloqueo &&
    anterior.control?.puedeEscribir === siguiente.control?.puedeEscribir &&
    anterior.control?.esControlador === siguiente.control?.esControlador &&
    anterior.control?.controlToken === siguiente.control?.controlToken &&
    anterior.partido.estado === siguiente.partido.estado &&
    anterior.equipos.local.equipo?.id === siguiente.equipos.local.equipo?.id &&
    anterior.equipos.visitante.equipo?.id ===
      siguiente.equipos.visitante.equipo?.id
  );
}

function estaBloqueada(acta: Acta | null): boolean {
  return Boolean(
    acta &&
    (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null),
  );
}

// ============================================================
// GESTOR EXCLUSIVO DEL PERFIL
// ============================================================

export default function GestorAmbBloqueig({
  torneoID,
  edicionID,
  partidoID,
}: Props) {
  const [montado, setMontado] = useState(false);

  const [datos, setDatos] = useState<DatosActa | null>(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState("");

  const [revision, setRevision] = useState(0);

  const [pantallaNativa, setPantallaNativa] = useState(false);

  const [iniciando, setIniciando] = useState(false);

  const [errorAccion, setErrorAccion] = useState("");

  const contenidoRef = useRef<HTMLDivElement>(null);

  const bloqueoAnteriorRef = useRef<boolean | null>(null);

  // ==========================================================
  // RUTAS
  // ==========================================================

  const parametros = new URLSearchParams({
    torneoID,
    edicionID,
    partidoID,
  }).toString();

  const urlDatos = `/api/panell/acta?${parametros}`;

  const urlInicio = `/api/panell/acta/iniciar?${parametros}`;

  const rutaPortada =
    `/perfil/voluntariat/${encodeURIComponent(torneoID)}` +
    `/${encodeURIComponent(edicionID)}` +
    `/actes/${encodeURIComponent(partidoID)}`;

  // ==========================================================
  // ACTUALIZACIÓN
  // ==========================================================

  const actualizar = useCallback(() => {
    setRevision((actual) => actual + 1);
  }, []);

  // ==========================================================
  // REALTIME
  // ==========================================================

  const realtimeEstado = useRealtimeBroadcast({
    canal: `acta-estat-partit-${partidoID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  const realtimeJugadas = useRealtimeBroadcast({
    canal: `acta-jugades-partit-${partidoID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  const realtimeEdicion = useRealtimeBroadcast({
    canal: `actes-actives-edicio-${edicionID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  const realtimeConectado =
    realtimeEstado === "CONECTADO" &&
    realtimeJugadas === "CONECTADO" &&
    realtimeEdicion === "CONECTADO";

  // ==========================================================
  // PANTALLA COMPLETA VISUAL
  // ==========================================================

  useEffect(() => {
    const overflowHTML = document.documentElement.style.overflow;

    const overflowBody = document.body.style.overflow;

    document.documentElement.style.overflow = "hidden";

    document.body.style.overflow = "hidden";

    setMontado(true);

    return () => {
      document.documentElement.style.overflow = overflowHTML;

      document.body.style.overflow = overflowBody;
    };
  }, []);

  // ==========================================================
  // PANTALLA COMPLETA NATIVA
  // ==========================================================

  useEffect(() => {
    if (!montado) return;

    const sincronizar = () => {
      setPantallaNativa(
        document.fullscreenElement === document.documentElement,
      );
    };

    document.addEventListener("fullscreenchange", sincronizar);

    // Algunos navegadores permiten solicitar
    // fullscreen al abrir el gestor.
    //
    // Si lo rechazan, el portal continúa
    // ocupando todo el viewport mediante CSS.

    if (
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      void document.documentElement.requestFullscreen().catch(() => {});
    }

    sincronizar();

    return () => {
      document.removeEventListener("fullscreenchange", sincronizar);
    };
  }, [montado]);

  const activarPantallaNativa = useCallback(async () => {
    if (
      document.fullscreenElement ||
      !document.documentElement.requestFullscreen
    ) {
      return;
    }

    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Continúa el modo visual a
      // pantalla completa.
    }
  }, []);

  // ==========================================================
  // CONSULTAR DATOS OFICIALES
  // ==========================================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarDatos() {
      try {
        const respuesta = await fetch(urlDatos, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        });

        const nuevosDatos = await leerRespuesta<DatosActa>(respuesta);

        if (controlador.signal.aborted) {
          return;
        }

        // El editor deportivo NO se desmonta
        // en una actualización normal.
        //
        // Conservamos su estado React y
        // sus jugadas locales pendientes.

        setDatos((anteriores) => {
          if (anteriores && mateixEstat(anteriores, nuevosDatos)) {
            return anteriores;
          }

          return nuevosDatos;
        });

        setError("");
      } catch (fallo) {
        if (controlador.signal.aborted) {
          return;
        }

        // No descartamos los datos anteriores.
        // Si el servidor no puede verificarse,
        // el acta queda visualmente bloqueada.

        setError(
          fallo instanceof Error
            ? fallo.message
            : "No s'ha pogut verificar l'acta.",
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void cargarDatos();

    return () => {
      controlador.abort();
    };
  }, [urlDatos, revision]);

  // ==========================================================
  // VERIFICACIÓN PERIÓDICA
  // ==========================================================

  useEffect(() => {
    const intervalo = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        actualizar();
      }
    }, INTERVALO_CONTROL_MS);

    const recuperar = () => {
      actualizar();
    };

    window.addEventListener("focus", recuperar);

    window.addEventListener("online", recuperar);

    document.addEventListener("visibilitychange", recuperar);

    return () => {
      window.clearInterval(intervalo);

      window.removeEventListener("focus", recuperar);

      window.removeEventListener("online", recuperar);

      document.removeEventListener("visibilitychange", recuperar);
    };
  }, [actualizar]);

  // ==========================================================
  // DETECTAR DESBLOQUEO
  // ==========================================================

  const bloqueadaAdministrativamente = estaBloqueada(datos?.acta ?? null);

  useEffect(() => {
    if (!datos) return;

    const bloqueoAnterior = bloqueoAnteriorRef.current;

    bloqueoAnteriorRef.current = bloqueadaAdministrativamente;

    if (bloqueoAnterior === true && !bloqueadaAdministrativamente) {
      // Aviso de reactivación.
      //
      // No eliminamos ni reiniciamos el
      // LocalStorage: puede haber jugadas
      // pendientes de sincronización.

      window.dispatchEvent(
        new CustomEvent("acta:reconciliar-servidor", {
          detail: {
            partidoID,
          },
        }),
      );

      actualizar();
    }
  }, [datos, bloqueadaAdministrativamente, partidoID, actualizar]);

  // ==========================================================
  // BLOQUEO DE LA INTERFAZ
  // ==========================================================

  const bloquearInterfaz = Boolean(
    bloqueadaAdministrativamente || (error && datos),
  );

  useEffect(() => {
    const contenido = contenidoRef.current;

    if (!contenido) return;

    contenido.inert = bloquearInterfaz;

    return () => {
      contenido.inert = false;
    };
  }, [bloquearInterfaz, datos]);

  // ==========================================================
  // INICIAR O RECUPERAR CONTROL
  // ==========================================================

  const iniciarActa = useCallback(async () => {
    if (iniciando || bloquearInterfaz) {
      return;
    }

    setIniciando(true);
    setErrorAccion("");

    try {
      const respuesta = await fetch(urlInicio, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({}),
      });

      await leerRespuesta<RespuestaInicio>(respuesta);

      actualizar();
    } catch (fallo) {
      setErrorAccion(
        fallo instanceof Error
          ? fallo.message
          : "No s'ha pogut iniciar l'acta.",
      );
    } finally {
      setIniciando(false);
    }
  }, [iniciando, bloquearInterfaz, urlInicio, actualizar]);

  // ==========================================================
  // VOLVER A LA PORTADA
  // ==========================================================

  const volverPortada = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // La navegación puede continuar.
    }

    window.location.assign(rutaPortada);
  }, [rutaPortada]);

  // ==========================================================
  // RENDER DEPORTIVO
  // ==========================================================

  const deporte = normalizarDeporte(datos?.torneo.deporte ?? null);

  const esControlador = datos?.control?.esControlador ?? false;

  const hayOtroControlador = Boolean(
    datos?.acta?.controlador_id && !esControlador,
  );

  const puedeEscribir = Boolean(
    datos?.acta &&
    datos.control?.puedeEscribir &&
    datos.control?.controlToken &&
    !bloquearInterfaz &&
    datos.acta.estado === "EN_CURSO" &&
    ["CONTROLADA", "EN_SUPERVISION"].includes(datos.acta.estado_operativo),
  );

  const puedeAsumir = Boolean(
    datos?.acta &&
    datos.control?.puedeSolicitarControl &&
    !esControlador &&
    !hayOtroControlador &&
    !bloquearInterfaz &&
    datos.acta.estado !== "FINALIZADA",
  );

  // ==========================================================
  // PORTAL DE PANTALLA COMPLETA
  // ==========================================================

  if (!montado) {
    return null;
  }

  const interfaz = (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-background text-neutral-titulos"
      style={{
        width: "100vw",
        height: "100dvh",
        zIndex: 2147483000,
      }}
    >
      {/* ====================================================
          CABECERA EXCLUSIVA DEL PERFIL
          ==================================================== */}

      <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-3 py-3 sm:px-6">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary sm:text-xs">
            Voluntariat · Acta digital
          </p>

          <h1 className="mt-1 truncate text-base font-bold text-neutral-titulos sm:text-xl">
            {datos?.partido.nombre ||
              datos?.partido.codigo ||
              "Acta del partit"}
          </h1>

          {datos && (
            <p className="mt-1 text-xs text-neutral">
              {datos.torneo.nombre}
              {datos.partido.pista ? ` · ${datos.partido.pista}` : ""}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {datos && (
            <span
              className={[
                "hidden rounded-lg px-3 py-2 text-xs font-bold sm:inline-flex",
                bloquearInterfaz
                  ? "bg-amber-500/10 text-amber-700"
                  : puedeEscribir
                    ? "bg-primary/10 text-primary"
                    : "bg-background text-neutral",
              ].join(" ")}
            >
              {bloquearInterfaz
                ? "Bloquejada"
                : puedeEscribir
                  ? "Tens el control"
                  : datos.acta?.estado === "FINALIZADA"
                    ? "Finalitzada"
                    : "Mode consulta"}
            </span>
          )}

          {!pantallaNativa && (
            <button
              type="button"
              onClick={() => {
                void activarPantallaNativa();
              }}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-bold text-neutral-titulos transition hover:bg-primary/5"
            >
              Pantalla completa
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              void volverPortada();
            }}
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition hover:opacity-90 sm:text-sm"
          >
            Sortir
          </button>
        </div>
      </header>

      {/* ====================================================
          EDITOR DEPORTIVO
          ==================================================== */}

      <div
        ref={contenidoRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {cargando && !datos ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />

            <p className="text-center text-sm text-neutral">
              Carregant l'acta digital...
            </p>
          </div>
        ) : !datos ? (
          <section className="mx-auto max-w-lg p-6 text-center">
            <h2 className="text-xl font-bold text-neutral-titulos">
              No es pot carregar l'acta
            </h2>

            <p role="alert" className="mt-3 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={actualizar}
              className="mt-5 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white"
            >
              Tornar a intentar
            </button>
          </section>
        ) : !datos.acta ? (
          <section className="mx-auto flex max-w-xl flex-col items-center p-8 text-center">
            <h2 className="text-2xl font-bold text-neutral-titulos">
              L'acta encara no està iniciada
            </h2>

            <p className="mt-3 text-sm leading-6 text-neutral">
              Torna a la portada del partit per consultar les designacions i
              iniciar l'acta.
            </p>

            <button
              type="button"
              onClick={() => {
                void volverPortada();
              }}
              className="mt-6 rounded-xl bg-primary px-6 py-3 font-bold text-white"
            >
              Tornar a la portada
            </button>
          </section>
        ) : (
          <div className="mx-auto w-full max-w-[1650px] px-2 py-4 sm:px-4 sm:py-6">
            {/* INFORMACIÓN DE CONTROL */}

            {datos.acta.estado !== "FINALIZADA" &&
              !puedeEscribir &&
              !bloquearInterfaz && (
                <section className="mb-5 rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-bold text-neutral-titulos">
                        Mode consulta
                      </h2>

                      <p className="mt-1 text-sm text-neutral">
                        {hayOtroControlador
                          ? "Una altra persona té el control de l'acta."
                          : "Actualment no tens el control de l'acta."}
                      </p>
                    </div>

                    {puedeAsumir && (
                      <button
                        type="button"
                        disabled={iniciando}
                        onClick={() => {
                          void iniciarActa();
                        }}
                        className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {iniciando ? "Preparant..." : "Assumir el control"}
                      </button>
                    )}
                  </div>

                  {errorAccion && (
                    <p role="alert" className="mt-3 text-sm text-red-600">
                      {errorAccion}
                    </p>
                  )}
                </section>
              )}

            {/* FÚTBOL */}

            {deporte === "FUTBOL" && (
              <ActaFutbol
                partido={datos.partido}
                estructura={datos.estructura}
                equipos={datos.equipos}
                acta={datos.acta}
                editable={puedeEscribir}
              />
            )}

            {/* VOLEIBOL */}

            {deporte === "VOLEIBOL" && (
              <ActaVoleibol
                partido={datos.partido}
                estructura={datos.estructura}
                equipos={datos.equipos}
                acta={datos.acta}
                editable={puedeEscribir}
              />
            )}

            {/* OTROS DEPORTES */}

            {deporte !== "FUTBOL" && deporte !== "VOLEIBOL" && (
              <section className="rounded-2xl border border-border bg-card p-8 text-center">
                <h2 className="text-xl font-bold text-neutral-titulos">
                  Acta no disponible
                </h2>

                <p className="mt-3 text-sm text-neutral">
                  Encara no hi ha un acta digital per a aquest esport.
                </p>
              </section>
            )}
          </div>
        )}
      </div>

      {/* ESTADO DE CONEXIÓN */}

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-card px-4 py-2 text-[11px] text-neutral sm:px-6">
        <span>
          {realtimeConectado
            ? "Actualització automàtica connectada"
            : "Comprovació automàtica activa"}
        </span>

        <button
          type="button"
          onClick={actualizar}
          className="font-semibold text-primary"
        >
          Actualitzar
        </button>
      </footer>
    </div>
  );

  // ==========================================================
  // PANTALLA DE BLOQUEO
  // ==========================================================

  const pantallaBloqueo = bloquearInterfaz ? (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="titol-bloqueig-perfil"
      className="fixed inset-0 flex min-h-dvh items-center justify-center overflow-y-auto bg-black/95 p-6 text-white backdrop-blur-md"
      style={{
        zIndex: 2147483647,
      }}
    >
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-12 w-12"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
          {bloqueadaAdministrativamente
            ? "Bloqueig de l'organització"
            : "Verificant l'accés"}
        </p>

        <h2
          id="titol-bloqueig-perfil"
          className="mt-3 text-3xl font-black sm:text-4xl"
        >
          {bloqueadaAdministrativamente
            ? "Acta bloquejada"
            : "No es pot verificar l'acta"}
        </h2>

        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-white/80">
          {bloqueadaAdministrativamente
            ? datos?.acta?.motivo_bloqueo ||
              "L'organització ha bloquejat temporalment aquesta acta."
            : error}
        </p>

        <p className="mt-6 text-sm leading-6 text-white/50">
          L'acta continua oberta. Les jugades locals no s'han eliminat. Es
          comprovarà automàticament si es retira el bloqueig.
        </p>

        <button
          type="button"
          onClick={actualizar}
          className="mt-8 rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/20"
        >
          Tornar a comprovar
        </button>

        <p className="mt-6 text-xs text-white/40">
          {realtimeConectado
            ? "Connexió en temps real activa"
            : "Verificació periòdica activa"}
        </p>
      </div>
    </div>
  ) : null;

  // ==========================================================
  // RENDER FINAL
  // ==========================================================

  return (
    <>
      {createPortal(interfaz, document.body)}

      {pantallaBloqueo && createPortal(pantallaBloqueo, document.body)}
    </>
  );
}
