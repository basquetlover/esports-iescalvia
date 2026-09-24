import { useCallback, useEffect, useMemo, useState } from "react";
import Cargando from "@components/Cargando";

type Voluntario = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    grupo: string | null;
    tipo_voluntariado: string | null;
    descripcion: string | null;
    validacion_estado: string | null;
    plaza_estado: string | null;
    posicion_lista_espera: number | null;
    nota_admin: string | null;
    created_at: string;
};

type Fila = {
    formulario_id: string;
    usuario_id: string | null;
    origen: string | null;
    estado: string;
    enviado_at: string | null;
    voluntario: Voluntario | null;
};

type Respuesta = {
    success: boolean;
    mensaje?: string;
    edicion?: { id: string; nombre: string };
    pagina?: number;
    total?: number;
    voluntarios?: Fila[];
};

type Props = { torneoID: string; edicionID: string };
type Filtro = "TODOS" | "EN_REVISION" | "APROBADO" | "DENEGADO";

const POR_PAGINA = 30;

function etiquetaEstado(estado: string): string {
    switch (estado) {
        case "APROBADO": return "Acceptada";
        case "DENEGADO": return "Denegada";
        case "EN_REVISION": return "En revisió";
        default: return estado || "Pendent";
    }
}

function claseEstado(estado: string): string {
    switch (estado) {
        case "APROBADO": return "bg-primary/10 text-primary";
        case "DENEGADO": return "bg-error/10 text-error";
        default: return "bg-secondary/10 text-secondary";
    }
}

function fecha(valor: string | null): string {
    if (!valor) return "—";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return "—";
    return new Intl.DateTimeFormat("ca-ES", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
    }).format(fecha);
}

export default function Lista({ torneoID, edicionID }: Props) {
    const [pagina, setPagina] = useState(1);
    const [datos, setDatos] = useState<Respuesta | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState<Filtro>("TODOS");
    const [procesando, setProcesando] = useState<string | null>(null);

    const cargar = useCallback(async (signal?: AbortSignal) => {
        setCargando(true);
        setError("");
        try {
            const parametros = new URLSearchParams({ torneoID, edicionID, pagina: String(pagina) });
            const respuesta = await fetch(`/api/panell/voluntaris?${parametros}`, {
                credentials: "same-origin", cache: "no-store", signal,
            });
            const contenido: Respuesta = await respuesta.json();
            if (!respuesta.ok || !contenido.success) {
                throw new Error(contenido.mensaje || "No s'han pogut carregar els voluntaris.");
            }
            if (!signal?.aborted) setDatos(contenido);
        } catch (causa) {
            if (!signal?.aborted) {
                setError(causa instanceof Error ? causa.message : "No s'han pogut carregar els voluntaris.");
            }
        } finally {
            if (!signal?.aborted) setCargando(false);
        }
    }, [torneoID, edicionID, pagina]);

    useEffect(() => {
        const controlador = new AbortController();
        void cargar(controlador.signal);
        return () => controlador.abort();
    }, [cargar]);

    const filas = useMemo(() => {
        const consulta = busqueda.trim().toLocaleLowerCase("ca");
        return (datos?.voluntarios ?? []).filter(fila => {
            if (filtro !== "TODOS" && fila.estado !== filtro) return false;
            if (!consulta) return true;
            const v = fila.voluntario;
            return [v?.nombre, v?.apellido1, v?.apellido2, v?.email,
                v?.curso, v?.grupo, v?.tipo_voluntariado]
                .some(valor => valor?.toLocaleLowerCase("ca").includes(consulta));
        });
    }, [datos, filtro, busqueda]);

    async function revisar(fila: Fila, accion: "aceptar" | "rechazar") {
        if (!fila.voluntario || procesando) return;
        const nombre = [fila.voluntario.nombre, fila.voluntario.apellido1].filter(Boolean).join(" ");
        const confirmacion = accion === "aceptar"
            ? `Acceptar ${nombre}? Obtindrà accés de voluntariat a aquesta edició.`
            : `Denegar la sol·licitud de ${nombre}? Perdrà l'accés a aquesta edició.`;
        if (!window.confirm(confirmacion)) return;

        setProcesando(fila.voluntario.id);
        setError("");
        setMensaje("");
        try {
            const respuesta = await fetch("/api/panell/voluntaris", {
                method: "PATCH",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    torneoID, edicionID, voluntarioID: fila.voluntario.id, accion,
                }),
            });
            const contenido: Respuesta = await respuesta.json();
            if (!respuesta.ok || !contenido.success) {
                throw new Error(contenido.mensaje || "No s'ha pogut revisar la sol·licitud.");
            }
            setMensaje(accion === "aceptar"
                ? "Voluntari acceptat en aquesta edició."
                : "Sol·licitud denegada.");
            await cargar();
        } catch (causa) {
            setError(causa instanceof Error ? causa.message : "No s'ha pogut revisar la sol·licitud.");
        } finally {
            setProcesando(null);
        }
    }

    const contexto = new URLSearchParams({ torneoID, edicionID });
    const total = datos?.total ?? 0;
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

    return (
        <section className="w-full px-4 pb-10" aria-label="Llistat de voluntaris">
            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm md:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-titulos">
                            {datos?.edicion?.nombre ?? "Voluntaris de l'edició"}
                        </h2>
                        <p className="mt-1 text-sm text-neutral">
                            {total} {total === 1 ? "sol·licitud" : "sol·licituds"} en total
                        </p>
                    </div>
                    <a href={`/panell/voluntaris/nou?${contexto}`}
                        className="inline-flex items-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        Crear voluntari
                    </a>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="block text-sm font-medium text-neutral-titulos">
                        Cercar en aquesta pàgina
                        <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
                            placeholder="Nom, correu, curs o tipus"
                            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-neutral-titulos" />
                    </label>
                    <label className="block text-sm font-medium text-neutral-titulos">
                        Estat
                        <select value={filtro} onChange={e => setFiltro(e.target.value as Filtro)}
                            className="mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-neutral-titulos">
                            <option value="TODOS">Tots</option>
                            <option value="EN_REVISION">En revisió</option>
                            <option value="APROBADO">Acceptats</option>
                            <option value="DENEGADO">Denegats</option>
                        </select>
                    </label>
                </div>

                {mensaje && <p role="status" className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">{mensaje}</p>}
                {error && <p role="alert" className="mt-4 rounded-lg bg-error/10 p-3 text-sm text-error">{error}</p>}

                {cargando && !datos ? (
                    <div className="py-12"><Cargando /></div>
                ) : (
                    <div className="mt-5 space-y-3" aria-busy={cargando}>
                        {filas.length === 0 && (
                            <p className="rounded-xl border border-border/50 p-8 text-center text-sm text-neutral">
                                {cargando ? "Actualitzant..." : "No hi ha voluntaris per a aquest filtre en aquesta pàgina."}
                            </p>
                        )}
                        {filas.map(fila => {
                            const v = fila.voluntario;
                            const ocupat = procesando === v?.id;
                            return (
                                <article key={fila.formulario_id} className="rounded-xl border border-border/50 bg-background p-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-neutral-titulos">
                                                {[v?.nombre, v?.apellido1, v?.apellido2].filter(Boolean).join(" ") || "Dades pendents"}
                                            </h3>
                                            <p className="mt-1 break-all text-sm text-neutral">{v?.email || "Sense correu"}</p>
                                            <p className="mt-1 text-sm text-neutral">
                                                {[v?.curso, v?.grupo].filter(Boolean).join(" · ") || "Sense curs"}
                                                {v?.tipo_voluntariado ? ` · ${v.tipo_voluntariado}` : ""}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${claseEstado(fila.estado)}`}>
                                                {etiquetaEstado(fila.estado)}
                                            </span>
                                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-neutral">
                                                {fila.origen === "ADMIN" ? "Creat des del panell" : "Inscripció web"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
                                        <span className="text-xs text-neutral">Enviat: {fecha(fila.enviado_at)}</span>
                                        <div className="flex flex-wrap gap-2">
                                            {v && <a href={`/panell/voluntaris/${v.id}?${contexto}`}
                                                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-neutral-titulos hover:bg-primary/5">
                                                Veure fitxa
                                            </a>}
                                            {v && fila.estado !== "APROBADO" && (
                                                <button type="button" disabled={Boolean(procesando)}
                                                    onClick={() => void revisar(fila, "aceptar")}
                                                    className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                                                    {ocupat ? "Desant..." : "Acceptar"}
                                                </button>
                                            )}
                                            {v && fila.estado !== "DENEGADO" && (
                                                <button type="button" disabled={Boolean(procesando)}
                                                    onClick={() => void revisar(fila, "rechazar")}
                                                    className="rounded-lg border border-error/40 px-3 py-2 text-xs font-semibold text-error disabled:opacity-50">
                                                    Denegar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}

                {paginas > 1 && (
                    <nav aria-label="Paginació dels voluntaris" className="mt-6 flex items-center justify-end gap-3">
                        <button type="button" disabled={pagina <= 1 || cargando}
                            onClick={() => setPagina(actual => actual - 1)}
                            className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Anterior</button>
                        <span className="text-sm text-neutral">{pagina} / {paginas}</span>
                        <button type="button" disabled={pagina >= paginas || cargando}
                            onClick={() => setPagina(actual => actual + 1)}
                            className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Següent</button>
                    </nav>
                )}
            </div>
        </section>
    );
}