import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";
import { normalizarRol, tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";
import {
  notificarGestionVoluntario,
  type EventoVoluntariado,
} from "@utils/inscripcio/voluntariGestioEmails";
import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

const APROBADOS = ["APROBADO", "ACEPTADO"];
type Registro = Record<string, unknown>;

function registro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function texto(
  valor: unknown,
  nombre: string,
  maximo: number,
  obligatorio = false,
): string {
  if (typeof valor !== "string" || valor.length > maximo) {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }
  const limpio = valor.trim();
  if (obligatorio && !limpio)
    throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
  return limpio;
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor)) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }
  return valor.toLowerCase();
}

async function exigirEdicion(torneoID: string, edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select("id,torneo_id,nombre")
    .eq("id", edicionID)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.torneo_id.toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany a aquest torneig.");
  }
  return data;
}

/**
 * El formulari acceptat és la concessió: vincula la persona a UNA edició.
 * Les pantalles i API del voluntari han de comprovar aquest accés, mai només
 * tienePermiso("voluntaris", ..., torneoID), que no limita per edició.
 */
export async function tieneAccesoVoluntarioEdicion(
  usuarioID: string,
  torneoID: string,
  edicionID: string,
): Promise<boolean> {
  if (![usuarioID, torneoID, edicionID].every((id) => UUID.test(id)))
    return false;

  const { data: edicion, error: errorEdicion } = await supabaseAdmin
    .from("ediciones")
    .select("torneo_id")
    .eq("id", edicionID)
    .maybeSingle();
  if (errorEdicion) throw errorEdicion;
  if (edicion?.torneo_id.toLowerCase() !== torneoID.toLowerCase()) return false;

  const { data: formularios, error: errorFormularios } = await supabaseAdmin
    .from("formularios")
    .select("id")
    .eq("edicion_id", edicionID)
    .eq("usuario_id", usuarioID)
    .eq("tipo", "VOLUNTARIO")
    .in("estado", APROBADOS);
  if (errorFormularios) throw errorFormularios;
  if (!formularios?.length) return false;

  const { data: voluntario, error: errorVoluntario } = await supabaseAdmin
    .from("voluntarios")
    .select("id")
    .in(
      "formulario_id",
      formularios.map((formulario) => formulario.id),
    )
    .in("validacion_estado", APROBADOS)
    .eq("plaza_estado", "CONFIRMADA")
    .limit(1)
    .maybeSingle();
  if (errorVoluntario) throw errorVoluntario;
  return Boolean(voluntario);
}

function errorRespuesta(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder({ success: false, mensaje: error.message }, error.estado);
  }
  console.error("Error gestionant el voluntariat:", error);
  return responder(
    { success: false, mensaje: "No s'ha pogut completar l'operació." },
    500,
  );
}

async function notificarCambio(
  formularioID: string,
  evento: EventoVoluntariado,
) {
  try {
    const resultado = await notificarGestionVoluntario(formularioID, evento);
    if (resultado.fallidos > 0) {
      console.error(
        `[EMAIL] Voluntariat ${formularioID}: ${resultado.fallidos} de ${resultado.destinatarios} correus fallits (${evento}).`,
      );
    }
  } catch (error) {
    console.error(
      `[EMAIL] Voluntariat ${formularioID}: no s'ha pogut enviar la notificació ${evento}:`,
      error,
    );
  }
}

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const administrador = await exigirUsuario(cookies);
    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");
    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );
    const edicion = await exigirEdicion(torneoID, edicionID);

    const buscarEmail = url.searchParams.get("buscarEmail");
    if (buscarEmail !== null) {
      if (!tienePermiso(administrador, "voluntaris", "crear", torneoID)) {
        throw new ErrorAPI(
          403,
          "No tens permís per cercar comptes de voluntaris.",
        );
      }
      const email = texto(buscarEmail, "correu electrònic", 254, true);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ErrorAPI(400, "El correu electrònic no és vàlid.");
      }
      const { data: usuario, error: errorUsuario } = await supabaseAdmin
        .from("users")
        .select("id,nombre,apellido1,apellido2,email,activa,curso")
        .eq("email", email)
        .maybeSingle();
      if (errorUsuario) throw errorUsuario;
      if (!usuario || usuario.activa !== true) {
        throw new ErrorAPI(
          404,
          "No s'ha trobat cap compte actiu amb aquest correu.",
        );
      }
      return responder({ success: true, usuario });
    }

    if (!tienePermiso(administrador, "voluntaris", "ver", torneoID)) {
      throw new ErrorAPI(
        403,
        "No tens permís per consultar els voluntaris d'aquest torneig.",
      );
    }

    const pagina = Number(url.searchParams.get("pagina") ?? "1");
    if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10_000) {
      throw new ErrorAPI(400, "La pàgina sol·licitada no és vàlida.");
    }
    const desde = (pagina - 1) * 30;
    const {
      data: formularios,
      count,
      error,
    } = await supabaseAdmin
      .from("formularios")
      .select("id,usuario_id,origen,estado,enviado_at,created_at", {
        count: "exact",
      })
      .eq("edicion_id", edicionID)
      .eq("tipo", "VOLUNTARIO")
      .order("created_at", { ascending: false })
      .range(desde, desde + 29);
    if (error) throw error;

    const ids = (formularios ?? []).map((formulario) => formulario.id);
    const { data: voluntarios, error: errorVoluntarios } = ids.length
      ? await supabaseAdmin
          .from("voluntarios")
          .select(
            "id,formulario_id,nombre,apellido1,apellido2,email,curso,grupo,tipo_voluntariado,descripcion,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at",
          )
          .in("formulario_id", ids)
      : { data: [], error: null };
    if (errorVoluntarios) throw errorVoluntarios;
    const porFormulario = new Map(
      (voluntarios ?? []).map((voluntario) => [
        voluntario.formulario_id,
        voluntario,
      ]),
    );

    return responder({
      success: true,
      torneoID,
      edicion: { id: edicion.id, nombre: edicion.nombre },
      capacidades: {
        crear: tienePermiso(administrador, "voluntaris", "crear", torneoID),
        editar: tienePermiso(administrador, "voluntaris", "editar", torneoID),
      },
      pagina,
      total: count ?? 0,
      voluntarios: (formularios ?? []).map((formulario) => ({
        formulario_id: formulario.id,
        usuario_id: formulario.usuario_id,
        origen: formulario.origen,
        estado: formulario.estado,
        enviado_at: formulario.enviado_at,
        voluntario: porFormulario.get(formulario.id) ?? null,
      })),
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

export const POST: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);
    const administrador = await exigirUsuario(cookies);
    const entrada = await leerJSON(request);
    const torneoID = identificador(entrada.torneoID, "torneig");
    const edicionID = identificador(entrada.edicionID, "edició");
    const usuarioID = identificador(entrada.usuarioID, "usuari");
    await exigirEdicion(torneoID, edicionID);

    if (!tienePermiso(administrador, "voluntaris", "crear", torneoID)) {
      throw new ErrorAPI(
        403,
        "No tens permís per crear voluntaris en aquest torneig.",
      );
    }

    const { data: usuario, error: errorUsuario } = await supabaseAdmin
      .from("users")
      .select("id,nombre,apellido1,apellido2,email,activa")
      .eq("id", usuarioID)
      .maybeSingle();
    if (errorUsuario) throw errorUsuario;
    if (!usuario || usuario.activa !== true) {
      throw new ErrorAPI(
        404,
        "No s'ha trobat cap compte actiu amb aquest identificador.",
      );
    }

    const { data: existente, error: errorExistente } = await supabaseAdmin
      .from("formularios")
      .select("id")
      .eq("edicion_id", edicionID)
      .eq("usuario_id", usuarioID)
      .eq("tipo", "VOLUNTARIO")
      .limit(1)
      .maybeSingle();
    if (errorExistente) throw errorExistente;
    if (existente) {
      throw new ErrorAPI(
        409,
        "Aquest usuari ja té un formulari de voluntariat en aquesta edició.",
      );
    }

    const { data: configuracion, error: errorConfiguracion } =
      await supabaseAdmin
        .from("configuracion_ediciones")
        .select("voluntarios")
        .eq("edicion_id", edicionID)
        .maybeSingle();
    if (errorConfiguracion) throw errorConfiguracion;
    const ajustes = registro(configuracion?.voluntarios)
      ? configuracion.voluntarios
      : {};
    const tipos = Array.isArray(ajustes.tipos) ? ajustes.tipos : [];
    const rolID = texto(
      entrada.tipo_voluntariado_id,
      "tipus de voluntariat",
      150,
      true,
    );
    const rol = tipos.find(
      (tipo): tipo is Registro =>
        registro(tipo) &&
        tipo.activo !== false &&
        tipo.id === rolID &&
        typeof tipo.nombre === "string" &&
        Boolean(tipo.nombre.trim()),
    );
    if (!rol)
      throw new ErrorAPI(
        400,
        "Aquest tipus de voluntariat no està disponible.",
      );
    const nombreRol = (rol.nombre as string).trim();

    const nombre = texto(entrada.nombre ?? usuario.nombre, "nom", 100, true);
    const apellido1 = texto(
      entrada.apellido1 ?? usuario.apellido1,
      "primer llinatge",
      100,
      true,
    );
    const apellido2 = texto(
      entrada.apellido2 ?? usuario.apellido2 ?? "",
      "segon llinatge",
      100,
    );
    const email = texto(
      entrada.email ?? usuario.email,
      "correu electrònic",
      254,
      true,
    );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ErrorAPI(400, "El correu electrònic no és vàlid.");
    }
    const curso = texto(entrada.curso, "curs", 100, true);
    const grupo = texto(entrada.grupo, "grup", 100, true);
    const descripcion = texto(entrada.descripcion, "presentació", 2000);

    const { data: plataforma, error: errorPlataforma } = await supabaseAdmin
      .from("configuracion_plataforma")
      .select("cursos,created_at")
      .order("created_at", { ascending: true, nullsFirst: false })
      .limit(1);
    if (errorPlataforma) throw errorPlataforma;
    const cursos = plataforma?.[0]?.cursos;
    if (
      !Array.isArray(cursos) ||
      !cursos.some(
        (opcion) =>
          registro(opcion) &&
          opcion.curso === curso &&
          Array.isArray(opcion.grupos) &&
          opcion.grupos.includes(grupo),
      )
    ) {
      throw new ErrorAPI(400, "Selecciona un curs i un grup configurats.");
    }

    let tipoVoluntariadoID: string | null = null;
    if (UUID.test(rolID)) {
      const { data: tipoDB, error: errorTipo } = await supabaseAdmin
        .from("tipos_voluntariado")
        .select("id")
        .eq("id", rolID)
        .maybeSingle();
      if (errorTipo) throw errorTipo;
      tipoVoluntariadoID = tipoDB?.id ?? null;
    }

    const ahora = new Date().toISOString();
    const formularioID = randomUUID();
    const { error: errorFormulario } = await supabaseAdmin
      .from("formularios")
      .insert({
        id: formularioID,
        edicion_id: edicionID,
        tipo: "VOLUNTARIO",
        origen: "ADMIN",
        estado: "EN_REVISION",
        usuario_id: usuario.id,
        email_contacto: email,
        acceso_capitan: false,
        configuracion_snapshot: {
          voluntarios: ajustes,
          rol: { id: rolID, nombre: nombreRol },
        },
        iniciado_at: ahora,
        enviado_at: ahora,
        completado_at: null,
        created_at: ahora,
        updated_at: ahora,
      });
    if (errorFormulario) throw errorFormulario;

    const { data: voluntario, error: errorVoluntario } = await supabaseAdmin
      .from("voluntarios")
      .insert({
        formulario_id: formularioID,
        nombre,
        apellido1,
        apellido2,
        email,
        curso,
        grupo,
        tipo_voluntariado_id: tipoVoluntariadoID,
        tipo_voluntariado: nombreRol,
        descripcion,
        validacion_estado: "PENDIENTE",
        plaza_estado: "PENDIENTE",
        posicion_lista_espera: null,
        created_at: ahora,
        updated_at: ahora,
      })
      .select("id")
      .single();
    if (errorVoluntario) {
      const { error: errorLimpieza } = await supabaseAdmin
        .from("formularios")
        .delete()
        .eq("id", formularioID)
        .eq("usuario_id", usuario.id);
      if (errorLimpieza)
        console.error(
          "No s'ha pogut retirar el formulari incomplet:",
          errorLimpieza,
        );
      throw errorVoluntario;
    }

    await notificarCambio(formularioID, "CREACION_ADMIN");

    return responder(
      {
        success: true,
        formulario_id: formularioID,
        voluntario_id: voluntario.id,
        estado: "EN_REVISION",
      },
      201,
    );
  } catch (error) {
    return errorRespuesta(error);
  }
};

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);
    const administrador = await exigirUsuario(cookies);
    const entrada = await leerJSON(request);
    const torneoID = identificador(entrada.torneoID, "torneig");
    const edicionID = identificador(entrada.edicionID, "edició");
    const voluntarioID = identificador(entrada.voluntarioID, "voluntari");
    await exigirEdicion(torneoID, edicionID);

    if (!tienePermiso(administrador, "voluntaris", "editar", torneoID)) {
      throw new ErrorAPI(
        403,
        "No tens permís per revisar voluntaris d'aquest torneig.",
      );
    }
    if (entrada.accion !== "aceptar" && entrada.accion !== "rechazar") {
      throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
    }

    const { data: voluntario, error: errorVoluntario } = await supabaseAdmin
      .from("voluntarios")
      .select("id,formulario_id,validacion_estado,plaza_estado")
      .eq("id", voluntarioID)
      .maybeSingle();
    if (errorVoluntario) throw errorVoluntario;
    if (!voluntario) throw new ErrorAPI(404, "No s'ha trobat el voluntari.");

    const { data: formulario, error: errorFormulario } = await supabaseAdmin
      .from("formularios")
      .select("id,usuario_id,estado")
      .eq("id", voluntario.formulario_id)
      .eq("tipo", "VOLUNTARIO")
      .eq("edicion_id", edicionID)
      .maybeSingle();
    if (errorFormulario) throw errorFormulario;
    if (!formulario)
      throw new ErrorAPI(404, "El voluntari no pertany a aquesta edició.");
    if (!formulario.usuario_id) {
      throw new ErrorAPI(
        409,
        "El voluntari necessita un compte vinculat al formulari.",
      );
    }

    const aceptar = entrada.accion === "aceptar";
    const estadoNuevo = aceptar ? "APROBADO" : "DENEGADO";
    const plazaNueva = aceptar ? "CONFIRMADA" : "SIN_PLAZA";
    const estadoCambio = aceptar
      ? !APROBADOS.includes(formulario.estado ?? "")
      : formulario.estado !== "DENEGADO";

    // El rol general habilita l'entrada al panell. L'abast real el dona
    // exclusivament el formulari acceptat d'aquesta edició.
    if (aceptar) {
      const { data: usuario, error: errorUsuario } = await supabaseAdmin
        .from("users")
        .select("id,rol,activa")
        .eq("id", formulario.usuario_id)
        .maybeSingle();
      if (errorUsuario) throw errorUsuario;
      if (!usuario || usuario.activa !== true) {
        throw new ErrorAPI(409, "El compte del voluntari no està actiu.");
      }
      if (usuario.rol !== null && !normalizarRol(usuario.rol)) {
        throw new ErrorAPI(
          409,
          "El compte té un rol que cal revisar abans d'acceptar-lo.",
        );
      }
      if (usuario.rol === null) {
        const { data: rolGuardado, error: errorRol } = await supabaseAdmin
          .from("users")
          .update({
            rol: "voluntario",
            fecha_actualizacion: new Date().toISOString(),
          })
          .eq("id", usuario.id)
          .is("rol", null)
          .select("id")
          .maybeSingle();
        if (errorRol) throw errorRol;
        if (!rolGuardado)
          throw new ErrorAPI(
            409,
            "El rol del compte ha canviat; torna a intentar-ho.",
          );
      }
    }

    const ahora = new Date().toISOString();
    const { data: voluntarioGuardado, error: errorActualizacion } =
      await supabaseAdmin
        .from("voluntarios")
        .update({
          validacion_estado: estadoNuevo,
          plaza_estado: plazaNueva,
          posicion_lista_espera: null,
          updated_at: ahora,
        })
        .eq("id", voluntario.id)
        .eq("formulario_id", formulario.id)
        .select("id")
        .maybeSingle();
    if (errorActualizacion) throw errorActualizacion;
    if (!voluntarioGuardado)
      throw new ErrorAPI(409, "El voluntari ha canviat durant la revisió.");

    const { data: guardado, error: errorEstado } = await supabaseAdmin
      .from("formularios")
      .update({ estado: estadoNuevo, updated_at: ahora })
      .eq("id", formulario.id)
      .eq("edicion_id", edicionID)
      .select("id")
      .maybeSingle();

    if (errorEstado || !guardado) {
      const { error: errorRestauracion } = await supabaseAdmin
        .from("voluntarios")
        .update({
          validacion_estado: voluntario.validacion_estado,
          plaza_estado: voluntario.plaza_estado,
          updated_at: ahora,
        })
        .eq("id", voluntario.id)
        .eq("formulario_id", formulario.id);
      if (errorRestauracion)
        console.error(
          "No s'ha pogut restaurar l'estat del voluntari:",
          errorRestauracion,
        );
      if (errorEstado) throw errorEstado;
      throw new ErrorAPI(409, "El formulari ha canviat durant la revisió.");
    }

    if (estadoCambio) {
      await notificarCambio(formulario.id, aceptar ? "ACEPTADO" : "DENEGADO");
    }

    return responder({
      success: true,
      estado: estadoNuevo,
      plaza_estado: plazaNueva,
      acceso: aceptar ? { torneoID, edicionID } : null,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};
