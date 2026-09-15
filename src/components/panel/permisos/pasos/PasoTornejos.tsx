import {
    useId,
    useMemo,
    useState,
} from "react";

import {
    NIVELES_ROL,
    NOMBRES_ROL,
    completarPermisosAmbito,
    normalizarRol,
    type AsignacionTorneo,
    type ConfiguracionTodosTorneos,
    type Rol,
} from "@const/Permisos";

// ============================================================
// TIPOS
// ============================================================

export type TorneoDisponible = {
    id: string;
    nombre: string | null;
    deporte: string | null;

    /*
     * Rol con el que el administrador actual
     * gestiona ESTE torneo.
     *
     * Sirve para calcular qué roles puede
     * conceder dentro del torneo.
     */
    rolAdministrador: Rol | null;
};

export type RolDisponible = {
    valor: Rol;
    nombre: string;
    nivel: number;
};

export type AccesosTorneos = {
    acceso_torneos:
        ConfiguracionTodosTorneos;

    torneos:
        Record<
            string,
            AsignacionTorneo
        >;
};

type Props = {
    /*
     * NUEVO.
     *
     * El rol general ya no se calcula utilizando
     * los torneos. Se selecciona explícitamente.
     *
     * Se deja opcional temporalmente para que
     * Asistente.tsx antiguo siga compilando hasta
     * que lleguemos a ese archivo.
     */
    rolGeneral?: Rol | null;

    valor: AccesosTorneos;

    torneos:
        readonly TorneoDisponible[];

    roles:
        readonly RolDisponible[];

    puedeConcederTodos: boolean;

    soloLectura?: boolean;
    bloqueado?: boolean;

    onCambiarRolGeneral?: (
        rol: Rol,
    ) => void;

    onCambiar: (
        valor: AccesosTorneos,
    ) => void;
};

// ============================================================
// ESTILOS
// ============================================================

const campo =
    "w-full rounded-lg border border-border bg-card " +
    "px-3.5 py-3 text-sm text-neutral outline-none " +
    "focus:border-neutral/50 focus:ring-2 focus:ring-neutral/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

// ============================================================
// HELPERS
// ============================================================

function calcularRolLegacy(
    valor: AccesosTorneos,
): Rol | null {
    /*
     * Compatibilidad temporal.
     *
     * Desaparecerá cuando Asistente.tsx ya
     * proporcione rolGeneral explícitamente.
     */
    const encontrados:
        Rol[] = [];

    if (
        valor.acceso_torneos.todos &&
        valor.acceso_torneos.rol
    ) {
        encontrados.push(
            valor.acceso_torneos.rol,
        );
    }

    for (
        const asignacion
        of Object.values(
            valor.torneos,
        )
    ) {
        if (
            asignacion.acceso &&
            asignacion.rol
        ) {
            encontrados.push(
                asignacion.rol,
            );
        }
    }

    if (
        encontrados.length === 0
    ) {
        return null;
    }

    return encontrados.reduce(
        (mayor, actual) =>
            NIVELES_ROL[actual] >
            NIVELES_ROL[mayor]
                ? actual
                : mayor,
    );
}

function SelectorRol({
    etiqueta,
    valor,
    opciones,
    desactivado,
    placeholder = "Selecciona un rol",
    onCambiar,
}: {
    etiqueta: string;

    valor:
        Rol | null;

    opciones:
        readonly RolDisponible[];

    desactivado:
        boolean;

    placeholder?:
        string;

    onCambiar:
        (rol: Rol) => void;
}) {
    const actualDisponible =
        opciones.some(
            (opcion) =>
                opcion.valor ===
                valor,
        );

    return (
        <label className="block">
            <span className="mb-2 block text-xs font-semibold">
                {etiqueta}
            </span>

            <select
                value={
                    valor ?? ""
                }
                disabled={
                    desactivado ||
                    opciones.length ===
                        0
                }
                className={
                    campo
                }
                onChange={(
                    evento,
                ) => {
                    const nuevo =
                        normalizarRol(
                            evento
                                .target
                                .value,
                        );

                    if (
                        !nuevo ||
                        !opciones.some(
                            (
                                opcion,
                            ) =>
                                opcion.valor ===
                                nuevo,
                        )
                    ) {
                        return;
                    }

                    onCambiar(
                        nuevo,
                    );
                }}
            >
                <option
                    value=""
                    disabled
                >
                    {placeholder}
                </option>

                {valor &&
                    !actualDisponible && (
                        <option
                            value={
                                valor
                            }
                            disabled
                        >
                            {
                                NOMBRES_ROL[
                                    valor
                                ]
                            }{" "}
                            · Rol actual
                        </option>
                    )}

                {opciones.map(
                    (opcion) => (
                        <option
                            key={
                                opcion.valor
                            }
                            value={
                                opcion.valor
                            }
                        >
                            {
                                opcion.nombre
                            }
                        </option>
                    ),
                )}
            </select>
        </label>
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoTornejos({
    rolGeneral,
    valor,
    torneos,
    roles,
    puedeConcederTodos,
    soloLectura = false,
    bloqueado = false,
    onCambiarRolGeneral,
    onCambiar,
}: Props) {
    const tituloID =
        useId();

    const busquedaID =
        useId();

    const [
        busqueda,
        setBusqueda,
    ] = useState("");

    const desactivado =
        soloLectura ||
        bloqueado;

    const todos =
        valor.acceso_torneos
            .todos;

    /*
     * Hasta actualizar Asistente.tsx:
     *
     * - si recibe rolGeneral, usa el nuevo sistema;
     * - si no, muestra el resultado legacy.
     */
    const rolGeneralActual =
        rolGeneral ===
        undefined
            ? calcularRolLegacy(
                  valor,
              )
            : rolGeneral;

    const rolesOrdenados =
        useMemo(
            () =>
                [...roles].sort(
                    (a, b) =>
                        a.nivel -
                        b.nivel,
                ),
            [roles],
        );

    const torneosPorID =
        useMemo(
            () =>
                new Map(
                    torneos.map(
                        (
                            torneo,
                        ) => [
                            torneo.id.toLowerCase(),
                            torneo,
                        ],
                    ),
                ),
            [torneos],
        );

    /*
     * También conservamos temporalmente
     * asignaciones antiguas cuyo torneo ya
     * no aparezca en la configuración.
     */
    const idsDisponibles =
        useMemo(
            () => [
                ...new Set([
                    ...torneosPorID.keys(),

                    ...Object.keys(
                        valor.torneos,
                    ).map(
                        (id) =>
                            id.toLowerCase(),
                    ),
                ]),
            ],
            [
                torneosPorID,
                valor.torneos,
            ],
        );

    const consulta =
        busqueda
            .trim()
            .toLocaleLowerCase(
                "ca-ES",
            );

    const idsVisibles =
        useMemo(
            () =>
                idsDisponibles
                    .filter(
                        (id) => {
                            const torneo =
                                torneosPorID.get(
                                    id,
                                );

                            const texto =
                                [
                                    torneo?.nombre,
                                    torneo?.deporte,
                                    id,
                                ]
                                    .filter(
                                        Boolean,
                                    )
                                    .join(
                                        " ",
                                    )
                                    .toLocaleLowerCase(
                                        "ca-ES",
                                    );

                            return (
                                !consulta ||
                                texto.includes(
                                    consulta,
                                )
                            );
                        },
                    )
                    .sort(
                        (
                            a,
                            b,
                        ) => {
                            const nombreA =
                                torneosPorID.get(
                                    a,
                                )?.nombre ||
                                a;

                            const nombreB =
                                torneosPorID.get(
                                    b,
                                )?.nombre ||
                                b;

                            return nombreA.localeCompare(
                                nombreB,
                                "ca",
                            );
                        },
                    ),
            [
                idsDisponibles,
                consulta,
                torneosPorID,
            ],
        );

    // ========================================================
    // ROLES DISPONIBLES
    // ========================================================

    function rolesParaTorneo(
        id: string,
    ): RolDisponible[] {
        const torneo =
            torneosPorID.get(
                id,
            );

        const rolGestor =
            torneo?.rolAdministrador;

        if (!rolGestor) {
            return [];
        }

        /*
         * REGLA IMPORTANTE:
         *
         * estrictamente inferior.
         *
         * admintorneo -> staff / voluntario
         * NO admintorneo -> admintorneo
         */
        return rolesOrdenados.filter(
            (opcion) =>
                opcion.nivel <
                NIVELES_ROL[
                    rolGestor
                ],
        );
    }

    /*
     * Para "todos los torneos", una opción
     * solo aparece si puede concederse en
     * TODOS los torneos actuales.
     *
     * El servidor volverá a comprobarlo.
     */
    const rolesComunes =
        useMemo(
            () =>
                rolesOrdenados.filter(
                    (opcion) => {
                        if (
                            torneos.length ===
                            0
                        ) {
                            return true;
                        }

                        return torneos.every(
                            (
                                torneo,
                            ) => {
                                if (
                                    !torneo
                                        .rolAdministrador
                                ) {
                                    return false;
                                }

                                return (
                                    opcion.nivel <
                                    NIVELES_ROL[
                                        torneo
                                            .rolAdministrador
                                    ]
                                );
                            },
                        );
                    },
                ),
            [
                rolesOrdenados,
                torneos,
            ],
        );

    // ========================================================
    // CAMBIOS: ROL GENERAL
    // ========================================================

    function cambiarRolGeneral(
        rol: Rol,
    ) {
        if (
            desactivado ||
            !onCambiarRolGeneral
        ) {
            return;
        }

        if (
            !rolesOrdenados.some(
                (opcion) =>
                    opcion.valor ===
                    rol,
            )
        ) {
            return;
        }

        onCambiarRolGeneral(
            rol,
        );
    }

    // ========================================================
    // CAMBIOS: TODOS / ALGUNOS
    // ========================================================

    function seleccionarTodos() {
        if (
            desactivado ||
            todos ||
            !puedeConcederTodos
        ) {
            return;
        }

        /*
         * Nuevo modelo:
         *
         * "Todos" utiliza una única configuración
         * común y no mantiene excepciones creadas
         * desde este paso.
         *
         * Las personalizaciones de permisos se
         * tratarán posteriormente en las slides
         * de cada torneo.
         */
        onCambiar({
            acceso_torneos: {
                todos: true,
                rol: null,

                permisos:
                    completarPermisosAmbito(
                        "torneo",
                        null,
                    ),
            },

            torneos: {},
        });
    }

    function seleccionarAlgunos() {
        if (
            desactivado ||
            !todos
        ) {
            return;
        }

        const rolAnterior =
            valor
                .acceso_torneos
                .rol;

        const permisosAnteriores =
            valor
                .acceso_torneos
                .permisos;

        const nuevasAsignaciones:
            Record<
                string,
                AsignacionTorneo
            > = {};

        /*
         * Al pasar de TODOS -> ALGUNOS conservamos
         * el acceso a los torneos actuales.
         *
         * Después el administrador puede
         * desmarcar los que no quiera.
         */
        for (
            const torneo
            of torneos
        ) {
            const id =
                torneo.id.toLowerCase();

            const opciones =
                rolesParaTorneo(
                    id,
                );

            const rolValido =
                rolAnterior &&
                opciones.some(
                    (opcion) =>
                        opcion.valor ===
                        rolAnterior,
                )
                    ? rolAnterior
                    : null;

            nuevasAsignaciones[
                id
            ] = {
                acceso: true,

                rol:
                    rolValido,

                permisos:
                    completarPermisosAmbito(
                        "torneo",
                        rolValido,
                        rolValido
                            ? permisosAnteriores
                            : undefined,
                    ),
            };
        }

        onCambiar({
            acceso_torneos: {
                todos: false,
                rol: null,

                permisos:
                    completarPermisosAmbito(
                        "torneo",
                        null,
                    ),
            },

            torneos:
                nuevasAsignaciones,
        });
    }

    // ========================================================
    // CAMBIOS: ROL COMÚN
    // ========================================================

    function cambiarRolComun(
        rol: Rol,
    ) {
        if (
            desactivado ||
            !todos ||
            !puedeConcederTodos
        ) {
            return;
        }

        if (
            !rolesComunes.some(
                (opcion) =>
                    opcion.valor ===
                    rol,
            )
        ) {
            return;
        }

        onCambiar({
            ...valor,

            acceso_torneos: {
                ...valor.acceso_torneos,

                rol,

                permisos:
                    completarPermisosAmbito(
                        "torneo",
                        rol,
                        valor
                            .acceso_torneos
                            .rol
                            ? valor
                                  .acceso_torneos
                                  .permisos
                            : undefined,
                    ),
            },
        });
    }

    // ========================================================
    // CAMBIOS: SELECCIÓN INDIVIDUAL
    // ========================================================

    function cambiarSeleccionTorneo(
        idOriginal: string,
        seleccionado: boolean,
    ) {
        if (
            desactivado ||
            todos
        ) {
            return;
        }

        const id =
            idOriginal.toLowerCase();

        const nuevasAsignaciones = {
            ...valor.torneos,
        };

        if (!seleccionado) {
            delete nuevasAsignaciones[
                id
            ];

            onCambiar({
                ...valor,

                torneos:
                    nuevasAsignaciones,
            });

            return;
        }

        /*
         * Al seleccionar un torneo NO escogemos
         * automáticamente un rol.
         *
         * El administrador debe decidirlo
         * expresamente.
         */
        nuevasAsignaciones[
            id
        ] = {
            acceso: true,
            rol: null,

            permisos:
                completarPermisosAmbito(
                    "torneo",
                    null,
                ),
        };

        onCambiar({
            ...valor,

            torneos:
                nuevasAsignaciones,
        });
    }

    function cambiarRolIndividual(
        idOriginal: string,
        rol: Rol,
    ) {
        if (
            desactivado ||
            todos
        ) {
            return;
        }

        const id =
            idOriginal.toLowerCase();

        const asignacion =
            valor.torneos[
                id
            ];

        if (
            !asignacion?.acceso
        ) {
            return;
        }

        const opciones =
            rolesParaTorneo(
                id,
            );

        if (
            !opciones.some(
                (opcion) =>
                    opcion.valor ===
                    rol,
            )
        ) {
            return;
        }

        onCambiar({
            ...valor,

            torneos: {
                ...valor.torneos,

                [id]: {
                    ...asignacion,

                    rol,

                    permisos:
                        completarPermisosAmbito(
                            "torneo",
                            rol,
                            asignacion.rol
                                ? asignacion.permisos
                                : undefined,
                        ),
                },
            },
        });
    }

    // ========================================================
    // DATOS VISUALES
    // ========================================================

    const seleccionados =
        Object.values(
            valor.torneos,
        ).filter(
            (asignacion) =>
                asignacion.acceso,
        ).length;

    const rolGeneralEditable =
        Boolean(
            onCambiarRolGeneral,
        );

    const desarrollador =
        rolGeneralActual ===
        "desarrollador";

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <section
            aria-labelledby={
                tituloID
            }
            className="space-y-8 text-neutral"
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <header className="border-b border-border pb-5">
                <p className="mb-3 text-xs font-medium tracking-wide">
                    ROL I TORNEJOS
                </p>

                <h2
                    id={tituloID}
                    className="text-xl font-semibold tracking-tight text-neutral-titulos"
                >
                    Defineix el rol i els tornejos
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6">
                    Primer assigna el rol general de l'usuari.
                    Després indica si tindrà accés a tots els tornejos
                    o només a alguns i selecciona el rol aplicable.
                </p>
            </header>

            {/* =================================================
                1. ROL GENERAL
            ================================================= */}

            <div className="space-y-4">
                <div>
                    <p className="text-xs font-medium tracking-wide">
                        1 · ROL GENERAL
                    </p>

                    <h3 className="mt-1 text-base font-semibold text-neutral-titulos">
                        Rol de l'usuari
                    </h3>

                    <p className="mt-1 max-w-2xl text-sm leading-6">
                        El rol general determina el nivell màxim
                        disponible a la configuració general de la
                        plataforma. Els rols dels tornejos es configuren
                        per separat.
                    </p>
                </div>

                <div className="max-w-lg rounded-xl border border-border bg-background p-5">
                    <SelectorRol
                        etiqueta="Rol general"
                        valor={
                            rolGeneralActual
                        }
                        opciones={
                            rolesOrdenados
                        }
                        desactivado={
                            desactivado ||
                            !rolGeneralEditable
                        }
                        placeholder="Selecciona el rol general"
                        onCambiar={
                            cambiarRolGeneral
                        }
                    />

                    {!rolGeneralEditable &&
                        !soloLectura && (
                            <p className="mt-3 text-xs leading-5">
                                El selector quedarà habilitat quan
                                l'assistent utilitzi el nou sistema
                                de rol general explícit.
                            </p>
                        )}

                    {desarrollador && (
                        <div
                            className="
                                mt-4 rounded-lg border border-border
                                bg-card p-3 text-xs leading-5
                            "
                        >
                            El rol Desenvolupador té accés complet a
                            la plataforma, a tots els tornejos i a tots
                            els permisos.
                        </div>
                    )}
                </div>
            </div>

            {/* =================================================
                2. MODALIDAD
            ================================================= */}

            <div className="space-y-4">
                <div>
                    <p className="text-xs font-medium tracking-wide">
                        2 · ABAST DELS TORNEJOS
                    </p>

                    <h3 className="mt-1 text-base font-semibold text-neutral-titulos">
                        A quins tornejos tindrà accés?
                    </h3>

                    <p className="mt-1 max-w-2xl text-sm leading-6">
                        Pots donar accés als tornejos actuals i futurs
                        o seleccionar-los individualment.
                    </p>
                </div>

                <fieldset
                    disabled={
                        desactivado ||
                        desarrollador
                    }
                >
                    <legend className="sr-only">
                        Modalitat d'accés als tornejos
                    </legend>

                    <div className="grid gap-3 md:grid-cols-2">
                        {/* ALGUNOS */}

                        <label
                            className={`
                                flex items-start gap-4 rounded-xl
                                border p-5 transition-colors

                                ${
                                    !todos
                                        ? "border-primary/60 bg-card"
                                        : "border-border bg-background"
                                }

                                ${
                                    desactivado || desarrollador
                                        ? "cursor-default"
                                        : "cursor-pointer hover:border-neutral/40"
                                }
                            `}
                        >
                            <input
                                type="radio"
                                name={`${tituloID}-abast`}
                                checked={
                                    !todos &&
                                    !desarrollador
                                }
                                onChange={
                                    seleccionarAlgunos
                                }
                                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                            />

                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-neutral-titulos">
                                    Només alguns tornejos
                                </span>

                                <span className="mt-1 block text-xs leading-5">
                                    Selecciona manualment els tornejos
                                    als quals podrà accedir i assigna
                                    un rol diferent a cadascun si ho
                                    necessites.
                                </span>
                            </span>
                        </label>

                        {/* TODOS */}

                        <label
                            className={`
                                flex items-start gap-4 rounded-xl
                                border p-5 transition-colors

                                ${
                                    todos || desarrollador
                                        ? "border-primary/60 bg-card"
                                        : "border-border bg-background"
                                }

                                ${
                                    desactivado ||
                                    desarrollador ||
                                    !puedeConcederTodos
                                        ? "cursor-default"
                                        : "cursor-pointer hover:border-neutral/40"
                                }
                            `}
                        >
                            <input
                                type="radio"
                                name={`${tituloID}-abast`}
                                checked={
                                    todos ||
                                    desarrollador
                                }
                                disabled={
                                    !puedeConcederTodos &&
                                    !todos
                                }
                                onChange={
                                    seleccionarTodos
                                }
                                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                            />

                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-neutral-titulos">
                                    Tots els tornejos
                                </span>

                                <span className="mt-1 block text-xs leading-5">
                                    Inclou tots els tornejos actuals
                                    i també els que es creïn en el futur.
                                </span>
                            </span>
                        </label>
                    </div>
                </fieldset>

                {!soloLectura &&
                    !desarrollador &&
                    !puedeConcederTodos && (
                        <div
                            role="alert"
                            className="
                                flex items-start gap-3
                                rounded-xl border
                                border-error/30
                                bg-error-container/40
                                p-4
                                text-error-foreground
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
                                className="mt-0.5 h-5 w-5 shrink-0"
                                aria-hidden="true"
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="9"
                                />
                                <path d="M12 8v5" />
                                <path d="M12 16h.01" />
                            </svg>

                            <div>
                                <p className="text-sm font-semibold">
                                    Accés no disponible
                                </p>

                                <p className="mt-1 text-sm leading-6">
                                    El teu compte no pot concedir accés
                                    comú a tots els tornejos.
                                </p>
                            </div>
                        </div>
                    )}
            </div>

            {/* =================================================
                3A. TODOS LOS TORNEOS
            ================================================= */}

            {(todos ||
                desarrollador) && (
                <div className="space-y-4">
                    <div>
                        <p className="text-xs font-medium tracking-wide">
                            3 · ROL DELS TORNEJOS
                        </p>

                        <h3 className="mt-1 text-base font-semibold text-neutral-titulos">
                            Rol comú
                        </h3>

                        <p className="mt-1 max-w-2xl text-sm leading-6">
                            Aquest rol s'aplicarà a tots els tornejos
                            actuals i futurs.
                        </p>
                    </div>

                    <div className="max-w-lg rounded-xl border border-border bg-background p-5">
                        {desarrollador ? (
                            <div>
                                <p className="text-xs font-semibold">
                                    Rol als tornejos
                                </p>

                                <p
                                    className="
                                        mt-2 rounded-lg border
                                        border-border bg-card
                                        px-3.5 py-3 text-sm
                                        font-semibold
                                    "
                                >
                                    Desenvolupador
                                </p>

                                <p className="mt-3 text-xs leading-5">
                                    El Desenvolupador disposa de tots
                                    els permisos en tots els tornejos.
                                </p>
                            </div>
                        ) : (
                            <SelectorRol
                                etiqueta="Rol comú dels tornejos"
                                valor={
                                    valor
                                        .acceso_torneos
                                        .rol
                                }
                                opciones={
                                    rolesComunes
                                }
                                desactivado={
                                    desactivado ||
                                    !puedeConcederTodos
                                }
                                placeholder="Selecciona el rol dels tornejos"
                                onCambiar={
                                    cambiarRolComun
                                }
                            />
                        )}

                        {!desarrollador &&
                            rolesComunes.length ===
                                0 && (
                                <div
                                    role="alert"
                                    className="
                                        mt-4 rounded-lg
                                        border border-error/30
                                        bg-error-container/40
                                        p-3
                                        text-sm
                                        text-error-foreground
                                    "
                                >
                                    No tens cap rol que puguis concedir
                                    de manera comuna a tots els tornejos.
                                </div>
                            )}
                    </div>
                </div>
            )}

            {/* =================================================
                3B. ALGUNOS TORNEOS
            ================================================= */}

            {!todos &&
                !desarrollador && (
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs font-medium tracking-wide">
                                3 · TORNEJOS I ROLS
                            </p>

                            <h3 className="mt-1 text-base font-semibold text-neutral-titulos">
                                Selecciona els tornejos
                            </h3>

                            <p className="mt-1 max-w-2xl text-sm leading-6">
                                Marca els tornejos als quals tindrà
                                accés. Quan seleccionis un torneig
                                hauràs d'assignar-li un rol.
                            </p>
                        </div>

                        {/* BUSCADOR */}

                        <div className="max-w-lg">
                            <label
                                htmlFor={
                                    busquedaID
                                }
                                className="mb-2 block text-xs font-semibold"
                            >
                                Cercar torneig
                            </label>

                            <input
                                id={
                                    busquedaID
                                }
                                type="search"
                                value={
                                    busqueda
                                }
                                onChange={(
                                    evento,
                                ) =>
                                    setBusqueda(
                                        evento
                                            .target
                                            .value,
                                    )
                                }
                                placeholder="Nom o esport"
                                className={
                                    campo
                                }
                            />
                        </div>

                        {/* SIN RESULTADOS */}

                        {idsVisibles.length ===
                            0 && (
                            <div
                                className="
                                    rounded-xl border
                                    border-dashed
                                    border-border
                                    p-8 text-center
                                "
                            >
                                <p className="text-sm font-semibold text-neutral-titulos">
                                    {idsDisponibles.length ===
                                    0
                                        ? "No hi ha tornejos disponibles"
                                        : "No s'han trobat coincidències"}
                                </p>

                                <p className="mt-2 text-xs leading-5">
                                    {idsDisponibles.length ===
                                    0
                                        ? "No hi ha cap torneig que el teu compte pugui gestionar."
                                        : "Prova de canviar el text de la cerca."}
                                </p>
                            </div>
                        )}

                        {/* LISTA */}

                        <div className="space-y-3">
                            {idsVisibles.map(
                                (id) => {
                                    const torneo =
                                        torneosPorID.get(
                                            id,
                                        );

                                    const asignacion =
                                        valor
                                            .torneos[
                                            id
                                        ];

                                    const seleccionado =
                                        asignacion?.acceso ===
                                        true;

                                    const opciones =
                                        rolesParaTorneo(
                                            id,
                                        );

                                    const nombre =
                                        torneo
                                            ?.nombre
                                            ?.trim() ||
                                        "Torneig no disponible";

                                    return (
                                        <article
                                            key={
                                                id
                                            }
                                            className={`
                                                overflow-hidden
                                                rounded-xl border
                                                transition-colors

                                                ${
                                                    seleccionado
                                                        ? "border-neutral/40 bg-card/35"
                                                        : "border-border bg-background"
                                                }
                                            `}
                                        >
                                            <div
                                                className="
                                                    flex flex-col
                                                    gap-4 p-4
                                                    sm:flex-row
                                                    sm:items-center
                                                    sm:justify-between
                                                    sm:p-5
                                                "
                                            >
                                                <label
                                                    className={`
                                                        flex min-w-0
                                                        items-start gap-3

                                                        ${
                                                            desactivado ||
                                                            opciones.length ===
                                                                0
                                                                ? "cursor-default"
                                                                : "cursor-pointer"
                                                        }
                                                    `}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            seleccionado
                                                        }
                                                        disabled={
                                                            desactivado ||
                                                            opciones.length ===
                                                                0
                                                        }
                                                        onChange={(
                                                            evento,
                                                        ) =>
                                                            cambiarSeleccionTorneo(
                                                                id,
                                                                evento
                                                                    .target
                                                                    .checked,
                                                            )
                                                        }
                                                        className="
                                                            mt-0.5
                                                            h-4 w-4
                                                            shrink-0
                                                            accent-primary
                                                        "
                                                    />

                                                    <span className="min-w-0">
                                                        <span className="block wrap-break-words text-sm font-semibold text-neutral-titulos">
                                                            {
                                                                nombre
                                                            }
                                                        </span>

                                                        {torneo?.deporte && (
                                                            <span className="mt-1 block text-xs">
                                                                {
                                                                    torneo.deporte
                                                                }
                                                            </span>
                                                        )}

                                                        {!torneo && (
                                                            <span className="mt-1 block break-all text-xs">
                                                                {
                                                                    id
                                                                }
                                                            </span>
                                                        )}
                                                    </span>
                                                </label>

                                                <span
                                                    className="
                                                        self-start
                                                        rounded-full
                                                        border
                                                        border-border
                                                        bg-background
                                                        px-2.5 py-1
                                                        text-xs
                                                        sm:self-center
                                                    "
                                                >
                                                    {seleccionado
                                                        ? "Seleccionat"
                                                        : "Sense accés"}
                                                </span>
                                            </div>

                                            {/* ROL */}

                                            {seleccionado && (
                                                <div
                                                    className="
                                                        border-t
                                                        border-border
                                                        bg-background
                                                        p-4 sm:p-5
                                                    "
                                                >
                                                    <div className="max-w-md">
                                                        <SelectorRol
                                                            etiqueta="Rol en aquest torneig"
                                                            valor={
                                                                asignacion
                                                                    ?.rol ??
                                                                null
                                                            }
                                                            opciones={
                                                                opciones
                                                            }
                                                            desactivado={
                                                                desactivado
                                                            }
                                                            placeholder="Selecciona el rol"
                                                            onCambiar={(
                                                                rol,
                                                            ) =>
                                                                cambiarRolIndividual(
                                                                    id,
                                                                    rol,
                                                                )
                                                            }
                                                        />
                                                    </div>

                                                    {asignacion &&
                                                        !asignacion.rol && (
                                                            <p
                                                                role="status"
                                                                className="
                                                                    mt-3
                                                                    text-xs
                                                                    leading-5
                                                                "
                                                            >
                                                                Selecciona un rol
                                                                per continuar amb
                                                                la configuració
                                                                d'aquest torneig.
                                                            </p>
                                                        )}
                                                </div>
                                            )}

                                            {/* SIN ROLES */}

                                            {torneo &&
                                                opciones.length ===
                                                    0 && (
                                                    <div
                                                        className="
                                                            border-t
                                                            border-error/20
                                                            bg-error-container/30
                                                            p-4
                                                            text-error-foreground
                                                            sm:p-5
                                                        "
                                                    >
                                                        <p className="text-xs leading-5">
                                                            No pots concedir
                                                            cap rol en aquest
                                                            torneig perquè no
                                                            tens un nivell
                                                            superior a cap dels
                                                            rols assignables.
                                                        </p>
                                                    </div>
                                                )}

                                            {/* ORPHAN */}

                                            {!torneo && (
                                                <div
                                                    className="
                                                        border-t
                                                        border-border
                                                        p-4 sm:p-5
                                                    "
                                                >
                                                    <p className="text-xs leading-5">
                                                        Aquesta assignació
                                                        existeix a les dades
                                                        de l'usuari, però
                                                        el torneig ja no està
                                                        disponible per al teu
                                                        compte. No
                                                        s'eliminarà
                                                        automàticament mentre
                                                        no modifiquis aquesta
                                                        selecció.
                                                    </p>
                                                </div>
                                            )}
                                        </article>
                                    );
                                },
                            )}
                        </div>
                    </div>
                )}

            {/* =================================================
                RESUM DEL PAS
            ================================================= */}

            <div
                className="
                    grid gap-3
                    border-t border-border
                    pt-6
                    sm:grid-cols-3
                "
            >
                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs">
                        Rol general
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {rolGeneralActual
                            ? NOMBRES_ROL[
                                  rolGeneralActual
                              ]
                            : "Pendent d'assignació"}
                    </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs">
                        Accés als tornejos
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {desarrollador ||
                        todos
                            ? "Tots els tornejos"
                            : seleccionados >
                                0
                              ? "Tornejos seleccionats"
                              : "Cap torneig"}
                    </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs">
                        Tornejos seleccionats
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {desarrollador ||
                        todos
                            ? "Tots"
                            : seleccionados}
                    </p>
                </div>
            </div>

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    El rol d'un torneig sempre ha de ser
                    estrictament inferior al rol amb què el gestor
                    administra aquell torneig. Disposar del nivell
                    necessari no concedeix automàticament permisos
                    sensibles com la gestió d'accessos.
                </p>
            </footer>
        </section>
    );
}