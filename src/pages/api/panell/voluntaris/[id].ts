import type { APIRoute } from "astro";
import { tienePermiso } from "@const/Permisos";
import { supabaseAdmin } from "@utils/supabase";
import {
    ErrorAPI, UUID, comprobarOrigen, exigirUsuario, leerJSON, responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

type Registro = Record<string, unknown>;

function registro(valor: unknown): valor is Registro {
    return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function identificador(valor: unknown, nombre: string): string {
    if (typeof valor !== "string" || !UUID.test(valor)) {
        throw new ErrorAPI(400, `L'identificador de ${nombre} no és vàlid.`);
    }
    return valor.toLowerCase();
}

function texto(valor: unknown, nombre: string, maximo: number, obligatorio = false): string {
    if (typeof valor !== "string" || valor.length > maximo) {
        throw new ErrorAPI(400, `El camp ${nombre} no és vàlid.`);
    }
    const limpio = valor.trim();
    if (obligatorio && !limpio) throw new ErrorAPI(400, `El camp ${nombre} és obligatori.`);
    return limpio;
}

function errorRespuesta(error: unknown): Response {
    if (error instanceof ErrorAPI) {
        return responder({ success: false, mensaje: error.message }, error.estado);
    }
    console.error("Error en la fitxa del voluntari:", error);
    return responder({ success: false, mensaje: "No s'ha pogut completar l'operació." }, 500);
}

async function contexto(
    cookies: Parameters<APIRoute>[0]["cookies"],
    torneoID: string,
    edicionID: string,
    voluntarioID: string,
    accion: "ver" | "editar",
) {
    const administrador = await exigirUsuario(cookies);
    if (!tienePermiso(administrador, "voluntaris", accion, torneoID)) {
        throw new ErrorAPI(403, "No tens permís per gestionar aquest voluntari.");
    }
    const { data: edicion, error: errorEdicion } = await supabaseAdmin.from("ediciones")
        .select("id,torneo_id,nombre").eq("id", edicionID).maybeSingle();
    if (errorEdicion) throw errorEdicion;
    if (edicion?.torneo_id?.toLowerCase() !== torneoID) {
        throw new ErrorAPI(404, "L'edició no pertany a aquest torneig.");
    }

    const { data: voluntario, error: errorVoluntario } = await supabaseAdmin
        .from("voluntarios")
        .select("id,formulario_id,nombre,apellido1,apellido2,email,curso,grupo,genero,tipo_voluntariado_id,tipo_voluntariado,descripcion,validacion_estado,plaza_estado,posicion_lista_espera,nota_admin,created_at,updated_at")
        .eq("id", voluntarioID).maybeSingle();
    if (errorVoluntario) throw errorVoluntario;
    if (!voluntario) throw new ErrorAPI(404, "No s'ha trobat el voluntari.");

    const { data: formulario, error: errorFormulario } = await supabaseAdmin
        .from("formularios")
        .select("id,edicion_id,usuario_id,tipo,origen,estado,email_contacto,configuracion_snapshot,enviado_at,created_at,updated_at")
        .eq("id", voluntario.formulario_id)
        .eq("edicion_id", edicionID)
        .eq("tipo", "VOLUNTARIO")
        .maybeSingle();
    if (errorFormulario) throw errorFormulario;
    if (!formulario) throw new ErrorAPI(404, "El voluntari no pertany a aquesta edició.");
    return { administrador, edicion, voluntario, formulario };
}

export const GET: APIRoute = async ({ cookies, params, url }) => {
    try {
        const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");
        const edicionID = identificador(url.searchParams.get("edicionID"), "edició");
        const voluntarioID = identificador(params.id, "voluntari");
        const { administrador, edicion, voluntario, formulario } = await contexto(
            cookies, torneoID, edicionID, voluntarioID, "ver",
        );

        const [{ data: configuracion, error: errorConfig }, { data: plataforma, error: errorCursos }] = await Promise.all([
            supabaseAdmin.from("configuracion_ediciones").select("voluntarios")
                .eq("edicion_id", edicionID).maybeSingle(),
            supabaseAdmin.from("configuracion_plataforma").select("cursos,created_at")
                .order("created_at", { ascending: true, nullsFirst: false }).limit(1),
        ]);
        if (errorConfig) throw errorConfig;
        if (errorCursos) throw errorCursos;
        const ajustes = registro(configuracion?.voluntarios) ? configuracion.voluntarios : {};
        const tipos = Array.isArray(ajustes.tipos) ? ajustes.tipos.filter(registro)
            .filter(tipo => tipo.activo !== false && typeof tipo.id === "string" && typeof tipo.nombre === "string")
            .map(tipo => ({ id: tipo.id, nombre: tipo.nombre })) : [];
        const snapshot = registro(formulario.configuracion_snapshot) ? formulario.configuracion_snapshot : {};
        const rol = registro(snapshot.rol) ? snapshot.rol : {};

        return responder({
            success: true,
            edicion: { id: edicion.id, nombre: edicion.nombre },
            formulario: {
                id: formulario.id,
                usuario_id: formulario.usuario_id,
                origen: formulario.origen,
                estado: formulario.estado,
                enviado_at: formulario.enviado_at,
                email_contacto: formulario.email_contacto,
            },
            voluntario: {
                ...voluntario,
                tipo_configuracion_id: typeof rol.id === "string" ? rol.id : voluntario.tipo_voluntariado_id,
            },
            cursos: Array.isArray(plataforma?.[0]?.cursos) ? plataforma[0].cursos : [],
            tipos,
            capacidades: {
                editar: tienePermiso(administrador, "voluntaris", "editar", torneoID),
                eliminar: tienePermiso(administrador, "voluntaris", "eliminar", torneoID),
            },
        });
    } catch (error) {
        return errorRespuesta(error);
    }
};

export const PATCH: APIRoute = async ({ cookies, params, request, url }) => {
    try {
        comprobarOrigen(request, url);
        const torneoID = identificador(url.searchParams.get("torneoID"), "torneig");
        const edicionID = identificador(url.searchParams.get("edicionID"), "edició");
        const voluntarioID = identificador(params.id, "voluntari");
        const { voluntario, formulario } = await contexto(
            cookies, torneoID, edicionID, voluntarioID, "editar",
        );
        const entrada = await leerJSON(request);

        const nombre = texto(entrada.nombre, "nom", 100, true);
        const apellido1 = texto(entrada.apellido1, "primer llinatge", 100, true);
        const apellido2 = texto(entrada.apellido2, "segon llinatge", 100);
        const email = texto(entrada.email, "correu electrònic", 254, true);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new ErrorAPI(400, "El correu electrònic no és vàlid.");
        }
        const curso = texto(entrada.curso, "curs", 100, true);
        const grupo = texto(entrada.grupo, "grup", 100, true);
        const descripcion = texto(entrada.descripcion, "presentació", 2000);
        const notaAdmin = texto(entrada.nota_admin, "nota administrativa", 2000);
        const rolID = texto(entrada.tipo_voluntariado_id, "tipus de voluntariat", 150, true);

        if (curso !== voluntario.curso || grupo !== voluntario.grupo) {
            const { data: plataforma, error } = await supabaseAdmin.from("configuracion_plataforma")
                .select("cursos,created_at")
                .order("created_at", { ascending: true, nullsFirst: false }).limit(1);
            if (error) throw error;
            const cursos = plataforma?.[0]?.cursos;
            if (!Array.isArray(cursos) || !cursos.some(opcion =>
                registro(opcion) && opcion.curso === curso &&
                Array.isArray(opcion.grupos) && opcion.grupos.includes(grupo))) {
                throw new ErrorAPI(400, "Selecciona un curs i un grup configurats.");
            }
        }

        const snapshot = registro(formulario.configuracion_snapshot) ? formulario.configuracion_snapshot : {};
        const rolAnterior = registro(snapshot.rol) ? snapshot.rol : {};
        const idAnterior = typeof rolAnterior.id === "string"
            ? rolAnterior.id : voluntario.tipo_voluntariado_id;
        let rolNombre = voluntario.tipo_voluntariado;
        let tipoDB: string | null = voluntario.tipo_voluntariado_id;
        let nuevoSnapshot = formulario.configuracion_snapshot;

        if (rolID !== idAnterior) {
            const { data: configuracion, error } = await supabaseAdmin
                .from("configuracion_ediciones").select("voluntarios")
                .eq("edicion_id", edicionID).maybeSingle();
            if (error) throw error;
            const ajustes = registro(configuracion?.voluntarios) ? configuracion.voluntarios : {};
            const tipos = Array.isArray(ajustes.tipos) ? ajustes.tipos : [];
            const tipo = tipos.find(opcion => registro(opcion) && opcion.activo !== false &&
                opcion.id === rolID && typeof opcion.nombre === "string" && Boolean(opcion.nombre.trim()));
            if (!registro(tipo) || typeof tipo.nombre !== "string") {
                throw new ErrorAPI(400, "Aquest tipus de voluntariat no està disponible.");
            }
            rolNombre = tipo.nombre.trim();
            tipoDB = null;
            if (UUID.test(rolID)) {
                const { data: existente, error: errorTipo } = await supabaseAdmin
                    .from("tipos_voluntariado").select("id").eq("id", rolID).maybeSingle();
                if (errorTipo) throw errorTipo;
                tipoDB = existente?.id ?? null;
            }
            nuevoSnapshot = { ...snapshot, rol: { id: rolID, nombre: rolNombre } };
        }

        const ahora = new Date().toISOString();
        const anteriores = {
            nombre: voluntario.nombre, apellido1: voluntario.apellido1,
            apellido2: voluntario.apellido2, email: voluntario.email,
            curso: voluntario.curso, grupo: voluntario.grupo,
            descripcion: voluntario.descripcion, nota_admin: voluntario.nota_admin,
            tipo_voluntariado_id: voluntario.tipo_voluntariado_id,
            tipo_voluntariado: voluntario.tipo_voluntariado,
        };

        const { data: guardado, error: errorVoluntario } = await supabaseAdmin
            .from("voluntarios").update({
                nombre, apellido1, apellido2, email, curso, grupo, descripcion,
                nota_admin: notaAdmin, tipo_voluntariado_id: tipoDB,
                tipo_voluntariado: rolNombre, updated_at: ahora,
            }).eq("id", voluntario.id).eq("formulario_id", formulario.id)
            .select("id").maybeSingle();
        if (errorVoluntario) throw errorVoluntario;
        if (!guardado) throw new ErrorAPI(409, "La fitxa del voluntari ha canviat.");

        const { data: formularioGuardado, error: errorFormulario } = await supabaseAdmin
            .from("formularios").update({
                email_contacto: email,
                configuracion_snapshot: nuevoSnapshot,
                updated_at: ahora,
            }).eq("id", formulario.id).eq("edicion_id", edicionID)
            .select("id").maybeSingle();
        if (errorFormulario || !formularioGuardado) {
            const { error: errorRestauracion } = await supabaseAdmin.from("voluntarios")
                .update({ ...anteriores, updated_at: ahora })
                .eq("id", voluntario.id).eq("formulario_id", formulario.id);
            if (errorRestauracion) console.error("No s'ha pogut restaurar el voluntari:", errorRestauracion);
            if (errorFormulario) throw errorFormulario;
            throw new ErrorAPI(409, "El formulari ha canviat durant l'edició.");
        }

        return responder({ success: true, voluntario_id: voluntario.id });
    } catch (error) {
        return errorRespuesta(error);
    }
};