import { useMemo, useState } from "react";

// ============================================================
// TIPOS
// ============================================================

export type NoticiaPublicaListado = {
    id: string;

    titular: string;
    subtitulo: string;

    cover_image: string;
    slug: string;

    author: string;
    author_curso: string;

    publication_date: string;

    categoria: string;

    torneo_id: string | null;
    torneo_nombre: string | null;
};

type Categoria = {
    nombre: string;
    cantidad: number;
};

type Props = {
    noticias: NoticiaPublicaListado[];
};

// ============================================================
// FECHA
// ============================================================

const mesesCatala = [
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
        return "";
    }

    const date =
        new Date(isoString);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    const dia =
        date.getDate();

    const mes =
        mesesCatala[
            date.getMonth()
        ];

    const any =
        date.getFullYear();

    return `${dia} ${mes} ${any}`;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function LlistaNoticies({
    noticias,
}: Props) {
    const [
        filtro,
        setFiltro,
    ] =
        useState(
            "Totes"
        );

    // ========================================================
    // CATEGORÍAS
    // ========================================================

    const categorias =
        useMemo<Categoria[]>(
            () => {
                const contador =
                    new Map<
                        string,
                        number
                    >();

                for (
                    const noticia
                    of noticias
                ) {
                    const categoria =
                        noticia.categoria?.trim();

                    if (
                        !categoria
                    ) {
                        continue;
                    }

                    contador.set(
                        categoria,
                        (
                            contador.get(
                                categoria
                            ) ?? 0
                        ) + 1
                    );
                }

                return [
                    {
                        nombre:
                            "Totes",

                        cantidad:
                            noticias.length,
                    },

                    ...Array.from(
                        contador.entries()
                    )
                        .sort(
                            (
                                [a],
                                [b]
                            ) =>
                                a.localeCompare(
                                    b,
                                    "ca"
                                )
                        )
                        .map(
                            ([
                                nombre,
                                cantidad,
                            ]) => ({
                                nombre,
                                cantidad,
                            })
                        ),
                ];
            },
            [
                noticias,
            ]
        );

    // ========================================================
    // FILTRO
    // ========================================================

    const noticiasFiltradas =
        useMemo(
            () => {
                if (
                    filtro ===
                    "Totes"
                ) {
                    return noticias;
                }

                return noticias.filter(
                    (
                        noticia
                    ) =>
                        noticia.categoria ===
                        filtro
                );
            },
            [
                noticias,
                filtro,
            ]
        );

    // ========================================================
    // DESTACADA
    // ========================================================

    /*
     * Igual que en la web antigua:
     *
     * cuando estamos viendo "Totes",
     * la noticia más reciente ocupa una tarjeta grande.
     *
     * Al filtrar por categoría,
     * todas aparecen en cuadrícula.
     */
    const noticiaPrincipal =
        filtro ===
            "Totes" &&
        noticiasFiltradas.length >
            0
            ? noticiasFiltradas[0]
            : null;

    const restoNoticias =
        filtro ===
        "Totes"
            ? noticiasFiltradas.slice(
                  1
              )
            : noticiasFiltradas;

    // ========================================================
    // SIN NOTICIAS
    // ========================================================

    if (
        noticias.length ===
        0
    ) {
        return (
            <main
                className="
                    mx-auto
                    w-full
                    max-w-6xl
                    px-4
                    py-12
                    md:py-16
                "
            >
                <div>
                    <h1
                        className="
                            text-4xl
                            font-bold
                            tracking-tight
                            text-neutral-titulos
                            md:text-6xl
                        "
                    >
                        Notícies
                    </h1>

                    <h2
                        className="
                            mt-2
                            text-xl
                            font-medium
                            text-neutral
                            md:text-2xl
                        "
                    >
                        Tota l'actualitat
                        en un sol lloc.
                    </h2>
                </div>

                <div
                    className="
                        mt-10
                        rounded-2xl
                        border
                        border-border
                        bg-card
                        px-6
                        py-14
                        text-center
                    "
                >
                    <p
                        className="
                            text-lg
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        Encara no hi ha
                        notícies publicades.
                    </p>

                    <p
                        className="
                            mt-2
                            text-sm
                            text-neutral
                        "
                    >
                        Torna més endavant
                        per consultar les
                        darreres novetats.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main
            className="
                mx-auto
                w-full
                max-w-6xl
                px-4
                py-12
                md:py-16
            "
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <div>
                <h1
                    className="
                        text-4xl
                        font-bold
                        tracking-tight
                        text-neutral-titulos
                        md:text-6xl
                    "
                >
                    Notícies
                </h1>

                <h2
                    className="
                        mt-2
                        text-xl
                        font-medium
                        text-neutral
                        md:text-2xl
                    "
                >
                    Tota l'actualitat
                    en un sol lloc.
                </h2>
            </div>

            {/* =================================================
                FILTROS
            ================================================= */}

            <section
                className="
                    mt-10
                "
                aria-label="Filtrar notícies"
            >
                <div
                    className="
                        flex
                        items-center
                        gap-x-2
                        text-secondary
                    "
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="
                            h-6
                            w-6
                            shrink-0
                            fill-secondary
                        "
                        viewBox="0 -960 960 960"
                        aria-hidden="true"
                    >
                        <path d="M400-240v-80h160v80zM240-440v-80h480v80zM120-640v-80h720v80z" />
                    </svg>

                    <p
                        className="
                            font-medium
                        "
                    >
                        Filtrar per categoria
                    </p>
                </div>

                <div
                    className="
                        mt-3
                        flex
                        w-full
                        flex-row
                        items-center
                        gap-2
                        overflow-x-auto
                        pb-2
                    "
                >
                    {categorias.map(
                        (
                            categoria
                        ) => {
                            const activa =
                                filtro ===
                                categoria.nombre;

                            return (
                                <button
                                    key={
                                        categoria.nombre
                                    }
                                    type="button"
                                    onClick={() =>
                                        setFiltro(
                                            categoria.nombre
                                        )
                                    }
                                    className={`
                                        shrink-0
                                        cursor-pointer
                                        rounded-full
                                        border
                                        px-4
                                        py-2
                                        text-sm
                                        font-semibold
                                        transition
                                        ${
                                            activa
                                                ? `
                                                    border-primary
                                                    bg-primary
                                                    text-white
                                                  `
                                                : `
                                                    border-border
                                                    bg-card
                                                    text-neutral
                                                    hover:border-secondary
                                                    hover:text-neutral-titulos
                                                  `
                                        }
                                    `}
                                >
                                    {
                                        categoria.nombre
                                    }
                                </button>
                            );
                        }
                    )}
                </div>
            </section>

            {/* =================================================
                NOTICIA PRINCIPAL
            ================================================= */}

            {noticiaPrincipal && (
                <article
                    className="
                        group
                        relative
                        mt-5
                        h-[32rem]
                        w-full
                        overflow-hidden
                        rounded-2xl
                        bg-card
                        md:h-[34rem]
                    "
                >
                    {/* Imagen */}

                    {noticiaPrincipal.cover_image ? (
                        <img
                            src={
                                noticiaPrincipal.cover_image
                            }
                            alt={
                                noticiaPrincipal.titular
                            }
                            className="
                                h-full
                                w-full
                                object-cover
                                transition-transform
                                duration-500
                                group-hover:scale-105
                            "
                        />
                    ) : (
                        <div
                            className="
                                h-full
                                w-full
                                bg-card
                            "
                        />
                    )}

                    {/* Gradiente */}

                    <div
                        className="
                            pointer-events-none
                            absolute
                            inset-0
                            bg-linear-to-t
                            from-black/90
                            via-black/40
                            to-transparent
                        "
                        aria-hidden="true"
                    />

                    {/* Contenido */}

                    <div
                        className="
                            absolute
                            bottom-0
                            left-0
                            flex
                            w-full
                            max-w-4xl
                            flex-col
                            gap-y-4
                            p-5
                            md:p-8
                        "
                    >
                        {/* Categoría + torneo */}

                        <div
                            className="
                                flex
                                min-w-0
                                items-center
                                gap-2
                            "
                        >
                            <span
                                className="
                                    shrink-0
                                    rounded
                                    bg-secondary
                                    px-2
                                    py-1
                                    text-xs
                                    font-semibold
                                    text-white
                                "
                            >
                                {
                                    noticiaPrincipal.categoria
                                }
                            </span>

                            {noticiaPrincipal.torneo_nombre && (
                                <span
                                    title={
                                        noticiaPrincipal.torneo_nombre
                                    }
                                    className="
                                        min-w-0
                                        max-w-64
                                        truncate
                                        rounded
                                        border
                                        border-white/20
                                        bg-black/30
                                        px-2
                                        py-1
                                        text-xs
                                        font-medium
                                        text-white
                                        backdrop-blur-sm
                                    "
                                >
                                    {
                                        noticiaPrincipal.torneo_nombre
                                    }
                                </span>
                            )}
                        </div>

                        {/* Titular */}

                        <h2
                            className="
                                line-clamp-3
                                text-2xl
                                font-extrabold
                                leading-tight
                                text-white
                                md:text-4xl
                            "
                        >
                            {
                                noticiaPrincipal.titular
                            }
                        </h2>

                        {/* Subtítulo */}

                        {noticiaPrincipal.subtitulo && (
                            <p
                                className="
                                    line-clamp-2
                                    text-base
                                    font-medium
                                    italic
                                    text-gray-200
                                    md:text-xl
                                "
                            >
                                {
                                    noticiaPrincipal.subtitulo
                                }
                            </p>
                        )}

                        {/* Datos */}

                        <div
                            className="
                                flex
                                flex-wrap
                                gap-x-8
                                gap-y-2
                                text-xs
                                text-gray-200
                                md:text-sm
                            "
                        >
                            <span
                                className="
                                    flex
                                    items-center
                                    gap-x-2
                                "
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="
                                        h-4
                                        w-4
                                        fill-current
                                        md:h-5
                                        md:w-5
                                    "
                                    viewBox="0 -960 960 960"
                                    aria-hidden="true"
                                >
                                    <path d="M367-527q-47-47-47-113t47-113 113-47 113 47 47 113-47 113-113 47-113-47M160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440t130 15.5T736-378q29 15 46.5 43.5T800-272v112zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360t-111 13.5T260-306q-9 5-14.5 14t-5.5 20zm296.5-343.5Q560-607 560-640t-23.5-56.5T480-720t-56.5 23.5T400-640t23.5 56.5T480-560t56.5-23.5M480-240" />
                                </svg>

                                {
                                    noticiaPrincipal.author
                                }
                            </span>

                            <span
                                className="
                                    flex
                                    items-center
                                    gap-x-2
                                "
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="
                                        h-4
                                        w-4
                                        fill-current
                                        md:h-5
                                        md:w-5
                                    "
                                    viewBox="0 -960 960 960"
                                    aria-hidden="true"
                                >
                                    <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80zm0-80h560v-400H200zm0-480h560v-80H200zm0 0v-80z" />
                                </svg>

                                {formatDataCatalaFromISO(
                                    noticiaPrincipal.publication_date
                                )}
                            </span>
                        </div>

                        {/* Botón */}

                        <a
                            href={`/noticies/${encodeURIComponent(
                                noticiaPrincipal.slug
                            )}`}
                            className="
                                mt-1
                                inline-flex
                                w-max
                                items-center
                                justify-center
                                gap-x-2
                                rounded-xl
                                bg-primary
                                px-5
                                py-3
                                text-sm
                                font-semibold
                                text-white
                                transition
                                hover:bg-secondary
                            "
                        >
                            Llegir més

                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="
                                    h-5
                                    w-5
                                    fill-current
                                "
                                viewBox="0 -960 960 960"
                                aria-hidden="true"
                            >
                                <path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56z" />
                            </svg>
                        </a>
                    </div>
                </article>
            )}

            {/* =================================================
                RESTO DE NOTICIAS
            ================================================= */}

            {restoNoticias.length >
            0 ? (
                <div
                    className="
                        mt-10
                        grid
                        w-full
                        grid-cols-1
                        gap-6
                        md:grid-cols-2
                        lg:grid-cols-3
                    "
                >
                    {restoNoticias.map(
                        (
                            noticia
                        ) => (
                            <a
                                href={`/noticies/${encodeURIComponent(
                                    noticia.slug
                                )}`}
                                key={
                                    noticia.id
                                }
                                className="
                                    group
                                    grid
                                    min-h-[24rem]
                                    w-full
                                    grid-rows-[12.5rem_1fr]
                                    overflow-hidden
                                    rounded-2xl
                                    border
                                    border-border
                                    bg-card
                                    transition
                                    duration-300
                                    hover:-translate-y-2
                                    hover:border-secondary
                                    hover:shadow-lg
                                "
                            >
                                {/* Imagen */}

                                <div
                                    className="
                                        h-full
                                        w-full
                                        overflow-hidden
                                        bg-muted/20
                                    "
                                >
                                    {noticia.cover_image ? (
                                        <img
                                            src={
                                                noticia.cover_image
                                            }
                                            alt={
                                                noticia.titular
                                            }
                                            loading="lazy"
                                            className="
                                                h-full
                                                w-full
                                                object-cover
                                                transition-transform
                                                duration-500
                                                group-hover:scale-105
                                            "
                                        />
                                    ) : (
                                        <div
                                            className="
                                                h-full
                                                w-full
                                                bg-muted/20
                                            "
                                        />
                                    )}
                                </div>

                                {/* Contenido */}

                                <div
                                    className="
                                        grid
                                        h-full
                                        grid-rows-[1fr_auto]
                                        gap-y-3
                                        p-4
                                    "
                                >
                                    <div
                                        className="
                                            flex
                                            min-w-0
                                            flex-col
                                            gap-y-2
                                        "
                                    >
                                        {/* Categoría + torneo */}

                                        <div
                                            className="
                                                flex
                                                min-w-0
                                                items-center
                                                justify-between
                                                gap-3
                                            "
                                        >
                                            <span
                                                className="
                                                    shrink-0
                                                    rounded
                                                    bg-secondary
                                                    px-2
                                                    py-1
                                                    text-xs
                                                    font-semibold
                                                    text-white
                                                "
                                            >
                                                {
                                                    noticia.categoria
                                                }
                                            </span>

                                            {noticia.torneo_nombre && (
                                                <span
                                                    title={
                                                        noticia.torneo_nombre
                                                    }
                                                    className="
                                                        min-w-0
                                                        max-w-[55%]
                                                        truncate
                                                        text-right
                                                        text-xs
                                                        font-medium
                                                        text-neutral
                                                    "
                                                >
                                                    {
                                                        noticia.torneo_nombre
                                                    }
                                                </span>
                                            )}
                                        </div>

                                        {/* Título */}

                                        <h3
                                            className="
                                                line-clamp-2
                                                text-xl
                                                font-bold
                                                leading-snug
                                                text-neutral-titulos
                                            "
                                        >
                                            {
                                                noticia.titular
                                            }
                                        </h3>

                                        {/* Subtítulo */}

                                        {noticia.subtitulo && (
                                            <p
                                                className="
                                                    line-clamp-2
                                                    text-sm
                                                    italic
                                                    leading-5
                                                    text-neutral
                                                "
                                            >
                                                {
                                                    noticia.subtitulo
                                                }
                                            </p>
                                        )}
                                    </div>

                                    {/* Autor + fecha */}

                                    <div
                                        className="
                                            flex
                                            min-w-0
                                            flex-row
                                            items-center
                                            justify-between
                                            gap-3
                                            border-t
                                            border-border
                                            pt-3
                                            text-xs
                                            text-neutral
                                        "
                                    >
                                        <span
                                            className="
                                                min-w-0
                                                truncate
                                            "
                                        >
                                            {
                                                noticia.author
                                            }
                                        </span>

                                        <span
                                            className="
                                                shrink-0
                                            "
                                        >
                                            {formatDataCatalaFromISO(
                                                noticia.publication_date
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </a>
                        )
                    )}
                </div>
            ) : (
                !noticiaPrincipal && (
                    <div
                        className="
                            mt-10
                            rounded-2xl
                            border
                            border-border
                            bg-card
                            p-10
                            text-center
                        "
                    >
                        <p
                            className="
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            No hi ha
                            notícies en aquesta
                            categoria.
                        </p>
                    </div>
                )
            )}
        </main>
    );
}