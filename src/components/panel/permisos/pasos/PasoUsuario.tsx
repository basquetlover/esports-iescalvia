import { useId } from "react";

// ============================================================
// TIPOS
// ============================================================

export type UsuarioPaso = {
    id: string;

    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;

    email: string | null;

    activa: boolean | null;

    origen_permisos:
        string | null;
};

type Props = {
    usuario: UsuarioPaso;

    modo:
        | "crear"
        | "editar"
        | "ver";

    onCambiarUsuario?: () => void;

    bloqueado?: boolean;
};

// ============================================================
// HELPERS
// ============================================================

function obtenerNombre(
    usuario: UsuarioPaso,
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

function obtenerIniciales(
    usuario: UsuarioPaso,
) {
    const partes = [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ].filter(
        (
            valor,
        ): valor is string =>
            typeof valor ===
                "string" &&
            valor.trim().length >
                0,
    );

    return (
        partes
            .slice(0, 2)
            .map(
                (parte) =>
                    Array.from(
                        parte.trim(),
                    )[0],
            )
            .join("")
            .toLocaleUpperCase(
                "ca-ES",
            ) || "—"
    );
}

function obtenerOrigen(
    valor: string | null,
) {
    switch (
        valor
            ?.trim()
            .toLowerCase()
    ) {
        case "manual":
            return "Manual";

        case "sistema":
            return "Sistema";

        default:
            return "Sense especificar";
    }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoUsuario({
    usuario,
    modo,
    onCambiarUsuario,
    bloqueado = false,
}: Props) {
    const tituloID =
        useId();

    const creando =
        modo === "crear";

    const nombre =
        obtenerNombre(
            usuario,
        );

    const origen =
        creando
            ? "Manual"
            : obtenerOrigen(
                  usuario
                      .origen_permisos,
              );

    const estado =
        usuario.activa ===
        true
            ? "Actiu"
            : usuario.activa ===
                false
              ? "Inactiu"
              : "Sense especificar";

    const datos = [
        {
            etiqueta: "Nom",
            valor:
                usuario.nombre,
        },
        {
            etiqueta:
                "Primer cognom",
            valor:
                usuario.apellido1,
        },
        {
            etiqueta:
                "Segon cognom",
            valor:
                usuario.apellido2,
        },
        {
            etiqueta:
                "Correu electrònic",
            valor:
                usuario.email,
        },
    ];

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
                            <circle
                                cx="12"
                                cy="8"
                                r="3.5"
                            />

                            <path d="M5 20v-1a7 7 0 0 1 14 0v1" />
                        </svg>
                    </span>

                    <span className="text-xs font-medium tracking-wide">
                        USUARI
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
                    {creando
                        ? "A qui vols donar accés?"
                        : "Usuari seleccionat"}
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6">
                    {creando
                        ? "Comprova que has seleccionat el compte correcte abans de configurar el seu rol, els tornejos i els permisos."
                        : "Consulta el compte al qual pertany aquesta configuració d'accés."}
                </p>
            </header>

            {/* =================================================
                TARJETA PRINCIPAL
            ================================================= */}

            <div
                className="
                    flex flex-col gap-5
                    rounded-2xl
                    border border-border
                    bg-background
                    p-5
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                "
            >
                <div className="flex min-w-0 items-center gap-4">
                    <div
                        aria-hidden="true"
                        className="
                            flex h-16 w-16
                            shrink-0
                            items-center
                            justify-center
                            rounded-2xl
                            border border-border
                            bg-card
                            text-xl
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        {obtenerIniciales(
                            usuario,
                        )}
                    </div>

                    <div className="min-w-0">
                        <h3
                            className="
                                wrap-break-words
                                text-base
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            {
                                nombre
                            }
                        </h3>

                        <p className="mt-1 break-all text-sm">
                            {usuario.email ||
                                "Sense correu electrònic"}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {/* ESTADO */}

                            <span
                                className="
                                    inline-flex
                                    items-center
                                    gap-2
                                    rounded-full
                                    border
                                    border-border
                                    bg-card
                                    px-2.5
                                    py-1
                                    text-xs
                                "
                            >
                                <span
                                    aria-hidden="true"
                                    className={`
                                        h-1.5 w-1.5
                                        rounded-full

                                        ${
                                            usuario.activa ===
                                            true
                                                ? "bg-primary"
                                                : "bg-error"
                                        }
                                    `}
                                />

                                Compte:{" "}
                                {
                                    estado
                                }
                            </span>

                            {/* ORIGEN */}

                            <span
                                className="
                                    rounded-full
                                    border border-border
                                    bg-card
                                    px-2.5 py-1
                                    text-xs
                                "
                            >
                                Permisos:{" "}
                                {
                                    origen
                                }
                            </span>
                        </div>
                    </div>
                </div>

                {/* CAMBIAR USUARIO */}

                {creando &&
                    onCambiarUsuario && (
                        <button
                            type="button"
                            disabled={
                                bloqueado
                            }
                            onClick={
                                onCambiarUsuario
                            }
                            className="
                                inline-flex
                                shrink-0
                                items-center
                                justify-center
                                gap-2
                                self-start
                                rounded-lg
                                border
                                border-border
                                bg-card
                                px-4
                                py-2.5
                                text-sm
                                font-medium
                                text-neutral
                                hover:border-neutral/40
                                focus-visible:outline-none
                                focus-visible:ring-2
                                focus-visible:ring-neutral/30
                                disabled:cursor-wait
                                disabled:opacity-50
                                sm:self-center
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
                                aria-hidden="true"
                            >
                                <path d="M7 7h14l-4-4" />
                                <path d="m17 17-14 0 4 4" />
                            </svg>

                            Canviar usuari
                        </button>
                    )}
            </div>

            {/* =================================================
                DATOS
            ================================================= */}

            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                {datos.map(
                    ({
                        etiqueta,
                        valor,
                    }) => (
                        <div
                            key={
                                etiqueta
                            }
                            className="min-w-0"
                        >
                            <dt className="mb-2 text-xs font-semibold">
                                {
                                    etiqueta
                                }
                            </dt>

                            <dd
                                className="
                                    min-h-11
                                    wrap-break-words
                                    rounded-lg
                                    border
                                    border-border
                                    bg-card
                                    px-3.5
                                    py-3
                                    text-sm
                                "
                            >
                                {valor?.trim() ||
                                    "Sense informació"}
                            </dd>
                        </div>
                    ),
                )}
            </dl>

            {/* =================================================
                INFORMACIÓN
            ================================================= */}

            <div className="grid gap-4 sm:grid-cols-2">
                {/* ORIGEN */}

                <div
                    className="
                        rounded-xl
                        border border-border
                        p-4
                    "
                >
                    <h3 className="text-sm font-semibold text-neutral-titulos">
                        Origen dels permisos
                    </h3>

                    <p className="mt-2 text-sm leading-6">
                        {creando
                            ? "L'accés concedit des d'aquesta pantalla quedarà registrat com a manual."
                            : origen ===
                                "Sistema"
                              ? "Aquests permisos tenen origen del sistema. Editar-los conservarà aquest origen."
                              : origen ===
                                  "Manual"
                                ? "Aquests permisos es varen assignar manualment."
                                : "Aquest compte no té especificat l'origen dels permisos."}
                    </p>
                </div>

                {/* SIGUIENTE PASO */}

                <div
                    className="
                        rounded-xl
                        border border-border
                        p-4
                    "
                >
                    <h3 className="text-sm font-semibold text-neutral-titulos">
                        Rol i tornejos
                    </h3>

                    <p className="mt-2 text-sm leading-6">
                        {modo ===
                        "ver"
                            ? "Al següent pas podràs consultar el rol general de l'usuari, els tornejos als quals té accés i el rol assignat a cadascun."
                            : "Al següent pas seleccionaràs primer el rol general de l'usuari i després definiràs si tindrà accés a tots els tornejos o només a alguns, amb el rol corresponent."}
                    </p>
                </div>
            </div>

            {/* =================================================
                CUENTA INACTIVA
            ================================================= */}

            {creando &&
                usuario.activa !==
                    true && (
                    <div
                        role="alert"
                        className="
                            flex items-start
                            gap-3
                            rounded-xl
                            border
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
                                El compte ha d'estar actiu
                            </p>

                            <p className="mt-1 text-sm leading-6">
                                Activa aquest compte des de la gestió
                                d'usuaris abans de concedir-li
                                accés al panell.
                            </p>
                        </div>
                    </div>
                )}

            <footer className="border-t border-border pt-5">
                <p className="text-xs leading-6">
                    En aquest pas no es modifica cap permís. Només es
                    comprova la identitat del compte abans de configurar
                    el seu accés administratiu.
                </p>
            </footer>
        </section>
    );
}