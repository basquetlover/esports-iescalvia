import type { APIRoute, AstroCookies } from "astro";
import { tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";
import {
  ErrorAPI,
  UUID,
  comprobarOrigen,
  exigirUsuario,
  leerJSON,
  responder,
} from "@utils/inscripcio/equipBase";
import {
  asignarDesignacion,
  listarDesignacionesPartido,
  type ContextoDesignaciones,
  type FuncionDesignacion,
} from "@utils/acta/designaciones";
import { obtenerNivelJerarquicoActa } from "@utils/acta/acceso";

export const prerender = false;

type Gestor = ContextoDesignaciones["gestor"];
type Contexto = { gestor: Gestor; torneoID: string; edicionID: string };
type Registro = Record<string, unknown>;
type UsuarioDB = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  rol: string | null;
  activa: boolean | null;
  permisos: unknown;
};
type FormularioDB = { id: string; usuario_id: string | null };
type VoluntarioDB = { formulario_id: string };
type FaseDB = {
  id: string;
  nombre: string;
  tipo: string;
  orden: number;
};
type RondaDB = {
  id: string;
  fase_id: string;
  nombre: string;
  tipo: string;
  orden: number;
};
type GrupoDB = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
};
type PartidoDB = {
  id: string;
  edicion_id: string;
  fase_id: string;
  fase_tipo: string;
  grupo_id: string | null;
  ronda_id: string | null;
  codigo: string;
  nombre: string | null;
  orden: number;
  jornada: number | null;
  fecha_hora: string | null;
  pista: string | null;
  estado: string;
  publicado: boolean;
};
type DesignacionDB = {
  id: string;
  partido_id: string;
  usuario_id: string;
  funcion: FuncionDesignacion;
  creada_at: string;
};
type Candidato = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  tipoAcceso: "VOLUNTARI" | "ADMINISTRADOR";
};

const CAMPOS_USUARIO =
  "id,nombre,apellido1,apellido2,email,rol,activa,permisos" as const;
const CAMPOS_PARTIDO =
  "id,edicion_id,fase_id,fase_tipo,grupo_id,ronda_id,codigo,nombre,orden,jornada,fecha_hora,pista,estado,publicado" as const;
const CAMPOS_DESIGNACION =
  "id,partido_id,usuario_id,funcion,creada_at" as const;
const APROBADOS = ["APROBADO", "ACEPTADO"];

function fallo(error: unknown): Response {
  if (error instanceof ErrorAPI) {
    return responder({ success: false, mensaje: error.message }, error.estado);
  }
  console.error("Error a l'API de designacions:", error);
  return responder(
    { success: false, mensaje: "No s'han pogut carregar les designacions." },
    500,
  );
}
function id(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }
  return valor.trim().toLowerCase();
}
function num(valor: string | null, defecto: number, maximo: number): number {
  if (valor === null) return defecto;
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 1 || numero > maximo) {
    throw new ErrorAPI(400, "La paginació no és vàlida.");
  }
  return numero;
}
function permisos(gestor: Gestor, torneoID: string) {
  return {
    ver: true,
    asignar: tienePermiso(gestor, "designacions", "asignar", torneoID),
    revocar: tienePermiso(gestor, "designacions", "revocar", torneoID),
    revocacionDisponible: false,
  };
}
function exigirPermiso(
  contexto: Contexto,
  accion: "ver" | "asignar" | "revocar",
) {
  if (
    !tienePermiso(contexto.gestor, "panell", "ver", contexto.torneoID) ||
    !tienePermiso(contexto.gestor, "designacions", "ver", contexto.torneoID) ||
    !tienePermiso(contexto.gestor, "designacions", accion, contexto.torneoID)
  ) {
    throw new ErrorAPI(
      403,
      "No tens permís per gestionar aquestes designacions.",
    );
  }
}
async function contextoEdicion(
  cookies: AstroCookies,
  url: URL,
): Promise<Contexto> {
  const gestor = await exigirUsuario(cookies);
  const torneoID = id(url.searchParams.get("torneoID"), "torneig");
  const edicionID = id(url.searchParams.get("edicionID"), "edició");
  const contexto = { gestor, torneoID, edicionID };
  exigirPermiso(contexto, "ver");
  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select("id,torneo_id")
    .eq("id", edicionID)
    .maybeSingle();
  if (error) throw error;
  if (data?.torneo_id?.toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany a aquest torneig.");
  }
  return contexto;
}
function contextoPartido(
  contexto: Contexto,
  partidoID: string,
): ContextoDesignaciones {
  return { ...contexto, partidoID };
}
async function comprobarPartido(contexto: Contexto, partidoID: string) {
  const { data, error } = await supabaseAdmin
    .from("competicion_partidos")
    .select("id")
    .eq("id", partidoID)
    .eq("edicion_id", contexto.edicionID)
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new ErrorAPI(404, "No s'ha trobat el partit en aquesta edició.");
}
function textoBusqueda(valor: string | null, maximo = 120): string {
  const texto = (valor ?? "").trim();
  if (texto.length > maximo)
    throw new ErrorAPI(400, "El filtre de cerca és massa llarg.");
  return texto;
}
function clave(valor: string | null | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function nombre(usuario: UsuarioDB): string {
  return [usuario.nombre, usuario.apellido1, usuario.apellido2]
    .filter(Boolean)
    .join(" ")
    .trim();
}
function ordenRonda(ronda?: RondaDB): number {
  if (!ronda) return 999;
  const s = clave(`${ronda.tipo} ${ronda.nombre}`);
  if (/trenta.dos|32|treinta.dos/.test(s)) return 5;
  if (/setzens|dieciseis|16/.test(s)) return 10;
  if (/vuitens|octav|8/.test(s)) return 20;
  if (/quarts|cuart/.test(s)) return 30;
  if (/semifinal|semi.final/.test(s)) return 40;
  if (/tercer|tercero|3r lloc/.test(s)) return 45;
  if (/final/.test(s)) return 50;
  return 100 + (ronda.orden ?? 999);
}
async function paginarTabla<T>(
  tabla: string,
  columnas: string,
  construir: (consulta: any) => any,
): Promise<T[]> {
  const datos: T[] = [];
  for (let desde = 0; ; desde += 500) {
    const consulta = construir(supabaseAdmin.from(tabla).select(columnas));
    const { data, error } = await consulta.range(desde, desde + 499);
    if (error) throw error;
    const lote = (data ?? []) as T[];
    datos.push(...lote);
    if (lote.length < 500) break;
  }
  return datos;
}

// ============================================================
// CANDIDATOS: SOLO PERSONAS QUE SE PUEDEN DESIGNAR
// ============================================================
async function listarCandidatos(contexto: Contexto): Promise<Candidato[]> {
  exigirPermiso(contexto, "asignar");
  const formularios = await paginarTabla<FormularioDB>(
    "formularios",
    "id,usuario_id",
    (q) =>
      q
        .eq("edicion_id", contexto.edicionID)
        .eq("tipo", "VOLUNTARIO")
        .in("estado", APROBADOS)
        .order("id"),
  );
  const formulariosPorID = new Map(formularios.map((f) => [f.id, f]));
  const confirmados = new Set<string>();
  const idsFormulario = formularios.map((f) => f.id);
  for (let i = 0; i < idsFormulario.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("voluntarios")
      .select("formulario_id")
      .in("formulario_id", idsFormulario.slice(i, i + 200))
      .in("validacion_estado", APROBADOS)
      .eq("plaza_estado", "CONFIRMADA");
    if (error) throw error;
    for (const v of (data ?? []) as VoluntarioDB[]) {
      const usuarioID = formulariosPorID.get(v.formulario_id)?.usuario_id;
      if (usuarioID) confirmados.add(usuarioID);
    }
  }
  // Verificar los permisos actuales permite incluir también gestores
  // autorizados a los que se ha concedido el rol por torneo.
  const usuarios = await paginarTabla<UsuarioDB>("users", CAMPOS_USUARIO, (q) =>
    q.eq("activa", true).order("id"),
  );
  const resultado: Candidato[] = [];
  for (const usuario of usuarios) {
    const esAdmin =
      obtenerNivelJerarquicoActa(usuario, contexto.torneoID) >= 3 &&
      tienePermiso(usuario, "acta-digital", "ver", contexto.torneoID);
    if (!esAdmin && !confirmados.has(usuario.id)) continue;
    resultado.push({
      id: usuario.id,
      nombre: usuario.nombre,
      apellido1: usuario.apellido1,
      apellido2: usuario.apellido2,
      email: usuario.email,
      tipoAcceso: esAdmin ? "ADMINISTRADOR" : "VOLUNTARI",
    });
  }
  return resultado.sort((a, b) =>
    [a.apellido1, a.apellido2, a.nombre]
      .filter(Boolean)
      .join(" ")
      .localeCompare(
        [b.apellido1, b.apellido2, b.nombre].filter(Boolean).join(" "),
        "ca",
      ),
  );
}

// ============================================================
// PARTIDOS: ORDEN POR FASE, RONDA Y POSICIÓN EN EL CUADRO
// ============================================================
async function listarPartidos(contexto: Contexto, url: URL) {
  const [partidos, fases] = await Promise.all([
    paginarTabla<PartidoDB>("competicion_partidos", CAMPOS_PARTIDO, (q) =>
      q.eq("edicion_id", contexto.edicionID).order("id"),
    ),
    paginarTabla<FaseDB>("competicion_fases", "id,nombre,tipo,orden", (q) =>
      q.eq("edicion_id", contexto.edicionID).order("orden").order("id"),
    ),
  ]);
  const faseIDs = fases.map((fase) => fase.id);
  const rondas: RondaDB[] = [];
  const grupos: GrupoDB[] = [];
  for (let i = 0; i < faseIDs.length; i += 200) {
    const ids = faseIDs.slice(i, i + 200);
    const [respuestaRondas, respuestaGrupos] = await Promise.all([
      supabaseAdmin
        .from("competicion_rondas")
        .select("id,fase_id,nombre,tipo,orden")
        .in("fase_id", ids)
        .order("orden"),
      supabaseAdmin
        .from("competicion_grupos")
        .select("id,fase_id,nombre,orden")
        .in("fase_id", ids)
        .order("orden"),
    ]);
    if (respuestaRondas.error) throw respuestaRondas.error;
    if (respuestaGrupos.error) throw respuestaGrupos.error;
    rondas.push(...((respuestaRondas.data ?? []) as RondaDB[]));
    grupos.push(...((respuestaGrupos.data ?? []) as GrupoDB[]));
  }
  const mapaFases = new Map(fases.map((f) => [f.id, f]));
  const mapaRondas = new Map(rondas.map((r) => [r.id, r]));
  const mapaGrupos = new Map(grupos.map((g) => [g.id, g]));
  const orden = url.searchParams.get("orden") ?? "competicion";
  if (!["competicion", "fecha", "pista"].includes(orden)) {
    throw new ErrorAPI(400, "L'ordre seleccionat no és vàlid.");
  }
  const faseID = url.searchParams.get("faseID");
  const rondaID = url.searchParams.get("rondaID");
  const estado = url.searchParams.get("estado")?.trim().toUpperCase() ?? "";
  const buscar = clave(textoBusqueda(url.searchParams.get("buscarPartido")));
  if (faseID) id(faseID, "fase");
  if (rondaID) id(rondaID, "ronda");
  const filtrados = partidos.filter((p) => {
    if (faseID && p.fase_id !== faseID) return false;
    if (rondaID && p.ronda_id !== rondaID) return false;
    if (estado && p.estado !== estado) return false;
    if (!buscar) return true;
    const fase = mapaFases.get(p.fase_id);
    const ronda = p.ronda_id ? mapaRondas.get(p.ronda_id) : undefined;
    const grupo = p.grupo_id ? mapaGrupos.get(p.grupo_id) : undefined;
    return clave(
      [
        p.codigo,
        p.nombre,
        p.pista,
        fase?.nombre,
        ronda?.nombre,
        grupo?.nombre,
      ].join(" "),
    ).includes(buscar);
  });
  const compararFecha = (a: PartidoDB, b: PartidoDB) =>
    (a.fecha_hora ?? "9999").localeCompare(b.fecha_hora ?? "9999");
  filtrados.sort((a, b) => {
    if (orden === "fecha")
      return compararFecha(a, b) || a.codigo.localeCompare(b.codigo);
    if (orden === "pista")
      return (
        (a.pista ?? "zzzz").localeCompare(b.pista ?? "zzzz", "ca") ||
        compararFecha(a, b)
      );
    const fa = mapaFases.get(a.fase_id);
    const fb = mapaFases.get(b.fase_id);
    const diferenciaFase = (fa?.orden ?? 999) - (fb?.orden ?? 999);
    if (diferenciaFase) return diferenciaFase;
    const eliminatoria =
      a.fase_tipo === "ELIMINATORIA" || fa?.tipo === "ELIMINATORIA";
    if (eliminatoria) {
      const ra = a.ronda_id ? mapaRondas.get(a.ronda_id) : undefined;
      const rb = b.ronda_id ? mapaRondas.get(b.ronda_id) : undefined;
      const diferenciaRonda = ordenRonda(ra) - ordenRonda(rb);
      if (diferenciaRonda) return diferenciaRonda;
      if ((ra?.orden ?? 999) !== (rb?.orden ?? 999))
        return (ra?.orden ?? 999) - (rb?.orden ?? 999);
    } else {
      const ga = a.grupo_id ? mapaGrupos.get(a.grupo_id) : undefined;
      const gb = b.grupo_id ? mapaGrupos.get(b.grupo_id) : undefined;
      if ((ga?.orden ?? 999) !== (gb?.orden ?? 999))
        return (ga?.orden ?? 999) - (gb?.orden ?? 999);
      if ((a.jornada ?? 999) !== (b.jornada ?? 999))
        return (a.jornada ?? 999) - (b.jornada ?? 999);
    }
    return (
      (a.orden ?? 999) - (b.orden ?? 999) ||
      compararFecha(a, b) ||
      a.id.localeCompare(b.id)
    );
  });
  const pagina = num(url.searchParams.get("pagina"), 1, 10000);
  const porPagina = num(url.searchParams.get("porPagina"), 40, 100);
  const bloque = filtrados.slice((pagina - 1) * porPagina, pagina * porPagina);
  const IDs = bloque.map((p) => p.id);
  const designaciones: DesignacionDB[] = [];
  if (IDs.length) {
    designaciones.push(
      ...(await paginarTabla<DesignacionDB>(
        "acta_designaciones",
        CAMPOS_DESIGNACION,
        (q) => q.in("partido_id", IDs).is("revocada_at", null).order("id"),
      )),
    );
  }
  const usuarios = new Map<
    string,
    Pick<UsuarioDB, "id" | "nombre" | "apellido1" | "apellido2">
  >();
  const userIDs = [...new Set(designaciones.map((d) => d.usuario_id))];
  for (let i = 0; i < userIDs.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,nombre,apellido1,apellido2")
      .in("id", userIDs.slice(i, i + 200));
    if (error) throw error;
    for (const u of data ?? []) usuarios.set(u.id, u);
  }
  const porPartido = new Map<
    string,
    Array<DesignacionDB & { usuario: unknown }>
  >();
  for (const d of designaciones) {
    const registros = porPartido.get(d.partido_id) ?? [];
    registros.push({ ...d, usuario: usuarios.get(d.usuario_id) ?? null });
    porPartido.set(d.partido_id, registros);
  }
  return {
    partidos: bloque.map((p) => {
      const asignadas = porPartido.get(p.id) ?? [];
      return {
        ...p,
        fase: mapaFases.get(p.fase_id) ?? null,
        ronda: p.ronda_id ? (mapaRondas.get(p.ronda_id) ?? null) : null,
        grupo: p.grupo_id ? (mapaGrupos.get(p.grupo_id) ?? null) : null,
        designaciones: asignadas,
        totales: {
          arbitres: asignadas.filter((d) => d.funcion === "ARBITRE").length,
          oficialsTaula: asignadas.filter((d) => d.funcion === "OFICIAL_TAULA")
            .length,
        },
      };
    }),
    fases: fases.map((fase) => ({
      ...fase,
      rondas: rondas
        .filter((r) => r.fase_id === fase.id)
        .sort((a, b) => ordenRonda(a) - ordenRonda(b) || a.orden - b.orden),
    })),
    pagina,
    porPagina,
    total: filtrados.length,
    totalPaginas: Math.ceil(filtrados.length / porPagina),
    orden,
  };
}

// ============================================================
// GET: LISTADO, DETALLE Y CANDIDATOS
// ============================================================
export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const contexto = await contextoEdicion(cookies, url);
    const partidoID = url.searchParams.get("partidoID");
    if (url.searchParams.get("candidatos") === "true") {
      const candidatos = await listarCandidatos(contexto);
      return responder({ success: true, candidatos, total: candidatos.length });
    }
    if (partidoID) {
      const partido = id(partidoID, "partit");
      const ctx = contextoPartido(contexto, partido);
      if (url.searchParams.has("buscarEmail")) {
        exigirPermiso(contexto, "asignar");
        await comprobarPartido(contexto, partido);
        const email = clave(
          textoBusqueda(url.searchParams.get("buscarEmail"), 254),
        );
        const candidato =
          (await listarCandidatos(contexto)).find(
            (c) => clave(c.email) === email,
          ) ?? null;
        return responder({
          success: true,
          candidato,
          encontrado: Boolean(candidato),
        });
      }
      const incluirRevocadas =
        url.searchParams.get("incluirRevocadas") === "true";
      const designaciones = await listarDesignacionesPartido(
        ctx,
        incluirRevocadas,
      );
      return responder({
        success: true,
        partidoID: partido,
        designaciones,
        total: designaciones.length,
        permisos: permisos(contexto.gestor, contexto.torneoID),
      });
    }
    const lista = await listarPartidos(contexto, url);
    return responder({
      success: true,
      ...lista,
      permisos: permisos(contexto.gestor, contexto.torneoID),
    });
  } catch (error) {
    return fallo(error);
  }
};

// ============================================================
// POST: ASIGNACIÓN AUTENTICADA
// ============================================================
export const POST: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);
    const contexto = await contextoEdicion(cookies, url);
    exigirPermiso(contexto, "asignar");
    const partidoID = id(url.searchParams.get("partidoID"), "partit");
    const cuerpo: Registro = await leerJSON(request);
    const usuarioID = id(cuerpo.usuarioID, "usuari");
    if (cuerpo.funcion !== "ARBITRE" && cuerpo.funcion !== "OFICIAL_TAULA") {
      throw new ErrorAPI(400, "La funció de designació no és vàlida.");
    }
    const resultado = await asignarDesignacion(
      contextoPartido(contexto, partidoID),
      usuarioID,
      cuerpo.funcion,
    );
    return responder(
      {
        success: true,
        designacion: resultado.designacion,
        reutilizada: resultado.reutilizada,
        mensaje: resultado.reutilizada
          ? "Aquesta designació ja existia."
          : "Designació creada correctament.",
      },
      resultado.reutilizada ? 200 : 201,
    );
  } catch (error) {
    return fallo(error);
  }
};

// ============================================================
// DELETE: PENDIENTE DE GARANTÍAS SOBRE EL CONTROL
// ============================================================
export const DELETE: APIRoute = async ({ cookies, request, url }) => {
  try {
    comprobarOrigen(request, url);
    const contexto = await contextoEdicion(cookies, url);
    exigirPermiso(contexto, "revocar");
    id(url.searchParams.get("partidoID"), "partit");
    return responder(
      {
        success: false,
        mensaje:
          "La revocació encara no està disponible fins a protegir el control de l'acta.",
      },
      501,
    );
  } catch (error) {
    return fallo(error);
  }
};
