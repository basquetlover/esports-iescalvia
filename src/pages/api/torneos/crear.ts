import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import { tienePermiso, tieneAccesoTorneo } from "@const/Permisos";

// Crear y actualizar comparten validación y subida de imágenes en este archivo.
const guardarTorneo: APIRoute = async ({ request, cookies, url }) => {
    const archivosSubidos: string[] = [];
    let guardado = false;

    let asignacionCreada: {
        usuarioID: string;
        anterior: unknown;
        nueva: Record<string, unknown>;
    } | null = null;

    try {
        // Sesión y permisos: siempre antes de leer datos o subir archivos.
        const token = cookies.get("token_sesion")?.value;
        const usuario = token
            ? await obtenerUsuarioPorToken(token)
            : null;

        if (!usuario) {
            return Response.json(
                {
                    mensaje: "Has d'iniciar sessió.",
                    errores: {}
                },
                { status: 401 }
            );
        }

        const editando = request.method === "PATCH";

        const torneoID = editando
            ? url.searchParams.get("torneoID")
            : crypto.randomUUID();

        if (
            !torneoID ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                torneoID
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "L'identificador del torneig no és vàlid.",
                    errores: {}
                },
                { status: 400 }
            );
        }

        if (
            !tienePermiso(usuario, "panell") ||
            !tienePermiso(
                usuario,
                "tornejos",
                editando ? "editar" : "crear",
                editando ? torneoID : undefined
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "No tens permís per gestionar aquest torneig.",
                    errores: {}
                },
                { status: 403 }
            );
        }

        if (request.headers.get("origin") !== url.origin) {
            return Response.json(
                {
                    mensaje: "Origen de la petició no vàlid.",
                    errores: {}
                },
                { status: 403 }
            );
        }

        if (
            !request.headers
                .get("content-type")
                ?.startsWith("multipart/form-data")
        ) {
            return Response.json(
                {
                    mensaje:
                        "El formulari no té un format vàlid.",
                    errores: {}
                },
                { status: 400 }
            );
        }

        // Datos actuales: conservar imágenes y normativa antiguas al editar.
        let torneoActual: {
            logo: string | null;
            banner: string | null;
            normativa_base: string | null;
            updated_at: string | null;
        } | null = null;

        if (editando) {
            const { data, error } = await supabaseAdmin
                .from("torneos")
                .select(
                    "logo, banner, normativa_base, updated_at"
                )
                .eq("id", torneoID)
                .maybeSingle();

            if (error) {
                throw error;
            }

            if (!data) {
                return Response.json(
                    {
                        mensaje: "No s'ha trobat el torneig.",
                        errores: {}
                    },
                    { status: 404 }
                );
            }

            torneoActual = data;
        }

        let formulario: FormData;

        try {
            formulario = await request.formData();
        } catch {
            return Response.json(
                {
                    mensaje:
                        "El formulari no té un format vàlid.",
                    errores: {}
                },
                { status: 400 }
            );
        }

        const nombre = formulario.get("nombre");
        const deporte = formulario.get("deporte");
        const descripcion = formulario.get("descripcion");
        const normativa = formulario.get("normativa");

        if (
            typeof nombre !== "string" ||
            !nombre.trim()
        ) {
            return Response.json(
                {
                    mensaje: "Indica el nom del torneig.",
                    errores: {
                        nombre: "Indica el nom del torneig."
                    }
                },
                { status: 400 }
            );
        }

        if (nombre.trim().length > 150) {
            return Response.json(
                {
                    mensaje:
                        "El nom no pot superar els 150 caràcters.",
                    errores: {
                        nombre:
                            "El nom no pot superar els 150 caràcters."
                    }
                },
                { status: 400 }
            );
        }

        if (
            typeof deporte !== "string" ||
            !["Voleibol", "Futbol", "Basquet"].includes(
                deporte
            )
        ) {
            return Response.json(
                {
                    mensaje: "Selecciona un esport vàlid.",
                    errores: {
                        deporte: "Selecciona un esport vàlid."
                    }
                },
                { status: 400 }
            );
        }

        if (typeof descripcion !== "string") {
            return Response.json(
                {
                    mensaje: "La descripció no és vàlida.",
                    errores: {
                        descripcion:
                            "La descripció no és vàlida."
                    }
                },
                { status: 400 }
            );
        }

        if (descripcion.length > 10000) {
            return Response.json(
                {
                    mensaje:
                        "La descripció no pot superar els 10.000 caràcters.",
                    errores: {
                        descripcion:
                            "La descripció no pot superar els 10.000 caràcters."
                    }
                },
                { status: 400 }
            );
        }

        if (
            typeof normativa !== "string" ||
            normativa.length > 100000
        ) {
            return Response.json(
                {
                    mensaje:
                        "La normativa no té un format vàlid.",
                    errores: {
                        normativa:
                            "La normativa no té un format vàlid."
                    }
                },
                { status: 400 }
            );
        }

        let normativaBase =
            torneoActual?.normativa_base ?? null;

        // Un campo vacío significa conservar la normativa original
        // durante una edición.
        if (normativa !== "" || !editando) {
            let apartados: {
                numero?: unknown;
                titulo?: unknown;
                articulos?: unknown;
            }[];

            try {
                const valor = JSON.parse(normativa);

                if (!Array.isArray(valor)) {
                    return Response.json(
                        {
                            mensaje:
                                "La normativa no té un format vàlid.",
                            errores: {
                                normativa:
                                    "La normativa no té un format vàlid."
                            }
                        },
                        { status: 400 }
                    );
                }

                apartados = valor;
            } catch {
                return Response.json(
                    {
                        mensaje:
                            "La normativa no té un format vàlid.",
                        errores: {
                            normativa:
                                "La normativa no té un format vàlid."
                        }
                    },
                    { status: 400 }
                );
            }

            if (apartados.length > 100) {
                return Response.json(
                    {
                        mensaje:
                            "La normativa no pot tenir més de 100 apartats.",
                        errores: {
                            normativa:
                                "La normativa no pot tenir més de 100 apartats."
                        }
                    },
                    { status: 400 }
                );
            }

            for (let i = 0; i < apartados.length; i++) {
                const apartado = apartados[i];

                if (
                    !apartado ||
                    typeof apartado !== "object"
                ) {
                    return Response.json(
                        {
                            mensaje:
                                "L'apartat de la normativa no és vàlid.",
                            errores: {
                                [`normativa.${i}.titulo`]:
                                    "L'apartat de la normativa no és vàlid."
                            }
                        },
                        { status: 400 }
                    );
                }

                if (
                    typeof apartado.titulo !== "string" ||
                    !apartado.titulo.trim()
                ) {
                    return Response.json(
                        {
                            mensaje:
                                "Indica el títol de l'apartat.",
                            errores: {
                                [`normativa.${i}.titulo`]:
                                    "Indica el títol de l'apartat."
                            }
                        },
                        { status: 400 }
                    );
                }

                if (apartado.titulo.length > 300) {
                    return Response.json(
                        {
                            mensaje:
                                "El títol de l'apartat no pot superar els 300 caràcters.",
                            errores: {
                                [`normativa.${i}.titulo`]:
                                    "El títol de l'apartat no pot superar els 300 caràcters."
                            }
                        },
                        { status: 400 }
                    );
                }

                if (!Array.isArray(apartado.articulos)) {
                    return Response.json(
                        {
                            mensaje:
                                "Els articles de l'apartat no són vàlids.",
                            errores: {
                                [`normativa.${i}.titulo`]:
                                    "Els articles de l'apartat no són vàlids."
                            }
                        },
                        { status: 400 }
                    );
                }

                if (apartado.articulos.length > 100) {
                    return Response.json(
                        {
                            mensaje:
                                "Un apartat no pot tenir més de 100 articles.",
                            errores: {
                                [`normativa.${i}.titulo`]:
                                    "Un apartat no pot tenir més de 100 articles."
                            }
                        },
                        { status: 400 }
                    );
                }

                for (
                    let j = 0;
                    j < apartado.articulos.length;
                    j++
                ) {
                    const articulo =
                        apartado.articulos[j] as {
                            numero?: unknown;
                            texto?: unknown;
                        } | null;

                    if (
                        !articulo ||
                        typeof articulo !== "object" ||
                        typeof articulo.texto !== "string" ||
                        !articulo.texto.trim()
                    ) {
                        return Response.json(
                            {
                                mensaje:
                                    "Escriu el contingut de l'article.",
                                errores: {
                                    [`normativa.${i}.articulos.${j}.texto`]:
                                        "Escriu el contingut de l'article."
                                }
                            },
                            { status: 400 }
                        );
                    }

                    if (articulo.texto.length > 10000) {
                        return Response.json(
                            {
                                mensaje:
                                    "L'article no pot superar els 10.000 caràcters.",
                                errores: {
                                    [`normativa.${i}.articulos.${j}.texto`]:
                                        "L'article no pot superar els 10.000 caràcters."
                                }
                            },
                            { status: 400 }
                        );
                    }
                }
            }

            // Si no hay apartados, la normativa se guarda realmente
            // como null y no como la cadena "[]".
            normativaBase =
                apartados.length === 0
                    ? null
                    : JSON.stringify(
                        apartados.map((apartado, i) => ({
                            numero: i + 1,
                            titulo: (
                                apartado.titulo as string
                            ).trim(),
                            articulos: (
                                apartado.articulos as {
                                    texto: string;
                                }[]
                            ).map((articulo, j) => ({
                                numero: `${i + 1}.${j + 1}`,
                                texto: articulo.texto.trim()
                            }))
                        }))
                    );
        }

        const version = formulario.get("updated_at");

        if (
            editando &&
            (
                typeof version !== "string" ||
                version !==
                    (torneoActual?.updated_at ?? "")
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "El torneig ha canviat. Recarrega la pàgina abans de desar.",
                    errores: {}
                },
                { status: 409 }
            );
        }

        // Validar ambos archivos antes de subir ninguno.
        // Máximo 2 MB por imagen.
        const imagenes: {
            campo: "logo" | "banner";
            archivo: File;
            extension: string;
        }[] = [];

        for (const campo of ["logo", "banner"] as const) {
            const archivo = formulario.get(campo);

            if (archivo === null) {
                continue;
            }

            if (
                !(archivo instanceof File) ||
                archivo.size === 0
            ) {
                return Response.json(
                    {
                        mensaje:
                            "La imatge seleccionada no té contingut.",
                        errores: {
                            [campo]:
                                "La imatge seleccionada no té contingut."
                        }
                    },
                    { status: 400 }
                );
            }

            if (archivo.size > 2 * 1024 * 1024) {
                return Response.json(
                    {
                        mensaje:
                            "La imatge no pot ocupar més de 2 MB.",
                        errores: {
                            [campo]:
                                "La imatge no pot ocupar més de 2 MB."
                        }
                    },
                    { status: 400 }
                );
            }

            const cabecera = new Uint8Array(
                await archivo.slice(0, 12).arrayBuffer()
            );

            const png = [
                137,
                80,
                78,
                71,
                13,
                10,
                26,
                10
            ].every(
                (byte, i) => cabecera[i] === byte
            );

            const jpg =
                cabecera[0] === 255 &&
                cabecera[1] === 216 &&
                cabecera[2] === 255;

            const webp =
                String.fromCharCode(
                    ...cabecera.slice(0, 4)
                ) === "RIFF" &&
                String.fromCharCode(
                    ...cabecera.slice(8, 12)
                ) === "WEBP";

            const extension =
                archivo.type === "image/png" && png
                    ? "png"
                    : archivo.type === "image/jpeg" && jpg
                      ? "jpg"
                      : archivo.type === "image/webp" && webp
                        ? "webp"
                        : null;

            if (!extension) {
                return Response.json(
                    {
                        mensaje:
                            "La imatge ha de ser PNG, JPG o WebP.",
                        errores: {
                            [campo]:
                                "La imatge ha de ser PNG, JPG o WebP."
                        }
                    },
                    { status: 400 }
                );
            }

            imagenes.push({
                campo,
                archivo,
                extension
            });
        }

        /*
         * getPublicUrl genera una dirección incluso cuando el bucket
         * es privado. Antes de subir una imagen se comprueba que el
         * bucket realmente permita el acceso público.
         */
        if (imagenes.length > 0) {
            const {
                data: bucket,
                error: errorBucket
            } = await supabaseAdmin.storage.getBucket(
                "Torneos"
            );

            if (errorBucket) {
                throw errorBucket;
            }

            if (!bucket?.public) {
                return Response.json(
                    {
                        mensaje:
                            "El contenidor d'imatges Torneos no és públic. Activa l'accés públic a Supabase Storage.",
                        errores: {
                            [imagenes[0].campo]:
                                "No s'ha pogut obtenir una URL pública per a la imatge."
                        }
                    },
                    { status: 500 }
                );
            }
        }

        const imagenesGuardadas: {
            logo: string | null;
            banner: string | null;
        } = {
            logo: torneoActual?.logo ?? null,
            banner: torneoActual?.banner ?? null
        };

        for (
            const {
                campo,
                archivo,
                extension
            } of imagenes
        ) {
            const ruta =
                `${torneoID}/${campo}-${crypto.randomUUID()}.${extension}`;

            const { error } = await supabaseAdmin.storage
                .from("Torneos")
                .upload(ruta, archivo, {
                    contentType: archivo.type,
                    cacheControl: "3600",
                    upsert: false
                });

            if (error) {
                throw error;
            }

            archivosSubidos.push(ruta);

            const {
                data: { publicUrl }
            } = supabaseAdmin.storage
                .from("Torneos")
                .getPublicUrl(ruta);

            if (!publicUrl) {
                throw new Error(
                    `No se ha podido generar la URL pública de ${campo}.`
                );
            }

            imagenesGuardadas[campo] = publicUrl;
        }

        // Al crear, el usuario queda asignado a su torneo.
        // Se conserva el resto del JSON.
        if (
            !editando &&
            !tieneAccesoTorneo(usuario, torneoID)
        ) {
            const anteriores = usuario.permisos;

            if (
                anteriores !== null &&
                anteriores !== undefined &&
                (
                    typeof anteriores !== "object" ||
                    Array.isArray(anteriores)
                )
            ) {
                return Response.json(
                    {
                        mensaje:
                            "Cal revisar els permisos del teu compte.",
                        errores: {}
                    },
                    { status: 409 }
                );
            }

            const anterioresTorneos =
                anteriores?.torneos;

            if (
                anterioresTorneos !== undefined &&
                (
                    !anterioresTorneos ||
                    typeof anterioresTorneos !==
                        "object" ||
                    Array.isArray(anterioresTorneos)
                )
            ) {
                return Response.json(
                    {
                        mensaje:
                            "Cal revisar les assignacions del teu compte.",
                        errores: {}
                    },
                    { status: 409 }
                );
            }

            const nuevos = {
                ...anteriores,
                torneos: {
                    ...anterioresTorneos,
                    [torneoID]: {
                        acceso: true,
                        permisos: {}
                    }
                }
            };

            let asignar = supabaseAdmin
                .from("users")
                .update({ permisos: nuevos })
                .eq("id", usuario.id);

            asignar =
                anteriores == null
                    ? asignar.is("permisos", null)
                    : asignar.eq(
                        "permisos",
                        JSON.stringify(anteriores)
                    );

            const {
                data: asignado,
                error: errorAsignacion
            } = await asignar
                .select("id")
                .maybeSingle();

            if (errorAsignacion) {
                throw errorAsignacion;
            }

            if (!asignado) {
                return Response.json(
                    {
                        mensaje:
                            "Els permisos han canviat. Recarrega la pàgina.",
                        errores: {}
                    },
                    { status: 409 }
                );
            }

            asignacionCreada = {
                usuarioID: usuario.id,
                anterior: anteriores ?? null,
                nueva: nuevos
            };
        }

        const datos = {
            nombre: nombre.trim(),
            deporte,
            descripcion: descripcion.trim(),
            normativa_base: normativaBase,
            ...imagenesGuardadas,
            updated_at: new Date().toISOString()
        };

        let consulta;

        if (editando) {
            consulta = supabaseAdmin
                .from("torneos")
                .update(datos)
                .eq("id", torneoID);

            consulta = torneoActual?.updated_at
                ? consulta.eq(
                    "updated_at",
                    torneoActual.updated_at
                )
                : consulta.is("updated_at", null);
        } else {
            consulta = supabaseAdmin
                .from("torneos")
                .insert({
                    id: torneoID,
                    ...datos,
                    activo: true,
                    created_at: datos.updated_at
                });
        }

        const {
            data,
            error
        } = await consulta
            .select("id")
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return Response.json(
                {
                    mensaje:
                        "El torneig ha canviat. Recarrega la pàgina abans de desar.",
                    errores: {}
                },
                { status: 409 }
            );
        }

        guardado = true;

        return Response.json(
            {
                mensaje: editando
                    ? "Torneig actualitzat correctament."
                    : "Torneig creat correctament.",
                id: data.id,
                logo: imagenesGuardadas.logo,
                banner: imagenesGuardadas.banner
            },
            {
                status: editando ? 200 : 201,
                headers: {
                    "Cache-Control": "private, no-store"
                }
            }
        );
    } catch (error) {
        console.error(
            "Error guardando torneo:",
            error
        );

        return Response.json(
            {
                mensaje:
                    "No s'ha pogut desar el torneig. Torna-ho a intentar.",
                errores: {}
            },
            { status: 500 }
        );
    } finally {
        if (!guardado && asignacionCreada) {
            try {
                const { error } = await supabaseAdmin
                    .from("users")
                    .update({
                        permisos:
                            asignacionCreada.anterior
                    })
                    .eq(
                        "id",
                        asignacionCreada.usuarioID
                    )
                    .eq(
                        "permisos",
                        JSON.stringify(
                            asignacionCreada.nueva
                        )
                    );

                if (error) {
                    console.error(
                        "Error revirtiendo asignación del torneo:",
                        error
                    );
                }
            } catch (error) {
                console.error(
                    "Error revirtiendo asignación:",
                    error
                );
            }
        }

        // Solo limpiar las nuevas subidas de esta petición
        // si no se guardó el torneo.
        // Las imágenes antiguas se conservan para no afectar
        // a la migración.
        if (!guardado && archivosSubidos.length) {
            try {
                const { error } =
                    await supabaseAdmin.storage
                        .from("Torneos")
                        .remove(archivosSubidos);

                if (error) {
                    console.error(
                        "Error limpiando imágenes del intento de guardado:",
                        error
                    );
                }
            } catch (error) {
                console.error(
                    "Error limpiando imágenes:",
                    error
                );
            }
        }
    }
};

export const POST = guardarTorneo;
export const PATCH = guardarTorneo;