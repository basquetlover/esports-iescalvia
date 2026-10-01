import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

import { crearSesion } from "@pages/api/sesiones/sesiones";

import { enviarEmailApi } from "@utils/envioEmails";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TIPO_VERIFICACION = "RECUPERACION_EMAIL";

const MAX_PASSWORD = 500;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type VerificacionDB = {
  id: string;

  id_usuario: string;

  token: string;

  fecha_expiracion: string;

  usado: boolean | null;

  tipo: string | null;
};

type UsuarioDB = {
  id: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  email: string | null;

  activa: boolean | null;
};

// ============================================================
// RESPUESTAS
// ============================================================

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, {
    status: estado,

    headers: {
      "Cache-Control": "private, no-store",

      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// ============================================================
// REGISTRO
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

// ============================================================
// TOKEN
// ============================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TOKEN_NUEVO = /^[0-9a-f]{64}$/i;

// ============================================================
// HUELLA DEL TOKEN
// ============================================================
//
// Tiene que ser exactamente el mismo proceso utilizado
// en enviar-email.ts.
//
// El navegador recibe:
//
// token real de 64 caracteres
//
// La BD guarda:
//
// SHA-256(token) transformado a UUID
// ============================================================

async function obtenerHuellaToken(token: string) {
  const datos = new TextEncoder().encode(token);

  const buffer = await crypto.subtle.digest("SHA-256", datos);

  const hash = Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const caracteres = hash.slice(0, 32).split("");

  // UUID v4

  caracteres[12] = "4";

  // Variante RFC

  caracteres[16] = ((parseInt(caracteres[16], 16) & 0x3) | 0x8).toString(16);

  const uuid = caracteres.join("");

  return [
    uuid.slice(0, 8),

    uuid.slice(8, 12),

    uuid.slice(12, 16),

    uuid.slice(16, 20),

    uuid.slice(20, 32),
  ].join("-");
}

// ============================================================
// TOKEN PARA CONSULTA
// ============================================================
//
// También aceptamos temporalmente el antiguo formato UUID.
//
// De esta manera, si justo antes de actualizar el sistema
// alguien había recibido uno de los emails antiguos,
// el enlace todavía podrá funcionar mientras no haya caducado.
//
// NUEVOS TOKENS:
// 64 hex -> se calcula huella
//
// ANTIGUOS TOKENS:
// UUID -> se consulta directamente
// ============================================================

async function obtenerTokenConsulta(token: string) {
  if (TOKEN_NUEVO.test(token)) {
    return obtenerHuellaToken(token);
  }

  if (UUID.test(token)) {
    return token.toLowerCase();
  }

  return null;
}

// ============================================================
// HASH CONTRASEÑA
// ============================================================
//
// Mantiene exactamente el formato que utiliza actualmente
// el registro y el inicio de sesión.
//
// SHA-256 hexadecimal, 64 caracteres.
// ============================================================

async function hashPassword(password: string) {
  const encoder = new TextEncoder();

  const datos = encoder.encode(password);

  const hashBuffer = await crypto.subtle.digest("SHA-256", datos);

  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// OBTENER VERIFICACIÓN
// ============================================================

async function obtenerVerificacion(tokenConsulta: string) {
  const { data, error } = await supabaseAdmin
    .from("verificaciones")
    .select("id,id_usuario,token,fecha_expiracion,usado,tipo")
    .eq("token", tokenConsulta)
    .eq("tipo", TIPO_VERIFICACION)
    .eq("usado", false)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as VerificacionDB | null;
}

// ============================================================
// VERIFICACIÓN VÁLIDA
// ============================================================

function verificacionCaducada(verificacion: VerificacionDB) {
  const expiracion = new Date(verificacion.fecha_expiracion).getTime();

  return !Number.isFinite(expiracion) || expiracion <= Date.now();
}

// ============================================================
// USUARIO
// ============================================================

async function obtenerUsuario(usuarioID: string) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,nombre,apellido1,apellido2,email,activa")
    .eq("id", usuarioID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as UsuarioDB | null;
}

// ============================================================
// CONSUMIR TOKEN
// ============================================================
//
// Esta operación es crítica.
//
// Hacemos:
//
// usado = true
//
// pero solamente si:
//
// usado sigue siendo false
// y todavía no ha caducado.
//
// Si llegan dos peticiones simultáneas:
//
// una podrá modificar la fila
// la segunda ya no encontrará usado=false.
//
// Por tanto:
//
// 1 enlace -> 1 cambio de contraseña
// ============================================================

async function consumirToken(verificacion: VerificacionDB) {
  const ahora = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("verificaciones")
    .update({
      usado: true,
    })
    .eq("id", verificacion.id)
    .eq("tipo", TIPO_VERIFICACION)
    .eq("usado", false)
    .gt("fecha_expiracion", ahora)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

// ============================================================
// INVALIDAR OTROS TOKENS
// ============================================================

async function invalidarOtrosTokens(usuarioID: string) {
  const { error } = await supabaseAdmin
    .from("verificaciones")
    .update({
      usado: true,
    })
    .eq("id_usuario", usuarioID)
    .eq("tipo", TIPO_VERIFICACION)
    .eq("usado", false);

  if (error) {
    throw error;
  }
}

// ============================================================
// REVOCAR TODAS LAS SESIONES
// ============================================================
//
// Cambio de contraseña:
//
// PC
// móvil
// tablet
// otro navegador
//
// todas pasan de:
//
// ACTIVA -> REVOCADA
//
// Después crearemos únicamente una sesión nueva para
// el navegador que acaba de cambiar la contraseña.
// ============================================================

async function revocarSesiones(usuarioID: string) {
  const ahora = new Date().toISOString();

  const { error } = await supabaseAdmin
    .from("sesiones")
    .update({
      estado: "REVOCADA",

      fecha_actualizacion: ahora,
    })
    .eq("id_usuario", usuarioID)
    .eq("estado", "ACTIVA");

  if (error) {
    throw error;
  }
}

// ============================================================
// ESCAPAR HTML
// ============================================================

function escaparHTML(valor: string) {
  return valor
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ============================================================
// EMAIL CONFIRMACIÓN
// ============================================================

function htmlCambioRealizado(nombre: string) {
  const nombreSeguro = escaparHTML(nombre);

  return `
<!doctype html>
<html lang="ca">
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>
        Contrasenya modificada
    </title>
</head>

<body
    style="
        margin:0;
        padding:0;
        background:#efefef;
        font-family:Arial,Helvetica,sans-serif;
        color:#121318;
    "
>
    <table
        role="presentation"
        width="100%"
        cellspacing="0"
        cellpadding="0"
        style="
            width:100%;
            background:#efefef;
            border-collapse:collapse;
        "
    >
        <tr>
            <td
                align="center"
                style="
                    padding:32px 16px;
                "
            >
                <table
                    role="presentation"
                    width="600"
                    cellspacing="0"
                    cellpadding="0"
                    style="
                        width:100%;
                        max-width:600px;
                        background:#ffffff;
                        border-radius:18px;
                        overflow:hidden;
                        border-collapse:collapse;
                    "
                >
                    <tr>
                        <td
                            style="
                                padding:32px 28px;
                                background:#121318;
                                text-align:center;
                            "
                        >
                            <h1
                                style="
                                    margin:0;
                                    color:#ffffff;
                                    font-size:28px;
                                    line-height:1.2;
                                "
                            >
                                Contrasenya modificada
                            </h1>

                            <div
                                style="
                                    width:64px;
                                    height:4px;
                                    margin:16px auto 0;
                                    border-radius:999px;
                                    background:#b2c5ff;
                                "
                            >
                            </div>
                        </td>
                    </tr>

                    <tr>
                        <td
                            style="
                                padding:32px 28px;
                            "
                        >
                            <p
                                style="
                                    margin:0 0 18px;
                                    font-size:16px;
                                    line-height:1.6;
                                "
                            >
                                Hola ${nombreSeguro},
                            </p>

                            <p
                                style="
                                    margin:0;
                                    font-size:16px;
                                    line-height:1.6;
                                "
                            >
                                La contrasenya del teu compte
                                d'Esports IES Calvià s'ha
                                modificat correctament.
                            </p>

                            <div
                                style="
                                    margin-top:24px;
                                    padding:16px;
                                    border-radius:12px;
                                    background:#fff1f1;
                                    border:1px solid #ffd4d4;
                                "
                            >
                                <p
                                    style="
                                        margin:0;
                                        color:#a51d1d;
                                        font-size:14px;
                                        line-height:1.6;
                                    "
                                >
                                    <strong>
                                        No has fet aquest canvi?
                                    </strong>

                                    <br>

                                    Contacta immediatament amb
                                    l'administració del torneig.
                                </p>
                            </div>

                            <p
                                style="
                                    margin:24px 0 0;
                                    color:#666666;
                                    font-size:13px;
                                    line-height:1.6;
                                "
                            >
                                Per seguretat, totes les sessions
                                que estaven obertes abans del canvi
                                han estat tancades.
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <td
                            style="
                                padding:20px 28px;
                                background:#121318;
                                text-align:center;
                            "
                        >
                            <p
                                style="
                                    margin:0;
                                    color:#a8a8aa;
                                    font-size:12px;
                                "
                            >
                                Esports IES Calvià
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;
}

// ============================================================
// VALIDAR TOKEN — GET
// ============================================================
//
// Esto lo utilizará el componente React del paso 3/3.
//
// Permite saber si el enlace:
//
// - existe
// - no se ha utilizado
// - no ha caducado
//
// antes de enseñar el formulario.
// ============================================================

export const GET: APIRoute = async ({ url }) => {
  try {
    const token = url.searchParams.get("token")?.trim() ?? "";

    if (!token) {
      return responder(
        {
          success: false,

          valido: false,

          mensaje: "L'enllaç de recuperació no és vàlid.",
        },
        400,
      );
    }

    const tokenConsulta = await obtenerTokenConsulta(token);

    if (!tokenConsulta) {
      return responder(
        {
          success: false,

          valido: false,

          mensaje: "L'enllaç de recuperació no és vàlid.",
        },
        400,
      );
    }

    const verificacion = await obtenerVerificacion(tokenConsulta);

    if (!verificacion) {
      return responder(
        {
          success: false,

          valido: false,

          mensaje: "Aquest enllaç ja no és vàlid o ja s'ha utilitzat.",
        },
        410,
      );
    }

    if (verificacionCaducada(verificacion)) {
      return responder(
        {
          success: false,

          valido: false,

          mensaje: "Aquest enllaç de recuperació ha caducat.",
        },
        410,
      );
    }

    const usuario = await obtenerUsuario(verificacion.id_usuario);

    if (!usuario || usuario.activa !== true) {
      return responder(
        {
          success: false,

          valido: false,

          mensaje: "Aquest enllaç ja no és vàlid.",
        },
        410,
      );
    }

    return responder({
      success: true,

      valido: true,
    });
  } catch (error) {
    console.error("[RECUPERACIÓN] Error validando token:", error);

    return responder(
      {
        success: false,

        valido: false,

        mensaje: "No s'ha pogut comprovar l'enllaç de recuperació.",
      },
      500,
    );
  }
};

// ============================================================
// RESTABLECER CONTRASEÑA — POST
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    // =================================================
    // ORIGEN
    // =================================================

    const origin = request.headers.get("origin");

    if (origin && origin !== url.origin) {
      return responder(
        {
          success: false,

          mensaje: "Origen de la petició no permès.",
        },
        403,
      );
    }

    // =================================================
    // CONTENT TYPE
    // =================================================

    const tipo = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (tipo !== "application/json") {
      return responder(
        {
          success: false,

          mensaje: "El format de la petició no és vàlid.",
        },
        415,
      );
    }

    // =================================================
    // BODY
    // =================================================

    let cuerpo: unknown;

    try {
      cuerpo = await request.json();
    } catch {
      return responder(
        {
          success: false,

          mensaje: "La petició no conté un JSON vàlid.",
        },
        400,
      );
    }

    if (!esRegistro(cuerpo)) {
      return responder(
        {
          success: false,

          mensaje: "La petició no és vàlida.",
        },
        400,
      );
    }

    // =================================================
    // CAMPOS
    // =================================================

    const contrasena =
      typeof cuerpo.contrasena === "string" ? cuerpo.contrasena : "";

    const contrasena2 =
      typeof cuerpo.contrasena2 === "string" ? cuerpo.contrasena2 : "";

    const token =
      typeof cuerpo.token_recuperar === "string"
        ? cuerpo.token_recuperar.trim()
        : "";

    // =================================================
    // VALIDAR CAMPOS
    // =================================================

    if (!contrasena || !contrasena2 || !token) {
      return responder(
        {
          success: false,

          mensaje: "Falten camps obligatoris.",
        },
        400,
      );
    }

    // =================================================
    // IGUALDAD
    // =================================================

    if (contrasena !== contrasena2) {
      return responder(
        {
          success: false,

          mensaje: "Les dues contrasenyes no coincideixen.",
        },
        400,
      );
    }

    // =================================================
    // LONGITUD
    // ============================================================
    //
    // De momento mantenemos compatibilidad con el
    // registro actual.
    //
    // Posteriormente podemos establecer una política
    // común de contraseñas para:
    //
    // - registro
    // - recuperación
    // - cambio desde perfil
    // =================================================

    if (contrasena.length > MAX_PASSWORD || contrasena2.length > MAX_PASSWORD) {
      return responder(
        {
          success: false,

          mensaje: "La contrasenya introduïda no és vàlida.",
        },
        400,
      );
    }

    // =================================================
    // TOKEN CONSULTA
    // =================================================

    const tokenConsulta = await obtenerTokenConsulta(token);

    if (!tokenConsulta) {
      return responder(
        {
          success: false,

          mensaje: "Aquest enllaç de recuperació no és vàlid.",
        },
        410,
      );
    }

    // =================================================
    // BUSCAR TOKEN
    // =================================================

    const verificacion = await obtenerVerificacion(tokenConsulta);

    if (!verificacion) {
      return responder(
        {
          success: false,

          mensaje: "Aquest enllaç ja no és vàlid o ja s'ha utilitzat.",
        },
        410,
      );
    }

    // =================================================
    // CADUCIDAD
    // =================================================

    if (verificacionCaducada(verificacion)) {
      return responder(
        {
          success: false,

          mensaje: "Aquest enllaç de recuperació ha caducat.",
        },
        410,
      );
    }

    // =================================================
    // USUARIO
    // =================================================

    const usuario = await obtenerUsuario(verificacion.id_usuario);

    if (!usuario || usuario.activa !== true) {
      return responder(
        {
          success: false,

          mensaje: "Aquest enllaç de recuperació ja no és vàlid.",
        },
        410,
      );
    }

    // =================================================
    // CONSUMIR TOKEN
    // =================================================
    //
    // Lo hacemos ANTES de modificar la contraseña.
    //
    // Si dos peticiones intentasen utilizar el mismo
    // enlace simultáneamente, solo una podrá continuar.
    // =================================================

    const consumido = await consumirToken(verificacion);

    if (!consumido) {
      return responder(
        {
          success: false,

          mensaje: "Aquest enllaç ja s'ha utilitzat o ha caducat.",
        },
        410,
      );
    }

    // =================================================
    // HASH NUEVA CONTRASEÑA
    // =================================================

    const contrasenaHash = await hashPassword(contrasena);

    const ahora = new Date().toISOString();

    // =================================================
    // CAMBIAR CONTRASEÑA
    // =================================================

    const {
      data: usuarioActualizado,

      error: errorActualizar,
    } = await supabaseAdmin
      .from("users")
      .update({
        contrasena: contrasenaHash,

        fecha_actualizacion: ahora,
      })
      .eq("id", usuario.id)
      .eq("activa", true)
      .select("id,nombre,apellido1,apellido2,email,activa")
      .maybeSingle();

    if (errorActualizar) {
      console.error(
        "[RECUPERACIÓN] Error cambiando contraseña:",
        errorActualizar,
      );

      /*
       * El token queda consumido.
       *
       * Esto es intencionado:
       * ante un error en una operación sensible
       * preferimos obligar a solicitar otro enlace.
       */

      return responder(
        {
          success: false,

          mensaje:
            "No s'ha pogut restablir la contrasenya. Sol·licita un nou enllaç.",
        },
        500,
      );
    }

    if (!usuarioActualizado) {
      return responder(
        {
          success: false,

          mensaje: "No s'ha pogut restablir la contrasenya.",
        },
        409,
      );
    }

    // =================================================
    // INVALIDAR CUALQUIER OTRO ENLACE
    // =================================================

    await invalidarOtrosTokens(usuario.id);

    // =================================================
    // REVOCAR TODAS LAS SESIONES ANTERIORES
    // =================================================

    await revocarSesiones(usuario.id);

    // =================================================
    // CREAR NUEVA SESIÓN
    // ============================================================
    //
    // Si falla iniciar la nueva sesión, la contraseña
    // YA está correctamente cambiada.
    //
    // Por eso NO decimos que el restablecimiento haya
    // fallado.
    // =================================================

    let sesionIniciada = false;

    try {
      await crearSesion(usuario.id, cookies);

      sesionIniciada = true;
    } catch (errorSesion) {
      console.error(
        "[RECUPERACIÓN] Contraseña cambiada, pero no se pudo crear la nueva sesión:",
        errorSesion,
      );
    }

    // =================================================
    // EMAIL DE SEGURIDAD
    // ============================================================
    //
    // Si este email falla NO revertimos la contraseña.
    // =================================================

    if (usuario.email) {
      try {
        const nombre =
          [usuario.nombre, usuario.apellido1]
            .filter(Boolean)
            .join(" ")
            .trim() || "usuari";

        await enviarEmailApi({
          to: usuario.email,

          subject: "La teva contrasenya s'ha modificat | Esports IES Calvià",

          html: htmlCambioRealizado(nombre),

          origen: "esports_iescalvia",
        });
      } catch (errorEmail) {
        console.error(
          "[RECUPERACIÓN] No se pudo enviar el aviso de cambio de contraseña:",
          errorEmail,
        );
      }
    }

    // =================================================
    // RESPUESTA
    // =================================================

    return responder({
      success: true,

      mensaje: "La contrasenya s'ha restablert correctament.",

      sesionIniciada,

      redirect: sesionIniciada ? "/" : "/iniciar-sessio",
    });
  } catch (error) {
    console.error(
      "[RECUPERACIÓN] Error inesperado restableciendo contraseña:",
      error,
    );

    return responder(
      {
        success: false,

        mensaje: "Error intern del servidor.",
      },
      500,
    );
  }
};
