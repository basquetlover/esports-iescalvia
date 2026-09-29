import {
  useCallback,
  useEffect,
  useState,
} from "react";

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;

  edicionID: string;
};

type Equip = {
  id: string;

  nombre: string;

  escudo: string | null;

  capitan: string | null;

  posicion: number | null;

  pj: number | null;

  marcados: number | null;

  recibidos: number | null;
};

type Dades = {
  inscripcionFinalizada: boolean;

  cierreInscripcion: string | null;

  deporte: string;

  esFutbol: boolean;

  equipos: Equip[];
};

type RespostaAPI = {
  data?: Dades;

  mensaje?: string;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function EquipsClient({
  torneoID,
  edicionID,
}: Props) {
  const [
    dades,
    setDades,
  ] =
    useState<
      Dades | null
    >(
      null,
    );

  const [
    carregant,
    setCarregant,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  // ========================================================
  // CARGAR
  // ========================================================

  const carregar =
    useCallback(
      async (
        inicial =
          false,
      ) => {
        if (
          inicial
        ) {
          setCarregant(
            true,
          );
        }

        try {
          const params =
            new URLSearchParams({
              torneoID,
              edicionID,
            });

          const resposta =
            await fetch(
              `/api/torneos/equips?${params.toString()}`,
              {
                method:
                  "GET",

                cache:
                  "no-store",

                headers: {
                  Accept:
                    "application/json",
                },
              },
            );

          const json =
            (
              await resposta.json()
            ) as RespostaAPI;

          if (
            !resposta.ok ||
            !json.data
          ) {
            throw new Error(
              json.mensaje ??
                "No s'han pogut carregar els equips.",
            );
          }

          setDades(
            json.data,
          );

          setError(
            "",
          );
        } catch (
          error
        ) {
          setError(
            error instanceof
              Error
              ? error.message
              : "No s'han pogut carregar els equips.",
          );
        } finally {
          setCarregant(
            false,
          );
        }
      },
      [
        torneoID,
        edicionID,
      ],
    );

  // ========================================================
  // INICIAL
  // ========================================================

  useEffect(
    () => {
      void carregar(
        true,
      );
    },
    [
      carregar,
    ],
  );

  // ========================================================
  // ACTUALIZACIÓN
  // ========================================================

  useEffect(
    () => {
      const intervalo =
        window.setInterval(
          () => {
            void carregar();
          },
          30000,
        );

      return () => {
        window.clearInterval(
          intervalo,
        );
      };
    },
    [
      carregar,
    ],
  );

  // ========================================================
  // CARGANDO
  // ========================================================

  if (
    carregant &&
    !dades
  ) {
    return (
      <div
        className="
          flex
          min-h-64
          items-center
          justify-center
        "
      >
        <div
          className="
            text-center
          "
        >
          <IconoCargando
            className="
              mx-auto
              h-9
              w-9
              animate-spin
              text-primary
            "
          />

          <p
            className="
              mt-3
              text-sm
              text-neutral
            "
          >
            Carregant equips...
          </p>
        </div>
      </div>
    );
  }

  // ========================================================
  // ERROR
  // ========================================================

  if (
    !dades
  ) {
    return (
      <div
        className="
          rounded-3xl
          border
          border-border
          bg-card
          px-6
          py-14
          text-center
        "
      >
        <p
          className="
            font-bold
            text-neutral-titulos
          "
        >
          No s'han pogut carregar els equips
        </p>

        <p
          className="
            mt-2
            text-sm
            text-neutral
          "
        >
          {error}
        </p>

        <button
          type="button"
          onClick={() =>
            void carregar(
              true,
            )
          }
          className="
            mt-5
            rounded-xl
            bg-primary
            px-5
            py-2.5
            text-sm
            font-bold
            text-white
          "
        >
          Tornar-ho a intentar
        </button>
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div>
      <div
        className="
          mb-6
          flex
          flex-col
          gap-3
          sm:flex-row
          sm:items-end
          sm:justify-between
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
            Equips
          </p>

          <h2
            className="
              mt-1
              text-2xl
              font-bold
              tracking-tight
              text-neutral-titulos
              sm:text-3xl
            "
          >
            Equips participants
          </h2>

          <p
            className="
              mt-2
              max-w-2xl
              text-sm
              text-neutral
            "
          >
            {dades.inscripcionFinalizada
              ? "Consulta els equips participants i les seves dades de competició."
              : "Els equips apareixen aquí a mesura que la seva inscripció és aprovada i la plaça queda confirmada."}
          </p>
        </div>

        <span
          className="
            inline-flex
            w-fit
            items-center
            gap-2
            rounded-full
            bg-primary/10
            px-3
            py-1.5
            text-xs
            font-bold
            text-primary
          "
        >
          <IconoEquip
            className="
              h-4
              w-4
            "
          />

          {dades.equipos.length}{" "}
          {dades.equipos.length ===
          1
            ? "equip"
            : "equips"}
        </span>
      </div>

      {dades.equipos.length ===
      0 ? (
        <div
          className="
            rounded-3xl
            border
            border-dashed
            border-border
            bg-card/50
            px-6
            py-16
            text-center
          "
        >
          <IconoEquip
            className="
              mx-auto
              h-10
              w-10
              text-neutral/40
            "
          />

          <h3
            className="
              mt-4
              font-bold
              text-neutral-titulos
            "
          >
            Encara no hi ha equips confirmats
          </h3>

          <p
            className="
              mx-auto
              mt-2
              max-w-md
              text-sm
              text-neutral
            "
          >
            Els equips apareixeran automàticament quan la seva inscripció sigui aprovada.
          </p>
        </div>
      ) : (
        <div
          className="
            grid
            gap-5
            md:grid-cols-2
            xl:grid-cols-3
          "
        >
          {dades.equipos.map(
            equip => (
              <a
                key={
                  equip.id
                }
                href={`/tornejos/${encodeURIComponent(
                  torneoID,
                )}/equips/${encodeURIComponent(
                  equip.id,
                )}`}
                className="
                  group
                  block
                  rounded-3xl
                  focus:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-primary
                  focus-visible:ring-offset-2
                "
              >
                <TargetaEquip
                  equip={
                    equip
                  }
                  mostrarEstadistiques={
                    dades.inscripcionFinalizada
                  }
                  esFutbol={
                    dades.esFutbol
                  }
                />
              </a>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// TARJETA
// ============================================================

function TargetaEquip({
  equip,
  mostrarEstadistiques,
  esFutbol,
}: {
  equip: Equip;

  mostrarEstadistiques: boolean;

  esFutbol: boolean;
}) {
  return (
    <article
      className="
        h-full
        overflow-hidden
        rounded-3xl
        border
        border-border
        bg-card
        transition
        duration-200
        group-hover:-translate-y-0.5
        group-hover:border-primary/30
        group-hover:shadow-md
      "
    >
      <div
        className="
          flex
          items-start
          gap-4
          p-5
        "
      >
        {equip.escudo ? (
          <div
            className="
              flex
              h-16
              w-16
              shrink-0
              items-center
              justify-center
              overflow-hidden
              rounded-2xl
              border
              border-border
              bg-white
              p-2
            "
          >
            <img
              src={
                equip.escudo
              }
              alt={`Escut de ${equip.nombre}`}
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
              flex
              h-16
              w-16
              shrink-0
              items-center
              justify-center
              rounded-2xl
              bg-primary/10
              text-xl
              font-black
              text-primary
            "
          >
            {equip.nombre
              .charAt(
                0,
              )
              .toUpperCase()}
          </div>
        )}

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <h3
              className="
                min-w-0
                flex-1
                truncate
                text-lg
                font-bold
                text-neutral-titulos
              "
            >
              {equip.nombre}
            </h3>

            <span
              className="
                shrink-0
                text-primary
                opacity-60
                transition
                group-hover:translate-x-0.5
                group-hover:opacity-100
              "
            >
              →
            </span>
          </div>

          <div
            className="
              mt-2
              flex
              items-center
              gap-2
              text-sm
              text-neutral
            "
          >
            <IconoCapita
              className="
                h-4
                w-4
                shrink-0
              "
            />

            <span
              className="
                truncate
              "
            >
              <span
                className="
                  font-semibold
                "
              >
                Capità:
              </span>{" "}
              {equip.capitan ??
                "No indicat"}
            </span>
          </div>
        </div>

        {mostrarEstadistiques && (
          <div
            className="
              shrink-0
              text-center
            "
          >
            <p
              className="
                text-2xl
                font-black
                text-primary
              "
            >
              {equip.posicion ??
                "—"}
            </p>

            <p
              className="
                text-[9px]
                font-bold
                uppercase
                tracking-wider
                text-neutral
              "
            >
              Posició
            </p>
          </div>
        )}
      </div>

      {mostrarEstadistiques && (
        <div
          className="
            grid
            grid-cols-3
            border-t
            border-border/60
            bg-background/35
          "
        >
          <Estadistica
            valor={
              equip.pj ??
              0
            }
            etiqueta="PJ"
            descripcion="Partits jugats"
          />

          <Estadistica
            valor={
              equip.marcados ??
              0
            }
            etiqueta={
              esFutbol
                ? "GM"
                : "PF"
            }
            descripcion={
              esFutbol
                ? "Gols marcats"
                : "Punts a favor"
            }
          />

          <Estadistica
            valor={
              equip.recibidos ??
              0
            }
            etiqueta={
              esFutbol
                ? "GR"
                : "PC"
            }
            descripcion={
              esFutbol
                ? "Gols rebuts"
                : "Punts en contra"
            }
          />
        </div>
      )}
    </article>
  );
}

// ============================================================
// ESTADÍSTICA
// ============================================================

function Estadistica({
  valor,
  etiqueta,
  descripcion,
}: {
  valor: number;

  etiqueta: string;

  descripcion: string;
}) {
  return (
    <div
      title={
        descripcion
      }
      className="
        px-3
        py-4
        text-center
        [&+&]:border-l
        [&+&]:border-border/60
      "
    >
      <p
        className="
          text-xl
          font-black
          text-neutral-titulos
        "
      >
        {valor}
      </p>

      <p
        className="
          mt-1
          text-[10px]
          font-bold
          uppercase
          tracking-[0.12em]
          text-neutral
        "
      >
        {etiqueta}
      </p>
    </div>
  );
}

// ============================================================
// ICONOS
// ============================================================

type IconProps = {
  className?: string;
};

function IconoCargando({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={
        className
      }
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity=".2"
      />

      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconoEquip({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        className
      }
      aria-hidden="true"
    >
      <circle
        cx="9"
        cy="8"
        r="3"
      />

      <path
        d="M3 19c0-3 2.5-5 6-5s6 2 6 5"
      />

      <path
        d="M16 5.5a3 3 0 0 1 0 5"
      />

      <path
        d="M17 14c2.4.5 4 2.2 4 5"
      />
    </svg>
  );
}

function IconoCapita({
  className = "",
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        className
      }
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="8"
        r="4"
      />

      <path
        d="M4 21c0-4 3.5-7 8-7s8 3 8 7"
      />
    </svg>
  );
}