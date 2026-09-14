import { defineMiddleware } from "astro:middleware";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso } from "@const/Permisos";

const RUTAS_PRIVADAS = [
    "/panell",
    "/perfil",
];

const METODOS_CORS = [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
];

const CABECERAS_CORS = new Set([
    "accept",
    "content-type",
]);

function cargarOrigenes(): Set<string> {
    const configuracion = String(
        import.meta.env.ORIGENES_AUTORIZADOS ?? ""
    ).trim();

    if (!configuracion) {
        throw new Error(
            "Falta configurar ORIGENES_AUTORIZADOS."
        );
    }

    const origenes = new Set<string>();
    const entradas = configuracion
        .split(/[,\n;]+/)
        .map((entrada) =>
            entrada.trim().replace(/^['"]|['"]$/g, "")
        )
        .filter(Boolean);

    if (entradas.length === 0) {
        throw new Error(
            "ORIGENES_AUTORIZADOS no contiene ningún origen."
        );
    }

    for (const valor of entradas) {
        let url: URL;

        try {
            url = new URL(valor);
        } catch {
            throw new Error(
                `ORIGENES_AUTORIZADOS contiene un origen no válido: "${valor}".`
            );
        }

        const esValido =
            ["http:", "https:"].includes(url.protocol) &&
            !url.username &&
            !url.password &&
            url.pathname === "/" &&
            !url.search &&
            !url.hash;

        if (!esValido) {
            throw new Error(
                `ORIGENES_AUTORIZADOS debe contener solo orígens HTTP/HTTPS sin rutas, credencials ni query/hash. Valor inválido: "${valor}".`
            );
        }

        origenes.add(url.origin);
    }

    if (origenes.size === 0) {
        throw new Error(
            "ORIGENES_AUTORIZADOS no contiene ningún origen válido."
        );
    }

    return origenes;
}

const ORIGENES_AUTORIZADOS = cargarOrigenes();

function perteneceA(ruta: string, base: string): boolean {
    return ruta === base || ruta.startsWith(`${base}/`);
}

function normalizarRuta(pathname: string): string {
    return (
        decodeURIComponent(pathname)
            .replace(/\/+/g, "/")
            .replace(/\/+$/, "") || "/"
    );
}

function errorJSON(estado: number, mensaje: string): Response {
    return Response.json(
        {
            success: false,
            mensaje,
        },
        {
            status: estado,
            headers: {
                "Cache-Control": "private, no-store",
            },
        }
    );
}

/**
 * Las peticiones GET/HEAD del mismo origen pueden no incluir Origin.
 * En ese caso se comprueba el origen del Referer.
 *
 * No se permite recurrir a Referer si existe un Origin rechazado.
 */
function obtenerOrigenPeticion(request: Request): string | null {
    const origen = request.headers.get("origin");

    if (origen !== null) {
        return ORIGENES_AUTORIZADOS.has(origen)
            ? origen
            : null;
    }

    const metodo = request.method.toUpperCase();

    if (metodo !== "GET" && metodo !== "HEAD") {
        return null;
    }

    const referer = request.headers.get("referer");

    if (!referer) return null;

    try {
        const origenReferer = new URL(referer).origin;

        return ORIGENES_AUTORIZADOS.has(origenReferer)
            ? origenReferer
            : null;
    } catch {
        return null;
    }
}

export const onRequest = defineMiddleware(
    async (contexto, next) => {
        const { request, url, cookies } = contexto;

        let ruta: string;

        try {
            ruta = normalizarRuta(url.pathname);
        } catch {
            return errorJSON(400, "La ruta no és vàlida.");
        }

        const esAPI = perteneceA(ruta, "/api");

        const esPaginaPrivada = RUTAS_PRIVADAS.some(
            (base) => perteneceA(ruta, base)
        );

        if (!esAPI && !esPaginaPrivada) {
            return next();
        }

        const metodo = request.method.toUpperCase();

        /*
         * API: únicamente control de origen en este middleware.
         * Cada endpoint decide si además necesita sesión y permisos.
         */
        if (esAPI) {
            const origenAutorizado = obtenerOrigenPeticion(request);

            function finalizarAPI(respuesta: Response): Response {
                const headers = new Headers(respuesta.headers);

                headers.set("Cache-Control", "private, no-store");
                headers.append("Vary", "Origin");
                headers.append("Vary", "Referer");

                headers.delete("Access-Control-Allow-Origin");
                headers.delete("Access-Control-Allow-Credentials");

                if (origenAutorizado) {
                    headers.set(
                        "Access-Control-Allow-Origin",
                        origenAutorizado
                    );

                    headers.set(
                        "Access-Control-Allow-Credentials",
                        "true"
                    );
                }

                return new Response(respuesta.body, {
                    status: respuesta.status,
                    statusText: respuesta.statusText,
                    headers,
                });
            }

            if (!origenAutorizado) {
                return finalizarAPI(
                    errorJSON(
                        403,
                        "Origen de la petició no permès."
                    )
                );
            }

            if (metodo === "OPTIONS") {
                const metodoSolicitado = (
                    request.headers.get(
                        "access-control-request-method"
                    ) ?? ""
                ).toUpperCase();

                if (!METODOS_CORS.includes(metodoSolicitado)) {
                    return finalizarAPI(
                        errorJSON(405, "Mètode no permès.")
                    );
                }

                const cabecerasSolicitadas = (
                    request.headers.get(
                        "access-control-request-headers"
                    ) ?? ""
                )
                    .split(",")
                    .map((cabecera) =>
                        cabecera.trim().toLowerCase()
                    )
                    .filter(Boolean);

                if (
                    cabecerasSolicitadas.some(
                        (cabecera) => !CABECERAS_CORS.has(cabecera)
                    )
                ) {
                    return finalizarAPI(
                        errorJSON(
                            403,
                            "La petició inclou capçaleres no permeses."
                        )
                    );
                }

                return finalizarAPI(
                    new Response(null, {
                        status: 204,
                        headers: {
                            "Access-Control-Allow-Methods":
                                METODOS_CORS.join(", "),
                            "Access-Control-Allow-Headers":
                                "Accept, Content-Type",
                            Vary:
                                "Access-Control-Request-Method, Access-Control-Request-Headers",
                        },
                    })
                );
            }

            try {
                return finalizarAPI(await next());
            } catch (error) {
                console.error("Error processant la petició API:", error);

                return finalizarAPI(
                    errorJSON(
                        500,
                        "No s'ha pogut completar la petició."
                    )
                );
            }
        }

        /*
         * Páginas privadas: validación de sesión.
         */
        function finalizarPagina(respuesta: Response): Response {
            const headers = new Headers(respuesta.headers);

            headers.set("Cache-Control", "private, no-store");

            return new Response(respuesta.body, {
                status: respuesta.status,
                statusText: respuesta.statusText,
                headers,
            });
        }

        try {
            const token = cookies.get("token_sesion")?.value;

            const usuario = token
                ? await obtenerUsuarioPorToken(token)
                : null;

            if (!usuario) {
                cookies.delete("token_sesion", {
                    path: "/",
                });

                const retorno = url.pathname + url.search;

                return finalizarPagina(
                    contexto.redirect(
                        `/iniciar-sessio?redirect=${encodeURIComponent(retorno)}`,
                        303
                    )
                );
            }

            if (
                perteneceA(ruta, "/panell") &&
                !tienePermiso(usuario, "panell", "ver")
            ) {
                return finalizarPagina(
                    new Response(
                        "No tens accés al panell d’administració.",
                        {
                            status: 403,
                            headers: {
                                "Content-Type":
                                    "text/plain; charset=utf-8",
                            },
                        }
                    )
                );
            }

            // Los layouts mantienen los permisos de sección y torneo.
            return finalizarPagina(await next());
        } catch (error) {
            console.error(
                "Error processant una pàgina privada:",
                error
            );

            return finalizarPagina(
                new Response(
                    "No s'ha pogut completar la petició. Torna-ho a provar.",
                    {
                        status: 500,
                        headers: {
                            "Content-Type":
                                "text/plain; charset=utf-8",
                        },
                    }
                )
            );
        }
    }
);