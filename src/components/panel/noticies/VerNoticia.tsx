import { useEffect, useState } from "react";

import {
    calcularLecturaNoticia,
    type BloqueNoticia,
    type Noticia,
} from "@const/Noticias";

const API = "/api/panell/noticies";

type Props = {
    noticiaID: string;
};

type DetalleNoticia = Noticia & {
    torneo_nombre: string | null;
};

type RespuestaDetalle = {
    success: true;
    noticia: DetalleNoticia;
    capacidades: {
        editar: boolean;
        eliminar: boolean;
    };
};

const boton =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border bg-background px-4 py-2.5 " +
    "text-sm font-medium text-neutral transition-colors " +
    "hover:border-neutral/40 hover:bg-card " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-neutral/30";

function fechaVisible(valor: string | null) {
    if (!valor) return "Sense data";

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return "Sense data";
    }

    return new Intl.DateTimeFormat("ca-ES", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Madrid",
    }).format(fecha);
}

function fechaValida(valor: string | null): valor is string {
    return (
        typeof valor === "string" &&
        Number.isFinite(Date.parse(valor))
    );
}

function estadoVisible(valor: string | null) {
    switch (valor) {
        case "Public":
            return "Publicada";
        case "Esborrany":
            return "Esborrany";
        default:
            return valor || "Sense estat";
    }
}

function ContenidoBloque({
    bloque,
}: {
    bloque: BloqueNoticia;
}) {
    return (
        <section className="space-y-4 mt-10">
            {bloque.title && (
                <h2 className="wrap-break-words text-xl font-semibold leading-snug sm:text-2xl">
                    {bloque.title}
                </h2>
            )}

            {bloque.type === "text" && (
                <div
                    /*
                     * El contenido procede exclusivamente de la API,
                     * que lo sanea antes de devolverlo.
                     */
                    dangerouslySetInnerHTML={{
                        __html: bloque.body,
                    }}
                    className="
                        wrap-break-words text-base leading-8
                        [&_p]:mb-4 [&_p:last-child]:mb-0
                        [&_a]:underline [&_a]:underline-offset-4
                        [&_a]:decoration-neutral/50
                        [&_a:hover]:decoration-neutral
                        [&_a:focus-visible]:outline
                        [&_a:focus-visible]:outline-offset-2
                        [&_a:focus-visible]:outline-neutral
                        [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6
                        [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6
                        [&_li]:my-1
                        [&_h2]:mb-3 [&_h2]:mt-7
                        [&_h2]:text-xl [&_h2]:font-semibold
                        [&_h3]:mb-3 [&_h3]:mt-6
                        [&_h3]:text-lg [&_h3]:font-semibold
                        [&_h4]:mb-2 [&_h4]:mt-5
                        [&_h4]:font-semibold
                        [&_blockquote]:my-5
                        [&_blockquote]:border-l-2
                        [&_blockquote]:border-border
                        [&_blockquote]:pl-5
                        [&_blockquote]:italic
                        [&_hr]:my-6 [&_hr]:border-border
                    "
                />
            )}

            {bloque.type === "imagen" && (
                <figure className="space-y-3">
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <img
                            src={bloque.body.url}
                            alt={bloque.body.alt || ""}
                            loading="lazy"
                            decoding="async"
                            className="mx-auto max-h-192 w-full object-contain"
                        />
                    </div>

                    {bloque.body.autor && (
                        <figcaption className="text-right text-xs leading-5">
                            Fotografia: {bloque.body.autor}
                        </figcaption>
                    )}
                </figure>
            )}

            {bloque.type === "cita" && (
                <figure className="rounded-r-xl border-l-4 border-neutral/40 bg-card px-5 py-6 sm:px-7">
                    <blockquote className="whitespace-pre-wrap wrap-break-words text-lg italic leading-8">
                        <p>«{bloque.body.text}»</p>
                    </blockquote>

                    {bloque.body.autor && (
                        <figcaption className="mt-4 text-sm font-medium">
                            — {bloque.body.autor}
                        </figcaption>
                    )}
                </figure>
            )}

            {bloque.type === "galeria" && (
                <div className="grid gap-5 sm:grid-cols-2">
                    {bloque.body.map((imagen, indice) => (
                        <figure
                            key={`${imagen.id}:${indice}`}
                            className="space-y-2"
                        >
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                                <img
                                    src={imagen.url}
                                    alt={imagen.alt || ""}
                                    loading="lazy"
                                    decoding="async"
                                    className="aspect-4/3 w-full object-contain"
                                />
                            </div>

                            {imagen.autor && (
                                <figcaption className="text-xs leading-5">
                                    Fotografia: {imagen.autor}
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function VerNoticia({
    noticiaID,
}: Props) {
    const [datos, setDatos] = useState<RespuestaDetalle | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [estadoError, setEstadoError] = useState<number | null>(null);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        const controlador = new AbortController();

        setCargando(true);
        setError("");
        setEstadoError(null);
        setDatos(null);

        async function cargar() {
            try {
                const parametros = new URLSearchParams({
                    vista: "detalle",
                    id: noticiaID,
                });

                const respuesta = await fetch(
                    `${API}?${parametros.toString()}`,
                    {
                        credentials: "same-origin",
                        cache: "no-store",
                        signal: controlador.signal,
                    },
                );

                const resultado = await respuesta
                    .json()
                    .catch(() => null);

                if (controlador.signal.aborted) return;

                if (
                    !respuesta.ok ||
                    resultado?.success !== true
                ) {
                    setEstadoError(respuesta.status);

                    throw new Error(
                        resultado?.mensaje ||
                            "No s'ha pogut carregar la notícia.",
                    );
                }

                setDatos(resultado as RespuestaDetalle);
            } catch (err) {
                if (controlador.signal.aborted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "No s'ha pogut carregar la notícia.",
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [noticiaID, intento]);

    if (cargando) {
        return (
            <div
                role="status"
                className="flex min-h-80 flex-col items-center justify-center gap-4 text-neutral"
            >
                <span
                    aria-hidden="true"
                    className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-neutral"
                />
                <p className="text-sm">Carregant la notícia...</p>
            </div>
        );
    }

    if (error || !datos) {
        const titulo =
            estadoError === 404
                ? "Notícia no trobada"
                : estadoError === 403
                  ? "No tens accés a aquesta notícia"
                  : estadoError === 401
                    ? "La sessió ha finalitzat"
                    : "No s'ha pogut carregar la notícia";

        return (
            <section className="rounded-2xl border border-border bg-background p-6 text-neutral sm:p-8">
                <h1 className="text-xl font-semibold">
                    {titulo}
                </h1>

                <p role="alert" className="mt-3 text-sm leading-6">
                    {error || "La informació no està disponible."}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                    <a href="/panell/noticies" className={boton}>
                        Tornar a notícies
                    </a>

                    {estadoError !== 403 && estadoError !== 404 && (
                        <button
                            type="button"
                            className={boton}
                            onClick={() => setIntento((valor) => valor + 1)}
                        >
                            Tornar-ho a provar
                        </button>
                    )}
                </div>
            </section>
        );
    }

    const noticia = datos.noticia;

    const titular =
        noticia.titular?.trim() || "Notícia sense titular";

    // Copia antes de ordenar para no modificar el estado de React.
    const bloques = [...(noticia.content ?? [])].sort(
        (a, b) => a.order - b.order,
    );

    const lectura = calcularLecturaNoticia({
        titular: noticia.titular ?? "",
        subtitulo: noticia.subtitulo ?? "",
        cover_image: noticia.cover_image ?? "",
        content: bloques,
    });

    const parametrosListado = new URLSearchParams();
    const parametrosEdicion = new URLSearchParams({
        accio: "editar",
        id: noticia.id,
    });

    if (noticia.torneo_id) {
        parametrosListado.set("torneoID", noticia.torneo_id);
        parametrosEdicion.set("torneoID", noticia.torneo_id);
    }

    const enlaceListado = parametrosListado.size > 0
        ? `/panell/noticies?${parametrosListado.toString()}`
        : "/panell/noticies";

    const enlaceEdicion =
        `/panell/info/noticia?${parametrosEdicion.toString()}`;

    return (
        <div className="space-y-6 text-neutral">
            <nav
                aria-label="Accions de la notícia"
                className="flex flex-wrap items-center justify-between gap-3"
            >
                <a
                    href={enlaceListado}
                    className="rounded text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30"
                >
                    ← Tornar a notícies
                </a>

                <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs">
                        {estadoVisible(noticia.status)}
                    </span>

                    {datos.capacidades.editar && (
                        <a
                            href={enlaceEdicion}
                            className={`${boton} bg-card`}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                                aria-hidden="true"
                            >
                                <path d="m16 4 4 4" />
                                <path d="m4 20 4-1 12-12a2.8 2.8 0 0 0-4-4L4 15v5Z" />
                            </svg>
                            Editar notícia
                        </a>
                    )}
                </div>
            </nav>

            <article className="overflow-hidden rounded-2xl border border-border bg-background">
                {noticia.cover_image && (
                    <div className="border-b border-border bg-card">
                        <img
                            src={noticia.cover_image}
                            alt=""
                            decoding="async"
                            fetchPriority="high"
                            className="max-h-136 w-full object-contain"
                        />
                    </div>
                )}

                <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8 sm:py-10">
                    <header className="space-y-5 border-b border-border pb-7">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full border border-border bg-card px-3 py-1.5">
                                {noticia.torneo_nombre ||
                                    (
                                        noticia.torneo_id
                                            ? "Torneig no disponible"
                                            : "Sense torneig assignat"
                                    )}
                            </span>

                            {noticia.categoria && (
                                <span className="rounded-full border border-border px-3 py-1.5">
                                    {noticia.categoria}
                                </span>
                            )}

                            {lectura.minutos > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-1">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.6"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    >
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 2" />
                                    </svg>
                                    {lectura.minutos} min de lectura
                                </span>
                            )}
                        </div>

                        <h1 className="wrap-break-words text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                            {titular}
                        </h1>

                        {noticia.subtitulo && (
                            <p className="whitespace-pre-wrap wrap-break-words text-lg leading-8">
                                {noticia.subtitulo}
                            </p>
                        )}

                        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="font-semibold">
                                    {noticia.author || "Sense autor"}
                                </p>

                                {noticia.author_curso && (
                                    <p className="mt-1 text-xs">
                                        {noticia.author_curso}
                                    </p>
                                )}
                            </div>

                            <div className="text-xs leading-6 sm:text-right">
                                {fechaValida(noticia.publication_date) ? (
                                    <p>
                                        Publicada el{" "}
                                        <time dateTime={noticia.publication_date}>
                                            {fechaVisible(noticia.publication_date)}
                                        </time>
                                    </p>
                                ) : (
                                    <p>Sense data de publicació</p>
                                )}

                                {fechaValida(noticia.last_save) &&
                                    (
                                        !fechaValida(noticia.publication_date) ||
                                        Date.parse(noticia.last_save) >
                                            Date.parse(noticia.publication_date)
                                    ) && (
                                        <p>
                                            Actualitzada el{" "}
                                            <time dateTime={noticia.last_save}>
                                                {fechaVisible(noticia.last_save)}
                                            </time>
                                        </p>
                                    )}
                            </div>
                        </div>
                    </header>

                    {bloques.length > 0 ? (
                        <div className="space-y-9 py-8 sm:space-y-12 sm:py-10">
                            {bloques.map((bloque) => (
                                <ContenidoBloque
                                    key={bloque.id}
                                    bloque={bloque}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="py-10 text-sm">
                            Aquesta notícia encara no té blocs de contingut.
                        </p>
                    )}

                    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                        <a
                            href={enlaceListado}
                            className="rounded text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30"
                        >
                            ← Tornar al llistat
                        </a>

                        {datos.capacidades.editar && (
                            <a href={enlaceEdicion} className={boton}>
                                Editar notícia
                            </a>
                        )}
                    </footer>
                </div>
            </article>
        </div>
    );
}