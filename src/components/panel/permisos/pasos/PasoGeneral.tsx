import { useId } from "react";

import {
    NOMBRES_ROL,
    NOMBRES_ACCIONES,
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
// PROPS
// ============================================================

/*
 * Formato definitivo.
 *
 * Una única slide recibe TODOS los permisos generales.
 */
type PropsNuevo = {
    rolGeneral: Rol | null;

    valor: PermisosAmbito;

    soloLectura?: boolean;
    bloqueado?: boolean;

    onCambiar: (
        valor: PermisosAmbito,
    ) => void;
};

/*
 * Compatibilidad temporal con el Asistente.tsx actual.
 *
 * El asistente antiguo todavía crea una slide
 * por sección y pasa AccionesPermisos.
 *
 * Cuando lleguemos a Asistente.tsx esta interfaz
 * dejará de utilizarse.
 */
type PropsLegacy = {
    seccion: SeccionPermisos;

    rolGeneral: Rol | null;

    valor: AccionesPermisos;

    /*
     * Ya no se utiliza.
     *
     * Se conserva únicamente para que el Asistente
     * antiguo siga compilando.
     */
    accesoPanel: boolean;

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
// HELPERS
// ============================================================

function esLegacy(
    props: Props,
): props is PropsLegacy {
    return (
        "seccion" in props
    );
}

function nombrePermiso(
    accion: string,
) {
    return (
        NOMBRES_ACCIONES[
            accion
        ] ?? accion
    );
}

const DESCRIPCIONES:
    Record<
        string,
        Record<
            string,
            string
        >
    > = {
        tornejos: {
            ver:
                "Permet consultar la gestió general dels tornejos.",

            crear:
                "Permet crear nous tornejos a la plataforma.",
        },

        usuaris: {
            ver:
                "Permet consultar els comptes registrats.",

            bloquear:
                "Permet bloquejar comptes d'usuaris que pugui gestionar.",

            desbloquear:
                "Permet tornar a activar comptes bloquejats que pugui gestionar.",
        },

        permisos: {
            ver:
                "Permet consultar usuaris amb accés administratiu i la seva configuració.",

            crear:
                "Permet concedir accés administratiu a altres usuaris dins dels límits del seu rol.",

            editar:
                "Permet modificar rols, tornejos i permisos d'usuaris de nivell inferior.",

            eliminar:
                "Permet retirar completament l'accés administratiu d'usuaris que pugui gestionar.",
        },

        configuracio: {
            ver:
                "Permet consultar la configuració general de la plataforma.",

            editar:
                "Permet modificar la configuració general de la plataforma.",
        },
    };

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoGeneral(
    props: Props,
) {
    const tituloID =
        useId();

    const rolGeneral =
        props.rolGeneral;

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
        rolGeneral ===
        "desarrollador";

    const legacy =
        esLegacy(props);

    /*
     * Nuevo modo:
     * todas las secciones configurables.
     *
     * Modo antiguo:
     * solo la sección que todavía manda Asistente.
     */
    const secciones =
        legacy
            ? [props.seccion]
            : [
                  ...obtenerSecciones(
                      "general",
                      true,
                  ),
              ];

    /*
     * El panell sigue existiendo internamente,
     * pero nunca debe aparecer como permiso
     * configurable.
     */
    const seccionesConfigurables =
        secciones.filter(
            (seccion) =>
                seccion.id !==
                    "panell" &&
                seccion.configurable !==
                    false,
        );

    const valorCompleto:
        PermisosAmbito =
        legacy
            ? {
                  [props.seccion.id]:
                      props.valor,
              }
            : props.valor;

    /*
     * Rellena cualquier booleano ausente según
     * las reglas actuales.
     *
     * - permisos normales: valor por defecto
     * - sensibles: false
     * - desarrollador: todo true
     */
    const permisos =
        completarPermisosAmbito(
            "general",
            rolGeneral,
            valorCompleto,
        );

    const filas =
        seccionesConfigurables.flatMap(
            (seccion) =>
                seccion.acciones.map(
                    (accion) => ({
                        seccion,
                        accion,

                        permitido:
                            permisoPermitidoPorRol(
                                "general",
                                rolGeneral,
                                seccion.id,
                                accion,
                            ),

                        sensible:
                            requiereConcesionExplicita(
                                "general",
                                seccion.id,
                                accion,
                            ),

                        activo:
                            permisos[
                                seccion.id
                            ]?.[
                                accion
                            ] === true,
                    }),
                ),
        );

    /*
     * No mostramos permisos imposibles para el rol.
     *
     * Por ejemplo:
     * - Staff
     * - Administrador de torneo
     *
     * no tienen configuración general disponible.
     */
    const filasDisponibles =
        filas.filter(
            (fila) =>
                fila.permitido,
        );

    function cambiar(
        seccionID: string,
        accion: string,
        activado: boolean,
    ) {
        if (
            desactivado ||
            desarrollador
        ) {
            return;
        }

        if (
            !permisoPermitidoPorRol(
                "general",
                rolGeneral,
                seccionID,
                accion,
            )
        ) {
            return;
        }

        /*
         * Compatibilidad temporal.
         */
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
                    activado,
            });

            return;
        }

        props.onCambiar({
            ...props.valor,

            [seccionID]: {
                ...props.valor[
                    seccionID
                ],

                [accion]:
                    activado,
            },
        });
    }

    // ========================================================
    // COMPATIBILIDAD: SLIDE ANTIGUA panell
    // ========================================================

    /*
     * Hasta actualizar Asistente.tsx seguirá existiendo
     * temporalmente el paso general:panell.
     *
     * En vez de mostrar una checkbox, explicamos que el
     * acceso ya es implícito.
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
                        PERMISOS GENERALS
                    </p>

                    <h2
                        id={tituloID}
                        className="
                            text-xl font-semibold
                            tracking-tight
                            text-neutral-titulos
                        "
                    >
                        Accés al panell
                    </h2>

                    <p className="mt-2 max-w-2xl text-sm leading-6">
                        Aquest accés ja no es configura manualment.
                    </p>
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
                            Accés implícit
                        </h3>

                        <p className="mt-1 text-sm leading-6">
                            Assignar un rol administratiu ja concedeix
                            l'entrada al panell. Per tant, no existeix
                            cap permís independent per activar o
                            desactivar aquest accés.
                        </p>

                        <p className="mt-2 text-xs leading-5">
                            Per retirar completament l'accés
                            administratiu s'ha d'utilitzar
                            l'acció «Retirar» de la gestió
                            d'usuaris.
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
            {/* CABECERA */}

            <header className="border-b border-border pb-5">
                <p className="mb-3 text-xs font-medium tracking-wide">
                    PERMISOS GENERALS
                </p>

                <h2
                    id={tituloID}
                    className="
                        text-xl font-semibold
                        tracking-tight
                        text-neutral-titulos
                    "
                >
                    Configuració general
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6">
                    Configura els permisos generals de la plataforma.
                    El rol determina quins permisos poden existir i
                    aquesta taula només permet concedir-los o
                    retirar-los dins d'aquest límit.
                </p>
            </header>

            {/* ROL */}

            <div
                className="
                    flex flex-col gap-3
                    rounded-xl border
                    border-border bg-card
                    p-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                "
            >
                <div>
                    <p className="text-xs">
                        Rol general
                    </p>

                    <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                        {rolGeneral
                            ? NOMBRES_ROL[
                                  rolGeneral
                              ]
                            : "Pendent d'assignació"}
                    </p>
                </div>

                {desarrollador && (
                    <span
                        className="
                            self-start rounded-full
                            border border-border
                            bg-background
                            px-3 py-1.5
                            text-xs
                            sm:self-center
                        "
                    >
                        Accés complet
                    </span>
                )}
            </div>

            {/* SIN ROL */}

            {!rolGeneral && (
                <div
                    role="status"
                    className="
                        rounded-xl border
                        border-border p-5
                    "
                >
                    <h3 className="text-sm font-semibold text-neutral-titulos">
                        Falta seleccionar el rol general
                    </h3>

                    <p className="mt-1 text-sm leading-6">
                        Torna al pas anterior i assigna un rol abans
                        de configurar els permisos generals.
                    </p>
                </div>
            )}

            {/* SIN PERMISOS GENERALES */}

            {rolGeneral &&
                filasDisponibles.length ===
                    0 && (
                    <div
                        className="
                            rounded-xl border
                            border-border bg-card
                            p-5
                        "
                    >
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Aquest rol no disposa de configuració general
                        </h3>

                        <p className="mt-1 text-sm leading-6">
                            Els permisos d'aquest usuari es
                            configuraran únicament dins dels tornejos
                            als quals tingui accés.
                        </p>

                        <p className="mt-2 text-xs leading-5">
                            Aquest pas desapareixerà automàticament del
                            flux quan actualitzem l'assistent.
                        </p>
                    </div>
                )}

            {/* TABLA */}

            {filasDisponibles.length >
                0 && (
                <div
                    className="
                        overflow-hidden
                        rounded-xl border
                        border-border
                    "
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-180 text-left">
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
                                        className="px-4 py-3.5 font-semibold"
                                    >
                                        Secció
                                    </th>

                                    <th
                                        scope="col"
                                        className="px-4 py-3.5 font-semibold"
                                    >
                                        Permís
                                    </th>

                                    <th
                                        scope="col"
                                        className="px-4 py-3.5 font-semibold"
                                    >
                                        Regla del rol
                                    </th>

                                    <th
                                        scope="col"
                                        className="px-4 py-3.5 text-center font-semibold"
                                    >
                                        Personalitzat
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-border">
                                {filasDisponibles.map(
                                    ({
                                        seccion,
                                        accion,
                                        sensible,
                                        activo,
                                    }) => {
                                        const id =
                                            `${tituloID}-${seccion.id}-${accion}`;

                                        const descripcion =
                                            DESCRIPCIONES[
                                                seccion.id
                                            ]?.[
                                                accion
                                            ] ??
                                            `Permet utilitzar l'acció «${nombrePermiso(
                                                accion,
                                            )}» en aquesta secció.`;

                                        return (
                                            <tr
                                                key={`${seccion.id}:${accion}`}
                                                className="
                                                    align-top
                                                    transition-colors
                                                    hover:bg-card/30
                                                "
                                            >
                                                {/* SECCIÓN */}

                                                <td className="px-4 py-4">
                                                    <p className="text-sm font-semibold text-neutral-titulos">
                                                        {
                                                            seccion.nombre
                                                        }
                                                    </p>
                                                </td>

                                                {/* PERMISO */}

                                                <td className="px-4 py-4">
                                                    <label
                                                        htmlFor={
                                                            id
                                                        }
                                                        className="block"
                                                    >
                                                        <span className="text-sm font-semibold text-neutral-titulos">
                                                            {nombrePermiso(
                                                                accion,
                                                            )}
                                                        </span>

                                                        <span className="mt-1 block max-w-xl text-xs leading-5">
                                                            {
                                                                descripcion
                                                            }
                                                        </span>
                                                    </label>
                                                </td>

                                                {/* REGLA */}

                                                <td className="px-4 py-4">
                                                    {desarrollador ? (
                                                        <span
                                                            className="
                                                                inline-flex
                                                                rounded-full
                                                                border
                                                                border-border
                                                                bg-card
                                                                px-2.5 py-1
                                                                text-xs
                                                            "
                                                        >
                                                            Sempre concedit
                                                        </span>
                                                    ) : sensible ? (
                                                        <span
                                                            className="
                                                                inline-flex
                                                                rounded-full
                                                                border
                                                                border-border
                                                                bg-background
                                                                px-2.5 py-1
                                                                text-xs
                                                            "
                                                        >
                                                            Requereix concessió
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="
                                                                inline-flex
                                                                rounded-full
                                                                border
                                                                border-border
                                                                bg-card
                                                                px-2.5 py-1
                                                                text-xs
                                                            "
                                                        >
                                                            Inclòs pel rol
                                                        </span>
                                                    )}
                                                </td>

                                                {/* CHECKBOX */}

                                                <td className="px-4 py-4">
                                                    <div className="flex justify-center">
                                                        <input
                                                            id={
                                                                id
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
                                                            aria-label={`${nombrePermiso(
                                                                accion,
                                                            )} · ${seccion.nombre}`}
                                                            className="
                                                                h-5 w-5
                                                                shrink-0
                                                                accent-primary
                                                                disabled:cursor-not-allowed
                                                                disabled:opacity-60
                                                            "
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    },
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* EXPLICACIÓN */}

            {filasDisponibles.length >
                0 &&
                !desarrollador && (
                    <div
                        className="
                            grid gap-3
                            sm:grid-cols-2
                        "
                    >
                        <div
                            className="
                                rounded-xl border
                                border-border p-4
                            "
                        >
                            <h3 className="text-sm font-semibold text-neutral-titulos">
                                Inclòs pel rol
                            </h3>

                            <p className="mt-1 text-xs leading-5">
                                El permís s'activa inicialment
                                perquè forma part de les funcions
                                habituals del rol. Pots desmarcar-lo
                                per restringir l'accés.
                            </p>
                        </div>

                        <div
                            className="
                                rounded-xl border
                                border-border p-4
                            "
                        >
                            <h3 className="text-sm font-semibold text-neutral-titulos">
                                Requereix concessió
                            </h3>

                            <p className="mt-1 text-xs leading-5">
                                És un permís sensible. Encara que el
                                rol tingui nivell suficient, comença
                                desactivat i s'ha de concedir
                                expressament.
                            </p>
                        </div>
                    </div>
                )}

            {/* DESARROLLADOR */}

            {desarrollador && (
                <div
                    className="
                        rounded-xl border
                        border-border bg-card
                        p-4
                    "
                >
                    <p className="text-sm font-semibold text-neutral-titulos">
                        Desenvolupador
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        Aquest rol disposa sempre de tots els permisos
                        generals. Els permisos no es poden desactivar
                        individualment.
                    </p>
                </div>
            )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    El rol estableix el límit màxim de seguretat.
                    Una configuració personalitzada pot retirar o
                    concedir permisos disponibles per al rol, però
                    mai pot superar aquest límit.
                </p>
            </footer>
        </section>
    );
}