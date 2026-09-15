import { useEffect, useRef } from "react";

export type PasoProgreso = {
    id: string;
    titulo: string;
    contexto?: string;
};

type Props = {
    pasos: readonly PasoProgreso[];
    pasoActual: string;
    pasosCompletados: readonly string[];
    onCambiarPaso: (id: string) => void;
    bloqueado?: boolean;
};

export default function Progreso({
    pasos,
    pasoActual,
    pasosCompletados,
    onCambiarPaso,
    bloqueado = false,
}: Props) {
    const contenedorRef = useRef<HTMLDivElement>(null);
    const pasoActivoRef = useRef<HTMLLIElement>(null);

    const indiceActual = pasos.findIndex(
        (paso) => paso.id === pasoActual,
    );

    const completados = new Set(pasosCompletados);
    const actual = pasos[indiceActual];

    useEffect(() => {
        const contenedor = contenedorRef.current;
        const elemento = pasoActivoRef.current;

        if (!contenedor || !elemento) return;

        const marco = contenedor.getBoundingClientRect();
        const posicion = elemento.getBoundingClientRect();

        const destino =
            contenedor.scrollLeft +
            posicion.left -
            marco.left -
            (marco.width - posicion.width) / 2;

        const movimientoReducido = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;

        contenedor.scrollTo({
            left: Math.max(0, destino),
            behavior: movimientoReducido ? "auto" : "smooth",
        });
    }, [pasoActual, pasos.length]);

    if (!actual) return null;

    return (
        <nav
            aria-label="Passos de la configuració de permisos"
            className="w-full text-neutral"
        >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium tracking-wide">
                    CONFIGURACIÓ DE PERMISOS
                </p>

                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium">
                    Pas {indiceActual + 1} de {pasos.length}
                </span>
            </div>

            <div
                ref={contenedorRef}
                className="overflow-x-auto overscroll-x-contain pb-3"
            >
                <ol className="flex min-w-full items-start py-2">
                    {pasos.map((paso, indice) => {
                        const activo = paso.id === pasoActual;
                        const completado = completados.has(paso.id);

                        const anteriorCompletado =
                            indice > 0 &&
                            completados.has(pasos[indice - 1].id);

                        const circulo = activo
                            ? "border-primary bg-card ring-4 ring-primary/10"
                            : completado
                              ? "border-neutral/40 bg-card"
                              : "border-border bg-background";

                        return (
                            <li
                                key={paso.id}
                                ref={activo ? pasoActivoRef : null}
                                className="relative min-w-36 flex-1 px-2 sm:min-w-44"
                            >
                                {indice > 0 && (
                                    <span
                                        aria-hidden="true"
                                        className={`absolute left-0 right-1/2 top-5 h-px ${
                                            anteriorCompletado
                                                ? "bg-neutral/40"
                                                : "bg-border"
                                        }`}
                                    />
                                )}

                                {indice < pasos.length - 1 && (
                                    <span
                                        aria-hidden="true"
                                        className={`absolute left-1/2 right-0 top-5 h-px ${
                                            completado
                                                ? "bg-neutral/40"
                                                : "bg-border"
                                        }`}
                                    />
                                )}

                                <button
                                    type="button"
                                    disabled={bloqueado}
                                    aria-current={activo ? "step" : undefined}
                                    aria-label={[
                                        `Pas ${indice + 1}`,
                                        paso.contexto,
                                        paso.titulo,
                                        completado ? "Completat" : null,
                                    ]
                                        .filter(Boolean)
                                        .join(". ")}
                                    onClick={() => {
                                        if (!activo) {
                                            onCambiarPaso(paso.id);
                                        }
                                    }}
                                    className="
                                        relative flex w-full flex-col
                                        items-center rounded-xl px-2 pb-2
                                        text-center text-neutral
                                        outline-none
                                        focus-visible:ring-2
                                        focus-visible:ring-neutral/40
                                        disabled:cursor-wait
                                        disabled:opacity-60
                                    "
                                >
                                    <span
                                        className={`
                                            relative z-10 flex h-10 w-10
                                            shrink-0 items-center justify-center
                                            rounded-full border-2
                                            text-sm font-semibold
                                            transition-[background-color,border-color,box-shadow]
                                            motion-reduce:transition-none
                                            ${circulo}
                                        `}
                                    >
                                        {completado && !activo ? (
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-5 w-5"
                                                aria-hidden="true"
                                            >
                                                <path d="m5 12 4 4L19 6" />
                                            </svg>
                                        ) : (
                                            indice + 1
                                        )}
                                    </span>

                                    <span className="mt-3 flex min-h-14 max-w-40 flex-col items-center">
                                        {paso.contexto && (
                                            <span className="mb-1 line-clamp-2 text-[11px] leading-4">
                                                {paso.contexto}
                                            </span>
                                        )}

                                        <span
                                            className={`text-xs leading-5 ${
                                                activo
                                                    ? "font-bold"
                                                    : "font-medium"
                                            }`}
                                        >
                                            {paso.titulo}
                                        </span>
                                    </span>

                                    {activo && (
                                        <span
                                            aria-hidden="true"
                                            className="mt-1 h-1 w-5 rounded-full bg-neutral/50"
                                        />
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>

            <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                Pas {indiceActual + 1} de {pasos.length}:{" "}
                {actual.contexto ? `${actual.contexto}. ` : ""}
                {actual.titulo}
            </p>
        </nav>
    );
}