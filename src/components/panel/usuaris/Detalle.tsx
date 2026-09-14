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

type IconoNombre =
    | "usuario"
    | "identidad"
    | "escudo"
    | "trofeo"
    | "calendario"
    | "sesiones"
    | "verificacion"
    | "correo"
    | "estudios"
    | "reloj"
    | "actualizar"
    | "bloquear"
    | "desbloquear"
    | "flecha"
    | "codigo"
    | "equipo"
    | "formulario";

type Columna = {
    campo: string;
    nombre: string;
    formato?: "fecha" | "rol";
};

const API = "/api/panell/usuaris";

const SUPERFICIE =
    "rounded-2xl border border-border/40 bg-white " +
    "shadow-[0_2px_12px_rgba(15,23,42,0.025)] " +
    "[.oscuro_&]:bg-card";

const CAMPO =
    "min-h-10 rounded-lg bg-[#eef3ff] px-3 py-2.5 " +
    "text-sm font-medium text-neutral-titulos " +
    "[.oscuro_&]:bg-background";

const BOTON =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border/50 bg-white px-3 py-2 text-xs " +
    "font-semibold text-neutral-titulos transition " +
    "hover:border-primary/25 hover:bg-primary/5 " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-primary disabled:cursor-not-allowed " +
    "disabled:opacity-50 [.oscuro_&]:bg-card";

const BOTON_PRINCIPAL =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "bg-primary px-4 py-2.5 text-xs font-semibold text-white " +
    "transition hover:opacity-90 focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-primary " +
    "focus-visible:ring-offset-2 disabled:cursor-not-allowed " +
    "disabled:opacity-50";

const ROLES: Record<string, string> = {
    voluntario: "Voluntari",
    staff: "Staff",
    admintorneo: "Administrador de torneig",
    admin: "Administrador",
    desarrollador: "Desenvolupador",
};

const SECCIONES: {
    id: Seccion;
    nombre: string;
    icono: IconoNombre;
}[] = [
    { id: "datos", nombre: "Dades del perfil", icono: "identidad" },
    { id: "permisos", nombre: "Permisos", icono: "escudo" },
    { id: "torneos", nombre: "Tornejos", icono: "trofeo" },
    { id: "ediciones", nombre: "Edicions", icono: "calendario" },
    { id: "sesiones", nombre: "Sessions", icono: "sesiones" },
    {
        id: "verificaciones",
        nombre: "Verificacions",
        icono: "verificacion",
    },
];

const RELACIONES: Record<
    VistaRelacion,
    {
        titulo: string;
        descripcion: string;
        vacio: string;
        icono: IconoNombre;
        columnas: Columna[];
    }
> = {
    torneos: {
        titulo: "Tornejos accessibles",
        descripcion:
            "Accés pel rol general o per assignació. " +
            "No implica participació en el torneig.",
        vacio: "No s'han trobat tornejos accessibles.",
        icono: "trofeo",
        columnas: [
            { campo: "nombre", nombre: "Torneig" },
            { campo: "deporte", nombre: "Esport" },
            { campo: "activo", nombre: "Actiu" },
            { campo: "rol_acceso", nombre: "Rol", formato: "rol" },
            { campo: "origen_acceso", nombre: "Origen de l’accés" },
        ],
    },
    ediciones: {
        titulo: "Edicions dels tornejos",
        descripcion:
            "Edicions dels tornejos accessibles. Encara no hi ha " +
            "una vinculació directa de participació amb l’usuari.",
        vacio: "No s'han trobat edicions.",
        icono: "calendario",
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
        titulo: "Seguretat i sessions",
        descripcion:
            "Sessions registrades i vigència en el moment de la consulta. " +
            "No es mostren els tokens.",
        vacio: "Aquest usuari no té sessions registrades.",
        icono: "sesiones",
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
        titulo: "Verificacions del compte",
        descripcion:
            "Historial de verificacions, sense mostrar codis ni tokens.",
        vacio: "Aquest usuari no té verificacions registrades.",
        icono: "verificacion",
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

function Icono({
    nombre,
    className = "h-4 w-4",
}: {
    nombre: IconoNombre;
    className?: string;
}) {
    const dibujos: Record<IconoNombre, ReactNode> = {
        usuario: (
            <>
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </>
        ),
        identidad: (
            <>
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="8" cy="10" r="2" />
                <path d="M5.5 16a2.5 2.5 0 0 1 5 0M14 9h4M14 13h4M14 16h2" />
            </>
        ),
        escudo: (
            <>
                <path d="m12 3 8 3v6c0 4-3 7-8 9-5-2-8-5-8-9V6l8-3Z" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
            </>
        ),
        trofeo: (
            <>
                <path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M10 18h4v3h-4z" />
            </>
        ),
        calendario: (
            <>
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2" />
            </>
        ),
        sesiones: (
            <>
                <rect x="3" y="4" width="18" height="13" rx="2" />
                <path d="M8 21h8M12 17v4M8 10l2 2 5-5" />
            </>
        ),
        verificacion: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12 3 3 5-6" />
            </>
        ),
        correo: (
            <>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
            </>
        ),
        estudios: (
            <>
                <path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6c4 3 8 3 12 0v-6M22 9v7" />
            </>
        ),
        reloj: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
            </>
        ),
        actualizar: (
            <>
                <path d="M20 7v5h-5M4 17v-5h5" />
                <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
            </>
        ),
        bloquear: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="m6 6 12 12" />
            </>
        ),
        desbloquear: (
            <>
                <rect x="5" y="10" width="14" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 7.5-2M12 14v3" />
            </>
        ),
        flecha: <path d="m9 5 7 7-7 7" />,
        codigo: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
        equipo: (
            <>
                <circle cx="9" cy="8" r="3" />
                <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M17 15a5 5 0 0 1 4 5v1" />
            </>
        ),
        formulario: (
            <>
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 4V2h6v2M9 9h6M9 13h6M9 17h3" />
            </>
        ),
    };

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`shrink-0 ${className}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {dibujos[nombre]}
        </svg>
    );
}

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

    if (typeof valor === "boolean") return valor ? "Sí" : "No";

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

function iniciales(usuario: Usuario): string {
    const partes = [
        usuario.nombre,
        usuario.apellido1,
        usuario.apellido2,
    ]
        .map((parte) => parte?.trim())
        .filter((parte): parte is string => Boolean(parte));

    return partes
        .slice(0, 2)
        .map((parte) => Array.from(parte)[0])
        .join("")
        .toLocaleUpperCase("ca-ES") || "?";
}

async function pedirJSON<T>(
    url: string,
    opciones: RequestInit = {}
): Promise<T> {
    const headers = new Headers(opciones.headers);
    headers.set("Accept", "application/json");

    const respuesta = await fetch(url, {
        ...opciones,
        headers,
        cache: "no-store",
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
            className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-sm text-neutral"
            role="status"
        >
            <span
                className="h-7 w-7 animate-spin rounded-full border-2 border-primary/15 border-t-primary motion-reduce:animate-none"
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
        <div className="flex flex-col items-center gap-4 px-5 py-12 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-error/10 text-error">
                <Icono nombre="bloquear" className="h-5 w-5" />
            </span>

            <p className="max-w-lg text-sm text-error" role="alert">
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
    descripcion,
    icono,
    children,
    accion,
}: {
    titulo: string;
    descripcion?: string;
    icono: IconoNombre;
    children: ReactNode;
    accion?: ReactNode;
}) {
    return (
        <section className={`${SUPERFICIE} min-w-0 p-5 md:p-6`}>
            <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icono nombre={icono} />
                    </span>

                    <div className="min-w-0">
                        <h2 className="text-sm font-bold text-neutral-titulos">
                            {titulo}
                        </h2>

                        {descripcion && (
                            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-neutral">
                                {descripcion}
                            </p>
                        )}
                    </div>
                </div>

                {accion}
            </header>

            {children}
        </section>
    );
}

function CampoConsulta({
    nombre,
    valor,
    icono,
    className = "",
}: {
    nombre: string;
    valor: ReactNode;
    icono?: IconoNombre;
    className?: string;
}) {
    return (
        <div className={`min-w-0 ${className}`}>
            <dt className="mb-1.5 text-[11px] font-semibold text-neutral-titulos">
                {nombre}
            </dt>

            <dd className={`${CAMPO} flex items-start gap-2`}>
                {icono && (
                    <span className="mt-0.5 text-primary">
                        <Icono nombre={icono} className="h-3.5 w-3.5" />
                    </span>
                )}

                <span className="min-w-0 break-words">{valor}</span>
            </dd>
        </div>
    );
}

function EstadoCuenta({ activa }: { activa: boolean | null }) {
    const estilo =
        activa === true
            ? "bg-primary text-white"
            : activa === false
              ? "bg-error/10 text-error"
              : "bg-neutral/10 text-neutral";

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${estilo}`}
        >
            <span
                className="h-1.5 w-1.5 rounded-full bg-current"
                aria-hidden="true"
            />

            {activa === true
                ? "Compte actiu"
                : activa === false
                  ? "Compte bloquejat"
                  : "Sense estat"}
        </span>
    );
}

function NotaPendiente({
    titulo,
    texto: descripcion,
    icono,
}: {
    titulo: string;
    texto: string;
    icono: IconoNombre;
}) {
    return (
        <section className={`${SUPERFICIE} p-5`}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-neutral-titulos">
                    <Icono nombre={icono} className="h-4 w-4 text-primary" />
                    <h2 className="text-xs font-bold">{titulo}</h2>
                </div>

                <span className="rounded-md bg-background px-2 py-1 text-[10px] font-semibold text-neutral">
                    Pròximament
                </span>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-neutral">
                {descripcion}
            </p>
        </section>
    );
}

function DatosCuenta({ usuario }: { usuario: Usuario }) {
    return (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="flex min-w-0 flex-col gap-5">
                <Tarjeta
                    titulo="Fitxa d’identitat i curs"
                    descripcion="Dades personals i acadèmiques del compte."
                    icono="identidad"
                >
                    <dl className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
                        <CampoConsulta
                            nombre="Nom"
                            valor={texto(usuario.nombre)}
                        />
                        <CampoConsulta
                            nombre="Primer cognom"
                            valor={texto(usuario.apellido1)}
                        />
                        <CampoConsulta
                            nombre="Segon cognom"
                            valor={texto(usuario.apellido2)}
                        />
                        <CampoConsulta
                            nombre="Correu electrònic"
                            valor={
                                <span className="break-all">
                                    {texto(usuario.email)}
                                </span>
                            }
                            icono="correo"
                            className="lg:col-span-2"
                        />
                        <CampoConsulta
                            nombre="Rol general"
                            valor={nombreRol(usuario.rol)}
                            icono="escudo"
                        />
                        <CampoConsulta
                            nombre="Curs"
                            valor={texto(usuario.curso)}
                            icono="estudios"
                        />
                        <CampoConsulta
                            nombre="Any acadèmic"
                            valor={texto(usuario.ano_academico)}
                            icono="calendario"
                        />
                        <CampoConsulta
                            nombre="Origen dels permisos"
                            valor={texto(usuario.origen_permisos)}
                        />
                    </dl>
                </Tarjeta>

                <div className="grid gap-5 md:grid-cols-2">
                    <NotaPendiente
                        titulo="Equips i participants"
                        texto="Les vinculacions amb equips i els seus estats es mostraran quan aquesta funcionalitat estigui disponible."
                        icono="equipo"
                    />
                    <NotaPendiente
                        titulo="Formularis enviats"
                        texto="Els formularis enviats i les respostes es mostraran quan aquesta funcionalitat estigui disponible."
                        icono="formulario"
                    />
                </div>
            </div>

            <Tarjeta
                titulo="Auditoria del registre"
                icono="reloj"
            >
                <dl className="flex flex-col gap-4">
                    <CampoConsulta
                        nombre="Data de registre"
                        valor={fecha(usuario.fecha_creacion)}
                        icono="calendario"
                    />
                    <CampoConsulta
                        nombre="Última actualització"
                        valor={fecha(usuario.fecha_actualizacion)}
                        icono="reloj"
                    />

                    <div>
                        <dt className="mb-1.5 text-[11px] font-semibold text-neutral-titulos">
                            Estat del compte
                        </dt>
                        <dd className={`${CAMPO} flex items-center`}>
                            <EstadoCuenta activa={usuario.activa} />
                        </dd>
                    </div>

                    <CampoConsulta
                        nombre="Identificador de l’usuari"
                        valor={
                            <span className="break-all font-mono text-[11px]">
                                {usuario.id}
                            </span>
                        }
                    />
                </dl>
            </Tarjeta>
        </div>
    );
}

function TablaPermisos({ permisos }: { permisos: unknown }) {
    if (permisos === null || permisos === undefined) {
        return (
            <p className="rounded-lg bg-background p-4 text-xs text-neutral">
                No hi ha permisos explícits guardats en aquest àmbit.
            </p>
        );
    }

    if (!esRegistro(permisos)) {
        return (
            <p className="text-xs text-error">
                La configuració guardada no té un format vàlid.
            </p>
        );
    }

    const entradas = Object.entries(permisos);

    if (entradas.length === 0) {
        return (
            <p className="rounded-lg bg-background p-4 text-xs text-neutral">
                No hi ha permisos explícits guardats en aquest àmbit.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="bg-[#eef3ff] text-neutral [.oscuro_&]:bg-background">
                    <tr>
                        <th scope="col" className="px-4 py-3 font-semibold">
                            Secció
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                            Acció
                        </th>
                        <th scope="col" className="px-4 py-3 font-semibold">
                            Valor guardat
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-border/40">
                    {entradas.flatMap(([seccion, acciones]) => {
                        if (!esRegistro(acciones)) {
                            return [
                                <tr key={seccion}>
                                    <td className="px-4 py-3">{seccion}</td>
                                    <td className="px-4 py-3">—</td>
                                    <td className="px-4 py-3 text-error">
                                        Format no vàlid
                                    </td>
                                </tr>,
                            ];
                        }

                        if (Object.keys(acciones).length === 0) {
                            return [
                                <tr key={seccion}>
                                    <td className="px-4 py-3">{seccion}</td>
                                    <td
                                        colSpan={2}
                                        className="px-4 py-3 text-neutral"
                                    >
                                        Sense accions explícites
                                    </td>
                                </tr>,
                            ];
                        }

                        return Object.entries(acciones).map(
                            ([accion, valor]) => (
                                <tr
                                    key={`${seccion}/${accion}`}
                                    className="transition hover:bg-primary/[0.025]"
                                >
                                    <td className="px-4 py-3 font-semibold text-neutral-titulos">
                                        {seccion}
                                    </td>
                                    <td className="px-4 py-3 text-neutral">
                                        {accion}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex rounded-md px-2 py-1 text-[10px] font-bold ${
                                                valor === true
                                                    ? "bg-primary/10 text-primary"
                                                    : valor === false
                                                      ? "bg-error/10 text-error"
                                                      : "bg-neutral/10 text-neutral"
                                            }`}
                                        >
                                            {valor === true
                                                ? "Sí · true"
                                                : valor === false
                                                  ? "No · false"
                                                  : "Format no vàlid"}
                                        </span>
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
            <Tarjeta
                titulo="Permisos del compte"
                descripcion="Valors guardats. L’accés efectiu també depèn del nivell del rol i de l’assignació al torneig."
                icono="escudo"
            >
                <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <CampoConsulta
                        nombre="Rol general"
                        valor={nombreRol(usuario.rol)}
                    />
                    <CampoConsulta
                        nombre="Origen"
                        valor={texto(usuario.origen_permisos)}
                    />
                    <CampoConsulta
                        nombre="Versió del JSON"
                        valor={texto(documento?.version)}
                    />
                    <CampoConsulta
                        nombre="Última actualització dels permisos"
                        valor={fecha(documento?.ultima_actualizacion)}
                    />
                </dl>

                {documento && !estructurado && (
                    <p className="mt-4 rounded-lg bg-primary/5 p-3 text-xs leading-relaxed text-neutral">
                        Aquest compte conserva l’estructura antiga.
                        Encara no diferencia els permisos per torneig.
                    </p>
                )}

                {usuario.permisos !== null &&
                    usuario.permisos !== undefined &&
                    !documento && (
                        <p className="mt-4 text-xs text-error">
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
                icono="escudo"
            >
                <TablaPermisos permisos={globales} />
            </Tarjeta>

            <Tarjeta
                titulo="Assignacions per torneig"
                descripcion="Rol, accés i permisos específics guardats per a cada torneig."
                icono="trofeo"
            >
                {asignaciones.length === 0 ? (
                    <p className="rounded-lg bg-background p-4 text-xs leading-relaxed text-neutral">
                        No hi ha assignacions explícites guardades.
                        Els administradors i desenvolupadors poden tenir
                        accés general pel seu rol.
                    </p>
                ) : (
                    <div className="flex flex-col gap-3">
                        {asignaciones.map(([torneoID, asignacion]) => (
                            <details
                                key={torneoID}
                                className="group rounded-xl border border-border/40"
                            >
                                <summary className="cursor-pointer break-words rounded-xl bg-background/60 p-4 text-xs font-semibold text-neutral-titulos">
                                    Torneig · {torneoID}
                                </summary>

                                <div className="border-t border-border/40 p-4">
                                    {esRegistro(asignacion) ? (
                                        <>
                                            <dl className="mb-5 grid gap-4 sm:grid-cols-2">
                                                <CampoConsulta
                                                    nombre="Accés assignat"
                                                    valor={
                                                        asignacion.acceso === true
                                                            ? "Sí"
                                                            : asignacion.acceso === false
                                                              ? "No"
                                                              : "No especificat"
                                                    }
                                                />
                                                <CampoConsulta
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
                                        <p className="text-xs text-error">
                                            L’assignació no té un format vàlid.
                                        </p>
                                    )}
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </Tarjeta>

            <details className={SUPERFICIE}>
                <summary className="cursor-pointer p-5 text-xs font-semibold text-neutral-titulos">
                    Veure el JSON de permisos
                </summary>

                <pre className="max-h-[480px] overflow-auto border-t border-border/40 bg-background/50 p-5 text-xs leading-relaxed text-neutral">
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

    function mostrarCelda(
        fila: Registro,
        columna: Columna
    ): ReactNode {
        const valor = fila[columna.campo];

        if (columna.formato === "fecha") {
            return (
                <span className="whitespace-nowrap">
                    {fecha(valor)}
                </span>
            );
        }

        if (columna.formato === "rol") return nombreRol(valor);

        if (columna.campo === "origen_acceso") {
            if (valor === "global") return "Rol general";
            if (valor === "asignacion") return "Assignació";
        }

        if (columna.campo === "torneo_nombre" && !valor) {
            return texto(fila.torneo_id);
        }

        if (typeof valor === "boolean") {
            return (
                <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold ${
                        valor
                            ? "bg-primary/10 text-primary"
                            : "bg-neutral/10 text-neutral"
                    }`}
                >
                    <span
                        className="h-1 w-1 rounded-full bg-current"
                        aria-hidden="true"
                    />
                    {valor ? "Sí" : "No"}
                </span>
            );
        }

        return texto(valor);
    }

    return (
        <Tarjeta
            titulo={configuracion.titulo}
            descripcion={configuracion.descripcion}
            icono={configuracion.icono}
            accion={
                <button
                    type="button"
                    className={BOTON}
                    onClick={consulta.recargar}
                    disabled={consulta.cargando}
                >
                    <Icono nombre="actualizar" className="h-3.5 w-3.5" />
                    Actualitzar
                </button>
            }
        >
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
                            className="overflow-x-auto rounded-xl border border-border/40"
                            tabIndex={0}
                            role="region"
                            aria-label={configuracion.titulo}
                        >
                            <table className="w-full min-w-[650px] text-left text-xs">
                                <thead className="bg-[#eef3ff] text-neutral [.oscuro_&]:bg-background">
                                    <tr>
                                        {configuracion.columnas.map((columna) => (
                                            <th
                                                key={columna.campo}
                                                scope="col"
                                                className="px-4 py-3 font-semibold"
                                            >
                                                {columna.nombre}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-border/40">
                                    {datos.filas.map((fila, indice) => (
                                        <tr
                                            key={
                                                typeof fila.id === "string"
                                                    ? fila.id
                                                    : indice
                                            }
                                            className="transition hover:bg-primary/[0.025]"
                                        >
                                            {configuracion.columnas.map(
                                                (columna, posicion) => (
                                                    <td
                                                        key={columna.campo}
                                                        className={`max-w-80 break-words px-4 py-4 ${
                                                            posicion === 0
                                                                ? "font-semibold text-neutral-titulos"
                                                                : "text-neutral"
                                                        }`}
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
                            <p className="text-[11px] text-neutral" role="status">
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
                                    <Icono
                                        nombre="flecha"
                                        className="h-3 w-3"
                                    />
                                </button>
                            </div>
                        </nav>
                    </>
                ) : (
                    <div className="flex flex-col items-center rounded-xl bg-background/60 px-5 py-12 text-center">
                        <span className="mb-3 text-primary/60">
                            <Icono
                                nombre={configuracion.icono}
                                className="h-7 w-7"
                            />
                        </span>
                        <p className="text-xs text-neutral">
                            {configuracion.vacio}
                        </p>
                    </div>
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
        if (!confirmacion || peticionAccion.current) return;

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

                // Recarga también ante errores: el bloqueo puede
                // haberse aplicado aunque falle la revocación.
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
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-relaxed ${
                        aviso.tipo === "error"
                            ? "border-error/20 bg-error/10 text-error"
                            : "border-primary/20 bg-primary/10 text-primary"
                    }`}
                >
                    <Icono
                        nombre={
                            aviso.tipo === "error"
                                ? "bloquear"
                                : "verificacion"
                        }
                    />
                    {aviso.mensaje}
                </div>
            )}

            {consulta.cargando ? (
                <div className={SUPERFICIE}>
                    <Cargando />
                </div>
            ) : consulta.error ? (
                <div className={SUPERFICIE}>
                    <ErrorConsulta
                        mensaje={consulta.error}
                        estado={consulta.estadoError}
                        usuarioID={usuarioID}
                        reintentar={consulta.recargar}
                    />
                </div>
            ) : usuario && capacidades ? (
                <>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={actualizarFicha}
                            disabled={enviando}
                            className={BOTON}
                        >
                            <Icono
                                nombre="actualizar"
                                className="h-3.5 w-3.5"
                            />
                            Actualitzar
                        </button>

                        {capacidades.bloquear && (
                            <button
                                type="button"
                                disabled={enviando}
                                onClick={() =>
                                    setConfirmacion("bloquear")
                                }
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-error/10 bg-error/10 px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Icono
                                    nombre="bloquear"
                                    className="h-3.5 w-3.5"
                                />
                                {usuario.activa === false
                                    ? "Revocar sessions"
                                    : "Bloquejar compte"}
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
                                    className={BOTON_PRINCIPAL}
                                >
                                    <Icono
                                        nombre="desbloquear"
                                        className="h-3.5 w-3.5"
                                    />
                                    {usuario.activa === false
                                        ? "Desbloquejar compte"
                                        : "Activar compte"}
                                </button>
                            )}
                    </div>

                    {confirmacion && (
                        <section
                            className={`${SUPERFICIE} p-5`}
                            aria-labelledby="confirmacio-compte"
                            aria-busy={enviando}
                        >
                            <div className="flex items-start gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <Icono
                                        nombre={
                                            confirmacion === "bloquear"
                                                ? "bloquear"
                                                : "desbloquear"
                                        }
                                    />
                                </span>

                                <div>
                                    <h2
                                        id="confirmacio-compte"
                                        className="text-sm font-bold text-neutral-titulos"
                                    >
                                        {confirmacion === "bloquear"
                                            ? usuario.activa === false
                                                ? "Revocar les sessions del compte bloquejat?"
                                                : "Bloquejar aquest usuari?"
                                            : "Activar l’accés d’aquest usuari?"}
                                    </h2>

                                    <p className="mt-2 max-w-3xl text-xs leading-relaxed text-neutral">
                                        {confirmacion === "bloquear"
                                            ? "El compte quedarà bloquejat i es revocaran les sessions actives. L’usuari no podrà iniciar sessió."
                                            : "L’usuari podrà tornar a iniciar sessió. Les sessions anteriors es revocaran i no es recuperaran."}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={enviando}
                                    onClick={() => setConfirmacion(null)}
                                    className={BOTON}
                                >
                                    Cancel·lar
                                </button>

                                <button
                                    type="button"
                                    disabled={enviando}
                                    onClick={() => void ejecutarAccion()}
                                    className={BOTON_PRINCIPAL}
                                >
                                    {enviando ? "Processant..." : "Confirmar"}
                                </button>
                            </div>
                        </section>
                    )}

                    <section className={`${SUPERFICIE} relative overflow-hidden`}>
                        <div
                            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary/10"
                            aria-hidden="true"
                        />

                        <div className="relative flex flex-col gap-6 p-5 md:p-7 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-center">
                                <div className="relative w-fit shrink-0">
                                    <div
                                        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-3xl font-bold tracking-tight text-white shadow-sm md:h-24 md:w-24 md:text-4xl"
                                        aria-hidden="true"
                                    >
                                        {iniciales(usuario)}
                                    </div>

                                    <span
                                        className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-[3px] border-white [.oscuro_&]:border-card ${
                                            usuario.activa === true
                                                ? "bg-secondary"
                                                : usuario.activa === false
                                                  ? "bg-error"
                                                  : "bg-neutral"
                                        }`}
                                        aria-hidden="true"
                                    />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                        <h2 className="break-words text-xl font-bold tracking-tight text-neutral-titulos md:text-2xl">
                                            {nombreCompleto(usuario)}
                                        </h2>

                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/20 px-2.5 py-1 text-[10px] font-bold text-primary">
                                            <Icono
                                                nombre="escudo"
                                                className="h-3 w-3"
                                            />
                                            {nombreRol(usuario.rol)}
                                        </span>
                                    </div>

                                    <div className="mt-2">
                                        <EstadoCuenta activa={usuario.activa} />
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-neutral">
                                        <span className="inline-flex min-w-0 items-center gap-1.5">
                                            <Icono
                                                nombre="correo"
                                                className="h-3.5 w-3.5 text-primary"
                                            />
                                            <span className="break-all">
                                                {usuario.email ||
                                                    "Sense correu electrònic"}
                                            </span>
                                        </span>

                                        {usuario.curso && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Icono
                                                    nombre="estudios"
                                                    className="h-3.5 w-3.5 text-primary"
                                                />
                                                {usuario.curso}
                                            </span>
                                        )}

                                        {usuario.ano_academico && (
                                            <span className="inline-flex items-center gap-1.5">
                                                <Icono
                                                    nombre="calendario"
                                                    className="h-3.5 w-3.5 text-primary"
                                                />
                                                {usuario.ano_academico}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex min-w-0 items-start gap-2">
                                        <span className="pt-1 text-[9px] font-semibold uppercase tracking-wider text-neutral">
                                            UUID
                                        </span>

                                        <span className="min-w-0 break-all rounded bg-[#eef3ff] px-2 py-1 font-mono text-[10px] text-neutral [.oscuro_&]:bg-background">
                                            {usuario.id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:w-72">
                                <div className="rounded-xl bg-white/70 p-3 [.oscuro_&]:bg-background/60">
                                    <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-neutral">
                                        Data de registre
                                        <Icono
                                            nombre="calendario"
                                            className="h-3.5 w-3.5 text-primary"
                                        />
                                    </div>

                                    <p className="text-xs font-semibold text-neutral-titulos">
                                        {fecha(usuario.fecha_creacion)}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-white/70 p-3 [.oscuro_&]:bg-background/60">
                                    <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-neutral">
                                        Última actualització
                                        <Icono
                                            nombre="reloj"
                                            className="h-3.5 w-3.5 text-primary"
                                        />
                                    </div>

                                    <p className="text-xs font-semibold text-neutral-titulos">
                                        {fecha(usuario.fecha_actualizacion)}
                                    </p>
                                </div>
                            </div>
                        </div>
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
                                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 ${
                                    seccion === opcion.id
                                        ? "border-primary bg-primary text-white shadow-sm"
                                        : "border-border/30 bg-white text-neutral-titulos hover:border-primary/20 hover:bg-primary/5 in-[.oscuro_&]:bg-card"
                                }`}
                            >
                                <Icono
                                    nombre={opcion.icono}
                                    className="h-3.5 w-3.5"
                                />
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
                <div className={`${SUPERFICIE} p-5`}>
                    <p className="text-sm text-error" role="alert">
                        No s’ha pogut interpretar la fitxa de l’usuari.
                    </p>
                </div>
            )}
        </div>
    );
}