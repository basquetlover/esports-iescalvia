import type {
    APIRoute,
} from "astro";

import {
    supabaseAdmin,
} from "@utils/supabase";

import {
    obtenerUsuarioPorToken,
} from "@pages/api/sesiones/sesiones";

import {
    tieneAccesoTorneo,
    tienePermiso,
} from "@const/Permisos";

export const prerender =
    false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TAMANO_PAGINA =
    500;

// ============================================================
// TIPOS
// ============================================================

type Torneo = {
    id:
        string;

    nombre:
        string | null;

    deporte:
        string | null;

    descripcion:
        string | null;

    logo:
        string | null;

    banner:
        string | null;

    activo:
        boolean | null;

    created_at:
        string | null;

    updated_at:
        string | null;
};

type Edicion = {
    id:
        string;

    torneo_id:
        string | null;

    nombre:
        string | null;

    fecha_inicio:
        string | null;

    fecha_fin:
        string | null;

    estado:
        string | null;

    sede:
        string | null;

    created_at:
        string | null;

    updated_at:
        string | null;
};

type EstadoEdicion =
    | "BORRADOR"
    | "ACTIVA"
    | "FINALIZADA"
    | "SIN_ESTADO"
    | "DESCONOCIDO";

// ============================================================
// RESPUESTA
// ============================================================

function responder(
    datos:
        unknown,

    estado =
        200,
) {
    return Response.json(
        datos,
        {
            status:
                estado,

            headers: {
                "Cache-Control":
                    "private, no-store",
            },
        },
    );
}

// ============================================================
// ESTADOS
// ============================================================

function normalizarEstadoEdicion(
    estado:
        string | null,
): EstadoEdicion {
    const valor =
        estado
            ?.trim()
            .toLowerCase() ??
        "";

    if (
        !valor
    ) {
        return "SIN_ESTADO";
    }

    switch (
        valor
    ) {
        case "en_preparacio":
        case "en preparacio":
        case "en preparació":
        case "borrador":
        case "esborrany":
            return "BORRADOR";

        case "activa":
        case "activo":
        case "actiu":
        case "actual":
            return "ACTIVA";

        case "finalizada":
        case "finalizado":
        case "finalitzada":
        case "finalitzat":
            return "FINALIZADA";

        default:
            return "DESCONOCIDO";
    }
}

function estadoParaFrontend(
    estado:
        string | null,
): string | null {
    const normalizado =
        normalizarEstadoEdicion(
            estado,
        );

    if (
        normalizado ===
            "SIN_ESTADO"
    ) {
        return null;
    }

    if (
        normalizado ===
            "DESCONOCIDO"
    ) {
        return (
            estado?.trim() ??
            null
        );
    }

    return normalizado;
}

// ============================================================
// FECHAS
// ============================================================

function timestamp(
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return 0;
    }

    const numero =
        Date.parse(
            valor,
        );

    return Number.isFinite(
        numero,
    )
        ? numero
        : 0;
}

function ordenarActualizacion<
    T extends {
        created_at:
            string | null;

        updated_at:
            string | null;
    },
>(
    elementos:
        T[],
) {
    elementos.sort(
        (
            a,
            b,
        ) =>
            timestamp(
                b.updated_at ??
                    b.created_at,
            ) -
            timestamp(
                a.updated_at ??
                    a.created_at,
            ),
    );
}

// ============================================================
// GET
// ============================================================

export const GET:
    APIRoute =
    async ({
        cookies,
        url,
    }) => {
        try {
            // =================================================
            // SESIÓN
            // =================================================

            const token =
                cookies.get(
                    "token_sesion",
                )?.value;

            const usuario =
                token
                    ? await obtenerUsuarioPorToken(
                          token,
                      )
                    : null;

            if (
                !usuario
            ) {
                return responder(
                    {
                        mensaje:
                            "Has d'iniciar sessió.",
                    },
                    401,
                );
            }

            if (
                !tienePermiso(
                    usuario,
                    "panell",
                    "ver",
                )
            ) {
                return responder(
                    {
                        mensaje:
                            "No tens permís per accedir al panell.",
                    },
                    403,
                );
            }

            // =================================================
            // CONTEXTO
            // =================================================

            const torneoID =
                url.searchParams.get(
                    "torneoID",
                );

            const edicionID =
                url.searchParams.get(
                    "edicionID",
                );

            if (
                torneoID !==
                    null &&
                !UUID.test(
                    torneoID,
                )
            ) {
                return responder(
                    {
                        mensaje:
                            "L'identificador del torneig no és vàlid.",
                    },
                    400,
                );
            }

            if (
                edicionID !==
                    null &&
                (
                    !torneoID ||
                    !UUID.test(
                        edicionID,
                    )
                )
            ) {
                return responder(
                    {
                        mensaje:
                            "La selecció de l'edició no és vàlida.",
                    },
                    400,
                );
            }

            // =================================================
            // ACCESO TORNEO
            // =================================================

            if (
                torneoID &&
                (
                    !tieneAccesoTorneo(
                        usuario,
                        torneoID,
                    ) ||
                    !tienePermiso(
                        usuario,
                        "tornejos",
                        "ver",
                        torneoID,
                    )
                )
            ) {
                return responder(
                    {
                        mensaje:
                            "No tens accés a aquest torneig.",
                    },
                    403,
                );
            }

            // =================================================
            // TORNEOS
            // =================================================

            const torneos:
                Torneo[] = [];

            for (
                let inicio =
                    0;
                ;
                inicio +=
                    TAMANO_PAGINA
            ) {
                let consulta =
                    supabaseAdmin
                        .from(
                            "torneos",
                        )
                        .select(
                            "id,nombre,deporte,descripcion,logo,banner,activo,created_at,updated_at",
                        )
                        .order(
                            "id",
                        )
                        .range(
                            inicio,
                            inicio +
                                TAMANO_PAGINA -
                                1,
                        );

                if (
                    torneoID
                ) {
                    consulta =
                        consulta.eq(
                            "id",
                            torneoID,
                        );
                }

                const {
                    data,
                    error,
                } =
                    await consulta;

                if (
                    error
                ) {
                    throw error;
                }

                const pagina =
                    (
                        data ??
                        []
                    ) as Torneo[];

                for (
                    const torneo
                    of pagina
                ) {
                    if (
                        tieneAccesoTorneo(
                            usuario,
                            torneo.id,
                        ) &&
                        tienePermiso(
                            usuario,
                            "tornejos",
                            "ver",
                            torneo.id,
                        )
                    ) {
                        torneos.push(
                            torneo,
                        );
                    }
                }

                if (
                    pagina.length <
                        TAMANO_PAGINA ||
                    torneoID
                ) {
                    break;
                }
            }

            // =================================================
            // TORNEO SELECCIONADO
            // =================================================

            const torneoSeleccionado =
                torneoID
                    ? torneos.find(
                          torneo =>
                              torneo.id ===
                              torneoID,
                      ) ??
                      null
                    : null;

            if (
                torneoID &&
                !torneoSeleccionado
            ) {
                return responder(
                    {
                        mensaje:
                            "No s'ha trobat el torneig.",
                    },
                    404,
                );
            }

            // =================================================
            // PERMISOS EDICIONES
            // =================================================

            const torneosConPermisoEdiciones =
                torneos.filter(
                    torneo =>
                        tienePermiso(
                            usuario,
                            "edicions",
                            "ver",
                            torneo.id,
                        ),
                );

            if (
                edicionID &&
                !torneosConPermisoEdiciones.some(
                    torneo =>
                        torneo.id ===
                        torneoID,
                )
            ) {
                return responder(
                    {
                        mensaje:
                            "No tens permís per consultar aquesta edició.",
                    },
                    403,
                );
            }

            // =================================================
            // EDICIONES
            // =================================================

            const ediciones:
                Edicion[] = [];

            for (
                let grupo =
                    0;
                grupo <
                torneosConPermisoEdiciones.length;
                grupo +=
                    100
            ) {
                const identificadores =
                    torneosConPermisoEdiciones
                        .slice(
                            grupo,
                            grupo +
                                100,
                        )
                        .map(
                            torneo =>
                                torneo.id,
                        );

                if (
                    identificadores.length ===
                    0
                ) {
                    continue;
                }

                for (
                    let inicio =
                        0;
                    ;
                    inicio +=
                        TAMANO_PAGINA
                ) {
                    const {
                        data,
                        error,
                    } =
                        await supabaseAdmin
                            .from(
                                "ediciones",
                            )
                            .select(
                                "id,torneo_id,nombre,fecha_inicio,fecha_fin,estado,sede,created_at,updated_at",
                            )
                            .in(
                                "torneo_id",
                                identificadores,
                            )
                            .order(
                                "id",
                            )
                            .range(
                                inicio,
                                inicio +
                                    TAMANO_PAGINA -
                                    1,
                            );

                    if (
                        error
                    ) {
                        throw error;
                    }

                    const pagina =
                        (
                            data ??
                            []
                        ) as Edicion[];

                    ediciones.push(
                        ...pagina,
                    );

                    if (
                        pagina.length <
                        TAMANO_PAGINA
                    ) {
                        break;
                    }
                }
            }

            // =================================================
            // EDICIÓN SELECCIONADA
            // =================================================

            const edicionSeleccionada =
                edicionID
                    ? ediciones.find(
                          edicion =>
                              edicion.id ===
                                  edicionID &&
                              edicion.torneo_id ===
                                  torneoID,
                      ) ??
                      null
                    : null;

            if (
                edicionID &&
                !edicionSeleccionada
            ) {
                return responder(
                    {
                        mensaje:
                            "No s'ha trobat aquesta edició dins del torneig seleccionat.",
                    },
                    404,
                );
            }

            // =================================================
            // ORDEN
            // =================================================

            ordenarActualizacion(
                torneos,
            );

            ordenarActualizacion(
                ediciones,
            );

            // =================================================
            // MAPA TORNEOS
            // =================================================

            const torneosPorID =
                new Map(
                    torneos.map(
                        torneo => [
                            torneo.id,
                            torneo,
                        ],
                    ),
                );

            // =================================================
            // CANTIDAD EDICIONES
            // =================================================

            const cantidadEdiciones =
                new Map<
                    string,
                    number
                >();

            for (
                const edicion
                of ediciones
            ) {
                if (
                    !edicion.torneo_id
                ) {
                    continue;
                }

                cantidadEdiciones.set(
                    edicion.torneo_id,
                    (
                        cantidadEdiciones.get(
                            edicion.torneo_id,
                        ) ??
                        0
                    ) +
                        1,
                );
            }

            // =================================================
            // RESPUESTA TORNEOS
            // =================================================

            const torneosRespuesta =
                torneos.map(
                    torneo => ({
                        ...torneo,

                        total_ediciones:
                            tienePermiso(
                                usuario,
                                "edicions",
                                "ver",
                                torneo.id,
                            )
                                ? cantidadEdiciones.get(
                                      torneo.id,
                                  ) ??
                                  0
                                : null,

                        puedeEditar:
                            tienePermiso(
                                usuario,
                                "tornejos",
                                "editar",
                                torneo.id,
                            ),

                        enlace:
                            `/panell?torneoID=${encodeURIComponent(torneo.id)}`,

                        enlace_info:
                            `/panell/info/torneig?accio=ver&torneoID=${encodeURIComponent(torneo.id)}`,
                    }),
                );

            // =================================================
            // RESPUESTA EDICIONES
            // =================================================

            const edicionesRespuesta =
                ediciones.map(
                    edicion => ({
                        ...edicion,

                        estado:
                            estadoParaFrontend(
                                edicion.estado,
                            ),

                        torneo_nombre:
                            edicion.torneo_id
                                ? torneosPorID.get(
                                      edicion.torneo_id,
                                  )?.nombre ??
                                  null
                                : null,
                    }),
                );

            const edicionSeleccionadaRespuesta =
                edicionSeleccionada
                    ? edicionesRespuesta.find(
                          edicion =>
                              edicion.id ===
                              edicionSeleccionada.id,
                      ) ??
                      null
                    : null;

            // =================================================
            // ACTUALIZACIONES
            // =================================================

            const actualizacionesBase = [
                ...torneos.map(
                    torneo => ({
                        id:
                            `torneo-${torneo.id}`,

                        tipo:
                            "torneo" as const,

                        nombre:
                            torneo.nombre,

                        torneo_id:
                            torneo.id,

                        torneo_nombre:
                            torneo.nombre,

                        fecha:
                            torneo.updated_at,
                    }),
                ),

                ...ediciones.map(
                    edicion => ({
                        id:
                            `edicion-${edicion.id}`,

                        tipo:
                            "edicion" as const,

                        nombre:
                            edicion.nombre,

                        torneo_id:
                            edicion.torneo_id,

                        torneo_nombre:
                            edicion.torneo_id
                                ? torneosPorID.get(
                                      edicion.torneo_id,
                                  )?.nombre ??
                                  null
                                : null,

                        fecha:
                            edicion.updated_at,
                    }),
                ),
            ];

            const actualizaciones =
                actualizacionesBase
                    .flatMap(
                        elemento => {
                            if (
                                !elemento.fecha ||
                                !Number.isFinite(
                                    Date.parse(
                                        elemento.fecha,
                                    ),
                                )
                            ) {
                                return [];
                            }

                            return [
                                {
                                    ...elemento,

                                    fecha:
                                        elemento.fecha,
                                },
                            ];
                        },
                    )
                    .sort(
                        (
                            a,
                            b,
                        ) =>
                            Date.parse(
                                b.fecha,
                            ) -
                            Date.parse(
                                a.fecha,
                            ),
                    )
                    .slice(
                        0,
                        6,
                    );

            // =================================================
            // RESUMEN EDICIÓN
            // =================================================

            /*
             * Estos contadores quedan preparados en el contrato
             * de la API.
             *
             * Se conectarán cuando existan las nuevas tablas
             * de equipos, voluntarios, participantes, partidos
             * y formularios.
             *
             * null significa:
             *
             * "dato todavía no disponible"
             *
             * NO significa cero.
             */

            const actividadEdicion =
                edicionSeleccionada
                    ? [
                          edicionSeleccionada.created_at &&
                          Number.isFinite(
                              Date.parse(
                                  edicionSeleccionada.created_at,
                              ),
                          )
                              ? {
                                    id:
                                        `creada-${edicionSeleccionada.id}`,

                                    titulo:
                                        "Edició creada",

                                    descripcion:
                                        "Es va crear l'edició a la plataforma.",

                                    fecha:
                                        edicionSeleccionada.created_at,
                                }
                              : null,

                          edicionSeleccionada.updated_at &&
                          Number.isFinite(
                              Date.parse(
                                  edicionSeleccionada.updated_at,
                              ),
                          ) &&
                          edicionSeleccionada.updated_at !==
                              edicionSeleccionada.created_at
                              ? {
                                    id:
                                        `actualitzada-${edicionSeleccionada.id}`,

                                    titulo:
                                        "Configuració actualitzada",

                                    descripcion:
                                        "S'han modificat les dades o la configuració de l'edició.",

                                    fecha:
                                        edicionSeleccionada.updated_at,
                                }
                              : null,
                      ]
                          .filter(
                              (
                                  elemento,
                              ): elemento is {
                                  id:
                                      string;

                                  titulo:
                                      string;

                                  descripcion:
                                      string;

                                  fecha:
                                      string;
                              } =>
                                  elemento !==
                                  null,
                          )
                          .sort(
                              (
                                  a,
                                  b,
                              ) =>
                                  Date.parse(
                                      b.fecha,
                                  ) -
                                  Date.parse(
                                      a.fecha,
                                  ),
                          )
                    : [];

            const resumenEdicion =
                edicionSeleccionada
                    ? {
                          equiposInscritos:
                              null,

                          voluntarios:
                              null,

                          participantes:
                              null,

                          partidos:
                              null,

                          formulariosCompletados:
                              null,

                          formulariosError:
                              null,

                          actividad:
                              actividadEdicion,
                      }
                    : null;

            // =================================================
            // PERMISOS
            // =================================================

            const puedeVerEdiciones =
                torneoID
                    ? tienePermiso(
                          usuario,
                          "edicions",
                          "ver",
                          torneoID,
                      )
                    : torneosConPermisoEdiciones.length >
                      0;

            const puedeVerTorneos =
                torneoID
                    ? tienePermiso(
                          usuario,
                          "tornejos",
                          "ver",
                          torneoID,
                      )
                    : (
                          torneos.length >
                              0 ||
                          tienePermiso(
                              usuario,
                              "tornejos",
                              "ver",
                          )
                      );

            // =================================================
            // ESTADÍSTICAS
            // =================================================

            const edicionesBorrador =
                ediciones.filter(
                    edicion =>
                        normalizarEstadoEdicion(
                            edicion.estado,
                        ) ===
                        "BORRADOR",
                ).length;

            const edicionesActivas =
                ediciones.filter(
                    edicion =>
                        normalizarEstadoEdicion(
                            edicion.estado,
                        ) ===
                        "ACTIVA",
                ).length;

            const edicionesFinalizadas =
                ediciones.filter(
                    edicion =>
                        normalizarEstadoEdicion(
                            edicion.estado,
                        ) ===
                        "FINALIZADA",
                ).length;

            const edicionesSinEstado =
                ediciones.filter(
                    edicion =>
                        normalizarEstadoEdicion(
                            edicion.estado,
                        ) ===
                        "SIN_ESTADO",
                ).length;

            const edicionesOtrosEstados =
                ediciones.filter(
                    edicion =>
                        normalizarEstadoEdicion(
                            edicion.estado,
                        ) ===
                        "DESCONOCIDO",
                ).length;

            // =================================================
            // ACCESOS GENERALES
            // =================================================

            const accesosBase = [
                {
                    id:
                        "crear-torneig",

                    nombre:
                        "Crear torneig",

                    enlace:
                        "/panell/info/torneig?accio=crear",

                    seccion:
                        "tornejos",

                    accion:
                        "crear",

                    descripcion:
                        "Defineix un nou esport i les seves regles base.",
                },

                {
                    id:
                        "usuaris",

                    nombre:
                        "Gestionar usuaris",

                    enlace:
                        "/panell/usuaris",

                    seccion:
                        "usuaris",

                    accion:
                        "ver",

                    descripcion:
                        "Llista d'alumnes amb accés a la plataforma.",
                },

                {
                    id:
                        "permisos",

                    nombre:
                        "Gestionar permisos",

                    enlace:
                        "/panell/permisos",

                    seccion:
                        "permisos",

                    accion:
                        "ver",

                    descripcion:
                        "Gestiona els permisos d'accés per a diferents usuaris.",
                },

                {
                    id:
                        "configuracio",

                    nombre:
                        "Configuració",

                    enlace:
                        "/panell/configuracio",

                    seccion:
                        "configuracio",

                    accion:
                        "ver",

                    descripcion:
                        "Gestiona la configuració general de la plataforma.",
                },
            ];

            const accesos =
                accesosBase.filter(
                    acceso =>
                        tienePermiso(
                            usuario,
                            acceso.seccion,
                            acceso.accion,
                        ),
                );

            // =================================================
            // RESPUESTA
            // =================================================

            return responder(
                {
                    data: {
                        modo:
                            torneoID
                                ? "torneo"
                                : "general",

                        torneoSeleccionado,

                        edicionSeleccionada:
                            edicionSeleccionadaRespuesta,

                        resumenEdicion,

                        permisos: {
                            verTorneos:
                                puedeVerTorneos,

                            verEdiciones:
                                puedeVerEdiciones,

                            crearTorneo:
                                tienePermiso(
                                    usuario,
                                    "tornejos",
                                    "crear",
                                ),

                            editarTorneo:
                                torneoID
                                    ? tienePermiso(
                                          usuario,
                                          "tornejos",
                                          "editar",
                                          torneoID,
                                      )
                                    : false,

                            crearEdicion:
                                torneoID
                                    ? tienePermiso(
                                          usuario,
                                          "edicions",
                                          "crear",
                                          torneoID,
                                      )
                                    : false,

                            editarEdicion:
                                torneoID &&
                                edicionSeleccionada
                                    ? tienePermiso(
                                          usuario,
                                          "edicions",
                                          "editar",
                                          torneoID,
                                      )
                                    : false,
                        },

                        estadisticas: {
                            torneos:
                                torneos.length,

                            torneosActivos:
                                torneos.filter(
                                    torneo =>
                                        torneo.activo ===
                                        true,
                                ).length,

                            torneosInactivos:
                                torneos.filter(
                                    torneo =>
                                        torneo.activo ===
                                        false,
                                ).length,

                            torneosSinEstado:
                                torneos.filter(
                                    torneo =>
                                        torneo.activo ===
                                        null,
                                ).length,

                            ediciones:
                                puedeVerEdiciones
                                    ? ediciones.length
                                    : null,

                            edicionesBorrador:
                                puedeVerEdiciones
                                    ? edicionesBorrador
                                    : null,

                            edicionesActivas:
                                puedeVerEdiciones
                                    ? edicionesActivas
                                    : null,

                            edicionesFinalizadas:
                                puedeVerEdiciones
                                    ? edicionesFinalizadas
                                    : null,

                            edicionesSinEstado:
                                puedeVerEdiciones
                                    ? edicionesSinEstado
                                    : null,

                            edicionesOtrosEstados:
                                puedeVerEdiciones
                                    ? edicionesOtrosEstados
                                    : null,
                        },

                        accesos,

                        torneos:
                            torneosRespuesta,

                        ediciones:
                            edicionesRespuesta,

                        actualizaciones,
                    },
                },
            );
        } catch (
            error
        ) {
            console.error(
                "Error cargando el resumen del panel:",
                error,
            );

            return responder(
                {
                    mensaje:
                        "No s'ha pogut carregar el resum del panell. Torna-ho a intentar.",
                },
                500,
            );
        }
    };