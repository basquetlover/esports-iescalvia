import type { APIRoute } from "astro";

import {
    normalizarRol,
    tienePermiso,
} from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
    ErrorAPI,
    UUID,
    comprobarOrigen,
    exigirUsuario,
    leerJSON,
    responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

const APROBADOS = ["APROBADO", "ACEPTADO"];

function identificador(
    valor: unknown,
    nombre: string,
): string {
    if (
        typeof valor !== "string" ||
        !UUID.test(valor)
    ) {
        throw new ErrorAPI(
            400,
            `L'identificador de ${nombre} no és vàlid.`,
        );
    }

    return valor.toLowerCase();
}

async function exigirEdicion(
    torneoID: string,
    edicionID: string,
) {
    const { data, error } = await supabaseAdmin
        .from("ediciones")
        .select("id,torneo_id,nombre")
        .eq("id", edicionID)
        .maybeSingle();

    if (error) throw error;

    if (
        !data ||
        data.torneo_id.toLowerCase() !== torneoID
    ) {
        throw new ErrorAPI(
            404,
            "L'edició no pertany a aquest torneig.",
        );
    }

    return data;
}

/**
 * El formulario aceptado determina el acceso del voluntario.
 * Comprueba usuario, torneo, edición, aceptación y plaza.
 *
 * Las páginas y API destinadas al voluntario deben usar
 * esta comprobación para cada edición.
 */
export async function tieneAccesoVoluntarioEdicion(
    usuarioID: string,
    torneoID: string,
    edicionID: string,
): Promise<boolean> {
    if (
        ![usuarioID, torneoID, edicionID].every(
            id => UUID.test(id),
        )
    ) {
        return false;
    }

    const {
        data: edicion,
        error: errorEdicion,
    } = await supabaseAdmin
        .from("ediciones")
        .select("torneo_id")
        .eq("id", edicionID)
        .maybeSingle();

    if (errorEdicion) throw errorEdicion;

    if (
        edicion?.torneo_id.toLowerCase() !==
        torneoID.toLowerCase()
    ) {
        return false;
    }

    const {
        data: formularios,
        error: errorFormularios,
    } = await supabaseAdmin
        .from("formularios")
        .select("id")
        .eq("edicion_id", edicionID)
        .eq("usuario_id", usuarioID)
        .eq("tipo", "VOLUNTARIO")
        .in("estado", APROBADOS);

    if (errorFormularios) {
        throw errorFormularios;
    }

    if (!formularios?.length) {
        return false;
    }

    const {
        data: voluntario,
        error: errorVoluntario,
    } = await supabaseAdmin
        .from("voluntarios")
        .select("id")
        .in(
            "formulario_id",
            formularios.map(formulario => formulario.id),
        )
        .in("validacion_estado", APROBADOS)
        .eq("plaza_estado", "CONFIRMADA")
        .limit(1)
        .maybeSingle();

    if (errorVoluntario) {
        throw errorVoluntario;
    }

    return Boolean(voluntario);
}

function errorRespuesta(error: unknown): Response {
    if (error instanceof ErrorAPI) {
        return responder(
            {
                success: false,
                mensaje: error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error gestionant el voluntariat:",
        error,
    );

    return responder(
        {
            success: false,
            mensaje:
                "No s'ha pogut completar l'operació.",
        },
        500,
    );
}

export const GET: APIRoute = async ({
    cookies,
    url,
}) => {
    try {
        const administrador =
            await exigirUsuario(cookies);

        const torneoID = identificador(
            url.searchParams.get("torneoID"),
            "torneig",
        );

        const edicionID = identificador(
            url.searchParams.get("edicionID"),
            "edició",
        );

        const edicion = await exigirEdicion(
            torneoID,
            edicionID,
        );

        if (
            !tienePermiso(
                administrador,
                "voluntaris",
                "ver",
                torneoID,
            )
        ) {
            throw new ErrorAPI(
                403,
                "No tens permís per consultar els voluntaris d'aquest torneig.",
            );
        }

        const pagina = Number(
            url.searchParams.get("pagina") ?? "1",
        );

        if (
            !Number.isSafeInteger(pagina) ||
            pagina < 1 ||
            pagina > 10_000
        ) {
            throw new ErrorAPI(
                400,
                "La pàgina sol·licitada no és vàlida.",
            );
        }

        const desde = (pagina - 1) * 30;

        const {
            data: formularios,
            count,
            error,
        } = await supabaseAdmin
            .from("formularios")
            .select(
                "id,usuario_id,estado,enviado_at,created_at",
                { count: "exact" },
            )
            .eq("edicion_id", edicionID)
            .eq("tipo", "VOLUNTARIO")
            .order("created_at", {
                ascending: false,
            })
            .range(desde, desde + 29);

        if (error) throw error;

        const ids = (formularios ?? []).map(
            formulario => formulario.id,
        );

        const {
            data: voluntarios,
            error: errorVoluntarios,
        } = ids.length
            ? await supabaseAdmin
                .from("voluntarios")
                .select(
                    "id,formulario_id,nombre,apellido1,apellido2,email,curso,grupo,tipo_voluntariado,descripcion,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at",
                )
                .in("formulario_id", ids)
            : {
                data: [],
                error: null,
            };

        if (errorVoluntarios) {
            throw errorVoluntarios;
        }

        const porFormulario = new Map(
            (voluntarios ?? []).map(voluntario => [
                voluntario.formulario_id,
                voluntario,
            ]),
        );

        return responder({
            success: true,
            torneoID,
            edicion: {
                id: edicion.id,
                nombre: edicion.nombre,
            },
            pagina,
            total: count ?? 0,
            voluntarios: (formularios ?? []).map(
                formulario => ({
                    formulario_id: formulario.id,
                    usuario_id: formulario.usuario_id,
                    estado: formulario.estado,
                    enviado_at: formulario.enviado_at,
                    voluntario:
                        porFormulario.get(
                            formulario.id,
                        ) ?? null,
                }),
            ),
        });
    } catch (error) {
        return errorRespuesta(error);
    }
};

export const PATCH: APIRoute = async ({
    cookies,
    request,
    url,
}) => {
    try {
        comprobarOrigen(request, url);

        const administrador =
            await exigirUsuario(cookies);

        const entrada = await leerJSON(request);

        const torneoID = identificador(
            entrada.torneoID,
            "torneig",
        );

        const edicionID = identificador(
            entrada.edicionID,
            "edició",
        );

        const voluntarioID = identificador(
            entrada.voluntarioID,
            "voluntari",
        );

        await exigirEdicion(
            torneoID,
            edicionID,
        );

        if (
            !tienePermiso(
                administrador,
                "voluntaris",
                "editar",
                torneoID,
            )
        ) {
            throw new ErrorAPI(
                403,
                "No tens permís per revisar voluntaris d'aquest torneig.",
            );
        }

        if (
            entrada.accion !== "aceptar" &&
            entrada.accion !== "rechazar"
        ) {
            throw new ErrorAPI(
                400,
                "L'acció indicada no és vàlida.",
            );
        }

        const {
            data: voluntario,
            error: errorVoluntario,
        } = await supabaseAdmin
            .from("voluntarios")
            .select(
                "id,formulario_id,validacion_estado,plaza_estado",
            )
            .eq("id", voluntarioID)
            .maybeSingle();

        if (errorVoluntario) {
            throw errorVoluntario;
        }

        if (!voluntario) {
            throw new ErrorAPI(
                404,
                "No s'ha trobat el voluntari.",
            );
        }

        const {
            data: formulario,
            error: errorFormulario,
        } = await supabaseAdmin
            .from("formularios")
            .select("id,usuario_id,estado")
            .eq("id", voluntario.formulario_id)
            .eq("tipo", "VOLUNTARIO")
            .eq("edicion_id", edicionID)
            .maybeSingle();

        if (errorFormulario) {
            throw errorFormulario;
        }

        if (!formulario) {
            throw new ErrorAPI(
                404,
                "El voluntari no pertany a aquesta edició.",
            );
        }

        if (!formulario.usuario_id) {
            throw new ErrorAPI(
                409,
                "El voluntari necessita un compte vinculat al formulari.",
            );
        }

        const aceptar =
            entrada.accion === "aceptar";

        const estadoNuevo = aceptar
            ? "APROBADO"
            : "DENEGADO";

        const plazaNueva = aceptar
            ? "CONFIRMADA"
            : "SIN_PLAZA";

        /*
         * El rol básico permite entrar al panel.
         * El formulario aceptado limita el acceso del
         * voluntario a esta edición concreta.
         */
        if (aceptar) {
            const {
                data: usuario,
                error: errorUsuario,
            } = await supabaseAdmin
                .from("users")
                .select("id,rol,activa")
                .eq("id", formulario.usuario_id)
                .maybeSingle();

            if (errorUsuario) {
                throw errorUsuario;
            }

            if (
                !usuario ||
                usuario.activa !== true
            ) {
                throw new ErrorAPI(
                    409,
                    "El compte del voluntari no està actiu.",
                );
            }

            if (
                usuario.rol !== null &&
                !normalizarRol(usuario.rol)
            ) {
                throw new ErrorAPI(
                    409,
                    "El compte té un rol que cal revisar abans d'acceptar-lo.",
                );
            }

            if (usuario.rol === null) {
                const {
                    data: rolGuardado,
                    error: errorRol,
                } = await supabaseAdmin
                    .from("users")
                    .update({
                        rol: "voluntario",
                        fecha_actualizacion:
                            new Date().toISOString(),
                    })
                    .eq("id", usuario.id)
                    .is("rol", null)
                    .select("id")
                    .maybeSingle();

                if (errorRol) {
                    throw errorRol;
                }

                if (!rolGuardado) {
                    throw new ErrorAPI(
                        409,
                        "El rol del compte ha canviat; torna a intentar-ho.",
                    );
                }
            }
        }

        const ahora =
            new Date().toISOString();

        const {
            data: voluntarioGuardado,
            error: errorActualizacion,
        } = await supabaseAdmin
            .from("voluntarios")
            .update({
                validacion_estado: estadoNuevo,
                plaza_estado: plazaNueva,
                posicion_lista_espera: null,
                updated_at: ahora,
            })
            .eq("id", voluntario.id)
            .eq(
                "formulario_id",
                formulario.id,
            )
            .select("id")
            .maybeSingle();

        if (errorActualizacion) {
            throw errorActualizacion;
        }

        if (!voluntarioGuardado) {
            throw new ErrorAPI(
                409,
                "El voluntari ha canviat durant la revisió.",
            );
        }

        const {
            data: guardado,
            error: errorEstado,
        } = await supabaseAdmin
            .from("formularios")
            .update({
                estado: estadoNuevo,
                updated_at: ahora,
            })
            .eq("id", formulario.id)
            .eq("edicion_id", edicionID)
            .select("id")
            .maybeSingle();

        if (errorEstado || !guardado) {
            const {
                error: errorRestauracion,
            } = await supabaseAdmin
                .from("voluntarios")
                .update({
                    validacion_estado:
                        voluntario.validacion_estado,
                    plaza_estado:
                        voluntario.plaza_estado,
                    updated_at: ahora,
                })
                .eq("id", voluntario.id)
                .eq(
                    "formulario_id",
                    formulario.id,
                );

            if (errorRestauracion) {
                console.error(
                    "No s'ha pogut restaurar l'estat del voluntari:",
                    errorRestauracion,
                );
            }

            if (errorEstado) {
                throw errorEstado;
            }

            throw new ErrorAPI(
                409,
                "El formulari ha canviat durant la revisió.",
            );
        }

        return responder({
            success: true,
            estado: estadoNuevo,
            plaza_estado: plazaNueva,
            acceso: aceptar
                ? {
                    torneoID,
                    edicionID,
                }
                : null,
        });
    } catch (error) {
        return errorRespuesta(error);
    }
};