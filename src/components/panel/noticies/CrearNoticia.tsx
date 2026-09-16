import {
    useEffect,
    useId,
    useRef,
    useState,
    type FormEvent,
} from "react";

import {
    calcularLecturaNoticia,
    generarSlugNoticia,
    type BloqueNoticia,
    type BloqueTexto,
    type FormularioNoticia,
    type Noticia,
    type TorneoNoticias,
} from "@const/Noticias";

const API = "/api/panell/noticies";
const PORTADA = "portada";
const MAX_BLOQUES = 100;

type Props = {
    usuarioID: string;
    modo?: "crear" | "editar";
    noticiaID?: string | null;
    torneoID?: string | null;
};

type Configuracion = {
    success: true;
    categorias: string[];
    torneos: TorneoNoticias[];
    puedeCrear: boolean;
    autor: {
        nombre: string;
        curso: string;
    };
    limites: {
        imagenBytes: number;
        bloques: number;
    };
};

type Detalle = {
    success: true;
    noticia: Noticia & {
        torneo_nombre: string | null;
    };
    capacidades: {
        editar: boolean;
        eliminar: boolean;
    };
};

type ArchivosPendientes = Record<string, File>;

type Borrador = {
    version: 1;
    clave: string;
    usuarioID: string;
    noticiaID: string | null;
    fecha: string;
    last_save: string | null;
    formulario: FormularioNoticia;
    archivos: ArchivosPendientes;
    slugManual: boolean;
};

type Aviso = {
    tipo: "info" | "error";
    texto: string;
};

const campo =
    "w-full rounded-lg border border-border bg-card px-3.5 py-3 " +
    "text-sm text-neutral outline-none " +
    "focus:border-neutral/50 focus:ring-2 focus:ring-neutral/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

const boton =
    "inline-flex items-center justify-center gap-2 rounded-lg " +
    "border border-border bg-background px-4 py-2.5 " +
    "text-sm font-medium text-neutral transition-colors " +
    "hover:border-neutral/40 hover:bg-card " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-neutral/30 " +
    "disabled:cursor-not-allowed disabled:opacity-50";

const botonPequeno =
    "inline-flex h-8 min-w-8 items-center justify-center " +
    "rounded-md border border-border bg-background px-2 " +
    "text-xs font-medium text-neutral hover:bg-card " +
    "focus-visible:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-neutral/30 " +
    "disabled:cursor-not-allowed disabled:opacity-40";

// ============================================================
// BORRADORES LOCALES
// ============================================================

let conexionBorradores: Promise<IDBDatabase> | null = null;

function abrirBorradores(): Promise<IDBDatabase> {
    if (conexionBorradores) return conexionBorradores;

    conexionBorradores = new Promise((resolve, reject) => {
        const peticion = indexedDB.open("esports-noticies", 1);

        peticion.onupgradeneeded = () => {
            const db = peticion.result;

            if (!db.objectStoreNames.contains("borradores")) {
                db.createObjectStore("borradores", {
                    keyPath: "clave",
                });
            }
        };

        peticion.onsuccess = () => {
            const db = peticion.result;

            db.onversionchange = () => {
                db.close();
                conexionBorradores = null;
            };

            resolve(db);
        };

        peticion.onerror = () => {
            conexionBorradores = null;
            reject(peticion.error);
        };
    });

    return conexionBorradores;
}

async function leerBorrador(clave: string): Promise<Borrador | null> {
    const db = await abrirBorradores();

    return new Promise((resolve, reject) => {
        const transaccion = db.transaction("borradores", "readonly");
        const peticion = transaccion.objectStore("borradores").get(clave);

        peticion.onsuccess = () => {
            const valor = peticion.result as Borrador | undefined;

            if (
                !valor ||
                valor.version !== 1 ||
                valor.clave !== clave ||
                !valor.formulario ||
                !Array.isArray(valor.formulario.content)
            ) {
                resolve(null);
                return;
            }

            resolve(valor);
        };

        peticion.onerror = () => reject(peticion.error);
    });
}

async function escribirBorrador(borrador: Borrador) {
    const db = await abrirBorradores();

    return new Promise<void>((resolve, reject) => {
        const transaccion = db.transaction("borradores", "readwrite");

        transaccion.objectStore("borradores").put(borrador);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);
        transaccion.onabort = () => reject(transaccion.error);
    });
}

async function eliminarBorrador(clave: string) {
    const db = await abrirBorradores();

    return new Promise<void>((resolve, reject) => {
        const transaccion = db.transaction("borradores", "readwrite");

        transaccion.objectStore("borradores").delete(clave);

        transaccion.oncomplete = () => resolve();
        transaccion.onerror = () => reject(transaccion.error);
        transaccion.onabort = () => reject(transaccion.error);
    });
}

// ============================================================
// HTML DEL EDITOR
// ============================================================

/**
 * Limpieza para introducir HTML en el editor del navegador.
 * La API vuelve a sanearlo antes de guardarlo.
 */
function limpiarHTMLLocal(html: string): string {
    const documento = new DOMParser().parseFromString(
        html,
        "text/html",
    );

    documento
        .querySelectorAll(
            "script,style,iframe,object,embed,svg,math,template,link,meta",
        )
        .forEach((elemento) => elemento.remove());

    const permitidas = new Set([
        "P", "DIV", "BR",
        "STRONG", "B", "EM", "I", "U",
        "S", "STRIKE", "DEL",
        "H2", "H3", "H4",
        "UL", "OL", "LI",
        "BLOCKQUOTE", "A", "SPAN",
        "SUB", "SUP", "HR",
    ]);

    const estilosPermitidos: Record<string, RegExp> = {
        "text-align": /^(left|center|right|justify)$/,
        "font-weight": /^(normal|bold|[1-9]00)$/,
        "font-style": /^(normal|italic)$/,
        "text-decoration": /^(none|underline|line-through|underline line-through)$/,
    };

    for (const elemento of Array.from(
        documento.body.querySelectorAll("*"),
    )) {
        if (!permitidas.has(elemento.tagName)) {
            elemento.replaceWith(...Array.from(elemento.childNodes));
            continue;
        }

        const htmlElemento = elemento as HTMLElement;
        const estilos: string[] = [];

        for (const [propiedad, regla] of Object.entries(estilosPermitidos)) {
            const valor = htmlElemento.style
                .getPropertyValue(propiedad)
                .trim();

            if (regla.test(valor)) {
                estilos.push(`${propiedad}:${valor}`);
            }
        }

        const href = elemento.getAttribute("href");
        const titulo = elemento.getAttribute("title");

        for (const atributo of Array.from(elemento.attributes)) {
            elemento.removeAttribute(atributo.name);
        }

        if (estilos.length > 0) {
            elemento.setAttribute("style", estilos.join(";"));
        }

        if (elemento.tagName === "A" && href) {
            try {
                const url = new URL(href, window.location.origin);

                if (["http:", "https:", "mailto:"].includes(url.protocol)) {
                    elemento.setAttribute("href", url.href);
                    elemento.setAttribute("target", "_blank");
                    elemento.setAttribute("rel", "noopener noreferrer");

                    if (titulo) {
                        elemento.setAttribute("title", titulo);
                    }
                }
            } catch {
                // Se conserva el texto, sin enlace.
            }
        }
    }

    return documento.body.innerHTML;
}

// ============================================================
// EDITOR DE TEXTO ENRIQUECIDO
// ============================================================

function EditorTexto({
    valor,
    bloqueado,
    onCambiar,
}: {
    valor: string;
    bloqueado: boolean;
    onCambiar: (html: string) => void;
}) {
    const editorRef = useRef<HTMLDivElement>(null);
    const ultimoEmitido = useRef<string | null>(null);
    const seleccionRef = useRef<Range | null>(null);
    const enlaceInputRef = useRef<HTMLInputElement>(null);

    const [mostrarEnlace, setMostrarEnlace] = useState(false);
    const [urlEnlace, setUrlEnlace] = useState("");
    const [errorEnlace, setErrorEnlace] = useState("");

    useEffect(() => {
        const editor = editorRef.current;

        if (!editor || ultimoEmitido.current === valor) return;

        const limpio = limpiarHTMLLocal(valor);

        if (editor.innerHTML !== limpio) {
            editor.innerHTML = limpio;
        }
    }, [valor]);

    useEffect(() => {
        if (mostrarEnlace) {
            enlaceInputRef.current?.focus();
        }
    }, [mostrarEnlace]);

    function emitir() {
        const html = editorRef.current?.innerHTML ?? "";
        ultimoEmitido.current = html;
        onCambiar(html);
    }

    function recordarSeleccion() {
        const editor = editorRef.current;
        const seleccion = window.getSelection();

        if (!editor || !seleccion || seleccion.rangeCount === 0) return;

        const rango = seleccion.getRangeAt(0);

        if (editor.contains(rango.commonAncestorContainer)) {
            seleccionRef.current = rango.cloneRange();
        }
    }

    function restaurarSeleccion() {
        const editor = editorRef.current;
        if (!editor) return;

        editor.focus();

        const rango = seleccionRef.current;

        if (
            rango &&
            editor.contains(rango.commonAncestorContainer)
        ) {
            const seleccion = window.getSelection();
            seleccion?.removeAllRanges();
            seleccion?.addRange(rango);
        }
    }

    function aplicar(comando: string, argumento?: string) {
        if (bloqueado) return;

        restaurarSeleccion();

        // Conserva el comportamiento del editor original.
        document.execCommand(comando, false, argumento);

        recordarSeleccion();
        emitir();
    }

    function insertarEnlace() {
        let url: URL;

        try {
            url = new URL(urlEnlace.trim());

            if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
                throw new Error("Protocolo no válido");
            }
        } catch {
            setErrorEnlace("Introdueix una adreça https://, http:// o mailto:.");
            return;
        }

        restaurarSeleccion();

        const seleccion = window.getSelection();

        if (!seleccion || seleccion.isCollapsed) {
            setErrorEnlace("Selecciona primer el text que ha de tenir l'enllaç.");
            return;
        }

        aplicar("createLink", url.href);
        setMostrarEnlace(false);
        setUrlEnlace("");
        setErrorEnlace("");
    }

    const herramientas = [
        { texto: "B", nombre: "Negreta", comando: "bold" },
        { texto: "I", nombre: "Cursiva", comando: "italic" },
        { texto: "U", nombre: "Subratllat", comando: "underline" },
        { texto: "S", nombre: "Ratllat", comando: "strikeThrough" },
        { texto: "•", nombre: "Llista amb punts", comando: "insertUnorderedList" },
        { texto: "1.", nombre: "Llista numerada", comando: "insertOrderedList" },
        { texto: "←", nombre: "Alinear a l'esquerra", comando: "justifyLeft" },
        { texto: "↔", nombre: "Centrar", comando: "justifyCenter" },
        { texto: "→", nombre: "Alinear a la dreta", comando: "justifyRight" },
    ];

    return (
        <div className="overflow-hidden rounded-xl border border-border">
            <div className="flex flex-wrap gap-1.5 border-b border-border bg-card p-2">
                {herramientas.map((herramienta) => (
                    <button
                        key={herramienta.comando}
                        type="button"
                        title={herramienta.nombre}
                        aria-label={herramienta.nombre}
                        disabled={bloqueado}
                        className={botonPequeno}
                        onMouseDown={(evento) => evento.preventDefault()}
                        onClick={() => aplicar(herramienta.comando)}
                    >
                        {herramienta.texto}
                    </button>
                ))}

                <button
                    type="button"
                    disabled={bloqueado}
                    className={botonPequeno}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => {
                        recordarSeleccion();
                        setMostrarEnlace(true);
                        setErrorEnlace("");
                    }}
                >
                    Enllaç
                </button>

                <button
                    type="button"
                    disabled={bloqueado}
                    className={botonPequeno}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => aplicar("unlink")}
                >
                    Treure enllaç
                </button>

                <button
                    type="button"
                    disabled={bloqueado}
                    className={botonPequeno}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => aplicar("removeFormat")}
                >
                    Netejar format
                </button>
            </div>

            {mostrarEnlace && (
                <div className="space-y-2 border-b border-border bg-background p-3">
                    <label className="block text-xs font-semibold">
                        Adreça de l'enllaç
                        <input
                            ref={enlaceInputRef}
                            type="text"
                            value={urlEnlace}
                            disabled={bloqueado}
                            placeholder="https://..."
                            className={`${campo} mt-2`}
                            onChange={(evento) => setUrlEnlace(evento.target.value)}
                            onKeyDown={(evento) => {
                                if (evento.key === "Enter") {
                                    evento.preventDefault();
                                    insertarEnlace();
                                }
                            }}
                        />
                    </label>

                    {errorEnlace && (
                        <p role="alert" className="text-xs">
                            {errorEnlace}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={bloqueado}
                            className={botonPequeno}
                            onClick={insertarEnlace}
                        >
                            Aplicar
                        </button>
                        <button
                            type="button"
                            className={botonPequeno}
                            onClick={() => setMostrarEnlace(false)}
                        >
                            Cancel·lar
                        </button>
                    </div>
                </div>
            )}

            <div
                ref={editorRef}
                contentEditable={!bloqueado}
                suppressContentEditableWarning
                role="textbox"
                aria-label="Contingut del bloc de text"
                aria-multiline="true"
                aria-disabled={bloqueado}
                onInput={emitir}
                onKeyUp={recordarSeleccion}
                onMouseUp={recordarSeleccion}
                onBlur={recordarSeleccion}
                onPaste={(evento) => {
                    evento.preventDefault();

                    if (bloqueado) return;

                    const html = evento.clipboardData.getData("text/html");
                    const texto = evento.clipboardData.getData("text/plain");

                    if (html) {
                        document.execCommand(
                            "insertHTML",
                            false,
                            limpiarHTMLLocal(html),
                        );
                    } else {
                        document.execCommand("insertText", false, texto);
                    }

                    recordarSeleccion();
                    emitir();
                }}
                onDrop={(evento) => evento.preventDefault()}
                className="
                    min-h-52 wrap-break-words bg-background p-4
                    text-sm leading-7 outline-none
                    focus:ring-2 focus:ring-inset focus:ring-neutral/20
                    [&_a]:underline [&_a]:underline-offset-4
                    [&_ul]:list-disc [&_ul]:pl-6
                    [&_ol]:list-decimal [&_ol]:pl-6
                    [&_p]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold
                    [&_h3]:text-lg [&_h3]:font-semibold
                    [&_blockquote]:border-l-2
                    [&_blockquote]:border-border [&_blockquote]:pl-4
                "
            />
        </div>
    );
}

// ============================================================
// HELPERS
// ============================================================

function nuevoTexto(): BloqueTexto {
    return {
        id: crypto.randomUUID(),
        order: 1,
        type: "text",
        title: "",
        body: "",
    };
}

function normalizarOrden(bloques: BloqueNoticia[]) {
    return bloques.map((bloque, indice) => ({
        ...bloque,
        order: indice + 1,
    }));
}

function fechaVisible(valor: string | null) {
    if (!valor) return "";

    const fecha = new Date(valor);

    return Number.isNaN(fecha.getTime())
        ? ""
        : new Intl.DateTimeFormat("ca-ES", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Europe/Madrid",
          }).format(fecha);
}

async function consultar<T>(
    parametros: URLSearchParams,
    signal: AbortSignal,
): Promise<T> {
    const respuesta = await fetch(`${API}?${parametros.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
    });

    const datos = await respuesta.json().catch(() => null);

    if (!respuesta.ok || datos?.success !== true) {
        throw new Error(
            datos?.mensaje || "No s'ha pogut carregar la informació.",
        );
    }

    return datos as T;
}

// ============================================================
// EDITOR PRINCIPAL
// ============================================================

export default function CrearNoticia({
    usuarioID,
    modo = "crear",
    noticiaID = null,
    torneoID = null,
}: Props) {
    const editando = modo === "editar";

    const claveBorrador = [
        "noticia",
        usuarioID,
        editando ? noticiaID || "sense-id" : "nova",
        editando ? "" : torneoID || "general",
    ].join(":");

    const [configuracion, setConfiguracion] =
        useState<Configuracion | null>(null);

    const [detalle, setDetalle] = useState<Detalle | null>(null);
    const [formulario, setFormulario] =
        useState<FormularioNoticia | null>(null);

    const [archivos, setArchivos] = useState<ArchivosPendientes>({});
    const [previsualizaciones, setPrevisualizaciones] =
        useState<Record<string, string>>({});

    const [version, setVersion] = useState<string | null>(null);
    const [slugManual, setSlugManual] = useState(false);

    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState("");
    const [intento, setIntento] = useState(0);

    const [guardando, setGuardando] = useState(false);
    const [estadoGuardado, setEstadoGuardado] = useState("");
    const [aviso, setAviso] = useState<Aviso | null>(null);
    const [conflicto, setConflicto] = useState(false);

    const [modificado, setModificado] = useState(false);
    const [confirmarSalida, setConfirmarSalida] = useState(false);

    const [borradorEncontrado, setBorradorEncontrado] =
        useState<Borrador | null>(null);

    const [fechaBorrador, setFechaBorrador] = useState<string | null>(null);
    const [guardandoBorrador, setGuardandoBorrador] = useState(false);
    const [errorBorrador, setErrorBorrador] = useState("");
    const [revisionEditor, setRevisionEditor] = useState(0);

    const bloqueoGuardado = useRef(false);
    const publicadoRef = useRef(false);
    const colaBorradorRef = useRef<Promise<void>>(Promise.resolve());
    const guardadosLocalesRef = useRef(0);

    const formularioRef = useRef<HTMLFormElement>(null);
    const avisoRef = useRef<HTMLDivElement>(null);
    const portadaInputID = useId();

    // ========================================================
    // CARGA
    // ========================================================

    useEffect(() => {
        const controlador = new AbortController();

        setCargando(true);
        setErrorCarga("");
        setFormulario(null);
        setDetalle(null);
        setArchivos({});
        setBorradorEncontrado(null);
        setAviso(null);
        setConflicto(false);
        setModificado(false);
        setFechaBorrador(null);
        setErrorBorrador("");
        publicadoRef.current = false;

        async function cargar() {
            try {
                if (!usuarioID || (editando && !noticiaID)) {
                    throw new Error("Falta l'identificador necessari per obrir l'editor.");
                }

                const [config, datos] = await Promise.all([
                    consultar<Configuracion>(
                        new URLSearchParams({ vista: "configuracion" }),
                        controlador.signal,
                    ),
                    editando
                        ? consultar<Detalle>(
                              new URLSearchParams({
                                  vista: "detalle",
                                  id: noticiaID!,
                              }),
                              controlador.signal,
                          )
                        : Promise.resolve(null),
                ]);

                if (controlador.signal.aborted) return;

                if (datos && !datos.capacidades.editar) {
                    throw new Error("No tens permís per editar aquesta notícia.");
                }

                if (!editando && !config.puedeCrear) {
                    throw new Error("No tens permís per publicar notícies en cap torneig.");
                }

                const noticia = datos?.noticia;

                const seleccionado = config.torneos.find(
                    (torneo) => torneo.id === torneoID && torneo.puedeCrear,
                );

                setConfiguracion(config);
                setDetalle(datos);
                setVersion(noticia?.last_save ?? null);
                setSlugManual(editando);

                setFormulario({
                    titular: noticia?.titular ?? "",
                    subtitulo: noticia?.subtitulo ?? "",
                    cover_image: noticia?.cover_image ?? "",
                    slug: noticia?.slug ?? "",
                    author: noticia?.author ?? config.autor.nombre,
                    author_curso: noticia?.author_curso ?? config.autor.curso,
                    categoria: noticia?.categoria ?? "",
                    torneo_id: noticia?.torneo_id ?? seleccionado?.id ?? "",
                    content: noticia
                        ? normalizarOrden(noticia.content ?? [])
                        : [nuevoTexto()],
                });

                try {
                    const local = await leerBorrador(claveBorrador);

                    if (
                        !controlador.signal.aborted &&
                        local?.usuarioID === usuarioID &&
                        local.noticiaID === (editando ? noticiaID : null)
                    ) {
                        setBorradorEncontrado(local);
                    }
                } catch {
                    if (!controlador.signal.aborted) {
                        setErrorBorrador(
                            "El navegador no ha permès consultar els esborranys locals.",
                        );
                    }
                }
            } catch (error) {
                if (!controlador.signal.aborted) {
                    setErrorCarga(
                        error instanceof Error
                            ? error.message
                            : "No s'ha pogut obrir l'editor.",
                    );
                }
            } finally {
                if (!controlador.signal.aborted) setCargando(false);
            }
        }

        void cargar();

        return () => controlador.abort();
    }, [
        usuarioID,
        editando,
        noticiaID,
        torneoID,
        claveBorrador,
        intento,
    ]);

    // ========================================================
    // PREVISUALIZACIONES DE ARCHIVOS LOCALES
    // ========================================================

    useEffect(() => {
        const urls: Record<string, string> = {};

        for (const [clave, archivo] of Object.entries(archivos)) {
            urls[clave] = URL.createObjectURL(archivo);
        }

        setPrevisualizaciones(urls);

        return () => {
            Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
        };
    }, [archivos]);

    // ========================================================
    // AVISO AL SALIR
    // ========================================================

    useEffect(() => {
        if (!modificado) return;

        function antesDeSalir(evento: BeforeUnloadEvent) {
            evento.preventDefault();
            evento.returnValue = "";
        }

        window.addEventListener("beforeunload", antesDeSalir);

        return () => window.removeEventListener("beforeunload", antesDeSalir);
    }, [modificado]);

    useEffect(() => {
        if (aviso?.tipo === "error") {
            avisoRef.current?.focus();
        }
    }, [aviso]);

    // ========================================================
    // GUARDADO LOCAL SERIALIZADO
    // ========================================================

    function guardarLocal(
        datos: FormularioNoticia,
        pendientes: ArchivosPendientes,
    ): Promise<void> {
        const borrador: Borrador = {
            version: 1,
            clave: claveBorrador,
            usuarioID,
            noticiaID: editando ? noticiaID : null,
            fecha: new Date().toISOString(),
            last_save: version,
            formulario: structuredClone(datos),
            archivos: { ...pendientes },
            slugManual,
        };

        guardadosLocalesRef.current += 1;
        setGuardandoBorrador(true);
        setErrorBorrador("");

        const operacion = colaBorradorRef.current
            .catch(() => undefined)
            .then(async () => {
                if (publicadoRef.current) return;

                await escribirBorrador(borrador);
                setFechaBorrador(borrador.fecha);
            });

        colaBorradorRef.current = operacion;

        return operacion
            .catch(() => {
                setErrorBorrador(
                    "No s'ha pogut desar l'esborrany al navegador. Comprova l'espai disponible.",
                );

                throw new Error("No s'ha pogut desar l'esborrany local.");
            })
            .finally(() => {
                guardadosLocalesRef.current -= 1;

                if (guardadosLocalesRef.current === 0) {
                    setGuardandoBorrador(false);
                }
            });
    }

    useEffect(() => {
        if (
            !formulario ||
            !modificado ||
            guardando ||
            borradorEncontrado ||
            publicadoRef.current
        ) {
            return;
        }

        const temporizador = window.setTimeout(() => {
            void guardarLocal(formulario, archivos).catch(() => undefined);
        }, 10_000);

        return () => window.clearTimeout(temporizador);
    }, [
        formulario,
        archivos,
        slugManual,
        version,
        modificado,
        guardando,
        borradorEncontrado,
    ]);

    // ========================================================
    // ESTADOS INICIALES
    // ========================================================

    if (cargando) {
        return (
            <div
                role="status"
                className="flex min-h-80 flex-col items-center justify-center gap-4 text-neutral"
            >
                <span
                    aria-hidden="true"
                    className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-neutral"
                />
                <p className="text-sm">Carregant l'editor...</p>
            </div>
        );
    }

    if (errorCarga || !formulario || !configuracion) {
        return (
            <div className="space-y-5 rounded-2xl border border-border bg-background p-6 text-neutral">
                <h1 className="text-xl font-semibold">
                    No s'ha pogut obrir l'editor
                </h1>

                <p role="alert" className="text-sm leading-6">
                    {errorCarga || "Falten les dades necessàries."}
                </p>

                <div className="flex flex-wrap gap-3">
                    <a href="/panell/noticies" className={boton}>
                        Tornar a notícies
                    </a>

                    <button
                        type="button"
                        className={boton}
                        onClick={() => setIntento((valor) => valor + 1)}
                    >
                        Tornar-ho a provar
                    </button>
                </div>
            </div>
        );
    }

    const datos = formulario;
    const config = configuracion;

    const bloqueado = guardando || borradorEncontrado !== null;

    const torneosDisponibles = config.torneos.filter(
        (torneo) =>
            torneo.puedeCrear ||
            (
                editando &&
                torneo.id === detalle?.noticia.torneo_id
            ),
    );

    const categorias = [
        ...new Set([
            ...config.categorias,
            ...(datos.categoria ? [datos.categoria] : []),
        ]),
    ];

    const urlPortada = previsualizaciones[PORTADA] || datos.cover_image;

    // Incluye las imágenes pendientes en la estimación,
    // aunque todavía no tengan URL de Supabase.
    const lectura = calcularLecturaNoticia({
        ...datos,
        cover_image: archivos[PORTADA] ? "pendiente" : datos.cover_image,
        content: datos.content.map((bloque) =>
            bloque.type === "imagen" && archivos[bloque.id]
                ? {
                      ...bloque,
                      body: {
                          ...bloque.body,
                          url: "pendiente",
                      },
                  }
                : bloque,
        ),
    });

    const enlaceListado = datos.torneo_id
        ? `/panell/noticies?torneoID=${encodeURIComponent(datos.torneo_id)}`
        : "/panell/noticies";

    // ========================================================
    // CAMBIOS
    // ========================================================

    function marcarCambio() {
        setModificado(true);
        setAviso(null);
    }

    function cambiarCampo<K extends keyof FormularioNoticia>(
        campoNombre: K,
        valor: FormularioNoticia[K],
    ) {
        if (bloqueado) return;

        setFormulario((actual) =>
            actual ? { ...actual, [campoNombre]: valor } : actual,
        );

        marcarCambio();
    }

    function cambiarTitular(titular: string) {
        if (bloqueado) return;

        setFormulario((actual) =>
            actual
                ? {
                      ...actual,
                      titular,
                      slug: slugManual
                          ? actual.slug
                          : generarSlugNoticia(titular),
                  }
                : actual,
        );

        marcarCambio();
    }

    function cambiarBloque(
        id: string,
        transformar: (bloque: BloqueNoticia) => BloqueNoticia,
    ) {
        if (bloqueado) return;

        setFormulario((actual) =>
            actual
                ? {
                      ...actual,
                      content: actual.content.map((bloque) =>
                          bloque.id === id ? transformar(bloque) : bloque,
                      ),
                  }
                : actual,
        );

        marcarCambio();
    }

    function anadirBloque(tipo: "text" | "imagen" | "cita") {
        if (bloqueado) return;

        if (datos.content.length >= Math.min(config.limites.bloques, MAX_BLOQUES)) {
            setAviso({
                tipo: "error",
                texto: "Has arribat al límit de blocs d'aquesta notícia.",
            });
            return;
        }

        const base = {
            id: crypto.randomUUID(),
            order: datos.content.length + 1,
            title: "",
        };

        let bloque: BloqueNoticia;

        if (tipo === "text") {
            bloque = { ...base, type: "text", body: "" };
        } else if (tipo === "imagen") {
            bloque = {
                ...base,
                type: "imagen",
                body: { id: "", url: "", alt: "", autor: "" },
            };
        } else {
            bloque = {
                ...base,
                type: "cita",
                body: { text: "", autor: "" },
            };
        }

        cambiarCampo("content", [...datos.content, bloque]);
    }

    function moverBloque(indice: number, desplazamiento: number) {
        const destino = indice + desplazamiento;

        if (bloqueado || destino < 0 || destino >= datos.content.length) return;

        const bloques = [...datos.content];

        [bloques[indice], bloques[destino]] =
            [bloques[destino], bloques[indice]];

        cambiarCampo("content", normalizarOrden(bloques));
    }

    function quitarBloque(id: string) {
        if (bloqueado) return;

        cambiarCampo(
            "content",
            normalizarOrden(datos.content.filter((bloque) => bloque.id !== id)),
        );

        setArchivos((actual) => {
            const copia = { ...actual };
            delete copia[id];
            return copia;
        });
    }

    function seleccionarImagen(clave: string, archivo?: File) {
        if (!archivo || bloqueado) return;

        if (archivo.size > config.limites.imagenBytes) {
            setAviso({
                tipo: "error",
                texto: "La imatge no pot superar els 3 MB.",
            });
            return;
        }

        if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(archivo.type)) {
            setAviso({
                tipo: "error",
                texto: "Selecciona una imatge JPG, PNG, WebP o AVIF.",
            });
            return;
        }

        setArchivos((actual) => ({
            ...actual,
            [clave]: archivo,
        }));

        marcarCambio();
    }

    function quitarPortada() {
        if (bloqueado) return;

        cambiarCampo("cover_image", "");

        setArchivos((actual) => {
            const copia = { ...actual };
            delete copia[PORTADA];
            return copia;
        });
    }

    // ========================================================
    // RECUPERACIÓN DE BORRADORES
    // ========================================================

    function recuperarBorrador() {
        if (!borradorEncontrado) return;

        const local = borradorEncontrado;

        setFormulario({
            ...local.formulario,
            content: normalizarOrden(
                local.formulario.content.map((bloque) =>
                    bloque.type === "text"
                        ? { ...bloque, body: limpiarHTMLLocal(bloque.body) }
                        : bloque,
                ),
            ),
        });

        setArchivos(
            Object.fromEntries(
                Object.entries(local.archivos ?? {}).filter(
                    ([, archivo]) => archivo instanceof File,
                ),
            ),
        );

        setVersion(local.last_save);
        setSlugManual(local.slugManual);
        setFechaBorrador(local.fecha);
        setBorradorEncontrado(null);
        setModificado(true);
        setRevisionEditor((valor) => valor + 1);

        if (editando && local.last_save !== detalle?.noticia.last_save) {
            setConflicto(true);
            setAviso({
                tipo: "error",
                texto:
                    "L'esborrany correspon a una versió anterior. Pots recuperar el text, " +
                    "però no sobreescriure la notícia actual. Obre la versió publicada " +
                    "en una altra pestanya per comparar-la.",
            });
        }
    }

    async function descartarBorradorAnterior() {
        try {
            await eliminarBorrador(claveBorrador);
            setBorradorEncontrado(null);
        } catch {
            setErrorBorrador("No s'ha pogut eliminar l'esborrany anterior.");
        }
    }

    // ========================================================
    // SALIDA
    // ========================================================

    function salir() {
        if (guardando) return;

        if (modificado) {
            setConfirmarSalida(true);
        } else {
            window.location.assign(enlaceListado);
        }
    }

    async function guardarYSalir() {
        try {
            await guardarLocal(datos, archivos);
            window.location.assign(enlaceListado);
        } catch {
            // El mensaje del guardado local permanece visible.
        }
    }

    // ========================================================
    // SUBIDA DE ARCHIVOS Y PUBLICACIÓN
    // ========================================================

    async function enviarImagen(
        archivo: File,
        torneoDestino: string,
    ): Promise<{ id: string; url: string }> {
        const cuerpo = new FormData();

        cuerpo.set("accion", "subir-imagen");
        cuerpo.set("torneo_id", torneoDestino);
        cuerpo.set("file", archivo);

        if (editando && noticiaID) {
            cuerpo.set("noticia_id", noticiaID);
        }

        const respuesta = await fetch(API, {
            method: "POST",
            credentials: "same-origin",
            body: cuerpo,
        });

        const resultado = await respuesta.json().catch(() => null);

        if (!respuesta.ok || resultado?.success !== true) {
            throw new Error(
                resultado?.mensaje || "No s'ha pogut pujar una imatge.",
            );
        }

        return resultado.imagen;
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (bloqueado || bloqueoGuardado.current || conflicto) return;
        if (!formularioRef.current?.reportValidity()) return;

        const destinoPermitido = torneosDisponibles.some(
            (torneo) => torneo.id === datos.torneo_id,
        );

        if (!destinoPermitido) {
            setAviso({
                tipo: "error",
                texto: "Selecciona un torneig en el qual puguis publicar aquesta notícia.",
            });
            return;
        }

        const imagenIncompleta = datos.content.some(
            (bloque) =>
                bloque.type === "imagen" &&
                !bloque.body.url &&
                !archivos[bloque.id],
        );

        if (imagenIncompleta) {
            setAviso({
                tipo: "error",
                texto: "Hi ha un bloc d'imatge buit. Afegeix-hi una imatge o elimina el bloc.",
            });
            return;
        }

        bloqueoGuardado.current = true;
        setGuardando(true);
        setAviso(null);
        setEstadoGuardado("Preparant la notícia...");

        let final = structuredClone(datos);
        const pendientes = { ...archivos };

        try {
            const entradas = Object.entries(pendientes);

            for (let indice = 0; indice < entradas.length; indice += 1) {
                const [clave, archivo] = entradas[indice];

                // Ignora archivos de bloques que ya no existen.
                if (
                    clave !== PORTADA &&
                    !final.content.some(
                        (bloque) => bloque.id === clave && bloque.type === "imagen",
                    )
                ) {
                    delete pendientes[clave];
                    continue;
                }

                setEstadoGuardado(
                    `Pujant imatge ${indice + 1} de ${entradas.length}...`,
                );

                const imagen = await enviarImagen(archivo, final.torneo_id);

                if (clave === PORTADA) {
                    final.cover_image = imagen.url;
                } else {
                    final.content = final.content.map((bloque) =>
                        bloque.id === clave && bloque.type === "imagen"
                            ? {
                                  ...bloque,
                                  body: {
                                      ...bloque.body,
                                      id: imagen.id,
                                      url: imagen.url,
                                  },
                              }
                            : bloque,
                    );
                }

                delete pendientes[clave];

                // Si falla una imagen posterior, las ya subidas se reutilizan.
                setFormulario(structuredClone(final));
                setArchivos({ ...pendientes });
            }

            setEstadoGuardado(
                editando ? "Desant els canvis..." : "Publicant la notícia...",
            );

            const respuesta = await fetch(API, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    accion: editando ? "editar" : "crear",
                    ...(editando
                        ? {
                              id: noticiaID,
                              last_save: version,
                          }
                        : {}),
                    noticia: final,
                }),
            });

            const resultado = await respuesta.json().catch(() => null);

            if (!respuesta.ok || resultado?.success !== true) {
                if (respuesta.status === 409) {
                    setConflicto(true);
                }

                throw new Error(
                    resultado?.mensaje || "No s'ha pogut desar la notícia.",
                );
            }

            publicadoRef.current = true;
            setModificado(false);

            // Espera a cualquier escritura local en curso antes de borrar.
            await colaBorradorRef.current.catch(() => undefined);

            try {
                await eliminarBorrador(claveBorrador);
            } catch {
                // La noticia ya está guardada. Un fallo local no se
                // presenta como un fallo de publicación.
            }

            const parametros = new URLSearchParams({
                accio: "ver",
                id: resultado.noticia.id,
                torneoID: final.torneo_id,
            });

            window.location.replace(
                `/panell/info/noticia?${parametros.toString()}`,
            );
        } catch (error) {
            setFormulario(final);
            setArchivos(pendientes);

            setAviso({
                tipo: "error",
                texto: error instanceof Error
                    ? error.message
                    : "No s'ha pogut desar la notícia.",
            });

            // Preserva el trabajo también cuando falla la publicación.
            await guardarLocal(final, pendientes).catch(() => undefined);
        } finally {
            bloqueoGuardado.current = false;
            setGuardando(false);
            setEstadoGuardado("");
        }
    }

    // ========================================================
    // INTERFAZ
    // ========================================================

    return (
        <div className="space-y-6 text-neutral">
            <header className="space-y-4">
                <button
                    type="button"
                    disabled={guardando}
                    onClick={salir}
                    className="rounded text-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral/30"
                >
                    ← Tornar a notícies
                </button>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="mb-2 text-xs font-medium tracking-wide">
                            EDITOR DE NOTÍCIES
                        </p>

                        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                            {editando ? "Editar notícia" : "Nova notícia"}
                        </h1>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-border bg-card px-3 py-1.5">
                            {lectura.minutos > 0
                                ? `${lectura.minutos} min de lectura`
                                : "Sense contingut"}
                        </span>

                        <span className="rounded-full border border-border px-3 py-1.5">
                            {lectura.palabras} paraules
                        </span>
                    </div>
                </div>
            </header>

            {borradorEncontrado && (
                <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                    <h2 className="text-sm font-semibold">
                        Hi ha un esborrany guardat en aquest navegador
                    </h2>

                    <p className="text-sm">
                        Darrera desada: {fechaVisible(borradorEncontrado.fecha)}.
                        Recupera'l o continua amb la versió carregada.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={boton}
                            onClick={recuperarBorrador}
                        >
                            Recuperar esborrany
                        </button>
                        <button
                            type="button"
                            className={boton}
                            onClick={() => void descartarBorradorAnterior()}
                        >
                            Descartar esborrany anterior
                        </button>
                    </div>
                </div>
            )}

            {aviso && (
                <div
                    ref={avisoRef}
                    tabIndex={-1}
                    role={aviso.tipo === "error" ? "alert" : "status"}
                    className="rounded-xl border border-border bg-card p-4 text-sm leading-6 outline-none"
                >
                    <p>{aviso.texto}</p>

                    {conflicto && noticiaID && (
                        <a
                            href={`/panell/info/noticia?accio=ver&id=${encodeURIComponent(noticiaID)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-block font-medium underline underline-offset-4"
                        >
                            Obrir la versió actual
                        </a>
                    )}
                </div>
            )}

            {confirmarSalida && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-5">
                    <p className="text-sm leading-6">
                        Hi ha canvis sense publicar. Pots desar-los com a
                        esborrany local abans de sortir.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className={boton}
                            onClick={() => setConfirmarSalida(false)}
                        >
                            Continuar editant
                        </button>

                        <button
                            type="button"
                            disabled={guardandoBorrador}
                            className={boton}
                            onClick={() => void guardarYSalir()}
                        >
                            Desar esborrany i sortir
                        </button>

                        <button
                            type="button"
                            className={boton}
                            onClick={() => window.location.assign(enlaceListado)}
                        >
                            Sortir sense desar els últims canvis
                        </button>
                    </div>
                </div>
            )}

            <form ref={formularioRef} onSubmit={guardar} className="space-y-6">
                <fieldset
                    disabled={bloqueado}
                    className="min-w-0 space-y-6"
                >
                    <section className="space-y-5 rounded-2xl border border-border bg-background p-5 sm:p-6">
                        <h2 className="text-base font-semibold">
                            Dades de la notícia
                        </h2>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Torneig *
                                </span>

                                <select
                                    required
                                    value={datos.torneo_id}
                                    className={campo}
                                    onChange={(evento) =>
                                        cambiarCampo("torneo_id", evento.target.value)
                                    }
                                >
                                    <option value="">Selecciona un torneig</option>

                                    {datos.torneo_id &&
                                        !torneosDisponibles.some(
                                            (torneo) => torneo.id === datos.torneo_id,
                                        ) && (
                                            <option value={datos.torneo_id} disabled>
                                                Torneig no disponible
                                            </option>
                                        )}

                                    {torneosDisponibles.map((torneo) => (
                                        <option key={torneo.id} value={torneo.id}>
                                            {torneo.nombre || "Torneig sense nom"}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Categoria *
                                </span>

                                <select
                                    required
                                    value={datos.categoria}
                                    className={campo}
                                    onChange={(evento) =>
                                        cambiarCampo("categoria", evento.target.value)
                                    }
                                >
                                    <option value="">Selecciona una categoria</option>
                                    {categorias.map((categoria) => (
                                        <option key={categoria} value={categoria}>
                                            {categoria}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold">
                                Titular *
                            </span>
                            <input
                                required
                                maxLength={300}
                                value={datos.titular}
                                onChange={(evento) => cambiarTitular(evento.target.value)}
                                className={`${campo} text-lg font-semibold`}
                                placeholder="Escriu el titular de la notícia"
                            />
                        </label>

                        <label className="block">
                            <span className="mb-2 block text-xs font-semibold">
                                Subtítol
                            </span>
                            <textarea
                                rows={3}
                                maxLength={1000}
                                value={datos.subtitulo}
                                onChange={(evento) =>
                                    cambiarCampo("subtitulo", evento.target.value)
                                }
                                className={campo}
                                placeholder="Una breu introducció a la notícia"
                            />
                        </label>

                        <div>
                            <label className="block">
                                <span className="mb-2 block text-xs font-semibold">
                                    Slug *
                                </span>
                                <input
                                    required
                                    maxLength={200}
                                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                                    value={datos.slug}
                                    className={campo}
                                    onChange={(evento) => {
                                        setSlugManual(true);
                                        cambiarCampo("slug", evento.target.value);
                                    }}
                                />
                            </label>

                            <button
                                type="button"
                                className="mt-2 rounded text-xs underline underline-offset-4"
                                onClick={() => {
                                    setSlugManual(false);
                                    cambiarCampo(
                                        "slug",
                                        generarSlugNoticia(datos.titular),
                                    );
                                }}
                            >
                                Generar a partir del titular
                            </button>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Autor *
                                </span>
                                <input
                                    required
                                    maxLength={250}
                                    value={datos.author}
                                    className={campo}
                                    onChange={(evento) =>
                                        cambiarCampo("author", evento.target.value)
                                    }
                                />
                            </label>

                            <label>
                                <span className="mb-2 block text-xs font-semibold">
                                    Curs de l'autor
                                </span>
                                <input
                                    maxLength={150}
                                    value={datos.author_curso}
                                    className={campo}
                                    onChange={(evento) =>
                                        cambiarCampo("author_curso", evento.target.value)
                                    }
                                />
                            </label>
                        </div>

                        {editando && detalle && (
                            <p className="border-t border-border pt-4 text-xs leading-6">
                                Publicació:{" "}
                                {fechaVisible(detalle.noticia.publication_date) || "Sense data"}
                                {" · "}Darrera modificació:{" "}
                                {fechaVisible(detalle.noticia.last_save) || "Sense informació"}
                            </p>
                        )}
                    </section>

                    <section className="space-y-4 rounded-2xl border border-border bg-background p-5 sm:p-6">
                        <h2 className="text-base font-semibold">Imatge de portada</h2>

                        {urlPortada ? (
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                                <img
                                    src={urlPortada}
                                    alt="Previsualització de la portada"
                                    className="max-h-96 w-full object-contain"
                                />
                            </div>
                        ) : (
                            <label
                                htmlFor={portadaInputID}
                                className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 p-6 text-center"
                            >
                                <span className="text-sm font-semibold">
                                    Selecciona una imatge de portada
                                </span>
                                <span className="text-xs">
                                    JPG, PNG, WebP o AVIF · Màxim 3 MB
                                </span>
                            </label>
                        )}

                        <input
                            id={portadaInputID}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-neutral"
                            onChange={(evento) => {
                                seleccionarImagen(PORTADA, evento.target.files?.[0]);
                                evento.target.value = "";
                            }}
                        />

                        {urlPortada && (
                            <button
                                type="button"
                                className={botonPequeno}
                                onClick={quitarPortada}
                            >
                                Treure portada
                            </button>
                        )}
                    </section>

                    <section className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-base font-semibold">Contingut</h2>
                            <span className="text-xs">{datos.content.length} blocs</span>
                        </div>

                        {datos.content.map((bloque, indice) => (
                            <article
                                key={`${revisionEditor}:${bloque.id}`}
                                className="overflow-hidden rounded-2xl border border-border bg-background"
                            >
                                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/50 p-4">
                                    <h3 className="text-sm font-semibold">
                                        {indice + 1}.{" "}
                                        {bloque.type === "text"
                                            ? "Text"
                                            : bloque.type === "imagen"
                                              ? "Imatge"
                                              : bloque.type === "cita"
                                                ? "Cita"
                                                : "Galeria"}
                                    </h3>

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            disabled={bloqueado || indice === 0}
                                            className={botonPequeno}
                                            aria-label={`Pujar el bloc ${indice + 1}`}
                                            onClick={() => moverBloque(indice, -1)}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            type="button"
                                            disabled={
                                                bloqueado ||
                                                indice === datos.content.length - 1
                                            }
                                            className={botonPequeno}
                                            aria-label={`Baixar el bloc ${indice + 1}`}
                                            onClick={() => moverBloque(indice, 1)}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            type="button"
                                            className={botonPequeno}
                                            onClick={() => quitarBloque(bloque.id)}
                                        >
                                            Eliminar bloc
                                        </button>
                                    </div>
                                </header>

                                <div className="space-y-4 p-4 sm:p-5">
                                    <label className="block">
                                        <span className="mb-2 block text-xs font-semibold">
                                            Títol del bloc
                                        </span>
                                        <input
                                            maxLength={300}
                                            value={bloque.title}
                                            className={campo}
                                            onChange={(evento) =>
                                                cambiarBloque(bloque.id, (actual) => ({
                                                    ...actual,
                                                    title: evento.target.value,
                                                }))
                                            }
                                        />
                                    </label>

                                    {bloque.type === "text" && (
                                        <EditorTexto
                                            valor={bloque.body}
                                            bloqueado={bloqueado}
                                            onCambiar={(html) =>
                                                cambiarBloque(bloque.id, (actual) =>
                                                    actual.type === "text"
                                                        ? { ...actual, body: html }
                                                        : actual,
                                                )
                                            }
                                        />
                                    )}

                                    {bloque.type === "cita" && (
                                        <>
                                            <label className="block">
                                                <span className="mb-2 block text-xs font-semibold">
                                                    Text de la cita *
                                                </span>
                                                <textarea
                                                    required
                                                    rows={4}
                                                    maxLength={10_000}
                                                    value={bloque.body.text}
                                                    className={`${campo} italic`}
                                                    onChange={(evento) =>
                                                        cambiarBloque(bloque.id, (actual) =>
                                                            actual.type === "cita"
                                                                ? {
                                                                      ...actual,
                                                                      body: {
                                                                          ...actual.body,
                                                                          text: evento.target.value,
                                                                      },
                                                                  }
                                                                : actual,
                                                        )
                                                    }
                                                />
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-xs font-semibold">
                                                    Autor de la cita
                                                </span>
                                                <input
                                                    maxLength={250}
                                                    value={bloque.body.autor}
                                                    className={campo}
                                                    onChange={(evento) =>
                                                        cambiarBloque(bloque.id, (actual) =>
                                                            actual.type === "cita"
                                                                ? {
                                                                      ...actual,
                                                                      body: {
                                                                          ...actual.body,
                                                                          autor: evento.target.value,
                                                                      },
                                                                  }
                                                                : actual,
                                                        )
                                                    }
                                                />
                                            </label>
                                        </>
                                    )}

                                    {bloque.type === "imagen" && (
                                        <>
                                            {(previsualizaciones[bloque.id] ||
                                                bloque.body.url) && (
                                                <img
                                                    src={
                                                        previsualizaciones[bloque.id] ||
                                                        bloque.body.url
                                                    }
                                                    alt={bloque.body.alt || ""}
                                                    className="max-h-96 w-full rounded-xl border border-border bg-card object-contain"
                                                />
                                            )}

                                            <label className="block text-xs font-semibold">
                                                Imatge · Màxim 3 MB
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp,image/avif"
                                                    className="mt-2 block w-full text-xs file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-neutral"
                                                    onChange={(evento) => {
                                                        seleccionarImagen(
                                                            bloque.id,
                                                            evento.target.files?.[0],
                                                        );
                                                        evento.target.value = "";
                                                    }}
                                                />
                                            </label>

                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <label>
                                                    <span className="mb-2 block text-xs font-semibold">
                                                        Text alternatiu
                                                    </span>
                                                    <input
                                                        maxLength={500}
                                                        value={bloque.body.alt || ""}
                                                        className={campo}
                                                        onChange={(evento) =>
                                                            cambiarBloque(bloque.id, (actual) =>
                                                                actual.type === "imagen"
                                                                    ? {
                                                                          ...actual,
                                                                          body: {
                                                                              ...actual.body,
                                                                              alt: evento.target.value,
                                                                          },
                                                                      }
                                                                    : actual,
                                                            )
                                                        }
                                                    />
                                                </label>

                                                <label>
                                                    <span className="mb-2 block text-xs font-semibold">
                                                        Autoria de la imatge
                                                    </span>
                                                    <input
                                                        maxLength={250}
                                                        value={bloque.body.autor || ""}
                                                        className={campo}
                                                        onChange={(evento) =>
                                                            cambiarBloque(bloque.id, (actual) =>
                                                                actual.type === "imagen"
                                                                    ? {
                                                                          ...actual,
                                                                          body: {
                                                                              ...actual.body,
                                                                              autor: evento.target.value,
                                                                          },
                                                                      }
                                                                    : actual,
                                                            )
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        </>
                                    )}

                                    {bloque.type === "galeria" && (
                                        <>
                                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                                {bloque.body.map((imagen, posicion) => (
                                                    <img
                                                        key={`${imagen.id}:${posicion}`}
                                                        src={imagen.url}
                                                        alt={imagen.alt || ""}
                                                        className="aspect-video w-full rounded-lg border border-border object-cover"
                                                    />
                                                ))}
                                            </div>

                                            <p className="text-xs leading-6">
                                                Es conserva aquesta galeria existent.
                                                La creació de galeries continua
                                                desactivada, com a l'editor original.
                                            </p>
                                        </>
                                    )}
                                </div>
                            </article>
                        ))}

                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-4">
                            <span className="mr-1 text-xs font-semibold">
                                Afegir bloc
                            </span>

                            <button
                                type="button"
                                className={boton}
                                onClick={() => anadirBloque("text")}
                            >
                                Text
                            </button>
                            <button
                                type="button"
                                className={boton}
                                onClick={() => anadirBloque("imagen")}
                            >
                                Imatge
                            </button>
                            <button
                                type="button"
                                className={boton}
                                onClick={() => anadirBloque("cita")}
                            >
                                Cita
                            </button>
                        </div>
                    </section>
                </fieldset>

                <footer className="space-y-4 rounded-2xl border border-border bg-background p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div aria-live="polite" className="text-xs leading-6">
                            {guardando ? (
                                <p>{estadoGuardado}</p>
                            ) : guardandoBorrador ? (
                                <p>Desant esborrany al navegador...</p>
                            ) : fechaBorrador ? (
                                <p>Esborrany local: {fechaVisible(fechaBorrador)}</p>
                            ) : (
                                <p>Els canvis es desaran localment després de 10 segons sense editar.</p>
                            )}

                            <p>
                                {lectura.minutos > 0
                                    ? `Lectura estimada: ${lectura.minutos} min.`
                                    : "Afegeix contingut per calcular el temps de lectura."}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={bloqueado || guardandoBorrador}
                                className={boton}
                                onClick={() =>
                                    void guardarLocal(datos, archivos)
                                        .catch(() => undefined)
                                }
                            >
                                Desar esborrany
                            </button>

                            <button
                                type="submit"
                                disabled={bloqueado || conflicto}
                                className={`${boton} bg-card font-semibold`}
                            >
                                {guardando
                                    ? "Desant..."
                                    : editando
                                      ? "Desar modificacions"
                                      : "Publicar notícia"}
                            </button>
                        </div>
                    </div>

                    {errorBorrador && (
                        <p role="alert" className="border-t border-border pt-3 text-xs leading-6">
                            {errorBorrador}
                        </p>
                    )}

                    <p className="border-t border-border pt-3 text-xs leading-6">
                        L'esborrany queda en aquest navegador.{" "}
                        {editando
                            ? "Les modificacions no seran visibles fins que les desis."
                            : "La notícia serà visible quan la publiquis."}
                    </p>
                </footer>
            </form>
        </div>
    );
}