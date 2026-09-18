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

export default function PasoJugadores({
    participantes,
    configuracion,
    observaciones,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const jugadores =
        participantes.filter(
            participante =>
                participante.tipo_participante ===
                "JUGADOR",
        );

    const masculinos =
        jugadores.filter(
            participante =>
                participante.genero ===
                "masculino",
        ).length;

    const femeninos =
        jugadores.filter(
            participante =>
                participante.genero ===
                "femenino",
        ).length;

    const minimoMasculino =
        configuracion.genero.minimos.masculino;

    const minimoFemenino =
        configuracion.genero.minimos.femenino;

    const cumpleMasculino =
        !configuracion.genero.activo ||
        masculinos >=
            minimoMasculino;

    const cumpleFemenino =
        !configuracion.genero.activo ||
        femeninos >=
            minimoFemenino;

    const reglaGeneroCumplida =
        cumpleMasculino &&
        cumpleFemenino;

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
                            <path d="M400-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0 320q-83 0-156-31.5T117-280q54-54 127-85.5T400-397q83 0 156 31.5T683-280q-54 57-127 88.5T400-160Zm320-320q-50 0-85-35t-35-85q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35Zm0 240q-26 0-50-3.5T622-254q21-26 35-55t21-61q21-5 42-6t40-1q47 0 91 14t81 41q-25 38-62 61t-80 31q-17-5-35-7.5t-35-2.5Z" />
                        </svg>
                    </span>

                    <div>
                        <h3 className="font-semibold text-neutral-titulos">
                            Jugadors de l'equip
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Afegeix totes les persones que participaran com a jugadores en aquesta edició.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                REGLA DE GÉNERO
            ================================================= */}

            {configuracion.genero.activo && (
                <section className={`rounded-2xl border p-5 ${reglaGeneroCumplida ? "border-primary/30 bg-primary/5" : "border-error/30 bg-error-container/15"}`}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className={reglaGeneroCumplida ? "text-primary" : "text-error"}>
                                    {reglaGeneroCumplida ? (
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
                                    Composició de l'equip
                                </h3>
                            </div>

                            <p className="mt-1 text-sm leading-6 text-neutral">
                                Aquesta edició estableix un mínim de participants de cada gènere.
                            </p>
                        </div>

                        <span className={`inline-flex w-max rounded-full border px-3 py-1.5 text-xs font-semibold ${reglaGeneroCumplida ? "border-primary/30 bg-primary/10 text-primary" : "border-error/30 bg-error-container/30 text-error-foreground"}`}>
                            {reglaGeneroCumplida
                                ? "Requisit complert"
                                : "Pendent"}
                        </span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <IndicadorGenero titulo="Masculí" actual={masculinos} minimo={minimoMasculino} />

                        <IndicadorGenero titulo="Femení" actual={femeninos} minimo={minimoFemenino} />
                    </div>
                </section>
            )}

            {/* =================================================
                LISTA DE JUGADORES
            ================================================= */}

            <ListaParticipantes tipo="JUGADOR" participantes={participantes} configuracion={configuracion} observaciones={observaciones} titulo="Jugadors" descripcion="Cada jugador ha de tenir les seves dades personals, curs, grup i correu electrònic correctament indicats." singular="jugador" plural="jugadors" minimo={configuracion.jugadores.minimo} maximo={configuracion.jugadores.maximo} mostrarCurso mostrarGenero={configuracion.genero.activo} cursoObligatorio generoObligatorio={configuracion.genero.activo} emailObligatorio soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={onCambiar} />
        </div>
    );
}

// ============================================================
// INDICADOR DE GÉNERO
// ============================================================

function IndicadorGenero({
    titulo,
    actual,
    minimo,
}: {
    titulo: string;
    actual: number;
    minimo: number;
}) {
    const cumplido =
        actual >=
        minimo;

    const faltan =
        Math.max(
            0,
            minimo -
                actual,
        );

    return (
        <div className="rounded-xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-neutral-titulos">
                    {titulo}
                </p>

                <span className={`text-sm font-bold ${cumplido ? "text-primary" : "text-error"}`}>
                    {actual} / {minimo}
                </span>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                <div className={`h-full rounded-full transition-[width] duration-300 ${cumplido ? "bg-primary" : "bg-error"}`} style={{ width: minimo <= 0 ? "100%" : `${Math.min(100, (actual / minimo) * 100)}%` }} />
            </div>

            <p className="mt-2 text-xs text-neutral">
                {cumplido
                    ? "Mínim complert"
                    : `Falten ${faltan} ${faltan === 1 ? "participant" : "participants"}`}
            </p>
        </div>
    );
}