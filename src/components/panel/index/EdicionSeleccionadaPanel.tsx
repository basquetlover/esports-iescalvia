import type {
    EdicionPanel,
    ResumenEdicionPanel,
    TorneoPanel,
} from "./ResumenPanel";

type Props = {
    torneo: TorneoPanel;
    edicion: EdicionPanel;
    resumen: ResumenEdicionPanel;
    puedeEditar: boolean;
};

function datosEstado(
    valor: string | null,
) {
    const estado = valor?.trim().toUpperCase() ?? "";

    if (["ACTIVA", "ACTIVO", "ACTIU"].includes(estado)) {
        return {
            nombre: "Activa",
            clase: "border-secondary/30 bg-secondary/15 text-secondary",
        };
    }

    if (["FINALIZADA", "FINALIZADO", "FINALITZADA", "FINALITZAT"].includes(estado)) {
        return {
            nombre: "Finalitzada",
            clase: "border-border bg-muted/15 text-neutral",
        };
    }

    if (["BORRADOR", "ESBORRANY", "EN_PREPARACIO"].includes(estado)) {
        return {
            nombre: "En preparació",
            clase: "border-primary/30 bg-primary/15 text-primary",
        };
    }

    return {
        nombre: "Sense estat",
        clase: "border-border bg-muted/15 text-neutral",
    };
}

function fecha(
    valor: string | null,
) {
    if (!valor || !Number.isFinite(Date.parse(valor))) {
        return "Pendent";
    }

    return new Date(valor).toLocaleDateString("ca-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Madrid",
    });
}

function fechaHora(
    valor: string,
) {
    if (!Number.isFinite(Date.parse(valor))) {
        return "Sense dades";
    }

    return new Date(valor).toLocaleString("ca-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
    });
}

function valorContador(
    valor: number | null,
) {
    return valor === null
        ? "—"
        : valor.toLocaleString("ca-ES");
}

function TarjetaDato({
    titulo,
    valor,
    descripcion,
    icono,
    destacado = false,
    error = false,
}: {
    titulo: string;
    valor: number | null;
    descripcion: string;
    icono: string;
    destacado?: boolean;
    error?: boolean;
}) {
    const claseTarjeta = error
        ? "border-error/30 bg-error-container/10"
        : destacado
          ? "border-secondary/30 bg-secondary/5"
          : "border-border bg-card";

    const claseValor = error
        ? "text-error"
        : destacado
          ? "text-secondary"
          : "text-neutral-titulos";

    const claseIcono = error
        ? "bg-error-container text-error"
        : destacado
          ? "bg-secondary/15 text-secondary"
          : "bg-primary/10 text-primary";

    return (
        <article className={`rounded-2xl border p-5 ${claseTarjeta}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-neutral">
                        {titulo}
                    </p>

                    <p className={`mt-2 text-3xl font-bold ${claseValor}`}>
                        {valorContador(valor)}
                    </p>
                </div>

                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${claseIcono}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                        <path d={icono} />
                    </svg>
                </span>
            </div>

            <p className="mt-3 text-xs text-neutral">
                {valor === null ? "Dada pendent de connexió" : descripcion}
            </p>
        </article>
    );
}

export default function EdicionSeleccionadaPanel({
    torneo,
    edicion,
    resumen,
    puedeEditar,
}: Props) {
    const estado = datosEstado(edicion.estado);

    const hayErrores =
        resumen.formulariosError !== null &&
        resumen.formulariosError > 0;

    return (
        <div className="w-full min-w-0 space-y-6 p-4 md:p-6">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-3xl font-bold text-neutral-titulos max-md:text-2xl">
                            {edicion.nombre || "Edició sense nom"}
                        </h1>

                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${estado.clase}`}>
                            {estado.nombre}
                        </span>
                    </div>

                    <p className="mt-1 text-sm text-neutral">
                        Resum operatiu de l'edició de {torneo.nombre || "torneig"}.
                    </p>
                </div>

                {puedeEditar && (
                    <a href={`/panell/info/edicio?accio=editar&torneoID=${encodeURIComponent(torneo.id)}&edicionID=${encodeURIComponent(edicion.id)}`} className="inline-flex w-max items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current" viewBox="0 -960 960 960" aria-hidden="true">
                            <path d="M200-200h57l391-391-57-57-391 391zm-80 80v-170l528-527q12-12 27-18t30-6q16 0 31 6t27 18l54 54q12 12 18 27t6 30q0 16-6 31t-18 27L290-120z" />
                        </svg>

                        Gestionar edició
                    </a>
                )}
            </header>

            <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral">
                            Torneig
                        </p>

                        <p className="mt-1 font-semibold text-neutral-titulos">
                            {torneo.nombre || "Sense nom"}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral">
                            Inici
                        </p>

                        <p className="mt-1 font-semibold text-neutral-titulos">
                            {fecha(edicion.fecha_inicio)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral">
                            Final
                        </p>

                        <p className="mt-1 font-semibold text-neutral-titulos">
                            {fecha(edicion.fecha_fin)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral">
                            Seu
                        </p>

                        <p className="mt-1 font-semibold text-neutral-titulos">
                            {edicion.sede?.trim() || "Pendent"}
                        </p>
                    </div>
                </div>
            </section>

            <section>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-neutral-titulos">
                        Resum de l'activitat
                    </h2>

                    <p className="mt-1 text-sm text-neutral">
                        Estat actual de la participació i de la gestió de l'edició.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <TarjetaDato titulo="Equips inscrits" valor={resumen.equiposInscritos} descripcion="Equips registrats a l'edició" destacado icono="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112zm720 0v-112q0-34-17.5-62.5T696-378q-22-11-45-20t-47-15q16 18 26 39.5t10 45.5v168zm-400-360q-83 0-141.5-58.5T160-720t58.5-141.5T360-920t141.5 58.5T560-720t-58.5 141.5T360-520Z" />

                    <TarjetaDato titulo="Voluntaris" valor={resumen.voluntarios} descripcion="Persones inscrites com a voluntàries" icono="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112z" />

                    <TarjetaDato titulo="Participants" valor={resumen.participantes} descripcion="Participants totals registrats" icono="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112zm720 0v-112q0-34-17.5-62.5T696-378q-22-11-45-20t-47-15q16 18 26 39.5t10 45.5v168z" />

                    <TarjetaDato titulo="Partits" valor={resumen.partidos} descripcion="Partits programats a l'edició" icono="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80z" />

                    <TarjetaDato titulo="Formularis completats" valor={resumen.formulariosCompletados} descripcion="Formularis processats correctament" icono="m382-240-170-170 56-57 114 114 310-310 57 57-367 366Z" />

                    <TarjetaDato titulo="Formularis amb error" valor={resumen.formulariosError} descripcion="Formularis que requereixen revisió" error={hayErrores} icono="M440-280h80v-80h-80v80Zm0-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
                </div>
            </section>

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="font-bold text-neutral-titulos">
                        Estat dels formularis
                    </h2>

                    <p className="mt-1 text-sm text-neutral">
                        Control de les dades rebudes durant les inscripcions.
                    </p>

                    <div className="mt-5 space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-neutral">
                                Completats
                            </span>

                            <span className="font-semibold text-neutral-titulos">
                                {valorContador(resumen.formulariosCompletados)}
                            </span>
                        </div>

                        <div className="h-px bg-border" />

                        <div className="flex items-center justify-between gap-4">
                            <span className="text-sm text-neutral">
                                Amb incidències
                            </span>

                            <span className={hayErrores ? "font-semibold text-error" : "font-semibold text-neutral-titulos"}>
                                {valorContador(resumen.formulariosError)}
                            </span>
                        </div>
                    </div>
                </article>

                <article className="rounded-2xl border border-border bg-card p-5">
                    <h2 className="font-bold text-neutral-titulos">
                        Darrera actualització
                    </h2>

                    <p className="mt-1 text-sm text-neutral">
                        Últim canvi registrat sobre aquesta edició.
                    </p>

                    <p className="mt-5 text-2xl font-bold text-neutral-titulos">
                        {edicion.updated_at && Number.isFinite(Date.parse(edicion.updated_at)) ? fechaHora(edicion.updated_at) : "Sense dades"}
                    </p>
                </article>
            </section>

            <section className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                    <h2 className="font-bold text-neutral-titulos">
                        Activitat recent
                    </h2>

                    <p className="mt-1 text-sm text-neutral">
                        Resum cronològic dels darrers canvis registrats a l'edició.
                    </p>
                </div>

                {resumen.actividad.length === 0 ? (
                    <div className="p-6">
                        <p className="text-sm text-neutral">
                            Encara no hi ha activitat registrada.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {resumen.actividad.map(actividad => (
                            <div key={actividad.id} className="flex items-start gap-4 px-5 py-4">
                                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" />

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="font-semibold text-neutral-titulos">
                                            {actividad.titulo}
                                        </p>

                                        <time dateTime={actividad.fecha} className="text-xs text-neutral">
                                            {fechaHora(actividad.fecha)}
                                        </time>
                                    </div>

                                    <p className="mt-1 text-sm text-neutral">
                                        {actividad.descripcion}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}