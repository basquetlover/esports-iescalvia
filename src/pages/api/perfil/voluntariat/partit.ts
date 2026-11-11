import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";

import { ErrorAPI, responder } from "@utils/inscripcio/equipBase";

import { exigirPartidoDesignadoVoluntariat } from "@utils/voluntariat/acceso";

import {
  obtenerAccesoActa,
  type ResultadoAccesoActa,
} from "@utils/acta/acceso";

export const prerender = false;

type PartidoDB = {
  id: string;
  edicion_id: string;
  codigo: string | null;
  nombre: string | null;
  estado: string;
  fecha_hora: string | null;
  jornada: number | null;
  pista: string | null;
  fase_id: string | null;
  ronda_id: string | null;
  finalizado_at: string | null;
};

type ActaDB = {
  id: string;
  estado: string;
  estado_operativo: string | null;
  iniciada_at: string | null;
  finalizada_at: string | null;
};

type PlazaDB = {
  lado: string | null;
  origen_tipo: string | null;
  equipo_origen_id: string | null;
  equipo_resuelto_id: string | null;
};

type AccionActa = {
  codigo:
    | "PREPARAR"
    | "CONTINUAR"
    | "ASSUMIR"
    | "ACCEDIR"
    | "CONSULTAR"
    | "BLOQUEJADA"
    | "NO_DISPONIBLE";
  texto: string;
  disponible: boolean;
};

function respuesta(datos: Record<string, unknown>, estado = 200): Response {
  const res = responder(datos, estado);

  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );

  return res;
}

function decidirAccion(
  partido: PartidoDB,
  acta: ActaDB | null,
  acceso: ResultadoAccesoActa,
): AccionActa {
  const estado = partido.estado.toUpperCase();

  if (["CANCELADO", "CANCELAT"].includes(estado)) {
    return {
      codigo: "NO_DISPONIBLE",
      texto: "Partit cancel·lat",
      disponible: false,
    };
  }

  if (acceso.actaFinalizada || acta?.estado === "FINALIZADA") {
    return {
      codigo: "CONSULTAR",
      texto: "Consultar acta",
      disponible: true,
    };
  }

  if (
    acceso.bloqueadoControl ||
    acta?.estado === "BLOQUEADA" ||
    acceso.estadoOperativo === "BLOQUEADA"
  ) {
    return {
      codigo: "BLOQUEJADA",
      texto: "Veure acta bloquejada",
      disponible: acta !== null,
    };
  }

  if (acceso.revisionActiva) {
    return {
      codigo: "CONSULTAR",
      texto: "Consultar acta en revisió",
      disponible: true,
    };
  }

  if (!acta) {
    return {
      codigo: acceso.puedeSolicitarControl ? "PREPARAR" : "NO_DISPONIBLE",
      texto: acceso.puedeSolicitarControl ? "Preparar acta" : "Acta pendent",
      disponible: acceso.puedeSolicitarControl,
    };
  }

  if (acceso.puedeEscribir) {
    return {
      codigo: "CONTINUAR",
      texto: "Continuar acta",
      disponible: true,
    };
  }

  if (acceso.hayOtroControlador) {
    return {
      codigo: "ACCEDIR",
      texto: "Accedir a l'acta",
      disponible: true,
    };
  }

  if (acceso.puedeSolicitarControl) {
    return {
      codigo: acta.estado === "EN_CURSO" ? "ASSUMIR" : "PREPARAR",
      texto:
        acta.estado === "EN_CURSO" ? "Assumir el control" : "Preparar acta",
      disponible: true,
    };
  }

  return {
    codigo: "CONSULTAR",
    texto: "Consultar acta",
    disponible: true,
  };
}

async function consultarNombre(
  tabla: "competicion_fases" | "competicion_rondas",
  id: string | null,
): Promise<string | null> {
  if (!id) return null;

  const { data, error } = await supabaseAdmin
    .from(tabla)
    .select("nombre")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  return data?.nombre ?? null;
}

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const contexto = await exigirPartidoDesignadoVoluntariat(
      cookies,
      url.searchParams.get("torneoID"),
      url.searchParams.get("edicionID"),
      url.searchParams.get("partidoID"),
    );

    // Reutilizar el controlador central del acta.
    const acceso = await obtenerAccesoActa({
      usuario: contexto.usuario,
      torneoID: contexto.torneoID,
      edicionID: contexto.edicionID,
      partidoID: contexto.partidoID,
    });

    if (!acceso.puedeConsultar) {
      throw new ErrorAPI(
        403,
        "No tens autorització per consultar aquesta acta.",
      );
    }

    const [partidoRes, actaRes, plazasRes, torneoRes] = await Promise.all([
      supabaseAdmin
        .from("competicion_partidos")
        .select(
          "id,edicion_id,codigo,nombre,estado," +
            "fecha_hora,jornada,pista,fase_id," +
            "ronda_id,finalizado_at",
        )
        .eq("id", contexto.partidoID)
        .eq("edicion_id", contexto.edicionID)
        .maybeSingle(),

      supabaseAdmin
        .from("acta_partidos")
        .select("id,estado,estado_operativo," + "iniciada_at,finalizada_at")
        .eq("partido_id", contexto.partidoID)
        .maybeSingle(),

      supabaseAdmin
        .from("competicion_plazas")
        .select("lado,origen_tipo," + "equipo_origen_id,equipo_resuelto_id")
        .eq("partido_id", contexto.partidoID)
        .eq("edicion_id", contexto.edicionID)
        .eq("destino_tipo", "PARTIDO"),

      supabaseAdmin
        .from("torneos")
        .select("id,nombre,deporte,logo")
        .eq("id", contexto.torneoID)
        .maybeSingle(),
    ]);

    for (const consulta of [partidoRes, actaRes, plazasRes, torneoRes]) {
      if (consulta.error) throw consulta.error;
    }

    const partido = partidoRes.data as PartidoDB | null;

    const acta = actaRes.data as ActaDB | null;

    if (!partido) {
      throw new ErrorAPI(404, "No s'ha trobat el partit.");
    }

    const plazas = (plazasRes.data ?? []) as unknown as PlazaDB[];

    const idEquipo = (plaza: PlazaDB) =>
      plaza.equipo_resuelto_id ??
      (plaza.origen_tipo === "EQUIPO" ? plaza.equipo_origen_id : null);

    const idsEquipos = [
      ...new Set(
        plazas.map(idEquipo).filter((id): id is string => Boolean(id)),
      ),
    ];

    const nombresEquipos = new Map<string, string>();

    if (idsEquipos.length > 0) {
      const { data, error } = await supabaseAdmin
        .from("equipos")
        .select("id,nombre")
        .in("id", idsEquipos);

      if (error) throw error;

      for (const equipo of data ?? []) {
        nombresEquipos.set(equipo.id, equipo.nombre ?? "Per determinar");
      }
    }

    const nombreLado = (lado: string) => {
      const plaza = plazas.find((item) => item.lado === lado);

      if (!plaza) return "Per determinar";

      const id = idEquipo(plaza);

      return id
        ? (nombresEquipos.get(id) ?? "Per determinar")
        : "Per determinar";
    };

    const [fase, ronda] = await Promise.all([
      consultarNombre("competicion_fases", partido.fase_id),
      consultarNombre("competicion_rondas", partido.ronda_id),
    ]);

    const accion = decidirAccion(partido, acta, acceso);

    return respuesta({
      success: true,

      torneo: torneoRes.data,

      edicion: {
        id: contexto.edicionID,
        nombre: contexto.edicion.nombre,
      },

      partido: {
        id: partido.id,
        codigo: partido.codigo,
        nombre: partido.nombre,
        estado: partido.estado,
        fechaHora: partido.fecha_hora,
        jornada: partido.jornada,
        pista: partido.pista,
        fase,
        ronda,
        local: nombreLado("LOCAL"),
        visitante: nombreLado("VISITANTE"),
      },

      funciones: contexto.funciones,

      acta: acta
        ? {
            id: acta.id,
            estado: acta.estado,
            estadoOperativo: acta.estado_operativo,
            iniciadaAt: acta.iniciada_at,
            finalizadaAt: acta.finalizada_at,
          }
        : null,

      permisos: {
        puedeConsultar: acceso.puedeConsultar,
        puedeSolicitarControl: acceso.puedeSolicitarControl,
        puedeEscribir: acceso.puedeEscribir,
        esControlador: acceso.esControlador,
        hayOtroControlador: acceso.hayOtroControlador,
        bloqueadoControl: acceso.bloqueadoControl,
      },

      accion,
    });
  } catch (error) {
    if (error instanceof ErrorAPI) {
      return respuesta(
        {
          success: false,
          mensaje: error.message,
        },
        error.estado,
      );
    }

    console.error("Error consultant el partit del voluntari:", error);

    return respuesta(
      {
        success: false,
        mensaje: "No s'ha pogut consultar la designació.",
      },
      500,
    );
  }
};
