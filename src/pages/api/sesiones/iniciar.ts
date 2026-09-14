import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import {
    crearSesion,
    ErrorSesion,
} from "./sesiones";

export const prerender = false;

function responder(datos: unknown, estado = 200) {
    return Response.json(datos, {
        status: estado,
        headers: {
            "Cache-Control": "private, no-store",
        },
    });
}

/**
 * Compatible con el formato de contraseñas existente.
 */
export async function verificarPassword(
    passwordPlano: string,
    passwordHashDB: unknown
): Promise<boolean> {
    if (
        typeof passwordHashDB !== "string" ||
        !/^[0-9a-f]{64}$/i.test(passwordHashDB)
    ) {
        return false;
    }

    const encoder = new TextEncoder();

    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(passwordPlano)
    );

    const hashHex = Array.from(new Uint8Array(hashBuffer))
        .map((valor) => valor.toString(16).padStart(2, "0"))
        .join("");

    const hashGuardado = passwordHashDB.toLowerCase();

    let diferencia = 0;

    for (let indice = 0; indice < hashHex.length; indice++) {
        diferencia |=
            hashHex.charCodeAt(indice) ^
            hashGuardado.charCodeAt(indice);
    }

    return diferencia === 0;
}

export const POST: APIRoute = async ({
    request,
    cookies,
    url,
}) => {
    try {
        if (request.headers.get("origin") !== url.origin) {
            return responder(
                {
                    success: false,
                    mensaje: "Origen de la petició no permès.",
                },
                403
            );
        }

        const tipoContenido =
            request.headers.get("content-type") ?? "";

        if (
            tipoContenido.split(";")[0].trim().toLowerCase() !==
            "application/json"
        ) {
            return responder(
                {
                    success: false,
                    mensaje: "El format de la petició no és vàlid.",
                },
                415
            );
        }

        let cuerpo: unknown;

        try {
            cuerpo = await request.json();
        } catch {
            return responder(
                {
                    success: false,
                    mensaje: "La petició no conté un JSON vàlid.",
                },
                400
            );
        }

        if (
            cuerpo === null ||
            typeof cuerpo !== "object" ||
            Array.isArray(cuerpo)
        ) {
            return responder(
                {
                    success: false,
                    mensaje: "La petició no és vàlida.",
                },
                400
            );
        }

        const datos = cuerpo as Record<string, unknown>;

        if (
            typeof datos.email !== "string" ||
            typeof datos.contrasena !== "string"
        ) {
            return responder(
                {
                    success: false,
                    mensaje: "Indica el correu electrònic i la contrasenya.",
                },
                400
            );
        }

        const email = datos.email.trim();

        // No se recortan espacios de la contraseña.
        const contrasena = datos.contrasena;

        if (!email || !contrasena) {
            return responder(
                {
                    success: false,
                    mensaje: "Indica el correu electrònic i la contrasenya.",
                },
                400
            );
        }

        if (email.length > 254 || contrasena.length > 4096) {
            return responder(
                {
                    success: false,
                    mensaje: "Les dades introduïdes no són vàlides.",
                },
                400
            );
        }

        const {
            data: usuario,
            error: errorUsuario,
        } = await supabaseAdmin
            .from("users")
            .select(
                "id,nombre,apellido1,apellido2,email,curso,ano_academico,rol,activa,contrasena"
            )
            .eq("email", email)
            .maybeSingle();

        if (errorUsuario) {
            throw errorUsuario;
        }

        if (!usuario) {
            return responder(
                {
                    success: false,
                    mensaje: "Correu electrònic o contrasenya incorrectes.",
                },
                401
            );
        }

        const passwordValido = await verificarPassword(
            contrasena,
            usuario.contrasena
        );

        if (!passwordValido) {
            return responder(
                {
                    success: false,
                    mensaje: "Correu electrònic o contrasenya incorrectes.",
                },
                401
            );
        }

        if (usuario.activa !== true) {
            return responder(
                {
                    success: false,
                    mensaje:
                        usuario.activa === false
                            ? "El teu compte està bloquejat. Contacta amb l’administració."
                            : "El teu compte no està actiu. Contacta amb l’administració.",
                },
                403
            );
        }

        // Vuelve a validar el estado del usuario antes de emitir la cookie.
        await crearSesion(usuario.id, cookies);

        return responder({
            success: true,
            mensaje: "Sessió iniciada correctament.",
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                apellido1: usuario.apellido1,
                apellido2: usuario.apellido2,
                email: usuario.email,
                curso: usuario.curso,
                ano_academico: usuario.ano_academico,
                rol: usuario.rol,
                activa: usuario.activa,
            },
        });
    } catch (error) {
        if (error instanceof ErrorSesion) {
            return responder(
                {
                    success: false,
                    mensaje: error.message,
                },
                error.estado
            );
        }

        console.error("Error en iniciar sessió:", error);

        return responder(
            {
                success: false,
                mensaje: "No s'ha pogut iniciar sessió. Torna-ho a provar.",
            },
            500
        );
    }
};