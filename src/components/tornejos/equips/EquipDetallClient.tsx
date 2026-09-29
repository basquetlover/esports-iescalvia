import {
  useCallback,
  useEffect,
  useState,
} from "react";

import ClassificacioCompleta from
  "@components/tornejos/competicio/ClassificacioCompleta";

// ============================================================
// ICONOS DE FORMA
// ============================================================

const ICONOS_FORMA = {
  GANADO:
    "/iconos/tornejos/forma/guanyat.svg",

  EMPATADO:
    "/iconos/tornejos/forma/empatat.svg",

  PERDIDO:
    "/iconos/tornejos/forma/perdut.svg",

  PENDIENTE:
    "/iconos/tornejos/forma/per-jugar.svg",
} as const;

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;
  edicionID: string;
  equipoID: string;
};

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type EstadoForma =
  | "GANADO"
  | "EMPATADO"
  | "PERDIDO"
  | "PENDIENTE";

type FormaPartido = {
  partidoID: string | null;

  estado: EstadoForma;

  jornada: number | null;

  marcadorFavor: number | null;

  marcadorContra: number | null;
};

type FilaClassificacio = {
  equipo: Equipo;

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

  forma?: FormaPartido[];
};

type Partido = {
  id: string;

  codigo: string;

  nombre: string | null;

  jornada: number | null;

  estado: string;

  fechaHora: string | null;

  pista: string | null;

  local: Equipo | null;

  visitante: Equipo | null;

  resultadoLocal: number | null;

  resultadoVisitante: number | null;

  resultadoConfirmado: boolean;

  finalizado: boolean;

  enCurso: boolean;

  resultadoEquipo: EstadoForma;
};

type DadesEquip = {
  torneo: {
    id: string;

    nombre: string;

    deporte: string;
  };

  edicion: {
    id: string;

    nombre: string;
  };

  equipo: {
    id: string;

    nombre: string;

    escudo: string | null;

    capitan: string | null;
  };

  esFutbol: boolean;

  grupo: {
    id: string;

    nombre: string;

    faseID: string;

    faseNombre: string;
  } | null;

  plantilla: {
    id: string;

    nombre: string;

    capitan: boolean;
  }[];

  resumen: {
    pj: number;

    pg: number;

    pe: number;

    pp: number;

    favor: number;

    contra: number;

    diferencia: number;
  };

  proximoPartido:
    Partido | null;

  ultimosPartidos:
    Partido[];

  maximosAnotadores: {
    jugadorID:
      string | null;

    nombre: string;

    goles: number;
  }[];

  disciplina: {
    amarillas: number;

    rojas: number;
  };
};

type DadesCompeticio = {
  esFutbol: boolean;

  etiquetas: {
    favor: string;

    contra: string;
  };

  grupo: {
    id: string;

    nombre: string;

    estado: string;

    faseID: string;

    faseNombre: string;
  } | null;

  tieneClasificacion: boolean;

  clasificacion:
    FilaClassificacio[];
};

type RespostaEquip = {
  data?: DadesEquip;

  mensaje?: string;
};

type RespostaCompeticio = {
  data?: DadesCompeticio;

  mensaje?: string;
};

// ============================================================
// COMPLETAR FORMA
// ============================================================

function completarForma(
  forma: FormaPartido[],
) {
  const resultado =
    forma.slice(
      0,
      5,
    );

  while (
    resultado.length <
    5
  ) {
    resultado.push({
      partidoID:
        null,

      estado:
        "PENDIENTE",

      jornada:
        null,

      marcadorFavor:
        null,

      marcadorContra:
        null,
    });
  }

  return resultado;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function EquipDetallClient({
  torneoID,
  edicionID,
  equipoID,
}: Props) {
  const [
    dades,
    setDades,
  ] =
    useState<
      DadesEquip | null
    >(
      null,
    );

  const [
    competicio,
    setCompeticio,
  ] =
    useState<
      DadesCompeticio | null
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
  // CARGAR EQUIPO
  // ========================================================

  const carregar =
    useCallback(
      async (
        inicial =
          false,
      ) => {
        if (
          inicial
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
              equipoID,
            });

          const resposta =
            await fetch(
              `/api/torneos/equip?${params.toString()}`,
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
            ) as RespostaEquip;

          if (
            !resposta.ok ||
            !json.data
          ) {
            throw new Error(
              json.mensaje ??
                "No s'ha pogut carregar l'equip.",
            );
          }

          const dadesEquip =
            json.data;

          setDades(
            dadesEquip,
          );

          // ==================================================
          // CLASIFICACIÓN DEL GRUPO
          // ==================================================

          if (
            dadesEquip.grupo
          ) {
            const paramsCompeticio =
              new URLSearchParams({
                torneoID,
                edicionID,

                grupoID:
                  dadesEquip.grupo.id,
              });

            const respostaCompeticio =
              await fetch(
                `/api/torneos/competicio?${paramsCompeticio.toString()}`,
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

            const jsonCompeticio =
              (
                await respostaCompeticio.json()
              ) as RespostaCompeticio;

            if (
              respostaCompeticio.ok &&
              jsonCompeticio.data
            ) {
              setCompeticio(
                jsonCompeticio.data,
              );
            } else {
              setCompeticio(
                null,
              );
            }
          } else {
            setCompeticio(
              null,
            );
          }

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
              : "No s'ha pogut carregar l'equip.",
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
        equipoID,
      ],
    );

  // ========================================================
  // CARGA INICIAL
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
  // ACTUALIZACIÓN
  // ========================================================

  useEffect(
    () => {
      const interval =
        window.setInterval(
          () => {
            void carregar();
          },
          30000,
        );

      return () => {
        window.clearInterval(
          interval,
        );
      };
    },
    [
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
          min-h-96
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
            Carregant equip...
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
          w-full
          max-w-4xl
          px-4
          py-12
          sm:px-6
        "
      >
        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            px-6
            py-12
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
            No s'ha pogut carregar l'equip
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
              transition
              hover:bg-primary/90
            "
          >
            Tornar-ho a intentar
          </button>
        </div>
      </div>
    );
  }

  // ========================================================
  // DATOS DE CLASIFICACIÓN DEL EQUIPO
  // ========================================================

  const filaEquip =
    competicio
      ?.clasificacion
      .find(
        fila =>
          fila.equipo.id ===
          equipoID,
      ) ??
    null;

  const forma =
    completarForma(
      filaEquip?.forma ??
        [],
    );

  const posicion =
    filaEquip
      ?.posicion ??
    null;

  const estadistiques = {
    pj:
      filaEquip?.pj ??
      dades.resumen.pj,

    pg:
      filaEquip?.pg ??
      dades.resumen.pg,

    pe:
      filaEquip?.pe ??
      dades.resumen.pe,

    pp:
      filaEquip?.pp ??
      dades.resumen.pp,

    favor:
      filaEquip?.favor ??
      dades.resumen.favor,

    contra:
      filaEquip?.contra ??
      dades.resumen.contra,

    diferencia:
      filaEquip
        ?.diferencia ??
      dades.resumen
        .diferencia,

    puntos:
      filaEquip?.puntos ??
      null,
  };

  const mostrarEstadistiquesLaterals =
    dades.maximosAnotadores
      .length >
      0 ||
    dades.disciplina
      .amarillas >
      0 ||
    dades.disciplina
      .rojas >
      0;

  const urlEquips =
    `/tornejos/${encodeURIComponent(
      torneoID,
    )}` +
    `?edicionID=${encodeURIComponent(
      edicionID,
    )}` +
    `&seccio=equips`;

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
      {/* =================================================
          VOLVER
      ================================================= */}

      {/* <a
        href={
          urlEquips
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

        Tornar als equips
      </a> */}

      {/* =================================================
          CABECERA EQUIPO
      ================================================= */}

      <section
        className="
          mt-6
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
            flex
            flex-col
            gap-6
            p-5
            sm:p-6
            lg:flex-row
            lg:items-center
            lg:justify-between
          "
        >
          <div
            className="
              flex
              min-w-0
              items-center
              gap-5
            "
          >
            <Escut
              equip={
                dades.equipo
              }
            />

            <div
              className="
                min-w-0
              "
            >
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  gap-2
                "
              >
                <span
                  className="
                    rounded-full
                    bg-primary/10
                    px-2.5
                    py-1
                    text-[10px]
                    font-bold
                    uppercase
                    tracking-wider
                    text-primary
                  "
                >
                  Equip
                </span>

                {dades.grupo && (
                  <span
                    className="
                      rounded-full
                      bg-background
                      px-2.5
                      py-1
                      text-[10px]
                      font-bold
                      text-neutral
                    "
                  >
                    {
                      dades.grupo
                        .nombre
                    }
                  </span>
                )}
              </div>

              <h1
                className="
                  mt-2
                  text-2xl
                  font-black
                  tracking-tight
                  text-neutral-titulos
                  sm:text-3xl
                "
              >
                {
                  dades.equipo
                    .nombre
                }
              </h1>

              <p
                className="
                  mt-2
                  text-sm
                  text-neutral
                "
              >
                <span
                  className="
                    font-semibold
                    text-neutral-titulos
                  "
                >
                  Capità:
                </span>{" "}
                {dades.equipo
                  .capitan ??
                  "No indicat"}
              </p>
            </div>
          </div>

          {posicion !==
            null && (
            <div
              className="
                shrink-0
                rounded-2xl
                bg-primary/10
                px-6
                py-4
                text-center
              "
            >
              <p
                className="
                  text-3xl
                  font-black
                  text-primary
                "
              >
                {posicion}
              </p>

              <p
                className="
                  mt-1
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-[0.12em]
                  text-neutral
                "
              >
                Posició
              </p>
            </div>
          )}
        </div>

        {/* =============================================
            ESTADÍSTICAS
        ============================================= */}

        <div
          className="
            grid
            grid-cols-4
            border-t
            border-border/60
            bg-background/30
            lg:grid-cols-8
          "
        >
          <Estadistica
            etiqueta="PJ"
            valor={
              estadistiques.pj
            }
          />

          <Estadistica
            etiqueta="PG"
            valor={
              estadistiques.pg
            }
          />

          <Estadistica
            etiqueta="PE"
            valor={
              estadistiques.pe
            }
          />

          <Estadistica
            etiqueta="PP"
            valor={
              estadistiques.pp
            }
          />

          <Estadistica
            etiqueta={
              dades.esFutbol
                ? "GM"
                : "PF"
            }
            valor={
              estadistiques.favor
            }
          />

          <Estadistica
            etiqueta={
              dades.esFutbol
                ? "GR"
                : "PC"
            }
            valor={
              estadistiques.contra
            }
          />

          <Estadistica
            etiqueta="DIF"
            valor={
              formatDiferencia(
                estadistiques.diferencia,
              )
            }
          />

          <Estadistica
            etiqueta="PTS"
            valor={
              estadistiques.puntos ??
              "—"
            }
            destacada
          />
        </div>

        {/* =============================================
            FORMA
        ============================================= */}

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-3
            border-t
            border-border/60
            px-5
            py-4
            sm:px-6
          "
        >
          <span
            className="
              text-xs
              font-bold
              uppercase
              tracking-[0.12em]
              text-neutral
            "
          >
            Forma
          </span>

          <Forma
            forma={
              forma
            }
          />
        </div>
      </section>

      {/* =================================================
          PRÓXIMO PARTIDO
      ================================================= */}

      <section
        className="
          mt-7
        "
      >
        <TitolSeccio
          superior="Calendari"
          titulo="Pròxim partit"
        />

        {dades.proximoPartido ? (
          <PartitDestacat
            partido={
              dades.proximoPartido
            }
            torneoID={
              torneoID
            }
          />
        ) : (
          <EstatBuit
            text="No hi ha cap pròxim partit programat."
          />
        )}
      </section>

      {/* =================================================
          ÚLTIMOS PARTIDOS
      ================================================= */}

      <section
        className="
          mt-7
        "
      >
        <TitolSeccio
          superior="Resultats"
          titulo="Últims partits"
        />

        {dades.ultimosPartidos
          .length >
        0 ? (
          <div
            className="
              mt-4
              overflow-hidden
              rounded-3xl
              border
              border-border
              bg-card
            "
          >
            {dades.ultimosPartidos.map(
              partido => (
                <FilaPartit
                  key={
                    partido.id
                  }
                  partido={
                    partido
                  }
                  equipoID={
                    equipoID
                  }
                  torneoID={
                    torneoID
                  }
                />
              ),
            )}
          </div>
        ) : (
          <EstatBuit
            text="Encara no hi ha partits finalitzats."
          />
        )}
      </section>

      {/* =================================================
          CLASIFICACIÓN COMPLETA
      ================================================= */}

      {competicio?.grupo && (
        <section
          className="
            mt-7
          "
        >
          <ClassificacioCompleta
            grupNom={
              competicio.grupo
                .nombre
            }
            files={
              competicio.clasificacion
            }
            esFutbol={
              competicio.esFutbol
            }
            etiquetaFavor={
              competicio.etiquetas
                .favor
            }
            etiquetaContra={
              competicio.etiquetas
                .contra
            }
            teClassificacio={
              competicio
                .tieneClasificacion
            }
            equipsDestacats={[
              equipoID,
            ]}
          />
        </section>
      )}

      {/* =================================================
          PLANTILLA + ESTADÍSTICAS
      ================================================= */}

      <div
        className={`
          mt-7
          grid
          gap-6

          ${
            mostrarEstadistiquesLaterals
              ? "lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]"
              : "grid-cols-1"
          }
        `}
      >
        {/* =============================================
            PLANTILLA
        ============================================= */}

        <section
          className="
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
              border-b
              border-border/60
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
                Equip
              </p>

              <h2
                className="
                  mt-1
                  text-xl
                  font-bold
                  text-neutral-titulos
                "
              >
                Plantilla
              </h2>
            </div>

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
                dades.plantilla
                  .length
              }{" "}
              jugadors
            </span>
          </div>

          {dades.plantilla
            .length >
          0 ? (
            <div
              className="
                divide-y
                divide-border/50
              "
            >
              {dades.plantilla.map(
                (
                  jugador,
                  index,
                ) => (
                  <div
                    key={
                      jugador.id
                    }
                    className="
                      flex
                      items-center
                      gap-3
                      px-5
                      py-3.5
                      sm:px-6
                    "
                  >
                    <span
                      className="
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        bg-background
                        text-xs
                        font-black
                        text-neutral
                      "
                    >
                      {String(
                        index +
                          1,
                      ).padStart(
                        2,
                        "0",
                      )}
                    </span>

                    <p
                      className="
                        min-w-0
                        flex-1
                        truncate
                        text-sm
                        font-semibold
                        text-neutral-titulos
                      "
                    >
                      {
                        jugador.nombre
                      }
                    </p>

                    {jugador.capitan && (
                      <span
                        title="Capità"
                        className="
                          flex
                          h-6
                          w-6
                          shrink-0
                          items-center
                          justify-center
                          rounded-full
                          bg-primary
                          text-[10px]
                          font-black
                          text-white
                        "
                      >
                        C
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          ) : (
            <div
              className="
                px-6
                py-12
                text-center
                text-sm
                text-neutral
              "
            >
              No hi ha jugadors disponibles.
            </div>
          )}
        </section>

        {/* =============================================
            COLUMNA DE ESTADÍSTICAS
        ============================================= */}

        {mostrarEstadistiquesLaterals && (
          <div
            className="
              grid
              content-start
              gap-6
            "
          >
            {/* =========================================
                GOLEADORES
            ========================================== */}

            {dades.maximosAnotadores
              .length >
              0 && (
              <section
                className="
                  overflow-hidden
                  rounded-3xl
                  border
                  border-border
                  bg-card
                "
              >
                <div
                  className="
                    border-b
                    border-border/60
                    px-5
                    py-5
                  "
                >
                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                      tracking-[0.16em]
                      text-primary
                    "
                  >
                    Estadístiques
                  </p>

                  <h2
                    className="
                      mt-1
                      text-lg
                      font-bold
                      text-neutral-titulos
                    "
                  >
                    Màxims anotadors
                  </h2>
                </div>

                <div
                  className="
                    space-y-4
                    p-5
                  "
                >
                  {dades.maximosAnotadores.map(
                    (
                      jugador,
                      index,
                    ) => {
                      const maxim =
                        dades
                          .maximosAnotadores[
                          0
                        ]
                          ?.goles ??
                        1;

                      const percentatge =
                        maxim >
                        0
                          ? (
                              jugador.goles /
                              maxim
                            ) *
                            100
                          : 0;

                      return (
                        <div
                          key={
                            jugador.jugadorID ??
                            `${jugador.nombre}-${index}`
                          }
                        >
                          <div
                            className="
                              flex
                              items-center
                              gap-3
                            "
                          >
                            <span
                              className="
                                w-5
                                shrink-0
                                text-xs
                                font-black
                                text-primary
                              "
                            >
                              {index +
                                1}.
                            </span>

                            <span
                              className="
                                min-w-0
                                flex-1
                                truncate
                                text-sm
                                font-semibold
                                text-neutral-titulos
                              "
                            >
                              {
                                jugador.nombre
                              }
                            </span>

                            <strong
                              className="
                                text-sm
                                text-primary
                              "
                            >
                              {
                                jugador.goles
                              }
                            </strong>
                          </div>

                          <div
                            className="
                              ml-8
                              mt-2
                              h-1.5
                              overflow-hidden
                              rounded-full
                              bg-background
                            "
                          >
                            <div
                              className="
                                h-full
                                rounded-full
                                bg-primary
                              "
                              style={{
                                width:
                                  `${percentatge}%`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </section>
            )}

            {/* =========================================
                DISCIPLINA
            ========================================== */}

            {(
              dades.disciplina
                .amarillas >
                0 ||
              dades.disciplina
                .rojas >
                0
            ) && (
              <section
                className="
                  overflow-hidden
                  rounded-3xl
                  border
                  border-border
                  bg-card
                "
              >
                <div
                  className="
                    border-b
                    border-border/60
                    px-5
                    py-5
                  "
                >
                  <p
                    className="
                      text-xs
                      font-bold
                      uppercase
                      tracking-[0.16em]
                      text-primary
                    "
                  >
                    Fair Play
                  </p>

                  <h2
                    className="
                      mt-1
                      text-lg
                      font-bold
                      text-neutral-titulos
                    "
                  >
                    Disciplina
                  </h2>
                </div>

                <div
                  className="
                    grid
                    grid-cols-2
                    gap-3
                    p-5
                  "
                >
                  <Disciplina
                    icono="/iconos/panell/acta/tarjeta-amarilla.svg"
                    valor={
                      dades.disciplina
                        .amarillas
                    }
                    etiqueta="Grogues"
                  />

                  <Disciplina
                    icono="/iconos/panell/acta/tarjeta-roja.svg"
                    valor={
                      dades.disciplina
                        .rojas
                    }
                    etiqueta="Vermelles"
                  />
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ESCUDO
// ============================================================

function Escut({
  equip,
}: {
  equip: {
    nombre: string;

    escudo:
      string | null;
  };
}) {
  if (
    equip.escudo
  ) {
    return (
      <div
        className="
          flex
          h-20
          w-20
          shrink-0
          items-center
          justify-center
          overflow-hidden
          rounded-2xl
          border
          border-border
          bg-white
          p-2
          sm:h-24
          sm:w-24
        "
      >
        <img
          src={
            equip.escudo
          }
          alt={`Escut de ${equip.nombre}`}
          className="
            h-full
            w-full
            object-contain
          "
        />
      </div>
    );
  }

  return (
    <div
      className="
        flex
        h-20
        w-20
        shrink-0
        items-center
        justify-center
        rounded-2xl
        bg-primary/10
        text-3xl
        font-black
        text-primary
        sm:h-24
        sm:w-24
      "
    >
      {equip.nombre
        .charAt(
          0,
        )
        .toUpperCase()}
    </div>
  );
}

// ============================================================
// ESTADÍSTICA
// ============================================================

function Estadistica({
  etiqueta,
  valor,
  destacada = false,
}: {
  etiqueta: string;

  valor:
    number |
    string;

  destacada?: boolean;
}) {
  return (
    <div
      className={`
        px-2
        py-4
        text-center
        [&+&]:border-l
        [&+&]:border-border/50

        ${
          destacada
            ? "bg-primary/10"
            : ""
        }
      `}
    >
      <p
        className={`
          text-lg
          font-black
          sm:text-xl

          ${
            destacada
              ? "text-primary"
              : "text-neutral-titulos"
          }
        `}
      >
        {valor}
      </p>

      <p
        className="
          mt-1
          text-[9px]
          font-bold
          uppercase
          tracking-[0.12em]
          text-neutral
        "
      >
        {etiqueta}
      </p>
    </div>
  );
}

// ============================================================
// FORMA
// ============================================================

function Forma({
  forma,
}: {
  forma:
    FormaPartido[];
}) {
  return (
    <div
      className="
        flex
        items-center
        gap-1.5
      "
    >
      {forma.map(
        (
          partit,
          index,
        ) => {
          const marcador =
            partit.marcadorFavor !==
              null &&
            partit.marcadorContra !==
              null
              ? ` · ${partit.marcadorFavor}-${partit.marcadorContra}`
              : "";

          const jornada =
            partit.jornada !==
              null
              ? `Jornada ${partit.jornada} · `
              : "";

          return (
            <img
              key={`${partit.partidoID ?? "pendent"}-${index}`}
              src={
                ICONOS_FORMA[
                  partit.estado
                ]
              }
              alt={
                nomForma(
                  partit.estado,
                )
              }
              title={`${jornada}${nomForma(
                partit.estado,
              )}${marcador}`}
              className="
                h-6
                w-6
                shrink-0
                object-contain
              "
            />
          );
        },
      )}
    </div>
  );
}

// ============================================================
// PARTIDO DESTACADO
// ============================================================

function PartitDestacat({
  partido,
  torneoID,
}: {
  partido:
    Partido;

  torneoID:
    string;
}) {
  return (
    <a
      href={`/tornejos/${encodeURIComponent(
        torneoID,
      )}/partits/${encodeURIComponent(
        partido.id,
      )}`}
      className="
        mt-4
        block
        overflow-hidden
        rounded-3xl
        border
        border-border
        bg-card
        transition
        hover:border-primary/30
        hover:shadow-md
      "
    >
      <div
        className="
          grid
          grid-cols-[1fr_auto_1fr]
          items-center
          gap-3
          px-4
          py-7
          sm:px-8
        "
      >
        <EquipPartit
          equip={
            partido.local
          }
          dreta
        />

        <div
          className="
            min-w-24
            text-center
          "
        >
          {partido.enCurso ? (
            <span
              className="
                text-xs
                font-bold
                uppercase
                tracking-wider
                text-red-600
              "
            >
              En directe
            </span>
          ) : partido.fechaHora ? (
            <p
              className="
                text-2xl
                font-black
                text-primary
              "
            >
              {formatHora(
                partido.fechaHora,
              )}
            </p>
          ) : (
            <p
              className="
                text-lg
                font-black
                text-primary
              "
            >
              VS
            </p>
          )}

          {partido.jornada !==
            null && (
            <p
              className="
                mt-1
                text-[10px]
                font-bold
                uppercase
                tracking-wider
                text-neutral
              "
            >
              Jornada {
                partido.jornada
              }
            </p>
          )}

          {partido.fechaHora && (
            <p
              className="
                mt-1
                text-[11px]
                text-neutral
              "
            >
              {formatData(
                partido.fechaHora,
              )}
            </p>
          )}

          {partido.pista && (
            <p
              className="
                mt-1
                text-[11px]
                font-semibold
                text-neutral
              "
            >
              {
                partido.pista
              }
            </p>
          )}
        </div>

        <EquipPartit
          equip={
            partido.visitante
          }
        />
      </div>

      <div
        className="
          border-t
          border-border/60
          bg-background/30
          px-5
          py-3
          text-right
          text-xs
          font-bold
          text-primary
        "
      >
        Veure detalls del partit →
      </div>
    </a>
  );
}

// ============================================================
// FILA PARTIDO
// ============================================================

function FilaPartit({
  partido,
  equipoID,
  torneoID,
}: {
  partido:
    Partido;

  equipoID:
    string;

  torneoID:
    string;
}) {
  const esLocal =
    partido.local?.id ===
    equipoID;

  const rival =
    esLocal
      ? partido.visitante
      : partido.local;

  const favor =
    esLocal
      ? partido.resultadoLocal
      : partido.resultadoVisitante;

  const contra =
    esLocal
      ? partido.resultadoVisitante
      : partido.resultadoLocal;

  return (
    <a
      href={`/tornejos/${encodeURIComponent(
        torneoID,
      )}/partits/${encodeURIComponent(
        partido.id,
      )}`}
      className="
        grid
        grid-cols-[auto_minmax(0,1fr)_auto]
        items-center
        gap-3
        border-b
        border-border/50
        px-4
        py-4
        transition
        last:border-b-0
        hover:bg-background/40
        sm:px-5
      "
    >
      <EstatResultat
        estat={
          partido.resultadoEquipo
        }
      />

      <div
        className="
          min-w-0
        "
      >
        <p
          className="
            truncate
            text-sm
            font-semibold
            text-neutral-titulos
          "
        >
          {rival?.nombre ??
            "Per determinar"}
        </p>

        <div
          className="
            mt-0.5
            flex
            flex-wrap
            items-center
            gap-x-2
            text-xs
            text-neutral
          "
        >
          {partido.jornada !==
            null && (
            <span>
              Jornada {
                partido.jornada
              }
            </span>
          )}

          {partido.fechaHora && (
            <span>
              {formatData(
                partido.fechaHora,
              )}
            </span>
          )}
        </div>
      </div>

      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <span
          className="
            text-lg
            font-black
            text-neutral-titulos
          "
        >
          {favor ??
            "—"}{" "}
          -{" "}
          {contra ??
            "—"}
        </span>

        <span
          className="
            text-primary
          "
        >
          →
        </span>
      </div>
    </a>
  );
}

// ============================================================
// EQUIPO PARTIDO
// ============================================================

function EquipPartit({
  equip,
  dreta = false,
}: {
  equip:
    Equipo | null;

  dreta?: boolean;
}) {
  return (
    <div
      className={`
        flex
        min-w-0
        items-center
        gap-3

        ${
          dreta
            ? "justify-end text-right"
            : "justify-start text-left"
        }
      `}
    >
      {dreta ? (
        <>
          <NomEquip
            equip={
              equip
            }
          />

          <MiniEscut
            equip={
              equip
            }
          />
        </>
      ) : (
        <>
          <MiniEscut
            equip={
              equip
            }
          />

          <NomEquip
            equip={
              equip
            }
          />
        </>
      )}
    </div>
  );
}

function NomEquip({
  equip,
}: {
  equip:
    Equipo | null;
}) {
  return (
    <span
      className="
        hidden
        truncate
        text-sm
        font-bold
        text-neutral-titulos
        sm:block
      "
    >
      {equip?.nombre ??
        "Per determinar"}
    </span>
  );
}

function MiniEscut({
  equip,
}: {
  equip:
    Equipo | null;
}) {
  if (
    equip?.escudo
  ) {
    return (
      <div
        className="
          flex
          h-11
          w-11
          shrink-0
          items-center
          justify-center
          rounded-xl
          border
          border-border
          bg-white
          p-1.5
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
    );
  }

  return (
    <div
      className="
        flex
        h-11
        w-11
        shrink-0
        items-center
        justify-center
        rounded-xl
        bg-primary/10
        text-sm
        font-black
        text-primary
      "
    >
      {equip?.nombre
        ?.charAt(
          0,
        )
        .toUpperCase() ??
        "?"}
    </div>
  );
}

// ============================================================
// RESULTADO
// ============================================================

function EstatResultat({
  estat,
}: {
  estat:
    EstadoForma;
}) {
  const configuracio =
    estat ===
    "GANADO"
      ? {
          text:
            "Victòria",

          clase:
            "bg-green-50 text-green-700",
        }
      : estat ===
          "PERDIDO"
        ? {
            text:
              "Derrota",

            clase:
              "bg-red-50 text-red-700",
          }
        : estat ===
            "EMPATADO"
          ? {
              text:
                "Empat",

              clase:
                "bg-background text-neutral",
            }
          : {
              text:
                "Pendent",

              clase:
                "bg-background text-neutral",
            };

  return (
    <span
      className={`
        rounded-full
        px-2.5
        py-1
        text-[9px]
        font-black
        uppercase
        tracking-wider
        ${configuracio.clase}
      `}
    >
      {
        configuracio.text
      }
    </span>
  );
}

// ============================================================
// DISCIPLINA
// ============================================================

function Disciplina({
  icono,
  valor,
  etiqueta,
}: {
  icono: string;

  valor: number;

  etiqueta: string;
}) {
  return (
    <div
      className="
        rounded-2xl
        bg-background/60
        p-4
        text-center
      "
    >
      <img
        src={
          icono
        }
        alt=""
        aria-hidden="true"
        className="
          mx-auto
          h-7
          w-7
          object-contain
        "
      />

      <p
        className="
          mt-2
          text-2xl
          font-black
          text-neutral-titulos
        "
      >
        {valor}
      </p>

      <p
        className="
          mt-1
          text-[10px]
          font-bold
          uppercase
          tracking-wider
          text-neutral
        "
      >
        {etiqueta}
      </p>
    </div>
  );
}

// ============================================================
// TITULO SECCIÓN
// ============================================================

function TitolSeccio({
  superior,
  titulo,
}: {
  superior: string;

  titulo: string;
}) {
  return (
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
        {superior}
      </p>

      <h2
        className="
          mt-1
          text-xl
          font-bold
          text-neutral-titulos
          sm:text-2xl
        "
      >
        {titulo}
      </h2>
    </div>
  );
}

// ============================================================
// ESTADO VACÍO
// ============================================================

function EstatBuit({
  text,
}: {
  text: string;
}) {
  return (
    <div
      className="
        mt-4
        rounded-3xl
        border
        border-dashed
        border-border
        bg-card/40
        px-6
        py-10
        text-center
        text-sm
        text-neutral
      "
    >
      {text}
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function nomForma(
  estat:
    EstadoForma,
) {
  switch (
    estat
  ) {
    case "GANADO":
      return "Guanyat";

    case "EMPATADO":
      return "Empatat";

    case "PERDIDO":
      return "Perdut";

    case "PENDIENTE":
    default:
      return "Per jugar";
  }
}

function formatDiferencia(
  valor:
    number,
) {
  return valor >
    0
    ? `+${valor}`
    : String(
        valor,
      );
}

function formatHora(
  valor:
    string,
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
    return "—";
  }

  return new Intl.DateTimeFormat(
    "ca-ES",
    {
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

function formatData(
  valor:
    string,
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
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      timeZone:
        "Europe/Madrid",
    },
  ).format(
    data,
  );
}

// ============================================================
// ICONOS UI
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