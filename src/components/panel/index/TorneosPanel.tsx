import { obtenerIconoDeporte } from "@components/deporteIcono";
import type { TarjetaTorneoPanel } from "./ResumenPanel";

export default function TorneosPanel({
    torneos
}: {
    torneos: TarjetaTorneoPanel[];
}) {
    return (
        <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-neutral-titulos">
                    Els teus tornejos
                </h2>

                <a
                    href="/panell/tornejos"
                    className="text-sm text-primary hover:underline"
                >
                    Veure tots els tornejos
                </a>
            </div>

            {torneos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center text-neutral">
                    Encara no tens cap torneig accessible.
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                    {torneos.slice(0, 6).map(torneo => (
                        <article
                            key={torneo.id}
                            className="min-w-0 overflow-hidden rounded-lg border border-border bg-card flex flex-col"
                        >
                            <div className="relative h-32 bg-primary/20">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {obtenerIconoDeporte(
                                        torneo.deporte || "",
                                        "h-12 w-12 fill-secondary"
                                    )}
                                </div>

                                {torneo.banner && (
                                    <img
                                        src={torneo.banner}
                                        alt=""
                                        loading="lazy"
                                        className="absolute inset-0 h-full w-full object-cover"
                                        onError={e => {
                                            e.currentTarget.style.display =
                                                "none";
                                        }}
                                    />
                                )}

                                <span className="absolute top-2 right-2 rounded bg-background/90 px-2 py-1 text-xs font-medium text-neutral-titulos">
                                    {torneo.activo === true
                                        ? "Actiu"
                                        : torneo.activo === false
                                          ? "Inactiu"
                                          : "Sense estat"}
                                </span>

                                {torneo.logo && (
                                    <img
                                        src={torneo.logo}
                                        alt=""
                                        loading="lazy"
                                        className="absolute bottom-2 left-3 h-12 w-12 rounded-lg border border-border bg-card object-contain p-1"
                                        onError={e => {
                                            e.currentTarget.style.display =
                                                "none";
                                        }}
                                    />
                                )}
                            </div>

                            <div className="flex flex-1 flex-col p-4">
                                <h3 className="font-bold text-neutral-titulos wrap-break-words">
                                    {torneo.nombre || "Torneig sense nom"}
                                </h3>

                                <div className="mt-1 flex items-center gap-2 text-sm text-neutral">
                                    {obtenerIconoDeporte(
                                        torneo.deporte || "",
                                        "h-4 w-4 shrink-0 fill-current"
                                    )}

                                    <span>
                                        {torneo.deporte || "Esport no definit"}
                                    </span>
                                </div>

                                <p className="mt-3 text-sm text-neutral">
                                    {torneo.total_ediciones === null
                                        ? "Edicions no disponibles"
                                        : `${torneo.total_ediciones} ${
                                            torneo.total_ediciones === 1
                                                ? "edició"
                                                : "edicions"
                                        }`}
                                </p>

                                <div className="mt-auto pt-4">
                                    <a
                                        href={torneo.enlace}
                                        className="block rounded-lg border border-primary bg-background px-3 py-2 text-center text-primary hover:bg-primary hover:text-secondary-variant"
                                    >
                                        Obrir resum
                                    </a>

                                    <a
                                        href={torneo.enlace_info}
                                        className="mt-2 block text-center text-xs text-neutral hover:underline"
                                    >
                                        Informació del torneig
                                    </a>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}