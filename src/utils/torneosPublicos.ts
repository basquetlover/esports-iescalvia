import {
    supabaseAdmin,
} from "@utils/supabase";

import type {
    ApartadoNormativa,
    BloqueInformacion,
    ConfigEquiposPublica,
    ConfigVoluntariosPublica,
    DatosTorneoPublico,
    EdicionPublica,
    TorneoPublico,
} from "@components/tornejos/tipos";

// ============================================================
// TIPOS INTERNOS
// ============================================================

type Registro =
    Record<
        string,
        unknown
    >;

type TorneoDB = {
    id: string;

    nombre:
        string | null;

    banner:
        string | null;

    deporte:
        string | null;

    descripcion:
        string | null;

    normativa_base:
        string | null;
};

type EdicionDB = {
    id: string;

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
};

type ConfiguracionDB = {
    equipos:
        unknown;

    voluntarios:
        unknown;

    informacion:
        unknown;
};

// ============================================================
// HELPERS
// ============================================================

function esRegistro(
    valor:
        unknown,
): valor is Registro {
    return (
        valor !==
            null &&
        typeof valor ===
            "object" &&
        !Array.isArray(
            valor,
        )
    );
}

function texto(
    valor:
        unknown,
) {
    return (
        typeof valor ===
        "string"
            ? valor
            : ""
    );
}

function numeroNullable(
    valor:
        unknown,
) {
    return (
        typeof valor ===
            "number" &&
        Number.isFinite(
            valor,
        )
            ? valor
            : null
    );
}

// ============================================================
// ESTADOS
// ============================================================

export function normalizarEstadoEdicion(
    estado:
        string | null,
) {
    return (
        estado
            ?.trim()
            .toUpperCase() ??
        ""
    );
}

export function nombreEstadoEdicion(
    estado:
        string | null,
) {
    const valor =
        normalizarEstadoEdicion(
            estado,
        );

    if (
        valor ===
        "ACTIVA"
    ) {
        return "En curs";
    }

    if (
        valor ===
            "EN_PREPARACIO" ||
        valor ===
            "EN_PREPARACIÓN" ||
        valor ===
            "EN_PREPARACION"
    ) {
        return "Pròximament";
    }

    if (
        valor ===
        "FINALIZADA"
    ) {
        return "Finalitzada";
    }

    return "Disponible";
}

function esEdicionPublica(
    edicion:
        EdicionDB,
) {
    const estado =
        normalizarEstadoEdicion(
            edicion.estado,
        );

    return (
        estado ===
            "ACTIVA" ||
        estado ===
            "FINALIZADA" ||
        estado ===
            "EN_PREPARACIO" ||
        estado ===
            "EN_PREPARACIÓN" ||
        estado ===
            "EN_PREPARACION"
    );
}

function prioridadEstado(
    estado:
        string | null,
) {
    const valor =
        normalizarEstadoEdicion(
            estado,
        );

    if (
        valor ===
        "ACTIVA"
    ) {
        return 0;
    }

    if (
        valor ===
            "EN_PREPARACIO" ||
        valor ===
            "EN_PREPARACIÓN" ||
        valor ===
            "EN_PREPARACION"
    ) {
        return 1;
    }

    if (
        valor ===
        "FINALIZADA"
    ) {
        return 2;
    }

    return 3;
}

// ============================================================
// SELECCIONAR EDICIÓN
// ============================================================

function seleccionarEdicion(
    ediciones:
        EdicionPublica[],

    edicionID:
        string | null,
) {
    if (
        edicionID
    ) {
        const solicitada =
            ediciones.find(
                edicion =>
                    edicion.id ===
                    edicionID,
            );

        if (
            solicitada
        ) {
            return solicitada;
        }
    }

    return (
        [...ediciones]
            .sort(
                (
                    a,
                    b,
                ) => {
                    const prioridad =
                        prioridadEstado(
                            a.estado,
                        ) -
                        prioridadEstado(
                            b.estado,
                        );

                    if (
                        prioridad !==
                        0
                    ) {
                        return prioridad;
                    }

                    const fechaA =
                        a.fecha_inicio
                            ? new Date(
                                  a.fecha_inicio,
                              ).getTime()
                            : 0;

                    const fechaB =
                        b.fecha_inicio
                            ? new Date(
                                  b.fecha_inicio,
                              ).getTime()
                            : 0;

                    return (
                        fechaB -
                        fechaA
                    );
                },
            )[0] ??
        null
    );
}

// ============================================================
// INFORMACIÓN
// ============================================================

function leerBloquesInformacion(
    valor:
        unknown,
): BloqueInformacion[] {
    if (
        !esRegistro(
            valor,
        ) ||
        !Array.isArray(
            valor.bloques,
        )
    ) {
        return [];
    }

    return valor.bloques
        .filter(
            (
                bloque,
            ): bloque is Registro =>
                esRegistro(
                    bloque,
                ),
        )
        .map(
            bloque => ({
                id:
                    texto(
                        bloque.id,
                    ),

                order:
                    typeof bloque.order ===
                        "number"
                        ? bloque.order
                        : 0,

                title:
                    texto(
                        bloque.title,
                    ),

                body:
                    texto(
                        bloque.body,
                    ),
            }),
        )
        .filter(
            bloque =>
                Boolean(
                    bloque.title ||
                    bloque.body,
                ),
        )
        .sort(
            (
                a,
                b,
            ) =>
                a.order -
                b.order,
        );
}

// ============================================================
// EQUIPOS
// ============================================================

function leerConfigEquipos(
    valor:
        unknown,
): ConfigEquiposPublica | null {
    if (
        !esRegistro(
            valor,
        )
    ) {
        return null;
    }

    const inscripcion =
        esRegistro(
            valor.inscripcion,
        )
            ? valor.inscripcion
            : {};

    const cupo =
        esRegistro(
            valor.cupo,
        )
            ? valor.cupo
            : {};

    const jugadores =
        esRegistro(
            valor.jugadores,
        )
            ? valor.jugadores
            : {};

    return {
        inscripcion: {
            apertura:
                texto(
                    inscripcion.apertura,
                ) ||
                null,

            cierre:
                texto(
                    inscripcion.cierre,
                ) ||
                null,
        },

        cupo: {
            maximo:
                numeroNullable(
                    cupo.maximo,
                ),
        },

        jugadores: {
            minimo:
                numeroNullable(
                    jugadores.minimo,
                ),

            maximo:
                numeroNullable(
                    jugadores.maximo,
                ),
        },
    };
}

// ============================================================
// VOLUNTARIADO
// ============================================================

function leerConfigVoluntarios(
    valor:
        unknown,
): ConfigVoluntariosPublica | null {
    if (
        !esRegistro(
            valor,
        )
    ) {
        return null;
    }

    const inscripcion =
        esRegistro(
            valor.inscripcion,
        )
            ? valor.inscripcion
            : {};

    const cupo =
        esRegistro(
            valor.cupo,
        )
            ? valor.cupo
            : {};

    const tipos =
        Array.isArray(
            valor.tipos,
        )
            ? valor.tipos
                  .filter(
                      (
                          tipo,
                      ): tipo is Registro =>
                          esRegistro(
                              tipo,
                          ),
                  )
                  .map(
                      tipo => {
                          const cupoTipo =
                              esRegistro(
                                  tipo.cupo,
                              )
                                  ? tipo.cupo
                                  : {};

                          return {
                              nombre:
                                  texto(
                                      tipo.nombre,
                                  ),

                              descripcion:
                                  texto(
                                      tipo.descripcion,
                                  ),

                              activo:
                                  tipo.activo ===
                                  true,

                              maximo:
                                  numeroNullable(
                                      cupoTipo.maximo,
                                  ),
                          };
                      },
                  )
                  .filter(
                      tipo =>
                          tipo.activo &&
                          tipo.nombre,
                  )
                  .map(
                      tipo => ({
                          nombre:
                              tipo.nombre,

                          descripcion:
                              tipo.descripcion,

                          maximo:
                              tipo.maximo,
                      }),
                  )
            : [];

    return {
        inscripcion: {
            apertura:
                texto(
                    inscripcion.apertura,
                ) ||
                null,

            cierre:
                texto(
                    inscripcion.cierre,
                ) ||
                null,
        },

        cupo: {
            maximo:
                numeroNullable(
                    cupo.maximo,
                ),
        },

        tipos,
    };
}

// ============================================================
// NORMATIVA
// ============================================================

function leerNormativa(
    valor:
        string | null,
): ApartadoNormativa[] {
    if (
        !valor
    ) {
        return [];
    }

    try {
        const datos:
            unknown =
            JSON.parse(
                valor,
            );

        if (
            !Array.isArray(
                datos,
            )
        ) {
            return [];
        }

        return datos
            .filter(
                (
                    apartado,
                ): apartado is Registro =>
                    esRegistro(
                        apartado,
                    ),
            )
            .map(
                (
                    apartado,
                    indice,
                ) => ({
                    numero:
                        typeof apartado.numero ===
                            "number"
                            ? apartado.numero
                            : indice +
                              1,

                    titulo:
                        texto(
                            apartado.titulo,
                        ),

                    articulos:
                        Array.isArray(
                            apartado.articulos,
                        )
                            ? apartado.articulos
                                  .filter(
                                      (
                                          articulo,
                                      ): articulo is Registro =>
                                          esRegistro(
                                              articulo,
                                          ),
                                  )
                                  .map(
                                      articulo => ({
                                          numero:
                                              texto(
                                                  articulo.numero,
                                              ),

                                          texto:
                                              texto(
                                                  articulo.texto,
                                              ),
                                      }),
                                  )
                                  .filter(
                                      articulo =>
                                          Boolean(
                                              articulo.texto,
                                          ),
                                  )
                            : [],
                }),
            )
            .filter(
                apartado =>
                    Boolean(
                        apartado.titulo ||
                        apartado
                            .articulos
                            .length >
                            0,
                    ),
            );
    } catch {
        return [];
    }
}

// ============================================================
// OBTENER TORNEO
// ============================================================

export async function obtenerTorneoPublico(
    torneoID:
        string,

    edicionID:
        string | null,
): Promise<
    DatosTorneoPublico | null
> {
    const UUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        !UUID.test(
            torneoID,
        )
    ) {
        return null;
    }

    const {
        data:
            torneoData,
        error:
            torneoError,
    } =
        await supabaseAdmin
            .from(
                "torneos",
            )
            .select(
                "id,nombre,banner,deporte,descripcion,normativa_base"
            )
            .eq(
                "id",
                torneoID,
            )
            .eq(
                "activo",
                true,
            )
            .maybeSingle();

    if (
        torneoError
    ) {
        throw torneoError;
    }

    if (
        !torneoData
    ) {
        return null;
    }

    const torneoDB =
        torneoData as TorneoDB;

    const torneo:
        TorneoPublico = {
        id:
            torneoDB.id,

        nombre:
            torneoDB.nombre ??
            "Torneig",

        banner:
            torneoDB.banner ??
            "",

        deporte:
            torneoDB.deporte ??
            "",

        descripcion:
            torneoDB.descripcion ??
            "",

        normativa_base:
            torneoDB.normativa_base,
    };

    // ========================================================
    // EDICIONES
    // ========================================================

    const {
        data:
            edicionesData,
        error:
            edicionesError,
    } =
        await supabaseAdmin
            .from(
                "ediciones",
            )
            .select(
                "id,torneo_id,nombre,fecha_inicio,fecha_fin,estado,sede"
            )
            .eq(
                "torneo_id",
                torneo.id,
            )
            .order(
                "fecha_inicio",
                {
                    ascending:
                        false,

                    nullsFirst:
                        false,
                },
            );

    if (
        edicionesError
    ) {
        throw edicionesError;
    }

    const ediciones:
        EdicionPublica[] =
        (
            (
                edicionesData ??
                []
            ) as EdicionDB[]
        )
            .filter(
                edicion =>
                    Boolean(
                        edicion.torneo_id &&
                        esEdicionPublica(
                            edicion,
                        ),
                    ),
            )
            .map(
                edicion => ({
                    id:
                        edicion.id,

                    torneo_id:
                        edicion.torneo_id!,

                    nombre:
                        edicion.nombre ??
                        "Edició",

                    fecha_inicio:
                        edicion.fecha_inicio,

                    fecha_fin:
                        edicion.fecha_fin,

                    estado:
                        edicion.estado ??
                        "",

                    sede:
                        edicion.sede ??
                        "",
                }),
            );

    const edicionActual =
        seleccionarEdicion(
            ediciones,
            edicionID,
        );

    // ========================================================
    // CONFIGURACIÓN
    // ========================================================

    let configuracion:
        ConfiguracionDB | null =
        null;

    if (
        edicionActual
    ) {
        const {
            data,
            error,
        } =
            await supabaseAdmin
                .from(
                    "configuracion_ediciones",
                )
                .select(
                    "equipos,voluntarios,informacion"
                )
                .eq(
                    "edicion_id",
                    edicionActual.id,
                )
                .maybeSingle();

        if (
            error
        ) {
            throw error;
        }

        configuracion =
            data as
                | ConfiguracionDB
                | null;
    }

    const bloques =
        leerBloquesInformacion(
            configuracion
                ?.informacion,
        );

    const configEquipos =
        leerConfigEquipos(
            configuracion
                ?.equipos,
        );

    const configVoluntarios =
        leerConfigVoluntarios(
            configuracion
                ?.voluntarios,
        );

    const normativa =
        leerNormativa(
            torneo.normativa_base,
        );

    const tieneInscripcion =
        Boolean(
            configEquipos &&
                (
                    configEquipos
                        .inscripcion
                        .apertura ||
                    configEquipos
                        .inscripcion
                        .cierre ||
                    configEquipos
                        .cupo
                        .maximo !==
                        null ||
                    configEquipos
                        .jugadores
                        .minimo !==
                        null ||
                    configEquipos
                        .jugadores
                        .maximo !==
                        null
                ),
        );

    const tieneVoluntariado =
        Boolean(
            configVoluntarios &&
                (
                    configVoluntarios
                        .inscripcion
                        .apertura ||
                    configVoluntarios
                        .inscripcion
                        .cierre ||
                    configVoluntarios
                        .cupo
                        .maximo !==
                        null ||
                    configVoluntarios
                        .tipos
                        .length >
                        0
                ),
        );

    return {
        torneo,

        ediciones,

        edicionActual,

        estadoActual:
            edicionActual
                ? nombreEstadoEdicion(
                      edicionActual.estado,
                  )
                : "Disponible",

        bloques,

        configEquipos,

        configVoluntarios,

        normativa,

        tieneInscripcion,

        tieneVoluntariado,
    };
}