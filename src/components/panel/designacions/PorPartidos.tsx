import { useEffect, useMemo, useState } from "react";

import type {
  PropsVista,
  Persona,
  Partido,
  Designacion,
  Funcion,
} from "./Gestor";

import { nombrePersona, formatoPartido, formatearFecha } from "./Gestor";

// ============================================================
// ESTILOS
// ============================================================

const TARJETA =
  "min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

const CAMPO =
  "w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

const BOTON =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50";

// ============================================================
// FUNCIONES AUXILIARES
// ============================================================

function iniciales(persona: Persona | null | undefined): string {
  if (!persona) return "?";

  const partes = [persona.nombre, persona.apellido1].filter(
    Boolean,
  ) as string[];

  return (
    partes
      .map((parte) => parte.charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "?"
  );
}

function nombreEstado(estado: string): string {
  const estados: Record<string, string> = {
    BORRADOR: "Esborrany",
    PROGRAMADO: "Programat",
    EN_CURSO: "En curs",
    FINALIZADO: "Finalitzat",
    SUSPENDIDO: "Suspès",
    CANCELADO: "Cancel·lat",
  };

  return estados[estado] ?? estado;
}

function nombreFuncion(funcion: Funcion): string {
  return funcion === "ARBITRE" ? "Àrbitre" : "Oficial de taula";
}

function nombreRonda(partido: Partido): string {
  return partido.ronda?.nombre ?? partido.grupo?.nombre ?? "Sense ronda";
}

function colorEstado(estado: string): string {
  switch (estado) {
    case "EN_CURSO":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";

    case "FINALIZADO":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300";

    case "SUSPENDIDO":
    case "CANCELADO":
      return "bg-red-500/10 text-red-700 dark:text-red-300";

    default:
      return "bg-background text-neutral";
  }
}

// ============================================================
// ICONOS
// ============================================================

function IconoBuscar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="10.8" cy="10.8" r="7" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  );
}

function IconoEliminar() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M4 7h16" />
      <path d="M10 4h4" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

// ============================================================
// AVATAR
// ============================================================

function Avatar({
  persona,
  pequeno = false,
}: {
  persona: Persona | null | undefined;
  pequeno?: boolean;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary ${
        pequeno ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"
      }`}
    >
      {iniciales(persona)}
    </div>
  );
}

// ============================================================
// AGRUPACIÓN POR FASE Y RONDA
// ============================================================

type GrupoPartidos = {
  clave: string;
  titulo: string;
  partidos: Partido[];
};

function agruparPartidos(partidos: Partido[]): GrupoPartidos[] {
  const grupos: GrupoPartidos[] = [];

  // Conservamos el orden recibido del Gestor.
  // Así no se altera la posición del cuadro.

  for (const partido of partidos) {
    const fase = partido.fase?.nombre ?? "Sense fase";

    const ronda = nombreRonda(partido);

    const clave = [
      partido.fase?.id ?? "sense-fase",
      partido.ronda?.id ?? partido.grupo?.id ?? "sense-ronda",
    ].join(":");

    const titulo = `${fase} · ${ronda}`;

    const ultimo = grupos[grupos.length - 1];

    if (ultimo?.clave === clave) {
      ultimo.partidos.push(partido);
    } else {
      grupos.push({
        clave,
        titulo,
        partidos: [partido],
      });
    }
  }

  return grupos;
}

// ============================================================
// TARJETA DE PARTIDO
// ============================================================

function TarjetaPartido({
  partido,
  seleccionado,
  deshabilitado,
  onSeleccionar,
}: {
  partido: Partido;
  seleccionado: boolean;
  deshabilitado: boolean;
  onSeleccionar: () => void;
}) {
  const arbitres = partido.totales.arbitres;

  const oficiales = partido.totales.oficialsTaula;

  const total = arbitres + oficiales;

  return (
    <button
      type="button"
      onClick={onSeleccionar}
      disabled={deshabilitado}
      aria-pressed={seleccionado}
      className={`group w-full rounded-xl border p-3.5 text-left transition sm:p-4 ${
        seleccionado
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background hover:border-primary/50 hover:bg-primary/[0.025]"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-primary">{partido.codigo}</span>

        <span
          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${colorEstado(partido.estado)}`}
        >
          {nombreEstado(partido.estado)}
        </span>
      </div>

      <p className="mt-2 text-sm font-bold leading-5 text-neutral-titulos">
        {formatoPartido(partido)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral">
        <span>{formatearFecha(partido.fecha_hora)}</span>

        <span>{partido.pista || "Pista pendent"}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
            {arbitres} àrbitres
          </span>

          <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
            {oficiales} oficials
          </span>
        </div>

        <span
          className={`text-[11px] font-semibold ${
            total > 0 ? "text-emerald-600" : "text-amber-600"
          }`}
        >
          {total > 0 ? "Amb designacions" : "Sense designar"}
        </span>
      </div>
    </button>
  );
}

// ============================================================
// PERSONA DESIGNADA
// ============================================================

function PersonaDesignada({
  designacion,
  persona,
  guardando,
  puedeRevocar,
  onRevocar,
}: {
  designacion: Designacion;
  persona: Persona | null;
  guardando: boolean;
  puedeRevocar: boolean;
  onRevocar: (designacion: Designacion) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3">
      <Avatar persona={persona} pequeno />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-neutral-titulos">
          {nombrePersona(persona)}
        </p>

        {persona?.email && (
          <p className="truncate text-xs text-neutral">{persona.email}</p>
        )}
      </div>

      {puedeRevocar && (
        <button
          type="button"
          disabled={guardando}
          onClick={() => onRevocar(designacion)}
          title="Llevar designació"
          aria-label={`Llevar la designació de ${nombrePersona(persona)}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-300/50 text-red-600 transition hover:bg-red-500/10 disabled:opacity-50"
        >
          <IconoEliminar />
        </button>
      )}
    </div>
  );
}

// ============================================================
// GRUPO DE DESIGNACIONES ACTIVAS
// ============================================================

function GrupoDesignaciones({
  titulo,
  funcion,
  designaciones,
  personas,
  guardando,
  puedeRevocar,
  onRevocar,
}: {
  titulo: string;
  funcion: Funcion;
  designaciones: Designacion[];
  personas: Persona[];
  guardando: boolean;
  puedeRevocar: boolean;
  onRevocar: (designacion: Designacion) => void;
}) {
  const registros = designaciones.filter(
    (d) => d.funcion === funcion && !d.revocada_at,
  );

  return (
    <section className="min-w-0 rounded-xl border border-border bg-background p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-neutral-titulos">{titulo}</h4>

        <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
          {registros.length}
        </span>
      </div>

      {registros.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-neutral">
          Cap persona designada
        </div>
      ) : (
        <div className="space-y-2">
          {registros.map((designacion) => {
            const persona =
              designacion.usuario ??
              personas.find((p) => p.id === designacion.usuario_id) ??
              null;

            return (
              <PersonaDesignada
                key={designacion.id}
                designacion={designacion}
                persona={persona}
                guardando={guardando}
                puedeRevocar={puedeRevocar}
                onRevocar={onRevocar}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================
// BOTÓN DE FUNCIÓN
// ============================================================

function BotonFuncion({
  titulo,
  asignado,
  disabled,
  onClick,
}: {
  titulo: string;
  asignado: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={asignado}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold transition sm:text-sm ${
        asignado
          ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-card text-neutral-titulos hover:border-primary/50 hover:bg-primary/5"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span className="text-base leading-none">{asignado ? "✓" : "+"}</span>

      <span className="truncate">{titulo}</span>
    </button>
  );
}

// ============================================================
// TARJETA DE CANDIDATO
// ============================================================

function TarjetaCandidato({
  persona,
  partidoID,
  guardando,
  detalleCargando,
  puedeAsignar,
  puedeRevocar,
  estaAsignado,
  onAlternar,
}: {
  persona: Persona;
  partidoID: string;
  guardando: boolean;
  detalleCargando: boolean;
  puedeAsignar: boolean;
  puedeRevocar: boolean;
  estaAsignado: PropsVista["estaAsignado"];
  onAlternar: PropsVista["onAlternar"];
}) {
  const arbitro = estaAsignado(partidoID, persona.id, "ARBITRE");

  const oficial = estaAsignado(partidoID, persona.id, "OFICIAL_TAULA");

  const bloqueado = guardando || detalleCargando;

  return (
    <div className="rounded-xl border border-border bg-background p-3 transition hover:border-primary/30">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar persona={persona} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-titulos">
            {nombrePersona(persona)}
          </p>

          <p className="truncate text-xs text-neutral">
            {persona.email || "Sense correu"}
          </p>

          <p className="mt-1 text-[11px] font-medium text-primary">
            {persona.tipoAcceso === "ADMINISTRADOR"
              ? "Administrador"
              : "Voluntari confirmat"}
          </p>
        </div>

        {arbitro && oficial && (
          <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            2 funcions
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <BotonFuncion
          titulo="Àrbitre"
          asignado={arbitro}
          disabled={bloqueado || (arbitro ? !puedeRevocar : !puedeAsignar)}
          onClick={() => onAlternar(partidoID, persona.id, "ARBITRE")}
        />

        <BotonFuncion
          titulo="Oficial de taula"
          asignado={oficial}
          disabled={bloqueado || (oficial ? !puedeRevocar : !puedeAsignar)}
          onClick={() => onAlternar(partidoID, persona.id, "OFICIAL_TAULA")}
        />
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function PorPartidos({
  partidos,
  personas,
  filtros,
  permisos,

  seleccionadoPartidoID,

  designacionesSeleccionadas,

  detalleCargando,
  guardando,
  cargandoPersonas,
  errorDetalle,

  historial,

  onHistorial,
  onSeleccionarPartido,
  onFiltro,
  onLimpiarFiltros,
  onAlternar,
  onRevocar,
  estaAsignado,
}: PropsVista) {
  // ==========================================================
  // ESTADO LOCAL
  // ==========================================================

  const [limitePersonas, setLimitePersonas] = useState(12);

  const [primeroDesignados, setPrimeroDesignados] = useState(false);

  // ==========================================================
  // PARTIDO SELECCIONADO
  // ==========================================================

  const partidoActual = useMemo(
    () =>
      partidos.find((partido) => partido.id === seleccionadoPartidoID) ?? null,
    [partidos, seleccionadoPartidoID],
  );

  // ==========================================================
  // AGRUPAR PARTIDOS
  // ==========================================================

  const grupos = useMemo(() => agruparPartidos(partidos), [partidos]);

  // ==========================================================
  // DESIGNACIONES ACTIVAS E HISTORIAL
  // ==========================================================

  const activas = useMemo(
    () =>
      designacionesSeleccionadas.filter(
        (designacion) => !designacion.revocada_at,
      ),
    [designacionesSeleccionadas],
  );

  const revocadas = useMemo(
    () =>
      designacionesSeleccionadas.filter((designacion) =>
        Boolean(designacion.revocada_at),
      ),
    [designacionesSeleccionadas],
  );

  // ==========================================================
  // CANDIDATOS
  // ==========================================================

  const candidatos = useMemo(() => {
    const resultado = [...personas];

    if (primeroDesignados && seleccionadoPartidoID) {
      resultado.sort((a, b) => {
        const asignacionesA = activas.filter(
          (d) => d.usuario_id === a.id,
        ).length;

        const asignacionesB = activas.filter(
          (d) => d.usuario_id === b.id,
        ).length;

        return (
          asignacionesB - asignacionesA ||
          nombrePersona(a).localeCompare(nombrePersona(b), "ca")
        );
      });
    }

    return resultado;
  }, [personas, activas, primeroDesignados, seleccionadoPartidoID]);

  const candidatosVisibles = candidatos.slice(0, limitePersonas);

  // ==========================================================
  // REINICIAR PAGINACIÓN LOCAL
  // ==========================================================

  useEffect(() => {
    setLimitePersonas(12);
  }, [seleccionadoPartidoID, filtros.buscarPersona, filtros.tipoPersona]);

  // ==========================================================
  // CONTADORES
  // ==========================================================

  const totalArbitres = activas.filter((d) => d.funcion === "ARBITRE").length;

  const totalOficiales = activas.filter(
    (d) => d.funcion === "OFICIAL_TAULA",
  ).length;

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* =====================================================
          COLUMNA IZQUIERDA — PARTIDOS
          ===================================================== */}

      <section className={TARJETA}>
        {/* CABECERA */}

        <div className="border-b border-border p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-neutral-titulos">
                Selecciona un partit
              </h2>

              <p className="mt-1 text-xs text-neutral">
                {partidos.length} partits visibles
              </p>
            </div>

            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              Ordre de competició
            </span>
          </div>

          {/* FILTRO RÁPIDO */}

          <div className="mt-4 space-y-2">
            <label className="text-xs font-semibold text-neutral">
              Designacions
            </label>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["TODOS", "Tots"],
                  ["DESIGNADOS", "Amb designacions"],
                  ["PENDIENTES", "Sense designar"],
                ] as const
              ).map(([valor, titulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={filtros.designados === valor}
                  onClick={() => onFiltro("designados", valor)}
                  className={`min-h-10 rounded-lg border px-2 py-2 text-[11px] font-semibold transition sm:text-xs ${
                    filtros.designados === valor
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-neutral-titulos hover:border-primary/40"
                  }`}
                >
                  {titulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LISTADO */}

        <div className="max-h-[820px] space-y-5 overflow-y-auto p-3 sm:p-4">
          {partidos.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-7 text-center">
              <p className="text-sm font-semibold text-neutral-titulos">
                No s'han trobat partits
              </p>

              <p className="mt-2 text-xs text-neutral">
                Modifica els filtres per mostrar altres partits.
              </p>

              <button
                type="button"
                onClick={onLimpiarFiltros}
                className={`${BOTON} mt-4`}
              >
                Netejar filtres
              </button>
            </div>
          )}

          {grupos.map((grupo, indice) => (
            <div key={`${grupo.clave}-${indice}`} className="space-y-2">
              {/* ENCABEZADO FASE / RONDA */}

              <div className="flex items-center justify-between gap-2 px-1">
                <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-primary">
                  {grupo.titulo}
                </h3>

                <span className="text-[11px] text-neutral">
                  {grupo.partidos.length}
                </span>
              </div>

              {/* PARTIDOS DE LA RONDA */}

              {grupo.partidos.map((partido) => (
                <TarjetaPartido
                  key={partido.id}
                  partido={partido}
                  seleccionado={partido.id === seleccionadoPartidoID}
                  deshabilitado={guardando}
                  onSeleccionar={() => onSeleccionarPartido(partido.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================
          COLUMNA DERECHA — DESIGNACIONES
          ===================================================== */}

      <section className={TARJETA}>
        {!partidoActual ? (
          <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary">
              +
            </div>

            <h2 className="mt-4 text-lg font-bold text-neutral-titulos">
              Selecciona un partit
            </h2>

            <p className="mt-2 max-w-sm text-sm text-neutral">
              Tria un partit de la llista per consultar les designacions i
              afegir o llevar personal.
            </p>
          </div>
        ) : (
          <>
            {/* CABECERA DEL PARTIDO */}

            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  Designacions del partit
                </span>

                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${colorEstado(partidoActual.estado)}`}
                >
                  {nombreEstado(partidoActual.estado)}
                </span>
              </div>

              <h2 className="mt-2 text-xl font-bold text-neutral-titulos sm:text-2xl">
                {formatoPartido(partidoActual)}
              </h2>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">
                  {partidoActual.fase?.nombre ?? "Sense fase"}
                </span>

                <span className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-neutral">
                  {nombreRonda(partidoActual)}
                </span>
              </div>

              <p className="mt-3 text-xs text-neutral">
                {formatearFecha(partidoActual.fecha_hora)}
                {" · "}
                {partidoActual.pista || "Pista pendent"}
              </p>
            </div>

            <div className="space-y-6 p-4 sm:p-5">
              {/* =================================================
                  PERSONAL ACTUALMENTE DESIGNADO
                  ================================================= */}

              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-neutral-titulos">
                      Personal designat
                    </h3>

                    <p className="mt-1 text-xs text-neutral">
                      {totalArbitres} àrbitres · {totalOficiales} oficials
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral">
                    <input
                      type="checkbox"
                      checked={historial}
                      onChange={(e) => onHistorial(e.target.checked)}
                      className="accent-primary"
                    />
                    Mostrar historial
                  </label>
                </div>

                {errorDetalle && (
                  <div
                    role="alert"
                    className="mb-3 rounded-xl border border-red-300/40 bg-red-500/5 p-3 text-sm text-red-700"
                  >
                    {errorDetalle}
                  </div>
                )}

                {detalleCargando ? (
                  <p role="status" className="py-6 text-sm text-neutral">
                    Carregant designacions...
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    <GrupoDesignaciones
                      titulo="Àrbitres"
                      funcion="ARBITRE"
                      designaciones={activas}
                      personas={personas}
                      guardando={guardando}
                      puedeRevocar={permisos.revocar}
                      onRevocar={onRevocar}
                    />

                    <GrupoDesignaciones
                      titulo="Oficials de taula"
                      funcion="OFICIAL_TAULA"
                      designaciones={activas}
                      personas={personas}
                      guardando={guardando}
                      puedeRevocar={permisos.revocar}
                      onRevocar={onRevocar}
                    />
                  </div>
                )}

                {/* HISTORIAL DE REVOCACIONES */}

                {historial && !detalleCargando && revocadas.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <h4 className="text-sm font-bold text-neutral-titulos">
                      Designacions revocades
                    </h4>

                    <div className="mt-3 space-y-3">
                      {revocadas.map((d) => {
                        const persona =
                          d.usuario ??
                          personas.find((p) => p.id === d.usuario_id) ??
                          null;

                        return (
                          <div
                            key={d.id}
                            className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
                          >
                            <Avatar persona={persona} pequeno />

                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-titulos">
                                {nombrePersona(persona)}
                              </p>

                              <p className="mt-1 text-xs text-neutral">
                                {nombreFuncion(d.funcion)}
                                {" · Revocada"}
                              </p>

                              {d.motivo_revocacion && (
                                <p className="mt-1 text-xs text-neutral">
                                  Motiu: {d.motivo_revocacion}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* =================================================
                  ASIGNAR NUEVAS PERSONAS
                  ================================================= */}

              {permisos.asignar && (
                <section className="border-t border-border pt-5">
                  <div className="mb-4">
                    <h3 className="text-base font-bold text-neutral-titulos">
                      Afegir personal
                    </h3>

                    <p className="mt-1 text-sm text-neutral">
                      Cerca una persona i selecciona directament una o les dues
                      funcions.
                    </p>
                  </div>

                  {/* BUSCADOR */}

                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral">
                      <IconoBuscar />
                    </span>

                    <input
                      type="search"
                      value={filtros.buscarPersona}
                      onChange={(e) =>
                        onFiltro("buscarPersona", e.target.value)
                      }
                      placeholder="Cerca per nom, llinatges o correu..."
                      aria-label="Cercar persones disponibles"
                      className={`${CAMPO} pl-10`}
                    />
                  </div>

                  {/* FILTRO TIPO DE PERSONA */}

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(
                      [
                        ["TODOS", "Tothom"],
                        ["VOLUNTARI", "Voluntaris"],
                        ["ADMINISTRADOR", "Administradors"],
                      ] as const
                    ).map(([valor, titulo]) => (
                      <button
                        key={valor}
                        type="button"
                        aria-pressed={filtros.tipoPersona === valor}
                        onClick={() => onFiltro("tipoPersona", valor)}
                        className={`min-h-9 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                          filtros.tipoPersona === valor
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-neutral-titulos hover:border-primary/40"
                        }`}
                      >
                        {titulo}
                      </button>
                    ))}
                  </div>

                  {/* OPCIONES DE VISUALIZACIÓN */}

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-neutral">
                      {candidatos.length} persones
                    </span>

                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-neutral">
                      <input
                        type="checkbox"
                        checked={primeroDesignados}
                        onChange={(e) => setPrimeroDesignados(e.target.checked)}
                        className="accent-primary"
                      />
                      Designats primer
                    </label>
                  </div>

                  {/* LISTA DE CANDIDATOS */}

                  <div className="mt-3 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                    {cargandoPersonas && (
                      <p
                        role="status"
                        className="rounded-xl border border-border bg-background p-5 text-center text-sm text-neutral"
                      >
                        Carregant persones...
                      </p>
                    )}

                    {!cargandoPersonas && candidatos.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center">
                        <p className="text-sm font-semibold text-neutral-titulos">
                          No hi ha persones disponibles
                        </p>

                        <p className="mt-2 text-xs text-neutral">
                          Comprova els filtres o les inscripcions confirmades.
                        </p>
                      </div>
                    )}

                    {!cargandoPersonas &&
                      candidatosVisibles.map((persona) => (
                        <TarjetaCandidato
                          key={persona.id}
                          persona={persona}
                          partidoID={seleccionadoPartidoID}
                          guardando={guardando}
                          detalleCargando={detalleCargando}
                          puedeAsignar={permisos.asignar}
                          puedeRevocar={permisos.revocar}
                          estaAsignado={estaAsignado}
                          onAlternar={onAlternar}
                        />
                      ))}
                  </div>

                  {/* MOSTRAR MÁS */}

                  {candidatos.length > limitePersonas && (
                    <button
                      type="button"
                      onClick={() => setLimitePersonas((actual) => actual + 12)}
                      className={`${BOTON} mt-3 w-full`}
                    >
                      Mostrar més persones
                    </button>
                  )}

                  <p className="mt-4 text-xs leading-5 text-neutral">
                    Els botons marcats indiquen funcions ja assignades. Si els
                    prems de nou, es demanarà confirmació per llevar la
                    designació.
                  </p>
                </section>
              )}

              {!permisos.asignar && (
                <p className="border-t border-border pt-4 text-sm text-neutral">
                  Pots consultar les designacions, però no tens permís per
                  afegir personal.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
