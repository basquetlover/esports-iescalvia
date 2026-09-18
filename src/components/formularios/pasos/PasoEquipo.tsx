import {
    useId,
    useRef,
    type ChangeEvent,
} from "react";

import CampoFormulario from "../componentes/CampoFormulario";

import type {
    ConfiguracionEquipos,
    DatosFormularioEquipo,
    EdicionFormulario,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    formulario: DatosFormularioEquipo;
    configuracion: ConfiguracionEquipos;
    edicion: EdicionFormulario;
    soloLectura: boolean;
    bloqueado: boolean;
    onCambiar: (formulario: DatosFormularioEquipo) => void;
};

// ============================================================
// CONSTANTES
// ============================================================

const MAX_ESCUDO_BYTES =
    2 * 1024 * 1024;

const TIPOS_ESCUDO = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
];

// ============================================================
// FECHAS
// ============================================================

function formatearFecha(
    valor: string | null,
) {
    if (!valor) {
        return "Sense data";
    }

    const fecha =
        new Date(valor);

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        return "Sense data";
    }

    return new Intl.DateTimeFormat(
        "ca-ES",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Europe/Madrid",
        },
    ).format(fecha);
}

// ============================================================
// OBSERVACIONES
// ============================================================

function buscarObservacion(
    formulario: DatosFormularioEquipo,
    entidadTipo: string,
    entidadID: string | null,
    campo: string,
) {
    const observacion =
        formulario.observaciones.find(
            entrada =>
                entrada.entidad_tipo === entidadTipo &&
                entrada.entidad_id === (entidadID ?? "") &&
                entrada.campo === campo &&
                entrada.estado.trim().toUpperCase() !== "RESUELTA",
        ) ??
        formulario.observaciones.find(
            entrada =>
                entrada.campo === campo &&
                entrada.estado.trim().toUpperCase() !== "RESUELTA",
        ) ??
        null;

    return observacion?.mensaje ?? null;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoEquipo({
    formulario,
    configuracion,
    edicion,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const inputEscudoID =
        useId();

    const inputEscudo =
        useRef<HTMLInputElement | null>(
            null,
        );

    const deshabilitado =
        soloLectura ||
        bloqueado;

    const observacionNombre =
        buscarObservacion(
            formulario,
            "equipo",
            formulario.equipo.id,
            "nombre",
        );

    const observacionEscudo =
        buscarObservacion(
            formulario,
            "equipo",
            formulario.equipo.id,
            "escudo",
        );

    const observacionContacto =
        buscarObservacion(
            formulario,
            "formulario",
            formulario.id,
            "email_contacto",
        );

    // ========================================================
    // CAMBIAR NOMBRE
    // ========================================================

    function cambiarNombre(
        nombre: string,
    ) {
        if (deshabilitado) {
            return;
        }

        onCambiar({
            ...formulario,

            equipo: {
                ...formulario.equipo,
                nombre,
            },
        });
    }

    // ========================================================
    // CAMBIAR ESCUDO
    // ========================================================

    function cambiarEscudo(
        escudo: string | null,
    ) {
        if (deshabilitado) {
            return;
        }

        onCambiar({
            ...formulario,

            equipo: {
                ...formulario.equipo,
                escudo,
            },
        });
    }

    // ========================================================
    // SELECCIONAR ARCHIVO
    // ========================================================

    function seleccionarEscudo(
        evento: ChangeEvent<HTMLInputElement>,
    ) {
        const archivo =
            evento.target.files?.[0];

        /*
         * Permitimos volver a seleccionar
         * el mismo archivo posteriormente.
         */
        evento.target.value = "";

        if (
            !archivo ||
            deshabilitado
        ) {
            return;
        }

        if (
            !TIPOS_ESCUDO.includes(
                archivo.type,
            )
        ) {
            window.alert(
                "El format de l'escut no és vàlid. Utilitza PNG, JPG, WEBP o SVG.",
            );

            return;
        }

        if (
            archivo.size >
            MAX_ESCUDO_BYTES
        ) {
            window.alert(
                "L'escut no pot superar els 2 MB.",
            );

            return;
        }

        const lector =
            new FileReader();

        lector.onerror =
            () => {
                window.alert(
                    "No s'ha pogut llegir la imatge seleccionada.",
                );
            };

        lector.onload =
            () => {
                if (
                    typeof lector.result !==
                    "string"
                ) {
                    return;
                }

                cambiarEscudo(
                    lector.result,
                );
            };

        lector.readAsDataURL(
            archivo,
        );
    }

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="space-y-8">
            {/* =================================================
                INFORMACIÓN EDICIÓN
            ================================================= */}

            <div className="rounded-2xl border border-border bg-card/30 p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M160-120v-480l320-240 320 240v480H560v-280H400v280H160Zm80-80h80v-280h320v280h80v-360L480-740 240-560v360Z" />
                        </svg>
                    </span>

                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                            Inscripció d'equip
                        </p>

                        <h3 className="mt-1 text-lg font-semibold text-neutral-titulos">
                            {edicion.nombre}
                        </h3>

                        <p className="mt-1 text-sm leading-6 text-neutral">
                            Introdueix les dades principals de l'equip abans d'afegir els participants.
                        </p>
                    </div>
                </div>
            </div>

            {/* =================================================
                DATOS EQUIPO
            ================================================= */}

            <section className="space-y-6">
                <div>
                    <h3 className="text-base font-semibold text-neutral-titulos">
                        Dades de l'equip
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-neutral">
                        Aquestes dades identificaran l'equip durant el torneig.
                    </p>
                </div>

                {/* =================================================
                    NOMBRE
                ================================================= */}

                <CampoFormulario etiqueta="Nom de l'equip" obligatorio ayuda="Utilitza el nom amb què vols que aparegui l'equip durant la competició." observacion={observacionNombre} contador={`${formulario.equipo.nombre.length}/80`} disabled={deshabilitado}>
                    <input type="text" value={formulario.equipo.nombre} maxLength={80} disabled={deshabilitado} autoComplete="off" placeholder="Nom de l'equip" onChange={evento => cambiarNombre(evento.target.value)} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60" />
                </CampoFormulario>

                {/* =================================================
                    EMAIL CONTACTO
                ================================================= */}

                <CampoFormulario etiqueta="Correu electrònic de contacte" obligatorio ayuda="Correspon al correu del compte que ha creat aquesta inscripció i no es pot modificar." observacion={observacionContacto} disabled>
                    <div className="relative">
                        <input type="email" value={formulario.email_contacto} readOnly disabled className="w-full cursor-not-allowed rounded-xl border border-border bg-card px-4 py-3 pr-12 text-sm font-medium text-neutral-titulos opacity-80 outline-none" />

                        <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-neutral" title="Aquest correu no es pot modificar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920q83 0 141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80H240Zm0-80h480v-400H240v400Zm240-120q33 0 56.5-23.5T560-360q0-33-23.5-56.5T480-440q-33 0-56.5 23.5T400-360q0 33 23.5 56.5T480-280ZM360-640h240v-80q0-50-35-85t-85-35q-50 0-85 35t-35 85v80ZM240-160v-400 400Z" />
                            </svg>
                        </span>
                    </div>
                </CampoFormulario>

                {/* =================================================
                    AVISO CONTACTO
                ================================================= */}

                <div className="flex items-start gap-3 rounded-xl border border-border bg-card/30 p-4">
                    <span className="mt-0.5 shrink-0 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                        </svg>
                    </span>

                    <div>
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Responsable de la inscripció
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            Aquest correu queda vinculat a la persona que ha creat el formulari. Encara que posteriorment es concedeixi accés al capità, el correu de contacte continuarà sent el del creador.
                        </p>
                    </div>
                </div>
            </section>

            {/* =================================================
                ESCUDO
            ================================================= */}

            <section className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-neutral-titulos">
                        Escut de l'equip
                    </h3>

                    <p className="mt-1 text-sm leading-6 text-neutral">
                        Pots afegir una imatge perquè l'equip sigui més fàcil d'identificar.
                    </p>
                </div>

                <CampoFormulario etiqueta="Escut" ayuda="Formats admesos: PNG, JPG, WEBP o SVG. Màxim 2 MB." observacion={observacionEscudo} disabled={deshabilitado}>
                    <input ref={inputEscudo} id={inputEscudoID} type="file" accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml" disabled={deshabilitado} onChange={seleccionarEscudo} className="sr-only" />

                    {!formulario.equipo.escudo ? (
                        <button type="button" disabled={deshabilitado} onClick={() => inputEscudo.current?.click()} className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-card/20 px-6 py-10 text-center transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60">
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
                                    <path d="M440-200h80v-160h160v-80H520v-160h-80v160H280v80h160v160ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h126l74-80h160l74 80h126q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-560H598l-74-80h-88l-74 80H200v560Z" />
                                </svg>
                            </span>

                            <span className="mt-3 text-sm font-semibold text-neutral-titulos">
                                Selecciona un escut
                            </span>

                            <span className="mt-1 text-xs text-neutral">
                                Fes clic per seleccionar una imatge
                            </span>
                        </button>
                    ) : (
                        <div className="rounded-2xl border border-border bg-card/20 p-4">
                            <div className="grid gap-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center">
                                <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-background">
                                    <img src={formulario.equipo.escudo} alt={`Vista prèvia de l'escut de ${formulario.equipo.nombre || "l'equip"}`} className="h-full w-full object-contain p-4" />
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-neutral-titulos">
                                        Vista prèvia de l'escut
                                    </p>

                                    <p className="mt-1 text-xs leading-5 text-neutral">
                                        Aquesta és la imatge que s'utilitzarà per identificar l'equip.
                                    </p>

                                    {!deshabilitado && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            <button type="button" onClick={() => inputEscudo.current?.click()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                                    <path d="M440-200h80v-160h160v-80H520v-160h-80v160H280v80h160v160ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h126l74-80h160l74 80h126q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Z" />
                                                </svg>

                                                Canviar
                                            </button>

                                            <button type="button" onClick={() => cambiarEscudo(null)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-error/30 bg-background px-4 py-2 text-sm font-semibold text-error transition hover:bg-error-container/20">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                                    <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm80-160h80v-360h-80v360Zm160 0h80v-360h-80v360Z" />
                                                </svg>

                                                Eliminar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </CampoFormulario>
            </section>

            {/* =================================================
                PERIODO INSCRIPCIÓN
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card/20 p-5">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-neutral">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M320-400h80v-80h-80v80Zm160 0h80v-80h-80v80Zm160 0h80v-80h-80v80ZM200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h80v-80h80v80h240v-80h80v80h80q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z" />
                        </svg>
                    </span>

                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Període d'inscripció
                        </h3>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-border bg-background px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral">
                                    Obertura
                                </p>

                                <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                    {formatearFecha(
                                        configuracion.inscripcion.apertura,
                                    )}
                                </p>
                            </div>

                            <div className="rounded-xl border border-border bg-background px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-neutral">
                                    Tancament
                                </p>

                                <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                                    {formatearFecha(
                                        configuracion.inscripcion.cierre,
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}