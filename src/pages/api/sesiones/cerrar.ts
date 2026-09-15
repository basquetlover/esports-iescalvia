import type { APIRoute } from "astro";
import { cerrarSesion } from "./sesiones";

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
    try {
        const token = cookies.get("token_sesion")?.value;

        if (token) {
            await cerrarSesion(token, cookies);
        } else {
            cookies.delete("token_sesion", {
                path: "/",
            });
        }

        return Response.json(
            {
                success: true,
                mensaje: "Sessió tancada correctament.",
            },
            {
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error("Error en tancar sessió:", error);

        return Response.json(
            {
                success: false,
                mensaje: "No s'ha pogut tancar la sessió. Torna-ho a provar.",
            },
            {
                status: 500,
                headers: {
                    "Cache-Control": "private, no-store",
                },
            }
        );
    }
};