import { enviarEmailApi } from "@utils/envioEmails";
import { supabaseAdmin } from "@utils/supabase";

// ============================================================
// CONFIGURACIÓN Y TIPOS
// ============================================================

const ORIGEN_EMAIL = "esports_iescalvia";

type DestinatarioEmail = {
    email: string;
    nombre: string;
    tipo: "RESPONSABLE" | "CAPITAN" | "SISTEMA";
};

type DatosEmail = {
    formulario: {
        id: string;
        edicion_id: string;
        usuario_id: string | null;
        email_contacto: string | null;
        acceso_capitan: boolean | null;
    };
    equipo: {
        id: string;
        nombre: string | null;
        escudo: string | null;
        capitan_id: string | null;
        plaza_estado: string | null;
    };
    edicion: { id: string; torneo_id: string; nombre: string | null };
    torneo: { id: string; nombre: string | null; logo: string | null; banner: string | null };
    responsable: { nombre: string | null; apellido1: string | null; apellido2: string | null } | null;
    capitan: { email: string | null; nombre: string | null; apellido1: string | null; apellido2: string | null } | null;
    contactos: Array<{ nombre: string | null; cargo: string | null; email: string | null }>;
};

export type ResultadoEmailPlazaConfirmada = {
    destinatarios: number;
    enviados: number;
    fallidos: number;
};

// ============================================================
// URL, EMAIL Y HTML
// ============================================================

function obtenerURLFrontend(): string {
    const valor = import.meta.env.URL_FRONTEND;
    if (typeof valor !== "string" || !valor.trim()) {
        throw new Error("Falta la variable d'entorn URL_FRONTEND.");
    }
    const base = valor.trim().replace(/\/+$/, "");
    try {
        const url = new URL(base);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    } catch {
        throw new Error("URL_FRONTEND no conté una URL vàlida.");
    }
    return base;
}

function urlAbsoluta(valor: string | null, base: string): string | null {
    if (!valor?.trim()) return null;
    const recurso = valor.trim();
    if (/^https?:\/\//i.test(recurso) || /^data:image\//i.test(recurso)) return recurso;
    return recurso.startsWith("/") ? `${base}${recurso}` : `${base}/${recurso}`;
}

function normalizarEmail(valor: string | null): string {
    return (valor ?? "").trim().toLowerCase();
}

function emailValido(valor: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
}

function escaparHTML(valor: string | null | undefined): string {
    return (valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function nombreCompleto(persona: {
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
}): string {
    return [persona.nombre, persona.apellido1, persona.apellido2]
        .filter((valor): valor is string => typeof valor === "string" && Boolean(valor.trim()))
        .map(valor => valor.trim())
        .join(" ");
}

// ============================================================
// CARGAR DATOS
// ============================================================

async function cargarDatosEmail(formularioID: string): Promise<DatosEmail> {
    const { data: formulario, error: errorFormulario } = await supabaseAdmin
        .from("formularios")
        .select("id,edicion_id,usuario_id,email_contacto,acceso_capitan")
        .eq("id", formularioID)
        .eq("tipo", "EQUIPO")
        .maybeSingle();
    if (errorFormulario) throw errorFormulario;
    if (!formulario) throw new Error("No s'ha trobat el formulari de l'equip.");

    const [resultadoEquipo, resultadoEdicion, resultadoContactos, resultadoResponsable] =
        await Promise.all([
            supabaseAdmin.from("equipos")
                .select("id,nombre,escudo,capitan_id,plaza_estado")
                .eq("formulario_id", formulario.id)
                .maybeSingle(),
            supabaseAdmin.from("ediciones")
                .select("id,torneo_id,nombre")
                .eq("id", formulario.edicion_id)
                .maybeSingle(),
            supabaseAdmin.from("contactos_soporte")
                .select("nombre,cargo,email")
                .eq("activo", true)
                .order("orden", { ascending: true, nullsFirst: false }),
            formulario.usuario_id
                ? supabaseAdmin.from("users")
                    .select("nombre,apellido1,apellido2")
                    .eq("id", formulario.usuario_id)
                    .maybeSingle()
                : Promise.resolve({ data: null, error: null }),
        ]);
    if (resultadoEquipo.error) throw resultadoEquipo.error;
    if (resultadoEdicion.error) throw resultadoEdicion.error;
    if (resultadoContactos.error) throw resultadoContactos.error;
    if (resultadoResponsable.error) throw resultadoResponsable.error;
    if (!resultadoEquipo.data || !resultadoEdicion.data) {
        throw new Error("No s'han trobat l'equip o l'edició de la inscripció.");
    }

    const equipo = resultadoEquipo.data;
    const edicion = resultadoEdicion.data;
    if (equipo.plaza_estado?.trim().toUpperCase() !== "CONFIRMADA") {
        throw new Error("El correu només es pot enviar quan la plaça està CONFIRMADA.");
    }

    const [resultadoTorneo, resultadoCapitan] = await Promise.all([
        supabaseAdmin.from("torneos")
            .select("id,nombre,logo,banner")
            .eq("id", edicion.torneo_id)
            .maybeSingle(),
        formulario.acceso_capitan === true && equipo.capitan_id
            ? supabaseAdmin.from("participantes_equipo")
                .select("email,nombre,apellido1,apellido2")
                .eq("id", equipo.capitan_id)
                .eq("equipo_id", equipo.id)
                .eq("activo", true)
                .eq("tipo_participante", "JUGADOR")
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);
    if (resultadoTorneo.error) throw resultadoTorneo.error;
    if (resultadoCapitan.error) throw resultadoCapitan.error;
    if (!resultadoTorneo.data) throw new Error("No s'ha trobat el torneig de la inscripció.");

    return {
        formulario,
        equipo,
        edicion,
        torneo: resultadoTorneo.data,
        responsable: resultadoResponsable.data,
        capitan: resultadoCapitan.data,
        contactos: resultadoContactos.data ?? [],
    };
}

// ============================================================
// DESTINATARIOS
// ============================================================

function obtenerDestinatarios(datos: DatosEmail): DestinatarioEmail[] {
    const destinatarios = new Map<string, DestinatarioEmail>();
    function añadir(emailRaw: string | null, nombre: string, tipo: DestinatarioEmail["tipo"]) {
        const email = normalizarEmail(emailRaw);
        if (!emailValido(email) || destinatarios.has(email)) return;
        destinatarios.set(email, { email, nombre, tipo });
    }

    añadir(
        datos.formulario.email_contacto,
        datos.responsable ? nombreCompleto(datos.responsable) || "Responsable de l'equip" : "Responsable de l'equip",
        "RESPONSABLE",
    );
    if (datos.formulario.acceso_capitan === true && datos.capitan) {
        añadir(datos.capitan.email, nombreCompleto(datos.capitan) || "Capità de l'equip", "CAPITAN");
    }
    for (const contacto of datos.contactos) {
        añadir(contacto.email, contacto.nombre?.trim() || contacto.cargo?.trim() || "Contacte del sistema", "SISTEMA");
    }
    return [...destinatarios.values()];
}

// ============================================================
// ASUNTO Y PLANTILLA
// ============================================================

function crearAsunto(datos: DatosEmail): string {
    return `Plaça confirmada · ${datos.equipo.nombre?.trim() || "Equip"} | ${datos.torneo.nombre?.trim() || "Esports IES Calvià"}`;
}

function crearHTML(datos: DatosEmail, destinatario: DestinatarioEmail): string {
    const base = obtenerURLFrontend();
    const nombreTorneo = escaparHTML(datos.torneo.nombre || "Esports IES Calvià");
    const nombreEdicion = escaparHTML(datos.edicion.nombre || "Edició");
    const nombreEquipo = escaparHTML(datos.equipo.nombre || "Equip sense nom");
    const registradoPor = escaparHTML(
        datos.responsable ? nombreCompleto(datos.responsable) || datos.formulario.email_contacto : datos.formulario.email_contacto,
    );
    const emailResponsable = escaparHTML(datos.formulario.email_contacto);
    const banner = urlAbsoluta(datos.torneo.banner, base);
    const logoEquipo = urlAbsoluta(datos.equipo.escudo, base) ?? urlAbsoluta(datos.torneo.logo, base);
    const urlInscripcion = `${base}/inscripcio?edicionID=${encodeURIComponent(datos.edicion.id)}`;
    const urlPanel = `${base}/panell/equips/${encodeURIComponent(datos.equipo.id)}?${new URLSearchParams({
        torneoID: datos.torneo.id,
        edicionID: datos.edicion.id,
    }).toString()}`;
    const urlDestino = destinatario.tipo === "SISTEMA" ? urlPanel : urlInscripcion;
    const textoFooter = destinatario.tipo === "SISTEMA"
        ? "Heu rebut aquest correu perquè esteu configurat com a contacte actiu del sistema Esports IES Calvià."
        : "Heu rebut aquest correu perquè sou responsable de la inscripció o teniu accés autoritzat al formulari de l'equip.";

    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="ca">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="format-detection" content="telephone=no">
    <title>Plaça confirmada</title>
    <!--[if (mso 16)]><style type="text/css">a { text-decoration:none; }</style><![endif]-->
    <!--[if gte mso 9]><style>sup { font-size:100% !important; }</style><![endif]-->
    <!--[if gte mso 9]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG></o:AllowPNG><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
    <style type="text/css">
        #outlook a { padding:0; }
        span.MsoHyperlink,span.MsoHyperlinkFollowed { color:inherit;mso-style-priority:99; }
        a.es-button { mso-style-priority:100!important;text-decoration:none!important; }
        a[x-apple-data-detectors],#MessageViewBody a { color:inherit!important;text-decoration:none!important;font-size:inherit!important;font-family:inherit!important;font-weight:inherit!important;line-height:inherit!important; }
        @media only screen and (max-width:600px) {
            .es-content,.es-header,.es-footer { width:100%!important;max-width:600px!important; }
            .es-content table,.es-header table,.es-footer table { width:100%!important; }
            .adapt-img { width:100%!important;height:auto!important; }
            .es-adapt-td { display:block!important;width:100%!important; }
            .es-m-p20b { padding-bottom:20px!important; }
        }
    </style>
</head>
<body style="width:100%;height:100%;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;padding:0;Margin:0;background-color:#f8f9ff">
<div dir="ltr" lang="ca" style="background-color:#f8f9ff">
<table width="100%" cellspacing="0" cellpadding="0" role="none" style="border-spacing:0;padding:0;Margin:0;width:100%;height:100%"><tbody><tr><td valign="top" align="center" style="padding:0;Margin:0">

    <!-- CABECERA -->
    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-header" role="none" style="border-spacing:0;width:600px;max-width:600px"><tbody>
        <tr><td bgcolor="#0b1c30" align="center" style="padding:24px 20px 18px;Margin:0;background-color:#0b1c30">
            <h3 style="Margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:26px;font-weight:bold;line-height:32px;color:#71F8E4;text-align:center">${nombreTorneo}</h3>
            <p style="Margin:6px 0 0 0;line-height:20px;color:#d3e4fe;font-size:13px;text-align:center">${nombreEdicion}</p>
            <h4 style="Margin:8px 0 0 0;font-size:22px;font-weight:normal;line-height:30px;color:#ffffff;text-align:center">Plaça confirmada</h4>
        </td></tr>
        ${banner ? `<tr><td bgcolor="#0b1c30" align="center" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30;font-size:0"><img src="${escaparHTML(banner)}" alt="${nombreTorneo}" width="560" class="adapt-img" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px"></td></tr>` : ""}
    </tbody></table>

    <!-- CONFIRMACIÓN -->
    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-content" role="none" style="border-spacing:0;width:600px;max-width:600px"><tbody>
        <tr><td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">
            <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0"><tbody><tr>
                <td align="center" bgcolor="#213145" style="padding:18px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">
                    <h3 style="Margin:0;font-family:Verdana,Geneva,sans-serif;font-size:25px;font-weight:normal;line-height:32px;color:#ffffff;text-align:center">La plaça de l'equip està confirmada</h3>
                    <p style="Margin:12px 0 0 0;font-family:Verdana,Geneva,sans-serif;line-height:21px;color:#d3e4fe;font-size:14px;text-align:center">L'equip ja té una plaça assignada per participar en aquesta edició del torneig.</p>
                </td>
            </tr></tbody></table>
        </td></tr>
    </tbody></table>

    <!-- EQUIPO -->
    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px"><tbody>
        <tr><td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">
            <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0"><tbody><tr>
                <td bgcolor="#213145" style="padding:20px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">
                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0"><tbody><tr>
                        ${logoEquipo ? `<td valign="middle" width="110" class="es-adapt-td es-m-p20b" style="padding:0 18px 0 0;Margin:0;width:110px"><img src="${escaparHTML(logoEquipo)}" alt="" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;outline:none;text-decoration:none"></td>` : ""}
                        <td valign="middle" class="es-adapt-td" style="padding:0;Margin:0">
                            <p style="Margin:0;font-size:24px;line-height:30px;color:#ffffff;font-weight:bold">${nombreEquipo}</p>
                            <p style="Margin:8px 0 0 0;font-size:16px;line-height:22px;color:#ffffff">Registrat per: <span style="color:#71F8E4;font-weight:bold">${registradoPor || "Usuari"}</span></p>
                            ${emailResponsable ? `<p style="Margin:4px 0 0 0;line-height:19px;color:#d3e4fe;font-size:13px">${emailResponsable}</p>` : ""}
                        </td>
                        <td valign="middle" align="right" width="105" class="es-adapt-td" style="padding:0;Margin:0;width:105px"><table align="right" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0;background-color:#0f766e;border-radius:999px"><tbody><tr><td style="padding:6px 12px;Margin:0"><p style="Margin:0;line-height:16px;color:#ffffff;font-size:10px;font-weight:bold;text-align:center;text-transform:uppercase">CONFIRMADA</p></td></tr></tbody></table></td>
                    </tr></tbody></table>
                </td>
            </tr></tbody></table>
        </td></tr>
    </tbody></table>

    <!-- BOTÓN -->
    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px"><tbody>
        <tr><td bgcolor="#0b1c30" align="center" style="padding:0 20px 24px;Margin:0;background-color:#0b1c30">
            <a href="${escaparHTML(urlDestino)}" target="_blank" style="text-decoration:none;color:#ffffff;font-size:14px;font-weight:bold;padding:14px 28px;display:inline-block;background-color:#0f766e;border-radius:12px;text-transform:uppercase">Veure informació de l'equip</a>
        </td></tr>
    </tbody></table>

    <!-- FOOTER -->
    <table cellspacing="0" cellpadding="0" align="center" width="600" class="es-footer" role="none" style="border-spacing:0;width:600px;max-width:600px"><tbody>
        <tr><td bgcolor="#0b1c30" align="center" style="padding:18px 20px 6px;Margin:0;background-color:#0b1c30"><p style="Margin:0;line-height:18px;color:#64748b;font-size:12px;text-align:center">©${new Date().getFullYear()} Esports IES Calvià | Tots els drets reservats.</p></td></tr>
        <tr><td bgcolor="#0b1c30" align="center" style="padding:8px 40px;Margin:0;background-color:#0b1c30"><p style="Margin:0;line-height:18px;color:#64748b;font-size:11px;text-align:center">${escaparHTML(textoFooter)}</p><p style="Margin:5px 0 0 0;line-height:18px;color:#64748b;font-size:11px;text-align:center"><a href="${escaparHTML(base)}" target="_blank" style="color:#14b8a6;text-decoration:underline">${escaparHTML(base)}</a></p></td></tr>
        <tr><td bgcolor="#0b1c30" align="center" style="padding:6px 30px 22px;Margin:0;background-color:#0b1c30"><p style="Margin:0;line-height:18px;color:#64748b;font-size:11px;text-align:center"><a href="${escaparHTML(`${base}/aviso-legal`)}" target="_blank" style="color:#64748b;text-decoration:underline">Avís Legal</a> &nbsp;·&nbsp; <a href="${escaparHTML(`${base}/politica-de-privacitat`)}" target="_blank" style="color:#64748b;text-decoration:underline">Política de Privacitat</a> &nbsp;·&nbsp; <a href="${escaparHTML(`${base}/politica-de-cookies`)}" target="_blank" style="color:#64748b;text-decoration:underline">Política de Cookies</a></p></td></tr>
    </tbody></table>

</td></tr></tbody></table>
</div>
</body>
</html>`;
}

// ============================================================
// ENVIAR
// ============================================================

export async function enviarNotificacionPlazaConfirmada(
    formularioID: string,
): Promise<ResultadoEmailPlazaConfirmada> {
    const datos = await cargarDatosEmail(formularioID);
    const destinatarios = obtenerDestinatarios(datos);
    if (destinatarios.length === 0) {
        return { destinatarios: 0, enviados: 0, fallidos: 0 };
    }

    const resultados = await Promise.allSettled(
        destinatarios.map(destinatario => enviarEmailApi({
            to: destinatario.email,
            subject: crearAsunto(datos),
            html: crearHTML(datos, destinatario),
            origen: ORIGEN_EMAIL,
        })),
    );

    let enviados = 0;
    let fallidos = 0;
    resultados.forEach((resultado, indice) => {
        const destinatario = destinatarios[indice];
        if (resultado.status === "fulfilled") {
            enviados += 1;
            console.info(`[EMAIL] PLAZA_CONFIRMADA enviado a ${destinatario?.tipo ?? "DESCONOCIDO"} (${destinatario?.email ?? "sin-email"}).`);
        } else {
            fallidos += 1;
            console.error(`[EMAIL] Error enviando PLAZA_CONFIRMADA a ${destinatario?.tipo ?? "DESCONOCIDO"} (${destinatario?.email ?? "sin-email"}):`, resultado.reason);
        }
    });
    return { destinatarios: destinatarios.length, enviados, fallidos };
}