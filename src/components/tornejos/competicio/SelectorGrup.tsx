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

// ============================================================
// COMPONENTE
// ============================================================

export default function SelectorGrup({
  grups,
  valor,
  desactivat = false,
  onCanvi,
}: Props) {
  const fases = new Set(grups.map((grup) => grup.faseID));

  const mostrarFase = fases.size > 1;

  return (
    <div
      className="
                w-full
                lg:w-80
            "
    >
      <label
        htmlFor="selector-grup"
        className="
                    mb-2
                    block
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-neutral
                "
      >
        Seleccionar grup
      </label>

      <div
        className="
                    relative
                "
      >
        <select
          id="selector-grup"
          value={valor}
          disabled={desactivat}
          onChange={(evento) => onCanvi(evento.target.value)}
          className="
                        h-12
                        w-full
                        appearance-none
                        rounded-2xl
                        border
                        border-border
                        bg-background
                        pl-4
                        pr-12
                        text-sm
                        font-semibold
                        text-neutral-titulos
                        outline-none
                        transition
                        hover:border-primary/50
                        focus:border-primary
                        disabled:cursor-wait
                        disabled:opacity-60
                    "
        >
          {grups.map((grup) => (
            <option key={grup.id} value={grup.id}>
              {mostrarFase
                ? `${grup.faseNombre} · ${grup.nombre}`
                : grup.nombre}
            </option>
          ))}
        </select>

        <div
          className="
                        pointer-events-none
                        absolute
                        right-4
                        top-1/2
                        flex
                        -translate-y-1/2
                        items-center
                        justify-center
                        text-neutral
                    "
        >
          {desactivat ? (
            <IconoCargando
              className="
                                h-4
                                w-4
                                animate-spin
                            "
            />
          ) : (
            <IconoChevron
              className="
                                h-4
                                w-4
                            "
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SVG INLINE
// ============================================================

type IconProps = {
  className?: string;
};

function IconoChevron({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconoCargando({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity=".2"
      />

      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
