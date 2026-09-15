import { useId } from "react";

import {
    NOMBRES_ROL,
    calcularRolMinimo,
    obtenerSecciones,
    permisoPermitidoPorRol,
    type AmbitoPermisos,
    type DocumentoPermisos,
    type PermisosAmbito,
    type Rol,
} from "@const/Permisos";

// ============================================================
// TIPOS
// ============================================================

export type UsuarioResumen = {
    id: string;

    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;

    email: string | null;
};

export type TorneoResumen = {
    id: string;
    nombre: string | null;
    deporte: string | null;
};

type Props = {
    usuario:
        UsuarioResumen;

    /*
     * NUEVO.
     *
     * El rol general se selecciona explícitamente.
     *
     * Se mantiene opcional temporalmente para que
     * el Asistente antiguo siga compilando.
     */
    rolGeneral?: Rol | null;

    documento:
        DocumentoPermisos;

    torneos:
        readonly TorneoResumen[];

    advertencias?:
        readonly string[];

    revisionAceptada?:
        boolean;

    soloLectura?:
        boolean;

    bloqueado?:
        boolean;

    onCambiarRevision?: (
        aceptada: boolean,
    ) => void;
};

// ============================================================
// HELPERS
// ============================================================

function obtenerNombreUsuario(
    usuario: UsuarioResumen,
) {
    return (
        [
            usuario.nombre,
            usuario.apellido1,
            usuario.apellido2,
        ]
            .filter(Boolean)
            .join(" ")
            .trim() ||
        "Usuari sense nom"
    );
}

/*
 * Compatibilidad temporal.
 *
 * Cuando Asistente.tsx pase rolGeneral
 * explícitamente esta función dejará de utilizarse.
 */
function obtenerRolLegacy(
    documento: DocumentoPermisos,
): Rol | null {
    try {
        return calcularRolMinimo(
            documento,
        );
    } catch {
        return null;
    }
}

function contarPermisos(
    permisos: PermisosAmbito,
    ambito: AmbitoPermisos,
    rol: Rol | null,
) {
    let disponibles = 0;
    let activados = 0;

    for (
        const seccion
        of obtenerSecciones(
            ambito,
            true,
        )
    ) {
        /*
         * panell nunca se cuenta:
         * no es configurable.
         */
        if (
            seccion.id ===
            "panell"
        ) {
            continue;
        }

        for (
            const accion
            of seccion.acciones
        ) {
            if (
                !permisoPermitidoPorRol(
                    ambito,
                    rol,
                    seccion.id,
                    accion,
                )
            ) {
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
        }
    }

    return {
        disponibles,
        activados,
    };
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoResumen({
    usuario,
    rolGeneral,
    documento,
    torneos,
    advertencias = [],
    revisionAceptada = false,
    soloLectura = false,
    bloqueado = false,
    onCambiarRevision,
}: Props) {
    const tituloID =
        useId();

    const rolGeneralActual =
        rolGeneral ===
        undefined
            ? obtenerRolLegacy(
                  documento,
              )
            : rolGeneral;

    const desarrollador =
        rolGeneralActual ===
        "desarrollador";

    const nombreUsuario =
        obtenerNombreUsuario(
            usuario,
        );

    const desactivado =
        soloLectura ||
        bloqueado;

    const hayAdvertencias =
        advertencias.length >
        0;

    // ========================================================
    // TORNEOS
    // ========================================================

    const torneosPorID =
        new Map(
            torneos.map(
                (torneo) => [
                    torneo.id.toLowerCase(),
                    torneo,
                ],
            ),
        );

    const asignaciones =
        Object.entries(
            documento.torneos,
        );

    const asignacionesActivas =
        asignaciones.filter(
            (
                [
                    ,
                    asignacion,
                ],
            ) =>
                asignacion.acceso,
        );

    /*
     * Se conservan para representar datos antiguos.
     *
     * El nuevo asistente ya no crea exclusiones individuales
     * cuando se utiliza "todos".
     */
    const exclusiones =
        asignaciones.filter(
            (
                [
                    ,
                    asignacion,
                ],
            ) =>
                !asignacion.acceso,
        );

    const accesoTodos =
        desarrollador ||
        documento
            .acceso_torneos
            .todos;

    const rolComun =
        desarrollador
            ? "desarrollador"
            : documento
                  .acceso_torneos
                  .rol;

    // ========================================================
    // PERMISOS GENERALES
    // ========================================================

    const resumenGeneral =
        contarPermisos(
            documento.globales,
            "general",
            rolGeneralActual,
        );

    // ========================================================
    // PERMISOS COMUNES
    // ========================================================

    const resumenComun =
        contarPermisos(
            documento
                .acceso_torneos
                .permisos,
            "torneo",
            rolComun,
        );

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
                <div className="mb-3 flex items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="
                            flex h-8 w-8
                            items-center
                            justify-center
                            rounded-lg
                            border border-border
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
                            className="h-4 w-4"
                        >
                            <path d="M9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                    </span>

                    <span className="text-xs font-medium tracking-wide">
                        RESUM
                    </span>
                </div>

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
                    Revisa la configuració
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6">
                    Comprova el rol general, els tornejos assignats
                    i els permisos abans de desar els canvis.
                </p>
            </header>

            {/* =================================================
                USUARIO + ROL GENERAL
            ================================================= */}

            <div
                className="
                    overflow-hidden rounded-xl
                    border border-border
                "
            >
                <div
                    className="
                        flex flex-col gap-4
                        bg-card p-5
                        sm:flex-row
                        sm:items-center
                        sm:justify-between
                    "
                >
                    <div className="min-w-0">
                        <p className="text-xs">
                            Usuari
                        </p>

                        <h3
                            className="
                                mt-1 wrap-break-words
                                text-base font-semibold
                                text-neutral-titulos
                            "
                        >
                            {
                                nombreUsuario
                            }
                        </h3>

                        <p className="mt-1 break-all text-sm">
                            {usuario.email ||
                                "Sense correu electrònic"}
                        </p>
                    </div>

                    <div
                        className="
                            shrink-0 rounded-lg
                            border border-border
                            bg-background
                            px-4 py-3
                        "
                    >
                        <p className="text-xs sm:text-right">
                            Rol general
                        </p>

                        <p
                            className="
                                mt-1 text-sm
                                font-semibold
                                text-neutral-titulos
                                sm:text-right
                            "
                        >
                            {rolGeneralActual
                                ? NOMBRES_ROL[
                                      rolGeneralActual
                                  ]
                                : "Sense rol"}
                        </p>
                    </div>
                </div>

                {desarrollador && (
                    <div
                        className="
                            border-t
                            border-border
                            px-5 py-4
                        "
                    >
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Accés complet
                        </p>

                        <p className="mt-1 text-xs leading-5">
                            El rol Desenvolupador disposa de tots els
                            permisos generals i de tots els permisos
                            de tots els tornejos.
                        </p>
                    </div>
                )}
            </div>

            {/* =================================================
                RESUM PRINCIPAL
            ================================================= */}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* ROL */}

                <div
                    className="
                        rounded-xl border
                        border-border p-4
                    "
                >
                    <p className="text-xs">
                        Rol general
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {rolGeneralActual
                            ? NOMBRES_ROL[
                                  rolGeneralActual
                              ]
                            : "Pendent"}
                    </p>
                </div>

                {/* PERMISOS GENERALES */}

                <div
                    className="
                        rounded-xl border
                        border-border p-4
                    "
                >
                    <p className="text-xs">
                        Permisos generals
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {resumenGeneral.disponibles >
                        0
                            ? `${resumenGeneral.activados} de ${resumenGeneral.disponibles}`
                            : "No aplicable"}
                    </p>
                </div>

                {/* ALCANCE */}

                <div
                    className="
                        rounded-xl border
                        border-border p-4
                    "
                >
                    <p className="text-xs">
                        Abast dels tornejos
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {accesoTodos
                            ? "Tots"
                            : asignacionesActivas.length >
                                0
                              ? `${asignacionesActivas.length} seleccionats`
                              : "Cap"}
                    </p>
                </div>

                {/* TORNEOS ACTUALES */}

                <div
                    className="
                        rounded-xl border
                        border-border p-4
                    "
                >
                    <p className="text-xs">
                        Tornejos actuals
                    </p>

                    <p className="mt-2 text-sm font-semibold text-neutral-titulos">
                        {accesoTodos
                            ? torneos.length
                            : asignacionesActivas.length}
                    </p>
                </div>
            </div>

            {/* =================================================
                PERMISOS GENERALES
            ================================================= */}

            {resumenGeneral.disponibles >
                0 && (
                <div
                    className="
                        overflow-hidden
                        rounded-xl
                        border border-border
                    "
                >
                    <div className="bg-card p-5">
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Permisos generals
                        </h3>

                        <p className="mt-1 text-xs leading-5">
                            Configuració aplicable al conjunt de la
                            plataforma.
                        </p>
                    </div>

                    <div
                        className="
                            grid gap-5
                            border-t
                            border-border
                            p-5
                            sm:grid-cols-2
                        "
                    >
                        <div>
                            <p className="text-xs">
                                Disponibles pel rol
                            </p>

                            <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                {
                                    resumenGeneral.disponibles
                                }
                            </p>
                        </div>

                        <div>
                            <p className="text-xs">
                                Concedits
                            </p>

                            <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                {
                                    resumenGeneral.activados
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                ACCESO A TODOS
            ================================================= */}

            {accesoTodos && (
                <div
                    className="
                        overflow-hidden
                        rounded-xl
                        border border-border
                    "
                >
                    <div
                        className="
                            flex flex-col gap-3
                            bg-card p-5
                            sm:flex-row
                            sm:items-start
                            sm:justify-between
                        "
                    >
                        <div>
                            <h3 className="text-sm font-semibold text-neutral-titulos">
                                Tots els tornejos
                            </h3>

                            <p className="mt-1 text-xs leading-5">
                                Aquesta configuració també s'aplicarà
                                als tornejos que es creïn en el futur.
                            </p>
                        </div>

                        <span
                            className="
                                self-start
                                rounded-full
                                border border-border
                                bg-background
                                px-3 py-1.5
                                text-xs
                            "
                        >
                            Accés comú
                        </span>
                    </div>

                    <div
                        className="
                            grid gap-5
                            border-t
                            border-border
                            p-5
                            sm:grid-cols-3
                        "
                    >
                        <div>
                            <p className="text-xs">
                                Rol
                            </p>

                            <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                {rolComun
                                    ? NOMBRES_ROL[
                                          rolComun
                                      ]
                                    : "Pendent"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs">
                                Permisos disponibles
                            </p>

                            <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                {
                                    resumenComun.disponibles
                                }
                            </p>
                        </div>

                        <div>
                            <p className="text-xs">
                                Permisos concedits
                            </p>

                            <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                {
                                    resumenComun.activados
                                }
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                TORNEOS INDIVIDUALES
            ================================================= */}

            {!accesoTodos && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-base font-semibold text-neutral-titulos">
                            Tornejos seleccionats
                        </h3>

                        <p className="mt-1 text-sm leading-6">
                            Rols i permisos configurats individualment
                            per a cada torneig.
                        </p>
                    </div>

                    {asignacionesActivas.length ===
                    0 ? (
                        <div
                            className="
                                rounded-xl border
                                border-dashed
                                border-border
                                p-7 text-center
                            "
                        >
                            <p className="text-sm font-semibold text-neutral-titulos">
                                No hi ha cap torneig seleccionat
                            </p>

                            <p className="mt-2 text-xs leading-5">
                                Torna al pas de rols i tornejos per
                                seleccionar almenys un torneig.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {asignacionesActivas.map(
                                ([
                                    id,
                                    asignacion,
                                ]) => {
                                    const torneo =
                                        torneosPorID.get(
                                            id.toLowerCase(),
                                        );

                                    const nombre =
                                        torneo
                                            ?.nombre
                                            ?.trim() ||
                                        "Torneig no disponible";

                                    const resumen =
                                        contarPermisos(
                                            asignacion.permisos,
                                            "torneo",
                                            asignacion.rol,
                                        );

                                    return (
                                        <article
                                            key={
                                                id
                                            }
                                            className="
                                                overflow-hidden
                                                rounded-xl
                                                border
                                                border-border
                                            "
                                        >
                                            <div
                                                className="
                                                    flex flex-col
                                                    gap-3 p-4
                                                    sm:flex-row
                                                    sm:items-start
                                                    sm:justify-between
                                                    sm:p-5
                                                "
                                            >
                                                <div className="min-w-0">
                                                    <h4 className="wrap-break-words text-sm font-semibold text-neutral-titulos">
                                                        {
                                                            nombre
                                                        }
                                                    </h4>

                                                    {torneo?.deporte && (
                                                        <p className="mt-1 text-xs">
                                                            {
                                                                torneo.deporte
                                                            }
                                                        </p>
                                                    )}

                                                    {!torneo && (
                                                        <p className="mt-1 break-all text-xs">
                                                            {
                                                                id
                                                            }
                                                        </p>
                                                    )}
                                                </div>

                                                <span
                                                    className="
                                                        self-start
                                                        rounded-full
                                                        border
                                                        border-border
                                                        bg-card
                                                        px-2.5 py-1
                                                        text-xs
                                                    "
                                                >
                                                    Assignat
                                                </span>
                                            </div>

                                            <dl
                                                className="
                                                    grid gap-4
                                                    border-t
                                                    border-border
                                                    bg-background
                                                    p-4
                                                    sm:grid-cols-3
                                                    sm:p-5
                                                "
                                            >
                                                <div>
                                                    <dt className="text-xs">
                                                        Rol
                                                    </dt>

                                                    <dd className="mt-1 text-sm font-semibold text-neutral-titulos">
                                                        {asignacion.rol
                                                            ? NOMBRES_ROL[
                                                                  asignacion
                                                                      .rol
                                                              ]
                                                            : "Pendent"}
                                                    </dd>
                                                </div>

                                                <div>
                                                    <dt className="text-xs">
                                                        Disponibles
                                                    </dt>

                                                    <dd className="mt-1 text-sm font-semibold text-neutral-titulos">
                                                        {
                                                            resumen.disponibles
                                                        }
                                                    </dd>
                                                </div>

                                                <div>
                                                    <dt className="text-xs">
                                                        Concedits
                                                    </dt>

                                                    <dd className="mt-1 text-sm font-semibold text-neutral-titulos">
                                                        {
                                                            resumen.activados
                                                        }
                                                    </dd>
                                                </div>
                                            </dl>
                                        </article>
                                    );
                                },
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* =================================================
                EXCLUSIONES ANTIGUAS
            ================================================= */}

            {exclusiones.length >
                0 && (
                <div
                    className="
                        rounded-xl border
                        border-border
                        bg-card p-5
                    "
                >
                    <h3 className="text-sm font-semibold text-neutral-titulos">
                        Exclusions conservades
                    </h3>

                    <p className="mt-1 text-sm leading-6">
                        Aquesta configuració conté exclusions
                        individuals procedents del sistema anterior.
                        Es conserven temporalment per no modificar
                        dades existents de manera automàtica.
                    </p>

                    <ul className="mt-4 space-y-2">
                        {exclusiones.map(
                            ([
                                id,
                            ]) => {
                                const torneo =
                                    torneosPorID.get(
                                        id.toLowerCase(),
                                    );

                                return (
                                    <li
                                        key={
                                            id
                                        }
                                        className="
                                            flex items-center
                                            gap-2 text-xs
                                        "
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="
                                                h-1.5 w-1.5
                                                shrink-0
                                                rounded-full
                                                bg-neutral
                                            "
                                        />

                                        <span>
                                            {torneo
                                                ?.nombre ||
                                                id}
                                        </span>
                                    </li>
                                );
                            },
                        )}
                    </ul>
                </div>
            )}

            {/* =================================================
                ADVERTENCIAS
            ================================================= */}

            {hayAdvertencias && (
                <div className="space-y-4">
                    <div
                        role="alert"
                        className="
                            rounded-xl border
                            border-error/30
                            bg-error-container/40
                            p-5
                            text-error-foreground
                        "
                    >
                        <div className="flex items-start gap-3">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="mt-0.5 h-5 w-5 shrink-0"
                                aria-hidden="true"
                            >
                                <path d="m12 3 10 18H2L12 3Z" />
                                <path d="M12 9v4" />
                                <path d="M12 17h.01" />
                            </svg>

                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold">
                                    Aquesta configuració necessita revisió
                                </h3>

                                <p className="mt-1 text-sm leading-6">
                                    S'han detectat dades anteriors
                                    que necessiten revisió abans de
                                    desar.
                                </p>

                                <ul className="mt-4 space-y-2">
                                    {advertencias.map(
                                        (
                                            advertencia,
                                            indice,
                                        ) => (
                                            <li
                                                key={`${indice}-${advertencia}`}
                                                className="
                                                    flex
                                                    items-start
                                                    gap-2
                                                    text-xs
                                                    leading-5
                                                "
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="
                                                        mt-2
                                                        h-1 w-1
                                                        shrink-0
                                                        rounded-full
                                                        bg-current
                                                    "
                                                />

                                                <span>
                                                    {
                                                        advertencia
                                                    }
                                                </span>
                                            </li>
                                        ),
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {!soloLectura &&
                        onCambiarRevision && (
                            <label
                                className={`
                                    flex items-start
                                    gap-3 rounded-xl
                                    border border-border
                                    p-4

                                    ${
                                        bloqueado
                                            ? "cursor-wait opacity-60"
                                            : "cursor-pointer"
                                    }
                                `}
                            >
                                <input
                                    type="checkbox"
                                    checked={
                                        revisionAceptada
                                    }
                                    disabled={
                                        desactivado
                                    }
                                    onChange={(
                                        evento,
                                    ) =>
                                        onCambiarRevision(
                                            evento
                                                .target
                                                .checked,
                                        )
                                    }
                                    className="
                                        mt-0.5 h-4 w-4
                                        shrink-0
                                        accent-primary
                                    "
                                />

                                <span>
                                    <span className="block text-sm font-semibold text-neutral-titulos">
                                        He revisat les advertències
                                    </span>

                                    <span className="mt-1 block text-xs leading-5">
                                        Entenc que en desar
                                        s'utilitzarà
                                        l'estructura actual de
                                        permisos.
                                    </span>
                                </span>
                            </label>
                        )}
                </div>
            )}

            {/* =================================================
                TODO CORRECTO
            ================================================= */}

            {!hayAdvertencias &&
                !soloLectura && (
                    <div
                        className="
                            flex items-start gap-3
                            rounded-xl border
                            border-border
                            bg-card p-4
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
                            className="mt-0.5 h-5 w-5 shrink-0"
                            aria-hidden="true"
                        >
                            <path d="m5 12 4 4L19 6" />
                        </svg>

                        <div>
                            <p className="text-sm font-semibold text-neutral-titulos">
                                Configuració preparada
                            </p>

                            <p className="mt-1 text-sm leading-6">
                                Revisa el resum i desa els canvis si
                                la configuració és correcta.
                            </p>
                        </div>
                    </div>
                )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    El servidor tornarà a comprovar la jerarquia dels
                    rols, els permisos concedits i l'accés als
                    tornejos abans de desar qualsevol modificació.
                </p>
            </footer>
        </section>
    );
}