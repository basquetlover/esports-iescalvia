import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Cargando from "@components/Cargando";

type Props = {
  torneoID: string;
  edicionID: string;
};

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Resultado = {
  id: string;
  partido_id: string;
  edicion_id: string;
  marcador_local: number | null;
  marcador_visitante: number | null;
  ganador_equipo_id: string | null;
  resultado_tipo: string;
  confirmado: boolean;
  confirmado_at: string | null;
  observaciones: string | null;
  created_at: string;
  updated_at: string;
};

type Acta = {
  id: string;
  partido_id: string;
  estado: string;
  operador_id: string | null;
  controlador_id: string | null;
  iniciada_at: string | null;
  bloqueada_at: string | null;
  finalizada_at: string | null;
  version: number;
  updated_at: string;
};

type Partido = {
  id: string;
  fase_id: string;
  fase_tipo: "GRUPOS" | "ELIMINATORIA";
  tipo: "GRUPO" | "ELIMINATORIA";
  grupo_id: string | null;
  ronda_id: string | null;
  codigo: string;
  nombre: string | null;
  orden: number;
  jornada: number | null;
  estado: string;
  fecha_hora: string | null;
  pista: string | null;
  publicado: boolean;
  finalizado_at: string | null;

  local: {
    equipo: Equipo | null;
  };

  visitante: {
    equipo: Equipo | null;
  };

  resultado: Resultado | null;

  acta: Acta | null;
};

type Datos = {
  success: true;

  torneo: {
    id: string;
    nombre: string | null;
    deporte: string | null;
  };

  edicion: {
    id: string;
    torneo_id: string | null;
    nombre: string | null;
  };

  partidos: Partido[];
};

export default function Resultats({
  torneoID,
  edicionID,
}: Props) {
  const [datos, setDatos] =
    useState<Datos | null>(null);

  const [cargando, setCargando] =
    useState(true);

  const [error, setError] =
    useState("");

  const [filtroEstado, setFiltroEstado] =
    useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const parametros =
        new URLSearchParams({
          torneoID,
          edicionID,
        });

      const respuesta =
        await fetch(
          `/api/panell/partits/resultats?${parametros.toString()}`,
          {
            credentials: "same-origin",
            cache: "no-store",
          },
        );

      const contenido: unknown =
        await respuesta
          .json()
          .catch(() => null);

      if (
        !contenido ||
        typeof contenido !== "object" ||
        Array.isArray(contenido)
      ) {
        throw new Error(
          "La resposta del servidor no és vàlida.",
        );
      }

      const registro =
        contenido as Record<
          string,
          unknown
        >;

      if (
        !respuesta.ok ||
        registro.success !== true
      ) {
        throw new Error(
          typeof registro.mensaje ===
            "string"
            ? registro.mensaje
            : "No s'han pogut carregar els resultats.",
        );
      }

      setDatos(
        contenido as Datos,
      );
    } catch (error) {
      setDatos(null);

      setError(
        error instanceof Error
          ? error.message
          : "No s'han pogut carregar els resultats.",
      );
    } finally {
      setCargando(false);
    }
  }, [
    torneoID,
    edicionID,
  ]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const partidos =
    useMemo(() => {
      if (!datos) {
        return [];
      }

      return datos.partidos.filter(
        partido =>
          !filtroEstado ||
          partido.estado ===
            filtroEstado,
      );
    }, [
      datos,
      filtroEstado,
    ]);

  if (
    cargando &&
    !datos
  ) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-border/50 bg-card">
        <Cargando />
      </div>
    );
  }

  if (
    error &&
    !datos
  ) {
    return (
      <div className="rounded-2xl border border-error/30 bg-card p-6">
        <div className="flex items-start gap-3">
          <IconoError className="h-6 w-6 shrink-0 text-error" />

          <div>
            <h2 className="font-bold text-neutral-titulos">
              No s'han pogut carregar els resultats
            </h2>

            <p className="mt-1 text-sm text-error">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void cargar()
              }
              className="mt-4 rounded-lg border border-border px-3 py-2 text-sm font-semibold"
            >
              Tornar a provar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!datos) {
    return null;
  }

  if (
    normalizarDeporte(
      datos.torneo.deporte,
    ) !== "FUTBOL"
  ) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card p-8 text-center">
        <IconoConstruccion className="mx-auto h-12 w-12 text-neutral" />

        <h2 className="mt-3 text-xl font-bold text-neutral-titulos">
          Resultats pendents d'implementar
        </h2>

        <p className="mx-auto mt-2 max-w-xl text-sm text-neutral">
          De moment aquesta funcionalitat està disponible per a futbol.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-neutral-titulos">
            Resultats dels partits
          </h2>

          <p className="mt-1 text-sm text-neutral">
            Consulta el resultat, l'estat del partit i accedeix directament a l'acta.
          </p>
        </div>

        <select
          value={
            filtroEstado
          }
          onChange={
            evento =>
              setFiltroEstado(
                evento.target.value,
              )
          }
          className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
        >
          <option value="">
            Tots els estats
          </option>

          <option value="BORRADOR">
            Esborrany
          </option>

          <option value="PROGRAMADO">
            Programat
          </option>

          <option value="EN_CURSO">
            En curs
          </option>

          <option value="FINALIZADO">
            Finalitzat
          </option>

          <option value="SUSPENDIDO">
            Suspès
          </option>

          <option value="CANCELADO">
            Cancel·lat
          </option>
        </select>
      </section>

      {partidos.length === 0 ? (
        <EstadoVacio />
      ) : (
        <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
          <div className="divide-y divide-border">
            {partidos.map(
              partido => (
                <PartidoResultado
                  key={
                    partido.id
                  }
                  partido={
                    partido
                  }
                  torneoID={
                    torneoID
                  }
                  edicionID={
                    edicionID
                  }
                />
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function PartidoResultado({
  partido,
  torneoID,
  edicionID,
}: {
  partido: Partido;
  torneoID: string;
  edicionID: string;
}) {
  const local =
    partido.local.equipo;

  const visitante =
    partido.visitante.equipo;

  const resultado =
    partido.resultado;

  const enlaceActa =
    `/panell/partits/${encodeURIComponent(
      partido.id,
    )}/acta` +
    `?torneoID=${encodeURIComponent(
      torneoID,
    )}` +
    `&edicionID=${encodeURIComponent(
      edicionID,
    )}`;

  return (
    <article className="p-4 md:p-5">
      <div className="grid items-center gap-5 xl:grid-cols-[150px_minmax(0,1fr)_230px_150px]">
        <div>
          <p className="text-sm font-bold text-neutral-titulos">
            {formatearFecha(
              partido.fecha_hora,
            )}
          </p>

          <p className="mt-1 text-2xl font-bold text-neutral-titulos">
            {formatearHora(
              partido.fecha_hora,
            )}
          </p>

          <p className="mt-1 text-xs text-neutral">
            {partido.pista ||
              "Sense pista"}
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_110px_minmax(0,1fr)] items-center gap-3">
          <EquipoPartido
            equipo={
              local
            }
            derecha
          />

          <Marcador
            resultado={
              resultado
            }
          />

          <EquipoPartido
            equipo={
              visitante
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <EstadoPartido
              estado={
                partido.estado
              }
            />

            <EstadoResultado
              resultado={
                resultado
              }
            />
          </div>

          <EstadoActa
            acta={
              partido.acta
            }
          />

          {resultado &&
            resultado.resultado_tipo !==
              "NORMAL" && (
              <p className="text-xs font-semibold text-neutral">
                {nombreTipoResultado(
                  resultado.resultado_tipo,
                )}
              </p>
            )}

          <p className="text-[11px] text-neutral">
            {partido.codigo}

            {partido.jornada !==
              null
              ? ` · Jornada ${partido.jornada}`
              : ""}
          </p>
        </div>

        <div className="flex justify-start xl:justify-end">
          <a
            href={
              enlaceActa
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <IconoDocumento className="h-4 w-4" />

            Obrir acta
          </a>
        </div>
      </div>
    </article>
  );
}

function EquipoPartido({
  equipo,
  derecha = false,
}: {
  equipo: Equipo | null;
  derecha?: boolean;
}) {
  const nombre =
    equipo?.nombre ??
    "Per determinar";

  return (
    <div
      className={`flex min-w-0 items-center gap-3 ${
        derecha
          ? "justify-end text-right"
          : ""
      }`}
    >
      {derecha && (
        <p className="min-w-0 truncate text-sm font-bold text-neutral-titulos">
          {nombre}
        </p>
      )}

      <Escudo
        equipo={
          equipo
        }
      />

      {!derecha && (
        <p className="min-w-0 truncate text-sm font-bold text-neutral-titulos">
          {nombre}
        </p>
      )}
    </div>
  );
}

function Escudo({
  equipo,
}: {
  equipo: Equipo | null;
}) {
  if (
    equipo?.escudo
  ) {
    return (
      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white p-1">
        <img
          src={
            equipo.escudo
          }
          alt=""
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
      {iniciales(
        equipo?.nombre ??
          "?",
      )}
    </div>
  );
}

function Marcador({
  resultado,
}: {
  resultado: Resultado | null;
}) {
  if (
    !resultado ||
    resultado.marcador_local ===
      null ||
    resultado.marcador_visitante ===
      null
  ) {
    return (
      <div className="text-center">
        <p className="text-2xl font-bold text-neutral">
          -
        </p>

        <p className="mt-1 text-[10px] uppercase tracking-wide text-neutral">
          Sense resultat
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-center">
      <span className="text-3xl font-black text-neutral-titulos">
        {
          resultado.marcador_local
        }
      </span>

      <span className="text-lg font-bold text-neutral">
        -
      </span>

      <span className="text-3xl font-black text-neutral-titulos">
        {
          resultado.marcador_visitante
        }
      </span>
    </div>
  );
}

function EstadoPartido({
  estado,
}: {
  estado: string;
}) {
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold ${clasesEstadoPartido(
        estado,
      )}`}
    >
      {nombreEstadoPartido(
        estado,
      )}
    </span>
  );
}

function EstadoResultado({
  resultado,
}: {
  resultado: Resultado | null;
}) {
  if (!resultado) {
    return (
      <span className="inline-flex rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-neutral">
        Sense resultat
      </span>
    );
  }

  return resultado.confirmado ? (
    <span className="inline-flex rounded-lg border border-secondary/30 bg-secondary/10 px-2.5 py-1 text-[11px] font-semibold text-secondary">
      Resultat confirmat
    </span>
  ) : (
    <span className="inline-flex rounded-lg border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-600">
      Resultat provisional
    </span>
  );
}

function EstadoActa({
  acta,
}: {
  acta: Acta | null;
}) {
  if (!acta) {
    return (
      <p className="text-xs text-neutral">
        Acta no iniciada
      </p>
    );
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-neutral">
      <IconoDocumento className="h-4 w-4" />

      {nombreEstadoActa(
        acta.estado,
      )}
    </p>
  );
}

function EstadoVacio() {
  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <IconoMarcador className="mx-auto h-12 w-12 text-neutral" />

      <h2 className="mt-3 text-lg font-bold text-neutral-titulos">
        No hi ha partits
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-neutral">
        No hi ha cap partit que coincideixi amb el filtre seleccionat.
      </p>
    </section>
  );
}

// ============================================================
// SVG
// ============================================================

function IconoDocumento({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function IconoError({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
      />
      <path d="M12 7v6" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function IconoConstruccion({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14.7 6.3a4 4 0 0 0-5-5l2.1 2.1-3.4 3.4-2.1-2.1a4 4 0 0 0 5 5L19 17.4a2.1 2.1 0 0 1-3 3l-7.7-7.7a4 4 0 0 0-5 5" />
    </svg>
  );
}

function IconoMarcador({
  className = "",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
      />
      <path d="M8 9h2v6H8z" />
      <path d="M14 9h2v6h-2z" />
    </svg>
  );
}

// ============================================================
// HELPERS
// ============================================================

function normalizarDeporte(
  valor: string | null,
) {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        "",
      )
      .toUpperCase() ??
    ""
  );
}

function nombreEstadoPartido(
  estado: string,
) {
  switch (estado) {
    case "BORRADOR":
      return "Esborrany";

    case "PROGRAMADO":
      return "Programat";

    case "EN_CURSO":
      return "En curs";

    case "FINALIZADO":
      return "Finalitzat";

    case "SUSPENDIDO":
      return "Suspès";

    case "CANCELADO":
      return "Cancel·lat";

    default:
      return estado;
  }
}

function clasesEstadoPartido(
  estado: string,
) {
  switch (estado) {
    case "PROGRAMADO":
      return "border-primary/20 bg-primary/10 text-primary";

    case "EN_CURSO":
      return "border-orange-500/20 bg-orange-500/10 text-orange-600";

    case "FINALIZADO":
      return "border-secondary/30 bg-secondary/10 text-secondary";

    case "SUSPENDIDO":
      return "border-orange-500/20 bg-orange-500/10 text-orange-600";

    case "CANCELADO":
      return "border-error/20 bg-error/10 text-error";

    default:
      return "border-border bg-background text-neutral";
  }
}

function nombreEstadoActa(
  estado: string,
) {
  switch (estado) {
    case "NO_INICIADA":
      return "Acta no iniciada";

    case "EN_CURSO":
      return "Acta en curs";

    case "BLOQUEADA":
      return "Acta bloquejada";

    case "FINALIZADA":
      return "Acta finalitzada";

    default:
      return `Acta: ${estado}`;
  }
}

function nombreTipoResultado(
  tipo: string,
) {
  switch (tipo) {
    case "NORMAL":
      return "Normal";

    case "PRORROGA":
      return "Pròrroga";

    case "PENALTIS":
      return "Penals";

    case "INCOMPARECENCIA":
      return "Incompareixença";

    case "ANULADO":
      return "Anul·lat";

    default:
      return tipo;
  }
}

function iniciales(
  nombre: string,
) {
  return (
    nombre
      .trim()
      .slice(0, 2)
      .toUpperCase() ||
    "?"
  );
}

function formatearHora(
  valor: string | null,
) {
  if (!valor) {
    return "--:--";
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(
    "ca-ES",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  ).format(fecha);
}

function formatearFecha(
  valor: string | null,
) {
  if (!valor) {
    return "Sense data";
  }

  const fecha =
    new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return "Sense data";
  }

  return new Intl.DateTimeFormat(
    "ca-ES",
    {
      day: "numeric",
      month: "short",
    },
  ).format(fecha);
}