import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    calcularRolMinimo,
    completarPermisosAmbito,
    crearDocumentoPermisos,
    normalizarRol,
    prepararDocumentoPermisos,
    type DocumentoPermisos,
    type PermisosAmbito,
    type Rol,
    type SeccionPermisos,
} from "@const/Permisos";

import PasoUsuario from "./pasos/PasoUsuario";
import PasoTornejos from "./pasos/PasoTornejos";
import PasoGeneral from "./pasos/PasoGeneral";
import PasoTorneo from "./pasos/PasoTorneo";
import PasoResumen from "./pasos/PasoResumen";

const API = "/api/panell/permisos";

type Props = {
    usuarioID: string;
    modo: "crear" | "editar" | "ver";
    onCancelar: () => void;
    onGuardado: (mensaje: string) => void;
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
    fecha_actualizacion: string | null;
};

type Torneo = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    rolAdministrador: Rol | null;
};

type Configuracion = {
    seccionesGenerales: SeccionPermisos[];
    seccionesTorneo: SeccionPermisos[];

    nombresAcciones: Record<string, string>;

    nivelesPermisos: Record<
        string,
        {
            nivel: number;
            acciones?: Record<string, number>;
        }
    >;

    roles: {
        valor: Rol;
        nombre: string;
        nivel: number;
    }[];

    torneos: Torneo[];

    capacidades: {
        crear: boolean;
        editar: boolean;
        eliminar: boolean;
        concederTodos: boolean;
    };
};

type Detalle = {
    usuario: Usuario;

    capacidades: {
        crear: boolean;
        editar: boolean;
        eliminar: boolean;
    };
};

type PasoUsuario = {
    id: "usuario";
    tipo: "usuario";
    titulo: string;
};

type PasoAccesos = {
    id: "accesos";
    tipo: "accesos";
    titulo: string;
};

type PasoGeneral = {
    id: string;
    tipo: "general";
    titulo: string;
    seccion: SeccionPermisos;
};

type PasoComun = {
    id: string;
    tipo: "comun";
    titulo: string;
    seccion: SeccionPermisos;
};

type PasoIndividual = {
    id: string;
    tipo: "individual";
    titulo: string;
    seccion: SeccionPermisos;
    torneoID: string;
};

type PasoResumen = {
    id: "resumen";
    tipo: "resumen";
    titulo: string;
};

type Paso =
    | PasoUsuario
    | PasoAccesos
    | PasoGeneral
    | PasoComun
    | PasoIndividual
    | PasoResumen;

function esObjeto(
    valor: unknown,
): valor is Record<string, unknown> {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

async function obtener<T>(
    parametros: URLSearchParams,
    signal: AbortSignal,
): Promise<T> {
    const respuesta = await fetch(
        `${API}?${parametros.toString()}`,
        {
            credentials: "same-origin",
            cache: "no-store",
            signal,
        },
    );

    const datos = await respuesta
        .json()
        .catch(() => null);

    if (
        !respuesta.ok ||
        datos?.success !== true
    ) {
        throw new Error(
            datos?.mensaje ||
                "No s'ha pogut carregar la informació.",
        );
    }

    return datos as T;
}

/*
 * Convierte los permisos existentes al formato que utiliza
 * actualmente el asistente.
 *
 * También conserva las advertencias cuando encuentra datos
 * antiguos o incompatibles.
 */
function cargarDocumento(
    usuario: Usuario,
    configuracion: Configuracion,
    creando: boolean,
): {
    documento: DocumentoPermisos;
    advertencias: string[];
} {
    if (creando) {
        return {
            documento: crearDocumentoPermisos(),
            advertencias: [],
        };
    }

    const advertencias: string[] = [];

    const original = esObjeto(usuario.permisos)
        ? usuario.permisos
        : null;

    const rolAnterior =
        normalizarRol(usuario.rol);

    const documento =
        crearDocumentoPermisos();

    if (!original) {
        advertencias.push(
            "Els permisos anteriors no tenen una estructura completa. Revisa tots els passos.",
        );
    }

    if (
        original &&
        original.version !== 1
    ) {
        advertencias.push(
            "La configuració anterior s'adaptarà a la versió actual.",
        );
    }

    function prepararAmbito(
        ambito: "general" | "torneo",
        rol: Rol | null,
        valor: unknown,
        etiqueta: string,
    ): PermisosAmbito {
        const secciones =
            ambito === "general"
                ? configuracion.seccionesGenerales
                : configuracion.seccionesTorneo;

        const entrada =
            esObjeto(valor)
                ? valor
                : null;

        const permisosValidados:
            PermisosAmbito = {};

        if (entrada) {
            for (const seccion of secciones) {
                const valorSeccion = entrada[seccion.id];

                const acciones: Record<string, unknown> | null =
                    esObjeto(valorSeccion)
                        ? valorSeccion
                        : null;

                if (!acciones) {
                    continue;
                }

                permisosValidados[
                    seccion.id
                ] = {};

                for (
                    const accion
                    of seccion.acciones
                ) {
                    const valorAccion =
                        acciones[accion];

                    if (
                        typeof valorAccion ===
                        "boolean"
                    ) {
                        permisosValidados[
                            seccion.id
                        ][accion] =
                            valorAccion;
                    }
                }
            }
        }

        const completos =
            completarPermisosAmbito(
                ambito,
                rol,
                entrada
                    ? permisosValidados
                    : undefined,
            );

        const salida:
            PermisosAmbito = {};

        if (
            valor !== undefined &&
            !entrada
        ) {
            advertencias.push(
                `${etiqueta}: l'estructura anterior no és vàlida.`,
            );

            for (
                const seccion
                of secciones
            ) {
                salida[seccion.id] =
                    Object.fromEntries(
                        seccion.acciones.map(
                            (accion) => [
                                accion,
                                false,
                            ],
                        ),
                    );
            }

            return salida;
        }

        if (entrada) {
            for (
                const [
                    id,
                    acciones,
                ] of Object.entries(
                    entrada,
                )
            ) {
                const seccion =
                    secciones.find(
                        (item) =>
                            item.id === id,
                    );

                if (!seccion) {
                    advertencias.push(
                        `${etiqueta}: la secció antiga «${id}» no forma part del catàleg actual i no es conservarà.`,
                    );

                    continue;
                }

                const registro =
                    esObjeto(acciones)
                        ? acciones
                        : null;

                if (!registro) {
                    advertencias.push(
                        `${etiqueta}: cal revisar la secció «${seccion.nombre}».`,
                    );

                    continue;
                }

                for (
                    const [
                        accion,
                        valorAccion,
                    ] of Object.entries(
                        registro,
                    )
                ) {
                    if (
                        !seccion.acciones.includes(
                            accion,
                        )
                    ) {
                        advertencias.push(
                            `${etiqueta}: l'acció antiga «${id}.${accion}» no es conservarà.`,
                        );
                    } else if (
                        typeof valorAccion !==
                        "boolean"
                    ) {
                        advertencias.push(
                            `${etiqueta}: «${id}.${accion}» no tenia un valor vàlid.`,
                        );
                    }
                }
            }
        }

        for (
            const seccion
            of secciones
        ) {
            salida[seccion.id] = {};

            const entradaSeccion =
                entrada?.[seccion.id];

            const accionesEntrada =
                esObjeto(
                    entradaSeccion,
                )
                    ? entradaSeccion
                    : null;

            for (
                const accion
                of seccion.acciones
            ) {
                const malformada =
                    entradaSeccion !==
                        undefined &&
                    (
                        !accionesEntrada ||
                        (
                            accionesEntrada[
                                accion
                            ] !==
                                undefined &&
                            typeof accionesEntrada[
                                accion
                            ] !==
                                "boolean"
                        )
                    );

                salida[seccion.id][
                    accion
                ] = malformada
                    ? false
                    : completos[
                          seccion.id
                      ]?.[accion] === true;
            }
        }

        return salida;
    }

    const estructurado =
        original &&
        [
            "version",
            "globales",
            "torneos",
            "acceso_torneos",
        ].some((clave) =>
            Object.hasOwn(
                original,
                clave,
            ),
        );

    documento.globales =
        prepararAmbito(
            "general",
            rolAnterior,
            estructurado
                ? original?.globales
                : original ??
                      undefined,
            "Permisos generals",
        );

    const comun =
        esObjeto(
            original?.acceso_torneos,
        )
            ? original?.acceso_torneos
            : null;

    const todos =
        comun?.todos === true;

    const rolComun =
        normalizarRol(
            comun?.rol,
        );

    if (
        todos &&
        !rolComun
    ) {
        advertencias.push(
            "L'accés comú no tenia un rol vàlid. Selecciona'l abans de desar.",
        );
    }

    documento.acceso_torneos = {
        todos,
        rol: todos
            ? rolComun
            : null,

        permisos:
            prepararAmbito(
                "torneo",
                todos
                    ? rolComun
                    : null,
                comun?.permisos,
                "Tots els tornejos",
            ),
    };

    const torneosAnteriores =
        esObjeto(
            original?.torneos,
        )
            ? original?.torneos
            : null;

    if (
        original?.torneos !==
            undefined &&
        !torneosAnteriores
    ) {
        advertencias.push(
            "Les assignacions anteriors dels tornejos no són vàlides. Cal tornar-les a configurar.",
        );
    }

    const UUID =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (
        const [
            clave,
            valor,
        ] of Object.entries(
            torneosAnteriores ?? {},
        )
    ) {
        if (
            !UUID.test(clave)
        ) {
            advertencias.push(
                `L'assignació «${clave}» no té un identificador vàlid i no es conservarà.`,
            );

            continue;
        }

        const id =
            clave.toLowerCase();

        if (
            Object.hasOwn(
                documento.torneos,
                id,
            )
        ) {
            throw new Error(
                "Hi ha assignacions duplicades d'un mateix torneig. Cal corregir-les abans de continuar.",
            );
        }

        const asignacion =
            esObjeto(valor)
                ? valor
                : null;

        const acceso =
            asignacion?.acceso === true;

        const rolAsignado =
            asignacion?.rol ===
            undefined
                ? rolAnterior
                : normalizarRol(
                      asignacion.rol,
                  );

        if (
            !asignacion ||
            typeof asignacion.acceso !==
                "boolean"
        ) {
            advertencias.push(
                `L'assignació del torneig ${id} no era vàlida i es mostrarà sense accés.`,
            );
        }

        if (
            acceso &&
            !rolAsignado
        ) {
            advertencias.push(
                `El torneig ${id} necessita un rol vàlid.`,
            );
        }

        documento.torneos[
            id
        ] = {
            acceso,

            rol: acceso
                ? rolAsignado
                : null,

            permisos:
                prepararAmbito(
                    "torneo",
                    acceso
                        ? rolAsignado
                        : null,
                    asignacion?.permisos,
                    `Torneig ${id}`,
                ),
        };
    }

    if (
        typeof original?.ultima_actualizacion ===
        "string"
    ) {
        documento.ultima_actualizacion =
            original.ultima_actualizacion;
    }

    return {
        documento,
        advertencias: [
            ...new Set(
                advertencias,
            ),
        ],
    };
}

function obtenerRolGeneral(
    documento: DocumentoPermisos,
): Rol | null {
    try {
        return calcularRolMinimo(
            documento,
        );
    } catch {
        return null;
    }
}

function nombreTorneo(
    torneo: Torneo | undefined,
    id: string,
) {
    return (
        torneo?.nombre?.trim() ||
        `Torneig ${id}`
    );
}

export default function Asistente({
    usuarioID,
    modo,
    onCancelar,
    onGuardado,
}: Props) {
    const [
        detalle,
        setDetalle,
    ] = useState<Detalle | null>(
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

    const [
        advertencias,
        setAdvertencias,
    ] = useState<string[]>([]);

    const [
        revisionAceptada,
        setRevisionAceptada,
    ] = useState(false);

    const [
        cargando,
        setCargando,
    ] = useState(true);

    const [
        guardando,
        setGuardando,
    ] = useState(false);

    const [
        errorCarga,
        setErrorCarga,
    ] = useState("");

    const [
        error,
        setError,
    ] = useState("");

    const [
        intento,
        setIntento,
    ] = useState(0);

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
    ] = useState(false);

    const [
        confirmarSalida,
        setConfirmarSalida,
    ] = useState(false);

    const bloqueoGuardado =
        useRef(false);

    const tituloPasoRef =
        useRef<HTMLHeadingElement>(
            null,
        );

    useEffect(() => {
        const controlador =
            new AbortController();

        setCargando(true);
        setErrorCarga("");
        setError("");
        setDetalle(null);
        setConfiguracion(null);
        setDocumento(null);

        async function cargar() {
            try {
                const [
                    nuevaConfiguracion,
                    nuevoDetalle,
                ] =
                    await Promise.all([
                        obtener<Configuracion>(
                            new URLSearchParams(
                                {
                                    vista: "configuracion",
                                },
                            ),
                            controlador.signal,
                        ),

                        obtener<Detalle>(
                            new URLSearchParams(
                                {
                                    vista: "detalle",
                                    id: usuarioID,
                                },
                            ),
                            controlador.signal,
                        ),
                    ]);

                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                const resultado =
                    cargarDocumento(
                        nuevoDetalle.usuario,
                        nuevaConfiguracion,
                        modo === "crear",
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

                setAdvertencias(
                    resultado.advertencias,
                );

                setRevisionAceptada(
                    false,
                );

                setModificado(false);
                setPasoID("usuario");
            } catch (err) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setErrorCarga(
                    err instanceof Error
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

    const pasos =
        useMemo<Paso[]>(() => {
            if (
                !configuracion ||
                !documento
            ) {
                return [];
            }

            const resultado:
                Paso[] = [
                {
                    id: "usuario",
                    tipo: "usuario",
                    titulo: "Usuari",
                },
                {
                    id: "accesos",
                    tipo: "accesos",
                    titulo:
                        "Tornejos i rols",
                },
            ];

            for (
                const seccion
                of configuracion.seccionesGenerales
            ) {
                resultado.push({
                    id: `general:${seccion.id}`,
                    tipo: "general",
                    titulo:
                        seccion.nombre,
                    seccion,
                });
            }

            if (
                documento
                    .acceso_torneos
                    .todos
            ) {
                for (
                    const seccion
                    of configuracion.seccionesTorneo
                ) {
                    resultado.push({
                        id: `comun:${seccion.id}`,
                        tipo: "comun",
                        titulo:
                            seccion.nombre,
                        seccion,
                    });
                }
            }

            const torneosPorID =
                new Map(
                    configuracion.torneos.map(
                        (torneo) => [
                            torneo.id.toLowerCase(),
                            torneo,
                        ],
                    ),
                );

            const asignaciones =
                Object.entries(
                    documento.torneos,
                )
                    .filter(
                        (
                            [, asignacion],
                        ) =>
                            asignacion.acceso,
                    )
                    .sort(
                        (
                            [idA],
                            [idB],
                        ) => {
                            const nombreA =
                                nombreTorneo(
                                    torneosPorID.get(
                                        idA,
                                    ),
                                    idA,
                                );

                            const nombreB =
                                nombreTorneo(
                                    torneosPorID.get(
                                        idB,
                                    ),
                                    idB,
                                );

                            return nombreA.localeCompare(
                                nombreB,
                                "ca",
                            );
                        },
                    );

            for (
                const [torneoID]
                of asignaciones
            ) {
                const torneo =
                    torneosPorID.get(
                        torneoID,
                    );

                for (
                    const seccion
                    of configuracion.seccionesTorneo
                ) {
                    resultado.push({
                        id: `torneo:${torneoID}:${seccion.id}`,
                        tipo: "individual",
                        titulo:
                            `${nombreTorneo(
                                torneo,
                                torneoID,
                            )} · ${seccion.nombre}`,
                        seccion,
                        torneoID,
                    });
                }
            }

            resultado.push({
                id: "resumen",
                tipo: "resumen",
                titulo: "Resum",
            });

            return resultado;
        }, [
            configuracion,
            documento,
        ]);

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
        pasos[indiceActual];

    /*
     * Si una modificación elimina el paso actual
     * (por ejemplo, quitamos acceso a un torneo),
     * volvemos al paso de accesos.
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
                    paso.id === pasoID,
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

        requestAnimationFrame(
            () => {
                tituloPasoRef.current?.focus();
            },
        );
    }, [pasoID]);

    if (cargando) {
        return (
            <div
                className="
                    flex min-h-80 items-center
                    justify-center rounded-2xl
                    border border-border
                    bg-background p-8 text-neutral
                "
            >
                <div className="flex flex-col items-center gap-4 text-center">
                    <span
                        aria-hidden="true"
                        className="
                            h-9 w-9 animate-spin
                            rounded-full border-2
                            border-border
                            border-t-primary
                        "
                    />

                    <div>
                        <p className="text-sm font-semibold">
                            Carregant permisos
                        </p>

                        <p className="mt-1 text-xs">
                            Recuperant la configuració
                            de l&apos;usuari.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (
        errorCarga ||
        !detalle ||
        !configuracion ||
        !documento
    ) {
        return (
            <div
                className="
                    rounded-2xl border
                    border-border
                    bg-background p-6
                    text-neutral
                "
            >
                <div className="mx-auto max-w-lg text-center">
                    <h2 className="text-lg font-semibold">
                        No s&apos;ha pogut carregar
                        l&apos;assistent
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
                                    (valor) =>
                                        valor +
                                        1,
                                )
                            }
                            className="
                                rounded-lg bg-primary
                                px-4 py-2.5
                                text-sm font-semibold
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
                                rounded-lg border
                                border-border
                                bg-card px-4
                                py-2.5 text-sm
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

    const config =
        configuracion;

    const datos =
        detalle;

    const doc =
        documento;

    const usuario =
        datos.usuario;

    const creando =
        modo === "crear";

    const puedeEditar =
        modo !== "ver" &&
        (
            creando
                ? datos.capacidades
                      .crear &&
                  config.capacidades
                      .crear
                : datos.capacidades
                      .editar &&
                  config.capacidades
                      .editar
        );

    const soloLectura =
        !puedeEditar;

    const bloqueado =
        guardando;

    const rolGeneral =
        obtenerRolGeneral(doc);

    const accesoPanelGeneral =
        doc.globales.panell
            ?.ver === true;

    const torneosPorID =
        new Map(
            config.torneos.map(
                (torneo) => [
                    torneo.id.toLowerCase(),
                    torneo,
                ],
            ),
        );

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

        setDocumento(nuevo);
        setModificado(true);
        setError("");
    }

    function validarAccesos():
        string | null {
        if (
            doc.acceso_torneos
                .todos &&
            !doc.acceso_torneos
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

    function irPaso(
        nuevoIndice: number,
    ) {
        if (
            nuevoIndice < 0 ||
            nuevoIndice >=
                pasos.length ||
            guardando
        ) {
            return;
        }

        /*
         * Antes de abandonar la pantalla de accesos
         * hacia delante, comprobamos que no falten roles.
         */
        if (
            pasoActual?.tipo ===
                "accesos" &&
            nuevoIndice >
                indiceActual
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
            indiceActual - 1,
        );
    }

    function siguiente() {
        irPaso(
            indiceActual + 1,
        );
    }

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
                true,
            );

            return;
        }

        onCancelar();
    }

    async function guardar() {
        if (
            !puedeEditar ||
            bloqueoGuardado.current
        ) {
            return;
        }

        const problema =
            validarAccesos();

        if (problema) {
            setError(problema);
            return;
        }

        if (
            advertencias.length >
                0 &&
            !revisionAceptada
        ) {
            setError(
                "Confirma que has revisat l'adaptació dels permisos anteriors.",
            );

            return;
        }

        if (
            doc.globales.panell
                ?.ver !== true
        ) {
            setError(
                "Activa l'accés general al panell. Per retirar tots els permisos, utilitza l'opció «Retirar» del llistat.",
            );

            return;
        }

        bloqueoGuardado.current =
            true;

        setGuardando(true);
        setError("");

        try {
            const preparado =
                prepararDocumentoPermisos(
                    doc,
                );

            const respuesta =
                await fetch(
                    API,
                    {
                        method: "POST",
                        credentials:
                            "same-origin",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body: JSON.stringify(
                            {
                                accion:
                                    creando
                                        ? "crear"
                                        : "editar",

                                id: usuario.id,

                                fecha_actualizacion:
                                    usuario.fecha_actualizacion,

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

            setModificado(false);

            onGuardado(
                creando
                    ? "S'ha concedit l'accés al panell."
                    : "S'han actualitzat els permisos.",
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "No s'han pogut desar els permisos.",
            );
        } finally {
            bloqueoGuardado.current =
                false;

            setGuardando(false);
        }
    }

    function renderPaso() {
        if (!pasoActual) {
            return null;
        }

        switch (
            pasoActual.tipo
        ) {
            case "usuario":
                return (
                    <PasoUsuario
                        usuario={
                            usuario
                        }
                        modo={modo}
                        bloqueado={
                            guardando
                        }
                    />
                );

            case "accesos":
                return (
                    <PasoTornejos
                        valor={{
                            acceso_torneos:
                                doc.acceso_torneos,
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
                        onCambiar={(
                            valor,
                        ) =>
                            aplicarDocumento(
                                {
                                    ...doc,
                                    acceso_torneos:
                                        valor.acceso_torneos,
                                    torneos:
                                        valor.torneos,
                                },
                            )
                        }
                    />
                );

            case "general": {
                const valor =
                    doc.globales[
                        pasoActual
                            .seccion.id
                    ] ?? {};

                return (
                    <PasoGeneral
                        seccion={
                            pasoActual.seccion
                        }
                        rolGeneral={
                            rolGeneral
                        }
                        valor={
                            valor
                        }
                        accesoPanel={
                            accesoPanelGeneral
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={(
                            acciones,
                        ) =>
                            aplicarDocumento(
                                {
                                    ...doc,

                                    globales:
                                        {
                                            ...doc.globales,

                                            [pasoActual
                                                .seccion
                                                .id]:
                                                acciones,
                                        },
                                },
                            )
                        }
                    />
                );
            }

            case "comun": {
                const valor =
                    doc.acceso_torneos
                        .permisos[
                        pasoActual
                            .seccion.id
                    ] ?? {};

                const accesoPanelTorneo =
                    doc
                        .acceso_torneos
                        .permisos
                        .panell
                        ?.ver === true;

                return (
                    <PasoTorneo
                        contexto={{
                            tipo: "comun",
                        }}
                        seccion={
                            pasoActual.seccion
                        }
                        rol={
                            doc
                                .acceso_torneos
                                .rol
                        }
                        valor={
                            valor
                        }
                        accesoPanelGeneral={
                            accesoPanelGeneral
                        }
                        accesoPanelTorneo={
                            accesoPanelTorneo
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={(
                            acciones,
                        ) =>
                            aplicarDocumento(
                                {
                                    ...doc,

                                    acceso_torneos:
                                        {
                                            ...doc.acceso_torneos,

                                            permisos:
                                                {
                                                    ...doc
                                                        .acceso_torneos
                                                        .permisos,

                                                    [pasoActual
                                                        .seccion
                                                        .id]:
                                                        acciones,
                                                },
                                        },
                                },
                            )
                        }
                    />
                );
            }

            case "individual": {
                const asignacion =
                    doc.torneos[
                        pasoActual
                            .torneoID
                    ];

                if (
                    !asignacion ||
                    !asignacion.acceso
                ) {
                    return null;
                }

                const torneo =
                    torneosPorID.get(
                        pasoActual.torneoID,
                    );

                const valor =
                    asignacion
                        .permisos[
                        pasoActual
                            .seccion.id
                    ] ?? {};

                const accesoPanelTorneo =
                    asignacion
                        .permisos
                        .panell
                        ?.ver === true;

                return (
                    <PasoTorneo
                        contexto={{
                            tipo: "individual",
                            torneoID:
                                pasoActual.torneoID,
                            nombre:
                                torneo?.nombre ??
                                null,
                            deporte:
                                torneo?.deporte ??
                                null,
                        }}
                        seccion={
                            pasoActual.seccion
                        }
                        rol={
                            asignacion.rol
                        }
                        valor={
                            valor
                        }
                        accesoPanelGeneral={
                            accesoPanelGeneral
                        }
                        accesoPanelTorneo={
                            accesoPanelTorneo
                        }
                        soloLectura={
                            soloLectura
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={(
                            acciones,
                        ) =>
                            aplicarDocumento(
                                {
                                    ...doc,

                                    torneos:
                                        {
                                            ...doc.torneos,

                                            [pasoActual
                                                .torneoID]:
                                                {
                                                    ...asignacion,

                                                    permisos:
                                                        {
                                                            ...asignacion.permisos,

                                                            [pasoActual
                                                                .seccion
                                                                .id]:
                                                                acciones,
                                                        },
                                                },
                                        },
                                },
                            )
                        }
                    />
                );
            }

            case "resumen":
                return (
                    <PasoResumen
                        usuario={
                            usuario
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

    return (
        <>
            <div
                className="
                    overflow-hidden rounded-2xl
                    border border-border
                    bg-background
                    text-neutral
                "
            >
                {/* Cabecera */}
                <header
                    className="
                        border-b border-border
                        px-5 py-5
                        sm:px-7
                    "
                >
                    <div
                        className="
                            flex flex-col gap-4
                            lg:flex-row
                            lg:items-center
                            lg:justify-between
                        "
                    >
                        <div>
                            <p
                                className="
                                    text-xs font-medium
                                    tracking-wide
                                "
                            >
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
                                    mt-1 text-xl
                                    font-semibold
                                    tracking-tight
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

                            <p
                                className="
                                    mt-1 text-sm
                                    leading-6
                                "
                            >
                                {usuario.email ||
                                    "Usuari seleccionat"}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
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

                {/* Navegación del asistente */}
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
                                            group flex min-w-max
                                            items-center gap-2.5
                                            rounded-xl border
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
                                                rounded-lg border
                                                text-xs font-semibold

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
                                                    mt-1 block
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

                {/* Contenido */}
                <main
                    className="
                        mx-auto w-full
                        max-w-5xl
                        px-5 py-7
                        sm:px-7
                        sm:py-8
                    "
                >
                    {error && (
                        <div
                            role="alert"
                            className="
                                mb-6 flex
                                items-start gap-3
                                rounded-xl border
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
                                strokeWidth="1.6"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    mt-0.5
                                    h-5 w-5
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

                            <div className="min-w-0">
                                <p className="text-sm font-semibold">
                                    Revisa aquest pas
                                </p>

                                <p className="mt-1 text-sm leading-6">
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}

                    {renderPaso()}
                </main>

                {/* Navegación inferior */}
                <footer
                    className="
                        border-t border-border
                        bg-card/30
                        px-5 py-4
                        sm:px-7
                    "
                >
                    <div
                        className="
                            mx-auto flex
                            w-full max-w-5xl
                            flex-col-reverse
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

                        <div
                            className="
                                flex
                                flex-col-reverse
                                gap-2
                                sm:flex-row
                                sm:items-center
                            "
                        >
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

                            {indiceActual <
                            pasos.length -
                                1 ? (
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
                                        guardando ||
                                        (
                                            advertencias.length >
                                                0 &&
                                            !revisionAceptada
                                        )
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
                                        disabled:cursor-not-allowed
                                        disabled:opacity-50
                                    "
                                >
                                    {guardando ? (
                                        <>
                                            <span
                                                aria-hidden="true"
                                                className="
                                                    h-4 w-4
                                                    animate-spin
                                                    rounded-full
                                                    border-2
                                                    border-white/40
                                                    border-t-white
                                                "
                                            />

                                            Desant...
                                        </>
                                    ) : creando ? (
                                        "Concedir accés"
                                    ) : (
                                        "Desar canvis"
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={
                                        onCancelar
                                    }
                                    className="
                                        inline-flex
                                        items-center
                                        justify-center
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

            {/* Confirmación de salida */}
            {confirmarSalida && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="confirmar-sortida-titol"
                    className="
                        fixed inset-0 z-100
                        flex items-center
                        justify-center
                        bg-black/35
                        p-4
                        backdrop-blur-sm
                    "
                >
                    <div
                        className="
                            w-full max-w-md
                            rounded-2xl
                            border border-border
                            bg-background
                            p-6
                            text-neutral
                            shadow-2xl
                        "
                    >
                        <h2
                            id="confirmar-sortida-titol"
                            className="text-lg font-semibold"
                        >
                            Descartar els canvis?
                        </h2>

                        <p className="mt-2 text-sm leading-6">
                            Hi ha canvis que encara no s&apos;han
                            desat. Si surts ara, es perdran.
                        </p>

                        <div
                            className="
                                mt-6 flex
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
                                    border border-border
                                    bg-card
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
                                    text-white
                                "
                            >
                                Descartar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}