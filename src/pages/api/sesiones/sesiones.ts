import crypto from "node:crypto";
import type { AstroCookies } from "astro";
import { supabaseAdmin } from "../../../utils/supabase";

const DIAS_SESION = 30;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPOS_USUARIO =
    "id,nombre,apellido1,apellido2,email,curso,ano_academico,activa,rol,permisos,fecha_actualizacion";

const CAMPOS_SESION =
    "id,id_usuario,estado,fecha_creacion,fecha_actualizacion,fecha_expiracion";

export class ErrorSesion extends Error {
    constructor(
        mensaje: string,
        public estado = 401
    ) {
        super(mensaje);
        this.name = "ErrorSesion";
    }
}

function nuevaExpiracion(): Date {
    const fecha = new Date();

    fecha.setDate(fecha.getDate() + DIAS_SESION);

    return fecha;
}

function guardarCookie(
    cookies: AstroCookies,
    token: string,
    expiracion: Date
) {
    cookies.set("token_sesion", token, {
        path: "/",
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: "strict",
        expires: expiracion,
    });
}

function borrarCookie(cookies: AstroCookies) {
    cookies.delete("token_sesion", {
        path: "/",
    });
}

function sesionCaducada(fecha: unknown): boolean {
    if (typeof fecha !== "string" || !fecha) return true;

    const expiracion = new Date(fecha).getTime();

    return (
        !Number.isFinite(expiracion) ||
        expiracion <= Date.now()
    );
}

/**
 * Información necesaria para validar el acceso.
 * Nunca selecciona la contraseña.
 */
async function consultarUsuario(id_usuario: string) {
    if (!UUID.test(id_usuario)) return null;

    const { data, error } = await supabaseAdmin
        .from("users")
        .select(CAMPOS_USUARIO)
        .eq("id", id_usuario)
        .maybeSingle();

    if (error) throw error;

    return data as {
        id: string;
        nombre: string | null;
        apellido1: string | null;
        apellido2: string | null;
        email: string | null;
        curso: string | null;
        ano_academico: string | null;
        activa: boolean | null;
        rol: string | null;
        permisos: unknown;
        fecha_actualizacion: string | null;
    } | null;
}

/**
 * Revocación interna, sin modificar cookies.
 * Solo cambia sesiones que siguen activas.
 */
async function revocarSesionPorId(id: string) {
    const { error } = await supabaseAdmin
        .from("sesiones")
        .update({
            estado: "REVOCADA",
            fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("estado", "ACTIVA");

    if (error) throw error;
}

/**
 * Limpieza de una sesión cuya creación o renovación
 * no pudo completarse.
 */
async function descartarSesion(id: string) {
    try {
        await revocarSesionPorId(id);
    } catch (error) {
        console.error(
            "No s'ha pogut descartar una sessió:",
            error
        );
    }
}

/**
 * Obtener el usuario de una sesión válida.
 *
 * Devuelve null si:
 * - El token no es válido.
 * - La sesión no está activa.
 * - La sesión ha caducado.
 * - El usuario no existe o no está activo.
 *
 * Los errores de base de datos se propagan:
 * no se confunden con credenciales inválidas.
 */
export async function obtenerUsuarioPorToken(
    token_sesion: string
) {
    if (!UUID.test(token_sesion)) return null;

    const { data: sesion, error: sesionError } =
        await supabaseAdmin
            .from("sesiones")
            .select(CAMPOS_SESION)
            .eq("token_sesion", token_sesion)
            .eq("estado", "ACTIVA")
            .maybeSingle();

    if (sesionError) throw sesionError;

    if (!sesion) return null;

    if (sesionCaducada(sesion.fecha_expiracion)) {
        const { error } = await supabaseAdmin
            .from("sesiones")
            .update({
                estado: "EXPIRADA",
                fecha_actualizacion: new Date().toISOString(),
            })
            .eq("id", sesion.id)
            .eq("estado", "ACTIVA");

        if (error) {
            console.error(
                "No s'ha pogut marcar una sessió com a caducada:",
                error
            );
        }

        return null;
    }

    if (
        typeof sesion.id_usuario !== "string" ||
        !UUID.test(sesion.id_usuario)
    ) {
        await descartarSesion(sesion.id);
        return null;
    }

    const usuario = await consultarUsuario(sesion.id_usuario);

    if (!usuario || usuario.activa !== true) {
        await descartarSesion(sesion.id);
        return null;
    }

    return {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido1: usuario.apellido1,
        apellido2: usuario.apellido2,
        email: usuario.email,
        curso: usuario.curso,
        ano_academico: usuario.ano_academico,
        activa: usuario.activa,
        rol: usuario.rol,
        permisos: usuario.permisos,
        fecha_actualizacion: usuario.fecha_actualizacion,
        sesion: {
            id: sesion.id,
            estado: sesion.estado,
            fecha_expiracion: sesion.fecha_expiracion,
        },
    };
}

/**
 * Crear una sesión.
 * La cookie solo se emite después de validar la sesión creada.
 */
export async function crearSesion(
    id_usuario: string,
    cookies: AstroCookies
) {
    const usuarioInicial = await consultarUsuario(id_usuario);

    if (!usuarioInicial || usuarioInicial.activa !== true) {
        throw new ErrorSesion(
            "El compte no està actiu. No pots iniciar sessió.",
            403
        );
    }

    const token_sesion = crypto.randomUUID();
    const ahora = new Date().toISOString();
    const fechaExpiracion = nuevaExpiracion();

    const { data, error } = await supabaseAdmin
        .from("sesiones")
        .insert({
            id_usuario,
            token_sesion,
            estado: "ACTIVA",
            fecha_creacion: ahora,
            fecha_actualizacion: ahora,
            fecha_expiracion: fechaExpiracion.toISOString(),
        })
        .select(CAMPOS_SESION)
        .single();

    if (error) throw error;

    try {
        const usuarioActual =
            await obtenerUsuarioPorToken(token_sesion);

        if (!usuarioActual) {
            throw new ErrorSesion(
                "No s'ha pogut validar la sessió. Torna a iniciar sessió."
            );
        }

        // Detecta cambios de cuenta durante la creación,
        // incluidos los realizados por el bloqueo/desbloqueo.
        if (
            usuarioActual.fecha_actualizacion !==
            usuarioInicial.fecha_actualizacion
        ) {
            throw new ErrorSesion(
                "El compte ha canviat durant l'accés. Torna a iniciar sessió.",
                409
            );
        }

        guardarCookie(cookies, token_sesion, fechaExpiracion);

        return data;
    } catch (error) {
        await descartarSesion(data.id);
        throw error;
    }
}

/**
 * Renovar únicamente una sesión que sigue siendo válida.
 * Una sesión caducada o revocada nunca se reactiva.
 */
export async function actualizarSesion(
    token_sesion: string,
    cookies: AstroCookies
) {
    const usuarioInicial =
        await obtenerUsuarioPorToken(token_sesion);

    if (!usuarioInicial) {
        borrarCookie(cookies);

        throw new ErrorSesion(
            "La sessió ja no és vàlida. Torna a iniciar sessió."
        );
    }

    const ahora = new Date().toISOString();
    const fechaExpiracion = nuevaExpiracion();

    const { data, error } = await supabaseAdmin
        .from("sesiones")
        .update({
            fecha_actualizacion: ahora,
            fecha_expiracion: fechaExpiracion.toISOString(),
        })
        .eq("id", usuarioInicial.sesion.id)
        .eq("token_sesion", token_sesion)
        .eq("estado", "ACTIVA")
        .gt("fecha_expiracion", ahora)
        .select(CAMPOS_SESION)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        borrarCookie(cookies);

        throw new ErrorSesion(
            "La sessió ja no es pot renovar. Torna a iniciar sessió."
        );
    }

    try {
        const usuarioActual =
            await obtenerUsuarioPorToken(token_sesion);

        if (!usuarioActual) {
            throw new ErrorSesion(
                "La sessió ja no és vàlida. Torna a iniciar sessió."
            );
        }

        if (
            usuarioActual.fecha_actualizacion !==
            usuarioInicial.fecha_actualizacion
        ) {
            throw new ErrorSesion(
                "El compte ha canviat. Torna a iniciar sessió.",
                409
            );
        }

        guardarCookie(cookies, token_sesion, fechaExpiracion);

        return data;
    } catch (error) {
        await descartarSesion(data.id);
        borrarCookie(cookies);
        throw error;
    }
}

/**
 * Revocar la sesión indicada.
 */
export async function revocarSesion(
    token_sesion: string,
    cookies: AstroCookies
) {
    if (!UUID.test(token_sesion)) {
        borrarCookie(cookies);
        return true;
    }

    const { error } = await supabaseAdmin
        .from("sesiones")
        .update({
            estado: "REVOCADA",
            fecha_actualizacion: new Date().toISOString(),
        })
        .eq("token_sesion", token_sesion)
        .eq("estado", "ACTIVA");

    if (error) throw error;

    borrarCookie(cookies);

    return true;
}

/**
 * Cerrar sesión conservando su registro.
 * No cambia una sesión revocada a CERRADA.
 */
export async function cerrarSesion(
    token_sesion: string,
    cookies: AstroCookies
) {
    if (!UUID.test(token_sesion)) {
        borrarCookie(cookies);
        return true;
    }

    const { error } = await supabaseAdmin
        .from("sesiones")
        .update({
            estado: "CERRADA",
            fecha_actualizacion: new Date().toISOString(),
        })
        .eq("token_sesion", token_sesion)
        .eq("estado", "ACTIVA");

    if (error) throw error;

    borrarCookie(cookies);

    return true;
}

/**
 * Eliminar físicamente una sesión.
 * Se conserva por compatibilidad con tu archivo existente.
 */
export async function eliminarSesion(
    token_sesion: string,
    cookies: AstroCookies
) {
    if (!UUID.test(token_sesion)) {
        borrarCookie(cookies);
        return true;
    }

    const { error } = await supabaseAdmin
        .from("sesiones")
        .delete()
        .eq("token_sesion", token_sesion);

    if (error) throw error;

    borrarCookie(cookies);

    return true;
}

/**
 * Contar sesiones activas y no caducadas.
 * Las cuentas inactivas no tienen sesiones utilizables.
 */
export async function limitesSesion(id_usuario: string) {
    const usuario = await consultarUsuario(id_usuario);

    if (!usuario || usuario.activa !== true) {
        return {
            sesiones_activas: 0,
        };
    }

    const { count, error } = await supabaseAdmin
        .from("sesiones")
        .select("id", {
            count: "exact",
            head: true,
        })
        .eq("id_usuario", id_usuario)
        .eq("estado", "ACTIVA")
        .gt("fecha_expiracion", new Date().toISOString());

    if (error) throw error;

    return {
        sesiones_activas: count ?? 0,
    };
}

/**
 * Obtener el historial completo, sin tokens.
 * Consulta por lotes para evitar truncar el resultado
 * con el límite de filas de Supabase.
 *
 * Esta función es interna del servidor.
 * Cualquier API que la utilice debe validar el acceso.
 */
export async function obtenerSesiones(id_usuario: string) {
    if (!UUID.test(id_usuario)) return [];

    const TAMANO_LOTE = 100;

    async function obtenerLote(desde: number) {
        const { data, error } = await supabaseAdmin
            .from("sesiones")
            .select(CAMPOS_SESION)
            .eq("id_usuario", id_usuario)
            .order("fecha_creacion", {
                ascending: false,
                nullsFirst: false,
            })
            .order("id", { ascending: true })
            .range(desde, desde + TAMANO_LOTE - 1);

        if (error) throw error;

        return data ?? [];
    }

    const sesiones: Awaited<ReturnType<typeof obtenerLote>> = [];

    let desde = 0;

    while (true) {
        const lote = await obtenerLote(desde);

        if (lote.length === 0) break;

        sesiones.push(...lote);
        desde += lote.length;
    }

    return sesiones;
}