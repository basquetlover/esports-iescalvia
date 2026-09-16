type BloqueTexto = {
    id: string;
    order: number;
    type: "text";
    title: string;
    body: string;
};

type BloqueImagen = {
    id: string;
    order: number;
    type: "imagen";
    title: string;
    body: {
        id: string;
        url: string;
        alt: string;
        autor: string;
    };
};

type BloqueCita = {
    id: string;
    order: number;
    type: "cita";
    title: string;
    body: {
        text: string;
        autor: string;
    };
};

type BloqueGaleria = {
    id: string;
    order: number;
    type: "galeria";
    title: string;
    body: {
        id: string;
        url: string;
        alt?: string;
        autor?: string;
    }[];
};

type Bloque =
    | BloqueTexto
    | BloqueImagen
    | BloqueCita
    | BloqueGaleria;

export type NoticiaPublica = {
    id: string;
    titular: string;
    subtitulo: string;
    cover_image: string;
    slug: string;

    author: string;
    author_curso: string;

    status: string;

    created_at: string;
    publication_date: string;

    content: Bloque[];

    tiempo_lectura: string;
    categoria: string;

    torneo_id?: string | null;
    torneo_nombre?: string | null;
};

const mesosCatala = [
    "gen.",
    "febr.",
    "març",
    "abr.",
    "maig",
    "juny",
    "jul.",
    "ag.",
    "set.",
    "oct.",
    "nov.",
    "des.",
];

export function formatDataCatalaFromISO(
    isoString?: string
): string {
    if (!isoString) {
        return "Data inválida";
    }

    const date =
        new Date(isoString);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "Data inválida";
    }

    const dia =
        date.getDate();

    const mes =
        mesosCatala[
            date.getMonth()
        ];

    const any =
        date.getFullYear();

    return `${dia} ${mes} ${any}`;
}

export default function VerNoticia({
    noticiaData,
}: {
    noticiaData: NoticiaPublica;
}) {
    const data =
        noticiaData;

    const bloques =
        [...(data.content ?? [])]
            .sort(
                (a, b) =>
                    a.order -
                    b.order
            );

    return (
        <>
            <div className="w-full h-full relative">
                {/* =============================================
                    PORTADA
                ============================================= */}

                <div className="relative w-full aspect-2/1 flex flex-col items-center">
                    {data.cover_image && (
                        <img
                            src={
                                data.cover_image
                            }
                            alt={
                                data.titular
                            }
                            className="w-full h-full object-cover degradado-img z-0"
                        />
                    )}
                </div>

                {/* =============================================
                    CONTENIDO PRINCIPAL
                ============================================= */}

                <div className="w-full mx-auto flex flex-col items-center -mt-20 px-5 text-blanco">

                    {/* =========================================
                        TARJETA DE CABECERA
                    ========================================= */}

                    <div className="max-w-4xl rounded-2xl w-full min-h-76 border border-gris-claro shadow-gris-claro shadow-md bg-gris z-10 flex flex-col p-4">

                        {/* =====================================
                            METADATOS
                        ===================================== */}

                        <div className="w-full flex items-center text-gray-400 min-w-0 overflow-hidden">

                            {/* Categoría */}

                            <p className="shrink-0 text-secondary">
                                {
                                    data.categoria
                                }
                            </p>

                            {/* Separador */}

                            {data.torneo_nombre && (
                                <span className="w-1 h-1 mx-3 bg-gray-400 rounded-full shrink-0">&nbsp;</span>
                            )}

                            {/* Torneo */}

                            {data.torneo_nombre && (
                                <p
                                    title={
                                        data.torneo_nombre
                                    }
                                    className="min-w-0 truncate "
                                >
                                    {
                                        data.torneo_nombre
                                    }
                                </p>
                            )}

                            {/* Separador */}

                            <span className="w-1 h-1 mx-3 bg-gray-400 rounded-full shrink-0" />

                            {/* Tiempo */}

                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4 fill-gray-400 shrink-0"
                                viewBox="0 -960 960 960"
                                aria-hidden="true"
                            >
                                <path d="m612-292 56-56-148-148v-184h-80v216zM480-80q-83 0-156-31.5T197-197t-85.5-127T80-480t31.5-156T197-763t127-85.5T480-880t156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80m0-80q133 0 226.5-93.5T800-480t-93.5-226.5T480-800t-226.5 93.5T160-480t93.5 226.5T480-160" />
                            </svg>

                            <p className="ml-1 shrink-0">
                                {
                                    data.tiempo_lectura
                                }{" "}
                                min
                            </p>
                        </div>

                        {/* =====================================
                            TITULAR
                        ===================================== */}

                        <h1 className="text-3xl font-semibold mt-2">
                            {
                                data.titular
                            }
                        </h1>

                        {/* =====================================
                            SUBTÍTULO
                        ===================================== */}

                        <h2 className="mt-5 text-2xl italic text-gray-200">
                            {
                                data.subtitulo
                            }
                        </h2>

                        {/* =====================================
                            SEPARADOR
                        ===================================== */}

                        <div className="w-[98%] h-px rounded bg-gray-500 mx-auto my-5">
                            &nbsp;
                        </div>

                        {/* =====================================
                            AUTOR
                        ===================================== */}

                        <div className="w-full flex flex-row items-center place-content-between">
                            <div className="text-sm font-light space-y-0.5">

                                <p>
                                    {
                                        data.author
                                    }

                                    {data.author_curso && (
                                        <>
                                            ,{" "}
                                            {
                                                data.author_curso
                                            }
                                        </>
                                    )}
                                </p>

                                <p>
                                    {formatDataCatalaFromISO(
                                        data.publication_date ||
                                            data.created_at
                                    )}
                                </p>
                            </div>

                            <div>
                            </div>
                        </div>
                    </div>

                    {/* =========================================
                        CUERPO DE LA NOTICIA
                    ========================================= */}

                    <div className="max-w-4xl mx-auto w-full h-full mt-5 mb-10 tracking-wider">

                        <div className="w-full h-auto mb-20 font-light">

                            {bloques.map(
                                (
                                    bloque
                                ) => {
                                    /* =========================
                                        TEXTO
                                    ========================= */

                                    if (
                                        bloque.type ===
                                        "text"
                                    ) {
                                        return (
                                            <div
                                                key={
                                                    bloque.id
                                                }
                                                className="w-full h-auto mt-10 rounded-2xl relative group"
                                            >
                                                {bloque.title && (
                                                    <h3 className="text-2xl font-normal text-white mb-3">
                                                        {
                                                            bloque.title
                                                        }
                                                    </h3>
                                                )}

                                                <div
                                                    className="font-light text-gray-50"
                                                    dangerouslySetInnerHTML={{
                                                        __html:
                                                            bloque.body,
                                                    }}
                                                />
                                            </div>
                                        );
                                    }

                                    /* =========================
                                        CITA
                                    ========================= */

                                    if (
                                        bloque.type ===
                                        "cita"
                                    ) {
                                        return (
                                            <div
                                                key={
                                                    bloque.id
                                                }
                                                className="w-full h-auto rounded-lg mt-10 bg-gris-claro border-l-4 border-primary p-2"
                                            >
                                                <p className="italic text-primary fill-primary">

                                                    <span className="text-xl font-medium">
                                                        "
                                                    </span>

                                                    {
                                                        bloque
                                                            .body
                                                            .text
                                                    }

                                                    <span className="text-xl font-medium">
                                                        "
                                                    </span>
                                                </p>

                                                <p className="mt-3 text-sm flex flex-row items-center">
                                                    —

                                                    {
                                                        bloque
                                                            .body
                                                            .autor
                                                    }
                                                </p>
                                            </div>
                                        );
                                    }

                                    /* =========================
                                        IMAGEN
                                    ========================= */

                                    if (
                                        bloque.type ===
                                        "imagen"
                                    ) {
                                        return (
                                            <div
                                                key={
                                                    bloque.id
                                                }
                                                className="w-full flex flex-col gap-y-1 items-center h-auto mt-10 rounded-2xl relative group"
                                            >
                                                <img
                                                    src={
                                                        bloque
                                                            .body
                                                            .url
                                                    }
                                                    alt={
                                                        bloque
                                                            .body
                                                            .alt
                                                    }
                                                    className="w-max max-w-full h-auto object-cover rounded"
                                                />

                                                {bloque.body.autor && (
                                                    <p className="text-sm text-gray-400 italic">
                                                        {
                                                            bloque
                                                                .body
                                                                .autor
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    }

                                    /* =========================
                                        GALERÍA
                                    ========================= */

                                    if (
                                        bloque.type ===
                                        "galeria"
                                    ) {
                                        return (
                                            <div
                                                key={
                                                    bloque.id
                                                }
                                                className="w-full h-auto mt-10"
                                            >
                                                {bloque.title && (
                                                    <h3 className="text-2xl font-normal text-white mb-3">
                                                        {
                                                            bloque.title
                                                        }
                                                    </h3>
                                                )}

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {bloque.body.map(
                                                        (
                                                            imagen
                                                        ) => (
                                                            <div
                                                                key={
                                                                    imagen.id
                                                                }
                                                                className="flex flex-col gap-y-1 items-center"
                                                            >
                                                                <img
                                                                    src={
                                                                        imagen.url
                                                                    }
                                                                    alt={
                                                                        imagen.alt ??
                                                                        ""
                                                                    }
                                                                    className="w-full h-auto object-cover rounded"
                                                                />

                                                                {imagen.autor && (
                                                                    <p className="text-sm text-gray-400 italic">
                                                                        {
                                                                            imagen.autor
                                                                        }
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return null;
                                }
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}