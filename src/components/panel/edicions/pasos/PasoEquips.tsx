import {
    useId,
    type ReactNode,
} from "react";

import type {
    ConfigEquipos,
} from "../Asistente";

import CursosEdicion from "./CursosEdicion";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    valor:
        ConfigEquipos;

    cursosPlataforma:
        ConfigEquipos["cursos"];

    cursoAcademicoPlataforma:
        string | null;

    soloLectura:
        boolean;

    bloqueado:
        boolean;

    onCambiar: (
        valor:
            ConfigEquipos,
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
// FECHAS
// ============================================================

function fechaParaInput(
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return "";
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
        return valor.slice(
            0,
            16,
        );
    }

    const desplazamiento =
        fecha.getTimezoneOffset() *
        60 *
        1000;

    return new Date(
        fecha.getTime() -
            desplazamiento,
    )
        .toISOString()
        .slice(
            0,
            16,
        );
}

function fechaDesdeInput(
    valor:
        string,
): string | null {
    if (
        !valor
    ) {
        return null;
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
        return null;
    }

    return fecha.toISOString();
}

// ============================================================
// NÚMEROS
// ============================================================

function numeroNullable(
    valor:
        string,
): number | null {
    if (
        valor.trim() ===
        ""
    ) {
        return null;
    }

    const numero =
        Number(
            valor,
        );

    if (
        !Number.isFinite(
            numero,
        )
    ) {
        return null;
    }

    return Math.max(
        0,
        Math.trunc(
            numero,
        ),
    );
}

function numeroEntero(
    valor:
        string,
): number {
    const numero =
        Number(
            valor,
        );

    if (
        !Number.isFinite(
            numero,
        )
    ) {
        return 0;
    }

    return Math.max(
        0,
        Math.trunc(
            numero,
        ),
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoEquips({
    valor,
    cursosPlataforma,
    cursoAcademicoPlataforma,
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
        nuevo:
            ConfigEquipos,
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onCambiar(
            nuevo,
        );
    }

    // ========================================================
    // INSCRIPCIÓN
    // ========================================================

    function cambiarInscripcion(
        campo:
            | "apertura"
            | "cierre",

        nuevo:
            string | null,
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
            number | null,
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
            ComportamientoCupo,
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
    // CURSOS
    // ========================================================

    function cambiarCursos(
        cursos:
            ConfigEquipos["cursos"],
    ) {
        aplicar({
            ...valor,

            cursos,
        });
    }

    // ========================================================
    // JUGADORES
    // ========================================================

    function cambiarJugadores(
        campo:
            | "minimo"
            | "maximo",

        nuevo:
            number | null,
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
            boolean,
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
            | "masculino"
            | "femenino",

        nuevo:
            number,
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
            boolean,
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
            | "minimo"
            | "maximo",

        nuevo:
            number,
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
            boolean,
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
    // ENTRENADOR
    // ========================================================

    function cambiarEntrenadorPermitido(
        permitido:
            boolean,
    ) {
        aplicar({
            ...valor,

            entrenador: {
                ...valor.entrenador,

                permitido,
            },
        });
    }

    // ========================================================
    // STAFF
    // ========================================================

    function cambiarStaffPermitido(
        permitido:
            boolean,
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
            | "minimo"
            | "maximo",

        nuevo:
            number,
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
        <section aria-labelledby={tituloID} className="space-y-7 text-neutral">
            <header className="border-b border-border pb-5">
                <div className="mb-3 flex items-center gap-2">
                    <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                            <circle cx="9" cy="8" r="3" />
                            <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />
                            <circle cx="17" cy="9" r="2.5" />
                            <path d="M16 14.5a5 5 0 0 1 4.5 5V20" />
                        </svg>
                    </span>

                    <span className="text-xs font-medium tracking-wide">
                        EQUIPS
                    </span>
                </div>

                <h2 id={tituloID} className="text-xl font-semibold tracking-tight text-neutral-titulos">
                    Configuració dels equips
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6">
                    Defineix quan es poden inscriure els equips, quins cursos poden participar, quants participants poden tenir i les condicions de composició.
                </p>
            </header>

            <Bloque titulo="Període d'inscripció" descripcion="Indica durant quin període estarà disponible la inscripció d'equips.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <label htmlFor="equips-obertura" className="text-sm font-medium text-neutral-titulos">
                            Obertura
                        </label>

                        <input
                            id="equips-obertura"
                            type="datetime-local"
                            disabled={
                                deshabilitado
                            }
                            value={
                                fechaParaInput(
                                    valor
                                        .inscripcion
                                        .apertura,
                                )
                            }
                            onChange={
                                evento =>
                                    cambiarInscripcion(
                                        "apertura",

                                        fechaDesdeInput(
                                            evento
                                                .target
                                                .value,
                                        ),
                                    )
                            }
                            className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="equips-tancament" className="text-sm font-medium text-neutral-titulos">
                            Tancament
                        </label>

                        <input
                            id="equips-tancament"
                            type="datetime-local"
                            min={
                                fechaParaInput(
                                    valor
                                        .inscripcion
                                        .apertura,
                                )
                            }
                            disabled={
                                deshabilitado
                            }
                            value={
                                fechaParaInput(
                                    valor
                                        .inscripcion
                                        .cierre,
                                )
                            }
                            onChange={
                                evento =>
                                    cambiarInscripcion(
                                        "cierre",

                                        fechaDesdeInput(
                                            evento
                                                .target
                                                .value,
                                        ),
                                    )
                            }
                            className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>
                </div>
            </Bloque>

            <Bloque titulo="Nombre d'equips" descripcion="Configura el nombre màxim d'equips i què passa quan s'assoleix.">
                <div className="max-w-xs space-y-2">
                    <label htmlFor="equips-maxim" className="text-sm font-medium text-neutral-titulos">
                        Màxim d'equips
                    </label>

                    <input
                        id="equips-maxim"
                        type="number"
                        min={
                            0
                        }
                        step={
                            1
                        }
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
                                            .value,
                                    ),
                                )
                        }
                        placeholder="Sense límit"
                        className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                    {
                        COMPORTAMIENTOS_CUPO.map(
                            opcion => {
                                const activo =
                                    valor
                                        .cupo
                                        .al_superar ===
                                    opcion.valor;

                                return (
                                    <button key={opcion.valor} type="button" disabled={deshabilitado} onClick={() => cambiarComportamiento(opcion.valor)} className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${activo ? "border-primary bg-primary/10" : "border-border bg-card hover:border-neutral/40"}`}>
                                        <p className="text-sm font-semibold text-neutral-titulos">
                                            {
                                                opcion.nombre
                                            }
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-neutral">
                                            {
                                                opcion.descripcion
                                            }
                                        </p>
                                    </button>
                                );
                            },
                        )
                    }
                </div>
            </Bloque>

            <Bloque titulo="Cursos participants" descripcion="Defineix quins cursos i grups podran seleccionar els participants durant la inscripció.">
                <CursosEdicion
                    cursos={
                        valor.cursos
                    }
                    cursosPlataforma={
                        cursosPlataforma
                    }
                    cursoAcademicoPlataforma={
                        cursoAcademicoPlataforma
                    }
                    deshabilitado={
                        deshabilitado
                    }
                    onChange={
                        cambiarCursos
                    }
                />
            </Bloque>

            <Bloque titulo="Jugadors" descripcion="Defineix el nombre mínim i màxim de jugadors per equip.">
                <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label htmlFor="jugadors-minim" className="text-sm font-medium text-neutral-titulos">
                            Mínim
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
                                                .value,
                                        ),
                                    )
                            }
                            className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="jugadors-maxim" className="text-sm font-medium text-neutral-titulos">
                            Màxim
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
                                                .value,
                                        ),
                                    )
                            }
                            className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                    </div>
                </div>
            </Bloque>

            <Bloque titulo="Composició per gènere" descripcion="Pots exigir una composició mínima de nois i noies.">
                <Interruptor
                    activo={
                        valor
                            .genero
                            .activo
                    }
                    disabled={
                        deshabilitado
                    }
                    titulo="Activar composició mínima"
                    descripcion="L'equip haurà de complir els mínims indicats."
                    onCambiar={
                        cambiarGeneroActivo
                    }
                />

                {
                    valor
                        .genero
                        .activo && (
                        <div className="mt-5 grid max-w-2xl grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="minim-nois" className="text-sm font-medium text-neutral-titulos">
                                    Mínim de nois
                                </label>

                                <input
                                    id="minim-nois"
                                    type="number"
                                    min={
                                        0
                                    }
                                    step={
                                        1
                                    }
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
                                                        .value,
                                                ),
                                            )
                                    }
                                    className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="minim-noies" className="text-sm font-medium text-neutral-titulos">
                                    Mínim de noies
                                </label>

                                <input
                                    id="minim-noies"
                                    type="number"
                                    min={
                                        0
                                    }
                                    step={
                                        1
                                    }
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
                                                        .value,
                                                ),
                                            )
                                    }
                                    className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>
                        </div>
                    )
                }
            </Bloque>

            <Bloque titulo="Professorat" descripcion="Configura si els equips poden incloure professorat.">
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
                    descripcion="Els equips podran afegir professors."
                    onCambiar={
                        cambiarProfesoresPermitidos
                    }
                />

                {
                    valor
                        .profesores
                        .permitidos && (
                        <div className="mt-5 space-y-5 border-t border-border pt-5">
                            <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label htmlFor="professors-minim" className="text-sm font-medium text-neutral-titulos">
                                        Mínim
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
                                                            .value,
                                                    ),
                                                )
                                        }
                                        className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label htmlFor="professors-maxim" className="text-sm font-medium text-neutral-titulos">
                                        Màxim
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
                                                            .value,
                                                    ),
                                                )
                                        }
                                        className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                                titulo="Compta com a jugador"
                                descripcion="El professor ocuparà una plaça dins el nombre màxim de jugadors."
                                onCambiar={
                                    cambiarProfesoresCuentan
                                }
                            />
                        </div>
                    )
                }
            </Bloque>

            <Bloque titulo="Entrenador" descripcion="Defineix si cada equip pot registrar un entrenador.">
                <Interruptor
                    activo={
                        valor
                            .entrenador
                            .permitido
                    }
                    disabled={
                        deshabilitado
                    }
                    titulo="Permetre entrenador"
                    descripcion="Si està activat, els equips podran indicar un entrenador durant la inscripció."
                    onCambiar={
                        cambiarEntrenadorPermitido
                    }
                />
            </Bloque>

            <Bloque titulo="Staff" descripcion="Configura si els equips poden incloure altres membres de suport.">
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
                    descripcion="Els equips podran afegir membres de staff."
                    onCambiar={
                        cambiarStaffPermitido
                    }
                />

                {
                    valor
                        .staff
                        .permitido && (
                        <div className="mt-5 grid max-w-2xl grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
                            <div className="space-y-2">
                                <label htmlFor="staff-minim" className="text-sm font-medium text-neutral-titulos">
                                    Mínim
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
                                                        .value,
                                                ),
                                            )
                                    }
                                    className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="staff-maxim" className="text-sm font-medium text-neutral-titulos">
                                    Màxim
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
                                                        .value,
                                                ),
                                            )
                                    }
                                    className="w-full rounded-lg border border-border bg-card px-3.5 py-3 text-sm text-neutral outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                                />
                            </div>
                        </div>
                    )
                }
            </Bloque>
        </section>
    );
}

// ============================================================
// BLOQUE
// ============================================================

function Bloque({
    titulo,
    descripcion,
    children,
}: {
    titulo:
        string;

    descripcion:
        string;

    children:
        ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-border bg-background p-5">
            <div className="mb-5">
                <h3 className="font-semibold text-neutral-titulos">
                    {
                        titulo
                    }
                </h3>

                <p className="mt-1 max-w-3xl text-sm leading-6 text-neutral">
                    {
                        descripcion
                    }
                </p>
            </div>

            {
                children
            }
        </div>
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
            boolean,
    ) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-5 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-titulos">
                    {
                        titulo
                    }
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral">
                    {
                        descripcion
                    }
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
                onClick={
                    () =>
                        onCambiar(
                            !activo,
                        )
                }
                className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50 ${activo ? "border-primary bg-primary" : "border-border bg-muted/40"}`}
            >
                <span aria-hidden="true" className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-all ${activo ? "left-5.25" : "left-0.5"}`} />
            </button>
        </div>
    );
}