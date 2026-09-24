import type { APIRoute } from "astro";
import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@utils/supabase";
import { notificarInscripcionVoluntarioEnviada } from "@utils/inscripcio/voluntariEmails";
import {
    ErrorAPI,
    UUID,
    comprobarOrigen,
    exigirUsuario,
    leerJSON,
    obtenerUsuario,
    responder,
} from "@utils/inscripcio/equipBase";

export const prerender = false;

type Registro = Record<string, unknown>;

type Curso = {
    curso: string;
    grupos: string[];
};

type Tipo = {
    id: string;
    nombre: string;
    maximo: number | null;
    alSuperar: string;
};

function registro(valor: unknown): valor is Registro {
    return (
        valor !== null &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    );
}

function texto(
    valor: unknown,
    nombre: string,
    maximo: number,
    obligatorio = false,
): string {
    if (typeof valor !== "string" || valor.length > maximo) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} no és vàlid.`,
        );
    }

    const limpio = valor.trim();

    if (obligatorio && !limpio) {
        throw new ErrorAPI(
            400,
            `El camp ${nombre} és obligatori.`,
        );
    }

    return limpio;
}

function edicionValida(valor: unknown): string {
    if (
        typeof valor !== "string" ||
        !UUID.test(valor)
    ) {
        throw new ErrorAPI(
            400,
            "L'identificador de l'edició no és vàlid.",
        );
    }

    return valor;
}

function cursosConfigurados(valor: unknown): Curso[] {
    if (!Array.isArray(valor)) {
        return [];
    }

    return valor
        .filter(registro)
        .flatMap(entrada => {
            if (
                typeof entrada.curso !== "string" ||
                !entrada.curso.trim()
            ) {
                return [];
            }

            const grupos = Array.isArray(entrada.grupos)
                ? entrada.grupos
                    .filter(
                        (grupo): grupo is string =>
                            typeof grupo === "string",
                    )
                    .map(grupo => grupo.trim())
                    .filter(Boolean)
                : [];

            return [{
                curso: entrada.curso.trim(),
                grupos,
            }];
        });
}

function tiposConfigurados(valor: unknown): Tipo[] {
    if (!Array.isArray(valor)) {
        return [];
    }

    return valor
        .filter(registro)
        .flatMap(entrada => {
            if (
                entrada.activo === false ||
                typeof entrada.id !== "string" ||
                !entrada.id.trim() ||
                typeof entrada.nombre !== "string" ||
                !entrada.nombre.trim()
            ) {
                return [];
            }

            const cupo = registro(entrada.cupo)
                ? entrada.cupo
                : {};

            return [{
                id: entrada.id.trim(),
                nombre: entrada.nombre.trim(),
                maximo:
                    typeof cupo.maximo === "number" &&
                    Number.isFinite(cupo.maximo)
                        ? cupo.maximo
                        : null,
                alSuperar:
                    typeof cupo.al_superar === "string"
                        ? cupo.al_superar
                        : "permitir",
            }];
        });
}

async function contexto(edicionID: string) {
    const [edicion, configuracion, plataforma] =
        await Promise.all([
            supabaseAdmin
                .from("ediciones")
                .select("id,estado")
                .eq("id", edicionID)
                .maybeSingle(),

            supabaseAdmin
                .from("configuracion_ediciones")
                .select("voluntarios")
                .eq("edicion_id", edicionID)
                .maybeSingle(),

            supabaseAdmin
                .from("configuracion_plataforma")
                .select("cursos,created_at")
                .order("created_at", {
                    ascending: true,
                    nullsFirst: false,
                })
                .limit(1),
        ]);

    if (edicion.error) throw edicion.error;
    if (configuracion.error) throw configuracion.error;
    if (plataforma.error) throw plataforma.error;

    if (!edicion.data) {
        throw new ErrorAPI(
            404,
            "No s'ha trobat l'edició.",
        );
    }

    const ajustes = registro(configuracion.data?.voluntarios)
        ? configuracion.data.voluntarios
        : {};

    const inscripcion = registro(ajustes.inscripcion)
        ? ajustes.inscripcion
        : {};

    const cupo = registro(ajustes.cupo)
        ? ajustes.cupo
        : {};

    const apertura =
        typeof inscripcion.apertura === "string"
            ? Date.parse(inscripcion.apertura)
            : NaN;

    const cierre =
        typeof inscripcion.cierre === "string"
            ? Date.parse(inscripcion.cierre)
            : NaN;

    const ahora = Date.now();

    const edicionActiva = [
        "activa",
        "activo",
        "actiu",
    ].includes(
        (edicion.data.estado ?? "")
            .trim()
            .toLowerCase(),
    );

    const disponible =
        edicionActiva &&
        Number.isFinite(apertura) &&
        Number.isFinite(cierre) &&
        ahora >= apertura &&
        ahora <= cierre;

    const mensaje = !edicionActiva
        ? "Aquesta edició no admet inscripcions noves."
        : !Number.isFinite(apertura) ||
            !Number.isFinite(cierre)
            ? "El període d'inscripció encara no està configurat."
            : ahora < apertura
                ? "Les inscripcions encara no estan obertes."
                : "El període d'inscripció ha finalitzat.";

    return {
        ajustes,
        cupo,
        cursos: cursosConfigurados(
            plataforma.data?.[0]?.cursos,
        ),
        tipos: tiposConfigurados(ajustes.tipos),
        disponible,
        mensaje,
    };
}

async function solicitudDe(
    edicionID: string,
    usuarioID: string,
) {
    const {
        data: formulario,
        error: errorFormulario,
    } = await supabaseAdmin
        .from("formularios")
        .select(
            "id,estado,configuracion_snapshot,email_contacto",
        )
        .eq("edicion_id", edicionID)
        .eq("usuario_id", usuarioID)
        .eq("tipo", "VOLUNTARIO")
        .order("created_at", {
            ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (errorFormulario) {
        throw errorFormulario;
    }

    if (!formulario) {
        return null;
    }

    const {
        data: voluntario,
        error: errorVoluntario,
    } = await supabaseAdmin
        .from("voluntarios")
        .select(
            "id,formulario_id,nombre,apellido1,apellido2,email,curso,grupo,tipo_voluntariado_id,tipo_voluntariado,descripcion,validacion_estado,plaza_estado",
        )
        .eq("formulario_id", formulario.id)
        .maybeSingle();

    if (errorVoluntario) {
        throw errorVoluntario;
    }

    if (!voluntario) {
        throw new Error(
            "Hi ha un formulari sense dades de voluntariat.",
        );
    }

    return {
        formulario,
        voluntario,
    };
}

function estadoSolicitud(
    formulario: { estado: string | null },
    voluntario: { validacion_estado: string | null },
): string {
    const estado = voluntario.validacion_estado
        ?.trim()
        .toUpperCase();

    if (
        estado === "APROBADO" ||
        estado === "ACEPTADO" ||
        estado === "DENEGADO"
    ) {
        return estado;
    }

    return formulario.estado
        ?.trim()
        .toUpperCase() ?? "EN_REVISION";
}

function respuestaSolicitud(
    solicitud: NonNullable<
        Awaited<ReturnType<typeof solicitudDe>>
    >,
    tipos: Tipo[],
) {
    const {
        formulario,
        voluntario,
    } = solicitud;

    const snapshot = registro(
        formulario.configuracion_snapshot,
    )
        ? formulario.configuracion_snapshot
        : {};

    const rol = registro(snapshot.rol)
        ? snapshot.rol
        : {};

    const idRol =
        typeof rol.id === "string"
            ? rol.id
            : (
                voluntario.tipo_voluntariado_id ??
                tipos.find(
                    tipo =>
                        tipo.nombre ===
                        voluntario.tipo_voluntariado,
                )?.id ??
                ""
            );

    return {
        id: voluntario.id,
        estado: estadoSolicitud(
            formulario,
            voluntario,
        ),
        plaza_estado: voluntario.plaza_estado,
        nombre: voluntario.nombre ?? "",
        apellido1: voluntario.apellido1 ?? "",
        apellido2: voluntario.apellido2 ?? "",
        email:
            voluntario.email ??
            formulario.email_contacto ??
            "",
        curso: voluntario.curso ?? "",
        grupo: voluntario.grupo ?? "",
        tipo_voluntariado_id: idRol,
        tipo_voluntariado:
            voluntario.tipo_voluntariado,
        descripcion: voluntario.descripcion ?? "",
    };
}

function validarCurso(
    cursos: Curso[],
    curso: string,
    grupo: string,
) {
    const existe = cursos.some(
        entrada =>
            entrada.curso === curso &&
            entrada.grupos.includes(grupo),
    );

    if (!existe) {
        throw new ErrorAPI(
            400,
            "Selecciona un curs i un grup configurats.",
        );
    }
}

async function contarOcupadas(
    edicionID: string,
    rol?: string,
): Promise<number> {
    let consulta = supabaseAdmin
        .from("voluntarios")
        .select(
            "id,formularios!inner(edicion_id)",
            {
                count: "exact",
                head: true,
            },
        )
        .eq("formularios.edicion_id", edicionID)
        .in(
            "plaza_estado",
            ["PENDIENTE", "CONFIRMADA"],
        );

    if (rol) {
        consulta = consulta.eq(
            "tipo_voluntariado",
            rol,
        );
    }

    const {
        count,
        error,
    } = await consulta;

    if (error) {
        throw error;
    }

    return count ?? 0;
}

async function plazaNueva(
    edicionID: string,
    cupo: Registro,
    tipo: Tipo,
): Promise<string> {
    let plaza = "PENDIENTE";

    const reglas = [
        {
            maximo: cupo.maximo,
            accion: cupo.al_superar,
        },
        {
            maximo: tipo.maximo,
            accion: tipo.alSuperar,
            rol: tipo.nombre,
        },
    ];

    for (const regla of reglas) {
        if (
            typeof regla.maximo !== "number" ||
            !Number.isFinite(regla.maximo)
        ) {
            continue;
        }

        const ocupadas = await contarOcupadas(
            edicionID,
            regla.rol,
        );

        if (ocupadas < regla.maximo) {
            continue;
        }

        if (regla.accion === "bloquear") {
            throw new ErrorAPI(
                409,
                "Ja no queden places per a aquest tipus de voluntariat.",
            );
        }

        if (regla.accion === "lista_espera") {
            plaza = "LISTA_ESPERA";
        }
    }

    return plaza;
}

function errorRespuesta(error: unknown): Response {
    if (error instanceof ErrorAPI) {
        return responder(
            {
                success: false,
                mensaje: error.message,
            },
            error.estado,
        );
    }

    console.error(
        "Error en la inscripció de voluntariat:",
        error,
    );

    return responder(
        {
            success: false,
            mensaje:
                "No s'ha pogut completar l'operació.",
        },
        500,
    );
}

export const GET: APIRoute = async ({
    cookies,
    url,
}) => {
    try {
        const edicionID = edicionValida(
            url.searchParams.get("edicionID"),
        );

        const [ajustes, usuario] = await Promise.all([
            contexto(edicionID),
            obtenerUsuario(cookies),
        ]);

        const solicitud = usuario
            ? await solicitudDe(
                edicionID,
                usuario.id,
            )
            : null;

        return responder({
            success: true,
            disponible: ajustes.disponible,
            mensaje: ajustes.disponible
                ? null
                : ajustes.mensaje,
            sesion: {
                iniciada: Boolean(usuario),
                usuario: usuario
                    ? {
                        nombre: usuario.nombre,
                        apellido1: usuario.apellido1,
                        apellido2: usuario.apellido2,
                        email: usuario.email,
                    }
                    : null,
            },
            cursos: ajustes.cursos,
            tipos: ajustes.tipos.map(tipo => ({
                id: tipo.id,
                nombre: tipo.nombre,
            })),
            formulario: solicitud
                ? respuestaSolicitud(
                    solicitud,
                    ajustes.tipos,
                )
                : null,
        });
    } catch (error) {
        return errorRespuesta(error);
    }
};

export const POST: APIRoute = async ({
    cookies,
    request,
    url,
}) => {
    try {
        comprobarOrigen(request, url);

        const usuario = await exigirUsuario(cookies);
        const entrada = await leerJSON(request);
        const edicionID = edicionValida(
            entrada.edicionID,
        );

        const ajustes = await contexto(edicionID);

        if (!ajustes.disponible) {
            throw new ErrorAPI(
                403,
                ajustes.mensaje,
            );
        }

        if (
            await solicitudDe(
                edicionID,
                usuario.id,
            )
        ) {
            throw new ErrorAPI(
                409,
                "Ja tens una sol·licitud per a aquesta edició.",
            );
        }

        const nombre = texto(
            entrada.nombre,
            "nom",
            100,
            true,
        );

        const apellido1 = texto(
            entrada.apellido1,
            "primer llinatge",
            100,
            true,
        );

        const apellido2 = texto(
            entrada.apellido2,
            "segon llinatge",
            100,
        );

        const email = texto(
            entrada.email,
            "correu electrònic",
            254,
            true,
        );

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email,
            )
        ) {
            throw new ErrorAPI(
                400,
                "El correu electrònic no és vàlid.",
            );
        }

        const curso = texto(
            entrada.curso,
            "curs",
            100,
            true,
        );

        const grupo = texto(
            entrada.grupo,
            "grup",
            100,
            true,
        );

        validarCurso(
            ajustes.cursos,
            curso,
            grupo,
        );

        const descripcion = texto(
            entrada.descripcion,
            "descripció",
            2000,
        );

        const rolID = texto(
            entrada.tipo_voluntariado_id,
            "rol",
            150,
            true,
        );

        const rol = ajustes.tipos.find(
            tipo => tipo.id === rolID,
        );

        if (!rol) {
            throw new ErrorAPI(
                400,
                "Aquest rol no està disponible.",
            );
        }

        const plazaEstado = await plazaNueva(
            edicionID,
            ajustes.cupo,
            rol,
        );

        /*
         * El ID del rol configurado solo se guarda como FK si
         * es un UUID que existe en tipos_voluntariado.
         */
        let tipoVoluntariadoID: string | null = null;

        if (UUID.test(rol.id)) {
            const {
                data: tipoDB,
                error: errorTipo,
            } = await supabaseAdmin
                .from("tipos_voluntariado")
                .select("id")
                .eq("id", rol.id)
                .maybeSingle();

            if (errorTipo) {
                throw errorTipo;
            }

            tipoVoluntariadoID =
                tipoDB?.id ?? null;
        }

        const ahora = new Date().toISOString();
        const formularioID = randomUUID();

        const {
            error: errorFormulario,
        } = await supabaseAdmin
            .from("formularios")
            .insert({
                id: formularioID,
                edicion_id: edicionID,
                tipo: "VOLUNTARIO",
                origen: "USUARIO",
                estado: "EN_REVISION",
                usuario_id: usuario.id,
                email_contacto: email,
                acceso_capitan: false,
                configuracion_snapshot: {
                    voluntarios: ajustes.ajustes,
                    rol: {
                        id: rol.id,
                        nombre: rol.nombre,
                    },
                },
                iniciado_at: ahora,
                enviado_at: ahora,
                completado_at: null,
                created_at: ahora,
                updated_at: ahora,
            });

        if (errorFormulario) {
            throw errorFormulario;
        }

        const {
            error: errorVoluntario,
        } = await supabaseAdmin
            .from("voluntarios")
            .insert({
                formulario_id: formularioID,
                nombre,
                apellido1,
                apellido2,
                email,
                curso,
                grupo,
                tipo_voluntariado_id:
                    tipoVoluntariadoID,
                tipo_voluntariado: rol.nombre,
                descripcion,
                validacion_estado: "PENDIENTE",
                plaza_estado: plazaEstado,
                posicion_lista_espera: null,
                created_at: ahora,
                updated_at: ahora,
            });

        if (errorVoluntario) {
            const {
                error: errorLimpieza,
            } = await supabaseAdmin
                .from("formularios")
                .delete()
                .eq("id", formularioID)
                .eq("usuario_id", usuario.id);

            if (errorLimpieza) {
                console.error(
                    "No s'ha pogut retirar el formulari incomplet:",
                    errorLimpieza,
                );
            }

            throw errorVoluntario;
        }

        /*
         * La inscripción ya está guardada. Un fallo del
         * correo no elimina los datos enviados.
         */
        try {
            const resultado =
                await notificarInscripcionVoluntarioEnviada(
                    formularioID,
                );

            if (resultado.enviados > 0) {
                console.info(
                    `[EMAIL] Voluntariat ${formularioID}: ${resultado.enviados} correu(s) enviat(s).`,
                );
            }

            if (resultado.fallidos > 0) {
                console.error(
                    `[EMAIL] Voluntariat ${formularioID}: han fallat ${resultado.fallidos} de ${resultado.destinatarios} correus.`,
                );
            }
        } catch (errorEmail) {
            console.error(
                `[EMAIL] La sol·licitud ${formularioID} s'ha guardat, però no s'ha pogut enviar la notificació:`,
                errorEmail,
            );
        }

        return responder(
            { success: true },
            201,
        );
    } catch (error) {
        return errorRespuesta(error);
    }
};

export const PATCH: APIRoute = async ({
    cookies,
    request,
    url,
}) => {
    try {
        comprobarOrigen(request, url);

        const usuario = await exigirUsuario(cookies);
        const entrada = await leerJSON(request);
        const edicionID = edicionValida(
            entrada.edicionID,
        );

        const solicitud = await solicitudDe(
            edicionID,
            usuario.id,
        );

        if (!solicitud) {
            throw new ErrorAPI(
                404,
                "No s'ha trobat la teva sol·licitud.",
            );
        }

        const estado = estadoSolicitud(
            solicitud.formulario,
            solicitud.voluntario,
        );

        if (
            estado !== "APROBADO" &&
            estado !== "ACEPTADO"
        ) {
            throw new ErrorAPI(
                403,
                "Aquesta sol·licitud no es pot modificar ara.",
            );
        }

        const ajustes = await contexto(edicionID);

        const email = texto(
            entrada.email,
            "correu electrònic",
            254,
            true,
        );

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                email,
            )
        ) {
            throw new ErrorAPI(
                400,
                "El correu electrònic no és vàlid.",
            );
        }

        const curso = texto(
            entrada.curso,
            "curs",
            100,
            true,
        );

        const grupo = texto(
            entrada.grupo,
            "grup",
            100,
            true,
        );

        const cambiaCurso =
            curso !==
                (solicitud.voluntario.curso ?? "") ||
            grupo !==
                (solicitud.voluntario.grupo ?? "");

        /*
         * Un curso antiguo puede haberse eliminado de la
         * configuración. Se valida si el voluntario lo cambia.
         */
        if (cambiaCurso) {
            validarCurso(
                ajustes.cursos,
                curso,
                grupo,
            );
        }

        if (
            email ===
                (solicitud.voluntario.email ?? "") &&
            !cambiaCurso
        ) {
            return responder({ success: true });
        }

        const ahora = new Date().toISOString();

        const {
            error: errorVoluntario,
        } = await supabaseAdmin
            .from("voluntarios")
            .update({
                email,
                curso,
                grupo,
                updated_at: ahora,
            })
            .eq("id", solicitud.voluntario.id)
            .eq(
                "formulario_id",
                solicitud.formulario.id,
            );

        if (errorVoluntario) {
            throw errorVoluntario;
        }

        const {
            error: errorContacto,
        } = await supabaseAdmin
            .from("formularios")
            .update({
                email_contacto: email,
                updated_at: ahora,
            })
            .eq("id", solicitud.formulario.id)
            .eq("usuario_id", usuario.id);

        if (errorContacto) {
            console.error(
                "No s'ha pogut actualitzar el correu del formulari:",
                errorContacto,
            );

            const {
                error: errorRestauracion,
            } = await supabaseAdmin
                .from("voluntarios")
                .update({
                    email:
                        solicitud.voluntario.email,
                    curso:
                        solicitud.voluntario.curso,
                    grupo:
                        solicitud.voluntario.grupo,
                    updated_at: ahora,
                })
                .eq(
                    "id",
                    solicitud.voluntario.id,
                )
                .eq(
                    "formulario_id",
                    solicitud.formulario.id,
                );

            if (errorRestauracion) {
                console.error(
                    "No s'han pogut restaurar les dades del voluntari:",
                    errorRestauracion,
                );
            }

            throw new ErrorAPI(
                500,
                "No s'ha pogut completar l'actualització.",
            );
        }

        return responder({ success: true });
    } catch (error) {
        return errorRespuesta(error);
    }
};