import { MENU_ADMIN } from "./Menu";

export type OpcionMenuPanel = {
    id: string;
    nombre: string;
    enlace: string;
    seccion: string;
    accion?: string;
    estado: "Activa" | "Pròximament";
    contexto: "general" | "torneo" | "edicion";
    parametros?: Record<string, string>;
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

                nombre:
                    item.nombre,

                enlace:
                    item.enlace,

                seccion:
                    item.enlace.split("/")[2] ||
                    "panell",

                estado:
                    item.estado === "Activa"
                        ? "Activa"
                        : "Pròximament",

                contexto:
                    "general",
            }),
        ),
    },
];

// ============================================================
// TORNEO / EDICIÓN
// ============================================================

export const MENU_PANEL_TORNEO: GrupoMenuPanel[] = [

    // ========================================================
    // INICIO
    // ========================================================

    {
        id: "resumen",

        nombre:
            "Resum",

        opciones: [
            {
                id:
                    "inici-torneig",

                nombre:
                    "Inici",

                enlace:
                    "/panell",

                seccion:
                    "panell",

                estado:
                    "Activa",

                contexto:
                    "edicion",
            },
        ],
    },

    // ========================================================
    // EDICIÓN SELECCIONADA
    // ========================================================
    //
    // Cuando existe una edición seleccionada, sus herramientas
    // aparecen inmediatamente después de Inicio.
    //
    // Si no existe edicionID, NavBar oculta automáticamente
    // este grupo mediante requiereEdicion.
    // ========================================================

    {
        id:
            "edicion",

        nombre:
            "Edició seleccionada",

        requiereEdicion:
            true,

        opciones: [
            {
                id:
                    "voluntaris",

                nombre:
                    "Voluntaris",

                enlace:
                    "/panell/voluntaris",

                seccion:
                    "voluntaris",

                estado:
                    "Pròximament",

                contexto:
                    "edicion",
            },

            {
                id:
                    "equips",

                nombre:
                    "Equips i participants",

                enlace:
                    "/panell/equips",

                seccion:
                    "equips",

                estado:
                    "Activa",

                contexto:
                    "edicion",
            },

            {
                id:
                    "competicio",

                nombre:
                    "Format de competició",

                enlace:
                    "/panell/competicio",

                seccion:
                    "competicio",

                estado:
                    "Pròximament",

                contexto:
                    "edicion",
            },

            {
                id:
                    "partits",

                nombre:
                    "Calendari i resultats",

                enlace:
                    "/panell/partits",

                seccion:
                    "partits",

                estado:
                    "Pròximament",

                contexto:
                    "edicion",
            },

            {
                id:
                    "classificacions",

                nombre:
                    "Classificacions",

                enlace:
                    "/panell/classificacions",

                seccion:
                    "classificacions",

                estado:
                    "Pròximament",

                contexto:
                    "edicion",
            },

            {
                id:
                    "configuracio-edicio",

                nombre:
                    "Configuració de l’edició",

                enlace:
                    "/panell/configuracio-edicio",

                seccion:
                    "configuracio-edicio",

                estado:
                    "Pròximament",

                contexto:
                    "edicion",
            },
        ],
    },

    // ========================================================
    // TORNEO
    // ========================================================
    //
    // Las opciones generales del torneo quedan debajo de las
    // herramientas de la edición cuando hay una seleccionada.
    // ========================================================

    {
        id:
            "torneo",

        nombre:
            "Torneig",

        opciones: [
            {
                id:
                    "informacio-torneig",

                nombre:
                    "Informació del torneig",

                enlace:
                    "/panell/info/torneig",

                seccion:
                    "tornejos",

                estado:
                    "Activa",

                contexto:
                    "torneo",

                parametros: {
                    accio:
                        "ver",
                },
            },

            {
                id:
                    "edicions",

                nombre:
                    "Edicions",

                enlace:
                    "/panell/edicions",

                seccion:
                    "edicions",

                estado:
                    "Activa",

                contexto:
                    "torneo",
            },

            {
                id:
                    "organitzacio",

                nombre:
                    "Organització i permisos",

                enlace:
                    "/panell/permisos",

                seccion:
                    "permisos",

                estado:
                    "Pròximament",

                contexto:
                    "torneo",
            },
        ],
    },
];