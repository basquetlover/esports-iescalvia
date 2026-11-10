import type { APIRoute } from "astro";

import {
  NIVELES_ROL,
  obtenerNivelRol,
  obtenerRolEnTorneo,
  tieneAccesoTorneo,
  tienePermiso,
} from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  ErrorAPI,
  exigirUsuario,
  leerJSON,
  responder,
  UUID,
} from "@utils/inscripcio/equipBase";

import { verificarPassword } from "../../sesiones/iniciar";

export const prerender = false;

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type Torneo = {
  id: string;
  nombre: string | null;
};

type Edicion = {
  id: string;
  torneo_id: string;
  nombre: string | null;
};

type InformeDB = {
  id: string;
  torneo_id: string;
  edicion_id: string;
  partido_id: string;
  visibilidad: "INTERNO" | "PUBLICO";
  motivo: "GENERAL" | "SUSPENSION";
  contenido: string;
  autor_nombre: string | null;
  equipo_responsable_nombre: string | null;
  creado_at: string;
};

const SELECT_INFORME =
  "id,torneo_id,edicion_id,partido_id,visibilidad,motivo,contenido,autor_nombre,equipo_responsable_nombre,creado_at";

const TAMANO_CONSULTA = 500;

// ============================================================
// PERMISOS
// ============================================================

function puedeConsultar(usuario: Usuario, torneoID: string): boolean {
  return (
    tieneAccesoTorneo(usuario, torneoID) &&
    tienePermiso(usuario, "panell", "ver", torneoID) &&
    tienePermiso(usuario, "tornejos", "ver", torneoID) &&
    tienePermiso(usuario, "edicions", "ver", torneoID) &&
    tienePermiso(usuario, "partits", "ver", torneoID)
  );
}

function puedeEliminar(usuario: Usuario, torneoID: string): boolean {
  return (
    puedeConsultar(usuario, torneoID) &&
    obtenerNivelRol(obtenerRolEnTorneo(usuario, torneoID)) >=
      NIVELES_ROL.admintorneo &&
    tienePermiso(usuario, "partits", "eliminar", torneoID)
  );
}

// ============================================================
// VALIDACIONES
// ============================================================

function identificadorOpcional(
  valor: string | null,
  nombre: string,
): string | null {
  if (valor === null) return null;

  if (!UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function numero(valor: string | null, defecto: number, maximo: number): number {
  if (valor === null) return defecto;

  const n = Number(valor);

  if (!Number.isSafeInteger(n) || n < 0 || n > maximo) {
    throw new ErrorAPI(400, "Els paràmetres de paginació no són vàlids.");
  }

  return n;
}

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

  console.error("Error al gestionar els informes del panell:", error);

  return responder(
    {
      success: false,
      mensaje: "No s'han pogut gestionar els informes.",
    },
    500,
  );
}

// ============================================================
// TORNEOS AUTORIZADOS
// ============================================================

async function consultarTorneosPermitidos(
  usuario: Usuario,
  seleccionado: string | null,
): Promise<Torneo[]> {
  const torneos: Torneo[] = [];

  for (let offset = 0; ; offset += TAMANO_CONSULTA) {
    let consulta = supabaseAdmin
      .from("torneos")
      .select("id,nombre")
      .order("id")
      .range(offset, offset + TAMANO_CONSULTA - 1);

    if (seleccionado) {
      consulta = consulta.eq("id", seleccionado);
    }

    const { data, error } = await consulta;

    if (error) throw error;

    const pagina = (data ?? []) as Torneo[];

    torneos.push(
      ...pagina.filter((torneo) => puedeConsultar(usuario, torneo.id)),
    );

    if (pagina.length < TAMANO_CONSULTA || seleccionado) {
      break;
    }
  }

  return torneos;
}

// ============================================================
// EDICIONES AUTORIZADAS
// ============================================================

async function consultarEdicionesPermitidas(
  torneos: Torneo[],
  seleccionada: string | null,
): Promise<Edicion[]> {
  const ediciones: Edicion[] = [];

  for (let i = 0; i < torneos.length; i += 50) {
    const ids = torneos.slice(i, i + 50).map((torneo) => torneo.id);

    for (let offset = 0; ; offset += TAMANO_CONSULTA) {
      let consulta = supabaseAdmin
        .from("ediciones")
        .select("id,torneo_id,nombre")
        .in("torneo_id", ids)
        .order("id")
        .range(offset, offset + TAMANO_CONSULTA - 1);

      if (seleccionada) {
        consulta = consulta.eq("id", seleccionada);
      }

      const { data, error } = await consulta;

      if (error) throw error;

      const pagina = (data ?? []) as Edicion[];

      ediciones.push(...pagina);

      if (pagina.length < TAMANO_CONSULTA || seleccionada) {
        break;
      }
    }
  }

  return ediciones;
}

// ============================================================
// GET: CONSULTAR INFORMES AUTORIZADOS
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);

    const torneoID = identificadorOpcional(
      url.searchParams.get("torneoID"),
      "torneig",
    );

    const edicionID = identificadorOpcional(
      url.searchParams.get("edicionID"),
      "edició",
    );

    if (edicionID && !torneoID) {
      throw new ErrorAPI(400, "Cal indicar el torneig de l'edició.");
    }

    const offset = numero(url.searchParams.get("offset"), 0, 200000);

    const limit = numero(url.searchParams.get("limit"), 6, 100);

    if (!limit) {
      throw new ErrorAPI(400, "El límit ha de ser superior a zero.");
    }

    const torneos = await consultarTorneosPermitidos(usuario, torneoID);

    if (!torneos.length) {
      throw new ErrorAPI(
        403,
        "No tens permís per consultar informes d'aquest àmbit.",
      );
    }

    const ediciones = await consultarEdicionesPermitidas(torneos, edicionID);

    if (
      edicionID &&
      !ediciones.some(
        (edicion) => edicion.id === edicionID && edicion.torneo_id === torneoID,
      )
    ) {
      throw new ErrorAPI(403, "No tens accés a aquesta edició.");
    }

    if (!ediciones.length) {
      return responder({
        success: true,
        informes: [],
        hasMore: false,
        siguienteOffset: 0,
      });
    }

    const idsTorneos = torneos.map((torneo) => torneo.id);

    const idsEdiciones = new Set(ediciones.map((edicion) => edicion.id));

    const edicionPorID = new Map(
      ediciones.map((edicion) => [edicion.id, edicion]),
    );

    // La paginación se realiza después de validar permisos.
    const resultados: InformeDB[] = [];

    let origenOffset = 0;
    let terminado = false;

    while (!terminado && resultados.length < offset + limit + 1) {
      let consulta = supabaseAdmin
        .from("acta_informes")
        .select(SELECT_INFORME)
        .in("torneo_id", idsTorneos);

      if (edicionID) {
        consulta = consulta.eq("edicion_id", edicionID);
      }

      const { data, error } = await consulta
        .order("creado_at", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .range(origenOffset, origenOffset + TAMANO_CONSULTA - 1);

      if (error) throw error;

      const pagina = (data ?? []) as InformeDB[];

      for (const informe of pagina) {
        const edicion = edicionPorID.get(informe.edicion_id);

        const puedeVerInterno = tienePermiso(
          usuario,
          "partits",
          "editar",
          informe.torneo_id,
        );

        if (
          idsEdiciones.has(informe.edicion_id) &&
          edicion?.torneo_id === informe.torneo_id &&
          (informe.visibilidad === "PUBLICO" || puedeVerInterno)
        ) {
          resultados.push(informe);
        }
      }

      terminado = pagina.length < TAMANO_CONSULTA;

      origenOffset += pagina.length;
    }

    const pagina = resultados.slice(offset, offset + limit);

    const idsPartidos = [
      ...new Set(pagina.map((informe) => informe.partido_id)),
    ];

    const { data: partidos, error: errorPartidos } = idsPartidos.length
      ? await supabaseAdmin
          .from("competicion_partidos")
          .select("id,nombre,codigo")
          .in("id", idsPartidos)
      : {
          data: [],
          error: null,
        };

    if (errorPartidos) throw errorPartidos;

    const partidoPorID = new Map(
      (partidos ?? []).map((partido) => [partido.id, partido]),
    );

    const torneoPorID = new Map(torneos.map((torneo) => [torneo.id, torneo]));

    return responder({
      success: true,

      informes: pagina.map((informe) => ({
        id: informe.id,

        torneoID: informe.torneo_id,
        edicionID: informe.edicion_id,
        partidoID: informe.partido_id,

        visibilidad: informe.visibilidad,
        motivo: informe.motivo,
        contenido: informe.contenido,

        autorNombre: informe.autor_nombre,

        equipoResponsableNombre: informe.equipo_responsable_nombre,

        creadoAt: informe.creado_at,

        torneoNombre: torneoPorID.get(informe.torneo_id)?.nombre ?? "Torneig",

        edicionNombre: edicionPorID.get(informe.edicion_id)?.nombre ?? "Edició",

        partidoNombre:
          partidoPorID.get(informe.partido_id)?.nombre ||
          partidoPorID.get(informe.partido_id)?.codigo ||
          "Partit",

        puedeEliminar: puedeEliminar(usuario, informe.torneo_id),
      })),

      hasMore: resultados.length > offset + limit,

      siguienteOffset: offset + pagina.length,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// DELETE: ELIMINAR CON CONTRASEÑA
// ============================================================

export const DELETE: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);

    const usuario = await exigirUsuario(cookies);
    const entrada = await leerJSON(request);

    if (
      typeof entrada.informeID !== "string" ||
      !UUID.test(entrada.informeID)
    ) {
      throw new ErrorAPI(400, "L'identificador de l'informe no és vàlid.");
    }

    if (
      typeof entrada.contrasena !== "string" ||
      entrada.contrasena.length < 1 ||
      entrada.contrasena.length > 4096
    ) {
      throw new ErrorAPI(400, "Introdueix la contrasenya del teu compte.");
    }

    const informeID = entrada.informeID.toLowerCase();

    const { data: informe, error: errorInforme } = await supabaseAdmin
      .from("acta_informes")
      .select("id,torneo_id,edicion_id")
      .eq("id", informeID)
      .maybeSingle();

    if (errorInforme) throw errorInforme;

    if (!informe) {
      throw new ErrorAPI(404, "No s'ha trobat l'informe.");
    }

    if (!puedeEliminar(usuario, informe.torneo_id)) {
      throw new ErrorAPI(403, "No tens permís per eliminar aquest informe.");
    }

    const { data: edicion, error: errorEdicion } = await supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id")
      .eq("id", informe.edicion_id)
      .eq("torneo_id", informe.torneo_id)
      .maybeSingle();

    if (errorEdicion) throw errorEdicion;

    if (!edicion) {
      throw new ErrorAPI(403, "No tens accés a l'edició de l'informe.");
    }

    const { data: cuenta, error: errorCuenta } = await supabaseAdmin
      .from("users")
      .select("activa,contrasena")
      .eq("id", usuario.id)
      .maybeSingle();

    if (errorCuenta) throw errorCuenta;

    if (!cuenta || cuenta.activa !== true) {
      throw new ErrorAPI(403, "El teu compte no està actiu.");
    }

    const passwordCorrecta = await verificarPassword(
      entrada.contrasena,
      cuenta.contrasena,
    );

    if (!passwordCorrecta) {
      throw new ErrorAPI(401, "La contrasenya no és correcta.");
    }

    const { data: borrado, error: errorBorrado } = await supabaseAdmin
      .from("acta_informes")
      .delete()
      .eq("id", informeID)
      .eq("torneo_id", informe.torneo_id)
      .eq("edicion_id", informe.edicion_id)
      .select("id")
      .maybeSingle();

    if (errorBorrado) throw errorBorrado;

    if (!borrado) {
      throw new ErrorAPI(404, "L'informe ja no existeix.");
    }

    return responder({
      success: true,
      informeID,
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};
