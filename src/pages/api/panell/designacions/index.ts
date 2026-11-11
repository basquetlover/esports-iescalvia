import type { APIRoute, AstroCookies } from "astro";

import { tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";

import {
  asignarDesignacion,
  listarDesignacionesPartido,
  type ContextoDesignaciones,
} from "@utils/acta/designaciones";

import {
  esVoluntarioHabilitadoActa,
  obtenerNivelJerarquicoActa,
} from "@utils/acta/acceso";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type UsuarioCandidato = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  activa: boolean | null;
  rol: string | null;
  permisos: unknown;
};

type ParametrosDesignaciones = {
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const CAMPOS_USUARIO =
  "id,nombre,apellido1,apellido2,email,activa,rol,permisos" as const;

const MAX_EMAIL = 254;

// ============================================================
// ERRORES
// ============================================================

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

  console.error("Error gestionant les designacions:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut completar l'operació de designacions.",
    },
    500,
  );
}

// ============================================================
// VALIDACIONES
// ============================================================

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function obtenerParametros(url: URL): ParametrosDesignaciones {
  return {
    torneoID: identificador(url.searchParams.get("torneoID"), "torneig"),

    edicionID: identificador(url.searchParams.get("edicionID"), "edició"),

    partidoID: identificador(url.searchParams.get("partidoID"), "partit"),
  };
}

function leerBooleano(valor: string | null, nombre: string): boolean {
  if (valor === null || valor === "false" || valor === "0") {
    return false;
  }

  if (valor === "true" || valor === "1") {
    return true;
  }

  throw new ErrorAPI(400, `El paràmetre ${nombre} no és vàlid.`);
}

function validarEmail(valor: unknown): string {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, "Has d'indicar un correu electrònic.");
  }

  const email = valor.trim().toLowerCase();

  if (
    !email ||
    email.length > MAX_EMAIL ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new ErrorAPI(400, "El correu electrònic no és vàlid.");
  }

  return email;
}

// ============================================================
// CONTEXTO AUTENTICADO
// ============================================================

async function obtenerContexto(
  cookies: AstroCookies,
  url: URL,
): Promise<ContextoDesignaciones> {
  const gestor = await exigirUsuario(cookies);

  const parametros = obtenerParametros(url);

  return {
    gestor,
    ...parametros,
  };
}

function exigirPermiso(
  contexto: ContextoDesignaciones,
  accion: "ver" | "asignar" | "revocar",
): void {
  if (
    !tienePermiso(contexto.gestor, "panell", "ver", contexto.torneoID) ||
    !tienePermiso(contexto.gestor, "designacions", "ver", contexto.torneoID) ||
    !tienePermiso(contexto.gestor, "designacions", accion, contexto.torneoID)
  ) {
    throw new ErrorAPI(403, "No tens permís per realitzar aquesta operació.");
  }
}

// ============================================================
// BUSCAR CANDIDATO
// ============================================================

/**
 * Permite buscar una persona por su correo.
 *
 * Solamente se devuelve como candidato cuando:
 *
 * - Su cuenta está activa.
 * - Es voluntario confirmado de la edición.
 * - O es administrador autorizado del torneo.
 *
 * La asignación definitiva volverá a validar
 * estos requisitos mediante asignarDesignacion().
 */
async function buscarCandidato(
  contexto: ContextoDesignaciones,
  emailEntrada: string,
) {
  exigirPermiso(contexto, "asignar");

  // Validar también la existencia del partido,
  // la edición y el acceso del gestor.
  await listarDesignacionesPartido(contexto, false);

  const email = validarEmail(emailEntrada);

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(CAMPOS_USUARIO)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const candidato = data as UsuarioCandidato | null;

  if (!candidato || candidato.activa !== true) {
    return null;
  }

  const administradorAutorizado =
    obtenerNivelJerarquicoActa(candidato, contexto.torneoID) >= 3 &&
    tienePermiso(candidato, "acta-digital", "ver", contexto.torneoID);

  const voluntarioConfirmado = administradorAutorizado
    ? false
    : await esVoluntarioHabilitadoActa(
        candidato.id,
        contexto.torneoID,
        contexto.edicionID,
      );

  if (!administradorAutorizado && !voluntarioConfirmado) {
    return null;
  }

  return {
    id: candidato.id,
    nombre: candidato.nombre,
    apellido1: candidato.apellido1,
    apellido2: candidato.apellido2,
    email: candidato.email,

    tipoAcceso: administradorAutorizado ? "ADMINISTRADOR" : "VOLUNTARI",
  };
}

// ============================================================
// GET — CONSULTAR DESIGNACIONES
// ============================================================

/**
 * GET /api/panell/designacions
 *
 * Parámetros obligatorios:
 * - torneoID
 * - edicionID
 * - partidoID
 *
 * Parámetro opcional:
 * - incluirRevocadas=true
 *
 * Para buscar candidatos:
 * - buscarEmail=correo@ejemplo.com
 */
export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const contexto = await obtenerContexto(cookies, url);

    exigirPermiso(contexto, "ver");

    const buscarEmail = url.searchParams.get("buscarEmail");

    // ========================================================
    // BÚSQUEDA DE USUARIOS
    // ========================================================

    if (buscarEmail !== null) {
      const candidato = await buscarCandidato(contexto, buscarEmail);

      return responder({
        success: true,
        candidato,
        encontrado: Boolean(candidato),
      });
    }

    // ========================================================
    // LISTADO DEL PARTIDO
    // ========================================================

    const incluirRevocadas = leerBooleano(
      url.searchParams.get("incluirRevocadas"),
      "incluirRevocadas",
    );

    const designaciones = await listarDesignacionesPartido(
      contexto,
      incluirRevocadas,
    );

    const puedeAsignar = tienePermiso(
      contexto.gestor,
      "designacions",
      "asignar",
      contexto.torneoID,
    );

    const puedeRevocar = tienePermiso(
      contexto.gestor,
      "designacions",
      "revocar",
      contexto.torneoID,
    );

    return responder({
      success: true,

      torneoID: contexto.torneoID,
      edicionID: contexto.edicionID,
      partidoID: contexto.partidoID,

      designaciones,

      total: designaciones.length,

      permisos: {
        ver: true,
        asignar: puedeAsignar,
        revocar: puedeRevocar,

        // Se activará al implementar
        // la revocación transaccional.
        revocacionDisponible: false,
      },
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// POST — ASIGNAR ARBITRO U OFICIAL DE MESA
// ============================================================

/**
 * POST /api/panell/designacions
 *
 * Parámetros URL:
 * - torneoID
 * - edicionID
 * - partidoID
 *
 * JSON:
 * {
 *   usuarioID: string,
 *   funcion: "ARBITRE" | "OFICIAL_TAULA"
 * }
 *
 * Una persona puede tener las dos funciones.
 * No se aplican restricciones de horario.
 */
export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const contexto = await obtenerContexto(cookies, url);

    exigirPermiso(contexto, "asignar");

    const contenido = await leerJSON(request);

    const usuarioID = identificador(contenido.usuarioID, "usuari");

    if (
      contenido.funcion !== "ARBITRE" &&
      contenido.funcion !== "OFICIAL_TAULA"
    ) {
      throw new ErrorAPI(
        400,
        "La funció ha de ser Àrbitre o Oficial de taula.",
      );
    }

    const resultado = await asignarDesignacion(
      contexto,
      usuarioID,
      contenido.funcion,
    );

    return responder(
      {
        success: true,

        designacion: resultado.designacion,

        reutilizada: resultado.reutilizada,

        mensaje: resultado.reutilizada
          ? "Aquesta designació ja existia."
          : "Designació creada correctament.",
      },
      resultado.reutilizada ? 200 : 201,
    );
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// DELETE — REVOCACIÓN PENDIENTE DE TRANSACCIÓN
// ============================================================

/**
 * Se mantiene deshabilitada la operación de
 * revocación hasta asegurar que:
 *
 * - La comprobación del controlador.
 * - La revocación de la designación.
 * - La invalidación del control, si corresponde.
 * - El registro de auditoría.
 *
 * se resuelvan con las garantías necesarias
 * frente a solicitudes simultáneas.
 *
 * No se debe recurrir a una secuencia de
 * llamadas HTTP independientes para ello.
 */
export const DELETE: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const contexto = await obtenerContexto(cookies, url);

    exigirPermiso(contexto, "revocar");

    return responder(
      {
        success: false,

        mensaje:
          "La revocació de designacions encara no està disponible. " +
          "S'ha d'habilitar després de protegir el control " +
          "de l'acta davant operacions simultànies.",
      },
      501,
    );
  } catch (error) {
    return responderError(error);
  }
};
