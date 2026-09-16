import {
    useId,
} from "react";

import type {
    ConfigEquipos,
} from "../Asistente";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    valor:
        ConfigEquipos;

    soloLectura:
        boolean;

    bloqueado:
        boolean;

    onCambiar: (
        valor:
            ConfigEquipos
    ) => void;
};

type ComportamientoCupo =
    ConfigEquipos["cupo"]["al_superar"];

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
            "El nombre indicat és orientatiu. Les inscripcions continuaran obertes encara que se superi.",
    },

    {
        valor:
            "lista_espera",

        nombre:
            "Llista d'espera",

        descripcion:
            "Les noves inscripcions es podran registrar, però quedaran en llista d'espera.",
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
// HELPERS DE FECHA
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

// ============================================================
// HELPERS DE NÚMEROS
// ============================================================

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

function numeroEntero(
    valor:
        string
): number {
    const numero =
        Number(
            valor
        );

    if (
        !Number.isFinite(
            numero
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.trunc(
            numero
        )
    );
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

export default function PasoEquips({
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
    // ACTUALIZAR
    // ========================================================

    function aplicar(
        nuevo:
            ConfigEquipos
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
    // CUPO
    // ========================================================

    function cambiarMaximoEquipos(
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

    function cambiarComportamiento(
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
    // JUGADORES
    // ========================================================

    function cambiarJugadores(
        campo:
            "minimo" |
            "maximo",

        nuevo:
            number | null
    ) {
        aplicar({
            ...valor,

            jugadores: {
                ...valor.jugadores,

                [campo]:
                    nuevo,
            },
        });
    }

    // ========================================================
    // GÉNERO
    // ========================================================

    function cambiarGeneroActivo(
        activo:
            boolean
    ) {
        aplicar({
            ...valor,

            genero: {
                ...valor.genero,

                activo,
            },
        });
    }

    function cambiarMinimoGenero(
        campo:
            "masculino" |
            "femenino",

        nuevo:
            number
    ) {
        aplicar({
            ...valor,

            genero: {
                ...valor.genero,

                minimos: {
                    ...valor
                        .genero
                        .minimos,

                    [campo]:
                        nuevo,
                },
            },
        });
    }

    // ========================================================
    // PROFESORES
    // ========================================================

    function cambiarProfesoresPermitidos(
        permitidos:
            boolean
    ) {
        aplicar({
            ...valor,

            profesores: {
                ...valor.profesores,

                permitidos,

                ...(
                    permitidos
                        ? {}
                        : {
                              minimo:
                                  0,

                              maximo:
                                  0,
                          }
                ),
            },
        });
    }

    function cambiarProfesoresNumero(
        campo:
            "minimo" |
            "maximo",

        nuevo:
            number
    ) {
        aplicar({
            ...valor,

            profesores: {
                ...valor.profesores,

                [campo]:
                    nuevo,
            },
        });
    }

    function cambiarProfesoresCuentan(
        cuentan_como_jugador:
            boolean
    ) {
        aplicar({
            ...valor,

            profesores: {
                ...valor.profesores,

                cuentan_como_jugador,
            },
        });
    }

    // ========================================================
    // STAFF
    // ========================================================

    function cambiarStaffPermitido(
        permitido:
            boolean
    ) {
        aplicar({
            ...valor,

            staff: {
                ...valor.staff,

                permitido,

                ...(
                    permitido
                        ? {}
                        : {
                              minimo:
                                  0,

                              maximo:
                                  0,
                          }
                ),
            },
        });
    }

    function cambiarStaffNumero(
        campo:
            "minimo" |
            "maximo",

        nuevo:
            number
    ) {
        aplicar({
            ...valor,

            staff: {
                ...valor.staff,

                [campo]:
                    nuevo,
            },
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

                            <circle
                                cx="17"
                                cy="9"
                                r="2.5"
                            />

                            <path d="M16 14.5a5 5 0 0 1 4.5 5V20" />
                        </svg>
                    </span>

                    <span
                        className="
                            text-xs
                            font-medium
                            tracking-wide
                        "
                    >
                        EQUIPS
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
                    Configuració dels equips
                </h2>

                <p
                    className="
                        mt-2
                        max-w-3xl
                        text-sm
                        leading-6
                    "
                >
                    Defineix quan es poden inscriure els
                    equips, quants participants poden
                    tenir i les condicions de composició.
                </p>
            </header>

            {/* =================================================
                PERIODO DE INSCRIPCIÓN
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
                    descripcion="Indica durant quin període estarà disponible el formulari d'inscripció d'equips."
                    icono="calendari"
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
                            htmlFor="equips-obertura"
                            className={
                                etiqueta
                            }
                        >
                            Obertura
                        </label>

                        <input
                            id="equips-obertura"
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
                            htmlFor="equips-tancament"
                            className={
                                etiqueta
                            }
                        >
                            Tancament
                        </label>

                        <input
                            id="equips-tancament"
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

                <p
                    className="
                        mt-4
                        text-xs
                        leading-5
                        text-neutral/70
                    "
                >
                    Fora d'aquest període el formulari
                    públic d'inscripció no estarà
                    disponible.
                </p>
            </div>

            {/* =================================================
                CUPO
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
                    titulo="Nombre d'equips"
                    descripcion="Defineix el nombre màxim previst i què ha de fer el sistema quan s'hi arribi."
                    icono="grup"
                />

                <div
                    className="
                        max-w-xs
                        space-y-2
                    "
                >
                    <label
                        htmlFor="equips-cupo"
                        className={
                            etiqueta
                        }
                    >
                        Màxim orientatiu
                    </label>

                    <input
                        id="equips-cupo"
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
                                cambiarMaximoEquipos(
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
                            text-neutral/70
                        "
                    >
                        Deixa'l buit si no vols definir
                        cap quantitat orientativa.
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
                                            cambiarComportamiento(
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
                                                        text-neutral
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
                JUGADORES
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
                    titulo="Participants de l'equip"
                    descripcion="Estableix quants jugadors ha de tenir cada equip per poder participar."
                    icono="persona"
                />

                <div
                    className="
                        grid
                        max-w-2xl
                        grid-cols-1
                        gap-4
                        sm:grid-cols-2
                    "
                >
                    <div
                        className="
                            space-y-2
                        "
                    >
                        <label
                            htmlFor="jugadors-minim"
                            className={
                                etiqueta
                            }
                        >
                            Mínim de jugadors
                        </label>

                        <input
                            id="jugadors-minim"
                            type="number"
                            min={
                                1
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
                                    .jugadores
                                    .minimo ??
                                ""
                            }
                            onChange={
                                evento =>
                                    cambiarJugadores(
                                        "minimo",

                                        numeroNullable(
                                            evento
                                                .target
                                                .value
                                        )
                                    )
                            }
                            placeholder="Ex: 6"
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
                            htmlFor="jugadors-maxim"
                            className={
                                etiqueta
                            }
                        >
                            Màxim de jugadors
                        </label>

                        <input
                            id="jugadors-maxim"
                            type="number"
                            min={
                                1
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
                                    .jugadores
                                    .maximo ??
                                ""
                            }
                            onChange={
                                evento =>
                                    cambiarJugadores(
                                        "maximo",

                                        numeroNullable(
                                            evento
                                                .target
                                                .value
                                        )
                                    )
                            }
                            placeholder="Ex: 10"
                            className={
                                campo
                            }
                        />
                    </div>
                </div>
            </div>

            {/* =================================================
                GÉNERO
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
                    titulo="Composició per gènere"
                    descripcion="Pots exigir una composició mínima de nois i noies dins de cada equip."
                    icono="genero"
                />

                <Interruptor
                    activo={
                        valor
                            .genero
                            .activo
                    }
                    disabled={
                        deshabilitado
                    }
                    titulo="Establir mínims per gènere"
                    descripcion="Activa aquesta opció si cada equip ha de complir una composició mínima."
                    onCambiar={
                        cambiarGeneroActivo
                    }
                />

                {valor
                    .genero
                    .activo && (
                    <div
                        className="
                            mt-5
                            grid
                            max-w-2xl
                            grid-cols-1
                            gap-4
                            border-t
                            border-border
                            pt-5
                            sm:grid-cols-2
                        "
                    >
                        <div
                            className="
                                space-y-2
                            "
                        >
                            <label
                                htmlFor="genero-masculino"
                                className={
                                    etiqueta
                                }
                            >
                                Mínim de nois
                            </label>

                            <input
                                id="genero-masculino"
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
                                        .genero
                                        .minimos
                                        .masculino
                                }
                                onChange={
                                    evento =>
                                        cambiarMinimoGenero(
                                            "masculino",

                                            numeroEntero(
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
                                htmlFor="genero-femenino"
                                className={
                                    etiqueta
                                }
                            >
                                Mínim de noies
                            </label>

                            <input
                                id="genero-femenino"
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
                                        .genero
                                        .minimos
                                        .femenino
                                }
                                onChange={
                                    evento =>
                                        cambiarMinimoGenero(
                                            "femenino",

                                            numeroEntero(
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
                )}
            </div>

            {/* =================================================
                PROFESORES
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
                    titulo="Professorat"
                    descripcion="Configura si els professors poden participar com a membres de l'equip."
                    icono="professor"
                />

                <Interruptor
                    activo={
                        valor
                            .profesores
                            .permitidos
                    }
                    disabled={
                        deshabilitado
                    }
                    titulo="Permetre professorat"
                    descripcion="Els equips podran incloure professors entre els seus participants."
                    onCambiar={
                        cambiarProfesoresPermitidos
                    }
                />

                {valor
                    .profesores
                    .permitidos && (
                    <div
                        className="
                            mt-5
                            space-y-5
                            border-t
                            border-border
                            pt-5
                        "
                    >
                        <div
                            className="
                                grid
                                max-w-2xl
                                grid-cols-1
                                gap-4
                                sm:grid-cols-2
                            "
                        >
                            <div
                                className="
                                    space-y-2
                                "
                            >
                                <label
                                    htmlFor="professors-minim"
                                    className={
                                        etiqueta
                                    }
                                >
                                    Mínim de professors
                                </label>

                                <input
                                    id="professors-minim"
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
                                            .profesores
                                            .minimo
                                    }
                                    onChange={
                                        evento =>
                                            cambiarProfesoresNumero(
                                                "minimo",

                                                numeroEntero(
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
                                    htmlFor="professors-maxim"
                                    className={
                                        etiqueta
                                    }
                                >
                                    Màxim de professors
                                </label>

                                <input
                                    id="professors-maxim"
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
                                            .profesores
                                            .maximo
                                    }
                                    onChange={
                                        evento =>
                                            cambiarProfesoresNumero(
                                                "maximo",

                                                numeroEntero(
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

                        <Interruptor
                            activo={
                                valor
                                    .profesores
                                    .cuentan_como_jugador
                            }
                            disabled={
                                deshabilitado
                            }
                            titulo="Compten dins el nombre de jugadors"
                            descripcion="Si està activat, un professor ocuparà una de les places definides al màxim de jugadors de l'equip."
                            onCambiar={
                                cambiarProfesoresCuentan
                            }
                        />
                    </div>
                )}
            </div>

            {/* =================================================
                STAFF
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
                    titulo="Staff de l'equip"
                    descripcion="Defineix si els equips poden registrar persones de suport que no formen part dels jugadors."
                    icono="staff"
                />

                <Interruptor
                    activo={
                        valor
                            .staff
                            .permitido
                    }
                    disabled={
                        deshabilitado
                    }
                    titulo="Permetre staff"
                    descripcion="L'equip podrà registrar membres de staff independents dels jugadors."
                    onCambiar={
                        cambiarStaffPermitido
                    }
                />

                {valor
                    .staff
                    .permitido && (
                    <div
                        className="
                            mt-5
                            grid
                            max-w-2xl
                            grid-cols-1
                            gap-4
                            border-t
                            border-border
                            pt-5
                            sm:grid-cols-2
                        "
                    >
                        <div
                            className="
                                space-y-2
                            "
                        >
                            <label
                                htmlFor="staff-minim"
                                className={
                                    etiqueta
                                }
                            >
                                Mínim de membres
                            </label>

                            <input
                                id="staff-minim"
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
                                        .staff
                                        .minimo
                                }
                                onChange={
                                    evento =>
                                        cambiarStaffNumero(
                                            "minimo",

                                            numeroEntero(
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
                                htmlFor="staff-maxim"
                                className={
                                    etiqueta
                                }
                            >
                                Màxim de membres
                            </label>

                            <input
                                id="staff-maxim"
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
                                        .staff
                                        .maximo
                                }
                                onChange={
                                    evento =>
                                        cambiarStaffNumero(
                                            "maximo",

                                            numeroEntero(
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
                )}
            </div>
        </section>
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
                gap-5
                rounded-xl
                border
                border-border
                bg-card
                p-4
            "
        >
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
                    {titulo}
                </p>

                <p
                    className="
                        mt-1
                        max-w-2xl
                        text-xs
                        leading-5
                        text-neutral
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
                    focus-visible:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-primary/30
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
// CABECERA DE BLOQUE
// ============================================================

function CabeceraBloque({
    titulo,
    descripcion,
    icono,
}: {
    titulo:
        string;

    descripcion:
        string;

    icono:
        | "calendari"
        | "grup"
        | "persona"
        | "genero"
        | "professor"
        | "staff";
}) {
    return (
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
                {icono ===
                    "calendari" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
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
                )}

                {icono ===
                    "grup" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="9"
                            cy="8"
                            r="3"
                        />

                        <circle
                            cx="17"
                            cy="9"
                            r="2.5"
                        />

                        <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />

                        <path d="M16 14.5a5 5 0 0 1 4.5 5V20" />
                    </svg>
                )}

                {icono ===
                    "persona" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="12"
                            cy="8"
                            r="3.5"
                        />

                        <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
                    </svg>
                )}

                {icono ===
                    "genero" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="9"
                            cy="9"
                            r="4"
                        />

                        <path d="M12 6l5-5" />

                        <path d="M13 1h4v4" />

                        <circle
                            cx="15"
                            cy="15"
                            r="4"
                        />

                        <path d="M15 19v4" />

                        <path d="M12.5 21h5" />
                    </svg>
                )}

                {icono ===
                    "professor" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <path d="M3 4h18v12H3z" />

                        <path d="M8 20h8" />

                        <path d="M12 16v4" />

                        <path d="m8 10 2 2 5-5" />
                    </svg>
                )}

                {icono ===
                    "staff" && (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="8"
                            cy="8"
                            r="3"
                        />

                        <path d="M3 20v-1a5 5 0 0 1 10 0v1" />

                        <path d="M16 8h5" />

                        <path d="M18.5 5.5v5" />

                        <path d="M16 16h5" />
                    </svg>
                )}
            </span>

            <div>
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
        </div>
    );
}