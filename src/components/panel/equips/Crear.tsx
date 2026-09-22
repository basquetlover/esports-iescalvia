import Cargando from "@components/Cargando";

import {
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
    type FormEvent,
} from "react";

// ============================================================
// TIPOS
// ============================================================

type TipoParticipante =
    | "JUGADOR"
    | "PROFESOR"
    | "ENTRENADOR"
    | "STAFF";

type Genero =
    | "masculino"
    | "femenino";

type EstadoPlaza =
    | "PENDIENTE"
    | "CONFIRMADA"
    | "LISTA_ESPERA"
    | "SIN_PLAZA";

type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

type ConfiguracionEquipos = {
    inscripcion: {
        apertura: string | null;
        cierre: string | null;
    };

    cupo: {
        maximo: number | null;

        al_superar:
            | "permitir"
            | "lista_espera"
            | "bloquear";
    };

    cursos:
        CursoConfiguracion[];

    jugadores: {
        minimo: number | null;
        maximo: number | null;
    };

    genero: {
        activo: boolean;

        minimos: {
            masculino: number;
            femenino: number;
        };
    };

    profesores: {
        permitidos: boolean;
        minimo: number;
        maximo: number;
        cuentan_como_jugador: boolean;
    };

    entrenador: {
        permitido: boolean;
    };

    staff: {
        permitido: boolean;
        minimo: number;
        maximo: number;
    };
};

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

type Capacidades = {
    crear: boolean;
    cambiarEstado: boolean;
};

type RespuestaPreparacion = {
    success: true;
    torneo: Torneo;
    edicion: Edicion;
    configuracion: ConfiguracionEquipos;
    capacidades: Capacidades;
};

type ParticipanteFormulario = {
    clave: string;
    tipo_participante: TipoParticipante;
    nombre: string;
    apellido1: string;
    apellido2: string;
    email: string;
    curso: string;
    grupo: string;
    genero: Genero | "";
};

type EstadoFormulario = {
    nombreEquipo: string;
    escudo: string | null;
    responsableEmail: string;
    vincularResponsable: boolean;
    accesoCapitan: boolean;
    notaAdmin: string;
    plazaEstado: EstadoPlaza;
    posicionListaEspera: string;
};

type EstadoEnvio =
    | "BORRADOR"
    | "APROBADO";

type RespuestaCreacion = {
    success: true;
    mensaje: string;
    redireccion: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const MAX_IMAGEN_BYTES =
    2_000_000;

const TIPOS_IMAGEN =
    new Set([
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/svg+xml",
    ]);

// ============================================================
// HELPERS
// ============================================================

function nuevaClave() {
    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()}`;
}

function participanteVacio(
    tipo:
        TipoParticipante =
        "JUGADOR",
): ParticipanteFormulario {
    return {
        clave:
            nuevaClave(),

        tipo_participante:
            tipo,

        nombre:
            "",

        apellido1:
            "",

        apellido2:
            "",

        email:
            "",

        curso:
            "",

        grupo:
            "",

        genero:
            "",
    };
}

function nombreTipo(
    tipo:
        TipoParticipante,
) {
    switch (tipo) {
        case "PROFESOR":
            return "Professor/a";

        case "ENTRENADOR":
            return "Entrenador/a";

        case "STAFF":
            return "Staff";

        default:
            return "Jugador/a";
    }
}

function participanteComputable(
    participante:
        ParticipanteFormulario,
    configuracion:
        ConfiguracionEquipos,
) {
    if (
        participante
            .tipo_participante ===
        "JUGADOR"
    ) {
        return true;
    }

    return (
        participante
            .tipo_participante ===
            "PROFESOR" &&
        configuracion
            .profesores
            .cuentan_como_jugador
    );
}

function opcionesTipo(
    configuracion:
        ConfiguracionEquipos,
) {
    const opciones: {
        valor:
            TipoParticipante;

        nombre:
            string;
    }[] = [
        {
            valor:
                "JUGADOR",

            nombre:
                "Jugador/a",
        },
    ];

    if (
        configuracion
            .profesores
            .permitidos
    ) {
        opciones.push({
            valor:
                "PROFESOR",

            nombre:
                "Professor/a",
        });
    }

    if (
        configuracion
            .entrenador
            .permitido
    ) {
        opciones.push({
            valor:
                "ENTRENADOR",

            nombre:
                "Entrenador/a",
        });
    }

    if (
        configuracion
            .staff
            .permitido
    ) {
        opciones.push({
            valor:
                "STAFF",

            nombre:
                "Staff",
        });
    }

    return opciones;
}

function necesitaCurso(
    tipo:
        TipoParticipante,
) {
    return (
        tipo ===
            "JUGADOR" ||
        tipo ===
            "PROFESOR"
    );
}

function leerImagen(
    archivo: File,
): Promise<string> {
    return new Promise(
        (
            resolver,
            rechazar,
        ) => {
            const lector =
                new FileReader();

            lector.onload =
                () => {
                    if (
                        typeof lector.result !==
                        "string"
                    ) {
                        rechazar(
                            new Error(
                                "No s'ha pogut llegir la imatge.",
                            ),
                        );

                        return;
                    }

                    resolver(
                        lector.result,
                    );
                };

            lector.onerror =
                () => {
                    rechazar(
                        new Error(
                            "No s'ha pogut llegir la imatge.",
                        ),
                    );
                };

            lector.readAsDataURL(
                archivo,
            );
        },
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Crear({
    torneoID,
    edicionID,
    volver,
}: {
    torneoID: string;
    edicionID: string;
    volver: string;
}) {
    const [
        cargando,
        setCargando,
    ] =
        useState(true);

    const [
        guardando,
        setGuardando,
    ] =
        useState(false);

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
        configuracion,
        setConfiguracion,
    ] =
        useState<ConfiguracionEquipos | null>(
            null,
        );

    const [
        capacidades,
        setCapacidades,
    ] =
        useState<Capacidades | null>(
            null,
        );

    const [
        formulario,
        setFormulario,
    ] =
        useState<EstadoFormulario>({
            nombreEquipo:
                "",

            escudo:
                null,

            responsableEmail:
                "",

            vincularResponsable:
                false,

            accesoCapitan:
                false,

            notaAdmin:
                "",

            plazaEstado:
                "PENDIENTE",

            posicionListaEspera:
                "",
        });

    const [
        participantes,
        setParticipantes,
    ] =
        useState<
            ParticipanteFormulario[]
        >([
            participanteVacio(
                "JUGADOR",
            ),
        ]);

    const [
        capitanClave,
        setCapitanClave,
    ] =
        useState("");

    const [
        estadoEnvio,
        setEstadoEnvio,
    ] =
        useState<EstadoEnvio | null>(
            null,
        );

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
                        vista:
                            "crear",
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
                            : "No s'ha pogut preparar la creació de l'equip.";

                    throw new Error(
                        mensaje,
                    );
                }

                const datos =
                    json as RespuestaPreparacion;

                setTorneo(
                    datos.torneo,
                );

                setEdicion(
                    datos.edicion,
                );

                setConfiguracion(
                    datos.configuracion,
                );

                setCapacidades(
                    datos.capacidades,
                );
            } catch (
                error
            ) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "No s'ha pogut preparar la creació de l'equip.",
                );
            } finally {
                if (
                    !controlador
                        .signal
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
    // DATOS DERIVADOS
    // ========================================================

    const tiposDisponibles =
        useMemo(
            () =>
                configuracion
                    ? opcionesTipo(
                          configuracion,
                      )
                    : [],
            [
                configuracion,
            ],
        );

    const jugadores =
        useMemo(
            () =>
                participantes.filter(
                    participante =>
                        participante
                            .tipo_participante ===
                        "JUGADOR",
                ),
            [
                participantes,
            ],
        );

    const capitan =
        useMemo(
            () =>
                participantes.find(
                    participante =>
                        participante.clave ===
                        capitanClave,
                ) ??
                null,
            [
                participantes,
                capitanClave,
            ],
        );

    const resumenParticipantes =
        useMemo(
            () => {
                if (
                    !configuracion
                ) {
                    return {
                        jugadores:
                            0,

                        profesores:
                            0,

                        entrenadores:
                            0,

                        staff:
                            0,

                        computables:
                            0,

                        masculino:
                            0,

                        femenino:
                            0,
                    };
                }

                return {
                    jugadores:
                        participantes.filter(
                            participante =>
                                participante
                                    .tipo_participante ===
                                "JUGADOR",
                        ).length,

                    profesores:
                        participantes.filter(
                            participante =>
                                participante
                                    .tipo_participante ===
                                "PROFESOR",
                        ).length,

                    entrenadores:
                        participantes.filter(
                            participante =>
                                participante
                                    .tipo_participante ===
                                "ENTRENADOR",
                        ).length,

                    staff:
                        participantes.filter(
                            participante =>
                                participante
                                    .tipo_participante ===
                                "STAFF",
                        ).length,

                    computables:
                        participantes.filter(
                            participante =>
                                participanteComputable(
                                    participante,
                                    configuracion,
                                ),
                        ).length,

                    masculino:
                        participantes.filter(
                            participante =>
                                participanteComputable(
                                    participante,
                                    configuracion,
                                ) &&
                                participante.genero ===
                                    "masculino",
                        ).length,

                    femenino:
                        participantes.filter(
                            participante =>
                                participanteComputable(
                                    participante,
                                    configuracion,
                                ) &&
                                participante.genero ===
                                    "femenino",
                        ).length,
                };
            },
            [
                participantes,
                configuracion,
            ],
        );

    // ========================================================
    // PARTICIPANTES
    // ========================================================

    function actualizarParticipante(
        clave: string,
        campo:
            keyof Omit<
                ParticipanteFormulario,
                "clave"
            >,
        valor: string,
    ) {
        setParticipantes(
            actuales =>
                actuales.map(
                    participante => {
                        if (
                            participante.clave !==
                            clave
                        ) {
                            return participante;
                        }

                        if (
                            campo ===
                            "tipo_participante"
                        ) {
                            const tipo =
                                valor as TipoParticipante;

                            return {
                                ...participante,

                                tipo_participante:
                                    tipo,

                                curso:
                                    necesitaCurso(
                                        tipo,
                                    )
                                        ? participante.curso
                                        : "",

                                grupo:
                                    necesitaCurso(
                                        tipo,
                                    )
                                        ? participante.grupo
                                        : "",

                                genero:
                                    tipo ===
                                        "JUGADOR" ||
                                    tipo ===
                                        "PROFESOR"
                                        ? participante.genero
                                        : "",
                            };
                        }

                        if (
                            campo ===
                            "genero"
                        ) {
                            return {
                                ...participante,

                                genero:
                                    valor as
                                        Genero |
                                        "",
                            };
                        }

                        return {
                            ...participante,

                            [campo]:
                                valor,
                        };
                    },
                ),
        );

        if (
            campo ===
                "tipo_participante" &&
            clave ===
                capitanClave &&
            valor !==
                "JUGADOR"
        ) {
            setCapitanClave(
                "",
            );

            setFormulario(
                actual => ({
                    ...actual,

                    accesoCapitan:
                        false,
                }),
            );
        }
    }

    function agregarParticipante(
        tipo:
            TipoParticipante =
            "JUGADOR",
    ) {
        setParticipantes(
            actuales => [
                ...actuales,

                participanteVacio(
                    tipo,
                ),
            ],
        );
    }

    function eliminarParticipante(
        clave: string,
    ) {
        setParticipantes(
            actuales =>
                actuales.filter(
                    participante =>
                        participante.clave !==
                        clave,
                ),
        );

        if (
            capitanClave ===
            clave
        ) {
            setCapitanClave(
                "",
            );

            setFormulario(
                actual => ({
                    ...actual,

                    accesoCapitan:
                        false,
                }),
            );
        }
    }

    // ========================================================
    // ESCUDO
    // ========================================================

    async function seleccionarEscudo(
        evento:
            ChangeEvent<HTMLInputElement>,
    ) {
        const archivo =
            evento.target
                .files?.[0];

        evento.target.value =
            "";

        if (!archivo) {
            return;
        }

        setError("");

        if (
            !TIPOS_IMAGEN.has(
                archivo.type,
            )
        ) {
            setError(
                "El format de l'escut ha de ser PNG, JPG, WEBP o SVG.",
            );

            return;
        }

        if (
            archivo.size >
            MAX_IMAGEN_BYTES
        ) {
            setError(
                "L'escut és massa gran. Utilitza una imatge inferior a 2 MB.",
            );

            return;
        }

        try {
            const imagen =
                await leerImagen(
                    archivo,
                );

            setFormulario(
                actual => ({
                    ...actual,

                    escudo:
                        imagen,
                }),
            );
        } catch (
            error
        ) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut carregar l'escut.",
            );
        }
    }

    // ========================================================
    // VALIDACIÓN CLIENTE
    // ========================================================

    function validarAprobacion() {
        if (
            !configuracion
        ) {
            return "No s'ha carregat la configuració de l'edició.";
        }

        if (
            !formulario
                .nombreEquipo
                .trim()
        ) {
            return "Indica el nom de l'equip.";
        }

        if (
            participantes.length ===
            0
        ) {
            return "Afegeix almenys un participant.";
        }

        for (
            let indice = 0;
            indice <
                participantes.length;
            indice += 1
        ) {
            const participante =
                participantes[
                    indice
                ];

            if (
                !participante
                    .nombre
                    .trim() ||
                !participante
                    .apellido1
                    .trim() ||
                !participante
                    .email
                    .trim()
            ) {
                return `Completa el nom, primer llinatge i correu del participant ${indice + 1}.`;
            }

            if (
                necesitaCurso(
                    participante
                        .tipo_participante,
                ) &&
                !participante
                    .curso
                    .trim()
            ) {
                return `Indica el curs de ${participante.nombre || `participant ${indice + 1}`}.`;
            }

            if (
                configuracion
                    .genero
                    .activo &&
                participanteComputable(
                    participante,
                    configuracion,
                ) &&
                !participante.genero
            ) {
                return `Indica el gènere de ${participante.nombre || `participant ${indice + 1}`}.`;
            }
        }

        if (
            configuracion
                .jugadores
                .minimo !==
                null &&
            resumenParticipantes
                .computables <
                configuracion
                    .jugadores
                    .minimo
        ) {
            return `L'equip necessita com a mínim ${configuracion.jugadores.minimo} jugadors computables.`;
        }

        if (
            configuracion
                .jugadores
                .maximo !==
                null &&
            resumenParticipantes
                .computables >
                configuracion
                    .jugadores
                    .maximo
        ) {
            return `L'equip no pot superar els ${configuracion.jugadores.maximo} jugadors computables.`;
        }

        if (
            configuracion
                .profesores
                .permitidos &&
            resumenParticipantes
                .profesores <
                configuracion
                    .profesores
                    .minimo
        ) {
            return `L'equip necessita com a mínim ${configuracion.profesores.minimo} professors.`;
        }

        if (
            configuracion
                .staff
                .permitido &&
            resumenParticipantes
                .staff <
                configuracion
                    .staff
                    .minimo
        ) {
            return `L'equip necessita com a mínim ${configuracion.staff.minimo} membres de l'staff.`;
        }

        if (
            configuracion
                .genero
                .activo &&
            resumenParticipantes
                .masculino <
                configuracion
                    .genero
                    .minimos
                    .masculino
        ) {
            return `L'equip necessita com a mínim ${configuracion.genero.minimos.masculino} participants de gènere masculí.`;
        }

        if (
            configuracion
                .genero
                .activo &&
            resumenParticipantes
                .femenino <
                configuracion
                    .genero
                    .minimos
                    .femenino
        ) {
            return `L'equip necessita com a mínim ${configuracion.genero.minimos.femenino} participants de gènere femení.`;
        }

        if (!capitan) {
            return "Selecciona el capità de l'equip.";
        }

        if (
            !capitan
                .email
                .trim()
        ) {
            return "El capità ha de tenir un correu electrònic.";
        }

        return null;
    }

    // ========================================================
    // ENVÍO
    // ========================================================

    async function guardar(
        estado:
            EstadoEnvio,
    ) {
        if (
            guardando ||
            !configuracion
        ) {
            return;
        }

        setError("");

        if (
            estado ===
            "APROBADO"
        ) {
            const errorValidacion =
                validarAprobacion();

            if (
                errorValidacion
            ) {
                setError(
                    errorValidacion,
                );

                return;
            }
        }

        if (
            formulario
                .accesoCapitan &&
            !capitan
        ) {
            setError(
                "Per donar accés al capità primer has de seleccionar-lo.",
            );

            return;
        }

        if (
            formulario
                .plazaEstado ===
                "LISTA_ESPERA"
        ) {
            const posicion =
                Number(
                    formulario
                        .posicionListaEspera,
                );

            if (
                !Number.isSafeInteger(
                    posicion,
                ) ||
                posicion < 1
            ) {
                setError(
                    "Indica una posició vàlida de la llista d'espera.",
                );

                return;
            }
        }

        setGuardando(
            true,
        );

        setEstadoEnvio(
            estado,
        );

        try {
            const posicion =
                formulario
                    .plazaEstado ===
                    "LISTA_ESPERA"
                    ? Number(
                          formulario
                              .posicionListaEspera,
                      )
                    : null;

            const respuesta =
                await fetch(
                    "/api/panell/equips",
                    {
                        method:
                            "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",

                            Accept:
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                accion:
                                    "crear",

                                torneoID,

                                edicionID,

                                estado,

                                responsable: {
                                    email:
                                        formulario
                                            .responsableEmail
                                            .trim(),

                                    vincular_usuario:
                                        formulario
                                            .vincularResponsable,
                                },

                                acceso_capitan:
                                    formulario
                                        .accesoCapitan,

                                equipo: {
                                    nombre:
                                        formulario
                                            .nombreEquipo
                                            .trim(),

                                    escudo:
                                        formulario
                                            .escudo,

                                    capitan_email:
                                        capitan
                                            ?.email
                                            .trim() ??
                                        "",

                                    nota_admin:
                                        formulario
                                            .notaAdmin
                                            .trim(),
                                },

                                participantes:
                                    participantes.map(
                                        (
                                            participante,
                                            indice,
                                        ) => ({
                                            tipo_participante:
                                                participante
                                                    .tipo_participante,

                                            nombre:
                                                participante
                                                    .nombre
                                                    .trim(),

                                            apellido1:
                                                participante
                                                    .apellido1
                                                    .trim(),

                                            apellido2:
                                                participante
                                                    .apellido2
                                                    .trim(),

                                            email:
                                                participante
                                                    .email
                                                    .trim()
                                                    .toLowerCase(),

                                            curso:
                                                participante
                                                    .curso
                                                    .trim(),

                                            grupo:
                                                participante
                                                    .grupo
                                                    .trim(),

                                            genero:
                                                participante.genero ||
                                                null,

                                            orden:
                                                indice +
                                                1,
                                        }),
                                    ),

                                plaza: {
                                    estado:
                                        estado ===
                                            "APROBADO" &&
                                        capacidades
                                            ?.cambiarEstado
                                            ? formulario
                                                  .plazaEstado
                                            : "PENDIENTE",

                                    posicion_lista_espera:
                                        estado ===
                                            "APROBADO" &&
                                        capacidades
                                            ?.cambiarEstado
                                            ? posicion
                                            : null,
                                },
                            }),
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
                        : "No s'ha pogut crear l'equip.";

                throw new Error(
                    mensaje,
                );
            }

            const resultado =
                json as RespuestaCreacion;

            window.location.assign(
                resultado.redireccion,
            );
        } catch (
            error
        ) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut crear l'equip.",
            );
        } finally {
            setGuardando(
                false,
            );

            setEstadoEnvio(
                null,
            );
        }
    }

    function enviarFormulario(
        evento:
            FormEvent<HTMLFormElement>,
    ) {
        evento.preventDefault();

        void guardar(
            "APROBADO",
        );
    }

    // ========================================================
    // CARGANDO
    // ========================================================

    if (cargando) {
        return (
            <div className="flex min-h-96 items-center justify-center rounded-2xl border border-border bg-card">
                <Cargando />
            </div>
        );
    }

    // ========================================================
    // ERROR DE CARGA
    // ========================================================

    if (
        !configuracion ||
        !torneo ||
        !edicion ||
        !capacidades
    ) {
        return (
            <div className="rounded-2xl border border-error/20 bg-error/5 p-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-error/10 text-error">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                    </svg>
                </div>

                <h2 className="mt-4 text-lg font-semibold text-neutral-titulos">
                    No s'ha pogut preparar el formulari
                </h2>

                <p className="mx-auto mt-2 max-w-xl text-sm text-error">
                    {error || "No s'ha pogut carregar la configuració de l'edició."}
                </p>

                <a href={volver} className="mt-5 inline-flex items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                    Tornar als equips
                </a>
            </div>
        );
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <form onSubmit={enviarFormulario} className="flex flex-col gap-6">

            {/* =================================================
                ERROR
            ================================================= */}

            {error && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/25 bg-error/5 p-4 text-error">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-5 w-5 shrink-0 fill-current" aria-hidden="true">
                        <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                    </svg>

                    <div>
                        <p className="text-sm font-semibold">
                            Revisa les dades
                        </p>

                        <p className="mt-1 text-sm">
                            {error}
                        </p>
                    </div>
                </div>
            )}

            {/* =================================================
                CONTEXTO
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                    {torneo.nombre}
                </p>

                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="text-xl font-bold text-neutral-titulos">
                        {edicion.nombre}
                    </h2>

                    {edicion.sede && (
                        <>
                            <span className="text-neutral/40">
                                ·
                            </span>

                            <span className="text-sm text-neutral">
                                {edicion.sede}
                            </span>
                        </>
                    )}
                </div>

                <p className="mt-2 text-sm leading-6 text-neutral">
                    L'equip es crearà directament dins aquesta edició. Les regles de participants, cursos i gènere corresponen a la configuració de l'edició.
                </p>
            </section>

            {/* =================================================
                DATOS DEL EQUIPO
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Dades de l'equip
                    </h2>

                    <p className="mt-1 text-sm text-neutral">
                        Informació principal de l'equip.
                    </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-[160px_minmax(0,1fr)]">
                    <div>
                        <p className="mb-2 text-xs font-semibold text-neutral-titulos">
                            Escut
                        </p>

                        <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background">
                            {formulario.escudo ? (
                                <img src={formulario.escudo} alt="Previsualització de l'escut" className="h-full w-full object-contain p-3" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-12 w-12 fill-neutral/30" aria-hidden="true">
                                    <path d="m480-80-120-40q-120-40-200-150T80-520v-240l400-120 400 120v240q0 140-80 250T600-120L480-80Z" />
                                </svg>
                            )}
                        </div>

                        <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                            Seleccionar imatge

                            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(evento) => void seleccionarEscudo(evento)} className="sr-only" />
                        </label>

                        {formulario.escudo && (
                            <button type="button" onClick={() => setFormulario((actual) => ({ ...actual, escudo: null }))} className="mt-2 block text-xs font-semibold text-error transition hover:opacity-70">
                                Eliminar escut
                            </button>
                        )}
                    </div>

                    <div className="grid content-start gap-5">
                        <label className="block">
                            <span className="text-xs font-semibold text-neutral-titulos">
                                Nom de l'equip
                            </span>

                            <input type="text" maxLength={80} value={formulario.nombreEquipo} onChange={(evento) => setFormulario((actual) => ({ ...actual, nombreEquipo: evento.target.value }))} placeholder="Ex. 1r Batxillerat A" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10" />
                        </label>

                        <label className="block">
                            <span className="text-xs font-semibold text-neutral-titulos">
                                Nota administrativa
                            </span>

                            <textarea rows={4} maxLength={4000} value={formulario.notaAdmin} onChange={(evento) => setFormulario((actual) => ({ ...actual, notaAdmin: evento.target.value }))} placeholder="Informació interna opcional sobre aquest equip..." className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10" />
                        </label>
                    </div>
                </div>
            </section>

            {/* =================================================
                RESPONSABLE
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Responsable
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-neutral">
                        Pots indicar només un correu de contacte o vincular l'equip a un compte existent de la plataforma.
                    </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-semibold text-neutral-titulos">
                            Correu del responsable
                        </span>

                        <input type="email" maxLength={254} value={formulario.responsableEmail} onChange={(evento) => setFormulario((actual) => ({ ...actual, responsableEmail: evento.target.value }))} placeholder="nom@iescalvia.com" className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition placeholder:text-neutral/50 focus:border-primary focus:ring-2 focus:ring-primary/10" />
                    </label>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
                        <input type="checkbox" checked={formulario.vincularResponsable} onChange={(evento) => setFormulario((actual) => ({ ...actual, vincularResponsable: evento.target.checked }))} className="mt-0.5 h-4 w-4 accent-primary" />

                        <span>
                            <span className="block text-sm font-semibold text-neutral-titulos">
                                Vincular a un usuari existent
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-neutral">
                                Es cercarà un compte amb aquest correu i la inscripció apareixerà al seu perfil.
                            </span>
                        </span>
                    </label>
                </div>

                {!formulario.vincularResponsable && formulario.responsableEmail && (
                    <div className="mt-4 rounded-xl border border-secondary/20 bg-secondary/5 p-4 text-xs leading-5 text-neutral">
                        El correu quedarà guardat com a contacte, però l'equip no quedarà vinculat a cap compte d'usuari.
                    </div>
                )}
            </section>

            {/* =================================================
                PARTICIPANTES
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card">
                <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Participants
                        </h2>

                        <p className="mt-1 text-sm text-neutral">
                            Afegeix tots els membres que formen part de l'equip.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {tiposDisponibles.map((tipo) => (
                            <button key={tipo.valor} type="button" onClick={() => agregarParticipante(tipo.valor)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                                <span className="text-base leading-none">
                                    +
                                </span>

                                {tipo.nombre}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-border bg-background/60 p-4 sm:grid-cols-3 lg:grid-cols-6">
                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Total
                        </p>

                        <p className="mt-1 text-xl font-bold text-neutral-titulos">
                            {participantes.length}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Jugadors
                        </p>

                        <p className="mt-1 text-xl font-bold text-neutral-titulos">
                            {resumenParticipantes.jugadores}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Professorat
                        </p>

                        <p className="mt-1 text-xl font-bold text-neutral-titulos">
                            {resumenParticipantes.profesores}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Entrenadors
                        </p>

                        <p className="mt-1 text-xl font-bold text-neutral-titulos">
                            {resumenParticipantes.entrenadores}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Staff
                        </p>

                        <p className="mt-1 text-xl font-bold text-neutral-titulos">
                            {resumenParticipantes.staff}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Computables
                        </p>

                        <p className="mt-1 text-xl font-bold text-primary">
                            {resumenParticipantes.computables}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4 p-4 sm:p-5">
                    {participantes.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center">
                            <p className="text-sm font-semibold text-neutral-titulos">
                                Sense participants
                            </p>

                            <p className="mt-1 text-xs text-neutral">
                                Afegeix jugadors o altres membres de l'equip.
                            </p>
                        </div>
                    ) : (
                        participantes.map((participante, indice) => {
                            const cursos =
                                configuracion.cursos;

                            const cursoSeleccionado =
                                cursos.find(
                                    curso =>
                                        curso.curso ===
                                        participante.curso,
                                );

                            const mostrarGenero =
                                configuracion.genero.activo &&
                                participanteComputable(
                                    participante,
                                    configuracion,
                                );

                            return (
                                <article key={participante.clave} className="rounded-xl border border-border bg-background p-4">
                                    <div className="mb-4 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                                {indice + 1}
                                            </span>

                                            <div>
                                                <p className="text-sm font-semibold text-neutral-titulos">
                                                    {participante.nombre || nombreTipo(participante.tipo_participante)}
                                                </p>

                                                <p className="text-[11px] text-neutral">
                                                    {nombreTipo(participante.tipo_participante)}
                                                </p>
                                            </div>
                                        </div>

                                        <button type="button" onClick={() => eliminarParticipante(participante.clave)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral transition hover:bg-error/10 hover:text-error" aria-label={`Eliminar participant ${indice + 1}`}>
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                                <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Z" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        <label>
                                            <span className="text-[11px] font-semibold text-neutral-titulos">
                                                Tipus
                                            </span>

                                            <select value={participante.tipo_participante} onChange={(evento) => actualizarParticipante(participante.clave, "tipo_participante", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                                                {tiposDisponibles.map((tipo) => (
                                                    <option key={tipo.valor} value={tipo.valor}>
                                                        {tipo.nombre}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>

                                        <label>
                                            <span className="text-[11px] font-semibold text-neutral-titulos">
                                                Nom
                                            </span>

                                            <input type="text" maxLength={100} value={participante.nombre} onChange={(evento) => actualizarParticipante(participante.clave, "nombre", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                        </label>

                                        <label>
                                            <span className="text-[11px] font-semibold text-neutral-titulos">
                                                Primer llinatge
                                            </span>

                                            <input type="text" maxLength={100} value={participante.apellido1} onChange={(evento) => actualizarParticipante(participante.clave, "apellido1", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                        </label>

                                        <label>
                                            <span className="text-[11px] font-semibold text-neutral-titulos">
                                                Segon llinatge
                                            </span>

                                            <input type="text" maxLength={100} value={participante.apellido2} onChange={(evento) => actualizarParticipante(participante.clave, "apellido2", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                        </label>

                                        <label className="sm:col-span-2">
                                            <span className="text-[11px] font-semibold text-neutral-titulos">
                                                Correu electrònic
                                            </span>

                                            <input type="email" maxLength={254} value={participante.email} onChange={(evento) => actualizarParticipante(participante.clave, "email", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                        </label>

                                        {necesitaCurso(participante.tipo_participante) && (
                                            <>
                                                <label>
                                                    <span className="text-[11px] font-semibold text-neutral-titulos">
                                                        Curs
                                                    </span>

                                                    <select value={participante.curso} onChange={(evento) => {
                                                        actualizarParticipante(participante.clave, "curso", evento.target.value);
                                                        actualizarParticipante(participante.clave, "grupo", "");
                                                    }} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                                                        <option value="">
                                                            Selecciona...
                                                        </option>

                                                        {cursos.map((curso) => (
                                                            <option key={curso.curso} value={curso.curso}>
                                                                {curso.curso}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>

                                                <label>
                                                    <span className="text-[11px] font-semibold text-neutral-titulos">
                                                        Grup
                                                    </span>

                                                    <select value={participante.grupo} disabled={!cursoSeleccionado || cursoSeleccionado.grupos.length === 0} onChange={(evento) => actualizarParticipante(participante.clave, "grupo", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition disabled:cursor-not-allowed disabled:opacity-50 focus:border-primary focus:ring-2 focus:ring-primary/10">
                                                        <option value="">
                                                            {cursoSeleccionado?.grupos.length ? "Selecciona..." : "Sense grup"}
                                                        </option>

                                                        {cursoSeleccionado?.grupos.map((grupo) => (
                                                            <option key={grupo} value={grupo}>
                                                                {grupo}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </>
                                        )}

                                        {mostrarGenero && (
                                            <label>
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Gènere
                                                </span>

                                                <select value={participante.genero} onChange={(evento) => actualizarParticipante(participante.clave, "genero", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                                                    <option value="">
                                                        Selecciona...
                                                    </option>

                                                    <option value="masculino">
                                                        Masculí
                                                    </option>

                                                    <option value="femenino">
                                                        Femení
                                                    </option>
                                                </select>
                                            </label>
                                        )}
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>
            </section>

            {/* =================================================
                CAPITÁN
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Capità
                    </h2>

                    <p className="mt-1 text-sm text-neutral">
                        Només pot ser capità un participant de tipus jugador.
                    </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    <label>
                        <span className="text-xs font-semibold text-neutral-titulos">
                            Capità de l'equip
                        </span>

                        <select value={capitanClave} onChange={(evento) => {
                            setCapitanClave(evento.target.value);

                            if (!evento.target.value) {
                                setFormulario((actual) => ({
                                    ...actual,
                                    accesoCapitan: false,
                                }));
                            }
                        }} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
                            <option value="">
                                Sense seleccionar
                            </option>

                            {jugadores.map((jugador) => (
                                <option key={jugador.clave} value={jugador.clave}>
                                    {[jugador.nombre, jugador.apellido1, jugador.apellido2].filter(Boolean).join(" ") || "Jugador sense nom"}
                                    {jugador.email ? ` · ${jugador.email}` : ""}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className={`flex items-start gap-3 rounded-xl border border-border bg-background p-4 ${!capitan ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}>
                        <input type="checkbox" disabled={!capitan} checked={formulario.accesoCapitan} onChange={(evento) => setFormulario((actual) => ({ ...actual, accesoCapitan: evento.target.checked }))} className="mt-0.5 h-4 w-4 accent-primary" />

                        <span>
                            <span className="block text-sm font-semibold text-neutral-titulos">
                                Permetre accés al capità
                            </span>

                            <span className="mt-1 block text-xs leading-5 text-neutral">
                                Si té un compte amb el mateix correu podrà accedir a la inscripció.
                            </span>
                        </span>
                    </label>
                </div>
            </section>

            {/* =================================================
                REGLAS DE EDICIÓN
            ================================================= */}

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-neutral-titulos">
                    Requisits de l'edició
                </h2>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-background p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Jugadors
                        </p>

                        <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                            {configuracion.jugadores.minimo ?? 0} mín. · {configuracion.jugadores.maximo ?? "∞"} màx.
                        </p>
                    </div>

                    <div className="rounded-xl bg-background p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Professorat
                        </p>

                        <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                            {configuracion.profesores.permitidos ? `${configuracion.profesores.minimo} mín. · ${configuracion.profesores.maximo || "∞"} màx.` : "No permès"}
                        </p>
                    </div>

                    <div className="rounded-xl bg-background p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Entrenador
                        </p>

                        <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                            {configuracion.entrenador.permitido ? "Permès" : "No permès"}
                        </p>
                    </div>

                    <div className="rounded-xl bg-background p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral">
                            Staff
                        </p>

                        <p className="mt-1 text-sm font-semibold text-neutral-titulos">
                            {configuracion.staff.permitido ? `${configuracion.staff.minimo} mín. · ${configuracion.staff.maximo || "∞"} màx.` : "No permès"}
                        </p>
                    </div>
                </div>

                {configuracion.genero.activo && (
                    <div className="mt-3 rounded-xl bg-background p-4">
                        <p className="text-xs font-semibold text-neutral-titulos">
                            Requisit de gènere
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            Mínim masculí: <strong>{configuracion.genero.minimos.masculino}</strong> · Mínim femení: <strong>{configuracion.genero.minimos.femenino}</strong>
                        </p>
                    </div>
                )}
            </section>

            {/* =================================================
                PLAZA
            ================================================= */}

            {capacidades.cambiarEstado && (
                <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Plaça
                        </h2>

                        <p className="mt-1 text-sm text-neutral">
                            Aquesta configuració només s'aplicarà si crees l'equip directament com a aprovat.
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label>
                            <span className="text-xs font-semibold text-neutral-titulos">
                                Estat de la plaça
                            </span>

                            <select value={formulario.plazaEstado} onChange={(evento) => setFormulario((actual) => ({ ...actual, plazaEstado: evento.target.value as EstadoPlaza, posicionListaEspera: evento.target.value === "LISTA_ESPERA" ? actual.posicionListaEspera : "" }))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10">
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
                        </label>

                        {formulario.plazaEstado === "LISTA_ESPERA" && (
                            <label>
                                <span className="text-xs font-semibold text-neutral-titulos">
                                    Posició
                                </span>

                                <input type="number" min={1} step={1} value={formulario.posicionListaEspera} onChange={(evento) => setFormulario((actual) => ({ ...actual, posicionListaEspera: evento.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
                            </label>
                        )}
                    </div>
                </section>
            )}

            {/* =================================================
                ACCIONES
            ================================================= */}

            <section className="bottom-4 z-10 rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Crear equip
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            Pots guardar-lo com a esborrany si encara falten dades o crear-lo directament com a aprovat.
                        </p>
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <a href={volver} className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                            Cancel·lar
                        </a>

                        <button type="button" disabled={guardando} onClick={() => void guardar("BORRADOR")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50">
                            {guardando && estadoEnvio === "BORRADOR" && (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
                            )}

                            Desar com a esborrany
                        </button>

                        <button type="submit" disabled={guardando} className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                            {guardando && estadoEnvio === "APROBADO" && (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                            )}

                            Crear i aprovar
                        </button>
                    </div>
                </div>
            </section>
        </form>
    );
}