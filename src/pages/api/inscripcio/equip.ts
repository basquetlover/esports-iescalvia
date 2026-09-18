import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { NIVELES_ROL, obtenerNivelRol } from "@const/Permisos";

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

const CAMPOS_FORMULARIO =
    "id,edicion_id,tipo,estado,usuario_id,email_contacto,acceso_capitan,configuracion_snapshot,iniciado_at,enviado_at,completado_at,created_at,updated_at";

const CAMPOS_EQUIPO =
    "id,formulario_id,nombre,escudo,capitan_id,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at,updated_at";

const CAMPOS_PARTICIPANTE =
    "id,equipo_id,nombre,apellido1,apellido2,email,curso,grupo,genero,tipo_participante,validacion_estado,orden,activo,created_at,updated_at";

// ============================================================
// TIPOS
// ============================================================

type Registro =
    Record<string, unknown>;

type TipoParticipante =
    typeof TIPOS_PARTICIPANTE[number];

type EstadoFormulario =
    typeof ESTADOS_FORMULARIO[number];

type Genero =
    | "masculino"
    | "femenino";

type Usuario =
    NonNullable<
        Awaited<
            ReturnType<
                typeof obtenerUsuarioPorToken
            >
        >
    >;

type CursoConfiguracion = {
    curso:
        string;

    grupos:
        string[];
};

type ConfiguracionEquipos = {
    inscripcion: {
        apertura:
            string | null;

        cierre:
            string | null;
    };

    cupo: {
        maximo:
            number | null;

        al_superar:
            | "permitir"
            | "lista_espera"
            | "bloquear";
    };

    cursos:
        CursoConfiguracion[];

    jugadores: {
        minimo:
            number | null;

        maximo:
            number | null;
    };

    genero: {
        activo:
            boolean;

        minimos: {
            masculino:
                number;

            femenino:
                number;
        };
    };

    profesores: {
        permitidos:
            boolean;

        minimo:
            number;

        maximo:
            number;

        cuentan_como_jugador:
            boolean;
    };

    entrenador: {
        permitido:
            boolean;
    };

    staff: {
        permitido:
            boolean;

        minimo:
            number;

        maximo:
            number;
    };
};

type ConfiguracionPlataforma = {
    admin_mode:
        boolean;

    emails:
        string[];

    dominios:
        string[];
};

type TorneoFormulario = {
    id:
        string;

    nombre:
        string;

    deporte:
        string | null;

    logo:
        string | null;

    banner:
        string | null;
};

type ParticipanteEntrada = {
    id:
        string | null;

    tipo_participante:
        TipoParticipante;

    nombre:
        string;

    apellido1:
        string;

    apellido2:
        string;

    email:
        string;

    curso:
        string;

    grupo:
        string;

    genero:
        Genero | null;

    orden:
        number;
};

type EquipoEntrada = {
    id:
        string | null;

    nombre:
        string;

    escudo:
        string | null;

    capitan_id:
        string | null;
};

type DatosEntrada = {
    acceso_capitan:
        boolean;

    equipo:
        EquipoEntrada;

    participantes:
        ParticipanteEntrada[];
};

type FormularioDB = {
    id:
        string;

    edicion_id:
        string;

    tipo:
        string | null;

    estado:
        string | null;

    usuario_id:
        string | null;

    email_contacto:
        string | null;

    acceso_capitan:
        boolean | null;

    configuracion_snapshot:
        unknown;

    iniciado_at:
        string | null;

    enviado_at:
        string | null;

    completado_at:
        string | null;

    created_at:
        string;

    updated_at:
        string;
};

type EquipoDB = {
    id:
        string;

    formulario_id:
        string;

    nombre:
        string | null;

    escudo:
        string | null;

    capitan_id:
        string | null;

    validacion_estado:
        string | null;

    plaza_estado:
        string | null;

    posicion_lista_espera:
        number | null;

    nota_admin:
        string | null;

    created_at:
        string;

    updated_at:
        string;
};

type ParticipanteDB = {
    id:
        string;

    equipo_id:
        string;

    nombre:
        string | null;

    apellido1:
        string | null;

    apellido2:
        string | null;

    email:
        string | null;

    curso:
        string | null;

    grupo:
        string | null;

    genero:
        string | null;

    tipo_participante:
        string | null;

    validacion_estado:
        string | null;

    orden:
        number | null;

    activo:
        boolean;

    created_at:
        string;

    updated_at:
        string;
};

type AccesoFormulario = {
    formulario:
        FormularioDB;

    equipo:
        EquipoDB | null;

    propietario:
        boolean;

    capitan:
        boolean;

    puede_ver:
        boolean;

    puede_editar:
        boolean;

    puede_cambiar_acceso_capitan:
        boolean;
};

// ============================================================
// ERROR API
// ============================================================

class ErrorAPI extends Error {
    constructor(
        public estado:
            number,

        mensaje:
            string,
    ) {
        super(
            mensaje,
        );
    }
}

// ============================================================
// RESPUESTAS
// ============================================================

function responder(
    datos:
        unknown,

    estado =
        200,
) {
    return Response.json(
        datos,
        {
            status:
                estado,

            headers: {
                "Cache-Control":
                    "private, no-store",
            },
        },
    );
}

function responderError(
    error:
        unknown,
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
        "Error en la inscripció d'equips:",
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
// HELPERS
// ============================================================

function esRegistro(
    valor:
        unknown,
): valor is Registro {
    return (
        valor !==
            null &&
        typeof valor ===
            "object" &&
        !Array.isArray(
            valor,
        )
    );
}

function texto(
    valor:
        unknown,

    nombre:
        string,

    maximo:
        number,

    obligatorio =
        false,
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
    valor:
        unknown,
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
    valor:
        unknown,

    defecto =
        0,
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
    valor:
        unknown,
) {
    return typeof valor ===
        "string"
        ? valor
        : null;
}

function normalizarEmail(
    valor:
        string,
) {
    return valor
        .trim()
        .toLowerCase();
}

function emailValido(
    valor:
        string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        valor,
    );
}

function estadoFormulario(
    valor:
        string | null,
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
    estado:
        string | null,
) {
    return estado
        ?.trim()
        .toUpperCase() ??
        "";
}

function edicionActiva(
    estado:
        string | null,
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
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return null;
    }

    const resultado =
        new Date(
            valor,
        );

    return Number.isNaN(
        resultado.getTime(),
    )
        ? null
        : resultado;
}

function exigirUUID(
    valor:
        unknown,

    nombre:
        string,
) {
    if (
        typeof valor !==
            "string" ||
        !UUID.test(
            valor,
        )
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

async function leerJSON(
    request:
        Request,
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

function comprobarOrigen(
    request:
        Request,

    url:
        URL,
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

async function obtenerUsuario(
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

async function exigirUsuario(
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
                path:
                    "/",
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
    usuario:
        Usuario | null,
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

function puedeIgnorarPeriodo(
    usuario:
        Usuario | null,

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
// CONFIGURACIÓN EDICIÓN
// ============================================================

function normalizarCursos(
    valor:
        unknown,
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
    valor:
        unknown,
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
    valor:
        unknown,
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
                "admin_mode,emails_registro_permitidos,dominios_registro_permitidos,created_at",
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
            admin_mode:
                false,

            emails:
                [],

            dominios:
                [],
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
    email:
        string,

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
            posicion +
                1,
        );

    return configuracion.dominios.includes(
        dominio,
    );
}

function obtenerEmailCreador(
    usuario:
        Usuario,

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

async function obtenerEdicion(
    edicionID:
        string,
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

async function obtenerConfiguracionEdicion(
    edicionID:
        string,
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

async function obtenerTorneo(
    torneoID:
        string | null,
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

function estadoPeriodo(
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

    usuario:
        Usuario | null,

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

    /*
     * Admin Mode solo permite saltarse apertura/cierre.
     * Si ni siquiera existen fechas válidas, la edición no
     * se considera disponible.
     */
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

async function obtenerEdicionesDisponibles(
    usuario:
        Usuario | null,

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
                        entrada.edicion.torneo_id,
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
                        entrada.edicion.torneo_id,
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

async function obtenerEquipoFormulario(
    formularioID:
        string,
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

async function obtenerParticipantes(
    equipoID:
        string,
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
// NORMALIZAR PARTICIPANTE SALIDA
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

async function cargarFormularioCompleto(
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

async function obtenerFormularioPropietario(
    edicionID:
        string,

    usuarioID:
        string,
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

async function obtenerFormularioComoCapitan(
    edicionID:
        string,

    usuario:
        Usuario,
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
// PERMISOS FORMULARIO
// ============================================================

function permisosFormulario(
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

async function obtenerAccesoPorID(
    formularioID:
        string,

    edicionID:
        string,

    usuario:
        Usuario,
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
    valor:
        unknown,
) {
    if (
        valor ===
            null ||
        valor ===
            undefined ||
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
// LEER PARTICIPANTE
// ============================================================

function leerParticipante(
    valor:
        unknown,

    indice:
        number,
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
            null &&
        valor.id !==
            undefined &&
        valor.id !==
            ""
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
        valor.genero !==
            null &&
        valor.genero !==
            undefined &&
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

function leerDatos(
    valor:
        unknown,
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
        valor.equipo.id !==
            null &&
        valor.equipo.id !==
            undefined &&
        valor.equipo.id !==
            ""
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
// VALIDAR EMAILS
// ============================================================

function validarEmails(
    participantes:
        ParticipanteEntrada[],

    configuracion:
        ConfiguracionPlataforma,
) {
    for (
        let indice =
            0;
        indice <
            participantes.length;
        indice +=
            1
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

// ============================================================
// EMAILS REPETIDOS
// ============================================================

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
    curso:
        string,

    grupo:
        string,

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

function validarEnvio(
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
// DUPLICADOS MISMA EDICIÓN
// ============================================================

async function comprobarDuplicadosEdicion(
    edicionID:
        string,

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

async function guardarParticipantes(
    equipoID:
        string,

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
    // ACTUALIZAR EXISTENTES
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
    // INSERTAR NUEVOS
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
    // DESACTIVAR LOS QUE YA NO ESTÁN
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

function configuracionFormulario(
    formulario:
        FormularioDB,

    actual:
        ConfiguracionEquipos,
) {
    const snapshot =
        normalizarConfiguracionEquipos(
            formulario.configuracion_snapshot,
        );

    return (
        snapshot ??
        actual
    );
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute =
    async ({
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

            // =================================================
            // SIN EDICIÓN
            // =================================================

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

            // =================================================
            // ID INVÁLIDO
            // =================================================

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

            // =================================================
            // EDICIÓN
            // =================================================

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

            // =================================================
            // TORNEO + CONFIGURACIÓN
            // =================================================

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

            // =================================================
            // EDICIÓN INACTIVA
            // =================================================

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

            // =================================================
            // PERÍODO
            // =================================================

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

            // =================================================
            // SIN SESIÓN
            // =================================================

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

            // =================================================
            // FORMULARIO DEL PROPIETARIO
            // =================================================

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

            // =================================================
            // FORMULARIO COMO CAPITÁN
            // =================================================

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

            // =================================================
            // FORMULARIO NUEVO
            // =================================================

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

            // =================================================
            // FORMULARIO EXISTENTE
            // =================================================

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

            // =================================================
            // FORMULARIO
            // =================================================

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

            // =================================================
            // EQUIPO
            // =================================================

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

            // =================================================
            // PARTICIPANTES
            // =================================================

            if (
                datos.participantes.length >
                0
            ) {
                await guardarParticipantes(
                    equipoID,
                    datos.participantes,
                );
            }

            // =================================================
            // RECARGAR
            // =================================================

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

export const PATCH: APIRoute =
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

            // =================================================
            // EDICIÓN
            // =================================================

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

            // =================================================
            // CONFIGURACIÓN
            // =================================================

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

            // =================================================
            // PERÍODO
            // =================================================

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

            // =================================================
            // ACCESO
            // =================================================

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

            // =================================================
            // VALIDACIONES
            // =================================================

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

            // =================================================
            // CREAR EQUIPO SI FALTA
            // =================================================

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

            // =================================================
            // DUPLICADOS MISMA EDICIÓN
            // =================================================

            await comprobarDuplicadosEdicion(
                edicionID,
                datos.participantes,
                equipo.id,
            );

            // =================================================
            // CAPITÁN
            // =================================================

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

            // =================================================
            // PROTEGER EMAIL DEL CAPITÁN
            // =================================================

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

            // =================================================
            // GUARDAR PARTICIPANTES
            // =================================================

            await guardarParticipantes(
                equipo.id,
                datos.participantes,
            );

            // =================================================
            // COMPROBAR CAPITÁN
            // =================================================

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

            // =================================================
            // ACCESO CAPITÁN
            // =================================================

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

            // =================================================
            // ACTUALIZAR EQUIPO
            // =================================================

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

            // =================================================
            // ESTADO FORMULARIO
            // =================================================

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

            // =================================================
            // ACTUALIZAR FORMULARIO
            // ============================================================

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