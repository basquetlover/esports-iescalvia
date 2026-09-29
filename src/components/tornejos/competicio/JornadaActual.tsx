type Equip = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Partit = {
  id: string;

  codigo: string;

  nombre: string | null;

  estado: string;

  fechaHora: string | null;

  pista: string | null;

  local: Equip | null;

  visitante: Equip | null;

  resultadoLocal: number | null;

  resultadoVisitante: number | null;

  finalizado: boolean;
};

type Jornada = {
  numero: number;

  contexto: "AVUI" | "DARRERA" | "PER_JUGAR" | "PROXIMA";

  partidos: Partit[];
};

type Props = {
  torneoID: string;

  edicionID: string;

  jornada: Jornada | null;
};

// ============================================================
// FECHA
// ============================================================

function fecha(valor: string | null) {
  if (!valor) {
    return null;
  }

  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "short",

    day: "2-digit",

    month: "short",

    timeZone: "Europe/Madrid",
  }).format(date);
}

function hora(valor: string | null) {
  if (!valor) {
    return null;
  }

  const date = new Date(valor);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",

    minute: "2-digit",

    timeZone: "Europe/Madrid",
  }).format(date);
}

// ============================================================
// CONTEXTO
// ============================================================

function etiquetaContexto(contexto: Jornada["contexto"]) {
  switch (contexto) {
    case "AVUI":
      return "Avui";

    case "DARRERA":
      return "Darrera";

    case "PER_JUGAR":
      return "Per jugar";

    default:
      return "Jornada";
  }
}

// ============================================================
// COMPONENTE
// ============================================================

export default function JornadaActual({ torneoID, edicionID, jornada }: Props) {
  return (
    <section
      className="
                overflow-hidden
                rounded-3xl
                border
                border-border
                bg-card
            "
    >
      {/* =============================================
                CABECERA
            ============================================= */}

      <div
        className="
                    flex
                    items-center
                    justify-between
                    gap-4
                    border-b
                    border-border/60
                    px-5
                    py-5
                "
      >
        <div>
          <p
            className="
                            text-xs
                            font-bold
                            uppercase
                            tracking-[0.16em]
                            text-primary
                        "
          >
            Resultats
          </p>

          <h3
            className="
                            mt-1
                            text-xl
                            font-bold
                            text-neutral-titulos
                        "
          >
            {jornada ? `Jornada ${jornada.numero}` : "Sense jornada"}
          </h3>
        </div>

        {jornada && (
          <span
            className="
                            rounded-full
                            bg-background
                            px-3
                            py-1.5
                            text-[10px]
                            font-bold
                            uppercase
                            tracking-wider
                            text-neutral
                        "
          >
            {etiquetaContexto(jornada.contexto)}
          </span>
        )}
      </div>

      {/* =============================================
                VACÍO
            ============================================= */}

      {!jornada ? (
        <div
          className="
                        px-6
                        py-14
                        text-center
                    "
        >
          <IconoCalendari
            className="
                            mx-auto
                            h-9
                            w-9
                            text-neutral/40
                        "
          />

          <p
            className="
                            mt-3
                            text-sm
                            text-neutral
                        "
          >
            Encara no hi ha jornades configurades.
          </p>
        </div>
      ) : (
        <div
          className="
                        divide-y
                        divide-border/60
                    "
        >
          {jornada.partidos.map((partit) => (
            <PartitCard
              key={partit.id}
              torneoID={torneoID}
              edicionID={edicionID}
              partit={partit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// PARTIDO
// ============================================================

function PartitCard({
  torneoID,
  edicionID,
  partit,
}: {
  torneoID: string;
  edicionID: string;
  partit: Partit;
}) {
  const teResultat =
    partit.resultadoLocal !== null && partit.resultadoVisitante !== null;

  const urlDetall =
    `/tornejos/${encodeURIComponent(torneoID)}` +
    `/partits/${encodeURIComponent(partit.id)}` +
    `?edicionID=${encodeURIComponent(edicionID)}`;

  return (
    <article
      className="
                px-4
                py-5
                sm:px-5
            "
    >
      {/* =============================================
                MARCADOR
            ============================================= */}

      <div
        className="
                    grid
                    grid-cols-[1fr_auto_1fr]
                    items-center
                    gap-3
                "
      >
        <EquipPartit equip={partit.local} dreta />

        <div
          className="
                        min-w-20
                        text-center
                    "
        >
          {teResultat ? (
            <div>
              <p
                className="
                                    text-xl
                                    font-black
                                    text-neutral-titulos
                                "
              >
                {partit.resultadoLocal}{" "}
                <span
                  className="
                                        text-base
                                        font-semibold
                                        text-neutral
                                    "
                >
                  -
                </span>{" "}
                {partit.resultadoVisitante}
              </p>

              {partit.finalizado && (
                <p
                  className="
                                        mt-1
                                        text-[9px]
                                        font-bold
                                        uppercase
                                        tracking-wider
                                        text-neutral
                                    "
                >
                  Final
                </p>
              )}
            </div>
          ) : (
            <div
              className="
                                rounded-xl
                                bg-background
                                px-3
                                py-2
                            "
            >
              <p
                className="
                                    text-sm
                                    font-black
                                    text-primary
                                "
              >
                {hora(partit.fechaHora) ?? "VS"}
              </p>
            </div>
          )}
        </div>

        <EquipPartit equip={partit.visitante} />
      </div>

      {/* =============================================
                META
            ============================================= */}

      {(partit.fechaHora || partit.pista) && (
        <div
          className="
                        mt-4
                        flex
                        flex-wrap
                        items-center
                        justify-center
                        gap-x-4
                        gap-y-2
                        text-[11px]
                        text-neutral
                    "
        >
          {partit.fechaHora && (
            <span
              className="
                                inline-flex
                                items-center
                                gap-1.5
                            "
            >
              <IconoCalendari
                className="
                                    h-3.5
                                    w-3.5
                                "
              />

              {fecha(partit.fechaHora)}
            </span>
          )}

          {partit.pista && (
            <span
              className="
                                inline-flex
                                items-center
                                gap-1.5
                            "
            >
              <IconoUbicacio
                className="
                                    h-3.5
                                    w-3.5
                                "
              />

              {partit.pista}
            </span>
          )}
        </div>
      )}

      {/* =============================================
                BOTÓN DETALLE
            ============================================= */}

      <div
        className="
                    mt-4
                    flex
                    justify-center
                "
      >
        <a
          href={urlDetall}
          className="
                        inline-flex
                        h-9
                        items-center
                        justify-center
                        gap-2
                        rounded-xl
                        border
                        border-border
                        bg-background
                        px-4
                        text-xs
                        font-bold
                        text-neutral-titulos
                        transition
                        hover:border-primary
                        hover:text-primary
                    "
        >
          Veure el partit
          <IconoFlecha
            className="
                            h-3.5
                            w-3.5
                        "
          />
        </a>
      </div>
    </article>
  );
}

// ============================================================
// EQUIPO
// ============================================================

function EquipPartit({
  equip,
  dreta = false,
}: {
  equip: Equip | null;
  dreta?: boolean;
}) {
  return (
    <div
      className={`
                flex
                min-w-0
                items-center
                gap-2
                ${dreta ? "justify-end text-right" : ""}
            `}
    >
      {dreta && (
        <p
          className="
                        min-w-0
                        truncate
                        text-sm
                        font-semibold
                        text-neutral-titulos
                    "
        >
          {equip?.nombre ?? "Per determinar"}
        </p>
      )}

      {equip?.escudo ? (
        <div
          className="
                        flex
                        h-8
                        w-8
                        shrink-0
                        items-center
                        justify-center
                        overflow-hidden
                        rounded-lg
                        border
                        border-border
                        bg-white
                        p-0.5
                    "
        >
          <img
            src={equip.escudo}
            alt=""
            className="
                            h-full
                            w-full
                            object-contain
                        "
          />
        </div>
      ) : (
        <div
          className="
                        h-8
                        w-8
                        shrink-0
                        rounded-lg
                        bg-background
                    "
        />
      )}

      {!dreta && (
        <p
          className="
                        min-w-0
                        truncate
                        text-sm
                        font-semibold
                        text-neutral-titulos
                    "
        >
          {equip?.nombre ?? "Per determinar"}
        </p>
      )}
    </div>
  );
}

// ============================================================
// SVG INLINE
// ============================================================

type IconProps = {
  className?: string;
};

function IconoCalendari({ className = "" }: IconProps) {
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
      <rect x="3" y="5" width="18" height="16" rx="2" />

      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function IconoUbicacio({ className = "" }: IconProps) {
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
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />

      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function IconoFlecha({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
