import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Componente compartido por todas las actas (voleibol, fútbol, etc.).
// En pantalla sólo ocupa el botón; el resto se monta al abrirlo.
// API común: GET/POST/PATCH /api/panell/acta/informes.
// No consulta periódicamente el servidor ni utiliza Supabase desde React.

type VisibilidadInforme = "PUBLICO" | "INTERNO";
type MotivoInforme = "GENERAL" | "SUSPENSION";

type EquipoInforme = {
  id: string;
  nombre: string;
};

type Informe = {
  id: string;
  visibilidad: VisibilidadInforme;
  motivo: MotivoInforme;
  contenido: string;
  equipoResponsableID: string | null;
  equipoResponsableNombre?: string | null;
  autorNombre?: string | null;
  creadoAt: string;
};

type Props = {
  partidoID: string;
  controlToken?: string | null;
  editable?: boolean;
  equipos?: EquipoInforme[];
  tema?: "oscuro" | "claro";
  className?: string;
};

type PermisosInforme = {
  puedeCrear: boolean;
  puedeEditar: boolean;
  esAdministrador: boolean;
};

type RespuestaInformes = {
  success: true;
  informes: Informe[];
  permisos: PermisosInforme;
};

function fechaInforme(valor: string): string {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? "Data desconeguda"
    : fecha.toLocaleString("ca-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "S'ha produït un error inesperat.";
}

async function obtenerJSON(
  respuesta: Response,
): Promise<Record<string, unknown>> {
  const contenido: unknown = await respuesta.json().catch(() => null);
  if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) {
    throw new Error("El servidor no ha retornat una resposta vàlida.");
  }
  const registro = contenido as Record<string, unknown>;
  if (!respuesta.ok || registro.success !== true) {
    throw new Error(
      typeof registro.mensaje === "string"
        ? registro.mensaje
        : `No s'ha pogut completar l'operació (${respuesta.status}).`,
    );
  }
  return registro;
}

function esInforme(valor: unknown): valor is Informe {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
  const dato = valor as Partial<Informe>;
  return (
    typeof dato.id === "string" &&
    (dato.visibilidad === "PUBLICO" || dato.visibilidad === "INTERNO") &&
    (dato.motivo === "GENERAL" || dato.motivo === "SUSPENSION") &&
    typeof dato.contenido === "string" &&
    typeof dato.creadoAt === "string"
  );
}

export default function Informes({
  partidoID,
  controlToken = null,
  editable = false,
  equipos = [],
  tema = "oscuro",
  className,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [informes, setInformes] = useState<Informe[]>([]);
  // Los permisos provienen exclusivamente de GET /informes, no del prop editable.
  const [permisos, setPermisos] = useState<PermisosInforme | null>(null);
  const [informeEnEdicion, setInformeEnEdicion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [visibilidad, setVisibilidad] = useState<VisibilidadInforme>("INTERNO");
  const [motivo, setMotivo] = useState<MotivoInforme>("GENERAL");
  const [contenido, setContenido] = useState("");
  const [equipoResponsableID, setEquipoResponsableID] = useState("");
  const [mostrandoFormulario, setMostrandoFormulario] = useState(false);
  const [filtro, setFiltro] = useState<"TODOS" | VisibilidadInforme>("TODOS");
  const tituloID = useId();
  const descripcionID = useId();
  const solicitudRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const abrirRef = useRef<HTMLButtonElement | null>(null);
  const guardandoRef = useRef(false);
  guardandoRef.current = guardando;

  // Administradores: permiso para crear y editar con el partido cerrado
  // y sin token. Operadores: solo crean mientras controlan el acta.
  // El servidor vuelve a comprobar todo en cada POST/PATCH.
  const puedeCrear = Boolean(
    permisos?.puedeCrear &&
    (permisos.esAdministrador || (editable && controlToken)),
  );
  const puedeEditar = permisos?.puedeEditar === true;

  function limpiarFormulario() {
    setInformeEnEdicion(null);
    setVisibilidad("INTERNO");
    setMotivo("GENERAL");
    setContenido("");
    setEquipoResponsableID("");
    setMostrandoFormulario(false);
  }

  function nuevoInforme() {
    limpiarFormulario();
    setMostrandoFormulario(true);
    setError(null);
    setAviso(null);
  }

  function editarInforme(informe: Informe) {
    if (!puedeEditar || guardando) return;
    setInformeEnEdicion(informe.id);
    setVisibilidad(informe.visibilidad);
    setMotivo(informe.motivo);
    setContenido(informe.contenido);
    setEquipoResponsableID(informe.equipoResponsableID ?? "");
    setMostrandoFormulario(true);
    setError(null);
    setAviso(null);
  }

  const cargarInformes = useCallback(async () => {
    solicitudRef.current?.abort();
    const controlador = new AbortController();
    solicitudRef.current = controlador;
    setCargando(true);
    setPermisos(null);
    setError(null);
    try {
      const respuesta = await fetch(
        `/api/panell/acta/informes?partidoID=${encodeURIComponent(partidoID)}`,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        },
      );
      const datos = (await obtenerJSON(
        respuesta,
      )) as unknown as RespuestaInformes;
      if (!Array.isArray(datos.informes)) {
        throw new Error("La llista d'informes rebuda no és vàlida.");
      }
      const p = datos.permisos;
      if (
        !p ||
        typeof p.puedeCrear !== "boolean" ||
        typeof p.puedeEditar !== "boolean" ||
        typeof p.esAdministrador !== "boolean"
      ) {
        throw new Error(
          "El servidor no ha retornat els permisos dels informes.",
        );
      }
      if (!controlador.signal.aborted) {
        setInformes(datos.informes.filter(esInforme));
        setPermisos(p);
      }
    } catch (fallo) {
      if (!controlador.signal.aborted) setError(mensajeError(fallo));
    } finally {
      if (!controlador.signal.aborted) setCargando(false);
    }
  }, [partidoID]);

  useEffect(() => {
    if (!abierto) return;
    void cargarInformes();
    return () => solicitudRef.current?.abort();
  }, [abierto, cargarInformes]);

  useEffect(() => {
    if (!abierto) return;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape" && !guardandoRef.current) setAbierto(false);
    };
    window.addEventListener("keydown", alPulsar);
    modalRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", alPulsar);
      document.body.style.overflow = overflowAnterior;
      abrirRef.current?.focus();
    };
  }, [abierto]);

  async function guardarInforme(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (guardando) return;
    if (informeEnEdicion ? !puedeEditar : !puedeCrear) {
      setError("No tens permís per fer aquesta operació.");
      return;
    }
    const texto = contenido.trim();
    if (!texto) {
      setError("Escriu el contingut de l'informe.");
      return;
    }
    if (motivo === "SUSPENSION" && !equipoResponsableID) {
      setError("Selecciona l'equip responsable de la suspensió.");
      return;
    }

    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const editando = informeEnEdicion !== null;
      const respuesta = await fetch("/api/panell/acta/informes", {
        method: editando ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoID,
          // PATCH no requiere token; en POST los administradores tampoco.
          controlToken: permisos?.esAdministrador ? null : controlToken,
          ...(editando ? { informeID: informeEnEdicion } : {}),
          visibilidad,
          motivo,
          contenido: texto,
          equipoResponsableID:
            motivo === "SUSPENSION" ? equipoResponsableID : null,
        }),
      });
      const datos = await obtenerJSON(respuesta);
      if (!esInforme(datos.informe)) {
        throw new Error("El servidor no ha confirmat correctament l'informe.");
      }
      // Mostramos la confirmación inmediatamente sin esperar un nuevo GET.
      const guardado = datos.informe;
      setInformes((actuales) => {
        if (editando) {
          return actuales.map((item) =>
            item.id === guardado.id ? guardado : item,
          );
        }
        return [guardado, ...actuales];
      });
      limpiarFormulario();
      setAviso(
        editando
          ? "Informe actualitzat correctament."
          : "Informe desat correctament.",
      );
    } catch (fallo) {
      // Conservamos el borrador para que no se pierda tras un error.
      setError(mensajeError(fallo));
    } finally {
      setGuardando(false);
    }
  }

  const visibles = informes.filter(
    (informe) => filtro === "TODOS" || informe.visibilidad === filtro,
  );

  return (
    <>
      <button
        ref={abrirRef}
        type="button"
        onClick={() => {
          setAbierto(true);
          limpiarFormulario();
          setAviso(null);
          setError(null);
        }}
        className={
          className ??
          (tema === "oscuro"
            ? "flex min-h-[77px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-[#5b869d] bg-[linear-gradient(#183b4c,#092332)] text-xs font-extrabold text-[#f2f8fb] transition hover:border-[#16d6c1] hover:bg-[#154457] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd13a] max-[560px]:p-1 max-[560px]:text-[10px] [@media(max-height:750px)_and_(min-width:901px)]:min-h-[58px]"
            : "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary")
        }
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-label="Obrir informes del partit"
      >
        <svg
          width="25"
          height="25"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-[25px] w-[25px] shrink-0"
        >
          <path d="M7 43h34M12 36V22h6v14m5 0V12h7v24m5 0V5h6v31" />
        </svg>
        Informes
      </button>

      {abierto &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[2147483646] flex items-center justify-center overflow-y-auto bg-[#00111f]/90 p-3 backdrop-blur-sm sm:p-5"
            onMouseDown={(evento) => {
              if (evento.target === evento.currentTarget && !guardando) {
                setAbierto(false);
              }
            }}
          >
            <div
              ref={modalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby={tituloID}
              aria-describedby={descripcionID}
              className="my-auto flex max-h-[min(92dvh,900px)] w-full max-w-[700px] flex-col overflow-hidden rounded-[20px] border border-[#378e95] bg-[linear-gradient(155deg,#0b3042,#061b2b)] text-[#f5fcff] shadow-[0_22px_80px_#000c] focus:outline-none"
            >
              <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#326174] px-4 py-4 sm:px-6">
                <div>
                  <h2 id={tituloID} className="text-xl font-black sm:text-2xl">
                    Informes del partit
                  </h2>
                  <p id={descripcionID} className="mt-1 text-sm text-[#a9c6d4]">
                    Informes públics i interns, disponibles a totes les actes.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setAbierto(false)}
                  aria-label="Tancar informes"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[#507b8d] bg-[#173b4d] hover:bg-[#27556b] disabled:opacity-50"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    aria-hidden="true"
                  >
                    <path d="M5 5 19 19M19 5 5 19" />
                  </svg>
                </button>
              </header>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Filtrar informes"
                  >
                    {(["TODOS", "PUBLICO", "INTERNO"] as const).map(
                      (opcion) => (
                        <button
                          key={opcion}
                          type="button"
                          aria-pressed={filtro === opcion}
                          onClick={() => setFiltro(opcion)}
                          className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                            filtro === opcion
                              ? "border-[#16d6c1] bg-[#005f63] text-[#e5fffa]"
                              : "border-[#426f81] bg-[#092536] text-[#c2d9e2] hover:border-[#16d6c1]"
                          }`}
                        >
                          {opcion === "TODOS"
                            ? "Tots"
                            : opcion === "PUBLICO"
                              ? "Públics"
                              : "Interns"}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void cargarInformes()}
                    disabled={cargando || guardando}
                    className="rounded-lg border border-[#426f81] bg-[#143748] px-3 py-2 text-xs font-bold hover:border-[#16d6c1] disabled:opacity-50"
                  >
                    Actualitzar
                  </button>
                </div>

                {error && (
                  <div
                    role="alert"
                    className="rounded-lg border border-[#cd6372] bg-[#57242d] p-3 text-sm text-[#ffdee1]"
                  >
                    {error}
                  </div>
                )}
                {aviso && (
                  <p
                    role="status"
                    className="rounded-lg border border-[#16bfa9] bg-[#07483e] p-3 text-sm text-[#baffeb]"
                  >
                    {aviso}
                  </p>
                )}

                {cargando ? (
                  <p className="py-8 text-center text-sm text-[#a9c6d4]">
                    Carregant informes...
                  </p>
                ) : visibles.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#426f81] px-3 py-8 text-center text-sm text-[#a9c6d4]">
                    No hi ha informes per mostrar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {visibles.map((informe) => (
                      <article
                        key={informe.id}
                        className="rounded-xl border border-[#315c70] bg-[#0c2738] p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                              informe.visibilidad === "PUBLICO"
                                ? "border-[#17c7aa] bg-[#08483f] text-[#9dffe9]"
                                : "border-[#b5a262] bg-[#453819] text-[#ffedb2]"
                            }`}
                          >
                            {informe.visibilidad === "PUBLICO"
                              ? "Públic"
                              : "Intern"}
                          </span>
                          <span className="text-xs font-bold text-[#dbeaf1]">
                            {informe.motivo === "SUSPENSION"
                              ? "Suspensió"
                              : "Informe general"}
                          </span>
                          <time
                            className="ml-auto text-xs text-[#9cbaca]"
                            dateTime={informe.creadoAt}
                          >
                            {fechaInforme(informe.creadoAt)}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#ecf5fa]">
                          {informe.contenido}
                        </p>
                        {(informe.equipoResponsableNombre ||
                          informe.autorNombre) && (
                          <p className="mt-2 text-xs text-[#9cbaca]">
                            {informe.equipoResponsableNombre
                              ? `Equip responsable: ${informe.equipoResponsableNombre}`
                              : ""}
                            {informe.equipoResponsableNombre &&
                            informe.autorNombre
                              ? " · "
                              : ""}
                            {informe.autorNombre
                              ? `Autor: ${informe.autorNombre}`
                              : ""}
                          </p>
                        )}
                        {puedeEditar && !mostrandoFormulario && (
                          <div className="mt-3 flex justify-end">
                            <button
                              type="button"
                              disabled={guardando || cargando}
                              onClick={() => editarInforme(informe)}
                              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#6fa8ac] bg-[#164456] px-3 py-2 text-xs font-bold text-[#e5ffff] transition hover:border-[#16d6c1] hover:bg-[#1d5869] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                aria-hidden="true"
                                className="h-4 w-4"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"
                                />
                              </svg>
                              Editar
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {mostrandoFormulario && (
                  <form
                    onSubmit={(evento) => void guardarInforme(evento)}
                    className="space-y-4 rounded-xl border border-[#378e95] bg-[#092c3e] p-4"
                  >
                    <h3 className="text-base font-black">
                      {informeEnEdicion
                        ? "Editar informe"
                        : "Redactar un informe"}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block text-sm font-bold">
                        Visibilitat
                        <select
                          value={visibilidad}
                          onChange={(evento) =>
                            setVisibilidad(
                              evento.target.value as VisibilidadInforme,
                            )
                          }
                          disabled={guardando}
                          className="mt-1 block w-full rounded-lg border border-[#5d8494] bg-[#071a28] p-3 text-white"
                        >
                          <option value="INTERNO">Informe intern</option>
                          <option value="PUBLICO">Informe públic</option>
                        </select>
                      </label>
                      <label className="block text-sm font-bold">
                        Motiu
                        <select
                          value={motivo}
                          onChange={(evento) =>
                            setMotivo(evento.target.value as MotivoInforme)
                          }
                          disabled={guardando}
                          className="mt-1 block w-full rounded-lg border border-[#5d8494] bg-[#071a28] p-3 text-white"
                        >
                          <option value="GENERAL">General</option>
                          <option value="SUSPENSION">Suspensió</option>
                        </select>
                      </label>
                    </div>
                    {motivo === "SUSPENSION" && (
                      <label className="block text-sm font-bold">
                        Equip responsable
                        <select
                          required
                          value={equipoResponsableID}
                          onChange={(evento) =>
                            setEquipoResponsableID(evento.target.value)
                          }
                          disabled={guardando}
                          className="mt-1 block w-full rounded-lg border border-[#5d8494] bg-[#071a28] p-3 text-white"
                        >
                          <option value="">Selecciona un equip</option>
                          {equipos.map((equipo) => (
                            <option key={equipo.id} value={equipo.id}>
                              {equipo.nombre}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label className="block text-sm font-bold">
                      Contingut de l'informe
                      <textarea
                        required
                        maxLength={3000}
                        rows={5}
                        value={contenido}
                        onChange={(evento) => setContenido(evento.target.value)}
                        disabled={guardando}
                        placeholder="Descriu els fets..."
                        className="mt-1 block w-full resize-y rounded-lg border border-[#5d8494] bg-[#071a28] p-3 text-white placeholder:text-[#80a1b2]"
                      />
                    </label>
                    <p className="text-xs text-[#9cbaca]">
                      {visibilidad === "PUBLICO"
                        ? "Aquest informe podrà mostrar-se a la consulta pública del partit."
                        : "Aquest informe només podrà consultar-se amb els permisos interns corresponents."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={
                          guardando ||
                          (informeEnEdicion ? !puedeEditar : !puedeCrear) ||
                          !contenido.trim() ||
                          (motivo === "SUSPENSION" && !equipoResponsableID)
                        }
                        className="rounded-lg border border-[#20cdc0] bg-[#009d95] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#00b4aa] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {guardando
                          ? "Desant..."
                          : informeEnEdicion
                            ? "Guardar canvis"
                            : "Desar informe"}
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={limpiarFormulario}
                        className="rounded-lg border border-[#517d8d] bg-[#183a4d] px-4 py-2.5 text-sm font-bold hover:bg-[#27556b] disabled:opacity-45"
                      >
                        Cancel·lar
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#326174] px-4 py-3 sm:px-6">
                {!mostrandoFormulario && puedeCrear ? (
                  <button
                    type="button"
                    disabled={cargando || guardando}
                    onClick={nuevoInforme}
                    className="rounded-lg border border-[#20cdc0] bg-[#009d95] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#00b4aa] disabled:opacity-50"
                  >
                    + Nou informe
                  </button>
                ) : (
                  <span className="text-xs text-[#9cbaca]">
                    {!mostrandoFormulario &&
                    !cargando &&
                    permisos &&
                    !puedeCrear
                      ? "Mode consulta"
                      : permisos?.esAdministrador
                        ? "Administració d'informes"
                        : ""}
                  </span>
                )}
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => setAbierto(false)}
                  className="rounded-lg border border-[#517d8d] bg-[#183a4d] px-4 py-2.5 text-sm font-bold hover:bg-[#27556b] disabled:opacity-45"
                >
                  Tancar
                </button>
              </footer>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
