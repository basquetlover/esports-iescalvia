import type {
    ConfiguracionEquipos,
    DatosFormularioEquipo,
    EdicionFormulario,
    ParticipanteFormulario,
    TorneoFormulario,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    formulario: DatosFormularioEquipo;
    configuracion: ConfiguracionEquipos;
    torneo: TorneoFormulario | null;
    edicion: EdicionFormulario;
    soloLectura: boolean;
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
        .map(
            valor =>
                valor.trim(),
        )
        .filter(
            Boolean,
        )
        .join(
            " ",
        );
}

function participantesTipo(
    participantes: readonly ParticipanteFormulario[],
    tipo: ParticipanteFormulario["tipo_participante"],
) {
    return participantes
        .filter(
            participante =>
                participante.tipo_participante ===
                tipo,
        )
        .sort(
            (
                a,
                b,
            ) =>
                a.orden -
                b.orden,
        );
}

function campoCompleto(
    valor: string,
) {
    return Boolean(
        valor.trim(),
    );
}

function cumpleParticipante(
    participante: ParticipanteFormulario,
    configuracion: ConfiguracionEquipos,
) {
    if (
        !campoCompleto(
            participante.nombre,
        ) ||
        !campoCompleto(
            participante.apellido1,
        ) ||
        !campoCompleto(
            participante.email,
        )
    ) {
        return false;
    }

    if (
        participante.tipo_participante ===
            "JUGADOR" ||
        participante.tipo_participante ===
            "PROFESOR"
    ) {
        if (
            !campoCompleto(
                participante.curso,
            ) ||
            !campoCompleto(
                participante.grupo,
            )
        ) {
            return false;
        }
    }

    if (
        participante.tipo_participante ===
            "JUGADOR" &&
        configuracion.genero.activo &&
        participante.genero ===
            null
    ) {
        return false;
    }

    if (
        participante.tipo_participante ===
            "PROFESOR" &&
        configuracion.genero.activo &&
        configuracion.profesores.cuentan_como_jugador &&
        participante.genero ===
            null
    ) {
        return false;
    }

    return true;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoResumen({
    formulario,
    configuracion,
    torneo,
    edicion,
    soloLectura,
}: Props) {
    const jugadores =
        participantesTipo(
            formulario.participantes,
            "JUGADOR",
        );

    const profesores =
        participantesTipo(
            formulario.participantes,
            "PROFESOR",
        );

    const entrenadores =
        participantesTipo(
            formulario.participantes,
            "ENTRENADOR",
        );

    const staff =
        participantesTipo(
            formulario.participantes,
            "STAFF",
        );

    const capitan =
        formulario.equipo.capitan_id
            ? jugadores.find(
                  jugador =>
                      jugador.id ===
                      formulario.equipo.capitan_id,
              ) ??
              null
            : null;

    // ========================================================
    // RECUENTO DE JUGADORES
    // ========================================================

    const profesoresQueCuentan =
        configuracion.profesores.permitidos &&
        configuracion.profesores.cuentan_como_jugador
            ? profesores
            : [];

    const participantesQueCuentan =
        [
            ...jugadores,
            ...profesoresQueCuentan,
        ];

    const totalComputable =
        participantesQueCuentan.length;

    const minimoJugadores =
        configuracion.jugadores.minimo;

    const maximoJugadores =
        configuracion.jugadores.maximo;

    const cumpleMinimoJugadores =
        minimoJugadores ===
            null ||
        totalComputable >=
            minimoJugadores;

    const cumpleMaximoJugadores =
        maximoJugadores ===
            null ||
        totalComputable <=
            maximoJugadores;

    // ========================================================
    // GÉNERO
    // ========================================================

    const masculinos =
        participantesQueCuentan.filter(
            participante =>
                participante.genero ===
                "masculino",
        ).length;

    const femeninos =
        participantesQueCuentan.filter(
            participante =>
                participante.genero ===
                "femenino",
        ).length;

    const cumpleGenero =
        !configuracion.genero.activo ||
        (
            masculinos >=
                configuracion.genero.minimos.masculino &&
            femeninos >=
                configuracion.genero.minimos.femenino
        );

    // ========================================================
    // PROFESORES
    // ========================================================

    const cumpleProfesores =
        !configuracion.profesores.permitidos ||
        (
            profesores.length >=
                configuracion.profesores.minimo &&
            (
                configuracion.profesores.maximo <=
                    0 ||
                profesores.length <=
                    configuracion.profesores.maximo
            )
        );

    // ========================================================
    // STAFF
    // ========================================================

    const cumpleStaff =
        !configuracion.staff.permitido ||
        (
            staff.length >=
                configuracion.staff.minimo &&
            (
                configuracion.staff.maximo <=
                    0 ||
                staff.length <=
                    configuracion.staff.maximo
            )
        );

    // ========================================================
    // ENTRENADOR
    // ========================================================

    const cumpleEntrenador =
        !configuracion.entrenador.permitido ||
        entrenadores.length <=
            1;

    // ========================================================
    // DATOS
    // ========================================================

    const participantesCompletos =
        formulario.participantes.every(
            participante =>
                cumpleParticipante(
                    participante,
                    configuracion,
                ),
        );

    const equipoCompleto =
        campoCompleto(
            formulario.equipo.nombre,
        ) &&
        campoCompleto(
            formulario.email_contacto,
        );

    const capitanCompleto =
        Boolean(
            capitan,
        );

    const puedeEnviar =
        equipoCompleto &&
        participantesCompletos &&
        cumpleMinimoJugadores &&
        cumpleMaximoJugadores &&
        cumpleGenero &&
        cumpleProfesores &&
        cumpleStaff &&
        cumpleEntrenador &&
        capitanCompleto;

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="space-y-8">
            {/* =================================================
                CABECERA
            ================================================= */}

            <div className="rounded-2xl border border-border bg-card/30 p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80Zm0-160h200v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z" />
                        </svg>
                    </span>

                    <div>
                        <h3 className="font-semibold text-neutral-titulos">
                            Revisa la inscripció
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Comprova totes les dades abans d'enviar la inscripció a revisió.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                ESTADO GENERAL
            ================================================= */}

            <section className={`rounded-2xl border p-5 ${puedeEnviar ? "border-primary/30 bg-primary/5" : "border-error/30 bg-error-container/15"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className={puedeEnviar ? "text-primary" : "text-error"}>
                                {puedeEnviar ? (
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
                                {puedeEnviar
                                    ? "La inscripció està preparada"
                                    : "Encara hi ha dades pendents"}
                            </h3>
                        </div>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            {puedeEnviar
                                ? "Les dades bàsiques compleixen els requisits configurats per aquesta edició."
                                : "Revisa els apartats marcats abans d'enviar el formulari."}
                        </p>
                    </div>

                    <span className={`inline-flex w-max rounded-full border px-3 py-1.5 text-xs font-semibold ${puedeEnviar ? "border-primary/30 bg-primary/10 text-primary" : "border-error/30 bg-error-container/30 text-error-foreground"}`}>
                        {puedeEnviar
                            ? "Preparat"
                            : "Incomplet"}
                    </span>
                </div>
            </section>

            {/* =================================================
                TORNEO / EDICIÓN
            ================================================= */}

            <section className="rounded-2xl border border-border bg-background p-5">
                <h3 className="text-sm font-semibold text-neutral-titulos">
                    Competició
                </h3>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Dato titulo="Torneig" valor={torneo?.nombre ?? "Torneig"} />

                    <Dato titulo="Edició" valor={edicion.nombre} />

                    {torneo?.deporte && (
                        <Dato titulo="Esport" valor={torneo.deporte} />
                    )}

                    {edicion.sede && (
                        <Dato titulo="Seu" valor={edicion.sede} />
                    )}
                </div>
            </section>

            {/* =================================================
                EQUIPO
            ================================================= */}

            <section className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold text-neutral-titulos">
                        Equip
                    </h3>

                    <Indicador correcto={equipoCompleto} />
                </div>

                <div className="mt-4 grid gap-5 sm:grid-cols-[100px_minmax(0,1fr)]">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card">
                        {formulario.equipo.escudo ? (
                            <img src={formulario.equipo.escudo} alt={`Escut de ${formulario.equipo.nombre || "l'equip"}`} className="h-full w-full object-contain p-2" />
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-10 w-10 fill-current text-neutral/50" aria-hidden="true">
                                <path d="M480-80q-139-35-229.5-159.5T160-520v-240l320-120 320 120v240q0 156-90.5 280.5T480-80Zm0-84q104-33 172-132t68-224v-185l-240-90-240 90v185q0 125 68 224t172 132Z" />
                            </svg>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Dato titulo="Nom de l'equip" valor={formulario.equipo.nombre || "No indicat"} />

                        <Dato titulo="Correu de contacte" valor={formulario.email_contacto || "No indicat"} />
                    </div>
                </div>
            </section>

            {/* =================================================
                REQUISITOS
            ================================================= */}

            <section className="rounded-2xl border border-border bg-background p-5">
                <h3 className="text-sm font-semibold text-neutral-titulos">
                    Requisits de l'edició
                </h3>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Requisit titulo="Jugadors" descripcion={`${totalComputable} participants computables`} correcto={cumpleMinimoJugadores && cumpleMaximoJugadores} />

                    <Requisit titulo="Dades dels participants" descripcion={participantesCompletos ? "Totes les fitxes estan completes" : "Hi ha fitxes incompletes"} correcto={participantesCompletos} />

                    {configuracion.genero.activo && (
                        <Requisit titulo="Regla de gènere" descripcion={`${masculinos} masculins · ${femeninos} femenins`} correcto={cumpleGenero} />
                    )}

                    {configuracion.profesores.permitidos && (
                        <Requisit titulo="Professorat" descripcion={`${profesores.length} ${profesores.length === 1 ? "professor" : "professors"}`} correcto={cumpleProfesores} />
                    )}

                    {configuracion.entrenador.permitido && (
                        <Requisit titulo="Entrenador" descripcion={`${entrenadores.length} ${entrenadores.length === 1 ? "entrenador" : "entrenadors"}`} correcto={cumpleEntrenador} />
                    )}

                    {configuracion.staff.permitido && (
                        <Requisit titulo="Staff" descripcion={`${staff.length} ${staff.length === 1 ? "membre" : "membres"}`} correcto={cumpleStaff} />
                    )}

                    <Requisit titulo="Capità" descripcion={capitan ? nombreCompleto(capitan) : "No seleccionat"} correcto={capitanCompleto} />
                </div>
            </section>

            {/* =================================================
                JUGADORES
            ================================================= */}

            <ResumenParticipantes titulo="Jugadors" participantes={jugadores} />

            {/* =================================================
                PROFESORES
            ================================================= */}

            {configuracion.profesores.permitidos && (
                <ResumenParticipantes titulo="Professorat" participantes={profesores} />
            )}

            {/* =================================================
                ENTRENADOR
            ================================================= */}

            {configuracion.entrenador.permitido && (
                <ResumenParticipantes titulo="Entrenador" participantes={entrenadores} />
            )}

            {/* =================================================
                STAFF
            ================================================= */}

            {configuracion.staff.permitido && (
                <ResumenParticipantes titulo="Staff" participantes={staff} />
            )}

            {/* =================================================
                CAPITÁN
            ================================================= */}

            <section className="rounded-2xl border border-border bg-background p-5">
                <div className="flex items-center justify-between gap-4">
                    <h3 className="text-sm font-semibold text-neutral-titulos">
                        Capità i accés
                    </h3>

                    <Indicador correcto={capitanCompleto} />
                </div>

                {capitan ? (
                    <div className="mt-4 rounded-xl border border-border bg-card/30 p-4">
                        <p className="font-semibold text-neutral-titulos">
                            {nombreCompleto(capitan)}
                        </p>

                        <p className="mt-1 text-sm text-neutral">
                            {capitan.email || "Sense correu electrònic"}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                            <span className={`h-2.5 w-2.5 rounded-full ${formulario.acceso_capitan ? "bg-primary" : "bg-neutral/40"}`} />

                            <span className="text-xs font-medium text-neutral">
                                {formulario.acceso_capitan
                                    ? "Pot accedir al formulari"
                                    : "No té accés al formulari"}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p className="mt-4 text-sm text-error">
                        Encara no has seleccionat cap capità.
                    </p>
                )}
            </section>

            {/* =================================================
                OBSERVACIONES
            ================================================= */}

            {formulario.observaciones.length > 0 && (
                <section className="rounded-2xl border border-error/30 bg-error-container/15 p-5">
                    <h3 className="font-semibold text-error-foreground">
                        Observacions de la revisió
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-error-foreground">
                        Revisa aquests punts abans de tornar a enviar la inscripció.
                    </p>

                    <div className="mt-4 space-y-2">
                        {formulario.observaciones.map(
                            observacion => (
                                <div key={observacion.id} className="rounded-xl border border-error/20 bg-background px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-error">
                                        {observacion.campo}
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-neutral-titulos">
                                        {observacion.mensaje}
                                    </p>
                                </div>
                            ),
                        )}
                    </div>
                </section>
            )}

            {/* =================================================
                AVISO FINAL
            ================================================= */}

            {!soloLectura && (
                <div className="rounded-xl border border-border bg-card/30 p-4">
                    <div className="flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-5 w-5 shrink-0 fill-current text-primary" aria-hidden="true">
                            <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                        </svg>

                        <div>
                            <p className="text-sm font-semibold text-neutral-titulos">
                                Abans d'enviar
                            </p>

                            <p className="mt-1 text-xs leading-5 text-neutral">
                                En enviar la inscripció quedarà en revisió i no es podrà modificar fins que sigui aprovada o denegada.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ============================================================
// DATO
// ============================================================

function Dato({
    titulo,
    valor,
}: {
    titulo: string;
    valor: string;
}) {
    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral">
                {titulo}
            </p>

            <p className="mt-1 wrap-break-words text-sm font-semibold text-neutral-titulos">
                {valor}
            </p>
        </div>
    );
}

// ============================================================
// INDICADOR
// ============================================================

function Indicador({
    correcto,
}: {
    correcto: boolean;
}) {
    return (
        <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${correcto ? "bg-primary/10 text-primary" : "bg-error-container text-error"}`}>
            {correcto ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="m382-240-228-228 57-57 171 171 367-367 57 57-424 424Z" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                    <path d="M440-280h80v-80h-80v80Zm0-160h80v-240h-80v240Z" />
                </svg>
            )}
        </span>
    );
}

// ============================================================
// REQUISITO
// ============================================================

function Requisit({
    titulo,
    descripcion,
    correcto,
}: {
    titulo: string;
    descripcion: string;
    correcto: boolean;
}) {
    return (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-card/20 p-4">
            <Indicador correcto={correcto} />

            <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-titulos">
                    {titulo}
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral">
                    {descripcion}
                </p>
            </div>
        </div>
    );
}

// ============================================================
// LISTA RESUMEN
// ============================================================

function ResumenParticipantes({
    titulo,
    participantes,
}: {
    titulo: string;
    participantes: ParticipanteFormulario[];
}) {
    return (
        <section className="rounded-2xl border border-border bg-background p-5">
            <div className="flex items-center justify-between gap-4">
                <h3 className="text-sm font-semibold text-neutral-titulos">
                    {titulo}
                </h3>

                <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-neutral">
                    {participantes.length}
                </span>
            </div>

            {participantes.length === 0 ? (
                <p className="mt-4 text-sm text-neutral">
                    No hi ha participants en aquest apartat.
                </p>
            ) : (
                <div className="mt-4 divide-y divide-border">
                    {participantes.map(
                        (
                            participante,
                            indice,
                        ) => (
                            <div key={participante.id ?? `${participante.tipo_participante}-${indice}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-neutral-titulos">
                                        {nombreCompleto(participante) || `Participant ${indice + 1}`}
                                    </p>

                                    <p className="mt-0.5 truncate text-xs text-neutral">
                                        {participante.email || "Sense correu electrònic"}
                                    </p>
                                </div>

                                {(participante.curso || participante.grupo) && (
                                    <span className="w-max rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-neutral">
                                        {[participante.curso, participante.grupo].filter(Boolean).join(" · ")}
                                    </span>
                                )}
                            </div>
                        ),
                    )}
                </div>
            )}
        </section>
    );
}