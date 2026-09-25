type Grup = {
  id: string;
  nombre: string;
  faseID: string;
  faseNombre: string;
};

type Props = {
  grups: Grup[];
  valor: string;
  desactivat?: boolean;
  onCanvi: (grupID: string) => void;
};

export default function SelectorGrup({
  grups,
  valor,
  desactivat = false,
  onCanvi,
}: Props) {
  const fases = new Set(grups.map((grup) => grup.faseID));

  const mostrarFase = fases.size > 1;

  return (
    <div className="w-full sm:w-72">
      <label
        htmlFor="selector-grup"
        className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-neutral"
      >
        Grup
      </label>

      <select
        id="selector-grup"
        value={valor}
        disabled={desactivat}
        onChange={(evento) => onCanvi(evento.target.value)}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-neutral-titulos outline-none transition focus:border-primary disabled:cursor-wait disabled:opacity-60"
      >
        {grups.map((grup) => (
          <option key={grup.id} value={grup.id}>
            {mostrarFase ? `${grup.faseNombre} · ${grup.nombre}` : grup.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
