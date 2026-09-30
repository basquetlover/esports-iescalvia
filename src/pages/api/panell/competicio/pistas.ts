import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

// ============================================================
// HELPERS
// ============================================================

function errorRespuesta(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error gestionant les pistes:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim().toLowerCase();

  if (!UUID.test(limpio)) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return limpio;
}

function texto(
  valor: unknown,
  nombre: string,
  maximo: number,
  obligatorio = false,
): string {
  if (valor === undefined || valor === null) {
    if (obligatorio) {
      throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
    }

    return "";
  }

  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim();

  if (obligatorio && !limpio) {
    throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
  }

  if (limpio.length > maximo) {
    throw new ErrorAPI(
      400,
      `El camp ${nombre} supera els ${maximo} caràcters.`,
    );
  }

  return limpio;
}

function booleano(valor: unknown, defecto: boolean) {
  return typeof valor === "boolean" ? valor : defecto;
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirTorneo(
  usuario: Usuario,
  torneoID: string,
  accion: "ver" | "editar",
) {
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "competicio", accion, torneoID)) {
    throw new ErrorAPI(
      403,
      accion === "editar"
        ? "No tens permís per modificar les pistes."
        : "No tens permís per consultar les pistes.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("torneos")
    .select("id,nombre,deporte")
    .eq("id", torneoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  return data;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const torneo = await exigirTorneo(usuario, torneoID, "ver");

    const { data, error } = await supabaseAdmin
      .from("competicion_pistas")
      .select("id,torneo_id,nombre,descripcion,ubicacion,activa")
      .eq("torneo_id", torneoID)
      .order("activa", {
        ascending: false,
      })
      .order("nombre", {
        ascending: true,
      });

    if (error) {
      throw error;
    }

    return responder({
      success: true,

      torneo,

      capacidades: {
        editar: tienePermiso(usuario, "competicio", "editar", torneoID),
      },

      pistas: data ?? [],
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    await exigirTorneo(usuario, torneoID, "editar");

    const nombre = texto(entrada.nombre, "nom", 120, true);

    const descripcion = texto(entrada.descripcion, "descripció", 500);

    const ubicacion = texto(entrada.ubicacion, "ubicació", 250);

    const { data, error } = await supabaseAdmin
      .from("competicion_pistas")
      .insert({
        torneo_id: torneoID,

        nombre,

        descripcion,

        ubicacion,

        activa: true,
      })
      .select("id,torneo_id,nombre,descripcion,ubicacion,activa")
      .single();

    if (error) {
      throw error;
    }

    return responder(
      {
        success: true,
        pista: data,
      },
      201,
    );
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// PATCH
// ============================================================

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const pistaID = identificador(entrada.pistaID, "pista");

    await exigirTorneo(usuario, torneoID, "editar");

    const { data: existente, error: errorExistente } = await supabaseAdmin
      .from("competicion_pistas")
      .select("id")
      .eq("id", pistaID)
      .eq("torneo_id", torneoID)
      .maybeSingle();

    if (errorExistente) {
      throw errorExistente;
    }

    if (!existente) {
      throw new ErrorAPI(404, "No s'ha trobat la pista.");
    }

    const nombre = texto(entrada.nombre, "nom", 120, true);

    const descripcion = texto(entrada.descripcion, "descripció", 500);

    const ubicacion = texto(entrada.ubicacion, "ubicació", 250);

    const activa = booleano(entrada.activa, true);

    const { data, error } = await supabaseAdmin
      .from("competicion_pistas")
      .update({
        nombre,
        descripcion,
        ubicacion,
        activa,
      })
      .eq("id", pistaID)
      .eq("torneo_id", torneoID)
      .select("id,torneo_id,nombre,descripcion,ubicacion,activa")
      .single();

    if (error) {
      throw error;
    }

    return responder({
      success: true,
      pista: data,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// DELETE
// ============================================================

export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const pistaID = identificador(entrada.pistaID, "pista");

    await exigirTorneo(usuario, torneoID, "editar");

    /*
     * No eliminamos físicamente la pista.
     *
     * Puede estar asociada a partidos históricos.
     */

    const { data, error } = await supabaseAdmin
      .from("competicion_pistas")
      .update({
        activa: false,
      })
      .eq("id", pistaID)
      .eq("torneo_id", torneoID)
      .select("id,torneo_id,nombre,descripcion,ubicacion,activa")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ErrorAPI(404, "No s'ha trobat la pista.");
    }

    return responder({
      success: true,
      pista: data,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};
