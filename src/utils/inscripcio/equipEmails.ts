import { enviarEmailApi } from "@utils/envioEmails";
import { supabaseAdmin } from "@utils/supabase";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ORIGEN_EMAIL =
    "esports_iescalvia";

const ESTADO_ENVIO =
    "EN_REVISION";

// ============================================================
// TIPOS
// ============================================================

type TipoNotificacion =
    | "PRIMER_ENVIO"
    | "REENVIO";

type TipoDestinatario =
    | "RESPONSABLE"
    | "CAPITAN"
    | "SISTEMA";

type FormularioEmailDB = {
    id: string;
    edicion_id: string;
    usuario_id: string | null;
    email_contacto: string | null;
    acceso_capitan: boolean | null;
    estado: string | null;
    enviado_at: string | null;
};

type EquipoEmailDB = {
    id: string;
    formulario_id: string;
    nombre: string | null;
    escudo: string | null;
    capitan_id: string | null;
};

type EdicionEmailDB = {
    id: string;
    torneo_id: string;
    nombre: string | null;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
};

type TorneoEmailDB = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    logo: string | null;
    banner: string | null;
};

type UsuarioEmailDB = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
};

type ParticipanteEmailDB = {
    id: string;
    equipo_id: string;
    tipo_participante: string | null;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    grupo: string | null;
    genero: string | null;
    orden: number | null;
    activo: boolean;
};

type ContactoSistemaDB = {
    id: string;
    nombre: string | null;
    cargo: string | null;
    email: string | null;
    activo: boolean;
    orden: number | null;
};

type ObservacionDB = {
    id: string;
    formulario_id: string | null;
    estado: string | null;
};

type DestinatarioEmail = {
    email: string;
    nombre: string;
    tipo: TipoDestinatario;
};

type DatosEmailInscripcion = {
    formulario:
        FormularioEmailDB;

    equipo:
        EquipoEmailDB;

    edicion:
        EdicionEmailDB;

    torneo:
        TorneoEmailDB;

    responsable:
        UsuarioEmailDB | null;

    participantes:
        ParticipanteEmailDB[];

    contactos:
        ContactoSistemaDB[];

    tipoNotificacion:
        TipoNotificacion;
};

export type ResultadoEmailInscripcion = {
    destinatarios: number;
    enviados: number;
    fallidos: number;
    tipo: TipoNotificacion;
};

// ============================================================
// URL FRONTEND
// ============================================================

function obtenerURLFrontend() {
    const valor =
        import.meta.env
            .URL_FRONTEND;

    if (
        typeof valor !==
            "string" ||
        !valor.trim()
    ) {
        throw new Error(
            "Falta la variable d'entorn URL_FRONTEND.",
        );
    }

    const base =
        valor
            .trim()
            .replace(
                /\/+$/,
                "",
            );

    try {
        const url =
            new URL(
                base,
            );

        if (
            url.protocol !==
                "https:" &&
            url.protocol !==
                "http:"
        ) {
            throw new Error();
        }
    } catch {
        throw new Error(
            "URL_FRONTEND no conté una URL vàlida.",
        );
    }

    return base;
}

// ============================================================
// URL ABSOLUTA
// ============================================================

function urlAbsoluta(
    valor: string | null,
    base: string,
) {
    if (
        !valor ||
        !valor.trim()
    ) {
        return null;
    }

    const recurso =
        valor.trim();

    if (
        /^https?:\/\//i.test(
            recurso,
        ) ||
        /^data:image\//i.test(
            recurso,
        )
    ) {
        return recurso;
    }

    if (
        recurso.startsWith(
            "/",
        )
    ) {
        return `${base}${recurso}`;
    }

    return `${base}/${recurso}`;
}

// ============================================================
// EMAIL
// ============================================================

function normalizarEmail(
    valor: string | null,
) {
    return (
        valor ??
        ""
    )
        .trim()
        .toLowerCase();
}

function emailValido(
    valor: string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        valor,
    );
}

// ============================================================
// HTML
// ============================================================

function escaparHTML(
    valor:
        | string
        | null
        | undefined,
) {
    return (
        valor ??
        ""
    )
        .replaceAll(
            "&",
            "&amp;",
        )
        .replaceAll(
            "<",
            "&lt;",
        )
        .replaceAll(
            ">",
            "&gt;",
        )
        .replaceAll(
            "\"",
            "&quot;",
        )
        .replaceAll(
            "'",
            "&#039;",
        );
}

// ============================================================
// NOMBRE
// ============================================================

function nombreCompleto(
    persona: {
        nombre:
            string | null;

        apellido1:
            string | null;

        apellido2:
            string | null;
    },
) {
    return [
        persona.nombre,
        persona.apellido1,
        persona.apellido2,
    ]
        .filter(
            (
                valor,
            ): valor is string =>
                typeof valor ===
                    "string" &&
                Boolean(
                    valor.trim(),
                ),
        )
        .map(
            valor =>
                valor.trim(),
        )
        .join(
            " ",
        );
}

// ============================================================
// TIPO PARTICIPANTE
// ============================================================

function textoTipoParticipante(
    tipo:
        string | null,
) {
    switch (
        tipo
            ?.trim()
            .toUpperCase()
    ) {
        case "PROFESOR":
            return "Professor/a";

        case "ENTRENADOR":
            return "Entrenador/a";

        case "STAFF":
            return "Staff";

        default:
            return "Jugador/a";
    }
}

// ============================================================
// CURSO
// ============================================================

function textoCurso(
    participante:
        ParticipanteEmailDB,
) {
    const datos = [
        participante.curso,
        participante.grupo,
    ]
        .filter(
            (
                valor,
            ): valor is string =>
                typeof valor ===
                    "string" &&
                Boolean(
                    valor.trim(),
                ),
        )
        .map(
            valor =>
                valor.trim(),
        );

    if (
        datos.length >
        0
    ) {
        return datos.join(
            " · ",
        );
    }

    return textoTipoParticipante(
        participante.tipo_participante,
    );
}

// ============================================================
// TIPO DE NOTIFICACIÓN
// ============================================================

function determinarTipoNotificacion(
    observaciones:
        ObservacionDB[],
): TipoNotificacion {
    const hayCorreccionesActivas =
        observaciones.some(
            observacion =>
                (
                    observacion.estado ??
                    ""
                )
                    .trim()
                    .toUpperCase() !==
                "RESUELTA",
        );

    return hayCorreccionesActivas
        ? "REENVIO"
        : "PRIMER_ENVIO";
}

// ============================================================
// CARGAR DATOS
// ============================================================

async function cargarDatosEmail(
    formularioID: string,
): Promise<DatosEmailInscripcion> {
    // ========================================================
    // FORMULARIO
    // ========================================================

    const {
        data:
            formulario,

        error:
            errorFormulario,
    } =
        await supabaseAdmin
            .from(
                "formularios",
            )
            .select(
                "id,edicion_id,usuario_id,email_contacto,acceso_capitan,estado,enviado_at",
            )
            .eq(
                "id",
                formularioID,
            )
            .eq(
                "tipo",
                "EQUIPO",
            )
            .maybeSingle();

    if (
        errorFormulario
    ) {
        throw errorFormulario;
    }

    if (
        !formulario
    ) {
        throw new Error(
            "No s'ha trobat el formulari de la inscripció.",
        );
    }

    const formularioDB =
        formulario as
            FormularioEmailDB;

    // ========================================================
    // EQUIPO + EDICIÓN + OBSERVACIONES
    // ========================================================

    const [
        resultadoEquipo,
        resultadoEdicion,
        resultadoObservaciones,
    ] =
        await Promise.all([
            supabaseAdmin
                .from(
                    "equipos",
                )
                .select(
                    "id,formulario_id,nombre,escudo,capitan_id",
                )
                .eq(
                    "formulario_id",
                    formularioDB.id,
                )
                .maybeSingle(),

            supabaseAdmin
                .from(
                    "ediciones",
                )
                .select(
                    "id,torneo_id,nombre,sede,fecha_inicio,fecha_fin",
                )
                .eq(
                    "id",
                    formularioDB.edicion_id,
                )
                .maybeSingle(),

            supabaseAdmin
                .from(
                    "observaciones_campos",
                )
                .select(
                    "id,formulario_id,estado",
                )
                .eq(
                    "formulario_id",
                    formularioDB.id,
                ),
        ]);

    if (
        resultadoEquipo.error
    ) {
        throw resultadoEquipo.error;
    }

    if (
        resultadoEdicion.error
    ) {
        throw resultadoEdicion.error;
    }

    if (
        resultadoObservaciones.error
    ) {
        throw resultadoObservaciones.error;
    }

    if (
        !resultadoEquipo.data ||
        !resultadoEdicion.data
    ) {
        throw new Error(
            "No s'han pogut carregar les dades de la inscripció.",
        );
    }

    const equipo =
        resultadoEquipo.data as
            EquipoEmailDB;

    const edicion =
        resultadoEdicion.data as
            EdicionEmailDB;

    const observaciones =
        (
            resultadoObservaciones.data ??
            []
        ) as ObservacionDB[];

    // ========================================================
    // TORNEO + PARTICIPANTES + CONTACTOS + RESPONSABLE
    // ========================================================

    const [
        resultadoTorneo,
        resultadoParticipantes,
        resultadoContactos,
        resultadoResponsable,
    ] =
        await Promise.all([
            supabaseAdmin
                .from(
                    "torneos",
                )
                .select(
                    "id,nombre,deporte,logo,banner",
                )
                .eq(
                    "id",
                    edicion.torneo_id,
                )
                .maybeSingle(),

            supabaseAdmin
                .from(
                    "participantes_equipo",
                )
                .select(
                    "id,equipo_id,tipo_participante,nombre,apellido1,apellido2,email,curso,grupo,genero,orden,activo",
                )
                .eq(
                    "equipo_id",
                    equipo.id,
                )
                .eq(
                    "activo",
                    true,
                )
                .order(
                    "orden",
                    {
                        ascending:
                            true,

                        nullsFirst:
                            false,
                    },
                ),

            supabaseAdmin
                .from(
                    "contactos_soporte",
                )
                .select(
                    "id,nombre,cargo,email,activo,orden",
                )
                .eq(
                    "activo",
                    true,
                )
                .order(
                    "orden",
                    {
                        ascending:
                            true,

                        nullsFirst:
                            false,
                    },
                ),

            formularioDB.usuario_id
                ? supabaseAdmin
                      .from(
                          "users",
                      )
                      .select(
                          "id,nombre,apellido1,apellido2,email",
                      )
                      .eq(
                          "id",
                          formularioDB.usuario_id,
                      )
                      .maybeSingle()
                : Promise.resolve({
                      data:
                          null,

                      error:
                          null,
                  }),
        ]);

    if (
        resultadoTorneo.error
    ) {
        throw resultadoTorneo.error;
    }

    if (
        resultadoParticipantes.error
    ) {
        throw resultadoParticipantes.error;
    }

    if (
        resultadoContactos.error
    ) {
        throw resultadoContactos.error;
    }

    if (
        resultadoResponsable.error
    ) {
        throw resultadoResponsable.error;
    }

    if (
        !resultadoTorneo.data
    ) {
        throw new Error(
            "No s'ha trobat el torneig de la inscripció.",
        );
    }

    return {
        formulario:
            formularioDB,

        equipo,

        edicion,

        torneo:
            resultadoTorneo.data as
                TorneoEmailDB,

        responsable:
            resultadoResponsable.data
                ? resultadoResponsable.data as
                      UsuarioEmailDB
                : null,

        participantes:
            (
                resultadoParticipantes.data ??
                []
            ) as ParticipanteEmailDB[],

        contactos:
            (
                resultadoContactos.data ??
                []
            ) as ContactoSistemaDB[],

        tipoNotificacion:
            determinarTipoNotificacion(
                observaciones,
            ),
    };
}

// ============================================================
// DESTINATARIOS
// ============================================================

function obtenerDestinatarios(
    datos:
        DatosEmailInscripcion,
) {
    const destinatarios =
        new Map<
            string,
            DestinatarioEmail
        >();

    function añadir(
        destinatario:
            DestinatarioEmail,
    ) {
        const email =
            normalizarEmail(
                destinatario.email,
            );

        if (
            !email ||
            !emailValido(
                email,
            ) ||
            destinatarios.has(
                email,
            )
        ) {
            return;
        }

        destinatarios.set(
            email,
            {
                ...destinatario,

                email,
            },
        );
    }

    // ========================================================
    // RESPONSABLE
    // ========================================================

    const emailResponsable =
        normalizarEmail(
            datos.formulario
                .email_contacto,
        );

    if (
        emailResponsable
    ) {
        añadir({
            email:
                emailResponsable,

            nombre:
                datos.responsable
                    ? nombreCompleto(
                          datos.responsable,
                      ) ||
                      "Responsable de l'equip"
                    : "Responsable de l'equip",

            tipo:
                "RESPONSABLE",
        });
    }

    // ========================================================
    // CAPITÁN
    // ========================================================

    if (
        datos.formulario
            .acceso_capitan ===
            true &&
        datos.equipo
            .capitan_id
    ) {
        const capitan =
            datos.participantes.find(
                participante =>
                    participante.id ===
                        datos.equipo
                            .capitan_id &&
                    participante
                        .tipo_participante
                        ?.trim()
                        .toUpperCase() ===
                        "JUGADOR",
            );

        if (
            capitan &&
            capitan.email
        ) {
            añadir({
                email:
                    capitan.email,

                nombre:
                    nombreCompleto(
                        capitan,
                    ) ||
                    "Capità de l'equip",

                tipo:
                    "CAPITAN",
            });
        }
    }

    // ========================================================
    // CONTACTOS DEL SISTEMA
    // ========================================================

    for (
        const contacto
        of datos.contactos
    ) {
        if (
            !contacto.email
        ) {
            continue;
        }

        añadir({
            email:
                contacto.email,

            nombre:
                contacto.nombre
                    ?.trim() ||
                contacto.cargo
                    ?.trim() ||
                "Contacte del sistema",

            tipo:
                "SISTEMA",
        });
    }

    return [
        ...destinatarios.values(),
    ];
}

// ============================================================
// FILAS PARTICIPANTES
// ============================================================

function filasParticipantes(
    participantes:
        ParticipanteEmailDB[],
    capitanID:
        string | null,
) {
    if (
        participantes.length ===
        0
    ) {
        return `
            <tr>
                <td colspan="2" style="padding:16px;Margin:0;color:#94a3b8;font-size:13px;font-style:italic;text-align:center">
                    No hi ha participants registrats
                </td>
            </tr>
        `;
    }

    return participantes
        .map(
            participante => {
                const esCapitan =
                    participante.id ===
                    capitanID;

                const nombre =
                    escaparHTML(
                        nombreCompleto(
                            participante,
                        ) ||
                        "Sense nom",
                    );

                const email =
                    escaparHTML(
                        participante.email,
                    );

                const curso =
                    escaparHTML(
                        textoCurso(
                            participante,
                        ),
                    );

                return `
                    <tr${esCapitan ? ' style="background-color:#14b8a61a"' : ""}>
                        <td style="padding:10px;Margin:0;border-bottom:1px solid #3e4947">
                            <span style="font-size:13px;color:${esCapitan ? "#71F8E4" : "#f8f9ff"};font-weight:${esCapitan ? "bold" : "normal"}">
                                ${nombre}
                            </span>

                            ${
                                esCapitan
                                    ? `
                                        <span style="font-weight:bold;text-transform:uppercase;margin-left:6px;font-size:9px;background:#0f766e;color:#ffffff;padding:2px 6px;border-radius:20px">
                                            Capità
                                        </span>
                                    `
                                    : ""
                            }

                            ${
                                email
                                    ? `
                                        <div style="margin-top:2px;font-size:11px;color:#d3e4fe">
                                            ${email}
                                        </div>
                                    `
                                    : ""
                            }
                        </td>

                        <td style="padding:10px;Margin:0;border-bottom:1px solid #3e4947;color:#f8f9ff;font-size:12px">
                            ${curso}
                        </td>
                    </tr>
                `;
            },
        )
        .join(
            "",
        );
}

// ============================================================
// PERSONAS EN CARDS
// ============================================================

function contenidoCardPersonas(
    participantes:
        ParticipanteEmailDB[],
    textoVacio: string,
) {
    if (
        participantes.length ===
        0
    ) {
        return `
            <p style="Margin:6px 0 0 0;line-height:21px;color:#94a3b8;font-size:14px;font-style:italic;font-weight:bold">
                ${escaparHTML(textoVacio)}
            </p>
        `;
    }

    return participantes
        .map(
            participante => `
                <div style="margin-top:6px">
                    <p style="Margin:0;line-height:21px;color:#f8f9ff;font-size:14px;font-weight:bold">
                        ${escaparHTML(nombreCompleto(participante) || "Sense nom")}
                    </p>

                    ${
                        participante.email
                            ? `
                                <p style="Margin:2px 0 0 0;line-height:17px;color:#d3e4fe;font-size:11px">
                                    ${escaparHTML(participante.email)}
                                </p>
                            `
                            : ""
                    }
                </div>
            `,
        )
        .join(
            "",
        );
}

// ============================================================
// ASUNTO
// ============================================================

function crearAsunto(
    datos:
        DatosEmailInscripcion,
) {
    const equipo =
        datos.equipo
            .nombre
            ?.trim() ||
        "Equip";

    const torneo =
        datos.torneo
            .nombre
            ?.trim() ||
        "Esports IES Calvià";

    if (
        datos.tipoNotificacion ===
        "REENVIO"
    ) {
        return `Inscripció reenviada · ${equipo} | ${torneo}`;
    }

    return `Confirmació d'inscripció · ${equipo} | ${torneo}`;
}

// ============================================================
// HTML
// ============================================================

function crearHTMLInscripcion({
    datos,
    destinatario,
}: {
    datos:
        DatosEmailInscripcion;

    destinatario:
        DestinatarioEmail;
}) {
    const base =
        obtenerURLFrontend();

    const nombreTorneo =
        escaparHTML(
            datos.torneo.nombre ||
            "Esports IES Calvià",
        );

    const nombreEdicion =
        escaparHTML(
            datos.edicion.nombre ||
            "Edició",
        );

    const nombreEquipo =
        escaparHTML(
            datos.equipo.nombre ||
            "Equip sense nom",
        );

    const nombreResponsable =
        datos.responsable
            ? nombreCompleto(
                  datos.responsable,
              )
            : "";

    const registradoPor =
        escaparHTML(
            nombreResponsable ||
            datos.formulario
                .email_contacto ||
            "Usuari",
        );

    const emailResponsable =
        escaparHTML(
            datos.formulario
                .email_contacto,
        );

    const banner =
        urlAbsoluta(
            datos.torneo.banner,
            base,
        );

    const logoEquipo =
        urlAbsoluta(
            datos.equipo.escudo,
            base,
        ) ??
        urlAbsoluta(
            datos.torneo.logo,
            base,
        );

    const jugadores =
        datos.participantes.filter(
            participante =>
                participante
                    .tipo_participante
                    ?.trim()
                    .toUpperCase() ===
                "JUGADOR",
        );

    const entrenadores =
        datos.participantes.filter(
            participante =>
                participante
                    .tipo_participante
                    ?.trim()
                    .toUpperCase() ===
                "ENTRENADOR",
        );

    const profesores =
        datos.participantes.filter(
            participante =>
                participante
                    .tipo_participante
                    ?.trim()
                    .toUpperCase() ===
                "PROFESOR",
        );

    const cuerpoTecnico =
        datos.participantes.filter(
            participante => {
                const tipo =
                    participante
                        .tipo_participante
                        ?.trim()
                        .toUpperCase();

                return (
                    tipo ===
                        "ENTRENADOR" ||
                    tipo ===
                        "PROFESOR" ||
                    tipo ===
                        "STAFF"
                );
            },
        );

    const urlInscripcion =
        `${base}/inscripcio?edicionID=${encodeURIComponent(datos.edicion.id)}`;

    const urlPanel =
        `${base}/panell/equips/${encodeURIComponent(datos.equipo.id)}?${new URLSearchParams({
            torneoID:
                datos.torneo.id,

            edicionID:
                datos.edicion.id,
        }).toString()}`;

    const urlDestino =
        destinatario.tipo ===
            "SISTEMA"
            ? urlPanel
            : urlInscripcion;

    const urlLegal =
        `${base}/aviso-legal`;

    const urlPrivacidad =
        `${base}/politica-de-privacitat`;

    const urlCookies =
        `${base}/politica-de-cookies`;

    const esReenvio =
        datos.tipoNotificacion ===
        "REENVIO";

    const tituloConfirmacion =
        esReenvio
            ? "Inscripció reenviada correctament"
            : "Inscripció completada correctament";

    const textoConfirmacion =
        esReenvio
            ? "Hem rebut de nou la informació de l'equip després de les correccions realitzades. La inscripció torna a estar pendent de revisió per part de l'organització."
            : "Hem rebut la inscripció del vostre equip correctament. La informació enviada està actualment pendent de revisió per part de l'organització.";

    const textoFooter =
        destinatario.tipo ===
            "SISTEMA"
            ? "Heu rebut aquest correu perquè esteu configurat com a contacte actiu del sistema Esports IES Calvià."
            : "Heu rebut aquest correu perquè sou responsable de la inscripció o teniu accés autoritzat al formulari de l'equip.";

    const año =
        new Date()
            .getFullYear();

    return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html dir="ltr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns="http://www.w3.org/1999/xhtml" lang="ca">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="format-detection" content="telephone=no">

    <title>${esReenvio ? "Inscripció reenviada" : "Confirmació d'inscripció"}</title>

    <!--[if (mso 16)]>
    <style type="text/css">
        a { text-decoration:none; }
    </style>
    <![endif]-->

    <!--[if gte mso 9]>
    <style>
        sup { font-size:100% !important; }
    </style>
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

            .adapt-img {
                width:100%!important;
                height:auto!important;
            }

            .es-adapt-td {
                display:block!important;
                width:100%!important;
            }

            .es-m-p20b {
                padding-bottom:20px!important;
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

                    <h3 style="Margin:0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:26px;font-style:normal;font-weight:bold;line-height:32px;color:#71F8E4;text-align:center">
                        ${nombreTorneo}
                    </h3>

                    <p style="Margin:6px 0 0 0;line-height:20px;color:#d3e4fe;font-size:13px;text-align:center">
                        ${nombreEdicion}
                    </p>

                    <h4 style="Margin:8px 0 0 0;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;font-size:22px;font-style:normal;font-weight:normal;line-height:30px;color:#ffffff;text-align:center">
                        ${esReenvio ? "Inscripció reenviada" : "Confirmació d'inscripció"}
                    </h4>

                </td>
            </tr>

            ${
                banner
                    ? `
                        <tr>
                            <td bgcolor="#0b1c30" align="center" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30;font-size:0">
                                <img src="${escaparHTML(banner)}" alt="${nombreTorneo}" width="560" class="adapt-img" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;text-decoration:none;border-radius:12px">
                            </td>
                        </tr>
                    `
                    : ""
            }

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

                                    <h3 style="Margin:0;font-family:Verdana,Geneva,sans-serif;font-size:25px;font-style:normal;font-weight:normal;line-height:32px;color:#ffffff;text-align:center">
                                        ${tituloConfirmacion}
                                    </h3>

                                    <p style="Margin:12px 0 0 0;font-family:Verdana,Geneva,sans-serif;line-height:21px;color:#d3e4fe;font-size:14px;text-align:center">
                                        ${textoConfirmacion}
                                    </p>

                                </td>
                            </tr>
                        </tbody>
                    </table>

                </td>
            </tr>
        </tbody>
    </table>

    <!-- EQUIPO -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px">
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

                                                ${
                                                    logoEquipo
                                                        ? `
                                                            <td valign="middle" width="110" class="es-adapt-td es-m-p20b" style="padding:0 18px 0 0;Margin:0;width:110px">
                                                                <img src="${escaparHTML(logoEquipo)}" alt="" width="96" style="display:block;width:96px;max-width:96px;height:auto;border:0;outline:none;text-decoration:none">
                                                            </td>
                                                        `
                                                        : ""
                                                }

                                                <td valign="middle" class="es-adapt-td" style="padding:0;Margin:0">

                                                    <p style="Margin:0;font-size:24px;line-height:30px;color:#ffffff;font-weight:bold">
                                                        ${nombreEquipo}
                                                    </p>

                                                    <p style="Margin:8px 0 0 0;font-size:16px;line-height:22px;color:#ffffff">
                                                        Registrat per:
                                                        <span style="color:#71F8E4;font-weight:bold">
                                                            ${registradoPor}
                                                        </span>
                                                    </p>

                                                    ${
                                                        emailResponsable
                                                            ? `
                                                                <p style="Margin:4px 0 0 0;line-height:19px;color:#d3e4fe;font-size:13px">
                                                                    ${emailResponsable}
                                                                </p>
                                                            `
                                                            : ""
                                                    }

                                                </td>

                                                <td valign="middle" align="right" width="105" class="es-adapt-td" style="padding:0;Margin:0;width:105px">

                                                    <table align="right" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0;background-color:#0f766e;border-radius:999px">
                                                        <tbody>
                                                            <tr>
                                                                <td style="padding:6px 12px;Margin:0">

                                                                    <p style="Margin:0;line-height:16px;color:#ffffff;font-size:10px;font-weight:bold;text-align:center;text-transform:uppercase">
                                                                        EN REVISIÓ
                                                                    </p>

                                                                </td>
                                                            </tr>
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

                </td>
            </tr>
        </tbody>
    </table>

    <!-- ENTRENADOR / PROFESORADO -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">

                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>
                            <tr>

                                <td valign="top" width="270" class="es-adapt-td es-m-p20b" style="padding:0 10px 0 0;Margin:0;width:270px">

                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>
                                            <tr>
                                                <td bgcolor="#213145" style="padding:16px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">

                                                    <p style="Margin:0;line-height:15px;letter-spacing:1px;color:#d3e4fe;font-size:10px;text-transform:uppercase;font-weight:bold">
                                                        Entrenador/a
                                                    </p>

                                                    ${contenidoCardPersonas(
                                                        entrenadores,
                                                        "Sense entrenador/a",
                                                    )}

                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                </td>

                                <td valign="top" width="270" class="es-adapt-td" style="padding:0 0 0 10px;Margin:0;width:270px">

                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>
                                            <tr>
                                                <td bgcolor="#213145" style="padding:16px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-radius:12px">

                                                    <p style="Margin:0;line-height:15px;letter-spacing:1px;color:#d3e4fe;font-size:10px;text-transform:uppercase;font-weight:bold">
                                                        Professorat
                                                    </p>

                                                    ${contenidoCardPersonas(
                                                        profesores,
                                                        "Sense professor/a",
                                                    )}

                                                </td>
                                            </tr>
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

    <!-- JUGADORES -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">

                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>

                            <tr>
                                <td bgcolor="#213145" style="padding:14px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-bottom:none;border-radius:12px 12px 0 0">

                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>
                                            <tr>

                                                <td style="padding:0;Margin:0;font-size:16px;color:#ffffff;font-weight:bold">
                                                    Llista de jugadors
                                                </td>

                                                <td align="right" style="padding:0;Margin:0;color:#d3e4fe;font-weight:bold;font-size:11px">
                                                    ${jugadores.length} TOTAL
                                                </td>

                                            </tr>
                                        </tbody>
                                    </table>

                                </td>
                            </tr>

                            <tr>
                                <td bgcolor="#213145" style="padding:10px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-top:none;border-radius:0 0 12px 12px">

                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>

                                            <tr>
                                                <td style="padding:8px;Margin:0;text-transform:uppercase;font-size:10px;color:#94a3b8">
                                                    Nom complet
                                                </td>

                                                <td style="padding:8px;Margin:0;text-transform:uppercase;font-size:10px;color:#94a3b8">
                                                    Curs
                                                </td>
                                            </tr>

                                            ${filasParticipantes(
                                                jugadores,
                                                datos.equipo.capitan_id,
                                            )}

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

    <!-- CUERPO TÉCNICO -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="left" style="padding:0 20px 20px;Margin:0;background-color:#0b1c30">

                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                        <tbody>

                            <tr>
                                <td bgcolor="#213145" style="padding:14px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-bottom:none;border-radius:12px 12px 0 0">

                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>
                                            <tr>

                                                <td style="padding:0;Margin:0;font-size:16px;color:#ffffff;font-weight:bold">
                                                    Cos tècnic
                                                </td>

                                                <td align="right" style="padding:0;Margin:0;color:#d3e4fe;font-weight:bold;font-size:11px">
                                                    ${cuerpoTecnico.length} TOTAL
                                                </td>

                                            </tr>
                                        </tbody>
                                    </table>

                                </td>
                            </tr>

                            <tr>
                                <td bgcolor="#213145" style="padding:10px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-top:none;border-radius:0 0 12px 12px">

                                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="border-spacing:0">
                                        <tbody>

                                            <tr>
                                                <td style="padding:8px;Margin:0;text-transform:uppercase;font-size:10px;color:#94a3b8">
                                                    Nom complet
                                                </td>

                                                <td style="padding:8px;Margin:0;text-transform:uppercase;font-size:10px;color:#94a3b8">
                                                    Funció / Curs
                                                </td>
                                            </tr>

                                            ${filasParticipantes(
                                                cuerpoTecnico,
                                                datos.equipo.capitan_id,
                                            )}

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

    <!-- BOTÓN -->

    <table cellspacing="0" cellpadding="0" align="center" width="600" role="none" style="border-spacing:0;width:600px;max-width:600px">
        <tbody>
            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:0 20px 24px;Margin:0;background-color:#0b1c30">

                    <a href="${escaparHTML(urlDestino)}" target="_blank" style="text-decoration:none;color:#ffffff;font-size:14px;font-weight:bold;padding:14px 28px;display:inline-block;background-color:#0f766e;border-radius:12px;text-transform:uppercase">
                        Veure informació de l'equip
                    </a>

                    <table width="100%" cellspacing="0" cellpadding="0" role="presentation" style="margin-top:20px;border-spacing:0">
                        <tbody>
                            <tr>
                                <td bgcolor="#213145" style="padding:14px;Margin:0;background-color:#213145;border:1px solid #3e4947;border-left:4px solid #14b8a6;border-radius:8px">

                                    <p style="Margin:0;line-height:20px;color:#d3e4fe;font-size:13px;text-align:center">
                                        L'organització revisarà la inscripció pròximament. Quan l'estat canviï, rebreu una nova notificació.
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
                        ©${año} Esports IES Calvià | Tots els drets reservats.
                    </p>

                </td>
            </tr>

            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:8px 40px;Margin:0;background-color:#0b1c30">

                    <p style="Margin:0;line-height:18px;color:#64748b;font-size:11px;text-align:center">
                        ${escaparHTML(textoFooter)}
                    </p>

                    <p style="Margin:5px 0 0 0;line-height:18px;color:#64748b;font-size:11px;text-align:center">
                        <a href="${escaparHTML(base)}" target="_blank" style="color:#14b8a6;text-decoration:underline">
                            ${escaparHTML(base)}
                        </a>
                    </p>

                </td>
            </tr>

            <tr>
                <td bgcolor="#0b1c30" align="center" style="padding:6px 30px 22px;Margin:0;background-color:#0b1c30">

                    <p style="Margin:0;line-height:18px;color:#64748b;font-size:11px;text-align:center">

                        <a href="${escaparHTML(urlLegal)}" target="_blank" style="color:#64748b;text-decoration:underline">
                            Avís Legal
                        </a>

                        &nbsp;·&nbsp;

                        <a href="${escaparHTML(urlPrivacidad)}" target="_blank" style="color:#64748b;text-decoration:underline">
                            Política de Privacitat
                        </a>

                        &nbsp;·&nbsp;

                        <a href="${escaparHTML(urlCookies)}" target="_blank" style="color:#64748b;text-decoration:underline">
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
</html>
    `;
}

// ============================================================
// ENVIAR
// ============================================================

export async function notificarInscripcionEquipoEnviada(
    formularioID: string,
): Promise<ResultadoEmailInscripcion> {
    const datos =
        await cargarDatosEmail(
            formularioID,
        );

    // ========================================================
    // COMPROBAR ESTADO
    // ========================================================

    if (
        datos.formulario
            .estado
            ?.trim()
            .toUpperCase() !==
        ESTADO_ENVIO
    ) {
        throw new Error(
            "El correu d'inscripció només es pot enviar quan el formulari està EN_REVISION.",
        );
    }

    // ========================================================
    // DESTINATARIOS
    // ========================================================

    const destinatarios =
        obtenerDestinatarios(
            datos,
        );

    if (
        destinatarios.length ===
        0
    ) {
        return {
            destinatarios:
                0,

            enviados:
                0,

            fallidos:
                0,

            tipo:
                datos.tipoNotificacion,
        };
    }

    // ========================================================
    // ENVÍOS
    // ========================================================

    /*
     * Cada correo se envía individualmente.
     *
     * Así:
     *
     * - no mostramos otros destinatarios;
     * - podemos usar enlaces diferentes para sistema/usuario;
     * - un error no impide intentar el resto.
     */

    const resultados =
        await Promise.allSettled(
            destinatarios.map(
                destinatario =>
                    enviarEmailApi({
                        to:
                            destinatario.email,

                        subject:
                            crearAsunto(
                                datos,
                            ),

                        html:
                            crearHTMLInscripcion({
                                datos,
                                destinatario,
                            }),

                        origen:
                            ORIGEN_EMAIL,
                    }),
            ),
        );

    let enviados =
        0;

    let fallidos =
        0;

    resultados.forEach(
        (
            resultado,
            indice,
        ) => {
            const destinatario =
                destinatarios[
                    indice
                ];

            if (
                resultado.status ===
                "fulfilled"
            ) {
                enviados +=
                    1;

                console.info(
                    `[EMAIL] ${datos.tipoNotificacion} enviado a ${destinatario?.tipo ?? "DESCONOCIDO"} (${destinatario?.email ?? "sin-email"}).`,
                );

                return;
            }

            fallidos +=
                1;

            console.error(
                `[EMAIL] Error enviando ${datos.tipoNotificacion} a ${destinatario?.tipo ?? "DESCONOCIDO"} (${destinatario?.email ?? "sin-email"}):`,
                resultado.reason,
            );
        },
    );

    return {
        destinatarios:
            destinatarios.length,

        enviados,

        fallidos,

        tipo:
            datos.tipoNotificacion,
    };
}