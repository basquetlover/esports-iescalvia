import { useEffect, useRef } from "react";

import type {
    PasoFormulario,
    PasoFormularioID,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    pasos: readonly PasoFormulario[];
    pasoActual: PasoFormularioID;
    bloqueado: boolean;
    onSeleccionar: (id: PasoFormularioID) => void;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function ProgresoFormulario({
    pasos,
    pasoActual,
    bloqueado,
    onSeleccionar,
}: Props) {
    const contenedorRef = useRef<HTMLDivElement>(null);
    const pasoActivoRef = useRef<HTMLButtonElement>(null);

    const indiceActual = pasos.findIndex(
        paso =>
            paso.id ===
            pasoActual,
    );

    const actual =
        indiceActual >=
        0
            ? pasos[
                  indiceActual
              ]
            : null;

    // ========================================================
    // CENTRAR SLIDE ACTUAL
    // ========================================================

    useEffect(() => {
        const contenedor =
            contenedorRef.current;

        const elemento =
            pasoActivoRef.current;

        if (
            !contenedor ||
            !elemento
        ) {
            return;
        }

        const marco =
            contenedor.getBoundingClientRect();

        const posicion =
            elemento.getBoundingClientRect();

        const destino =
            contenedor.scrollLeft +
            posicion.left -
            marco.left -
            (
                marco.width -
                posicion.width
            ) /
                2;

        const movimientoReducido =
            window
                .matchMedia(
                    "(prefers-reduced-motion: reduce)",
                )
                .matches;

        contenedor.scrollTo({
            left:
                Math.max(
                    0,
                    destino,
                ),

            behavior:
                movimientoReducido
                    ? "auto"
                    : "smooth",
        });
    }, [
        pasoActual,
        pasos.length,
    ]);

    if (
        !actual ||
        pasos.length ===
            0
    ) {
        return null;
    }

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <nav aria-label="Passos de la inscripció" className="sticky top-0 z-30 w-full border-b border-border bg-background/95 backdrop-blur-md">
            <div className="mx-auto w-full max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
                <div className="mb-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                            Inscripció
                        </p>

                        <p className="mt-0.5 truncate text-sm font-semibold text-neutral-titulos">
                            {actual.titulo}
                        </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-neutral">
                        Pas{" "}
                        {indiceActual +
                            1}{" "}
                        de{" "}
                        {pasos.length}
                    </span>
                </div>

                <div ref={contenedorRef} className="scroll-personalizada overflow-x-auto overscroll-x-contain pb-1">
                    <ol className="flex min-w-max items-center gap-2">
                        {pasos.map(
                            (
                                paso,
                                indice,
                            ) => {
                                const activo =
                                    paso.id ===
                                    pasoActual;

                                const completado =
                                    indice <
                                    indiceActual;

                                return (
                                    <li key={paso.id} className="flex items-center">
                                        <button ref={activo ? pasoActivoRef : undefined} type="button" disabled={bloqueado} aria-current={activo ? "step" : undefined} aria-label={`Pas ${indice + 1} de ${pasos.length}: ${paso.titulo}`} onClick={() => !activo && onSeleccionar(paso.id)} className={`group flex min-w-40 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-60 ${activo ? "border-primary bg-primary/10" : "border-transparent bg-transparent hover:border-border hover:bg-card/60"}`}>
                                            <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition ${activo ? "border-primary bg-primary text-white" : completado ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-card text-neutral"}`}>
                                                {completado ? (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current">
                                                        <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
                                                    </svg>
                                                ) : (
                                                    indice +
                                                    1
                                                )}
                                            </span>

                                            <span className="min-w-0">
                                                <span className="block text-[10px] font-medium uppercase leading-none tracking-wide text-neutral">
                                                    Pas{" "}
                                                    {indice +
                                                        1}
                                                </span>

                                                <span className={`mt-1 block max-w-44 truncate text-xs ${activo ? "font-semibold text-primary" : "font-semibold text-neutral-titulos"}`}>
                                                    {
                                                        paso.titulo
                                                    }
                                                </span>

                                                <span className="mt-0.5 block max-w-44 truncate text-[10px] text-neutral">
                                                    {
                                                        paso.descripcion
                                                    }
                                                </span>
                                            </span>
                                        </button>

                                        {indice <
                                            pasos.length -
                                                1 && (
                                            <span aria-hidden="true" className={`mx-1 h-px w-5 shrink-0 sm:w-8 ${indice < indiceActual ? "bg-primary/50" : "bg-border"}`} />
                                        )}
                                    </li>
                                );
                            },
                        )}
                    </ol>
                </div>

                <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${((indiceActual + 1) / pasos.length) * 100}%` }} />
                </div>

                <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    Pas{" "}
                    {indiceActual +
                        1}{" "}
                    de{" "}
                    {
                        pasos.length
                    }
                    :{" "}
                    {
                        actual.titulo
                    }
                    .{" "}
                    {
                        actual.descripcion
                    }
                </p>
            </div>
        </nav>
    );
}