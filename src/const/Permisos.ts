// ============================================================
// ROLES
// ============================================================

// El origen manual o del sistema no cambia el nivel del rol.
export const NIVELES_ROL = {
    voluntario: 1,
    staff: 2,
    admintorneo: 3,
    admin: 4,
    desarrollador: 5,
} as const;

export type Rol = keyof typeof NIVELES_ROL;

export const NOMBRES_ROL: Record<Rol, string> = {
    voluntario: "Voluntari",
    staff: "Staff",
    admintorneo: "Administrador de torneig",
    admin: "Administrador",
    desarrollador: "Desenvolupador",
};

export const ROLES_ORDENADOS: Rol[] = [
    "voluntario",
    "staff",
    "admintorneo",
    "admin",
    "desarrollador",
];

export type OrigenPermisos = "manual" | "sistema";

export function normalizarRol(valor: unknown): Rol | null {
    if (typeof valor !== "string") return null;

    const rol = valor.trim().toLowerCase();

    return Object.hasOwn(NIVELES_ROL, rol)
        ? (rol as Rol)
        : null;
}

export function obtenerNivelRol(valor: unknown): number {
    const rol = normalizarRol(valor);

    return rol ? NIVELES_ROL[rol] : 0;
}

// ============================================================
// NIVELES MÍNIMOS
// ============================================================

export type ReglaNivel = {
    nivel: number;
    acciones?: Record<string, number>;
};

// Se conservan los niveles actuales.
// Las acciones sin nivel específico heredan el nivel de su sección.
export const NIVELES_PERMISOS: Record<string, ReglaNivel> = {
    panell: { nivel: 0 },

    tornejos: {
        nivel: 0,
        acciones: {
            crear: 2,
            editar: 2,
            eliminar: 4,
        },
    },

    equips: { nivel: 0 },
    pistes: { nivel: 0 },
    alumnes: { nivel: 0 },
    partits: { nivel: 0 },
    usuaris: { nivel: 0 },
    edicions: { nivel: 0 },
    noticies: { nivel: 0 },
    permisos: { nivel: 0 },
    voluntaris: { nivel: 0 },
    "acta-digital": { nivel: 0 },
    designacions: { nivel: 0 },
    "historial-jugadors": { nivel: 0 },
    configuracio: { nivel: 0 },

    competicio: { nivel: 2 },
    classificacions: { nivel: 2 },
    "configuracio-edicio": { nivel: 3 },
};

// ============================================================
// CATÁLOGO DE SECCIONES Y ACCIONES
// ============================================================

export type AmbitoPermisos = "general" | "torneo";

export type SeccionPermisos = {
    id: string;
    nombre: string;
    acciones: readonly string[];
};

// Este catálogo servirá también para construir las slides.
// Las acciones aquí declaradas son las reconocidas por el sistema.
export const SECCIONES_GENERALES: readonly SeccionPermisos[] = [
    {
        id: "panell",
        nombre: "Accés al panell",
        acciones: ["ver"],
    },
    {
        id: "tornejos",
        nombre: "Tornejos",
        acciones: ["ver", "crear"],
    },
    {
        id: "usuaris",
        nombre: "Gestió d’usuaris",
        acciones: ["ver", "bloquear", "desbloquear"],
    },
    {
        id: "permisos",
        nombre: "Gestió de permisos",
        acciones: ["ver", "crear", "editar", "eliminar"],
    },
    {
        id: "configuracio",
        nombre: "Configuració de la plataforma",
        acciones: ["ver", "editar"],
    },
];

export const SECCIONES_TORNEO: readonly SeccionPermisos[] = [
    {
        id: "panell",
        nombre: "Inici del torneig",
        acciones: ["ver"],
    },
    {
        id: "tornejos",
        nombre: "Informació del torneig",
        acciones: ["ver", "editar", "eliminar"],
    },
    {
        id: "edicions",
        nombre: "Edicions",
        acciones: ["ver", "crear", "editar", "eliminar"],
    },
    {
        id: "permisos",
        nombre: "Organització i permisos",
        acciones: ["ver", "asignar", "editar", "revocar"],
    },
    {
        id: "voluntaris",
        nombre: "Voluntaris",
        acciones: ["ver", "crear", "editar", "eliminar"],
    },
    {
        id: "equips",
        nombre: "Equips i participants",
        acciones: [
            "ver",
            "crear",
            "editar",
            "evaluar",
            "canviar-estat",
            "eliminar",
        ],
    },
    {
        id: "competicio",
        nombre: "Format de competició",
        acciones: ["ver", "editar"],
    },
    {
        id: "partits",
        nombre: "Calendari i resultats",
        acciones: ["ver", "crear", "editar", "eliminar"],
    },
    {
        id: "classificacions",
        nombre: "Classificacions",
        acciones: ["ver"],
    },
    {
        id: "configuracio-edicio",
        nombre: "Configuració de l’edició",
        acciones: ["ver", "editar"],
    },
];

// Se conservan para reconocer los permisos anteriores.
// No aparecerán como slides mientras no estén en el catálogo superior.
const SECCIONES_COMPATIBLES: readonly SeccionPermisos[] = [
    {
        id: "pistes",
        nombre: "Pistes",
        acciones: ["ver"],
    },
    {
        id: "alumnes",
        nombre: "Alumnes",
        acciones: ["ver", "exportar"],
    },
    {
        id: "noticies",
        nombre: "Notícies",
        acciones: ["ver", "crear", "editar", "eliminar"],
    },
    {
        id: "acta-digital",
        nombre: "Acta digital",
        acciones: ["ver", "editar"],
    },
    {
        id: "designacions",
        nombre: "Designacions",
        acciones: ["ver"],
    },
    {
        id: "historial-jugadors",
        nombre: "Historial de jugadors",
        acciones: ["ver", "editar", "exportar"],
    },
];

export const NOMBRES_ACCIONES: Record<string, string> = {
    ver: "Consultar",
    crear: "Crear",
    editar: "Editar",
    eliminar: "Eliminar",
    bloquear: "Bloquejar",
    desbloquear: "Desbloquejar",
    asignar: "Assignar",
    revocar: "Revocar",
    evaluar: "Avaluar",
    exportar: "Exportar",
    "canviar-estat": "Canviar l’estat",
};

export function obtenerSecciones(
    ambito: AmbitoPermisos
): readonly SeccionPermisos[] {
    return ambito === "general"
        ? SECCIONES_GENERALES
        : SECCIONES_TORNEO;
}

function accionReconocida(
    ambito: AmbitoPermisos,
    seccion: string,
    accion: string
): boolean {
    const configuracion = obtenerSecciones(ambito).find(
        (item) => item.id === seccion
    );

    if (configuracion) {
        return configuracion.acciones.includes(accion);
    }

    // Compatibilidad con secciones anteriores de torneo.
    if (ambito === "torneo") {
        return SECCIONES_COMPATIBLES.some(
            (item) =>
                item.id === seccion &&
                item.acciones.includes(accion)
        );
    }

    return false;
}

export function obtenerNivelRequerido(
    seccion: string,
    accion = "ver"
): number {
    if (!Object.hasOwn(NIVELES_PERMISOS, seccion)) {
        return Number.POSITIVE_INFINITY;
    }

    const regla = NIVELES_PERMISOS[seccion];

    if (
        regla.acciones &&
        Object.hasOwn(regla.acciones, accion)
    ) {
        return regla.acciones[accion];
    }

    return regla.nivel;
}

// ============================================================
// ESTRUCTURA GUARDADA EN users.permisos
// ============================================================

export type AccionesPermisos = Record<string, boolean>;

export type PermisosAmbito = Record<
    string,
    AccionesPermisos
>;

export type ConfiguracionTodosTorneos = {
    todos: boolean;
    rol: Rol | null;
    permisos: PermisosAmbito;
};

export type AsignacionTorneo = {
    acceso: boolean;
    rol: Rol | null;
    permisos: PermisosAmbito;
};

export type DocumentoPermisos = {
    version: 1;
    ultima_actualizacion: string;
    globales: PermisosAmbito;
    acceso_torneos: ConfiguracionTodosTorneos;
    torneos: Record<string, AsignacionTorneo>;
};

export type UsuarioPermisos = {
    rol?: string | null;
    permisos?: unknown;
    activa?: boolean | null;
} | null | undefined;

type Registro = Record<string, unknown>;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esRegistro(valor: unknown): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

/**
 * Una cuenta expresamente inactiva no puede acceder.
 *
 * Se admite activa ausente porque algunos consumidores de
 * estas funciones solo reciben rol y permisos.
 */
function cuentaDisponible(usuario: UsuarioPermisos): boolean {
    if (!usuario) return false;

    if (
        usuario.activa !== undefined &&
        usuario.activa !== true
    ) {
        return false;
    }

    return true;
}

function esDocumentoEstructurado(documento: Registro): boolean {
    return (
        Object.hasOwn(documento, "version") ||
        Object.hasOwn(documento, "globales") ||
        Object.hasOwn(documento, "acceso_torneos") ||
        Object.hasOwn(documento, "torneos")
    );
}

/**
 * undefined: no hay excepciones guardadas.
 * null: configuración mal formada.
 *
 * Admite temporalmente el JSON plano anterior.
 */
function obtenerGlobales(usuario: UsuarioPermisos): unknown {
    const documento = usuario?.permisos;

    if (documento === undefined || documento === null) {
        return undefined;
    }

    if (!esRegistro(documento)) return null;

    if (esDocumentoEstructurado(documento)) {
        return Object.hasOwn(documento, "globales")
            ? documento.globales
            : undefined;
    }

    return documento;
}

/**
 * Si falta la sección o acción, devuelve true.
 * Si está presente, solo acepta un booleano true.
 *
 * El nivel se comprueba por separado, antes de utilizarlo.
 */
function valorPermiso(
    ambito: unknown,
    seccion: string,
    accion: string
): boolean {
    if (ambito === undefined) return true;

    if (!esRegistro(ambito)) return false;

    if (!Object.hasOwn(ambito, seccion)) return true;

    const acciones = ambito[seccion];

    if (!esRegistro(acciones)) return false;

    if (!Object.hasOwn(acciones, accion)) return true;

    return acciones[accion] === true;
}

// ============================================================
// ACCESO GENERAL AL PANEL
// ============================================================

function puedeEntrarPanel(usuario: UsuarioPermisos): boolean {
    if (!cuentaDisponible(usuario)) return false;

    const rol = normalizarRol(usuario?.rol);

    // Un usuario sin rol administrativo asignado no entra,
    // aunque el nivel de panell esté temporalmente a 0.
    if (!rol) return false;

    if (
        NIVELES_ROL[rol] <
        obtenerNivelRequerido("panell", "ver")
    ) {
        return false;
    }

    return valorPermiso(
        obtenerGlobales(usuario),
        "panell",
        "ver"
    );
}

// ============================================================
// RESOLUCIÓN DEL CONTEXTO DE UN TORNEO
// ============================================================

export type ContextoTorneo = {
    rol: Rol;
    permisos: unknown;
    origen: "todos" | "individual";
};

/**
 * No consulta la base de datos ni comprueba la existencia del torneo.
 * El layout o la API deben realizar esa comprobación.
 */
export function obtenerContextoTorneo(
    usuario: UsuarioPermisos,
    torneoID: string
): ContextoTorneo | null {
    if (!puedeEntrarPanel(usuario)) return null;

    if (!UUID.test(torneoID)) return null;

    const documento = usuario?.permisos;

    if (!esRegistro(documento)) return null;

    const id = torneoID.toLowerCase();

    // Si existe torneos, tiene que ser un objeto válido.
    if (
        Object.hasOwn(documento, "torneos") &&
        !esRegistro(documento.torneos)
    ) {
        return null;
    }

    const asignaciones = esRegistro(documento.torneos)
        ? documento.torneos
        : {};

    // Se admiten temporalmente UUID guardados con mayúsculas.
    const clave = Object.keys(asignaciones).find(
        (valor) => valor.toLowerCase() === id
    );

    /*
     * Una asignación individual tiene prioridad.
     * acceso:false impide recurrir a la configuración de "todos".
     */
    if (clave !== undefined) {
        const asignacion = asignaciones[clave];

        if (
            !esRegistro(asignacion) ||
            asignacion.acceso !== true
        ) {
            return null;
        }

        // Compatibilidad con asignaciones antiguas sin rol propio.
        // Si el campo existe pero es inválido, se deniega el acceso.
        const rol = Object.hasOwn(asignacion, "rol")
            ? normalizarRol(asignacion.rol)
            : normalizarRol(usuario?.rol);

        if (!rol) return null;

        return {
            rol,
            permisos: asignacion.permisos,
            origen: "individual",
        };
    }

    /*
     * Acceso dinámico: también sirve para torneos creados
     * después de guardar este documento.
     */
    const configuracionComun = documento.acceso_torneos;

    if (
        !esRegistro(configuracionComun) ||
        configuracionComun.todos !== true
    ) {
        return null;
    }

    const rol = normalizarRol(configuracionComun.rol);

    if (!rol) return null;

    return {
        rol,
        permisos: configuracionComun.permisos,
        origen: "todos",
    };
}

export function tieneAccesoTorneo(
    usuario: UsuarioPermisos,
    torneoID: string
): boolean {
    return obtenerContextoTorneo(usuario, torneoID) !== null;
}

export function obtenerRolEnTorneo(
    usuario: UsuarioPermisos,
    torneoID: string
): Rol | null {
    return obtenerContextoTorneo(usuario, torneoID)?.rol ?? null;
}

// ============================================================
// COMPROBACIÓN DE PERMISOS
// ============================================================

export function tienePermiso(
    usuario: UsuarioPermisos,
    seccion: string,
    accion = "ver",
    torneoID?: string
): boolean {
    if (!puedeEntrarPanel(usuario)) return false;

    const ambito: AmbitoPermisos =
        torneoID === undefined ? "general" : "torneo";

    if (!accionReconocida(ambito, seccion, accion)) {
        return false;
    }

    let rol: Rol | null;
    let permisos: unknown;

    if (torneoID !== undefined) {
        const contexto = obtenerContextoTorneo(
            usuario,
            torneoID
        );

        if (!contexto) return false;

        rol = contexto.rol;
        permisos = contexto.permisos;

        // El acceso al panel del torneo también es una puerta de entrada.
        if (
            NIVELES_ROL[rol] <
                obtenerNivelRequerido("panell", "ver") ||
            !valorPermiso(permisos, "panell", "ver")
        ) {
            return false;
        }
    } else {
        rol = normalizarRol(usuario?.rol);
        permisos = obtenerGlobales(usuario);
    }

    if (!rol) return false;

    if (
        NIVELES_ROL[rol] <
        obtenerNivelRequerido(seccion, accion)
    ) {
        return false;
    }

    // Un false explícito se respeta aunque el nivel sea superior.
    return valorPermiso(permisos, seccion, accion);
}

// ============================================================
// CONSTRUCCIÓN DE TODOS LOS BOOLEANOS DEL ÁMBITO
// ============================================================

/**
 * Genera todas las secciones y acciones del catálogo.
 *
 * - Si el nivel no alcanza: false.
 * - Si existe un booleano guardado: conserva ese valor.
 * - Si no existe y el nivel alcanza: true.
 *
 * No añade claves desconocidas procedentes del cliente.
 */
export function completarPermisosAmbito(
    ambito: AmbitoPermisos,
    rol: Rol | null,
    existentes?: PermisosAmbito
): PermisosAmbito {
    const resultado: PermisosAmbito = {};

    for (const seccion of obtenerSecciones(ambito)) {
        const acciones: AccionesPermisos = {};

        for (const accion of seccion.acciones) {
            const alcanzaNivel =
                rol !== null &&
                NIVELES_ROL[rol] >=
                    obtenerNivelRequerido(seccion.id, accion);

            const guardado = existentes?.[seccion.id]?.[accion];

            acciones[accion] = alcanzaNivel
                ? typeof guardado === "boolean"
                    ? guardado
                    : true
                : false;
        }

        resultado[seccion.id] = acciones;
    }

    /*
     * Si ya había secciones antiguas reconocidas,
     * las conserva para no perder su configuración.
     */
    if (ambito === "torneo") {
        for (const seccion of SECCIONES_COMPATIBLES) {
            if (
                !existentes ||
                !Object.hasOwn(existentes, seccion.id)
            ) {
                continue;
            }

            const acciones: AccionesPermisos = {};

            for (const accion of seccion.acciones) {
                const alcanzaNivel =
                    rol !== null &&
                    NIVELES_ROL[rol] >=
                        obtenerNivelRequerido(seccion.id, accion);

                const guardado = existentes[seccion.id]?.[accion];

                acciones[accion] = alcanzaNivel
                    ? typeof guardado === "boolean"
                        ? guardado
                        : true
                    : false;
            }

            resultado[seccion.id] = acciones;
        }
    }

    return resultado;
}

// ============================================================
// CÁLCULO DE users.rol
// ============================================================

export function calcularRolMinimo(
    documento: Pick<
        DocumentoPermisos,
        "acceso_torneos" | "torneos"
    >
): Rol | null {
    const roles: Rol[] = [];

    if (documento.acceso_torneos.todos) {
        const rolComun = normalizarRol(
            documento.acceso_torneos.rol
        );

        if (!rolComun) {
            throw new Error(
                "El acceso a todos los torneos necesita un rol válido."
            );
        }

        roles.push(rolComun);
    }

    for (const asignacion of Object.values(documento.torneos)) {
        // Los torneos sin acceso no intervienen en el mínimo.
        if (!asignacion.acceso) continue;

        const rol = normalizarRol(asignacion.rol);

        if (!rol) {
            throw new Error(
                "Cada torneo con acceso necesita un rol válido."
            );
        }

        roles.push(rol);
    }

    if (roles.length === 0) return null;

    return roles.reduce((menor, actual) =>
        NIVELES_ROL[actual] < NIVELES_ROL[menor]
            ? actual
            : menor
    );
}

// ============================================================
// DOCUMENTO INICIAL
// ============================================================

/**
 * Crea un borrador sin acceso.
 * No escribe en la base de datos.
 */
export function crearDocumentoPermisos(): DocumentoPermisos {
    return {
        version: 1,
        ultima_actualizacion: new Date().toISOString(),

        globales: completarPermisosAmbito(
            "general",
            null
        ),

        acceso_torneos: {
            todos: false,
            rol: null,
            permisos: completarPermisosAmbito(
                "torneo",
                null
            ),
        },

        torneos: {},
    };
}

/**
 * Prepara un documento ya validado para guardarlo.
 *
 * La API será responsable de:
 * - Validar el JSON recibido.
 * - Comprobar quién puede modificarlo.
 * - Impedir conceder privilegios no autorizados.
 * - Comprobar que los torneos existen.
 *
 * Esta función no sustituye esas comprobaciones.
 */
export function prepararDocumentoPermisos(
    documento: DocumentoPermisos
): {
    rol: Rol | null;
    permisos: DocumentoPermisos;
} {
    const rolMinimo = calcularRolMinimo(documento);

    const torneos: Record<string, AsignacionTorneo> = {};

    for (const [idOriginal, asignacion] of Object.entries(
        documento.torneos
    )) {
        if (!UUID.test(idOriginal)) {
            throw new Error(
                "Hay un identificador de torneo no válido."
            );
        }

        const id = idOriginal.toLowerCase();

        if (Object.hasOwn(torneos, id)) {
            throw new Error(
                "El mismo torneo aparece más de una vez."
            );
        }

        const rol = normalizarRol(asignacion.rol);

        torneos[id] = {
            acceso: asignacion.acceso,
            rol,
            permisos: completarPermisosAmbito(
                "torneo",
                asignacion.acceso ? rol : null,
                asignacion.permisos
            ),
        };
    }

    const rolComun = normalizarRol(
        documento.acceso_torneos.rol
    );

    return {
        rol: rolMinimo,

        permisos: {
            version: 1,
            ultima_actualizacion: new Date().toISOString(),

            globales: completarPermisosAmbito(
                "general",
                rolMinimo,
                documento.globales
            ),

            acceso_torneos: {
                todos: documento.acceso_torneos.todos,
                rol: rolComun,
                permisos: completarPermisosAmbito(
                    "torneo",
                    documento.acceso_torneos.todos
                        ? rolComun
                        : null,
                    documento.acceso_torneos.permisos
                ),
            },

            torneos,
        },
    };
}