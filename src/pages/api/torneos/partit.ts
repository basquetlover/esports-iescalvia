import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type PartidoDB = {
  id: string;
  edicion_id: string;

  fase_id: string;
  fase_tipo: string;

  tipo: string;

  grupo_id: string | null;
  ronda_id: string | null;

  codigo: string;
  nombre: string | null;

  jornada: number | null;

  estado: string;

  fecha_hora: string | null;
  pista: string | null;

  publicado: boolean;
  finalizado_at: string | null;
};

type PlazaDB = {
  partido_id: string | null;

  lado: "LOCAL" | "VISITANTE" | null;

  equipo_origen_id: string | null;
  equipo_resuelto_id: string | null;
};

type EquipoDB = {
  id: string;
  nombre: string | null;
  escudo: string | null;
};

type ResultadoDB = {
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

type ActaDB = {
  id: string;

  partido_id: string;

  estado: string;

  deporte: string;

  iniciada_at: string | null;
  finalizada_at: string | null;

  version: number;
};

type EventoDB = {
  id: string;

  orden: number;

  tipo_evento: string;

  equipo_id: string | null;
  equipo_nombre: string | null;

  jugador_id: string | null;
  jugador_nombre: string | null;

  periodo: number | null;

  tiempo_juego_segundos: number | null;

  datos: Registro | null;

  estado: string;

  created_at: string;

  anulado_at: string | null;
};

type EquipoPublico = {
  id: string;
  nombre: string;
  escudo: string | null;
};

// ============================================================
// UUID
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
// MINUTO
// ============================================================

function obtenerMinuto(datos: Registro | null) {
  if (!datos) {
    return null;
  }

  const valor = datos.minuto;

  if (typeof valor === "number" && Number.isSafeInteger(valor) && valor >= 0) {
    return valor;
  }

  if (typeof valor === "string" && valor.trim()) {
    const numero = Number(valor);

    if (Number.isSafeInteger(numero) && numero >= 0) {
      return numero;
    }
  }

  return null;
}

// ============================================================
// RESULTADO PREFERIDO
// ============================================================
//
// Igual que en el panel:
//
// 1. confirmado;
// 2. si hay varios confirmados, el más reciente;
// 3. si no hay confirmado, provisional más reciente.
//
// ============================================================

function seleccionarResultado(resultados: ResultadoDB[]) {
  const ordenados = [...resultados].sort((a, b) => {
    if (a.confirmado !== b.confirmado) {
      return a.confirmado ? -1 : 1;
    }

    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  return ordenados[0] ?? null;
}

// ============================================================
// CONTAR GOLES DEL ACTA
// ============================================================

function calcularMarcadorActa(eventos: EventoDB[], equipoID: string | null) {
  if (!equipoID) {
    return 0;
  }

  return eventos.reduce((total, evento) => {
    if (evento.estado !== "ACTIVO" || evento.equipo_id !== equipoID) {
      return total;
    }

    if (
      evento.tipo_evento === "GOL" ||
      evento.tipo_evento === "PENALTI_MARCADO"
    ) {
      return total + 1;
    }

    return total;
  }, 0);
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ url }) => {
  try {
    // ====================================================
    // PARÁMETROS
    // ====================================================

    const torneoID = url.searchParams.get("torneoID");

    const edicionID = url.searchParams.get("edicionID");

    const partidoID = url.searchParams.get("partidoID");

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

    if (!partidoID || !UUID.test(partidoID)) {
      return Response.json(
        {
          mensaje: "L'identificador del partit no és vàlid.",
        },
        {
          status: 400,
        },
      );
    }

    // ====================================================
    // TORNEO / EDICIÓN
    // ====================================================

    const [torneoRespuesta, edicionRespuesta] = await Promise.all([
      supabaseAdmin
        .from("torneos")
        .select("id,nombre,deporte,activo")
        .eq("id", torneoID)
        .eq("activo", true)
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

    // ====================================================
    // PARTIDO
    // ====================================================

    const {
      data: partidoData,

      error: partidoError,
    } = await supabaseAdmin
      .from("competicion_partidos")
      .select(
        `
                            id,
                            edicion_id,
                            fase_id,
                            fase_tipo,
                            tipo,
                            grupo_id,
                            ronda_id,
                            codigo,
                            nombre,
                            jornada,
                            estado,
                            fecha_hora,
                            pista,
                            publicado,
                            finalizado_at
                        `,
      )
      .eq("id", partidoID)
      .eq("edicion_id", edicionID)
      .maybeSingle();

    if (partidoError) {
      throw partidoError;
    }

    if (!partidoData) {
      return Response.json(
        {
          mensaje: "No s'ha trobat el partit.",
        },
        {
          status: 404,
        },
      );
    }

    const partido = partidoData as PartidoDB;

    // ====================================================
    // DATOS PRINCIPALES
    // ====================================================

    const [plazasRespuesta, resultadosRespuesta, actaRespuesta, faseRespuesta] =
      await Promise.all([
        supabaseAdmin
          .from("competicion_plazas")
          .select(
            `
                                partido_id,
                                lado,
                                equipo_origen_id,
                                equipo_resuelto_id
                            `,
          )
          .eq("edicion_id", edicionID)
          .eq("destino_tipo", "PARTIDO")
          .eq("partido_id", partidoID),

        supabaseAdmin
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
          .eq("partido_id", partidoID)
          .eq("edicion_id", edicionID),

        supabaseAdmin
          .from("acta_partidos")
          .select(
            `
                                id,
                                partido_id,
                                estado,
                                deporte,
                                iniciada_at,
                                finalizada_at,
                                version
                            `,
          )
          .eq("partido_id", partidoID)
          .maybeSingle(),

        supabaseAdmin
          .from("competicion_fases")
          .select("id,nombre,tipo")
          .eq("id", partido.fase_id)
          .maybeSingle(),
      ]);

    if (plazasRespuesta.error) {
      throw plazasRespuesta.error;
    }

    if (resultadosRespuesta.error) {
      throw resultadosRespuesta.error;
    }

    if (actaRespuesta.error) {
      throw actaRespuesta.error;
    }

    if (faseRespuesta.error) {
      throw faseRespuesta.error;
    }

    const plazas = (plazasRespuesta.data ?? []) as PlazaDB[];

    const resultados = (resultadosRespuesta.data ?? []) as ResultadoDB[];

    const acta = (actaRespuesta.data ?? null) as ActaDB | null;

    // ====================================================
    // GRUPO / RONDA
    // ====================================================

    const [grupoRespuesta, rondaRespuesta] = await Promise.all([
      partido.grupo_id
        ? supabaseAdmin
            .from("competicion_grupos")
            .select("id,nombre,estado")
            .eq("id", partido.grupo_id)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),

      partido.ronda_id
        ? supabaseAdmin
            .from("competicion_rondas")
            .select("id,nombre,tipo")
            .eq("id", partido.ronda_id)
            .maybeSingle()
        : Promise.resolve({
            data: null,
            error: null,
          }),
    ]);

    if (grupoRespuesta.error) {
      throw grupoRespuesta.error;
    }

    if (rondaRespuesta.error) {
      throw rondaRespuesta.error;
    }

    // ====================================================
    // EQUIPOS
    // ====================================================

    const plazaLocal = plazas.find((plaza) => plaza.lado === "LOCAL") ?? null;

    const plazaVisitante =
      plazas.find((plaza) => plaza.lado === "VISITANTE") ?? null;

    const localID =
      plazaLocal?.equipo_resuelto_id ?? plazaLocal?.equipo_origen_id ?? null;

    const visitanteID =
      plazaVisitante?.equipo_resuelto_id ??
      plazaVisitante?.equipo_origen_id ??
      null;

    const idsEquipos = [localID, visitanteID].filter((id): id is string =>
      Boolean(id),
    );

    let equipos: EquipoDB[] = [];

    if (idsEquipos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("equipos")
        .select("id,nombre,escudo")
        .in("id", idsEquipos);

      if (error) {
        throw error;
      }

      equipos = (data ?? []) as EquipoDB[];
    }

    const equiposPorID = new Map(equipos.map((equipo) => [equipo.id, equipo]));

    function equipoPublico(equipoID: string | null): EquipoPublico | null {
      if (!equipoID) {
        return null;
      }

      const equipo = equiposPorID.get(equipoID);

      if (!equipo) {
        return null;
      }

      return {
        id: equipo.id,

        nombre: equipo.nombre ?? "Equip",

        escudo: equipo.escudo ?? null,
      };
    }

    const local = equipoPublico(localID);

    const visitante = equipoPublico(visitanteID);

    // ====================================================
    // EVENTOS
    // ====================================================

    let eventos: EventoDB[] = [];

    if (acta) {
      const { data, error } = await supabaseAdmin
        .from("acta_eventos")
        .select(
          `
                                id,
                                orden,
                                tipo_evento,
                                equipo_id,
                                equipo_nombre,
                                jugador_id,
                                jugador_nombre,
                                periodo,
                                tiempo_juego_segundos,
                                datos,
                                estado,
                                created_at,
                                anulado_at
                            `,
        )
        .eq("acta_id", acta.id)
        .order("orden", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      eventos = (data ?? []) as EventoDB[];
    }

    // ====================================================
    // SOLO EVENTOS ACTIVOS EN LA PARTE PÚBLICA
    // ====================================================

    const eventosActivos = eventos.filter(
      (evento) => evento.estado === "ACTIVO",
    );

    // ====================================================
    // RESULTADO
    // ====================================================

    const resultado = seleccionarResultado(resultados);

    const marcadorActaLocal = calcularMarcadorActa(eventosActivos, localID);

    const marcadorActaVisitante = calcularMarcadorActa(
      eventosActivos,
      visitanteID,
    );

    const marcadorLocal =
      resultado?.marcador_local ?? (acta ? marcadorActaLocal : null);

    const marcadorVisitante =
      resultado?.marcador_visitante ?? (acta ? marcadorActaVisitante : null);

    const finalizado =
      partido.estado.trim().toUpperCase() === "FINALIZADO" ||
      Boolean(partido.finalizado_at) ||
      Boolean(resultado?.confirmado);

    const enCurso = !finalizado && acta?.estado === "EN_CURSO";

    // ====================================================
    // RESPUESTA
    // ====================================================

    return Response.json(
      {
        data: {
          torneo: {
            id: torneoRespuesta.data.id,

            nombre: torneoRespuesta.data.nombre ?? "Torneig",

            deporte: torneoRespuesta.data.deporte ?? "",
          },

          edicion: {
            id: edicionRespuesta.data.id,

            nombre: edicionRespuesta.data.nombre ?? "",
          },

          estructura: {
            fase: faseRespuesta.data
              ? {
                  id: faseRespuesta.data.id,

                  nombre: faseRespuesta.data.nombre,

                  tipo: faseRespuesta.data.tipo,
                }
              : null,

            grupo: grupoRespuesta.data
              ? {
                  id: grupoRespuesta.data.id,

                  nombre: grupoRespuesta.data.nombre,

                  estado: grupoRespuesta.data.estado,
                }
              : null,

            ronda: rondaRespuesta.data
              ? {
                  id: rondaRespuesta.data.id,

                  nombre: rondaRespuesta.data.nombre,

                  tipo: rondaRespuesta.data.tipo,
                }
              : null,
          },

          partido: {
            id: partido.id,

            codigo: partido.codigo,

            nombre: partido.nombre,

            jornada: partido.jornada,

            estado: partido.estado,

            fechaHora: partido.fecha_hora,

            pista: partido.pista,

            finalizado,

            enCurso,
          },

          local,

          visitante,

          resultado: {
            local: marcadorLocal,

            visitante: marcadorVisitante,

            confirmado: resultado?.confirmado ?? false,

            tipo: resultado?.resultado_tipo ?? null,
          },

          acta: acta
            ? {
                id: acta.id,

                estado: acta.estado,

                iniciadaAt: acta.iniciada_at,

                finalizadaAt: acta.finalizada_at,

                version: acta.version,
              }
            : null,

          historial: eventosActivos.map((evento) => ({
            id: evento.id,

            orden: evento.orden,

            tipo: evento.tipo_evento,

            equipoID: evento.equipo_id,

            equipoNombre: evento.equipo_nombre,

            jugadorID: evento.jugador_id,

            jugadorNombre: evento.jugador_nombre,

            minuto: obtenerMinuto(
              esRegistro(evento.datos) ? evento.datos : null,
            ),

            periodo: evento.periodo,

            createdAt: evento.created_at,
          })),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error carregant el detall públic del partit:", error);

    return Response.json(
      {
        mensaje: "No s'ha pogut carregar el partit.",
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
