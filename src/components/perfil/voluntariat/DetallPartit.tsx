import { useCallback, useEffect, useState } from "react";

import { useRealtimeBroadcast } from "@components/realtime/SupabaseRealtime";

type Funcion = "ARBITRE" | "OFICIAL_TAULA";

type Datos = {
  success: true;

  torneo: {
    id: string;
    nombre: string;
  };

  edicion: {
    id: string;
    nombre: string | null;
  };

  partido: {
    id: string;
    codigo: string | null;
    nombre: string | null;
    estado: string;
    fechaHora: string | null;
    jornada: number | null;
    pista: string | null;
    fase: string | null;
    ronda: string | null;
    local: string;
    visitante: string;
  };

  funciones: Funcion[];

  acta: {
    id: string;
    estado: string;
    estadoOperativo: string | null;
  } | null;

  permisos: {
    puedeConsultar: boolean;
    puedeSolicitarControl: boolean;
    puedeEscribir: boolean;
    esControlador: boolean;
    hayOtroControlador: boolean;
    bloqueadoControl: boolean;
  };

  accion: {
    codigo: string;
    texto: string;
    disponible: boolean;
  };
};

type Props = {
  torneoID: string;
  edicionID: string;
  partidoID: string;
};

const BTN =
  "inline-flex min-h-11 items-center justify-center " +
  "rounded-xl px-5 py-3 text-center text-sm font-semibold " +
  "transition";

function fechaCatalan(valor: string | null): string {
  if (!valor) return "Data pendent";

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Data pendent";
  }

  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(fecha);
}

function estadoActa(datos: Datos): string {
  if (!datos.acta) return "No iniciada";

  if (datos.accion.codigo === "BLOQUEJADA") {
    return "Bloquejada";
  }

  if (datos.acta.estado === "FINALIZADA") {
    return "Finalitzada";
  }

  if (datos.acta.estadoOperativo === "EN_REVISION") {
    return "En revisió";
  }

  if (datos.acta.estado === "EN_CURSO") {
    return "En curs";
  }

  return "En preparació";
}

export default function DetallPartit({
  torneoID,
  edicionID,
  partidoID,
}: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [actualizando, setActualizando] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  const actualizar = useCallback(() => {
    setRevision((valor) => valor + 1);
  }, []);

  const realtimeDesignaciones = useRealtimeBroadcast({
    canal: `designacions-partit-${partidoID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  const realtimeActas = useRealtimeBroadcast({
    canal: `actes-actives-edicio-${edicionID}`,
    evento: "actualitzada",
    onCambio: actualizar,
  });

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setActualizando(true);

      try {
        const params = new URLSearchParams({
          torneoID,
          edicionID,
          partidoID,
        });

        const respuesta = await fetch(
          `/api/perfil/voluntariat/partit?${params}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controlador.signal,
          },
        );

        const contenido = await respuesta.json();

        if (!respuesta.ok || contenido.success !== true) {
          throw new Error(
            contenido.mensaje ?? "No s'ha pogut consultar la designació.",
          );
        }

        if (!controlador.signal.aborted) {
          setDatos(contenido as Datos);
          setError("");
        }
      } catch (e) {
        if (controlador.signal.aborted) return;

        setDatos(null);

        setError(
          e instanceof Error ? e.message : "No s'ha pogut carregar el partit.",
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
          setActualizando(false);
        }
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [torneoID, edicionID, partidoID, revision]);

  const rutaBase =
    `/perfil/voluntariat/${encodeURIComponent(torneoID)}` +
    `/${encodeURIComponent(edicionID)}`;

  const realtimeDisponible =
    realtimeDesignaciones === "CONECTADO" && realtimeActas === "CONECTADO";

  if (cargando) {
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center text-neutral">
        Carregant el partit...
      </div>
    );
  }

  if (!datos) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-bold text-neutral-titulos">
          No es pot consultar el partit
        </h1>

        <p role="alert" className="mt-3 text-sm text-neutral">
          {error}
        </p>

        <a
          href={`${rutaBase}/partits`}
          className={`${BTN} mt-5 bg-primary text-white`}
        >
          Tornar als partits
        </a>
      </section>
    );
  }

  const { partido, funciones, acta, permisos, accion } = datos;

  return (
    <div className="flex flex-col gap-5">
      <header className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">
              {partido.codigo ?? "Partit"}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-neutral-titulos">
              {partido.nombre || partido.codigo || "Partit"}
            </h1>

            <p className="mt-2 text-sm text-neutral">
              {datos.torneo?.nombre} · {datos.edicion.nombre}
            </p>
          </div>

          <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
            {partido.estado}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-2xl bg-background p-4">
          <p className="min-w-0 break-words text-center text-base font-bold text-neutral-titulos">
            {partido.local}
          </p>

          <span className="text-xs font-bold text-neutral">VS</span>

          <p className="min-w-0 break-words text-center text-base font-bold text-neutral-titulos">
            {partido.visitante}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-neutral">Data i hora</p>
            <p className="mt-1 font-semibold capitalize text-neutral-titulos">
              {fechaCatalan(partido.fechaHora)}
            </p>
          </div>

          <div>
            <p className="text-xs text-neutral">Pista</p>
            <p className="mt-1 font-semibold text-neutral-titulos">
              {partido.pista || "Per determinar"}
            </p>
          </div>

          <div>
            <p className="text-xs text-neutral">Fase / ronda</p>
            <p className="mt-1 font-semibold text-neutral-titulos">
              {[partido.fase, partido.ronda].filter(Boolean).join(" · ") ||
                (partido.jornada !== null
                  ? `Jornada ${partido.jornada}`
                  : "Per determinar")}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-base font-bold text-neutral-titulos">
          La meva designació
        </h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {funciones.map((funcion) => (
            <span
              key={funcion}
              className="rounded-lg bg-secondary/10 px-3 py-2 text-xs font-semibold text-secondary"
            >
              {funcion === "ARBITRE" ? "Àrbitre" : "Oficial de taula"}
            </span>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-neutral">
          Tant els àrbitres com els oficials de taula designats poden preparar
          l'acta si tenen una autorització vigent.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-neutral-titulos">
            Acta digital
          </h2>

          <span className="rounded-lg bg-background px-3 py-1.5 text-xs font-semibold text-neutral">
            {estadoActa(datos)}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-neutral">
          {!acta
            ? "L'acta d'aquest partit encara no s'ha iniciat."
            : permisos.esControlador
              ? "Actualment tens el control de l'acta."
              : permisos.hayOtroControlador
                ? "Un altre usuari té el control de l'acta."
                : "Pots consultar l'estat de l'acta."}
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          {accion.disponible ? (
            <a
              href={`${rutaBase}/actes/${encodeURIComponent(partidoID)}`}
              className={`${BTN} bg-primary text-white hover:opacity-90`}
            >
              {accion.texto}
            </a>
          ) : (
            <span
              aria-disabled="true"
              className={`${BTN} bg-neutral/10 text-neutral/60`}
            >
              {accion.texto}
            </span>
          )}

          <button
            type="button"
            onClick={actualizar}
            disabled={actualizando}
            className={`${BTN} border border-border text-neutral-titulos disabled:opacity-50`}
          >
            {actualizando ? "Actualitzant..." : "Actualitzar"}
          </button>
        </div>

        {permisos.bloqueadoControl && (
          <p className="mt-3 text-sm text-amber-700">
            El control d'aquesta acta està restringit.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral">
        <span>
          {realtimeDisponible
            ? "Actualització automàtica connectada"
            : "Actualització automàtica no disponible o parcial"}
        </span>

        <a
          href={`${rutaBase}/partits`}
          className="font-semibold text-primary hover:underline"
        >
          Tornar als meus partits
        </a>
      </div>
    </div>
  );
}
