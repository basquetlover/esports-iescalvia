import type { APIRoute } from "astro";

import { tienePermiso } from "@const/Permisos";

import {
  comprobarOrigen,
  ErrorAPI,
  exigirUsuario,
  leerJSON,
  responder,
  UUID,
} from "@utils/inscripcio/equipBase";

import {
  revocarDesignacion,
  type ContextoDesignaciones,
} from "@utils/acta/designaciones";

export const prerender = false;

// ============================================================
// VALIDACIONES
// ============================================================

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function responderError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error revocant la designació:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut revocar la designació.",
    },
    500,
  );
}

// ============================================================
// POST — REVOCAR DESIGNACIÓN
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const gestor = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    const partidoID = identificador(
      url.searchParams.get("partidoID"),
      "partit",
    );

    if (
      !tienePermiso(gestor, "panell", "ver", torneoID) ||
      !tienePermiso(gestor, "designacions", "ver", torneoID) ||
      !tienePermiso(gestor, "designacions", "revocar", torneoID)
    ) {
      throw new ErrorAPI(403, "No tens permís per revocar designacions.");
    }

    const contenido = await leerJSON(request);

    const designacionID = identificador(contenido.designacionID, "designació");

    const motivo = contenido.motivo;

    if (
      typeof motivo !== "string" ||
      !motivo.trim() ||
      motivo.trim().length > 1000
    ) {
      throw new ErrorAPI(
        400,
        "Indica un motiu vàlid de fins a 1.000 caràcters.",
      );
    }

    const contexto: ContextoDesignaciones = {
      gestor,
      torneoID,
      edicionID,
      partidoID,
    };

    const designacion = await revocarDesignacion(
      contexto,
      designacionID,
      motivo.trim(),
    );

    return responder({
      success: true,
      mensaje: "Designació revocada correctament.",
      designacion,
    });
  } catch (error) {
    return responderError(error);
  }
};
