import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type FormularioDB = {
  id: string;

  edicion_id: string;

  estado: string | null;
};

type EquipoDB = {
  id: string;

  formulario_id: string;

  nombre: string | null;

  escudo: string | null;

  capitan_id: string | null;

  validacion_estado: string | null;

  plaza_estado: string | null;
};

type ParticipanteDB = {
  id: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  activo: boolean | null;
};

type PartidoDB = {
  id: string;

  tipo: string;

  grupo_id: string | null;

  estado: string;

  finalizado_at: string | null;
};

type PlazaDB = {
  destino_tipo: string;

  grupo_id: string | null;

  partido_id: string | null;

  lado: string | null;

  orden: number;

  equipo_origen_id: string | null;

  equipo_resuelto_id: string | null;
};

type ResultadoDB = {
  id: string;

  partido_id: string;

  marcador_local: number | null;

  marcador_visitante: number | null;

  confirmado: boolean;

  confirmado_at: string | null;

  created_at: string;

  updated_at: string;
};

type EventoDB = {
  partido_id: string;

  equipo_id: string | null;

  tipo_evento: string;

  estado: string;
};

type EstadisticasEquipo = {
  pj: number;

  marcados: number;

  recibidos: number;
};

type FilaGrupo = {
  equipoID: string;

  puntos: number;

  pj: number;

  favor: number;

  contra: number;

  diferencia: number;

  amarillas: number;

  rojas: number;

  orden: number;

  posicion: number;
};

type PartidoGrupo = {
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
// HELPERS
// ============================================================

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function normalizarEstado(valor: string | null | undefined) {
  return valor?.trim().toUpperCase() ?? "";
}

function nombreCompleto(participante: ParticipanteDB | undefined) {
  if (!participante) {
    return null;
  }

  const partes = [
    participante.nombre,
    participante.apellido1,
    participante.apellido2,
  ]
    .filter(
      (parte): parte is string =>
        typeof parte === "string" && Boolean(parte.trim()),
    )
    .map((parte) => parte.trim());

  return partes.length > 0 ? partes.join(" ") : null;
}

// ============================================================
// INSCRIPCIÓN FINALIZADA
// ============================================================

function obtenerCierreInscripcion(configuracion: unknown) {
  if (!esRegistro(configuracion)) {
    return null;
  }

  const inscripcion = esRegistro(configuracion.inscripcion)
    ? configuracion.inscripcion
    : null;

  if (
    !inscripcion ||
    typeof inscripcion.cierre !== "string" ||
    !inscripcion.cierre.trim()
  ) {
    return null;
  }

  const fecha = new Date(inscripcion.cierre);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha;
}

function estadoEdicionFinalizado(estado: string | null | undefined) {
  const valor = normalizarEstado(estado);

  return (
    valor === "FINALIZADA" ||
    valor === "FINALITZADA" ||
    valor === "FINALIZADO" ||
    valor === "FINALITZAT"
  );
}

// ============================================================
// RESULTADO OFICIAL
// ============================================================

function tiempoResultado(resultado: ResultadoDB) {
  const fecha =
    resultado.updated_at || resultado.confirmado_at || resultado.created_at;

  const tiempo = new Date(fecha).getTime();

  return Number.isFinite(tiempo) ? tiempo : 0;
}

function crearMapaResultados(resultados: ResultadoDB[]) {
  const mapa = new Map<string, ResultadoDB>();

  for (const resultado of resultados) {
    if (!resultado.confirmado) {
      continue;
    }

    const anterior = mapa.get(resultado.partido_id);

    if (!anterior || tiempoResultado(resultado) > tiempoResultado(anterior)) {
      mapa.set(resultado.partido_id, resultado);
    }
  }

  return mapa;
}

// ============================================================
// EQUIPO DE PLAZA
// ============================================================

function equipoPlaza(
  plazas: PlazaDB[],

  partidoID: string,

  lado: "LOCAL" | "VISITANTE",
) {
  const plaza = plazas.find(
    (entrada) =>
      entrada.destino_tipo === "PARTIDO" &&
      entrada.partido_id === partidoID &&
      entrada.lado === lado,
  );

  return plaza?.equipo_resuelto_id ?? plaza?.equipo_origen_id ?? null;
}

// ============================================================
// PUNTOS FÚTBOL
// ============================================================

function puntosFutbol(
  favor: number,

  contra: number,
) {
  if (favor > contra) {
    return 3;
  }

  if (favor === contra) {
    return 1;
  }

  return 0;
}

// ============================================================
// CLASIFICACIÓN DE GRUPO
// ============================================================

function ordenarGrupo(
  filas: FilaGrupo[],

  partidos: PartidoGrupo[],
) {
  const porPuntos = new Map<number, FilaGrupo[]>();

  for (const fila of filas) {
    const lista = porPuntos.get(fila.puntos) ?? [];

    lista.push(fila);

    porPuntos.set(fila.puntos, lista);
  }

  const puntos = Array.from(porPuntos.keys()).sort((a, b) => b - a);

  const ordenadas: FilaGrupo[] = [];

  for (const puntuacion of puntos) {
    const empatadas = porPuntos.get(puntuacion) ?? [];

    if (empatadas.length === 1) {
      ordenadas.push(empatadas[0]);

      continue;
    }

    const ids = new Set(empatadas.map((fila) => fila.equipoID));

    const directo = new Map<
      string,
      {
        puntos: number;

        favor: number;

        contra: number;

        diferencia: number;
      }
    >();

    for (const fila of empatadas) {
      directo.set(fila.equipoID, {
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

      const local = directo.get(partido.localID);

      const visitante = directo.get(partido.visitanteID);

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

    empatadas.sort((a, b) => {
      const directoA = directo.get(a.equipoID);

      const directoB = directo.get(b.equipoID);

      const puntosDirectos = (directoB?.puntos ?? 0) - (directoA?.puntos ?? 0);

      if (puntosDirectos !== 0) {
        return puntosDirectos;
      }

      const diferenciaDirecta =
        (directoB?.diferencia ?? 0) - (directoA?.diferencia ?? 0);

      if (diferenciaDirecta !== 0) {
        return diferenciaDirecta;
      }

      const diferenciaGeneral = b.diferencia - a.diferencia;

      if (diferenciaGeneral !== 0) {
        return diferenciaGeneral;
      }

      const goles = b.favor - a.favor;

      if (goles !== 0) {
        return goles;
      }

      const rojas = a.rojas - b.rojas;

      if (rojas !== 0) {
        return rojas;
      }

      const amarillas = a.amarillas - b.amarillas;

      if (amarillas !== 0) {
        return amarillas;
      }

      return a.orden - b.orden;
    });

    ordenadas.push(...empatadas);
  }

  ordenadas.forEach((fila, index) => {
    fila.posicion = index + 1;
  });

  return ordenadas;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ url }) => {
  try {
    const torneoID = url.searchParams.get("torneoID");

    const edicionID = url.searchParams.get("edicionID");

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

    // ====================================================
    // TORNEO / EDICIÓN / CONFIGURACIÓN
    // ====================================================

    const [torneoRespuesta, edicionRespuesta, configuracionRespuesta] =
      await Promise.all([
        supabaseAdmin
          .from("torneos")
          .select("id,deporte,activo")
          .eq("id", torneoID)
          .eq("activo", true)
          .maybeSingle(),

        supabaseAdmin
          .from("ediciones")
          .select("id,torneo_id,estado")
          .eq("id", edicionID)
          .eq("torneo_id", torneoID)
          .maybeSingle(),

        supabaseAdmin
          .from("configuracion_ediciones")
          .select("edicion_id,equipos")
          .eq("edicion_id", edicionID)
          .maybeSingle(),
      ]);

    if (torneoRespuesta.error) {
      throw torneoRespuesta.error;
    }

    if (edicionRespuesta.error) {
      throw edicionRespuesta.error;
    }

    if (configuracionRespuesta.error) {
      throw configuracionRespuesta.error;
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

    const cierre = obtenerCierreInscripcion(
      configuracionRespuesta.data?.equipos,
    );

    const inscripcionFinalizada =
      estadoEdicionFinalizado(edicionRespuesta.data.estado) ||
      Boolean(cierre && cierre.getTime() <= Date.now());

    // ====================================================
    // FORMULARIOS APROBADOS
    // ====================================================

    const {
      data: formulariosData,

      error: formulariosError,
    } = await supabaseAdmin
      .from("formularios")
      .select("id,edicion_id,estado")
      .eq("edicion_id", edicionID)
      .eq("tipo", "EQUIPO")
      .eq("estado", "APROBADO");

    if (formulariosError) {
      throw formulariosError;
    }

    const formularios = (formulariosData ?? []) as FormularioDB[];

    if (formularios.length === 0) {
      return Response.json(
        {
          data: {
            inscripcionFinalizada,

            cierreInscripcion: cierre?.toISOString() ?? null,

            deporte,

            esFutbol,

            equipos: [],
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // ====================================================
    // EQUIPOS ACEPTADOS
    // ====================================================

    const {
      data: equiposData,

      error: equiposError,
    } = await supabaseAdmin
      .from("equipos")
      .select(
        `
                            id,
                            formulario_id,
                            nombre,
                            escudo,
                            capitan_id,
                            validacion_estado,
                            plaza_estado
                        `,
      )
      .in(
        "formulario_id",
        formularios.map((formulario) => formulario.id),
      )
      .eq("validacion_estado", "APROBADO")
      .eq("plaza_estado", "CONFIRMADA");

    if (equiposError) {
      throw equiposError;
    }

    const equipos = (equiposData ?? []) as EquipoDB[];

    // ====================================================
    // CAPITANES
    // ====================================================

    const capitanesIDs = [
      ...new Set(
        equipos
          .map((equipo) => equipo.capitan_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const capitanes = new Map<string, ParticipanteDB>();

    if (capitanesIDs.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("participantes_equipo")
        .select("id,nombre,apellido1,apellido2,activo")
        .in("id", capitanesIDs)
        .eq("activo", true);

      if (error) {
        throw error;
      }

      for (const participante of (data ?? []) as ParticipanteDB[]) {
        capitanes.set(participante.id, participante);
      }
    }

    // ====================================================
    // ANTES DEL CIERRE:
    //
    // únicamente necesitamos equipo + capitán.
    // ====================================================

    if (!inscripcionFinalizada) {
      const respuesta = equipos
        .map((equipo) => ({
          id: equipo.id,

          nombre: equipo.nombre ?? "Equip",

          escudo: equipo.escudo,

          capitan: equipo.capitan_id
            ? nombreCompleto(capitanes.get(equipo.capitan_id))
            : null,

          posicion: null,

          pj: null,

          marcados: null,

          recibidos: null,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "ca"));

      return Response.json(
        {
          data: {
            inscripcionFinalizada: false,

            cierreInscripcion: cierre?.toISOString() ?? null,

            deporte,

            esFutbol,

            equipos: respuesta,
          },
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    // ====================================================
    // COMPETICIÓN
    // ====================================================

    const [partidosRespuesta, plazasRespuesta] = await Promise.all([
      supabaseAdmin
        .from("competicion_partidos")
        .select(
          `
                                id,
                                tipo,
                                grupo_id,
                                estado,
                                finalizado_at
                            `,
        )
        .eq("edicion_id", edicionID),

      supabaseAdmin
        .from("competicion_plazas")
        .select(
          `
                                destino_tipo,
                                grupo_id,
                                partido_id,
                                lado,
                                orden,
                                equipo_origen_id,
                                equipo_resuelto_id
                            `,
        )
        .eq("edicion_id", edicionID),
    ]);

    if (partidosRespuesta.error) {
      throw partidosRespuesta.error;
    }

    if (plazasRespuesta.error) {
      throw plazasRespuesta.error;
    }

    const partidos = (partidosRespuesta.data ?? []) as PartidoDB[];

    const plazas = (plazasRespuesta.data ?? []) as PlazaDB[];

    const idsPartidos = partidos.map((partido) => partido.id);

    // ====================================================
    // RESULTADOS CONFIRMADOS
    // ====================================================

    let resultados: ResultadoDB[] = [];

    if (idsPartidos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("competicion_resultados")
        .select(
          `
                                id,
                                partido_id,
                                marcador_local,
                                marcador_visitante,
                                confirmado,
                                confirmado_at,
                                created_at,
                                updated_at
                            `,
        )
        .eq("edicion_id", edicionID)
        .eq("confirmado", true)
        .in("partido_id", idsPartidos);

      if (error) {
        throw error;
      }

      resultados = (data ?? []) as ResultadoDB[];
    }

    const resultadosPorPartido = crearMapaResultados(resultados);

    // ====================================================
    // ESTADÍSTICAS GENERALES
    // ====================================================

    const estadisticas = new Map<string, EstadisticasEquipo>();

    for (const equipo of equipos) {
      estadisticas.set(equipo.id, {
        pj: 0,

        marcados: 0,

        recibidos: 0,
      });
    }

    for (const partido of partidos) {
      const resultado = resultadosPorPartido.get(partido.id);

      if (
        !resultado ||
        resultado.marcador_local === null ||
        resultado.marcador_visitante === null
      ) {
        continue;
      }

      const localID = equipoPlaza(plazas, partido.id, "LOCAL");

      const visitanteID = equipoPlaza(plazas, partido.id, "VISITANTE");

      if (localID) {
        const local = estadisticas.get(localID);

        if (local) {
          local.pj++;

          local.marcados += resultado.marcador_local;

          local.recibidos += resultado.marcador_visitante;
        }
      }

      if (visitanteID) {
        const visitante = estadisticas.get(visitanteID);

        if (visitante) {
          visitante.pj++;

          visitante.marcados += resultado.marcador_visitante;

          visitante.recibidos += resultado.marcador_local;
        }
      }
    }

    // ====================================================
    // POSICIONES
    // ====================================================

    const posiciones = new Map<string, number>();

    if (esFutbol) {
      const partidosGrupo = partidos.filter(
        (partido) => partido.tipo === "GRUPO" && Boolean(partido.grupo_id),
      );

      const gruposIDs = [
        ...new Set(
          partidosGrupo
            .map((partido) => partido.grupo_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];

      // ================================================
      // TARJETAS
      // ================================================

      const tarjetas = new Map<
        string,
        {
          amarillas: number;

          rojas: number;
        }
      >();

      const partidosGrupoConfirmados = partidosGrupo
        .filter((partido) => resultadosPorPartido.has(partido.id))
        .map((partido) => partido.id);

      if (partidosGrupoConfirmados.length > 0) {
        const { data, error } = await supabaseAdmin
          .from("acta_eventos")
          .select("partido_id,equipo_id,tipo_evento,estado")
          .in("partido_id", partidosGrupoConfirmados)
          .eq("estado", "ACTIVO")
          .in("tipo_evento", ["TARJETA_AMARILLA", "TARJETA_ROJA"]);

        if (error) {
          throw error;
        }

        for (const evento of (data ?? []) as EventoDB[]) {
          if (!evento.equipo_id) {
            continue;
          }

          const actual = tarjetas.get(evento.equipo_id) ?? {
            amarillas: 0,

            rojas: 0,
          };

          if (evento.tipo_evento === "TARJETA_AMARILLA") {
            actual.amarillas++;
          }

          if (evento.tipo_evento === "TARJETA_ROJA") {
            actual.rojas++;
          }

          tarjetas.set(evento.equipo_id, actual);
        }
      }

      // ================================================
      // CADA GRUPO
      // ================================================

      for (const grupoID of gruposIDs) {
        const plazasGrupo = plazas.filter(
          (plaza) =>
            plaza.destino_tipo === "GRUPO" && plaza.grupo_id === grupoID,
        );

        const filas: FilaGrupo[] = [];

        for (const plaza of plazasGrupo) {
          const equipoID = plaza.equipo_resuelto_id ?? plaza.equipo_origen_id;

          if (!equipoID) {
            continue;
          }

          const disciplina = tarjetas.get(equipoID);

          filas.push({
            equipoID,

            puntos: 0,

            pj: 0,

            favor: 0,

            contra: 0,

            diferencia: 0,

            amarillas: disciplina?.amarillas ?? 0,

            rojas: disciplina?.rojas ?? 0,

            orden: plaza.orden,

            posicion: 0,
          });
        }

        const porEquipo = new Map(filas.map((fila) => [fila.equipoID, fila]));

        const enfrentamientos: PartidoGrupo[] = [];

        for (const partido of partidosGrupo) {
          if (partido.grupo_id !== grupoID) {
            continue;
          }

          const resultado = resultadosPorPartido.get(partido.id);

          if (
            !resultado ||
            resultado.marcador_local === null ||
            resultado.marcador_visitante === null
          ) {
            continue;
          }

          const localID = equipoPlaza(plazas, partido.id, "LOCAL");

          const visitanteID = equipoPlaza(plazas, partido.id, "VISITANTE");

          if (!localID || !visitanteID) {
            continue;
          }

          const local = porEquipo.get(localID);

          const visitante = porEquipo.get(visitanteID);

          if (!local || !visitante) {
            continue;
          }

          local.pj++;

          visitante.pj++;

          local.favor += resultado.marcador_local;

          local.contra += resultado.marcador_visitante;

          visitante.favor += resultado.marcador_visitante;

          visitante.contra += resultado.marcador_local;

          local.diferencia = local.favor - local.contra;

          visitante.diferencia = visitante.favor - visitante.contra;

          local.puntos += puntosFutbol(
            resultado.marcador_local,
            resultado.marcador_visitante,
          );

          visitante.puntos += puntosFutbol(
            resultado.marcador_visitante,
            resultado.marcador_local,
          );

          enfrentamientos.push({
            partidoID: partido.id,

            localID,

            visitanteID,

            local: resultado.marcador_local,

            visitante: resultado.marcador_visitante,
          });
        }

        const ordenadas = ordenarGrupo(filas, enfrentamientos);

        for (const fila of ordenadas) {
          posiciones.set(fila.equipoID, fila.posicion);
        }
      }
    }

    // ====================================================
    // RESPUESTA
    // ====================================================

    const respuesta = equipos
      .map((equipo) => {
        const datos = estadisticas.get(equipo.id) ?? {
          pj: 0,

          marcados: 0,

          recibidos: 0,
        };

        return {
          id: equipo.id,

          nombre: equipo.nombre ?? "Equip",

          escudo: equipo.escudo,

          capitan: equipo.capitan_id
            ? nombreCompleto(capitanes.get(equipo.capitan_id))
            : null,

          posicion: posiciones.get(equipo.id) ?? null,

          pj: datos.pj,

          marcados: datos.marcados,

          recibidos: datos.recibidos,
        };
      })
      .sort((a, b) => {
        if (a.posicion !== null && b.posicion !== null) {
          return a.posicion - b.posicion;
        }

        if (a.posicion !== null) {
          return -1;
        }

        if (b.posicion !== null) {
          return 1;
        }

        return a.nombre.localeCompare(b.nombre, "ca");
      });

    return Response.json(
      {
        data: {
          inscripcionFinalizada: true,

          cierreInscripcion: cierre?.toISOString() ?? null,

          deporte,

          esFutbol,

          equipos: respuesta,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Error carregant els equips públics:", error);

    return Response.json(
      {
        mensaje: "No s'han pogut carregar els equips.",
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
