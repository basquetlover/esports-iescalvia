import {
    useEffect,
    useMemo,
    useState,
} from "react";

import type {
    CSSProperties,
} from "react";

import {
    anularEventoLocal,
    leerActaLocal,
    registrarEventoLocal,
    type EventoLocalActa,
} from "@utils/acta/localStorage";

// ============================================================
// ICONOS DE EVENTOS
// ============================================================
//
// SOLO estos iconos son archivos externos PNG.
//
// El resto de iconos de interfaz están escritos como SVG
// directamente dentro de este archivo.
//
// ============================================================

const ICONOS_EVENTO = {
    gol:
        "/iconos/panell/acta/gol.svg",

    amarilla:
        "/iconos/panell/acta/tarjeta-amarilla.svg",

    roja:
        "/iconos/panell/acta/tarjeta-roja.svg",

    penaltiMarcado:
        "/iconos/panell/acta/penalti-marcado.svg",

    penaltiFallado:
        "/iconos/panell/acta/penalti-fallado.svg",
} as const;

// ============================================================
// TIPOS
// ============================================================

type Jugador = {
    id: string;

    equipo_id: string;

    nombre: string | null;

    apellido1: string | null;

    apellido2: string | null;

    tipo_participante:
        string | null;

    validacion_estado:
        string | null;

    orden:
        number | null;

    activo:
        boolean | null;
};

type Equipo = {
    id: string;

    nombre: string;

    escudo: string | null;

    jugadores:
        Jugador[];
};

type Lado = {
    lado:
        | "LOCAL"
        | "VISITANTE";

    resuelto:
        boolean;

    equipo:
        Equipo | null;
};

type Partido = {
    id: string;

    codigo: string;

    nombre:
        string | null;

    jornada:
        number | null;

    estado:
        string;

    fecha_hora:
        string | null;

    pista:
        string | null;
};

type Estructura = {
    fase: {
        nombre:
            string;

        tipo:
            string;
    } | null;

    grupo: {
        nombre:
            string;
    } | null;

    ronda: {
        nombre:
            string;

        tipo:
            string;
    } | null;
};

type Acta = {
    id: string;

    estado:
        string;

    version:
        number;
} | null;

type TipoEventoFutbol =
    | "GOL"
    | "TARJETA_AMARILLA"
    | "TARJETA_ROJA"
    | "PENALTI_MARCADO"
    | "PENALTI_FALLADO";

type AccionPendiente = {
    tipo:
        TipoEventoFutbol;

    equipo:
        Equipo;

    jugador:
        Jugador;
};

type Props = {
    partido:
        Partido;

    estructura:
        Estructura;

    equipos: {
        local:
            Lado;

        visitante:
            Lado;
    };

    acta:
        Acta;

    editable:
        boolean;
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
        accionPendiente,
        setAccionPendiente,
    ] =
        useState<
            AccionPendiente | null
        >(
            null,
        );

    const [
        minutoAccion,
        setMinutoAccion,
    ] =
        useState(
            "",
        );

    const [
        errorAccion,
        setErrorAccion,
    ] =
        useState<
            string | null
        >(
            null,
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
        contarGolesEquipo(
            activos,
            equipos.local
                .equipo?.id ??
                null,
        );

    const golesVisitante =
        contarGolesEquipo(
            activos,
            equipos.visitante
                .equipo?.id ??
                null,
        );

    // ========================================================
    // ABRIR ACCIÓN
    // ========================================================

    function abrirAccion(
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

        setAccionPendiente({
            tipo,
            equipo,
            jugador,
        });

        setMinutoAccion(
            "",
        );

        setErrorAccion(
            null,
        );
    }

    // ========================================================
    // CERRAR POPUP ACCIÓN
    // ========================================================

    function cerrarAccion() {
        setAccionPendiente(
            null,
        );

        setMinutoAccion(
            "",
        );

        setErrorAccion(
            null,
        );
    }

    // ========================================================
    // CONFIRMAR ACCIÓN
    // ========================================================

    function confirmarAccion() {
        if (
            !accionPendiente
        ) {
            return;
        }

        let minuto:
            number | null =
            null;

        if (
            minutoAccion
                .trim()
        ) {
            const numero =
                Number(
                    minutoAccion,
                );

            if (
                !Number.isSafeInteger(
                    numero,
                ) ||
                numero <
                    0 ||
                numero >
                    200
            ) {
                setErrorAccion(
                    "El minut ha de ser un nombre enter entre 0 i 200.",
                );

                return;
            }

            minuto =
                numero;
        }

        try {
            const resultado =
                registrarEventoLocal(
                    partido.id,
                    {
                        tipoEvento:
                            accionPendiente.tipo,

                        equipoID:
                            accionPendiente
                                .equipo
                                .id,

                        equipoNombre:
                            accionPendiente
                                .equipo
                                .nombre,

                        jugadorID:
                            accionPendiente
                                .jugador
                                .id,

                        jugadorNombre:
                            nombreJugador(
                                accionPendiente
                                    .jugador,
                            ),

                        minuto,

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

            cerrarAccion();
        } catch (
            error
        ) {
            setErrorAccion(
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
                    : "No s'ha pogut anul·lar la incidència.",
            );
        }
    }

    // ========================================================
    // CARGANDO
    // ========================================================

    if (
        cargandoLocal
    ) {
        return (
            <div
                className="
                    flex
                    min-h-64
                    items-center
                    justify-center
                "
            >
                <IconoCargando
                    className="
                        h-9
                        w-9
                        animate-spin
                        text-primary
                    "
                />
            </div>
        );
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <>
            <div className="space-y-5">
                {/* =============================================
                    MODO CONSULTA
                ============================================= */}

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
                        <IconoCandado
                            className="
                                mt-0.5
                                h-5
                                w-5
                                shrink-0
                            "
                        />

                        <div>
                            <p
                                className="
                                    text-sm
                                    font-bold
                                "
                            >
                                Acta en mode consulta
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                "
                            >
                                No tens el control d'escriptura d'aquesta acta.
                            </p>
                        </div>
                    </div>
                )}

                {/* =============================================
                    ERROR
                ============================================= */}

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

                {/* =============================================
                    INFORMACIÓN DEL PARTIDO
                ============================================= */}

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
                                icono="CALENDARIO"
                                texto={
                                    formatFecha(
                                        partido.fecha_hora,
                                    )
                                }
                            />

                            <Info
                                icono="UBICACION"
                                texto={
                                    partido.pista ||
                                    "Pista pendent"
                                }
                            />

                            <Info
                                icono="DOCUMENTO"
                                texto={
                                    acta
                                        ? `Acta: ${nombreEstadoActa(
                                              acta.estado,
                                          )}`
                                        : "Acta no iniciada"
                                }
                            />
                        </div>
                    </div>
                </section>

                {/* =============================================
                    MARCADOR
                ============================================= */}

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
                                {
                                    golesLocal
                                }
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
                                {
                                    golesVisitante
                                }
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

                {/* =============================================
                    INFORMACIÓN ACCIONES
                ============================================= */}

                <section
                    className="
                        rounded-xl
                        border
                        border-border
                        bg-card
                        p-5
                    "
                >
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
                        Selecciona una acció del jugador.
                        Després podràs indicar el minut.
                    </p>
                </section>

                {/* =============================================
                    LOCAL | HISTORIAL | VISITANTE
                ============================================= */}

                <div
                    className="
                        grid
                        items-start
                        gap-5
                        xl:grid-cols-[minmax(0,1fr)_360px_minmax(0,1fr)]
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
                            abrirAccion
                        }
                    />

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
                            abrirAccion
                        }
                    />
                </div>
            </div>

            {/* =================================================
                POPUP MINUTO
            ================================================= */}

            {accionPendiente && (
                <PopupMinuto
                    accion={
                        accionPendiente
                    }
                    minuto={
                        minutoAccion
                    }
                    error={
                        errorAccion
                    }
                    onMinuto={
                        setMinutoAccion
                    }
                    onCancelar={
                        cerrarAccion
                    }
                    onConfirmar={
                        confirmarAccion
                    }
                />
            )}
        </>
    );
}

// ============================================================
// POPUP MINUTO
// ============================================================

function PopupMinuto({
    accion,
    minuto,
    error,
    onMinuto,
    onCancelar,
    onConfirmar,
}: {
    accion:
        AccionPendiente;

    minuto:
        string;

    error:
        string | null;

    onMinuto: (
        valor:
            string,
    ) => void;

    onCancelar:
        () => void;

    onConfirmar:
        () => void;
}) {
    return (
        <div
            className="
                fixed
                inset-0
                z-[150]
                flex
                items-center
                justify-center
                bg-black/50
                p-4
                backdrop-blur-sm
            "
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-minuto-accion"
                className="
                    w-full
                    max-w-md
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-card
                    shadow-2xl
                "
                onKeyDown={
                    evento => {
                        if (
                            evento.key ===
                            "Escape"
                        ) {
                            onCancelar();
                        }

                        if (
                            evento.key ===
                            "Enter"
                        ) {
                            onConfirmar();
                        }
                    }
                }
            >
                <div
                    className="
                        border-b
                        border-border
                        p-5
                    "
                >
                    <div
                        className="
                            flex
                            items-center
                            gap-3
                        "
                    >
                        <div
                            className="
                                flex
                                h-11
                                w-11
                                shrink-0
                                items-center
                                justify-center
                                rounded-xl
                                bg-background
                            "
                        >
                            <IconoTipoEvento
                                tipo={
                                    accion.tipo
                                }
                                grande
                            />
                        </div>

                        <div className="min-w-0">
                            <h2
                                id="titulo-minuto-accion"
                                className="
                                    font-bold
                                    text-neutral-titulos
                                "
                            >
                                {nombreEvento(
                                    accion.tipo,
                                )}
                            </h2>

                            <p
                                className="
                                    mt-0.5
                                    truncate
                                    text-sm
                                    text-neutral
                                "
                            >
                                {nombreJugador(
                                    accion.jugador,
                                )}
                            </p>

                            <p
                                className="
                                    truncate
                                    text-xs
                                    text-neutral
                                "
                            >
                                {
                                    accion.equipo
                                        .nombre
                                }
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-5">
                    <label>
                        <span
                            className="
                                block
                                text-sm
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Minut
                        </span>

                        <p
                            className="
                                mt-1
                                text-xs
                                text-neutral
                            "
                        >
                            És opcional. Pots deixar-lo buit.
                        </p>

                        <div
                            className="
                                relative
                                mt-3
                            "
                        >
                            <input
                                type="number"
                                min="0"
                                max="200"
                                autoFocus
                                value={
                                    minuto
                                }
                                onChange={
                                    evento =>
                                        onMinuto(
                                            evento
                                                .target
                                                .value,
                                        )
                                }
                                placeholder="Ex. 34"
                                className="
                                    h-12
                                    w-full
                                    rounded-xl
                                    border
                                    border-border
                                    bg-background
                                    px-4
                                    pr-12
                                    text-lg
                                    font-bold
                                    text-neutral-titulos
                                    outline-none
                                    transition
                                    focus:border-primary
                                "
                            />

                            <span
                                className="
                                    pointer-events-none
                                    absolute
                                    right-4
                                    top-1/2
                                    -translate-y-1/2
                                    text-sm
                                    font-semibold
                                    text-neutral
                                "
                            >
                                min
                            </span>
                        </div>
                    </label>

                    {error && (
                        <div
                            className="
                                mt-4
                                rounded-xl
                                border
                                border-red-200
                                bg-red-50
                                p-3
                                text-sm
                                text-red-700
                            "
                        >
                            {error}
                        </div>
                    )}
                </div>

                <div
                    className="
                        flex
                        flex-col-reverse
                        gap-3
                        border-t
                        border-border
                        bg-background
                        p-4
                        sm:flex-row
                        sm:justify-end
                    "
                >
                    <button
                        type="button"
                        onClick={
                            onCancelar
                        }
                        className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-border
                            bg-card
                            px-5
                            text-sm
                            font-semibold
                            text-neutral-titulos
                            transition
                            hover:bg-background
                        "
                    >
                        Cancel·lar
                    </button>

                    <button
                        type="button"
                        onClick={
                            onConfirmar
                        }
                        className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            gap-2
                            rounded-xl
                            bg-primary
                            px-5
                            text-sm
                            font-bold
                            text-white
                            transition
                            hover:opacity-90
                        "
                    >
                        <IconoCheck
                            className="
                                h-5
                                w-5
                            "
                        />

                        Registrar
                    </button>
                </div>
            </section>
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
    titulo:
        string;

    equipo:
        Equipo | null;

    eventos:
        EventoLocalActa[];

    editable:
        boolean;

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
                <div
                    className="
                        flex
                        items-center
                        gap-3
                    "
                >
                    {equipo?.escudo && (
                        <div
                            className="
                                flex
                                h-12
                                w-12
                                shrink-0
                                items-center
                                justify-center
                                overflow-hidden
                                rounded-lg
                                border
                                border-border
                                bg-white
                                p-1
                            "
                        >
                            <img
                                src={
                                    equipo.escudo
                                }
                                alt={`Escut de ${equipo.nombre}`}
                                className="
                                    h-full
                                    w-full
                                    object-contain
                                "
                            />
                        </div>
                    )}

                    <div className="min-w-0">
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
                                truncate
                                font-bold
                                text-neutral-titulos
                            "
                        >
                            {equipo
                                ?.nombre ??
                                "Equip per determinar"}
                        </h3>

                        {equipo && (
                            <p
                                className="
                                    mt-1
                                    text-xs
                                    text-neutral
                                "
                            >
                                {
                                    equipo
                                        .jugadores
                                        .length
                                }{" "}
                                jugadors
                            </p>
                        )}
                    </div>
                </div>
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
            ) : equipo.jugadores
                  .length ===
              0 ? (
                <p
                    className="
                        p-6
                        text-sm
                        text-neutral
                    "
                >
                    No hi ha jugadors disponibles.
                </p>
            ) : (
                <div
                    className="
                        max-h-130
                        divide-y
                        divide-border
                        overflow-y-auto
                        overscroll-contain
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
    jugador:
        Jugador;

    equipo:
        Equipo;

    eventos:
        EventoLocalActa[];

    editable:
        boolean;

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

    const penaltisMarcados =
        contarJugador(
            eventos,
            jugador.id,
            "PENALTI_MARCADO",
        );

    const penaltisFallados =
        contarJugador(
            eventos,
            jugador.id,
            "PENALTI_FALLADO",
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
                        flex-wrap
                        items-center
                        justify-end
                        gap-2
                    "
                >
                    {goles >
                        0 && (
                        <ContadorEvento
                            icono={
                                ICONOS_EVENTO.gol
                            }
                            cantidad={
                                goles
                            }
                            className="text-neutral-titulos"
                        />
                    )}

                    {amarillas >
                        0 && (
                        <ContadorEvento
                            icono={
                                ICONOS_EVENTO.amarilla
                            }
                            cantidad={
                                amarillas
                            }
                            className="text-yellow-500"
                        />
                    )}

                    {rojas >
                        0 && (
                        <ContadorEvento
                            icono={
                                ICONOS_EVENTO.roja
                            }
                            cantidad={
                                rojas
                            }
                            className="text-red-600"
                        />
                    )}

                    {penaltisMarcados >
                        0 && (
                        <ContadorEvento
                            icono={
                                ICONOS_EVENTO.penaltiMarcado
                            }
                            cantidad={
                                penaltisMarcados
                            }
                            className="text-secondary"
                        />
                    )}

                    {penaltisFallados >
                        0 && (
                        <ContadorEvento
                            icono={
                                ICONOS_EVENTO.penaltiFallado
                            }
                            cantidad={
                                penaltisFallados
                            }
                            className="text-red-600"
                        />
                    )}
                </div>
            </div>

            <div
                className="
                    mt-3
                    grid
                    grid-cols-2
                    gap-2
                    sm:grid-cols-3
                "
            >
                <Boton
                    disabled={
                        !editable
                    }
                    texto="Gol"
                    icono={
                        ICONOS_EVENTO.gol
                    }
                    classNameIcono="text-neutral-titulos"
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
                    icono={
                        ICONOS_EVENTO.amarilla
                    }
                    classNameIcono="text-yellow-500"
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
                    icono={
                        ICONOS_EVENTO.roja
                    }
                    classNameIcono="text-red-600"
                    onClick={() =>
                        onEvento(
                            "TARJETA_ROJA",
                            equipo,
                            jugador,
                        )
                    }
                />

                <Boton
                    disabled={
                        !editable
                    }
                    texto="Penal gol"
                    icono={
                        ICONOS_EVENTO.penaltiMarcado
                    }
                    classNameIcono="text-secondary"
                    onClick={() =>
                        onEvento(
                            "PENALTI_MARCADO",
                            equipo,
                            jugador,
                        )
                    }
                />

                <Boton
                    disabled={
                        !editable
                    }
                    texto="Penal fallat"
                    icono={
                        ICONOS_EVENTO.penaltiFallado
                    }
                    classNameIcono="text-red-600"
                    onClick={() =>
                        onEvento(
                            "PENALTI_FALLADO",
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
// CONTADOR EVENTO
// ============================================================

function ContadorEvento({
    icono,
    cantidad,
    className,
}: {
    icono:
        string;

    cantidad:
        number;

    className:
        string;
}) {
    return (
        <span
            className={`
                inline-flex
                items-center
                gap-1
                text-xs
                font-bold
                ${className}
            `}
        >
            <IconoEventoPNG
                ruta={
                    icono
                }
                className="
                    h-4
                    w-4
                "
            />

            {cantidad}
        </span>
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

    editable:
        boolean;

    onAnular: (
        id:
            string,
    ) => void;
}) {
    const [
        revision,
        setRevision,
    ] =
        useState(
            0,
        );

    // ========================================================
    // DESAPARECER ANULADOS A LOS 5 SEGUNDOS
    // ========================================================
    //
    // NO se borran del LocalStorage.
    //
    // Solamente dejan de mostrarse.
    //
    // ========================================================

    useEffect(
        () => {
            const ahora =
                Date.now();

            let siguiente:
                number | null =
                null;

            for (
                const evento
                of eventos
            ) {
                if (
                    evento.estado !==
                        "ANULADO" ||
                    !evento.anuladoAt
                ) {
                    continue;
                }

                const fecha =
                    new Date(
                        evento.anuladoAt,
                    ).getTime();

                if (
                    Number.isNaN(
                        fecha,
                    )
                ) {
                    continue;
                }

                const restante =
                    5000 -
                    (
                        ahora -
                        fecha
                    );

                if (
                    restante <=
                    0
                ) {
                    continue;
                }

                if (
                    siguiente ===
                        null ||
                    restante <
                        siguiente
                ) {
                    siguiente =
                        restante;
                }
            }

            if (
                siguiente ===
                null
            ) {
                return;
            }

            const temporizador =
                window.setTimeout(
                    () => {
                        setRevision(
                            valor =>
                                valor +
                                1,
                        );
                    },
                    siguiente +
                        50,
                );

            return () => {
                window.clearTimeout(
                    temporizador,
                );
            };
        },
        [
            eventos,
            revision,
        ],
    );

    const visibles =
        eventos.filter(
            evento =>
                eventoVisibleHistorial(
                    evento,
                ),
        );

    const lista =
        [
            ...visibles,
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
                    text-center
                "
            >
                <h3
                    className="
                        font-bold
                        text-neutral-titulos
                    "
                >
                    Historial
                </h3>

                <p
                    className="
                        mt-1
                        text-xs
                        text-neutral
                    "
                >
                    {
                        visibles.length
                    }{" "}
                    incidències
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
                        max-h-130
                        divide-y
                        divide-border
                        overflow-y-auto
                        overscroll-contain
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
                                    transition-opacity
                                    ${
                                        evento.estado ===
                                        "ANULADO"
                                            ? "opacity-40"
                                            : ""
                                    }
                                `}
                            >
                                <div
                                    className="
                                        flex
                                        min-w-0
                                        gap-3
                                    "
                                >
                                    <div
                                        className="
                                            mt-0.5
                                            flex
                                            h-8
                                            w-8
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-lg
                                            bg-background
                                        "
                                    >
                                        <IconoTipoEvento
                                            tipo={
                                                evento.tipoEvento
                                            }
                                        />
                                    </div>

                                    <div className="min-w-0">
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
                                                truncate
                                                text-xs
                                                text-neutral
                                            "
                                        >
                                            {
                                                evento.jugadorNombre
                                            }
                                        </p>

                                        <p
                                            className="
                                                truncate
                                                text-xs
                                                text-neutral
                                            "
                                        >
                                            {
                                                evento.equipoNombre
                                            }
                                        </p>

                                        {evento.estado ===
                                            "ANULADO" && (
                                            <p
                                                className="
                                                    mt-1
                                                    text-[10px]
                                                    font-bold
                                                    uppercase
                                                    text-red-600
                                                "
                                            >
                                                Anul·lat
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {editable &&
                                    evento.estado ===
                                        "ACTIVO" && (
                                    <button
                                        type="button"
                                        title="Anul·lar incidència"
                                        aria-label="Anul·lar incidència"
                                        onClick={() =>
                                            onAnular(
                                                evento
                                                    .clienteEventoID,
                                            )
                                        }
                                        className="
                                            flex
                                            h-8
                                            w-8
                                            shrink-0
                                            items-center
                                            justify-center
                                            rounded-lg
                                            text-neutral
                                            transition
                                            hover:bg-background
                                            hover:text-red-600
                                        "
                                    >
                                        <IconoDeshacer
                                            className="
                                                h-4
                                                w-4
                                            "
                                        />
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
    lado:
        string;

    equipo:
        Equipo | null;
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
                    uppercase
                    tracking-[0.14em]
                    text-neutral
                "
            >
                {lado}
            </p>

            {equipo?.escudo && (
                <div
                    className="
                        mt-4
                        flex
                        h-16
                        w-16
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-xl
                        border
                        border-border
                        bg-white
                        p-1.5
                    "
                >
                    <img
                        src={
                            equipo.escudo
                        }
                        alt={`Escut de ${equipo.nombre}`}
                        className="
                            h-full
                            w-full
                            object-contain
                        "
                    />
                </div>
            )}

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
// BOTÓN ACCIÓN
// ============================================================

function Boton({
    texto,
    icono,
    classNameIcono,
    disabled,
    onClick,
}: {
    texto:
        string;

    icono:
        string;

    classNameIcono:
        string;

    disabled:
        boolean;

    onClick:
        () => void;
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
                flex
                min-h-10
                items-center
                justify-center
                gap-2
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
            <IconoEventoPNG
                ruta={
                    icono
                }
                className={`
                    h-4
                    w-4
                    shrink-0
                    ${classNameIcono}
                `}
            />

            <span>
                {texto}
            </span>
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
    icono:
        | "CALENDARIO"
        | "UBICACION"
        | "DOCUMENTO";

    texto:
        string;
}) {
    return (
        <div
            className="
                flex
                items-center
                gap-2
            "
        >
            {icono ===
                "CALENDARIO" && (
                <IconoCalendario
                    className="
                        h-4
                        w-4
                    "
                />
            )}

            {icono ===
                "UBICACION" && (
                <IconoUbicacion
                    className="
                        h-4
                        w-4
                    "
                />
            )}

            {icono ===
                "DOCUMENTO" && (
                <IconoDocumento
                    className="
                        h-4
                        w-4
                    "
                />
            )}

            <span>
                {texto}
            </span>
        </div>
    );
}

// ============================================================
// ICONO TIPO EVENTO
// ============================================================

function IconoTipoEvento({
    tipo,
    grande = false,
}: {
    tipo:
        string;

    grande?:
        boolean;
}) {
    let ruta:
        string =
        ICONOS_EVENTO.gol;

    let className:
        string =
        "text-neutral-titulos";

    if (
        tipo ===
        "TARJETA_AMARILLA"
    ) {
        ruta =
            ICONOS_EVENTO.amarilla;

        className =
            "text-yellow-500";
    }

    if (
        tipo ===
        "TARJETA_ROJA"
    ) {
        ruta =
            ICONOS_EVENTO.roja;

        className =
            "text-red-600";
    }

    if (
        tipo ===
        "PENALTI_MARCADO"
    ) {
        ruta =
            ICONOS_EVENTO.penaltiMarcado;

        className =
            "text-secondary";
    }

    if (
        tipo ===
        "PENALTI_FALLADO"
    ) {
        ruta =
            ICONOS_EVENTO.penaltiFallado;

        className =
            "text-red-600";
    }

    return (
        <IconoEventoPNG
            ruta={
                ruta
            }
            className={`
                ${grande
                    ? "h-6 w-6"
                    : "h-5 w-5"
                }
                ${className}
            `}
        />
    );
}

// ============================================================
// PNG MASK
// ============================================================

function IconoEventoPNG({
    ruta,
    className = "",
}: {
    ruta:
        string;

    className?:
        string;
}) {
    const style:
        CSSProperties = {
        WebkitMaskImage:
            `url("${ruta}")`,

        maskImage:
            `url("${ruta}")`,

        WebkitMaskRepeat:
            "no-repeat",

        maskRepeat:
            "no-repeat",

        WebkitMaskPosition:
            "center",

        maskPosition:
            "center",

        WebkitMaskSize:
            "contain",

        maskSize:
            "contain",

        backgroundColor:
            "currentColor",
    };

    return (
        <span
            aria-hidden="true"
            className={`
                inline-block
                ${className}
            `}
            style={
                style
            }
        />
    );
}

// ============================================================
// SVG INLINE
// ============================================================

type IconProps = {
    className?:
        string;
};

function IconoCargando({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            className={
                className
            }
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="3"
                opacity="0.2"
            />

            <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
            />
        </svg>
    );
}

function IconoCandado({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
                className
            }
            aria-hidden="true"
        >
            <rect
                x="5"
                y="10"
                width="14"
                height="10"
                rx="2"
            />

            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

function IconoCalendario({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
                className
            }
            aria-hidden="true"
        >
            <rect
                x="3"
                y="5"
                width="18"
                height="16"
                rx="2"
            />

            <path d="M8 3v4" />

            <path d="M16 3v4" />

            <path d="M3 10h18" />
        </svg>
    );
}

function IconoUbicacion({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
                className
            }
            aria-hidden="true"
        >
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

            <circle
                cx="12"
                cy="10"
                r="2.5"
            />
        </svg>
    );
}

function IconoDocumento({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
                className
            }
            aria-hidden="true"
        >
            <path d="M6 3h8l4 4v14H6z" />

            <path d="M14 3v5h5" />

            <path d="M9 13h6" />

            <path d="M9 17h6" />
        </svg>
    );
}

function IconoDeshacer({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
                className
            }
            aria-hidden="true"
        >
            <path d="M9 7 4 12l5 5" />

            <path d="M4 12h9a7 7 0 0 1 7 7" />
        </svg>
    );
}

function IconoCheck({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={
                className
            }
            aria-hidden="true"
        >
            <circle
                cx="12"
                cy="12"
                r="9"
            />

            <path d="m8 12 2.5 2.5L16 9" />
        </svg>
    );
}

// ============================================================
// HELPERS
// ============================================================

function eventoVisibleHistorial(
    evento:
        EventoLocalActa,
) {
    if (
        evento.estado ===
        "ACTIVO"
    ) {
        return true;
    }

    if (
        evento.estado !==
            "ANULADO" ||
        !evento.anuladoAt
    ) {
        return false;
    }

    const fecha =
        new Date(
            evento.anuladoAt,
        ).getTime();

    if (
        Number.isNaN(
            fecha,
        )
    ) {
        return false;
    }

    return (
        Date.now() -
        fecha
    ) <
        5000;
}

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

function contarGolesEquipo(
    eventos:
        EventoLocalActa[],

    equipoID:
        string | null,
) {
    return (
        contarEquipo(
            eventos,
            equipoID,
            "GOL",
        ) +
        contarEquipo(
            eventos,
            equipoID,
            "PENALTI_MARCADO",
        )
    );
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
    return (
        [
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
        "Jugador sense nom"
    );
}

function nombreEvento(
    tipo:
        string,
) {
    switch (
        tipo
    ) {
        case "GOL":
            return "Gol";

        case "TARJETA_AMARILLA":
            return "Targeta groga";

        case "TARJETA_ROJA":
            return "Targeta vermella";

        case "PENALTI_MARCADO":
            return "Penal marcat";

        case "PENALTI_FALLADO":
            return "Penal fallat";

        default:
            return tipo;
    }
}

function nombreEstadoActa(
    estado:
        string,
) {
    switch (
        estado
    ) {
        case "NO_INICIADA":
            return "No iniciada";

        case "EN_CURSO":
            return "En curs";

        case "BLOQUEADA":
            return "Bloquejada";

        case "FINALIZADA":
            return "Finalitzada";

        default:
            return estado;
    }
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