import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
} from "react";

type Registro = Record<string, unknown>;

type Usuario = {
    id: string;
    nombre: string | null;
    apellido1: string | null;
    apellido2: string | null;
    email: string | null;
    curso: string | null;
    ano_academico: string | null;
    rol: string | null;
    permisos: unknown;
    origen_permisos: string | null;
    fecha_creacion: string | null;
    fecha_actualizacion: string | null;
    activa: boolean | null;
};

type RespuestaDetalle = {
    success: boolean;
    usuario: Usuario;
    capacidades: {
        bloquear: boolean;
        desbloquear: boolean;
    };
    relacionesPendientes: string[];
};

type RespuestaRelacion = {
    success: boolean;
    filas: Registro[];
    total: number;
    pagina: number;
    porPagina: number;
    totalPaginas: number;
};

type VistaRelacion =
    | "torneos"
    | "ediciones"
    | "sesiones"
    | "verificaciones";

type Seccion = "datos" | "permisos" | VistaRelacion;

type AccionBloqueo = "bloquear" | "desbloquear";

type Columna = {
    campo: string;
    nombre: string;
    formato?: "fecha" | "rol";
};

const API = "/api/panell/usuaris";

const BOTON =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border bg-background px-4 py-2.5 text-sm " +
    "font-semibold text-neutral transition hover:bg-primary/10 " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-primary disabled:cursor-not-allowed " +
    "disabled:opacity-50 disabled:hover:bg-background";

const ROLES: Record<string, string> = {
    voluntario: "Voluntari",
    staff: "Staff",
    admintorneo: "Administrador de torneig",
    admin: "Administrador",
    desarrollador: "Desenvolupador",
};

const SECCIONES: { id: Seccion; nombre: string }[] = [
    { id: "datos", nombre: "Dades del compte" },
    { id: "permisos", nombre: "Permisos" },
    { id: "torneos", nombre: "Tornejos" },
    { id: "ediciones", nombre: "Edicions" },
    { id: "sesiones", nombre: "Sessions" },
    { id: "verificaciones", nombre: "Verificacions" },
];

const RELACIONES: Record<
    VistaRelacion,
    {
        titulo: string;
        descripcion: string;
        vacio: string;
        columnas: Columna[];
    }
> = {
    torneos: {
        titulo: "Tornejos accessibles",
        descripcion:
            "Accés segons el rol general o les assignacions guardades. " +
            "Tenir accés a un torneig no implica participar-hi.",
        vacio: "No s'han trobat tornejos accessibles.",
        columnas: [
            { campo: "nombre", nombre: "Torneig" },
            { campo: "deporte", nombre: "Esport" },
            { campo: "activo", nombre: "Actiu" },
            { campo: "rol_acceso", nombre: "Rol", formato: "rol" },
            { campo: "origen_acceso", nombre: "Origen de l’accés" },
        ],
    },
    ediciones: {
        titulo: "Edicions dels tornejos accessibles",
        descripcion:
            "Aquestes edicions pertanyen als tornejos accessibles. " +
            "Encara no hi ha una relació de participació entre usuaris i edicions.",
        vacio: "No s'han trobat edicions.",
        columnas: [
            { campo: "nombre", nombre: "Edició" },
            { campo: "torneo_nombre", nombre: "Torneig" },
            { campo: "estado", nombre: "Estat" },
            { campo: "sede", nombre: "Seu" },
            { campo: "fecha_inicio", nombre: "Inici", formato: "fecha" },
            { campo: "fecha_fin", nombre: "Final", formato: "fecha" },
        ],
    },
    sesiones: {
        titulo: "Historial de sessions",
        descripcion:
            "Una sessió només és vigent si està activa, no ha caducat " +
            "i el compte està actiu. Els tokens de sessió no es mostren.",
        vacio: "Aquest usuari no té sessions registrades.",
        columnas: [
            { campo: "estado", nombre: "Estat guardat" },
            { campo: "vigente", nombre: "Vigent en consultar" },
            {
                campo: "fecha_creacion",
                nombre: "Creació",
                formato: "fecha",
            },
            {
                campo: "fecha_actualizacion",
                nombre: "Actualització",
                formato: "fecha",
            },
            {
                campo: "fecha_expiracion",
                nombre: "Caducitat",
                formato: "fecha",
            },
        ],
    },
    verificaciones: {
        titulo: "Historial de verificacions",
        descripcion:
            "Registres de verificació del compte, sense mostrar codis ni tokens.",
        vacio: "Aquest usuari no té verificacions registrades.",
        columnas: [
            { campo: "tipo", nombre: "Tipus" },
            { campo: "usado", nombre: "Utilitzada" },
            {
                campo: "fecha_creacion",
                nombre: "Creació",
                formato: "fecha",
            },
            {
                campo: "fecha_expiracion",
                nombre: "Caducitat",
                formato: "fecha",
            },
        ],
    },
};

class ErrorPeticion extends Error {
    constructor(
        mensaje: string,
        public estado: number
    ) {
        super(mensaje);
    }
}

function esRegistro(valor: unknown): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function texto(valor: unknown): string {
    if (valor === null || valor === undefined || valor === "") {
        return "—";
    }

    if (typeof valor === "boolean") {
        return valor ? "Sí" : "No";
    }

    if (typeof valor === "string" || typeof valor === "number") {
        return String(valor);
    }

    return "Format no reconegut";
}

function nombreRol(valor: unknown): string {
    if (typeof valor !== "string" || !valor.trim()) {
        return "Sense rol";
    }

    return ROLES[valor.trim().toLowerCase()] ?? valor;
}

function fecha(valor: unknown): string {
    if (typeof valor !== "string" || !valor) return "—";

    const instante = new Date(valor);

    if (Number.isNaN(instante.getTime())) return "—";

    return new Intl.DateTimeFormat("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
    }).format(instante);
}

function nombreCompleto(usuario: Usuario): string {
    return [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .filter(Boolean)
        .join(" ")
        .trim() || "Usuari sense nom";
}

async function pedirJSON<T>(
    url: string,
    opciones: RequestInit = {}
): Promise<T> {
    const respuesta = await fetch(url, {
        ...opciones,
        cache: "no-store",
        headers: {
            Accept: "application/json",
            ...opciones.headers,
        },
    });

    const contenido = respuesta.headers.get("content-type") ?? "";

    if (!contenido.includes("application/json")) {
        throw new ErrorPeticion(
            "El servidor no ha retornat una resposta vàlida.",
            respuesta.status
        );
    }

    const resultado: unknown = await respuesta.json();

    if (!esRegistro(resultado)) {
        throw new ErrorPeticion(
            "Les dades rebudes no tenen el format esperat.",
            respuesta.status
        );
    }

    if (!respuesta.ok || resultado.success !== true) {
        throw new ErrorPeticion(
            typeof resultado.mensaje === "string"
                ? resultado.mensaje
                : "No s'ha pogut completar la petició.",
            respuesta.status
        );
    }

    return resultado as T;
}

function useConsulta<T>(url: string, revision: number) {
    const [datos, setDatos] = useState<T | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [estadoError, setEstadoError] = useState<number | null>(null);
    const [intento, setIntento] = useState(0);

    useEffect(() => {
        const controlador = new AbortController();

        setDatos(null);
        setCargando(true);
        setError("");
        setEstadoError(null);

        async function cargar() {
            try {
                const resultado = await pedirJSON<T>(url, {
                    signal: controlador.signal,
                });

                if (!controlador.signal.aborted) {
                    setDatos(resultado);
                }
            } catch (err) {
                if (controlador.signal.aborted) return;

                setError(
                    err instanceof Error
                        ? err.message
                        : "No s'han pogut carregar les dades."
                );

                setEstadoError(
                    err instanceof ErrorPeticion ? err.estado : null
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [url, revision, intento]);

    return {
        datos,
        cargando,
        error,
        estadoError,
        recargar: () => setIntento((valor) => valor + 1),
    };
}

function Cargando() {
    return (
        <div
            className="flex items-center justify-center gap-3 px-4 py-14 text-sm text-neutral"
            role="status"
        >
            <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none"
                aria-hidden="true"
            />
            Carregant informació...
        </div>
    );
}

function ErrorConsulta({
    mensaje,
    estado,
    usuarioID,
    reintentar,
}: {
    mensaje: string;
    estado: number | null;
    usuarioID: string;
    reintentar: () => void;
}) {
    const retorno = `/panell/usuaris/${encodeURIComponent(usuarioID)}`;

    return (
        <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
            <p className="text-sm text-error" role="alert">
                {mensaje}
            </p>

            {estado === 401 ? (
                <a
                    href={`/iniciar-sessio?redirect=${encodeURIComponent(retorno)}`}
                    className={BOTON}
                >
                    Iniciar sessió
                </a>
            ) : estado === 403 || estado === 404 ? (
                <a href="/panell/usuaris" className={BOTON}>
                    Tornar als usuaris
                </a>
            ) : (
                <button
                    type="button"
                    onClick={reintentar}
                    className={BOTON}
                >
                    Tornar-ho a provar
                </button>
            )}
        </div>
    );
}

function Tarjeta({
    titulo,
    children,
}: {
    titulo: string;
    children: ReactNode;
}) {
    return (
        <section className="min-w-0 rounded-xl border border-border bg-card p-4 md:p-5">
            <h2 className="mb-4 font-semibold text-neutral-titulos">
                {titulo}
            </h2>

            {children}
        </section>
    );
}

function Dato({
    nombre,
    valor,
}: {
    nombre: string;
    valor: ReactNode;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-xs text-neutral">{nombre}</dt>
            <dd className="mt-1 wrap-break-words text-sm font-medium text-neutral-titulos">
                {valor}
            </dd>
        </div>
    );
}

function EstadoCuenta({ activa }: { activa: boolean | null }) {
    const colores =
        activa === true
            ? "border-primary/25 bg-primary/10 text-primary"
            : activa === false
              ? "border-error/25 bg-error/10 text-error"
              : "border-border bg-background text-neutral";

    return (
        <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${colores}`}
        >
            {activa === true
                ? "Actiu"
                : activa === false
                  ? "Bloquejat"
                  : "Sense estat"}
        </span>
    );
}

function DatosCuenta({ usuario }: { usuario: Usuario }) {
    return (
        <div className="grid gap-5 xl:grid-cols-2">
            <Tarjeta titulo="Dades personals">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Dato nombre="Nom" valor={texto(usuario.nombre)} />
                    <Dato
                        nombre="Primer cognom"
                        valor={texto(usuario.apellido1)}
                    />
                    <Dato
                        nombre="Segon cognom"
                        valor={texto(usuario.apellido2)}
                    />
                    <Dato
                        nombre="Correu electrònic"
                        valor={
                            <span className="break-all">
                                {texto(usuario.email)}
                            </span>
                        }
                    />
                    <Dato nombre="Curs" valor={texto(usuario.curso)} />
                    <Dato
                        nombre="Any acadèmic"
                        valor={texto(usuario.ano_academico)}
                    />
                </dl>
            </Tarjeta>

            <Tarjeta titulo="Informació del compte">
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Dato
                        nombre="Identificador"
                        valor={
                            <span className="break-all font-mono text-xs">
                                {usuario.id}
                            </span>
                        }
                    />
                    <Dato
                        nombre="Rol general"
                        valor={nombreRol(usuario.rol)}
                    />
                    <Dato
                        nombre="Origen dels permisos"
                        valor={texto(usuario.origen_permisos)}
                    />
                    <Dato
                        nombre="Data de registre"
                        valor={fecha(usuario.fecha_creacion)}
                    />
                    <Dato
                        nombre="Última actualització del compte"
                        valor={fecha(usuario.fecha_actualizacion)}
                    />
                    <Dato
                        nombre="Estat"
                        valor={<EstadoCuenta activa={usuario.activa} />}
                    />
                </dl>
            </Tarjeta>

            <Tarjeta titulo="Equips i participants">
                <p className="text-sm text-neutral">
                    Pròximament. Es mostraran els equips de l’usuari,
                    les seves vinculacions i els estats corresponents.
                </p>
            </Tarjeta>

            <Tarjeta titulo="Formularis enviats">
                <p className="text-sm text-neutral">
                    Pròximament. Es mostraran els formularis enviats
                    i les seves respostes quan aquesta funcionalitat
                    estigui disponible.
                </p>
            </Tarjeta>
        </div>
    );
}

function TablaPermisos({ permisos }: { permisos: unknown }) {
    if (permisos === null || permisos === undefined) {
        return (
            <p className="text-sm text-neutral">
                No hi ha permisos explícits guardats en aquest àmbit.
            </p>
        );
    }

    if (!esRegistro(permisos)) {
        return (
            <p className="text-sm text-error">
                La configuració guardada no té un format vàlid.
            </p>
        );
    }

    const entradas = Object.entries(permisos);

    if (entradas.length === 0) {
        return (
            <p className="text-sm text-neutral">
                No hi ha permisos explícits guardats en aquest àmbit.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-105 text-left text-sm">
                <thead className="border-b border-border text-xs text-neutral">
                    <tr>
                        <th scope="col" className="px-3 py-3">
                            Secció
                        </th>
                        <th scope="col" className="px-3 py-3">
                            Acció
                        </th>
                        <th scope="col" className="px-3 py-3">
                            Valor guardat
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-border">
                    {entradas.flatMap(([seccion, acciones]) => {
                        if (!esRegistro(acciones)) {
                            return [
                                <tr key={seccion}>
                                    <td className="px-3 py-3">{seccion}</td>
                                    <td className="px-3 py-3">—</td>
                                    <td className="px-3 py-3 text-error">
                                        Format no vàlid
                                    </td>
                                </tr>,
                            ];
                        }

                        if (Object.keys(acciones).length === 0) {
                            return [
                                <tr key={seccion}>
                                    <td className="px-3 py-3">{seccion}</td>
                                    <td
                                        colSpan={2}
                                        className="px-3 py-3 text-neutral"
                                    >
                                        Sense accions explícites
                                    </td>
                                </tr>,
                            ];
                        }

                        return Object.entries(acciones).map(
                            ([accion, valor]) => (
                                <tr key={`${seccion}/${accion}`}>
                                    <td className="px-3 py-3 text-neutral-titulos">
                                        {seccion}
                                    </td>
                                    <td className="px-3 py-3 text-neutral">
                                        {accion}
                                    </td>
                                    <td
                                        className={`px-3 py-3 font-semibold ${
                                            valor === true
                                                ? "text-primary"
                                                : valor === false
                                                  ? "text-error"
                                                  : "text-neutral"
                                        }`}
                                    >
                                        {valor === true
                                            ? "Sí · true"
                                            : valor === false
                                              ? "No · false"
                                              : "Format no vàlid"}
                                    </td>
                                </tr>
                            )
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function PermisosUsuario({ usuario }: { usuario: Usuario }) {
    const documento = esRegistro(usuario.permisos)
        ? usuario.permisos
        : null;

    const estructurado = documento !== null && (
        Object.hasOwn(documento, "globales") ||
        Object.hasOwn(documento, "torneos") ||
        Object.hasOwn(documento, "version")
    );

    const globales = estructurado
        ? documento?.globales
        : documento
          ? Object.fromEntries(
                Object.entries(documento).filter(
                    ([clave]) => clave !== "ultima_actualizacion"
                )
            )
          : null;

    const asignaciones = documento && esRegistro(documento.torneos)
        ? Object.entries(documento.torneos)
        : [];

    // Orden de presentación: jsonb no garantiza el orden de las claves.
    const documentoOrdenado = documento
        ? {
            ...(Object.hasOwn(documento, "version")
                ? { version: documento.version }
                : {}),
            ...(Object.hasOwn(documento, "ultima_actualizacion")
                ? {
                    ultima_actualizacion:
                        documento.ultima_actualizacion,
                }
                : {}),
            ...Object.fromEntries(
                Object.entries(documento).filter(
                    ([clave]) =>
                        clave !== "version" &&
                        clave !== "ultima_actualizacion"
                )
            ),
        }
        : usuario.permisos;

    return (
        <div className="flex flex-col gap-5">
            <Tarjeta titulo="Configuració de permisos">
                <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <Dato
                        nombre="Rol general"
                        valor={nombreRol(usuario.rol)}
                    />
                    <Dato
                        nombre="Origen"
                        valor={texto(usuario.origen_permisos)}
                    />
                    <Dato
                        nombre="Versió del JSON"
                        valor={texto(documento?.version)}
                    />
                    <Dato
                        nombre="Última actualització dels permisos"
                        valor={fecha(documento?.ultima_actualizacion)}
                    />
                </dl>

                <p className="mt-5 text-sm text-neutral">
                    Es mostren els valors guardats. Els permisos efectius
                    depenen també del nivell del rol i de l’accés al torneig.
                </p>

                {documento && !estructurado && (
                    <p className="mt-3 rounded-lg border border-border bg-background p-3 text-sm text-neutral">
                        Aquest compte conserva l’estructura antiga de
                        permisos. Encara no diferencia els àmbits per torneig.
                    </p>
                )}

                {usuario.permisos !== null &&
                    usuario.permisos !== undefined &&
                    !documento && (
                        <p className="mt-3 text-sm text-error">
                            El document de permisos no té un format vàlid.
                        </p>
                    )}
            </Tarjeta>

            <Tarjeta
                titulo={
                    estructurado
                        ? "Permisos generals"
                        : "Permisos guardats"
                }
            >
                <TablaPermisos permisos={globales} />
            </Tarjeta>

            <Tarjeta titulo="Assignacions i permisos per torneig">
                {asignaciones.length === 0 ? (
                    <p className="text-sm text-neutral">
                        No hi ha assignacions explícites guardades.
                        Els administradors i desenvolupadors poden tenir
                        accés general pel seu rol.
                    </p>
                ) : (
                    <div className="flex flex-col gap-4">
                        {asignaciones.map(([torneoID, asignacion]) => (
                            <details
                                key={torneoID}
                                className="rounded-lg border border-border bg-background"
                            >
                                <summary className="cursor-pointer wrap-break-words p-4 text-sm font-semibold text-neutral-titulos">
                                    Torneig: {torneoID}
                                </summary>

                                <div className="border-t border-border p-4">
                                    {esRegistro(asignacion) ? (
                                        <>
                                            <dl className="mb-5 grid gap-4 sm:grid-cols-2">
                                                <Dato
                                                    nombre="Accés assignat"
                                                    valor={
                                                        asignacion.acceso === true
                                                            ? "Sí"
                                                            : asignacion.acceso === false
                                                              ? "No"
                                                              : "No especificat"
                                                    }
                                                />
                                                <Dato
                                                    nombre="Rol al torneig"
                                                    valor={nombreRol(
                                                        asignacion.rol
                                                    )}
                                                />
                                            </dl>

                                            <TablaPermisos
                                                permisos={asignacion.permisos}
                                            />
                                        </>
                                    ) : (
                                        <p className="text-sm text-error">
                                            L’assignació no té un format vàlid.
                                        </p>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </Tarjeta>

            <details className="rounded-xl border border-border bg-card">
                <summary className="cursor-pointer p-4 text-sm font-semibold text-neutral-titulos">
                    Veure el JSON de permisos
                </summary>

                <pre className="max-h-120 overflow-auto border-t border-border p-4 text-xs text-neutral">
                    {JSON.stringify(documentoOrdenado ?? null, null, 2)}
                </pre>
            </details>
        </div>
    );
}

function Historial({
    usuarioID,
    vista,
    revision,
}: {
    usuarioID: string;
    vista: VistaRelacion;
    revision: number;
}) {
    const [pagina, setPagina] = useState(1);

    const parametros = new URLSearchParams({
        id: usuarioID,
        vista,
        pagina: String(pagina),
    });

    const consulta = useConsulta<RespuestaRelacion>(
        `${API}?${parametros.toString()}`,
        revision
    );

    const configuracion = RELACIONES[vista];
    const datos = consulta.datos;

    useEffect(() => {
        if (datos && pagina > datos.totalPaginas) {
            setPagina(Math.max(1, datos.totalPaginas));
        }
    }, [datos, pagina]);

    function mostrarCelda(fila: Registro, columna: Columna): string {
        const valor = fila[columna.campo];

        if (columna.formato === "fecha") return fecha(valor);
        if (columna.formato === "rol") return nombreRol(valor);

        if (columna.campo === "origen_acceso") {
            if (valor === "global") return "Rol general";
            if (valor === "asignacion") return "Assignació al torneig";
        }

        if (columna.campo === "torneo_nombre" && !valor) {
            return texto(fila.torneo_id);
        }

        return texto(valor);
    }

    return (
        <Tarjeta titulo={configuracion.titulo}>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-3xl text-sm text-neutral">
                    {configuracion.descripcion}
                </p>

                <button
                    type="button"
                    className={BOTON}
                    onClick={consulta.recargar}
                    disabled={consulta.cargando}
                >
                    Actualitzar
                </button>
            </div>

            <div aria-busy={consulta.cargando}>
                {consulta.cargando ? (
                    <Cargando />
                ) : consulta.error ? (
                    <ErrorConsulta
                        mensaje={consulta.error}
                        estado={consulta.estadoError}
                        usuarioID={usuarioID}
                        reintentar={consulta.recargar}
                    />
                ) : datos && datos.filas.length > 0 ? (
                    <>
                        <div
                            className="overflow-x-auto"
                            tabIndex={0}
                            role="region"
                            aria-label={configuracion.titulo}
                        >
                            <table className="w-full min-w-162.5 text-left text-sm">
                                <thead className="border-b border-border bg-background text-xs text-neutral">
                                    <tr>
                                        {configuracion.columnas.map((columna) => (
                                            <th
                                                key={columna.campo}
                                                scope="col"
                                                className="px-3 py-3"
                                            >
                                                {columna.nombre}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border">
                                    {datos.filas.map((fila, indice) => (
                                        <tr
                                            key={
                                                typeof fila.id === "string"
                                                    ? fila.id
                                                    : indice
                                            }
                                            className="hover:bg-primary/5"
                                        >
                                            {configuracion.columnas.map(
                                                (columna) => (
                                                    <td
                                                        key={columna.campo}
                                                        className="max-w-80 wrap-break-words px-3 py-3 text-neutral-titulos"
                                                    >
                                                        {mostrarCelda(
                                                            fila,
                                                            columna
                                                        )}
                                                    </td>
                                                )
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <nav
                            className="mt-5 flex flex-wrap items-center justify-between gap-3"
                            aria-label={`Paginació: ${configuracion.titulo}`}
                        >
                            <p className="text-xs text-neutral" role="status">
                                {datos.total} registres · Pàgina{" "}
                                {datos.pagina} de {datos.totalPaginas}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    className={BOTON}
                                    disabled={pagina <= 1}
                                    onClick={() =>
                                        setPagina((valor) =>
                                            Math.max(1, valor - 1)
                                        )
                                    }
                                >
                                    Anterior
                                </button>

                                <button
                                    type="button"
                                    className={BOTON}
                                    disabled={pagina >= datos.totalPaginas}
                                    onClick={() =>
                                        setPagina((valor) =>
                                            Math.min(
                                                datos.totalPaginas,
                                                valor + 1
                                            )
                                        )
                                    }
                                >
                                    Següent
                                </button>
                            </div>
                        </nav>
                    </>
                ) : (
                    <p className="py-8 text-center text-sm text-neutral">
                        {configuracion.vacio}
                    </p>
                )}
            </div>
        </Tarjeta>
    );
}

export default function Detalle({
    usuarioID,
}: {
    usuarioID: string;
}) {
    const [seccion, setSeccion] = useState<Seccion>("datos");
    const [revision, setRevision] = useState(0);

    const [confirmacion, setConfirmacion] =
        useState<AccionBloqueo | null>(null);

    const [enviando, setEnviando] = useState(false);

    const [aviso, setAviso] = useState<{
        tipo: "correcto" | "error";
        mensaje: string;
    } | null>(null);

    const peticionAccion = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => peticionAccion.current?.abort();
    }, []);

    const consulta = useConsulta<RespuestaDetalle>(
        `${API}?${new URLSearchParams({ id: usuarioID }).toString()}`,
        revision
    );

    const usuario = consulta.datos?.usuario;
    const capacidades = consulta.datos?.capacidades;

    function actualizarFicha() {
        setConfirmacion(null);
        setRevision((valor) => valor + 1);
    }

    async function ejecutarAccion() {
        if (!confirmacion || enviando) return;

        const accion = confirmacion;
        const controlador = new AbortController();

        peticionAccion.current = controlador;

        setEnviando(true);
        setAviso(null);

        try {
            const resultado = await pedirJSON<{
                success: boolean;
                mensaje: string;
            }>(API, {
                method: "POST",
                signal: controlador.signal,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    id: usuarioID,
                    accion,
                }),
            });

            if (controlador.signal.aborted) return;

            setAviso({
                tipo: "correcto",
                mensaje: resultado.mensaje,
            });
        } catch (err) {
            if (controlador.signal.aborted) return;

            setAviso({
                tipo: "error",
                mensaje:
                    err instanceof Error
                        ? err.message
                        : "No s'ha pogut completar l'operació.",
            });
        } finally {
            if (!controlador.signal.aborted) {
                setEnviando(false);
                setConfirmacion(null);

                // También actualiza después de errores:
                // el servidor puede haber bloqueado el usuario
                // aunque no haya completado la revocación.
                setRevision((valor) => valor + 1);
            }

            if (peticionAccion.current === controlador) {
                peticionAccion.current = null;
            }
        }
    }

    return (
        <div className="flex w-full min-w-0 flex-col gap-5">
            {aviso && (
                <div
                    role={aviso.tipo === "error" ? "alert" : "status"}
                    className={`rounded-lg border p-4 text-sm ${
                        aviso.tipo === "error"
                            ? "border-error/25 bg-error/10 text-error"
                            : "border-primary/25 bg-primary/10 text-primary"
                    }`}
                >
                    {aviso.mensaje}
                </div>
            )}

            {consulta.cargando ? (
                <div className="rounded-xl border border-border bg-card">
                    <Cargando />
                </div>
            ) : consulta.error ? (
                <div className="rounded-xl border border-border bg-card">
                    <ErrorConsulta
                        mensaje={consulta.error}
                        estado={consulta.estadoError}
                        usuarioID={usuarioID}
                        reintentar={consulta.recargar}
                    />
                </div>
            ) : usuario && capacidades ? (
                <>
                    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-5">
                            <div className="min-w-0">
                                <h2 className="wrap-break-words text-xl font-bold text-neutral-titulos">
                                    {nombreCompleto(usuario)}
                                </h2>

                                <p className="mt-1 break-all text-sm text-neutral">
                                    {usuario.email || "Sense correu electrònic"}
                                </p>

                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <EstadoCuenta activa={usuario.activa} />

                                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-neutral">
                                        {nombreRol(usuario.rol)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={actualizarFicha}
                                    disabled={enviando}
                                    className={BOTON}
                                >
                                    Actualitzar
                                </button>

                                {capacidades.bloquear && (
                                    <button
                                        type="button"
                                        disabled={enviando}
                                        onClick={() =>
                                            setConfirmacion("bloquear")
                                        }
                                        className="rounded-lg border border-error/30 bg-error/10 px-4 py-2.5 text-sm font-semibold text-error transition hover:bg-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {usuario.activa === false
                                            ? "Revocar sessions"
                                            : "Bloquejar usuari"}
                                    </button>
                                )}

                                {capacidades.desbloquear &&
                                    usuario.activa !== true && (
                                        <button
                                            type="button"
                                            disabled={enviando}
                                            onClick={() =>
                                                setConfirmacion("desbloquear")
                                            }
                                            className={BOTON}
                                        >
                                            {usuario.activa === false
                                                ? "Desbloquejar usuari"
                                                : "Activar compte"}
                                        </button>
                                    )}
                            </div>
                        </div>

                        {confirmacion && (
                            <div
                                className="mt-5 rounded-lg border border-border bg-background p-4"
                                role="region"
                                aria-labelledby="confirmacio-compte"
                                aria-busy={enviando}
                            >
                                <h3
                                    id="confirmacio-compte"
                                    className="font-semibold text-neutral-titulos"
                                >
                                    {confirmacion === "bloquear"
                                        ? usuario.activa === false
                                            ? "Revocar les sessions del compte bloquejat?"
                                            : "Bloquejar aquest usuari?"
                                        : "Activar l’accés d’aquest usuari?"}
                                </h3>

                                <p className="mt-2 text-sm text-neutral">
                                    {confirmacion === "bloquear"
                                        ? "El compte quedarà bloquejat i es revocaran les sessions actives. L’usuari no podrà iniciar sessió."
                                        : "L’usuari podrà tornar a iniciar sessió. Les sessions anteriors es revocaran i no es recuperaran."}
                                </p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={enviando}
                                        onClick={() => void ejecutarAccion()}
                                        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {enviando
                                            ? "Processant..."
                                            : "Confirmar"}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={enviando}
                                        onClick={() => setConfirmacion(null)}
                                        className={BOTON}
                                    >
                                        Cancel·lar
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    <nav
                        className="flex flex-wrap gap-2"
                        aria-label="Apartats de la fitxa"
                    >
                        {SECCIONES.map((opcion) => (
                            <button
                                key={opcion.id}
                                type="button"
                                aria-pressed={seccion === opcion.id}
                                disabled={enviando}
                                onClick={() => setSeccion(opcion.id)}
                                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                                    seccion === opcion.id
                                        ? "border-primary/30 bg-primary/10 text-primary"
                                        : "border-border bg-card text-neutral hover:bg-primary/5"
                                }`}
                            >
                                {opcion.nombre}
                            </button>
                        ))}
                    </nav>

                    {seccion === "datos" ? (
                        <DatosCuenta usuario={usuario} />
                    ) : seccion === "permisos" ? (
                        <PermisosUsuario usuario={usuario} />
                    ) : (
                        <Historial
                            key={`${usuarioID}/${seccion}`}
                            usuarioID={usuarioID}
                            vista={seccion}
                            revision={revision}
                        />
                    )}
                </>
            ) : (
                <p className="text-sm text-error" role="alert">
                    No s’ha pogut interpretar la fitxa de l’usuari.
                </p>
            )}
        </div>
    );
}