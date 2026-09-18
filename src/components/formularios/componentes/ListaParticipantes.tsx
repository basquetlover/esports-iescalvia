import {
    useEffect,
} from "react";

import FichaParticipante from "./FichaParticipante";

import type {
    ConfiguracionEquipos,
    ObservacionCampo,
    ParticipanteFormulario,
    TipoParticipante,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    tipo: TipoParticipante;
    participantes: ParticipanteFormulario[];
    configuracion: ConfiguracionEquipos;
    observaciones: readonly ObservacionCampo[];
    titulo: string;
    descripcion?: string | null;
    singular: string;
    plural: string;
    minimo?: number | null;
    maximo?: number | null;
    mostrarCurso?: boolean;
    mostrarGenero?: boolean;
    cursoObligatorio?: boolean;
    generoObligatorio?: boolean;
    emailObligatorio?: boolean;
    soloLectura?: boolean;
    bloqueado?: boolean;
    onCambiar: (participantes: ParticipanteFormulario[]) => void;
};

// ============================================================
// CREAR PARTICIPANTE
// ============================================================

function crearParticipante(
    tipo: TipoParticipante,
    orden: number,
): ParticipanteFormulario {
    return {
        id: null,
        tipo_participante: tipo,
        nombre: "",
        apellido1: "",
        apellido2: "",
        email: "",
        curso: "",
        grupo: "",
        genero: null,
        orden,
    };
}

// ============================================================
// TEXTO DE LÍMITES
// ============================================================

function textoLimites(
    minimo: number,
    maximo: number | null,
    singular: string,
    plural: string,
) {
    if (
        minimo > 0 &&
        maximo !== null
    ) {
        if (
            minimo === maximo
        ) {
            return `${minimo} ${minimo === 1 ? singular : plural}`;
        }

        return `Entre ${minimo} i ${maximo} ${plural}`;
    }

    if (
        minimo > 0
    ) {
        return `Mínim ${minimo} ${minimo === 1 ? singular : plural}`;
    }

    if (
        maximo !== null
    ) {
        return `Màxim ${maximo} ${maximo === 1 ? singular : plural}`;
    }

    return "Sense límit màxim";
}

// ============================================================
// COMPONENTE
// ============================================================

export default function ListaParticipantes({
    tipo,
    participantes,
    configuracion,
    observaciones,
    titulo,
    descripcion = null,
    singular,
    plural,
    minimo = 0,
    maximo = null,
    mostrarCurso = true,
    mostrarGenero = true,
    cursoObligatorio = true,
    generoObligatorio = true,
    emailObligatorio = true,
    soloLectura = false,
    bloqueado = false,
    onCambiar,
}: Props) {
    // ========================================================
    // LÍMITES NORMALIZADOS
    // ========================================================

    const minimoObligatorio =
        typeof minimo === "number" &&
        Number.isFinite(minimo) &&
        minimo > 0
            ? Math.floor(minimo)
            : 0;

    /*
     * En la configuración de la plataforma utilizamos 0
     * como "sin máximo".
     */
    const maximoPermitido =
        typeof maximo === "number" &&
        Number.isFinite(maximo) &&
        maximo > 0
            ? Math.floor(maximo)
            : null;

    // ========================================================
    // PARTICIPANTES DE ESTE TIPO
    // ========================================================

    const participantesTipo =
        participantes
            .filter(
                participante =>
                    participante.tipo_participante === tipo,
            )
            .sort(
                (a, b) =>
                    a.orden - b.orden,
            );

    const cantidad =
        participantesTipo.length;

    const puedeModificar =
        !soloLectura &&
        !bloqueado;

    const maximoAlcanzado =
        maximoPermitido !== null &&
        cantidad >= maximoPermitido;

    const puedeAnadir =
        puedeModificar &&
        !maximoAlcanzado;

    const puedeEliminar =
        puedeModificar &&
        cantidad > minimoObligatorio;

    const porDebajoMinimo =
        cantidad < minimoObligatorio;

    const limites =
        textoLimites(
            minimoObligatorio,
            maximoPermitido,
            singular,
            plural,
        );

    // ========================================================
    // CREAR AUTOMÁTICAMENTE EL MÍNIMO OBLIGATORIO
    // ========================================================

    useEffect(() => {
        if (
            soloLectura ||
            bloqueado ||
            minimoObligatorio <= 0
        ) {
            return;
        }

        const actuales =
            participantes.filter(
                participante =>
                    participante.tipo_participante === tipo,
            );

        if (
            actuales.length >= minimoObligatorio
        ) {
            return;
        }

        const faltan =
            minimoObligatorio -
            actuales.length;

        const ordenMaximo =
            participantes.reduce(
                (
                    maximoActual,
                    participante,
                ) =>
                    Math.max(
                        maximoActual,
                        participante.orden,
                    ),
                0,
            );

        const nuevos =
            Array.from(
                {
                    length:
                        faltan,
                },
                (
                    _,
                    indice,
                ) =>
                    crearParticipante(
                        tipo,
                        ordenMaximo + indice + 1,
                    ),
            );

        onCambiar([
            ...participantes,
            ...nuevos,
        ]);
    }, [
        tipo,
        participantes,
        minimoObligatorio,
        soloLectura,
        bloqueado,
        onCambiar,
    ]);

    // ========================================================
    // AÑADIR
    // ========================================================

    function anadir() {
        if (
            !puedeAnadir
        ) {
            return;
        }

        const ordenMaximo =
            participantes.reduce(
                (
                    maximoActual,
                    participante,
                ) =>
                    Math.max(
                        maximoActual,
                        participante.orden,
                    ),
                0,
            );

        onCambiar([
            ...participantes,
            crearParticipante(
                tipo,
                ordenMaximo + 1,
            ),
        ]);
    }

    // ========================================================
    // MODIFICAR
    // ========================================================

    function actualizar(
        posicion: number,
        participanteActualizado: ParticipanteFormulario,
    ) {
        if (
            !puedeModificar
        ) {
            return;
        }

        const participanteOriginal =
            participantesTipo[
                posicion
            ];

        if (
            !participanteOriginal
        ) {
            return;
        }

        let encontrado =
            false;

        const nuevos =
            participantes.map(
                participante => {
                    if (
                        encontrado
                    ) {
                        return participante;
                    }

                    const coincidePorID =
                        participanteOriginal.id !== null &&
                        participante.id === participanteOriginal.id;

                    const coincideTemporal =
                        participanteOriginal.id === null &&
                        participante === participanteOriginal;

                    if (
                        !coincidePorID &&
                        !coincideTemporal
                    ) {
                        return participante;
                    }

                    encontrado =
                        true;

                    return {
                        ...participanteActualizado,
                        tipo_participante:
                            tipo,
                    };
                },
            );

        onCambiar(
            nuevos,
        );
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminar(
        posicion: number,
    ) {
        if (
            !puedeEliminar
        ) {
            return;
        }

        const participanteEliminar =
            participantesTipo[
                posicion
            ];

        if (
            !participanteEliminar
        ) {
            return;
        }

        let eliminado =
            false;

        const restantes =
            participantes.filter(
                participante => {
                    if (
                        eliminado
                    ) {
                        return true;
                    }

                    const coincidePorID =
                        participanteEliminar.id !== null &&
                        participante.id === participanteEliminar.id;

                    const coincideTemporal =
                        participanteEliminar.id === null &&
                        participante === participanteEliminar;

                    if (
                        coincidePorID ||
                        coincideTemporal
                    ) {
                        eliminado =
                            true;

                        return false;
                    }

                    return true;
                },
            );

        onCambiar(
            restantes,
        );
    }

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="space-y-5">
            {/* =================================================
                CABECERA
            ================================================= */}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-neutral-titulos">
                            {titulo}
                        </h3>

                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${porDebajoMinimo ? "border-error/30 bg-error-container/30 text-error-foreground" : "border-border bg-card text-neutral"}`}>
                            {cantidad}
                            {maximoPermitido !== null
                                ? ` / ${maximoPermitido}`
                                : ""}
                        </span>
                    </div>

                    {descripcion && (
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral">
                            {descripcion}
                        </p>
                    )}

                    <p className="mt-2 text-xs font-medium text-neutral">
                        {limites}
                    </p>
                </div>

                {!soloLectura && (
                    <button type="button" disabled={!puedeAnadir} onClick={anadir} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                            <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                        </svg>

                        Afegir {singular}
                    </button>
                )}
            </div>

            {/* =================================================
                AVISO MÍNIMO
            ================================================= */}

            {porDebajoMinimo && (
                <div className="flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 p-4">
                    <span className="mt-0.5 shrink-0 text-error">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                        </svg>
                    </span>

                    <div>
                        <p className="text-sm font-semibold text-error-foreground">
                            Falten {minimoObligatorio - cantidad} {minimoObligatorio - cantidad === 1 ? singular : plural}
                        </p>

                        <p className="mt-0.5 text-xs leading-5 text-error-foreground">
                            Aquesta edició requereix un mínim de {minimoObligatorio} {minimoObligatorio === 1 ? singular : plural}.
                        </p>
                    </div>
                </div>
            )}

            {/* =================================================
                SIN PARTICIPANTES
            ================================================= */}

            {cantidad === 0 && minimoObligatorio === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/20 px-5 py-10 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-card text-neutral">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M400-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0 320q-83 0-156-31.5T117-280q54-54 127-85.5T400-397q83 0 156 31.5T683-280q-54 57-127 88.5T400-160Zm320-280v-120H600v-80h120v-120h80v120h120v80H800v120h-80Z" />
                        </svg>
                    </span>

                    <p className="mt-3 font-semibold text-neutral-titulos">
                        Encara no hi ha {plural}
                    </p>

                    {!soloLectura && (
                        <p className="mt-1 text-sm text-neutral">
                            Aquest apartat és opcional. Pots afegir {plural} si ho necessites.
                        </p>
                    )}

                    {puedeAnadir && (
                        <button type="button" onClick={anadir} className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                            </svg>

                            Afegir {singular}
                        </button>
                    )}
                </div>
            )}

            {/* =================================================
                PARTICIPANTES
            ================================================= */}

            {participantesTipo.length > 0 && (
                <div className="space-y-4">
                    {participantesTipo.map(
                        (
                            participante,
                            indice,
                        ) => (
                            <FichaParticipante key={participante.id ?? `${tipo}-${participante.orden}-${indice}`} participante={participante} indice={indice} configuracion={configuracion} observaciones={observaciones} mostrarCurso={mostrarCurso} mostrarGenero={mostrarGenero} cursoObligatorio={cursoObligatorio} generoObligatorio={generoObligatorio} emailObligatorio={emailObligatorio} permitirEliminar={!soloLectura && cantidad > minimoObligatorio} soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={nuevo => actualizar(indice, nuevo)} onEliminar={() => eliminar(indice)} />
                        ),
                    )}
                </div>
            )}

            {/* =================================================
                MÍNIMO BLOQUEADO
            ================================================= */}

            {cantidad > 0 && cantidad <= minimoObligatorio && !soloLectura && (
                <p className="text-center text-xs font-medium text-neutral">
                    Aquestes {cantidad} {cantidad === 1 ? singular : plural} són obligatòries i no es poden eliminar.
                </p>
            )}

            {/* =================================================
                MÁXIMO
            ================================================= */}

            {maximoAlcanzado && !soloLectura && (
                <p className="text-center text-xs font-medium text-neutral">
                    Has arribat al màxim de {maximoPermitido} {maximoPermitido === 1 ? singular : plural}.
                </p>
            )}
        </div>
    );
}