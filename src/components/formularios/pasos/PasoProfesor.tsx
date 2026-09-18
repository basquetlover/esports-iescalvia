import ListaParticipantes from "../componentes/ListaParticipantes";

import type {
    ConfiguracionEquipos,
    ObservacionCampo,
    ParticipanteFormulario,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    participantes: ParticipanteFormulario[];
    configuracion: ConfiguracionEquipos;
    observaciones: readonly ObservacionCampo[];
    soloLectura: boolean;
    bloqueado: boolean;
    onCambiar: (participantes: ParticipanteFormulario[]) => void;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoProfesor({
    participantes,
    configuracion,
    observaciones,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const configuracionProfesores =
        configuracion.profesores;

    const profesores =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "PROFESOR",
        );

    const cantidad =
        profesores.length;

    const minimo =
        configuracionProfesores.minimo;

    const maximo =
        configuracionProfesores.maximo;

    const cumpleMinimo =
        cantidad >=
        minimo;

    const dentroMaximo =
        maximo <=
            0 ||
        cantidad <=
            maximo;

    const configuracionCorrecta =
        cumpleMinimo &&
        dentroMaximo;

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="space-y-8">
            {/* =================================================
                INFORMACIÓN
            ================================================= */}

            <div className="rounded-2xl border border-border bg-card/30 p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M400-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0 320q-83 0-156-31.5T117-280q54-54 127-85.5T400-397q83 0 156 31.5T683-280q-54 57-127 88.5T400-160Zm320-160v-80H600v-80h120v-120h80v120h120v80H800v120h-80Z" />
                        </svg>
                    </span>

                    <div>
                        <h3 className="font-semibold text-neutral-titulos">
                            Professorat
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Afegeix els professors que formaran part de l'equip durant aquesta edició.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                RESUMEN DE REQUISITOS
            ================================================= */}

            <section className={`rounded-2xl border p-5 ${configuracionCorrecta ? "border-primary/30 bg-primary/5" : "border-error/30 bg-error-container/15"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={configuracionCorrecta ? "text-primary" : "text-error"}>
                                {configuracionCorrecta ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                        <path d="m382-240-228-228 57-57 171 171 367-367 57 57-424 424Z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                                    </svg>
                                )}
                            </span>

                            <h3 className="font-semibold text-neutral-titulos">
                                Requisits del professorat
                            </h3>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Aquesta edició permet incorporar professorat a l'equip.
                        </p>
                    </div>

                    <span className={`inline-flex w-max rounded-full border px-3 py-1.5 text-xs font-semibold ${configuracionCorrecta ? "border-primary/30 bg-primary/10 text-primary" : "border-error/30 bg-error-container/30 text-error-foreground"}`}>
                        {configuracionCorrecta
                            ? "Requisit complert"
                            : "Pendent"}
                    </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral">
                            Professorat
                        </p>

                        <div className="mt-2 flex items-end justify-between gap-3">
                            <p className="text-2xl font-bold text-neutral-titulos">
                                {cantidad}
                            </p>

                            <p className="text-xs text-neutral">
                                {minimo === maximo
                                    ? `${minimo} requerits`
                                    : maximo > 0
                                      ? `${minimo}–${maximo} permesos`
                                      : `Mínim ${minimo}`}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral">
                            Còmput de jugadors
                        </p>

                        <div className="mt-2 flex items-center gap-2">
                            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${configuracionProfesores.cuentan_como_jugador ? "bg-primary/10 text-primary" : "bg-card text-neutral"}`}>
                                {configuracionProfesores.cuentan_como_jugador ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="m382-240-228-228 57-57 171 171 367-367 57 57-424 424Z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                                    </svg>
                                )}
                            </span>

                            <p className="text-sm font-semibold text-neutral-titulos">
                                {configuracionProfesores.cuentan_como_jugador
                                    ? "Compten com a jugadors"
                                    : "No compten com a jugadors"}
                            </p>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-neutral">
                            {configuracionProfesores.cuentan_como_jugador
                                ? "El professorat s'inclourà en el recompte total quan es comprovin els requisits de l'equip."
                                : "El professorat no s'inclourà en el recompte mínim o màxim de jugadors."}
                        </p>
                    </div>
                </div>
            </section>

            {/* =================================================
                LISTA
            ================================================= */}

            <ListaParticipantes tipo="PROFESOR" participantes={participantes} configuracion={configuracion} observaciones={observaciones} titulo="Professors" descripcion="Indica les dades dels professors que participaran amb l'equip." singular="professor" plural="professors" minimo={minimo} maximo={maximo} mostrarCurso mostrarGenero={configuracion.genero.activo && configuracionProfesores.cuentan_como_jugador} cursoObligatorio generoObligatorio={configuracion.genero.activo && configuracionProfesores.cuentan_como_jugador} emailObligatorio soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={onCambiar} />
        </div>
    );
}