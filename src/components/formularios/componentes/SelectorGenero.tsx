import type {
    GeneroParticipante,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    valor: GeneroParticipante | null;
    deshabilitado?: boolean;
    obligatorio?: boolean;
    onCambiar: (genero: GeneroParticipante | null) => void;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function SelectorGenero({
    valor,
    deshabilitado = false,
    obligatorio = true,
    onCambiar,
}: Props) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-titulos">
                Gènere

                {obligatorio && (
                    <>
                        {" "}

                        <span className="text-error" aria-hidden="true">
                            *
                        </span>

                        <span className="sr-only">
                            obligatori
                        </span>
                    </>
                )}
            </label>

            <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={deshabilitado} aria-pressed={valor === "masculino"} onClick={() => onCambiar("masculino")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 ${valor === "masculino" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-neutral-titulos hover:border-primary/50 hover:bg-card"}`}>
                    <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border ${valor === "masculino" ? "border-primary" : "border-border"}`}>
                        {valor === "masculino" && (
                            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        )}
                    </span>

                    Masculí
                </button>

                <button type="button" disabled={deshabilitado} aria-pressed={valor === "femenino"} onClick={() => onCambiar("femenino")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 ${valor === "femenino" ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-neutral-titulos hover:border-primary/50 hover:bg-card"}`}>
                    <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded-full border ${valor === "femenino" ? "border-primary" : "border-border"}`}>
                        {valor === "femenino" && (
                            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                        )}
                    </span>

                    Femení
                </button>
            </div>

            {!obligatorio && valor !== null && !deshabilitado && (
                <button type="button" onClick={() => onCambiar(null)} className="text-xs font-medium text-neutral transition hover:text-neutral-titulos hover:underline">
                    Esborrar selecció
                </button>
            )}
        </div>
    );
}