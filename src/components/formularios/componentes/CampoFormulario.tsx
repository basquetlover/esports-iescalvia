import {
    useId,
    type ReactNode,
} from "react";

// ============================================================
// PROPS
// ============================================================

type Props = {
    etiqueta: string;
    obligatorio?: boolean;
    ayuda?: string | null;
    error?: string | null;
    observacion?: string | null;
    contador?: string | null;
    disabled?: boolean;
    children: ReactNode;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function CampoFormulario({
    etiqueta,
    obligatorio = false,
    ayuda = null,
    error = null,
    observacion = null,
    contador = null,
    disabled = false,
    children,
}: Props) {
    const ayudaID =
        useId();

    const errorID =
        useId();

    const observacionID =
        useId();

    const tieneError =
        Boolean(
            error,
        );

    const tieneObservacion =
        Boolean(
            observacion,
        );

    return (
        <div className={`space-y-2 ${disabled ? "opacity-90" : ""}`}>
            {/* =================================================
                ETIQUETA
            ================================================= */}

            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-neutral-titulos">
                            {etiqueta}

                            {obligatorio && (
                                <span className="ml-1 text-error" aria-hidden="true">
                                    *
                                </span>
                            )}
                        </p>

                        {disabled && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-3 w-3 fill-current" aria-hidden="true">
                                    <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm120-560h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80Z" />
                                </svg>

                                Bloquejat
                            </span>
                        )}
                    </div>

                    {ayuda && (
                        <p id={ayudaID} className="mt-1 text-xs leading-5 text-neutral">
                            {ayuda}
                        </p>
                    )}
                </div>

                {contador && (
                    <span className="shrink-0 text-xs font-medium text-neutral">
                        {contador}
                    </span>
                )}
            </div>

            {/* =================================================
                CAMPO
            ================================================= */}

            <div className={tieneError ? "rounded-xl ring-2 ring-error/20" : ""}>
                {children}
            </div>

            {/* =================================================
                ERROR
            ================================================= */}

            {tieneError && (
                <div id={errorID} className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/20 px-3 py-2.5 text-error-foreground">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-error" aria-hidden="true">
                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                    </svg>

                    <p className="text-xs font-medium leading-5">
                        {error}
                    </p>
                </div>
            )}

            {/* =================================================
                OBSERVACIÓN DE REVISIÓN
            ================================================= */}

            {tieneObservacion && (
                <div id={observacionID} className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/20 px-3 py-2.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-error" aria-hidden="true">
                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                    </svg>

                    <div>
                        <p className="text-xs font-semibold text-error-foreground">
                            Motiu de la revisió
                        </p>

                        <p className="mt-0.5 text-xs leading-5 text-error-foreground">
                            {observacion}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}