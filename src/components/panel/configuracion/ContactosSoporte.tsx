import Cargando from "@components/Cargando";

import {
    useEffect,
    useState,
    type FormEvent,
} from "react";

const API =
    "/api/panell/configuracio/contactes";

interface Contacto {
    id: string;

    nombre: string;
    cargo: string;
    email: string;
    descripcion: string;

    activo: boolean;
    orden: number;

    created_at: string | null;
    updated_at: string | null;
    created_by: string | null;
}

interface FormularioContacto {
    nombre: string;
    cargo: string;
    email: string;
    descripcion: string;
    activo: boolean;
}

interface RespuestaContactos {
    success: boolean;

    contactos?: Contacto[];

    puedeEditar?: boolean;

    mensaje?: string;
}

const FORMULARIO_INICIAL:
    FormularioContacto = {
        nombre: "",
        cargo: "",
        email: "",
        descripcion: "",
        activo: true,
    };

const boton =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border bg-background px-4 py-2.5 " +
    "text-sm font-medium text-neutral transition-colors " +
    "hover:border-primary/40 hover:bg-card " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-primary/30 " +
    "disabled:cursor-not-allowed disabled:opacity-50";

const botonPrincipal =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-primary bg-primary px-4 py-2.5 " +
    "text-sm font-medium text-white transition-colors " +
    "hover:opacity-90 " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-primary/30 " +
    "disabled:cursor-not-allowed disabled:opacity-50";

const campo =
    "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 " +
    "text-sm text-neutral outline-none " +
    "focus:border-primary/50 focus:ring-2 focus:ring-primary/10";

function Interruptor({
    activo,
    onChange,
    disabled = false,
}: {
    activo: boolean;
    onChange: (activo: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={activo}
            disabled={disabled}
            onClick={() =>
                onChange(!activo)
            }
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                activo
                    ? "bg-primary"
                    : "bg-muted"
            } disabled:cursor-not-allowed disabled:opacity-50`}
        >
            <span
                className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    activo
                        ? "left-6"
                        : "left-1"
                }`}
            />
        </button>
    );
}

export default function ContactosSoporte() {
    const [
        contactos,
        setContactos,
    ] = useState<Contacto[]>([]);

    const [
        puedeEditar,
        setPuedeEditar,
    ] = useState(false);

    const [
        cargando,
        setCargando,
    ] = useState(true);

    const [
        guardando,
        setGuardando,
    ] = useState(false);

    const [
        accionando,
        setAccionando,
    ] = useState("");

    const [
        error,
        setError,
    ] = useState("");

    const [
        aviso,
        setAviso,
    ] = useState("");

    const [
        mostrandoFormulario,
        setMostrandoFormulario,
    ] = useState(false);

    const [
        contactoEditando,
        setContactoEditando,
    ] = useState<Contacto | null>(
        null,
    );

    const [
        formulario,
        setFormulario,
    ] =
        useState<FormularioContacto>(
            FORMULARIO_INICIAL,
        );

    async function cargarContactos(
        signal?: AbortSignal,
    ) {
        const respuesta =
            await fetch(
                API,
                {
                    credentials:
                        "same-origin",

                    cache:
                        "no-store",

                    signal,
                },
            );

        const datos =
            await respuesta
                .json()
                .catch(
                    () => null,
                ) as
                | RespuestaContactos
                | null;

        if (
            !respuesta.ok ||
            datos?.success !==
                true
        ) {
            throw new Error(
                datos?.mensaje ||
                    "No s'han pogut carregar els contactes.",
            );
        }

        setContactos(
            datos.contactos ??
                [],
        );

        setPuedeEditar(
            datos.puedeEditar ===
                true,
        );
    }

    useEffect(() => {
        const controlador =
            new AbortController();

        async function cargar() {
            setCargando(true);
            setError("");

            try {
                await cargarContactos(
                    controlador.signal,
                );
            } catch (error) {
                if (
                    controlador
                        .signal
                        .aborted
                ) {
                    return;
                }

                setError(
                    error instanceof
                        Error
                        ? error.message
                        : "No s'han pogut carregar els contactes.",
                );
            } finally {
                if (
                    !controlador
                        .signal
                        .aborted
                ) {
                    setCargando(
                        false,
                    );
                }
            }
        }

        void cargar();

        return () =>
            controlador.abort();
    }, []);

    function actualizarFormulario<
        K extends keyof FormularioContacto,
    >(
        campo: K,
        valor:
            FormularioContacto[K],
    ) {
        setFormulario(
            (actual) => ({
                ...actual,
                [campo]: valor,
            }),
        );
    }

    function nuevoContacto() {
        setContactoEditando(
            null,
        );

        setFormulario(
            FORMULARIO_INICIAL,
        );

        setError("");
        setAviso("");

        setMostrandoFormulario(
            true,
        );
    }

    function editarContacto(
        contacto: Contacto,
    ) {
        setContactoEditando(
            contacto,
        );

        setFormulario({
            nombre:
                contacto.nombre,

            cargo:
                contacto.cargo,

            email:
                contacto.email,

            descripcion:
                contacto.descripcion,

            activo:
                contacto.activo,
        });

        setError("");
        setAviso("");

        setMostrandoFormulario(
            true,
        );

        window.scrollTo({
            top: 0,
            behavior:
                "smooth",
        });
    }

    function cerrarFormulario() {
        if (guardando) {
            return;
        }

        setContactoEditando(
            null,
        );

        setFormulario(
            FORMULARIO_INICIAL,
        );

        setMostrandoFormulario(
            false,
        );
    }

    async function realizarAccion(
        cuerpo: Record<
            string,
            unknown
        >,
    ) {
        const respuesta =
            await fetch(
                API,
                {
                    method:
                        "POST",

                    credentials:
                        "same-origin",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body:
                        JSON.stringify(
                            cuerpo,
                        ),
                },
            );

        const datos =
            await respuesta
                .json()
                .catch(
                    () => null,
                ) as
                | RespuestaContactos
                | null;

        if (
            !respuesta.ok ||
            datos?.success !==
                true
        ) {
            throw new Error(
                datos?.mensaje ||
                    "No s'ha pogut completar l'operació.",
            );
        }

        if (
            datos.contactos
        ) {
            setContactos(
                datos.contactos,
            );
        }

        if (
            typeof datos.puedeEditar ===
            "boolean"
        ) {
            setPuedeEditar(
                datos.puedeEditar,
            );
        }

        return datos;
    }

    async function guardarContacto(
        evento:
            FormEvent<HTMLFormElement>,
    ) {
        evento.preventDefault();

        if (guardando) {
            return;
        }

        setGuardando(true);
        setError("");
        setAviso("");

        try {
            if (
                contactoEditando
            ) {
                const datos =
                    await realizarAccion({
                        accion:
                            "editar",

                        id:
                            contactoEditando.id,

                        updated_at:
                            contactoEditando.updated_at,

                        ...formulario,
                    });

                setAviso(
                    datos.mensaje ||
                        "Contacte actualitzat correctament.",
                );
            } else {
                const datos =
                    await realizarAccion({
                        accion:
                            "crear",

                        ...formulario,
                    });

                setAviso(
                    datos.mensaje ||
                        "Contacte creat correctament.",
                );
            }

            setContactoEditando(
                null,
            );

            setFormulario(
                FORMULARIO_INICIAL,
            );

            setMostrandoFormulario(
                false,
            );
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No s'ha pogut guardar el contacte.",
            );
        } finally {
            setGuardando(
                false,
            );
        }
    }

    async function cambiarEstado(
        contacto: Contacto,
    ) {
        if (
            accionando
        ) {
            return;
        }

        setAccionando(
            contacto.id,
        );

        setError("");
        setAviso("");

        try {
            const datos =
                await realizarAccion({
                    accion:
                        "estado",

                    id:
                        contacto.id,

                    activo:
                        !contacto.activo,

                    updated_at:
                        contacto.updated_at,
                });

            setAviso(
                datos.mensaje ||
                    "Estat actualitzat correctament.",
            );
        } catch (error) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut actualitzar l'estat.",
            );
        } finally {
            setAccionando("");
        }
    }

    async function eliminarContacto(
        contacto: Contacto,
    ) {
        if (
            accionando
        ) {
            return;
        }

        const confirmar =
            window.confirm(
                `Vols eliminar el contacte "${contacto.nombre}"?`,
            );

        if (!confirmar) {
            return;
        }

        setAccionando(
            contacto.id,
        );

        setError("");
        setAviso("");

        try {
            const datos =
                await realizarAccion({
                    accion:
                        "eliminar",

                    id:
                        contacto.id,

                    updated_at:
                        contacto.updated_at,
                });

            setAviso(
                datos.mensaje ||
                    "Contacte eliminat correctament.",
            );
        } catch (error) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut eliminar el contacte.",
            );
        } finally {
            setAccionando("");
        }
    }

    async function moverContacto(
        indice: number,
        direccion: -1 | 1,
    ) {
        if (
            accionando
        ) {
            return;
        }

        const destino =
            indice +
            direccion;

        if (
            destino < 0 ||
            destino >=
                contactos.length
        ) {
            return;
        }

        const nuevos =
            [...contactos];

        [
            nuevos[indice],
            nuevos[destino],
        ] = [
            nuevos[destino],
            nuevos[indice],
        ];

        const ids =
            nuevos.map(
                (contacto) =>
                    contacto.id,
            );

        setAccionando(
            "orden",
        );

        setError("");
        setAviso("");

        try {
            const datos =
                await realizarAccion({
                    accion:
                        "ordenar",

                    ids,
                });

            setAviso(
                datos.mensaje ||
                    "Ordre actualitzat correctament.",
            );
        } catch (error) {
            setError(
                error instanceof
                    Error
                    ? error.message
                    : "No s'ha pogut modificar l'ordre.",
            );
        } finally {
            setAccionando("");
        }
    }

    if (cargando) {
        return (
            <div className="flex min-h-80 w-full items-center justify-center">
                <Cargando />
            </div>
        );
    }

    return (
        <div className="space-y-6 text-neutral">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <a
                        href="/panell/configuracio"
                        className="mb-4 inline-flex items-center gap-2 text-sm text-neutral transition-colors hover:text-primary"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <path d="m15 18-6-6 6-6" />
                        </svg>

                        Configuració
                    </a>

                    <p className="mb-2 text-xs font-medium tracking-wide">
                        CONFIGURACIÓ
                    </p>

                    <h1 className="text-2xl font-semibold tracking-tight text-neutral-titulos sm:text-3xl">
                        Contactes de suport
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm leading-6">
                        Gestiona les persones de contacte que
                        poden ajudar els alumnes, professors o
                        responsables quan tenen algun problema
                        amb la plataforma.
                    </p>
                </div>

                {puedeEditar && (
                    <button
                        type="button"
                        onClick={
                            nuevoContacto
                        }
                        className={`${botonPrincipal} shrink-0`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            className="h-4 w-4"
                            aria-hidden="true"
                        >
                            <path d="M12 5v14M5 12h14" />
                        </svg>

                        Nou contacte
                    </button>
                )}
            </header>

            {error && (
                <div
                    role="alert"
                    className="flex items-start justify-between gap-4 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error"
                >
                    <p>
                        {error}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            setError("")
                        }
                        className="shrink-0 rounded px-1"
                        aria-label="Tancar error"
                    >
                        ×
                    </button>
                </div>
            )}

            {aviso && (
                <div
                    role="status"
                    className="flex items-start justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-primary"
                >
                    <p>
                        {aviso}
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            setAviso("")
                        }
                        className="shrink-0 rounded px-1"
                        aria-label="Tancar avís"
                    >
                        ×
                    </button>
                </div>
            )}

            {mostrandoFormulario && puedeEditar && (
                <section className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-titulos">
                                {contactoEditando
                                    ? "Editar contacte"
                                    : "Nou contacte"}
                            </h2>

                            <p className="mt-1 text-sm">
                                {contactoEditando
                                    ? "Modifica les dades del contacte seleccionat."
                                    : "Afegeix una nova persona de suport."}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={
                                cerrarFormulario
                            }
                            disabled={
                                guardando
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-lg"
                            aria-label="Tancar formulari"
                        >
                            ×
                        </button>
                    </div>

                    <form
                        onSubmit={
                            guardarContacto
                        }
                        className="space-y-5"
                    >
                        <div className="grid gap-4 md:grid-cols-2">
                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Nom
                                </span>

                                <input
                                    type="text"
                                    required
                                    maxLength={
                                        150
                                    }
                                    value={
                                        formulario.nombre
                                    }
                                    onChange={(
                                        evento,
                                    ) =>
                                        actualizarFormulario(
                                            "nombre",
                                            evento
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Nom i llinatges"
                                    className={
                                        campo
                                    }
                                />
                            </label>

                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Càrrec o funció
                                </span>

                                <input
                                    type="text"
                                    required
                                    maxLength={
                                        150
                                    }
                                    value={
                                        formulario.cargo
                                    }
                                    onChange={(
                                        evento,
                                    ) =>
                                        actualizarFormulario(
                                            "cargo",
                                            evento
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Professor responsable, coordinador..."
                                    className={
                                        campo
                                    }
                                />
                            </label>
                        </div>

                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold">
                                Correu electrònic
                            </span>

                            <input
                                type="email"
                                required
                                maxLength={
                                    254
                                }
                                value={
                                    formulario.email
                                }
                                onChange={(
                                    evento,
                                ) =>
                                    actualizarFormulario(
                                        "email",
                                        evento
                                            .target
                                            .value,
                                    )
                                }
                                placeholder="contacte@centre.cat"
                                className={
                                    campo
                                }
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold">
                                Descripció
                            </span>

                            <textarea
                                rows={4}
                                maxLength={
                                    1000
                                }
                                value={
                                    formulario.descripcion
                                }
                                onChange={(
                                    evento,
                                ) =>
                                    actualizarFormulario(
                                        "descripcion",
                                        evento
                                            .target
                                            .value,
                                    )
                                }
                                placeholder="Explica breument en quins casos s'ha de contactar amb aquesta persona."
                                className={`${campo} resize-y`}
                            />
                        </label>

                        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
                            <div>
                                <p className="text-sm font-semibold text-neutral-titulos">
                                    Contacte actiu
                                </p>

                                <p className="mt-1 text-xs leading-5">
                                    Els contactes inactius es
                                    conserven però no s’haurien
                                    de mostrar a la pàgina pública.
                                </p>
                            </div>

                            <Interruptor
                                activo={
                                    formulario.activo
                                }
                                onChange={(
                                    activo,
                                ) =>
                                    actualizarFormulario(
                                        "activo",
                                        activo,
                                    )
                                }
                            />
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                            <button
                                type="button"
                                onClick={
                                    cerrarFormulario
                                }
                                disabled={
                                    guardando
                                }
                                className={
                                    boton
                                }
                            >
                                Cancel·lar
                            </button>

                            <button
                                type="submit"
                                disabled={
                                    guardando
                                }
                                className={
                                    botonPrincipal
                                }
                            >
                                {guardando
                                    ? "Guardant..."
                                    : contactoEditando
                                      ? "Guardar canvis"
                                      : "Crear contacte"}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section>
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Contactes configurats
                        </h2>

                        <p className="mt-1 text-sm">
                            {contactos.length ===
                            1
                                ? "1 contacte"
                                : `${contactos.length} contactes`}
                        </p>
                    </div>

                    {puedeEditar &&
                        contactos.length >
                            1 && (
                            <p className="text-xs">
                                Pots modificar l’ordre
                                amb les fletxes de cada
                                targeta.
                            </p>
                        )}
                </div>

                {contactos.length ===
                0 ? (
                    <div className="rounded-2xl border border-dashed border-border bg-background p-8 text-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="mx-auto h-10 w-10 text-neutral/50"
                            aria-hidden="true"
                        >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle
                                cx="9"
                                cy="7"
                                r="4"
                            />
                            <path d="M19 8v6M16 11h6" />
                        </svg>

                        <p className="mt-4 font-medium text-neutral-titulos">
                            No hi ha contactes de suport
                        </p>

                        <p className="mt-1 text-sm">
                            Afegeix el primer contacte
                            perquè pugui aparèixer a la
                            pàgina d’ajuda.
                        </p>

                        {puedeEditar && (
                            <button
                                type="button"
                                onClick={
                                    nuevoContacto
                                }
                                className={`${botonPrincipal} mt-5`}
                            >
                                Crear contacte
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {contactos.map(
                            (
                                contacto,
                                indice,
                            ) => (
                                <article
                                    key={
                                        contacto.id
                                    }
                                    className={`flex min-h-72 flex-col rounded-2xl border p-5 ${
                                        contacto.activo
                                            ? "border-border bg-background"
                                            : "border-border bg-card opacity-70"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="1.7"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="h-5 w-5"
                                                    aria-hidden="true"
                                                >
                                                    <circle
                                                        cx="12"
                                                        cy="8"
                                                        r="4"
                                                    />
                                                    <path d="M4 21a8 8 0 0 1 16 0" />
                                                </svg>
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="truncate font-semibold text-neutral-titulos">
                                                    {
                                                        contacto.nombre
                                                    }
                                                </h3>

                                                <p className="mt-0.5 truncate text-xs">
                                                    {
                                                        contacto.cargo
                                                    }
                                                </p>
                                            </div>
                                        </div>

                                        <span
                                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                                                contacto.activo
                                                    ? "bg-primary/10 text-primary"
                                                    : "bg-muted/30 text-neutral"
                                            }`}
                                        >
                                            {contacto.activo
                                                ? "Actiu"
                                                : "Inactiu"}
                                        </span>
                                    </div>

                                    <div className="mt-5 flex-1">
                                        <a
                                            href={`mailto:${contacto.email}`}
                                            className="inline-flex max-w-full items-center gap-2 text-sm text-primary hover:underline"
                                        >
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.7"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                className="h-4 w-4 shrink-0"
                                                aria-hidden="true"
                                            >
                                                <rect
                                                    x="3"
                                                    y="5"
                                                    width="18"
                                                    height="14"
                                                    rx="2"
                                                />

                                                <path d="m3 7 9 6 9-6" />
                                            </svg>

                                            <span className="truncate">
                                                {
                                                    contacto.email
                                                }
                                            </span>
                                        </a>

                                        {contacto.descripcion && (
                                            <p className="mt-4 text-sm leading-6">
                                                {
                                                    contacto.descripcion
                                                }
                                            </p>
                                        )}
                                    </div>

                                    {puedeEditar && (
                                        <div className="mt-5 border-t border-border pt-4">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex gap-1">
                                                    <button
                                                        type="button"
                                                        title="Pujar"
                                                        disabled={
                                                            indice ===
                                                                0 ||
                                                            Boolean(
                                                                accionando,
                                                            )
                                                        }
                                                        onClick={() =>
                                                            moverContacto(
                                                                indice,
                                                                -1,
                                                            )
                                                        }
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-30"
                                                    >
                                                        ↑
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Baixar"
                                                        disabled={
                                                            indice ===
                                                                contactos.length -
                                                                    1 ||
                                                            Boolean(
                                                                accionando,
                                                            )
                                                        }
                                                        onClick={() =>
                                                            moverContacto(
                                                                indice,
                                                                1,
                                                            )
                                                        }
                                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card disabled:opacity-30"
                                                    >
                                                        ↓
                                                    </button>
                                                </div>

                                                <div className="flex flex-wrap gap-2">
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(
                                                            accionando,
                                                        )}
                                                        onClick={() =>
                                                            cambiarEstado(
                                                                contacto,
                                                            )
                                                        }
                                                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium"
                                                    >
                                                        {contacto.activo
                                                            ? "Desactivar"
                                                            : "Activar"}
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={Boolean(
                                                            accionando,
                                                        )}
                                                        onClick={() =>
                                                            editarContacto(
                                                                contacto,
                                                            )
                                                        }
                                                        className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary"
                                                    >
                                                        Editar
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={Boolean(
                                                            accionando,
                                                        )}
                                                        onClick={() =>
                                                            eliminarContacto(
                                                                contacto,
                                                            )
                                                        }
                                                        className="rounded-lg border border-error/30 bg-error/5 px-3 py-1.5 text-xs font-medium text-error"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            ),
                        )}
                    </div>
                )}
            </section>
        </div>
    );
}