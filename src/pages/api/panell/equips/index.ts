import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";

import {
    tieneAccesoTorneo,
    tienePermiso,
} from "@const/Permisos";

export const prerender = false;

// ============================================================
// CONSTANTES
// ============================================================

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_JSON_BYTES =
    4_000_000;

const MAX_PARTICIPANTES =
    100;

const MAX_NOMBRE_EQUIPO =
    80;

const MAX_NOMBRE_PERSONA =
    100;

const MAX_APELLIDO =
    100;

const MAX_EMAIL =
    254;

const MAX_CURSO =
    100;

const MAX_GRUPO =
    100;

const MAX_ESCUDO =
    3_000_000;

const MAX_NOTA_ADMIN =
    4000;

const TIPOS_PARTICIPANTE = [
    "JUGADOR",
    "PROFESOR",
    "ENTRENADOR",
    "STAFF",
] as const;

const ESTADOS_CREACION = [
    "BORRADOR",
    "APROBADO",
] as const;

const ESTADOS_PLAZA = [
    "PENDIENTE",
    "CONFIRMADA",
    "LISTA_ESPERA",
    "SIN_PLAZA",
] as const;

// ============================================================
// CAMPOS DB
// ============================================================

const CAMPOS_FORMULARIO =
    "id,edicion_id,tipo,estado,usuario_id,email_contacto,acceso_capitan,iniciado_at,enviado_at,completado_at,created_at,updated_at";

const CAMPOS_EQUIPO =
    "id,formulario_id,nombre,escudo,capitan_id,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at,updated_at";

const CAMPOS_PARTICIPANTE =
    "id,equipo_id,tipo_participante,nombre,apellido1,apellido2,email,curso,grupo,genero,validacion_estado,orden,activo,created_at,updated_at";

// ============================================================
// TIPOS
// ============================================================

type Registro =
    Record<string, unknown>;

type Usuario =
    NonNullable<
        Awaited<
            ReturnType<
                typeof obtenerUsuarioPorToken
            >
        >
    >;

type TipoParticipante =
    typeof TIPOS_PARTICIPANTE[number];

type EstadoCreacion =
    typeof ESTADOS_CREACION[number];

type EstadoPlaza =
    typeof ESTADOS_PLAZA[number];

type Genero =
    | "masculino"
    | "femenino";

type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

type ConfiguracionEquipos = {
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

    cursos:
        CursoConfiguracion[];

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

type ConfiguracionPlataforma = {
    emails: string[];
    dominios: string[];
};

type TorneoDB = {
    id: string;
    nombre: string | null;
    deporte: string | null;
};

type EdicionDB = {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string | null;
    sede: string | null;
};

type FormularioDB = {
    id: string;
    edicion_id: string;
    tipo: string | null;
    estado: string | null;
    usuario_id: string | null;
    email_contacto: string | null;
    acceso_capitan: boolean | null;
    iniciado_at: string | null;
    enviado_at: string | null;
    completado_at: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type EquipoDB = {
    id: string;
    formulario_id: string;
    nombre: string | null;
    escudo: string | null;
    capitan_id: string | null;
    validacion_estado: string | null;
    plaza_estado: string | null;
    posicion_lista_espera: number | null;
    nota_admin: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type ParticipanteDB = {
    id: string;
    equipo_id: string;
    tipo_participante: string | null;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    grupo: string | null;
    genero: string | null;
    validacion_estado: string | null;
    orden: number | null;
    activo: boolean | null;
    created_at: string | null;
    updated_at: string | null;
};

type UsuarioResponsableDB = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    activa: boolean | null;
};

type ParticipanteEntrada = {
    tipo_participante: TipoParticipante;

    nombre: string;

    apellido1: string;

    apellido2: string;

    email: string;

    curso: string;

    grupo: string;

    genero:
        Genero | null;

    orden: number;
};

type ParticipanteNuevo =
    ParticipanteEntrada & {
        id: string;
    };

type DatosCreacion = {
    estado:
        EstadoCreacion;

    responsable: {
        email: string;
        vincular_usuario: boolean;
    };

    acceso_capitan:
        boolean;

    equipo: {
        nombre: string;

        escudo:
            string | null;

        capitan_email:
            string;

        nota_admin:
            string | null;
    };

    participantes:
        ParticipanteEntrada[];

    plaza: {
        estado:
            EstadoPlaza;

        posicion_lista_espera:
            number | null;
    };
};

// ============================================================
// ERROR API
// ============================================================

class ErrorAPI extends Error {
    constructor(
        public estado: number,
        mensaje: string,
    ) {
        super(mensaje);

        this.name =
            "ErrorAPI";
    }
}

// ============================================================
// RESPUESTAS
// ============================================================

function responder(
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
                mensaje: error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error en la gestió d'equips:",
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

function esRegistro(
    valor: unknown,
): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function leerID(
    valor: unknown,
    nombre: string,
) {
    if (
        typeof valor !== "string" ||
        !UUID.test(
            valor.trim(),
        )
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    return valor
        .trim()
        .toLowerCase();
}

function leerTexto(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
) {
    if (
        valor === null ||
        valor === undefined
    ) {
        if (obligatorio) {
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

function normalizarEmail(
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

function comprobarOrigen(
    request: Request,
    url: URL,
) {
    if (
        request.headers.get(
            "origin",
        ) !==
        url.origin
    ) {
        throw new ErrorAPI(
            403,
            "Origen de la petició no permès.",
        );
    }
}

async function leerJSON(
    request: Request,
): Promise<Registro> {
    const longitud =
        Number(
            request.headers.get(
                "content-length",
            ) ??
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

    const texto =
        await request.text();

    if (
        Buffer.byteLength(
            texto,
            "utf8",
        ) >
        MAX_JSON_BYTES
    ) {
        throw new ErrorAPI(
            413,
            "La petició és massa gran.",
        );
    }

    let valor:
        unknown;

    try {
        valor =
            JSON.parse(
                texto,
            );
    } catch {
        throw new ErrorAPI(
            400,
            "La petició no conté un JSON vàlid.",
        );
    }

    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La petició no és vàlida.",
        );
    }

    return valor;
}

// ============================================================
// SESIÓN
// ============================================================

async function exigirUsuario(
    token:
        string | undefined,
): Promise<Usuario> {
    const usuario =
        token
            ? await obtenerUsuarioPorToken(
                  token,
              )
            : null;

    if (!usuario) {
        throw new ErrorAPI(
            401,
            "Has d'iniciar sessió.",
        );
    }

    return usuario;
}

// ============================================================
// PERMISOS
// ============================================================

function exigirAccesoTorneo(
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

function exigirPermisoVer(
    usuario: Usuario,
    torneoID: string,
) {
    exigirAccesoTorneo(
        usuario,
        torneoID,
    );

    if (
        !tienePermiso(
            usuario,
            "equips",
            "ver",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per consultar els equips d'aquest torneig.",
        );
    }
}

function exigirPermisoCrear(
    usuario: Usuario,
    torneoID: string,
) {
    exigirAccesoTorneo(
        usuario,
        torneoID,
    );

    if (
        !tienePermiso(
            usuario,
            "equips",
            "crear",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per crear equips en aquest torneig.",
        );
    }
}

// ============================================================
// CONFIGURACIÓN EDICIÓN
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

function normalizarConfiguracionEquipos(
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

async function obtenerConfiguracionEdicion(
    edicionID: string,
): Promise<ConfiguracionEquipos> {
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

    if (error) {
        throw error;
    }

    const configuracion =
        normalizarConfiguracionEquipos(
            data?.equipos,
        );

    if (!configuracion) {
        throw new ErrorAPI(
            409,
            "Aquesta edició no té configurada la inscripció d'equips.",
        );
    }

    return configuracion;
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

async function obtenerConfiguracionPlataforma():
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
                "emails_registro_permitidos,dominios_registro_permitidos,created_at",
            )
            .order(
                "created_at",
                {
                    ascending:
                        true,

                    nullsFirst:
                        false,
                },
            )
            .limit(
                1,
            );

    if (error) {
        throw error;
    }

    const fila =
        data?.[0];

    if (!fila) {
        return {
            emails: [],
            dominios: [],
        };
    }

    return {
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
            normalizado.length - 1
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

// ============================================================
// TORNEO / EDICIÓN
// ============================================================

async function obtenerTorneo(
    torneoID: string,
): Promise<TorneoDB> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("torneos")
            .select(
                "id,nombre,deporte",
            )
            .eq(
                "id",
                torneoID,
            )
            .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat el torneig.",
        );
    }

    return data as TorneoDB;
}

async function obtenerEdicion(
    edicionID: string,
    torneoID: string,
): Promise<EdicionDB> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("ediciones")
            .select(
                "id,torneo_id,nombre,fecha_inicio,fecha_fin,estado,sede",
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

    if (error) {
        throw error;
    }

    if (!data) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat l'edició o no pertany al torneig seleccionat.",
        );
    }

    return data as EdicionDB;
}

// ============================================================
// LISTA · FORMULARIOS
// ============================================================

async function obtenerFormularios(
    edicionID: string,
): Promise<FormularioDB[]> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("formularios")
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
                    ascending: false,
                    nullsFirst: false,
                },
            );

    if (error) {
        throw error;
    }

    return (
        data ??
        []
    ) as FormularioDB[];
}

// ============================================================
// LISTA · EQUIPOS
// ============================================================

async function obtenerEquipos(
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
            .from("equipos")
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
                    ascending: false,
                    nullsFirst: false,
                },
            );

    if (error) {
        throw error;
    }

    return (
        data ??
        []
    ) as EquipoDB[];
}

// ============================================================
// PARTICIPANTES
// ============================================================

async function obtenerParticipantes(
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
                    ascending: true,
                    nullsFirst: false,
                },
            );

    if (error) {
        throw error;
    }

    return (
        data ??
        []
    ) as ParticipanteDB[];
}

// ============================================================
// RESPONSABLES LISTA
// ============================================================

async function obtenerResponsables(
    idsUsuarios: string[],
): Promise<UsuarioResponsableDB[]> {
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
            .from("users")
            .select(
                "id,nombre,apellido1,apellido2,email,activa",
            )
            .in(
                "id",
                idsUsuarios,
            );

    if (error) {
        throw error;
    }

    return (
        data ??
        []
    ) as UsuarioResponsableDB[];
}

// ============================================================
// NORMALIZADORES LISTA
// ============================================================

function normalizarEstadoFormulario(
    valor: string | null,
) {
    const estado =
        valor
            ?.trim()
            .toUpperCase() ??
        "";

    if (
        estado === "EN_REVISION" ||
        estado === "APROBADO" ||
        estado === "DENEGADO"
    ) {
        return estado;
    }

    return "BORRADOR";
}

function normalizarTipoParticipante(
    valor: string | null,
): TipoParticipante | null {
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

    return null;
}

function normalizarEstadoPlaza(
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

function normalizarValidacion(
    valor: string | null,
) {
    return (
        valor
            ?.trim()
            .toUpperCase() ||
        "PENDIENTE"
    );
}

function nombreCompleto(
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
// PREPARAR FILA LISTA
// ============================================================

function prepararFila(
    formulario: FormularioDB,
    equipo: EquipoDB | null,
    participantes: ParticipanteDB[],
    responsable:
        UsuarioResponsableDB | null,
    capacidades: {
        editar: boolean;
        evaluar: boolean;
        cambiarEstado: boolean;
        eliminar: boolean;
    },
) {
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
// RESUMEN LISTA
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
                fila.formulario.estado ===
                "BORRADOR",
        );

    const enviadas =
        filas.filter(
            fila =>
                fila.formulario.estado !==
                "BORRADOR",
        );

    return {
        /*
         * IMPORTANTE:
         * total y participantes NO incluyen borradores.
         */
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
                    fila.participantes.total,
                0,
            ),

        enRevision:
            enviadas.filter(
                fila =>
                    fila.formulario.estado ===
                    "EN_REVISION",
            ).length,

        aprobadas:
            enviadas.filter(
                fila =>
                    fila.formulario.estado ===
                    "APROBADO",
            ).length,

        denegadas:
            enviadas.filter(
                fila =>
                    fila.formulario.estado ===
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
// PARSEAR PARTICIPANTE CREACIÓN
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

    const tipo =
        typeof valor.tipo_participante ===
            "string"
            ? valor.tipo_participante
                  .trim()
                  .toUpperCase()
            : "";

    if (
        !TIPOS_PARTICIPANTE.includes(
            tipo as TipoParticipante,
        )
    ) {
        throw new ErrorAPI(
            400,
            `El tipus del participant ${indice + 1} no és vàlid.`,
        );
    }

    const email =
        normalizarEmail(
            leerTexto(
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
            : indice + 1;

    return {
        tipo_participante:
            tipo as TipoParticipante,

        nombre:
            leerTexto(
                valor.nombre,
                `nom del participant ${indice + 1}`,
                MAX_NOMBRE_PERSONA,
            ),

        apellido1:
            leerTexto(
                valor.apellido1,
                `primer llinatge del participant ${indice + 1}`,
                MAX_APELLIDO,
            ),

        apellido2:
            leerTexto(
                valor.apellido2,
                `segon llinatge del participant ${indice + 1}`,
                MAX_APELLIDO,
            ),

        email,

        curso:
            leerTexto(
                valor.curso,
                `curs del participant ${indice + 1}`,
                MAX_CURSO,
            ),

        grupo:
            leerTexto(
                valor.grupo,
                `grup del participant ${indice + 1}`,
                MAX_GRUPO,
            ),

        genero,

        orden,
    };
}

// ============================================================
// LEER CREACIÓN ADMINISTRATIVA
// ============================================================

function leerDatosCreacion(
    cuerpo: Registro,
): DatosCreacion {
    const estadoRaw =
        leerTexto(
            cuerpo.estado,
            "estado",
            30,
            true,
        )
            .toUpperCase();

    if (
        !ESTADOS_CREACION.includes(
            estadoRaw as EstadoCreacion,
        )
    ) {
        throw new ErrorAPI(
            400,
            "L'estat inicial de l'equip no és vàlid.",
        );
    }

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
            leerTexto(
                cuerpo.responsable.email,
                "correu del responsable",
                MAX_EMAIL,
            ),
        );

    if (
        emailResponsable &&
        !emailValido(
            emailResponsable,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del responsable no és vàlid.",
        );
    }

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

    if (
        typeof cuerpo.acceso_capitan !==
        "boolean"
    ) {
        throw new ErrorAPI(
            400,
            "El permís d'accés del capità no és vàlid.",
        );
    }

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
            leerParticipante,
        );

    const capitanEmail =
        normalizarEmail(
            leerTexto(
                cuerpo.equipo.capitan_email,
                "correu del capità",
                MAX_EMAIL,
            ),
        );

    if (
        capitanEmail &&
        !emailValido(
            capitanEmail,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del capità no és vàlid.",
        );
    }

    const notaAdmin =
        leerTexto(
            cuerpo.equipo.nota_admin,
            "nota administrativa",
            MAX_NOTA_ADMIN,
        );

    let estadoPlaza:
        EstadoPlaza =
        "PENDIENTE";

    let posicion:
        number | null =
        null;

    if (
        cuerpo.plaza !==
            undefined &&
        cuerpo.plaza !==
            null
    ) {
        if (
            !esRegistro(
                cuerpo.plaza,
            )
        ) {
            throw new ErrorAPI(
                400,
                "La configuració de la plaça no és vàlida.",
            );
        }

        const plazaRaw =
            leerTexto(
                cuerpo.plaza.estado,
                "estat de la plaça",
                50,
                true,
            )
                .toUpperCase();

        if (
            !ESTADOS_PLAZA.includes(
                plazaRaw as EstadoPlaza,
            )
        ) {
            throw new ErrorAPI(
                400,
                "L'estat de la plaça no és vàlid.",
            );
        }

        estadoPlaza =
            plazaRaw as EstadoPlaza;

        if (
            estadoPlaza ===
            "LISTA_ESPERA"
        ) {
            if (
                typeof cuerpo.plaza.posicion_lista_espera !==
                    "number" ||
                !Number.isSafeInteger(
                    cuerpo.plaza.posicion_lista_espera,
                ) ||
                cuerpo.plaza.posicion_lista_espera <
                    1
            ) {
                throw new ErrorAPI(
                    400,
                    "Indica una posició vàlida de la llista d'espera.",
                );
            }

            posicion =
                cuerpo.plaza
                    .posicion_lista_espera;
        }
    }

    return {
        estado:
            estadoRaw as EstadoCreacion,

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
                leerTexto(
                    cuerpo.equipo.nombre,
                    "nom de l'equip",
                    MAX_NOMBRE_EQUIPO,
                ),

            escudo:
                leerEscudo(
                    cuerpo.equipo.escudo,
                ),

            capitan_email:
                capitanEmail,

            nota_admin:
                notaAdmin ||
                null,
        },

        participantes,

        plaza: {
            estado:
                estadoPlaza,

            posicion_lista_espera:
                posicion,
        },
    };
}

// ============================================================
// EMAILS
// ============================================================

function validarEmailsPermitidos(
    datos:
        DatosCreacion,
    configuracion:
        ConfiguracionPlataforma,
) {
    if (
        datos.responsable.email &&
        !emailPermitido(
            datos.responsable.email,
            configuracion,
        )
    ) {
        throw new ErrorAPI(
            400,
            "El correu del responsable no pertany als correus o dominis autoritzats.",
        );
    }

    for (
        let indice = 0;
        indice <
            datos.participantes.length;
        indice += 1
    ) {
        const participante =
            datos.participantes[
                indice
            ];

        if (
            participante.email &&
            !emailPermitido(
                participante.email,
                configuracion,
            )
        ) {
            throw new ErrorAPI(
                400,
                `El correu del participant ${indice + 1} no pertany als correus o dominis autoritzats.`,
            );
        }
    }
}

function validarEmailsRepetidos(
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

    if (!cursoConfigurado) {
        return false;
    }

    if (
        cursoConfigurado
            .grupos
            .length ===
        0
    ) {
        return grupo === "";
    }

    return cursoConfigurado
        .grupos
        .includes(
            grupo,
        );
}

// ============================================================
// VALIDACIÓN ESTRUCTURAL
// ============================================================

function validarEstructuraParticipantes(
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
        !configuracion
            .profesores
            .permitidos &&
        profesores.length > 0
    ) {
        throw new ErrorAPI(
            400,
            "Aquesta edició no permet afegir professorat.",
        );
    }

    if (
        !configuracion
            .entrenador
            .permitido &&
        entrenadores.length > 0
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
        !configuracion
            .staff
            .permitido &&
        staff.length > 0
    ) {
        throw new ErrorAPI(
            400,
            "Aquesta edició no permet afegir membres de l'staff.",
        );
    }

    if (
        configuracion
            .profesores
            .permitidos &&
        configuracion
            .profesores
            .maximo > 0 &&
        profesores.length >
            configuracion
                .profesores
                .maximo
    ) {
        throw new ErrorAPI(
            400,
            "S'ha superat el nombre màxim de professors.",
        );
    }

    if (
        configuracion
            .staff
            .permitido &&
        configuracion
            .staff
            .maximo > 0 &&
        staff.length >
            configuracion
                .staff
                .maximo
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
            configuracion
                .profesores
                .permitidos &&
            configuracion
                .profesores
                .cuentan_como_jugador
                ? profesores
                : []
        ),
    ];

    if (
        configuracion
            .jugadores
            .maximo !==
            null &&
        computables.length >
            configuracion
                .jugadores
                .maximo
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
            participante
                .tipo_participante !==
                "JUGADOR" &&
            participante
                .tipo_participante !==
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
// VALIDACIÓN COMPLETA PARA APROBADO
// ============================================================

function validarEquipoCompleto(
    datos:
        DatosCreacion,
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
            configuracion
                .profesores
                .permitidos &&
            configuracion
                .profesores
                .cuentan_como_jugador
                ? profesores
                : []
        ),
    ];

    if (
        configuracion
            .jugadores
            .minimo !==
            null &&
        computables.length <
            configuracion
                .jugadores
                .minimo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip necessita com a mínim ${configuracion.jugadores.minimo} jugadors.`,
        );
    }

    if (
        configuracion
            .jugadores
            .maximo !==
            null &&
        computables.length >
            configuracion
                .jugadores
                .maximo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip no pot superar els ${configuracion.jugadores.maximo} jugadors.`,
        );
    }

    if (
        configuracion
            .profesores
            .permitidos &&
        profesores.length <
            configuracion
                .profesores
                .minimo
    ) {
        throw new ErrorAPI(
            400,
            `L'equip necessita com a mínim ${configuracion.profesores.minimo} professors.`,
        );
    }

    if (
        configuracion
            .staff
            .permitido &&
        staff.length <
            configuracion
                .staff
                .minimo
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
            participante
                .tipo_participante ===
                "JUGADOR" ||
            participante
                .tipo_participante ===
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
            configuracion
                .genero
                .activo &&
            (
                participante
                    .tipo_participante ===
                    "JUGADOR" ||
                (
                    participante
                        .tipo_participante ===
                        "PROFESOR" &&
                    configuracion
                        .profesores
                        .cuentan_como_jugador
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
        configuracion
            .genero
            .activo
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
            configuracion
                .genero
                .minimos
                .masculino
        ) {
            throw new ErrorAPI(
                400,
                `L'equip necessita com a mínim ${configuracion.genero.minimos.masculino} participants de gènere masculí.`,
            );
        }

        if (
            femeninos <
            configuracion
                .genero
                .minimos
                .femenino
        ) {
            throw new ErrorAPI(
                400,
                `L'equip necessita com a mínim ${configuracion.genero.minimos.femenino} participants de gènere femení.`,
            );
        }
    }

    if (
        !datos.equipo
            .capitan_email
    ) {
        throw new ErrorAPI(
            400,
            "Selecciona el capità de l'equip.",
        );
    }

    const capitan =
        jugadores.find(
            jugador =>
                normalizarEmail(
                    jugador.email,
                ) ===
                datos.equipo
                    .capitan_email,
        );

    if (!capitan) {
        throw new ErrorAPI(
            400,
            "El capità ha de ser un jugador de l'equip.",
        );
    }
}

// ============================================================
// DUPLICADOS EN LA EDICIÓN
// ============================================================

async function comprobarDuplicadosEdicion(
    edicionID: string,
    participantes:
        ParticipanteEntrada[],
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
            .from("formularios")
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
            .from("equipos")
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
        ).map(
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
                participante.email &&
                emails.includes(
                    normalizarEmail(
                        participante.email,
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
// RESOLVER RESPONSABLE
// ============================================================

async function resolverResponsable(
    edicionID: string,
    responsable:
        DatosCreacion["responsable"],
) {
    if (
        !responsable.email
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
                responsable.email,
        };
    }

    const {
        data:
            usuarios,

        error:
            errorUsuario,
    } =
        await supabaseAdmin
            .from("users")
            .select(
                "id,email,activa",
            )
            .ilike(
                "email",
                responsable.email,
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
            formularioExistente,

        error:
            errorFormulario,
    } =
        await supabaseAdmin
            .from("formularios")
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
            )
            .limit(
                1,
            );

    if (
        errorFormulario
    ) {
        throw errorFormulario;
    }

    if (
        formularioExistente &&
        formularioExistente.length >
            0
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
                responsable.email,
            ),
    };
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute =
    async ({
        cookies,
        url,
    }) => {
        try {
            const usuario =
                await exigirUsuario(
                    cookies.get(
                        "token_sesion",
                    )?.value,
                );

            const torneoID =
                leerID(
                    url.searchParams.get(
                        "torneoID",
                    ),
                    "torneoID",
                );

            const edicionID =
                leerID(
                    url.searchParams.get(
                        "edicionID",
                    ),
                    "edicionID",
                );

            exigirPermisoVer(
                usuario,
                torneoID,
            );

            const vista =
                url.searchParams.get(
                    "vista",
                ) ??
                "lista";

            if (
                vista !== "lista" &&
                vista !== "crear"
            ) {
                throw new ErrorAPI(
                    400,
                    "La vista indicada no és vàlida.",
                );
            }

            const [
                torneo,
                edicion,
            ] =
                await Promise.all([
                    obtenerTorneo(
                        torneoID,
                    ),

                    obtenerEdicion(
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
                if (
                    !tienePermiso(
                        usuario,
                        "equips",
                        "crear",
                        torneoID,
                    )
                ) {
                    throw new ErrorAPI(
                        403,
                        "No tens permís per crear equips.",
                    );
                }

                const configuracion =
                    await obtenerConfiguracionEdicion(
                        edicionID,
                    );

                return responder({
                    success: true,

                    torneo: {
                        id:
                            torneo.id,

                        nombre:
                            torneo.nombre ??
                            "Torneig",

                        deporte:
                            torneo.deporte ??
                            null,
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
                            tienePermiso(
                                usuario,
                                "equips",
                                "canviar-estat",
                                torneoID,
                            ),
                    },
                });
            }

            // =================================================
            // LISTA
            // =================================================

            const formularios =
                await obtenerFormularios(
                    edicionID,
                );

            const idsFormularios =
                formularios.map(
                    formulario =>
                        formulario.id,
                );

            const equipos =
                await obtenerEquipos(
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
                                UUID.test(id),
                        ),
                ),
            ];

            const [
                participantes,
                responsables,
            ] =
                await Promise.all([
                    obtenerParticipantes(
                        idsEquipos,
                    ),

                    obtenerResponsables(
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
                    UsuarioResponsableDB
                >(
                    responsables.map(
                        responsable => [
                            responsable.id,
                            responsable,
                        ],
                    ),
                );

            const capacidades = {
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

            const filas =
                formularios
                    .map(
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

                            return prepararFila(
                                formulario,
                                equipo,
                                listaParticipantes,
                                responsable,
                                {
                                    editar:
                                        capacidades.editar,

                                    evaluar:
                                        capacidades.evaluar,

                                    cambiarEstado:
                                        capacidades.cambiarEstado,

                                    eliminar:
                                        capacidades.eliminar,
                                },
                            );
                        },
                    )
                    .sort(
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

            return responder({
                success: true,

                torneo: {
                    id:
                        torneo.id,

                    nombre:
                        torneo.nombre ??
                        "Torneig",

                    deporte:
                        torneo.deporte ??
                        null,
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

                /*
                 * Las filas incluyen borradores porque la interfaz
                 * tiene una vista explícita para consultarlos.
                 * El resumen NO los contabiliza.
                 */
                filas,

                capacidades,
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
// POST · CREACIÓN ADMINISTRATIVA
// ============================================================

export const POST: APIRoute =
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
                    cookies.get(
                        "token_sesion",
                    )?.value,
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
                leerID(
                    cuerpo.torneoID,
                    "torneoID",
                );

            const edicionID =
                leerID(
                    cuerpo.edicionID,
                    "edicionID",
                );

            exigirPermisoCrear(
                usuario,
                torneoID,
            );

            // =================================================
            // CONTEXTO
            // =================================================

            const [
                torneo,
                edicion,
                configuracion,
                configuracionPlataforma,
            ] =
                await Promise.all([
                    obtenerTorneo(
                        torneoID,
                    ),

                    obtenerEdicion(
                        edicionID,
                        torneoID,
                    ),

                    obtenerConfiguracionEdicion(
                        edicionID,
                    ),

                    obtenerConfiguracionPlataforma(),
                ]);

            // =================================================
            // DATOS
            // =================================================

            const datos =
                leerDatosCreacion(
                    cuerpo,
                );

            // =================================================
            // VALIDACIONES COMUNES
            // =================================================

            validarEmailsPermitidos(
                datos,
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
            );

            // =================================================
            // VALIDACIÓN COMPLETA SI SE CREA APROBADO
            // =================================================

            if (
                datos.estado ===
                "APROBADO"
            ) {
                validarEquipoCompleto(
                    datos,
                    configuracion,
                );
            }

            // =================================================
            // CAPITÁN
            // =================================================

            const participantesNuevos:
                ParticipanteNuevo[] =
                datos.participantes.map(
                    participante => ({
                        ...participante,

                        id:
                            randomUUID(),
                    }),
                );

            let capitan:
                ParticipanteNuevo | null =
                null;

            if (
                datos.equipo
                    .capitan_email
            ) {
                capitan =
                    participantesNuevos.find(
                        participante =>
                            participante
                                .tipo_participante ===
                                "JUGADOR" &&
                            normalizarEmail(
                                participante.email,
                            ) ===
                                datos.equipo
                                    .capitan_email,
                    ) ??
                    null;

                if (!capitan) {
                    throw new ErrorAPI(
                        400,
                        "El capità seleccionat no correspon a cap jugador de l'equip.",
                    );
                }
            }

            if (
                datos.acceso_capitan &&
                !capitan
            ) {
                throw new ErrorAPI(
                    400,
                    "Per donar accés al capità primer has de seleccionar-lo.",
                );
            }

            // =================================================
            // RESPONSABLE
            // =================================================

            const responsable =
                await resolverResponsable(
                    edicionID,
                    datos.responsable,
                );

            // =================================================
            // PLAZA
            // =================================================

            let plazaEstado:
                EstadoPlaza =
                datos.plaza.estado;

            let posicionListaEspera:
                number | null =
                datos.plaza
                    .posicion_lista_espera;

            /*
             * Un borrador todavía no es una inscripción enviada.
             * No puede consumir ni gestionar una plaza.
             */
            if (
                datos.estado ===
                "BORRADOR"
            ) {
                plazaEstado =
                    "PENDIENTE";

                posicionListaEspera =
                    null;
            }

            if (
                datos.estado ===
                    "APROBADO" &&
                plazaEstado !==
                    "PENDIENTE" &&
                !tienePermiso(
                    usuario,
                    "equips",
                    "canviar-estat",
                    torneoID,
                )
            ) {
                throw new ErrorAPI(
                    403,
                    "Pots crear l'equip, però no tens permís per assignar-li una plaça.",
                );
            }

            if (
                plazaEstado !==
                "LISTA_ESPERA"
            ) {
                posicionListaEspera =
                    null;
            }

            // =================================================
            // FECHAS / IDS
            // =================================================

            const ahora =
                new Date()
                    .toISOString();

            const formularioID =
                randomUUID();

            const equipoID =
                randomUUID();

            const aprobado =
                datos.estado ===
                "APROBADO";

            // =================================================
            // FORMULARIO
            // =================================================

            const {
                error:
                    errorFormulario,
            } =
                await supabaseAdmin
                    .from("formularios")
                    .insert({
                        id:
                            formularioID,

                        edicion_id:
                            edicionID,

                        tipo:
                            "EQUIPO",

                        estado:
                            datos.estado,

                        usuario_id:
                            responsable.usuario_id,

                        email_contacto:
                            responsable.email_contacto,

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
                throw errorFormulario;
            }

            // =================================================
            // EQUIPO
            // =================================================

            const {
                error:
                    errorEquipo,
            } =
                await supabaseAdmin
                    .from("equipos")
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
                            capitan?.id ??
                            null,

                        validacion_estado:
                            aprobado
                                ? "APROBADO"
                                : "PENDIENTE",

                        plaza_estado:
                            plazaEstado,

                        posicion_lista_espera:
                            posicionListaEspera,

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
                /*
                 * No hacemos DELETE.
                 * Si la segunda escritura falla, dejamos el
                 * formulario como borrador administrativo para
                 * no presentar una inscripción incompleta como
                 * aprobada.
                 */
                const {
                    error:
                        errorCompensacion,
                } =
                    await supabaseAdmin
                        .from("formularios")
                        .update({
                            estado:
                                "BORRADOR",

                            enviado_at:
                                null,

                            completado_at:
                                null,

                            updated_at:
                                new Date()
                                    .toISOString(),
                        })
                        .eq(
                            "id",
                            formularioID,
                        );

                if (
                    errorCompensacion
                ) {
                    console.error(
                        "No s'ha pogut deixar en esborrany el formulari després de fallar la creació de l'equip:",
                        errorCompensacion,
                    );
                }

                throw errorEquipo;
            }

            // =================================================
            // PARTICIPANTES
            // =================================================

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
                                        participante
                                            .tipo_participante ===
                                            "JUGADOR" ||
                                        participante
                                            .tipo_participante ===
                                            "PROFESOR"
                                            ? participante.curso ||
                                              null
                                            : null,

                                    grupo:
                                        participante
                                            .tipo_participante ===
                                            "JUGADOR" ||
                                        participante
                                            .tipo_participante ===
                                            "PROFESOR"
                                            ? participante.grupo ||
                                              null
                                            : null,

                                    genero:
                                        participante.genero,

                                    validacion_estado:
                                        aprobado
                                            ? "APROBADO"
                                            : "PENDIENTE",

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
                    errorParticipantes
                ) {
                    /*
                     * Tampoco se borra el equipo.
                     * Se rebaja el formulario a BORRADOR para
                     * que nunca quede una inscripción aprobada
                     * con participantes incompletos.
                     */
                    const {
                        error:
                            errorCompensacion,
                    } =
                        await supabaseAdmin
                            .from(
                                "formularios",
                            )
                            .update({
                                estado:
                                    "BORRADOR",

                                enviado_at:
                                    null,

                                completado_at:
                                    null,

                                updated_at:
                                    new Date()
                                        .toISOString(),
                            })
                            .eq(
                                "id",
                                formularioID,
                            );

                    if (
                        errorCompensacion
                    ) {
                        console.error(
                            "No s'ha pogut deixar en esborrany la inscripció després de fallar la creació dels participants:",
                            errorCompensacion,
                        );
                    }

                    throw errorParticipantes;
                }
            }

            // =================================================
            // RESPUESTA
            // =================================================

            return responder(
                {
                    success: true,

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
                    },

                    equipo: {
                        id:
                            equipoID,

                        nombre:
                            datos.equipo.nombre,

                        capitan_id:
                            capitan?.id ??
                            null,

                        plaza_estado:
                            plazaEstado,

                        posicion_lista_espera:
                            posicionListaEspera,
                    },

                    redireccion:
                        `/panell/equips/${encodeURIComponent(equipoID)}?${new URLSearchParams({
                            torneoID,
                            edicionID,
                        }).toString()}`,
                },
                201,
            );
        } catch (
            error
        ) {
            return responderError(
                error,
            );
        }
    };