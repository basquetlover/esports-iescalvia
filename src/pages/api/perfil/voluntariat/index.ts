import type { APIRoute } from "astro";

import { ErrorAPI, responder } from "@utils/inscripcio/equipBase";

import { obtenirEdicionsVoluntariat } from "@utils/voluntariat/acceso";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type EdicionVoluntariat = {
  id: string;
  nombre: string;
  estado: string | null;
  fechaInicio: string | null;
};

type TorneoVoluntariat = {
  id: string;
  nombre: string;
  deporte: string | null;
  logo: string | null;
  ediciones: EdicionVoluntariat[];
};

// ============================================================
// RESPUESTAS
// ============================================================

function respuestaPrivada(
  contenido: Record<string, unknown>,
  estado = 200,
): Response {
  const respuesta = responder(contenido, estado);

  respuesta.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  return respuesta;
}

function responderError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return respuestaPrivada(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error consultant el voluntariat del perfil:", error);

  return respuestaPrivada(
    {
      success: false,
      mensaje: "No s'ha pogut consultar l'accés al voluntariat.",
    },
    500,
  );
}

// ============================================================
// ORDENACIÓN
// ============================================================

function ordenarEdiciones(
  ediciones: EdicionVoluntariat[],
): EdicionVoluntariat[] {
  return [...ediciones].sort((a, b) => {
    const fechaA = a.fechaInicio ?? "";
    const fechaB = b.fechaInicio ?? "";

    const diferencia = fechaB.localeCompare(fechaA);

    if (diferencia !== 0) {
      return diferencia;
    }

    return a.nombre.localeCompare(b.nombre, "ca", {
      numeric: true,
    });
  });
}

function ordenarTorneos(torneos: TorneoVoluntariat[]): TorneoVoluntariat[] {
  return [...torneos].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "ca", {
      numeric: true,
    }),
  );
}

// ============================================================
// GET — MIS TORNEOS DE VOLUNTARIADO
// ============================================================

export const GET: APIRoute = async ({ cookies }) => {
  try {
    // ========================================================
    // COMPROBAR ACCESO ACTUAL
    // ========================================================

    /*
     * Aquesta funció:
     *
     * - Valida la sessió.
     * - Comprova que el compte és actiu.
     * - Consulta formularis aprovats.
     * - Comprova voluntaris confirmats.
     * - Retorna les edicions autoritzades.
     *
     * No guarda autoritzacions en memòria.
     *
     * Si s'ha cancel·lat un voluntariat,
     * deixa d'aparèixer immediatament
     * en la següent petició.
     */

    const accesos = await obtenirEdicionsVoluntariat(cookies);

    // ========================================================
    // AGRUPAR POR TORNEO
    // ========================================================

    const mapaTorneos = new Map<string, TorneoVoluntariat>();

    for (const acceso of accesos) {
      const torneoID = acceso.torneoID;
      const edicionID = acceso.edicionID;

      // ======================================================
      // TORNEO
      // ======================================================

      let torneo = mapaTorneos.get(torneoID);

      if (!torneo) {
        torneo = {
          id: acceso.torneo.id,
          nombre: acceso.torneo.nombre,
          deporte: acceso.torneo.deporte,
          logo: acceso.torneo.logo,
          ediciones: [],
        };

        mapaTorneos.set(torneoID, torneo);
      }

      // ======================================================
      // EDICIÓN AUTORIZADA
      // ======================================================

      /*
       * La mateixa edició no s'ha de mostrar
       * dues vegades si hi ha més d'un
       * formulari vinculat al mateix usuari.
       */

      const edicionExistente = torneo.ediciones.some(
        (edicion) => edicion.id === edicionID,
      );

      if (edicionExistente) {
        continue;
      }

      torneo.ediciones.push({
        id: acceso.edicion.id,
        nombre: acceso.edicion.nombre,
        estado: acceso.edicion.estado,
        fechaInicio: acceso.edicion.fechaInicio,
      });
    }

    // ========================================================
    // ORDENAR LOS RESULTADOS
    // ========================================================

    const torneos = ordenarTorneos(
      [...mapaTorneos.values()].map((torneo) => ({
        ...torneo,

        ediciones: ordenarEdiciones(torneo.ediciones),
      })),
    );

    // ========================================================
    // ESTADÍSTICAS
    // ========================================================

    const totalTorneos = torneos.length;

    const totalEdiciones = torneos.reduce(
      (total, torneo) => total + torneo.ediciones.length,
      0,
    );

    const tieneAcceso = totalEdiciones > 0;

    // ========================================================
    // RESPUESTA
    // ========================================================

    return respuestaPrivada({
      success: true,

      tieneAcceso,

      resumen: {
        totalTorneos,
        totalEdiciones,
      },

      torneos,
    });
  } catch (error) {
    return responderError(error);
  }
};
