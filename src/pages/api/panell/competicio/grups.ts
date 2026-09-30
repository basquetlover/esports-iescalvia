import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

// ============================================================
// ERRORES
// ============================================================

function errorRespuesta(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  const codigo =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;

  if (codigo === "23503") {
    return responder(
      {
        success: false,
        mensaje:
          "Aquest element està relacionat amb altres dades de la competició.",
      },
      409,
    );
  }

  if (codigo === "23505") {
    return responder(
      {
        success: false,
        mensaje: "Ja existeix un element amb aquestes dades.",
      },
      409,
    );
  }

  console.error("Error gestionant la fase de grups:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

// ============================================================
// VALIDACIONES
// ============================================================

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim().toLowerCase();

  if (!UUID.test(limpio)) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return limpio;
}

function texto(
  valor: unknown,
  nombre: string,
  maximo: number,
  obligatorio = false,
): string {
  if (valor === undefined || valor === null) {
    if (obligatorio) {
      throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
    }

    return "";
  }

  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim();

  if (obligatorio && !limpio) {
    throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
  }

  if (limpio.length > maximo) {
    throw new ErrorAPI(
      400,
      `El camp ${nombre} supera els ${maximo} caràcters.`,
    );
  }

  return limpio;
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirContexto(
  usuario: Usuario,
  torneoID: string,
  edicionID: string,
  accion: "ver" | "editar",
) {
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  if (!tienePermiso(usuario, "competicio", accion, torneoID)) {
    throw new ErrorAPI(
      403,
      accion === "editar"
        ? "No tens permís per modificar la competició."
        : "No tens permís per consultar la competició.",
    );
  }

  const [torneoRespuesta, edicionRespuesta] = await Promise.all([
    supabaseAdmin
      .from("torneos")
      .select("id,nombre,deporte")
      .eq("id", torneoID)
      .maybeSingle(),

    supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id,nombre,estado")
      .eq("id", edicionID)
      .maybeSingle(),
  ]);

  if (torneoRespuesta.error) {
    throw torneoRespuesta.error;
  }

  if (edicionRespuesta.error) {
    throw edicionRespuesta.error;
  }

  if (!torneoRespuesta.data) {
    throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  }

  if (!edicionRespuesta.data || edicionRespuesta.data.torneo_id !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig seleccionat.");
  }

  return {
    torneo: torneoRespuesta.data,

    edicion: edicionRespuesta.data,
  };
}

// ============================================================
// FASE
// ============================================================

async function exigirFase(faseID: string, edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select(
      "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at",
    )
    .eq("id", faseID)
    .eq("edicion_id", edicionID)
    .eq("tipo", "GRUPOS")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat la fase de grups.");
  }

  return data;
}

// ============================================================
// GRUPO
// ============================================================

async function exigirGrupo(grupoID: string, edicionID: string) {
  const { data: grupo, error } = await supabaseAdmin
    .from("competicion_grupos")
    .select("id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at")
    .eq("id", grupoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!grupo) {
    throw new ErrorAPI(404, "No s'ha trobat el grup.");
  }

  const fase = await exigirFase(grupo.fase_id, edicionID);

  return {
    grupo,
    fase,
  };
}

// ============================================================
// EQUIPO ACTIVO
// ============================================================

async function exigirEquipoActivo(edicionID: string, equipoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_equipos")
    .select("equipo_id,estado")
    .eq("edicion_id", edicionID)
    .eq("equipo_id", equipoID)
    .eq("estado", "ACTIVO")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(409, "Aquest equip no forma part de la competició.");
  }

  return data;
}

// ============================================================
// CONTAR
// ============================================================

async function contar(tabla: string, columna: string, id: string) {
  const { count, error } = await supabaseAdmin
    .from(tabla)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(columna, id);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

// ============================================================
// ORDEN FASE
// ============================================================

async function siguienteOrdenFase(edicionID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_fases")
    .select("orden")
    .eq("edicion_id", edicionID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? -1) + 1;
}

// ============================================================
// ORDEN GRUPO
// ============================================================

async function siguienteOrdenGrupo(faseID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_grupos")
    .select("orden")
    .eq("fase_id", faseID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? -1) + 1;
}

// ============================================================
// ORDEN PLAZA
// ============================================================

async function siguienteOrdenPlaza(grupoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select("orden")
    .eq("destino_tipo", "GRUPO")
    .eq("grupo_id", grupoID)
    .order("orden", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0]?.orden ?? 0) + 1;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    const contexto = await exigirContexto(usuario, torneoID, edicionID, "ver");

    // ==================================================
    // FASES
    // ==================================================

    const { data: fases, error: errorFases } = await supabaseAdmin
      .from("competicion_fases")
      .select(
        "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at",
      )
      .eq("edicion_id", edicionID)
      .eq("tipo", "GRUPOS")
      .order("orden", {
        ascending: true,
      });

    if (errorFases) {
      throw errorFases;
    }

    const idsFases = (fases ?? []).map((fase) => fase.id);

    // ==================================================
    // GRUPOS
    // ==================================================

    let grupos: Record<string, unknown>[] = [];

    if (idsFases.length > 0) {
      const respuesta = await supabaseAdmin
        .from("competicion_grupos")
        .select(
          "id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at",
        )
        .in("fase_id", idsFases)
        .order("orden", {
          ascending: true,
        });

      if (respuesta.error) {
        throw respuesta.error;
      }

      grupos = respuesta.data ?? [];
    }

    // ==================================================
    // PLAZAS DE GRUPO
    // ==================================================

    const { data: plazas, error: errorPlazas } = await supabaseAdmin
      .from("competicion_plazas")
      .select(
        "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,partido_id,lado,orden,origen_tipo,equipo_origen_id,origen_grupo_id,origen_fase_id,origen_posicion,origen_partido_id,equipo_resuelto_id,resuelta_at",
      )
      .eq("edicion_id", edicionID)
      .eq("destino_tipo", "GRUPO")
      .order("orden", {
        ascending: true,
      });

    if (errorPlazas) {
      throw errorPlazas;
    }

    // ==================================================
    // PARTIDOS DE GRUPOS
    // ==================================================

    const { data: partidos, error: errorPartidos } = await supabaseAdmin
      .from("competicion_partidos")
      .select("id,fase_id,grupo_id,estado")
      .eq("edicion_id", edicionID)
      .eq("tipo", "GRUPOS");

    if (errorPartidos) {
      throw errorPartidos;
    }

    const partidosPorGrupo = new Map<string, number>();

    for (const partido of partidos ?? []) {
      if (!partido.grupo_id) {
        continue;
      }

      partidosPorGrupo.set(
        partido.grupo_id,
        (partidosPorGrupo.get(partido.grupo_id) ?? 0) + 1,
      );
    }

    // ==================================================
    // EQUIPOS ACTIVOS
    // ==================================================

    const { data: registrosEquipos, error: errorRegistrosEquipos } =
      await supabaseAdmin
        .from("competicion_equipos")
        .select("equipo_id,estado")
        .eq("edicion_id", edicionID)
        .eq("estado", "ACTIVO");

    if (errorRegistrosEquipos) {
      throw errorRegistrosEquipos;
    }

    const idsEquipos = (registrosEquipos ?? []).map(
      (registro) => registro.equipo_id,
    );

    let equipos: {
      id: string;
      nombre: string;
      escudo: string | null;
    }[] = [];

    if (idsEquipos.length > 0) {
      const respuesta = await supabaseAdmin
        .from("equipos")
        .select("id,nombre,escudo")
        .in("id", idsEquipos)
        .order("nombre", {
          ascending: true,
        });

      if (respuesta.error) {
        throw respuesta.error;
      }

      equipos = (respuesta.data ?? []).map((equipo) => ({
        id: equipo.id,

        nombre: equipo.nombre ?? "Equip",

        escudo: equipo.escudo ?? null,
      }));
    }

    // ==================================================
    // SALIDA
    // ==================================================

    const fasesSalida = (fases ?? []).map((fase) => ({
      ...fase,

      grupos: grupos
        .filter((grupo) => grupo.fase_id === fase.id)
        .map((grupo) => ({
          ...grupo,

          partidos: partidosPorGrupo.get(grupo.id as string) ?? 0,
        })),
    }));

    return responder({
      success: true,

      torneo: contexto.torneo,

      edicion: contexto.edicion,

      capacidades: {
        editar: tienePermiso(usuario, "competicio", "editar", torneoID),
      },

      fases: fasesSalida,

      plazas: plazas ?? [],

      equipos,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const accion = texto(entrada.accion, "acció", 60, true);

    // ==================================================
    // CREAR FASE
    // ==================================================

    if (accion === "crear_fase") {
      const nombre = texto(entrada.nombre, "nom", 120, true);

      const orden = await siguienteOrdenFase(edicionID);

      const { data, error } = await supabaseAdmin
        .from("competicion_fases")
        .insert({
          edicion_id: edicionID,

          nombre,

          tipo: "GRUPOS",

          orden,

          estado: "BORRADOR",

          publicada: false,

          configuracion: {},
        })
        .select(
          "id,edicion_id,nombre,tipo,orden,estado,publicada,configuracion,cerrada_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,
          fase: data,
        },
        201,
      );
    }

    // ==================================================
    // CREAR GRUPO
    // ==================================================

    if (accion === "crear_grupo") {
      const faseID = identificador(entrada.faseID, "fase");

      const fase = await exigirFase(faseID, edicionID);

      if (fase.estado !== "BORRADOR") {
        throw new ErrorAPI(409, "La fase ja no es pot modificar.");
      }

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const orden = await siguienteOrdenGrupo(fase.id);

      const { data, error } = await supabaseAdmin
        .from("competicion_grupos")
        .insert({
          fase_id: fase.id,

          nombre,

          orden,

          estado: "PREPARADO",
        })
        .select(
          "id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,
          grupo: data,
        },
        201,
      );
    }

    // ==================================================
    // ASIGNAR EQUIPO
    // ==================================================

    if (accion === "asignar_equipo") {
      const grupoID = identificador(entrada.grupoID, "grup");

      const equipoID = identificador(entrada.equipoID, "equip");

      const { grupo, fase } = await exigirGrupo(grupoID, edicionID);

      if (grupo.estado !== "PREPARADO") {
        throw new ErrorAPI(
          409,
          "Només es pot modificar un grup en preparació.",
        );
      }

      const partidosGrupo = await contar(
        "competicion_partidos",
        "grupo_id",
        grupo.id,
      );

      if (partidosGrupo > 0) {
        throw new ErrorAPI(
          409,
          "No es pot modificar la composició del grup perquè ja té partits creats.",
        );
      }

      await exigirEquipoActivo(edicionID, equipoID);

      // Ya está en otro grupo de esta misma fase

      const { data: existente, error: errorExistente } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id,grupo_id")
        .eq("edicion_id", edicionID)
        .eq("destino_fase_id", fase.id)
        .eq("destino_tipo", "GRUPO")
        .eq("equipo_resuelto_id", equipoID)
        .limit(1)
        .maybeSingle();

      if (errorExistente) {
        throw errorExistente;
      }

      if (existente) {
        throw new ErrorAPI(
          409,
          "Aquest equip ja està assignat a un grup d'aquesta fase.",
        );
      }

      const orden = await siguienteOrdenPlaza(grupo.id);

      const ahora = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from("competicion_plazas")
        .insert({
          edicion_id: edicionID,

          destino_fase_id: fase.id,

          destino_tipo: "GRUPO",

          grupo_id: grupo.id,

          partido_id: null,

          lado: null,

          orden,

          origen_tipo: "EQUIPO",

          equipo_origen_id: equipoID,

          origen_grupo_id: null,

          origen_fase_id: null,

          origen_posicion: null,

          origen_partido_id: null,

          equipo_resuelto_id: equipoID,

          resuelta_at: ahora,
        })
        .select(
          "id,edicion_id,destino_fase_id,destino_tipo,grupo_id,orden,origen_tipo,equipo_origen_id,equipo_resuelto_id,resuelta_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder(
        {
          success: true,
          plaza: data,
        },
        201,
      );
    }

    throw new ErrorAPI(400, "L'acció indicada no existeix.");
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// PATCH
// ============================================================

export const PATCH: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const accion = texto(entrada.accion, "acció", 60, true);

    // ==================================================
    // EDITAR FASE
    // ==================================================

    if (accion === "editar_fase") {
      const faseID = identificador(entrada.faseID, "fase");

      await exigirFase(faseID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const { data, error } = await supabaseAdmin
        .from("competicion_fases")
        .update({
          nombre,
        })
        .eq("id", faseID)
        .eq("edicion_id", edicionID)
        .select("id,nombre,tipo,orden,estado,publicada")
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,
        fase: data,
      });
    }

    // ==================================================
    // EDITAR GRUPO
    // ==================================================

    if (accion === "editar_grupo") {
      const grupoID = identificador(entrada.grupoID, "grup");

      const { grupo } = await exigirGrupo(grupoID, edicionID);

      const nombre = texto(entrada.nombre, "nom", 120, true);

      const { data, error } = await supabaseAdmin
        .from("competicion_grupos")
        .update({
          nombre,
        })
        .eq("id", grupo.id)
        .select(
          "id,fase_id,nombre,orden,estado,version_clasificacion,cerrada_at",
        )
        .single();

      if (error) {
        throw error;
      }

      return responder({
        success: true,
        grupo: data,
      });
    }

    throw new ErrorAPI(400, "L'acció indicada no existeix.");
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// DELETE
// ============================================================

export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);

    const entrada = await leerJSON(request);

    const torneoID = identificador(entrada.torneoID, "torneig");

    const edicionID = identificador(entrada.edicionID, "edició");

    await exigirContexto(usuario, torneoID, edicionID, "editar");

    const accion = texto(entrada.accion, "acció", 60, true);

    // ==================================================
    // QUITAR EQUIPO
    // ==================================================

    if (accion === "quitar_equipo") {
      const plazaID = identificador(entrada.plazaID, "plaça");

      const { data: plaza, error: errorPlaza } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id,grupo_id")
        .eq("id", plazaID)
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "GRUPO")
        .maybeSingle();

      if (errorPlaza) {
        throw errorPlaza;
      }

      if (!plaza || !plaza.grupo_id) {
        throw new ErrorAPI(404, "No s'ha trobat l'assignació.");
      }

      const { grupo } = await exigirGrupo(plaza.grupo_id, edicionID);

      if (grupo.estado !== "PREPARADO") {
        throw new ErrorAPI(
          409,
          "No es pot modificar la composició d'un grup que ja ha començat.",
        );
      }

      const partidosGrupo = await contar(
        "competicion_partidos",
        "grupo_id",
        grupo.id,
      );

      if (partidosGrupo > 0) {
        throw new ErrorAPI(
          409,
          "No es pot modificar la composició del grup perquè ja té partits creats.",
        );
      }

      const { data: eliminada, error } = await supabaseAdmin
        .from("competicion_plazas")
        .delete()
        .eq("id", plaza.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!eliminada) {
        throw new ErrorAPI(409, "L'assignació no s'ha pogut eliminar.");
      }

      return responder({
        success: true,
      });
    }

    // ==================================================
    // ELIMINAR GRUPO
    // ==================================================

    if (accion === "eliminar_grupo") {
      const grupoID = identificador(entrada.grupoID, "grup");

      const { grupo } = await exigirGrupo(grupoID, edicionID);

      const [partidos, clasificaciones] = await Promise.all([
        contar("competicion_partidos", "grupo_id", grupo.id),

        contar("competicion_clasificaciones", "grupo_id", grupo.id),
      ]);

      const { count: plazas, error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id", {
          count: "exact",

          head: true,
        })
        .or(`grupo_id.eq.${grupo.id},origen_grupo_id.eq.${grupo.id}`);

      if (errorPlazas) {
        throw errorPlazas;
      }

      if (partidos > 0 || clasificaciones > 0 || (plazas ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar el grup perquè encara té dades associades. Lleva primer els equips i qualsevol encreuament que depengui del grup.",
        );
      }

      if (grupo.estado !== "PREPARADO") {
        throw new ErrorAPI(
          409,
          "No es pot eliminar un grup que ja ha començat.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_grupos")
        .delete()
        .eq("id", grupo.id);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    // ==================================================
    // ELIMINAR FASE
    // ==================================================

    if (accion === "eliminar_fase") {
      const faseID = identificador(entrada.faseID, "fase");

      await exigirFase(faseID, edicionID);

      const [grupos, partidos] = await Promise.all([
        contar("competicion_grupos", "fase_id", faseID),

        contar("competicion_partidos", "fase_id", faseID),
      ]);

      const { count: plazas, error: errorPlazas } = await supabaseAdmin
        .from("competicion_plazas")
        .select("id", {
          count: "exact",

          head: true,
        })
        .or(`destino_fase_id.eq.${faseID},origen_fase_id.eq.${faseID}`);

      if (errorPlazas) {
        throw errorPlazas;
      }

      if (grupos > 0 || partidos > 0 || (plazas ?? 0) > 0) {
        throw new ErrorAPI(
          409,
          "No es pot eliminar la fase perquè encara conté dades.",
        );
      }

      const { error } = await supabaseAdmin
        .from("competicion_fases")
        .delete()
        .eq("id", faseID)
        .eq("edicion_id", edicionID);

      if (error) {
        throw error;
      }

      return responder({
        success: true,
      });
    }

    throw new ErrorAPI(400, "L'acció indicada no existeix.");
  } catch (error) {
    return errorRespuesta(error);
  }
};
