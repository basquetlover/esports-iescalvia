import type { APIRoute } from "astro";
import { supabaseAdmin } from "src/utils/supabase";
import { crearSesion } from "src/pages/api/sesiones/sesiones";

export const POST: APIRoute = async ({ request, cookies }) => {
    try {
        const data = await request.json();

        const {
            nombre,
            apellido1,
            apellido2,
            curso,
            email,
            contrasena
        } = data;

        // -------------------------
        // 🔒 VALIDACIONES BÁSICAS
        // -------------------------

        if (!nombre || !apellido1 || !email || !contrasena) {
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

        const emailValido =
            email.endsWith("@ibeducacio.eu") ||
            email.endsWith("@alu.ibeducacio.eu");

        if (!emailValido) {
            return new Response(
                JSON.stringify({
                    mensaje: "Només correu institucional."
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

        if (usuarioExistente) {
            return new Response(
                JSON.stringify({
                    mensaje: "Aquest correu ja està registrat."
                }),
                { status: 409 }
            );
        }

        const contrasenaHash = await hashPassword(contrasena);
        const anoAcademico = getAnyoAcademico();
        
        console.log(anoAcademico)

        // -------------------------
        // 🔐 CREAR USUARIO (SIMULADO)
        // -------------------------

        const { data: nuevoUsuario, error: crearUsuarioError } = await supabaseAdmin
            .from("users")
            .insert({
                nombre: nombre,
                apellido1: apellido1,
                apellido2: apellido2,
                curso: curso,
                email: email,
                contrasena: contrasenaHash,
                ano_academico: anoAcademico,
                fecha_creacion: new Date().toISOString(),
                fecha_actualizacion: new Date().toISOString(),
                activa: true
            })
            .select()
            .single();

            if(crearUsuarioError){
                console.log("Error al crear el usuario:", crearUsuarioError);
                return new Response(
                    JSON.stringify({
                        mensaje: "Error al crear el usuario."
                    }),
                    { status: 500 }
                );
            }
        // -------------------------
        // 🔐 Iniciar sesion
        // -------------------------

        //console.log("Iniciando sesión para el usuario:", nuevoUsuario);
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

const getAnyoAcademico = () => {
    const fecha = new Date();
    const year = fecha.getFullYear();
    const mes = fecha.getMonth(); // 0 = enero, 8 = septiembre

    // septiembre (8) o más → nuevo curso
    const inicio = mes >= 8 ? year : year - 1;
    const fin = inicio + 1;

    return `${inicio}-${fin}`;
};