import type { APIRoute } from "astro";
import { supabaseAdmin } from "src/utils/supabase";


export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const data = await request.json();

        const {
            email,
            contrasena
        } = data;
        
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