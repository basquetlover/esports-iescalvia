import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { NIVELES_ROL } from "@const/Permisos";

export const prerender = false;

// Pendiente de centralizar cuando revisemos Permisos.ts.
const NIVELES_GESTION_USUARIOS = {
    ver: 4,
    bloquear: 4,
    desbloquear: 4,
} as const;

type AccionUsuarios = keyof typeof NIVELES_GESTION_USUARIOS;

type UsuarioAcceso = {
    id: string;
    rol?: string | null;
    permisos?: unknown;
};

type Registro = Record<string, unknown>;

const POR_PAGINA = 20;

const UUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CAMPOS_USUARIO =
    "id,nombre,apellido1,apellido2,email,curso,ano_academico," +
    "rol,permisos,origen_permisos,fecha_creacion," +
    "fecha_actualizacion,activa";

const CAMPOS_LISTA =
    "id,nombre,apellido1,apellido2,email,curso,ano_academico," +
    "rol,fecha_creacion,activa";

class ErrorAPI extends Error {
    constructor(
        public estado: number,
        mensaje: string
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
            error.estado
        );
    }

    console.error("Error en la gestió d’usuaris:", error);

    return responder(
        {
            success: false,
            mensaje: "No s'ha pogut completar l'operació.",
        },
        500
    );
}

function esRegistro(valor: unknown): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function nivelRol(rol: unknown): number {
    if (typeof rol !== "string") return 0;

    const clave = rol.trim().toLowerCase();

    return Object.hasOwn(NIVELES_ROL, clave)
        ? NIVELES_ROL[clave]
        : 0;
}

/**
 * Lee permisos globales.
 *
 * Admite temporalmente:
 * - Estructura nueva: { globales: {...}, torneos: {...} }
 * - Estructura antigua: { usuaris: {...}, panell: {...} }
 *
 * Un dato mal formado no se interpreta como permiso concedido.
 */
function permisoGlobal(
    usuario: UsuarioAcceso,
    seccion: string,
    accion: string
): boolean {
    const documento = usuario.permisos;

    // Ausencia de configuración: hereda el nivel.
    if (documento === null || documento === undefined) return true;

    if (!esRegistro(documento)) return false;

    let ambito: unknown;

    if (Object.hasOwn(documento, "globales")) {
        ambito = documento.globales;
    } else if (
        Object.hasOwn(documento, "version") ||
        Object.hasOwn(documento, "torneos")
    ) {
        // Documento nuevo sin excepciones globales.
        ambito = {};
    } else {
        // Compatibilidad con el JSON plano anterior.
        ambito = documento;
    }

    if (!esRegistro(ambito)) return false;

    if (!Object.hasOwn(ambito, seccion)) return true;

    const permisosSeccion = ambito[seccion];

    if (!esRegistro(permisosSeccion)) return false;

    if (!Object.hasOwn(permisosSeccion, accion)) return true;

    return permisosSeccion[accion] === true;
}

function puedeGestionarUsuarios(
    usuario: UsuarioAcceso,
    accion: AccionUsuarios
): boolean {
    if (
        nivelRol(usuario.rol) <
        NIVELES_GESTION_USUARIOS[accion]
    ) {
        return false;
    }

    return (
        permisoGlobal(usuario, "panell", "ver") &&
        permisoGlobal(usuario, "usuaris", "ver") &&
        permisoGlobal(usuario, "usuaris", accion)
    );
}

function puedeCambiarBloqueo(
    administrador: UsuarioAcceso,
    destino: UsuarioAcceso,
    accion: "bloquear" | "desbloquear"
): boolean {
    if (!puedeGestionarUsuarios(administrador, accion)) {
        return false;
    }

    if (administrador.id === destino.id) return false;

    // Un rol desconocido se debe revisar antes de modificar la cuenta.
    if (
        destino.rol !== null &&
        destino.rol !== undefined &&
        (
            typeof destino.rol !== "string" ||
            !Object.hasOwn(
                NIVELES_ROL,
                destino.rol.trim().toLowerCase()
            )
        )
    ) {
        return false;
    }

    return nivelRol(administrador.rol) > nivelRol(destino.rol);
}

function obtenerPagina(url: URL): number {
    const valor = url.searchParams.get("pagina") ?? "1";

    if (!/^[1-9]\d*$/.test(valor)) {
        throw new ErrorAPI(400, "La pàgina indicada no és vàlida.");
    }

    const pagina = Number(valor);

    if (!Number.isSafeInteger(pagina) || pagina > 100000) {
        throw new ErrorAPI(400, "La pàgina indicada no és vàlida.");
    }

    return pagina;
}

function resultadoPaginado(
    filas: unknown[],
    total: number,
    pagina: number
) {
    return responder({
        success: true,
        filas,
        total,
        pagina,
        porPagina: POR_PAGINA,
        totalPaginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
    });
}

async function obtenerUsuario(id: string) {
    if (!UUID.test(id)) {
        throw new ErrorAPI(400, "L'identificador no és vàlid.");
    }

    const { data, error } = await supabaseAdmin
        .from("users")
        .select(CAMPOS_USUARIO)
        .eq("id", id)
        .maybeSingle();

    if (error) throw error;

    if (!data) {
        throw new ErrorAPI(404, "No s'ha trobat l'usuari.");
    }

    // La selección anterior excluye contrasena.
    return data as unknown as UsuarioAcceso & {
        nombre: string | null;
        apellido1: string | null;
        apellido2: string | null;
        email: string | null;
        curso: string | null;
        ano_academico: string | null;
        origen_permisos: string | null;
        fecha_creacion: string | null;
        fecha_actualizacion: string | null;
        activa: boolean | null;
    };
}

function obtenerAsignaciones(permisos: unknown): Registro {
    if (!esRegistro(permisos)) return {};

    return esRegistro(permisos.torneos)
        ? permisos.torneos
        : {};
}

function obtenerTorneosAsignados(permisos: unknown): string[] {
    return Object.entries(obtenerAsignaciones(permisos))
        .filter(([id, asignacion]) => {
            return (
                UUID.test(id) &&
                esRegistro(asignacion) &&
                asignacion.acceso === true
            );
        })
        .map(([id]) => id);
}

async function listarUsuarios(url: URL) {
    const pagina = obtenerPagina(url);
    const desde = (pagina - 1) * POR_PAGINA;

    const busqueda = (url.searchParams.get("q") ?? "")
        .trim()
        .slice(0, 120);

    const estado = url.searchParams.get("estado") ?? "";
    const rol = url.searchParams.get("rol") ?? "";

    if (!["", "activos", "bloqueados", "sin-estado"].includes(estado)) {
        throw new ErrorAPI(400, "L'estat indicat no és vàlid.");
    }

    if (
        rol &&
        rol !== "sin-rol" &&
        !Object.hasOwn(NIVELES_ROL, rol)
    ) {
        throw new ErrorAPI(400, "El rol indicat no és vàlid.");
    }

    let consulta = supabaseAdmin
        .from("users")
        .select(CAMPOS_LISTA, { count: "exact" });

    // Se eliminan caracteres de control de los filtros PostgREST.
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
            ].join(",")
        );
    }

    if (estado === "activos") {
        consulta = consulta.eq("activa", true);
    } else if (estado === "bloqueados") {
        consulta = consulta.eq("activa", false);
    } else if (estado === "sin-estado") {
        consulta = consulta.is("activa", null);
    }

    if (rol === "sin-rol") {
        consulta = consulta.is("rol", null);
    } else if (rol) {
        consulta = consulta.eq("rol", rol);
    }

    const { data, error, count } = await consulta
        .order("fecha_creacion", {
            ascending: false,
            nullsFirst: false,
        })
        .order("id", { ascending: true })
        .range(desde, desde + POR_PAGINA - 1);

    if (error) throw error;

    return resultadoPaginado(data ?? [], count ?? 0, pagina);
}

async function listarRelacion(
    usuario: Awaited<ReturnType<typeof obtenerUsuario>>,
    vista: string,
    url: URL
) {
    const pagina = obtenerPagina(url);
    const desde = (pagina - 1) * POR_PAGINA;
    const hasta = desde + POR_PAGINA - 1;

    if (vista === "sesiones") {
        const { data, error, count } = await supabaseAdmin
            .from("sesiones")
            .select(
                "id,estado,fecha_creacion,fecha_actualizacion,fecha_expiracion",
                { count: "exact" }
            )
            .eq("id_usuario", usuario.id)
            .order("fecha_creacion", {
                ascending: false,
                nullsFirst: false,
            })
            .order("id", { ascending: true })
            .range(desde, hasta);

        if (error) throw error;

        const ahora = Date.now();

        const filas = (data ?? []).map((sesion) => {
            const expiracion = sesion.fecha_expiracion
                ? new Date(sesion.fecha_expiracion).getTime()
                : NaN;

            const vigente =
                sesion.estado === "ACTIVA" &&
                Number.isFinite(expiracion) &&
                expiracion > ahora &&
                usuario.activa === true;

            return {
                ...sesion,
                vigente,
            };
        });

        return resultadoPaginado(filas, count ?? 0, pagina);
    }

    if (vista === "verificaciones") {
        const { data, error, count } = await supabaseAdmin
            .from("verificaciones")
            .select(
                "id,tipo,fecha_creacion,fecha_expiracion,usado",
                { count: "exact" }
            )
            .eq("id_usuario", usuario.id)
            .order("fecha_creacion", {
                ascending: false,
                nullsFirst: false,
            })
            .order("id", { ascending: true })
            .range(desde, hasta);

        if (error) throw error;

        return resultadoPaginado(data ?? [], count ?? 0, pagina);
    }

    if (vista !== "torneos" && vista !== "ediciones") {
        throw new ErrorAPI(400, "La consulta indicada no és vàlida.");
    }

    const accesoGeneral = nivelRol(usuario.rol) >= NIVELES_ROL.admin;
    const ids = obtenerTorneosAsignados(usuario.permisos);

    if (!accesoGeneral && ids.length === 0) {
        return resultadoPaginado([], 0, pagina);
    }

    if (vista === "torneos") {
        let consulta = supabaseAdmin
            .from("torneos")
            .select(
                "id,nombre,deporte,activo",
                { count: "exact" }
            );

        if (!accesoGeneral) {
            consulta = consulta.in("id", ids);
        }

        const { data, error, count } = await consulta
            .order("nombre", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true })
            .range(desde, hasta);

        if (error) throw error;

        const asignaciones = obtenerAsignaciones(usuario.permisos);

        const filas = (data ?? []).map((torneo) => {
            const asignacion = asignaciones[torneo.id];

            const rolAsignado =
                esRegistro(asignacion) &&
                typeof asignacion.rol === "string"
                    ? asignacion.rol
                    : null;

            return {
                ...torneo,
                rol_acceso: accesoGeneral
                    ? usuario.rol
                    : rolAsignado,
                origen_acceso: accesoGeneral
                    ? "global"
                    : "asignacion",
            };
        });

        return resultadoPaginado(filas, count ?? 0, pagina);
    }

    let consulta = supabaseAdmin
        .from("ediciones")
        .select(
            "id,torneo_id,nombre,estado,sede,fecha_inicio,fecha_fin",
            { count: "exact" }
        );

    if (!accesoGeneral) {
        consulta = consulta.in("torneo_id", ids);
    }

    const { data, error, count } = await consulta
        .order("fecha_inicio", {
            ascending: false,
            nullsFirst: false,
        })
        .order("id", { ascending: true })
        .range(desde, hasta);

    if (error) throw error;

    // No hay clave foránea: obtenemos los nombres por separado.
    const idsPagina = [
        ...new Set(
            (data ?? [])
                .map((edicion) => edicion.torneo_id)
                .filter(
                    (id): id is string =>
                        typeof id === "string" && UUID.test(id)
                )
        ),
    ];

    const nombres = new Map<string, string | null>();

    if (idsPagina.length > 0) {
        const resultado = await supabaseAdmin
            .from("torneos")
            .select("id,nombre")
            .in("id", idsPagina);

        if (resultado.error) throw resultado.error;

        for (const torneo of resultado.data ?? []) {
            nombres.set(torneo.id, torneo.nombre);
        }
    }

    return resultadoPaginado(
        (data ?? []).map((edicion) => ({
            ...edicion,
            torneo_nombre: nombres.get(edicion.torneo_id) ?? null,
        })),
        count ?? 0,
        pagina
    );
}

export const GET: APIRoute = async ({ cookies, url }) => {
    try {
        const token = cookies.get("token_sesion")?.value;
        const administrador = token
            ? await obtenerUsuarioPorToken(token)
            : null;

        if (!administrador) {
            cookies.delete("token_sesion", { path: "/" });

            throw new ErrorAPI(401, "Has d'iniciar sessió.");
        }

        const vista = url.searchParams.get("vista") ?? "datos";

        // Solo comprueba autenticación; no devuelve datos personales.
        // Se utilizará para detectar una sesión bloqueada o revocada.
        if (vista === "sesion-actual") {
            return responder({
                success: true,
                activa: true,
            });
        }

        if (!puedeGestionarUsuarios(administrador, "ver")) {
            throw new ErrorAPI(
                403,
                "No tens permís per consultar els usuaris."
            );
        }

        const id = url.searchParams.get("id");

        if (!id) {
            if (vista !== "datos") {
                throw new ErrorAPI(400, "Falta l'identificador de l'usuari.");
            }

            return await listarUsuarios(url);
        }

        const usuario = await obtenerUsuario(id);

        if (vista === "datos") {
            return responder({
                success: true,
                usuario,
                capacidades: {
                    bloquear: puedeCambiarBloqueo(
                        administrador,
                        usuario,
                        "bloquear"
                    ),
                    desbloquear: puedeCambiarBloqueo(
                        administrador,
                        usuario,
                        "desbloquear"
                    ),
                },
                relacionesPendientes: [
                    "equips",
                    "participants",
                    "formularis",
                ],
            });
        }

        return await listarRelacion(usuario, vista, url);
    } catch (error) {
        return gestionarError(error);
    }
};

async function revocarSesiones(idUsuario: string) {
    const { error } = await supabaseAdmin
        .from("sesiones")
        .update({
            estado: "REVOCADA",
            fecha_actualizacion: new Date().toISOString(),
        })
        .eq("id_usuario", idUsuario)
        .eq("estado", "ACTIVA");

    if (error) throw error;
}

export const POST: APIRoute = async ({
    request,
    cookies,
    url,
}) => {
    try {
        // Las mutaciones deben proceder del mismo sitio.
        if (request.headers.get("origin") !== url.origin) {
            throw new ErrorAPI(403, "Origen de la petició no permès.");
        }

        const contenido = request.headers.get("content-type") ?? "";

        if (
            contenido.split(";")[0].trim().toLowerCase() !==
            "application/json"
        ) {
            throw new ErrorAPI(415, "El format de la petició no és vàlid.");
        }

        const token = cookies.get("token_sesion")?.value;
        const administrador = token
            ? await obtenerUsuarioPorToken(token)
            : null;

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

        const { id, accion } = cuerpo;

        if (typeof id !== "string" || !UUID.test(id)) {
            throw new ErrorAPI(400, "L'identificador no és vàlid.");
        }

        if (accion !== "bloquear" && accion !== "desbloquear") {
            throw new ErrorAPI(400, "L'acció indicada no és vàlida.");
        }

        if (!puedeGestionarUsuarios(administrador, accion)) {
            throw new ErrorAPI(
                403,
                "No tens permís per fer aquesta acció."
            );
        }

        const usuario = await obtenerUsuario(id);

        if (!puedeCambiarBloqueo(administrador, usuario, accion)) {
            throw new ErrorAPI(
                403,
                "No pots modificar el bloqueig d'aquest usuari."
            );
        }

        const nuevaActiva = accion === "desbloquear";

        // Antes de reactivar, revocamos las sesiones anteriores.
        // Si falla, no se reactiva la cuenta.
        if (nuevaActiva) {
            await revocarSesiones(id);
        }

        const fechaActualizacion = new Date().toISOString();

        let actualizacion = supabaseAdmin
            .from("users")
            .update({
                activa: nuevaActiva,
                fecha_actualizacion: fechaActualizacion,
            })
            .eq("id", id);

        // Evita sobrescribir una modificación concurrente.
        actualizacion = usuario.fecha_actualizacion === null
            ? actualizacion.is("fecha_actualizacion", null)
            : actualizacion.eq(
                "fecha_actualizacion",
                usuario.fecha_actualizacion
            );

        actualizacion = usuario.rol === null || usuario.rol === undefined
            ? actualizacion.is("rol", null)
            : actualizacion.eq("rol", usuario.rol);

        actualizacion = usuario.activa === null
            ? actualizacion.is("activa", null)
            : actualizacion.eq("activa", usuario.activa);

        const { data, error } = await actualizacion
            .select("id,activa,fecha_actualizacion")
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            throw new ErrorAPI(
                409,
                "L'usuari ha canviat. Actualitza la fitxa i torna-ho a provar."
            );
        }

        if (!nuevaActiva) {
            try {
                // Primero se bloquea la cuenta y después se revocan.
                // Si falla la revocación, la cuenta sigue bloqueada.
                await revocarSesiones(id);
            } catch (error) {
                console.error(
                    "Compte bloquejat amb revocació pendent:",
                    error
                );

                throw new ErrorAPI(
                    503,
                    "El compte està bloquejat, però no s'han pogut revocar totes les sessions. Torna a executar el bloqueig."
                );
            }
        }

        return responder({
            success: true,
            mensaje: nuevaActiva
                ? "Usuari desbloquejat. Haurà d'iniciar una sessió nova."
                : "Usuari bloquejat i sessions revocades.",
            usuario: data,
        });
    } catch (error) {
        return gestionarError(error);
    }
};