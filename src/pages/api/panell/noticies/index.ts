import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import sanitizeHtml from "sanitize-html";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso } from "@const/Permisos";

import {
    CATEGORIAS_NOTICIAS,
    ESTADOS_NOTICIA,
    calcularLecturaNoticia,
    generarSlugNoticia,
    type BloqueNoticia,
    type FormularioNoticia,
    type ImagenNoticia,
} from "@const/Noticias";

export const prerender = false;

// ============================================================
// CONFIGURACIÓN
// ============================================================

const TABLA = "Noticis";
const BUCKET = "NoticiasIMG";

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TAMANO_PAGINA = 20;
const MAX_JSON_BYTES = 1_000_000;
const MAX_IMAGEN_BYTES = 3 * 1024 * 1024;
const MAX_BLOQUES = 100;

// Una cadena literal, para conservar la inferencia de Supabase.
const CAMPOS =
    "id,titular,subtitulo,cover_image,slug,author,author_curso,status,created_at,publication_date,content,tiempo_lectura,categoria,last_save,torneo_id";

const CAMPOS_LISTADO =
    "id,titular,subtitulo,cover_image,slug,author,author_curso,status,created_at,publication_date,tiempo_lectura,categoria,last_save,torneo_id";

type Usuario = NonNullable<
    Awaited<ReturnType<typeof obtenerUsuarioPorToken>>
>;

type Accion = "ver" | "crear" | "editar" | "eliminar";
type Registro = Record<string, unknown>;

type Torneo = {
    id: string;
    nombre: string | null;
    deporte: string | null;
};

// ============================================================
// RESPUESTAS
// ============================================================

class ErrorAPI extends Error {
    constructor(
        public estado: number,
        mensaje: string,
    ) {
        super(mensaje);
    }
}

function responder(datos: unknown, estado = 200) {
    return Response.json(datos, {
        status: estado,
        headers: {
            "Cache-Control": "private, no-store",
        },
    });
}

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

    console.error("Error en la API de notícies:", error);

    return responder(
        {
            success: false,
            mensaje: "No s'ha pogut completar l'operació.",
        },
        500,
    );
}

// ============================================================
// VALIDACIÓN BÁSICA
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function leerID(valor: unknown, nombre = "identificador") {
    if (typeof valor !== "string" || !UUID.test(valor)) {
        throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
    }

    return valor.toLowerCase();
}

function leerTexto(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
): string {
    if (valor === undefined || valor === null) {
        if (obligatorio) {
            throw new ErrorAPI(400, `Falta el camp ${nombre}.`);
        }

        return "";
    }

    if (typeof valor !== "string") {
        throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
    }

    const texto = valor.trim();

    if (texto.length > maximo) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} supera els ${maximo} caràcters.`,
        );
    }

    if (obligatorio && !texto) {
        throw new ErrorAPI(400, `Falta el camp ${nombre}.`);
    }

    return texto;
}

function leerVersion(cuerpo: Registro): string | null {
    if (!Object.hasOwn(cuerpo, "last_save")) {
        throw new ErrorAPI(
            400,
            "Falta la versió de la notícia que estàs modificant.",
        );
    }

    if (cuerpo.last_save === null) return null;

    if (
        typeof cuerpo.last_save !== "string" ||
        !Number.isFinite(Date.parse(cuerpo.last_save))
    ) {
        throw new ErrorAPI(400, "La versió de la notícia no és vàlida.");
    }

    return cuerpo.last_save;
}

async function leerJSON(request: Request): Promise<Registro> {
    const longitud = Number(request.headers.get("content-length") || 0);

    if (longitud > MAX_JSON_BYTES) {
        throw new ErrorAPI(413, "El contingut de la notícia és massa gran.");
    }

    const texto = await request.text();

    if (Buffer.byteLength(texto, "utf8") > MAX_JSON_BYTES) {
        throw new ErrorAPI(413, "El contingut de la notícia és massa gran.");
    }

    let valor: unknown;

    try {
        valor = JSON.parse(texto);
    } catch {
        throw new ErrorAPI(400, "La petició no conté un JSON vàlid.");
    }

    if (!esRegistro(valor)) {
        throw new ErrorAPI(400, "La petició no és vàlida.");
    }

    return valor;
}

// ============================================================
// PERMISOS
// ============================================================

function puede(
    usuario: Usuario,
    accion: Accion,
    torneoID: string | null,
): boolean {
    const ambito = torneoID ?? undefined;

    return (
        tienePermiso(usuario, "panell", "ver", ambito) &&
        tienePermiso(usuario, "noticies", "ver", ambito) &&
        (
            accion === "ver" ||
            tienePermiso(usuario, "noticies", accion, ambito)
        )
    );
}

function exigirPermiso(
    usuario: Usuario,
    accion: Accion,
    torneoID: string | null,
) {
    if (!puede(usuario, accion, torneoID)) {
        throw new ErrorAPI(
            403,
            "No tens permís per fer aquesta operació en aquest àmbit.",
        );
    }
}

// ============================================================
// TORNEOS Y NOTICIAS
// ============================================================

async function obtenerTorneos(): Promise<Torneo[]> {
    const resultado: Torneo[] = [];

    for (let desde = 0; ; desde += 100) {
        const { data, error } = await supabaseAdmin
            .from("torneos")
            .select("id,nombre,deporte")
            .order("id", { ascending: true })
            .range(desde, desde + 99);

        if (error) throw error;

        const lote = data ?? [];
        resultado.push(...lote);

        if (lote.length < 100) break;
    }

    return resultado;
}

async function exigirTorneo(id: string) {
    const { data, error } = await supabaseAdmin
        .from("torneos")
        .select("id,nombre,deporte")
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new ErrorAPI(404, "El torneig seleccionat no existeix.");
    }

    return data;
}

async function obtenerNoticia(id: string) {
    const { data, error } = await supabaseAdmin
        .from(TABLA)
        .select(CAMPOS)
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new ErrorAPI(404, "No s'ha trobat la notícia.");
    }

    return data;
}

// ============================================================
// IMÁGENES PERSISTIDAS
// ============================================================

const referenciaBucket = new URL(
    supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl("__referencia__").data.publicUrl,
);

const prefijoBucket = referenciaBucket.pathname.slice(
    0,
    referenciaBucket.pathname.lastIndexOf("/") + 1,
);

/**
 * Solo se guardan imágenes del bucket del proyecto.
 * No se aceptan blob:, data: ni direcciones temporales.
 */
function leerURLImagen(
    valor: unknown,
    obligatoria = false,
): string {
    const texto = leerTexto(valor, "imatge", 4000, obligatoria);

    if (!texto) return "";

    let url: URL;

    try {
        url = new URL(texto);
    } catch {
        throw new ErrorAPI(400, "L'adreça de la imatge no és vàlida.");
    }

    if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.origin !== referenciaBucket.origin ||
        !url.pathname.startsWith(prefijoBucket) ||
        url.pathname === prefijoBucket
    ) {
        throw new ErrorAPI(
            400,
            "La imatge s'ha de pujar al repositori d'imatges de notícies.",
        );
    }

    url.hash = "";

    return url.toString();
}

function leerImagen(valor: unknown): ImagenNoticia {
    if (!esRegistro(valor)) {
        throw new ErrorAPI(400, "Hi ha un bloc d'imatge no vàlid.");
    }

    return {
        id: leerTexto(valor.id, "identificador de la imatge", 150),
        url: leerURLImagen(valor.url, true),
        alt: leerTexto(valor.alt, "text alternatiu", 500),
        autor: leerTexto(valor.autor, "autoria de la imatge", 250),
    };
}

// ============================================================
// TEXTO ENRIQUECIDO
// ============================================================

function limpiarHTML(valor: unknown): string {
    const html = leerTexto(valor, "contingut del bloc", 150_000);

    return sanitizeHtml(html, {
        allowedTags: [
            "p", "div", "br",
            "strong", "b", "em", "i", "u",
            "s", "strike", "del",
            "h2", "h3", "h4",
            "ul", "ol", "li",
            "blockquote", "a", "span",
            "sub", "sup", "hr",
        ],

        allowedAttributes: {
            a: ["href", "title", "target", "rel"],
            p: ["style"],
            div: ["style"],
            span: ["style"],
            h2: ["style"],
            h3: ["style"],
            h4: ["style"],
            li: ["style"],
            blockquote: ["style"],
        },

        allowedStyles: {
            "*": {
                "text-align": [/^(left|center|right|justify)$/],
                "font-weight": [/^(normal|bold|[1-9]00)$/],
                "font-style": [/^(normal|italic)$/],
                "text-decoration": [
                    /^(none|underline|line-through|underline line-through)$/,
                ],
            },
        },

        allowedSchemes: ["https", "http", "mailto"],
        allowProtocolRelative: false,

        transformTags: {
            a: (_nombre, atributos) => ({
                tagName: "a",
                attribs: {
                    href: atributos.href || "",
                    title: atributos.title || "",
                    target: "_blank",
                    rel: "noopener noreferrer",
                },
            }),
        },
    });
}

// ============================================================
// BLOQUES
// ============================================================

function leerBloques(valor: unknown): BloqueNoticia[] {
    if (!Array.isArray(valor) || valor.length > MAX_BLOQUES) {
        throw new ErrorAPI(
            400,
            `El contingut ha de tenir com a màxim ${MAX_BLOQUES} blocs.`,
        );
    }

    const ids = new Set<string>();

    const bloques = valor.map((entrada): BloqueNoticia => {
        if (!esRegistro(entrada)) {
            throw new ErrorAPI(400, "Hi ha un bloc de contingut no vàlid.");
        }

        const id = leerTexto(entrada.id, "identificador del bloc", 150, true);

        if (ids.has(id)) {
            throw new ErrorAPI(400, "Hi ha blocs amb identificadors repetits.");
        }

        ids.add(id);

        if (
            typeof entrada.order !== "number" ||
            !Number.isSafeInteger(entrada.order) ||
            entrada.order < 0
        ) {
            throw new ErrorAPI(400, "L'ordre d'un bloc no és vàlid.");
        }

        const base = {
            id,
            order: entrada.order,
            title: leerTexto(entrada.title, "títol del bloc", 300),
        };

        switch (entrada.type) {
            case "text":
                return {
                    ...base,
                    type: "text",
                    body: limpiarHTML(entrada.body),
                };

            case "imagen":
                return {
                    ...base,
                    type: "imagen",
                    body: leerImagen(entrada.body),
                };

            case "cita": {
                if (!esRegistro(entrada.body)) {
                    throw new ErrorAPI(400, "Hi ha una cita no vàlida.");
                }

                return {
                    ...base,
                    type: "cita",
                    body: {
                        text: leerTexto(
                            entrada.body.text,
                            "text de la cita",
                            10_000,
                            true,
                        ),
                        autor: leerTexto(
                            entrada.body.autor,
                            "autor de la cita",
                            250,
                        ),
                    },
                };
            }

            case "galeria": {
                if (
                    !Array.isArray(entrada.body) ||
                    entrada.body.length > 30
                ) {
                    throw new ErrorAPI(400, "La galeria no és vàlida.");
                }

                return {
                    ...base,
                    type: "galeria",
                    body: entrada.body.map(leerImagen),
                };
            }

            default:
                throw new ErrorAPI(400, "Hi ha un tipus de bloc no reconegut.");
        }
    });

    // Conserva el orden visual y normaliza la numeración.
    return bloques
        .sort((a, b) => a.order - b.order)
        .map((bloque, indice) => ({
            ...bloque,
            order: indice + 1,
        }));
}

function leerFormulario(valor: unknown): FormularioNoticia {
    if (!esRegistro(valor)) {
        throw new ErrorAPI(400, "Falten les dades de la notícia.");
    }

    const titular = leerTexto(valor.titular, "titular", 300, true);

    const slug =
        leerTexto(valor.slug, "slug", 200) ||
        generarSlugNoticia(titular);

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        throw new ErrorAPI(
            400,
            "El slug només pot contenir lletres minúscules sense accents, números i guions.",
        );
    }

    return {
        titular,
        subtitulo: leerTexto(valor.subtitulo, "subtítol", 1000),
        cover_image: leerURLImagen(valor.cover_image),
        slug,
        author: leerTexto(valor.author, "autor", 250, true),
        author_curso: leerTexto(valor.author_curso, "curs de l'autor", 150),
        categoria: leerTexto(valor.categoria, "categoria", 150, true),
        torneo_id: leerID(valor.torneo_id, "torneig"),
        content: leerBloques(valor.content),
    };
}

// ============================================================
// LISTADO
// ============================================================

async function listar(usuario: Usuario, url: URL) {
    const torneos = await obtenerTorneos();

    const accesibles = torneos.filter(
        (torneo) => puede(usuario, "ver", torneo.id),
    );

    // Noticias antiguas que todavía no tienen torneo.
    const puedeVerSinTorneo = puede(usuario, "ver", null);

    const paginaTexto = url.searchParams.get("pagina") || "1";

    if (!/^[1-9]\d*$/.test(paginaTexto)) {
        throw new ErrorAPI(400, "La pàgina no és vàlida.");
    }

    const pagina = Number(paginaTexto);

    if (!Number.isSafeInteger(pagina) || pagina > 100_000) {
        throw new ErrorAPI(400, "La pàgina no és vàlida.");
    }

    const categoria = (url.searchParams.get("categoria") || "")
        .trim()
        .slice(0, 150);

    const busqueda = (url.searchParams.get("q") || "")
        .trim()
        .slice(0, 120);

    const torneoParametro = url.searchParams.get("torneoID");

    let consulta = supabaseAdmin
        .from(TABLA)
        .select(CAMPOS_LISTADO, { count: "exact" });

    if (torneoParametro) {
        const id = leerID(torneoParametro, "torneig");

        await exigirTorneo(id);
        exigirPermiso(usuario, "ver", id);

        consulta = consulta.eq("torneo_id", id);
    } else {
        const ids = accesibles.map((torneo) => torneo.id);

        if (ids.length === 0 && !puedeVerSinTorneo) {
            return responder({
                success: true,
                filas: [],
                total: 0,
                pagina,
                porPagina: TAMANO_PAGINA,
                totalPaginas: 1,
            });
        }

        if (ids.length > 0 && puedeVerSinTorneo) {
            consulta = consulta.or(
                `torneo_id.in.(${ids.join(",")}),torneo_id.is.null`,
            );
        } else if (ids.length > 0) {
            consulta = consulta.in("torneo_id", ids);
        } else {
            consulta = consulta.is("torneo_id", null);
        }
    }

    if (categoria) {
        consulta = consulta.eq("categoria", categoria);
    }

    const palabras = busqueda
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6);

    for (const palabra of palabras) {
        consulta = consulta.or(
            `titular.ilike.%${palabra}%,subtitulo.ilike.%${palabra}%`,
        );
    }

    const desde = (pagina - 1) * TAMANO_PAGINA;

    const { data, count, error } = await consulta
        .order("publication_date", {
            ascending: false,
            nullsFirst: false,
        })
        .order("id", { ascending: false })
        .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) throw error;

    const nombres = new Map(
        torneos.map((torneo) => [torneo.id, torneo.nombre]),
    );

    const filas = (data ?? []).map((noticia) => ({
        ...noticia,
        torneo_nombre: noticia.torneo_id
            ? nombres.get(noticia.torneo_id) ?? null
            : null,
        puedeEditar: puede(usuario, "editar", noticia.torneo_id),
        puedeEliminar: puede(usuario, "eliminar", noticia.torneo_id),
    }));

    const total = count ?? 0;

    return responder({
        success: true,
        filas,
        total,
        pagina,
        porPagina: TAMANO_PAGINA,
        totalPaginas: Math.max(1, Math.ceil(total / TAMANO_PAGINA)),
    });
}

// ============================================================
// SUBIDA DE IMÁGENES
// ============================================================

async function subirImagen(usuario: Usuario, request: Request) {
    const longitud = Number(request.headers.get("content-length") || 0);

    if (longitud > MAX_IMAGEN_BYTES + 128_000) {
        throw new ErrorAPI(413, "La imatge no pot superar els 3 MB.");
    }

    const form = await request.formData();

    if (form.get("accion") !== "subir-imagen") {
        throw new ErrorAPI(400, "L'acció de pujada no és vàlida.");
    }

    const torneoID = leerID(form.get("torneo_id"), "torneig");
    const noticiaID = form.get("noticia_id");

    await exigirTorneo(torneoID);

    if (noticiaID) {
        const noticia = await obtenerNoticia(
            leerID(noticiaID, "notícia"),
        );

        exigirPermiso(usuario, "editar", noticia.torneo_id);

        if (noticia.torneo_id !== torneoID) {
            exigirPermiso(usuario, "crear", torneoID);
        }
    } else {
        exigirPermiso(usuario, "crear", torneoID);
    }

    const archivo = form.get("file");

    if (!(archivo instanceof File) || archivo.size === 0) {
        throw new ErrorAPI(400, "Selecciona una imatge.");
    }

    if (archivo.size > MAX_IMAGEN_BYTES) {
        throw new ErrorAPI(413, "La imatge no pot superar els 3 MB.");
    }

    const buffer = Buffer.from(await archivo.arrayBuffer());

    let convertido: Buffer;

    try {
        const imagen = sharp(buffer, {
            limitInputPixels: 40_000_000,
            failOn: "error",
        });

        const metadata = await imagen.metadata();

        if (
            !metadata.format ||
            !["jpeg", "png", "webp", "avif"].includes(metadata.format)
        ) {
            throw new Error("Formato no admitido");
        }

        if ((metadata.pages ?? 1) > 1) {
            throw new Error("Imagen animada no admitida");
        }

        convertido = await imagen
            .rotate()
            .resize({
                width: 2400,
                height: 2400,
                fit: "inside",
                withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();
    } catch {
        throw new ErrorAPI(
            400,
            "Utilitza una imatge estàtica JPG, PNG, WebP o AVIF vàlida.",
        );
    }

    const archivoID = randomUUID();

    const ruta =
        `${torneoID}/${usuario.id}/${archivoID}.webp`;

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(ruta, convertido, {
            contentType: "image/webp",
            cacheControl: "31536000",
            upsert: false,
        });

    if (error) throw error;

    const { data } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(ruta);

    return responder({
        success: true,
        imagen: {
            id: archivoID,
            url: data.publicUrl,
        },
    });
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
    try {
        const token = cookies.get("token_sesion")?.value;

        const usuario = token
            ? await obtenerUsuarioPorToken(token)
            : null;

        if (!usuario) {
            throw new ErrorAPI(401, "Has d'iniciar sessió.");
        }

        if (!tienePermiso(usuario, "panell", "ver")) {
            throw new ErrorAPI(403, "No tens accés al panell.");
        }

        const vista = url.searchParams.get("vista") || "lista";

        if (vista === "configuracion") {
            const todos = await obtenerTorneos();

            const torneos = todos
                .filter((torneo) => puede(usuario, "ver", torneo.id))
                .map((torneo) => ({
                    ...torneo,
                    puedeCrear: puede(usuario, "crear", torneo.id),
                }));

            return responder({
                success: true,
                categorias: CATEGORIAS_NOTICIAS,
                torneos,
                puedeCrear: torneos.some((torneo) => torneo.puedeCrear),
                autor: {
                    nombre: [
                        usuario.nombre,
                        usuario.apellido1,
                        usuario.apellido2,
                    ].filter(Boolean).join(" "),
                    curso: usuario.curso || "",
                },
                limites: {
                    imagenBytes: MAX_IMAGEN_BYTES,
                    bloques: MAX_BLOQUES,
                },
            });
        }

        if (vista === "lista") {
            return await listar(usuario, url);
        }

        if (vista === "detalle") {
            const id = leerID(url.searchParams.get("id"), "notícia");
            const noticia = await obtenerNoticia(id);

            exigirPermiso(usuario, "ver", noticia.torneo_id);

            let torneoNombre: string | null = null;

            if (noticia.torneo_id) {
                const { data, error } = await supabaseAdmin
                    .from("torneos")
                    .select("nombre")
                    .eq("id", noticia.torneo_id)
                    .maybeSingle();

                if (error) throw error;
                torneoNombre = data?.nombre ?? null;
            }

            // Sanea también noticias antiguas antes de mostrarlas.
            // No modifica la fila de la base de datos.
            const content = leerBloques(noticia.content ?? []);

            return responder({
                success: true,
                noticia: {
                    ...noticia,
                    content,
                    torneo_nombre: torneoNombre,
                },
                capacidades: {
                    editar: puede(usuario, "editar", noticia.torneo_id),
                    eliminar: puede(usuario, "eliminar", noticia.torneo_id),
                },
            });
        }

        throw new ErrorAPI(400, "La consulta indicada no és vàlida.");
    } catch (error) {
        return responderError(error);
    }
};

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ cookies, request }) => {
    try {
        const token = cookies.get("token_sesion")?.value;

        const usuario = token
            ? await obtenerUsuarioPorToken(token)
            : null;

        if (!usuario) {
            throw new ErrorAPI(401, "Has d'iniciar sessió.");
        }

        if (!tienePermiso(usuario, "panell", "ver")) {
            throw new ErrorAPI(403, "No tens accés al panell.");
        }

        // El middleware existente comprueba el origen.
        // Esta API comprueba sesión y permisos en cada operación.
        const tipo = (request.headers.get("content-type") || "")
            .split(";")[0]
            .trim()
            .toLowerCase();

        if (tipo === "multipart/form-data") {
            return await subirImagen(usuario, request);
        }

        if (tipo !== "application/json") {
            throw new ErrorAPI(415, "El format de la petició no és vàlid.");
        }

        const cuerpo = await leerJSON(request);
        const accion = cuerpo.accion;

        if (
            accion !== "crear" &&
            accion !== "editar" &&
            accion !== "eliminar"
        ) {
            throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
        }

        // ====================================================
        // ELIMINAR
        // ====================================================

        if (accion === "eliminar") {
            const id = leerID(cuerpo.id, "notícia");
            const version = leerVersion(cuerpo);
            const anterior = await obtenerNoticia(id);

            exigirPermiso(usuario, "eliminar", anterior.torneo_id);

            if (version !== anterior.last_save) {
                throw new ErrorAPI(
                    409,
                    "La notícia ha canviat. Torna a carregar-la abans d'eliminar-la.",
                );
            }

            let consulta = supabaseAdmin
                .from(TABLA)
                .delete()
                .eq("id", id);

            consulta = version === null
                ? consulta.is("last_save", null)
                : consulta.eq("last_save", version);

            // También protege frente a un cambio de ámbito concurrente.
            consulta = anterior.torneo_id === null
                ? consulta.is("torneo_id", null)
                : consulta.eq("torneo_id", anterior.torneo_id);

            const { data, error } = await consulta
                .select("id")
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                throw new ErrorAPI(
                    409,
                    "La notícia s'ha modificat o eliminat abans de completar l'operació.",
                );
            }

            // No borra imágenes: podrían estar referenciadas
            // por otra noticia o por un borrador.
            return responder({
                success: true,
                mensaje: "Notícia eliminada correctament.",
            });
        }

        // ====================================================
        // VALIDAR CONTENIDO
        // ====================================================

        const formulario = leerFormulario(cuerpo.noticia);

        await exigirTorneo(formulario.torneo_id);

        const lectura = calcularLecturaNoticia(formulario);

        const fechaActual = new Date().toISOString();

        const camposEditables = {
            titular: formulario.titular,
            subtitulo: formulario.subtitulo,
            cover_image: formulario.cover_image,
            slug: formulario.slug,
            author: formulario.author,
            author_curso: formulario.author_curso,
            categoria: formulario.categoria,
            torneo_id: formulario.torneo_id,
            content: formulario.content,
            tiempo_lectura: String(lectura.minutos),
            last_save: fechaActual,
        };

        // ====================================================
        // CREAR Y PUBLICAR
        // ====================================================

        if (accion === "crear") {
            exigirPermiso(usuario, "crear", formulario.torneo_id);

            const { data, error } = await supabaseAdmin
                .from(TABLA)
                .insert({
                    ...camposEditables,
                    status: ESTADOS_NOTICIA.publicado,
                    created_at: fechaActual,
                    publication_date: fechaActual,
                })
                .select("id,slug,last_save,tiempo_lectura")
                .single();

            if (error) throw error;

            return responder(
                {
                    success: true,
                    mensaje: "Notícia publicada correctament.",
                    noticia: data,
                },
                201,
            );
        }

        // ====================================================
        // EDITAR
        // ====================================================

        const id = leerID(cuerpo.id, "notícia");
        const version = leerVersion(cuerpo);
        const anterior = await obtenerNoticia(id);

        exigirPermiso(usuario, "editar", anterior.torneo_id);

        // Trasladar una noticia exige además poder crear
        // noticias en el torneo de destino.
        if (anterior.torneo_id !== formulario.torneo_id) {
            exigirPermiso(usuario, "crear", formulario.torneo_id);
        }

        if (version !== anterior.last_save) {
            throw new ErrorAPI(
                409,
                "Una altra persona ha actualitzat aquesta notícia. Torna a carregar-la abans de desar.",
            );
        }

        // Se conserva la categoría antigua aunque ya no forme
        // parte de la lista inicial de categorías.
        //
        // created_at, publication_date y status no se actualizan.
        let consulta = supabaseAdmin
            .from(TABLA)
            .update(camposEditables)
            .eq("id", id);

        consulta = version === null
            ? consulta.is("last_save", null)
            : consulta.eq("last_save", version);

        consulta = anterior.torneo_id === null
            ? consulta.is("torneo_id", null)
            : consulta.eq("torneo_id", anterior.torneo_id);

        const { data, error } = await consulta
            .select("id,slug,last_save,tiempo_lectura")
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new ErrorAPI(
                409,
                "La notícia ha canviat mentre desaves. Revisa la versió actual abans de tornar-ho a provar.",
            );
        }

        return responder({
            success: true,
            mensaje: "Notícia actualitzada correctament.",
            noticia: data,
        });
    } catch (error) {
        return responderError(error);
    }
};