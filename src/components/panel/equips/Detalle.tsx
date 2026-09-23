import Cargando from "@components/Cargando";

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ChangeEvent,
} from "react";

// ============================================================
// TIPOS
// ============================================================

type EstadoFormulario =
    | "BORRADOR"
    | "EN_REVISION"
    | "APROBADO"
    | "DENEGADO";

type EstadoEvaluacion =
    | "EN_REVISION"
    | "APROBADO"
    | "DENEGADO";

type OrigenFormulario =
    | "USUARIO"
    | "ADMIN";

type EstadoPlaza =
    | "PENDIENTE"
    | "CONFIRMADA"
    | "LISTA_ESPERA"
    | "SIN_PLAZA";

type TipoParticipante =
    | "JUGADOR"
    | "PROFESOR"
    | "ENTRENADOR"
    | "STAFF";

type Genero =
    | "masculino"
    | "femenino";

type TipoEntidadObservacion =
    | "FORMULARIO"
    | "EQUIPO"
    | "PARTICIPANTE";

type Torneo = {
    id: string;
    nombre: string;
    deporte: string | null;
    logo: string | null;
};

type Edicion = {
    id: string;
    torneo_id: string | null;
    nombre: string;
    estado: string;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
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

    cursos: {
        curso: string;
        grupos: string[];
    }[];

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

type Equipo = {
    id: string;
    formulario_id: string;
    nombre: string;
    escudo: string | null;
    capitan_id: string | null;
    validacion_estado: string;
    plaza_estado: EstadoPlaza;
    posicion_lista_espera: number | null;
    nota_admin: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type Formulario = {
    id: string;
    estado: EstadoFormulario;
    origen: OrigenFormulario;
    usuario_id: string | null;
    email_contacto: string;
    acceso_capitan: boolean;
    iniciado_at: string | null;
    enviado_at: string | null;
    completado_at: string | null;
    created_at: string | null;
    updated_at: string | null;
};

type Responsable = {
    id: string | null;
    nombre: string;
    apellido1: string;
    apellido2: string;
    nombre_completo: string;
    email: string;
    curso: string;
    ano_academico: string;
};

type Participante = {
    id: string;
    tipo_participante: TipoParticipante;
    nombre: string;
    apellido1: string;
    apellido2: string;
    nombre_completo: string;
    email: string;
    curso: string;
    grupo: string;
    genero: Genero | null;
    validacion_estado: string;
    orden: number;
    es_capitan: boolean;
    created_at: string | null;
    updated_at: string | null;
};

type Participantes = {
    total: number;
    jugadores: number;
    profesores: number;
    entrenadores: number;
    staff: number;
    capitan: Participante | null;
    filas: Participante[];
};

type Observacion = {
    id: string;
    edicion_id: string | null;
    formulario_id: string | null;
    entidad_tipo: string;
    entidad_id: string | null;
    campo: string;
    mensaje: string;
    estado: string;
    creada_por: string | null;
    resuelta_por: string | null;
    created_at: string | null;
};

type Capacidades = {
    crear: boolean;
    editar: boolean;
    evaluar: boolean;
    cambiarEstado: boolean;
    eliminar: boolean;
    finalizarBorrador: boolean;
    cambiarEvaluacion: boolean;
};

type RespuestaAPI = {
    success: true;
    torneo: Torneo;
    edicion: Edicion;
    configuracion: ConfiguracionEquipos;
    equipo: Equipo;
    formulario: Formulario;
    responsable: Responsable;
    participantes: Participantes;
    observaciones: Observacion[];
    capacidades: Capacidades;
};

type ParticipanteEdicion = {
    clave: string;
    id: string | null;
    tipo_participante: TipoParticipante;
    nombre: string;
    apellido1: string;
    apellido2: string;
    email: string;
    curso: string;
    grupo: string;
    genero: Genero | "";
};

type DatosEdicion = {
    nombre: string;
    escudo: string | null;
    responsableEmail: string;
    vincularResponsable: boolean;
    accesoCapitan: boolean;
    notaAdmin: string;
};

type ObservacionNueva = {
    clave: string;
    entidad_tipo: TipoEntidadObservacion;
    participante_id: string;
    campo: string;
    mensaje: string;
};

type AccionGuardando =
    | "editar"
    | "aprobar"
    | "finalizar"
    | "cambios"
    | "evaluacion"
    | "plaza"
    | null;

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

const CAMPOS_FORMULARIO = [
    {
        valor: "general",
        nombre: "General",
    },
    {
        valor: "responsable",
        nombre: "Responsable",
    },
    {
        valor: "acceso_capitan",
        nombre: "Accés del capità",
    },
];

const CAMPOS_EQUIPO = [
    {
        valor: "general",
        nombre: "General",
    },
    {
        valor: "nombre",
        nombre: "Nom de l'equip",
    },
    {
        valor: "escudo",
        nombre: "Escut",
    },
    {
        valor: "capitan_id",
        nombre: "Capità",
    },
];

const CAMPOS_PARTICIPANTE = [
    {
        valor: "general",
        nombre: "General",
    },
    {
        valor: "nombre",
        nombre: "Nom",
    },
    {
        valor: "apellido1",
        nombre: "Primer llinatge",
    },
    {
        valor: "apellido2",
        nombre: "Segon llinatge",
    },
    {
        valor: "email",
        nombre: "Correu electrònic",
    },
    {
        valor: "curso",
        nombre: "Curs",
    },
    {
        valor: "grupo",
        nombre: "Grup",
    },
    {
        valor: "genero",
        nombre: "Gènere",
    },
    {
        valor: "tipo_participante",
        nombre: "Tipus de participant",
    },
];

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
    tipo: TipoParticipante =
        "JUGADOR",
): ParticipanteEdicion {
    return {
        clave:
            nuevaClave(),

        id:
            null,

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

function observacionVacia():
    ObservacionNueva {
    return {
        clave:
            nuevaClave(),

        entidad_tipo:
            "EQUIPO",

        participante_id:
            "",

        campo:
            "general",

        mensaje:
            "",
    };
}

function nombreParticipante(
    participante: {
        nombre: string;
        apellido1: string;
        apellido2: string;
    },
) {
    return [
        participante.nombre,
        participante.apellido1,
        participante.apellido2,
    ]
        .filter(Boolean)
        .join(" ")
        .trim();
}

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

function textoTipo(
    tipo: TipoParticipante,
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

function textoOrigen(
    origen: OrigenFormulario,
) {
    return origen ===
        "ADMIN"
        ? "Administració"
        : "Usuari";
}

function mostrarGenero(
    genero: Genero | null,
) {
    if (
        genero ===
        "masculino"
    ) {
        return "Masculí";
    }

    if (
        genero ===
        "femenino"
    ) {
        return "Femení";
    }

    return "—";
}

function mostrarFecha(
    valor: string | null,
) {
    if (
        !valor
    ) {
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

function observacionActiva(
    observacion: Observacion,
) {
    return (
        observacion.estado
            .trim()
            .toUpperCase() !==
        "RESUELTA"
    );
}

function necesitaCurso(
    tipo: TipoParticipante,
) {
    return (
        tipo ===
            "JUGADOR" ||
        tipo ===
            "PROFESOR"
    );
}

function participanteComputable(
    participante:
        ParticipanteEdicion,
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
        valor: TipoParticipante;
        nombre: string;
    }[] = [
        {
            valor: "JUGADOR",
            nombre: "Jugador/a",
        },
    ];

    if (
        configuracion
            .profesores
            .permitidos
    ) {
        opciones.push({
            valor: "PROFESOR",
            nombre: "Professor/a",
        });
    }

    if (
        configuracion
            .entrenador
            .permitido
    ) {
        opciones.push({
            valor: "ENTRENADOR",
            nombre: "Entrenador/a",
        });
    }

    if (
        configuracion
            .staff
            .permitido
    ) {
        opciones.push({
            valor: "STAFF",
            nombre: "Staff",
        });
    }

    return opciones;
}

function camposObservacion(
    tipo:
        TipoEntidadObservacion,
) {
    if (
        tipo ===
        "FORMULARIO"
    ) {
        return CAMPOS_FORMULARIO;
    }

    if (
        tipo ===
        "PARTICIPANTE"
    ) {
        return CAMPOS_PARTICIPANTE;
    }

    return CAMPOS_EQUIPO;
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

function mensajeConfirmacionEvaluacion(
    actual:
        EstadoFormulario,
    nuevo:
        EstadoEvaluacion,
) {
    if (
        nuevo ===
        "APROBADO"
    ) {
        return "Vols marcar aquesta inscripció com a aprovada? Es tornaran a validar totes les dades abans d'aprovar-la.";
    }

    if (
        nuevo ===
        "DENEGADO"
    ) {
        return actual ===
            "APROBADO"
            ? "Vols revocar l'aprovació i marcar aquesta inscripció com a no aprovada? La plaça no es modificarà."
            : "Vols marcar aquesta inscripció com a no aprovada? La plaça no es modificarà.";
    }

    return "Vols tornar aquesta inscripció a revisió? L'equip i els participants quedaran pendents de validació. La plaça no es modificarà.";
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Detalle({
    equipoID,
    torneoID,
    edicionID,
    volver,
}: {
    equipoID: string;
    torneoID: string;
    edicionID: string;
    volver: string;
}) {
    const [
        cargando,
        setCargando,
    ] =
        useState(
            true,
        );

    const [
        errorCarga,
        setErrorCarga,
    ] =
        useState(
            "",
        );

    const [
        errorAccion,
        setErrorAccion,
    ] =
        useState(
            "",
        );

    const [
        mensaje,
        setMensaje,
    ] =
        useState(
            "",
        );

    const [
        datos,
        setDatos,
    ] =
        useState<
            RespuestaAPI | null
        >(
            null,
        );

    const [
        editando,
        setEditando,
    ] =
        useState(
            false,
        );

    const [
        guardando,
        setGuardando,
    ] =
        useState<
            AccionGuardando
        >(
            null,
        );

    const [
        datosEdicion,
        setDatosEdicion,
    ] =
        useState<DatosEdicion>({
            nombre:
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
        });

    const [
        participantesEdicion,
        setParticipantesEdicion,
    ] =
        useState<
            ParticipanteEdicion[]
        >(
            [],
        );

    const [
        capitanClave,
        setCapitanClave,
    ] =
        useState(
            "",
        );

    const [
        observacionesNuevas,
        setObservacionesNuevas,
    ] =
        useState<
            ObservacionNueva[]
        >([
            observacionVacia(),
        ]);

    const [
        estadoEvaluacion,
        setEstadoEvaluacion,
    ] =
        useState<EstadoEvaluacion>(
            "EN_REVISION",
        );

    const [
        plazaEstado,
        setPlazaEstado,
    ] =
        useState<EstadoPlaza>(
            "PENDIENTE",
        );

    const [
        posicionListaEspera,
        setPosicionListaEspera,
    ] =
        useState(
            "",
        );

    const [
        notaPlaza,
        setNotaPlaza,
    ] =
        useState(
            "",
        );

    // ========================================================
    // SINCRONIZAR
    // ========================================================

    const sincronizarEdicion =
        useCallback(
            (
                respuesta:
                    RespuestaAPI,
            ) => {
                setDatosEdicion({
                    nombre:
                        respuesta
                            .equipo
                            .nombre,

                    escudo:
                        respuesta
                            .equipo
                            .escudo,

                    responsableEmail:
                        respuesta
                            .responsable
                            .email ||
                        respuesta
                            .formulario
                            .email_contacto,

                    vincularResponsable:
                        Boolean(
                            respuesta
                                .formulario
                                .usuario_id,
                        ),

                    accesoCapitan:
                        respuesta
                            .formulario
                            .acceso_capitan,

                    notaAdmin:
                        respuesta
                            .equipo
                            .nota_admin ??
                        "",
                });

                setParticipantesEdicion(
                    respuesta
                        .participantes
                        .filas
                        .map(
                            participante => ({
                                clave:
                                    participante.id,

                                id:
                                    participante.id,

                                tipo_participante:
                                    participante
                                        .tipo_participante,

                                nombre:
                                    participante
                                        .nombre,

                                apellido1:
                                    participante
                                        .apellido1,

                                apellido2:
                                    participante
                                        .apellido2,

                                email:
                                    participante
                                        .email,

                                curso:
                                    participante
                                        .curso,

                                grupo:
                                    participante
                                        .grupo,

                                genero:
                                    participante
                                        .genero ??
                                    "",
                            }),
                        ),
                );

                setCapitanClave(
                    respuesta
                        .equipo
                        .capitan_id ??
                    "",
                );

                if (
                    respuesta
                        .formulario
                        .estado !==
                    "BORRADOR"
                ) {
                    setEstadoEvaluacion(
                        respuesta
                            .formulario
                            .estado,
                    );
                } else {
                    setEstadoEvaluacion(
                        "EN_REVISION",
                    );
                }

                setPlazaEstado(
                    respuesta
                        .equipo
                        .plaza_estado,
                );

                setPosicionListaEspera(
                    respuesta
                        .equipo
                        .posicion_lista_espera !==
                    null
                        ? String(
                              respuesta
                                  .equipo
                                  .posicion_lista_espera,
                          )
                        : "",
                );

                setNotaPlaza(
                    respuesta
                        .equipo
                        .nota_admin ??
                    "",
                );
            },
            [],
        );

    // ========================================================
    // CARGAR
    // ========================================================

    const cargar =
        useCallback(
            async (
                mostrarCarga =
                    true,
            ) => {
                if (
                    mostrarCarga
                ) {
                    setCargando(
                        true,
                    );
                }

                setErrorCarga(
                    "",
                );

                try {
                    const parametros =
                        new URLSearchParams({
                            torneoID,
                            edicionID,
                        });

                    const respuesta =
                        await fetch(
                            `/api/panell/equips/${encodeURIComponent(equipoID)}?${parametros.toString()}`,
                            {
                                credentials:
                                    "same-origin",

                                cache:
                                    "no-store",
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
                        const texto =
                            json &&
                            typeof json ===
                                "object" &&
                            "mensaje"
                                in json &&
                            typeof json.mensaje ===
                                "string"
                                ? json.mensaje
                                : "No s'ha pogut carregar la fitxa de l'equip.";

                        throw new Error(
                            texto,
                        );
                    }

                    const resultado =
                        json as
                            RespuestaAPI;

                    setDatos(
                        resultado,
                    );

                    sincronizarEdicion(
                        resultado,
                    );
                } catch (
                    error
                ) {
                    setErrorCarga(
                        error instanceof
                            Error
                            ? error.message
                            : "No s'ha pogut carregar la fitxa de l'equip.",
                    );
                } finally {
                    if (
                        mostrarCarga
                    ) {
                        setCargando(
                            false,
                        );
                    }
                }
            },
            [
                equipoID,
                torneoID,
                edicionID,
                sincronizarEdicion,
            ],
        );

    useEffect(
        () => {
            void cargar();
        },
        [
            cargar,
        ],
    );

    // ========================================================
    // DERIVADOS
    // ========================================================

    const observacionesActivas =
        useMemo(
            () =>
                datos
                    ?.observaciones
                    .filter(
                        observacionActiva,
                    ) ??
                [],
            [
                datos,
            ],
        );

    const tiposDisponibles =
        useMemo(
            () =>
                datos
                    ? opcionesTipo(
                          datos.configuracion,
                      )
                    : [],
            [
                datos,
            ],
        );

    const jugadoresEdicion =
        useMemo(
            () =>
                participantesEdicion.filter(
                    participante =>
                        participante
                            .tipo_participante ===
                        "JUGADOR",
                ),
            [
                participantesEdicion,
            ],
        );

    const capitanEdicion =
        useMemo(
            () =>
                participantesEdicion.find(
                    participante =>
                        participante.clave ===
                        capitanClave,
                ) ??
                null,
            [
                participantesEdicion,
                capitanClave,
            ],
        );

    const resumenEdicion =
        useMemo(
            () => {
                if (
                    !datos
                ) {
                    return {
                        total:
                            0,

                        computables:
                            0,

                        masculinos:
                            0,

                        femeninos:
                            0,
                    };
                }

                const computables =
                    participantesEdicion.filter(
                        participante =>
                            participanteComputable(
                                participante,
                                datos.configuracion,
                            ),
                    );

                return {
                    total:
                        participantesEdicion.length,

                    computables:
                        computables.length,

                    masculinos:
                        computables.filter(
                            participante =>
                                participante.genero ===
                                "masculino",
                        ).length,

                    femeninos:
                        computables.filter(
                            participante =>
                                participante.genero ===
                                "femenino",
                        ).length,
                };
            },
            [
                participantesEdicion,
                datos,
            ],
        );

    // ========================================================
    // PATCH
    // ========================================================

    async function ejecutarPatch(
        cuerpo:
            Record<
                string,
                unknown
            >,
    ) {
        const respuesta =
            await fetch(
                `/api/panell/equips/${encodeURIComponent(equipoID)}`,
                {
                    method:
                        "PATCH",

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
                            torneoID,
                            edicionID,
                            ...cuerpo,
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
            const texto =
                json &&
                typeof json ===
                    "object" &&
                "mensaje"
                    in json &&
                typeof json.mensaje ===
                    "string"
                    ? json.mensaje
                    : "No s'ha pogut completar l'operació.";

            throw new Error(
                texto,
            );
        }

        return json;
    }

    // ========================================================
    // PARTICIPANTES · EDITAR
    // ========================================================

    function actualizarParticipante(
        clave: string,
        campo:
            keyof Omit<
                ParticipanteEdicion,
                "clave" | "id"
            >,
        valor: string,
    ) {
        setParticipantesEdicion(
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
                                valor as
                                    TipoParticipante;

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

            setDatosEdicion(
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
        setParticipantesEdicion(
            actuales => [
                ...actuales,
                participanteVacio(
                    tipo,
                ),
            ],
        );
    }

    function retirarParticipante(
        clave: string,
    ) {
        setParticipantesEdicion(
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

            setDatosEdicion(
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

        if (
            !archivo
        ) {
            return;
        }

        setErrorAccion(
            "",
        );

        if (
            !TIPOS_IMAGEN.has(
                archivo.type,
            )
        ) {
            setErrorAccion(
                "El format de l'escut ha de ser PNG, JPG, WEBP o SVG.",
            );

            return;
        }

        if (
            archivo.size >
            MAX_IMAGEN_BYTES
        ) {
            setErrorAccion(
                "L'escut és massa gran. Utilitza una imatge inferior a 2 MB.",
            );

            return;
        }

        try {
            const imagen =
                await leerImagen(
                    archivo,
                );

            setDatosEdicion(
                actual => ({
                    ...actual,

                    escudo:
                        imagen,
                }),
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut carregar la imatge.",
            );
        }
    }

    // ========================================================
    // GUARDAR EDICIÓN
    // ========================================================

    async function guardarEdicion() {
        if (
            !datos ||
            guardando
        ) {
            return;
        }

        setErrorAccion(
            "",
        );

        setMensaje(
            "",
        );

        if (
            datosEdicion
                .accesoCapitan &&
            !capitanEdicion
        ) {
            setErrorAccion(
                "Per donar accés al capità primer has de seleccionar-lo.",
            );

            return;
        }

        setGuardando(
            "editar",
        );

        try {
            await ejecutarPatch({
                accion:
                    "editar",

                formulario_updated_at:
                    datos.formulario
                        .updated_at,

                equipo_updated_at:
                    datos.equipo
                        .updated_at,

                responsable: {
                    email:
                        datosEdicion
                            .responsableEmail
                            .trim(),

                    vincular_usuario:
                        datosEdicion
                            .vincularResponsable,
                },

                acceso_capitan:
                    datosEdicion
                        .accesoCapitan,

                equipo: {
                    nombre:
                        datosEdicion
                            .nombre
                            .trim(),

                    escudo:
                        datosEdicion
                            .escudo,

                    capitan_email:
                        capitanEdicion
                            ?.email
                            .trim()
                            .toLowerCase() ??
                        "",

                    nota_admin:
                        datosEdicion
                            .notaAdmin
                            .trim(),
                },

                participantes:
                    participantesEdicion.map(
                        (
                            participante,
                            indice,
                        ) => ({
                            id:
                                participante.id,

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
            });

            setEditando(
                false,
            );

            setMensaje(
                "Les dades de l'equip s'han actualitzat correctament.",
            );

            await cargar(
                false,
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'han pogut guardar els canvis.",
            );
        } finally {
            setGuardando(
                null,
            );
        }
    }

    function cancelarEdicion() {
        if (
            !datos
        ) {
            return;
        }

        sincronizarEdicion(
            datos,
        );

        setEditando(
            false,
        );

        setErrorAccion(
            "",
        );
    }

    // ========================================================
    // APROBAR
    // ========================================================

    async function aprobar() {
        if (
            !datos ||
            guardando
        ) {
            return;
        }

        if (
            !window.confirm(
                "Vols aprovar aquesta inscripció? Es tornaran a validar totes les dades.",
            )
        ) {
            return;
        }

        setErrorAccion(
            "",
        );

        setMensaje(
            "",
        );

        setGuardando(
            "aprobar",
        );

        try {
            await ejecutarPatch({
                accion:
                    "aprobar",

                formulario_updated_at:
                    datos.formulario
                        .updated_at,
            });

            setMensaje(
                "La inscripció s'ha aprovat correctament.",
            );

            await cargar(
                false,
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut aprovar la inscripció.",
            );
        } finally {
            setGuardando(
                null,
            );
        }
    }

    // ========================================================
    // FINALIZAR BORRADOR ADMIN
    // ========================================================

    async function finalizarBorrador() {
        if (
            !datos ||
            guardando ||
            !datos.capacidades
                .finalizarBorrador
        ) {
            return;
        }

        if (
            !window.confirm(
                "Vols finalitzar aquest esborrany administratiu? Es comprovaran totes les dades i, si són correctes, l'equip quedarà aprovat.",
            )
        ) {
            return;
        }

        setErrorAccion(
            "",
        );

        setMensaje(
            "",
        );

        setGuardando(
            "finalizar",
        );

        try {
            await ejecutarPatch({
                accion:
                    "finalizar-borrador",

                formulario_updated_at:
                    datos.formulario
                        .updated_at,
            });

            setMensaje(
                "L'esborrany s'ha finalitzat i aprovat correctament.",
            );

            await cargar(
                false,
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut finalitzar l'esborrany.",
            );
        } finally {
            setGuardando(
                null,
            );
        }
    }

    // ========================================================
    // CAMBIAR EVALUACIÓN
    // ========================================================

    async function guardarEstadoEvaluacion() {
        if (
            !datos ||
            guardando ||
            !datos.capacidades
                .cambiarEvaluacion ||
            datos.formulario
                .estado ===
                "BORRADOR"
        ) {
            return;
        }

        if (
            estadoEvaluacion ===
            datos.formulario
                .estado
        ) {
            return;
        }

        if (
            !window.confirm(
                mensajeConfirmacionEvaluacion(
                    datos.formulario
                        .estado,
                    estadoEvaluacion,
                ),
            )
        ) {
            return;
        }

        setErrorAccion(
            "",
        );

        setMensaje(
            "",
        );

        setGuardando(
            "evaluacion",
        );

        try {
            await ejecutarPatch({
                accion:
                    "cambiar-evaluacion",

                formulario_updated_at:
                    datos.formulario
                        .updated_at,

                estado:
                    estadoEvaluacion,
            });

            if (
                estadoEvaluacion ===
                "APROBADO"
            ) {
                setMensaje(
                    "La inscripció s'ha aprovat correctament.",
                );
            } else if (
                estadoEvaluacion ===
                "DENEGADO"
            ) {
                setMensaje(
                    "La inscripció s'ha marcat com a no aprovada.",
                );
            } else {
                setMensaje(
                    "La inscripció s'ha tornat a posar en revisió.",
                );
            }

            await cargar(
                false,
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut modificar l'estat de l'avaluació.",
            );

            if (
                datos.formulario
                    .estado !==
                "BORRADOR"
            ) {
                setEstadoEvaluacion(
                    datos.formulario
                        .estado,
                );
            }
        } finally {
            setGuardando(
                null,
            );
        }
    }

    // ========================================================
    // OBSERVACIONES
    // ========================================================

    function actualizarObservacion(
        clave: string,
        cambios:
            Partial<ObservacionNueva>,
    ) {
        setObservacionesNuevas(
            actuales =>
                actuales.map(
                    observacion =>
                        observacion.clave ===
                        clave
                            ? {
                                  ...observacion,
                                  ...cambios,
                              }
                            : observacion,
                ),
        );
    }

    function eliminarObservacion(
        clave: string,
    ) {
        setObservacionesNuevas(
            actuales => {
                const nuevas =
                    actuales.filter(
                        observacion =>
                            observacion.clave !==
                            clave,
                    );

                return nuevas.length >
                    0
                    ? nuevas
                    : [
                          observacionVacia(),
                      ];
            },
        );
    }

    // ========================================================
    // SOLICITAR CAMBIOS
    // ========================================================

    async function solicitarCambios() {
        if (
            !datos ||
            guardando
        ) {
            return;
        }

        const preparadas =
            observacionesNuevas.filter(
                observacion =>
                    observacion
                        .mensaje
                        .trim(),
            );

        if (
            preparadas.length ===
            0
        ) {
            setErrorAccion(
                "Has d'indicar almenys una correcció.",
            );

            return;
        }

        for (
            const observacion
            of preparadas
        ) {
            if (
                observacion
                    .entidad_tipo ===
                    "PARTICIPANTE" &&
                !observacion
                    .participante_id
            ) {
                setErrorAccion(
                    "Selecciona el participant al qual correspon cada observació.",
                );

                return;
            }
        }

        if (
            !window.confirm(
                "Vols marcar la inscripció com a pendent de correccions?",
            )
        ) {
            return;
        }

        setErrorAccion(
            "",
        );

        setMensaje(
            "",
        );

        setGuardando(
            "cambios",
        );

        try {
            await ejecutarPatch({
                accion:
                    "solicitar-cambios",

                formulario_updated_at:
                    datos.formulario
                        .updated_at,

                observaciones:
                    preparadas.map(
                        observacion => ({
                            entidad_tipo:
                                observacion
                                    .entidad_tipo,

                            entidad_id:
                                observacion
                                    .entidad_tipo ===
                                    "FORMULARIO"
                                    ? datos.formulario.id
                                    : observacion
                                            .entidad_tipo ===
                                        "EQUIPO"
                                      ? datos.equipo.id
                                      : observacion
                                            .participante_id,

                            campo:
                                observacion.campo,

                            mensaje:
                                observacion
                                    .mensaje
                                    .trim(),
                        }),
                    ),
            });

            setObservacionesNuevas([
                observacionVacia(),
            ]);

            setMensaje(
                datos.formulario
                    .estado ===
                    "APROBADO"
                    ? "L'aprovació s'ha revocat i s'han registrat les correccions."
                    : "La inscripció s'ha retornat amb les correccions indicades.",
            );

            await cargar(
                false,
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut registrar la correcció.",
            );
        } finally {
            setGuardando(
                null,
            );
        }
    }

    // ========================================================
    // PLAZA
    // ========================================================

    async function guardarPlaza() {
        if (
            !datos ||
            guardando
        ) {
            return;
        }

        let posicion:
            number | null =
            null;

        if (
            plazaEstado ===
            "LISTA_ESPERA"
        ) {
            const valor =
                Number(
                    posicionListaEspera,
                );

            if (
                !Number.isSafeInteger(
                    valor,
                ) ||
                valor <
                    1
            ) {
                setErrorAccion(
                    "Indica una posició vàlida de la llista d'espera.",
                );

                return;
            }

            posicion =
                valor;
        }

        setErrorAccion(
            "",
        );

        setMensaje(
            "",
        );

        setGuardando(
            "plaza",
        );

        try {
            await ejecutarPatch({
                accion:
                    "cambiar-plaza",

                equipo_updated_at:
                    datos.equipo
                        .updated_at,

                plaza_estado:
                    plazaEstado,

                posicion_lista_espera:
                    posicion,

                nota_admin:
                    notaPlaza
                        .trim(),
            });

            setMensaje(
                "L'estat de la plaça s'ha actualitzat.",
            );

            await cargar(
                false,
            );
        } catch (
            error
        ) {
            setErrorAccion(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut actualitzar la plaça.",
            );
        } finally {
            setGuardando(
                null,
            );
        }
    }

    // ========================================================
    // CARGANDO
    // ========================================================

    if (
        cargando
    ) {
        return (
            <div className="flex min-h-96 items-center justify-center">
                <Cargando />
            </div>
        );
    }

    // ========================================================
    // ERROR
    // ========================================================

    if (
        !datos
    ) {
        return (
            <div className="rounded-2xl border border-error/20 bg-error/5 p-6 text-center">
                <h2 className="text-lg font-semibold text-neutral-titulos">
                    No s'ha pogut carregar l'equip
                </h2>

                <p className="mt-2 text-sm text-error">
                    {errorCarga || "L'equip no està disponible."}
                </p>

                <a href={volver} className="mt-5 inline-flex rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                    Tornar als equips
                </a>
            </div>
        );
    }

    const {
        torneo,
        edicion,
        configuracion,
        equipo,
        formulario,
        responsable,
        participantes,
        capacidades,
    } =
        datos;

    // ========================================================
    // UI
    // ========================================================

    return (
        <div className="flex flex-col gap-6">

            {/* MENSAJES */}

            {mensaje && (
                <div role="status" className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm font-medium text-primary">
                    {mensaje}
                </div>
            )}

            {errorAccion && (
                <div role="alert" className="rounded-xl border border-error/25 bg-error/5 p-4 text-sm text-error">
                    {errorAccion}
                </div>
            )}

            {/* CABECERA */}

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="flex flex-col gap-5 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                    <div className="flex min-w-0 items-center gap-4">
                        {equipo.escudo ? (
                            <img src={equipo.escudo} alt="" className="h-20 w-20 shrink-0 rounded-2xl border border-border bg-white object-contain p-2" />
                        ) : (
                            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-9 w-9 fill-current" aria-hidden="true">
                                    <path d="m480-80-120-40q-120-40-200-150T80-520v-240l400-120 400 120v240q0 140-80 250T600-120L480-80Z" />
                                </svg>
                            </span>
                        )}

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="truncate text-2xl font-bold text-neutral-titulos">
                                    {equipo.nombre || "Equip sense nom"}
                                </h1>

                                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${claseEstadoFormulario(formulario.estado)}`}>
                                    {textoEstadoFormulario(formulario.estado)}
                                </span>

                                <span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-semibold text-neutral">
                                    {textoOrigen(formulario.origen)}
                                </span>
                            </div>

                            <p className="mt-1 text-sm text-neutral">
                                {torneo.nombre} · {edicion.nombre}
                            </p>

                            <div className="mt-2 flex flex-wrap gap-2">
                                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${claseEstadoPlaza(equipo.plaza_estado)}`}>
                                    Plaça: {textoEstadoPlaza(equipo.plaza_estado)}
                                </span>

                                <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-neutral">
                                    {participantes.total} participants
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {capacidades.editar && !editando && (
                            <button type="button" onClick={() => {
                                setMensaje("");
                                setErrorAccion("");
                                setEditando(true);
                            }} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                                Editar dades
                            </button>
                        )}

                        <a href={volver} className="inline-flex items-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                            Tornar
                        </a>
                    </div>
                </div>

                {formulario.estado === "EN_REVISION" && (
                    <div className="border-t border-secondary/20 bg-secondary/5 px-5 py-3 text-xs font-medium text-secondary md:px-6">
                        Aquesta inscripció està pendent d'avaluació.
                    </div>
                )}

                {formulario.estado === "APROBADO" && (
                    <div className="border-t border-primary/20 bg-primary/5 px-5 py-3 text-xs font-medium text-primary md:px-6">
                        Aquesta inscripció està aprovada. L'estat encara pot ser modificat per administració.
                    </div>
                )}

                {formulario.estado === "DENEGADO" && (
                    <div className="border-t border-error/20 bg-error/5 px-5 py-3 text-xs font-medium text-error md:px-6">
                        Aquesta inscripció està marcada com a pendent de correccions.
                    </div>
                )}

                {formulario.estado === "BORRADOR" && formulario.origen === "ADMIN" && (
                    <div className="border-t border-primary/20 bg-primary/5 px-5 py-3 text-xs font-medium text-primary md:px-6">
                        Esborrany creat des del panell d'administració.
                    </div>
                )}

                {formulario.estado === "BORRADOR" && formulario.origen === "USUARIO" && (
                    <div className="border-t border-border bg-background px-5 py-3 text-xs font-medium text-neutral md:px-6">
                        Esborrany creat per l'usuari. Encara no s'ha presentat com a inscripció.
                    </div>
                )}
            </section>

            {/* EDICIÓN */}

            {editando ? (
                <section className="rounded-2xl border border-primary/30 bg-card">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 md:p-6">
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-titulos">
                                Editar dades de l'equip
                            </h2>

                            <p className="mt-1 text-sm text-neutral">
                                Modifica les dades administratives de l'equip.
                            </p>
                        </div>

                        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                            Mode edició
                        </span>
                    </div>

                    {/* EQUIPO */}

                    <div className="border-b border-border p-5 md:p-6">
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Equip
                        </h3>

                        <div className="mt-4 grid gap-5 lg:grid-cols-[150px_minmax(0,1fr)]">
                            <div>
                                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-background">
                                    {datosEdicion.escudo ? (
                                        <img src={datosEdicion.escudo} alt="" className="h-full w-full object-contain p-3" />
                                    ) : (
                                        <span className="text-xs text-neutral">
                                            Sense escut
                                        </span>
                                    )}
                                </div>

                                <label className="mt-3 inline-flex cursor-pointer rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:text-primary">
                                    Canviar escut
                                    <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(evento) => void seleccionarEscudo(evento)} className="sr-only" />
                                </label>

                                {datosEdicion.escudo && (
                                    <button type="button" onClick={() => setDatosEdicion((actual) => ({ ...actual, escudo: null }))} className="mt-2 block text-xs font-semibold text-error">
                                        Eliminar
                                    </button>
                                )}
                            </div>

                            <div className="grid gap-4">
                                <label>
                                    <span className="text-xs font-semibold text-neutral-titulos">
                                        Nom de l'equip
                                    </span>

                                    <input type="text" maxLength={80} value={datosEdicion.nombre} onChange={(evento) => setDatosEdicion((actual) => ({ ...actual, nombre: evento.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                </label>

                                <label>
                                    <span className="text-xs font-semibold text-neutral-titulos">
                                        Nota administrativa
                                    </span>

                                    <textarea rows={3} maxLength={4000} value={datosEdicion.notaAdmin} onChange={(evento) => setDatosEdicion((actual) => ({ ...actual, notaAdmin: evento.target.value }))} className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* RESPONSABLE */}

                    <div className="border-b border-border p-5 md:p-6">
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Responsable
                        </h3>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <label>
                                <span className="text-xs font-semibold text-neutral-titulos">
                                    Correu
                                </span>

                                <input type="email" value={datosEdicion.responsableEmail} onChange={(evento) => setDatosEdicion((actual) => ({ ...actual, responsableEmail: evento.target.value }))} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
                            </label>

                            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4">
                                <input type="checkbox" checked={datosEdicion.vincularResponsable} onChange={(evento) => setDatosEdicion((actual) => ({ ...actual, vincularResponsable: evento.target.checked }))} className="mt-0.5 h-4 w-4 accent-primary" />

                                <span>
                                    <span className="block text-sm font-semibold text-neutral-titulos">
                                        Vincular a un compte
                                    </span>

                                    <span className="mt-1 block text-xs text-neutral">
                                        L'usuari podrà consultar aquesta inscripció des del seu perfil.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* PARTICIPANTES */}

                    <div className="border-b border-border p-5 md:p-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-neutral-titulos">
                                    Participants
                                </h3>

                                <p className="mt-1 text-xs text-neutral">
                                    {resumenEdicion.total} participants · {resumenEdicion.computables} computables
                                    {configuracion.genero.activo ? ` · ${resumenEdicion.masculinos} masculins · ${resumenEdicion.femeninos} femenins` : ""}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {tiposDisponibles.map((tipo) => (
                                    <button key={tipo.valor} type="button" onClick={() => agregarParticipante(tipo.valor)} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:border-primary/30 hover:text-primary">
                                        + {tipo.nombre}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 flex flex-col gap-4">
                            {participantesEdicion.length === 0 && (
                                <div className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-neutral">
                                    Encara no hi ha participants.
                                </div>
                            )}

                            {participantesEdicion.map((participante, indice) => {
                                const cursoSeleccionado =
                                    configuracion.cursos.find(
                                        curso =>
                                            curso.curso ===
                                            participante.curso,
                                    );

                                const mostrarCampoGenero =
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
                                                        {nombreParticipante(participante) || textoTipo(participante.tipo_participante)}
                                                    </p>

                                                    <p className="text-[10px] text-neutral">
                                                        {participante.id ? "Participant existent" : "Nou participant"}
                                                    </p>
                                                </div>
                                            </div>

                                            <button type="button" onClick={() => retirarParticipante(participante.clave)} className="rounded-lg px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/10">
                                                Retirar
                                            </button>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                            <label>
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Tipus
                                                </span>

                                                <select value={participante.tipo_participante} onChange={(evento) => actualizarParticipante(participante.clave, "tipo_participante", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
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

                                                <input type="text" value={participante.nombre} onChange={(evento) => actualizarParticipante(participante.clave, "nombre", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary" />
                                            </label>

                                            <label>
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Primer llinatge
                                                </span>

                                                <input type="text" value={participante.apellido1} onChange={(evento) => actualizarParticipante(participante.clave, "apellido1", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary" />
                                            </label>

                                            <label>
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Segon llinatge
                                                </span>

                                                <input type="text" value={participante.apellido2} onChange={(evento) => actualizarParticipante(participante.clave, "apellido2", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary" />
                                            </label>

                                            <label className="sm:col-span-2">
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Correu electrònic
                                                </span>

                                                <input type="email" value={participante.email} onChange={(evento) => actualizarParticipante(participante.clave, "email", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary" />
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
                                                        }} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                            <option value="">
                                                                Selecciona...
                                                            </option>

                                                            {configuracion.cursos.map((curso) => (
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

                                                        <select value={participante.grupo} disabled={!cursoSeleccionado || cursoSeleccionado.grupos.length === 0} onChange={(evento) => actualizarParticipante(participante.clave, "grupo", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none disabled:opacity-50 focus:border-primary">
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

                                            {mostrarCampoGenero && (
                                                <label>
                                                    <span className="text-[11px] font-semibold text-neutral-titulos">
                                                        Gènere
                                                    </span>

                                                    <select value={participante.genero} onChange={(evento) => actualizarParticipante(participante.clave, "genero", evento.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
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
                            })}
                        </div>
                    </div>

                    {/* CAPITÁN */}

                    <div className="border-b border-border p-5 md:p-6">
                        <h3 className="text-sm font-semibold text-neutral-titulos">
                            Capità
                        </h3>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            <label>
                                <span className="text-xs font-semibold text-neutral-titulos">
                                    Jugador capità
                                </span>

                                <select value={capitanClave} onChange={(evento) => {
                                    setCapitanClave(evento.target.value);

                                    if (!evento.target.value) {
                                        setDatosEdicion((actual) => ({
                                            ...actual,
                                            accesoCapitan: false,
                                        }));
                                    }
                                }} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                    <option value="">
                                        Sense seleccionar
                                    </option>

                                    {jugadoresEdicion.map((jugador) => (
                                        <option key={jugador.clave} value={jugador.clave}>
                                            {nombreParticipante(jugador) || "Jugador sense nom"}
                                            {jugador.email ? ` · ${jugador.email}` : ""}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className={`flex items-start gap-3 rounded-xl border border-border bg-background p-4 ${capitanEdicion ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                                <input type="checkbox" disabled={!capitanEdicion} checked={datosEdicion.accesoCapitan} onChange={(evento) => setDatosEdicion((actual) => ({ ...actual, accesoCapitan: evento.target.checked }))} className="mt-0.5 h-4 w-4 accent-primary" />

                                <span>
                                    <span className="block text-sm font-semibold text-neutral-titulos">
                                        Permetre accés al capità
                                    </span>

                                    <span className="mt-1 block text-xs text-neutral">
                                        Podrà accedir a la inscripció amb un compte que utilitzi aquest correu.
                                    </span>
                                </span>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2 p-5 md:p-6">
                        <button type="button" disabled={guardando !== null} onClick={cancelarEdicion} className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary/30 disabled:opacity-50">
                            Cancel·lar
                        </button>

                        <button type="button" disabled={guardando !== null} onClick={() => void guardarEdicion()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                            {guardando === "editar" && (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            )}

                            Desar canvis
                        </button>
                    </div>
                </section>
            ) : (
                <>
                    {/* RESUMEN */}

                    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs text-neutral">
                                Participants
                            </p>

                            <p className="mt-1 text-2xl font-bold text-neutral-titulos">
                                {participantes.total}
                            </p>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs text-neutral">
                                Jugadors
                            </p>

                            <p className="mt-1 text-2xl font-bold text-neutral-titulos">
                                {participantes.jugadores}
                            </p>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs text-neutral">
                                Professorat
                            </p>

                            <p className="mt-1 text-2xl font-bold text-neutral-titulos">
                                {participantes.profesores}
                            </p>
                        </div>

                        <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs text-neutral">
                                Observacions actives
                            </p>

                            <p className="mt-1 text-2xl font-bold text-neutral-titulos">
                                {observacionesActivas.length}
                            </p>
                        </div>
                    </section>

                    {/* RESPONSABLE Y CAPITÁN */}

                    <div className="grid gap-6 xl:grid-cols-2">
                        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
                            <h2 className="text-lg font-semibold text-neutral-titulos">
                                Responsable
                            </h2>

                            <dl className="mt-5 grid gap-4">
                                <div>
                                    <dt className="text-xs font-semibold text-neutral">
                                        Nom
                                    </dt>

                                    <dd className="mt-1 text-sm font-medium text-neutral-titulos">
                                        {responsable.nombre_completo || "Sense usuari vinculat"}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-xs font-semibold text-neutral">
                                        Correu de contacte
                                    </dt>

                                    <dd className="mt-1 break-all text-sm text-neutral-titulos">
                                        {responsable.email || formulario.email_contacto || "—"}
                                    </dd>
                                </div>

                                <div>
                                    <dt className="text-xs font-semibold text-neutral">
                                        Vinculació
                                    </dt>

                                    <dd className="mt-1 text-sm text-neutral-titulos">
                                        {formulario.usuario_id ? "Compte d'usuari vinculat" : "Només contacte"}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
                            <h2 className="text-lg font-semibold text-neutral-titulos">
                                Capità
                            </h2>

                            {participantes.capitan ? (
                                <dl className="mt-5 grid gap-4">
                                    <div>
                                        <dt className="text-xs font-semibold text-neutral">
                                            Nom
                                        </dt>

                                        <dd className="mt-1 text-sm font-medium text-neutral-titulos">
                                            {participantes.capitan.nombre_completo}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt className="text-xs font-semibold text-neutral">
                                            Correu
                                        </dt>

                                        <dd className="mt-1 text-sm text-neutral-titulos">
                                            {participantes.capitan.email || "—"}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt className="text-xs font-semibold text-neutral">
                                            Accés al formulari
                                        </dt>

                                        <dd className="mt-1 text-sm text-neutral-titulos">
                                            {formulario.acceso_capitan ? "Permès" : "No permès"}
                                        </dd>
                                    </div>
                                </dl>
                            ) : (
                                <p className="mt-4 text-sm text-neutral">
                                    No hi ha cap capità seleccionat.
                                </p>
                            )}
                        </section>
                    </div>

                    {/* PARTICIPANTES */}

                    <section className="overflow-hidden rounded-2xl border border-border bg-card">
                        <div className="border-b border-border p-5 md:p-6">
                            <h2 className="text-lg font-semibold text-neutral-titulos">
                                Participants
                            </h2>
                        </div>

                        {participantes.filas.length === 0 ? (
                            <div className="p-8 text-center text-sm text-neutral">
                                Aquest equip encara no té participants.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[900px] text-left">
                                    <thead className="border-b border-border bg-background">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-semibold text-neutral">
                                                Participant
                                            </th>

                                            <th className="px-4 py-3 text-xs font-semibold text-neutral">
                                                Tipus
                                            </th>

                                            <th className="px-4 py-3 text-xs font-semibold text-neutral">
                                                Correu
                                            </th>

                                            <th className="px-4 py-3 text-xs font-semibold text-neutral">
                                                Curs
                                            </th>

                                            <th className="px-4 py-3 text-xs font-semibold text-neutral">
                                                Gènere
                                            </th>

                                            <th className="px-4 py-3 text-xs font-semibold text-neutral">
                                                Validació
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-border">
                                        {participantes.filas.map((participante) => (
                                            <tr key={participante.id}>
                                                <td className="px-4 py-3">
                                                    <p className="text-sm font-semibold text-neutral-titulos">
                                                        {participante.nombre_completo || "Sense nom"}

                                                        {participante.es_capitan && (
                                                            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                                Capità
                                                            </span>
                                                        )}
                                                    </p>
                                                </td>

                                                <td className="px-4 py-3 text-sm text-neutral">
                                                    {textoTipo(participante.tipo_participante)}
                                                </td>

                                                <td className="px-4 py-3 text-sm text-neutral">
                                                    {participante.email || "—"}
                                                </td>

                                                <td className="px-4 py-3 text-sm text-neutral">
                                                    {[participante.curso, participante.grupo].filter(Boolean).join(" · ") || "—"}
                                                </td>

                                                <td className="px-4 py-3 text-sm text-neutral">
                                                    {mostrarGenero(participante.genero)}
                                                </td>

                                                <td className="px-4 py-3 text-xs font-semibold text-neutral">
                                                    {participante.validacion_estado}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            {/* =================================================
                ESTADO DE EVALUACIÓN
            ================================================= */}

            {!editando && capacidades.cambiarEvaluacion && formulario.estado !== "BORRADOR" && (
                <section className="rounded-2xl border border-border bg-card">
                    <div className="border-b border-border p-5 md:p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral">
                            Administració
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-neutral-titulos">
                            Estat de l'avaluació
                        </h2>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral">
                            L'estat no és definitiu. Si després de l'aprovació detectes un problema, pots tornar la inscripció a revisió o marcar-la com a no aprovada. La plaça es manté independent.
                        </p>
                    </div>

                    <div className="p-5 md:p-6">
                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <label>
                                <span className="text-xs font-semibold text-neutral-titulos">
                                    Estat
                                </span>

                                <select value={estadoEvaluacion} disabled={guardando !== null} onChange={(evento) => setEstadoEvaluacion(evento.target.value as EstadoEvaluacion)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50">
                                    <option value="EN_REVISION">
                                        En revisió
                                    </option>

                                    <option value="APROBADO">
                                        Aprovada
                                    </option>

                                    <option value="DENEGADO">
                                        Requereix canvis / No aprovada
                                    </option>
                                </select>
                            </label>

                            <button type="button" disabled={guardando !== null || estadoEvaluacion === formulario.estado} onClick={() => void guardarEstadoEvaluacion()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
                                {guardando === "evaluacion" && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                )}

                                Desar estat
                            </button>
                        </div>

                        {estadoEvaluacion === "APROBADO" && estadoEvaluacion !== formulario.estado && (
                            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                                <p className="text-xs leading-5 text-primary">
                                    Abans d'aprovar es tornaran a validar participants, correus, cursos, grups, capità, límits de l'equip i possibles duplicats.
                                </p>
                            </div>
                        )}

                        {estadoEvaluacion === "EN_REVISION" && estadoEvaluacion !== formulario.estado && (
                            <div className="mt-4 rounded-xl border border-secondary/20 bg-secondary/5 p-4">
                                <p className="text-xs leading-5 text-secondary">
                                    L'equip i tots els participants tornaran a quedar pendents de validació. La plaça actual no canviarà.
                                </p>
                            </div>
                        )}

                        {estadoEvaluacion === "DENEGADO" && estadoEvaluacion !== formulario.estado && (
                            <div className="mt-4 rounded-xl border border-error/20 bg-error/5 p-4">
                                <p className="text-xs leading-5 text-error">
                                    Aquesta opció canvia directament l'estat a no aprovada. Si vols indicar a l'usuari què ha de corregir, utilitza la secció de correccions.
                                </p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* =================================================
                BORRADOR ADMIN
            ================================================= */}

            {!editando && formulario.estado === "BORRADOR" && formulario.origen === "ADMIN" && (
                <section className="rounded-2xl border border-primary/30 bg-card">
                    <div className="p-5 md:p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                            Esborrany administratiu
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-neutral-titulos">
                            Finalitzar la inscripció
                        </h2>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral">
                            Pots continuar editant aquest equip mentre sigui un esborrany. Quan totes les dades siguin correctes, finalitzar-lo executarà totes les validacions i el convertirà directament en aprovat.
                        </p>

                        <div className="mt-4 rounded-xl border border-border bg-background p-4">
                            <p className="text-sm font-semibold text-neutral-titulos">
                                Validació completa
                            </p>

                            <p className="mt-1 text-xs leading-5 text-neutral">
                                Es comprovaran participants, correus, cursos, grups, mínims i màxims, gènere, capità i possibles duplicats amb altres equips.
                            </p>
                        </div>

                        {capacidades.finalizarBorrador ? (
                            <button type="button" disabled={guardando !== null} onClick={() => void finalizarBorrador()} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                                {guardando === "finalizar" && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                )}

                                Finalitzar i aprovar
                            </button>
                        ) : (
                            <p className="mt-4 text-xs font-medium text-neutral">
                                No tens permís per finalitzar aquest esborrany.
                            </p>
                        )}
                    </div>
                </section>
            )}

            {/* BORRADOR USUARIO */}

            {!editando && formulario.estado === "BORRADOR" && formulario.origen === "USUARIO" && (
                <section className="rounded-2xl border border-border bg-background p-5 md:p-6">
                    <p className="text-sm font-semibold text-neutral-titulos">
                        Aquesta inscripció encara és un esborrany de l'usuari
                    </p>

                    <p className="mt-1 text-xs leading-5 text-neutral">
                        Encara no s'ha presentat per a revisió. L'usuari o el capità autoritzat l'ha d'enviar des del formulari d'inscripció.
                    </p>
                </section>
            )}

            {/* =================================================
                EVALUACIÓN EN REVISIÓN
            ================================================= */}

            {!editando && formulario.estado === "EN_REVISION" && capacidades.evaluar && (
                <section className="rounded-2xl border border-secondary/30 bg-card">
                    <div className="border-b border-border p-5 md:p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                            Revisió
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-neutral-titulos">
                            Avaluar la inscripció
                        </h2>

                        <p className="mt-2 text-sm leading-6 text-neutral">
                            Pots aprovar tota la inscripció o retornar-la indicant exactament què s'ha de corregir.
                        </p>
                    </div>

                    <div className="p-5 md:p-6">
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <p className="text-sm font-semibold text-neutral-titulos">
                                Tot és correcte
                            </p>

                            <p className="mt-1 text-xs leading-5 text-neutral">
                                Aprovar tornarà a comprovar les dades reals guardades.
                            </p>

                            <button type="button" disabled={guardando !== null} onClick={() => void aprobar()} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                                {guardando === "aprobar" && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                )}

                                Aprovar inscripció
                            </button>
                        </div>

                        <div className="mt-6 border-t border-border pt-6">
                            <h3 className="text-sm font-semibold text-neutral-titulos">
                                Sol·licitar correccions
                            </h3>

                            <p className="mt-1 text-xs leading-5 text-neutral">
                                Cada observació pot correspondre al formulari, a l'equip o a un participant concret.
                            </p>

                            <div className="mt-4 flex flex-col gap-3">
                                {observacionesNuevas.map((observacion, indice) => {
                                    const campos =
                                        camposObservacion(
                                            observacion.entidad_tipo,
                                        );

                                    return (
                                        <article key={observacion.clave} className="rounded-xl border border-border bg-background p-4">
                                            <div className="mb-4 flex items-center justify-between gap-3">
                                                <p className="text-xs font-semibold text-neutral-titulos">
                                                    Correcció {indice + 1}
                                                </p>

                                                <button type="button" onClick={() => eliminarObservacion(observacion.clave)} className="text-xs font-semibold text-error">
                                                    Eliminar
                                                </button>
                                            </div>

                                            <div className="grid gap-4 lg:grid-cols-3">
                                                <label>
                                                    <span className="text-[11px] font-semibold text-neutral-titulos">
                                                        Element
                                                    </span>

                                                    <select value={observacion.entidad_tipo} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                        entidad_tipo: evento.target.value as TipoEntidadObservacion,
                                                        participante_id: "",
                                                        campo: "general",
                                                    })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                        <option value="EQUIPO">
                                                            Equip
                                                        </option>

                                                        <option value="PARTICIPANTE">
                                                            Participant
                                                        </option>

                                                        <option value="FORMULARIO">
                                                            Formulari
                                                        </option>
                                                    </select>
                                                </label>

                                                {observacion.entidad_tipo === "PARTICIPANTE" && (
                                                    <label>
                                                        <span className="text-[11px] font-semibold text-neutral-titulos">
                                                            Participant
                                                        </span>

                                                        <select value={observacion.participante_id} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                            participante_id: evento.target.value,
                                                        })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                            <option value="">
                                                                Selecciona...
                                                            </option>

                                                            {participantes.filas.map((participante) => (
                                                                <option key={participante.id} value={participante.id}>
                                                                    {participante.nombre_completo || participante.email || "Participant"}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </label>
                                                )}

                                                <label>
                                                    <span className="text-[11px] font-semibold text-neutral-titulos">
                                                        Camp
                                                    </span>

                                                    <select value={observacion.campo} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                        campo: evento.target.value,
                                                    })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                        {campos.map((campo) => (
                                                            <option key={campo.valor} value={campo.valor}>
                                                                {campo.nombre}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            </div>

                                            <label className="mt-4 block">
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Què s'ha de corregir?
                                                </span>

                                                <textarea rows={3} maxLength={2000} value={observacion.mensaje} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                    mensaje: evento.target.value,
                                                })} placeholder="Explica de manera clara què s'ha de modificar..." className="mt-1.5 w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none placeholder:text-neutral/50 focus:border-primary" />
                                            </label>
                                        </article>
                                    );
                                })}
                            </div>

                            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                <button type="button" onClick={() => setObservacionesNuevas((actuales) => [...actuales, observacionVacia()])} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:text-primary">
                                    + Afegir correcció
                                </button>

                                <button type="button" disabled={guardando !== null} onClick={() => void solicitarCambios()} className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                                    {guardando === "cambios" && (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                    )}

                                    Sol·licitar canvis
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {/* =================================================
                CORREGIR UN APROBADO
            ================================================= */}

            {!editando && formulario.estado === "APROBADO" && capacidades.evaluar && (
                <section className="rounded-2xl border border-error/20 bg-card">
                    <div className="border-b border-border p-5 md:p-6">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-error">
                            Revisió posterior
                        </p>

                        <h2 className="mt-1 text-xl font-semibold text-neutral-titulos">
                            Has detectat un error després d'aprovar?
                        </h2>

                        <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral">
                            Pots revocar l'aprovació indicant les correccions necessàries. L'estat passarà a requerir canvis i la plaça no es modificarà.
                        </p>
                    </div>

                    <div className="p-5 md:p-6">
                        <div className="flex flex-col gap-3">
                            {observacionesNuevas.map((observacion, indice) => {
                                const campos =
                                    camposObservacion(
                                        observacion.entidad_tipo,
                                    );

                                return (
                                    <article key={observacion.clave} className="rounded-xl border border-border bg-background p-4">
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <p className="text-xs font-semibold text-neutral-titulos">
                                                Correcció {indice + 1}
                                            </p>

                                            <button type="button" onClick={() => eliminarObservacion(observacion.clave)} className="text-xs font-semibold text-error">
                                                Eliminar
                                            </button>
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <label>
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Element
                                                </span>

                                                <select value={observacion.entidad_tipo} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                    entidad_tipo: evento.target.value as TipoEntidadObservacion,
                                                    participante_id: "",
                                                    campo: "general",
                                                })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                    <option value="EQUIPO">
                                                        Equip
                                                    </option>

                                                    <option value="PARTICIPANTE">
                                                        Participant
                                                    </option>

                                                    <option value="FORMULARIO">
                                                        Formulari
                                                    </option>
                                                </select>
                                            </label>

                                            {observacion.entidad_tipo === "PARTICIPANTE" && (
                                                <label>
                                                    <span className="text-[11px] font-semibold text-neutral-titulos">
                                                        Participant
                                                    </span>

                                                    <select value={observacion.participante_id} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                        participante_id: evento.target.value,
                                                    })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                        <option value="">
                                                            Selecciona...
                                                        </option>

                                                        {participantes.filas.map((participante) => (
                                                            <option key={participante.id} value={participante.id}>
                                                                {participante.nombre_completo || participante.email || "Participant"}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </label>
                                            )}

                                            <label>
                                                <span className="text-[11px] font-semibold text-neutral-titulos">
                                                    Camp
                                                </span>

                                                <select value={observacion.campo} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                    campo: evento.target.value,
                                                })} className="mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
                                                    {campos.map((campo) => (
                                                        <option key={campo.valor} value={campo.valor}>
                                                            {campo.nombre}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                        </div>

                                        <label className="mt-4 block">
                                            <span className="text-[11px] font-semibold text-neutral-titulos">
                                                Què s'ha de corregir?
                                            </span>

                                            <textarea rows={3} maxLength={2000} value={observacion.mensaje} onChange={(evento) => actualizarObservacion(observacion.clave, {
                                                mensaje: evento.target.value,
                                            })} placeholder="Indica el problema detectat..." className="mt-1.5 w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-neutral-titulos outline-none placeholder:text-neutral/50 focus:border-primary" />
                                        </label>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <button type="button" onClick={() => setObservacionesNuevas((actuales) => [...actuales, observacionVacia()])} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:text-primary">
                                + Afegir correcció
                            </button>

                            <button type="button" disabled={guardando !== null} onClick={() => void solicitarCambios()} className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                                {guardando === "cambios" && (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                )}

                                Revocar aprovació i sol·licitar canvis
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* OBSERVACIONES ACTIVAS */}

            {!editando && observacionesActivas.length > 0 && (
                <section className="rounded-2xl border border-error/20 bg-card">
                    <div className="border-b border-border p-5 md:p-6">
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Correccions pendents
                        </h2>
                    </div>

                    <div className="flex flex-col gap-3 p-5 md:p-6">
                        {observacionesActivas.map((observacion) => {
                            const participante =
                                observacion.entidad_tipo ===
                                "PARTICIPANTE"
                                    ? participantes.filas.find(
                                          fila =>
                                              fila.id ===
                                              observacion.entidad_id,
                                      )
                                    : null;

                            return (
                                <div key={observacion.id} className="rounded-xl border border-error/15 bg-error/5 p-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="rounded-full bg-error/10 px-2 py-1 text-[10px] font-semibold uppercase text-error">
                                            {observacion.entidad_tipo}
                                        </span>

                                        <span className="text-xs font-semibold text-neutral-titulos">
                                            {participante?.nombre_completo || observacion.campo}
                                        </span>
                                    </div>

                                    <p className="mt-2 text-sm leading-6 text-neutral-titulos">
                                        {observacion.mensaje}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* PLAZA */}

            {!editando && capacidades.cambiarEstado && formulario.estado !== "BORRADOR" && (
                <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Gestió de la plaça
                        </h2>

                        <p className="mt-1 text-sm text-neutral">
                            La plaça és independent de l'estat d'avaluació. Revocar una aprovació no modifica automàticament aquesta informació.
                        </p>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <label>
                            <span className="text-xs font-semibold text-neutral-titulos">
                                Estat
                            </span>

                            <select value={plazaEstado} onChange={(evento) => {
                                const nuevo =
                                    evento.target.value as EstadoPlaza;

                                setPlazaEstado(
                                    nuevo,
                                );

                                if (
                                    nuevo !==
                                    "LISTA_ESPERA"
                                ) {
                                    setPosicionListaEspera(
                                        "",
                                    );
                                }
                            }} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary">
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

                        {plazaEstado === "LISTA_ESPERA" && (
                            <label>
                                <span className="text-xs font-semibold text-neutral-titulos">
                                    Posició
                                </span>

                                <input type="number" min={1} step={1} value={posicionListaEspera} onChange={(evento) => setPosicionListaEspera(evento.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary" />
                            </label>
                        )}

                        <label className={plazaEstado === "LISTA_ESPERA" ? "" : "lg:col-span-2"}>
                            <span className="text-xs font-semibold text-neutral-titulos">
                                Nota administrativa
                            </span>

                            <input type="text" maxLength={4000} value={notaPlaza} onChange={(evento) => setNotaPlaza(evento.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary" />
                        </label>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button type="button" disabled={guardando !== null} onClick={() => void guardarPlaza()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50">
                            {guardando === "plaza" && (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            )}

                            Desar plaça
                        </button>
                    </div>
                </section>
            )}

            {/* INFORMACIÓN */}

            {!editando && (
                <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Informació de la inscripció
                    </h2>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <div>
                            <p className="text-xs font-semibold text-neutral">
                                Origen
                            </p>

                            <p className="mt-1 text-sm text-neutral-titulos">
                                {textoOrigen(formulario.origen)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-neutral">
                                Creada
                            </p>

                            <p className="mt-1 text-sm text-neutral-titulos">
                                {mostrarFecha(formulario.created_at)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-neutral">
                                Enviada
                            </p>

                            <p className="mt-1 text-sm text-neutral-titulos">
                                {mostrarFecha(formulario.enviado_at)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-neutral">
                                Darrera avaluació
                            </p>

                            <p className="mt-1 text-sm text-neutral-titulos">
                                {mostrarFecha(formulario.completado_at)}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-neutral">
                                Darrera modificació
                            </p>

                            <p className="mt-1 text-sm text-neutral-titulos">
                                {mostrarFecha(formulario.updated_at)}
                            </p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}