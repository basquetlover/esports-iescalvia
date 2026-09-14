import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso } from "@const/Permisos";

export const GET: APIRoute = async ({ cookies, url }) => {
    try {
        const token = cookies.get("token_sesion")?.value;
        const usuario = token ? await obtenerUsuarioPorToken(token) : null;
        if (!usuario) return Response.json({ mensaje: "Has d'iniciar sessió." }, { status: 401 });
        const torneoID = url.searchParams.get("torneoID");
        if (!torneoID || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(torneoID)) {
            return Response.json({ mensaje: "L'identificador del torneig no és vàlid." }, { status: 400 });
        }
        if (!tienePermiso(usuario, "panell") || !tienePermiso(usuario, "tornejos", "ver", torneoID)) {
            return Response.json({ mensaje: "No tens permís per veure aquest torneig." }, { status: 403 });
        }
        const { data, error } = await supabaseAdmin.from("torneos")
            .select("id, nombre, deporte, descripcion, logo, banner, normativa_base, activo, created_at, updated_at")
            .eq("id", torneoID).maybeSingle();
        if (error) throw error;
        if (!data) return Response.json({ mensaje: "No s'ha trobat el torneig." }, { status: 404 });
        return Response.json({ data, puedeEditar: tienePermiso(usuario, "tornejos", "editar", torneoID) },
            { headers: { "Cache-Control": "private, no-store" } });
    } catch (error) {
        console.error("Error consultando torneo:", error);
        return Response.json({ mensaje: "No s'ha pogut carregar el torneig." }, { status: 500 });
    }
};
