import {
  useCallback,
  useEffect,
  useState,
} from "react";

// ============================================================
// ICONOS DEL ACTA
// ============================================================

const ICONOS_EVENTO = {
  GOL:
    "/iconos/panell/acta/gol.svg",

  TARJETA_AMARILLA:
    "/iconos/panell/acta/tarjeta-amarilla.svg",

  TARJETA_ROJA:
    "/iconos/panell/acta/tarjeta-roja.svg",

  PENALTI_MARCADO:
    "/iconos/panell/acta/penalti-marcado.svg",

  PENALTI_FALLADO:
    "/iconos/panell/acta/penalti-fallado.svg",
} as const;

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;

  edicionID: string;

  partidoID: string;
};

type Equipo = {
  id: string;

  nombre: string;

  escudo: string | null;
};

type Evento = {
  id: string;

  orden: number;

  tipo: string;

  equipoID: string | null;

  equipoNombre: string | null;

  jugadorID: string | null;

  jugadorNombre: string | null;

  minuto: number | null;

  periodo: number | null;

  createdAt: string;
};

type DatosPartido = {
  torneo: {
    id: string;

    nombre: string;

    deporte: string;
  };

  edicion: {
    id: string;

    nombre: string;
  };

  estructura: {
    fase: {
      id: string;

      nombre: string;

      tipo: string;
    } | null;

    grupo: {
      id: string;

      nombre: string;

      estado: string;
    } | null;

    ronda: {
      id: string;

      nombre: string;

      tipo: string;
    } | null;
  };

  partido: {
    id: string;

    codigo: string;

    nombre: string | null;

    jornada: number | null;

    estado: string;

    fechaHora: string | null;

    pista: string | null;

    finalizado: boolean;

    enCurso: boolean;
  };

  local: Equipo | null;

  visitante: Equipo | null;

  resultado: {
    local: number | null;

    visitante: number | null;

    confirmado: boolean;

    tipo: string | null;
  };

  acta: {
    id: string;

    estado: string;

    iniciadaAt: string | null;

    finalizadaAt: string | null;

    version: number;
  } | null;

  historial: Evento[];
};

type RespuestaAPI = {
  data?: DatosPartido;

  mensaje?: string;
};

// ============================================================
// ORDEN HISTORIAL
// ============================================================
//
// De más reciente a más antiguo:
//
// 20'
// 19'
// 18'
// ...
// 1'
//
// Si hay varios eventos en el mismo minuto,
// primero aparece el de mayor "orden".
//
// Los eventos sin minuto quedan al final.
// ============================================================

function ordenarHistorial(
  historial: Evento[],
) {
  return [
    ...historial,
  ].sort(
    (
      a,
      b,
    ) => {
      if (
        a.minuto !==
          null &&
        b.minuto !==
          null
      ) {
        if (
          a.minuto !==
          b.minuto
        ) {
          return (
            b.minuto -
            a.minuto
          );
        }

        return (
          b.orden -
          a.orden
        );
      }

      if (
        a.minuto !==
          null &&
        b.minuto ===
          null
      ) {
        return -1;
      }

      if (
        a.minuto ===
          null &&
        b.minuto !==
          null
      ) {
        return 1;
      }

      return (
        b.orden -
        a.orden
      );
    },
  );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PartitDetallClient({
  torneoID,
  edicionID,
  partidoID,
}: Props) {
  const [
    dades,
    setDades,
  ] =
    useState<
      DatosPartido | null
    >(
      null,
    );

  const [
    carregant,
    setCarregant,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  // ========================================================
  // CARGAR
  // ========================================================

  const carregar =
    useCallback(
      async (
        mostrarCarrega =
          false,
      ) => {
        if (
          mostrarCarrega
        ) {
          setCarregant(
            true,
          );
        }

        try {
          const params =
            new URLSearchParams({
              torneoID,
              edicionID,
              partidoID,
            });

          const resposta =
            await fetch(
              `/api/torneos/partit?${params.toString()}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const json =
            (
              await resposta.json()
            ) as RespuestaAPI;

          if (
            !resposta.ok ||
            !json.data
          ) {
            throw new Error(
              json.mensaje ??
                "No s'ha pogut carregar el partit.",
            );
          }

          setDades(
            json.data,
          );

          setError(
            "",
          );
        } catch (
          error
        ) {
          setError(
            error instanceof
              Error
              ? error.message
              : "No s'ha pogut carregar el partit.",
          );
        } finally {
          setCarregant(
            false,
          );
        }
      },
      [
        torneoID,
        edicionID,
        partidoID,
      ],
    );

  // ========================================================
  // INICIAL
  // ========================================================

  useEffect(
    () => {
      void carregar(
        true,
      );
    },
    [
      carregar,
    ],
  );

  // ========================================================
  // ACTUALIZACIÓN EN DIRECTO
  // ========================================================

  useEffect(
    () => {
      if (
        !dades ||
        dades.partido
          .finalizado
      ) {
        return;
      }

      const intervalo =
        dades.partido
          .enCurso
          ? 2000
          : 10000;

      const temporizador =
        window.setInterval(
          () => {
            void carregar();
          },
          intervalo,
        );

      return () => {
        window.clearInterval(
          temporizador,
        );
      };
    },
    [
      dades?.partido
        .enCurso,
      dades?.partido
        .finalizado,
      carregar,
    ],
  );

  // ========================================================
  // CARGANDO
  // ========================================================

  if (
    carregant &&
    !dades
  ) {
    return (
      <div
        className="
          mx-auto
          flex
          min-h-[50vh]
          w-full
          max-w-6xl
          items-center
          justify-center
          px-4
          sm:px-6
          lg:px-8
        "
      >
        <div
          className="
            text-center
          "
        >
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
            Carregant partit...
          </p>
        </div>
      </div>
    );
  }

  // ========================================================
  // ERROR
  // ========================================================

  if (
    !dades
  ) {
    return (
      <div
        className="
          mx-auto
          flex
          min-h-[50vh]
          w-full
          max-w-4xl
          items-center
          justify-center
          px-4
        "
      >
        <div
          className="
            w-full
            rounded-2xl
            border
            border-border
            bg-card
            p-8
            text-center
          "
        >
          <h1
            className="
              text-xl
              font-bold
              text-neutral-titulos
            "
          >
            No s'ha pogut carregar el partit
          </h1>

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
            onClick={() =>
              void carregar(
                true,
              )
            }
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
  // VARIABLES
  // ========================================================

  const marcadorDisponible =
    dades.resultado.local !==
      null &&
    dades.resultado
      .visitante !==
      null;

  const estructura =
    dades.estructura.grupo
      ?.nombre ??
    dades.estructura.ronda
      ?.nombre ??
    dades.estructura.fase
      ?.nombre ??
    "Partit";

  const urlTorneig =
    `/tornejos/${encodeURIComponent(
      torneoID,
    )}` +
    `?edicionID=${encodeURIComponent(
      edicionID,
    )}` +
    `&seccio=competicio`;

  const historialOrdenado =
    ordenarHistorial(
      dades.historial,
    );

  // ========================================================
  // UI
  // ========================================================

  return (
    <div
      className="
        mx-auto
        w-full
        max-w-6xl
        px-4
        py-8
        sm:px-6
        sm:py-10
        lg:px-8
      "
    >
      {/* =============================================
          VOLVER
      ============================================= */}

      {/* <a
        href={
          urlTorneig
        }
        className="
          inline-flex
          items-center
          gap-2
          text-sm
          font-semibold
          text-neutral
          transition
          hover:text-primary
        "
      >
        <IconoFlecha
          className="
            h-4
            w-4
          "
        />

        Tornar a la competició
      </a> */}

      {/* =============================================
          CABECERA PARTIDO
      ============================================= */}

      <div
        className="
          mt-7
          flex
          flex-col
          gap-4
          sm:flex-row
          sm:items-end
          sm:justify-between
        "
      >
        <div>
          {/* <p
            className="
              text-xs
              font-bold
              uppercase
              tracking-[0.18em]
              text-primary
            "
          >
            {dades.edicion.nombre}
          </p> */}

          <h1
            className="
              mt-2
              text-3xl
              font-bold
              tracking-tight
              text-neutral-titulos
              sm:text-4xl
            "
          >
            {dades.partido.nombre ??
              (
                dades.partido.jornada !==
                null
                  ? `Jornada ${dades.partido.jornada}`
                  : "Partit"
              )}
          </h1>

          <p
            className="
              mt-2
              text-sm
              text-neutral
            "
          >
            {estructura}
          </p>
        </div>

        <EstatPartit
          finalitzat={
            dades.partido
              .finalizado
          }
          enCurs={
            dades.partido
              .enCurso
          }
        />
      </div>

      {/* =============================================
          MARCADOR
      ============================================= */}

      <section
        className="
          mt-7
          overflow-hidden
          rounded-3xl
          border
          border-border
          bg-card
          shadow-sm
        "
      >
        <div
          className="
            grid
            min-h-64
            grid-cols-[1fr_auto_1fr]
            items-center
            gap-4
            px-4
            py-9
            sm:px-8
            lg:px-12
          "
        >
          <EquipMarcador
            equip={
              dades.local
            }
            alineacio="dreta"
          />

          <div
            className="
              flex
              min-w-24
              flex-col
              items-center
              justify-center
            "
          >
            {marcadorDisponible ? (
              <div
                className="
                  flex
                  items-center
                  gap-3
                  text-4xl
                  font-black
                  tracking-tight
                  text-neutral-titulos
                  sm:text-5xl
                "
              >
                <span>
                  {
                    dades.resultado
                      .local
                  }
                </span>

                <span
                  className="
                    text-2xl
                    font-semibold
                    text-neutral
                  "
                >
                  -
                </span>

                <span>
                  {
                    dades.resultado
                      .visitante
                  }
                </span>
              </div>
            ) : (
              <span
                className="
                  rounded-xl
                  bg-background
                  px-4
                  py-2
                  text-sm
                  font-black
                  text-primary
                "
              >
                VS
              </span>
            )}

            {dades.partido
              .enCurso && (
              <div
                className="
                  mt-3
                  flex
                  items-center
                  gap-2
                  text-xs
                  font-bold
                  text-red-600
                "
              >
                <span
                  className="
                    h-2
                    w-2
                    animate-pulse
                    rounded-full
                    bg-red-600
                  "
                />

                EN DIRECTE
              </div>
            )}
          </div>

          <EquipMarcador
            equip={
              dades.visitante
            }
            alineacio="esquerra"
          />
        </div>

        {(
          dades.partido
            .fechaHora ||
          dades.partido
            .pista
        ) && (
          <div
            className="
              flex
              flex-wrap
              items-center
              justify-center
              gap-x-6
              gap-y-2
              border-t
              border-border
              bg-background/40
              px-5
              py-4
              text-sm
              text-neutral
            "
          >
            {dades.partido
              .fechaHora && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-2
                "
              >
                <IconoCalendari
                  className="
                    h-4
                    w-4
                  "
                />

                {formatData(
                  dades.partido
                    .fechaHora,
                )}
              </span>
            )}

            {dades.partido
              .pista && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-2
                "
              >
                <IconoUbicacio
                  className="
                    h-4
                    w-4
                  "
                />

                {
                  dades.partido
                    .pista
                }
              </span>
            )}
          </div>
        )}
      </section>

      {/* =============================================
          DESARROLLO
      ============================================= */}

      <section
        className="
          mt-7
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
            items-center
            justify-between
            gap-4
            border-b
            border-border
            px-5
            py-5
            sm:px-6
          "
        >
          <div>
            <p
              className="
                text-xs
                font-bold
                uppercase
                tracking-[0.16em]
                text-primary
              "
            >
              Acta
            </p>

            <h2
              className="
                mt-1
                text-xl
                font-bold
                text-neutral-titulos
              "
            >
              Desenvolupament del partit
            </h2>
          </div>

          {dades.historial
            .length >
            0 && (
            <span
              className="
                rounded-full
                bg-background
                px-3
                py-1.5
                text-xs
                font-bold
                text-neutral
              "
            >
              {
                dades.historial
                  .length
              }{" "}
              incidències
            </span>
          )}
        </div>

        {dades.historial
          .length ===
        0 ? (
          <div
            className="
              px-6
              py-14
              text-center
            "
          >
            <IconoDocument
              className="
                mx-auto
                h-9
                w-9
                text-neutral/50
              "
            />

            <p
              className="
                mt-3
                font-semibold
                text-neutral-titulos
              "
            >
              Encara no hi ha incidències
            </p>

            <p
              className="
                mt-1
                text-sm
                text-neutral
              "
            >
              El desenvolupament del partit apareixerà aquí.
            </p>
          </div>
        ) : (
          <div
            className="
              divide-y
              divide-border/60
            "
          >
            {historialOrdenado.map(
              evento => (
                <EventoHistorial
                  key={
                    evento.id
                  }
                  evento={
                    evento
                  }
                  localID={
                    dades.local
                      ?.id ??
                    null
                  }
                  visitanteID={
                    dades.visitante
                      ?.id ??
                    null
                  }
                />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================
// EQUIPO MARCADOR
// ============================================================

function EquipMarcador({
  equip,
  alineacio,
}: {
  equip: Equipo | null;

  alineacio:
    | "dreta"
    | "esquerra";
}) {
  const derecha =
    alineacio ===
    "dreta";

  return (
    <div
      className={`
        flex
        min-w-0
        flex-col
        gap-3

        ${
          derecha
            ? "items-end text-right"
            : "items-start text-left"
        }
      `}
    >
      {equip?.escudo ? (
        <div
          className="
            flex
            h-16
            w-16
            items-center
            justify-center
            overflow-hidden
            rounded-2xl
            border
            border-border
            bg-white
            p-2
            sm:h-20
            sm:w-20
          "
        >
          <img
            src={
              equip.escudo
            }
            alt=""
            className="
              h-full
              w-full
              object-contain
            "
          />
        </div>
      ) : (
        <div
          className="
            flex
            h-16
            w-16
            items-center
            justify-center
            rounded-2xl
            bg-background
            text-xl
            font-black
            text-primary
            sm:h-20
            sm:w-20
          "
        >
          {equip?.nombre
            ?.charAt(
              0,
            )
            .toUpperCase() ??
            "?"}
        </div>
      )}

      <h2
        className="
          max-w-48
          text-base
          font-bold
          leading-tight
          text-neutral-titulos
          sm:text-lg
          lg:text-xl
        "
      >
        {equip?.nombre ??
          "Per determinar"}
      </h2>
    </div>
  );
}

// ============================================================
// EVENTO HISTORIAL
// ============================================================
//
// Estructura:
//
// ┌─────────────────┬──────┬─────────────────┐
// │      LOCAL      │ MIN. │    VISITANT     │
// └─────────────────┴──────┴─────────────────┘
//
// Las columnas no tienen borde ni fondo.
// Solo sirven para alinear visualmente los eventos.
//
// ============================================================

function EventoHistorial({
  evento,
  localID,
  visitanteID,
}: {
  evento: Evento;

  localID:
    string | null;

  visitanteID:
    string | null;
}) {
  const esLocal =
    Boolean(
      localID,
    ) &&
    evento.equipoID ===
      localID;

  const esVisitante =
    Boolean(
      visitanteID,
    ) &&
    evento.equipoID ===
      visitanteID;

  return (
    <article
      className="
        grid
        grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)]
        items-center
        gap-2
        px-3
        py-5
        sm:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)]
        sm:gap-4
        sm:px-6
      "
    >
      {/* =========================================
          COLUMNA LOCAL
      ========================================== */}

      <div
        className="
          min-w-0
        "
      >
        {esLocal && (
          <ContingutEvento
            evento={
              evento
            }
            lado="LOCAL"
          />
        )}
      </div>

      {/* =========================================
          MINUTO CENTRADO
      ========================================== */}

      <div
        className="
          flex
          items-center
          justify-center
          self-stretch
        "
      >
        <span
          className="
            inline-flex
            min-h-9
            min-w-9
            items-center
            justify-center
            text-sm
            font-black
            tabular-nums
            text-neutral-titulos
            sm:min-h-10
            sm:min-w-10
          "
        >
          {evento.minuto !==
          null
            ? `${evento.minuto}'`
            : "—"}
        </span>
      </div>

      {/* =========================================
          COLUMNA VISITANTE
      ========================================== */}

      <div
        className="
          min-w-0
        "
      >
        {esVisitante && (
          <ContingutEvento
            evento={
              evento
            }
            lado="VISITANTE"
          />
        )}

        {!esLocal &&
          !esVisitante && (
            <ContingutEvento
              evento={
                evento
              }
              lado="VISITANTE"
            />
          )}
      </div>
    </article>
  );
}

// ============================================================
// CONTENIDO EVENTO
// ============================================================

function ContingutEvento({
  evento,
  lado,
}: {
  evento: Evento;

  lado:
    | "LOCAL"
    | "VISITANTE";
}) {
  const local =
    lado ===
    "LOCAL";

  return (
    <div
      className={`
        flex
        min-w-0
        items-center
        gap-3

        ${
          local
            ? "justify-end"
            : "justify-start"
        }
      `}
    >
      {local && (
        <InformacioEvento
          evento={
            evento
          }
          alineacio="dreta"
        />
      )}

      <div
        className="
          flex
          h-10
          w-10
          shrink-0
          items-center
          justify-center
          rounded-xl
          bg-background
        "
      >
        <IconoEvento
          tipo={
            evento.tipo
          }
        />
      </div>

      {!local && (
        <InformacioEvento
          evento={
            evento
          }
          alineacio="esquerra"
        />
      )}
    </div>
  );
}

// ============================================================
// INFORMACIÓN EVENTO
// ============================================================

function InformacioEvento({
  evento,
  alineacio,
}: {
  evento: Evento;

  alineacio:
    | "dreta"
    | "esquerra";
}) {
  return (
    <div
      className={`
        min-w-0

        ${
          alineacio ===
          "dreta"
            ? "text-right"
            : "text-left"
        }
      `}
    >
      <p
        className="
          text-sm
          font-bold
          leading-tight
          text-neutral-titulos
          sm:text-base
        "
      >
        {nombreEvento(
          evento.tipo,
        )}
      </p>

      {evento.jugadorNombre && (
        <p
          className="
            mt-0.5
            truncate
            text-xs
            font-semibold
            text-neutral
            sm:text-sm
          "
        >
          {
            evento.jugadorNombre
          }
        </p>
      )}

      {evento.equipoNombre && (
        <p
          className="
            mt-0.5
            truncate
            text-[10px]
            text-neutral
            sm:text-xs
          "
        >
          {
            evento.equipoNombre
          }
        </p>
      )}
    </div>
  );
}

// ============================================================
// ESTADO
// ============================================================

function EstatPartit({
  finalitzat,
  enCurs,
}: {
  finalitzat: boolean;

  enCurs: boolean;
}) {
  if (
    enCurs
  ) {
    return (
      <span
        className="
          inline-flex
          w-fit
          items-center
          gap-2
          rounded-full
          bg-red-50
          px-3
          py-1.5
          text-xs
          font-bold
          text-red-700
        "
      >
        <span
          className="
            h-2
            w-2
            animate-pulse
            rounded-full
            bg-red-600
          "
        />

        En directe
      </span>
    );
  }

  if (
    finalitzat
  ) {
    return (
      <span
        className="
          w-fit
          rounded-full
          bg-primary/10
          px-3
          py-1.5
          text-xs
          font-bold
          text-primary
        "
      >
        Finalitzat
      </span>
    );
  }

  return (
    <span
      className="
        w-fit
        rounded-full
        bg-background
        px-3
        py-1.5
        text-xs
        font-bold
        text-neutral
      "
    >
      Programat
    </span>
  );
}

// ============================================================
// ICONO EVENTO
// ============================================================

function IconoEvento({
  tipo,
}: {
  tipo: string;
}) {
  const ruta =
    ICONOS_EVENTO[
      tipo as keyof typeof ICONOS_EVENTO
    ];

  if (
    !ruta
  ) {
    return (
      <IconoDocument
        className="
          h-5
          w-5
          text-neutral
        "
      />
    );
  }

  return (
    <img
      src={
        ruta
      }
      alt=""
      draggable={
        false
      }
      className="
        h-6
        w-6
        object-contain
      "
    />
  );
}

// ============================================================
// NOMBRE EVENTO
// ============================================================

function nombreEvento(
  tipo: string,
) {
  switch (
    tipo
  ) {
    case "GOL":
      return "Gol";

    case "TARJETA_AMARILLA":
      return "Targeta groga";

    case "TARJETA_ROJA":
      return "Targeta vermella";

    case "PENALTI_MARCADO":
      return "Penal marcat";

    case "PENALTI_FALLADO":
      return "Penal fallat";

    default:
      return tipo;
  }
}

// ============================================================
// FECHA
// ============================================================

function formatData(
  valor: string,
) {
  const data =
    new Date(
      valor,
    );

  if (
    Number.isNaN(
      data.getTime(),
    )
  ) {
    return valor;
  }

  return new Intl.DateTimeFormat(
    "ca-ES",
    {
      weekday:
        "short",

      day:
        "2-digit",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",

      timeZone:
        "Europe/Madrid",
    },
  ).format(
    data,
  );
}

// ============================================================
// SVG INLINE UI
// ============================================================

type IconProps = {
  className?: string;
};

function IconoCargando({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={
        className
      }
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

function IconoFlecha({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        className
      }
      aria-hidden="true"
    >
      <path
        d="m15 18-6-6 6-6"
      />
    </svg>
  );
}

function IconoCalendari({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        className
      }
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="16"
        rx="2"
      />

      <path
        d="M8 3v4M16 3v4M3 10h18"
      />
    </svg>
  );
}

function IconoUbicacio({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        className
      }
      aria-hidden="true"
    >
      <path
        d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"
      />

      <circle
        cx="12"
        cy="10"
        r="2.5"
      />
    </svg>
  );
}

function IconoDocument({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        className
      }
      aria-hidden="true"
    >
      <path
        d="M6 3h8l4 4v14H6z"
      />

      <path
        d="M14 3v5h5"
      />

      <path
        d="M9 13h6M9 17h6"
      />
    </svg>
  );
}