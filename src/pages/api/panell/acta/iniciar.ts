import type {
    APIRoute,
} from "astro";

import {
    randomUUID,
} from "node:crypto";

import {
    tieneAccesoTorneo,
    tienePermiso,
} from "@const/Permisos";

import {
    supabaseAdmin,
} from "@utils/supabase";

import {
    comprobarOrigen,
    ErrorAPI,
    UUID,
    exigirUsuario,
    responder,
} from "@utils/inscripcio/equipBase";

export const prerender =
    false;

// ============================================================
// TIPOS
// ============================================================

type Usuario =
    Awaited<
        ReturnType<
            typeof exigirUsuario
        >
    >;

type TorneoDB = {
    id: string;

    nombre:
        string | null;

    deporte:
        string | null;
};

type EdicionDB = {
    id: string;

    torneo_id:
        string | null;

    nombre:
        string | null;
};

type PartidoDB = {
    id: string;

    edicion_id:
        string;

    estado:
        string;

    finalizado_at:
        string | null;
};

type PlazaDB = {
    lado:
        | "LOCAL"
        | "VISITANTE"
        | null;

    equipo_resuelto_id:
        string | null;
};

type ActaDB = {
    id: string;

    partido_id:
        string;

    torneo_id:
        string;

    edicion_id:
        string;

    deporte:
        string;

    estado:
        string;

    nivel_estadisticas:
        string;

    operador_id:
        string | null;

    controlador_id:
        string | null;

    control_token:
        string | null;

    iniciada_at:
        string | null;

    bloqueada_por:
        string | null;

    bloqueada_at:
        string | null;

    motivo_bloqueo:
        string | null;

    finalizada_por:
        string | null;

    finalizada_at:
        string | null;

    secuencia_eventos:
        number;

    version:
        number;

    created_at:
        string;

    updated_at:
        string;
};

// ============================================================
// SELECTS
// ============================================================

const SELECT_TORNEO =
    "id,nombre,deporte";

const SELECT_EDICION =
    "id,torneo_id,nombre";

const SELECT_PARTIDO =
    "id,edicion_id,estado,finalizado_at";

const SELECT_PLAZA =
    "lado,equipo_resuelto_id";

const SELECT_ACTA =
    "id,partido_id,torneo_id,edicion_id,deporte,estado,nivel_estadisticas,operador_id,controlador_id,control_token,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,secuencia_eventos,version,created_at,updated_at";

// ============================================================
// ERROR
// ============================================================

function responderError(
    error:
        unknown,
) {
    if (
        error instanceof
        ErrorAPI
    ) {
        return responder(
            {
                success:
                    false,

                mensaje:
                    error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error iniciant l'acta:",
        error,
    );

    return responder(
        {
            success:
                false,

            mensaje:
                "No s'ha pogut iniciar l'acta.",
        },
        500,
    );
}

// ============================================================
// UUID
// ============================================================

function identificador(
    valor:
        unknown,

    nombre:
        string,
) {
    if (
        typeof valor !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            `L'identificador de ${nombre} no és vàlid.`,
        );
    }

    const limpio =
        valor
            .trim()
            .toLowerCase();

    if (
        !UUID.test(
            limpio,
        )
    ) {
        throw new ErrorAPI(
            400,
            `L'identificador de ${nombre} no és vàlid.`,
        );
    }

    return limpio;
}

// ============================================================
// NORMALIZAR DEPORTE
// ============================================================

function normalizarDeporte(
    valor:
        string | null,
) {
    return (
        valor
            ?.trim()
            .normalize(
                "NFD",
            )
            .replace(
                /[\u0300-\u036f]/g,
                "",
            )
            .toUpperCase() ??
        ""
    );
}

// ============================================================
// NIVEL ESTADISTICAS
// ============================================================

function nivelEstadisticas(
    deporte:
        string,
) {
    switch (
        deporte
    ) {
        case "FUTBOL":
            return "JUGADOR";

        case "VOLEIBOL":
            return "EQUIPO";

        default:
            return "NINGUNA";
    }
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirContexto(
    usuario:
        Usuario,

    torneoID:
        string,

    edicionID:
        string,

    partidoID:
        string,
) {
    if (
        !tieneAccesoTorneo(
            usuario,
            torneoID,
        ) ||
        !tienePermiso(
            usuario,
            "panell",
            "ver",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens accés a aquest torneig.",
        );
    }

    if (
        !tienePermiso(
            usuario,
            "partits",
            "editar",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per iniciar aquesta acta.",
        );
    }

    const [
        respuestaTorneo,
        respuestaEdicion,
        respuestaPartido,
    ] =
        await Promise.all([
            supabaseAdmin
                .from(
                    "torneos",
                )
                .select(
                    SELECT_TORNEO,
                )
                .eq(
                    "id",
                    torneoID,
                )
                .maybeSingle(),

            supabaseAdmin
                .from(
                    "ediciones",
                )
                .select(
                    SELECT_EDICION,
                )
                .eq(
                    "id",
                    edicionID,
                )
                .maybeSingle(),

            supabaseAdmin
                .from(
                    "competicion_partidos",
                )
                .select(
                    SELECT_PARTIDO,
                )
                .eq(
                    "id",
                    partidoID,
                )
                .eq(
                    "edicion_id",
                    edicionID,
                )
                .maybeSingle(),
        ]);

    if (
        respuestaTorneo.error
    ) {
        throw respuestaTorneo.error;
    }

    if (
        respuestaEdicion.error
    ) {
        throw respuestaEdicion.error;
    }

    if (
        respuestaPartido.error
    ) {
        throw respuestaPartido.error;
    }

    const torneo =
        respuestaTorneo.data as
            TorneoDB | null;

    const edicion =
        respuestaEdicion.data as
            EdicionDB | null;

    const partido =
        respuestaPartido.data as
            PartidoDB | null;

    if (
        !torneo
    ) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat el torneig.",
        );
    }

    if (
        !edicion ||
        edicion.torneo_id
            ?.trim()
            .toLowerCase() !==
            torneoID
    ) {
        throw new ErrorAPI(
            404,
            "L'edició no pertany al torneig.",
        );
    }

    if (
        !partido
    ) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat el partit.",
        );
    }

    if (
        partido.estado ===
            "CANCELADO" ||
        partido.finalizado_at ||
        partido.estado ===
            "FINALIZADO"
    ) {
        throw new ErrorAPI(
            409,
            "Aquest partit no pot iniciar una acta.",
        );
    }

    return {
        torneo,
        edicion,
        partido,
    };
}

// ============================================================
// EQUIPOS RESUELTOS
// ============================================================

async function exigirEquiposResueltos(
    partidoID:
        string,
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
                SELECT_PLAZA,
            )
            .eq(
                "destino_tipo",
                "PARTIDO",
            )
            .eq(
                "partido_id",
                partidoID,
            );

    if (
        error
    ) {
        throw error;
    }

    const plazas =
        (
            data ??
            []
        ) as PlazaDB[];

    const local =
        plazas.find(
            plaza =>
                plaza.lado ===
                "LOCAL",
        );

    const visitante =
        plazas.find(
            plaza =>
                plaza.lado ===
                "VISITANTE",
        );

    if (
        !local
            ?.equipo_resuelto_id ||
        !visitante
            ?.equipo_resuelto_id
    ) {
        throw new ErrorAPI(
            409,
            "El partit encara no té resolts els dos equips.",
        );
    }
}

// ============================================================
// ACTA
// ============================================================

async function obtenerActa(
    partidoID:
        string,
): Promise<
    ActaDB | null
> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "acta_partidos",
            )
            .select(
                SELECT_ACTA,
            )
            .eq(
                "partido_id",
                partidoID,
            )
            .maybeSingle();

    if (
        error
    ) {
        throw error;
    }

    return data as
        | ActaDB
        | null;
}

// ============================================================
// ACTA PUBLICA
// ============================================================

function actaPublica(
    acta:
        ActaDB,
) {
    return {
        id:
            acta.id,

        partido_id:
            acta.partido_id,

        estado:
            acta.estado,

        nivel_estadisticas:
            acta.nivel_estadisticas,

        operador_id:
            acta.operador_id,

        controlador_id:
            acta.controlador_id,

        iniciada_at:
            acta.iniciada_at,

        bloqueada_por:
            acta.bloqueada_por,

        bloqueada_at:
            acta.bloqueada_at,

        motivo_bloqueo:
            acta.motivo_bloqueo,

        finalizada_por:
            acta.finalizada_por,

        finalizada_at:
            acta.finalizada_at,

        version:
            acta.version,

        created_at:
            acta.created_at,

        updated_at:
            acta.updated_at,
    };
}

// ============================================================
// POST
// ============================================================

export const POST: APIRoute =
    async ({
        request,
        cookies,
        url,
    }) => {
        try {
            comprobarOrigen(
                request,
                url,
            );

            const usuario =
                await exigirUsuario(
                    cookies,
                );

            const torneoID =
                identificador(
                    url.searchParams.get(
                        "torneoID",
                    ),
                    "torneig",
                );

            const edicionID =
                identificador(
                    url.searchParams.get(
                        "edicionID",
                    ),
                    "edició",
                );

            const partidoID =
                identificador(
                    url.searchParams.get(
                        "partidoID",
                    ),
                    "partit",
                );

            const contexto =
                await exigirContexto(
                    usuario,
                    torneoID,
                    edicionID,
                    partidoID,
                );

            await exigirEquiposResueltos(
                partidoID,
            );

            let acta =
                await obtenerActa(
                    partidoID,
                );

            // =================================================
            // ACTA YA EXISTENTE
            // =================================================

            if (
                acta
            ) {
                if (
                    acta.estado ===
                    "FINALIZADA"
                ) {
                    throw new ErrorAPI(
                        409,
                        "L'acta ja està finalitzada.",
                    );
                }

                if (
                    acta.controlador_id &&
                    acta.controlador_id !==
                        usuario.id
                ) {
                    throw new ErrorAPI(
                        409,
                        "L'acta està sent controlada per un altre usuari.",
                    );
                }

                /*
                 * Si ya somos el controlador y existe token,
                 * devolvemos la misma sesión.
                 *
                 * No rotamos el token innecesariamente.
                 */
                if (
                    acta.controlador_id ===
                        usuario.id &&
                    acta.estado ===
                        "EN_CURSO" &&
                    acta.control_token
                ) {
                    return responder({
                        success:
                            true,

                        iniciado:
                            true,

                        reutilizado:
                            true,

                        acta:
                            actaPublica(
                                acta,
                            ),

                        control: {
                            puedeEditar:
                                true,

                            esControlador:
                                true,

                            puedeEscribir:
                                true,

                            controlToken:
                                acta.control_token,
                        },
                    });
                }

                const ahora =
                    new Date()
                        .toISOString();

                const token =
                    randomUUID()
                        .toLowerCase();

                const {
                    data,
                    error,
                } =
                    await supabaseAdmin
                        .from(
                            "acta_partidos",
                        )
                        .update({
                            estado:
                                "EN_CURSO",

                            operador_id:
                                acta.operador_id ??
                                usuario.id,

                            controlador_id:
                                usuario.id,

                            control_token:
                                token,

                            iniciada_at:
                                acta.iniciada_at ??
                                ahora,

                            bloqueada_por:
                                null,

                            bloqueada_at:
                                null,

                            motivo_bloqueo:
                                null,

                            version:
                                acta.version +
                                1,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            acta.id,
                        )
                        .eq(
                            "version",
                            acta.version,
                        )
                        .select(
                            SELECT_ACTA,
                        )
                        .maybeSingle();

                if (
                    error
                ) {
                    throw error;
                }

                if (
                    !data
                ) {
                    throw new ErrorAPI(
                        409,
                        "L'acta ha canviat. Recarrega la pàgina.",
                    );
                }

                acta =
                    data as
                        ActaDB;

                return responder({
                    success:
                        true,

                    iniciado:
                        true,

                    reutilizado:
                        false,

                    acta:
                        actaPublica(
                            acta,
                        ),

                    control: {
                        puedeEditar:
                            true,

                        esControlador:
                            true,

                        puedeEscribir:
                            true,

                        controlToken:
                            acta.control_token,
                    },
                });
            }

            // =================================================
            // NUEVA ACTA
            // =================================================

            const deporte =
                normalizarDeporte(
                    contexto.torneo
                        .deporte,
                );

            const ahora =
                new Date()
                    .toISOString();

            const token =
                randomUUID()
                    .toLowerCase();

            const nivel =
                nivelEstadisticas(
                    deporte,
                );

            const {
                data,
                error,
            } =
                await supabaseAdmin
                    .from(
                        "acta_partidos",
                    )
                    .insert({
                        partido_id:
                            partidoID,

                        torneo_id:
                            torneoID,

                        edicion_id:
                            edicionID,

                        deporte,

                        estado:
                            "EN_CURSO",

                        nivel_estadisticas:
                            nivel,

                        configuracion_snapshot: {
                            deporte,

                            estadisticas: {
                                nivel,
                            },
                        },

                        operador_id:
                            usuario.id,

                        controlador_id:
                            usuario.id,

                        control_token:
                            token,

                        iniciada_at:
                            ahora,

                        secuencia_eventos:
                            0,

                        version:
                            1,

                        created_at:
                            ahora,

                        updated_at:
                            ahora,
                    })
                    .select(
                        SELECT_ACTA,
                    )
                    .single();

            if (
                error
            ) {
                throw error;
            }

            acta =
                data as
                    ActaDB;

            return responder({
                success:
                    true,

                iniciado:
                    true,

                reutilizado:
                    false,

                acta:
                    actaPublica(
                        acta,
                    ),

                control: {
                    puedeEditar:
                        true,

                    esControlador:
                        true,

                    puedeEscribir:
                        true,

                    controlToken:
                        acta.control_token,
                },
            });
        } catch (
            error
        ) {
            return responderError(
                error,
            );
        }
    };