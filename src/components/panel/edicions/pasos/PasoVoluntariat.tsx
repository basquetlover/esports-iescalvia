import {
    useId,
} from "react";

import type {
    ConfigVoluntarios,
    TipoVoluntariado,
} from "../Asistente";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    valor:
        ConfigVoluntarios;

    soloLectura:
        boolean;

    bloqueado:
        boolean;

    onCambiar: (
        valor:
            ConfigVoluntarios
    ) => void;
};

type ComportamientoCupo =
    ConfigVoluntarios["cupo"]["al_superar"];

// ============================================================
// OPCIONES
// ============================================================

const COMPORTAMIENTOS_CUPO: {
    valor:
        ComportamientoCupo;

    nombre:
        string;

    descripcion:
        string;
}[] = [
    {
        valor:
            "permitir",

        nombre:
            "Continuar acceptant",

        descripcion:
            "El màxim és orientatiu i es podran continuar enviant sol·licituds.",
    },

    {
        valor:
            "lista_espera",

        nombre:
            "Llista d'espera",

        descripcion:
            "Les noves sol·licituds quedaran registrades en llista d'espera.",
    },

    {
        valor:
            "bloquear",

        nombre:
            "Tancar inscripcions",

        descripcion:
            "Quan s'arribi al màxim no s'acceptaran més inscripcions.",
    },
];

// ============================================================
// HELPERS
// ============================================================

function fechaParaInput(
    valor:
        string | null
) {
    if (!valor) {
        return "";
    }

    const fecha =
        new Date(
            valor
        );

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {
        return valor.slice(
            0,
            16
        );
    }

    const desplazamiento =
        fecha.getTimezoneOffset() *
        60 *
        1000;

    return new Date(
        fecha.getTime() -
            desplazamiento
    )
        .toISOString()
        .slice(
            0,
            16
        );
}

function fechaDesdeInput(
    valor:
        string
): string | null {
    if (!valor) {
        return null;
    }

    const fecha =
        new Date(
            valor
        );

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {
        return null;
    }

    return fecha.toISOString();
}

function numeroNullable(
    valor:
        string
): number | null {
    if (
        valor.trim() ===
        ""
    ) {
        return null;
    }

    const numero =
        Number(
            valor
        );

    if (
        !Number.isFinite(
            numero
        )
    ) {
        return null;
    }

    return Math.max(
        0,
        Math.trunc(
            numero
        )
    );
}

function crearID() {
    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {
        return crypto.randomUUID();
    }

    return `voluntariat-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

// ============================================================
// ESTILOS
// ============================================================

const campo =
    "w-full rounded-lg border border-border bg-card " +
    "px-3.5 py-3 text-sm text-neutral outline-none " +
    "transition placeholder:text-neutral/50 " +
    "focus:border-primary focus:ring-2 focus:ring-primary/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

const etiqueta =
    "text-sm font-medium text-neutral-titulos";

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoVoluntariat({
    valor,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const tituloID =
        useId();

    const deshabilitado =
        soloLectura ||
        bloqueado;

    // ========================================================
    // ACTUALIZACIÓN CENTRAL
    // ========================================================

    function aplicar(
        nuevo:
            ConfigVoluntarios
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onCambiar(
            nuevo
        );
    }

    // ========================================================
    // INSCRIPCIÓN
    // ========================================================

    function cambiarInscripcion(
        campo:
            "apertura" |
            "cierre",

        nuevo:
            string | null
    ) {
        aplicar({
            ...valor,

            inscripcion: {
                ...valor.inscripcion,

                [campo]:
                    nuevo,
            },
        });
    }

    // ========================================================
    // CUPO GENERAL
    // ========================================================

    function cambiarCupoGeneral(
        maximo:
            number | null
    ) {
        aplicar({
            ...valor,

            cupo: {
                ...valor.cupo,

                maximo,
            },
        });
    }

    function cambiarComportamientoGeneral(
        al_superar:
            ComportamientoCupo
    ) {
        aplicar({
            ...valor,

            cupo: {
                ...valor.cupo,

                al_superar,
            },
        });
    }

    // ========================================================
    // TIPOS
    // ========================================================

    function agregarTipo() {
        const nuevo:
            TipoVoluntariado = {
            id:
                crearID(),

            nombre:
                "",

            descripcion:
                "",

            activo:
                true,

            cupo: {
                maximo:
                    null,

                al_superar:
                    "permitir",
            },
        };

        aplicar({
            ...valor,

            tipos: [
                ...valor.tipos,
                nuevo,
            ],
        });
    }

    function actualizarTipo(
        indice:
            number,

        nuevo:
            TipoVoluntariado
    ) {
        aplicar({
            ...valor,

            tipos:
                valor.tipos.map(
                    (
                        tipo,
                        i
                    ) =>
                        i ===
                        indice
                            ? nuevo
                            : tipo
                ),
        });
    }

    function eliminarTipo(
        indice:
            number
    ) {
        aplicar({
            ...valor,

            tipos:
                valor.tipos.filter(
                    (
                        _,
                        i
                    ) =>
                        i !==
                        indice
                ),
        });
    }

    function moverTipo(
        indice:
            number,

        direccion:
            -1 | 1
    ) {
        const destino =
            indice +
            direccion;

        if (
            destino <
                0 ||
            destino >=
                valor.tipos.length
        ) {
            return;
        }

        const nuevos =
            [
                ...valor.tipos,
            ];

        const temporal =
            nuevos[
                indice
            ];

        nuevos[
            indice
        ] =
            nuevos[
                destino
            ];

        nuevos[
            destino
        ] =
            temporal;

        aplicar({
            ...valor,

            tipos:
                nuevos,
        });
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <section
            aria-labelledby={
                tituloID
            }
            className="
                space-y-7
                text-neutral
            "
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <header
                className="
                    border-b
                    border-border
                    pb-5
                "
            >
                <div
                    className="
                        mb-3
                        flex
                        items-center
                        gap-2
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-border
                            bg-card
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="
                                h-4
                                w-4
                            "
                        >
                            <circle
                                cx="9"
                                cy="8"
                                r="3"
                            />

                            <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />

                            <path d="M17 8v6" />

                            <path d="M14 11h6" />
                        </svg>
                    </span>

                    <span
                        className="
                            text-xs
                            font-medium
                            tracking-wide
                        "
                    >
                        VOLUNTARIAT
                    </span>
                </div>

                <h2
                    id={
                        tituloID
                    }
                    className="
                        text-xl
                        font-semibold
                        tracking-tight
                        text-neutral-titulos
                    "
                >
                    Configuració del voluntariat
                </h2>

                <p
                    className="
                        mt-2
                        max-w-3xl
                        text-sm
                        leading-6
                    "
                >
                    Defineix quan es poden presentar
                    les sol·licituds de voluntariat,
                    el nombre orientatiu de persones i
                    els diferents tipus de funcions
                    disponibles.
                </p>
            </header>

            {/* =================================================
                PERIODO
            ================================================= */}

            <div
                className="
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    p-5
                "
            >
                <CabeceraBloque
                    titulo="Període d'inscripció"
                    descripcion="Indica durant quin període estarà disponible el formulari de voluntariat."
                />

                <div
                    className="
                        grid
                        grid-cols-1
                        gap-4
                        md:grid-cols-2
                    "
                >
                    <div
                        className="
                            space-y-2
                        "
                    >
                        <label
                            htmlFor="voluntariat-obertura"
                            className={
                                etiqueta
                            }
                        >
                            Obertura
                        </label>

                        <input
                            id="voluntariat-obertura"
                            type="datetime-local"
                            disabled={
                                deshabilitado
                            }
                            value={fechaParaInput(
                                valor
                                    .inscripcion
                                    .apertura
                            )}
                            onChange={
                                evento =>
                                    cambiarInscripcion(
                                        "apertura",

                                        fechaDesdeInput(
                                            evento
                                                .target
                                                .value
                                        )
                                    )
                            }
                            className={
                                campo
                            }
                        />
                    </div>

                    <div
                        className="
                            space-y-2
                        "
                    >
                        <label
                            htmlFor="voluntariat-tancament"
                            className={
                                etiqueta
                            }
                        >
                            Tancament
                        </label>

                        <input
                            id="voluntariat-tancament"
                            type="datetime-local"
                            min={fechaParaInput(
                                valor
                                    .inscripcion
                                    .apertura
                            )}
                            disabled={
                                deshabilitado
                            }
                            value={fechaParaInput(
                                valor
                                    .inscripcion
                                    .cierre
                            )}
                            onChange={
                                evento =>
                                    cambiarInscripcion(
                                        "cierre",

                                        fechaDesdeInput(
                                            evento
                                                .target
                                                .value
                                        )
                                    )
                            }
                            className={
                                campo
                            }
                        />
                    </div>
                </div>
            </div>

            {/* =================================================
                CUPO GENERAL
            ================================================= */}

            <div
                className="
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    p-5
                "
            >
                <CabeceraBloque
                    titulo="Nombre de voluntaris"
                    descripcion="Defineix el nombre màxim orientatiu de persones voluntàries per al conjunt de l'edició."
                />

                <div
                    className="
                        max-w-xs
                        space-y-2
                    "
                >
                    <label
                        htmlFor="voluntariat-maxim"
                        className={
                            etiqueta
                        }
                    >
                        Màxim orientatiu
                    </label>

                    <input
                        id="voluntariat-maxim"
                        type="number"
                        min={
                            0
                        }
                        step={
                            1
                        }
                        inputMode="numeric"
                        disabled={
                            deshabilitado
                        }
                        value={
                            valor
                                .cupo
                                .maximo ??
                            ""
                        }
                        onChange={
                            evento =>
                                cambiarCupoGeneral(
                                    numeroNullable(
                                        evento
                                            .target
                                            .value
                                    )
                                )
                        }
                        placeholder="Sense límit"
                        className={
                            campo
                        }
                    />

                    <p
                        className="
                            text-xs
                            leading-5
                            text-neutral/70
                        "
                    >
                        Aquest valor pot funcionar
                        simplement com una previsió; no
                        és necessari bloquejar les
                        inscripcions quan s'hi arribi.
                    </p>
                </div>

                <div
                    className="
                        mt-6
                    "
                >
                    <p
                        className={
                            etiqueta
                        }
                    >
                        Quan s'arribi al màxim
                    </p>

                    <div
                        className="
                            mt-3
                            grid
                            grid-cols-1
                            gap-3
                            lg:grid-cols-3
                        "
                    >
                        {COMPORTAMIENTOS_CUPO.map(
                            opcion => {
                                const seleccionado =
                                    valor
                                        .cupo
                                        .al_superar ===
                                    opcion.valor;

                                return (
                                    <button
                                        key={
                                            opcion.valor
                                        }
                                        type="button"
                                        disabled={
                                            deshabilitado
                                        }
                                        onClick={() =>
                                            cambiarComportamientoGeneral(
                                                opcion.valor
                                            )
                                        }
                                        className={`
                                            rounded-xl
                                            border
                                            p-4
                                            text-left
                                            transition
                                            disabled:cursor-not-allowed
                                            disabled:opacity-60

                                            ${
                                                seleccionado
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border bg-card hover:border-neutral/40"
                                            }
                                        `}
                                    >
                                        <div
                                            className="
                                                flex
                                                items-start
                                                justify-between
                                                gap-3
                                            "
                                        >
                                            <div>
                                                <p
                                                    className="
                                                        text-sm
                                                        font-semibold
                                                        text-neutral-titulos
                                                    "
                                                >
                                                    {
                                                        opcion.nombre
                                                    }
                                                </p>

                                                <p
                                                    className="
                                                        mt-1
                                                        text-xs
                                                        leading-5
                                                    "
                                                >
                                                    {
                                                        opcion.descripcion
                                                    }
                                                </p>
                                            </div>

                                            <Selector
                                                activo={
                                                    seleccionado
                                                }
                                            />
                                        </div>
                                    </button>
                                );
                            }
                        )}
                    </div>
                </div>
            </div>

            {/* =================================================
                TIPOS
            ================================================= */}

            <div
                className="
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    p-5
                "
            >
                <div
                    className="
                        flex
                        flex-col
                        gap-4
                        sm:flex-row
                        sm:items-start
                        sm:justify-between
                    "
                >
                    <CabeceraBloque
                        titulo="Tipus de voluntariat"
                        descripcion="Crea les funcions que podran seleccionar els voluntaris durant la inscripció."
                        sinMargen
                    />

                    {!soloLectura && (
                        <button
                            type="button"
                            disabled={
                                bloqueado
                            }
                            onClick={
                                agregarTipo
                            }
                            className="
                                inline-flex
                                shrink-0
                                items-center
                                justify-center
                                gap-2
                                rounded-lg
                                bg-primary
                                px-4
                                py-2.5
                                text-sm
                                font-semibold
                                text-white
                                transition
                                hover:bg-primary/90
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="M12 5v14" />

                                <path d="M5 12h14" />
                            </svg>

                            Afegir tipus
                        </button>
                    )}
                </div>

                {valor.tipos.length ===
                0 ? (
                    <div
                        className="
                            mt-5
                            rounded-xl
                            border
                            border-dashed
                            border-border
                            bg-card/40
                            px-5
                            py-8
                            text-center
                        "
                    >
                        <div
                            className="
                                mx-auto
                                flex
                                h-10
                                w-10
                                items-center
                                justify-center
                                rounded-xl
                                bg-primary/10
                                text-primary
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-5
                                    w-5
                                "
                            >
                                <circle
                                    cx="9"
                                    cy="8"
                                    r="3"
                                />

                                <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />

                                <path d="M17 8v6" />

                                <path d="M14 11h6" />
                            </svg>
                        </div>

                        <p
                            className="
                                mt-3
                                text-sm
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Encara no hi ha tipus de
                            voluntariat
                        </p>

                        <p
                            className="
                                mx-auto
                                mt-1
                                max-w-md
                                text-xs
                                leading-5
                            "
                        >
                            Pots crear, per exemple,
                            arbitratge, taula,
                            organització, fotografia o
                            streaming.
                        </p>
                    </div>
                ) : (
                    <div
                        className="
                            mt-5
                            space-y-4
                        "
                    >
                        {valor.tipos.map(
                            (
                                tipo,
                                indice
                            ) => (
                                <EditorTipo
                                    key={
                                        tipo.id
                                    }
                                    tipo={
                                        tipo
                                    }
                                    indice={
                                        indice
                                    }
                                    total={
                                        valor
                                            .tipos
                                            .length
                                    }
                                    disabled={
                                        deshabilitado
                                    }
                                    onCambiar={
                                        nuevo =>
                                            actualizarTipo(
                                                indice,
                                                nuevo
                                            )
                                    }
                                    onEliminar={() =>
                                        eliminarTipo(
                                            indice
                                        )
                                    }
                                    onSubir={() =>
                                        moverTipo(
                                            indice,
                                            -1
                                        )
                                    }
                                    onBajar={() =>
                                        moverTipo(
                                            indice,
                                            1
                                        )
                                    }
                                />
                            )
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

// ============================================================
// EDITOR DE TIPO
// ============================================================

function EditorTipo({
    tipo,
    indice,
    total,
    disabled,
    onCambiar,
    onEliminar,
    onSubir,
    onBajar,
}: {
    tipo:
        TipoVoluntariado;

    indice:
        number;

    total:
        number;

    disabled:
        boolean;

    onCambiar: (
        tipo:
            TipoVoluntariado
    ) => void;

    onEliminar:
        () => void;

    onSubir:
        () => void;

    onBajar:
        () => void;
}) {
    const idBase =
        useId();

    function cambiar<
        K extends keyof TipoVoluntariado,
    >(
        campo:
            K,

        valor:
            TipoVoluntariado[K]
    ) {
        if (
            disabled
        ) {
            return;
        }

        onCambiar({
            ...tipo,

            [campo]:
                valor,
        });
    }

    function cambiarCupo(
        campo:
            keyof TipoVoluntariado["cupo"],

        valor:
            TipoVoluntariado["cupo"][
                keyof TipoVoluntariado["cupo"]
            ]
    ) {
        if (
            disabled
        ) {
            return;
        }

        onCambiar({
            ...tipo,

            cupo: {
                ...tipo.cupo,

                [campo]:
                    valor,
            },
        });
    }

    return (
        <article
            className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card/35
            "
        >
            {/* CABECERA */}

            <div
                className="
                    flex
                    items-center
                    justify-between
                    gap-4
                    border-b
                    border-border
                    bg-card
                    px-4
                    py-3
                "
            >
                <div
                    className="
                        flex
                        min-w-0
                        items-center
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            flex
                            h-7
                            w-7
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-border
                            bg-background
                            text-xs
                            font-semibold
                        "
                    >
                        {indice +
                            1}
                    </span>

                    <div
                        className="
                            min-w-0
                        "
                    >
                        <p
                            className="
                                truncate
                                text-sm
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            {tipo.nombre ||
                                `Tipus ${indice + 1}`}
                        </p>

                        <p
                            className="
                                text-xs
                            "
                        >
                            {tipo.activo
                                ? "Disponible"
                                : "Desactivat"}
                        </p>
                    </div>
                </div>

                {!disabled && (
                    <div
                        className="
                            flex
                            shrink-0
                            items-center
                            gap-1
                        "
                    >
                        <button
                            type="button"
                            disabled={
                                indice ===
                                0
                            }
                            onClick={
                                onSubir
                            }
                            aria-label="Moure cap amunt"
                            className="
                                rounded-lg
                                p-2
                                transition
                                hover:bg-background
                                disabled:cursor-not-allowed
                                disabled:opacity-30
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="m18 15-6-6-6 6" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            disabled={
                                indice ===
                                total -
                                    1
                            }
                            onClick={
                                onBajar
                            }
                            aria-label="Moure cap avall"
                            className="
                                rounded-lg
                                p-2
                                transition
                                hover:bg-background
                                disabled:cursor-not-allowed
                                disabled:opacity-30
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            onClick={
                                onEliminar
                            }
                            aria-label="Eliminar tipus"
                            className="
                                rounded-lg
                                p-2
                                text-error
                                transition
                                hover:bg-error-container/40
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="M3 6h18" />

                                <path d="M8 6V4h8v2" />

                                <path d="M19 6l-1 14H6L5 6" />

                                <path d="M10 11v5" />

                                <path d="M14 11v5" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* CONTENIDO */}

            <div
                className="
                    space-y-5
                    p-4
                "
            >
                <div
                    className="
                        grid
                        grid-cols-1
                        gap-4
                        md:grid-cols-2
                    "
                >
                    <div
                        className="
                            space-y-2
                        "
                    >
                        <label
                            htmlFor={`${idBase}-nom`}
                            className={
                                etiqueta
                            }
                        >
                            Nom
                        </label>

                        <input
                            id={`${idBase}-nom`}
                            type="text"
                            disabled={
                                disabled
                            }
                            value={
                                tipo.nombre
                            }
                            onChange={
                                evento =>
                                    cambiar(
                                        "nombre",
                                        evento
                                            .target
                                            .value
                                    )
                            }
                            placeholder="Ex: Arbitratge"
                            className={
                                campo
                            }
                        />
                    </div>

                    <div
                        className="
                            space-y-2
                        "
                    >
                        <label
                            htmlFor={`${idBase}-maxim`}
                            className={
                                etiqueta
                            }
                        >
                            Màxim orientatiu
                        </label>

                        <input
                            id={`${idBase}-maxim`}
                            type="number"
                            min={
                                0
                            }
                            step={
                                1
                            }
                            inputMode="numeric"
                            disabled={
                                disabled
                            }
                            value={
                                tipo
                                    .cupo
                                    .maximo ??
                                ""
                            }
                            onChange={
                                evento =>
                                    cambiarCupo(
                                        "maximo",

                                        numeroNullable(
                                            evento
                                                .target
                                                .value
                                        )
                                    )
                            }
                            placeholder="Sense límit"
                            className={
                                campo
                            }
                        />
                    </div>
                </div>

                <div
                    className="
                        space-y-2
                    "
                >
                    <label
                        htmlFor={`${idBase}-descripcio`}
                        className={
                            etiqueta
                        }
                    >
                        Descripció
                    </label>

                    <textarea
                        id={`${idBase}-descripcio`}
                        rows={
                            3
                        }
                        disabled={
                            disabled
                        }
                        value={
                            tipo.descripcion
                        }
                        onChange={
                            evento =>
                                cambiar(
                                    "descripcion",
                                    evento
                                        .target
                                        .value
                                )
                        }
                        placeholder="Explica breument en què consisteix aquesta funció..."
                        className={`${campo} resize-y`}
                    />
                </div>

                <div
                    className="
                        grid
                        grid-cols-1
                        gap-4
                        lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]
                    "
                >
                    <Interruptor
                        activo={
                            tipo.activo
                        }
                        disabled={
                            disabled
                        }
                        titulo="Tipus disponible"
                        descripcion="Si està desactivat no apareixerà com a opció per als voluntaris."
                        onCambiar={
                            activo =>
                                cambiar(
                                    "activo",
                                    activo
                                )
                        }
                    />

                    <div>
                        <p
                            className={
                                etiqueta
                            }
                        >
                            Quan s'arribi al màxim
                        </p>

                        <div
                            className="
                                mt-2
                                grid
                                grid-cols-1
                                gap-2
                                sm:grid-cols-3
                            "
                        >
                            {COMPORTAMIENTOS_CUPO.map(
                                opcion => {
                                    const seleccionado =
                                        tipo
                                            .cupo
                                            .al_superar ===
                                        opcion.valor;

                                    return (
                                        <button
                                            key={
                                                opcion.valor
                                            }
                                            type="button"
                                            disabled={
                                                disabled
                                            }
                                            onClick={() =>
                                                cambiarCupo(
                                                    "al_superar",

                                                    opcion.valor
                                                )
                                            }
                                            className={`
                                                rounded-lg
                                                border
                                                px-3
                                                py-3
                                                text-left
                                                transition
                                                disabled:cursor-not-allowed
                                                disabled:opacity-60

                                                ${
                                                    seleccionado
                                                        ? "border-primary bg-primary/10"
                                                        : "border-border bg-background hover:border-neutral/40"
                                                }
                                            `}
                                        >
                                            <p
                                                className="
                                                    text-xs
                                                    font-semibold
                                                    text-neutral-titulos
                                                "
                                            >
                                                {
                                                    opcion.nombre
                                                }
                                            </p>
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}

// ============================================================
// INTERRUPTOR
// ============================================================

function Interruptor({
    activo,
    disabled,
    titulo,
    descripcion,
    onCambiar,
}: {
    activo:
        boolean;

    disabled:
        boolean;

    titulo:
        string;

    descripcion:
        string;

    onCambiar: (
        activo:
            boolean
    ) => void;
}) {
    return (
        <div
            className="
                flex
                items-start
                justify-between
                gap-4
                rounded-xl
                border
                border-border
                bg-background
                p-4
            "
        >
            <div>
                <p
                    className="
                        text-sm
                        font-semibold
                        text-neutral-titulos
                    "
                >
                    {titulo}
                </p>

                <p
                    className="
                        mt-1
                        text-xs
                        leading-5
                    "
                >
                    {descripcion}
                </p>
            </div>

            <button
                type="button"
                role="switch"
                aria-checked={
                    activo
                }
                disabled={
                    disabled
                }
                onClick={() =>
                    onCambiar(
                        !activo
                    )
                }
                className={`
                    relative
                    mt-0.5
                    h-6
                    w-11
                    shrink-0
                    rounded-full
                    border
                    transition
                    disabled:cursor-not-allowed
                    disabled:opacity-50

                    ${
                        activo
                            ? "border-primary bg-primary"
                            : "border-border bg-muted/40"
                    }
                `}
            >
                <span
                    aria-hidden="true"
                    className={`
                        absolute
                        top-0.5
                        h-4.5
                        w-4.5
                        rounded-full
                        bg-white
                        shadow-sm
                        transition-all

                        ${
                            activo
                                ? "left-[21px]"
                                : "left-0.5"
                        }
                    `}
                />
            </button>
        </div>
    );
}

// ============================================================
// SELECTOR
// ============================================================

function Selector({
    activo,
}: {
    activo:
        boolean;
}) {
    return (
        <span
            aria-hidden="true"
            className={`
                mt-0.5
                flex
                h-5
                w-5
                shrink-0
                items-center
                justify-center
                rounded-full
                border

                ${
                    activo
                        ? "border-primary bg-primary"
                        : "border-border bg-background"
                }
            `}
        >
            {activo && (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="
                        h-3
                        w-3
                        text-white
                    "
                >
                    <path d="m5 12 4 4L19 6" />
                </svg>
            )}
        </span>
    );
}

// ============================================================
// CABECERA
// ============================================================

function CabeceraBloque({
    titulo,
    descripcion,
    sinMargen = false,
}: {
    titulo:
        string;

    descripcion:
        string;

    sinMargen?:
        boolean;
}) {
    return (
        <div
            className={
                sinMargen
                    ? ""
                    : "mb-5"
            }
        >
            <h3
                className="
                    font-semibold
                    text-neutral-titulos
                "
            >
                {titulo}
            </h3>

            <p
                className="
                    mt-1
                    max-w-3xl
                    text-sm
                    leading-6
                "
            >
                {descripcion}
            </p>
        </div>
    );
}