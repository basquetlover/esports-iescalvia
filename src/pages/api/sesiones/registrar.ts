import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";
import { crearSesion } from "@pages/api/sesiones/sesiones";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TABLA_CONFIGURACION =
    "configuracion_plataforma";

const MAX_JSON_BYTES =
    50_000;

const CAMPOS_CONFIGURACION =
    "curso_academico_actual,cursos,registros_habilitados,emails_registro_permitidos,dominios_registro_permitidos,mensaje_registro_cerrado";

type Registro =
    Record<string, unknown>;

type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

type ConfiguracionRegistro = {
    curso_academico_actual:
        string | null;

    cursos:
        CursoConfiguracion[];

    registros_habilitados:
        boolean;

    emails_registro_permitidos:
        string[];

    dominios_registro_permitidos:
        string[];

    mensaje_registro_cerrado:
        string;
};

// ============================================================
// RESPUESTAS
// ============================================================

class ErrorAPI extends Error {
    constructor(
        public estado: number,
        mensaje: string,
    ) {
        super(mensaje);
    }
}

function responder(
    datos: unknown,
    estado = 200,
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
        "Error en el registre d'usuaris:",
        error,
    );

    return responder(
        {
            success:
                false,

            mensaje:
                "Error intern del servidor.",
        },
        500,
    );
}

// ============================================================
// VALIDACIÓN BÁSICA
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

function leerTexto(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
) {
    if (
        valor ===
            undefined ||
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
        texto.length >
        maximo
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} supera els ${maximo} caràcters.`,
        );
    }

    if (
        obligatorio &&
        !texto
    ) {
        throw new ErrorAPI(
            400,
            `Falta el camp ${nombre}.`,
        );
    }

    return texto;
}

async function leerJSON(
    request: Request,
): Promise<Registro> {
    const longitud =
        Number(
            request.headers.get(
                "content-length",
            ) || 0,
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
// CONFIGURACIÓN DE REGISTRO
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
            (
                entrada,
            ): entrada is Registro =>
                esRegistro(
                    entrada,
                ),
        )
        .map(
            (
                entrada,
            ): CursoConfiguracion => {
                const curso =
                    typeof entrada.curso ===
                    "string"
                        ? entrada.curso.trim()
                        : "";

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
                                  (
                                      grupo,
                                  ) =>
                                      grupo.trim(),
                              )
                              .filter(
                                  Boolean,
                              )
                        : [];

                return {
                    curso,
                    grupos,
                };
            },
        )
        .filter(
            (curso) =>
                Boolean(
                    curso.curso,
                ),
        );
}

function normalizarListaTexto(
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
                    (
                        entrada,
                    ) =>
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

function normalizarConfiguracion(
    fila: unknown,
): ConfiguracionRegistro {
    if (
        !esRegistro(
            fila,
        )
    ) {
        throw new ErrorAPI(
            500,
            "La configuració del registre no és vàlida.",
        );
    }

    return {
        curso_academico_actual:
            typeof fila
                .curso_academico_actual ===
            "string"
                ? fila
                      .curso_academico_actual
                      .trim()
                : null,

        cursos:
            normalizarCursos(
                fila.cursos,
            ),

        registros_habilitados:
            fila
                .registros_habilitados ===
            true,

        emails_registro_permitidos:
            normalizarListaTexto(
                fila
                    .emails_registro_permitidos,
            ),

        dominios_registro_permitidos:
            normalizarListaTexto(
                fila
                    .dominios_registro_permitidos,
            ).map(
                (dominio) =>
                    dominio.replace(
                        /^@+/,
                        "",
                    ),
            ),

        mensaje_registro_cerrado:
            typeof fila
                .mensaje_registro_cerrado ===
            "string"
                ? fila
                      .mensaje_registro_cerrado
                : "Els nous registres estan temporalment tancats.",
    };
}

async function obtenerConfiguracion():
    Promise<ConfiguracionRegistro | null> {
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
            .order(
                "created_at",
                {
                    ascending:
                        true,

                    nullsFirst:
                        false,
                },
            )
            .limit(1);

    if (error) {
        throw error;
    }

    const fila =
        data?.[0];

    if (!fila) {
        return null;
    }

    return normalizarConfiguracion(
        fila,
    );
}

// ============================================================
// EMAIL
// ============================================================

function normalizarEmail(
    email: string,
) {
    return email
        .trim()
        .toLowerCase();
}

function emailPermitido(
    email:
        string,
    configuracion:
        ConfiguracionRegistro,
) {
    const normalizado =
        normalizarEmail(
            email,
        );

    if (
        configuracion
            .emails_registro_permitidos
            .includes(
                normalizado,
            )
    ) {
        return true;
    }

    const arroba =
        normalizado
            .lastIndexOf(
                "@",
            );

    if (
        arroba <= 0 ||
        arroba ===
            normalizado.length -
                1
    ) {
        return false;
    }

    const dominio =
        normalizado.slice(
            arroba + 1,
        );

    return configuracion
        .dominios_registro_permitidos
        .includes(
            dominio,
        );
}

// ============================================================
// CURSOS
// ============================================================

function obtenerCursosPermitidos(
    configuracion:
        ConfiguracionRegistro,
) {
    const resultado =
        new Set<string>();

    for (
        const curso
        of configuracion.cursos
    ) {
        if (
            curso.grupos.length ===
            0
        ) {
            resultado.add(
                curso.curso,
            );

            continue;
        }

        for (
            const grupo
            of curso.grupos
        ) {
            resultado.add(
                `${curso.curso} ${grupo}`.trim(),
            );
        }
    }

    return resultado;
}

function cursoPermitido(
    curso:
        string,
    configuracion:
        ConfiguracionRegistro,
) {
    return obtenerCursosPermitidos(
        configuracion,
    ).has(
        curso.trim(),
    );
}

// ============================================================
// CONTRASEÑA
// ============================================================

async function hashPassword(
    password: string,
) {
    const encoder =
        new TextEncoder();

    const datos =
        encoder.encode(
            password,
        );

    const hashBuffer =
        await crypto.subtle.digest(
            "SHA-256",
            datos,
        );

    const hashArray =
        Array.from(
            new Uint8Array(
                hashBuffer,
            ),
        );

    return hashArray
        .map(
            (byte) =>
                byte
                    .toString(
                        16,
                    )
                    .padStart(
                        2,
                        "0",
                    ),
        )
        .join("");
}

// ============================================================
// GET
// CONFIGURACIÓN PÚBLICA DEL FORMULARIO
// ============================================================

export const GET:
    APIRoute =
    async () => {
        try {
            const configuracion =
                await obtenerConfiguracion();

            if (!configuracion) {
                return responder({
                    success:
                        true,

                    configuracion: {
                        registros_habilitados:
                            false,

                        curso_academico_actual:
                            null,

                        cursos:
                            [],

                        emails_registro_permitidos:
                            [],

                        dominios_registro_permitidos:
                            [],

                        mensaje_registro_cerrado:
                            "El registre encara no està configurat.",
                    },
                });
            }

            /*
             * Solo devolvemos información necesaria
             * para construir y validar el formulario.
             *
             * No se exponen:
             * - Admin Mode
             * - emails internos de notificaciones
             * - auditoría
             * - otros parámetros administrativos
             */
            return responder({
                success:
                    true,

                configuracion: {
                    registros_habilitados:
                        configuracion
                            .registros_habilitados,

                    curso_academico_actual:
                        configuracion
                            .curso_academico_actual,

                    cursos:
                        configuracion
                            .cursos,

                    emails_registro_permitidos:
                        configuracion
                            .emails_registro_permitidos,

                    dominios_registro_permitidos:
                        configuracion
                            .dominios_registro_permitidos,

                    mensaje_registro_cerrado:
                        configuracion
                            .mensaje_registro_cerrado,
                },
            });
        } catch (error) {
            return responderError(
                error,
            );
        }
    };

// ============================================================
// POST
// REGISTRAR USUARIO
// ============================================================

export const POST:
    APIRoute =
    async ({
        request,
        cookies,
        url,
    }) => {
        try {
            const origin =
                request.headers.get(
                    "origin",
                );

            if (
                origin &&
                origin !==
                    url.origin
            ) {
                throw new ErrorAPI(
                    403,
                    "Origen de la petició no permès.",
                );
            }

            const tipo =
                (
                    request.headers.get(
                        "content-type",
                    ) || ""
                )
                    .split(
                        ";",
                    )[0]
                    .trim()
                    .toLowerCase();

            if (
                tipo !==
                "application/json"
            ) {
                throw new ErrorAPI(
                    415,
                    "El format de la petició no és vàlid.",
                );
            }

            const configuracion =
                await obtenerConfiguracion();

            if (!configuracion) {
                throw new ErrorAPI(
                    503,
                    "El registre no està configurat.",
                );
            }

            if (
                !configuracion
                    .registros_habilitados
            ) {
                throw new ErrorAPI(
                    403,
                    configuracion
                        .mensaje_registro_cerrado ||
                        "Els nous registres estan temporalment tancats.",
                );
            }

            if (
                !configuracion
                    .curso_academico_actual
            ) {
                throw new ErrorAPI(
                    503,
                    "No hi ha cap curs acadèmic configurat.",
                );
            }

            const cuerpo =
                await leerJSON(
                    request,
                );

            const nombre =
                leerTexto(
                    cuerpo.nombre,
                    "nom",
                    150,
                    true,
                );

            const apellido1 =
                leerTexto(
                    cuerpo.apellido1,
                    "primer cognom",
                    150,
                    true,
                );

            const apellido2 =
                leerTexto(
                    cuerpo.apellido2,
                    "segon cognom",
                    150,
                );

            const curso =
                leerTexto(
                    cuerpo.curso,
                    "curs",
                    250,
                    true,
                );

            const email =
                normalizarEmail(
                    leerTexto(
                        cuerpo.email,
                        "correu",
                        254,
                        true,
                    ),
                );

            const contrasena =
                leerTexto(
                    cuerpo.contrasena,
                    "contrasenya",
                    500,
                    true,
                );

            // ====================================================
            // VALIDAR CURSO
            // ====================================================

            if (
                !cursoPermitido(
                    curso,
                    configuracion,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    "El curs seleccionat no està disponible.",
                );
            }

            // ====================================================
            // VALIDAR EMAIL
            // ====================================================

            if (
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    email,
                )
            ) {
                throw new ErrorAPI(
                    400,
                    "El correu electrònic no és vàlid.",
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
                    "Aquest correu no està autoritzat per registrar-se.",
                );
            }

            // ====================================================
            // COMPROBAR USUARIO EXISTENTE
            // ====================================================

            const {
                data:
                    usuarioExistente,
                error:
                    errorUsuarioExistente,
            } =
                await supabaseAdmin
                    .from(
                        "users",
                    )
                    .select(
                        "id",
                    )
                    .eq(
                        "email",
                        email,
                    )
                    .maybeSingle();

            if (
                errorUsuarioExistente
            ) {
                throw errorUsuarioExistente;
            }

            if (
                usuarioExistente
            ) {
                throw new ErrorAPI(
                    409,
                    "Aquest correu ja està registrat.",
                );
            }

            // ====================================================
            // CREAR USUARIO
            // ====================================================

            const contrasenaHash =
                await hashPassword(
                    contrasena,
                );

            const ahora =
                new Date()
                    .toISOString();

            const {
                data:
                    nuevoUsuario,
                error:
                    crearUsuarioError,
            } =
                await supabaseAdmin
                    .from(
                        "users",
                    )
                    .insert({
                        nombre,

                        apellido1,

                        apellido2,

                        curso,

                        email,

                        contrasena:
                            contrasenaHash,

                        ano_academico:
                            configuracion
                                .curso_academico_actual,

                        fecha_creacion:
                            ahora,

                        fecha_actualizacion:
                            ahora,

                        activa:
                            true,
                    })
                    .select()
                    .single();

            if (
                crearUsuarioError
            ) {
                console.error(
                    "Error al crear el usuario:",
                    crearUsuarioError,
                );

                throw new ErrorAPI(
                    500,
                    "Error al crear l'usuari.",
                );
            }

            // ====================================================
            // INICIAR SESIÓN
            // ====================================================

            await crearSesion(
                nuevoUsuario.id,
                cookies,
            );

            return responder({
                success:
                    true,

                mensaje:
                    "Usuari registrat correctament.",

                usuario:
                    nuevoUsuario,
            });
        } catch (error) {
            return responderError(
                error,
            );
        }
    };