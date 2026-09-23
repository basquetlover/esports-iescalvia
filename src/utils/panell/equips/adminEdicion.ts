import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";

import {
    comprobarDuplicadosEdicion,
    guardarParticipantes,
    validarEmails,
    validarEmailsRepetidos,
    validarEnvio,
    validarEstructuraParticipantes,
    type DatosEntrada,
} from "@utils/inscripcio/equipBase";

import {
    guardarEscudoEquipo,
} from "@utils/inscripcio/equipStorage";

import {
    ErrorAPI,
    MAX_APELLIDO,
    MAX_EMAIL,
    MAX_GRUPO,
    MAX_NOMBRE_EQUIPO,
    MAX_NOMBRE_PERSONA,
    MAX_NOTA_ADMIN,
    MAX_PARTICIPANTES,
    MAX_CURSO,
    TIPOS_PARTICIPANTE,
    esRegistro,
    exigirMismaVersion,
    leerEscudoAdmin,
    leerIDAdmin,
    leerTextoAdmin,
    normalizarEmail,
    normalizarEstadoFormulario,
    obtenerConfiguracionFormularioAdmin,
    obtenerConfiguracionPlataformaAdmin,
    obtenerParticipantesAdmin,
    resolverResponsableAdmin,
    validarEmailResponsable,
    type ContextoEquipoAdmin,
    type DatosEdicionAdmin,
    type Genero,
    type ParticipanteEntradaAdmin,
    type Registro,
    type TipoParticipante,
} from "@utils/panell/equips/adminComun";

// ============================================================
// TIPOS
// ============================================================

export type ResultadoEdicionEquipoAdmin = {
    mensaje: string;

    formulario: {
        id: string;
        estado: string;
        usuario_id: string | null;
        email_contacto: string | null;
        acceso_capitan: boolean;
        updated_at: string;
    };

    equipo: {
        id: string;
        nombre: string;
        escudo: string | null;
        capitan_id: string | null;
        nota_admin: string | null;
        plaza_estado: string | null;
        validacion_estado: string | null;
        updated_at: string;
    };
};

// ============================================================
// PARTICIPANTE · LECTURA
// ============================================================

function leerParticipanteAdmin(
    valor: unknown,
    indice: number,
): ParticipanteEntradaAdmin {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            `El participant ${indice + 1} no és vàlid.`,
        );
    }

    // ========================================================
    // ID
    // ========================================================

    let id:
        string | null =
        null;

    if (
        valor.id !==
            undefined &&
        valor.id !==
            null &&
        valor.id !==
            ""
    ) {
        id =
            leerIDAdmin(
                valor.id,
                `id del participant ${indice + 1}`,
            );
    }

    // ========================================================
    // TIPO
    // ========================================================

    const tipoRaw =
        typeof valor.tipo_participante ===
            "string"
            ? valor.tipo_participante
                  .trim()
                  .toUpperCase()
            : "";

    if (
        !TIPOS_PARTICIPANTE.includes(
            tipoRaw as TipoParticipante,
        )
    ) {
        throw new ErrorAPI(
            400,
            `El tipus del participant ${indice + 1} no és vàlid.`,
        );
    }

    const tipo =
        tipoRaw as TipoParticipante;

    // ========================================================
    // EMAIL
    // ========================================================

    const email =
        normalizarEmail(
            leerTextoAdmin(
                valor.email,
                `correu del participant ${indice + 1}`,
                MAX_EMAIL,
            ),
        );

    // ========================================================
    // GÉNERO
    // ========================================================

    let genero:
        Genero | null =
        null;

    if (
        valor.genero !==
            undefined &&
        valor.genero !==
            null &&
        valor.genero !==
            ""
    ) {
        if (
            valor.genero !==
                "masculino" &&
            valor.genero !==
                "femenino"
        ) {
            throw new ErrorAPI(
                400,
                `El gènere del participant ${indice + 1} no és vàlid.`,
            );
        }

        genero =
            valor.genero;
    }

    // ========================================================
    // ORDEN
    // ========================================================

    const orden =
        typeof valor.orden ===
                "number" &&
            Number.isSafeInteger(
                valor.orden,
            ) &&
            valor.orden >
                0
            ? valor.orden
            : indice + 1;

    return {
        id,

        tipo_participante:
            tipo,

        nombre:
            leerTextoAdmin(
                valor.nombre,
                `nom del participant ${indice + 1}`,
                MAX_NOMBRE_PERSONA,
            ),

        apellido1:
            leerTextoAdmin(
                valor.apellido1,
                `primer llinatge del participant ${indice + 1}`,
                MAX_APELLIDO,
            ),

        apellido2:
            leerTextoAdmin(
                valor.apellido2,
                `segon llinatge del participant ${indice + 1}`,
                MAX_APELLIDO,
            ),

        email,

        curso:
            leerTextoAdmin(
                valor.curso,
                `curs del participant ${indice + 1}`,
                MAX_CURSO,
            ),

        grupo:
            leerTextoAdmin(
                valor.grupo,
                `grup del participant ${indice + 1}`,
                MAX_GRUPO,
            ),

        genero,

        orden,
    };
}

// ============================================================
// LECTURA DE DATOS
// ============================================================

export function leerDatosEdicionAdmin(
    cuerpo: Registro,
): DatosEdicionAdmin {
    // ========================================================
    // RESPONSABLE
    // ========================================================

    if (
        !esRegistro(
            cuerpo.responsable,
        )
    ) {
        throw new ErrorAPI(
            400,
            "Les dades del responsable no són vàlides.",
        );
    }

    const emailResponsable =
        normalizarEmail(
            leerTextoAdmin(
                cuerpo.responsable.email,
                "correu del responsable",
                MAX_EMAIL,
            ),
        );

    if (
        typeof cuerpo.responsable.vincular_usuario !==
        "boolean"
    ) {
        throw new ErrorAPI(
            400,
            "La vinculació del responsable no és vàlida.",
        );
    }

    if (
        cuerpo.responsable.vincular_usuario &&
        !emailResponsable
    ) {
        throw new ErrorAPI(
            400,
            "Indica el correu de l'usuari que vols vincular.",
        );
    }

    // ========================================================
    // ACCESO CAPITÁN
    // ========================================================

    if (
        typeof cuerpo.acceso_capitan !==
        "boolean"
    ) {
        throw new ErrorAPI(
            400,
            "El permís d'accés del capità no és vàlid.",
        );
    }

    // ========================================================
    // EQUIPO
    // ========================================================

    if (
        !esRegistro(
            cuerpo.equipo,
        )
    ) {
        throw new ErrorAPI(
            400,
            "Les dades de l'equip no són vàlides.",
        );
    }

    const nombreEquipo =
        leerTextoAdmin(
            cuerpo.equipo.nombre,
            "nom de l'equip",
            MAX_NOMBRE_EQUIPO,
        );

    const escudo =
        leerEscudoAdmin(
            cuerpo.equipo.escudo,
        );

    const capitanEmail =
        normalizarEmail(
            leerTextoAdmin(
                cuerpo.equipo.capitan_email,
                "correu del capità",
                MAX_EMAIL,
            ),
        );

    const notaAdminTexto =
        leerTextoAdmin(
            cuerpo.equipo.nota_admin,
            "nota administrativa",
            MAX_NOTA_ADMIN,
        );

    // ========================================================
    // PARTICIPANTES
    // ========================================================

    if (
        !Array.isArray(
            cuerpo.participantes,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La llista de participants no és vàlida.",
        );
    }

    if (
        cuerpo.participantes.length >
        MAX_PARTICIPANTES
    ) {
        throw new ErrorAPI(
            400,
            `No es poden guardar més de ${MAX_PARTICIPANTES} participants.`,
        );
    }

    const participantes =
        cuerpo.participantes.map(
            leerParticipanteAdmin,
        );

    // ========================================================
    // IDs DUPLICADOS
    // ========================================================

    const ids =
        new Set<string>();

    for (
        const participante
        of participantes
    ) {
        if (
            !participante.id
        ) {
            continue;
        }

        if (
            ids.has(
                participante.id,
            )
        ) {
            throw new ErrorAPI(
                400,
                "Hi ha participants repetits al formulari.",
            );
        }

        ids.add(
            participante.id,
        );
    }

    // ========================================================
    // CAPITÁN
    // ========================================================

    if (
        capitanEmail
    ) {
        const coincidencias =
            participantes.filter(
                participante =>
                    participante.tipo_participante ===
                        "JUGADOR" &&
                    normalizarEmail(
                        participante.email,
                    ) ===
                        capitanEmail,
            );

        if (
            coincidencias.length !==
            1
        ) {
            throw new ErrorAPI(
                400,
                "El capità ha de correspondre exactament a un jugador de l'equip.",
            );
        }
    }

    if (
        cuerpo.acceso_capitan &&
        !capitanEmail
    ) {
        throw new ErrorAPI(
            400,
            "Per donar accés al capità primer l'has de seleccionar.",
        );
    }

    return {
        responsable: {
            email:
                emailResponsable,

            vincular_usuario:
                cuerpo.responsable
                    .vincular_usuario,
        },

        acceso_capitan:
            cuerpo.acceso_capitan,

        equipo: {
            nombre:
                nombreEquipo,

            escudo,

            capitan_email:
                capitanEmail,

            nota_admin:
                notaAdminTexto ||
                null,
        },

        participantes,
    };
}

// ============================================================
// DATOS PARA VALIDAR ENVÍO
// ============================================================

function prepararDatosParaValidacion(
    datos: DatosEdicionAdmin,
    equipoID: string,
): DatosEntrada {
    /*
     * validarEnvio() trabaja con capitan_id.
     *
     * En administración seleccionamos el capitán por email para
     * poder seleccionar también un participante que todavía no
     * existe en BD.
     *
     * Asignamos UUID temporales únicamente para ejecutar la
     * validación. No se escriben en la base de datos.
     */

    const participantes =
        datos.participantes.map(
            participante => ({
                ...participante,

                id:
                    participante.id ??
                    randomUUID(),
            }),
        );

    const capitan =
        datos.equipo
            .capitan_email
            ? participantes.find(
                  participante =>
                      participante.tipo_participante ===
                          "JUGADOR" &&
                      normalizarEmail(
                          participante.email,
                      ) ===
                          datos.equipo
                              .capitan_email,
              ) ??
              null
            : null;

    return {
        acceso_capitan:
            datos.acceso_capitan,

        equipo: {
            id:
                equipoID,

            nombre:
                datos.equipo.nombre,

            escudo:
                datos.equipo.escudo,

            capitan_id:
                capitan?.id ??
                null,
        },

        participantes,
    };
}

// ============================================================
// VALIDAR IDs DE PARTICIPANTES
// ============================================================

async function validarParticipantesPertenecenAlEquipo(
    equipoID: string,
    participantes: ParticipanteEntradaAdmin[],
) {
    const actuales =
        await obtenerParticipantesAdmin(
            equipoID,
        );

    const idsActuales =
        new Set(
            actuales.map(
                participante =>
                    participante.id,
            ),
        );

    for (
        const participante
        of participantes
    ) {
        if (
            participante.id &&
            !idsActuales.has(
                participante.id,
            )
        ) {
            throw new ErrorAPI(
                400,
                "Hi ha un participant que no pertany a aquest equip.",
            );
        }
    }
}

// ============================================================
// VALIDACIONES
// ============================================================

async function validarEdicionEquipo({
    contexto,
    datos,
}: {
    contexto:
        ContextoEquipoAdmin;

    datos:
        DatosEdicionAdmin;
}) {
    const [
        configuracion,
        configuracionPlataforma,
    ] =
        await Promise.all([
            obtenerConfiguracionFormularioAdmin(
                contexto.formulario,
            ),

            obtenerConfiguracionPlataformaAdmin(),
        ]);

    // ========================================================
    // RESPONSABLE
    // ========================================================

    validarEmailResponsable(
        datos.responsable.email,
        configuracionPlataforma,
    );

    // ========================================================
    // PARTICIPANTES
    // ========================================================

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

    await validarParticipantesPertenecenAlEquipo(
        contexto.equipo.id,
        datos.participantes,
    );

    // ========================================================
    // DUPLICADOS EN OTROS EQUIPOS
    // ========================================================

    await comprobarDuplicadosEdicion(
        contexto.edicion.id,
        datos.participantes,
        contexto.equipo.id,
    );

    // ========================================================
    // VALIDACIÓN COMPLETA
    // ========================================================

    const estado =
        normalizarEstadoFormulario(
            contexto.formulario.estado,
        );

    /*
     * Un BORRADOR puede estar incompleto.
     *
     * En cualquier estado posterior el equipo ya ha sido
     * considerado una inscripción y debe seguir cumpliendo
     * las reglas completas de la edición.
     */
    if (
        estado !==
        "BORRADOR"
    ) {
        validarEnvio(
            prepararDatosParaValidacion(
                datos,
                contexto.equipo.id,
            ),
            configuracion,
        );
    }

    return {
        configuracion,
        configuracionPlataforma,
        estado,
    };
}

// ============================================================
// BUSCAR CAPITÁN DESPUÉS DE GUARDAR
// ============================================================

async function obtenerCapitanGuardado(
    equipoID: string,
    capitanEmail: string,
) {
    if (
        !capitanEmail
    ) {
        return null;
    }

    const participantes =
        await obtenerParticipantesAdmin(
            equipoID,
        );

    const coincidencias =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                    "JUGADOR" &&
                normalizarEmail(
                    participante.email ??
                    "",
                ) ===
                    capitanEmail,
        );

    if (
        coincidencias.length !==
        1
    ) {
        throw new ErrorAPI(
            409,
            "No s'ha pogut identificar correctament el capità després de guardar els participants.",
        );
    }

    return coincidencias[0];
}

// ============================================================
// SINCRONIZAR VALIDACIÓN DE UN EQUIPO APROBADO
// ============================================================

async function sincronizarValidacionAprobada(
    equipoID: string,
) {
    const ahora =
        new Date()
            .toISOString();

    const {
        error:
            errorParticipantes,
    } =
        await supabaseAdmin
            .from(
                "participantes_equipo",
            )
            .update({
                validacion_estado:
                    "APROBADO",

                updated_at:
                    ahora,
            })
            .eq(
                "equipo_id",
                equipoID,
            )
            .eq(
                "activo",
                true,
            );

    if (
        errorParticipantes
    ) {
        throw errorParticipantes;
    }
}

// ============================================================
// EDITAR EQUIPO
// ============================================================

export async function editarEquipoAdmin({
    contexto,
    cuerpo,
}: {
    contexto:
        ContextoEquipoAdmin;

    cuerpo:
        Registro;
}): Promise<ResultadoEdicionEquipoAdmin> {
    // ========================================================
    // CONTROL DE CONCURRENCIA
    // ========================================================

    exigirMismaVersion(
        contexto.formulario
            .updated_at,
        cuerpo.formulario_updated_at,
        "la inscripció",
    );

    exigirMismaVersion(
        contexto.equipo
            .updated_at,
        cuerpo.equipo_updated_at,
        "l'equip",
    );

    // ========================================================
    // LEER Y VALIDAR
    // ========================================================

    const datos =
        leerDatosEdicionAdmin(
            cuerpo,
        );

    const {
        estado,
    } =
        await validarEdicionEquipo({
            contexto,
            datos,
        });

    // ========================================================
    // RESPONSABLE
    // ========================================================

    const responsable =
        await resolverResponsableAdmin(
            contexto.edicion.id,
            contexto.formulario.id,
            datos.responsable,
        );

    // ========================================================
    // GUARDAR PARTICIPANTES
    // ========================================================

    /*
     * guardarParticipantes() ya implementa:
     *
     * - UPDATE de participantes existentes
     * - INSERT de participantes nuevos
     * - activo=false para participantes retirados
     *
     * Por tanto aquí no duplicamos esa lógica.
     */
    await guardarParticipantes(
        contexto.equipo.id,
        datos.participantes,
    );

    // ========================================================
    // CAPITÁN DEFINITIVO
    // ========================================================

    const capitan =
        await obtenerCapitanGuardado(
            contexto.equipo.id,
            datos.equipo
                .capitan_email,
        );

    if (
        datos.acceso_capitan &&
        !capitan
    ) {
        throw new ErrorAPI(
            409,
            "No es pot donar accés al capità perquè no s'ha pogut identificar.",
        );
    }

    // ========================================================
    // ESCUDO
    // ========================================================

    /*
     * El formulario y la creación administrativa ya convierten
     * cualquier imagen Base64 a un archivo real de Supabase
     * Storage.
     *
     * La edición administrativa debe seguir exactamente la misma
     * regla:
     *
     * Base64
     *   ↓
     * EquiposIMG
     *   ↓
     * URL pública
     *   ↓
     * equipos.escudo
     *
     * Si escudo ya es una URL HTTP/HTTPS, guardarEscudoEquipo()
     * simplemente la conserva.
     */

    let escudoGuardado:
        string | null;

    try {
        escudoGuardado =
            await guardarEscudoEquipo({
                torneoID:
                    contexto.torneo.id,

                edicionID:
                    contexto.edicion.id,

                equipoID:
                    contexto.equipo.id,

                escudo:
                    datos.equipo
                        .escudo,
            });
    } catch (
        error
    ) {
        console.error(
            "Error actualitzant l'escut de l'equip des del panell:",
            error,
        );

        throw new ErrorAPI(
            500,
            "No s'ha pogut guardar l'escut de l'equip.",
        );
    }

    // ========================================================
    // EQUIPO
    // ========================================================

    const ahora =
        new Date()
            .toISOString();

    const validacionEquipo =
        estado ===
        "APROBADO"
            ? "APROBADO"
            : contexto.equipo
                  .validacion_estado;

    const {
        data:
            equipoActualizado,

        error:
            errorEquipo,
    } =
        await supabaseAdmin
            .from(
                "equipos",
            )
            .update({
                nombre:
                    datos.equipo
                        .nombre ||
                    null,

                /*
                 * Nunca guardamos el Base64 recibido desde
                 * React. Aquí únicamente llega:
                 *
                 * - URL pública de Supabase Storage
                 * - URL HTTP/HTTPS ya existente
                 * - null
                 */
                escudo:
                    escudoGuardado,

                capitan_id:
                    capitan?.id ??
                    null,

                nota_admin:
                    datos.equipo
                        .nota_admin,

                /*
                 * Una modificación administrativa de un equipo
                 * aprobado NO devuelve la inscripción a borrador.
                 */
                validacion_estado:
                    validacionEquipo,

                updated_at:
                    ahora,
            })
            .eq(
                "id",
                contexto.equipo.id,
            )
            .eq(
                "formulario_id",
                contexto.formulario.id,
            )
            .eq(
                "updated_at",
                contexto.equipo
                    .updated_at,
            )
            .select(
                "id,formulario_id,nombre,escudo,capitan_id,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at,updated_at",
            )
            .maybeSingle();

    if (
        errorEquipo
    ) {
        throw errorEquipo;
    }

    if (
        !equipoActualizado
    ) {
        throw new ErrorAPI(
            409,
            "L'equip ha canviat mentre el modificaves. Torna a carregar la fitxa.",
        );
    }

    // ========================================================
    // FORMULARIO
    // ========================================================

    const {
        data:
            formularioActualizado,

        error:
            errorFormulario,
    } =
        await supabaseAdmin
            .from(
                "formularios",
            )
            .update({
                usuario_id:
                    responsable
                        .usuario_id,

                email_contacto:
                    responsable
                        .email_contacto,

                acceso_capitan:
                    datos
                        .acceso_capitan,

                /*
                 * IMPORTANTE:
                 *
                 * estado
                 * enviado_at
                 * completado_at
                 *
                 * no cambian por una edición administrativa.
                 */
                updated_at:
                    ahora,
            })
            .eq(
                "id",
                contexto.formulario.id,
            )
            .eq(
                "edicion_id",
                contexto.edicion.id,
            )
            .eq(
                "updated_at",
                contexto.formulario
                    .updated_at,
            )
            .select(
                "id,edicion_id,tipo,estado,usuario_id,email_contacto,acceso_capitan,configuracion_snapshot,iniciado_at,enviado_at,completado_at,created_at,updated_at",
            )
            .maybeSingle();

    if (
        errorFormulario
    ) {
        throw errorFormulario;
    }

    if (
        !formularioActualizado
    ) {
        throw new ErrorAPI(
            409,
            "La inscripció ha canviat mentre la modificaves. Torna a carregar la fitxa.",
        );
    }

    // ========================================================
    // EQUIPO APROBADO
    // ========================================================

    /*
     * guardarParticipantes() no fuerza validacion_estado al
     * insertar participantes nuevos.
     *
     * Si administración está modificando un equipo que ya está
     * APROBADO, los cambios administrativos son autoritativos y
     * el equipo debe continuar completamente aprobado.
     */
    if (
        estado ===
        "APROBADO"
    ) {
        await sincronizarValidacionAprobada(
            contexto.equipo.id,
        );
    }

    // ========================================================
    // RESPUESTA
    // ========================================================

    return {
        mensaje:
            "Les dades de l'equip s'han actualitzat correctament.",

        formulario: {
            id:
                formularioActualizado.id,

            estado:
                normalizarEstadoFormulario(
                    formularioActualizado.estado,
                ),

            usuario_id:
                formularioActualizado.usuario_id,

            email_contacto:
                formularioActualizado.email_contacto,

            acceso_capitan:
                formularioActualizado.acceso_capitan ===
                true,

            updated_at:
                formularioActualizado.updated_at,
        },

        equipo: {
            id:
                equipoActualizado.id,

            nombre:
                equipoActualizado.nombre ??
                "",

            escudo:
                equipoActualizado.escudo,

            capitan_id:
                equipoActualizado.capitan_id,

            nota_admin:
                equipoActualizado.nota_admin,

            plaza_estado:
                equipoActualizado.plaza_estado,

            validacion_estado:
                equipoActualizado.validacion_estado,

            updated_at:
                equipoActualizado.updated_at,
        },
    };
}