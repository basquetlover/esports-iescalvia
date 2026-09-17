import type {
    EdicionPanel,
} from "./ResumenPanel";

type Props = {
    ediciones: EdicionPanel[];
    torneoSeleccionado: boolean;
    edicionID: string | null;
};

function normalizarEstado(
    valor: string | null,
) {
    const estado = valor?.trim().toUpperCase() ?? "";

    if (["ACTIVA", "ACTIVO", "ACTIU", "ACTUAL"].includes(estado)) {
        return "ACTIVA";
    }

    if (["FINALIZADA", "FINALIZADO", "FINALITZADA", "FINALITZAT"].includes(estado)) {
        return "FINALIZADA";
    }

    if (["BORRADOR", "ESBORRANY", "EN_PREPARACIO"].includes(estado)) {
        return "BORRADOR";
    }

    return "DESCONOCIDO";
}

function datosEstado(
    valor: string | null,
) {
    switch (normalizarEstado(valor)) {
        case "ACTIVA":
            return {
                nombre: "Activa",
                clase: "border-secondary/30 bg-secondary/15 text-secondary",
                icono: "M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-80-240 240-160-240-160v320Z",
            };

        case "FINALIZADA":
            return {
                nombre: "Finalitzada",
                clase: "border-border bg-muted/15 text-neutral",
                icono: "m382-240-170-170 56-57 114 114 310-310 57 57-367 366Z",
            };

        case "BORRADOR":
            return {
                nombre: "En preparació",
                clase: "border-primary/30 bg-primary/15 text-primary",
                icono: "M160-200v-80h400v80H160Zm0-160v-80h280v80H160Zm0-160v-80h400v80H160Zm480 320v-120l184-184 120 120-184 184H640Z",
            };

        default:
            return {
                nombre: valor?.trim() || "Sense estat",
                clase: "border-border bg-background text-neutral",
                icono: "M440-240h80v-80h-80v80Zm40-640q-83 0-156 31.5T197-763q-54 54-85.5 127T80-480q0 83 31.5 156T197-197q54 54 127 85.5T480-80q83 0 156-31.5T763-197q54-54 85.5-127T880-480q0-83-31.5-156T763-763q-54-54-127-85.5T480-880Z",
            };
    }
}

function formatearFecha(
    valor: string | null,
    pendiente: string,
) {
    if (!valor || !Number.isFinite(Date.parse(valor))) {
        return pendiente;
    }

    return new Date(valor).toLocaleDateString("ca-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Madrid",
    });
}

export default function EdicionesPanel({
    ediciones,
    torneoSeleccionado,
    edicionID,
}: Props) {
    const edicionesMostradas = torneoSeleccionado
        ? ediciones
        : ediciones.slice(0, 5);

    return (
        <section>
            <div className="mb-3">
                <h2 className="text-xl font-bold text-neutral-titulos">
                    {torneoSeleccionado ? "Edicions del torneig" : "Edicions recents"}
                </h2>

                <p className="mt-1 text-sm text-neutral">
                    {torneoSeleccionado ? "Consulta les edicions disponibles d'aquest torneig." : "Últimes edicions dels tornejos als quals tens accés."}
                </p>
            </div>

            {edicionesMostradas.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
                    <p className="font-medium text-neutral-titulos">
                        {torneoSeleccionado ? "Aquest torneig encara no té edicions." : "Encara no hi ha edicions accessibles."}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {edicionesMostradas.map(edicion => {
                        const estado = datosEstado(edicion.estado);
                        const seleccionada = edicion.id === edicionID;

                        const enlace = edicion.torneo_id
                            ? `/panell?torneoID=${encodeURIComponent(edicion.torneo_id)}&edicionID=${encodeURIComponent(edicion.id)}`
                            : null;

                        return enlace ? (
                            <a key={edicion.id} href={enlace} className={`group flex flex-col gap-3 rounded-xl border bg-card p-4 transition hover:border-secondary sm:flex-row sm:items-start sm:justify-between ${seleccionada ? "border-secondary" : "border-border"}`}>
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${estado.clase}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                            <path d={estado.icono} />
                                        </svg>
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="font-semibold text-neutral-titulos">
                                                {edicion.nombre || "Edició sense nom"}
                                            </h3>

                                            {seleccionada && (
                                                <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-secondary">
                                                    Seleccionada
                                                </span>
                                            )}
                                        </div>

                                        {!torneoSeleccionado && (
                                            <p className="mt-1 text-sm text-neutral">
                                                {edicion.torneo_nombre || "Torneig sense nom"}
                                            </p>
                                        )}

                                        <p className="mt-2 text-sm text-neutral">
                                            {formatearFecha(edicion.fecha_inicio, "Inici pendent")}
                                            {" · "}
                                            {formatearFecha(edicion.fecha_fin, "Final pendent")}
                                        </p>

                                        <p className="mt-1 text-xs text-neutral">
                                            Seu: {edicion.sede?.trim() || "Pendent"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-3">
                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${estado.clase}`}>
                                        {estado.nombre}
                                    </span>

                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-neutral transition group-hover:translate-x-1 group-hover:fill-secondary" viewBox="0 -960 960 960" aria-hidden="true">
                                        <path d="m504-480-184-184 56-56 240 240-240 240-56-56z" />
                                    </svg>
                                </div>
                            </a>
                        ) : (
                            <article key={edicion.id} className={`rounded-xl border bg-card p-4 ${seleccionada ? "border-secondary" : "border-border"}`}>
                                <h3 className="font-semibold text-neutral-titulos">
                                    {edicion.nombre || "Edició sense nom"}
                                </h3>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}