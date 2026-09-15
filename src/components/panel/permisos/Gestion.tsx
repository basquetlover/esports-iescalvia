import { useEffect, useRef, useState } from "react";
import Asistente from "./Asistente";
import {
    NOMBRES_ROL,
    ROLES_ORDENADOS,
    normalizarRol,
} from "../../../const/Permisos";

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
    const respuesta = await fetch(`${API}?${parametros}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
    });

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok || datos?.success !== true) {
        throw new Error(
            datos?.mensaje || "No s'ha pogut carregar la informació.",
        );
    }

    return datos as T;
}

function nombreUsuario(usuario: UsuarioFila) {
    return [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Usuari sense nom";
}

function nombreRol(valor: string | null) {
    const rol = normalizarRol(valor);
    return rol ? NOMBRES_ROL[rol] : valor || "Sense rol";
}

function nombreOrigen(valor: string | null) {
    switch (valor?.trim().toLowerCase()) {
        case "manual":
            return "Manual";
        case "sistema":
            return "Sistema";
        default:
            return "Sense especificar";
    }
}

const boton =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 " +
    "text-sm font-semibold transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-primary " +
    "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const secundario =
    `${boton} border border-border bg-white text-neutral ` +
    "hover:bg-primary/5 [.oscuro_&]:bg-card";

const principal =
    `${boton} bg-primary text-white hover:bg-primary/90`;

const campo =
    "w-full rounded-lg border border-border bg-[#f0f5ff] px-3 py-2.5 " +
    "text-sm text-neutral outline-none focus:border-primary " +
    "focus:ring-2 focus:ring-primary/15 [.oscuro_&]:bg-background";

export default function Gestion() {
    const [vista, setVista] = useState<"lista" | "candidatos">("lista");
    const [seleccion, setSeleccion] = useState<Seleccion | null>(null);

    const [busqueda, setBusqueda] = useState("");
    const [consulta, setConsulta] = useState("");
    const [rol, setRol] = useState("");
    const [origen, setOrigen] = useState("");
    const [pagina, setPagina] = useState(1);

    const [configuracion, setConfiguracion] =
        useState<Configuracion | null>(null);

    const [lista, setLista] = useState<RespuestaLista | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");
    const [revision, setRevision] = useState(0);

    const [retirada, setRetirada] = useState<UsuarioFila | null>(null);
    const [retirando, setRetirando] = useState(false);
    const [errorRetirada, setErrorRetirada] = useState("");

    const bloqueoRetirada = useRef(false);
    const tituloRef = useRef<HTMLHeadingElement>(null);
    const confirmacionRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const temporizador = window.setTimeout(() => {
            setConsulta(busqueda.trim());
            setPagina(1);
        }, 300);

        return () => window.clearTimeout(temporizador);
    }, [busqueda]);

    useEffect(() => {
        if (seleccion) return;

        const controlador = new AbortController();

        setCargando(true);
        setError("");
        setLista(null);
        setConfiguracion(null);

        async function cargar() {
            try {
                const parametros = new URLSearchParams({
                    vista,
                    pagina: String(pagina),
                });

                if (consulta) parametros.set("q", consulta);

                if (vista === "lista") {
                    if (rol) parametros.set("rol", rol);
                    if (origen) parametros.set("origen", origen);
                }

                const [nuevaConfiguracion, nuevaLista] = await Promise.all([
                    consultar<Configuracion>(
                        new URLSearchParams({ vista: "configuracion" }),
                        controlador.signal,
                    ),
                    consultar<RespuestaLista>(
                        parametros,
                        controlador.signal,
                    ),
                ]);

                if (controlador.signal.aborted) return;

                // Si desaparece la última fila de una página,
                // vuelve a la última página disponible.
                if (pagina > nuevaLista.totalPaginas) {
                    setPagina(nuevaLista.totalPaginas);
                    return;
                }

                setConfiguracion(nuevaConfiguracion);
                setLista(nuevaLista);
            } catch (err) {
                if (controlador.signal.aborted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "No s'ha pogut carregar la informació.",
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [vista, consulta, rol, origen, pagina, revision, seleccion]);

    useEffect(() => {
        if (retirada) {
            confirmacionRef.current?.focus();
        }
    }, [retirada]);

    function cambiarVista(nuevaVista: "lista" | "candidatos") {
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

    function abrir(usuario: UsuarioFila, modo: Seleccion["modo"]) {
        setAviso("");
        setRetirada(null);
        setSeleccion({ id: usuario.id, modo });
    }

    function volverDelAsistente(mensaje?: string) {
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

        setRevision((valor) => valor + 1);

        window.requestAnimationFrame(() => {
            tituloRef.current?.focus();
        });
    }

    async function confirmarRetirada() {
        if (!retirada || bloqueoRetirada.current) return;

        bloqueoRetirada.current = true;
        setRetirando(true);
        setErrorRetirada("");

        try {
            const respuesta = await fetch(API, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    accion: "eliminar",
                    id: retirada.id,
                    fecha_actualizacion: retirada.fecha_actualizacion,
                }),
            });

            const datos = await respuesta.json().catch(() => null);

            if (!respuesta.ok || datos?.success !== true) {
                throw new Error(
                    datos?.mensaje || "No s'ha pogut retirar l'accés.",
                );
            }

            setRetirada(null);
            setAviso(
                "S'ha retirat l'accés al panell. " +
                "No s'ha enviat cap correu: l'enviament encara està pendent d'implementar.",
            );
            setRevision((valor) => valor + 1);

            window.requestAnimationFrame(() => {
                tituloRef.current?.focus();
            });
        } catch (err) {
            setErrorRetirada(
                err instanceof Error
                    ? err.message
                    : "No s'ha pogut retirar l'accés.",
            );
        } finally {
            bloqueoRetirada.current = false;
            setRetirando(false);
        }
    }

    if (seleccion) {
        return (
            <Asistente
                key={`${seleccion.modo}:${seleccion.id}`}
                usuarioID={seleccion.id}
                modo={seleccion.modo}
                onCancelar={() => volverDelAsistente()}
                onGuardado={(mensaje: string) => volverDelAsistente(mensaje)}
            />
        );
    }

    const candidatos = vista === "candidatos";

    return (
        <div className="space-y-6 text-neutral">
            <header className="space-y-4">
                {candidatos && (
                    <button
                        type="button"
                        className="text-sm font-medium text-neutral hover:underline"
                        onClick={() => cambiarVista("lista")}
                    >
                        ← Tornar a permisos
                    </button>
                )}

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1
                            ref={tituloRef}
                            tabIndex={-1}
                            className="text-2xl font-bold tracking-tight outline-none sm:text-3xl"
                        >
                            {candidatos
                                ? "Afegir usuari al panell"
                                : "Gestió de permisos"}
                        </h1>

                        <p className="mt-2 max-w-2xl text-sm text-neutral">
                            {candidatos
                                ? "Selecciona un usuari registrat per configurar el seu accés al panell."
                                : "Consulta els usuaris amb permisos i gestiona els seus rols i accessos."}
                        </p>
                    </div>

                    {!candidatos && configuracion?.capacidades.crear && (
                        <button
                            type="button"
                            className={principal}
                            onClick={() => cambiarVista("candidatos")}
                        >
                            <span aria-hidden="true">+</span>
                            Afegir usuari al panell
                        </button>
                    )}
                </div>
            </header>

            {aviso && (
                <div
                    role="status"
                    className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm"
                >
                    {aviso}
                </div>
            )}

            {retirada && (
                <section
                    aria-labelledby="retirar-acces-titol"
                    aria-busy={retirando}
                    className="rounded-xl border border-error/30 bg-white p-5 in-[.oscuro_&]:bg-card"
                >
                    <h2
                        id="retirar-acces-titol"
                        ref={confirmacionRef}
                        tabIndex={-1}
                        className="font-semibold text-error outline-none"
                    >
                        Retirar l'accés al panell?
                    </h2>

                    <p className="mt-2 text-sm leading-relaxed">
                        <strong>{nombreUsuario(retirada)}</strong> perdrà
                        els permisos generals i l'accés a tots els tornejos.
                        El seu compte continuarà existint i podrà accedir al perfil.
                    </p>

                    {errorRetirada && (
                        <p role="alert" className="mt-3 text-sm text-error">
                            {errorRetirada}
                        </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-3">
                        <button
                            type="button"
                            className={secundario}
                            disabled={retirando}
                            onClick={() => {
                                setRetirada(null);
                                setErrorRetirada("");
                            }}
                        >
                            Cancel·lar
                        </button>

                        <button
                            type="button"
                            disabled={retirando}
                            onClick={() => void confirmarRetirada()}
                            className={`${boton} bg-error text-white hover:bg-error/90`}
                        >
                            {retirando ? "Retirant accés..." : "Retirar accés"}
                        </button>
                    </div>
                </section>
            )}

            <section
                aria-label={candidatos ? "Usuaris disponibles" : "Usuaris amb permisos"}
                className="overflow-hidden rounded-2xl border border-border bg-white in-[.oscuro_&]:bg-card"
            >
                <div className="grid gap-4 border-b border-border p-4 sm:p-5 lg:grid-cols-4">
                    <label className={candidatos ? "lg:col-span-4" : "lg:col-span-2"}>
                        <span className="mb-2 block text-xs font-semibold">
                            Cercar usuari
                        </span>

                        <input
                            type="search"
                            value={busqueda}
                            maxLength={120}
                            onChange={(evento) => setBusqueda(evento.target.value)}
                            placeholder="Nom, cognoms o correu electrònic"
                            className={campo}
                        />
                    </label>

                    {!candidatos && (
                        <>
                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Rol
                                </span>

                                <select
                                    value={rol}
                                    className={campo}
                                    onChange={(evento) => {
                                        setRol(evento.target.value);
                                        setPagina(1);
                                    }}
                                >
                                    <option value="">Tots els rols</option>
                                    {ROLES_ORDENADOS.map((valor) => (
                                        <option key={valor} value={valor}>
                                            {NOMBRES_ROL[valor]}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Origen dels permisos
                                </span>

                                <select
                                    value={origen}
                                    className={campo}
                                    onChange={(evento) => {
                                        setOrigen(evento.target.value);
                                        setPagina(1);
                                    }}
                                >
                                    <option value="">Tots els orígens</option>
                                    <option value="sistema">Sistema</option>
                                    <option value="manual">Manual</option>
                                </select>
                            </label>
                        </>
                    )}
                </div>

                {cargando ? (
                    <div
                        role="status"
                        className="flex items-center justify-center gap-3 px-5 py-16 text-sm"
                    >
                        <span
                            aria-hidden="true"
                            className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                        />
                        Carregant usuaris...
                    </div>
                ) : error ? (
                    <div className="space-y-4 p-6">
                        <p role="alert" className="text-sm text-error">
                            {error}
                        </p>

                        <button
                            type="button"
                            className={secundario}
                            onClick={() => setRevision((valor) => valor + 1)}
                        >
                            Tornar-ho a provar
                        </button>
                    </div>
                ) : lista?.filas.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                        <h2 className="font-semibold">
                            No s'han trobat usuaris
                        </h2>
                        <p className="mt-2 text-sm text-neutral">
                            {consulta || rol || origen
                                ? "Prova de canviar la cerca o els filtres."
                                : candidatos
                                  ? "No hi ha usuaris actius disponibles per afegir al panell."
                                  : "Encara no hi ha usuaris amb permisos assignats."}
                        </p>
                    </div>
                ) : lista ? (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-[#f5f8ff] text-xs text-neutral in-[.oscuro_&]:bg-background">
                                    <tr>
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Usuari
                                        </th>
                                        {!candidatos && (
                                            <>
                                                <th scope="col" className="px-5 py-3 font-semibold">
                                                    Rol
                                                </th>
                                                <th scope="col" className="px-5 py-3 font-semibold">
                                                    Origen
                                                </th>
                                            </>
                                        )}
                                        <th scope="col" className="px-5 py-3 font-semibold">
                                            Compte
                                        </th>
                                        <th scope="col" className="px-5 py-3 text-right font-semibold">
                                            Accions
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {lista.filas.map((usuario) => (
                                        <tr key={usuario.id} className="hover:bg-primary/3">
                                            <td className="px-5 py-4">
                                                <p className="font-semibold">
                                                    {nombreUsuario(usuario)}
                                                </p>
                                                <p className="mt-1 text-xs text-neutral/65">
                                                    {usuario.email || "Sense correu electrònic"}
                                                </p>
                                            </td>

                                            {!candidatos && (
                                                <>
                                                    <td className="whitespace-nowrap px-5 py-4">
                                                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold">
                                                            {nombreRol(usuario.rol)}
                                                        </span>
                                                    </td>
                                                    <td className="whitespace-nowrap px-5 py-4">
                                                        {nombreOrigen(usuario.origen_permisos)}
                                                    </td>
                                                </>
                                            )}

                                            <td className="whitespace-nowrap px-5 py-4">
                                                <span className="inline-flex items-center gap-2 text-xs">
                                                    <span
                                                        aria-hidden="true"
                                                        className={`h-2 w-2 rounded-full ${
                                                            usuario.activa === true
                                                                ? "bg-primary"
                                                                : "bg-error"
                                                        }`}
                                                    />
                                                    {usuario.activa === true ? "Actiu" : "Inactiu"}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    {candidatos ? (
                                                        configuracion?.capacidades.crear && (
                                                            <button
                                                                type="button"
                                                                className={secundario}
                                                                onClick={() => abrir(usuario, "crear")}
                                                                aria-label={`Seleccionar ${nombreUsuario(usuario)}`}
                                                            >
                                                                Seleccionar
                                                            </button>
                                                        )
                                                    ) : (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className={secundario}
                                                                onClick={() =>
                                                                    abrir(
                                                                        usuario,
                                                                        usuario.puedeEditar ? "editar" : "ver",
                                                                    )
                                                                }
                                                                aria-label={`${
                                                                    usuario.puedeEditar ? "Gestionar" : "Consultar"
                                                                } permisos de ${nombreUsuario(usuario)}`}
                                                            >
                                                                {usuario.puedeEditar ? "Gestionar" : "Consultar"}
                                                            </button>

                                                            {usuario.puedeRetirar && (
                                                                <button
                                                                    type="button"
                                                                    className={`${boton} text-error hover:bg-error/10`}
                                                                    disabled={retirando}
                                                                    onClick={() => {
                                                                        setRetirada(usuario);
                                                                        setErrorRetirada("");
                                                                        setAviso("");
                                                                    }}
                                                                    aria-label={`Retirar accés de ${nombreUsuario(usuario)}`}
                                                                >
                                                                    Retirar
                                                                </button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <footer className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-xs text-neutral">
                                {lista.total} {lista.total === 1 ? "usuari" : "usuaris"}
                                {" · "}Pàgina {lista.pagina} de {lista.totalPaginas}
                            </p>

                            <nav aria-label="Paginació" className="flex gap-2">
                                <button
                                    type="button"
                                    className={secundario}
                                    disabled={pagina <= 1}
                                    onClick={() => setPagina((valor) => valor - 1)}
                                >
                                    Anterior
                                </button>
                                <button
                                    type="button"
                                    className={secundario}
                                    disabled={pagina >= lista.totalPaginas}
                                    onClick={() => setPagina((valor) => valor + 1)}
                                >
                                    Següent
                                </button>
                            </nav>
                        </footer>
                    </>
                ) : null}
            </section>

            {!candidatos && (
                <p className="text-xs leading-relaxed text-neutral/65">
                    El rol del llistat correspon al rol més baix assignat.
                    Dins de cada usuari pots consultar els rols i permisos
                    específics de cada torneig.
                </p>
            )}
        </div>
    );
}