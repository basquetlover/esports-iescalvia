import type { APIRoute } from "astro";
import sanitizeHtml from "sanitize-html";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TABLA_EDICIONES = "ediciones";
const TABLA_CONFIGURACION = "configuracion_ediciones";
const TABLA_CONFIGURACION_PLATAFORMA = "configuracion_plataforma";

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_JSON_BYTES = 1_000_000;

const MAX_BLOQUES = 100;
const MAX_FAQ = 100;
const MAX_TIPOS_VOLUNTARIADO = 100;

const MAX_CURSOS = 50;
const MAX_GRUPOS_POR_CURSO = 100;

const CAMPOS_EDICION =
    "id,torneo_id,nombre,fecha_inicio,fecha_fin,estado,sede,created_at,updated_at";

const CAMPOS_CONFIGURACION =
    "edicion_id,equipos,voluntarios,informacion,faq,competicion,created_at,updated_at";

// ============================================================
// TIPOS
// ============================================================

type Registro =
    Record<
        string,
        unknown
    >;

type Usuario =
    NonNullable<
        Awaited<
            ReturnType<
                typeof obtenerUsuarioPorToken
            >
        >
    >;

type Accion =
    | "ver"
    | "crear"
    | "editar"
    | "eliminar";

type ComportamientoCupo =
    | "permitir"
    | "lista_espera"
    | "bloquear";

type CursoConfiguracion = {
    curso:
        string;

    grupos:
        string[];
};

type TorneoDB = {
    id:
        string;

    nombre:
        string | null;

    deporte:
        string | null;
};

type EdicionDB = {
    id:
        string;

    torneo_id:
        string | null;

    nombre:
        string | null;

    fecha_inicio:
        string | null;

    fecha_fin:
        string | null;

    estado:
        string | null;

    sede:
        string | null;

    created_at:
        string | null;

    updated_at:
        string | null;
};

type ConfiguracionDB = {
    edicion_id:
        string;

    equipos:
        unknown;

    voluntarios:
        unknown;

    informacion:
        unknown;

    faq:
        unknown;

    competicion:
        unknown;

    created_at:
        string | null;

    updated_at:
        string | null;
};

// ============================================================
// ERRORES / RESPUESTAS
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
        "Error en la API d'edicions:",
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

function comprobarClaves(
    objeto:
        Registro,

    permitidas:
        readonly string[],
) {
    const desconocidas =
        Object.keys(
            objeto,
        ).filter(
            clave =>
                !permitidas.includes(
                    clave,
                ),
        );

    if (
        desconocidas.length >
        0
    ) {
        throw new ErrorAPI(
            400,
            "La configuració conté camps no reconeguts.",
        );
    }
}

function leerID(
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
            `El camp ${nombre} no és vàlid.`,
        );
    }

    return valor
        .trim()
        .toLowerCase();
}

function leerTexto(
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

function leerBooleano(
    valor:
        unknown,

    nombre:
        string,
) {
    if (
        typeof valor !==
        "boolean"
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    return valor;
}

function leerEntero(
    valor:
        unknown,

    nombre:
        string,

    minimo:
        number,

    maximo:
        number,
) {
    if (
        typeof valor !==
            "number" ||
        !Number.isSafeInteger(
            valor,
        ) ||
        valor <
            minimo ||
        valor >
            maximo
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    return valor;
}

function leerEnteroNullable(
    valor:
        unknown,

    nombre:
        string,

    minimo:
        number,

    maximo:
        number,
): number | null {
    if (
        valor ===
        null
    ) {
        return null;
    }

    return leerEntero(
        valor,
        nombre,
        minimo,
        maximo,
    );
}

// ============================================================
// JSON
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
            "La configuració de l'edició és massa gran.",
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
            "La configuració de l'edició és massa gran.",
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

    if (
        !usuario
    ) {
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
    usuario:
        Usuario,

    torneoID:
        string,

    accion:
        Accion,
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
        ) ||
        !tienePermiso(
            usuario,
            "edicions",
            "ver",
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens accés a les edicions d'aquest torneig.",
        );
    }

    if (
        accion !==
            "ver" &&
        !tienePermiso(
            usuario,
            "edicions",
            accion,
            torneoID,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per fer aquesta operació.",
        );
    }
}

// ============================================================
// TORNEO
// ============================================================

async function obtenerTorneo(
    torneoID:
        string,
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
                "id,nombre,deporte",
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

async function obtenerEdicion(
    edicionID:
        string,

    torneoID:
        string,
): Promise<EdicionDB> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                TABLA_EDICIONES,
            )
            .select(
                CAMPOS_EDICION,
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

    if (
        !data
    ) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat l'edició.",
        );
    }

    if (
        data.torneo_id !==
        torneoID
    ) {
        throw new ErrorAPI(
            404,
            "L'edició no pertany al torneig seleccionat.",
        );
    }

    return data as EdicionDB;
}

async function obtenerConfiguracion(
    edicionID:
        string,
): Promise<ConfiguracionDB | null> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                TABLA_CONFIGURACION,
            )
            .select(
                CAMPOS_CONFIGURACION,
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

    return data as
        | ConfiguracionDB
        | null;
}

// ============================================================
// CONFIGURACIÓN DE PLATAFORMA
// ============================================================

function normalizarCursosPlataforma(
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

    const resultado:
        CursoConfiguracion[] =
        [];

    for (
        const entrada
        of valor
    ) {
        if (
            !esRegistro(
                entrada,
            ) ||
            typeof entrada.curso !==
                "string"
        ) {
            continue;
        }

        const curso =
            entrada.curso
                .trim();

        if (
            !curso
        ) {
            continue;
        }

        const grupos =
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
                          grupo =>
                              Boolean(
                                  grupo,
                              ),
                      )
                : [];

        resultado.push({
            curso,
            grupos,
        });

        if (
            resultado.length >=
            MAX_CURSOS
        ) {
            break;
        }
    }

    return resultado;
}

async function obtenerCursosPlataforma() {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                TABLA_CONFIGURACION_PLATAFORMA,
            )
            .select(
                "curso_academico_actual,cursos,created_at",
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
        data?.[
            0
        ];

    if (
        !fila
    ) {
        return {
            cursoAcademico:
                null,

            cursos:
                [] as CursoConfiguracion[],
        };
    }

    return {
        cursoAcademico:
            typeof fila
                .curso_academico_actual ===
                "string"
                ? fila
                      .curso_academico_actual
                : null,

        cursos:
            normalizarCursosPlataforma(
                fila.cursos,
            ),
    };
}

// ============================================================
// ESTADOS
// ============================================================

function estadoParaFrontend(
    valor:
        string | null,
) {
    switch (
        valor
            ?.trim()
            .toLowerCase()
    ) {
        case "en_preparacio":
        case "borrador":
        case "esborrany":
            return "BORRADOR";

        case "activa":
        case "activo":
        case "actiu":
            return "ACTIVA";

        case "finalizada":
        case "finalitzada":
        case "finalitzat":
            return "FINALIZADA";

        default:
            return valor
                ? valor.toUpperCase()
                : "BORRADOR";
    }
}

function estadoParaDB(
    valor:
        unknown,
) {
    if (
        typeof valor !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            "L'estat de l'edició no és vàlid.",
        );
    }

    switch (
        valor
            .trim()
            .toUpperCase()
    ) {
        case "BORRADOR":
            return "en_preparacio";

        case "ACTIVA":
            return "activa";

        case "FINALIZADA":
            return "finalizada";

        default:
            throw new ErrorAPI(
                400,
                "L'estat de l'edició no és vàlid.",
            );
    }
}

// ============================================================
// FECHAS
// ============================================================

function leerFecha(
    valor:
        unknown,

    nombre:
        string,
) {
    if (
        typeof valor !==
            "string" ||
        !valor.trim()
    ) {
        throw new ErrorAPI(
            400,
            `Falta ${nombre}.`,
        );
    }

    const fecha =
        new Date(
            valor,
        );

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        throw new ErrorAPI(
            400,
            `${nombre} no és vàlida.`,
        );
    }

    return fecha
        .toISOString();
}

function leerFechaNullable(
    valor:
        unknown,

    nombre:
        string,
): string | null {
    if (
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
            `${nombre} no és vàlida.`,
        );
    }

    const fecha =
        new Date(
            valor,
        );

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        throw new ErrorAPI(
            400,
            `${nombre} no és vàlida.`,
        );
    }

    return fecha
        .toISOString();
}

function validarPeriodo(
    apertura:
        string | null,

    cierre:
        string | null,

    nombre:
        string,
) {
    if (
        Boolean(
            apertura,
        ) !==
        Boolean(
            cierre,
        )
    ) {
        throw new ErrorAPI(
            400,
            `Indica tant l'obertura com el tancament de ${nombre}.`,
        );
    }

    if (
        apertura &&
        cierre &&
        Date.parse(
            cierre,
        ) <
            Date.parse(
                apertura,
            )
    ) {
        throw new ErrorAPI(
            400,
            `El tancament de ${nombre} no pot ser anterior a l'obertura.`,
        );
    }
}

// ============================================================
// CUPO
// ============================================================

function leerComportamientoCupo(
    valor:
        unknown,
): ComportamientoCupo {
    if (
        valor ===
            "permitir" ||
        valor ===
            "lista_espera" ||
        valor ===
            "bloquear"
    ) {
        return valor;
    }

    throw new ErrorAPI(
        400,
        "El comportament del límit no és vàlid.",
    );
}

function leerCupo(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració del límit no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "maximo",
            "al_superar",
        ],
    );

    return {
        maximo:
            leerEnteroNullable(
                valor.maximo,
                "màxim",
                0,
                100_000,
            ),

        al_superar:
            leerComportamientoCupo(
                valor.al_superar,
            ),
    };
}

// ============================================================
// INSCRIPCIÓN
// ============================================================

function leerInscripcion(
    valor:
        unknown,

    nombre:
        string,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            `La configuració de ${nombre} no és vàlida.`,
        );
    }

    comprobarClaves(
        valor,
        [
            "apertura",
            "cierre",
        ],
    );

    const apertura =
        leerFechaNullable(
            valor.apertura,
            "La data d'obertura",
        );

    const cierre =
        leerFechaNullable(
            valor.cierre,
            "La data de tancament",
        );

    validarPeriodo(
        apertura,
        cierre,
        nombre,
    );

    return {
        apertura,
        cierre,
    };
}

// ============================================================
// CURSOS
// ============================================================

function leerCursos(
    valor:
        unknown,
): CursoConfiguracion[] {
    /*
     * Compatibilidad con ediciones antiguas.
     * Si todavía no tenían "cursos" se interpreta como [].
     */
    if (
        valor ===
        undefined ||
        valor ===
        null
    ) {
        return [];
    }

    if (
        !Array.isArray(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració dels cursos no és vàlida.",
        );
    }

    if (
        valor.length >
        MAX_CURSOS
    ) {
        throw new ErrorAPI(
            400,
            `No es poden configurar més de ${MAX_CURSOS} cursos.`,
        );
    }

    const resultado:
        CursoConfiguracion[] =
        [];

    const cursosUsados =
        new Set<string>();

    for (
        const entrada
        of valor
    ) {
        if (
            !esRegistro(
                entrada,
            )
        ) {
            throw new ErrorAPI(
                400,
                "Hi ha un curs no vàlid.",
            );
        }

        comprobarClaves(
            entrada,
            [
                "curso",
                "grupos",
            ],
        );

        const curso =
            leerTexto(
                entrada.curso,
                "nom del curs",
                100,
                true,
            );

        const claveCurso =
            curso.toLocaleLowerCase(
                "ca-ES",
            );

        if (
            cursosUsados.has(
                claveCurso,
            )
        ) {
            throw new ErrorAPI(
                400,
                `El curs "${curso}" està repetit.`,
            );
        }

        cursosUsados.add(
            claveCurso,
        );

        if (
            !Array.isArray(
                entrada.grupos,
            )
        ) {
            throw new ErrorAPI(
                400,
                `Els grups del curs "${curso}" no són vàlids.`,
            );
        }

        if (
            entrada
                .grupos
                .length >
            MAX_GRUPOS_POR_CURSO
        ) {
            throw new ErrorAPI(
                400,
                `El curs "${curso}" té massa grups.`,
            );
        }

        const grupos:
            string[] =
            [];

        const gruposUsados =
            new Set<string>();

        for (
            const entradaGrupo
            of entrada.grupos
        ) {
            const grupo =
                leerTexto(
                    entradaGrupo,
                    `grup de ${curso}`,
                    150,
                    true,
                );

            const claveGrupo =
                grupo.toLocaleLowerCase(
                    "ca-ES",
                );

            if (
                gruposUsados.has(
                    claveGrupo,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    `El grup "${grupo}" està repetit dins del curs "${curso}".`,
                );
            }

            gruposUsados.add(
                claveGrupo,
            );

            grupos.push(
                grupo,
            );
        }

        resultado.push({
            curso,
            grupos,
        });
    }

    return resultado;
}

// ============================================================
// EQUIPOS
// ============================================================

function leerEquipos(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració dels equips no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "inscripcion",
            "cupo",
            "cursos",
            "jugadores",
            "genero",
            "profesores",
            "entrenador",
            "staff",
        ],
    );

    if (
        !esRegistro(
            valor.jugadores,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració dels jugadors no és vàlida.",
        );
    }

    comprobarClaves(
        valor.jugadores,
        [
            "minimo",
            "maximo",
        ],
    );

    const minimoJugadores =
        leerEnteroNullable(
            valor
                .jugadores
                .minimo,
            "mínim de jugadors",
            1,
            1000,
        );

    const maximoJugadores =
        leerEnteroNullable(
            valor
                .jugadores
                .maximo,
            "màxim de jugadors",
            1,
            1000,
        );

    if (
        minimoJugadores !==
            null &&
        maximoJugadores !==
            null &&
        maximoJugadores <
            minimoJugadores
    ) {
        throw new ErrorAPI(
            400,
            "El màxim de jugadors no pot ser inferior al mínim.",
        );
    }

    if (
        !esRegistro(
            valor.genero,
        ) ||
        !esRegistro(
            valor
                .genero
                .minimos,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració de composició per gènere no és vàlida.",
        );
    }

    comprobarClaves(
        valor.genero,
        [
            "activo",
            "minimos",
        ],
    );

    comprobarClaves(
        valor
            .genero
            .minimos,
        [
            "masculino",
            "femenino",
        ],
    );

    const generoActivo =
        leerBooleano(
            valor
                .genero
                .activo,
            "composició per gènere",
        );

    const minimoMasculino =
        leerEntero(
            valor
                .genero
                .minimos
                .masculino,
            "mínim de nois",
            0,
            1000,
        );

    const minimoFemenino =
        leerEntero(
            valor
                .genero
                .minimos
                .femenino,
            "mínim de noies",
            0,
            1000,
        );

    if (
        generoActivo &&
        maximoJugadores !==
            null &&
        minimoMasculino +
            minimoFemenino >
            maximoJugadores
    ) {
        throw new ErrorAPI(
            400,
            "La composició mínima per gènere no pot superar el màxim de jugadors.",
        );
    }

    if (
        !esRegistro(
            valor.profesores,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració del professorat no és vàlida.",
        );
    }

    comprobarClaves(
        valor.profesores,
        [
            "permitidos",
            "minimo",
            "maximo",
            "cuentan_como_jugador",
        ],
    );

    const profesoresPermitidos =
        leerBooleano(
            valor
                .profesores
                .permitidos,
            "professorat",
        );

    const profesoresMinimo =
        leerEntero(
            valor
                .profesores
                .minimo,
            "mínim de professors",
            0,
            1000,
        );

    const profesoresMaximo =
        leerEntero(
            valor
                .profesores
                .maximo,
            "màxim de professors",
            0,
            1000,
        );

    if (
        profesoresPermitidos &&
        profesoresMaximo <
            profesoresMinimo
    ) {
        throw new ErrorAPI(
            400,
            "El màxim de professors no pot ser inferior al mínim.",
        );
    }

    const cuentanComoJugador =
        leerBooleano(
            valor
                .profesores
                .cuentan_como_jugador,
            "professorat dins el nombre de jugadors",
        );

    if (
        !esRegistro(
            valor.entrenador,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració de l'entrenador no és vàlida.",
        );
    }

    comprobarClaves(
        valor.entrenador,
        [
            "permitido",
        ],
    );

    const entrenadorPermitido =
        leerBooleano(
            valor
                .entrenador
                .permitido,
            "entrenador",
        );

    if (
        !esRegistro(
            valor.staff,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració del staff no és vàlida.",
        );
    }

    comprobarClaves(
        valor.staff,
        [
            "permitido",
            "minimo",
            "maximo",
        ],
    );

    const staffPermitido =
        leerBooleano(
            valor
                .staff
                .permitido,
            "staff",
        );

    const staffMinimo =
        leerEntero(
            valor
                .staff
                .minimo,
            "mínim de membres de staff",
            0,
            1000,
        );

    const staffMaximo =
        leerEntero(
            valor
                .staff
                .maximo,
            "màxim de membres de staff",
            0,
            1000,
        );

    if (
        staffPermitido &&
        staffMaximo <
            staffMinimo
    ) {
        throw new ErrorAPI(
            400,
            "El màxim de membres de staff no pot ser inferior al mínim.",
        );
    }

    return {
        inscripcion:
            leerInscripcion(
                valor.inscripcion,
                "la inscripció d'equips",
            ),

        cupo:
            leerCupo(
                valor.cupo,
            ),

        cursos:
            leerCursos(
                valor.cursos,
            ),

        jugadores: {
            minimo:
                minimoJugadores,

            maximo:
                maximoJugadores,
        },

        genero: {
            activo:
                generoActivo,

            minimos: {
                masculino:
                    generoActivo
                        ? minimoMasculino
                        : 0,

                femenino:
                    generoActivo
                        ? minimoFemenino
                        : 0,
            },
        },

        profesores: {
            permitidos:
                profesoresPermitidos,

            minimo:
                profesoresPermitidos
                    ? profesoresMinimo
                    : 0,

            maximo:
                profesoresPermitidos
                    ? profesoresMaximo
                    : 0,

            cuentan_como_jugador:
                cuentanComoJugador,
        },

        entrenador: {
            permitido:
                entrenadorPermitido,
        },

        staff: {
            permitido:
                staffPermitido,

            minimo:
                staffPermitido
                    ? staffMinimo
                    : 0,

            maximo:
                staffPermitido
                    ? staffMaximo
                    : 0,
        },
    };
}

// ============================================================
// VOLUNTARIADO
// ============================================================

function leerVoluntarios(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració del voluntariat no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "inscripcion",
            "cupo",
            "tipos",
        ],
    );

    if (
        !Array.isArray(
            valor.tipos,
        ) ||
        valor.tipos.length >
            MAX_TIPOS_VOLUNTARIADO
    ) {
        throw new ErrorAPI(
            400,
            `No es poden definir més de ${MAX_TIPOS_VOLUNTARIADO} tipus de voluntariat.`,
        );
    }

    const ids =
        new Set<string>();

    const nombres =
        new Set<string>();

    const tipos =
        valor.tipos.map(
            entrada => {
                if (
                    !esRegistro(
                        entrada,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha un tipus de voluntariat no vàlid.",
                    );
                }

                comprobarClaves(
                    entrada,
                    [
                        "id",
                        "nombre",
                        "descripcion",
                        "activo",
                        "cupo",
                    ],
                );

                const id =
                    leerTexto(
                        entrada.id,
                        "identificador del tipus de voluntariat",
                        150,
                        true,
                    );

                if (
                    ids.has(
                        id,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha tipus de voluntariat amb identificadors repetits.",
                    );
                }

                ids.add(
                    id,
                );

                const nombre =
                    leerTexto(
                        entrada.nombre,
                        "nom del tipus de voluntariat",
                        150,
                        true,
                    );

                const claveNombre =
                    nombre.toLocaleLowerCase(
                        "ca-ES",
                    );

                if (
                    nombres.has(
                        claveNombre,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "No pot haver-hi dos tipus de voluntariat amb el mateix nom.",
                    );
                }

                nombres.add(
                    claveNombre,
                );

                return {
                    id,

                    nombre,

                    descripcion:
                        leerTexto(
                            entrada.descripcion,
                            "descripció del tipus de voluntariat",
                            5000,
                        ),

                    activo:
                        leerBooleano(
                            entrada.activo,
                            "estat del tipus de voluntariat",
                        ),

                    cupo:
                        leerCupo(
                            entrada.cupo,
                        ),
                };
            },
        );

    return {
        inscripcion:
            leerInscripcion(
                valor.inscripcion,
                "la inscripció de voluntariat",
            ),

        cupo:
            leerCupo(
                valor.cupo,
            ),

        tipos,
    };
}

// ============================================================
// INFORMACIÓN HTML
// ============================================================

function limpiarHTML(
    valor:
        unknown,
) {
    const html =
        leerTexto(
            valor,
            "contingut de l'apartat",
            150_000,
        );

    return sanitizeHtml(
        html,
        {
            allowedTags: [
                "p",
                "div",
                "br",
                "strong",
                "b",
                "em",
                "i",
                "u",
                "s",
                "strike",
                "del",
                "h2",
                "h3",
                "h4",
                "ul",
                "ol",
                "li",
                "blockquote",
                "a",
                "span",
                "sub",
                "sup",
                "hr",
            ],

            allowedAttributes: {
                a: [
                    "href",
                    "title",
                    "target",
                    "rel",
                ],

                p: [
                    "style",
                ],

                div: [
                    "style",
                ],

                span: [
                    "style",
                ],

                h2: [
                    "style",
                ],

                h3: [
                    "style",
                ],

                h4: [
                    "style",
                ],

                li: [
                    "style",
                ],

                blockquote: [
                    "style",
                ],
            },

            allowedStyles: {
                "*": {
                    "text-align": [
                        /^(left|center|right|justify)$/,
                    ],

                    "font-weight": [
                        /^(normal|bold|[1-9]00)$/,
                    ],

                    "font-style": [
                        /^(normal|italic)$/,
                    ],

                    "text-decoration": [
                        /^(none|underline|line-through|underline line-through)$/,
                    ],
                },
            },

            allowedSchemes: [
                "https",
                "http",
                "mailto",
            ],

            allowProtocolRelative:
                false,

            transformTags: {
                a: (
                    _nombre,
                    atributos,
                ) => ({
                    tagName:
                        "a",

                    attribs: {
                        href:
                            atributos.href ||
                            "",

                        title:
                            atributos.title ||
                            "",

                        target:
                            "_blank",

                        rel:
                            "noopener noreferrer",
                    },
                }),
            },
        },
    );
}

function htmlTieneContenido(
    html:
        string,
) {
    const texto =
        sanitizeHtml(
            html,
            {
                allowedTags:
                    [],

                allowedAttributes:
                    {},
            },
        )
            .replace(
                /&nbsp;/gi,
                " ",
            )
            .replace(
                /\s+/g,
                " ",
            )
            .trim();

    return Boolean(
        texto,
    );
}

// ============================================================
// INFORMACIÓN
// ============================================================

function leerInformacion(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La informació pública no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "bloques",
        ],
    );

    if (
        !Array.isArray(
            valor.bloques,
        ) ||
        valor.bloques.length >
            MAX_BLOQUES
    ) {
        throw new ErrorAPI(
            400,
            `La informació pot tenir com a màxim ${MAX_BLOQUES} apartats.`,
        );
    }

    const ids =
        new Set<string>();

    const bloques =
        valor.bloques.map(
            (
                entrada,
                indice,
            ) => {
                if (
                    !esRegistro(
                        entrada,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha un apartat d'informació no vàlid.",
                    );
                }

                comprobarClaves(
                    entrada,
                    [
                        "id",
                        "order",
                        "type",
                        "title",
                        "body",
                    ],
                );

                const id =
                    leerTexto(
                        entrada.id,
                        "identificador de l'apartat",
                        150,
                        true,
                    );

                if (
                    ids.has(
                        id,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha apartats d'informació amb identificadors repetits.",
                    );
                }

                ids.add(
                    id,
                );

                if (
                    entrada.type !==
                    "text"
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha un tipus d'apartat no reconegut.",
                    );
                }

                if (
                    typeof entrada.order !==
                        "number" ||
                    !Number.isSafeInteger(
                        entrada.order,
                    ) ||
                    entrada.order <
                        1
                ) {
                    throw new ErrorAPI(
                        400,
                        "L'ordre d'un apartat no és vàlid.",
                    );
                }

                const title =
                    leerTexto(
                        entrada.title,
                        "títol de l'apartat",
                        200,
                        true,
                    );

                const body =
                    limpiarHTML(
                        entrada.body,
                    );

                if (
                    !htmlTieneContenido(
                        body,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        `L'apartat «${title}» no té contingut.`,
                    );
                }

                return {
                    id,

                    order:
                        entrada.order,

                    type:
                        "text" as const,

                    title,

                    body,

                    indiceOriginal:
                        indice,
                };
            },
        );

    return {
        bloques:
            bloques
                .sort(
                    (
                        a,
                        b,
                    ) =>
                        a.order -
                            b.order ||
                        a.indiceOriginal -
                            b.indiceOriginal,
                )
                .map(
                    (
                        bloque,
                        indice,
                    ) => ({
                        id:
                            bloque.id,

                        order:
                            indice +
                            1,

                        type:
                            bloque.type,

                        title:
                            bloque.title,

                        body:
                            bloque.body,
                    }),
                ),
    };
}

// ============================================================
// FAQ
// ============================================================

function leerFAQ(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració de les preguntes freqüents no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "preguntas",
        ],
    );

    if (
        !Array.isArray(
            valor.preguntas,
        ) ||
        valor.preguntas.length >
            MAX_FAQ
    ) {
        throw new ErrorAPI(
            400,
            `No es poden definir més de ${MAX_FAQ} preguntes freqüents.`,
        );
    }

    const ids =
        new Set<string>();

    const textos =
        new Set<string>();

    const preguntas =
        valor.preguntas.map(
            (
                entrada,
                indice,
            ) => {
                if (
                    !esRegistro(
                        entrada,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha una pregunta freqüent no vàlida.",
                    );
                }

                comprobarClaves(
                    entrada,
                    [
                        "id",
                        "order",
                        "pregunta",
                        "respuesta",
                        "activo",
                    ],
                );

                const id =
                    leerTexto(
                        entrada.id,
                        "identificador de la pregunta freqüent",
                        150,
                        true,
                    );

                if (
                    ids.has(
                        id,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "Hi ha preguntes freqüents amb identificadors repetits.",
                    );
                }

                ids.add(
                    id,
                );

                if (
                    typeof entrada.order !==
                        "number" ||
                    !Number.isSafeInteger(
                        entrada.order,
                    ) ||
                    entrada.order <
                        1
                ) {
                    throw new ErrorAPI(
                        400,
                        "L'ordre d'una pregunta freqüent no és vàlid.",
                    );
                }

                const pregunta =
                    leerTexto(
                        entrada.pregunta,
                        "pregunta freqüent",
                        200,
                        true,
                    );

                const clavePregunta =
                    pregunta.toLocaleLowerCase(
                        "ca-ES",
                    );

                if (
                    textos.has(
                        clavePregunta,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "No pot haver-hi dues preguntes freqüents iguals.",
                    );
                }

                textos.add(
                    clavePregunta,
                );

                const respuesta =
                    leerTexto(
                        entrada.respuesta,
                        "resposta de la pregunta freqüent",
                        5000,
                        true,
                    );

                const activo =
                    leerBooleano(
                        entrada.activo,
                        "visibilitat de la pregunta freqüent",
                    );

                return {
                    id,

                    order:
                        entrada.order,

                    pregunta,

                    respuesta,

                    activo,

                    indiceOriginal:
                        indice,
                };
            },
        );

    return {
        preguntas:
            preguntas
                .sort(
                    (
                        a,
                        b,
                    ) =>
                        a.order -
                            b.order ||
                        a.indiceOriginal -
                            b.indiceOriginal,
                )
                .map(
                    (
                        pregunta,
                        indice,
                    ) => ({
                        id:
                            pregunta.id,

                        order:
                            indice +
                            1,

                        pregunta:
                            pregunta.pregunta,

                        respuesta:
                            pregunta.respuesta,

                        activo:
                            pregunta.activo,
                    }),
                ),
    };
}

// ============================================================
// COMPETICIÓN
// ============================================================

function leerCompeticion(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració de competició no és vàlida.",
        );
    }

    return valor;
}

// ============================================================
// GENERAL
// ============================================================

function leerGeneral(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La informació general de l'edició no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "nombre",
            "fecha_inicio",
            "fecha_fin",
            "estado",
            "sede",
        ],
    );

    const nombre =
        leerTexto(
            valor.nombre,
            "nom de l'edició",
            150,
            true,
        );

    const fechaInicio =
        leerFecha(
            valor.fecha_inicio,
            "La data d'inici",
        );

    const fechaFin =
        leerFecha(
            valor.fecha_fin,
            "La data de finalització",
        );

    if (
        Date.parse(
            fechaFin,
        ) <
        Date.parse(
            fechaInicio,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La data de finalització no pot ser anterior a la data d'inici.",
        );
    }

    return {
        nombre,

        fecha_inicio:
            fechaInicio,

        fecha_fin:
            fechaFin,

        estado:
            estadoParaDB(
                valor.estado,
            ),

        sede:
            leerTexto(
                valor.sede,
                "seu",
                500,
            ),
    };
}

// ============================================================
// CONFIGURACIÓN COMPLETA
// ============================================================

function leerConfiguracion(
    valor:
        unknown,
) {
    if (
        !esRegistro(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La configuració de l'edició no és vàlida.",
        );
    }

    comprobarClaves(
        valor,
        [
            "equipos",
            "voluntarios",
            "informacion",
            "faq",
            "competicion",
        ],
    );

    return {
        equipos:
            leerEquipos(
                valor.equipos,
            ),

        voluntarios:
            leerVoluntarios(
                valor.voluntarios,
            ),

        informacion:
            leerInformacion(
                valor.informacion,
            ),

        faq:
            leerFAQ(
                valor.faq,
            ),

        competicion:
            leerCompeticion(
                valor.competicion,
            ),
    };
}

// ============================================================
// DATOS CREAR / EDITAR
// ============================================================

function leerDatos(
    cuerpo:
        Registro,
) {
    if (
        !esRegistro(
            cuerpo.datos,
        )
    ) {
        throw new ErrorAPI(
            400,
            "Falten les dades de l'edició.",
        );
    }

    comprobarClaves(
        cuerpo.datos,
        [
            "general",
            "configuracion",
        ],
    );

    return {
        general:
            leerGeneral(
                cuerpo
                    .datos
                    .general,
            ),

        configuracion:
            leerConfiguracion(
                cuerpo
                    .datos
                    .configuracion,
            ),
    };
}

// ============================================================
// VERSIÓN
// ============================================================

function leerVersion(
    cuerpo:
        Registro,
): string | null {
    if (
        !Object.hasOwn(
            cuerpo,
            "updated_at",
        )
    ) {
        throw new ErrorAPI(
            400,
            "Falta la versió de l'edició.",
        );
    }

    if (
        cuerpo.updated_at ===
        null
    ) {
        return null;
    }

    if (
        typeof cuerpo.updated_at !==
        "string"
    ) {
        throw new ErrorAPI(
            400,
            "La versió de l'edició no és vàlida.",
        );
    }

    const version =
        cuerpo.updated_at
            .trim();

    if (
        !version ||
        !Number.isFinite(
            Date.parse(
                version,
            ),
        )
    ) {
        throw new ErrorAPI(
            400,
            "La versió de l'edició no és vàlida.",
        );
    }

    /*
     * Se conserva exactamente el timestamp de PostgreSQL.
     * No usar Date.toISOString() aquí porque podría perder
     * los microsegundos utilizados para el control de concurrencia.
     */
    return version;
}

// ============================================================
// PREPARAR EDICIÓN
// ============================================================

function prepararEdicionFormulario(
    edicion:
        EdicionDB,

    configuracion:
        ConfiguracionDB | null,
) {
    return {
        id:
            edicion.id,

        torneo_id:
            edicion.torneo_id,

        general: {
            nombre:
                edicion.nombre ??
                "",

            fecha_inicio:
                edicion.fecha_inicio ??
                "",

            fecha_fin:
                edicion.fecha_fin ??
                "",

            estado:
                estadoParaFrontend(
                    edicion.estado,
                ),

            sede:
                edicion.sede ??
                "",
        },

        configuracion: {
            equipos:
                configuracion
                    ?.equipos ??
                {},

            voluntarios:
                configuracion
                    ?.voluntarios ??
                {},

            informacion:
                configuracion
                    ?.informacion ??
                {},

            faq:
                configuracion
                    ?.faq ??
                {
                    preguntas:
                        [],
                },

            competicion:
                esRegistro(
                    configuracion
                        ?.competicion,
                )
                    ? configuracion
                          .competicion
                    : {},
        },

        created_at:
            edicion.created_at,

        updated_at:
            edicion.updated_at,
    };
}

// ============================================================
// GET
// ============================================================

export const GET:
    APIRoute =
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

            const vista =
                url.searchParams.get(
                    "vista",
                ) ??
                "";

            if (
                vista !==
                    "lista" &&
                vista !==
                    "asistente"
            ) {
                throw new ErrorAPI(
                    400,
                    "La vista sol·licitada no és vàlida.",
                );
            }

            const torneoID =
                leerID(
                    url.searchParams.get(
                        "torneoID",
                    ),
                    "torneoID",
                );

            const torneo =
                await obtenerTorneo(
                    torneoID,
                );

            exigirAccesoTorneo(
                usuario,
                torneoID,
                "ver",
            );

            // =================================================
            // LISTA
            // =================================================

            if (
                vista ===
                "lista"
            ) {
                const {
                    data,
                    error,
                } =
                    await supabaseAdmin
                        .from(
                            TABLA_EDICIONES,
                        )
                        .select(
                            CAMPOS_EDICION,
                        )
                        .eq(
                            "torneo_id",
                            torneoID,
                        )
                        .order(
                            "fecha_inicio",
                            {
                                ascending:
                                    false,

                                nullsFirst:
                                    false,
                            },
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

                const filas =
                    (
                        data ??
                        []
                    ).map(
                        (
                            edicion:
                                EdicionDB,
                        ) => ({
                            id:
                                edicion.id,

                            torneo_id:
                                edicion.torneo_id,

                            nombre:
                                edicion.nombre ??
                                "",

                            fecha_inicio:
                                edicion.fecha_inicio,

                            fecha_fin:
                                edicion.fecha_fin,

                            estado:
                                estadoParaFrontend(
                                    edicion.estado,
                                ),

                            sede:
                                edicion.sede,

                            created_at:
                                edicion.created_at,

                            updated_at:
                                edicion.updated_at,

                            puedeEditar:
                                tienePermiso(
                                    usuario,
                                    "edicions",
                                    "editar",
                                    torneoID,
                                ),

                            puedeEliminar:
                                tienePermiso(
                                    usuario,
                                    "edicions",
                                    "eliminar",
                                    torneoID,
                                ),
                        }),
                    );

                return responder({
                    success:
                        true,

                    torneo,

                    filas,

                    puedeCrear:
                        tienePermiso(
                            usuario,
                            "edicions",
                            "crear",
                            torneoID,
                        ),
                });
            }

            // =================================================
            // ASISTENTE
            // =================================================

            const edicionParametro =
                url.searchParams.get(
                    "edicionID",
                );

            let edicionFormulario:
                ReturnType<
                    typeof prepararEdicionFormulario
                > |
                null =
                null;

            if (
                edicionParametro
            ) {
                const edicionID =
                    leerID(
                        edicionParametro,
                        "edicionID",
                    );

                const [
                    edicion,
                    configuracion,
                ] =
                    await Promise.all([
                        obtenerEdicion(
                            edicionID,
                            torneoID,
                        ),

                        obtenerConfiguracion(
                            edicionID,
                        ),
                    ]);

                edicionFormulario =
                    prepararEdicionFormulario(
                        edicion,
                        configuracion,
                    );
            }

            const cursosPlataforma =
                await obtenerCursosPlataforma();

            return responder({
                success:
                    true,

                torneo,

                edicion:
                    edicionFormulario,

                cursoAcademicoPlataforma:
                    cursosPlataforma
                        .cursoAcademico,

                cursosPlataforma:
                    cursosPlataforma
                        .cursos,

                capacidades: {
                    crear:
                        tienePermiso(
                            usuario,
                            "edicions",
                            "crear",
                            torneoID,
                        ),

                    editar:
                        tienePermiso(
                            usuario,
                            "edicions",
                            "editar",
                            torneoID,
                        ),

                    eliminar:
                        tienePermiso(
                            usuario,
                            "edicions",
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
// POST · CREAR
// ============================================================

export const POST:
    APIRoute =
    async ({
        cookies,
        request,
    }) => {
        let edicionCreadaID:
            string | null =
            null;

        try {
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

            comprobarClaves(
                cuerpo,
                [
                    "accion",
                    "torneoID",
                    "edicionID",
                    "updated_at",
                    "datos",
                ],
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

            await obtenerTorneo(
                torneoID,
            );

            exigirAccesoTorneo(
                usuario,
                torneoID,
                "crear",
            );

            const {
                general,
                configuracion,
            } =
                leerDatos(
                    cuerpo,
                );

            const ahora =
                new Date()
                    .toISOString();

            const {
                data:
                    edicionCreada,
                error:
                    errorEdicion,
            } =
                await supabaseAdmin
                    .from(
                        TABLA_EDICIONES,
                    )
                    .insert({
                        torneo_id:
                            torneoID,

                        nombre:
                            general.nombre,

                        fecha_inicio:
                            general.fecha_inicio,

                        fecha_fin:
                            general.fecha_fin,

                        estado:
                            general.estado,

                        sede:
                            general.sede,

                        created_at:
                            ahora,

                        updated_at:
                            ahora,
                    })
                    .select(
                        CAMPOS_EDICION,
                    )
                    .single();

            if (
                errorEdicion
            ) {
                throw errorEdicion;
            }

            edicionCreadaID =
                edicionCreada.id;

            const {
                error:
                    errorConfiguracion,
            } =
                await supabaseAdmin
                    .from(
                        TABLA_CONFIGURACION,
                    )
                    .insert({
                        edicion_id:
                            edicionCreada.id,

                        equipos:
                            configuracion.equipos,

                        voluntarios:
                            configuracion.voluntarios,

                        informacion:
                            configuracion.informacion,

                        faq:
                            configuracion.faq,

                        competicion:
                            configuracion.competicion,

                        created_at:
                            ahora,

                        updated_at:
                            ahora,
                    });

            if (
                errorConfiguracion
            ) {
                const {
                    error:
                        errorRollback,
                } =
                    await supabaseAdmin
                        .from(
                            TABLA_EDICIONES,
                        )
                        .delete()
                        .eq(
                            "id",
                            edicionCreada.id,
                        );

                if (
                    errorRollback
                ) {
                    console.error(
                        "No s'ha pogut revertir la creació de l'edició:",
                        errorRollback,
                    );
                }

                edicionCreadaID =
                    null;

                throw errorConfiguracion;
            }

            return responder(
                {
                    success:
                        true,

                    id:
                        edicionCreada.id,

                    updated_at:
                        edicionCreada.updated_at,
                },
                201,
            );
        } catch (
            error
        ) {
            if (
                edicionCreadaID
            ) {
                console.error(
                    "La creació de l'edició ha fallat després de crear:",
                    edicionCreadaID,
                );
            }

            return responderError(
                error,
            );
        }
    };

// ============================================================
// PATCH · EDITAR
// ============================================================

export const PATCH:
    APIRoute =
    async ({
        cookies,
        request,
    }) => {
        try {
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

            comprobarClaves(
                cuerpo,
                [
                    "accion",
                    "torneoID",
                    "edicionID",
                    "updated_at",
                    "datos",
                ],
            );

            if (
                cuerpo.accion !==
                "editar"
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

            await obtenerTorneo(
                torneoID,
            );

            exigirAccesoTorneo(
                usuario,
                torneoID,
                "editar",
            );

            const edicionAnterior =
                await obtenerEdicion(
                    edicionID,
                    torneoID,
                );

            const configuracionAnterior =
                await obtenerConfiguracion(
                    edicionID,
                );

            const version =
                leerVersion(
                    cuerpo,
                );

            const versionActual =
                edicionAnterior
                    .updated_at;

            if (
                versionActual !==
                version
            ) {
                throw new ErrorAPI(
                    409,
                    "Aquesta edició ha estat modificada per una altra persona. Torna a carregar-la abans de continuar.",
                );
            }

            const {
                general,
                configuracion,
            } =
                leerDatos(
                    cuerpo,
                );

            const ahora =
                new Date()
                    .toISOString();

            let actualizacion =
                supabaseAdmin
                    .from(
                        TABLA_EDICIONES,
                    )
                    .update({
                        nombre:
                            general.nombre,

                        fecha_inicio:
                            general.fecha_inicio,

                        fecha_fin:
                            general.fecha_fin,

                        estado:
                            general.estado,

                        sede:
                            general.sede,

                        updated_at:
                            ahora,
                    })
                    .eq(
                        "id",
                        edicionID,
                    )
                    .eq(
                        "torneo_id",
                        torneoID,
                    );

            if (
                version ===
                null
            ) {
                actualizacion =
                    actualizacion.is(
                        "updated_at",
                        null,
                    );
            } else {
                actualizacion =
                    actualizacion.eq(
                        "updated_at",
                        version,
                    );
            }

            const {
                data:
                    edicionActualizada,
                error:
                    errorEdicion,
            } =
                await actualizacion
                    .select(
                        CAMPOS_EDICION,
                    )
                    .maybeSingle();

            if (
                errorEdicion
            ) {
                throw errorEdicion;
            }

            if (
                !edicionActualizada
            ) {
                throw new ErrorAPI(
                    409,
                    "Aquesta edició ha canviat mentre l'estaves editant. Torna a carregar-la.",
                );
            }

            try {
                if (
                    configuracionAnterior
                ) {
                    const {
                        data:
                            configuracionActualizada,
                        error:
                            errorConfiguracion,
                    } =
                        await supabaseAdmin
                            .from(
                                TABLA_CONFIGURACION,
                            )
                            .update({
                                equipos:
                                    configuracion.equipos,

                                voluntarios:
                                    configuracion.voluntarios,

                                informacion:
                                    configuracion.informacion,

                                faq:
                                    configuracion.faq,

                                competicion:
                                    configuracion.competicion,

                                updated_at:
                                    ahora,
                            })
                            .eq(
                                "edicion_id",
                                edicionID,
                            )
                            .select(
                                "edicion_id",
                            )
                            .maybeSingle();

                    if (
                        errorConfiguracion
                    ) {
                        throw errorConfiguracion;
                    }

                    if (
                        !configuracionActualizada
                    ) {
                        throw new Error(
                            "La configuració de l'edició ha desaparegut durant l'actualització.",
                        );
                    }
                } else {
                    const {
                        error:
                            errorConfiguracion,
                    } =
                        await supabaseAdmin
                            .from(
                                TABLA_CONFIGURACION,
                            )
                            .insert({
                                edicion_id:
                                    edicionID,

                                equipos:
                                    configuracion.equipos,

                                voluntarios:
                                    configuracion.voluntarios,

                                informacion:
                                    configuracion.informacion,

                                faq:
                                    configuracion.faq,

                                competicion:
                                    configuracion.competicion,

                                created_at:
                                    ahora,

                                updated_at:
                                    ahora,
                            });

                    if (
                        errorConfiguracion
                    ) {
                        throw errorConfiguracion;
                    }
                }
            } catch (
                errorConfiguracion
            ) {
                const {
                    error:
                        errorRollback,
                } =
                    await supabaseAdmin
                        .from(
                            TABLA_EDICIONES,
                        )
                        .update({
                            nombre:
                                edicionAnterior.nombre,

                            fecha_inicio:
                                edicionAnterior.fecha_inicio,

                            fecha_fin:
                                edicionAnterior.fecha_fin,

                            estado:
                                edicionAnterior.estado,

                            sede:
                                edicionAnterior.sede,

                            updated_at:
                                edicionAnterior.updated_at,
                        })
                        .eq(
                            "id",
                            edicionID,
                        )
                        .eq(
                            "updated_at",
                            ahora,
                        );

                if (
                    errorRollback
                ) {
                    console.error(
                        "No s'ha pogut revertir l'edició després d'un error de configuració:",
                        errorRollback,
                    );
                }

                throw errorConfiguracion;
            }

            return responder({
                success:
                    true,

                id:
                    edicionID,

                updated_at:
                    edicionActualizada
                        .updated_at,
            });
        } catch (
            error
        ) {
            return responderError(
                error,
            );
        }
    };