import { MENU_ADMIN } from "./Menu";

// ============================================================
// TIPOS
// ============================================================

export type OpcionMenuPanel = {
  id: string;

  nombre: string;

  enlace: string;

  seccion: string;

  accion?: string;

  estado: "Activa" | "Pròximament";

  contexto: "general" | "torneo" | "edicion";

  parametros?: Record<string, string>;

  /**
   * Opciones exclusivas del rol desarrollador.
   *
   * No utilizan el sistema normal de permisos.
   */
  soloDesarrollador?: boolean;
};

export type GrupoMenuPanel = {
  id: string;

  nombre: string;

  requiereEdicion?: boolean;

  opciones: OpcionMenuPanel[];
};

// ============================================================
// PANEL GENERAL
// ============================================================

export const MENU_PANEL_GENERAL: GrupoMenuPanel[] = [
  {
    id: "general",

    nombre: "Administració",

    opciones: MENU_ADMIN.map(
      (item): OpcionMenuPanel => ({
        id: item.id,

        nombre: item.nombre,

        enlace: item.enlace,

        seccion: item.enlace.split("/")[2] || "panell",

        estado: item.estado === "Activa" ? "Activa" : "Pròximament",

        contexto: "general",
      }),
    ),
  },
];

// ============================================================
// TORNEO / EDICIÓN
// ============================================================

export const MENU_PANEL_TORNEO: GrupoMenuPanel[] = [
  // ====================================================
  // INICIO
  // ====================================================

  {
    id: "resumen",

    nombre: "Resum",

    opciones: [
      {
        id: "inici-torneig",

        nombre: "Inici",

        enlace: "/panell",

        seccion: "panell",

        estado: "Activa",

        contexto: "edicion",
      },
    ],
  },

  // ====================================================
  // EDICIÓN SELECCIONADA
  // ====================================================

  {
    id: "edicion",

    nombre: "Edició seleccionada",

    requiereEdicion: true,

    opciones: [
      // ============================================
      // VOLUNTARIOS
      // ============================================

      {
        id: "voluntaris",

        nombre: "Voluntaris",

        enlace: "/panell/voluntaris",

        seccion: "voluntaris",

        estado: "Activa",

        contexto: "edicion",
      },

      // ============================================
      // EQUIPOS
      // ============================================

      {
        id: "equips",

        nombre: "Equips i participants",

        enlace: "/panell/equips",

        seccion: "equips",

        estado: "Activa",

        contexto: "edicion",
      },

      // ============================================
      // ALUMNADO PARTICIPANTE
      // ============================================
      //
      // Utiliza exactamente el mismo permiso que
      // la consulta de equipos.
      // ============================================

      {
        id: "alumnes",

        nombre: "Alumnat participant",

        enlace: "/panell/alumnes",

        seccion: "equips",

        accion: "ver",

        estado: "Activa",

        contexto: "edicion",
      },

      // ============================================
      // COMPETICIÓN
      // ============================================

      {
        id: "competicio",

        nombre: "Format de competició",

        enlace: "/panell/competicio",

        seccion: "competicio",

        estado: "Activa",

        contexto: "edicion",
      },

      // ============================================
      // PARTIDOS
      // ============================================

      {
        id: "partits",

        nombre: "Calendari i resultats",

        enlace: "/panell/partits",

        seccion: "partits",

        estado: "Activa",

        contexto: "edicion",
      },

      // ============================================
      // CLASIFICACIONES
      // ============================================

      {
        id: "classificacions",

        nombre: "Classificacions",

        enlace: "/panell/classificacions",

        seccion: "classificacions",

        estado: "Pròximament",

        contexto: "edicion",
      },

      // ============================================
      // CONFIGURACIÓN EDICIÓN
      // ============================================

      {
        id: "configuracio-edicio",

        nombre: "Configuració de l’edició",

        enlace: "/panell/configuracio-edicio",

        seccion: "configuracio-edicio",

        estado: "Pròximament",

        contexto: "edicion",
      },
    ],
  },

  // ====================================================
  // TORNEO
  // ====================================================

  {
    id: "torneo",

    nombre: "Torneig",

    opciones: [
      // ============================================
      // INFORMACIÓN TORNEO
      // ============================================

      {
        id: "informacio-torneig",

        nombre: "Informació del torneig",

        enlace: "/panell/info/torneig",

        seccion: "tornejos",

        estado: "Activa",

        contexto: "torneo",

        parametros: {
          accio: "ver",
        },
      },

      // ============================================
      // EDICIONES
      // ============================================

      {
        id: "edicions",

        nombre: "Edicions",

        enlace: "/panell/edicions",

        seccion: "edicions",

        estado: "Activa",

        contexto: "torneo",
      },

      // ============================================
      // ORGANIZACIÓN
      // ============================================

      {
        id: "organitzacio",

        nombre: "Organització i permisos",

        enlace: "/panell/permisos",

        seccion: "permisos",

        estado: "Pròximament",

        contexto: "torneo",
      },
    ],
  },

  // ====================================================
  // DESARROLLADOR
  // ====================================================
  //
  // Este grupo únicamente aparecerá cuando exista
  // una edición seleccionada.
  //
  // Además, NavBar comprobará que:
  //
  // usuario.rol === "desarrollador"
  //
  // No depende de ningún permiso configurable.
  // ====================================================

  {
    id: "desenvolupador",

    nombre: "Desenvolupador",

    requiereEdicion: true,

    opciones: [
      {
        id: "eliminar-dades-edicio",

        nombre: "Eliminar dades de l’edició",

        enlace: "/panell/edicio/eliminar-dades",

        /*
         * La sección se mantiene como "panell"
         * por coherencia estructural, pero esta
         * opción NO se autoriza mediante permisos.
         *
         * NavBar comprueba primero:
         *
         * soloDesarrollador === true
         *
         * y después:
         *
         * esDesarrollador(usuario.rol)
         */
        seccion: "panell",

        estado: "Activa",

        contexto: "edicion",

        soloDesarrollador: true,
      },
    ],
  },
];
