import { useCallback, useEffect, useState } from "react";

import SelectorGrup from "./SelectorGrup";
import ClassificacioResum from "./ClassificacioResum";
import JornadaActual from "./JornadaActual";
import ClassificacioCompleta from "./ClassificacioCompleta";
import ProximaJornada from "./ProximaJornada";

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;
  edicionID: string;
};

type Equip = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Grup = {
  id: string;
  nombre: string;
  estado: string;

  faseID: string;
  faseNombre: string;
  faseOrden: number;

  orden: number;
};

type FilaClassificacio = {
  equipo: Equip;

  posicion: number | null;

  pj: number | null;
  pg: number | null;
  pe: number | null;
  pp: number | null;

  favor: number | null;
  contra: number | null;
  diferencia: number | null;

  puntos: number | null;

  amarillas: number | null;
  rojas: number | null;
};

type Partit = {
  id: string;

  codigo: string;

  nombre: string | null;

  jornada: number | null;

  estado: string;

  fechaHora: string | null;

  pista: string | null;

  local: Equip | null;

  visitante: Equip | null;

  resultadoLocal: number | null;

  resultadoVisitante: number | null;

  finalizado: boolean;
};

type Jornada = {
  numero: number;

  contexto: "AVUI" | "DARRERA" | "PER_JUGAR" | "PROXIMA";

  partidos: Partit[];
};

type DadesCompeticio = {
  deporte: string;

  esFutbol: boolean;

  etiquetas: {
    favor: string;
    contra: string;
  };

  grupos: Grup[];

  grupo: {
    id: string;

    nombre: string;

    estado: string;

    faseID: string;

    faseNombre: string;
  } | null;

  tieneClasificacion: boolean;

  clasificacion: FilaClassificacio[];

  jornadasDisponibles: number[];

  /*
   * null = modo automático / actual
   * number = jornada elegida manualmente.
   */
  jornadaSeleccionada: number | null;

  jornadaReferencia: Jornada | null;

  proximaJornada: Jornada | null;
};

type RespostaAPI = {
  data?: DadesCompeticio;

  mensaje?: string;
};

// ============================================================
// NOMBRE ESTADO
// ============================================================

function nomEstat(estat: string) {
  switch (estat.trim().toUpperCase()) {
    case "BORRADOR":
      return "Esborrany";

    case "PREPARADO":
      return "Preparat";

    case "EN_CURSO":
      return "En curs";

    case "CERRADO":
      return "Finalitzat";

    default:
      return estat;
  }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function CompeticioClient({ torneoID, edicionID }: Props) {
  const [dades, setDades] = useState<DadesCompeticio | null>(null);

  const [carregant, setCarregant] = useState(true);

  const [canviant, setCanviant] = useState(false);

  const [error, setError] = useState("");

  // ========================================================
  // CARGAR
  // ========================================================

  const carregar = useCallback(
    async (grupID?: string, jornada?: number | null) => {
      if (dades) {
        setCanviant(true);
      } else {
        setCarregant(true);
      }

      setError("");

      try {
        const params = new URLSearchParams({
          torneoID,
          edicionID,
        });

        if (grupID) {
          params.set("grupoID", grupID);
        }

        if (jornada !== null && jornada !== undefined) {
          params.set("jornada", String(jornada));
        }

        const resposta = await fetch(
          `/api/torneos/competicio?${params.toString()}`,
          {
            method: "GET",

            cache: "no-store",

            headers: {
              Accept: "application/json",
            },
          },
        );

        const json = (await resposta.json()) as RespostaAPI;

        if (!resposta.ok || !json.data) {
          throw new Error(
            json.mensaje ?? "No s'ha pogut carregar la competició.",
          );
        }

        setDades(json.data);
      } catch (error) {
        console.error(error);

        setError(
          error instanceof Error
            ? error.message
            : "No s'ha pogut carregar la competició.",
        );
      } finally {
        setCarregant(false);

        setCanviant(false);
      }
    },
    [torneoID, edicionID, dades],
  );

  // ========================================================
  // CARGA INICIAL
  // ========================================================

  useEffect(
    () => {
      void carregar();
    },
    // Cargar únicamente al cambiar de torneo/edición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [torneoID, edicionID],
  );

  // ========================================================
  // CARGANDO
  // ========================================================

  if (carregant && !dades) {
    return (
      <div
        className="
                    mx-auto
                    w-full
                    max-w-7xl
                    px-4
                    pb-12
                    sm:px-6
                    lg:px-8
                "
      >
        <div
          className="
                        flex
                        min-h-72
                        items-center
                        justify-center
                        rounded-3xl
                        border
                        border-border
                        bg-card
                    "
        >
          <div className="text-center">
            <IconoCargando
              className="
                                mx-auto
                                h-9
                                w-9
                                animate-spin
                                text-primary
                            "
            />

            <p
              className="
                                mt-3
                                text-sm
                                text-neutral
                            "
            >
              Carregant competició...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ========================================================
  // ERROR INICIAL
  // ========================================================

  if (!dades) {
    return (
      <div
        className="
                    mx-auto
                    w-full
                    max-w-7xl
                    px-4
                    pb-12
                    sm:px-6
                    lg:px-8
                "
      >
        <div
          className="
                        rounded-3xl
                        border
                        border-border
                        bg-card
                        px-6
                        py-14
                        text-center
                    "
        >
          <IconoError
            className="
                            mx-auto
                            h-10
                            w-10
                            text-neutral/50
                        "
          />

          <h3
            className="
                            mt-4
                            font-bold
                            text-neutral-titulos
                        "
          >
            No s'ha pogut carregar la competició
          </h3>

          <p
            className="
                            mt-2
                            text-sm
                            text-neutral
                        "
          >
            {error}
          </p>

          <button
            type="button"
            onClick={() => void carregar()}
            className="
                            mt-5
                            rounded-xl
                            bg-primary
                            px-5
                            py-2.5
                            text-sm
                            font-bold
                            text-white
                        "
          >
            Tornar-ho a intentar
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // SIN GRUPOS
  // ========================================================

  if (!dades.grupo || dades.grupos.length === 0) {
    return (
      <div
        className="
                    mx-auto
                    w-full
                    max-w-7xl
                    px-4
                    pb-12
                    sm:px-6
                    lg:px-8
                "
      >
        <div
          className="
                        rounded-3xl
                        border
                        border-dashed
                        border-border
                        bg-card/40
                        px-6
                        py-14
                        text-center
                    "
        >
          <p
            className="
                            font-semibold
                            text-neutral-titulos
                        "
          >
            Encara no hi ha grups configurats.
          </p>
        </div>
      </div>
    );
  }

  const modoJornadaSeleccionada = dades.jornadaSeleccionada !== null;

  // ========================================================
  // UI
  // ========================================================

  return (
    <div
      className="
                mx-auto
                w-full
                max-w-7xl
                px-4
                pb-12
                sm:px-6
                lg:px-8
            "
    >
      {/* =================================================
                CABECERA / SELECTORES
            ================================================= */}

      <section
        className="
                    mb-6
                    overflow-hidden
                    rounded-3xl
                    border
                    border-border
                    bg-card
                "
      >
        <div
          className="
                        flex
                        flex-col
                        gap-6
                        px-5
                        py-5
                        sm:px-6
                        xl:flex-row
                        xl:items-end
                        xl:justify-between
                    "
        >
          <div className="min-w-0">
            <p
              className="
                                text-xs
                                font-bold
                                uppercase
                                tracking-[0.16em]
                                text-primary
                            "
            >
              {dades.grupo.faseNombre}
            </p>

            <div
              className="
                                mt-1
                                flex
                                flex-wrap
                                items-center
                                gap-3
                            "
            >
              <h2
                className="
                                    text-2xl
                                    font-bold
                                    tracking-tight
                                    text-neutral-titulos
                                    sm:text-3xl
                                "
              >
                {dades.grupo.nombre}
              </h2>

              <span
                className="
                                    rounded-full
                                    bg-background
                                    px-3
                                    py-1
                                    text-[11px]
                                    font-bold
                                    text-neutral
                                "
              >
                {nomEstat(dades.grupo.estado)}
              </span>
            </div>

            <p
              className="
                                mt-2
                                text-sm
                                text-neutral
                            "
            >
              Resultats, classificació i pròxims partits.
            </p>
          </div>

          {/* =========================================
                        SELECTOR GRUPO + JORNADA
                    ========================================== */}

          <div
            className="
                            grid
                            w-full
                            gap-3
                            sm:grid-cols-2
                            xl:w-auto
                        "
          >
            <SelectorGrup
              grups={dades.grupos}
              valor={dades.grupo.id}
              desactivat={canviant}
              onCanvi={(grupID) => void carregar(grupID, null)}
            />

            <SelectorJornada
              jornadas={dades.jornadasDisponibles}
              valor={dades.jornadaSeleccionada}
              desactivat={canviant}
              onCanvi={(jornada) => void carregar(dades.grupo?.id, jornada)}
            />
          </div>
        </div>

        {canviant && (
          <div
            className="
                            h-1
                            overflow-hidden
                            bg-background
                        "
          >
            <div
              className="
                                h-full
                                w-1/3
                                animate-pulse
                                rounded-full
                                bg-primary
                            "
            />
          </div>
        )}
      </section>

      {/* =================================================
                ERROR CAMBIO
            ================================================= */}

      {error && (
        <div
          className="
                        mb-6
                        rounded-2xl
                        border
                        border-error/30
                        bg-error-container
                        p-4
                        text-sm
                        text-error
                    "
        >
          {error}
        </div>
      )}

      {/* =================================================
                CONTENIDO
            ================================================= */}

      <div
        className={`
                    transition-opacity
                    duration-150

                    ${
                      canviant
                        ? "pointer-events-none opacity-45"
                        : "opacity-100"
                    }
                `}
      >
        {!modoJornadaSeleccionada ? (
          <>
            {/* =====================================
                            1. JORNADA ACTUAL
                        ====================================== */}

            <JornadaActual
              torneoID={torneoID}
              edicionID={edicionID}
              jornada={dades.jornadaReferencia}
            />

            {/* =====================================
                            2. CLASIFICACIÓN COMPLETA
                        ====================================== */}

            <div className="mt-6">
              <ClassificacioCompleta
                grupNom={dades.grupo.nombre}
                files={dades.clasificacion}
                esFutbol={dades.esFutbol}
                etiquetaFavor={dades.etiquetas.favor}
                etiquetaContra={dades.etiquetas.contra}
                teClassificacio={dades.tieneClasificacion}
              />
            </div>

            {/* =====================================
                            3. PRÓXIMA JORNADA
                        ====================================== */}

            <div className="mt-6">
              <ProximaJornada
                torneoID={torneoID}
                edicionID={edicionID}
                jornada={dades.proximaJornada}
              />
            </div>
          </>
        ) : (
          <>
            {/* =====================================
                            MODO JORNADA SELECCIONADA

                            IZQUIERDA:
                            - seleccionada
                            - siguiente

                            DERECHA:
                            - clasificación resumida
                        ====================================== */}

            <div
              className="
                                grid
                                items-start
                                gap-6
                                lg:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.65fr)]
                            "
            >
              <div
                className="
                                    min-w-0
                                    space-y-6
                                "
              >
                <JornadaActual
                  torneoID={torneoID}
                  edicionID={edicionID}
                  jornada={dades.jornadaReferencia}
                />

                <ProximaJornada
                  torneoID={torneoID}
                  edicionID={edicionID}
                  jornada={dades.proximaJornada}
                />
              </div>

              <div
                className="
                                    lg:sticky
                                    lg:top-5
                                "
              >
                <ClassificacioResum
                  grupNom={dades.grupo.nombre}
                  files={dades.clasificacion}
                  teClassificacio={dades.tieneClasificacion}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SELECTOR JORNADA
// ============================================================

function SelectorJornada({
  jornadas,
  valor,
  desactivat,
  onCanvi,
}: {
  jornadas: number[];

  valor: number | null;

  desactivat: boolean;

  onCanvi: (jornada: number | null) => void;
}) {
  return (
    <div
      className="
                w-full
                xl:w-56
            "
    >
      <label
        htmlFor="selector-jornada"
        className="
                    mb-2
                    block
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-neutral
                "
      >
        Jornada
      </label>

      <div className="relative">
        <select
          id="selector-jornada"
          value={valor ?? ""}
          disabled={desactivat}
          onChange={(evento) => {
            const value = evento.target.value;

            if (value === "") {
              onCanvi(null);

              return;
            }

            onCanvi(Number(value));
          }}
          className="
                        h-12
                        w-full
                        appearance-none
                        rounded-2xl
                        border
                        border-border
                        bg-background
                        pl-4
                        pr-11
                        text-sm
                        font-semibold
                        text-neutral-titulos
                        outline-none
                        transition
                        hover:border-primary/50
                        focus:border-primary
                        disabled:cursor-wait
                        disabled:opacity-60
                    "
        >
          <option value="">Actual</option>

          {jornadas.map((jornada) => (
            <option key={jornada} value={jornada}>
              Jornada {jornada}
            </option>
          ))}
        </select>

        <IconoChevron
          className="
                        pointer-events-none
                        absolute
                        right-4
                        top-1/2
                        h-4
                        w-4
                        -translate-y-1/2
                        text-neutral
                    "
        />
      </div>
    </div>
  );
}

// ============================================================
// ICONOS
// ============================================================

type IconProps = {
  className?: string;
};

function IconoCargando({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity=".2"
      />

      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoError({ className = "" }: IconProps) {
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
      <circle cx="12" cy="12" r="9" />

      <path d="M12 8v5" />

      <path d="M12 16h.01" />
    </svg>
  );
}

function IconoChevron({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
