import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso } from "@const/Permisos";

export const GET: APIRoute = async ({ cookies }) => {
  try {
  const token = cookies.get("token_sesion")?.value;
  const usuario = token ? await obtenerUsuarioPorToken(token) : null;
  if (!usuario) return Response.json({ mensaje: "Has d'iniciar sessió." }, { status: 401 });
  if (!tienePermiso(usuario, "panell") || !tienePermiso(usuario, "tornejos")) {
    return Response.json({ mensaje: "No tens permís per veure els tornejos." }, { status: 403 });
  }
  const [{ data: tornejos, error: tornejosError }, { data: edicions, error: edicionsError }] =
    await Promise.all([
      supabaseAdmin
        .from("torneos")
        .select("id, nombre, banner, logo, deporte, created_at"),

      supabaseAdmin
        .from("ediciones")
        .select("torneo_id, estado"),
    ]);

  if (tornejosError || edicionsError) {
    return new Response(
      JSON.stringify({
        success: false,
        mensaje: "No s'han pogut carregar els tornejos.",
      }),
      { status: 500 }
    );
  }

  // Agrupar edicions per torneig
  const edicionsPerTorneig = new Map<string, { estado: string }[]>();

  for (const edicio of edicions) {
    if (!edicionsPerTorneig.has(edicio.torneo_id)) {
      edicionsPerTorneig.set(edicio.torneo_id, []);
    }

    edicionsPerTorneig.get(edicio.torneo_id)!.push(edicio);
  }

  const resultat = tornejos.filter(torneig => tienePermiso(usuario, "tornejos", "ver", torneig.id)).map((torneig) => {
    const edicionsTorneig = edicionsPerTorneig.get(torneig.id) ?? [];

    let estado = "Inactiu";

    if (edicionsTorneig.some((e) => e.estado === "activa")) {
      estado = "Actiu";
    } else if (edicionsTorneig.some((e) => e.estado === "en_preparacio")) {
      estado = "En preparació";
    }

    return {
      id: torneig.id,
      nombre: torneig.nombre,
      banner: torneig.banner,
      logo: torneig.logo,
      deporte: torneig.deporte,
      numeroEdicions: edicionsTorneig.length,
      fecha_creacion: torneig.created_at,
      estado,
    };
  });

  return new Response(
    JSON.stringify({
      success: true,
      data: resultat,
      puedeCrear: tienePermiso(usuario, "tornejos", "crear"),
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    }
  );
  } catch (error) {
    console.error("Error listando torneos:", error);
    return Response.json({ mensaje: "No s'han pogut carregar els tornejos." }, { status: 500 });
  }
};
