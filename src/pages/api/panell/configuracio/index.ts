import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso } from "@const/Permisos";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TABLA = "configuracion_plataforma";

const MAX_JSON_BYTES = 100_000;
const MAX_CURSOS = 50;
const MAX_GRUPOS_POR_CURSO = 100;

/*
 * IMPORTANTE:
 * Mantener como cadena literal para que Supabase
 * pueda inferir correctamente los campos seleccionados.
 */
const CAMPOS = "id,curso_academico_actual,cursos,registros_habilitados,admin_mode,emails_registro_permitidos,dominios_registro_permitidos,email_notificaciones_principal,email_notificaciones_secundario,notificar_nuevo_usuario,notificar_nuevo_equipo,notificar_nuevo_voluntario,notificar_incidencias_formularios,horas_aviso_formulario_incompleto,mensaje_registro_cerrado,created_at,updated_at,updated_by";

type Usuario = NonNullable<
    Awaited<ReturnType<typeof obtenerUsuarioPorToken>>
>;

type Registro = Record<string, unknown>;

type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

type ConfiguracionPlataforma = {
    id: string | null;

    curso_academico_actual: string | null;

    cursos: CursoConfiguracion[];

    registros_habilitados: boolean;

    admin_mode: boolean;

    emails_registro_permitidos: string[];

    dominios_registro_permitidos: string[];

    email_notificaciones_principal: string;

    email_notificaciones_secundario: string;

    notificar_nuevo_usuario: boolean;

    notificar_nuevo_equipo: boolean;

    notificar_nuevo_voluntario: boolean;

    notificar_incidencias_formularios: boolean;

    horas_aviso_formulario_incompleto: number;

    mensaje_registro_cerrado: string;

    created_at: string | null;

    updated_at: string | null;

    updated_by: string | null;
};

const CONFIGURACION_DEFECTO: Omit<
    ConfiguracionPlataforma,
    "id" |
        "created_at" |
        "updated_at" |
        "updated_by"
> = {
    curso_academico_actual: null,

    cursos: [],

    registros_habilitados: false,

    admin_mode: false,

    emails_registro_permitidos: [],

    dominios_registro_permitidos: [],

    email_notificaciones_principal: "",

    email_notificaciones_secundario: "",

    notificar_nuevo_usuario: true,

    notificar_nuevo_equipo: true,

    notificar_nuevo_voluntario: true,

    notificar_incidencias_formularios: true,

    horas_aviso_formulario_incompleto: 24,

    mensaje_registro_cerrado:
        "Els nous registres estan temporalment tancats.",
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
        error instanceof ErrorAPI
    ) {
        return responder(
            {
                success: false,
                mensaje:
                    error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error en la configuració de la plataforma:",
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
// VALIDACIÓN BÁSICA
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

function leerTexto(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
): string {
    if (
        valor === undefined ||
        valor === null
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
        typeof valor !== "string"
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    const texto =
        valor.trim();

    if (
        texto.length > maximo
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

function leerBooleano(
    valor: unknown,
    nombre: string,
): boolean {
    if (
        typeof valor !== "boolean"
    ) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    return valor;
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
            "La configuració enviada és massa gran.",
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
            "La configuració enviada és massa gran.",
        );
    }

    let valor: unknown;

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
        !esRegistro(valor)
    ) {
        throw new ErrorAPI(
            400,
            "La petició no és vàlida.",
        );
    }

    return valor;
}

// ============================================================
// EMAILS
// ============================================================

function normalizarEmail(
    valor: string,
) {
    return valor
        .trim()
        .toLowerCase();
}

function emailValido(
    email: string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
    );
}

function leerEmail(
    valor: unknown,
    nombre: string,
    obligatorio = false,
) {
    const email =
        normalizarEmail(
            leerTexto(
                valor,
                nombre,
                254,
                obligatorio,
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
            `El camp ${nombre} no conté un correu vàlid.`,
        );
    }

    return email;
}

function leerEmails(
    valor: unknown,
): string[] {
    if (
        !Array.isArray(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La llista de correus autoritzats no és vàlida.",
        );
    }

    if (
        valor.length > 200
    ) {
        throw new ErrorAPI(
            400,
            "Hi ha massa correus autoritzats.",
        );
    }

    const resultado:
        string[] = [];

    const usados =
        new Set<string>();

    for (
        const entrada
        of valor
    ) {
        const email =
            leerEmail(
                entrada,
                "correu autoritzat",
                true,
            );

        if (
            usados.has(
                email,
            )
        ) {
            continue;
        }

        usados.add(
            email,
        );

        resultado.push(
            email,
        );
    }

    return resultado;
}

// ============================================================
// DOMINIOS
// ============================================================

function normalizarDominio(
    valor: string,
) {
    return valor
        .trim()
        .toLowerCase()
        .replace(
            /^@+/,
            "",
        );
}

function dominioValido(
    dominio: string,
) {
    return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(
        dominio,
    );
}

function leerDominios(
    valor: unknown,
): string[] {
    if (
        !Array.isArray(
            valor,
        )
    ) {
        throw new ErrorAPI(
            400,
            "La llista de dominis autoritzats no és vàlida.",
        );
    }

    if (
        valor.length > 100
    ) {
        throw new ErrorAPI(
            400,
            "Hi ha massa dominis autoritzats.",
        );
    }

    const resultado:
        string[] = [];

    const usados =
        new Set<string>();

    for (
        const entrada
        of valor
    ) {
        const dominio =
            normalizarDominio(
                leerTexto(
                    entrada,
                    "domini autoritzat",
                    180,
                    true,
                ),
            );

        if (
            !dominioValido(
                dominio,
            )
        ) {
            throw new ErrorAPI(
                400,
                `El domini "${dominio}" no és vàlid.`,
            );
        }

        if (
            usados.has(
                dominio,
            )
        ) {
            continue;
        }

        usados.add(
            dominio,
        );

        resultado.push(
            dominio,
        );
    }

    return resultado;
}

// ============================================================
// CURSOS
// ============================================================

function leerCursos(
    valor: unknown,
): CursoConfiguracion[] {
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
            entrada.grupos
                .length >
            MAX_GRUPOS_POR_CURSO
        ) {
            throw new ErrorAPI(
                400,
                `El curs "${curso}" té massa grups.`,
            );
        }

        const grupos:
            string[] = [];

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
                continue;
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
// FORMULARIO
// ============================================================

function leerConfiguracion(
    cuerpo: Registro,
) {
    const cursoAcademico =
        leerTexto(
            cuerpo
                .curso_academico_actual,
            "curs acadèmic",
            30,
        );

    const horas =
        cuerpo
            .horas_aviso_formulario_incompleto;

    if (
        typeof horas !==
            "number" ||
        !Number.isSafeInteger(
            horas,
        ) ||
        horas < 1 ||
        horas > 720
    ) {
        throw new ErrorAPI(
            400,
            "Les hores d'avís han de ser un nombre enter entre 1 i 720.",
        );
    }

    return {
        curso_academico_actual:
            cursoAcademico ||
            null,

        cursos:
            leerCursos(
                cuerpo.cursos,
            ),

        registros_habilitados:
            leerBooleano(
                cuerpo
                    .registros_habilitados,
                "registres habilitats",
            ),

        admin_mode:
            leerBooleano(
                cuerpo.admin_mode,
                "Admin Mode",
            ),

        emails_registro_permitidos:
            leerEmails(
                cuerpo
                    .emails_registro_permitidos,
            ),

        dominios_registro_permitidos:
            leerDominios(
                cuerpo
                    .dominios_registro_permitidos,
            ),

        email_notificaciones_principal:
            leerEmail(
                cuerpo
                    .email_notificaciones_principal,
                "correu principal de notificacions",
            ),

        email_notificaciones_secundario:
            leerEmail(
                cuerpo
                    .email_notificaciones_secundario,
                "correu secundari de notificacions",
            ),

        notificar_nuevo_usuario:
            leerBooleano(
                cuerpo
                    .notificar_nuevo_usuario,
                "notificació de nou usuari",
            ),

        notificar_nuevo_equipo:
            leerBooleano(
                cuerpo
                    .notificar_nuevo_equipo,
                "notificació de nou equip",
            ),

        notificar_nuevo_voluntario:
            leerBooleano(
                cuerpo
                    .notificar_nuevo_voluntario,
                "notificació de nou voluntari",
            ),

        notificar_incidencias_formularios:
            leerBooleano(
                cuerpo
                    .notificar_incidencias_formularios,
                "notificació d'incidències",
            ),

        horas_aviso_formulario_incompleto:
            horas,

        mensaje_registro_cerrado:
            leerTexto(
                cuerpo
                    .mensaje_registro_cerrado,
                "missatge de registre tancat",
                1000,
            ),
    };
}

// ============================================================
// PERMISOS
// ============================================================

function puede(
    usuario: Usuario,
    accion:
        | "ver"
        | "editar",
) {
    return (
        tienePermiso(
            usuario,
            "panell",
            "ver",
        ) &&
        tienePermiso(
            usuario,
            "configuracio",
            "ver",
        ) &&
        (
            accion === "ver" ||
            tienePermiso(
                usuario,
                "configuracio",
                "editar",
            )
        )
    );
}

function exigirPermiso(
    usuario: Usuario,
    accion:
        | "ver"
        | "editar",
) {
    if (
        !puede(
            usuario,
            accion,
        )
    ) {
        throw new ErrorAPI(
            403,
            "No tens permís per gestionar la configuració de la plataforma.",
        );
    }
}

// ============================================================
// BASE DE DATOS
// ============================================================

function normalizarFila(
    fila: unknown,
): ConfiguracionPlataforma {
    if (
        !esRegistro(
            fila,
        )
    ) {
        throw new ErrorAPI(
            500,
            "La configuració guardada no té un format vàlid.",
        );
    }

    const cursos:
        CursoConfiguracion[] =
        Array.isArray(
            fila.cursos,
        )
            ? fila.cursos
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
                      ) => ({
                          curso:
                              typeof entrada.curso ===
                              "string"
                                  ? entrada
                                        .curso
                                  : "",

                          grupos:
                              Array.isArray(
                                  entrada
                                      .grupos,
                              )
                                  ? entrada.grupos.filter(
                                        (
                                            grupo,
                                        ): grupo is string =>
                                            typeof grupo ===
                                            "string",
                                    )
                                  : [],
                      }),
                  )
                  .filter(
                      (
                          curso,
                      ) =>
                          Boolean(
                              curso.curso,
                          ),
                  )
            : [];

    return {
        id:
            typeof fila.id ===
            "string"
                ? fila.id
                : null,

        curso_academico_actual:
            typeof fila
                .curso_academico_actual ===
            "string"
                ? fila
                      .curso_academico_actual
                : null,

        cursos,

        registros_habilitados:
            fila
                .registros_habilitados ===
            true,

        admin_mode:
            fila.admin_mode ===
            true,

        emails_registro_permitidos:
            Array.isArray(
                fila
                    .emails_registro_permitidos,
            )
                ? fila.emails_registro_permitidos.filter(
                      (
                          valor,
                      ): valor is string =>
                          typeof valor ===
                          "string",
                  )
                : [],

        dominios_registro_permitidos:
            Array.isArray(
                fila
                    .dominios_registro_permitidos,
            )
                ? fila.dominios_registro_permitidos.filter(
                      (
                          valor,
                      ): valor is string =>
                          typeof valor ===
                          "string",
                  )
                : [],

        email_notificaciones_principal:
            typeof fila
                .email_notificaciones_principal ===
            "string"
                ? fila
                      .email_notificaciones_principal
                : "",

        email_notificaciones_secundario:
            typeof fila
                .email_notificaciones_secundario ===
            "string"
                ? fila
                      .email_notificaciones_secundario
                : "",

        notificar_nuevo_usuario:
            fila
                .notificar_nuevo_usuario !==
            false,

        notificar_nuevo_equipo:
            fila
                .notificar_nuevo_equipo !==
            false,

        notificar_nuevo_voluntario:
            fila
                .notificar_nuevo_voluntario !==
            false,

        notificar_incidencias_formularios:
            fila
                .notificar_incidencias_formularios !==
            false,

        horas_aviso_formulario_incompleto:
            typeof fila
                .horas_aviso_formulario_incompleto ===
                "number" &&
            Number.isSafeInteger(
                fila
                    .horas_aviso_formulario_incompleto,
            )
                ? fila
                      .horas_aviso_formulario_incompleto
                : 24,

        mensaje_registro_cerrado:
            typeof fila
                .mensaje_registro_cerrado ===
            "string"
                ? fila
                      .mensaje_registro_cerrado
                : CONFIGURACION_DEFECTO
                      .mensaje_registro_cerrado,

        created_at:
            typeof fila
                .created_at ===
            "string"
                ? fila.created_at
                : null,

        updated_at:
            typeof fila
                .updated_at ===
            "string"
                ? fila.updated_at
                : null,

        updated_by:
            typeof fila
                .updated_by ===
            "string"
                ? fila.updated_by
                : null,
    };
}

async function obtenerConfiguracion():
    Promise<
        ConfiguracionPlataforma | null
    > {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(TABLA)
            .select(CAMPOS)
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

    return normalizarFila(
        fila,
    );
}

function configuracionDefecto():
    ConfiguracionPlataforma {
    return {
        id: null,

        ...CONFIGURACION_DEFECTO,

        created_at: null,

        updated_at: null,

        updated_by: null,
    };
}

// ============================================================
// GET
// ============================================================

export const GET:
    APIRoute =
    async ({
        cookies,
    }) => {
        try {
            const token =
                cookies.get(
                    "token_sesion",
                )?.value;

            const usuario =
                token
                    ? await obtenerUsuarioPorToken(
                          token,
                      )
                    : null;

            if (!usuario) {
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

            exigirPermiso(
                usuario,
                "ver",
            );

            const configuracion =
                await obtenerConfiguracion();

            return responder({
                success: true,

                configuracion:
                    configuracion ??
                    configuracionDefecto(),

                puedeEditar:
                    puede(
                        usuario,
                        "editar",
                    ),
            });
        } catch (error) {
            return responderError(
                error,
            );
        }
    };

// ============================================================
// PATCH
// ============================================================

export const PATCH:
    APIRoute =
    async ({
        cookies,
        request,
        url,
    }) => {
        try {
            /*
             * Las modificaciones deben proceder
             * del mismo origen.
             */
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

            const token =
                cookies.get(
                    "token_sesion",
                )?.value;

            const usuario =
                token
                    ? await obtenerUsuarioPorToken(
                          token,
                      )
                    : null;

            if (!usuario) {
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

            exigirPermiso(
                usuario,
                "editar",
            );

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

            const cuerpo =
                await leerJSON(
                    request,
                );

            const formulario =
                leerConfiguracion(
                    cuerpo,
                );

            const ahora =
                new Date()
                    .toISOString();

            const anterior =
                await obtenerConfiguracion();

            // ====================================================
            // CREAR CONFIGURACIÓN INICIAL
            // ====================================================

            if (
                !anterior?.id
            ) {
                const {
                    data,
                    error,
                } =
                    await supabaseAdmin
                        .from(
                            TABLA,
                        )
                        .insert({
                            id:
                                randomUUID(),

                            ...formulario,

                            created_at:
                                ahora,

                            updated_at:
                                ahora,

                            updated_by:
                                usuario.id,
                        })
                        .select(
                            CAMPOS,
                        )
                        .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!data) {
                    throw new ErrorAPI(
                        500,
                        "No s'ha pogut crear la configuració.",
                    );
                }

                return responder({
                    success:
                        true,

                    mensaje:
                        "Configuració guardada correctament.",

                    configuracion:
                        normalizarFila(
                            data,
                        ),
                });
            }

            // ====================================================
            // ACTUALIZAR CONFIGURACIÓN
            // ====================================================

            let consulta =
                supabaseAdmin
                    .from(
                        TABLA,
                    )
                    .update({
                        ...formulario,

                        updated_at:
                            ahora,

                        updated_by:
                            usuario.id,
                    })
                    .eq(
                        "id",
                        anterior.id,
                    );

            /*
             * Evita sobrescribir silenciosamente
             * los cambios realizados por otro
             * administrador mientras esta página
             * estaba abierta.
             */
            consulta =
                anterior
                    .updated_at ===
                null
                    ? consulta.is(
                          "updated_at",
                          null,
                      )
                    : consulta.eq(
                          "updated_at",
                          anterior
                              .updated_at,
                      );

            const {
                data,
                error,
            } =
                await consulta
                    .select(
                        CAMPOS,
                    )
                    .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new ErrorAPI(
                    409,
                    "La configuració ha canviat. Torna a carregar la pàgina abans de guardar.",
                );
            }

            return responder({
                success: true,

                mensaje:
                    "Configuració guardada correctament.",

                configuracion:
                    normalizarFila(
                        data,
                    ),
            });
        } catch (error) {
            return responderError(
                error,
            );
        }
    };