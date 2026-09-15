import { useEffect, useRef, useState } from "react";
import {
    NOMBRES_ROL,
    ROLES_ORDENADOS,
    calcularRolMinimo,
    completarPermisosAmbito,
    crearDocumentoPermisos,
    normalizarRol,
    prepararDocumentoPermisos,
    type DocumentoPermisos,
    type PermisosAmbito,
    type Rol,
    type SeccionPermisos,
} from "../../../const/Permisos";

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
    rolAdministrador: Rol;
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

type Paso =
    | { id: string; tipo: "usuario"; titulo: string }
    | { id: string; tipo: "accesos"; titulo: string }
    | {
          id: string;
          tipo: "permisos";
          titulo: string;
          seccion: SeccionPermisos;
          ambito: "general" | "comun" | "individual";
          torneoID?: string;
      }
    | { id: string; tipo: "resumen"; titulo: string };

const niveles: Record<Rol, number> = {
    voluntario: 1,
    staff: 2,
    admintorneo: 3,
    admin: 4,
    desarrollador: 5,
};

const boton =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 " +
    "text-sm font-semibold transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-primary " +
    "focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const secundario =
    `${boton} border border-border bg-white text-secondary ` +
    "hover:bg-primary/5 in-[.oscuro_&]:bg-card";

const principal =
    `${boton} bg-primary text-white hover:bg-primary/90`;

const campo =
    "w-full rounded-lg border border-border bg-[#f0f5ff] px-3 py-2.5 " +
    "text-sm text-secondary outline-none focus:border-primary " +
    "focus:ring-2 focus:ring-primary/15 disabled:opacity-60 " +
    "in-[.oscuro_&]:bg-background";

function objeto(valor: unknown): Record<string, unknown> | null {
    return valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
        ? (valor as Record<string, unknown>)
        : null;
}

function nombreUsuario(usuario: Usuario) {
    return [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ].filter(Boolean).join(" ").trim() || "Usuari sense nom";
}

function nombreOrigen(valor: string | null) {
    if (valor?.toLowerCase() === "manual") return "Manual";
    if (valor?.toLowerCase() === "sistema") return "Sistema";
    return "Sense especificar";
}

function fechaVisible(valor: unknown) {
    if (typeof valor !== "string") return "Sense informació";

    const fecha = new Date(valor);

    return Number.isNaN(fecha.getTime())
        ? "Sense informació"
        : new Intl.DateTimeFormat("ca-ES", {
              dateStyle: "medium",
              timeStyle: "short",
          }).format(fecha);
}

async function obtener<T>(
    parametros: URLSearchParams,
    signal: AbortSignal,
): Promise<T> {
    const respuesta = await fetch(`${API}?${parametros}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
    });

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok || datos?.success !== true) {
        throw new Error(
            datos?.mensaje || "No s'ha pogut carregar la informació.",
        );
    }

    return datos as T;
}

/**
 * Conserva únicamente el catálogo admitido por la API.
 * Si detecta datos antiguos no representables, exige revisión
 * antes de permitir el guardado.
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
    const original = objeto(usuario.permisos);
    const rolAnterior = normalizarRol(usuario.rol);
    const documento = crearDocumentoPermisos();

    if (!original) {
        advertencias.push(
            "Els permisos anteriors no tenen una estructura completa. Revisa tots els passos.",
        );
    }

    if (original?.version !== 1) {
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

        const entrada = objeto(valor);
        const permisosValidados: PermisosAmbito = {};

        if (entrada) {
            for (const seccion of secciones) {
                const acciones = objeto(entrada[seccion.id]);

                if (!acciones) continue;

                permisosValidados[seccion.id] = {};

                for (const accion of seccion.acciones) {
                    const valorAccion = acciones[accion];

                    if (typeof valorAccion === "boolean") {
                        permisosValidados[seccion.id][accion] = valorAccion;
                    }
                }
            }
        }

        const completos = completarPermisosAmbito(
            ambito,
            rol,
            entrada ? permisosValidados : undefined,
        );

        const salida: PermisosAmbito = {};

        if (valor !== undefined && !entrada) {
            advertencias.push(
                `${etiqueta}: l'estructura anterior no és vàlida.`,
            );

            // No convertir una configuración malformada en permisos concedidos.
            for (const seccion of secciones) {
                salida[seccion.id] = Object.fromEntries(
                    seccion.acciones.map((accion) => [accion, false]),
                );
            }

            return salida;
        }

        if (entrada) {
            for (const [id, acciones] of Object.entries(entrada)) {
                const seccion = secciones.find((item) => item.id === id);

                if (!seccion) {
                    advertencias.push(
                        `${etiqueta}: la secció antiga «${id}» no forma part del catàleg actual i no es conservarà.`,
                    );
                    continue;
                }

                const registro = objeto(acciones);

                if (!registro) {
                    advertencias.push(
                        `${etiqueta}: cal revisar la secció «${seccion.nombre}».`,
                    );
                    continue;
                }

                for (const [accion, valorAccion] of Object.entries(registro)) {
                    if (!seccion.acciones.includes(accion)) {
                        advertencias.push(
                            `${etiqueta}: l'acció antiga «${id}.${accion}» no es conservarà.`,
                        );
                    } else if (typeof valorAccion !== "boolean") {
                        advertencias.push(
                            `${etiqueta}: «${id}.${accion}» no tenia un valor vàlid.`,
                        );
                    }
                }
            }
        }

        for (const seccion of secciones) {
            salida[seccion.id] = {};

            const entradaSeccion = entrada?.[seccion.id];
            const accionesEntrada = objeto(entradaSeccion);

            for (const accion of seccion.acciones) {
                const malformada =
                    entradaSeccion !== undefined &&
                    (
                        !accionesEntrada ||
                        (
                            accionesEntrada[accion] !== undefined &&
                            typeof accionesEntrada[accion] !== "boolean"
                        )
                    );

                salida[seccion.id][accion] = malformada
                    ? false
                    : completos[seccion.id]?.[accion] === true;
            }
        }

        return salida;
    }

    const estructurado =
        original &&
        ["version", "globales", "torneos", "acceso_torneos"].some(
            (clave) => Object.hasOwn(original, clave),
        );

    documento.globales = prepararAmbito(
        "general",
        rolAnterior,
        estructurado ? original?.globales : original ?? undefined,
        "Permisos generals",
    );

    const comun = objeto(original?.acceso_torneos);
    const todos = comun?.todos === true;
    const rolComun = normalizarRol(comun?.rol);

    if (todos && !rolComun) {
        advertencias.push(
            "L'accés comú no tenia un rol vàlid. Selecciona'l abans de desar.",
        );
    }

    documento.acceso_torneos = {
        todos,
        rol: todos ? rolComun : null,
        permisos: prepararAmbito(
            "torneo",
            todos ? rolComun : null,
            comun?.permisos,
            "Tots els tornejos",
        ),
    };

    const torneos = objeto(original?.torneos);

    if (original?.torneos !== undefined && !torneos) {
        advertencias.push(
            "Les assignacions anteriors dels tornejos no són vàlides. Cal tornar-les a configurar.",
        );
    }

    const uuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    for (const [clave, valor] of Object.entries(torneos ?? {})) {
        if (!uuid.test(clave)) {
            advertencias.push(
                `L'assignació «${clave}» no té un identificador vàlid i no es conservarà.`,
            );
            continue;
        }

        const id = clave.toLowerCase();

        if (Object.hasOwn(documento.torneos, id)) {
            throw new Error(
                "Hi ha assignacions duplicades d'un mateix torneig. Cal corregir-les abans de continuar.",
            );
        }

        const asignacion = objeto(valor);
        const acceso = asignacion?.acceso === true;
        const rolAsignado =
            asignacion?.rol === undefined
                ? rolAnterior
                : normalizarRol(asignacion.rol);

        if (!asignacion || typeof asignacion.acceso !== "boolean") {
            advertencias.push(
                `L'assignació del torneig ${id} no era vàlida i es mostrarà sense accés.`,
            );
        }

        if (acceso && !rolAsignado) {
            advertencias.push(
                `El torneig ${id} necessita un rol vàlid.`,
            );
        }

        documento.torneos[id] = {
            acceso,
            rol: acceso ? rolAsignado : null,
            permisos: prepararAmbito(
                "torneo",
                acceso ? rolAsignado : null,
                asignacion?.permisos,
                `Torneig ${id}`,
            ),
        };
    }

    if (typeof original?.ultima_actualizacion === "string") {
        documento.ultima_actualizacion = original.ultima_actualizacion;
    }

    return {
        documento,
        advertencias: [...new Set(advertencias)],
    };
}

function obtenerRolMinimo(documento: DocumentoPermisos): Rol | null {
    try {
        return calcularRolMinimo(documento);
    } catch {
        return null;
    }
}

export default function Asistente({
    usuarioID,
    modo,
    onCancelar,
    onGuardado,
}: Props) {
    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [configuracion, setConfiguracion] =
        useState<Configuracion | null>(null);
    const [documento, setDocumento] =
        useState<DocumentoPermisos | null>(null);

    const [advertencias, setAdvertencias] = useState<string[]>([]);
    const [revisionAceptada, setRevisionAceptada] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [errorCarga, setErrorCarga] = useState("");
    const [error, setError] = useState("");
    const [intento, setIntento] = useState(0);

    const [pasoID, setPasoID] = useState("usuario");
    const [modificado, setModificado] = useState(false);
    const [confirmarSalida, setConfirmarSalida] = useState(false);

    const bloqueoGuardado = useRef(false);
    const tituloPasoRef = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        const controlador = new AbortController();

        setCargando(true);
        setErrorCarga("");

        async function cargar() {
            try {
                const [nuevaConfiguracion, nuevoDetalle] = await Promise.all([
                    obtener<Configuracion>(
                        new URLSearchParams({ vista: "configuracion" }),
                        controlador.signal,
                    ),
                    obtener<Detalle>(
                        new URLSearchParams({
                            vista: "detalle",
                            id: usuarioID,
                        }),
                        controlador.signal,
                    ),
                ]);

                if (controlador.signal.aborted) return;

                const resultado = cargarDocumento(
                    nuevoDetalle.usuario,
                    nuevaConfiguracion,
                    modo === "crear",
                );

                setConfiguracion(nuevaConfiguracion);
                setDetalle(nuevoDetalle);
                setDocumento(resultado.documento);
                setAdvertencias(resultado.advertencias);
                setRevisionAceptada(false);
                setModificado(false);
                setPasoID("usuario");
            } catch (err) {
                if (controlador.signal.aborted) return;

                setErrorCarga(
                    err instanceof Error
                        ? err.message
                        : "No s'ha pogut carregar l'usuari.",
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [usuarioID, modo, intento]);

    useEffect(() => {
        if (!modificado) return;

        function avisar(evento: BeforeUnloadEvent) {
            evento.preventDefault();
            evento.returnValue = "";
        }

        window.addEventListener("beforeunload", avisar);
        return () => window.removeEventListener("beforeunload", avisar);
    }, [modificado]);

    useEffect(() => {
        if (!cargando) tituloPasoRef.current?.focus();
    }, [pasoID, cargando]);

    if (cargando) {
        return (
            <div
                role="status"
                className="flex items-center justify-center gap-3 py-20 text-sm text-secondary"
            >
                <span
                    aria-hidden="true"
                    className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary"
                />
                Carregant permisos...
            </div>
        );
    }

    if (errorCarga || !configuracion || !detalle || !documento) {
        return (
            <div className="space-y-4 rounded-xl border border-border bg-white p-6 in-[.oscuro_&]:bg-card">
                <p role="alert" className="text-sm text-error">
                    {errorCarga || "No s'ha pogut carregar la informació."}
                </p>

                <div className="flex gap-3">
                    <button
                        type="button"
                        className={secundario}
                        onClick={onCancelar}
                    >
                        Tornar
                    </button>
                    <button
                        type="button"
                        className={principal}
                        onClick={() => setIntento((valor) => valor + 1)}
                    >
                        Tornar-ho a provar
                    </button>
                </div>
            </div>
        );
    }

    const config = configuracion;
    const datos = detalle;
    const doc = documento;
    const usuario = datos.usuario;
    const creando = modo === "crear";

    const puedeEditar =
        modo !== "ver" &&
        (
            creando
                ? datos.capacidades.crear && config.capacidades.crear
                : datos.capacidades.editar && config.capacidades.editar
        );

    const bloqueado = !puedeEditar || guardando;
    const rolMinimo = obtenerRolMinimo(doc);

    function nombreTorneo(id: string) {
        return config.torneos.find(
            (torneo) => torneo.id.toLowerCase() === id.toLowerCase(),
        )?.nombre || `Torneig ${id}`;
    }

    const pasos: Paso[] = [
        { id: "usuario", tipo: "usuario", titulo: "Usuari" },
        { id: "accesos", tipo: "accesos", titulo: "Tornejos i rols" },
        ...config.seccionesGenerales.map(
            (seccion): Paso => ({
                id: `general:${seccion.id}`,
                tipo: "permisos",
                titulo: `General · ${seccion.nombre}`,
                seccion,
                ambito: "general",
            }),
        ),
    ];

    if (doc.acceso_torneos.todos) {
        pasos.push(
            ...config.seccionesTorneo.map(
                (seccion): Paso => ({
                    id: `comun:${seccion.id}`,
                    tipo: "permisos",
                    titulo: `Tots els tornejos · ${seccion.nombre}`,
                    seccion,
                    ambito: "comun",
                }),
            ),
        );
    }

    for (const [id, asignacion] of Object.entries(doc.torneos)) {
        if (!asignacion.acceso) continue;

        pasos.push(
            ...config.seccionesTorneo.map(
                (seccion): Paso => ({
                    id: `torneo:${id}:${seccion.id}`,
                    tipo: "permisos",
                    titulo: `${nombreTorneo(id)} · ${seccion.nombre}`,
                    seccion,
                    ambito: "individual",
                    torneoID: id,
                }),
            ),
        );
    }

    pasos.push({
        id: "resumen",
        tipo: "resumen",
        titulo: "Resum",
    });

    const indice = Math.max(
        0,
        pasos.findIndex((paso) => paso.id === pasoID),
    );
    const pasoActual = pasos[indice];

    const idsTorneos = [
        ...new Set([
            ...config.torneos.map((torneo) => torneo.id.toLowerCase()),
            ...Object.keys(doc.torneos),
        ]),
    ];

    function aplicar(nuevo: DocumentoPermisos) {
        const anteriorRol = obtenerRolMinimo(doc);
        const nuevoRol = obtenerRolMinimo(nuevo);

        if (anteriorRol !== nuevoRol) {
            nuevo.globales = completarPermisosAmbito(
                "general",
                nuevoRol,
                anteriorRol === null ? undefined : nuevo.globales,
            );
        }

        setDocumento(nuevo);
        setModificado(true);
        setError("");
    }

    function cambiarTodos(todos: boolean) {
        if (bloqueado) return;
        if (todos && !config.capacidades.concederTodos) return;

        const rol = todos
            ? doc.acceso_torneos.rol ?? config.roles[0]?.valor ?? null
            : null;

        aplicar({
            ...doc,
            acceso_torneos: {
                todos,
                rol,
                permisos: completarPermisosAmbito("torneo", rol),
            },
        });
    }

    function cambiarRolComun(rol: Rol | null) {
        if (bloqueado) return;

        aplicar({
            ...doc,
            acceso_torneos: {
                ...doc.acceso_torneos,
                rol,
                permisos: completarPermisosAmbito(
                    "torneo",
                    rol,
                    doc.acceso_torneos.rol
                        ? doc.acceso_torneos.permisos
                        : undefined,
                ),
            },
        });
    }

    function cambiarAcceso(
        id: string,
        valor: "heredar" | "permitir" | "denegar",
    ) {
        if (bloqueado) return;

        const torneos = { ...doc.torneos };

        if (valor === "heredar") {
            delete torneos[id];
        } else if (valor === "denegar") {
            torneos[id] = {
                acceso: false,
                rol: null,
                permisos: completarPermisosAmbito("torneo", null),
            };
        } else {
            const anterior = torneos[id];
            const rol =
                anterior?.rol ??
                (
                    doc.acceso_torneos.todos
                        ? doc.acceso_torneos.rol
                        : null
                ) ??
                config.roles[0]?.valor ??
                null;

            torneos[id] = {
                acceso: true,
                rol,
                permisos: completarPermisosAmbito(
                    "torneo",
                    rol,
                    anterior?.acceso
                        ? anterior.permisos
                        : doc.acceso_torneos.todos
                          ? doc.acceso_torneos.permisos
                          : undefined,
                ),
            };
        }

        aplicar({ ...doc, torneos });
    }

    function cambiarRolTorneo(id: string, rol: Rol | null) {
        if (bloqueado) return;

        const asignacion = doc.torneos[id];

        if (!asignacion?.acceso) return;

        aplicar({
            ...doc,
            torneos: {
                ...doc.torneos,
                [id]: {
                    ...asignacion,
                    rol,
                    permisos: completarPermisosAmbito(
                        "torneo",
                        rol,
                        asignacion.rol ? asignacion.permisos : undefined,
                    ),
                },
            },
        });
    }

    function obtenerAmbito(paso: Extract<Paso, { tipo: "permisos" }>) {
        if (paso.ambito === "general") return doc.globales;
        if (paso.ambito === "comun") return doc.acceso_torneos.permisos;

        return doc.torneos[paso.torneoID!].permisos;
    }

    function obtenerRolPaso(paso: Extract<Paso, { tipo: "permisos" }>) {
        if (paso.ambito === "general") return rolMinimo;
        if (paso.ambito === "comun") return doc.acceso_torneos.rol;

        return doc.torneos[paso.torneoID!].rol;
    }

    function nivelRequerido(seccion: string, accion: string) {
        const regla = config.nivelesPermisos[seccion];

        return regla?.acciones?.[accion] ?? regla?.nivel ?? Infinity;
    }

    function cambiarPermiso(
        paso: Extract<Paso, { tipo: "permisos" }>,
        accion: string,
        permitido: boolean,
    ) {
        if (bloqueado) return;

        const rol = obtenerRolPaso(paso);
        const nivel = rol ? niveles[rol] : -1;

        if (permitido && nivel < nivelRequerido(paso.seccion.id, accion)) {
            return;
        }

        const actual = obtenerAmbito(paso);
        const nuevo = {
            ...actual,
            [paso.seccion.id]: {
                ...actual[paso.seccion.id],
                [accion]: permitido,
            },
        };

        if (paso.ambito === "general") {
            aplicar({ ...doc, globales: nuevo });
        } else if (paso.ambito === "comun") {
            aplicar({
                ...doc,
                acceso_torneos: {
                    ...doc.acceso_torneos,
                    permisos: nuevo,
                },
            });
        } else {
            const id = paso.torneoID!;

            aplicar({
                ...doc,
                torneos: {
                    ...doc.torneos,
                    [id]: {
                        ...doc.torneos[id],
                        permisos: nuevo,
                    },
                },
            });
        }
    }

    function validarAccesos() {
        if (doc.acceso_torneos.todos && !doc.acceso_torneos.rol) {
            return "Selecciona el rol comú dels tornejos.";
        }

        for (const [id, asignacion] of Object.entries(doc.torneos)) {
            if (asignacion.acceso && !asignacion.rol) {
                return `Selecciona un rol per a ${nombreTorneo(id)}.`;
            }
        }

        if (!obtenerRolMinimo(doc)) {
            return "Assigna accés a tots els tornejos o, com a mínim, a un torneig.";
        }

        return "";
    }

    function irAPaso(nuevoIndice: number) {
        if (guardando) return;

        if (
            puedeEditar &&
            pasoActual.tipo === "accesos" &&
            nuevoIndice > indice
        ) {
            const problema = validarAccesos();

            if (problema) {
                setError(problema);
                return;
            }
        }

        const destino = pasos[nuevoIndice];
        if (!destino) return;

        setPasoID(destino.id);
        setError("");
    }

    function solicitarSalida() {
        if (guardando) return;

        if (modificado) {
            setConfirmarSalida(true);
        } else {
            onCancelar();
        }
    }

    async function guardar() {
        if (!puedeEditar || bloqueoGuardado.current) return;

        const problema = validarAccesos();

        if (problema) {
            setError(problema);
            return;
        }

        if (advertencias.length > 0 && !revisionAceptada) {
            setError("Confirma que has revisat l'adaptació dels permisos anteriors.");
            return;
        }

        if (doc.globales.panell?.ver !== true) {
            setError(
                "Activa l'accés general al panell. Per retirar tots els permisos, utilitza l'opció «Retirar» del llistat.",
            );
            return;
        }

        bloqueoGuardado.current = true;
        setGuardando(true);
        setError("");

        try {
            const preparado = prepararDocumentoPermisos(doc);

            const respuesta = await fetch(API, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    accion: creando ? "crear" : "editar",
                    id: usuario.id,
                    fecha_actualizacion: usuario.fecha_actualizacion,
                    permisos: preparado.permisos,
                }),
            });

            const resultado = await respuesta.json().catch(() => null);

            if (!respuesta.ok || resultado?.success !== true) {
                throw new Error(
                    resultado?.mensaje || "No s'han pogut desar els permisos.",
                );
            }

            setModificado(false);

            onGuardado(
                creando
                    ? "S'ha concedit l'accés al panell. No s'ha enviat cap correu: l'enviament encara està pendent d'implementar."
                    : "S'han actualitzat els permisos.",
            );
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "No s'han pogut desar els permisos.",
            );
        } finally {
            bloqueoGuardado.current = false;
            setGuardando(false);
        }
    }

    function selectorRol(
        valor: Rol | null,
        onChange: (rol: Rol | null) => void,
        etiqueta: string,
    ) {
        const disponible = config.roles.some((rol) => rol.valor === valor);

        return (
            <label className="block">
                <span className="mb-2 block text-xs font-semibold">
                    {etiqueta}
                </span>
                <select
                    value={valor ?? ""}
                    disabled={bloqueado}
                    className={campo}
                    onChange={(evento) =>
                        onChange(normalizarRol(evento.target.value))
                    }
                >
                    <option value="" disabled>
                        Selecciona un rol
                    </option>

                    {valor && !disponible && (
                        <option value={valor} disabled>
                            {NOMBRES_ROL[valor]} · Rol actual
                        </option>
                    )}

                    {config.roles.map((rol) => (
                        <option key={rol.valor} value={rol.valor}>
                            {rol.nombre}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    function resumenAmbito(
        titulo: string,
        permisos: PermisosAmbito,
        secciones: SeccionPermisos[],
    ) {
        return (
            <details className="rounded-xl border border-border">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                    {titulo}
                </summary>

                <div className="space-y-4 border-t border-border p-4">
                    {secciones.map((seccion) => (
                        <div key={seccion.id}>
                            <h4 className="text-sm font-semibold">
                                {seccion.nombre}
                            </h4>

                            <ul className="mt-2 flex flex-wrap gap-2">
                                {seccion.acciones.map((accion) => (
                                    <li
                                        key={accion}
                                        className={`rounded-md px-2 py-1 text-xs ${
                                            permisos[seccion.id]?.[accion] === true
                                                ? "bg-primary/10"
                                                : "bg-secondary/5 text-secondary/65"
                                        }`}
                                    >
                                        {config.nombresAcciones[accion] || accion}
                                        {": "}
                                        {permisos[seccion.id]?.[accion] === true
                                            ? "Sí"
                                            : "No"}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </details>
        );
    }

    return (
        <div className="space-y-6 text-secondary">
            <header>
                <button
                    type="button"
                    disabled={guardando}
                    onClick={solicitarSalida}
                    className="text-sm font-medium hover:underline disabled:opacity-50"
                >
                    ← Tornar a permisos
                </button>

                <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                    {creando
                        ? "Afegir usuari al panell"
                        : puedeEditar
                          ? "Gestionar permisos"
                          : "Consultar permisos"}
                </h1>

                <p className="mt-2 text-sm text-secondary/70">
                    {nombreUsuario(usuario)}
                    {usuario.email ? ` · ${usuario.email}` : ""}
                </p>
            </header>

            {!puedeEditar && (
                <p className="rounded-xl border border-border bg-white p-4 text-sm in-[.oscuro_&]:bg-card">
                    Estàs consultant aquesta configuració en mode de lectura.
                </p>
            )}

            {confirmarSalida && (
                <div
                    role="alert"
                    className="space-y-3 rounded-xl border border-border bg-white p-5 in-[.oscuro_&]:bg-card"
                >
                    <p className="text-sm">
                        Hi ha canvis sense desar. Vols sortir i descartar-los?
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            className={secundario}
                            onClick={() => setConfirmarSalida(false)}
                        >
                            Continuar editant
                        </button>
                        <button
                            type="button"
                            className={`${boton} bg-error text-white`}
                            onClick={onCancelar}
                        >
                            Descartar i sortir
                        </button>
                    </div>
                </div>
            )}

            <nav aria-label="Passos de configuració" className="space-y-3">
                <div className="flex items-center justify-between gap-4 text-xs">
                    <span className="font-semibold">
                        Pas {indice + 1} de {pasos.length}
                    </span>
                    <span className="text-right text-secondary/70">
                        {pasoActual.titulo}
                    </span>
                </div>

                <progress
                    value={indice + 1}
                    max={pasos.length}
                    aria-label="Progrés de la configuració"
                    className="block h-2 w-full overflow-hidden rounded-full accent-primary"
                />

                <label className="block">
                    <span className="sr-only">Anar a un pas</span>
                    <select
                        className={campo}
                        value={pasoActual.id}
                        disabled={guardando}
                        onChange={(evento) =>
                            irAPaso(
                                pasos.findIndex(
                                    (paso) => paso.id === evento.target.value,
                                ),
                            )
                        }
                    >
                        {pasos.map((paso, posicion) => (
                            <option key={paso.id} value={paso.id}>
                                {posicion + 1}. {paso.titulo}
                            </option>
                        ))}
                    </select>
                </label>
            </nav>

            <section
                aria-labelledby="permisos-paso-titulo"
                aria-busy={guardando}
                className="rounded-2xl border border-border bg-white p-5 sm:p-8 in-[.oscuro_&]:bg-card"
            >
                <div className="mb-6 border-b border-border pb-4">
                    <h2
                        id="permisos-paso-titulo"
                        ref={tituloPasoRef}
                        tabIndex={-1}
                        className="text-lg font-semibold outline-none"
                    >
                        {pasoActual.titulo}
                    </h2>
                </div>

                {pasoActual.tipo === "usuario" && (
                    <div className="space-y-6">
                        <dl className="grid gap-5 sm:grid-cols-2">
                            {[
                                ["Nom", usuario.nombre],
                                ["Primer cognom", usuario.apellido1],
                                ["Segon cognom", usuario.apellido2],
                                ["Correu electrònic", usuario.email],
                                [
                                    "Origen dels permisos",
                                    creando
                                        ? "Manual"
                                        : nombreOrigen(usuario.origen_permisos),
                                ],
                                [
                                    "Estat del compte",
                                    usuario.activa === true ? "Actiu" : "Inactiu",
                                ],
                            ].map(([etiqueta, valor]) => (
                                <div key={etiqueta}>
                                    <dt className="mb-2 text-xs font-semibold">
                                        {etiqueta}
                                    </dt>
                                    <dd className="min-h-10 rounded-lg bg-[#f0f5ff] px-3 py-2.5 text-sm in-[.oscuro_&]:bg-background">
                                        {valor || "Sense informació"}
                                    </dd>
                                </div>
                            ))}
                        </dl>

                        <p className="text-sm leading-relaxed text-secondary/70">
                            Configura els accessos d'aquest compte existent.
                            El rol general es calcularà automàticament a partir
                            del rol més baix assignat als tornejos.
                        </p>

                        {!creando && (
                            <p className="text-xs text-secondary/65">
                                Darrera actualització dels permisos:{" "}
                                {fechaVisible(
                                    objeto(usuario.permisos)?.ultima_actualizacion,
                                )}
                            </p>
                        )}

                        {advertencias.length > 0 && (
                            <div className="rounded-xl border border-border bg-background/50 p-4">
                                <h3 className="text-sm font-semibold">
                                    Revisió de la configuració anterior
                                </h3>
                                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                                    {advertencias.map((advertencia) => (
                                        <li key={advertencia}>{advertencia}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {pasoActual.tipo === "accesos" && (
                    <div className="space-y-6">
                        <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                            <label className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    checked={doc.acceso_torneos.todos}
                                    disabled={
                                        bloqueado ||
                                        (
                                            !doc.acceso_torneos.todos &&
                                            !config.capacidades.concederTodos
                                        )
                                    }
                                    onChange={(evento) =>
                                        cambiarTodos(evento.target.checked)
                                    }
                                    className="mt-1 h-4 w-4 accent-primary"
                                />
                                <span>
                                    <span className="block text-sm font-semibold">
                                        Accés a tots els tornejos
                                    </span>
                                    <span className="mt-1 block text-xs leading-relaxed text-secondary/70">
                                        Inclou els tornejos actuals i els que
                                        es creïn en el futur. Les excepcions
                                        individuals tenen prioritat.
                                    </span>
                                </span>
                            </label>

                            {!config.capacidades.concederTodos && puedeEditar && (
                                <p className="text-xs text-secondary/70">
                                    El teu accés actual no permet concedir
                                    accés comú a tots els tornejos.
                                </p>
                            )}

                            {doc.acceso_torneos.todos &&
                                selectorRol(
                                    doc.acceso_torneos.rol,
                                    cambiarRolComun,
                                    "Rol comú",
                                )}
                        </div>

                        <div className="rounded-xl bg-[#f0f5ff] p-4 in-[.oscuro_&]:bg-background">
                            <p className="text-xs font-semibold">
                                Rol general resultant
                            </p>
                            <p className="mt-1 text-sm">
                                {rolMinimo
                                    ? NOMBRES_ROL[rolMinimo]
                                    : "Pendent d'assignar accessos i rols"}
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold">
                                {doc.acceso_torneos.todos
                                    ? "Excepcions per torneig"
                                    : "Accessos per torneig"}
                            </h3>

                            {idsTorneos.length === 0 && (
                                <p className="text-sm text-secondary/70">
                                    No hi ha tornejos disponibles.
                                </p>
                            )}

                            {idsTorneos.map((id) => {
                                const asignacion = doc.torneos[id];
                                const disponible = config.torneos.some(
                                    (torneo) => torneo.id.toLowerCase() === id,
                                );

                                const valor = asignacion
                                    ? asignacion.acceso
                                        ? "permitir"
                                        : "denegar"
                                    : "heredar";

                                return (
                                    <div
                                        key={id}
                                        className="space-y-4 rounded-xl border border-border p-4"
                                    >
                                        <div>
                                            <h4 className="text-sm font-semibold">
                                                {nombreTorneo(id)}
                                            </h4>
                                            {!disponible && (
                                                <p className="mt-1 text-xs text-error">
                                                    Aquesta assignació no apareix
                                                    entre els tornejos disponibles.
                                                    La API comprovarà si existeix
                                                    i si la pots gestionar.
                                                </p>
                                            )}
                                        </div>

                                        <label className="block">
                                            <span className="mb-2 block text-xs font-semibold">
                                                Accés
                                            </span>
                                            <select
                                                value={valor}
                                                disabled={bloqueado}
                                                className={campo}
                                                onChange={(evento) =>
                                                    cambiarAcceso(
                                                        id,
                                                        evento.target.value as
                                                            | "heredar"
                                                            | "permitir"
                                                            | "denegar",
                                                    )
                                                }
                                            >
                                                <option value="heredar">
                                                    {doc.acceso_torneos.todos
                                                        ? "Utilitzar la configuració comuna"
                                                        : "Sense assignació"}
                                                </option>
                                                <option value="permitir">
                                                    Accés amb configuració pròpia
                                                </option>
                                                <option value="denegar">
                                                    Denegar l'accés explícitament
                                                </option>
                                            </select>
                                        </label>

                                        {asignacion?.acceso &&
                                            selectorRol(
                                                asignacion.rol,
                                                (rol) => cambiarRolTorneo(id, rol),
                                                "Rol en aquest torneig",
                                            )}

                                        {!asignacion &&
                                            doc.acceso_torneos.todos && (
                                                <p className="text-xs text-secondary/70">
                                                    Hereta el rol i els permisos comuns.
                                                </p>
                                            )}
                                    </div>
                                );
                            })}
                        </div>

                        <p className="text-xs leading-relaxed text-secondary/65">
                            L'accés dels voluntaris a les edicions segons
                            formularis acceptats s'incorporarà quan aquesta
                            funcionalitat estigui disponible.
                        </p>
                    </div>
                )}

                {pasoActual.tipo === "permisos" && (() => {
                    const rol = obtenerRolPaso(pasoActual);
                    const ambito = obtenerAmbito(pasoActual);
                    const nivel = rol ? niveles[rol] : -1;
                    const panelDesactivado =
                        pasoActual.seccion.id !== "panell" &&
                        ambito.panell?.ver !== true;

                    return (
                        <div className="space-y-5">
                            <p className="text-sm text-secondary/70">
                                Rol aplicable:{" "}
                                <strong className="text-secondary">
                                    {rol ? NOMBRES_ROL[rol] : "Sense rol assignat"}
                                </strong>
                            </p>

                            {panelDesactivado && (
                                <p className="rounded-lg bg-primary/5 p-3 text-sm">
                                    L'accés al panell està desactivat en aquest
                                    àmbit. Aquests permisos no seran efectius
                                    fins que l'activis.
                                </p>
                            )}

                            <div className="divide-y divide-border rounded-xl border border-border">
                                {pasoActual.seccion.acciones.map((accion) => {
                                    const requerido = nivelRequerido(
                                        pasoActual.seccion.id,
                                        accion,
                                    );
                                    const suficiente = nivel >= requerido;
                                    const activo =
                                        ambito[pasoActual.seccion.id]?.[accion] === true;
                                    const minimo = ROLES_ORDENADOS.find(
                                        (item) => niveles[item] >= requerido,
                                    );

                                    return (
                                        <label
                                            key={accion}
                                            className="flex items-center justify-between gap-4 p-4"
                                        >
                                            <span>
                                                <span className="block text-sm font-semibold">
                                                    {config.nombresAcciones[accion] || accion}
                                                </span>
                                                {!suficiente && (
                                                    <span className="mt-1 block text-xs text-secondary/65">
                                                        {minimo
                                                            ? `Requereix com a mínim el rol ${NOMBRES_ROL[minimo]}.`
                                                            : "Acció no disponible amb aquest rol."}
                                                    </span>
                                                )}
                                            </span>

                                            <input
                                                type="checkbox"
                                                checked={activo}
                                                disabled={bloqueado || !suficiente}
                                                onChange={(evento) =>
                                                    cambiarPermiso(
                                                        pasoActual,
                                                        accion,
                                                        evento.target.checked,
                                                    )
                                                }
                                                className="h-5 w-5 shrink-0 accent-primary disabled:opacity-40"
                                            />
                                        </label>
                                    );
                                })}
                            </div>

                            <p className="text-xs leading-relaxed text-secondary/65">
                                Cada acció es desarà amb el seu valor activat
                                o desactivat. Desactivar-la impedeix utilitzar-la
                                encara que el rol tingui un nivell superior.
                            </p>
                        </div>
                    );
                })()}

                {pasoActual.tipo === "resumen" && (
                    <div className="space-y-5">
                        <dl className="grid gap-4 rounded-xl bg-[#f0f5ff] p-4 text-sm sm:grid-cols-2 in-[.oscuro_&]:bg-background">
                            <div>
                                <dt className="text-xs text-secondary/65">Usuari</dt>
                                <dd className="mt-1 font-semibold">
                                    {nombreUsuario(usuario)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-secondary/65">Rol general</dt>
                                <dd className="mt-1 font-semibold">
                                    {rolMinimo ? NOMBRES_ROL[rolMinimo] : "Sense rol"}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-secondary/65">Origen</dt>
                                <dd className="mt-1">
                                    {creando
                                        ? "Manual"
                                        : nombreOrigen(usuario.origen_permisos)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-xs text-secondary/65">
                                    Tornejos actuals i futurs
                                </dt>
                                <dd className="mt-1">
                                    {doc.acceso_torneos.todos
                                        ? "Accés comú, amb les excepcions indicades"
                                        : "Només tornejos assignats"}
                                </dd>
                            </div>
                        </dl>

                        {resumenAmbito(
                            "Permisos generals",
                            doc.globales,
                            config.seccionesGenerales,
                        )}

                        {doc.acceso_torneos.todos &&
                            resumenAmbito(
                                `Tots els tornejos · ${
                                    doc.acceso_torneos.rol
                                        ? NOMBRES_ROL[doc.acceso_torneos.rol]
                                        : "Sense rol"
                                }`,
                                doc.acceso_torneos.permisos,
                                config.seccionesTorneo,
                            )}

                        {Object.entries(doc.torneos).map(([id, asignacion]) => (
                            <div key={id}>
                                {asignacion.acceso ? (
                                    resumenAmbito(
                                        `${nombreTorneo(id)} · ${
                                            asignacion.rol
                                                ? NOMBRES_ROL[asignacion.rol]
                                                : "Sense rol"
                                        }`,
                                        asignacion.permisos,
                                        config.seccionesTorneo,
                                    )
                                ) : (
                                    <p className="rounded-xl border border-border p-4 text-sm">
                                        <strong>{nombreTorneo(id)}</strong>
                                        {" · "}Accés denegat
                                    </p>
                                )}
                            </div>
                        ))}

                        {advertencias.length > 0 && (
                            <div className="space-y-3 rounded-xl border border-border p-4">
                                <h3 className="text-sm font-semibold">
                                    Adaptació dels permisos anteriors
                                </h3>
                                <ul className="list-disc space-y-2 pl-5 text-xs">
                                    {advertencias.map((advertencia) => (
                                        <li key={advertencia}>{advertencia}</li>
                                    ))}
                                </ul>

                                {puedeEditar && (
                                    <label className="flex items-start gap-3 text-sm">
                                        <input
                                            type="checkbox"
                                            checked={revisionAceptada}
                                            disabled={guardando}
                                            onChange={(evento) =>
                                                setRevisionAceptada(evento.target.checked)
                                            }
                                            className="mt-1 h-4 w-4 accent-primary"
                                        />
                                        He revisat els canvis i accepto adaptar
                                        aquesta configuració al catàleg actual.
                                    </label>
                                )}
                            </div>
                        )}

                        {creando && (
                            <p className="text-xs text-secondary/65">
                                El correu de benvinguda encara està pendent
                                d'implementar. Aquest desament no enviarà cap correu.
                            </p>
                        )}
                    </div>
                )}

                {error && (
                    <p
                        role="alert"
                        className="mt-5 rounded-lg bg-error/10 p-3 text-sm text-error"
                    >
                        {error}
                    </p>
                )}

                <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                    <button
                        type="button"
                        className={secundario}
                        disabled={guardando}
                        onClick={solicitarSalida}
                    >
                        {puedeEditar ? "Cancel·lar" : "Tornar al llistat"}
                    </button>

                    <div className="flex flex-wrap gap-3">
                        {indice > 0 && (
                            <button
                                type="button"
                                className={secundario}
                                disabled={guardando}
                                onClick={() => irAPaso(indice - 1)}
                            >
                                Anterior
                            </button>
                        )}

                        {indice < pasos.length - 1 ? (
                            <button
                                type="button"
                                className={principal}
                                disabled={guardando}
                                onClick={() => irAPaso(indice + 1)}
                            >
                                Següent pas →
                            </button>
                        ) : puedeEditar ? (
                            <button
                                type="button"
                                className={principal}
                                disabled={
                                    guardando ||
                                    (advertencias.length > 0 && !revisionAceptada)
                                }
                                onClick={() => void guardar()}
                            >
                                {guardando
                                    ? "Desant permisos..."
                                    : creando
                                      ? "Concedir accés al panell"
                                      : "Desar permisos"}
                            </button>
                        ) : null}
                    </div>
                </footer>
            </section>
        </div>
    );
}