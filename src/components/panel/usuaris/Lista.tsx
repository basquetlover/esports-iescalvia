import {
    useEffect,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";

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

type IconoNombre =
    | "buscar"
    | "usuarios"
    | "actualizar"
    | "filtros"
    | "flecha"
    | "anterior"
    | "cerrar"
    | "error";

const API = "/api/panell/usuaris";

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

const SUPERFICIE =
    "rounded-2xl border border-border/40 bg-white " +
    "shadow-[0_2px_12px_rgba(15,23,42,0.025)] " +
    "[.oscuro_&]:bg-card";

const CAMPO =
    "w-full rounded-lg border border-transparent bg-[#eef3ff] " +
    "px-3 py-2.5 text-xs text-neutral-titulos outline-none " +
    "transition placeholder:text-neutral/60 focus:border-primary/30 " +
    "focus:ring-2 focus:ring-primary/10 [.oscuro_&]:bg-background";

const BOTON =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border/50 bg-white px-3 py-2 text-xs " +
    "font-semibold text-neutral-titulos transition " +
    "hover:border-primary/25 hover:bg-primary/5 " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-primary disabled:cursor-not-allowed " +
    "disabled:opacity-50 [.oscuro_&]:bg-card";

const BOTON_PRINCIPAL =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "bg-primary px-4 py-2.5 text-xs font-semibold text-white " +
    "transition hover:opacity-90 focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-primary " +
    "focus-visible:ring-offset-2";

function Icono({
    nombre,
    className = "h-4 w-4",
}: {
    nombre: IconoNombre;
    className?: string;
}) {
    const dibujos: Record<IconoNombre, ReactNode> = {
        buscar: (
            <>
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m16 16 5 5" />
            </>
        ),
        usuarios: (
            <>
                <circle cx="9" cy="8" r="3" />
                <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5v1" />
            </>
        ),
        actualizar: (
            <>
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
            </>
        ),
        filtros: (
            <>
                <path d="M4 6h16M4 12h16M4 18h16" />
                <circle cx="8" cy="6" r="2" />
                <circle cx="16" cy="12" r="2" />
                <circle cx="10" cy="18" r="2" />
            </>
        ),
        flecha: <path d="m9 5 7 7-7 7" />,
        anterior: <path d="m15 5-7 7 7 7" />,
        cerrar: <path d="m6 6 12 12M18 6 6 18" />,
        error: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v6M12 17h.01" />
            </>
        ),
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`shrink-0 ${className}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {dibujos[nombre]}
        </svg>
    );
}

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

function iniciales(usuario: Usuario): string {
    const partes = [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .map((parte) => parte?.trim())
        .filter((parte): parte is string => Boolean(parte));

    return partes
        .slice(0, 2)
        .map((parte) => Array.from(parte)[0])
        .join("")
        .toLocaleUpperCase("ca-ES") || "?";
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

    const estilo =
        activa === true
            ? "bg-primary/10 text-primary"
            : activa === false
              ? "bg-error/10 text-error"
              : "bg-neutral/10 text-neutral";

    return (
        <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${estilo}`}
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
                if (filtros.estado) {
                    parametros.set("estado", filtros.estado);
                }

                const respuesta = await fetch(
                    `${API}?${parametros.toString()}`,
                    {
                        signal: controlador.signal,
                        cache: "no-store",
                        headers: {
                            Accept: "application/json",
                        },
                    }
                );

                if (controlador.signal.aborted) return;

                setEstadoError(
                    respuesta.ok ? null : respuesta.status
                );

                const contenido =
                    respuesta.headers.get("content-type") ?? "";

                if (!contenido.includes("application/json")) {
                    throw new Error(
                        "El servidor no ha retornat una resposta vàlida."
                    );
                }

                const resultado = await respuesta.json();

                if (
                    !resultado ||
                    typeof resultado !== "object" ||
                    Array.isArray(resultado)
                ) {
                    throw new Error(
                        "Les dades rebudes no tenen el format esperat."
                    );
                }

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
                className={`${SUPERFICIE} p-5 md:p-6`}
                role="search"
                aria-label="Cercar usuaris"
            >
                <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icono nombre="filtros" />
                    </span>

                    <div>
                        <h2 className="text-sm font-bold text-neutral-titulos">
                            Cerca i filtres
                        </h2>

                        <p className="mt-1 text-xs text-neutral">
                            Localitza un compte pel nom, correu, rol o estat.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 items-end gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div>
                        <label
                            htmlFor="usuaris-cerca"
                            className="mb-1.5 block text-[11px] font-semibold text-neutral-titulos"
                        >
                            Nom, cognoms o correu electrònic
                        </label>

                        <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-primary">
                                <Icono
                                    nombre="buscar"
                                    className="h-3.5 w-3.5"
                                />
                            </span>

                            <input
                                id="usuaris-cerca"
                                type="search"
                                maxLength={120}
                                placeholder="Cercar un usuari..."
                                value={formulario.q}
                                onChange={(evento) =>
                                    setFormulario((anterior) => ({
                                        ...anterior,
                                        q: evento.target.value,
                                    }))
                                }
                                className={`${CAMPO} pl-9`}
                            />
                        </div>
                    </div>

                    <div>
                        <label
                            htmlFor="usuaris-rol"
                            className="mb-1.5 block text-[11px] font-semibold text-neutral-titulos"
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
                            className={CAMPO}
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
                            className="mb-1.5 block text-[11px] font-semibold text-neutral-titulos"
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
                            className={CAMPO}
                        >
                            <option value="">Tots els estats</option>
                            <option value="activos">Actius</option>
                            <option value="bloqueados">Bloquejats</option>
                            <option value="sin-estado">Sense estat</option>
                        </select>
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
                    {(hayFiltros || hayCampos) && (
                        <button
                            type="button"
                            onClick={limpiarFiltros}
                            className={BOTON}
                        >
                            <Icono
                                nombre="cerrar"
                                className="h-3.5 w-3.5"
                            />
                            Netejar filtres
                        </button>
                    )}

                    <button
                        type="submit"
                        className={BOTON_PRINCIPAL}
                    >
                        <Icono
                            nombre="buscar"
                            className="h-3.5 w-3.5"
                        />
                        Cercar
                    </button>
                </div>
            </form>

            <section
                className={`${SUPERFICIE} min-w-0 overflow-hidden`}
                aria-labelledby="llista-usuaris-titol"
                aria-busy={cargando}
            >
                <header className="flex flex-wrap items-center justify-between gap-4 px-5 py-5 md:px-6">
                    <div className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icono nombre="usuarios" />
                        </span>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h2
                                    id="llista-usuaris-titol"
                                    className="text-sm font-bold text-neutral-titulos"
                                >
                                    Usuaris de la plataforma
                                </h2>

                                {datos && !cargando && (
                                    <span className="rounded-md bg-[#eef3ff] px-2 py-0.5 text-[10px] font-bold text-primary in-[.oscuro_&]:bg-background">
                                        {datos.total}
                                    </span>
                                )}
                            </div>

                            <p
                                className="mt-1 text-xs text-neutral"
                                role="status"
                            >
                                {hayFiltros
                                    ? "Resultats amb els filtres aplicats."
                                    : "Consulta les dades i accedeix a cada fitxa."}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIntento((valor) => valor + 1)}
                        disabled={cargando}
                        className={BOTON}
                    >
                        <Icono
                            nombre="actualizar"
                            className="h-3.5 w-3.5"
                        />
                        Actualitzar
                    </button>
                </header>

                {cargando && (
                    <div
                        className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-xs text-neutral"
                        role="status"
                    >
                        <span
                            className="h-7 w-7 animate-spin rounded-full border-2 border-primary/15 border-t-primary motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                        Carregant usuaris...
                    </div>
                )}

                {!cargando && error && (
                    <div className="flex flex-col items-center gap-4 px-5 py-12 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-error/10 text-error">
                            <Icono
                                nombre="error"
                                className="h-5 w-5"
                            />
                        </span>

                        <p
                            className="max-w-lg text-xs leading-relaxed text-error"
                            role="alert"
                        >
                            {error}
                        </p>

                        {estadoError === 401 ? (
                            <a
                                href={`/iniciar-sessio?redirect=${encodeURIComponent("/panell/usuaris")}`}
                                className={BOTON}
                            >
                                Iniciar sessió
                            </a>
                        ) : estadoError === 403 ? (
                            <a href="/panell" className={BOTON}>
                                Tornar al panell
                            </a>
                        ) : (
                            <button
                                type="button"
                                onClick={() =>
                                    setIntento((valor) => valor + 1)
                                }
                                className={BOTON}
                            >
                                Tornar-ho a provar
                            </button>
                        )}
                    </div>
                )}

                {!cargando &&
                    !error &&
                    datos?.filas.length === 0 && (
                        <div className="mx-5 mb-5 flex flex-col items-center rounded-xl bg-background/60 px-5 py-12 text-center md:mx-6 md:mb-6">
                            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/5 text-primary/70">
                                <Icono
                                    nombre={hayFiltros ? "buscar" : "usuarios"}
                                    className="h-6 w-6"
                                />
                            </span>

                            <h3 className="text-sm font-bold text-neutral-titulos">
                                {hayFiltros
                                    ? "No s'han trobat usuaris"
                                    : "Encara no hi ha usuaris"}
                            </h3>

                            <p className="mt-2 max-w-md text-xs leading-relaxed text-neutral">
                                {hayFiltros
                                    ? "Prova una altra cerca o modifica els filtres."
                                    : "Els comptes registrats apareixeran aquí."}
                            </p>

                            {hayFiltros && (
                                <button
                                    type="button"
                                    onClick={limpiarFiltros}
                                    className={`${BOTON} mt-5`}
                                >
                                    Netejar filtres
                                </button>
                            )}
                        </div>
                    )}

                {!cargando &&
                    !error &&
                    datos &&
                    datos.filas.length > 0 && (
                        <>
                            <div
                                className="overflow-x-auto"
                                tabIndex={0}
                                role="region"
                                aria-label="Taula d’usuaris"
                            >
                                <table className="w-full min-w-212.5 text-left text-xs">
                                    <caption className="sr-only">
                                        Usuaris, dades acadèmiques,
                                        rol general i estat del compte.
                                    </caption>

                                    <thead className="border-y border-border/30 bg-[#eef3ff] text-[10px] uppercase tracking-wider text-neutral in-[.oscuro_&]:bg-background">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 font-semibold md:pl-6"
                                            >
                                                Usuari
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-semibold"
                                            >
                                                Curs acadèmic
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-semibold"
                                            >
                                                Rol general
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-semibold"
                                            >
                                                Estat
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-4 py-3 font-semibold"
                                            >
                                                Registre
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-5 py-3 text-right font-semibold md:pr-6"
                                            >
                                                Fitxa
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-border/40">
                                        {datos.filas.map((usuario) => {
                                            const nombre =
                                                nombreCompleto(usuario);

                                            return (
                                                <tr
                                                    key={usuario.id}
                                                    className="transition-colors hover:bg-primary/2.5"
                                                >
                                                    <th
                                                        scope="row"
                                                        className="max-w-96 px-5 py-4 text-left font-normal md:pl-6"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span
                                                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold tracking-tight text-primary"
                                                                aria-hidden="true"
                                                            >
                                                                {iniciales(usuario)}
                                                            </span>

                                                            <div className="min-w-0">
                                                                <p className="wrap-break-words text-xs font-bold text-neutral-titulos">
                                                                    {nombre}
                                                                </p>

                                                                <p className="mt-1 break-all text-[11px] text-neutral">
                                                                    {usuario.email ||
                                                                        "Sense correu electrònic"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </th>

                                                    <td className="px-4 py-4">
                                                        <p className="font-semibold text-neutral-titulos">
                                                            {usuario.curso || "—"}
                                                        </p>

                                                        {usuario.ano_academico && (
                                                            <p className="mt-1 text-[10px] text-neutral">
                                                                {usuario.ano_academico}
                                                            </p>
                                                        )}
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <span className="inline-flex rounded-md bg-[#eef3ff] px-2 py-1 text-[10px] font-semibold text-neutral-titulos in-[.oscuro_&]:bg-background">
                                                            {nombreRol(usuario.rol)}
                                                        </span>
                                                    </td>

                                                    <td className="px-4 py-4">
                                                        <EstadoUsuario
                                                            activa={usuario.activa}
                                                        />
                                                    </td>

                                                    <td className="whitespace-nowrap px-4 py-4 text-[11px] text-neutral">
                                                        {formatearFecha(
                                                            usuario.fecha_creacion
                                                        )}
                                                    </td>

                                                    <td className="px-5 py-4 text-right md:pr-6">
                                                        <a
                                                            href={`/panell/usuaris/${encodeURIComponent(usuario.id)}`}
                                                            aria-label={`Veure la fitxa de ${nombre}`}
                                                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-[11px] font-semibold text-primary transition hover:border-primary/30 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                                        >
                                                            Veure fitxa
                                                            <Icono
                                                                nombre="flecha"
                                                                className="h-3 w-3"
                                                            />
                                                        </a>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <nav
                                className="flex flex-wrap items-center justify-between gap-4 border-t border-border/40 px-5 py-4 md:px-6"
                                aria-label="Paginació dels usuaris"
                            >
                                <p
                                    className="text-[11px] text-neutral"
                                    role="status"
                                >
                                    Mostrant{" "}
                                    <span className="font-semibold text-neutral-titulos">
                                        {desde}–{hasta}
                                    </span>{" "}
                                    de{" "}
                                    <span className="font-semibold text-neutral-titulos">
                                        {datos.total}
                                    </span>
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
                                        className={BOTON}
                                        aria-label="Pàgina anterior"
                                    >
                                        <Icono
                                            nombre="anterior"
                                            className="h-3 w-3"
                                        />
                                        Anterior
                                    </button>

                                    <span className="whitespace-nowrap text-[11px] text-neutral">
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
                                        className={BOTON}
                                        aria-label="Pàgina següent"
                                    >
                                        Següent
                                        <Icono
                                            nombre="flecha"
                                            className="h-3 w-3"
                                        />
                                    </button>
                                </div>
                            </nav>
                        </>
                    )}
            </section>
        </div>
    );
}