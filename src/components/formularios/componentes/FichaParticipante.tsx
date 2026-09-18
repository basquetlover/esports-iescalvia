import CampoFormulario from "./CampoFormulario";
import SelectorCurso from "./SelectorCurso";
import SelectorGenero from "./SelectorGenero";

import type {
    ConfiguracionEquipos,
    ObservacionCampo,
    ParticipanteFormulario,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    participante: ParticipanteFormulario;
    indice: number;
    configuracion: ConfiguracionEquipos;
    observaciones: readonly ObservacionCampo[];
    titulo?: string;
    descripcion?: string | null;
    mostrarCurso?: boolean;
    mostrarGenero?: boolean;
    cursoObligatorio?: boolean;
    generoObligatorio?: boolean;
    emailObligatorio?: boolean;
    permitirEliminar?: boolean;
    soloLectura?: boolean;
    bloqueado?: boolean;
    onCambiar: (participante: ParticipanteFormulario) => void;
    onEliminar?: () => void;
};

// ============================================================
// HELPERS
// ============================================================

function buscarObservacion(
    observaciones: readonly ObservacionCampo[],
    participante: ParticipanteFormulario,
    campo: string,
) {
    if (!participante.id) {
        return null;
    }

    const observacion =
        observaciones.find(
            entrada =>
                entrada.entidad_tipo === "participante_equipo" &&
                entrada.entidad_id === participante.id &&
                entrada.campo === campo &&
                entrada.estado !== "RESUELTA",
        ) ??
        observaciones.find(
            entrada =>
                entrada.entidad_id === participante.id &&
                entrada.campo === campo &&
                entrada.estado !== "RESUELTA",
        ) ??
        null;

    return observacion?.mensaje ?? null;
}

function nombreTipo(
    tipo: ParticipanteFormulario["tipo_participante"],
) {
    switch (tipo) {
        case "JUGADOR":
            return "Jugador";

        case "PROFESOR":
            return "Professor";

        case "ENTRENADOR":
            return "Entrenador";

        case "STAFF":
            return "Membre de l'staff";

        default:
            return "Participant";
    }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function FichaParticipante({
    participante,
    indice,
    configuracion,
    observaciones,
    titulo,
    descripcion = null,
    mostrarCurso = true,
    mostrarGenero = true,
    cursoObligatorio = true,
    generoObligatorio = true,
    emailObligatorio = true,
    permitirEliminar = true,
    soloLectura = false,
    bloqueado = false,
    onCambiar,
    onEliminar,
}: Props) {
    const deshabilitado =
        soloLectura ||
        bloqueado;

    const nombreVisible =
        titulo ??
        `${nombreTipo(participante.tipo_participante)} ${indice + 1}`;

    // ========================================================
    // CAMBIOS
    // ========================================================

    function cambiar<
        K extends keyof ParticipanteFormulario,
    >(
        campo: K,
        valor: ParticipanteFormulario[K],
    ) {
        if (deshabilitado) {
            return;
        }

        onCambiar({
            ...participante,
            [campo]: valor,
        });
    }

    function cambiarCurso(
        curso: string,
        grupo: string,
    ) {
        if (deshabilitado) {
            return;
        }

        onCambiar({
            ...participante,
            curso,
            grupo,
        });
    }

    // ========================================================
    // OBSERVACIONES
    // ========================================================

    const observacionNombre =
        buscarObservacion(
            observaciones,
            participante,
            "nombre",
        );

    const observacionApellido1 =
        buscarObservacion(
            observaciones,
            participante,
            "apellido1",
        );

    const observacionApellido2 =
        buscarObservacion(
            observaciones,
            participante,
            "apellido2",
        );

    const observacionEmail =
        buscarObservacion(
            observaciones,
            participante,
            "email",
        );

    const observacionCurso =
        buscarObservacion(
            observaciones,
            participante,
            "curso",
        );

    const observacionGrupo =
        buscarObservacion(
            observaciones,
            participante,
            "grupo",
        );

    const observacionGenero =
        buscarObservacion(
            observaciones,
            participante,
            "genero",
        );

    const observacionGeneral =
        buscarObservacion(
            observaciones,
            participante,
            "general",
        );

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <article className="overflow-hidden rounded-2xl border border-border bg-card/30">
            {/* =================================================
                CABECERA
            ================================================= */}

            <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {indice + 1}
                        </span>

                        <h3 className="font-semibold text-neutral-titulos">
                            {nombreVisible}
                        </h3>
                    </div>

                    {descripcion && (
                        <p className="mt-2 text-xs leading-5 text-neutral">
                            {descripcion}
                        </p>
                    )}
                </div>

                {permitirEliminar && !soloLectura && onEliminar && (
                    <button type="button" disabled={bloqueado} onClick={onEliminar} aria-label={`Eliminar ${nombreVisible}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-neutral transition hover:border-error/40 hover:bg-error-container/20 hover:text-error disabled:cursor-not-allowed disabled:opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                            <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm80-160h80v-360h-80v360Zm160 0h80v-360h-80v360Z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* =================================================
                OBSERVACIÓN GENERAL
            ================================================= */}

            {observacionGeneral && (
                <div className="border-b border-error/20 bg-error-container/20 px-4 py-3 sm:px-5">
                    <div className="flex items-start gap-2 text-sm text-error-foreground">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-4 w-4 shrink-0 fill-current text-error" aria-hidden="true">
                            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                        </svg>

                        <div>
                            <p className="font-semibold">
                                Motiu de la revisió
                            </p>

                            <p className="mt-0.5 text-xs leading-5">
                                {observacionGeneral}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                CAMPOS
            ================================================= */}

            <div className="space-y-6 p-4 sm:p-5">
                {/* =================================================
                    NOMBRE
                ================================================= */}

                <div className="grid gap-4 sm:grid-cols-2">
                    <CampoFormulario id={`participant-${indice}-nombre`} etiqueta="Nom" obligatorio observacion={observacionNombre}>
                        <input id={`participant-${indice}-nombre`} type="text" value={participante.nombre} disabled={deshabilitado} autoComplete="given-name" onChange={evento => cambiar("nombre", evento.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/60 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-card disabled:text-neutral" placeholder="Nom" />
                    </CampoFormulario>

                    <CampoFormulario id={`participant-${indice}-apellido1`} etiqueta="Primer llinatge" obligatorio observacion={observacionApellido1}>
                        <input id={`participant-${indice}-apellido1`} type="text" value={participante.apellido1} disabled={deshabilitado} autoComplete="family-name" onChange={evento => cambiar("apellido1", evento.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/60 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-card disabled:text-neutral" placeholder="Primer llinatge" />
                    </CampoFormulario>
                </div>

                {/* =================================================
                    SEGUNDO APELLIDO
                ================================================= */}

                <CampoFormulario id={`participant-${indice}-apellido2`} etiqueta="Segon llinatge" observacion={observacionApellido2}>
                    <input id={`participant-${indice}-apellido2`} type="text" value={participante.apellido2} disabled={deshabilitado} autoComplete="additional-name" onChange={evento => cambiar("apellido2", evento.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/60 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-card disabled:text-neutral" placeholder="Segon llinatge" />
                </CampoFormulario>

                {/* =================================================
                    EMAIL
                ================================================= */}

                <CampoFormulario id={`participant-${indice}-email`} etiqueta="Correu electrònic" obligatorio={emailObligatorio} ayuda="Ha d'utilitzar una adreça de correu admesa per la plataforma." observacion={observacionEmail}>
                    <input id={`participant-${indice}-email`} type="email" value={participante.email} disabled={deshabilitado} autoComplete="email" inputMode="email" onChange={evento => cambiar("email", evento.target.value)} className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/60 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-card disabled:text-neutral" placeholder="nom@domini.cat" />
                </CampoFormulario>

                {/* =================================================
                    CURSO / GRUPO
                ================================================= */}

                {mostrarCurso && (
                    <CampoFormulario etiqueta="Curs i grup" obligatorio={cursoObligatorio} observacion={observacionCurso ?? observacionGrupo}>
                        <SelectorCurso curso={participante.curso} grupo={participante.grupo} cursos={configuracion.cursos} deshabilitado={deshabilitado} obligatorio={cursoObligatorio} onCambiar={cambiarCurso} />
                    </CampoFormulario>
                )}

                {/* =================================================
                    GÉNERO
                ================================================= */}

                {mostrarGenero && configuracion.genero.activo && (
                    <CampoFormulario etiqueta="Gènere" obligatorio={generoObligatorio} ayuda="Aquesta informació s'utilitza per comprovar els requisits de composició de l'equip." observacion={observacionGenero}>
                        <SelectorGenero valor={participante.genero} deshabilitado={deshabilitado} obligatorio={generoObligatorio} onCambiar={genero => cambiar("genero", genero)} />
                    </CampoFormulario>
                )}
            </div>
        </article>
    );
}