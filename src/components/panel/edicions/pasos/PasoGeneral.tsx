import {
    useId,
} from "react";

import type {
    DatosGeneralesEdicion,
    TorneoEdicion,
} from "../Asistente";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    valor:
        DatosGeneralesEdicion;

    torneo:
        TorneoEdicion;

    soloLectura:
        boolean;

    bloqueado:
        boolean;

    onCambiar: (
        valor:
            DatosGeneralesEdicion
    ) => void;
};

// ============================================================
// ESTADOS
// ============================================================

const ESTADOS = [
    {
        valor:
            "BORRADOR",

        nombre:
            "Esborrany",

        descripcion:
            "L'edició encara s'està preparant.",
    },

    {
        valor:
            "ACTIVA",

        nombre:
            "Activa",

        descripcion:
            "L'edició està activa i disponible.",
    },

    {
        valor:
            "FINALIZADA",

        nombre:
            "Finalitzada",

        descripcion:
            "L'edició ja ha finalitzat.",
    },
] as const;

// ============================================================
// FECHAS
// ============================================================

function fechaParaInput(
    valor:
        string
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
        /*
         * Si ya viene en formato datetime-local,
         * lo conservamos.
         */
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
        return valor;
    }

    return fecha.toISOString();
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

export default function PasoGeneral({
    valor,
    torneo,
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
    // ACTUALIZAR CAMPO
    // ========================================================

    function cambiar<
        K extends keyof DatosGeneralesEdicion,
    >(
        campo:
            K,

        nuevoValor:
            DatosGeneralesEdicion[K],
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onCambiar({
            ...valor,

            [campo]:
                nuevoValor,
        });
    }

    const estadoActual =
        ESTADOS.find(
            estado =>
                estado.valor ===
                valor.estado
        );

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
                            <rect
                                x="3"
                                y="5"
                                width="18"
                                height="16"
                                rx="2"
                            />

                            <path d="M16 3v4" />

                            <path d="M8 3v4" />

                            <path d="M3 10h18" />
                        </svg>
                    </span>

                    <span
                        className="
                            text-xs
                            font-medium
                            tracking-wide
                        "
                    >
                        INFORMACIÓ GENERAL
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
                    Configura l'edició
                </h2>

                <p
                    className="
                        mt-2
                        max-w-2xl
                        text-sm
                        leading-6
                    "
                >
                    Defineix les dades principals de
                    l'edició, les dates en què se
                    celebrarà, el seu estat i la seu.
                </p>
            </header>

            {/* =================================================
                TORNEO
            ================================================= */}

            <div
                className="
                    rounded-xl
                    border
                    border-border
                    bg-card/40
                    p-4
                "
            >
                <div
                    className="
                        flex
                        items-start
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
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
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="
                                h-4.5
                                w-4.5
                            "
                        >
                            <path d="M6 9V2h12v7" />

                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />

                            <rect
                                x="6"
                                y="14"
                                width="12"
                                height="8"
                            />
                        </svg>
                    </span>

                    <div
                        className="
                            min-w-0
                        "
                    >
                        <p
                            className="
                                text-xs
                                font-medium
                                uppercase
                                tracking-wide
                            "
                        >
                            Torneig
                        </p>

                        <p
                            className="
                                mt-0.5
                                truncate
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            {torneo.nombre ||
                                "Torneig sense nom"}
                        </p>

                        {torneo.deporte && (
                            <p
                                className="
                                    mt-0.5
                                    text-sm
                                "
                            >
                                {torneo.deporte}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* =================================================
                IDENTIFICACIÓN
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
                        mb-5
                        flex
                        items-start
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            mt-0.5
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-card
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
                                h-4
                                w-4
                            "
                        >
                            <path d="M4 6h16" />

                            <path d="M4 12h16" />

                            <path d="M4 18h10" />
                        </svg>
                    </span>

                    <div>
                        <h3
                            className="
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Identificació
                        </h3>

                        <p
                            className="
                                mt-1
                                text-sm
                                leading-6
                            "
                        >
                            Indica el nom amb què
                            s'identificarà aquesta
                            edició.
                        </p>
                    </div>
                </div>

                <div
                    className="
                        space-y-2
                    "
                >
                    <label
                        htmlFor="edicio-nom"
                        className={
                            etiqueta
                        }
                    >
                        Nom de l'edició
                    </label>

                    <input
                        id="edicio-nom"
                        type="text"
                        maxLength={
                            150
                        }
                        disabled={
                            deshabilitado
                        }
                        value={
                            valor.nombre
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
                        placeholder="Ex: Edició 2026/27"
                        className={
                            campo
                        }
                    />

                    <p
                        className="
                            text-xs
                            text-neutral/70
                        "
                    >
                        Utilitza un nom que permeti
                        diferenciar fàcilment aquesta
                        edició de les anteriors.
                    </p>
                </div>
            </div>

            {/* =================================================
                FECHAS
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
                        mb-5
                        flex
                        items-start
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            mt-0.5
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-card
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
                                h-4
                                w-4
                            "
                        >
                            <rect
                                x="3"
                                y="5"
                                width="18"
                                height="16"
                                rx="2"
                            />

                            <path d="M16 3v4" />

                            <path d="M8 3v4" />

                            <path d="M3 10h18" />
                        </svg>
                    </span>

                    <div>
                        <h3
                            className="
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Dates de l'edició
                        </h3>

                        <p
                            className="
                                mt-1
                                text-sm
                                leading-6
                            "
                        >
                            Defineix quan començarà i
                            quan finalitzarà aquesta
                            edició.
                        </p>
                    </div>
                </div>

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
                            htmlFor="edicio-inici"
                            className={
                                etiqueta
                            }
                        >
                            Data d'inici
                        </label>

                        <input
                            id="edicio-inici"
                            type="datetime-local"
                            disabled={
                                deshabilitado
                            }
                            value={fechaParaInput(
                                valor.fecha_inicio
                            )}
                            onChange={
                                evento =>
                                    cambiar(
                                        "fecha_inicio",
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
                            htmlFor="edicio-final"
                            className={
                                etiqueta
                            }
                        >
                            Data de finalització
                        </label>

                        <input
                            id="edicio-final"
                            type="datetime-local"
                            min={fechaParaInput(
                                valor.fecha_inicio
                            )}
                            disabled={
                                deshabilitado
                            }
                            value={fechaParaInput(
                                valor.fecha_fin
                            )}
                            onChange={
                                evento =>
                                    cambiar(
                                        "fecha_fin",
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
                SEDE
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
                        mb-5
                        flex
                        items-start
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            mt-0.5
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-card
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
                                h-4
                                w-4
                            "
                        >
                            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

                            <circle
                                cx="12"
                                cy="10"
                                r="2.5"
                            />
                        </svg>
                    </span>

                    <div>
                        <h3
                            className="
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Seu
                        </h3>

                        <p
                            className="
                                mt-1
                                text-sm
                                leading-6
                            "
                        >
                            Indica on se celebrarà
                            principalment l'edició.
                        </p>
                    </div>
                </div>

                <div
                    className="
                        space-y-2
                    "
                >
                    <label
                        htmlFor="edicio-seu"
                        className={
                            etiqueta
                        }
                    >
                        Seu de l'edició
                    </label>

                    <input
                        id="edicio-seu"
                        type="text"
                        disabled={
                            deshabilitado
                        }
                        value={
                            valor.sede
                        }
                        onChange={
                            evento =>
                                cambiar(
                                    "sede",
                                    evento
                                        .target
                                        .value
                                )
                        }
                        placeholder="Ex: IES Calvià"
                        className={
                            campo
                        }
                    />
                </div>
            </div>

            {/* =================================================
                ESTADO
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
                        mb-5
                        flex
                        items-start
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            mt-0.5
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            bg-card
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
                                h-4
                                w-4
                            "
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                            />

                            <path d="m8 12 2.5 2.5L16 9" />
                        </svg>
                    </span>

                    <div>
                        <h3
                            className="
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Estat de l'edició
                        </h3>

                        <p
                            className="
                                mt-1
                                text-sm
                                leading-6
                            "
                        >
                            Controla en quin punt del
                            seu cicle es troba
                            l'edició.
                        </p>
                    </div>
                </div>

                <div
                    className="
                        grid
                        grid-cols-1
                        gap-3
                        md:grid-cols-3
                    "
                >
                    {ESTADOS.map(
                        estado => {
                            const seleccionado =
                                valor.estado ===
                                estado.valor;

                            return (
                                <button
                                    key={
                                        estado.valor
                                    }
                                    type="button"
                                    disabled={
                                        deshabilitado
                                    }
                                    onClick={() =>
                                        cambiar(
                                            "estado",
                                            estado.valor
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
                                                    estado.nombre
                                                }
                                            </p>

                                            <p
                                                className="
                                                    mt-1
                                                    text-xs
                                                    leading-5
                                                    text-neutral
                                                "
                                            >
                                                {
                                                    estado.descripcion
                                                }
                                            </p>
                                        </div>

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
                                                    seleccionado
                                                        ? "border-primary bg-primary"
                                                        : "border-border bg-background"
                                                }
                                            `}
                                        >
                                            {seleccionado && (
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
                                    </div>
                                </button>
                            );
                        }
                    )}
                </div>

                {estadoActual && (
                    <p
                        className="
                            mt-4
                            text-xs
                            text-neutral/70
                        "
                    >
                        Estat seleccionat:{" "}
                        <span
                            className="
                                font-medium
                                text-neutral-titulos
                            "
                        >
                            {
                                estadoActual.nombre
                            }
                        </span>
                    </p>
                )}
            </div>
        </section>
    );
}