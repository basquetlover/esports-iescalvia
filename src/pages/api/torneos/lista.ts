import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";

export const GET: APIRoute = async () => {
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
        message: tornejosError?.message || edicionsError?.message,
      }),
      { status: 500 }
    );
  }

  // Agrupar edicions per torneig
  const edicionsPerTorneig = new Map<number, { estado: string }[]>();

  for (const edicio of edicions) {
    if (!edicionsPerTorneig.has(edicio.torneo_id)) {
      edicionsPerTorneig.set(edicio.torneo_id, []);
    }

    edicionsPerTorneig.get(edicio.torneo_id)!.push(edicio);
  }

  const resultat = tornejos.map((torneig) => {
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
    }),
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
};