import type {
    EstadoFormulario,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    indice: number;
    total: number;
    ultimoPaso: boolean;
    soloLectura: boolean;
    bloqueado: boolean;
    guardando: boolean;
    enviando: boolean;
    modificado: boolean;
    estado: EstadoFormulario;
    onAnterior: () => void;
    onSiguiente: () => void;
    onGuardar: () => void;
    onEnviar: () => void;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function NavegacionFormulario({
    indice,
    total,
    ultimoPaso,
    soloLectura,
    bloqueado,
    guardando,
    enviando,
    modificado,
    estado,
    onAnterior,
    onSiguiente,
    onGuardar,
    onEnviar,
}: Props) {
    const primerPaso =
        indice ===
        0;

    const enRevision =
        estado ===
        "EN_REVISION";

    const puedeEnviar =
        ultimoPaso &&
        !soloLectura &&
        !enRevision;

    const mostrarGuardar =
        !soloLectura &&
        !enRevision &&
        !ultimoPaso;

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="mt-6 border-t border-border pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={onAnterior} disabled={primerPaso || bloqueado} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-40">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                            <path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
                        </svg>

                        Anterior
                    </button>

                    <span className="hidden text-xs text-neutral sm:inline">
                        Pas{" "}
                        {indice +
                            1}{" "}
                        de{" "}
                        {total}
                    </span>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
                    {mostrarGuardar && (
                        <button type="button" onClick={onGuardar} disabled={bloqueado || !modificado} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:bg-card disabled:cursor-not-allowed disabled:opacity-40">
                            {guardando ? (
                                <>
                                    <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                                    Guardant
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h447q16 0 30.5 6t25.5 17l114 114q11 11 17 25.5t6 30.5v447q0 33-23.5 56.5T760-120H200Zm280-120q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-600h360v-160H240v160Z" />
                                    </svg>

                                    Guardar
                                </>
                            )}
                        </button>
                    )}

                    {!ultimoPaso && (
                        <button type="button" onClick={onSiguiente} disabled={bloqueado} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                            {guardando ? (
                                <>
                                    <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Guardant
                                </>
                            ) : soloLectura ? (
                                <>
                                    Següent

                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="m400-240-56-56 184-184-184-184 56-56 240 240-240 240Z" />
                                    </svg>
                                </>
                            ) : (
                                <>
                                    Guardar i continuar

                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="m400-240-56-56 184-184-184-184 56-56 240 240-240 240Z" />
                                    </svg>
                                </>
                            )}
                        </button>
                    )}

                    {puedeEnviar && (
                        <button type="button" onClick={onEnviar} disabled={bloqueado} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                            {enviando ? (
                                <>
                                    <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    Enviant
                                </>
                            ) : (
                                <>
                                    Enviar a revisió

                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="m120-160 80-240 360 360-240 80-200-200Zm101-139 99 99 85-28-156-156-28 85Zm99 99Z" />
                                        <path d="m510-450-57-57 226-226 57 57-226 226Zm110 110-57-57 117-117 57 57-117 117ZM400-560l-57-57 117-117 57 57-117 117Z" />
                                    </svg>
                                </>
                            )}
                        </button>
                    )}

                    {ultimoPaso && soloLectura && (
                        <div className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-neutral">
                            Formulari en mode de consulta
                        </div>
                    )}
                </div>
            </div>

            {ultimoPaso && !soloLectura && estado === "APROBADO" && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm leading-6 text-neutral">
                    Si envies canvis sobre una inscripció aprovada, tornarà a quedar pendent de revisió.
                </div>
            )}

            {ultimoPaso && estado === "DENEGADO" && !soloLectura && (
                <div className="mt-4 rounded-xl border border-error/30 bg-error-container/25 p-4 text-sm leading-6 text-error-foreground">
                    Revisa els motius indicats abans de tornar a enviar la inscripció.
                </div>
            )}
        </div>
    );
}