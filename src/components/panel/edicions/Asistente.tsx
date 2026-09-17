import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import PasoGeneral from "./pasos/PasoGeneral";
import PasoEquips from "./pasos/PasoEquips";
import PasoVoluntariat from "./pasos/PasoVoluntariat";
import PasoInformacio from "./pasos/PasoInformacio";
import PasoFAQ from "./pasos/PasoFAQ";
import PasoResumen from "./pasos/PasoResumen";

const API =
    "/api/panell/edicions";

// ============================================================
// TIPOS GENERALES
// ============================================================

export type ModoEdicion =
    | "crear"
    | "ver"
    | "editar";

type Props = {
    torneoID:
        string;

    edicionID:
        string | null;

    modo:
        ModoEdicion;

    volver:
        string;
};

// ============================================================
// TORNEO
// ============================================================

export type TorneoEdicion = {
    id:
        string;

    nombre:
        string | null;

    deporte:
        string | null;
};

// ============================================================
// INFORMACIÓN GENERAL
// ============================================================

export type DatosGeneralesEdicion = {
    nombre:
        string;

    fecha_inicio:
        string;

    fecha_fin:
        string;

    estado:
        string;

    sede:
        string;
};

// ============================================================
// CONFIGURACIÓN COMÚN
// ============================================================

export type ConfigInscripcion = {
    apertura:
        string | null;

    cierre:
        string | null;
};

export type ConfigCupo = {
    maximo:
        number | null;

    al_superar:
        | "permitir"
        | "lista_espera"
        | "bloquear";
};

// ============================================================
// EQUIPOS
// ============================================================

export type ConfigEquipos = {
    inscripcion:
        ConfigInscripcion;

    cupo:
        ConfigCupo;

    jugadores: {
        minimo:
            number | null;

        maximo:
            number | null;
    };

    genero: {
        activo:
            boolean;

        minimos: {
            masculino:
                number;

            femenino:
                number;
        };
    };

    profesores: {
        permitidos:
            boolean;

        minimo:
            number;

        maximo:
            number;

        cuentan_como_jugador:
            boolean;
    };

    entrenador: {
        permitido:
            boolean;
    };

    staff: {
        permitido:
            boolean;

        minimo:
            number;

        maximo:
            number;
    };
};

// ============================================================
// VOLUNTARIADO
// ============================================================

export type TipoVoluntariado = {
    id:
        string;

    nombre:
        string;

    descripcion:
        string;

    activo:
        boolean;

    cupo: {
        maximo:
            number | null;

        al_superar:
            | "permitir"
            | "lista_espera"
            | "bloquear";
    };
};

export type ConfigVoluntarios = {
    inscripcion:
        ConfigInscripcion;

    cupo:
        ConfigCupo;

    tipos:
        TipoVoluntariado[];
};

// ============================================================
// INFORMACIÓN PÚBLICA
// ============================================================

export type BloqueInformacion = {
    id:
        string;

    order:
        number;

    type:
        "text";

    title:
        string;

    body:
        string;
};

export type ConfigInformacion = {
    bloques:
        BloqueInformacion[];
};

// ============================================================
// FAQ
// ============================================================

export type PreguntaFAQ = {
    id:
        string;

    order:
        number;

    pregunta:
        string;

    respuesta:
        string;

    activo:
        boolean;
};

export type ConfigFAQ = {
    preguntas:
        PreguntaFAQ[];
};

// ============================================================
// CONFIGURACIÓN COMPLETA
// ============================================================

export type ConfiguracionEdicion = {
    equipos:
        ConfigEquipos;

    voluntarios:
        ConfigVoluntarios;

    informacion:
        ConfigInformacion;

    faq:
        ConfigFAQ;

    competicion:
        Record<
            string,
            unknown
        >;
};

// ============================================================
// EDICIÓN
// ============================================================

export type EdicionFormulario = {
    id:
        string | null;

    torneo_id:
        string;

    general:
        DatosGeneralesEdicion;

    configuracion:
        ConfiguracionEdicion;

    created_at:
        string | null;

    updated_at:
        string | null;
};

// ============================================================
// RESPUESTA API
// ============================================================

type RespuestaAsistente = {
    success:
        true;

    torneo:
        TorneoEdicion;

    edicion:
        EdicionFormulario | null;

    capacidades: {
        crear:
            boolean;

        editar:
            boolean;

        eliminar:
            boolean;
    };
};

// ============================================================
// PASOS
// ============================================================

type PasoID =
    | "general"
    | "equips"
    | "voluntariat"
    | "informacio"
    | "faq"
    | "resum";

type Paso = {
    id:
        PasoID;

    titulo:
        string;
};

// ============================================================
// DEFAULTS
// ============================================================

function crearConfiguracionEquipos():
    ConfigEquipos {
    return {
        inscripcion: {
            apertura:
                null,

            cierre:
                null,
        },

        cupo: {
            maximo:
                null,

            al_superar:
                "permitir",
        },

        jugadores: {
            minimo:
                null,

            maximo:
                null,
        },

        genero: {
            activo:
                false,

            minimos: {
                masculino:
                    0,

                femenino:
                    0,
            },
        },

        profesores: {
            permitidos:
                false,

            minimo:
                0,

            maximo:
                0,

            cuentan_como_jugador:
                true,
        },

        entrenador: {
            permitido:
                false,
        },

        staff: {
            permitido:
                false,

            minimo:
                0,

            maximo:
                0,
        },
    };
}

function crearConfiguracionVoluntarios():
    ConfigVoluntarios {
    return {
        inscripcion: {
            apertura:
                null,

            cierre:
                null,
        },

        cupo: {
            maximo:
                null,

            al_superar:
                "permitir",
        },

        tipos:
            [],
    };
}

function crearConfiguracionInformacion():
    ConfigInformacion {
    return {
        bloques:
            [],
    };
}

function crearConfiguracionFAQ():
    ConfigFAQ {
    return {
        preguntas:
            [],
    };
}

function crearEdicionVacia(
    torneoID:
        string,
): EdicionFormulario {
    return {
        id:
            null,

        torneo_id:
            torneoID,

        general: {
            nombre:
                "",

            fecha_inicio:
                "",

            fecha_fin:
                "",

            estado:
                "BORRADOR",

            sede:
                "",
        },

        configuracion: {
            equipos:
                crearConfiguracionEquipos(),

            voluntarios:
                crearConfiguracionVoluntarios(),

            informacion:
                crearConfiguracionInformacion(),

            faq:
                crearConfiguracionFAQ(),

            competicion:
                {},
        },

        created_at:
            null,

        updated_at:
            null,
    };
}

// ============================================================
// NORMALIZACIÓN
// ============================================================

function esObjeto(
    valor:
        unknown,
): valor is Record<
    string,
    unknown
> {
    return (
        valor !==
            null &&
        typeof valor ===
            "object" &&
        !Array.isArray(
            valor
        )
    );
}

function numeroONull(
    valor:
        unknown,
): number | null {
    return (
        typeof valor ===
            "number" &&
        Number.isFinite(
            valor
        )
    )
        ? valor
        : null;
}

function numero(
    valor:
        unknown,

    defecto =
        0,
): number {
    return (
        typeof valor ===
            "number" &&
        Number.isFinite(
            valor
        )
    )
        ? valor
        : defecto;
}

function textoONull(
    valor:
        unknown,
): string | null {
    return typeof valor ===
        "string"
        ? valor
        : null;
}

// ============================================================
// NORMALIZAR INSCRIPCIÓN
// ============================================================

function normalizarInscripcion(
    valor:
        unknown,
): ConfigInscripcion {
    if (
        !esObjeto(
            valor
        )
    ) {
        return {
            apertura:
                null,

            cierre:
                null,
        };
    }

    return {
        apertura:
            textoONull(
                valor.apertura
            ),

        cierre:
            textoONull(
                valor.cierre
            ),
    };
}

// ============================================================
// NORMALIZAR CUPO
// ============================================================

function normalizarCupo(
    valor:
        unknown,
): ConfigCupo {
    if (
        !esObjeto(
            valor
        )
    ) {
        return {
            maximo:
                null,

            al_superar:
                "permitir",
        };
    }

    const comportamiento =
        valor.al_superar;

    return {
        maximo:
            numeroONull(
                valor.maximo
            ),

        al_superar:
            comportamiento ===
                "lista_espera" ||
            comportamiento ===
                "bloquear"
                ? comportamiento
                : "permitir",
    };
}

// ============================================================
// NORMALIZAR EQUIPOS
// ============================================================

function normalizarEquipos(
    valor:
        unknown,
): ConfigEquipos {
    const defecto =
        crearConfiguracionEquipos();

    if (
        !esObjeto(
            valor
        )
    ) {
        return defecto;
    }

    const jugadores =
        esObjeto(
            valor.jugadores
        )
            ? valor.jugadores
            : {};

    const genero =
        esObjeto(
            valor.genero
        )
            ? valor.genero
            : {};

    const minimosGenero =
        esObjeto(
            genero.minimos
        )
            ? genero.minimos
            : {};

    const profesores =
        esObjeto(
            valor.profesores
        )
            ? valor.profesores
            : {};

    const entrenador =
        esObjeto(
            valor.entrenador
        )
            ? valor.entrenador
            : {};

    const staff =
        esObjeto(
            valor.staff
        )
            ? valor.staff
            : {};

    return {
        inscripcion:
            normalizarInscripcion(
                valor.inscripcion
            ),

        cupo:
            normalizarCupo(
                valor.cupo
            ),

        jugadores: {
            minimo:
                numeroONull(
                    jugadores.minimo
                ),

            maximo:
                numeroONull(
                    jugadores.maximo
                ),
        },

        genero: {
            activo:
                genero.activo ===
                    true,

            minimos: {
                masculino:
                    numero(
                        minimosGenero.masculino
                    ),

                femenino:
                    numero(
                        minimosGenero.femenino
                    ),
            },
        },

        profesores: {
            permitidos:
                profesores.permitidos ===
                    true,

            minimo:
                numero(
                    profesores.minimo
                ),

            maximo:
                numero(
                    profesores.maximo
                ),

            cuentan_como_jugador:
                profesores
                    .cuentan_como_jugador !==
                false,
        },

        entrenador: {
            permitido:
                entrenador.permitido ===
                true,
        },

        staff: {
            permitido:
                staff.permitido ===
                    true,

            minimo:
                numero(
                    staff.minimo
                ),

            maximo:
                numero(
                    staff.maximo
                ),
        },
    };
}

// ============================================================
// NORMALIZAR VOLUNTARIADO
// ============================================================

function normalizarVoluntarios(
    valor:
        unknown,
): ConfigVoluntarios {
    if (
        !esObjeto(
            valor
        )
    ) {
        return crearConfiguracionVoluntarios();
    }

    const tipos =
        Array.isArray(
            valor.tipos
        )
            ? valor.tipos
                  .filter(
                      esObjeto
                  )
                  .map(
                      (
                          tipo,
                          indice,
                      ): TipoVoluntariado => ({
                          id:
                              typeof tipo.id ===
                                  "string" &&
                              tipo.id.trim()
                                  ? tipo.id
                                  : `voluntariat-${indice + 1}`,

                          nombre:
                              typeof tipo.nombre ===
                              "string"
                                  ? tipo.nombre
                                  : "",

                          descripcion:
                              typeof tipo.descripcion ===
                              "string"
                                  ? tipo.descripcion
                                  : "",

                          activo:
                              tipo.activo !==
                              false,

                          cupo:
                              normalizarCupo(
                                  tipo.cupo
                              ),
                      })
                  )
            : [];

    return {
        inscripcion:
            normalizarInscripcion(
                valor.inscripcion
            ),

        cupo:
            normalizarCupo(
                valor.cupo
            ),

        tipos,
    };
}

// ============================================================
// NORMALIZAR INFORMACIÓN
// ============================================================

function normalizarInformacion(
    valor:
        unknown,
): ConfigInformacion {
    if (
        !esObjeto(
            valor
        )
    ) {
        return crearConfiguracionInformacion();
    }

    const bloques =
        Array.isArray(
            valor.bloques
        )
            ? valor.bloques
                  .filter(
                      esObjeto
                  )
                  .map(
                      (
                          bloque,
                          indice,
                      ): BloqueInformacion => ({
                          id:
                              typeof bloque.id ===
                                  "string" &&
                              bloque.id.trim()
                                  ? bloque.id
                                  : `bloc-${indice + 1}`,

                          order:
                              numero(
                                  bloque.order,
                                  indice + 1
                              ),

                          type:
                              "text",

                          title:
                              typeof bloque.title ===
                              "string"
                                  ? bloque.title
                                  : "",

                          body:
                              typeof bloque.body ===
                              "string"
                                  ? bloque.body
                                  : "",
                      })
                  )
                  .sort(
                      (
                          a,
                          b,
                      ) =>
                          a.order -
                          b.order
                  )
            : [];

    return {
        bloques,
    };
}

// ============================================================
// NORMALIZAR FAQ
// ============================================================

function normalizarFAQ(
    valor:
        unknown,
): ConfigFAQ {
    if (
        !esObjeto(
            valor
        )
    ) {
        return crearConfiguracionFAQ();
    }

    const preguntas =
        Array.isArray(
            valor.preguntas
        )
            ? valor.preguntas
                  .filter(
                      esObjeto
                  )
                  .map(
                      (
                          pregunta,
                          indice,
                      ): PreguntaFAQ => ({
                          id:
                              typeof pregunta.id ===
                                  "string" &&
                              pregunta.id.trim()
                                  ? pregunta.id
                                  : `faq-${indice + 1}`,

                          order:
                              numero(
                                  pregunta.order,
                                  indice + 1
                              ),

                          pregunta:
                              typeof pregunta.pregunta ===
                              "string"
                                  ? pregunta.pregunta
                                  : "",

                          respuesta:
                              typeof pregunta.respuesta ===
                              "string"
                                  ? pregunta.respuesta
                                  : "",

                          activo:
                              pregunta.activo !==
                              false,
                      })
                  )
                  .sort(
                      (
                          a,
                          b,
                      ) =>
                          a.order -
                          b.order
                  )
            : [];

    return {
        preguntas,
    };
}

// ============================================================
// NORMALIZAR EDICIÓN
// ============================================================

function normalizarEdicion(
    valor:
        EdicionFormulario,

    torneoID:
        string,
): EdicionFormulario {
    const configuracion =
        valor.configuracion;

    return {
        ...valor,

        torneo_id:
            torneoID,

        general: {
            nombre:
                valor.general
                    ?.nombre ??
                "",

            fecha_inicio:
                valor.general
                    ?.fecha_inicio ??
                "",

            fecha_fin:
                valor.general
                    ?.fecha_fin ??
                "",

            estado:
                valor.general
                    ?.estado ??
                "BORRADOR",

            sede:
                valor.general
                    ?.sede ??
                "",
        },

        configuracion: {
            equipos:
                normalizarEquipos(
                    configuracion
                        ?.equipos
                ),

            voluntarios:
                normalizarVoluntarios(
                    configuracion
                        ?.voluntarios
                ),

            informacion:
                normalizarInformacion(
                    configuracion
                        ?.informacion
                ),

            faq:
                normalizarFAQ(
                    configuracion
                        ?.faq
                ),

            competicion:
                esObjeto(
                    configuracion
                        ?.competicion
                )
                    ? configuracion
                          .competicion
                    : {},
        },
    };
}

// ============================================================
// VALIDACIÓN DE FECHAS
// ============================================================

function fechaValida(
    valor:
        string,
) {
    return !Number.isNaN(
        new Date(
            valor
        ).getTime()
    );
}

function validarPeriodo(
    apertura:
        string | null,

    cierre:
        string | null,

    nombre:
        string,
): string | null {
    if (
        Boolean(
            apertura
        ) !==
        Boolean(
            cierre
        )
    ) {
        return `Indica tant l'obertura com el tancament de ${nombre}.`;
    }

    if (
        !apertura &&
        !cierre
    ) {
        return null;
    }

    if (
        !apertura ||
        !cierre
    ) {
        return null;
    }

    if (
        !fechaValida(
            apertura
        ) ||
        !fechaValida(
            cierre
        )
    ) {
        return `Les dates de ${nombre} no són vàlides.`;
    }

    if (
        new Date(
            cierre
        ).getTime() <
        new Date(
            apertura
        ).getTime()
    ) {
        return `El tancament de ${nombre} no pot ser anterior a l'obertura.`;
    }

    return null;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Asistente({
    torneoID,
    edicionID,
    modo,
    volver,
}: Props) {
    const creando =
        modo ===
        "crear";

    // ========================================================
    // ESTADO
    // ========================================================

    const [
        torneo,
        setTorneo,
    ] =
        useState<TorneoEdicion | null>(
            null
        );

    const [
        edicion,
        setEdicion,
    ] =
        useState<EdicionFormulario>(
            () =>
                crearEdicionVacia(
                    torneoID
                )
        );

    const [
        capacidades,
        setCapacidades,
    ] =
        useState({
            crear:
                false,

            editar:
                false,

            eliminar:
                false,
        });

    const [
        cargando,
        setCargando,
    ] =
        useState(
            true
        );

    const [
        guardando,
        setGuardando,
    ] =
        useState(
            false
        );

    const [
        errorCarga,
        setErrorCarga,
    ] =
        useState(
            ""
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const [
        pasoID,
        setPasoID,
    ] =
        useState<PasoID>(
            "general"
        );

    const [
        modificado,
        setModificado,
    ] =
        useState(
            false
        );

    const [
        confirmarSalida,
        setConfirmarSalida,
    ] =
        useState(
            false
        );

    const [
        intento,
        setIntento,
    ] =
        useState(
            0
        );

    // ========================================================
    // REFERENCIAS
    // ========================================================

    const originalRef =
        useRef(
            ""
        );

    const bloqueoGuardado =
        useRef(
            false
        );

    const tituloPasoRef =
        useRef<HTMLHeadingElement>(
            null
        );

    // ========================================================
    // PASOS
    // ========================================================

    const pasos =
        useMemo<Paso[]>(
            () => [
                {
                    id:
                        "general",

                    titulo:
                        "Informació general",
                },

                {
                    id:
                        "equips",

                    titulo:
                        "Equips",
                },

                {
                    id:
                        "voluntariat",

                    titulo:
                        "Voluntariat",
                },

                {
                    id:
                        "informacio",

                    titulo:
                        "Informació pública",
                },

                {
                    id:
                        "faq",

                    titulo:
                        "Preguntes freqüents",
                },

                {
                    id:
                        "resum",

                    titulo:
                        "Resum",
                },
            ],
            []
        );

    const indiceActual =
        Math.max(
            0,

            pasos.findIndex(
                paso =>
                    paso.id ===
                    pasoID
            )
        );

    const pasoActual =
        pasos[
            indiceActual
        ];

    const ultimoPaso =
        indiceActual ===
        pasos.length -
            1;

    // ========================================================
    // CARGA
    // ========================================================

    useEffect(() => {
        const controlador =
            new AbortController();

        async function cargar() {
            setCargando(
                true
            );

            setErrorCarga(
                ""
            );

            setError(
                ""
            );

            setConfirmarSalida(
                false
            );

            try {
                const parametros =
                    new URLSearchParams({
                        vista:
                            "asistente",

                        torneoID,
                    });

                if (
                    !creando &&
                    edicionID
                ) {
                    parametros.set(
                        "edicionID",
                        edicionID
                    );
                }

                const respuesta =
                    await fetch(
                        `${API}?${parametros.toString()}`,
                        {
                            credentials:
                                "same-origin",

                            cache:
                                "no-store",

                            signal:
                                controlador.signal,
                        }
                    );

                const datos =
                    await respuesta
                        .json()
                        .catch(
                            () =>
                                null
                        );

                if (
                    !respuesta.ok ||
                    datos?.success !==
                        true
                ) {
                    throw new Error(
                        datos?.mensaje ||
                            "No s'ha pogut carregar l'edició."
                    );
                }

                const resultado =
                    datos as RespuestaAsistente;

                if (
                    !creando &&
                    !resultado.edicion
                ) {
                    throw new Error(
                        "L'edició sol·licitada no està disponible."
                    );
                }

                if (
                    creando &&
                    !resultado
                        .capacidades
                        .crear
                ) {
                    throw new Error(
                        "No tens permís per crear edicions en aquest torneig."
                    );
                }

                if (
                    modo ===
                        "editar" &&
                    !resultado
                        .capacidades
                        .editar
                ) {
                    throw new Error(
                        "No tens permís per editar aquesta edició."
                    );
                }

                const nuevaEdicion =
                    resultado.edicion
                        ? normalizarEdicion(
                              resultado.edicion,
                              torneoID
                          )
                        : crearEdicionVacia(
                              torneoID
                          );

                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setTorneo(
                    resultado.torneo
                );

                setCapacidades(
                    resultado.capacidades
                );

                setEdicion(
                    nuevaEdicion
                );

                originalRef.current =
                    JSON.stringify(
                        nuevaEdicion
                    );

                setModificado(
                    false
                );

                setPasoID(
                    "general"
                );
            } catch (err) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setErrorCarga(
                    err instanceof
                    Error
                        ? err.message
                        : "No s'ha pogut carregar l'edició."
                );
            } finally {
                if (
                    !controlador
                        .signal
                        .aborted
                ) {
                    setCargando(
                        false
                    );
                }
            }
        }

        void cargar();

        return () =>
            controlador.abort();
    }, [
        torneoID,
        edicionID,
        modo,
        creando,
        intento,
    ]);

    // ========================================================
    // FOCO AL CAMBIAR PASO
    // ========================================================

    useEffect(() => {
        window.requestAnimationFrame(
            () =>
                tituloPasoRef
                    .current
                    ?.focus()
        );
    }, [
        pasoID,
    ]);

    // ========================================================
    // PERMISOS
    // ========================================================

    const puedeEditar =
        modo !==
            "ver" &&
        (
            creando
                ? capacidades
                      .crear
                : capacidades
                      .editar
        );

    const soloLectura =
        !puedeEditar;

    const bloqueado =
        guardando;

    // ========================================================
    // ACTUALIZACIÓN
    // ========================================================

    function aplicarEdicion(
        nueva:
            EdicionFormulario,
    ) {
        if (
            soloLectura ||
            guardando
        ) {
            return;
        }

        setEdicion(
            nueva
        );

        setModificado(
            JSON.stringify(
                nueva
            ) !==
                originalRef.current
        );

        setError(
            ""
        );
    }

    function cambiarGeneral(
        general:
            DatosGeneralesEdicion,
    ) {
        aplicarEdicion({
            ...edicion,

            general,
        });
    }

    function cambiarEquipos(
        equipos:
            ConfigEquipos,
    ) {
        aplicarEdicion({
            ...edicion,

            configuracion: {
                ...edicion
                    .configuracion,

                equipos,
            },
        });
    }

    function cambiarVoluntarios(
        voluntarios:
            ConfigVoluntarios,
    ) {
        aplicarEdicion({
            ...edicion,

            configuracion: {
                ...edicion
                    .configuracion,

                voluntarios,
            },
        });
    }

    function cambiarInformacion(
        informacion:
            ConfigInformacion,
    ) {
        aplicarEdicion({
            ...edicion,

            configuracion: {
                ...edicion
                    .configuracion,

                informacion,
            },
        });
    }

    function cambiarFAQ(
        faq:
            ConfigFAQ,
    ) {
        aplicarEdicion({
            ...edicion,

            configuracion: {
                ...edicion
                    .configuracion,

                faq,
            },
        });
    }

    // ========================================================
    // VALIDACIÓN GENERAL
    // ========================================================

    function validarGeneral():
        string | null {
        const general =
            edicion.general;

        const nombre =
            general.nombre
                .trim();

        if (
            !nombre
        ) {
            return "Indica el nom de l'edició.";
        }

        if (
            nombre.length >
            150
        ) {
            return "El nom de l'edició no pot superar els 150 caràcters.";
        }

        if (
            !general.fecha_inicio
        ) {
            return "Indica la data d'inici de l'edició.";
        }

        if (
            !general.fecha_fin
        ) {
            return "Indica la data de finalització de l'edició.";
        }

        if (
            !fechaValida(
                general.fecha_inicio
            ) ||
            !fechaValida(
                general.fecha_fin
            )
        ) {
            return "Les dates de l'edició no són vàlides.";
        }

        if (
            new Date(
                general.fecha_fin
            ).getTime() <
            new Date(
                general.fecha_inicio
            ).getTime()
        ) {
            return "La data de finalització no pot ser anterior a la data d'inici.";
        }

        if (
            ![
                "BORRADOR",
                "ACTIVA",
                "FINALIZADA",
            ].includes(
                general.estado
            )
        ) {
            return "Selecciona un estat vàlid per a l'edició.";
        }

        return null;
    }

    // ========================================================
    // VALIDACIÓN EQUIPOS
    // ========================================================

    function validarEquipos():
        string | null {
        const config =
            edicion
                .configuracion
                .equipos;

        const problemaPeriodo =
            validarPeriodo(
                config
                    .inscripcion
                    .apertura,

                config
                    .inscripcion
                    .cierre,

                "la inscripció d'equips"
            );

        if (
            problemaPeriodo
        ) {
            return problemaPeriodo;
        }

        if (
            config
                .cupo
                .maximo !==
                null &&
            config
                .cupo
                .maximo <
                0
        ) {
            return "El màxim d'equips no pot ser negatiu.";
        }

        const min =
            config
                .jugadores
                .minimo;

        const max =
            config
                .jugadores
                .maximo;

        if (
            min !==
                null &&
            min <
                1
        ) {
            return "El mínim de jugadors ha de ser superior a zero.";
        }

        if (
            max !==
                null &&
            max <
                1
        ) {
            return "El màxim de jugadors ha de ser superior a zero.";
        }

        if (
            min !==
                null &&
            max !==
                null &&
            max <
                min
        ) {
            return "El màxim de jugadors no pot ser inferior al mínim.";
        }

        if (
            config
                .genero
                .minimos
                .masculino <
                0 ||
            config
                .genero
                .minimos
                .femenino <
                0
        ) {
            return "Els mínims per gènere no poden ser negatius.";
        }

        if (
            config
                .genero
                .activo &&
            max !==
                null &&
            config
                .genero
                .minimos
                .masculino +
                config
                    .genero
                    .minimos
                    .femenino >
                max
        ) {
            return "La composició mínima per gènere no pot superar el màxim de jugadors de l'equip.";
        }

        if (
            config
                .profesores
                .minimo <
                0 ||
            config
                .profesores
                .maximo <
                0
        ) {
            return "El nombre de professors no pot ser negatiu.";
        }

        if (
            config
                .profesores
                .permitidos &&
            config
                .profesores
                .maximo <
                config
                    .profesores
                    .minimo
        ) {
            return "El màxim de professors no pot ser inferior al mínim.";
        }

        if (
            config
                .staff
                .minimo <
                0 ||
            config
                .staff
                .maximo <
                0
        ) {
            return "El nombre de membres de staff no pot ser negatiu.";
        }

        if (
            config
                .staff
                .permitido &&
            config
                .staff
                .maximo <
                config
                    .staff
                    .minimo
        ) {
            return "El màxim de membres de staff no pot ser inferior al mínim.";
        }

        return null;
    }

    // ========================================================
    // VALIDACIÓN VOLUNTARIADO
    // ========================================================

    function validarVoluntariado():
        string | null {
        const config =
            edicion
                .configuracion
                .voluntarios;

        const problemaPeriodo =
            validarPeriodo(
                config
                    .inscripcion
                    .apertura,

                config
                    .inscripcion
                    .cierre,

                "la inscripció de voluntariat"
            );

        if (
            problemaPeriodo
        ) {
            return problemaPeriodo;
        }

        if (
            config
                .cupo
                .maximo !==
                null &&
            config
                .cupo
                .maximo <
                0
        ) {
            return "El màxim general de voluntaris no pot ser negatiu.";
        }

        const nombres =
            new Set<string>();

        for (
            const tipo
            of config.tipos
        ) {
            const nombre =
                tipo.nombre
                    .trim();

            if (
                !nombre
            ) {
                return "Tots els tipus de voluntariat han de tenir un nom.";
            }

            if (
                nombre.length >
                150
            ) {
                return `El nom del tipus de voluntariat «${nombre}» és massa llarg.`;
            }

            const clave =
                nombre
                    .toLocaleLowerCase(
                        "ca-ES"
                    );

            if (
                nombres.has(
                    clave
                )
            ) {
                return "No pot haver-hi dos tipus de voluntariat amb el mateix nom.";
            }

            nombres.add(
                clave
            );

            if (
                tipo
                    .cupo
                    .maximo !==
                    null &&
                tipo
                    .cupo
                    .maximo <
                    0
            ) {
                return `El màxim de voluntaris de «${nombre}» no pot ser negatiu.`;
            }
        }

        return null;
    }

    // ========================================================
    // VALIDACIÓN INFORMACIÓN
    // ========================================================

    function validarInformacion():
        string | null {
        const bloques =
            edicion
                .configuracion
                .informacion
                .bloques;

        for (
            const bloque
            of bloques
        ) {
            const titulo =
                bloque.title
                    .trim();

            if (
                !titulo
            ) {
                return "Tots els apartats d'informació han de tenir un títol.";
            }

            if (
                titulo.length >
                200
            ) {
                return `El títol «${titulo}» supera els 200 caràcters.`;
            }

            const texto =
                bloque.body
                    .replace(
                        /<[^>]*>/g,
                        " "
                    )
                    .replace(
                        /&nbsp;/gi,
                        " "
                    )
                    .replace(
                        /&amp;/gi,
                        "&"
                    )
                    .replace(
                        /&lt;/gi,
                        "<"
                    )
                    .replace(
                        /&gt;/gi,
                        ">"
                    )
                    .replace(
                        /\s+/g,
                        " "
                    )
                    .trim();

            if (
                !texto
            ) {
                return `L'apartat «${titulo}» no té contingut.`;
            }
        }

        return null;
    }

    // ========================================================
    // VALIDACIÓN FAQ
    // ========================================================

    function validarFAQ():
        string | null {
        const preguntas =
            edicion
                .configuracion
                .faq
                .preguntas;

        const textos =
            new Set<string>();

        for (
            const pregunta
            of preguntas
        ) {
            const titulo =
                pregunta
                    .pregunta
                    .trim();

            const respuesta =
                pregunta
                    .respuesta
                    .trim();

            if (
                !titulo
            ) {
                return "Totes les preguntes freqüents han de tenir una pregunta.";
            }

            if (
                titulo.length >
                200
            ) {
                return `La pregunta «${titulo}» supera els 200 caràcters.`;
            }

            if (
                !respuesta
            ) {
                return `La pregunta «${titulo}» no té resposta.`;
            }

            if (
                respuesta.length >
                5000
            ) {
                return `La resposta de «${titulo}» supera els 5000 caràcters.`;
            }

            const clave =
                titulo
                    .toLocaleLowerCase(
                        "ca-ES"
                    );

            if (
                textos.has(
                    clave
                )
            ) {
                return "No pot haver-hi dues preguntes freqüents iguals.";
            }

            textos.add(
                clave
            );
        }

        return null;
    }

    // ========================================================
    // VALIDAR PASO
    // ========================================================

    function validarPaso(
        paso:
            PasoID,
    ): string | null {
        switch (
            paso
        ) {
            case "general":
                return validarGeneral();

            case "equips":
                return validarEquipos();

            case "voluntariat":
                return validarVoluntariado();

            case "informacio":
                return validarInformacion();

            case "faq":
                return validarFAQ();

            case "resum":
                return null;
        }
    }

    // ========================================================
    // NAVEGACIÓN
    // ========================================================

    function irPaso(
        nuevoIndice:
            number,
    ) {
        if (
            nuevoIndice <
                0 ||
            nuevoIndice >=
                pasos.length ||
            guardando
        ) {
            return;
        }

        if (
            !soloLectura &&
            nuevoIndice >
                indiceActual
        ) {
            for (
                let indice =
                    indiceActual;
                indice <
                    nuevoIndice;
                indice++
            ) {
                const paso =
                    pasos[
                        indice
                    ];

                const problema =
                    validarPaso(
                        paso.id
                    );

                if (
                    problema
                ) {
                    setError(
                        problema
                    );

                    setPasoID(
                        paso.id
                    );

                    return;
                }
            }
        }

        setError(
            ""
        );

        setPasoID(
            pasos[
                nuevoIndice
            ].id
        );
    }

    function anterior() {
        irPaso(
            indiceActual -
                1
        );
    }

    function siguiente() {
        irPaso(
            indiceActual +
                1
        );
    }

    // ========================================================
    // SALIR
    // ========================================================

    function solicitarSalida() {
        if (
            guardando
        ) {
            return;
        }

        if (
            modificado &&
            puedeEditar
        ) {
            setConfirmarSalida(
                true
            );

            return;
        }

        window.location.assign(
            volver
        );
    }

    // ========================================================
    // GUARDAR
    // ========================================================

    async function guardar() {
        if (
            !puedeEditar ||
            bloqueoGuardado
                .current
        ) {
            return;
        }

        const validaciones: {
            paso:
                PasoID;

            problema:
                string | null;
        }[] = [
            {
                paso:
                    "general",

                problema:
                    validarGeneral(),
            },

            {
                paso:
                    "equips",

                problema:
                    validarEquipos(),
            },

            {
                paso:
                    "voluntariat",

                problema:
                    validarVoluntariado(),
            },

            {
                paso:
                    "informacio",

                problema:
                    validarInformacion(),
            },

            {
                paso:
                    "faq",

                problema:
                    validarFAQ(),
            },
        ];

        const errorValidacion =
            validaciones.find(
                entrada =>
                    entrada.problema
            );

        if (
            errorValidacion
                ?.problema
        ) {
            setPasoID(
                errorValidacion
                    .paso
            );

            setError(
                errorValidacion
                    .problema
            );

            return;
        }

        bloqueoGuardado
            .current =
            true;

        setGuardando(
            true
        );

        setError(
            ""
        );

        try {
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

                        cache:
                            "no-store",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                accion:
                                    creando
                                        ? "crear"
                                        : "editar",

                                torneoID,

                                edicionID:
                                    edicion.id,

                                updated_at:
                                    edicion.updated_at,

                                datos: {
                                    general:
                                        edicion.general,

                                    configuracion:
                                        edicion.configuracion,
                                },
                            }),
                    }
                );

            const datos =
                await respuesta
                    .json()
                    .catch(
                        () =>
                            null
                    );

            if (
                !respuesta.ok ||
                datos?.success !==
                    true
            ) {
                throw new Error(
                    datos?.mensaje ||
                        "No s'ha pogut desar l'edició."
                );
            }

            setModificado(
                false
            );

            const destino =
                new URLSearchParams({
                    torneoID,

                    guardado:
                        creando
                            ? "creada"
                            : "editada",
                });

            window.location.assign(
                `/panell/edicions?${destino.toString()}`
            );
        } catch (err) {
            setError(
                err instanceof
                Error
                    ? err.message
                    : "No s'ha pogut desar l'edició."
            );
        } finally {
            bloqueoGuardado
                .current =
                false;

            setGuardando(
                false
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
            <div
                className="
                    flex
                    min-h-80
                    items-center
                    justify-center
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    p-8
                    text-neutral
                "
            >
                <div
                    className="
                        flex
                        flex-col
                        items-center
                        gap-4
                        text-center
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            h-9
                            w-9
                            animate-spin
                            rounded-full
                            border-2
                            border-border
                            border-t-primary
                        "
                    />

                    <div>
                        <p
                            className="
                                text-sm
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            Carregant edició
                        </p>

                        <p
                            className="
                                mt-1
                                text-xs
                            "
                        >
                            Recuperant la configuració.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // ERROR CARGA
    // ========================================================

    if (
        errorCarga ||
        !torneo
    ) {
        return (
            <div
                className="
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    p-6
                    text-neutral
                "
            >
                <div
                    className="
                        mx-auto
                        max-w-lg
                        text-center
                    "
                >
                    <h2
                        className="
                            text-lg
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        No s'ha pogut carregar l'edició
                    </h2>

                    <p
                        className="
                            mt-2
                            text-sm
                            leading-6
                        "
                    >
                        {
                            errorCarga ||
                            "La informació necessària no està disponible."
                        }
                    </p>

                    <div
                        className="
                            mt-6
                            flex
                            flex-wrap
                            justify-center
                            gap-3
                        "
                    >
                        <button
                            type="button"
                            onClick={() =>
                                setIntento(
                                    valor =>
                                        valor +
                                        1
                                )
                            }
                            className="
                                rounded-lg
                                bg-primary
                                px-4
                                py-2.5
                                text-sm
                                font-semibold
                                text-white
                                hover:bg-primary/90
                            "
                        >
                            Tornar-ho a provar
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                window.location.assign(
                                    volver
                                )
                            }
                            className="
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
                            "
                        >
                            Tornar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // RENDER PASO
    // ========================================================

    function renderPaso(
        torneoActual:
            TorneoEdicion,
    ) {
        switch (
            pasoActual.id
        ) {
            case "general":
                return (
                    <PasoGeneral
                        valor={
                            edicion
                                .general
                        }
                        torneo={
                            torneoActual
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={
                            cambiarGeneral
                        }
                    />
                );

            case "equips":
                return (
                    <PasoEquips
                        valor={
                            edicion
                                .configuracion
                                .equipos
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={
                            cambiarEquipos
                        }
                    />
                );

            case "voluntariat":
                return (
                    <PasoVoluntariat
                        valor={
                            edicion
                                .configuracion
                                .voluntarios
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={
                            cambiarVoluntarios
                        }
                    />
                );

            case "informacio":
                return (
                    <PasoInformacio
                        valor={
                            edicion
                                .configuracion
                                .informacion
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={
                            cambiarInformacion
                        }
                    />
                );

            case "faq":
                return (
                    <PasoFAQ
                        valor={
                            edicion
                                .configuracion
                                .faq
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={
                            cambiarFAQ
                        }
                    />
                );

            case "resum":
                return (
                    <PasoResumen
                        torneo={
                            torneoActual
                        }
                        edicion={
                            edicion
                        }
                        soloLectura={
                            soloLectura
                        }
                    />
                );
        }
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <>
            <div
                aria-busy={
                    guardando
                }
                className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-background
                    text-neutral
                "
            >
                {/* =============================================
                    CABECERA
                ============================================= */}

                <header
                    className="
                        border-b
                        border-border
                        px-5
                        py-5
                        sm:px-7
                    "
                >
                    <div
                        className="
                            flex
                            flex-col
                            gap-4
                            lg:flex-row
                            lg:items-center
                            lg:justify-between
                        "
                    >
                        <div>
                            <p
                                className="
                                    text-xs
                                    font-medium
                                    tracking-wide
                                "
                            >
                                GESTIÓ D'EDICIONS
                            </p>

                            <h2
                                ref={
                                    tituloPasoRef
                                }
                                tabIndex={
                                    -1
                                }
                                className="
                                    mt-1
                                    text-xl
                                    font-semibold
                                    tracking-tight
                                    text-neutral-titulos
                                    outline-none
                                "
                            >
                                {
                                    creando
                                        ? "Crear nova edició"
                                        : modo ===
                                            "ver"
                                          ? edicion
                                                .general
                                                .nombre ||
                                            "Consultar edició"
                                          : "Editar edició"
                                }
                            </h2>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    leading-6
                                "
                            >
                                {
                                    torneo.nombre ||
                                    "Torneig seleccionat"
                                }

                                {
                                    torneo.deporte &&
                                    ` · ${torneo.deporte}`
                                }
                            </p>
                        </div>

                        <div
                            className="
                                flex
                                flex-wrap
                                gap-2
                            "
                        >
                            {
                                edicion
                                    .general
                                    .estado && (
                                    <span
                                        className="
                                            rounded-full
                                            border
                                            border-border
                                            bg-card
                                            px-3
                                            py-1.5
                                            text-xs
                                        "
                                    >
                                        Estat:{" "}
                                        {
                                            edicion
                                                .general
                                                .estado
                                        }
                                    </span>
                                )
                            }

                            {
                                modificado &&
                                puedeEditar && (
                                    <span
                                        className="
                                            rounded-full
                                            border
                                            border-border
                                            bg-card
                                            px-3
                                            py-1.5
                                            text-xs
                                        "
                                    >
                                        Canvis sense desar
                                    </span>
                                )
                            }

                            {
                                soloLectura && (
                                    <span
                                        className="
                                            rounded-full
                                            border
                                            border-border
                                            bg-card
                                            px-3
                                            py-1.5
                                            text-xs
                                        "
                                    >
                                        Només lectura
                                    </span>
                                )
                            }
                        </div>
                    </div>
                </header>

                {/* =============================================
                    PASOS
                ============================================= */}

                <nav
                    aria-label="Passos de configuració de l'edició"
                    className="
                        border-b
                        border-border
                        bg-card/35
                        px-4
                        py-4
                        sm:px-6
                    "
                >
                    <div
                        className="
                            scroll-personalizada
                            flex
                            gap-2
                            overflow-x-auto
                            pb-1
                        "
                    >
                        {
                            pasos.map(
                                (
                                    paso,
                                    indice
                                ) => {
                                    const activo =
                                        indice ===
                                        indiceActual;

                                    const anterior =
                                        indice <
                                        indiceActual;

                                    return (
                                        <button
                                            key={
                                                paso.id
                                            }
                                            type="button"
                                            aria-current={
                                                activo
                                                    ? "step"
                                                    : undefined
                                            }
                                            disabled={
                                                guardando
                                            }
                                            onClick={() =>
                                                irPaso(
                                                    indice
                                                )
                                            }
                                            className={`
                                                group
                                                flex
                                                min-w-max
                                                items-center
                                                gap-2.5
                                                rounded-xl
                                                border
                                                px-3
                                                py-2.5
                                                text-left
                                                transition-colors
                                                focus-visible:outline-none
                                                focus-visible:ring-2
                                                focus-visible:ring-neutral/30
                                                disabled:cursor-wait
                                                disabled:opacity-60

                                                ${
                                                    activo
                                                        ? "border-neutral/40 bg-background"
                                                        : "border-transparent hover:border-border hover:bg-background/70"
                                                }
                                            `}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`
                                                    flex
                                                    h-7
                                                    w-7
                                                    items-center
                                                    justify-center
                                                    rounded-lg
                                                    border
                                                    text-xs
                                                    font-semibold

                                                    ${
                                                        activo
                                                            ? "border-neutral/40 bg-card"
                                                            : anterior
                                                              ? "border-border bg-background"
                                                              : "border-border bg-card"
                                                    }
                                                `}
                                            >
                                                {
                                                    anterior ? (
                                                        <svg
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.8"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            className="
                                                                h-3.5
                                                                w-3.5
                                                            "
                                                        >
                                                            <path d="m5 12 4 4L19 6" />
                                                        </svg>
                                                    ) : (
                                                        indice +
                                                        1
                                                    )
                                                }
                                            </span>

                                            <span>
                                                <span
                                                    className="
                                                        block
                                                        text-[10px]
                                                        leading-none
                                                    "
                                                >
                                                    PAS{" "}
                                                    {
                                                        indice +
                                                        1
                                                    }
                                                </span>

                                                <span
                                                    className="
                                                        mt-1
                                                        block
                                                        max-w-44
                                                        truncate
                                                        text-xs
                                                        font-semibold
                                                    "
                                                >
                                                    {
                                                        paso.titulo
                                                    }
                                                </span>
                                            </span>
                                        </button>
                                    );
                                }
                            )
                        }
                    </div>
                </nav>

                {/* =============================================
                    CONTENIDO
                ============================================= */}

                <main
                    className="
                        mx-auto
                        w-full
                        max-w-6xl
                        px-5
                        py-7
                        sm:px-7
                        sm:py-8
                    "
                >
                    {
                        error && (
                            <div
                                role="alert"
                                className="
                                    mb-6
                                    flex
                                    items-start
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
                                    className="
                                        mt-0.5
                                        h-5
                                        w-5
                                        shrink-0
                                    "
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

                                <div
                                    className="
                                        min-w-0
                                    "
                                >
                                    <p
                                        className="
                                            text-sm
                                            font-semibold
                                        "
                                    >
                                        Revisa aquest pas
                                    </p>

                                    <p
                                        className="
                                            mt-1
                                            text-sm
                                            leading-6
                                        "
                                    >
                                        {error}
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    {renderPaso(torneo)}
                </main>

                {/* =============================================
                    FOOTER
                ============================================= */}

                <footer
                    className="
                        border-t
                        border-border
                        bg-card/25
                        px-5
                        py-4
                        sm:px-7
                    "
                >
                    <div
                        className="
                            flex
                            flex-col
                            gap-3
                            sm:flex-row
                            sm:items-center
                            sm:justify-between
                        "
                    >
                        <button
                            type="button"
                            disabled={
                                guardando
                            }
                            onClick={
                                solicitarSalida
                            }
                            className="
                                inline-flex
                                items-center
                                justify-center
                                rounded-lg
                                border
                                border-border
                                bg-background
                                px-4
                                py-2.5
                                text-sm
                                font-medium
                                text-neutral
                                hover:border-neutral/40
                                disabled:cursor-wait
                                disabled:opacity-50
                            "
                        >
                            {
                                modo ===
                                "ver"
                                    ? "Tancar"
                                    : "Cancel·lar"
                            }
                        </button>

                        <div
                            className="
                                flex
                                flex-col-reverse
                                gap-2
                                sm:flex-row
                            "
                        >
                            {
                                indiceActual >
                                    0 && (
                                    <button
                                        type="button"
                                        disabled={
                                            guardando
                                        }
                                        onClick={
                                            anterior
                                        }
                                        className="
                                            inline-flex
                                            items-center
                                            justify-center
                                            gap-2
                                            rounded-lg
                                            border
                                            border-border
                                            bg-background
                                            px-4
                                            py-2.5
                                            text-sm
                                            font-medium
                                            text-neutral
                                            hover:border-neutral/40
                                            disabled:cursor-wait
                                            disabled:opacity-50
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
                                            className="
                                                h-4
                                                w-4
                                            "
                                        >
                                            <path d="m15 18-6-6 6-6" />
                                        </svg>

                                        Anterior
                                    </button>
                                )
                            }

                            {
                                !ultimoPaso ? (
                                    <button
                                        type="button"
                                        disabled={
                                            guardando
                                        }
                                        onClick={
                                            siguiente
                                        }
                                        className="
                                            inline-flex
                                            items-center
                                            justify-center
                                            gap-2
                                            rounded-lg
                                            bg-primary
                                            px-5
                                            py-2.5
                                            text-sm
                                            font-semibold
                                            text-white
                                            hover:bg-primary/90
                                            disabled:cursor-wait
                                            disabled:opacity-50
                                        "
                                    >
                                        Següent

                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.7"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            className="
                                                h-4
                                                w-4
                                            "
                                        >
                                            <path d="m9 18 6-6-6-6" />
                                        </svg>
                                    </button>
                                ) : puedeEditar ? (
                                    <button
                                        type="button"
                                        disabled={
                                            guardando
                                        }
                                        onClick={() =>
                                            void guardar()
                                        }
                                        className="
                                            inline-flex
                                            items-center
                                            justify-center
                                            gap-2
                                            rounded-lg
                                            bg-primary
                                            px-5
                                            py-2.5
                                            text-sm
                                            font-semibold
                                            text-white
                                            hover:bg-primary/90
                                            disabled:cursor-wait
                                            disabled:opacity-50
                                        "
                                    >
                                        {
                                            guardando && (
                                                <span
                                                    aria-hidden="true"
                                                    className="
                                                        h-4
                                                        w-4
                                                        animate-spin
                                                        rounded-full
                                                        border-2
                                                        border-white/35
                                                        border-t-white
                                                    "
                                                />
                                            )
                                        }

                                        {
                                            guardando
                                                ? "Desant..."
                                                : creando
                                                  ? "Crear edició"
                                                  : "Desar canvis"
                                        }
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            window.location.assign(
                                                volver
                                            )
                                        }
                                        className="
                                            rounded-lg
                                            bg-primary
                                            px-5
                                            py-2.5
                                            text-sm
                                            font-semibold
                                            text-white
                                            hover:bg-primary/90
                                        "
                                    >
                                        Tancar
                                    </button>
                                )
                            }
                        </div>
                    </div>
                </footer>
            </div>

            {/* =============================================
                CONFIRMACIÓN SALIDA
            ============================================= */}

            {
                confirmarSalida && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sortir-edicio-titol"
                        className="
                            fixed
                            inset-0
                            z-100
                            flex
                            items-center
                            justify-center
                            bg-black/35
                            p-4
                            backdrop-blur-sm
                        "
                        onMouseDown={
                            evento => {
                                if (
                                    evento.target ===
                                    evento.currentTarget
                                ) {
                                    setConfirmarSalida(
                                        false
                                    );
                                }
                            }
                        }
                    >
                        <div
                            className="
                                w-full
                                max-w-md
                                rounded-2xl
                                border
                                border-border
                                bg-background
                                p-6
                                shadow-xl
                            "
                        >
                            <h2
                                id="sortir-edicio-titol"
                                className="
                                    text-lg
                                    font-semibold
                                    text-neutral-titulos
                                "
                            >
                                Descartar els canvis?
                            </h2>

                            <p
                                className="
                                    mt-2
                                    text-sm
                                    leading-6
                                    text-neutral
                                "
                            >
                                Hi ha canvis que encara no s'han desat. Si surts ara, es perdran.
                            </p>

                            <div
                                className="
                                    mt-6
                                    flex
                                    flex-col-reverse
                                    gap-2
                                    sm:flex-row
                                    sm:justify-end
                                "
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setConfirmarSalida(
                                            false
                                        )
                                    }
                                    className="
                                        rounded-lg
                                        border
                                        border-border
                                        bg-background
                                        px-4
                                        py-2.5
                                        text-sm
                                        font-medium
                                        text-neutral
                                        hover:border-neutral/40
                                    "
                                >
                                    Continuar editant
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        window.location.assign(
                                            volver
                                        )
                                    }
                                    className="
                                        rounded-lg
                                        bg-error
                                        px-4
                                        py-2.5
                                        text-sm
                                        font-semibold
                                        text-white
                                    "
                                >
                                    Descartar i sortir
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    );
}