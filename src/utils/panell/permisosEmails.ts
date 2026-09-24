import { enviarEmailApi } from "@utils/envioEmails";

import { NOMBRES_ROL, type Rol } from "@const/Permisos";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ORIGEN_EMAIL = "esports_iescalvia";

// ============================================================
// TIPOS
// ============================================================

type DatosEmailAccesoPanel = {
  email: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  rol: Rol;
};

export type ResultadoEmailAccesoPanel = {
  enviado: boolean;

  email: string;
};

// ============================================================
// UTILIDADES
// ============================================================

function escaparHTML(valor: string | null | undefined): string {
  return (valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function emailValido(valor: string | null | undefined): string | null {
  const email = valor?.trim().toLowerCase() ?? "";

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function urlFrontend(): string {
  const base = import.meta.env.URL_FRONTEND;

  if (typeof base !== "string" || !base.trim()) {
    throw new Error("Falta la variable d'entorn URL_FRONTEND.");
  }

  const url = new URL(base.trim());

  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("URL_FRONTEND no és una URL vàlida.");
  }

  return url.origin + url.pathname.replace(/\/$/, "");
}

function obtenerNombreCompleto(datos: DatosEmailAccesoPanel): string {
  return [datos.nombre, datos.apellido1, datos.apellido2]
    .map((valor) => valor?.trim())
    .filter((valor): valor is string => Boolean(valor))
    .join(" ");
}

// ============================================================
// HTML
// ============================================================

function crearHTML(datos: DatosEmailAccesoPanel): string {
  const base = urlFrontend();

  const enlacePanel = `${base}/panell`;

  const enlaceWeb = base;

  const enlaceAvisoLegal = `${base}/aviso-legal`;

  const enlacePrivacidad = `${base}/politica-de-privacitat`;

  const nombreCompleto = obtenerNombreCompleto(datos);

  const nombre = escaparHTML(nombreCompleto || "usuari/ària");

  const nombreRol = escaparHTML(NOMBRES_ROL[datos.rol]);

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html
    dir="ltr"
    xmlns:o="urn:schemas-microsoft-com:office:office"
    xmlns="http://www.w3.org/1999/xhtml"
    lang="ca"
>
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >
    <meta
        name="x-apple-disable-message-reformatting"
    >
    <meta
        http-equiv="X-UA-Compatible"
        content="IE=edge"
    >
    <meta
        name="format-detection"
        content="telephone=no"
    >

    <title>
        Accés activat al panell d'administració | Esports IES Calvià
    </title>

    <!--[if (mso 16)]>
    <style type="text/css">
        a {
            text-decoration: none;
        }
    </style>
    <![endif]-->

    <!--[if gte mso 9]>
    <style>
        sup {
            font-size: 100% !important;
        }
    </style>
    <![endif]-->

    <!--[if gte mso 9]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG></o:AllowPNG>
                <o:PixelsPerInch>
                    96
                </o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->

    <style type="text/css">
        #outlook a {
            padding: 0;
        }

        span.MsoHyperlink,
        span.MsoHyperlinkFollowed {
            color: inherit;
            mso-style-priority: 99;
        }

        a.es-button {
            mso-style-priority: 100 !important;
            text-decoration: none !important;
        }

        a[x-apple-data-detectors],
        #MessageViewBody a {
            color: inherit !important;
            text-decoration: none !important;
            font-size: inherit !important;
            font-family: inherit !important;
            font-weight: inherit !important;
            line-height: inherit !important;
        }

        @media only screen and (max-width: 600px) {
            .es-wrapper-table,
            .es-content {
                width: 100% !important;
                max-width: 600px !important;
            }

            .es-content table {
                width: 100% !important;
            }

            .es-mobile-padding {
                padding-left: 18px !important;
                padding-right: 18px !important;
            }

            .es-title {
                font-size: 30px !important;
                line-height: 38px !important;
            }

            .es-button {
                display: block !important;
                width: auto !important;
            }
        }
    </style>
</head>

<body
    style="
        width:100%;
        height:100%;
        font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;
        -webkit-text-size-adjust:100%;
        -ms-text-size-adjust:100%;
        padding:0;
        Margin:0;
        background-color:#f8f9ff;
    "
>
<div
    dir="ltr"
    lang="ca"
    style="
        background-color:#f8f9ff;
    "
>
    <table
        width="100%"
        cellspacing="0"
        cellpadding="0"
        role="none"
        style="
            border-spacing:0;
            padding:0;
            Margin:0;
            width:100%;
            height:100%;
        "
    >
        <tbody>
            <tr>
                <td
                    align="center"
                    valign="top"
                    style="
                        padding:32px 12px;
                        Margin:0;
                    "
                >
                    <table
                        width="600"
                        cellspacing="0"
                        cellpadding="0"
                        role="none"
                        class="es-wrapper-table"
                        style="
                            border-spacing:0;
                            width:600px;
                            max-width:600px;
                        "
                    >
                        <tbody>

                            <!-- CABECERA -->

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="center"
                                    class="es-mobile-padding"
                                    style="
                                        padding:34px 28px 28px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                        border-radius:18px 18px 0 0;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0 0 10px;
                                            color:#71F8E4;
                                            font-size:14px;
                                            line-height:20px;
                                            font-weight:bold;
                                            letter-spacing:1.5px;
                                            text-transform:uppercase;
                                        "
                                    >
                                        Esports IES Calvià
                                    </p>

                                    <h1
                                        class="es-title"
                                        style="
                                            Margin:0;
                                            color:#ffffff;
                                            font-size:38px;
                                            line-height:46px;
                                            font-weight:700;
                                            text-align:center;
                                        "
                                    >
                                        Benvingut/da a l'equip d'organització
                                    </h1>

                                    <table
                                        align="center"
                                        cellpadding="0"
                                        cellspacing="0"
                                        role="presentation"
                                        style="
                                            border-spacing:0;
                                            margin:18px auto 0;
                                        "
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    style="
                                                        padding:0;
                                                        Margin:0;
                                                        width:72px;
                                                        height:4px;
                                                        background-color:#71F8E4;
                                                        border-radius:999px;
                                                        font-size:0;
                                                        line-height:0;
                                                    "
                                                >
                                                    &nbsp;
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- CONTENIDO -->

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="left"
                                    class="es-mobile-padding"
                                    style="
                                        padding:0 28px 28px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                    "
                                >
                                    <table
                                        width="100%"
                                        cellspacing="0"
                                        cellpadding="0"
                                        role="presentation"
                                        style="
                                            border-spacing:0;
                                        "
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    style="
                                                        padding:0;
                                                        Margin:0;
                                                    "
                                                >
                                                    <p
                                                        style="
                                                            Margin:0;
                                                            color:#ffffff;
                                                            font-size:15px;
                                                            line-height:24px;
                                                        "
                                                    >
                                                        Hola <strong>${nombre}</strong>,
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:18px 0 0;
                                                            color:#d3e4fe;
                                                            font-size:15px;
                                                            line-height:24px;
                                                        "
                                                    >
                                                        El teu compte ha rebut accés al
                                                        <strong style="color:#ffffff;">
                                                            panell d'administració d'Esports IES Calvià
                                                        </strong>.
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:14px 0 0;
                                                            color:#d3e4fe;
                                                            font-size:15px;
                                                            line-height:24px;
                                                        "
                                                    >
                                                        A partir d'ara podràs accedir a les eines
                                                        de gestió que tinguis habilitades segons
                                                        el teu rol i els permisos assignats.
                                                    </p>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- ROL -->

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="left"
                                    class="es-mobile-padding"
                                    style="
                                        padding:0 28px 28px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                    "
                                >
                                    <table
                                        width="100%"
                                        cellspacing="0"
                                        cellpadding="0"
                                        role="presentation"
                                        style="
                                            border-spacing:0;
                                        "
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    bgcolor="#213145"
                                                    style="
                                                        padding:20px;
                                                        Margin:0;
                                                        background-color:#213145;
                                                        border:1px solid #3e4947;
                                                        border-left:4px solid #71F8E4;
                                                        border-radius:12px;
                                                    "
                                                >
                                                    <p
                                                        style="
                                                            Margin:0;
                                                            color:#94a3b8;
                                                            font-size:12px;
                                                            line-height:18px;
                                                            font-weight:bold;
                                                            letter-spacing:1px;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Accés confirmat
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:6px 0 0;
                                                            color:#71F8E4;
                                                            font-size:25px;
                                                            line-height:34px;
                                                            font-weight:600;
                                                        "
                                                    >
                                                        ${nombreRol}
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:8px 0 0;
                                                            color:#d3e4fe;
                                                            font-size:13px;
                                                            line-height:20px;
                                                        "
                                                    >
                                                        Els permisos concrets disponibles
                                                        dependran de la configuració assignada
                                                        al teu compte.
                                                    </p>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- BOTÓN -->

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="center"
                                    class="es-mobile-padding"
                                    style="
                                        padding:0 28px 32px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                    "
                                >
                                    <table
                                        cellspacing="0"
                                        cellpadding="0"
                                        role="presentation"
                                        align="center"
                                        style="
                                            border-spacing:0;
                                        "
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    bgcolor="#71F8E4"
                                                    align="center"
                                                    style="
                                                        padding:0;
                                                        Margin:0;
                                                        background-color:#71F8E4;
                                                        border-radius:10px;
                                                    "
                                                >
                                                    <a
                                                        href="${escaparHTML(enlacePanel)}"
                                                        target="_blank"
                                                        class="es-button"
                                                        style="
                                                            display:inline-block;
                                                            padding:15px 28px;
                                                            color:#0b1c30;
                                                            background-color:#71F8E4;
                                                            border-radius:10px;
                                                            font-size:14px;
                                                            line-height:18px;
                                                            font-weight:700;
                                                            letter-spacing:0.6px;
                                                            text-decoration:none;
                                                        "
                                                    >
                                                        ACCEDIR AL PANELL D'ADMINISTRACIÓ
                                                    </a>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- INFORMACIÓN -->

                            <tr>
                                <td
                                    bgcolor="#14263b"
                                    align="left"
                                    class="es-mobile-padding"
                                    style="
                                        padding:22px 28px;
                                        Margin:0;
                                        background-color:#14263b;
                                    "
                                >
                                    <table
                                        width="100%"
                                        cellspacing="0"
                                        cellpadding="0"
                                        role="presentation"
                                        style="
                                            border-spacing:0;
                                        "
                                    >
                                        <tbody>
                                            <tr>
                                                <td
                                                    style="
                                                        padding:0;
                                                        Margin:0;
                                                    "
                                                >
                                                    <p
                                                        style="
                                                            Margin:0;
                                                            color:#ffffff;
                                                            font-size:14px;
                                                            line-height:21px;
                                                            font-weight:bold;
                                                        "
                                                    >
                                                        Important
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:7px 0 0;
                                                            color:#b8c7dc;
                                                            font-size:13px;
                                                            line-height:20px;
                                                        "
                                                    >
                                                        L'accés és personal i està vinculat
                                                        al teu compte. No comparteixis les teves
                                                        credencials amb altres persones.
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:7px 0 0;
                                                            color:#b8c7dc;
                                                            font-size:13px;
                                                            line-height:20px;
                                                        "
                                                    >
                                                        Si no esperaves rebre aquest accés,
                                                        contacta amb l'organització.
                                                    </p>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </td>
                            </tr>

                            <!-- FOOTER -->

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="center"
                                    class="es-mobile-padding"
                                    style="
                                        padding:24px 28px 12px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0;
                                            color:#74849a;
                                            font-size:12px;
                                            line-height:18px;
                                            text-align:center;
                                        "
                                    >
                                        Heu rebut aquest correu perquè s'ha activat
                                        l'accés administratiu del vostre compte
                                        a Esports IES Calvià.
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="center"
                                    class="es-mobile-padding"
                                    style="
                                        padding:0 28px 16px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0;
                                            color:#74849a;
                                            font-size:12px;
                                            line-height:19px;
                                            text-align:center;
                                        "
                                    >
                                        <a
                                            href="${escaparHTML(enlaceWeb)}"
                                            target="_blank"
                                            style="
                                                color:#94a3b8;
                                                text-decoration:underline;
                                            "
                                        >
                                            Esports IES Calvià
                                        </a>

                                        &nbsp;·&nbsp;

                                        <a
                                            href="${escaparHTML(enlaceAvisoLegal)}"
                                            target="_blank"
                                            style="
                                                color:#94a3b8;
                                                text-decoration:underline;
                                            "
                                        >
                                            Avís legal
                                        </a>

                                        &nbsp;·&nbsp;

                                        <a
                                            href="${escaparHTML(enlacePrivacidad)}"
                                            target="_blank"
                                            style="
                                                color:#94a3b8;
                                                text-decoration:underline;
                                            "
                                        >
                                            Política de privacitat
                                        </a>
                                    </p>
                                </td>
                            </tr>

                            <tr>
                                <td
                                    bgcolor="#0b1c30"
                                    align="center"
                                    style="
                                        padding:0 28px 26px;
                                        Margin:0;
                                        background-color:#0b1c30;
                                        border-radius:0 0 18px 18px;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0;
                                            color:#53657b;
                                            font-size:11px;
                                            line-height:17px;
                                            text-align:center;
                                        "
                                    >
                                        © ${new Date().getFullYear()} Esports IES Calvià
                                    </p>
                                </td>
                            </tr>

                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</div>
</body>
</html>
`;
}

// ============================================================
// ENVÍO
// ============================================================

export async function enviarEmailAccesoPanel(
  datos: DatosEmailAccesoPanel,
): Promise<ResultadoEmailAccesoPanel> {
  const email = emailValido(datos.email);

  if (!email) {
    throw new Error("L'usuari no té una adreça de correu electrònic vàlida.");
  }

  await enviarEmailApi({
    to: email,

    subject: "Accés activat al panell d’administració | Esports IES Calvià",

    html: crearHTML(datos),

    origen: ORIGEN_EMAIL,
  });

  return {
    enviado: true,

    email,
  };
}
