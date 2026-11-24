import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";

import {
  comprobarOrigen,
  comprobarDuplicadosEdicion,
  exigirUsuario,
  leerJSON,
  necesitaCurso,
  obtenerConfiguracionEdicion,
  validarEmails,
  validarEmailsRepetidos,
  validarEnvio,
  validarEstructuraParticipantes,
  type DatosEntrada,
  type EquipoDB,
  type ParticipanteDB,
} from "@utils/inscripcio/equipBase";

import { guardarEscudoEquipo } from "@utils/inscripcio/equipStorage";

import {
  CAMPOS_EQUIPO,
  CAMPOS_FORMULARIO,
  CAMPOS_PARTICIPANTE,
  ESTADOS_PLAZA,
  ErrorAPI,
  esRegistro,
  esFormularioArchivado,
  exigirPermisoEquip,
  leerIDAdmin,
  leerTextoAdmin,
  nombreCompleto,
  normalizarEmail,
  normalizarEstadoFormulario,
  normalizarEstadoPlaza,
  normalizarOrigenFormulario,
  normalizarTipoParticipante,
  normalizarValidacion,
  obtenerCapacidades,
  obtenerCapacidadesEquipo,
  obtenerDatosArchivo,
  obtenerEstadoFormularioVisible,
  obtenerConfiguracionPlataformaAdmin,
  obtenerEdicionAdmin,
  obtenerTorneoAdmin,
  resolverResponsableAdmin,
  responder,
  responderErrorAdmin,
  validarEmailResponsable,
  type DatosEdicionAdmin,
  type EstadoPlaza,
  type FormularioAdminDB,
  type Registro,
  type Usuario,
  type CapacidadesEquipoAdmin,
} from "@utils/panell/equips/adminComun";

import { leerDatosEdicionAdmin } from "@utils/panell/equips/adminEdicion";

// ============================================================
// CONSTANTES
// ============================================================

const ESTADOS_CREACION = ["BORRADOR", "APROBADO"] as const;

const VISTAS_LISTADO = ["lista", "crear", "archivados"] as const;

// ============================================================
// TIPOS
// ============================================================

type EstadoCreacion = (typeof ESTADOS_CREACION)[number];

type VistaListado = (typeof VISTAS_LISTADO)[number];

type ResponsableListaDB = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  activa: boolean | null;
};

type DatosCreacionAdmin = DatosEdicionAdmin & {
  estado: EstadoCreacion;

  plaza: {
    estado: EstadoPlaza;
    posicion_lista_espera: number | null;
  };
};

type ParticipanteNuevo = {
  id: string;

  tipo_participante: DatosEdicionAdmin["participantes"][number]["tipo_participante"];

  nombre: string;
  apellido1: string;
  apellido2: string;
  email: string;
  curso: string;
  grupo: string;

  genero: DatosEdicionAdmin["participantes"][number]["genero"];

  orden: number;
};

type CapacidadesFila = Pick<
  CapacidadesEquipoAdmin,
  "editar" | "evaluar" | "cambiarEstado" | "archivar" | "eliminar"
>;

// ============================================================
// CONFIGURACIÓN EDICIÓN
// ============================================================

async function exigirConfiguracionEdicion(edicionID: string) {
  const configuracion = await obtenerConfiguracionEdicion(edicionID);

  if (!configuracion) {
    throw new ErrorAPI(
      409,
      "Aquesta edició no té configurada la inscripció d'equips.",
    );
  }

  return configuracion;
}

// ============================================================
// LISTADO · FORMULARIOS
// ============================================================
//
// Se recuperan todos los formularios de equipos.
//
// Los formularios archivados se separan posteriormente
// para conservar su información histórica y excluirlos
// de los recuentos de inscripciones activas.
// ============================================================

async function obtenerFormulariosLista(
  edicionID: string,
): Promise<FormularioAdminDB[]> {
  const resultados: FormularioAdminDB[] = [];

  const TAMANO_PAGINA = 500;

  let desde = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("formularios")
      .select(CAMPOS_FORMULARIO)
      .eq("edicion_id", edicionID)
      .eq("tipo", "EQUIPO")
      .order("created_at", {
        ascending: false,
        nullsFirst: false,
      })
      .order("id", {
        ascending: true,
      })
      .range(desde, desde + TAMANO_PAGINA - 1);

    if (error) {
      throw error;
    }

    const filas = (data ?? []) as FormularioAdminDB[];

    resultados.push(...filas);

    if (filas.length < TAMANO_PAGINA) {
      break;
    }

    desde += TAMANO_PAGINA;
  }

  return resultados;
}

// ============================================================
// LISTADO · EQUIPOS
// ============================================================

async function obtenerEquiposLista(
  idsFormularios: string[],
): Promise<EquipoDB[]> {
  if (idsFormularios.length === 0) {
    return [];
  }

  const resultados: EquipoDB[] = [];

  const TAMANO_BLOQUE = 100;

  const TAMANO_PAGINA = 500;

  for (
    let inicio = 0;
    inicio < idsFormularios.length;
    inicio += TAMANO_BLOQUE
  ) {
    const bloque = idsFormularios.slice(inicio, inicio + TAMANO_BLOQUE);

    let desde = 0;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from("equipos")
        .select(CAMPOS_EQUIPO)
        .in("formulario_id", bloque)
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("id", {
          ascending: true,
        })
        .range(desde, desde + TAMANO_PAGINA - 1);

      if (error) {
        throw error;
      }

      const filas = (data ?? []) as EquipoDB[];

      resultados.push(...filas);

      if (filas.length < TAMANO_PAGINA) {
        break;
      }

      desde += TAMANO_PAGINA;
    }
  }

  return resultados;
}

// ============================================================
// LISTADO · PARTICIPANTES
// ============================================================
//
// Se mantienen los participantes de los equipos archivados
// para consultar su composición histórica.
//
// La exclusión de los archivados se realiza al construir
// los resúmenes, no modificando participantes_equipo.activo.
// ============================================================

async function obtenerParticipantesLista(
  idsEquipos: string[],
): Promise<ParticipanteDB[]> {
  if (idsEquipos.length === 0) {
    return [];
  }

  const resultados: ParticipanteDB[] = [];

  const TAMANO_BLOQUE = 100;

  const TAMANO_PAGINA = 500;

  for (let inicio = 0; inicio < idsEquipos.length; inicio += TAMANO_BLOQUE) {
    const bloque = idsEquipos.slice(inicio, inicio + TAMANO_BLOQUE);

    let desde = 0;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from("participantes_equipo")
        .select(CAMPOS_PARTICIPANTE)
        .in("equipo_id", bloque)
        .eq("activo", true)
        .order("orden", {
          ascending: true,
          nullsFirst: false,
        })
        .order("id", {
          ascending: true,
        })
        .range(desde, desde + TAMANO_PAGINA - 1);

      if (error) {
        throw error;
      }

      const filas = (data ?? []) as ParticipanteDB[];

      resultados.push(...filas);

      if (filas.length < TAMANO_PAGINA) {
        break;
      }

      desde += TAMANO_PAGINA;
    }
  }

  return resultados;
}

// ============================================================
// LISTADO · RESPONSABLES
// ============================================================

async function obtenerResponsablesLista(
  idsUsuarios: string[],
): Promise<ResponsableListaDB[]> {
  if (idsUsuarios.length === 0) {
    return [];
  }

  const resultados: ResponsableListaDB[] = [];

  const TAMANO_BLOQUE = 100;

  for (let inicio = 0; inicio < idsUsuarios.length; inicio += TAMANO_BLOQUE) {
    const bloque = idsUsuarios.slice(inicio, inicio + TAMANO_BLOQUE);

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,nombre,apellido1,apellido2,email,activa")
      .in("id", bloque);

    if (error) {
      throw error;
    }

    resultados.push(...((data ?? []) as ResponsableListaDB[]));
  }

  return resultados;
}

// ============================================================
// PREPARAR FILA
// ============================================================

function prepararFila({
  formulario,
  equipo,
  participantes,
  responsable,
  capacidades,
}: {
  formulario: FormularioAdminDB;

  equipo: EquipoDB | null;

  participantes: ParticipanteDB[];

  responsable: ResponsableListaDB | null;

  capacidades: CapacidadesFila;
}) {
  // ========================================================
  // ARCHIVO
  // ========================================================

  const archivo = obtenerDatosArchivo(formulario);

  const archivado = archivo.archivado;

  const estadoFormulario = normalizarEstadoFormulario(formulario.estado);

  const estadoVisible = obtenerEstadoFormularioVisible(formulario);

  const estadoPlaza = normalizarEstadoPlaza(equipo?.plaza_estado ?? null);

  // ========================================================
  // PARTICIPANTES
  // ========================================================

  const jugadores = participantes.filter(
    (participante) =>
      normalizarTipoParticipante(participante.tipo_participante) === "JUGADOR",
  );

  const profesores = participantes.filter(
    (participante) =>
      normalizarTipoParticipante(participante.tipo_participante) === "PROFESOR",
  );

  const entrenadores = participantes.filter(
    (participante) =>
      normalizarTipoParticipante(participante.tipo_participante) ===
      "ENTRENADOR",
  );

  const staff = participantes.filter(
    (participante) =>
      normalizarTipoParticipante(participante.tipo_participante) === "STAFF",
  );

  // ========================================================
  // CAPITÁN
  // ========================================================

  const capitan = equipo?.capitan_id
    ? (participantes.find(
        (participante) => participante.id === equipo.capitan_id,
      ) ?? null)
    : null;

  // ========================================================
  // PLAZA ACTIVA
  // ========================================================
  //
  // Los equipos archivados conservan su plaza histórica,
  // pero no ocupan una plaza activa de inscripción.
  // ========================================================

  const plazaActiva =
    !archivado &&
    estadoFormulario !== "BORRADOR" &&
    estadoPlaza === "CONFIRMADA";

  // ========================================================
  // CAPACIDADES
  // ========================================================

  const capacidadesFila: CapacidadesFila = {
    editar: Boolean(equipo) && capacidades.editar && !archivado,

    evaluar: Boolean(equipo) && capacidades.evaluar && !archivado,

    cambiarEstado:
      Boolean(equipo) &&
      capacidades.cambiarEstado &&
      !archivado &&
      estadoFormulario !== "BORRADOR",

    archivar: Boolean(equipo) && capacidades.archivar && !archivado,

    eliminar:
      Boolean(equipo) &&
      capacidades.eliminar &&
      !archivado &&
      estadoFormulario === "BORRADOR",
  };

  // ========================================================
  // RESPUESTA
  // ========================================================

  return {
    id: equipo?.id ?? null,

    formulario_id: formulario.id,

    nombre: equipo?.nombre ?? "",

    escudo: equipo?.escudo ?? null,

    validacion_estado: normalizarValidacion(equipo?.validacion_estado ?? null),

    plaza_estado: estadoPlaza,

    plaza_activa: plazaActiva,

    posicion_lista_espera: equipo?.posicion_lista_espera ?? null,

    nota_admin: equipo?.nota_admin ?? null,

    archivado,

    archivado_at: archivo.archivado_at,

    created_at: equipo?.created_at ?? formulario.created_at,

    updated_at: archivado
      ? (archivo.archivado_at ?? formulario.updated_at)
      : (equipo?.updated_at ?? formulario.updated_at),

    // ====================================================
    // FORMULARIO
    // ====================================================

    formulario: {
      id: formulario.id,

      estado: estadoFormulario,

      estado_visible: estadoVisible,

      origen: normalizarOrigenFormulario(formulario.origen),

      usuario_id: formulario.usuario_id,

      email_contacto: formulario.email_contacto ?? "",

      acceso_capitan: formulario.acceso_capitan === true,

      iniciado_at: formulario.iniciado_at,

      enviado_at: formulario.enviado_at,

      completado_at: formulario.completado_at,

      created_at: formulario.created_at,

      updated_at: formulario.updated_at,

      archivado,

      archivado_at: archivo.archivado_at,

      archivado_por: archivo.archivado_por,

      estado_previo_archivado: archivo.estado_previo_archivado,

      motivo_archivado: archivo.motivo_archivado,
    },

    // ====================================================
    // DATOS DE ARCHIVO
    // ====================================================

    archivo,

    // ====================================================
    // RESPONSABLE
    // ====================================================

    responsable: responsable
      ? {
          id: responsable.id,

          nombre: responsable.nombre,

          apellido1: responsable.apellido1,

          apellido2: responsable.apellido2,

          nombre_completo: nombreCompleto(responsable),

          email: responsable.email,
        }
      : formulario.email_contacto
        ? {
            id: null,

            nombre: null,

            apellido1: null,

            apellido2: null,

            nombre_completo: "",

            email: formulario.email_contacto,
          }
        : null,

    // ====================================================
    // PARTICIPANTES
    // ====================================================

    participantes: {
      total: participantes.length,

      jugadores: jugadores.length,

      profesores: profesores.length,

      entrenadores: entrenadores.length,

      staff: staff.length,

      capitan: capitan
        ? {
            id: capitan.id,

            nombre: capitan.nombre,

            apellido1: capitan.apellido1,

            apellido2: capitan.apellido2,

            nombre_completo: nombreCompleto(capitan),

            email: capitan.email,

            curso: capitan.curso,

            grupo: capitan.grupo,
          }
        : null,
    },

    capacidades: capacidadesFila,
  };
}

// ============================================================
// RESUMEN
// ============================================================
//
// Se separan tres tipos de inscripción:
//
// - Enviadas y no archivadas.
// - Borradores no archivados.
// - Archivadas.
//
// Los equipos archivados no se contabilizan en las
// estadísticas activas, participantes ni plazas.
// ============================================================

function construirResumen(filas: ReturnType<typeof prepararFila>[]) {
  // ========================================================
  // ARCHIVADAS
  // ========================================================

  const archivadas = filas.filter((fila) => fila.archivado);

  // ========================================================
  // ACTIVAS
  // ========================================================

  const activas = filas.filter((fila) => !fila.archivado);

  // ========================================================
  // BORRADORES
  // ========================================================

  const borradores = activas.filter(
    (fila) => fila.formulario.estado === "BORRADOR",
  );

  // ========================================================
  // ENVIADAS
  // ========================================================

  const enviadas = activas.filter(
    (fila) => fila.formulario.estado !== "BORRADOR",
  );

  return {
    // ====================================================
    // CONTADORES GENERALES
    // ====================================================

    total: enviadas.length,

    borradores: borradores.length,

    archivadas: archivadas.length,

    archivados: archivadas.length,

    totalRegistros: filas.length,

    totalActivas: activas.length,

    // ====================================================
    // PARTICIPANTES ACTIVOS
    // ====================================================

    participantes: enviadas.reduce(
      (total, fila) => total + fila.participantes.total,
      0,
    ),

    // ====================================================
    // PARTICIPANTES HISTÓRICOS
    // ====================================================

    participantesArchivados: archivadas.reduce(
      (total, fila) => total + fila.participantes.total,
      0,
    ),

    // ====================================================
    // ESTADOS DE EVALUACIÓN
    // ====================================================

    enRevision: enviadas.filter(
      (fila) => fila.formulario.estado === "EN_REVISION",
    ).length,

    aprobadas: enviadas.filter((fila) => fila.formulario.estado === "APROBADO")
      .length,

    denegadas: enviadas.filter((fila) => fila.formulario.estado === "DENEGADO")
      .length,

    // ====================================================
    // PLAZAS
    // ====================================================

    plazas: {
      confirmadas: enviadas.filter((fila) => fila.plaza_estado === "CONFIRMADA")
        .length,

      listaEspera: enviadas.filter(
        (fila) => fila.plaza_estado === "LISTA_ESPERA",
      ).length,

      sinPlaza: enviadas.filter((fila) => fila.plaza_estado === "SIN_PLAZA")
        .length,

      pendientes: enviadas.filter((fila) => fila.plaza_estado === "PENDIENTE")
        .length,
    },
  };
}

// ============================================================
// ORDEN
// ============================================================

function ordenarFilas(filas: ReturnType<typeof prepararFila>[]) {
  return filas.sort((a, b) => {
    const fechaA = Date.parse(a.updated_at ?? a.created_at ?? "");

    const fechaB = Date.parse(b.updated_at ?? b.created_at ?? "");

    const tiempoA = Number.isFinite(fechaA) ? fechaA : 0;

    const tiempoB = Number.isFinite(fechaB) ? fechaB : 0;

    return tiempoB - tiempoA;
  });
}

// ============================================================
// ESTADO CREACIÓN
// ============================================================

function leerEstadoCreacion(valor: unknown): EstadoCreacion {
  const estado = leerTextoAdmin(valor, "estado", 30, true).toUpperCase();

  if (!ESTADOS_CREACION.includes(estado as EstadoCreacion)) {
    throw new ErrorAPI(400, "L'estat inicial de l'equip no és vàlid.");
  }

  return estado as EstadoCreacion;
}

// ============================================================
// PLAZA
// ============================================================

function leerPlazaCreacion(valor: unknown): DatosCreacionAdmin["plaza"] {
  if (valor === undefined || valor === null) {
    return {
      estado: "PENDIENTE",

      posicion_lista_espera: null,
    };
  }

  if (!esRegistro(valor)) {
    throw new ErrorAPI(400, "La configuració de la plaça no és vàlida.");
  }

  const estadoRaw = leerTextoAdmin(
    valor.estado,
    "estat de la plaça",
    50,
    true,
  ).toUpperCase();

  if (!ESTADOS_PLAZA.includes(estadoRaw as EstadoPlaza)) {
    throw new ErrorAPI(400, "L'estat de la plaça no és vàlid.");
  }

  const estado = estadoRaw as EstadoPlaza;

  let posicion: number | null = null;

  if (estado === "LISTA_ESPERA") {
    if (
      typeof valor.posicion_lista_espera !== "number" ||
      !Number.isSafeInteger(valor.posicion_lista_espera) ||
      valor.posicion_lista_espera < 1
    ) {
      throw new ErrorAPI(
        400,
        "Indica una posició vàlida de la llista d'espera.",
      );
    }

    posicion = valor.posicion_lista_espera;
  }

  return {
    estado,

    posicion_lista_espera: posicion,
  };
}

// ============================================================
// DATOS CREACIÓN
// ============================================================

function leerDatosCreacionAdmin(cuerpo: Registro): DatosCreacionAdmin {
  const datos = leerDatosEdicionAdmin(cuerpo);

  if (datos.participantes.some((participante) => participante.id !== null)) {
    throw new ErrorAPI(
      400,
      "No es poden indicar identificadors de participants en crear un equip.",
    );
  }

  return {
    ...datos,

    estado: leerEstadoCreacion(cuerpo.estado),

    plaza: leerPlazaCreacion(cuerpo.plaza),
  };
}

// ============================================================
// EMAILS
// ============================================================

function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarFormatoEmails(datos: DatosCreacionAdmin) {
  if (datos.responsable.email && !emailValido(datos.responsable.email)) {
    throw new ErrorAPI(400, "El correu del responsable no és vàlid.");
  }

  if (datos.equipo.capitan_email && !emailValido(datos.equipo.capitan_email)) {
    throw new ErrorAPI(400, "El correu del capità no és vàlid.");
  }

  for (let indice = 0; indice < datos.participantes.length; indice += 1) {
    const participante = datos.participantes[indice];

    if (participante.email && !emailValido(participante.email)) {
      throw new ErrorAPI(
        400,
        `El correu del participant ${indice + 1} no és vàlid.`,
      );
    }
  }
}

// ============================================================
// DUPLICADOS
// ============================================================
//
// Se utiliza la función centralizada de equipBase.ts.
//
// No reservan participantes:
//
// - Los formularios en borrador.
// - Los formularios archivados.
//
// De esta manera se aplica el mismo criterio en la
// inscripción pública y en la creación administrativa.
// ============================================================

async function comprobarDuplicadosInscritos(
  edicionID: string,
  participantes: DatosCreacionAdmin["participantes"],
  equipoActualID: string | null = null,
) {
  await comprobarDuplicadosEdicion(edicionID, participantes, equipoActualID);
}

// ============================================================
// PARTICIPANTES NUEVOS
// ============================================================

function prepararParticipantesNuevos(
  datos: DatosCreacionAdmin,
): ParticipanteNuevo[] {
  return datos.participantes.map((participante) => ({
    id: randomUUID(),

    tipo_participante: participante.tipo_participante,

    nombre: participante.nombre,

    apellido1: participante.apellido1,

    apellido2: participante.apellido2,

    email: participante.email,

    curso: participante.curso,

    grupo: participante.grupo,

    genero: participante.genero,

    orden: participante.orden,
  }));
}

// ============================================================
// CAPITÁN
// ============================================================

function obtenerCapitanNuevo(
  datos: DatosCreacionAdmin,
  participantes: ParticipanteNuevo[],
) {
  if (!datos.equipo.capitan_email) {
    return null;
  }

  const coincidencias = participantes.filter(
    (participante) =>
      participante.tipo_participante === "JUGADOR" &&
      normalizarEmail(participante.email) === datos.equipo.capitan_email,
  );

  if (coincidencias.length !== 1) {
    throw new ErrorAPI(
      400,
      "El capità seleccionat no correspon a un únic jugador de l'equip.",
    );
  }

  return coincidencias[0];
}

// ============================================================
// DATOS VALIDACIÓN
// ============================================================

function prepararDatosValidacion(
  datos: DatosCreacionAdmin,
  equipoID: string,
  participantes: ParticipanteNuevo[],
  capitanID: string | null,
): DatosEntrada {
  return {
    acceso_capitan: datos.acceso_capitan,

    equipo: {
      id: equipoID,

      nombre: datos.equipo.nombre,

      escudo: datos.equipo.escudo,

      capitan_id: capitanID,
    },

    participantes: participantes.map((participante) => ({
      id: participante.id,

      tipo_participante: participante.tipo_participante,

      nombre: participante.nombre,

      apellido1: participante.apellido1,

      apellido2: participante.apellido2,

      email: participante.email,

      curso: participante.curso,

      grupo: participante.grupo,

      genero: participante.genero,

      orden: participante.orden,
    })),
  };
}

// ============================================================
// VALIDAR CREACIÓN
// ============================================================

async function validarCreacion({
  datos,
  configuracion,
  configuracionPlataforma,
  edicionID,
  datosValidacion,
}: {
  datos: DatosCreacionAdmin;

  configuracion: NonNullable<
    Awaited<ReturnType<typeof obtenerConfiguracionEdicion>>
  >;

  configuracionPlataforma: Awaited<
    ReturnType<typeof obtenerConfiguracionPlataformaAdmin>
  >;

  edicionID: string;

  datosValidacion: DatosEntrada;
}) {
  validarFormatoEmails(datos);

  validarEmailResponsable(datos.responsable.email, configuracionPlataforma);

  validarEmails(datosValidacion.participantes, configuracionPlataforma);

  validarEmailsRepetidos(datosValidacion.participantes);

  validarEstructuraParticipantes(datosValidacion.participantes, configuracion);

  if (datos.estado === "APROBADO") {
    await comprobarDuplicadosInscritos(edicionID, datos.participantes);

    validarEnvio(datosValidacion, configuracion);
  }
}

// ============================================================
// PLAZA INICIAL
// ============================================================

function resolverPlazaInicial({
  datos,
  puedeCambiarEstado,
}: {
  datos: DatosCreacionAdmin;

  puedeCambiarEstado: boolean;
}) {
  if (datos.estado === "BORRADOR") {
    return {
      estado: "PENDIENTE" as const,

      posicion: null,
    };
  }

  if (datos.plaza.estado !== "PENDIENTE" && !puedeCambiarEstado) {
    throw new ErrorAPI(
      403,
      "Pots crear l'equip, però no tens permís per assignar-li una plaça.",
    );
  }

  return {
    estado: datos.plaza.estado,

    posicion:
      datos.plaza.estado === "LISTA_ESPERA"
        ? datos.plaza.posicion_lista_espera
        : null,
  };
}

// ============================================================
// COMPENSACIÓN
// ============================================================
//
// Si una creación falla, se intenta conservar como
// borrador recuperable.
//
// Nunca se modifica un formulario que haya sido archivado
// mientras se realizaba la operación.
// ============================================================

async function dejarCreacionComoBorrador({
  formularioID,
  equipoID,
}: {
  formularioID: string;

  equipoID: string | null;
}) {
  const ahora = new Date().toISOString();

  const { data: formularioActualizado, error: errorFormulario } =
    await supabaseAdmin
      .from("formularios")
      .update({
        estado: "BORRADOR",

        origen: "ADMIN",

        enviado_at: null,

        completado_at: null,

        updated_at: ahora,
      })
      .eq("id", formularioID)
      .eq("tipo", "EQUIPO")
      .is("archivado_at", null)
      .select("id")
      .maybeSingle();

  if (errorFormulario) {
    console.error(
      "No s'ha pogut deixar en esborrany el formulari després d'una creació incompleta:",
      errorFormulario,
    );

    return;
  }

  if (!formularioActualizado || !equipoID) {
    return;
  }

  const { error: errorEquipo } = await supabaseAdmin
    .from("equipos")
    .update({
      validacion_estado: "PENDIENTE",

      plaza_estado: "PENDIENTE",

      posicion_lista_espera: null,

      updated_at: ahora,
    })
    .eq("id", equipoID)
    .eq("formulario_id", formularioID);

  if (errorEquipo) {
    console.error(
      "No s'ha pogut restaurar l'equip a pendent després d'una creació incompleta:",
      errorEquipo,
    );
  }
}

// ============================================================
// LIMPIAR ESCUDO DE UNA CREACIÓN FALLIDA
// ============================================================

async function limpiarEscudoCreacion({
  torneoID,
  edicionID,
  equipoID,
}: {
  torneoID: string;

  edicionID: string;

  equipoID: string;
}) {
  try {
    await guardarEscudoEquipo({
      torneoID,

      edicionID,

      equipoID,

      escudo: null,
    });
  } catch (error) {
    console.error(
      `No s'ha pogut eliminar l'escut de la creació incompleta de l'equip ${equipoID}:`,
      error,
    );
  }
}

// ============================================================
// LEER VISTA
// ============================================================

function leerVista(valor: string | null): VistaListado {
  const vista = valor?.trim().toLowerCase() ?? "lista";

  if (!VISTAS_LISTADO.includes(vista as VistaListado)) {
    throw new ErrorAPI(400, "La vista indicada no és vàlida.");
  }

  return vista as VistaListado;
}

// ============================================================
// GET · LISTADO / PREPARAR CREACIÓN
// ============================================================

export const obtenerListadoEquiposAdmin: APIRoute = async ({
  cookies,
  url,
}) => {
  try {
    // =================================================
    // USUARIO
    // =================================================

    const usuario = await exigirUsuario(cookies);

    // =================================================
    // IDS
    // =================================================

    const torneoID = leerIDAdmin(url.searchParams.get("torneoID"), "torneoID");

    const edicionID = leerIDAdmin(
      url.searchParams.get("edicionID"),
      "edicionID",
    );

    // =================================================
    // VISTA
    // =================================================

    const vista = leerVista(url.searchParams.get("vista"));

    // =================================================
    // PERMISOS
    // =================================================

    exigirPermisoEquip(usuario, torneoID, vista === "crear" ? "crear" : "ver");

    // =================================================
    // TORNEO Y EDICIÓN
    // =================================================

    const [torneo, edicion] = await Promise.all([
      obtenerTorneoAdmin(torneoID),

      obtenerEdicionAdmin(edicionID, torneoID),
    ]);

    // =================================================
    // PREPARAR CREACIÓN
    // =================================================

    if (vista === "crear") {
      const configuracion = await exigirConfiguracionEdicion(edicionID);

      const capacidades = obtenerCapacidades(usuario, torneoID);

      return responder({
        success: true,

        torneo: {
          id: torneo.id,

          nombre: torneo.nombre ?? "Torneig",

          deporte: torneo.deporte,
        },

        edicion: {
          id: edicion.id,

          torneo_id: edicion.torneo_id,

          nombre: edicion.nombre ?? "Edició",

          estado: edicion.estado,

          sede: edicion.sede,

          fecha_inicio: edicion.fecha_inicio,

          fecha_fin: edicion.fecha_fin,
        },

        configuracion,

        capacidades: {
          crear: true,

          cambiarEstado: capacidades.cambiarEstado,
        },
      });
    }

    // =================================================
    // FORMULARIOS
    // =================================================

    const formularios = await obtenerFormulariosLista(edicionID);

    const idsFormularios = formularios.map((formulario) => formulario.id);

    // =================================================
    // EQUIPOS
    // =================================================

    const equipos = await obtenerEquiposLista(idsFormularios);

    const idsEquipos = equipos.map((equipo) => equipo.id);

    // =================================================
    // RESPONSABLES
    // =================================================

    const idsResponsables = [
      ...new Set(
        formularios
          .map((formulario) => formulario.usuario_id)
          .filter((id): id is string => typeof id === "string" && Boolean(id)),
      ),
    ];

    // =================================================
    // PARTICIPANTES Y RESPONSABLES
    // =================================================

    const [participantes, responsables] = await Promise.all([
      obtenerParticipantesLista(idsEquipos),

      obtenerResponsablesLista(idsResponsables),
    ]);

    // =================================================
    // MAPA DE EQUIPOS
    // =================================================

    const equipoPorFormulario = new Map<string, EquipoDB>();

    for (const equipo of equipos) {
      if (!equipoPorFormulario.has(equipo.formulario_id)) {
        equipoPorFormulario.set(equipo.formulario_id, equipo);
      }
    }

    // =================================================
    // MAPA DE PARTICIPANTES
    // =================================================

    const participantesPorEquipo = new Map<string, ParticipanteDB[]>();

    for (const participante of participantes) {
      const actuales = participantesPorEquipo.get(participante.equipo_id) ?? [];

      actuales.push(participante);

      participantesPorEquipo.set(participante.equipo_id, actuales);
    }

    // =================================================
    // MAPA DE RESPONSABLES
    // =================================================

    const responsablePorID = new Map<string, ResponsableListaDB>(
      responsables.map((responsable) => [responsable.id, responsable]),
    );

    // =================================================
    // CAPACIDADES GENERALES
    // =================================================

    const capacidades = obtenerCapacidades(usuario, torneoID);

    // =================================================
    // CONSTRUIR TODAS LAS FILAS
    // =================================================

    const todasLasFilas = ordenarFilas(
      formularios.map((formulario) => {
        const equipo = equipoPorFormulario.get(formulario.id) ?? null;

        const listaParticipantes = equipo
          ? (participantesPorEquipo.get(equipo.id) ?? [])
          : [];

        const responsable = formulario.usuario_id
          ? (responsablePorID.get(formulario.usuario_id) ?? null)
          : null;

        // =================================
        // CAPACIDADES INDIVIDUALES
        // =================================

        const capacidadesEquipo = obtenerCapacidadesEquipo(
          usuario,
          torneoID,
          formulario,
        );

        return prepararFila({
          formulario,

          equipo,

          participantes: listaParticipantes,

          responsable,

          capacidades: {
            editar: capacidadesEquipo.editar,

            evaluar: capacidadesEquipo.evaluar,

            cambiarEstado: capacidadesEquipo.cambiarEstado,

            archivar: capacidadesEquipo.archivar,

            eliminar: capacidadesEquipo.eliminar,
          },
        });
      }),
    );

    // =================================================
    // SEPARAR EQUIPOS ACTIVOS Y ARCHIVADOS
    // =================================================

    const filasActivas = todasLasFilas.filter((fila) => !fila.archivado);

    const filasArchivadas = todasLasFilas.filter((fila) => fila.archivado);

    const filasEnviadas = filasActivas.filter(
      (fila) => fila.formulario.estado !== "BORRADOR",
    );

    const filasBorradores = filasActivas.filter(
      (fila) => fila.formulario.estado === "BORRADOR",
    );

    // =================================================
    // RESUMEN
    // =================================================

    const resumen = construirResumen(todasLasFilas);

    // =================================================
    // RESPUESTA
    // =================================================
    //
    // filas mantiene el funcionamiento anterior:
    //
    // - vista=lista devuelve inscripciones activas,
    //   incluyendo borradores.
    //
    // - vista=archivados devuelve solo archivados.
    //
    // También se devuelven los listados separados
    // para la futura interfaz con tres pestañas.
    // =================================================

    return responder({
      success: true,

      vista,

      torneo: {
        id: torneo.id,

        nombre: torneo.nombre ?? "Torneig",

        deporte: torneo.deporte,
      },

      edicion: {
        id: edicion.id,

        torneo_id: edicion.torneo_id,

        nombre: edicion.nombre ?? "Edició",

        estado: edicion.estado,

        sede: edicion.sede,

        fecha_inicio: edicion.fecha_inicio,

        fecha_fin: edicion.fecha_fin,
      },

      resumen,

      filas: vista === "archivados" ? filasArchivadas : filasActivas,

      filasEnviadas,

      filasBorradores,

      filasArchivadas,

      capacidades,
    });
  } catch (error) {
    return responderErrorAdmin(error);
  }
};

// ============================================================
// CREAR EQUIPO
// ============================================================

async function crearEquipo({
  usuario,
  torneoID,
  edicionID,
  cuerpo,
}: {
  usuario: Usuario;

  torneoID: string;

  edicionID: string;

  cuerpo: Registro;
}) {
  // ========================================================
  // CONTEXTO
  // ========================================================

  const [torneo, edicion, configuracion, configuracionPlataforma] =
    await Promise.all([
      obtenerTorneoAdmin(torneoID),

      obtenerEdicionAdmin(edicionID, torneoID),

      exigirConfiguracionEdicion(edicionID),

      obtenerConfiguracionPlataformaAdmin(),
    ]);

  // ========================================================
  // DATOS
  // ========================================================

  const datos = leerDatosCreacionAdmin(cuerpo);

  // ========================================================
  // PARTICIPANTES
  // ========================================================

  const participantesNuevos = prepararParticipantesNuevos(datos);

  const capitan = obtenerCapitanNuevo(datos, participantesNuevos);

  if (datos.acceso_capitan && !capitan) {
    throw new ErrorAPI(
      400,
      "Per donar accés al capità primer has de seleccionar-lo.",
    );
  }

  // ========================================================
  // IDS
  // ========================================================

  const formularioID = randomUUID();

  const equipoID = randomUUID();

  // ========================================================
  // VALIDACIÓN
  // ========================================================

  const datosValidacion = prepararDatosValidacion(
    datos,
    equipoID,
    participantesNuevos,
    capitan?.id ?? null,
  );

  await validarCreacion({
    datos,

    configuracion,

    configuracionPlataforma,

    edicionID,

    datosValidacion,
  });

  // ========================================================
  // RESPONSABLE
  // ========================================================
  //
  // resolverResponsableAdmin excluye los formularios
  // archivados al comprobar si un usuario ya tiene
  // una inscripción en esta edición.
  // ========================================================

  const responsable = await resolverResponsableAdmin(
    edicionID,
    null,
    datos.responsable,
  );

  // ========================================================
  // PLAZA
  // ========================================================

  const capacidades = obtenerCapacidades(usuario, torneoID);

  const plaza = resolverPlazaInicial({
    datos,

    puedeCambiarEstado: capacidades.cambiarEstado,
  });

  // ========================================================
  // ESCUDO · STORAGE
  // ========================================================

  let escudoGuardado: string | null;

  try {
    escudoGuardado = await guardarEscudoEquipo({
      torneoID,

      edicionID,

      equipoID,

      escudo: datos.equipo.escudo,
    });
  } catch (error) {
    console.error(
      "Error pujant l'escut de l'equip creat des del panell:",
      error,
    );

    throw new ErrorAPI(500, "No s'ha pogut pujar l'escut de l'equip.");
  }

  // ========================================================
  // FECHAS
  // ========================================================

  const ahora = new Date().toISOString();

  const aprobado = datos.estado === "APROBADO";

  // ========================================================
  // FORMULARIO
  // ========================================================
  //
  // Las nuevas inscripciones siempre se crean inicialmente
  // como borrador.
  //
  // Si se ha solicitado crear un equipo aprobado, se
  // finalizará su aprobación cuando estén guardados todos
  // sus participantes y el capitán.
  // ========================================================

  const { error: errorFormulario } = await supabaseAdmin
    .from("formularios")
    .insert({
      id: formularioID,

      edicion_id: edicionID,

      tipo: "EQUIPO",

      origen: "ADMIN",

      estado: "BORRADOR",

      usuario_id: responsable.usuario_id,

      email_contacto: responsable.email_contacto,

      acceso_capitan: false,

      configuracion_snapshot: configuracion,

      iniciado_at: ahora,

      enviado_at: null,

      completado_at: null,

      archivado_at: null,

      archivado_por: null,

      estado_previo_archivado: null,

      motivo_archivado: null,

      created_at: ahora,

      updated_at: ahora,
    });

  if (errorFormulario) {
    await limpiarEscudoCreacion({
      torneoID,

      edicionID,

      equipoID,
    });

    if (errorFormulario.code === "23505") {
      throw new ErrorAPI(409, "Ja existeix una inscripció amb aquestes dades.");
    }

    throw errorFormulario;
  }

  // ========================================================
  // EQUIPO
  // ========================================================
  //
  // El capitán todavía no se vincula, ya que primero
  // se deben insertar sus datos como participante.
  // ========================================================

  const { error: errorEquipo } = await supabaseAdmin.from("equipos").insert({
    id: equipoID,

    formulario_id: formularioID,

    nombre: datos.equipo.nombre || null,

    escudo: escudoGuardado,

    capitan_id: null,

    validacion_estado: "PENDIENTE",

    plaza_estado: "PENDIENTE",

    posicion_lista_espera: null,

    nota_admin: datos.equipo.nota_admin,

    created_at: ahora,

    updated_at: ahora,
  });

  if (errorEquipo) {
    await limpiarEscudoCreacion({
      torneoID,

      edicionID,

      equipoID,
    });

    const { error: errorLimpieza } = await supabaseAdmin
      .from("formularios")
      .delete()
      .eq("id", formularioID)
      .eq("edicion_id", edicionID)
      .eq("tipo", "EQUIPO")
      .eq("estado", "BORRADOR")
      .eq("updated_at", ahora)
      .is("archivado_at", null);

    if (errorLimpieza) {
      console.error(
        "No s'ha pogut netejar el formulari després d'una creació fallida:",
        errorLimpieza,
      );
    }

    throw errorEquipo;
  }

  // ========================================================
  // GUARDAR PARTICIPANTES Y FINALIZAR CREACIÓN
  // ========================================================

  try {
    // ====================================================
    // PARTICIPANTES
    // ====================================================

    if (participantesNuevos.length > 0) {
      const { error: errorParticipantes } = await supabaseAdmin
        .from("participantes_equipo")
        .insert(
          participantesNuevos.map((participante) => ({
            id: participante.id,

            equipo_id: equipoID,

            tipo_participante: participante.tipo_participante,

            nombre: participante.nombre || null,

            apellido1: participante.apellido1 || null,

            apellido2: participante.apellido2 || null,

            email: participante.email || null,

            curso: necesitaCurso(participante.tipo_participante)
              ? participante.curso || null
              : null,

            grupo: necesitaCurso(participante.tipo_participante)
              ? participante.grupo || null
              : null,

            genero: participante.genero,

            validacion_estado: "PENDIENTE",

            orden: participante.orden,

            activo: true,

            created_at: ahora,

            updated_at: ahora,
          })),
        );

      if (errorParticipantes) {
        throw errorParticipantes;
      }
    }

    // ====================================================
    // COMPROBAR FORMULARIO ACTIVO
    // ====================================================

    const { data: formularioActual, error: errorComprobacion } =
      await supabaseAdmin
        .from("formularios")
        .select(CAMPOS_FORMULARIO)
        .eq("id", formularioID)
        .eq("edicion_id", edicionID)
        .eq("tipo", "EQUIPO")
        .maybeSingle();

    if (errorComprobacion) {
      throw errorComprobacion;
    }

    if (
      !formularioActual ||
      esFormularioArchivado(formularioActual) ||
      formularioActual.estado !== "BORRADOR" ||
      Date.parse(formularioActual.updated_at ?? "") !== Date.parse(ahora)
    ) {
      throw new ErrorAPI(409, "La inscripció ha canviat durant la creació.");
    }

    // ====================================================
    // COMPROBAR DUPLICADOS ANTES DE APROBAR
    // ====================================================

    if (aprobado) {
      await comprobarDuplicadosInscritos(
        edicionID,

        datos.participantes,

        equipoID,
      );
    }

    const fechaFinalizacion = new Date().toISOString();

    // ====================================================
    // VINCULAR CAPITÁN Y ASIGNAR PLAZA
    // ====================================================

    const { data: equipoActualizado, error: errorActualizacionEquipo } =
      await supabaseAdmin
        .from("equipos")
        .update({
          capitan_id: capitan?.id ?? null,

          validacion_estado: aprobado ? "APROBADO" : "PENDIENTE",

          plaza_estado: plaza.estado,

          posicion_lista_espera: plaza.posicion,

          updated_at: fechaFinalizacion,
        })
        .eq("id", equipoID)
        .eq("formulario_id", formularioID)
        .eq("updated_at", ahora)
        .select("id")
        .maybeSingle();

    if (errorActualizacionEquipo) {
      throw errorActualizacionEquipo;
    }

    if (!equipoActualizado) {
      throw new ErrorAPI(409, "L'equip ha canviat durant la creació.");
    }

    // ====================================================
    // VALIDACIÓN DE PARTICIPANTES
    // ====================================================

    if (aprobado && participantesNuevos.length > 0) {
      const { error: errorValidacionParticipantes } = await supabaseAdmin
        .from("participantes_equipo")
        .update({
          validacion_estado: "APROBADO",

          updated_at: fechaFinalizacion,
        })
        .eq("equipo_id", equipoID)
        .eq("activo", true);

      if (errorValidacionParticipantes) {
        throw errorValidacionParticipantes;
      }
    }

    // ====================================================
    // FINALIZAR FORMULARIO
    // ====================================================

    const { data: formularioFinalizado, error: errorFinalizacion } =
      await supabaseAdmin
        .from("formularios")
        .update({
          estado: datos.estado,

          acceso_capitan: datos.acceso_capitan && Boolean(capitan),

          enviado_at: aprobado ? fechaFinalizacion : null,

          completado_at: aprobado ? fechaFinalizacion : null,

          updated_at: fechaFinalizacion,
        })
        .eq("id", formularioID)
        .eq("edicion_id", edicionID)
        .eq("tipo", "EQUIPO")
        .eq("estado", "BORRADOR")
        .eq("updated_at", ahora)
        .is("archivado_at", null)
        .select("id")
        .maybeSingle();

    if (errorFinalizacion) {
      throw errorFinalizacion;
    }

    if (!formularioFinalizado) {
      throw new ErrorAPI(
        409,
        "La inscripció ha canviat abans de finalitzar la creació.",
      );
    }
  } catch (error) {
    // ====================================================
    // COMPROBAR SI SE PUEDE RECUPERAR COMO BORRADOR
    // ====================================================

    const { data: formulario, error: errorConsulta } = await supabaseAdmin
      .from("formularios")
      .select("id,estado,archivado_at,updated_at")
      .eq("id", formularioID)
      .maybeSingle();

    if (errorConsulta) {
      console.error(
        "No s'ha pogut comprovar l'estat de la creació incompleta:",
        errorConsulta,
      );
    }

    // No se modifica una inscripción archivada
    // ni una inscripción que haya cambiado de versión.

    if (
      formulario &&
      formulario.estado === "BORRADOR" &&
      !esFormularioArchivado(formulario) &&
      Date.parse(formulario.updated_at ?? "") === Date.parse(ahora)
    ) {
      await dejarCreacionComoBorrador({
        formularioID,

        equipoID,
      });

      const { error: errorRestaurarParticipantes } = await supabaseAdmin
        .from("participantes_equipo")
        .update({
          validacion_estado: "PENDIENTE",

          updated_at: new Date().toISOString(),
        })
        .eq("equipo_id", equipoID)
        .eq("activo", true);

      if (errorRestaurarParticipantes) {
        console.error(
          "No s'ha pogut restaurar la validació dels participants:",
          errorRestaurarParticipantes,
        );
      }
    }

    throw error;
  }

  // ========================================================
  // RESPUESTA
  // ========================================================

  return responder(
    {
      success: true,

      mensaje: aprobado
        ? "Equip creat i aprovat correctament."
        : "Equip creat com a esborrany.",

      torneo: {
        id: torneo.id,

        nombre: torneo.nombre ?? "Torneig",
      },

      edicion: {
        id: edicion.id,

        nombre: edicion.nombre ?? "Edició",
      },

      formulario: {
        id: formularioID,

        estado: datos.estado,

        estado_visible: datos.estado,

        origen: "ADMIN",

        archivado: false,

        archivado_at: null,
      },

      equipo: {
        id: equipoID,

        nombre: datos.equipo.nombre,

        escudo: escudoGuardado,

        capitan_id: capitan?.id ?? null,

        plaza_estado: plaza.estado,

        posicion_lista_espera: plaza.posicion,

        archivado: false,
      },

      redireccion: `/panell/equips/${encodeURIComponent(equipoID)}?${new URLSearchParams(
        {
          torneoID,
          edicionID,
        },
      ).toString()}`,
    },
    201,
  );
}

// ============================================================
// POST · CREACIÓN ADMINISTRATIVA
// ============================================================

export const crearEquipoAdmin: APIRoute = async ({ cookies, request, url }) => {
  try {
    // =================================================
    // ORIGEN
    // =================================================

    comprobarOrigen(request, url);

    // =================================================
    // USUARIO
    // =================================================

    const usuario = await exigirUsuario(cookies);

    // =================================================
    // JSON
    // =================================================

    const cuerpo = await leerJSON(request);

    // =================================================
    // ACCIÓN
    // =================================================

    if (cuerpo.accion !== "crear") {
      throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
    }

    // =================================================
    // IDS
    // =================================================

    const torneoID = leerIDAdmin(cuerpo.torneoID, "torneoID");

    const edicionID = leerIDAdmin(cuerpo.edicionID, "edicionID");

    // =================================================
    // PERMISOS
    // =================================================

    exigirPermisoEquip(usuario, torneoID, "crear");

    // =================================================
    // CREAR EQUIPO
    // =================================================

    return await crearEquipo({
      usuario,

      torneoID,

      edicionID,

      cuerpo,
    });
  } catch (error) {
    return responderErrorAdmin(error);
  }
};
