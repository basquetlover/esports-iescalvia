import type { APIRoute } from "astro";

import {
    randomUUID,
} from "node:crypto";

import {
    tieneAccesoTorneo,
    tienePermiso,
} from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
    comprobarOrigen,
    ErrorAPI,
    UUID,
    exigirUsuario,
    responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

type Usuario =
    Awaited<
        ReturnType<typeof exigirUsuario>
    >;

type TorneoDB = {
    id: string;
    nombre: string | null;
    deporte: string | null;
};

type EdicionDB = {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
};

type PartidoDB = {
    id: string;
    edicion_id: string;
    estado: string;
    finalizado_at: string | null;
};

type ActaDB = {
    id: string;
    partido_id: string;
    torneo_id: string;
    edicion_id: string;
    deporte: string;
    estado: string;
    nivel_estadisticas: string;
    operador_id: string | null;
    controlador_id: string | null;
    control_token: string | null;
    iniciada_at: string | null;
    bloqueada_por: string | null;
    bloqueada_at: string | null;
    motivo_bloqueo: string | null;
    finalizada_por: string | null;
    finalizada_at: string | null;
    secuencia_eventos: number;
    version: number;
    created_at: string;
    updated_at: string;
};

type PlazaDB = {
    lado:
        | "LOCAL"
        | "VISITANTE"
        | null;

    equipo_resuelto_id:
        string | null;
};

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

function responderError(
    error: unknown,
) {
    if (
        error instanceof
        ErrorAPI
    ) {
        return responder(
            {
                success: false,
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
            success: false,
            mensaje:
                "No s'ha pogut iniciar l'acta.",
        },
        500,
    );
}

function identificador(
    valor: unknown,
    nombre: string,
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
        !UUID.test(limpio)
    ) {
        throw new ErrorAPI(
            400,
            `L'identificador de ${nombre} no és vàlid.`,
        );
    }

    return limpio;
}

function normalizarDeporte(
    valor: string | null,
) {
    return (
        valor
            ?.trim()
            .normalize("NFD")
            .replace(
                /[\u0300-\u036f]/g,
                "",
            )
            .toUpperCase() ??
        ""
    );
}

function nivelEstadisticas(
    deporte: string,
) {
    if (
        deporte ===
        "FUTBOL"
    ) {
        return "JUGADOR";
    }

    if (
        deporte ===
        "VOLEIBOL"
    ) {
        return "EQUIPO";
    }

    return "NINGUNA";
}

async function exigirContexto(
    usuario: Usuario,
    torneoID: string,
    edicionID: string,
    partidoID: string,
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

    /*
     * Cualquier usuario con permiso de editar partidos
     * puede iniciar/modificar un acta.
     *
     * No necesita estar previamente designado.
     */
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
            "No tens permís per modificar aquesta acta.",
        );
    }

    const [
        torneoRespuesta,
        edicionRespuesta,
        partidoRespuesta,
    ] =
        await Promise.all([
            supabaseAdmin
                .from("torneos")
                .select(
                    SELECT_TORNEO,
                )
                .eq(
                    "id",
                    torneoID,
                )
                .maybeSingle(),

            supabaseAdmin
                .from("ediciones")
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
        partidoRespuesta.error
    ) {
        throw partidoRespuesta.error;
    }

    const torneo =
        torneoRespuesta.data as
            TorneoDB | null;

    const edicion =
        edicionRespuesta.data as
            EdicionDB | null;

    const partido =
        partidoRespuesta.data as
            PartidoDB | null;

    if (!torneo) {
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

    if (!partido) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat el partit.",
        );
    }

    if (
        partido.finalizado_at
    ) {
        throw new ErrorAPI(
            409,
            "El partit ja està finalitzat.",
        );
    }

    return {
        torneo,
        edicion,
        partido,
    };
}

async function exigirEquiposResueltos(
    partidoID: string,
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

    if (error) {
        throw error;
    }

    const plazas =
        (
            data ?? []
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
        !local?.equipo_resuelto_id ||
        !visitante?.equipo_resuelto_id
    ) {
        throw new ErrorAPI(
            409,
            "El partit encara no té resolts els dos equips.",
        );
    }
}

async function obtenerActa(
    partidoID: string,
): Promise<ActaDB | null> {
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

    if (error) {
        throw error;
    }

    return data as
        | ActaDB
        | null;
}

function respuestaActa(
    acta: ActaDB,
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

            if (acta) {
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
                    acta.estado ===
                        "BLOQUEADA" &&
                    acta.controlador_id !==
                        usuario.id
                ) {
                    throw new ErrorAPI(
                        423,
                        "L'acta està bloquejada per un altre usuari.",
                    );
                }

                if (
                    acta.controlador_id &&
                    acta.controlador_id !==
                        usuario.id
                ) {
                    throw new ErrorAPI(
                        409,
                        "L'acta ja està sent gestionada per un altre usuari.",
                    );
                }

                if (
                    acta.estado ===
                        "EN_CURSO" &&
                    acta.controlador_id ===
                        usuario.id &&
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
                            respuestaActa(
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
                    randomUUID();

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

                if (error) {
                    throw error;
                }

                if (!data) {
                    throw new ErrorAPI(
                        409,
                        "L'acta ha canviat. Recarrega la pàgina.",
                    );
                }

                acta =
                    data as ActaDB;

                return responder({
                    success:
                        true,

                    iniciado:
                        true,

                    reutilizado:
                        false,

                    acta:
                        respuestaActa(
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

            const deporte =
                normalizarDeporte(
                    contexto.torneo
                        .deporte,
                );

            const ahora =
                new Date()
                    .toISOString();

            const token =
                randomUUID();

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
                            nivelEstadisticas(
                                deporte,
                            ),

                        configuracion_snapshot: {
                            deporte,

                            estadisticas: {
                                nivel:
                                    nivelEstadisticas(
                                        deporte,
                                    ),
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

            if (error) {
                throw error;
            }

            acta =
                data as ActaDB;

            return responder({
                success:
                    true,

                iniciado:
                    true,

                reutilizado:
                    false,

                acta:
                    respuestaActa(
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