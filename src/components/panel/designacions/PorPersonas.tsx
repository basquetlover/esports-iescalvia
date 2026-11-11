import { useEffect, useMemo, useState } from "react";

import type { Funcion, Partido, Persona, PropsVista } from "./Gestor";

// ============================================================
// ESTILOS
// ============================================================

const TARJETA =
  "min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm";

const CAMPO =
  "w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-50";

const BOTON =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50";

// ============================================================
// UTILIDADES
// ============================================================

function nombrePersona(persona: Persona | null | undefined): string {
  if (!persona) {
    return "Usuari no disponible";
  }

  return (
    [persona.nombre, persona.apellido1, persona.apellido2]
      .filter(Boolean)
      .join(" ")
      .trim() || "Sense nom"
  );
}

function iniciales(persona: Persona | null | undefined): string {
  if (!persona) {
    return "?";
  }

  return (
    [persona.nombre, persona.apellido1]
      .filter(Boolean)
      .map((parte) => String(parte).charAt(0).toUpperCase())
      .join("")
      .slice(0, 2) || "?"
  );
}

function nombrePartido(partido: Partido): string {
  return partido.nombre?.trim() || `Partit ${partido.codigo}`;
}

function fechaPartido(valor: string | null): string {
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

function IconoUsuario() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
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
        pequeno ? "h-10 w-10 text-xs" : "h-12 w-12 text-sm"
      }`}
    >
      {iniciales(persona)}
    </div>
  );
}

// ============================================================
// AGRUPAR PARTIDOS POR FASE Y RONDA
// ============================================================

type GrupoPartidos = {
  clave: string;
  titulo: string;
  fase: string;
  ronda: string;
  eliminatoria: boolean;
  partidos: Partido[];
};

function agruparPartidos(partidos: Partido[]): GrupoPartidos[] {
  const grupos: GrupoPartidos[] = [];

  // Respetamos el orden de competición
  // recibido del Gestor.

  for (const partido of partidos) {
    const fase = partido.fase?.nombre ?? "Sense fase";

    const ronda =
      partido.ronda?.nombre ?? partido.grupo?.nombre ?? "Sense ronda";

    const clave = [
      partido.fase?.id ?? "sense-fase",
      partido.ronda?.id ?? partido.grupo?.id ?? "sense-ronda",
    ].join(":");

    const eliminatoria = partido.fase?.tipo === "ELIMINATORIA";

    const ultimo = grupos[grupos.length - 1];

    if (ultimo?.clave === clave) {
      ultimo.partidos.push(partido);
    } else {
      grupos.push({
        clave,
        titulo: `${fase} · ${ronda}`,
        fase,
        ronda,
        eliminatoria,
        partidos: [partido],
      });
    }
  }

  return grupos;
}

// ============================================================
// TARJETA DE PERSONA
// ============================================================

function TarjetaPersona({
  persona,
  seleccionado,
  designaciones,
  deshabilitado,
  onSeleccionar,
}: {
  persona: Persona;
  seleccionado: boolean;
  designaciones: number;
  deshabilitado: boolean;
  onSeleccionar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSeleccionar}
      disabled={deshabilitado}
      aria-pressed={seleccionado}
      className={`group flex w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition ${
        seleccionado
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-background hover:border-primary/50 hover:bg-primary/[0.025]"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <Avatar persona={persona} />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-neutral-titulos">
          {nombrePersona(persona)}
        </p>

        {persona.email && (
          <p className="mt-0.5 truncate text-xs text-neutral">
            {persona.email}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            {persona.tipoAcceso === "ADMINISTRADOR"
              ? "Administrador"
              : "Voluntari"}
          </span>

          <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-neutral">
            {designaciones} funcions
          </span>
        </div>
      </div>

      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
          seleccionado
            ? "border-primary bg-primary text-white"
            : "border-border text-neutral"
        }`}
      >
        {seleccionado ? (
          <span className="text-xs font-bold">✓</span>
        ) : (
          <span className="text-sm">›</span>
        )}
      </span>
    </button>
  );
}

// ============================================================
// BOTÓN INDIVIDUAL DE FUNCIÓN
// ============================================================

function BotonFuncion({
  funcion,
  asignado,
  disabled,
  onClick,
}: {
  funcion: Funcion;
  asignado: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const titulo = funcion === "ARBITRE" ? "Àrbitre" : "Oficial de taula";

  return (
    <button
      type="button"
      aria-pressed={asignado}
      disabled={disabled}
      title={
        asignado
          ? `Llevar la designació de ${titulo}`
          : `Afegir la designació de ${titulo}`
      }
      onClick={onClick}
      className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold transition sm:text-sm ${
        asignado
          ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border bg-card text-neutral-titulos hover:border-primary/50 hover:bg-primary/5"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
          asignado
            ? "bg-primary text-white"
            : "border border-border bg-background text-primary"
        }`}
      >
        {asignado ? "✓" : "+"}
      </span>

      <span className="truncate">{titulo}</span>
    </button>
  );
}

// ============================================================
// TARJETA DE PARTIDO CON DOS FUNCIONES
// ============================================================

function TarjetaPartido({
  partido,
  personaID,
  asignadoArbitro,
  asignadoOficial,
  guardando,
  puedeAsignar,
  puedeRevocar,
  onAlternar,
}: {
  partido: Partido;
  personaID: string;
  asignadoArbitro: boolean;
  asignadoOficial: boolean;
  guardando: boolean;
  puedeAsignar: boolean;
  puedeRevocar: boolean;
  onAlternar: PropsVista["onAlternar"];
}) {
  const tieneDesignaciones = asignadoArbitro || asignadoOficial;

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-border bg-background p-3.5 transition hover:border-primary/30 sm:p-4">
      {/* CABECERA */}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary">
            {partido.codigo}
          </span>

          {tieneDesignaciones && (
            <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              Designat
            </span>
          )}
        </div>

        <span
          className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${colorEstado(partido.estado)}`}
        >
          {nombreEstado(partido.estado)}
        </span>
      </div>

      {/* NOMBRE */}

      <h4 className="mt-2 text-sm font-bold leading-5 text-neutral-titulos sm:text-base">
        {nombrePartido(partido)}
      </h4>

      {/* DATOS DEL PARTIDO */}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-neutral">
        <span>{fechaPartido(partido.fecha_hora)}</span>

        <span>{partido.pista || "Pista pendent"}</span>
      </div>

      {/* RESUMEN DE OTRAS DESIGNACIONES */}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-neutral">
          {partido.totales.arbitres} àrbitres
        </span>

        <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-neutral">
          {partido.totales.oficialsTaula} oficials
        </span>
      </div>

      {/* FUNCIONES INDEPENDIENTES */}

      <div className="mt-4 border-t border-border pt-3">
        <p className="mb-2 text-xs font-semibold text-neutral">
          Funcions d'aquesta persona
        </p>

        <div className="grid grid-cols-2 gap-2">
          <BotonFuncion
            funcion="ARBITRE"
            asignado={asignadoArbitro}
            disabled={
              guardando ||
              !personaID ||
              (asignadoArbitro ? !puedeRevocar : !puedeAsignar)
            }
            onClick={() => onAlternar(partido.id, personaID, "ARBITRE")}
          />

          <BotonFuncion
            funcion="OFICIAL_TAULA"
            asignado={asignadoOficial}
            disabled={
              guardando ||
              !personaID ||
              (asignadoOficial ? !puedeRevocar : !puedeAsignar)
            }
            onClick={() => onAlternar(partido.id, personaID, "OFICIAL_TAULA")}
          />
        </div>

        <p className="mt-2 text-[11px] leading-4 text-neutral">
          {tieneDesignaciones
            ? "Les funcions marcades estan assignades. Prem-les per sol·licitar-ne la revocació."
            : "Selecciona una o les dues funcions per designar aquesta persona."}
        </p>
      </div>
    </article>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function PorPersonas({
  partidos,
  personas,
  filtros,
  permisos,

  seleccionadoPersonaID,

  guardando,
  cargandoPersonas,

  onSeleccionarPersona,
  onFiltro,
  onLimpiarFiltros,
  onAlternar,
  estaAsignado,
}: PropsVista) {
  // ==========================================================
  // ESTADO LOCAL
  // ==========================================================

  const [limitePersonas, setLimitePersonas] = useState(30);

  // ==========================================================
  // PERSONA SELECCIONADA
  // ==========================================================

  const personaActual = useMemo(
    () =>
      personas.find((persona) => persona.id === seleccionadoPersonaID) ?? null,
    [personas, seleccionadoPersonaID],
  );

  // ==========================================================
  // DESIGNACIONES DE LA PERSONA
  // ==========================================================

  const misDesignaciones = useMemo(
    () =>
      partidos.flatMap((partido) =>
        partido.designaciones.filter(
          (designacion) =>
            designacion.usuario_id === seleccionadoPersonaID &&
            !designacion.revocada_at,
        ),
      ),
    [partidos, seleccionadoPersonaID],
  );

  // ==========================================================
  // RESUMEN POR PERSONA
  // ==========================================================

  const resumen = useMemo(() => {
    let partidosDesignados = 0;
    let arbitres = 0;
    let oficiales = 0;

    for (const partido of partidos) {
      const arbitro = estaAsignado(
        partido.id,
        seleccionadoPersonaID,
        "ARBITRE",
      );

      const oficial = estaAsignado(
        partido.id,
        seleccionadoPersonaID,
        "OFICIAL_TAULA",
      );

      if (arbitro || oficial) {
        partidosDesignados++;
      }

      if (arbitro) {
        arbitres++;
      }

      if (oficial) {
        oficiales++;
      }
    }

    return {
      partidosDesignados,
      arbitres,
      oficiales,
      pendientes: partidos.length - partidosDesignados,
    };
  }, [partidos, seleccionadoPersonaID, estaAsignado]);

  // ==========================================================
  // AGRUPAR POR FASE Y RONDA
  // ==========================================================

  const grupos = useMemo(() => agruparPartidos(partidos), [partidos]);

  // ==========================================================
  // PERSONAS VISIBLES
  // ==========================================================

  const personasVisibles = personas.slice(0, limitePersonas);

  // ==========================================================
  // REINICIAR LISTADO AL CAMBIAR FILTROS
  // ==========================================================

  useEffect(() => {
    setLimitePersonas(30);
  }, [filtros.buscarPersona, filtros.tipoPersona]);

  // ==========================================================
  // CONTAR FUNCIONES POR PERSONA
  // ==========================================================

  function contarDesignaciones(personaID: string): number {
    return partidos.reduce(
      (total, partido) =>
        total +
        partido.designaciones.filter(
          (designacion) =>
            designacion.usuario_id === personaID && !designacion.revocada_at,
        ).length,
      0,
    );
  }

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      {/* =====================================================
          COLUMNA IZQUIERDA — PERSONAS
          ===================================================== */}

      <section className={TARJETA}>
        {/* CABECERA */}

        <div className="border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-bold text-neutral-titulos">
              Selecciona una persona
            </h2>

            <p className="mt-1 text-xs text-neutral">
              {personas.length} persones disponibles
            </p>
          </div>

          {/* BUSCADOR */}

          <div className="relative mt-4">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral">
              <IconoBuscar />
            </span>

            <input
              type="search"
              value={filtros.buscarPersona}
              onChange={(evento) =>
                onFiltro("buscarPersona", evento.target.value)
              }
              placeholder="Cerca per nom, llinatges o correu..."
              aria-label="Cercar persones"
              className={`${CAMPO} pl-10`}
            />
          </div>

          {/* FILTRO DE TIPO */}

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
                className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                  filtros.tipoPersona === valor
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-neutral-titulos hover:border-primary/40"
                }`}
              >
                {titulo}
              </button>
            ))}
          </div>
        </div>

        {/* LISTADO DE PERSONAS */}

        <div className="max-h-[780px] space-y-2 overflow-y-auto p-3 sm:p-4">
          {/* CARGA */}

          {cargandoPersonas && (
            <div
              role="status"
              className="rounded-xl border border-border bg-background p-6 text-center"
            >
              <p className="text-sm text-neutral">
                Carregant persones disponibles...
              </p>
            </div>
          )}

          {/* SIN PERSONAS */}

          {!cargandoPersonas && personas.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-7 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <IconoUsuario />
              </div>

              <h3 className="mt-3 text-sm font-bold text-neutral-titulos">
                No s'han trobat persones
              </h3>

              <p className="mt-2 text-xs leading-5 text-neutral">
                Revisa els filtres o les inscripcions confirmades de
                voluntariat.
              </p>
            </div>
          )}

          {/* PERSONAS */}

          {!cargandoPersonas &&
            personasVisibles.map((persona) => (
              <TarjetaPersona
                key={persona.id}
                persona={persona}
                seleccionado={persona.id === seleccionadoPersonaID}
                designaciones={contarDesignaciones(persona.id)}
                deshabilitado={guardando}
                onSeleccionar={() => onSeleccionarPersona(persona.id)}
              />
            ))}

          {/* MOSTRAR MÁS */}

          {personas.length > limitePersonas && (
            <button
              type="button"
              className={`${BOTON} w-full`}
              onClick={() => setLimitePersonas((actual) => actual + 30)}
            >
              Mostrar més persones
            </button>
          )}
        </div>
      </section>

      {/* =====================================================
          COLUMNA DERECHA — PARTIDOS DE LA PERSONA
          ===================================================== */}

      <section className={TARJETA}>
        {!personaActual ? (
          <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <IconoUsuario />
            </div>

            <h2 className="mt-4 text-lg font-bold text-neutral-titulos">
              Selecciona una persona
            </h2>

            <p className="mt-2 max-w-sm text-sm text-neutral">
              Tria una persona per consultar els seus partits i gestionar les
              dues funcions de designació.
            </p>
          </div>
        ) : (
          <>
            {/* =================================================
                CABECERA DE LA PERSONA
                ================================================= */}

            <div className="border-b border-border p-4 sm:p-5">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar persona={personaActual} />

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                    Designacions de la persona
                  </p>

                  <h2 className="mt-1 truncate text-xl font-bold text-neutral-titulos sm:text-2xl">
                    {nombrePersona(personaActual)}
                  </h2>

                  <p className="mt-1 truncate text-xs text-neutral">
                    {personaActual.email || "Sense correu electrònic"}
                  </p>
                </div>
              </div>

              {/* RESUMEN */}

              <div className="mt-5 grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-neutral-titulos">
                    {resumen.partidosDesignados}
                  </p>

                  <p className="mt-1 text-[11px] text-neutral">
                    Partits designats
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-neutral-titulos">
                    {resumen.arbitres}
                  </p>

                  <p className="mt-1 text-[11px] text-neutral">Àrbitre</p>
                </div>

                <div className="rounded-xl border border-border bg-background p-3 text-center">
                  <p className="text-xl font-bold tabular-nums text-neutral-titulos">
                    {resumen.oficiales}
                  </p>

                  <p className="mt-1 text-[11px] text-neutral">
                    Oficial de taula
                  </p>
                </div>
              </div>
            </div>

            {/* =================================================
                FILTRO RÁPIDO POR DESIGNACIONES
                ================================================= */}

            <div className="border-b border-border p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-neutral-titulos">
                  Partits de la competició
                </h3>

                <span className="text-xs text-neutral">
                  {partidos.length} visibles
                </span>
              </div>

              {/* FILTRO POR ASIGNACIÓN */}

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["TODOS", "Tots"],
                    ["DESIGNADOS", "Ja designats"],
                    ["PENDIENTES", "Pendents"],
                  ] as const
                ).map(([valor, titulo]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={filtros.designados === valor}
                    onClick={() => onFiltro("designados", valor)}
                    className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                      filtros.designados === valor
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-neutral-titulos hover:border-primary/40"
                    }`}
                  >
                    {titulo}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-xs leading-5 text-neutral">
                Les funcions es gestionen per separat a cada partit. Una persona
                pot tenir-ne una o totes dues.
              </p>
            </div>

            {/* =================================================
                LISTADO DE PARTIDOS AGRUPADOS
                ================================================= */}

            <div className="max-h-[1000px] space-y-6 overflow-y-auto p-3 sm:p-4">
              {/* SIN PARTIDOS */}

              {partidos.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="text-sm font-semibold text-neutral-titulos">
                    No hi ha partits amb aquests filtres
                  </p>

                  <p className="mt-2 text-xs leading-5 text-neutral">
                    Pots mostrar tots els partits o canviar els filtres de fase,
                    ronda i estat.
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

              {/* GRUPOS DE FASE Y RONDA */}

              {grupos.map((grupo, indice) => (
                <div key={`${grupo.clave}-${indice}`} className="space-y-3">
                  {/* CABECERA DEL GRUPO */}

                  <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-primary">
                        {grupo.fase}
                      </p>

                      <h3 className="mt-1 text-sm font-semibold text-neutral-titulos">
                        {grupo.ronda}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {grupo.eliminatoria && (
                        <span className="rounded-lg bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                          Eliminatòria
                        </span>
                      )}

                      <span className="text-xs text-neutral">
                        {grupo.partidos.length} partits
                      </span>
                    </div>
                  </div>

                  {/* PARTIDOS */}

                  {grupo.partidos.map((partido) => {
                    const asignadoArbitro = estaAsignado(
                      partido.id,
                      seleccionadoPersonaID,
                      "ARBITRE",
                    );

                    const asignadoOficial = estaAsignado(
                      partido.id,
                      seleccionadoPersonaID,
                      "OFICIAL_TAULA",
                    );

                    return (
                      <TarjetaPartido
                        key={partido.id}
                        partido={partido}
                        personaID={seleccionadoPersonaID}
                        asignadoArbitro={asignadoArbitro}
                        asignadoOficial={asignadoOficial}
                        guardando={guardando}
                        puedeAsignar={permisos.asignar}
                        puedeRevocar={permisos.revocar}
                        onAlternar={onAlternar}
                      />
                    );
                  })}
                </div>
              ))}
            </div>

            {/* =================================================
                PIE DE INFORMACIÓN
                ================================================= */}

            <div className="border-t border-border p-4 sm:p-5">
              <div className="flex items-start gap-3 rounded-xl bg-primary/5 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                  i
                </span>

                <p className="text-xs leading-5 text-neutral">
                  Per afegir una designació, prem el botó de la funció
                  corresponent. Les funcions marcades ja estan assignades; si
                  les tornes a prémer, es demanarà confirmació per revocar-les.
                </p>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
