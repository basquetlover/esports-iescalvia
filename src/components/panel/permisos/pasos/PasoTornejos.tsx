import { useId, useState } from "react";
import {
    NIVELES_ROL,
    NOMBRES_ROL,
    completarPermisosAmbito,
    normalizarRol,
    type AsignacionTorneo,
    type ConfiguracionTodosTorneos,
    type Rol,
} from "@const/Permisos";

export type TorneoDisponible = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    rolAdministrador: Rol | null;
};

export type RolDisponible = {
    valor: Rol;
    nombre: string;
    nivel: number;
};

export type AccesosTorneos = {
    acceso_torneos: ConfiguracionTodosTorneos;
    torneos: Record<string, AsignacionTorneo>;
};

type Props = {
    valor: AccesosTorneos;
    torneos: readonly TorneoDisponible[];
    roles: readonly RolDisponible[];
    puedeConcederTodos: boolean;
    soloLectura?: boolean;
    bloqueado?: boolean;
    onCambiar: (valor: AccesosTorneos) => void;
};

type TipoAcceso = "heredar" | "personalizado" | "denegado";

const campo =
    "w-full rounded-lg border border-border bg-card px-3.5 py-3 " +
    "text-sm text-neutral outline-none " +
    "focus:border-neutral/50 focus:ring-2 focus:ring-neutral/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

function obtenerTipo(
    asignacion: AsignacionTorneo | undefined,
): TipoAcceso {
    if (!asignacion) return "heredar";
    return asignacion.acceso ? "personalizado" : "denegado";
}

function calcularRolGeneral(valor: AccesosTorneos): Rol | null {
    const asignados: Rol[] = [];

    if (valor.acceso_torneos.todos && valor.acceso_torneos.rol) {
        asignados.push(valor.acceso_torneos.rol);
    }

    for (const asignacion of Object.values(valor.torneos)) {
        if (asignacion.acceso && asignacion.rol) {
            asignados.push(asignacion.rol);
        }
    }

    return asignados.reduce<Rol | null>(
        (menor, rol) =>
            menor === null || NIVELES_ROL[rol] < NIVELES_ROL[menor]
                ? rol
                : menor,
        null,
    );
}

function SelectorRol({
    etiqueta,
    valor,
    opciones,
    desactivado,
    onCambiar,
}: {
    etiqueta: string;
    valor: Rol | null;
    opciones: readonly RolDisponible[];
    desactivado: boolean;
    onCambiar: (rol: Rol) => void;
}) {
    const actualDisponible = opciones.some(
        (opcion) => opcion.valor === valor,
    );

    return (
        <label className="block">
            <span className="mb-2 block text-xs font-semibold">
                {etiqueta}
            </span>

            <select
                value={valor ?? ""}
                disabled={desactivado || opciones.length === 0}
                className={campo}
                onChange={(evento) => {
                    const nuevo = normalizarRol(evento.target.value);

                    if (
                        nuevo &&
                        opciones.some((opcion) => opcion.valor === nuevo)
                    ) {
                        onCambiar(nuevo);
                    }
                }}
            >
                <option value="" disabled>
                    Selecciona un rol
                </option>

                {valor && !actualDisponible && (
                    <option value={valor} disabled>
                        {NOMBRES_ROL[valor]} · Rol actual
                    </option>
                )}

                {opciones.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                        {opcion.nombre}
                    </option>
                ))}
            </select>
        </label>
    );
}

export default function PasoTornejos({
    valor,
    torneos,
    roles,
    puedeConcederTodos,
    soloLectura = false,
    bloqueado = false,
    onCambiar,
}: Props) {
    const tituloID = useId();
    const busquedaID = useId();

    const [busqueda, setBusqueda] = useState("");
    const [soloConfigurados, setSoloConfigurados] = useState(false);

    const desactivado = soloLectura || bloqueado;
    const todos = valor.acceso_torneos.todos;
    const rolGeneral = calcularRolGeneral(valor);

    const rolesOrdenados = [...roles].sort(
        (a, b) => a.nivel - b.nivel,
    );

    // Las claves del documento deben estar normalizadas a minúsculas
    // al cargarse en el asistente.
    const torneosPorID = new Map(
        torneos.map((torneo) => [
            torneo.id.toLowerCase(),
            torneo,
        ]),
    );

    const ids = [
        ...new Set([
            ...torneosPorID.keys(),
            ...Object.keys(valor.torneos),
        ]),
    ];

    const consulta = busqueda.trim().toLocaleLowerCase("ca-ES");

    const visibles = ids
        .filter((id) => {
            const torneo = torneosPorID.get(id);

            const texto = [
                torneo?.nombre,
                torneo?.deporte,
                id,
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("ca-ES");

            return (
                (!consulta || texto.includes(consulta)) &&
                (
                    !soloConfigurados ||
                    Object.hasOwn(valor.torneos, id)
                )
            );
        })
        .sort((a, b) => {
            const nombreA = torneosPorID.get(a)?.nombre || a;
            const nombreB = torneosPorID.get(b)?.nombre || b;

            return nombreA.localeCompare(nombreB, "ca");
        });

    const personalizados = Object.values(valor.torneos).filter(
        (asignacion) => asignacion.acceso,
    ).length;

    const excluidos = Object.values(valor.torneos).filter(
        (asignacion) => !asignacion.acceso,
    ).length;

    function rolesParaTorneo(id: string) {
        const rolAdministrador =
            torneosPorID.get(id)?.rolAdministrador;

        if (!rolAdministrador) return [];

        return rolesOrdenados.filter(
            (opcion) =>
                opcion.nivel <= NIVELES_ROL[rolAdministrador],
        );
    }

    function cambiarModalidad(nuevosTodos: boolean) {
        if (desactivado || nuevosTodos === todos) return;

        if (nuevosTodos && !puedeConcederTodos) return;

        const rol = nuevosTodos
            ? valor.acceso_torneos.rol ??
              rolesOrdenados[0]?.valor ??
              null
            : null;

        onCambiar({
            ...valor,
            acceso_torneos: {
                todos: nuevosTodos,
                rol,
                permisos: completarPermisosAmbito("torneo", rol),
            },
        });
    }

    function cambiarRolComun(rol: Rol) {
        if (desactivado || !todos || !puedeConcederTodos) return;

        if (!rolesOrdenados.some((opcion) => opcion.valor === rol)) {
            return;
        }

        onCambiar({
            ...valor,
            acceso_torneos: {
                ...valor.acceso_torneos,
                rol,
                permisos: completarPermisosAmbito(
                    "torneo",
                    rol,
                    valor.acceso_torneos.rol
                        ? valor.acceso_torneos.permisos
                        : undefined,
                ),
            },
        });
    }

    function cambiarAcceso(id: string, tipo: TipoAcceso) {
        if (desactivado) return;

        const nuevasAsignaciones = { ...valor.torneos };

        if (tipo === "heredar") {
            delete nuevasAsignaciones[id];
        } else if (tipo === "denegado") {
            nuevasAsignaciones[id] = {
                acceso: false,
                rol: null,
                permisos: completarPermisosAmbito("torneo", null),
            };
        } else {
            const opciones = rolesParaTorneo(id);
            if (opciones.length === 0) return;

            const anterior = nuevasAsignaciones[id];

            const candidato =
                anterior?.rol ??
                (
                    todos
                        ? valor.acceso_torneos.rol
                        : null
                );

            const rol =
                opciones.find((opcion) => opcion.valor === candidato)
                    ?.valor ??
                opciones[0].valor;

            nuevasAsignaciones[id] = {
                acceso: true,
                rol,
                permisos: completarPermisosAmbito(
                    "torneo",
                    rol,
                    anterior?.acceso
                        ? anterior.permisos
                        : todos
                          ? valor.acceso_torneos.permisos
                          : undefined,
                ),
            };
        }

        onCambiar({
            ...valor,
            torneos: nuevasAsignaciones,
        });
    }

    function cambiarRolIndividual(id: string, rol: Rol) {
        if (desactivado) return;

        const asignacion = valor.torneos[id];
        const opciones = rolesParaTorneo(id);

        if (
            !asignacion?.acceso ||
            !opciones.some((opcion) => opcion.valor === rol)
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
                    permisos: completarPermisosAmbito(
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

    return (
        <section
            aria-labelledby={tituloID}
            className="space-y-7 text-neutral"
        >
            <header className="border-b border-border pb-5">
                <p className="mb-3 text-xs font-medium tracking-wide">
                    ACCESSOS I ROLS
                </p>

                <h2
                    id={tituloID}
                    className="text-xl font-semibold tracking-tight"
                >
                    A quins tornejos tindrà accés?
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6">
                    Defineix l'abast de l'accés i el rol de cada
                    assignació. Després configuraràs els permisos
                    de cada secció.
                </p>
            </header>

            <fieldset disabled={desactivado} className="space-y-3">
                <legend className="mb-3 text-xs font-semibold">
                    Modalitat d'accés
                </legend>

                <div className="grid gap-3 sm:grid-cols-2">
                    {[
                        {
                            activo: !todos,
                            todos: false,
                            titulo: "Tornejos seleccionats",
                            descripcion:
                                "Només podrà accedir als tornejos que assignis individualment.",
                            disponible: true,
                        },
                        {
                            activo: todos,
                            todos: true,
                            titulo: "Tots els tornejos",
                            descripcion:
                                "Inclou els tornejos actuals i els que es creïn en el futur.",
                            disponible: puedeConcederTodos || todos,
                        },
                    ].map((opcion) => (
                        <label
                            key={opcion.titulo}
                            className={`
                                flex items-start gap-3 rounded-xl
                                border p-4 transition-colors
                                ${
                                    opcion.activo
                                        ? "border-primary/60 bg-card"
                                        : "border-border bg-background"
                                }
                                ${
                                    desactivado || !opcion.disponible
                                        ? "cursor-default"
                                        : "cursor-pointer hover:border-neutral/40"
                                }
                            `}
                        >
                            <input
                                type="radio"
                                name={`${tituloID}-modalitat`}
                                checked={opcion.activo}
                                disabled={!opcion.disponible}
                                onChange={() =>
                                    cambiarModalidad(opcion.todos)
                                }
                                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                            />

                            <span>
                                <span className="block text-sm font-semibold">
                                    {opcion.titulo}
                                </span>

                                <span className="mt-1 block text-xs leading-5">
                                    {opcion.descripcion}
                                </span>
                            </span>
                        </label>
                    ))}
                </div>

                {!soloLectura && !puedeConcederTodos && (
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
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 8v5" />
                            <path d="M12 16h.01" />
                        </svg>

                        <div>
                            <p className="text-sm font-semibold">
                                Accés no disponible
                            </p>

                            <p className="mt-1 text-sm leading-6">
                                El teu compte no pot concedir accés comú
                                a tots els tornejos.
                            </p>
                        </div>
                    </div>
                )}
            </fieldset>

            {todos && (
                <div className="space-y-4 rounded-xl border border-border p-5">
                    <div>
                        <h3 className="text-sm font-semibold">
                            Configuració comuna
                        </h3>

                        <p className="mt-1 text-xs leading-5">
                            S'aplicarà als tornejos sense una excepció
                            individual.
                        </p>
                    </div>

                    <div className="max-w-md">
                        <SelectorRol
                            etiqueta="Rol comú dels tornejos"
                            valor={valor.acceso_torneos.rol}
                            opciones={rolesOrdenados}
                            desactivado={
                                desactivado || !puedeConcederTodos
                            }
                            onCambiar={cambiarRolComun}
                        />
                    </div>

                    <p className="text-xs leading-5">
                        Els permisos comuns es configuraran als passos
                        següents. Un torneig amb configuració pròpia
                        utilitzarà el seu rol i els seus permisos.
                    </p>
                </div>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
                {[
                    {
                        etiqueta: "Rol general resultant",
                        contenido: rolGeneral
                            ? NOMBRES_ROL[rolGeneral]
                            : "Pendent d'assignació",
                    },
                    {
                        etiqueta: "Configuracions individuals",
                        contenido: String(personalizados),
                    },
                    {
                        etiqueta: "Accessos denegats",
                        contenido: String(excluidos),
                    },
                ].map((dato) => (
                    <div
                        key={dato.etiqueta}
                        className="rounded-xl border border-border bg-card p-4"
                    >
                        <p className="text-xs">{dato.etiqueta}</p>
                        <p className="mt-2 text-sm font-semibold">
                            {dato.contenido}
                        </p>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold">
                        {todos
                            ? "Excepcions per torneig"
                            : "Assignació de tornejos"}
                    </h3>

                    <p className="mt-1 text-sm leading-6">
                        {todos
                            ? "Mantén la configuració comuna, assigna una configuració pròpia o denega l'accés."
                            : "Selecciona els tornejos als quals podrà accedir i assigna un rol a cadascun."}
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                        <label
                            htmlFor={busquedaID}
                            className="mb-2 block text-xs font-semibold"
                        >
                            Cercar torneig
                        </label>

                        <input
                            id={busquedaID}
                            type="search"
                            value={busqueda}
                            onChange={(evento) =>
                                setBusqueda(evento.target.value)
                            }
                            placeholder="Nom o esport"
                            className={campo}
                        />
                    </div>

                    <label className="flex min-h-11 items-center gap-2 text-xs">
                        <input
                            type="checkbox"
                            checked={soloConfigurados}
                            onChange={(evento) =>
                                setSoloConfigurados(evento.target.checked)
                            }
                            className="h-4 w-4 accent-primary"
                        />
                        Només configuracions individuals
                    </label>
                </div>

                {visibles.length === 0 && (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center">
                        <p className="text-sm font-semibold">
                            {ids.length === 0
                                ? "No hi ha tornejos disponibles"
                                : "No s'han trobat coincidències"}
                        </p>

                        <p className="mt-2 text-xs leading-5">
                            {ids.length === 0
                                ? "Aquí apareixeran els tornejos que puguis gestionar."
                                : "Prova de canviar la cerca o el filtre."}
                        </p>
                    </div>
                )}

                <div className="space-y-3">
                    {visibles.map((id) => {
                        const torneo = torneosPorID.get(id);
                        const asignacion = valor.torneos[id];
                        const tipo = obtenerTipo(asignacion);
                        const opciones = rolesParaTorneo(id);

                        const nombre =
                            torneo?.nombre || "Torneig no disponible";

                        const rolEfectivo =
                            tipo === "personalizado"
                                ? asignacion?.rol
                                : tipo === "heredar" && todos
                                  ? valor.acceso_torneos.rol
                                  : null;

                        const estado =
                            tipo === "personalizado"
                                ? "Configuració pròpia"
                                : tipo === "denegado"
                                  ? "Accés denegat"
                                  : todos
                                    ? "Configuració comuna"
                                    : "Sense accés";

                        return (
                            <article
                                key={id}
                                className={`
                                    overflow-hidden rounded-xl border
                                    ${
                                        tipo === "personalizado"
                                            ? "border-neutral/35"
                                            : "border-border"
                                    }
                                `}
                            >
                                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                                    <div className="min-w-0">
                                        <h4 className="wrap-break-words text-sm font-semibold">
                                            {nombre}
                                        </h4>

                                        {torneo?.deporte && (
                                            <p className="mt-1 text-xs">
                                                {torneo.deporte}
                                            </p>
                                        )}

                                        {!torneo && (
                                            <p className="mt-1 break-all text-xs">
                                                {id}
                                            </p>
                                        )}
                                    </div>

                                    <span className="self-start rounded-full border border-border bg-card px-2.5 py-1 text-xs">
                                        {estado}
                                    </span>
                                </div>

                                <div className="grid gap-4 border-t border-border bg-background p-4 sm:grid-cols-2 sm:p-5">
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-semibold">
                                            Accés al torneig
                                        </span>

                                        <select
                                            value={tipo}
                                            disabled={desactivado}
                                            className={campo}
                                            onChange={(evento) => {
                                                const nuevo =
                                                    evento.target.value;

                                                if (
                                                    nuevo === "heredar" ||
                                                    nuevo === "personalizado" ||
                                                    nuevo === "denegado"
                                                ) {
                                                    cambiarAcceso(id, nuevo);
                                                }
                                            }}
                                        >
                                            <option value="heredar">
                                                {todos
                                                    ? "Utilitzar la configuració comuna"
                                                    : "Sense assignació"}
                                            </option>

                                            <option
                                                value="personalizado"
                                                disabled={opciones.length === 0}
                                            >
                                                Assignar configuració pròpia
                                            </option>

                                            <option value="denegado">
                                                Denegar l'accés
                                            </option>
                                        </select>
                                    </label>

                                    {tipo === "personalizado" ? (
                                        <SelectorRol
                                            etiqueta="Rol en aquest torneig"
                                            valor={asignacion?.rol ?? null}
                                            opciones={opciones}
                                            desactivado={desactivado}
                                            onCambiar={(rol) =>
                                                cambiarRolIndividual(id, rol)
                                            }
                                        />
                                    ) : (
                                        <div>
                                            <p className="mb-2 text-xs font-semibold">
                                                Rol aplicable
                                            </p>

                                            <p className="rounded-lg border border-border bg-card px-3.5 py-3 text-sm">
                                                {rolEfectivo
                                                    ? NOMBRES_ROL[rolEfectivo]
                                                    : "Sense rol"}
                                            </p>
                                        </div>
                                    )}

                                    {!torneo && (
                                        <p className="text-xs leading-5 sm:col-span-2">
                                            Aquesta assignació ja existeix,
                                            però el torneig no apareix entre
                                            els disponibles per al teu compte.
                                            No se n'eliminarà la configuració
                                            automàticament.
                                        </p>
                                    )}

                                    {torneo &&
                                        opciones.length === 0 &&
                                        !soloLectura && (
                                            <p className="text-xs leading-5 sm:col-span-2">
                                                No tens cap rol disponible
                                                per assignar en aquest torneig.
                                            </p>
                                        )}

                                    {tipo === "personalizado" && (
                                        <p className="text-xs leading-5 sm:col-span-2">
                                            Els permisos d'aquest torneig
                                            tindran els seus propis passos
                                            dins de l'assistent.
                                        </p>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    El rol general es calcula amb el rol més baix
                    de les assignacions amb accés. Si està activat
                    l'accés a tots els tornejos, també es té en compte
                    el rol comú. Les exclusions no participen en aquest càlcul.
                </p>
            </div>
        </section>
    );
}