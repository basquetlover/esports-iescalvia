import { useId } from "react";

import {
    NOMBRES_ACCIONES,
    NOMBRES_ROL,
    completarPermisosAmbito,
    obtenerSecciones,
    permisoPermitidoPorRol,
    requiereConcesionExplicita,
    type AccionesPermisos,
    type PermisosAmbito,
    type Rol,
    type SeccionPermisos,
} from "@const/Permisos";

// ============================================================
// CONTEXTO
// ============================================================

export type ContextoPasoTorneo =
    | {
          /*
           * Se conserva temporalmente para compatibilidad
           * con el antiguo sistema de permisos comunes.
           *
           * El nuevo Asistente no utilizará una slide común:
           * generará una slide por torneo.
           */
          tipo: "comun";
      }
    | {
          tipo: "individual";

          torneoID: string;

          nombre: string | null;
          deporte: string | null;
      };

// ============================================================
// PROPS NUEVAS
// ============================================================

type PropsNuevo = {
    contexto:
        ContextoPasoTorneo;

    rol:
        Rol | null;

    /*
     * TODOS los permisos del torneo.
     */
    valor:
        PermisosAmbito;

    soloLectura?: boolean;
    bloqueado?: boolean;

    onCambiar: (
        valor: PermisosAmbito,
    ) => void;
};

// ============================================================
// COMPATIBILIDAD TEMPORAL
// ============================================================

/*
 * Asistente.tsx antiguo todavía manda:
 *
 * - seccion
 * - valor = AccionesPermisos
 *
 * Cuando actualicemos Asistente.tsx este formato desaparecerá.
 */
type PropsLegacy = {
    contexto:
        ContextoPasoTorneo;

    seccion:
        SeccionPermisos;

    rol:
        Rol | null;

    valor:
        AccionesPermisos;

    accesoPanelGeneral: boolean;
    accesoPanelTorneo: boolean;

    soloLectura?: boolean;
    bloqueado?: boolean;

    onCambiar: (
        valor: AccionesPermisos,
    ) => void;
};

type Props =
    | PropsNuevo
    | PropsLegacy;

// ============================================================
// DESCRIPCIONES
// ============================================================

const DESCRIPCIONES_SECCIONES:
    Record<string, string> = {
        tornejos:
            "Informació principal i configuració bàsica del torneig.",

        edicions:
            "Gestió de les edicions vinculades al torneig.",

        permisos:
            "Gestió de l'organització, els accessos i els permisos del torneig.",

        voluntaris:
            "Gestió dels voluntaris vinculats al torneig.",

        equips:
            "Gestió dels equips, participants i els seus estats.",

        competicio:
            "Configuració del format i l'estructura de la competició.",

        partits:
            "Gestió del calendari, els partits i els resultats.",

        classificacions:
            "Consulta de les classificacions del torneig.",

        "configuracio-edicio":
            "Configuració avançada de les edicions.",
    };

// ============================================================
// HELPERS
// ============================================================

function esLegacy(
    props: Props,
): props is PropsLegacy {
    return (
        "seccion" in props
    );
}

function nombreAccion(
    accion: string,
) {
    return (
        NOMBRES_ACCIONES[
            accion
        ] ?? accion
    );
}

function inicialAccion(
    accion: string,
) {
    switch (accion) {
        case "ver":
            return "Consultar";

        case "crear":
            return "Crear";

        case "editar":
            return "Editar";

        case "eliminar":
            return "Eliminar";

        case "asignar":
            return "Assignar";

        case "revocar":
            return "Revocar";

        case "evaluar":
            return "Avaluar";

        case "canviar-estat":
            return "Canviar estat";

        default:
            return nombreAccion(
                accion,
            );
    }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoTorneo(
    props: Props,
) {
    const tituloID =
        useId();

    const legacy =
        esLegacy(props);

    const rol =
        props.rol;

    const soloLectura =
        props.soloLectura ??
        false;

    const bloqueado =
        props.bloqueado ??
        false;

    const desactivado =
        soloLectura ||
        bloqueado;

    const desarrollador =
        rol ===
        "desarrollador";

    const comun =
        props.contexto.tipo ===
        "comun";

    const nombreTorneo =
    props.contexto.tipo === "comun"
        ? "Tots els tornejos"
        : props.contexto.nombre?.trim() ||
          "Torneig sense nom";

    // ========================================================
    // SECCIONES
    // ========================================================

    /*
     * Nuevo sistema:
     * todas las secciones configurables del torneo.
     *
     * Legacy:
     * solo la sección que todavía manda Asistente.tsx.
     */
    const secciones =
        legacy
            ? [props.seccion]
            : [
                  ...obtenerSecciones(
                      "torneo",
                      true,
                  ),
              ];

    /*
     * panell nunca aparece en la tabla.
     *
     * Tener asignación al torneo ya concede entrada
     * al panel de ese torneo.
     */
    const seccionesConfigurables =
        secciones.filter(
            (seccion) =>
                seccion.id !==
                    "panell" &&
                seccion.configurable !==
                    false,
        );

    // ========================================================
    // VALOR NORMALIZADO
    // ========================================================

    const valorCompleto:
        PermisosAmbito =
        legacy
            ? {
                  [props.seccion.id]:
                      props.valor,
              }
            : props.valor;

    const permisos =
        completarPermisosAmbito(
            "torneo",
            rol,
            valorCompleto,
        );

    // ========================================================
    // ACCIONES UTILIZADAS COMO COLUMNAS
    // ========================================================

    const acciones =
        [
            ...new Set(
                seccionesConfigurables.flatMap(
                    (seccion) =>
                        seccion.acciones,
                ),
            ),
        ];

    // ========================================================
    // CAMBIO DE CHECKBOX
    // ========================================================

    function cambiar(
        seccionID: string,
        accion: string,
        activo: boolean,
    ) {
        if (
            desactivado ||
            desarrollador
        ) {
            return;
        }

        /*
         * Nunca permitimos activar un permiso
         * que el rol no puede tener.
         */
        if (
            !permisoPermitidoPorRol(
                "torneo",
                rol,
                seccionID,
                accion,
            )
        ) {
            return;
        }

        // ----------------------------------------------------
        // LEGACY
        // ----------------------------------------------------

        if (legacy) {
            if (
                props.seccion.id !==
                seccionID
            ) {
                return;
            }

            props.onCambiar({
                ...props.valor,

                [accion]:
                    activo,
            });

            return;
        }

        // ----------------------------------------------------
        // NUEVO
        // ----------------------------------------------------

        props.onCambiar({
            ...props.valor,

            [seccionID]: {
                ...props.valor[
                    seccionID
                ],

                [accion]:
                    activo,
            },
        });
    }

    // ========================================================
    // CONTADORES
    // ========================================================

    let disponibles = 0;
    let activados = 0;
    let sensibles = 0;

    for (
        const seccion
        of seccionesConfigurables
    ) {
        for (
            const accion
            of seccion.acciones
        ) {
            const permitido =
                permisoPermitidoPorRol(
                    "torneo",
                    rol,
                    seccion.id,
                    accion,
                );

            if (!permitido) {
                continue;
            }

            disponibles += 1;

            if (
                permisos[
                    seccion.id
                ]?.[
                    accion
                ] === true
            ) {
                activados += 1;
            }

            if (
                requiereConcesionExplicita(
                    "torneo",
                    seccion.id,
                    accion,
                )
            ) {
                sensibles += 1;
            }
        }
    }

    // ========================================================
    // CASO TEMPORAL: PANELL
    // ========================================================

    /*
     * Mientras el Asistente antiguo siga generando
     * torneo:*:panell llegará aquí.
     *
     * No mostramos ninguna checkbox.
     */
    if (
        legacy &&
        props.seccion.id ===
            "panell"
    ) {
        return (
            <section
                aria-labelledby={
                    tituloID
                }
                className="space-y-7 text-neutral"
            >
                <header className="border-b border-border pb-5">
                    <p className="mb-3 text-xs font-medium tracking-wide">
                        PERMISOS DEL TORNEIG
                    </p>

                    <h2
                        id={
                            tituloID
                        }
                        className="
                            text-xl font-semibold
                            tracking-tight
                            text-neutral-titulos
                        "
                    >
                        {
                            nombreTorneo
                        }
                    </h2>
                </header>

                <div
                    className="
                        flex items-start gap-3
                        rounded-xl border
                        border-border
                        bg-card p-5
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
                        <path d="m5 12 4 4L19 6" />
                    </svg>

                    <div>
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Accés implícit al torneig
                        </h3>

                        <p className="mt-1 text-sm leading-6">
                            Si l'usuari té aquest torneig
                            assignat, ja pot entrar al seu panell.
                            Aquest accés no es configura amb una
                            casella independent.
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <section
            aria-labelledby={
                tituloID
            }
            className="space-y-7 text-neutral"
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <header className="border-b border-border pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="mb-3 text-xs font-medium tracking-wide">
                            {comun
                                ? "PERMISOS COMUNS"
                                : "PERMISOS DEL TORNEIG"}
                        </p>

                        <h2
                            id={
                                tituloID
                            }
                            className="
                                text-xl font-semibold
                                tracking-tight
                                text-neutral-titulos
                            "
                        >
                            {
                                nombreTorneo
                            }
                        </h2>

                        {!comun &&
                            props.contexto
                                .tipo ===
                                "individual" &&
                            props.contexto
                                .deporte && (
                                <p className="mt-1 text-sm">
                                    {
                                        props.contexto
                                            .deporte
                                    }
                                </p>
                            )}
                    </div>

                    <div
                        className="
                            rounded-xl border
                            border-border bg-card
                            px-4 py-3
                        "
                    >
                        <p className="text-[11px]">
                            Rol aplicable
                        </p>

                        <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                            {rol
                                ? NOMBRES_ROL[
                                      rol
                                  ]
                                : "Pendent d'assignació"}
                        </p>
                    </div>
                </div>

                <p className="mt-4 max-w-3xl text-sm leading-6">
                    Configura tots els permisos d'aquest torneig
                    des d'una única pantalla. El rol determina
                    quines accions poden existir i la configuració
                    personalitzada permet concedir-les o retirar-les
                    dins d'aquest límit.
                </p>
            </header>

            {/* =================================================
                SIN ROL
            ================================================= */}

            {!rol && (
                <div
                    role="alert"
                    className="
                        rounded-xl border
                        border-error/30
                        bg-error-container/40
                        p-4
                        text-error-foreground
                    "
                >
                    <p className="text-sm font-semibold">
                        Falta seleccionar el rol
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        Torna al pas anterior i assigna un rol
                        a aquest torneig abans de configurar-ne
                        els permisos.
                    </p>
                </div>
            )}

            {/* =================================================
                DESARROLLADOR
            ================================================= */}

            {desarrollador && (
                <div
                    className="
                        rounded-xl border
                        border-border bg-card
                        p-4
                    "
                >
                    <p className="text-sm font-semibold text-neutral-titulos">
                        Accés complet
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        El rol Desenvolupador disposa sempre de tots
                        els permisos del torneig. No es poden
                        desactivar individualment.
                    </p>
                </div>
            )}

            {/* =================================================
                RESUM
            ================================================= */}

            {rol && (
                <div className="grid gap-3 sm:grid-cols-3">
                    <div
                        className="
                            rounded-xl border
                            border-border bg-card
                            p-4
                        "
                    >
                        <p className="text-xs">
                            Permisos disponibles
                        </p>

                        <p className="mt-2 text-lg font-semibold text-neutral-titulos">
                            {
                                disponibles
                            }
                        </p>
                    </div>

                    <div
                        className="
                            rounded-xl border
                            border-border bg-card
                            p-4
                        "
                    >
                        <p className="text-xs">
                            Permisos concedits
                        </p>

                        <p className="mt-2 text-lg font-semibold text-neutral-titulos">
                            {
                                activados
                            }
                        </p>
                    </div>

                    <div
                        className="
                            rounded-xl border
                            border-border bg-card
                            p-4
                        "
                    >
                        <p className="text-xs">
                            Permisos sensibles
                        </p>

                        <p className="mt-2 text-lg font-semibold text-neutral-titulos">
                            {
                                sensibles
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* =================================================
                TABLA
            ================================================= */}

            {rol && (
                <div
                    className="
                        overflow-hidden
                        rounded-xl border
                        border-border
                    "
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-230 text-left">
                            {/* CABECERA */}

                            <thead
                                className="
                                    border-b
                                    border-border
                                    bg-card
                                    text-xs
                                "
                            >
                                <tr>
                                    <th
                                        scope="col"
                                        className="
                                            sticky left-0
                                            z-10 min-w-56
                                            border-r
                                            border-border
                                            bg-card
                                            px-4 py-3.5
                                            font-semibold
                                        "
                                    >
                                        Secció
                                    </th>

                                    {acciones.map(
                                        (
                                            accion,
                                        ) => (
                                            <th
                                                key={
                                                    accion
                                                }
                                                scope="col"
                                                className="
                                                    min-w-30
                                                    px-3 py-3.5
                                                    text-center
                                                    font-semibold
                                                "
                                            >
                                                {inicialAccion(
                                                    accion,
                                                )}
                                            </th>
                                        ),
                                    )}
                                </tr>
                            </thead>

                            {/* CUERPO */}

                            <tbody className="divide-y divide-border">
                                {seccionesConfigurables.map(
                                    (
                                        seccion,
                                    ) => (
                                        <tr
                                            key={
                                                seccion.id
                                            }
                                            className="
                                                transition-colors
                                                hover:bg-card/25
                                            "
                                        >
                                            {/* NOMBRE */}

                                            <th
                                                scope="row"
                                                className="
                                                    sticky left-0
                                                    z-10
                                                    border-r
                                                    border-border
                                                    bg-background
                                                    px-4 py-4
                                                    align-top
                                                "
                                            >
                                                <p className="text-sm font-semibold text-neutral-titulos">
                                                    {
                                                        seccion.nombre
                                                    }
                                                </p>

                                                <p className="mt-1 max-w-52 text-[11px] font-normal leading-4 text-neutral">
                                                    {DESCRIPCIONES_SECCIONES[
                                                        seccion.id
                                                    ] ??
                                                        "Permisos disponibles en aquesta secció."}
                                                </p>
                                            </th>

                                            {/* ACCIONES */}

                                            {acciones.map(
                                                (
                                                    accion,
                                                ) => {
                                                    const existe =
                                                        seccion.acciones.includes(
                                                            accion,
                                                        );

                                                    if (
                                                        !existe
                                                    ) {
                                                        return (
                                                            <td
                                                                key={
                                                                    accion
                                                                }
                                                                className="
                                                                    px-3 py-4
                                                                    text-center
                                                                    text-neutral/40
                                                                "
                                                            >
                                                                <span
                                                                    aria-label="No aplicable"
                                                                    title="No aplicable"
                                                                >
                                                                    —
                                                                </span>
                                                            </td>
                                                        );
                                                    }

                                                    const permitido =
                                                        permisoPermitidoPorRol(
                                                            "torneo",
                                                            rol,
                                                            seccion.id,
                                                            accion,
                                                        );

                                                    const sensible =
                                                        requiereConcesionExplicita(
                                                            "torneo",
                                                            seccion.id,
                                                            accion,
                                                        );

                                                    const activo =
                                                        permisos[
                                                            seccion
                                                                .id
                                                        ]?.[
                                                            accion
                                                        ] ===
                                                        true;

                                                    const checkboxID =
                                                        `${tituloID}-${seccion.id}-${accion}`;

                                                    /*
                                                     * Si el rol no puede
                                                     * tenerlo directamente
                                                     * NO mostramos una
                                                     * checkbox utilizable.
                                                     */
                                                    if (
                                                        !permitido
                                                    ) {
                                                        return (
                                                            <td
                                                                key={
                                                                    accion
                                                                }
                                                                className="
                                                                    px-3 py-4
                                                                    text-center
                                                                "
                                                            >
                                                                <span
                                                                    className="
                                                                        inline-flex
                                                                        h-7 w-7
                                                                        items-center
                                                                        justify-center
                                                                        rounded-lg
                                                                        border
                                                                        border-border
                                                                        bg-card
                                                                        text-neutral/45
                                                                    "
                                                                    title="No disponible per aquest rol"
                                                                    aria-label={`${nombreAccion(
                                                                        accion,
                                                                    )} no disponible per aquest rol`}
                                                                >
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="1.7"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        className="h-3.5 w-3.5"
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
                                                                </span>
                                                            </td>
                                                        );
                                                    }

                                                    return (
                                                        <td
                                                            key={
                                                                accion
                                                            }
                                                            className="
                                                                px-3 py-4
                                                                text-center
                                                            "
                                                        >
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <input
                                                                    id={
                                                                        checkboxID
                                                                    }
                                                                    type="checkbox"
                                                                    checked={
                                                                        activo
                                                                    }
                                                                    disabled={
                                                                        desactivado ||
                                                                        desarrollador
                                                                    }
                                                                    onChange={(
                                                                        evento,
                                                                    ) =>
                                                                        cambiar(
                                                                            seccion.id,
                                                                            accion,
                                                                            evento
                                                                                .target
                                                                                .checked,
                                                                        )
                                                                    }
                                                                    aria-label={`${nombreAccion(
                                                                        accion,
                                                                    )} · ${seccion.nombre}`}
                                                                    className="
                                                                        h-5 w-5
                                                                        accent-primary
                                                                        disabled:cursor-not-allowed
                                                                        disabled:opacity-60
                                                                    "
                                                                />

                                                                {sensible &&
                                                                    !desarrollador && (
                                                                        <span
                                                                            className="
                                                                                whitespace-nowrap
                                                                                text-[9px]
                                                                                font-medium
                                                                            "
                                                                        >
                                                                            Manual
                                                                        </span>
                                                                    )}
                                                            </div>
                                                        </td>
                                                    );
                                                },
                                            )}
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =================================================
                LEYENDA
            ================================================= */}

            {rol &&
                !desarrollador && (
                    <div className="grid gap-3 md:grid-cols-3">
                        {/* DISPONIBLE */}

                        <div
                            className="
                                rounded-xl border
                                border-border p-4
                            "
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked
                                    readOnly
                                    tabIndex={
                                        -1
                                    }
                                    aria-hidden="true"
                                    className="
                                        h-4 w-4
                                        accent-primary
                                    "
                                />

                                <p className="text-sm font-semibold text-neutral-titulos">
                                    Concedit
                                </p>
                            </div>

                            <p className="mt-2 text-xs leading-5">
                                El rol permet aquest permís i està
                                concedit a l'usuari.
                            </p>
                        </div>

                        {/* SENSIBLE */}

                        <div
                            className="
                                rounded-xl border
                                border-border p-4
                            "
                        >
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={
                                        false
                                    }
                                    readOnly
                                    tabIndex={
                                        -1
                                    }
                                    aria-hidden="true"
                                    className="
                                        h-4 w-4
                                        accent-primary
                                    "
                                />

                                <p className="text-sm font-semibold text-neutral-titulos">
                                    Concessió manual
                                </p>
                            </div>

                            <p className="mt-2 text-xs leading-5">
                                Alguns permisos sensibles, com la
                                gestió d'accessos, comencen
                                desactivats encara que el rol els
                                pugui tenir.
                            </p>
                        </div>

                        {/* BLOQUEADO */}

                        <div
                            className="
                                rounded-xl border
                                border-border p-4
                            "
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    aria-hidden="true"
                                    className="
                                        flex h-6 w-6
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
                                        strokeWidth="1.7"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-3.5 w-3.5"
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
                                </span>

                                <p className="text-sm font-semibold text-neutral-titulos">
                                    No disponible
                                </p>
                            </div>

                            <p className="mt-2 text-xs leading-5">
                                El rol no té nivell suficient i aquest
                                permís no es pot concedir.
                            </p>
                        </div>
                    </div>
                )}

            {/* =================================================
                AVISO PERMISOS
            ================================================= */}

            {rol &&
                rol !==
                    "desarrollador" &&
                permisoPermitidoPorRol(
                    "torneo",
                    rol,
                    "permisos",
                    "ver",
                ) && (
                    <div
                        className="
                            rounded-xl border
                            border-border bg-card
                            p-4
                        "
                    >
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Gestió de permisos del torneig
                        </h3>

                        <p className="mt-1 text-sm leading-6">
                            Els permisos de la fila
                            «Organització i permisos» no s'activen
                            automàticament. S'han de concedir de
                            manera expressa.
                        </p>

                        {rol ===
                            "admintorneo" && (
                            <p className="mt-2 text-xs leading-5">
                                Encara que disposi del permís per
                                assignar accessos, un Administrador de
                                torneig només podrà gestionar usuaris
                                amb rol Staff o Voluntari. Mai podrà
                                crear ni modificar un altre
                                Administrador de torneig.
                            </p>
                        )}
                    </div>
                )}

            {/* =================================================
                COMPATIBILIDAD
            ================================================= */}

            {legacy && (
                <div
                    className="
                        rounded-xl border
                        border-border
                        bg-card/40 p-4
                    "
                >
                    <p className="text-xs leading-5">
                        Aquesta pantalla encara està funcionant en
                        mode de compatibilitat perquè l'assistent
                        antic continua enviant una secció per pas.
                        Quan actualitzem l'assistent, aquesta
                        mateixa taula mostrarà totes les seccions del
                        torneig alhora.
                    </p>
                </div>
            )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    El rol estableix el límit màxim. Els permisos
                    personalitzats poden restringir o concedir accions
                    disponibles per al rol, però mai poden habilitar
                    una acció reservada a un nivell superior.
                </p>
            </footer>
        </section>
    );
}