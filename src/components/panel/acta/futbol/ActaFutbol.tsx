import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    anularEventoLocal,
    leerActaLocal,
    registrarEventoLocal,
    type EventoLocalActa,
} from "@utils/acta/localStorage";

// ============================================================
// TIPOS
// ============================================================

type Jugador = {
    id: string;
    equipo_id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    tipo_participante: string | null;
    validacion_estado: string | null;
    orden: number | null;
    activo: boolean | null;
};

type Equipo = {
    id: string;
    nombre: string;
    escudo: string | null;
    jugadores: Jugador[];
};

type Lado = {
    lado:
        | "LOCAL"
        | "VISITANTE";

    resuelto: boolean;

    equipo:
        Equipo | null;
};

type Partido = {
    id: string;
    codigo: string;
    nombre: string | null;
    jornada: number | null;
    estado: string;
    fecha_hora: string | null;
    pista: string | null;
};

type Estructura = {
    fase: {
        nombre: string;
        tipo: string;
    } | null;

    grupo: {
        nombre: string;
    } | null;

    ronda: {
        nombre: string;
        tipo: string;
    } | null;
};

type Acta = {
    id: string;
    estado: string;
    version: number;
} | null;

type TipoEventoFutbol =
    | "GOL"
    | "TARJETA_AMARILLA"
    | "TARJETA_ROJA";

type Props = {
    partido: Partido;

    estructura: Estructura;

    equipos: {
        local: Lado;
        visitante: Lado;
    };

    acta: Acta;

    editable: boolean;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function ActaFutbol({
    partido,
    estructura,
    equipos,
    acta,
    editable,
}: Props) {
    const [
        eventos,
        setEventos,
    ] =
        useState<
            EventoLocalActa[]
        >(
            [],
        );

    const [
        cargandoLocal,
        setCargandoLocal,
    ] =
        useState(
            true,
        );

    const [
        errorLocal,
        setErrorLocal,
    ] =
        useState<
            string | null
        >(
            null,
        );

    const [
        minuto,
        setMinuto,
    ] =
        useState(
            "",
        );

    // ========================================================
    // LOCALSTORAGE
    // ========================================================

    useEffect(
        () => {
            try {
                const estado =
                    leerActaLocal(
                        partido.id,
                    );

                setEventos(
                    estado.eventos,
                );

                setErrorLocal(
                    null,
                );
            } catch (
                error
            ) {
                setErrorLocal(
                    error instanceof
                        Error
                        ? error.message
                        : "No s'ha pogut carregar la còpia local.",
                );
            } finally {
                setCargandoLocal(
                    false,
                );
            }
        },
        [
            partido.id,
        ],
    );

    // ========================================================
    // EVENTOS ACTIVOS
    // ========================================================

    const activos =
        useMemo(
            () =>
                eventos.filter(
                    evento =>
                        evento.estado ===
                        "ACTIVO",
                ),
            [
                eventos,
            ],
        );

    // ========================================================
    // MARCADOR
    // ========================================================

    const golesLocal =
        contarEquipo(
            activos,
            equipos.local
                .equipo?.id ??
                null,
            "GOL",
        );

    const golesVisitante =
        contarEquipo(
            activos,
            equipos.visitante
                .equipo?.id ??
                null,
            "GOL",
        );

    // ========================================================
    // REGISTRAR
    // ========================================================

    function registrar(
        tipo:
            TipoEventoFutbol,

        equipo:
            Equipo,

        jugador:
            Jugador,
    ) {
        if (
            !editable
        ) {
            setErrorLocal(
                "No tens el control de l'acta.",
            );

            return;
        }

        try {
            const resultado =
                registrarEventoLocal(
                    partido.id,
                    {
                        tipoEvento:
                            tipo,

                        equipoID:
                            equipo.id,

                        equipoNombre:
                            equipo.nombre,

                        jugadorID:
                            jugador.id,

                        jugadorNombre:
                            nombreJugador(
                                jugador,
                            ),

                        minuto:
                            leerMinuto(
                                minuto,
                            ),

                        periodo:
                            null,

                        tiempoJuegoSegundos:
                            null,

                        datos:
                            {},
                    },
                );

            setEventos(
                resultado
                    .estado
                    .eventos,
            );

            setErrorLocal(
                null,
            );
        } catch (
            error
        ) {
            setErrorLocal(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut registrar la incidència.",
            );
        }
    }

    // ========================================================
    // ANULAR
    // ========================================================

    function anular(
        id:
            string,
    ) {
        if (
            !editable
        ) {
            return;
        }

        try {
            const resultado =
                anularEventoLocal(
                    partido.id,
                    id,
                );

            setEventos(
                resultado
                    .estado
                    .eventos,
            );
        } catch (
            error
        ) {
            setErrorLocal(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut anul·lar la incidència.",
            );
        }
    }

    if (
        cargandoLocal
    ) {
        return (
            <div className="p-10 text-center">
                <span
                    className="
                        material-symbols-rounded
                        animate-spin
                        text-4xl
                        text-primary
                    "
                >
                    progress_activity
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* =================================================
                MODO EDICIÓN
            ================================================= */}

            {!editable && (
                <div
                    className="
                        flex
                        items-start
                        gap-3
                        rounded-xl
                        border
                        border-amber-200
                        bg-amber-50
                        p-4
                        text-amber-900
                    "
                >
                    <span className="material-symbols-rounded">
                        lock
                    </span>

                    <div>
                        <p className="text-sm font-bold">
                            Acta en mode consulta
                        </p>

                        <p className="mt-1 text-xs">
                            Inicia l'acta o recupera
                            el control per registrar
                            incidències.
                        </p>
                    </div>
                </div>
            )}

            {errorLocal && (
                <div
                    className="
                        rounded-xl
                        border
                        border-red-200
                        bg-red-50
                        p-4
                        text-sm
                        text-red-700
                    "
                >
                    {errorLocal}
                </div>
            )}

            {/* =================================================
                PARTIDO
            ================================================= */}

            <section
                className="
                    rounded-xl
                    border
                    border-border
                    bg-card
                    p-5
                "
            >
                <div
                    className="
                        flex
                        flex-col
                        gap-4
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                    "
                >
                    <div>
                        <p
                            className="
                                text-xs
                                font-bold
                                uppercase
                                tracking-[0.14em]
                                text-primary
                            "
                        >
                            Futbol ·{" "}
                            {nombreEstructura(
                                estructura,
                            )}
                        </p>

                        <h2
                            className="
                                mt-2
                                text-2xl
                                font-bold
                                text-neutral-titulos
                            "
                        >
                            {partido.nombre ||
                                partido.codigo}
                        </h2>
                    </div>

                    <div
                        className="
                            grid
                            gap-2
                            text-sm
                            text-neutral
                            sm:grid-cols-2
                        "
                    >
                        <Info
                            icono="calendar_month"
                            texto={
                                formatFecha(
                                    partido.fecha_hora,
                                )
                            }
                        />

                        <Info
                            icono="location_on"
                            texto={
                                partido.pista ||
                                "Pista pendent"
                            }
                        />

                        <Info
                            icono="description"
                            texto={
                                acta
                                    ? `Acta: ${acta.estado}`
                                    : "Acta no iniciada"
                            }
                        />
                    </div>
                </div>
            </section>

            {/* =================================================
                MARCADOR
            ================================================= */}

            <section
                className="
                    grid
                    overflow-hidden
                    rounded-xl
                    border
                    border-border
                    bg-card
                    md:grid-cols-[1fr_auto_1fr]
                "
            >
                <EquipoMarcador
                    lado="LOCAL"
                    equipo={
                        equipos.local
                            .equipo
                    }
                />

                <div
                    className="
                        flex
                        items-center
                        justify-center
                        border-y
                        border-border
                        bg-background
                        px-8
                        py-8
                        md:border-x
                        md:border-y-0
                    "
                >
                    <div
                        className="
                            flex
                            items-center
                            gap-5
                        "
                    >
                        <span
                            className="
                                text-5xl
                                font-black
                                text-neutral-titulos
                            "
                        >
                            {golesLocal}
                        </span>

                        <span
                            className="
                                text-2xl
                                font-bold
                                text-neutral
                            "
                        >
                            -
                        </span>

                        <span
                            className="
                                text-5xl
                                font-black
                                text-neutral-titulos
                            "
                        >
                            {golesVisitante}
                        </span>
                    </div>
                </div>

                <EquipoMarcador
                    lado="VISITANT"
                    equipo={
                        equipos
                            .visitante
                            .equipo
                    }
                />
            </section>

            {/* =================================================
                MINUTO
            ================================================= */}

            <section
                className="
                    flex
                    flex-col
                    gap-4
                    rounded-xl
                    border
                    border-border
                    bg-card
                    p-5
                    sm:flex-row
                    sm:items-end
                    sm:justify-between
                "
            >
                <div>
                    <h3
                        className="
                            font-bold
                            text-neutral-titulos
                        "
                    >
                        Registrar incidència
                    </h3>

                    <p
                        className="
                            mt-1
                            text-sm
                            text-neutral
                        "
                    >
                        Gol, targeta groga
                        o targeta vermella.
                    </p>
                </div>

                <label className="w-full sm:w-40">
                    <span
                        className="
                            mb-1
                            block
                            text-xs
                            font-semibold
                            text-neutral
                        "
                    >
                        Minut opcional
                    </span>

                    <input
                        type="number"
                        min="0"
                        max="200"
                        disabled={
                            !editable
                        }
                        value={
                            minuto
                        }
                        onChange={
                            evento =>
                                setMinuto(
                                    evento.target.value,
                                )
                        }
                        className="
                            h-10
                            w-full
                            rounded-lg
                            border
                            border-border
                            bg-background
                            px-3
                            text-sm
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    />
                </label>
            </section>

            {/* =================================================
                EQUIPOS + HISTORIAL
            ================================================= */}

            <div
                className="
                    grid
                    gap-5
                    2xl:grid-cols-[minmax(0,1fr)_400px]
                "
            >
                <div
                    className="
                        grid
                        gap-5
                        xl:grid-cols-2
                    "
                >
                    <Plantilla
                        titulo="LOCAL"
                        equipo={
                            equipos.local
                                .equipo
                        }
                        eventos={
                            activos
                        }
                        editable={
                            editable
                        }
                        onEvento={
                            registrar
                        }
                    />

                    <Plantilla
                        titulo="VISITANT"
                        equipo={
                            equipos
                                .visitante
                                .equipo
                        }
                        eventos={
                            activos
                        }
                        editable={
                            editable
                        }
                        onEvento={
                            registrar
                        }
                    />
                </div>

                <Historial
                    eventos={
                        eventos
                    }
                    editable={
                        editable
                    }
                    onAnular={
                        anular
                    }
                />
            </div>
        </div>
    );
}

// ============================================================
// PLANTILLA
// ============================================================

function Plantilla({
    titulo,
    equipo,
    eventos,
    editable,
    onEvento,
}: {
    titulo: string;

    equipo: Equipo | null;

    eventos:
        EventoLocalActa[];

    editable: boolean;

    onEvento: (
        tipo:
            TipoEventoFutbol,
        equipo:
            Equipo,
        jugador:
            Jugador,
    ) => void;
}) {
    return (
        <section
            className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
            "
        >
            <div
                className="
                    border-b
                    border-border
                    p-4
                "
            >
                <p
                    className="
                        text-xs
                        font-bold
                        uppercase
                        tracking-[0.14em]
                        text-neutral
                    "
                >
                    {titulo}
                </p>

                <h3
                    className="
                        mt-1
                        font-bold
                        text-neutral-titulos
                    "
                >
                    {equipo
                        ?.nombre ??
                        "Equip per determinar"}
                </h3>
            </div>

            {!equipo ? (
                <p
                    className="
                        p-6
                        text-sm
                        text-neutral
                    "
                >
                    Equip pendent.
                </p>
            ) : (
                <div
                    className="
                        divide-y
                        divide-border
                    "
                >
                    {equipo.jugadores.map(
                        jugador => (
                            <JugadorFila
                                key={
                                    jugador.id
                                }
                                jugador={
                                    jugador
                                }
                                equipo={
                                    equipo
                                }
                                eventos={
                                    eventos
                                }
                                editable={
                                    editable
                                }
                                onEvento={
                                    onEvento
                                }
                            />
                        ),
                    )}
                </div>
            )}
        </section>
    );
}

// ============================================================
// JUGADOR
// ============================================================

function JugadorFila({
    jugador,
    equipo,
    eventos,
    editable,
    onEvento,
}: {
    jugador: Jugador;

    equipo: Equipo;

    eventos:
        EventoLocalActa[];

    editable: boolean;

    onEvento: (
        tipo:
            TipoEventoFutbol,
        equipo:
            Equipo,
        jugador:
            Jugador,
    ) => void;
}) {
    const goles =
        contarJugador(
            eventos,
            jugador.id,
            "GOL",
        );

    const amarillas =
        contarJugador(
            eventos,
            jugador.id,
            "TARJETA_AMARILLA",
        );

    const rojas =
        contarJugador(
            eventos,
            jugador.id,
            "TARJETA_ROJA",
        );

    return (
        <div className="p-4">
            <div
                className="
                    flex
                    items-center
                    justify-between
                    gap-3
                "
            >
                <p
                    className="
                        min-w-0
                        truncate
                        text-sm
                        font-semibold
                        text-neutral-titulos
                    "
                >
                    {nombreJugador(
                        jugador,
                    )}
                </p>

                <div
                    className="
                        flex
                        shrink-0
                        gap-2
                        text-xs
                        font-bold
                    "
                >
                    {goles >
                        0 && (
                        <span>
                            ⚽ {goles}
                        </span>
                    )}

                    {amarillas >
                        0 && (
                        <span>
                            🟨 {amarillas}
                        </span>
                    )}

                    {rojas >
                        0 && (
                        <span>
                            🟥 {rojas}
                        </span>
                    )}
                </div>
            </div>

            <div
                className="
                    mt-3
                    grid
                    grid-cols-3
                    gap-2
                "
            >
                <Boton
                    disabled={
                        !editable
                    }
                    texto="Gol"
                    onClick={() =>
                        onEvento(
                            "GOL",
                            equipo,
                            jugador,
                        )
                    }
                />

                <Boton
                    disabled={
                        !editable
                    }
                    texto="Groga"
                    onClick={() =>
                        onEvento(
                            "TARJETA_AMARILLA",
                            equipo,
                            jugador,
                        )
                    }
                />

                <Boton
                    disabled={
                        !editable
                    }
                    texto="Vermella"
                    onClick={() =>
                        onEvento(
                            "TARJETA_ROJA",
                            equipo,
                            jugador,
                        )
                    }
                />
            </div>
        </div>
    );
}

// ============================================================
// HISTORIAL
// ============================================================

function Historial({
    eventos,
    editable,
    onAnular,
}: {
    eventos:
        EventoLocalActa[];

    editable: boolean;

    onAnular: (
        id:
            string,
    ) => void;
}) {
    const lista =
        [
            ...eventos,
        ].reverse();

    return (
        <section
            className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
            "
        >
            <div
                className="
                    border-b
                    border-border
                    p-4
                "
            >
                <h3
                    className="
                        font-bold
                        text-neutral-titulos
                    "
                >
                    Historial local
                </h3>

                <p
                    className="
                        mt-1
                        text-xs
                        text-neutral
                    "
                >
                    {eventos.length} incidències
                </p>
            </div>

            {lista.length ===
            0 ? (
                <p
                    className="
                        p-6
                        text-center
                        text-sm
                        text-neutral
                    "
                >
                    Encara no hi ha incidències.
                </p>
            ) : (
                <div
                    className="
                        divide-y
                        divide-border
                    "
                >
                    {lista.map(
                        evento => (
                            <div
                                key={
                                    evento
                                        .clienteEventoID
                                }
                                className={`
                                    flex
                                    items-start
                                    justify-between
                                    gap-3
                                    p-4
                                    ${
                                        evento.estado ===
                                        "ANULADO"
                                            ? "opacity-50"
                                            : ""
                                    }
                                `}
                            >
                                <div>
                                    <p
                                        className="
                                            text-sm
                                            font-bold
                                            text-neutral-titulos
                                        "
                                    >
                                        {nombreEvento(
                                            evento.tipoEvento,
                                        )}

                                        {evento.minuto !==
                                            null
                                            ? ` · ${evento.minuto}'`
                                            : ""}
                                    </p>

                                    <p
                                        className="
                                            mt-1
                                            text-xs
                                            text-neutral
                                        "
                                    >
                                        {evento.jugadorNombre}
                                    </p>

                                    <p
                                        className="
                                            text-xs
                                            text-neutral
                                        "
                                    >
                                        {evento.equipoNombre}
                                    </p>

                                    <p
                                        className="
                                            mt-1
                                            text-[10px]
                                            font-semibold
                                            uppercase
                                            text-neutral
                                        "
                                    >
                                        {evento.estado ===
                                        "ANULADO"
                                            ? "Anul·lat"
                                            : evento
                                                  .sincronizacionCreacion
                                                  .estado}
                                    </p>
                                </div>

                                {editable &&
                                    evento.estado ===
                                        "ACTIVO" && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onAnular(
                                                evento
                                                    .clienteEventoID,
                                            )
                                        }
                                        className="
                                            flex
                                            size-8
                                            items-center
                                            justify-center
                                            rounded-lg
                                            text-neutral
                                            hover:bg-background
                                            hover:text-red-600
                                        "
                                    >
                                        <span
                                            className="
                                                material-symbols-rounded
                                            "
                                        >
                                            undo
                                        </span>
                                    </button>
                                )}
                            </div>
                        ),
                    )}
                </div>
            )}
        </section>
    );
}

// ============================================================
// EQUIPO MARCADOR
// ============================================================

function EquipoMarcador({
    lado,
    equipo,
}: {
    lado: string;
    equipo: Equipo | null;
}) {
    return (
        <div
            className="
                flex
                min-h-40
                flex-col
                items-center
                justify-center
                p-5
                text-center
            "
        >
            <p
                className="
                    text-xs
                    font-bold
                    text-neutral
                "
            >
                {lado}
            </p>

            <h3
                className="
                    mt-3
                    text-lg
                    font-bold
                    text-neutral-titulos
                "
            >
                {equipo
                    ?.nombre ??
                    "Equip pendent"}
            </h3>
        </div>
    );
}

// ============================================================
// BOTÓN
// ============================================================

function Boton({
    texto,
    disabled,
    onClick,
}: {
    texto: string;
    disabled: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            disabled={
                disabled
            }
            onClick={
                onClick
            }
            className="
                h-9
                rounded-lg
                border
                border-border
                bg-background
                px-2
                text-xs
                font-bold
                text-neutral-titulos
                transition
                hover:border-primary
                disabled:cursor-not-allowed
                disabled:opacity-40
            "
        >
            {texto}
        </button>
    );
}

// ============================================================
// INFO
// ============================================================

function Info({
    icono,
    texto,
}: {
    icono: string;
    texto: string;
}) {
    return (
        <div
            className="
                flex
                items-center
                gap-2
            "
        >
            <span
                className="
                    material-symbols-rounded
                    text-lg
                "
            >
                {icono}
            </span>

            <span>
                {texto}
            </span>
        </div>
    );
}

// ============================================================
// HELPERS
// ============================================================

function contarEquipo(
    eventos:
        EventoLocalActa[],
    equipoID:
        string | null,
    tipo:
        string,
) {
    if (
        !equipoID
    ) {
        return 0;
    }

    return eventos.filter(
        evento =>
            evento.equipoID ===
                equipoID &&
            evento.tipoEvento ===
                tipo,
    ).length;
}

function contarJugador(
    eventos:
        EventoLocalActa[],
    jugadorID:
        string,
    tipo:
        string,
) {
    return eventos.filter(
        evento =>
            evento.jugadorID ===
                jugadorID &&
            evento.tipoEvento ===
                tipo,
    ).length;
}

function nombreJugador(
    jugador:
        Jugador,
) {
    return [
        jugador.nombre,
        jugador.apellido1,
        jugador.apellido2,
    ]
        .filter(
            (
                parte,
            ): parte is string =>
                typeof parte ===
                    "string" &&
                Boolean(
                    parte.trim(),
                ),
        )
        .join(" ") ||
        "Jugador sense nom";
}

function leerMinuto(
    valor:
        string,
) {
    if (
        !valor.trim()
    ) {
        return null;
    }

    const numero =
        Number(
            valor,
        );

    return Number.isSafeInteger(
        numero,
    ) &&
        numero >=
            0 &&
        numero <=
            200
        ? numero
        : null;
}

function nombreEvento(
    tipo:
        string,
) {
    if (
        tipo ===
        "GOL"
    ) {
        return "⚽ Gol";
    }

    if (
        tipo ===
        "TARJETA_AMARILLA"
    ) {
        return "🟨 Targeta groga";
    }

    if (
        tipo ===
        "TARJETA_ROJA"
    ) {
        return "🟥 Targeta vermella";
    }

    return tipo;
}

function nombreEstructura(
    estructura:
        Estructura,
) {
    return (
        estructura.ronda
            ?.nombre ||
        estructura.grupo
            ?.nombre ||
        estructura.fase
            ?.nombre ||
        "Sense fase"
    );
}

function formatFecha(
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return "Data pendent";
    }

    const fecha =
        new Date(
            valor,
        );

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        return "Data pendent";
    }

    return new Intl.DateTimeFormat(
        "ca-ES",
        {
            dateStyle:
                "medium",
            timeStyle:
                "short",
        },
    ).format(
        fecha,
    );
}