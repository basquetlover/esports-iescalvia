import {
    useEffect,
    useId,
    useRef,
    useState,
} from "react";

import type {
    BloqueInformacion,
    ConfigInformacion,
} from "../Asistente";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    valor:
        ConfigInformacion;

    soloLectura:
        boolean;

    bloqueado:
        boolean;

    onCambiar: (
        valor:
            ConfigInformacion
    ) => void;
};

// ============================================================
// ESTILOS
// ============================================================

const campo =
    "w-full rounded-lg border border-border bg-card px-3.5 py-3 " +
    "text-sm text-neutral outline-none " +
    "focus:border-primary focus:ring-2 focus:ring-primary/10 " +
    "disabled:cursor-not-allowed disabled:opacity-60";

const botonPequeno =
    "inline-flex h-8 min-w-8 items-center justify-center " +
    "rounded-md border border-border bg-background px-2 " +
    "text-xs font-medium text-neutral transition " +
    "hover:bg-card focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-neutral/30 " +
    "disabled:cursor-not-allowed disabled:opacity-40";

// ============================================================
// HTML
// ============================================================

function limpiarHTMLLocal(
    html:
        string
): string {
    const documento =
        new DOMParser()
            .parseFromString(
                html,
                "text/html"
            );

    documento
        .querySelectorAll(
            "script,style,iframe,object,embed,svg,math,template,link,meta"
        )
        .forEach(
            elemento =>
                elemento.remove()
        );

    const permitidas =
        new Set([
            "P",
            "DIV",
            "BR",

            "STRONG",
            "B",
            "EM",
            "I",
            "U",

            "S",
            "STRIKE",
            "DEL",

            "H2",
            "H3",
            "H4",

            "UL",
            "OL",
            "LI",

            "BLOCKQUOTE",
            "A",
            "SPAN",

            "SUB",
            "SUP",
            "HR",
        ]);

    const estilosPermitidos:
        Record<
            string,
            RegExp
        > = {
        "text-align":
            /^(left|center|right|justify)$/,

        "font-weight":
            /^(normal|bold|[1-9]00)$/,

        "font-style":
            /^(normal|italic)$/,

        "text-decoration":
            /^(none|underline|line-through|underline line-through)$/,
    };

    for (
        const elemento
        of Array.from(
            documento.body
                .querySelectorAll(
                    "*"
                )
        )
    ) {
        if (
            !permitidas.has(
                elemento.tagName
            )
        ) {
            elemento.replaceWith(
                ...Array.from(
                    elemento.childNodes
                )
            );

            continue;
        }

        const htmlElemento =
            elemento as HTMLElement;

        const estilos:
            string[] = [];

        for (
            const [
                propiedad,
                regla,
            ]
            of Object.entries(
                estilosPermitidos
            )
        ) {
            const valor =
                htmlElemento.style
                    .getPropertyValue(
                        propiedad
                    )
                    .trim();

            if (
                regla.test(
                    valor
                )
            ) {
                estilos.push(
                    `${propiedad}:${valor}`
                );
            }
        }

        const href =
            elemento.getAttribute(
                "href"
            );

        const titulo =
            elemento.getAttribute(
                "title"
            );

        for (
            const atributo
            of Array.from(
                elemento.attributes
            )
        ) {
            elemento.removeAttribute(
                atributo.name
            );
        }

        if (
            estilos.length >
            0
        ) {
            elemento.setAttribute(
                "style",
                estilos.join(
                    ";"
                )
            );
        }

        if (
            elemento.tagName ===
                "A" &&
            href
        ) {
            try {
                const url =
                    new URL(
                        href,
                        window.location.origin
                    );

                if (
                    [
                        "http:",
                        "https:",
                        "mailto:",
                    ].includes(
                        url.protocol
                    )
                ) {
                    elemento.setAttribute(
                        "href",
                        url.href
                    );

                    elemento.setAttribute(
                        "target",
                        "_blank"
                    );

                    elemento.setAttribute(
                        "rel",
                        "noopener noreferrer"
                    );

                    if (
                        titulo
                    ) {
                        elemento.setAttribute(
                            "title",
                            titulo
                        );
                    }
                }
            } catch {
                // Se conserva el texto sin enlace.
            }
        }
    }

    return documento
        .body
        .innerHTML;
}

// ============================================================
// BLOQUES
// ============================================================

function crearID() {
    if (
        typeof crypto !==
            "undefined" &&
        typeof crypto.randomUUID ===
            "function"
    ) {
        return crypto.randomUUID();
    }

    return `bloc-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
}

function nuevoBloque(
    order:
        number
): BloqueInformacion {
    return {
        id:
            crearID(),

        order,

        type:
            "text",

        title:
            "",

        body:
            "",
    };
}

function normalizarOrden(
    bloques:
        BloqueInformacion[]
): BloqueInformacion[] {
    return bloques.map(
        (
            bloque,
            indice
        ) => ({
            ...bloque,

            order:
                indice +
                1,
        })
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoInformacio({
    valor,
    soloLectura,
    bloqueado,
    onCambiar,
}: Props) {
    const tituloID =
        useId();

    const deshabilitado =
        soloLectura ||
        bloqueado;

    // ========================================================
    // APLICAR
    // ========================================================

    function aplicar(
        bloques:
            BloqueInformacion[]
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onCambiar({
            bloques:
                normalizarOrden(
                    bloques
                ),
        });
    }

    // ========================================================
    // CREAR
    // ========================================================

    function agregarBloque() {
        aplicar([
            ...valor.bloques,

            nuevoBloque(
                valor
                    .bloques
                    .length +
                    1
            ),
        ]);
    }

    // ========================================================
    // MODIFICAR
    // ========================================================

    function actualizarBloque(
        indice:
            number,

        nuevo:
            BloqueInformacion
    ) {
        aplicar(
            valor.bloques.map(
                (
                    bloque,
                    i
                ) =>
                    i ===
                    indice
                        ? nuevo
                        : bloque
            )
        );
    }

    // ========================================================
    // ELIMINAR
    // ========================================================

    function eliminarBloque(
        indice:
            number
    ) {
        aplicar(
            valor.bloques.filter(
                (
                    _,
                    i
                ) =>
                    i !==
                    indice
            )
        );
    }

    // ========================================================
    // ORDEN
    // ========================================================

    function moverBloque(
        indice:
            number,

        direccion:
            -1 | 1
    ) {
        const destino =
            indice +
            direccion;

        if (
            destino <
                0 ||
            destino >=
                valor
                    .bloques
                    .length
        ) {
            return;
        }

        const nuevos =
            [
                ...valor.bloques,
            ];

        const temporal =
            nuevos[
                indice
            ];

        nuevos[
            indice
        ] =
            nuevos[
                destino
            ];

        nuevos[
            destino
        ] =
            temporal;

        aplicar(
            nuevos
        );
    }

    // ========================================================
    // UI
    // ========================================================

    return (
        <section
            aria-labelledby={
                tituloID
            }
            className="
                space-y-7
                text-neutral
            "
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <header
                className="
                    border-b
                    border-border
                    pb-5
                "
            >
                <div
                    className="
                        mb-3
                        flex
                        items-center
                        gap-2
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            flex
                            h-8
                            w-8
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-border
                            bg-card
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="
                                h-4
                                w-4
                            "
                        >
                            <path d="M4 4h16v16H4z" />

                            <path d="M8 8h8" />

                            <path d="M8 12h8" />

                            <path d="M8 16h5" />
                        </svg>
                    </span>

                    <span
                        className="
                            text-xs
                            font-medium
                            tracking-wide
                        "
                    >
                        INFORMACIÓ PÚBLICA
                    </span>
                </div>

                <h2
                    id={
                        tituloID
                    }
                    className="
                        text-xl
                        font-semibold
                        tracking-tight
                        text-neutral-titulos
                    "
                >
                    Informació de l'edició
                </h2>

                <p
                    className="
                        mt-2
                        max-w-3xl
                        text-sm
                        leading-6
                    "
                >
                    Crea els apartats que es mostraran
                    públicament a la pàgina de
                    l'edició. Cada apartat té un títol
                    i un contingut propi.
                </p>
            </header>

            {/* =================================================
                CABECERA DE BLOQUES
            ================================================= */}

            <div
                className="
                    flex
                    flex-col
                    gap-4
                    sm:flex-row
                    sm:items-center
                    sm:justify-between
                "
            >
                <div>
                    <h3
                        className="
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        Apartats
                    </h3>

                    <p
                        className="
                            mt-1
                            text-sm
                            leading-6
                        "
                    >
                        Ordena els blocs segons
                        l'ordre en què els vols
                        mostrar a la pàgina pública.
                    </p>
                </div>

                {!soloLectura && (
                    <button
                        type="button"
                        disabled={
                            bloqueado
                        }
                        onClick={
                            agregarBloque
                        }
                        className="
                            inline-flex
                            shrink-0
                            items-center
                            justify-center
                            gap-2
                            rounded-lg
                            bg-primary
                            px-4
                            py-2.5
                            text-sm
                            font-semibold
                            text-white
                            transition
                            hover:bg-primary/90
                            disabled:cursor-not-allowed
                            disabled:opacity-50
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="
                                h-4
                                w-4
                            "
                        >
                            <path d="M12 5v14" />

                            <path d="M5 12h14" />
                        </svg>

                        Afegir apartat
                    </button>
                )}
            </div>

            {/* =================================================
                VACÍO
            ================================================= */}

            {valor.bloques.length ===
            0 ? (
                <div
                    className="
                        rounded-2xl
                        border
                        border-dashed
                        border-border
                        bg-card/35
                        px-6
                        py-12
                        text-center
                    "
                >
                    <div
                        className="
                            mx-auto
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-xl
                            bg-primary/10
                            text-primary
                        "
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="
                                h-6
                                w-6
                            "
                        >
                            <path d="M4 4h16v16H4z" />

                            <path d="M8 8h8" />

                            <path d="M8 12h5" />

                            <path d="M12 16h4" />
                        </svg>
                    </div>

                    <h3
                        className="
                            mt-4
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        Encara no hi ha informació
                    </h3>

                    <p
                        className="
                            mx-auto
                            mt-2
                            max-w-lg
                            text-sm
                            leading-6
                        "
                    >
                        Pots crear apartats com ara
                        descripció, requisits,
                        funcionament, premis,
                        estructura del torneig o
                        qualsevol altra informació
                        necessària.
                    </p>

                    {!soloLectura && (
                        <button
                            type="button"
                            disabled={
                                bloqueado
                            }
                            onClick={
                                agregarBloque
                            }
                            className="
                                mt-5
                                inline-flex
                                items-center
                                justify-center
                                gap-2
                                rounded-lg
                                border
                                border-primary
                                bg-background
                                px-4
                                py-2.5
                                text-sm
                                font-semibold
                                text-secondary
                                transition
                                hover:bg-card
                                disabled:cursor-not-allowed
                                disabled:opacity-50
                            "
                        >
                            Crear el primer apartat
                        </button>
                    )}
                </div>
            ) : (
                <div
                    className="
                        space-y-5
                    "
                >
                    {valor.bloques.map(
                        (
                            bloque,
                            indice
                        ) => (
                            <EditorBloque
                                key={
                                    bloque.id
                                }
                                bloque={
                                    bloque
                                }
                                indice={
                                    indice
                                }
                                total={
                                    valor
                                        .bloques
                                        .length
                                }
                                bloqueado={
                                    deshabilitado
                                }
                                onCambiar={
                                    nuevo =>
                                        actualizarBloque(
                                            indice,
                                            nuevo
                                        )
                                }
                                onEliminar={() =>
                                    eliminarBloque(
                                        indice
                                    )
                                }
                                onSubir={() =>
                                    moverBloque(
                                        indice,
                                        -1
                                    )
                                }
                                onBajar={() =>
                                    moverBloque(
                                        indice,
                                        1
                                    )
                                }
                            />
                        )
                    )}
                </div>
            )}
        </section>
    );
}

// ============================================================
// EDITOR DE BLOQUE
// ============================================================

function EditorBloque({
    bloque,
    indice,
    total,
    bloqueado,
    onCambiar,
    onEliminar,
    onSubir,
    onBajar,
}: {
    bloque:
        BloqueInformacion;

    indice:
        number;

    total:
        number;

    bloqueado:
        boolean;

    onCambiar: (
        bloque:
            BloqueInformacion
    ) => void;

    onEliminar:
        () => void;

    onSubir:
        () => void;

    onBajar:
        () => void;
}) {
    const tituloInputID =
        useId();

    function cambiarTitulo(
        title:
            string
    ) {
        if (
            bloqueado
        ) {
            return;
        }

        onCambiar({
            ...bloque,

            title,
        });
    }

    function cambiarTexto(
        body:
            string
    ) {
        if (
            bloqueado
        ) {
            return;
        }

        onCambiar({
            ...bloque,

            body,
        });
    }

    return (
        <article
            className="
                overflow-hidden
                rounded-2xl
                border
                border-border
                bg-background
            "
        >
            {/* =================================================
                CABECERA
            ================================================= */}

            <div
                className="
                    flex
                    items-center
                    justify-between
                    gap-4
                    border-b
                    border-border
                    bg-card/60
                    px-4
                    py-3
                "
            >
                <div
                    className="
                        flex
                        min-w-0
                        items-center
                        gap-3
                    "
                >
                    <span
                        aria-hidden="true"
                        className="
                            flex
                            h-8
                            w-8
                            shrink-0
                            items-center
                            justify-center
                            rounded-lg
                            border
                            border-border
                            bg-background
                            text-xs
                            font-semibold
                        "
                    >
                        {indice +
                            1}
                    </span>

                    <div
                        className="
                            min-w-0
                        "
                    >
                        <p
                            className="
                                truncate
                                text-sm
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            {bloque.title ||
                                `Apartat ${indice + 1}`}
                        </p>

                        <p
                            className="
                                text-xs
                                text-neutral/70
                            "
                        >
                            Bloc de text
                        </p>
                    </div>
                </div>

                {!bloqueado && (
                    <div
                        className="
                            flex
                            shrink-0
                            items-center
                            gap-1
                        "
                    >
                        <button
                            type="button"
                            disabled={
                                indice ===
                                0
                            }
                            aria-label="Moure l'apartat cap amunt"
                            title="Moure cap amunt"
                            onClick={
                                onSubir
                            }
                            className="
                                rounded-lg
                                p-2
                                transition
                                hover:bg-background
                                disabled:cursor-not-allowed
                                disabled:opacity-30
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="m18 15-6-6-6 6" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            disabled={
                                indice ===
                                total -
                                    1
                            }
                            aria-label="Moure l'apartat cap avall"
                            title="Moure cap avall"
                            onClick={
                                onBajar
                            }
                            className="
                                rounded-lg
                                p-2
                                transition
                                hover:bg-background
                                disabled:cursor-not-allowed
                                disabled:opacity-30
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="m6 9 6 6 6-6" />
                            </svg>
                        </button>

                        <button
                            type="button"
                            aria-label="Eliminar l'apartat"
                            title="Eliminar"
                            onClick={
                                onEliminar
                            }
                            className="
                                rounded-lg
                                p-2
                                text-error
                                transition
                                hover:bg-error-container/40
                            "
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="
                                    h-4
                                    w-4
                                "
                            >
                                <path d="M3 6h18" />

                                <path d="M8 6V4h8v2" />

                                <path d="M19 6l-1 14H6L5 6" />

                                <path d="M10 11v5" />

                                <path d="M14 11v5" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            {/* =================================================
                CONTENIDO
            ================================================= */}

            <div
                className="
                    space-y-5
                    p-4
                    sm:p-5
                "
            >
                <div
                    className="
                        space-y-2
                    "
                >
                    <label
                        htmlFor={
                            tituloInputID
                        }
                        className="
                            text-sm
                            font-medium
                            text-neutral-titulos
                        "
                    >
                        Títol de l'apartat
                    </label>

                    <input
                        id={
                            tituloInputID
                        }
                        type="text"
                        maxLength={
                            200
                        }
                        disabled={
                            bloqueado
                        }
                        value={
                            bloque.title
                        }
                        onChange={
                            evento =>
                                cambiarTitulo(
                                    evento
                                        .target
                                        .value
                                )
                        }
                        placeholder="Ex: Estructura del torneig"
                        className={
                            campo
                        }
                    />
                </div>

                <div
                    className="
                        space-y-2
                    "
                >
                    <p
                        className="
                            text-sm
                            font-medium
                            text-neutral-titulos
                        "
                    >
                        Contingut
                    </p>

                    <EditorTexto
                        valor={
                            bloque.body
                        }
                        bloqueado={
                            bloqueado
                        }
                        onCambiar={
                            cambiarTexto
                        }
                    />
                </div>
            </div>
        </article>
    );
}

// ============================================================
// EDITOR DE TEXTO ENRIQUECIDO
// ============================================================

function EditorTexto({
    valor,
    bloqueado,
    onCambiar,
}: {
    valor:
        string;

    bloqueado:
        boolean;

    onCambiar: (
        html:
            string
    ) => void;
}) {
    const editorRef =
        useRef<HTMLDivElement>(
            null
        );

    const ultimoEmitido =
        useRef<
            string | null
        >(
            null
        );

    const seleccionRef =
        useRef<
            Range | null
        >(
            null
        );

    const enlaceInputRef =
        useRef<HTMLInputElement>(
            null
        );

    const [
        mostrarEnlace,
        setMostrarEnlace,
    ] =
        useState(
            false
        );

    const [
        urlEnlace,
        setUrlEnlace,
    ] =
        useState(
            ""
        );

    const [
        errorEnlace,
        setErrorEnlace,
    ] =
        useState(
            ""
        );

    // ========================================================
    // SINCRONIZAR HTML
    // ========================================================

    useEffect(() => {
        const editor =
            editorRef.current;

        if (
            !editor ||
            ultimoEmitido.current ===
                valor
        ) {
            return;
        }

        const limpio =
            limpiarHTMLLocal(
                valor
            );

        if (
            editor.innerHTML !==
            limpio
        ) {
            editor.innerHTML =
                limpio;
        }
    }, [
        valor,
    ]);

    useEffect(() => {
        if (
            mostrarEnlace
        ) {
            enlaceInputRef
                .current
                ?.focus();
        }
    }, [
        mostrarEnlace,
    ]);

    // ========================================================
    // EMITIR
    // ========================================================

    function emitir() {
        const html =
            editorRef
                .current
                ?.innerHTML ??
            "";

        ultimoEmitido.current =
            html;

        onCambiar(
            html
        );
    }

    // ========================================================
    // SELECCIÓN
    // ========================================================

    function recordarSeleccion() {
        const editor =
            editorRef.current;

        const seleccion =
            window.getSelection();

        if (
            !editor ||
            !seleccion ||
            seleccion.rangeCount ===
                0
        ) {
            return;
        }

        const rango =
            seleccion.getRangeAt(
                0
            );

        if (
            editor.contains(
                rango
                    .commonAncestorContainer
            )
        ) {
            seleccionRef.current =
                rango.cloneRange();
        }
    }

    function restaurarSeleccion() {
        const editor =
            editorRef.current;

        if (
            !editor
        ) {
            return;
        }

        editor.focus();

        const rango =
            seleccionRef.current;

        if (
            rango &&
            editor.contains(
                rango
                    .commonAncestorContainer
            )
        ) {
            const seleccion =
                window.getSelection();

            seleccion
                ?.removeAllRanges();

            seleccion
                ?.addRange(
                    rango
                );
        }
    }

    // ========================================================
    // FORMATO
    // ========================================================

    function aplicar(
        comando:
            string,

        argumento?:
            string
    ) {
        if (
            bloqueado
        ) {
            return;
        }

        restaurarSeleccion();

        document.execCommand(
            comando,
            false,
            argumento
        );

        recordarSeleccion();
        emitir();
    }

    // ========================================================
    // ENLACES
    // ========================================================

    function insertarEnlace() {
        let url:
            URL;

        try {
            url =
                new URL(
                    urlEnlace.trim()
                );

            if (
                ![
                    "http:",
                    "https:",
                    "mailto:",
                ].includes(
                    url.protocol
                )
            ) {
                throw new Error();
            }
        } catch {
            setErrorEnlace(
                "Introdueix una adreça https://, http:// o mailto:."
            );

            return;
        }

        restaurarSeleccion();

        const seleccion =
            window.getSelection();

        if (
            !seleccion ||
            seleccion.isCollapsed
        ) {
            setErrorEnlace(
                "Selecciona primer el text que ha de tenir l'enllaç."
            );

            return;
        }

        aplicar(
            "createLink",
            url.href
        );

        setMostrarEnlace(
            false
        );

        setUrlEnlace(
            ""
        );

        setErrorEnlace(
            ""
        );
    }

    // ========================================================
    // HERRAMIENTAS
    // ========================================================

    const herramientas = [
        {
            texto:
                "B",

            nombre:
                "Negreta",

            comando:
                "bold",
        },

        {
            texto:
                "I",

            nombre:
                "Cursiva",

            comando:
                "italic",
        },

        {
            texto:
                "U",

            nombre:
                "Subratllat",

            comando:
                "underline",
        },

        {
            texto:
                "S",

            nombre:
                "Ratllat",

            comando:
                "strikeThrough",
        },

        {
            texto:
                "•",

            nombre:
                "Llista amb punts",

            comando:
                "insertUnorderedList",
        },

        {
            texto:
                "1.",

            nombre:
                "Llista numerada",

            comando:
                "insertOrderedList",
        },

        {
            texto:
                "←",

            nombre:
                "Alinear a l'esquerra",

            comando:
                "justifyLeft",
        },

        {
            texto:
                "↔",

            nombre:
                "Centrar",

            comando:
                "justifyCenter",
        },

        {
            texto:
                "→",

            nombre:
                "Alinear a la dreta",

            comando:
                "justifyRight",
        },
    ];

    return (
        <div
            className="
                overflow-hidden
                rounded-xl
                border
                border-border
            "
        >
            {/* TOOLBAR */}

            <div
                className="
                    flex
                    flex-wrap
                    gap-1.5
                    border-b
                    border-border
                    bg-card
                    p-2
                "
            >
                {herramientas.map(
                    herramienta => (
                        <button
                            key={
                                herramienta.comando
                            }
                            type="button"
                            title={
                                herramienta.nombre
                            }
                            aria-label={
                                herramienta.nombre
                            }
                            disabled={
                                bloqueado
                            }
                            className={
                                botonPequeno
                            }
                            onMouseDown={
                                evento =>
                                    evento.preventDefault()
                            }
                            onClick={() =>
                                aplicar(
                                    herramienta.comando
                                )
                            }
                        >
                            {
                                herramienta.texto
                            }
                        </button>
                    )
                )}

                <button
                    type="button"
                    disabled={
                        bloqueado
                    }
                    className={
                        botonPequeno
                    }
                    onMouseDown={
                        evento =>
                            evento.preventDefault()
                    }
                    onClick={() => {
                        recordarSeleccion();

                        setMostrarEnlace(
                            true
                        );

                        setErrorEnlace(
                            ""
                        );
                    }}
                >
                    Enllaç
                </button>

                <button
                    type="button"
                    disabled={
                        bloqueado
                    }
                    className={
                        botonPequeno
                    }
                    onMouseDown={
                        evento =>
                            evento.preventDefault()
                    }
                    onClick={() =>
                        aplicar(
                            "unlink"
                        )
                    }
                >
                    Treure enllaç
                </button>

                <button
                    type="button"
                    disabled={
                        bloqueado
                    }
                    className={
                        botonPequeno
                    }
                    onMouseDown={
                        evento =>
                            evento.preventDefault()
                    }
                    onClick={() =>
                        aplicar(
                            "removeFormat"
                        )
                    }
                >
                    Netejar format
                </button>
            </div>

            {/* ENLACE */}

            {mostrarEnlace && (
                <div
                    className="
                        space-y-2
                        border-b
                        border-border
                        bg-background
                        p-3
                    "
                >
                    <label
                        className="
                            block
                            text-xs
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        Adreça de l'enllaç

                        <input
                            ref={
                                enlaceInputRef
                            }
                            type="text"
                            value={
                                urlEnlace
                            }
                            disabled={
                                bloqueado
                            }
                            placeholder="https://..."
                            className={`${campo} mt-2`}
                            onChange={
                                evento =>
                                    setUrlEnlace(
                                        evento
                                            .target
                                            .value
                                    )
                            }
                            onKeyDown={
                                evento => {
                                    if (
                                        evento.key ===
                                        "Enter"
                                    ) {
                                        evento.preventDefault();

                                        insertarEnlace();
                                    }
                                }
                            }
                        />
                    </label>

                    {errorEnlace && (
                        <p
                            role="alert"
                            className="
                                text-xs
                                text-error
                            "
                        >
                            {errorEnlace}
                        </p>
                    )}

                    <div
                        className="
                            flex
                            gap-2
                        "
                    >
                        <button
                            type="button"
                            disabled={
                                bloqueado
                            }
                            className={
                                botonPequeno
                            }
                            onClick={
                                insertarEnlace
                            }
                        >
                            Aplicar
                        </button>

                        <button
                            type="button"
                            className={
                                botonPequeno
                            }
                            onClick={() =>
                                setMostrarEnlace(
                                    false
                                )
                            }
                        >
                            Cancel·lar
                        </button>
                    </div>
                </div>
            )}

            {/* EDITOR */}

            <div
                ref={
                    editorRef
                }
                contentEditable={
                    !bloqueado
                }
                suppressContentEditableWarning
                role="textbox"
                aria-label="Contingut de l'apartat"
                aria-multiline="true"
                aria-disabled={
                    bloqueado
                }
                onInput={
                    emitir
                }
                onKeyUp={
                    recordarSeleccion
                }
                onMouseUp={
                    recordarSeleccion
                }
                onBlur={
                    recordarSeleccion
                }
                onPaste={
                    evento => {
                        evento.preventDefault();

                        if (
                            bloqueado
                        ) {
                            return;
                        }

                        const html =
                            evento.clipboardData
                                .getData(
                                    "text/html"
                                );

                        const texto =
                            evento.clipboardData
                                .getData(
                                    "text/plain"
                                );

                        if (
                            html
                        ) {
                            document.execCommand(
                                "insertHTML",
                                false,
                                limpiarHTMLLocal(
                                    html
                                )
                            );
                        } else {
                            document.execCommand(
                                "insertText",
                                false,
                                texto
                            );
                        }

                        recordarSeleccion();
                        emitir();
                    }
                }
                onDrop={
                    evento =>
                        evento.preventDefault()
                }
                className="
                    min-h-52
                    wrap-break-words
                    bg-background
                    p-4
                    text-sm
                    leading-7
                    outline-none
                    focus:ring-2
                    focus:ring-inset
                    focus:ring-primary/15

                    [&_a]:text-secondary
                    [&_a]:underline
                    [&_a]:underline-offset-4

                    [&_ul]:list-disc
                    [&_ul]:pl-6

                    [&_ol]:list-decimal
                    [&_ol]:pl-6

                    [&_p]:mb-3

                    [&_h2]:text-xl
                    [&_h2]:font-semibold
                    [&_h2]:text-neutral-titulos

                    [&_h3]:text-lg
                    [&_h3]:font-semibold
                    [&_h3]:text-neutral-titulos

                    [&_blockquote]:border-l-2
                    [&_blockquote]:border-border
                    [&_blockquote]:pl-4
                "
            />
        </div>
    );
}