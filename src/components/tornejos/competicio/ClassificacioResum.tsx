type Equip = {
    id: string;
    nombre: string;
    escudo: string | null;
};

type Fila = {
    equipo: Equip;
    posicion: number | null;
    puntos: number | null;
};

type Props = {
    grupNom: string;
    files: Fila[];
    teClassificacio: boolean;
};

export default function ClassificacioResum({
    grupNom,
    files,
    teClassificacio,
}: Props) {
    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Classificació
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-neutral-titulos">
                        {grupNom}
                    </h3>
                </div>

                {!teClassificacio && (
                    <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold text-neutral">
                        Pendent
                    </span>
                )}
            </div>

            <div className="divide-y divide-border/50">
                {files.map(
                    (
                        fila,
                        index,
                    ) => (
                        <div
                            key={
                                fila.equipo.id
                            }
                            className="grid min-h-16 grid-cols-[36px_1fr_auto] items-center gap-3 px-4 py-3"
                        >
                            <div
                                className={[
                                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                                    index <
                                    2
                                        ? "bg-primary text-white"
                                        : "bg-primary/10 text-primary",
                                ].join(
                                    " ",
                                )}
                            >
                                {fila.posicion ??
                                    index +
                                        1}
                            </div>

                            <div className="flex min-w-0 items-center gap-3">
                                {fila
                                    .equipo
                                    .escudo ? (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                                        <img
                                            src={
                                                fila
                                                    .equipo
                                                    .escudo
                                            }
                                            alt=""
                                            className="h-full w-full object-contain p-1"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-xs font-bold text-primary">
                                        {fila
                                            .equipo
                                            .nombre
                                            .charAt(
                                                0,
                                            )
                                            .toUpperCase()}
                                    </div>
                                )}

                                <p className="truncate text-sm font-semibold text-neutral-titulos">
                                    {
                                        fila
                                            .equipo
                                            .nombre
                                    }
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-base font-bold text-neutral-titulos">
                                    {fila.puntos ??
                                        "—"}
                                </p>

                                <p className="text-[9px] font-bold uppercase tracking-wider text-neutral">
                                    punts
                                </p>
                            </div>
                        </div>
                    ),
                )}

                {files.length ===
                    0 && (
                    <div className="px-6 py-12 text-center text-sm text-neutral">
                        Encara no hi ha
                        equips al grup.
                    </div>
                )}
            </div>
        </section>
    );
}