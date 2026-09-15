import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";

import {
    tienePermiso,
    tieneAccesoTorneo
} from "@const/Permisos";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Torneo = {
    id: string;

    nombre: string | null;
    deporte: string | null;
    descripcion: string | null;

    logo: string | null;
    banner: string | null;

    activo: boolean | null;

    created_at: string | null;
    updated_at: string | null;
};

type Edicion = {
    id: string;

    torneo_id: string | null;

    nombre: string | null;

    fecha_inicio: string | null;
    fecha_fin: string | null;

    estado: string | null;
    sede: string | null;

    created_at: string | null;
    updated_at: string | null;
};

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({
    cookies,
    url
}) => {
    const headers = {
        "Cache-Control": "private, no-store"
    };

    try {
        // ====================================================
        // SESIÓN
        // ====================================================

        const token =
            cookies.get(
                "token_sesion"
            )?.value;

        const usuario =
            token
                ? await obtenerUsuarioPorToken(
                      token
                  )
                : null;

        if (!usuario) {
            return Response.json(
                {
                    mensaje:
                        "Has d'iniciar sessió."
                },
                {
                    status: 401,
                    headers
                }
            );
        }

        /*
         * panell.ver es implícito en el nuevo sistema.
         *
         * Un usuario con un rol administrativo válido puede
         * entrar al panel aunque sus capacidades concretas
         * dependan posteriormente de cada torneo.
         */
        if (
            !tienePermiso(
                usuario,
                "panell",
                "ver"
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "No tens permís per accedir al panell."
                },
                {
                    status: 403,
                    headers
                }
            );
        }

        // ====================================================
        // CONTEXTO
        // ====================================================

        const torneoID =
            url.searchParams.get(
                "torneoID"
            );

        const edicionID =
            url.searchParams.get(
                "edicionID"
            );

        const formatoUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (
            torneoID !== null &&
            !formatoUUID.test(
                torneoID
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "L'identificador del torneig no és vàlid."
                },
                {
                    status: 400,
                    headers
                }
            );
        }

        if (
            edicionID !== null &&
            (
                !torneoID ||
                !formatoUUID.test(
                    edicionID
                )
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "La selecció de l'edició no és vàlida."
                },
                {
                    status: 400,
                    headers
                }
            );
        }

        // ====================================================
        // ACCESO AL TORNEO SELECCIONADO
        // ====================================================

        if (
            torneoID &&
            (
                !tieneAccesoTorneo(
                    usuario,
                    torneoID
                ) ||
                !tienePermiso(
                    usuario,
                    "tornejos",
                    "ver",
                    torneoID
                )
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "No tens accés a aquest torneig."
                },
                {
                    status: 403,
                    headers
                }
            );
        }

        // ====================================================
        // TORNEOS ACCESIBLES
        // ====================================================

        const torneos: Torneo[] =
            [];

        const tamanoPagina =
            500;

        /*
         * IMPORTANTE
         * ===========
         *
         * Antes aquí existía:
         *
         * if (
         *     torneoID ||
         *     tienePermiso(
         *         usuario,
         *         "tornejos",
         *         "ver"
         *     )
         * )
         *
         * Eso impedía cargar el índice a usuarios que no tienen
         * tornejos.ver GLOBAL pero sí dentro de un torneo.
         *
         * Ejemplo:
         *
         * Rol general: Staff
         * Bàsquet:
         *   acceso: true
         *   rol: Staff
         *   tornejos.ver: true
         *
         * Ahora consultamos los torneos y comprobamos el acceso
         * individualmente para cada uno.
         */
        for (
            let inicio = 0;
            ;
            inicio += tamanoPagina
        ) {
            let consulta =
                supabaseAdmin
                    .from(
                        "torneos"
                    )
                    .select(
                        "id, nombre, deporte, descripcion, logo, banner, activo, created_at, updated_at"
                    )
                    .order(
                        "id"
                    )
                    .range(
                        inicio,
                        inicio +
                            tamanoPagina -
                            1
                    );

            /*
             * Si se ha seleccionado un torneo concreto,
             * únicamente necesitamos consultar ese torneo.
             */
            if (torneoID) {
                consulta =
                    consulta.eq(
                        "id",
                        torneoID
                    );
            }

            const {
                data,
                error
            } =
                await consulta;

            if (error) {
                throw error;
            }

            const pagina =
                (data ??
                    []) as Torneo[];

            for (
                const torneo
                of pagina
            ) {
                /*
                 * Ambas comprobaciones utilizan el ID del torneo.
                 *
                 * Esto permite correctamente:
                 *
                 * Staff general
                 *     +
                 * acceso específico a Bàsquet
                 */
                if (
                    tieneAccesoTorneo(
                        usuario,
                        torneo.id
                    ) &&
                    tienePermiso(
                        usuario,
                        "tornejos",
                        "ver",
                        torneo.id
                    )
                ) {
                    torneos.push(
                        torneo
                    );
                }
            }

            if (
                pagina.length <
                tamanoPagina
            ) {
                break;
            }
        }

        // ====================================================
        // TORNEO SELECCIONADO
        // ====================================================

        const torneoSeleccionado =
            torneoID
                ? torneos.find(
                      torneo =>
                          torneo.id ===
                          torneoID
                  ) ?? null
                : null;

        if (
            torneoID &&
            !torneoSeleccionado
        ) {
            return Response.json(
                {
                    mensaje:
                        "No s'ha trobat el torneig."
                },
                {
                    status: 404,
                    headers
                }
            );
        }

        // ====================================================
        // TORNEOS CON PERMISO DE EDICIONES
        // ====================================================

        /*
         * edicions.ver también es un permiso contextual
         * del torneo.
         *
         * No debemos exigir edicions.ver global.
         */
        const torneosConPermisoEdiciones =
            torneos.filter(
                torneo =>
                    tienePermiso(
                        usuario,
                        "edicions",
                        "ver",
                        torneo.id
                    )
            );

        // ====================================================
        // EDICIÓN SELECCIONADA: PERMISO
        // ====================================================

        if (
            edicionID &&
            !torneosConPermisoEdiciones.some(
                torneo =>
                    torneo.id ===
                    torneoID
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "No tens permís per consultar aquesta edició."
                },
                {
                    status: 403,
                    headers
                }
            );
        }

        // ====================================================
        // EDICIONES
        // ====================================================

        const ediciones:
            Edicion[] = [];

        /*
         * Se consultan por grupos para evitar filtros
         * excesivamente grandes.
         */
        for (
            let grupo = 0;
            grupo <
            torneosConPermisoEdiciones.length;
            grupo += 100
        ) {
            const identificadores =
                torneosConPermisoEdiciones
                    .slice(
                        grupo,
                        grupo +
                            100
                    )
                    .map(
                        torneo =>
                            torneo.id
                    );

            for (
                let inicio = 0;
                ;
                inicio +=
                    tamanoPagina
            ) {
                const {
                    data,
                    error
                } =
                    await supabaseAdmin
                        .from(
                            "ediciones"
                        ).select(
                            "id, torneo_id, nombre, fecha_inicio, fecha_fin, estado, sede, created_at, updated_at"
                        )
                        .in(
                            "torneo_id",
                            identificadores
                        )
                        .order(
                            "id"
                        )
                        .range(
                            inicio,
                            inicio +
                                tamanoPagina -
                                1
                        );

                if (error) {
                    throw error;
                }

                const pagina =
                    (data ??
                        []) as Edicion[];

                ediciones.push(
                    ...pagina
                );

                if (
                    pagina.length <
                    tamanoPagina
                ) {
                    break;
                }
            }
        }

        // ====================================================
        // EDICIÓN SELECCIONADA
        // ====================================================

        const edicionSeleccionada =
            edicionID
                ? ediciones.find(
                      edicion =>
                          edicion.id ===
                              edicionID &&
                          edicion.torneo_id ===
                              torneoID
                  ) ?? null
                : null;

        if (
            edicionID &&
            !edicionSeleccionada
        ) {
            return Response.json(
                {
                    mensaje:
                        "No s'ha trobat aquesta edició dins del torneig seleccionat."
                },
                {
                    status: 404,
                    headers
                }
            );
        }

        // ====================================================
        // PARÁMETROS DE CONTEXTO
        // ====================================================

        const parametros =
            new URLSearchParams();

        if (torneoID) {
            parametros.set(
                "torneoID",
                torneoID
            );
        }

        if (
            torneoID &&
            edicionSeleccionada
        ) {
            parametros.set(
                "edicionID",
                edicionSeleccionada.id
            );
        }

        // ====================================================
        // ACCESOS RÁPIDOS
        // ====================================================

        /*
         * Estos accesos pertenecen actualmente a secciones
         * generales del panel.
         *
         * Por tanto NO les pasamos torneoID al comprobar
         * permisos.
         */
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

                usarContexto:
                    false
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

                usarContexto:
                    false
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

                usarContexto:
                    false
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

                usarContexto:
                    false
            }
        ];

        const accesos =
            accesosBase
                .filter(
                    acceso =>
                        tienePermiso(
                            usuario,
                            acceso.seccion,
                            acceso.accion
                        )
                )
                .map(
                    acceso => {
                        const {
                            usarContexto: _,
                            ...resultado
                        } = acceso;

                        return resultado;
                    }
                );

        // ====================================================
        // ORDEN DE PRESENTACIÓN
        // ====================================================

        torneos.sort(
            (a, b) => {
                const fechaA =
                    Date.parse(
                        a.updated_at ??
                            a.created_at ??
                            ""
                    );

                const fechaB =
                    Date.parse(
                        b.updated_at ??
                            b.created_at ??
                            ""
                    );

                return (
                    (
                        Number.isFinite(
                            fechaB
                        )
                            ? fechaB
                            : 0
                    ) -
                    (
                        Number.isFinite(
                            fechaA
                        )
                            ? fechaA
                            : 0
                    )
                );
            }
        );

        ediciones.sort(
            (a, b) => {
                const fechaA =
                    Date.parse(
                        a.updated_at ??
                            a.created_at ??
                            ""
                    );

                const fechaB =
                    Date.parse(
                        b.updated_at ??
                            b.created_at ??
                            ""
                    );

                return (
                    (
                        Number.isFinite(
                            fechaB
                        )
                            ? fechaB
                            : 0
                    ) -
                    (
                        Number.isFinite(
                            fechaA
                        )
                            ? fechaA
                            : 0
                    )
                );
            }
        );

        // ====================================================
        // CONTEO DE EDICIONES POR TORNEO
        // ====================================================

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
                        edicion.torneo_id
                    ) ?? 0
                ) + 1
            );
        }

        // ====================================================
        // MAPA DE TORNEOS
        // ====================================================

        const torneosPorID =
            new Map(
                torneos.map(
                    torneo => [
                        torneo.id,
                        torneo
                    ]
                )
            );

        // ====================================================
        // RESPUESTA DE TORNEOS
        // ====================================================

        const torneosRespuesta =
            torneos.map(
                torneo => {
                    const puedeVerEdicionesTorneo =
                        tienePermiso(
                            usuario,
                            "edicions",
                            "ver",
                            torneo.id
                        );

                    return {
                        ...torneo,

                        /*
                         * null:
                         * el usuario no puede consultar las ediciones.
                         *
                         * 0:
                         * sí puede consultarlas pero no existen.
                         */
                        total_ediciones:
                            puedeVerEdicionesTorneo
                                ? cantidadEdiciones.get(
                                      torneo.id
                                  ) ?? 0
                                : null,

                        puedeEditar:
                            tienePermiso(
                                usuario,
                                "tornejos",
                                "editar",
                                torneo.id
                            ),

                        enlace:
                            `/panell?torneoID=${encodeURIComponent(
                                torneo.id
                            )}`,

                        enlace_info:
                            `/panell/info/torneig?accio=ver&torneoID=${encodeURIComponent(
                                torneo.id
                            )}`
                    };
                }
            );

        // ====================================================
        // RESPUESTA DE EDICIONES
        // ====================================================

        const edicionesRespuesta =
            ediciones.map(
                edicion => ({
                    ...edicion,

                    torneo_nombre:
                        edicion.torneo_id
                            ? torneosPorID.get(
                                  edicion.torneo_id
                              )?.nombre ??
                              null
                            : null
                })
            );

        // ====================================================
        // ACTUALIZACIONES RECIENTES
        // ====================================================

        const actualizaciones = [
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
                        torneo.updated_at
                })
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
                                  edicion.torneo_id
                              )?.nombre ??
                              null
                            : null,

                    fecha:
                        edicion.updated_at
                })
            )
        ]
            .filter(
                elemento =>
                    elemento.fecha !==
                        null &&
                    Number.isFinite(
                        Date.parse(
                            elemento.fecha
                        )
                    )
            )
            .sort(
                (a, b) =>
                    Date.parse(
                        b.fecha!
                    ) -
                    Date.parse(
                        a.fecha!
                    )
            )
            .slice(
                0,
                6
            );

        // ====================================================
        // PERMISOS EFECTIVOS DEL ÍNDICE
        // ====================================================

        /*
         * CORRECCIÓN IMPORTANTE:
         *
         * En modo general NO preguntamos únicamente por
         * edicions.ver global.
         *
         * Basta con que exista al menos un torneo accesible
         * en el que el usuario tenga edicions.ver.
         */
        const puedeVerEdiciones =
            torneoID
                ? tienePermiso(
                      usuario,
                      "edicions",
                      "ver",
                      torneoID
                  )
                : torneosConPermisoEdiciones.length >
                  0;

        /*
         * Lo mismo para los torneos.
         *
         * Un Staff puede tener:
         *
         * tornejos.ver global = false
         *
         * pero:
         *
         * Bàsquet -> tornejos.ver = true
         *
         * Por tanto el índice general debe considerar que
         * sí puede consultar torneos.
         */
        const puedeVerTorneos =
            torneoID
                ? tienePermiso(
                      usuario,
                      "tornejos",
                      "ver",
                      torneoID
                  )
                : (
                      torneos.length >
                          0 ||
                      tienePermiso(
                          usuario,
                          "tornejos",
                          "ver"
                      )
                  );

        // ====================================================
        // RESPUESTA
        // ====================================================

        return Response.json(
            {
                data: {
                    modo:
                        torneoID
                            ? "torneo"
                            : "general",

                    torneoSeleccionado,

                    edicionSeleccionada,

                    permisos: {
                        /*
                         * Ya no depende únicamente
                         * del permiso general.
                         */
                        verTorneos:
                            puedeVerTorneos,

                        /*
                         * Ya no depende únicamente
                         * del permiso general.
                         */
                        verEdiciones:
                            puedeVerEdiciones,

                        /*
                         * Crear un torneo sí es una capacidad
                         * general de la plataforma.
                         */
                        crearTorneo:
                            tienePermiso(
                                usuario,
                                "tornejos",
                                "crear"
                            ),

                        /*
                         * Editar depende del torneo seleccionado.
                         */
                        editarTorneo:
                            torneoID
                                ? tienePermiso(
                                      usuario,
                                      "tornejos",
                                      "editar",
                                      torneoID
                                  )
                                : false
                    },

                    estadisticas: {
                        torneos:
                            torneos.length,

                        torneosActivos:
                            torneos.filter(
                                torneo =>
                                    torneo.activo ===
                                    true
                            ).length,

                        torneosInactivos:
                            torneos.filter(
                                torneo =>
                                    torneo.activo ===
                                    false
                            ).length,

                        torneosSinEstado:
                            torneos.filter(
                                torneo =>
                                    torneo.activo ===
                                    null
                            ).length,

                        ediciones:
                            puedeVerEdiciones
                                ? ediciones.length
                                : null,

                        edicionesBorrador:
                            puedeVerEdiciones
                                ? ediciones.filter(
                                      edicion =>
                                          edicion.estado ===
                                          "BORRADOR"
                                  ).length
                                : null,

                        edicionesActivas:
                            puedeVerEdiciones
                                ? ediciones.filter(
                                      edicion =>
                                          edicion.estado ===
                                          "ACTIVA"
                                  ).length
                                : null,

                        edicionesFinalizadas:
                            puedeVerEdiciones
                                ? ediciones.filter(
                                      edicion =>
                                          edicion.estado ===
                                          "FINALIZADA"
                                  ).length
                                : null,

                        edicionesSinEstado:
                            puedeVerEdiciones
                                ? ediciones.filter(
                                      edicion =>
                                          !edicion.estado?.trim()
                                  ).length
                                : null,

                        edicionesOtrosEstados:
                            puedeVerEdiciones
                                ? ediciones.filter(
                                      edicion =>
                                          Boolean(
                                              edicion.estado?.trim()
                                          ) &&
                                          ![
                                              "BORRADOR",
                                              "ACTIVA",
                                              "FINALIZADA"
                                          ].includes(
                                              edicion.estado!
                                          )
                                  ).length
                                : null
                    },

                    accesos,

                    torneos:
                        torneosRespuesta,

                    ediciones:
                        edicionesRespuesta,

                    actualizaciones
                }
            },
            {
                status: 200,
                headers
            }
        );
    } catch (error) {
        console.error(
            "Error cargando el resumen del panel:",
            error
        );

        return Response.json(
            {
                mensaje:
                    "No s'ha pogut carregar el resum del panell. Torna-ho a intentar."
            },
            {
                status: 500,
                headers
            }
        );
    }
};