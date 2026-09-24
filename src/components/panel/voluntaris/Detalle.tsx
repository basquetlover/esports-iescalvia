import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Cargando from "@components/Cargando";

type Curso = { curso: string; grupos: string[] };
type Tipo = { id: string; nombre: string };
type Voluntario = {
  id: string;
  formulario_id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  curso: string | null;
  grupo: string | null;
  genero: string | null;
  tipo_voluntariado: string | null;
  tipo_configuracion_id: string | null;
  descripcion: string | null;
  validacion_estado: string | null;
  plaza_estado: string | null;
  posicion_lista_espera: number | null;
  nota_admin: string | null;
  created_at: string;
  updated_at: string;
};
type Respuesta = {
  success: boolean;
  mensaje?: string;
  edicion: { id: string; nombre: string };
  formulario: {
    id: string;
    usuario_id: string | null;
    origen: string | null;
    estado: string;
    enviado_at: string | null;
    email_contacto: string | null;
  };
  voluntario: Voluntario;
  cursos: Curso[];
  tipos: Tipo[];
  capacidades: { editar: boolean; eliminar: boolean };
};
type Datos = {
  nombre: string;
  apellido1: string;
  apellido2: string;
  email: string;
  curso: string;
  grupo: string;
  tipo_voluntariado_id: string;
  descripcion: string;
  nota_admin: string;
};
type Props = {
  voluntarioID: string;
  torneoID: string;
  edicionID: string;
  volver: string;
};

function fecha(valor: string | null): string {
  if (!valor) return "—";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "—";
  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(fecha);
}

function etiqueta(estado: string): string {
  switch (estado) {
    case "APROBADO":
      return "Acceptada";
    case "DENEGADO":
      return "Denegada";
    case "EN_REVISION":
      return "En revisió";
    default:
      return estado || "Pendent";
  }
}

export default function Detalle({
  voluntarioID,
  torneoID,
  edicionID,
  volver,
}: Props) {
  const [respuesta, setRespuesta] = useState<Respuesta | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const contexto = useMemo(
    () => new URLSearchParams({ torneoID, edicionID }),
    [torneoID, edicionID],
  );
  const ruta = `/api/panell/voluntaris/${encodeURIComponent(voluntarioID)}?${contexto}`;

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);
      setError("");
      try {
        const respuestaHTTP = await fetch(ruta, {
          credentials: "same-origin",
          cache: "no-store",
          signal,
        });
        const contenido: Respuesta = await respuestaHTTP.json();
        if (!respuestaHTTP.ok || !contenido.success) {
          throw new Error(
            contenido.mensaje || "No s'ha pogut carregar la fitxa.",
          );
        }
        if (signal?.aborted) return;
        setRespuesta(contenido);
        const v = contenido.voluntario;
        setDatos({
          nombre: v.nombre ?? "",
          apellido1: v.apellido1 ?? "",
          apellido2: v.apellido2 ?? "",
          email: v.email ?? "",
          curso: v.curso ?? "",
          grupo: v.grupo ?? "",
          tipo_voluntariado_id: v.tipo_configuracion_id ?? "",
          descripcion: v.descripcion ?? "",
          nota_admin: v.nota_admin ?? "",
        });
      } catch (causa) {
        if (!signal?.aborted) {
          setError(
            causa instanceof Error
              ? causa.message
              : "No s'ha pogut carregar la fitxa.",
          );
        }
      } finally {
        if (!signal?.aborted) setCargando(false);
      }
    },
    [ruta],
  );

  useEffect(() => {
    const controlador = new AbortController();
    void cargar(controlador.signal);
    return () => controlador.abort();
  }, [cargar]);

  const cursos = respuesta?.cursos ?? [];
  const tipos = respuesta?.tipos ?? [];
  const cursoActual = datos?.curso ?? "";
  const grupoActual = datos?.grupo ?? "";
  const tipoActual = datos?.tipo_voluntariado_id ?? "";
  const grupos =
    cursos.find((curso) => curso.curso === cursoActual)?.grupos ?? [];
  const cursoHistorico = Boolean(
    cursoActual && !cursos.some((curso) => curso.curso === cursoActual),
  );
  const grupoHistorico = Boolean(grupoActual && !grupos.includes(grupoActual));
  const tipoHistorico = Boolean(
    tipoActual && !tipos.some((tipo) => tipo.id === tipoActual),
  );

  function cambiar(campo: keyof Datos, valor: string) {
    setDatos((actual) =>
      actual
        ? {
            ...actual,
            [campo]: valor,
            ...(campo === "curso" ? { grupo: "" } : {}),
          }
        : actual,
    );
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!datos || !respuesta?.capacidades.editar || procesando) return;
    setProcesando(true);
    setError("");
    setAviso("");
    try {
      const resultado = await fetch(ruta, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      const contenido = await resultado.json();
      if (!resultado.ok || !contenido.success) {
        throw new Error(
          contenido.mensaje || "No s'han pogut desar els canvis.",
        );
      }
      await cargar();
      setAviso("Els canvis s'han desat correctament.");
    } catch (causa) {
      setError(
        causa instanceof Error
          ? causa.message
          : "No s'han pogut desar els canvis.",
      );
    } finally {
      setProcesando(false);
    }
  }

  async function revisar(accion: "aceptar" | "rechazar") {
    if (!respuesta?.capacidades.editar || procesando) return;
    const nom = [respuesta.voluntario.nombre, respuesta.voluntario.apellido1]
      .filter(Boolean)
      .join(" ");
    const mensaje =
      accion === "aceptar"
        ? `Acceptar ${nom}? Tindrà accés de voluntariat a aquesta edició.`
        : `Denegar la sol·licitud de ${nom}? Perdrà l'accés a aquesta edició.`;
    if (!window.confirm(mensaje)) return;

    setProcesando(true);
    setError("");
    setAviso("");
    try {
      const resultado = await fetch("/api/panell/voluntaris", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ torneoID, edicionID, voluntarioID, accion }),
      });
      const contenido = await resultado.json();
      if (!resultado.ok || !contenido.success) {
        throw new Error(
          contenido.mensaje || "No s'ha pogut revisar la sol·licitud.",
        );
      }
      await cargar();
      setAviso(
        accion === "aceptar"
          ? "Voluntari acceptat en aquesta edició."
          : "Sol·licitud denegada.",
      );
    } catch (causa) {
      setError(
        causa instanceof Error
          ? causa.message
          : "No s'ha pogut revisar la sol·licitud.",
      );
    } finally {
      setProcesando(false);
    }
  }

  const camp =
    "mt-1 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-70";

  if (cargando && !respuesta) return <Cargando />;
  if (!respuesta || !datos)
    return (
      <p
        role="alert"
        className="rounded-xl border border-error/30 bg-error/10 p-5 text-sm text-error"
      >
        {error || "No s'ha trobat la fitxa."}
      </p>
    );

  const editable = respuesta.capacidades.editar;
  const estat = respostaEstado(respuesta.formulario.estado);

  return (
    <div className="space-y-6" aria-busy={cargando || procesando}>
      <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              {respuesta.edicion.nombre}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-neutral-titulos">
              {[
                respuesta.voluntario.nombre,
                respuesta.voluntario.apellido1,
                respuesta.voluntario.apellido2,
              ]
                .filter(Boolean)
                .join(" ")}
            </h2>
            <p className="mt-1 text-sm text-neutral">
              {respuesta.voluntario.tipo_voluntariado || "Tipus pendent"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
              {etiqueta(estat)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-neutral">
              {respuesta.formulario.origen === "ADMIN"
                ? "Creat des del panell"
                : "Inscripció web"}
            </span>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-border/50 pt-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-neutral">Sol·licitud enviada</dt>
            <dd className="mt-1 font-medium text-neutral-titulos">
              {fecha(respuesta.formulario.enviado_at)}
            </dd>
          </div>
          <div>
            <dt className="text-neutral">Estat de la plaça</dt>
            <dd className="mt-1 font-medium text-neutral-titulos">
              {respuesta.voluntario.plaza_estado ?? "Pendent"}
            </dd>
          </div>
          <div>
            <dt className="text-neutral">Compte vinculat</dt>
            <dd className="mt-1 break-all font-medium text-neutral-titulos">
              {respuesta.formulario.usuario_id ?? "No vinculat"}
            </dd>
          </div>
        </dl>
        {editable && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border/50 pt-5">
            {estat !== "APROBADO" && (
              <button
                type="button"
                disabled={procesando}
                onClick={() => void revisar("aceptar")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Acceptar
              </button>
            )}
            {estat !== "DENEGADO" && (
              <button
                type="button"
                disabled={procesando}
                onClick={() => void revisar("rechazar")}
                className="rounded-lg border border-error/40 px-4 py-2 text-sm font-semibold text-error disabled:opacity-50"
              >
                Denegar
              </button>
            )}
          </div>
        )}
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-error/10 p-4 text-sm text-error"
        >
          {error}
        </p>
      )}
      {aviso && (
        <p
          role="status"
          className="rounded-lg bg-primary/10 p-4 text-sm text-primary"
        >
          {aviso}
        </p>
      )}

      <form
        onSubmit={(e) => void guardar(e)}
        className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm md:p-6"
      >
        <h3 className="text-lg font-semibold text-neutral-titulos">
          Dades de la sol·licitud
        </h3>
        <p className="mt-1 text-sm text-neutral">
          Informació facilitada per la persona voluntària.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-neutral-titulos">
            Nom *
            <input
              required
              disabled={!editable}
              maxLength={100}
              value={datos.nombre}
              className={camp}
              onChange={(e) => cambiar("nombre", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-neutral-titulos">
            Primer llinatge *
            <input
              required
              disabled={!editable}
              maxLength={100}
              value={datos.apellido1}
              className={camp}
              onChange={(e) => cambiar("apellido1", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-neutral-titulos">
            Segon llinatge
            <input
              disabled={!editable}
              maxLength={100}
              value={datos.apellido2}
              className={camp}
              onChange={(e) => cambiar("apellido2", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-neutral-titulos">
            Correu de contacte *
            <input
              type="email"
              required
              disabled={!editable}
              maxLength={254}
              value={datos.email}
              className={camp}
              onChange={(e) => cambiar("email", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-neutral-titulos">
            Curs *
            <select
              required
              disabled={!editable}
              value={datos.curso}
              className={camp}
              onChange={(e) => cambiar("curso", e.target.value)}
            >
              <option value="">Selecciona un curs</option>
              {cursoHistorico && (
                <option value={datos.curso}>{datos.curso} (anterior)</option>
              )}
              {cursos.map((curso) => (
                <option key={curso.curso} value={curso.curso}>
                  {curso.curso}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-neutral-titulos">
            Grup *
            <select
              required
              disabled={!editable || !datos.curso}
              value={datos.grupo}
              className={camp}
              onChange={(e) => cambiar("grupo", e.target.value)}
            >
              <option value="">Selecciona un grup</option>
              {grupoHistorico && (
                <option value={datos.grupo}>{datos.grupo} (anterior)</option>
              )}
              {grupos.map((grupo) => (
                <option key={grupo} value={grupo}>
                  {grupo}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-neutral-titulos sm:col-span-2">
            Tipus de voluntariat *
            <select
              required
              disabled={!editable}
              value={datos.tipo_voluntariado_id}
              className={camp}
              onChange={(e) => cambiar("tipo_voluntariado_id", e.target.value)}
            >
              <option value="">Selecciona un tipus</option>
              {tipoHistorico && (
                <option value={datos.tipo_voluntariado_id}>
                  {respuesta.voluntario.tipo_voluntariado || "Tipus anterior"}{" "}
                  (anterior)
                </option>
              )}
              {tipos.map((tipo) => (
                <option key={tipo.id} value={tipo.id}>
                  {tipo.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-neutral-titulos sm:col-span-2">
            Presentació
            <textarea
              rows={5}
              disabled={!editable}
              maxLength={2000}
              value={datos.descripcion}
              className={camp}
              onChange={(e) => cambiar("descripcion", e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-neutral-titulos sm:col-span-2">
            Nota administrativa
            <textarea
              rows={3}
              disabled={!editable}
              maxLength={2000}
              value={datos.nota_admin}
              className={camp}
              onChange={(e) => cambiar("nota_admin", e.target.value)}
            />
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border/50 pt-5">
          <a
            href={volver}
            className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-neutral-titulos"
          >
            Tornar al llistat
          </a>
          {editable && (
            <button
              type="submit"
              disabled={procesando}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {procesando ? "Desant..." : "Desar canvis"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function respostaEstado(estado: string): string {
  return estado === "ACEPTADO" ? "APROBADO" : estado;
}
