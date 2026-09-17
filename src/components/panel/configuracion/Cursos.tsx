import {
    useState,
    type CSSProperties,
} from "react";

export type CursoConfiguracion = {
    curso: string;
    grupos: string[];
};

type Props = {
    cursoAcademico: string;
    cursos: CursoConfiguracion[];
    onChange: (
        cursos: CursoConfiguracion[]
    ) => void;
};

const estilos = {
    contenedor: {
        display: "flex",
        flexDirection: "column",
        gap: "14px",
    } satisfies CSSProperties,

    cabecera: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: "16px",
        flexWrap: "wrap",
    } satisfies CSSProperties,

    titulo: {
        margin: 0,
        color: "var(--neutral-titulos)",
        fontSize: "13px",
        fontWeight: 700,
    } satisfies CSSProperties,

    descripcion: {
        margin: "4px 0 0",
        color: "var(--neutral)",
        fontSize: "11px",
        lineHeight: 1.5,
    } satisfies CSSProperties,

    botonPrincipal: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "7px",
        minHeight: "36px",
        padding: "8px 12px",
        border: "1px solid var(--primary)",
        borderRadius: "9px",
        background: "var(--primary)",
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: 650,
        cursor: "pointer",
    } satisfies CSSProperties,

    lista: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    } satisfies CSSProperties,

    curso: {
        border:
            "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
        borderRadius: "13px",
        background: "var(--background)",
        overflow: "hidden",
    } satisfies CSSProperties,

    cursoCabecera: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px",
    } satisfies CSSProperties,

    numero: {
        width: "28px",
        height: "28px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "8px",
        background:
            "color-mix(in srgb, var(--primary) 10%, transparent)",
        color: "var(--primary)",
        fontSize: "11px",
        fontWeight: 700,
    } satisfies CSSProperties,

    inputCurso: {
        flex: 1,
        minWidth: 0,
        boxSizing: "border-box",
        border:
            "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
        borderRadius: "9px",
        background: "var(--card)",
        color: "var(--neutral-titulos)",
        padding: "9px 11px",
        fontSize: "12px",
        fontWeight: 600,
        outline: "none",
    } satisfies CSSProperties,

    botonesOrden: {
        display: "flex",
        alignItems: "center",
        gap: "4px",
    } satisfies CSSProperties,

    botonIcono: {
        width: "30px",
        height: "30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border:
            "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
        borderRadius: "8px",
        background: "var(--card)",
        color: "var(--neutral)",
        cursor: "pointer",
        fontSize: "14px",
    } satisfies CSSProperties,

    botonEliminar: {
        width: "30px",
        height: "30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        border:
            "1px solid color-mix(in srgb, var(--error) 18%, transparent)",
        borderRadius: "8px",
        background:
            "color-mix(in srgb, var(--error) 7%, transparent)",
        color: "var(--error)",
        cursor: "pointer",
    } satisfies CSSProperties,

    grupos: {
        padding: "0 12px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "9px",
    } satisfies CSSProperties,

    gruposTitulo: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
    } satisfies CSSProperties,

    etiqueta: {
        margin: 0,
        color: "var(--neutral)",
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: ".04em",
    } satisfies CSSProperties,

    gruposLista: {
        display: "flex",
        flexWrap: "wrap",
        gap: "6px",
    } satisfies CSSProperties,

    grupo: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 7px 6px 9px",
        border:
            "1px solid color-mix(in srgb, var(--border) 50%, transparent)",
        borderRadius: "8px",
        background: "var(--card)",
        color: "var(--neutral-titulos)",
        fontSize: "11px",
    } satisfies CSSProperties,

    eliminarGrupo: {
        width: "19px",
        height: "19px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: 0,
        borderRadius: "5px",
        background:
            "color-mix(in srgb, var(--error) 8%, transparent)",
        color: "var(--error)",
        padding: 0,
        cursor: "pointer",
    } satisfies CSSProperties,

    añadirGrupo: {
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "7px",
    } satisfies CSSProperties,

    inputGrupo: {
        width: "100%",
        boxSizing: "border-box",
        border:
            "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
        borderRadius: "9px",
        background: "var(--card)",
        color: "var(--neutral-titulos)",
        padding: "8px 10px",
        fontSize: "11px",
        outline: "none",
    } satisfies CSSProperties,

    botonAñadirGrupo: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "5px",
        border:
            "1px solid color-mix(in srgb, var(--border) 65%, transparent)",
        borderRadius: "9px",
        background: "var(--card)",
        color: "var(--neutral-titulos)",
        padding: "7px 10px",
        fontSize: "10px",
        fontWeight: 650,
        cursor: "pointer",
    } satisfies CSSProperties,

    vacio: {
        padding: "24px 18px",
        border:
            "1px dashed color-mix(in srgb, var(--border) 70%, transparent)",
        borderRadius: "12px",
        textAlign: "center",
        color: "var(--neutral)",
    } satisfies CSSProperties,

    vacioTitulo: {
        margin: 0,
        color: "var(--neutral-titulos)",
        fontSize: "12px",
        fontWeight: 650,
    } satisfies CSSProperties,

    vacioDescripcion: {
        margin: "5px 0 0",
        fontSize: "10px",
        lineHeight: 1.5,
    } satisfies CSSProperties,

    ayuda: {
        display: "flex",
        gap: "8px",
        padding: "10px 11px",
        borderRadius: "9px",
        background:
            "color-mix(in srgb, var(--primary) 6%, var(--background))",
        color: "var(--neutral)",
        fontSize: "10px",
        lineHeight: 1.5,
    } satisfies CSSProperties,
};

function IconoCerrar() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            style={{
                width: "14px",
                height: "14px",
            }}
        >
            <path d="m6 6 12 12M18 6 6 18" />
        </svg>
    );
}

export default function Cursos({
    cursoAcademico,
    cursos,
    onChange,
}: Props) {
    const [nuevosGrupos, setNuevosGrupos] =
        useState<Record<number, string>>({});

    const añadirCurso = () => {
        onChange([
            ...cursos,
            {
                curso: "",
                grupos: [],
            },
        ]);
    };

    const actualizarNombreCurso = (
        indice: number,
        curso: string
    ) => {
        const nuevos = cursos.map(
            (item, posicion) =>
                posicion === indice
                    ? {
                          ...item,
                          curso,
                      }
                    : item
        );

        onChange(nuevos);
    };

    const eliminarCurso = (
        indice: number
    ) => {
        onChange(
            cursos.filter(
                (_, posicion) =>
                    posicion !== indice
            )
        );

        setNuevosGrupos((actuales) => {
            const siguiente: Record<
                number,
                string
            > = {};

            Object.entries(actuales).forEach(
                ([clave, valor]) => {
                    const numero = Number(clave);

                    if (numero < indice) {
                        siguiente[numero] = valor;
                    } else if (numero > indice) {
                        siguiente[numero - 1] =
                            valor;
                    }
                }
            );

            return siguiente;
        });
    };

    const moverCurso = (
        indice: number,
        direccion: -1 | 1
    ) => {
        const destino = indice + direccion;

        if (
            destino < 0 ||
            destino >= cursos.length
        ) {
            return;
        }

        const nuevos = [...cursos];

        [
            nuevos[indice],
            nuevos[destino],
        ] = [
            nuevos[destino],
            nuevos[indice],
        ];

        onChange(nuevos);
    };

    const actualizarNuevoGrupo = (
        indice: number,
        valor: string
    ) => {
        setNuevosGrupos((actuales) => ({
            ...actuales,
            [indice]: valor,
        }));
    };

    const añadirGrupo = (
        indiceCurso: number
    ) => {
        const valor =
            (
                nuevosGrupos[indiceCurso] ??
                ""
            ).trim();

        if (!valor) {
            return;
        }

        const curso =
            cursos[indiceCurso];

        if (!curso) {
            return;
        }

        const existe =
            curso.grupos.some(
                (grupo) =>
                    grupo
                        .trim()
                        .toLocaleLowerCase(
                            "ca-ES"
                        ) ===
                    valor.toLocaleLowerCase(
                        "ca-ES"
                    )
            );

        if (existe) {
            setNuevosGrupos(
                (actuales) => ({
                    ...actuales,
                    [indiceCurso]: "",
                })
            );

            return;
        }

        const nuevos = cursos.map(
            (item, posicion) =>
                posicion === indiceCurso
                    ? {
                          ...item,
                          grupos: [
                              ...item.grupos,
                              valor,
                          ],
                      }
                    : item
        );

        onChange(nuevos);

        setNuevosGrupos(
            (actuales) => ({
                ...actuales,
                [indiceCurso]: "",
            })
        );
    };

    const eliminarGrupo = (
        indiceCurso: number,
        indiceGrupo: number
    ) => {
        const nuevos = cursos.map(
            (item, posicion) =>
                posicion === indiceCurso
                    ? {
                          ...item,
                          grupos:
                              item.grupos.filter(
                                  (
                                      _,
                                      grupoPosicion
                                  ) =>
                                      grupoPosicion !==
                                      indiceGrupo
                              ),
                      }
                    : item
        );

        onChange(nuevos);
    };

    const placeholderGrupo = (
        nombreCurso: string
    ) => {
        const normalizado =
            nombreCurso
                .trim()
                .toLocaleLowerCase(
                    "ca-ES"
                );

        if (
            normalizado.includes("fp")
        ) {
            return "1r GM Cuina i gastronomia";
        }

        return "A";
    };

    return (
        <div style={estilos.contenedor}>
            <div style={estilos.cabecera}>
                <div>
                    <p style={estilos.titulo}>
                        Cursos disponibles
                        {cursoAcademico
                            ? ` · ${cursoAcademico}`
                            : ""}
                    </p>

                    <p
                        style={
                            estilos.descripcion
                        }
                    >
                        Defineix els cursos i
                        els grups que es poden
                        seleccionar durant el
                        registre d’usuaris.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={añadirCurso}
                    style={
                        estilos.botonPrincipal
                    }
                >
                    <span
                        style={{
                            fontSize: "16px",
                            lineHeight: 1,
                        }}
                    >
                        +
                    </span>

                    Afegir curs
                </button>
            </div>

            <div style={estilos.ayuda}>
                <span>ⓘ</span>

                <span>
                    Per a ESO i
                    Batxillerat, als grups
                    només has d’escriure la
                    lletra, per exemple
                    <strong> A</strong>,
                    <strong> B</strong> o
                    <strong> C</strong>. En
                    el cas de FP, el grup pot
                    ser el nom complet, per
                    exemple{" "}
                    <strong>
                        1r GM Cuina i
                        gastronomia
                    </strong>
                    . Un curs també pot no
                    tenir grups, com
                    Professor.
                </span>
            </div>

            {cursos.length === 0 ? (
                <div style={estilos.vacio}>
                    <p
                        style={
                            estilos.vacioTitulo
                        }
                    >
                        Encara no hi ha
                        cursos configurats
                    </p>

                    <p
                        style={
                            estilos.vacioDescripcion
                        }
                    >
                        Afegeix el primer curs
                        acadèmic per poder-lo
                        mostrar al registre.
                    </p>
                </div>
            ) : (
                <div style={estilos.lista}>
                    {cursos.map(
                        (
                            curso,
                            indiceCurso
                        ) => (
                            <div
                                key={
                                    indiceCurso
                                }
                                style={
                                    estilos.curso
                                }
                            >
                                <div
                                    style={
                                        estilos.cursoCabecera
                                    }
                                >
                                    <span
                                        style={
                                            estilos.numero
                                        }
                                    >
                                        {indiceCurso +
                                            1}
                                    </span>

                                    <input
                                        type="text"
                                        value={
                                            curso.curso
                                        }
                                        placeholder="Ex: 3ESO"
                                        aria-label={`Nom del curs ${
                                            indiceCurso +
                                            1
                                        }`}
                                        onChange={(
                                            event
                                        ) =>
                                            actualizarNombreCurso(
                                                indiceCurso,
                                                event
                                                    .target
                                                    .value
                                            )
                                        }
                                        style={
                                            estilos.inputCurso
                                        }
                                    />

                                    <div
                                        style={
                                            estilos.botonesOrden
                                        }
                                    >
                                        <button
                                            type="button"
                                            title="Pujar"
                                            disabled={
                                                indiceCurso ===
                                                0
                                            }
                                            onClick={() =>
                                                moverCurso(
                                                    indiceCurso,
                                                    -1
                                                )
                                            }
                                            style={{
                                                ...estilos.botonIcono,
                                                opacity:
                                                    indiceCurso ===
                                                    0
                                                        ? 0.35
                                                        : 1,
                                            }}
                                        >
                                            ↑
                                        </button>

                                        <button
                                            type="button"
                                            title="Baixar"
                                            disabled={
                                                indiceCurso ===
                                                cursos.length -
                                                    1
                                            }
                                            onClick={() =>
                                                moverCurso(
                                                    indiceCurso,
                                                    1
                                                )
                                            }
                                            style={{
                                                ...estilos.botonIcono,
                                                opacity:
                                                    indiceCurso ===
                                                    cursos.length -
                                                        1
                                                        ? 0.35
                                                        : 1,
                                            }}
                                        >
                                            ↓
                                        </button>

                                        <button
                                            type="button"
                                            title="Eliminar curs"
                                            onClick={() =>
                                                eliminarCurso(
                                                    indiceCurso
                                                )
                                            }
                                            style={
                                                estilos.botonEliminar
                                            }
                                        >
                                            <IconoCerrar />
                                        </button>
                                    </div>
                                </div>

                                <div
                                    style={
                                        estilos.grupos
                                    }
                                >
                                    <div
                                        style={
                                            estilos.gruposTitulo
                                        }
                                    >
                                        <p
                                            style={
                                                estilos.etiqueta
                                            }
                                        >
                                            Grups
                                        </p>

                                        <span
                                            style={{
                                                color: "var(--neutral)",
                                                fontSize:
                                                    "10px",
                                            }}
                                        >
                                            {
                                                curso
                                                    .grupos
                                                    .length
                                            }{" "}
                                            configurats
                                        </span>
                                    </div>

                                    {curso.grupos
                                        .length >
                                        0 && (
                                        <div
                                            style={
                                                estilos.gruposLista
                                            }
                                        >
                                            {curso.grupos.map(
                                                (
                                                    grupo,
                                                    indiceGrupo
                                                ) => (
                                                    <span
                                                        key={`${grupo}-${indiceGrupo}`}
                                                        style={
                                                            estilos.grupo
                                                        }
                                                    >
                                                        {
                                                            grupo
                                                        }

                                                        <button
                                                            type="button"
                                                            aria-label={`Eliminar grup ${grupo}`}
                                                            onClick={() =>
                                                                eliminarGrupo(
                                                                    indiceCurso,
                                                                    indiceGrupo
                                                                )
                                                            }
                                                            style={
                                                                estilos.eliminarGrupo
                                                            }
                                                        >
                                                            <IconoCerrar />
                                                        </button>
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    )}

                                    <div
                                        style={
                                            estilos.añadirGrupo
                                        }
                                    >
                                        <input
                                            type="text"
                                            value={
                                                nuevosGrupos[
                                                    indiceCurso
                                                ] ??
                                                ""
                                            }
                                            placeholder={placeholderGrupo(
                                                curso.curso
                                            )}
                                            onChange={(
                                                event
                                            ) =>
                                                actualizarNuevoGrupo(
                                                    indiceCurso,
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            onKeyDown={(
                                                event
                                            ) => {
                                                if (
                                                    event.key ===
                                                    "Enter"
                                                ) {
                                                    event.preventDefault();

                                                    añadirGrupo(
                                                        indiceCurso
                                                    );
                                                }
                                            }}
                                            style={
                                                estilos.inputGrupo
                                            }
                                        />

                                        <button
                                            type="button"
                                            onClick={() =>
                                                añadirGrupo(
                                                    indiceCurso
                                                )
                                            }
                                            style={
                                                estilos.botonAñadirGrupo
                                            }
                                        >
                                            + Grup
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>
            )}
        </div>
    );
}