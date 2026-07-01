import type { APIRoute } from "astro";
import { supabaseAdmin } from "src/utils/supabase";
import { crearSesion } from "src/pages/api/sesiones/sesiones";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const data = await request.json();

        const {
            contrasena,
            contrasena2,
            token_recuperar
        } = data;

        // -------------------------
        // 🔒 VALIDACIONES BÁSICAS
        // -------------------------

        if (!contrasena2 || !contrasena || !token_recuperar) {
            return new Response(
                JSON.stringify({
                    mensaje: "Falten camps obligatoris."
                }),
                { status: 400 }
            );
        }

        // -------------------------
        // 📧 VALIDACIÓN EMAIL
        // -------------------------

        // -------------------------
        // 👤 EJEMPLO: USUARIO EXISTE
        // (aquí conectarías Supabase o BD)
        // -------------------------

        const {data:usuarioExistente,  error } = await supabaseAdmin
            .from("verificaciones")
            .select("*")
            .eq("token", token_recuperar)
            .single();


        //const usuarioExistente = false; // simulado

        if (!usuarioExistente) {
            return new Response(
                JSON.stringify({
                    mensaje: "Aquest token de recuperació no és vàlid."
                }),
                { status: 409 }
            );
        }

        const fechaActual = new Date().toISOString();

        if (usuarioExistente.fecha_expiracion < fechaActual) {
            return new Response(
                JSON.stringify({
                    mensaje: "Aquest token de recuperació ha expirat."
                }),
                { status: 409 }
            );
        }

        const contrasenaHash = await hashPassword(contrasena);
        

        // -------------------------
        // 🔐 CREAR USUARIO (SIMULADO)
        // -------------------------

        const { data: nuevoUsuario, error: crearUsuarioError } = await supabaseAdmin
            .from("users")
            .update({
                contrasena: contrasenaHash,
                fecha_actualizacion: new Date().toISOString(),
            })
            .eq("id", usuarioExistente.id_usuario)
            .select()
            .single();

            if(crearUsuarioError){
                console.log("Error al crear el usuario:", crearUsuarioError);
                return new Response(
                    JSON.stringify({
                        mensaje: "Error al restablir la contrasenya."
                    }),
                    { status: 500 }
                );
            }
        // -------------------------
        // 🔐 Iniciar sesion
        // -------------------------

        console.log("Iniciando sesión para el usuario:", nuevoUsuario);
        const sesion = await crearSesion(nuevoUsuario.id, cookies);
        // -------------------------
        // ✅ RESPUESTA OK
        // -------------------------

        return new Response(
            JSON.stringify({
                mensaje: "Usuari registrat correctament.",
                usuario: nuevoUsuario
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

const hashPassword = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);

    const hashBuffer = await crypto.subtle.digest("SHA-256", data);

    const hashArray = Array.from(new Uint8Array(hashBuffer));

    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    return hashHex;
};