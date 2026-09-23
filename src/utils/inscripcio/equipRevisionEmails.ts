import { enviarEmailApi } from "@utils/envioEmails";
import { supabaseAdmin } from "@utils/supabase";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ORIGEN_EMAIL =
    "esports_iescalvia";

// ============================================================
// TIPOS PÚBLICOS
// ============================================================

export type TipoRevisionEquipo =
    | "APROBADO"
    | "CORRECCIONES"
    | "NO_APROBADO"
    | "EN_REVISION";

export type ResultadoEmailRevisionEquipo = {
    destinatarios: number;
    enviados: number;
    fallidos: number;
    tipo: TipoRevisionEquipo;
};

// ============================================================
// TIPOS INTERNOS
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
    curso: string | null;
    grupo: string | null;
    activo: boolean;
};

type ObservacionDB = {
    id: string;
    formulario_id: string | null;
    entidad_tipo: string | null;
    entidad_id: string | null;
    campo: string | null;
    mensaje: string | null;
    estado: string | null;
    created_at: string | null;
};

type Destinatario = {
    email: string;
    nombre: string;
    tipo: TipoDestinatario;
};

type DatosRevision = {
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

    observaciones:
        ObservacionDB[];
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

async function cargarDatosRevision(
    formularioID:
        string,
): Promise<DatosRevision> {
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
                    "id,formulario_id,entidad_tipo,entidad_id,campo,mensaje,estado,created_at",
                )
                .eq(
                    "formulario_id",
                    formularioDB.id,
                )
                .order(
                    "created_at",
                    {
                        ascending:
                            true,
                    },
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
                    "id,equipo_id,tipo_participante,nombre,apellido1,apellido2,email,curso,grupo,activo",
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

        observaciones:
            (
                resultadoObservaciones.data ??
                []
            ) as ObservacionDB[],
    };
}

// ============================================================
// DESTINATARIOS
// ============================================================

function obtenerDestinatarios(
    datos:
        DatosRevision,
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
// ESTADO ESPERADO
// ============================================================

function obtenerEstadoEsperado(
    tipo:
        TipoRevisionEquipo,
) {
    switch (
        tipo
    ) {
        case "APROBADO":
            return "APROBADO";

        case "CORRECCIONES":
        case "NO_APROBADO":
            return "DENEGADO";

        case "EN_REVISION":
            return "EN_REVISION";
    }
}

// ============================================================
// OBSERVACIONES DE ESTA REVISIÓN
// ============================================================

function obtenerObservacionesRevision(
    datos:
        DatosRevision,
    ids:
        string[],
) {
    /*
     * Cuando solicitarCambiosEquipoAdmin() nos entregue los IDs
     * recién creados usamos exclusivamente esas observaciones.
     *
     * Así no mezclamos correcciones antiguas con la nueva revisión.
     */
    if (
        ids.length >
        0
    ) {
        const conjunto =
            new Set(
                ids,
            );

        return datos.observaciones
            .filter(
                observacion =>
                    conjunto.has(
                        observacion.id,
                    ),
            );
    }

    /*
     * Fallback para poder utilizar esta función sin IDs:
     * devolvemos únicamente observaciones que siguen activas.
     */
    return datos.observaciones
        .filter(
            observacion =>
                (
                    observacion.estado ??
                    ""
                )
                    .trim()
                    .toUpperCase() !==
                "RESUELTA",
        );
}

// ============================================================
// TEXTO CAMPO
// ============================================================

function textoCampoRevision(
    campo:
        string | null,
) {
    const valor =
        (
            campo ??
            ""
        )
            .trim()
            .toLowerCase();

    const campos:
        Record<
            string,
            string
        > = {
            nombre:
                "Nom",

            escudo:
                "Escut",

            capitan_id:
                "Capità",

            capitan_email:
                "Capità",

            email_contacto:
                "Correu del responsable",

            acceso_capitan:
                "Accés del capità",

            apellido1:
                "Primer llinatge",

            apellido2:
                "Segon llinatge",

            email:
                "Correu electrònic",

            curso:
                "Curs",

            grupo:
                "Grup",

            genero:
                "Gènere",

            tipo_participante:
                "Tipus de participant",

            participantes:
                "Participants",

            responsable:
                "Responsable",

            equipo:
                "Equip",

            formulario:
                "Inscripció",
        };

    if (
        campos[
            valor
        ]
    ) {
        return campos[
            valor
        ];
    }

    if (
        !valor
    ) {
        return "Informació";
    }

    return valor
        .replaceAll(
            "_",
            " ",
        )
        .replace(
            /^./,
            letra =>
                letra.toUpperCase(),
        );
}

// ============================================================
// ENTIDAD DE OBSERVACIÓN
// ============================================================

function textoEntidadRevision(
    observacion:
        ObservacionDB,
    datos:
        DatosRevision,
) {
    const tipo =
        (
            observacion.entidad_tipo ??
            ""
        )
            .trim()
            .toUpperCase();

    if (
        tipo ===
        "FORMULARIO"
    ) {
        return "Inscripció";
    }

    if (
        tipo ===
        "EQUIPO"
    ) {
        return "Equip";
    }

    if (
        tipo ===
        "PARTICIPANTE"
    ) {
        const participante =
            datos.participantes.find(
                elemento =>
                    elemento.id ===
                    observacion.entidad_id,
            );

        if (
            participante
        ) {
            return (
                nombreCompleto(
                    participante,
                ) ||
                "Participant"
            );
        }

        return "Participant";
    }

    return "Inscripció";
}

// ============================================================
// LISTA DE CORRECCIONES
// ============================================================

function crearCorreccionesHTML(
    observaciones:
        ObservacionDB[],
    datos:
        DatosRevision,
) {
    if (
        observaciones.length ===
        0
    ) {
        return `
            <table
                width="100%"
                cellspacing="0"
                cellpadding="0"
                role="presentation"
                style="border-spacing:0"
            >
                <tbody>
                    <tr>
                        <td
                            style="
                                padding:16px;
                                background-color:#213145;
                                border:1px solid #3e4947;
                                border-radius:10px;
                            "
                        >
                            <p
                                style="
                                    Margin:0;
                                    color:#d3e4fe;
                                    font-size:14px;
                                    line-height:21px;
                                "
                            >
                                Revisa les dades de la inscripció i aplica les correccions indicades per l'organització.
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    return observaciones
        .map(
            (
                observacion,
                indice,
            ) => {
                const entidad =
                    escaparHTML(
                        textoEntidadRevision(
                            observacion,
                            datos,
                        ),
                    );

                const campo =
                    escaparHTML(
                        textoCampoRevision(
                            observacion.campo,
                        ),
                    );

                const mensaje =
                    escaparHTML(
                        observacion.mensaje ||
                        "Cal revisar aquesta informació.",
                    );

                return `
                    <table
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        role="presentation"
                        style="
                            border-spacing:0;
                            margin-bottom:10px;
                        "
                    >
                        <tbody>
                            <tr>
                                <td
                                    width="38"
                                    valign="top"
                                    style="
                                        padding:14px 8px 14px 14px;
                                        background-color:#213145;
                                        border-top:1px solid #3e4947;
                                        border-bottom:1px solid #3e4947;
                                        border-left:4px solid #f59e0b;
                                        border-radius:10px 0 0 10px;
                                    "
                                >
                                    <span
                                        style="
                                            display:inline-block;
                                            color:#fbbf24;
                                            font-size:14px;
                                            font-weight:bold;
                                        "
                                    >
                                        ${indice + 1}.
                                    </span>
                                </td>

                                <td
                                    valign="top"
                                    style="
                                        padding:14px 14px 14px 4px;
                                        background-color:#213145;
                                        border-top:1px solid #3e4947;
                                        border-right:1px solid #3e4947;
                                        border-bottom:1px solid #3e4947;
                                        border-radius:0 10px 10px 0;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0;
                                            color:#fbbf24;
                                            font-size:11px;
                                            line-height:16px;
                                            font-weight:bold;
                                            text-transform:uppercase;
                                        "
                                    >
                                        ${entidad} · ${campo}
                                    </p>

                                    <p
                                        style="
                                            Margin:6px 0 0 0;
                                            color:#f8f9ff;
                                            font-size:14px;
                                            line-height:21px;
                                        "
                                    >
                                        ${mensaje}
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                `;
            },
        )
        .join(
            "",
        );
}

// ============================================================
// CONTENIDO SEGÚN REVISIÓN
// ============================================================

function obtenerContenidoRevision(
    tipo:
        TipoRevisionEquipo,
) {
    switch (
        tipo
    ) {
        case "APROBADO":
            return {
                titulo:
                    "Inscripció aprovada",

                resumen:
                    "L'organització ha revisat les dades de l'equip i la inscripció ha estat aprovada.",

                estado:
                    "APROVADA",

                color:
                    "#22c55e",

                colorSuave:
                    "#14532d",

                boton:
                    "Veure inscripció",

                aviso:
                    "L'aprovació confirma que les dades de la inscripció han estat validades. La gestió i assignació de plaça es realitza de manera independent.",
            };

        case "CORRECCIONES":
            return {
                titulo:
                    "Cal corregir la inscripció",

                resumen:
                    "L'organització ha revisat la inscripció i necessita que es corregeixin algunes dades abans de poder continuar amb la validació.",

                estado:
                    "CORRECCIONS",

                color:
                    "#f59e0b",

                colorSuave:
                    "#78350f",

                boton:
                    "Corregir inscripció",

                aviso:
                    "Quan hagis aplicat totes les correccions, torna a enviar la inscripció. L'organització la revisarà de nou.",
            };

        case "NO_APROBADO":
            return {
                titulo:
                    "Inscripció no aprovada",

                resumen:
                    "L'organització ha finalitzat la revisió i la inscripció no ha estat aprovada.",

                estado:
                    "NO APROVADA",

                color:
                    "#ef4444",

                colorSuave:
                    "#7f1d1d",

                boton:
                    "Veure inscripció",

                aviso:
                    "Si necessites més informació sobre aquesta decisió, posa't en contacte amb l'organització del torneig.",
            };

        case "EN_REVISION":
            return {
                titulo:
                    "Inscripció en revisió",

                resumen:
                    "L'estat de la inscripció ha canviat i torna a estar pendent de revisió per part de l'organització.",

                estado:
                    "EN REVISIÓ",

                color:
                    "#14b8a6",

                colorSuave:
                    "#115e59",

                boton:
                    "Veure inscripció",

                aviso:
                    "L'organització revisarà les dades de l'equip. Rebràs una nova notificació quan finalitzi la revisió.",
            };
    }
}

// ============================================================
// ASUNTO
// ============================================================

function crearAsuntoRevision(
    datos:
        DatosRevision,
    tipo:
        TipoRevisionEquipo,
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

    switch (
        tipo
    ) {
        case "APROBADO":
            return `Inscripció aprovada · ${equipo} | ${torneo}`;

        case "CORRECCIONES":
            return `Correccions necessàries · ${equipo} | ${torneo}`;

        case "NO_APROBADO":
            return `Inscripció no aprovada · ${equipo} | ${torneo}`;

        case "EN_REVISION":
            return `Inscripció en revisió · ${equipo} | ${torneo}`;
    }
}

// ============================================================
// HTML EMAIL
// ============================================================

function crearHTMLRevision({
    datos,
    destinatario,
    tipo,
    observaciones,
}: {
    datos:
        DatosRevision;

    destinatario:
        Destinatario;

    tipo:
        TipoRevisionEquipo;

    observaciones:
        ObservacionDB[];
}) {
    const base =
        obtenerURLFrontend();

    const contenido =
        obtenerContenidoRevision(
            tipo,
        );

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

    const bloqueCorrecciones =
        tipo ===
        "CORRECCIONES"
            ? `
                <table
                    cellspacing="0"
                    cellpadding="0"
                    align="center"
                    width="600"
                    role="none"
                    style="
                        border-spacing:0;
                        width:600px;
                        max-width:600px;
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
                                <p
                                    style="
                                        Margin:0 0 12px 0;
                                        color:#ffffff;
                                        font-size:17px;
                                        line-height:23px;
                                        font-weight:bold;
                                    "
                                >
                                    Correccions sol·licitades
                                </p>

                                ${crearCorreccionesHTML(
                                    observaciones,
                                    datos,
                                )}
                            </td>
                        </tr>
                    </tbody>
                </table>
            `
            : "";

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

    <title>
        ${escaparHTML(contenido.titulo)}
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

    <!-- CABECERA -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            border-spacing:0;
            width:600px;
            max-width:600px;
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

    <!-- RESULTADO -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            border-spacing:0;
            width:600px;
            max-width:600px;
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
                                        border-top:5px solid ${contenido.color};
                                        border-radius:12px;
                                    "
                                >

                                    <div
                                        style="
                                            display:inline-block;
                                            padding:6px 12px;
                                            background-color:${contenido.colorSuave};
                                            border-radius:999px;
                                            color:#ffffff;
                                            font-size:10px;
                                            font-weight:bold;
                                            text-transform:uppercase;
                                        "
                                    >
                                        ${contenido.estado}
                                    </div>

                                    <h1
                                        style="
                                            Margin:14px 0 0;
                                            color:#ffffff;
                                            font-size:26px;
                                            line-height:33px;
                                        "
                                    >
                                        ${escaparHTML(contenido.titulo)}
                                    </h1>

                                    <p
                                        style="
                                            Margin:12px 0 0;
                                            color:#d3e4fe;
                                            font-size:14px;
                                            line-height:22px;
                                        "
                                    >
                                        Hola ${nombreDestinatario}.
                                        ${escaparHTML(contenido.resumen)}
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

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            border-spacing:0;
            width:600px;
            max-width:600px;
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
                                                                width="105"
                                                                valign="middle"
                                                                class="adapt-td"
                                                                style="
                                                                    width:105px;
                                                                    padding-right:18px;
                                                                "
                                                            >
                                                                <img
                                                                    src="${escaparHTML(logoEquipo)}"
                                                                    alt=""
                                                                    width="90"
                                                                    style="
                                                                        display:block;
                                                                        width:90px;
                                                                        max-width:90px;
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
                                                            font-size:24px;
                                                            line-height:30px;
                                                            font-weight:bold;
                                                        "
                                                    >
                                                        ${nombreEquipo}
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

    <!-- CORRECCIONES -->

    ${bloqueCorrecciones}

    <!-- AVISO -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            border-spacing:0;
            width:600px;
            max-width:600px;
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
                                        padding:15px;
                                        background-color:#213145;
                                        border:1px solid #3e4947;
                                        border-left:4px solid ${contenido.color};
                                        border-radius:8px;
                                    "
                                >
                                    <p
                                        style="
                                            Margin:0;
                                            color:#d3e4fe;
                                            font-size:13px;
                                            line-height:20px;
                                        "
                                    >
                                        ${escaparHTML(contenido.aviso)}
                                    </p>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                </td>
            </tr>
        </tbody>
    </table>

    <!-- BOTÓN -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            border-spacing:0;
            width:600px;
            max-width:600px;
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
                            background-color:${contenido.color};
                            color:#ffffff;
                            text-decoration:none;
                            font-size:14px;
                            font-weight:bold;
                            border-radius:10px;
                        "
                    >
                        ${escaparHTML(contenido.boton)}
                    </a>
                </td>
            </tr>
        </tbody>
    </table>

    <!-- FOOTER -->

    <table
        cellspacing="0"
        cellpadding="0"
        align="center"
        width="600"
        class="contenidor"
        role="none"
        style="
            border-spacing:0;
            width:600px;
            max-width:600px;
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
// ENVIAR REVISIÓN
// ============================================================

export async function notificarRevisionEquipo(
    formularioID:
        string,
    tipo:
        TipoRevisionEquipo,
    observacionesIDs:
        string[] = [],
): Promise<ResultadoEmailRevisionEquipo> {
    const datos =
        await cargarDatosRevision(
            formularioID,
        );

    // ========================================================
    // COMPROBAR QUE EL ESTADO ACTUAL COINCIDE
    // ========================================================

    const estadoActual =
        (
            datos.formulario.estado ??
            ""
        )
            .trim()
            .toUpperCase();

    const estadoEsperado =
        obtenerEstadoEsperado(
            tipo,
        );

    if (
        estadoActual !==
        estadoEsperado
    ) {
        throw new Error(
            `No es pot enviar una notificació ${tipo} perquè el formulari està en estat ${estadoActual || "DESCONEGUT"}.`,
        );
    }

    // ========================================================
    // OBSERVACIONES
    // ========================================================

    const observaciones =
        tipo ===
        "CORRECCIONES"
            ? obtenerObservacionesRevision(
                  datos,
                  observacionesIDs,
              )
            : [];

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

            tipo,
        };
    }

    // ========================================================
    // ENVÍOS
    // ========================================================

    /*
     * Se envían individualmente.
     *
     * Nunca colocamos responsable y capitán juntos en To/CC.
     */
    const resultados =
        await Promise.allSettled(
            destinatarios.map(
                destinatario =>
                    enviarEmailApi({
                        to:
                            destinatario.email,

                        subject:
                            crearAsuntoRevision(
                                datos,
                                tipo,
                            ),

                        html:
                            crearHTMLRevision({
                                datos,
                                destinatario,
                                tipo,
                                observaciones,
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
                    `[EMAIL] Revisió ${tipo} enviada a ${destinatario?.tipo ?? "DESCONEGUT"} (${destinatario?.email ?? "sense-email"}).`,
                );

                return;
            }

            fallidos +=
                1;

            console.error(
                `[EMAIL] Error enviant la revisió ${tipo} a ${destinatario?.tipo ?? "DESCONEGUT"} (${destinatario?.email ?? "sense-email"}):`,
                resultado.reason,
            );
        },
    );

    return {
        destinatarios:
            destinatarios.length,

        enviados,

        fallidos,

        tipo,
    };
}