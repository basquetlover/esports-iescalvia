type Equip = {
    id: string;
    nombre: string;
    escudo: string | null;
};

type Partit = {
    id: string;
    codigo: string;
    nombre: string | null;
    estado: string;
    fechaHora: string | null;
    pista: string | null;
    local: Equip | null;
    visitante: Equip | null;
    resultadoLocal: number | null;
    resultadoVisitante: number | null;
};

type Jornada = {
    numero: number;

    contexto:
        | "AVUI"
        | "DARRERA"
        | "PER_JUGAR"
        | "PROXIMA";

    partidos: Partit[];
};

type Props = {
    jornada: Jornada | null;
};

function fecha(
    valor: string | null,
) {
    if (!valor) {
        return null;
    }

    const date =
        new Date(valor);

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "ca-ES",
        {
            weekday:
                "short",
            day:
                "2-digit",
            month:
                "short",
            timeZone:
                "Europe/Madrid",
        },
    ).format(date);
}

function hora(
    valor: string | null,
) {
    if (!valor) {
        return null;
    }

    const date =
        new Date(valor);

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return null;
    }

    return new Intl.DateTimeFormat(
        "ca-ES",
        {
            hour:
                "2-digit",
            minute:
                "2-digit",
            timeZone:
                "Europe/Madrid",
        },
    ).format(date);
}

function etiquetaContexto(
    contexto:
        Jornada["contexto"],
) {
    switch (contexto) {
        case "AVUI":
            return "Avui";

        case "DARRERA":
            return "Darrera jornada";

        case "PER_JUGAR":
            return "Per jugar";

        default:
            return "Jornada";
    }
}

export default function JornadaActual({
    jornada,
}: Props) {
    return (
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 px-5 py-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                        Jornada
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-neutral-titulos">
                        {jornada
                            ? `Jornada ${jornada.numero}`
                            : "Sense jornada"}
                    </h3>
                </div>

                {jornada && (
                    <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral">
                        {etiquetaContexto(
                            jornada.contexto,
                        )}
                    </span>
                )}
            </div>

            {!jornada ? (
                <div className="px-6 py-12 text-center text-sm text-neutral">
                    Encara no hi ha
                    jornades configurades.
                </div>
            ) : (
                <div className="divide-y divide-border/50">
                    {jornada.partidos.map(
                        partit => {
                            const teResultat =
                                partit.resultadoLocal !==
                                    null &&
                                partit.resultadoVisitante !==
                                    null;

                            return (
                                <article
                                    key={
                                        partit.id
                                    }
                                    className="px-5 py-4"
                                >
                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                                        <div className="flex min-w-0 items-center justify-end gap-2">
                                            <p className="truncate text-right text-sm font-semibold text-neutral-titulos">
                                                {partit
                                                    .local
                                                    ?.nombre ??
                                                    "Per determinar"}
                                            </p>

                                            {partit
                                                .local
                                                ?.escudo && (
                                                <img
                                                    src={
                                                        partit
                                                            .local
                                                            .escudo
                                                    }
                                                    alt=""
                                                    className="h-7 w-7 shrink-0 object-contain"
                                                />
                                            )}
                                        </div>

                                        <div className="min-w-16 text-center">
                                            {teResultat ? (
                                                <p className="text-lg font-bold text-neutral-titulos">
                                                    {
                                                        partit.resultadoLocal
                                                    }{" "}
                                                    -{" "}
                                                    {
                                                        partit.resultadoVisitante
                                                    }
                                                </p>
                                            ) : (
                                                <p className="text-sm font-bold text-primary">
                                                    {hora(
                                                        partit.fechaHora,
                                                    ) ??
                                                        "VS"}
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex min-w-0 items-center gap-2">
                                            {partit
                                                .visitante
                                                ?.escudo && (
                                                <img
                                                    src={
                                                        partit
                                                            .visitante
                                                            .escudo
                                                    }
                                                    alt=""
                                                    className="h-7 w-7 shrink-0 object-contain"
                                                />
                                            )}

                                            <p className="truncate text-sm font-semibold text-neutral-titulos">
                                                {partit
                                                    .visitante
                                                    ?.nombre ??
                                                    "Per determinar"}
                                            </p>
                                        </div>
                                    </div>

                                    {(partit.fechaHora ||
                                        partit.pista) && (
                                        <div className="mt-2 flex flex-wrap justify-center gap-x-2 text-[11px] text-neutral">
                                            {partit.fechaHora && (
                                                <span>
                                                    {fecha(
                                                        partit.fechaHora,
                                                    )}
                                                </span>
                                            )}

                                            {partit.pista && (
                                                <span>
                                                    ·{" "}
                                                    {
                                                        partit.pista
                                                    }
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        },
                    )}
                </div>
            )}
        </section>
    );
}