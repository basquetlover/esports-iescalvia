import { useEffect, useRef, useState } from "react";
import Asistente from "./Asistente";

import {
    NOMBRES_ROL,
    ROLES_ORDENADOS,
    normalizarRol,
} from "@const/Permisos";

const API = "/api/panell/permisos";

type UsuarioFila = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    rol: string | null;
    origen_permisos: string | null;
    activa: boolean | null;
    fecha_actualizacion: string | null;
    puedeEditar: boolean;
    puedeRetirar: boolean;
};

type RespuestaLista = {
    success: true;
    filas: UsuarioFila[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
};

type Configuracion = {
    success: true;
    capacidades: {
        crear: boolean;
        editar: boolean;
        eliminar: boolean;
        concederTodos: boolean;
    };
};

type Seleccion = {
    id: string;
    modo: "crear" | "editar" | "ver";
};

async function consultar<T>(
    parametros: URLSearchParams,
    signal: AbortSignal,
): Promise<T> {
    const respuesta = await fetch(
        `${API}?${parametros.toString()}`,
        {
            credentials: "same-origin",
            cache: "no-store",
            signal,
        },
    );

    const datos = await respuesta
        .json()
        .catch(() => null);

    if (
        !respuesta.ok ||
        datos?.success !== true
    ) {
        throw new Error(
            datos?.mensaje ||
                "No s'ha pogut carregar la informació.",
        );
    }

    return datos as T;
}

function nombreUsuario(
    usuario: UsuarioFila,
) {
    return [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Usuari sense nom";
}

function inicialesUsuario(
    usuario: UsuarioFila,
) {
    const partes = [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ].filter(
        (valor): valor is string =>
            typeof valor === "string" &&
            valor.trim().length > 0,
    );

    return (
        partes
            .slice(0, 2)
            .map(
                (parte) =>
                    Array.from(
                        parte.trim(),
                    )[0],
            )
            .join("")
            .toLocaleUpperCase(
                "ca-ES",
            ) || "—"
    );
}

function nombreRol(
    valor: string | null,
) {
    const rol =
        normalizarRol(valor);

    return rol
        ? NOMBRES_ROL[rol]
        : valor || "Sense rol";
}

function nombreOrigen(
    valor: string | null,
) {
    switch (
        valor?.trim().toLowerCase()
    ) {
        case "manual":
            return "Manual";

        case "sistema":
            return "Sistema";

        default:
            return "Sense especificar";
    }
}

const botonBase =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "px-4 py-2.5 text-sm font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-neutral/30 focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-background disabled:cursor-not-allowed " +
    "disabled:opacity-50";

const botonSecundario =
    `${botonBase} border border-border bg-background text-neutral ` +
    "hover:border-neutral/40 hover:bg-card";

const botonPrincipal =
    `${botonBase} bg-primary font-semibold text-white ` +
    "hover:bg-primary/90";

const campo =
    "w-full rounded-lg border border-border bg-card " +
    "px-3.5 py-3 text-sm text-neutral outline-none " +
    "placeholder:text-neutral/50 focus:border-neutral/50 " +
    "focus:ring-2 focus:ring-neutral/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

export default function Gestion() {
    const [
        vista,
        setVista,
    ] = useState<
        "lista" | "candidatos"
    >("lista");

    const [
        seleccion,
        setSeleccion,
    ] =
        useState<Seleccion | null>(
            null,
        );

    const [
        busqueda,
        setBusqueda,
    ] = useState("");

    const [
        consulta,
        setConsulta,
    ] = useState("");

    const [
        rol,
        setRol,
    ] = useState("");

    const [
        origen,
        setOrigen,
    ] = useState("");

    const [
        pagina,
        setPagina,
    ] = useState(1);

    const [
        configuracion,
        setConfiguracion,
    ] =
        useState<Configuracion | null>(
            null,
        );

    const [
        lista,
        setLista,
    ] =
        useState<RespuestaLista | null>(
            null,
        );

    const [
        cargandoConfiguracion,
        setCargandoConfiguracion,
    ] = useState(true);

    const [
        cargandoLista,
        setCargandoLista,
    ] = useState(true);

    const [
        errorConfiguracion,
        setErrorConfiguracion,
    ] = useState("");

    const [
        errorLista,
        setErrorLista,
    ] = useState("");

    const [
        aviso,
        setAviso,
    ] = useState("");

    const [
        revision,
        setRevision,
    ] = useState(0);

    const [
        retirada,
        setRetirada,
    ] =
        useState<UsuarioFila | null>(
            null,
        );

    const [
        retirando,
        setRetirando,
    ] = useState(false);

    const [
        errorRetirada,
        setErrorRetirada,
    ] = useState("");

    const bloqueoRetirada =
        useRef(false);

    const tituloRef =
        useRef<HTMLHeadingElement>(
            null,
        );

    const confirmacionRef =
        useRef<HTMLHeadingElement>(
            null,
        );

    /*
     * Debounce de la búsqueda.
     */
    useEffect(() => {
        const temporizador =
            window.setTimeout(
                () => {
                    setConsulta(
                        busqueda.trim(),
                    );

                    setPagina(1);
                },
                300,
            );

        return () =>
            window.clearTimeout(
                temporizador,
            );
    }, [busqueda]);

    /*
     * Capacidades.
     *
     * Se cargan separadas del listado para evitar que
     * desaparezcan botones cada vez que cambia un filtro.
     */
    useEffect(() => {
        if (seleccion) {
            return;
        }

        const controlador =
            new AbortController();

        setCargandoConfiguracion(
            true,
        );

        setErrorConfiguracion("");

        async function cargar() {
            try {
                const datos =
                    await consultar<Configuracion>(
                        new URLSearchParams({
                            vista: "configuracion",
                        }),
                        controlador.signal,
                    );

                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setConfiguracion(
                    datos,
                );
            } catch (err) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setErrorConfiguracion(
                    err instanceof Error
                        ? err.message
                        : "No s'ha pogut carregar la configuració.",
                );
            } finally {
                if (
                    !controlador
                        .signal
                        .aborted
                ) {
                    setCargandoConfiguracion(
                        false,
                    );
                }
            }
        }

        void cargar();

        return () =>
            controlador.abort();
    }, [revision, seleccion]);

    /*
     * Listado.
     */
    useEffect(() => {
        if (seleccion) {
            return;
        }

        const controlador =
            new AbortController();

        setCargandoLista(true);
        setErrorLista("");

        async function cargar() {
            try {
                const parametros =
                    new URLSearchParams({
                        vista,
                        pagina:
                            String(
                                pagina,
                            ),
                    });

                if (consulta) {
                    parametros.set(
                        "q",
                        consulta,
                    );
                }

                if (
                    vista === "lista"
                ) {
                    if (rol) {
                        parametros.set(
                            "rol",
                            rol,
                        );
                    }

                    if (origen) {
                        parametros.set(
                            "origen",
                            origen,
                        );
                    }
                }

                const nuevaLista =
                    await consultar<RespuestaLista>(
                        parametros,
                        controlador.signal,
                    );

                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                const ultimaPagina =
                    Math.max(
                        1,
                        nuevaLista.totalPaginas,
                    );

                if (
                    pagina >
                    ultimaPagina
                ) {
                    setPagina(
                        ultimaPagina,
                    );

                    return;
                }

                setLista(
                    nuevaLista,
                );
            } catch (err) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setErrorLista(
                    err instanceof Error
                        ? err.message
                        : "No s'ha pogut carregar la informació.",
                );
            } finally {
                if (
                    !controlador
                        .signal
                        .aborted
                ) {
                    setCargandoLista(
                        false,
                    );
                }
            }
        }

        void cargar();

        return () =>
            controlador.abort();
    }, [
        vista,
        consulta,
        rol,
        origen,
        pagina,
        revision,
        seleccion,
    ]);

    useEffect(() => {
        if (retirada) {
            window.requestAnimationFrame(
                () =>
                    confirmacionRef.current?.focus(),
            );
        }
    }, [retirada]);

    function cambiarVista(
        nuevaVista:
            | "lista"
            | "candidatos",
    ) {
        setVista(nuevaVista);

        setBusqueda("");
        setConsulta("");
        setRol("");
        setOrigen("");
        setPagina(1);

        setRetirada(null);
        setErrorRetirada("");
        setAviso("");
    }

    function abrir(
        usuario: UsuarioFila,
        modo: Seleccion["modo"],
    ) {
        setAviso("");
        setRetirada(null);

        setSeleccion({
            id: usuario.id,
            modo,
        });
    }

    function volverDelAsistente(
        mensaje?: string,
    ) {
        setSeleccion(null);

        setRetirada(null);
        setErrorRetirada("");

        if (mensaje) {
            setVista("lista");

            setBusqueda("");
            setConsulta("");
            setRol("");
            setOrigen("");
            setPagina(1);

            setAviso(mensaje);
        }

        setRevision(
            (valor) =>
                valor + 1,
        );

        window.requestAnimationFrame(
            () =>
                tituloRef.current?.focus(),
        );
    }

    async function confirmarRetirada() {
        if (
            !retirada ||
            bloqueoRetirada.current
        ) {
            return;
        }

        bloqueoRetirada.current =
            true;

        setRetirando(true);
        setErrorRetirada("");

        try {
            const respuesta =
                await fetch(
                    API,
                    {
                        method: "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify(
                            {
                                accion:
                                    "eliminar",

                                id: retirada.id,

                                fecha_actualizacion:
                                    retirada.fecha_actualizacion,
                            },
                        ),
                    },
                );

            const datos =
                await respuesta
                    .json()
                    .catch(
                        () =>
                            null,
                    );

            if (
                !respuesta.ok ||
                datos?.success !==
                    true
            ) {
                throw new Error(
                    datos?.mensaje ||
                        "No s'ha pogut retirar l'accés.",
                );
            }

            setRetirada(null);

            setAviso(
                "S'ha retirat l'accés al panell.",
            );

            setRevision(
                (valor) =>
                    valor + 1,
            );

            window.requestAnimationFrame(
                () =>
                    tituloRef.current?.focus(),
            );
        } catch (err) {
            setErrorRetirada(
                err instanceof Error
                    ? err.message
                    : "No s'ha pogut retirar l'accés.",
            );
        } finally {
            bloqueoRetirada.current =
                false;

            setRetirando(false);
        }
    }

    /*
     * El asistente sustituye completamente el listado
     * mientras estamos gestionando un usuario.
     */
    if (seleccion) {
        return (
            <Asistente
                key={`${seleccion.modo}:${seleccion.id}`}
                usuarioID={
                    seleccion.id
                }
                modo={
                    seleccion.modo
                }
                onCancelar={() =>
                    volverDelAsistente()
                }
                onGuardado={(
                    mensaje,
                ) =>
                    volverDelAsistente(
                        mensaje,
                    )
                }
            />
        );
    }

    const candidatos =
        vista === "candidatos";

    const cargando =
        cargandoLista;

    const error =
        errorLista ||
        errorConfiguracion;

    function accionesUsuario(
        usuario: UsuarioFila,
    ) {
        if (candidatos) {
            if (
                !configuracion
                    ?.capacidades
                    .crear
            ) {
                return null;
            }

            return (
                <button
                    type="button"
                    className={
                        botonSecundario
                    }
                    onClick={() =>
                        abrir(
                            usuario,
                            "crear",
                        )
                    }
                >
                    Configurar accés

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                        aria-hidden="true"
                    >
                        <path d="m9 18 6-6-6-6" />
                    </svg>
                </button>
            );
        }

        return (
            <>
                <button
                    type="button"
                    className={
                        botonSecundario
                    }
                    onClick={() =>
                        abrir(
                            usuario,
                            usuario.puedeEditar
                                ? "editar"
                                : "ver",
                        )
                    }
                >
                    {usuario.puedeEditar
                        ? "Gestionar"
                        : "Consultar"}
                </button>

                {usuario.puedeRetirar && (
                    <button
                        type="button"
                        disabled={
                            retirando
                        }
                        onClick={() => {
                            setRetirada(
                                usuario,
                            );

                            setErrorRetirada(
                                "",
                            );

                            setAviso("");
                        }}
                        className={`
                            ${botonBase}
                            border
                            border-transparent
                            text-error
                            hover:border-error/20
                            hover:bg-error-container/30
                        `}
                    >
                        Retirar
                    </button>
                )}
            </>
        );
    }

    return (
        <>
            <div className="space-y-6 text-neutral">
                {/* Cabecera */}
                <header
                    className="
                        flex flex-col gap-5
                        border-b border-border
                        pb-6
                        lg:flex-row
                        lg:items-end
                        lg:justify-between
                    "
                >
                    <div>
                        {candidatos && (
                            <button
                                type="button"
                                onClick={() =>
                                    cambiarVista(
                                        "lista",
                                    )
                                }
                                className="
                                    mb-4 inline-flex
                                    items-center gap-2
                                    text-sm font-medium
                                    text-neutral
                                    hover:underline
                                    focus-visible:outline-none
                                "
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                >
                                    <path d="m15 18-6-6 6-6" />
                                </svg>

                                Tornar a permisos
                            </button>
                        )}

                        <p className="text-xs font-medium tracking-wide">
                            PERMISOS DEL PANELL
                        </p>

                        <h1
                            ref={tituloRef}
                            tabIndex={-1}
                            className="
                                mt-2 text-2xl
                                font-semibold
                                tracking-tight
                                text-neutral
                                outline-none
                                sm:text-3xl
                            "
                        >
                            {candidatos
                                ? "Afegir usuari"
                                : "Gestió de permisos"}
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm leading-6">
                            {candidatos
                                ? "Selecciona un usuari registrat i configura els seus accessos, rols i permisos."
                                : "Consulta els usuaris amb accés administratiu i gestiona els seus rols, tornejos i permisos."}
                        </p>
                    </div>

                    {!candidatos &&
                        !cargandoConfiguracion &&
                        configuracion
                            ?.capacidades
                            .crear && (
                            <button
                                type="button"
                                className={
                                    botonPrincipal
                                }
                                onClick={() =>
                                    cambiarVista(
                                        "candidatos",
                                    )
                                }
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                >
                                    <path d="M12 5v14" />
                                    <path d="M5 12h14" />
                                </svg>

                                Afegir usuari
                            </button>
                        )}
                </header>

                {/* Aviso de operación correcta */}
                {aviso && (
                    <div
                        role="status"
                        className="
                            flex items-start gap-3
                            rounded-xl border
                            border-border
                            bg-card p-4
                        "
                    >
                        <span
                            aria-hidden="true"
                            className="
                                flex h-8 w-8
                                shrink-0
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-border
                                bg-background
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4"
                            >
                                <path d="m5 12 4 4L19 6" />
                            </svg>
                        </span>

                        <div>
                            <p className="text-sm font-semibold">
                                Operació completada
                            </p>

                            <p className="mt-1 text-sm leading-6">
                                {aviso}
                            </p>
                        </div>
                    </div>
                )}

                {/* Filtros */}
                <section
                    aria-label="Filtres"
                    className="
                        rounded-2xl border
                        border-border
                        bg-background p-4
                        sm:p-5
                    "
                >
                    <div
                        className={`
                            grid gap-4
                            ${
                                candidatos
                                    ? "grid-cols-1"
                                    : "md:grid-cols-2 lg:grid-cols-4"
                            }
                        `}
                    >
                        <label
                            className={
                                candidatos
                                    ? ""
                                    : "md:col-span-2"
                            }
                        >
                            <span className="mb-2 block text-xs font-semibold">
                                Cercar usuari
                            </span>

                            <div className="relative">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                    className="
                                        pointer-events-none
                                        absolute left-3.5
                                        top-1/2 h-4 w-4
                                        -translate-y-1/2
                                    "
                                >
                                    <circle
                                        cx="11"
                                        cy="11"
                                        r="7"
                                    />
                                    <path d="m20 20-3.5-3.5" />
                                </svg>

                                <input
                                    type="search"
                                    value={
                                        busqueda
                                    }
                                    maxLength={
                                        120
                                    }
                                    onChange={(
                                        evento,
                                    ) =>
                                        setBusqueda(
                                            evento
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Nom, cognoms o correu electrònic"
                                    className={`${campo} pl-10`}
                                />
                            </div>
                        </label>

                        {!candidatos && (
                            <>
                                <label>
                                    <span className="mb-2 block text-xs font-semibold">
                                        Rol
                                    </span>

                                    <select
                                        value={
                                            rol
                                        }
                                        className={
                                            campo
                                        }
                                        onChange={(
                                            evento,
                                        ) => {
                                            setRol(
                                                evento
                                                    .target
                                                    .value,
                                            );

                                            setPagina(
                                                1,
                                            );
                                        }}
                                    >
                                        <option value="">
                                            Tots els rols
                                        </option>

                                        {ROLES_ORDENADOS.map(
                                            (
                                                valor,
                                            ) => (
                                                <option
                                                    key={
                                                        valor
                                                    }
                                                    value={
                                                        valor
                                                    }
                                                >
                                                    {
                                                        NOMBRES_ROL[
                                                            valor
                                                        ]
                                                    }
                                                </option>
                                            ),
                                        )}
                                    </select>
                                </label>

                                <label>
                                    <span className="mb-2 block text-xs font-semibold">
                                        Origen
                                    </span>

                                    <select
                                        value={
                                            origen
                                        }
                                        className={
                                            campo
                                        }
                                        onChange={(
                                            evento,
                                        ) => {
                                            setOrigen(
                                                evento
                                                    .target
                                                    .value,
                                            );

                                            setPagina(
                                                1,
                                            );
                                        }}
                                    >
                                        <option value="">
                                            Tots els orígens
                                        </option>

                                        <option value="sistema">
                                            Sistema
                                        </option>

                                        <option value="manual">
                                            Manual
                                        </option>
                                    </select>
                                </label>
                            </>
                        )}
                    </div>
                </section>

                {/* Error */}
                {error && (
                    <div
                        role="alert"
                        className="
                            flex items-start gap-3
                            rounded-xl border
                            border-error/25
                            bg-error-container/30
                            p-4
                            text-error-foreground
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mt-0.5 h-5 w-5 shrink-0"
                            aria-hidden="true"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                            />
                            <path d="M12 8v5" />
                            <path d="M12 16h.01" />
                        </svg>

                        <div className="flex-1">
                            <p className="text-sm font-semibold">
                                No s&apos;ha pogut carregar la informació
                            </p>

                            <p className="mt-1 text-sm leading-6">
                                {error}
                            </p>

                            <button
                                type="button"
                                onClick={() =>
                                    setRevision(
                                        (
                                            valor,
                                        ) =>
                                            valor +
                                            1,
                                    )
                                }
                                className="
                                    mt-3 text-sm
                                    font-semibold
                                    underline
                                "
                            >
                                Tornar-ho a provar
                            </button>
                        </div>
                    </div>
                )}

                {/* Listado */}
                {!error && (
                    <section
                        aria-label={
                            candidatos
                                ? "Usuaris disponibles"
                                : "Usuaris amb permisos"
                        }
                        className="
                            overflow-hidden
                            rounded-2xl border
                            border-border
                            bg-background
                        "
                    >
                        {cargando ? (
                            <div
                                role="status"
                                className="
                                    flex min-h-64
                                    flex-col
                                    items-center
                                    justify-center
                                    gap-3 p-8
                                    text-center
                                "
                            >
                                <span
                                    aria-hidden="true"
                                    className="
                                        h-8 w-8
                                        animate-spin
                                        rounded-full
                                        border-2
                                        border-border
                                        border-t-primary
                                    "
                                />

                                <div>
                                    <p className="text-sm font-semibold">
                                        Carregant usuaris
                                    </p>

                                    <p className="mt-1 text-xs">
                                        Recuperant la informació disponible.
                                    </p>
                                </div>
                            </div>
                        ) : lista?.filas
                              .length ===
                          0 ? (
                            <div
                                className="
                                    flex min-h-64
                                    flex-col
                                    items-center
                                    justify-center
                                    p-8 text-center
                                "
                            >
                                <span
                                    aria-hidden="true"
                                    className="
                                        flex h-11 w-11
                                        items-center
                                        justify-center
                                        rounded-xl
                                        border
                                        border-border
                                        bg-card
                                    "
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-5 w-5"
                                    >
                                        <circle
                                            cx="10"
                                            cy="8"
                                            r="3"
                                        />
                                        <path d="M4 19v-1a6 6 0 0 1 11.3-2.8" />
                                        <path d="m17 17 4 4" />
                                        <path d="m21 17-4 4" />
                                    </svg>
                                </span>

                                <h2 className="mt-4 text-sm font-semibold">
                                    No s&apos;han trobat usuaris
                                </h2>

                                <p className="mt-2 max-w-md text-xs leading-5">
                                    {consulta ||
                                    rol ||
                                    origen
                                        ? "Prova de canviar la cerca o els filtres."
                                        : candidatos
                                          ? "No hi ha usuaris actius disponibles per afegir al panell."
                                          : "Encara no hi ha usuaris amb permisos assignats."}
                                </p>
                            </div>
                        ) : lista ? (
                            <>
                                {/* Escritorio */}
                                <div className="hidden overflow-x-auto md:block">
                                    <table className="w-full text-left text-sm">
                                        <thead
                                            className="
                                                border-b
                                                border-border
                                                bg-card
                                                text-xs
                                            "
                                        >
                                            <tr>
                                                <th
                                                    scope="col"
                                                    className="px-5 py-3.5 font-semibold"
                                                >
                                                    Usuari
                                                </th>

                                                {!candidatos && (
                                                    <>
                                                        <th
                                                            scope="col"
                                                            className="px-5 py-3.5 font-semibold"
                                                        >
                                                            Rol
                                                        </th>

                                                        <th
                                                            scope="col"
                                                            className="px-5 py-3.5 font-semibold"
                                                        >
                                                            Origen
                                                        </th>
                                                    </>
                                                )}

                                                <th
                                                    scope="col"
                                                    className="px-5 py-3.5 font-semibold"
                                                >
                                                    Compte
                                                </th>

                                                <th
                                                    scope="col"
                                                    className="px-5 py-3.5 text-right font-semibold"
                                                >
                                                    Accions
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-border">
                                            {lista.filas.map(
                                                (
                                                    usuario,
                                                ) => (
                                                    <tr
                                                        key={
                                                            usuario.id
                                                        }
                                                        className="
                                                            transition-colors
                                                            hover:bg-card/40
                                                        "
                                                    >
                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    aria-hidden="true"
                                                                    className="
                                                                        flex h-10 w-10
                                                                        shrink-0
                                                                        items-center
                                                                        justify-center
                                                                        rounded-xl
                                                                        border
                                                                        border-border
                                                                        bg-card
                                                                        text-xs
                                                                        font-semibold
                                                                    "
                                                                >
                                                                    {inicialesUsuario(
                                                                        usuario,
                                                                    )}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <p className="font-semibold">
                                                                        {nombreUsuario(
                                                                            usuario,
                                                                        )}
                                                                    </p>

                                                                    <p className="mt-1 max-w-xs truncate text-xs">
                                                                        {usuario.email ||
                                                                            "Sense correu electrònic"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {!candidatos && (
                                                            <>
                                                                <td className="whitespace-nowrap px-5 py-4">
                                                                    <span
                                                                        className="
                                                                            inline-flex
                                                                            rounded-full
                                                                            border
                                                                            border-border
                                                                            bg-card
                                                                            px-2.5
                                                                            py-1
                                                                            text-xs
                                                                            font-medium
                                                                        "
                                                                    >
                                                                        {nombreRol(
                                                                            usuario.rol,
                                                                        )}
                                                                    </span>
                                                                </td>

                                                                <td className="whitespace-nowrap px-5 py-4 text-xs">
                                                                    {nombreOrigen(
                                                                        usuario.origen_permisos,
                                                                    )}
                                                                </td>
                                                            </>
                                                        )}

                                                        <td className="whitespace-nowrap px-5 py-4">
                                                            <span className="inline-flex items-center gap-2 text-xs">
                                                                <span
                                                                    aria-hidden="true"
                                                                    className={`h-2 w-2 rounded-full ${
                                                                        usuario.activa ===
                                                                        true
                                                                            ? "bg-primary"
                                                                            : "bg-error"
                                                                    }`}
                                                                />

                                                                {usuario.activa ===
                                                                true
                                                                    ? "Actiu"
                                                                    : "Inactiu"}
                                                            </span>
                                                        </td>

                                                        <td className="px-5 py-4">
                                                            <div className="flex justify-end gap-2">
                                                                {accionesUsuario(
                                                                    usuario,
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ),
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Móvil */}
                                <div className="divide-y divide-border md:hidden">
                                    {lista.filas.map(
                                        (
                                            usuario,
                                        ) => (
                                            <article
                                                key={
                                                    usuario.id
                                                }
                                                className="p-4"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        aria-hidden="true"
                                                        className="
                                                            flex h-11 w-11
                                                            shrink-0
                                                            items-center
                                                            justify-center
                                                            rounded-xl
                                                            border
                                                            border-border
                                                            bg-card
                                                            text-xs
                                                            font-semibold
                                                        "
                                                    >
                                                        {inicialesUsuario(
                                                            usuario,
                                                        )}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="wrap-break-words text-sm font-semibold">
                                                            {nombreUsuario(
                                                                usuario,
                                                            )}
                                                        </h3>

                                                        <p className="mt-1 break-all text-xs">
                                                            {usuario.email ||
                                                                "Sense correu electrònic"}
                                                        </p>

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            {!candidatos && (
                                                                <>
                                                                    <span
                                                                        className="
                                                                            rounded-full
                                                                            border
                                                                            border-border
                                                                            bg-card
                                                                            px-2.5
                                                                            py-1
                                                                            text-xs
                                                                        "
                                                                    >
                                                                        {nombreRol(
                                                                            usuario.rol,
                                                                        )}
                                                                    </span>

                                                                    <span
                                                                        className="
                                                                            rounded-full
                                                                            border
                                                                            border-border
                                                                            bg-card
                                                                            px-2.5
                                                                            py-1
                                                                            text-xs
                                                                        "
                                                                    >
                                                                        {nombreOrigen(
                                                                            usuario.origen_permisos,
                                                                        )}
                                                                    </span>
                                                                </>
                                                            )}

                                                            <span
                                                                className="
                                                                    inline-flex
                                                                    items-center
                                                                    gap-2
                                                                    rounded-full
                                                                    border
                                                                    border-border
                                                                    bg-card
                                                                    px-2.5
                                                                    py-1
                                                                    text-xs
                                                                "
                                                            >
                                                                <span
                                                                    aria-hidden="true"
                                                                    className={`h-1.5 w-1.5 rounded-full ${
                                                                        usuario.activa ===
                                                                        true
                                                                            ? "bg-primary"
                                                                            : "bg-error"
                                                                    }`}
                                                                />

                                                                {usuario.activa ===
                                                                true
                                                                    ? "Actiu"
                                                                    : "Inactiu"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                                                    {accionesUsuario(
                                                        usuario,
                                                    )}
                                                </div>
                                            </article>
                                        ),
                                    )}
                                </div>

                                {/* Paginación */}
                                <footer
                                    className="
                                        flex flex-col gap-3
                                        border-t
                                        border-border
                                        bg-card/30
                                        px-5 py-4
                                        sm:flex-row
                                        sm:items-center
                                        sm:justify-between
                                    "
                                >
                                    <p className="text-xs">
                                        {lista.total}{" "}
                                        {lista.total ===
                                        1
                                            ? "usuari"
                                            : "usuaris"}

                                        {" · "}

                                        Pàgina{" "}
                                        {lista.pagina}{" "}
                                        de{" "}
                                        {Math.max(
                                            1,
                                            lista.totalPaginas,
                                        )}
                                    </p>

                                    <nav
                                        aria-label="Paginació"
                                        className="flex gap-2"
                                    >
                                        <button
                                            type="button"
                                            className={
                                                botonSecundario
                                            }
                                            disabled={
                                                pagina <=
                                                1
                                            }
                                            onClick={() =>
                                                setPagina(
                                                    (
                                                        valor,
                                                    ) =>
                                                        valor -
                                                        1,
                                                )
                                            }
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.7"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            >
                                                <path d="m15 18-6-6 6-6" />
                                            </svg>

                                            Anterior
                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                botonSecundario
                                            }
                                            disabled={
                                                pagina >=
                                                Math.max(
                                                    1,
                                                    lista.totalPaginas,
                                                )
                                            }
                                            onClick={() =>
                                                setPagina(
                                                    (
                                                        valor,
                                                    ) =>
                                                        valor +
                                                        1,
                                                )
                                            }
                                        >
                                            Següent

                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.7"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4"
                                                aria-hidden="true"
                                            >
                                                <path d="m9 18 6-6-6-6" />
                                            </svg>
                                        </button>
                                    </nav>
                                </footer>
                            </>
                        ) : null}
                    </section>
                )}

                {!candidatos &&
                    !cargando &&
                    lista &&
                    lista.filas.length >
                        0 && (
                        <p className="text-xs leading-6">
                            El rol mostrat correspon al rol general resultant
                            de l&apos;usuari. Dins de cada configuració pots
                            consultar els accessos i permisos específics de
                            cada torneig.
                        </p>
                    )}
            </div>

            {/* Modal retirada */}
            {retirada && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="retirar-acces-titol"
                    className="
                        fixed inset-0 z-100
                        flex items-center
                        justify-center
                        bg-black/35 p-4
                        backdrop-blur-sm
                    "
                    onMouseDown={(
                        evento,
                    ) => {
                        if (
                            evento.target ===
                                evento.currentTarget &&
                            !retirando
                        ) {
                            setRetirada(
                                null,
                            );

                            setErrorRetirada(
                                "",
                            );
                        }
                    }}
                >
                    <section
                        aria-busy={
                            retirando
                        }
                        className="
                            w-full max-w-md
                            rounded-2xl
                            border border-border
                            bg-background p-6
                            text-neutral
                            shadow-2xl
                        "
                    >
                        <div className="flex items-start gap-4">
                            <div
                                aria-hidden="true"
                                className="
                                    flex h-10 w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-error-container
                                    text-error-foreground
                                "
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.7"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-5 w-5"
                                >
                                    <path d="M3 6h18" />
                                    <path d="M8 6V4h8v2" />
                                    <path d="m19 6-1 14H6L5 6" />
                                    <path d="M10 11v5" />
                                    <path d="M14 11v5" />
                                </svg>
                            </div>

                            <div className="min-w-0">
                                <h2
                                    id="retirar-acces-titol"
                                    ref={
                                        confirmacionRef
                                    }
                                    tabIndex={-1}
                                    className="
                                        text-lg
                                        font-semibold
                                        outline-none
                                    "
                                >
                                    Retirar l&apos;accés?
                                </h2>

                                <p className="mt-2 text-sm leading-6">
                                    <strong className="font-semibold">
                                        {nombreUsuario(
                                            retirada,
                                        )}
                                    </strong>{" "}
                                    perdrà els permisos generals i
                                    l&apos;accés administratiu als tornejos.
                                </p>

                                <p className="mt-2 text-xs leading-5">
                                    El compte de l&apos;usuari no
                                    s&apos;eliminarà.
                                </p>
                            </div>
                        </div>

                        {errorRetirada && (
                            <p
                                role="alert"
                                className="
                                    mt-5
                                    rounded-lg
                                    border
                                    border-error/25
                                    bg-error-container/30
                                    p-3 text-sm
                                    text-error-foreground
                                "
                            >
                                {
                                    errorRetirada
                                }
                            </p>
                        )}

                        <div
                            className="
                                mt-6 flex
                                flex-col-reverse
                                gap-2
                                sm:flex-row
                                sm:justify-end
                            "
                        >
                            <button
                                type="button"
                                className={
                                    botonSecundario
                                }
                                disabled={
                                    retirando
                                }
                                onClick={() => {
                                    setRetirada(
                                        null,
                                    );

                                    setErrorRetirada(
                                        "",
                                    );
                                }}
                            >
                                Cancel·lar
                            </button>

                            <button
                                type="button"
                                disabled={
                                    retirando
                                }
                                onClick={() =>
                                    void confirmarRetirada()
                                }
                                className={`
                                    ${botonBase}
                                    bg-error
                                    font-semibold
                                    text-white
                                    hover:bg-error/90
                                `}
                            >
                                {retirando ? (
                                    <>
                                        <span
                                            aria-hidden="true"
                                            className="
                                                h-4 w-4
                                                animate-spin
                                                rounded-full
                                                border-2
                                                border-white/40
                                                border-t-white
                                            "
                                        />

                                        Retirant...
                                    </>
                                ) : (
                                    "Retirar accés"
                                )}
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}