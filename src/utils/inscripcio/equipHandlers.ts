import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";

import {
  CAMPOS_FORMULARIO,
  ErrorAPI,
  UUID,
  cargarFormularioCompleto,
  comprobarOrigen,
  comprobarDuplicadosEdicion,
  configuracionFormulario,
  edicionActiva,
  estadoFormulario,
  estadoPeriodo,
  exigirUUID,
  exigirUsuario,
  esFormularioArchivado,
  guardarParticipantes,
  leerDatos,
  leerJSON,
  normalizarEmail,
  obtenerAccesoPorID,
  obtenerConfiguracionEdicion,
  obtenerConfiguracionPlataforma,
  obtenerEdicion,
  obtenerEdicionesDisponibles,
  obtenerEmailCreador,
  obtenerEquipoFormulario,
  obtenerFormularioComoCapitan,
  obtenerFormularioPropietario,
  obtenerTorneo,
  obtenerUsuario,
  permisosFormulario,
  puedeIgnorarPeriodo,
  responder,
  responderError,
  validarEmails,
  validarEmailsRepetidos,
  validarEnvio,
  validarEstructuraParticipantes,
  type EstadoFormulario,
  type FormularioDB,
  type ParticipanteEntrada,
} from "./equipBase";

import { notificarInscripcionEquipoEnviada } from "./equipEmails";

import { guardarEscudoEquipo } from "./equipStorage";

// ============================================================
// DUPLICADOS ENTRE INSCRIPCIONES REALES
// ============================================================
//
// No reservan participantes:
// - Formularios en borrador.
// - Formularios archivados.
//
// Los participantes de los equipos archivados se conservan
// en la base de datos, pero pueden inscribirse en otros equipos.
// ============================================================

async function comprobarDuplicadosInscritos({
  edicionID,
  participantes,
  equipoActualID,
}: {
  edicionID: string;
  participantes: ParticipanteEntrada[];
  equipoActualID: string | null;
}) {
  await comprobarDuplicadosEdicion(edicionID, participantes, equipoActualID);
}

// ============================================================
// COMPROBAR FORMULARIO VISIBLE PARA EL USUARIO
// ============================================================

function exigirFormularioVisible(formulario: FormularioDB) {
  if (esFormularioArchivado(formulario)) {
    throw new ErrorAPI(404, "No s'ha trobat la inscripció.");
  }
}

// ============================================================
// COMPARAR VERSIONES
// ============================================================

function mismaVersion(actual: string | null, esperada: string | null) {
  if (actual === esperada) {
    return true;
  }

  if (!actual || !esperada) {
    return false;
  }

  const fechaActual = Date.parse(actual);

  const fechaEsperada = Date.parse(esperada);

  return (
    Number.isFinite(fechaActual) &&
    Number.isFinite(fechaEsperada) &&
    fechaActual === fechaEsperada
  );
}

// ============================================================
// COMPROBAR FORMULARIO ACTIVO
// ============================================================

async function comprobarFormularioActivo(
  formularioID: string,
  edicionID: string,
  version?: string | null,
): Promise<FormularioDB> {
  const { data: formulario, error } = await supabaseAdmin
    .from("formularios")
    .select(CAMPOS_FORMULARIO)
    .eq("id", formularioID)
    .eq("edicion_id", edicionID)
    .eq("tipo", "EQUIPO")
    .is("archivado_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!formulario) {
    throw new ErrorAPI(404, "No s'ha trobat la inscripció.");
  }

  const resultado = formulario as FormularioDB;

  exigirFormularioVisible(resultado);

  if (version !== undefined && !mismaVersion(resultado.updated_at, version)) {
    throw new ErrorAPI(
      409,
      "La inscripció ha canviat mentre la modificaves. Torna a carregar-la.",
    );
  }

  return resultado;
}

// ============================================================
// CARGAR FORMULARIO VISIBLE
// ============================================================

async function cargarFormularioUsuario(formulario: FormularioDB) {
  exigirFormularioVisible(formulario);

  const actual = await comprobarFormularioActivo(
    formulario.id,
    formulario.edicion_id,
    formulario.updated_at,
  );

  const datos = await cargarFormularioCompleto(actual);

  await comprobarFormularioActivo(
    actual.id,
    actual.edicion_id,
    actual.updated_at,
  );

  return datos;
}

// ============================================================
// PARTICIPANTES PENDIENTES
// ============================================================

async function marcarParticipantesPendientes(equipoID: string, fecha: string) {
  const { error } = await supabaseAdmin
    .from("participantes_equipo")
    .update({
      validacion_estado: "PENDIENTE",

      updated_at: fecha,
    })
    .eq("equipo_id", equipoID)
    .eq("activo", true);

  if (error) {
    throw error;
  }
}

// ============================================================
// LIMPIAR ESCUDO TRAS ERROR DE CREACIÓN
// ============================================================

async function limpiarEscudoCreacion({
  torneoID,
  edicionID,
  equipoID,
}: {
  torneoID: string;
  edicionID: string;
  equipoID: string;
}) {
  try {
    await guardarEscudoEquipo({
      torneoID,
      edicionID,
      equipoID,
      escudo: null,
    });
  } catch (error) {
    console.error(
      `No s'ha pogut netejar l'escut de l'equip ${equipoID} després d'una creació fallida:`,
      error,
    );
  }
}

// ============================================================
// EMAIL
// ============================================================

async function enviarNotificacionInscripcion(
  formularioID: string,
  edicionID: string,
) {
  /*
   * Un fallo del correo nunca revierte la inscripción.
   * No se notifican formularios que ya no están activos.
   */

  try {
    const formulario = await comprobarFormularioActivo(formularioID, edicionID);

    if (estadoFormulario(formulario.estado) !== "EN_REVISION") {
      return;
    }

    const resultado = await notificarInscripcionEquipoEnviada(formularioID);

    if (resultado.enviados > 0) {
      console.info(
        `[EMAIL] Inscripció ${formularioID}: ${resultado.enviados} correu(s) enviat(s) correctament.`,
      );
    }

    if (resultado.fallidos > 0) {
      console.error(
        `[EMAIL] Inscripció ${formularioID}: han fallat ${resultado.fallidos} de ${resultado.destinatarios} correus.`,
      );
    }
  } catch (error) {
    console.error(
      `[EMAIL] No s'ha pogut enviar la notificació de la inscripció ${formularioID}:`,
      error,
    );
  }
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ url, cookies }) => {
  try {
    const usuario = await obtenerUsuario(cookies);

    const configuracionPlataforma = await obtenerConfiguracionPlataforma();

    const accesoAdmin = puedeIgnorarPeriodo(usuario, configuracionPlataforma);

    const sesion = {
      iniciada: Boolean(usuario),

      usuario: usuario
        ? {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido1: usuario.apellido1,
            apellido2: usuario.apellido2,
            email: usuario.email,
          }
        : null,
    };

    const alternativas = await obtenerEdicionesDisponibles(
      usuario,
      configuracionPlataforma,
    );

    const parametro = url.searchParams.get("edicionID");

    const permisosVacios = {
      propietario: false,
      capitan: false,
      puede_ver: false,
      puede_editar: false,
      puede_cambiar_acceso_capitan: false,
    };

    // ====================================================
    // SIN EDICIÓN
    // ====================================================

    if (!parametro) {
      return responder({
        success: true,
        disponible: false,
        motivo: "SIN_EDICION",

        mensaje: "Selecciona una edició per començar la inscripció.",

        sesion,
        torneo: null,
        edicion: null,
        configuracion: null,
        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: alternativas,

        accesoAdmin,
      });
    }

    // ====================================================
    // ID INVÁLIDO
    // ====================================================

    if (!UUID.test(parametro)) {
      return responder({
        success: true,
        disponible: false,
        motivo: "NO_TROBADA",

        mensaje: "L'edició seleccionada no existeix o ja no està disponible.",

        sesion,
        torneo: null,
        edicion: null,
        configuracion: null,
        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: alternativas,

        accesoAdmin,
      });
    }

    // ====================================================
    // EDICIÓN
    // ====================================================

    const edicion = await obtenerEdicion(parametro);

    if (!edicion) {
      return responder({
        success: true,
        disponible: false,
        motivo: "NO_TROBADA",

        mensaje: "L'edició seleccionada no existeix o ja no està disponible.",

        sesion,
        torneo: null,
        edicion: null,
        configuracion: null,
        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: alternativas,

        accesoAdmin,
      });
    }

    // ====================================================
    // TORNEO + CONFIGURACIÓN
    // ====================================================

    const [configuracionActual, torneo] = await Promise.all([
      obtenerConfiguracionEdicion(edicion.id),

      obtenerTorneo(edicion.torneo_id),
    ]);

    const otrasEdiciones = alternativas.filter(
      (alternativa) => alternativa.id !== edicion.id,
    );

    if (!configuracionActual) {
      return responder({
        success: true,
        disponible: false,
        motivo: "SIN_CONFIGURACION",

        mensaje:
          "Aquesta edició encara no té configurada la inscripció d'equips.",

        sesion,
        torneo,
        edicion,

        configuracion: null,

        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: otrasEdiciones,

        accesoAdmin,
      });
    }

    // ====================================================
    // EDICIÓN INACTIVA
    // ====================================================

    if (!edicionActiva(edicion.estado)) {
      return responder({
        success: true,
        disponible: false,
        motivo: "TANCADA",

        mensaje: "Aquesta edició no està activa.",

        sesion,
        torneo,
        edicion,

        configuracion: configuracionActual,

        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: otrasEdiciones,

        accesoAdmin,
      });
    }

    // ====================================================
    // PERÍODO
    // ====================================================

    const periodo = estadoPeriodo(configuracionActual);

    const puedeSaltarsePeriodo =
      accesoAdmin && (periodo === "PROXIMAMENTE" || periodo === "TANCADA");

    if (periodo !== "ABIERTA" && !puedeSaltarsePeriodo) {
      return responder({
        success: true,
        disponible: false,
        motivo: periodo,

        mensaje:
          periodo === "PROXIMAMENTE"
            ? "Les inscripcions d'aquesta edició encara no han començat."
            : periodo === "TANCADA"
              ? "Les inscripcions d'aquesta edició ja estan tancades."
              : "Aquesta edició no té un període d'inscripció vàlid.",

        sesion,
        torneo,
        edicion,

        configuracion: configuracionActual,

        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: otrasEdiciones,

        accesoAdmin,
      });
    }

    // ====================================================
    // SIN SESIÓN
    // ====================================================

    if (!usuario) {
      return responder({
        success: true,
        disponible: true,
        motivo: null,
        mensaje: null,

        sesion,
        torneo,
        edicion,

        configuracion: configuracionActual,

        formulario: null,

        permisos: permisosVacios,

        edicionesDisponibles: alternativas,

        accesoAdmin: false,
      });
    }

    // ====================================================
    // FORMULARIO PROPIETARIO
    // ====================================================

    // ====================================================
    // FORMULARIO NUEVO
    // ====================================================

    const responderFormularioNuevo = () =>
      responder({
        success: true,
        disponible: true,
        motivo: null,
        mensaje: null,

        sesion,
        torneo,
        edicion,

        configuracion: configuracionActual,

        formulario: null,

        permisos: {
          propietario: false,
          capitan: false,
          puede_ver: true,
          puede_editar: true,
          puede_cambiar_acceso_capitan: true,
        },

        edicionesDisponibles: alternativas,

        accesoAdmin,
      });

    // ====================================================
    // FORMULARIO PROPIETARIO
    // ====================================================

    let formulario = await obtenerFormularioPropietario(edicion.id, usuario.id);

    if (formulario && esFormularioArchivado(formulario)) {
      formulario = null;
    }

    let propietario = Boolean(formulario);

    let capitan = false;

    // ====================================================
    // FORMULARIO CAPITÁN
    // ====================================================

    if (!formulario) {
      formulario = await obtenerFormularioComoCapitan(edicion.id, usuario);

      if (formulario && esFormularioArchivado(formulario)) {
        formulario = null;
      }

      capitan = Boolean(formulario);
    }

    // ====================================================
    // COMPROBAR ACCESO ACTUAL
    // ====================================================

    if (formulario) {
      try {
        const acceso = await obtenerAccesoPorID(
          formulario.id,
          edicion.id,
          usuario,
        );

        exigirFormularioVisible(acceso.formulario);

        formulario = acceso.formulario;

        propietario = acceso.propietario;

        capitan = acceso.capitan;
      } catch (error) {
        if (
          error instanceof ErrorAPI &&
          (error.estado === 404 || error.estado === 403)
        ) {
          return responderFormularioNuevo();
        }

        throw error;
      }
    }

    // ====================================================
    // SIN FORMULARIO ACTIVO
    // ====================================================

    if (!formulario) {
      return responderFormularioNuevo();
    }

    // ====================================================
    // FORMULARIO EXISTENTE
    // ====================================================

    const permisos = permisosFormulario(formulario, propietario, capitan);

    if (!permisos.puede_ver) {
      return responderFormularioNuevo();
    }

    const configuracion = configuracionFormulario(
      formulario,
      configuracionActual,
    );

    let datosFormulario;

    try {
      datosFormulario = await cargarFormularioUsuario(formulario);
    } catch (error) {
      if (error instanceof ErrorAPI && error.estado === 404) {
        return responderFormularioNuevo();
      }

      throw error;
    }

    // ====================================================
    // RESPUESTA
    // ====================================================

    return responder({
      success: true,
      disponible: true,
      motivo: null,
      mensaje: null,

      sesion,
      torneo,
      edicion,
      configuracion,

      formulario: datosFormulario,

      permisos,

      edicionesDisponibles: alternativas,

      accesoAdmin,
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// POST
// CREAR FORMULARIO
// ============================================================

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const configuracionPlataforma = await obtenerConfiguracionPlataforma();

    const accesoAdmin = puedeIgnorarPeriodo(usuario, configuracionPlataforma);

    const emailContacto = obtenerEmailCreador(usuario, configuracionPlataforma);

    const cuerpo = await leerJSON(request);

    if (cuerpo.accion !== "crear") {
      throw new ErrorAPI(400, "L'acció sol·licitada no és vàlida.");
    }

    // ====================================================
    // EDICIÓN
    // ====================================================

    const edicionID = exigirUUID(cuerpo.edicionID, "de l'edició");

    const edicion = await obtenerEdicion(edicionID);

    if (!edicion || !edicionActiva(edicion.estado)) {
      throw new ErrorAPI(
        403,
        "Aquesta edició no està disponible per a inscripcions.",
      );
    }

    // ====================================================
    // CONFIGURACIÓN
    // ====================================================

    const configuracion = await obtenerConfiguracionEdicion(edicionID);

    if (!configuracion) {
      throw new ErrorAPI(
        403,
        "Aquesta edició no té configurada la inscripció d'equips.",
      );
    }

    // ====================================================
    // PERÍODO
    // ====================================================

    const periodo = estadoPeriodo(configuracion);

    const puedeSaltarsePeriodo =
      accesoAdmin && (periodo === "PROXIMAMENTE" || periodo === "TANCADA");

    if (periodo !== "ABIERTA" && !puedeSaltarsePeriodo) {
      throw new ErrorAPI(403, "El període d'inscripció no està obert.");
    }

    // ====================================================
    // FORMULARIO EXISTENTE
    // ====================================================
    //
    // Solo comprobamos inscripciones no archivadas.
    // ====================================================

    const existente = await obtenerFormularioPropietario(edicionID, usuario.id);

    if (existente && !esFormularioArchivado(existente)) {
      throw new ErrorAPI(
        409,
        "Ja tens una inscripció creada en aquesta edició.",
      );
    }

    // ====================================================
    // DATOS
    // ====================================================

    const datos = leerDatos(cuerpo.datos);

    validarEmails(datos.participantes, configuracionPlataforma);

    validarEmailsRepetidos(datos.participantes);

    validarEstructuraParticipantes(datos.participantes, configuracion);

    /*
     * Los borradores no reservan participantes.
     * No comprobamos duplicados entre equipos todavía.
     */

    const ahora = new Date().toISOString();

    const formularioID = randomUUID();

    const equipoID = randomUUID();

    // ====================================================
    // SUBIR ESCUDO
    // ====================================================

    let escudoGuardado: string | null = null;

    try {
      escudoGuardado = await guardarEscudoEquipo({
        torneoID: edicion.torneo_id,

        edicionID,
        equipoID,

        escudo: datos.equipo.escudo,
      });
    } catch (error) {
      console.error("Error pujant l'escut de l'equip:", error);

      throw new ErrorAPI(500, "No s'ha pogut pujar l'escut de l'equip.");
    }

    // ====================================================
    // FORMULARIO
    // ====================================================

    const { error: errorFormulario } = await supabaseAdmin
      .from("formularios")
      .insert({
        id: formularioID,

        edicion_id: edicionID,

        tipo: "EQUIPO",

        origen: "USUARIO",

        estado: "BORRADOR",

        usuario_id: usuario.id,

        email_contacto: emailContacto,

        acceso_capitan: false,

        configuracion_snapshot: configuracion,

        iniciado_at: ahora,

        enviado_at: null,

        completado_at: null,

        archivado_at: null,

        archivado_por: null,

        estado_previo_archivado: null,

        motivo_archivado: null,

        created_at: ahora,

        updated_at: ahora,
      });

    if (errorFormulario) {
      await limpiarEscudoCreacion({
        torneoID: edicion.torneo_id,

        edicionID,
        equipoID,
      });

      if (errorFormulario.code === "23505") {
        throw new ErrorAPI(
          409,
          "Ja existeix una inscripció amb aquestes dades.",
        );
      }

      throw errorFormulario;
    }

    // ====================================================
    // COMPROBAR FORMULARIO ANTES DE CREAR EQUIPO
    // ====================================================

    await comprobarFormularioActivo(formularioID, edicionID, ahora);

    // ====================================================
    // EQUIPO
    // ====================================================

    const { error: errorEquipo } = await supabaseAdmin.from("equipos").insert({
      id: equipoID,

      formulario_id: formularioID,

      nombre: datos.equipo.nombre || null,

      escudo: escudoGuardado,

      capitan_id: null,

      validacion_estado: "PENDIENTE",

      plaza_estado: "PENDIENTE",

      posicion_lista_espera: null,

      created_at: ahora,

      updated_at: ahora,
    });

    if (errorEquipo) {
      await limpiarEscudoCreacion({
        torneoID: edicion.torneo_id,

        edicionID,
        equipoID,
      });

      /*
       * Evitamos dejar un formulario huérfano si
       * no se ha podido crear el equipo.
       */

      const { error: errorLimpieza } = await supabaseAdmin
        .from("formularios")
        .delete()
        .eq("id", formularioID)
        .eq("edicion_id", edicionID)
        .eq("tipo", "EQUIPO")
        .eq("estado", "BORRADOR")
        .is("archivado_at", null)
        .eq("updated_at", ahora);

      if (errorLimpieza) {
        console.error(
          "Error netejant el formulari després d'una creació fallida:",
          errorLimpieza,
        );
      }

      throw errorEquipo;
    }

    // ====================================================
    // PARTICIPANTES
    // ====================================================

    if (datos.participantes.length > 0) {
      await comprobarFormularioActivo(formularioID, edicionID, ahora);

      await guardarParticipantes(equipoID, datos.participantes);

      await comprobarFormularioActivo(formularioID, edicionID, ahora);

      await marcarParticipantesPendientes(equipoID, ahora);
    }

    // ====================================================
    // RECARGAR
    // ====================================================

    const formularioGuardado = await comprobarFormularioActivo(
      formularioID,
      edicionID,
    );

    // ====================================================
    // RESPUESTA
    // ====================================================

    return responder({
      success: true,

      mensaje: "Inscripció guardada correctament.",

      formulario: await cargarFormularioUsuario(formularioGuardado),
    });
  } catch (error) {
    return responderError(error);
  }
};

// ============================================================
// PATCH
// GUARDAR / ENVIAR
// ============================================================

export const PATCH: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const configuracionPlataforma = await obtenerConfiguracionPlataforma();

    const accesoAdmin = puedeIgnorarPeriodo(usuario, configuracionPlataforma);

    const cuerpo = await leerJSON(request);

    if (cuerpo.accion !== "guardar" && cuerpo.accion !== "enviar") {
      throw new ErrorAPI(400, "L'acció sol·licitada no és vàlida.");
    }

    const enviar = cuerpo.accion === "enviar";

    const edicionID = exigirUUID(cuerpo.edicionID, "de l'edició");

    const formularioID = exigirUUID(cuerpo.formularioID, "del formulari");

    // ====================================================
    // EDICIÓN
    // ====================================================

    const edicion = await obtenerEdicion(edicionID);

    if (!edicion || !edicionActiva(edicion.estado)) {
      throw new ErrorAPI(
        403,
        "Aquesta edició no està disponible per a inscripcions.",
      );
    }

    // ====================================================
    // CONFIGURACIÓN
    // ====================================================

    const configuracionActual = await obtenerConfiguracionEdicion(edicionID);

    if (!configuracionActual) {
      throw new ErrorAPI(
        403,
        "Aquesta edició no té configurada la inscripció d'equips.",
      );
    }

    // ====================================================
    // PERÍODO
    // ====================================================

    const periodo = estadoPeriodo(configuracionActual);

    const puedeSaltarsePeriodo =
      accesoAdmin && (periodo === "PROXIMAMENTE" || periodo === "TANCADA");

    if (periodo !== "ABIERTA" && !puedeSaltarsePeriodo) {
      throw new ErrorAPI(403, "El període d'inscripció no està obert.");
    }

    // ====================================================
    // ACCESO
    // ====================================================

    const acceso = await obtenerAccesoPorID(formularioID, edicionID, usuario);

    // ====================================================
    // PROTEGER FORMULARIOS ARCHIVADOS
    // ====================================================

    exigirFormularioVisible(acceso.formulario);

    if (!acceso.puede_ver) {
      throw new ErrorAPI(403, "No tens accés a aquesta inscripció.");
    }

    if (!acceso.puede_editar) {
      throw new ErrorAPI(
        409,
        "La inscripció està en revisió i no es pot modificar.",
      );
    }

    const versionFormulario = acceso.formulario.updated_at;

    // ====================================================
    // CONFIGURACIÓN
    // ====================================================

    const configuracion = configuracionFormulario(
      acceso.formulario,
      configuracionActual,
    );

    // ====================================================
    // DATOS
    // ====================================================

    const datos = leerDatos(cuerpo.datos);

    validarEmails(datos.participantes, configuracionPlataforma);

    validarEmailsRepetidos(datos.participantes);

    validarEstructuraParticipantes(datos.participantes, configuracion);

    if (enviar) {
      validarEnvio(datos, configuracion);
    }

    // ====================================================
    // EQUIPO
    // ====================================================

    let equipo = acceso.equipo;

    const ahora = new Date().toISOString();

    // ====================================================
    // COMPROBACIÓN ANTES DE MODIFICAR
    // ====================================================

    await comprobarFormularioActivo(formularioID, edicionID, versionFormulario);

    // ====================================================
    // CREAR EQUIPO SI FALTA
    // ====================================================

    if (!equipo) {
      const equipoID = randomUUID();

      const escudoGuardado = await guardarEscudoEquipo({
        torneoID: edicion.torneo_id,

        edicionID,
        equipoID,

        escudo: datos.equipo.escudo,
      });

      try {
        await comprobarFormularioActivo(
          formularioID,
          edicionID,
          versionFormulario,
        );
      } catch (error) {
        await limpiarEscudoCreacion({
          torneoID: edicion.torneo_id,

          edicionID,
          equipoID,
        });

        throw error;
      }

      const { error } = await supabaseAdmin.from("equipos").insert({
        id: equipoID,

        formulario_id: formularioID,

        nombre: datos.equipo.nombre || null,

        escudo: escudoGuardado,

        capitan_id: null,

        validacion_estado: "PENDIENTE",

        plaza_estado: "PENDIENTE",

        posicion_lista_espera: null,

        created_at: ahora,

        updated_at: ahora,
      });

      if (error) {
        await limpiarEscudoCreacion({
          torneoID: edicion.torneo_id,

          edicionID,
          equipoID,
        });

        throw error;
      }

      equipo = await obtenerEquipoFormulario(formularioID);
    }

    if (!equipo) {
      throw new ErrorAPI(500, "No s'ha pogut preparar l'equip.");
    }

    if (datos.equipo.id && datos.equipo.id !== equipo.id) {
      throw new ErrorAPI(
        400,
        "L'equip indicat no correspon a aquest formulari.",
      );
    }

    // ====================================================
    // DUPLICADOS
    // ====================================================
    //
    // Los equipos archivados y los borradores no
    // reservan participantes.
    // ====================================================

    if (enviar) {
      await comprobarDuplicadosInscritos({
        edicionID,

        participantes: datos.participantes,

        equipoActualID: equipo.id,
      });
    }

    // ====================================================
    // CAPITÁN
    // ====================================================

    let capitanID = acceso.propietario
      ? datos.equipo.capitan_id
      : equipo.capitan_id;

    if (
      capitanID &&
      !datos.participantes.some(
        (participante) =>
          participante.id === capitanID &&
          participante.tipo_participante === "JUGADOR",
      )
    ) {
      if (enviar) {
        throw new ErrorAPI(
          400,
          "El capità seleccionat ja no forma part dels jugadors de l'equip.",
        );
      }

      capitanID = null;
    }

    // ====================================================
    // PROTEGER EMAIL DEL CAPITÁN
    // ====================================================

    if (acceso.capitan && !acceso.propietario && equipo.capitan_id) {
      const participanteCapitan = datos.participantes.find(
        (participante) => participante.id === equipo.capitan_id,
      );

      if (
        !participanteCapitan ||
        normalizarEmail(participanteCapitan.email) !==
          normalizarEmail(usuario.email ?? "")
      ) {
        throw new ErrorAPI(
          403,
          "El capità no pot modificar el correu que li dona accés al formulari.",
        );
      }
    }

    // ====================================================
    // COMPROBAR FORMULARIO ANTES DE GUARDAR
    // ====================================================

    await comprobarFormularioActivo(formularioID, edicionID, versionFormulario);

    // ====================================================
    // PARTICIPANTES
    // ====================================================

    await guardarParticipantes(equipo.id, datos.participantes);

    await comprobarFormularioActivo(formularioID, edicionID, versionFormulario);

    await marcarParticipantesPendientes(equipo.id, ahora);

    // ====================================================
    // COMPROBAR CAPITÁN
    // ====================================================

    if (capitanID) {
      const {
        data: capitan,

        error: errorCapitan,
      } = await supabaseAdmin
        .from("participantes_equipo")
        .select("id,tipo_participante,activo,email")
        .eq("id", capitanID)
        .eq("equipo_id", equipo.id)
        .eq("activo", true)
        .maybeSingle();

      if (errorCapitan) {
        throw errorCapitan;
      }

      if (!capitan || capitan.tipo_participante !== "JUGADOR") {
        if (enviar) {
          throw new ErrorAPI(400, "El capità seleccionat no és vàlid.");
        }

        capitanID = null;
      }
    }

    // ====================================================
    // ACCESO CAPITÁN
    // ====================================================

    let accesoCapitan = acceso.propietario
      ? datos.acceso_capitan
      : acceso.formulario.acceso_capitan === true;

    if (!capitanID) {
      accesoCapitan = false;
    }

    // ====================================================
    // PROTEGER ANTES DE MODIFICAR EL ESCUDO
    // ====================================================

    await comprobarFormularioActivo(formularioID, edicionID, versionFormulario);

    // ====================================================
    // ESCUDO
    // ====================================================

    let escudoGuardado: string | null;

    try {
      escudoGuardado = await guardarEscudoEquipo({
        torneoID: edicion.torneo_id,

        edicionID,

        equipoID: equipo.id,

        escudo: datos.equipo.escudo,
      });
    } catch (error) {
      console.error("Error actualitzant l'escut de l'equip:", error);

      throw new ErrorAPI(500, "No s'ha pogut guardar l'escut de l'equip.");
    }

    // ====================================================
    // COMPROBAR ANTES DE ACTUALIZAR EQUIPO
    // ====================================================

    await comprobarFormularioActivo(formularioID, edicionID, versionFormulario);

    // ====================================================
    // ACTUALIZAR EQUIPO
    // ====================================================

    const { error: errorEquipo } = await supabaseAdmin
      .from("equipos")
      .update({
        nombre: datos.equipo.nombre || null,

        escudo: escudoGuardado,

        capitan_id: capitanID,

        validacion_estado: "PENDIENTE",

        updated_at: ahora,
      })
      .eq("id", equipo.id)
      .eq("formulario_id", formularioID);

    if (errorEquipo) {
      throw errorEquipo;
    }

    // ====================================================
    // ESTADO ANTERIOR
    // ====================================================

    const estadoAnterior = estadoFormulario(acceso.formulario.estado);

    // ====================================================
    // NUEVO ESTADO
    // ====================================================

    const nuevoEstado: EstadoFormulario = enviar
      ? "EN_REVISION"
      : estadoAnterior === "APROBADO" || estadoAnterior === "DENEGADO"
        ? "BORRADOR"
        : estadoAnterior;

    // ====================================================
    // COMPROBACIÓN FINAL DE DUPLICADOS
    // ====================================================

    if (enviar) {
      await comprobarDuplicadosInscritos({
        edicionID,

        participantes: datos.participantes,

        equipoActualID: equipo.id,
      });
    }

    // ====================================================
    // ACTUALIZAR FORMULARIO
    // ====================================================
    //
    // No se permite actualizar un formulario que haya
    // sido archivado o modificado durante la petición.
    // ====================================================

    let consultaFormulario = supabaseAdmin
      .from("formularios")
      .update({
        acceso_capitan: accesoCapitan,

        estado: nuevoEstado,

        enviado_at: enviar
          ? ahora
          : nuevoEstado === "BORRADOR"
            ? null
            : acceso.formulario.enviado_at,

        completado_at: null,

        updated_at: ahora,
      })
      .eq("id", formularioID)
      .eq("edicion_id", edicionID)
      .eq("tipo", "EQUIPO")
      .is("archivado_at", null);

    if (versionFormulario === null) {
      consultaFormulario = consultaFormulario.is("updated_at", null);
    } else {
      consultaFormulario = consultaFormulario.eq(
        "updated_at",
        versionFormulario,
      );
    }

    const {
      data: formularioGuardado,

      error: errorFormulario,
    } = await consultaFormulario.select(CAMPOS_FORMULARIO).maybeSingle();

    if (errorFormulario) {
      throw errorFormulario;
    }

    if (!formularioGuardado) {
      await comprobarFormularioActivo(
        formularioID,
        edicionID,
        versionFormulario,
      );

      throw new ErrorAPI(
        409,
        "La inscripció ha canviat mentre la modificaves. Torna a carregar-la.",
      );
    }

    const formularioFinal = formularioGuardado as FormularioDB;

    exigirFormularioVisible(formularioFinal);

    // ====================================================
    // EMAIL
    // ====================================================

    if (enviar && nuevoEstado === "EN_REVISION") {
      await enviarNotificacionInscripcion(formularioID, edicionID);
    }

    // ====================================================
    // RESPUESTA
    // ====================================================

    return responder({
      success: true,

      mensaje: enviar
        ? "La inscripció s'ha enviat a revisió."
        : "La inscripció s'ha guardat correctament.",

      formulario: await cargarFormularioUsuario(formularioFinal),
    });
  } catch (error) {
    return responderError(error);
  }
};
