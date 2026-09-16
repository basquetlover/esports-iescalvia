import {
    useEffect,
    useRef,
    useState,
    type FormEvent,
} from "react";

import type {
    NoticiaListado,
    TorneoNoticias,
} from "@const/Noticias";

const API = "/api/panell/noticies";

type Props = {
    torneoID?: string | null;
};

type Configuracion = {
    success: true;
    categorias: string[];
    torneos: TorneoNoticias[];
    puedeCrear: boolean;
};

type RespuestaListado = {
    success: true;
    filas: NoticiaListado[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
};

type Filtros = {
    torneo: string;
    categoria: string;
    busqueda: string;
    pagina: number;
};

class ErrorPeticion extends Error {
    constructor(
        mensaje: string,
        public estado: number,
    ) {
        super(mensaje);
    }
}

async function consultar<T>(
    parametros: URLSearchParams,
    signal: AbortSignal,
): Promise<T> {
    const respuesta = await fetch(`${API}?${parametros.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
    });

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok || datos?.success !== true) {
        throw new ErrorPeticion(
            datos?.mensaje || "No s'ha pogut carregar la informació.",
            respuesta.status,
        );
    }

    return datos as T;
}

function fechaVisible(valor: string | null) {
    if (!valor) return "Sense data";

    const fecha = new Date(valor);

    if (Number.isNaN(fecha.getTime())) {
        return "Sense data";
    }

    return new Intl.DateTimeFormat("ca-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Madrid",
    }).format(fecha);
}

function enlaceNoticia(
    accion: "crear" | "ver" | "editar",
    noticia?: NoticiaListado,
    torneoID?: string,
) {
    const parametros = new URLSearchParams({
        accio: accion,
    });

    if (noticia) {
        parametros.set("id", noticia.id);
    }

    const torneo = noticia?.torneo_id || torneoID;

    if (torneo) {
        parametros.set("torneoID", torneo);
    }

    return `/panell/info/noticia?${parametros.toString()}`;
}

const boton =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border bg-background px-4 py-2.5 " +
    "text-sm font-medium text-neutral transition-colors " +
    "hover:border-neutral/40 hover:bg-card " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-neutral/30 " +
    "disabled:cursor-not-allowed disabled:opacity-50";

const campo =
    "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 " +
    "text-sm text-neutral outline-none " +
    "focus:border-neutral/50 focus:ring-2 focus:ring-neutral/10";

export default function BuscadorNoticias({
    torneoID = null,
}: Props) {
    const [configuracion, setConfiguracion] =
        useState<Configuracion | null>(null);

    const [listado, setListado] =
        useState<RespuestaListado | null>(null);

    const [filtros, setFiltros] = useState<Filtros>({
        torneo: torneoID ?? "",
        categoria: "",
        busqueda: "",
        pagina: 1,
    });

    const [textoBusqueda, setTextoBusqueda] = useState("");

    const [cargandoConfiguracion, setCargandoConfiguracion] =
        useState(true);

    const [cargandoLista, setCargandoLista] = useState(true);

    const [errorConfiguracion, setErrorConfiguracion] = useState("");
    const [errorLista, setErrorLista] = useState("");
    const [aviso, setAviso] = useState("");

    const [revisionConfiguracion, setRevisionConfiguracion] = useState(0);
    const [revisionLista, setRevisionLista] = useState(0);

    const [noticiaEliminar, setNoticiaEliminar] =
        useState<NoticiaListado | null>(null);

    const [eliminando, setEliminando] = useState(false);
    const [errorEliminar, setErrorEliminar] = useState("");
    const [conflictoEliminar, setConflictoEliminar] = useState(false);

    const dialogoRef = useRef<HTMLDialogElement>(null);
    const bloqueoEliminar = useRef(false);
    const botonOrigenRef = useRef<HTMLButtonElement | null>(null);

    // ========================================================
    // CONFIGURACIÓN Y TORNEOS
    // ========================================================

    useEffect(() => {
        const controlador = new AbortController();

        setCargandoConfiguracion(true);
        setErrorConfiguracion("");

        async function cargar() {
            try {
                const datos = await consultar<Configuracion>(
                    new URLSearchParams({
                        vista: "configuracion",
                    }),
                    controlador.signal,
                );

                if (!controlador.signal.aborted) {
                    setConfiguracion(datos);
                }
            } catch (error) {
                if (controlador.signal.aborted) return;

                setConfiguracion(null);

                setErrorConfiguracion(
                    error instanceof Error
                        ? error.message
                        : "No s'ha pogut carregar la configuració.",
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargandoConfiguracion(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [revisionConfiguracion]);

    // ========================================================
    // CAMBIO DE CONTEXTO DEL PANEL
    // ========================================================

    useEffect(() => {
        setFiltros((actual) => ({
            ...actual,
            torneo: torneoID ?? "",
            pagina: 1,
        }));
    }, [torneoID]);

    // ========================================================
    // LISTADO
    // ========================================================

    useEffect(() => {
        const controlador = new AbortController();

        setCargandoLista(true);
        setErrorLista("");
        setListado(null);

        async function cargar() {
            try {
                const parametros = new URLSearchParams({
                    vista: "lista",
                    pagina: String(filtros.pagina),
                });

                if (filtros.torneo) {
                    parametros.set("torneoID", filtros.torneo);
                }

                if (filtros.categoria) {
                    parametros.set("categoria", filtros.categoria);
                }

                if (filtros.busqueda) {
                    parametros.set("q", filtros.busqueda);
                }

                const datos = await consultar<RespuestaListado>(
                    parametros,
                    controlador.signal,
                );

                if (controlador.signal.aborted) return;

                const ultimaPagina = Math.max(1, datos.totalPaginas);

                if (filtros.pagina > ultimaPagina) {
                    setFiltros((actual) => ({
                        ...actual,
                        pagina: ultimaPagina,
                    }));

                    return;
                }

                setListado(datos);
            } catch (error) {
                if (controlador.signal.aborted) return;

                setErrorLista(
                    error instanceof Error
                        ? error.message
                        : "No s'han pogut carregar les notícies.",
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargandoLista(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [filtros, revisionLista]);

    // ========================================================
    // DIÁLOGO DE ELIMINACIÓN
    // ========================================================

    useEffect(() => {
        const dialogo = dialogoRef.current;

        if (noticiaEliminar && dialogo && !dialogo.open) {
            dialogo.showModal();
        }
    }, [noticiaEliminar]);

    function abrirEliminacion(
        noticia: NoticiaListado,
        botonOrigen: HTMLButtonElement,
    ) {
        if (bloqueoEliminar.current) return;

        botonOrigenRef.current = botonOrigen;
        setErrorEliminar("");
        setConflictoEliminar(false);
        setNoticiaEliminar(noticia);
    }

    function cerrarEliminacion() {
        if (bloqueoEliminar.current) return;

        if (dialogoRef.current?.open) {
            dialogoRef.current.close();
        }

        setNoticiaEliminar(null);
        setErrorEliminar("");
        setConflictoEliminar(false);

        botonOrigenRef.current?.focus();
    }

    async function eliminar() {
        if (
            !noticiaEliminar ||
            bloqueoEliminar.current ||
            conflictoEliminar
        ) {
            return;
        }

        bloqueoEliminar.current = true;
        setEliminando(true);
        setErrorEliminar("");

        try {
            const respuesta = await fetch(API, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    accion: "eliminar",
                    id: noticiaEliminar.id,
                    last_save: noticiaEliminar.last_save,
                }),
            });

            const datos = await respuesta.json().catch(() => null);

            if (!respuesta.ok || datos?.success !== true) {
                if (respuesta.status === 409) {
                    setConflictoEliminar(true);
                }

                throw new ErrorPeticion(
                    datos?.mensaje || "No s'ha pogut eliminar la notícia.",
                    respuesta.status,
                );
            }

            dialogoRef.current?.close();
            setNoticiaEliminar(null);

            setAviso("Notícia eliminada correctament.");
            setRevisionLista((valor) => valor + 1);
        } catch (error) {
            setErrorEliminar(
                error instanceof Error
                    ? error.message
                    : "No s'ha pogut eliminar la notícia.",
            );
        } finally {
            bloqueoEliminar.current = false;
            setEliminando(false);
        }
    }

    // ========================================================
    // FILTROS
    // ========================================================

    function buscar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        setFiltros((actual) => ({
            ...actual,
            busqueda: textoBusqueda.trim(),
            pagina: 1,
        }));
    }

    function limpiarFiltros() {
        setTextoBusqueda("");

        setFiltros({
            torneo: torneoID ?? "",
            categoria: "",
            busqueda: "",
            pagina: 1,
        });
    }

    const torneoSeleccionado = configuracion?.torneos.find(
        (torneo) => torneo.id === filtros.torneo,
    );

    const puedeCrear = configuracion !== null && (
        filtros.torneo
            ? torneoSeleccionado?.puedeCrear === true
            : configuracion.puedeCrear
    );

    // Conserva también categorías antiguas presentes en la página.
    const categorias = [
        ...new Set([
            ...(configuracion?.categorias ?? []),
            ...(listado?.filas.flatMap(
                (noticia) => noticia.categoria ? [noticia.categoria] : [],
            ) ?? []),
            ...(filtros.categoria ? [filtros.categoria] : []),
        ]),
    ];

    const hayFiltros =
        Boolean(filtros.busqueda) ||
        Boolean(filtros.categoria) ||
        filtros.torneo !== (torneoID ?? "");

    const desde = listado && listado.total > 0
        ? (listado.pagina - 1) * listado.porPagina + 1
        : 0;

    const hasta = listado
        ? Math.min(
              listado.pagina * listado.porPagina,
              listado.total,
          )
        : 0;

    // ========================================================
    // INTERFAZ
    // ========================================================

    return (
        <div className="space-y-6 text-neutral">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-medium tracking-wide">
                        CONTINGUTS
                    </p>

                    <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        Gestió de notícies
                    </h1>

                    <p className="mt-2 max-w-2xl text-sm leading-6">
                        Publica i actualitza les notícies dels tornejos.
                    </p>
                </div>

                {puedeCrear && (
                    <a
                        href={enlaceNoticia(
                            "crear",
                            undefined,
                            filtros.torneo || undefined,
                        )}
                        className={`${boton} shrink-0 bg-card`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Nova notícia
                    </a>
                )}
            </header>

            {aviso && (
                <div
                    role="status"
                    className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 text-sm"
                >
                    <p>{aviso}</p>

                    <button
                        type="button"
                        onClick={() => setAviso("")}
                        aria-label="Tancar avís"
                        className="rounded px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30"
                    >
                        ×
                    </button>
                </div>
            )}

            {errorConfiguracion && (
                <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                >
                    <p className="text-sm">{errorConfiguracion}</p>

                    <button
                        type="button"
                        className={boton}
                        onClick={() =>
                            setRevisionConfiguracion((valor) => valor + 1)
                        }
                    >
                        Tornar-ho a provar
                    </button>
                </div>
            )}

            <section
                aria-label="Filtres de notícies"
                className="rounded-2xl border border-border bg-background p-4 sm:p-5"
            >
                <form
                    onSubmit={buscar}
                    className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr]"
                >
                    <div>
                        <label
                            htmlFor="noticies-cerca"
                            className="mb-2 block text-xs font-semibold"
                        >
                            Cercar notícia
                        </label>

                        <div className="flex gap-2">
                            <input
                                id="noticies-cerca"
                                type="search"
                                value={textoBusqueda}
                                maxLength={120}
                                onChange={(evento) =>
                                    setTextoBusqueda(evento.target.value)
                                }
                                placeholder="Titular o subtítol"
                                className={campo}
                            />

                            <button type="submit" className={boton}>
                                Cercar
                            </button>
                        </div>
                    </div>

                    <label>
                        <span className="mb-2 block text-xs font-semibold">
                            Torneig
                        </span>

                        <select
                            value={filtros.torneo}
                            disabled={cargandoConfiguracion || !configuracion}
                            className={campo}
                            onChange={(evento) =>
                                setFiltros((actual) => ({
                                    ...actual,
                                    torneo: evento.target.value,
                                    pagina: 1,
                                }))
                            }
                        >
                            <option value="">Tots els accessibles</option>

                            {filtros.torneo && !torneoSeleccionado && (
                                <option value={filtros.torneo}>
                                    Torneig seleccionat
                                </option>
                            )}

                            {configuracion?.torneos.map((torneo) => (
                                <option key={torneo.id} value={torneo.id}>
                                    {torneo.nombre || "Torneig sense nom"}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-2 block text-xs font-semibold">
                            Categoria
                        </span>

                        <select
                            value={filtros.categoria}
                            className={campo}
                            onChange={(evento) =>
                                setFiltros((actual) => ({
                                    ...actual,
                                    categoria: evento.target.value,
                                    pagina: 1,
                                }))
                            }
                        >
                            <option value="">Totes les categories</option>

                            {categorias.map((categoria) => (
                                <option key={categoria} value={categoria}>
                                    {categoria}
                                </option>
                            ))}
                        </select>
                    </label>
                </form>

                {hayFiltros && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                        <p className="text-xs">
                            {filtros.busqueda
                                ? `Cerca aplicada: «${filtros.busqueda}»`
                                : "Hi ha filtres aplicats."}
                        </p>

                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            className="rounded text-xs font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30"
                        >
                            Restablir filtres
                        </button>
                    </div>
                )}
            </section>

            <section
                aria-label="Llistat de notícies"
                aria-busy={cargandoLista}
                className="overflow-hidden rounded-2xl border border-border bg-background"
            >
                {cargandoLista ? (
                    <div
                        role="status"
                        className="flex min-h-64 flex-col items-center justify-center gap-3 p-6"
                    >
                        <span
                            aria-hidden="true"
                            className="h-7 w-7 animate-spin rounded-full border-2 border-border border-t-neutral"
                        />
                        <p className="text-sm">Carregant notícies...</p>
                    </div>
                ) : errorLista ? (
                    <div className="space-y-4 p-6">
                        <p role="alert" className="text-sm">
                            {errorLista}
                        </p>

                        <button
                            type="button"
                            className={boton}
                            onClick={() =>
                                setRevisionLista((valor) => valor + 1)
                            }
                        >
                            Tornar-ho a provar
                        </button>
                    </div>
                ) : listado?.filas.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <h2 className="text-base font-semibold">
                            No hi ha notícies per mostrar
                        </h2>

                        <p className="mx-auto mt-2 max-w-md text-sm leading-6">
                            {hayFiltros
                                ? "Canvia els filtres o la cerca per trobar altres notícies."
                                : "Les notícies publicades als tornejos accessibles apareixeran aquí."}
                        </p>
                    </div>
                ) : listado ? (
                    <>
                        <div className="divide-y divide-border">
                            {listado.filas.map((noticia) => {
                                const titular =
                                    noticia.titular?.trim() ||
                                    "Notícia sense titular";

                                const lectura = Number(noticia.tiempo_lectura);
                                const tieneLectura =
                                    Number.isFinite(lectura) && lectura > 0;

                                return (
                                    <article
                                        key={noticia.id}
                                        className="grid grid-cols-[max-content_1fr] gap-4 p-4 sm:p-5 "
                                    >
                                        <a
                                            href={enlaceNoticia("ver", noticia)}
                                            aria-label={`Consultar: ${titular}`}
                                            className="block aspect-video max-w-96 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30 md:w-40 md:self-start"
                                        >
                                            {noticia.cover_image ? (
                                                <img
                                                    src={noticia.cover_image}
                                                    alt=""
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <span className="flex h-full min-h-24 items-center justify-center text-xs">
                                                    Sense portada
                                                </span>
                                            )}
                                        </a>

                                        <div className="min-w-0 flex-1">
                                            <div className="mb-2 flex flex-wrap gap-2">
                                                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px]">
                                                    {noticia.torneo_nombre ||
                                                        (
                                                            noticia.torneo_id
                                                                ? "Torneig no disponible"
                                                                : "Sense torneig"
                                                        )}
                                                </span>

                                                {noticia.categoria && (
                                                    <span className="rounded-full border border-border px-2.5 py-1 text-[11px]">
                                                        {noticia.categoria}
                                                    </span>
                                                )}

                                                <span className="rounded-full bg-card px-2.5 py-1 text-[11px]">
                                                    {noticia.status === "Public"
                                                        ? "Publicada"
                                                        : noticia.status === "Esborrany"
                                                          ? "Esborrany"
                                                          : noticia.status || "Sense estat"}
                                                </span>
                                            </div>

                                            <h2 className="wrap-break-words text-base font-semibold">
                                                <a
                                                    href={enlaceNoticia("ver", noticia)}
                                                    className="rounded hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30"
                                                >
                                                    {titular}
                                                </a>
                                            </h2>

                                            {noticia.subtitulo && (
                                                <p className="mt-1 line-clamp-2 text-sm leading-6">
                                                    {noticia.subtitulo}
                                                </p>
                                            )}

                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                                <span>
                                                    {noticia.author || "Sense autor"}
                                                </span>

                                                <span>
                                                    {fechaVisible(noticia.publication_date)}
                                                </span>

                                                {tieneLectura && (
                                                    <span>{lectura} min de lectura</span>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap mt-5 gap-2 md:w-28 md:shrink-0 md:flex-col">
                                            <a
                                                href={enlaceNoticia("ver", noticia)}
                                                className={boton}
                                                aria-label={`Consultar: ${titular}`}
                                            >
                                                Consultar
                                            </a>

                                            {noticia.puedeEditar && (
                                                <a
                                                    href={enlaceNoticia("editar", noticia)}
                                                    className={`${boton} bg-card`}
                                                    aria-label={`Editar: ${titular}`}
                                                >
                                                    Editar
                                                </a>
                                            )}

                                            {noticia.puedeEliminar && (
                                                <button
                                                    type="button"
                                                    className={boton}
                                                    aria-label={`Eliminar: ${titular}`}
                                                    onClick={(evento) =>
                                                        abrirEliminacion(
                                                            noticia,
                                                            evento.currentTarget,
                                                        )
                                                    }
                                                >
                                                    Eliminar
                                                </button>
                                            )}
                                        </div>
                                        </div>

                                        
                                    </article>
                                );
                            })}
                        </div>

                        <footer className="flex flex-col gap-3 border-t border-border bg-card/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs">
                                {desde}–{hasta} de {listado.total} notícies
                            </p>

                            <nav
                                aria-label="Paginació de notícies"
                                className="flex items-center gap-2"
                            >
                                <button
                                    type="button"
                                    className={boton}
                                    disabled={filtros.pagina <= 1}
                                    onClick={() =>
                                        setFiltros((actual) => ({
                                            ...actual,
                                            pagina: actual.pagina - 1,
                                        }))
                                    }
                                >
                                    Anterior
                                </button>

                                <span className="px-1 text-xs">
                                    {listado.pagina} / {listado.totalPaginas}
                                </span>

                                <button
                                    type="button"
                                    className={boton}
                                    disabled={
                                        filtros.pagina >= listado.totalPaginas
                                    }
                                    onClick={() =>
                                        setFiltros((actual) => ({
                                            ...actual,
                                            pagina: actual.pagina + 1,
                                        }))
                                    }
                                >
                                    Següent
                                </button>
                            </nav>
                        </footer>
                    </>
                ) : null}
            </section>

            <dialog
                ref={dialogoRef}
                aria-labelledby="eliminar-noticia-titulo"
                aria-describedby="eliminar-noticia-descripcion"
                aria-busy={eliminando}
                onCancel={(evento) => {
                    evento.preventDefault();
                    cerrarEliminacion();
                }}
                className="
                    fixed inset-0 m-auto w-[calc(100%-2rem)]
                    max-w-lg rounded-2xl border border-border
                    bg-background p-0 text-neutral shadow-xl
                    backdrop:bg-black/40 backdrop:backdrop-blur-sm
                "
            >
                {noticiaEliminar && (
                    <div className="p-6">
                        <h2
                            id="eliminar-noticia-titulo"
                            className="text-lg font-semibold"
                        >
                            Eliminar aquesta notícia?
                        </h2>

                        <p
                            id="eliminar-noticia-descripcion"
                            className="mt-3 text-sm leading-6"
                        >
                            S'eliminarà{" "}
                            <strong>
                                {noticiaEliminar.titular || "la notícia seleccionada"}
                            </strong>
                            . Aquesta acció no es pot desfer.
                        </p>

                        {errorEliminar && (
                            <p
                                role="alert"
                                className="mt-4 rounded-lg border border-border bg-card p-3 text-sm leading-6"
                            >
                                {errorEliminar}
                            </p>
                        )}

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                autoFocus
                                disabled={eliminando}
                                className={boton}
                                onClick={cerrarEliminacion}
                            >
                                Cancel·lar
                            </button>

                            {conflictoEliminar ? (
                                <button
                                    type="button"
                                    className={`${boton} bg-card`}
                                    onClick={() => {
                                        cerrarEliminacion();
                                        setRevisionLista((valor) => valor + 1);
                                    }}
                                >
                                    Actualitzar el llistat
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    disabled={eliminando}
                                    className={`${boton} bg-card`}
                                    onClick={() => void eliminar()}
                                >
                                    {eliminando
                                        ? "Eliminant..."
                                        : "Eliminar notícia"}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </dialog>
        </div>
    );
}