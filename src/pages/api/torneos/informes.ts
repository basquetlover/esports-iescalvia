import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";
import { UUID } from "@utils/inscripcio/equipBase";

export const prerender = false;

type InformePublicoDB = {
  id: string;
  visibilidad: string;
  motivo: string;
  contenido: string;
  equipo_responsable_nombre: string | null;
  creado_at: string;
};

function respuesta(datos: unknown, status = 200): Response {
  return Response.json(datos, {
    status,
    headers: { "Cache-Control": "public, no-store" },
  });
}

function uuid(valor: string | null): string | null {
  const limpio = valor?.trim().toLowerCase() ?? "";
  return UUID.test(limpio) ? limpio : null;
}

/**
 * GET /api/torneos/informes?torneoID=...&edicionID=...&partidoID=...
 *
 * Acceso público sin sesión. Nunca devuelve informes internos,
 * ni datos identificativos del administrador que los redactó.
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const torneoID = uuid(url.searchParams.get("torneoID"));
    const edicionID = uuid(url.searchParams.get("edicionID"));
    const partidoID = uuid(url.searchParams.get("partidoID"));

    if (!torneoID || !edicionID || !partidoID) {
      return respuesta(
        { success: false, mensaje: "Paràmetres no vàlids." },
        400,
      );
    }

    // Validar que el partido es público y pertenece realmente
    // al torneo y a la edición solicitados.
    const [torneoRes, edicionRes, partidoRes] = await Promise.all([
      supabaseAdmin
        .from("torneos")
        .select("id")
        .eq("id", torneoID)
        .eq("activo", true)
        .maybeSingle(),

      supabaseAdmin
        .from("ediciones")
        .select("id")
        .eq("id", edicionID)
        .eq("torneo_id", torneoID)
        .maybeSingle(),

      supabaseAdmin
        .from("competicion_partidos")
        .select("id")
        .eq("id", partidoID)
        .eq("edicion_id", edicionID)
        .eq("publicado", true)
        .maybeSingle(),
    ]);

    if (torneoRes.error) throw torneoRes.error;
    if (edicionRes.error) throw edicionRes.error;
    if (partidoRes.error) throw partidoRes.error;

    if (!torneoRes.data || !edicionRes.data || !partidoRes.data) {
      return respuesta(
        {
          success: false,
          mensaje: "Partit no disponible.",
        },
        404,
      );
    }

    // Lista blanca de columnas.
    // NO seleccionar autor_id ni autor_nombre.
    const { data, error } = await supabaseAdmin
      .from("acta_informes")
      .select(
        "id,visibilidad,motivo,contenido,equipo_responsable_nombre,creado_at",
      )
      .eq("torneo_id", torneoID)
      .eq("edicion_id", edicionID)
      .eq("partido_id", partidoID)
      .eq("visibilidad", "PUBLICO")
      .order("creado_at", { ascending: false })
      .limit(1000);

    if (error) throw error;

    const informes = ((data ?? []) as InformePublicoDB[])
      .filter((informe) => informe.visibilidad === "PUBLICO")
      .map((informe) => ({
        id: informe.id,
        motivo: informe.motivo,
        contenido: informe.contenido,
        equipoResponsableNombre: informe.equipo_responsable_nombre,
        creadoAt: informe.creado_at,
      }));

    return respuesta({
      success: true,
      informes,
    });
  } catch (error) {
    console.error("Error recuperant els informes públics:", error);

    return respuesta(
      {
        success: false,
        mensaje: "No s'han pogut carregar els informes públics.",
      },
      500,
    );
  }
};
