import type {
    ActualizacionPanel,
    EdicionPanel,
    TorneoPanel,
} from "./ResumenPanel";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    torneo: TorneoPanel;
    ediciones: EdicionPanel[];
    actualizaciones: ActualizacionPanel[];
    puedeCrearEdicion: boolean;
    puedeEditarTorneo: boolean;
};

// ============================================================
// ESTADOS
// ============================================================

function normalizarEstadoEdicion(
    valor: string | null,
) {
    const estado =
        valor
            ?.trim()
            .toUpperCase() ?? "";

    if (
        estado === "ACTIVA" ||
        estado === "ACTIVO" ||
        estado === "ACTUAL"
    ) {
        return "ACTIVA";
    }

    if (
        estado === "FINALIZADA" ||
        estado === "FINALIZADO" ||
        estado === "FINALITZADA" ||
        estado === "FINALITZAT"
    ) {
        return "FINALIZADA";
    }

    if (
        estado === "BORRADOR" ||
        estado === "ESBORRANY" ||
        estado === "EN_PREPARACIO"
    ) {
        return "BORRADOR";
    }

    return "DESCONOCIDO";
}

function datosEstadoEdicion(
    valor: string | null,
) {
    switch (
        normalizarEstadoEdicion(
            valor,
        )
    ) {
        case "ACTIVA":
            return {
                nombre:
                    "Activa",

                clase:
                    "border-secondary/30 bg-secondary/15 text-secondary",
            };

        case "FINALIZADA":
            return {
                nombre:
                    "Finalitzada",

                clase:
                    "border-border bg-background/70 text-neutral",
            };

        case "BORRADOR":
            return {
                nombre:
                    "En preparació",

                clase:
                    "border-primary/30 bg-primary/15 text-primary",
            };

        default:
            return {
                nombre:
                    "Sense estat",

                clase:
                    "border-border bg-background/70 text-neutral",
            };
    }
}

// ============================================================
// FECHAS
// ============================================================

function fecha(
    valor: string | null,
) {
    if (
        !valor ||
        !Number.isFinite(
            Date.parse(
                valor,
            ),
        )
    ) {
        return "Pendent";
    }

    return new Date(
        valor,
    ).toLocaleDateString(
        "ca-ES",
        {
            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric",

            timeZone:
                "Europe/Madrid",
        },
    );
}

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

export default function TorneoSeleccionadoPanel({
    torneo,
    ediciones,
    actualizaciones,
    puedeCrearEdicion,
    puedeEditarTorneo,
}: Props) {
    const edicionesActivas =
        ediciones.filter(
            edicion =>
                normalizarEstadoEdicion(
                    edicion.estado,
                ) ===
                "ACTIVA",
        ).length;

    const edicionesFinalizadas =
        ediciones.filter(
            edicion =>
                normalizarEstadoEdicion(
                    edicion.estado,
                ) ===
                "FINALIZADA",
        ).length;

    const edicionesRecientes =
        [...ediciones]
            .sort(
                (
                    a,
                    b,
                ) =>
                    Date.parse(
                        b.fecha_inicio ??
                            "",
                    ) -
                    Date.parse(
                        a.fecha_inicio ??
                            "",
                    ),
            )
            .slice(
                0,
                3,
            );

    const actualizacionesTorneo =
        actualizaciones
            .filter(
                elemento =>
                    elemento.torneo_id ===
                    torneo.id,
            )
            .slice(
                0,
                5,
            );

    return (
        <div className="w-full min-w-0 space-y-6 p-4 md:p-6">

            {/* =================================================
                CABECERA
            ================================================= */}

            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                <div className="min-w-0">
                    <h1 className="text-3xl font-bold text-neutral-titulos max-md:text-2xl">
                        Gestió del torneig
                    </h1>

                    <p className="mt-1 text-sm text-neutral">
                        Consulta l'estat general del torneig i accedeix a les seves edicions.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">

                    {puedeEditarTorneo && (
                        <a href={`/panell/info/torneig?accio=editar&torneoID=${encodeURIComponent(torneo.id)}`} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                <path d="M200-200h57l391-391-57-57-391 391zm-80 80v-170l528-527q12-12 27-18t30-6q16 0 31 6t27 18l54 54q12 12 18 27t6 30q0 16-6 31t-18 27L290-120zm640-584-56-56zm-141 85-28-29 57 57z" />
                            </svg>

                            Editar torneig
                        </a>
                    )}

                    {puedeCrearEdicion && (
                        <a href={`/panell/info/edicio?accio=crear&torneoID=${encodeURIComponent(torneo.id)}`} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80z" />
                            </svg>

                            Nova edició
                        </a>
                    )}

                </div>

            </header>

            {/* =================================================
                HERO DEL TORNEO
            ================================================= */}

            <section className="relative min-h-80 overflow-hidden rounded-2xl border border-border bg-card">

                {torneo.banner ? (
                    <img src={torneo.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                    <div className="absolute inset-0 bg-primary" />
                )}

                <div className="absolute inset-0 bg-linear-to-r from-black/85 via-black/60 to-black/25" />

                <div className="relative z-10 flex min-h-80 flex-col justify-end p-6 text-white sm:p-8">

                    <div className="flex flex-wrap items-center gap-2">

                        {torneo.deporte && (
                            <span className="rounded-full border border-white/25 bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                                {torneo.deporte}
                            </span>
                        )}

                        <span className="rounded-full border border-white/25 bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                            {torneo.activo === true
                                ? "Torneig actiu"
                                : torneo.activo === false
                                  ? "Torneig inactiu"
                                  : "Estat pendent"}
                        </span>

                    </div>

                    <h2 className="mt-4 max-w-3xl text-3xl font-bold sm:text-4xl">
                        {torneo.nombre || "Torneig sense nom"}
                    </h2>

                    <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80 sm:text-base">
                        {torneo.descripcion?.trim() || "Aquest torneig encara no té una descripció definida."}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-3">

                        <a href={`/panell/edicions?torneoID=${encodeURIComponent(torneo.id)}`} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90">
                            Gestionar edicions
                        </a>

                        <a href={`/panell/info/torneig?accio=ver&torneoID=${encodeURIComponent(torneo.id)}`} className="rounded-lg border border-white/30 bg-black/20 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">
                            Informació del torneig
                        </a>

                    </div>

                </div>

            </section>

            {/* =================================================
                RESUMEN
            ================================================= */}

            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">

                <article className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm font-medium text-neutral">Edicions</p>
                    <p className="mt-2 text-3xl font-bold text-neutral-titulos">{ediciones.length}</p>
                    <p className="mt-1 text-xs text-neutral">Total registrades</p>
                </article>

                <article className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm font-medium text-neutral">Actives</p>
                    <p className="mt-2 text-3xl font-bold text-secondary">{edicionesActivas}</p>
                    <p className="mt-1 text-xs text-neutral">Edicions en curs</p>
                </article>

                <article className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm font-medium text-neutral">Finalitzades</p>
                    <p className="mt-2 text-3xl font-bold text-neutral-titulos">{edicionesFinalizadas}</p>
                    <p className="mt-1 text-xs text-neutral">Històric completat</p>
                </article>

                <article className="rounded-2xl border border-border bg-card p-5">
                    <p className="text-sm font-medium text-neutral">Darrera actualització</p>
                    <p className="mt-2 text-lg font-bold text-neutral-titulos">
                        {torneo.updated_at && Number.isFinite(Date.parse(torneo.updated_at))
                            ? fechaHora(torneo.updated_at)
                            : "Sense dades"}
                    </p>
                    <p className="mt-1 text-xs text-neutral">Canvi més recent</p>
                </article>

            </section>

            {/* =================================================
                EDICIONES
            ================================================= */}

            <section>

                <div className="mb-4 flex items-center justify-between gap-3">

                    <div>
                        <h2 className="text-xl font-bold text-neutral-titulos">
                            Edicions del torneig
                        </h2>

                        <p className="mt-1 text-sm text-neutral">
                            Accedeix ràpidament a les edicions més recents.
                        </p>
                    </div>

                    <a href={`/panell/edicions?torneoID=${encodeURIComponent(torneo.id)}`} className="shrink-0 text-sm font-semibold text-secondary hover:underline">
                        Veure totes
                    </a>

                </div>

                {edicionesRecientes.length === 0 ? (

                    <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                        <p className="font-semibold text-neutral-titulos">
                            Aquest torneig encara no té edicions
                        </p>

                        <p className="mt-1 text-sm text-neutral">
                            Crea una edició per començar a gestionar la competició.
                        </p>
                    </div>

                ) : (

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">

                        {edicionesRecientes.map(
                            edicion => {
                                const estado =
                                    datosEstadoEdicion(
                                        edicion.estado,
                                    );

                                return (
                                    <a key={edicion.id} href={`/panell?torneoID=${encodeURIComponent(torneo.id)}&edicionID=${encodeURIComponent(edicion.id)}`} className="group rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-secondary">

                                        <div className="flex items-start justify-between gap-3">

                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${estado.clase}`}>
                                                {estado.nombre}
                                            </span>

                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-neutral transition group-hover:translate-x-1 group-hover:fill-secondary" viewBox="0 -960 960 960" aria-hidden="true">
                                                <path d="m504-480-184-184 56-56 240 240-240 240-56-56z" />
                                            </svg>

                                        </div>

                                        <h3 className="mt-5 text-lg font-semibold text-neutral-titulos">
                                            {edicion.nombre || "Edició sense nom"}
                                        </h3>

                                        <p className="mt-2 text-sm text-neutral">
                                            {fecha(edicion.fecha_inicio)}
                                        </p>

                                        <p className="mt-1 text-xs text-neutral">
                                            {edicion.sede?.trim() || "Seu pendent"}
                                        </p>

                                    </a>
                                );
                            },
                        )}

                    </div>

                )}

            </section>

            {/* =================================================
                ACTIVIDAD
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card p-5">

                <h2 className="text-lg font-bold text-neutral-titulos">
                    Activitat recent
                </h2>

                <p className="mt-1 text-sm text-neutral">
                    Últims canvis registrats dins aquest torneig.
                </p>

                {actualizacionesTorneo.length === 0 ? (
                    <p className="mt-5 text-sm text-neutral">
                        Encara no hi ha activitat registrada.
                    </p>
                ) : (
                    <div className="mt-5 space-y-4">

                        {actualizacionesTorneo.map(
                            actividad => (
                                <div key={actividad.id} className="flex items-start gap-3">

                                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />

                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-neutral-titulos">
                                            {actividad.nombre || "Sense nom"}
                                        </p>

                                        <p className="text-xs text-neutral">
                                            {actividad.tipo === "torneo" ? "Torneig actualitzat" : "Edició actualitzada"}
                                        </p>

                                        <p className="mt-1 text-xs text-neutral">
                                            {fechaHora(actividad.fecha)}
                                        </p>
                                    </div>

                                </div>
                            ),
                        )}

                    </div>
                )}

            </section>

        </div>
    );
}