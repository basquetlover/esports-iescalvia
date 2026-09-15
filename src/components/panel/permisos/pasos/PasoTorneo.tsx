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
} from "../../../../const/Permisos";

export type ContextoPasoTorneo =
    | {
          tipo: "comun";
      }
    | {
          tipo: "individual";
          torneoID: string;
          nombre: string | null;
          deporte: string | null;
      };

type Props = {
    contexto: ContextoPasoTorneo;
    seccion: SeccionPermisos;
    rol: Rol | null;
    valor: AccionesPermisos;
    accesoPanelGeneral: boolean;
    accesoPanelTorneo: boolean;
    soloLectura?: boolean;
    bloqueado?: boolean;
    onCambiar: (valor: AccionesPermisos) => void;
};

const DESCRIPCIONES_SECCIONES: Record<string, string> = {
    panell:
        "Configura l'entrada al panell del torneig.",
    tornejos:
        "Defineix les accions disponibles sobre la informació del torneig.",
    edicions:
        "Configura la consulta i la gestió de les edicions.",
    permisos:
        "Defineix les accions de gestió de l'organització i els permisos.",
    voluntaris:
        "Configura les accions disponibles a la secció de voluntaris.",
    equips:
        "Defineix les accions sobre els equips, els participants i els seus estats.",
    competicio:
        "Configura l'accés al format de competició.",
    partits:
        "Defineix les accions sobre el calendari, els partits i els resultats.",
    classificacions:
        "Configura la consulta de les classificacions.",
    "configuracio-edicio":
        "Defineix les accions sobre la configuració de les edicions.",
};

const DESCRIPCIONES_ACCIONES: Record<string, Record<string, string>> = {
    panell: {
        ver:
            "Permet entrar al panell del torneig. És necessari per utilitzar les altres seccions d'aquest àmbit.",
    },
    tornejos: {
        ver:
            "Permet consultar la informació del torneig.",
        editar:
            "Permet modificar la informació del torneig.",
        eliminar:
            "Permet sol·licitar l'eliminació del torneig, subjecta a les comprovacions del servidor.",
    },
    edicions: {
        ver:
            "Permet consultar les edicions del torneig.",
        crear:
            "Permet crear noves edicions dins del torneig.",
        editar:
            "Permet modificar les dades de les edicions.",
        eliminar:
            "Permet eliminar edicions quan l'operació estigui disponible.",
    },
    permisos: {
        ver:
            "Permet consultar l'organització i els permisos del torneig.",
        asignar:
            "Permet assignar accessos dins dels límits del compte que els concedeix.",
        editar:
            "Permet modificar les assignacions que l'usuari pugui gestionar.",
        revocar:
            "Permet retirar assignacions d'accés al torneig.",
    },
    voluntaris: {
        ver:
            "Permet consultar la secció de voluntaris.",
        crear:
            "Permet utilitzar les operacions d'alta disponibles en aquesta secció.",
        editar:
            "Permet modificar la informació gestionable dels voluntaris.",
        eliminar:
            "Permet utilitzar les operacions de retirada o eliminació disponibles.",
    },
    equips: {
        ver:
            "Permet consultar els equips, els participants i els seus estats.",
        crear:
            "Permet crear equips quan aquesta operació estigui disponible.",
        editar:
            "Permet modificar les dades gestionables dels equips i participants.",
        evaluar:
            "Permet avaluar els equips segons el procés establert.",
        "canviar-estat":
            "Permet canviar l'estat dels equips.",
        eliminar:
            "Permet eliminar equips quan aquesta operació estigui disponible.",
    },
    competicio: {
        ver:
            "Permet consultar el format i l'estructura de la competició.",
        editar:
            "Permet modificar les opcions disponibles del format de competició.",
    },
    partits: {
        ver:
            "Permet consultar el calendari, els partits i els resultats.",
        crear:
            "Permet crear partits.",
        editar:
            "Permet modificar les dades i els resultats dels partits.",
        eliminar:
            "Permet eliminar partits quan les regles de la competició ho permetin.",
    },
    classificacions: {
        ver:
            "Permet consultar les classificacions.",
    },
    "configuracio-edicio": {
        ver:
            "Permet consultar la configuració de l'edició seleccionada.",
        editar:
            "Permet modificar els paràmetres disponibles de l'edició.",
    },
};

export default function PasoTorneo({
    contexto,
    seccion,
    rol,
    valor,
    accesoPanelGeneral,
    accesoPanelTorneo,
    soloLectura = false,
    bloqueado = false,
    onCambiar,
}: Props) {
    const baseID = useId();
    const tituloID = `${baseID}-titulo`;

    const comun = contexto.tipo === "comun";
    const esAccesoPanel = seccion.id === "panell";
    const desactivado = soloLectura || bloqueado;

    const nivelUsuario = rol ? NIVELES_ROL[rol] : -1;

    const nombreAmbito = comun
        ? "Tots els tornejos"
        : contexto.nombre?.trim() || "Torneig sense nom";

    const habilitadosPorRol = seccion.acciones.filter(
        (accion) =>
            valor[accion] === true &&
            nivelUsuario >= obtenerNivelRequerido(seccion.id, accion),
    ).length;

    const entradaBloqueada =
        !accesoPanelGeneral ||
        (!esAccesoPanel && !accesoPanelTorneo);

    function cambiarAccion(accion: string) {
        if (desactivado || !seccion.acciones.includes(accion)) {
            return;
        }

        const actual = valor[accion] === true;

        const nivelRequerido = obtenerNivelRequerido(
            seccion.id,
            accion,
        );

        // Un permiso antiguo incompatible puede desactivarse.
        // Activarlo requiere cumplir el nivel mínimo.
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
                            <path d="M8 3h8v5a4 4 0 0 1-8 0V3Z" />
                            <path d="M8 5H4v2a4 4 0 0 0 4 4" />
                            <path d="M16 5h4v2a4 4 0 0 1-4 4" />
                            <path d="M12 12v5" />
                            <path d="M8 21v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M6 21h12" />
                        </svg>
                    </span>

                    <span className="text-xs font-medium tracking-wide">
                        {comun
                            ? "PERMISOS COMUNS DELS TORNEJOS"
                            : "PERMISOS DEL TORNEIG"}
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
                        "Configura les accions disponibles en aquesta secció del torneig."}
                </p>
            </header>

            <div className="overflow-hidden rounded-xl border border-border">
                <div
                    className="
                        flex flex-col gap-4 bg-card p-4
                        sm:flex-row sm:items-start sm:justify-between
                    "
                >
                    <div className="min-w-0">
                        <p className="text-xs">Àmbit de la configuració</p>

                        <h3 className="mt-1 wrap-break-words text-sm font-semibold">
                            {nombreAmbito}
                        </h3>

                        {contexto.tipo === "individual" &&
                            contexto.deporte && (
                                <p className="mt-1 text-xs">
                                    {contexto.deporte}
                                </p>
                            )}
                    </div>

                    <span
                        className="
                            self-start rounded-full border border-border
                            bg-background px-3 py-1.5 text-xs
                        "
                    >
                        {comun ? "Configuració comuna" : "Configuració pròpia"}
                    </span>
                </div>

                <div
                    className="
                        flex flex-col gap-3 border-t border-border
                        p-4 sm:flex-row sm:items-center
                        sm:justify-between
                    "
                >
                    <p className="text-xs">
                        Rol aplicable:{" "}
                        <strong className="font-semibold">
                            {rol
                                ? NOMBRES_ROL[rol]
                                : "Pendent d'assignació"}
                        </strong>
                    </p>

                    <p className="text-xs">
                        {habilitadosPorRol} de {seccion.acciones.length}{" "}
                        accions habilitades pel rol
                    </p>
                </div>
            </div>

            {comun ? (
                <p className="text-sm leading-6">
                    Aquests permisos s'apliquen als tornejos actuals
                    i futurs que utilitzin la configuració comuna.
                    Les assignacions individuals tenen prioritat.
                </p>
            ) : (
                <p className="text-sm leading-6">
                    Aquests permisos s'apliquen només a aquest torneig.
                    Els canvis en la configuració comuna no modificaran
                    aquesta assignació individual.
                </p>
            )}

            {!rol && (
                <div
                    role="status"
                    className="rounded-xl border border-border bg-card p-4"
                >
                    <p className="text-sm font-semibold">
                        Falta assignar el rol
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        Torna al pas de tornejos i rols per seleccionar
                        el rol aplicable a aquesta configuració.
                    </p>
                </div>
            )}

            {entradaBloqueada && (
                <div
                    role="status"
                    className="rounded-xl border border-border p-4"
                >
                    <p className="text-sm font-semibold">
                        {!accesoPanelGeneral
                            ? "L'accés general al panell està desactivat"
                            : "L'entrada al panell del torneig està desactivada"}
                    </p>

                    <p className="mt-1 text-sm leading-6">
                        Pots preparar els permisos d'aquesta secció,
                        però no seran accessibles fins que activis
                        l'entrada corresponent.
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
                        (item) => NIVELES_ROL[item] >= nivelRequerido,
                    );

                    const noSePuedeActivar =
                        !nivelSuficiente && !activo;

                    const titulo =
                        NOMBRES_ACCIONES[accion] || accion;

                    const descripcion =
                        DESCRIPCIONES_ACCIONES[seccion.id]?.[accion] ||
                        `Permet utilitzar l'acció «${titulo}» en aquesta secció.`;

                    const motivo = !nivelSuficiente
                        ? !rol
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
                                        disabled={
                                            desactivado || noSePuedeActivar
                                        }
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

            {esAccesoPanel && !accesoPanelTorneo && (
                <p className="rounded-xl border border-border bg-card p-4 text-sm leading-6">
                    Amb l'entrada desactivada, l'usuari no podrà
                    utilitzar el panell en aquest àmbit, encara que
                    tingui altres accions activades.
                </p>
            )}

            {seccion.id === "permisos" && (
                <p className="text-xs leading-6">
                    El servidor comprova també quins rols, accessos
                    i permisos pot assignar l'usuari que fa l'operació.
                </p>
            )}

            {seccion.id === "edicions" && rol === "voluntario" && (
                <p className="text-xs leading-6">
                    La limitació dels voluntaris a les edicions amb
                    formulari acceptat s'incorporarà quan estigui
                    disponible la gestió de formularis.
                </p>
            )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    Cada acció es guardarà com a activada o desactivada.
                    Un permís desactivat no es concedeix pel fet de
                    tenir un rol de nivell superior.
                </p>
            </footer>
        </section>
    );
}