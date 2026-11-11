import { useCallback, useEffect, useMemo, useState } from "react";

import { useRealtimeBroadcast } from "@components/realtime/SupabaseRealtime";

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;
  edicionID: string;

  // Compatibilidad con el Gestor anterior.
  // Ya no se utilizan estas propiedades.
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type Usuario = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
};

type FiltroEstado =
  | "TODOS"
  | "DISPONIBLE"
  | "CONTROLADA"
  | "EN_SUPERVISION"
  | "EN_REVISION"
  | "BLOQUEADA";

type FiltroControlador =
  | "TODOS"
  | "CON_CONTROLADOR"
  | "SIN_CONTROLADOR"
  | "CONTROL_PROPIO";

type Orden = "ACTUALIZACION" | "FECHA" | "CODIGO";

type Acta = {
  id: string;
  partidoID: string;

  estado: string;
  estadoOperativo: string | null;

  iniciadaAt: string | null;
  actualizadaAt: string | null;
  version: number;

  controlador: Usuario | null;
  operador: Usuario | null;

  esControlador: boolean;
  tieneControlador: boolean;

  partido: {
    id: string;
    codigo: string;
    nombre: string | null;
    estado: string;

    fechaHora: string | null;
    pista: string | null;

    fase: string | null;
    ronda: string | null;

    equipos: {
      local: string | null;
      visitante: string | null;
    };
  };
};

type Permisos = {
  ver: boolean;
  supervisar: boolean;
  controlar: boolean;
  transferirControl: boolean;
  bloquear: boolean;
  desbloquear: boolean;
  expulsar: boolean;
  revisar: boolean;
  autorizarRevision: boolean;
  cerrarRevision: boolean;
  verAuditoria: boolean;
  operacionesDisponibles: boolean;
};

type RespuestaAPI = {
  success: true;
  actas: Acta[];
  total: number;
  limiteAlcanzado: boolean;
  permisos: Permisos;
};

// ============================================================
// ESTILOS
// ============================================================

const TARJETA = "rounded-2xl border border-border bg-card shadow-sm";

const CAMPO =
  "min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

const BOTON =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50";

const BOTON_PRIMARIO =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90";

// ============================================================
// UTILIDADES
// ============================================================

function nombreUsuario(usuario: Usuario | null): string {
  if (!usuario) {
    return "Sense controlador";
  }

  return (
    [usuario.nombre, usuario.apellido1, usuario.apellido2]
      .filter(Boolean)
      .join(" ")
      .trim() || "Usuari sense nom"
  );
}

function formatearFecha(valor: string | null): string {
  if (!valor) {
    return "Data pendent";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Data pendent";
  }

  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(fecha);
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function estadoActa(acta: Acta): string {
  if (acta.estado === "BLOQUEADA" || acta.estadoOperativo === "BLOQUEADA") {
    return "BLOQUEADA";
  }

  return acta.estadoOperativo ?? "DISPONIBLE";
}

function nombreEstado(estado: string): string {
  const estados: Record<string, string> = {
    DISPONIBLE: "Disponible",
    CONTROLADA: "Controlada",
    EN_SUPERVISION: "En supervisió",
    EN_REVISION: "En revisió",
    BLOQUEADA: "Bloquejada",
    EN_CURSO: "En curs",
    FINALIZADA: "Finalitzada",
  };

  return estados[estado] ?? estado;
}

function colorEstado(estado: string): string {
  switch (estado) {
    case "CONTROLADA":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "EN_SUPERVISION":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";

    case "EN_REVISION":
      return "bg-violet-500/10 text-violet-700 dark:text-violet-300";

    case "BLOQUEADA":
      return "bg-red-500/10 text-red-700 dark:text-red-300";

    default:
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  }
}

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "S'ha produït un error inesperat.";
}

function enlaceActa(acta: Acta, torneoID: string, edicionID: string): string {
  const query = new URLSearchParams({
    torneoID,
    edicionID,
  });

  return (
    `/panell/partits/${encodeURIComponent(acta.partidoID)}` +
    `/acta?${query.toString()}`
  );
}

// ============================================================
// RESPUESTA DE LA API
// ============================================================

async function leerRespuesta(respuesta: Response): Promise<RespuestaAPI> {
  const contenido: unknown = await respuesta.json().catch(() => null);

  if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) {
    throw new Error("La resposta del servidor no és vàlida.");
  }

  const datos = contenido as Record<string, unknown>;

  if (!respuesta.ok || datos.success !== true) {
    throw new Error(
      typeof datos.mensaje === "string"
        ? datos.mensaje
        : "No s'han pogut carregar les actes.",
    );
  }

  if (!Array.isArray(datos.actas)) {
    throw new Error("L'API no retorna el llistat d'actes.");
  }

  return datos as RespuestaAPI;
}

// ============================================================
// ICONOS
// ============================================================

type TipoIcono = "acta" | "buscar" | "usuario" | "reloj" | "abrir";

function Icono({
  tipo,
  className = "h-5 w-5",
}: {
  tipo: TipoIcono;
  className?: string;
}) {
  const trazos = {
    acta: (
      <>
        <path d="M6 3h9l4 4v14H6z" />
        <path d="M15 3v5h4M9 12h7M9 16h7" />
      </>
    ),

    buscar: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m16 16 4 4" />
      </>
    ),

    usuario: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),

    reloj: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),

    abrir: (
      <>
        <path d="M14 4h6v6" />
        <path d="m20 4-9 9" />
        <path d="M20 14v6H4V4h6" />
      </>
    ),
  };

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
      {trazos[tipo]}
    </svg>
  );
}

// ============================================================
// ESTADÍSTICAS
// ============================================================

function Estadistica({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className={`${TARJETA} p-4`}>
      <p className="text-xs text-neutral">{titulo}</p>

      <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-titulos">
        {valor}
      </p>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function ActesActives({ torneoID, edicionID }: Props) {
  // ==========================================================
  // ESTADO
  // ==========================================================

  const [actas, setActas] = useState<Acta[]>([]);

  const [permisos, setPermisos] = useState<Permisos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [actualizando, setActualizando] = useState(false);

  const [error, setError] = useState("");

  const [limiteAlcanzado, setLimiteAlcanzado] = useState(false);

  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(
    null,
  );

  // ==========================================================
  // CONTROL DE RECARGAS
  // ==========================================================

  /*
   * La primera consulta ocurre al montar
   * el componente.
   *
   * Posteriormente solo se modifica esta
   * versión al recibir un aviso Realtime.
   *
   * No hay intervalos, polling ni recargas
   * automáticas por foco o reconexión.
   */

  const [versionRealtime, setVersionRealtime] = useState(0);

  const recargarDesdeRealtime = useCallback(() => {
    setVersionRealtime((actual) => actual + 1);
  }, []);

  // ==========================================================
  // REALTIME CENTRALIZADO
  // ==========================================================

  /*
   * El hook utiliza el cliente compartido
   * de SupabaseRealtime.tsx.
   *
   * Aquí no se configuran credenciales
   * ni se crea ningún cliente Supabase.
   *
   * Escucha solamente el canal de esta
   * edición.
   */

  const estadoRealtime = useRealtimeBroadcast({
    canal: `actes-actives-edicio-${edicionID}`,
    evento: "actualitzada",
    onCambio: recargarDesdeRealtime,
  });

  // ==========================================================
  // CARGA INICIAL Y EVENTOS REALTIME
  // ==========================================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarActas() {
      setActualizando(true);
      setError("");

      try {
        const query = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(`/api/panell/acta/actives?${query}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        });

        const datos = await leerRespuesta(respuesta);

        if (controlador.signal.aborted) {
          return;
        }

        setActas(datos.actas);
        setPermisos(datos.permisos);

        setLimiteAlcanzado(datos.limiteAlcanzado === true);

        setUltimaActualizacion(new Date());
      } catch (error) {
        if (controlador.signal.aborted) {
          return;
        }

        setError(mensajeError(error));
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
          setActualizando(false);
        }
      }
    }

    void cargarActas();

    return () => {
      controlador.abort();
    };
  }, [torneoID, edicionID, versionRealtime]);

  // ==========================================================
  // FILTROS
  // ==========================================================

  const [busqueda, setBusqueda] = useState("");

  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("TODOS");

  const [filtroControlador, setFiltroControlador] =
    useState<FiltroControlador>("TODOS");

  const [orden, setOrden] = useState<Orden>("ACTUALIZACION");

  // ==========================================================
  // FILTRADO Y ORDENACIÓN LOCAL
  // ==========================================================

  /*
   * Los filtros no consultan la API.
   * Se aplican a los datos ya cargados.
   */

  const actasVisibles = useMemo(() => {
    const texto = normalizar(busqueda);

    const resultado = actas.filter((acta) => {
      if (filtroEstado !== "TODOS" && estadoActa(acta) !== filtroEstado) {
        return false;
      }

      if (filtroControlador === "CON_CONTROLADOR" && !acta.tieneControlador) {
        return false;
      }

      if (filtroControlador === "SIN_CONTROLADOR" && acta.tieneControlador) {
        return false;
      }

      if (filtroControlador === "CONTROL_PROPIO" && !acta.esControlador) {
        return false;
      }

      if (!texto) {
        return true;
      }

      const contenido = [
        acta.partido.codigo,
        acta.partido.nombre,
        acta.partido.pista,
        acta.partido.fase,
        acta.partido.ronda,
        acta.partido.equipos.local,
        acta.partido.equipos.visitante,
        nombreUsuario(acta.controlador),
        nombreUsuario(acta.operador),
      ]
        .filter(Boolean)
        .join(" ");

      return normalizar(contenido).includes(texto);
    });

    if (orden === "FECHA") {
      resultado.sort((a, b) =>
        (a.partido.fechaHora ?? "9999").localeCompare(
          b.partido.fechaHora ?? "9999",
        ),
      );
    } else if (orden === "CODIGO") {
      resultado.sort((a, b) =>
        a.partido.codigo.localeCompare(b.partido.codigo, "ca", {
          numeric: true,
        }),
      );
    } else {
      resultado.sort((a, b) =>
        (b.actualizadaAt ?? "").localeCompare(a.actualizadaAt ?? ""),
      );
    }

    return resultado;
  }, [actas, busqueda, filtroEstado, filtroControlador, orden]);

  // ==========================================================
  // ESTADÍSTICAS
  // ==========================================================

  const estadisticas = useMemo(
    () => ({
      total: actas.length,

      controladas: actas.filter((acta) => estadoActa(acta) === "CONTROLADA")
        .length,

      bloqueadas: actas.filter((acta) => estadoActa(acta) === "BLOQUEADA")
        .length,

      revision: actas.filter(
        (acta) =>
          estadoActa(acta) === "EN_REVISION" ||
          estadoActa(acta) === "EN_SUPERVISION",
      ).length,
    }),
    [actas],
  );

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div className="w-full min-w-0 space-y-5">
      {/* =====================================================
          CABECERA
          ===================================================== */}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icono tipo="acta" className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-neutral-titulos sm:text-2xl">
              Actes en actiu
            </h2>

            <p className="mt-1 text-xs text-neutral">
              Supervisió en temps real
            </p>
          </div>
        </div>
      </header>

      {/* =====================================================
          CONEXIÓN REALTIME
          ===================================================== */}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
              estadoRealtime === "CONECTADO"
                ? "bg-emerald-500"
                : estadoRealtime === "CONECTANDO"
                  ? "bg-amber-500"
                  : "bg-red-500"
            }`}
          />

          <span className="text-xs font-semibold text-neutral-titulos">
            {estadoRealtime === "CONECTADO"
              ? "Escoltant avisos Realtime"
              : estadoRealtime === "CONECTANDO"
                ? "Connectant Realtime..."
                : estadoRealtime === "SIN_CONFIGURACION"
                  ? "Realtime sense configurar"
                  : "Realtime desconnectat"}
          </span>

          {actualizando && !cargando && (
            <span className="text-xs text-neutral">
              · Actualitzant dades...
            </span>
          )}
        </div>

        <span className="text-xs text-neutral">
          {ultimaActualizacion
            ? `Última càrrega: ${ultimaActualizacion.toLocaleTimeString(
                "ca-ES",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                },
              )}`
            : "Sense dades carregades"}
        </span>
      </section>

      {/* =====================================================
          ESTADÍSTICAS
          ===================================================== */}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Estadistica titulo="Actes obertes" valor={estadisticas.total} />

        <Estadistica titulo="Controlades" valor={estadisticas.controladas} />

        <Estadistica titulo="Bloquejades" valor={estadisticas.bloqueadas} />

        <Estadistica
          titulo="Supervisió / revisió"
          valor={estadisticas.revision}
        />
      </section>

      {/* =====================================================
          ERRORES
          ===================================================== */}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-300/50 bg-red-500/5 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {limiteAlcanzado && (
        <div
          role="status"
          className="rounded-xl border border-amber-300/50 bg-amber-500/5 p-4 text-sm text-amber-700"
        >
          El llistat ha arribat al límit de consulta. Pot haver-hi més actes.
        </div>
      )}

      {/* =====================================================
          FILTROS
          ===================================================== */}

      <section className={`${TARJETA} p-4`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* BUSCADOR */}

          <div>
            <label
              htmlFor="cerca-actes"
              className="mb-1.5 block text-xs font-semibold text-neutral"
            >
              Cercar
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral">
                <Icono tipo="buscar" className="h-4 w-4" />
              </span>

              <input
                id="cerca-actes"
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Partit, equip, controlador..."
                className={`${CAMPO} pl-10`}
              />
            </div>
          </div>

          {/* FILTRO ESTADO */}

          <div>
            <label
              htmlFor="estat-actes"
              className="mb-1.5 block text-xs font-semibold text-neutral"
            >
              Estat de l'acta
            </label>

            <select
              id="estat-actes"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
              className={CAMPO}
            >
              <option value="TODOS">Tots els estats</option>

              <option value="DISPONIBLE">Disponibles</option>

              <option value="CONTROLADA">Controlades</option>

              <option value="EN_SUPERVISION">En supervisió</option>

              <option value="EN_REVISION">En revisió</option>

              <option value="BLOQUEADA">Bloquejades</option>
            </select>
          </div>

          {/* FILTRO CONTROLADOR */}

          <div>
            <label
              htmlFor="controlador-actes"
              className="mb-1.5 block text-xs font-semibold text-neutral"
            >
              Controlador
            </label>

            <select
              id="controlador-actes"
              value={filtroControlador}
              onChange={(e) =>
                setFiltroControlador(e.target.value as FiltroControlador)
              }
              className={CAMPO}
            >
              <option value="TODOS">Totes les actes</option>

              <option value="CON_CONTROLADOR">Amb controlador</option>

              <option value="SIN_CONTROLADOR">Sense controlador</option>

              <option value="CONTROL_PROPIO">Amb el meu control</option>
            </select>
          </div>

          {/* ORDENACIÓN */}

          <div>
            <label
              htmlFor="ordre-actes"
              className="mb-1.5 block text-xs font-semibold text-neutral"
            >
              Ordenació
            </label>

            <select
              id="ordre-actes"
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className={CAMPO}
            >
              <option value="ACTUALIZACION">Última actualització</option>

              <option value="FECHA">Data del partit</option>

              <option value="CODIGO">Codi del partit</option>
            </select>
          </div>
        </div>
      </section>

      {/* =====================================================
          LISTADO
          ===================================================== */}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-neutral-titulos">
            Actes de l'edició
          </h3>

          <span className="text-xs text-neutral">
            {actasVisibles.length} resultats
          </span>
        </div>

        {/* CARGANDO */}

        {cargando && (
          <div
            role="status"
            className={`${TARJETA} p-10 text-center text-sm text-neutral`}
          >
            Carregant les actes...
          </div>
        )}

        {/* SIN RESULTADOS */}

        {!cargando && actasVisibles.length === 0 && (
          <div className={`${TARJETA} p-10 text-center`}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icono tipo="acta" className="h-7 w-7" />
            </div>

            <h3 className="mt-4 text-base font-bold text-neutral-titulos">
              No hi ha actes per mostrar
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm text-neutral">
              Quan s'iniciï una acta i es rebi l'avís Realtime corresponent,
              apareixerà automàticament.
            </p>
          </div>
        )}

        {/* ACTAS */}

        {!cargando &&
          actasVisibles.map((acta) => {
            const estado = estadoActa(acta);

            return (
              <article key={acta.id} className={`${TARJETA} overflow-hidden`}>
                <div className="p-4 sm:p-5">
                  {/* CABECERA */}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">
                        {acta.partido.codigo}
                      </span>

                      <span
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${colorEstado(estado)}`}
                      >
                        {nombreEstado(estado)}
                      </span>
                    </div>

                    {acta.esControlador && (
                      <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                        Tens el control
                      </span>
                    )}
                  </div>

                  {/* INFORMACIÓN */}

                  <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.55fr)]">
                    {/* PARTIDO */}

                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-neutral-titulos sm:text-lg">
                        {acta.partido.nombre || acta.partido.codigo}
                      </h4>

                      <p className="mt-1 text-sm font-medium text-neutral-titulos">
                        {acta.partido.equipos.local ?? "Equip local pendent"}
                        {" — "}
                        {acta.partido.equipos.visitante ??
                          "Equip visitant pendent"}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-neutral">
                        <span>{formatearFecha(acta.partido.fechaHora)}</span>

                        <span>{acta.partido.pista || "Pista pendent"}</span>

                        {acta.partido.fase && <span>{acta.partido.fase}</span>}

                        {acta.partido.ronda && (
                          <span>{acta.partido.ronda}</span>
                        )}
                      </div>
                    </div>

                    {/* CONTROLADOR */}

                    <div className="rounded-xl border border-border bg-background p-3">
                      <div className="flex items-center gap-2 text-neutral">
                        <Icono tipo="usuario" className="h-4 w-4" />

                        <span className="text-xs font-semibold">
                          Controlador actual
                        </span>
                      </div>

                      <p className="mt-2 text-sm font-bold text-neutral-titulos">
                        {nombreUsuario(acta.controlador)}
                      </p>

                      <div className="mt-3 flex items-center gap-2 text-xs text-neutral">
                        <Icono tipo="reloj" className="h-4 w-4" />

                        <span>
                          {acta.actualizadaAt
                            ? `Actualitzada: ${formatearFecha(acta.actualizadaAt)}`
                            : "Sense actualitzacions"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACCIONES */}

                <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background/50 p-3 sm:px-5">
                  <a
                    href={enlaceActa(acta, torneoID, edicionID)}
                    className={BOTON_PRIMARIO}
                  >
                    <Icono tipo="abrir" className="h-4 w-4" />
                    Obrir acta
                  </a>

                  {permisos?.bloquear && (
                    <button
                      type="button"
                      disabled
                      title="Pendent de l'API de bloqueig segur"
                      className={BOTON}
                    >
                      Bloquejar
                    </button>
                  )}

                  {permisos?.revisar && (
                    <button
                      type="button"
                      disabled
                      title="Pendent de l'API de revisió"
                      className={BOTON}
                    >
                      Revisar
                    </button>
                  )}

                  {(permisos?.controlar || permisos?.transferirControl) && (
                    <button
                      type="button"
                      disabled
                      title="Pendent de l'API de gestió del control"
                      className={BOTON}
                    >
                      Agafar el control
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </section>

      {/* INFORMACIÓN */}

      <p className="text-xs leading-5 text-neutral">
        La llista es carrega inicialment i després només s'actualitza quan es
        rep un avís Realtime. No es fan consultes periòdiques.
      </p>
    </div>
  );
}
