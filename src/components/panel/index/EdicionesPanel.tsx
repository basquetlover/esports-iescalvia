import type { EdicionPanel } from "./ResumenPanel";

export default function EdicionesPanel({
    ediciones,
    torneoSeleccionado,
    edicionID
}: {
    ediciones: EdicionPanel[];
    torneoSeleccionado: boolean;
    edicionID: string | null;
}) {
    return (
        <section>
            <h2 className="mb-3 text-xl font-bold text-neutral-titulos">
                {torneoSeleccionado
                    ? "Edicions del torneig"
                    : "Edicions recents"}
            </h2>

            {ediciones.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-neutral">
                    {torneoSeleccionado
                        ? "Aquest torneig encara no té edicions."
                        : "Encara no hi ha edicions accessibles."}
                </div>
            ) : (
                <div className="space-y-3">
                    {(torneoSeleccionado
                        ? ediciones
                        : ediciones.slice(0, 5)
                    ).map(edicion => (
                        <article
                            key={edicion.id}
                            className={`rounded-lg border bg-card p-4 ${
                                edicion.id === edicionID
                                    ? "border-secondary"
                                    : "border-border"
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-neutral-titulos wrap-break-words">
                                            {edicion.nombre || "Edició sense nom"}
                                        </h3>

                                        {edicion.id === edicionID && (
                                            <span className="rounded bg-primary/15 px-2 py-1 text-xs text-primary">
                                                Seleccionada
                                            </span>
                                        )}
                                    </div>

                                    {!torneoSeleccionado && (
                                        <p className="mt-1 text-sm text-neutral">
                                            {edicion.torneo_nombre ||
                                                "Torneig sense nom"}
                                        </p>
                                    )}

                                    <p className="mt-2 text-sm text-neutral">
                                        {edicion.fecha_inicio &&
                                        Number.isFinite(
                                            Date.parse(edicion.fecha_inicio)
                                        )
                                            ? new Date(
                                                edicion.fecha_inicio
                                            ).toLocaleDateString("ca-ES", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric"
                                            })
                                            : "Inici pendent"}

                                        {" · "}

                                        {edicion.fecha_fin &&
                                        Number.isFinite(
                                            Date.parse(edicion.fecha_fin)
                                        )
                                            ? new Date(
                                                edicion.fecha_fin
                                            ).toLocaleDateString("ca-ES", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric"
                                            })
                                            : "Final pendent"}
                                    </p>

                                    <p className="mt-1 text-xs text-neutral">
                                        Seu: {edicion.sede?.trim() || "Pendent"}
                                    </p>
                                </div>

                                <span
                                    className={`w-max shrink-0 rounded px-2 py-1 text-xs font-medium ${
                                        edicion.estado === "ACTIVA"
                                            ? "bg-primary text-secondary-variant"
                                            : edicion.estado === "FINALIZADA"
                                              ? "bg-muted/20 text-neutral"
                                              : "border border-border text-neutral"
                                    }`}
                                >
                                    {edicion.estado === "BORRADOR"
                                        ? "Esborrany"
                                        : edicion.estado === "ACTIVA"
                                          ? "Activa"
                                          : edicion.estado === "FINALIZADA"
                                            ? "Finalitzada"
                                            : edicion.estado?.trim() ||
                                                "Sense estat"}
                                </span>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}