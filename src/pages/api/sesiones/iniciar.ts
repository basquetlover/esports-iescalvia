import type { APIRoute } from "astro";
import { supabaseAdmin } from "src/utils/supabase";
import { crearSesion } from "src/pages/api/sesiones/sesiones";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const data = await request.json();

        const {
            email,
            contrasena
        } = data;

        // -------------------------
        // 🔒 VALIDACIONES BÁSICAS
        // -------------------------

        if (!email || !contrasena) {
            return new Response(
                JSON.stringify({
                    mensaje: "Falten camps obligatoris."
                }),
                { status: 400 }
            );
        }
        

        // -------------------------
        // 👤 EJEMPLO: USUARIO EXISTE
        // (aquí conectarías Supabase o BD)
        // -------------------------

        const {data:usuarioExistente,  error } = await supabaseAdmin
            .from("users")
            .select("*")
            .eq("email", email)
            .single();


        //const usuarioExistente = false; // simulado

        if (!usuarioExistente) {
            return new Response(
                JSON.stringify({
                    mensaje: "No s'ha trobat cap usuari amb aquest correu electrònic."
                }),
                { status: 409 }
            );
        }

        const esValida = await verificarPassword(
            contrasena,
            usuarioExistente.contrasena
        );

        if (!esValida) {
            return new Response(
                JSON.stringify({
                    mensaje: "Credencials incorrectes."
                }),
                { status: 401 }
            );
        }

        
        // -------------------------
        // 🔐 Iniciar sesion
        // -------------------------

        //console.log("Iniciando sesión para el usuario:", nuevoUsuario);
        const sesion = await crearSesion(usuarioExistente.id, cookies);
        // -------------------------
        // ✅ RESPUESTA OK
        // -------------------------

        return new Response(
            JSON.stringify({
                mensaje: "Usuari registrat correctament.",
                usuario: usuarioExistente
            }),
            { status: 200 }
        );

    } catch (error) {
        console.error(error);

        return new Response(
            JSON.stringify({
                mensaje: "Error intern del servidor."
            }),
            { status: 500 }
        );
    }
};

export const verificarPassword = async (
    passwordPlano: string,
    passwordHashDB: string
) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(passwordPlano);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex === passwordHashDB;
};