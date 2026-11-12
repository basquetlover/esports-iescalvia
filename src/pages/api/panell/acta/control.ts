import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

import {
  obtenerAccesoActa,
  puedeExpulsarControladorActa,
} from "@utils/acta/acceso";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;

  estado: string;
  estado_operativo: string;

  controlador_id: string | null;
  control_token: string | null;
  control_generacion: number;

  bloqueada_at: string | null;
  finalizada_at: string | null;

  version: number;
};

type Entrada = {
  accion?: unknown;
  torneoID?: unknown;
  edicionID?: unknown;
  partidoID?: unknown;
};

// ============================================================
// CONSTANTES
// ============================================================

const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,estado,estado_operativo,controlador_id,control_token,control_generacion,bloqueada_at,finalizada_at,version" as const;

const ESTADOS_CONTROL = ["DISPONIBLE", "CONTROLADA", "EN_SUPERVISION"];

// ============================================================
// RESPUESTAS
// ============================================================

function respuesta(datos: Record<string, unknown>, estado = 200): Response {
  const res = responder(datos, estado);

  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  return res;
}

function gestionarError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return respuesta(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error gestionant el control de l'acta:", error);

  return respuesta(
    {
      success: false,
      mensaje: "No s'ha pogut gestionar el control de l'acta.",
    },
    500,
  );
}

// ============================================================
// VALIDACIONES
// ============================================================

function validarID(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function leerEntrada(valor: unknown): Entrada {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
    throw new ErrorAPI(400, "Les dades de la petició no són vàlides.");
  }

  return valor as Entrada;
}

// ============================================================
// REALTIME
// ============================================================

async function notificarCambio(
  partidoID: string,
  edicionID: string,
): Promise<void> {
  const canales = [
    `acta-estat-partit-${partidoID}`,
    `acta-jugades-partit-${partidoID}`,
    `actes-actives-edicio-${edicionID}`,
  ];

  await Promise.all(
    canales.map(async (nombre) => {
      const canal = supabaseAdmin.channel(nombre);

      try {
        await canal.httpSend("actualitzada", {});
      } catch (error) {
        console.error(`Error notificant el control (${nombre}):`, error);
      } finally {
        try {
          await supabaseAdmin.removeChannel(canal);
        } catch (error) {
          console.error(`Error tancant el canal (${nombre}):`, error);
        }
      }
    }),
  );
}

// ============================================================
// POST — TOMAR EL CONTROL
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = leerEntrada(await request.json().catch(() => null));

    if (entrada.accion !== "tomar") {
      throw new ErrorAPI(400, "L'acció de control no és vàlida.");
    }

    const torneoID = validarID(entrada.torneoID, "torneig");

    const edicionID = validarID(entrada.edicionID, "edició");

    const partidoID = validarID(entrada.partidoID, "partit");

    // ========================================================
    // PERMISOS ADMINISTRATIVOS
    // ========================================================

    const puedeGestionar =
      usuario.activa === true &&
      tieneAccesoTorneo(usuario, torneoID) &&
      tienePermiso(usuario, "panell", "ver", torneoID) &&
      tienePermiso(usuario, "partits", "ver", torneoID) &&
      tienePermiso(usuario, "partits", "editar", torneoID) &&
      tienePermiso(usuario, "acta-digital", "ver", torneoID) &&
      tienePermiso(usuario, "acta-digital", "editar", torneoID) &&
      tienePermiso(usuario, "acta-digital", "controlar", torneoID);

    if (!puedeGestionar) {
      throw new ErrorAPI(
        403,
        "No tens permisos per assumir el control d'aquesta acta.",
      );
    }

    // ========================================================
    // COMPROBAR EDICIÓN Y PARTIDO
    // ========================================================

    const [edicionRes, partidoRes] = await Promise.all([
      supabaseAdmin
        .from("ediciones")
        .select("id,torneo_id")
        .eq("id", edicionID)
        .eq("torneo_id", torneoID)
        .maybeSingle(),

      supabaseAdmin
        .from("competicion_partidos")
        .select("id,edicion_id,estado,finalizado_at")
        .eq("id", partidoID)
        .eq("edicion_id", edicionID)
        .maybeSingle(),
    ]);

    if (edicionRes.error) {
      throw edicionRes.error;
    }

    if (partidoRes.error) {
      throw partidoRes.error;
    }

    if (!edicionRes.data || !partidoRes.data) {
      throw new ErrorAPI(404, "No s'ha trobat el partit d'aquesta edició.");
    }

    if (
      partidoRes.data.estado === "FINALIZADO" ||
      partidoRes.data.estado === "CANCELADO" ||
      partidoRes.data.finalizado_at
    ) {
      throw new ErrorAPI(409, "Aquest partit no admet canvis de control.");
    }

    // ========================================================
    // CONSULTAR ACTA
    // ========================================================

    const { data: actaData, error: actaError } = await supabaseAdmin
      .from("acta_partidos")
      .select(SELECT_ACTA)
      .eq("partido_id", partidoID)
      .eq("torneo_id", torneoID)
      .eq("edicion_id", edicionID)
      .maybeSingle();

    if (actaError) {
      throw actaError;
    }

    const acta = actaData as ActaDB | null;

    if (!acta) {
      throw new ErrorAPI(404, "L'acta encara no està iniciada.");
    }

    // ========================================================
    // VALIDAR ESTADO
    // ========================================================

    if (acta.estado !== "EN_CURSO" || acta.finalizada_at !== null) {
      throw new ErrorAPI(
        409,
        "L'acta no està disponible per assumir el control.",
      );
    }

    if (acta.estado_operativo === "BLOQUEADA" || acta.bloqueada_at !== null) {
      throw new ErrorAPI(423, "Primer has de desbloquejar l'acta.");
    }

    if (!ESTADOS_CONTROL.includes(acta.estado_operativo)) {
      throw new ErrorAPI(423, "L'estat actual no permet assumir el control.");
    }

    // ========================================================
    // COMPROBAR ACCESO Y BLOQUEOS PERSONALES
    // ========================================================

    const acceso = await obtenerAccesoActa({
      usuario,
      torneoID,
      edicionID,
      partidoID,
    });

    if (
      !acceso.puedeConsultar ||
      acceso.bloqueadoAcceso ||
      acceso.bloqueadoControl ||
      acceso.actaFinalizada ||
      acceso.revisionActiva ||
      !acceso.puedeControlar
    ) {
      throw new ErrorAPI(
        403,
        "No tens autorització per controlar aquesta acta.",
      );
    }

    const anteriorControladorID = acta.controlador_id;

    const esControlador = anteriorControladorID === usuario.id;

    const hayOtroControlador = Boolean(anteriorControladorID && !esControlador);

    // ========================================================
    // TRANSFERENCIA DE OTRO CONTROLADOR
    // ========================================================

    if (hayOtroControlador && anteriorControladorID) {
      if (
        !tienePermiso(usuario, "acta-digital", "transferir-control", torneoID)
      ) {
        throw new ErrorAPI(
          403,
          "No tens permís per transferir el control d'una altra persona.",
        );
      }

      // La transferencia que desplaza al
      // controlador anterior también requiere
      // permiso de expulsión y rango superior.

      const puedeDesplazar = await puedeExpulsarControladorActa(
        {
          usuario,
          torneoID,
          edicionID,
          partidoID,
        },
        anteriorControladorID,
      );

      if (!puedeDesplazar) {
        throw new ErrorAPI(
          403,
          "No pots substituir un controlador amb un nivell jeràrquic igual o superior.",
        );
      }
    }

    // ========================================================
    // CONTROL PROPIO YA VIGENTE
    // ========================================================

    if (
      esControlador &&
      acta.control_token &&
      acta.estado_operativo !== "DISPONIBLE"
    ) {
      // No rotar innecesariamente el token:
      // puede haber jugadas locales pendientes.

      const { data: vigente, error: vigenteError } = await supabaseAdmin
        .from("acta_partidos")
        .select(SELECT_ACTA)
        .eq("id", acta.id)
        .eq("version", acta.version)
        .eq("control_generacion", acta.control_generacion)
        .eq("controlador_id", usuario.id)
        .eq("control_token", acta.control_token)
        .is("bloqueada_at", null)
        .maybeSingle();

      if (vigenteError) {
        throw vigenteError;
      }

      if (!vigente) {
        throw new ErrorAPI(
          409,
          "El control de l'acta ha canviat. Actualitza el llistat.",
        );
      }

      return respuesta({
        success: true,
        accion: "tomar",
        reutilizado: true,
        transferido: false,

        acta: vigente,

        control: {
          esControlador: true,
          puedeEscribir: true,
          controlToken: vigente.control_token,
          controlGeneracion: vigente.control_generacion,
        },
      });
    }

    // ========================================================
    // ASUMIR O TRANSFERIR CON CAS
    // ========================================================

    const nuevoToken = randomUUID().toLowerCase();

    const nuevaGeneracion = acta.control_generacion + 1;

    const ahora = new Date().toISOString();

    const estadoOperativo =
      acta.estado_operativo === "EN_SUPERVISION"
        ? "EN_SUPERVISION"
        : "CONTROLADA";

    let consulta = supabaseAdmin
      .from("acta_partidos")
      .update({
        controlador_id: usuario.id,
        control_token: nuevoToken,

        control_generacion: nuevaGeneracion,

        estado_operativo: estadoOperativo,

        version: acta.version + 1,

        updated_at: ahora,
      })
      .eq("id", acta.id)
      .eq("partido_id", partidoID)
      .eq("torneo_id", torneoID)
      .eq("edicion_id", edicionID)
      .eq("estado", "EN_CURSO")
      .eq("estado_operativo", acta.estado_operativo)
      .eq("version", acta.version)
      .eq("control_generacion", acta.control_generacion)
      .is("bloqueada_at", null)
      .is("finalizada_at", null);

    // Confirmar que nadie ha cambiado
    // el controlador mientras se procesaba.

    if (anteriorControladorID) {
      consulta = consulta.eq("controlador_id", anteriorControladorID);
    } else {
      consulta = consulta.is("controlador_id", null);
    }

    if (acta.control_token) {
      consulta = consulta.eq("control_token", acta.control_token);
    } else {
      consulta = consulta.is("control_token", null);
    }

    const { data: actualizada, error: updateError } = await consulta
      .select(SELECT_ACTA)
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!actualizada) {
      throw new ErrorAPI(
        409,
        "El control de l'acta ha canviat. Actualitza el llistat i torna-ho a provar.",
      );
    }

    // ========================================================
    // NOTIFICAR CAMBIO DE CONTROL
    // ========================================================

    await notificarCambio(partidoID, edicionID);

    return respuesta({
      success: true,
      accion: "tomar",

      reutilizado: false,
      transferido: hayOtroControlador,

      anteriorControladorID,

      acta: actualizada,

      control: {
        esControlador: true,
        puedeEscribir: true,
        controlToken: nuevoToken,
        controlGeneracion: nuevaGeneracion,
      },
    });
  } catch (error) {
    return gestionarError(error);
  }
};
