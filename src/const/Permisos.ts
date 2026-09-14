// El origen manual o del sistema no cambia el nivel del rol.
export const NIVELES_ROL: Record<string, number> = {
    voluntario: 1, staff: 2, admintorneo: 3, admin: 4, desarrollador: 5,
};

// Los niveles pendientes quedan en 0 hasta configurar cada sección.
// Las acciones sin nivel específico heredan el nivel de su sección.
export const NIVELES_PERMISOS: Record<string, { nivel: number; acciones?: Record<string, number> }> = {
    panell: { nivel: 0 },
    tornejos: { nivel: 0, acciones: { crear: 2, editar: 2, eliminar: 4 } },
    equips: { nivel: 0 }, pistes: { nivel: 0 }, alumnes: { nivel: 0 },
    partits: { nivel: 0 }, usuaris: { nivel: 0 }, edicions: { nivel: 0 },
    noticies: { nivel: 0 }, permisos: { nivel: 0 }, voluntaris: { nivel: 0 },
    "acta-digital": { nivel: 0 }, designacions: { nivel: 0 },
    "historial-jugadors": { nivel: 0 }, configuracio: { nivel: 0 },
};

type UsuarioPermisos = { rol?: string | null; permisos?: unknown } | null | undefined;

// La asignación al torneo es independiente del nivel de las acciones.
// Admin y Desarrollador tienen acceso general; los demás necesitan asignación.
export function tieneAccesoTorneo(usuario: UsuarioPermisos, torneoID: string) {
    if (!usuario || typeof usuario.rol !== "string") return false;
    const rol = usuario.rol.trim().toLowerCase();
    if (!Object.hasOwn(NIVELES_ROL, rol)) return false;
    if (NIVELES_ROL[rol] >= NIVELES_ROL.admin) return true;
    const permisos = usuario.permisos;
    if (!permisos || typeof permisos !== "object" || Array.isArray(permisos)) return false;
    const torneos = (permisos as Record<string, unknown>).torneos;
    if (!torneos || typeof torneos !== "object" || Array.isArray(torneos) || !Object.hasOwn(torneos, torneoID)) return false;
    const asignacion = (torneos as Record<string, unknown>)[torneoID];
    return Boolean(asignacion && typeof asignacion === "object" && !Array.isArray(asignacion) &&
        (asignacion as Record<string, unknown>).acceso === true);
}

export function tienePermiso(usuario: UsuarioPermisos, seccion: string, accion = "ver", torneoID?: string) {
    if (!usuario || typeof usuario.rol !== "string") return false;
    const rol = usuario.rol.trim().toLowerCase();
    if (!Object.hasOwn(NIVELES_ROL, rol) || !Object.hasOwn(NIVELES_PERMISOS, seccion)) return false;
    if (torneoID !== undefined && !tieneAccesoTorneo(usuario, torneoID)) return false;
    const nivelUsuario = NIVELES_ROL[rol];
    const regla = NIVELES_PERMISOS[seccion];
    const nivelRequerido = regla.acciones && Object.hasOwn(regla.acciones, accion)
        ? regla.acciones[accion] : regla.nivel;
    if (nivelUsuario < nivelRequerido) return false;
    if (nivelUsuario > nivelRequerido) return true;

    // Solo al coincidir el nivel interviene el false explícito.
    const permisos = usuario.permisos;
    if (permisos == null) return true;
    if (typeof permisos !== "object" || Array.isArray(permisos)) return false;
    const configuracion = permisos as {
        globales?: unknown;
        torneos?: Record<string, { permisos?: unknown }>;
    };
    const ambito = torneoID === undefined ? configuracion.globales : configuracion.torneos?.[torneoID]?.permisos;
    if (ambito === undefined) return true;
    if (!ambito || typeof ambito !== "object" || Array.isArray(ambito)) return false;
    if (!Object.hasOwn(ambito, seccion)) return true;
    const permisosSeccion = (ambito as Record<string, unknown>)[seccion];
    if (!permisosSeccion || typeof permisosSeccion !== "object" || Array.isArray(permisosSeccion)) return false;
    if (!Object.hasOwn(permisosSeccion, accion)) return true;
    return (permisosSeccion as Record<string, unknown>)[accion] === true;
}
