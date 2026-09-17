import type { CursoConfiguracion } from "../Asistente";

type Props = {
    cursos: CursoConfiguracion[];
    cursosPlataforma: CursoConfiguracion[];
    cursoAcademicoPlataforma: string | null;
    deshabilitado: boolean;
    onChange: (cursos: CursoConfiguracion[]) => void;
};

function clonarCursos(
    cursos: CursoConfiguracion[],
): CursoConfiguracion[] {
    return cursos.map(
        (curso: CursoConfiguracion) => ({
            curso: curso.curso,
            grupos: [...curso.grupos],
        }),
    );
}

export default function CursosEdicion({
    cursos,
    cursosPlataforma,
    cursoAcademicoPlataforma,
    deshabilitado,
    onChange,
}: Props) {
    function importarPlataforma() {
        if (
            deshabilitado ||
            cursosPlataforma.length === 0
        ) {
            return;
        }

        if (
            cursos.length >
            0
        ) {
            const confirmar =
                window.confirm(
                    "Ja hi ha cursos configurats en aquesta edició. Si continues, la configuració actual serà substituïda pels cursos de la plataforma.",
                );

            if (
                !confirmar
            ) {
                return;
            }
        }

        onChange(
            clonarCursos(
                cursosPlataforma,
            ),
        );
    }

    function añadirCurso() {
        if (
            deshabilitado
        ) {
            return;
        }

        onChange([
            ...cursos,
            {
                curso: "",
                grupos: [],
            },
        ]);
    }

    function cambiarNombreCurso(
        indice: number,
        curso: string,
    ) {
        onChange(
            cursos.map(
                (
                    item: CursoConfiguracion,
                    posicion: number,
                ) =>
                    posicion ===
                    indice
                        ? {
                              ...item,
                              curso,
                          }
                        : item,
            ),
        );
    }

    function eliminarCurso(
        indice: number,
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onChange(
            cursos.filter(
                (
                    _: CursoConfiguracion,
                    posicion: number,
                ) =>
                    posicion !==
                    indice,
            ),
        );
    }

    function moverCurso(
        indice: number,
        direccion: -1 | 1,
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        const destino =
            indice +
            direccion;

        if (
            destino <
                0 ||
            destino >=
                cursos.length
        ) {
            return;
        }

        const nuevo: CursoConfiguracion[] =
            [
                ...cursos,
            ];

        const actual =
            nuevo[
                indice
            ];

        const siguiente =
            nuevo[
                destino
            ];

        if (
            !actual ||
            !siguiente
        ) {
            return;
        }

        nuevo[
            indice
        ] =
            siguiente;

        nuevo[
            destino
        ] =
            actual;

        onChange(
            nuevo,
        );
    }

    function añadirGrupo(
        indiceCurso: number,
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onChange(
            cursos.map(
                (
                    curso: CursoConfiguracion,
                    posicion: number,
                ) =>
                    posicion ===
                    indiceCurso
                        ? {
                              ...curso,
                              grupos: [
                                  ...curso.grupos,
                                  "",
                              ],
                          }
                        : curso,
            ),
        );
    }

    function cambiarGrupo(
        indiceCurso: number,
        indiceGrupo: number,
        grupo: string,
    ) {
        onChange(
            cursos.map(
                (
                    curso: CursoConfiguracion,
                    posicionCurso: number,
                ) =>
                    posicionCurso ===
                    indiceCurso
                        ? {
                              ...curso,
                              grupos:
                                  curso.grupos.map(
                                      (
                                          actual: string,
                                          posicionGrupo: number,
                                      ) =>
                                          posicionGrupo ===
                                          indiceGrupo
                                              ? grupo
                                              : actual,
                                  ),
                          }
                        : curso,
            ),
        );
    }

    function eliminarGrupo(
        indiceCurso: number,
        indiceGrupo: number,
    ) {
        if (
            deshabilitado
        ) {
            return;
        }

        onChange(
            cursos.map(
                (
                    curso: CursoConfiguracion,
                    posicionCurso: number,
                ) =>
                    posicionCurso ===
                    indiceCurso
                        ? {
                              ...curso,
                              grupos:
                                  curso.grupos.filter(
                                      (
                                          _: string,
                                          posicionGrupo: number,
                                      ) =>
                                          posicionGrupo !==
                                          indiceGrupo,
                                  ),
                          }
                        : curso,
            ),
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-titulos">
                        Cursos de la plataforma
                    </p>

                    <p className="mt-1 text-xs leading-5 text-neutral">
                        {
                            cursoAcademicoPlataforma
                                ? `Configuració disponible del curs ${cursoAcademicoPlataforma}.`
                                : "Importa el catàleg general de cursos i modifica'l després només per a aquesta edició."
                        }
                    </p>

                    <p className="mt-1 text-xs text-neutral">
                        {
                            cursosPlataforma.length ===
                            0
                                ? "No hi ha cursos configurats a la plataforma."
                                : `${cursosPlataforma.length} cursos disponibles per importar.`
                        }
                    </p>
                </div>

                <button type="button" disabled={deshabilitado || cursosPlataforma.length === 0} onClick={importarPlataforma} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                        <path d="M440-160v-326L336-382l-56-58 200-200 200 200-56 58-104-104v326h-80ZM160-80q-33 0-56.5-23.5T80-160v-560q0-33 23.5-56.5T160-800h240v80H160v560h640v-560H560v-80h240q33 0 56.5 23.5T880-720v560q0 33-23.5 56.5T800-80H160Z" />
                    </svg>

                    Importar cursos
                </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-semibold text-neutral-titulos">
                        Cursos participants
                    </p>

                    <p className="mt-1 text-xs text-neutral">
                        Aquests són els cursos que podran seleccionar els participants dels equips.
                    </p>
                </div>

                <button type="button" disabled={deshabilitado} onClick={añadirCurso} className="inline-flex w-max items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                        <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z" />
                    </svg>

                    Afegir curs
                </button>
            </div>

            {
                cursos.length ===
                0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center">
                        <p className="text-sm font-semibold text-neutral-titulos">
                            Encara no hi ha cursos configurats
                        </p>

                        <p className="mt-1 text-xs leading-5 text-neutral">
                            Pots importar els cursos de la plataforma o crear-los manualment.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {
                            cursos.map(
                                (
                                    curso: CursoConfiguracion,
                                    indiceCurso: number,
                                ) => (
                                    <article key={indiceCurso} className="overflow-hidden rounded-xl border border-border bg-card">
                                        <div className="flex items-center gap-2 border-b border-border p-3">
                                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                                {
                                                    indiceCurso +
                                                    1
                                                }
                                            </span>

                                            <input type="text" value={curso.curso} disabled={deshabilitado} onChange={evento => cambiarNombreCurso(indiceCurso, evento.target.value)} placeholder="Nom del curs, per exemple 4t ESO" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-semibold text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60" />

                                            <button type="button" title="Pujar" disabled={deshabilitado || indiceCurso === 0} onClick={() => moverCurso(indiceCurso, -1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-neutral transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                                                ↑
                                            </button>

                                            <button type="button" title="Baixar" disabled={deshabilitado || indiceCurso === cursos.length - 1} onClick={() => moverCurso(indiceCurso, 1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-neutral transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-30">
                                                ↓
                                            </button>

                                            <button type="button" title="Eliminar curs" disabled={deshabilitado} onClick={() => eliminarCurso(indiceCurso)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-error/20 bg-error-container/20 text-error transition hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-50">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                                    <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360Z" />
                                                </svg>
                                            </button>
                                        </div>

                                        <div className="space-y-3 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral">
                                                        Grups
                                                    </p>

                                                    <p className="mt-0.5 text-xs text-neutral">
                                                        {
                                                            curso.grupos.length ===
                                                            0
                                                                ? "Aquest curs no té grups específics."
                                                                : `${curso.grupos.length} grups configurats.`
                                                        }
                                                    </p>
                                                </div>

                                                <button type="button" disabled={deshabilitado} onClick={() => añadirGrupo(indiceCurso)} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-neutral-titulos transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                                                    <span className="text-base leading-none">
                                                        +
                                                    </span>

                                                    Afegir grup
                                                </button>
                                            </div>

                                            {
                                                curso.grupos.length >
                                                    0 && (
                                                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                                        {
                                                            curso.grupos.map(
                                                                (
                                                                    grupo: string,
                                                                    indiceGrupo: number,
                                                                ) => (
                                                                    <div key={indiceGrupo} className="flex items-center gap-2">
                                                                        <input type="text" value={grupo} disabled={deshabilitado} onChange={evento => cambiarGrupo(indiceCurso, indiceGrupo, evento.target.value)} placeholder="Nom del grup, per exemple 4t ESO A" className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60" />

                                                                        <button type="button" title="Eliminar grup" disabled={deshabilitado} onClick={() => eliminarGrupo(indiceCurso, indiceGrupo)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-error/20 bg-error-container/20 text-error transition hover:bg-error-container disabled:cursor-not-allowed disabled:opacity-50">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                                                                                <path d="M280-440v-80h400v80H280Z" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                ),
                                                            )
                                                        }
                                                    </div>
                                                )
                                            }
                                        </div>
                                    </article>
                                ),
                            )
                        }
                    </div>
                )
            }
        </div>
    );
}