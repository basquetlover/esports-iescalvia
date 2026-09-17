export type TorneoPublico = {
    id: string;

    nombre: string;

    banner: string;

    deporte: string;

    descripcion: string;

    normativa_base:
        string | null;
};

export type EdicionPublica = {
    id: string;

    torneo_id: string;

    nombre: string;

    fecha_inicio:
        string | null;

    fecha_fin:
        string | null;

    estado: string;

    sede: string;
};

export type BloqueInformacion = {
    id: string;

    order: number;

    title: string;

    body: string;
};

export type ConfigInscripcion = {
    apertura:
        string | null;

    cierre:
        string | null;
};

export type ConfigEquiposPublica = {
    inscripcion:
        ConfigInscripcion;

    cupo: {
        maximo:
            number | null;
    };

    jugadores: {
        minimo:
            number | null;

        maximo:
            number | null;
    };
};

export type TipoVoluntariadoPublico = {
    nombre: string;

    descripcion: string;

    maximo:
        number | null;
};

export type ConfigVoluntariosPublica = {
    inscripcion:
        ConfigInscripcion;

    cupo: {
        maximo:
            number | null;
    };

    tipos:
        TipoVoluntariadoPublico[];
};

export type ArticuloNormativa = {
    numero: string;

    texto: string;
};

export type ApartadoNormativa = {
    numero: number;

    titulo: string;

    articulos:
        ArticuloNormativa[];
};

export type DatosTorneoPublico = {
    torneo:
        TorneoPublico;

    ediciones:
        EdicionPublica[];

    edicionActual:
        EdicionPublica | null;

    estadoActual:
        string;

    bloques:
        BloqueInformacion[];

    configEquipos:
        ConfigEquiposPublica | null;

    configVoluntarios:
        ConfigVoluntariosPublica | null;

    normativa:
        ApartadoNormativa[];

    tieneInscripcion:
        boolean;

    tieneVoluntariado:
        boolean;
};