import { enviarEmailApi } from "@utils/envioEmails";
import { supabaseAdmin } from "@utils/supabase";

const ORIGEN_EMAIL = "esports_iescalvia";

type Destinatario = {
    email: string;
    tipo: "VOLUNTARIO" | "SISTEMA";
};

type DatosEmail = {
    formulario: {
        id: string;
        estado: string | null;
        email_contacto: string | null;
    };
    voluntario: {
        nombre: string | null;
        apellido1: string | null;
        apellido2: string | null;
        email: string | null;
        curso: string | null;
        grupo: string | null;
        tipo_voluntariado: string | null;
        descripcion: string | null;
        plaza_estado: string | null;
    };
    edicion: {
        id: string;
        nombre: string | null;
    };
    torneo: {
        id: string;
        nombre: string | null;
        logo: string | null;
        banner: string | null;
    };
    sistema: {
        notificar_nuevo_voluntario: boolean | null;
        email_notificaciones_principal: string | null;
        email_notificaciones_secundario: string | null;
    } | null;
    contactos: Array<{ email: string | null }>;
};

export type ResultadoEmailVoluntario = {
    destinatarios: number;
    enviados: number;
    fallidos: number;
};

function escaparHTML(valor: string | null | undefined): string {
    return (valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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

function urlImagen(valor: string | null, base: string): string | null {
    if (!valor?.trim()) return null;

    try {
        const url = new URL(valor.trim(), `${base}/`);

        return ["https:", "http:"].includes(url.protocol)
            ? url.href
            : null;
    } catch {
        return null;
    }
}

function emailValido(valor: string | null | undefined): string | null {
    const email = valor?.trim().toLowerCase() ?? "";

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ? email
        : null;
}

async function cargarDatosEmail(formularioID: string): Promise<DatosEmail> {
    const { data: formulario, error: errorFormulario } = await supabaseAdmin
        .from("formularios")
        .select("id,edicion_id,estado,email_contacto")
        .eq("id", formularioID)
        .eq("tipo", "VOLUNTARIO")
        .maybeSingle();

    if (errorFormulario) throw errorFormulario;

    if (
        !formulario ||
        formulario.estado?.trim().toUpperCase() !== "EN_REVISION"
    ) {
        throw new Error(
            "El correu requereix un formulari de voluntariat EN_REVISION.",
        );
    }

    const [voluntario, edicion, plataforma, contactos] = await Promise.all([
        supabaseAdmin
            .from("voluntarios")
            .select(
                "nombre,apellido1,apellido2,email,curso,grupo,tipo_voluntariado,descripcion,plaza_estado",
            )
            .eq("formulario_id", formularioID)
            .maybeSingle(),

        supabaseAdmin
            .from("ediciones")
            .select("id,torneo_id,nombre")
            .eq("id", formulario.edicion_id)
            .maybeSingle(),

        supabaseAdmin
            .from("configuracion_plataforma")
            .select(
                "notificar_nuevo_voluntario,email_notificaciones_principal,email_notificaciones_secundario,created_at",
            )
            .order("created_at", {
                ascending: true,
                nullsFirst: false,
            })
            .limit(1),

        supabaseAdmin
            .from("contactos_soporte")
            .select("email")
            .eq("activo", true)
            .order("orden", {
                ascending: true,
                nullsFirst: false,
            }),
    ]);

    for (const consulta of [voluntario, edicion, plataforma, contactos]) {
        if (consulta.error) throw consulta.error;
    }

    if (!voluntario.data || !edicion.data) {
        throw new Error(
            "Falten dades de la sol·licitud de voluntariat.",
        );
    }

    const { data: torneo, error: errorTorneo } = await supabaseAdmin
        .from("torneos")
        .select("id,nombre,logo,banner")
        .eq("id", edicion.data.torneo_id)
        .maybeSingle();

    if (errorTorneo) throw errorTorneo;

    if (!torneo) {
        throw new Error(
            "No s'ha trobat el torneig de la sol·licitud.",
        );
    }

    return {
        formulario,
        voluntario: voluntario.data,
        edicion: edicion.data,
        torneo,
        sistema: plataforma.data?.[0] ?? null,
        contactos: contactos.data ?? [],
    };
}

function destinatarios(datos: DatosEmail): Destinatario[] {
    const resultado = new Map<string, Destinatario>();

    const añadir = (
        valor: string | null | undefined,
        tipo: Destinatario["tipo"],
    ) => {
        const email = emailValido(valor);

        if (email && !resultado.has(email)) {
            resultado.set(email, { email, tipo });
        }
    };

    añadir(
        datos.voluntario.email ?? datos.formulario.email_contacto,
        "VOLUNTARIO",
    );

    if (datos.sistema?.notificar_nuevo_voluntario !== false) {
        añadir(
            datos.sistema?.email_notificaciones_principal,
            "SISTEMA",
        );
        añadir(
            datos.sistema?.email_notificaciones_secundario,
            "SISTEMA",
        );

        for (const contacto of datos.contactos) {
            añadir(contacto.email, "SISTEMA");
        }
    }

    return [...resultado.values()];
}

function fila(
    etiqueta: string,
    valor: string | null,
    ultima = false,
): string {
    const borde = ultima ? "" : "border-bottom:1px solid #3e4947;";

    return `
        <tr>
            <td valign="top" width="150" style="padding:11px 8px;Margin:0;color:#94a3b8;font-size:12px;line-height:18px;${borde}">
                ${escaparHTML(etiqueta)}
            </td>
            <td valign="top" style="padding:11px 8px;Margin:0;color:#ffffff;font-size:13px;line-height:19px;word-break:break-word;${borde}">
                ${escaparHTML(valor?.trim() || "No indicat")}
            </td>
        </tr>`;
}

function crearHTML(
    datos: DatosEmail,
    destinatario: Destinatario,
): string {
    const base = urlFrontend();
    const torneo = escaparHTML(
        datos.torneo.nombre || "Esports IES Calvià",
    );
    const edicion = escaparHTML(
        datos.edicion.nombre || "Edició",
    );

    const nombre = [
        datos.voluntario.nombre,
        datos.voluntario.apellido1,
        datos.voluntario.apellido2,
    ]
        .map(valor => valor?.trim())
        .filter(Boolean)
        .join(" ");

    const banner = urlImagen(datos.torneo.banner, base);
    const logo = urlImagen(datos.torneo.logo, base);

    const enlace =
        `${base}/tornejos/${encodeURIComponent(datos.torneo.id)}` +
        "?seccio=voluntariat#formulari-voluntariat";

    const presentacion = escaparHTML(
        datos.voluntario.descripcion?.trim() || "No indicada",
    ).replace(/\r\n|\r|\n/g, "<br>");

    const espera =
        datos.voluntario.plaza_estado?.toUpperCase() ===
        "LISTA_ESPERA";

    const titulo = destinatario.tipo === "SISTEMA"
        ? "Nova sol·licitud de voluntariat"
        : "Sol·licitud de voluntariat rebuda";

    const explicacion = destinatario.tipo === "SISTEMA"
        ? "S'ha rebut una nova inscripció de voluntariat. Les dades enviades estan pendents de revisió."
        : "Hem rebut la teva sol·licitud. L'organització revisarà les dades i t'informarà quan canviï l'estat.";

    const pie = destinatario.tipo === "SISTEMA"
        ? "Heu rebut aquest correu perquè esteu configurat com a contacte de notificacions d'Esports IES Calvià."
        : "Heu rebut aquest correu perquè heu presentat una sol·licitud de voluntariat.";

    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="ca">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="format-detection" content="telephone=no">
    <title>${titulo}</title>

    <!--[if (mso 16)]>
    <style type="text/css">a { text-decoration:none; }</style>
    <![endif]-->

    <!--[if gte mso 9]>
    <style>sup { font-size:100% !important; }</style>
    <![endif]-->

    <!--[if gte mso 9]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:AllowPNG></o:AllowPNG>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->

    <style type="text/css">
        #outlook a { padding:0; }

        span.MsoHyperlink,
        span.MsoHyperlinkFollowed {
            color:inherit;
            mso-style-priority:99;
        }

        a.es-button {
            mso-style-priority:100!important;
            text-decoration:none!important;
        }

        a[x-apple-data-detectors],
        #MessageViewBody a {
            color:inherit!important;
            text-decoration:none!important;
            font-size:inherit!important;
            font-family:inherit!important;
            font-weight:inherit!important;
            line-height:inherit!important;
        }

        @media only screen and (max-width:600px) {
            .es-content,
            .es-header,
            .es-footer {
                width:100%!important;
                max-width:600px!important;
            }

            .es-content table,
            .es-header table,
            .es-footer table {
                width:100%!important;
            }

            .es-adapt-td {
                display:block!important;
                width:100%!important;
            }

            .adapt-img {
                width:100%!important;
                height:auto!important;
            }
        }
    </style>
</head>

<body style="width:100%;height:100%;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0;background-color:#f8f9ff">
<div dir="ltr" lang="ca" style="background-color:#f8f9ff">

<table width="100%" cellspacing="0" cellpadding="0" role="none" style="border-spacing:0;padding:0;Margin:0;width:100%;height:100%">
<tbody>
<tr>
<td valign="top" align="center" style="padding:0;Margin:0">

    <!-- CABECERA -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-header" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:24px 20px 18px;Margin:0;background-color:#0b1c30">
                    <h3 style="Margin:0;font-size:26px;line-height:32px;color:#71F8E4;text-align:center">
                        ${torneo}
                    </h3>

                    <p style="Margin:6px 0 0;line-height:20px;color:#d3e4fe;font-size:13px;text-align:center">
                        ${edicion}
                    </p>

                    <h4 style="Margin:8px 0 0;font-size:22px;font-weight:normal;line-height:30px;color:#ffffff;text-align:center">
                        ${titulo}
                    </h4>
                </td>
            </tr>

            ${banner ? `
                <tr>
                    <td bgcolor="#0b1c30" align="center" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30;font-size:0">
                        <img src="${escaparHTML(banner)}" alt="${torneo}" width="560" class="adapt-img" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px">
                    </td>
                </tr>
            ` : ""}
        </tbody>
    </table>

    <!-- CONFIRMACIÓN -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-content" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">
                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>
                            <tr>
                                <td align="center" bgcolor="#213145" style="padding:18px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">
                                    <h3 style="Margin:0;font-family:Verdana,Geneva,sans-serif;font-size:25px;font-weight:normal;line-height:32px;color:#ffffff;text-align:center">
                                        ${titulo}
                                    </h3>

                                    <p style="Margin:12px 0 0;font-family:Verdana,Geneva,sans-serif;line-height:21px;color:#d3e4fe;font-size:14px;text-align:center">
                                        ${explicacion}
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- VOLUNTARIO -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-content" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">
                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>
                            <tr>
                                <td bgcolor="#213145" style="padding:20px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">
                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>
                                            <tr>
                                                ${logo ? `
                                                    <td valign="middle" width="110" class="es-adapt-td" style="padding:0 18px 0 0;Margin:0;width:110px">
                                                        <img src="${escaparHTML(logo)}" alt="" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;outline:none;text-decoration:none">
                                                    </td>
                                                ` : ""}

                                                <td valign="middle" style="padding:0;Margin:0">
                                                    <p style="Margin:0;font-size:22px;line-height:28px;color:#ffffff;font-weight:bold">
                                                        ${escaparHTML(nombre)}
                                                    </p>

                                                    <p style="Margin:5px 0 0;line-height:20px;color:#d3e4fe;font-size:13px">
                                                        ${escaparHTML(datos.voluntario.email)}
                                                    </p>
                                                </td>

                                                <td valign="middle" align="right" width="115" style="padding:0;Margin:0;width:115px">
                                                    <span style="display:inline-block;padding:7px 12px;background-color:#0f766e;border-radius:999px;color:#ffffff;font-size:10px;font-weight:bold;text-transform:uppercase">
                                                        EN REVISIÓ
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    ${espera ? `
                                        <p style="Margin:12px 0 0;line-height:20px;color:#71F8E4;font-size:12px">
                                            Sol·licitud en llista d'espera.
                                        </p>
                                    ` : ""}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- DATOS DEL FORMULARIO -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-content" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">
                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>
                            <tr>
                                <td bgcolor="#213145" style="padding:14px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-bottom:none;border-radius:12px 12px 0 0;color:#ffffff;font-size:16px;font-weight:bold">
                                    Dades de la sol·licitud
                                </td>
                            </tr>

                            <tr>
                                <td bgcolor="#213145" style="padding:10px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-top:none;border-radius:0 0 12px 12px">
                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>
                                            ${fila("Nom", datos.voluntario.nombre)}
                                            ${fila("Primer llinatge", datos.voluntario.apellido1)}
                                            ${fila("Segon llinatge", datos.voluntario.apellido2)}
                                            ${fila("Correu electrònic", datos.voluntario.email)}
                                            ${fila("Curs", datos.voluntario.curso)}
                                            ${fila("Grup", datos.voluntario.grupo)}
                                            ${fila("Tipus de voluntariat", datos.voluntario.tipo_voluntariado, true)}
                                        </tbody>
                                    </table>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- PRESENTACIÓN COMPLETA -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-content" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">
                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>
                            <tr>
                                <td bgcolor="#213145" style="padding:20px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">
                                    <p style="Margin:0;line-height:15px;letter-spacing:1px;color:#71F8E4;font-size:11px;font-weight:bold;text-transform:uppercase">
                                        Presentació · Per què vols ser voluntari?
                                    </p>

                                    <p style="Margin:12px 0 0;line-height:21px;color:#ffffff;font-size:14px;word-break:break-word">
                                        ${presentacion}
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- BOTÓN Y AVISO -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-content" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:0 20px 24px;Margin:0;background-color:#0b1c30">
                    <a href="${escaparHTML(enlace)}" target="_blank" style="text-decoration:none;color:#ffffff;font-size:14px;font-weight:bold;padding:14px 28px;display:inline-block;background-color:#0f766e;border-radius:12px;text-transform:uppercase">
                        ${destinatario.tipo === "SISTEMA" ? "Obrir el torneig" : "Veure la meva sol·licitud"}
                    </a>

                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="margin-top:20px;border-spacing:0">
                        <tbody>
                            <tr>
                                <td bgcolor="#213145" style="padding:14px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-left:4px solid #14b8a6;border-radius:8px">
                                    <p style="Margin:0;line-height:20px;color:#d3e4fe;font-size:13px;text-align:center">
                                        La sol·licitud està pendent de revisió. Quan es resolgui, es comunicarà l'estat corresponent.
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- FOOTER -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-footer" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:18px 20px 6px;Margin:0;background-color:#0b1c30">
                    <p style="Margin:0;line-height:18px;color:#64748b;font-size:12px;text-align:center">
                        ©${new Date().getFullYear()} Esports IES Calvià | Tots els drets reservats.
                    </p>
                </td>
            </tr>

            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:8px 40px;Margin:0;background-color:#0b1c30">
                    <p style="Margin:0;line-height:18px;color:#64748b;font-size:11px;text-align:center">
                        ${escaparHTML(pie)}
                    </p>

                    <p style="Margin:5px 0 0;line-height:18px;color:#64748b;font-size:11px;text-align:center">
                        <a href="${escaparHTML(base)}" target="_blank" style="color:#14b8a6;text-decoration:underline">
                            ${escaparHTML(base)}
                        </a>
                    </p>
                </td>
            </tr>

            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:6px 30px 22px;Margin:0;background-color:#0b1c30">
                    <p style="Margin:0;line-height:18px;color:#64748b;font-size:11px;text-align:center">
                        <a href="${escaparHTML(`${base}/aviso-legal`)}" target="_blank" style="color:#64748b;text-decoration:underline">
                            Avís Legal
                        </a>

                        &nbsp;·&nbsp;

                        <a href="${escaparHTML(`${base}/politica-de-privacitat`)}" target="_blank" style="color:#64748b;text-decoration:underline">
                            Política de Privacitat
                        </a>

                        &nbsp;·&nbsp;

                        <a href="${escaparHTML(`${base}/politica-de-cookies`)}" target="_blank" style="color:#64748b;text-decoration:underline">
                            Política de Cookies
                        </a>
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
</html>`;
}

export async function notificarInscripcionVoluntarioEnviada(
    formularioID: string,
): Promise<ResultadoEmailVoluntario> {
    const datos = await cargarDatosEmail(formularioID);
    const lista = destinatarios(datos);

    const resultados = await Promise.allSettled(
        lista.map(destinatario =>
            enviarEmailApi({
                to: destinatario.email,
                subject:
                    `Sol·licitud de voluntariat rebuda · ` +
                    (datos.torneo.nombre?.trim() || "Esports IES Calvià"),
                html: crearHTML(datos, destinatario),
                origen: ORIGEN_EMAIL,
            }),
        ),
    );

    let enviados = 0;
    let fallidos = 0;

    resultados.forEach((resultado, indice) => {
        if (resultado.status === "fulfilled") {
            enviados += 1;
        } else {
            fallidos += 1;
            console.error(
                `No s'ha pogut enviar el correu de voluntariat a ${lista[indice]?.email}:`,
                resultado.reason,
            );
        }
    });

    return {
        destinatarios: lista.length,
        enviados,
        fallidos,
    };
}