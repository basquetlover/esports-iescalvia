import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    completarPermisosAmbito,
    crearDocumentoPermisos,
    normalizarRol,
    obtenerSecciones,
    permisoPermitidoPorRol,
    prepararDocumentoPermisos,
    type DocumentoPermisos,
    type PermisosAmbito,
    type Rol,
} from "@const/Permisos";

import PasoUsuario from "./pasos/PasoUsuario";
import PasoTornejos from "./pasos/PasoTornejos";
import PasoGeneral from "./pasos/PasoGeneral";
import PasoTorneo from "./pasos/PasoTorneo";
import PasoResumen from "./pasos/PasoResumen";

const API = "/api/panell/permisos";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    usuarioID: string;

    modo:
        | "crear"
        | "editar"
        | "ver";

    onCancelar: () => void;

    onGuardado: (
        mensaje: string,
    ) => void;
};

type Usuario = {
    id: string;

    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;

    email: string | null;

    rol: string | null;
    permisos: unknown;

    origen_permisos: string | null;

    activa: boolean | null;

    fecha_actualizacion:
        string | null;
};

type Torneo = {
    id: string;

    nombre: string | null;
    deporte: string | null;

    /*
     * Rol efectivo del administrador actual
     * en este torneo.
     */
    rolAdministrador:
        Rol | null;
};

type RolDisponible = {
    valor: Rol;
    nombre: string;
    nivel: number;
};

type Configuracion = {
    roles:
        RolDisponible[];

    torneos:
        Torneo[];

    capacidades: {
        crear: boolean;
        editar: boolean;
        eliminar: boolean;
        concederTodos: boolean;
    };

    administrador?: {
        rol: Rol;
        nivel: number;
    };
};

type Detalle = {
    usuario:
        Usuario;

    capacidades: {
        crear: boolean;
        editar: boolean;
        eliminar: boolean;
    };
};

// ============================================================
// PASOS
// ============================================================

type Paso =
    | {
          id: "usuario";
          tipo: "usuario";
          titulo: string;
      }
    | {
          id: "accesos";
          tipo: "accesos";
          titulo: string;
      }
    | {
          id: "general";
          tipo: "general";
          titulo: string;
      }
    | {
          id: string;
          tipo: "torneo";
          titulo: string;
          torneoID: string;
      }
    | {
          id: "resumen";
          tipo: "resumen";
          titulo: string;
      };

// ============================================================
// HELPERS GENERALES
// ============================================================

function esObjeto(
    valor: unknown,
): valor is Record<
    string,
    unknown
> {
    return (
        valor !== null &&
        typeof valor ===
            "object" &&
        !Array.isArray(
            valor,
        )
    );
}

async function obtener<T>(
    parametros:
        URLSearchParams,
    signal:
        AbortSignal,
): Promise<T> {
    const respuesta =
        await fetch(
            `${API}?${parametros.toString()}`,
            {
                credentials:
                    "same-origin",

                cache:
                    "no-store",

                signal,
            },
        );

    const datos =
        await respuesta
            .json()
            .catch(
                () => null,
            );

    if (
        !respuesta.ok ||
        datos?.success !==
            true
    ) {
        throw new Error(
            datos?.mensaje ||
                "No s'ha pogut carregar la informació.",
        );
    }

    return datos as T;
}

function nombreTorneo(
    torneo:
        Torneo | undefined,
    id: string,
) {
    return (
        torneo
            ?.nombre
            ?.trim() ||
        `Torneig ${id}`
    );
}

// ============================================================
// ADAPTACIÓN DE PERMISOS EXISTENTES
// ============================================================

function cargarDocumento(
    usuario: Usuario,
    creando: boolean,
): {
    documento:
        DocumentoPermisos;

    rolGeneral:
        Rol | null;

    advertencias:
        string[];
} {
    /*
     * CREACIÓN
     */
    if (creando) {
        return {
            documento:
                crearDocumentoPermisos(
                    null,
                ),

            rolGeneral:
                null,

            advertencias:
                [],
        };
    }

    const advertencias:
        string[] = [];

    const rolGeneral =
        normalizarRol(
            usuario.rol,
        );

    if (
        usuario.rol !== null &&
        !rolGeneral
    ) {
        advertencias.push(
            "El rol general anterior no és vàlid. Selecciona un rol abans de desar.",
        );
    }

    const documento =
        crearDocumentoPermisos(
            rolGeneral,
        );

    const original =
        esObjeto(
            usuario.permisos,
        )
            ? usuario.permisos
            : null;

    if (!original) {
        advertencias.push(
            "Els permisos anteriors no tenen una estructura completa. Revisa la configuració abans de desar.",
        );

        return {
            documento,
            rolGeneral,
            advertencias,
        };
    }

    if (
        original.version !==
            undefined &&
        original.version !== 1
    ) {
        advertencias.push(
            "La configuració anterior s'adaptarà al format actual.",
        );
    }

    // ========================================================
    // PERMISOS DE UN ÁMBITO
    // ========================================================

    function prepararAmbito(
        ambito:
            | "general"
            | "torneo",

        rol:
            Rol | null,

        valor:
            unknown,

        etiqueta:
            string,
    ): PermisosAmbito {
        const secciones =
            obtenerSecciones(
                ambito,
            );

        if (
            valor !==
                undefined &&
            !esObjeto(valor)
        ) {
            advertencias.push(
                `${etiqueta}: l'estructura anterior no és vàlida.`,
            );

            return completarPermisosAmbito(
                ambito,
                rol,
            );
        }

        const entrada =
            esObjeto(valor)
                ? valor
                : null;

        const existentes:
            PermisosAmbito = {};

        if (entrada) {
            /*
             * Avisos por secciones antiguas/no reconocidas.
             */
            for (
                const [
                    seccionID,
                    contenido,
                ]
                of Object.entries(
                    entrada,
                )
            ) {
                const seccion =
                    secciones.find(
                        (item) =>
                            item.id ===
                            seccionID,
                    );

                if (!seccion) {
                    advertencias.push(
                        `${etiqueta}: la secció antiga «${seccionID}» no forma part de la configuració actual.`,
                    );

                    continue;
                }

                if (
                    !esObjeto(
                        contenido,
                    )
                ) {
                    advertencias.push(
                        `${etiqueta}: cal revisar la secció «${seccion.nombre}».`,
                    );

                    continue;
                }

                existentes[
                    seccionID
                ] = {};

                for (
                    const [
                        accion,
                        valorAccion,
                    ]
                    of Object.entries(
                        contenido,
                    )
                ) {
                    if (
                        !seccion
                            .acciones
                            .includes(
                                accion,
                            )
                    ) {
                        advertencias.push(
                            `${etiqueta}: l'acció antiga «${seccionID}.${accion}» no forma part de la configuració actual.`,
                        );

                        continue;
                    }

                    if (
                        typeof valorAccion !==
                        "boolean"
                    ) {
                        advertencias.push(
                            `${etiqueta}: «${seccionID}.${accion}» no tenia un valor vàlid.`,
                        );

                        continue;
                    }

                    existentes[
                        seccionID
                    ][
                        accion
                    ] =
                        valorAccion;
                }
            }
        }

        return completarPermisosAmbito(
            ambito,
            rol,
            entrada
                ? existentes
                : undefined,
        );
    }

    // ========================================================
    // FORMATO ESTRUCTURADO / LEGACY
    // ========================================================

    const estructurado =
        [
            "version",
            "globales",
            "acceso_torneos",
            "torneos",
        ].some(
            (clave) =>
                Object.hasOwn(
                    original,
                    clave,
                ),
        );

    documento.globales =
        prepararAmbito(
            "general",
            rolGeneral,

            estructurado
                ? original.globales
                : original,

            "Permisos generals",
        );

    /*
     * El acceso al panel ya no es configurable.
     */
    documento.globales.panell = {
        ver:
            rolGeneral !==
            null,
    };

    // ========================================================
    // TODOS LOS TORNEOS
    // ========================================================

    const accesoComun =
        esObjeto(
            original
                .acceso_torneos,
        )
            ? original
                  .acceso_torneos
            : null;

    const todos =
        accesoComun
            ?.todos ===
        true;

    const rolComun =
        todos
            ? normalizarRol(
                  accesoComun
                      ?.rol,
              )
            : null;

    if (
        todos &&
        !rolComun
    ) {
        advertencias.push(
            "L'accés a tots els tornejos no tenia un rol vàlid.",
        );
    }

    documento.acceso_torneos = {
        todos,

        rol:
            todos
                ? rolComun
                : null,

        permisos:
            prepararAmbito(
                "torneo",

                todos
                    ? rolComun
                    : null,

                accesoComun
                    ?.permisos,

                "Tots els tornejos",
            ),
    };

    documento
        .acceso_torneos
        .permisos
        .panell = {
        ver:
            todos &&
            rolComun !==
                null,
    };

    // ========================================================
    // TORNEOS INDIVIDUALES
    // ========================================================

    const torneosAnteriores =
        original.torneos;

    if (
        torneosAnteriores !==
            undefined &&
        !esObjeto(
            torneosAnteriores,
        )
    ) {
        advertencias.push(
            "Les assignacions anteriors dels tornejos no són vàlides.",
        );
    }

    const UUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
        esObjeto(
            torneosAnteriores,
        )
    ) {
        for (
            const [
                idOriginal,
                valor,
            ]
            of Object.entries(
                torneosAnteriores,
            )
        ) {
            if (
                !UUID.test(
                    idOriginal,
                )
            ) {
                advertencias.push(
                    `L'assignació «${idOriginal}» no té un identificador vàlid i no es conservarà.`,
                );

                continue;
            }

            const id =
                idOriginal
                    .toLowerCase();

            if (
                Object.hasOwn(
                    documento.torneos,
                    id,
                )
            ) {
                throw new Error(
                    "Hi ha assignacions duplicades d'un mateix torneig.",
                );
            }

            if (
                !esObjeto(
                    valor,
                )
            ) {
                advertencias.push(
                    `L'assignació del torneig ${id} no és vàlida.`,
                );

                continue;
            }

            const acceso =
                valor.acceso ===
                true;

            const rolAsignado =
                acceso
                    ? (
                          valor.rol ===
                          undefined
                              ? rolGeneral
                              : normalizarRol(
                                    valor.rol,
                                )
                      )
                    : null;

            if (
                acceso &&
                !rolAsignado
            ) {
                advertencias.push(
                    `El torneig ${id} necessita un rol vàlid.`,
                );
            }

            const permisos =
                prepararAmbito(
                    "torneo",

                    acceso
                        ? rolAsignado
                        : null,

                    valor.permisos,

                    `Torneig ${id}`,
                );

            permisos.panell = {
                ver:
                    acceso &&
                    rolAsignado !==
                        null,
            };

            documento.torneos[
                id
            ] = {
                acceso,
                rol:
                    rolAsignado,
                permisos,
            };
        }
    }

    if (
        typeof original
            .ultima_actualizacion ===
        "string"
    ) {
        documento
            .ultima_actualizacion =
            original
                .ultima_actualizacion;
    }

    return {
        documento,

        rolGeneral,

        advertencias: [
            ...new Set(
                advertencias,
            ),
        ],
    };
}

// ============================================================
// PERMISOS GENERALES DISPONIBLES
// ============================================================

function tieneConfiguracionGeneral(
    rol:
        Rol | null,
): boolean {
    if (!rol) {
        return false;
    }

    return obtenerSecciones(
        "general",
        true,
    ).some(
        (seccion) =>
            seccion.id !==
                "panell" &&
            seccion.acciones.some(
                (accion) =>
                    permisoPermitidoPorRol(
                        "general",
                        rol,
                        seccion.id,
                        accion,
                    ),
            ),
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Asistente({
    usuarioID,
    modo,
    onCancelar,
    onGuardado,
}: Props) {
    const [
        detalle,
        setDetalle,
    ] =
        useState<Detalle | null>(
            null,
        );

    const [
        configuracion,
        setConfiguracion,
    ] =
        useState<Configuracion | null>(
            null,
        );

    const [
        documento,
        setDocumento,
    ] =
        useState<DocumentoPermisos | null>(
            null,
        );

    /*
     * NUEVO:
     *
     * users.rol deja de derivarse de los torneos.
     */
    const [
        rolGeneral,
        setRolGeneral,
    ] =
        useState<Rol | null>(
            null,
        );

    const [
        advertencias,
        setAdvertencias,
    ] =
        useState<string[]>(
            [],
        );

    const [
        revisionAceptada,
        setRevisionAceptada,
    ] =
        useState(false);

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
        errorCarga,
        setErrorCarga,
    ] =
        useState("");

    const [
        error,
        setError,
    ] =
        useState("");

    const [
        intento,
        setIntento,
    ] =
        useState(0);

    const [
        pasoID,
        setPasoID,
    ] =
        useState<string>(
            "usuario",
        );

    const [
        modificado,
        setModificado,
    ] =
        useState(false);

    const [
        confirmarSalida,
        setConfirmarSalida,
    ] =
        useState(false);

    const bloqueoGuardado =
        useRef(false);

    const tituloPasoRef =
        useRef<HTMLHeadingElement>(
            null,
        );

    // ========================================================
    // CARGA
    // ========================================================

    useEffect(() => {
        const controlador =
            new AbortController();

        setCargando(true);

        setErrorCarga("");
        setError("");

        setDetalle(null);
        setConfiguracion(null);
        setDocumento(null);

        setRolGeneral(
            null,
        );

        async function cargar() {
            try {
                const [
                    nuevaConfiguracion,
                    nuevoDetalle,
                ] =
                    await Promise.all(
                        [
                            obtener<Configuracion>(
                                new URLSearchParams(
                                    {
                                        vista:
                                            "configuracion",
                                    },
                                ),

                                controlador
                                    .signal,
                            ),

                            obtener<Detalle>(
                                new URLSearchParams(
                                    {
                                        vista:
                                            "detalle",

                                        id:
                                            usuarioID,
                                    },
                                ),

                                controlador
                                    .signal,
                            ),
                        ],
                    );

                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                const resultado =
                    cargarDocumento(
                        nuevoDetalle
                            .usuario,

                        modo ===
                            "crear",
                    );

                setConfiguracion(
                    nuevaConfiguracion,
                );

                setDetalle(
                    nuevoDetalle,
                );

                setDocumento(
                    resultado.documento,
                );

                setRolGeneral(
                    resultado.rolGeneral,
                );

                setAdvertencias(
                    resultado.advertencias,
                );

                setRevisionAceptada(
                    false,
                );

                setModificado(
                    false,
                );

                setPasoID(
                    "usuario",
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
                        : "No s'ha pogut carregar la informació.",
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

        return () =>
            controlador.abort();
    }, [
        usuarioID,
        modo,
        intento,
    ]);

    // ========================================================
    // MAPAS
    // ========================================================

    const torneosPorID =
        useMemo(
            () =>
                new Map(
                    (
                        configuracion
                            ?.torneos ??
                        []
                    ).map(
                        (torneo) => [
                            torneo.id
                                .toLowerCase(),

                            torneo,
                        ],
                    ),
                ),

            [
                configuracion,
            ],
        );

    // ========================================================
    // TORNEOS CON SLIDE
    // ========================================================

    const torneosConAcceso =
        useMemo(
            () => {
                if (
                    !configuracion ||
                    !documento
                ) {
                    return [];
                }

                const ids =
                    new Set<string>();

                const desarrollador =
                    rolGeneral ===
                    "desarrollador";

                /*
                 * TODOS:
                 *
                 * cada torneo actual tiene una slide.
                 *
                 * Una exclusión legacy acceso:false tiene
                 * prioridad y evita crear la slide.
                 */
                if (
                    desarrollador ||
                    documento
                        .acceso_torneos
                        .todos
                ) {
                    for (
                        const torneo
                        of configuracion
                            .torneos
                    ) {
                        const id =
                            torneo.id
                                .toLowerCase();

                        const excepcion =
                            documento
                                .torneos[
                                id
                            ];

                        if (
                            excepcion &&
                            !excepcion.acceso
                        ) {
                            continue;
                        }

                        ids.add(
                            id,
                        );
                    }
                }

                /*
                 * ASIGNACIONES INDIVIDUALES:
                 *
                 * también conserva torneos antiguos que
                 * ya no aparezcan en la configuración.
                 */
                for (
                    const [
                        idOriginal,
                        asignacion,
                    ]
                    of Object.entries(
                        documento
                            .torneos,
                    )
                ) {
                    if (
                        !asignacion.acceso
                    ) {
                        continue;
                    }

                    ids.add(
                        idOriginal
                            .toLowerCase(),
                    );
                }

                return [
                    ...ids,
                ].sort(
                    (
                        a,
                        b,
                    ) =>
                        nombreTorneo(
                            torneosPorID.get(
                                a,
                            ),
                            a,
                        ).localeCompare(
                            nombreTorneo(
                                torneosPorID.get(
                                    b,
                                ),
                                b,
                            ),
                            "ca",
                        ),
                );
            },

            [
                configuracion,
                documento,
                rolGeneral,
                torneosPorID,
            ],
        );

    // ========================================================
    // PASOS
    // ========================================================

    const pasos =
        useMemo<Paso[]>(
            () => {
                if (
                    !configuracion ||
                    !documento
                ) {
                    return [];
                }

                const resultado:
                    Paso[] = [
                        {
                            id:
                                "usuario",

                            tipo:
                                "usuario",

                            titulo:
                                "Usuari",
                        },

                        {
                            id:
                                "accesos",

                            tipo:
                                "accesos",

                            titulo:
                                "Rol i tornejos",
                        },
                    ];

                /*
                 * Slide 3 únicamente si el rol puede
                 * utilizar permisos generales.
                 */
                if (
                    tieneConfiguracionGeneral(
                        rolGeneral,
                    )
                ) {
                    resultado.push({
                        id:
                            "general",

                        tipo:
                            "general",

                        titulo:
                            "Permisos generals",
                    });
                }

                /*
                 * Una única slide por torneo.
                 */
                for (
                    const torneoID
                    of torneosConAcceso
                ) {
                    resultado.push({
                        id:
                            `torneo:${torneoID}`,

                        tipo:
                            "torneo",

                        torneoID,

                        titulo:
                            nombreTorneo(
                                torneosPorID.get(
                                    torneoID,
                                ),

                                torneoID,
                            ),
                    });
                }

                resultado.push({
                    id:
                        "resumen",

                    tipo:
                        "resumen",

                    titulo:
                        "Resum",
                });

                return resultado;
            },

            [
                configuracion,
                documento,
                rolGeneral,
                torneosConAcceso,
                torneosPorID,
            ],
        );

    // ========================================================
    // PASO ACTUAL
    // ========================================================

    const indiceActual =
        Math.max(
            0,

            pasos.findIndex(
                (paso) =>
                    paso.id ===
                    pasoID,
            ),
        );

    const pasoActual =
        pasos[
            indiceActual
        ];

    /*
     * Si cambia el rol o la selección de torneos
     * y la slide actual desaparece, volvemos al
     * paso de Rol y torneos.
     */
    useEffect(() => {
        if (
            pasos.length === 0
        ) {
            return;
        }

        if (
            !pasos.some(
                (paso) =>
                    paso.id ===
                    pasoID,
            )
        ) {
            setPasoID(
                "accesos",
            );
        }
    }, [
        pasos,
        pasoID,
    ]);

    useEffect(() => {
        setError("");

        window.requestAnimationFrame(
            () =>
                tituloPasoRef
                    .current
                    ?.focus(),
        );
    }, [
        pasoID,
    ]);

    // ========================================================
    // CARGANDO
    // ========================================================

    if (cargando) {
        return (
            <div
                className="
                    flex min-h-80
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
                <div className="flex flex-col items-center gap-4 text-center">
                    <span
                        aria-hidden="true"
                        className="
                            h-9 w-9
                            animate-spin
                            rounded-full
                            border-2
                            border-border
                            border-t-primary
                        "
                    />

                    <div>
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Carregant permisos
                        </p>

                        <p className="mt-1 text-xs">
                            Recuperant la configuració de l&apos;usuari.
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
        errorCarga ||
        !detalle ||
        !configuracion ||
        !documento
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
                <div className="mx-auto max-w-lg text-center">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        No s&apos;ha pogut carregar l&apos;assistent
                    </h2>

                    <p className="mt-2 text-sm leading-6">
                        {errorCarga ||
                            "La informació necessària no està disponible."}
                    </p>

                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() =>
                                setIntento(
                                    (
                                        valor,
                                    ) =>
                                        valor +
                                        1,
                                )
                            }
                            className="
                                rounded-lg
                                bg-primary
                                px-4 py-2.5
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
                            onClick={
                                onCancelar
                            }
                            className="
                                rounded-lg
                                border
                                border-border
                                bg-card
                                px-4 py-2.5
                                text-sm
                                font-medium
                                text-neutral
                                hover:border-neutral/40
                            "
                        >
                            Tancar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ========================================================
    // VARIABLES DERIVADAS
    // ========================================================

    const config =
        configuracion;

    const datos =
        detalle;

    const doc =
        documento;

    const usuario =
        datos.usuario;

    const creando =
        modo ===
        "crear";

    const puedeEditar =
        modo !==
            "ver" &&
        (
            creando
                ? (
                      datos
                          .capacidades
                          .crear &&
                      config
                          .capacidades
                          .crear
                  )
                : (
                      datos
                          .capacidades
                          .editar &&
                      config
                          .capacidades
                          .editar
                  )
        );

    const soloLectura =
        !puedeEditar;

    const bloqueado =
        guardando;

    // ========================================================
    // CAMBIOS
    // ========================================================

    function aplicarDocumento(
        nuevo:
            DocumentoPermisos,
    ) {
        if (
            !puedeEditar ||
            guardando
        ) {
            return;
        }

        setDocumento(
            nuevo,
        );

        setModificado(
            true,
        );

        setError("");
    }

    function cambiarRolGeneral(
        nuevoRol: Rol,
    ) {
        if (
            !puedeEditar ||
            guardando
        ) {
            return;
        }

        /*
         * Solo roles ofrecidos por el servidor.
         *
         * Un rol actual no disponible puede visualizarse
         * en modo consulta, pero no seleccionarse.
         */
        if (
            !config.roles.some(
                (opcion) =>
                    opcion.valor ===
                    nuevoRol,
            )
        ) {
            return;
        }

        setRolGeneral(
            nuevoRol,
        );

        aplicarDocumento({
            ...doc,

            globales:
                completarPermisosAmbito(
                    "general",

                    nuevoRol,

                    doc.globales,
                ),
        });
    }

    // ========================================================
    // CONFIGURACIÓN EFECTIVA DE UN TORNEO
    // ========================================================

    function obtenerConfiguracionTorneo(
        torneoID: string,
    ): {
        rol:
            Rol | null;

        permisos:
            PermisosAmbito;

        heredado:
            boolean;
    } | null {
        const id =
            torneoID
                .toLowerCase();

        /*
         * Desenvolupador:
         * todo siempre.
         */
        if (
            rolGeneral ===
            "desarrollador"
        ) {
            return {
                rol:
                    "desarrollador",

                permisos:
                    completarPermisosAmbito(
                        "torneo",
                        "desarrollador",
                    ),

                heredado:
                    true,
            };
        }

        /*
         * La configuración individual tiene prioridad.
         */
        const individual =
            doc.torneos[
                id
            ];

        if (individual) {
            if (
                !individual.acceso
            ) {
                return null;
            }

            return {
                rol:
                    individual.rol,

                permisos:
                    individual.permisos,

                heredado:
                    false,
            };
        }

        /*
         * Si no hay configuración individual,
         * se utiliza la común.
         */
        if (
            doc
                .acceso_torneos
                .todos
        ) {
            return {
                rol:
                    doc
                        .acceso_torneos
                        .rol,

                permisos:
                    doc
                        .acceso_torneos
                        .permisos,

                heredado:
                    true,
            };
        }

        return null;
    }

    function cambiarPermisosTorneo(
        torneoID: string,
        permisos:
            PermisosAmbito,
    ) {
        if (
            !puedeEditar ||
            guardando
        ) {
            return;
        }

        const id =
            torneoID
                .toLowerCase();

        const existente =
            doc.torneos[
                id
            ];

        /*
         * Asignación individual.
         */
        if (
            existente
                ?.acceso
        ) {
            aplicarDocumento({
                ...doc,

                torneos: {
                    ...doc.torneos,

                    [id]: {
                        ...existente,

                        permisos,
                    },
                },
            });

            return;
        }

        /*
         * Acceso común:
         *
         * al personalizar una slide concreta
         * materializamos una excepción individual
         * con el mismo rol común.
         */
        if (
            doc
                .acceso_torneos
                .todos &&
            doc
                .acceso_torneos
                .rol
        ) {
            aplicarDocumento({
                ...doc,

                torneos: {
                    ...doc.torneos,

                    [id]: {
                        acceso:
                            true,

                        rol:
                            doc
                                .acceso_torneos
                                .rol,

                        permisos,
                    },
                },
            });
        }
    }

    // ========================================================
    // VALIDACIÓN
    // ========================================================

    function validarAccesos():
        string | null {
        if (!rolGeneral) {
            return "Selecciona el rol general de l'usuari.";
        }

        /*
         * Desenvolupador es absoluto.
         *
         * Normalmente no aparecerá como rol asignable,
         * pero soportamos cuentas existentes.
         */
        if (
            rolGeneral ===
            "desarrollador"
        ) {
            return null;
        }

        if (
            doc
                .acceso_torneos
                .todos &&
            !doc
                .acceso_torneos
                .rol
        ) {
            return "Selecciona el rol comú dels tornejos.";
        }

        for (
            const [
                id,
                asignacion,
            ]
            of Object.entries(
                doc.torneos,
            )
        ) {
            if (
                asignacion.acceso &&
                !asignacion.rol
            ) {
                return `Selecciona un rol per al torneig «${nombreTorneo(
                    torneosPorID.get(
                        id,
                    ),
                    id,
                )}».`;
            }
        }

        return null;
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

        const indiceAccesos =
            pasos.findIndex(
                (paso) =>
                    paso.id ===
                    "accesos",
            );

        /*
         * Para entrar en cualquier paso posterior
         * a Rol y torneos hay que tener completa
         * esa configuración.
         */
        if (
            nuevoIndice >
                indiceAccesos &&
            indiceActual <=
                indiceAccesos
        ) {
            const problema =
                validarAccesos();

            if (problema) {
                setError(
                    problema,
                );

                return;
            }
        }

        setError("");

        setPasoID(
            pasos[
                nuevoIndice
            ].id,
        );
    }

    function anterior() {
        irPaso(
            indiceActual -
                1,
        );
    }

    function siguiente() {
        irPaso(
            indiceActual +
                1,
        );
    }

    function solicitarSalida() {
        if (guardando) {
            return;
        }

        if (
            modificado &&
            puedeEditar
        ) {
            setConfirmarSalida(
                true,
            );

            return;
        }

        onCancelar();
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

        const problema =
            validarAccesos();

        if (problema) {
            setError(
                problema,
            );

            /*
             * El error pertenece al paso 2.
             */
            setPasoID(
                "accesos",
            );

            return;
        }

        if (
            advertencias
                .length >
                0 &&
            !revisionAceptada
        ) {
            setError(
                "Confirma que has revisat l'adaptació dels permisos anteriors.",
            );

            return;
        }

        bloqueoGuardado
            .current = true;

        setGuardando(
            true,
        );

        setError("");

        try {
            const preparado =
                prepararDocumentoPermisos(
                    doc,
                    rolGeneral,
                );

            if (
                !preparado.rol
            ) {
                throw new Error(
                    "Selecciona el rol general de l'usuari.",
                );
            }

            const respuesta =
                await fetch(
                    API,
                    {
                        method:
                            "POST",

                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify(
                                {
                                    accion:
                                        creando
                                            ? "crear"
                                            : "editar",

                                    id:
                                        usuario.id,

                                    fecha_actualizacion:
                                        usuario
                                            .fecha_actualizacion,

                                    /*
                                     * NUEVO:
                                     * rol general explícito.
                                     */
                                    rol:
                                        preparado.rol,

                                    permisos:
                                        preparado.permisos,
                                },
                            ),
                    },
                );

            const resultado =
                await respuesta
                    .json()
                    .catch(
                        () =>
                            null,
                    );

            if (
                !respuesta.ok ||
                resultado?.success !==
                    true
            ) {
                throw new Error(
                    resultado?.mensaje ||
                        "No s'han pogut desar els permisos.",
                );
            }

            setModificado(
                false,
            );

            onGuardado(
                creando
                    ? "S'ha concedit l'accés al panell."
                    : "S'han actualitzat els permisos.",
            );
        } catch (err) {
            setError(
                err instanceof
                Error
                    ? err.message
                    : "No s'han pogut desar els permisos.",
            );
        } finally {
            bloqueoGuardado
                .current =
                false;

            setGuardando(
                false,
            );
        }
    }

    // ========================================================
    // RENDER DEL PASO
    // ========================================================

    function renderPaso() {
        if (!pasoActual) {
            return null;
        }

        switch (
            pasoActual.tipo
        ) {
            // ------------------------------------------------
            // 1. USUARIO
            // ------------------------------------------------

            case "usuario":
                return (
                    <PasoUsuario
                        usuario={
                            usuario
                        }
                        modo={
                            modo
                        }
                        bloqueado={
                            bloqueado
                        }
                    />
                );

            // ------------------------------------------------
            // 2. ROL + TORNEOS
            // ------------------------------------------------

            case "accesos":
                return (
                    <PasoTornejos
                        rolGeneral={
                            rolGeneral
                        }
                        valor={{
                            acceso_torneos:
                                doc
                                    .acceso_torneos,

                            torneos:
                                doc.torneos,
                        }}
                        torneos={
                            config.torneos
                        }
                        roles={
                            config.roles
                        }
                        puedeConcederTodos={
                            config
                                .capacidades
                                .concederTodos
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiarRolGeneral={
                            cambiarRolGeneral
                        }
                        onCambiar={(
                            valor,
                        ) =>
                            aplicarDocumento(
                                {
                                    ...doc,

                                    acceso_torneos:
                                        valor
                                            .acceso_torneos,

                                    torneos:
                                        valor
                                            .torneos,
                                },
                            )
                        }
                    />
                );

            // ------------------------------------------------
            // 3. PERMISOS GENERALES
            // ------------------------------------------------

            case "general":
                return (
                    <PasoGeneral
                        rolGeneral={
                            rolGeneral
                        }
                        valor={
                            doc.globales
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={(
                            globales: PermisosAmbito,
                        ) =>
                            aplicarDocumento({
                                ...doc,
                                globales,
                            })
                        }
                    />
                );

            // ------------------------------------------------
            // 4...N. UN PASO POR TORNEO
            // ------------------------------------------------

            case "torneo": {
                const torneo =
                    torneosPorID.get(
                        pasoActual
                            .torneoID,
                    );

                const efectiva =
                    obtenerConfiguracionTorneo(
                        pasoActual
                            .torneoID,
                    );

                if (!efectiva) {
                    return (
                        <div
                            role="alert"
                            className="
                                rounded-xl
                                border
                                border-error/30
                                bg-error-container/40
                                p-5
                                text-error-foreground
                            "
                        >
                            <p className="text-sm font-semibold">
                                El torneig ja no està disponible
                            </p>

                            <p className="mt-1 text-sm leading-6">
                                Torna al pas de rols i tornejos
                                per revisar l&apos;assignació.
                            </p>
                        </div>
                    );
                }

                return (
                    <PasoTorneo
                        contexto={{
                            tipo:
                                "individual",

                            torneoID:
                                pasoActual
                                    .torneoID,

                            nombre:
                                torneo
                                    ?.nombre ??
                                null,

                            deporte:
                                torneo
                                    ?.deporte ??
                                null,
                        }}
                        rol={
                            efectiva.rol
                        }
                        valor={
                            efectiva.permisos
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={(
                            permisos: PermisosAmbito,
                        ) =>
                            cambiarPermisosTorneo(
                                pasoActual.torneoID,
                                permisos,
                            )
                        }
                    />
                );
            }

            // ------------------------------------------------
            // ÚLTIMO. RESUMEN
            // ------------------------------------------------

            case "resumen":
                return (
                    <PasoResumen
                        usuario={
                            usuario
                        }
                        rolGeneral={
                            rolGeneral
                        }
                        documento={
                            doc
                        }
                        torneos={
                            config.torneos
                        }
                        advertencias={
                            advertencias
                        }
                        revisionAceptada={
                            revisionAceptada
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiarRevision={
                            setRevisionAceptada
                        }
                    />
                );
        }
    }

    // ========================================================
    // RENDER PRINCIPAL
    // ========================================================

    const ultimoPaso =
        indiceActual ===
        pasos.length - 1;

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
                {/* =================================================
                    CABECERA
                ================================================= */}

                <header
                    className="
                        border-b
                        border-border
                        px-5 py-5
                        sm:px-7
                    "
                >
                    <div
                        className="
                            flex flex-col
                            gap-4
                            lg:flex-row
                            lg:items-center
                            lg:justify-between
                        "
                    >
                        <div>
                            <p className="text-xs font-medium tracking-wide">
                                GESTIÓ DE PERMISOS
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
                                {creando
                                    ? "Concedir accés al panell"
                                    : modo ===
                                        "ver"
                                      ? "Consultar permisos"
                                      : "Editar permisos"}
                            </h2>

                            <p className="mt-1 text-sm leading-6">
                                {usuario.email ||
                                    "Usuari seleccionat"}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {rolGeneral && (
                                <span
                                    className="
                                        rounded-full
                                        border
                                        border-border
                                        bg-card
                                        px-3 py-1.5
                                        text-xs
                                    "
                                >
                                    Rol:{" "}
                                    {
                                        config
                                            .roles
                                            .find(
                                                (
                                                    item,
                                                ) =>
                                                    item.valor ===
                                                    rolGeneral,
                                            )
                                            ?.nombre ??
                                        rolGeneral
                                    }
                                </span>
                            )}

                            {modificado &&
                                puedeEditar && (
                                    <span
                                        className="
                                            rounded-full
                                            border
                                            border-border
                                            bg-card
                                            px-3 py-1.5
                                            text-xs
                                        "
                                    >
                                        Canvis sense desar
                                    </span>
                                )}

                            {soloLectura && (
                                <span
                                    className="
                                        rounded-full
                                        border
                                        border-border
                                        bg-card
                                        px-3 py-1.5
                                        text-xs
                                    "
                                >
                                    Només lectura
                                </span>
                            )}
                        </div>
                    </div>
                </header>

                {/* =================================================
                    PASOS
                ================================================= */}

                <nav
                    aria-label="Passos de l'assistent"
                    className="
                        border-b
                        border-border
                        bg-card/35
                        px-4 py-4
                        sm:px-6
                    "
                >
                    <div
                        className="
                            scroll-personalizada
                            flex gap-2
                            overflow-x-auto
                            pb-1
                        "
                    >
                        {pasos.map(
                            (
                                paso,
                                indice,
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
                                                indice,
                                            )
                                        }
                                        className={`
                                            group
                                            flex min-w-max
                                            items-center
                                            gap-2.5
                                            rounded-xl
                                            border
                                            px-3 py-2.5
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
                                                flex h-7 w-7
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
                                            {anterior ? (
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.8"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-3.5 w-3.5"
                                                >
                                                    <path d="m5 12 4 4L19 6" />
                                                </svg>
                                            ) : (
                                                indice +
                                                1
                                            )}
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
                                                {indice +
                                                    1}
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
                            },
                        )}
                    </div>
                </nav>

                {/* =================================================
                    CONTENIDO
                ================================================= */}

                <main
                    className="
                        mx-auto
                        w-full
                        max-w-6xl
                        px-5 py-7
                        sm:px-7
                        sm:py-8
                    "
                >
                    {error && (
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

                            <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                    Revisa aquest pas
                                </p>

                                <p className="mt-1 text-sm leading-6">
                                    {
                                        error
                                    }
                                </p>
                            </div>
                        </div>
                    )}

                    {renderPaso()}
                </main>

                {/* =================================================
                    FOOTER
                ================================================= */}

                <footer
                    className="
                        border-t
                        border-border
                        bg-card/25
                        px-5 py-4
                        sm:px-7
                    "
                >
                    <div
                        className="
                            flex flex-col
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
                                px-4 py-2.5
                                text-sm
                                font-medium
                                text-neutral
                                hover:border-neutral/40
                                disabled:cursor-wait
                                disabled:opacity-50
                            "
                        >
                            {modo ===
                            "ver"
                                ? "Tancar"
                                : "Cancel·lar"}
                        </button>

                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            {indiceActual >
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
                                        px-4 py-2.5
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
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    >
                                        <path d="m15 18-6-6 6-6" />
                                    </svg>

                                    Anterior
                                </button>
                            )}

                            {!ultimoPaso ? (
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
                                        px-5 py-2.5
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
                                        className="h-4 w-4"
                                        aria-hidden="true"
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
                                        px-5 py-2.5
                                        text-sm
                                        font-semibold
                                        text-white
                                        hover:bg-primary/90
                                        disabled:cursor-wait
                                        disabled:opacity-50
                                    "
                                >
                                    {guardando && (
                                        <span
                                            aria-hidden="true"
                                            className="
                                                h-4 w-4
                                                animate-spin
                                                rounded-full
                                                border-2
                                                border-white/35
                                                border-t-white
                                            "
                                        />
                                    )}

                                    {guardando
                                        ? "Desant..."
                                        : creando
                                          ? "Concedir accés"
                                          : "Desar canvis"}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={
                                        onCancelar
                                    }
                                    className="
                                        rounded-lg
                                        bg-primary
                                        px-5 py-2.5
                                        text-sm
                                        font-semibold
                                        text-white
                                        hover:bg-primary/90
                                    "
                                >
                                    Tancar
                                </button>
                            )}
                        </div>
                    </div>
                </footer>
            </div>

            {/* =================================================
                CONFIRMACIÓN DE SALIDA
            ================================================= */}

            {confirmarSalida && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirmar-sortida-titol"
                    className="
                        fixed inset-0
                        z-100
                        flex
                        items-center
                        justify-center
                        bg-black/35
                        p-4
                        backdrop-blur-sm
                    "
                    onMouseDown={(
                        evento,
                    ) => {
                        if (
                            evento.target ===
                                evento.currentTarget &&
                            !guardando
                        ) {
                            setConfirmarSalida(
                                false,
                            );
                        }
                    }}
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
                            text-neutral
                            shadow-2xl
                        "
                    >
                        <div className="flex items-start gap-4">
                            <div
                                aria-hidden="true"
                                className="
                                    flex h-10 w-10
                                    shrink-0
                                    items-center
                                    justify-center
                                    rounded-xl
                                    bg-error-container
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
                                    className="h-5 w-5"
                                >
                                    <path d="M12 9v4" />
                                    <path d="M12 17h.01" />
                                    <path d="m10.3 4.3-7.9 13.7A2 2 0 0 0 4.1 21h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
                                </svg>
                            </div>

                            <div>
                                <h2
                                    id="confirmar-sortida-titol"
                                    className="
                                        text-lg
                                        font-semibold
                                        text-neutral-titulos
                                    "
                                >
                                    Sortir sense desar?
                                </h2>

                                <p className="mt-2 text-sm leading-6">
                                    Hi ha canvis en la configuració
                                    que encara no s&apos;han desat.
                                </p>
                            </div>
                        </div>

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
                                        false,
                                    )
                                }
                                className="
                                    rounded-lg
                                    border
                                    border-border
                                    bg-background
                                    px-4 py-2.5
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
                                onClick={
                                    onCancelar
                                }
                                className="
                                    rounded-lg
                                    bg-error
                                    px-4 py-2.5
                                    text-sm
                                    font-semibold
                                    text-background
                                "
                            >
                                Sortir sense desar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}