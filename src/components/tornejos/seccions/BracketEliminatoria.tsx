import { useMemo, useState } from "react";

// ============================================================
// TIPOS
// ============================================================

type TipoRondaPrincipal =
  | "TREINTADOSAVOS"
  | "DIECISEISAVOS"
  | "OCTAVOS"
  | "CUARTOS"
  | "SEMIFINAL"
  | "FINAL";

export type FaseEliminatoria = {
  id: string;
  edicion_id: string;
  nombre: string;
  tipo: "ELIMINATORIA";
  orden: number;
  estado: string;
};

export type RondaEliminatoria = {
  id: string;
  fase_id: string;
  tipo: string;
  nombre: string;
  orden: number;
};

export type PartidoEliminatoria = {
  id: string;

  edicion_id: string;

  fase_id: string;

  tipo: string;

  grupo_id: string | null;

  ronda_id: string | null;

  codigo: string;

  nombre: string | null;

  orden: number;

  jornada: number | null;

  estado: string;

  fecha_hora: string | null;

  pista_id: string | null;

  duracion_estimada_min: number | null;

  publicado: boolean;
};

export type PlazaEliminatoria = {
  id: string;

  destino_fase_id: string;

  destino_tipo: string;

  partido_id: string | null;

  lado: "LOCAL" | "VISITANTE" | null;

  orden: number;

  origen_tipo: string;

  equipo_origen_id: string | null;

  origen_grupo_id: string | null;

  origen_fase_id: string | null;

  origen_posicion: number | null;

  origen_partido_id: string | null;

  equipo_resuelto_id: string | null;
};

export type EquipoEliminatoria = {
  id: string;
  nombre: string;
  escudo: string | null;
};

export type GrupoEliminatoria = {
  id: string;
  nombre: string;
};

export type PistaEliminatoria = {
  id: string;
  nombre: string;
};

export type ResultadoEliminatoria = {
  id: string;

  partido_id: string;

  marcador_local: number | null;

  marcador_visitante: number | null;

  ganador_equipo_id: string | null;

  resultado_tipo: string;

  confirmado: boolean;

  confirmado_at: string | null;

  updated_at: string;
};

type Props = {
  fases: FaseEliminatoria[];

  rondas: RondaEliminatoria[];

  partidos: PartidoEliminatoria[];

  plazas: PlazaEliminatoria[];

  equipos: EquipoEliminatoria[];

  grupos: GrupoEliminatoria[];

  pistas: PistaEliminatoria[];

  resultados: ResultadoEliminatoria[];

  faseInicialID?: string | null;
};

// ============================================================
// CONSTANTES
// ============================================================

const TIPOS_PRINCIPALES: readonly TipoRondaPrincipal[] = [
  "TREINTADOSAVOS",
  "DIECISEISAVOS",
  "OCTAVOS",
  "CUARTOS",
  "SEMIFINAL",
  "FINAL",
];

// ============================================================
// HELPERS
// ============================================================

function esRondaPrincipal(tipo: string): tipo is TipoRondaPrincipal {
  return TIPOS_PRINCIPALES.includes(tipo as TipoRondaPrincipal);
}

function nombreTipoRonda(tipo: string) {
  switch (tipo.trim().toUpperCase()) {
    case "TREINTADOSAVOS":
      return "Trenta-dosens";

    case "DIECISEISAVOS":
      return "Setzens";

    case "OCTAVOS":
      return "Vuitens";

    case "CUARTOS":
      return "Quarts";

    case "SEMIFINAL":
      return "Semifinals";

    case "FINAL":
      return "Final";

    case "TERCER_PUESTO":
      return "3r / 4t lloc";

    case "CLASIFICACION":
      return "Classificació";

    case "PERSONALIZADA":
      return "Consolació";

    default:
      return tipo;
  }
}

function nombreEstado(estado: string) {
  switch (estado.trim().toUpperCase()) {
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

function nombreTipoResultado(tipo: string) {
  switch (tipo.trim().toUpperCase()) {
    case "NORMAL":
      return "";

    case "PRORROGA":
      return "Pròrroga";

    case "PENALTIS":
      return "Penals";

    case "FORFEIT":
      return "Incompareixença";

    default:
      return tipo;
  }
}

function formatearFechaHora(valor: string | null) {
  if (!valor) {
    return null;
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ca-ES", {
    day: "2-digit",

    month: "short",

    hour: "2-digit",

    minute: "2-digit",

    timeZone: "Europe/Madrid",
  }).format(fecha);
}

function iniciales(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte.charAt(0))
      .join("")
      .toUpperCase() || "?"
  );
}

// ============================================================
// RESULTADOS
// ============================================================
//
// Igual que en el panel:
//
// 1. Resultado confirmado.
// 2. Si hay varios, el actualizado más recientemente.
// 3. Si no hay confirmado, provisional más reciente.
// ============================================================

function crearMapaResultados(resultados: ResultadoEliminatoria[]) {
  const agrupados = new Map<string, ResultadoEliminatoria[]>();

  for (const resultado of resultados) {
    const lista = agrupados.get(resultado.partido_id) ?? [];

    lista.push(resultado);

    agrupados.set(resultado.partido_id, lista);
  }

  const mapa = new Map<string, ResultadoEliminatoria>();

  for (const [partidoID, lista] of agrupados) {
    lista.sort((a, b) => {
      if (a.confirmado !== b.confirmado) {
        return a.confirmado ? -1 : 1;
      }

      const fechaA = new Date(a.updated_at).getTime();

      const fechaB = new Date(b.updated_at).getTime();

      return fechaB - fechaA;
    });

    if (lista[0]) {
      mapa.set(partidoID, lista[0]);
    }
  }

  return mapa;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function BracketEliminatoria({
  fases,
  rondas,
  partidos,
  plazas,
  equipos,
  grupos,
  pistas,
  resultados,
  faseInicialID = null,
}: Props) {
  const faseInicial =
    faseInicialID && fases.some((fase) => fase.id === faseInicialID)
      ? faseInicialID
      : (fases[0]?.id ?? "");

  const [faseID, setFaseID] = useState(faseInicial);

  // ========================================================
  // MAPAS
  // ========================================================

  const equiposPorID = useMemo(
    () => new Map(equipos.map((equipo) => [equipo.id, equipo])),
    [equipos],
  );

  const gruposPorID = useMemo(
    () => new Map(grupos.map((grupo) => [grupo.id, grupo])),
    [grupos],
  );

  const pistasPorID = useMemo(
    () => new Map(pistas.map((pista) => [pista.id, pista])),
    [pistas],
  );

  const partidosPorID = useMemo(
    () => new Map(partidos.map((partido) => [partido.id, partido])),
    [partidos],
  );

  const resultadosPorPartido = useMemo(
    () => crearMapaResultados(resultados),
    [resultados],
  );

  // ========================================================
  // FASE ACTUAL
  // ========================================================

  const fase =
    fases.find((elemento) => elemento.id === faseID) ?? fases[0] ?? null;

  // ========================================================
  // RONDAS
  // ========================================================

  const rondasFase = useMemo(() => {
    if (!fase) {
      return [];
    }

    return rondas
      .filter((ronda) => ronda.fase_id === fase.id)
      .sort((a, b) => a.orden - b.orden);
  }, [fase, rondas]);

  const rondasPrincipales = useMemo(
    () => rondasFase.filter((ronda) => esRondaPrincipal(ronda.tipo)),
    [rondasFase],
  );

  const rondasTercerPuesto = useMemo(
    () => rondasFase.filter((ronda) => ronda.tipo === "TERCER_PUESTO"),
    [rondasFase],
  );

  const rondasConsolacion = useMemo(
    () =>
      rondasFase.filter(
        (ronda) =>
          ronda.tipo === "CLASIFICACION" || ronda.tipo === "PERSONALIZADA",
      ),
    [rondasFase],
  );

  // ========================================================
  // PARTIDOS
  // ========================================================

  const partidosFase = useMemo(() => {
    if (!fase) {
      return [];
    }

    return partidos.filter((partido) => partido.fase_id === fase.id);
  }, [fase, partidos]);

  function partidosRonda(rondaID: string) {
    return partidosFase
      .filter((partido) => partido.ronda_id === rondaID)
      .sort((a, b) => a.orden - b.orden);
  }

  // ========================================================
  // PLAZAS
  // ========================================================

  function plazaPartido(partidoID: string, lado: "LOCAL" | "VISITANTE") {
    return (
      plazas.find(
        (plaza) => plaza.partido_id === partidoID && plaza.lado === lado,
      ) ?? null
    );
  }

  function descripcionPlaza(plaza: PlazaEliminatoria | null) {
    if (!plaza) {
      return {
        nombre: "Per determinar",

        equipo: null as EquipoEliminatoria | null,

        detalle: "",
      };
    }

    const resuelto = plaza.equipo_resuelto_id
      ? (equiposPorID.get(plaza.equipo_resuelto_id) ?? null)
      : null;

    if (resuelto) {
      return {
        nombre: resuelto.nombre,

        equipo: resuelto,

        detalle: "",
      };
    }

    if (plaza.origen_tipo === "EQUIPO") {
      const equipo = plaza.equipo_origen_id
        ? (equiposPorID.get(plaza.equipo_origen_id) ?? null)
        : null;

      return {
        nombre: equipo?.nombre ?? "Equip",

        equipo,

        detalle: "",
      };
    }

    if (plaza.origen_tipo === "POSICION_GRUPO") {
      const grupo = plaza.origen_grupo_id
        ? gruposPorID.get(plaza.origen_grupo_id)
        : null;

      return {
        nombre: `${plaza.origen_posicion ?? "?"}a posició`,

        equipo: null,

        detalle: grupo?.nombre ?? "Grup",
      };
    }

    if (plaza.origen_tipo === "POSICION_FASE") {
      return {
        nombre: `${plaza.origen_posicion ?? "?"}a posició`,

        equipo: null,

        detalle: "Fase anterior",
      };
    }

    if (
      plaza.origen_tipo === "GANADOR_PARTIDO" ||
      plaza.origen_tipo === "PERDEDOR_PARTIDO"
    ) {
      const origen = plaza.origen_partido_id
        ? partidosPorID.get(plaza.origen_partido_id)
        : null;

      return {
        nombre:
          plaza.origen_tipo === "GANADOR_PARTIDO" ? "Guanyador" : "Perdedor",

        equipo: null,

        detalle: origen?.nombre ?? origen?.codigo ?? "Partit",
      };
    }

    if (plaza.origen_tipo === "LIBRE") {
      return {
        nombre: "Lliure",

        equipo: null,

        detalle: "Bye",
      };
    }

    return {
      nombre: "Per determinar",

      equipo: null,

      detalle: "",
    };
  }

  // ========================================================
  // CAMBIO FASE
  // ========================================================

  function seleccionarFase(nuevaFaseID: string) {
    setFaseID(nuevaFaseID);

    const url = new URL(window.location.href);

    url.searchParams.set("fase", nuevaFaseID);

    window.history.replaceState({}, "", url);
  }

  // ========================================================
  // SIN FASE
  // ========================================================

  if (!fase || fases.length === 0) {
    return null;
  }

  // ========================================================
  // PARTIDOS SECUNDARIOS
  // ========================================================

  const partidosTercerPuesto = rondasTercerPuesto.flatMap((ronda) =>
    partidosRonda(ronda.id),
  );

  const partidosConsolacion = rondasConsolacion.flatMap((ronda) =>
    partidosRonda(ronda.id),
  );

  // ========================================================
  // UI
  // ========================================================

  return (
    <div
      className="
        flex
        min-w-0
        w-full
        max-w-full
        flex-col
        gap-8
        overflow-x-clip
      "
    >
      {/* ===============================================
          SELECTOR
      =============================================== */}

      {fases.length > 1 && (
        <div className="min-w-0 max-w-full overflow-x-auto">
          <div className="flex w-max gap-2 pb-1">
            {fases.map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => seleccionarFase(opcion.id)}
                className={
                  opcion.id === fase.id
                    ? "shrink-0 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white"
                    : "shrink-0 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral transition hover:border-primary/30 hover:text-primary"
                }
              >
                {opcion.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ===============================================
          CABECERA
      =============================================== */}

      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
          Eliminatòria
        </p>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-neutral-titulos sm:text-3xl">
              {fase.nombre}
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral">
              Quadre eliminatori de la competició.
            </p>
          </div>

          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-neutral">
            {partidosFase.length} partits
          </span>
        </div>
      </header>

      {/* ===============================================
          BRACKET PRINCIPAL
      =============================================== */}

      {rondasPrincipales.length > 0 && (
        <Bracket
          rondas={rondasPrincipales}
          partidos={partidosFase}
          plazas={plazas}
          resultadosPorPartido={resultadosPorPartido}
          pistaPorID={(id) => (id ? (pistasPorID.get(id) ?? null) : null)}
          descripcionPlaza={descripcionPlaza}
        />
      )}

      {/* ===============================================
          TERCER PUESTO
      =============================================== */}

      {partidosTercerPuesto.length > 0 && (
        <section className="min-w-0">
          <CabeceraSecundaria sobre="Classificació" titulo="3r i 4t lloc" />

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {partidosTercerPuesto.map((partido) => (
              <PartidoCard
                key={partido.id}
                partido={partido}
                resultado={resultadosPorPartido.get(partido.id) ?? null}
                local={descripcionPlaza(plazaPartido(partido.id, "LOCAL"))}
                visitante={descripcionPlaza(
                  plazaPartido(partido.id, "VISITANTE"),
                )}
                pista={
                  partido.pista_id
                    ? (pistasPorID.get(partido.pista_id) ?? null)
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* ===============================================
          CONSOLACIÓN
      =============================================== */}

      {partidosConsolacion.length > 0 && (
        <section className="min-w-0">
          <CabeceraSecundaria
            sobre="Fora del bracket"
            titulo="Partits de consolació"
          />

          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral">
            Partits de classificació que no formen part del quadre principal.
          </p>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {partidosConsolacion.map((partido) => (
              <PartidoCard
                key={partido.id}
                partido={partido}
                resultado={resultadosPorPartido.get(partido.id) ?? null}
                local={descripcionPlaza(plazaPartido(partido.id, "LOCAL"))}
                visitante={descripcionPlaza(
                  plazaPartido(partido.id, "VISITANTE"),
                )}
                pista={
                  partido.pista_id
                    ? (pistasPorID.get(partido.pista_id) ?? null)
                    : null
                }
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================
// BRACKET
// ============================================================

function Bracket({
  rondas,
  partidos,
  plazas,
  resultadosPorPartido,
  pistaPorID,
  descripcionPlaza,
}: {
  rondas: RondaEliminatoria[];

  partidos: PartidoEliminatoria[];

  plazas: PlazaEliminatoria[];

  resultadosPorPartido: Map<string, ResultadoEliminatoria>;

  pistaPorID: (id: string | null) => PistaEliminatoria | null;

  descripcionPlaza: (plaza: PlazaEliminatoria | null) => {
    nombre: string;

    equipo: EquipoEliminatoria | null;

    detalle: string;
  };
}) {
  // ========================================================
  // MEDIDAS
  // ========================================================

  const ANCHO = 268;

  const GAP_X = 70;

  const ALTO = 126;

  const SLOT = 158;

  // ========================================================
  // PARTIDOS POR RONDA
  // ========================================================

  const partidosPorRonda = new Map<string, PartidoEliminatoria[]>();

  for (const ronda of rondas) {
    partidosPorRonda.set(
      ronda.id,
      partidos
        .filter((partido) => partido.ronda_id === ronda.id)
        .sort((a, b) => a.orden - b.orden),
    );
  }

  const primera = partidosPorRonda.get(rondas[0]?.id ?? "") ?? [];

  // ========================================================
  // DIMENSIONES
  // ========================================================

  const alto = Math.max(primera.length * SLOT, 240);

  const ancho = rondas.length * ANCHO + Math.max(rondas.length - 1, 0) * GAP_X;

  // ========================================================
  // POSICIONES
  // ========================================================

  const posiciones = new Map<
    string,
    {
      x: number;
      y: number;
    }
  >();

  rondas.forEach((ronda, indiceRonda) => {
    const lista = partidosPorRonda.get(ronda.id) ?? [];

    const factor = 2 ** indiceRonda;

    lista.forEach((partido, indicePartido) => {
      const centroY = (indicePartido + 0.5) * factor * SLOT;

      posiciones.set(partido.id, {
        x: indiceRonda * (ANCHO + GAP_X),

        y: centroY - ALTO / 2,
      });
    });
  });

  // ========================================================
  // CONEXIONES
  // ========================================================

  const conexiones = plazas.filter(
    (plaza) =>
      plaza.partido_id &&
      plaza.origen_partido_id &&
      posiciones.has(plaza.partido_id) &&
      posiciones.has(plaza.origen_partido_id),
  );

  // ========================================================
  // UI
  // ========================================================

  return (
    <section
      className="
        min-w-0
        w-full
        max-w-full
        overflow-hidden
        rounded-2xl
        border
        border-border/60
        bg-card/30
      "
    >
      {/* CABECERA */}

      <div className="border-b border-border/50 px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-neutral-titulos">
          Bracket principal
        </p>
      </div>

      {/* SCROLL ÚNICAMENTE AQUÍ */}

      <div
        className="
          block
          min-w-0
          w-full
          max-w-full
          overflow-x-auto
          overflow-y-hidden
          overscroll-x-contain
          p-4
          sm:p-5
        "
      >
        {/* LIENZO GRANDE */}

        <div
          className="relative"
          style={{
            width: ancho,

            minWidth: ancho,
          }}
        >
          {/* =============================================
              CABECERAS RONDA
          ============================================= */}

          <div className="relative h-14">
            {rondas.map((ronda, indice) => (
              <div
                key={ronda.id}
                className="absolute top-0"
                style={{
                  width: ANCHO,

                  left: indice * (ANCHO + GAP_X),
                }}
              >
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-neutral">
                  Ronda {indice + 1}
                </p>

                <h3 className="mt-1 truncate text-sm font-bold text-neutral-titulos">
                  {ronda.nombre || nombreTipoRonda(ronda.tipo)}
                </h3>
              </div>
            ))}
          </div>

          {/* =============================================
              ÁREA DEL BRACKET
          ============================================= */}

          <div
            className="relative"
            style={{
              height: alto,

              minHeight: alto,

              width: ancho,

              minWidth: ancho,
            }}
          >
            {/* ===========================================
                LÍNEAS
            =========================================== */}

            <svg
              className="
                pointer-events-none
                absolute
                inset-0
                h-full
                w-full
                overflow-hidden
                text-border
              "
              viewBox={`0 0 ${ancho} ${alto}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {conexiones.map((conexion) => {
                const origen = posiciones.get(conexion.origen_partido_id!);

                const destino = posiciones.get(conexion.partido_id!);

                if (!origen || !destino) {
                  return null;
                }

                const x1 = origen.x + ANCHO;

                const y1 = origen.y + ALTO / 2;

                const x2 = destino.x;

                const y2 = destino.y + ALTO / 2;

                const medio = x1 + (x2 - x1) / 2;

                return (
                  <path
                    key={conexion.id}
                    d={
                      `M ${x1} ${y1} ` + `H ${medio} ` + `V ${y2} ` + `H ${x2}`
                    }
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* ===========================================
                PARTIDOS
            =========================================== */}

            {partidos.map((partido) => {
              const posicion = posiciones.get(partido.id);

              if (!posicion) {
                return null;
              }

              const local =
                plazas.find(
                  (plaza) =>
                    plaza.partido_id === partido.id && plaza.lado === "LOCAL",
                ) ?? null;

              const visitante =
                plazas.find(
                  (plaza) =>
                    plaza.partido_id === partido.id &&
                    plaza.lado === "VISITANTE",
                ) ?? null;

              return (
                <div
                  key={partido.id}
                  className="absolute z-[2]"
                  style={{
                    left: posicion.x,

                    top: posicion.y,

                    width: ANCHO,

                    height: ALTO,
                  }}
                >
                  <PartidoCard
                    partido={partido}
                    resultado={resultadosPorPartido.get(partido.id) ?? null}
                    local={descripcionPlaza(local)}
                    visitante={descripcionPlaza(visitante)}
                    pista={pistaPorID(partido.pista_id)}
                    compacto
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// TARJETA PARTIDO
// ============================================================

function PartidoCard({
  partido,
  resultado,
  local,
  visitante,
  pista,
  compacto = false,
}: {
  partido: PartidoEliminatoria;

  resultado: ResultadoEliminatoria | null;

  local: {
    nombre: string;

    equipo: EquipoEliminatoria | null;

    detalle: string;
  };

  visitante: {
    nombre: string;

    equipo: EquipoEliminatoria | null;

    detalle: string;
  };

  pista: PistaEliminatoria | null;

  compacto?: boolean;
}) {
  const fecha = formatearFechaHora(partido.fecha_hora);

  const tieneMarcador =
    resultado &&
    resultado.marcador_local !== null &&
    resultado.marcador_visitante !== null;

  const tipoResultado = resultado
    ? nombreTipoResultado(resultado.resultado_tipo)
    : "";

  return (
    <article
      className={
        compacto
          ? "flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm"
          : "overflow-hidden rounded-xl border border-border/70 bg-card"
      }
    >
      {/* =============================================
          HEADER
      ============================================= */}

      <div className="flex min-h-8 items-center justify-between gap-2 border-b border-border/40 px-3 py-1.5">
        <p className="min-w-0 truncate text-[10px] font-semibold text-neutral">
          {partido.nombre ?? partido.codigo}
        </p>

        <div className="flex shrink-0 items-center gap-1.5">
          {resultado && !resultado.confirmado && tieneMarcador && (
            <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[8px] font-bold text-orange-600">
              Provisional
            </span>
          )}

          <span className="text-[9px] font-semibold text-neutral">
            {nombreEstado(partido.estado)}
          </span>
        </div>
      </div>

      {/* =============================================
          EQUIPOS + MARCADOR
      ============================================= */}

      <div className="divide-y divide-border/30">
        <EquipSlot
          nombre={local.nombre}
          detalle={local.detalle}
          equipo={local.equipo}
          marcador={tieneMarcador ? (resultado?.marcador_local ?? null) : null}
          ganador={Boolean(
            resultado?.ganador_equipo_id &&
            local.equipo?.id === resultado.ganador_equipo_id,
          )}
        />

        <EquipSlot
          nombre={visitante.nombre}
          detalle={visitante.detalle}
          equipo={visitante.equipo}
          marcador={
            tieneMarcador ? (resultado?.marcador_visitante ?? null) : null
          }
          ganador={Boolean(
            resultado?.ganador_equipo_id &&
            visitante.equipo?.id === resultado.ganador_equipo_id,
          )}
        />
      </div>

      {/* =============================================
          FOOTER
      ============================================= */}

      {/* {(fecha || pista || tipoResultado) && (
        <div className="flex min-w-0 items-center gap-1.5 border-t border-border/40 px-3 py-1.5 text-[9px] text-neutral">
          {fecha && <span className="truncate">{fecha}</span>}

          {fecha && pista && <span>·</span>}

          {pista && <span className="truncate">{pista.nombre}</span>}

          {tipoResultado && (
            <>
              {(fecha || pista) && <span>·</span>}

              <span className="shrink-0 font-semibold">{tipoResultado}</span>
            </>
          )}
        </div>
      )} */}
    </article>
  );
}

// ============================================================
// SLOT EQUIPO
// ============================================================

function EquipSlot({
  nombre,
  detalle,
  equipo,
  marcador,
  ganador,
}: {
  nombre: string;

  detalle: string;

  equipo: EquipoEliminatoria | null;

  marcador: number | null;

  ganador: boolean;
}) {
  return (
    <div className="flex min-h-[39px] items-center gap-2 px-3 py-2">
      {/* ESCUDO */}

      {equipo?.escudo ? (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-0.5">
          <img
            src={equipo.escudo}
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[8px] font-bold text-primary">
          {iniciales(nombre)}
        </div>
      )}

      {/* NOMBRE */}

      <div className="min-w-0 flex-1">
        <p
          className={
            ganador
              ? "truncate text-xs font-bold text-neutral-titulos"
              : "truncate text-xs font-semibold text-neutral-titulos"
          }
        >
          {nombre}
        </p>

        {detalle && (
          <p className="truncate text-[9px] text-neutral">{detalle}</p>
        )}
      </div>

      {/* MARCADOR */}

      {marcador !== null && (
        <span
          className={
            ganador
              ? "min-w-6 shrink-0 text-right text-lg font-black leading-none text-primary"
              : "min-w-6 shrink-0 text-right text-lg font-bold leading-none text-neutral-titulos"
          }
        >
          {marcador}
        </span>
      )}
    </div>
  );
}

// ============================================================
// CABECERA SECUNDARIA
// ============================================================

function CabeceraSecundaria({
  sobre,
  titulo,
}: {
  sobre: string;
  titulo: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
        {sobre}
      </p>

      <h3 className="mt-1 text-lg font-bold text-neutral-titulos">{titulo}</h3>
    </div>
  );
}
