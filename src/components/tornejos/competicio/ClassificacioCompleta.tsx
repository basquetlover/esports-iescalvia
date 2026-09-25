type Equip = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Fila = {
  equipo: Equip;
  posicion: number | null;
  pj: number | null;
  pg: number | null;
  pe: number | null;
  pp: number | null;
  favor: number | null;
  contra: number | null;
  diferencia: number | null;
  puntos: number | null;
  amarillas: number | null;
  rojas: number | null;
};

type Props = {
  grupNom: string;
  files: Fila[];
  esFutbol: boolean;
  etiquetaFavor: string;
  etiquetaContra: string;
  teClassificacio: boolean;
};

function valor(numero: number | null) {
  return numero === null ? "—" : numero;
}

function diferencia(numero: number | null) {
  if (numero === null) {
    return "—";
  }

  return numero > 0 ? `+${numero}` : numero;
}

export default function ClassificacioCompleta({
  grupNom,
  files,
  esFutbol,
  etiquetaFavor,
  etiquetaContra,
  teClassificacio,
}: Props) {
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border/50 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          Classificació completa
        </p>

        <h3 className="mt-1 text-xl font-bold text-neutral-titulos">
          {grupNom}
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-background/60">
            <tr className="border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-neutral">
              <th className="px-4 py-3 text-center">Pos</th>

              <th className="px-4 py-3 text-left">Equip</th>

              <th className="px-3 py-3 text-center">PJ</th>

              <th className="px-3 py-3 text-center">PG</th>

              <th className="px-3 py-3 text-center">PE</th>

              <th className="px-3 py-3 text-center">PP</th>

              <th className="px-3 py-3 text-center">{etiquetaFavor}</th>

              <th className="px-3 py-3 text-center">{etiquetaContra}</th>

              <th className="px-3 py-3 text-center">DIF</th>

              {esFutbol && (
                <>
                  <th className="px-3 py-3 text-center">TA</th>

                  <th className="px-3 py-3 text-center">TR</th>
                </>
              )}

              <th className="px-4 py-3 text-center">PTS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/50">
            {files.map((fila, index) => (
              <tr
                key={fila.equipo.id}
                className="transition hover:bg-background/40"
              >
                <td className="px-4 py-3 text-center">
                  <span
                    className={[
                      "inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold",
                      index < 2
                        ? "bg-primary text-white"
                        : "bg-primary/10 text-primary",
                    ].join(" ")}
                  >
                    {fila.posicion ?? index + 1}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex min-w-48 items-center gap-3">
                    {fila.equipo.escudo ? (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                        <img
                          src={fila.equipo.escudo}
                          alt=""
                          className="h-full w-full object-contain p-1"
                        />
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-xs font-bold text-primary">
                        {fila.equipo.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <span className="font-semibold text-neutral-titulos">
                      {fila.equipo.nombre}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-3 text-center text-sm">
                  {valor(fila.pj)}
                </td>

                <td className="px-3 py-3 text-center text-sm">
                  {valor(fila.pg)}
                </td>

                <td className="px-3 py-3 text-center text-sm">
                  {valor(fila.pe)}
                </td>

                <td className="px-3 py-3 text-center text-sm">
                  {valor(fila.pp)}
                </td>

                <td className="px-3 py-3 text-center text-sm">
                  {valor(fila.favor)}
                </td>

                <td className="px-3 py-3 text-center text-sm">
                  {valor(fila.contra)}
                </td>

                <td className="px-3 py-3 text-center text-sm font-semibold">
                  {diferencia(fila.diferencia)}
                </td>

                {esFutbol && (
                  <>
                    <td className="px-3 py-3 text-center text-sm">
                      {valor(fila.amarillas)}
                    </td>

                    <td className="px-3 py-3 text-center text-sm">
                      {valor(fila.rojas)}
                    </td>
                  </>
                )}

                <td className="px-4 py-3 text-center text-base font-bold text-primary">
                  {fila.puntos ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!teClassificacio && (
        <div className="border-t border-border/50 bg-background/30 px-5 py-3">
          <p className="text-xs text-neutral">
            La classificació encara no s'ha calculat.
          </p>
        </div>
      )}
    </section>
  );
}
