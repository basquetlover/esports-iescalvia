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

const MAX_MENSAJE_OBSERVACION =
    2000;

const MAX_CAMPO_OBSERVACION =
    120;

const MAX_OBSERVACIONES =
    100;

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

const ESTADOS_PLAZA = [
    "PENDIENTE",
    "CONFIRMADA",
    "LISTA_ESPERA",
    "SIN_PLAZA",
] as const;

const TIPOS_ENTIDAD_OBSERVACION = [
    "FORMULARIO",
    "EQUIPO",
    "PARTICIPANTE",
] as const;

// ============================================================
// CAMPOS DB
// ============================================================

const CAMPOS_FORMULARIO =
    "id,edicion_id,tipo,estado,usuario_id,email_contacto,acceso_capitan,configuracion_snapshot,iniciado_at,enviado_at,completado_at,created_at,updated_at";

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

type EstadoFormulario =
    typeof ESTADOS_FORMULARIO[number];

type EstadoPlaza =
    typeof ESTADOS_PLAZA[number];

type TipoEntidadObservacion =
    typeof TIPOS_ENTIDAD_OBSERVACION[number];

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

type FormularioDB = {
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

type ResponsableDB = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    ano_academico: string | null;
    activa?: boolean | null;
};

type ParticipanteEntrada = {
    id: string | null;
    tipo_participante: TipoParticipante;
    nombre: string;
    apellido1: string;
    apellido2: string;
    email: string;
    curso: string;
    grupo: string;
    genero: Genero | null;
    orden: number;
};

type DatosEdicion = {
    responsable: {
        email: string;
        vincular_usuario: boolean;
    };

    acceso_capitan: boolean;

    equipo: {
        nombre: string;
        escudo: string | null;
        capitan_email: string;
        nota_admin: string | null;
    };

    participantes:
        ParticipanteEntrada[];
};

type ObservacionEntrada = {
    entidad_tipo:
        TipoEntidadObservacion;

    entidad_id:
        string;

    campo:
        string;

    mensaje:
        string;
};

type AccionPatch =
    | "editar"
    | "aprobar"
    | "solicitar-cambios"
    | "cambiar-plaza";

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
                success:
                    false,

                mensaje:
                    error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error en la gestió administrativa de l'equip:",
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
// HELPERS BÁSICOS
// ============================================================

function esRegistro(
    valor: unknown,
): valor is Registro {
    return (
        valor !== null &&
        typeof valor ===
            "object" &&
        !Array.isArray(
            valor,
        )
    );
}

function leerID(
    valor: unknown,
    nombre: string,
) {
    if (
        typeof valor !==
            "string" ||
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
        typeof valor ===
            "number" &&
        Number.isFinite(
            valor,
        )
    )
        ? valor
        : null;
}

function numero(
    valor: unknown,
    defecto = 0,
) {
    return (
        typeof valor ===
            "number" &&
        Number.isFinite(
            valor,
        )
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

function normalizarEstadoFormulario(
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

function normalizarTipoParticipante(
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

function leerEscudo(
    valor: unknown,
) {
    if (
        valor === undefined ||
        valor === null ||
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
// PETICIÓN
// ============================================================

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

    const contenido =
        request.headers
            .get(
                "content-type",
            )
            ?.split(";")[0]
            .trim()
            .toLowerCase();

    if (
        contenido !==
        "application/json"
    ) {
        throw new ErrorAPI(
            415,
            "El format de la petició no és vàlid.",
        );
    }

    const texto =
        await request.text();

    if (
        new TextEncoder()
            .encode(
                texto,
            )
            .byteLength >
        MAX_JSON_BYTES
    ) {
        throw new ErrorAPI(
            413,
            "La petició és massa gran.",
        );
    }

    let cuerpo:
        unknown;

    try {
        cuerpo =
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
            cuerpo,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La petició no és vàlida.",
        );
    }

    return cuerpo;
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

function exigirAcceso(
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

function exigirPermisoEditar(
    usuario: Usuario,
    torneoID: string,
) {
    exigirAcceso(
        usuario,
        torneoID,
    );

    if (
        !tienePermiso(
            usuario,
            "equips",
            "editar",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per modificar equips.",
        );
    }
}

function exigirPermisoEvaluar(
    usuario: Usuario,
    torneoID: string,
) {
    exigirAcceso(
        usuario,
        torneoID,
    );

    if (
        !tienePermiso(
            usuario,
            "equips",
            "evaluar",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per avaluar inscripcions.",
        );
    }
}

function exigirPermisoCambiarEstado(
    usuario: Usuario,
    torneoID: string,
) {
    exigirAcceso(
        usuario,
        torneoID,
    );

    if (
        !tienePermiso(
            usuario,
            "equips",
            "canviar-estat",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per modificar l'estat de la plaça.",
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

    if (error) {
        throw error;
    }

    return normalizarConfiguracionEquipos(
        data?.equipos,
    );
}

async function obtenerConfiguracionFormulario(
    formulario:
        FormularioDB,
) {
    const snapshot =
        normalizarConfiguracionEquipos(
            formulario.configuracion_snapshot,
        );

    if (snapshot) {
        return snapshot;
    }

    const actual =
        await obtenerConfiguracionEdicion(
            formulario.edicion_id,
        );

    if (!actual) {
        throw new ErrorAPI(
            409,
            "No s'ha pogut obtenir la configuració de participants d'aquesta inscripció.",
        );
    }

    return actual;
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
            emails:
                [],

            dominios:
                [],
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

// ============================================================
// TORNEO
// ============================================================

async function obtenerTorneo(
    torneoID: string,
) {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("torneos")
            .select(
                "id,nombre,deporte,logo",
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

    return data;
}

// ============================================================
// EDICIÓN
// ============================================================

async function obtenerEdicion(
    edicionID: string,
    torneoID: string,
) {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("ediciones")
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

    if (error) {
        throw error;
    }

    if (!data) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat l'edició o no pertany al torneig seleccionat.",
        );
    }

    return data;
}

// ============================================================
// EQUIPO
// ============================================================

async function obtenerEquipo(
    equipoID: string,
): Promise<EquipoDB> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("equipos")
            .select(
                CAMPOS_EQUIPO,
            )
            .eq(
                "id",
                equipoID,
            )
            .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
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

async function obtenerFormulario(
    formularioID: string,
    edicionID: string,
): Promise<FormularioDB> {
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

    if (error) {
        throw error;
    }

    if (!data) {
        throw new ErrorAPI(
            404,
            "L'equip no pertany a aquesta edició.",
        );
    }

    return data as FormularioDB;
}

// ============================================================
// PARTICIPANTES
// ============================================================

async function obtenerParticipantes(
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

                    nullsFirst:
                        false,
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
// RESPONSABLE
// ============================================================

async function obtenerResponsable(
    usuarioID:
        string | null,
): Promise<ResponsableDB | null> {
    if (
        !usuarioID ||
        !UUID.test(
            usuarioID,
        )
    ) {
        return null;
    }

    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from("users")
            .select(
                "id,nombre,apellido1,apellido2,email,curso,ano_academico,activa",
            )
            .eq(
                "id",
                usuarioID,
            )
            .maybeSingle();

    if (error) {
        throw error;
    }

    return (
        data as ResponsableDB |
        null
    );
}

// ============================================================
// OBSERVACIONES
// ============================================================

async function obtenerObservaciones(
    formularioID:
        string,
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

    if (error) {
        throw error;
    }

    return (
        data ??
        []
    );
}

async function resolverObservacionesPendientes(
    formularioID:
        string,
    usuarioID:
        string,
) {
    const observaciones =
        await obtenerObservaciones(
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
            )
            .filter(
                (
                    id,
                ): id is string =>
                    typeof id ===
                        "string" &&
                    Boolean(id),
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

    if (error) {
        throw error;
    }
}

// ============================================================
// PREPARAR PARTICIPANTE SALIDA
// ============================================================

function prepararParticipante(
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
            participante.genero ??
            null,

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
// LEER PARTICIPANTE EDICIÓN
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
        valor.id !==
            undefined &&
        valor.id !==
            null &&
        valor.id !==
            ""
    ) {
        id =
            leerID(
                valor.id,
                `id del participant ${indice + 1}`,
            );
    }

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
            tipoRaw as TipoParticipante,

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
// LEER EDICIÓN ADMINISTRATIVA
// ============================================================

function leerDatosEdicion(
    cuerpo: Registro,
): DatosEdicion {
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

    const responsableEmail =
        normalizarEmail(
            leerTexto(
                cuerpo.responsable.email,
                "correu del responsable",
                MAX_EMAIL,
            ),
        );

    if (
        responsableEmail &&
        !emailValido(
            responsableEmail,
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
        !responsableEmail
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
                "Hi ha participants repetits.",
            );
        }

        ids.add(
            participante.id,
        );
    }

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

    return {
        responsable: {
            email:
                responsableEmail,

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
    };
}

// ============================================================
// EMAILS
// ============================================================

function validarEmailsPermitidos(
    datos:
        DatosEdicion,
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
        profesores.length >
            0
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
        !configuracion
            .staff
            .permitido &&
        staff.length >
            0
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
            .maximo >
            0 &&
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
            .maximo >
            0 &&
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
// VALIDACIÓN COMPLETA
// ============================================================

function validarEquipoCompleto(
    datos:
        DatosEdicion,
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
// DUPLICADOS EDICIÓN
// ============================================================

async function comprobarDuplicadosEdicion(
    edicionID:
        string,
    participantes:
        ParticipanteEntrada[],
    equipoActualID:
        string,
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
            .select("id")
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
// RESPONSABLE EDICIÓN
// ============================================================

async function resolverResponsable(
    edicionID:
        string,
    formularioActualID:
        string,
    responsable:
        DatosEdicion["responsable"],
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
            formularios,

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
                responsable.email,
            ),
    };
}

// ============================================================
// GUARDAR PARTICIPANTES ADMIN
// ============================================================

async function guardarParticipantes(
    equipo:
        EquipoDB,
    participantes:
        ParticipanteEntrada[],
    estadoFormulario:
        EstadoFormulario,
) {
    const actuales =
        await obtenerParticipantes(
            equipo.id,
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

    const preparados =
        participantes.map(
            participante => ({
                ...participante,

                id:
                    participante.id ??
                    randomUUID(),
            }),
        );

    const ahora =
        new Date()
            .toISOString();

    // ========================================================
    // ACTUALIZAR EXISTENTES
    // ========================================================

    for (
        const participante
        of preparados
    ) {
        if (
            !participante.id ||
            !mapaActuales.has(
                participante.id,
            )
        ) {
            continue;
        }

        const actual =
            mapaActuales.get(
                participante.id,
            )!;

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

                    validacion_estado:
                        estadoFormulario ===
                            "APROBADO"
                            ? "APROBADO"
                            : actual.validacion_estado,

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
                    equipo.id,
                );

        if (error) {
            throw error;
        }
    }

    // ========================================================
    // VALIDAR IDS EXISTENTES
    // ========================================================

    for (
        const participante
        of participantes
    ) {
        if (
            participante.id &&
            !mapaActuales.has(
                participante.id,
            )
        ) {
            throw new ErrorAPI(
                400,
                "Hi ha un participant que no pertany a aquest equip.",
            );
        }
    }

    // ========================================================
    // INSERTAR NUEVOS
    // ========================================================

    const nuevos =
        preparados.filter(
            participante =>
                !participantes.find(
                    original =>
                        original.id ===
                        participante.id,
                ),
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
                                participante.id,

                            equipo_id:
                                equipo.id,

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

                            validacion_estado:
                                estadoFormulario ===
                                    "APROBADO"
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

        if (error) {
            throw error;
        }

        for (
            const nuevo
            of nuevos
        ) {
            idsConservados.add(
                nuevo.id,
            );
        }
    }

    // ========================================================
    // DESACTIVAR RETIRADOS
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
                    equipo.id,
                )
                .in(
                    "id",
                    idsDesactivar,
                );

        if (error) {
            throw error;
        }
    }

    return preparados;
}

// ============================================================
// OBSERVACIONES ENTRADA
// ============================================================

function prepararObservacionesEntrada(
    valor: unknown,
    formulario:
        FormularioDB,
    equipo:
        EquipoDB,
    participantes:
        ParticipanteDB[],
): ObservacionEntrada[] {
    if (
        !Array.isArray(
            valor,
        ) ||
        valor.length ===
            0
    ) {
        throw new ErrorAPI(
            400,
            "Has d'indicar almenys una correcció abans de retornar la inscripció.",
        );
    }

    if (
        valor.length >
        MAX_OBSERVACIONES
    ) {
        throw new ErrorAPI(
            400,
            "Hi ha massa observacions en una sola revisió.",
        );
    }

    const idsParticipantes =
        new Set(
            participantes.map(
                participante =>
                    participante.id,
            ),
        );

    return valor.map(
        (
            elemento,
            indice,
        ) => {
            if (
                !esRegistro(
                    elemento,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    `L'observació ${indice + 1} no és vàlida.`,
                );
            }

            const tipoRaw =
                leerTexto(
                    elemento.entidad_tipo,
                    "entidad_tipo",
                    30,
                    true,
                )
                    .toUpperCase();

            if (
                !TIPOS_ENTIDAD_OBSERVACION.includes(
                    tipoRaw as TipoEntidadObservacion,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    `El tipus de l'observació ${indice + 1} no és vàlid.`,
                );
            }

            const entidadTipo =
                tipoRaw as TipoEntidadObservacion;

            const entidadID =
                leerID(
                    elemento.entidad_id,
                    "entidad_id",
                );

            const campo =
                leerTexto(
                    elemento.campo,
                    "campo",
                    MAX_CAMPO_OBSERVACION,
                    true,
                );

            const mensaje =
                leerTexto(
                    elemento.mensaje,
                    "mensaje",
                    MAX_MENSAJE_OBSERVACION,
                    true,
                );

            if (
                entidadTipo ===
                    "FORMULARIO" &&
                entidadID !==
                    formulario.id
            ) {
                throw new ErrorAPI(
                    400,
                    "L'observació no correspon a aquest formulari.",
                );
            }

            if (
                entidadTipo ===
                    "EQUIPO" &&
                entidadID !==
                    equipo.id
            ) {
                throw new ErrorAPI(
                    400,
                    "L'observació no correspon a aquest equip.",
                );
            }

            if (
                entidadTipo ===
                    "PARTICIPANTE" &&
                !idsParticipantes.has(
                    entidadID,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    "L'observació correspon a un participant que no pertany a aquest equip.",
                );
            }

            return {
                entidad_tipo:
                    entidadTipo,

                entidad_id:
                    entidadID,

                campo,

                mensaje,
            };
        },
    );
}

// ============================================================
// ESTADO EVALUABLE
// ============================================================

function exigirFormularioEnRevision(
    formulario:
        FormularioDB,
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
// VERSIONES
// ============================================================

function exigirMismaVersion(
    actual:
        string | null,
    recibida:
        unknown,
    entidad:
        string,
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
// GET
// ============================================================

export const GET: APIRoute =
    async ({
        cookies,
        url,
        params,
    }) => {
        try {
            const usuario =
                await exigirUsuario(
                    cookies.get(
                        "token_sesion",
                    )?.value,
                );

            const equipoID =
                leerID(
                    params.id,
                    "id",
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

            exigirAcceso(
                usuario,
                torneoID,
            );

            const [
                torneo,
                edicion,
                equipo,
            ] =
                await Promise.all([
                    obtenerTorneo(
                        torneoID,
                    ),

                    obtenerEdicion(
                        edicionID,
                        torneoID,
                    ),

                    obtenerEquipo(
                        equipoID,
                    ),
                ]);

            const formulario =
                await obtenerFormulario(
                    equipo.formulario_id,
                    edicionID,
                );

            const [
                participantes,
                responsable,
                observaciones,
                configuracion,
            ] =
                await Promise.all([
                    obtenerParticipantes(
                        equipo.id,
                    ),

                    obtenerResponsable(
                        formulario.usuario_id,
                    ),

                    obtenerObservaciones(
                        formulario.id,
                    ),

                    obtenerConfiguracionFormulario(
                        formulario,
                    ),
                ]);

            const preparados =
                participantes.map(
                    participante =>
                        prepararParticipante(
                            participante,
                            equipo.capitan_id,
                        ),
                );

            const capitan =
                preparados.find(
                    participante =>
                        participante.es_capitan,
                ) ??
                null;

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
                        torneo.deporte ??
                        null,

                    logo:
                        torneo.logo ??
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
                        edicion.estado ??
                        "",

                    sede:
                        edicion.sede ??
                        null,

                    fecha_inicio:
                        edicion.fecha_inicio ??
                        null,

                    fecha_fin:
                        edicion.fecha_fin ??
                        null,
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
                        equipo.escudo ??
                        null,

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
                                  formulario.email_contacto ??
                                  "",

                              curso:
                                  responsable.curso ??
                                  "",

                              ano_academico:
                                  responsable.ano_academico ??
                                  "",
                          }
                        : {
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
                                  formulario.email_contacto ??
                                  "",

                              curso:
                                  "",

                              ano_academico:
                                  "",
                          },

                participantes: {
                    total:
                        preparados.length,

                    jugadores:
                        preparados.filter(
                            participante =>
                                participante.tipo_participante ===
                                "JUGADOR",
                        ).length,

                    profesores:
                        preparados.filter(
                            participante =>
                                participante.tipo_participante ===
                                "PROFESOR",
                        ).length,

                    entrenadores:
                        preparados.filter(
                            participante =>
                                participante.tipo_participante ===
                                "ENTRENADOR",
                        ).length,

                    staff:
                        preparados.filter(
                            participante =>
                                participante.tipo_participante ===
                                "STAFF",
                        ).length,

                    capitan,

                    filas:
                        preparados,
                },

                observaciones:
                    observaciones.map(
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
                                observacion.entidad_id ??
                                null,

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
                                observacion.creada_por ??
                                null,

                            resuelta_por:
                                observacion.resuelta_por ??
                                null,

                            created_at:
                                observacion.created_at ??
                                null,
                        }),
                    ),

                capacidades: {
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

// ============================================================
// PATCH
// ============================================================

export const PATCH: APIRoute =
    async ({
        cookies,
        url,
        params,
        request,
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

            const equipoID =
                leerID(
                    params.id,
                    "id",
                );

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

            const accionRaw =
                leerTexto(
                    cuerpo.accion,
                    "accion",
                    50,
                    true,
                );

            if (
                accionRaw !==
                    "editar" &&
                accionRaw !==
                    "aprobar" &&
                accionRaw !==
                    "solicitar-cambios" &&
                accionRaw !==
                    "cambiar-plaza"
            ) {
                throw new ErrorAPI(
                    400,
                    "L'acció indicada no és vàlida.",
                );
            }

            const accion =
                accionRaw as
                    AccionPatch;

            if (
                accion ===
                "editar"
            ) {
                exigirPermisoEditar(
                    usuario,
                    torneoID,
                );
            } else if (
                accion ===
                "cambiar-plaza"
            ) {
                exigirPermisoCambiarEstado(
                    usuario,
                    torneoID,
                );
            } else {
                exigirPermisoEvaluar(
                    usuario,
                    torneoID,
                );
            }

            await obtenerEdicion(
                edicionID,
                torneoID,
            );

            const equipo =
                await obtenerEquipo(
                    equipoID,
                );

            const formulario =
                await obtenerFormulario(
                    equipo.formulario_id,
                    edicionID,
                );

            // =================================================
            // EDITAR EQUIPO COMPLETO
            // =================================================

            if (
                accion ===
                "editar"
            ) {
                exigirMismaVersion(
                    formulario.updated_at,
                    cuerpo.formulario_updated_at,
                    "la inscripció",
                );

                exigirMismaVersion(
                    equipo.updated_at,
                    cuerpo.equipo_updated_at,
                    "l'equip",
                );

                const [
                    configuracion,
                    configuracionPlataforma,
                ] =
                    await Promise.all([
                        obtenerConfiguracionFormulario(
                            formulario,
                        ),

                        obtenerConfiguracionPlataforma(),
                    ]);

                const datos =
                    leerDatosEdicion(
                        cuerpo,
                    );

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

                const estado =
                    normalizarEstadoFormulario(
                        formulario.estado,
                    );

                /*
                 * Los borradores pueden continuar incompletos.
                 *
                 * Todo equipo que ya ha sido enviado debe seguir
                 * cumpliendo los requisitos completos aunque sea
                 * modificado directamente por administración.
                 */
                if (
                    estado !==
                    "BORRADOR"
                ) {
                    validarEquipoCompleto(
                        datos,
                        configuracion,
                    );
                }

                await comprobarDuplicadosEdicion(
                    edicionID,
                    datos.participantes,
                    equipo.id,
                );

                const responsable =
                    await resolverResponsable(
                        edicionID,
                        formulario.id,
                        datos.responsable,
                    );

                // =============================================
                // PREPARAR CAPITÁN
                // =============================================

                if (
                    datos.acceso_capitan &&
                    !datos.equipo
                        .capitan_email
                ) {
                    throw new ErrorAPI(
                        400,
                        "Per donar accés al capità primer l'has de seleccionar.",
                    );
                }

                const ahora =
                    new Date()
                        .toISOString();

                // =============================================
                // ACTUALIZAR FORMULARIO
                // =============================================

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
                                responsable.usuario_id,

                            email_contacto:
                                responsable.email_contacto,

                            acceso_capitan:
                                datos.acceso_capitan,

                            /*
                             * Estado, enviado_at y completado_at
                             * NO cambian por una edición admin.
                             */
                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            formulario.id,
                        )
                        .eq(
                            "edicion_id",
                            edicionID,
                        )
                        .eq(
                            "updated_at",
                            formulario.updated_at,
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
                    !formularioActualizado
                ) {
                    throw new ErrorAPI(
                        409,
                        "La inscripció ha canviat mentre la modificaves. Torna a carregar-la.",
                    );
                }

                // =============================================
                // PARTICIPANTES
                // =============================================

                const participantesGuardados =
                    await guardarParticipantes(
                        equipo,
                        datos.participantes,
                        estado,
                    );

                // =============================================
                // RESOLVER CAPITÁN CON IDS DEFINITIVOS
                // =============================================

                let capitanID:
                    string | null =
                    null;

                if (
                    datos.equipo
                        .capitan_email
                ) {
                    const capitan =
                        participantesGuardados.find(
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

                    if (!capitan) {
                        throw new ErrorAPI(
                            400,
                            "El capità seleccionat no correspon a cap jugador actiu de l'equip.",
                        );
                    }

                    capitanID =
                        capitan.id;
                }

                // =============================================
                // ACTUALIZAR EQUIPO
                // =============================================

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
                                datos.equipo.nombre ||
                                null,

                            escudo:
                                datos.equipo.escudo,

                            capitan_id:
                                capitanID,

                            nota_admin:
                                datos.equipo.nota_admin,

                            /*
                             * Si ya estaba aprobado, la edición
                             * administrativa continúa aprobada.
                             */
                            validacion_estado:
                                estado ===
                                    "APROBADO"
                                    ? "APROBADO"
                                    : equipo.validacion_estado,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            equipo.id,
                        )
                        .eq(
                            "formulario_id",
                            formulario.id,
                        )
                        .eq(
                            "updated_at",
                            equipo.updated_at,
                        )
                        .select(
                            CAMPOS_EQUIPO,
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

                return responder({
                    success:
                        true,

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
                            normalizarEstadoPlaza(
                                equipoActualizado.plaza_estado,
                            ),

                        updated_at:
                            equipoActualizado.updated_at,
                    },
                });
            }

            // =================================================
            // APROBAR
            // =================================================

            if (
                accion ===
                "aprobar"
            ) {
                exigirFormularioEnRevision(
                    formulario,
                );

                exigirMismaVersion(
                    formulario.updated_at,
                    cuerpo.formulario_updated_at,
                    "la inscripció",
                );

                const participantes =
                    await obtenerParticipantes(
                        equipo.id,
                    );

                const ahora =
                    new Date()
                        .toISOString();

                // Cerrar observaciones anteriores
                await resolverObservacionesPendientes(
                    formulario.id,
                    usuario.id,
                );

                // Validar equipo
                const {
                    error:
                        errorValidacionEquipo,
                } =
                    await supabaseAdmin
                        .from(
                            "equipos",
                        )
                        .update({
                            validacion_estado:
                                "APROBADO",

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            equipo.id,
                        );

                if (
                    errorValidacionEquipo
                ) {
                    throw errorValidacionEquipo;
                }

                // Validar participantes
                if (
                    participantes.length >
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
                            .update({
                                validacion_estado:
                                    "APROBADO",

                                updated_at:
                                    ahora,
                            })
                            .eq(
                                "equipo_id",
                                equipo.id,
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
                            estado:
                                "APROBADO",

                            completado_at:
                                ahora,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            formulario.id,
                        )
                        .eq(
                            "edicion_id",
                            edicionID,
                        )
                        .eq(
                            "estado",
                            "EN_REVISION",
                        )
                        .eq(
                            "updated_at",
                            formulario.updated_at,
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
                    !formularioActualizado
                ) {
                    throw new ErrorAPI(
                        409,
                        "La inscripció ha canviat des que l'has carregada. Actualitza la fitxa abans d'avaluar-la.",
                    );
                }

                return responder({
                    success:
                        true,

                    mensaje:
                        "Inscripció aprovada correctament.",

                    formulario: {
                        id:
                            formularioActualizado.id,

                        estado:
                            "APROBADO",

                        completado_at:
                            formularioActualizado.completado_at,

                        updated_at:
                            formularioActualizado.updated_at,
                    },
                });
            }

            // =================================================
            // SOLICITAR CAMBIOS
            // =================================================

            if (
                accion ===
                "solicitar-cambios"
            ) {
                exigirFormularioEnRevision(
                    formulario,
                );

                exigirMismaVersion(
                    formulario.updated_at,
                    cuerpo.formulario_updated_at,
                    "la inscripció",
                );

                const participantes =
                    await obtenerParticipantes(
                        equipo.id,
                    );

                const observaciones =
                    prepararObservacionesEntrada(
                        cuerpo.observaciones,
                        formulario,
                        equipo,
                        participantes,
                    );

                const ahora =
                    new Date()
                        .toISOString();

                /*
                 * Si el equipo se ha vuelto a enviar después de
                 * corregir una revisión anterior, cerramos primero
                 * las observaciones antiguas.
                 */
                await resolverObservacionesPendientes(
                    formulario.id,
                    usuario.id,
                );

                const {
                    data:
                        observacionesInsertadas,

                    error:
                        errorObservaciones,
                } =
                    await supabaseAdmin
                        .from(
                            "observaciones_campos",
                        )
                        .insert(
                            observaciones.map(
                                observacion => ({
                                    edicion_id:
                                        edicionID,

                                    formulario_id:
                                        formulario.id,

                                    entidad_tipo:
                                        observacion.entidad_tipo,

                                    entidad_id:
                                        observacion.entidad_id,

                                    campo:
                                        observacion.campo,

                                    mensaje:
                                        observacion.mensaje,

                                    estado:
                                        "PENDIENTE",

                                    creada_por:
                                        usuario.id,

                                    resuelta_por:
                                        null,

                                    created_at:
                                        ahora,
                                }),
                            ),
                        )
                        .select(
                            "id",
                        );

                if (
                    errorObservaciones
                ) {
                    throw errorObservaciones;
                }

                const idsObservaciones =
                    (
                        observacionesInsertadas ??
                        []
                    )
                        .map(
                            observacion =>
                                observacion.id,
                        )
                        .filter(
                            (
                                id,
                            ): id is string =>
                                typeof id ===
                                    "string" &&
                                Boolean(id),
                        );

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
                            estado:
                                "DENEGADO",

                            completado_at:
                                ahora,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            formulario.id,
                        )
                        .eq(
                            "edicion_id",
                            edicionID,
                        )
                        .eq(
                            "estado",
                            "EN_REVISION",
                        )
                        .eq(
                            "updated_at",
                            formulario.updated_at,
                        )
                        .select(
                            CAMPOS_FORMULARIO,
                        )
                        .maybeSingle();

                if (
                    errorFormulario ||
                    !formularioActualizado
                ) {
                    if (
                        idsObservaciones.length >
                        0
                    ) {
                        const {
                            error:
                                errorCompensacion,
                        } =
                            await supabaseAdmin
                                .from(
                                    "observaciones_campos",
                                )
                                .update({
                                    estado:
                                        "RESUELTA",

                                    resuelta_por:
                                        usuario.id,
                                })
                                .in(
                                    "id",
                                    idsObservaciones,
                                );

                        if (
                            errorCompensacion
                        ) {
                            console.error(
                                "No s'han pogut anul·lar les observacions de la revisió incompleta:",
                                errorCompensacion,
                            );
                        }
                    }

                    if (
                        errorFormulario
                    ) {
                        throw errorFormulario;
                    }

                    throw new ErrorAPI(
                        409,
                        "La inscripció ha canviat des que l'has carregada. Actualitza la fitxa abans d'avaluar-la.",
                    );
                }

                const {
                    error:
                        errorEstadoEquipo,
                } =
                    await supabaseAdmin
                        .from(
                            "equipos",
                        )
                        .update({
                            validacion_estado:
                                "DENEGADO",

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            equipo.id,
                        );

                if (
                    errorEstadoEquipo
                ) {
                    console.error(
                        "No s'ha pogut actualitzar validacion_estado de l'equip:",
                        errorEstadoEquipo,
                    );
                }

                /*
                 * Los participantes concretamente observados se
                 * marcan como DENEGADO.
                 */
                const idsParticipantesObservados = [
                    ...new Set(
                        observaciones
                            .filter(
                                observacion =>
                                    observacion.entidad_tipo ===
                                    "PARTICIPANTE",
                            )
                            .map(
                                observacion =>
                                    observacion.entidad_id,
                            ),
                    ),
                ];

                if (
                    idsParticipantesObservados.length >
                    0
                ) {
                    const {
                        error:
                            errorEstadoParticipantes,
                    } =
                        await supabaseAdmin
                            .from(
                                "participantes_equipo",
                            )
                            .update({
                                validacion_estado:
                                    "DENEGADO",

                                updated_at:
                                    ahora,
                            })
                            .eq(
                                "equipo_id",
                                equipo.id,
                            )
                            .in(
                                "id",
                                idsParticipantesObservados,
                            );

                    if (
                        errorEstadoParticipantes
                    ) {
                        console.error(
                            "No s'ha pogut actualitzar validacion_estado dels participants observats:",
                            errorEstadoParticipantes,
                        );
                    }
                }

                return responder({
                    success:
                        true,

                    mensaje:
                        "La inscripció s'ha retornat perquè es facin les correccions indicades.",

                    formulario: {
                        id:
                            formularioActualizado.id,

                        estado:
                            "DENEGADO",

                        completado_at:
                            formularioActualizado.completado_at,

                        updated_at:
                            formularioActualizado.updated_at,
                    },

                    observacionesCreadas:
                        idsObservaciones.length,
                });
            }

            // =================================================
            // CAMBIAR PLAZA
            // =================================================

            const estadoFormulario =
                normalizarEstadoFormulario(
                    formulario.estado,
                );

            if (
                estadoFormulario ===
                "BORRADOR"
            ) {
                throw new ErrorAPI(
                    409,
                    "No es pot gestionar la plaça d'un equip que encara és un esborrany.",
                );
            }

            exigirMismaVersion(
                equipo.updated_at,
                cuerpo.equipo_updated_at,
                "l'equip",
            );

            const estadoPlazaRaw =
                leerTexto(
                    cuerpo.plaza_estado,
                    "plaza_estado",
                    50,
                    true,
                )
                    .toUpperCase();

            if (
                !ESTADOS_PLAZA.includes(
                    estadoPlazaRaw as EstadoPlaza,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    "L'estat de la plaça no és vàlid.",
                );
            }

            const plazaEstado =
                estadoPlazaRaw as EstadoPlaza;

            let posicionListaEspera:
                number | null =
                null;

            if (
                plazaEstado ===
                "LISTA_ESPERA"
            ) {
                if (
                    typeof cuerpo.posicion_lista_espera !==
                        "number" ||
                    !Number.isSafeInteger(
                        cuerpo.posicion_lista_espera,
                    ) ||
                    cuerpo.posicion_lista_espera <
                        1
                ) {
                    throw new ErrorAPI(
                        400,
                        "Has d'indicar una posició vàlida de la llista d'espera.",
                    );
                }

                posicionListaEspera =
                    cuerpo.posicion_lista_espera;
            }

            let notaAdmin =
                equipo.nota_admin;

            if (
                Object.prototype.hasOwnProperty.call(
                    cuerpo,
                    "nota_admin",
                )
            ) {
                const nota =
                    leerTexto(
                        cuerpo.nota_admin,
                        "nota_admin",
                        MAX_NOTA_ADMIN,
                    );

                notaAdmin =
                    nota ||
                    null;
            }

            const ahora =
                new Date()
                    .toISOString();

            const {
                data:
                    equipoActualizado,

                error:
                    errorEquipo,
            } =
                await supabaseAdmin
                    .from("equipos")
                    .update({
                        plaza_estado:
                            plazaEstado,

                        posicion_lista_espera:
                            posicionListaEspera,

                        nota_admin:
                            notaAdmin,

                        updated_at:
                            ahora,
                    })
                    .eq(
                        "id",
                        equipo.id,
                    )
                    .eq(
                        "formulario_id",
                        formulario.id,
                    )
                    .eq(
                        "updated_at",
                        equipo.updated_at,
                    )
                    .select(
                        CAMPOS_EQUIPO,
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
                    "L'equip ha canviat des que l'has carregat. Actualitza la fitxa abans de modificar la plaça.",
                );
            }

            return responder({
                success:
                    true,

                mensaje:
                    plazaEstado ===
                        "CONFIRMADA"
                        ? "Plaça confirmada correctament."
                        : plazaEstado ===
                              "LISTA_ESPERA"
                          ? "L'equip s'ha incorporat a la llista d'espera."
                          : plazaEstado ===
                                "SIN_PLAZA"
                            ? "L'equip s'ha marcat sense plaça."
                            : "L'estat de la plaça ha quedat pendent.",

                equipo: {
                    id:
                        equipoActualizado.id,

                    plaza_estado:
                        normalizarEstadoPlaza(
                            equipoActualizado.plaza_estado,
                        ),

                    posicion_lista_espera:
                        equipoActualizado.posicion_lista_espera,

                    nota_admin:
                        equipoActualizado.nota_admin,

                    updated_at:
                        equipoActualizado.updated_at,
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