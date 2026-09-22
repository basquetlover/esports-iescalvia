import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { NIVELES_ROL, obtenerNivelRol } from "@const/Permisos";

// ============================================================
// CONSTANTES
// ============================================================

export const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_JSON_BYTES = 4_000_000;
const MAX_PARTICIPANTES = 100;
const MAX_NOMBRE_EQUIPO = 80;
const MAX_NOMBRE_PERSONA = 100;
const MAX_APELLIDO = 100;
const MAX_EMAIL = 254;
const MAX_CURSO = 100;
const MAX_GRUPO = 100;
const MAX_ESCUDO = 3_000_000;

const TIPOS_PARTICIPANTE = [
    "JUGADOR",
    "PROFESOR",
    "ENTRENADOR",
    "STAFF",
] as const;

const ESTADOS_FORMULARIO = [
    "BORRADOR",
    "EN_REVISION",
    "APROBADO",
    "DENEGADO",
] as const;

// ============================================================
// CAMPOS DB
// ============================================================

export const CAMPOS_FORMULARIO =
    "id,edicion_id,tipo,estado,usuario_id,email_contacto,acceso_capitan,configuracion_snapshot,iniciado_at,enviado_at,completado_at,created_at,updated_at";

const CAMPOS_EQUIPO =
    "id,formulario_id,nombre,escudo,capitan_id,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at,updated_at";

const CAMPOS_PARTICIPANTE =
    "id,equipo_id,nombre,apellido1,apellido2,email,curso,grupo,genero,tipo_participante,validacion_estado,orden,activo,created_at,updated_at";

// ============================================================
// TIPOS
// ============================================================

export type Registro = Record<string, unknown>;

export type TipoParticipante =
    typeof TIPOS_PARTICIPANTE[number];

export type EstadoFormulario =
    typeof ESTADOS_FORMULARIO[number];

export type Genero =
    | "masculino"
    | "femenino";

export type Usuario =
    NonNullable<
        Awaited<
            ReturnType<
                typeof obtenerUsuarioPorToken
            >
        >
    >;

export type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

export type ConfiguracionEquipos = {
    inscripcion: {
        apertura: string | null;
        cierre: string | null;
    };

    cupo: {
        maximo: number | null;
        al_superar:
            | "permitir"
            | "lista_espera"
            | "bloquear";
    };

    cursos: CursoConfiguracion[];

    jugadores: {
        minimo: number | null;
        maximo: number | null;
    };

    genero: {
        activo: boolean;

        minimos: {
            masculino: number;
            femenino: number;
        };
    };

    profesores: {
        permitidos: boolean;
        minimo: number;
        maximo: number;
        cuentan_como_jugador: boolean;
    };

    entrenador: {
        permitido: boolean;
    };

    staff: {
        permitido: boolean;
        minimo: number;
        maximo: number;
    };
};

export type ConfiguracionPlataforma = {
    admin_mode: boolean;
    emails: string[];
    dominios: string[];
};

export type TorneoFormulario = {
    id: string;
    nombre: string;
    deporte: string | null;
    logo: string | null;
    banner: string | null;
};

export type ParticipanteEntrada = {
    id: string | null;

    tipo_participante:
        TipoParticipante;

    nombre: string;
    apellido1: string;
    apellido2: string;
    email: string;
    curso: string;
    grupo: string;
    genero: Genero | null;
    orden: number;
};

export type EquipoEntrada = {
    id: string | null;
    nombre: string;
    escudo: string | null;
    capitan_id: string | null;
};

export type DatosEntrada = {
    acceso_capitan: boolean;
    equipo: EquipoEntrada;
    participantes: ParticipanteEntrada[];
};

export type FormularioDB = {
    id: string;
    edicion_id: string;
    tipo: string | null;
    estado: string | null;
    usuario_id: string | null;
    email_contacto: string | null;
    acceso_capitan: boolean | null;
    configuracion_snapshot: unknown;
    iniciado_at: string | null;
    enviado_at: string | null;
    completado_at: string | null;
    created_at: string;
    updated_at: string;
};

export type EquipoDB = {
    id: string;
    formulario_id: string;
    nombre: string | null;
    escudo: string | null;
    capitan_id: string | null;
    validacion_estado: string | null;
    plaza_estado: string | null;
    posicion_lista_espera: number | null;
    nota_admin: string | null;
    created_at: string;
    updated_at: string;
};

export type ParticipanteDB = {
    id: string;
    equipo_id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    grupo: string | null;
    genero: string | null;
    tipo_participante: string | null;
    validacion_estado: string | null;
    orden: number | null;
    activo: boolean;
    created_at: string;
    updated_at: string;
};

export type AccesoFormulario = {
    formulario: FormularioDB;
    equipo: EquipoDB | null;

    propietario: boolean;
    capitan: boolean;

    puede_ver: boolean;
    puede_editar: boolean;
    puede_cambiar_acceso_capitan: boolean;
};

// ============================================================
// ERROR API
// ============================================================

export class ErrorAPI extends Error {
    constructor(
        public estado: number,
        mensaje: string,
    ) {
        super(mensaje);

        this.name = "ErrorAPI";
    }
}

// ============================================================
// RESPUESTAS
// ============================================================

export function responder(
    datos: unknown,
    estado = 200,
) {
    return Response.json(
        datos,
        {
            status: estado,

            headers: {
                "Cache-Control":
                    "private, no-store",
            },
        },
    );
}

export function responderError(
    error: unknown,
) {
    if (
        error instanceof
        ErrorAPI
    ) {
        return responder(
            {
                success: false,
                mensaje: error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error en la inscripció d'equips:",
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

// ============================================================
// HELPERS
// ============================================================

export function esRegistro(
    valor: unknown,
): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function texto(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
) {
    if (
        valor === undefined ||
        valor === null
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

    const resultado =
        valor.trim();

    if (
        resultado.length >
        maximo
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} supera els ${maximo} caràcters.`,
        );
    }

    if (
        obligatorio &&
        !resultado
    ) {
        throw new ErrorAPI(
            400,
            `Falta el camp ${nombre}.`,
        );
    }

    return resultado;
}

function numeroONull(
    valor: unknown,
) {
    return (
        typeof valor === "number" &&
        Number.isFinite(valor)
    )
        ? valor
        : null;
}

function numero(
    valor: unknown,
    defecto = 0,
) {
    return (
        typeof valor === "number" &&
        Number.isFinite(valor)
    )
        ? valor
        : defecto;
}

function textoONull(
    valor: unknown,
) {
    return typeof valor ===
        "string"
        ? valor
        : null;
}

export function normalizarEmail(
    valor: string,
) {
    return valor
        .trim()
        .toLowerCase();
}

function emailValido(
    valor: string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        valor,
    );
}

export function estadoFormulario(
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

function normalizarEstadoEdicion(
    estado: string | null,
) {
    return estado
        ?.trim()
        .toUpperCase() ??
        "";
}

export function edicionActiva(
    estado: string | null,
) {
    const normalizado =
        normalizarEstadoEdicion(
            estado,
        );

    return (
        normalizado ===
            "ACTIVA" ||
        normalizado ===
            "ACTIVO" ||
        normalizado ===
            "ACTIU"
    );
}

function fecha(
    valor: string | null,
) {
    if (
        !valor
    ) {
        return null;
    }

    const resultado =
        new Date(valor);

    return Number.isNaN(
        resultado.getTime(),
    )
        ? null
        : resultado;
}

export function exigirUUID(
    valor: unknown,
    nombre: string,
) {
    if (
        typeof valor !==
            "string" ||
        !UUID.test(valor)
    ) {
        throw new ErrorAPI(
            400,
            `L'identificador ${nombre} no és vàlid.`,
        );
    }

    return valor;
}

// ============================================================
// PETICIÓN
// ============================================================

export async function leerJSON(
    request: Request,
): Promise<Registro> {
    const longitud =
        Number(
            request.headers.get(
                "content-length",
            ) ||
            0,
        );

    if (
        longitud >
        MAX_JSON_BYTES
    ) {
        throw new ErrorAPI(
            413,
            "La petició és massa gran.",
        );
    }

    const contenido =
        await request.text();

    if (
        Buffer.byteLength(
            contenido,
            "utf8",
        ) >
        MAX_JSON_BYTES
    ) {
        throw new ErrorAPI(
            413,
            "La petició és massa gran.",
        );
    }

    let resultado:
        unknown;

    try {
        resultado =
            JSON.parse(
                contenido,
            );
    } catch {
        throw new ErrorAPI(
            400,
            "La petició no conté un JSON vàlid.",
        );
    }

    if (
        !esRegistro(
            resultado,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La petició no és vàlida.",
        );
    }

    return resultado;
}

export function comprobarOrigen(
    request: Request,
    url: URL,
) {
    const origen =
        request.headers.get(
            "origin",
        );

    if (
        origen &&
        origen !==
            url.origin
    ) {
        throw new ErrorAPI(
            403,
            "Origen de la petició no permès.",
        );
    }
}

// ============================================================
// SESIÓN
// ============================================================

export async function obtenerUsuario(
    cookies:
        Parameters<APIRoute>[0]["cookies"],
) {
    const token =
        cookies.get(
            "token_sesion",
        )?.value;

    if (
        !token
    ) {
        return null;
    }

    return obtenerUsuarioPorToken(
        token,
    );
}

export async function exigirUsuario(
    cookies:
        Parameters<APIRoute>[0]["cookies"],
) {
    const usuario =
        await obtenerUsuario(
            cookies,
        );

    if (
        !usuario
    ) {
        cookies.delete(
            "token_sesion",
            {
                path: "/",
            },
        );

        throw new ErrorAPI(
            401,
            "Has d'iniciar sessió.",
        );
    }

    return usuario;
}

// ============================================================
// ADMIN MODE
// ============================================================

function esAdministrador(
    usuario: Usuario | null,
) {
    if (
        !usuario
    ) {
        return false;
    }

    return (
        obtenerNivelRol(
            usuario.rol,
        ) >=
        NIVELES_ROL.admin
    );
}

export function puedeIgnorarPeriodo(
    usuario: Usuario | null,
    configuracion:
        ConfiguracionPlataforma,
) {
    return (
        configuracion.admin_mode ===
            true &&
        esAdministrador(
            usuario,
        )
    );
}

// ============================================================
// CONFIGURACIÓN DE EDICIÓN
// ============================================================

function normalizarCursos(
    valor: unknown,
): CursoConfiguracion[] {
    if (
        !Array.isArray(
            valor,
        )
    ) {
        return [];
    }

    return valor
        .filter(
            esRegistro,
        )
        .map(
            entrada => ({
                curso:
                    typeof entrada.curso ===
                        "string"
                        ? entrada.curso.trim()
                        : "",

                grupos:
                    Array.isArray(
                        entrada.grupos,
                    )
                        ? entrada.grupos
                              .filter(
                                  (
                                      grupo,
                                  ): grupo is string =>
                                      typeof grupo ===
                                      "string",
                              )
                              .map(
                                  grupo =>
                                      grupo.trim(),
                              )
                              .filter(
                                  Boolean,
                              )
                        : [],
            }),
        )
        .filter(
            entrada =>
                Boolean(
                    entrada.curso,
                ),
        );
}

export function normalizarConfiguracionEquipos(
    valor: unknown,
): ConfiguracionEquipos | null {
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

    const genero =
        esRegistro(
            valor.genero,
        )
            ? valor.genero
            : {};

    const minimosGenero =
        esRegistro(
            genero.minimos,
        )
            ? genero.minimos
            : {};

    const profesores =
        esRegistro(
            valor.profesores,
        )
            ? valor.profesores
            : {};

    const entrenador =
        esRegistro(
            valor.entrenador,
        )
            ? valor.entrenador
            : {};

    const staff =
        esRegistro(
            valor.staff,
        )
            ? valor.staff
            : {};

    const comportamiento =
        cupo.al_superar;

    return {
        inscripcion: {
            apertura:
                textoONull(
                    inscripcion.apertura,
                ),

            cierre:
                textoONull(
                    inscripcion.cierre,
                ),
        },

        cupo: {
            maximo:
                numeroONull(
                    cupo.maximo,
                ),

            al_superar:
                comportamiento ===
                    "lista_espera" ||
                comportamiento ===
                    "bloquear"
                    ? comportamiento
                    : "permitir",
        },

        cursos:
            normalizarCursos(
                valor.cursos,
            ),

        jugadores: {
            minimo:
                numeroONull(
                    jugadores.minimo,
                ),

            maximo:
                numeroONull(
                    jugadores.maximo,
                ),
        },

        genero: {
            activo:
                genero.activo ===
                true,

            minimos: {
                masculino:
                    numero(
                        minimosGenero.masculino,
                    ),

                femenino:
                    numero(
                        minimosGenero.femenino,
                    ),
            },
        },

        profesores: {
            permitidos:
                profesores.permitidos ===
                true,

            minimo:
                numero(
                    profesores.minimo,
                ),

            maximo:
                numero(
                    profesores.maximo,
                ),

            cuentan_como_jugador:
                profesores.cuentan_como_jugador !==
                false,
        },

        entrenador: {
            permitido:
                entrenador.permitido ===
                true,
        },

        staff: {
            permitido:
                staff.permitido ===
                true,

            minimo:
                numero(
                    staff.minimo,
                ),

            maximo:
                numero(
                    staff.maximo,
                ),
        },
    };
}

// ============================================================
// CONFIGURACIÓN PLATAFORMA
// ============================================================

function listaTexto(
    valor: unknown,
) {
    if (
        !Array.isArray(
            valor,
        )
    ) {
        return [];
    }

    return [
        ...new Set(
            valor
                .filter(
                    (
                        entrada,
                    ): entrada is string =>
                        typeof entrada ===
                        "string",
                )
                .map(
                    entrada =>
                        entrada
                            .trim()
                            .toLowerCase(),
                )
                .filter(
                    Boolean,
                ),
        ),
    ];
}

export async function obtenerConfiguracionPlataforma():
    Promise<ConfiguracionPlataforma> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "configuracion_plataforma",
            )
            .select(
                "admin_mode,emails_registro_permitidos,dominios_registro_permitidos,created_at",
            )
            .order(
                "created_at",
                {
                    ascending: true,
                    nullsFirst: false,
                },
            )
            .limit(
                1,
            );

    if (
        error
    ) {
        throw error;
    }

    const fila =
        data?.[0];

    if (
        !fila
    ) {
        return {
            admin_mode: false,
            emails: [],
            dominios: [],
        };
    }

    return {
        admin_mode:
            fila.admin_mode ===
            true,

        emails:
            listaTexto(
                fila.emails_registro_permitidos,
            ),

        dominios:
            listaTexto(
                fila.dominios_registro_permitidos,
            ).map(
                dominio =>
                    dominio.replace(
                        /^@+/,
                        "",
                    ),
            ),
    };
}

function emailPermitido(
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
        posicion <= 0 ||
        posicion ===
            normalizado.length -
                1
    ) {
        return false;
    }

    const dominio =
        normalizado.slice(
            posicion +
                1,
        );

    return configuracion.dominios.includes(
        dominio,
    );
}

export function obtenerEmailCreador(
    usuario: Usuario,
    configuracion:
        ConfiguracionPlataforma,
) {
    const email =
        normalizarEmail(
            usuario.email ??
            "",
        );

    if (
        !email ||
        !emailValido(
            email,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El teu compte no té un correu electrònic vàlid associat.",
        );
    }

    if (
        !emailPermitido(
            email,
            configuracion,
        )
    ) {
        throw new ErrorAPI(
            403,
            "El correu del teu compte no pertany a un domini autoritzat.",
        );
    }

    return email;
}

// ============================================================
// EDICIÓN
// ============================================================

export async function obtenerEdicion(
    edicionID: string,
) {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "ediciones",
            )
            .select(
                "id,torneo_id,nombre,fecha_inicio,fecha_fin,estado,sede",
            )
            .eq(
                "id",
                edicionID,
            )
            .maybeSingle();

    if (
        error
    ) {
        throw error;
    }

    return data;
}

export async function obtenerConfiguracionEdicion(
    edicionID: string,
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
                "equipos",
            )
            .eq(
                "edicion_id",
                edicionID,
            )
            .maybeSingle();

    if (
        error
    ) {
        throw error;
    }

    return normalizarConfiguracionEquipos(
        data?.equipos,
    );
}

// ============================================================
// TORNEO
// ============================================================

export async function obtenerTorneo(
    torneoID: string | null,
): Promise<TorneoFormulario | null> {
    if (
        !torneoID ||
        !UUID.test(
            torneoID,
        )
    ) {
        return null;
    }

    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "torneos",
            )
            .select(
                "id,nombre,deporte,logo,banner,activo",
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
        error
    ) {
        throw error;
    }

    if (
        !data
    ) {
        return null;
    }

    return {
        id:
            data.id,

        nombre:
            data.nombre ??
            "Torneig",

        deporte:
            data.deporte ??
            null,

        logo:
            data.logo ??
            null,

        banner:
            data.banner ??
            null,
    };
}

// ============================================================
// PERÍODO
// ============================================================

export function estadoPeriodo(
    configuracion:
        ConfiguracionEquipos,
) {
    const apertura =
        fecha(
            configuracion
                .inscripcion
                .apertura,
        );

    const cierre =
        fecha(
            configuracion
                .inscripcion
                .cierre,
        );

    if (
        !apertura ||
        !cierre
    ) {
        return "SIN_CONFIGURACION" as const;
    }

    const ahora =
        Date.now();

    if (
        ahora <
        apertura.getTime()
    ) {
        return "PROXIMAMENTE" as const;
    }

    if (
        ahora >
        cierre.getTime()
    ) {
        return "TANCADA" as const;
    }

    return "ABIERTA" as const;
}

function periodoPermitido(
    configuracionEdicion:
        ConfiguracionEquipos,
    usuario: Usuario | null,
    configuracionPlataforma:
        ConfiguracionPlataforma,
) {
    const estado =
        estadoPeriodo(
            configuracionEdicion,
        );

    if (
        estado ===
        "ABIERTA"
    ) {
        return true;
    }

    if (
        puedeIgnorarPeriodo(
            usuario,
            configuracionPlataforma,
        ) &&
        (
            estado ===
                "PROXIMAMENTE" ||
            estado ===
                "TANCADA"
        )
    ) {
        return true;
    }

    return false;
}

// ============================================================
// EDICIONES DISPONIBLES
// ============================================================

export async function obtenerEdicionesDisponibles(
    usuario: Usuario | null,
    configuracionPlataforma:
        ConfiguracionPlataforma,
) {
    const {
        data:
            edicionesData,

        error:
            errorEdiciones,
    } =
        await supabaseAdmin
            .from(
                "ediciones",
            )
            .select(
                "id,torneo_id,nombre,estado",
            );

    if (
        errorEdiciones
    ) {
        throw errorEdiciones;
    }

    const ediciones =
        (
            edicionesData ??
            []
        ).filter(
            edicion =>
                edicionActiva(
                    edicion.estado,
                ),
        );

    if (
        ediciones.length ===
        0
    ) {
        return [];
    }

    const idsEdiciones =
        ediciones.map(
            edicion =>
                edicion.id,
        );

    const {
        data:
            configuraciones,

        error:
            errorConfiguraciones,
    } =
        await supabaseAdmin
            .from(
                "configuracion_ediciones",
            )
            .select(
                "edicion_id,equipos",
            )
            .in(
                "edicion_id",
                idsEdiciones,
            );

    if (
        errorConfiguraciones
    ) {
        throw errorConfiguraciones;
    }

    const configuracionPorEdicion =
        new Map(
            (
                configuraciones ??
                []
            ).map(
                configuracion => [
                    configuracion.edicion_id,

                    normalizarConfiguracionEquipos(
                        configuracion.equipos,
                    ),
                ],
            ),
        );

    const candidatas =
        ediciones
            .map(
                edicion => {
                    const configuracion =
                        configuracionPorEdicion.get(
                            edicion.id,
                        ) ??
                        null;

                    if (
                        !configuracion
                    ) {
                        return null;
                    }

                    if (
                        !periodoPermitido(
                            configuracion,
                            usuario,
                            configuracionPlataforma,
                        )
                    ) {
                        return null;
                    }

                    return {
                        edicion,
                        configuracion,
                    };
                },
            )
            .filter(
                (
                    entrada,
                ): entrada is NonNullable<typeof entrada> =>
                    entrada !==
                    null,
            );

    if (
        candidatas.length ===
        0
    ) {
        return [];
    }

    const idsTorneos = [
        ...new Set(
            candidatas
                .map(
                    entrada =>
                        entrada.edicion
                            .torneo_id,
                )
                .filter(
                    (
                        id,
                    ): id is string =>
                        typeof id ===
                            "string" &&
                        UUID.test(
                            id,
                        ),
                ),
        ),
    ];

    if (
        idsTorneos.length ===
        0
    ) {
        return [];
    }

    const {
        data:
            torneos,

        error:
            errorTorneos,
    } =
        await supabaseAdmin
            .from(
                "torneos",
            )
            .select(
                "id,nombre,deporte,logo,banner,activo",
            )
            .in(
                "id",
                idsTorneos,
            )
            .eq(
                "activo",
                true,
            );

    if (
        errorTorneos
    ) {
        throw errorTorneos;
    }

    const torneoPorID =
        new Map<
            string,
            TorneoFormulario
        >(
            (
                torneos ??
                []
            ).map(
                torneo => [
                    torneo.id,

                    {
                        id:
                            torneo.id,

                        nombre:
                            torneo.nombre ??
                            "Torneig",

                        deporte:
                            torneo.deporte ??
                            null,

                        logo:
                            torneo.logo ??
                            null,

                        banner:
                            torneo.banner ??
                            null,
                    },
                ],
            ),
        );

    return candidatas
        .map(
            entrada => {
                const torneo =
                    torneoPorID.get(
                        entrada.edicion
                            .torneo_id,
                    );

                if (
                    !torneo
                ) {
                    return null;
                }

                return {
                    id:
                        entrada.edicion.id,

                    nombre:
                        entrada.edicion.nombre ??
                        "Edició",

                    torneo,

                    apertura:
                        entrada
                            .configuracion
                            .inscripcion
                            .apertura,

                    cierre:
                        entrada
                            .configuracion
                            .inscripcion
                            .cierre,
                };
            },
        )
        .filter(
            (
                entrada,
            ): entrada is NonNullable<typeof entrada> =>
                entrada !==
                null,
        );
}

// ============================================================
// EQUIPO
// ============================================================

export async function obtenerEquipoFormulario(
    formularioID: string,
): Promise<EquipoDB | null> {
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
                "formulario_id",
                formularioID,
            )
            .limit(
                1,
            );

    if (
        error
    ) {
        throw error;
    }

    return (
        data?.[0] as
            | EquipoDB
            | undefined
    ) ??
        null;
}

// ============================================================
// PARTICIPANTES
// ============================================================

export async function obtenerParticipantes(
    equipoID: string,
): Promise<ParticipanteDB[]> {
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
            .eq(
                "equipo_id",
                equipoID,
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
// OBSERVACIONES
// ============================================================

async function obtenerObservaciones(
    formularioID: string,
) {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                "observaciones_campos",
            )
            .select(
                "id,entidad_tipo,entidad_id,campo,mensaje,estado,created_at",
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
    )
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
            observacion => ({
                id:
                    observacion.id,

                entidad_tipo:
                    observacion.entidad_tipo ??
                    "",

                entidad_id:
                    observacion.entidad_id ??
                    "",

                campo:
                    observacion.campo ??
                    "",

                mensaje:
                    observacion.mensaje ??
                    "",

                estado:
                    observacion.estado ??
                    "",
            }),
        );
}

// ============================================================
// SALIDA PARTICIPANTE
// ============================================================

function normalizarParticipanteSalida(
    participante:
        ParticipanteDB,
) {
    const genero =
        participante.genero ===
            "masculino" ||
        participante.genero ===
            "femenino"
            ? participante.genero
            : null;

    const tipo =
        TIPOS_PARTICIPANTE.includes(
            participante.tipo_participante as TipoParticipante,
        )
            ? participante.tipo_participante as TipoParticipante
            : "JUGADOR";

    return {
        id:
            participante.id,

        tipo_participante:
            tipo,

        nombre:
            participante.nombre ??
            "",

        apellido1:
            participante.apellido1 ??
            "",

        apellido2:
            participante.apellido2 ??
            "",

        email:
            participante.email ??
            "",

        curso:
            participante.curso ??
            "",

        grupo:
            participante.grupo ??
            "",

        genero,

        orden:
            participante.orden ??
            0,
    };
}

// ============================================================
// FORMULARIO COMPLETO
// ============================================================

export async function cargarFormularioCompleto(
    formulario:
        FormularioDB,
) {
    const equipo =
        await obtenerEquipoFormulario(
            formulario.id,
        );

    const participantes =
        equipo
            ? await obtenerParticipantes(
                  equipo.id,
              )
            : [];

    const observaciones =
        await obtenerObservaciones(
            formulario.id,
        );

    return {
        id:
            formulario.id,

        estado:
            estadoFormulario(
                formulario.estado,
            ),

        usuario_id:
            formulario.usuario_id,

        email_contacto:
            formulario.email_contacto ??
            "",

        acceso_capitan:
            formulario.acceso_capitan ===
            true,

        equipo: {
            id:
                equipo?.id ??
                null,

            nombre:
                equipo?.nombre ??
                "",

            escudo:
                equipo?.escudo ??
                null,

            capitan_id:
                equipo?.capitan_id ??
                null,

            plaza_estado:
                (
                    equipo?.plaza_estado ??
                    "PENDIENTE"
                ) as
                    | "PENDIENTE"
                    | "CONFIRMADA"
                    | "LISTA_ESPERA"
                    | "SIN_PLAZA",

            posicion_lista_espera:
                equipo?.posicion_lista_espera ??
                null,
        },

        participantes:
            participantes.map(
                normalizarParticipanteSalida,
            ),

        observaciones,
    };
}

// ============================================================
// FORMULARIO DEL PROPIETARIO
// ============================================================

export async function obtenerFormularioPropietario(
    edicionID: string,
    usuarioID: string,
): Promise<FormularioDB | null> {
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
                "usuario_id",
                usuarioID,
            )
            .eq(
                "tipo",
                "EQUIPO",
            )
            .order(
                "created_at",
                {
                    ascending:
                        true,
                },
            )
            .limit(
                1,
            );

    if (
        error
    ) {
        throw error;
    }

    return (
        data?.[0] as
            | FormularioDB
            | undefined
    ) ??
        null;
}

// ============================================================
// FORMULARIO COMO CAPITÁN
// ============================================================

export async function obtenerFormularioComoCapitan(
    edicionID: string,
    usuario: Usuario,
): Promise<FormularioDB | null> {
    const emailUsuario =
        normalizarEmail(
            usuario.email ??
            "",
        );

    if (
        !emailUsuario
    ) {
        return null;
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
            .eq(
                "acceso_capitan",
                true,
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
        return null;
    }

    const idsFormularios =
        formularios.map(
            formulario =>
                formulario.id,
        );

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
                "id,formulario_id,capitan_id",
            )
            .in(
                "formulario_id",
                idsFormularios,
            )
            .not(
                "capitan_id",
                "is",
                null,
            );

    if (
        errorEquipos
    ) {
        throw errorEquipos;
    }

    if (
        !equipos ||
        equipos.length ===
            0
    ) {
        return null;
    }

    const idsCapitanes =
        equipos
            .map(
                equipo =>
                    equipo.capitan_id,
            )
            .filter(
                (
                    id,
                ): id is string =>
                    typeof id ===
                    "string",
            );

    if (
        idsCapitanes.length ===
        0
    ) {
        return null;
    }

    const {
        data:
            capitanes,

        error:
            errorCapitanes,
    } =
        await supabaseAdmin
            .from(
                "participantes_equipo",
            )
            .select(
                "id,email,activo",
            )
            .in(
                "id",
                idsCapitanes,
            )
            .eq(
                "activo",
                true,
            );

    if (
        errorCapitanes
    ) {
        throw errorCapitanes;
    }

    const capitan =
        capitanes?.find(
            participante =>
                normalizarEmail(
                    participante.email ??
                    "",
                ) ===
                emailUsuario,
        );

    if (
        !capitan
    ) {
        return null;
    }

    const equipo =
        equipos.find(
            candidato =>
                candidato.capitan_id ===
                capitan.id,
        );

    if (
        !equipo
    ) {
        return null;
    }

    return (
        formularios.find(
            formulario =>
                formulario.id ===
                equipo.formulario_id,
        ) as
            | FormularioDB
            | undefined
    ) ??
        null;
}

// ============================================================
// PERMISOS DEL FORMULARIO
// ============================================================

export function permisosFormulario(
    formulario:
        FormularioDB,

    propietario:
        boolean,

    capitan:
        boolean,
) {
    const estado =
        estadoFormulario(
            formulario.estado,
        );

    const puedeEditar =
        (
            propietario ||
            capitan
        ) &&
        estado !==
            "EN_REVISION";

    return {
        propietario,
        capitan,

        puede_ver:
            propietario ||
            capitan,

        puede_editar:
            puedeEditar,

        puede_cambiar_acceso_capitan:
            propietario &&
            estado !==
                "EN_REVISION",
    };
}

// ============================================================
// ACCESO POR ID
// ============================================================

export async function obtenerAccesoPorID(
    formularioID: string,
    edicionID: string,
    usuario: Usuario,
): Promise<AccesoFormulario> {
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
            "No s'ha trobat la inscripció.",
        );
    }

    const formulario =
        data as FormularioDB;

    const equipo =
        await obtenerEquipoFormulario(
            formulario.id,
        );

    const propietario =
        formulario.usuario_id ===
        usuario.id;

    let capitan =
        false;

    if (
        !propietario &&
        formulario.acceso_capitan ===
            true &&
        equipo?.capitan_id &&
        usuario.email
    ) {
        const {
            data:
                participante,

            error:
                errorParticipante,
        } =
            await supabaseAdmin
                .from(
                    "participantes_equipo",
                )
                .select(
                    "id,email,activo",
                )
                .eq(
                    "id",
                    equipo.capitan_id,
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
            errorParticipante
        ) {
            throw errorParticipante;
        }

        capitan =
            Boolean(
                participante &&
                normalizarEmail(
                    participante.email ??
                    "",
                ) ===
                    normalizarEmail(
                        usuario.email,
                    ),
            );
    }

    const permisos =
        permisosFormulario(
            formulario,
            propietario,
            capitan,
        );

    if (
        !permisos.puede_ver
    ) {
        throw new ErrorAPI(
            403,
            "No tens accés a aquesta inscripció.",
        );
    }

    return {
        formulario,
        equipo,
        ...permisos,
    };
}

// ============================================================
// ESCUDO
// ============================================================

function leerEscudo(
    valor: unknown,
) {
    if (
        valor === null ||
        valor === undefined ||
        valor === ""
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
// LEER PARTICIPANTE
// ============================================================

function leerParticipante(
    valor: unknown,
    indice: number,
): ParticipanteEntrada {
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

    let id:
        string | null =
        null;

    if (
        valor.id !== null &&
        valor.id !== undefined &&
        valor.id !== ""
    ) {
        id =
            exigirUUID(
                valor.id,
                "del participant",
            );
    }

    if (
        typeof valor.tipo_participante !==
            "string" ||
        !TIPOS_PARTICIPANTE.includes(
            valor.tipo_participante as TipoParticipante,
        )
    ) {
        throw new ErrorAPI(
            400,
            `El tipus del participant ${indice + 1} no és vàlid.`,
        );
    }

    const email =
        normalizarEmail(
            texto(
                valor.email,
                `correu del participant ${indice + 1}`,
                MAX_EMAIL,
            ),
        );

    if (
        email &&
        !emailValido(
            email,
        )
    ) {
        throw new ErrorAPI(
            400,
            `El correu del participant ${indice + 1} no és vàlid.`,
        );
    }

    let genero:
        Genero | null =
        null;

    if (
        valor.genero !== null &&
        valor.genero !== undefined &&
        valor.genero !== ""
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

    const orden =
        typeof valor.orden ===
                "number" &&
            Number.isSafeInteger(
                valor.orden,
            ) &&
            valor.orden >
                0
            ? valor.orden
            : indice +
              1;

    return {
        id,

        tipo_participante:
            valor.tipo_participante as TipoParticipante,

        nombre:
            texto(
                valor.nombre,
                `nom del participant ${indice + 1}`,
                MAX_NOMBRE_PERSONA,
            ),

        apellido1:
            texto(
                valor.apellido1,
                `primer llinatge del participant ${indice + 1}`,
                MAX_APELLIDO,
            ),

        apellido2:
            texto(
                valor.apellido2,
                `segon llinatge del participant ${indice + 1}`,
                MAX_APELLIDO,
            ),

        email,

        curso:
            texto(
                valor.curso,
                `curs del participant ${indice + 1}`,
                MAX_CURSO,
            ),

        grupo:
            texto(
                valor.grupo,
                `grup del participant ${indice + 1}`,
                MAX_GRUPO,
            ),

        genero,
        orden,
    };
}

// ============================================================
// LEER DATOS
// ============================================================

export function leerDatos(
    valor: unknown,
): DatosEntrada {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "Les dades del formulari no són vàlides.",
        );
    }

    if (
        typeof valor.acceso_capitan !==
        "boolean"
    ) {
        throw new ErrorAPI(
            400,
            "El permís d'accés del capità no és vàlid.",
        );
    }

    if (
        !esRegistro(
            valor.equipo,
        )
    ) {
        throw new ErrorAPI(
            400,
            "Les dades de l'equip no són vàlides.",
        );
    }

    let equipoID:
        string | null =
        null;

    if (
        valor.equipo.id !== null &&
        valor.equipo.id !== undefined &&
        valor.equipo.id !== ""
    ) {
        equipoID =
            exigirUUID(
                valor.equipo.id,
                "de l'equip",
            );
    }

    let capitanID:
        string | null =
        null;

    if (
        valor.equipo.capitan_id !==
            null &&
        valor.equipo.capitan_id !==
            undefined &&
        valor.equipo.capitan_id !==
            ""
    ) {
        capitanID =
            exigirUUID(
                valor.equipo.capitan_id,
                "del capità",
            );
    }

    if (
        !Array.isArray(
            valor.participantes,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La llista de participants no és vàlida.",
        );
    }

    if (
        valor.participantes.length >
        MAX_PARTICIPANTES
    ) {
        throw new ErrorAPI(
            400,
            `No es poden guardar més de ${MAX_PARTICIPANTES} participants.`,
        );
    }

    const participantes =
        valor.participantes.map(
            leerParticipante,
        );

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

    return {
        acceso_capitan:
            valor.acceso_capitan,

        equipo: {
            id:
                equipoID,

            nombre:
                texto(
                    valor.equipo.nombre,
                    "nom de l'equip",
                    MAX_NOMBRE_EQUIPO,
                ),

            escudo:
                leerEscudo(
                    valor.equipo.escudo,
                ),

            capitan_id:
                capitanID,
        },

        participantes,
    };
}

// ============================================================
// EMAILS
// ============================================================

export function validarEmails(
    participantes:
        ParticipanteEntrada[],

    configuracion:
        ConfiguracionPlataforma,
) {
    for (
        let indice = 0;
        indice <
            participantes.length;
        indice += 1
    ) {
        const participante =
            participantes[
                indice
            ];

        if (
            !participante.email
        ) {
            continue;
        }

        if (
            !emailPermitido(
                participante.email,
                configuracion,
            )
        ) {
            throw new ErrorAPI(
                400,
                `El correu del participant ${indice + 1} no pertany a un domini autoritzat.`,
            );
        }
    }
}

export function validarEmailsRepetidos(
    participantes:
        ParticipanteEntrada[],
) {
    const usados =
        new Set<string>();

    for (
        const participante
        of participantes
    ) {
        if (
            !participante.email
        ) {
            continue;
        }

        const email =
            normalizarEmail(
                participante.email,
            );

        if (
            usados.has(
                email,
            )
        ) {
            throw new ErrorAPI(
                409,
                `El correu ${email} apareix més d'una vegada dins l'equip.`,
            );
        }

        usados.add(
            email,
        );
    }
}

// ============================================================
// CURSO / GRUPO
// ============================================================

function cursoValido(
    curso: string,
    grupo: string,
    configuracion:
        ConfiguracionEquipos,
) {
    const cursoConfigurado =
        configuracion.cursos.find(
            entrada =>
                entrada.curso ===
                curso,
        );

    if (
        !cursoConfigurado
    ) {
        return false;
    }

    if (
        cursoConfigurado
            .grupos
            .length ===
        0
    ) {
        return grupo ===
            "";
    }

    return cursoConfigurado.grupos.includes(
        grupo,
    );
}

// ============================================================
// VALIDACIÓN ESTRUCTURAL
// ============================================================

export function validarEstructuraParticipantes(
    participantes:
        ParticipanteEntrada[],

    configuracion:
        ConfiguracionEquipos,
) {
    const profesores =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "PROFESOR",
        );

    const entrenadores =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "ENTRENADOR",
        );

    const staff =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "STAFF",
        );

    if (
        !configuracion.profesores.permitidos &&
        profesores.length >
            0
    ) {
        throw new ErrorAPI(
            400,
            "Aquesta edició no permet afegir professorat.",
        );
    }

    if (
        !configuracion.entrenador.permitido &&
        entrenadores.length >
            0
    ) {
        throw new ErrorAPI(
            400,
            "Aquesta edició no permet afegir entrenador.",
        );
    }

    if (
        entrenadores.length >
        1
    ) {
        throw new ErrorAPI(
            400,
            "Només es pot indicar un entrenador.",
        );
    }

    if (
        !configuracion.staff.permitido &&
        staff.length >
            0
    ) {
        throw new ErrorAPI(
            400,
            "Aquesta edició no permet afegir membres de l'staff.",
        );
    }

    if (
        configuracion.profesores.permitidos &&
        configuracion.profesores.maximo >
            0 &&
        profesores.length >
            configuracion.profesores.maximo
    ) {
        throw new ErrorAPI(
            400,
            "S'ha superat el nombre màxim de professors.",
        );
    }

    if (
        configuracion.staff.permitido &&
        configuracion.staff.maximo >
            0 &&
        staff.length >
            configuracion.staff.maximo
    ) {
        throw new ErrorAPI(
            400,
            "S'ha superat el nombre màxim de membres de l'staff.",
        );
    }

    const jugadores =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "JUGADOR",
        );

    const computables = [
        ...jugadores,

        ...(
            configuracion.profesores.permitidos &&
            configuracion.profesores.cuentan_como_jugador
                ? profesores
                : []
        ),
    ];

    if (
        configuracion.jugadores.maximo !==
            null &&
        computables.length >
            configuracion.jugadores.maximo
    ) {
        throw new ErrorAPI(
            400,
            "S'ha superat el nombre màxim de jugadors permès.",
        );
    }

    for (
        const participante
        of participantes
    ) {
        if (
            participante.tipo_participante !==
                "JUGADOR" &&
            participante.tipo_participante !==
                "PROFESOR"
        ) {
            continue;
        }

        if (
            !participante.curso &&
            !participante.grupo
        ) {
            continue;
        }

        if (
            !participante.curso ||
            !cursoValido(
                participante.curso,
                participante.grupo,
                configuracion,
            )
        ) {
            throw new ErrorAPI(
                400,
                `El curs o grup de ${participante.nombre || "un participant"} no és vàlid per aquesta edició.`,
            );
        }
    }
}

// ============================================================
// VALIDACIÓN FINAL
// ============================================================

export function validarEnvio(
    datos:
        DatosEntrada,

    configuracion:
        ConfiguracionEquipos,
) {
    if (
        !datos.equipo.nombre
    ) {
        throw new ErrorAPI(
            400,
            "Indica el nom de l'equip.",
        );
    }

    const jugadores =
        datos.participantes.filter(
            participante =>
                participante.tipo_participante ===
                "JUGADOR",
        );

    const profesores =
        datos.participantes.filter(
            participante =>
                participante.tipo_participante ===
                "PROFESOR",
        );

    const staff =
        datos.participantes.filter(
            participante =>
                participante.tipo_participante ===
                "STAFF",
        );

    const computables = [
        ...jugadores,

        ...(
            configuracion.profesores.permitidos &&
            configuracion.profesores.cuentan_como_jugador
                ? profesores
                : []
        ),
    ];

    if (
        configuracion.jugadores.minimo !==
            null &&
        computables.length <
            configuracion.jugadores.minimo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip necessita com a mínim ${configuracion.jugadores.minimo} jugadors.`,
        );
    }

    if (
        configuracion.jugadores.maximo !==
            null &&
        computables.length >
            configuracion.jugadores.maximo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip no pot superar els ${configuracion.jugadores.maximo} jugadors.`,
        );
    }

    if (
        configuracion.profesores.permitidos &&
        profesores.length <
            configuracion.profesores.minimo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip necessita com a mínim ${configuracion.profesores.minimo} professors.`,
        );
    }

    if (
        configuracion.staff.permitido &&
        staff.length <
            configuracion.staff.minimo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip necessita com a mínim ${configuracion.staff.minimo} membres de l'staff.`,
        );
    }

    for (
        const participante
        of datos.participantes
    ) {
        if (
            !participante.nombre ||
            !participante.apellido1 ||
            !participante.email
        ) {
            throw new ErrorAPI(
                400,
                "Tots els participants han de tenir nom, primer llinatge i correu electrònic.",
            );
        }

        if (
            participante.tipo_participante ===
                "JUGADOR" ||
            participante.tipo_participante ===
                "PROFESOR"
        ) {
            if (
                !participante.curso
            ) {
                throw new ErrorAPI(
                    400,
                    `Indica el curs de ${participante.nombre}.`,
                );
            }

            if (
                !cursoValido(
                    participante.curso,
                    participante.grupo,
                    configuracion,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    `Revisa el curs i el grup de ${participante.nombre}.`,
                );
            }
        }

        const necesitaGenero =
            configuracion.genero.activo &&
            (
                participante.tipo_participante ===
                    "JUGADOR" ||
                (
                    participante.tipo_participante ===
                        "PROFESOR" &&
                    configuracion.profesores.cuentan_como_jugador
                )
            );

        if (
            necesitaGenero &&
            participante.genero ===
                null
        ) {
            throw new ErrorAPI(
                400,
                `Indica el gènere de ${participante.nombre}.`,
            );
        }
    }

    if (
        configuracion.genero.activo
    ) {
        const masculinos =
            computables.filter(
                participante =>
                    participante.genero ===
                    "masculino",
            ).length;

        const femeninos =
            computables.filter(
                participante =>
                    participante.genero ===
                    "femenino",
            ).length;

        if (
            masculinos <
            configuracion.genero.minimos.masculino
        ) {
            throw new ErrorAPI(
                400,
                `L'equip necessita com a mínim ${configuracion.genero.minimos.masculino} participants de gènere masculí.`,
            );
        }

        if (
            femeninos <
            configuracion.genero.minimos.femenino
        ) {
            throw new ErrorAPI(
                400,
                `L'equip necessita com a mínim ${configuracion.genero.minimos.femenino} participants de gènere femení.`,
            );
        }
    }

    if (
        !datos.equipo.capitan_id
    ) {
        throw new ErrorAPI(
            400,
            "Selecciona el capità de l'equip.",
        );
    }

    const capitan =
        jugadores.find(
            jugador =>
                jugador.id ===
                datos.equipo.capitan_id,
        );

    if (
        !capitan
    ) {
        throw new ErrorAPI(
            400,
            "El capità ha de ser un jugador de l'equip.",
        );
    }

    if (
        !capitan.email
    ) {
        throw new ErrorAPI(
            400,
            "El capità ha de tenir un correu electrònic.",
        );
    }
}

// ============================================================
// DUPLICADOS EN LA MISMA EDICIÓN
// ============================================================

export async function comprobarDuplicadosEdicion(
    edicionID: string,

    participantes:
        ParticipanteEntrada[],

    equipoActualID:
        string | null,
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
                .filter(
                    Boolean,
                ),
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
                "id,formulario_id",
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
            .filter(
                equipo =>
                    equipo.id !==
                    equipoActualID,
            )
            .map(
                equipo =>
                    equipo.id,
            );

    if (
        idsEquipos.length ===
        0
    ) {
        return;
    }

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
            )
            .in(
                "email",
                emails,
            );

    if (
        errorParticipantes
    ) {
        throw errorParticipantes;
    }

    const coincidencia =
        coincidencias?.find(
            participante =>
                emails.includes(
                    normalizarEmail(
                        participante.email ??
                        "",
                    ),
                ),
        );

    if (
        coincidencia?.email
    ) {
        throw new ErrorAPI(
            409,
            `La persona amb el correu ${normalizarEmail(coincidencia.email)} ja forma part d'un altre equip d'aquesta edició.`,
        );
    }
}

// ============================================================
// GUARDAR PARTICIPANTES
// ============================================================

export async function guardarParticipantes(
    equipoID: string,

    participantes:
        ParticipanteEntrada[],
) {
    const actuales =
        await obtenerParticipantes(
            equipoID,
        );

    const mapaActuales =
        new Map(
            actuales.map(
                participante => [
                    participante.id,
                    participante,
                ],
            ),
        );

    const idsConservados =
        new Set<string>();

    const ahora =
        new Date()
            .toISOString();

    // ========================================================
    // ACTUALIZAR
    // ========================================================

    for (
        const participante
        of participantes
    ) {
        if (
            !participante.id
        ) {
            continue;
        }

        const actual =
            mapaActuales.get(
                participante.id,
            );

        if (
            !actual
        ) {
            throw new ErrorAPI(
                400,
                "Hi ha un participant que no pertany a aquest equip.",
            );
        }

        idsConservados.add(
            participante.id,
        );

        const {
            error,
        } =
            await supabaseAdmin
                .from(
                    "participantes_equipo",
                )
                .update({
                    nombre:
                        participante.nombre ||
                        null,

                    apellido1:
                        participante.apellido1 ||
                        null,

                    apellido2:
                        participante.apellido2 ||
                        null,

                    email:
                        participante.email ||
                        null,

                    curso:
                        participante.tipo_participante ===
                            "JUGADOR" ||
                        participante.tipo_participante ===
                            "PROFESOR"
                            ? participante.curso ||
                              null
                            : null,

                    grupo:
                        participante.tipo_participante ===
                            "JUGADOR" ||
                        participante.tipo_participante ===
                            "PROFESOR"
                            ? participante.grupo ||
                              null
                            : null,

                    genero:
                        participante.genero,

                    tipo_participante:
                        participante.tipo_participante,

                    orden:
                        participante.orden,

                    activo:
                        true,

                    updated_at:
                        ahora,
                })
                .eq(
                    "id",
                    participante.id,
                )
                .eq(
                    "equipo_id",
                    equipoID,
                );

        if (
            error
        ) {
            throw error;
        }
    }

    // ========================================================
    // INSERTAR
    // ========================================================

    const nuevos =
        participantes.filter(
            participante =>
                participante.id ===
                null,
        );

    if (
        nuevos.length >
        0
    ) {
        const {
            error,
        } =
            await supabaseAdmin
                .from(
                    "participantes_equipo",
                )
                .insert(
                    nuevos.map(
                        participante => ({
                            id:
                                randomUUID(),

                            equipo_id:
                                equipoID,

                            nombre:
                                participante.nombre ||
                                null,

                            apellido1:
                                participante.apellido1 ||
                                null,

                            apellido2:
                                participante.apellido2 ||
                                null,

                            email:
                                participante.email ||
                                null,

                            curso:
                                participante.tipo_participante ===
                                    "JUGADOR" ||
                                participante.tipo_participante ===
                                    "PROFESOR"
                                    ? participante.curso ||
                                      null
                                    : null,

                            grupo:
                                participante.tipo_participante ===
                                    "JUGADOR" ||
                                participante.tipo_participante ===
                                    "PROFESOR"
                                    ? participante.grupo ||
                                      null
                                    : null,

                            genero:
                                participante.genero,

                            tipo_participante:
                                participante.tipo_participante,

                            orden:
                                participante.orden,

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
            error
        ) {
            throw error;
        }
    }

    // ========================================================
    // SOFT DELETE
    // ========================================================

    const idsDesactivar =
        actuales
            .filter(
                participante =>
                    !idsConservados.has(
                        participante.id,
                    ),
            )
            .map(
                participante =>
                    participante.id,
            );

    if (
        idsDesactivar.length >
        0
    ) {
        const {
            error,
        } =
            await supabaseAdmin
                .from(
                    "participantes_equipo",
                )
                .update({
                    activo:
                        false,

                    updated_at:
                        ahora,
                })
                .eq(
                    "equipo_id",
                    equipoID,
                )
                .in(
                    "id",
                    idsDesactivar,
                );

        if (
            error
        ) {
            throw error;
        }
    }
}

// ============================================================
// SNAPSHOT
// ============================================================

export function configuracionFormulario(
    formulario:
        FormularioDB,

    actual:
        ConfiguracionEquipos,
) {
    const snapshot =
        normalizarConfiguracionEquipos(
            formulario
                .configuracion_snapshot,
        );

    return (
        snapshot ??
        actual
    );
}