import {
    useEffect,
    useRef,
} from "react";

// ============================================================
// TIPOS
// ============================================================

export type PasoProgreso = {
    id: string;
    titulo: string;
    contexto?: string;
};

type Props = {
    pasos:
        readonly PasoProgreso[];

    pasoActual:
        string;

    pasosCompletados:
        readonly string[];

    onCambiarPaso: (
        id: string,
    ) => void;

    bloqueado?: boolean;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function Progreso({
    pasos,
    pasoActual,
    pasosCompletados,
    onCambiarPaso,
    bloqueado = false,
}: Props) {
    const contenedorRef =
        useRef<HTMLDivElement>(
            null,
        );

    const pasoActivoRef =
        useRef<HTMLButtonElement>(
            null,
        );

    const indiceActual =
        pasos.findIndex(
            (paso) =>
                paso.id ===
                pasoActual,
        );

    const completados =
        new Set(
            pasosCompletados,
        );

    const actual =
        indiceActual >= 0
            ? pasos[
                  indiceActual
              ]
            : null;

    // ========================================================
    // CENTRAR PASO ACTUAL
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
        pasos.length === 0
    ) {
        return null;
    }

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <nav
            aria-label="Passos de la configuració de permisos"
            className="w-full text-neutral"
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <div
                className="
                    mb-4
                    flex flex-wrap
                    items-center
                    justify-between
                    gap-3
                "
            >
                <div>
                    <p className="text-xs font-medium tracking-wide">
                        CONFIGURACIÓ DE PERMISOS
                    </p>

                    <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                        {actual.titulo}
                    </p>
                </div>

                <span
                    className="
                        rounded-full
                        border
                        border-border
                        bg-card
                        px-3 py-1.5
                        text-xs
                        font-medium
                    "
                >
                    Pas{" "}
                    {indiceActual + 1}{" "}
                    de{" "}
                    {pasos.length}
                </span>
            </div>

            {/* =================================================
                PASOS
            ================================================= */}

            <div
                ref={
                    contenedorRef
                }
                className="
                    scroll-personalizada
                    overflow-x-auto
                    overscroll-x-contain
                    pb-1
                "
            >
                <ol
                    className="
                        flex min-w-max
                        items-stretch
                        gap-2
                    "
                >
                    {pasos.map(
                        (
                            paso,
                            indice,
                        ) => {
                            const activo =
                                paso.id ===
                                pasoActual;

                            const completado =
                                completados.has(
                                    paso.id,
                                );

                            const anterior =
                                indice <
                                indiceActual;

                            const terminado =
                                completado ||
                                anterior;

                            return (
                                <li
                                    key={
                                        paso.id
                                    }
                                    className="flex"
                                >
                                    <button
                                        ref={
                                            activo
                                                ? pasoActivoRef
                                                : undefined
                                        }
                                        type="button"
                                        disabled={
                                            bloqueado
                                        }
                                        aria-current={
                                            activo
                                                ? "step"
                                                : undefined
                                        }
                                        aria-label={[
                                            `Pas ${indice + 1}`,
                                            paso.contexto,
                                            paso.titulo,
                                            terminado
                                                ? "Completat"
                                                : null,
                                        ]
                                            .filter(
                                                Boolean,
                                            )
                                            .join(
                                                ". ",
                                            )}
                                        onClick={() => {
                                            if (
                                                !activo
                                            ) {
                                                onCambiarPaso(
                                                    paso.id,
                                                );
                                            }
                                        }}
                                        className={`
                                            group
                                            flex min-w-40
                                            items-center
                                            gap-3
                                            rounded-xl
                                            border
                                            px-3 py-2.5
                                            text-left
                                            transition-colors

                                            focus-visible:outline-none
                                            focus-visible:ring-2
                                            focus-visible:ring-neutral/30

                                            disabled:cursor-wait
                                            disabled:opacity-60

                                            ${
                                                activo
                                                    ? "border-neutral/40 bg-background"
                                                    : "border-transparent bg-transparent hover:border-border hover:bg-background/70"
                                            }
                                        `}
                                    >
                                        {/* NÚMERO / CHECK */}

                                        <span
                                            aria-hidden="true"
                                            className={`
                                                flex h-8 w-8
                                                shrink-0
                                                items-center
                                                justify-center
                                                rounded-lg
                                                border
                                                text-xs
                                                font-semibold
                                                transition-colors

                                                ${
                                                    activo
                                                        ? "border-neutral/40 bg-card text-neutral-titulos"
                                                        : terminado
                                                          ? "border-border bg-background text-neutral"
                                                          : "border-border bg-card text-neutral"
                                                }
                                            `}
                                        >
                                            {terminado &&
                                            !activo ? (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-4 w-4"
                                                >
                                                    <path d="m5 12 4 4L19 6" />
                                                </svg>
                                            ) : (
                                                indice +
                                                1
                                            )}
                                        </span>

                                        {/* TEXTO */}

                                        <span className="min-w-0">
                                            <span
                                                className="
                                                    block
                                                    text-[10px]
                                                    leading-none
                                                "
                                            >
                                                PAS{" "}
                                                {indice +
                                                    1}
                                            </span>

                                            <span
                                                className={`
                                                    mt-1
                                                    block
                                                    max-w-44
                                                    truncate
                                                    text-xs

                                                    ${
                                                        activo
                                                            ? "font-semibold text-neutral-titulos"
                                                            : "font-medium"
                                                    }
                                                `}
                                            >
                                                {
                                                    paso.titulo
                                                }
                                            </span>

                                            {paso.contexto && (
                                                <span
                                                    className="
                                                        mt-1
                                                        block
                                                        max-w-44
                                                        truncate
                                                        text-[10px]
                                                    "
                                                >
                                                    {
                                                        paso.contexto
                                                    }
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                </li>
                            );
                        },
                    )}
                </ol>
            </div>

            {/* =================================================
                ACCESIBILIDAD
            ================================================= */}

            <p
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                Pas{" "}
                {indiceActual + 1}{" "}
                de{" "}
                {pasos.length}:{" "}
                {actual.contexto
                    ? `${actual.contexto}. `
                    : ""}
                {actual.titulo}
            </p>
        </nav>
    );
}