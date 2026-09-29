import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type EquipoDB = {
  id: string;
  formulario_id: string;
  nombre: string | null;
  escudo: string | null;
  capitan_id: string | null;
  validacion_estado: string | null;
  plaza_estado: string | null;
};

type ParticipanteDB = {
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

type GrupoDB = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
  estado: string;
};

type FaseDB = {
  id: string;
  nombre: string;
  orden: number;
};

type PlazaDB = {
  destino_tipo: string;
  grupo_id: string | null;
  partido_id: string | null;
  lado: string | null;
  orden: number;
  equipo_origen_id: string | null;
  equipo_resuelto_id: string | null;
};

type PartidoDB = {
  id: string;
  tipo: string;
  grupo_id: string | null;
  codigo: string;
  nombre: string | null;
  orden: number;
  jornada: number | null;
  estado: string;
  fecha_hora: string | null;
  pista: string | null;
  finalizado_at: string | null;
};

type ResultadoDB = {
  id: string;
  partido_id: string;
  marcador_local: number | null;
  marcador_visitante: number | null;
  resultado_tipo: string;
  confirmado: boolean;
  confirmado_at: string | null;
  created_at: string;
  updated_at: string;
};

type EventoDB = {
  partido_id: string;
  tipo_evento: string;
  equipo_id: string | null;
  jugador_id: string | null;
  jugador_nombre: string | null;
  estado: string;
};

type EquipoPublico = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type ResultadoEquipo =
  | "GANADO"
  | "EMPATADO"
  | "PERDIDO"
  | "PENDIENTE";

type PartidoPublico = {
  id: string;

  codigo: string;

  nombre: string | null;

  jornada: number | null;

  estado: string;

  fechaHora: string | null;

  pista: string | null;

  local: EquipoPublico | null;

  visitante: EquipoPublico | null;

  resultadoLocal: number | null;

  resultadoVisitante: number | null;

  resultadoConfirmado: boolean;

  finalizado: boolean;

  enCurso: boolean;

  resultadoEquipo: ResultadoEquipo;
};

// ============================================================
// CONSTANTES
// ============================================================

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================================
// HELPERS
// ============================================================

function normalizarEstado(
  valor: string | null | undefined,
) {
  return valor?.trim().toUpperCase() ?? "";
}

function nombreCompleto(
  participante:
    | ParticipanteDB
    | null
    | undefined,
) {
  if (!participante) {
    return null;
  }

  const partes = [
    participante.nombre,
    participante.apellido1,
    participante.apellido2,
  ]
    .filter(
      (
        parte,
      ): parte is string =>
        typeof parte === "string" &&
        Boolean(
          parte.trim(),
        ),
    )
    .map(
      parte =>
        parte.trim(),
    );

  return partes.length > 0
    ? partes.join(" ")
    : null;
}

// ============================================================
// RESULTADOS
// ============================================================

function tiempoResultado(
  resultado: ResultadoDB,
) {
  const fecha =
    resultado.updated_at ||
    resultado.confirmado_at ||
    resultado.created_at;

  const tiempo =
    new Date(
      fecha,
    ).getTime();

  return Number.isFinite(
    tiempo,
  )
    ? tiempo
    : 0;
}

function crearMapaResultados(
  resultados:
    ResultadoDB[],
) {
  const agrupados =
    new Map<
      string,
      ResultadoDB[]
    >();

  for (
    const resultado
    of resultados
  ) {
    const lista =
      agrupados.get(
        resultado.partido_id,
      ) ?? [];

    lista.push(
      resultado,
    );

    agrupados.set(
      resultado.partido_id,
      lista,
    );
  }

  const mapa =
    new Map<
      string,
      ResultadoDB
    >();

  for (
    const [
      partidoID,
      lista,
    ]
    of agrupados
  ) {
    lista.sort(
      (
        a,
        b,
      ) => {
        if (
          a.confirmado !==
          b.confirmado
        ) {
          return a.confirmado
            ? -1
            : 1;
        }

        return (
          tiempoResultado(b) -
          tiempoResultado(a)
        );
      },
    );

    if (
      lista[0]
    ) {
      mapa.set(
        partidoID,
        lista[0],
      );
    }
  }

  return mapa;
}

// ============================================================
// PLAZA
// ============================================================

function equipoDePlaza(
  plaza:
    PlazaDB |
    null |
    undefined,
) {
  return (
    plaza
      ?.equipo_resuelto_id ??
    plaza
      ?.equipo_origen_id ??
    null
  );
}

// ============================================================
// TIEMPO PARTIDO
// ============================================================

function tiempoPartido(
  partido:
    PartidoDB,
) {
  if (
    !partido.fecha_hora
  ) {
    return null;
  }

  const tiempo =
    new Date(
      partido.fecha_hora,
    ).getTime();

  return Number.isFinite(
    tiempo,
  )
    ? tiempo
    : null;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute =
  async ({
    url,
  }) => {
    try {
      const torneoID =
        url.searchParams.get(
          "torneoID",
        );

      const edicionID =
        url.searchParams.get(
          "edicionID",
        );

      const equipoID =
        url.searchParams.get(
          "equipoID",
        );

      // ======================================================
      // VALIDACIÓN
      // ======================================================

      if (
        !torneoID ||
        !UUID.test(
          torneoID,
        )
      ) {
        return Response.json(
          {
            mensaje:
              "L'identificador del torneig no és vàlid.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !edicionID ||
        !UUID.test(
          edicionID,
        )
      ) {
        return Response.json(
          {
            mensaje:
              "L'identificador de l'edició no és vàlid.",
          },
          {
            status: 400,
          },
        );
      }

      if (
        !equipoID ||
        !UUID.test(
          equipoID,
        )
      ) {
        return Response.json(
          {
            mensaje:
              "L'identificador de l'equip no és vàlid.",
          },
          {
            status: 400,
          },
        );
      }

      // ======================================================
      // EQUIPO
      // ======================================================

      const {
        data:
          equipoData,
        error:
          equipoError,
      } =
        await supabaseAdmin
          .from(
            "equipos",
          )
          .select(`
            id,
            formulario_id,
            nombre,
            escudo,
            capitan_id,
            validacion_estado,
            plaza_estado
          `)
          .eq(
            "id",
            equipoID,
          )
          .eq(
            "validacion_estado",
            "APROBADO",
          )
          .eq(
            "plaza_estado",
            "CONFIRMADA",
          )
          .maybeSingle();

      if (
        equipoError
      ) {
        throw equipoError;
      }

      if (
        !equipoData
      ) {
        return Response.json(
          {
            mensaje:
              "No s'ha trobat l'equip.",
          },
          {
            status: 404,
          },
        );
      }

      const equipo =
        equipoData as EquipoDB;

      // ======================================================
      // FORMULARIO
      // ======================================================

      const {
        data:
          formularioData,
        error:
          formularioError,
      } =
        await supabaseAdmin
          .from(
            "formularios",
          )
          .select(
            "id,edicion_id,tipo,estado",
          )
          .eq(
            "id",
            equipo.formulario_id,
          )
          .eq(
            "edicion_id",
            edicionID,
          )
          .eq(
            "tipo",
            "EQUIPO",
          )
          .eq(
            "estado",
            "APROBADO",
          )
          .maybeSingle();

      if (
        formularioError
      ) {
        throw formularioError;
      }

      if (
        !formularioData
      ) {
        return Response.json(
          {
            mensaje:
              "Aquest equip no pertany a l'edició indicada.",
          },
          {
            status: 404,
          },
        );
      }

      // ======================================================
      // TORNEO / EDICIÓN
      // ======================================================

      const [
        torneoRespuesta,
        edicionRespuesta,
      ] =
        await Promise.all([
          supabaseAdmin
            .from(
              "torneos",
            )
            .select(
              "id,nombre,deporte,activo",
            )
            .eq(
              "id",
              torneoID,
            )
            .eq(
              "activo",
              true,
            )
            .maybeSingle(),

          supabaseAdmin
            .from(
              "ediciones",
            )
            .select(
              "id,torneo_id,nombre,estado",
            )
            .eq(
              "id",
              edicionID,
            )
            .eq(
              "torneo_id",
              torneoID,
            )
            .maybeSingle(),
        ]);

      if (
        torneoRespuesta.error
      ) {
        throw torneoRespuesta.error;
      }

      if (
        edicionRespuesta.error
      ) {
        throw edicionRespuesta.error;
      }

      if (
        !torneoRespuesta.data ||
        !edicionRespuesta.data
      ) {
        return Response.json(
          {
            mensaje:
              "No s'ha trobat el torneig o l'edició.",
          },
          {
            status: 404,
          },
        );
      }

      const deporte =
        torneoRespuesta.data
          .deporte
          ?.trim()
          .toLowerCase() ??
        "";

      const esFutbol =
        deporte.includes(
          "fut",
        );

      // ======================================================
      // PLANTILLA
      // ======================================================

      const {
        data:
          participantesData,
        error:
          participantesError,
      } =
        await supabaseAdmin
          .from(
            "participantes_equipo",
          )
          .select(`
            id,
            equipo_id,
            nombre,
            apellido1,
            apellido2,
            tipo_participante,
            validacion_estado,
            orden,
            activo
          `)
          .eq(
            "equipo_id",
            equipoID,
          )
          .eq(
            "activo",
            true,
          )
          .eq(
            "tipo_participante",
            "JUGADOR",
          )
          .eq(
            "validacion_estado",
            "APROBADO",
          )
          .order(
            "orden",
            {
              ascending:
                true,

              nullsFirst:
                false,
            },
          );

      if (
        participantesError
      ) {
        throw participantesError;
      }

      const participantes =
        (
          participantesData ??
          []
        ) as ParticipanteDB[];

      const capitan =
        participantes.find(
          participante =>
            participante.id ===
            equipo.capitan_id,
        ) ??
        null;

      const plantilla =
        participantes.map(
          participante => ({
            id:
              participante.id,

            nombre:
              nombreCompleto(
                participante,
              ) ??
              "Jugador",

            capitan:
              participante.id ===
              equipo.capitan_id,
          }),
        );

      // ======================================================
      // GRUPOS DEL EQUIPO
      // ======================================================

      const {
        data:
          plazasGrupoData,
        error:
          plazasGrupoError,
      } =
        await supabaseAdmin
          .from(
            "competicion_plazas",
          )
          .select(`
            destino_tipo,
            grupo_id,
            partido_id,
            lado,
            orden,
            equipo_origen_id,
            equipo_resuelto_id
          `)
          .eq(
            "edicion_id",
            edicionID,
          )
          .eq(
            "destino_tipo",
            "GRUPO",
          )
          .or(
            `equipo_resuelto_id.eq.${equipoID},equipo_origen_id.eq.${equipoID}`,
          );

      if (
        plazasGrupoError
      ) {
        throw plazasGrupoError;
      }

      const plazasGrupo =
        (
          plazasGrupoData ??
          []
        ) as PlazaDB[];

      const gruposIDs =
        [
          ...new Set(
            plazasGrupo
              .map(
                plaza =>
                  plaza.grupo_id,
              )
              .filter(
                (
                  id,
                ): id is string =>
                  Boolean(
                    id,
                  ),
              ),
          ),
        ];

      let grupo:
        {
          id: string;
          nombre: string;
          faseID: string;
          faseNombre: string;
        } |
        null =
        null;

      if (
        gruposIDs.length >
        0
      ) {
        const {
          data:
            gruposData,
          error:
            gruposError,
        } =
          await supabaseAdmin
            .from(
              "competicion_grupos",
            )
            .select(
              "id,fase_id,nombre,orden,estado",
            )
            .in(
              "id",
              gruposIDs,
            );

        if (
          gruposError
        ) {
          throw gruposError;
        }

        const grupos =
          (
            gruposData ??
            []
          ) as GrupoDB[];

        const fasesIDs =
          [
            ...new Set(
              grupos.map(
                grupo =>
                  grupo.fase_id,
              ),
            ),
          ];

        const {
          data:
            fasesData,
          error:
            fasesError,
        } =
          fasesIDs.length >
          0
            ? await supabaseAdmin
                .from(
                  "competicion_fases",
                )
                .select(
                  "id,nombre,orden",
                )
                .in(
                  "id",
                  fasesIDs,
                )
            : {
                data:
                  [],

                error:
                  null,
              };

        if (
          fasesError
        ) {
          throw fasesError;
        }

        const fases =
          (
            fasesData ??
            []
          ) as FaseDB[];

        const fasesPorID =
          new Map(
            fases.map(
              fase => [
                fase.id,
                fase,
              ],
            ),
          );

        grupos.sort(
          (
            a,
            b,
          ) => {
            const faseA =
              fasesPorID.get(
                a.fase_id,
              );

            const faseB =
              fasesPorID.get(
                b.fase_id,
              );

            const ordenFase =
              (
                faseB?.orden ??
                0
              ) -
              (
                faseA?.orden ??
                0
              );

            if (
              ordenFase !==
              0
            ) {
              return ordenFase;
            }

            return (
              b.orden -
              a.orden
            );
          },
        );

        const grupoSeleccionado =
          grupos[0];

        if (
          grupoSeleccionado
        ) {
          const fase =
            fasesPorID.get(
              grupoSeleccionado.fase_id,
            );

          grupo = {
            id:
              grupoSeleccionado.id,

            nombre:
              grupoSeleccionado.nombre,

            faseID:
              grupoSeleccionado.fase_id,

            faseNombre:
              fase?.nombre ??
              "Fase de grups",
          };
        }
      }

      // ======================================================
      // PLAZAS DE PARTIDO DEL EQUIPO
      // ======================================================

      const {
        data:
          plazasEquipoData,
        error:
          plazasEquipoError,
      } =
        await supabaseAdmin
          .from(
            "competicion_plazas",
          )
          .select(`
            destino_tipo,
            grupo_id,
            partido_id,
            lado,
            orden,
            equipo_origen_id,
            equipo_resuelto_id
          `)
          .eq(
            "edicion_id",
            edicionID,
          )
          .eq(
            "destino_tipo",
            "PARTIDO",
          )
          .or(
            `equipo_resuelto_id.eq.${equipoID},equipo_origen_id.eq.${equipoID}`,
          );

      if (
        plazasEquipoError
      ) {
        throw plazasEquipoError;
      }

      const plazasEquipo =
        (
          plazasEquipoData ??
          []
        ) as PlazaDB[];

      const partidosIDs =
        [
          ...new Set(
            plazasEquipo
              .map(
                plaza =>
                  plaza.partido_id,
              )
              .filter(
                (
                  id,
                ): id is string =>
                  Boolean(
                    id,
                  ),
              ),
          ),
        ];

      // ======================================================
      // SIN PARTIDOS
      // ======================================================

      if (
        partidosIDs.length ===
        0
      ) {
        return Response.json(
          {
            data: {
              torneo: {
                id:
                  torneoRespuesta.data.id,

                nombre:
                  torneoRespuesta.data.nombre,

                deporte:
                  torneoRespuesta.data.deporte,
              },

              edicion: {
                id:
                  edicionRespuesta.data.id,

                nombre:
                  edicionRespuesta.data.nombre,
              },

              equipo: {
                id:
                  equipo.id,

                nombre:
                  equipo.nombre ??
                  "Equip",

                escudo:
                  equipo.escudo,

                capitan:
                  nombreCompleto(
                    capitan,
                  ),
              },

              esFutbol,

              grupo,

              plantilla,

              resumen: {
                pj:
                  0,

                pg:
                  0,

                pe:
                  0,

                pp:
                  0,

                favor:
                  0,

                contra:
                  0,

                diferencia:
                  0,
              },

              proximoPartido:
                null,

              ultimosPartidos:
                [],

              maximosAnotadores:
                [],

              disciplina: {
                amarillas:
                  0,

                rojas:
                  0,
              },
            },
          },
          {
            headers: {
              "Cache-Control":
                "no-store",
            },
          },
        );
      }

      // ======================================================
      // PARTIDOS / PLAZAS / RESULTADOS
      // ======================================================

      const [
        partidosRespuesta,
        plazasRespuesta,
        resultadosRespuesta,
      ] =
        await Promise.all([
          supabaseAdmin
            .from(
              "competicion_partidos",
            )
            .select(`
              id,
              tipo,
              grupo_id,
              codigo,
              nombre,
              orden,
              jornada,
              estado,
              fecha_hora,
              pista,
              finalizado_at
            `)
            .in(
              "id",
              partidosIDs,
            ),

          supabaseAdmin
            .from(
              "competicion_plazas",
            )
            .select(`
              destino_tipo,
              grupo_id,
              partido_id,
              lado,
              orden,
              equipo_origen_id,
              equipo_resuelto_id
            `)
            .eq(
              "edicion_id",
              edicionID,
            )
            .eq(
              "destino_tipo",
              "PARTIDO",
            )
            .in(
              "partido_id",
              partidosIDs,
            ),

          supabaseAdmin
            .from(
              "competicion_resultados",
            )
            .select(`
              id,
              partido_id,
              marcador_local,
              marcador_visitante,
              resultado_tipo,
              confirmado,
              confirmado_at,
              created_at,
              updated_at
            `)
            .eq(
              "edicion_id",
              edicionID,
            )
            .in(
              "partido_id",
              partidosIDs,
            ),
        ]);

      if (
        partidosRespuesta.error
      ) {
        throw partidosRespuesta.error;
      }

      if (
        plazasRespuesta.error
      ) {
        throw plazasRespuesta.error;
      }

      if (
        resultadosRespuesta.error
      ) {
        throw resultadosRespuesta.error;
      }

      const partidos =
        (
          partidosRespuesta.data ??
          []
        ) as PartidoDB[];

      const plazasPartido =
        (
          plazasRespuesta.data ??
          []
        ) as PlazaDB[];

      const resultados =
        (
          resultadosRespuesta.data ??
          []
        ) as ResultadoDB[];

      const resultadosPorPartido =
        crearMapaResultados(
          resultados,
        );

      // ======================================================
      // EQUIPOS RIVALES
      // ======================================================

      const equiposIDs =
        new Set<string>();

      equiposIDs.add(
        equipoID,
      );

      for (
        const plaza
        of plazasPartido
      ) {
        const id =
          equipoDePlaza(
            plaza,
          );

        if (
          id
        ) {
          equiposIDs.add(
            id,
          );
        }
      }

      const {
        data:
          equiposData,
        error:
          equiposError,
      } =
        await supabaseAdmin
          .from(
            "equipos",
          )
          .select(
            "id,nombre,escudo",
          )
          .in(
            "id",
            Array.from(
              equiposIDs,
            ),
          );

      if (
        equiposError
      ) {
        throw equiposError;
      }

      const equiposPorID =
        new Map<
          string,
          EquipoPublico
        >(
          (
            equiposData ??
            []
          ).map(
            item => [
              item.id,

              {
                id:
                  item.id,

                nombre:
                  item.nombre ??
                  "Equip",

                escudo:
                  item.escudo ??
                  null,
              },
            ],
          ),
        );

      // ======================================================
      // CONVERTIR PARTIDOS
      // ======================================================

      const partidosPublicos:
        PartidoPublico[] =
        partidos.map(
          partido => {
            const plazaLocal =
              plazasPartido.find(
                plaza =>
                  plaza.partido_id ===
                    partido.id &&
                  plaza.lado ===
                    "LOCAL",
              );

            const plazaVisitante =
              plazasPartido.find(
                plaza =>
                  plaza.partido_id ===
                    partido.id &&
                  plaza.lado ===
                    "VISITANTE",
              );

            const localID =
              equipoDePlaza(
                plazaLocal,
              );

            const visitanteID =
              equipoDePlaza(
                plazaVisitante,
              );

            const resultado =
              resultadosPorPartido.get(
                partido.id,
              );

            let resultadoEquipo:
              ResultadoEquipo =
              "PENDIENTE";

            // ==================================================
            // RESULTADO DEL EQUIPO
            //
            // La comprobación se hace directamente sobre los
            // marcadores para que TypeScript sepa que ambos son
            // number y no puedan ser null.
            // ==================================================

            if (
              resultado &&
              resultado.confirmado &&
              typeof resultado.marcador_local ===
                "number" &&
              typeof resultado.marcador_visitante ===
                "number"
            ) {
              const marcadorLocal:
                number =
                resultado.marcador_local;

              const marcadorVisitante:
                number =
                resultado.marcador_visitante;

              const favor:
                number =
                localID ===
                equipoID
                  ? marcadorLocal
                  : marcadorVisitante;

              const contra:
                number =
                localID ===
                equipoID
                  ? marcadorVisitante
                  : marcadorLocal;

              if (
                favor >
                contra
              ) {
                resultadoEquipo =
                  "GANADO";
              } else if (
                favor <
                contra
              ) {
                resultadoEquipo =
                  "PERDIDO";
              } else {
                resultadoEquipo =
                  "EMPATADO";
              }
            }

            const estado =
              normalizarEstado(
                partido.estado,
              );

            const finalizado =
              Boolean(
                partido.finalizado_at,
              ) ||
              resultado
                ?.confirmado ===
                true ||
              estado ===
                "FINALIZADO" ||
              estado ===
                "CERRADO";

            const enCurso =
              estado ===
                "EN_CURSO" ||
              estado ===
                "EN CURSO";

            return {
              id:
                partido.id,

              codigo:
                partido.codigo,

              nombre:
                partido.nombre,

              jornada:
                partido.jornada,

              estado:
                partido.estado,

              fechaHora:
                partido.fecha_hora,

              pista:
                partido.pista,

              local:
                localID
                  ? equiposPorID.get(
                      localID,
                    ) ??
                    null
                  : null,

              visitante:
                visitanteID
                  ? equiposPorID.get(
                      visitanteID,
                    ) ??
                    null
                  : null,

              resultadoLocal:
                resultado
                  ?.marcador_local ??
                null,

              resultadoVisitante:
                resultado
                  ?.marcador_visitante ??
                null,

              resultadoConfirmado:
                resultado
                  ?.confirmado ??
                false,

              finalizado,

              enCurso,

              resultadoEquipo,
            };
          },
        );

      // ======================================================
      // RESUMEN
      // ======================================================

      const resumen = {
        pj:
          0,

        pg:
          0,

        pe:
          0,

        pp:
          0,

        favor:
          0,

        contra:
          0,

        diferencia:
          0,
      };

      for (
        const partido
        of partidosPublicos
      ) {
        if (
          !partido
            .resultadoConfirmado ||
          typeof partido
            .resultadoLocal !==
            "number" ||
          typeof partido
            .resultadoVisitante !==
            "number"
        ) {
          continue;
        }

        resumen.pj++;

        const esLocal =
          partido.local?.id ===
          equipoID;

        const marcadorLocal:
          number =
          partido.resultadoLocal;

        const marcadorVisitante:
          number =
          partido.resultadoVisitante;

        const favor:
          number =
          esLocal
            ? marcadorLocal
            : marcadorVisitante;

        const contra:
          number =
          esLocal
            ? marcadorVisitante
            : marcadorLocal;

        resumen.favor +=
          favor;

        resumen.contra +=
          contra;

        if (
          favor >
          contra
        ) {
          resumen.pg++;
        } else if (
          favor <
          contra
        ) {
          resumen.pp++;
        } else {
          resumen.pe++;
        }
      }

      resumen.diferencia =
        resumen.favor -
        resumen.contra;

      // ======================================================
      // ÚLTIMOS PARTIDOS
      // ======================================================

      const ultimosPartidos =
        partidosPublicos
          .filter(
            partido =>
              partido.resultadoConfirmado,
          )
          .sort(
            (
              a,
              b,
            ) => {
              const partidoA =
                partidos.find(
                  item =>
                    item.id ===
                    a.id,
                );

              const partidoB =
                partidos.find(
                  item =>
                    item.id ===
                    b.id,
                );

              const fechaA =
                partidoA
                  ? tiempoPartido(
                      partidoA,
                    )
                  : null;

              const fechaB =
                partidoB
                  ? tiempoPartido(
                      partidoB,
                    )
                  : null;

              if (
                fechaA !==
                  null &&
                fechaB !==
                  null &&
                fechaA !==
                  fechaB
              ) {
                return (
                  fechaB -
                  fechaA
                );
              }

              return (
                (
                  partidoB?.orden ??
                  0
                ) -
                (
                  partidoA?.orden ??
                  0
                )
              );
            },
          )
          .slice(
            0,
            5,
          );

      // ======================================================
      // PRÓXIMO PARTIDO
      // ======================================================

      const pendientes =
        partidosPublicos
          .filter(
            partido =>
              !partido.finalizado,
          )
          .sort(
            (
              a,
              b,
            ) => {
              const partidoA =
                partidos.find(
                  item =>
                    item.id ===
                    a.id,
                );

              const partidoB =
                partidos.find(
                  item =>
                    item.id ===
                    b.id,
                );

              const fechaA =
                partidoA
                  ? tiempoPartido(
                      partidoA,
                    )
                  : null;

              const fechaB =
                partidoB
                  ? tiempoPartido(
                      partidoB,
                    )
                  : null;

              if (
                fechaA !==
                  null &&
                fechaB !==
                  null &&
                fechaA !==
                  fechaB
              ) {
                return (
                  fechaA -
                  fechaB
                );
              }

              if (
                fechaA !==
                  null &&
                fechaB ===
                  null
              ) {
                return -1;
              }

              if (
                fechaA ===
                  null &&
                fechaB !==
                  null
              ) {
                return 1;
              }

              return (
                (
                  partidoA?.orden ??
                  0
                ) -
                (
                  partidoB?.orden ??
                  0
                )
              );
            },
          );

      const proximoPartido =
        pendientes[0] ??
        null;

      // ======================================================
      // ACTA: GOLES + DISCIPLINA
      // ======================================================

      const maximosAnotadores:
        {
          jugadorID:
            string | null;

          nombre:
            string;

          goles:
            number;
        }[] =
        [];

      const disciplina = {
        amarillas:
          0,

        rojas:
          0,
      };

      const {
        data:
          eventosData,
        error:
          eventosError,
      } =
        await supabaseAdmin
          .from(
            "acta_eventos",
          )
          .select(`
            partido_id,
            tipo_evento,
            equipo_id,
            jugador_id,
            jugador_nombre,
            estado
          `)
          .in(
            "partido_id",
            partidosIDs,
          )
          .eq(
            "equipo_id",
            equipoID,
          )
          .eq(
            "estado",
            "ACTIVO",
          )
          .in(
            "tipo_evento",
            [
              "GOL",
              "PENALTI_MARCADO",
              "TARJETA_AMARILLA",
              "TARJETA_ROJA",
            ],
          );

      if (
        eventosError
      ) {
        throw eventosError;
      }

      const eventos =
        (
          eventosData ??
          []
        ) as EventoDB[];

      const golesPorJugador =
        new Map<
          string,
          {
            jugadorID:
              string | null;

            nombre:
              string;

            goles:
              number;
          }
        >();

      for (
        const evento
        of eventos
      ) {
        if (
          evento.tipo_evento ===
          "TARJETA_AMARILLA"
        ) {
          disciplina.amarillas++;

          continue;
        }

        if (
          evento.tipo_evento ===
          "TARJETA_ROJA"
        ) {
          disciplina.rojas++;

          continue;
        }

        if (
          evento.tipo_evento !==
            "GOL" &&
          evento.tipo_evento !==
            "PENALTI_MARCADO"
        ) {
          continue;
        }

        if (
          !evento.jugador_nombre
        ) {
          continue;
        }

        const clave =
          evento.jugador_id ??
          `nom:${evento.jugador_nombre}`;

        const actual =
          golesPorJugador.get(
            clave,
          ) ?? {
            jugadorID:
              evento.jugador_id,

            nombre:
              evento.jugador_nombre,

            goles:
              0,
          };

        actual.goles++;

        golesPorJugador.set(
          clave,
          actual,
        );
      }

      maximosAnotadores.push(
        ...Array.from(
          golesPorJugador.values(),
        )
          .sort(
            (
              a,
              b,
            ) =>
              b.goles -
                a.goles ||
              a.nombre.localeCompare(
                b.nombre,
                "ca",
              ),
          )
          .slice(
            0,
            5,
          ),
      );

      // ======================================================
      // RESPUESTA
      // ======================================================

      return Response.json(
        {
          data: {
            torneo: {
              id:
                torneoRespuesta.data.id,

              nombre:
                torneoRespuesta.data.nombre,

              deporte:
                torneoRespuesta.data.deporte,
            },

            edicion: {
              id:
                edicionRespuesta.data.id,

              nombre:
                edicionRespuesta.data.nombre,
            },

            equipo: {
              id:
                equipo.id,

              nombre:
                equipo.nombre ??
                "Equip",

              escudo:
                equipo.escudo,

              capitan:
                nombreCompleto(
                  capitan,
                ),
            },

            esFutbol,

            grupo,

            plantilla,

            resumen,

            proximoPartido,

            ultimosPartidos,

            maximosAnotadores,

            disciplina,
          },
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    } catch (
      error
    ) {
      console.error(
        "Error carregant la pàgina pública de l'equip:",
        error,
      );

      return Response.json(
        {
          mensaje:
            "No s'ha pogut carregar l'equip.",
        },
        {
          status: 500,

          headers: {
            "Cache-Control":
              "no-store",
          },
        },
      );
    }
  };