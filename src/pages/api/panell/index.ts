import type { APIRoute } from "astro";
import { supabaseAdmin } from "@utils/supabase";
import { obtenerUsuarioPorToken } from "@pages/api/sesiones/sesiones";
import {
    tienePermiso,
    tieneAccesoTorneo
} from "@const/Permisos";

export const prerender = false;

type Torneo = {
    id: string;
    nombre: string | null;
    deporte: string | null;
    descripcion: string | null;
    logo: string | null;
    banner: string | null;
    activo: boolean | null;
    created_at: string | null;
    updated_at: string | null;
};

type Edicion = {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
    estado: string | null;
    sede: string | null;
    created_at: string | null;
    updated_at: string | null;
};

export const GET: APIRoute = async ({
    cookies,
    url
}) => {
    const headers = {
        "Cache-Control": "private, no-store"
    };

    try {
        // Sesión.
        const token = cookies.get("token_sesion")?.value;

        const usuario = token
            ? await obtenerUsuarioPorToken(token)
            : null;

        if (!usuario) {
            return Response.json(
                {
                    mensaje: "Has d'iniciar sessió."
                },
                {
                    status: 401,
                    headers
                }
            );
        }

        if (!tienePermiso(usuario, "panell")) {
            return Response.json(
                {
                    mensaje:
                        "No tens permís per accedir al panell."
                },
                {
                    status: 403,
                    headers
                }
            );
        }

        // Contexto seleccionado.
        const torneoID = url.searchParams.get("torneoID");
        const edicionID = url.searchParams.get("edicionID");

        const formatoUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (
            torneoID !== null &&
            !formatoUUID.test(torneoID)
        ) {
            return Response.json(
                {
                    mensaje:
                        "L'identificador del torneig no és vàlid."
                },
                {
                    status: 400,
                    headers
                }
            );
        }

        if (
            edicionID !== null &&
            (
                !torneoID ||
                !formatoUUID.test(edicionID)
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "La selecció de l'edició no és vàlida."
                },
                {
                    status: 400,
                    headers
                }
            );
        }

        if (
            torneoID &&
            (
                !tieneAccesoTorneo(usuario, torneoID) ||
                !tienePermiso(
                    usuario,
                    "tornejos",
                    "ver",
                    torneoID
                )
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "No tens accés a aquest torneig."
                },
                {
                    status: 403,
                    headers
                }
            );
        }

        // Torneos accesibles.
        // Se pagina para no depender del límite de filas
        // de una única respuesta de Supabase.
        const torneos: Torneo[] = [];
        const tamanoPagina = 500;

        if (
            torneoID ||
            tienePermiso(usuario, "tornejos", "ver")
        ) {
            for (
                let inicio = 0;
                ;
                inicio += tamanoPagina
            ) {
                let consulta = supabaseAdmin
                    .from("torneos")
                    .select(
                        "id, nombre, deporte, descripcion, logo, banner, activo, created_at, updated_at"
                    )
                    .order("id")
                    .range(
                        inicio,
                        inicio + tamanoPagina - 1
                    );

                if (torneoID) {
                    consulta = consulta.eq("id", torneoID);
                }

                const {
                    data,
                    error
                } = await consulta;

                if (error) {
                    throw error;
                }

                const pagina = (data ?? []) as Torneo[];

                for (const torneo of pagina) {
                    if (
                        tieneAccesoTorneo(usuario, torneo.id) &&
                        tienePermiso(
                            usuario,
                            "tornejos",
                            "ver",
                            torneo.id
                        )
                    ) {
                        torneos.push(torneo);
                    }
                }

                if (pagina.length < tamanoPagina) {
                    break;
                }
            }
        }

        const torneoSeleccionado = torneoID
            ? torneos.find(
                torneo => torneo.id === torneoID
            ) ?? null
            : null;

        if (torneoID && !torneoSeleccionado) {
            return Response.json(
                {
                    mensaje:
                        "No s'ha trobat el torneig."
                },
                {
                    status: 404,
                    headers
                }
            );
        }

        // Ediciones: solo las de torneos accesibles
        // y con permiso para consultar ediciones.
        const torneosConPermisoEdiciones = torneos.filter(
            torneo =>
                tienePermiso(
                    usuario,
                    "edicions",
                    "ver",
                    torneo.id
                )
        );

        if (
            edicionID &&
            !torneosConPermisoEdiciones.some(
                torneo => torneo.id === torneoID
            )
        ) {
            return Response.json(
                {
                    mensaje:
                        "No tens permís per consultar aquesta edició."
                },
                {
                    status: 403,
                    headers
                }
            );
        }

        const ediciones: Edicion[] = [];

        // Consultas por grupos para limitar el tamaño
        // del filtro de identificadores.
        for (
            let grupo = 0;
            grupo < torneosConPermisoEdiciones.length;
            grupo += 100
        ) {
            const identificadores =
                torneosConPermisoEdiciones
                    .slice(grupo, grupo + 100)
                    .map(torneo => torneo.id);

            for (
                let inicio = 0;
                ;
                inicio += tamanoPagina
            ) {
                const {
                    data,
                    error
                } = await supabaseAdmin
                    .from("ediciones")
                    .select(
                        "id, torneo_id, nombre, fecha_inicio, fecha_fin, estado, sede, created_at, updated_at"
                    )
                    .in("torneo_id", identificadores)
                    .order("id")
                    .range(
                        inicio,
                        inicio + tamanoPagina - 1
                    );

                if (error) {
                    throw error;
                }

                const pagina = (data ?? []) as Edicion[];

                ediciones.push(...pagina);

                if (pagina.length < tamanoPagina) {
                    break;
                }
            }
        }

        const edicionSeleccionada = edicionID
            ? ediciones.find(
                edicion =>
                    edicion.id === edicionID &&
                    edicion.torneo_id === torneoID
            ) ?? null
            : null;

        if (edicionID && !edicionSeleccionada) {
            return Response.json(
                {
                    mensaje:
                        "No s'ha trobat aquesta edició dins del torneig seleccionat."
                },
                {
                    status: 404,
                    headers
                }
            );
        }

        // Enlaces de los accesos rápidos:
        // se mantienen las rutas y reglas existentes.
        const parametros = new URLSearchParams();

        if (torneoID) {
            parametros.set("torneoID", torneoID);
        }

        if (torneoID && edicionSeleccionada) {
            parametros.set(
                "edicionID",
                edicionSeleccionada.id
            );
        }

        const accesos = [
            {
                id: "crear-torneig",
                nombre: "Crear torneig",
                enlace:
                    "/panell/info/torneig?accio=crear",
                seccion: "tornejos",
                accion: "crear",
                descripcion:
                    "Defineix un nou esport i les seves regles base."
            },
            {
                id: "usuaris",
                nombre: "Gestionar usuaris",
                enlace: "/panell/usuaris",
                seccion: "usuaris",
                accion: "ver",
                descripcion:
                    "Llista d'alumnes amb accés a la plataforma."
            },
            {
                id: "permisos",
                nombre: "Gestionar permisos",
                enlace: "/panell/permisos",
                seccion: "permisos",
                accion: "ver",
                descripcion:
                    "Gestiona els permisos d'accés per a diferents usuaris."
            },
            {
                id: "configuracio",
                nombre: "Configuració",
                enlace: "/panell/configuracio",
                seccion: "configuracio",
                accion: "ver",
                descripcion:
                    "Gestiona la configuració general de la plataforma."
            }
        ]
            .filter(acceso =>
                tienePermiso(
                    usuario,
                    acceso.seccion,
                    acceso.accion,
                    acceso.accion === "crear"
                        ? undefined
                        : torneoID ?? undefined
                )
            )
            .map(acceso => ({
                ...acceso,
                enlace:
                    acceso.enlace +
                    (
                        acceso.accion !== "crear" &&
                        torneoID
                            ? `?${parametros.toString()}`
                            : ""
                    )
            }));

        // Orden de presentación por actualización o creación.
        torneos.sort((a, b) => {
            const fechaA = Date.parse(
                a.updated_at ?? a.created_at ?? ""
            );

            const fechaB = Date.parse(
                b.updated_at ?? b.created_at ?? ""
            );

            return (
                (Number.isFinite(fechaB) ? fechaB : 0) -
                (Number.isFinite(fechaA) ? fechaA : 0)
            );
        });

        ediciones.sort((a, b) => {
            const fechaA = Date.parse(
                a.updated_at ?? a.created_at ?? ""
            );

            const fechaB = Date.parse(
                b.updated_at ?? b.created_at ?? ""
            );

            return (
                (Number.isFinite(fechaB) ? fechaB : 0) -
                (Number.isFinite(fechaA) ? fechaA : 0)
            );
        });

        // Conteos de ediciones por torneo.
        const cantidadEdiciones = new Map<string, number>();

        for (const edicion of ediciones) {
            if (!edicion.torneo_id) {
                continue;
            }

            cantidadEdiciones.set(
                edicion.torneo_id,
                (
                    cantidadEdiciones.get(
                        edicion.torneo_id
                    ) ?? 0
                ) + 1
            );
        }

        const torneosPorID = new Map(
            torneos.map(torneo => [
                torneo.id,
                torneo
            ])
        );

        const torneosRespuesta = torneos.map(torneo => {
            const puedeVerEdiciones = tienePermiso(
                usuario,
                "edicions",
                "ver",
                torneo.id
            );

            return {
                ...torneo,
                // null significa sin permiso, no cero ediciones.
                total_ediciones: puedeVerEdiciones
                    ? cantidadEdiciones.get(torneo.id) ?? 0
                    : null,
                puedeEditar: tienePermiso(
                    usuario,
                    "tornejos",
                    "editar",
                    torneo.id
                ),
                enlace:
                    `/panell?torneoID=${encodeURIComponent(torneo.id)}`,
                enlace_info:
                    `/panell/info/torneig?accio=ver&torneoID=${encodeURIComponent(torneo.id)}`
            };
        });

        const edicionesRespuesta = ediciones.map(edicion => ({
            ...edicion,
            torneo_nombre: edicion.torneo_id
                ? torneosPorID.get(
                    edicion.torneo_id
                )?.nombre ?? null
                : null
        }));

        // Actualizaciones recientes, no un historial de acciones.
        // Solo se incluyen fechas updated_at reales.
        const actualizaciones = [
            ...torneos.map(torneo => ({
                id: `torneo-${torneo.id}`,
                tipo: "torneo" as const,
                nombre: torneo.nombre,
                torneo_id: torneo.id,
                torneo_nombre: torneo.nombre,
                fecha: torneo.updated_at
            })),
            ...ediciones.map(edicion => ({
                id: `edicion-${edicion.id}`,
                tipo: "edicion" as const,
                nombre: edicion.nombre,
                torneo_id: edicion.torneo_id,
                torneo_nombre: edicion.torneo_id
                    ? torneosPorID.get(
                        edicion.torneo_id
                    )?.nombre ?? null
                    : null,
                fecha: edicion.updated_at
            }))
        ]
            .filter(elemento =>
                elemento.fecha !== null &&
                Number.isFinite(Date.parse(elemento.fecha))
            )
            .sort((a, b) =>
                Date.parse(b.fecha!) -
                Date.parse(a.fecha!)
            )
            .slice(0, 6);

        const puedeVerEdiciones = torneoID
            ? tienePermiso(
                usuario,
                "edicions",
                "ver",
                torneoID
            )
            : tienePermiso(
                usuario,
                "edicions",
                "ver"
            );

        return Response.json(
            {
                data: {
                    modo: torneoID
                        ? "torneo"
                        : "general",

                    torneoSeleccionado,
                    edicionSeleccionada,

                    permisos: {
                        verTorneos: torneoID
                            ? tienePermiso(
                                usuario,
                                "tornejos",
                                "ver",
                                torneoID
                            )
                            : tienePermiso(
                                usuario,
                                "tornejos",
                                "ver"
                            ),
                        verEdiciones: puedeVerEdiciones,
                        crearTorneo: tienePermiso(
                            usuario,
                            "tornejos",
                            "crear"
                        ),
                        editarTorneo: torneoID
                            ? tienePermiso(
                                usuario,
                                "tornejos",
                                "editar",
                                torneoID
                            )
                            : false
                    },

                    estadisticas: {
                        torneos: torneos.length,

                        torneosActivos: torneos.filter(
                            torneo => torneo.activo === true
                        ).length,

                        torneosInactivos: torneos.filter(
                            torneo => torneo.activo === false
                        ).length,

                        torneosSinEstado: torneos.filter(
                            torneo => torneo.activo === null
                        ).length,

                        ediciones: puedeVerEdiciones
                            ? ediciones.length
                            : null,

                        edicionesBorrador: puedeVerEdiciones
                            ? ediciones.filter(
                                edicion =>
                                    edicion.estado === "BORRADOR"
                            ).length
                            : null,

                        edicionesActivas: puedeVerEdiciones
                            ? ediciones.filter(
                                edicion =>
                                    edicion.estado === "ACTIVA"
                            ).length
                            : null,

                        edicionesFinalizadas: puedeVerEdiciones
                            ? ediciones.filter(
                                edicion =>
                                    edicion.estado === "FINALIZADA"
                            ).length
                            : null,

                        edicionesSinEstado: puedeVerEdiciones
                            ? ediciones.filter(
                                edicion =>
                                    !edicion.estado?.trim()
                            ).length
                            : null,

                        edicionesOtrosEstados: puedeVerEdiciones
                            ? ediciones.filter(
                                edicion =>
                                    Boolean(edicion.estado?.trim()) &&
                                    ![
                                        "BORRADOR",
                                        "ACTIVA",
                                        "FINALIZADA"
                                    ].includes(edicion.estado!)
                            ).length
                            : null
                    },

                    accesos,
                    torneos: torneosRespuesta,
                    ediciones: edicionesRespuesta,
                    actualizaciones
                }
            },
            {
                status: 200,
                headers
            }
        );
    } catch (error) {
        console.error(
            "Error cargando el resumen del panel:",
            error
        );

        return Response.json(
            {
                mensaje:
                    "No s'ha pogut carregar el resum del panell. Torna-ho a intentar."
            },
            {
                status: 500,
                headers
            }
        );
    }
};