import { useId } from "react";
import {
    NIVELES_ROL,
    NOMBRES_ROL,
    NOMBRES_ACCIONES,
    ROLES_ORDENADOS,
    obtenerNivelRequerido,
    type AccionesPermisos,
    type Rol,
    type SeccionPermisos,
} from "@const/Permisos";

type Props = {
    seccion: SeccionPermisos;
    rolGeneral: Rol | null;
    valor: AccionesPermisos;
    accesoPanel: boolean;
    soloLectura?: boolean;
    bloqueado?: boolean;
    onCambiar: (valor: AccionesPermisos) => void;
};

const DESCRIPCIONES_SECCIONES: Record<string, string> = {
    panell:
        "Define si l'usuari pot entrar al panell d'administració.",
    tornejos:
        "Configura la consulta dels tornejos i la creació de nous tornejos.",
    usuaris:
        "Defineix les accions disponibles sobre els comptes dels usuaris.",
    permisos:
        "Configura les accions de gestió dels accessos al panell.",
    configuracio:
        "Defineix l'accés a la configuració general de la plataforma.",
};

const DESCRIPCIONES_ACCIONES: Record<string, Record<string, string>> = {
    panell: {
        ver:
            "Permet entrar al panell d'administració. És necessari per mantenir aquest accés.",
    },
    tornejos: {
        ver:
            "Permet consultar la secció general de tornejos. L'accés a cada torneig depèn de les seves assignacions.",
        crear:
            "Permet crear nous tornejos a la plataforma.",
    },
    usuaris: {
        ver:
            "Permet consultar el llistat d'usuaris i les seves fitxes.",
        bloquear:
            "Permet bloquejar un compte i impedir que continuï utilitzant la seva sessió.",
        desbloquear:
            "Permet tornar a activar un compte bloquejat.",
    },
    permisos: {
        ver:
            "Permet consultar els usuaris amb accés al panell i els seus permisos.",
        crear:
            "Permet concedir accés al panell a usuaris registrats.",
        editar:
            "Permet modificar les assignacions i els permisos que pugui gestionar.",
        eliminar:
            "Permet retirar l'accés administratiu sense eliminar el compte de l'usuari.",
    },
    configuracio: {
        ver:
            "Permet consultar la configuració general de la plataforma.",
        editar:
            "Permet modificar els paràmetres de configuració disponibles.",
    },
};

export default function PasoGeneral({
    seccion,
    rolGeneral,
    valor,
    accesoPanel,
    soloLectura = false,
    bloqueado = false,
    onCambiar,
}: Props) {
    const baseID = useId();
    const tituloID = `${baseID}-titulo`;

    const nivelUsuario = rolGeneral
        ? NIVELES_ROL[rolGeneral]
        : -1;

    const desactivado = soloLectura || bloqueado;
    const esAccesoPanel = seccion.id === "panell";

    const activados = seccion.acciones.filter(
        (accion) =>
            valor[accion] === true &&
            nivelUsuario >= obtenerNivelRequerido(seccion.id, accion),
    ).length;

    function cambiarAccion(accion: string) {
        if (desactivado || !seccion.acciones.includes(accion)) {
            return;
        }

        const actual = valor[accion] === true;
        const nivelRequerido = obtenerNivelRequerido(
            seccion.id,
            accion,
        );

        // Un valor antiguo incompatible puede desactivarse,
        // pero no volver a activarse sin el nivel necesario.
        if (!actual && nivelUsuario < nivelRequerido) {
            return;
        }

        onCambiar({
            ...valor,
            [accion]: !actual,
        });
    }

    return (
        <section
            aria-labelledby={tituloID}
            className="space-y-7 text-neutral"
        >
            <header className="border-b border-border pb-5">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="
                            flex h-8 w-8 items-center justify-center
                            rounded-lg border border-border bg-card
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
                            <rect x="3" y="3" width="7" height="7" rx="1.5" />
                            <rect x="14" y="3" width="7" height="7" rx="1.5" />
                            <rect x="3" y="14" width="7" height="7" rx="1.5" />
                            <rect x="14" y="14" width="7" height="7" rx="1.5" />
                        </svg>
                    </span>

                    <span className="text-xs font-medium tracking-wide">
                        PERMISOS GENERALS
                    </span>
                </div>

                <h2
                    id={tituloID}
                    className="text-xl font-semibold tracking-tight"
                >
                    {seccion.nombre}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6">
                    {DESCRIPCIONES_SECCIONES[seccion.id] ||
                        "Configura les accions disponibles en aquesta secció general."}
                </p>
            </header>

            <div
                className="
                    flex flex-col gap-4 rounded-xl
                    border border-border bg-card p-4
                    sm:flex-row sm:items-center sm:justify-between
                "
            >
                <div>
                    <p className="text-xs">Rol general aplicable</p>

                    <p className="mt-1 text-sm font-semibold">
                        {rolGeneral
                            ? NOMBRES_ROL[rolGeneral]
                            : "Pendent d'assignació"}
                    </p>
                </div>

                <span
                    className="
                        self-start rounded-full border
                        border-border bg-background px-3 py-1.5
                        text-xs sm:self-center
                    "
                >
                    {activados} de {seccion.acciones.length} accions
                    habilitades pel rol
                </span>
            </div>

            {!rolGeneral && (
                <div
                    role="status"
                    className="rounded-xl border border-border p-4"
                >
                    <p className="text-sm font-semibold">
                        Primer cal assignar un rol
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        Torna al pas de tornejos i rols. El rol general
                        es calcularà a partir de les assignacions amb accés.
                    </p>
                </div>
            )}

            {!esAccesoPanel && !accesoPanel && (
                <div
                    role="status"
                    className="rounded-xl border border-border p-4"
                >
                    <p className="text-sm font-semibold">
                        L'accés general al panell està desactivat
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        Pots preparar aquesta configuració, però les
                        accions no seran accessibles fins que activis
                        l'entrada al panell.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {seccion.acciones.map((accion) => {
                    const accionID = `${baseID}-${accion}`;
                    const tituloAccionID = `${accionID}-titulo`;
                    const descripcionID = `${accionID}-descripcion`;
                    const motivoID = `${accionID}-motivo`;

                    const activo = valor[accion] === true;

                    const nivelRequerido = obtenerNivelRequerido(
                        seccion.id,
                        accion,
                    );

                    const nivelSuficiente =
                        nivelUsuario >= nivelRequerido;

                    const rolMinimo = ROLES_ORDENADOS.find(
                        (rol) => NIVELES_ROL[rol] >= nivelRequerido,
                    );

                    const noSePuedeActivar =
                        !nivelSuficiente && !activo;

                    const interruptorDesactivado =
                        desactivado || noSePuedeActivar;

                    const titulo =
                        NOMBRES_ACCIONES[accion] || accion;

                    const descripcion =
                        DESCRIPCIONES_ACCIONES[seccion.id]?.[accion] ||
                        `Permet utilitzar l'acció «${titulo}» en aquesta secció.`;

                    const motivo = !nivelSuficiente
                        ? !rolGeneral
                            ? "Cal assignar un rol per habilitar aquesta acció."
                            : rolMinimo
                              ? `Aquesta acció requereix com a mínim el rol ${NOMBRES_ROL[rolMinimo]}.`
                              : "Aquesta acció no està disponible amb els rols actuals."
                        : null;

                    return (
                        <div
                            key={accion}
                            className={`
                                rounded-xl border p-4
                                transition-colors sm:p-5
                                ${
                                    activo && nivelSuficiente
                                        ? "border-neutral/35 bg-card/50"
                                        : "border-border bg-background"
                                }
                            `}
                        >
                            <div className="flex items-start justify-between gap-5">
                                <div className="min-w-0">
                                    <h3
                                        id={tituloAccionID}
                                        className="text-sm font-semibold"
                                    >
                                        {titulo}
                                    </h3>

                                    <p
                                        id={descripcionID}
                                        className="mt-1 max-w-xl text-xs leading-5"
                                    >
                                        {descripcion}
                                    </p>
                                </div>

                                <div className="flex shrink-0 flex-col items-center gap-2">
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={activo}
                                        aria-labelledby={tituloAccionID}
                                        aria-describedby={[
                                            descripcionID,
                                            motivo ? motivoID : null,
                                        ]
                                            .filter(Boolean)
                                            .join(" ")}
                                        disabled={interruptorDesactivado}
                                        onClick={() => cambiarAccion(accion)}
                                        className={`
                                            relative inline-flex h-7 w-12
                                            shrink-0 items-center rounded-full
                                            border text-neutral
                                            transition-colors
                                            focus-visible:outline-none
                                            focus-visible:ring-2
                                            focus-visible:ring-neutral/40
                                            focus-visible:ring-offset-2
                                            focus-visible:ring-offset-background
                                            disabled:cursor-not-allowed
                                            disabled:opacity-50
                                            motion-reduce:transition-none
                                            ${
                                                activo
                                                    ? "border-primary bg-primary"
                                                    : "border-border bg-neutral/15"
                                            }
                                        `}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`
                                                block h-5 w-5 rounded-full
                                                bg-white shadow-sm
                                                transition-transform
                                                motion-reduce:transition-none
                                                ${
                                                    activo
                                                        ? "translate-x-6"
                                                        : "translate-x-0.5"
                                                }
                                            `}
                                        />
                                    </button>

                                    <span
                                        aria-hidden="true"
                                        className="text-[11px] font-medium"
                                    >
                                        {activo ? "Activat" : "Desactivat"}
                                    </span>
                                </div>
                            </div>

                            {motivo && (
                                <div
                                    id={motivoID}
                                    className="
                                        mt-4 flex items-start gap-2
                                        border-t border-border pt-3
                                        text-xs leading-5
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
                                        className="mt-0.5 h-4 w-4 shrink-0"
                                        aria-hidden="true"
                                    >
                                        <rect
                                            x="5"
                                            y="10"
                                            width="14"
                                            height="11"
                                            rx="2"
                                        />
                                        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                    </svg>

                                    <p>
                                        {motivo}
                                        {activo && (
                                            <>
                                                {" "}El valor guardat està
                                                activat, però no és efectiu
                                                amb aquest rol.
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {esAccesoPanel && !accesoPanel && (
                <p className="rounded-xl border border-border bg-card p-4 text-sm leading-6">
                    Per desar una assignació d'accés al panell,
                    l'entrada ha d'estar activada. Si vols retirar
                    l'accés complet, utilitza «Retirar» al llistat
                    d'usuaris amb permisos.
                </p>
            )}

            {seccion.id === "permisos" && (
                <p className="text-xs leading-6">
                    Les accions de gestió també estan subjectes
                    als límits d'assignació de rols i permisos
                    comprovats pel servidor.
                </p>
            )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    Els permisos generals s'apliquen al conjunt
                    de la plataforma. Els permisos de cada torneig
                    es configuren als seus passos corresponents.
                </p>
            </footer>
        </section>
    );
}