import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

import { enviarEmailApi } from "@utils/envioEmails";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TIPO_VERIFICACION = "RECUPERACION_EMAIL";

const MINUTOS_VALIDEZ = 15;

const SEGUNDOS_BLOQUEO = MINUTOS_VALIDEZ * 60;

// ============================================================
// RESPUESTAS
// ============================================================

const MENSAJE_GENERICO =
  "Si existeix un compte associat a aquest correu electrònic, rebràs un missatge amb les instruccions per restablir la contrasenya.";

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, {
    status: estado,

    headers: {
      "Cache-Control": "no-store, private",

      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

// ============================================================
// NORMALIZAR EMAIL
// ============================================================

function normalizarEmail(valor: unknown) {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.trim().toLowerCase();
}

// ============================================================
// VALIDAR EMAIL
// ============================================================

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================
// TOKEN ALEATORIO
// ============================================================
//
// Este token es el que recibirá el usuario.
//
// NO se guarda directamente en Supabase.
// ============================================================

function generarTokenSeguro() {
  const bytes = new Uint8Array(32);

  crypto.getRandomValues(bytes);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// ============================================================
// TOKEN PARA BASE DE DATOS
// ============================================================
//
// Queremos guardar una huella del token, no el token real.
//
// Pero no sabemos si la columna verificaciones.token
// está definida actualmente como:
//
// - uuid
// - text
//
// Para mantener compatibilidad con ambos casos:
//
// 1. SHA-256(token)
// 2. utilizamos parte del hash
// 3. lo representamos como UUID
//
// De esta forma:
//
// ENLACE:
// 8fc94d... token real largo
//
// BASE DE DATOS:
// a50bd418-....
//
// No son el mismo valor.
// ============================================================

async function obtenerHuellaToken(token: string) {
  const datos = new TextEncoder().encode(token);

  const buffer = await crypto.subtle.digest("SHA-256", datos);

  const hash = Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // ========================================================
  // Convertimos parte del SHA-256 a UUID válido.
  // ========================================================

  const caracteres = hash.slice(0, 32).split("");

  // UUID versión 4.
  caracteres[12] = "4";

  // Variante RFC.
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
// URL BASE
// ============================================================

function obtenerURLBase(request: Request) {
  /*
   * Si en el futuro defines:
   *
   * PUBLIC_SITE_URL=https://...
   *
   * tendrá prioridad.
   *
   * Mientras tanto utilizamos automáticamente:
   *
   * localhost:4321 en desarrollo
   * dominio real en producción
   */

  const configurada = String(import.meta.env.PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");

  if (configurada) {
    return configurada;
  }

  return new URL(request.url).origin;
}

// ============================================================
// URL DE RECUPERACIÓN
// ============================================================

function obtenerURLRecuperacion(request: Request, token: string) {
  const base = obtenerURLBase(request);

  const url = new URL("/recupera-contrasena", base);

  url.searchParams.set("token", token);

  return url.toString();
}

// ============================================================
// EMAIL
// ============================================================

function htmlEmail(urlRecuperacion: string) {
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
        Recuperació de contrasenya
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
                    <!-- =====================================
                        CABECERA
                    ====================================== -->

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
                                Recuperació de contrasenya
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

                    <!-- =====================================
                        CONTENIDO
                    ====================================== -->

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
                                Hem rebut una sol·licitud
                                per restablir la contrasenya
                                del teu compte d'Esports
                                IES Calvià.
                            </p>

                            <p
                                style="
                                    margin:0 0 26px;
                                    font-size:16px;
                                    line-height:1.6;
                                "
                            >
                                Prem el botó següent per
                                establir una nova contrasenya.
                            </p>

                            <table
                                role="presentation"
                                width="100%"
                                cellspacing="0"
                                cellpadding="0"
                            >
                                <tr>
                                    <td
                                        align="center"
                                    >
                                        <a
                                            href="${urlRecuperacion}"
                                            style="
                                                display:inline-block;
                                                padding:14px 24px;
                                                border-radius:12px;
                                                background:#0140b9;
                                                color:#ffffff;
                                                font-size:16px;
                                                font-weight:700;
                                                text-decoration:none;
                                            "
                                        >
                                            Restablir la contrasenya
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <div
                                style="
                                    margin-top:28px;
                                    padding:16px;
                                    border-radius:12px;
                                    background:#f5f6f8;
                                "
                            >
                                <p
                                    style="
                                        margin:0;
                                        color:#555b66;
                                        font-size:14px;
                                        line-height:1.5;
                                    "
                                >
                                    Aquest enllaç és personal
                                    i caduca al cap de
                                    <strong>
                                        ${MINUTOS_VALIDEZ} minuts
                                    </strong>.
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
                                Si no has sol·licitat aquest
                                canvi, pots ignorar aquest
                                correu. La teva contrasenya
                                actual continuarà funcionant.
                            </p>
                        </td>
                    </tr>

                    <!-- =====================================
                        FOOTER
                    ====================================== -->

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
                                    line-height:1.5;
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
// MARCAR BLOQUEO
// ============================================================

function establecerBloqueo(
  request: Request,
  cookies: Parameters<APIRoute>[0]["cookies"],
) {
  const seguro = new URL(request.url).protocol === "https:";

  cookies.set("bloqueo_email", "bloqueo_email_habilitado", {
    path: "/",

    httpOnly: true,

    secure: seguro,

    sameSite: "strict",

    expires: new Date(Date.now() + SEGUNDOS_BLOQUEO * 1000),
  });
}

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    // =================================================
    // BLOQUEO BÁSICO DEL CLIENTE
    // =================================================

    const bloqueo = cookies.get("bloqueo_email")?.value;

    if (bloqueo === "bloqueo_email_habilitado") {
      return responder(
        {
          success: false,

          mensaje:
            "Has sol·licitat recentment un correu. Espera un moment abans de tornar-ho a intentar.",
        },
        429,
      );
    }

    // =================================================
    // BODY
    // =================================================

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return responder(
        {
          success: false,

          mensaje: "La sol·licitud no és vàlida.",
        },
        400,
      );
    }

    const email = normalizarEmail(body.email);

    // =================================================
    // VALIDACIÓN
    // =================================================

    if (!email || !emailValido(email)) {
      return responder(
        {
          success: false,

          mensaje: "Introdueix un correu electrònic vàlid.",
        },
        400,
      );
    }

    // =================================================
    // IMPORTANTE:
    //
    // Aplicamos el bloqueo ANTES de saber si existe
    // el usuario.
    //
    // Así no damos pistas sobre qué cuentas existen.
    // =================================================

    establecerBloqueo(request, cookies);

    // =================================================
    // BUSCAR USUARIO
    // =================================================
    //
    // NO usamos select("*").
    //
    // Nunca devolvemos:
    //
    // - contraseña
    // - permisos
    // - rol
    // - datos personales
    // =================================================

    const {
      data: usuario,

      error: errorUsuario,
    } = await supabaseAdmin
      .from("users")
      .select("id,email,activa")
      .ilike("email", email)
      .maybeSingle();

    if (errorUsuario) {
      console.error("[RECUPERACIÓN] Error buscando usuario:", {
        message: errorUsuario.message,

        code: errorUsuario.code,

        details: errorUsuario.details,

        hint: errorUsuario.hint,
      });

      return responder(
        {
          success: false,

          mensaje: "No s'ha pogut processar la sol·licitud.",
        },
        500,
      );
    }

    // =================================================
    // USUARIO NO EXISTE / INACTIVO
    // =================================================
    //
    // Respondemos EXACTAMENTE igual que si existiera.
    //
    // Esto evita enumeración de usuarios.
    // =================================================

    if (!usuario || usuario.activa === false) {
      return responder({
        success: true,

        mensaje: MENSAJE_GENERICO,
      });
    }

    // =================================================
    // RATE LIMIT EN BASE DE DATOS
    // =================================================
    //
    // La cookie evita doble clics desde el mismo
    // navegador.
    //
    // La BD evita pedir muchos correos simplemente
    // eliminando cookies o cambiando navegador.
    // =================================================

    const fechaLimite = new Date(
      Date.now() - SEGUNDOS_BLOQUEO * 1000,
    ).toISOString();

    const {
      data: verificacionesRecientes,

      error: errorVerificacionesRecientes,
    } = await supabaseAdmin
      .from("verificaciones")
      .select("token")
      .eq("id_usuario", usuario.id)
      .eq("tipo", TIPO_VERIFICACION)
      .gte("fecha_creacion", fechaLimite)
      .limit(1);

    if (errorVerificacionesRecientes) {
      console.error(
        "[RECUPERACIÓN] Error comprobando límite:",
        errorVerificacionesRecientes,
      );

      return responder(
        {
          success: false,

          mensaje: "No s'ha pogut processar la sol·licitud.",
        },
        500,
      );
    }

    if ((verificacionesRecientes ?? []).length > 0) {
      return responder({
        success: true,

        mensaje: MENSAJE_GENERICO,
      });
    }

    // =================================================
    // INVALIDAR TOKENS ANTERIORES
    // =================================================
    //
    // Al solicitar uno nuevo:
    //
    // TODOS los enlaces anteriores dejan de servir.
    // =================================================

    const { error: errorInvalidar } = await supabaseAdmin
      .from("verificaciones")
      .update({
        usado: true,
      })
      .eq("id_usuario", usuario.id)
      .eq("tipo", TIPO_VERIFICACION)
      .eq("usado", false);

    if (errorInvalidar) {
      console.error(
        "[RECUPERACIÓN] Error invalidando tokens anteriores:",
        errorInvalidar,
      );

      return responder(
        {
          success: false,

          mensaje: "No s'ha pogut processar la sol·licitud.",
        },
        500,
      );
    }

    // =================================================
    // GENERAR TOKEN
    // =================================================

    const token = generarTokenSeguro();

    const huellaToken = await obtenerHuellaToken(token);

    const ahora = new Date();

    const expiracion = new Date(ahora.getTime() + MINUTOS_VALIDEZ * 60 * 1000);

    // =================================================
    // GUARDAR VERIFICACIÓN
    // ============================================================
    //
    // IMPORTANTE:
    //
    // Guardamos huellaToken.
    //
    // NO guardamos token.
    // =================================================

    const { error: errorCrearVerificacion } = await supabaseAdmin
      .from("verificaciones")
      .insert({
        id_usuario: usuario.id,

        token: huellaToken,

        fecha_expiracion: expiracion.toISOString(),

        fecha_creacion: ahora.toISOString(),

        usado: false,

        tipo: TIPO_VERIFICACION,
      });

    if (errorCrearVerificacion) {
      console.error("[RECUPERACIÓN] Error creando verificación:", {
        message: errorCrearVerificacion.message,

        code: errorCrearVerificacion.code,

        details: errorCrearVerificacion.details,

        hint: errorCrearVerificacion.hint,
      });

      return responder(
        {
          success: false,

          mensaje: "No s'ha pogut generar la sol·licitud de recuperació.",
        },
        500,
      );
    }

    // =================================================
    // URL
    // =================================================

    const urlRecuperacion = obtenerURLRecuperacion(request, token);

    // =================================================
    // ENVIAR EMAIL
    // =================================================

    try {
      await enviarEmailApi({
        to: usuario.email,

        subject: "Recuperació de contrasenya | Esports IES Calvià",

        html: htmlEmail(urlRecuperacion),

        origen: "esports_iescalvia",
      });
    } catch (errorEmail) {
      console.error("[RECUPERACIÓN] Error enviando email:", errorEmail);

      // =============================================
      // Si el email no ha salido, invalidamos
      // inmediatamente ese token.
      // =============================================

      const { error: errorAnularToken } = await supabaseAdmin
        .from("verificaciones")
        .update({
          usado: true,
        })
        .eq("id_usuario", usuario.id)
        .eq("token", huellaToken)
        .eq("tipo", TIPO_VERIFICACION)
        .eq("usado", false);

      if (errorAnularToken) {
        console.error(
          "[RECUPERACIÓN] Tampoco se pudo invalidar el token:",
          errorAnularToken,
        );
      }

      /*
       * No revelamos al cliente que el usuario
       * existía.
       *
       * Mantenemos la misma respuesta genérica.
       */

      return responder({
        success: true,

        mensaje: MENSAJE_GENERICO,
      });
    }

    // =================================================
    // OK
    // =================================================

    return responder({
      success: true,

      mensaje: MENSAJE_GENERICO,
    });
  } catch (error) {
    console.error("[RECUPERACIÓN] Error inesperado:", error);

    return responder(
      {
        success: false,

        mensaje: "Error intern del servidor.",
      },
      500,
    );
  }
};
