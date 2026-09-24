import { useEffect, useState, type FormEvent } from "react";

const API = "/api/inscripcio/voluntari";

type Curso = { curso: string; grupos: string[] };
type Tipo = { id: string; nombre: string };
type Usuario = {
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
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

type Solicitud = Datos & {
    id: string;
    estado: string;
    plaza_estado: string | null;
    tipo_voluntariado: string | null;
};

type Carga = {
    success: true;
    disponible: boolean;
    mensaje: string | null;
    sesion: { iniciada: boolean; usuario: Usuario | null };
    cursos: Curso[];
    tipos: Tipo[];
    formulario: Solicitud | null;
};

const VACIO: Datos = {
    nombre: "",
    apellido1: "",
    apellido2: "",
    email: "",
    curso: "",
    grupo: "",
    tipo_voluntariado_id: "",
    descripcion: "",
};

const campo =
    "mt-2 w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-70";

function esAprobada(estado: string) {
    return estado === "APROBADO" || estado === "ACEPTADO";
}

export default function FormularioVoluntario({ edicionID }: { edicionID: string }) {
    const [carga, setCarga] = useState<Carga | null>(null);
    const [datos, setDatos] = useState<Datos>(VACIO);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [editando, setEditando] = useState(false);
    const [consentimiento, setConsentimiento] = useState(false);
    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");

    async function cargar(signal?: AbortSignal) {
        const respuesta = await fetch(
            `${API}?edicionID=${encodeURIComponent(edicionID)}`,
            { credentials: "same-origin", cache: "no-store", signal },
        );
        const resultado = await respuesta.json().catch(() => null);

        if (!respuesta.ok || resultado?.success !== true) {
            throw new Error(resultado?.mensaje || "No s'ha pogut carregar la inscripció.");
        }
        if (signal?.aborted) return;

        const siguiente = resultado as Carga;
        setCarga(siguiente);
        setDatos(siguiente.formulario ?? {
            ...VACIO,
            nombre: siguiente.sesion.usuario?.nombre ?? "",
            apellido1: siguiente.sesion.usuario?.apellido1 ?? "",
            apellido2: siguiente.sesion.usuario?.apellido2 ?? "",
            email: siguiente.sesion.usuario?.email ?? "",
        });
        setEditando(false);
    }

    useEffect(() => {
        const controlador = new AbortController();
        setCargando(true);
        setError("");

        cargar(controlador.signal)
            .catch((fallo: unknown) => {
                if (!controlador.signal.aborted) {
                    setError(
                        fallo instanceof Error
                            ? fallo.message
                            : "No s'ha pogut carregar la inscripció.",
                    );
                }
            })
            .finally(() => {
                if (!controlador.signal.aborted) setCargando(false);
            });

        return () => controlador.abort();
    }, [edicionID]);

    function actualizar(clave: keyof Datos, valor: string) {
        setDatos(actual => ({
            ...actual,
            [clave]: valor,
            ...(clave === "curso" ? { grupo: "" } : {}),
        }));
    }

    const solicitud = carga?.formulario ?? null;
    const aprobada = solicitud ? esAprobada(solicitud.estado) : false;
    const nueva = Boolean(carga && !solicitud && carga.disponible);
    const modificable = nueva || (aprobada && editando);
    const editableAprobada = aprobada && editando;
    const cursos = carga?.cursos ?? [];
    const grupos = cursos.find(item => item.curso === datos.curso)?.grupos ?? [];
    const tipos = carga?.tipos ?? [];

    async function enviar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (!carga || guardando || !modificable) return;

        setError("");
        setAviso("");

        if (!cursos.some(item =>
            item.curso === datos.curso && item.grupos.includes(datos.grupo)
        )) {
            setError("Selecciona un curs i un grup vàlids.");
            return;
        }
        if (nueva && !tipos.some(tipo => tipo.id === datos.tipo_voluntariado_id)) {
            setError("Selecciona un rol disponible.");
            return;
        }
        if (nueva && !consentimiento) {
            setError("Has d'acceptar que l'organització es posi en contacte amb tu.");
            return;
        }

        setGuardando(true);

        try {
            const respuesta = await fetch(API, {
                method: nueva ? "POST" : "PATCH",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(nueva
                    ? { edicionID, ...datos }
                    : {
                        edicionID,
                        email: datos.email,
                        curso: datos.curso,
                        grupo: datos.grupo,
                    }),
            });
            const resultado = await respuesta.json().catch(() => null);

            if (!respuesta.ok || resultado?.success !== true) {
                throw new Error(resultado?.mensaje || "No s'ha pogut desar la sol·licitud.");
            }

            await cargar();
            setAviso(nueva
                ? "Sol·licitud enviada. Està pendent de revisió."
                : "Dades actualitzades correctament.");
        } catch (fallo) {
            setError(
                fallo instanceof Error
                    ? fallo.message
                    : "No s'ha pogut desar la sol·licitud.",
            );
        } finally {
            setGuardando(false);
        }
    }

    if (cargando) {
        return <p role="status" className="text-sm text-neutral">Carregant la inscripció...</p>;
    }
    if (!carga) {
        return <p role="alert" className="text-sm text-error">{error}</p>;
    }

    if (!carga.sesion.iniciada) {
        const destino =
            `${window.location.pathname}${window.location.search}#formulari-voluntariat`;

        return (
            <div className="space-y-4 text-sm text-neutral">
                <p>Inicia sessió per presentar o consultar la teva sol·licitud de voluntariat.</p>
                <a
                    href={`/iniciar-sessio?redireccio=${encodeURIComponent(destino)}`}
                    className="inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-white"
                >
                    Iniciar sessió
                </a>
            </div>
        );
    }

    if (!solicitud && !carga.disponible) {
        return (
            <p className="text-sm text-neutral">
                {carga.mensaje ?? "Les inscripcions no estan disponibles."}
            </p>
        );
    }

    const bloqueada = Boolean(solicitud && !aprobada);
    const tituloEstado = solicitud?.estado === "EN_REVISION"
        ? "Sol·licitud en revisió"
        : aprobada
            ? "Sol·licitud acceptada"
            : solicitud?.estado === "DENEGADO"
                ? "Sol·licitud denegada"
                : "Estat de la sol·licitud";

    return (
        <div className="space-y-6">
            {solicitud && (
                <div
                    role="status"
                    className="rounded-xl border border-border bg-card p-4 text-sm text-neutral"
                >
                    <p className="font-semibold text-neutral-titulos">{tituloEstado}</p>
                    <p className="mt-1">
                        {bloqueada
                            ? "Pots consultar les teves dades, però ara no les pots modificar."
                            : "Pots actualitzar el correu electrònic, el curs i el grup."}
                    </p>
                    {solicitud.plaza_estado && (
                        <p className="mt-1">
                            Estat de la plaça:{" "}
                            {solicitud.plaza_estado.replaceAll("_", " ").toLowerCase()}
                        </p>
                    )}
                </div>
            )}

            {aviso && (
                <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm text-primary">
                    {aviso}
                </p>
            )}
            {error && (
                <p role="alert" className="rounded-lg border border-error/30 p-3 text-sm text-error">
                    {error}
                </p>
            )}

            <form onSubmit={enviar} className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {([
                    ["nombre", "Nom"],
                    ["apellido1", "Primer llinatge"],
                    ["apellido2", "Segon llinatge"],
                ] as const).map(([clave, etiqueta]) => (
                    <div key={clave}>
                        <label
                            htmlFor={`voluntari-${clave}`}
                            className="text-sm font-medium text-neutral-titulos"
                        >
                            {etiqueta}
                        </label>
                        <input
                            id={`voluntari-${clave}`}
                            className={campo}
                            value={datos[clave]}
                            onChange={e => actualizar(clave, e.target.value)}
                            disabled={!nueva || guardando}
                            required={clave !== "apellido2"}
                            maxLength={100}
                            autoComplete={
                                clave === "nombre"
                                    ? "given-name"
                                    : clave === "apellido1"
                                        ? "family-name"
                                        : "additional-name"
                            }
                        />
                    </div>
                ))}

                <div>
                    <label htmlFor="voluntari-email" className="text-sm font-medium text-neutral-titulos">
                        Correu electrònic
                    </label>
                    <input
                        id="voluntari-email"
                        type="email"
                        className={campo}
                        value={datos.email}
                        onChange={e => actualizar("email", e.target.value)}
                        disabled={!modificable || guardando}
                        required
                        maxLength={254}
                        autoComplete="email"
                    />
                </div>

                <div>
                    <label htmlFor="voluntari-curs" className="text-sm font-medium text-neutral-titulos">
                        Curs
                    </label>
                    <select
                        id="voluntari-curs"
                        className={campo}
                        value={datos.curso}
                        onChange={e => actualizar("curso", e.target.value)}
                        disabled={!modificable || guardando}
                        required
                    >
                        <option value="">Selecciona un curs</option>
                        {datos.curso && !cursos.some(item => item.curso === datos.curso) && (
                            <option value={datos.curso}>{datos.curso}</option>
                        )}
                        {cursos.map(item => (
                            <option key={item.curso} value={item.curso}>{item.curso}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="voluntari-grup" className="text-sm font-medium text-neutral-titulos">
                        Grup
                    </label>
                    <select
                        id="voluntari-grup"
                        className={campo}
                        value={datos.grupo}
                        onChange={e => actualizar("grupo", e.target.value)}
                        disabled={!modificable || guardando || !datos.curso}
                        required
                    >
                        <option value="">Selecciona un grup</option>
                        {datos.grupo && !grupos.includes(datos.grupo) && (
                            <option value={datos.grupo}>{datos.grupo}</option>
                        )}
                        {grupos.map(grupo => (
                            <option key={grupo} value={grupo}>{grupo}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label htmlFor="voluntari-rol" className="text-sm font-medium text-neutral-titulos">
                        Rol preferit
                    </label>
                    <select
                        id="voluntari-rol"
                        className={campo}
                        value={datos.tipo_voluntariado_id ?? ""}
                        onChange={e => actualizar("tipo_voluntariado_id", e.target.value)}
                        disabled={!nueva || guardando}
                        required={nueva}
                    >
                        <option value="">Selecciona un rol</option>
                        {solicitud?.tipo_voluntariado_id &&
                            !tipos.some(tipo => tipo.id === solicitud.tipo_voluntariado_id) && (
                                <option value={solicitud.tipo_voluntariado_id}>
                                    {solicitud.tipo_voluntariado ?? "Rol assignat"}
                                </option>
                            )}
                        {tipos.map(tipo => (
                            <option key={tipo.id} value={tipo.id}>{tipo.nombre}</option>
                        ))}
                    </select>
                </div>

                <div className="md:col-span-2">
                    <label
                        htmlFor="voluntari-descripcio"
                        className="text-sm font-medium text-neutral-titulos"
                    >
                        Per què vols ser voluntari?
                    </label>
                    <textarea
                        id="voluntari-descripcio"
                        rows={4}
                        className={`${campo} resize-y`}
                        value={datos.descripcion}
                        onChange={e => actualizar("descripcion", e.target.value)}
                        disabled={!nueva || guardando}
                        maxLength={2000}
                    />
                </div>

                {nueva && (
                    <label className="flex items-start gap-3 text-sm leading-6 text-neutral md:col-span-2">
                        <input
                            type="checkbox"
                            checked={consentimiento}
                            onChange={e => setConsentimiento(e.target.checked)}
                            className="mt-1 h-4 w-4 accent-primary"
                            required
                        />
                        Accepto que l'organització es posi en contacte amb mi per gestionar aquesta sol·licitud.
                    </label>
                )}

                <div className="flex flex-wrap gap-3 md:col-span-2">
                    {aprobada && !editando && (
                        <button
                            type="button"
                            onClick={() => setEditando(true)}
                            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white"
                        >
                            Modificar dades de contacte i curs
                        </button>
                    )}
                    {editableAprobada && (
                        <button
                            type="button"
                            onClick={() => {
                                setDatos(solicitud!);
                                setEditando(false);
                                setError("");
                            }}
                            className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-neutral-titulos"
                        >
                            Cancel·lar
                        </button>
                    )}
                    {modificable && (
                        <button
                            type="submit"
                            disabled={guardando || (nueva && (!cursos.length || !tipos.length))}
                            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                        >
                            {guardando
                                ? "Desant..."
                                : nueva
                                    ? "Enviar sol·licitud"
                                    : "Desar canvis"}
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}