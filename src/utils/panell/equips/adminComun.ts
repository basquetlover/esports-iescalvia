import type { APIRoute } from "astro";

import {
    tieneAccesoTorneo,
    tienePermiso,
} from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
    ErrorAPI,
    configuracionFormulario,
    esRegistro,
    exigirUUID,
    exigirUsuario,
    normalizarEmail,
    obtenerConfiguracionEdicion,
    obtenerConfiguracionPlataforma,
    obtenerParticipantes,
    responder,
    type ConfiguracionEquipos,
    type ConfiguracionPlataforma,
    type EquipoDB,
    type EstadoFormulario,
    type FormularioDB,
    type Genero,
    type ParticipanteDB,
    type ParticipanteEntrada,
    type Registro,
    type TipoParticipante,
    type Usuario,
} from "@utils/inscripcio/equipBase";

// ============================================================
// REEXPORTS DE TIPOS BASE
// ============================================================

export type {
    ConfiguracionEquipos,
    ConfiguracionPlataforma,
    EquipoDB,
    EstadoFormulario,
    FormularioDB,
    Genero,
    ParticipanteDB,
    ParticipanteEntrada,
    Registro,
    TipoParticipante,
    Usuario,
};

// ============================================================
// CONSTANTES
// ============================================================

export const TIPOS_PARTICIPANTE = [
    "JUGADOR",
    "PROFESOR",
    "ENTRENADOR",
    "STAFF",
] as const;

export const ESTADOS_FORMULARIO = [
    "BORRADOR",
    "EN_REVISION",
    "APROBADO",
    "DENEGADO",
] as const;

export const ESTADOS_PLAZA = [
    "PENDIENTE",
    "CONFIRMADA",
    "LISTA_ESPERA",
    "SIN_PLAZA",
] as const;

export const ORIGENES_FORMULARIO = [
    "USUARIO",
    "ADMIN",
] as const;

export const TIPOS_ENTIDAD_OBSERVACION = [
    "FORMULARIO",
    "EQUIPO",
    "PARTICIPANTE",
] as const;

export const MAX_NOMBRE_EQUIPO =
    80;

export const MAX_NOMBRE_PERSONA =
    100;

export const MAX_APELLIDO =
    100;

export const MAX_EMAIL =
    254;

export const MAX_CURSO =
    100;

export const MAX_GRUPO =
    100;

export const MAX_ESCUDO =
    3_000_000;

export const MAX_NOTA_ADMIN =
    4000;

export const MAX_MENSAJE_OBSERVACION =
    2000;

export const MAX_CAMPO_OBSERVACION =
    120;

export const MAX_OBSERVACIONES =
    100;

export const MAX_PARTICIPANTES =
    100;

// ============================================================
// CAMPOS DB
// ============================================================

export const CAMPOS_FORMULARIO =
    "id,edicion_id,tipo,estado,origen,usuario_id,email_contacto,acceso_capitan,configuracion_snapshot,iniciado_at,enviado_at,completado_at,created_at,updated_at";

export const CAMPOS_EQUIPO =
    "id,formulario_id,nombre,escudo,capitan_id,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at,updated_at";

export const CAMPOS_PARTICIPANTE =
    "id,equipo_id,nombre,apellido1,apellido2,email,curso,grupo,genero,tipo_participante,validacion_estado,orden,activo,created_at,updated_at";

// ============================================================
// TIPOS ADMINISTRACIÓN
// ============================================================

export type EstadoPlaza =
    typeof ESTADOS_PLAZA[number];

export type OrigenFormulario =
    typeof ORIGENES_FORMULARIO[number];

export type TipoEntidadObservacion =
    typeof TIPOS_ENTIDAD_OBSERVACION[number];

export type AccionEquipos =
    | "ver"
    | "crear"
    | "editar"
    | "evaluar"
    | "canviar-estat"
    | "eliminar";

export type FormularioAdminDB =
    FormularioDB & {
        origen:
            string | null;
    };

export type TorneoDB = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    logo: string | null;
};

export type EdicionDB = {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
    estado: string | null;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
};

export type ResponsableDB = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    ano_academico: string | null;
    activa: boolean | null;
};

export type ObservacionDB = {
    id: string;
    edicion_id: string | null;
    formulario_id: string | null;
    entidad_tipo: string | null;
    entidad_id: string | null;
    campo: string | null;
    mensaje: string | null;
    estado: string | null;
    creada_por: string | null;
    resuelta_por: string | null;
    created_at: string | null;
};

export type ParticipanteEntradaAdmin =
    ParticipanteEntrada;

export type ResponsableEntradaAdmin = {
    email: string;
    vincular_usuario: boolean;
};

export type DatosEquipoAdmin = {
    nombre: string;
    escudo: string | null;
    capitan_email: string;
    nota_admin: string | null;
};

export type DatosEdicionAdmin = {
    responsable:
        ResponsableEntradaAdmin;

    acceso_capitan:
        boolean;

    equipo:
        DatosEquipoAdmin;

    participantes:
        ParticipanteEntradaAdmin[];
};

export type ObservacionEntradaAdmin = {
    entidad_tipo:
        TipoEntidadObservacion;

    entidad_id:
        string;

    campo:
        string;

    mensaje:
        string;
};

export type ContextoEquipoAdmin = {
    usuario: Usuario;
    torneo: TorneoDB;
    edicion: EdicionDB;
    equipo: EquipoDB;
    formulario: FormularioAdminDB;
};

// ============================================================
// RESPUESTAS
// ============================================================

export function responderErrorAdmin(
    error: unknown,
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
        "Error en la gestió administrativa d'equips:",
        error,
    );

    return responder(
        {
            success:
                false,

            mensaje:
                "No s'ha pogut completar l'operació.",
        },
        500,
    );
}

// ============================================================
// TEXTO
// ============================================================

export function leerTextoAdmin(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
) {
    if (
        valor ===
            undefined ||
        valor ===
            null
    ) {
        if (
            obligatorio
        ) {
            throw new ErrorAPI(
                400,
                `Falta el camp ${nombre}.`,
            );
        }

        return "";
    }

    if (
        typeof valor !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    const texto =
        valor.trim();

    if (
        obligatorio &&
        !texto
    ) {
        throw new ErrorAPI(
            400,
            `Falta el camp ${nombre}.`,
        );
    }

    if (
        texto.length >
        maximo
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} supera els ${maximo} caràcters.`,
        );
    }

    return texto;
}

// ============================================================
// UUID
// ============================================================

export function leerIDAdmin(
    valor: unknown,
    nombre: string,
) {
    if (
        typeof valor !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    return exigirUUID(
        valor
            .trim()
            .toLowerCase(),
        nombre,
    );
}

// ============================================================
// EMAIL
// ============================================================

export function emailValido(
    valor: string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        valor,
    );
}

export function emailPermitido(
    email: string,
    configuracion:
        ConfiguracionPlataforma,
) {
    const normalizado =
        normalizarEmail(
            email,
        );

    if (
        configuracion.emails.includes(
            normalizado,
        )
    ) {
        return true;
    }

    const posicion =
        normalizado.lastIndexOf(
            "@",
        );

    if (
        posicion <=
            0 ||
        posicion ===
            normalizado.length -
                1
    ) {
        return false;
    }

    const dominio =
        normalizado.slice(
            posicion + 1,
        );

    return configuracion
        .dominios
        .includes(
            dominio,
        );
}

export function validarEmailResponsable(
    email: string,
    configuracion:
        ConfiguracionPlataforma,
) {
    if (
        !email
    ) {
        return;
    }

    if (
        !emailValido(
            email,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del responsable no és vàlid.",
        );
    }

    if (
        !emailPermitido(
            email,
            configuracion,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del responsable no pertany als correus o dominis autoritzats.",
        );
    }
}

// ============================================================
// ESCUDO
// ============================================================

export function leerEscudoAdmin(
    valor: unknown,
) {
    if (
        valor ===
            undefined ||
        valor ===
            null ||
        valor ===
            ""
    ) {
        return null;
    }

    if (
        typeof valor !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            "L'escut no és vàlid.",
        );
    }

    if (
        valor.length >
        MAX_ESCUDO
    ) {
        throw new ErrorAPI(
            413,
            "L'escut és massa gran.",
        );
    }

    if (
        /^https?:\/\/.+/i.test(
            valor,
        )
    ) {
        return valor;
    }

    if (
        /^data:image\/(png|jpeg|webp|svg\+xml);base64,/i.test(
            valor,
        )
    ) {
        return valor;
    }

    throw new ErrorAPI(
        400,
        "El format de l'escut no és vàlid.",
    );
}

// ============================================================
// NORMALIZAR ESTADO FORMULARIO
// ============================================================

export function normalizarEstadoFormulario(
    valor: string | null,
): EstadoFormulario {
    const estado =
        valor
            ?.trim()
            .toUpperCase() ??
        "";

    if (
        ESTADOS_FORMULARIO.includes(
            estado as EstadoFormulario,
        )
    ) {
        return estado as EstadoFormulario;
    }

    return "BORRADOR";
}

// ============================================================
// NORMALIZAR ORIGEN FORMULARIO
// ============================================================

export function normalizarOrigenFormulario(
    valor: string | null,
): OrigenFormulario {
    const origen =
        valor
            ?.trim()
            .toUpperCase() ??
        "";

    if (
        ORIGENES_FORMULARIO.includes(
            origen as OrigenFormulario,
        )
    ) {
        return origen as OrigenFormulario;
    }

    /*
     * Por seguridad, cualquier registro antiguo o inesperado
     * se considera originado por usuario.
     *
     * Así nunca damos capacidades administrativas especiales
     * a un formulario cuyo origen no podamos demostrar.
     */
    return "USUARIO";
}

// ============================================================
// NORMALIZAR PLAZA
// ============================================================

export function normalizarEstadoPlaza(
    valor: string | null,
): EstadoPlaza {
    const estado =
        valor
            ?.trim()
            .toUpperCase() ??
        "";

    if (
        ESTADOS_PLAZA.includes(
            estado as EstadoPlaza,
        )
    ) {
        return estado as EstadoPlaza;
    }

    return "PENDIENTE";
}

// ============================================================
// NORMALIZAR TIPO PARTICIPANTE
// ============================================================

export function normalizarTipoParticipante(
    valor: string | null,
): TipoParticipante {
    const tipo =
        valor
            ?.trim()
            .toUpperCase() ??
        "";

    if (
        TIPOS_PARTICIPANTE.includes(
            tipo as TipoParticipante,
        )
    ) {
        return tipo as TipoParticipante;
    }

    return "JUGADOR";
}

// ============================================================
// NORMALIZAR VALIDACIÓN
// ============================================================

export function normalizarValidacion(
    valor: string | null,
) {
    return (
        valor
            ?.trim()
            .toUpperCase() ||
        "PENDIENTE"
    );
}

// ============================================================
// NOMBRE COMPLETO
// ============================================================

export function nombreCompleto(
    persona: {
        nombre: string | null;
        apellido1: string | null;
        apellido2: string | null;
    },
) {
    return [
        persona.nombre,
        persona.apellido1,
        persona.apellido2,
    ]
        .filter(
            (
                valor,
            ): valor is string =>
                typeof valor ===
                    "string" &&
                Boolean(
                    valor.trim(),
                ),
        )
        .map(
            valor =>
                valor.trim(),
        )
        .join(" ");
}

// ============================================================
// PERMISOS
// ============================================================

export function exigirAccesoPanelTorneo(
    usuario: Usuario,
    torneoID: string,
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
}

export function exigirPermisoEquip(
    usuario: Usuario,
    torneoID: string,
    accion: AccionEquipos,
) {
    exigirAccesoPanelTorneo(
        usuario,
        torneoID,
    );

    if (
        !tienePermiso(
            usuario,
            "equips",
            accion,
            torneoID,
        )
    ) {
        const mensajes:
            Record<
                AccionEquipos,
                string
            > = {
                ver:
                    "No tens permís per consultar els equips d'aquest torneig.",

                crear:
                    "No tens permís per crear equips en aquest torneig.",

                editar:
                    "No tens permís per modificar equips.",

                evaluar:
                    "No tens permís per avaluar inscripcions.",

                "canviar-estat":
                    "No tens permís per modificar l'estat de la plaça.",

                eliminar:
                    "No tens permís per retirar equips.",
            };

        throw new ErrorAPI(
            403,
            mensajes[
                accion
            ],
        );
    }
}

// ============================================================
// CAPACIDADES
// ============================================================

export function obtenerCapacidades(
    usuario: Usuario,
    torneoID: string,
) {
    return {
        crear:
            tienePermiso(
                usuario,
                "equips",
                "crear",
                torneoID,
            ),

        editar:
            tienePermiso(
                usuario,
                "equips",
                "editar",
                torneoID,
            ),

        evaluar:
            tienePermiso(
                usuario,
                "equips",
                "evaluar",
                torneoID,
            ),

        cambiarEstado:
            tienePermiso(
                usuario,
                "equips",
                "canviar-estat",
                torneoID,
            ),

        eliminar:
            tienePermiso(
                usuario,
                "equips",
                "eliminar",
                torneoID,
            ),
    };
}

// ============================================================
// TORNEO
// ============================================================

export async function obtenerTorneoAdmin(
    torneoID: string,
): Promise<TorneoDB> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "torneos",
            )
            .select(
                "id,nombre,deporte,logo",
            )
            .eq(
                "id",
                torneoID,
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
            404,
            "No s'ha trobat el torneig.",
        );
    }

    return data as TorneoDB;
}

// ============================================================
// EDICIÓN
// ============================================================

export async function obtenerEdicionAdmin(
    edicionID: string,
    torneoID: string,
): Promise<EdicionDB> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "ediciones",
            )
            .select(
                "id,torneo_id,nombre,estado,sede,fecha_inicio,fecha_fin",
            )
            .eq(
                "id",
                edicionID,
            )
            .eq(
                "torneo_id",
                torneoID,
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
            404,
            "No s'ha trobat l'edició o no pertany al torneig seleccionat.",
        );
    }

    return data as EdicionDB;
}

// ============================================================
// EQUIPO
// ============================================================

export async function obtenerEquipoAdmin(
    equipoID: string,
): Promise<EquipoDB> {
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
            .eq(
                "id",
                equipoID,
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
            404,
            "No s'ha trobat l'equip.",
        );
    }

    return data as EquipoDB;
}

// ============================================================
// FORMULARIO
// ============================================================

export async function obtenerFormularioAdmin(
    formularioID: string,
    edicionID: string,
): Promise<FormularioAdminDB> {
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
                "id",
                formularioID,
            )
            .eq(
                "edicion_id",
                edicionID,
            )
            .eq(
                "tipo",
                "EQUIPO",
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
            404,
            "L'equip no pertany a aquesta edició.",
        );
    }

    return data as FormularioAdminDB;
}

// ============================================================
// PARTICIPANTES
// ============================================================

export async function obtenerParticipantesAdmin(
    equipoID: string,
): Promise<ParticipanteDB[]> {
    return obtenerParticipantes(
        equipoID,
    );
}

// ============================================================
// RESPONSABLE
// ============================================================

export async function obtenerResponsableAdmin(
    usuarioID: string | null,
): Promise<ResponsableDB | null> {
    if (
        !usuarioID
    ) {
        return null;
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
                "id,nombre,apellido1,apellido2,email,curso,ano_academico,activa",
            )
            .eq(
                "id",
                usuarioID,
            )
            .maybeSingle();

    if (
        error
    ) {
        throw error;
    }

    return (
        data as
            | ResponsableDB
            | null
    );
}

// ============================================================
// CONFIGURACIÓN FORMULARIO
// ============================================================

export async function obtenerConfiguracionFormularioAdmin(
    formulario: FormularioAdminDB,
): Promise<ConfiguracionEquipos> {
    const actual =
        await obtenerConfiguracionEdicion(
            formulario.edicion_id,
        );

    if (
        !actual
    ) {
        throw new ErrorAPI(
            409,
            "Aquesta edició no té configurada la inscripció d'equips.",
        );
    }

    /*
     * FormularioAdminDB extiende FormularioDB, por tanto es
     * compatible directamente con configuracionFormulario().
     */
    return configuracionFormulario(
        formulario,
        actual,
    );
}

// ============================================================
// CONFIGURACIÓN PLATAFORMA
// ============================================================

export async function obtenerConfiguracionPlataformaAdmin():
    Promise<ConfiguracionPlataforma> {
    return obtenerConfiguracionPlataforma();
}

// ============================================================
// OBSERVACIONES
// ============================================================

export async function obtenerObservacionesAdmin(
    formularioID: string,
): Promise<ObservacionDB[]> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "observaciones_campos",
            )
            .select(
                "id,edicion_id,formulario_id,entidad_tipo,entidad_id,campo,mensaje,estado,creada_por,resuelta_por,created_at",
            )
            .eq(
                "formulario_id",
                formularioID,
            )
            .order(
                "created_at",
                {
                    ascending:
                        true,
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
    ) as ObservacionDB[];
}

export async function resolverObservacionesPendientes(
    formularioID: string,
    usuarioID: string,
) {
    const observaciones =
        await obtenerObservacionesAdmin(
            formularioID,
        );

    const ids =
        observaciones
            .filter(
                observacion =>
                    (
                        observacion.estado ??
                        ""
                    )
                        .trim()
                        .toUpperCase() !==
                    "RESUELTA",
            )
            .map(
                observacion =>
                    observacion.id,
            );

    if (
        ids.length ===
        0
    ) {
        return;
    }

    const {
        error,
    } =
        await supabaseAdmin
            .from(
                "observaciones_campos",
            )
            .update({
                estado:
                    "RESUELTA",

                resuelta_por:
                    usuarioID,
            })
            .in(
                "id",
                ids,
            );

    if (
        error
    ) {
        throw error;
    }
}

// ============================================================
// RESPONSABLE · RESOLUCIÓN
// ============================================================

export async function resolverResponsableAdmin(
    edicionID: string,
    formularioActualID: string | null,
    responsable:
        ResponsableEntradaAdmin,
) {
    const email =
        normalizarEmail(
            responsable.email,
        );

    if (
        !email
    ) {
        return {
            usuario_id:
                null,

            email_contacto:
                null,
        };
    }

    if (
        !responsable
            .vincular_usuario
    ) {
        return {
            usuario_id:
                null,

            email_contacto:
                email,
        };
    }

    const {
        data:
            usuarios,

        error:
            errorUsuario,
    } =
        await supabaseAdmin
            .from(
                "users",
            )
            .select(
                "id,email,activa",
            )
            .ilike(
                "email",
                email,
            )
            .limit(
                2,
            );

    if (
        errorUsuario
    ) {
        throw errorUsuario;
    }

    if (
        !usuarios ||
        usuarios.length !==
            1
    ) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat un únic usuari amb el correu indicat.",
        );
    }

    const usuario =
        usuarios[0];

    if (
        usuario.activa ===
        false
    ) {
        throw new ErrorAPI(
            409,
            "L'usuari seleccionat està bloquejat.",
        );
    }

    const {
        data:
            formularios,

        error:
            errorFormulario,
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
            .eq(
                "usuario_id",
                usuario.id,
            );

    if (
        errorFormulario
    ) {
        throw errorFormulario;
    }

    const conflicto =
        (
            formularios ??
            []
        ).some(
            formulario =>
                formulario.id !==
                formularioActualID,
        );

    if (
        conflicto
    ) {
        throw new ErrorAPI(
            409,
            "Aquest usuari ja és responsable d'una altra inscripció d'equip en aquesta edició.",
        );
    }

    return {
        usuario_id:
            usuario.id,

        email_contacto:
            normalizarEmail(
                usuario.email ??
                email,
            ),
    };
}

// ============================================================
// VERSIONADO
// ============================================================

export function exigirMismaVersion(
    actual: string | null,
    recibida: unknown,
    entidad: string,
) {
    if (
        typeof recibida !==
            "string" ||
        !recibida.trim()
    ) {
        throw new ErrorAPI(
            400,
            `Falta la versió de ${entidad}.`,
        );
    }

    if (
        !actual ||
        actual !==
            recibida.trim()
    ) {
        throw new ErrorAPI(
            409,
            `${entidad} ha canviat des que l'has carregat. Actualitza la fitxa abans de continuar.`,
        );
    }
}

// ============================================================
// ESTADO EVALUABLE
// ============================================================

export function exigirFormularioEnRevision(
    formulario: FormularioAdminDB,
) {
    const estado =
        normalizarEstadoFormulario(
            formulario.estado,
        );

    if (
        estado ===
        "BORRADOR"
    ) {
        throw new ErrorAPI(
            409,
            "Aquest formulari encara és un esborrany i no es pot avaluar fins que s'hagi enviat.",
        );
    }

    if (
        estado !==
        "EN_REVISION"
    ) {
        throw new ErrorAPI(
            409,
            estado ===
                "APROBADO"
                ? "Aquesta inscripció ja està aprovada."
                : "Aquesta inscripció ja està pendent de correccions.",
        );
    }
}

// ============================================================
// BORRADOR ADMINISTRATIVO
// ============================================================

export function esBorradorAdministrativo(
    formulario:
        FormularioAdminDB,
) {
    return (
        normalizarEstadoFormulario(
            formulario.estado,
        ) ===
            "BORRADOR" &&
        normalizarOrigenFormulario(
            formulario.origen,
        ) ===
            "ADMIN"
    );
}

// ============================================================
// PARTICIPANTE DE SALIDA
// ============================================================

export function prepararParticipanteSalida(
    participante:
        ParticipanteDB,
    capitanID:
        string | null,
) {
    return {
        id:
            participante.id,

        tipo_participante:
            normalizarTipoParticipante(
                participante.tipo_participante,
            ),

        nombre:
            participante.nombre ??
            "",

        apellido1:
            participante.apellido1 ??
            "",

        apellido2:
            participante.apellido2 ??
            "",

        nombre_completo:
            nombreCompleto(
                participante,
            ),

        email:
            participante.email ??
            "",

        curso:
            participante.curso ??
            "",

        grupo:
            participante.grupo ??
            "",

        genero:
            participante.genero ===
                "masculino" ||
            participante.genero ===
                "femenino"
                ? participante.genero
                : null,

        validacion_estado:
            normalizarValidacion(
                participante.validacion_estado,
            ),

        orden:
            participante.orden ??
            0,

        es_capitan:
            participante.id ===
            capitanID,

        created_at:
            participante.created_at,

        updated_at:
            participante.updated_at,
    };
}

// ============================================================
// CONTEXTO COMPLETO DE EQUIPO
// ============================================================

export async function obtenerContextoEquipoAdmin({
    cookies,
    equipoID,
    torneoID,
    edicionID,
    accion,
}: {
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

    accion:
        AccionEquipos;
}): Promise<ContextoEquipoAdmin> {
    const usuario =
        await exigirUsuario(
            cookies,
        );

    exigirPermisoEquip(
        usuario,
        torneoID,
        accion,
    );

    const [
        torneo,
        edicion,
        equipo,
    ] =
        await Promise.all([
            obtenerTorneoAdmin(
                torneoID,
            ),

            obtenerEdicionAdmin(
                edicionID,
                torneoID,
            ),

            obtenerEquipoAdmin(
                equipoID,
            ),
        ]);

    const formulario =
        await obtenerFormularioAdmin(
            equipo.formulario_id,
            edicionID,
        );

    return {
        usuario,
        torneo,
        edicion,
        equipo,
        formulario,
    };
}

// ============================================================
// REEXPORTS DE HELPERS BASE
// ============================================================

export {
    ErrorAPI,
    esRegistro,
    normalizarEmail,
    responder,
};