import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";

type Registro = Record<string, unknown>;

type Fase = {
    id: string;
    nombre: string;
    orden: number;
    estado: string;
};

type Grupo = {
    id: string;
    fase_id: string;
    nombre: string;
    orden: number;
    estado: string;
};

type Equipo = {
    id: string;
    nombre: string;
    escudo: string | null;
};

type Plaza = {
    id: string;
    grupo_id: string | null;
    partido_id: string | null;
    lado: string | null;
    orden: number;
    equipo_origen_id: string | null;
    equipo_resuelto_id: string | null;
};

type Partido = {
    id: string;
    fase_id: string;
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

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esRegistro(
    valor: unknown,
): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function texto(
    registro: Registro | null | undefined,
    claves: string[],
) {
    if (!registro) {
        return null;
    }

    for (const clave of claves) {
        const valor = registro[clave];

        if (
            typeof valor === "string" &&
            valor.trim()
        ) {
            return valor.trim();
        }
    }

    return null;
}

function numero(
    registro: Registro | null | undefined,
    claves: string[],
) {
    if (!registro) {
        return null;
    }

    for (const clave of claves) {
        const valor = registro[clave];

        if (
            typeof valor === "number" &&
            Number.isFinite(valor)
        ) {
            return valor;
        }

        if (
            typeof valor === "string" &&
            valor.trim()
        ) {
            const convertido = Number(valor);

            if (Number.isFinite(convertido)) {
                return convertido;
            }
        }
    }

    return null;
}

function numeroAnidado(
    registro: Registro | null | undefined,
    claves: string[],
) {
    const directo =
        numero(
            registro,
            claves,
        );

    if (directo !== null) {
        return directo;
    }

    if (!registro) {
        return null;
    }

    for (
        const contenedor of
        [
            "resultado",
            "marcador",
            "datos",
            "valor",
        ]
    ) {
        const valor =
            registro[contenedor];

        if (!esRegistro(valor)) {
            continue;
        }

        const encontrado =
            numero(
                valor,
                claves,
            );

        if (encontrado !== null) {
            return encontrado;
        }
    }

    return null;
}

function versionClasificacion(
    registro: Registro,
) {
    return (
        numero(
            registro,
            [
                "version",
                "numero_version",
                "version_clasificacion",
            ],
        ) ??
        0
    );
}

function fechaCreacion(
    registro: Registro,
) {
    const valor =
        texto(
            registro,
            [
                "created_at",
                "fecha_creacion",
            ],
        );

    if (!valor) {
        return 0;
    }

    const fecha =
        new Date(valor);

    return Number.isNaN(
        fecha.getTime(),
    )
        ? 0
        : fecha.getTime();
}

function claveDiaMadrid(
    fecha: Date,
) {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZone: "Europe/Madrid",
        },
    ).format(fecha);
}

export const GET: APIRoute =
    async ({
        url,
    }) => {
        try {
            // ====================================================
            // PARÁMETROS
            // ====================================================

            const torneoID =
                url.searchParams.get(
                    "torneoID",
                );

            const edicionID =
                url.searchParams.get(
                    "edicionID",
                );

            const grupoSolicitadoID =
                url.searchParams.get(
                    "grupoID",
                );

            if (
                !torneoID ||
                !UUID.test(torneoID)
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
                !UUID.test(edicionID)
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
                grupoSolicitadoID &&
                !UUID.test(
                    grupoSolicitadoID,
                )
            ) {
                return Response.json(
                    {
                        mensaje:
                            "L'identificador del grup no és vàlid.",
                    },
                    {
                        status: 400,
                    },
                );
            }

            // ====================================================
            // TORNEO / EDICIÓN
            // ====================================================

            const [
                torneoRespuesta,
                edicionRespuesta,
            ] =
                await Promise.all([
                    supabaseAdmin
                        .from("torneos")
                        .select(
                            "id,deporte,activo",
                        )
                        .eq(
                            "id",
                            torneoID,
                        )
                        .maybeSingle(),

                    supabaseAdmin
                        .from("ediciones")
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

            if (torneoRespuesta.error) {
                throw torneoRespuesta.error;
            }

            if (edicionRespuesta.error) {
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
                torneoRespuesta.data.deporte
                    ?.trim()
                    .toLowerCase() ??
                "";

            const esFutbol =
                deporte.includes("fut");

            // ====================================================
            // FASES DE GRUPOS
            // ====================================================

            const {
                data:
                    fasesData,
                error:
                    errorFases,
            } =
                await supabaseAdmin
                    .from(
                        "competicion_fases",
                    )
                    .select(
                        "id,nombre,orden,estado",
                    )
                    .eq(
                        "edicion_id",
                        edicionID,
                    )
                    .eq(
                        "tipo",
                        "GRUPOS",
                    )
                    .order(
                        "orden",
                        {
                            ascending: true,
                        },
                    );

            if (errorFases) {
                throw errorFases;
            }

            const fases =
                (
                    fasesData ??
                    []
                ) as Fase[];

            if (
                fases.length ===
                0
            ) {
                return Response.json(
                    {
                        data: {
                            deporte,
                            esFutbol,
                            grupos: [],
                            grupo: null,
                            clasificacion: [],
                            tieneClasificacion:
                                false,
                            jornadaReferencia:
                                null,
                            proximaJornada:
                                null,
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

            const idsFases =
                fases.map(
                    fase =>
                        fase.id,
                );

            // ====================================================
            // GRUPOS
            // ====================================================

            const {
                data:
                    gruposData,
                error:
                    errorGrupos,
            } =
                await supabaseAdmin
                    .from(
                        "competicion_grupos",
                    )
                    .select(
                        "id,fase_id,nombre,orden,estado",
                    )
                    .in(
                        "fase_id",
                        idsFases,
                    )
                    .order(
                        "orden",
                        {
                            ascending: true,
                        },
                    );

            if (errorGrupos) {
                throw errorGrupos;
            }

            const grupos =
                (
                    gruposData ??
                    []
                ) as Grupo[];

            const fasesPorID =
                new Map(
                    fases.map(
                        fase => [
                            fase.id,
                            fase,
                        ],
                    ),
                );

            const opcionesGrupos =
                grupos.map(
                    grupo => {
                        const fase =
                            fasesPorID.get(
                                grupo.fase_id,
                            );

                        return {
                            id:
                                grupo.id,

                            nombre:
                                grupo.nombre,

                            estado:
                                grupo.estado,

                            faseID:
                                grupo.fase_id,

                            faseNombre:
                                fase?.nombre ??
                                "Fase",

                            faseOrden:
                                fase?.orden ??
                                0,

                            orden:
                                grupo.orden,
                        };
                    },
                )
                    .sort(
                        (
                            a,
                            b,
                        ) =>
                            a.faseOrden -
                                b.faseOrden ||
                            a.orden -
                                b.orden,
                    );

            if (
                opcionesGrupos.length ===
                0
            ) {
                return Response.json(
                    {
                        data: {
                            deporte,
                            esFutbol,
                            grupos: [],
                            grupo: null,
                            clasificacion: [],
                            tieneClasificacion:
                                false,
                            jornadaReferencia:
                                null,
                            proximaJornada:
                                null,
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

            const grupoSeleccionado =
                grupos.find(
                    grupo =>
                        grupo.id ===
                        grupoSolicitadoID,
                ) ??
                grupos[0];

            const faseSeleccionada =
                fasesPorID.get(
                    grupoSeleccionado.fase_id,
                ) ??
                null;

            // ====================================================
            // EQUIPOS DEL GRUPO / PARTIDOS / CLASIFICACIONES
            // ====================================================

            const [
                plazasGrupoRespuesta,
                partidosRespuesta,
                clasificacionesRespuesta,
            ] =
                await Promise.all([
                    supabaseAdmin
                        .from(
                            "competicion_plazas",
                        )
                        .select(
                            "id,grupo_id,partido_id,lado,orden,equipo_origen_id,equipo_resuelto_id",
                        )
                        .eq(
                            "edicion_id",
                            edicionID,
                        )
                        .eq(
                            "destino_tipo",
                            "GRUPO",
                        )
                        .eq(
                            "grupo_id",
                            grupoSeleccionado.id,
                        )
                        .order(
                            "orden",
                            {
                                ascending:
                                    true,
                            },
                        ),

                    supabaseAdmin
                        .from(
                            "competicion_partidos",
                        )
                        .select(
                            "id,fase_id,grupo_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,finalizado_at",
                        )
                        .eq(
                            "edicion_id",
                            edicionID,
                        )
                        .eq(
                            "tipo",
                            "GRUPO",
                        )
                        .eq(
                            "grupo_id",
                            grupoSeleccionado.id,
                        )
                        .order(
                            "jornada",
                            {
                                ascending:
                                    true,
                                nullsFirst:
                                    false,
                            },
                        )
                        .order(
                            "orden",
                            {
                                ascending:
                                    true,
                            },
                        ),

                    supabaseAdmin
                        .from(
                            "competicion_clasificaciones",
                        )
                        .select("*")
                        .eq(
                            "grupo_id",
                            grupoSeleccionado.id,
                        ),
                ]);

            if (
                plazasGrupoRespuesta.error
            ) {
                throw plazasGrupoRespuesta.error;
            }

            if (
                partidosRespuesta.error
            ) {
                throw partidosRespuesta.error;
            }

            if (
                clasificacionesRespuesta.error
            ) {
                throw clasificacionesRespuesta.error;
            }

            const plazasGrupo =
                (
                    plazasGrupoRespuesta.data ??
                    []
                ) as Plaza[];

            const partidos =
                (
                    partidosRespuesta.data ??
                    []
                ) as Partido[];

            const idsPartidos =
                partidos.map(
                    partido =>
                        partido.id,
                );

            // ====================================================
            // PLAZAS PARTIDOS
            // ====================================================

            let plazasPartido:
                Plaza[] =
                [];

            if (
                idsPartidos.length >
                0
            ) {
                const {
                    data,
                    error,
                } =
                    await supabaseAdmin
                        .from(
                            "competicion_plazas",
                        )
                        .select(
                            "id,grupo_id,partido_id,lado,orden,equipo_origen_id,equipo_resuelto_id",
                        )
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
                            idsPartidos,
                        );

                if (error) {
                    throw error;
                }

                plazasPartido =
                    (
                        data ??
                        []
                    ) as Plaza[];
            }

            // ====================================================
            // RESULTADOS
            // ====================================================

            let resultados:
                Registro[] =
                [];

            if (
                idsPartidos.length >
                0
            ) {
                const {
                    data,
                    error,
                } =
                    await supabaseAdmin
                        .from(
                            "competicion_resultados",
                        )
                        .select("*")
                        .in(
                            "partido_id",
                            idsPartidos,
                        );

                if (error) {
                    console.error(
                        "Error carregant resultats:",
                        error,
                    );
                } else {
                    resultados =
                        (
                            data ??
                            []
                        ) as Registro[];
                }
            }

            const resultadosPorPartido =
                new Map<
                    string,
                    Registro
                >();

            for (
                const resultado
                of resultados
            ) {
                const partidoID =
                    texto(
                        resultado,
                        [
                            "partido_id",
                            "partit_id",
                        ],
                    );

                if (partidoID) {
                    resultadosPorPartido.set(
                        partidoID,
                        resultado,
                    );
                }
            }

            // ====================================================
            // CLASIFICACIÓN ACTUAL
            // ====================================================

            const clasificaciones =
                (
                    clasificacionesRespuesta.data ??
                    []
                ) as Registro[];

            clasificaciones.sort(
                (
                    a,
                    b,
                ) => {
                    const diferenciaVersion =
                        versionClasificacion(b) -
                        versionClasificacion(a);

                    if (
                        diferenciaVersion !==
                        0
                    ) {
                        return diferenciaVersion;
                    }

                    return (
                        fechaCreacion(b) -
                        fechaCreacion(a)
                    );
                },
            );

            const clasificacionActual =
                clasificaciones[0] ??
                null;

            const clasificacionID =
                texto(
                    clasificacionActual,
                    [
                        "id",
                    ],
                );

            let filasClasificacion:
                Registro[] =
                [];

            if (clasificacionID) {
                const respuesta =
                    await supabaseAdmin
                        .from(
                            "competicion_clasificacion_filas",
                        )
                        .select("*")
                        .eq(
                            "clasificacion_id",
                            clasificacionID,
                        );

                if (!respuesta.error) {
                    filasClasificacion =
                        (
                            respuesta.data ??
                            []
                        ) as Registro[];
                } else {
                    /*
                     * Fallback temporal para que la API no quede
                     * atada al nombre de la FK mientras terminamos
                     * el motor de clasificación.
                     */
                    const fallback =
                        await supabaseAdmin
                            .from(
                                "competicion_clasificacion_filas",
                            )
                            .select("*");

                    if (!fallback.error) {
                        filasClasificacion =
                            (
                                fallback.data ??
                                []
                            )
                                .filter(
                                    fila => {
                                        const registro =
                                            fila as Registro;

                                        return (
                                            texto(
                                                registro,
                                                [
                                                    "clasificacion_id",
                                                    "classificacion_id",
                                                ],
                                            ) ===
                                            clasificacionID
                                        );
                                    },
                                ) as Registro[];
                    }
                }
            }

            // ====================================================
            // TARJETAS
            // ====================================================

            const tarjetasPorEquipo =
                new Map<
                    string,
                    {
                        amarillas: number;
                        rojas: number;
                    }
                >();

            if (
                esFutbol &&
                idsPartidos.length >
                    0
            ) {
                const {
                    data,
                    error,
                } =
                    await supabaseAdmin
                        .from(
                            "competicion_tarjetas",
                        )
                        .select("*")
                        .in(
                            "partido_id",
                            idsPartidos,
                        );

                if (!error) {
                    for (
                        const fila of
                        (
                            data ??
                            []
                        ) as Registro[]
                    ) {
                        const equipoID =
                            texto(
                                fila,
                                [
                                    "equipo_id",
                                    "equip_id",
                                ],
                            );

                        if (!equipoID) {
                            continue;
                        }

                        const tipo =
                            (
                                texto(
                                    fila,
                                    [
                                        "tipo",
                                        "tipo_tarjeta",
                                    ],
                                ) ??
                                ""
                            ).toUpperCase();

                        const cantidad =
                            numero(
                                fila,
                                [
                                    "cantidad",
                                    "total",
                                ],
                            ) ??
                            1;

                        const actual =
                            tarjetasPorEquipo.get(
                                equipoID,
                            ) ?? {
                                amarillas:
                                    0,
                                rojas:
                                    0,
                            };

                        if (
                            tipo.includes(
                                "AMAR",
                            )
                        ) {
                            actual.amarillas +=
                                cantidad;
                        }

                        if (
                            tipo.includes(
                                "ROJ",
                            )
                        ) {
                            actual.rojas +=
                                cantidad;
                        }

                        tarjetasPorEquipo.set(
                            equipoID,
                            actual,
                        );
                    }
                }
            }

            // ====================================================
            // IDs EQUIPOS
            // ====================================================

            const idsEquipos =
                new Set<string>();

            for (
                const plaza of
                plazasGrupo
            ) {
                const id =
                    plaza.equipo_resuelto_id ??
                    plaza.equipo_origen_id;

                if (id) {
                    idsEquipos.add(id);
                }
            }

            for (
                const plaza of
                plazasPartido
            ) {
                if (
                    plaza.equipo_resuelto_id
                ) {
                    idsEquipos.add(
                        plaza.equipo_resuelto_id,
                    );
                }

                if (
                    plaza.equipo_origen_id
                ) {
                    idsEquipos.add(
                        plaza.equipo_origen_id,
                    );
                }
            }

            for (
                const fila of
                filasClasificacion
            ) {
                const equipoID =
                    texto(
                        fila,
                        [
                            "equipo_id",
                            "equip_id",
                        ],
                    );

                if (equipoID) {
                    idsEquipos.add(
                        equipoID,
                    );
                }
            }

            // ====================================================
            // EQUIPOS
            // ====================================================

            let equipos:
                Equipo[] =
                [];

            if (
                idsEquipos.size >
                0
            ) {
                const {
                    data,
                    error,
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
                                idsEquipos,
                            ),
                        );

                if (error) {
                    throw error;
                }

                equipos =
                    (
                        data ??
                        []
                    ).map(
                        equipo => ({
                            id:
                                equipo.id,

                            nombre:
                                equipo.nombre ??
                                "Equip",

                            escudo:
                                equipo.escudo ??
                                null,
                        }),
                    );
            }

            const equiposPorID =
                new Map<
                    string,
                    Equipo
                >(
                    equipos.map(
                        equipo => [
                            equipo.id,
                            equipo,
                        ],
                    ),
                );

            // ====================================================
            // CLASIFICACIÓN NORMALIZADA
            // ====================================================

            const ordenGrupo =
                new Map<
                    string,
                    number
                >();

            for (
                const plaza of
                plazasGrupo
            ) {
                const equipoID =
                    plaza.equipo_resuelto_id ??
                    plaza.equipo_origen_id;

                if (equipoID) {
                    ordenGrupo.set(
                        equipoID,
                        plaza.orden,
                    );
                }
            }

            const clasificacion =
                filasClasificacion
                    .map(
                        fila => {
                            const equipoID =
                                texto(
                                    fila,
                                    [
                                        "equipo_id",
                                        "equip_id",
                                    ],
                                );

                            if (!equipoID) {
                                return null;
                            }

                            const equipo =
                                equiposPorID.get(
                                    equipoID,
                                );

                            if (!equipo) {
                                return null;
                            }

                            const favor =
                                numero(
                                    fila,
                                    [
                                        "puntos_favor",
                                        "puntos_a_favor",
                                        "goles_favor",
                                        "goles_a_favor",
                                        "favor",
                                        "pf",
                                        "gf",
                                    ],
                                );

                            const contra =
                                numero(
                                    fila,
                                    [
                                        "puntos_contra",
                                        "puntos_en_contra",
                                        "goles_contra",
                                        "goles_en_contra",
                                        "contra",
                                        "pc",
                                        "gc",
                                    ],
                                );

                            const diferencia =
                                numero(
                                    fila,
                                    [
                                        "diferencia",
                                        "diferencia_puntos",
                                        "diferencia_goles",
                                        "dif",
                                    ],
                                ) ??
                                (
                                    favor !== null &&
                                    contra !== null
                                        ? favor -
                                          contra
                                        : null
                                );

                            const tarjetas =
                                tarjetasPorEquipo.get(
                                    equipoID,
                                );

                            return {
                                equipo,

                                posicion:
                                    numero(
                                        fila,
                                        [
                                            "posicion",
                                            "posicio",
                                            "orden",
                                        ],
                                    ),

                                pj:
                                    numero(
                                        fila,
                                        [
                                            "partidos_jugados",
                                            "jugados",
                                            "pj",
                                        ],
                                    ),

                                pg:
                                    numero(
                                        fila,
                                        [
                                            "partidos_ganados",
                                            "ganados",
                                            "victorias",
                                            "pg",
                                        ],
                                    ),

                                pe:
                                    numero(
                                        fila,
                                        [
                                            "partidos_empatados",
                                            "empatados",
                                            "empates",
                                            "pe",
                                        ],
                                    ),

                                pp:
                                    numero(
                                        fila,
                                        [
                                            "partidos_perdidos",
                                            "perdidos",
                                            "derrotas",
                                            "pp",
                                        ],
                                    ),

                                favor,
                                contra,
                                diferencia,

                                puntos:
                                    numero(
                                        fila,
                                        [
                                            "puntos",
                                            "puntos_clasificacion",
                                            "pts",
                                        ],
                                    ),

                                amarillas:
                                    numero(
                                        fila,
                                        [
                                            "tarjetas_amarillas",
                                            "amarillas",
                                            "ta",
                                        ],
                                    ) ??
                                    tarjetas
                                        ?.amarillas ??
                                    null,

                                rojas:
                                    numero(
                                        fila,
                                        [
                                            "tarjetas_rojas",
                                            "rojas",
                                            "tr",
                                        ],
                                    ) ??
                                    tarjetas
                                        ?.rojas ??
                                    null,

                                ordenInicial:
                                    ordenGrupo.get(
                                        equipoID,
                                    ) ??
                                    9999,
                            };
                        },
                    )
                    .filter(
                        (
                            fila,
                        ): fila is NonNullable<
                            typeof fila
                        > =>
                            fila !==
                            null,
                    );

            const equiposClasificados =
                new Set(
                    clasificacion.map(
                        fila =>
                            fila.equipo.id,
                    ),
                );

            /*
             * Si todavía no existe snapshot de clasificación,
             * mostramos los equipos sin inventar estadísticas.
             */
            for (
                const plaza of
                plazasGrupo
            ) {
                const equipoID =
                    plaza.equipo_resuelto_id ??
                    plaza.equipo_origen_id;

                if (
                    !equipoID ||
                    equiposClasificados.has(
                        equipoID,
                    )
                ) {
                    continue;
                }

                const equipo =
                    equiposPorID.get(
                        equipoID,
                    );

                if (!equipo) {
                    continue;
                }

                const tarjetas =
                    tarjetasPorEquipo.get(
                        equipoID,
                    );

                clasificacion.push({
                    equipo,

                    posicion: null,
                    pj: null,
                    pg: null,
                    pe: null,
                    pp: null,
                    favor: null,
                    contra: null,
                    diferencia: null,
                    puntos: null,

                    amarillas:
                        tarjetas?.amarillas ??
                        null,

                    rojas:
                        tarjetas?.rojas ??
                        null,

                    ordenInicial:
                        plaza.orden,
                });
            }

            /*
             * La API respeta la posición ya calculada.
             * NO recalcula desempates aquí.
             */
            clasificacion.sort(
                (
                    a,
                    b,
                ) => {
                    if (
                        a.posicion !==
                            null &&
                        b.posicion !==
                            null
                    ) {
                        return (
                            a.posicion -
                            b.posicion
                        );
                    }

                    if (
                        a.posicion !==
                        null
                    ) {
                        return -1;
                    }

                    if (
                        b.posicion !==
                        null
                    ) {
                        return 1;
                    }

                    return (
                        a.ordenInicial -
                        b.ordenInicial
                    );
                },
            );

            // ====================================================
            // PARTIDOS NORMALIZADOS
            // ====================================================

            function equipoPartido(
                partidoID:
                    string,

                lado:
                    "LOCAL" |
                    "VISITANTE",
            ) {
                const plaza =
                    plazasPartido.find(
                        plaza =>
                            plaza.partido_id ===
                                partidoID &&
                            plaza.lado ===
                                lado,
                    );

                if (!plaza) {
                    return null;
                }

                const equipoID =
                    plaza.equipo_resuelto_id ??
                    plaza.equipo_origen_id;

                if (!equipoID) {
                    return null;
                }

                return (
                    equiposPorID.get(
                        equipoID,
                    ) ??
                    null
                );
            }

            function resultadoPartido(
                partidoID:
                    string,
            ) {
                const resultado =
                    resultadosPorPartido.get(
                        partidoID,
                    );

                return {
                    local:
                        numeroAnidado(
                            resultado,
                            [
                                "resultado_local",
                                "marcador_local",
                                "puntos_local",
                                "goles_local",
                                "valor_local",
                                "local",
                            ],
                        ),

                    visitante:
                        numeroAnidado(
                            resultado,
                            [
                                "resultado_visitante",
                                "marcador_visitante",
                                "puntos_visitante",
                                "goles_visitante",
                                "valor_visitante",
                                "visitante",
                            ],
                        ),
                };
            }

            const partidosPublicos =
                partidos.map(
                    partido => {
                        const resultado =
                            resultadoPartido(
                                partido.id,
                            );

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
                                equipoPartido(
                                    partido.id,
                                    "LOCAL",
                                ),

                            visitante:
                                equipoPartido(
                                    partido.id,
                                    "VISITANTE",
                                ),

                            resultadoLocal:
                                resultado.local,

                            resultadoVisitante:
                                resultado.visitante,

                            finalizado:
                                partido.estado
                                    .toUpperCase() ===
                                    "FINALIZADO" ||
                                Boolean(
                                    partido.finalizado_at,
                                ) ||
                                (
                                    resultado.local !==
                                        null &&
                                    resultado.visitante !==
                                        null
                                ),
                        };
                    },
                );

            // ====================================================
            // JORNADAS
            // ====================================================

            const mapaJornadas =
                new Map<
                    number,
                    typeof partidosPublicos
                >();

            for (
                const partido of
                partidosPublicos
            ) {
                if (
                    partido.jornada ===
                    null
                ) {
                    continue;
                }

                const lista =
                    mapaJornadas.get(
                        partido.jornada,
                    ) ??
                    [];

                lista.push(
                    partido,
                );

                mapaJornadas.set(
                    partido.jornada,
                    lista,
                );
            }

            const jornadas =
                Array.from(
                    mapaJornadas.entries(),
                )
                    .map(
                        (
                            [
                                numeroJornada,
                                partidosJornada,
                            ],
                        ) => ({
                            numero:
                                numeroJornada,

                            partidos:
                                partidosJornada.sort(
                                    (
                                        a,
                                        b,
                                    ) => {
                                        const fechaA =
                                            a.fechaHora
                                                ? new Date(
                                                      a.fechaHora,
                                                  ).getTime()
                                                : Number.MAX_SAFE_INTEGER;

                                        const fechaB =
                                            b.fechaHora
                                                ? new Date(
                                                      b.fechaHora,
                                                  ).getTime()
                                                : Number.MAX_SAFE_INTEGER;

                                        return (
                                            fechaA -
                                            fechaB
                                        );
                                    },
                                ),
                        }),
                    )
                    .sort(
                        (
                            a,
                            b,
                        ) =>
                            a.numero -
                            b.numero,
                    );

            function fechaJornada(
                jornada:
                    (typeof jornadas)[number],
            ) {
                const fechas =
                    jornada.partidos
                        .map(
                            partido =>
                                partido.fechaHora
                                    ? new Date(
                                          partido.fechaHora,
                                      ).getTime()
                                    : null,
                        )
                        .filter(
                            (
                                valor,
                            ): valor is number =>
                                valor !==
                                    null &&
                                Number.isFinite(
                                    valor,
                                ),
                        );

                if (
                    fechas.length ===
                    0
                ) {
                    return null;
                }

                return Math.min(
                    ...fechas,
                );
            }

            const ahora =
                Date.now();

            const hoy =
                claveDiaMadrid(
                    new Date(),
                );

            const jornadaHoy =
                jornadas.find(
                    jornada =>
                        jornada.partidos.some(
                            partido =>
                                partido.fechaHora
                                    ? claveDiaMadrid(
                                          new Date(
                                              partido.fechaHora,
                                          ),
                                      ) ===
                                      hoy
                                    : false,
                        ),
                ) ??
                null;

            const jornadasAnteriores =
                jornadas
                    .filter(
                        jornada => {
                            const fecha =
                                fechaJornada(
                                    jornada,
                                );

                            return (
                                fecha !==
                                    null &&
                                fecha <=
                                    ahora
                            );
                        },
                    )
                    .sort(
                        (
                            a,
                            b,
                        ) =>
                            (
                                fechaJornada(
                                    a,
                                ) ??
                                0
                            ) -
                            (
                                fechaJornada(
                                    b,
                                ) ??
                                0
                            ),
                    );

            const ultimaAnterior =
                jornadasAnteriores[
                    jornadasAnteriores.length -
                        1
                ] ??
                null;

            const ultimaConResultados =
                [
                    ...jornadas,
                ]
                    .reverse()
                    .find(
                        jornada =>
                            jornada.partidos.some(
                                partido =>
                                    partido.finalizado,
                            ),
                    ) ??
                null;

            const primeraFutura =
                jornadas.find(
                    jornada => {
                        const fecha =
                            fechaJornada(
                                jornada,
                            );

                        return (
                            fecha !==
                                null &&
                            fecha >
                                ahora
                        );
                    },
                ) ??
                null;

            const referencia =
                jornadaHoy ??
                ultimaAnterior ??
                ultimaConResultados ??
                primeraFutura ??
                jornadas[0] ??
                null;

            let indiceReferencia =
                -1;

            if (referencia) {
                indiceReferencia =
                    jornadas.findIndex(
                        jornada =>
                            jornada.numero ===
                            referencia.numero,
                    );
            }

            const siguiente =
                indiceReferencia >=
                    0
                    ? jornadas[
                          indiceReferencia +
                              1
                      ] ??
                      null
                    : null;

            function convertirJornada(
                jornada:
                    (typeof jornadas)[number] |
                    null,

                tipo:
                    "REFERENCIA" |
                    "PROXIMA",
            ) {
                if (!jornada) {
                    return null;
                }

                let contexto:
                    "AVUI" |
                    "DARRERA" |
                    "PER_JUGAR" |
                    "PROXIMA" =
                    "PER_JUGAR";

                if (
                    tipo ===
                    "PROXIMA"
                ) {
                    contexto =
                        "PROXIMA";
                } else if (
                    jornadaHoy
                        ?.numero ===
                    jornada.numero
                ) {
                    contexto =
                        "AVUI";
                } else {
                    const fecha =
                        fechaJornada(
                            jornada,
                        );

                    contexto =
                        fecha !==
                            null &&
                        fecha <=
                            ahora
                            ? "DARRERA"
                            : "PER_JUGAR";
                }

                return {
                    numero:
                        jornada.numero,

                    contexto,

                    partidos:
                        jornada.partidos,
                };
            }

            // ====================================================
            // RESPUESTA
            // ====================================================

            return Response.json(
                {
                    data: {
                        deporte,
                        esFutbol,

                        etiquetas: {
                            favor:
                                esFutbol
                                    ? "GF"
                                    : "PF",

                            contra:
                                esFutbol
                                    ? "GC"
                                    : "PC",
                        },

                        grupos:
                            opcionesGrupos,

                        grupo: {
                            id:
                                grupoSeleccionado.id,

                            nombre:
                                grupoSeleccionado.nombre,

                            estado:
                                grupoSeleccionado.estado,

                            faseID:
                                grupoSeleccionado.fase_id,

                            faseNombre:
                                faseSeleccionada
                                    ?.nombre ??
                                "Fase",
                        },

                        tieneClasificacion:
                            filasClasificacion.length >
                            0,

                        clasificacion:
                            clasificacion.map(
                                ({
                                    ordenInicial,
                                    ...fila
                                }) =>
                                    fila,
                            ),

                        jornadaReferencia:
                            convertirJornada(
                                referencia,
                                "REFERENCIA",
                            ),

                        proximaJornada:
                            convertirJornada(
                                siguiente,
                                "PROXIMA",
                            ),
                    },
                },
                {
                    headers: {
                        "Cache-Control":
                            "no-store",
                    },
                },
            );
        } catch (error) {
            console.error(
                "Error carregant la competició pública:",
                error,
            );

            return Response.json(
                {
                    mensaje:
                        "No s'ha pogut carregar la competició.",
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