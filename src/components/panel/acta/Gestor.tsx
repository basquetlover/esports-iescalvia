import { useEffect, useState } from "react";

import ActaFutbol from "./futbol/ActaFutbol";

// ============================================================
// PROPS
// ============================================================

type Props = {
  partidoID: string;
  torneoID: string;
  edicionID: string;
};

// ============================================================
// TIPOS API
// ============================================================

type Torneo = {
  id: string;
  nombre: string | null;
  deporte: string | null;
  logo: string | null;
};

type Edicion = {
  id: string;
  torneo_id: string | null;
  nombre: string | null;
  estado: string | null;
  sede: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

type Partido = {
  id: string;
  edicion_id: string;
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
  duracion_estimada_min: number | null;
  publicado: boolean;
  finalizado_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type Jugador = {
  id: string;
  equipo_id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  tipo_participante: string | null;
  validacion_estado: string | null;
  orden: number | null;
  activo: boolean | null;
};

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
  jugadores: Jugador[];
};

type Plaza = {
  id: string;

  lado: "LOCAL" | "VISITANTE" | null;

  origen_tipo: string | null;
  equipo_origen_id: string | null;
  origen_grupo_id: string | null;
  origen_fase_id: string | null;
  origen_posicion: number | null;
  origen_partido_id: string | null;
  equipo_resuelto_id: string | null;
};

type Lado = {
  lado: "LOCAL" | "VISITANTE";

  resuelto: boolean;

  plaza: Plaza | null;

  equipo: Equipo | null;
};

type Acta = {
  id: string;
  partido_id: string;
  estado: string;
  nivel_estadisticas: string;
  operador_id: string | null;
  controlador_id: string | null;
  iniciada_at: string | null;
  bloqueada_por: string | null;
  bloqueada_at: string | null;
  motivo_bloqueo: string | null;
  finalizada_por: string | null;
  finalizada_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

type Estructura = {
  fase: {
    id: string;
    nombre: string;
    tipo: string;
    orden: number;
    estado: string;
    publicada: boolean;
  } | null;

  grupo: {
    id: string;
    fase_id: string;
    nombre: string;
    orden: number;
    estado: string;
  } | null;

  ronda: {
    id: string;
    fase_id: string;
    tipo: string;
    nombre: string;
    orden: number;
  } | null;
};

type DatosActa = {
  success: true;

  torneo: Torneo;

  edicion: Edicion;

  partido: Partido;

  estructura: Estructura;

  equipos: {
    local: Lado;

    visitante: Lado;
  };

  acta: Acta | null;
};

type RespuestaError = {
  success?: false;
  mensaje?: string;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function Gestor({ partidoID, torneoID, edicionID }: Props) {
  const [datos, setDatos] = useState<DatosActa | null>(null);

  const [cargando, setCargando] = useState(true);

  const [error, setError] = useState<string | null>(null);

  // ========================================================
  // CARGAR DATOS
  // ========================================================

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      setCargando(true);

      setError(null);

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
          partidoID,
        });

        const respuesta = await fetch(
          `/api/panell/acta?${parametros.toString()}`,
          {
            method: "GET",

            credentials: "same-origin",

            signal: controlador.signal,
          },
        );

        let contenido: DatosActa | RespuestaError;

        try {
          contenido = await respuesta.json();
        } catch {
          throw new Error("La resposta del servidor no és vàlida.");
        }

        if (!respuesta.ok || contenido.success !== true) {
          throw new Error(
            "mensaje" in contenido && typeof contenido.mensaje === "string"
              ? contenido.mensaje
              : "No s'ha pogut carregar l'acta.",
          );
        }

        setDatos(contenido);
      } catch (error) {
        if (controlador.signal.aborted) {
          return;
        }

        setDatos(null);

        setError(
          error instanceof Error
            ? error.message
            : "No s'ha pogut carregar l'acta.",
        );
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => {
      controlador.abort();
    };
  }, [partidoID, torneoID, edicionID]);

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargando) {
    return (
      <main className="w-full px-4 pb-10">
        <div className="mx-auto max-w-7xl">
          <Cabecera torneoID={torneoID} edicionID={edicionID} />

          <div
            className="
                            flex
                            min-h-[360px]
                            items-center
                            justify-center
                            rounded-xl
                            border
                            border-border
                            bg-card
                        "
          >
            <div className="text-center">
              <span
                className="
                                    material-symbols-rounded
                                    animate-spin
                                    text-4xl
                                    text-primary
                                "
              >
                progress_activity
              </span>

              <p
                className="
                                    mt-3
                                    text-sm
                                    font-medium
                                    text-neutral
                                "
              >
                Carregant l'acta...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ========================================================
  // ERROR
  // ========================================================

  if (error || !datos) {
    return (
      <main className="w-full px-4 pb-10">
        <div className="mx-auto max-w-7xl">
          <Cabecera torneoID={torneoID} edicionID={edicionID} />

          <div
            className="
                            rounded-xl
                            border
                            border-red-200
                            bg-red-50
                            p-6
                        "
          >
            <div
              className="
                                flex
                                items-start
                                gap-3
                            "
            >
              <span
                className="
                                    material-symbols-rounded
                                    text-red-600
                                "
              >
                error
              </span>

              <div>
                <h2
                  className="
                                        font-bold
                                        text-red-800
                                    "
                >
                  No s'ha pogut carregar l'acta
                </h2>

                <p
                  className="
                                        mt-1
                                        text-sm
                                        text-red-700
                                    "
                >
                  {error ?? "Error desconegut."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ========================================================
  // DEPORTE
  // ========================================================

  const deporte = normalizarDeporte(datos.torneo.deporte);

  return (
    <main className="w-full px-4 pb-10">
      <div className="mx-auto max-w-[1600px]">
        <Cabecera
          torneoID={torneoID}
          edicionID={edicionID}
          deporte={datos.torneo.deporte}
        />

        {/* =============================================
                    FUTBOL
                ============================================= */}

        {deporte === "FUTBOL" && (
          <ActaFutbol
            partido={datos.partido}
            estructura={datos.estructura}
            equipos={datos.equipos}
            acta={datos.acta}
          />
        )}

        {/* =============================================
                    VOLEIBOL
                ============================================= */}

        {deporte === "VOLEIBOL" && (
          <Proximamente
            icono="sports_volleyball"
            titulo="Acta de voleibol"
            texto="Les dades del partit ja estan carregades. El component específic de voleibol serà el següent que implementarem, amb marcador per sets i cronòmetre."
            datos={datos}
          />
        )}

        {/* =============================================
                    OTROS
                ============================================= */}

        {deporte !== "FUTBOL" && deporte !== "VOLEIBOL" && (
          <Proximamente
            icono="sports"
            titulo="Acta digital"
            texto="Encara no hi ha un component d'acta específic per aquest esport."
            datos={datos}
          />
        )}
      </div>
    </main>
  );
}

// ============================================================
// CABECERA GENERAL
// ============================================================

function Cabecera({
  torneoID,
  edicionID,
  deporte,
}: {
  torneoID: string;
  edicionID: string;
  deporte?: string | null;
}) {
  return (
    <header
      className="
                mb-6
                flex
                flex-col
                gap-4
                border-b
                border-border
                pb-5
                sm:flex-row
                sm:items-end
                sm:justify-between
            "
    >
      <div>
        <div
          className="
                        flex
                        items-center
                        gap-2
                    "
        >
          <p
            className="
                            text-xs
                            font-semibold
                            uppercase
                            tracking-[0.14em]
                            text-primary
                        "
          >
            Competició
          </p>

          {deporte && (
            <>
              <span className="text-neutral">·</span>

              <p
                className="
                                    text-xs
                                    font-semibold
                                    uppercase
                                    tracking-[0.14em]
                                    text-neutral
                                "
              >
                {deporte}
              </p>
            </>
          )}
        </div>

        <h1
          className="
                        mt-1
                        text-3xl
                        font-bold
                        tracking-tight
                        text-neutral-titulos
                        max-md:text-2xl
                    "
        >
          Acta digital
        </h1>

        <p
          className="
                        mt-1
                        text-sm
                        text-neutral
                    "
        >
          Gestió del partit, resultat i incidències.
        </p>
      </div>

      <a
        href={
          `/panell/partits` +
          `?torneoID=${encodeURIComponent(torneoID)}` +
          `&edicionID=${encodeURIComponent(edicionID)}`
        }
        className="
                    inline-flex
                    h-10
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    border
                    border-border
                    bg-card
                    px-4
                    text-sm
                    font-semibold
                    text-neutral-titulos
                    transition
                    hover:bg-background
                "
      >
        <span
          className="
                        material-symbols-rounded
                        text-lg
                    "
        >
          arrow_back
        </span>
        Tornar als partits
      </a>
    </header>
  );
}

// ============================================================
// VISTA TEMPORAL PARA DEPORTES NO IMPLEMENTADOS
// ============================================================

function Proximamente({
  icono,
  titulo,
  texto,
  datos,
}: {
  icono: string;
  titulo: string;
  texto: string;
  datos: DatosActa;
}) {
  return (
    <div className="space-y-5">
      <section
        className="
                    rounded-xl
                    border
                    border-border
                    bg-card
                    p-6
                "
      >
        <div
          className="
                        flex
                        items-start
                        gap-4
                    "
        >
          <div
            className="
                            flex
                            size-12
                            shrink-0
                            items-center
                            justify-center
                            rounded-xl
                            bg-primary/10
                            text-primary
                        "
          >
            <span
              className="
                                material-symbols-rounded
                                text-2xl
                            "
            >
              {icono}
            </span>
          </div>

          <div>
            <h2
              className="
                                text-xl
                                font-bold
                                text-neutral-titulos
                            "
            >
              {titulo}
            </h2>

            <p
              className="
                                mt-1
                                max-w-2xl
                                text-sm
                                leading-6
                                text-neutral
                            "
            >
              {texto}
            </p>
          </div>
        </div>
      </section>

      <section
        className="
                    grid
                    gap-5
                    md:grid-cols-2
                "
      >
        <EquipoResumen titulo="LOCAL" equipo={datos.equipos.local.equipo} />

        <EquipoResumen
          titulo="VISITANT"
          equipo={datos.equipos.visitante.equipo}
        />
      </section>
    </div>
  );
}

// ============================================================
// EQUIPO RESUMEN
// ============================================================

function EquipoResumen({
  titulo,
  equipo,
}: {
  titulo: string;

  equipo: Equipo | null;
}) {
  return (
    <section
      className="
                rounded-xl
                border
                border-border
                bg-card
                p-5
            "
    >
      <p
        className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.14em]
                    text-neutral
                "
      >
        {titulo}
      </p>

      <div
        className="
                    mt-3
                    flex
                    items-center
                    gap-4
                "
      >
        <div
          className="
                        flex
                        size-14
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-xl
                        border
                        border-border
                        bg-background
                        p-2
                    "
        >
          {equipo?.escudo ? (
            <img
              src={equipo.escudo}
              alt=""
              className="
                                h-full
                                w-full
                                object-contain
                            "
            />
          ) : (
            <span
              className="
                                material-symbols-rounded
                                text-2xl
                                text-neutral
                            "
            >
              shield
            </span>
          )}
        </div>

        <div>
          <h3
            className="
                            font-bold
                            text-neutral-titulos
                        "
          >
            {equipo?.nombre ?? "Equip per determinar"}
          </h3>

          {equipo && (
            <p
              className="
                                mt-1
                                text-sm
                                text-neutral
                            "
            >
              {equipo.jugadores.length} jugadors
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================
// HELPERS
// ============================================================

function normalizarDeporte(valor: string | null) {
  return (
    valor
      ?.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase() ?? ""
  );
}
