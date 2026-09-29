import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type Fase = {
  id: string;
  nombre: string;
  orden: number;
  estado: string;
};

type Grupo = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
  estado: string;
};

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Plaza = {
  id: string;

  grupo_id: string | null;
  partido_id: string | null;

  lado: string | null;

  orden: number;

  equipo_origen_id: string | null;
  equipo_resuelto_id: string | null;
};

type Partido = {
  id: string;

  fase_id: string;

  grupo_id: string | null;

  codigo: string;

  nombre: string | null;

  orden: number;

  jornada: number | null;

  estado: string;

  fecha_hora: string | null;

  pista: string | null;

  finalizado_at: string | null;
};

type Resultado = {
  id: string;

  partido_id: string;

  edicion_id: string;

  marcador_local: number | null;

  marcador_visitante: number | null;

  ganador_equipo_id: string | null;

  resultado_tipo: string;

  confirmado: boolean;

  confirmado_at: string | null;

  observaciones: string | null;

  created_at: string;

  updated_at: string;
};

type EventoActa = {
  partido_id: string;

  tipo_evento: string;

  equipo_id: string | null;

  estado: string;
};

type EstadoForma = "GANADO" | "EMPATADO" | "PERDIDO" | "PENDIENTE";

type FormaPartido = {
  partidoID: string | null;

  estado: EstadoForma;

  jornada: number | null;

  marcadorFavor: number | null;

  marcadorContra: number | null;
};

type FilaCalculada = {
  equipo: Equipo;

  posicion: number | null;

  pj: number | null;

  pg: number | null;

  pe: number | null;

  pp: number | null;

  favor: number | null;

  contra: number | null;

  diferencia: number | null;

  puntos: number | null;

  amarillas: number | null;

  rojas: number | null;

  forma: FormaPartido[];

  ordenInicial: number;
};

type PartidoClasificacion = {
  partidoID: string;

  localID: string;

  visitanteID: string;

  local: number;

  visitante: number;
};

// ============================================================
// CONSTANTES
// ============================================================

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================================
// REGISTRO
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

// ============================================================
// TEXTO
// ============================================================

function texto(registro: Registro | null | undefined, claves: string[]) {
  if (!registro) {
    return null;
  }

  for (const clave of claves) {
    const valor = registro[clave];

    if (typeof valor === "string" && valor.trim()) {
      return valor.trim();
    }
  }

  return null;
}

// ============================================================
// NÚMERO
// ============================================================

function numero(registro: Registro | null | undefined, claves: string[]) {
  if (!registro) {
    return null;
  }

  for (const clave of claves) {
    const valor = registro[clave];

    if (typeof valor === "number" && Number.isFinite(valor)) {
      return valor;
    }

    if (typeof valor === "string" && valor.trim()) {
      const convertido = Number(valor);

      if (Number.isFinite(convertido)) {
        return convertido;
      }
    }
  }

  return null;
}

// ============================================================
// NÚMERO ANIDADO
// ============================================================

function numeroAnidado(
  registro: Registro | null | undefined,
  claves: string[],
) {
  const directo = numero(registro, claves);

  if (directo !== null) {
    return directo;
  }

  if (!registro) {
    return null;
  }

  for (const contenedor of ["resultado", "marcador", "datos", "valor"]) {
    const valor = registro[contenedor];

    if (!esRegistro(valor)) {
      continue;
    }

    const encontrado = numero(valor, claves);

    if (encontrado !== null) {
      return encontrado;
    }
  }

  return null;
}

// ============================================================
// VERSION CLASIFICACIÓN
// ============================================================

function versionClasificacion(registro: Registro) {
  return (
    numero(registro, ["version", "numero_version", "version_clasificacion"]) ??
    0
  );
}

// ============================================================
// FECHA CLASIFICACIÓN
// ============================================================

function fechaCreacion(registro: Registro) {
  const valor = texto(registro, ["created_at", "fecha_creacion"]);

  if (!valor) {
    return 0;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
}

// ============================================================
// DÍA MADRID
// ============================================================

function claveDiaMadrid(fecha: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",

    month: "2-digit",

    day: "2-digit",

    timeZone: "Europe/Madrid",
  }).format(fecha);
}

// ============================================================
// RESULTADO PREFERIDO
// ============================================================

function prioridadResultado(resultado: Resultado) {
  return resultado.confirmado ? 0 : 1;
}

function tiempoResultado(resultado: Resultado) {
  const valor =
    resultado.updated_at || resultado.confirmado_at || resultado.created_at;

  const tiempo = new Date(valor).getTime();

  return Number.isFinite(tiempo) ? tiempo : 0;
}

function crearMapaResultados(resultados: Resultado[]) {
  const agrupados = new Map<string, Resultado[]>();

  for (const resultado of resultados) {
    const lista = agrupados.get(resultado.partido_id) ?? [];

    lista.push(resultado);

    agrupados.set(resultado.partido_id, lista);
  }

  const mapa = new Map<string, Resultado>();

  for (const [partidoID, lista] of agrupados) {
    lista.sort((a, b) => {
      const prioridad = prioridadResultado(a) - prioridadResultado(b);

      if (prioridad !== 0) {
        return prioridad;
      }

      return tiempoResultado(b) - tiempoResultado(a);
    });

    const seleccionado = lista[0];

    if (seleccionado) {
      mapa.set(partidoID, seleccionado);
    }
  }

  return mapa;
}

// ============================================================
// EQUIPO DE PLAZA
// ============================================================

function obtenerEquipoPlaza(
  plazas: Plaza[],
  partidoID: string,
  lado: "LOCAL" | "VISITANTE",
) {
  const plaza = plazas.find(
    (item) => item.partido_id === partidoID && item.lado === lado,
  );

  return plaza?.equipo_resuelto_id ?? plaza?.equipo_origen_id ?? null;
}

// ============================================================
// PUNTOS FÚTBOL
// ============================================================

function puntosFutbol(favor: number, contra: number) {
  if (favor > contra) {
    return 3;
  }

  if (favor === contra) {
    return 1;
  }

  return 0;
}

// ============================================================
// ORDEN DE PARTIDOS
// ============================================================

function tiempoPartido(partido: Partido) {
  if (!partido.fecha_hora) {
    return Number.MAX_SAFE_INTEGER;
  }

  const tiempo = new Date(partido.fecha_hora).getTime();

  return Number.isFinite(tiempo) ? tiempo : Number.MAX_SAFE_INTEGER;
}

function ordenarPartidos(partidos: Partido[]) {
  return [...partidos].sort((a, b) => {
    const jornadaA = a.jornada ?? Number.MAX_SAFE_INTEGER;

    const jornadaB = b.jornada ?? Number.MAX_SAFE_INTEGER;

    if (jornadaA !== jornadaB) {
      return jornadaA - jornadaB;
    }

    const fechaA = tiempoPartido(a);

    const fechaB = tiempoPartido(b);

    if (fechaA !== fechaB) {
      return fechaA - fechaB;
    }

    return a.orden - b.orden;
  });
}

// ============================================================
// COMPLETAR FORMA HASTA 5
// ============================================================

function completarForma(forma: FormaPartido[]) {
  const resultado = forma.slice(0, 5);

  while (resultado.length < 5) {
    resultado.push({
      partidoID: null,

      estado: "PENDIENTE",

      jornada: null,

      marcadorFavor: null,

      marcadorContra: null,
    });
  }

  return resultado;
}

// ============================================================
// FORMA ÚLTIMOS 5 PARTIDOS
// ============================================================

function calcularFormaEquipos(
  partidos: Partido[],
  plazas: Plaza[],
  resultadosPorPartido: Map<string, Resultado>,
) {
  const formaCompleta = new Map<string, FormaPartido[]>();

  const partidosOrdenados = ordenarPartidos(partidos);

  for (const partido of partidosOrdenados) {
    const localID = obtenerEquipoPlaza(plazas, partido.id, "LOCAL");

    const visitanteID = obtenerEquipoPlaza(plazas, partido.id, "VISITANTE");

    if (!localID || !visitanteID) {
      continue;
    }

    const resultado = resultadosPorPartido.get(partido.id);

    let estadoLocal: EstadoForma = "PENDIENTE";

    let estadoVisitante: EstadoForma = "PENDIENTE";

    let marcadorLocal: number | null = null;

    let marcadorVisitante: number | null = null;

    // ========================================================
    // IMPORTANTE:
    //
    // Comprobación explícita de number para que TypeScript
    // descarte null antes de comparar los marcadores.
    // ========================================================

    if (
      resultado &&
      resultado.confirmado &&
      typeof resultado.marcador_local === "number" &&
      typeof resultado.marcador_visitante === "number"
    ) {
      marcadorLocal = resultado.marcador_local;

      marcadorVisitante = resultado.marcador_visitante;

      if (marcadorLocal > marcadorVisitante) {
        estadoLocal = "GANADO";

        estadoVisitante = "PERDIDO";
      } else if (marcadorLocal < marcadorVisitante) {
        estadoLocal = "PERDIDO";

        estadoVisitante = "GANADO";
      } else {
        estadoLocal = "EMPATADO";

        estadoVisitante = "EMPATADO";
      }
    }

    // ========================================================
    // LOCAL
    // ========================================================

    const formaLocal = formaCompleta.get(localID) ?? [];

    formaLocal.push({
      partidoID: partido.id,

      estado: estadoLocal,

      jornada: partido.jornada,

      marcadorFavor: marcadorLocal,

      marcadorContra: marcadorVisitante,
    });

    formaCompleta.set(localID, formaLocal);

    // ========================================================
    // VISITANTE
    // ========================================================

    const formaVisitante = formaCompleta.get(visitanteID) ?? [];

    formaVisitante.push({
      partidoID: partido.id,

      estado: estadoVisitante,

      jornada: partido.jornada,

      marcadorFavor: marcadorVisitante,

      marcadorContra: marcadorLocal,
    });

    formaCompleta.set(visitanteID, formaVisitante);
  }

  const resultado = new Map<string, FormaPartido[]>();

  for (const [equipoID, partidosEquipo] of formaCompleta) {
    const jugados = partidosEquipo.filter(
      (partido) => partido.estado !== "PENDIENTE",
    );

    const pendientes = partidosEquipo.filter(
      (partido) => partido.estado === "PENDIENTE",
    );

    const ultimosJugados = jugados.slice(-5);

    const faltan = Math.max(0, 5 - ultimosJugados.length);

    const proximosPendientes = pendientes.slice(0, faltan);

    resultado.set(
      equipoID,
      completarForma([...ultimosJugados, ...proximosPendientes]),
    );
  }

  return resultado;
}

// ============================================================
// ORDENAR CLASIFICACIÓN FÚTBOL
// ============================================================

function ordenarClasificacionFutbol(
  filas: FilaCalculada[],
  partidos: PartidoClasificacion[],
) {
  const porPuntos = new Map<number, FilaCalculada[]>();

  for (const fila of filas) {
    const puntos = fila.puntos ?? 0;

    const lista = porPuntos.get(puntos) ?? [];

    lista.push(fila);

    porPuntos.set(puntos, lista);
  }

  const puntosOrdenados = Array.from(porPuntos.keys()).sort((a, b) => b - a);

  const resultado: FilaCalculada[] = [];

  for (const puntos of puntosOrdenados) {
    const empatados = porPuntos.get(puntos) ?? [];

    if (empatados.length <= 1) {
      resultado.push(...empatados);

      continue;
    }

    const ids = new Set(empatados.map((fila) => fila.equipo.id));

    const mini = new Map<
      string,
      {
        puntos: number;
        favor: number;
        contra: number;
        diferencia: number;
      }
    >();

    for (const fila of empatados) {
      mini.set(fila.equipo.id, {
        puntos: 0,

        favor: 0,

        contra: 0,

        diferencia: 0,
      });
    }

    for (const partido of partidos) {
      if (!ids.has(partido.localID) || !ids.has(partido.visitanteID)) {
        continue;
      }

      const local = mini.get(partido.localID);

      const visitante = mini.get(partido.visitanteID);

      if (!local || !visitante) {
        continue;
      }

      local.favor += partido.local;

      local.contra += partido.visitante;

      visitante.favor += partido.visitante;

      visitante.contra += partido.local;

      local.diferencia = local.favor - local.contra;

      visitante.diferencia = visitante.favor - visitante.contra;

      local.puntos += puntosFutbol(partido.local, partido.visitante);

      visitante.puntos += puntosFutbol(partido.visitante, partido.local);
    }

    empatados.sort((a, b) => {
      const miniA = mini.get(a.equipo.id);

      const miniB = mini.get(b.equipo.id);

      const puntosDirectos = (miniB?.puntos ?? 0) - (miniA?.puntos ?? 0);

      if (puntosDirectos !== 0) {
        return puntosDirectos;
      }

      const diferenciaDirecta =
        (miniB?.diferencia ?? 0) - (miniA?.diferencia ?? 0);

      if (diferenciaDirecta !== 0) {
        return diferenciaDirecta;
      }

      const diferenciaGeneral = (b.diferencia ?? 0) - (a.diferencia ?? 0);

      if (diferenciaGeneral !== 0) {
        return diferenciaGeneral;
      }

      const golesFavor = (b.favor ?? 0) - (a.favor ?? 0);

      if (golesFavor !== 0) {
        return golesFavor;
      }

      const rojas = (a.rojas ?? 0) - (b.rojas ?? 0);

      if (rojas !== 0) {
        return rojas;
      }

      const amarillas = (a.amarillas ?? 0) - (b.amarillas ?? 0);

      if (amarillas !== 0) {
        return amarillas;
      }

      return a.ordenInicial - b.ordenInicial;
    });

    resultado.push(...empatados);
  }

  resultado.forEach((fila, index) => {
    fila.posicion = index + 1;
  });

  return resultado;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ url }) => {
  try {
    // ======================================================
    // PARÁMETROS
    // ======================================================

    const torneoID = url.searchParams.get("torneoID");

    const edicionID = url.searchParams.get("edicionID");

    const grupoSolicitadoID = url.searchParams.get("grupoID");

    const jornadaTexto = url.searchParams.get("jornada");

    let jornadaSolicitada: number | null = null;

    if (jornadaTexto !== null && jornadaTexto !== "") {
      const valor = Number(jornadaTexto);

      if (!Number.isSafeInteger(valor) || valor < 1) {
        return Response.json(
          {
            mensaje: "La jornada seleccionada no és vàlida.",
          },
          {
            status: 400,
          },
        );
      }

      jornadaSolicitada = valor;
    }

    if (!torneoID || !UUID.test(torneoID)) {
      return Response.json(
        {
          mensaje: "L'identificador del torneig no és vàlid.",
        },
        {
          status: 400,
        },
      );
    }

    if (!edicionID || !UUID.test(edicionID)) {
      return Response.json(
        {
          mensaje: "L'identificador de l'edició no és vàlid.",
        },
        {
          status: 400,
        },
      );
    }

    if (grupoSolicitadoID && !UUID.test(grupoSolicitadoID)) {
      return Response.json(
        {
          mensaje: "L'identificador del grup no és vàlid.",
        },
        {
          status: 400,
        },
      );
    }

    // ======================================================
    // TORNEO / EDICIÓN
    // ======================================================

    const [torneoRespuesta, edicionRespuesta] = await Promise.all([
      supabaseAdmin
        .from("torneos")
        .select("id,deporte,activo")
        .eq("id", torneoID)
        .maybeSingle(),

      supabaseAdmin
        .from("ediciones")
        .select("id,torneo_id,nombre,estado")
        .eq("id", edicionID)
        .eq("torneo_id", torneoID)
        .maybeSingle(),
    ]);

    if (torneoRespuesta.error) {
      throw torneoRespuesta.error;
    }

    if (edicionRespuesta.error) {
      throw edicionRespuesta.error;
    }

    if (!torneoRespuesta.data || !edicionRespuesta.data) {
      return Response.json(
        {
          mensaje: "No s'ha trobat el torneig o l'edició.",
        },
        {
          status: 404,
        },
      );
    }

    const deporte = torneoRespuesta.data.deporte?.trim().toLowerCase() ?? "";

    const esFutbol = deporte.includes("fut");

    // ======================================================
    // RESPUESTA VACÍA
    // ======================================================

    function respuestaVacia() {
      return Response.json(
        {
          data: {
            deporte,

            esFutbol,

            etiquetas: {
              favor: esFutbol ? "GF" : "PF",

              contra: esFutbol ? "GC" : "PC",
            },

            grupos: [],

            grupo: null,

            tieneClasificacion: false,

            clasificacion: [],

            jornadasDisponibles: [],

            jornadaSeleccionada: null,

            jornadaReferencia: null,

            proximaJornada: null,
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // ======================================================
    // FASES
    // ======================================================

    const {
      data: fasesData,

      error: errorFases,
    } = await supabaseAdmin
      .from("competicion_fases")
      .select("id,nombre,orden,estado")
      .eq("edicion_id", edicionID)
      .eq("tipo", "GRUPOS")
      .order("orden", {
        ascending: true,
      });

    if (errorFases) {
      throw errorFases;
    }

    const fases = (fasesData ?? []) as Fase[];

    if (fases.length === 0) {
      return respuestaVacia();
    }

    const idsFases = fases.map((fase) => fase.id);

    // ======================================================
    // GRUPOS
    // ======================================================

    const {
      data: gruposData,

      error: errorGrupos,
    } = await supabaseAdmin
      .from("competicion_grupos")
      .select("id,fase_id,nombre,orden,estado")
      .in("fase_id", idsFases)
      .order("orden", {
        ascending: true,
      });

    if (errorGrupos) {
      throw errorGrupos;
    }

    const grupos = (gruposData ?? []) as Grupo[];

    const fasesPorID = new Map(fases.map((fase) => [fase.id, fase]));

    const opcionesGrupos = grupos
      .map((grupo) => {
        const fase = fasesPorID.get(grupo.fase_id);

        return {
          id: grupo.id,

          nombre: grupo.nombre,

          estado: grupo.estado,

          faseID: grupo.fase_id,

          faseNombre: fase?.nombre ?? "Fase",

          faseOrden: fase?.orden ?? 0,

          orden: grupo.orden,
        };
      })
      .sort((a, b) => a.faseOrden - b.faseOrden || a.orden - b.orden);

    if (opcionesGrupos.length === 0) {
      return respuestaVacia();
    }

    const grupoSeleccionado =
      grupos.find((grupo) => grupo.id === grupoSolicitadoID) ?? grupos[0];

    const faseSeleccionada = fasesPorID.get(grupoSeleccionado.fase_id) ?? null;

    // ======================================================
    // PLAZAS / PARTIDOS / SNAPSHOT
    // ======================================================

    const [plazasGrupoRespuesta, partidosRespuesta, clasificacionesRespuesta] =
      await Promise.all([
        supabaseAdmin
          .from("competicion_plazas")
          .select(
            "id,grupo_id,partido_id,lado,orden,equipo_origen_id,equipo_resuelto_id",
          )
          .eq("edicion_id", edicionID)
          .eq("destino_tipo", "GRUPO")
          .eq("grupo_id", grupoSeleccionado.id)
          .order("orden", {
            ascending: true,
          }),

        supabaseAdmin
          .from("competicion_partidos")
          .select(
            "id,fase_id,grupo_id,codigo,nombre,orden,jornada,estado,fecha_hora,pista,finalizado_at",
          )
          .eq("edicion_id", edicionID)
          .eq("tipo", "GRUPO")
          .eq("grupo_id", grupoSeleccionado.id)
          .order("jornada", {
            ascending: true,

            nullsFirst: false,
          })
          .order("orden", {
            ascending: true,
          }),

        supabaseAdmin
          .from("competicion_clasificaciones")
          .select("*")
          .eq("grupo_id", grupoSeleccionado.id),
      ]);

    if (plazasGrupoRespuesta.error) {
      throw plazasGrupoRespuesta.error;
    }

    if (partidosRespuesta.error) {
      throw partidosRespuesta.error;
    }

    if (clasificacionesRespuesta.error) {
      throw clasificacionesRespuesta.error;
    }

    const plazasGrupo = (plazasGrupoRespuesta.data ?? []) as Plaza[];

    const partidos = (partidosRespuesta.data ?? []) as Partido[];

    const idsPartidos = partidos.map((partido) => partido.id);

    // ======================================================
    // PLAZAS PARTIDO
    // ======================================================

    let plazasPartido: Plaza[] = [];

    if (idsPartidos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("competicion_plazas")
        .select(
          "id,grupo_id,partido_id,lado,orden,equipo_origen_id,equipo_resuelto_id",
        )
        .eq("edicion_id", edicionID)
        .eq("destino_tipo", "PARTIDO")
        .in("partido_id", idsPartidos);

      if (error) {
        throw error;
      }

      plazasPartido = (data ?? []) as Plaza[];
    }

    // ======================================================
    // RESULTADOS
    // ======================================================

    let resultados: Resultado[] = [];

    if (idsPartidos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("competicion_resultados")
        .select(
          `
              id,
              partido_id,
              edicion_id,
              marcador_local,
              marcador_visitante,
              ganador_equipo_id,
              resultado_tipo,
              confirmado,
              confirmado_at,
              observaciones,
              created_at,
              updated_at
            `,
        )
        .in("partido_id", idsPartidos)
        .eq("edicion_id", edicionID);

      if (error) {
        throw error;
      }

      resultados = (data ?? []) as Resultado[];
    }

    const resultadosPorPartido = crearMapaResultados(resultados);

    const formaPorEquipo = calcularFormaEquipos(
      partidos,
      plazasPartido,
      resultadosPorPartido,
    );

    // ======================================================
    // SNAPSHOT
    // ======================================================

    const clasificaciones = (clasificacionesRespuesta.data ?? []) as Registro[];

    clasificaciones.sort((a, b) => {
      const diferenciaVersion =
        versionClasificacion(b) - versionClasificacion(a);

      if (diferenciaVersion !== 0) {
        return diferenciaVersion;
      }

      return fechaCreacion(b) - fechaCreacion(a);
    });

    const clasificacionActual = clasificaciones[0] ?? null;

    const clasificacionID = texto(clasificacionActual, ["id"]);

    let filasSnapshot: Registro[] = [];

    if (clasificacionID) {
      const { data, error } = await supabaseAdmin
        .from("competicion_clasificacion_filas")
        .select("*")
        .eq("clasificacion_id", clasificacionID);

      if (!error) {
        filasSnapshot = (data ?? []) as Registro[];
      }
    }

    // ======================================================
    // IDS EQUIPOS
    // ======================================================

    const idsEquipos = new Set<string>();

    for (const plaza of plazasGrupo) {
      const id = plaza.equipo_resuelto_id ?? plaza.equipo_origen_id;

      if (id) {
        idsEquipos.add(id);
      }
    }

    for (const plaza of plazasPartido) {
      const id = plaza.equipo_resuelto_id ?? plaza.equipo_origen_id;

      if (id) {
        idsEquipos.add(id);
      }
    }

    for (const fila of filasSnapshot) {
      const id = texto(fila, ["equipo_id", "equip_id"]);

      if (id) {
        idsEquipos.add(id);
      }
    }

    // ======================================================
    // EQUIPOS
    // ======================================================

    let equipos: Equipo[] = [];

    if (idsEquipos.size > 0) {
      const { data, error } = await supabaseAdmin
        .from("equipos")
        .select("id,nombre,escudo")
        .in("id", Array.from(idsEquipos));

      if (error) {
        throw error;
      }

      equipos = (data ?? []).map((equipo) => ({
        id: equipo.id,

        nombre: equipo.nombre ?? "Equip",

        escudo: equipo.escudo ?? null,
      }));
    }

    const equiposPorID = new Map<string, Equipo>(
      equipos.map((equipo) => [equipo.id, equipo]),
    );

    // ======================================================
    // ORDEN GRUPO
    // ======================================================

    const ordenGrupo = new Map<string, number>();

    for (const plaza of plazasGrupo) {
      const equipoID = plaza.equipo_resuelto_id ?? plaza.equipo_origen_id;

      if (equipoID) {
        ordenGrupo.set(equipoID, plaza.orden);
      }
    }

    // ======================================================
    // PARTIDOS CONFIRMADOS
    // ======================================================

    const partidosClasificacion: PartidoClasificacion[] = [];

    const idsPartidosConfirmados = new Set<string>();

    for (const partido of partidos) {
      const resultado = resultadosPorPartido.get(partido.id);

      if (
        !resultado ||
        !resultado.confirmado ||
        typeof resultado.marcador_local !== "number" ||
        typeof resultado.marcador_visitante !== "number"
      ) {
        continue;
      }

      const localID = obtenerEquipoPlaza(plazasPartido, partido.id, "LOCAL");

      const visitanteID = obtenerEquipoPlaza(
        plazasPartido,
        partido.id,
        "VISITANTE",
      );

      if (!localID || !visitanteID) {
        continue;
      }

      idsPartidosConfirmados.add(partido.id);

      partidosClasificacion.push({
        partidoID: partido.id,

        localID,

        visitanteID,

        local: resultado.marcador_local,

        visitante: resultado.marcador_visitante,
      });
    }

    // ======================================================
    // TARJETAS
    // ======================================================

    const tarjetasPorEquipo = new Map<
      string,
      {
        amarillas: number;

        rojas: number;
      }
    >();

    if (esFutbol && idsPartidosConfirmados.size > 0) {
      const { data, error } = await supabaseAdmin
        .from("acta_eventos")
        .select("partido_id,tipo_evento,equipo_id,estado")
        .in("partido_id", Array.from(idsPartidosConfirmados))
        .eq("estado", "ACTIVO")
        .in("tipo_evento", ["TARJETA_AMARILLA", "TARJETA_ROJA"]);

      if (error) {
        throw error;
      }

      for (const evento of (data ?? []) as EventoActa[]) {
        if (!evento.equipo_id) {
          continue;
        }

        const actual = tarjetasPorEquipo.get(evento.equipo_id) ?? {
          amarillas: 0,

          rojas: 0,
        };

        if (evento.tipo_evento === "TARJETA_AMARILLA") {
          actual.amarillas++;
        }

        if (evento.tipo_evento === "TARJETA_ROJA") {
          actual.rojas++;
        }

        tarjetasPorEquipo.set(evento.equipo_id, actual);
      }
    }

    // ======================================================
    // CLASIFICACIÓN
    // ======================================================

    let clasificacion: FilaCalculada[] = [];

    let tieneClasificacion = false;

    if (esFutbol) {
      const mapa = new Map<string, FilaCalculada>();

      for (const plaza of plazasGrupo) {
        const equipoID = plaza.equipo_resuelto_id ?? plaza.equipo_origen_id;

        if (!equipoID) {
          continue;
        }

        const equipo = equiposPorID.get(equipoID);

        if (!equipo) {
          continue;
        }

        const tarjetas = tarjetasPorEquipo.get(equipoID);

        mapa.set(equipoID, {
          equipo,

          posicion: null,

          pj: 0,

          pg: 0,

          pe: 0,

          pp: 0,

          favor: 0,

          contra: 0,

          diferencia: 0,

          puntos: 0,

          amarillas: tarjetas?.amarillas ?? 0,

          rojas: tarjetas?.rojas ?? 0,

          forma: completarForma(formaPorEquipo.get(equipoID) ?? []),

          ordenInicial: plaza.orden,
        });
      }

      for (const partido of partidosClasificacion) {
        const local = mapa.get(partido.localID);

        const visitante = mapa.get(partido.visitanteID);

        if (!local || !visitante) {
          continue;
        }

        local.pj = (local.pj ?? 0) + 1;

        visitante.pj = (visitante.pj ?? 0) + 1;

        local.favor = (local.favor ?? 0) + partido.local;

        local.contra = (local.contra ?? 0) + partido.visitante;

        visitante.favor = (visitante.favor ?? 0) + partido.visitante;

        visitante.contra = (visitante.contra ?? 0) + partido.local;

        if (partido.local > partido.visitante) {
          local.pg = (local.pg ?? 0) + 1;

          visitante.pp = (visitante.pp ?? 0) + 1;
        } else if (partido.local < partido.visitante) {
          visitante.pg = (visitante.pg ?? 0) + 1;

          local.pp = (local.pp ?? 0) + 1;
        } else {
          local.pe = (local.pe ?? 0) + 1;

          visitante.pe = (visitante.pe ?? 0) + 1;
        }

        local.puntos =
          (local.puntos ?? 0) + puntosFutbol(partido.local, partido.visitante);

        visitante.puntos =
          (visitante.puntos ?? 0) +
          puntosFutbol(partido.visitante, partido.local);
      }

      clasificacion = Array.from(mapa.values());

      for (const fila of clasificacion) {
        fila.diferencia = (fila.favor ?? 0) - (fila.contra ?? 0);
      }

      clasificacion = ordenarClasificacionFutbol(
        clasificacion,
        partidosClasificacion,
      );

      tieneClasificacion = partidosClasificacion.length > 0;
    } else {
      // ====================================================
      // OTROS DEPORTES
      // ====================================================

      clasificacion = filasSnapshot
        .map<FilaCalculada | null>((fila) => {
          const equipoID = texto(fila, ["equipo_id", "equip_id"]);

          if (!equipoID) {
            return null;
          }

          const equipo = equiposPorID.get(equipoID);

          if (!equipo) {
            return null;
          }

          const favor = numeroAnidado(fila, [
            "puntos_favor",
            "puntos_a_favor",
            "goles_favor",
            "goles_a_favor",
            "favor",
            "pf",
            "gf",
          ]);

          const contra = numeroAnidado(fila, [
            "puntos_contra",
            "puntos_en_contra",
            "goles_contra",
            "goles_en_contra",
            "contra",
            "pc",
            "gc",
          ]);

          const resultado: FilaCalculada = {
            equipo,

            posicion: numeroAnidado(fila, ["posicion", "posicio", "orden"]),

            pj: numeroAnidado(fila, ["partidos_jugados", "jugados", "pj"]),

            pg: numeroAnidado(fila, [
              "partidos_ganados",
              "ganados",
              "victorias",
              "pg",
            ]),

            pe: numeroAnidado(fila, [
              "partidos_empatados",
              "empatados",
              "empates",
              "pe",
            ]),

            pp: numeroAnidado(fila, [
              "partidos_perdidos",
              "perdidos",
              "derrotas",
              "pp",
            ]),

            favor,

            contra,

            diferencia:
              numeroAnidado(fila, [
                "diferencia",
                "diferencia_puntos",
                "diferencia_goles",
                "dif",
              ]) ?? (favor !== null && contra !== null ? favor - contra : null),

            puntos: numeroAnidado(fila, [
              "puntos",
              "puntos_clasificacion",
              "pts",
            ]),

            amarillas: null,

            rojas: null,

            forma: completarForma(formaPorEquipo.get(equipoID) ?? []),

            ordenInicial: ordenGrupo.get(equipoID) ?? 9999,
          };

          return resultado;
        })
        .filter((fila): fila is FilaCalculada => fila !== null);

      const clasificados = new Set(clasificacion.map((fila) => fila.equipo.id));

      for (const plaza of plazasGrupo) {
        const equipoID = plaza.equipo_resuelto_id ?? plaza.equipo_origen_id;

        if (!equipoID || clasificados.has(equipoID)) {
          continue;
        }

        const equipo = equiposPorID.get(equipoID);

        if (!equipo) {
          continue;
        }

        clasificacion.push({
          equipo,

          posicion: null,

          pj: null,

          pg: null,

          pe: null,

          pp: null,

          favor: null,

          contra: null,

          diferencia: null,

          puntos: null,

          amarillas: null,

          rojas: null,

          forma: completarForma(formaPorEquipo.get(equipoID) ?? []),

          ordenInicial: plaza.orden,
        });
      }

      clasificacion.sort((a, b) => {
        if (a.posicion !== null && b.posicion !== null) {
          return a.posicion - b.posicion;
        }

        if (a.posicion !== null) {
          return -1;
        }

        if (b.posicion !== null) {
          return 1;
        }

        return a.ordenInicial - b.ordenInicial;
      });

      tieneClasificacion = filasSnapshot.length > 0;
    }

    // ======================================================
    // PARTIDOS PÚBLICOS
    // ======================================================

    const partidosPublicos = partidos.map((partido) => {
      const resultado = resultadosPorPartido.get(partido.id);

      const localID = obtenerEquipoPlaza(plazasPartido, partido.id, "LOCAL");

      const visitanteID = obtenerEquipoPlaza(
        plazasPartido,
        partido.id,
        "VISITANTE",
      );

      return {
        id: partido.id,

        codigo: partido.codigo,

        nombre: partido.nombre,

        jornada: partido.jornada,

        estado: partido.estado,

        fechaHora: partido.fecha_hora,

        pista: partido.pista,

        local: localID ? (equiposPorID.get(localID) ?? null) : null,

        visitante: visitanteID ? (equiposPorID.get(visitanteID) ?? null) : null,

        resultadoLocal: resultado?.marcador_local ?? null,

        resultadoVisitante: resultado?.marcador_visitante ?? null,

        finalizado:
          partido.estado.trim().toUpperCase() === "FINALIZADO" ||
          Boolean(partido.finalizado_at) ||
          Boolean(resultado?.confirmado),
      };
    });

    // ======================================================
    // JORNADAS
    // ======================================================

    const mapaJornadas = new Map<number, typeof partidosPublicos>();

    for (const partido of partidosPublicos) {
      if (partido.jornada === null) {
        continue;
      }

      const lista = mapaJornadas.get(partido.jornada) ?? [];

      lista.push(partido);

      mapaJornadas.set(partido.jornada, lista);
    }

    const jornadas = Array.from(mapaJornadas.entries())
      .map(([numeroJornada, partidosJornada]) => ({
        numero: numeroJornada,

        partidos: partidosJornada.sort((a, b) => {
          const fechaA = a.fechaHora
            ? new Date(a.fechaHora).getTime()
            : Number.MAX_SAFE_INTEGER;

          const fechaB = b.fechaHora
            ? new Date(b.fechaHora).getTime()
            : Number.MAX_SAFE_INTEGER;

          if (fechaA !== fechaB) {
            return fechaA - fechaB;
          }

          return a.codigo.localeCompare(b.codigo);
        }),
      }))
      .sort((a, b) => a.numero - b.numero);

    // ======================================================
    // JORNADA SELECCIONADA
    // ======================================================

    const jornadaSeleccionada =
      jornadaSolicitada !== null
        ? (jornadas.find((jornada) => jornada.numero === jornadaSolicitada) ??
          null)
        : null;

    if (jornadaSolicitada !== null && !jornadaSeleccionada) {
      return Response.json(
        {
          mensaje: "La jornada seleccionada no existeix en aquest grup.",
        },
        {
          status: 404,

          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // ======================================================
    // FECHA JORNADA
    // ======================================================

    function fechaJornada(jornada: (typeof jornadas)[number]) {
      const fechas = jornada.partidos
        .map((partido) =>
          partido.fechaHora ? new Date(partido.fechaHora).getTime() : null,
        )
        .filter(
          (valor): valor is number => valor !== null && Number.isFinite(valor),
        );

      if (fechas.length === 0) {
        return null;
      }

      return Math.min(...fechas);
    }

    // ======================================================
    // JORNADA AUTOMÁTICA
    // ======================================================

    const ahora = Date.now();

    const hoy = claveDiaMadrid(new Date());

    const jornadaHoy =
      jornadas.find((jornada) =>
        jornada.partidos.some((partido) =>
          partido.fechaHora
            ? claveDiaMadrid(new Date(partido.fechaHora)) === hoy
            : false,
        ),
      ) ?? null;

    const jornadasAnteriores = jornadas
      .filter((jornada) => {
        const fecha = fechaJornada(jornada);

        return fecha !== null && fecha <= ahora;
      })
      .sort((a, b) => (fechaJornada(a) ?? 0) - (fechaJornada(b) ?? 0));

    const ultimaAnterior =
      jornadasAnteriores[jornadasAnteriores.length - 1] ?? null;

    const ultimaConResultados =
      [...jornadas]
        .reverse()
        .find((jornada) =>
          jornada.partidos.some((partido) => partido.finalizado),
        ) ?? null;

    const primeraFutura =
      jornadas.find((jornada) => {
        const fecha = fechaJornada(jornada);

        return fecha !== null && fecha > ahora;
      }) ?? null;

    const referenciaAutomatica =
      jornadaHoy ??
      ultimaAnterior ??
      ultimaConResultados ??
      primeraFutura ??
      jornadas[0] ??
      null;

    const referencia = jornadaSeleccionada ?? referenciaAutomatica;

    // ======================================================
    // SIGUIENTE
    // ======================================================

    let indiceReferencia = -1;

    if (referencia) {
      indiceReferencia = jornadas.findIndex(
        (jornada) => jornada.numero === referencia.numero,
      );
    }

    const siguiente =
      indiceReferencia >= 0 ? (jornadas[indiceReferencia + 1] ?? null) : null;

    // ======================================================
    // CONVERTIR JORNADA
    // ======================================================

    function convertirJornada(
      jornada: (typeof jornadas)[number] | null,

      tipo: "REFERENCIA" | "PROXIMA",
    ) {
      if (!jornada) {
        return null;
      }

      let contexto: "AVUI" | "DARRERA" | "PER_JUGAR" | "PROXIMA" = "PER_JUGAR";

      if (tipo === "PROXIMA") {
        contexto = "PROXIMA";
      } else if (jornadaHoy?.numero === jornada.numero) {
        contexto = "AVUI";
      } else {
        const fecha = fechaJornada(jornada);

        contexto = fecha !== null && fecha <= ahora ? "DARRERA" : "PER_JUGAR";
      }

      return {
        numero: jornada.numero,

        contexto,

        partidos: jornada.partidos,
      };
    }

    // ======================================================
    // RESPUESTA
    // ======================================================

    return Response.json(
      {
        data: {
          deporte,

          esFutbol,

          etiquetas: {
            favor: esFutbol ? "GF" : "PF",

            contra: esFutbol ? "GC" : "PC",
          },

          grupos: opcionesGrupos,

          grupo: {
            id: grupoSeleccionado.id,

            nombre: grupoSeleccionado.nombre,

            estado: grupoSeleccionado.estado,

            faseID: grupoSeleccionado.fase_id,

            faseNombre: faseSeleccionada?.nombre ?? "Fase",
          },

          tieneClasificacion,

          clasificacion: clasificacion.map(({ ordenInicial, ...fila }) => fila),

          jornadasDisponibles: jornadas.map((jornada) => jornada.numero),

          jornadaSeleccionada: jornadaSeleccionada?.numero ?? null,

          jornadaReferencia: convertirJornada(referencia, "REFERENCIA"),

          proximaJornada: convertirJornada(siguiente, "PROXIMA"),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error carregant la competició pública:", error);

    return Response.json(
      {
        mensaje: "No s'ha pogut carregar la competició.",
      },
      {
        status: 500,

        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
};
