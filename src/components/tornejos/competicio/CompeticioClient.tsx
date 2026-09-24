import {
    useCallback,
    useEffect,
    useState,
} from "react";

import SelectorGrup from "./SelectorGrup";
import ClassificacioResum from "./ClassificacioResum";
import JornadaActual from "./JornadaActual";
import ClassificacioCompleta from "./ClassificacioCompleta";
import ProximaJornada from "./ProximaJornada";

type Props = {
    torneoID: string;
    edicionID: string;
};

type Equip = {
    id: string;
    nombre: string;
    escudo: string | null;
};

type Grup = {
    id: string;
    nombre: string;
    estado: string;

    faseID:
        string;

    faseNombre:
        string;

    faseOrden:
        number;

    orden:
        number;
};

type FilaClassificacio = {
    equipo:
        Equip;

    posicion:
        number | null;

    pj:
        number | null;

    pg:
        number | null;

    pe:
        number | null;

    pp:
        number | null;

    favor:
        number | null;

    contra:
        number | null;

    diferencia:
        number | null;

    puntos:
        number | null;

    amarillas:
        number | null;

    rojas:
        number | null;
};

type Partit = {
    id: string;
    codigo: string;

    nombre:
        string | null;

    jornada:
        number | null;

    estado:
        string;

    fechaHora:
        string | null;

    pista:
        string | null;

    local:
        Equip | null;

    visitante:
        Equip | null;

    resultadoLocal:
        number | null;

    resultadoVisitante:
        number | null;

    finalizado:
        boolean;
};

type Jornada = {
    numero:
        number;

    contexto:
        | "AVUI"
        | "DARRERA"
        | "PER_JUGAR"
        | "PROXIMA";

    partidos:
        Partit[];
};

type DadesCompeticio = {
    deporte:
        string;

    esFutbol:
        boolean;

    etiquetas: {
        favor:
            string;

        contra:
            string;
    };

    grupos:
        Grup[];

    grupo: {
        id:
            string;

        nombre:
            string;

        estado:
            string;

        faseID:
            string;

        faseNombre:
            string;
    } | null;

    tieneClasificacion:
        boolean;

    clasificacion:
        FilaClassificacio[];

    jornadaReferencia:
        Jornada | null;

    proximaJornada:
        Jornada | null;
};

type RespostaAPI = {
    data?:
        DadesCompeticio;

    mensaje?:
        string;
};

// ============================================================
// ESTADO
// ============================================================

function nomEstat(
    estat:
        string,
) {
    switch (
        estat
            .trim()
            .toUpperCase()
    ) {
        case "BORRADOR":
            return "Esborrany";

        case "PREPARADO":
            return "Preparat";

        case "EN_CURSO":
            return "En curs";

        case "CERRADO":
            return "Finalitzat";

        default:
            return estat;
    }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function CompeticioClient({
    torneoID,
    edicionID,
}: Props) {
    const [
        dades,
        setDades,
    ] =
        useState<
            DadesCompeticio | null
        >(
            null,
        );

    const [
        carregant,
        setCarregant,
    ] =
        useState(
            true,
        );

    const [
        canviant,
        setCanviant,
    ] =
        useState(
            false,
        );

    const [
        error,
        setError,
    ] =
        useState(
            "",
        );

    // ========================================================
    // CARGAR
    // ========================================================

    const carregar =
        useCallback(
            async (
                grupID?:
                    string,
            ) => {
                if (
                    dades
                ) {
                    setCanviant(
                        true,
                    );
                } else {
                    setCarregant(
                        true,
                    );
                }

                setError(
                    "",
                );

                try {
                    const params =
                        new URLSearchParams({
                            torneoID,
                            edicionID,
                        });

                    if (
                        grupID
                    ) {
                        params.set(
                            "grupoID",
                            grupID,
                        );
                    }

                    const resposta =
                        await fetch(
                            `/api/torneos/competicio?${params.toString()}`,
                            {
                                method:
                                    "GET",

                                cache:
                                    "no-store",

                                headers: {
                                    Accept:
                                        "application/json",
                                },
                            },
                        );

                    const json =
                        (
                            await resposta
                                .json()
                        ) as RespostaAPI;

                    if (
                        !resposta.ok ||
                        !json.data
                    ) {
                        throw new Error(
                            json.mensaje ??
                                "No s'ha pogut carregar la competició.",
                        );
                    }

                    setDades(
                        json.data,
                    );
                } catch (
                    error
                ) {
                    console.error(
                        error,
                    );

                    setError(
                        error instanceof Error
                            ? error.message
                            : "No s'ha pogut carregar la competició.",
                    );
                } finally {
                    setCarregant(
                        false,
                    );

                    setCanviant(
                        false,
                    );
                }
            },
            [
                torneoID,
                edicionID,
                dades,
            ],
        );

    // ========================================================
    // CARGA INICIAL
    // ========================================================

    useEffect(
        () => {
            void carregar();
        },
        // Solo queremos ejecutar al montar/cambiar edición.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            torneoID,
            edicionID,
        ],
    );

    // ========================================================
    // CARGANDO
    // ========================================================

    if (
        carregant &&
        !dades
    ) {
        return (
            <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
                <div className="flex min-h-72 items-center justify-center rounded-2xl border border-border bg-card">
                    <div className="text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />

                        <p className="mt-3 text-sm text-neutral">
                            Carregant
                            competició...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // ERROR INICIAL
    // ========================================================

    if (
        !dades
    ) {
        return (
            <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
                    <h3 className="font-semibold text-neutral-titulos">
                        No s'ha pogut
                        carregar la
                        competició
                    </h3>

                    <p className="mt-2 text-sm text-neutral">
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            void carregar()
                        }
                        className="mt-5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                    >
                        Tornar-ho a
                        intentar
                    </button>
                </div>
            </div>
        );
    }

    // ========================================================
    // SIN GRUPOS
    // ========================================================

    if (
        !dades.grupo ||
        dades.grupos.length ===
            0
    ) {
        return (
            <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
                <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
                    <p className="font-semibold text-neutral-titulos">
                        Encara no hi ha
                        grups configurats.
                    </p>
                </div>
            </div>
        );
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <div className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
            {/* ================================================
                SELECTOR DE GRUPO
            ================================================= */}

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-neutral">
                        {
                            dades.grupo
                                .faseNombre
                        }
                    </p>

                    <h3 className="mt-1 text-2xl font-bold text-neutral-titulos">
                        {
                            dades.grupo
                                .nombre
                        }
                    </h3>

                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-neutral">
                            {nomEstat(
                                dades
                                    .grupo
                                    .estado,
                            )}
                        </span>

                        {dades
                            .tieneClasificacion && (
                            <>
                                <span className="text-neutral">
                                    ·
                                </span>

                                <span className="text-sm text-neutral">
                                    Classificació
                                    actualitzada
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <SelectorGrup
                    grups={
                        dades.grupos
                    }
                    valor={
                        dades.grupo.id
                    }
                    desactivat={
                        canviant
                    }
                    onCanvi={grupID =>
                        void carregar(
                            grupID,
                        )
                    }
                />
            </div>

            {/* ================================================
                ERROR AL CAMBIAR
            ================================================= */}

            {error && (
                <div className="mb-5 rounded-xl border border-error/30 bg-error-container p-4 text-sm text-error">
                    {error}
                </div>
            )}

            {/* ================================================
                CONTENIDO
            ================================================= */}

            <div
                className={[
                    "transition-opacity duration-150",
                    canviant
                        ? "pointer-events-none opacity-45"
                        : "opacity-100",
                ].join(
                    " ",
                )}
            >
                {/* ============================================
                    ARRIBA
                ============================================= */}

                <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    {/* IZQUIERDA */}

                    <ClassificacioResum
                        grupNom={
                            dades.grupo
                                .nombre
                        }
                        files={
                            dades.clasificacion
                        }
                        teClassificacio={
                            dades.tieneClasificacion
                        }
                    />

                    {/* DERECHA */}

                    <JornadaActual
                        jornada={
                            dades.jornadaReferencia
                        }
                    />
                </div>

                {/* ============================================
                    CLASIFICACIÓN COMPLETA
                ============================================= */}

                <ClassificacioCompleta
                    grupNom={
                        dades.grupo
                            .nombre
                    }
                    files={
                        dades.clasificacion
                    }
                    esFutbol={
                        dades.esFutbol
                    }
                    etiquetaFavor={
                        dades.etiquetas
                            .favor
                    }
                    etiquetaContra={
                        dades.etiquetas
                            .contra
                    }
                    teClassificacio={
                        dades.tieneClasificacion
                    }
                />

                {/* ============================================
                    PRÓXIMA JORNADA
                ============================================= */}

                <ProximaJornada
                    jornada={
                        dades.proximaJornada
                    }
                />
            </div>
        </div>
    );
}