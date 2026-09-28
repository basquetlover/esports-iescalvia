import {
    useEffect,
    useState,
} from "react";

import ActaFutbol from "./futbol/ActaFutbol";

// ============================================================
// PROPS
// ============================================================

type Props = {
    partidoID: string;
    torneoID: string;
    edicionID: string;
};

// ============================================================
// TIPOS
// ============================================================

type Torneo = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    logo: string | null;
};

type Edicion = {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
    estado: string | null;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
};

type Partido = {
    id: string;

    edicion_id: string;

    fase_id: string;

    fase_tipo:
        | "GRUPOS"
        | "ELIMINATORIA";

    tipo:
        | "GRUPO"
        | "ELIMINATORIA";

    grupo_id: string | null;

    ronda_id: string | null;

    codigo: string;

    nombre: string | null;

    orden: number;

    jornada: number | null;

    estado: string;

    fecha_hora: string | null;

    pista: string | null;

    duracion_estimada_min:
        number | null;

    publicado: boolean;

    finalizado_at: string | null;

    created_at: string | null;

    updated_at: string | null;
};

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

    orden: number | null;

    activo: boolean | null;
};

type Equipo = {
    id: string;

    nombre: string;

    escudo: string | null;

    jugadores: Jugador[];
};

type Plaza = {
    id: string;

    lado:
        | "LOCAL"
        | "VISITANTE"
        | null;

    origen_tipo:
        string | null;

    equipo_origen_id:
        string | null;

    origen_grupo_id:
        string | null;

    origen_fase_id:
        string | null;

    origen_posicion:
        number | null;

    origen_partido_id:
        string | null;

    equipo_resuelto_id:
        string | null;
};

type Lado = {
    lado:
        | "LOCAL"
        | "VISITANTE";

    resuelto: boolean;

    plaza:
        Plaza | null;

    equipo:
        Equipo | null;
};

type Acta = {
    id: string;

    partido_id: string;

    estado: string;

    nivel_estadisticas:
        string;

    operador_id:
        string | null;

    controlador_id:
        string | null;

    iniciada_at:
        string | null;

    bloqueada_por:
        string | null;

    bloqueada_at:
        string | null;

    motivo_bloqueo:
        string | null;

    finalizada_por:
        string | null;

    finalizada_at:
        string | null;

    version: number;

    created_at: string;

    updated_at: string;
};

type ControlActa = {
    puedeEditar: boolean;

    esControlador: boolean;

    puedeEscribir: boolean;

    controlToken:
        string | null;
};

type Estructura = {
    fase: {
        id: string;

        nombre: string;

        tipo: string;

        orden: number;

        estado: string;

        publicada: boolean;
    } | null;

    grupo: {
        id: string;

        fase_id: string;

        nombre: string;

        orden: number;

        estado: string;
    } | null;

    ronda: {
        id: string;

        fase_id: string;

        tipo: string;

        nombre: string;

        orden: number;
    } | null;
};

type DatosActa = {
    success: true;

    torneo: Torneo;

    edicion: Edicion;

    partido: Partido;

    estructura: Estructura;

    equipos: {
        local: Lado;

        visitante: Lado;
    };

    acta:
        Acta | null;

    control?:
        ControlActa;
};

type RespuestaInicio = {
    success: true;

    iniciado: true;

    reutilizado:
        boolean;

    acta:
        Acta;

    control?:
        ControlActa;
};

// ============================================================
// CONTROL VACIO
// ============================================================

const CONTROL_SIN_DATOS:
    ControlActa = {
        puedeEditar:
            false,

        esControlador:
            false,

        puedeEscribir:
            false,

        controlToken:
            null,
    };

// ============================================================
// COMPONENTE
// ============================================================

export default function Gestor({
    partidoID,
    torneoID,
    edicionID,
}: Props) {
    const [
        datos,
        setDatos,
    ] =
        useState<
            DatosActa | null
        >(
            null,
        );

    const [
        cargando,
        setCargando,
    ] =
        useState(
            true,
        );

    const [
        iniciando,
        setIniciando,
    ] =
        useState(
            false,
        );

    const [
        error,
        setError,
    ] =
        useState<
            string | null
        >(
            null,
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
    // CARGAR DATOS
    // ========================================================

    useEffect(
        () => {
            const controlador =
                new AbortController();

            async function cargar() {
                setCargando(
                    true,
                );

                setError(
                    null,
                );

                try {
                    const parametros =
                        crearParametros(
                            torneoID,
                            edicionID,
                            partidoID,
                        );

                    const respuesta =
                        await fetch(
                            `/api/panell/acta?${parametros}`,
                            {
                                method:
                                    "GET",

                                credentials:
                                    "same-origin",

                                cache:
                                    "no-store",

                                signal:
                                    controlador.signal,
                            },
                        );

                    const contenido =
                        await leerRespuesta<
                            DatosActa
                        >(
                            respuesta,
                        );

                    setDatos({
                        ...contenido,

                        control:
                            normalizarControl(
                                contenido.control,
                            ),
                    });
                } catch (
                    error
                ) {
                    if (
                        controlador
                            .signal
                            .aborted
                    ) {
                        return;
                    }

                    setDatos(
                        null,
                    );

                    setError(
                        error instanceof
                            Error
                            ? error.message
                            : "No s'ha pogut carregar l'acta.",
                    );
                } finally {
                    if (
                        !controlador
                            .signal
                            .aborted
                    ) {
                        setCargando(
                            false,
                        );
                    }
                }
            }

            void cargar();

            return () => {
                controlador.abort();
            };
        },
        [
            partidoID,
            torneoID,
            edicionID,
        ],
    );

    // ========================================================
    // INICIAR ACTA
    // ========================================================

    async function iniciarActa() {
        if (
            iniciando
        ) {
            return;
        }

        setIniciando(
            true,
        );

        setErrorAccion(
            null,
        );

        try {
            const parametros =
                crearParametros(
                    torneoID,
                    edicionID,
                    partidoID,
                );

            const respuesta =
                await fetch(
                    `/api/panell/acta/iniciar?${parametros}`,
                    {
                        method:
                            "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {},
                            ),
                    },
                );

            const contenido =
                await leerRespuesta<
                    RespuestaInicio
                >(
                    respuesta,
                );

            setDatos(
                actual => {
                    if (
                        !actual
                    ) {
                        return actual;
                    }

                    return {
                        ...actual,

                        acta:
                            contenido.acta,

                        control:
                            normalizarControl(
                                contenido.control,
                            ),
                    };
                },
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut iniciar l'acta.",
            );
        } finally {
            setIniciando(
                false,
            );
        }
    }

    // ========================================================
    // VOLVER
    // ========================================================

    function tornarPaginaAnterior() {
        if (
            typeof window !==
            "undefined"
        ) {
            if (
                window.history.length >
                1
            ) {
                window.history.back();

                return;
            }

            window.location.href =
                `/panell/partits` +
                `?torneoID=${encodeURIComponent(
                    torneoID,
                )}` +
                `&edicionID=${encodeURIComponent(
                    edicionID,
                )}`;

            return;
        }
    }

    // ========================================================
    // CARGANDO
    // ========================================================

    if (
        cargando
    ) {
        return (
            <main
                className="
                    flex
                    min-h-[70vh]
                    w-full
                    items-center
                    justify-center
                    px-4
                    py-6
                "
            >
                <div className="text-center">
                    <IconoCargando
                        className="
                            mx-auto
                            h-9
                            w-9
                            animate-spin
                            text-primary
                        "
                    />

                    <p
                        className="
                            mt-3
                            text-sm
                            font-medium
                            text-neutral
                        "
                    >
                        Carregant el partit...
                    </p>
                </div>
            </main>
        );
    }

    // ========================================================
    // ERROR CARGA
    // ========================================================

    if (
        error ||
        !datos
    ) {
        return (
            <main
                className="
                    w-full
                    px-4
                    py-6
                "
            >
                <div
                    className="
                        mx-auto
                        max-w-[1600px]
                    "
                >
                    <div
                        className="
                            rounded-2xl
                            border
                            border-red-200
                            bg-red-50
                            p-6
                        "
                    >
                        <div
                            className="
                                flex
                                items-start
                                gap-3
                            "
                        >
                            <IconoError
                                className="
                                    h-6
                                    w-6
                                    shrink-0
                                    text-red-600
                                "
                            />

                            <div>
                                <h2
                                    className="
                                        font-bold
                                        text-red-800
                                    "
                                >
                                    No s'ha pogut carregar el partit
                                </h2>

                                <p
                                    className="
                                        mt-1
                                        text-sm
                                        text-red-700
                                    "
                                >
                                    {error ??
                                        "Error desconegut."}
                                </p>

                                <button
                                    type="button"
                                    onClick={
                                        tornarPaginaAnterior
                                    }
                                    className="
                                        mt-4
                                        inline-flex
                                        h-10
                                        items-center
                                        justify-center
                                        gap-2
                                        rounded-xl
                                        border
                                        border-red-300
                                        bg-white
                                        px-4
                                        text-sm
                                        font-semibold
                                        text-red-700
                                    "
                                >
                                    <IconoFlecha
                                        className="
                                            h-4
                                            w-4
                                        "
                                    />

                                    Tornar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // ========================================================
    // CONTROL
    // ========================================================

    const control =
        normalizarControl(
            datos.control,
        );

    // ========================================================
    // ACTA NO INICIADA
    // ========================================================
    //
    // IMPORTANTE:
    //
    // No renderizamos ActaFutbol mientras no exista acta.
    //
    // Primero el usuario debe:
    //
    // - iniciar
    // - o volver
    //
    // ========================================================

    if (
        !datos.acta
    ) {
        return (
            <PopupIniciarActa
                partido={
                    datos.partido
                }
                equipos={
                    datos.equipos
                }
                iniciando={
                    iniciando
                }
                error={
                    errorAccion
                }
                onIniciar={
                    iniciarActa
                }
                onTornar={
                    tornarPaginaAnterior
                }
            />
        );
    }

    // ========================================================
    // DEPORTE
    // ========================================================

    const deporte =
        normalizarDeporte(
            datos.torneo
                .deporte,
        );

    // ========================================================
    // ACTA
    // ========================================================

    return (
        <main
            className="
                w-full
                px-4
                py-6
            "
        >
            <div
                className="
                    mx-auto
                    max-w-[1600px]
                "
            >
                <Cabecera
                    torneoID={
                        torneoID
                    }
                    edicionID={
                        edicionID
                    }
                    deporte={
                        datos.torneo
                            .deporte
                    }
                    onTornar={
                        tornarPaginaAnterior
                    }
                />

                <ControlActaPanel
                    acta={
                        datos.acta
                    }
                    control={
                        control
                    }
                />

                {deporte ===
                    "FUTBOL" && (
                    <ActaFutbol
                        partido={
                            datos.partido
                        }
                        estructura={
                            datos.estructura
                        }
                        equipos={
                            datos.equipos
                        }
                        acta={
                            datos.acta
                        }
                        editable={
                            control.puedeEscribir
                        }
                    />
                )}

                {deporte ===
                    "VOLEIBOL" && (
                    <Proximamente
                        titulo="Acta de voleibol"
                        texto="El component específic de voleibol està pendent d'implementar."
                    />
                )}

                {deporte !==
                    "FUTBOL" &&
                    deporte !==
                        "VOLEIBOL" && (
                        <Proximamente
                            titulo="Acta digital"
                            texto="Encara no hi ha un component específic per aquest esport."
                        />
                    )}
            </div>
        </main>
    );
}

// ============================================================
// POPUP INICIAR
// ============================================================

function PopupIniciarActa({
    partido,
    equipos,
    iniciando,
    error,
    onIniciar,
    onTornar,
}: {
    partido:
        Partido;

    equipos: {
        local:
            Lado;

        visitante:
            Lado;
    };

    iniciando:
        boolean;

    error:
        string | null;

    onIniciar:
        () => void;

    onTornar:
        () => void;
}) {
    const local =
        equipos.local
            .equipo;

    const visitante =
        equipos.visitante
            .equipo;

    return (
        <div
            className="
                fixed
                inset-0
                z-[100]
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
                aria-labelledby="titulo-iniciar-acta"
                className="
                    w-full
                    max-w-xl
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-card
                    shadow-2xl
                "
            >
                <div
                    className="
                        border-b
                        border-border
                        p-6
                    "
                >
                    <div
                        className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-xl
                            bg-primary/10
                            text-primary
                        "
                    >
                        <IconoDocumento
                            className="
                                h-6
                                w-6
                            "
                        />
                    </div>

                    <h1
                        id="titulo-iniciar-acta"
                        className="
                            mt-4
                            text-2xl
                            font-bold
                            text-neutral-titulos
                        "
                    >
                        Iniciar acta
                    </h1>

                    <p
                        className="
                            mt-2
                            text-sm
                            text-neutral
                        "
                    >
                        L'acta d'aquest partit encara no s'ha iniciat.
                        Per accedir-hi primer l'has d'iniciar.
                    </p>
                </div>

                <div
                    className="
                        p-6
                    "
                >
                    <div
                        className="
                            grid
                            grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]
                            items-center
                            gap-4
                            rounded-xl
                            border
                            border-border
                            bg-background
                            p-4
                        "
                    >
                        <EquipoPopup
                            equipo={
                                local
                            }
                            derecha
                        />

                        <div
                            className="
                                text-center
                                text-sm
                                font-bold
                                text-neutral
                            "
                        >
                            VS
                        </div>

                        <EquipoPopup
                            equipo={
                                visitante
                            }
                        />
                    </div>

                    <div
                        className="
                            mt-4
                            text-center
                        "
                    >
                        <p
                            className="
                                text-xs
                                font-semibold
                                text-neutral
                            "
                        >
                            {partido.codigo}
                        </p>

                        {partido.fecha_hora && (
                            <p
                                className="
                                    mt-1
                                    text-xs
                                    text-neutral
                                "
                            >
                                {formatearFecha(
                                    partido.fecha_hora,
                                )}
                            </p>
                        )}
                    </div>

                    {error && (
                        <div
                            className="
                                mt-5
                                flex
                                items-start
                                gap-2
                                rounded-xl
                                border
                                border-red-200
                                bg-red-50
                                p-4
                                text-sm
                                text-red-700
                            "
                        >
                            <IconoError
                                className="
                                    mt-0.5
                                    h-5
                                    w-5
                                    shrink-0
                                "
                            />

                            <span>
                                {error}
                            </span>
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
                        disabled={
                            iniciando
                        }
                        onClick={
                            onTornar
                        }
                        className="
                            inline-flex
                            h-11
                            items-center
                            justify-center
                            gap-2
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
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        <IconoFlecha
                            className="
                                h-4
                                w-4
                            "
                        />

                        Tornar
                    </button>

                    <button
                        type="button"
                        disabled={
                            iniciando
                        }
                        onClick={
                            onIniciar
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
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        {iniciando ? (
                            <IconoCargando
                                className="
                                    h-5
                                    w-5
                                    animate-spin
                                "
                            />
                        ) : (
                            <IconoPlay
                                className="
                                    h-5
                                    w-5
                                "
                            />
                        )}

                        {iniciando
                            ? "Iniciant acta..."
                            : "Iniciar acta"}
                    </button>
                </div>
            </section>
        </div>
    );
}

// ============================================================
// EQUIPO POPUP
// ============================================================

function EquipoPopup({
    equipo,
    derecha = false,
}: {
    equipo:
        Equipo | null;

    derecha?:
        boolean;
}) {
    return (
        <div
            className={`
                flex
                min-w-0
                items-center
                gap-3
                ${
                    derecha
                        ? "justify-end text-right"
                        : ""
                }
            `}
        >
            {derecha && (
                <p
                    className="
                        min-w-0
                        truncate
                        text-sm
                        font-bold
                        text-neutral-titulos
                    "
                >
                    {equipo
                        ?.nombre ??
                        "Per determinar"}
                </p>
            )}

            {equipo?.escudo && (
                <div
                    className="
                        flex
                        h-11
                        w-11
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
                        alt=""
                        className="
                            h-full
                            w-full
                            object-contain
                        "
                    />
                </div>
            )}

            {!derecha && (
                <p
                    className="
                        min-w-0
                        truncate
                        text-sm
                        font-bold
                        text-neutral-titulos
                    "
                >
                    {equipo
                        ?.nombre ??
                        "Per determinar"}
                </p>
            )}
        </div>
    );
}

// ============================================================
// CONTROL ACTA
// ============================================================

function ControlActaPanel({
    acta,
    control,
}: {
    acta:
        Acta;

    control:
        ControlActa;
}) {
    if (
        acta.estado ===
        "FINALIZADA"
    ) {
        return (
            <AvisoControl
                icono="CHECK"
                titulo="Acta finalitzada"
                texto="El partit està en mode consulta."
            />
        );
    }

    if (
        control.puedeEscribir
    ) {
        return (
            <AvisoControl
                icono="EDITAR"
                titulo="Tens el control de l'acta"
                texto="Pots registrar i modificar incidències."
            />
        );
    }

    if (
        acta.estado ===
        "BLOQUEADA"
    ) {
        return (
            <AvisoControl
                icono="BLOQUEO"
                titulo="Acta bloquejada"
                texto="Un altre usuari està controlant o revisant aquesta acta."
            />
        );
    }

    return (
        <AvisoControl
            icono="VER"
            titulo="Mode consulta"
            texto="L'acta està sent gestionada per un altre usuari."
        />
    );
}

// ============================================================
// AVISO CONTROL
// ============================================================

function AvisoControl({
    icono,
    titulo,
    texto,
}: {
    icono:
        | "CHECK"
        | "EDITAR"
        | "BLOQUEO"
        | "VER";

    titulo:
        string;

    texto:
        string;
}) {
    return (
        <section
            className="
                mb-5
                flex
                items-start
                gap-3
                rounded-2xl
                border
                border-border
                bg-card
                p-4
            "
        >
            <div
                className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-primary/10
                    text-primary
                "
            >
                {icono ===
                    "CHECK" && (
                    <IconoCheck
                        className="
                            h-5
                            w-5
                        "
                    />
                )}

                {icono ===
                    "EDITAR" && (
                    <IconoEditar
                        className="
                            h-5
                            w-5
                        "
                    />
                )}

                {icono ===
                    "BLOQUEO" && (
                    <IconoBloqueo
                        className="
                            h-5
                            w-5
                        "
                    />
                )}

                {icono ===
                    "VER" && (
                    <IconoOjo
                        className="
                            h-5
                            w-5
                        "
                    />
                )}
            </div>

            <div>
                <p
                    className="
                        text-sm
                        font-bold
                        text-neutral-titulos
                    "
                >
                    {titulo}
                </p>

                <p
                    className="
                        mt-1
                        text-xs
                        text-neutral
                    "
                >
                    {texto}
                </p>
            </div>
        </section>
    );
}

// ============================================================
// CABECERA
// ============================================================

function Cabecera({
    deporte,
    onTornar,
}: {
    torneoID:
        string;

    edicionID:
        string;

    deporte?:
        string | null;

    onTornar:
        () => void;
}) {
    return (
        <header
            className="
                mb-6
                flex
                flex-col
                gap-4
                border-b
                border-border
                pb-5
                sm:flex-row
                sm:items-end
                sm:justify-between
            "
        >
            <div>
                <p
                    className="
                        text-xs
                        font-semibold
                        uppercase
                        tracking-[0.14em]
                        text-primary
                    "
                >
                    Competició

                    {deporte
                        ? ` · ${deporte}`
                        : ""}
                </p>

                <h1
                    className="
                        mt-1
                        text-3xl
                        font-bold
                        text-neutral-titulos
                    "
                >
                    Acta digital
                </h1>

                <p
                    className="
                        mt-1
                        text-sm
                        text-neutral
                    "
                >
                    Gestió del partit, resultat i incidències.
                </p>
            </div>

            <button
                type="button"
                onClick={
                    onTornar
                }
                className="
                    inline-flex
                    h-10
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    border
                    border-border
                    bg-card
                    px-4
                    text-sm
                    font-semibold
                    text-neutral-titulos
                    transition
                    hover:bg-background
                "
            >
                <IconoFlecha
                    className="
                        h-4
                        w-4
                    "
                />

                Tornar
            </button>
        </header>
    );
}

// ============================================================
// PROXIMAMENTE
// ============================================================

function Proximamente({
    titulo,
    texto,
}: {
    titulo:
        string;

    texto:
        string;
}) {
    return (
        <section
            className="
                rounded-2xl
                border
                border-border
                bg-card
                p-8
                text-center
            "
        >
            <IconoConstruccion
                className="
                    mx-auto
                    h-12
                    w-12
                    text-neutral
                "
            />

            <h2
                className="
                    mt-3
                    text-xl
                    font-bold
                    text-neutral-titulos
                "
            >
                {titulo}
            </h2>

            <p
                className="
                    mx-auto
                    mt-2
                    max-w-xl
                    text-sm
                    text-neutral
                "
            >
                {texto}
            </p>
        </section>
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

function IconoError({
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
            <circle
                cx="12"
                cy="12"
                r="9"
            />

            <path d="M12 7v6" />

            <path d="M12 17h.01" />
        </svg>
    );
}

function IconoPlay({
    className = "",
}: IconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className={
                className
            }
            aria-hidden="true"
        >
            <path d="M8 5.5v13l10-6.5-10-6.5Z" />
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

function IconoEditar({
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
            <path d="M4 20h4l11-11-4-4L4 16v4Z" />

            <path d="m13.5 6.5 4 4" />
        </svg>
    );
}

function IconoBloqueo({
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

function IconoOjo({
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
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />

            <circle
                cx="12"
                cy="12"
                r="2.5"
            />
        </svg>
    );
}

function IconoFlecha({
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
            <path d="M19 12H5" />

            <path d="m11 18-6-6 6-6" />
        </svg>
    );
}

function IconoConstruccion({
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
            <path d="M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-3.4 3.4-2.1-2.1a4 4 0 0 0 5 5L19 17.4a2.1 2.1 0 0 1-3 3l-7.7-7.7" />
        </svg>
    );
}

// ============================================================
// HELPERS
// ============================================================

function normalizarControl(
    control:
        ControlActa | undefined,
): ControlActa {
    if (
        !control
    ) {
        return {
            ...CONTROL_SIN_DATOS,
        };
    }

    return {
        puedeEditar:
            control.puedeEditar ===
            true,

        esControlador:
            control.esControlador ===
            true,

        puedeEscribir:
            control.puedeEscribir ===
            true,

        controlToken:
            typeof control.controlToken ===
                "string" &&
            control.controlToken
                .trim()
                .length >
                0
                ? control.controlToken
                : null,
    };
}

function crearParametros(
    torneoID:
        string,

    edicionID:
        string,

    partidoID:
        string,
) {
    return new URLSearchParams({
        torneoID,
        edicionID,
        partidoID,
    }).toString();
}

async function leerRespuesta<
    T extends {
        success: true;
    },
>(
    respuesta:
        Response,
): Promise<T> {
    let contenido:
        unknown;

    try {
        contenido =
            await respuesta.json();
    } catch {
        throw new Error(
            "La resposta del servidor no és vàlida.",
        );
    }

    if (
        !contenido ||
        typeof contenido !==
            "object" ||
        Array.isArray(
            contenido,
        )
    ) {
        throw new Error(
            "La resposta del servidor no és vàlida.",
        );
    }

    const datos =
        contenido as Record<
            string,
            unknown
        >;

    if (
        !respuesta.ok ||
        datos.success !==
            true
    ) {
        throw new Error(
            typeof datos.mensaje ===
                "string"
                ? datos.mensaje
                : "No s'ha pogut completar l'operació.",
        );
    }

    return contenido as T;
}

function normalizarDeporte(
    valor:
        string | null,
) {
    return (
        valor
            ?.trim()
            .normalize(
                "NFD",
            )
            .replace(
                /[\u0300-\u036f]/g,
                "",
            )
            .toUpperCase() ??
        ""
    );
}

function formatearFecha(
    valor:
        string,
) {
    const fecha =
        new Date(
            valor,
        );

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        return "";
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