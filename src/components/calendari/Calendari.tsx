import { useEffect, useMemo, useState } from "react";

import { obtenerIconoDeporte } from "@components/deporteIcono";

// ============================================================
// TIPOS
// ============================================================

export type TorneoCalendario = {
  id: string;
  nombre: string;
  deporte: string;
};

export type TipoEventoCalendario =
  | "inscripcion_equipos"
  | "inscripcion_voluntarios"
  | "jornada";

export type EventoCalendario = {
  id: string;

  torneoId: string;
  torneo: string;

  deporte: string;
  edicion: string;

  titulo: string;

  tipo: TipoEventoCalendario;

  fechaInicio: string;
  fechaFin: string;

  estado: string;
  sede: string;

  enlace: string;

  color: number;
};

type Props = {
  torneos: TorneoCalendario[];

  eventos: EventoCalendario[];

  hoy: string;

  mesInicial: string;

  torneoInicial?: string;
};

type DiaCalendario = {
  fecha: string;

  numero: number;

  perteneceMes: boolean;

  esHoy: boolean;
};

type SegmentoEvento = {
  evento: EventoCalendario;

  columnaInicio: number;

  columnas: number;

  carril: number;

  empiezaAqui: boolean;

  terminaAqui: boolean;
};

type SemanaCalendario = {
  clave: string;

  dias: DiaCalendario[];

  segmentos: SegmentoEvento[];

  carriles: number;
};

// ============================================================
// CONSTANTES
// ============================================================

const MESES = [
  "gener",
  "febrer",
  "març",
  "abril",
  "maig",
  "juny",
  "juliol",
  "agost",
  "setembre",
  "octubre",
  "novembre",
  "desembre",
];

const DIAS_SEMANA = ["Dl", "Dt", "Dc", "Dj", "Dv", "Ds", "Dg"];

/*
 * Solo tres colores.
 *
 * 0 = equipos
 * 1 = voluntariado
 * 2 = jornada
 */
const COLORES_EVENTO = ["#2563eb", "#b7791f", "#0f766e"];

// ============================================================
// TIPO ACTIVIDAD
// ============================================================

function nombreTipoActividad(tipo: TipoEventoCalendario): string {
  switch (tipo) {
    case "inscripcion_equipos":
      return "Inscripció d'equips";

    case "inscripcion_voluntarios":
      return "Voluntariat";

    case "jornada":
      return "Jornada de joc";
  }
}

function nombreTipoCompacto(tipo: TipoEventoCalendario): string {
  switch (tipo) {
    case "inscripcion_equipos":
      return "Equips";

    case "inscripcion_voluntarios":
      return "Voluntariat";

    case "jornada":
      return "Jornada";
  }
}

// ============================================================
// COLOR
// ============================================================

function obtenerColor(indice: number): string {
  const indiceSeguro = Math.abs(indice) % COLORES_EVENTO.length;

  return COLORES_EVENTO[indiceSeguro];
}

function colorConAlpha(color: string, alpha: string): string {
  return `${color}${alpha}`;
}

// ============================================================
// FECHAS
// ============================================================

function crearFechaUTC(valor: string): Date {
  const [ano, mes, dia] = valor.split("-").map(Number);

  return new Date(Date.UTC(ano, mes - 1, dia));
}

function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: Date, cantidad: number): Date {
  const copia = new Date(fecha.getTime());

  copia.setUTCDate(copia.getUTCDate() + cantidad);

  return copia;
}

function diferenciaDias(inicio: string, fin: string): number {
  return Math.round(
    (crearFechaUTC(fin).getTime() - crearFechaUTC(inicio).getTime()) / 86400000,
  );
}

function cambiarMes(mes: string, desplazamiento: number): string {
  const ano = Number(mes.slice(0, 4));

  const numeroMes = Number(mes.slice(5, 7));

  const fecha = new Date(Date.UTC(ano, numeroMes - 1 + desplazamiento, 1));

  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function nombreMes(mes: string): string {
  const ano = Number(mes.slice(0, 4));

  const numeroMes = Number(mes.slice(5, 7));

  return `${MESES[numeroMes - 1]} ${ano}`;
}

function ultimoDiaMes(mes: string): string {
  const ano = Number(mes.slice(0, 4));

  const numeroMes = Number(mes.slice(5, 7));

  const fecha = new Date(Date.UTC(ano, numeroMes, 0));

  return `${mes}-${String(fecha.getUTCDate()).padStart(2, "0")}`;
}

function textoFecha(fecha: string): string {
  const date = crearFechaUTC(fecha);

  const texto = new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",

    day: "numeric",

    month: "long",

    year: "numeric",

    timeZone: "UTC",
  }).format(date);

  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function textoFechaCorta(fecha: string): string {
  return new Intl.DateTimeFormat("ca-ES", {
    day: "numeric",

    month: "short",

    timeZone: "UTC",
  }).format(crearFechaUTC(fecha));
}

function textoRangoEvento(evento: EventoCalendario): string {
  if (evento.fechaInicio === evento.fechaFin) {
    return textoFechaCorta(evento.fechaInicio);
  }

  return `${textoFechaCorta(evento.fechaInicio)} – ${textoFechaCorta(
    evento.fechaFin,
  )}`;
}

// ============================================================
// TEXTO EVENTO
// ============================================================

function tituloCompactoEvento(evento: EventoCalendario): string {
  return `${nombreTipoCompacto(evento.tipo)} · ${evento.torneo}`;
}

// ============================================================
// SEMANAS
// ============================================================

function generarSemanas(
  mes: string,
  eventos: EventoCalendario[],
  hoy: string,
): SemanaCalendario[] {
  const ano = Number(mes.slice(0, 4));

  const numeroMes = Number(mes.slice(5, 7));

  const primerDiaMes = new Date(Date.UTC(ano, numeroMes - 1, 1));

  const ultimoDia = new Date(Date.UTC(ano, numeroMes, 0));

  const desplazamientoInicio = (primerDiaMes.getUTCDay() + 6) % 7;

  const desplazamientoFin = 6 - ((ultimoDia.getUTCDay() + 6) % 7);

  let inicioSemana = sumarDias(primerDiaMes, -desplazamientoInicio);

  const finCalendario = sumarDias(ultimoDia, desplazamientoFin);

  const semanas: SemanaCalendario[] = [];

  while (inicioSemana.getTime() <= finCalendario.getTime()) {
    const finSemana = sumarDias(inicioSemana, 6);

    const inicioSemanaISO = fechaISO(inicioSemana);

    const finSemanaISO = fechaISO(finSemana);

    // ====================================================
    // DÍAS
    // ====================================================

    const dias: DiaCalendario[] = [];

    for (let indice = 0; indice < 7; indice++) {
      const fecha = sumarDias(inicioSemana, indice);

      const texto = fechaISO(fecha);

      dias.push({
        fecha: texto,

        numero: fecha.getUTCDate(),

        perteneceMes: fecha.getUTCMonth() === numeroMes - 1,

        esHoy: texto === hoy,
      });
    }

    // ====================================================
    // EVENTOS
    // ====================================================

    const candidatos = eventos
      .filter(
        (evento) =>
          evento.fechaInicio <= finSemanaISO &&
          evento.fechaFin >= inicioSemanaISO,
      )
      .map((evento) => {
        const inicioSegmento =
          evento.fechaInicio > inicioSemanaISO
            ? evento.fechaInicio
            : inicioSemanaISO;

        const finSegmento =
          evento.fechaFin < finSemanaISO ? evento.fechaFin : finSemanaISO;

        const columnaInicio =
          diferenciaDias(inicioSemanaISO, inicioSegmento) + 1;

        const columnaFin = diferenciaDias(inicioSemanaISO, finSegmento) + 1;

        return {
          evento,

          columnaInicio,

          columnaFin,

          columnas: columnaFin - columnaInicio + 1,

          empiezaAqui: evento.fechaInicio >= inicioSemanaISO,

          terminaAqui: evento.fechaFin <= finSemanaISO,
        };
      })
      .sort((a, b) => {
        if (a.columnaInicio !== b.columnaInicio) {
          return a.columnaInicio - b.columnaInicio;
        }

        return b.columnas - a.columnas;
      });

    // ====================================================
    // CARRILES
    // ====================================================

    const finalCarriles: number[] = [];

    const segmentos: SegmentoEvento[] = [];

    for (const candidato of candidatos) {
      let carril = finalCarriles.findIndex(
        (columnaFinal) => candidato.columnaInicio > columnaFinal,
      );

      if (carril === -1) {
        carril = finalCarriles.length;

        finalCarriles.push(candidato.columnaFin);
      } else {
        finalCarriles[carril] = candidato.columnaFin;
      }

      segmentos.push({
        evento: candidato.evento,

        columnaInicio: candidato.columnaInicio,

        columnas: candidato.columnas,

        carril,

        empiezaAqui: candidato.empiezaAqui,

        terminaAqui: candidato.terminaAqui,
      });
    }

    semanas.push({
      clave: inicioSemanaISO,

      dias,

      segmentos,

      carriles: Math.max(1, finalCarriles.length),
    });

    inicioSemana = sumarDias(inicioSemana, 7);
  }

  return semanas;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Calendari({
  torneos,
  eventos,
  hoy,
  mesInicial,
  torneoInicial = "",
}: Props) {
  const [mesActual, setMesActual] = useState(mesInicial);

  const [torneoActual, setTorneoActual] = useState(torneoInicial);

  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoy);

  // ========================================================
  // EVENTOS FILTRADOS
  // ========================================================

  const eventosFiltrados = useMemo(() => {
    if (!torneoActual) {
      return eventos;
    }

    return eventos.filter((evento) => evento.torneoId === torneoActual);
  }, [eventos, torneoActual]);

  // ========================================================
  // SEMANAS
  // ========================================================

  const semanas = useMemo(
    () => generarSemanas(mesActual, eventosFiltrados, hoy),
    [mesActual, eventosFiltrados, hoy],
  );

  // ========================================================
  // EVENTOS DEL DÍA
  // ========================================================

  const eventosDia = useMemo(
    () =>
      eventosFiltrados.filter(
        (evento) =>
          evento.fechaInicio <= fechaSeleccionada &&
          evento.fechaFin >= fechaSeleccionada,
      ),
    [eventosFiltrados, fechaSeleccionada],
  );

  // ========================================================
  // CANTIDAD MES
  // ========================================================

  const cantidadMes = useMemo(() => {
    const inicio = `${mesActual}-01`;

    const fin = ultimoDiaMes(mesActual);

    return eventosFiltrados.filter(
      (evento) => evento.fechaInicio <= fin && evento.fechaFin >= inicio,
    ).length;
  }, [eventosFiltrados, mesActual]);

  // ========================================================
  // URL
  // ========================================================

  useEffect(() => {
    const url = new URL(window.location.href);

    url.searchParams.set("mes", mesActual);

    if (torneoActual) {
      url.searchParams.set("torneo", torneoActual);
    } else {
      url.searchParams.delete("torneo");
    }

    window.history.replaceState({}, "", url);
  }, [mesActual, torneoActual]);

  // ========================================================
  // NAVEGACIÓN
  // ========================================================

  function irMesAnterior() {
    const nuevoMes = cambiarMes(mesActual, -1);

    setMesActual(nuevoMes);

    setFechaSeleccionada(`${nuevoMes}-01`);
  }

  function irMesSiguiente() {
    const nuevoMes = cambiarMes(mesActual, 1);

    setMesActual(nuevoMes);

    setFechaSeleccionada(`${nuevoMes}-01`);
  }

  function irHoy() {
    setMesActual(hoy.slice(0, 7));

    setFechaSeleccionada(hoy);
  }

  function seleccionarTorneo(torneoId: string) {
    setTorneoActual(torneoId);
  }

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <main className="min-h-screen bg-background">
      {/* ==================================================
          CABECERA
      ================================================== */}

      <section className="border-b border-border bg-card/40">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
            Agenda esportiva
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-titulos sm:text-4xl">
            Calendari
          </h1>

          <p className="mt-3 max-w-3xl text-base leading-7 text-neutral">
            Consulta les dates de les competicions, inscripcions i activitats
            d'Esports IES Calvià.
          </p>
        </div>
      </section>

      {/* ==================================================
          CONTENIDO
      ================================================== */}

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* ==============================================
            FILTROS
        ============================================== */}

        <div className="mb-5 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full sm:max-w-sm">
            <label
              htmlFor="filtro-torneo"
              className="mb-2 block text-sm font-semibold text-neutral-titulos"
            >
              Competició
            </label>

            <select
              id="filtro-torneo"
              value={torneoActual}
              onChange={(evento) => seleccionarTorneo(evento.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-neutral-titulos outline-none focus:border-secondary"
            >
              <option value="">Totes les competicions</option>

              {torneos.map((torneo) => (
                <option key={torneo.id} value={torneo.id}>
                  {torneo.nombre}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={irHoy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-secondary px-4 text-sm font-semibold text-secondary transition hover:bg-secondary hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              className="h-5 w-5 fill-current"
              aria-hidden="true"
            >
              <path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80zm0-80h560v-400H200zm0-480h560v-80H200z" />
            </svg>
            Avui
          </button>
        </div>

        {/* ==============================================
            LEYENDA
        ============================================== */}

        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral">
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: COLORES_EVENTO[0],
              }}
            />
            Inscripció d'equips
          </span>

          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: COLORES_EVENTO[1],
              }}
            />
            Voluntariat
          </span>

          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: COLORES_EVENTO[2],
              }}
            />
            Jornada
          </span>
        </div>

        {/* ==============================================
            CALENDARIO
        ============================================== */}

        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {/* ==========================================
              NAVEGACIÓN MES
          ========================================== */}

          <div className="flex items-center justify-between border-b border-border bg-card px-3 py-3 sm:px-5">
            <button
              type="button"
              onClick={irMesAnterior}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-titulos transition hover:bg-background"
              aria-label="Mes anterior"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-6 w-6 fill-current"
                aria-hidden="true"
              >
                <path d="M560-240 320-480l240-240 56 56-184 184 184 184z" />
              </svg>
            </button>

            <div className="text-center">
              <h2 className="text-xl font-bold capitalize text-neutral-titulos sm:text-2xl">
                {nombreMes(mesActual)}
              </h2>

              <p className="mt-0.5 text-xs text-neutral">
                {cantidadMes} {cantidadMes === 1 ? "activitat" : "activitats"}
              </p>
            </div>

            <button
              type="button"
              onClick={irMesSiguiente}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-titulos transition hover:bg-background"
              aria-label="Mes següent"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-6 w-6 fill-current"
                aria-hidden="true"
              >
                <path d="M504-480 320-664l56-56 240 240-240 240-56-56z" />
              </svg>
            </button>
          </div>

          {/* ==========================================
              SCROLL HORIZONTAL MÓVIL
          ========================================== */}

          <div className="scroll-personalizada overflow-x-auto">
            <div className="min-w-[760px]">
              {/* ==================================
                  CABECERA DÍAS
              ================================== */}

              <div className="grid grid-cols-7 border-b border-border bg-card/50">
                {DIAS_SEMANA.map((dia) => (
                  <div
                    key={dia}
                    className="border-r border-border px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-neutral last:border-r-0"
                  >
                    {dia}
                  </div>
                ))}
              </div>

              {/* ==================================
                  SEMANAS
              ================================== */}

              <div>
                {semanas.map((semana) => {
                  const altura = Math.max(104, 50 + semana.carriles * 26);

                  return (
                    <div
                      key={semana.clave}
                      className="relative border-b border-border last:border-b-0"
                      style={{
                        minHeight: altura,
                      }}
                    >
                      {/* ==================
                              DÍAS
                          ================== */}

                      <div className="absolute inset-0 grid grid-cols-7">
                        {semana.dias.map((dia) => {
                          const seleccionado = dia.fecha === fechaSeleccionada;

                          return (
                            <button
                              key={dia.fecha}
                              type="button"
                              onClick={() => setFechaSeleccionada(dia.fecha)}
                              className={[
                                "relative border-r border-border text-left transition last:border-r-0 hover:bg-card/50",

                                !dia.perteneceMes ? "bg-card/20" : "",

                                seleccionado ? "bg-secondary/5" : "",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <span
                                className={[
                                  "absolute left-2 top-2 z-20 inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-sm font-medium",

                                  dia.esHoy
                                    ? "bg-secondary text-white"
                                    : dia.perteneceMes
                                      ? "text-neutral-titulos"
                                      : "text-neutral/40",
                                ].join(" ")}
                              >
                                {dia.numero}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* ==================
                              EVENTOS
                          ================== */}

                      <div className="pointer-events-none absolute inset-0">
                        {semana.segmentos.map((segmento) => {
                          const izquierda =
                            ((segmento.columnaInicio - 1) / 7) * 100;

                          const ancho = (segmento.columnas / 7) * 100;

                          const arriba = 42 + segmento.carril * 26;

                          const color = obtenerColor(segmento.evento.color);

                          return (
                            <a
                              key={`${segmento.evento.id}-${semana.clave}`}
                              href={segmento.evento.enlace}
                              title={segmento.evento.titulo}
                              className={[
                                "pointer-events-auto absolute z-10 flex h-5 items-center overflow-hidden border-y px-2 text-[10px] font-semibold leading-none transition hover:z-20 hover:brightness-95",

                                segmento.empiezaAqui
                                  ? "rounded-l-md"
                                  : "rounded-l-none",

                                segmento.terminaAqui
                                  ? "rounded-r-md"
                                  : "rounded-r-none",
                              ].join(" ")}
                              style={{
                                left: `calc(${izquierda}% + 2px)`,

                                width: `calc(${ancho}% - 4px)`,

                                top: arriba,

                                color,

                                backgroundColor: colorConAlpha(color, "14"),

                                borderColor: colorConAlpha(color, "35"),

                                borderLeft: segmento.empiezaAqui
                                  ? `3px solid ${color}`
                                  : undefined,
                              }}
                            >
                              <span className="truncate">
                                {tituloCompactoEvento(segmento.evento)}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ==============================================
            DETALLE DEL DÍA
        ============================================== */}

        <section className="mt-6 rounded-xl border border-border bg-card">
          <div className="flex flex-col gap-1 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
                Activitat del dia
              </p>

              <h2 className="mt-1 text-xl font-bold text-neutral-titulos sm:text-2xl">
                {fechaSeleccionada === hoy
                  ? "Avui"
                  : textoFecha(fechaSeleccionada)}
              </h2>
            </div>

            <span className="mt-2 w-max text-xs font-medium text-neutral sm:mt-0">
              {eventosDia.length}{" "}
              {eventosDia.length === 1 ? "activitat" : "activitats"}
            </span>
          </div>

          <div className="p-4 sm:p-5">
            {eventosDia.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-5 py-8 text-center">
                <p className="font-semibold text-neutral-titulos">
                  No hi ha activitats programades
                </p>

                <p className="mt-1 text-sm text-neutral">
                  Selecciona un altre dia del calendari per consultar-lo.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {eventosDia.map((evento) => {
                  const color = obtenerColor(evento.color);

                  return (
                    <a
                      key={evento.id}
                      href={evento.enlace}
                      className="group flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <span
                        className="mt-1 h-9 w-1 shrink-0 rounded-full"
                        style={{
                          backgroundColor: color,
                        }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-semibold text-neutral-titulos transition group-hover:text-secondary">
                            {nombreTipoActividad(evento.tipo)}
                          </p>

                          <span
                            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                            style={{
                              color,

                              backgroundColor: colorConAlpha(color, "14"),
                            }}
                          >
                            {evento.estado}
                          </span>
                        </div>

                        <p className="mt-1 text-sm font-medium text-neutral-titulos">
                          {evento.torneo}

                          {evento.edicion && ` · ${evento.edicion}`}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral">
                          <span>{textoRangoEvento(evento)}</span>

                          {evento.sede && <span>{evento.sede}</span>}

                          {evento.deporte && (
                            <span className="inline-flex items-center gap-1.5">
                              {obtenerIconoDeporte(
                                evento.deporte,
                                "h-3.5 w-3.5 fill-current",
                              )}

                              {evento.deporte}
                            </span>
                          )}
                        </div>
                      </div>

                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 -960 960 960"
                        className="mt-2 h-5 w-5 shrink-0 fill-neutral/50 transition group-hover:translate-x-0.5 group-hover:fill-secondary"
                        aria-hidden="true"
                      >
                        <path d="m504-480-184-184 56-56 240 240-240 240-56-56z" />
                      </svg>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
