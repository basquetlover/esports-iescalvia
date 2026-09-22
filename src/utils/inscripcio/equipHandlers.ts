import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";

import {
    CAMPOS_FORMULARIO,
    ErrorAPI,
    UUID,
    cargarFormularioCompleto,
    comprobarDuplicadosEdicion,
    comprobarOrigen,
    configuracionFormulario,
    edicionActiva,
    estadoFormulario,
    estadoPeriodo,
    exigirUUID,
    exigirUsuario,
    guardarParticipantes,
    leerDatos,
    leerJSON,
    normalizarEmail,
    obtenerAccesoPorID,
    obtenerConfiguracionEdicion,
    obtenerConfiguracionPlataforma,
    obtenerEdicion,
    obtenerEdicionesDisponibles,
    obtenerEmailCreador,
    obtenerEquipoFormulario,
    obtenerFormularioComoCapitan,
    obtenerFormularioPropietario,
    obtenerTorneo,
    obtenerUsuario,
    permisosFormulario,
    puedeIgnorarPeriodo,
    responder,
    responderError,
    validarEmails,
    validarEmailsRepetidos,
    validarEnvio,
    validarEstructuraParticipantes,
    type EstadoFormulario,
    type FormularioDB,
} from "./equipBase";

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({
    url,
    cookies,
}) => {
    try {
        const usuario =
            await obtenerUsuario(
                cookies,
            );

        const configuracionPlataforma =
            await obtenerConfiguracionPlataforma();

        const accesoAdmin =
            puedeIgnorarPeriodo(
                usuario,
                configuracionPlataforma,
            );

        const sesion = {
            iniciada:
                Boolean(
                    usuario,
                ),

            usuario:
                usuario
                    ? {
                          id:
                              usuario.id,

                          nombre:
                              usuario.nombre,

                          apellido1:
                              usuario.apellido1,

                          apellido2:
                              usuario.apellido2,

                          email:
                              usuario.email,
                      }
                    : null,
        };

        const alternativas =
            await obtenerEdicionesDisponibles(
                usuario,
                configuracionPlataforma,
            );

        const parametro =
            url.searchParams.get(
                "edicionID",
            );

        const permisosVacios = {
            propietario:
                false,

            capitan:
                false,

            puede_ver:
                false,

            puede_editar:
                false,

            puede_cambiar_acceso_capitan:
                false,
        };

        // ====================================================
        // SIN EDICIÓN
        // ====================================================

        if (
            !parametro
        ) {
            return responder({
                success:
                    true,

                disponible:
                    false,

                motivo:
                    "SIN_EDICION",

                mensaje:
                    "Selecciona una edició per començar la inscripció.",

                sesion,

                torneo:
                    null,

                edicion:
                    null,

                configuracion:
                    null,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas,

                accesoAdmin,
            });
        }

        // ====================================================
        // ID INVÁLIDO
        // ====================================================

        if (
            !UUID.test(
                parametro,
            )
        ) {
            return responder({
                success:
                    true,

                disponible:
                    false,

                motivo:
                    "NO_TROBADA",

                mensaje:
                    "L'edició seleccionada no existeix o ja no està disponible.",

                sesion,

                torneo:
                    null,

                edicion:
                    null,

                configuracion:
                    null,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas,

                accesoAdmin,
            });
        }

        // ====================================================
        // EDICIÓN
        // ====================================================

        const edicion =
            await obtenerEdicion(
                parametro,
            );

        if (
            !edicion
        ) {
            return responder({
                success:
                    true,

                disponible:
                    false,

                motivo:
                    "NO_TROBADA",

                mensaje:
                    "L'edició seleccionada no existeix o ja no està disponible.",

                sesion,

                torneo:
                    null,

                edicion:
                    null,

                configuracion:
                    null,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas,

                accesoAdmin,
            });
        }

        // ====================================================
        // TORNEO + CONFIGURACIÓN
        // ====================================================

        const [
            configuracionActual,
            torneo,
        ] =
            await Promise.all([
                obtenerConfiguracionEdicion(
                    edicion.id,
                ),

                obtenerTorneo(
                    edicion.torneo_id,
                ),
            ]);

        if (
            !configuracionActual
        ) {
            return responder({
                success:
                    true,

                disponible:
                    false,

                motivo:
                    "SIN_CONFIGURACION",

                mensaje:
                    "Aquesta edició encara no té configurada la inscripció d'equips.",

                sesion,
                torneo,
                edicion,

                configuracion:
                    null,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas.filter(
                        alternativa =>
                            alternativa.id !==
                            edicion.id,
                    ),

                accesoAdmin,
            });
        }

        // ====================================================
        // EDICIÓN INACTIVA
        // ====================================================

        if (
            !edicionActiva(
                edicion.estado,
            )
        ) {
            return responder({
                success:
                    true,

                disponible:
                    false,

                motivo:
                    "TANCADA",

                mensaje:
                    "Aquesta edició no està activa.",

                sesion,
                torneo,
                edicion,

                configuracion:
                    configuracionActual,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas.filter(
                        alternativa =>
                            alternativa.id !==
                            edicion.id,
                    ),

                accesoAdmin,
            });
        }

        // ====================================================
        // PERÍODO
        // ====================================================

        const periodo =
            estadoPeriodo(
                configuracionActual,
            );

        const puedeSaltarsePeriodo =
            accesoAdmin &&
            (
                periodo ===
                    "PROXIMAMENTE" ||
                periodo ===
                    "TANCADA"
            );

        if (
            periodo !==
                "ABIERTA" &&
            !puedeSaltarsePeriodo
        ) {
            return responder({
                success:
                    true,

                disponible:
                    false,

                motivo:
                    periodo,

                mensaje:
                    periodo ===
                        "PROXIMAMENTE"
                        ? "Les inscripcions d'aquesta edició encara no han començat."
                        : periodo ===
                              "TANCADA"
                          ? "Les inscripcions d'aquesta edició ja estan tancades."
                          : "Aquesta edició no té un període d'inscripció vàlid.",

                sesion,
                torneo,
                edicion,

                configuracion:
                    configuracionActual,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas.filter(
                        alternativa =>
                            alternativa.id !==
                            edicion.id,
                    ),

                accesoAdmin,
            });
        }

        // ====================================================
        // SIN SESIÓN
        // ====================================================

        if (
            !usuario
        ) {
            return responder({
                success:
                    true,

                disponible:
                    true,

                motivo:
                    null,

                mensaje:
                    null,

                sesion,
                torneo,
                edicion,

                configuracion:
                    configuracionActual,

                formulario:
                    null,

                permisos:
                    permisosVacios,

                edicionesDisponibles:
                    alternativas,

                accesoAdmin:
                    false,
            });
        }

        // ====================================================
        // FORMULARIO DEL PROPIETARIO
        // ====================================================

        let formulario =
            await obtenerFormularioPropietario(
                edicion.id,
                usuario.id,
            );

        const propietario =
            Boolean(
                formulario,
            );

        let capitan =
            false;

        // ====================================================
        // FORMULARIO COMO CAPITÁN
        // ====================================================

        if (
            !formulario
        ) {
            formulario =
                await obtenerFormularioComoCapitan(
                    edicion.id,
                    usuario,
                );

            capitan =
                Boolean(
                    formulario,
                );
        }

        // ====================================================
        // FORMULARIO NUEVO
        // ====================================================

        if (
            !formulario
        ) {
            return responder({
                success:
                    true,

                disponible:
                    true,

                motivo:
                    null,

                mensaje:
                    null,

                sesion,
                torneo,
                edicion,

                configuracion:
                    configuracionActual,

                formulario:
                    null,

                permisos: {
                    propietario:
                        false,

                    capitan:
                        false,

                    puede_ver:
                        true,

                    puede_editar:
                        true,

                    puede_cambiar_acceso_capitan:
                        true,
                },

                edicionesDisponibles:
                    alternativas,

                accesoAdmin,
            });
        }

        // ====================================================
        // FORMULARIO EXISTENTE
        // ====================================================

        const configuracion =
            configuracionFormulario(
                formulario,
                configuracionActual,
            );

        const datosFormulario =
            await cargarFormularioCompleto(
                formulario,
            );

        return responder({
            success:
                true,

            disponible:
                true,

            motivo:
                null,

            mensaje:
                null,

            sesion,
            torneo,
            edicion,
            configuracion,

            formulario:
                datosFormulario,

            permisos:
                permisosFormulario(
                    formulario,
                    propietario,
                    capitan,
                ),

            edicionesDisponibles:
                alternativas,

            accesoAdmin,
        });
    } catch (
        error
    ) {
        return responderError(
            error,
        );
    }
};

// ============================================================
// POST
// CREAR FORMULARIO
// ============================================================

export const POST: APIRoute = async ({
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

        const configuracionPlataforma =
            await obtenerConfiguracionPlataforma();

        const accesoAdmin =
            puedeIgnorarPeriodo(
                usuario,
                configuracionPlataforma,
            );

        const emailContacto =
            obtenerEmailCreador(
                usuario,
                configuracionPlataforma,
            );

        const cuerpo =
            await leerJSON(
                request,
            );

        if (
            cuerpo.accion !==
            "crear"
        ) {
            throw new ErrorAPI(
                400,
                "L'acció sol·licitada no és vàlida.",
            );
        }

        const edicionID =
            exigirUUID(
                cuerpo.edicionID,
                "de l'edició",
            );

        const edicion =
            await obtenerEdicion(
                edicionID,
            );

        if (
            !edicion ||
            !edicionActiva(
                edicion.estado,
            )
        ) {
            throw new ErrorAPI(
                403,
                "Aquesta edició no està disponible per a inscripcions.",
            );
        }

        const configuracion =
            await obtenerConfiguracionEdicion(
                edicionID,
            );

        if (
            !configuracion
        ) {
            throw new ErrorAPI(
                403,
                "Aquesta edició no té configurada la inscripció d'equips.",
            );
        }

        const periodo =
            estadoPeriodo(
                configuracion,
            );

        const puedeSaltarsePeriodo =
            accesoAdmin &&
            (
                periodo ===
                    "PROXIMAMENTE" ||
                periodo ===
                    "TANCADA"
            );

        if (
            periodo !==
                "ABIERTA" &&
            !puedeSaltarsePeriodo
        ) {
            throw new ErrorAPI(
                403,
                "El període d'inscripció no està obert.",
            );
        }

        const existente =
            await obtenerFormularioPropietario(
                edicionID,
                usuario.id,
            );

        if (
            existente
        ) {
            throw new ErrorAPI(
                409,
                "Ja tens una inscripció creada en aquesta edició.",
            );
        }

        const datos =
            leerDatos(
                cuerpo.datos,
            );

        validarEmails(
            datos.participantes,
            configuracionPlataforma,
        );

        validarEmailsRepetidos(
            datos.participantes,
        );

        validarEstructuraParticipantes(
            datos.participantes,
            configuracion,
        );

        await comprobarDuplicadosEdicion(
            edicionID,
            datos.participantes,
            null,
        );

        const ahora =
            new Date()
                .toISOString();

        const formularioID =
            randomUUID();

        const equipoID =
            randomUUID();

        // ====================================================
        // FORMULARIO
        // ====================================================

        const {
            error:
                errorFormulario,
        } =
            await supabaseAdmin
                .from(
                    "formularios",
                )
                .insert({
                    id:
                        formularioID,

                    edicion_id:
                        edicionID,

                    tipo:
                        "EQUIPO",

                    estado:
                        "BORRADOR",

                    usuario_id:
                        usuario.id,

                    email_contacto:
                        emailContacto,

                    acceso_capitan:
                        false,

                    configuracion_snapshot:
                        configuracion,

                    iniciado_at:
                        ahora,

                    enviado_at:
                        null,

                    completado_at:
                        null,

                    created_at:
                        ahora,

                    updated_at:
                        ahora,
                });

        if (
            errorFormulario
        ) {
            throw errorFormulario;
        }

        // ====================================================
        // EQUIPO
        // ====================================================

        const {
            error:
                errorEquipo,
        } =
            await supabaseAdmin
                .from(
                    "equipos",
                )
                .insert({
                    id:
                        equipoID,

                    formulario_id:
                        formularioID,

                    nombre:
                        datos.equipo.nombre ||
                        null,

                    escudo:
                        datos.equipo.escudo,

                    capitan_id:
                        null,

                    created_at:
                        ahora,

                    updated_at:
                        ahora,
                });

        if (
            errorEquipo
        ) {
            throw errorEquipo;
        }

        // ====================================================
        // PARTICIPANTES
        // ====================================================

        if (
            datos.participantes.length >
            0
        ) {
            await guardarParticipantes(
                equipoID,
                datos.participantes,
            );
        }

        // ====================================================
        // RECARGAR
        // ====================================================

        const {
            data:
                formularioGuardado,

            error:
                errorRecarga,
        } =
            await supabaseAdmin
                .from(
                    "formularios",
                )
                .select(
                    CAMPOS_FORMULARIO,
                )
                .eq(
                    "id",
                    formularioID,
                )
                .single();

        if (
            errorRecarga
        ) {
            throw errorRecarga;
        }

        return responder({
            success:
                true,

            mensaje:
                "Inscripció guardada correctament.",

            formulario:
                await cargarFormularioCompleto(
                    formularioGuardado as FormularioDB,
                ),
        });
    } catch (
        error
    ) {
        return responderError(
            error,
        );
    }
};

// ============================================================
// PATCH
// GUARDAR / ENVIAR
// ============================================================

export const PATCH: APIRoute = async ({
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

        const configuracionPlataforma =
            await obtenerConfiguracionPlataforma();

        const accesoAdmin =
            puedeIgnorarPeriodo(
                usuario,
                configuracionPlataforma,
            );

        const cuerpo =
            await leerJSON(
                request,
            );

        if (
            cuerpo.accion !==
                "guardar" &&
            cuerpo.accion !==
                "enviar"
        ) {
            throw new ErrorAPI(
                400,
                "L'acció sol·licitada no és vàlida.",
            );
        }

        const enviar =
            cuerpo.accion ===
            "enviar";

        const edicionID =
            exigirUUID(
                cuerpo.edicionID,
                "de l'edició",
            );

        const formularioID =
            exigirUUID(
                cuerpo.formularioID,
                "del formulari",
            );

        // ====================================================
        // EDICIÓN
        // ====================================================

        const edicion =
            await obtenerEdicion(
                edicionID,
            );

        if (
            !edicion ||
            !edicionActiva(
                edicion.estado,
            )
        ) {
            throw new ErrorAPI(
                403,
                "Aquesta edició no està disponible per a inscripcions.",
            );
        }

        // ====================================================
        // CONFIGURACIÓN
        // ====================================================

        const configuracionActual =
            await obtenerConfiguracionEdicion(
                edicionID,
            );

        if (
            !configuracionActual
        ) {
            throw new ErrorAPI(
                403,
                "Aquesta edició no té configurada la inscripció d'equips.",
            );
        }

        // ====================================================
        // PERÍODO
        // ====================================================

        const periodo =
            estadoPeriodo(
                configuracionActual,
            );

        const puedeSaltarsePeriodo =
            accesoAdmin &&
            (
                periodo ===
                    "PROXIMAMENTE" ||
                periodo ===
                    "TANCADA"
            );

        if (
            periodo !==
                "ABIERTA" &&
            !puedeSaltarsePeriodo
        ) {
            throw new ErrorAPI(
                403,
                "El període d'inscripció no està obert.",
            );
        }

        // ====================================================
        // ACCESO
        // ====================================================

        const acceso =
            await obtenerAccesoPorID(
                formularioID,
                edicionID,
                usuario,
            );

        if (
            !acceso.puede_editar
        ) {
            throw new ErrorAPI(
                409,
                "La inscripció està en revisió i no es pot modificar.",
            );
        }

        const configuracion =
            configuracionFormulario(
                acceso.formulario,
                configuracionActual,
            );

        const datos =
            leerDatos(
                cuerpo.datos,
            );

        // ====================================================
        // VALIDACIONES
        // ====================================================

        validarEmails(
            datos.participantes,
            configuracionPlataforma,
        );

        validarEmailsRepetidos(
            datos.participantes,
        );

        validarEstructuraParticipantes(
            datos.participantes,
            configuracion,
        );

        if (
            enviar
        ) {
            validarEnvio(
                datos,
                configuracion,
            );
        }

        let equipo =
            acceso.equipo;

        const ahora =
            new Date()
                .toISOString();

        // ====================================================
        // CREAR EQUIPO SI FALTA
        // ====================================================

        if (
            !equipo
        ) {
            const equipoID =
                randomUUID();

            const {
                error,
            } =
                await supabaseAdmin
                    .from(
                        "equipos",
                    )
                    .insert({
                        id:
                            equipoID,

                        formulario_id:
                            formularioID,

                        nombre:
                            datos.equipo.nombre ||
                            null,

                        escudo:
                            datos.equipo.escudo,

                        capitan_id:
                            null,

                        created_at:
                            ahora,

                        updated_at:
                            ahora,
                    });

            if (
                error
            ) {
                throw error;
            }

            equipo =
                await obtenerEquipoFormulario(
                    formularioID,
                );
        }

        if (
            !equipo
        ) {
            throw new ErrorAPI(
                500,
                "No s'ha pogut preparar l'equip.",
            );
        }

        if (
            datos.equipo.id &&
            datos.equipo.id !==
                equipo.id
        ) {
            throw new ErrorAPI(
                400,
                "L'equip indicat no correspon a aquest formulari.",
            );
        }

        // ====================================================
        // DUPLICADOS EN LA MISMA EDICIÓN
        // ====================================================

        await comprobarDuplicadosEdicion(
            edicionID,
            datos.participantes,
            equipo.id,
        );

        // ====================================================
        // CAPITÁN
        // ====================================================

        let capitanID =
            acceso.propietario
                ? datos.equipo.capitan_id
                : equipo.capitan_id;

        if (
            capitanID &&
            !datos.participantes.some(
                participante =>
                    participante.id ===
                        capitanID &&
                    participante.tipo_participante ===
                        "JUGADOR",
            )
        ) {
            if (
                enviar
            ) {
                throw new ErrorAPI(
                    400,
                    "El capità seleccionat ja no forma part dels jugadors de l'equip.",
                );
            }

            capitanID =
                null;
        }

        // ====================================================
        // PROTEGER EMAIL DEL CAPITÁN
        // ====================================================

        if (
            acceso.capitan &&
            !acceso.propietario &&
            equipo.capitan_id
        ) {
            const participanteCapitan =
                datos.participantes.find(
                    participante =>
                        participante.id ===
                        equipo.capitan_id,
                );

            if (
                !participanteCapitan ||
                normalizarEmail(
                    participanteCapitan.email,
                ) !==
                    normalizarEmail(
                        usuario.email ??
                        "",
                    )
            ) {
                throw new ErrorAPI(
                    403,
                    "El capità no pot modificar el correu que li dona accés al formulari.",
                );
            }
        }

        // ====================================================
        // GUARDAR PARTICIPANTES
        // ====================================================

        await guardarParticipantes(
            equipo.id,
            datos.participantes,
        );

        // ====================================================
        // COMPROBAR CAPITÁN
        // ====================================================

        if (
            capitanID
        ) {
            const {
                data:
                    capitan,

                error:
                    errorCapitan,
            } =
                await supabaseAdmin
                    .from(
                        "participantes_equipo",
                    )
                    .select(
                        "id,tipo_participante,activo,email",
                    )
                    .eq(
                        "id",
                        capitanID,
                    )
                    .eq(
                        "equipo_id",
                        equipo.id,
                    )
                    .eq(
                        "activo",
                        true,
                    )
                    .maybeSingle();

            if (
                errorCapitan
            ) {
                throw errorCapitan;
            }

            if (
                !capitan ||
                capitan.tipo_participante !==
                    "JUGADOR"
            ) {
                if (
                    enviar
                ) {
                    throw new ErrorAPI(
                        400,
                        "El capità seleccionat no és vàlid.",
                    );
                }

                capitanID =
                    null;
            }
        }

        // ====================================================
        // ACCESO CAPITÁN
        // ====================================================

        let accesoCapitan =
            acceso.propietario
                ? datos.acceso_capitan
                : acceso.formulario.acceso_capitan ===
                  true;

        if (
            !capitanID
        ) {
            accesoCapitan =
                false;
        }

        // ====================================================
        // ACTUALIZAR EQUIPO
        // ====================================================

        const {
            error:
                errorEquipo,
        } =
            await supabaseAdmin
                .from(
                    "equipos",
                )
                .update({
                    nombre:
                        datos.equipo.nombre ||
                        null,

                    escudo:
                        datos.equipo.escudo,

                    capitan_id:
                        capitanID,

                    updated_at:
                        ahora,
                })
                .eq(
                    "id",
                    equipo.id,
                )
                .eq(
                    "formulario_id",
                    formularioID,
                );

        if (
            errorEquipo
        ) {
            throw errorEquipo;
        }

        // ====================================================
        // ESTADO DEL FORMULARIO
        // ====================================================

        const estadoAnterior =
            estadoFormulario(
                acceso.formulario.estado,
            );

        const nuevoEstado:
            EstadoFormulario =
            enviar
                ? "EN_REVISION"
                : estadoAnterior ===
                        "APROBADO" ||
                    estadoAnterior ===
                        "DENEGADO"
                  ? "BORRADOR"
                  : estadoAnterior;

        // ====================================================
        // ACTUALIZAR FORMULARIO
        // ====================================================

        /*
         * email_contacto NO se actualiza.
         *
         * Siempre conserva el correo de la persona que
         * creó originalmente el formulario.
         */

        const {
            data:
                formularioGuardado,

            error:
                errorFormulario,
        } =
            await supabaseAdmin
                .from(
                    "formularios",
                )
                .update({
                    acceso_capitan:
                        accesoCapitan,

                    estado:
                        nuevoEstado,

                    enviado_at:
                        enviar
                            ? ahora
                            : nuevoEstado ===
                                  "BORRADOR"
                              ? null
                              : acceso.formulario.enviado_at,

                    updated_at:
                        ahora,
                })
                .eq(
                    "id",
                    formularioID,
                )
                .eq(
                    "edicion_id",
                    edicionID,
                )
                .select(
                    CAMPOS_FORMULARIO,
                )
                .maybeSingle();

        if (
            errorFormulario
        ) {
            throw errorFormulario;
        }

        if (
            !formularioGuardado
        ) {
            throw new ErrorAPI(
                409,
                "La inscripció ha canviat mentre la modificaves. Torna a carregar-la.",
            );
        }

        return responder({
            success:
                true,

            mensaje:
                enviar
                    ? "La inscripció s'ha enviat a revisió."
                    : "La inscripció s'ha guardat correctament.",

            formulario:
                await cargarFormularioCompleto(
                    formularioGuardado as FormularioDB,
                ),
        });
    } catch (
        error
    ) {
        return responderError(
            error,
        );
    }
};