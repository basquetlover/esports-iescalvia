import type { APIRoute } from "astro";

import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { esDesarrollador } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import { enviarEmailApi } from "@utils/envioEmails";

import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";

import {
  ACCIONES_ELIMINACION,
  ejecutarEliminacion,
  etiquetaAccionEliminacion,
  obtenerPreviewEliminacion,
  type AccionEliminacion,
} from "@utils/panell/edicio/eliminarDades";

import { verificarPassword } from "../../../sesiones/iniciar";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const MINUTOS_CODIGO = 10;

const COOKIE_VERIFICACION = "verificacio_eliminar_edicio";

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Registro = Record<string, unknown>;

type UsuarioDB = {
  id: string;

  email: string | null;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  rol: string | null;

  activa: boolean | null;

  contrasena: string | null;
};

type EdicionDB = {
  id: string;

  torneo_id: string | null;

  nombre: string | null;

  estado: string | null;
};

type VerificacionPayload = {
  usuarioID: string;

  edicionID: string;

  accion: AccionEliminacion;

  codigoHash: string;

  nonce: string;

  expiraAt: number;
};

// ============================================================
// ERROR
// ============================================================

function responderError(error: unknown) {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,

        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error en la zona destructiva de l'edició:", error);

  return responder(
    {
      success: false,

      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

// ============================================================
// REGISTRO
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

// ============================================================
// IDENTIFICADOR
// ============================================================

function identificador(
  valor: unknown,

  nombre: string,
) {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim().toLowerCase();

  if (!UUID.test(limpio)) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return limpio;
}

// ============================================================
// ACCIÓN
// ============================================================

function leerAccion(valor: unknown): AccionEliminacion {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
  }

  const accion = valor.trim().toUpperCase();

  if (!ACCIONES_ELIMINACION.includes(accion as AccionEliminacion)) {
    throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
  }

  return accion as AccionEliminacion;
}

// ============================================================
// CÓDIGO
// ============================================================

function leerCodigo(valor: unknown) {
  if (typeof valor !== "string" || !/^\d{6}$/.test(valor)) {
    throw new ErrorAPI(400, "El codi de verificació ha de tenir 6 xifres.");
  }

  return valor;
}

// ============================================================
// SECRETO
// ============================================================

function obtenerSecreto() {
  const secreto = import.meta.env.PADEV_EMAIL_SECRET;

  if (typeof secreto !== "string" || secreto.length < 16) {
    throw new ErrorAPI(500, "No està configurat el secret de verificació.");
  }

  return secreto;
}

// ============================================================
// HMAC
// ============================================================

function firmar(valor: string) {
  return createHmac("sha256", obtenerSecreto()).update(valor).digest("hex");
}

// ============================================================
// COMPARACIÓN SEGURA
// ============================================================

function compararSeguro(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// ============================================================
// BASE64 URL
// ============================================================

function codificarPayload(payload: VerificacionPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodificarPayload(valor: string): VerificacionPayload {
  try {
    const contenido = Buffer.from(valor, "base64url").toString("utf8");

    const payload: unknown = JSON.parse(contenido);

    if (!esRegistro(payload)) {
      throw new Error();
    }

    if (
      typeof payload.usuarioID !== "string" ||
      typeof payload.edicionID !== "string" ||
      typeof payload.accion !== "string" ||
      typeof payload.codigoHash !== "string" ||
      typeof payload.nonce !== "string" ||
      typeof payload.expiraAt !== "number"
    ) {
      throw new Error();
    }

    const accion = leerAccion(payload.accion);

    return {
      usuarioID: payload.usuarioID,

      edicionID: payload.edicionID,

      accion,

      codigoHash: payload.codigoHash,

      nonce: payload.nonce,

      expiraAt: payload.expiraAt,
    };
  } catch {
    throw new ErrorAPI(401, "La verificació ja no és vàlida.");
  }
}

// ============================================================
// GENERAR CÓDIGO
// ============================================================

function generarCodigo() {
  return randomInt(100000, 1000000).toString();
}

// ============================================================
// CREAR DESAFÍO
// ============================================================

function crearVerificacion({
  usuarioID,
  edicionID,
  accion,
  codigo,
}: {
  usuarioID: string;

  edicionID: string;

  accion: AccionEliminacion;

  codigo: string;
}) {
  const nonce = randomBytes(24).toString("hex");

  const expiraAt = Date.now() + MINUTOS_CODIGO * 60 * 1000;

  const codigoHash = firmar(
    [usuarioID, edicionID, accion, codigo, nonce].join(":"),
  );

  const payload: VerificacionPayload = {
    usuarioID,

    edicionID,

    accion,

    codigoHash,

    nonce,

    expiraAt,
  };

  const contenido = codificarPayload(payload);

  const firma = firmar(contenido);

  return {
    token: `${contenido}.${firma}`,

    expiraAt,
  };
}

// ============================================================
// LEER DESAFÍO
// ============================================================

function leerVerificacion(token: string) {
  const partes = token.split(".");

  if (partes.length !== 2) {
    throw new ErrorAPI(401, "La verificació ja no és vàlida.");
  }

  const [contenido, firma] = partes;

  const firmaEsperada = firmar(contenido);

  if (!compararSeguro(firma, firmaEsperada)) {
    throw new ErrorAPI(401, "La verificació ja no és vàlida.");
  }

  const payload = decodificarPayload(contenido);

  if (payload.expiraAt < Date.now()) {
    throw new ErrorAPI(401, "El codi de verificació ha caducat.");
  }

  return payload;
}

// ============================================================
// COMPROBAR CÓDIGO
// ============================================================

function comprobarCodigo({
  payload,
  usuarioID,
  edicionID,
  accion,
  codigo,
}: {
  payload: VerificacionPayload;

  usuarioID: string;

  edicionID: string;

  accion: AccionEliminacion;

  codigo: string;
}) {
  if (
    payload.usuarioID !== usuarioID ||
    payload.edicionID !== edicionID ||
    payload.accion !== accion
  ) {
    throw new ErrorAPI(401, "Aquest codi no correspon a aquesta operació.");
  }

  const esperado = firmar(
    [usuarioID, edicionID, accion, codigo, payload.nonce].join(":"),
  );

  if (!compararSeguro(esperado, payload.codigoHash)) {
    throw new ErrorAPI(401, "El codi de verificació no és correcte.");
  }
}

// ============================================================
// USUARIO DESARROLLADOR
// ============================================================

async function exigirDesarrollador(usuario: Usuario) {
  /*
   * NO se comprueban permisos.
   *
   * Exclusivamente rol desarrollador.
   */

  if (!esDesarrollador(usuario.rol)) {
    throw new ErrorAPI(
      403,
      "Aquesta secció està restringida als desenvolupadors.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,email,nombre,apellido1,apellido2,rol,activa,contrasena")
    .eq("id", usuario.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const usuarioDB = data as UsuarioDB | null;

  if (
    !usuarioDB ||
    usuarioDB.activa !== true ||
    !esDesarrollador(usuarioDB.rol)
  ) {
    throw new ErrorAPI(
      403,
      "El compte ja no disposa d'accés de desenvolupador.",
    );
  }

  if (!usuarioDB.email?.trim()) {
    throw new ErrorAPI(
      409,
      "El compte no té cap correu electrònic configurat.",
    );
  }

  return usuarioDB;
}

// ============================================================
// EDICIÓN
// ============================================================

async function exigirEdicion(torneoID: string, edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select("id,torneo_id,nombre,estado")
    .eq("id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const edicion = data as EdicionDB | null;

  if (!edicion || edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig seleccionat.");
  }

  return edicion;
}

// ============================================================
// OCULTAR EMAIL
// ============================================================

function ocultarEmail(email: string) {
  const [local, dominio] = email.split("@");

  if (!local || !dominio) {
    return email;
  }

  const visibles = local.slice(0, Math.min(2, local.length));

  return `${visibles}${"*".repeat(
    Math.max(3, local.length - visibles.length),
  )}@${dominio}`;
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
// EMAIL
// ============================================================

function crearEmailCodigo({
  codigo,
  accion,
  edicion,
}: {
  codigo: string;

  accion: AccionEliminacion;

  edicion: EdicionDB;
}) {
  const accionTexto = escaparHTML(etiquetaAccionEliminacion(accion));

  const nombreEdicion = escaparHTML(
    edicion.nombre?.trim() || "Edició sense nom",
  );

  return `
<!doctype html>
<html lang="ca">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
</head>

<body
    style="
        margin:0;
        padding:0;
        background:#f4f4f5;
        font-family:Arial,Helvetica,sans-serif;
        color:#18181b;
    "
>
    <table
        width="100%"
        cellpadding="0"
        cellspacing="0"
        role="presentation"
        style="padding:32px 16px;"
    >
        <tr>
            <td align="center">
                <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    role="presentation"
                    style="
                        max-width:600px;
                        background:#ffffff;
                        border-radius:16px;
                        overflow:hidden;
                    "
                >
                    <tr>
                        <td
                            style="
                                padding:28px;
                                background:#171717;
                                color:#ffffff;
                            "
                        >
                            <div
                                style="
                                    font-size:12px;
                                    font-weight:700;
                                    text-transform:uppercase;
                                    letter-spacing:1.4px;
                                    color:#c4c4c4;
                                "
                            >
                                Esports IES Calvià
                            </div>

                            <h1
                                style="
                                    margin:8px 0 0;
                                    font-size:23px;
                                    line-height:1.25;
                                "
                            >
                                Verificació d'operació destructiva
                            </h1>
                        </td>
                    </tr>

                    <tr>
                        <td
                            style="
                                padding:28px;
                            "
                        >
                            <p
                                style="
                                    margin:0;
                                    font-size:15px;
                                    line-height:1.6;
                                "
                            >
                                S'ha sol·licitat executar:
                            </p>

                            <div
                                style="
                                    margin-top:18px;
                                    padding:16px;
                                    background:#f4f4f5;
                                    border-radius:10px;
                                "
                            >
                                <strong>
                                    ${accionTexto}
                                </strong>

                                <br>

                                <span
                                    style="
                                        color:#71717a;
                                    "
                                >
                                    ${nombreEdicion}
                                </span>
                            </div>

                            <p
                                style="
                                    margin:24px 0 10px;
                                    font-size:13px;
                                    color:#52525b;
                                "
                            >
                                Codi de verificació
                            </p>

                            <div
                                style="
                                    padding:18px;
                                    border:1px solid #e4e4e7;
                                    border-radius:12px;
                                    text-align:center;
                                    font-size:34px;
                                    font-weight:800;
                                    letter-spacing:8px;
                                    color:#18181b;
                                "
                            >
                                ${codigo}
                            </div>

                            <p
                                style="
                                    margin:20px 0 0;
                                    font-size:13px;
                                    line-height:1.6;
                                    color:#71717a;
                                "
                            >
                                El codi caduca en
                                ${MINUTOS_CODIGO} minuts
                                i només és vàlid per aquesta
                                operació concreta.
                            </p>

                            <p
                                style="
                                    margin:12px 0 0;
                                    font-size:13px;
                                    line-height:1.6;
                                    color:#b91c1c;
                                "
                            >
                                Si no has iniciat aquesta operació,
                                no introdueixis el codi.
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
// GUARDAR COOKIE
// ============================================================

function guardarCookieVerificacion(
  cookies: Parameters<APIRoute>[0]["cookies"],

  token: string,
) {
  cookies.set(COOKIE_VERIFICACION, token, {
    httpOnly: true,

    secure: import.meta.env.PROD,

    sameSite: "strict",

    path: "/",

    maxAge: MINUTOS_CODIGO * 60,
  });
}

// ============================================================
// BORRAR COOKIE
// ============================================================

function borrarCookieVerificacion(cookies: Parameters<APIRoute>[0]["cookies"]) {
  cookies.delete(COOKIE_VERIFICACION, {
    path: "/",
  });
}

// ============================================================
// GET
// ============================================================
//
// Solo devuelve preview.
// NO envía emails.
// NO elimina nada.
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    await exigirDesarrollador(usuario);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    const edicion = await exigirEdicion(torneoID, edicionID);

    const preview = await obtenerPreviewEliminacion(edicionID);

    return responder({
      success: true,

      restringido: true,

      edicion: {
        id: edicion.id,

        nombre: edicion.nombre,

        estado: edicion.estado,
      },

      preview,
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// POST
// ============================================================
//
// PASO 1:
//
// 1. pulsa eliminar
// 2. introduce contraseña
// 3. comprobamos contraseña
// 4. generamos código
// 5. enviamos email
// 6. guardamos desafío firmado HttpOnly
//
// NO SE BORRA NADA AQUÍ.
// ============================================================

export const POST: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const usuarioDB = await exigirDesarrollador(usuario);

    const cuerpo = await leerJSON(request);

    if (!esRegistro(cuerpo)) {
      throw new ErrorAPI(400, "La petició no és vàlida.");
    }

    const torneoID = identificador(cuerpo.torneoID, "torneig");

    const edicionID = identificador(cuerpo.edicionID, "edició");

    const accion = leerAccion(cuerpo.accion);

    if (
      typeof cuerpo.contrasena !== "string" ||
      cuerpo.contrasena.length === 0 ||
      cuerpo.contrasena.length > 4096
    ) {
      throw new ErrorAPI(400, "Indica la contrasenya actual.");
    }

    const edicion = await exigirEdicion(torneoID, edicionID);

    // =================================================
    // CONTRASEÑA
    // =================================================

    const passwordValido = await verificarPassword(
      cuerpo.contrasena,
      usuarioDB.contrasena,
    );

    if (!passwordValido) {
      throw new ErrorAPI(401, "La contrasenya no és correcta.");
    }

    // =================================================
    // CÓDIGO
    // =================================================

    const codigo = generarCodigo();

    const { token, expiraAt } = crearVerificacion({
      usuarioID: usuarioDB.id,

      edicionID,

      accion,

      codigo,
    });

    /*
     * Cada nuevo POST reemplaza la verificación anterior.
     *
     * Por tanto solo puede existir un desafío destructivo
     * pendiente por navegador/sesión.
     */

    guardarCookieVerificacion(cookies, token);

    // =================================================
    // EMAIL
    // =================================================

    const email = usuarioDB.email!.trim();

    try {
      await enviarEmailApi({
        to: email,

        subject: `Codi de verificació · ${etiquetaAccionEliminacion(
          accion,
        )} | Esports IES Calvià`,

        html: crearEmailCodigo({
          codigo,
          accion,
          edicion,
        }),

        origen: "esports_iescalvia",
      });
    } catch (errorEmail) {
      /*
       * Si el email falla, invalidamos inmediatamente
       * el desafío.
       */

      borrarCookieVerificacion(cookies);

      console.error("Error enviant el codi de verificació:", errorEmail);

      throw new ErrorAPI(502, "No s'ha pogut enviar el codi de verificació.");
    }

    return responder({
      success: true,

      verificacioRequerida: true,

      accion,

      accionTexto: etiquetaAccionEliminacion(accion),

      email: ocultarEmail(email),

      caducaAt: new Date(expiraAt).toISOString(),

      mensaje: `S'ha enviat un codi de verificació a ${ocultarEmail(email)}.`,
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// DELETE
// ============================================================
//
// PASO 2:
//
// {
//     torneoID,
//     edicionID,
//     accion,
//     codigo,
//     confirmacion // solo EDICION
// }
//
// Si todo coincide:
//
// usuario + edición + acción + código
//
// se consume el desafío y se ejecuta el borrado.
// ============================================================

export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    // =================================================
    // USUARIO
    // =================================================

    const usuario = await exigirUsuario(cookies);

    const usuarioDB = await exigirDesarrollador(usuario);

    // =================================================
    // BODY
    // =================================================

    const cuerpo = await leerJSON(request);

    if (!esRegistro(cuerpo)) {
      throw new ErrorAPI(400, "La petició no és vàlida.");
    }

    const torneoID = identificador(cuerpo.torneoID, "torneig");

    const edicionID = identificador(cuerpo.edicionID, "edició");

    const accion = leerAccion(cuerpo.accion);

    const codigo = leerCodigo(cuerpo.codigo);

    // =================================================
    // EDICIÓN
    // =================================================

    const edicion = await exigirEdicion(torneoID, edicionID);

    // =================================================
    // CONFIRMACIÓN EXTRA EDICIÓN
    // =================================================

    if (accion === "EDICION") {
      const esperado = edicion.nombre?.trim() || edicion.id;

      if (
        typeof cuerpo.confirmacion !== "string" ||
        cuerpo.confirmacion.trim() !== esperado
      ) {
        throw new ErrorAPI(
          400,
          `Per eliminar tota l'edició has d'escriure exactament: ${esperado}`,
        );
      }
    }

    // =================================================
    // COOKIE DE VERIFICACIÓN
    // =================================================

    const token = cookies.get(COOKIE_VERIFICACION)?.value;

    if (!token) {
      throw new ErrorAPI(
        401,
        "Has de tornar a sol·licitar un codi de verificació.",
      );
    }

    // =================================================
    // VERIFICAR FIRMA / CADUCIDAD
    // =================================================

    const payload = leerVerificacion(token);

    // =================================================
    // VERIFICAR CÓDIGO + CONTEXTO
    // =================================================

    comprobarCodigo({
      payload,

      usuarioID: usuarioDB.id,

      edicionID,

      accion,

      codigo,
    });

    // =================================================
    // PREVIEW ANTES
    // =================================================

    const previewAntes = await obtenerPreviewEliminacion(edicionID);

    // =================================================
    // CONSUMIR CÓDIGO
    // =================================================
    //
    // Se elimina antes de ejecutar la operación.
    //
    // Si el borrado falla habrá que introducir
    // contraseña y solicitar un nuevo código.
    //

    borrarCookieVerificacion(cookies);

    // =================================================
    // EJECUTAR
    // =================================================

    await ejecutarEliminacion(accion, edicionID);

    // =================================================
    // EDICIÓN COMPLETA
    // =================================================

    if (accion === "EDICION") {
      return responder({
        success: true,

        accion,

        edicionEliminada: true,

        antes: previewAntes,

        mensaje:
          "L'edició i totes les seves dades s'han eliminat correctament.",
      });
    }

    // =================================================
    // PREVIEW DESPUÉS
    // =================================================

    const previewDespues = await obtenerPreviewEliminacion(edicionID);

    return responder({
      success: true,

      accion,

      edicionEliminada: false,

      antes: previewAntes,

      despues: previewDespues,

      mensaje: `${etiquetaAccionEliminacion(
        accion,
      )}: operació completada correctament.`,
    });
  } catch (error) {
    return responderError(error);
  }
};
