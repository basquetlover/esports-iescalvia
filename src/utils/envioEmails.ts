import { getSecret } from "astro:env/server";

// ============================================================
// TIPOS
// ============================================================

type EnviarEmailParametros = {
  to: string;
  subject: string;
  html: string;
  origen: string;
};

// ============================================================
// CONFIGURACIÓN
// ============================================================

const EMAIL_API_URL = "https://perealemany-dev.vercel.app/api/emails/enviar";

// ============================================================
// ENVIAR EMAIL
// ============================================================

export async function enviarEmailApi({
  to,
  subject,
  html,
  origen,
}: EnviarEmailParametros) {
  // ==========================================================
  // CREDENCIALES
  // ==========================================================

  const API_KEY = getSecret("PADEV_EMAIL_KEY");
  const API_SECRET = getSecret("PADEV_EMAIL_SECRET");

  if (!API_KEY) {
    throw new Error("Falta la variable de entorno PADEV_EMAIL_KEY");
  }

  if (!API_SECRET) {
    throw new Error("Falta la variable de entorno PADEV_EMAIL_SECRET");
  }

  // ==========================================================
  // BODY
  // ==========================================================

  const body = JSON.stringify({
    to,
    subject,
    html,
    origen,
  });

  // ==========================================================
  // TIMESTAMP
  // ==========================================================

  const timestamp = Date.now().toString();

  // ==========================================================
  // FIRMA HMAC SHA-256
  // ==========================================================

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(API_SECRET),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body + timestamp),
  );

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  // ==========================================================
  // PETICIÓN
  // ==========================================================

  console.log("[EMAIL] Enviando petición a API de emails", {
    to,
    origen,
    timestamp,
    signatureLength: signature.length,
  });

  let response: Response;

  try {
    response = await fetch(EMAIL_API_URL, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-signature": signature,
        "x-timestamp": timestamp,
      },

      body,
    });
  } catch (error) {
    console.error("[EMAIL] No se pudo conectar con la API de emails:", error);

    throw new Error("No se pudo conectar con la API de emails");
  }

  // ==========================================================
  // RESPUESTA
  // ==========================================================

  const data = await response.json().catch(() => null);

  console.log("[EMAIL] Respuesta API emails:", {
    status: response.status,
    ok: response.ok,
  });

  // ==========================================================
  // ERROR
  // ==========================================================

  if (!response.ok) {
    const mensaje = data?.error || `Error enviando email (${response.status})`;

    console.error("[EMAIL] API de emails devolvió error:", {
      status: response.status,
      mensaje,
    });

    throw new Error(mensaje);
  }

  // ==========================================================
  // OK
  // ==========================================================

  return data;
}
