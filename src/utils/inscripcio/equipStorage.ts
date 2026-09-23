import { supabaseAdmin } from "@utils/supabase";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const BUCKET_EQUIPOS =
    "EquiposIMG";

const MAX_ESCUDO_BYTES =
    2_000_000;

const MIME_PERMITIDOS =
    new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
    ]);

// ============================================================
// TIPOS
// ============================================================

type GuardarEscudoOpciones = {
    torneoID: string;
    edicionID: string;
    equipoID: string;
    escudo: string | null;
};

// ============================================================
// MIME → EXTENSIÓN
// ============================================================

function extensionDesdeMime(
    mime: string,
) {
    switch (
        mime.toLowerCase()
    ) {
        case "image/png":
            return "png";

        case "image/jpeg":
            return "jpg";

        case "image/webp":
            return "webp";

        case "image/svg+xml":
            return "svg";

        default:
            throw new Error(
                "El format de l'escut no és compatible.",
            );
    }
}

// ============================================================
// LIMPIAR SEGMENTO DE RUTA
// ============================================================

function limpiarSegmento(
    valor: string,
    nombre: string,
) {
    const limpio =
        valor
            .trim()
            .toLowerCase();

    if (
        !limpio ||
        !/^[a-z0-9_-]+$/.test(
            limpio,
        )
    ) {
        throw new Error(
            `El valor ${nombre} no és vàlid per construir la ruta de l'escut.`,
        );
    }

    return limpio;
}

// ============================================================
// CARPETA
// ============================================================

function obtenerCarpetaEscudo({
    torneoID,
    edicionID,
}: {
    torneoID: string;
    edicionID: string;
}) {
    const torneo =
        limpiarSegmento(
            torneoID,
            "torneoID",
        );

    const edicion =
        limpiarSegmento(
            edicionID,
            "edicionID",
        );

    return `${torneo}/${edicion}/escudo`;
}

// ============================================================
// DATA URL
// ============================================================

function leerDataURL(
    valor: string,
) {
    const coincidencia =
        valor.match(
            /^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=\r\n]+)$/i,
        );

    if (
        !coincidencia
    ) {
        throw new Error(
            "El format de l'escut no és vàlid.",
        );
    }

    const mime =
        coincidencia[1]
            .toLowerCase();

    const base64 =
        coincidencia[2]
            .replace(
                /\s/g,
                "",
            );

    if (
        !MIME_PERMITIDOS.has(
            mime,
        )
    ) {
        throw new Error(
            "El tipus d'imatge de l'escut no està permès.",
        );
    }

    let buffer:
        Buffer;

    try {
        buffer =
            Buffer.from(
                base64,
                "base64",
            );
    } catch {
        throw new Error(
            "No s'ha pogut processar l'escut.",
        );
    }

    if (
        buffer.length ===
        0
    ) {
        throw new Error(
            "L'escut està buit.",
        );
    }

    if (
        buffer.length >
        MAX_ESCUDO_BYTES
    ) {
        throw new Error(
            "L'escut és massa gran. La mida màxima és de 2 MB.",
        );
    }

    return {
        mime,
        buffer,
        extension:
            extensionDesdeMime(
                mime,
            ),
    };
}

// ============================================================
// ELIMINAR VERSIONES ANTERIORES
// ============================================================

async function eliminarEscudosAnteriores({
    torneoID,
    edicionID,
    equipoID,
    conservar,
}: {
    torneoID: string;
    edicionID: string;
    equipoID: string;
    conservar?: string | null;
}) {
    const carpeta =
        obtenerCarpetaEscudo({
            torneoID,
            edicionID,
        });

    const equipo =
        limpiarSegmento(
            equipoID,
            "equipoID",
        );

    const {
        data:
            archivos,

        error:
            errorLista,
    } =
        await supabaseAdmin
            .storage
            .from(
                BUCKET_EQUIPOS,
            )
            .list(
                carpeta,
                {
                    limit:
                        100,

                    search:
                        equipo,
                },
            );

    if (
        errorLista
    ) {
        throw errorLista;
    }

    const rutas =
        (
            archivos ??
            []
        )
            .filter(
                archivo =>
                    archivo.name.startsWith(
                        `${equipo}.`,
                    ),
            )
            .map(
                archivo =>
                    `${carpeta}/${archivo.name}`,
            )
            .filter(
                ruta =>
                    ruta !==
                    conservar,
            );

    if (
        rutas.length ===
        0
    ) {
        return;
    }

    const {
        error:
            errorEliminar,
    } =
        await supabaseAdmin
            .storage
            .from(
                BUCKET_EQUIPOS,
            )
            .remove(
                rutas,
            );

    if (
        errorEliminar
    ) {
        throw errorEliminar;
    }
}

// ============================================================
// URL PÚBLICA
// ============================================================

function obtenerURLPublica(
    ruta: string,
) {
    const {
        data,
    } =
        supabaseAdmin
            .storage
            .from(
                BUCKET_EQUIPOS,
            )
            .getPublicUrl(
                ruta,
            );

    if (
        !data.publicUrl
    ) {
        throw new Error(
            "No s'ha pogut obtenir la URL pública de l'escut.",
        );
    }

    return data.publicUrl;
}

// ============================================================
// GUARDAR ESCUDO
// ============================================================

export async function guardarEscudoEquipo({
    torneoID,
    edicionID,
    equipoID,
    escudo,
}: GuardarEscudoOpciones): Promise<string | null> {
    const carpeta =
        obtenerCarpetaEscudo({
            torneoID,
            edicionID,
        });

    const equipo =
        limpiarSegmento(
            equipoID,
            "equipoID",
        );

    // ========================================================
    // ELIMINAR ESCUDO
    // ========================================================

    if (
        !escudo ||
        !escudo.trim()
    ) {
        await eliminarEscudosAnteriores({
            torneoID,
            edicionID,
            equipoID,
        });

        return null;
    }

    const valor =
        escudo.trim();

    // ========================================================
    // URL EXISTENTE
    // ========================================================

    /*
     * Si ya tenemos una URL HTTP/HTTPS, no volvemos a subirla.
     *
     * Esto permite:
     * - mantener escudos ya migrados a Storage;
     * - mantener temporalmente URLs externas válidas.
     */

    if (
        /^https?:\/\//i.test(
            valor,
        )
    ) {
        return valor;
    }

    // ========================================================
    // BASE64 → ARCHIVO
    // ========================================================

    const {
        mime,
        buffer,
        extension,
    } =
        leerDataURL(
            valor,
        );

    const nombreArchivo =
        `${equipo}.${extension}`;

    const ruta =
        `${carpeta}/${nombreArchivo}`;

    // ========================================================
    // ELIMINAR OTROS FORMATOS
    // ========================================================

    /*
     * Por ejemplo:
     *
     * equipo.png
     * ↓ usuario cambia a WEBP
     * equipo.webp
     *
     * Eliminamos el PNG anterior para que sólo exista un
     * escudo por equipo.
     */

    await eliminarEscudosAnteriores({
        torneoID,
        edicionID,
        equipoID,
        conservar:
            ruta,
    });

    // ========================================================
    // SUBIR
    // ========================================================

    const {
        error:
            errorSubida,
    } =
        await supabaseAdmin
            .storage
            .from(
                BUCKET_EQUIPOS,
            )
            .upload(
                ruta,
                buffer,
                {
                    contentType:
                        mime,

                    cacheControl:
                        "3600",

                    /*
                     * Si el usuario sustituye el escudo por
                     * otro del mismo formato, reemplazamos el
                     * archivo existente.
                     */
                    upsert:
                        true,
                },
            );

    if (
        errorSubida
    ) {
        throw errorSubida;
    }

    // ========================================================
    // URL
    // ========================================================

    return obtenerURLPublica(
        ruta,
    );
}