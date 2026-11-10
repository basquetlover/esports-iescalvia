import { useCallback, useEffect, useState } from "react";

type InformePublico = {
  id: string;
  motivo: "GENERAL" | "SUSPENSION";
  contenido: string;
  equipoResponsableNombre: string | null;
  creadoAt: string;
};

type Props = {
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

function fecha(valor: string): string {
  const date = new Date(valor);

  return Number.isNaN(date.getTime())
    ? "Data desconeguda"
    : date.toLocaleString("ca-ES", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      });
}

export default function InformesPublicosPartido({
  torneoID,
  edicionID,
  partidoID,
}: Props) {
  const [informes, setInformes] = useState<InformePublico[]>([]);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const cargar = useCallback(
    async (signal: AbortSignal) => {
      setCargando(true);
      setError("");

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
          partidoID,
        });

        const respuesta = await fetch(`/api/torneos/informes?${parametros}`, {
          cache: "no-store",
          signal,
        });

        const json: unknown = await respuesta.json().catch(() => null);

        const datos = json as {
          success?: boolean;
          informes?: InformePublico[];
          mensaje?: string;
        } | null;

        if (
          !respuesta.ok ||
          datos?.success !== true ||
          !Array.isArray(datos.informes)
        ) {
          throw new Error(
            datos?.mensaje ?? "No s'han pogut carregar els informes.",
          );
        }

        if (!signal.aborted) {
          setInformes(datos.informes);
        }
      } catch (fallo) {
        if (!signal.aborted) {
          setError(
            fallo instanceof Error ? fallo.message : "Error de connexió.",
          );
        }
      } finally {
        if (!signal.aborted) {
          setCargando(false);
        }
      }
    },
    [torneoID, edicionID, partidoID],
  );

  useEffect(() => {
    const controller = new AbortController();

    void cargar(controller.signal);

    return () => controller.abort();
  }, [cargar, revision]);

  // No mostrar una sección vacía.
  if (!cargando && !error && informes.length === 0) {
    return null;
  }

  return (
    <section
      className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8"
      aria-labelledby="informes-publicos-titulo"
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-secondary">
              Informació oficial
            </p>

            <h2
              id="informes-publicos-titulo"
              className="mt-1 text-xl font-bold text-neutral-titulos sm:text-2xl"
            >
              Informes públics del partit
            </h2>
          </div>
        </div>

        {cargando && (
          <p role="status" className="py-5 text-sm text-neutral">
            Carregant informes...
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {!cargando && !error && (
          <div className="space-y-3">
            {informes.map((informe) => (
              <article
                key={informe.id}
                className="rounded-xl border border-border bg-background p-4 sm:p-5"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={
                      informe.motivo === "SUSPENSION"
                        ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"
                        : "rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                    }
                  >
                    {informe.motivo === "SUSPENSION"
                      ? "Suspensió"
                      : "Comunicació"}
                  </span>

                  <time
                    dateTime={informe.creadoAt}
                    className="text-xs text-neutral"
                  >
                    {fecha(informe.creadoAt)}
                  </time>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-titulos">
                  {informe.contenido}
                </p>

                {informe.equipoResponsableNombre && (
                  <p className="mt-3 text-xs font-semibold text-neutral">
                    Equip responsable: {informe.equipoResponsableNombre}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
