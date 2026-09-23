import type { APIRoute } from "astro";

import {
    comprobarOrigen,
    leerJSON,
} from "@utils/inscripcio/equipBase";

import {
    ErrorAPI,
    esBorradorAdministrativo,
    esRegistro,
    leerIDAdmin,
    nombreCompleto,
    normalizarEstadoFormulario,
    normalizarEstadoPlaza,
    normalizarOrigenFormulario,
    normalizarValidacion,
    obtenerCapacidades,
    obtenerConfiguracionFormularioAdmin,
    obtenerContextoEquipoAdmin,
    obtenerObservacionesAdmin,
    obtenerParticipantesAdmin,
    obtenerResponsableAdmin,
    prepararParticipanteSalida,
    responder,
    responderErrorAdmin,
    type Registro,
} from "@utils/panell/equips/adminComun";

import {
    editarEquipoAdmin,
} from "@utils/panell/equips/adminEdicion";

import {
    aprobarEquipoAdmin,
    cambiarEstadoEvaluacionEquipoAdmin,
    cambiarPlazaEquipoAdmin,
    finalizarBorradorEquipoAdmin,
    solicitarCambiosEquipoAdmin,
} from "@utils/panell/equips/adminEvaluacion";

// ============================================================
// ACCIONES
// ============================================================

type AccionPatch =
    | "editar"
    | "aprobar"
    | "finalizar-borrador"
    | "solicitar-cambios"
    | "cambiar-evaluacion"
    | "cambiar-plaza";

// ============================================================
// LEER ACCIÓN
// ============================================================

function leerAccion(
    cuerpo: Registro,
): AccionPatch {
    if (
        typeof cuerpo.accion !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            "Falta l'acció que vols realitzar.",
        );
    }

    const accion =
        cuerpo.accion
            .trim()
            .toLowerCase();

    if (
        accion !==
            "editar" &&
        accion !==
            "aprobar" &&
        accion !==
            "finalizar-borrador" &&
        accion !==
            "solicitar-cambios" &&
        accion !==
            "cambiar-evaluacion" &&
        accion !==
            "cambiar-plaza"
    ) {
        throw new ErrorAPI(
            400,
            "L'acció indicada no és vàlida.",
        );
    }

    return accion;
}

// ============================================================
// PREPARAR RESPONSABLE
// ============================================================

function prepararResponsable({
    responsable,
    emailContacto,
}: {
    responsable:
        Awaited<
            ReturnType<
                typeof obtenerResponsableAdmin
            >
        >;

    emailContacto:
        string | null;
}) {
    if (
        !responsable
    ) {
        return {
            id:
                null,

            nombre:
                "",

            apellido1:
                "",

            apellido2:
                "",

            nombre_completo:
                "",

            email:
                emailContacto ??
                "",

            curso:
                "",

            ano_academico:
                "",
        };
    }

    return {
        id:
            responsable.id,

        nombre:
            responsable.nombre ??
            "",

        apellido1:
            responsable.apellido1 ??
            "",

        apellido2:
            responsable.apellido2 ??
            "",

        nombre_completo:
            nombreCompleto(
                responsable,
            ),

        email:
            responsable.email ??
            emailContacto ??
            "",

        curso:
            responsable.curso ??
            "",

        ano_academico:
            responsable.ano_academico ??
            "",
    };
}

// ============================================================
// PREPARAR OBSERVACIONES
// ============================================================

function prepararObservaciones(
    observaciones:
        Awaited<
            ReturnType<
                typeof obtenerObservacionesAdmin
            >
        >,
) {
    return observaciones.map(
        observacion => ({
            id:
                observacion.id,

            edicion_id:
                observacion.edicion_id,

            formulario_id:
                observacion.formulario_id,

            entidad_tipo:
                observacion.entidad_tipo ??
                "",

            entidad_id:
                observacion.entidad_id,

            campo:
                observacion.campo ??
                "",

            mensaje:
                observacion.mensaje ??
                "",

            estado:
                observacion.estado ??
                "",

            creada_por:
                observacion.creada_por,

            resuelta_por:
                observacion.resuelta_por,

            created_at:
                observacion.created_at,
        }),
    );
}

// ============================================================
// GET
// ============================================================

export const obtenerDetalleEquipoAdmin:
    APIRoute =
    async ({
        cookies,
        url,
        params,
    }) => {
        try {
            // =================================================
            // IDS
            // =================================================

            const equipoID =
                leerIDAdmin(
                    params.id,
                    "id",
                );

            const torneoID =
                leerIDAdmin(
                    url.searchParams.get(
                        "torneoID",
                    ),
                    "torneoID",
                );

            const edicionID =
                leerIDAdmin(
                    url.searchParams.get(
                        "edicionID",
                    ),
                    "edicionID",
                );

            // =================================================
            // CONTEXTO
            // =================================================

            const contexto =
                await obtenerContextoEquipoAdmin({
                    cookies,
                    equipoID,
                    torneoID,
                    edicionID,
                    accion:
                        "ver",
                });

            const {
                usuario,
                torneo,
                edicion,
                equipo,
                formulario,
            } =
                contexto;

            // =================================================
            // DATOS RELACIONADOS
            // =================================================

            const [
                participantes,
                responsable,
                observaciones,
                configuracion,
            ] =
                await Promise.all([
                    obtenerParticipantesAdmin(
                        equipo.id,
                    ),

                    obtenerResponsableAdmin(
                        formulario.usuario_id,
                    ),

                    obtenerObservacionesAdmin(
                        formulario.id,
                    ),

                    obtenerConfiguracionFormularioAdmin(
                        formulario,
                    ),
                ]);

            // =================================================
            // PARTICIPANTES
            // =================================================

            const filasParticipantes =
                participantes.map(
                    participante =>
                        prepararParticipanteSalida(
                            participante,
                            equipo.capitan_id,
                        ),
                );

            const capitan =
                filasParticipantes.find(
                    participante =>
                        participante.es_capitan,
                ) ??
                null;

            // =================================================
            // ESTADO
            // =================================================

            const estadoFormulario =
                normalizarEstadoFormulario(
                    formulario.estado,
                );

            // =================================================
            // CAPACIDADES
            // =================================================

            const capacidadesBase =
                obtenerCapacidades(
                    usuario,
                    torneoID,
                );

            const puedeFinalizarBorrador =
                capacidadesBase.evaluar &&
                esBorradorAdministrativo(
                    formulario,
                );

            const puedeCambiarEvaluacion =
                capacidadesBase.evaluar &&
                estadoFormulario !==
                    "BORRADOR";

            // =================================================
            // RESPUESTA
            // =================================================

            return responder({
                success:
                    true,

                torneo: {
                    id:
                        torneo.id,

                    nombre:
                        torneo.nombre ??
                        "Torneig",

                    deporte:
                        torneo.deporte,

                    logo:
                        torneo.logo,
                },

                edicion: {
                    id:
                        edicion.id,

                    torneo_id:
                        edicion.torneo_id,

                    nombre:
                        edicion.nombre ??
                        "Edició",

                    estado:
                        edicion.estado ??
                        "",

                    sede:
                        edicion.sede,

                    fecha_inicio:
                        edicion.fecha_inicio,

                    fecha_fin:
                        edicion.fecha_fin,
                },

                configuracion,

                equipo: {
                    id:
                        equipo.id,

                    formulario_id:
                        equipo.formulario_id,

                    nombre:
                        equipo.nombre ??
                        "",

                    escudo:
                        equipo.escudo,

                    capitan_id:
                        equipo.capitan_id,

                    validacion_estado:
                        normalizarValidacion(
                            equipo.validacion_estado,
                        ),

                    plaza_estado:
                        normalizarEstadoPlaza(
                            equipo.plaza_estado,
                        ),

                    posicion_lista_espera:
                        equipo.posicion_lista_espera,

                    nota_admin:
                        equipo.nota_admin,

                    created_at:
                        equipo.created_at,

                    updated_at:
                        equipo.updated_at,
                },

                formulario: {
                    id:
                        formulario.id,

                    estado:
                        estadoFormulario,

                    origen:
                        normalizarOrigenFormulario(
                            formulario.origen,
                        ),

                    usuario_id:
                        formulario.usuario_id,

                    email_contacto:
                        formulario.email_contacto ??
                        "",

                    acceso_capitan:
                        formulario.acceso_capitan ===
                        true,

                    iniciado_at:
                        formulario.iniciado_at,

                    enviado_at:
                        formulario.enviado_at,

                    completado_at:
                        formulario.completado_at,

                    created_at:
                        formulario.created_at,

                    updated_at:
                        formulario.updated_at,
                },

                responsable:
                    prepararResponsable({
                        responsable,

                        emailContacto:
                            formulario.email_contacto,
                    }),

                participantes: {
                    total:
                        filasParticipantes.length,

                    jugadores:
                        filasParticipantes.filter(
                            participante =>
                                participante.tipo_participante ===
                                "JUGADOR",
                        ).length,

                    profesores:
                        filasParticipantes.filter(
                            participante =>
                                participante.tipo_participante ===
                                "PROFESOR",
                        ).length,

                    entrenadores:
                        filasParticipantes.filter(
                            participante =>
                                participante.tipo_participante ===
                                "ENTRENADOR",
                        ).length,

                    staff:
                        filasParticipantes.filter(
                            participante =>
                                participante.tipo_participante ===
                                "STAFF",
                        ).length,

                    capitan,

                    filas:
                        filasParticipantes,
                },

                observaciones:
                    prepararObservaciones(
                        observaciones,
                    ),

                capacidades: {
                    ...capacidadesBase,

                    finalizarBorrador:
                        puedeFinalizarBorrador,

                    /*
                     * Permite que la interfaz muestre gestión
                     * del estado aunque ya esté APROBADO o
                     * DENEGADO.
                     */
                    cambiarEvaluacion:
                        puedeCambiarEvaluacion,
                },
            });
        } catch (
            error
        ) {
            return responderErrorAdmin(
                error,
            );
        }
    };

// ============================================================
// CONTEXTO SEGÚN ACCIÓN
// ============================================================

async function obtenerContextoSegunAccion({
    accion,
    cookies,
    equipoID,
    torneoID,
    edicionID,
}: {
    accion:
        AccionPatch;

    cookies:
        Parameters<
            APIRoute
        >[0]["cookies"];

    equipoID:
        string;

    torneoID:
        string;

    edicionID:
        string;
}) {
    // ========================================================
    // EDITAR
    // ========================================================

    if (
        accion ===
        "editar"
    ) {
        return obtenerContextoEquipoAdmin({
            cookies,
            equipoID,
            torneoID,
            edicionID,
            accion:
                "editar",
        });
    }

    // ========================================================
    // PLAZA
    // ========================================================

    if (
        accion ===
        "cambiar-plaza"
    ) {
        return obtenerContextoEquipoAdmin({
            cookies,
            equipoID,
            torneoID,
            edicionID,
            accion:
                "canviar-estat",
        });
    }

    // ========================================================
    // EVALUACIÓN
    // ========================================================

    /*
     * Las siguientes acciones necesitan equips.evaluar:
     *
     * - aprobar
     * - finalizar-borrador
     * - solicitar-cambios
     * - cambiar-evaluacion
     */
    return obtenerContextoEquipoAdmin({
        cookies,
        equipoID,
        torneoID,
        edicionID,
        accion:
            "evaluar",
    });
}

// ============================================================
// PATCH
// ============================================================

export const modificarDetalleEquipoAdmin:
    APIRoute =
    async ({
        cookies,
        url,
        params,
        request,
    }) => {
        try {
            // =================================================
            // ORIGEN HTTP
            // =================================================

            comprobarOrigen(
                request,
                url,
            );

            // =================================================
            // JSON
            // =================================================

            const cuerpo =
                await leerJSON(
                    request,
                );

            if (
                !esRegistro(
                    cuerpo,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    "La petició no és vàlida.",
                );
            }

            // =================================================
            // ACCIÓN
            // =================================================

            const accion =
                leerAccion(
                    cuerpo,
                );

            // =================================================
            // IDS
            // =================================================

            const equipoID =
                leerIDAdmin(
                    params.id,
                    "id",
                );

            const torneoID =
                leerIDAdmin(
                    cuerpo.torneoID,
                    "torneoID",
                );

            const edicionID =
                leerIDAdmin(
                    cuerpo.edicionID,
                    "edicionID",
                );

            // =================================================
            // CONTEXTO + PERMISOS
            // =================================================

            const contexto =
                await obtenerContextoSegunAccion({
                    accion,
                    cookies,
                    equipoID,
                    torneoID,
                    edicionID,
                });

            // =================================================
            // EDITAR
            // =================================================

            if (
                accion ===
                "editar"
            ) {
                const resultado =
                    await editarEquipoAdmin({
                        contexto,
                        cuerpo,
                    });

                return responder({
                    success:
                        true,

                    ...resultado,
                });
            }

            // =================================================
            // APROBAR
            // =================================================

            if (
                accion ===
                "aprobar"
            ) {
                const resultado =
                    await aprobarEquipoAdmin({
                        contexto,
                        cuerpo,
                    });

                return responder({
                    success:
                        true,

                    ...resultado,
                });
            }

            // =================================================
            // FINALIZAR BORRADOR ADMIN
            // =================================================

            if (
                accion ===
                "finalizar-borrador"
            ) {
                const resultado =
                    await finalizarBorradorEquipoAdmin({
                        contexto,
                        cuerpo,
                    });

                return responder({
                    success:
                        true,

                    ...resultado,
                });
            }

            // =================================================
            // CAMBIAR ESTADO DE EVALUACIÓN
            // =================================================

            if (
                accion ===
                "cambiar-evaluacion"
            ) {
                const resultado =
                    await cambiarEstadoEvaluacionEquipoAdmin({
                        contexto,
                        cuerpo,
                    });

                return responder({
                    success:
                        true,

                    ...resultado,
                });
            }

            // =================================================
            // SOLICITAR CAMBIOS
            // =================================================

            if (
                accion ===
                "solicitar-cambios"
            ) {
                const resultado =
                    await solicitarCambiosEquipoAdmin({
                        contexto,
                        cuerpo,
                    });

                return responder({
                    success:
                        true,

                    ...resultado,
                });
            }

            // =================================================
            // CAMBIAR PLAZA
            // =================================================

            const resultado =
                await cambiarPlazaEquipoAdmin({
                    contexto,
                    cuerpo,
                });

            return responder({
                success:
                    true,

                ...resultado,
            });
        } catch (
            error
        ) {
            return responderErrorAdmin(
                error,
            );
        }
    };