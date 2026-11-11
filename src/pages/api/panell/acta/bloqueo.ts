import type { APIRoute, AstroCookies } from "astro";

import { tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";

import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Accion = "bloquear" | "desbloquear";

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;
  estado: string;
  estado_operativo: string;
  controlador_id: string | null;
  control_generacion: number;
  bloqueada_por: string | null;
  bloqueada_at: string | null;
  motivo_bloqueo: string | null;
  finalizada_at: string | null;
  version: number;
};

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,estado,estado_operativo,controlador_id,control_generacion,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_at,version" as const;

// ============================================================
// UTILIDADES
// ============================================================

function validarID(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function resposta(datos: Record<string, unknown>, status = 200): Response {
  const res = responder(datos, status);

  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  return res;
}

function gestionarError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return resposta(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error gestionant el bloqueig de l'acta:", error);

  return resposta(
    {
      success: false,
      mensaje: "No s'ha pogut gestionar el bloqueig.",
    },
    500,
  );
}

// ============================================================
// CONTEXTO DEL GESTOR
// ============================================================

async function exigirGestor(
  cookies: AstroCookies,
  torneoID: string,
  edicionID: string,
  partidoID: string,
  accion: "ver" | Accion,
) {
  const usuario = await exigirUsuario(cookies);

  if (!tienePermiso(usuario, "panell", "ver", torneoID)) {
    throw new ErrorAPI(403, "No tens accés al panell d'aquest torneig.");
  }

  if (!tienePermiso(usuario, "acta-digital", accion, torneoID)) {
    throw new ErrorAPI(403, "No tens permís per gestionar aquesta acta.");
  }

  const [edicionRes, partidoRes] = await Promise.all([
    supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id")
      .eq("id", edicionID)
      .eq("torneo_id", torneoID)
      .maybeSingle(),

    supabaseAdmin
      .from("competicion_partidos")
      .select("id,edicion_id")
      .eq("id", partidoID)
      .eq("edicion_id", edicionID)
      .maybeSingle(),
  ]);

  if (edicionRes.error) throw edicionRes.error;
  if (partidoRes.error) throw partidoRes.error;

  if (!edicionRes.data || !partidoRes.data) {
    throw new ErrorAPI(404, "No s'ha trobat el partit d'aquesta edició.");
  }

  return usuario;
}

// ============================================================
// CONSULTAR ACTA
// ============================================================

async function obtenirActa(
  torneoID: string,
  edicionID: string,
  partidoID: string,
): Promise<ActaDB> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .eq("torneo_id", torneoID)
    .eq("edicion_id", edicionID)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new ErrorAPI(404, "L'acta encara no existeix.");
  }

  return data as ActaDB;
}

function estatPublic(acta: ActaDB) {
  return {
    existeix: true,
    bloqueada: acta.estado_operativo === "BLOQUEADA",
    estat: acta.estado,
    estatOperatiu: acta.estado_operativo,
    motiu: acta.motivo_bloqueo,
    bloquejadaAt: acta.bloqueada_at,
    versio: acta.version,
  };
}

// ============================================================
// REALTIME DESDE TYPESCRIPT
// ============================================================

async function notificarCanal(nombreCanal: string): Promise<boolean> {
  const canal = supabaseAdmin.channel(nombreCanal);

  try {
    // Supabase JS >= 2.76:
    // HTTP Broadcast sin abrir una conexión WebSocket.
    await canal.httpSend("actualitzada", {});

    return true;
  } catch (error) {
    console.error(
      `No s'ha pogut enviar l'avís Realtime (${nombreCanal}):`,
      error,
    );

    return false;
  } finally {
    await supabaseAdmin.removeChannel(canal);
  }
}

async function notificarCambio(partidoID: string, edicionID: string) {
  const resultados = await Promise.all([
    notificarCanal(`acta-estat-partit-${partidoID}`),

    notificarCanal(`actes-actives-edicio-${edicionID}`),
  ]);

  return resultados.every(Boolean);
}

// ============================================================
// GET — ESTADO PARA EL GESTOR
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const torneoID = validarID(url.searchParams.get("torneoID"), "torneig");

    const edicionID = validarID(url.searchParams.get("edicionID"), "edició");

    const partidoID = validarID(url.searchParams.get("partidoID"), "partit");

    const usuario = await exigirGestor(
      cookies,
      torneoID,
      edicionID,
      partidoID,
      "ver",
    );

    const { data, error } = await supabaseAdmin
      .from("acta_partidos")
      .select(SELECT_ACTA)
      .eq("partido_id", partidoID)
      .eq("torneo_id", torneoID)
      .eq("edicion_id", edicionID)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return resposta({
        success: true,
        existeix: false,
        bloqueada: false,
        estat: null,
        estatOperatiu: null,
        motiu: null,
        bloquejadaAt: null,
        versio: null,
        potBloquejar: false,
        potDesbloquejar: false,
      });
    }

    const acta = data as ActaDB;

    return resposta({
      success: true,
      ...estatPublic(acta),

      potBloquejar: tienePermiso(usuario, "acta-digital", "bloquear", torneoID),

      potDesbloquejar: tienePermiso(
        usuario,
        "acta-digital",
        "desbloquear",
        torneoID,
      ),
    });
  } catch (error) {
    return gestionarError(error);
  }
};

// ============================================================
// POST — BLOQUEAR Y DESBLOQUEAR
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ErrorAPI(400, "La petició no és vàlida.");
    }

    const entrada = body as Record<string, unknown>;

    const torneoID = validarID(entrada.torneoID, "torneig");

    const edicionID = validarID(entrada.edicionID, "edició");

    const partidoID = validarID(entrada.partidoID, "partit");

    const accion = entrada.accion;

    if (accion !== "bloquear" && accion !== "desbloquear") {
      throw new ErrorAPI(400, "L'acció no és vàlida.");
    }

    const usuario = await exigirGestor(
      cookies,
      torneoID,
      edicionID,
      partidoID,
      accion,
    );

    const acta = await obtenirActa(torneoID, edicionID, partidoID);

    // ========================================================
    // NO MODIFICAR ACTAS FINALIZADAS
    // ========================================================

    if (
      acta.estado === "FINALIZADA" ||
      acta.estado_operativo === "FINALIZADA" ||
      acta.finalizada_at
    ) {
      throw new ErrorAPI(
        409,
        "No es pot modificar el bloqueig d'una acta finalitzada.",
      );
    }

    let cambios: Record<string, unknown>;

    // ========================================================
    // BLOQUEAR
    // ========================================================

    if (accion === "bloquear") {
      if (
        !["DISPONIBLE", "CONTROLADA", "EN_SUPERVISION"].includes(
          acta.estado_operativo,
        )
      ) {
        throw new ErrorAPI(409, "L'estat actual no permet bloquejar l'acta.");
      }

      const motivo =
        typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";

      if (motivo.length === 0 || motivo.length > 500) {
        throw new ErrorAPI(
          400,
          "El motiu ha de tenir entre 1 i 500 caràcters.",
        );
      }

      cambios = {
        estado_operativo: "BLOQUEADA",

        bloqueada_por: usuario.id,
        bloqueada_at: new Date().toISOString(),
        motivo_bloqueo: motivo,

        // Invalidar cualquier token anterior.
        control_token: null,

        // Evitar reutilizar una generación antigua.
        control_generacion: acta.control_generacion + 1,
      };
    } else {
      // ======================================================
      // DESBLOQUEAR
      // ======================================================

      if (acta.estado_operativo !== "BLOQUEADA") {
        throw new ErrorAPI(409, "L'acta no està bloquejada.");
      }

      /*
       * Sin crear columnas adicionales:
       *
       * - Si había controlador y el acta sigue en
       *   curso, recupera el estado CONTROLADA.
       *
       * - En otro caso, queda DISPONIBLE.
       *
       * El token invalidado NO se recupera.
       * Habrá que solicitar uno nuevo antes de escribir.
       */

      const recuperarControl =
        acta.estado === "EN_CURSO" && Boolean(acta.controlador_id);

      cambios = {
        estado_operativo: recuperarControl ? "CONTROLADA" : "DISPONIBLE",

        bloqueada_por: null,
        bloqueada_at: null,
        motivo_bloqueo: null,

        control_token: null,
      };
    }

    // ========================================================
    // ACTUALIZACIÓN CON CONTROL DE VERSIÓN
    // ========================================================

    const { data, error } = await supabaseAdmin
      .from("acta_partidos")
      .update({
        ...cambios,

        version: acta.version + 1,

        updated_at: new Date().toISOString(),
      })
      .eq("id", acta.id)
      .eq("version", acta.version)
      .eq("estado_operativo", acta.estado_operativo)
      .eq("estado", acta.estado)
      .select(SELECT_ACTA)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new ErrorAPI(
        409,
        "L'acta ha canviat. Actualitza la informació i torna-ho a provar.",
      );
    }

    // ========================================================
    // AVISAR A LOS CLIENTES
    // ========================================================

    const notificado = await notificarCambio(partidoID, edicionID);

    return resposta({
      success: true,
      ...estatPublic(data as ActaDB),
      realtimeNotificat: notificado,
    });
  } catch (error) {
    return gestionarError(error);
  }
};
