import type {
    DatosFormularioEquipo,
    ObservacionCampo,
    ParticipanteFormulario,
    PermisosFormulario,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    formulario: DatosFormularioEquipo;
    permisos: PermisosFormulario;
    soloLectura: boolean;
    bloqueado: boolean;
    onCapitanCambiar: (capitanID: string | null) => void;
    onAccesoCapitanCambiar: (acceso: boolean) => void;
};

// ============================================================
// HELPERS
// ============================================================

function nombreCompleto(
    participante: ParticipanteFormulario,
) {
    return [
        participante.nombre,
        participante.apellido1,
        participante.apellido2,
    ]
        .map(valor =>
            valor.trim(),
        )
        .filter(Boolean)
        .join(" ");
}

function buscarObservacion(
    observaciones: readonly ObservacionCampo[],
    entidadTipo: string,
    entidadID: string | null,
    campo: string,
) {
    if (!entidadID) {
        return null;
    }

    const observacion =
        observaciones.find(
            entrada =>
                entrada.entidad_tipo === entidadTipo &&
                entrada.entidad_id === entidadID &&
                entrada.campo === campo &&
                entrada.estado !== "RESUELTA",
        ) ??
        observaciones.find(
            entrada =>
                entrada.entidad_id === entidadID &&
                entrada.campo === campo &&
                entrada.estado !== "RESUELTA",
        ) ??
        null;

    return observacion?.mensaje ?? null;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoCapitan({
    formulario,
    permisos,
    soloLectura,
    bloqueado,
    onCapitanCambiar,
    onAccesoCapitanCambiar,
}: Props) {
    const jugadores =
        formulario.participantes
            .filter(
                participante =>
                    participante.tipo_participante ===
                    "JUGADOR",
            )
            .sort(
                (
                    a,
                    b,
                ) =>
                    a.orden -
                    b.orden,
            );

    const capitan =
        formulario.equipo.capitan_id
            ? jugadores.find(
                  participante =>
                      participante.id ===
                      formulario.equipo.capitan_id,
              ) ??
              null
            : null;

    const observacionCapitan =
        buscarObservacion(
            formulario.observaciones,
            "equipo",
            formulario.equipo.id,
            "capitan_id",
        );

    const observacionAcceso =
        buscarObservacion(
            formulario.observaciones,
            "formulario",
            formulario.id,
            "acceso_capitan",
        );

    const deshabilitado =
        soloLectura ||
        bloqueado;

    const puedeGestionarAcceso =
        permisos.puede_cambiar_acceso_capitan &&
        !deshabilitado &&
        Boolean(capitan);

    // ========================================================
    // SELECCIONAR CAPITÁN
    // ========================================================

    function seleccionarCapitan(
        participante:
            ParticipanteFormulario,
    ) {
        if (
            deshabilitado ||
            !participante.id
        ) {
            return;
        }

        const mismo =
            formulario.equipo.capitan_id ===
            participante.id;

        onCapitanCambiar(
            mismo
                ? null
                : participante.id,
        );

        /*
         * Si se elimina el capitán seleccionado también
         * retiramos automáticamente su acceso al formulario.
         */
        if (
            mismo &&
            formulario.acceso_capitan
        ) {
            onAccesoCapitanCambiar(
                false,
            );
        }
    }

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
                            <path d="m480-120-58-52q-101-91-167.5-157T149-447.5Q110-500 95-544t-15-91q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 47-15 91t-54 96.5Q732-395 665.5-329T498-172l-18 16-18-16Z" />
                        </svg>
                    </span>

                    <div>
                        <h3 className="font-semibold text-neutral-titulos">
                            Capità de l'equip
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Selecciona un dels jugadors inscrits com a capità de l'equip.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                SIN JUGADORES
            ================================================= */}

            {jugadores.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/20 px-5 py-10 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-card text-neutral">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M400-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0 320q-83 0-156-31.5T117-280q54-54 127-85.5T400-397q83 0 156 31.5T683-280q-54 57-127 88.5T400-160Z" />
                        </svg>
                    </span>

                    <p className="mt-3 font-semibold text-neutral-titulos">
                        Encara no hi ha jugadors
                    </p>

                    <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-neutral">
                        Afegeix almenys un jugador abans de seleccionar el capità.
                    </p>
                </div>
            )}

            {/* =================================================
                SELECCIÓN
            ================================================= */}

            {jugadores.length > 0 && (
                <section className="space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Selecciona el capità
                            <span className="ml-1 text-error" aria-hidden="true">
                                *
                            </span>
                        </h3>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            El capità ha de ser una de les persones inscrites com a jugador de l'equip.
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        {jugadores.map(
                            (
                                jugador,
                                indice,
                            ) => {
                                const seleccionado =
                                    formulario.equipo.capitan_id ===
                                    jugador.id;

                                const nombre =
                                    nombreCompleto(
                                        jugador,
                                    ) ||
                                    `Jugador ${indice + 1}`;

                                const seleccionable =
                                    Boolean(
                                        jugador.id,
                                    );

                                return (
                                    <button key={jugador.id ?? `capita-${jugador.orden}-${indice}`} type="button" disabled={deshabilitado || !seleccionable} aria-pressed={seleccionado} onClick={() => seleccionarCapitan(jugador)} className={`relative flex min-h-20 items-center gap-3 rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60 ${seleccionado ? "border-primary bg-primary/10" : "border-border bg-background hover:border-primary/50 hover:bg-card/40"}`}>
                                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${seleccionado ? "bg-primary text-white" : "bg-card text-neutral"}`}>
                                            {indice +
                                                1}
                                        </span>

                                        <span className="min-w-0 flex-1">
                                            <span className={`block truncate text-sm font-semibold ${seleccionado ? "text-primary" : "text-neutral-titulos"}`}>
                                                {nombre}
                                            </span>

                                            <span className="mt-1 block truncate text-xs text-neutral">
                                                {jugador.email.trim() || "Sense correu electrònic"}
                                            </span>
                                        </span>

                                        <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${seleccionado ? "border-primary bg-primary" : "border-border"}`}>
                                            {seleccionado && (
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-3 w-3 fill-current text-white">
                                                    <path d="m382-240-228-228 57-57 171 171 367-367 57 57-424 424Z" />
                                                </svg>
                                            )}
                                        </span>
                                    </button>
                                );
                            },
                        )}
                    </div>

                    {observacionCapitan && (
                        <div className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-error" aria-hidden="true">
                                <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                            </svg>

                            <div>
                                <p className="font-semibold">
                                    Motiu de la revisió
                                </p>

                                <p className="mt-0.5 text-xs leading-5">
                                    {observacionCapitan}
                                </p>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* =================================================
                CAPITÁN SELECCIONADO
            ================================================= */}

            {capitan && (
                <section className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                <path d="M480-120 280-360l80-280h240l80 280-200 240Zm0-125 113-135-48-180H415l-48 180 113 135Z" />
                            </svg>
                        </span>

                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                Capità seleccionat
                            </p>

                            <p className="mt-1 font-semibold text-neutral-titulos">
                                {nombreCompleto(
                                    capitan,
                                )}
                            </p>

                            <p className="mt-1 break-all text-sm text-neutral">
                                {capitan.email ||
                                    "Sense correu electrònic"}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {/* =================================================
                ACCESO DEL CAPITÁN
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card/20 p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-neutral-titulos">
                                Accés del capità al formulari
                            </h3>

                            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral">
                                Opcional
                            </span>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-neutral">
                            Pots permetre que el capità accedeixi a aquesta mateixa inscripció amb el seu propi compte.
                        </p>

                        <p className="mt-2 text-xs leading-5 text-neutral">
                            Per poder accedir-hi, el correu del compte del capità haurà de coincidir amb el correu indicat a la seva fitxa.
                        </p>
                    </div>

                    <label className={`relative inline-flex shrink-0 items-center gap-3 ${puedeGestionarAcceso ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}>
                        <input type="checkbox" checked={formulario.acceso_capitan} disabled={!puedeGestionarAcceso} onChange={evento => onAccesoCapitanCambiar(evento.target.checked)} className="peer sr-only" />

                        <span className="relative h-7 w-12 rounded-full bg-border transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30 after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />

                        <span className="text-sm font-semibold text-neutral-titulos">
                            {formulario.acceso_capitan
                                ? "Permès"
                                : "No permès"}
                        </span>
                    </label>
                </div>

                {!capitan && (
                    <div className="mt-4 rounded-xl border border-border bg-background px-4 py-3 text-xs leading-5 text-neutral">
                        Primer has de seleccionar un capità per poder concedir-li accés al formulari.
                    </div>
                )}

                {capitan &&
                    !capitan.email.trim() && (
                        <div className="mt-4 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-xs leading-5 text-error-foreground">
                            El capità necessita un correu electrònic vàlid per poder accedir al formulari.
                        </div>
                    )}

                {observacionAcceso && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-error" aria-hidden="true">
                            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                        </svg>

                        <div>
                            <p className="font-semibold">
                                Motiu de la revisió
                            </p>

                            <p className="mt-0.5 text-xs leading-5">
                                {observacionAcceso}
                            </p>
                        </div>
                    </div>
                )}
            </section>

            {/* =================================================
                INFORMACIÓN DE PERMISOS
            ================================================= */}

            {permisos.capitan && (
                <div className="rounded-xl border border-secondary/30 bg-secondary/10 px-4 py-3">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-200h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Z" />
                            </svg>
                        </span>

                        <div>
                            <p className="text-sm font-semibold text-neutral-titulos">
                                Has accedit com a capità
                            </p>

                            <p className="mt-1 text-xs leading-5 text-neutral">
                                El propietari de la inscripció t'ha concedit accés a aquest formulari. Només el propietari pot modificar aquest permís.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}