import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";

import {
    comprobarOrigen,
    exigirUsuario,
    leerJSON,
    obtenerConfiguracionEdicion,
    validarEmails,
    validarEmailsRepetidos,
    validarEnvio,
    validarEstructuraParticipantes,
    type DatosEntrada,
    type EquipoDB,
    type ParticipanteDB,
} from "@utils/inscripcio/equipBase";

import {
    guardarEscudoEquipo,
} from "@utils/inscripcio/equipStorage";

import {
    CAMPOS_EQUIPO,
    CAMPOS_FORMULARIO,
    CAMPOS_PARTICIPANTE,
    ESTADOS_PLAZA,
    ErrorAPI,
    esRegistro,
    exigirPermisoEquip,
    leerIDAdmin,
    leerTextoAdmin,
    nombreCompleto,
    normalizarEmail,
    normalizarEstadoFormulario,
    normalizarEstadoPlaza,
    normalizarOrigenFormulario,
    normalizarTipoParticipante,
    normalizarValidacion,
    obtenerCapacidades,
    obtenerConfiguracionPlataformaAdmin,
    obtenerEdicionAdmin,
    obtenerTorneoAdmin,
    resolverResponsableAdmin,
    responder,
    responderErrorAdmin,
    validarEmailResponsable,
    type DatosEdicionAdmin,
    type EstadoPlaza,
    type FormularioAdminDB,
    type Registro,
    type Usuario,
} from "@utils/panell/equips/adminComun";

import {
    leerDatosEdicionAdmin,
} from "@utils/panell/equips/adminEdicion";

// ============================================================
// CONSTANTES
// ============================================================

const ESTADOS_CREACION = [
    "BORRADOR",
    "APROBADO",
] as const;

const ESTADOS_INSCRIPCION_REAL = [
    "EN_REVISION",
    "APROBADO",
    "DENEGADO",
] as const;

// ============================================================
// TIPOS
// ============================================================

type EstadoCreacion =
    typeof ESTADOS_CREACION[number];

type ResponsableListaDB = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    activa: boolean | null;
};

type DatosCreacionAdmin =
    DatosEdicionAdmin & {
        estado: EstadoCreacion;

        plaza: {
            estado: EstadoPlaza;
            posicion_lista_espera: number | null;
        };
    };

type ParticipanteNuevo = {
    id: string;

    tipo_participante:
        DatosEdicionAdmin["participantes"][number]["tipo_participante"];

    nombre: string;
    apellido1: string;
    apellido2: string;
    email: string;
    curso: string;
    grupo: string;

    genero:
        DatosEdicionAdmin["participantes"][number]["genero"];

    orden: number;
};

// ============================================================
// CONFIGURACIÓN EDICIÓN
// ============================================================

async function exigirConfiguracionEdicion(
    edicionID: string,
) {
    const configuracion =
        await obtenerConfiguracionEdicion(
            edicionID,
        );

    if (
        !configuracion
    ) {
        throw new ErrorAPI(
            409,
            "Aquesta edició no té configurada la inscripció d'equips.",
        );
    }

    return configuracion;
}

// ============================================================
// LISTADO · FORMULARIOS
// ============================================================

async function obtenerFormulariosLista(
    edicionID: string,
): Promise<FormularioAdminDB[]> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "formularios",
            )
            .select(
                CAMPOS_FORMULARIO,
            )
            .eq(
                "edicion_id",
                edicionID,
            )
            .eq(
                "tipo",
                "EQUIPO",
            )
            .order(
                "created_at",
                {
                    ascending:
                        false,

                    nullsFirst:
                        false,
                },
            );

    if (
        error
    ) {
        throw error;
    }

    return (
        data ??
        []
    ) as FormularioAdminDB[];
}

// ============================================================
// LISTADO · EQUIPOS
// ============================================================

async function obtenerEquiposLista(
    idsFormularios: string[],
): Promise<EquipoDB[]> {
    if (
        idsFormularios.length ===
        0
    ) {
        return [];
    }

    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "equipos",
            )
            .select(
                CAMPOS_EQUIPO,
            )
            .in(
                "formulario_id",
                idsFormularios,
            )
            .order(
                "created_at",
                {
                    ascending:
                        false,

                    nullsFirst:
                        false,
                },
            );

    if (
        error
    ) {
        throw error;
    }

    return (
        data ??
        []
    ) as EquipoDB[];
}

// ============================================================
// LISTADO · PARTICIPANTES
// ============================================================

async function obtenerParticipantesLista(
    idsEquipos: string[],
): Promise<ParticipanteDB[]> {
    if (
        idsEquipos.length ===
        0
    ) {
        return [];
    }

    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "participantes_equipo",
            )
            .select(
                CAMPOS_PARTICIPANTE,
            )
            .in(
                "equipo_id",
                idsEquipos,
            )
            .eq(
                "activo",
                true,
            )
            .order(
                "orden",
                {
                    ascending:
                        true,

                    nullsFirst:
                        false,
                },
            );

    if (
        error
    ) {
        throw error;
    }

    return (
        data ??
        []
    ) as ParticipanteDB[];
}

// ============================================================
// LISTADO · RESPONSABLES
// ============================================================

async function obtenerResponsablesLista(
    idsUsuarios: string[],
): Promise<ResponsableListaDB[]> {
    if (
        idsUsuarios.length ===
        0
    ) {
        return [];
    }

    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "users",
            )
            .select(
                "id,nombre,apellido1,apellido2,email,activa",
            )
            .in(
                "id",
                idsUsuarios,
            );

    if (
        error
    ) {
        throw error;
    }

    return (
        data ??
        []
    ) as ResponsableListaDB[];
}

// ============================================================
// PREPARAR FILA
// ============================================================

function prepararFila({
    formulario,
    equipo,
    participantes,
    responsable,
    capacidades,
}: {
    formulario: FormularioAdminDB;
    equipo: EquipoDB | null;
    participantes: ParticipanteDB[];
    responsable: ResponsableListaDB | null;

    capacidades: {
        editar: boolean;
        evaluar: boolean;
        cambiarEstado: boolean;
        eliminar: boolean;
    };
}) {
    const jugadores =
        participantes.filter(
            participante =>
                normalizarTipoParticipante(
                    participante.tipo_participante,
                ) ===
                "JUGADOR",
        );

    const profesores =
        participantes.filter(
            participante =>
                normalizarTipoParticipante(
                    participante.tipo_participante,
                ) ===
                "PROFESOR",
        );

    const entrenadores =
        participantes.filter(
            participante =>
                normalizarTipoParticipante(
                    participante.tipo_participante,
                ) ===
                "ENTRENADOR",
        );

    const staff =
        participantes.filter(
            participante =>
                normalizarTipoParticipante(
                    participante.tipo_participante,
                ) ===
                "STAFF",
        );

    const capitan =
        equipo?.capitan_id
            ? participantes.find(
                  participante =>
                      participante.id ===
                      equipo.capitan_id,
              ) ??
              null
            : null;

    return {
        id:
            equipo?.id ??
            null,

        formulario_id:
            formulario.id,

        nombre:
            equipo?.nombre ??
            "",

        escudo:
            equipo?.escudo ??
            null,

        validacion_estado:
            normalizarValidacion(
                equipo?.validacion_estado ??
                null,
            ),

        plaza_estado:
            normalizarEstadoPlaza(
                equipo?.plaza_estado ??
                null,
            ),

        posicion_lista_espera:
            equipo
                ?.posicion_lista_espera ??
            null,

        nota_admin:
            equipo?.nota_admin ??
            null,

        created_at:
            equipo?.created_at ??
            formulario.created_at,

        updated_at:
            equipo?.updated_at ??
            formulario.updated_at,

        formulario: {
            id:
                formulario.id,

            estado:
                normalizarEstadoFormulario(
                    formulario.estado,
                ),

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
            responsable
                ? {
                      id:
                          responsable.id,

                      nombre:
                          responsable.nombre,

                      apellido1:
                          responsable.apellido1,

                      apellido2:
                          responsable.apellido2,

                      nombre_completo:
                          nombreCompleto(
                              responsable,
                          ),

                      email:
                          responsable.email,
                  }
                : formulario.email_contacto
                  ? {
                        id:
                            null,

                        nombre:
                            null,

                        apellido1:
                            null,

                        apellido2:
                            null,

                        nombre_completo:
                            "",

                        email:
                            formulario.email_contacto,
                    }
                  : null,

        participantes: {
            total:
                participantes.length,

            jugadores:
                jugadores.length,

            profesores:
                profesores.length,

            entrenadores:
                entrenadores.length,

            staff:
                staff.length,

            capitan:
                capitan
                    ? {
                          id:
                              capitan.id,

                          nombre:
                              capitan.nombre,

                          apellido1:
                              capitan.apellido1,

                          apellido2:
                              capitan.apellido2,

                          nombre_completo:
                              nombreCompleto(
                                  capitan,
                              ),

                          email:
                              capitan.email,

                          curso:
                              capitan.curso,

                          grupo:
                              capitan.grupo,
                      }
                    : null,
        },

        capacidades,
    };
}

// ============================================================
// RESUMEN
// ============================================================

function construirResumen(
    filas:
        ReturnType<
            typeof prepararFila
        >[],
) {
    const borradores =
        filas.filter(
            fila =>
                fila.formulario
                    .estado ===
                "BORRADOR",
        );

    const enviadas =
        filas.filter(
            fila =>
                fila.formulario
                    .estado !==
                "BORRADOR",
        );

    return {
        total:
            enviadas.length,

        borradores:
            borradores.length,

        participantes:
            enviadas.reduce(
                (
                    total,
                    fila,
                ) =>
                    total +
                    fila
                        .participantes
                        .total,
                0,
            ),

        enRevision:
            enviadas.filter(
                fila =>
                    fila.formulario
                        .estado ===
                    "EN_REVISION",
            ).length,

        aprobadas:
            enviadas.filter(
                fila =>
                    fila.formulario
                        .estado ===
                    "APROBADO",
            ).length,

        denegadas:
            enviadas.filter(
                fila =>
                    fila.formulario
                        .estado ===
                    "DENEGADO",
            ).length,

        plazas: {
            confirmadas:
                enviadas.filter(
                    fila =>
                        fila.plaza_estado ===
                        "CONFIRMADA",
                ).length,

            listaEspera:
                enviadas.filter(
                    fila =>
                        fila.plaza_estado ===
                        "LISTA_ESPERA",
                ).length,

            sinPlaza:
                enviadas.filter(
                    fila =>
                        fila.plaza_estado ===
                        "SIN_PLAZA",
                ).length,

            pendientes:
                enviadas.filter(
                    fila =>
                        fila.plaza_estado ===
                        "PENDIENTE",
                ).length,
        },
    };
}

// ============================================================
// ORDEN
// ============================================================

function ordenarFilas(
    filas:
        ReturnType<
            typeof prepararFila
        >[],
) {
    return filas.sort(
        (
            a,
            b,
        ) => {
            const fechaA =
                Date.parse(
                    a.updated_at ??
                    a.created_at ??
                    "",
                );

            const fechaB =
                Date.parse(
                    b.updated_at ??
                    b.created_at ??
                    "",
                );

            const tiempoA =
                Number.isFinite(
                    fechaA,
                )
                    ? fechaA
                    : 0;

            const tiempoB =
                Number.isFinite(
                    fechaB,
                )
                    ? fechaB
                    : 0;

            return (
                tiempoB -
                tiempoA
            );
        },
    );
}

// ============================================================
// ESTADO CREACIÓN
// ============================================================

function leerEstadoCreacion(
    valor: unknown,
): EstadoCreacion {
    const estado =
        leerTextoAdmin(
            valor,
            "estado",
            30,
            true,
        )
            .toUpperCase();

    if (
        !ESTADOS_CREACION.includes(
            estado as EstadoCreacion,
        )
    ) {
        throw new ErrorAPI(
            400,
            "L'estat inicial de l'equip no és vàlid.",
        );
    }

    return estado as EstadoCreacion;
}

// ============================================================
// PLAZA
// ============================================================

function leerPlazaCreacion(
    valor: unknown,
): DatosCreacionAdmin["plaza"] {
    if (
        valor ===
            undefined ||
        valor ===
            null
    ) {
        return {
            estado:
                "PENDIENTE",

            posicion_lista_espera:
                null,
        };
    }

    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració de la plaça no és vàlida.",
        );
    }

    const estadoRaw =
        leerTextoAdmin(
            valor.estado,
            "estat de la plaça",
            50,
            true,
        )
            .toUpperCase();

    if (
        !ESTADOS_PLAZA.includes(
            estadoRaw as EstadoPlaza,
        )
    ) {
        throw new ErrorAPI(
            400,
            "L'estat de la plaça no és vàlid.",
        );
    }

    const estado =
        estadoRaw as EstadoPlaza;

    let posicion:
        number | null =
        null;

    if (
        estado ===
        "LISTA_ESPERA"
    ) {
        if (
            typeof valor
                .posicion_lista_espera !==
                "number" ||
            !Number.isSafeInteger(
                valor.posicion_lista_espera,
            ) ||
            valor.posicion_lista_espera <
                1
        ) {
            throw new ErrorAPI(
                400,
                "Indica una posició vàlida de la llista d'espera.",
            );
        }

        posicion =
            valor.posicion_lista_espera;
    }

    return {
        estado,

        posicion_lista_espera:
            posicion,
    };
}

// ============================================================
// DATOS CREACIÓN
// ============================================================

function leerDatosCreacionAdmin(
    cuerpo: Registro,
): DatosCreacionAdmin {
    const datos =
        leerDatosEdicionAdmin(
            cuerpo,
        );

    if (
        datos.participantes.some(
            participante =>
                participante.id !==
                null,
        )
    ) {
        throw new ErrorAPI(
            400,
            "No es poden indicar identificadors de participants en crear un equip.",
        );
    }

    return {
        ...datos,

        estado:
            leerEstadoCreacion(
                cuerpo.estado,
            ),

        plaza:
            leerPlazaCreacion(
                cuerpo.plaza,
            ),
    };
}

// ============================================================
// EMAILS
// ============================================================

function emailValido(
    email: string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
    );
}

function validarFormatoEmails(
    datos:
        DatosCreacionAdmin,
) {
    if (
        datos.responsable.email &&
        !emailValido(
            datos.responsable.email,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del responsable no és vàlid.",
        );
    }

    if (
        datos.equipo
            .capitan_email &&
        !emailValido(
            datos.equipo
                .capitan_email,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del capità no és vàlid.",
        );
    }

    for (
        let indice =
            0;
        indice <
        datos.participantes.length;
        indice +=
            1
    ) {
        const participante =
            datos.participantes[
                indice
            ];

        if (
            participante.email &&
            !emailValido(
                participante.email,
            )
        ) {
            throw new ErrorAPI(
                400,
                `El correu del participant ${indice + 1} no és vàlid.`,
            );
        }
    }
}

// ============================================================
// DUPLICADOS
// ============================================================

async function comprobarDuplicadosInscritos(
    edicionID: string,
    participantes:
        DatosCreacionAdmin["participantes"],
) {
    const emails = [
        ...new Set(
            participantes
                .map(
                    participante =>
                        normalizarEmail(
                            participante.email,
                        ),
                )
                .filter(Boolean),
        ),
    ];

    if (
        emails.length ===
        0
    ) {
        return;
    }

    const {
        data:
            formularios,

        error:
            errorFormularios,
    } =
        await supabaseAdmin
            .from(
                "formularios",
            )
            .select(
                "id",
            )
            .eq(
                "edicion_id",
                edicionID,
            )
            .eq(
                "tipo",
                "EQUIPO",
            )
            .in(
                "estado",
                [
                    ...ESTADOS_INSCRIPCION_REAL,
                ],
            );

    if (
        errorFormularios
    ) {
        throw errorFormularios;
    }

    if (
        !formularios ||
        formularios.length ===
            0
    ) {
        return;
    }

    const {
        data:
            equipos,

        error:
            errorEquipos,
    } =
        await supabaseAdmin
            .from(
                "equipos",
            )
            .select(
                "id",
            )
            .in(
                "formulario_id",
                formularios.map(
                    formulario =>
                        formulario.id,
                ),
            );

    if (
        errorEquipos
    ) {
        throw errorEquipos;
    }

    const idsEquipos =
        (
            equipos ??
            []
        )
            .map(
                equipo =>
                    equipo.id,
            )
            .filter(
                (
                    id,
                ): id is string =>
                    typeof id ===
                        "string" &&
                    Boolean(
                        id,
                    ),
            );

    if (
        idsEquipos.length ===
        0
    ) {
        return;
    }

    /*
     * Leemos todos los correos y normalizamos en servidor para
     * que los antiguos registros con mayúsculas también sean
     * detectados.
     */

    const {
        data:
            coincidencias,

        error:
            errorParticipantes,
    } =
        await supabaseAdmin
            .from(
                "participantes_equipo",
            )
            .select(
                "email,equipo_id",
            )
            .in(
                "equipo_id",
                idsEquipos,
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

    const emailsOcupados =
        new Set(
            (
                coincidencias ??
                []
            )
                .map(
                    participante =>
                        normalizarEmail(
                            participante.email ??
                            "",
                        ),
                )
                .filter(Boolean),
        );

    const duplicado =
        emails.find(
            email =>
                emailsOcupados.has(
                    email,
                ),
        );

    if (
        duplicado
    ) {
        throw new ErrorAPI(
            409,
            `La persona amb el correu ${duplicado} ja forma part d'un altre equip d'aquesta edició.`,
        );
    }
}

// ============================================================
// PARTICIPANTES NUEVOS
// ============================================================

function prepararParticipantesNuevos(
    datos:
        DatosCreacionAdmin,
): ParticipanteNuevo[] {
    return datos.participantes.map(
        participante => ({
            id:
                randomUUID(),

            tipo_participante:
                participante
                    .tipo_participante,

            nombre:
                participante.nombre,

            apellido1:
                participante.apellido1,

            apellido2:
                participante.apellido2,

            email:
                participante.email,

            curso:
                participante.curso,

            grupo:
                participante.grupo,

            genero:
                participante.genero,

            orden:
                participante.orden,
        }),
    );
}

// ============================================================
// CAPITÁN
// ============================================================

function obtenerCapitanNuevo(
    datos:
        DatosCreacionAdmin,
    participantes:
        ParticipanteNuevo[],
) {
    if (
        !datos.equipo
            .capitan_email
    ) {
        return null;
    }

    const coincidencias =
        participantes.filter(
            participante =>
                participante
                    .tipo_participante ===
                    "JUGADOR" &&
                normalizarEmail(
                    participante.email,
                ) ===
                    datos.equipo
                        .capitan_email,
        );

    if (
        coincidencias.length !==
        1
    ) {
        throw new ErrorAPI(
            400,
            "El capità seleccionat no correspon a un únic jugador de l'equip.",
        );
    }

    return coincidencias[0];
}

// ============================================================
// DATOS VALIDACIÓN
// ============================================================

function prepararDatosValidacion(
    datos:
        DatosCreacionAdmin,
    equipoID: string,
    participantes:
        ParticipanteNuevo[],
    capitanID:
        string | null,
): DatosEntrada {
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
                capitanID,
        },

        participantes:
            participantes.map(
                participante => ({
                    id:
                        participante.id,

                    tipo_participante:
                        participante
                            .tipo_participante,

                    nombre:
                        participante.nombre,

                    apellido1:
                        participante.apellido1,

                    apellido2:
                        participante.apellido2,

                    email:
                        participante.email,

                    curso:
                        participante.curso,

                    grupo:
                        participante.grupo,

                    genero:
                        participante.genero,

                    orden:
                        participante.orden,
                }),
            ),
    };
}

// ============================================================
// VALIDAR CREACIÓN
// ============================================================

async function validarCreacion({
    datos,
    configuracion,
    configuracionPlataforma,
    edicionID,
    datosValidacion,
}: {
    datos:
        DatosCreacionAdmin;

    configuracion:
        NonNullable<
            Awaited<
                ReturnType<
                    typeof obtenerConfiguracionEdicion
                >
            >
        >;

    configuracionPlataforma:
        Awaited<
            ReturnType<
                typeof obtenerConfiguracionPlataformaAdmin
            >
        >;

    edicionID:
        string;

    datosValidacion:
        DatosEntrada;
}) {
    validarFormatoEmails(
        datos,
    );

    validarEmailResponsable(
        datos.responsable.email,
        configuracionPlataforma,
    );

    validarEmails(
        datosValidacion.participantes,
        configuracionPlataforma,
    );

    validarEmailsRepetidos(
        datosValidacion.participantes,
    );

    validarEstructuraParticipantes(
        datosValidacion.participantes,
        configuracion,
    );

    if (
        datos.estado ===
        "APROBADO"
    ) {
        await comprobarDuplicadosInscritos(
            edicionID,
            datos.participantes,
        );

        validarEnvio(
            datosValidacion,
            configuracion,
        );
    }
}

// ============================================================
// PLAZA INICIAL
// ============================================================

function resolverPlazaInicial({
    datos,
    puedeCambiarEstado,
}: {
    datos:
        DatosCreacionAdmin;

    puedeCambiarEstado:
        boolean;
}) {
    if (
        datos.estado ===
        "BORRADOR"
    ) {
        return {
            estado:
                "PENDIENTE" as const,

            posicion:
                null,
        };
    }

    if (
        datos.plaza.estado !==
            "PENDIENTE" &&
        !puedeCambiarEstado
    ) {
        throw new ErrorAPI(
            403,
            "Pots crear l'equip, però no tens permís per assignar-li una plaça.",
        );
    }

    return {
        estado:
            datos.plaza.estado,

        posicion:
            datos.plaza.estado ===
                "LISTA_ESPERA"
                ? datos.plaza
                      .posicion_lista_espera
                : null,
    };
}

// ============================================================
// COMPENSACIÓN
// ============================================================

async function dejarCreacionComoBorrador({
    formularioID,
    equipoID,
}: {
    formularioID: string;
    equipoID: string | null;
}) {
    const ahora =
        new Date()
            .toISOString();

    const {
        error:
            errorFormulario,
    } =
        await supabaseAdmin
            .from(
                "formularios",
            )
            .update({
                estado:
                    "BORRADOR",

                origen:
                    "ADMIN",

                enviado_at:
                    null,

                completado_at:
                    null,

                updated_at:
                    ahora,
            })
            .eq(
                "id",
                formularioID,
            );

    if (
        errorFormulario
    ) {
        console.error(
            "No s'ha pogut deixar en esborrany el formulari després d'una creació incompleta:",
            errorFormulario,
        );
    }

    if (
        !equipoID
    ) {
        return;
    }

    const {
        error:
            errorEquipo,
    } =
        await supabaseAdmin
            .from(
                "equipos",
            )
            .update({
                validacion_estado:
                    "PENDIENTE",

                plaza_estado:
                    "PENDIENTE",

                posicion_lista_espera:
                    null,

                updated_at:
                    ahora,
            })
            .eq(
                "id",
                equipoID,
            )
            .eq(
                "formulario_id",
                formularioID,
            );

    if (
        errorEquipo
    ) {
        console.error(
            "No s'ha pogut restaurar l'equip a pendent després d'una creació incompleta:",
            errorEquipo,
        );
    }
}

// ============================================================
// LIMPIAR ESCUDO DE UNA CREACIÓN FALLIDA
// ============================================================

async function limpiarEscudoCreacion({
    torneoID,
    edicionID,
    equipoID,
}: {
    torneoID: string;
    edicionID: string;
    equipoID: string;
}) {
    try {
        await guardarEscudoEquipo({
            torneoID,
            edicionID,
            equipoID,
            escudo:
                null,
        });
    } catch (
        error
    ) {
        console.error(
            `No s'ha pogut eliminar l'escut de la creació incompleta de l'equip ${equipoID}:`,
            error,
        );
    }
}

// ============================================================
// GET · LISTADO / PREPARAR CREACIÓN
// ============================================================

export const obtenerListadoEquiposAdmin:
    APIRoute =
    async ({
        cookies,
        url,
    }) => {
        try {
            const usuario =
                await exigirUsuario(
                    cookies,
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

            const vista =
                url.searchParams
                    .get(
                        "vista",
                    )
                    ?.trim()
                    .toLowerCase() ??
                "lista";

            if (
                vista !==
                    "lista" &&
                vista !==
                    "crear"
            ) {
                throw new ErrorAPI(
                    400,
                    "La vista indicada no és vàlida.",
                );
            }

            exigirPermisoEquip(
                usuario,
                torneoID,
                vista ===
                    "crear"
                    ? "crear"
                    : "ver",
            );

            const [
                torneo,
                edicion,
            ] =
                await Promise.all([
                    obtenerTorneoAdmin(
                        torneoID,
                    ),

                    obtenerEdicionAdmin(
                        edicionID,
                        torneoID,
                    ),
                ]);

            // =================================================
            // PREPARAR CREACIÓN
            // =================================================

            if (
                vista ===
                "crear"
            ) {
                const configuracion =
                    await exigirConfiguracionEdicion(
                        edicionID,
                    );

                const capacidades =
                    obtenerCapacidades(
                        usuario,
                        torneoID,
                    );

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
                            edicion.estado,

                        sede:
                            edicion.sede,

                        fecha_inicio:
                            edicion.fecha_inicio,

                        fecha_fin:
                            edicion.fecha_fin,
                    },

                    configuracion,

                    capacidades: {
                        crear:
                            true,

                        cambiarEstado:
                            capacidades
                                .cambiarEstado,
                    },
                });
            }

            // =================================================
            // LISTA
            // =================================================

            const formularios =
                await obtenerFormulariosLista(
                    edicionID,
                );

            const idsFormularios =
                formularios.map(
                    formulario =>
                        formulario.id,
                );

            const equipos =
                await obtenerEquiposLista(
                    idsFormularios,
                );

            const idsEquipos =
                equipos.map(
                    equipo =>
                        equipo.id,
                );

            const idsResponsables = [
                ...new Set(
                    formularios
                        .map(
                            formulario =>
                                formulario.usuario_id,
                        )
                        .filter(
                            (
                                id,
                            ): id is string =>
                                typeof id ===
                                    "string" &&
                                Boolean(
                                    id,
                                ),
                        ),
                ),
            ];

            const [
                participantes,
                responsables,
            ] =
                await Promise.all([
                    obtenerParticipantesLista(
                        idsEquipos,
                    ),

                    obtenerResponsablesLista(
                        idsResponsables,
                    ),
                ]);

            const equipoPorFormulario =
                new Map<
                    string,
                    EquipoDB
                >();

            for (
                const equipo
                of equipos
            ) {
                if (
                    !equipoPorFormulario.has(
                        equipo.formulario_id,
                    )
                ) {
                    equipoPorFormulario.set(
                        equipo.formulario_id,
                        equipo,
                    );
                }
            }

            const participantesPorEquipo =
                new Map<
                    string,
                    ParticipanteDB[]
                >();

            for (
                const participante
                of participantes
            ) {
                const actuales =
                    participantesPorEquipo.get(
                        participante.equipo_id,
                    ) ??
                    [];

                actuales.push(
                    participante,
                );

                participantesPorEquipo.set(
                    participante.equipo_id,
                    actuales,
                );
            }

            const responsablePorID =
                new Map<
                    string,
                    ResponsableListaDB
                >(
                    responsables.map(
                        responsable => [
                            responsable.id,
                            responsable,
                        ],
                    ),
                );

            const capacidades =
                obtenerCapacidades(
                    usuario,
                    torneoID,
                );

            const filas =
                ordenarFilas(
                    formularios.map(
                        formulario => {
                            const equipo =
                                equipoPorFormulario.get(
                                    formulario.id,
                                ) ??
                                null;

                            const listaParticipantes =
                                equipo
                                    ? participantesPorEquipo.get(
                                          equipo.id,
                                      ) ??
                                      []
                                    : [];

                            const responsable =
                                formulario.usuario_id
                                    ? responsablePorID.get(
                                          formulario.usuario_id,
                                      ) ??
                                      null
                                    : null;

                            return prepararFila({
                                formulario,
                                equipo,

                                participantes:
                                    listaParticipantes,

                                responsable,

                                capacidades: {
                                    editar:
                                        capacidades.editar,

                                    evaluar:
                                        capacidades.evaluar,

                                    cambiarEstado:
                                        capacidades
                                            .cambiarEstado,

                                    eliminar:
                                        capacidades.eliminar,
                                },
                            });
                        },
                    ),
                );

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
                        edicion.estado,

                    sede:
                        edicion.sede,

                    fecha_inicio:
                        edicion.fecha_inicio,

                    fecha_fin:
                        edicion.fecha_fin,
                },

                resumen:
                    construirResumen(
                        filas,
                    ),

                filas,

                capacidades,
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
// CREAR EQUIPO
// ============================================================

async function crearEquipo({
    usuario,
    torneoID,
    edicionID,
    cuerpo,
}: {
    usuario: Usuario;
    torneoID: string;
    edicionID: string;
    cuerpo: Registro;
}) {
    // ========================================================
    // CONTEXTO
    // ========================================================

    const [
        torneo,
        edicion,
        configuracion,
        configuracionPlataforma,
    ] =
        await Promise.all([
            obtenerTorneoAdmin(
                torneoID,
            ),

            obtenerEdicionAdmin(
                edicionID,
                torneoID,
            ),

            exigirConfiguracionEdicion(
                edicionID,
            ),

            obtenerConfiguracionPlataformaAdmin(),
        ]);

    // ========================================================
    // DATOS
    // ========================================================

    const datos =
        leerDatosCreacionAdmin(
            cuerpo,
        );

    // ========================================================
    // PARTICIPANTES
    // ========================================================

    const participantesNuevos =
        prepararParticipantesNuevos(
            datos,
        );

    const capitan =
        obtenerCapitanNuevo(
            datos,
            participantesNuevos,
        );

    if (
        datos.acceso_capitan &&
        !capitan
    ) {
        throw new ErrorAPI(
            400,
            "Per donar accés al capità primer has de seleccionar-lo.",
        );
    }

    // ========================================================
    // IDS
    // ========================================================

    const formularioID =
        randomUUID();

    const equipoID =
        randomUUID();

    // ========================================================
    // VALIDACIÓN
    // ========================================================

    const datosValidacion =
        prepararDatosValidacion(
            datos,
            equipoID,
            participantesNuevos,
            capitan?.id ??
                null,
        );

    await validarCreacion({
        datos,
        configuracion,
        configuracionPlataforma,
        edicionID,
        datosValidacion,
    });

    // ========================================================
    // RESPONSABLE
    // ========================================================

    const responsable =
        await resolverResponsableAdmin(
            edicionID,
            null,
            datos.responsable,
        );

    // ========================================================
    // PLAZA
    // ========================================================

    const capacidades =
        obtenerCapacidades(
            usuario,
            torneoID,
        );

    const plaza =
        resolverPlazaInicial({
            datos,

            puedeCambiarEstado:
                capacidades
                    .cambiarEstado,
        });

    // ========================================================
    // ESCUDO · STORAGE
    // ========================================================

    /*
     * El frontend todavía envía una data URL.
     *
     * Aquí la transformamos en un archivo real:
     *
     * EquiposIMG/
     *   {torneoID}/
     *     {edicionID}/
     *       escudo/
     *         {equipoID}.{extension}
     *
     * En PostgreSQL solamente guardamos la URL pública.
     */

    let escudoGuardado:
        string | null;

    try {
        escudoGuardado =
            await guardarEscudoEquipo({
                torneoID,
                edicionID,
                equipoID,

                escudo:
                    datos.equipo
                        .escudo,
            });
    } catch (
        error
    ) {
        console.error(
            "Error pujant l'escut de l'equip creat des del panell:",
            error,
        );

        throw new ErrorAPI(
            500,
            "No s'ha pogut pujar l'escut de l'equip.",
        );
    }

    // ========================================================
    // FECHAS
    // ========================================================

    const ahora =
        new Date()
            .toISOString();

    const aprobado =
        datos.estado ===
        "APROBADO";

    // ========================================================
    // FORMULARIO
    // ========================================================

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

                origen:
                    "ADMIN",

                estado:
                    datos.estado,

                usuario_id:
                    responsable
                        .usuario_id,

                email_contacto:
                    responsable
                        .email_contacto,

                acceso_capitan:
                    datos.acceso_capitan,

                configuracion_snapshot:
                    configuracion,

                iniciado_at:
                    ahora,

                enviado_at:
                    aprobado
                        ? ahora
                        : null,

                completado_at:
                    aprobado
                        ? ahora
                        : null,

                created_at:
                    ahora,

                updated_at:
                    ahora,
            });

    if (
        errorFormulario
    ) {
        await limpiarEscudoCreacion({
            torneoID,
            edicionID,
            equipoID,
        });

        throw errorFormulario;
    }

    // ========================================================
    // EQUIPO
    // ========================================================

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
                    datos.equipo
                        .nombre ||
                    null,

                /*
                 * URL de Supabase Storage, nunca Base64.
                 */
                escudo:
                    escudoGuardado,

                capitan_id:
                    capitan?.id ??
                    null,

                validacion_estado:
                    aprobado
                        ? "APROBADO"
                        : "PENDIENTE",

                plaza_estado:
                    plaza.estado,

                posicion_lista_espera:
                    plaza.posicion,

                nota_admin:
                    datos.equipo
                        .nota_admin,

                created_at:
                    ahora,

                updated_at:
                    ahora,
            });

    if (
        errorEquipo
    ) {
        await limpiarEscudoCreacion({
            torneoID,
            edicionID,
            equipoID,
        });

        await dejarCreacionComoBorrador({
            formularioID,
            equipoID:
                null,
        });

        throw errorEquipo;
    }

    // ========================================================
    // PARTICIPANTES
    // ========================================================

    if (
        participantesNuevos.length >
        0
    ) {
        const {
            error:
                errorParticipantes,
        } =
            await supabaseAdmin
                .from(
                    "participantes_equipo",
                )
                .insert(
                    participantesNuevos.map(
                        participante => ({
                            id:
                                participante.id,

                            equipo_id:
                                equipoID,

                            tipo_participante:
                                participante
                                    .tipo_participante,

                            nombre:
                                participante
                                    .nombre ||
                                null,

                            apellido1:
                                participante
                                    .apellido1 ||
                                null,

                            apellido2:
                                participante
                                    .apellido2 ||
                                null,

                            email:
                                participante
                                    .email ||
                                null,

                            curso:
                                participante
                                    .tipo_participante ===
                                    "JUGADOR" ||
                                participante
                                    .tipo_participante ===
                                    "PROFESOR"
                                    ? participante
                                          .curso ||
                                      null
                                    : null,

                            grupo:
                                participante
                                    .tipo_participante ===
                                    "JUGADOR" ||
                                participante
                                    .tipo_participante ===
                                    "PROFESOR"
                                    ? participante
                                          .grupo ||
                                      null
                                    : null,

                            genero:
                                participante
                                    .genero,

                            validacion_estado:
                                aprobado
                                    ? "APROBADO"
                                    : "PENDIENTE",

                            orden:
                                participante
                                    .orden,

                            activo:
                                true,

                            created_at:
                                ahora,

                            updated_at:
                                ahora,
                        }),
                    ),
                );

        if (
            errorParticipantes
        ) {
            /*
             * El formulario/equipo quedan recuperables como
             * BORRADOR. Conservamos el escudo porque el equipo
             * sí existe y puede terminarse posteriormente.
             */
            await dejarCreacionComoBorrador({
                formularioID,
                equipoID,
            });

            throw errorParticipantes;
        }
    }

    // ========================================================
    // RESPUESTA
    // ========================================================

    return responder(
        {
            success:
                true,

            mensaje:
                aprobado
                    ? "Equip creat i aprovat correctament."
                    : "Equip creat com a esborrany.",

            torneo: {
                id:
                    torneo.id,

                nombre:
                    torneo.nombre ??
                    "Torneig",
            },

            edicion: {
                id:
                    edicion.id,

                nombre:
                    edicion.nombre ??
                    "Edició",
            },

            formulario: {
                id:
                    formularioID,

                estado:
                    datos.estado,

                origen:
                    "ADMIN",
            },

            equipo: {
                id:
                    equipoID,

                nombre:
                    datos.equipo
                        .nombre,

                escudo:
                    escudoGuardado,

                capitan_id:
                    capitan?.id ??
                    null,

                plaza_estado:
                    plaza.estado,

                posicion_lista_espera:
                    plaza.posicion,
            },

            redireccion:
                `/panell/equips/${encodeURIComponent(equipoID)}?${new URLSearchParams({
                    torneoID,
                    edicionID,
                }).toString()}`,
        },
        201,
    );
}

// ============================================================
// POST · CREACIÓN ADMINISTRATIVA
// ============================================================

export const crearEquipoAdmin:
    APIRoute =
    async ({
        cookies,
        request,
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
                    "L'acció indicada no és vàlida.",
                );
            }

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

            exigirPermisoEquip(
                usuario,
                torneoID,
                "crear",
            );

            return await crearEquipo({
                usuario,
                torneoID,
                edicionID,
                cuerpo,
            });
        } catch (
            error
        ) {
            return responderErrorAdmin(
                error,
            );
        }
    };