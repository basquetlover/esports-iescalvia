import {
    useEffect,
    useState,
} from "react";

import EstadisticasPanel from "./EstadisticasPanel";
import AccesosPanel from "./AccesosPanel";
import TorneosPanel from "./TorneosPanel";
import EdicionesPanel from "./EdicionesPanel";

import TorneoSeleccionadoPanel from "./TorneoSeleccionadoPanel";
import EdicionSeleccionadaPanel from "./EdicionSeleccionadaPanel";

// ============================================================
// TIPOS
// ============================================================

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

export type TarjetaTorneoPanel =
    TorneoPanel & {
        total_ediciones:
            number | null;

        puedeEditar:
            boolean;

        enlace:
            string;

        enlace_info:
            string;
    };

export type EdicionPanel = {
    id: string;

    torneo_id:
        string | null;

    nombre:
        string | null;

    fecha_inicio:
        string | null;

    fecha_fin:
        string | null;

    estado:
        string | null;

    sede:
        string | null;

    created_at:
        string | null;

    updated_at:
        string | null;

    torneo_nombre?:
        string | null;
};

export type AccesoPanel = {
    id:
        string;

    nombre:
        string;

    enlace:
        string;

    seccion:
        string;

    accion:
        string;

    descripcion:
        string;
};

export type EstadisticasPanelDatos = {
    torneos:
        number;

    torneosActivos:
        number;

    torneosInactivos:
        number;

    torneosSinEstado:
        number;

    ediciones:
        number | null;

    edicionesBorrador:
        number | null;

    edicionesActivas:
        number | null;

    edicionesFinalizadas:
        number | null;

    edicionesSinEstado:
        number | null;

    edicionesOtrosEstados:
        number | null;
};

export type ActualizacionPanel = {
    id:
        string;

    tipo:
        | "torneo"
        | "edicion";

    nombre:
        string | null;

    torneo_id:
        string | null;

    torneo_nombre:
        string | null;

    fecha:
        string;
};

export type ActividadEdicionPanel = {
    id:
        string;

    titulo:
        string;

    descripcion:
        string;

    fecha:
        string;
};

export type ResumenEdicionPanel = {
    equiposInscritos:
        number | null;

    voluntarios:
        number | null;

    participantes:
        number | null;

    partidos:
        number | null;

    formulariosCompletados:
        number | null;

    formulariosError:
        number | null;

    actividad:
        ActividadEdicionPanel[];
};

type DatosPanel = {
    modo:
        | "general"
        | "torneo";

    torneoSeleccionado:
        TorneoPanel | null;

    edicionSeleccionada:
        EdicionPanel | null;

    resumenEdicion:
        ResumenEdicionPanel | null;

    permisos: {
        verTorneos:
            boolean;

        verEdiciones:
            boolean;

        crearTorneo:
            boolean;

        editarTorneo:
            boolean;

        crearEdicion:
            boolean;

        editarEdicion:
            boolean;
    };

    estadisticas:
        EstadisticasPanelDatos;

    accesos:
        AccesoPanel[];

    torneos:
        TarjetaTorneoPanel[];

    ediciones:
        EdicionPanel[];

    actualizaciones:
        ActualizacionPanel[];
};

// ============================================================
// FECHA
// ============================================================

function fechaHora(
    valor: string,
) {
    return new Date(
        valor,
    ).toLocaleString(
        "ca-ES",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit",

            timeZone:
                "Europe/Madrid",
        },
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function ResumenPanel({
    torneoID,
    edicionID,
}: {
    torneoID:
        string | null;

    edicionID:
        string | null;
}) {
    const [
        datos,
        setDatos,
    ] =
        useState<
            DatosPanel | null
        >(
            null,
        );

    const [
        cargando,
        setCargando,
    ] =
        useState(
            true,
        );

    const [
        error,
        setError,
    ] =
        useState(
            "",
        );

    const [
        intento,
        setIntento,
    ] =
        useState(
            0,
        );

    // ========================================================
    // CARGA
    // ========================================================

    useEffect(
        () => {
            const controlador =
                new AbortController();

            setCargando(
                true,
            );

            setError(
                "",
            );

            setDatos(
                null,
            );

            async function cargarResumen() {
                try {
                    const parametros =
                        new URLSearchParams();

                    if (
                        torneoID
                    ) {
                        parametros.set(
                            "torneoID",
                            torneoID,
                        );
                    }

                    if (
                        torneoID &&
                        edicionID
                    ) {
                        parametros.set(
                            "edicionID",
                            edicionID,
                        );
                    }

                    const respuesta =
                        await fetch(
                            `/api/panell${parametros.size ? `?${parametros.toString()}` : ""}`,
                            {
                                signal:
                                    controlador.signal,

                                credentials:
                                    "same-origin",

                                cache:
                                    "no-store",
                            },
                        );

                    const json =
                        await respuesta
                            .json()
                            .catch(
                                () =>
                                    null,
                            );

                    if (
                        !respuesta.ok
                    ) {
                        throw new Error(
                            json?.mensaje ??
                                "No s'ha pogut carregar el panell.",
                        );
                    }

                    if (
                        !json?.data
                    ) {
                        throw new Error(
                            "La resposta del servidor no és vàlida.",
                        );
                    }

                    if (
                        !controlador
                            .signal
                            .aborted
                    ) {
                        setDatos(
                            json.data,
                        );
                    }
                } catch (
                    err
                ) {
                    if (
                        controlador
                            .signal
                            .aborted
                    ) {
                        return;
                    }

                    setError(
                        err instanceof
                            Error
                            ? err.message
                            : "No s'ha pogut carregar el panell.",
                    );
                } finally {
                    if (
                        !controlador
                            .signal
                            .aborted
                    ) {
                        setCargando(
                            false,
                        );
                    }
                }
            }

            void cargarResumen();

            return () =>
                controlador.abort();
        },
        [
            torneoID,
            edicionID,
            intento,
        ],
    );

    // ========================================================
    // CARGANDO
    // ========================================================

    if (
        cargando
    ) {
        return (
            <div className="w-full space-y-6 p-4 md:p-6" role="status" aria-live="polite" aria-busy="true">

                <div>
                    <h1 className="text-3xl font-bold text-neutral-titulos max-md:text-2xl">
                        Panell d'administració
                    </h1>

                    <p className="mt-1 text-neutral">
                        Carregant el resum...
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    {[0, 1, 2, 3].map(
                        numero => (
                            <div key={numero} className="h-28 animate-pulse rounded-lg border border-border bg-card" />
                        ),
                    )}
                </div>

                <div className="h-64 animate-pulse rounded-lg border border-border bg-card" />

            </div>
        );
    }

    // ========================================================
    // ERROR
    // ========================================================

    if (
        error ||
        !datos
    ) {
        return (
            <div className="w-full p-4 md:p-6">

                <h1 className="text-3xl font-bold text-neutral-titulos max-md:text-2xl">
                    Panell d'administració
                </h1>

                <div className="mt-6 rounded-lg border border-error bg-error-container/20 p-4">

                    <p className="text-error">
                        {error || "No s'ha pogut carregar el panell."}
                    </p>

                    <button type="button" onClick={() => setIntento(valor => valor + 1)} className="mt-4 rounded-lg border border-error px-4 py-2 text-error hover:bg-error-container/40">
                        Tornar-ho a intentar
                    </button>

                </div>

            </div>
        );
    }

    // ========================================================
    // EDICIÓN
    // ========================================================

    if (
        datos.torneoSeleccionado &&
        datos.edicionSeleccionada
    ) {
        return (
            <EdicionSeleccionadaPanel
                torneo={datos.torneoSeleccionado}
                edicion={datos.edicionSeleccionada}
                resumen={datos.resumenEdicion ?? {
                    equiposInscritos: null,
                    voluntarios: null,
                    participantes: null,
                    partidos: null,
                    formulariosCompletados: null,
                    formulariosError: null,
                    actividad: [],
                }}
                puedeEditar={datos.permisos.editarEdicion}
            />
        );
    }

    // ========================================================
    // TORNEO
    // ========================================================

    if (
        datos.torneoSeleccionado
    ) {
        return (
            <TorneoSeleccionadoPanel
                torneo={
                    datos.torneoSeleccionado
                }
                ediciones={
                    datos.ediciones
                }
                actualizaciones={
                    datos.actualizaciones
                }
                puedeCrearEdicion={
                    datos.permisos.crearEdicion
                }
                puedeEditarTorneo={
                    datos.permisos.editarTorneo
                }
            />
        );
    }

    // ========================================================
    // PANEL GENERAL
    // ========================================================

    const estadisticas =
        datos.estadisticas;

    const avisos:
        string[] = [];

    if (
        datos.permisos
            .verTorneos &&
        estadisticas
            .torneos ===
            0
    ) {
        avisos.push(
            "No tens cap torneig accessible.",
        );
    }

    if (
        estadisticas
            .torneosSinEstado >
        0
    ) {
        avisos.push(
            `${estadisticas.torneosSinEstado} tornejos tenen l'estat pendent de definir.`,
        );
    }

    if (
        datos.permisos
            .verEdiciones &&
        estadisticas
            .ediciones ===
            0 &&
        estadisticas
            .torneos >
            0
    ) {
        avisos.push(
            "No hi ha edicions accessibles als teus tornejos.",
        );
    }

    if (
        (
            estadisticas
                .edicionesSinEstado ??
            0
        ) >
        0
    ) {
        avisos.push(
            `${estadisticas.edicionesSinEstado} edicions no tenen estat.`,
        );
    }

    if (
        (
            estadisticas
                .edicionesOtrosEstados ??
            0
        ) >
        0
    ) {
        avisos.push(
            `${estadisticas.edicionesOtrosEstados} edicions tenen un estat diferent dels previstos.`,
        );
    }

    return (
        <div className="w-full min-w-0 space-y-6 p-4 md:p-6">

            {/* CABECERA */}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                <div className="min-w-0">

                    <h1 className="text-3xl font-bold text-neutral-titulos max-md:text-2xl">
                        Panell d'administració
                    </h1>

                    <p className="mt-1 text-neutral">
                        Gestiona els teus tornejos, consulta les actualitzacions recents i accedeix a les funcions principals de la plataforma.
                    </p>

                </div>

                {datos.permisos.crearTorneo && (
                    <a href="/panell/info/torneig?accio=crear" className="w-max shrink-0 rounded-lg bg-primary px-4 py-2 text-white transition hover:bg-primary/80">
                        + Crear torneig
                    </a>
                )}

            </div>

            <EstadisticasPanel
                modo="general"
                estadisticas={
                    datos.estadisticas
                }
                verTorneos={
                    datos.permisos.verTorneos
                }
                verEdiciones={
                    datos.permisos.verEdiciones
                }
            />

            <AccesosPanel
                accesos={
                    datos.accesos
                }
            />

            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">

                <div className="min-w-0 space-y-6">

                    {datos.permisos.verTorneos && (
                        <TorneosPanel
                            torneos={
                                datos.torneos
                            }
                        />
                    )}

                    {datos.permisos.verEdiciones && (
                        <EdicionesPanel
                            ediciones={
                                datos.ediciones
                            }
                            torneoSeleccionado={
                                false
                            }
                            edicionID={
                                null
                            }
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

                                {avisos.map(
                                    aviso => (
                                        <li key={aviso} className="flex items-start gap-2 text-sm text-neutral">
                                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" />
                                            <span>{aviso}</span>
                                        </li>
                                    ),
                                )}

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

                        {datos.actualizaciones.length === 0 ? (
                            <p className="mt-4 text-sm text-neutral">
                                Encara no hi ha actualitzacions registrades.
                            </p>
                        ) : (
                            <ul className="mt-4 space-y-4">

                                {datos.actualizaciones.map(
                                    elemento => (
                                        <li key={elemento.id} className="flex items-start gap-3">

                                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-secondary" />

                                            <div className="min-w-0">

                                                <p className="text-xs text-neutral">
                                                    {elemento.tipo === "torneo" ? "Torneig" : "Edició"}
                                                </p>

                                                <p className="text-sm font-semibold text-neutral-titulos">
                                                    {elemento.nombre || "Sense nom"}
                                                </p>

                                                <time dateTime={elemento.fecha} className="mt-1 block text-xs text-neutral">
                                                    {fechaHora(elemento.fecha)}
                                                </time>

                                            </div>

                                        </li>
                                    ),
                                )}

                            </ul>
                        )}

                    </section>

                </aside>

            </div>

        </div>
    );
}