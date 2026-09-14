import { useEffect, useState } from "react";
import EstadisticasPanel from "./EstadisticasPanel";
import AccesosPanel from "./AccesosPanel";
import TorneosPanel from "./TorneosPanel";
import EdicionesPanel from "./EdicionesPanel";

export type TorneoPanel = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    descripcion: string | null;
    logo: string | null;
    banner: string | null;
    activo: boolean | null;
    created_at: string | null;
    updated_at: string | null;
};

export type TarjetaTorneoPanel = TorneoPanel & {
    total_ediciones: number | null;
    puedeEditar: boolean;
    enlace: string;
    enlace_info: string;
};

export type EdicionPanel = {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string | null;
    sede: string | null;
    created_at: string | null;
    updated_at: string | null;
    torneo_nombre?: string | null;
};

export type AccesoPanel = {
    id: string;
    nombre: string;
    enlace: string;
    seccion: string;
    accion: string;
    descripcion: string;
};

export type EstadisticasPanelDatos = {
    torneos: number;
    torneosActivos: number;
    torneosInactivos: number;
    torneosSinEstado: number;
    ediciones: number | null;
    edicionesBorrador: number | null;
    edicionesActivas: number | null;
    edicionesFinalizadas: number | null;
    edicionesSinEstado: number | null;
    edicionesOtrosEstados: number | null;
};

type DatosPanel = {
    modo: "general" | "torneo";
    torneoSeleccionado: TorneoPanel | null;
    edicionSeleccionada: EdicionPanel | null;
    permisos: {
        verTorneos: boolean;
        verEdiciones: boolean;
        crearTorneo: boolean;
        editarTorneo: boolean;
    };
    estadisticas: EstadisticasPanelDatos;
    accesos: AccesoPanel[];
    torneos: TarjetaTorneoPanel[];
    ediciones: EdicionPanel[];
    actualizaciones: {
        id: string;
        tipo: "torneo" | "edicion";
        nombre: string | null;
        torneo_id: string | null;
        torneo_nombre: string | null;
        fecha: string;
    }[];
};

export default function ResumenPanel({
    torneoID,
    edicionID
}: {
    torneoID: string | null;
    edicionID: string | null;
}) {
    const [datos, setDatos] = useState<DatosPanel | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        const controlador = new AbortController();

        setCargando(true);
        setError("");
        setDatos(null);

        async function cargarResumen() {
            try {
                const parametros = new URLSearchParams();

                if (torneoID) {
                    parametros.set("torneoID", torneoID);
                }

                if (torneoID && edicionID) {
                    parametros.set("edicionID", edicionID);
                }

                const respuesta = await fetch(
                    `/api/panell${
                        parametros.size
                            ? `?${parametros.toString()}`
                            : ""
                    }`,
                    {
                        signal: controlador.signal,
                        credentials: "same-origin",
                        cache: "no-store"
                    }
                );

                const json = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(
                        json.mensaje ||
                        "No s'ha pogut carregar el panell."
                    );
                }

                if (!json.data) {
                    throw new Error(
                        "La resposta del servidor no és vàlida."
                    );
                }

                if (!controlador.signal.aborted) {
                    setDatos(json.data);
                }
            } catch (err) {
                if (!controlador.signal.aborted) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "No s'ha pogut carregar el panell."
                    );
                }
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        cargarResumen();

        return () => controlador.abort();
    }, [torneoID, edicionID, intento]);

    if (cargando) {
        return (
            <div
                className="w-full p-4 md:p-6 space-y-6"
                role="status"
                aria-live="polite"
                aria-busy="true"
            >
                <div>
                    <h1 className="text-3xl max-md:text-2xl font-bold text-neutral-titulos">
                        Panell d'administració
                    </h1>

                    <p className="mt-1 text-neutral">
                        Carregant el resum...
                    </p>
                </div>

                <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map(elemento => (
                        <div
                            key={elemento}
                            className="h-28 rounded-lg bg-card border border-border animate-pulse"
                            aria-hidden="true"
                        />
                    ))}
                </div>

                <div
                    className="h-64 rounded-lg bg-card border border-border animate-pulse"
                    aria-hidden="true"
                />
            </div>
        );
    }

    if (error || !datos) {
        return (
            <div className="w-full p-4 md:p-6">
                <h1 className="text-3xl max-md:text-2xl font-bold text-neutral-titulos">
                    Panell d'administració
                </h1>

                <div className="mt-6 rounded-lg border border-error bg-error-container/20 p-4">
                    <p className="text-error" role="alert">
                        {error || "No s'ha pogut carregar el panell."}
                    </p>

                    <button
                        type="button"
                        onClick={() => setIntento(prev => prev + 1)}
                        className="mt-4 rounded-lg border border-error px-4 py-2 text-error hover:bg-error-container/40"
                    >
                        Tornar-ho a intentar
                    </button>
                </div>
            </div>
        );
    }

    const torneo = datos.torneoSeleccionado;
    const estadisticas = datos.estadisticas;

    const avisos: string[] = [];

    if (
        datos.modo === "general" &&
        datos.permisos.verTorneos &&
        estadisticas.torneos === 0
    ) {
        avisos.push("No tens cap torneig accessible.");
    }

    if (torneo?.activo === false) {
        avisos.push("Aquest torneig està marcat com a inactiu.");
    }

    if (torneo && torneo.activo === null) {
        avisos.push("Aquest torneig encara no té definit l'estat.");
    }

    if (
        datos.modo === "general" &&
        estadisticas.torneosSinEstado > 0
    ) {
        avisos.push(
            `${estadisticas.torneosSinEstado} tornejos tenen l'estat pendent de definir.`
        );
    }

    if (
        datos.permisos.verEdiciones &&
        estadisticas.ediciones === 0 &&
        estadisticas.torneos > 0
    ) {
        avisos.push(
            torneo
                ? "Aquest torneig encara no té edicions."
                : "No hi ha edicions accessibles als teus tornejos."
        );
    }

    if ((estadisticas.edicionesSinEstado ?? 0) > 0) {
        avisos.push(
            `${estadisticas.edicionesSinEstado} edicions no tenen estat.`
        );
    }

    if ((estadisticas.edicionesOtrosEstados ?? 0) > 0) {
        avisos.push(
            `${estadisticas.edicionesOtrosEstados} edicions tenen un estat diferent dels previstos.`
        );
    }

    return (
        <div className="w-full min-w-0 p-4 md:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="text-3xl max-md:text-2xl font-bold text-neutral-titulos break-words">
                        {torneo
                            ? torneo.nombre || "Torneig sense nom"
                            : "Panell d'administració"}
                    </h1>

                    <p className="mt-1 text-neutral">
                        {torneo
                            ? "Consulta el resum del torneig i gestiona les seves edicions."
                            : "Gestiona els teus tornejos, consulta les actualitzacions recents i accedeix a les funcions principals de la plataforma."}
                    </p>

                    {datos.edicionSeleccionada && (
                        <p className="mt-2 text-sm text-neutral">
                            Edició seleccionada:{" "}
                            <span className="font-semibold text-neutral-titulos">
                                {datos.edicionSeleccionada.nombre ||
                                    "Edició sense nom"}
                            </span>
                            . Les estadístiques mostren tot el torneig.
                        </p>
                    )}
                </div>

                {torneo ? (
                    <a
                        href={`/panell/info/torneig?accio=${
                            datos.permisos.editarTorneo ? "editar" : "ver"
                        }&torneoID=${encodeURIComponent(torneo.id)}`}
                        className="shrink-0 w-max rounded-lg bg-primary px-4 py-2 text-secondary-variant hover:bg-primary/80"
                    >
                        {datos.permisos.editarTorneo
                            ? "Editar torneig"
                            : "Veure informació"}
                    </a>
                ) : datos.permisos.crearTorneo ? (
                    <a
                        href="/panell/info/torneig?accio=crear"
                        className="shrink-0 w-max rounded-lg bg-primary px-4 py-2 text-secondary-variant hover:bg-primary/80"
                    >
                        + Crear torneig
                    </a>
                ) : null}
            </div>

            {torneo && (
                <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-4">
                    {torneo.logo && (
                        <img
                            key={torneo.logo}
                            src={torneo.logo}
                            alt={`Logo de ${torneo.nombre || "torneig"}`}
                            className="h-16 w-16 shrink-0 rounded-lg bg-background/40 object-contain p-1"
                            onError={e => {
                                e.currentTarget.style.display = "none";
                            }}
                        />
                    )}

                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-neutral-titulos">
                                {torneo.deporte || "Esport no definit"}
                            </span>

                            <span className="rounded bg-primary/15 px-2 py-1 text-xs text-neutral">
                                {torneo.activo === true
                                    ? "Actiu"
                                    : torneo.activo === false
                                      ? "Inactiu"
                                      : "Sense estat"}
                            </span>
                        </div>

                        <p className="mt-2 text-sm text-neutral whitespace-pre-line break-words">
                            {torneo.descripcion?.trim() ||
                                "Aquest torneig encara no té descripció."}
                        </p>
                    </div>
                </div>
            )}

            <EstadisticasPanel
                modo={datos.modo}
                estadisticas={datos.estadisticas}
                verTorneos={datos.permisos.verTorneos}
                verEdiciones={datos.permisos.verEdiciones}
            />

            <AccesosPanel accesos={datos.accesos} />

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
                <div className="min-w-0 space-y-6">
                    {datos.modo === "general" &&
                        datos.permisos.verTorneos && (
                            <TorneosPanel torneos={datos.torneos} />
                        )}

                    {datos.permisos.verEdiciones && (
                        <EdicionesPanel
                            ediciones={datos.ediciones}
                            torneoSeleccionado={Boolean(torneo)}
                            edicionID={datos.edicionSeleccionada?.id ?? null}
                        />
                    )}
                </div>

                <aside className="min-w-0 space-y-6">
                    <section className="rounded-lg border border-border bg-card p-4">
                        <h2 className="font-semibold text-neutral-titulos">
                            Avisos del resum
                        </h2>

                        {avisos.length > 0 ? (
                            <ul className="mt-3 space-y-3">
                                {avisos.map(aviso => (
                                    <li
                                        key={aviso}
                                        className="flex items-start gap-2 text-sm text-neutral"
                                    >
                                        <span
                                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary"
                                            aria-hidden="true"
                                        />
                                        <span>{aviso}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-3 text-sm text-neutral">
                                No hi ha avisos sobre les dades d'aquest resum.
                            </p>
                        )}
                    </section>

                    <section className="rounded-lg border border-border bg-card p-4">
                        <h2 className="font-semibold text-neutral-titulos">
                            Actualitzacions recents
                        </h2>

                        <p className="mt-1 text-xs text-neutral">
                            Segons la darrera data d'actualització registrada.
                        </p>

                        {datos.actualizaciones.length === 0 ? (
                            <p className="mt-4 text-sm text-neutral">
                                Encara no hi ha actualitzacions registrades.
                            </p>
                        ) : (
                            <ul className="mt-4 space-y-4">
                                {datos.actualizaciones.map(elemento => (
                                    <li
                                        key={elemento.id}
                                        className="flex items-start gap-3"
                                    >
                                        <span
                                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary"
                                            aria-hidden="true"
                                        />

                                        <div className="min-w-0">
                                            <p className="text-xs text-neutral">
                                                {elemento.tipo === "torneo"
                                                    ? "Torneig"
                                                    : "Edició"}
                                            </p>

                                            <p className="text-sm font-semibold text-neutral-titulos break-words">
                                                {elemento.nombre || "Sense nom"}
                                            </p>

                                            {elemento.tipo === "edicion" && (
                                                <p className="text-xs text-neutral break-words">
                                                    {elemento.torneo_nombre ||
                                                        "Torneig sense nom"}
                                                </p>
                                            )}

                                            <time
                                                dateTime={elemento.fecha}
                                                className="mt-1 block text-xs text-neutral"
                                            >
                                                {new Date(
                                                    elemento.fecha
                                                ).toLocaleString("ca-ES", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit"
                                                })}
                                            </time>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    );
}