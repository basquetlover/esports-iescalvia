import { tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";

import { ErrorAPI, UUID } from "@utils/inscripcio/equipBase";

import {
  esVoluntarioHabilitadoActa,
  obtenerNivelJerarquicoActa,
  type UsuarioAccesoActa,
} from "@utils/acta/acceso";

// ============================================================
// TIPOS
// ============================================================

export type FuncionDesignacion = "ARBITRE" | "OFICIAL_TAULA";

export type ContextoDesignaciones = {
  gestor: UsuarioAccesoActa;
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

export type DesignacionActa = {
  id: string;
  partido_id: string;
  usuario_id: string;
  funcion: FuncionDesignacion;
  creada_por: string;
  creada_at: string;
  revocada_at: string | null;
  revocada_por: string | null;
  motivo_revocacion: string | null;
};

export type UsuarioDesignado = UsuarioAccesoActa & {
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
};

export type DesignacionConUsuario = DesignacionActa & {
  usuario: Omit<UsuarioDesignado, "permisos"> | null;
};

export type ResultadoAsignacion = {
  designacion: DesignacionActa;
  reutilizada: boolean;
};

type IDsContexto = {
  gestorID: string;
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const CAMPOS_DESIGNACION =
  "id,partido_id,usuario_id,funcion,creada_por,creada_at,revocada_at,revocada_por,motivo_revocacion" as const;

const CAMPOS_USUARIO =
  "id,nombre,apellido1,apellido2,email,activa,rol,permisos" as const;

// Realtime usa un canal público que solo transmite
// avisos de actualización, nunca datos privados.

export const PREFIJO_CANAL_DESIGNACIONES = "designacions-partit-";

export const EVENTO_REALTIME_DESIGNACIONES = "actualitzada";

// ============================================================
// VALIDACIONES
// ============================================================

function validarID(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function mismoID(valor: string | null | undefined, esperado: string): boolean {
  return typeof valor === "string" && valor.toLowerCase() === esperado;
}

function validarFuncion(funcion: unknown): FuncionDesignacion {
  if (funcion !== "ARBITRE" && funcion !== "OFICIAL_TAULA") {
    throw new ErrorAPI(400, "La funció de la designació no és vàlida.");
  }

  return funcion;
}

function validarMotivo(valor: unknown): string {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, "Has d'indicar el motiu de la revocació.");
  }

  const motivo = valor.trim();

  if (motivo.length === 0 || motivo.length > 1000) {
    throw new ErrorAPI(400, "El motiu ha de tenir entre 1 i 1.000 caràcters.");
  }

  return motivo;
}

// ============================================================
// CONTEXTO Y PERMISOS
// ============================================================

async function exigirContexto(
  contexto: ContextoDesignaciones,
  accion: "ver" | "asignar" | "revocar",
): Promise<IDsContexto> {
  const ids: IDsContexto = {
    gestorID: validarID(contexto.gestor.id, "gestor"),

    torneoID: validarID(contexto.torneoID, "torneig"),

    edicionID: validarID(contexto.edicionID, "edició"),

    partidoID: validarID(contexto.partidoID, "partit"),
  };

  if (
    contexto.gestor.activa !== true ||
    !tienePermiso(contexto.gestor, "panell", "ver", ids.torneoID) ||
    !tienePermiso(contexto.gestor, "designacions", "ver", ids.torneoID) ||
    !tienePermiso(contexto.gestor, "designacions", accion, ids.torneoID)
  ) {
    throw new ErrorAPI(
      403,
      "No tens permís per gestionar aquestes designacions.",
    );
  }

  const [respuestaEdicion, respuestaPartido] = await Promise.all([
    supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id")
      .eq("id", ids.edicionID)
      .maybeSingle(),

    supabaseAdmin
      .from("competicion_partidos")
      .select("id,edicion_id")
      .eq("id", ids.partidoID)
      .eq("edicion_id", ids.edicionID)
      .maybeSingle(),
  ]);

  if (respuestaEdicion.error) {
    throw respuestaEdicion.error;
  }

  if (respuestaPartido.error) {
    throw respuestaPartido.error;
  }

  if (
    !mismoID(respuestaEdicion.data?.torneo_id, ids.torneoID) ||
    !mismoID(respuestaPartido.data?.edicion_id, ids.edicionID)
  ) {
    throw new ErrorAPI(404, "El partit no pertany a l'edició o al torneig.");
  }

  return ids;
}

// ============================================================
// CONSULTA DE USUARIOS
// ============================================================

async function obtenerUsuario(
  usuarioID: string,
  exigirActivo = true,
): Promise<UsuarioDesignado> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(CAMPOS_USUARIO)
    .eq("id", usuarioID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ErrorAPI(404, "No s'ha trobat l'usuari.");
  }

  if (exigirActivo && data.activa !== true) {
    throw new ErrorAPI(409, "El compte de l'usuari no està actiu.");
  }

  return data as UsuarioDesignado;
}

// ============================================================
// ELEGIBILIDAD DE DESIGNACIONES
// ============================================================

async function exigirElegibilidad(
  usuario: UsuarioDesignado,
  torneoID: string,
  edicionID: string,
): Promise<void> {
  const administradorAutorizado =
    obtenerNivelJerarquicoActa(usuario, torneoID) >= 3 &&
    tienePermiso(usuario, "acta-digital", "ver", torneoID);

  if (administradorAutorizado) {
    return;
  }

  const confirmado = await esVoluntarioHabilitadoActa(
    usuario.id,
    torneoID,
    edicionID,
  );

  if (!confirmado) {
    throw new ErrorAPI(
      403,
      "Només es poden designar voluntaris amb plaça confirmada " +
        "o administradors autoritzats.",
    );
  }
}

// ============================================================
// AUDITORÍA
// ============================================================

/**
 * La tabla de designaciones ya conserva:
 * - creada_por
 * - creada_at
 * - revocada_por
 * - revocada_at
 * - motivo_revocacion
 *
 * Estos datos se guardan junto con la propia
 * operación de asignación o revocación.
 *
 * El registro adicional en acta_auditoria se
 * realiza por separado.
 *
 * Si falla el registro adicional, se informa
 * al servidor sin ocultar el resultado real de
 * la operación principal.
 */
async function registrarAuditoria(
  accion: string,
  ids: IDsContexto,
  usuarioAfectadoID: string,
  designacion: DesignacionActa,
  anterior: DesignacionActa | null,
): Promise<void> {
  const { error } = await supabaseAdmin.from("acta_auditoria").insert({
    partido_id: ids.partidoID,
    edicion_id: ids.edicionID,
    designacion_id: designacion.id,
    actor_id: ids.gestorID,
    usuario_afectado_id: usuarioAfectadoID,
    accion,

    datos_antes: anterior,
    datos_despues: designacion,

    detalles: {
      funcion: designacion.funcion,
    },
  });

  if (error) {
    console.error(
      "No s'ha pogut registrar l'auditoria de designacions:",
      error,
    );
  }
}

// ============================================================
// NOTIFICACIONES REALTIME
// ============================================================

/**
 * Se utiliza el cliente Supabase del servidor.
 *
 * httpSend() permite enviar un aviso Broadcast
 * por HTTP, sin abrir una conexión WebSocket
 * adicional desde la API Astro.
 *
 * No se transmite información personal.
 *
 * Los clientes React deben escuchar el mismo
 * canal y volver a consultar la API autenticada.
 *
 * Una notificación nunca concede permisos.
 */
async function notificarCambio(partidoID: string): Promise<void> {
  const canal = supabaseAdmin.channel(
    `${PREFIJO_CANAL_DESIGNACIONES}${partidoID}`,
    {
      config: {
        private: false,
      },
    },
  );

  try {
    const resultado = await canal.httpSend(EVENTO_REALTIME_DESIGNACIONES, {
      partidoID,
      actualizadoAt: new Date().toISOString(),
    });

    if (!resultado.success) {
      console.error("No s'ha pogut enviar l'avís Realtime:", resultado.error);
    }
  } catch (error) {
    console.error("Error enviant l'avís de designacions:", error);
  } finally {
    await supabaseAdmin.removeChannel(canal);
  }
}

// ============================================================
// LISTAR DESIGNACIONES
// ============================================================

export async function listarDesignacionesPartido(
  contexto: ContextoDesignaciones,
  incluirRevocadas = false,
): Promise<DesignacionConUsuario[]> {
  const ids = await exigirContexto(contexto, "ver");

  const filas: DesignacionActa[] = [];
  const tamanoPagina = 500;

  let desde = 0;

  while (true) {
    let consulta = supabaseAdmin
      .from("acta_designaciones")
      .select(CAMPOS_DESIGNACION)
      .eq("partido_id", ids.partidoID);

    if (!incluirRevocadas) {
      consulta = consulta.is("revocada_at", null);
    }

    const { data, error } = await consulta
      .order("creada_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(desde, desde + tamanoPagina - 1);

    if (error) {
      throw error;
    }

    const pagina = (data ?? []) as DesignacionActa[];

    filas.push(...pagina);

    if (pagina.length < tamanoPagina) {
      break;
    }

    desde += tamanoPagina;
  }

  const usuarios = [...new Set(filas.map((fila) => fila.usuario_id))];

  const mapa = new Map<string, UsuarioDesignado>();

  for (let i = 0; i < usuarios.length; i += 200) {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select(CAMPOS_USUARIO)
      .in("id", usuarios.slice(i, i + 200));

    if (error) {
      throw error;
    }

    for (const usuario of (data ?? []) as UsuarioDesignado[]) {
      mapa.set(usuario.id, usuario);
    }
  }

  return filas.map((fila) => {
    const usuario = mapa.get(fila.usuario_id) ?? null;

    return {
      ...fila,

      usuario: usuario
        ? {
            id: usuario.id,
            nombre: usuario.nombre,
            apellido1: usuario.apellido1,
            apellido2: usuario.apellido2,
            email: usuario.email,
            activa: usuario.activa,
            rol: usuario.rol,
          }
        : null,
    };
  });
}

// ============================================================
// DESIGNACIONES ACTIVAS POR USUARIO
// ============================================================

export async function obtenerDesignacionesActivasUsuario(
  partidoIDEntrada: string,
  usuarioIDEntrada: string,
): Promise<DesignacionActa[]> {
  const partidoID = validarID(partidoIDEntrada, "partit");

  const usuarioID = validarID(usuarioIDEntrada, "usuari");

  const { data, error } = await supabaseAdmin
    .from("acta_designaciones")
    .select(CAMPOS_DESIGNACION)
    .eq("partido_id", partidoID)
    .eq("usuario_id", usuarioID)
    .is("revocada_at", null);

  if (error) {
    throw error;
  }

  return (data ?? []) as DesignacionActa[];
}

// ============================================================
// ASIGNAR DESIGNACION
// ============================================================

export async function asignarDesignacion(
  contexto: ContextoDesignaciones,
  usuarioIDEntrada: string,
  funcionEntrada: unknown,
): Promise<ResultadoAsignacion> {
  const ids = await exigirContexto(contexto, "asignar");

  const usuarioID = validarID(usuarioIDEntrada, "usuari");

  const funcion = validarFuncion(funcionEntrada);

  const usuario = await obtenerUsuario(usuarioID);

  await exigirElegibilidad(usuario, ids.torneoID, ids.edicionID);

  // ==========================================================
  // REUTILIZAR UNA DESIGNACION ACTIVA
  // ==========================================================

  const buscarActiva = async (): Promise<DesignacionActa | null> => {
    const { data, error } = await supabaseAdmin
      .from("acta_designaciones")
      .select(CAMPOS_DESIGNACION)
      .eq("partido_id", ids.partidoID)
      .eq("usuario_id", usuarioID)
      .eq("funcion", funcion)
      .is("revocada_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data as DesignacionActa | null;
  };

  const existente = await buscarActiva();

  if (existente) {
    return {
      designacion: existente,
      reutilizada: true,
    };
  }

  // ==========================================================
  // CREAR DESIGNACION
  // ==========================================================

  const { data, error } = await supabaseAdmin
    .from("acta_designaciones")
    .insert({
      partido_id: ids.partidoID,
      usuario_id: usuarioID,
      funcion,
      creada_por: ids.gestorID,
    })
    .select(CAMPOS_DESIGNACION)
    .single();

  if (error) {
    // El índice único parcial de Supabase impide
    // duplicar una función activa para el usuario.
    if (error.code === "23505") {
      const duplicada = await buscarActiva();

      if (duplicada) {
        return {
          designacion: duplicada,
          reutilizada: true,
        };
      }

      throw new ErrorAPI(409, "La designació ha canviat. Torna-ho a provar.");
    }

    throw error;
  }

  const designacion = data as DesignacionActa;

  await registrarAuditoria(
    "DESIGNACION_CREADA",
    ids,
    usuarioID,
    designacion,
    null,
  );

  await notificarCambio(ids.partidoID);

  return {
    designacion,
    reutilizada: false,
  };
}

// ============================================================
// REVOCAR DESIGNACION
// ============================================================

/**
 * La revocación conserva el historial.
 *
 * El gestor no puede revocar la designación
 * de un administrador de su mismo rango o superior.
 *
 * Si el usuario tiene el control del acta,
 * se rechaza la revocación.
 *
 * IMPORTANTE:
 * Esta comprobación y la actualización no forman
 * una transacción única. La API de control del acta
 * deberá validar las designaciones vigentes y la
 * generación de control antes de cada escritura.
 */
export async function revocarDesignacion(
  contexto: ContextoDesignaciones,
  designacionIDEntrada: string,
  motivoEntrada: unknown,
): Promise<DesignacionActa> {
  const ids = await exigirContexto(contexto, "revocar");

  const designacionID = validarID(designacionIDEntrada, "designació");

  const motivo = validarMotivo(motivoEntrada);

  // ==========================================================
  // CONSULTAR DESIGNACION
  // ==========================================================

  const { data, error } = await supabaseAdmin
    .from("acta_designaciones")
    .select(CAMPOS_DESIGNACION)
    .eq("id", designacionID)
    .eq("partido_id", ids.partidoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const anterior = data as DesignacionActa | null;

  if (!anterior) {
    throw new ErrorAPI(404, "No s'ha trobat la designació.");
  }

  if (anterior.revocada_at) {
    return anterior;
  }

  // ==========================================================
  // JERARQUIA
  // ==========================================================

  const destinatario = await obtenerUsuario(anterior.usuario_id, false);

  const nivelGestor = obtenerNivelJerarquicoActa(contexto.gestor, ids.torneoID);

  const nivelObjetivo = obtenerNivelJerarquicoActa(destinatario, ids.torneoID);

  if (nivelObjetivo >= 3 && nivelGestor <= nivelObjetivo) {
    throw new ErrorAPI(
      403,
      "No pots revocar la designació d'un administrador " +
        "del mateix rang o superior.",
    );
  }

  // ==========================================================
  // PROTEGER AL CONTROLADOR ACTIVO
  // ==========================================================

  const { data: acta, error: errorActa } = await supabaseAdmin
    .from("acta_partidos")
    .select("id,controlador_id,control_token,estado_operativo")
    .eq("partido_id", ids.partidoID)
    .maybeSingle();

  if (errorActa) {
    throw errorActa;
  }

  if (acta && mismoID(acta.controlador_id, anterior.usuario_id)) {
    throw new ErrorAPI(
      409,
      "Aquest usuari continua assignat com a controlador. " +
        "Primer ha d'alliberar el control o ser expulsat " +
        "per un administrador autoritzat.",
    );
  }

  // ==========================================================
  // REVOCACION CONDICIONAL
  // ==========================================================

  const cambios = {
    revocada_at: new Date().toISOString(),
    revocada_por: ids.gestorID,
    motivo_revocacion: motivo,
  };

  const { data: actualizada, error: errorActualizar } = await supabaseAdmin
    .from("acta_designaciones")
    .update(cambios)
    .eq("id", designacionID)
    .eq("partido_id", ids.partidoID)
    .is("revocada_at", null)
    .select(CAMPOS_DESIGNACION)
    .maybeSingle();

  if (errorActualizar) {
    throw errorActualizar;
  }

  if (!actualizada) {
    throw new ErrorAPI(
      409,
      "La designació ja ha canviat. Actualitza la pàgina.",
    );
  }

  const resultado = actualizada as DesignacionActa;

  await registrarAuditoria(
    "DESIGNACION_REVOCADA",
    ids,
    anterior.usuario_id,
    resultado,
    anterior,
  );

  await notificarCambio(ids.partidoID);

  return resultado;
}
