import Cargando from "@components/Cargando";

import {
    formatearFechaCatalan,
} from "@utils/formatearFechas";

import {
    useEffect,
    useState,
} from "react";

// ============================================================
// TIPOS
// ============================================================

interface Edicion {
    id:
        string;

    torneo_id:
        string;

    nombre:
        string;

    fecha_inicio:
        string | null;

    fecha_fin:
        string | null;

    estado:
        string | null;

    sede:
        string | null;

    created_at:
        string | null;

    updated_at:
        string | null;

    puedeEditar:
        boolean;

    puedeEliminar:
        boolean;
}

interface Torneo {
    id:
        string;

    nombre:
        string | null;

    deporte:
        string | null;
}

interface RespuestaLista {
    success:
        true;

    torneo:
        Torneo;

    filas:
        Edicion[];

    puedeCrear:
        boolean;
}

// ============================================================
// HELPERS
// ============================================================

function nombreEstado(
    estado:
        string | null,
) {
    switch (
        estado
            ?.trim()
            .toUpperCase()
    ) {
        case "BORRADOR":
            return "En preparació";

        case "ACTIVA":
            return "Activa";

        case "FINALIZADA":
            return "Finalitzada";

        default:
            return estado ||
                "Sense estat";
    }
}

function claseEstado(
    estado:
        string | null,
) {
    switch (
        estado
            ?.trim()
            .toUpperCase()
    ) {
        case "ACTIVA":
            return `
                bg-primary
                text-neutral-titulos
            `;

        case "BORRADOR":
            return `
                bg-secondary
                text-background
            `;

        case "FINALIZADA":
            return `
                bg-muted
                text-neutral-titulos
            `;

        default:
            return `
                bg-muted
                text-neutral-titulos
            `;
    }
}

function mostrarFecha(
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return "—";
    }

    try {
        return formatearFechaCatalan(
            valor
        );
    } catch {
        return "—";
    }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Lista({
    torneoID,
}: {
    torneoID:
        string;
}) {
    const [
        ediciones,
        setEdiciones,
    ] =
        useState<Edicion[]>(
            []
        );

    const [
        torneo,
        setTorneo,
    ] =
        useState<Torneo | null>(
            null
        );

    const [
        cargando,
        setCargando,
    ] =
        useState(
            true
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const [
        puedeCrear,
        setPuedeCrear,
    ] =
        useState(
            false
        );

    const [
        guardado,
        setGuardado,
    ] =
        useState(
            ""
        );

    // ========================================================
    // MENSAJE DE GUARDADO
    // ========================================================

    useEffect(() => {
        const estado =
            new URLSearchParams(
                window.location.search
            ).get(
                "guardado"
            );

        if (
            estado ===
            "creada"
        ) {
            setGuardado(
                "Edició creada correctament."
            );
        }

        if (
            estado ===
            "editada"
        ) {
            setGuardado(
                "Edició actualitzada correctament."
            );
        }
    }, []);

    // ========================================================
    // CARGA
    // ========================================================

    useEffect(() => {
        const controlador =
            new AbortController();

        async function cargarEdiciones() {
            setCargando(
                true
            );

            setError(
                ""
            );

            try {
                const parametros =
                    new URLSearchParams({
                        vista:
                            "lista",

                        torneoID,
                    });

                const respuesta =
                    await fetch(
                        `/api/panell/edicions?${parametros.toString()}`,
                        {
                            credentials:
                                "same-origin",

                            cache:
                                "no-store",

                            signal:
                                controlador.signal,
                        }
                    );

                const json =
                    await respuesta
                        .json()
                        .catch(
                            () =>
                                null
                        );

                if (
                    !respuesta.ok ||
                    json?.success !==
                        true
                ) {
                    throw new Error(
                        json?.mensaje ||
                            "No s'han pogut carregar les edicions."
                    );
                }

                const datos =
                    json as RespuestaLista;

                setEdiciones(
                    datos.filas ??
                        []
                );

                setTorneo(
                    datos.torneo
                );

                setPuedeCrear(
                    Boolean(
                        datos.puedeCrear
                    )
                );
            } catch (
                err
            ) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setError(
                    err instanceof
                    Error
                        ? err.message
                        : "No s'han pogut carregar les edicions."
                );
            } finally {
                if (
                    !controlador
                        .signal
                        .aborted
                ) {
                    setCargando(
                        false
                    );
                }
            }
        }

        void cargarEdiciones();

        return () =>
            controlador.abort();
    }, [
        torneoID,
    ]);

    // ========================================================
    // UI
    // ========================================================

    return (
        <div
            className="
                relative
                flex
                h-auto
                w-full
                flex-wrap
                items-center
                gap-4
                p-4
                max-md:place-content-center
            "
        >
            {/* =================================================
                CARGANDO
            ================================================= */}

            {cargando && (
                <div
                    className="
                        flex
                        h-full
                        w-full
                        items-center
                        justify-center
                    "
                >
                    <Cargando />
                </div>
            )}

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
                <div
                    role="alert"
                    className="
                        w-full
                        rounded-lg
                        border
                        border-error
                        bg-error-container
                        p-4
                        text-error-foreground
                    "
                >
                    {error}
                </div>
            )}

            {/* =================================================
                GUARDADO
            ================================================= */}

            {guardado && (
                <div
                    role="status"
                    className="
                        w-full
                        rounded-lg
                        border
                        border-secondary/30
                        bg-secondary/10
                        p-4
                        text-secondary
                    "
                >
                    {guardado}
                </div>
            )}

            {/* =================================================
                TORNEO
            ================================================= */}

            {!cargando &&
                !error &&
                torneo && (
                <div
                    className="
                        w-full
                        pb-1
                    "
                >
                    <p
                        className="
                            text-sm
                            text-neutral
                        "
                    >
                        Torneig
                    </p>

                    <p
                        className="
                            text-lg
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        {torneo.nombre ||
                            "Torneig sense nom"}
                    </p>
                </div>
            )}

            {/* =================================================
                SIN EDICIONES
            ================================================= */}

            {!cargando &&
                !error &&
                ediciones.length ===
                    0 &&
                !puedeCrear && (
                <p
                    className="
                        w-full
                    "
                >
                    No hi ha edicions disponibles.
                </p>
            )}

            {/* =================================================
                EDICIONES
            ================================================= */}

            {!cargando &&
                !error &&
                ediciones.map(
                    edicion => (
                        <div
                            key={
                                edicion.id
                            }
                            className="
                                flex
                                h-105
                                w-64
                                flex-col
                                overflow-hidden
                                rounded-lg
                                bg-card
                            "
                        >
                            {/* =================================
                                CABECERA
                            ================================= */}

                            <div
                                className="
                                    relative
                                    flex
                                    h-32
                                    w-full
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-t-lg
                                    bg-primary/20
                                "
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 -960 960 960"
                                    aria-hidden="true"
                                    className="
                                        h-12
                                        w-12
                                        fill-secondary
                                    "
                                >
                                    <path
                                        d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80zm0-80h560v-400H200zm0-480h560v-80H200zm280 240q-17 0-28.5-11.5T440-440t11.5-28.5T480-480t28.5 11.5T520-440t-11.5 28.5T480-400"
                                    />
                                </svg>

                                <p
                                    className={`
                                        absolute
                                        right-2
                                        top-2
                                        z-30
                                        h-max
                                        w-max
                                        rounded-full
                                        px-2
                                        py-px
                                        text-sm
                                        ${claseEstado(
                                            edicion.estado
                                        )}
                                    `}
                                >
                                    {nombreEstado(
                                        edicion.estado
                                    )}
                                </p>
                            </div>

                            {/* =================================
                                CONTENIDO
                            ================================= */}

                            <div
                                className="
                                    flex
                                    min-h-0
                                    flex-1
                                    flex-col
                                    gap-y-1
                                    p-3
                                "
                            >
                                <p
                                    className="
                                        line-clamp-2
                                        text-base
                                        font-bold
                                        text-neutral-titulos
                                    "
                                >
                                    {edicion.nombre ||
                                        "Edició sense nom"}
                                </p>

                                {edicion.sede && (
                                    <div
                                        className="
                                            flex
                                            items-center
                                            gap-x-1
                                            text-sm
                                        "
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 -960 960 960"
                                            aria-hidden="true"
                                            className="
                                                h-4
                                                w-4
                                                shrink-0
                                                fill-neutral
                                            "
                                        >
                                            <path
                                                d="M480-80q-139-119-209.5-216T200-480q0-126 87-213t213-87 213 87 87 213q0 87-70.5 184T480-80m0-240q66 0 113-47t47-113-47-113-113-47-113 47-47 113 47 113 113 47"
                                            />
                                        </svg>

                                        <p
                                            className="
                                                truncate
                                            "
                                            title={
                                                edicion.sede
                                            }
                                        >
                                            {edicion.sede}
                                        </p>
                                    </div>
                                )}

                                <div
                                    className="
                                        my-3
                                        h-0.5
                                        w-full
                                        rounded
                                        bg-muted/40
                                    "
                                />

                                {/* =============================
                                    FECHAS
                                ============================= */}

                                <div
                                    className="
                                        grid
                                        w-full
                                        grid-cols-2
                                        gap-x-2
                                        text-sm
                                    "
                                >
                                    <div
                                        className="
                                            w-full
                                            px-1
                                        "
                                    >
                                        <p
                                            className="
                                                uppercase
                                            "
                                        >
                                            Inici
                                        </p>

                                        <p
                                            className="
                                                text-neutral-titulos
                                            "
                                        >
                                            {mostrarFecha(
                                                edicion.fecha_inicio
                                            )}
                                        </p>
                                    </div>

                                    <div
                                        className="
                                            w-full
                                            px-1
                                        "
                                    >
                                        <p
                                            className="
                                                uppercase
                                            "
                                        >
                                            Final
                                        </p>

                                        <p
                                            className="
                                                text-neutral-titulos
                                            "
                                        >
                                            {mostrarFecha(
                                                edicion.fecha_fin
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div
                                    className="
                                        my-3
                                        h-0.5
                                        w-full
                                        rounded
                                        bg-muted/40
                                    "
                                />

                                {/* =============================
                                    ACCIONES
                                ============================= */}

                                <div
                                    className="
                                        mt-auto
                                        flex
                                        w-full
                                        flex-wrap
                                        items-center
                                        justify-center
                                        gap-2
                                    "
                                >
                                    <a
                                        href={`/panell/info/edicio?${new URLSearchParams(
                                            {
                                                accio:
                                                    "ver",

                                                torneoID,

                                                edicionID:
                                                    edicion.id,
                                            }
                                        ).toString()}`}
                                        className="
                                            h-max
                                            w-max
                                            rounded-lg
                                            border
                                            border-primary
                                            bg-background/80
                                            px-4
                                            py-2
                                            text-secondary
                                            transition
                                            hover:bg-background/60
                                        "
                                    >
                                        Consultar
                                    </a>

                                    {edicion.puedeEditar && (
                                        <a
                                            href={`/panell/info/edicio?${new URLSearchParams(
                                                {
                                                    accio:
                                                        "editar",

                                                    torneoID,

                                                    edicionID:
                                                        edicion.id,
                                                }
                                            ).toString()}`}
                                            className="
                                                h-max
                                                w-max
                                                rounded-lg
                                                bg-primary
                                                px-4
                                                py-2
                                                font-medium
                                                text-white
                                                transition
                                                hover:bg-primary/90
                                            "
                                        >
                                            Editar
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                )}

            {/* =================================================
                NUEVA EDICIÓN
            ================================================= */}

            {!cargando &&
                !error &&
                puedeCrear && (
                <div
                    className="
                        relative
                        flex
                        h-105
                        w-64
                        flex-col
                        overflow-hidden
                        rounded-lg
                        bg-card
                    "
                >
                    <div
                        className="
                            flex
                            h-32
                            w-full
                            shrink-0
                            items-center
                            justify-center
                            rounded-t-lg
                            bg-primary/30
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 -960 960 960"
                            aria-hidden="true"
                            className="
                                h-12
                                w-12
                                fill-secondary
                            "
                        >
                            <path
                                d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160zm40 200q-83 0-156-31.5T197-197t-85.5-127T80-480t31.5-156T197-763t127-85.5T480-880t156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80"
                            />
                        </svg>
                    </div>

                    <div
                        className="
                            flex
                            flex-1
                            flex-col
                            items-center
                            gap-y-5
                            p-3
                            pt-6
                        "
                    >
                        <p
                            className="
                                text-base
                                font-bold
                                text-neutral-titulos
                            "
                        >
                            Nova edició
                        </p>

                        <p
                            className="
                                text-center
                                text-sm
                            "
                        >
                            Crea una nova edició del torneig i
                            configura els equips, el voluntariat
                            i la informació pública.
                        </p>

                        <a
                            href={`/panell/info/edicio?${new URLSearchParams(
                                {
                                    accio:
                                        "crear",

                                    torneoID,
                                }
                            ).toString()}`}
                            className="
                                mt-auto
                                h-max
                                w-max
                                rounded-lg
                                border
                                border-primary
                                bg-background/80
                                px-4
                                py-2
                                text-secondary
                                transition
                                hover:bg-background/60
                            "
                        >
                            Començar
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}