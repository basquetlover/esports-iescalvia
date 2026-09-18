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

export default function PasoStaff({
    participantes,
    configuracion,
    observaciones,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const configuracionStaff =
        configuracion.staff;

    const miembrosStaff =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "STAFF",
        );

    const cantidad =
        miembrosStaff.length;

    const minimo =
        configuracionStaff.minimo;

    const maximo =
        configuracionStaff.maximo;

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
                            <path d="M160-200v-80h640v80H160Zm80-120v-320h160v320H240Zm240 0v-480h160v480H480Zm240 0v-240h160v240H720Z" />
                        </svg>
                    </span>

                    <div>
                        <h3 className="font-semibold text-neutral-titulos">
                            Staff
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Afegeix les persones que formaran part de l'staff o de l'equip de suport.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                REQUISITOS
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
                                Membres de l'staff
                            </h3>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Aquesta edició permet afegir membres de suport a l'equip.
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
                            Membres actuals
                        </p>

                        <p className="mt-2 text-2xl font-bold text-neutral-titulos">
                            {cantidad}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-background p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral">
                            Límit configurat
                        </p>

                        <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                            {minimo === maximo
                                ? `${minimo} ${minimo === 1 ? "membre" : "membres"}`
                                : maximo > 0
                                  ? `${minimo}–${maximo} membres`
                                  : `Mínim ${minimo} membres`}
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            {maximo > 0
                                ? "No es podran afegir més membres quan s'arribi al màxim."
                                : "No hi ha cap màxim establert per aquesta edició."}
                        </p>
                    </div>
                </div>
            </section>

            {/* =================================================
                LISTA
            ================================================= */}

            <ListaParticipantes
                tipo="STAFF"
                participantes={participantes}
                configuracion={configuracion}
                observaciones={observaciones}
                titulo="Membres de l'staff"
                descripcion="Indica les dades de les persones que formaran part de l'equip de suport."
                singular="membre"
                plural="membres"
                minimo={minimo}
                maximo={maximo}
                mostrarCurso={false}
                mostrarGenero={false}
                cursoObligatorio={false}
                generoObligatorio={false}
                emailObligatorio
                soloLectura={soloLectura}
                bloqueado={bloqueado}
                onCambiar={onCambiar}
            />
        </div>
    );
}