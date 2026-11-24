import { supabaseAdmin } from "@utils/supabase";

import { guardarEscudoEquipo } from "@utils/inscripcio/equipStorage";

import {
  ErrorAPI,
  exigirPermisoEquip,
  exigirFormularioArchivable,
  exigirFormularioEliminable,
  exigirMismaVersion,
  obtenerFormularioAdmin,
  obtenerEquipoAdmin,
  obtenerDatosArchivo,
  leerMotivoArchivado,
  normalizarEstadoFormulario,
  type ContextoEquipoAdmin,
  type Registro,
  type EstadoFormulario,
  type DatosArchivoAdmin,
} from "./adminComun";

// ============================================================
// TIPOS
// ============================================================

type ParametrosAccionAdmin = {
  contexto: ContextoEquipoAdmin;
  cuerpo: Registro;
};

export type ResultadoArchivarEquipoAdmin = {
  accion: "archivar";

  equipo_id: string;

  formulario_id: string;

  estado: EstadoFormulario;

  participantes_liberados: number;

  archivo: DatosArchivoAdmin;

  formulario_updated_at: string;

  mensaje: string;
};

export type ResultadoEliminarEquipoAdmin = {
  accion: "eliminar";

  equipo_id: string;

  formulario_id: string;

  participantes_eliminados: number;

  escudo_eliminado: boolean;

  advertencia: string | null;

  mensaje: string;
};

// ============================================================
// COMPROBAR CONFIRMACIÓN
// ============================================================

function exigirConfirmacion(cuerpo: Registro) {
  if (cuerpo.confirmar !== true) {
    throw new ErrorAPI(400, "Has de confirmar aquesta acció.");
  }
}

// ============================================================
// COMPROBAR VINCULACIONES CON LA COMPETICIÓN
// ============================================================
//
// No se permite archivar ni eliminar un equipo que tenga
// una vinculación activa con la competición o que esté
// asignado a un grupo o partido.
//
// Nunca se eliminan automáticamente partidos, resultados,
// estadísticas ni plazas de competición.
// ============================================================

async function exigirEquipoSinCompeticion({
  equipoID,
  edicionID,
  eliminar = false,
}: {
  equipoID: string;
  edicionID: string;
  eliminar?: boolean;
}) {
  const [resultadoEquipos, resultadoPlazas] = await Promise.all([
    supabaseAdmin
      .from("competicion_equipos")
      .select("equipo_id,estado")
      .eq("edicion_id", edicionID)
      .eq("equipo_id", equipoID),

    supabaseAdmin
      .from("competicion_plazas")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("edicion_id", edicionID)
      .or(`equipo_origen_id.eq.${equipoID},equipo_resuelto_id.eq.${equipoID}`),
  ]);

  if (resultadoEquipos.error) {
    throw resultadoEquipos.error;
  }

  if (resultadoPlazas.error) {
    throw resultadoPlazas.error;
  }

  const registrosCompeticion = resultadoEquipos.data ?? [];

  const tieneVinculacion = registrosCompeticion.some(
    (registro) =>
      eliminar || registro.estado?.trim().toUpperCase() !== "RETIRADO",
  );

  if (tieneVinculacion) {
    throw new ErrorAPI(
      409,
      eliminar
        ? "No es pot eliminar l'equip perquè té una vinculació amb la competició."
        : "Abans d'arxivar l'equip l'has de retirar de la competició.",
    );
  }

  if ((resultadoPlazas.count ?? 0) > 0) {
    throw new ErrorAPI(
      409,
      "L'equip està assignat a un grup o partit. Elimina aquesta vinculació abans de continuar.",
    );
  }
}

// ============================================================
// CONTAR PARTICIPANTES ACTIVOS
// ============================================================
//
// Se utiliza para informar del número de participantes
// asociados a la inscripción.
// ============================================================

async function contarParticipantesActivos(equipoID: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("participantes_equipo")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("equipo_id", equipoID)
    .eq("activo", true);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ============================================================
// CONTAR TODOS LOS PARTICIPANTES
// ============================================================
//
// Para la eliminación definitiva se incluyen tanto los
// participantes activos como los anteriormente desactivados.
// ============================================================

async function contarTodosParticipantes(equipoID: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("participantes_equipo")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("equipo_id", equipoID);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ============================================================
// COMPROBAR VERSIONES
// ============================================================
//
// Se comprueban las versiones del formulario y del equipo
// para evitar realizar acciones desde una ficha desactualizada.
// ============================================================

function exigirVersionesAccion({ contexto, cuerpo }: ParametrosAccionAdmin) {
  exigirMismaVersion(
    contexto.formulario.updated_at,
    cuerpo.formulario_updated_at,
    "la inscripció",
  );

  exigirMismaVersion(
    contexto.equipo.updated_at,
    cuerpo.equipo_updated_at,
    "l'equip",
  );
}

// ============================================================
// RECARGAR EQUIPO Y FORMULARIO
// ============================================================
//
// Antes de una acción irreversible se vuelve a consultar
// el estado actual de los registros.
// ============================================================

async function recargarContextoAccion(
  contexto: ContextoEquipoAdmin,
): Promise<ContextoEquipoAdmin> {
  const [equipo, formulario] = await Promise.all([
    obtenerEquipoAdmin(contexto.equipo.id),

    obtenerFormularioAdmin(contexto.formulario.id, contexto.edicion.id),
  ]);

  if (equipo.formulario_id !== formulario.id) {
    throw new ErrorAPI(
      409,
      "L'equip ja no està vinculat a aquesta inscripció.",
    );
  }

  return {
    ...contexto,

    equipo,

    formulario,
  };
}

// ============================================================
// ARCHIVAR EQUIPO
// ============================================================
//
// Disponible para:
//
// - BORRADOR
// - EN_REVISION
// - APROBADO
// - DENEGADO
//
// No se modifica formularios.estado.
//
// Se utiliza archivado_at para determinar si una inscripción
// está archivada.
//
// Se conservan los participantes, observaciones, escudo,
// responsable y datos históricos de la plaza.
//
// Las consultas de inscripciones activas deberán excluir
// los formularios cuyo archivado_at no sea NULL.
// ============================================================

export async function archivarEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosAccionAdmin): Promise<ResultadoArchivarEquipoAdmin> {
  // ========================================================
  // PERMISOS
  // ========================================================

  exigirPermisoEquip(contexto.usuario, contexto.torneo.id, "archivar");

  // ========================================================
  // CONFIRMACIÓN
  // ========================================================

  exigirConfirmacion(cuerpo);

  // ========================================================
  // ESTADO
  // ========================================================

  exigirFormularioArchivable(contexto.formulario);

  // ========================================================
  // VERSIONES
  // ========================================================

  exigirVersionesAccion({
    contexto,
    cuerpo,
  });

  // ========================================================
  // MOTIVO OPCIONAL
  // ========================================================

  const motivo = leerMotivoArchivado(cuerpo.motivo);

  // ========================================================
  // COMPETICIÓN
  // ========================================================

  await exigirEquipoSinCompeticion({
    equipoID: contexto.equipo.id,

    edicionID: contexto.edicion.id,
  });

  // ========================================================
  // PARTICIPANTES
  // ========================================================

  const participantesActivos = await contarParticipantesActivos(
    contexto.equipo.id,
  );

  // ========================================================
  // RECARGAR ANTES DE ARCHIVAR
  // ========================================================

  const contextoActual = await recargarContextoAccion(contexto);

  exigirFormularioArchivable(contextoActual.formulario);

  exigirVersionesAccion({
    contexto: contextoActual,
    cuerpo,
  });

  // ========================================================
  // ESTADO ANTERIOR
  // ========================================================

  const estadoAnterior = normalizarEstadoFormulario(
    contextoActual.formulario.estado,
  );

  const ahora = new Date().toISOString();

  // ========================================================
  // ARCHIVAR FORMULARIO
  // ========================================================
  //
  // Se mantiene el estado original de la inscripción.
  //
  // Tampoco se elimina usuario_id ni se desactivan
  // los participantes.
  // ========================================================

  const { data: formularioArchivado, error } = await supabaseAdmin
    .from("formularios")
    .update({
      archivado_at: ahora,

      archivado_por: contextoActual.usuario.id,

      estado_previo_archivado: estadoAnterior,

      motivo_archivado: motivo,

      updated_at: ahora,
    })
    .eq("id", contextoActual.formulario.id)
    .eq("edicion_id", contextoActual.edicion.id)
    .eq("tipo", "EQUIPO")
    .eq("estado", estadoAnterior)
    .eq("updated_at", contextoActual.formulario.updated_at)
    .is("archivado_at", null)
    .select(
      "id,estado,archivado_at,archivado_por,estado_previo_archivado,motivo_archivado,updated_at",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!formularioArchivado) {
    throw new ErrorAPI(
      409,
      "La inscripció ha canviat mentre intentaves arxivar-la. Torna a carregar la fitxa.",
    );
  }

  // ========================================================
  // LIBERACIÓN DE PARTICIPANTES
  // ========================================================
  //
  // No se modifica participantes_equipo.activo.
  //
  // Los participantes se liberan porque las consultas de
  // duplicados excluyen los formularios archivados.
  //
  // Esto permite conservar la composición del equipo.
  // ========================================================

  const participantesLiberados =
    estadoAnterior === "BORRADOR" ? 0 : participantesActivos;

  // ========================================================
  // METADATOS DE ARCHIVO
  // ========================================================

  const archivo = obtenerDatosArchivo({
    ...contextoActual.formulario,

    ...formularioArchivado,
  });

  // ========================================================
  // RESULTADO
  // ========================================================

  return {
    accion: "archivar",

    equipo_id: contextoActual.equipo.id,

    formulario_id: contextoActual.formulario.id,

    estado: estadoAnterior,

    participantes_liberados: participantesLiberados,

    archivo,

    formulario_updated_at: formularioArchivado.updated_at,

    mensaje: "L'equip s'ha arxivat correctament.",
  };
}

// ============================================================
// ELIMINAR OBSERVACIONES DEL FORMULARIO
// ============================================================

async function eliminarObservacionesEquipo(formularioID: string) {
  const { error } = await supabaseAdmin
    .from("observaciones_campos")
    .delete()
    .eq("formulario_id", formularioID);

  if (error) {
    throw error;
  }
}

// ============================================================
// DESVINCULAR CAPITÁN
// ============================================================
//
// equipos.capitan_id puede contener una referencia a
// participantes_equipo.
//
// Antes de eliminar los participantes se debe retirar
// esta referencia.
// ============================================================

async function desvincularCapitanEquipo({
  equipoID,
  formularioID,
  ahora,
}: {
  equipoID: string;
  formularioID: string;
  ahora: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("equipos")
    .update({
      capitan_id: null,

      updated_at: ahora,
    })
    .eq("id", equipoID)
    .eq("formulario_id", formularioID)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(409, "No s'ha pogut desvincular el capità de l'equip.");
  }
}

// ============================================================
// ELIMINAR PARTICIPANTES DEL EQUIPO
// ============================================================
//
// Se eliminan todos los participantes, independientemente
// de si están activos o desactivados.
// ============================================================

async function eliminarParticipantesEquipo(equipoID: string) {
  const { error } = await supabaseAdmin
    .from("participantes_equipo")
    .delete()
    .eq("equipo_id", equipoID);

  if (error) {
    throw error;
  }
}

// ============================================================
// ELIMINAR REGISTRO DEL EQUIPO
// ============================================================

async function eliminarRegistroEquipo({
  equipoID,
  formularioID,
}: {
  equipoID: string;
  formularioID: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("equipos")
    .delete()
    .eq("id", equipoID)
    .eq("formulario_id", formularioID)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(409, "No s'ha pogut eliminar el registre de l'equip.");
  }
}

// ============================================================
// ELIMINAR REGISTRO DEL FORMULARIO
// ============================================================
//
// Se vuelve a comprobar que el formulario sea un borrador
// no archivado antes de eliminar su registro.
// ============================================================

async function eliminarRegistroFormulario({
  formularioID,
  edicionID,
  version,
}: {
  formularioID: string;
  edicionID: string;
  version: string;
}) {
  const { data, error } = await supabaseAdmin
    .from("formularios")
    .delete()
    .eq("id", formularioID)
    .eq("edicion_id", edicionID)
    .eq("tipo", "EQUIPO")
    .eq("estado", "BORRADOR")
    .eq("updated_at", version)
    .is("archivado_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(
      409,
      "No s'ha pogut eliminar el formulari perquè ha canviat durant l'operació.",
    );
  }
}

// ============================================================
// RESERVAR VERSIÓN PARA LA ELIMINACIÓN
// ============================================================
//
// Se actualiza la versión del formulario antes de iniciar
// las operaciones destructivas.
//
// Esto reduce los conflictos entre acciones simultáneas,
// pero no constituye un bloqueo transaccional.
// ============================================================

async function reservarVersionEliminacion(
  contexto: ContextoEquipoAdmin,
): Promise<string> {
  const ahora = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("formularios")
    .update({
      updated_at: ahora,
    })
    .eq("id", contexto.formulario.id)
    .eq("edicion_id", contexto.edicion.id)
    .eq("tipo", "EQUIPO")
    .eq("estado", "BORRADOR")
    .eq("updated_at", contexto.formulario.updated_at)
    .is("archivado_at", null)
    .select("id,updated_at")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(
      409,
      "L'esborrany ha canviat. Torna a carregar-lo abans d'eliminar-lo.",
    );
  }

  return data.updated_at;
}

// ============================================================
// COMPROBAR QUE EL BORRADOR SIGUE SIENDO ELIMINABLE
// ============================================================

async function comprobarEliminacionVigente({
  formularioID,
  edicionID,
  version,
}: {
  formularioID: string;
  edicionID: string;
  version: string;
}) {
  const formulario = await obtenerFormularioAdmin(formularioID, edicionID);

  exigirFormularioEliminable(formulario);

  if (formulario.updated_at !== version) {
    throw new ErrorAPI(409, "L'esborrany ha canviat durant l'eliminació.");
  }
}

// ============================================================
// ELIMINAR ESCUDO DE STORAGE
// ============================================================
//
// Se utiliza el helper existente de equipStorage.ts.
//
// Solo se limpian los archivos asociados al identificador
// de este equipo.
//
// El escudo se elimina después de confirmar la eliminación
// de los registros de base de datos.
// ============================================================

async function eliminarEscudoEquipoAdmin({
  torneoID,
  edicionID,
  equipoID,
}: {
  torneoID: string;
  edicionID: string;
  equipoID: string;
}): Promise<boolean> {
  try {
    await guardarEscudoEquipo({
      torneoID,

      edicionID,

      equipoID,

      escudo: null,
    });

    return true;
  } catch (error) {
    console.error(
      `[EQUIPS] No s'ha pogut eliminar l'escut de l'equip ${equipoID}:`,
      error,
    );

    return false;
  }
}

// ============================================================
// ELIMINAR EQUIPO ADMIN
// ============================================================
//
// Solo está permitido para formularios:
//
// - En estado BORRADOR.
// - No archivados.
//
// Orden de eliminación:
//
// 1. Observaciones.
// 2. Referencia al capitán.
// 3. Participantes.
// 4. Equipo.
// 5. Formulario.
// 6. Escudo de Storage.
//
// Toda la lógica se realiza desde la API.
// ============================================================

export async function eliminarEquipoAdmin({
  contexto,
  cuerpo,
}: ParametrosAccionAdmin): Promise<ResultadoEliminarEquipoAdmin> {
  // ========================================================
  // PERMISOS
  // ========================================================

  exigirPermisoEquip(contexto.usuario, contexto.torneo.id, "eliminar");

  // ========================================================
  // CONFIRMACIÓN
  // ========================================================

  exigirConfirmacion(cuerpo);

  // ========================================================
  // ESTADO
  // ========================================================

  exigirFormularioEliminable(contexto.formulario);

  // ========================================================
  // VERSIONES
  // ========================================================

  exigirVersionesAccion({
    contexto,
    cuerpo,
  });

  // ========================================================
  // COMPETICIÓN
  // ========================================================

  await exigirEquipoSinCompeticion({
    equipoID: contexto.equipo.id,

    edicionID: contexto.edicion.id,

    eliminar: true,
  });

  // ========================================================
  // RECARGAR CONTEXTO
  // ========================================================

  const contextoActual = await recargarContextoAccion(contexto);

  exigirFormularioEliminable(contextoActual.formulario);

  exigirVersionesAccion({
    contexto: contextoActual,

    cuerpo,
  });

  // ========================================================
  // IDENTIFICADORES
  // ========================================================

  const equipoID = contextoActual.equipo.id;

  const formularioID = contextoActual.formulario.id;

  const edicionID = contextoActual.edicion.id;

  const torneoID = contextoActual.torneo.id;

  // ========================================================
  // CONTAR PARTICIPANTES
  // ========================================================

  const participantes = await contarTodosParticipantes(equipoID);

  // ========================================================
  // RESERVAR VERSIÓN
  // ========================================================

  const versionEliminacion = await reservarVersionEliminacion(contextoActual);

  const comprobarVigencia = async () => {
    await comprobarEliminacionVigente({
      formularioID,
      edicionID,
      version: versionEliminacion,
    });
  };

  // ========================================================
  // ELIMINAR DATOS
  // ========================================================
  //
  // Estas operaciones no constituyen una transacción.
  //
  // Se comprueba el formulario antes de cada paso.
  // En caso de error se interrumpe la eliminación y se
  // registra el punto en el que se ha producido el fallo.
  // ========================================================

  let paso = "comprovació inicial";

  try {
    await comprobarVigencia();

    await exigirEquipoSinCompeticion({
      equipoID,
      edicionID,

      eliminar: true,
    });

    // ====================================================
    // 1. OBSERVACIONES
    // ====================================================

    paso = "eliminació d'observacions";

    await comprobarVigencia();

    await eliminarObservacionesEquipo(formularioID);

    // ====================================================
    // 2. CAPITÁN
    // ====================================================

    paso = "desvinculació del capità";

    await comprobarVigencia();

    await desvincularCapitanEquipo({
      equipoID,

      formularioID,

      ahora: versionEliminacion,
    });

    // ====================================================
    // 3. PARTICIPANTES
    // ====================================================

    paso = "eliminació de participants";

    await comprobarVigencia();

    await eliminarParticipantesEquipo(equipoID);

    // ====================================================
    // 4. EQUIPO
    // ====================================================

    paso = "eliminació de l'equip";

    await comprobarVigencia();

    await eliminarRegistroEquipo({
      equipoID,

      formularioID,
    });

    // ====================================================
    // 5. FORMULARIO
    // ====================================================

    paso = "eliminació del formulari";

    await eliminarRegistroFormulario({
      formularioID,

      edicionID,

      version: versionEliminacion,
    });
  } catch (error) {
    console.error(
      `[EQUIPS] Error eliminant l'esborrany ${formularioID} de l'equip ${equipoID}. Pas: ${paso}.`,
      error,
    );

    throw new ErrorAPI(
      500,
      "No s'ha pogut completar l'eliminació. És possible que s'hagin eliminat algunes dades. Revisa l'estat de la inscripció abans de tornar-ho a intentar.",
    );
  }

  // ========================================================
  // 6. ESCUDO
  // ========================================================
  //
  // Un error de Storage no revierte ni invalida la
  // eliminación de los registros de la base de datos.
  // ========================================================

  const escudoEliminado = await eliminarEscudoEquipoAdmin({
    torneoID,
    edicionID,
    equipoID,
  });

  // ========================================================
  // RESULTADO
  // ========================================================

  return {
    accion: "eliminar",

    equipo_id: equipoID,

    formulario_id: formularioID,

    participantes_eliminados: participantes,

    escudo_eliminado: escudoEliminado,

    advertencia: escudoEliminado
      ? null
      : "L'equip s'ha eliminat, però no s'ha pogut netejar el seu escut de l'emmagatzematge.",

    mensaje: "L'esborrany de l'equip s'ha eliminat correctament.",
  };
}
