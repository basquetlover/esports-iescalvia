import type { APIRoute } from "astro";

import { comprobarOrigen, leerJSON } from "@utils/inscripcio/equipBase";

import {
  ErrorAPI,
  esBorradorAdministrativo,
  esRegistro,
  leerIDAdmin,
  nombreCompleto,
  normalizarEstadoFormulario,
  normalizarEstadoPlaza,
  normalizarOrigenFormulario,
  normalizarValidacion,
  obtenerCapacidadesEquipo,
  obtenerDatosArchivo,
  obtenerEstadoFormularioVisible,
  obtenerConfiguracionFormularioAdmin,
  obtenerContextoEquipoAdmin,
  obtenerObservacionesAdmin,
  obtenerParticipantesAdmin,
  obtenerResponsableAdmin,
  prepararParticipanteSalida,
  responder,
  responderErrorAdmin,
  type AccionEquipos,
  type Registro,
} from "@utils/panell/equips/adminComun";

import { editarEquipoAdmin } from "@utils/panell/equips/adminEdicion";

import {
  aprobarEquipoAdmin,
  cambiarEstadoEvaluacionEquipoAdmin,
  cambiarPlazaEquipoAdmin,
  finalizarBorradorEquipoAdmin,
  solicitarCambiosEquipoAdmin,
} from "@utils/panell/equips/adminEvaluacion";

import {
  archivarEquipoAdmin,
  eliminarEquipoAdmin,
} from "@utils/panell/equips/adminAcciones";

// ============================================================
// ACCIONES
// ============================================================

type AccionPatch =
  | "editar"
  | "aprobar"
  | "finalizar-borrador"
  | "solicitar-cambios"
  | "cambiar-evaluacion"
  | "cambiar-plaza"
  | "archivar"
  | "eliminar";

const ACCIONES_PATCH = [
  "editar",
  "aprobar",
  "finalizar-borrador",
  "solicitar-cambios",
  "cambiar-evaluacion",
  "cambiar-plaza",
  "archivar",
  "eliminar",
] as const;

// ============================================================
// LEER ACCIÓN
// ============================================================

function leerAccion(cuerpo: Registro): AccionPatch {
  if (typeof cuerpo.accion !== "string") {
    throw new ErrorAPI(400, "Falta l'acció que vols realitzar.");
  }

  const accion = cuerpo.accion.trim().toLowerCase();

  if (!ACCIONES_PATCH.includes(accion as AccionPatch)) {
    throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
  }

  return accion as AccionPatch;
}

// ============================================================
// PREPARAR RESPONSABLE
// ============================================================

function prepararResponsable({
  responsable,
  emailContacto,
}: {
  responsable: Awaited<ReturnType<typeof obtenerResponsableAdmin>>;

  emailContacto: string | null;
}) {
  if (!responsable) {
    return {
      id: null,

      nombre: "",

      apellido1: "",

      apellido2: "",

      nombre_completo: "",

      email: emailContacto ?? "",

      curso: "",

      ano_academico: "",
    };
  }

  return {
    id: responsable.id,

    nombre: responsable.nombre ?? "",

    apellido1: responsable.apellido1 ?? "",

    apellido2: responsable.apellido2 ?? "",

    nombre_completo: nombreCompleto(responsable),

    email: responsable.email ?? emailContacto ?? "",

    curso: responsable.curso ?? "",

    ano_academico: responsable.ano_academico ?? "",
  };
}

// ============================================================
// PREPARAR OBSERVACIONES
// ============================================================

function prepararObservaciones(
  observaciones: Awaited<ReturnType<typeof obtenerObservacionesAdmin>>,
) {
  return observaciones.map((observacion) => ({
    id: observacion.id,

    edicion_id: observacion.edicion_id,

    formulario_id: observacion.formulario_id,

    entidad_tipo: observacion.entidad_tipo ?? "",

    entidad_id: observacion.entidad_id,

    campo: observacion.campo ?? "",

    mensaje: observacion.mensaje ?? "",

    estado: observacion.estado ?? "",

    creada_por: observacion.creada_por,

    resuelta_por: observacion.resuelta_por,

    created_at: observacion.created_at,
  }));
}

// ============================================================
// GET
// OBTENER DETALLE DEL EQUIPO
// ============================================================
//
// Permite consultar:
//
// - Equipos en borrador.
// - Equipos enviados.
// - Equipos aprobados.
// - Equipos pendientes de correcciones.
// - Equipos archivados.
//
// Los equipos archivados conservan sus datos, pero no
// disponen de capacidades administrativas de modificación.
// ============================================================

export const obtenerDetalleEquipoAdmin: APIRoute = async ({
  cookies,
  url,
  params,
}) => {
  try {
    // =================================================
    // IDS
    // =================================================

    const equipoID = leerIDAdmin(params.id, "id");

    const torneoID = leerIDAdmin(url.searchParams.get("torneoID"), "torneoID");

    const edicionID = leerIDAdmin(
      url.searchParams.get("edicionID"),
      "edicionID",
    );

    // =================================================
    // CONTEXTO
    // =================================================
    //
    // La acción "ver" permite consultar también
    // formularios archivados.
    // =================================================

    const contexto = await obtenerContextoEquipoAdmin({
      cookies,

      equipoID,

      torneoID,

      edicionID,

      accion: "ver",
    });

    const { usuario, torneo, edicion, equipo, formulario } = contexto;

    // =================================================
    // DATOS RELACIONADOS
    // =================================================

    const [participantes, responsable, observaciones, configuracion] =
      await Promise.all([
        obtenerParticipantesAdmin(equipo.id),

        obtenerResponsableAdmin(formulario.usuario_id),

        obtenerObservacionesAdmin(formulario.id),

        obtenerConfiguracionFormularioAdmin(formulario),
      ]);

    // =================================================
    // PARTICIPANTES
    // =================================================
    //
    // Aunque el equipo esté archivado, se mantienen
    // disponibles todos sus participantes activos
    // para consultar la composición histórica.
    // =================================================

    const filasParticipantes = participantes.map((participante) =>
      prepararParticipanteSalida(participante, equipo.capitan_id),
    );

    const capitan =
      filasParticipantes.find((participante) => participante.es_capitan) ??
      null;

    // =================================================
    // ESTADO REAL DEL FORMULARIO
    // =================================================

    const estadoFormulario = normalizarEstadoFormulario(formulario.estado);

    // =================================================
    // ESTADO VISIBLE
    // =================================================
    //
    // ARCHIVADO es un estado visual.
    //
    // El estado original de Supabase se conserva
    // sin modificaciones.
    // =================================================

    const estadoVisible = obtenerEstadoFormularioVisible(formulario);

    // =================================================
    // DATOS DE ARCHIVO
    // =================================================

    const archivo = obtenerDatosArchivo(formulario);

    const archivado = archivo.archivado;

    // =================================================
    // RESPONSABLE DEL ARCHIVO
    // =================================================

    const responsableArchivo =
      archivado && archivo.archivado_por
        ? await obtenerResponsableAdmin(archivo.archivado_por)
        : null;

    // =================================================
    // CAPACIDADES
    // =================================================
    //
    // Las capacidades se calculan según:
    //
    // - Permisos del usuario.
    // - Estado de la inscripción.
    // - Si el formulario está archivado.
    //
    // Solo los borradores no archivados pueden
    // eliminarse definitivamente.
    // =================================================

    const capacidadesBase = obtenerCapacidadesEquipo(
      usuario,
      torneoID,
      formulario,
    );

    // =================================================
    // FINALIZAR BORRADOR ADMINISTRATIVO
    // =================================================

    const puedeFinalizarBorrador =
      !archivado &&
      capacidadesBase.evaluar &&
      esBorradorAdministrativo(formulario);

    // =================================================
    // CAMBIAR EVALUACIÓN
    // =================================================

    const puedeCambiarEvaluacion =
      !archivado && capacidadesBase.evaluar && estadoFormulario !== "BORRADOR";

    // =================================================
    // ESTADO DE LA PLAZA
    // =================================================
    //
    // Se conserva el estado histórico de la plaza.
    //
    // El campo plaza_activa permite distinguir
    // si la inscripción puede ocupar plaza.
    // =================================================

    const estadoPlaza = normalizarEstadoPlaza(equipo.plaza_estado);

    const plazaActiva =
      !archivado &&
      estadoFormulario !== "BORRADOR" &&
      estadoPlaza === "CONFIRMADA";

    // =================================================
    // RESPUESTA
    // =================================================

    return responder({
      success: true,

      // =============================================
      // TORNEO
      // =============================================

      torneo: {
        id: torneo.id,

        nombre: torneo.nombre ?? "Torneig",

        deporte: torneo.deporte,

        logo: torneo.logo,
      },

      // =============================================
      // EDICIÓN
      // =============================================

      edicion: {
        id: edicion.id,

        torneo_id: edicion.torneo_id,

        nombre: edicion.nombre ?? "Edició",

        estado: edicion.estado ?? "",

        sede: edicion.sede,

        fecha_inicio: edicion.fecha_inicio,

        fecha_fin: edicion.fecha_fin,
      },

      // =============================================
      // CONFIGURACIÓN
      // =============================================

      configuracion,

      // =============================================
      // EQUIPO
      // =============================================

      equipo: {
        id: equipo.id,

        formulario_id: equipo.formulario_id,

        nombre: equipo.nombre ?? "",

        escudo: equipo.escudo,

        capitan_id: equipo.capitan_id,

        validacion_estado: normalizarValidacion(equipo.validacion_estado),

        plaza_estado: estadoPlaza,

        plaza_activa: plazaActiva,

        posicion_lista_espera: equipo.posicion_lista_espera,

        nota_admin: equipo.nota_admin,

        archivado,

        created_at: equipo.created_at,

        updated_at: equipo.updated_at,
      },

      // =============================================
      // FORMULARIO
      // =============================================

      formulario: {
        id: formulario.id,

        /*
         * Estado real de la base de datos.
         * Se conserva por compatibilidad con
         * las funcionalidades existentes.
         */

        estado: estadoFormulario,

        /*
         * Estado que deberá mostrar la interfaz.
         */

        estado_visible: estadoVisible,

        origen: normalizarOrigenFormulario(formulario.origen),

        usuario_id: formulario.usuario_id,

        email_contacto: formulario.email_contacto ?? "",

        acceso_capitan: formulario.acceso_capitan === true,

        iniciado_at: formulario.iniciado_at,

        enviado_at: formulario.enviado_at,

        completado_at: formulario.completado_at,

        created_at: formulario.created_at,

        updated_at: formulario.updated_at,

        // =========================================
        // DATOS DE ARCHIVO
        // =========================================

        archivado,

        archivado_at: archivo.archivado_at,

        archivado_por: archivo.archivado_por,

        estado_previo_archivado: archivo.estado_previo_archivado,

        motivo_archivado: archivo.motivo_archivado,
      },

      // =============================================
      // INFORMACIÓN DEL ARCHIVO
      // =============================================

      archivo: {
        ...archivo,

        responsable: responsableArchivo
          ? {
              id: responsableArchivo.id,

              nombre: responsableArchivo.nombre ?? "",

              apellido1: responsableArchivo.apellido1 ?? "",

              apellido2: responsableArchivo.apellido2 ?? "",

              nombre_completo: nombreCompleto(responsableArchivo),
            }
          : null,
      },

      // =============================================
      // RESPONSABLE
      // =============================================

      responsable: prepararResponsable({
        responsable,

        emailContacto: formulario.email_contacto,
      }),

      // =============================================
      // PARTICIPANTES
      // =============================================

      participantes: {
        total: filasParticipantes.length,

        jugadores: filasParticipantes.filter(
          (participante) => participante.tipo_participante === "JUGADOR",
        ).length,

        profesores: filasParticipantes.filter(
          (participante) => participante.tipo_participante === "PROFESOR",
        ).length,

        entrenadores: filasParticipantes.filter(
          (participante) => participante.tipo_participante === "ENTRENADOR",
        ).length,

        staff: filasParticipantes.filter(
          (participante) => participante.tipo_participante === "STAFF",
        ).length,

        capitan,

        filas: filasParticipantes,
      },

      // =============================================
      // OBSERVACIONES
      // =============================================

      observaciones: prepararObservaciones(observaciones),

      // =============================================
      // CAPACIDADES
      // =============================================

      capacidades: {
        ...capacidadesBase,

        finalizarBorrador: puedeFinalizarBorrador,

        cambiarEvaluacion: puedeCambiarEvaluacion,
      },
    });
  } catch (error) {
    return responderErrorAdmin(error);
  }
};

// ============================================================
// OBTENER PERMISO SEGÚN ACCIÓN
// ============================================================
//
// Se relacionan las acciones de la API con las acciones
// administrativas definidas en adminComun.ts.
//
// Archivar y eliminar utilizan el permiso existente
// equips.eliminar.
// ============================================================

function obtenerPermisoSegunAccion(accion: AccionPatch): AccionEquipos {
  switch (accion) {
    // ====================================================
    // EDITAR
    // ====================================================

    case "editar":
      return "editar";

    // ====================================================
    // CAMBIAR PLAZA
    // ====================================================

    case "cambiar-plaza":
      return "canviar-estat";

    // ====================================================
    // ARCHIVAR
    // ====================================================

    case "archivar":
      return "archivar";

    // ====================================================
    // ELIMINAR
    // ====================================================

    case "eliminar":
      return "eliminar";

    // ====================================================
    // EVALUACIÓN
    // ====================================================

    case "aprobar":

    case "finalizar-borrador":

    case "solicitar-cambios":

    case "cambiar-evaluacion":
      return "evaluar";
  }
}

// ============================================================
// CONTEXTO SEGÚN ACCIÓN
// ============================================================

async function obtenerContextoSegunAccion({
  accion,
  cookies,
  equipoID,
  torneoID,
  edicionID,
}: {
  accion: AccionPatch;

  cookies: Parameters<APIRoute>[0]["cookies"];

  equipoID: string;

  torneoID: string;

  edicionID: string;
}) {
  const permiso = obtenerPermisoSegunAccion(accion);

  return obtenerContextoEquipoAdmin({
    cookies,

    equipoID,

    torneoID,

    edicionID,

    accion: permiso,
  });
}

// ============================================================
// PATCH
// MODIFICAR DETALLE DEL EQUIPO
// ============================================================
//
// Acciones disponibles:
//
// - editar
// - aprobar
// - finalizar-borrador
// - solicitar-cambios
// - cambiar-evaluacion
// - cambiar-plaza
// - archivar
// - eliminar
// ============================================================

export const modificarDetalleEquipoAdmin: APIRoute = async ({
  cookies,
  url,
  params,
  request,
}) => {
  try {
    // =================================================
    // ORIGEN HTTP
    // =================================================

    comprobarOrigen(request, url);

    // =================================================
    // JSON
    // =================================================

    const cuerpo = await leerJSON(request);

    if (!esRegistro(cuerpo)) {
      throw new ErrorAPI(400, "La petició no és vàlida.");
    }

    // =================================================
    // ACCIÓN
    // =================================================

    const accion = leerAccion(cuerpo);

    // =================================================
    // IDS
    // =================================================

    const equipoID = leerIDAdmin(params.id, "id");

    const torneoID = leerIDAdmin(cuerpo.torneoID, "torneoID");

    const edicionID = leerIDAdmin(cuerpo.edicionID, "edicionID");

    // =================================================
    // CONTEXTO + PERMISOS
    // =================================================
    //
    // Comprueba automáticamente:
    //
    // - Sesión del usuario.
    // - Acceso al torneo.
    // - Permisos administrativos.
    // - Pertenencia del equipo a la edición.
    // - Estado del formulario.
    // - Si la inscripción está archivada.
    // =================================================

    const contexto = await obtenerContextoSegunAccion({
      accion,

      cookies,

      equipoID,

      torneoID,

      edicionID,
    });

    // =================================================
    // ARCHIVAR EQUIPO
    // =================================================

    if (accion === "archivar") {
      const resultado = await archivarEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // ELIMINAR EQUIPO
    // =================================================

    if (accion === "eliminar") {
      const resultado = await eliminarEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // EDITAR
    // =================================================

    if (accion === "editar") {
      const resultado = await editarEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // APROBAR
    // =================================================

    if (accion === "aprobar") {
      const resultado = await aprobarEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // FINALIZAR BORRADOR ADMIN
    // =================================================

    if (accion === "finalizar-borrador") {
      const resultado = await finalizarBorradorEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // CAMBIAR ESTADO DE EVALUACIÓN
    // =================================================

    if (accion === "cambiar-evaluacion") {
      const resultado = await cambiarEstadoEvaluacionEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // SOLICITAR CAMBIOS
    // =================================================

    if (accion === "solicitar-cambios") {
      const resultado = await solicitarCambiosEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // CAMBIAR PLAZA
    // =================================================

    if (accion === "cambiar-plaza") {
      const resultado = await cambiarPlazaEquipoAdmin({
        contexto,

        cuerpo,
      });

      return responder({
        success: true,

        ...resultado,
      });
    }

    // =================================================
    // ACCIÓN NO VÁLIDA
    // =================================================

    throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
  } catch (error) {
    return responderErrorAdmin(error);
  }
};
