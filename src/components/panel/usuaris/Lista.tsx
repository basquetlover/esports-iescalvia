import { useEffect, useState, type FormEvent } from "react";

type Usuario = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    ano_academico: string | null;
    rol: string | null;
    fecha_creacion: string | null;
    activa: boolean | null;
};

type RespuestaLista = {
    success: boolean;
    mensaje?: string;
    filas: Usuario[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
};

type Filtros = {
    q: string;
    rol: string;
    estado: string;
};

const ROLES = [
    { valor: "voluntario", nombre: "Voluntari" },
    { valor: "staff", nombre: "Staff" },
    { valor: "admintorneo", nombre: "Administrador de torneig" },
    { valor: "admin", nombre: "Administrador" },
    { valor: "desarrollador", nombre: "Desenvolupador" },
    { valor: "sin-rol", nombre: "Sense rol" },
];

const FILTROS_INICIALES: Filtros = {
    q: "",
    rol: "",
    estado: "",
};

const CLASE_CAMPO =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 " +
    "text-sm text-neutral-titulos outline-none transition " +
    "focus:border-primary focus:ring-2 focus:ring-primary/20";

const CLASE_BOTON =
    "inline-flex items-center justify-center gap-2 rounded-lg border " +
    "border-border bg-background px-4 py-2.5 text-sm font-semibold " +
    "text-neutral transition hover:bg-primary/10 " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-primary disabled:cursor-not-allowed " +
    "disabled:opacity-50 disabled:hover:bg-background";

function nombreCompleto(usuario: Usuario): string {
    return [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Usuari sense nom";
}

function nombreRol(rol: string | null): string {
    if (!rol) return "Sense rol";

    return (
        ROLES.find(
            (opcion) => opcion.valor === rol.trim().toLowerCase()
        )?.nombre ?? rol
    );
}

function formatearFecha(fecha: string | null): string {
    if (!fecha) return "—";

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) return "—";

    return new Intl.DateTimeFormat("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Madrid",
    }).format(valor);
}

function EstadoUsuario({ activa }: { activa: boolean | null }) {
    const nombre =
        activa === true
            ? "Actiu"
            : activa === false
              ? "Bloquejat"
              : "Sense estat";

    const colores =
        activa === true
            ? "border-primary/25 bg-primary/10 text-primary"
            : activa === false
              ? "border-error/25 bg-error/10 text-error"
              : "border-border bg-background text-neutral";

    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${colores}`}
        >
            <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                aria-hidden="true"
            />
            {nombre}
        </span>
    );
}

export default function Lista() {
    const [formulario, setFormulario] = useState<Filtros>({
        ...FILTROS_INICIALES,
    });

    const [filtros, setFiltros] = useState<Filtros>({
        ...FILTROS_INICIALES,
    });

    const [pagina, setPagina] = useState(1);
    const [datos, setDatos] = useState<RespuestaLista | null>(null);

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

        async function cargarUsuarios() {
            try {
                const parametros = new URLSearchParams({
                    pagina: String(pagina),
                });

                if (filtros.q) parametros.set("q", filtros.q);
                if (filtros.rol) parametros.set("rol", filtros.rol);
                if (filtros.estado) parametros.set("estado", filtros.estado);

                const respuesta = await fetch(
                    `/api/panell/usuaris?${parametros.toString()}`,
                    {
                        signal: controlador.signal,
                        cache: "no-store",
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                if (controlador.signal.aborted) return;

                setEstadoError(respuesta.ok ? null : respuesta.status);

                const contenido = respuesta.headers.get("content-type") ?? "";

                if (!contenido.includes("application/json")) {
                    throw new Error(
                        "El servidor no ha retornat una resposta vàlida."
                    );
                }

                const resultado = await respuesta.json();

                if (!respuesta.ok || resultado.success !== true) {
                    throw new Error(
                        typeof resultado.mensaje === "string"
                            ? resultado.mensaje
                            : "No s'han pogut carregar els usuaris."
                    );
                }

                if (
                    !Array.isArray(resultado.filas) ||
                    !Number.isInteger(resultado.total) ||
                    resultado.total < 0 ||
                    !Number.isInteger(resultado.pagina) ||
                    resultado.pagina < 1 ||
                    !Number.isInteger(resultado.porPagina) ||
                    resultado.porPagina < 1 ||
                    !Number.isInteger(resultado.totalPaginas) ||
                    resultado.totalPaginas < 1
                ) {
                    throw new Error(
                        "Les dades rebudes no tenen el format esperat."
                    );
                }

                if (controlador.signal.aborted) return;

                // Si el total ha cambiado, vuelve a una página existente.
                if (pagina > resultado.totalPaginas) {
                    setPagina(resultado.totalPaginas);
                    return;
                }

                setDatos(resultado as RespuestaLista);
            } catch (err) {
                if (controlador.signal.aborted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "No s'han pogut carregar els usuaris."
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        void cargarUsuarios();

        return () => controlador.abort();
    }, [filtros, pagina, intento]);

    function aplicarFiltros(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        setPagina(1);
        setFiltros({
            ...formulario,
            q: formulario.q.trim(),
        });
    }

    function limpiarFiltros() {
        setFormulario({ ...FILTROS_INICIALES });
        setFiltros({ ...FILTROS_INICIALES });
        setPagina(1);
    }

    const hayFiltros = Boolean(
        filtros.q || filtros.rol || filtros.estado
    );

    const hayCampos = Boolean(
        formulario.q || formulario.rol || formulario.estado
    );

    const desde = datos && datos.total > 0
        ? (datos.pagina - 1) * datos.porPagina + 1
        : 0;

    const hasta = datos
        ? Math.min(
            (datos.pagina - 1) * datos.porPagina + datos.filas.length,
            datos.total
        )
        : 0;

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">
            <form
                onSubmit={aplicarFiltros}
                className="rounded-xl border border-border bg-card p-4"
                role="search"
                aria-label="Cercar usuaris"
            >
                <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                        <label
                            htmlFor="usuaris-cerca"
                            className="mb-2 block text-sm font-semibold text-neutral-titulos"
                        >
                            Cercar usuari
                        </label>

                        <input
                            id="usuaris-cerca"
                            type="search"
                            maxLength={120}
                            placeholder="Nom, cognoms o correu electrònic"
                            value={formulario.q}
                            onChange={(evento) =>
                                setFormulario((anterior) => ({
                                    ...anterior,
                                    q: evento.target.value,
                                }))
                            }
                            className={CLASE_CAMPO}
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="usuaris-rol"
                            className="mb-2 block text-sm font-semibold text-neutral-titulos"
                        >
                            Rol general
                        </label>

                        <select
                            id="usuaris-rol"
                            value={formulario.rol}
                            onChange={(evento) =>
                                setFormulario((anterior) => ({
                                    ...anterior,
                                    rol: evento.target.value,
                                }))
                            }
                            className={CLASE_CAMPO}
                        >
                            <option value="">Tots els rols</option>

                            {ROLES.map((rol) => (
                                <option key={rol.valor} value={rol.valor}>
                                    {rol.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label
                            htmlFor="usuaris-estat"
                            className="mb-2 block text-sm font-semibold text-neutral-titulos"
                        >
                            Estat del compte
                        </label>

                        <select
                            id="usuaris-estat"
                            value={formulario.estado}
                            onChange={(evento) =>
                                setFormulario((anterior) => ({
                                    ...anterior,
                                    estado: evento.target.value,
                                }))
                            }
                            className={CLASE_CAMPO}
                        >
                            <option value="">Tots els estats</option>
                            <option value="activos">Actius</option>
                            <option value="bloqueados">Bloquejats</option>
                            <option value="sin-estado">Sense estat</option>
                        </select>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                        type="submit"
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    >
                        Cercar
                    </button>

                    {(hayFiltros || hayCampos) && (
                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            className={CLASE_BOTON}
                        >
                            Netejar filtres
                        </button>
                    )}
                </div>
            </form>

            <section
                className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
                aria-labelledby="llista-usuaris-titol"
                aria-busy={cargando}
            >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
                    <div>
                        <h2
                            id="llista-usuaris-titol"
                            className="font-semibold text-neutral-titulos"
                        >
                            Usuaris de la plataforma
                        </h2>

                        {datos && !cargando && (
                            <p
                                className="mt-1 text-xs text-neutral"
                                role="status"
                            >
                                {datos.total}{" "}
                                {datos.total === 1 ? "usuari" : "usuaris"}
                                {hayFiltros ? " amb els filtres aplicats" : ""}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setIntento((valor) => valor + 1)}
                        disabled={cargando}
                        className={CLASE_BOTON}
                    >
                        Actualitzar
                    </button>
                </div>

                {cargando && (
                    <div
                        className="flex items-center justify-center gap-3 px-4 py-16 text-sm text-neutral"
                        role="status"
                    >
                        <span
                            className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                        Carregant usuaris...
                    </div>
                )}

                {!cargando && error && (
                    <div className="flex flex-col items-center gap-4 px-4 py-12 text-center">
                        <p className="text-sm text-error" role="alert">
                            {error}
                        </p>

                        {estadoError === 401 ? (
                            <a
                                href={`/iniciar-sessio?redirect=${encodeURIComponent("/panell/usuaris")}`}
                                className={CLASE_BOTON}
                            >
                                Iniciar sessió
                            </a>
                        ) : estadoError === 403 ? (
                            <a href="/panell" className={CLASE_BOTON}>
                                Tornar al panell
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() =>
                                    setIntento((valor) => valor + 1)
                                }
                                className={CLASE_BOTON}
                            >
                                Tornar-ho a provar
                            </button>
                        )}
                    </div>
                )}

                {!cargando && !error && datos?.filas.length === 0 && (
                    <div className="px-4 py-16 text-center">
                        <h3 className="font-semibold text-neutral-titulos">
                            {hayFiltros
                                ? "No s'han trobat usuaris"
                                : "Encara no hi ha usuaris"}
                        </h3>

                        <p className="mt-2 text-sm text-neutral">
                            {hayFiltros
                                ? "Prova una altra cerca o modifica els filtres."
                                : "Els comptes registrats apareixeran aquí."}
                        </p>

                        {hayFiltros && (
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className={`${CLASE_BOTON} mt-5`}
                            >
                                Netejar filtres
                            </button>
                        )}
                    </div>
                )}

                {!cargando && !error && datos && datos.filas.length > 0 && (
                    <>
                        <div
                            className="overflow-x-auto"
                            tabIndex={0}
                            role="region"
                            aria-label="Taula d’usuaris"
                        >
                            <table className="w-full min-w-205 text-left text-sm">
                                <caption className="sr-only">
                                    Usuaris, dades acadèmiques, rol general
                                    i estat del compte.
                                </caption>

                                <thead className="border-b border-border bg-background/60 text-xs uppercase tracking-wide text-neutral">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">
                                            Usuari
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Curs
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Rol general
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Estat
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            Registre
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            Fitxa
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {datos.filas.map((usuario) => {
                                        const nombre = nombreCompleto(usuario);

                                        return (
                                            <tr
                                                key={usuario.id}
                                                className="transition-colors hover:bg-primary/5"
                                            >
                                                <th
                                                    scope="row"
                                                    className="max-w-80 px-4 py-4 text-left font-normal"
                                                >
                                                    <p className="wrap-break-words font-semibold text-neutral-titulos">
                                                        {nombre}
                                                    </p>

                                                    <p className="mt-1 break-all text-xs text-neutral">
                                                        {usuario.email ||
                                                            "Sense correu electrònic"}
                                                    </p>
                                                </th>

                                                <td className="px-4 py-4">
                                                    <p className="text-neutral-titulos">
                                                        {usuario.curso || "—"}
                                                    </p>

                                                    {usuario.ano_academico && (
                                                        <p className="mt-1 text-xs text-neutral">
                                                            {usuario.ano_academico}
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-neutral">
                                                    {nombreRol(usuario.rol)}
                                                </td>

                                                <td className="px-4 py-4">
                                                    <EstadoUsuario
                                                        activa={usuario.activa}
                                                    />
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-4 text-neutral">
                                                    {formatearFecha(
                                                        usuario.fecha_creacion
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-right">
                                                    <a
                                                        href={`/panell/usuaris/${encodeURIComponent(usuario.id)}`}
                                                        aria-label={`Veure la fitxa de ${nombre}`}
                                                        className="inline-flex whitespace-nowrap rounded-lg border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                    >
                                                        Veure fitxa
                                                    </a>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <nav
                            className="flex flex-wrap items-center justify-between gap-4 border-t border-border p-4"
                            aria-label="Paginació dels usuaris"
                        >
                            <p className="text-xs text-neutral">
                                Mostrant {desde}–{hasta} de {datos.total}
                            </p>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    disabled={datos.pagina <= 1}
                                    onClick={() =>
                                        setPagina((valor) =>
                                            Math.max(1, valor - 1)
                                        )
                                    }
                                    className={CLASE_BOTON}
                                    aria-label="Pàgina anterior"
                                >
                                    Anterior
                                </button>

                                <span className="text-xs text-neutral">
                                    {datos.pagina} / {datos.totalPaginas}
                                </span>

                                <button
                                    type="button"
                                    disabled={
                                        datos.pagina >= datos.totalPaginas
                                    }
                                    onClick={() =>
                                        setPagina((valor) =>
                                            Math.min(
                                                datos.totalPaginas,
                                                valor + 1
                                            )
                                        )
                                    }
                                    className={CLASE_BOTON}
                                    aria-label="Pàgina següent"
                                >
                                    Següent
                                </button>
                            </div>
                        </nav>
                    </>
                )}
            </section>
        </div>
    );
}