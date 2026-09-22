import Cargando from "@components/Cargando";

import {
    useEffect,
    useMemo,
    useState,
} from "react";

// ============================================================
// TIPOS
// ============================================================

type EstadoFormulario =
    | "BORRADOR"
    | "EN_REVISION"
    | "APROBADO"
    | "DENEGADO";

type EstadoPlaza =
    | "PENDIENTE"
    | "CONFIRMADA"
    | "LISTA_ESPERA"
    | "SIN_PLAZA";

type Torneo = {
    id: string;
    nombre: string;
    deporte: string | null;
};

type Edicion = {
    id: string;
    torneo_id: string | null;
    nombre: string;
    estado: string | null;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
};

type Responsable = {
    id: string | null;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    nombre_completo: string;
    email: string | null;
};

type Capitan = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    nombre_completo: string;
    email: string | null;
    curso: string | null;
    grupo: string | null;
};

type ParticipantesResumen = {
    total: number;
    jugadores: number;
    profesores: number;
    entrenadores: number;
    staff: number;
    capitan: Capitan | null;
};

type Formulario = {
    id: string;
    estado: EstadoFormulario;
    usuario_id: string | null;
    email_contacto: string;
    acceso_capitan: boolean;
    iniciado_at: string | null;
    enviado_at: string | null;
    completado_at: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type CapacidadesFila = {
    editar: boolean;
    evaluar: boolean;
    cambiarEstado: boolean;
    eliminar: boolean;
};

type Equipo = {
    id: string | null;
    formulario_id: string;
    nombre: string;
    escudo: string | null;
    validacion_estado: string;
    plaza_estado: EstadoPlaza;
    posicion_lista_espera: number | null;
    nota_admin: string | null;
    created_at: string | null;
    updated_at: string | null;
    formulario: Formulario;
    responsable: Responsable | null;
    participantes: ParticipantesResumen;
    capacidades: CapacidadesFila;
};

type Resumen = {
    total: number;
    borradores: number;
    enRevision: number;
    aprobadas: number;
    denegadas: number;
    participantes: number;

    plazas: {
        confirmadas: number;
        listaEspera: number;
        sinPlaza: number;
        pendientes: number;
    };
};

type Capacidades = {
    crear: boolean;
    editar: boolean;
    evaluar: boolean;
    cambiarEstado: boolean;
    eliminar: boolean;
};

type RespuestaAPI = {
    success: true;
    torneo: Torneo;
    edicion: Edicion;
    resumen: Resumen;
    filas: Equipo[];
    capacidades: Capacidades;
};

type FiltroEstado =
    | "TODOS"
    | "EN_REVISION"
    | "APROBADO"
    | "DENEGADO";

type FiltroPlaza =
    | "TODAS"
    | EstadoPlaza;

// ============================================================
// HELPERS
// ============================================================

function textoEstadoFormulario(
    estado: EstadoFormulario,
) {
    switch (estado) {
        case "EN_REVISION":
            return "En revisió";

        case "APROBADO":
            return "Aprovada";

        case "DENEGADO":
            return "Requereix canvis";

        default:
            return "Esborrany";
    }
}

function claseEstadoFormulario(
    estado: EstadoFormulario,
) {
    switch (estado) {
        case "EN_REVISION":
            return "bg-secondary/10 text-secondary";

        case "APROBADO":
            return "bg-primary/10 text-primary";

        case "DENEGADO":
            return "bg-error/10 text-error";

        default:
            return "bg-muted text-neutral";
    }
}

function textoEstadoPlaza(
    estado: EstadoPlaza,
) {
    switch (estado) {
        case "CONFIRMADA":
            return "Confirmada";

        case "LISTA_ESPERA":
            return "Llista d'espera";

        case "SIN_PLAZA":
            return "Sense plaça";

        default:
            return "Pendent";
    }
}

function claseEstadoPlaza(
    estado: EstadoPlaza,
) {
    switch (estado) {
        case "CONFIRMADA":
            return "bg-primary/10 text-primary";

        case "LISTA_ESPERA":
            return "bg-secondary/10 text-secondary";

        case "SIN_PLAZA":
            return "bg-error/10 text-error";

        default:
            return "bg-muted text-neutral";
    }
}

function mostrarFecha(
    valor: string | null,
) {
    if (!valor) {
        return "—";
    }

    const fecha =
        new Date(
            valor,
        );

    if (
        Number.isNaN(
            fecha.getTime(),
        )
    ) {
        return "—";
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
    ).format(
        fecha,
    );
}

function nombreResponsable(
    equipo: Equipo,
) {
    const nombre =
        equipo.responsable
            ?.nombre_completo
            ?.trim();

    if (nombre) {
        return nombre;
    }

    return (
        equipo.responsable
            ?.email ??
        equipo.formulario
            .email_contacto ??
        "Sense responsable"
    );
}

function textoCapitan(
    equipo: Equipo,
) {
    const capitan =
        equipo.participantes
            .capitan;

    if (!capitan) {
        return "Sense capità";
    }

    return (
        capitan.nombre_completo ||
        capitan.email ||
        "Capità"
    );
}

function normalizarBusqueda(
    valor: string,
) {
    return valor
        .trim()
        .toLocaleLowerCase(
            "ca-ES",
        );
}

function enlaceEquipo(
    equipoID: string,
    torneoID: string,
    edicionID: string,
) {
    const parametros =
        new URLSearchParams({
            torneoID,
            edicionID,
        });

    return `/panell/equips/${encodeURIComponent(equipoID)}?${parametros.toString()}`;
}

function enlaceCrear(
    torneoID: string,
    edicionID: string,
) {
    const parametros =
        new URLSearchParams({
            torneoID,
            edicionID,
        });

    return `/panell/equips/nou?${parametros.toString()}`;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Lista({
    torneoID,
    edicionID,
}: {
    torneoID: string;
    edicionID: string;
}) {
    const [
        cargando,
        setCargando,
    ] =
        useState(true);

    const [
        error,
        setError,
    ] =
        useState("");

    const [
        torneo,
        setTorneo,
    ] =
        useState<Torneo | null>(
            null,
        );

    const [
        edicion,
        setEdicion,
    ] =
        useState<Edicion | null>(
            null,
        );

    const [
        equipos,
        setEquipos,
    ] =
        useState<Equipo[]>([]);

    const [
        capacidades,
        setCapacidades,
    ] =
        useState<Capacidades | null>(
            null,
        );

    const [
        busqueda,
        setBusqueda,
    ] =
        useState("");

    const [
        filtroEstado,
        setFiltroEstado,
    ] =
        useState<FiltroEstado>(
            "TODOS",
        );

    const [
        filtroPlaza,
        setFiltroPlaza,
    ] =
        useState<FiltroPlaza>(
            "TODAS",
        );

    const [
        viendoBorradores,
        setViendoBorradores,
    ] =
        useState(false);

    // ========================================================
    // CARGA
    // ========================================================

    useEffect(() => {
        const controlador =
            new AbortController();

        async function cargar() {
            setCargando(true);
            setError("");

            try {
                const parametros =
                    new URLSearchParams({
                        torneoID,
                        edicionID,
                    });

                const respuesta =
                    await fetch(
                        `/api/panell/equips?${parametros.toString()}`,
                        {
                            credentials:
                                "same-origin",

                            cache:
                                "no-store",

                            signal:
                                controlador.signal,
                        },
                    );

                const json:
                    unknown =
                    await respuesta
                        .json()
                        .catch(
                            () =>
                                null,
                        );

                if (
                    !respuesta.ok ||
                    !json ||
                    typeof json !==
                        "object" ||
                    !(
                        "success"
                        in json
                    ) ||
                    json.success !==
                        true
                ) {
                    const mensaje =
                        json &&
                        typeof json ===
                            "object" &&
                        "mensaje"
                            in json &&
                        typeof json.mensaje ===
                            "string"
                            ? json.mensaje
                            : "No s'han pogut carregar els equips.";

                    throw new Error(
                        mensaje,
                    );
                }

                const datos =
                    json as RespuestaAPI;

                setTorneo(
                    datos.torneo,
                );

                setEdicion(
                    datos.edicion,
                );

                setEquipos(
                    datos.filas ??
                    [],
                );

                setCapacidades(
                    datos.capacidades,
                );
            } catch (
                error
            ) {
                if (
                    controlador.signal
                        .aborted
                ) {
                    return;
                }

                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "No s'han pogut carregar els equips.",
                );
            } finally {
                if (
                    !controlador.signal
                        .aborted
                ) {
                    setCargando(
                        false,
                    );
                }
            }
        }

        void cargar();

        return () => {
            controlador.abort();
        };
    }, [
        torneoID,
        edicionID,
    ]);

    // ========================================================
    // SEPARACIÓN DE BORRADORES
    // ========================================================

    const borradores =
        useMemo(
            () =>
                equipos.filter(
                    equipo =>
                        equipo
                            .formulario
                            .estado ===
                        "BORRADOR",
                ),
            [
                equipos,
            ],
        );

    const inscripcionesEnviadas =
        useMemo(
            () =>
                equipos.filter(
                    equipo =>
                        equipo
                            .formulario
                            .estado !==
                        "BORRADOR",
                ),
            [
                equipos,
            ],
        );

    // ========================================================
    // RESUMEN
    // ========================================================

    const resumen =
        useMemo(
            () => ({
                total:
                    inscripcionesEnviadas.length,

                participantes:
                    inscripcionesEnviadas.reduce(
                        (
                            total,
                            equipo,
                        ) =>
                            total +
                            equipo
                                .participantes
                                .total,
                        0,
                    ),

                enRevision:
                    inscripcionesEnviadas.filter(
                        equipo =>
                            equipo
                                .formulario
                                .estado ===
                            "EN_REVISION",
                    ).length,

                aprobadas:
                    inscripcionesEnviadas.filter(
                        equipo =>
                            equipo
                                .formulario
                                .estado ===
                            "APROBADO",
                    ).length,

                denegadas:
                    inscripcionesEnviadas.filter(
                        equipo =>
                            equipo
                                .formulario
                                .estado ===
                            "DENEGADO",
                    ).length,

                listaEspera:
                    inscripcionesEnviadas.filter(
                        equipo =>
                            equipo
                                .plaza_estado ===
                            "LISTA_ESPERA",
                    ).length,
            }),
            [
                inscripcionesEnviadas,
            ],
        );

    // ========================================================
    // BASE DE LA VISTA
    // ========================================================

    const equiposBase =
        viendoBorradores
            ? borradores
            : inscripcionesEnviadas;

    // ========================================================
    // FILTROS
    // ========================================================

    const equiposFiltrados =
        useMemo(
            () => {
                const consulta =
                    normalizarBusqueda(
                        busqueda,
                    );

                return equiposBase.filter(
                    equipo => {
                        if (
                            !viendoBorradores &&
                            filtroEstado !==
                                "TODOS" &&
                            equipo.formulario
                                .estado !==
                                filtroEstado
                        ) {
                            return false;
                        }

                        if (
                            filtroPlaza !==
                                "TODAS" &&
                            equipo.plaza_estado !==
                                filtroPlaza
                        ) {
                            return false;
                        }

                        if (!consulta) {
                            return true;
                        }

                        const capitan =
                            equipo.participantes
                                .capitan;

                        const texto = [
                            equipo.nombre,
                            equipo.formulario
                                .email_contacto,
                            equipo.responsable
                                ?.nombre_completo,
                            equipo.responsable
                                ?.email,
                            capitan
                                ?.nombre_completo,
                            capitan
                                ?.email,
                        ]
                            .filter(
                                Boolean,
                            )
                            .join(" ")
                            .toLocaleLowerCase(
                                "ca-ES",
                            );

                        return texto.includes(
                            consulta,
                        );
                    },
                );
            },
            [
                equiposBase,
                busqueda,
                filtroEstado,
                filtroPlaza,
                viendoBorradores,
            ],
        );

    // ========================================================
    // CAMBIO VISTA BORRADORES
    // ========================================================

    function cambiarVistaBorradores() {
        setViendoBorradores(
            valor =>
                !valor,
        );

        setBusqueda("");
        setFiltroEstado("TODOS");
        setFiltroPlaza("TODAS");
    }

    // ========================================================
    // CARGANDO
    // ========================================================

    if (cargando) {
        return (
            <div className="flex min-h-80 w-full items-center justify-center p-6">
                <Cargando />
            </div>
        );
    }

    // ========================================================
    // ERROR
    // ========================================================

    if (error) {
        return (
            <div className="w-full p-4">
                <div role="alert" className="rounded-xl border border-error/30 bg-error/10 p-5 text-error">
                    <p className="font-semibold">
                        No s'han pogut carregar els equips
                    </p>

                    <p className="mt-1 text-sm">
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <div className="w-full px-4 pb-8">

            {/* =================================================
                CABECERA
            ================================================= */}

            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral">
                    {torneo && (
                        <span className="font-semibold text-neutral-titulos">
                            {torneo.nombre}
                        </span>
                    )}

                    {torneo && edicion && (
                        <span className="text-neutral/50">
                            /
                        </span>
                    )}

                    {edicion && (
                        <span>
                            {edicion.nombre}
                        </span>
                    )}

                    {edicion?.sede && (
                        <>
                            <span className="text-neutral/50">
                                ·
                            </span>

                            <span>
                                {edicion.sede}
                            </span>
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-2">

                    {/* CREAR EQUIPO */}

                    {capacidades?.crear && (
                        <a href={enlaceCrear(torneoID, edicionID)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                            </svg>

                            Crear equip
                        </a>
                    )}

                    {/* BORRADORES */}

                    {borradores.length > 0 && (
                        <button type="button" onClick={cambiarVistaBorradores} className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${viendoBorradores ? "border-secondary bg-secondary/10 text-secondary hover:bg-secondary/15" : "border-border bg-card text-neutral-titulos hover:border-primary/30 hover:bg-primary/5 hover:text-primary"}`}>
                            {viendoBorradores ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                                    </svg>

                                    Tornar a inscripcions
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                        <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h447l193 193v447q0 33-23.5 56.5T760-120H200Zm280-80q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Z" />
                                    </svg>

                                    Veure esborranys

                                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-neutral-titulos">
                                        {borradores.length}
                                    </span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* =================================================
                MODO BORRADORES
            ================================================= */}

            {viendoBorradores && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-secondary/25 bg-secondary/5 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h447l193 193v447q0 33-23.5 56.5T760-120H200Zm280-80q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Z" />
                        </svg>
                    </span>

                    <div>
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Estàs consultant els esborranys
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            Aquests equips encara no s'han enviat o han estat creats administrativament com a esborrany. No es comptabilitzen com a inscripcions.
                        </p>
                    </div>
                </div>
            )}

            {/* =================================================
                RESUMEN
            ================================================= */}

            {!viendoBorradores && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs font-medium text-neutral">
                            Equips inscrits
                        </p>

                        <p className="mt-1 text-2xl font-bold text-neutral-titulos">
                            {resumen.total}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs font-medium text-neutral">
                            Participants
                        </p>

                        <p className="mt-1 text-2xl font-bold text-neutral-titulos">
                            {resumen.participantes}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs font-medium text-neutral">
                            En revisió
                        </p>

                        <p className="mt-1 text-2xl font-bold text-secondary">
                            {resumen.enRevision}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs font-medium text-neutral">
                            Aprovades
                        </p>

                        <p className="mt-1 text-2xl font-bold text-primary">
                            {resumen.aprobadas}
                        </p>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-xs font-medium text-neutral">
                            Requereixen canvis
                        </p>

                        <p className="mt-1 text-2xl font-bold text-error">
                            {resumen.denegadas}
                        </p>
                    </div>
                </div>
            )}

            {/* =================================================
                FILTROS
            ================================================= */}

            {equiposBase.length > 0 && (
                <div className={`${viendoBorradores ? "mt-0" : "mt-6"} rounded-xl border border-border bg-card p-4`}>
                    <div className={`grid grid-cols-1 gap-3 ${viendoBorradores ? "lg:grid-cols-[minmax(0,1fr)_220px]" : "lg:grid-cols-[minmax(0,1fr)_220px_220px]"}`}>
                        <div className="relative">
                            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-neutral/50">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                    <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z" />
                                </svg>
                            </span>

                            <input type="search" value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} placeholder="Cerca per equip, responsable, capità o correu..." className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10" />
                        </div>

                        {!viendoBorradores && (
                            <select value={filtroEstado} onChange={(evento) => setFiltroEstado(evento.target.value as FiltroEstado)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                                <option value="TODOS">
                                    Tots els estats
                                </option>

                                <option value="EN_REVISION">
                                    En revisió
                                </option>

                                <option value="APROBADO">
                                    Aprovades
                                </option>

                                <option value="DENEGADO">
                                    Requereixen canvis
                                </option>
                            </select>
                        )}

                        <select value={filtroPlaza} onChange={(evento) => setFiltroPlaza(evento.target.value as FiltroPlaza)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                            <option value="TODAS">
                                Totes les places
                            </option>

                            <option value="PENDIENTE">
                                Pendent
                            </option>

                            <option value="CONFIRMADA">
                                Confirmada
                            </option>

                            <option value="LISTA_ESPERA">
                                Llista d'espera
                            </option>

                            <option value="SIN_PLAZA">
                                Sense plaça
                            </option>
                        </select>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral">
                        <p>
                            {equiposFiltrados.length} de {equiposBase.length} {viendoBorradores ? "esborranys" : "equips"}
                        </p>

                        {(busqueda || filtroEstado !== "TODOS" || filtroPlaza !== "TODAS") && (
                            <button type="button" onClick={() => {
                                setBusqueda("");
                                setFiltroEstado("TODOS");
                                setFiltroPlaza("TODAS");
                            }} className="font-semibold text-primary transition hover:opacity-80">
                                Netejar filtres
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* =================================================
                SIN INSCRIPCIONES
            ================================================= */}

            {!viendoBorradores && inscripcionesEnviadas.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-card/40 px-6 py-14 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-7 w-7 fill-current" aria-hidden="true">
                            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm80-160h280v-80H280v80Zm0-160h400v-80H280v80Zm0-160h400v-80H280v80Z" />
                        </svg>
                    </span>

                    <h2 className="mt-4 text-lg font-semibold text-neutral-titulos">
                        Encara no hi ha inscripcions enviades
                    </h2>

                    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral">
                        Els formularis en esborrany no apareixen en aquesta llista ni es comptabilitzen com a equips inscrits.
                    </p>

                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                        {capacidades?.crear && (
                            <a href={enlaceCrear(torneoID, edicionID)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                    <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                                </svg>

                                Crear equip
                            </a>
                        )}

                        {borradores.length > 0 && (
                            <button type="button" onClick={cambiarVistaBorradores} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                                Veure els esborranys

                                <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold">
                                    {borradores.length}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* =================================================
                SIN RESULTADOS
            ================================================= */}

            {equiposBase.length > 0 && equiposFiltrados.length === 0 && (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        No hi ha resultats
                    </h2>

                    <p className="mt-2 text-sm text-neutral">
                        Cap equip coincideix amb els filtres seleccionats.
                    </p>
                </div>
            )}

            {/* =================================================
                TABLA
            ================================================= */}

            {equiposFiltrados.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
                    {viendoBorradores && (
                        <div className="border-b border-secondary/20 bg-secondary/5 px-4 py-3">
                            <p className="text-xs font-semibold text-secondary">
                                Esborranys · encara no enviats
                            </p>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1180px] border-collapse text-left">
                            <thead className="border-b border-border bg-background">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Equip
                                    </th>

                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Responsable
                                    </th>

                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Capità
                                    </th>

                                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Participants
                                    </th>

                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Inscripció
                                    </th>

                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Plaça
                                    </th>

                                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Actualització
                                    </th>

                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral">
                                        Accions
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-border">
                                {equiposFiltrados.map((equipo) => {
                                    const enlace =
                                        equipo.id
                                            ? enlaceEquipo(
                                                  equipo.id,
                                                  torneoID,
                                                  edicionID,
                                              )
                                            : null;

                                    return (
                                        <tr key={equipo.formulario_id} className="transition hover:bg-background/70">
                                            <td className="px-4 py-4 align-middle">
                                                {enlace ? (
                                                    <a href={enlace} className="group flex min-w-[220px] items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                                        {equipo.escudo ? (
                                                            <img src={equipo.escudo} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border bg-white object-contain p-1 transition group-hover:border-primary/40" />
                                                        ) : (
                                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                                                    <path d="M400-80v-80h160v80H400ZM160-200v-80h640v80H160Zm80-120v-480h480v480H240Zm80-80h320v-320H320v320Z" />
                                                                </svg>
                                                            </span>
                                                        )}

                                                        <div className="min-w-0">
                                                            <p className="max-w-[220px] truncate font-semibold text-neutral-titulos transition group-hover:text-primary">
                                                                {equipo.nombre || "Equip sense nom"}
                                                            </p>

                                                            {equipo.validacion_estado !== "PENDIENTE" && (
                                                                <p className="mt-0.5 text-xs text-neutral">
                                                                    Validació: {equipo.validacion_estado}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </a>
                                                ) : (
                                                    <span className="text-sm text-neutral">
                                                        Equip incomplet
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-4 py-4 align-middle">
                                                <div className="max-w-[220px]">
                                                    <p className="truncate text-sm font-medium text-neutral-titulos">
                                                        {nombreResponsable(equipo)}
                                                    </p>

                                                    {equipo.responsable?.email && equipo.responsable.nombre_completo && (
                                                        <p className="mt-0.5 truncate text-xs text-neutral">
                                                            {equipo.responsable.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 align-middle">
                                                <div className="max-w-[220px]">
                                                    <p className="truncate text-sm font-medium text-neutral-titulos">
                                                        {textoCapitan(equipo)}
                                                    </p>

                                                    {equipo.participantes.capitan?.email && (
                                                        <p className="mt-0.5 truncate text-xs text-neutral">
                                                            {equipo.participantes.capitan.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 text-center align-middle">
                                                <div className="inline-flex min-w-[52px] flex-col items-center rounded-lg bg-background px-3 py-2">
                                                    <span className="text-lg font-bold text-neutral-titulos">
                                                        {equipo.participantes.total}
                                                    </span>

                                                    <span className="text-[10px] uppercase tracking-wide text-neutral">
                                                        total
                                                    </span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-4 align-middle">
                                                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${claseEstadoFormulario(equipo.formulario.estado)}`}>
                                                    {textoEstadoFormulario(equipo.formulario.estado)}
                                                </span>

                                                {equipo.formulario.estado === "EN_REVISION" && equipo.formulario.enviado_at && (
                                                    <p className="mt-1.5 whitespace-nowrap text-[11px] text-neutral">
                                                        {mostrarFecha(equipo.formulario.enviado_at)}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="px-4 py-4 align-middle">
                                                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${claseEstadoPlaza(equipo.plaza_estado)}`}>
                                                    {textoEstadoPlaza(equipo.plaza_estado)}
                                                </span>

                                                {equipo.plaza_estado === "LISTA_ESPERA" && equipo.posicion_lista_espera !== null && (
                                                    <p className="mt-1.5 text-[11px] text-neutral">
                                                        Posició {equipo.posicion_lista_espera}
                                                    </p>
                                                )}
                                            </td>

                                            <td className="whitespace-nowrap px-4 py-4 text-xs text-neutral">
                                                {mostrarFecha(
                                                    equipo.updated_at ??
                                                    equipo.formulario.updated_at,
                                                )}
                                            </td>

                                            <td className="px-4 py-4 text-right align-middle">
                                                {enlace ? (
                                                    <a href={enlace} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                                                        Veure fitxa

                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                                            <path d="m647-440-224 224 57 56 320-320-320-320-57 56 224 224H160v80h487Z" />
                                                        </svg>
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-neutral/50">
                                                        No disponible
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* =================================================
                PENDIENTES
            ================================================= */}

            {!viendoBorradores && capacidades?.evaluar && resumen.enRevision > 0 && (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-secondary/20 bg-secondary/5 p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M360-200v-80h400v80H360Zm0-160v-80h400v80H360Zm0-160v-80h400v80H360ZM200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z" />
                        </svg>
                    </span>

                    <div>
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Hi ha inscripcions pendents de revisió
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            Tens {resumen.enRevision} {resumen.enRevision === 1 ? "equip pendent" : "equips pendents"} d'avaluar.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}