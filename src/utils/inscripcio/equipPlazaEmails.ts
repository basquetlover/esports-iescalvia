import { enviarEmailApi } from "@utils/envioEmails";
import { supabaseAdmin } from "@utils/supabase";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ORIGEN_EMAIL =
    "esports_iescalvia";

const ESTADO_LISTA_ESPERA =
    "LISTA_ESPERA";

// ============================================================
// TIPOS
// ============================================================

type TipoDestinatario =
    | "RESPONSABLE"
    | "CAPITAN";

type FormularioDB = {
    id: string;
    edicion_id: string;
    usuario_id: string | null;
    email_contacto: string | null;
    acceso_capitan: boolean | null;
    estado: string | null;
};

type EquipoDB = {
    id: string;
    formulario_id: string;
    nombre: string | null;
    escudo: string | null;
    capitan_id: string | null;
    validacion_estado: string | null;
    plaza_estado: string | null;
    posicion_lista_espera: number | null;
};

type EdicionDB = {
    id: string;
    torneo_id: string;
    nombre: string | null;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
};

type TorneoDB = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    logo: string | null;
    banner: string | null;
};

type UsuarioDB = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
};

type ParticipanteDB = {
    id: string;
    equipo_id: string;
    tipo_participante: string | null;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    activo: boolean;
};

type Destinatario = {
    email: string;
    nombre: string;
    tipo: TipoDestinatario;
};

type DatosListaEspera = {
    formulario:
        FormularioDB;

    equipo:
        EquipoDB;

    edicion:
        EdicionDB;

    torneo:
        TorneoDB;

    responsable:
        UsuarioDB | null;

    participantes:
        ParticipanteDB[];
};

export type ResultadoEmailListaEspera = {
    destinatarios: number;
    enviados: number;
    fallidos: number;
    posicion: number;
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
    valor:
        string | null,
    base:
        string,
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
// EMAIL
// ============================================================

function normalizarEmail(
    valor:
        string | null,
) {
    return (
        valor ??
        ""
    )
        .trim()
        .toLowerCase();
}

function emailValido(
    valor:
        string,
) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        valor,
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
// CARGAR DATOS
// ============================================================

async function cargarDatosListaEspera(
    formularioID:
        string,
): Promise<DatosListaEspera> {
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
                "id,edicion_id,usuario_id,email_contacto,acceso_capitan,estado",
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
            FormularioDB;

    // ========================================================
    // EQUIPO + EDICIÓN
    // ========================================================

    const [
        resultadoEquipo,
        resultadoEdicion,
    ] =
        await Promise.all([
            supabaseAdmin
                .from(
                    "equipos",
                )
                .select(
                    "id,formulario_id,nombre,escudo,capitan_id,validacion_estado,plaza_estado,posicion_lista_espera",
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
        !resultadoEquipo.data ||
        !resultadoEdicion.data
    ) {
        throw new Error(
            "No s'han pogut carregar les dades de l'equip.",
        );
    }

    const equipo =
        resultadoEquipo.data as
            EquipoDB;

    const edicion =
        resultadoEdicion.data as
            EdicionDB;

    // ========================================================
    // TORNEO + PARTICIPANTES + RESPONSABLE
    // ========================================================

    const [
        resultadoTorneo,
        resultadoParticipantes,
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
                    "id,equipo_id,tipo_participante,nombre,apellido1,apellido2,email,activo",
                )
                .eq(
                    "equipo_id",
                    equipo.id,
                )
                .eq(
                    "activo",
                    true,
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
                TorneoDB,

        responsable:
            resultadoResponsable.data
                ? resultadoResponsable.data as
                      UsuarioDB
                : null,

        participantes:
            (
                resultadoParticipantes.data ??
                []
            ) as ParticipanteDB[],
    };
}

// ============================================================
// DESTINATARIOS
// ============================================================

function obtenerDestinatarios(
    datos:
        DatosListaEspera,
) {
    const destinatarios =
        new Map<
            string,
            Destinatario
        >();

    function añadir(
        destinatario:
            Destinatario,
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
            capitan?.email
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

    return [
        ...destinatarios.values(),
    ];
}

// ============================================================
// ASUNTO
// ============================================================

function crearAsuntoListaEspera(
    datos:
        DatosListaEspera,
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

    return `Llista d'espera · ${equipo} | ${torneo}`;
}

// ============================================================
// HTML
// ============================================================

function crearHTMLListaEspera({
    datos,
    destinatario,
}: {
    datos:
        DatosListaEspera;

    destinatario:
        Destinatario;
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

    const nombreDestinatario =
        escaparHTML(
            destinatario.nombre ||
            "Responsable de l'equip",
        );

    const posicion =
        datos.equipo
            .posicion_lista_espera;

    const logoEquipo =
        urlAbsoluta(
            datos.equipo.escudo,
            base,
        ) ??
        urlAbsoluta(
            datos.torneo.logo,
            base,
        );

    const banner =
        urlAbsoluta(
            datos.torneo.banner,
            base,
        );

    const urlInscripcion =
        `${base}/inscripcio?edicionID=${encodeURIComponent(
            datos.edicion.id,
        )}`;

    const urlLegal =
        `${base}/aviso-legal`;

    const urlPrivacidad =
        `${base}/politica-de-privacitat`;

    const urlCookies =
        `${base}/politica-de-cookies`;

    const año =
        new Date()
            .getFullYear();

    return `
<!DOCTYPE html>
<html
    lang="ca"
    dir="ltr"
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

    <title>
        Llista d'espera
    </title>

    <style type="text/css">
        #outlook a {
            padding:0;
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
            .contenidor {
                width:100%!important;
                max-width:600px!important;
            }

            .adapt-img {
                width:100%!important;
                height:auto!important;
            }

            .adapt-td {
                display:block!important;
                width:100%!important;
            }

            .posicio {
                padding-top:18px!important;
                text-align:left!important;
            }
        }
    </style>
</head>

<body
    style="
        width:100%;
        height:100%;
        Margin:0;
        padding:0;
        background-color:#f8f9ff;
        font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;
    "
>

<div
    lang="ca"
    dir="ltr"
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
        width:100%;
        border-spacing:0;
        Margin:0;
        padding:0;
    "
>
<tbody>
<tr>
<td
    align="center"
    valign="top"
>

    <!-- =====================================================
         CABECERA
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>

            <tr>
                <td
                    bgcolor="#0b1c30"
                    align="center"
                    style="
                        padding:24px 20px 18px;
                        background-color:#0b1c30;
                    "
                >
                    <h2
                        style="
                            Margin:0;
                            color:#71F8E4;
                            font-size:26px;
                            line-height:32px;
                            font-weight:bold;
                        "
                    >
                        ${nombreTorneo}
                    </h2>

                    <p
                        style="
                            Margin:6px 0 0;
                            color:#d3e4fe;
                            font-size:13px;
                            line-height:20px;
                        "
                    >
                        ${nombreEdicion}
                    </p>
                </td>
            </tr>

            ${
                banner
                    ? `
                        <tr>
                            <td
                                bgcolor="#0b1c30"
                                align="center"
                                style="
                                    padding:0 20px 20px;
                                    background-color:#0b1c30;
                                "
                            >
                                <img
                                    src="${escaparHTML(banner)}"
                                    alt="${nombreTorneo}"
                                    width="560"
                                    class="adapt-img"
                                    style="
                                        display:block;
                                        width:100%;
                                        max-width:560px;
                                        height:auto;
                                        border:0;
                                        border-radius:12px;
                                    "
                                >
                            </td>
                        </tr>
                    `
                    : ""
            }

        </tbody>
    </table>

    <!-- =====================================================
         ESTADO
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>
            <tr>
                <td
                    bgcolor="#0b1c30"
                    style="
                        padding:0 20px 20px;
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
                                    align="center"
                                    bgcolor="#213145"
                                    style="
                                        padding:22px;
                                        background-color:#213145;
                                        border:1px solid #3e4947;
                                        border-top:5px solid #f59e0b;
                                        border-radius:12px;
                                    "
                                >

                                    <div
                                        style="
                                            display:inline-block;
                                            padding:6px 12px;
                                            background-color:#78350f;
                                            border-radius:999px;
                                            color:#ffffff;
                                            font-size:10px;
                                            font-weight:bold;
                                            text-transform:uppercase;
                                        "
                                    >
                                        LLISTA D'ESPERA
                                    </div>

                                    <h1
                                        style="
                                            Margin:14px 0 0;
                                            color:#ffffff;
                                            font-size:26px;
                                            line-height:33px;
                                        "
                                    >
                                        L'equip ha entrat a la llista d'espera
                                    </h1>

                                    <p
                                        style="
                                            Margin:12px 0 0;
                                            color:#d3e4fe;
                                            font-size:14px;
                                            line-height:22px;
                                        "
                                    >
                                        Hola ${nombreDestinatario}. En aquests moments no s'ha pogut assignar una plaça directa a l'equip, per la qual cosa ha estat incorporat a la llista d'espera.
                                    </p>

                                </td>
                            </tr>
                        </tbody>
                    </table>

                </td>
            </tr>
        </tbody>
    </table>

    <!-- =====================================================
         EQUIPO + POSICIÓN
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>
            <tr>
                <td
                    bgcolor="#0b1c30"
                    style="
                        padding:0 20px 20px;
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
                                        background-color:#213145;
                                        border:1px solid #3e4947;
                                        border-radius:12px;
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

                                                ${
                                                    logoEquipo
                                                        ? `
                                                            <td
                                                                width="100"
                                                                valign="middle"
                                                                class="adapt-td"
                                                                style="
                                                                    width:100px;
                                                                    padding-right:18px;
                                                                "
                                                            >
                                                                <img
                                                                    src="${escaparHTML(logoEquipo)}"
                                                                    alt=""
                                                                    width="88"
                                                                    style="
                                                                        display:block;
                                                                        width:88px;
                                                                        max-width:88px;
                                                                        height:auto;
                                                                        border:0;
                                                                    "
                                                                >
                                                            </td>
                                                        `
                                                        : ""
                                                }

                                                <td
                                                    valign="middle"
                                                    class="adapt-td"
                                                >
                                                    <p
                                                        style="
                                                            Margin:0;
                                                            color:#94a3b8;
                                                            font-size:10px;
                                                            line-height:16px;
                                                            font-weight:bold;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Equip
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:4px 0 0;
                                                            color:#ffffff;
                                                            font-size:23px;
                                                            line-height:29px;
                                                            font-weight:bold;
                                                        "
                                                    >
                                                        ${nombreEquipo}
                                                    </p>
                                                </td>

                                                <td
                                                    width="120"
                                                    valign="middle"
                                                    align="right"
                                                    class="adapt-td posicio"
                                                    style="
                                                        width:120px;
                                                    "
                                                >
                                                    <p
                                                        style="
                                                            Margin:0;
                                                            color:#94a3b8;
                                                            font-size:10px;
                                                            line-height:16px;
                                                            font-weight:bold;
                                                            text-transform:uppercase;
                                                        "
                                                    >
                                                        Posició actual
                                                    </p>

                                                    <p
                                                        style="
                                                            Margin:2px 0 0;
                                                            color:#fbbf24;
                                                            font-size:34px;
                                                            line-height:40px;
                                                            font-weight:bold;
                                                        "
                                                    >
                                                        ${posicion}
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

    <!-- =====================================================
         EXPLICACIÓN
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>
            <tr>
                <td
                    bgcolor="#0b1c30"
                    style="
                        padding:0 20px 20px;
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
                                        padding:18px;
                                        background-color:#213145;
                                        border:1px solid #3e4947;
                                        border-left:4px solid #f59e0b;
                                        border-radius:10px;
                                    "
                                >

                                    <p
                                        style="
                                            Margin:0;
                                            color:#ffffff;
                                            font-size:15px;
                                            line-height:22px;
                                            font-weight:bold;
                                        "
                                    >
                                        Què significa estar a la llista d'espera?
                                    </p>

                                    <p
                                        style="
                                            Margin:9px 0 0;
                                            color:#d3e4fe;
                                            font-size:13px;
                                            line-height:21px;
                                        "
                                    >
                                        L'equip continua registrat a l'edició, però actualment no disposa d'una plaça confirmada.
                                    </p>

                                    <p
                                        style="
                                            Margin:8px 0 0;
                                            color:#d3e4fe;
                                            font-size:13px;
                                            line-height:21px;
                                        "
                                    >
                                        Si es produeix una vacant o l'organització pot ampliar el nombre de places disponibles, la situació de l'equip podrà canviar.
                                    </p>

                                    <p
                                        style="
                                            Margin:8px 0 0;
                                            color:#d3e4fe;
                                            font-size:13px;
                                            line-height:21px;
                                        "
                                    >
                                        Rebreu una nova notificació si hi ha algun canvi en l'estat de la plaça.
                                    </p>

                                </td>
                            </tr>
                        </tbody>
                    </table>

                </td>
            </tr>
        </tbody>
    </table>

    <!-- =====================================================
         VALIDACIÓN Y PLAZA
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>
            <tr>
                <td
                    bgcolor="#0b1c30"
                    style="
                        padding:0 20px 20px;
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
                                        padding:15px;
                                        background-color:#17263a;
                                        border:1px solid #334155;
                                        border-radius:9px;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0;
                                            color:#94a3b8;
                                            font-size:12px;
                                            line-height:19px;
                                            text-align:center;
                                        "
                                    >
                                        L'estat de la plaça i la validació de les dades de la inscripció són processos independents. Estar en llista d'espera no implica per si mateix cap canvi en l'estat de revisió de la inscripció.
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                </td>
            </tr>
        </tbody>
    </table>

    <!-- =====================================================
         BOTÓN
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>
            <tr>
                <td
                    bgcolor="#0b1c30"
                    align="center"
                    style="
                        padding:4px 20px 28px;
                        background-color:#0b1c30;
                    "
                >
                    <a
                        href="${escaparHTML(urlInscripcion)}"
                        target="_blank"
                        style="
                            display:inline-block;
                            padding:14px 28px;
                            background-color:#d97706;
                            color:#ffffff;
                            text-decoration:none;
                            font-size:14px;
                            font-weight:bold;
                            border-radius:10px;
                        "
                    >
                        Veure inscripció
                    </a>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- =====================================================
         FOOTER
         ===================================================== -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            width:600px;
            max-width:600px;
            border-spacing:0;
        "
    >
        <tbody>

            <tr>
                <td
                    bgcolor="#0b1c30"
                    align="center"
                    style="
                        padding:16px 20px 6px;
                        background-color:#0b1c30;
                    "
                >
                    <p
                        style="
                            Margin:0;
                            color:#64748b;
                            font-size:12px;
                            line-height:18px;
                        "
                    >
                        ©${año} Esports IES Calvià | Tots els drets reservats.
                    </p>
                </td>
            </tr>

            <tr>
                <td
                    bgcolor="#0b1c30"
                    align="center"
                    style="
                        padding:6px 40px;
                        background-color:#0b1c30;
                    "
                >
                    <p
                        style="
                            Margin:0;
                            color:#64748b;
                            font-size:11px;
                            line-height:18px;
                        "
                    >
                        Heu rebut aquest correu perquè sou responsable de la inscripció o teniu accés autoritzat com a capità de l'equip.
                    </p>
                </td>
            </tr>

            <tr>
                <td
                    bgcolor="#0b1c30"
                    align="center"
                    style="
                        padding:8px 30px 22px;
                        background-color:#0b1c30;
                    "
                >
                    <p
                        style="
                            Margin:0;
                            color:#64748b;
                            font-size:11px;
                            line-height:18px;
                        "
                    >
                        <a
                            href="${escaparHTML(urlLegal)}"
                            target="_blank"
                            style="
                                color:#64748b;
                                text-decoration:underline;
                            "
                        >
                            Avís Legal
                        </a>

                        &nbsp;·&nbsp;

                        <a
                            href="${escaparHTML(urlPrivacidad)}"
                            target="_blank"
                            style="
                                color:#64748b;
                                text-decoration:underline;
                            "
                        >
                            Política de Privacitat
                        </a>

                        &nbsp;·&nbsp;

                        <a
                            href="${escaparHTML(urlCookies)}"
                            target="_blank"
                            style="
                                color:#64748b;
                                text-decoration:underline;
                            "
                        >
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
// ENVIAR EMAIL DE LISTA DE ESPERA
// ============================================================

export async function notificarEquipoListaEspera(
    formularioID:
        string,
): Promise<ResultadoEmailListaEspera> {
    const datos =
        await cargarDatosListaEspera(
            formularioID,
        );

    // ========================================================
    // COMPROBAR ESTADO
    // ========================================================

    const estadoPlaza =
        (
            datos.equipo
                .plaza_estado ??
            ""
        )
            .trim()
            .toUpperCase();

    if (
        estadoPlaza !==
        ESTADO_LISTA_ESPERA
    ) {
        throw new Error(
            `No es pot enviar el correu de llista d'espera perquè la plaça de l'equip està en estat ${estadoPlaza || "DESCONEGUT"}.`,
        );
    }

    // ========================================================
    // COMPROBAR POSICIÓN
    // ========================================================

    const posicion =
        datos.equipo
            .posicion_lista_espera;

    if (
        typeof posicion !==
            "number" ||
        !Number.isSafeInteger(
            posicion,
        ) ||
        posicion <
            1
    ) {
        throw new Error(
            "L'equip està en llista d'espera però no té una posició vàlida.",
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

            posicion,
        };
    }

    // ========================================================
    // ENVÍOS
    // ========================================================

    /*
     * Cada destinatario recibe un correo independiente.
     *
     * Así no exponemos las direcciones del responsable y del
     * capitán entre sí.
     */
    const resultados =
        await Promise.allSettled(
            destinatarios.map(
                destinatario =>
                    enviarEmailApi({
                        to:
                            destinatario.email,

                        subject:
                            crearAsuntoListaEspera(
                                datos,
                            ),

                        html:
                            crearHTMLListaEspera({
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
                    `[EMAIL] LISTA_ESPERA enviada a ${destinatario?.tipo ?? "DESCONEGUT"} (${destinatario?.email ?? "sense-email"}). Posició: ${posicion}.`,
                );

                return;
            }

            fallidos +=
                1;

            console.error(
                `[EMAIL] Error enviant LISTA_ESPERA a ${destinatario?.tipo ?? "DESCONEGUT"} (${destinatario?.email ?? "sense-email"}):`,
                resultado.reason,
            );
        },
    );

    return {
        destinatarios:
            destinatarios.length,

        enviados,

        fallidos,

        posicion,
    };
}