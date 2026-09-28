import { useMemo, useState } from "react";

// ============================================================
// TIPOS
// ============================================================

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

type Lado = {
  lado: "LOCAL" | "VISITANTE";

  resuelto: boolean;

  equipo: Equipo | null;
};

type Partido = {
  id: string;
  codigo: string;
  nombre: string | null;
  jornada: number | null;
  estado: string;
  fecha_hora: string | null;
  pista: string | null;
};

type Estructura = {
  fase: {
    nombre: string;
    tipo: string;
  } | null;

  grupo: {
    nombre: string;
  } | null;

  ronda: {
    nombre: string;
    tipo: string;
  } | null;
};

type Acta = {
  id: string;
  estado: string;
  version: number;
} | null;

type TipoEvento = "GOL" | "TARJETA_AMARILLA" | "TARJETA_ROJA";

type EventoTemporal = {
  id: string;

  tipo: TipoEvento;

  equipoID: string;

  equipoNombre: string;

  jugadorID: string;

  jugadorNombre: string;

  minuto: number | null;

  createdAt: string;

  anulado: boolean;
};

type Props = {
  partido: Partido;

  estructura: Estructura;

  equipos: {
    local: Lado;

    visitante: Lado;
  };

  acta: Acta;
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function ActaFutbol({
  partido,
  estructura,
  equipos,
  acta,
}: Props) {
  const [eventos, setEventos] = useState<EventoTemporal[]>([]);

  const [minuto, setMinuto] = useState("");

  const eventosActivos = useMemo(
    () => eventos.filter((evento) => !evento.anulado),
    [eventos],
  );

  const golesLocal = useMemo(
    () =>
      contarEventosEquipo(
        eventosActivos,
        equipos.local.equipo?.id ?? null,
        "GOL",
      ),
    [eventosActivos, equipos.local.equipo?.id],
  );

  const golesVisitante = useMemo(
    () =>
      contarEventosEquipo(
        eventosActivos,
        equipos.visitante.equipo?.id ?? null,
        "GOL",
      ),
    [eventosActivos, equipos.visitante.equipo?.id],
  );

  // ========================================================
  // AÑADIR EVENTO
  // ========================================================

  function registrarEvento(tipo: TipoEvento, equipo: Equipo, jugador: Jugador) {
    const minutoNumero = leerMinuto(minuto);

    const evento: EventoTemporal = {
      id: generarID(),

      tipo,

      equipoID: equipo.id,

      equipoNombre: equipo.nombre,

      jugadorID: jugador.id,

      jugadorNombre: nombreJugador(jugador),

      minuto: minutoNumero,

      createdAt: new Date().toISOString(),

      anulado: false,
    };

    setEventos((anteriores) => [...anteriores, evento]);
  }

  // ========================================================
  // ANULAR
  // ========================================================

  function anularEvento(eventoID: string) {
    setEventos((anteriores) =>
      anteriores.map((evento) =>
        evento.id === eventoID
          ? {
              ...evento,

              anulado: true,
            }
          : evento,
      ),
    );
  }

  return (
    <div className="space-y-5">
      {/* =================================================
                AVISO TEMPORAL
            ================================================= */}

      <div
        className="
                    flex
                    items-start
                    gap-3
                    rounded-xl
                    border
                    border-amber-200
                    bg-amber-50
                    p-4
                    text-amber-900
                "
      >
        <span className="material-symbols-rounded">construction</span>

        <div>
          <p className="text-sm font-bold">Prova de la interfície</p>

          <p className="mt-1 text-sm leading-5">
            En aquest pas pots provar gols i targetes, però encara no es desen
            ni a LocalStorage ni a Supabase.
          </p>
        </div>
      </div>

      {/* =================================================
                DATOS DEL PARTIDO
            ================================================= */}

      <section
        className="
                    rounded-xl
                    border
                    border-border
                    bg-card
                    p-5
                "
      >
        <div
          className="
                        flex
                        flex-col
                        gap-4
                        lg:flex-row
                        lg:items-center
                        lg:justify-between
                    "
        >
          <div>
            <div
              className="
                                flex
                                flex-wrap
                                items-center
                                gap-2
                            "
            >
              <Etiqueta>Futbol</Etiqueta>

              <Etiqueta>{nombreEstructura(estructura)}</Etiqueta>

              <Etiqueta>{partido.estado}</Etiqueta>
            </div>

            <h2
              className="
                                mt-3
                                text-2xl
                                font-bold
                                text-neutral-titulos
                            "
            >
              {partido.nombre || partido.codigo || "Partit"}
            </h2>
          </div>

          <div
            className="
                            grid
                            gap-2
                            text-sm
                            text-neutral
                            sm:grid-cols-2
                        "
          >
            <Info
              icono="calendar_month"
              texto={formatFecha(partido.fecha_hora)}
            />

            <Info
              icono="location_on"
              texto={partido.pista || "Pista pendent"}
            />

            <Info
              icono="format_list_numbered"
              texto={
                partido.jornada ? `Jornada ${partido.jornada}` : "Sense jornada"
              }
            />

            <Info
              icono="description"
              texto={
                acta
                  ? `Acta: ${nombreEstadoActa(acta.estado)}`
                  : "Acta no iniciada"
              }
            />
          </div>
        </div>
      </section>

      {/* =================================================
                MARCADOR
            ================================================= */}

      <section
        className="
                    grid
                    overflow-hidden
                    rounded-xl
                    border
                    border-border
                    bg-card
                    md:grid-cols-[1fr_auto_1fr]
                "
      >
        <MarcadorEquipo lado="LOCAL" equipo={equipos.local.equipo} />

        <div
          className="
                        flex
                        items-center
                        justify-center
                        border-y
                        border-border
                        bg-background
                        px-8
                        py-7
                        md:border-x
                        md:border-y-0
                    "
        >
          <div
            className="
                            flex
                            items-center
                            gap-5
                        "
          >
            <span
              className="
                                min-w-12
                                text-center
                                text-5xl
                                font-black
                                text-neutral-titulos
                            "
            >
              {golesLocal}
            </span>

            <span
              className="
                                text-2xl
                                font-bold
                                text-neutral
                            "
            >
              -
            </span>

            <span
              className="
                                min-w-12
                                text-center
                                text-5xl
                                font-black
                                text-neutral-titulos
                            "
            >
              {golesVisitante}
            </span>
          </div>
        </div>

        <MarcadorEquipo lado="VISITANT" equipo={equipos.visitante.equipo} />
      </section>

      {/* =================================================
                MINUTO
            ================================================= */}

      <section
        className="
                    flex
                    flex-col
                    gap-3
                    rounded-xl
                    border
                    border-border
                    bg-card
                    p-5
                    sm:flex-row
                    sm:items-end
                    sm:justify-between
                "
      >
        <div>
          <h3
            className="
                            font-bold
                            text-neutral-titulos
                        "
          >
            Registrar incidència
          </h3>

          <p
            className="
                            mt-1
                            text-sm
                            text-neutral
                        "
          >
            Selecciona directament l'acció al costat del jugador.
          </p>
        </div>

        <label
          className="
                        block
                        w-full
                        sm:w-40
                    "
        >
          <span
            className="
                            mb-1
                            block
                            text-xs
                            font-semibold
                            text-neutral
                        "
          >
            Minut opcional
          </span>

          <div className="relative">
            <input
              type="number"
              min="0"
              max="200"
              inputMode="numeric"
              value={minuto}
              onChange={(evento) => setMinuto(evento.target.value)}
              placeholder="Ex. 34"
              className="
                                h-10
                                w-full
                                rounded-lg
                                border
                                border-border
                                bg-background
                                px-3
                                pr-10
                                text-sm
                                text-neutral-titulos
                                outline-none
                                transition
                                focus:border-primary
                            "
            />

            <span
              className="
                                pointer-events-none
                                absolute
                                right-3
                                top-1/2
                                -translate-y-1/2
                                text-sm
                                font-bold
                                text-neutral
                            "
            >
              '
            </span>
          </div>
        </label>
      </section>

      {/* =================================================
                CONTENIDO PRINCIPAL
            ================================================= */}

      <div
        className="
                    grid
                    gap-5
                    2xl:grid-cols-[minmax(0,1fr)_380px]
                "
      >
        {/* =============================================
                    PLANTILLAS
                ============================================= */}

        <div
          className="
                        grid
                        gap-5
                        xl:grid-cols-2
                    "
        >
          <PlantillaEquipo
            lado="LOCAL"
            equipo={equipos.local.equipo}
            eventos={eventosActivos}
            onEvento={registrarEvento}
          />

          <PlantillaEquipo
            lado="VISITANT"
            equipo={equipos.visitante.equipo}
            eventos={eventosActivos}
            onEvento={registrarEvento}
          />
        </div>

        {/* =============================================
                    HISTORIAL
                ============================================= */}

        <Historial eventos={eventos} onAnular={anularEvento} />
      </div>
    </div>
  );
}

// ============================================================
// MARCADOR EQUIPO
// ============================================================

function MarcadorEquipo({
  lado,
  equipo,
}: {
  lado: string;
  equipo: Equipo | null;
}) {
  return (
    <div
      className="
                flex
                min-h-40
                flex-col
                items-center
                justify-center
                p-6
                text-center
            "
    >
      <p
        className="
                    text-xs
                    font-bold
                    uppercase
                    tracking-[0.15em]
                    text-neutral
                "
      >
        {lado}
      </p>

      <Escudo equipo={equipo} />

      <h3
        className="
                    mt-3
                    max-w-64
                    text-lg
                    font-bold
                    text-neutral-titulos
                "
      >
        {equipo?.nombre ?? "Equip per determinar"}
      </h3>
    </div>
  );
}

// ============================================================
// PLANTILLA
// ============================================================

function PlantillaEquipo({
  lado,
  equipo,
  eventos,
  onEvento,
}: {
  lado: string;

  equipo: Equipo | null;

  eventos: EventoTemporal[];

  onEvento: (tipo: TipoEvento, equipo: Equipo, jugador: Jugador) => void;
}) {
  return (
    <section
      className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
            "
    >
      <div
        className="
                    flex
                    items-center
                    justify-between
                    border-b
                    border-border
                    px-5
                    py-4
                "
      >
        <div>
          <p
            className="
                            text-xs
                            font-bold
                            uppercase
                            tracking-[0.14em]
                            text-neutral
                        "
          >
            {lado}
          </p>

          <h3
            className="
                            mt-1
                            font-bold
                            text-neutral-titulos
                        "
          >
            {equipo?.nombre ?? "Equip per determinar"}
          </h3>
        </div>

        {equipo && (
          <span
            className="
                            rounded-full
                            bg-background
                            px-3
                            py-1
                            text-xs
                            font-semibold
                            text-neutral
                        "
          >
            {equipo.jugadores.length} jugadors
          </span>
        )}
      </div>

      {!equipo ? (
        <div
          className="
                        p-8
                        text-center
                        text-sm
                        text-neutral
                    "
        >
          El creuament encara no està resolt.
        </div>
      ) : equipo.jugadores.length === 0 ? (
        <div
          className="
                        p-8
                        text-center
                        text-sm
                        text-neutral
                    "
        >
          No hi ha jugadors actius registrats.
        </div>
      ) : (
        <div
          className="
                        divide-y
                        divide-border
                    "
        >
          {equipo.jugadores.map((jugador) => {
            const goles = contarEventosJugador(eventos, jugador.id, "GOL");

            const amarillas = contarEventosJugador(
              eventos,
              jugador.id,
              "TARJETA_AMARILLA",
            );

            const rojas = contarEventosJugador(
              eventos,
              jugador.id,
              "TARJETA_ROJA",
            );

            return (
              <div
                key={jugador.id}
                className="
                                        p-4
                                    "
              >
                <div
                  className="
                                            flex
                                            flex-col
                                            gap-3
                                        "
                >
                  <div
                    className="
                                                flex
                                                min-w-0
                                                items-center
                                                justify-between
                                                gap-3
                                            "
                  >
                    <div
                      className="
                                                    flex
                                                    min-w-0
                                                    items-center
                                                    gap-3
                                                "
                    >
                      <div
                        className="
                                                        flex
                                                        size-9
                                                        shrink-0
                                                        items-center
                                                        justify-center
                                                        rounded-full
                                                        bg-background
                                                        text-sm
                                                        font-bold
                                                        text-neutral
                                                    "
                      >
                        <span
                          className="
                                                            material-symbols-rounded
                                                            text-lg
                                                        "
                        >
                          person
                        </span>
                      </div>

                      <p
                        className="
                                                        truncate
                                                        text-sm
                                                        font-semibold
                                                        text-neutral-titulos
                                                    "
                      >
                        {nombreJugador(jugador)}
                      </p>
                    </div>

                    <EstadisticasJugador
                      goles={goles}
                      amarillas={amarillas}
                      rojas={rojas}
                    />
                  </div>

                  <div
                    className="
                                                grid
                                                grid-cols-3
                                                gap-2
                                            "
                  >
                    <BotonEvento
                      tipo="GOL"
                      onClick={() => onEvento("GOL", equipo, jugador)}
                    />

                    <BotonEvento
                      tipo="TARJETA_AMARILLA"
                      onClick={() =>
                        onEvento("TARJETA_AMARILLA", equipo, jugador)
                      }
                    />

                    <BotonEvento
                      tipo="TARJETA_ROJA"
                      onClick={() => onEvento("TARJETA_ROJA", equipo, jugador)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================================================
// BOTÓN EVENTO
// ============================================================

function BotonEvento({
  tipo,
  onClick,
}: {
  tipo: TipoEvento;
  onClick: () => void;
}) {
  if (tipo === "GOL") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="
                    flex
                    h-9
                    items-center
                    justify-center
                    gap-1
                    rounded-lg
                    border
                    border-emerald-200
                    bg-emerald-50
                    px-2
                    text-xs
                    font-bold
                    text-emerald-800
                    transition
                    hover:bg-emerald-100
                "
      >
        <span
          className="
                        material-symbols-rounded
                        text-base
                    "
        >
          sports_soccer
        </span>
        Gol
      </button>
    );
  }

  if (tipo === "TARJETA_AMARILLA") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="
                    flex
                    h-9
                    items-center
                    justify-center
                    gap-2
                    rounded-lg
                    border
                    border-yellow-300
                    bg-yellow-50
                    px-2
                    text-xs
                    font-bold
                    text-yellow-900
                    transition
                    hover:bg-yellow-100
                "
      >
        <span
          className="
                        h-4
                        w-3
                        rounded-[2px]
                        bg-yellow-400
                    "
        />
        Groga
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="
                flex
                h-9
                items-center
                justify-center
                gap-2
                rounded-lg
                border
                border-red-200
                bg-red-50
                px-2
                text-xs
                font-bold
                text-red-800
                transition
                hover:bg-red-100
            "
    >
      <span
        className="
                    h-4
                    w-3
                    rounded-[2px]
                    bg-red-600
                "
      />
      Vermella
    </button>
  );
}

// ============================================================
// ESTADÍSTICAS JUGADOR
// ============================================================

function EstadisticasJugador({
  goles,
  amarillas,
  rojas,
}: {
  goles: number;
  amarillas: number;
  rojas: number;
}) {
  if (goles === 0 && amarillas === 0 && rojas === 0) {
    return null;
  }

  return (
    <div
      className="
                flex
                shrink-0
                items-center
                gap-2
                text-xs
                font-bold
            "
    >
      {goles > 0 && (
        <span
          className="
                        inline-flex
                        items-center
                        gap-1
                    "
        >
          ⚽ {goles}
        </span>
      )}

      {amarillas > 0 && (
        <span
          className="
                        inline-flex
                        items-center
                        gap-1
                    "
        >
          <span
            className="
                            h-3
                            w-2
                            rounded-[1px]
                            bg-yellow-400
                        "
          />

          {amarillas}
        </span>
      )}

      {rojas > 0 && (
        <span
          className="
                        inline-flex
                        items-center
                        gap-1
                    "
        >
          <span
            className="
                            h-3
                            w-2
                            rounded-[1px]
                            bg-red-600
                        "
          />

          {rojas}
        </span>
      )}
    </div>
  );
}

// ============================================================
// HISTORIAL
// ============================================================

function Historial({
  eventos,
  onAnular,
}: {
  eventos: EventoTemporal[];

  onAnular: (eventoID: string) => void;
}) {
  const ordenados = [...eventos].reverse();

  return (
    <section
      className="
                overflow-hidden
                rounded-xl
                border
                border-border
                bg-card
            "
    >
      <div
        className="
                    border-b
                    border-border
                    px-5
                    py-4
                "
      >
        <h3
          className="
                        font-bold
                        text-neutral-titulos
                    "
        >
          Historial
        </h3>

        <p
          className="
                        mt-1
                        text-xs
                        text-neutral
                    "
        >
          Incidències registrades en aquesta prova.
        </p>
      </div>

      {ordenados.length === 0 ? (
        <div
          className="
                        p-8
                        text-center
                    "
        >
          <span
            className="
                            material-symbols-rounded
                            text-4xl
                            text-neutral
                        "
          >
            history
          </span>

          <p
            className="
                            mt-2
                            text-sm
                            text-neutral
                        "
          >
            Encara no hi ha incidències.
          </p>
        </div>
      ) : (
        <div
          className="
                        divide-y
                        divide-border
                    "
        >
          {ordenados.map((evento) => (
            <div
              key={evento.id}
              className={`
                                    p-4
                                    ${evento.anulado ? "opacity-50" : ""}
                                `}
            >
              <div
                className="
                                        flex
                                        items-start
                                        justify-between
                                        gap-3
                                    "
              >
                <div
                  className="
                                            flex
                                            min-w-0
                                            gap-3
                                        "
                >
                  <IconoEvento tipo={evento.tipo} />

                  <div className="min-w-0">
                    <div
                      className="
                                                    flex
                                                    flex-wrap
                                                    items-center
                                                    gap-2
                                                "
                    >
                      <p
                        className={`
                                                        text-sm
                                                        font-bold
                                                        text-neutral-titulos
                                                        ${
                                                          evento.anulado
                                                            ? "line-through"
                                                            : ""
                                                        }
                                                    `}
                      >
                        {nombreTipoEvento(evento.tipo)}
                      </p>

                      {evento.minuto !== null && (
                        <span
                          className="
                                                            rounded
                                                            bg-background
                                                            px-1.5
                                                            py-0.5
                                                            text-xs
                                                            font-bold
                                                            text-neutral
                                                        "
                        >
                          {evento.minuto}'
                        </span>
                      )}

                      {evento.anulado && (
                        <span
                          className="
                                                            rounded
                                                            bg-red-50
                                                            px-1.5
                                                            py-0.5
                                                            text-[10px]
                                                            font-bold
                                                            uppercase
                                                            text-red-700
                                                        "
                        >
                          Anul·lat
                        </span>
                      )}
                    </div>

                    <p
                      className="
                                                    mt-1
                                                    truncate
                                                    text-sm
                                                    text-neutral-titulos
                                                "
                    >
                      {evento.jugadorNombre}
                    </p>

                    <p
                      className="
                                                    mt-0.5
                                                    text-xs
                                                    text-neutral
                                                "
                    >
                      {evento.equipoNombre}
                    </p>
                  </div>
                </div>

                {!evento.anulado && (
                  <button
                    type="button"
                    onClick={() => onAnular(evento.id)}
                    title="Anul·lar incidència"
                    className="
                                                flex
                                                size-8
                                                shrink-0
                                                items-center
                                                justify-center
                                                rounded-lg
                                                text-neutral
                                                transition
                                                hover:bg-background
                                                hover:text-red-600
                                            "
                  >
                    <span
                      className="
                                                    material-symbols-rounded
                                                    text-lg
                                                "
                    >
                      undo
                    </span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// ICONO EVENTO
// ============================================================

function IconoEvento({ tipo }: { tipo: TipoEvento }) {
  if (tipo === "GOL") {
    return (
      <div
        className="
                    flex
                    size-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-full
                    bg-emerald-50
                    text-emerald-700
                "
      >
        <span
          className="
                        material-symbols-rounded
                        text-lg
                    "
        >
          sports_soccer
        </span>
      </div>
    );
  }

  return (
    <div
      className="
                flex
                size-9
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-background
            "
    >
      <span
        className={`
                    h-5
                    w-3.5
                    rounded-[2px]
                    ${
                      tipo === "TARJETA_AMARILLA"
                        ? "bg-yellow-400"
                        : "bg-red-600"
                    }
                `}
      />
    </div>
  );
}

// ============================================================
// ESCUDO
// ============================================================

function Escudo({ equipo }: { equipo: Equipo | null }) {
  if (equipo?.escudo) {
    return (
      <div
        className="
                    mt-4
                    flex
                    size-16
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-xl
                    border
                    border-border
                    bg-white
                    p-2
                "
      >
        <img
          src={equipo.escudo}
          alt={`Escut de ${equipo.nombre}`}
          className="
                        h-full
                        w-full
                        object-contain
                    "
        />
      </div>
    );
  }

  return (
    <div
      className="
                mt-4
                flex
                size-16
                items-center
                justify-center
                rounded-xl
                border
                border-border
                bg-background
            "
    >
      <span
        className="
                    material-symbols-rounded
                    text-3xl
                    text-neutral
                "
      >
        shield
      </span>
    </div>
  );
}

// ============================================================
// PEQUEÑOS COMPONENTES
// ============================================================

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="
                inline-flex
                items-center
                rounded-full
                border
                border-border
                bg-background
                px-2.5
                py-1
                text-xs
                font-semibold
                text-neutral
            "
    >
      {children}
    </span>
  );
}

function Info({ icono, texto }: { icono: string; texto: string }) {
  return (
    <div
      className="
                flex
                items-center
                gap-2
            "
    >
      <span
        className="
                    material-symbols-rounded
                    text-lg
                "
      >
        {icono}
      </span>

      <span>{texto}</span>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function nombreJugador(jugador: Jugador) {
  const resultado = [jugador.nombre, jugador.apellido1, jugador.apellido2]
    .filter(
      (valor): valor is string =>
        typeof valor === "string" && Boolean(valor.trim()),
    )
    .map((valor) => valor.trim())
    .join(" ");

  return resultado || "Jugador sense nom";
}

function leerMinuto(valor: string): number | null {
  if (!valor.trim()) {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isSafeInteger(numero) || numero < 0) {
    return null;
  }

  return numero;
}

function contarEventosEquipo(
  eventos: EventoTemporal[],
  equipoID: string | null,
  tipo: TipoEvento,
) {
  if (!equipoID) {
    return 0;
  }

  return eventos.filter(
    (evento) => evento.equipoID === equipoID && evento.tipo === tipo,
  ).length;
}

function contarEventosJugador(
  eventos: EventoTemporal[],
  jugadorID: string,
  tipo: TipoEvento,
) {
  return eventos.filter(
    (evento) => evento.jugadorID === jugadorID && evento.tipo === tipo,
  ).length;
}

function nombreTipoEvento(tipo: TipoEvento) {
  switch (tipo) {
    case "GOL":
      return "Gol";

    case "TARJETA_AMARILLA":
      return "Targeta groga";

    case "TARJETA_ROJA":
      return "Targeta vermella";
  }
}

function nombreEstructura(estructura: Estructura) {
  if (estructura.ronda) {
    return estructura.ronda.nombre || estructura.ronda.tipo;
  }

  if (estructura.grupo) {
    return estructura.grupo.nombre;
  }

  if (estructura.fase) {
    return estructura.fase.nombre;
  }

  return "Sense fase";
}

function nombreEstadoActa(estado: string) {
  switch (estado) {
    case "NO_INICIADA":
      return "No iniciada";

    case "EN_CURSO":
      return "En curs";

    case "BLOQUEADA":
      return "Bloquejada";

    case "FINALIZADA":
      return "Finalitzada";

    default:
      return estado;
  }
}

function formatFecha(valor: string | null) {
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

function generarID() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}
