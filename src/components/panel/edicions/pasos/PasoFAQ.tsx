import {
    useId,
} from "react";

import type {
    ConfigFAQ,
    PreguntaFAQ,
} from "../Asistente";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    valor:
        ConfigFAQ;

    soloLectura:
        boolean;

    bloqueado:
        boolean;

    onCambiar: (
        valor:
            ConfigFAQ,
    ) => void;
};

// ============================================================
// ESTILOS
// ============================================================

const campo =
    "w-full rounded-lg border border-border bg-card " +
    "px-3.5 py-3 text-sm text-neutral outline-none " +
    "transition placeholder:text-neutral/50 " +
    "focus:border-primary focus:ring-2 focus:ring-primary/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

// ============================================================
// HELPERS
// ============================================================

function crearID() {
    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {
        return crypto.randomUUID();
    }

    return `faq-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

function nuevaPregunta(
    order:
        number,
): PreguntaFAQ {
    return {
        id:
            crearID(),

        order,

        pregunta:
            "",

        respuesta:
            "",

        activo:
            true,
    };
}

function normalizarOrden(
    preguntas:
        PreguntaFAQ[],
): PreguntaFAQ[] {
    return preguntas.map(
        (
            pregunta,
            indice,
        ) => ({
            ...pregunta,

            order:
                indice +
                1,
        }),
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoFAQ({
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
    // APLICAR
    // ========================================================

    function aplicar(
        preguntas:
            PreguntaFAQ[],
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onCambiar({
            preguntas:
                normalizarOrden(
                    preguntas
                ),
        });
    }

    // ========================================================
    // CREAR
    // ========================================================

    function agregar() {
        aplicar([
            ...valor.preguntas,

            nuevaPregunta(
                valor
                    .preguntas
                    .length +
                    1
            ),
        ]);
    }

    // ========================================================
    // ACTUALIZAR
    // ========================================================

    function actualizar(
        indice:
            number,

        nueva:
            PreguntaFAQ,
    ) {
        aplicar(
            valor
                .preguntas
                .map(
                    (
                        pregunta,
                        i,
                    ) =>
                        i ===
                        indice
                            ? nueva
                            : pregunta
                )
        );
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar(
        indice:
            number,
    ) {
        aplicar(
            valor
                .preguntas
                .filter(
                    (
                        _,
                        i,
                    ) =>
                        i !==
                        indice
                )
        );
    }

    // ========================================================
    // MOVER
    // ========================================================

    function mover(
        indice:
            number,

        direccion:
            -1 | 1,
    ) {
        const destino =
            indice +
            direccion;

        if (
            destino <
                0 ||
            destino >=
                valor
                    .preguntas
                    .length
        ) {
            return;
        }

        const nuevas =
            [
                ...valor.preguntas,
            ];

        const temporal =
            nuevas[
                indice
            ];

        nuevas[
            indice
        ] =
            nuevas[
                destino
            ];

        nuevas[
            destino
        ] =
            temporal;

        aplicar(
            nuevas
        );
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
                                cx="12"
                                cy="12"
                                r="9"
                            />

                            <path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.08c-.9.52-1.4 1.02-1.4 1.92" />

                            <path d="M12 17h.01" />
                        </svg>
                    </span>

                    <span
                        className="
                            text-xs
                            font-medium
                            tracking-wide
                        "
                    >
                        FAQ
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
                    Preguntes freqüents
                </h2>

                <p
                    className="
                        mt-2
                        max-w-3xl
                        text-sm
                        leading-6
                    "
                >
                    Defineix les preguntes i respostes que es
                    mostraran públicament a la pàgina del torneig.
                </p>
            </header>

            {/* =================================================
                CABECERA LISTA
            ================================================= */}

            <div
                className="
                    flex
                    flex-col
                    gap-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                "
            >
                <div>
                    <h3
                        className="
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        Preguntes
                    </h3>

                    <p
                        className="
                            mt-1
                            text-sm
                            leading-6
                        "
                    >
                        Pots ordenar-les, ocultar-les temporalment
                        o eliminar-les.
                    </p>
                </div>

                {
                    !soloLectura && (
                        <button
                            type="button"
                            disabled={
                                bloqueado
                            }
                            onClick={
                                agregar
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

                            Afegir pregunta
                        </button>
                    )
                }
            </div>

            {/* =================================================
                VACÍO
            ================================================= */}

            {
                valor
                    .preguntas
                    .length ===
                0 ? (
                    <div
                        className="
                            rounded-2xl
                            border
                            border-dashed
                            border-border
                            bg-card/35
                            px-6
                            py-12
                            text-center
                        "
                    >
                        <div
                            className="
                                mx-auto
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
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-6
                                    w-6
                                "
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                />

                                <path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.08c-.9.52-1.4 1.02-1.4 1.92" />

                                <path d="M12 17h.01" />
                            </svg>
                        </div>

                        <h3
                            className="
                                mt-4
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Encara no hi ha preguntes freqüents
                        </h3>

                        <p
                            className="
                                mx-auto
                                mt-2
                                max-w-lg
                                text-sm
                                leading-6
                            "
                        >
                            Afegeix les preguntes més habituals
                            sobre inscripcions, equips, terminis o
                            qualsevol altre dubte.
                        </p>

                        {
                            !soloLectura && (
                                <button
                                    type="button"
                                    disabled={
                                        bloqueado
                                    }
                                    onClick={
                                        agregar
                                    }
                                    className="
                                        mt-5
                                        inline-flex
                                        items-center
                                        justify-center
                                        rounded-lg
                                        border
                                        border-primary
                                        bg-background
                                        px-4
                                        py-2.5
                                        text-sm
                                        font-semibold
                                        text-secondary
                                        transition
                                        hover:bg-card
                                        disabled:cursor-not-allowed
                                        disabled:opacity-50
                                    "
                                >
                                    Crear la primera pregunta
                                </button>
                            )
                        }
                    </div>
                ) : (
                    <div
                        className="
                            space-y-4
                        "
                    >
                        {
                            valor
                                .preguntas
                                .map(
                                    (
                                        pregunta,
                                        indice,
                                    ) => (
                                        <article
                                            key={
                                                pregunta.id
                                            }
                                            className="
                                                rounded-2xl
                                                border
                                                border-border
                                                bg-background
                                                p-5
                                            "
                                        >
                                            {/* =================
                                                CABECERA
                                            ================= */}

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
                                                <div
                                                    className="
                                                        flex
                                                        min-w-0
                                                        items-center
                                                        gap-3
                                                    "
                                                >
                                                    <span
                                                        className="
                                                            flex
                                                            h-8
                                                            w-8
                                                            shrink-0
                                                            items-center
                                                            justify-center
                                                            rounded-lg
                                                            bg-card
                                                            text-xs
                                                            font-semibold
                                                            text-neutral-titulos
                                                        "
                                                    >
                                                        {
                                                            indice +
                                                            1
                                                        }
                                                    </span>

                                                    <div
                                                        className="
                                                            min-w-0
                                                        "
                                                    >
                                                        <p
                                                            className="
                                                                text-sm
                                                                font-semibold
                                                                text-neutral-titulos
                                                            "
                                                        >
                                                            Pregunta{" "}
                                                            {
                                                                indice +
                                                                1
                                                            }
                                                        </p>

                                                        <p
                                                            className="
                                                                mt-0.5
                                                                text-xs
                                                                text-neutral/70
                                                            "
                                                        >
                                                            {
                                                                pregunta.activo
                                                                    ? "Visible públicament"
                                                                    : "Oculta públicament"
                                                            }
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* =================
                                                    ACCIONES
                                                ================= */}

                                                <div
                                                    className="
                                                        flex
                                                        flex-wrap
                                                        items-center
                                                        gap-2
                                                    "
                                                >
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={
                                                            pregunta.activo
                                                        }
                                                        disabled={
                                                            deshabilitado
                                                        }
                                                        onClick={() =>
                                                            actualizar(
                                                                indice,
                                                                {
                                                                    ...pregunta,

                                                                    activo:
                                                                        !pregunta.activo,
                                                                }
                                                            )
                                                        }
                                                        className={`
                                                            relative
                                                            h-6
                                                            w-11
                                                            rounded-full
                                                            border
                                                            transition
                                                            disabled:cursor-not-allowed
                                                            disabled:opacity-50

                                                            ${
                                                                pregunta.activo
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
                                                                    pregunta.activo
                                                                        ? "left-5.25"
                                                                        : "left-0.5"
                                                                }
                                                            `}
                                                        />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Pujar"
                                                        disabled={
                                                            deshabilitado ||
                                                            indice ===
                                                                0
                                                        }
                                                        onClick={() =>
                                                            mover(
                                                                indice,
                                                                -1
                                                            )
                                                        }
                                                        className="
                                                            inline-flex
                                                            h-8
                                                            w-8
                                                            items-center
                                                            justify-center
                                                            rounded-lg
                                                            border
                                                            border-border
                                                            bg-card
                                                            text-neutral
                                                            transition
                                                            hover:border-neutral/40
                                                            disabled:cursor-not-allowed
                                                            disabled:opacity-35
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
                                                        title="Baixar"
                                                        disabled={
                                                            deshabilitado ||
                                                            indice ===
                                                                valor
                                                                    .preguntas
                                                                    .length -
                                                                    1
                                                        }
                                                        onClick={() =>
                                                            mover(
                                                                indice,
                                                                1
                                                            )
                                                        }
                                                        className="
                                                            inline-flex
                                                            h-8
                                                            w-8
                                                            items-center
                                                            justify-center
                                                            rounded-lg
                                                            border
                                                            border-border
                                                            bg-card
                                                            text-neutral
                                                            transition
                                                            hover:border-neutral/40
                                                            disabled:cursor-not-allowed
                                                            disabled:opacity-35
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

                                                    {
                                                        !soloLectura && (
                                                            <button
                                                                type="button"
                                                                title="Eliminar"
                                                                disabled={
                                                                    bloqueado
                                                                }
                                                                onClick={() =>
                                                                    eliminar(
                                                                        indice
                                                                    )
                                                                }
                                                                className="
                                                                    inline-flex
                                                                    h-8
                                                                    w-8
                                                                    items-center
                                                                    justify-center
                                                                    rounded-lg
                                                                    border
                                                                    border-error/20
                                                                    bg-error-container/30
                                                                    text-error
                                                                    transition
                                                                    hover:bg-error-container/60
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
                                                                    <path d="M3 6h18" />

                                                                    <path d="M8 6V4h8v2" />

                                                                    <path d="M19 6l-1 14H6L5 6" />
                                                                </svg>
                                                            </button>
                                                        )
                                                    }
                                                </div>
                                            </div>

                                            {/* =================
                                                CAMPOS
                                            ================= */}

                                            <div
                                                className="
                                                    mt-5
                                                    grid
                                                    gap-4
                                                "
                                            >
                                                <div
                                                    className="
                                                        space-y-2
                                                    "
                                                >
                                                    <label
                                                        htmlFor={`faq-pregunta-${pregunta.id}`}
                                                        className="
                                                            text-sm
                                                            font-medium
                                                            text-neutral-titulos
                                                        "
                                                    >
                                                        Pregunta
                                                    </label>

                                                    <input
                                                        id={`faq-pregunta-${pregunta.id}`}
                                                        type="text"
                                                        maxLength={
                                                            200
                                                        }
                                                        disabled={
                                                            deshabilitado
                                                        }
                                                        value={
                                                            pregunta.pregunta
                                                        }
                                                        onChange={
                                                            evento =>
                                                                actualizar(
                                                                    indice,
                                                                    {
                                                                        ...pregunta,

                                                                        pregunta:
                                                                            evento
                                                                                .target
                                                                                .value,
                                                                    }
                                                                )
                                                        }
                                                        placeholder="Ex: Puc participar si no tinc un equip complet?"
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
                                                        htmlFor={`faq-resposta-${pregunta.id}`}
                                                        className="
                                                            text-sm
                                                            font-medium
                                                            text-neutral-titulos
                                                        "
                                                    >
                                                        Resposta
                                                    </label>

                                                    <textarea
                                                        id={`faq-resposta-${pregunta.id}`}
                                                        rows={
                                                            4
                                                        }
                                                        maxLength={
                                                            5000
                                                        }
                                                        disabled={
                                                            deshabilitado
                                                        }
                                                        value={
                                                            pregunta.respuesta
                                                        }
                                                        onChange={
                                                            evento =>
                                                                actualizar(
                                                                    indice,
                                                                    {
                                                                        ...pregunta,

                                                                        respuesta:
                                                                            evento
                                                                                .target
                                                                                .value,
                                                                    }
                                                                )
                                                        }
                                                        placeholder="Escriu la resposta que es mostrarà públicament."
                                                        className={
                                                            campo
                                                        }
                                                    />

                                                    <p
                                                        className="
                                                            text-right
                                                            text-[11px]
                                                            text-neutral/60
                                                        "
                                                    >
                                                        {
                                                            pregunta
                                                                .respuesta
                                                                .length
                                                        }
                                                        /5000
                                                    </p>
                                                </div>
                                            </div>
                                        </article>
                                    )
                                )
                        }
                    </div>
                )
            }
        </section>
    );
}