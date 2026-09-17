import {
    useId,
} from "react";

import type {
    EdicionFormulario,
    TorneoEdicion,
} from "../Asistente";

// ============================================================
// TIPOS
// ============================================================

type Props = {
    torneo:
        TorneoEdicion;

    edicion:
        EdicionFormulario;

    soloLectura:
        boolean;
};

// ============================================================
// HELPERS
// ============================================================

function fechaVisible(
    valor:
        string | null,
) {
    if (
        !valor
    ) {
        return "No definida";
    }

    const fecha =
        new Date(
            valor
        );

    if (
        Number.isNaN(
            fecha.getTime()
        )
    ) {
        return "No definida";
    }

    return new Intl.DateTimeFormat(
        "ca-ES",
        {
            dateStyle:
                "medium",

            timeStyle:
                "short",

            timeZone:
                "Europe/Madrid",
        }
    ).format(
        fecha
    );
}

function nombreEstado(
    estado:
        string,
) {
    switch (
        estado
            .trim()
            .toUpperCase()
    ) {
        case "BORRADOR":
            return "Esborrany";

        case "ACTIVA":
            return "Activa";

        case "FINALIZADA":
            return "Finalitzada";

        default:
            return estado ||
                "Sense estat";
    }
}

function nombreComportamiento(
    valor:
        string,
) {
    switch (
        valor
    ) {
        case "permitir":
            return "Continuar acceptant";

        case "lista_espera":
            return "Llista d'espera";

        case "bloquear":
            return "Tancar inscripcions";

        default:
            return valor;
    }
}

function numeroONoDefinido(
    valor:
        number | null,
) {
    return valor ===
        null
        ? "No definit"
        : String(
              valor
          );
}

function siNo(
    valor:
        boolean,
) {
    return valor
        ? "Sí"
        : "No";
}

function textoPlano(
    html:
        string,
) {
    if (
        !html
    ) {
        return "";
    }

    if (
        typeof document ===
        "undefined"
    ) {
        return html
            .replace(
                /<[^>]*>/g,
                " "
            )
            .replace(
                /\s+/g,
                " "
            )
            .trim();
    }

    const documento =
        new DOMParser()
            .parseFromString(
                html,
                "text/html"
            );

    return (
        documento.body
            .textContent ??
        ""
    )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}

function resumenTexto(
    html:
        string,

    maximo =
        180,
) {
    const texto =
        textoPlano(
            html
        );

    if (
        texto.length <=
        maximo
    ) {
        return texto;
    }

    return `${texto
        .slice(
            0,
            maximo
        )
        .trim()}…`;
}

function resumenRespuesta(
    texto:
        string,

    maximo =
        160,
) {
    const limpio =
        texto
            .replace(
                /\s+/g,
                " "
            )
            .trim();

    if (
        limpio.length <=
        maximo
    ) {
        return limpio;
    }

    return `${limpio
        .slice(
            0,
            maximo
        )
        .trim()}…`;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function PasoResumen({
    torneo,
    edicion,
    soloLectura,
}: Props) {
    const tituloID =
        useId();

    const {
        general,
        configuracion,
    } =
        edicion;

    const equipos =
        configuracion.equipos;

    const voluntarios =
        configuracion.voluntarios;

    const informacion =
        configuracion.informacion;

    const faq =
        configuracion.faq;

    const tiposActivos =
        voluntarios
            .tipos
            .filter(
                tipo =>
                    tipo.activo
            );

    const preguntasActivas =
        faq
            .preguntas
            .filter(
                pregunta =>
                    pregunta.activo
            );

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
                            <path d="m5 12 4 4L19 6" />
                        </svg>
                    </span>

                    <span
                        className="
                            text-xs
                            font-medium
                            tracking-wide
                        "
                    >
                        RESUM
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
                    Revisa la configuració
                </h2>

                <p
                    className="
                        mt-2
                        max-w-3xl
                        text-sm
                        leading-6
                    "
                >
                    Comprova la informació abans de
                    {
                        soloLectura
                            ? " tancar la consulta."
                            : " desar l'edició."
                    }
                </p>
            </header>

            {/* =================================================
                RESUMEN PRINCIPAL
            ================================================= */}

            <div
                className="
                    overflow-hidden
                    rounded-2xl
                    border
                    border-border
                    bg-background
                "
            >
                <div
                    className="
                        bg-card/60
                        px-5
                        py-5
                    "
                >
                    <div
                        className="
                            flex
                            flex-col
                            gap-4
                            sm:flex-row
                            sm:items-start
                            sm:justify-between
                        "
                    >
                        <div
                            className="
                                min-w-0
                            "
                        >
                            <p
                                className="
                                    text-xs
                                    font-medium
                                    uppercase
                                    tracking-wide
                                "
                            >
                                {
                                    torneo.nombre ||
                                    "Torneig"
                                }
                            </p>

                            <h3
                                className="
                                    mt-1
                                    text-2xl
                                    font-bold
                                    tracking-tight
                                    text-neutral-titulos
                                "
                            >
                                {
                                    general.nombre ||
                                    "Edició sense nom"
                                }
                            </h3>

                            {
                                torneo.deporte && (
                                    <p
                                        className="
                                            mt-1
                                            text-sm
                                        "
                                    >
                                        {
                                            torneo.deporte
                                        }
                                    </p>
                                )
                            }
                        </div>

                        <span
                            className="
                                w-max
                                rounded-full
                                border
                                border-primary/25
                                bg-primary/10
                                px-3
                                py-1.5
                                text-xs
                                font-semibold
                                text-secondary
                            "
                        >
                            {
                                nombreEstado(
                                    general.estado
                                )
                            }
                        </span>
                    </div>
                </div>

                <div
                    className="
                        grid
                        grid-cols-1
                        gap-px
                        bg-border
                        sm:grid-cols-3
                    "
                >
                    <DatoPrincipal
                        titulo="Inici"
                        valor={
                            fechaVisible(
                                general.fecha_inicio
                            )
                        }
                    />

                    <DatoPrincipal
                        titulo="Final"
                        valor={
                            fechaVisible(
                                general.fecha_fin
                            )
                        }
                    />

                    <DatoPrincipal
                        titulo="Seu"
                        valor={
                            general
                                .sede
                                .trim() ||
                            "No definida"
                        }
                    />
                </div>
            </div>

            {/* =================================================
                EQUIPOS
            ================================================= */}

            <BloqueResumen
                titulo="Equips"
                descripcion="Configuració de les inscripcions i composició dels equips."
                icono={
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="9"
                            cy="8"
                            r="3"
                        />

                        <circle
                            cx="17"
                            cy="9"
                            r="2.5"
                        />

                        <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />

                        <path d="M16 14.5a5 5 0 0 1 4.5 5V20" />
                    </svg>
                }
            >
                <div
                    className="
                        grid
                        grid-cols-1
                        gap-5
                        md:grid-cols-2
                    "
                >
                    {/* INSCRIPCIÓN */}

                    <GrupoResumen
                        titulo="Inscripció"
                    >
                        <FilaResumen
                            etiqueta="Obertura"
                            valor={
                                fechaVisible(
                                    equipos
                                        .inscripcion
                                        .apertura
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Tancament"
                            valor={
                                fechaVisible(
                                    equipos
                                        .inscripcion
                                        .cierre
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Màxim d'equips"
                            valor={
                                numeroONoDefinido(
                                    equipos
                                        .cupo
                                        .maximo
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="En superar el màxim"
                            valor={
                                nombreComportamiento(
                                    equipos
                                        .cupo
                                        .al_superar
                                )
                            }
                        />
                    </GrupoResumen>

                    {/* JUGADORES */}

                    <GrupoResumen
                        titulo="Jugadors"
                    >
                        <FilaResumen
                            etiqueta="Mínim"
                            valor={
                                numeroONoDefinido(
                                    equipos
                                        .jugadores
                                        .minimo
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Màxim"
                            valor={
                                numeroONoDefinido(
                                    equipos
                                        .jugadores
                                        .maximo
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Composició per gènere"
                            valor={
                                equipos
                                    .genero
                                    .activo
                                    ? "Activada"
                                    : "No requerida"
                            }
                        />

                        {
                            equipos
                                .genero
                                .activo && (
                                <>
                                    <FilaResumen
                                        etiqueta="Mínim de nois"
                                        valor={
                                            String(
                                                equipos
                                                    .genero
                                                    .minimos
                                                    .masculino
                                            )
                                        }
                                    />

                                    <FilaResumen
                                        etiqueta="Mínim de noies"
                                        valor={
                                            String(
                                                equipos
                                                    .genero
                                                    .minimos
                                                    .femenino
                                            )
                                        }
                                    />
                                </>
                            )
                        }
                    </GrupoResumen>

                    {/* PROFESORES */}

                    <GrupoResumen
                        titulo="Professorat"
                    >
                        <FilaResumen
                            etiqueta="Permès"
                            valor={
                                siNo(
                                    equipos
                                        .profesores
                                        .permitidos
                                )
                            }
                        />

                        {
                            equipos
                                .profesores
                                .permitidos && (
                                <>
                                    <FilaResumen
                                        etiqueta="Mínim"
                                        valor={
                                            String(
                                                equipos
                                                    .profesores
                                                    .minimo
                                            )
                                        }
                                    />

                                    <FilaResumen
                                        etiqueta="Màxim"
                                        valor={
                                            String(
                                                equipos
                                                    .profesores
                                                    .maximo
                                            )
                                        }
                                    />

                                    <FilaResumen
                                        etiqueta="Compta com a jugador"
                                        valor={
                                            siNo(
                                                equipos
                                                    .profesores
                                                    .cuentan_como_jugador
                                            )
                                        }
                                    />
                                </>
                            )
                        }
                    </GrupoResumen>

                    {/* ENTRENADOR */}

                    <GrupoResumen
                        titulo="Entrenador"
                    >
                        <FilaResumen
                            etiqueta="Permès"
                            valor={
                                siNo(
                                    equipos
                                        .entrenador
                                        .permitido
                                )
                            }
                        />

                        {
                            equipos
                                .entrenador
                                .permitido && (
                                <p
                                    className="
                                        rounded-lg
                                        bg-primary/5
                                        px-3
                                        py-2.5
                                        text-xs
                                        leading-5
                                        text-neutral
                                    "
                                >
                                    Els equips podran indicar un entrenador
                                    durant el procés d'inscripció.
                                </p>
                            )
                        }
                    </GrupoResumen>

                    {/* STAFF */}

                    <GrupoResumen
                        titulo="Staff"
                    >
                        <FilaResumen
                            etiqueta="Permès"
                            valor={
                                siNo(
                                    equipos
                                        .staff
                                        .permitido
                                )
                            }
                        />

                        {
                            equipos
                                .staff
                                .permitido && (
                                <>
                                    <FilaResumen
                                        etiqueta="Mínim"
                                        valor={
                                            String(
                                                equipos
                                                    .staff
                                                    .minimo
                                            )
                                        }
                                    />

                                    <FilaResumen
                                        etiqueta="Màxim"
                                        valor={
                                            String(
                                                equipos
                                                    .staff
                                                    .maximo
                                            )
                                        }
                                    />
                                </>
                            )
                        }
                    </GrupoResumen>
                </div>
            </BloqueResumen>

            {/* =================================================
                VOLUNTARIADO
            ================================================= */}

            <BloqueResumen
                titulo="Voluntariat"
                descripcion="Període d'inscripció i funcions disponibles."
                icono={
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="9"
                            cy="8"
                            r="3"
                        />

                        <path d="M3.5 20v-1a5.5 5.5 0 0 1 11 0v1" />

                        <path d="M17 8v6" />

                        <path d="M14 11h6" />
                    </svg>
                }
            >
                <div
                    className="
                        grid
                        grid-cols-1
                        gap-5
                        md:grid-cols-2
                    "
                >
                    <GrupoResumen
                        titulo="Inscripció"
                    >
                        <FilaResumen
                            etiqueta="Obertura"
                            valor={
                                fechaVisible(
                                    voluntarios
                                        .inscripcion
                                        .apertura
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Tancament"
                            valor={
                                fechaVisible(
                                    voluntarios
                                        .inscripcion
                                        .cierre
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Màxim general"
                            valor={
                                numeroONoDefinido(
                                    voluntarios
                                        .cupo
                                        .maximo
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="En superar el màxim"
                            valor={
                                nombreComportamiento(
                                    voluntarios
                                        .cupo
                                        .al_superar
                                )
                            }
                        />
                    </GrupoResumen>

                    <GrupoResumen
                        titulo="Funcions"
                    >
                        <FilaResumen
                            etiqueta="Tipus creats"
                            valor={
                                String(
                                    voluntarios
                                        .tipos
                                        .length
                                )
                            }
                        />

                        <FilaResumen
                            etiqueta="Tipus actius"
                            valor={
                                String(
                                    tiposActivos
                                        .length
                                )
                            }
                        />
                    </GrupoResumen>
                </div>

                {
                    voluntarios
                        .tipos
                        .length >
                        0 && (
                        <div
                            className="
                                mt-5
                                border-t
                                border-border
                                pt-5
                            "
                        >
                            <p
                                className="
                                    text-sm
                                    font-semibold
                                    text-neutral-titulos
                                "
                            >
                                Tipus de voluntariat
                            </p>

                            <div
                                className="
                                    mt-3
                                    grid
                                    grid-cols-1
                                    gap-3
                                    sm:grid-cols-2
                                    lg:grid-cols-3
                                "
                            >
                                {
                                    voluntarios
                                        .tipos
                                        .map(
                                            tipo => (
                                                <div
                                                    key={
                                                        tipo.id
                                                    }
                                                    className="
                                                        rounded-xl
                                                        border
                                                        border-border
                                                        bg-card/40
                                                        p-4
                                                    "
                                                >
                                                    <div
                                                        className="
                                                            flex
                                                            items-start
                                                            justify-between
                                                            gap-3
                                                        "
                                                    >
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
                                                                {
                                                                    tipo.nombre ||
                                                                    "Sense nom"
                                                                }
                                                            </p>

                                                            <p
                                                                className="
                                                                    mt-1
                                                                    text-xs
                                                                "
                                                            >
                                                                {
                                                                    tipo.activo
                                                                        ? "Disponible"
                                                                        : "Desactivat"
                                                                }
                                                            </p>
                                                        </div>

                                                        <span
                                                            className={`
                                                                h-2.5
                                                                w-2.5
                                                                shrink-0
                                                                rounded-full

                                                                ${
                                                                    tipo.activo
                                                                        ? "bg-secondary"
                                                                        : "bg-muted"
                                                                }
                                                            `}
                                                        />
                                                    </div>

                                                    {
                                                        tipo.descripcion && (
                                                            <p
                                                                className="
                                                                    mt-3
                                                                    line-clamp-3
                                                                    text-xs
                                                                    leading-5
                                                                "
                                                            >
                                                                {
                                                                    tipo.descripcion
                                                                }
                                                            </p>
                                                        )
                                                    }

                                                    <div
                                                        className="
                                                            mt-3
                                                            border-t
                                                            border-border
                                                            pt-3
                                                            text-xs
                                                        "
                                                    >
                                                        <p>
                                                            Màxim:{" "}

                                                            <span
                                                                className="
                                                                    font-medium
                                                                    text-neutral-titulos
                                                                "
                                                            >
                                                                {
                                                                    numeroONoDefinido(
                                                                        tipo
                                                                            .cupo
                                                                            .maximo
                                                                    )
                                                                }
                                                            </span>
                                                        </p>

                                                        <p
                                                            className="
                                                                mt-1
                                                            "
                                                        >
                                                            En superar-lo:{" "}

                                                            <span
                                                                className="
                                                                    font-medium
                                                                    text-neutral-titulos
                                                                "
                                                            >
                                                                {
                                                                    nombreComportamiento(
                                                                        tipo
                                                                            .cupo
                                                                            .al_superar
                                                                    )
                                                                }
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        )
                                }
                            </div>
                        </div>
                    )
                }
            </BloqueResumen>

            {/* =================================================
                INFORMACIÓN PÚBLICA
            ================================================= */}

            <BloqueResumen
                titulo="Informació pública"
                descripcion="Apartats que es mostraran als participants i visitants."
                icono={
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <path d="M4 4h16v16H4z" />

                        <path d="M8 8h8" />

                        <path d="M8 12h8" />

                        <path d="M8 16h5" />
                    </svg>
                }
            >
                {
                    informacion
                        .bloques
                        .length ===
                    0 ? (
                        <div
                            className="
                                rounded-xl
                                border
                                border-dashed
                                border-border
                                bg-card/30
                                p-5
                                text-center
                            "
                        >
                            <p
                                className="
                                    text-sm
                                    font-medium
                                    text-neutral-titulos
                                "
                            >
                                No s'ha afegit cap apartat
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                "
                            >
                                L'edició no tindrà informació pública addicional.
                            </p>
                        </div>
                    ) : (
                        <div
                            className="
                                space-y-3
                            "
                        >
                            {
                                informacion
                                    .bloques
                                    .map(
                                        (
                                            bloque,
                                            indice,
                                        ) => (
                                            <div
                                                key={
                                                    bloque.id
                                                }
                                                className="
                                                    rounded-xl
                                                    border
                                                    border-border
                                                    bg-card/35
                                                    p-4
                                                "
                                            >
                                                <div
                                                    className="
                                                        flex
                                                        items-start
                                                        gap-3
                                                    "
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className="
                                                            flex
                                                            h-7
                                                            w-7
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
                                                        {
                                                            indice +
                                                            1
                                                        }
                                                    </span>

                                                    <div
                                                        className="
                                                            min-w-0
                                                            flex-1
                                                        "
                                                    >
                                                        <p
                                                            className="
                                                                font-semibold
                                                                text-neutral-titulos
                                                            "
                                                        >
                                                            {
                                                                bloque.title ||
                                                                "Apartat sense títol"
                                                            }
                                                        </p>

                                                        <p
                                                            className="
                                                                mt-2
                                                                text-sm
                                                                leading-6
                                                            "
                                                        >
                                                            {
                                                                resumenTexto(
                                                                    bloque.body
                                                                ) ||
                                                                "Sense contingut"
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    )
                            }
                        </div>
                    )
                }
            </BloqueResumen>

            {/* =================================================
                FAQ
            ================================================= */}

            <BloqueResumen
                titulo="Preguntes freqüents"
                descripcion="Preguntes i respostes que es mostraran a la pàgina pública."
                icono={
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4"
                    >
                        <circle
                            cx="12"
                            cy="12"
                            r="9"
                        />

                        <path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.08c-.9.52-1.4 1.02-1.4 1.92" />

                        <path d="M12 17h.01" />
                    </svg>
                }
            >
                <div
                    className="
                        mb-4
                        grid
                        grid-cols-1
                        gap-3
                        sm:grid-cols-2
                    "
                >
                    <div
                        className="
                            rounded-xl
                            border
                            border-border
                            bg-card/35
                            p-4
                        "
                    >
                        <p
                            className="
                                text-xs
                                text-neutral
                            "
                        >
                            Preguntes creades
                        </p>

                        <p
                            className="
                                mt-1
                                text-xl
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            {
                                faq
                                    .preguntas
                                    .length
                            }
                        </p>
                    </div>

                    <div
                        className="
                            rounded-xl
                            border
                            border-border
                            bg-card/35
                            p-4
                        "
                    >
                        <p
                            className="
                                text-xs
                                text-neutral
                            "
                        >
                            Visibles públicament
                        </p>

                        <p
                            className="
                                mt-1
                                text-xl
                                font-semibold
                                text-neutral-titulos
                            "
                        >
                            {
                                preguntasActivas
                                    .length
                            }
                        </p>
                    </div>
                </div>

                {
                    faq
                        .preguntas
                        .length ===
                    0 ? (
                        <div
                            className="
                                rounded-xl
                                border
                                border-dashed
                                border-border
                                bg-card/30
                                p-5
                                text-center
                            "
                        >
                            <p
                                className="
                                    text-sm
                                    font-medium
                                    text-neutral-titulos
                                "
                            >
                                No s'ha afegit cap pregunta freqüent
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-xs
                                "
                            >
                                La pàgina pública no mostrarà l'apartat de preguntes freqüents.
                            </p>
                        </div>
                    ) : (
                        <div
                            className="
                                space-y-3
                            "
                        >
                            {
                                faq
                                    .preguntas
                                    .map(
                                        (
                                            pregunta,
                                            indice,
                                        ) => (
                                            <div
                                                key={
                                                    pregunta.id
                                                }
                                                className="
                                                    rounded-xl
                                                    border
                                                    border-border
                                                    bg-card/35
                                                    p-4
                                                "
                                            >
                                                <div
                                                    className="
                                                        flex
                                                        items-start
                                                        gap-3
                                                    "
                                                >
                                                    <span
                                                        className="
                                                            flex
                                                            h-7
                                                            w-7
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
                                                        {
                                                            indice +
                                                            1
                                                        }
                                                    </span>

                                                    <div
                                                        className="
                                                            min-w-0
                                                            flex-1
                                                        "
                                                    >
                                                        <div
                                                            className="
                                                                flex
                                                                flex-col
                                                                gap-2
                                                                sm:flex-row
                                                                sm:items-start
                                                                sm:justify-between
                                                            "
                                                        >
                                                            <p
                                                                className="
                                                                    font-semibold
                                                                    text-neutral-titulos
                                                                "
                                                            >
                                                                {
                                                                    pregunta.pregunta ||
                                                                    "Pregunta sense text"
                                                                }
                                                            </p>

                                                            <span
                                                                className={`
                                                                    w-max
                                                                    shrink-0
                                                                    rounded-full
                                                                    px-2.5
                                                                    py-1
                                                                    text-[10px]
                                                                    font-semibold
                                                                    uppercase

                                                                    ${
                                                                        pregunta.activo
                                                                            ? "bg-primary/10 text-primary"
                                                                            : "bg-muted/30 text-neutral"
                                                                    }
                                                                `}
                                                            >
                                                                {
                                                                    pregunta.activo
                                                                        ? "Visible"
                                                                        : "Oculta"
                                                                }
                                                            </span>
                                                        </div>

                                                        <p
                                                            className="
                                                                mt-2
                                                                text-sm
                                                                leading-6
                                                                text-neutral
                                                            "
                                                        >
                                                            {
                                                                resumenRespuesta(
                                                                    pregunta.respuesta
                                                                ) ||
                                                                "Sense resposta"
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    )
                            }
                        </div>
                    )
                }
            </BloqueResumen>

            {/* =================================================
                AVISO FINAL
            ================================================= */}

            {
                !soloLectura && (
                    <div
                        className="
                            flex
                            items-start
                            gap-3
                            rounded-xl
                            border
                            border-primary/20
                            bg-primary/5
                            p-4
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
                                mt-0.5
                                h-5
                                w-5
                                shrink-0
                                text-primary
                            "
                            aria-hidden="true"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="9"
                            />

                            <path d="M12 11v5" />

                            <path d="M12 8h.01" />
                        </svg>

                        <div>
                            <p
                                className="
                                    text-sm
                                    font-semibold
                                    text-neutral-titulos
                                "
                            >
                                Tot preparat
                            </p>

                            <p
                                className="
                                    mt-1
                                    text-sm
                                    leading-6
                                "
                            >
                                Pots tornar als passos anteriors si vols
                                modificar alguna dada. Quan estigui correcte,
                                utilitza el botó inferior per desar l'edició.
                            </p>
                        </div>
                    </div>
                )
            }
        </section>
    );
}

// ============================================================
// BLOQUE RESUMEN
// ============================================================

function BloqueResumen({
    titulo,
    descripcion,
    icono,
    children,
}: {
    titulo:
        string;

    descripcion:
        string;

    icono:
        React.ReactNode;

    children:
        React.ReactNode;
}) {
    return (
        <section
            className="
                rounded-2xl
                border
                border-border
                bg-background
                p-5
            "
        >
            <div
                className="
                    mb-5
                    flex
                    items-start
                    gap-3
                "
            >
                <span
                    aria-hidden="true"
                    className="
                        mt-0.5
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        bg-card
                    "
                >
                    {icono}
                </span>

                <div>
                    <h3
                        className="
                            font-semibold
                            text-neutral-titulos
                        "
                    >
                        {titulo}
                    </h3>

                    <p
                        className="
                            mt-1
                            text-sm
                            leading-6
                        "
                    >
                        {descripcion}
                    </p>
                </div>
            </div>

            {children}
        </section>
    );
}

// ============================================================
// GRUPO
// ============================================================

function GrupoResumen({
    titulo,
    children,
}: {
    titulo:
        string;

    children:
        React.ReactNode;
}) {
    return (
        <div
            className="
                rounded-xl
                border
                border-border
                bg-card/35
                p-4
            "
        >
            <p
                className="
                    mb-3
                    text-sm
                    font-semibold
                    text-neutral-titulos
                "
            >
                {titulo}
            </p>

            <div
                className="
                    space-y-2.5
                "
            >
                {children}
            </div>
        </div>
    );
}

// ============================================================
// FILA
// ============================================================

function FilaResumen({
    etiqueta,
    valor,
}: {
    etiqueta:
        string;

    valor:
        string;
}) {
    return (
        <div
            className="
                flex
                items-start
                justify-between
                gap-4
                text-sm
            "
        >
            <span
                className="
                    text-neutral
                "
            >
                {etiqueta}
            </span>

            <span
                className="
                    max-w-[60%]
                    text-right
                    font-medium
                    text-neutral-titulos
                "
            >
                {valor}
            </span>
        </div>
    );
}

// ============================================================
// DATO PRINCIPAL
// ============================================================

function DatoPrincipal({
    titulo,
    valor,
}: {
    titulo:
        string;

    valor:
        string;
}) {
    return (
        <div
            className="
                min-w-0
                bg-background
                px-5
                py-4
            "
        >
            <p
                className="
                    text-xs
                    font-medium
                    uppercase
                    tracking-wide
                    text-neutral
                "
            >
                {titulo}
            </p>

            <p
                className="
                    mt-1
                    truncate
                    text-sm
                    font-semibold
                    text-neutral-titulos
                "
                title={
                    valor
                }
            >
                {valor}
            </p>
        </div>
    );
}