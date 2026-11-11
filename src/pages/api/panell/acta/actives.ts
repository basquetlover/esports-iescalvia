import type { APIRoute } from "astro";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type ActaDB = {
  id: string;
  partido_id: string;
  estado: string;
  estado_operativo: string | null;
  controlador_id: string | null;
  operador_id: string | null;
  iniciada_at: string | null;
  updated_at: string | null;
  version: number;
};

type PartidoDB = {
  id: string;
  codigo: string;
  nombre: string | null;
  estado: string;
  fecha_hora: string | null;
  pista: string | null;
  fase_id: string;
  ronda_id: string | null;
  finalizado_at: string | null;
};

type UsuarioDB = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
};

type NombreDB = {
  id: string;
  nombre: string | null;
};

type PlazaDB = {
  partido_id: string;
  lado: "LOCAL" | "VISITANTE" | null;
  equipo_resuelto_id: string | null;
};

type EquiposPartido = {
  local: string | null;
  visitante: string | null;
};

// ============================================================
// CONSTANTES
// ============================================================

const POR_PAGINA = 200;
const MAX_REGISTROS = 2000;

// IMPORTANTE:
// Las cadenas SELECT deben conservar su tipo literal.
// No concatenar cadenas, porque Supabase puede inferir
// GenericStringError[] en lugar de las filas esperadas.

const SELECT_ACTA =
  "id,partido_id,estado,estado_operativo,controlador_id,operador_id,iniciada_at,updated_at,version" as const;

const SELECT_PARTIDO =
  "id,codigo,nombre,estado,fecha_hora,pista,fase_id,ronda_id,finalizado_at" as const;

// ============================================================
// VALIDACIONES
// ============================================================

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function responderError(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,
        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error consultant les actes actives:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'han pogut carregar les actes actives.",
    },
    500,
  );
}

// ============================================================
// PERMISOS
// ============================================================

function validarAcceso(usuario: Usuario, torneoID: string): void {
  if (
    usuario.activa !== true ||
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID) ||
    !tienePermiso(usuario, "partits", "ver", torneoID) ||
    !tienePermiso(usuario, "acta-digital", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens permís per consultar les actes actives.");
  }
}

function obtenerPermisos(usuario: Usuario, torneoID: string) {
  const permitido = (accion: string) =>
    tienePermiso(usuario, "acta-digital", accion, torneoID);

  return {
    ver: permitido("ver"),
    supervisar: permitido("supervisar"),
    controlar: permitido("controlar"),
    transferirControl: permitido("transferir-control"),
    bloquear: permitido("bloquear"),
    desbloquear: permitido("desbloquear"),
    expulsar: permitido("expulsar"),
    revisar: permitido("revisar"),
    autorizarRevision: permitido("autorizar-revision"),
    cerrarRevision: permitido("cerrar-revision"),
    verAuditoria: permitido("ver-auditoria"),

    // Las operaciones administrativas se
    // habilitarán cuando sus APIs estén listas.
    operacionesDisponibles: false,
  };
}

// ============================================================
// COMPROBAR EDICIÓN
// ============================================================

async function comprobarEdicion(
  torneoID: string,
  edicionID: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select("id,torneo_id")
    .eq("id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.torneo_id?.toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig seleccionat.");
  }
}

// ============================================================
// CONSULTAR ACTAS ACTIVAS
// ============================================================

async function consultarActas(
  torneoID: string,
  edicionID: string,
): Promise<{
  registros: ActaDB[];
  limiteAlcanzado: boolean;
}> {
  const registros: ActaDB[] = [];
  let limiteAlcanzado = false;

  for (let desde = 0; desde < MAX_REGISTROS; desde += POR_PAGINA) {
    const { data, error } = await supabaseAdmin
      .from("acta_partidos")
      .select(SELECT_ACTA)
      .eq("torneo_id", torneoID)
      .eq("edicion_id", edicionID)
      .neq("estado", "FINALIZADA")
      .order("updated_at", {
        ascending: false,
      })
      .order("id")
      .range(desde, desde + POR_PAGINA - 1);

    if (error) {
      throw error;
    }

    const pagina = (data ?? []) as ActaDB[];

    registros.push(...pagina);

    if (pagina.length < POR_PAGINA) {
      break;
    }

    if (registros.length >= MAX_REGISTROS) {
      limiteAlcanzado = true;
    }
  }

  return {
    registros: registros.filter(
      (acta) =>
        acta.estado !== "FINALIZADA" && acta.estado_operativo !== "FINALIZADA",
    ),
    limiteAlcanzado,
  };
}

// ============================================================
// CONSULTAR PARTIDOS
// ============================================================

async function consultarPartidos(
  edicionID: string,
  ids: string[],
): Promise<Map<string, PartidoDB>> {
  const mapa = new Map<string, PartidoDB>();

  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabaseAdmin
      .from("competicion_partidos")
      .select(SELECT_PARTIDO)
      .eq("edicion_id", edicionID)
      .in("id", ids.slice(i, i + 150));

    if (error) {
      throw error;
    }

    const partidos = (data ?? []) as PartidoDB[];

    for (const partido of partidos) {
      mapa.set(partido.id, partido);
    }
  }

  return mapa;
}

// ============================================================
// CONSULTAR USUARIOS
// ============================================================

async function consultarUsuarios(
  ids: string[],
): Promise<Map<string, UsuarioDB>> {
  const mapa = new Map<string, UsuarioDB>();

  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,nombre,apellido1,apellido2")
      .in("id", ids.slice(i, i + 150));

    if (error) {
      throw error;
    }

    const usuarios = (data ?? []) as UsuarioDB[];

    for (const usuario of usuarios) {
      mapa.set(usuario.id, usuario);
    }
  }

  return mapa;
}

// ============================================================
// CONSULTAR NOMBRES DE FASES, RONDAS Y EQUIPOS
// ============================================================

async function consultarNombres(
  tabla: "competicion_fases" | "competicion_rondas" | "equipos",
  ids: string[],
): Promise<Map<string, NombreDB>> {
  const mapa = new Map<string, NombreDB>();

  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabaseAdmin
      .from(tabla)
      .select("id,nombre")
      .in("id", ids.slice(i, i + 150));

    if (error) {
      throw error;
    }

    const registros = (data ?? []) as NombreDB[];

    for (const registro of registros) {
      mapa.set(registro.id, registro);
    }
  }

  return mapa;
}

// ============================================================
// EQUIPOS DE LOS PARTIDOS
// ============================================================

async function consultarEquiposPartidos(
  ids: string[],
): Promise<Map<string, EquiposPartido>> {
  const plazas: PlazaDB[] = [];

  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supabaseAdmin
      .from("competicion_plazas")
      .select("partido_id,lado,equipo_resuelto_id")
      .eq("destino_tipo", "PARTIDO")
      .in("partido_id", ids.slice(i, i + 150));

    if (error) {
      throw error;
    }

    plazas.push(...((data ?? []) as PlazaDB[]));
  }

  const equiposIDs = [
    ...new Set(
      plazas
        .map((plaza) => plaza.equipo_resuelto_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];

  const equipos = await consultarNombres("equipos", equiposIDs);

  const resultado = new Map<string, EquiposPartido>();

  for (const plaza of plazas) {
    const actual = resultado.get(plaza.partido_id) ?? {
      local: null,
      visitante: null,
    };

    const nombre = plaza.equipo_resuelto_id
      ? (equipos.get(plaza.equipo_resuelto_id)?.nombre ?? null)
      : null;

    if (plaza.lado === "LOCAL") {
      actual.local = nombre;
    }

    if (plaza.lado === "VISITANTE") {
      actual.visitante = nombre;
    }

    resultado.set(plaza.partido_id, actual);
  }

  return resultado;
}

// ============================================================
// GET — ACTAS ACTIVAS
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // ========================================================
    // SESIÓN Y PARÁMETROS
    // ========================================================

    const usuario = await exigirUsuario(cookies);

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    validarAcceso(usuario, torneoID);

    await comprobarEdicion(torneoID, edicionID);

    // ========================================================
    // ACTAS
    // ========================================================

    const resultadoActas = await consultarActas(torneoID, edicionID);

    const registros = resultadoActas.registros;

    const permisos = obtenerPermisos(usuario, torneoID);

    // ========================================================
    // SIN ACTAS
    // ========================================================

    if (registros.length === 0) {
      const respuesta = responder({
        success: true,
        torneoID,
        edicionID,
        actas: [],
        total: 0,
        limiteAlcanzado: resultadoActas.limiteAlcanzado,
        permisos,
        resumen: {
          controladas: 0,
          bloqueadas: 0,
          supervision: 0,
          revision: 0,
        },
      });

      respuesta.headers.set("Cache-Control", "private, no-store");

      return respuesta;
    }

    // ========================================================
    // IDENTIFICADORES
    // ========================================================

    const partidosIDs = [...new Set(registros.map((acta) => acta.partido_id))];

    const usuariosIDs = [
      ...new Set(
        registros
          .flatMap((acta) => [acta.controlador_id, acta.operador_id])
          .filter((id): id is string => typeof id === "string"),
      ),
    ];

    // ========================================================
    // DATOS RELACIONADOS
    // ========================================================

    const [partidos, usuarios, equipos] = await Promise.all([
      consultarPartidos(edicionID, partidosIDs),

      consultarUsuarios(usuariosIDs),

      consultarEquiposPartidos(partidosIDs),
    ]);

    const fasesIDs = [
      ...new Set([...partidos.values()].map((partido) => partido.fase_id)),
    ];

    const rondasIDs = [
      ...new Set(
        [...partidos.values()]
          .map((partido) => partido.ronda_id)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];

    const [fases, rondas] = await Promise.all([
      consultarNombres("competicion_fases", fasesIDs),

      consultarNombres("competicion_rondas", rondasIDs),
    ]);

    // ========================================================
    // PREPARAR RESPUESTA
    // ========================================================

    const actas = registros.flatMap((acta) => {
      const partido = partidos.get(acta.partido_id);

      if (
        !partido ||
        partido.estado === "FINALIZADO" ||
        partido.estado === "CANCELADO" ||
        partido.finalizado_at
      ) {
        return [];
      }

      const controlador = acta.controlador_id
        ? (usuarios.get(acta.controlador_id) ?? null)
        : null;

      const operador = acta.operador_id
        ? (usuarios.get(acta.operador_id) ?? null)
        : null;

      return [
        {
          id: acta.id,
          partidoID: acta.partido_id,

          estado: acta.estado,
          estadoOperativo: acta.estado_operativo,

          iniciadaAt: acta.iniciada_at,

          actualizadaAt: acta.updated_at,

          version: acta.version,

          controlador,
          operador,

          esControlador: acta.controlador_id === usuario.id,

          tieneControlador: Boolean(acta.controlador_id),

          partido: {
            id: partido.id,
            codigo: partido.codigo,
            nombre: partido.nombre,
            estado: partido.estado,

            fechaHora: partido.fecha_hora,

            pista: partido.pista,

            fase: fases.get(partido.fase_id)?.nombre ?? null,

            ronda: partido.ronda_id
              ? (rondas.get(partido.ronda_id)?.nombre ?? null)
              : null,

            equipos: equipos.get(partido.id) ?? {
              local: null,
              visitante: null,
            },
          },
        },
      ];
    });

    // ========================================================
    // ORDENAR POR ESTADO OPERATIVO
    // ========================================================

    const prioridad = (estado: string | null): number => {
      switch (estado) {
        case "EN_REVISION":
          return 0;

        case "BLOQUEADA":
          return 1;

        case "EN_SUPERVISION":
          return 2;

        case "CONTROLADA":
          return 3;

        default:
          return 4;
      }
    };

    actas.sort((a, b) => {
      const diferencia =
        prioridad(a.estadoOperativo) - prioridad(b.estadoOperativo);

      if (diferencia !== 0) {
        return diferencia;
      }

      return (
        (b.actualizadaAt ?? "").localeCompare(a.actualizadaAt ?? "") ||
        a.partido.codigo.localeCompare(b.partido.codigo)
      );
    });

    // ========================================================
    // RESUMEN
    // ========================================================

    const resumen = {
      controladas: actas.filter((acta) => acta.estadoOperativo === "CONTROLADA")
        .length,

      bloqueadas: actas.filter(
        (acta) =>
          acta.estado === "BLOQUEADA" || acta.estadoOperativo === "BLOQUEADA",
      ).length,

      supervision: actas.filter(
        (acta) => acta.estadoOperativo === "EN_SUPERVISION",
      ).length,

      revision: actas.filter((acta) => acta.estadoOperativo === "EN_REVISION")
        .length,
    };

    // ========================================================
    // RESPUESTA
    // ========================================================

    const respuesta = responder({
      success: true,
      torneoID,
      edicionID,

      actas,
      total: actas.length,

      limiteAlcanzado: resultadoActas.limiteAlcanzado,

      resumen,
      permisos,
    });

    respuesta.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );

    return respuesta;
  } catch (error) {
    return responderError(error);
  }
};
