import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { tieneAccesoTorneo, tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";
import {
  comprobarOrigen,
  ErrorAPI,
  UUID,
  exigirUsuario,
  responder,
} from "@utils/inscripcio/equipBase";
import {
  normalizarConfiguracionVoleibol,
  type ConfiguracionVoleibol,
} from "@utils/acta/voleibol";

export const prerender = false;

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;
type Registro = Record<string, unknown>;
type NivelEstadisticas = "NINGUNA" | "EQUIPO" | "JUGADOR";

type TorneoDB = {
  id: string;
  nombre: string | null;
  deporte: string | null;
};

type EdicionDB = {
  id: string;
  torneo_id: string | null;
  nombre: string | null;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  estado: string;
  finalizado_at: string | null;
};

type PlazaDB = {
  lado: "LOCAL" | "VISITANTE" | null;
  equipo_resuelto_id: string | null;
};

type ActaDB = {
  id: string;
  partido_id: string;
  torneo_id: string;
  edicion_id: string;
  deporte: string;
  estado: string;
  nivel_estadisticas: string;
  configuracion_snapshot: Registro | null;
  operador_id: string | null;
  controlador_id: string | null;
  control_token: string | null;
  iniciada_at: string | null;
  bloqueada_por: string | null;
  bloqueada_at: string | null;
  motivo_bloqueo: string | null;
  finalizada_por: string | null;
  finalizada_at: string | null;
  secuencia_eventos: number;
  version: number;
  created_at: string;
  updated_at: string;
};

const SELECT_TORNEO = "id,nombre,deporte";
const SELECT_EDICION = "id,torneo_id,nombre";
const SELECT_PARTIDO = "id,edicion_id,estado,finalizado_at";
const SELECT_PLAZA = "lado,equipo_resuelto_id";
const SELECT_ACTA =
  "id,partido_id,torneo_id,edicion_id,deporte,estado,nivel_estadisticas,configuracion_snapshot,operador_id,controlador_id,control_token,iniciada_at,bloqueada_por,bloqueada_at,motivo_bloqueo,finalizada_por,finalizada_at,secuencia_eventos,version,created_at,updated_at";

function responderError(error: unknown) {
  if (error instanceof ErrorAPI) {
    return responder({ success: false, mensaje: error.message }, error.estado);
  }
  console.error("Error iniciant l'acta:", error);
  return responder(
    { success: false, mensaje: "No s'ha pogut iniciar l'acta." },
    500,
  );
}

function identificador(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim().toLowerCase())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }
  return valor.trim().toLowerCase();
}

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function normalizarDeporte(valor: string | null): string {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? ""
  );
}

async function exigirContexto(
  usuario: Usuario,
  torneoID: string,
  edicionID: string,
  partidoID: string,
) {
  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }
  if (!tienePermiso(usuario, "partits", "editar", torneoID)) {
    throw new ErrorAPI(403, "No tens permís per iniciar aquesta acta.");
  }

  const [torneoRes, edicionRes, partidoRes] = await Promise.all([
    supabaseAdmin
      .from("torneos")
      .select(SELECT_TORNEO)
      .eq("id", torneoID)
      .maybeSingle(),
    supabaseAdmin
      .from("ediciones")
      .select(SELECT_EDICION)
      .eq("id", edicionID)
      .maybeSingle(),
    supabaseAdmin
      .from("competicion_partidos")
      .select(SELECT_PARTIDO)
      .eq("id", partidoID)
      .eq("edicion_id", edicionID)
      .maybeSingle(),
  ]);
  if (torneoRes.error) throw torneoRes.error;
  if (edicionRes.error) throw edicionRes.error;
  if (partidoRes.error) throw partidoRes.error;

  const torneo = torneoRes.data as TorneoDB | null;
  const edicion = edicionRes.data as EdicionDB | null;
  const partido = partidoRes.data as PartidoDB | null;
  if (!torneo) throw new ErrorAPI(404, "No s'ha trobat el torneig.");
  if (!edicion || edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig.");
  }
  if (!partido) throw new ErrorAPI(404, "No s'ha trobat el partit.");
  if (
    partido.estado === "CANCELADO" ||
    partido.estado === "FINALIZADO" ||
    partido.finalizado_at
  ) {
    throw new ErrorAPI(409, "Aquest partit no pot iniciar una acta.");
  }
  return { torneo, edicion, partido };
}

async function exigirEquiposResueltos(partidoID: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("competicion_plazas")
    .select(SELECT_PLAZA)
    .eq("destino_tipo", "PARTIDO")
    .eq("partido_id", partidoID);
  if (error) throw error;
  const plazas = (data ?? []) as PlazaDB[];
  const local = plazas.find(
    (plaza) => plaza.lado === "LOCAL",
  )?.equipo_resuelto_id;
  const visitante = plazas.find(
    (plaza) => plaza.lado === "VISITANTE",
  )?.equipo_resuelto_id;
  if (!local || !visitante || local === visitante) {
    throw new ErrorAPI(
      409,
      "El partit encara no té resolts dos equips diferents.",
    );
  }
}

async function obtenerActa(partidoID: string): Promise<ActaDB | null> {
  const { data, error } = await supabaseAdmin
    .from("acta_partidos")
    .select(SELECT_ACTA)
    .eq("partido_id", partidoID)
    .maybeSingle();
  if (error) throw error;
  return data as ActaDB | null;
}

/**
 * El resultado conserva los mismos campos que esperaba Gestor.tsx.
 * Se añade el snapshot sin alterar los campos existentes, para que el
 * nuevo componente de voleibol pueda recuperar sus reglas tras iniciar.
 */
function actaPublica(acta: ActaDB) {
  return {
    id: acta.id,
    partido_id: acta.partido_id,
    estado: acta.estado,
    nivel_estadisticas: acta.nivel_estadisticas,
    configuracion_snapshot: acta.configuracion_snapshot,
    operador_id: acta.operador_id,
    controlador_id: acta.controlador_id,
    iniciada_at: acta.iniciada_at,
    bloqueada_por: acta.bloqueada_por,
    bloqueada_at: acta.bloqueada_at,
    motivo_bloqueo: acta.motivo_bloqueo,
    finalizada_por: acta.finalizada_por,
    finalizada_at: acta.finalizada_at,
    version: acta.version,
    created_at: acta.created_at,
    updated_at: acta.updated_at,
  };
}

/**
 * Configuración de la edición: la columna `competicion` es JSONB y
 * `leerCompeticion` del panel permite un objeto genérico.
 *
 * Convención nueva: configuracion_ediciones.competicion.voleibol
 * = { setsParaGanar, puntosSet, diferenciaSet,
 *     puntosExtraSet, diferenciaExtraSet }.
 *
 * Si todavía no existe esa sección, se respetan los valores
 * predeterminados del motor. No se modifican datos de la edición.
 */
async function obtenerReglasVoleibol(
  edicionID: string,
): Promise<ConfiguracionVoleibol> {
  const { data, error } = await supabaseAdmin
    .from("configuracion_ediciones")
    .select("competicion")
    .eq("edicion_id", edicionID)
    .maybeSingle();
  if (error) throw error;

  const competicion: unknown = data?.competicion;
  const configuracion = esRegistro(competicion)
    ? competicion.voleibol
    : undefined;
  if (
    configuracion !== undefined &&
    configuracion !== null &&
    !esRegistro(configuracion)
  ) {
    throw new ErrorAPI(
      409,
      "La configuració de voleibol de l'edició no és vàlida.",
    );
  }

  const entrada: Partial<ConfiguracionVoleibol> = {};
  const campos = [
    "setsParaGanar",
    "puntosSet",
    "diferenciaSet",
    "puntosExtraSet",
    "diferenciaExtraSet",
  ] as const;
  if (esRegistro(configuracion)) {
    for (const campo of campos) {
      const valor = configuracion[campo];
      if (valor === undefined || valor === null) continue;
      if (typeof valor !== "number") {
        throw new ErrorAPI(409, `El valor de ${campo} no és vàlid.`);
      }
      entrada[campo] = valor;
    }
  }

  try {
    return normalizarConfiguracionVoleibol(entrada);
  } catch {
    throw new ErrorAPI(409, "Les regles dels sets de voleibol no són vàlides.");
  }
}

/** Las estadísticas configuradas para la edición prevalecen sobre el deporte. */
async function obtenerNivelEstadisticas(
  deporte: string,
  edicionID: string,
): Promise<NivelEstadisticas> {
  if (deporte !== "VOLEIBOL") {
    return deporte === "FUTBOL" ? "JUGADOR" : "NINGUNA";
  }

  const { data, error } = await supabaseAdmin
    .from("competicion_estadisticas")
    .select("ambito")
    .eq("edicion_id", edicionID)
    .eq("activa", true);
  if (error) throw error;
  const ambitos = (data ?? []) as Array<{ ambito: string }>;
  if (ambitos.some(({ ambito }) => ambito === "INDIVIDUAL")) return "JUGADOR";
  if (ambitos.some(({ ambito }) => ambito === "EQUIPO")) return "EQUIPO";
  return "NINGUNA";
}

function respuestaInicio(acta: ActaDB, reutilizado: boolean) {
  return responder({
    success: true,
    iniciado: true,
    reutilizado,
    acta: actaPublica(acta),
    control: {
      puedeEditar: true,
      esControlador: true,
      puedeEscribir: true,
      controlToken: acta.control_token,
    },
  });
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  try {
    comprobarOrigen(request, url);
    const usuario = await exigirUsuario(cookies);
    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");
    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );
    const partidoID = identificador(
      url.searchParams.get("partidoID"),
      "partit",
    );

    const contexto = await exigirContexto(
      usuario,
      torneoID,
      edicionID,
      partidoID,
    );
    await exigirEquiposResueltos(partidoID);
    let acta = await obtenerActa(partidoID);

    // ACTA EXISTENTE: no cambiar las reglas ni las estadísticas guardadas.
    if (acta) {
      if (acta.estado === "FINALIZADA") {
        throw new ErrorAPI(409, "L'acta ja està finalitzada.");
      }
      if (acta.controlador_id && acta.controlador_id !== usuario.id) {
        throw new ErrorAPI(
          409,
          "L'acta està sent controlada per un altre usuari.",
        );
      }
      if (
        acta.controlador_id === usuario.id &&
        acta.estado === "EN_CURSO" &&
        acta.control_token
      ) {
        return respuestaInicio(acta, true);
      }

      const ahora = new Date().toISOString();
      const token = randomUUID().toLowerCase();
      const { data, error } = await supabaseAdmin
        .from("acta_partidos")
        .update({
          estado: "EN_CURSO",
          operador_id: acta.operador_id ?? usuario.id,
          controlador_id: usuario.id,
          control_token: token,
          iniciada_at: acta.iniciada_at ?? ahora,
          bloqueada_por: null,
          bloqueada_at: null,
          motivo_bloqueo: null,
          version: acta.version + 1,
          updated_at: ahora,
        })
        .eq("id", acta.id)
        .eq("version", acta.version)
        .select(SELECT_ACTA)
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new ErrorAPI(409, "L'acta ha canviat. Recarrega la pàgina.");
      acta = data as ActaDB;
      return respuestaInicio(acta, false);
    }

    // ACTA NUEVA: se toma una copia inmutable de las reglas del deporte.
    const deporte = normalizarDeporte(contexto.torneo.deporte);
    const nivel = await obtenerNivelEstadisticas(deporte, edicionID);
    const reglas =
      deporte === "VOLEIBOL" ? await obtenerReglasVoleibol(edicionID) : null;
    const ahora = new Date().toISOString();
    const token = randomUUID().toLowerCase();
    const snapshot: Registro = {
      deporte,
      estadisticas: { nivel },
      ...(reglas ? { voleibol: reglas } : {}),
    };

    const { data, error } = await supabaseAdmin
      .from("acta_partidos")
      .insert({
        partido_id: partidoID,
        torneo_id: torneoID,
        edicion_id: edicionID,
        deporte,
        estado: "EN_CURSO",
        nivel_estadisticas: nivel,
        configuracion_snapshot: snapshot,
        operador_id: usuario.id,
        controlador_id: usuario.id,
        control_token: token,
        iniciada_at: ahora,
        secuencia_eventos: 0,
        version: 1,
        created_at: ahora,
        updated_at: ahora,
      })
      .select(SELECT_ACTA)
      .single();
    if (error) throw error;
    acta = data as ActaDB;
    return respuestaInicio(acta, false);
  } catch (error) {
    return responderError(error);
  }
};
