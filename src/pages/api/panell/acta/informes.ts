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
  esRegistro,
  exigirUsuario,
  leerJSON,
  responder,
  UUID,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

// ============================================================
// INFORMES COMPARTIDOS DE TODAS LAS ACTAS
// ============================================================
// GET  /api/panell/acta/informes?partidoID=<uuid>
// POST /api/panell/acta/informes
// PATCH /api/panell/acta/informes
//
// Contrato de src/components/panel/acta/informes.tsx:
// GET  -> { success: true, informes: Informe[], permisos: PermisosInforme }
// POST -> { success: true, informe: Informe }
// PATCH -> { success: true, informe: Informe }
// Los administradores del torneo pueden crear y editar siempre:
// no dependen del estado del partido ni del controlToken.
//
// INTERNO: solo usuarios con permiso de edición de partidos.
// PUBLICO: usuarios con permiso de consulta de partidos.
// La consulta pública sin sesión tendrá su propia API, que solo
// podrá devolver informes con visibilidad PUBLICO.
//
// Requiere la tabla public.acta_informes (SQL del siguiente paso).
// No se cambia ninguna API de fútbol ni de voleibol.
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;
type VisibilidadInforme = "PUBLICO" | "INTERNO";
type MotivoInforme = "GENERAL" | "SUSPENSION";

type PartidoDB = {
  id: string;
  edicion_id: string;
  estado: string;
  finalizado_at: string | null;
};

type EdicionDB = {
  id: string;
  torneo_id: string | null;
};

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;
  estado: string;
  controlador_id: string | null;
  control_token: string | null;
};

type PlazaDB = {
  lado: string | null;
  equipo_resuelto_id: string | null;
};

type EquipoDB = {
  id: string;
  nombre: string | null;
};

type InformeDB = {
  id: string;
  acta_id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;
  visibilidad: VisibilidadInforme;
  motivo: MotivoInforme;
  contenido: string;
  equipo_responsable_id: string | null;
  equipo_responsable_nombre: string | null;
  autor_id: string;
  autor_nombre: string | null;
  creado_at: string;
};

const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at";
const SELECT_EDICION = "id,torneo_id";
const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,estado,controlador_id,control_token";
const SELECT_INFORME =
  "id,acta_id,partido_id,torneo_id,edicion_id,visibilidad,motivo,contenido,equipo_responsable_id,equipo_responsable_nombre,autor_id,autor_nombre,creado_at";
const SELECT_PLAZA = "lado,equipo_resuelto_id";
const MAX_CONTENIDO = 3000;
const MAX_INFORMES_CONSULTA = 300;

function errorRespuesta(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder({ success: false, mensaje: error.message }, error.estado);
  }

  console.error("Error gestionant els informes de l'acta:", error);
  return responder(
    {
      success: false,
      mensaje: "No s'han pogut gestionar els informes d'aquest partit.",
    },
    500,
  );
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }
  return valor.trim().toLowerCase();
}

function leerVisibilidad(valor: unknown): VisibilidadInforme {
  if (valor !== "PUBLICO" && valor !== "INTERNO") {
    throw new ErrorAPI(400, "La visibilitat de l'informe no és vàlida.");
  }
  return valor;
}

function leerMotivo(valor: unknown): MotivoInforme {
  if (valor !== "GENERAL" && valor !== "SUSPENSION") {
    throw new ErrorAPI(400, "El motiu de l'informe no és vàlid.");
  }
  return valor;
}

function leerContenido(valor: unknown): string {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, "El contingut de l'informe és obligatori.");
  }
  const contenido = valor.trim();
  if (!contenido || contenido.length > MAX_CONTENIDO) {
    throw new ErrorAPI(
      400,
      `L'informe ha de tenir entre 1 i ${MAX_CONTENIDO} caràcters.`,
    );
  }
  return contenido;
}

function nombreUsuario(usuario: Usuario): string | null {
  const nombre = [usuario.nombre, usuario.apellido1, usuario.apellido2]
    .filter(
      (parte): parte is string =>
        typeof parte === "string" && Boolean(parte.trim()),
    )
    .join(" ")
    .trim();
  return nombre || null;
}

function informePublico(informe: InformeDB) {
  // Formato exacto esperado por el componente compartido.
  return {
    id: informe.id,
    visibilidad: informe.visibilidad,
    motivo: informe.motivo,
    contenido: informe.contenido,
    equipoResponsableID: informe.equipo_responsable_id,
    equipoResponsableNombre: informe.equipo_responsable_nombre,
    autorNombre: informe.autor_nombre,
    creadoAt: informe.creado_at,
  };
}

async function obtenerContexto(usuario: Usuario, partidoID: string) {
  const { data: partidoData, error: partidoError } = await supabaseAdmin
    .from("competicion_partidos")
    .select(SELECT_PARTIDO)
    .eq("id", partidoID)
    .maybeSingle();

  if (partidoError) throw partidoError;
  const partido = partidoData as PartidoDB | null;
  if (!partido) {
    throw new ErrorAPI(404, "No s'ha trobat el partit.");
  }

  const { data: edicionData, error: edicionError } = await supabaseAdmin
    .from("ediciones")
    .select(SELECT_EDICION)
    .eq("id", partido.edicion_id)
    .maybeSingle();

  if (edicionError) throw edicionError;
  const edicion = edicionData as EdicionDB | null;
  if (!edicion) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició del partit.");
  }
  const torneoID = identificador(edicion.torneo_id, "torneig");

  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID) ||
    (!esAdministradorInforme(usuario, torneoID) &&
      !tienePermiso(usuario, "partits", "ver", torneoID))
  ) {
    throw new ErrorAPI(403, "No tens permís per consultar aquest partit.");
  }

  const { data: actaData, error: actaError } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();

  if (actaError) throw actaError;
  const acta = actaData as ActaDB | null;
  if (!acta) {
    throw new ErrorAPI(409, "L'acta encara no està iniciada.");
  }
  if (
    acta.partido_id !== partidoID ||
    acta.edicion_id !== partido.edicion_id ||
    acta.torneo_id !== torneoID
  ) {
    throw new ErrorAPI(409, "L'acta no correspon al partit seleccionat.");
  }

  return { torneoID, partido, acta };
}

/**
 * Incluye administrador de torneo, administrador y desarrollador,
 * siempre dentro de los torneos a los que tiene acceso el usuario.
 * No depende del estado de la partida ni del controlador del acta.
 */
function esAdministradorInforme(usuario: Usuario, torneoID: string): boolean {
  const rol = obtenerRolEnTorneo(usuario, torneoID);
  return (
    obtenerNivelRol(usuario.rol) >= NIVELES_ROL.admin ||
    obtenerNivelRol(rol) >= NIVELES_ROL.admintorneo
  );
}

/**
 * Los administradores siempre pueden redactar informes. Los operadores
 * pueden crearlos únicamente mientras tienen el control de un acta abierta.
 */
function puedeCrearInforme(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  torneoID: string,
  controlToken: string | null,
): boolean {
  if (esAdministradorInforme(usuario, torneoID)) return true;

  return Boolean(
    tienePermiso(usuario, "partits", "editar", torneoID) &&
    partido.estado !== "FINALIZADO" &&
    partido.estado !== "CANCELADO" &&
    !partido.finalizado_at &&
    acta.estado === "EN_CURSO" &&
    acta.controlador_id === usuario.id &&
    controlToken &&
    acta.control_token?.trim().toLowerCase() === controlToken,
  );
}

function exigirCreacion(
  usuario: Usuario,
  partido: PartidoDB,
  acta: ActaDB,
  torneoID: string,
  controlToken: string | null,
): void {
  if (puedeCrearInforme(usuario, partido, acta, torneoID, controlToken)) {
    return;
  }
  throw new ErrorAPI(
    403,
    "No tens permís per redactar informes d'aquest partit.",
  );
}

function exigirEdicionAdministrador(usuario: Usuario, torneoID: string): void {
  if (!esAdministradorInforme(usuario, torneoID)) {
    throw new ErrorAPI(
      403,
      "Només un administrador del torneig pot modificar informes guardats.",
    );
  }
}

function tokenOpcional(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === "") return null;
  return identificador(valor, "control");
}

type DatosInformeValidados = {
  visibilidad: VisibilidadInforme;
  motivo: MotivoInforme;
  contenido: string;
  equipoID: string | null;
};

function validarInforme(
  entrada: Record<string, unknown>,
): DatosInformeValidados {
  const visibilidad = leerVisibilidad(entrada.visibilidad);
  const motivo = leerMotivo(entrada.motivo);
  const contenido = leerContenido(entrada.contenido);

  let equipoID: string | null = null;
  if (motivo === "SUSPENSION") {
    equipoID = identificador(entrada.equipoResponsableID, "equip responsable");
  } else if (
    entrada.equipoResponsableID !== null &&
    entrada.equipoResponsableID !== undefined &&
    entrada.equipoResponsableID !== ""
  ) {
    throw new ErrorAPI(
      400,
      "Un informe general no ha de tenir un equip responsable.",
    );
  }

  return { visibilidad, motivo, contenido, equipoID };
}

async function equipoResponsable(
  partidoID: string,
  equipoID: string,
): Promise<EquipoDB> {
  // No se puede atribuir un informe a un equipo ajeno al partido.
  const { data: plazasData, error: plazasError } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);

  if (plazasError) throw plazasError;
  const equiposPartido = new Set(
    ((plazasData ?? []) as PlazaDB[])
      .filter((plaza) => plaza.lado === "LOCAL" || plaza.lado === "VISITANTE")
      .map((plaza) => plaza.equipo_resuelto_id)
      .filter((id): id is string => Boolean(id)),
  );
  if (!equiposPartido.has(equipoID)) {
    throw new ErrorAPI(
      400,
      "L'equip responsable no participa en aquest partit.",
    );
  }

  const { data: equipoData, error: equipoError } = await supabaseAdmin
    .from("equipos")
    .select("id,nombre")
    .eq("id", equipoID)
    .maybeSingle();

  if (equipoError) throw equipoError;
  const equipo = equipoData as EquipoDB | null;
  if (!equipo) {
    throw new ErrorAPI(400, "L'equip responsable no existeix.");
  }
  return equipo;
}

// ============================================================
// GET: CONSULTA AUTENTICADA. NO ES UNA API PÚBLICA.
// ============================================================
export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const usuario = await exigirUsuario(cookies);
    const partidoID = identificador(
      url.searchParams.get("partidoID"),
      "partit",
    );
    const { torneoID, partido, acta } = await obtenerContexto(
      usuario,
      partidoID,
    );
    const administrador = esAdministradorInforme(usuario, torneoID);
    const puedeVerInternos =
      administrador || tienePermiso(usuario, "partits", "editar", torneoID);
    const puedeCrear = puedeCrearInforme(
      usuario,
      partido,
      acta,
      torneoID,
      acta.controlador_id === usuario.id ? acta.control_token : null,
    );

    let consulta = supabaseAdmin
      .from("acta_informes")
      .select(SELECT_INFORME)
      .eq("acta_id", acta.id)
      .eq("partido_id", partidoID);

    // Nunca consultar informes internos para roles de solo lectura.
    if (!puedeVerInternos) {
      consulta = consulta.eq("visibilidad", "PUBLICO");
    }

    const { data, error } = await consulta
      .order("creado_at", { ascending: false })
      .limit(MAX_INFORMES_CONSULTA);

    if (error) throw error;
    const informes = ((data ?? []) as InformeDB[]).map(informePublico);

    return responder({
      success: true,
      informes,
      permisos: {
        puedeCrear,
        puedeEditar: administrador,
        esAdministrador: administrador,
      },
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// POST: GUARDA UN INFORME EN LA MISMA TABLA PARA CUALQUIER DEPORTE.
// ============================================================
export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);
    const usuario = await exigirUsuario(cookies);
    const contenido = await leerJSON(request);
    if (!esRegistro(contenido)) {
      throw new ErrorAPI(400, "El cos de la petició no és vàlid.");
    }

    const partidoID = identificador(contenido.partidoID, "partit");
    const controlToken = tokenOpcional(contenido.controlToken);
    const datos = validarInforme(contenido);

    const { torneoID, partido, acta } = await obtenerContexto(
      usuario,
      partidoID,
    );
    exigirCreacion(usuario, partido, acta, torneoID, controlToken);

    const equipo = datos.equipoID
      ? await equipoResponsable(partidoID, datos.equipoID)
      : null;

    const { data, error } = await supabaseAdmin
      .from("acta_informes")
      .insert({
        acta_id: acta.id,
        partido_id: partidoID,
        torneo_id: torneoID,
        edicion_id: partido.edicion_id,
        visibilidad: datos.visibilidad,
        motivo: datos.motivo,
        contenido: datos.contenido,
        equipo_responsable_id: equipo?.id ?? null,
        equipo_responsable_nombre: equipo?.nombre ?? null,
        autor_id: usuario.id,
        autor_nombre: nombreUsuario(usuario),
      })
      .select(SELECT_INFORME)
      .single();

    if (error) throw error;
    if (!data) {
      throw new ErrorAPI(500, "No s'ha pogut recuperar l'informe guardat.");
    }

    return responder(
      {
        success: true,
        informe: informePublico(data as InformeDB),
      },
      201,
    );
  } catch (error) {
    return errorRespuesta(error);
  }
};

// ============================================================
// PATCH: EDICIÓN DE INFORMES DE CUALQUIER DEPORTE.
// Únicamente administradores del torneo, independientemente de
// que el partido esté abierto, cerrado o el acta finalizada.
// No requiere controlToken. No altera jugadas ni resultados.
// ============================================================
export const PATCH: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);
    const usuario = await exigirUsuario(cookies);
    const contenido = await leerJSON(request);

    const partidoID = identificador(contenido.partidoID, "partit");
    const informeID = identificador(contenido.informeID, "informe");
    const datos = validarInforme(contenido);

    const { torneoID, acta } = await obtenerContexto(usuario, partidoID);
    exigirEdicionAdministrador(usuario, torneoID);

    const equipo = datos.equipoID
      ? await equipoResponsable(partidoID, datos.equipoID)
      : null;

    // Se actualizan exclusivamente campos editables, manteniendo autor
    // original, fecha de creación, partido y acta sin alteraciones.
    const { data, error } = await supabaseAdmin
      .from("acta_informes")
      .update({
        visibilidad: datos.visibilidad,
        motivo: datos.motivo,
        contenido: datos.contenido,
        equipo_responsable_id: equipo?.id ?? null,
        equipo_responsable_nombre: equipo?.nombre ?? null,
      })
      .eq("id", informeID)
      .eq("acta_id", acta.id)
      .eq("partido_id", partidoID)
      .eq("torneo_id", torneoID)
      .select(SELECT_INFORME)
      .maybeSingle();

    if (error) throw error;
    if (!data)
      throw new ErrorAPI(404, "No s'ha trobat l'informe d'aquest partit.");

    return responder({
      success: true,
      informe: informePublico(data as InformeDB),
    });
  } catch (error) {
    return errorRespuesta(error);
  }
};
