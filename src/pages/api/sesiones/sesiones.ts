import crypto from 'crypto';
import { supabase, supabaseAdmin } from "../../../utils/supabase";

/**
 * Crear una nueva sesión para el usuario
 */
export async function crearSesion(
  id_usuario: string,
  cookies: any
) {
  const token_sesion = crypto.randomUUID();

  const fechaExpiracion = new Date();
  fechaExpiracion.setDate(fechaExpiracion.getDate() + 30);

  const { data, error } = await supabaseAdmin
    .from("sesiones")
    .insert({
      id_usuario,
      token_sesion,
      estado: "ACTIVA",
      fecha_expiracion: fechaExpiracion.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error al crear la sesión: ${error.message}`);
  }

  cookies.set("token_sesion", token_sesion, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    expires: fechaExpiracion,
  });

  return data;
}

/**
 * Actualizar la sesión existente del usuario
 */
export async function actualizarSesion(
  token_sesion: string,
  cookies: any
) {
  const fechaExpiracion = new Date();
  fechaExpiracion.setDate(fechaExpiracion.getDate() + 30);

  const { data, error } = await supabaseAdmin
    .from("sesiones")
    .update({
      fecha_actualizacion: new Date().toISOString(),
      fecha_expiracion: fechaExpiracion.toISOString(),
    })
    .eq("token_sesion", token_sesion)
    .eq("estado", "ACTIVA")
    .select()
    .single();

  if (error) {
    throw new Error(`Error al actualizar la sesión: ${error.message}`);
  }

  cookies.set("token_sesion", token_sesion, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    expires: fechaExpiracion,
  });

  return data;
}

/**
 * Revocar una sesión
 */
export async function revocarSesion(
  token_sesion: string,
  cookies: any
) {
  const { error } = await supabaseAdmin
    .from("sesiones")
    .update({
      estado: "REVOCADA",
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq("token_sesion", token_sesion);

  if (error) {
    throw new Error(`Error al revocar la sesión: ${error.message}`);
  }

  cookies.delete("token_sesion", {
    path: "/",
  });

  return true;
}

/**
 * Cerrar sesión
 */
export async function cerrarSesion(
  token_sesion: string,
  cookies: any
) {
  const { error } = await supabaseAdmin
    .from("sesiones")
    .update({
      estado: "CERRADA",
      fecha_actualizacion: new Date().toISOString(),
    })
    .eq("token_sesion", token_sesion);

  if (error) {
    throw new Error(`Error al cerrar la sesión: ${error.message}`);
  }

  cookies.delete("token_sesion", {
    path: "/",
  });

  return true;
}

/**
 * Eliminar una sesión
 */
export async function eliminarSesion(
  token_sesion: string,
  cookies: any
) {
  const { error } = await supabaseAdmin
    .from("sesiones")
    .delete()
    .eq("token_sesion", token_sesion);

  if (error) {
    throw new Error(`Error al eliminar la sesión: ${error.message}`);
  }

  cookies.delete("token_sesion", {
    path: "/",
  });

  return true;
}

/**
 * Obtener información sobre las sesiones activas del usuario
 */
export async function limitesSesion(id_usuario: string) {
  const { count, error } = await supabase
    .from("sesiones")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("id_usuario", id_usuario)
    .eq("estado", "ACTIVA");

  if (error) {
    throw new Error(`Error al obtener las sesiones: ${error.message}`);
  }

  return {
    sesiones_activas: count ?? 0,
  };
}

/**
 * Obtener todas las sesiones del usuario
 */
export async function obtenerSesiones(id_usuario: string) {
  const { data, error } = await supabase
    .from("sesiones")
    .select("*")
    .eq("id_usuario", id_usuario)
    .order("fecha_creacion", {
      ascending: false,
    });

  if (error) {
    throw new Error(`Error al obtener las sesiones: ${error.message}`);
  }

  return data;
}

export async function obtenerUsuarioPorToken(token_sesion: string) {

    // 1. Buscar sesión activa
    const { data: sesion, error: sesionError } = await supabaseAdmin
        .from("sesiones")
        .select("*")
        .eq("token_sesion", token_sesion)
        .eq("estado", "ACTIVA")
        .single();

    if (sesionError || !sesion) {
        return null;
    }

    // 2. Comprobar expiración
    const ahora = new Date();
    const expira = new Date(sesion.fecha_expiracion);

    if (expira < ahora) {
        await supabaseAdmin
            .from("sesiones")
            .update({ estado: "EXPIRADA" })
            .eq("id", sesion.id);

        return null;
    }

    // 3. Buscar usuario
    const { data: usuario, error: usuarioError } = await supabaseAdmin
        .from("users")
        .select("id, nombre, apellido1, apellido2, email, curso, ano_academico, activa")
        .eq("id", sesion.id_usuario)
        .single();

    if (usuarioError || !usuario) {
        return null;
    }

    // 4. 🔒 VALIDAR CUENTA ACTIVA
    if (!usuario.activa) {
        return null;
    }

    // 5. devolver usuario completo
    return {
        id: usuario.id,
        nombre: usuario.nombre,
        apellido1: usuario.apellido1,
        apellido2: usuario.apellido2,
        email: usuario.email,
        curso: usuario.curso,
        ano_academico: usuario.ano_academico,
        activa: usuario.activa,
        sesion: {
            id: sesion.id,
            estado: sesion.estado,
            fecha_expiracion: sesion.fecha_expiracion
        }
    };
}