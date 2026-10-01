import { supabaseAdmin } from "@utils/supabase";

import { ErrorAPI } from "@utils/inscripcio/equipBase";

// ============================================================
// ACCIONES
// ============================================================

export const ACCIONES_ELIMINACION = [
  "RESULTADOS",
  "ACTAS",
  "PARTIDOS",
  "EQUIPOS",
  "VOLUNTARIOS",
  "EDICION",
] as const;

export type AccionEliminacion = (typeof ACCIONES_ELIMINACION)[number];

// ============================================================
// TIPOS
// ============================================================

type FormularioDB = {
  id: string;
  tipo: string | null;
  estado: string | null;
};

type EquipoDB = {
  id: string;
  formulario_id: string;
  nombre: string | null;
  plaza_estado: string | null;
  validacion_estado: string | null;
};

type VoluntarioDB = {
  id: string;
  formulario_id: string;

  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;

  email: string | null;

  tipo_voluntariado: string | null;

  plaza_estado: string | null;
  validacion_estado: string | null;
};

type PartidoDB = {
  id: string;

  codigo: string | null;
  nombre: string | null;

  estado: string | null;

  fase_tipo: string | null;

  publicado: boolean | null;
};

type ActaDB = {
  id: string;

  partido_id: string;

  estado: string | null;
};

type FaseDB = {
  id: string;

  nombre: string | null;

  tipo: string | null;
};

// ============================================================
// ETIQUETAS
// ============================================================

export function etiquetaAccionEliminacion(accion: AccionEliminacion) {
  switch (accion) {
    case "RESULTADOS":
      return "Eliminar resultats";

    case "ACTAS":
      return "Eliminar actes";

    case "PARTIDOS":
      return "Eliminar partits";

    case "EQUIPOS":
      return "Eliminar equips";

    case "VOLUNTARIOS":
      return "Eliminar voluntaris";

    case "EDICION":
      return "Eliminar l'edició completa";
  }
}

// ============================================================
// CONTAR POR EDICIÓN
// ============================================================
//
// IMPORTANTE:
//
// No todas las tablas tienen una columna "id".
//
// Ejemplo:
//
// competicion_equipos
//
// utiliza:
// - edicion_id
// - equipo_id
//
// Por eso NO debemos hacer:
//
// .select("id")
//
// Para contar utilizamos "*" con head:true.
// ============================================================

async function contarPorEdicion(tabla: string, edicionID: string) {
  const { count, error } = await supabaseAdmin
    .from(tabla)
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("edicion_id", edicionID);

  if (error) {
    console.error(`[ELIMINAR DATOS] Error contando ${tabla}:`, {
      message: error.message,

      code: error.code,

      details: error.details,

      hint: error.hint,
    });

    throw error;
  }

  return count ?? 0;
}

// ============================================================
// FORMULARIOS
// ============================================================

async function obtenerFormularios(edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("formularios")
    .select("id,tipo,estado")
    .eq("edicion_id", edicionID);

  if (error) {
    throw error;
  }

  return (data ?? []) as FormularioDB[];
}

// ============================================================
// EQUIPOS
// ============================================================

async function obtenerEquipos(idsFormularios: string[]) {
  if (idsFormularios.length === 0) {
    return [] as EquipoDB[];
  }

  const { data, error } = await supabaseAdmin
    .from("equipos")
    .select("id,formulario_id,nombre,plaza_estado,validacion_estado")
    .in("formulario_id", idsFormularios);

  if (error) {
    throw error;
  }

  return (data ?? []) as EquipoDB[];
}

// ============================================================
// VOLUNTARIOS
// ============================================================

async function obtenerVoluntarios(idsFormularios: string[]) {
  if (idsFormularios.length === 0) {
    return [] as VoluntarioDB[];
  }

  const { data, error } = await supabaseAdmin
    .from("voluntarios")
    .select(
      "id,formulario_id,nombre,apellido1,apellido2,email,tipo_voluntariado,plaza_estado,validacion_estado",
    )
    .in("formulario_id", idsFormularios);

  if (error) {
    throw error;
  }

  return (data ?? []) as VoluntarioDB[];
}

// ============================================================
// PARTIDOS
// ============================================================

async function obtenerPartidos(edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select("id,codigo,nombre,estado,fase_tipo,publicado")
    .eq("edicion_id", edicionID)
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as PartidoDB[];
}

// ============================================================
// ACTAS
// ============================================================

async function obtenerActas(edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select("id,partido_id,estado")
    .eq("edicion_id", edicionID);

  if (error) {
    throw error;
  }

  return (data ?? []) as ActaDB[];
}

// ============================================================
// EVENTOS
// ============================================================

async function contarEventos(actas: ActaDB[]) {
  const ids = actas.map((acta) => acta.id);

  if (ids.length === 0) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from("acta_eventos")
    .select("*", {
      count: "exact",
      head: true,
    })
    .in("acta_id", ids);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ============================================================
// PARTICIPANTES
// ============================================================

async function contarParticipantes(equipos: EquipoDB[]) {
  const ids = equipos.map((equipo) => equipo.id);

  if (ids.length === 0) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from("participantes_equipo")
    .select("*", {
      count: "exact",
      head: true,
    })
    .in("equipo_id", ids);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ============================================================
// FASES
// ============================================================

async function obtenerFases(edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select("id,nombre,tipo")
    .eq("edicion_id", edicionID)
    .order("orden", {
      ascending: true,
    });

  if (error) {
    throw error;
  }

  return (data ?? []) as FaseDB[];
}

// ============================================================
// CONTAR SEGÚN FASES
// ============================================================

async function contarPorFases(
  tabla: string,

  fases: FaseDB[],
) {
  const ids = fases.map((fase) => fase.id);

  if (ids.length === 0) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from(tabla)
    .select("*", {
      count: "exact",
      head: true,
    })
    .in("fase_id", ids);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ============================================================
// PREVIEW
// ============================================================

export async function obtenerPreviewEliminacion(edicionID: string) {
  const [
    formularios,
    partidos,
    actas,
    fases,

    resultados,
    estadisticasEquipo,
    estadisticasIndividuales,

    plazas,
    equiposCompeticion,
    definicionesEstadisticas,

    configuracion,
  ] = await Promise.all([
    obtenerFormularios(edicionID),

    obtenerPartidos(edicionID),

    obtenerActas(edicionID),

    obtenerFases(edicionID),

    contarPorEdicion("competicion_resultados", edicionID),

    contarPorEdicion("competicion_estadisticas_equipo", edicionID),

    contarPorEdicion("competicion_estadisticas_individuales", edicionID),

    contarPorEdicion("competicion_plazas", edicionID),

    contarPorEdicion("competicion_equipos", edicionID),

    contarPorEdicion("competicion_estadisticas", edicionID),

    supabaseAdmin
      .from("configuracion_ediciones")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("edicion_id", edicionID),
  ]);

  if (configuracion.error) {
    throw configuracion.error;
  }

  // ========================================================
  // FORMULARIOS EQUIPO
  // ========================================================

  const formulariosEquipo = formularios.filter(
    (formulario) => formulario.tipo === "EQUIPO",
  );

  // ========================================================
  // FORMULARIOS VOLUNTARIO
  // ========================================================

  const formulariosVoluntario = formularios.filter(
    (formulario) => formulario.tipo === "VOLUNTARIO",
  );

  // ========================================================
  // EQUIPOS Y VOLUNTARIOS
  // ========================================================

  const [equipos, voluntarios] = await Promise.all([
    obtenerEquipos(formulariosEquipo.map((formulario) => formulario.id)),

    obtenerVoluntarios(
      formulariosVoluntario.map((formulario) => formulario.id),
    ),
  ]);

  // ========================================================
  // RELACIONES
  // ========================================================

  const [participantes, eventos, grupos, rondas] = await Promise.all([
    contarParticipantes(equipos),

    contarEventos(actas),

    contarPorFases("competicion_grupos", fases),

    contarPorFases("competicion_rondas", fases),
  ]);

  // ========================================================
  // ESTADOS DE PARTIDOS
  // ========================================================

  const estados = {
    borrador: partidos.filter((partido) => partido.estado === "BORRADOR")
      .length,

    programados: partidos.filter((partido) => partido.estado === "PROGRAMADO")
      .length,

    enCurso: partidos.filter((partido) => partido.estado === "EN_CURSO").length,

    finalizados: partidos.filter((partido) => partido.estado === "FINALIZADO")
      .length,

    suspendidos: partidos.filter((partido) => partido.estado === "SUSPENDIDO")
      .length,

    cancelados: partidos.filter((partido) => partido.estado === "CANCELADO")
      .length,
  };

  // ========================================================
  // RESPUESTA
  // ========================================================

  return {
    resultados: {
      resultados,

      estadisticasEquipo,

      estadisticasIndividuales,

      total: resultados + estadisticasEquipo + estadisticasIndividuales,
    },

    actas: {
      actas: actas.length,

      eventos,

      total: actas.length + eventos,

      elementos: actas.map((acta) => ({
        id: acta.id,

        partidoID: acta.partido_id,

        estado: acta.estado,
      })),
    },

    partidos: {
      partidos: partidos.length,

      plazas,

      estados,

      elementos: partidos.map((partido) => ({
        id: partido.id,

        codigo: partido.codigo,

        nombre: partido.nombre,

        estado: partido.estado,

        tipo: partido.fase_tipo,

        publicado: partido.publicado,
      })),
    },

    equipos: {
      formularios: formulariosEquipo.length,

      equipos: equipos.length,

      participantes,

      competicion: equiposCompeticion,

      elementos: equipos.map((equipo) => ({
        id: equipo.id,

        nombre: equipo.nombre,

        plazaEstado: equipo.plaza_estado,

        validacionEstado: equipo.validacion_estado,
      })),
    },

    voluntarios: {
      formularios: formulariosVoluntario.length,

      voluntarios: voluntarios.length,

      elementos: voluntarios.map((voluntario) => ({
        id: voluntario.id,

        nombre: [voluntario.nombre, voluntario.apellido1, voluntario.apellido2]
          .filter(Boolean)
          .join(" "),

        email: voluntario.email,

        tipo: voluntario.tipo_voluntariado,

        plazaEstado: voluntario.plaza_estado,

        validacionEstado: voluntario.validacion_estado,
      })),
    },

    estructura: {
      fases: fases.length,

      grupos,

      rondas,

      plazas,

      estadisticas: definicionesEstadisticas,

      configuracion: configuracion.count ?? 0,

      fasesDetalle: fases,
    },

    edicionCompleta: {
      formularios: formularios.length,

      equipos: equipos.length,

      participantes,

      voluntarios: voluntarios.length,

      partidos: partidos.length,

      actas: actas.length,

      eventos,

      resultados,

      estadisticasEquipo,

      estadisticasIndividuales,

      equiposCompeticion,

      fases: fases.length,

      grupos,

      rondas,

      plazas,

      definicionesEstadisticas,

      configuracion: configuracion.count ?? 0,
    },
  };
}

// ============================================================
// BORRAR POR EDICIÓN
// ============================================================

async function borrarPorEdicion(
  tabla: string,

  edicionID: string,
) {
  const { error } = await supabaseAdmin
    .from(tabla)
    .delete()
    .eq("edicion_id", edicionID);

  if (error) {
    console.error(`[ELIMINAR DATOS] Error eliminando ${tabla}:`, {
      message: error.message,

      code: error.code,

      details: error.details,

      hint: error.hint,
    });

    throw error;
  }
}

// ============================================================
// LIMPIAR BRACKET
// ============================================================

async function limpiarDependenciasBracket(edicionID: string) {
  const { error } = await supabaseAdmin
    .from("competicion_plazas")
    .update({
      equipo_resuelto_id: null,

      resuelta_at: null,
    })
    .eq("edicion_id", edicionID)
    .in("origen_tipo", ["GANADOR_PARTIDO", "PERDEDOR_PARTIDO"]);

  if (error) {
    throw error;
  }
}

// ============================================================
// ELIMINAR RESULTADOS
// ============================================================

async function eliminarResultados(edicionID: string) {
  await borrarPorEdicion("competicion_estadisticas_individuales", edicionID);

  await borrarPorEdicion("competicion_estadisticas_equipo", edicionID);

  await borrarPorEdicion("competicion_resultados", edicionID);

  await limpiarDependenciasBracket(edicionID);
}

// ============================================================
// RESTAURAR PARTIDOS FINALIZADOS
// ============================================================

async function restaurarPartidosFinalizados(edicionID: string) {
  // ========================================================
  // PUBLICADOS
  // ========================================================

  const { error: errorProgramados } = await supabaseAdmin
    .from("competicion_partidos")
    .update({
      estado: "PROGRAMADO",

      finalizado_at: null,
    })
    .eq("edicion_id", edicionID)
    .eq("estado", "FINALIZADO")
    .eq("publicado", true);

  if (errorProgramados) {
    throw errorProgramados;
  }

  // ========================================================
  // NO PUBLICADOS
  // ========================================================

  const { error: errorBorradores } = await supabaseAdmin
    .from("competicion_partidos")
    .update({
      estado: "BORRADOR",

      finalizado_at: null,
    })
    .eq("edicion_id", edicionID)
    .eq("estado", "FINALIZADO")
    .eq("publicado", false);

  if (errorBorradores) {
    throw errorBorradores;
  }
}

// ============================================================
// ELIMINAR ACTAS
// ============================================================

async function eliminarActas(edicionID: string) {
  const {
    data: actasData,

    error: errorActas,
  } = await supabaseAdmin
    .from("acta_partidos")
    .select("id")
    .eq("edicion_id", edicionID);

  if (errorActas) {
    throw errorActas;
  }

  const idsActas = (actasData ?? []).map((acta) => acta.id);

  // ========================================================
  // RESULTADOS Y ESTADÍSTICAS
  // ========================================================

  await eliminarResultados(edicionID);

  // ========================================================
  // EVENTOS
  // ========================================================

  if (idsActas.length > 0) {
    const { error: errorEventos } = await supabaseAdmin
      .from("acta_eventos")
      .delete()
      .in("acta_id", idsActas);

    if (errorEventos) {
      throw errorEventos;
    }
  }

  // ========================================================
  // ACTAS
  // ========================================================

  const { error: errorEliminarActas } = await supabaseAdmin
    .from("acta_partidos")
    .delete()
    .eq("edicion_id", edicionID);

  if (errorEliminarActas) {
    throw errorEliminarActas;
  }

  // ========================================================
  // RESTAURAR PARTIDOS
  // ========================================================

  await restaurarPartidosFinalizados(edicionID);
}

// ============================================================
// ELIMINAR PARTIDOS
// ============================================================

async function eliminarPartidos(edicionID: string) {
  // ========================================================
  // ACTAS / RESULTADOS / ESTADÍSTICAS
  // ========================================================

  await eliminarActas(edicionID);

  // ========================================================
  // PLAZAS DESTINADAS A PARTIDOS
  // ========================================================

  const { error: errorPlazas } = await supabaseAdmin
    .from("competicion_plazas")
    .delete()
    .eq("edicion_id", edicionID)
    .eq("destino_tipo", "PARTIDO");

  if (errorPlazas) {
    throw errorPlazas;
  }

  // ========================================================
  // PARTIDOS
  // ========================================================

  const { error: errorPartidos } = await supabaseAdmin
    .from("competicion_partidos")
    .delete()
    .eq("edicion_id", edicionID);

  if (errorPartidos) {
    throw errorPartidos;
  }
}

// ============================================================
// FORMULARIOS POR TIPO
// ============================================================

async function obtenerIDsFormulariosTipo(
  edicionID: string,

  tipo: "EQUIPO" | "VOLUNTARIO",
) {
  const { data, error } = await supabaseAdmin
    .from("formularios")
    .select("id")
    .eq("edicion_id", edicionID)
    .eq("tipo", tipo);

  if (error) {
    throw error;
  }

  return (data ?? []).map((formulario) => formulario.id);
}

// ============================================================
// IDS EQUIPOS
// ============================================================

async function obtenerIDsEquipos(formularios: string[]) {
  if (formularios.length === 0) {
    return [] as string[];
  }

  const { data, error } = await supabaseAdmin
    .from("equipos")
    .select("id")
    .in("formulario_id", formularios);

  if (error) {
    throw error;
  }

  return (data ?? []).map((equipo) => equipo.id);
}

// ============================================================
// OBSERVACIONES
// ============================================================

async function eliminarObservacionesFormularios(formularios: string[]) {
  if (formularios.length === 0) {
    return;
  }

  const { error } = await supabaseAdmin
    .from("observaciones_campos")
    .delete()
    .in("formulario_id", formularios);

  if (error) {
    throw error;
  }
}

// ============================================================
// ASEGURAR QUE NO HAY PARTIDOS
// ============================================================

async function exigirSinPartidos(edicionID: string) {
  const [partidos, actas, resultados] = await Promise.all([
    contarPorEdicion("competicion_partidos", edicionID),

    contarPorEdicion("acta_partidos", edicionID),

    contarPorEdicion("competicion_resultados", edicionID),
  ]);

  if (partidos > 0 || actas > 0 || resultados > 0) {
    throw new ErrorAPI(
      409,
      "Abans d'eliminar els equips has d'eliminar els partits de l'edició.",
    );
  }
}

// ============================================================
// ELIMINAR EQUIPOS
// ============================================================

async function eliminarEquipos(edicionID: string) {
  await exigirSinPartidos(edicionID);

  const formularios = await obtenerIDsFormulariosTipo(edicionID, "EQUIPO");

  const equipos = await obtenerIDsEquipos(formularios);

  // ========================================================
  // PLAZAS RESTANTES
  // ========================================================

  await borrarPorEdicion("competicion_plazas", edicionID);

  // ========================================================
  // EQUIPOS DE COMPETICIÓN
  // ========================================================

  await borrarPorEdicion("competicion_equipos", edicionID);

  // ========================================================
  // OBSERVACIONES
  // ========================================================

  await eliminarObservacionesFormularios(formularios);

  // ========================================================
  // PARTICIPANTES / EQUIPOS
  // ========================================================

  if (equipos.length > 0) {
    // Quitar referencias de capitán antes
    // de eliminar participantes.

    const { error: errorCapitan } = await supabaseAdmin
      .from("equipos")
      .update({
        capitan_id: null,
      })
      .in("id", equipos);

    if (errorCapitan) {
      throw errorCapitan;
    }

    const { error: errorParticipantes } = await supabaseAdmin
      .from("participantes_equipo")
      .delete()
      .in("equipo_id", equipos);

    if (errorParticipantes) {
      throw errorParticipantes;
    }

    const { error: errorEquipos } = await supabaseAdmin
      .from("equipos")
      .delete()
      .in("id", equipos);

    if (errorEquipos) {
      throw errorEquipos;
    }
  }

  // ========================================================
  // FORMULARIOS
  // ========================================================

  if (formularios.length > 0) {
    const { error: errorFormularios } = await supabaseAdmin
      .from("formularios")
      .delete()
      .in("id", formularios);

    if (errorFormularios) {
      throw errorFormularios;
    }
  }
}

// ============================================================
// ELIMINAR VOLUNTARIOS
// ============================================================

async function eliminarVoluntarios(edicionID: string) {
  const formularios = await obtenerIDsFormulariosTipo(edicionID, "VOLUNTARIO");

  // ========================================================
  // OBSERVACIONES
  // ========================================================

  await eliminarObservacionesFormularios(formularios);

  if (formularios.length === 0) {
    return;
  }

  // ========================================================
  // VOLUNTARIOS
  // ========================================================

  const { error: errorVoluntarios } = await supabaseAdmin
    .from("voluntarios")
    .delete()
    .in("formulario_id", formularios);

  if (errorVoluntarios) {
    throw errorVoluntarios;
  }

  // ========================================================
  // FORMULARIOS
  // ========================================================

  const { error: errorFormularios } = await supabaseAdmin
    .from("formularios")
    .delete()
    .in("id", formularios);

  if (errorFormularios) {
    throw errorFormularios;
  }

  /*
   * No se eliminan usuarios.
   *
   * La cuenta puede participar en otras ediciones
   * o tener otros roles en la plataforma.
   */
}

// ============================================================
// ESTRUCTURA DE COMPETICIÓN
// ============================================================

async function eliminarEstructuraCompeticion(edicionID: string) {
  const {
    data: fasesData,

    error: errorFases,
  } = await supabaseAdmin
    .from("competicion_fases")
    .select("id")
    .eq("edicion_id", edicionID);

  if (errorFases) {
    throw errorFases;
  }

  const fases = (fasesData ?? []).map((fase) => fase.id);

  // ========================================================
  // PLAZAS
  // ========================================================

  await borrarPorEdicion("competicion_plazas", edicionID);

  // ========================================================
  // DEFINICIONES DE ESTADÍSTICAS
  // ========================================================

  await borrarPorEdicion("competicion_estadisticas", edicionID);

  // ========================================================
  // GRUPOS Y RONDAS
  // ========================================================

  if (fases.length > 0) {
    const { error: errorGrupos } = await supabaseAdmin
      .from("competicion_grupos")
      .delete()
      .in("fase_id", fases);

    if (errorGrupos) {
      throw errorGrupos;
    }

    const { error: errorRondas } = await supabaseAdmin
      .from("competicion_rondas")
      .delete()
      .in("fase_id", fases);

    if (errorRondas) {
      throw errorRondas;
    }
  }

  // ========================================================
  // FASES
  // ========================================================

  const { error: errorEliminarFases } = await supabaseAdmin
    .from("competicion_fases")
    .delete()
    .eq("edicion_id", edicionID);

  if (errorEliminarFases) {
    throw errorEliminarFases;
  }
}

// ============================================================
// ELIMINAR EDICIÓN COMPLETA
// ============================================================

async function eliminarEdicionCompleta(edicionID: string) {
  // ========================================================
  // PARTIDOS / ACTAS / RESULTADOS
  // ========================================================

  await eliminarPartidos(edicionID);

  // ========================================================
  // EQUIPOS
  // ========================================================

  await eliminarEquipos(edicionID);

  // ========================================================
  // VOLUNTARIOS
  // ========================================================

  await eliminarVoluntarios(edicionID);

  // ========================================================
  // ESTRUCTURA
  // ========================================================

  await eliminarEstructuraCompeticion(edicionID);

  // ========================================================
  // OBSERVACIONES RESTANTES
  // ========================================================

  const { error: errorObservaciones } = await supabaseAdmin
    .from("observaciones_campos")
    .delete()
    .eq("edicion_id", edicionID);

  if (errorObservaciones) {
    throw errorObservaciones;
  }

  // ========================================================
  // FORMULARIOS RESTANTES
  // ========================================================

  const { error: errorFormularios } = await supabaseAdmin
    .from("formularios")
    .delete()
    .eq("edicion_id", edicionID);

  if (errorFormularios) {
    throw errorFormularios;
  }

  // ========================================================
  // CONFIGURACIÓN
  // ========================================================

  const { error: errorConfiguracion } = await supabaseAdmin
    .from("configuracion_ediciones")
    .delete()
    .eq("edicion_id", edicionID);

  if (errorConfiguracion) {
    throw errorConfiguracion;
  }

  // ========================================================
  // EDICIÓN
  // ========================================================

  const { error: errorEdicion } = await supabaseAdmin
    .from("ediciones")
    .delete()
    .eq("id", edicionID);

  if (errorEdicion) {
    throw errorEdicion;
  }
}

// ============================================================
// EJECUTAR
// ============================================================

export async function ejecutarEliminacion(
  accion: AccionEliminacion,

  edicionID: string,
) {
  switch (accion) {
    case "RESULTADOS":
      await eliminarResultados(edicionID);

      return;

    case "ACTAS":
      await eliminarActas(edicionID);

      return;

    case "PARTIDOS":
      await eliminarPartidos(edicionID);

      return;

    case "EQUIPOS":
      await eliminarEquipos(edicionID);

      return;

    case "VOLUNTARIOS":
      await eliminarVoluntarios(edicionID);

      return;

    case "EDICION":
      await eliminarEdicionCompleta(edicionID);

      return;
  }
}
