export async function enviarEmailApi({to, subject, html, origen}: {to: string; subject: string; html: string; origen: string; }) {
  const body = JSON.stringify({ to, subject, html, origen });
  const timestamp = Date.now().toString();

  const API_KEY = import.meta.env.PADEV_EMAIL_KEY;
  const API_SECRET = import.meta.env.PADEV_EMAIL_SECRET;

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(body + timestamp)
  );

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  const res = await fetch("https://perealemany-dev.vercel.app/api/emails/enviar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "x-signature": signature,
      "x-timestamp": timestamp
    },
    body
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("Error enviando email:", data?.error || "Error enviando email");
    throw new Error(data?.error || "Error enviando email");
  }

  return data;
}