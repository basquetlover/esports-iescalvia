import {
    useEffect,
    useMemo,
    useState,
} from "react";

import PasoEquipo from "./pasos/PasoEquipo";
import PasoJugadores from "./pasos/PasoJugadores";
import PasoProfesor from "./pasos/PasoProfesor";
import PasoEntrenador from "./pasos/PasoEntrenador";
import PasoStaff from "./pasos/PasoStaff";
import PasoCapitan from "./pasos/PasoCapitan";
import PasoResumen from "./pasos/PasoResumen";

// ============================================================
// API
// ============================================================

const API =
    "/api/inscripcio/equip";

// ============================================================
// TIPOS
// ============================================================

export type EstadoFormulario =
    | "BORRADOR"
    | "EN_REVISION"
    | "APROBADO"
    | "DENEGADO";

export type EstadoPlaza =
    | "PENDIENTE"
    | "CONFIRMADA"
    | "LISTA_ESPERA"
    | "SIN_PLAZA";

export type TipoParticipante =
    | "JUGADOR"
    | "PROFESOR"
    | "ENTRENADOR"
    | "STAFF";

export type GeneroParticipante =
    | "masculino"
    | "femenino";

export type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

export type ConfiguracionEquipos = {
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

export type TorneoFormulario = {
    id: string;
    nombre: string;
    deporte: string | null;
    logo: string | null;
    banner: string | null;
};

export type EdicionFormulario = {
    id: string;
    torneo_id: string;
    nombre: string;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string;
    sede: string | null;
};

export type EdicionDisponible = {
    id: string;
    nombre: string;

    torneo: {
        id: string;
        nombre: string;
        deporte: string | null;
        logo: string | null;
        banner: string | null;
    };

    apertura: string | null;
    cierre: string | null;
};

export type ParticipanteFormulario = {
    id: string | null;

    tipo_participante:
        TipoParticipante;

    nombre: string;
    apellido1: string;
    apellido2: string;

    email: string;

    curso: string;
    grupo: string;

    genero:
        GeneroParticipante | null;

    orden: number;
};

export type EquipoFormulario = {
    id: string | null;
    nombre: string;
    escudo: string | null;
    capitan_id: string | null;
    plaza_estado: EstadoPlaza;
    posicion_lista_espera: number | null;
};

export type ObservacionCampo = {
    id: string;
    entidad_tipo: string;
    entidad_id: string;
    campo: string;
    mensaje: string;
    estado: string;
};

export type DatosFormularioEquipo = {
    id: string | null;

    estado:
        EstadoFormulario;

    usuario_id:
        string | null;

    email_contacto:
        string;

    acceso_capitan:
        boolean;

    equipo:
        EquipoFormulario;

    participantes:
        ParticipanteFormulario[];

    observaciones:
        ObservacionCampo[];
};

export type SesionFormulario = {
    iniciada: boolean;

    usuario: {
        id: string;
        nombre: string | null;
        apellido1: string | null;
        apellido2: string | null;
        email: string | null;
    } | null;
};

export type PermisosFormulario = {
    propietario: boolean;
    capitan: boolean;
    puede_ver: boolean;
    puede_editar: boolean;
    puede_cambiar_acceso_capitan: boolean;
};

export type MotivoNoDisponible =
    | "SIN_EDICION"
    | "NO_TROBADA"
    | "PROXIMAMENTE"
    | "TANCADA"
    | "REGISTROS_DESHABILITADOS"
    | "SIN_CONFIGURACION"
    | "SIN_ACCESO";

export type RespuestaCargaFormulario = {
    success: true;

    disponible: boolean;

    motivo:
        MotivoNoDisponible | null;

    mensaje:
        string | null;

    sesion:
        SesionFormulario;

    torneo:
        TorneoFormulario | null;

    edicion:
        EdicionFormulario | null;

    configuracion:
        ConfiguracionEquipos | null;

    formulario:
        DatosFormularioEquipo | null;

    permisos:
        PermisosFormulario;

    edicionesDisponibles:
        EdicionDisponible[];

    accesoAdmin?:
        boolean;
};

type RespuestaGuardado = {
    success: boolean;
    mensaje?: string;
    formulario?: DatosFormularioEquipo;
};

export type PasoFormularioID =
    | "equip"
    | "jugadors"
    | "professorat"
    | "entrenador"
    | "staff"
    | "capita"
    | "resum";

export type PasoFormulario = {
    id: PasoFormularioID;
    titulo: string;
    descripcion: string;
};

// ============================================================
// PROPS
// ============================================================

type Props = {
    edicionID:
        string | null;
};

// ============================================================
// PERMISOS VACÍOS
// ============================================================

const PERMISOS_VACIOS:
    PermisosFormulario = {
        propietario: false,
        capitan: false,
        puede_ver: false,
        puede_editar: false,
        puede_cambiar_acceso_capitan: false,
    };

// ============================================================
// PARTICIPANTE VACÍO
// ============================================================

function crearParticipante(
    tipo:
        TipoParticipante,

    orden:
        number,
): ParticipanteFormulario {
    return {
        id: null,

        tipo_participante:
            tipo,

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
// COMPLETAR MÍNIMOS
// ============================================================

function completarMinimos(
    formulario:
        DatosFormularioEquipo,

    configuracion:
        ConfiguracionEquipos,
) {
    const participantes = [
        ...formulario.participantes,
    ];

    let siguienteOrden =
        participantes.reduce(
            (
                maximo,
                participante,
            ) =>
                Math.max(
                    maximo,
                    participante.orden,
                ),
            0,
        ) + 1;

    function completar(
        tipo:
            TipoParticipante,

        minimo:
            number,
    ) {
        if (
            minimo <=
            0
        ) {
            return;
        }

        const existentes =
            participantes.filter(
                participante =>
                    participante.tipo_participante ===
                    tipo,
            ).length;

        const faltan =
            Math.max(
                0,
                minimo -
                    existentes,
            );

        for (
            let indice =
                0;
            indice <
                faltan;
            indice +=
                1
        ) {
            participantes.push(
                crearParticipante(
                    tipo,
                    siguienteOrden,
                ),
            );

            siguienteOrden +=
                1;
        }
    }

    completar(
        "JUGADOR",
        configuracion.jugadores.minimo ??
            0,
    );

    if (
        configuracion.profesores.permitidos
    ) {
        completar(
            "PROFESOR",
            configuracion.profesores.minimo,
        );
    }

    if (
        configuracion.staff.permitido
    ) {
        completar(
            "STAFF",
            configuracion.staff.minimo,
        );
    }

    return {
        ...formulario,

        participantes,
    };
}

// ============================================================
// FORMULARIO NUEVO
// ============================================================

function crearFormularioNuevo(
    sesion:
        SesionFormulario,

    configuracion:
        ConfiguracionEquipos,
): DatosFormularioEquipo | null {
    if (
        !sesion.iniciada ||
        !sesion.usuario
    ) {
        return null;
    }

    const formulario:
        DatosFormularioEquipo = {
            id: null,

            estado:
                "BORRADOR",

            usuario_id:
                sesion.usuario.id,

            email_contacto:
                sesion.usuario.email?.trim() ??
                "",

            acceso_capitan:
                false,

            equipo: {
                id: null,

                nombre: "",

                escudo: null,

                capitan_id: null,

                plaza_estado:
                    "PENDIENTE",

                posicion_lista_espera:
                    null,
            },

            participantes:
                [],

            observaciones:
                [],
        };

    return completarMinimos(
        formulario,
        configuracion,
    );
}

// ============================================================
// PASOS
// ============================================================

function construirPasos(
    configuracion:
        ConfiguracionEquipos,
): PasoFormulario[] {
    const pasos:
        PasoFormulario[] = [
            {
                id:
                    "equip",

                titulo:
                    "Equip",

                descripcion:
                    "Dades principals de l'equip.",
            },

            {
                id:
                    "jugadors",

                titulo:
                    "Jugadors",

                descripcion:
                    "Participants de l'equip.",
            },
        ];

    if (
        configuracion.profesores.permitidos
    ) {
        pasos.push({
            id:
                "professorat",

            titulo:
                "Professorat",

            descripcion:
                "Professorat vinculat a l'equip.",
        });
    }

    if (
        configuracion.entrenador.permitido
    ) {
        pasos.push({
            id:
                "entrenador",

            titulo:
                "Entrenador",

            descripcion:
                "Entrenador de l'equip.",
        });
    }

    if (
        configuracion.staff.permitido
    ) {
        pasos.push({
            id:
                "staff",

            titulo:
                "Staff",

            descripcion:
                "Membres de suport de l'equip.",
        });
    }

    pasos.push(
        {
            id:
                "capita",

            titulo:
                "Capità",

            descripcion:
                "Capità i permisos d'accés.",
        },

        {
            id:
                "resum",

            titulo:
                "Resum",

            descripcion:
                "Revisió final de la inscripció.",
        },
    );

    return pasos;
}

// ============================================================
// FECHA
// ============================================================

function formatearFecha(
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return null;
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
        return null;
    }

    return new Intl.DateTimeFormat(
        "ca-ES",
        {
            day:
                "2-digit",

            month:
                "2-digit",

            year:
                "numeric",

            hour:
                "2-digit",

            minute:
                "2-digit",

            timeZone:
                "Europe/Madrid",
        },
    ).format(
        fecha,
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function FormularioEquipo({
    edicionID,
}: Props) {
    const [
        carga,
        setCarga,
    ] =
        useState<RespuestaCargaFormulario | null>(
            null,
        );

    const [
        formulario,
        setFormulario,
    ] =
        useState<DatosFormularioEquipo | null>(
            null,
        );

    const [
        pasoActual,
        setPasoActual,
    ] =
        useState(0);

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
        aviso,
        setAviso,
    ] =
        useState("");

    // ========================================================
    // CARGAR
    // ========================================================

    useEffect(
        () => {
            const controlador =
                new AbortController();

            async function cargar() {
                setCargando(
                    true,
                );

                setError(
                    "",
                );

                setAviso(
                    "",
                );

                try {
                    const parametros =
                        new URLSearchParams();

                    if (
                        edicionID
                    ) {
                        parametros.set(
                            "edicionID",
                            edicionID,
                        );
                    }

                    const url =
                        parametros.size >
                        0
                            ? `${API}?${parametros.toString()}`
                            : API;

                    const respuesta =
                        await fetch(
                            url,
                            {
                                method:
                                    "GET",

                                credentials:
                                    "same-origin",

                                cache:
                                    "no-store",

                                signal:
                                    controlador.signal,
                            },
                        );

                    const datos =
                        await respuesta
                            .json()
                            .catch(
                                () =>
                                    null,
                            ) as
                            | RespuestaCargaFormulario
                            | {
                                  success?: boolean;
                                  mensaje?: string;
                              }
                            | null;

                    if (
                        !respuesta.ok ||
                        datos?.success !==
                            true
                    ) {
                        throw new Error(
                            datos &&
                            "mensaje" in
                                datos &&
                            typeof datos.mensaje ===
                                "string"
                                ? datos.mensaje
                                : "No s'ha pogut carregar la inscripció.",
                        );
                    }

                    if (
                        controlador.signal.aborted
                    ) {
                        return;
                    }

                    const cargaNueva =
                        datos as RespuestaCargaFormulario;

                    setCarga(
                        cargaNueva,
                    );

                    if (
                        !cargaNueva.disponible ||
                        !cargaNueva.configuracion ||
                        !cargaNueva.edicion ||
                        !cargaNueva.sesion.iniciada ||
                        !cargaNueva.sesion.usuario
                    ) {
                        setFormulario(
                            null,
                        );

                        setPasoActual(
                            0,
                        );

                        return;
                    }

                    const inicial =
                        cargaNueva.formulario
                            ? {
                                  ...cargaNueva.formulario,

                                  email_contacto:
                                      cargaNueva.formulario.email_contacto,
                              }
                            : crearFormularioNuevo(
                                  cargaNueva.sesion,
                                  cargaNueva.configuracion,
                              );

                    if (
                        !inicial
                    ) {
                        setFormulario(
                            null,
                        );

                        return;
                    }

                    const editable =
                        cargaNueva.formulario
                            ? cargaNueva.permisos.puede_editar
                            : true;

                    setFormulario(
                        editable
                            ? completarMinimos(
                                  inicial,
                                  cargaNueva.configuracion,
                              )
                            : inicial,
                    );

                    setPasoActual(
                        0,
                    );
                } catch (
                    error
                ) {
                    if (
                        controlador.signal.aborted
                    ) {
                        return;
                    }

                    setError(
                        error instanceof
                            Error
                            ? error.message
                            : "No s'ha pogut carregar la inscripció.",
                    );
                } finally {
                    if (
                        !controlador.signal.aborted
                    ) {
                        setCargando(
                            false,
                        );
                    }
                }
            }

            void cargar();

            return () =>
                controlador.abort();
        },
        [
            edicionID,
        ],
    );

    // ========================================================
    // PASOS
    // ========================================================

    const pasos =
        useMemo(
            () =>
                carga?.configuracion
                    ? construirPasos(
                          carga.configuracion,
                      )
                    : [],
            [
                carga?.configuracion,
            ],
        );

    const paso =
        pasos[
            pasoActual
        ] ??
        null;

    const esPrimerPaso =
        pasoActual ===
        0;

    const esUltimoPaso =
        pasoActual ===
        pasos.length -
            1;

    // ========================================================
    // PERMISOS
    // ========================================================

    const permisos =
        carga?.formulario
            ? carga.permisos
            : {
                  ...PERMISOS_VACIOS,

                  puede_ver:
                      Boolean(
                          carga?.sesion.iniciada,
                      ),

                  puede_editar:
                      Boolean(
                          carga?.sesion.iniciada,
                      ),

                  puede_cambiar_acceso_capitan:
                      Boolean(
                          carga?.sesion.iniciada,
                      ),
              };

    const soloLectura =
        !permisos.puede_editar;

    const bloqueado =
        guardando;

    // ========================================================
    // ACTUALIZAR FORMULARIO
    // ========================================================

    function actualizarFormulario(
        nuevo:
            DatosFormularioEquipo,
    ) {
        if (
            soloLectura ||
            guardando
        ) {
            return;
        }

        setFormulario(
            actual => {
                if (
                    !actual
                ) {
                    return actual;
                }

                return {
                    ...nuevo,

                    usuario_id:
                        actual.usuario_id,

                    email_contacto:
                        actual.email_contacto,
                };
            },
        );

        setAviso(
            "",
        );
    }

    function actualizarParticipantes(
        participantes:
            ParticipanteFormulario[],
    ) {
        if (
            !formulario ||
            soloLectura ||
            guardando
        ) {
            return;
        }

        setFormulario({
            ...formulario,

            participantes,
        });

        setAviso(
            "",
        );
    }

    function cambiarCapitan(
        capitanID:
            string | null,
    ) {
        if (
            !formulario ||
            soloLectura ||
            guardando
        ) {
            return;
        }

        setFormulario({
            ...formulario,

            acceso_capitan:
                capitanID
                    ? formulario.acceso_capitan
                    : false,

            equipo: {
                ...formulario.equipo,

                capitan_id:
                    capitanID,
            },
        });

        setAviso(
            "",
        );
    }

    function cambiarAccesoCapitan(
        acceso:
            boolean,
    ) {
        if (
            !formulario ||
            guardando ||
            !permisos.puede_cambiar_acceso_capitan
        ) {
            return;
        }

        setFormulario({
            ...formulario,

            acceso_capitan:
                acceso,
        });

        setAviso(
            "",
        );
    }

    // ========================================================
    // DATOS PARA API
    // ========================================================

    function datosAPI(
        actual:
            DatosFormularioEquipo,
    ) {
        return {
            acceso_capitan:
                actual.acceso_capitan,

            equipo: {
                id:
                    actual.equipo.id,

                nombre:
                    actual.equipo.nombre,

                escudo:
                    actual.equipo.escudo,

                capitan_id:
                    actual.equipo.capitan_id,
            },

            participantes:
                actual.participantes.map(
                    participante => ({
                        id:
                            participante.id,

                        tipo_participante:
                            participante.tipo_participante,

                        nombre:
                            participante.nombre,

                        apellido1:
                            participante.apellido1,

                        apellido2:
                            participante.apellido2,

                        email:
                            participante.email,

                        curso:
                            participante.curso,

                        grupo:
                            participante.grupo,

                        genero:
                            participante.genero,

                        orden:
                            participante.orden,
                    }),
                ),
        };
    }

    // ========================================================
    // GUARDAR
    // ========================================================

    async function guardar(
        continuar =
            false,
    ) {
        if (
            !formulario ||
            !carga?.edicion ||
            !carga.configuracion ||
            !carga.sesion.iniciada ||
            !carga.sesion.usuario ||
            soloLectura ||
            guardando
        ) {
            return false;
        }

        setGuardando(
            true,
        );

        setError(
            "",
        );

        setAviso(
            "",
        );

        try {
            const creando =
                formulario.id ===
                null;

            const respuesta =
                await fetch(
                    API,
                    {
                        method:
                            creando
                                ? "POST"
                                : "PATCH",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                creando
                                    ? {
                                          accion:
                                              "crear",

                                          edicionID:
                                              carga.edicion.id,

                                          datos:
                                              datosAPI(
                                                  formulario,
                                              ),
                                      }
                                    : {
                                          accion:
                                              "guardar",

                                          edicionID:
                                              carga.edicion.id,

                                          formularioID:
                                              formulario.id,

                                          datos:
                                              datosAPI(
                                                  formulario,
                                              ),
                                      },
                            ),
                    },
                );

            const datos =
                await respuesta
                    .json()
                    .catch(
                        () =>
                            null,
                    ) as
                    | RespuestaGuardado
                    | null;

            if (
                !respuesta.ok ||
                datos?.success !==
                    true ||
                !datos.formulario
            ) {
                throw new Error(
                    datos?.mensaje ||
                        "No s'ha pogut guardar la inscripció.",
                );
            }

            const actualizado:
                DatosFormularioEquipo = {
                    ...datos.formulario,

                    email_contacto:
                        datos.formulario.email_contacto ||
                        formulario.email_contacto,
                };

            setFormulario(
                actualizado,
            );

            setCarga(
                actual =>
                    actual
                        ? {
                              ...actual,

                              formulario:
                                  actualizado,

                              permisos: {
                                  ...actual.permisos,

                                  propietario:
                                      true,

                                  puede_ver:
                                      true,

                                  puede_editar:
                                      true,

                                  puede_cambiar_acceso_capitan:
                                      true,
                              },
                          }
                        : actual,
            );

            if (
                continuar &&
                pasoActual <
                    pasos.length -
                        1
            ) {
                setPasoActual(
                    actual =>
                        actual +
                        1,
                );

                setAviso(
                    "",
                );
            } else {
                setAviso(
                    datos.mensaje ||
                        "Inscripció guardada correctament.",
                );
            }

            return true;
        } catch (
            error
        ) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut guardar la inscripció.",
            );

            return false;
        } finally {
            setGuardando(
                false,
            );
        }
    }

    // ========================================================
    // ENVIAR A REVISIÓN
    // ========================================================

    async function enviarRevision() {
        if (
            !formulario ||
            !formulario.id ||
            !carga?.edicion ||
            !carga.sesion.iniciada ||
            !carga.sesion.usuario ||
            soloLectura ||
            guardando
        ) {
            return;
        }

        setGuardando(
            true,
        );

        setError(
            "",
        );

        setAviso(
            "",
        );

        try {
            const respuesta =
                await fetch(
                    API,
                    {
                        method:
                            "PATCH",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                accion:
                                    "enviar",

                                edicionID:
                                    carga.edicion.id,

                                formularioID:
                                    formulario.id,

                                datos:
                                    datosAPI(
                                        formulario,
                                    ),
                            }),
                    },
                );

            const datos =
                await respuesta
                    .json()
                    .catch(
                        () =>
                            null,
                    ) as
                    | RespuestaGuardado
                    | null;

            if (
                !respuesta.ok ||
                datos?.success !==
                    true ||
                !datos.formulario
            ) {
                throw new Error(
                    datos?.mensaje ||
                        "No s'ha pogut enviar la inscripció.",
                );
            }

            setFormulario(
                datos.formulario,
            );

            setCarga(
                actual =>
                    actual
                        ? {
                              ...actual,

                              formulario:
                                  datos.formulario ??
                                  actual.formulario,

                              permisos: {
                                  ...actual.permisos,

                                  puede_editar:
                                      false,

                                  puede_cambiar_acceso_capitan:
                                      false,
                              },
                          }
                        : actual,
            );

            setAviso(
                datos.mensaje ||
                    "La inscripció s'ha enviat a revisió.",
            );
        } catch (
            error
        ) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut enviar la inscripció.",
            );
        } finally {
            setGuardando(
                false,
            );
        }
    }

    // ========================================================
    // CAMBIAR PASO
    // ========================================================

    function anterior() {
        if (
            pasoActual <=
                0 ||
            guardando
        ) {
            return;
        }

        setPasoActual(
            actual =>
                actual -
                1,
        );

        setError(
            "",
        );

        setAviso(
            "",
        );
    }

    function irPaso(
        indice:
            number,
    ) {
        if (
            indice <
                0 ||
            indice >=
                pasos.length ||
            guardando
        ) {
            return;
        }

        if (
            indice >
            pasoActual &&
            !soloLectura
        ) {
            return;
        }

        setPasoActual(
            indice,
        );

        setError(
            "",
        );

        setAviso(
            "",
        );
    }

    // ========================================================
    // CARGANDO
    // ========================================================

    if (
        cargando
    ) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center px-4">
                <div className="flex flex-col items-center gap-4 text-center">
                    <span className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary" />

                    <div>
                        <p className="font-semibold text-neutral-titulos">
                            Carregant la inscripció
                        </p>

                        <p className="mt-1 text-sm text-neutral">
                            Estam comprovant l'edició i la teva sessió.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // ERROR DE CARGA
    // ========================================================

    if (
        error &&
        !carga
    ) {
        return (
            <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10">
                <div className="w-full rounded-2xl border border-error/30 bg-error-container/20 p-6 text-center">
                    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-error-container text-error">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-6 w-6 fill-current" aria-hidden="true">
                            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                        </svg>
                    </span>

                    <h1 className="mt-4 text-xl font-bold text-neutral-titulos">
                        No s'ha pogut carregar la inscripció
                    </h1>

                    <p className="mt-2 text-sm leading-6 text-neutral">
                        {error}
                    </p>

                    <button type="button" onClick={() => window.location.reload()} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90">
                        Tornar-ho a intentar
                    </button>
                </div>
            </div>
        );
    }

    // ========================================================
    // SIN CARGA
    // ========================================================

    if (
        !carga
    ) {
        return null;
    }

    // ========================================================
    // EDICIÓN NO DISPONIBLE
    // ========================================================

    if (
        !carga.disponible
    ) {
        return (
            <PantallaEdicionNoDisponible carga={carga} />
        );
    }

    // ========================================================
    // SESIÓN OBLIGATORIA
    // ========================================================

    if (
        !carga.sesion.iniciada ||
        !carga.sesion.usuario
    ) {
        const redireccion =
            edicionID
                ? `/inscripcio?edicionID=${encodeURIComponent(edicionID)}`
                : "/inscripcio";

        return (
            <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-10">
                <div className="w-full rounded-2xl border border-border bg-background p-6 text-center sm:p-8">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-7 w-7 fill-current" aria-hidden="true">
                            <path d="M480-120v-80h280v-560H480v-80h280q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H480Zm-80-160-55-58 102-102H120v-80h327L345-622l55-58 200 200-200 200Z" />
                        </svg>
                    </span>

                    <h1 className="mt-5 text-2xl font-bold text-neutral-titulos">
                        Has d'iniciar sessió
                    </h1>

                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral">
                        Per emplenar una inscripció d'equip necessites iniciar sessió. El teu compte quedarà vinculat com a responsable de la inscripció.
                    </p>

                    <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                        <a href={`/iniciar-sessio?redireccio=${encodeURIComponent(redireccion)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                <path d="M480-120v-80h280v-560H480v-80h280q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H480Zm-80-160-55-58 102-102H120v-80h327L345-622l55-58 200 200-200 200Z" />
                            </svg>

                            Iniciar sessió
                        </a>

                        <a href="/registre" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-background px-5 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary">
                            Crear un compte
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // DATOS INCOMPLETOS
    // ========================================================

    if (
        !carga.configuracion ||
        !carga.edicion ||
        !formulario ||
        !paso
    ) {
        return (
            <div className="mx-auto max-w-3xl px-4 py-10">
                <div className="rounded-2xl border border-error/30 bg-error-container/20 p-6 text-center">
                    <p className="font-semibold text-error-foreground">
                        No s'ha pogut preparar el formulari d'inscripció.
                    </p>
                </div>
            </div>
        );
    }

    // ========================================================
    // FORMULARIO
    // ========================================================

    return (
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">

            {/* =================================================
                CABECERA
            ================================================= */}

            <header className="mb-6 rounded-2xl border border-border bg-background p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                    <div className="flex min-w-0 items-center gap-4">
                        {carga.torneo?.logo && (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card p-2 sm:h-20 sm:w-20">
                                <img src={carga.torneo.logo} alt={`Logo de ${carga.torneo.nombre}`} className="h-full w-full object-contain" />
                            </div>
                        )}

                        <div className="min-w-0">
                            {carga.torneo?.deporte && (
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                                    {carga.torneo.deporte}
                                </p>
                            )}

                            <h1 className="mt-1 text-xl font-bold tracking-tight text-neutral-titulos sm:text-2xl lg:text-3xl">
                                {carga.torneo?.nombre ?? "Torneig"}
                            </h1>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="text-sm font-semibold text-neutral">
                                    Inscripció d'equip
                                </span>

                                <span className="h-1 w-1 rounded-full bg-neutral/40" />

                                <span className="text-sm text-neutral">
                                    {carga.edicion.nombre}
                                </span>

                                {carga.edicion.sede && (
                                    <>
                                        <span className="h-1 w-1 rounded-full bg-neutral/40" />

                                        <span className="inline-flex items-center gap-1.5 text-sm text-neutral">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                                <path d="M480-80q-15 0-30-5t-26-15Q274-231 197-343.5T120-560q0-150 105-255t255-105q150 0 255 105t105 255q0 104-77 216.5T536-100q-11 10-26 15t-30 5Zm0-400q33 0 56.5-23.5T560-560q0-33-23.5-56.5T480-640q-33 0-56.5 23.5T400-560q0 33 23.5 56.5T480-480Z" />
                                            </svg>

                                            {carga.edicion.sede}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <EstadoFormularioCabecera formulario={formulario} permisos={permisos} />
                </div>
            </header>

            {/* =================================================
                DENEGADO
            ================================================= */}

            {formulario.estado === "DENEGADO" && (
                <div className="mb-6 rounded-2xl border border-error/30 bg-error-container/20 p-5">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-error">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                            </svg>
                        </span>

                        <div>
                            <p className="font-semibold text-error-foreground">
                                La inscripció necessita modificacions
                            </p>

                            <p className="mt-1 text-sm leading-6 text-error-foreground">
                                Revisa els motius indicats als camps corresponents, fes les correccions necessàries i torna a enviar la inscripció.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                EN REVISIÓN
            ================================================= */}

            {formulario.estado === "EN_REVISION" && (
                <div className="mb-6 rounded-2xl border border-secondary/30 bg-secondary/10 p-5">
                    <div className="flex items-start gap-3">
                        <span className="mt-0.5 shrink-0 text-secondary">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                <path d="M480-120q-150 0-255-105T120-480q0-150 105-255t255-105q150 0 255 105t105 255q0 150-105 255T480-120Zm40-200h80v-200H480v-200h-80v280q0 17 11.5 28.5T440-400h80v80Z" />
                            </svg>
                        </span>

                        <div>
                            <p className="font-semibold text-neutral-titulos">
                                Inscripció en revisió
                            </p>

                            <p className="mt-1 text-sm leading-6 text-neutral">
                                Pots consultar totes les dades, però no es poden modificar mentre l'organització revisa la inscripció.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* =================================================
                PROGRESO
            ================================================= */}

            <section className="mb-6 overflow-x-auto rounded-2xl border border-border bg-background p-3">
                <div className="flex min-w-max items-center gap-1">
                    {pasos.map(
                        (
                            entrada,
                            indice,
                        ) => {
                            const actual =
                                indice === pasoActual;

                            const completado =
                                indice < pasoActual;

                            const clickable =
                                soloLectura ||
                                indice <= pasoActual;

                            return (
                                <button key={entrada.id} type="button" disabled={!clickable || guardando} onClick={() => irPaso(indice)} className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-left transition disabled:cursor-default ${actual ? "bg-primary text-white" : completado ? "bg-primary/10 text-primary" : "text-neutral hover:bg-card"}`}>
                                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${actual ? "border-white/30 bg-white/15" : completado ? "border-primary/30 bg-primary/10" : "border-border bg-background"}`}>
                                        {completado ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                                                <path d="m382-240-228-228 57-57 171 171 367-367 57 57-424 424Z" />
                                            </svg>
                                        ) : (
                                            indice + 1
                                        )}
                                    </span>

                                    <span className="text-sm font-semibold">
                                        {entrada.titulo}
                                    </span>
                                </button>
                            );
                        },
                    )}
                </div>
            </section>

            {/* =================================================
                MENSAJES
            ================================================= */}

            {error && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3">
                    <span className="mt-0.5 shrink-0 text-error">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Z" />
                        </svg>
                    </span>

                    <p className="text-sm font-medium leading-6 text-error-foreground">
                        {error}
                    </p>
                </div>
            )}

            {aviso && (
                <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                    <span className="mt-0.5 shrink-0 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="m382-240-228-228 57-57 171 171 367-367 57 57-424 424Z" />
                        </svg>
                    </span>

                    <p className="text-sm font-medium leading-6 text-neutral-titulos">
                        {aviso}
                    </p>
                </div>
            )}

            {/* =================================================
                SLIDE
            ================================================= */}

            <section className="rounded-2xl border border-border bg-background p-4 shadow-sm sm:p-6">
                <div className="mb-7 border-b border-border pb-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        Pas {pasoActual + 1} de {pasos.length}
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                        {paso.titulo}
                    </h2>

                    <p className="mt-1 text-sm leading-6 text-neutral">
                        {paso.descripcion}
                    </p>
                </div>

                {paso.id === "equip" && (
                    <PasoEquipo formulario={formulario} configuracion={carga.configuracion} edicion={carga.edicion} soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={actualizarFormulario} />
                )}

                {paso.id === "jugadors" && (
                    <PasoJugadores participantes={formulario.participantes} configuracion={carga.configuracion} observaciones={formulario.observaciones} soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={actualizarParticipantes} />
                )}

                {paso.id === "professorat" && (
                    <PasoProfesor participantes={formulario.participantes} configuracion={carga.configuracion} observaciones={formulario.observaciones} soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={actualizarParticipantes} />
                )}

                {paso.id === "entrenador" && (
                    <PasoEntrenador participantes={formulario.participantes} configuracion={carga.configuracion} observaciones={formulario.observaciones} soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={actualizarParticipantes} />
                )}

                {paso.id === "staff" && (
                    <PasoStaff participantes={formulario.participantes} configuracion={carga.configuracion} observaciones={formulario.observaciones} soloLectura={soloLectura} bloqueado={bloqueado} onCambiar={actualizarParticipantes} />
                )}

                {paso.id === "capita" && (
                    <PasoCapitan formulario={formulario} permisos={permisos} soloLectura={soloLectura} bloqueado={bloqueado} onCapitanCambiar={cambiarCapitan} onAccesoCapitanCambiar={cambiarAccesoCapitan} />
                )}

                {paso.id === "resum" && (
                    <PasoResumen formulario={formulario} configuracion={carga.configuracion} torneo={carga.torneo} edicion={carga.edicion} soloLectura={soloLectura} />
                )}
            </section>

            {/* =================================================
                NAVEGACIÓN
            ================================================= */}

            <footer className="mt-5 flex flex-col-reverse gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" disabled={esPrimerPaso || guardando} onClick={anterior} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                        <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
                    </svg>

                    Anterior
                </button>

                <div className="flex flex-col gap-2 sm:flex-row">
                    {!soloLectura && (
                        <button type="button" disabled={guardando} onClick={() => void guardar(false)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                            {guardando ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h447l193 193v447q0 33-23.5 56.5T760-120H200Zm280-80q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35ZM240-560h360v-160H240v160Z" />
                                </svg>
                            )}

                            Guardar
                        </button>
                    )}

                    {!esUltimoPaso && !soloLectura && (
                        <button type="button" disabled={guardando} onClick={() => void guardar(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                            Guardar i continuar

                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                <path d="m647-440-224 224 57 56 320-320-320-320-57 56 224 224H160v80h487Z" />
                            </svg>
                        </button>
                    )}

                    {esUltimoPaso && !soloLectura && (
                        <button type="button" disabled={guardando || !formulario.id} onClick={() => void enviarRevision()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                            {guardando ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                    <path d="m120-120 80-280 320-80-320-80-80-280 760 360-760 360Z" />
                                </svg>
                            )}

                            Enviar a revisió
                        </button>
                    )}

                    {soloLectura && !esUltimoPaso && (
                        <button type="button" disabled={guardando} onClick={() => setPasoActual(actual => Math.min(actual + 1, pasos.length - 1))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90">
                            Següent

                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                                <path d="m647-440-224 224 57 56 320-320-320-320-57 56 224 224H160v80h487Z" />
                            </svg>
                        </button>
                    )}
                </div>
            </footer>
        </main>
    );
}

// ============================================================
// ESTADO
// ============================================================

function EstadoFormularioCabecera({
    formulario,
    permisos,
}: {
    formulario:
        DatosFormularioEquipo;

    permisos:
        PermisosFormulario;
}) {
    const configuracion =
        formulario.estado === "BORRADOR"
            ? {
                  texto:
                      "Esborrany",

                  clases:
                      "border-border bg-card text-neutral",
              }
            : formulario.estado === "EN_REVISION"
              ? {
                    texto:
                        "En revisió",

                    clases:
                        "border-secondary/30 bg-secondary/10 text-secondary",
                }
              : formulario.estado === "APROBADO"
                ? {
                      texto:
                          "Aprovada",

                      clases:
                          "border-primary/30 bg-primary/10 text-primary",
                  }
                : {
                      texto:
                          "Denegada",

                      clases:
                          "border-error/30 bg-error-container/30 text-error-foreground",
                  };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {permisos.capitan && (
                <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-neutral">
                    Accés com a capità
                </span>
            )}

            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${configuracion.clases}`}>
                {configuracion.texto}
            </span>
        </div>
    );
}

// ============================================================
// EDICIÓN NO DISPONIBLE
// ============================================================

function PantallaEdicionNoDisponible({
    carga,
}: {
    carga:
        RespuestaCargaFormulario;
}) {
    return (
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-7 w-7 fill-current" aria-hidden="true">
                        <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h80v-80h80v80h240v-80h80v80h80q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Zm0-80h560v-400H200v400Zm0-480h560v-80H200v80Z" />
                    </svg>
                </span>

                <h1 className="mt-5 text-2xl font-bold tracking-tight text-neutral-titulos sm:text-3xl">
                    {carga.motivo === "SIN_EDICION"
                        ? "Selecciona una edició"
                        : "Inscripció no disponible"}
                </h1>

                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral">
                    {carga.mensaje ?? "No es pot accedir a aquesta inscripció en aquest moment."}
                </p>
            </div>

            {carga.edicionesDisponibles.length > 0 ? (
                <section className="mt-10">
                    <div className="mb-5">
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Edicions disponibles
                        </h2>

                        <p className="mt-1 text-sm text-neutral">
                            Selecciona l'edició en què vols inscriure el teu equip.
                        </p>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {carga.edicionesDisponibles.map(
                            edicion => {
                                const cierre =
                                    formatearFecha(
                                        edicion.cierre,
                                    );

                                return (
                                    <a key={edicion.id} href={`/inscripcio?edicionID=${encodeURIComponent(edicion.id)}`} className="group flex min-h-87.5 flex-col overflow-hidden rounded-2xl border border-border bg-background transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">

                                        {/* =====================================
                                            BANNER
                                        ====================================== */}

                                        <div className="relative h-44 w-full shrink-0 overflow-hidden bg-card">
                                            {edicion.torneo.banner ? (
                                                <img src={edicion.torneo.banner} alt={`Banner de ${edicion.torneo.nombre}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center bg-primary/5">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-16 w-16 fill-primary/20" aria-hidden="true">
                                                        <path d="M280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80H280Z" />
                                                    </svg>
                                                </div>
                                            )}

                                            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/10 to-transparent" />

                                            {edicion.torneo.logo && (
                                                <div className="absolute left-4 top-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-white/30 bg-white/95 p-1.5 shadow-sm">
                                                    <img src={edicion.torneo.logo} alt="" className="h-full w-full object-contain" />
                                                </div>
                                            )}

                                            <div className="absolute inset-x-0 bottom-0 p-4">
                                                {edicion.torneo.deporte && (
                                                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                                                        {edicion.torneo.deporte}
                                                    </p>
                                                )}

                                                <p className="mt-1 line-clamp-2 text-lg font-bold leading-tight text-white">
                                                    {edicion.torneo.nombre}
                                                </p>
                                            </div>
                                        </div>

                                        {/* =====================================
                                            DATOS
                                        ====================================== */}

                                        <div className="flex flex-1 flex-col p-5">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                                                        Edició
                                                    </p>

                                                    <h3 className="mt-1 text-lg font-bold text-neutral-titulos">
                                                        {edicion.nombre}
                                                    </h3>
                                                </div>

                                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-neutral transition group-hover:bg-primary group-hover:text-white">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                                                        <path d="m647-440-224 224 57 56 320-320-320-320-57 56 224 224H160v80h487Z" />
                                                    </svg>
                                                </span>
                                            </div>

                                            <div className="mt-auto pt-5">
                                                {cierre && (
                                                    <div className="flex items-start gap-2 border-t border-border pt-4 text-xs leading-5 text-neutral">
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="mt-0.5 h-4 w-4 shrink-0 fill-primary" aria-hidden="true">
                                                            <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Z" />
                                                        </svg>

                                                        <span>
                                                            Inscripcions fins al{" "}
                                                            <strong className="font-semibold text-neutral-titulos">
                                                                {cierre}
                                                            </strong>
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </a>
                                );
                            },
                        )}
                    </div>
                </section>
            ) : (
                <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-dashed border-border bg-card/20 p-8 text-center">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-card text-neutral">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-5 w-5 fill-current" aria-hidden="true">
                            <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h80v-80h80v80h240v-80h80v80h80q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Z" />
                        </svg>
                    </span>

                    <p className="mt-4 text-sm font-medium text-neutral">
                        No hi ha cap edició amb inscripcions obertes actualment.
                    </p>
                </div>
            )}
        </div>
    );
}