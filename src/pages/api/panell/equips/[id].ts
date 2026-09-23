import {
    modificarDetalleEquipoAdmin,
    obtenerDetalleEquipoAdmin,
} from "@utils/panell/equips/adminDetalle";

export const prerender =
    false;

export const GET =
    obtenerDetalleEquipoAdmin;

export const PATCH =
    modificarDetalleEquipoAdmin;