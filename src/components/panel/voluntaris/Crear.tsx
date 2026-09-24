import { useEffect, useMemo, useState, type FormEvent } from "react";
import Cargando from "@components/Cargando";

type Curso = { curso: string; grupos: string[] };
type Tipo = { id: string; nombre: string };
type Usuario = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string;
    curso: string | null;
};
type Datos = {
    nombre: string;
    apellido1: string;
    apellido2: string;
    email: string;
    curso: string;
    grupo: string;
    tipo_voluntariado_id: string;
    descripcion: string;
};
type Props = { torneoID: string; edicionID: string; volver: string };

const VACIO: Datos = {
    nombre: "", apellido1: "", apellido2: "", email: "",
    curso: "", grupo: "", tipo_voluntariado_id: "", descripcion: "",
};

export default function Crear({ torneoID, edicionID, volver }: Props) {
    const [cursos, setCursos] = useState<Curso[]>([]);
    const [tipos, setTipos] = useState<Tipo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [correoCuenta, setCorreoCuenta] = useState("");
    const [usuario, setUsuario] = useState<Usuario | null>(null);
    const [buscando, setBuscando] = useState(false);
    const [datos, setDatos] = useState<Datos>(VACIO);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const controlador = new AbortController();
        async function preparar() {
            try {
                const params = new URLSearchParams({ edicionID });
                const respuesta = await fetch(`/api/inscripcio/voluntari?${params}`, {
                    credentials: "same-origin", cache: "no-store", signal: controlador.signal,
                });
                const contenido = await respuesta.json();
                if (!respuesta.ok || !contenido.success) {
                    throw new Error(contenido.mensaje || "No s'ha pogut carregar la configuració.");
                }
                if (controlador.signal.aborted) return;
                setCursos(Array.isArray(contenido.cursos) ? contenido.cursos : []);
                setTipos(Array.isArray(contenido.tipos) ? contenido.tipos : []);
            } catch (causa) {
                if (!controlador.signal.aborted) {
                    setError(causa instanceof Error ? causa.message : "No s'ha pogut carregar la configuració.");
                }
            } finally {
                if (!controlador.signal.aborted) setCargando(false);
            }
        }
        void preparar();
        return () => controlador.abort();
    }, [edicionID]);

    const grupos = useMemo(() =>
        cursos.find(opcion => opcion.curso === datos.curso)?.grupos ?? [],
    [cursos, datos.curso]);

    async function buscarCuenta(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setError("");
        setUsuario(null);
        setDatos(VACIO);
        setBuscando(true);
        try {
            const params = new URLSearchParams({ torneoID, edicionID, buscarEmail: correoCuenta.trim() });
            const respuesta = await fetch(`/api/panell/voluntaris?${params}`, {
                credentials: "same-origin", cache: "no-store",
            });
            const contenido = await respuesta.json();
            if (!respuesta.ok || !contenido.success || !contenido.usuario) {
                throw new Error(contenido.mensaje || "No s'ha trobat el compte.");
            }
            const encontrado = contenido.usuario as Usuario;
            setUsuario(encontrado);
            setDatos({
                ...VACIO,
                nombre: encontrado.nombre ?? "",
                apellido1: encontrado.apellido1 ?? "",
                apellido2: encontrado.apellido2 ?? "",
                email: encontrado.email,
                curso: cursos.some(opcion => opcion.curso === encontrado.curso)
                    ? encontrado.curso ?? "" : "",
            });
        } catch (causa) {
            setError(causa instanceof Error ? causa.message : "No s'ha trobat el compte.");
        } finally {
            setBuscando(false);
        }
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!usuario || guardando) return;
        setGuardando(true);
        setError("");
        try {
            const respuesta = await fetch("/api/panell/voluntaris", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ torneoID, edicionID, usuarioID: usuario.id, ...datos }),
            });
            const contenido = await respuesta.json();
            if (!respuesta.ok || !contenido.success) {
                throw new Error(contenido.mensaje || "No s'ha pogut crear el voluntari.");
            }
            const params = new URLSearchParams({ torneoID, edicionID });
            window.location.assign(contenido.voluntario_id
                ? `/panell/voluntaris/${contenido.voluntario_id}?${params}`
                : volver);
        } catch (causa) {
            setError(causa instanceof Error ? causa.message : "No s'ha pogut crear el voluntari.");
            setGuardando(false);
        }
    }

    const campo = "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/10";

    if (cargando) return <Cargando />;

    return (
        <div className="max-w-4xl space-y-5">
            {error && <p role="alert" className="rounded-xl border border-error/30 bg-error/10 p-4 text-sm text-error">{error}</p>}

            <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm md:p-6">
                <h2 className="text-lg font-semibold text-neutral-titulos">1. Compte de la persona voluntària</h2>
                <p className="mt-1 text-sm text-neutral">
                    Cerca el compte pel correu electrònic. La inscripció quedarà vinculada a aquest usuari i a aquesta edició.
                </p>
                <form onSubmit={e => void buscarCuenta(e)} className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="min-w-64 flex-1 text-sm font-medium text-neutral-titulos">
                        Correu del compte
                        <input type="email" required maxLength={254} value={correoCuenta}
                            onChange={e => {
                                setCorreoCuenta(e.target.value);
                                setUsuario(null);
                                setDatos(VACIO);
                            }}
                            className={campo} placeholder="nom@iescalvia.com" />
                    </label>
                    <button type="submit" disabled={buscando || guardando}
                        className="rounded-lg border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50">
                        {buscando ? "Cercant..." : "Cercar compte"}
                    </button>
                </form>
                {usuario && <p role="status" className="mt-4 rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    Compte seleccionat: {[usuario.nombre, usuario.apellido1, usuario.apellido2].filter(Boolean).join(" ")} ({usuario.email})
                </p>}
            </section>

            {usuario && (
                <form onSubmit={e => void guardar(e)} className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm md:p-6">
                    <h2 className="text-lg font-semibold text-neutral-titulos">2. Dades del voluntariat</h2>
                    <p className="mt-1 text-sm text-neutral">La sol·licitud quedarà en revisió fins que sigui acceptada.</p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                        <label className="text-sm font-medium text-neutral-titulos">
                            Nom *
                            <input required maxLength={100} value={datos.nombre} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, nombre: e.target.value }))} />
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos">
                            Primer llinatge *
                            <input required maxLength={100} value={datos.apellido1} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, apellido1: e.target.value }))} />
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos">
                            Segon llinatge
                            <input maxLength={100} value={datos.apellido2} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, apellido2: e.target.value }))} />
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos">
                            Correu de contacte *
                            <input type="email" required maxLength={254} value={datos.email} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, email: e.target.value }))} />
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos">
                            Curs *
                            <select required value={datos.curso} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, curso: e.target.value, grupo: "" }))}>
                                <option value="">Selecciona un curs</option>
                                {cursos.map(opcion => <option key={opcion.curso} value={opcion.curso}>{opcion.curso}</option>)}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos">
                            Grup *
                            <select required value={datos.grupo} className={campo} disabled={!datos.curso}
                                onChange={e => setDatos(actual => ({ ...actual, grupo: e.target.value }))}>
                                <option value="">Selecciona un grup</option>
                                {grupos.map(grupo => <option key={grupo} value={grupo}>{grupo}</option>)}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos sm:col-span-2">
                            Tipus de voluntariat *
                            <select required value={datos.tipo_voluntariado_id} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, tipo_voluntariado_id: e.target.value }))}>
                                <option value="">Selecciona un tipus</option>
                                {tipos.map(tipo => <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>)}
                            </select>
                        </label>
                        <label className="text-sm font-medium text-neutral-titulos sm:col-span-2">
                            Presentació
                            <textarea rows={5} maxLength={2000} value={datos.descripcion} className={campo}
                                onChange={e => setDatos(actual => ({ ...actual, descripcion: e.target.value }))} />
                        </label>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border/50 pt-5">
                        <a href={volver} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-neutral-titulos">
                            Cancel·lar
                        </a>
                        <button type="submit" disabled={guardando}
                            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                            {guardando ? "Desant..." : "Crear sol·licitud"}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}