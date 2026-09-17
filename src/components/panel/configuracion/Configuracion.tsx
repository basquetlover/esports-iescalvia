import Cargando from "@components/Cargando";
import {
    useEffect,
    useState,
    type FormEvent,
} from "react";

const API = "/api/panell/configuracio";

interface CursoConfiguracion {
    curso: string;
    grupos: string[];
}

interface ConfiguracionPlataforma {
    id: string | null;

    curso_academico_actual: string | null;
    cursos: CursoConfiguracion[];

    registros_habilitados: boolean;
    admin_mode: boolean;

    emails_registro_permitidos: string[];
    dominios_registro_permitidos: string[];

    email_notificaciones_principal: string;
    email_notificaciones_secundario: string;

    notificar_nuevo_usuario: boolean;
    notificar_nuevo_equipo: boolean;
    notificar_nuevo_voluntario: boolean;
    notificar_incidencias_formularios: boolean;

    horas_aviso_formulario_incompleto: number;

    mensaje_registro_cerrado: string;

    created_at: string | null;
    updated_at: string | null;
    updated_by: string | null;
}

interface RespuestaConfiguracion {
    success: boolean;
    configuracion?: ConfiguracionPlataforma;
    mensaje?: string;
}

const CONFIGURACION_INICIAL: ConfiguracionPlataforma = {
    id: null,

    curso_academico_actual: "",
    cursos: [],

    registros_habilitados: false,
    admin_mode: false,

    emails_registro_permitidos: [],
    dominios_registro_permitidos: [],

    email_notificaciones_principal: "",
    email_notificaciones_secundario: "",

    notificar_nuevo_usuario: true,
    notificar_nuevo_equipo: true,
    notificar_nuevo_voluntario: true,
    notificar_incidencias_formularios: true,

    horas_aviso_formulario_incompleto: 24,

    mensaje_registro_cerrado:
        "Els nous registres estan temporalment tancats.",

    created_at: null,
    updated_at: null,
    updated_by: null,
};

const campo =
    "w-full rounded-lg border border-border bg-card px-3.5 py-2.5 " +
    "text-sm text-neutral outline-none " +
    "focus:border-primary/50 focus:ring-2 focus:ring-primary/10";

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

const seccion =
    "rounded-2xl border border-border bg-background p-4 sm:p-5";

function normalizarConfiguracion(
    configuracion: ConfiguracionPlataforma,
): ConfiguracionPlataforma {
    return {
        ...CONFIGURACION_INICIAL,
        ...configuracion,

        cursos:
            Array.isArray(configuracion.cursos)
                ? configuracion.cursos
                : [],

        emails_registro_permitidos:
            Array.isArray(configuracion.emails_registro_permitidos)
                ? configuracion.emails_registro_permitidos
                : [],

        dominios_registro_permitidos:
            Array.isArray(configuracion.dominios_registro_permitidos)
                ? configuracion.dominios_registro_permitidos
                : [],
    };
}

function formatearFecha(fecha: string | null) {
    if (!fecha) return "Sense informació";

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) {
        return "Sense informació";
    }

    return new Intl.DateTimeFormat("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
    }).format(valor);
}

function Interruptor({
    activo,
    onChange,
    disabled = false,
}: {
    activo: boolean;
    onChange: (valor: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={activo}
            disabled={disabled}
            onClick={() => onChange(!activo)}
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

function FilaInterruptor({
    titulo,
    descripcion,
    activo,
    onChange,
}: {
    titulo: string;
    descripcion: string;
    activo: boolean;
    onChange: (valor: boolean) => void;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-titulos">
                    {titulo}
                </p>

                <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral">
                    {descripcion}
                </p>
            </div>

            <Interruptor
                activo={activo}
                onChange={onChange}
            />
        </div>
    );
}

export default function Configuracion() {
    const [
        configuracion,
        setConfiguracion,
    ] = useState<ConfiguracionPlataforma>(
        CONFIGURACION_INICIAL,
    );

    const [
        configuracionOriginal,
        setConfiguracionOriginal,
    ] = useState<ConfiguracionPlataforma | null>(
        null,
    );

    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const [error, setError] = useState("");
    const [aviso, setAviso] = useState("");

    const [nuevoDominio, setNuevoDominio] = useState("");
    const [nuevoEmail, setNuevoEmail] = useState("");

    const [nuevoCurso, setNuevoCurso] = useState("");

    const [gruposNuevos, setGruposNuevos] =
        useState<Record<number, string>>({});

    useEffect(() => {
        const controlador = new AbortController();

        async function cargar() {
            setCargando(true);
            setError("");

            try {
                const respuesta = await fetch(API, {
                    credentials: "same-origin",
                    cache: "no-store",
                    signal: controlador.signal,
                });

                const datos =
                    await respuesta.json().catch(() => null) as
                        | RespuestaConfiguracion
                        | null;

                if (
                    !respuesta.ok ||
                    datos?.success !== true ||
                    !datos.configuracion
                ) {
                    throw new Error(
                        datos?.mensaje ||
                            "No s'ha pogut carregar la configuració.",
                    );
                }

                if (controlador.signal.aborted) return;

                const normalizada =
                    normalizarConfiguracion(datos.configuracion);

                setConfiguracion(normalizada);
                setConfiguracionOriginal(normalizada);
            } catch (error) {
                if (controlador.signal.aborted) return;

                setError(
                    error instanceof Error
                        ? error.message
                        : "No s'ha pogut carregar la configuració.",
                );
            } finally {
                if (!controlador.signal.aborted) {
                    setCargando(false);
                }
            }
        }

        void cargar();

        return () => controlador.abort();
    }, []);

    function actualizar<K extends keyof ConfiguracionPlataforma>(
        campo: K,
        valor: ConfiguracionPlataforma[K],
    ) {
        setAviso("");

        setConfiguracion((actual) => ({
            ...actual,
            [campo]: valor,
        }));
    }

    const hayCambios =
        configuracionOriginal !== null &&
        JSON.stringify(configuracion) !==
            JSON.stringify(configuracionOriginal);

    // ============================================================
    // CURSOS
    // ============================================================

    function añadirCurso() {
        const curso = nuevoCurso.trim();

        if (!curso) return;

        const existe = configuracion.cursos.some(
            (item) =>
                item.curso.trim().toLocaleLowerCase("ca-ES") ===
                curso.toLocaleLowerCase("ca-ES"),
        );

        if (existe) {
            setError("Aquest curs ja està configurat.");
            return;
        }

        actualizar(
            "cursos",
            [
                ...configuracion.cursos,
                {
                    curso,
                    grupos: [],
                },
            ],
        );

        setNuevoCurso("");
        setError("");
    }

    function eliminarCurso(indice: number) {
        actualizar(
            "cursos",
            configuracion.cursos.filter(
                (_, posicion) => posicion !== indice,
            ),
        );

        setGruposNuevos({});
    }

    function moverCurso(
        indice: number,
        direccion: -1 | 1,
    ) {
        const destino = indice + direccion;

        if (
            destino < 0 ||
            destino >= configuracion.cursos.length
        ) {
            return;
        }

        const cursos = [...configuracion.cursos];

        [
            cursos[indice],
            cursos[destino],
        ] = [
            cursos[destino],
            cursos[indice],
        ];

        actualizar("cursos", cursos);
    }

    function añadirGrupo(indiceCurso: number) {
        const grupo =
            (gruposNuevos[indiceCurso] ?? "").trim();

        if (!grupo) return;

        const curso =
            configuracion.cursos[indiceCurso];

        if (!curso) return;

        const existe = curso.grupos.some(
            (actual) =>
                actual.trim().toLocaleLowerCase("ca-ES") ===
                grupo.toLocaleLowerCase("ca-ES"),
        );

        if (existe) {
            setError(
                `El grup "${grupo}" ja existeix dins ${curso.curso}.`,
            );

            return;
        }

        const cursos =
            configuracion.cursos.map(
                (item, indice) =>
                    indice === indiceCurso
                        ? {
                              ...item,
                              grupos: [
                                  ...item.grupos,
                                  grupo,
                              ],
                          }
                        : item,
            );

        actualizar("cursos", cursos);

        setGruposNuevos((actual) => ({
            ...actual,
            [indiceCurso]: "",
        }));

        setError("");
    }

    function eliminarGrupo(
        indiceCurso: number,
        indiceGrupo: number,
    ) {
        actualizar(
            "cursos",
            configuracion.cursos.map(
                (curso, indice) =>
                    indice === indiceCurso
                        ? {
                              ...curso,
                              grupos:
                                  curso.grupos.filter(
                                      (_, posicion) =>
                                          posicion !== indiceGrupo,
                                  ),
                          }
                        : curso,
            ),
        );
    }

    // ============================================================
    // CORREOS Y DOMINIOS
    // ============================================================

    function añadirDominio() {
        const dominio =
            nuevoDominio
                .trim()
                .toLowerCase()
                .replace(/^@+/, "");

        if (!dominio) return;

        if (
            configuracion.dominios_registro_permitidos.includes(
                dominio,
            )
        ) {
            setError("Aquest domini ja està autoritzat.");
            return;
        }

        actualizar(
            "dominios_registro_permitidos",
            [
                ...configuracion.dominios_registro_permitidos,
                dominio,
            ],
        );

        setNuevoDominio("");
        setError("");
    }

    function eliminarDominio(dominio: string) {
        actualizar(
            "dominios_registro_permitidos",
            configuracion.dominios_registro_permitidos.filter(
                (item) => item !== dominio,
            ),
        );
    }

    function añadirEmail() {
        const email =
            nuevoEmail.trim().toLowerCase();

        if (!email) return;

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            setError(
                "El correu introduït no és vàlid.",
            );

            return;
        }

        if (
            configuracion.emails_registro_permitidos.includes(
                email,
            )
        ) {
            setError(
                "Aquest correu ja està autoritzat.",
            );

            return;
        }

        actualizar(
            "emails_registro_permitidos",
            [
                ...configuracion.emails_registro_permitidos,
                email,
            ],
        );

        setNuevoEmail("");
        setError("");
    }

    function eliminarEmail(email: string) {
        actualizar(
            "emails_registro_permitidos",
            configuracion.emails_registro_permitidos.filter(
                (item) => item !== email,
            ),
        );
    }

    // ============================================================
    // GUARDAR
    // ============================================================

    async function guardar(
        evento: FormEvent<HTMLFormElement>,
    ) {
        evento.preventDefault();

        if (!hayCambios || guardando) return;

        setGuardando(true);
        setError("");
        setAviso("");

        try {
            const respuesta = await fetch(API, {
                method: "PATCH",
                credentials: "same-origin",

                headers: {
                    "Content-Type": "application/json",
                },

                body: JSON.stringify(configuracion),
            });

            const datos =
                await respuesta.json().catch(() => null) as
                    | RespuestaConfiguracion
                    | null;

            if (
                !respuesta.ok ||
                datos?.success !== true
            ) {
                throw new Error(
                    datos?.mensaje ||
                        "No s'ha pogut guardar la configuració.",
                );
            }

            const guardada =
                normalizarConfiguracion(
                    datos.configuracion ?? configuracion,
                );

            setConfiguracion(guardada);
            setConfiguracionOriginal(guardada);

            setAviso(
                "Configuració guardada correctament.",
            );
        } catch (error) {
            setError(
                error instanceof Error
                    ? error.message
                    : "No s'ha pogut guardar la configuració.",
            );
        } finally {
            setGuardando(false);
        }
    }

    function descartar() {
        if (!configuracionOriginal) return;

        setConfiguracion(configuracionOriginal);

        setNuevoDominio("");
        setNuevoEmail("");
        setNuevoCurso("");
        setGruposNuevos({});

        setError("");
        setAviso("");
    }

    // ============================================================
    // INTERFAZ
    // ============================================================

    if (cargando) {
        return (
            <div className="flex min-h-80 w-full items-center justify-center">
                <Cargando />
            </div>
        );
    }

    return (
        <form
            onSubmit={guardar}
            className="space-y-6 text-neutral"
        >
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-medium tracking-wide">
                        PLATAFORMA
                    </p>

                    <h1 className="text-2xl font-semibold tracking-tight text-neutral-titulos sm:text-3xl">
                        Configuració de la plataforma
                    </h1>

                    <p className="mt-2 max-w-3xl text-sm leading-6">
                        Configura el curs acadèmic, els registres,
                        els cursos disponibles, les notificacions
                        i el seguiment d’incidències.
                    </p>

                    <p className="mt-2 text-xs text-neutral/70">
                        Última actualització:{" "}
                        {formatearFecha(
                            configuracion.updated_at,
                        )}
                    </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                    {hayCambios && (
                        <button
                            type="button"
                            onClick={descartar}
                            disabled={guardando}
                            className={boton}
                        >
                            Descartar
                        </button>
                    )}

                    <button
                        type="submit"
                        disabled={
                            !hayCambios ||
                            guardando
                        }
                        className={botonPrincipal}
                    >
                        {guardando
                            ? "Guardant..."
                            : "Guardar canvis"}
                    </button>
                </div>
            </header>

            {error && (
                <div
                    role="alert"
                    className="flex items-start justify-between gap-4 rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error"
                >
                    <p>{error}</p>

                    <button
                        type="button"
                        onClick={() => setError("")}
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
                    <p>{aviso}</p>

                    <button
                        type="button"
                        onClick={() => setAviso("")}
                        className="shrink-0 rounded px-1"
                        aria-label="Tancar avís"
                    >
                        ×
                    </button>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium">
                        Curs acadèmic
                    </p>

                    <p className="mt-1 font-semibold text-neutral-titulos">
                        {configuracion.curso_academico_actual ||
                            "No configurat"}
                    </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium">
                        Cursos
                    </p>

                    <p className="mt-1 font-semibold text-neutral-titulos">
                        {configuracion.cursos.length}
                    </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium">
                        Nous registres
                    </p>

                    <p
                        className={`mt-1 font-semibold ${
                            configuracion.registros_habilitados
                                ? "text-primary"
                                : "text-error"
                        }`}
                    >
                        {configuracion.registros_habilitados
                            ? "Activats"
                            : "Desactivats"}
                    </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium">
                        Admin Mode
                    </p>

                    <p
                        className={`mt-1 font-semibold ${
                            configuracion.admin_mode
                                ? "text-primary"
                                : "text-neutral-titulos"
                        }`}
                    >
                        {configuracion.admin_mode
                            ? "Activat"
                            : "Desactivat"}
                    </p>
                </div>
            </div>

            <section className={seccion}>
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Configuració general
                    </h2>

                    <p className="mt-1 text-sm">
                        Paràmetres generals de funcionament
                        de la plataforma.
                    </p>
                </div>

                <div className="space-y-5">
                    <label className="block">
                        <span className="mb-2 block text-xs font-semibold">
                            Curs acadèmic actual
                        </span>

                        <input
                            type="text"
                            value={
                                configuracion.curso_academico_actual ??
                                ""
                            }
                            maxLength={30}
                            placeholder="2026-2027"
                            onChange={(evento) =>
                                actualizar(
                                    "curso_academico_actual",
                                    evento.target.value,
                                )
                            }
                            className={campo}
                        />
                    </label>

                    <div className="border-t border-border pt-5">
                        <FilaInterruptor
                            titulo="Permetre nous registres"
                            descripcion="Permet o impedeix que es creïn nous comptes d’usuari."
                            activo={
                                configuracion.registros_habilitados
                            }
                            onChange={(valor) =>
                                actualizar(
                                    "registros_habilitados",
                                    valor,
                                )
                            }
                        />
                    </div>

                    {!configuracion.registros_habilitados && (
                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold">
                                Missatge de registre tancat
                            </span>

                            <textarea
                                value={
                                    configuracion.mensaje_registro_cerrado
                                }
                                maxLength={1000}
                                rows={3}
                                onChange={(evento) =>
                                    actualizar(
                                        "mensaje_registro_cerrado",
                                        evento.target.value,
                                    )
                                }
                                className={`${campo} resize-y`}
                            />
                        </label>
                    )}

                    <div className="border-t border-border pt-5">
                        <FilaInterruptor
                            titulo="Admin Mode"
                            descripcion="Permet que un administrador pugui continuar en processos bloquejats o tancats quan necessiti revisar-los o ajudar un alumne."
                            activo={
                                configuracion.admin_mode
                            }
                            onChange={(valor) =>
                                actualizar(
                                    "admin_mode",
                                    valor,
                                )
                            }
                        />
                    </div>

                    {configuracion.admin_mode && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs leading-5">
                            L’ús de l’Admin Mode s’haurà de
                            registrar a auditoria. L’administrador
                            haurà de veure un avís abans de
                            saltar-se un bloqueig.
                        </div>
                    )}
                </div>
            </section>

            <section className={seccion}>
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Cursos i grups
                    </h2>

                    <p className="mt-1 text-sm">
                        Cursos disponibles durant{" "}
                        <span className="font-medium text-neutral-titulos">
                            {configuracion.curso_academico_actual ||
                                "el curs actual"}
                        </span>
                        .
                    </p>

                    <p className="mt-2 text-xs leading-5">
                        A ESO i Batxillerat, el grup és només
                        la lletra. Per exemple: A, B, C. En FP,
                        el grup pot ser el nom complet del cicle.
                    </p>
                </div>

                <div className="mb-5 flex flex-col gap-2 sm:flex-row">
                    <input
                        type="text"
                        value={nuevoCurso}
                        maxLength={100}
                        placeholder="Nom del curs: 3ESO, 4ESO, 1BAT, FP..."
                        onChange={(evento) =>
                            setNuevoCurso(evento.target.value)
                        }
                        onKeyDown={(evento) => {
                            if (evento.key === "Enter") {
                                evento.preventDefault();
                                añadirCurso();
                            }
                        }}
                        className={campo}
                    />

                    <button
                        type="button"
                        onClick={añadirCurso}
                        className={`${boton} shrink-0`}
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

                        Afegir curs
                    </button>
                </div>

                {configuracion.cursos.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center">
                        <p className="text-sm font-medium text-neutral-titulos">
                            No hi ha cursos configurats.
                        </p>

                        <p className="mt-1 text-xs">
                            Afegeix el primer curs per començar.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {configuracion.cursos.map(
                            (curso, indiceCurso) => (
                                <article
                                    key={`${curso.curso}-${indiceCurso}`}
                                    className="rounded-xl border border-border bg-card p-4"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-base font-semibold text-neutral-titulos">
                                                {curso.curso}
                                            </p>

                                            <p className="mt-1 text-xs">
                                                {curso.grupos.length === 0
                                                    ? "Sense grups"
                                                    : `${curso.grupos.length} grup${
                                                          curso.grupos.length ===
                                                          1
                                                              ? ""
                                                              : "s"
                                                      }`}
                                            </p>
                                        </div>

                                        <div className="flex gap-1">
                                            <button
                                                type="button"
                                                title="Pujar curs"
                                                disabled={
                                                    indiceCurso === 0
                                                }
                                                onClick={() =>
                                                    moverCurso(
                                                        indiceCurso,
                                                        -1,
                                                    )
                                                }
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background disabled:opacity-30"
                                            >
                                                ↑
                                            </button>

                                            <button
                                                type="button"
                                                title="Baixar curs"
                                                disabled={
                                                    indiceCurso ===
                                                    configuracion.cursos
                                                        .length -
                                                        1
                                                }
                                                onClick={() =>
                                                    moverCurso(
                                                        indiceCurso,
                                                        1,
                                                    )
                                                }
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background disabled:opacity-30"
                                            >
                                                ↓
                                            </button>

                                            <button
                                                type="button"
                                                title="Eliminar curs"
                                                onClick={() =>
                                                    eliminarCurso(
                                                        indiceCurso,
                                                    )
                                                }
                                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-error/30 bg-error/5 text-error"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>

                                    {curso.grupos.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {curso.grupos.map(
                                                (
                                                    grupo,
                                                    indiceGrupo,
                                                ) => (
                                                    <span
                                                        key={`${grupo}-${indiceGrupo}`}
                                                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-neutral-titulos"
                                                    >
                                                        {grupo}

                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                eliminarGrupo(
                                                                    indiceCurso,
                                                                    indiceGrupo,
                                                                )
                                                            }
                                                            className="text-error"
                                                            aria-label={`Eliminar grup ${grupo}`}
                                                        >
                                                            ×
                                                        </button>
                                                    </span>
                                                ),
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                        <input
                                            type="text"
                                            value={
                                                gruposNuevos[
                                                    indiceCurso
                                                ] ?? ""
                                            }
                                            placeholder={
                                                curso.curso
                                                    .toLocaleLowerCase(
                                                        "ca-ES",
                                                    )
                                                    .includes("fp")
                                                    ? "Ex: 1r GM Cuina i gastronomia"
                                                    : "Ex: A"
                                            }
                                            onChange={(evento) =>
                                                setGruposNuevos(
                                                    (actual) => ({
                                                        ...actual,

                                                        [indiceCurso]:
                                                            evento
                                                                .target
                                                                .value,
                                                    }),
                                                )
                                            }
                                            onKeyDown={(evento) => {
                                                if (
                                                    evento.key ===
                                                    "Enter"
                                                ) {
                                                    evento.preventDefault();

                                                    añadirGrupo(
                                                        indiceCurso,
                                                    );
                                                }
                                            }}
                                            className={campo}
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                añadirGrupo(
                                                    indiceCurso,
                                                )
                                            }
                                            className={`${boton} shrink-0`}
                                        >
                                            + Grup
                                        </button>
                                    </div>
                                </article>
                            ),
                        )}
                    </div>
                )}
            </section>

            <section className={seccion}>
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Accés al registre
                    </h2>

                    <p className="mt-1 text-sm">
                        Defineix els dominis i correus que
                        poden crear un compte.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                        <label className="mb-2 block text-xs font-semibold">
                            Dominis autoritzats
                        </label>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={nuevoDominio}
                                placeholder="alu.ibeducacio.eu"
                                onChange={(evento) =>
                                    setNuevoDominio(
                                        evento.target.value,
                                    )
                                }
                                onKeyDown={(evento) => {
                                    if (evento.key === "Enter") {
                                        evento.preventDefault();
                                        añadirDominio();
                                    }
                                }}
                                className={campo}
                            />

                            <button
                                type="button"
                                onClick={añadirDominio}
                                className={boton}
                            >
                                Afegir
                            </button>
                        </div>

                        <div className="mt-3 space-y-2">
                            {configuracion.dominios_registro_permitidos.map(
                                (dominio) => (
                                    <div
                                        key={dominio}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                                    >
                                        <span>
                                            @{dominio}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                eliminarDominio(
                                                    dominio,
                                                )
                                            }
                                            className="text-error"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-xs font-semibold">
                            Correus individuals autoritzats
                        </label>

                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={nuevoEmail}
                                placeholder="usuari@exemple.com"
                                onChange={(evento) =>
                                    setNuevoEmail(
                                        evento.target.value,
                                    )
                                }
                                onKeyDown={(evento) => {
                                    if (evento.key === "Enter") {
                                        evento.preventDefault();
                                        añadirEmail();
                                    }
                                }}
                                className={campo}
                            />

                            <button
                                type="button"
                                onClick={añadirEmail}
                                className={boton}
                            >
                                Afegir
                            </button>
                        </div>

                        <div className="mt-3 space-y-2">
                            {configuracion.emails_registro_permitidos.map(
                                (email) => (
                                    <div
                                        key={email}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                                    >
                                        <span className="min-w-0 truncate">
                                            {email}
                                        </span>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                eliminarEmail(
                                                    email,
                                                )
                                            }
                                            className="text-error"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                ),
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className={seccion}>
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Notificacions
                    </h2>

                    <p className="mt-1 text-sm">
                        Correus que rebran els avisos de
                        la plataforma.
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <label>
                        <span className="mb-2 block text-xs font-semibold">
                            Correu principal
                        </span>

                        <input
                            type="email"
                            value={
                                configuracion.email_notificaciones_principal
                            }
                            placeholder="esports@centre.cat"
                            onChange={(evento) =>
                                actualizar(
                                    "email_notificaciones_principal",
                                    evento.target.value,
                                )
                            }
                            className={campo}
                        />
                    </label>

                    <label>
                        <span className="mb-2 block text-xs font-semibold">
                            Correu secundari
                        </span>

                        <input
                            type="email"
                            value={
                                configuracion.email_notificaciones_secundario
                            }
                            placeholder="Opcional"
                            onChange={(evento) =>
                                actualizar(
                                    "email_notificaciones_secundario",
                                    evento.target.value,
                                )
                            }
                            className={campo}
                        />
                    </label>
                </div>

                <div className="mt-6 space-y-5 border-t border-border pt-5">
                    <FilaInterruptor
                        titulo="Nou usuari registrat"
                        descripcion="Enviar un avís quan es crea un nou compte d’usuari."
                        activo={
                            configuracion.notificar_nuevo_usuario
                        }
                        onChange={(valor) =>
                            actualizar(
                                "notificar_nuevo_usuario",
                                valor,
                            )
                        }
                    />

                    <FilaInterruptor
                        titulo="Nou equip registrat"
                        descripcion="Enviar un avís quan un equip completa la inscripció."
                        activo={
                            configuracion.notificar_nuevo_equipo
                        }
                        onChange={(valor) =>
                            actualizar(
                                "notificar_nuevo_equipo",
                                valor,
                            )
                        }
                    />

                    <FilaInterruptor
                        titulo="Nou voluntari registrat"
                        descripcion="Enviar un avís quan un voluntari completa la inscripció."
                        activo={
                            configuracion.notificar_nuevo_voluntario
                        }
                        onChange={(valor) =>
                            actualizar(
                                "notificar_nuevo_voluntario",
                                valor,
                            )
                        }
                    />

                    <FilaInterruptor
                        titulo="Incidències de formularis"
                        descripcion="Enviar avisos relacionats amb errors o processos que necessiten ajuda."
                        activo={
                            configuracion.notificar_incidencias_formularios
                        }
                        onChange={(valor) =>
                            actualizar(
                                "notificar_incidencias_formularios",
                                valor,
                            )
                        }
                    />
                </div>
            </section>

            <section className={seccion}>
                <div className="mb-5">
                    <h2 className="text-lg font-semibold text-neutral-titulos">
                        Seguiment i incidències
                    </h2>

                    <p className="mt-1 text-sm">
                        Configura quan un formulari inacabat
                        passa a requerir atenció.
                    </p>
                </div>

                <label className="block max-w-sm">
                    <span className="mb-2 block text-xs font-semibold">
                        Hores sense activitat
                    </span>

                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min={1}
                            max={720}
                            step={1}
                            value={
                                configuracion.horas_aviso_formulario_incompleto
                            }
                            onChange={(evento) =>
                                actualizar(
                                    "horas_aviso_formulario_incompleto",
                                    Math.max(
                                        1,
                                        Number(
                                            evento.target.value,
                                        ) || 1,
                                    ),
                                )
                            }
                            className={campo}
                        />

                        <span className="text-sm">
                            hores
                        </span>
                    </div>
                </label>

                <p className="mt-3 max-w-2xl text-xs leading-5">
                    El temps es comptarà des de la darrera
                    activitat registrada de l’usuari.
                </p>
            </section>

            <section className={seccion}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-neutral-titulos">
                            Contactes de suport
                        </h2>

                        <p className="mt-1 text-sm">
                            Gestiona les persones que apareixeran
                            com a contacte d’ajuda.
                        </p>
                    </div>

                    <a
                        href="/panell/configuracio/contactes"
                        className={`${boton} shrink-0`}
                    >
                        Gestionar contactes

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
                            <path d="m9 5 7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </section>

            <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
                <p className="text-xs">
                    {hayCambios
                        ? "Hi ha canvis pendents de guardar."
                        : "Tots els canvis estan guardats."}
                </p>

                <div className="flex gap-2">
                    {hayCambios && (
                        <button
                            type="button"
                            onClick={descartar}
                            disabled={guardando}
                            className={boton}
                        >
                            Descartar
                        </button>
                    )}

                    <button
                        type="submit"
                        disabled={
                            !hayCambios ||
                            guardando
                        }
                        className={botonPrincipal}
                    >
                        {guardando
                            ? "Guardant..."
                            : "Guardar canvis"}
                    </button>
                </div>
            </div>
        </form>
    );
}