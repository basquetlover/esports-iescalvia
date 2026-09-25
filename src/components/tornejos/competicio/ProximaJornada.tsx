type Equip = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Partit = {
  id: string;
  fechaHora: string | null;
  pista: string | null;
  local: Equip | null;
  visitante: Equip | null;
};

type Jornada = {
  numero: number;
  partidos: Partit[];
};

type Props = {
  jornada: Jornada | null;
};

function fecha(valor: string | null) {
  if (!valor) {
    return null;
  }

  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(date);
}

function hora(valor: string | null) {
  if (!valor) {
    return null;
  }

  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(date);
}

export default function ProximaJornada({ jornada }: Props) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border/50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Pròxima jornada
        </p>

        <h3 className="mt-1 text-xl font-bold text-neutral-titulos">
          {jornada ? `Jornada ${jornada.numero}` : "Sense més jornades"}
        </h3>
      </div>

      {!jornada ? (
        <div className="px-6 py-12 text-center">
          <p className="font-semibold text-neutral-titulos">
            No hi ha una pròxima jornada.
          </p>

          <p className="mt-1 text-sm text-neutral">
            La fase pot haver finalitzat o encara no s'han programat més
            partits.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {jornada.partidos.map((partit) => (
            <article
              key={partit.id}
              className="rounded-xl border border-border bg-background/35 p-4"
            >
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="flex min-w-0 items-center justify-end gap-2">
                  <p className="truncate text-right text-sm font-semibold text-neutral-titulos">
                    {partit.local?.nombre ?? "Per determinar"}
                  </p>

                  {partit.local?.escudo && (
                    <img
                      src={partit.local.escudo}
                      alt=""
                      className="h-7 w-7 shrink-0 object-contain"
                    />
                  )}
                </div>

                <div className="rounded-lg bg-card px-3 py-2 text-center">
                  <p className="text-sm font-bold text-primary">
                    {hora(partit.fechaHora) ?? "VS"}
                  </p>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  {partit.visitante?.escudo && (
                    <img
                      src={partit.visitante.escudo}
                      alt=""
                      className="h-7 w-7 shrink-0 object-contain"
                    />
                  )}

                  <p className="truncate text-sm font-semibold text-neutral-titulos">
                    {partit.visitante?.nombre ?? "Per determinar"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-x-2 text-[11px] text-neutral">
                {partit.fechaHora && <span>{fecha(partit.fechaHora)}</span>}

                {partit.pista && <span>· {partit.pista}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
