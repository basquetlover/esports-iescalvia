// ============================================================
// ROLES
// ============================================================

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

export const ROLES_ORDENADOS: readonly Rol[] = [
    "voluntario",
    "staff",
    "admintorneo",
    "admin",
    "desarrollador",
];

export type OrigenPermisos =
    | "manual"
    | "sistema";

export function normalizarRol(
    valor: unknown,
): Rol | null {
    if (typeof valor !== "string") {
        return null;
    }

    const rol =
        valor
            .trim()
            .toLowerCase();

    return Object.hasOwn(
        NIVELES_ROL,
        rol,
    )
        ? (rol as Rol)
        : null;
}

export function obtenerNivelRol(
    valor: unknown,
): number {
    const rol =
        normalizarRol(valor);

    return rol
        ? NIVELES_ROL[rol]
        : 0;
}

export function esDesarrollador(
    valor: unknown,
): boolean {
    return (
        normalizarRol(valor) ===
        "desarrollador"
    );
}

// ============================================================
// JERARQUÍA PARA ASIGNAR ROLES
// ============================================================

/**
 * Un usuario solo puede asignar roles estrictamente
 * inferiores al suyo.
 *
 * Ejemplos:
 *
 * admintorneo -> staff / voluntario
 * admin        -> admintorneo / staff / voluntario
 * desarrollador -> admin / admintorneo / staff / voluntario
 *
 * Tener nivel jerárquico suficiente NO implica tener
 * permiso para gestionar usuarios/permisos.
 * Ese permiso se comprueba por separado.
 */
export function puedeAsignarRol(
    rolGestor: Rol | null,
    rolDestino: Rol | null,
): boolean {
    if (
        !rolGestor ||
        !rolDestino
    ) {
        return false;
    }

    return (
        NIVELES_ROL[rolDestino] <
        NIVELES_ROL[rolGestor]
    );
}

export function obtenerRolesAsignables(
    rolGestor: Rol | null,
): Rol[] {
    if (!rolGestor) {
        return [];
    }

    return ROLES_ORDENADOS.filter(
        (rol) =>
            puedeAsignarRol(
                rolGestor,
                rol,
            ),
    );
}

// ============================================================
// CATÁLOGO DE PERMISOS
// ============================================================

export type AmbitoPermisos =
    | "general"
    | "torneo";

export type AccionesPermisos =
    Record<string, boolean>;

export type PermisosAmbito =
    Record<
        string,
        AccionesPermisos
    >;

export type SeccionPermisos = {
    id: string;
    nombre: string;
    acciones: readonly string[];

    /**
     * false:
     * se guarda y se valida internamente,
     * pero no se muestra como checkbox.
     *
     * El acceso al panel es implícito al
     * conceder un rol administrativo.
     */
    configurable?: boolean;
};

export const SECCIONES_GENERALES:
    readonly SeccionPermisos[] = [
        {
            id: "panell",
            nombre: "Accés al panell",
            acciones: ["ver"],
            configurable: false,
        },
        {
            id: "tornejos",
            nombre: "Tornejos",
            acciones: [
                "ver",
                "crear",
            ],
        },
        {
            id: "usuaris",
            nombre: "Gestió d’usuaris",
            acciones: [
                "ver",
                "bloquear",
                "desbloquear",
            ],
        },
        {
            id: "permisos",
            nombre: "Gestió de permisos",
            acciones: [
                "ver",
                "crear",
                "editar",
                "eliminar",
            ],
        },
        {
            id: "configuracio",
            nombre: "Configuració de la plataforma",
            acciones: [
                "ver",
                "editar",
            ],
        },
    ];

export const SECCIONES_TORNEO:
    readonly SeccionPermisos[] = [
        {
            id: "panell",
            nombre: "Accés al torneig",
            acciones: ["ver"],
            configurable: false,
        },
        {
            id: "tornejos",
            nombre: "Informació del torneig",
            acciones: [
                "ver",
                "editar",
                "eliminar",
            ],
        },
        {
            id: "edicions",
            nombre: "Edicions",
            acciones: [
                "ver",
                "crear",
                "editar",
                "eliminar",
            ],
        },
        {
            id: "permisos",
            nombre: "Organització i permisos",
            acciones: [
                "ver",
                "asignar",
                "editar",
                "revocar",
            ],
        },
        {
            id: "voluntaris",
            nombre: "Voluntaris",
            acciones: [
                "ver",
                "crear",
                "editar",
                "eliminar",
            ],
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
            acciones: [
                "ver",
                "editar",
            ],
        },
        {
            id: "partits",
            nombre: "Calendari i resultats",
            acciones: [
                "ver",
                "crear",
                "editar",
                "eliminar",
            ],
        },
        {
            id: "classificacions",
            nombre: "Classificacions",
            acciones: ["ver"],
        },
        {
            id: "configuracio-edicio",
            nombre: "Configuració de l’edició",
            acciones: [
                "ver",
                "editar",
            ],
        },
    ];

/*
* Compatibilidad con permisos antiguos.
*
* No aparecerán en el nuevo asistente, pero se siguen
* reconociendo para no romper usuarios existentes.
*/
const SECCIONES_COMPATIBLES_TORNEO:
    readonly SeccionPermisos[] = [
        {
            id: "pistes",
            nombre: "Pistes",
            acciones: ["ver"],
        },
        {
            id: "alumnes",
            nombre: "Alumnes",
            acciones: [
                "ver",
                "exportar",
            ],
        },
        {
            id: "noticies",
            nombre: "Notícies",
            acciones: [
                "ver",
                "crear",
                "editar",
                "eliminar",
            ],
        },
        {
            id: "acta-digital",
            nombre: "Acta digital",
            acciones: [
                "ver",
                "editar",
            ],
        },
        {
            id: "designacions",
            nombre: "Designacions",
            acciones: ["ver"],
        },
        {
            id: "historial-jugadors",
            nombre: "Historial de jugadors",
            acciones: [
                "ver",
                "editar",
                "exportar",
            ],
        },
    ];

export const NOMBRES_ACCIONES:
    Record<string, string> = {
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
        "canviar-estat":
            "Canviar l’estat",
    };

export function obtenerSecciones(
    ambito: AmbitoPermisos,
    soloConfigurables = false,
): readonly SeccionPermisos[] {
    const secciones =
        ambito === "general"
            ? SECCIONES_GENERALES
            : SECCIONES_TORNEO;

    if (!soloConfigurables) {
        return secciones;
    }

    return secciones.filter(
        (seccion) =>
            seccion.configurable !==
            false,
    );
}

// ============================================================
// REGLAS DE SEGURIDAD
// ============================================================

/**
 * nivel:
 * rol mínimo que puede llegar a tener el permiso.
 *
 * porDefecto:
 * valor inicial cuando se asigna el rol.
 *
 * Un rol suficiente nunca permite superar su techo,
 * pero el administrador puede desactivar permisos.
 *
 * Los permisos sensibles pueden usar porDefecto:false:
 * son posibles para ese rol, pero deben concederse
 * expresamente.
 */
export type ReglaPermiso = {
    nivel: number;
    porDefecto: boolean;
};

export type ReglasSeccion =
    Record<string, ReglaPermiso>;

export type ReglasAmbito =
    Record<string, ReglasSeccion>;

/*
* PERMISOS GENERALES
*
* Solo Admin y Desenvolupador tienen acceso
* a la administración general de la plataforma.
*
* "permisos" es sensible y comienza desactivado:
* un Admin solo gestiona otros accesos si un
* superior se lo ha concedido expresamente.
*/
const REGLAS_GENERALES:
    ReglasAmbito = {
        panell: {
            ver: {
                nivel: 1,
                porDefecto: true,
            },
        },

        tornejos: {
            ver: {
                nivel: 4,
                porDefecto: true,
            },
            crear: {
                nivel: 4,
                porDefecto: true,
            },
        },

        noticies: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            crear: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        usuaris: {
            ver: {
                nivel: 4,
                porDefecto: true,
            },
            bloquear: {
                nivel: 4,
                porDefecto: true,
            },
            desbloquear: {
                nivel: 4,
                porDefecto: true,
            },
        },

        permisos: {
            ver: {
                nivel: 4,
                porDefecto: false,
            },
            crear: {
                nivel: 4,
                porDefecto: false,
            },
            editar: {
                nivel: 4,
                porDefecto: false,
            },
            eliminar: {
                nivel: 4,
                porDefecto: false,
            },
        },

        configuracio: {
            ver: {
                nivel: 4,
                porDefecto: true,
            },
            editar: {
                nivel: 4,
                porDefecto: true,
            },
        },
    };

/*
* PERMISOS DE TORNEO
*
* Voluntari:
* nivel 1. Tiene acceso administrativo básico,
* pero no recibe ninguna de estas secciones de
* gestión automáticamente.
*
* Staff:
* nivel 2. Puede realizar las tareas operativas.
*
* Administrador de torneig:
* nivel 3. Puede administrar el torneo.
*
* Admin:
* nivel 4.
*
* Desenvolupador:
* nivel 5 y siempre tiene todo.
*
* IMPORTANTE:
* cualquier acción "eliminar" requiere, como mínimo,
* Administrador de torneig.
*
* La gestión de permisos del torneo es sensible:
* un Administrador de torneig puede llegar a tenerla,
* pero comienza completamente desactivada.
*/
const REGLAS_TORNEO:
    ReglasAmbito = {
        panell: {
            ver: {
                nivel: 1,
                porDefecto: true,
            },
        },

        tornejos: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 3,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        edicions: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            crear: {
                nivel: 3,
                porDefecto: true,
            },
            editar: {
                nivel: 3,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        permisos: {
            ver: {
                nivel: 3,
                porDefecto: false,
            },
            asignar: {
                nivel: 3,
                porDefecto: false,
            },
            editar: {
                nivel: 3,
                porDefecto: false,
            },
            revocar: {
                nivel: 3,
                porDefecto: false,
            },
        },

        voluntaris: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            crear: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        equips: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            crear: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
            evaluar: {
                nivel: 2,
                porDefecto: true,
            },
            "canviar-estat": {
                nivel: 2,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        competicio: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        partits: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            crear: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        classificacions: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
        },

        "configuracio-edicio": {
            ver: {
                nivel: 3,
                porDefecto: true,
            },
            editar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        /*
        * Compatibilidad.
        */
        pistes: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
        },

        alumnes: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            exportar: {
                nivel: 2,
                porDefecto: true,
            },
        },

        noticies: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            crear: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
            eliminar: {
                nivel: 3,
                porDefecto: true,
            },
        },

        "acta-digital": {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
        },

        designacions: {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
        },

        "historial-jugadors": {
            ver: {
                nivel: 2,
                porDefecto: true,
            },
            editar: {
                nivel: 2,
                porDefecto: true,
            },
            exportar: {
                nivel: 2,
                porDefecto: true,
            },
        },
    };

export const REGLAS_PERMISOS = {
    general: REGLAS_GENERALES,
    torneo: REGLAS_TORNEO,
} satisfies Record<
    AmbitoPermisos,
    ReglasAmbito
>;

/*
* Se mantiene este export para que el resto
* del proyecto pueda migrarse archivo a archivo.
*
* A partir de ahora contiene los dos ámbitos.
*/
export const NIVELES_PERMISOS =
    REGLAS_PERMISOS;

// ============================================================
// CONSULTA DE REGLAS
// ============================================================

function accionReconocida(
    ambito: AmbitoPermisos,
    seccion: string,
    accion: string,
): boolean {
    const principal =
        obtenerSecciones(
            ambito,
        ).some(
            (item) =>
                item.id === seccion &&
                item.acciones.includes(
                    accion,
                ),
        );

    if (principal) {
        return true;
    }

    if (ambito !== "torneo") {
        return false;
    }

    return (
        SECCIONES_COMPATIBLES_TORNEO.some(
            (item) =>
                item.id === seccion &&
                item.acciones.includes(
                    accion,
                ),
        )
    );
}

export function obtenerReglaPermiso(
    ambito: AmbitoPermisos,
    seccion: string,
    accion = "ver",
): ReglaPermiso | null {
    if (
        !accionReconocida(
            ambito,
            seccion,
            accion,
        )
    ) {
        return null;
    }

    return (
        REGLAS_PERMISOS[
            ambito
        ][seccion]?.[accion] ??
        null
    );
}

/*
* Firma nueva:
*
* obtenerNivelRequerido(
*     "torneo",
*     "partits",
*     "eliminar"
* )
*
* Se conserva temporalmente la firma antigua:
*
* obtenerNivelRequerido(
*     "partits",
*     "eliminar"
* )
*
* La versión antigua devuelve el nivel MÁS RESTRICTIVO
* entre general y torneo para no abrir privilegios
* mientras migramos los demás archivos.
*/
export function obtenerNivelRequerido(
    ambito: AmbitoPermisos,
    seccion: string,
    accion?: string,
): number;

export function obtenerNivelRequerido(
    seccion: string,
    accion?: string,
): number;

export function obtenerNivelRequerido(
    primero: string,
    segundo = "ver",
    tercero?: string,
): number {
    if (
        primero === "general" ||
        primero === "torneo"
    ) {
        const regla =
            obtenerReglaPermiso(
                primero,
                segundo,
                tercero ?? "ver",
            );

        return (
            regla?.nivel ??
            Number.POSITIVE_INFINITY
        );
    }

    /*
    * Compatibilidad temporal.
    */
    const seccion = primero;
    const accion = segundo;

    const niveles = (
        [
            "general",
            "torneo",
        ] as const
    )
        .map((ambito) =>
            obtenerReglaPermiso(
                ambito,
                seccion,
                accion,
            ),
        )
        .filter(
            (
                regla,
            ): regla is ReglaPermiso =>
                regla !== null,
        )
        .map(
            (regla) =>
                regla.nivel,
        );

    if (
        niveles.length === 0
    ) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.max(
        ...niveles,
    );
}

export function permisoPermitidoPorRol(
    ambito: AmbitoPermisos,
    rol: Rol | null,
    seccion: string,
    accion = "ver",
): boolean {
    if (!rol) {
        return false;
    }

    const regla =
        obtenerReglaPermiso(
            ambito,
            seccion,
            accion,
        );

    if (!regla) {
        return false;
    }

    /*
    * Desenvolupador siempre tiene todo.
    */
    if (
        rol === "desarrollador"
    ) {
        return true;
    }

    return (
        NIVELES_ROL[rol] >=
        regla.nivel
    );
}

export function obtenerValorPorDefecto(
    ambito: AmbitoPermisos,
    rol: Rol | null,
    seccion: string,
    accion = "ver",
): boolean {
    if (
        !permisoPermitidoPorRol(
            ambito,
            rol,
            seccion,
            accion,
        )
    ) {
        return false;
    }

    if (
        rol === "desarrollador"
    ) {
        return true;
    }

    return (
        obtenerReglaPermiso(
            ambito,
            seccion,
            accion,
        )?.porDefecto === true
    );
}

export function requiereConcesionExplicita(
    ambito: AmbitoPermisos,
    seccion: string,
    accion = "ver",
): boolean {
    const regla =
        obtenerReglaPermiso(
            ambito,
            seccion,
            accion,
        );

    return (
        regla !== null &&
        regla.porDefecto === false
    );
}

// ============================================================
// ESTRUCTURA GUARDADA
// ============================================================

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

    acceso_torneos:
        ConfiguracionTodosTorneos;

    torneos:
        Record<
            string,
            AsignacionTorneo
        >;
};

export type UsuarioPermisos = {
    rol?: string | null;
    permisos?: unknown;
    activa?: boolean | null;
} | null | undefined;

type Registro =
    Record<string, unknown>;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function esRegistro(
    valor: unknown,
): valor is Registro {
    return (
        valor !== null &&
        typeof valor ===
            "object" &&
        !Array.isArray(valor)
    );
}

// ============================================================
// CUENTA Y PANEL
// ============================================================

function cuentaDisponible(
    usuario: UsuarioPermisos,
): boolean {
    if (!usuario) {
        return false;
    }

    if (
        usuario.activa !==
            undefined &&
        usuario.activa !== true
    ) {
        return false;
    }

    return true;
}

/**
 * Ya NO existe un permiso configurable
 * "¿puede entrar al panel?".
 *
 * Si:
 * - la cuenta está activa
 * - tiene un rol válido
 *
 * entonces tiene acceso al panel.
 *
 * Las secciones visibles dependerán de sus
 * permisos reales.
 */
export function puedeEntrarPanel(
    usuario: UsuarioPermisos,
): boolean {
    if (
        !cuentaDisponible(usuario)
    ) {
        return false;
    }

    return (
        normalizarRol(
            usuario?.rol,
        ) !== null
    );
}

// ============================================================
// LECTURA DE PERMISOS
// ============================================================

function obtenerGlobales(
    usuario: UsuarioPermisos,
): unknown {
    const documento =
        usuario?.permisos;

    if (
        documento === undefined ||
        documento === null
    ) {
        return undefined;
    }

    if (
        !esRegistro(documento)
    ) {
        return null;
    }

    if (
        Object.hasOwn(
            documento,
            "globales",
        )
    ) {
        return documento.globales;
    }

    /*
    * Compatibilidad con JSON plano antiguo.
    */
    return documento;
}

function leerBooleanoGuardado(
    permisos: unknown,
    seccion: string,
    accion: string,
): boolean | undefined {
    if (
        !esRegistro(permisos)
    ) {
        return undefined;
    }

    if (
        !Object.hasOwn(
            permisos,
            seccion,
        )
    ) {
        return undefined;
    }

    const acciones =
        permisos[seccion];

    if (
        !esRegistro(acciones)
    ) {
        return undefined;
    }

    const valor =
        acciones[accion];

    return typeof valor ===
        "boolean"
        ? valor
        : undefined;
}

function resolverPermiso(
    ambito: AmbitoPermisos,
    rol: Rol | null,
    permisos: unknown,
    seccion: string,
    accion: string,
): boolean {
    if (!rol) {
        return false;
    }

    if (
        !permisoPermitidoPorRol(
            ambito,
            rol,
            seccion,
            accion,
        )
    ) {
        return false;
    }

    /*
    * Desenvolupador no puede limitarse:
    * siempre dispone de todos los permisos.
    */
    if (
        rol === "desarrollador"
    ) {
        return true;
    }

    const guardado =
        leerBooleanoGuardado(
            permisos,
            seccion,
            accion,
        );

    if (
        typeof guardado ===
        "boolean"
    ) {
        return guardado;
    }

    return obtenerValorPorDefecto(
        ambito,
        rol,
        seccion,
        accion,
    );
}

// ============================================================
// CONTEXTO DE TORNEO
// ============================================================

export type ContextoTorneo = {
    rol: Rol;
    permisos: unknown;

    origen:
        | "todos"
        | "individual"
        | "desarrollador";
};

export function obtenerContextoTorneo(
    usuario: UsuarioPermisos,
    torneoID: string,
): ContextoTorneo | null {
    if (
        !puedeEntrarPanel(usuario)
    ) {
        return null;
    }

    if (!UUID.test(torneoID)) {
        return null;
    }

    const rolGeneral =
        normalizarRol(
            usuario?.rol,
        );

    if (!rolGeneral) {
        return null;
    }

    /*
    * Desenvolupador:
    * todos los torneos, siempre.
    *
    * Incluso una configuración antigua incorrecta
    * no puede limitarlo.
    */
    if (
        rolGeneral ===
        "desarrollador"
    ) {
        return {
            rol: "desarrollador",
            permisos: undefined,
            origen:
                "desarrollador",
        };
    }

    const documento =
        usuario?.permisos;

    if (
        !esRegistro(documento)
    ) {
        return null;
    }

    const id =
        torneoID.toLowerCase();

    if (
        Object.hasOwn(
            documento,
            "torneos",
        ) &&
        !esRegistro(
            documento.torneos,
        )
    ) {
        return null;
    }

    const asignaciones =
        esRegistro(
            documento.torneos,
        )
            ? documento.torneos
            : {};

    /*
    * Asignación individual:
    * siempre tiene prioridad.
    */
    const clave =
        Object.keys(
            asignaciones,
        ).find(
            (valor) =>
                valor.toLowerCase() ===
                id,
        );

    if (
        clave !== undefined
    ) {
        const asignacion =
            asignaciones[clave];

        if (
            !esRegistro(
                asignacion,
            ) ||
            asignacion.acceso !== true
        ) {
            /*
            * acceso:false es una exclusión explícita.
            */
            return null;
        }

        const rol =
            Object.hasOwn(
                asignacion,
                "rol",
            )
                ? normalizarRol(
                    asignacion.rol,
                )
                : rolGeneral;

        if (!rol) {
            return null;
        }

        return {
            rol,
            permisos:
                asignacion.permisos,
            origen:
                "individual",
        };
    }

    /*
    * Configuración común.
    */
    const comunes =
        documento.acceso_torneos;

    if (
        !esRegistro(comunes) ||
        comunes.todos !== true
    ) {
        return null;
    }

    const rolComun =
        normalizarRol(
            comunes.rol,
        );

    if (!rolComun) {
        return null;
    }

    return {
        rol: rolComun,
        permisos:
            comunes.permisos,
        origen: "todos",
    };
}

export function tieneAccesoTorneo(
    usuario: UsuarioPermisos,
    torneoID: string,
): boolean {
    return (
        obtenerContextoTorneo(
            usuario,
            torneoID,
        ) !== null
    );
}

export function obtenerRolEnTorneo(
    usuario: UsuarioPermisos,
    torneoID: string,
): Rol | null {
    return (
        obtenerContextoTorneo(
            usuario,
            torneoID,
        )?.rol ?? null
    );
}

// ============================================================
// COMPROBACIÓN DE PERMISOS
// ============================================================

export function tienePermiso(
    usuario: UsuarioPermisos,
    seccion: string,
    accion = "ver",
    torneoID?: string,
): boolean {
    if (
        !puedeEntrarPanel(usuario)
    ) {
        return false;
    }

    const rolGeneral =
        normalizarRol(
            usuario?.rol,
        );

    if (!rolGeneral) {
        return false;
    }

    /*
    * panell.ver no es configurable.
    */
    if (
        seccion === "panell" &&
        accion === "ver"
    ) {
        if (
            torneoID === undefined
        ) {
            return true;
        }

        return (
            obtenerContextoTorneo(
                usuario,
                torneoID,
            ) !== null
        );
    }

    if (
        torneoID === undefined
    ) {
        if (
            !accionReconocida(
                "general",
                seccion,
                accion,
            )
        ) {
            return false;
        }

        return resolverPermiso(
            "general",
            rolGeneral,
            obtenerGlobales(
                usuario,
            ),
            seccion,
            accion,
        );
    }

    if (
        !accionReconocida(
            "torneo",
            seccion,
            accion,
        )
    ) {
        return false;
    }

    const contexto =
        obtenerContextoTorneo(
            usuario,
            torneoID,
        );

    if (!contexto) {
        return false;
    }

    return resolverPermiso(
        "torneo",
        contexto.rol,
        contexto.permisos,
        seccion,
        accion,
    );
}

// ============================================================
// CONSTRUCCIÓN DE PERMISOS
// ============================================================

/**
 * Construye todos los booleanos de un ámbito.
 *
 * Reglas:
 *
 * 1. Sin nivel suficiente -> false.
 *
 * 2. Desenvolupador -> siempre true.
 *
 * 3. Si ya hay booleano guardado -> se conserva.
 *
 * 4. Si no existe:
 *    - permiso normal -> valor por defecto.
 *    - permiso sensible -> false.
 */
export function completarPermisosAmbito(
    ambito: AmbitoPermisos,
    rol: Rol | null,
    existentes?: PermisosAmbito,
): PermisosAmbito {
    const resultado:
        PermisosAmbito = {};

    for (
        const seccion
        of obtenerSecciones(
            ambito,
        )
    ) {
        const acciones:
            AccionesPermisos = {};

        for (
            const accion
            of seccion.acciones
        ) {
            const permitido =
                permisoPermitidoPorRol(
                    ambito,
                    rol,
                    seccion.id,
                    accion,
                );

            if (!permitido) {
                acciones[accion] =
                    false;

                continue;
            }

            /*
            * Desenvolupador siempre true.
            */
            if (
                rol ===
                "desarrollador"
            ) {
                acciones[accion] =
                    true;

                continue;
            }

            const guardado =
                existentes?.[
                    seccion.id
                ]?.[accion];

            if (
                typeof guardado ===
                "boolean"
            ) {
                acciones[accion] =
                    guardado;

                continue;
            }

            acciones[accion] =
                obtenerValorPorDefecto(
                    ambito,
                    rol,
                    seccion.id,
                    accion,
                );
        }

        resultado[
            seccion.id
        ] = acciones;
    }

    /*
    * Conservación de secciones antiguas reconocidas.
    */
    if (
        ambito === "torneo" &&
        existentes
    ) {
        for (
            const seccion
            of SECCIONES_COMPATIBLES_TORNEO
        ) {
            if (
                !Object.hasOwn(
                    existentes,
                    seccion.id,
                )
            ) {
                continue;
            }

            const acciones:
                AccionesPermisos = {};

            for (
                const accion
                of seccion.acciones
            ) {
                const permitido =
                    permisoPermitidoPorRol(
                        "torneo",
                        rol,
                        seccion.id,
                        accion,
                    );

                if (!permitido) {
                    acciones[accion] =
                        false;

                    continue;
                }

                if (
                    rol ===
                    "desarrollador"
                ) {
                    acciones[accion] =
                        true;

                    continue;
                }

                const guardado =
                    existentes[
                        seccion.id
                    ]?.[accion];

                acciones[accion] =
                    typeof guardado ===
                        "boolean"
                        ? guardado
                        : obtenerValorPorDefecto(
                            "torneo",
                            rol,
                            seccion.id,
                            accion,
                        );
            }

            resultado[
                seccion.id
            ] = acciones;
        }
    }

    return resultado;
}

// ============================================================
// DOCUMENTO INICIAL
// ============================================================

export function crearDocumentoPermisos(
    rolGeneral: Rol | null = null,
): DocumentoPermisos {
    return {
        version: 1,

        ultima_actualizacion:
            new Date()
                .toISOString(),

        globales:
            completarPermisosAmbito(
                "general",
                rolGeneral,
            ),

        acceso_torneos: {
            todos: false,
            rol: null,

            permisos:
                completarPermisosAmbito(
                    "torneo",
                    null,
                ),
        },

        torneos: {},
    };
}

// ============================================================
// CÁLCULO LEGACY DEL ROL
// ============================================================

/**
 * TEMPORAL.
 *
 * Se conserva porque los componentes antiguos todavía
 * lo importan.
 *
 * El nuevo asistente NO utilizará esta función para
 * determinar users.rol.
 *
 * El rol general se seleccionará explícitamente
 * en el paso 2.
 */
export function calcularRolMinimo(
    documento: Pick<
        DocumentoPermisos,
        | "acceso_torneos"
        | "torneos"
    >,
): Rol | null {
    const roles: Rol[] = [];

    if (
        documento
            .acceso_torneos
            .todos
    ) {
        const rol =
            normalizarRol(
                documento
                    .acceso_torneos
                    .rol,
            );

        if (rol) {
            roles.push(rol);
        }
    }

    for (
        const asignacion
        of Object.values(
            documento.torneos,
        )
    ) {
        if (
            !asignacion.acceso
        ) {
            continue;
        }

        const rol =
            normalizarRol(
                asignacion.rol,
            );

        if (rol) {
            roles.push(rol);
        }
    }

    if (
        roles.length === 0
    ) {
        return null;
    }

    return roles.reduce(
        (menor, actual) =>
            NIVELES_ROL[actual] <
            NIVELES_ROL[menor]
                ? actual
                : menor,
    );
}

// ============================================================
// PREPARACIÓN PARA GUARDAR
// ============================================================

/**
 * NUEVA LÓGICA:
 *
 * users.rol deja de calcularse usando el rol más bajo
 * de los torneos.
 *
 * rolGeneral será seleccionado explícitamente por
 * el administrador.
 *
 * Mientras migramos el Asistente, el segundo argumento
 * es opcional. Si no se pasa se utiliza temporalmente
 * calcularRolMinimo() para mantener compatibilidad.
 */
export function prepararDocumentoPermisos(
    documento: DocumentoPermisos,
    rolGeneralEntrada?: Rol | null,
): {
    rol: Rol | null;
    permisos: DocumentoPermisos;
} {
    const rolGeneral =
        rolGeneralEntrada ===
        undefined
            ? calcularRolMinimo(
                documento,
            )
            : normalizarRol(
                rolGeneralEntrada,
            );

    /*
    * Desenvolupador:
    * configuración absoluta e inmutable.
    */
    if (
        rolGeneral ===
        "desarrollador"
    ) {
        return {
            rol:
                "desarrollador",

            permisos: {
                version: 1,

                ultima_actualizacion:
                    new Date()
                        .toISOString(),

                globales:
                    completarPermisosAmbito(
                        "general",
                        "desarrollador",
                    ),

                acceso_torneos: {
                    todos: true,

                    rol:
                        "desarrollador",

                    permisos:
                        completarPermisosAmbito(
                            "torneo",
                            "desarrollador",
                        ),
                },

                /*
                * No necesita excepciones:
                * tiene acceso absoluto a todos.
                */
                torneos: {},
            },
        };
    }

    const torneos:
        Record<
            string,
            AsignacionTorneo
        > = {};

    for (
        const [
            idOriginal,
            asignacion,
        ]
        of Object.entries(
            documento.torneos,
        )
    ) {
        if (
            !UUID.test(
                idOriginal,
            )
        ) {
            throw new Error(
                "Hay un identificador de torneo no válido.",
            );
        }

        const id =
            idOriginal
                .toLowerCase();

        if (
            Object.hasOwn(
                torneos,
                id,
            )
        ) {
            throw new Error(
                "El mismo torneo aparece más de una vez.",
            );
        }

        const rol =
            asignacion.acceso
                ? normalizarRol(
                    asignacion.rol,
                )
                : null;

        if (
            asignacion.acceso &&
            !rol
        ) {
            throw new Error(
                "Cada torneo con acceso necesita un rol válido.",
            );
        }

        torneos[id] = {
            acceso:
                asignacion.acceso,

            rol,

            permisos:
                completarPermisosAmbito(
                    "torneo",
                    asignacion.acceso
                        ? rol
                        : null,
                    asignacion.permisos,
                ),
        };
    }

    const todos =
        documento
            .acceso_torneos
            .todos;

    const rolComun =
        todos
            ? normalizarRol(
                documento
                    .acceso_torneos
                    .rol,
            )
            : null;

    if (
        todos &&
        !rolComun
    ) {
        throw new Error(
            "El acceso a todos los torneos necesita un rol válido.",
        );
    }

    return {
        rol: rolGeneral,

        permisos: {
            version: 1,

            ultima_actualizacion:
                new Date()
                    .toISOString(),

            globales:
                completarPermisosAmbito(
                    "general",
                    rolGeneral,
                    documento.globales,
                ),

            acceso_torneos: {
                todos,
                rol: rolComun,

                permisos:
                    completarPermisosAmbito(
                        "torneo",
                        todos
                            ? rolComun
                            : null,
                        documento
                            .acceso_torneos
                            .permisos,
                    ),
            },

            torneos,
        },
    };
}