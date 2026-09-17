import type { EdicionPanel, TorneoPanel } from "./ResumenPanel";

type Actualizacion = {
    id: string;
    tipo: "torneo" | "edicion";
    nombre: string | null;
    torneo_id: string | null;
    torneo_nombre: string | null;
    fecha: string;
};

type Props = {
    torneo: TorneoPanel;
    edicion: EdicionPanel;
    ediciones: EdicionPanel[];
    actualizaciones: Actualizacion[];
    puedeCrear: boolean;
    puedeEditar: boolean;
};

function normalizarEstado(valor: string | null) {
    const estado = valor?.trim().toLowerCase() ?? "";

    if (["activa", "activo", "actual"].includes(estado)) return "activa";
    if (["finalizada", "finalitzat", "finalitzada", "finalizado"].includes(estado)) return "finalizada";
    if (["borrador", "esborrany", "en_preparacio", "en preparació"].includes(estado)) return "borrador";

    return "desconocido";
}

function datosEstado(valor: string | null) {
    switch (normalizarEstado(valor)) {
        case "activa":
            return {
                nombre: "Activa",
                clase: "bg-secondary/15 text-secondary border-secondary/30",
                icono: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-80-240 240-160-240-160v320Z",
            };

        case "finalizada":
            return {
                nombre: "Finalitzada",
                clase: "bg-muted/15 text-neutral border-border",
                icono: "m382-240-170-170 56-57 114 114 310-310 57 57-367 366ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q68 0 130 21t113 59l-58 58q-40-29-87-43.5T480-800q-134 0-227 93t-93 227q0 134 93 227t227 93q134 0 227-93t93-227q0-24-3-46.5t-10-44.5l65-65q14 37 21 76t7 80q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
            };

        case "borrador":
            return {
                nombre: "En preparació",
                clase: "bg-primary/15 text-primary border-primary/30",
                icono: "M160-200v-80h400v80H160Zm0-160v-80h280v80H160Zm0-160v-80h400v80H160Zm480 320v-120l184-184 120 120-184 184H640Z",
            };

        default:
            return {
                nombre: "Sense estat",
                clase: "bg-muted/15 text-neutral border-border",
                icono: "M440-240h80v-80h-80v80Zm40-640q-83 0-156 31.5T197-763q-54 54-85.5 127T80-480q0 83 31.5 156T197-197q54 54 127 85.5T480-80q83 0 156-31.5T763-197q54-54 85.5-127T880-480q0-83-31.5-156T763-763q-54-54-127-85.5T480-880Z",
            };
    }
}

function fecha(valor: string | null) {
    if (!valor || !Number.isFinite(Date.parse(valor))) return "Pendent";

    return new Date(valor).toLocaleDateString("ca-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function fechaHora(valor: string) {
    return new Date(valor).toLocaleString("ca-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export default function EdicionSeleccionadaPanel({
    torneo,
    edicion,
    ediciones,
    actualizaciones,
    puedeCrear,
    puedeEditar,
}: Props) {
    const estado = datosEstado(edicion.estado);
    const historial = ediciones.filter(item => item.id !== edicion.id);
    const actualizacionesEdicion = actualizaciones.filter(item => item.tipo === "edicion").slice(0, 6);

    return (
        <div className="w-full min-w-0 space-y-6 p-4 md:p-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-3xl font-bold text-neutral-titulos max-md:text-2xl">Gestió de l'edició</h1>
                    <p className="mt-1 text-sm text-neutral">Consulta i gestiona la informació principal de l'edició seleccionada.</p>
                </div>

                {puedeCrear && (
                    <a href={`/panell/info/edicio?accio=crear&torneoID=${encodeURIComponent(torneo.id)}`} className="inline-flex w-max shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                            <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                        </svg>
                        Crear nova edició
                    </a>
                )}
            </header>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <article className="relative min-h-64 overflow-hidden rounded-2xl border border-primary/20 bg-primary p-6 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="absolute -bottom-10 -right-6 h-48 w-48 fill-white/10" viewBox="0 -960 960 960" aria-hidden="true">
                        <path d="M280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Z" />
                    </svg>

                    <div className="relative z-10 flex h-full flex-col">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-sm text-white/80">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                    <path d="M480-80q-139-119-209.5-216T200-480q0-126 87-213t213-87 213 87 87 213q0 87-70.5 184T480-80Z" />
                                </svg>
                                <span>{torneo.deporte || "Esport no definit"}</span>
                            </div>

                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${estado.clase}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                    <path d={estado.icono} />
                                </svg>
                                {estado.nombre}
                            </span>
                        </div>

                        <h2 className="mt-5 max-w-2xl text-3xl font-bold md:text-4xl">{edicion.nombre || "Edició sense nom"}</h2>

                        <div className="mt-6 grid max-w-2xl grid-cols-1 gap-5 sm:grid-cols-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Inici</p>
                                <p className="mt-1 font-semibold">{fecha(edicion.fecha_inicio)}</p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Final</p>
                                <p className="mt-1 font-semibold">{fecha(edicion.fecha_fin)}</p>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Seu</p>
                                <p className="mt-1 font-semibold">{edicion.sede?.trim() || "Pendent"}</p>
                            </div>
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2 pt-8">
                            <a href={`/panell/info/edicio?accio=ver&torneoID=${encodeURIComponent(torneo.id)}&edicionID=${encodeURIComponent(edicion.id)}`} className="rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20">
                                Detalls
                            </a>

                            {puedeEditar && (
                                <a href={`/panell/info/edicio?accio=editar&torneoID=${encodeURIComponent(torneo.id)}&edicionID=${encodeURIComponent(edicion.id)}`} className="rounded-lg bg-background px-4 py-2 text-sm font-semibold text-primary hover:bg-card">
                                    Gestionar edició
                                </a>
                            )}
                        </div>
                    </div>
                </article>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <article className="rounded-2xl border border-border bg-card p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral">Edicions del torneig</p>
                        <p className="mt-2 text-4xl font-bold text-neutral-titulos">{ediciones.length}</p>
                        <p className="mt-2 text-sm text-neutral">Total d'edicions registrades</p>
                    </article>

                    <article className="rounded-2xl border border-border bg-card p-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral">Darrera actualització</p>
                        <p className="mt-2 text-lg font-bold text-neutral-titulos">{edicion.updated_at && Number.isFinite(Date.parse(edicion.updated_at)) ? fechaHora(edicion.updated_at) : "Sense dades"}</p>
                        <p className="mt-2 text-sm text-neutral">Últim canvi registrat a l'edició</p>
                    </article>
                </div>
            </section>

            <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-neutral-titulos">Historial d'edicions</h2>

                    <a href={`/panell/edicions?torneoID=${encodeURIComponent(torneo.id)}`} className="text-sm font-medium text-secondary hover:underline">
                        Veure totes
                    </a>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {historial.slice(0, 2).map(item => {
                        const itemEstado = datosEstado(item.estado);

                        return (
                            <a key={item.id} href={`/panell?torneoID=${encodeURIComponent(torneo.id)}&edicionID=${encodeURIComponent(item.id)}`} className="group rounded-2xl border border-border bg-card p-4 hover:border-secondary">
                                <div className="flex items-start justify-between gap-3">
                                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${itemEstado.clase}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                            <path d={itemEstado.icono} />
                                        </svg>
                                    </span>

                                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${itemEstado.clase}`}>{itemEstado.nombre}</span>
                                </div>

                                <h3 className="mt-4 font-semibold text-neutral-titulos group-hover:text-secondary">{item.nombre || "Edició sense nom"}</h3>
                                <p className="mt-1 text-xs text-neutral">{fecha(item.fecha_inicio)} · {item.sede?.trim() || "Seu pendent"}</p>
                            </a>
                        );
                    })}

                    {puedeCrear && (
                        <a href={`/panell/info/edicio?accio=crear&torneoID=${encodeURIComponent(torneo.id)}`} className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-5 text-center hover:border-secondary hover:bg-secondary/5">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/20">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-neutral" viewBox="0 -960 960 960" aria-hidden="true">
                                    <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                                </svg>
                            </span>

                            <p className="mt-3 font-semibold text-neutral-titulos">Planificar nova edició</p>
                            <p className="mt-1 text-xs text-neutral">Configura les dates i els paràmetres de la pròxima edició.</p>
                        </a>
                    )}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                    <div>
                        <h2 className="font-bold text-neutral-titulos">Canvis recents</h2>
                        <p className="mt-0.5 text-xs text-neutral">Últimes actualitzacions registrades al torneig.</p>
                    </div>
                </div>

                {actualizacionesEdicion.length === 0 ? (
                    <p className="p-5 text-sm text-neutral">Encara no hi ha canvis registrats per a les edicions.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-150 text-left text-sm">
                            <thead className="border-b border-border bg-background/40 text-xs uppercase text-neutral">
                                <tr>
                                    <th className="px-5 py-3 font-medium">Edició</th>
                                    <th className="px-5 py-3 font-medium">Acció</th>
                                    <th className="px-5 py-3 font-medium">Data</th>
                                    <th className="px-5 py-3 font-medium">Estat</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-border">
                                {actualizacionesEdicion.map(item => {
                                    const edicionActualizada = ediciones.find(elemento => `edicion-${elemento.id}` === item.id);
                                    const estadoActualizado = datosEstado(edicionActualizada?.estado ?? null);

                                    return (
                                        <tr key={item.id} className="hover:bg-background/30">
                                            <td className="px-5 py-3 font-medium text-neutral-titulos">{item.nombre || "Sense nom"}</td>
                                            <td className="px-5 py-3 text-neutral">Edició actualitzada</td>
                                            <td className="px-5 py-3 text-neutral">{fechaHora(item.fecha)}</td>
                                            <td className="px-5 py-3">
                                                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${estadoActualizado.clase}`}>
                                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                    {estadoActualizado.nombre}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}