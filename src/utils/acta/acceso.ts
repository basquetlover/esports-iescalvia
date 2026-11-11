import {
  obtenerNivelRol,
  obtenerRolEnTorneo,
  tienePermiso,
  type UsuarioPermisos,
} from "@const/Permisos";

import { supabaseAdmin } from "@utils/supabase";

import { ErrorAPI, UUID } from "@utils/inscripcio/equipBase";

// ============================================================
// TIPOS
// ============================================================

export type UsuarioAccesoActa = NonNullable<UsuarioPermisos> & {
  id: string;
};

export type ParametrosAccesoActa = {
  usuario: UsuarioAccesoActa;
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

export type FuncionDesignacion = "ARBITRE" | "OFICIAL_TAULA";

export type EstadoOperativoActa =
  | "DISPONIBLE"
  | "CONTROLADA"
  | "EN_SUPERVISION"
  | "BLOQUEADA"
  | "FINALIZADA"
  | "EN_REVISION";

type EdicionDB = {
  id: string;
  torneo_id: string | null;
};

type PartidoDB = {
  id: string;
  edicion_id: string;
  estado: string;
  finalizado_at: string | null;
};

type ActaDB = {
  id: string;
  partido_id: string;
  estado: string;
  estado_operativo: EstadoOperativoActa;
  controlador_id: string | null;
  control_token: string | null;
  control_generacion: number;
  version: number;
};

type DesignacionDB = {
  id: string;
  funcion: FuncionDesignacion;
};

type BloqueoDB = {
  ambito: "PARTIDO" | "EDICION";
  partido_id: string | null;
  edicion_id: string | null;
  tipo_bloqueo: "CONTROL" | "ACCESO";
};

type RevisionDB = {
  id: string;
};

export type ResultadoAccesoActa = {
  usuarioID: string;
  torneoID: string;
  edicionID: string;
  partidoID: string;
  actaID: string | null;

  designadoArbitro: boolean;
  designadoOficial: boolean;
  voluntarioConfirmado: boolean;

  puedeConsultar: boolean;
  puedeControlar: boolean;
  puedeSolicitarControl: boolean;
  puedeEscribir: boolean;

  puedeSupervisar: boolean;
  puedeExpulsar: boolean;
  puedeBloquear: boolean;
  puedeDesbloquear: boolean;
  puedeTransferirControl: boolean;

  puedeAbrirRevision: boolean;
  puedeAutorizarRevision: boolean;
  puedeRevocarAutorizacion: boolean;
  puedeCerrarRevision: boolean;
  puedeConsultarAuditoria: boolean;

  bloqueadoAcceso: boolean;
  bloqueadoControl: boolean;

  controladorID: string | null;
  esControlador: boolean;
  hayOtroControlador: boolean;

  actaFinalizada: boolean;
  revisionActiva: boolean;
  revisionAutorizada: boolean;
  revisionID: string | null;

  estadoOperativo: EstadoOperativoActa | null;
  generacionControl: number | null;
};

// ============================================================
// CONSTANTES
// ============================================================

const ESTADOS_APROBADOS = ["APROBADO", "ACEPTADO"];

const ESTADOS_CONTROL_ORDINARIO: readonly string[] = [
  "DISPONIBLE",
  "CONTROLADA",
  "EN_SUPERVISION",
];

const ESTADOS_CONTROL_ACTIVO: readonly string[] = [
  "CONTROLADA",
  "EN_SUPERVISION",
  "EN_REVISION",
];

// ============================================================
// IDENTIFICADORES
// ============================================================

function validarID(valor: unknown, nombre: string): string {
  if (typeof valor !== "string" || !UUID.test(valor.trim())) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return valor.trim().toLowerCase();
}

function mismoID(
  primero: string | null | undefined,
  segundo: string | null | undefined,
): boolean {
  return (
    typeof primero === "string" &&
    typeof segundo === "string" &&
    primero.toLowerCase() === segundo.toLowerCase()
  );
}

// ============================================================
// JERARQUÍA ADMINISTRATIVA
// ============================================================

/**
 * La jerarquia considera el rol general y el rol
 * efectivo del torneig.
 *
 * Si una persona tiene un rol general superior,
 * no se le rebaja el rango para decidir si otro
 * administrador puede expulsarla.
 *
 * La jerarquia por si sola NO concede permisos.
 */
export function obtenerNivelJerarquicoActa(
  usuario: UsuarioAccesoActa,
  torneoID: string,
): number {
  const nivelGeneral = obtenerNivelRol(usuario.rol);

  const rolTorneo = obtenerRolEnTorneo(usuario, torneoID);

  const nivelTorneo = obtenerNivelRol(rolTorneo);

  return Math.max(nivelGeneral, nivelTorneo);
}

/**
 * Un administrador solo puede expulsar a otro
 * controlador cuando:
 *
 * - tiene el permiso especifico de expulsar;
 * - tiene acceso al torneo;
 * - es una cuenta activa;
 * - no intenta expulsarse a si mismo;
 * - su rango es estrictamente superior.
 *
 * El controlador puede ser otro administrador,
 * un miembro de Staff o un voluntario.
 *
 * Esta funcion comprueba la jerarquia.
 * La API tambien debe verificar que el objetivo
 * sigue controlando el acta en ese instante.
 */
export function puedeExpulsarPorJerarquia(
  solicitante: UsuarioAccesoActa,
  objetivo: UsuarioAccesoActa,
  torneoID: string,
): boolean {
  if (
    solicitante.activa !== true ||
    !UUID.test(solicitante.id) ||
    !UUID.test(objetivo.id) ||
    !UUID.test(torneoID)
  ) {
    return false;
  }

  if (mismoID(solicitante.id, objetivo.id)) {
    return false;
  }

  if (!tienePermiso(solicitante, "acta-digital", "expulsar", torneoID)) {
    return false;
  }

  const nivelSolicitante = obtenerNivelJerarquicoActa(solicitante, torneoID);

  const nivelObjetivo = obtenerNivelJerarquicoActa(objetivo, torneoID);

  return nivelSolicitante >= 3 && nivelSolicitante > nivelObjetivo;
}

// ============================================================
// VOLUNTARIOS CONFIRMADOS
// ============================================================

/**
 * Comprueba los requisitos ya utilizados por el
 * sistema de voluntariado:
 *
 * - formulario de voluntario aceptado;
 * - validacion aprobada;
 * - plaza confirmada;
 * - formulario vinculado a la edicion.
 *
 * No se considera suficiente tener un formulario
 * pendiente o una plaza sin confirmar.
 */
export async function esVoluntarioHabilitadoActa(
  usuarioID: string,
  torneoID: string,
  edicionID: string,
): Promise<boolean> {
  if (!UUID.test(usuarioID) || !UUID.test(torneoID) || !UUID.test(edicionID)) {
    return false;
  }

  const { data: edicion, error: errorEdicion } = await supabaseAdmin
    .from("ediciones")
    .select("torneo_id")
    .eq("id", edicionID)
    .maybeSingle();

  if (errorEdicion) {
    throw errorEdicion;
  }

  if (!mismoID(edicion?.torneo_id, torneoID)) {
    return false;
  }

  const { data: formularios, error: errorFormularios } = await supabaseAdmin
    .from("formularios")
    .select("id")
    .eq("edicion_id", edicionID)
    .eq("usuario_id", usuarioID)
    .eq("tipo", "VOLUNTARIO")
    .in("estado", ESTADOS_APROBADOS);

  if (errorFormularios) {
    throw errorFormularios;
  }

  if (!formularios?.length) {
    return false;
  }

  const { data: voluntario, error: errorVoluntario } = await supabaseAdmin
    .from("voluntarios")
    .select("id")
    .in(
      "formulario_id",
      formularios.map((formulario) => formulario.id),
    )
    .in("validacion_estado", ESTADOS_APROBADOS)
    .eq("plaza_estado", "CONFIRMADA")
    .limit(1)
    .maybeSingle();

  if (errorVoluntario) {
    throw errorVoluntario;
  }

  return Boolean(voluntario);
}

// ============================================================
// VALIDACIÓN DE UNA INSTANTÁNEA DE CONTROL
// ============================================================

/**
 * Esta comprobacion sirve para validar una
 * instantanea de la base de datos.
 *
 * Se exige:
 *
 * - identificador del controlador;
 * - token de control correcto;
 * - misma generacion de control;
 * - estado operativo compatible.
 *
 * IMPORTANTE:
 * Esto NO sustituye la validacion transaccional.
 *
 * El cambio de controlador y cada escritura deben
 * comprobarse dentro de una operacion atomica de BD.
 * Una lectura anterior nunca garantiza que el control
 * siga vigente cuando se guarda una jugada.
 */
export function coincideControlEnInstantanea(
  acta: {
    controlador_id: string | null;
    control_token: string | null;
    control_generacion: number;
    estado_operativo: string;
  },
  usuarioID: string,
  token: string,
  generacion: number,
): boolean {
  if (
    !UUID.test(usuarioID) ||
    !UUID.test(token) ||
    !Number.isSafeInteger(generacion) ||
    generacion < 0
  ) {
    return false;
  }

  return (
    mismoID(acta.controlador_id, usuarioID) &&
    mismoID(acta.control_token, token) &&
    acta.control_generacion === generacion &&
    ESTADOS_CONTROL_ACTIVO.includes(acta.estado_operativo)
  );
}

// ============================================================
// CONSULTAR ACCESO AL ACTA
// ============================================================

/**
 * Funcion central para las futuras APIs.
 *
 * La funcion:
 *
 * 1. Verifica torneo, edicion y partido.
 * 2. Consulta designaciones activas.
 * 3. Comprueba elegibilidad del voluntario.
 * 4. Consulta bloqueos individuales.
 * 5. Comprueba revision y autorizacion individual.
 * 6. Determina permisos administrativos.
 * 7. Calcula quien puede solicitar el control.
 *
 * No escribe datos ni concede el control.
 *
 * Todas las operaciones que modifican el estado
 * deben volver a comprobarlo atomicamente en BD.
 */
export async function obtenerAccesoActa(
  parametros: ParametrosAccesoActa,
): Promise<ResultadoAccesoActa> {
  const { usuario } = parametros;

  const usuarioID = validarID(usuario.id, "usuari");

  const torneoID = validarID(parametros.torneoID, "torneig");

  const edicionID = validarID(parametros.edicionID, "edició");

  const partidoID = validarID(parametros.partidoID, "partit");

  if (usuario.activa !== true) {
    throw new ErrorAPI(403, "Aquest compte no està actiu.");
  }

  // ==========================================================
  // DATOS EXISTENTES
  // ==========================================================

  const [
    respuestaEdicion,
    respuestaPartido,
    respuestaActa,
    respuestaDesignaciones,
    respuestaBloqueos,
  ] = await Promise.all([
    supabaseAdmin
      .from("ediciones")
      .select("id,torneo_id")
      .eq("id", edicionID)
      .maybeSingle(),

    supabaseAdmin
      .from("competicion_partidos")
      .select("id,edicion_id,estado,finalizado_at")
      .eq("id", partidoID)
      .eq("edicion_id", edicionID)
      .maybeSingle(),

    supabaseAdmin
      .from("acta_partidos")
      .select(
        "id,partido_id,estado,estado_operativo," +
          "controlador_id,control_token," +
          "control_generacion,version",
      )
      .eq("partido_id", partidoID)
      .maybeSingle(),

    supabaseAdmin
      .from("acta_designaciones")
      .select("id,funcion")
      .eq("partido_id", partidoID)
      .eq("usuario_id", usuarioID)
      .is("revocada_at", null),

    supabaseAdmin
      .from("acta_bloqueos")
      .select("ambito,partido_id,edicion_id,tipo_bloqueo")
      .eq("usuario_id", usuarioID)
      .is("revocado_at", null),
  ]);

  if (respuestaEdicion.error) {
    throw respuestaEdicion.error;
  }

  if (respuestaPartido.error) {
    throw respuestaPartido.error;
  }

  if (respuestaActa.error) {
    throw respuestaActa.error;
  }

  if (respuestaDesignaciones.error) {
    throw respuestaDesignaciones.error;
  }

  if (respuestaBloqueos.error) {
    throw respuestaBloqueos.error;
  }

  const edicion = respuestaEdicion.data as EdicionDB | null;

  const partido = respuestaPartido.data as PartidoDB | null;

  const acta = respuestaActa.data as ActaDB | null;

  if (!edicion || !mismoID(edicion.torneo_id, torneoID)) {
    throw new ErrorAPI(404, "No s'ha trobat l'edició dins aquest torneig.");
  }

  if (!partido || !mismoID(partido.edicion_id, edicionID)) {
    throw new ErrorAPI(404, "No s'ha trobat el partit dins aquesta edició.");
  }

  if (acta && !mismoID(acta.partido_id, partidoID)) {
    throw new ErrorAPI(409, "L'acta no correspon al partit.");
  }

  // ==========================================================
  // PERMISOS ADMINISTRATIVOS
  // ==========================================================

  const permiso = (accion: string): boolean =>
    tienePermiso(usuario, "acta-digital", accion, torneoID);

  const puedeVerAdministrativamente = permiso("ver");

  const puedeEditarAdministrativamente =
    permiso("editar") && permiso("controlar");

  // ==========================================================
  // DESIGNACIONES ACTIVAS
  // ==========================================================

  const designaciones = (respuestaDesignaciones.data ?? []) as DesignacionDB[];

  const tieneDesignacionArbitro = designaciones.some(
    (designacion) => designacion.funcion === "ARBITRE",
  );

  const tieneDesignacionOficial = designaciones.some(
    (designacion) => designacion.funcion === "OFICIAL_TAULA",
  );

  const tieneAlgunaDesignacion =
    tieneDesignacionArbitro || tieneDesignacionOficial;

  /**
   * Los administradores habilitados por los permisos
   * del torneo pueden actuar independientemente
   * de la confirmacion como voluntarios.
   *
   * Los usuarios que acceden exclusivamente mediante
   * designacion necesitan cumplir los requisitos
   * del voluntariado.
   */
  const voluntarioConfirmado = tieneAlgunaDesignacion
    ? await esVoluntarioHabilitadoActa(usuarioID, torneoID, edicionID)
    : false;

  const designadoArbitro = tieneDesignacionArbitro && voluntarioConfirmado;

  const designadoOficial = tieneDesignacionOficial && voluntarioConfirmado;

  // ==========================================================
  // BLOQUEOS
  // ==========================================================

  const bloqueos = (respuestaBloqueos.data ?? []) as BloqueoDB[];

  const bloqueosAplicables = bloqueos.filter(
    (bloqueo) =>
      (bloqueo.ambito === "PARTIDO" &&
        mismoID(bloqueo.partido_id, partidoID)) ||
      (bloqueo.ambito === "EDICION" && mismoID(bloqueo.edicion_id, edicionID)),
  );

  const bloqueadoAcceso = bloqueosAplicables.some(
    (bloqueo) => bloqueo.tipo_bloqueo === "ACCESO",
  );

  const bloqueadoControl =
    bloqueadoAcceso ||
    bloqueosAplicables.some((bloqueo) => bloqueo.tipo_bloqueo === "CONTROL");

  // ==========================================================
  // CONSULTA
  // ==========================================================

  const puedeConsultar =
    !bloqueadoAcceso &&
    (puedeVerAdministrativamente || designadoArbitro || designadoOficial);

  // ==========================================================
  // REVISION EXCEPCIONAL
  // ==========================================================

  let revision: RevisionDB | null = null;
  let revisionAutorizada = false;

  if (acta) {
    const { data, error } = await supabaseAdmin
      .from("acta_revisiones")
      .select("id")
      .eq("acta_id", acta.id)
      .is("cerrada_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    revision = data as RevisionDB | null;

    if (revision) {
      const { data: autorizacion, error: errorAutorizacion } =
        await supabaseAdmin
          .from("acta_revision_autorizaciones")
          .select("id")
          .eq("revision_id", revision.id)
          .eq("usuario_id", usuarioID)
          .is("revocada_at", null)
          .maybeSingle();

      if (errorAutorizacion) {
        throw errorAutorizacion;
      }

      revisionAutorizada = Boolean(autorizacion);
    }
  }

  const actaFinalizada = Boolean(
    partido.estado === "FINALIZADO" ||
    partido.finalizado_at ||
    acta?.estado === "FINALIZADA" ||
    acta?.estado_operativo === "FINALIZADA",
  );

  const revisionActiva = Boolean(
    revision && acta?.estado_operativo === "EN_REVISION",
  );

  // ==========================================================
  // DERECHO A CONTROLAR
  // ==========================================================

  /**
   * Un arbitro designado solo tiene derecho a leer.
   *
   * Un oficial de mesa confirmado puede controlar.
   *
   * Si el usuario tambien posee permisos de
   * administracion, estos se valoran por separado.
   */
  const habilitadoControlOrdinario =
    puedeConsultar &&
    !bloqueadoControl &&
    (puedeEditarAdministrativamente || designadoOficial);

  /**
   * Las revisiones excepcionales estan restringidas
   * a usuarios autorizados individualmente que
   * tambien poseen el permiso de revision.
   *
   * La autenticacion con contraseña y la apertura
   * efectiva de la revision corresponden a la API.
   */
  const habilitadoControlRevision =
    puedeConsultar &&
    !bloqueadoControl &&
    revisionActiva &&
    revisionAutorizada &&
    permiso("revisar");

  const estadoOperativo = acta?.estado_operativo ?? null;

  const partidoCancelado = partido.estado === "CANCELADO";

  const estadoOrdinarioPermitido =
    !partidoCancelado &&
    !actaFinalizada &&
    (!acta ||
      (acta.estado !== "BLOQUEADA" &&
        ESTADOS_CONTROL_ORDINARIO.includes(acta.estado_operativo)));

  const puedeControlar =
    (habilitadoControlOrdinario && estadoOrdinarioPermitido) ||
    habilitadoControlRevision;

  // ==========================================================
  // CONTROLADOR EXCLUSIVO
  // ==========================================================

  const controladorID = acta?.controlador_id ?? null;

  const esControlador = Boolean(
    controladorID && mismoID(controladorID, usuarioID),
  );

  const hayOtroControlador = Boolean(
    controladorID && !mismoID(controladorID, usuarioID),
  );

  /**
   * Si otra persona controla el acta:
   *
   * - no se permite reclamar el control directamente;
   * - tampoco se permite escribir;
   * - el administrador autorizado debe tramitar
   *   primero la transferencia o expulsion.
   */
  const puedeSolicitarControl = puedeControlar && !hayOtroControlador;

  /**
   * PuedeEscribir es un indicador de estado,
   * no una autorizacion transaccional definitiva.
   *
   * La API debe comprobar el token, la generacion,
   * el usuario y los bloqueos DENTRO de la misma
   * transaccion que inserta o modifica eventos.
   */
  const estadoActivoControl = Boolean(
    acta && ESTADOS_CONTROL_ACTIVO.includes(acta.estado_operativo),
  );

  const puedeEscribir =
    puedeControlar &&
    esControlador &&
    estadoActivoControl &&
    Boolean(acta?.control_token);

  // ==========================================================
  // SUPERVISION Y ACCIONES ADMINISTRATIVAS
  // ==========================================================

  const puedeSupervisar = puedeConsultar && permiso("supervisar");

  const puedeExpulsar = puedeConsultar && permiso("expulsar");

  const puedeBloquear = puedeConsultar && permiso("bloquear");

  const puedeDesbloquear = puedeConsultar && permiso("desbloquear");

  const puedeTransferirControl =
    puedeConsultar && permiso("transferir-control");

  const puedeAbrirRevision =
    puedeConsultar && actaFinalizada && !revision && permiso("revisar");

  const puedeAutorizarRevision =
    puedeConsultar && revisionActiva && permiso("autorizar-revision");

  const puedeRevocarAutorizacion =
    puedeConsultar && revisionActiva && permiso("revocar-autorizacion");

  const puedeCerrarRevision =
    puedeConsultar && revisionActiva && permiso("cerrar-revision");

  const puedeConsultarAuditoria = puedeConsultar && permiso("ver-auditoria");

  return {
    usuarioID,
    torneoID,
    edicionID,
    partidoID,
    actaID: acta?.id ?? null,

    designadoArbitro,
    designadoOficial,
    voluntarioConfirmado,

    puedeConsultar,
    puedeControlar,
    puedeSolicitarControl,
    puedeEscribir,

    puedeSupervisar,
    puedeExpulsar,
    puedeBloquear,
    puedeDesbloquear,
    puedeTransferirControl,

    puedeAbrirRevision,
    puedeAutorizarRevision,
    puedeRevocarAutorizacion,
    puedeCerrarRevision,
    puedeConsultarAuditoria,

    bloqueadoAcceso,
    bloqueadoControl,

    controladorID,
    esControlador,
    hayOtroControlador,

    actaFinalizada,
    revisionActiva,
    revisionAutorizada,
    revisionID: revision?.id ?? null,

    estadoOperativo,
    generacionControl: acta?.control_generacion ?? null,
  };
}

// ============================================================
// VERIFICAR EXPULSION DEL CONTROLADOR ACTUAL
// ============================================================

/**
 * Comprueba que el objetivo sigue siendo el controlador
 * que figura en el acta y que el solicitante tiene un
 * rango estrictamente superior.
 *
 * No modifica datos.
 *
 * La API de expulsion debe repetir estas condiciones
 * en una transaccion atomica antes de revocar el token.
 */
export async function puedeExpulsarControladorActa(
  parametros: ParametrosAccesoActa,
  objetivoIDEntrada: string,
): Promise<boolean> {
  const objetivoID = validarID(objetivoIDEntrada, "controlador");

  const acceso = await obtenerAccesoActa(parametros);

  if (
    !acceso.puedeExpulsar ||
    !acceso.actaID ||
    !acceso.controladorID ||
    !mismoID(acceso.controladorID, objetivoID)
  ) {
    return false;
  }

  if (mismoID(parametros.usuario.id, objetivoID)) {
    return false;
  }

  const { data: objetivo, error } = await supabaseAdmin
    .from("users")
    .select("id,rol,permisos,activa")
    .eq("id", objetivoID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!objetivo) {
    return false;
  }

  return puedeExpulsarPorJerarquia(
    parametros.usuario,
    objetivo as UsuarioAccesoActa,
    acceso.torneoID,
  );
}
