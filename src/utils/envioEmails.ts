import { getSecret } from "astro:env/server";

type EnviarEmailParametros = {
  to: string;
  subject: string;
  html: string;
  origen: string;
};

export async function enviarEmailApi({
  to,
  subject,
  html,
  origen,
}: EnviarEmailParametros) {
  const body = JSON.stringify({
    to,
    subject,
    html,
    origen,
  });

  const timestamp = Date.now().toString();

  const API_KEY = getSecret("PADEV_EMAIL_KEY");
  const API_SECRET = getSecret("PADEV_EMAIL_SECRET");

  if (!API_KEY) {
    throw new Error("Falta la variable de entorno PADEV_EMAIL_KEY");
  }

  if (!API_SECRET) {
    throw new Error("Falta la variable de entorno PADEV_EMAIL_SECRET");
  }

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

  const res = await fetch(
    "https://perealemany-dev.vercel.app/api/emails/enviar",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "x-signature": signature,
        "x-timestamp": timestamp,
      },

      body,
    },
  );

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const mensaje = data?.error || "Error enviando email";

    console.error("Error enviando email:", mensaje);

    throw new Error(mensaje);
  }

  return data;
}
