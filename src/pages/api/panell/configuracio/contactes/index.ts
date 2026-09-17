import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso } from "@const/Permisos";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TABLA =
    "contactos_soporte";

const MAX_JSON_BYTES =
    50_000;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Mantener como literal para conservar
 * correctamente la inferencia de Supabase.
 */
const CAMPOS =
    "id,nombre,cargo,email,descripcion,activo,orden,created_at,updated_at,created_by";

type Usuario = NonNullable<
    Awaited<
        ReturnType<
            typeof obtenerUsuarioPorToken
        >
    >
>;

type Registro =
    Record<string, unknown>;

type Contacto = {
    id: string;

    nombre: string;
    cargo: string;
    email: string;
    descripcion: string;

    activo: boolean;
    orden: number;

    created_at:
        string | null;

    updated_at:
        string | null;

    created_by:
        string | null;
};

type Accion =
    | "crear"
    | "editar"
    | "estado"
    | "ordenar"
    | "eliminar";

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
        "Error en els contactes de suport:",
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
// VALIDACIÓN
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

function leerID(
    valor: unknown,
) {
    if (
        typeof valor !==
            "string" ||
        !UUID.test(valor)
    ) {
        throw new ErrorAPI(
            400,
            "L'identificador del contacte no és vàlid.",
        );
    }

    return valor.toLowerCase();
}

function leerBooleano(
    valor: unknown,
    nombre: string,
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

function leerEmail(
    valor: unknown,
) {
    const email =
        leerTexto(
            valor,
            "correu electrònic",
            254,
            true,
        )
            .toLowerCase();

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

    return email;
}

function leerVersion(
    valor: unknown,
): string | null {
    if (
        valor === null
    ) {
        return null;
    }

    if (
        typeof valor !==
            "string" ||
        !Number.isFinite(
            Date.parse(
                valor,
            ),
        )
    ) {
        throw new ErrorAPI(
            400,
            "La versió del contacte no és vàlida.",
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

function leerFormulario(
    cuerpo: Registro,
) {
    return {
        nombre:
            leerTexto(
                cuerpo.nombre,
                "nom",
                150,
                true,
            ),

        cargo:
            leerTexto(
                cuerpo.cargo,
                "càrrec",
                150,
                true,
            ),

        email:
            leerEmail(
                cuerpo.email,
            ),

        descripcion:
            leerTexto(
                cuerpo.descripcion,
                "descripció",
                1000,
            ),

        activo:
            leerBooleano(
                cuerpo.activo,
                "actiu",
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
            accion ===
                "ver" ||
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
            "No tens permís per gestionar els contactes de suport.",
        );
    }
}

// ============================================================
// NORMALIZACIÓN
// ============================================================

function normalizarContacto(
    fila: unknown,
): Contacto {
    if (
        !esRegistro(
            fila,
        )
    ) {
        throw new ErrorAPI(
            500,
            "El contacte guardat no té un format vàlid.",
        );
    }

    if (
        typeof fila.id !==
        "string"
    ) {
        throw new ErrorAPI(
            500,
            "El contacte guardat no té identificador.",
        );
    }

    return {
        id:
            fila.id,

        nombre:
            typeof fila.nombre ===
            "string"
                ? fila.nombre
                : "",

        cargo:
            typeof fila.cargo ===
            "string"
                ? fila.cargo
                : "",

        email:
            typeof fila.email ===
            "string"
                ? fila.email
                : "",

        descripcion:
            typeof fila.descripcion ===
            "string"
                ? fila.descripcion
                : "",

        activo:
            fila.activo ===
            true,

        orden:
            typeof fila.orden ===
                "number" &&
            Number.isSafeInteger(
                fila.orden,
            )
                ? fila.orden
                : 0,

        created_at:
            typeof fila.created_at ===
            "string"
                ? fila.created_at
                : null,

        updated_at:
            typeof fila.updated_at ===
            "string"
                ? fila.updated_at
                : null,

        created_by:
            typeof fila.created_by ===
            "string"
                ? fila.created_by
                : null,
    };
}

// ============================================================
// BASE DE DATOS
// ============================================================

async function obtenerContactos():
    Promise<Contacto[]> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                TABLA,
            )
            .select(
                CAMPOS,
            )
            .order(
                "orden",
                {
                    ascending:
                        true,

                    nullsFirst:
                        false,
                },
            )
            .order(
                "created_at",
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
    ).map(
        normalizarContacto,
    );
}

async function obtenerContacto(
    id: string,
): Promise<Contacto> {
    const {
        data,
        error,
    } =
        await supabaseAdmin
            .from(
                TABLA,
            )
            .select(
                CAMPOS,
            )
            .eq(
                "id",
                id,
            )
            .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat el contacte.",
        );
    }

    return normalizarContacto(
        data,
    );
}

async function respuestaContactos(
    usuario: Usuario,
    mensaje?: string,
) {
    const contactos =
        await obtenerContactos();

    return responder({
        success: true,

        contactos,

        puedeEditar:
            puede(
                usuario,
                "editar",
            ),

        ...(mensaje
            ? {
                  mensaje,
              }
            : {}),
    });
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

            return await respuestaContactos(
                usuario,
            );
        } catch (error) {
            return responderError(
                error,
            );
        }
    };

// ============================================================
// POST
// ============================================================

export const POST:
    APIRoute =
    async ({
        cookies,
        request,
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

            const accion =
                cuerpo.accion;

            if (
                accion !==
                    "crear" &&
                accion !==
                    "editar" &&
                accion !==
                    "estado" &&
                accion !==
                    "ordenar" &&
                accion !==
                    "eliminar"
            ) {
                throw new ErrorAPI(
                    400,
                    "L'acció indicada no és vàlida.",
                );
            }

            const ahora =
                new Date()
                    .toISOString();

            // ====================================================
            // CREAR
            // ====================================================

            if (
                accion ===
                "crear"
            ) {
                const formulario =
                    leerFormulario(
                        cuerpo,
                    );

                const contactos =
                    await obtenerContactos();

                const orden =
                    contactos.length >
                    0
                        ? Math.max(
                              ...contactos.map(
                                  (
                                      contacto,
                                  ) =>
                                      contacto.orden,
                              ),
                          ) +
                          1
                        : 1;

                const {
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

                            orden,

                            created_at:
                                ahora,

                            updated_at:
                                ahora,

                            created_by:
                                usuario.id,
                        });

                if (error) {
                    throw error;
                }

                return await respuestaContactos(
                    usuario,
                    "Contacte creat correctament.",
                );
            }

            // ====================================================
            // ORDENAR
            // ====================================================

            if (
                accion ===
                "ordenar"
            ) {
                if (
                    !Array.isArray(
                        cuerpo.ids,
                    )
                ) {
                    throw new ErrorAPI(
                        400,
                        "L'ordre enviat no és vàlid.",
                    );
                }

                const ids =
                    cuerpo.ids.map(
                        leerID,
                    );

                if (
                    new Set(
                        ids,
                    ).size !==
                    ids.length
                ) {
                    throw new ErrorAPI(
                        400,
                        "L'ordre conté contactes repetits.",
                    );
                }

                const actuales =
                    await obtenerContactos();

                if (
                    actuales.length !==
                    ids.length
                ) {
                    throw new ErrorAPI(
                        409,
                        "La llista de contactes ha canviat. Torna a carregar-la.",
                    );
                }

                const idsActuales =
                    new Set(
                        actuales.map(
                            (
                                contacto,
                            ) =>
                                contacto.id,
                        ),
                    );

                if (
                    ids.some(
                        (id) =>
                            !idsActuales.has(
                                id,
                            ),
                    )
                ) {
                    throw new ErrorAPI(
                        409,
                        "La llista de contactes ha canviat. Torna a carregar-la.",
                    );
                }

                for (
                    let indice = 0;
                    indice <
                    ids.length;
                    indice++
                ) {
                    const {
                        error,
                    } =
                        await supabaseAdmin
                            .from(
                                TABLA,
                            )
                            .update({
                                orden:
                                    indice +
                                    1,

                                updated_at:
                                    ahora,
                            })
                            .eq(
                                "id",
                                ids[
                                    indice
                                ],
                            );

                    if (error) {
                        throw error;
                    }
                }

                return await respuestaContactos(
                    usuario,
                    "Ordre actualitzat correctament.",
                );
            }

            // ====================================================
            // ACCIONES QUE NECESITAN CONTACTO
            // ====================================================

            const id =
                leerID(
                    cuerpo.id,
                );

            const version =
                leerVersion(
                    cuerpo.updated_at,
                );

            const anterior =
                await obtenerContacto(
                    id,
                );

            if (
                version !==
                anterior.updated_at
            ) {
                throw new ErrorAPI(
                    409,
                    "El contacte ha canviat. Torna a carregar la pàgina abans de continuar.",
                );
            }

            // ====================================================
            // EDITAR
            // ====================================================

            if (
                accion ===
                "editar"
            ) {
                const formulario =
                    leerFormulario(
                        cuerpo,
                    );

                let consulta =
                    supabaseAdmin
                        .from(
                            TABLA,
                        )
                        .update({
                            ...formulario,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            id,
                        );

                consulta =
                    version ===
                    null
                        ? consulta.is(
                              "updated_at",
                              null,
                          )
                        : consulta.eq(
                              "updated_at",
                              version,
                          );

                const {
                    data,
                    error,
                } =
                    await consulta
                        .select(
                            "id",
                        )
                        .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!data) {
                    throw new ErrorAPI(
                        409,
                        "El contacte ha canviat. Torna a carregar la pàgina.",
                    );
                }

                return await respuestaContactos(
                    usuario,
                    "Contacte actualitzat correctament.",
                );
            }

            // ====================================================
            // ACTIVAR / DESACTIVAR
            // ====================================================

            if (
                accion ===
                "estado"
            ) {
                const activo =
                    leerBooleano(
                        cuerpo.activo,
                        "actiu",
                    );

                let consulta =
                    supabaseAdmin
                        .from(
                            TABLA,
                        )
                        .update({
                            activo,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            id,
                        );

                consulta =
                    version ===
                    null
                        ? consulta.is(
                              "updated_at",
                              null,
                          )
                        : consulta.eq(
                              "updated_at",
                              version,
                          );

                const {
                    data,
                    error,
                } =
                    await consulta
                        .select(
                            "id",
                        )
                        .maybeSingle();

                if (error) {
                    throw error;
                }

                if (!data) {
                    throw new ErrorAPI(
                        409,
                        "El contacte ha canviat. Torna a carregar la pàgina.",
                    );
                }

                return await respuestaContactos(
                    usuario,
                    activo
                        ? "Contacte activat correctament."
                        : "Contacte desactivat correctament.",
                );
            }

            // ====================================================
            // ELIMINAR
            // ====================================================

            let consulta =
                supabaseAdmin
                    .from(
                        TABLA,
                    )
                    .delete()
                    .eq(
                        "id",
                        id,
                    );

            consulta =
                version ===
                null
                    ? consulta.is(
                          "updated_at",
                          null,
                      )
                    : consulta.eq(
                          "updated_at",
                          version,
                      );

            const {
                data,
                error,
            } =
                await consulta
                    .select(
                        "id",
                    )
                    .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new ErrorAPI(
                    409,
                    "El contacte ha canviat. Torna a carregar la pàgina abans d'eliminar-lo.",
                );
            }

            /*
             * Renumeramos después de eliminar para
             * mantener siempre 1, 2, 3, 4...
             */
            const restantes =
                await obtenerContactos();

            for (
                let indice = 0;
                indice <
                restantes.length;
                indice++
            ) {
                if (
                    restantes[
                        indice
                    ].orden ===
                    indice +
                        1
                ) {
                    continue;
                }

                const {
                    error:
                        errorOrden,
                } =
                    await supabaseAdmin
                        .from(
                            TABLA,
                        )
                        .update({
                            orden:
                                indice +
                                1,

                            updated_at:
                                ahora,
                        })
                        .eq(
                            "id",
                            restantes[
                                indice
                            ].id,
                        );

                if (
                    errorOrden
                ) {
                    throw errorOrden;
                }
            }

            return await respuestaContactos(
                usuario,
                "Contacte eliminat correctament.",
            );
        } catch (error) {
            return responderError(
                error,
            );
        }
    };