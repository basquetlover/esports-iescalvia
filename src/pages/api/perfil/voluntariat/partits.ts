import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import { ErrorAPI, responder } from "@utils/inscripcio/equipBase";
import { exigirAccesoVoluntariat } from "@utils/voluntariat/acceso";

export const prerender = false;

type Funcion = "ARBITRE" | "OFICIAL_TAULA";

type Designacion = {
  partido_id: string;
  funcion: Funcion;
};

type Partido = {
  id: string;
  codigo: string | null;
  nombre: string | null;
  fecha_hora: string | null;
  jornada: number | null;
  orden: number | null;
  pista: string | null;
  estado: string | null;
  fase_id: string | null;
  ronda_id: string | null;
};

type Acta = {
  partido_id: string;
  estado: string;
  controlador_id: string | null;
  bloqueada_at: string | null;
  finalizada_at: string | null;
};

type Plaza = {
  partido_id: string | null;
  lado: string | null;
  origen_tipo: string | null;
  equipo_origen_id: string | null;
  equipo_resuelto_id: string | null;
};

function lotes<T>(items: T[], tamano = 150): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) {
    resultado.push(items.slice(i, i + tamano));
  }
  return resultado;
}

async function paginar<T>(
  tabla: string,
  columnas: string,
  construir: (consulta: any) => any,
): Promise<T[]> {
  const resultado: T[] = [];

  for (let desde = 0; ; desde += 300) {
    const { data, error } = await construir(
      supabaseAdmin.from(tabla).select(columnas),
    ).range(desde, desde + 299);

    if (error) throw error;

    const pagina = (data ?? []) as T[];
    resultado.push(...pagina);

    if (pagina.length < 300) break;
  }

  return resultado;
}

async function obtenerNombres(
  tabla: "equipos" | "competicion_fases" | "competicion_rondas",
  ids: string[],
) {
  const resultado = new Map<string, string>();

  for (const grupo of lotes([...new Set(ids)])) {
    const { data, error } = await supabaseAdmin
      .from(tabla)
      .select("id,nombre")
      .in("id", grupo);

    if (error) throw error;

    for (const item of data ?? []) {
      if (item.nombre) resultado.set(item.id, item.nombre);
    }
  }

  return resultado;
}

function compararPartidos(a: Partido, b: Partido): number {
  const fechaA = a.fecha_hora ? new Date(a.fecha_hora).getTime() : NaN;
  const fechaB = b.fecha_hora ? new Date(b.fecha_hora).getTime() : NaN;

  const validaA = Number.isFinite(fechaA);
  const validaB = Number.isFinite(fechaB);

  if (validaA && validaB && fechaA !== fechaB) {
    return fechaA - fechaB;
  }

  if (validaA !== validaB) return validaA ? -1 : 1;

  return (
    (a.jornada ?? Number.MAX_SAFE_INTEGER) -
      (b.jornada ?? Number.MAX_SAFE_INTEGER) ||
    (a.orden ?? Number.MAX_SAFE_INTEGER) -
      (b.orden ?? Number.MAX_SAFE_INTEGER) ||
    (a.codigo ?? "").localeCompare(b.codigo ?? "", "ca", {
      numeric: true,
    })
  );
}

function respuesta(datos: Record<string, unknown>, estado = 200): Response {
  const res = responder(datos, estado);
  res.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, must-revalidate",
  );
  return res;
}

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // Se vuelve a comprobar el acceso en CADA llamada.
    const contexto = await exigirAccesoVoluntariat(
      cookies,
      url.searchParams.get("torneoID"),
      url.searchParams.get("edicionID"),
    );

    const designaciones = await paginar<Designacion>(
      "acta_designaciones",
      "partido_id,funcion",
      (q) =>
        q
          .eq("usuario_id", contexto.usuario.id)
          .is("revocada_at", null)
          .order("id"),
    );

    const funciones = new Map<string, Set<Funcion>>();

    for (const d of designaciones) {
      if (d.funcion !== "ARBITRE" && d.funcion !== "OFICIAL_TAULA") {
        continue;
      }
      const actuales = funciones.get(d.partido_id) ?? new Set<Funcion>();
      actuales.add(d.funcion);
      funciones.set(d.partido_id, actuales);
    }

    const ids = [...funciones.keys()];

    const partidos: Partido[] = [];

    for (const grupo of lotes(ids)) {
      const { data, error } = await supabaseAdmin
        .from("competicion_partidos")
        .select(
          "id,codigo,nombre,fecha_hora,jornada,orden,pista,estado,fase_id,ronda_id",
        )
        .eq("edicion_id", contexto.edicionID)
        .in("id", grupo);

      if (error) throw error;
      partidos.push(...((data ?? []) as Partido[]));
    }

    partidos.sort(compararPartidos);

    const partidosIDs = partidos.map((p) => p.id);

    const actas: Acta[] = [];
    const plazas: Plaza[] = [];

    for (const grupo of lotes(partidosIDs)) {
      const [respuestaActas, respuestaPlazas] = await Promise.all([
        supabaseAdmin
          .from("acta_partidos")
          .select("partido_id,estado,controlador_id,bloqueada_at,finalizada_at")
          .in("partido_id", grupo),

        supabaseAdmin
          .from("competicion_plazas")
          .select(
            "partido_id,lado,origen_tipo,equipo_origen_id,equipo_resuelto_id",
          )
          .eq("edicion_id", contexto.edicionID)
          .eq("destino_tipo", "PARTIDO")
          .in("partido_id", grupo),
      ]);

      if (respuestaActas.error) throw respuestaActas.error;
      if (respuestaPlazas.error) throw respuestaPlazas.error;

      actas.push(...((respuestaActas.data ?? []) as Acta[]));
      plazas.push(...((respuestaPlazas.data ?? []) as Plaza[]));
    }

    const nombresEquipos = await obtenerNombres(
      "equipos",
      plazas
        .map(
          (p) =>
            p.equipo_resuelto_id ??
            (p.origen_tipo === "EQUIPO" ? p.equipo_origen_id : null),
        )
        .filter((id): id is string => Boolean(id)),
    );

    const [fases, rondas] = await Promise.all([
      obtenerNombres(
        "competicion_fases",
        partidos
          .map((p) => p.fase_id)
          .filter((id): id is string => Boolean(id)),
      ),
      obtenerNombres(
        "competicion_rondas",
        partidos
          .map((p) => p.ronda_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ]);

    const mapaActas = new Map(actas.map((a) => [a.partido_id, a]));

    const equiposPorPartido = new Map<
      string,
      { local: string; visitante: string }
    >();

    for (const plaza of plazas) {
      if (!plaza.partido_id) continue;

      const equipos = equiposPorPartido.get(plaza.partido_id) ?? {
        local: "Per determinar",
        visitante: "Per determinar",
      };

      const equipoID =
        plaza.equipo_resuelto_id ??
        (plaza.origen_tipo === "EQUIPO" ? plaza.equipo_origen_id : null);

      const nombre = equipoID
        ? (nombresEquipos.get(equipoID) ?? "Per determinar")
        : "Per determinar";

      if (plaza.lado === "LOCAL") equipos.local = nombre;
      if (plaza.lado === "VISITANTE") equipos.visitante = nombre;

      equiposPorPartido.set(plaza.partido_id, equipos);
    }

    return respuesta({
      success: true,
      torneoID: contexto.torneoID,
      edicionID: contexto.edicionID,
      total: partidos.length,

      partidos: partidos.map((p) => {
        const acta = mapaActas.get(p.id);
        const equipos = equiposPorPartido.get(p.id);

        return {
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          fechaHora: p.fecha_hora,
          jornada: p.jornada,
          orden: p.orden,
          pista: p.pista,
          estado: p.estado,
          fase: p.fase_id ? (fases.get(p.fase_id) ?? null) : null,
          ronda: p.ronda_id ? (rondas.get(p.ronda_id) ?? null) : null,
          local: equipos?.local ?? "Per determinar",
          visitante: equipos?.visitante ?? "Per determinar",
          funciones: [...(funciones.get(p.id) ?? [])],

          acta: acta
            ? {
                estado: acta.estado,
                bloqueada:
                  Boolean(acta.bloqueada_at) && acta.estado !== "FINALIZADA",
                finalizada:
                  acta.estado === "FINALIZADA" || Boolean(acta.finalizada_at),
                esControlador: acta.controlador_id === contexto.usuario.id,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof ErrorAPI) {
      return respuesta(
        { success: false, mensaje: error.message },
        error.estado,
      );
    }

    console.error("Error consultant les designacions del voluntari:", error);

    return respuesta(
      {
        success: false,
        mensaje: "No s'han pogut carregar els partits designats.",
      },
      500,
    );
  }
};
