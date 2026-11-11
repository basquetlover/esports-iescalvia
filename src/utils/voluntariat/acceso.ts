import type { AstroCookies } from "astro";

import { supabaseAdmin } from "@utils/supabase";

import { ErrorAPI, UUID, exigirUsuario } from "@utils/inscripcio/equipBase";

// ============================================================
// CONFIGURACIÓN
// ============================================================

const ESTADOS_APROBADOS = ["APROBADO", "ACEPTADO"];

const TAMANO_LOTE = 150;

// ============================================================
// TIPOS
// ============================================================

export type UsuarioVoluntariat = Awaited<ReturnType<typeof exigirUsuario>>;

export type FuncionVoluntariat = "ARBITRE" | "OFICIAL_TAULA";

export type EdicionVoluntariat = {
  id: string;
  torneo_id: string;
  nombre: string | null;
  estado: string | null;
  fecha_inicio: string | null;
};

export type AccesoEdicionVoluntariat = {
  torneoID: string;
  edicionID: string;

  torneo: {
    id: string;
    nombre: string;
    deporte: string | null;
    logo: string | null;
  };

  edicion: {
    id: string;
    nombre: string;
    estado: string | null;
    fechaInicio: string | null;
  };
};

export type ContextoVoluntariat = {
  usuario: UsuarioVoluntariat;
  torneoID: string;
  edicionID: string;
  edicion: EdicionVoluntariat;
  formularioID: string;
  voluntarioID: string;
};

export type ContextoPartidoVoluntariat = ContextoVoluntariat & {
  partidoID: string;
  funciones: FuncionVoluntariat[];
};

type Formulario = {
  id: string;
  edicion_id: string;
};

type Voluntario = {
  id: string;
  formulario_id: string;
};

// ============================================================
// IDENTIFICADORES
// ============================================================

function validarID(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function dividirLotes<T>(elementos: T[], tamano = TAMANO_LOTE): T[][] {
  const resultado: T[][] = [];

  for (let indice = 0; indice < elementos.length; indice += tamano) {
    resultado.push(elementos.slice(indice, indice + tamano));
  }

  return resultado;
}

// ============================================================
// SESIÓN
// ============================================================

export async function exigirSesionVoluntariat(
  cookies: AstroCookies,
): Promise<UsuarioVoluntariat> {
  const usuario = await exigirUsuario(cookies);

  if (usuario.activa !== true) {
    throw new ErrorAPI(403, "El teu compte no està actiu.");
  }

  return usuario;
}

// ============================================================
// COMPROBAR TORNEO Y EDICIÓN
// ============================================================

async function exigirEdicionVoluntariat(
  torneoID: string,
  edicionID: string,
): Promise<EdicionVoluntariat> {
  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select("id,torneo_id,nombre,estado,fecha_inicio")
    .eq("id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data || data.torneo_id?.toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany a aquest torneig.");
  }

  return data;
}

// ============================================================
// AUTORIZACIÓN DE VOLUNTARIADO
// ============================================================

/*
 * Esta es la comprobación central.
 *
 * Exige simultáneamente:
 *
 * 1. Sesión activa.
 * 2. Edición del torneo solicitado.
 * 3. Formulario aprobado.
 * 4. Validación aprobada.
 * 5. Plaza confirmada.
 *
 * No se utiliza el rol general del usuario
 * para conceder acceso.
 *
 * No existe caché de permisos.
 * Todas las llamadas consultan la base de datos.
 */

export async function exigirAccesoVoluntariat(
  cookies: AstroCookies,
  torneoIDEntrada: unknown,
  edicionIDEntrada: unknown,
): Promise<ContextoVoluntariat> {
  const usuario = await exigirSesionVoluntariat(cookies);

  const torneoID = validarID(torneoIDEntrada, "torneig");

  const edicionID = validarID(edicionIDEntrada, "edició");

  const edicion = await exigirEdicionVoluntariat(torneoID, edicionID);

  // ==========================================================
  // FORMULARIOS ACTUALMENTE APROBADOS
  // ==========================================================

  const { data: formularios, error: errorFormularios } = await supabaseAdmin
    .from("formularios")
    .select("id")
    .eq("usuario_id", usuario.id)
    .eq("edicion_id", edicionID)
    .eq("tipo", "VOLUNTARIO")
    .in("estado", ESTADOS_APROBADOS);

  if (errorFormularios) {
    throw errorFormularios;
  }

  const formularioIDs = (formularios ?? []).map((formulario) => formulario.id);

  if (!formularioIDs.length) {
    throw new ErrorAPI(
      403,
      "No tens una inscripció de voluntariat aprovada en aquesta edició.",
    );
  }

  // ==========================================================
  // VOLUNTARIO CONFIRMADO
  // ==========================================================

  let voluntario: Voluntario | null = null;

  for (const grupo of dividirLotes(formularioIDs)) {
    const { data, error } = await supabaseAdmin
      .from("voluntarios")
      .select("id,formulario_id")
      .in("formulario_id", grupo)
      .in("validacion_estado", ESTADOS_APROBADOS)
      .eq("plaza_estado", "CONFIRMADA")
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      voluntario = data;
      break;
    }
  }

  if (!voluntario) {
    throw new ErrorAPI(
      403,
      "L'accés al voluntariat d'aquesta edició no està autoritzat o ha estat cancel·lat.",
    );
  }

  return {
    usuario,
    torneoID,
    edicionID,
    edicion,
    formularioID: voluntario.formulario_id,
    voluntarioID: voluntario.id,
  };
}

// ============================================================
// PARTIDO Y DESIGNACIÓN PROPIA
// ============================================================

/*
 * Debe utilizarse en las APIs que gestionen
 * información de una designación concreta.
 *
 * Primero revalida el acceso a la edición.
 * Después comprueba que:
 *
 * - El partido pertenece a esa edición.
 * - El usuario sigue designado.
 * - La designación no está revocada.
 *
 * Una designación no sustituye la autorización
 * general del voluntariado.
 */

export async function exigirPartidoDesignadoVoluntariat(
  cookies: AstroCookies,
  torneoIDEntrada: unknown,
  edicionIDEntrada: unknown,
  partidoIDEntrada: unknown,
): Promise<ContextoPartidoVoluntariat> {
  const contexto = await exigirAccesoVoluntariat(
    cookies,
    torneoIDEntrada,
    edicionIDEntrada,
  );

  const partidoID = validarID(partidoIDEntrada, "partit");

  const { data: partido, error: errorPartido } = await supabaseAdmin
    .from("competicion_partidos")
    .select("id")
    .eq("id", partidoID)
    .eq("edicion_id", contexto.edicionID)
    .maybeSingle();

  if (errorPartido) {
    throw errorPartido;
  }

  if (!partido) {
    throw new ErrorAPI(
      404,
      "Aquest partit no pertany a l'edició seleccionada.",
    );
  }

  const { data: designaciones, error: errorDesignaciones } = await supabaseAdmin
    .from("acta_designaciones")
    .select("id,funcion")
    .eq("partido_id", partidoID)
    .eq("usuario_id", contexto.usuario.id)
    .is("revocada_at", null);

  if (errorDesignaciones) {
    throw errorDesignaciones;
  }

  const funciones = [
    ...new Set(
      (designaciones ?? [])
        .map((designacion) => designacion.funcion)
        .filter(
          (funcion): funcion is FuncionVoluntariat =>
            funcion === "ARBITRE" || funcion === "OFICIAL_TAULA",
        ),
    ),
  ];

  if (!funciones.length) {
    throw new ErrorAPI(403, "No tens cap designació activa en aquest partit.");
  }

  return {
    ...contexto,
    partidoID,
    funciones,
  };
}

// ============================================================
// LISTAR EDICIONES AUTORIZADAS
// ============================================================

/*
 * Utilidad para:
 *
 * - Mostrar u ocultar el botón Voluntariat.
 * - Construir el selector de torneos.
 * - Mostrar las ediciones accesibles.
 *
 * Solo devuelve ediciones con autorización
 * vigente del usuario autenticado.
 *
 * No mezcla permisos entre torneos.
 */

export async function obtenirEdicionsVoluntariat(
  cookies: AstroCookies,
): Promise<AccesoEdicionVoluntariat[]> {
  const usuario = await exigirSesionVoluntariat(cookies);

  const formularios: Formulario[] = [];

  // ==========================================================
  // FORMULARIOS APROBADOS DEL USUARIO
  // ==========================================================

  for (let desde = 0; ; desde += 200) {
    const { data, error } = await supabaseAdmin
      .from("formularios")
      .select("id,edicion_id")
      .eq("usuario_id", usuario.id)
      .eq("tipo", "VOLUNTARIO")
      .in("estado", ESTADOS_APROBADOS)
      .order("id")
      .range(desde, desde + 199);

    if (error) {
      throw error;
    }

    const pagina = (data ?? []) as Formulario[];

    formularios.push(...pagina);

    if (pagina.length < 200) {
      break;
    }
  }

  if (!formularios.length) {
    return [];
  }

  // ==========================================================
  // VOLUNTARIOS QUE SIGUEN CONFIRMADOS
  // ==========================================================

  const formulariosConfirmados = new Set<string>();

  for (const grupo of dividirLotes(
    formularios.map((formulario) => formulario.id),
  )) {
    const { data, error } = await supabaseAdmin
      .from("voluntarios")
      .select("formulario_id")
      .in("formulario_id", grupo)
      .in("validacion_estado", ESTADOS_APROBADOS)
      .eq("plaza_estado", "CONFIRMADA");

    if (error) {
      throw error;
    }

    for (const voluntario of data ?? []) {
      formulariosConfirmados.add(voluntario.formulario_id);
    }
  }

  const edicionesIDs = [
    ...new Set(
      formularios
        .filter((formulario) => formulariosConfirmados.has(formulario.id))
        .map((formulario) => formulario.edicion_id),
    ),
  ];

  if (!edicionesIDs.length) {
    return [];
  }

  // ==========================================================
  // EDICIONES
  // ==========================================================

  const ediciones: EdicionVoluntariat[] = [];

  for (const grupo of dividirLotes(edicionesIDs)) {
    const { data, error } = await supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id,nombre,estado,fecha_inicio")
      .in("id", grupo);

    if (error) {
      throw error;
    }

    ediciones.push(...(data ?? []));
  }

  // ==========================================================
  // TORNEOS
  // ==========================================================

  const torneosIDs = [
    ...new Set(ediciones.map((edicion) => edicion.torneo_id)),
  ];

  const torneos = new Map<
    string,
    {
      id: string;
      nombre: string;
      deporte: string | null;
      logo: string | null;
    }
  >();

  for (const grupo of dividirLotes(torneosIDs)) {
    const { data, error } = await supabaseAdmin
      .from("torneos")
      .select("id,nombre,deporte,logo")
      .in("id", grupo);

    if (error) {
      throw error;
    }

    for (const torneo of data ?? []) {
      torneos.set(torneo.id, torneo);
    }
  }

  // ==========================================================
  // RESULTADO
  // ==========================================================

  const accesos: AccesoEdicionVoluntariat[] = ediciones.flatMap((edicion) => {
    const torneo = torneos.get(edicion.torneo_id);

    if (!torneo) {
      return [];
    }

    return [
      {
        torneoID: torneo.id,
        edicionID: edicion.id,

        torneo: {
          id: torneo.id,
          nombre: torneo.nombre,
          deporte: torneo.deporte,
          logo: torneo.logo,
        },

        edicion: {
          id: edicion.id,
          nombre: edicion.nombre ?? "Edició",
          estado: edicion.estado,
          fechaInicio: edicion.fecha_inicio,
        },
      },
    ];
  });

  return accesos.sort((a, b) => {
    const porTorneo = a.torneo.nombre.localeCompare(b.torneo.nombre, "ca");

    if (porTorneo !== 0) {
      return porTorneo;
    }

    return (b.edicion.fechaInicio ?? "").localeCompare(
      a.edicion.fechaInicio ?? "",
    );
  });
}

// ============================================================
// CONSULTAR SI TIENE ACCESO A ALGUNA EDICIÓN
// ============================================================

export async function teVoluntariatActiu(
  cookies: AstroCookies,
): Promise<boolean> {
  const accesos = await obtenirEdicionsVoluntariat(cookies);

  return accesos.length > 0;
}
