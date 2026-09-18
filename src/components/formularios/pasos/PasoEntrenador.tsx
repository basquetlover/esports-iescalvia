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

export default function PasoEntrenador({
    participantes,
    configuracion,
    observaciones,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const entrenadores =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "ENTRENADOR",
        );

    const tieneEntrenador =
        entrenadores.length >
        0;

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
                            <path d="M360-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0 320q-83 0-156-31.5T77-280q54-54 127-85.5T360-397q83 0 156 31.5T643-280q-54 57-127 88.5T360-160Zm320-120v-160H520v-80h160v-160h80v160h160v80H760v160h-80Z" />
                        </svg>
                    </span>

                    <div>
                        <h3 className="font-semibold text-neutral-titulos">
                            Entrenador
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Pots indicar una persona responsable de l'equip com a entrenador.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                ESTADO
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card/20 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Entrenador de l'equip
                        </p>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            {tieneEntrenador
                                ? "Ja has indicat un entrenador per a aquest equip."
                                : "Encara no has indicat cap entrenador."}
                        </p>
                    </div>

                    <span className={`inline-flex w-max rounded-full border px-3 py-1.5 text-xs font-semibold ${tieneEntrenador ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-neutral"}`}>
                        {tieneEntrenador
                            ? "Afegit"
                            : "Opcional"}
                    </span>
                </div>
            </section>

            {/* =================================================
                LISTA
            ================================================= */}

            <ListaParticipantes
                tipo="ENTRENADOR"
                participantes={participantes}
                configuracion={configuracion}
                observaciones={observaciones}
                titulo="Entrenador"
                descripcion="Només es pot indicar una persona com a entrenador de l'equip."
                singular="entrenador"
                plural="entrenadors"
                minimo={0}
                maximo={1}
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