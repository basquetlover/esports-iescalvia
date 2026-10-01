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
// CONSTANTES
// ============================================================

const ESTADOS_APROBADOS = ["APROBADO", "ACEPTADO"] as const;

// ============================================================
// TIPOS
// ============================================================

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

type EdicionDB = {
  id: string;
  torneo_id: string | null;
  nombre: string | null;
};

type FormularioDB = {
  id: string;
  usuario_id: string | null;
};

type EquipoDB = {
  id: string;
  formulario_id: string;
  nombre: string | null;
};

type JugadorDB = {
  id: string;

  equipo_id: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  email: string | null;

  curso: string | null;

  grupo: string | null;

  activo: boolean | null;

  tipo_participante: string | null;

  validacion_estado: string | null;
};

type VoluntarioDB = {
  id: string;

  formulario_id: string;

  nombre: string | null;

  apellido1: string | null;

  apellido2: string | null;

  email: string | null;

  curso: string | null;

  grupo: string | null;

  tipo_voluntariado: string | null;

  validacion_estado: string | null;

  plaza_estado: string | null;
};

type EquipoAlumno = {
  id: string;

  nombre: string;
};

type AlumnoAcumulado = {
  clave: string;

  nombre: string;

  apellido1: string;

  apellido2: string;

  email: string;

  curso: string;

  grupo: string;

  jugador: boolean;

  voluntario: boolean;

  equipos: Map<string, EquipoAlumno>;

  voluntariados: Set<string>;
};

type AlumnoPublico = {
  id: string;

  nombre: string;

  apellido1: string;

  apellido2: string;

  nombre_completo: string;

  email: string;

  curso: string;

  grupo: string;

  participacion: {
    jugador: boolean;

    voluntario: boolean;

    equipos: EquipoAlumno[];

    voluntariados: string[];
  };
};

type CursoPublico = {
  curso: string;

  total: number;

  alumnos: AlumnoPublico[];
};

// ============================================================
// ERROR
// ============================================================

function responderError(error: unknown) {
  if (error instanceof ErrorAPI) {
    return responder(
      {
        success: false,

        mensaje: error.message,
      },
      error.estado,
    );
  }

  console.error("Error carregant l'alumnat participant:", error);

  return responder(
    {
      success: false,

      mensaje: "No s'ha pogut carregar l'alumnat participant.",
    },
    500,
  );
}

// ============================================================
// UUID
// ============================================================

function identificador(
  valor: unknown,

  nombre: string,
) {
  if (typeof valor !== "string") {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  const limpio = valor.trim().toLowerCase();

  if (!UUID.test(limpio)) {
    throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
  }

  return limpio;
}

// ============================================================
// TEXTO
// ============================================================

function limpiarTexto(valor: string | null | undefined) {
  return typeof valor === "string" ? valor.trim() : "";
}

// ============================================================
// EMAIL
// ============================================================

function normalizarEmail(valor: string | null | undefined) {
  return limpiarTexto(valor).toLowerCase();
}

// ============================================================
// TEXTO PARA COMPARAR
// ============================================================

function normalizarClave(valor: string) {
  return valor
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

// ============================================================
// NOMBRE COMPLETO
// ============================================================

function nombreCompleto(persona: {
  nombre: string;

  apellido1: string;

  apellido2: string;
}) {
  return [persona.nombre, persona.apellido1, persona.apellido2]
    .filter(Boolean)
    .join(" ");
}

// ============================================================
// CLAVE ÚNICA DE PERSONA
// ============================================================
//
// El email es el identificador principal.
//
// Si una persona aparece como:
//
// - jugador
// - voluntario
//
// con el mismo email, solo aparecerá una vez.
//
// El fallback por nombre/curso/grupo solo se utiliza para
// registros antiguos que no tengan email.
// ============================================================

function crearClavePersona({
  email,
  nombre,
  apellido1,
  apellido2,
  curso,
  grupo,
}: {
  email: string;

  nombre: string;

  apellido1: string;

  apellido2: string;

  curso: string;

  grupo: string;
}) {
  if (email) {
    return `email:${email}`;
  }

  return [
    "persona",

    normalizarClave(nombre),

    normalizarClave(apellido1),

    normalizarClave(apellido2),

    normalizarClave(curso),

    normalizarClave(grupo),
  ].join(":");
}

// ============================================================
// CONTEXTO
// ============================================================

async function exigirContexto(
  usuario: Usuario,

  torneoID: string,

  edicionID: string,
) {
  // =========================================================
  // ACCESO TORNEO
  // =========================================================

  if (
    !tieneAccesoTorneo(usuario, torneoID) ||
    !tienePermiso(usuario, "panell", "ver", torneoID)
  ) {
    throw new ErrorAPI(403, "No tens accés a aquest torneig.");
  }

  // =========================================================
  // PERMISO EQUIPOS
  // =========================================================

  if (!tienePermiso(usuario, "equips", "ver", torneoID)) {
    throw new ErrorAPI(
      403,
      "No tens permís per consultar l'alumnat participant.",
    );
  }

  // =========================================================
  // EDICIÓN
  // =========================================================

  const { data, error } = await supabaseAdmin
    .from("ediciones")
    .select("id,torneo_id,nombre")
    .eq("id", edicionID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const edicion = data as EdicionDB | null;

  if (!edicion || edicion.torneo_id?.trim().toLowerCase() !== torneoID) {
    throw new ErrorAPI(404, "L'edició no pertany al torneig seleccionat.");
  }

  return edicion;
}

// ============================================================
// JUGADORES DE EQUIPOS CONFIRMADOS
// ============================================================

async function obtenerJugadores(edicionID: string) {
  // =========================================================
  // FORMULARIOS DE EQUIPO APROBADOS
  // =========================================================

  const {
    data: formulariosData,

    error: formulariosError,
  } = await supabaseAdmin
    .from("formularios")
    .select("id,usuario_id")
    .eq("edicion_id", edicionID)
    .eq("tipo", "EQUIPO")
    .eq("estado", "APROBADO");

  if (formulariosError) {
    throw formulariosError;
  }

  const formularios = (formulariosData ?? []) as FormularioDB[];

  const idsFormularios = formularios.map((formulario) => formulario.id);

  if (idsFormularios.length === 0) {
    return {
      equipos: [] as EquipoDB[],

      jugadores: [] as JugadorDB[],
    };
  }

  // =========================================================
  // EQUIPOS CON PLAZA CONFIRMADA
  // =========================================================

  const {
    data: equiposData,

    error: equiposError,
  } = await supabaseAdmin
    .from("equipos")
    .select("id,formulario_id,nombre")
    .in("formulario_id", idsFormularios)
    .eq("plaza_estado", "CONFIRMADA");

  if (equiposError) {
    throw equiposError;
  }

  const equipos = (equiposData ?? []) as EquipoDB[];

  const idsEquipos = equipos.map((equipo) => equipo.id);

  if (idsEquipos.length === 0) {
    return {
      equipos,

      jugadores: [] as JugadorDB[],
    };
  }

  // =========================================================
  // SOLO JUGADORES ACTIVOS
  // =========================================================

  const {
    data: jugadoresData,

    error: jugadoresError,
  } = await supabaseAdmin
    .from("participantes_equipo")
    .select(
      "id,equipo_id,nombre,apellido1,apellido2,email,curso,grupo,activo,tipo_participante,validacion_estado",
    )
    .in("equipo_id", idsEquipos)
    .eq("activo", true)
    .eq("tipo_participante", "JUGADOR");

  if (jugadoresError) {
    throw jugadoresError;
  }

  return {
    equipos,

    jugadores: (jugadoresData ?? []) as JugadorDB[],
  };
}

// ============================================================
// VOLUNTARIOS CONFIRMADOS
// ============================================================

async function obtenerVoluntarios(edicionID: string) {
  // =========================================================
  // FORMULARIOS DE VOLUNTARIADO APROBADOS
  // =========================================================

  const {
    data: formulariosData,

    error: formulariosError,
  } = await supabaseAdmin
    .from("formularios")
    .select("id,usuario_id")
    .eq("edicion_id", edicionID)
    .eq("tipo", "VOLUNTARIO")
    .in("estado", [...ESTADOS_APROBADOS]);

  if (formulariosError) {
    throw formulariosError;
  }

  const formularios = (formulariosData ?? []) as FormularioDB[];

  const idsFormularios = formularios.map((formulario) => formulario.id);

  if (idsFormularios.length === 0) {
    return [] as VoluntarioDB[];
  }

  // =========================================================
  // VOLUNTARIOS CONFIRMADOS
  // =========================================================

  const { data, error } = await supabaseAdmin
    .from("voluntarios")
    .select(
      "id,formulario_id,nombre,apellido1,apellido2,email,curso,grupo,tipo_voluntariado,validacion_estado,plaza_estado",
    )
    .in("formulario_id", idsFormularios)
    .in("validacion_estado", [...ESTADOS_APROBADOS])
    .eq("plaza_estado", "CONFIRMADA");

  if (error) {
    throw error;
  }

  return (data ?? []) as VoluntarioDB[];
}

// ============================================================
// CREAR / OBTENER ALUMNO
// ============================================================

function obtenerAlumno(
  mapa: Map<string, AlumnoAcumulado>,

  datos: {
    nombre: string | null;

    apellido1: string | null;

    apellido2: string | null;

    email: string | null;

    curso: string | null;

    grupo: string | null;
  },
) {
  const nombre = limpiarTexto(datos.nombre);

  const apellido1 = limpiarTexto(datos.apellido1);

  const apellido2 = limpiarTexto(datos.apellido2);

  const email = normalizarEmail(datos.email);

  const curso = limpiarTexto(datos.curso);

  const grupo = limpiarTexto(datos.grupo);

  const clave = crearClavePersona({
    email,
    nombre,
    apellido1,
    apellido2,
    curso,
    grupo,
  });

  const existente = mapa.get(clave);

  if (existente) {
    // =======================================================
    // COMPLETAR DATOS QUE PUEDAN FALTAR
    // =======================================================

    if (!existente.nombre && nombre) {
      existente.nombre = nombre;
    }

    if (!existente.apellido1 && apellido1) {
      existente.apellido1 = apellido1;
    }

    if (!existente.apellido2 && apellido2) {
      existente.apellido2 = apellido2;
    }

    if (!existente.email && email) {
      existente.email = email;
    }

    if (!existente.curso && curso) {
      existente.curso = curso;
    }

    if (!existente.grupo && grupo) {
      existente.grupo = grupo;
    }

    return existente;
  }

  const alumno: AlumnoAcumulado = {
    clave,

    nombre,

    apellido1,

    apellido2,

    email,

    curso,

    grupo,

    jugador: false,

    voluntario: false,

    equipos: new Map(),

    voluntariados: new Set(),
  };

  mapa.set(clave, alumno);

  return alumno;
}

// ============================================================
// CONSTRUIR LISTA
// ============================================================

function construirAlumnos({
  equipos,
  jugadores,
  voluntarios,
}: {
  equipos: EquipoDB[];

  jugadores: JugadorDB[];

  voluntarios: VoluntarioDB[];
}) {
  const alumnos = new Map<string, AlumnoAcumulado>();

  const equipoPorID = new Map<string, EquipoDB>(
    equipos.map((equipo) => [equipo.id, equipo]),
  );

  // =========================================================
  // JUGADORES
  // =========================================================

  for (const jugador of jugadores) {
    const alumno = obtenerAlumno(alumnos, jugador);

    alumno.jugador = true;

    const equipo = equipoPorID.get(jugador.equipo_id);

    if (equipo) {
      alumno.equipos.set(equipo.id, {
        id: equipo.id,

        nombre: limpiarTexto(equipo.nombre) || "Equip sense nom",
      });
    }
  }

  // =========================================================
  // VOLUNTARIOS
  // =========================================================

  for (const voluntario of voluntarios) {
    const alumno = obtenerAlumno(alumnos, voluntario);

    alumno.voluntario = true;

    const tipo = limpiarTexto(voluntario.tipo_voluntariado);

    if (tipo) {
      alumno.voluntariados.add(tipo);
    }
  }

  return [...alumnos.values()];
}

// ============================================================
// ALUMNO PÚBLICO
// ============================================================

function prepararAlumno(alumno: AlumnoAcumulado): AlumnoPublico {
  return {
    id: alumno.clave,

    nombre: alumno.nombre,

    apellido1: alumno.apellido1,

    apellido2: alumno.apellido2,

    nombre_completo:
      nombreCompleto(alumno) || alumno.email || "Alumne sense nom",

    email: alumno.email,

    curso: alumno.curso,

    grupo: alumno.grupo,

    participacion: {
      jugador: alumno.jugador,

      voluntario: alumno.voluntario,

      equipos: [...alumno.equipos.values()].sort((a, b) =>
        a.nombre.localeCompare(b.nombre, "ca", {
          sensitivity: "base",
        }),
      ),

      voluntariados: [...alumno.voluntariados].sort((a, b) =>
        a.localeCompare(b, "ca", {
          sensitivity: "base",
        }),
      ),
    },
  };
}

// ============================================================
// ORDEN DE ALUMNOS
// ============================================================

function ordenarAlumnos(alumnos: AlumnoPublico[]) {
  return alumnos.sort((a, b) => {
    // =====================================================
    // GRUPO
    // =====================================================

    const grupo = a.grupo.localeCompare(b.grupo, "ca", {
      numeric: true,

      sensitivity: "base",
    });

    if (grupo !== 0) {
      return grupo;
    }

    // =====================================================
    // PRIMER APELLIDO
    // =====================================================

    const apellido1 = a.apellido1.localeCompare(b.apellido1, "ca", {
      sensitivity: "base",
    });

    if (apellido1 !== 0) {
      return apellido1;
    }

    // =====================================================
    // SEGUNDO APELLIDO
    // =====================================================

    const apellido2 = a.apellido2.localeCompare(b.apellido2, "ca", {
      sensitivity: "base",
    });

    if (apellido2 !== 0) {
      return apellido2;
    }

    // =====================================================
    // NOMBRE
    // =====================================================

    return a.nombre.localeCompare(b.nombre, "ca", {
      sensitivity: "base",
    });
  });
}

// ============================================================
// AGRUPAR POR CURSO
// ============================================================

function agruparPorCurso(alumnos: AlumnoAcumulado[]): CursoPublico[] {
  const grupos = new Map<
    string,
    {
      nombre: string;

      alumnos: AlumnoPublico[];
    }
  >();

  for (const acumulado of alumnos) {
    const alumno = prepararAlumno(acumulado);

    const curso = alumno.curso || "Sense curs";

    const claveCurso = alumno.curso
      ? normalizarClave(alumno.curso)
      : "__sense_curs__";

    let grupo = grupos.get(claveCurso);

    if (!grupo) {
      grupo = {
        nombre: curso,

        alumnos: [],
      };

      grupos.set(claveCurso, grupo);
    }

    grupo.alumnos.push(alumno);
  }

  const cursos = [...grupos.values()].map((grupo) => ({
    curso: grupo.nombre,

    total: grupo.alumnos.length,

    alumnos: ordenarAlumnos(grupo.alumnos),
  }));

  // =========================================================
  // ORDENAR CURSOS
  // =========================================================

  cursos.sort((a, b) => {
    /*
     * Los alumnos sin curso siempre quedan al final.
     */

    if (a.curso === "Sense curs") {
      return 1;
    }

    if (b.curso === "Sense curs") {
      return -1;
    }

    return a.curso.localeCompare(b.curso, "ca", {
      numeric: true,

      sensitivity: "base",
    });
  });

  return cursos;
}

// ============================================================
// GET
// ============================================================

export const GET: APIRoute = async ({ cookies, url }) => {
  try {
    // =====================================================
    // USUARIO
    // =====================================================

    const usuario = await exigirUsuario(cookies);

    // =====================================================
    // PARÁMETROS
    // =====================================================

    const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");

    const edicionID = identificador(
      url.searchParams.get("edicionID"),
      "edició",
    );

    // =====================================================
    // CONTEXTO
    // =====================================================

    const edicion = await exigirContexto(usuario, torneoID, edicionID);

    // =====================================================
    // DATOS
    // =====================================================

    const [datosEquipos, voluntarios] = await Promise.all([
      obtenerJugadores(edicionID),

      obtenerVoluntarios(edicionID),
    ]);

    // =====================================================
    // UNIFICAR ALUMNOS
    // =====================================================

    const alumnos = construirAlumnos({
      equipos: datosEquipos.equipos,

      jugadores: datosEquipos.jugadores,

      voluntarios,
    });

    // =====================================================
    // AGRUPAR POR CURSO
    // =====================================================

    const cursos = agruparPorCurso(alumnos);

    // =====================================================
    // RESUMEN
    // =====================================================

    const totalJugadores = alumnos.filter((alumno) => alumno.jugador).length;

    const totalVoluntarios = alumnos.filter(
      (alumno) => alumno.voluntario,
    ).length;

    const totalAmbos = alumnos.filter(
      (alumno) => alumno.jugador && alumno.voluntario,
    ).length;

    // =====================================================
    // RESPUESTA
    // =====================================================

    return responder({
      success: true,

      torneoID,

      edicion: {
        id: edicion.id,

        nombre: edicion.nombre,
      },

      resumen: {
        total: alumnos.length,

        jugadores: totalJugadores,

        voluntarios: totalVoluntarios,

        ambos: totalAmbos,

        cursos: cursos.length,
      },

      cursos,
    });
  } catch (error) {
    return responderError(error);
  }
};
