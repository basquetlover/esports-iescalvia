import type {
    CursoConfiguracion,
} from "../FormularioEquipo";

// ============================================================
// PROPS
// ============================================================

type Props = {
    curso: string;
    grupo: string;
    cursos: readonly CursoConfiguracion[];
    deshabilitado?: boolean;
    obligatorio?: boolean;
    onCambiar: (curso: string, grupo: string) => void;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function SelectorCurso({
    curso,
    grupo,
    cursos,
    deshabilitado = false,
    obligatorio = true,
    onCambiar,
}: Props) {
    const configuracionCurso =
        cursos.find(
            entrada =>
                entrada.curso ===
                curso,
        ) ??
        null;

    const grupos =
        configuracionCurso
            ?.grupos ??
        [];

    // ========================================================
    // CAMBIAR CURSO
    // ========================================================

    function cambiarCurso(
        nuevoCurso:
            string,
    ) {
        const nuevaConfiguracion =
            cursos.find(
                entrada =>
                    entrada.curso ===
                    nuevoCurso,
            ) ??
            null;

        const nuevosGrupos =
            nuevaConfiguracion
                ?.grupos ??
            [];

        /*
         * Al cambiar de curso nunca conservamos un grupo
         * perteneciente al curso anterior.
         *
         * Si solamente existe un grupo, se selecciona
         * automáticamente.
         */
        const nuevoGrupo =
            nuevosGrupos.length ===
            1
                ? nuevosGrupos[
                      0
                  ]
                : "";

        onCambiar(
            nuevoCurso,
            nuevoGrupo,
        );
    }

    // ========================================================
    // SIN CURSOS
    // ========================================================

    if (
        cursos.length ===
        0
    ) {
        return (
            <div className="rounded-xl border border-error/30 bg-error-container/20 px-4 py-3">
                <p className="text-sm font-semibold text-error-foreground">
                    No hi ha cursos configurats
                </p>

                <p className="mt-1 text-xs leading-5 text-error-foreground">
                    Aquesta edició no té cap curs disponible per a la inscripció.
                </p>
            </div>
        );
    }

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {/* =================================================
                CURSO
            ================================================= */}

            <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-titulos">
                    Curs

                    {obligatorio && (
                        <>
                            {" "}

                            <span className="text-error" aria-hidden="true">
                                *
                            </span>

                            <span className="sr-only">
                                obligatori
                            </span>
                        </>
                    )}
                </label>

                <div className="relative">
                    <select value={curso} disabled={deshabilitado} onChange={evento => cambiarCurso(evento.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-card disabled:text-neutral">
                        <option value="">
                            Selecciona un curs
                        </option>

                        {cursos.map(
                            entrada => (
                                <option key={entrada.curso} value={entrada.curso}>
                                    {entrada.curso}
                                </option>
                            ),
                        )}
                    </select>

                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                            <path d="M480-360 280-560h400L480-360Z" />
                        </svg>
                    </span>
                </div>
            </div>

            {/* =================================================
                GRUPO
            ================================================= */}

            <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-titulos">
                    Grup

                    {obligatorio && (
                        <>
                            {" "}

                            <span className="text-error" aria-hidden="true">
                                *
                            </span>

                            <span className="sr-only">
                                obligatori
                            </span>
                        </>
                    )}
                </label>

                <div className="relative">
                    <select value={grupo} disabled={deshabilitado || !curso || grupos.length === 0} onChange={evento => onCambiar(curso, evento.target.value)} className="min-h-11 w-full appearance-none rounded-xl border border-border bg-background px-3 py-2.5 pr-10 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-card disabled:text-neutral">
                        {!curso ? (
                            <option value="">
                                Primer selecciona un curs
                            </option>
                        ) : grupos.length ===
                          0 ? (
                            <option value="">
                                No hi ha grups disponibles
                            </option>
                        ) : (
                            <>
                                <option value="">
                                    Selecciona un grup
                                </option>

                                {grupos.map(
                                    entrada => (
                                        <option key={entrada} value={entrada}>
                                            {entrada}
                                        </option>
                                    ),
                                )}
                            </>
                        )}
                    </select>

                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-neutral">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-4 w-4 fill-current" aria-hidden="true">
                            <path d="M480-360 280-560h400L480-360Z" />
                        </svg>
                    </span>
                </div>

                {curso && grupos.length === 0 && (
                    <p className="text-xs leading-5 text-error">
                        El curs seleccionat no té cap grup configurat.
                    </p>
                )}
            </div>
        </div>
    );
}