import {
    crearEquipoAdmin,
    obtenerListadoEquiposAdmin,
} from "@utils/panell/equips/adminListado";

export const prerender =
    false;

export const GET =
    obtenerListadoEquiposAdmin;

export const POST =
    crearEquipoAdmin;