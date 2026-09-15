import { useId } from "react";
import {
    NOMBRES_ROL,
    calcularRolMinimo,
    type DocumentoPermisos,
    type Rol,
} from "@const/Permisos";

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
    usuario: UsuarioResumen;
    documento: DocumentoPermisos;
    torneos: readonly TorneoResumen[];
    advertencias?: readonly string[];
    revisionAceptada?: boolean;
    soloLectura?: boolean;
    bloqueado?: boolean;
    onCambiarRevision?: (aceptada: boolean) => void;
};

function obtenerNombreUsuario(usuario: UsuarioResumen) {
    return [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Usuari sense nom";
}

function obtenerRolGeneral(
    documento: DocumentoPermisos,
): Rol | null {
    try {
        return calcularRolMinimo(documento);
    } catch {
        return null;
    }
}

function contarAcciones(
    permisos: Record<string, Record<string, boolean>>,
) {
    let activadas = 0;
    let total = 0;

    for (const acciones of Object.values(permisos)) {
        for (const valor of Object.values(acciones)) {
            total += 1;

            if (valor === true) {
                activadas += 1;
            }
        }
    }

    return {
        activadas,
        total,
    };
}

export default function PasoResumen({
    usuario,
    documento,
    torneos,
    advertencias = [],
    revisionAceptada = false,
    soloLectura = false,
    bloqueado = false,
    onCambiarRevision,
}: Props) {
    const tituloID = useId();

    const rolGeneral = obtenerRolGeneral(documento);

    const accesoPanel =
        documento.globales.panell?.ver === true;

    const permisosGenerales =
        contarAcciones(documento.globales);

    const permisosComunes =
        contarAcciones(
            documento.acceso_torneos.permisos,
        );

    const torneosPorID = new Map(
        torneos.map((torneo) => [
            torneo.id.toLowerCase(),
            torneo,
        ]),
    );

    const asignaciones = Object.entries(
        documento.torneos,
    );

    const permitidos = asignaciones.filter(
        ([, asignacion]) => asignacion.acceso,
    );

    const denegados = asignaciones.filter(
        ([, asignacion]) => !asignacion.acceso,
    );

    const nombreUsuario =
        obtenerNombreUsuario(usuario);

    const hayAdvertencias =
        advertencias.length > 0;

    const desactivado =
        soloLectura || bloqueado;

    return (
        <section
            aria-labelledby={tituloID}
            className="space-y-7 text-neutral"
        >
            <header className="border-b border-border pb-5">
                <div className="mb-3 flex items-center gap-2">
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
                            <path d="M9 11 12 14 22 4" />
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                    </span>

                    <span className="text-xs font-medium tracking-wide">
                        RESUM
                    </span>
                </div>

                <h2
                    id={tituloID}
                    className="text-xl font-semibold tracking-tight"
                >
                    Revisa la configuració
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6">
                    Comprova els accessos, els rols i els permisos
                    abans de desar els canvis.
                </p>
            </header>

            {/* Usuario */}
            <div
                className="
                    flex flex-col gap-4 rounded-xl
                    border border-border bg-card p-5
                    sm:flex-row sm:items-center
                    sm:justify-between
                "
            >
                <div className="min-w-0">
                    <p className="text-xs">
                        Usuari
                    </p>

                    <h3 className="mt-1 wrap-break-words text-base font-semibold">
                        {nombreUsuario}
                    </h3>

                    <p className="mt-1 break-all text-sm">
                        {usuario.email ||
                            "Sense correu electrònic"}
                    </p>
                </div>

                <div className="shrink-0">
                    <p className="text-xs sm:text-right">
                        Rol general resultant
                    </p>

                    <p className="mt-1 text-sm font-semibold sm:text-right">
                        {rolGeneral
                            ? NOMBRES_ROL[rolGeneral]
                            : "Sense rol"}
                    </p>
                </div>
            </div>

            {/* Resumen principal */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border p-4">
                    <p className="text-xs">
                        Accés al panell
                    </p>

                    <p className="mt-2 text-sm font-semibold">
                        {accesoPanel
                            ? "Activat"
                            : "Desactivat"}
                    </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                    <p className="text-xs">
                        Permisos generals
                    </p>

                    <p className="mt-2 text-sm font-semibold">
                        {permisosGenerales.activadas}
                        {" de "}
                        {permisosGenerales.total}
                    </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                    <p className="text-xs">
                        Assignacions pròpies
                    </p>

                    <p className="mt-2 text-sm font-semibold">
                        {permitidos.length}
                    </p>
                </div>

                <div className="rounded-xl border border-border p-4">
                    <p className="text-xs">
                        Accessos denegats
                    </p>

                    <p className="mt-2 text-sm font-semibold">
                        {denegados.length}
                    </p>
                </div>
            </div>

            {/* Acceso común */}
            <div className="overflow-hidden rounded-xl border border-border">
                <div
                    className="
                        flex flex-col gap-3 bg-card p-5
                        sm:flex-row sm:items-start
                        sm:justify-between
                    "
                >
                    <div>
                        <h3 className="text-sm font-semibold">
                            Accés als tornejos
                        </h3>

                        <p className="mt-1 text-xs leading-5">
                            Configuració que determina
                            l&apos;abast general dels tornejos.
                        </p>
                    </div>

                    <span
                        className="
                            self-start rounded-full border
                            border-border bg-background
                            px-3 py-1.5 text-xs
                        "
                    >
                        {documento.acceso_torneos.todos
                            ? "Tots els tornejos"
                            : "Tornejos seleccionats"}
                    </span>
                </div>

                <div className="grid gap-5 border-t border-border p-5 sm:grid-cols-2">
                    <div>
                        <p className="text-xs">
                            Rol comú
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                            {documento.acceso_torneos.todos
                                ? documento.acceso_torneos.rol
                                    ? NOMBRES_ROL[
                                          documento
                                              .acceso_torneos
                                              .rol
                                      ]
                                    : "Pendent d'assignació"
                                : "No aplicable"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs">
                            Permisos comuns
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                            {documento.acceso_torneos.todos
                                ? `${permisosComunes.activadas} de ${permisosComunes.total}`
                                : "No aplicable"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Asignaciones individuales */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold">
                        Configuracions individuals
                    </h3>

                    <p className="mt-1 text-sm leading-6">
                        Les assignacions següents tenen prioritat
                        sobre la configuració comuna.
                    </p>
                </div>

                {asignaciones.length === 0 ? (
                    <div
                        className="
                            rounded-xl border border-dashed
                            border-border p-7 text-center
                        "
                    >
                        <p className="text-sm font-semibold">
                            No hi ha excepcions individuals
                        </p>

                        <p className="mt-2 text-xs leading-5">
                            {documento.acceso_torneos.todos
                                ? "Tots els tornejos utilitzaran la configuració comuna."
                                : "L'usuari només tindrà accés als tornejos que s'assignin individualment."}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {asignaciones.map(
                            ([id, asignacion]) => {
                                const torneo =
                                    torneosPorID.get(
                                        id.toLowerCase(),
                                    );

                                const nombre =
                                    torneo?.nombre?.trim() ||
                                    "Torneig no disponible";

                                const acciones =
                                    contarAcciones(
                                        asignacion.permisos,
                                    );

                                return (
                                    <article
                                        key={id}
                                        className="
                                            overflow-hidden rounded-xl
                                            border border-border
                                        "
                                    >
                                        <div
                                            className="
                                                flex flex-col gap-3
                                                p-4 sm:flex-row
                                                sm:items-start
                                                sm:justify-between
                                                sm:p-5
                                            "
                                        >
                                            <div className="min-w-0">
                                                <h4 className="wrap-break-words text-sm font-semibold">
                                                    {nombre}
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
                                                        {id}
                                                    </p>
                                                )}
                                            </div>

                                            <span
                                                className="
                                                    self-start rounded-full
                                                    border border-border
                                                    bg-card px-2.5 py-1
                                                    text-xs
                                                "
                                            >
                                                {asignacion.acceso
                                                    ? "Accés propi"
                                                    : "Accés denegat"}
                                            </span>
                                        </div>

                                        <dl
                                            className="
                                                grid gap-4 border-t
                                                border-border
                                                bg-background p-4
                                                sm:grid-cols-2
                                                sm:p-5
                                            "
                                        >
                                            <div>
                                                <dt className="text-xs">
                                                    Rol
                                                </dt>

                                                <dd className="mt-1 text-sm font-semibold">
                                                    {asignacion.acceso &&
                                                    asignacion.rol
                                                        ? NOMBRES_ROL[
                                                              asignacion
                                                                  .rol
                                                          ]
                                                        : "Sense rol"}
                                                </dd>
                                            </div>

                                            <div>
                                                <dt className="text-xs">
                                                    Permisos
                                                </dt>

                                                <dd className="mt-1 text-sm font-semibold">
                                                    {asignacion.acceso
                                                        ? `${acciones.activadas} de ${acciones.total}`
                                                        : "No aplicable"}
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

            {/* Advertencias provenientes de permisos antiguos */}
            {hayAdvertencias && (
                <div className="space-y-4">
                    <div
                        role="alert"
                        className="
                            rounded-xl border border-border
                            bg-card p-5
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
                                    S&apos;han detectat dades anteriors
                                    que no es poden conservar exactament
                                    amb el format actual.
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
                                                    flex items-start
                                                    gap-2 text-xs
                                                    leading-5
                                                "
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="
                                                        mt-2 h-1 w-1
                                                        shrink-0
                                                        rounded-full
                                                        bg-neutral
                                                    "
                                                />

                                                <span>
                                                    {advertencia}
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
                                    flex items-start gap-3
                                    rounded-xl border
                                    border-border p-4
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
                                    disabled={desactivado}
                                    onChange={(evento) =>
                                        onCambiarRevision(
                                            evento.target
                                                .checked,
                                        )
                                    }
                                    className="
                                        mt-0.5 h-4 w-4
                                        shrink-0 accent-primary
                                    "
                                />

                                <span>
                                    <span className="block text-sm font-semibold">
                                        He revisat les
                                        advertències
                                    </span>

                                    <span className="mt-1 block text-xs leading-5">
                                        Entenc que en desar
                                        s&apos;utilitzarà
                                        l&apos;estructura de
                                        permisos actual.
                                    </span>
                                </span>
                            </label>
                        )}
                </div>
            )}

            {!hayAdvertencias && !soloLectura && (
                <div
                    className="
                        flex items-start gap-3 rounded-xl
                        border border-border bg-card p-4
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
                        <p className="text-sm font-semibold">
                            Configuració preparada
                        </p>

                        <p className="mt-1 text-sm leading-6">
                            Revisa el resum i desa els canvis
                            quan estiguis conforme amb la
                            configuració.
                        </p>
                    </div>
                </div>
            )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    El servidor tornarà a validar els rols,
                    els accessos i els permisos abans de
                    desar la configuració.
                </p>
            </footer>
        </section>
    );
}