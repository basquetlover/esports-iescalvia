// ============================================================
// CATEGORÍAS DEL EDITOR ORIGINAL
// ============================================================

export const CATEGORIAS_NOTICIAS = [
    "Bases de Competició",
    "Normativa",
    "Inscripció",
    "Equips",
    "Voluntaris",
    "Actualitat",
    "Clasificació",
] as const;

// Se conserva la escritura original para no cambiar
// las categorías de las noticias existentes.

// ============================================================
// ESTADOS
// ============================================================

export const ESTADOS_NOTICIA = {
    borrador: "Esborrany",
    publicado: "Public",
} as const;

export type EstadoNoticia =
    (typeof ESTADOS_NOTICIA)[keyof typeof ESTADOS_NOTICIA];

// ============================================================
// CONTENIDO: MISMA ESTRUCTURA DEL EDITOR ORIGINAL
// ============================================================

export type ImagenNoticia = {
    id: string;
    url: string;
    alt?: string;
    autor?: string;
};

type BaseBloque = {
    id: string;
    order: number;
    title: string;
};

export type BloqueTexto = BaseBloque & {
    type: "text";
    body: string;
};

export type BloqueImagen = BaseBloque & {
    type: "imagen";
    body: ImagenNoticia;
};

export type BloqueCita = BaseBloque & {
    type: "cita";
    body: {
        text: string;
        autor: string;
    };
};

/**
 * Compatibilidad con el tipo que ya contemplaba
 * el editor original.
 *
 * No implica activar la creación de galerías:
 * esa opción estaba deshabilitada en el editor.
 */
export type BloqueGaleria = BaseBloque & {
    type: "galeria";
    body: ImagenNoticia[];
};

export type BloqueNoticia =
    | BloqueTexto
    | BloqueImagen
    | BloqueCita
    | BloqueGaleria;

// Los archivos File y las previsualizaciones temporales
// se gestionarán aparte dentro del editor.
// No forman parte del JSON persistido.

// ============================================================
// DATOS GUARDADOS
// ============================================================

export type Noticia = {
    id: string;
    titular: string | null;
    subtitulo: string | null;
    cover_image: string | null;
    slug: string | null;
    author: string | null;
    author_curso: string | null;
    status: string | null;
    created_at: string | null;
    publication_date: string | null;
    content: BloqueNoticia[] | null;
    tiempo_lectura: string | null;
    categoria: string | null;
    last_save: string | null;
    torneo_id: string | null;
};

// ============================================================
// DATOS DEL FORMULARIO
// ============================================================

export type FormularioNoticia = {
    titular: string;
    subtitulo: string;
    cover_image: string;
    slug: string;
    author: string;
    author_curso: string;
    categoria: string;
    torneo_id: string;
    content: BloqueNoticia[];
};

/**
 * El cliente envía el contenido editable.
 *
 * La API calculará el tiempo de lectura y establecerá
 * las fechas y el estado según la operación.
 */
export type GuardarNoticia = {
    accion: "crear" | "editar";
    id?: string;
    last_save?: string | null;
    noticia: FormularioNoticia;
};

export type TorneoNoticias = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    puedeCrear: boolean;
};

export type NoticiaListado = Omit<Noticia, "content"> & {
    torneo_nombre: string | null;
    puedeEditar: boolean;
    puedeEliminar: boolean;
};

// ============================================================
// SLUG
// ============================================================

export function generarSlugNoticia(titular: string): string {
    return titular
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// ============================================================
// TEXTO PARA ESTIMAR LA LECTURA
// ============================================================

/**
 * Extrae texto únicamente para contar palabras.
 *
 * NO es un sanitizador de HTML.
 * El HTML publicado se validará y saneará en la API.
 */
function textoParaLectura(html: string): string {
    const sinEtiquetas = html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(
            /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
            " ",
        )
        // Separar párrafos, listas, saltos y celdas.
        .replace(
            /<\/?(?:p|div|br|li|ul|ol|h[1-6]|blockquote|pre|table|tr|td|th|hr)\b[^>]*>/gi,
            " ",
        )
        // El formato en línea no divide una palabra.
        .replace(/<[^>]*>/g, "");

    return sinEtiquetas
        .replace(
            /&#(x[0-9a-f]+|\d+);?/gi,
            (_, codigo: string) => {
                const hexadecimal =
                    codigo[0].toLowerCase() === "x";

                const numero = Number.parseInt(
                    hexadecimal ? codigo.slice(1) : codigo,
                    hexadecimal ? 16 : 10,
                );

                if (
                    !Number.isFinite(numero) ||
                    numero <= 0 ||
                    numero > 0x10ffff ||
                    (numero >= 0xd800 && numero <= 0xdfff)
                ) {
                    return " ";
                }

                return String.fromCodePoint(numero);
            },
        )
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        // Las entidades restantes no cuentan como nombres de palabras.
        .replace(/&[a-z][a-z0-9]+;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function contarPalabras(texto: string): number {
    const palabras = texto.match(
        /[\p{L}\p{N}]+(?:['’·-][\p{L}\p{N}]+)*/gu,
    );

    return palabras?.length ?? 0;
}

export type EstimacionLectura = {
    palabras: number;
    imagenes: number;
    minutos: number;
};

/**
 * Estimación editorial:
 *
 * - 200 palabras por minuto.
 * - 10 segundos por imagen.
 * - Incluye titular, subtítulo, títulos de bloques y citas.
 * - Cuenta la portada cuando existe.
 * - Un documento vacío devuelve 0.
 *
 * La misma función se utilizará al editar y al publicar.
 */
export function calcularLecturaNoticia(
    noticia: Pick<
        FormularioNoticia,
        "titular" | "subtitulo" | "cover_image" | "content"
    >,
): EstimacionLectura {
    const textos: string[] = [
        noticia.titular,
        noticia.subtitulo,
    ];

    let imagenes = noticia.cover_image.trim() ? 1 : 0;

    for (const bloque of noticia.content) {
        textos.push(bloque.title);

        switch (bloque.type) {
            case "text":
                textos.push(textoParaLectura(bloque.body));
                break;

            case "cita":
                textos.push(bloque.body.text, bloque.body.autor);
                break;

            case "imagen":
                if (bloque.body.url.trim()) {
                    imagenes += 1;
                    textos.push(bloque.body.autor ?? "");
                }
                break;

            case "galeria":
                for (const imagen of bloque.body) {
                    if (imagen.url.trim()) {
                        imagenes += 1;
                        textos.push(imagen.autor ?? "");
                    }
                }
                break;
        }
    }

    const palabras = textos.reduce(
        (total, texto) => total + contarPalabras(texto),
        0,
    );

    const segundos =
        (palabras / 200) * 60 +
        imagenes * 10;

    return {
        palabras,
        imagenes,
        minutos: segundos > 0
            ? Math.max(1, Math.ceil(segundos / 60))
            : 0,
    };
}