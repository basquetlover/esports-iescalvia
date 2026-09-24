import type { APIRoute } from "astro";

import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { enviarEmailAccesoPanel } from "@utils/panell/permisosEmails";

import {
  NIVELES_ROL,
  NIVELES_PERMISOS,
  NOMBRES_ROL,
  NOMBRES_ACCIONES,
  SECCIONES_GENERALES,
  SECCIONES_TORNEO,
  normalizarRol,
  obtenerNivelRol,
  obtenerRolesAsignables,
  tienePermiso,
  tieneAccesoTorneo,
  obtenerContextoTorneo,
  prepararDocumentoPermisos,
  type Rol,
  type PermisosAmbito,
  type DocumentoPermisos,
  type SeccionPermisos,
} from "@const/Permisos";

export const prerender = false;

// ============================================================
// TIPOS
// ============================================================

type Registro = Record<string, unknown>;

type UsuarioDB = {
  id: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  email: string | null;

  rol: string | null;

  permisos: unknown;

  origen_permisos: string | null;

  activa: boolean | null;

  fecha_actualizacion: string | null;
};

type Administrador = NonNullable<
  Awaited<ReturnType<typeof obtenerUsuarioPorToken>>
>;

type TorneoDB = {
  id: string;

  nombre: string | null;

  deporte: string | null;
};

type AccionGestion = "crear" | "editar" | "eliminar";

const POR_PAGINA = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPOS_USUARIO =
  "id,nombre,apellido1,apellido2,email,rol,permisos,origen_permisos,activa,fecha_actualizacion";

// ============================================================
// RESPUESTAS
// ============================================================

class ErrorAPI extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

function responder(datos: unknown, estado = 200) {
  return Response.json(datos, {
    status: estado,

    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

function gestionarError(error: unknown) {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,

        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error en la gestió de permisos:", error);

  return responder(
    {
      success: false,

      mensaje: "No s'ha pogut completar l'operació.",
    },
    500,
  );
}

function esRegistro(valor: unknown): valor is Registro {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function comprobarClaves(objeto: Registro, permitidas: readonly string[]) {
  if (Object.keys(objeto).some((clave) => !permitidas.includes(clave))) {
    throw new ErrorAPI(400, "La configuració conté camps no reconeguts.");
  }
}

// ============================================================
// AUTORIZACIÓN GENERAL
// ============================================================

function exigirAcceso(
  administrador: Administrador,
  accion: "ver" | AccionGestion,
) {
  /*
   * Entrar al panel ya no depende de
   * panell.ver configurable.
   *
   * tienePermiso("panell", "ver")
   * lo resuelve automáticamente.
   */
  if (
    !tienePermiso(administrador, "panell", "ver") ||
    !tienePermiso(administrador, "permisos", "ver") ||
    !tienePermiso(administrador, "permisos", accion)
  ) {
    throw new ErrorAPI(403, "No tens permís per gestionar aquests accessos.");
  }
}

// ============================================================
// JERARQUÍA DE USUARIOS
// ============================================================

function nivelMaximoUsuario(usuario: UsuarioDB): number {
  const niveles: number[] = [];

  function incorporarRol(valor: unknown) {
    if (valor === null || valor === undefined) {
      return;
    }

    const rol = normalizarRol(valor);

    if (!rol) {
      niveles.push(Number.POSITIVE_INFINITY);

      return;
    }

    niveles.push(NIVELES_ROL[rol]);
  }

  incorporarRol(usuario.rol);

  if (esRegistro(usuario.permisos)) {
    const comunes = usuario.permisos.acceso_torneos;

    if (esRegistro(comunes) && comunes.todos === true) {
      incorporarRol(comunes.rol);
    }

    const torneos = usuario.permisos.torneos;

    if (esRegistro(torneos)) {
      for (const asignacion of Object.values(torneos)) {
        if (esRegistro(asignacion) && asignacion.acceso === true) {
          incorporarRol(asignacion.rol);
        }
      }
    }
  }

  return niveles.length > 0 ? Math.max(...niveles) : 0;
}

function puedeModificarUsuario(
  administrador: Administrador,
  destino: UsuarioDB,
): boolean {
  if (administrador.id === destino.id) {
    return false;
  }

  return obtenerNivelRol(administrador.rol) > nivelMaximoUsuario(destino);
}

// ============================================================
// BASE DE DATOS
// ============================================================

async function obtenerUsuario(id: string): Promise<UsuarioDB> {
  if (!UUID.test(id)) {
    throw new ErrorAPI(400, "L'identificador de l'usuari no és vàlid.");
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select(CAMPOS_USUARIO)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat l'usuari.");
  }

  return data;
}

async function obtenerTorneos(): Promise<TorneoDB[]> {
  const resultado: TorneoDB[] = [];

  const tamanoLote = 100;

  let desde = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("torneos")
      .select("id,nombre,deporte")
      .order("id", {
        ascending: true,
      })
      .range(desde, desde + tamanoLote - 1);

    if (error) {
      throw error;
    }

    const lote = data ?? [];

    if (lote.length === 0) {
      break;
    }

    resultado.push(...lote);

    desde += lote.length;
  }

  return resultado;
}

// ============================================================
// LISTADOS
// ============================================================

function obtenerPagina(url: URL): number {
  const valor = url.searchParams.get("pagina") ?? "1";

  if (!/^[1-9]\d*$/.test(valor)) {
    throw new ErrorAPI(400, "La pàgina no és vàlida.");
  }

  const pagina = Number(valor);

  if (!Number.isSafeInteger(pagina) || pagina > 100000) {
    throw new ErrorAPI(400, "La pàgina no és vàlida.");
  }

  return pagina;
}

async function listarUsuarios(
  url: URL,
  administrador: Administrador,
  candidatos: boolean,
) {
  const pagina = obtenerPagina(url);

  const desde = (pagina - 1) * POR_PAGINA;

  const busqueda = (url.searchParams.get("q") ?? "").trim().slice(0, 120);

  const filtroRol = url.searchParams.get("rol") ?? "";

  const filtroOrigen = url.searchParams.get("origen") ?? "";

  if (filtroRol && !normalizarRol(filtroRol)) {
    throw new ErrorAPI(400, "El rol indicat no és vàlid.");
  }

  if (!["", "manual", "sistema"].includes(filtroOrigen)) {
    throw new ErrorAPI(400, "L'origen indicat no és vàlid.");
  }

  let consulta = supabaseAdmin.from("users").select(CAMPOS_USUARIO, {
    count: "exact",
  });

  if (candidatos) {
    consulta = consulta.is("rol", null).eq("activa", true);
  } else {
    consulta = consulta.not("rol", "is", null);

    if (filtroRol) {
      consulta = consulta.eq("rol", normalizarRol(filtroRol));
    }

    if (filtroOrigen) {
      consulta = consulta.eq("origen_permisos", filtroOrigen);
    }
  }

  const palabras = busqueda
    .replace(/[^\p{L}\p{N}@.\s+-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  for (const palabra of palabras) {
    consulta = consulta.or(
      [
        `nombre.ilike.%${palabra}%`,
        `apellido1.ilike.%${palabra}%`,
        `apellido2.ilike.%${palabra}%`,
        `email.ilike.%${palabra}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await consulta
    .order("apellido1", {
      ascending: true,

      nullsFirst: false,
    })
    .order("nombre", {
      ascending: true,

      nullsFirst: false,
    })
    .order("id", {
      ascending: true,
    })
    .range(desde, desde + POR_PAGINA - 1);

  if (error) {
    throw error;
  }

  const filas = (data ?? []).map((usuario) => ({
    id: usuario.id,

    nombre: usuario.nombre,

    apellido1: usuario.apellido1,

    apellido2: usuario.apellido2,

    email: usuario.email,

    rol: usuario.rol,

    origen_permisos: usuario.origen_permisos,

    activa: usuario.activa,

    fecha_actualizacion: usuario.fecha_actualizacion,

    puedeEditar:
      puedeModificarUsuario(administrador, usuario) &&
      tienePermiso(administrador, "permisos", "editar"),

    puedeRetirar:
      puedeModificarUsuario(administrador, usuario) &&
      tienePermiso(administrador, "permisos", "eliminar"),
  }));

  const total = count ?? 0;

  return responder({
    success: true,

    filas,
    total,
    pagina,

    porPagina: POR_PAGINA,

    totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
  });
}

// ============================================================
// LECTURA SEGURA DEL DOCUMENTO
// ============================================================

function leerRol(valor: unknown, obligatorio: boolean): Rol | null {
  if (valor === null && !obligatorio) {
    return null;
  }

  const rol = normalizarRol(valor);

  if (!rol) {
    throw new ErrorAPI(400, "Hi ha una assignació amb un rol no vàlid.");
  }

  return rol;
}

function leerPermisos(
  valor: unknown,
  secciones: readonly SeccionPermisos[],
): PermisosAmbito {
  if (!esRegistro(valor)) {
    throw new ErrorAPI(400, "El bloc de permisos no és vàlid.");
  }

  comprobarClaves(
    valor,
    secciones.map((seccion) => seccion.id),
  );

  const resultado: PermisosAmbito = {};

  for (const seccion of secciones) {
    const acciones = valor[seccion.id];

    if (!esRegistro(acciones)) {
      throw new ErrorAPI(
        400,
        `Falten els permisos de la secció ${seccion.nombre}.`,
      );
    }

    comprobarClaves(acciones, seccion.acciones);

    const permisosSeccion: Record<string, boolean> = {};

    for (const accion of seccion.acciones) {
      if (typeof acciones[accion] !== "boolean") {
        throw new ErrorAPI(
          400,
          `El permís ${seccion.id}.${accion} ha de ser true o false.`,
        );
      }

      permisosSeccion[accion] = acciones[accion] as boolean;
    }

    resultado[seccion.id] = permisosSeccion;
  }

  return resultado;
}

function leerDocumento(valor: unknown): DocumentoPermisos {
  if (!esRegistro(valor)) {
    throw new ErrorAPI(400, "El document de permisos no és vàlid.");
  }

  comprobarClaves(valor, [
    "version",
    "ultima_actualizacion",
    "globales",
    "acceso_torneos",
    "torneos",
  ]);

  if (valor.version !== 1) {
    throw new ErrorAPI(400, "La versió del document no és compatible.");
  }

  const comunes = valor.acceso_torneos;

  if (!esRegistro(comunes) || typeof comunes.todos !== "boolean") {
    throw new ErrorAPI(
      400,
      "La configuració d'accés als tornejos no és vàlida.",
    );
  }

  comprobarClaves(comunes, ["todos", "rol", "permisos"]);

  if (!esRegistro(valor.torneos)) {
    throw new ErrorAPI(400, "Les assignacions de tornejos no són vàlides.");
  }

  const torneos: DocumentoPermisos["torneos"] = {};

  for (const [idOriginal, asignacion] of Object.entries(valor.torneos)) {
    if (!UUID.test(idOriginal) || !esRegistro(asignacion)) {
      throw new ErrorAPI(400, "Hi ha una assignació de torneig no vàlida.");
    }

    comprobarClaves(asignacion, ["acceso", "rol", "permisos"]);

    if (typeof asignacion.acceso !== "boolean") {
      throw new ErrorAPI(400, "L'accés al torneig ha de ser true o false.");
    }

    const id = idOriginal.toLowerCase();

    if (Object.hasOwn(torneos, id)) {
      throw new ErrorAPI(400, "Un torneig apareix més d'una vegada.");
    }

    torneos[id] = {
      acceso: asignacion.acceso,

      rol: leerRol(asignacion.rol, asignacion.acceso),

      permisos: leerPermisos(asignacion.permisos, SECCIONES_TORNEO),
    };
  }

  return {
    version: 1,

    ultima_actualizacion: new Date().toISOString(),

    globales: leerPermisos(valor.globales, SECCIONES_GENERALES),

    acceso_torneos: {
      todos: comunes.todos,

      rol: leerRol(comunes.rol, comunes.todos),

      permisos: leerPermisos(comunes.permisos, SECCIONES_TORNEO),
    },

    torneos,
  };
}

// ============================================================
// NORMALIZACIÓN DE ACCESO IMPLÍCITO
// ============================================================

function normalizarAccesosPanel(
  rolGeneral: Rol,
  documento: DocumentoPermisos,
): DocumentoPermisos {
  documento.globales.panell = {
    ver: true,
  };

  if (rolGeneral === "desarrollador") {
    documento.acceso_torneos.todos = true;

    documento.acceso_torneos.rol = "desarrollador";

    documento.acceso_torneos.permisos.panell = {
      ver: true,
    };

    documento.torneos = {};

    return documento;
  }

  documento.acceso_torneos.permisos.panell = {
    ver: documento.acceso_torneos.todos,
  };

  for (const asignacion of Object.values(documento.torneos)) {
    asignacion.permisos.panell = {
      ver: asignacion.acceso,
    };
  }

  return documento;
}

// ============================================================
// JERARQUÍA DE ROLES CONCEDIDOS
// ============================================================

function comprobarRolGeneralConcedido(
  rolDestino: Rol,
  administrador: Administrador,
) {
  const rolAdministrador = normalizarRol(administrador.rol);

  if (!rolAdministrador) {
    throw new ErrorAPI(403, "El teu compte no té un rol administratiu vàlid.");
  }

  if (NIVELES_ROL[rolDestino] >= NIVELES_ROL[rolAdministrador]) {
    throw new ErrorAPI(
      403,
      "No pots assignar un rol general igual o superior al teu.",
    );
  }
}

function comprobarRolTorneoConcedido(rolDestino: Rol, rolGestor: Rol) {
  if (NIVELES_ROL[rolDestino] >= NIVELES_ROL[rolGestor]) {
    throw new ErrorAPI(
      403,
      "No pots assignar un rol de torneig igual o superior al teu.",
    );
  }
}

// ============================================================
// VALIDACIÓN DE PRIVILEGIOS
// ============================================================

async function validarPrivilegios(
  administrador: Administrador,
  rolGeneral: Rol,
  documento: DocumentoPermisos,
) {
  const rolAdministrador = normalizarRol(administrador.rol);

  if (!rolAdministrador) {
    throw new ErrorAPI(403, "El teu compte no té un rol administratiu vàlid.");
  }

  const desarrollador = rolAdministrador === "desarrollador";

  comprobarRolGeneralConcedido(rolGeneral, administrador);

  // --------------------------------------------------------
  // PERMISOS GENERALES
  // --------------------------------------------------------

  for (const seccion of SECCIONES_GENERALES) {
    if (seccion.id === "panell") {
      continue;
    }

    for (const accion of seccion.acciones) {
      if (documento.globales[seccion.id][accion] !== true) {
        continue;
      }

      if (desarrollador) {
        continue;
      }

      if (!tienePermiso(administrador, seccion.id, accion)) {
        throw new ErrorAPI(
          403,
          `No pots concedir el permís general ${seccion.id}.${accion}.`,
        );
      }
    }
  }

  // --------------------------------------------------------
  // TODOS LOS TORNEOS
  // --------------------------------------------------------

  if (documento.acceso_torneos.todos) {
    const rolComun = documento.acceso_torneos.rol;

    if (!rolComun) {
      throw new ErrorAPI(400, "Falta el rol comú dels tornejos.");
    }

    if (desarrollador) {
      comprobarRolTorneoConcedido(rolComun, "desarrollador");
    } else {
      const permisosAdministrador = administrador.permisos;

      const comunesAdministrador =
        esRegistro(permisosAdministrador) &&
        esRegistro(permisosAdministrador.acceso_torneos)
          ? permisosAdministrador.acceso_torneos
          : null;

      const rolComunAdministrador = normalizarRol(comunesAdministrador?.rol);

      if (
        !comunesAdministrador ||
        comunesAdministrador.todos !== true ||
        !rolComunAdministrador
      ) {
        throw new ErrorAPI(
          403,
          "No pots concedir accés a tots els tornejos si no disposes d'aquest accés.",
        );
      }

      comprobarRolTorneoConcedido(rolComun, rolComunAdministrador);

      for (const seccion of SECCIONES_TORNEO) {
        if (seccion.id === "panell") {
          continue;
        }

        for (const accion of seccion.acciones) {
          if (documento.acceso_torneos.permisos[seccion.id][accion] !== true) {
            continue;
          }

          /*
           * Los permisos específicos de torneo
           * se validan después torneo a torneo.
           */
          if (
            !tienePermiso(administrador, seccion.id, accion, undefined) &&
            seccion.id === "permisos"
          ) {
            // Se valida más abajo.
          }
        }
      }
    }
  }

  // --------------------------------------------------------
  // TORNEOS EXISTENTES
  // --------------------------------------------------------

  const torneosExistentes = await obtenerTorneos();

  const idsExistentes = new Set(
    torneosExistentes.map((torneo) => torneo.id.toLowerCase()),
  );

  for (const [id, asignacion] of Object.entries(documento.torneos)) {
    if (!idsExistentes.has(id)) {
      throw new ErrorAPI(404, "Un dels tornejos seleccionats ja no existeix.");
    }

    if (!asignacion.acceso) {
      continue;
    }

    if (!asignacion.rol) {
      throw new ErrorAPI(400, "Hi ha un torneig amb accés sense rol.");
    }

    const contextoAdministrador = obtenerContextoTorneo(administrador, id);

    if (!contextoAdministrador) {
      throw new ErrorAPI(
        403,
        "No pots concedir accés a un torneig al qual no tens accés.",
      );
    }

    comprobarRolTorneoConcedido(asignacion.rol, contextoAdministrador.rol);
  }

  // --------------------------------------------------------
  // VALIDACIÓN EFECTIVA TORNEO A TORNEO
  // --------------------------------------------------------

  const usuarioPropuesto = {
    rol: rolGeneral,

    permisos: documento,

    activa: true,
  };

  for (const torneo of torneosExistentes) {
    const contextoDestino = obtenerContextoTorneo(usuarioPropuesto, torneo.id);

    if (!contextoDestino) {
      continue;
    }

    const contextoAdministrador = obtenerContextoTorneo(
      administrador,
      torneo.id,
    );

    if (!contextoAdministrador) {
      throw new ErrorAPI(
        403,
        "No pots concedir accés a un torneig al qual no tens accés.",
      );
    }

    comprobarRolTorneoConcedido(contextoDestino.rol, contextoAdministrador.rol);

    for (const seccion of SECCIONES_TORNEO) {
      if (seccion.id === "panell") {
        continue;
      }

      for (const accion of seccion.acciones) {
        const seConcede = tienePermiso(
          usuarioPropuesto,
          seccion.id,
          accion,
          torneo.id,
        );

        if (!seConcede) {
          continue;
        }

        if (desarrollador) {
          continue;
        }

        if (!tienePermiso(administrador, seccion.id, accion, torneo.id)) {
          throw new ErrorAPI(
            403,
            `No pots concedir ${seccion.id}.${accion} en un torneig on no tens aquest permís.`,
          );
        }
      }
    }
  }
}

// ============================================================
// CONFIGURACIÓN DEL ASISTENTE
// ============================================================

async function obtenerConfiguracion(administrador: Administrador) {
  const torneos = await obtenerTorneos();

  const rolAdministrador = normalizarRol(administrador.rol);

  if (!rolAdministrador) {
    throw new ErrorAPI(403, "El teu compte no té un rol administratiu vàlid.");
  }

  const rolesAsignables = obtenerRolesAsignables(rolAdministrador);

  const documento = administrador.permisos;

  const comunes =
    esRegistro(documento) && esRegistro(documento.acceso_torneos)
      ? documento.acceso_torneos
      : null;

  const desarrollador = rolAdministrador === "desarrollador";

  return responder({
    success: true,

    seccionesGenerales: SECCIONES_GENERALES,

    seccionesTorneo: SECCIONES_TORNEO,

    nombresAcciones: NOMBRES_ACCIONES,

    nivelesPermisos: NIVELES_PERMISOS,

    roles: rolesAsignables.map((rol) => ({
      valor: rol,

      nombre: NOMBRES_ROL[rol],

      nivel: NIVELES_ROL[rol],
    })),

    torneos: torneos
      .filter((torneo) => tieneAccesoTorneo(administrador, torneo.id))
      .map((torneo) => {
        const contexto = obtenerContextoTorneo(administrador, torneo.id);

        return {
          ...torneo,

          rolAdministrador: contexto?.rol ?? null,
        };
      }),

    capacidades: {
      crear: tienePermiso(administrador, "permisos", "crear"),

      editar: tienePermiso(administrador, "permisos", "editar"),

      eliminar: tienePermiso(administrador, "permisos", "eliminar"),

      concederTodos:
        desarrollador ||
        (comunes?.todos === true && normalizarRol(comunes?.rol) !== null),
    },

    administrador: {
      rol: rolAdministrador,

      nivel: NIVELES_ROL[rolAdministrador],
    },
  });
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    const token = cookies.get("token_sesion")?.value;

    const administrador = token ? await obtenerUsuarioPorToken(token) : null;

    if (!administrador) {
      throw new ErrorAPI(401, "Has d'iniciar sessió.");
    }

    exigirAcceso(administrador, "ver");

    const vista = url.searchParams.get("vista") ?? "lista";

    if (vista === "configuracion") {
      return await obtenerConfiguracion(administrador);
    }

    if (vista === "lista") {
      return await listarUsuarios(url, administrador, false);
    }

    if (vista === "candidatos") {
      exigirAcceso(administrador, "crear");

      return await listarUsuarios(url, administrador, true);
    }

    if (vista === "detalle") {
      const id = url.searchParams.get("id");

      if (!id) {
        throw new ErrorAPI(400, "Falta l'identificador de l'usuari.");
      }

      const usuario = await obtenerUsuario(id);

      const modificable = puedeModificarUsuario(administrador, usuario);

      return responder({
        success: true,

        usuario,

        capacidades: {
          crear:
            usuario.rol === null &&
            usuario.activa === true &&
            modificable &&
            tienePermiso(administrador, "permisos", "crear"),

          editar:
            usuario.rol !== null &&
            modificable &&
            tienePermiso(administrador, "permisos", "editar"),

          eliminar:
            usuario.rol !== null &&
            modificable &&
            tienePermiso(administrador, "permisos", "eliminar"),
        },
      });
    }

    throw new ErrorAPI(400, "La consulta indicada no és vàlida.");
  } catch (error) {
    return gestionarError(error);
  }
};

// ============================================================
// POST
// ============================================================

export const POST: APIRoute = async ({ cookies, request }) => {
  try {
    const tipo = request.headers.get("content-type") ?? "";

    if (tipo.split(";")[0].trim().toLowerCase() !== "application/json") {
      throw new ErrorAPI(415, "El format de la petició no és vàlid.");
    }

    const token = cookies.get("token_sesion")?.value;

    const administrador = token ? await obtenerUsuarioPorToken(token) : null;

    if (!administrador) {
      throw new ErrorAPI(401, "Has d'iniciar sessió.");
    }

    let cuerpo: unknown;

    try {
      cuerpo = await request.json();
    } catch {
      throw new ErrorAPI(400, "La petició no conté un JSON vàlid.");
    }

    if (!esRegistro(cuerpo)) {
      throw new ErrorAPI(400, "La petició no és vàlida.");
    }

    comprobarClaves(cuerpo, [
      "accion",
      "id",
      "fecha_actualizacion",
      "rol",
      "permisos",
    ]);

    const accion = cuerpo.accion;

    if (accion !== "crear" && accion !== "editar" && accion !== "eliminar") {
      throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
    }

    exigirAcceso(administrador, accion);

    if (typeof cuerpo.id !== "string" || !UUID.test(cuerpo.id)) {
      throw new ErrorAPI(400, "L'identificador de l'usuari no és vàlid.");
    }

    if (
      !Object.hasOwn(cuerpo, "fecha_actualizacion") ||
      (cuerpo.fecha_actualizacion !== null &&
        typeof cuerpo.fecha_actualizacion !== "string")
    ) {
      throw new ErrorAPI(
        400,
        "Falta la versió del compte que estàs modificant.",
      );
    }

    const usuario = await obtenerUsuario(cuerpo.id);

    if (!puedeModificarUsuario(administrador, usuario)) {
      throw new ErrorAPI(
        403,
        "No pots modificar els permisos d'aquest usuari.",
      );
    }

    if (cuerpo.fecha_actualizacion !== usuario.fecha_actualizacion) {
      throw new ErrorAPI(
        409,
        "El compte ha canviat. Torna a carregar les dades abans de desar.",
      );
    }

    // ====================================================
    // VALIDAR ESTADO ACTUAL
    // ====================================================

    if (accion === "crear") {
      if (usuario.rol !== null) {
        throw new ErrorAPI(409, "Aquest usuari ja té permisos assignats.");
      }

      if (usuario.activa !== true) {
        throw new ErrorAPI(
          409,
          "El compte ha d'estar actiu per afegir-lo al panell.",
        );
      }
    } else if (usuario.rol === null) {
      throw new ErrorAPI(409, "Aquest usuari ja no té permisos assignats.");
    }

    let rolGuardar: Rol | null;

    let permisosGuardar: unknown;

    // ====================================================
    // RETIRAR
    // ====================================================

    if (accion === "eliminar") {
      const anteriores = esRegistro(usuario.permisos) ? usuario.permisos : {};

      function desactivarBooleanos(valor: unknown): unknown {
        if (typeof valor === "boolean") {
          return false;
        }

        if (Array.isArray(valor)) {
          return valor.map(desactivarBooleanos);
        }

        if (esRegistro(valor)) {
          return Object.fromEntries(
            Object.entries(valor).map(([clave, contenido]) => [
              clave,
              desactivarBooleanos(contenido),
            ]),
          );
        }

        return valor;
      }

      const desactivados = desactivarBooleanos(anteriores) as Registro;

      rolGuardar = null;

      permisosGuardar = {
        ...desactivados,

        version: 1,

        ultima_actualizacion: new Date().toISOString(),

        globales: esRegistro(desactivados.globales)
          ? desactivados.globales
          : {},

        acceso_torneos: {
          todos: false,

          rol: null,

          permisos: esRegistro(desactivados.acceso_torneos)
            ? ((desactivados.acceso_torneos as Registro).permisos ?? {})
            : {},
        },

        torneos: esRegistro(desactivados.torneos) ? desactivados.torneos : {},
      };
    }

    // ====================================================
    // CREAR / EDITAR
    // ====================================================
    else {
      const documento = leerDocumento(cuerpo.permisos);

      let rolGeneral = normalizarRol(cuerpo.rol);

      if (!rolGeneral && accion === "editar") {
        rolGeneral = normalizarRol(usuario.rol);
      }

      let preparado = prepararDocumentoPermisos(
        documento,
        rolGeneral ?? undefined,
      );

      rolGeneral = preparado.rol;

      if (!rolGeneral) {
        throw new ErrorAPI(400, "Selecciona un rol general per a l'usuari.");
      }

      preparado = {
        rol: rolGeneral,

        permisos: normalizarAccesosPanel(rolGeneral, preparado.permisos),
      };

      await validarPrivilegios(administrador, rolGeneral, preparado.permisos);

      rolGuardar = rolGeneral;

      permisosGuardar = preparado.permisos;
    }

    // ====================================================
    // GUARDAR
    // ====================================================

    const fechaActualizacion = new Date().toISOString();

    let consulta = supabaseAdmin
      .from("users")
      .update({
        rol: rolGuardar,

        permisos: permisosGuardar,

        origen_permisos:
          accion === "crear" ? "manual" : usuario.origen_permisos,

        fecha_actualizacion: fechaActualizacion,
      })
      .eq("id", usuario.id);

    /*
     * Control optimista de concurrencia.
     */

    consulta =
      usuario.fecha_actualizacion === null
        ? consulta.is("fecha_actualizacion", null)
        : consulta.eq("fecha_actualizacion", usuario.fecha_actualizacion);

    consulta =
      usuario.rol === null
        ? consulta.is("rol", null)
        : consulta.eq("rol", usuario.rol);

    const { data, error } = await consulta
      .select("id,rol,origen_permisos,fecha_actualizacion")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ErrorAPI(
        409,
        "Un altre canvi s'ha desat abans. Torna a carregar les dades.",
      );
    }

    // ====================================================
    // EMAIL DE ACCESO AL PANEL
    // ====================================================

    /*
     * Solo se envía en el ALTA INICIAL.
     *
     * - crear   -> sí
     * - editar  -> no
     * - eliminar -> no
     *
     * IMPORTANTE:
     *
     * El correo se envía DESPUÉS de guardar correctamente
     * los permisos.
     *
     * Si el servicio de email falla, no deshacemos el alta
     * porque los permisos ya se han guardado correctamente.
     */

    let emailAccesoEnviado = false;

    if (accion === "crear" && rolGuardar !== null) {
      if (usuario.email) {
        try {
          await enviarEmailAccesoPanel({
            email: usuario.email,

            nombre: usuario.nombre,

            apellido1: usuario.apellido1,

            apellido2: usuario.apellido2,

            rol: rolGuardar,
          });

          emailAccesoEnviado = true;
        } catch (errorEmail) {
          console.error(
            "Permisos guardados correctamente, pero no se ha podido enviar el email de acceso al panel:",
            {
              usuarioID: usuario.id,

              email: usuario.email,

              error: errorEmail,
            },
          );
        }
      } else {
        console.warn(
          "Permisos guardados correctamente, pero el usuario no tiene email para enviar la notificación de acceso al panel:",
          usuario.id,
        );
      }
    }

    // ====================================================
    // RESPUESTA
    // ====================================================

    return responder({
      success: true,

      mensaje:
        accion === "crear"
          ? emailAccesoEnviado
            ? "Usuari afegit al panell correctament. S'ha enviat el correu d'accés."
            : "Usuari afegit al panell correctament."
          : accion === "eliminar"
            ? "Accés al panell retirat correctament."
            : "Permisos actualitzats correctament.",

      emailAccesoEnviado: accion === "crear" ? emailAccesoEnviado : null,

      usuario: data,
    });
  } catch (error) {
    return gestionarError(error);
  }
};
