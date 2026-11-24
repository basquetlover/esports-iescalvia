import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarDuplicadosEdicion,
  validarEmails,
  validarEmailsRepetidos,
  validarEnvio,
  validarEstructuraParticipantes,
  type DatosEntrada,
  type ParticipanteDB,
  type ParticipanteEntrada,
} from "@utils/inscripcio/equipBase";

import {
  notificarRevisionEquipo,
  type TipoRevisionEquipo,
} from "@utils/inscripcio/equipRevisionEmails";

import { enviarNotificacionPlazaConfirmada } from "@utils/inscripcio/equipPlazaConfirmadaEmails";

import { enviarNotificacionSinPlaza } from "@utils/inscripcio/equipSinPlazaEmails";

import { notificarEquipoListaEspera } from "@utils/inscripcio/equipListaEsperaEmails";

import {
  CAMPOS_EQUIPO,
  CAMPOS_FORMULARIO,
  ESTADOS_PLAZA,
  ErrorAPI,
  MAX_CAMPO_OBSERVACION,
  MAX_MENSAJE_OBSERVACION,
  MAX_NOTA_ADMIN,
  MAX_OBSERVACIONES,
  TIPOS_ENTIDAD_OBSERVACION,
  comprobarFormularioActivoAdmin,
  esBorradorAdministrativo,
  esFormularioArchivado,
  esRegistro,
  exigirFormularioNoArchivado,
  exigirMismaVersion,
  exigirPermisoEquip,
  leerIDAdmin,
  leerTextoAdmin,
  normalizarEmail,
  normalizarEstadoFormulario,
  normalizarEstadoPlaza,
  normalizarTipoParticipante,
  obtenerConfiguracionFormularioAdmin,
  obtenerConfiguracionPlataformaAdmin,
  obtenerFormularioAdmin,
  obtenerObservacionesAdmin,
  obtenerParticipantesAdmin,
  validarEmailResponsable,
  type ContextoEquipoAdmin,
  type EstadoPlaza,
  type ObservacionEntradaAdmin,
  type Registro,
  type TipoEntidadObservacion,
} from "@utils/panell/equips/adminComun";

// ============================================================
// CONSTANTES
// ============================================================

const ESTADOS_CAMBIO_ADMIN = ["EN_REVISION", "APROBADO", "DENEGADO"] as const;

type EstadoCambioAdmin = (typeof ESTADOS_CAMBIO_ADMIN)[number];

// ============================================================
// RESULTADOS
// ============================================================

export type ResultadoAprobacionAdmin = {
  mensaje: string;

  formulario: {
    id: string;
    estado: "APROBADO";
    enviado_at: string | null;
    completado_at: string | null;
    updated_at: string;
  };
};

export type ResultadoCambioEstadoAdmin = {
  mensaje: string;

  formulario: {
    id: string;
    estado: EstadoCambioAdmin;
    enviado_at: string | null;
    completado_at: string | null;
    updated_at: string;
  };

  equipo: {
    id: string;
    validacion_estado: string;
    updated_at: string;
  };
};

export type ResultadoCambiosAdmin = {
  mensaje: string;

  formulario: {
    id: string;
    estado: "DENEGADO";
    completado_at: string | null;
    updated_at: string;
  };

  observacionesCreadas: number;
};

export type ResultadoPlazaAdmin = {
  mensaje: string;

  equipo: {
    id: string;
    plaza_estado: EstadoPlaza;
    posicion_lista_espera: number | null;
    nota_admin: string | null;
    updated_at: string;
  };
};

// ============================================================
// SNAPSHOTS
// ============================================================

type EstadoParticipanteAnterior = {
  id: string;
  validacion_estado: string | null;
};

type SnapshotEvaluacion = {
  formulario: {
    estado: string | null;
    enviado_at: string | null;
    completado_at: string | null;
  };

  equipo: {
    validacion_estado: string | null;
  };

  participantes: EstadoParticipanteAnterior[];
};

type ParametrosEvaluacionAdmin = {
  contexto: ContextoEquipoAdmin;
  cuerpo: Registro;
};

// ============================================================
// COMPROBAR FORMULARIO ACTIVO
// ============================================================
//
// Los equipos archivados se pueden consultar, pero no
// evaluar, aprobar, corregir ni modificar.
//
// También se comprueba que la versión del formulario
// no haya cambiado durante la operación.
// ============================================================

async function comprobarEvaluacionActiva(
  contexto: ContextoEquipoAdmin,
  version: string = contexto.formulario.updated_at,
) {
  exigirFormularioNoArchivado(contexto.formulario);

  return comprobarFormularioActivoAdmin(
    contexto.formulario.id,
    contexto.edicion.id,
    version,
  );
}

// ============================================================
// COMPROBAR SI SE PUEDE COMPENSAR UNA OPERACIÓN
// ============================================================
//
// Las compensaciones solo se realizan si el formulario
// sigue perteneciendo a la operación correspondiente
// y no ha sido archivado.
// ============================================================

async function puedeCompensarOperacion(
  contexto: ContextoEquipoAdmin,
  marcaOperacion: string,
): Promise<boolean> {
  try {
    const formulario = await obtenerFormularioAdmin(
      contexto.formulario.id,
      contexto.edicion.id,
    );

    return (
      !esFormularioArchivado(formulario) &&
      formulario.updated_at === marcaOperacion
    );
  } catch (error) {
    console.error(
      "No s'ha pogut comprovar si es pot restaurar l'avaluació:",
      error,
    );

    return false;
  }
}

// ============================================================
// EMAIL · REVISIÓN
// ============================================================

async function enviarNotificacionRevision({
  formularioID,
  tipo,
  observacionesIDs = [],
}: {
  formularioID: string;
  tipo: TipoRevisionEquipo;
  observacionesIDs?: string[];
}) {
  try {
    const resultado = await notificarRevisionEquipo(
      formularioID,
      tipo,
      observacionesIDs,
    );

    if (resultado.enviados > 0) {
      console.info(
        `[EMAIL] Revisió ${tipo} del formulari ${formularioID}: ${resultado.enviados} correu(s) enviat(s).`,
      );
    }

    if (resultado.fallidos > 0) {
      console.error(
        `[EMAIL] Revisió ${tipo} del formulari ${formularioID}: han fallat ${resultado.fallidos} de ${resultado.destinatarios} correus.`,
      );
    }
  } catch (error) {
    /*
     * Un error enviando el correo no revierte
     * una modificación administrativa guardada.
     */

    console.error(
      `[EMAIL] La revisió ${tipo} del formulari ${formularioID} s'ha guardat, però no s'ha pogut enviar la notificació:`,
      error,
    );
  }
}

// ============================================================
// EMAIL · LISTA DE ESPERA
// ============================================================

async function enviarNotificacionListaEspera(formularioID: string) {
  try {
    const resultado = await notificarEquipoListaEspera(formularioID);

    if (resultado.enviados > 0) {
      console.info(
        `[EMAIL] Llista d'espera del formulari ${formularioID}: ${resultado.enviados} correu(s) enviat(s). Posició ${resultado.posicion}.`,
      );
    }

    if (resultado.fallidos > 0) {
      console.error(
        `[EMAIL] Llista d'espera del formulari ${formularioID}: han fallat ${resultado.fallidos} de ${resultado.destinatarios} correus.`,
      );
    }
  } catch (error) {
    console.error(
      `[EMAIL] La llista d'espera del formulari ${formularioID} s'ha guardat, però no s'ha pogut enviar la notificació:`,
      error,
    );
  }
}

// ============================================================
// COMPROBAR NOTIFICACIONES
// ============================================================
//
// No se envían nuevas notificaciones administrativas
// sobre inscripciones que ya estén archivadas.
// ============================================================

async function puedeNotificarFormulario(
  contexto: ContextoEquipoAdmin,
): Promise<boolean> {
  try {
    const formulario = await obtenerFormularioAdmin(
      contexto.formulario.id,
      contexto.edicion.id,
    );

    return !esFormularioArchivado(formulario);
  } catch (error) {
    console.error(
      "No s'ha pogut comprovar l'estat del formulari abans d'enviar la notificació:",
      error,
    );

    return false;
  }
}

// ============================================================
// PARTICIPANTE PARA VALIDACIÓN
// ============================================================

function convertirParticipanteValidacion(
  participante: ParticipanteDB,
): ParticipanteEntrada {
  const genero =
    participante.genero === "masculino" || participante.genero === "femenino"
      ? participante.genero
      : null;

  return {
    id: participante.id,

    tipo_participante: normalizarTipoParticipante(
      participante.tipo_participante,
    ),

    nombre: participante.nombre ?? "",

    apellido1: participante.apellido1 ?? "",

    apellido2: participante.apellido2 ?? "",

    email: normalizarEmail(participante.email ?? ""),

    curso: participante.curso ?? "",

    grupo: participante.grupo ?? "",

    genero,

    orden: participante.orden ?? 0,
  };
}

// ============================================================
// DATOS REALES DEL EQUIPO
// ============================================================

function prepararDatosActuales(
  contexto: ContextoEquipoAdmin,
  participantes: ParticipanteDB[],
): DatosEntrada {
  return {
    acceso_capitan: contexto.formulario.acceso_capitan === true,

    equipo: {
      id: contexto.equipo.id,

      nombre: contexto.equipo.nombre ?? "",

      escudo: contexto.equipo.escudo,

      capitan_id: contexto.equipo.capitan_id,
    },

    participantes: participantes.map(convertirParticipanteValidacion),
  };
}

// ============================================================
// DUPLICADOS ENTRE INSCRIPCIONES REALES
// ============================================================
//
// Se utiliza la comprobación centralizada de equipBase.ts.
//
// No reservan participantes:
//
// - Formularios en borrador.
// - Formularios archivados.
//
// También se excluye el propio equipo que estamos
// evaluando.
// ============================================================

async function comprobarDuplicadosInscritos(
  contexto: ContextoEquipoAdmin,
  participantes: ParticipanteEntrada[],
) {
  await comprobarDuplicadosEdicion(
    contexto.edicion.id,
    participantes,
    contexto.equipo.id,
  );
}

// ============================================================
// VALIDAR ANTES DE APROBAR
// ============================================================

async function validarAntesDeAprobar(
  contexto: ContextoEquipoAdmin,
  participantes: ParticipanteDB[],
) {
  exigirFormularioNoArchivado(contexto.formulario);

  const [configuracion, configuracionPlataforma] = await Promise.all([
    obtenerConfiguracionFormularioAdmin(contexto.formulario),

    obtenerConfiguracionPlataformaAdmin(),
  ]);

  const datos = prepararDatosActuales(contexto, participantes);

  // ========================================================
  // RESPONSABLE
  // ========================================================

  if (contexto.formulario.email_contacto) {
    validarEmailResponsable(
      normalizarEmail(contexto.formulario.email_contacto),
      configuracionPlataforma,
    );
  }

  // ========================================================
  // PARTICIPANTES
  // ========================================================

  validarEmails(datos.participantes, configuracionPlataforma);

  validarEmailsRepetidos(datos.participantes);

  validarEstructuraParticipantes(datos.participantes, configuracion);

  validarEnvio(datos, configuracion);

  // ========================================================
  // DUPLICADOS
  // ========================================================

  await comprobarDuplicadosInscritos(contexto, datos.participantes);
}

// ============================================================
// SNAPSHOT
// ============================================================

function crearSnapshot(
  contexto: ContextoEquipoAdmin,
  participantes: ParticipanteDB[],
): SnapshotEvaluacion {
  return {
    formulario: {
      estado: contexto.formulario.estado,

      enviado_at: contexto.formulario.enviado_at,

      completado_at: contexto.formulario.completado_at,
    },

    equipo: {
      validacion_estado: contexto.equipo.validacion_estado,
    },

    participantes: participantes.map((participante) => ({
      id: participante.id,

      validacion_estado: participante.validacion_estado,
    })),
  };
}

// ============================================================
// RESTAURAR FORMULARIO
// ============================================================

async function restaurarFormulario(
  contexto: ContextoEquipoAdmin,
  snapshot: SnapshotEvaluacion,
  marcaOperacion: string,
) {
  const { error } = await supabaseAdmin
    .from("formularios")
    .update({
      estado: snapshot.formulario.estado,

      enviado_at: snapshot.formulario.enviado_at,

      completado_at: snapshot.formulario.completado_at,

      updated_at: new Date().toISOString(),
    })
    .eq("id", contexto.formulario.id)
    .eq("edicion_id", contexto.edicion.id)
    .eq("tipo", "EQUIPO")
    .eq("updated_at", marcaOperacion)
    .is("archivado_at", null);

  if (error) {
    console.error(
      "No s'ha pogut restaurar el formulari després d'una modificació incompleta:",
      error,
    );
  }
}

// ============================================================
// RESTAURAR EQUIPO
// ============================================================

async function restaurarEquipo(
  contexto: ContextoEquipoAdmin,
  snapshot: SnapshotEvaluacion,
  marcaOperacion: string,
) {
  const { error } = await supabaseAdmin
    .from("equipos")
    .update({
      validacion_estado: snapshot.equipo.validacion_estado,

      updated_at: new Date().toISOString(),
    })
    .eq("id", contexto.equipo.id)
    .eq("formulario_id", contexto.formulario.id)
    .eq("updated_at", marcaOperacion);

  if (error) {
    console.error(
      "No s'ha pogut restaurar l'estat de validació de l'equip:",
      error,
    );
  }
}

// ============================================================
// RESTAURAR PARTICIPANTES
// ============================================================

async function restaurarParticipantes(
  contexto: ContextoEquipoAdmin,
  snapshot: SnapshotEvaluacion,
  marcaOperacion: string,
) {
  for (const participante of snapshot.participantes) {
    if (!(await puedeCompensarOperacion(contexto, marcaOperacion))) {
      return;
    }

    const { error } = await supabaseAdmin
      .from("participantes_equipo")
      .update({
        validacion_estado: participante.validacion_estado,

        updated_at: new Date().toISOString(),
      })
      .eq("id", participante.id)
      .eq("equipo_id", contexto.equipo.id)
      .eq("updated_at", marcaOperacion);

    if (error) {
      console.error(
        `No s'ha pogut restaurar el participant ${participante.id}:`,
        error,
      );
    }
  }
}

// ============================================================
// COMPENSACIÓN
// ============================================================
//
// Se restaura primero la información dependiente y,
// finalmente, el formulario.
//
// Así podemos comprobar durante la recuperación que
// el formulario todavía conserva la marca de operación.
// ============================================================

async function compensarEvaluacion(
  contexto: ContextoEquipoAdmin,
  snapshot: SnapshotEvaluacion,
  marcaOperacion: string,
) {
  if (!(await puedeCompensarOperacion(contexto, marcaOperacion))) {
    console.warn(
      `[EQUIPS] No s'ha restaurat l'avaluació del formulari ${contexto.formulario.id} perquè ha canviat o està arxivat.`,
    );

    return;
  }

  await restaurarParticipantes(contexto, snapshot, marcaOperacion);

  if (!(await puedeCompensarOperacion(contexto, marcaOperacion))) {
    return;
  }

  await restaurarEquipo(contexto, snapshot, marcaOperacion);

  if (!(await puedeCompensarOperacion(contexto, marcaOperacion))) {
    return;
  }

  await restaurarFormulario(contexto, snapshot, marcaOperacion);
}

// ============================================================
// OBSERVACIONES · RESOLVER
// ============================================================

async function resolverObservacionesPorIDs(
  contexto: ContextoEquipoAdmin,
  ids: string[],
  usuarioID: string,
) {
  if (ids.length === 0) {
    return;
  }

  await comprobarFormularioActivoAdmin(
    contexto.formulario.id,
    contexto.edicion.id,
  );

  const { error } = await supabaseAdmin
    .from("observaciones_campos")
    .update({
      estado: "RESUELTA",

      resuelta_por: usuarioID,
    })
    .eq("formulario_id", contexto.formulario.id)
    .in("id", ids);

  if (error) {
    throw error;
  }
}

// ============================================================
// OBSERVACIONES · CERRAR TODAS
// ============================================================

async function cerrarObservacionesActivas(contexto: ContextoEquipoAdmin) {
  const observaciones = await obtenerObservacionesAdmin(contexto.formulario.id);

  const ids = observaciones
    .filter(
      (observacion) =>
        (observacion.estado ?? "").trim().toUpperCase() !== "RESUELTA",
    )
    .map((observacion) => observacion.id);

  await resolverObservacionesPorIDs(contexto, ids, contexto.usuario.id);
}

// ============================================================
// OBSERVACIONES · ANULAR NUEVAS
// ============================================================

async function anularObservacionesNuevas(
  contexto: ContextoEquipoAdmin,
  ids: string[],
  usuarioID: string,
) {
  if (ids.length === 0) {
    return;
  }

  try {
    await resolverObservacionesPorIDs(contexto, ids, usuarioID);
  } catch (error) {
    console.error(
      "No s'han pogut anul·lar les observacions d'una avaluació incompleta:",
      error,
    );
  }
}

// ============================================================
// OBSERVACIONES · PREPARAR
// ============================================================

function prepararObservacionesEntrada(
  valor: unknown,
  contexto: ContextoEquipoAdmin,
  participantes: ParticipanteDB[],
): ObservacionEntradaAdmin[] {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new ErrorAPI(
      400,
      "Has d'indicar almenys una correcció abans de retornar la inscripció.",
    );
  }

  if (valor.length > MAX_OBSERVACIONES) {
    throw new ErrorAPI(400, "Hi ha massa observacions en una sola revisió.");
  }

  const idsParticipantes = new Set(
    participantes.map((participante) => participante.id),
  );

  return valor.map((elemento, indice) => {
    if (!esRegistro(elemento)) {
      throw new ErrorAPI(400, `L'observació ${indice + 1} no és vàlida.`);
    }

    const tipoRaw = leerTextoAdmin(
      elemento.entidad_tipo,
      "entidad_tipo",
      30,
      true,
    ).toUpperCase();

    if (
      !TIPOS_ENTIDAD_OBSERVACION.includes(tipoRaw as TipoEntidadObservacion)
    ) {
      throw new ErrorAPI(
        400,
        `El tipus de l'observació ${indice + 1} no és vàlid.`,
      );
    }

    const entidadTipo = tipoRaw as TipoEntidadObservacion;

    const entidadID = leerIDAdmin(elemento.entidad_id, "entidad_id");

    // =================================================
    // FORMULARIO
    // =================================================

    if (entidadTipo === "FORMULARIO" && entidadID !== contexto.formulario.id) {
      throw new ErrorAPI(400, "L'observació no correspon a aquest formulari.");
    }

    // =================================================
    // EQUIPO
    // =================================================

    if (entidadTipo === "EQUIPO" && entidadID !== contexto.equipo.id) {
      throw new ErrorAPI(400, "L'observació no correspon a aquest equip.");
    }

    // =================================================
    // PARTICIPANTE
    // =================================================

    if (entidadTipo === "PARTICIPANTE" && !idsParticipantes.has(entidadID)) {
      throw new ErrorAPI(
        400,
        "L'observació correspon a un participant que no pertany a aquest equip.",
      );
    }

    // =================================================
    // CAMPO Y MENSAJE
    // =================================================

    const campo = leerTextoAdmin(
      elemento.campo,
      "campo",
      MAX_CAMPO_OBSERVACION,
      true,
    );

    const mensaje = leerTextoAdmin(
      elemento.mensaje,
      "mensaje",
      MAX_MENSAJE_OBSERVACION,
      true,
    );

    return {
      entidad_tipo: entidadTipo,

      entidad_id: entidadID,

      campo,

      mensaje,
    };
  });
}

// ============================================================
// VALIDACIÓN ASOCIADA A ESTADO
// ============================================================

function estadoValidacionParaFormulario(estado: EstadoCambioAdmin) {
  if (estado === "APROBADO") {
    return "APROBADO";
  }

  if (estado === "DENEGADO") {
    return "DENEGADO";
  }

  return "PENDIENTE";
}

// ============================================================
// MENSAJE CAMBIO ESTADO
// ============================================================

function mensajeCambioEstado(estado: EstadoCambioAdmin) {
  if (estado === "APROBADO") {
    return "La inscripció s'ha aprovat correctament.";
  }

  if (estado === "DENEGADO") {
    return "La inscripció s'ha marcat com a no aprovada.";
  }

  return "La inscripció s'ha tornat a posar en revisió.";
}

// ============================================================
// TIPO EMAIL REVISIÓN
// ============================================================

function tipoRevisionParaEstado(estado: EstadoCambioAdmin): TipoRevisionEquipo {
  if (estado === "APROBADO") {
    return "APROBADO";
  }

  if (estado === "DENEGADO") {
    return "NO_APROBADO";
  }

  return "EN_REVISION";
}

// ============================================================
// ACTUALIZAR VALIDACIÓN DEL EQUIPO
// ============================================================

async function actualizarValidacionEquipo(
  contexto: ContextoEquipoAdmin,
  validacion: string,
  ahora: string,
) {
  await comprobarEvaluacionActiva(contexto, ahora);

  const { data: equipoActualizado, error } = await supabaseAdmin
    .from("equipos")
    .update({
      validacion_estado: validacion,

      updated_at: ahora,
    })
    .eq("id", contexto.equipo.id)
    .eq("formulario_id", contexto.formulario.id)
    .eq("updated_at", contexto.equipo.updated_at)
    .select("id,validacion_estado,updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!equipoActualizado) {
    throw new ErrorAPI(
      409,
      "L'equip ha canviat durant l'avaluació. Torna a carregar la fitxa.",
    );
  }

  return equipoActualizado;
}

// ============================================================
// ACTUALIZAR VALIDACIÓN DE PARTICIPANTES
// ============================================================

async function actualizarValidacionParticipantes(
  contexto: ContextoEquipoAdmin,
  validacion: string,
  ahora: string,
  ids?: string[],
) {
  if (ids !== undefined && ids.length === 0) {
    return;
  }

  await comprobarEvaluacionActiva(contexto, ahora);

  let consulta = supabaseAdmin
    .from("participantes_equipo")
    .update({
      validacion_estado: validacion,

      updated_at: ahora,
    })
    .eq("equipo_id", contexto.equipo.id)
    .eq("activo", true);

  if (ids !== undefined) {
    consulta = consulta.in("id", ids);
  }

  const { error } = await consulta;

  if (error) {
    throw error;
  }
}

// ============================================================
// CAMBIAR ESTADO ADMINISTRATIVAMENTE
// ============================================================

export async function cambiarEstadoEvaluacionEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosEvaluacionAdmin): Promise<ResultadoCambioEstadoAdmin> {
  // ========================================================
  // PERMISOS Y ARCHIVO
  // ========================================================

  exigirPermisoEquip(contexto.usuario, contexto.torneo.id, "evaluar");

  exigirFormularioNoArchivado(contexto.formulario);

  // ========================================================
  // ESTADO ACTUAL
  // ========================================================

  const estadoActual = normalizarEstadoFormulario(contexto.formulario.estado);

  if (estadoActual === "BORRADOR") {
    throw new ErrorAPI(
      409,
      "Un esborrany no pot canviar d'estat amb aquesta acció. Si és un esborrany administratiu, utilitza l'opció de finalitzar-lo.",
    );
  }

  // ========================================================
  // NUEVO ESTADO
  // ========================================================

  const estadoRaw = leerTextoAdmin(
    cuerpo.estado,
    "estado",
    30,
    true,
  ).toUpperCase();

  if (!ESTADOS_CAMBIO_ADMIN.includes(estadoRaw as EstadoCambioAdmin)) {
    throw new ErrorAPI(400, "L'estat d'avaluació indicat no és vàlid.");
  }

  const nuevoEstado = estadoRaw as EstadoCambioAdmin;

  if (nuevoEstado === estadoActual) {
    throw new ErrorAPI(409, "La inscripció ja es troba en aquest estat.");
  }

  // ========================================================
  // VERSIÓN
  // ========================================================

  exigirMismaVersion(
    contexto.formulario.updated_at,
    cuerpo.formulario_updated_at,
    "la inscripció",
  );

  // ========================================================
  // PARTICIPANTES
  // ========================================================

  const participantes = await obtenerParticipantesAdmin(contexto.equipo.id);

  // ========================================================
  // APROBAR EXIGE VALIDACIÓN COMPLETA
  // ========================================================

  if (nuevoEstado === "APROBADO") {
    await validarAntesDeAprobar(contexto, participantes);
  }

  // ========================================================
  // SNAPSHOT
  // ========================================================

  const snapshot = crearSnapshot(contexto, participantes);

  const ahora = new Date().toISOString();

  const validacion = estadoValidacionParaFormulario(nuevoEstado);

  // ========================================================
  // COMPROBAR QUE SIGUE ACTIVO
  // ========================================================

  await comprobarEvaluacionActiva(contexto);

  // ========================================================
  // 1. FORMULARIO
  // ========================================================

  const { data: formularioActualizado, error: errorFormulario } =
    await supabaseAdmin
      .from("formularios")
      .update({
        estado: nuevoEstado,

        enviado_at: contexto.formulario.enviado_at ?? ahora,

        completado_at: nuevoEstado === "EN_REVISION" ? null : ahora,

        updated_at: ahora,
      })
      .eq("id", contexto.formulario.id)
      .eq("edicion_id", contexto.edicion.id)
      .eq("tipo", "EQUIPO")
      .eq("estado", estadoActual)
      .eq("updated_at", contexto.formulario.updated_at)
      .is("archivado_at", null)
      .select(CAMPOS_FORMULARIO)
      .maybeSingle();

  if (errorFormulario) {
    throw errorFormulario;
  }

  if (!formularioActualizado) {
    throw new ErrorAPI(
      409,
      "La inscripció ha canviat des que l'has carregada. Actualitza la fitxa abans de modificar-ne l'estat.",
    );
  }

  const marcaOperacion = formularioActualizado.updated_at;

  let equipoActualizado: Awaited<ReturnType<typeof actualizarValidacionEquipo>>;

  try {
    // ====================================================
    // 2. EQUIPO
    // ====================================================

    equipoActualizado = await actualizarValidacionEquipo(
      contexto,
      validacion,
      marcaOperacion,
    );

    // ====================================================
    // 3. PARTICIPANTES
    // ====================================================

    if (participantes.length > 0) {
      await actualizarValidacionParticipantes(
        contexto,
        validacion,
        marcaOperacion,
      );
    }
  } catch (error) {
    await compensarEvaluacion(contexto, snapshot, marcaOperacion);

    throw error;
  }

  // ========================================================
  // 4. CERRAR OBSERVACIONES AL APROBAR
  // ========================================================

  if (nuevoEstado === "APROBADO") {
    try {
      await cerrarObservacionesActivas(contexto);
    } catch (error) {
      console.error(
        "La inscripció s'ha aprovat però no s'han pogut tancar totes les observacions:",
        error,
      );
    }
  }

  // ========================================================
  // 5. EMAIL
  // ========================================================

  if (await puedeNotificarFormulario(contexto)) {
    await enviarNotificacionRevision({
      formularioID: formularioActualizado.id,

      tipo: tipoRevisionParaEstado(nuevoEstado),
    });
  }

  // ========================================================
  // RESPUESTA
  // ========================================================

  return {
    mensaje: mensajeCambioEstado(nuevoEstado),

    formulario: {
      id: formularioActualizado.id,

      estado: nuevoEstado,

      enviado_at: formularioActualizado.enviado_at,

      completado_at: formularioActualizado.completado_at,

      updated_at: formularioActualizado.updated_at,
    },

    equipo: {
      id: equipoActualizado.id,

      validacion_estado: equipoActualizado.validacion_estado ?? validacion,

      updated_at: equipoActualizado.updated_at,
    },
  };
}

// ============================================================
// APROBAR
// ============================================================

export async function aprobarEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosEvaluacionAdmin): Promise<ResultadoAprobacionAdmin> {
  exigirFormularioNoArchivado(contexto.formulario);

  const estadoActual = normalizarEstadoFormulario(contexto.formulario.estado);

  if (estadoActual === "BORRADOR") {
    throw new ErrorAPI(409, "Aquest formulari encara és un esborrany.");
  }

  if (estadoActual === "APROBADO") {
    throw new ErrorAPI(409, "Aquesta inscripció ja està aprovada.");
  }

  /*
   * cambiarEstadoEvaluacionEquipoAdmin() ya gestiona
   * el correo de aprobación.
   *
   * No se vuelve a enviar desde esta función.
   */

  const resultado = await cambiarEstadoEvaluacionEquipoAdmin({
    contexto,

    cuerpo: {
      ...cuerpo,

      estado: "APROBADO",
    },
  });

  return {
    mensaje: resultado.mensaje,

    formulario: {
      id: resultado.formulario.id,

      estado: "APROBADO",

      enviado_at: resultado.formulario.enviado_at,

      completado_at: resultado.formulario.completado_at,

      updated_at: resultado.formulario.updated_at,
    },
  };
}

// ============================================================
// FINALIZAR BORRADOR ADMINISTRATIVO
// ============================================================

export async function finalizarBorradorEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosEvaluacionAdmin): Promise<ResultadoAprobacionAdmin> {
  // ========================================================
  // PERMISOS Y ARCHIVO
  // ========================================================

  exigirPermisoEquip(contexto.usuario, contexto.torneo.id, "evaluar");

  exigirFormularioNoArchivado(contexto.formulario);

  // ========================================================
  // BORRADOR ADMINISTRATIVO
  // ========================================================

  if (!esBorradorAdministrativo(contexto.formulario)) {
    const estado = normalizarEstadoFormulario(contexto.formulario.estado);

    if (estado !== "BORRADOR") {
      throw new ErrorAPI(409, "Aquesta inscripció ja no és un esborrany.");
    }

    throw new ErrorAPI(
      403,
      "Aquest esborrany ha estat creat per un usuari i no es pot finalitzar directament des del panell.",
    );
  }

  // ========================================================
  // VERSIÓN
  // ========================================================

  exigirMismaVersion(
    contexto.formulario.updated_at,
    cuerpo.formulario_updated_at,
    "la inscripció",
  );

  // ========================================================
  // PARTICIPANTES + VALIDACIÓN
  // ========================================================

  const participantes = await obtenerParticipantesAdmin(contexto.equipo.id);

  await validarAntesDeAprobar(contexto, participantes);

  // ========================================================
  // SNAPSHOT
  // ========================================================

  const snapshot = crearSnapshot(contexto, participantes);

  const ahora = new Date().toISOString();

  // ========================================================
  // COMPROBAR QUE SIGUE ACTIVO
  // ========================================================

  await comprobarEvaluacionActiva(contexto);

  // ========================================================
  // 1. FORMULARIO
  // ========================================================

  const { data: formularioActualizado, error: errorFormulario } =
    await supabaseAdmin
      .from("formularios")
      .update({
        estado: "APROBADO",

        enviado_at: ahora,

        completado_at: ahora,

        updated_at: ahora,
      })
      .eq("id", contexto.formulario.id)
      .eq("edicion_id", contexto.edicion.id)
      .eq("tipo", "EQUIPO")
      .eq("estado", "BORRADOR")
      .eq("origen", "ADMIN")
      .eq("updated_at", contexto.formulario.updated_at)
      .is("archivado_at", null)
      .select(CAMPOS_FORMULARIO)
      .maybeSingle();

  if (errorFormulario) {
    throw errorFormulario;
  }

  if (!formularioActualizado) {
    throw new ErrorAPI(
      409,
      "L'esborrany ha canviat des que l'has carregat. Actualitza la fitxa abans de finalitzar-lo.",
    );
  }

  const marcaOperacion = formularioActualizado.updated_at;

  try {
    // ====================================================
    // 2. EQUIPO
    // ====================================================

    await actualizarValidacionEquipo(contexto, "APROBADO", marcaOperacion);

    // ====================================================
    // 3. PARTICIPANTES
    // ====================================================

    if (participantes.length > 0) {
      await actualizarValidacionParticipantes(
        contexto,
        "APROBADO",
        marcaOperacion,
      );
    }
  } catch (error) {
    await compensarEvaluacion(contexto, snapshot, marcaOperacion);

    throw error;
  }

  // ========================================================
  // OBSERVACIONES
  // ========================================================

  try {
    await cerrarObservacionesActivas(contexto);
  } catch (error) {
    console.error(
      "L'esborrany s'ha aprovat però no s'han pogut tancar totes les observacions:",
      error,
    );
  }

  // ========================================================
  // EMAIL
  // ========================================================

  if (await puedeNotificarFormulario(contexto)) {
    await enviarNotificacionRevision({
      formularioID: formularioActualizado.id,

      tipo: "APROBADO",
    });
  }

  // ========================================================
  // RESPUESTA
  // ========================================================

  return {
    mensaje:
      "L'esborrany administratiu s'ha finalitzat i aprovat correctament.",

    formulario: {
      id: formularioActualizado.id,

      estado: "APROBADO",

      enviado_at: formularioActualizado.enviado_at,

      completado_at: formularioActualizado.completado_at,

      updated_at: formularioActualizado.updated_at,
    },
  };
}

// ============================================================
// SOLICITAR CAMBIOS
// ============================================================

export async function solicitarCambiosEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosEvaluacionAdmin): Promise<ResultadoCambiosAdmin> {
  // ========================================================
  // PERMISOS Y ARCHIVO
  // ========================================================

  exigirPermisoEquip(contexto.usuario, contexto.torneo.id, "evaluar");

  exigirFormularioNoArchivado(contexto.formulario);

  // ========================================================
  // ESTADO ACTUAL
  // ========================================================

  const estadoActual = normalizarEstadoFormulario(contexto.formulario.estado);

  /*
   * Se pueden solicitar cambios a inscripciones
   * en revisión o que ya hayan sido aprobadas.
   */

  if (estadoActual !== "EN_REVISION" && estadoActual !== "APROBADO") {
    throw new ErrorAPI(
      409,
      estadoActual === "BORRADOR"
        ? "Aquest formulari encara és un esborrany."
        : "Aquesta inscripció ja està marcada com a pendent de correccions.",
    );
  }

  // ========================================================
  // VERSIÓN
  // ========================================================

  exigirMismaVersion(
    contexto.formulario.updated_at,
    cuerpo.formulario_updated_at,
    "la inscripció",
  );

  // ========================================================
  // PARTICIPANTES
  // ========================================================

  const participantes = await obtenerParticipantesAdmin(contexto.equipo.id);

  // ========================================================
  // OBSERVACIONES NUEVAS
  // ========================================================

  const observaciones = prepararObservacionesEntrada(
    cuerpo.observaciones,
    contexto,
    participantes,
  );

  // ========================================================
  // OBSERVACIONES ANTERIORES
  // ========================================================

  const observacionesAnteriores = await obtenerObservacionesAdmin(
    contexto.formulario.id,
  );

  const idsObservacionesAnteriores = observacionesAnteriores
    .filter(
      (observacion) =>
        (observacion.estado ?? "").trim().toUpperCase() !== "RESUELTA",
    )
    .map((observacion) => observacion.id);

  // ========================================================
  // SNAPSHOT
  // ========================================================

  const snapshot = crearSnapshot(contexto, participantes);

  const ahora = new Date().toISOString();

  // ========================================================
  // COMPROBAR QUE SIGUE ACTIVO
  // ========================================================

  await comprobarEvaluacionActiva(contexto);

  // ========================================================
  // 1. FORMULARIO
  // ========================================================

  const { data: formularioActualizado, error: errorFormulario } =
    await supabaseAdmin
      .from("formularios")
      .update({
        estado: "DENEGADO",

        completado_at: ahora,

        updated_at: ahora,
      })
      .eq("id", contexto.formulario.id)
      .eq("edicion_id", contexto.edicion.id)
      .eq("tipo", "EQUIPO")
      .eq("estado", estadoActual)
      .eq("updated_at", contexto.formulario.updated_at)
      .is("archivado_at", null)
      .select(CAMPOS_FORMULARIO)
      .maybeSingle();

  if (errorFormulario) {
    throw errorFormulario;
  }

  if (!formularioActualizado) {
    throw new ErrorAPI(
      409,
      "La inscripció ha canviat des que l'has carregada. Actualitza la fitxa abans d'avaluar-la.",
    );
  }

  const marcaOperacion = formularioActualizado.updated_at;

  let idsObservacionesNuevas: string[] = [];

  try {
    // ====================================================
    // COMPROBAR VIGENCIA
    // ====================================================

    await comprobarEvaluacionActiva(contexto, marcaOperacion);

    // ====================================================
    // 2. OBSERVACIONES
    // ====================================================

    const { data: observacionesInsertadas, error: errorObservaciones } =
      await supabaseAdmin
        .from("observaciones_campos")
        .insert(
          observaciones.map((observacion) => ({
            edicion_id: contexto.edicion.id,

            formulario_id: contexto.formulario.id,

            entidad_tipo: observacion.entidad_tipo,

            entidad_id: observacion.entidad_id,

            campo: observacion.campo,

            mensaje: observacion.mensaje,

            estado: "PENDIENTE",

            creada_por: contexto.usuario.id,

            resuelta_por: null,

            created_at: marcaOperacion,
          })),
        )
        .select("id");

    if (errorObservaciones) {
      throw errorObservaciones;
    }

    idsObservacionesNuevas = (observacionesInsertadas ?? [])
      .map((observacion) => observacion.id)
      .filter((id): id is string => typeof id === "string" && Boolean(id));

    // ====================================================
    // 3. EQUIPO
    // ====================================================

    await actualizarValidacionEquipo(contexto, "DENEGADO", marcaOperacion);

    // ====================================================
    // 4. PARTICIPANTES OBSERVADOS
    // ====================================================

    const idsParticipantesObservados = [
      ...new Set(
        observaciones
          .filter((observacion) => observacion.entidad_tipo === "PARTICIPANTE")
          .map((observacion) => observacion.entidad_id),
      ),
    ];

    if (idsParticipantesObservados.length > 0) {
      await actualizarValidacionParticipantes(
        contexto,
        "DENEGADO",
        marcaOperacion,
        idsParticipantesObservados,
      );
    }
  } catch (error) {
    if (await puedeCompensarOperacion(contexto, marcaOperacion)) {
      await anularObservacionesNuevas(
        contexto,
        idsObservacionesNuevas,
        contexto.usuario.id,
      );

      await compensarEvaluacion(contexto, snapshot, marcaOperacion);
    }

    throw error;
  }

  // ========================================================
  // CERRAR OBSERVACIONES ANTERIORES
  // ========================================================

  if (idsObservacionesAnteriores.length > 0) {
    try {
      await resolverObservacionesPorIDs(
        contexto,
        idsObservacionesAnteriores,
        contexto.usuario.id,
      );
    } catch (error) {
      console.error(
        "La nova revisió s'ha guardat però no s'han pogut tancar totes les observacions anteriors:",
        error,
      );
    }
  }

  // ========================================================
  // EMAIL DE CORRECCIONES
  // ========================================================

  if (await puedeNotificarFormulario(contexto)) {
    await enviarNotificacionRevision({
      formularioID: formularioActualizado.id,

      tipo: "CORRECCIONES",

      /*
       * Solo se incluyen las observaciones
       * creadas en esta revisión.
       */

      observacionesIDs: idsObservacionesNuevas,
    });
  }

  // ========================================================
  // RESPUESTA
  // ========================================================

  return {
    mensaje:
      estadoActual === "APROBADO"
        ? "L'aprovació s'ha revocat i s'han sol·licitat les correccions indicades."
        : "La inscripció s'ha retornat perquè es facin les correccions indicades.",

    formulario: {
      id: formularioActualizado.id,

      estado: "DENEGADO",

      completado_at: formularioActualizado.completado_at,

      updated_at: formularioActualizado.updated_at,
    },

    observacionesCreadas: idsObservacionesNuevas.length,
  };
}

// ============================================================
// CAMBIAR PLAZA
// ============================================================
//
// Los equipos archivados conservan su estado histórico
// de plaza, pero no se permite modificarlo.
//
// Tampoco se permite gestionar plazas de borradores.
// ============================================================

export async function cambiarPlazaEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosEvaluacionAdmin): Promise<ResultadoPlazaAdmin> {
  // ========================================================
  // PERMISOS Y ARCHIVO
  // ========================================================

  exigirPermisoEquip(contexto.usuario, contexto.torneo.id, "canviar-estat");

  exigirFormularioNoArchivado(contexto.formulario);

  // ========================================================
  // ESTADO FORMULARIO
  // ========================================================

  const estadoFormulario = normalizarEstadoFormulario(
    contexto.formulario.estado,
  );

  if (estadoFormulario === "BORRADOR") {
    throw new ErrorAPI(
      409,
      "No es pot gestionar la plaça d'un equip que encara és un esborrany.",
    );
  }

  // ========================================================
  // VERSIÓN EQUIPO
  // ========================================================

  exigirMismaVersion(
    contexto.equipo.updated_at,
    cuerpo.equipo_updated_at,
    "l'equip",
  );

  /*
   * La versión del formulario es opcional para mantener
   * la compatibilidad con la interfaz actual.
   *
   * Si se recibe, también debe coincidir.
   */

  if (cuerpo.formulario_updated_at !== undefined) {
    exigirMismaVersion(
      contexto.formulario.updated_at,
      cuerpo.formulario_updated_at,
      "la inscripció",
    );
  }

  // ========================================================
  // ESTADO PLAZA
  // ========================================================

  const estadoRaw = leerTextoAdmin(
    cuerpo.plaza_estado,
    "plaza_estado",
    50,
    true,
  ).toUpperCase();

  if (!ESTADOS_PLAZA.includes(estadoRaw as EstadoPlaza)) {
    throw new ErrorAPI(400, "L'estat de la plaça no és vàlid.");
  }

  const plazaEstado = estadoRaw as EstadoPlaza;

  // ========================================================
  // POSICIÓN LISTA DE ESPERA
  // ========================================================

  let posicionListaEspera: number | null = null;

  if (plazaEstado === "LISTA_ESPERA") {
    if (
      typeof cuerpo.posicion_lista_espera !== "number" ||
      !Number.isSafeInteger(cuerpo.posicion_lista_espera) ||
      cuerpo.posicion_lista_espera < 1
    ) {
      throw new ErrorAPI(
        400,
        "Has d'indicar una posició vàlida de la llista d'espera.",
      );
    }

    posicionListaEspera = cuerpo.posicion_lista_espera;
  }

  // ========================================================
  // NOTA ADMINISTRATIVA
  // ========================================================

  let notaAdmin = contexto.equipo.nota_admin;

  if (Object.prototype.hasOwnProperty.call(cuerpo, "nota_admin")) {
    const nota = leerTextoAdmin(
      cuerpo.nota_admin,
      "nota_admin",
      MAX_NOTA_ADMIN,
    );

    notaAdmin = nota || null;
  }

  // ========================================================
  // COMPROBAR FORMULARIO ACTIVO
  // ========================================================

  const formularioActual = await comprobarEvaluacionActiva(contexto);

  if (normalizarEstadoFormulario(formularioActual.estado) === "BORRADOR") {
    throw new ErrorAPI(409, "No es pot gestionar la plaça d'un esborrany.");
  }

  // ========================================================
  // UPDATE
  // ========================================================

  const ahora = new Date().toISOString();

  const { data: equipoActualizado, error: errorEquipo } = await supabaseAdmin
    .from("equipos")
    .update({
      plaza_estado: plazaEstado,

      posicion_lista_espera: posicionListaEspera,

      nota_admin: notaAdmin,

      updated_at: ahora,
    })
    .eq("id", contexto.equipo.id)
    .eq("formulario_id", contexto.formulario.id)
    .eq("updated_at", contexto.equipo.updated_at)
    .select(CAMPOS_EQUIPO)
    .maybeSingle();

  if (errorEquipo) {
    throw errorEquipo;
  }

  if (!equipoActualizado) {
    throw new ErrorAPI(
      409,
      "L'equip ha canviat des que l'has carregat. Actualitza la fitxa abans de modificar la plaça.",
    );
  }

  // ========================================================
  // MENSAJE
  // ========================================================

  let mensaje = "L'estat de la plaça ha quedat pendent.";

  if (plazaEstado === "CONFIRMADA") {
    mensaje = "Plaça confirmada correctament.";
  }

  if (plazaEstado === "LISTA_ESPERA") {
    mensaje = "L'equip s'ha incorporat a la llista d'espera.";
  }

  if (plazaEstado === "SIN_PLAZA") {
    mensaje = "L'equip s'ha marcat sense plaça.";
  }

  // ========================================================
  // CAMBIOS DE PLAZA
  // ========================================================

  const plazaAnterior = normalizarEstadoPlaza(contexto.equipo.plaza_estado);

  const haCambiadoEstado = plazaAnterior !== plazaEstado;

  const haCambiadoPosicion =
    plazaEstado === "LISTA_ESPERA" &&
    contexto.equipo.posicion_lista_espera !== posicionListaEspera;

  // ========================================================
  // EMAIL DE CAMBIO DE PLAZA
  // ========================================================

  try {
    if (await puedeNotificarFormulario(contexto)) {
      if (
        plazaEstado === "LISTA_ESPERA" &&
        (haCambiadoEstado || haCambiadoPosicion)
      ) {
        await enviarNotificacionListaEspera(contexto.formulario.id);
      } else if (plazaEstado === "CONFIRMADA" && haCambiadoEstado) {
        await enviarNotificacionPlazaConfirmada(contexto.formulario.id);
      } else if (plazaEstado === "SIN_PLAZA" && haCambiadoEstado) {
        await enviarNotificacionSinPlaza(contexto.formulario.id);
      }
    }
  } catch (error) {
    console.error(
      "L'estat de la plaça s'ha guardat, però no s'ha pogut enviar el correu:",
      error,
    );
  }

  // ========================================================
  // RESPUESTA
  // ========================================================

  return {
    mensaje,

    equipo: {
      id: equipoActualizado.id,

      plaza_estado: normalizarEstadoPlaza(equipoActualizado.plaza_estado),

      posicion_lista_espera: equipoActualizado.posicion_lista_espera,

      nota_admin: equipoActualizado.nota_admin,

      updated_at: equipoActualizado.updated_at,
    },
  };
}
