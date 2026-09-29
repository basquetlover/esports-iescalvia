import {
  useCallback,
  useEffect,
  useState,
} from "react";

import ClassificacioCompleta from
  "@components/tornejos/competicio/ClassificacioCompleta";

// ============================================================
// TIPOS
// ============================================================

type Props = {
  torneoID: string;

  edicionID: string;

  grupoID: string;

  equipsDestacats: string[];
};

type Equip = {
  id: string;

  nombre: string;

  escudo: string | null;
};

type EstadoForma =
  | "GANADO"
  | "EMPATADO"
  | "PERDIDO"
  | "PENDIENTE";

type FormaPartido = {
  partidoID: string | null;

  estado: EstadoForma;

  jornada: number | null;

  marcadorFavor: number | null;

  marcadorContra: number | null;
};

type FilaClassificacio = {
  equipo: Equip;

  posicion: number | null;

  pj: number | null;

  pg: number | null;

  pe: number | null;

  pp: number | null;

  favor: number | null;

  contra: number | null;

  diferencia: number | null;

  puntos: number | null;

  amarillas: number | null;

  rojas: number | null;

  forma?: FormaPartido[];
};

type DadesCompeticio = {
  deporte: string;

  esFutbol: boolean;

  etiquetas: {
    favor: string;

    contra: string;
  };

  grupo: {
    id: string;

    nombre: string;

    estado: string;

    faseID: string;

    faseNombre: string;
  } | null;

  tieneClasificacion: boolean;

  clasificacion:
    FilaClassificacio[];
};

type RespostaAPI = {
  data?:
    DadesCompeticio;

  mensaje?:
    string;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function ClassificacioPartitClient({
  torneoID,
  edicionID,
  grupoID,
  equipsDestacats,
}: Props) {
  const [
    dades,
    setDades,
  ] =
    useState<
      DadesCompeticio | null
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
        mostrarCarrega =
          false,
      ) => {
        if (
          mostrarCarrega
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
              grupoID,
            });

          const resposta =
            await fetch(
              `/api/torneos/competicio?${params.toString()}`,
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
                "No s'ha pogut carregar la classificació.",
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
              : "No s'ha pogut carregar la classificació.",
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
        grupoID,
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
  // CARGANDO
  // ========================================================

  if (
    carregant &&
    !dades
  ) {
    return (
      <section
        className="
          mx-auto
          w-full
          max-w-6xl
          px-4
          pb-12
          sm:px-6
          lg:px-8
        "
      >
        <div
          className="
            flex
            min-h-48
            items-center
            justify-center
            rounded-3xl
            border
            border-border
            bg-card
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
                h-8
                w-8
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
              Carregant classificació...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // ========================================================
  // ERROR
  // ========================================================

  if (
    !dades
  ) {
    return (
      <section
        className="
          mx-auto
          w-full
          max-w-6xl
          px-4
          pb-12
          sm:px-6
          lg:px-8
        "
      >
        <div
          className="
            rounded-3xl
            border
            border-border
            bg-card
            px-6
            py-10
            text-center
          "
        >
          <p
            className="
              font-semibold
              text-neutral-titulos
            "
          >
            No s'ha pogut carregar la classificació.
          </p>

          {error && (
            <p
              className="
                mt-2
                text-sm
                text-neutral
              "
            >
              {error}
            </p>
          )}

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
      </section>
    );
  }

  // ========================================================
  // SIN GRUPO
  // ========================================================

  if (
    !dades.grupo
  ) {
    return null;
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <section
      className="
        mx-auto
        w-full
        max-w-6xl
        px-4
        pb-12
        sm:px-6
        lg:px-8
      "
    >
      <ClassificacioCompleta
        grupNom={
          dades.grupo.nombre
        }
        files={
          dades.clasificacion
        }
        esFutbol={
          dades.esFutbol
        }
        etiquetaFavor={
          dades.etiquetas.favor
        }
        etiquetaContra={
          dades.etiquetas.contra
        }
        teClassificacio={
          dades.tieneClasificacion
        }
        equipsDestacats={
          equipsDestacats
        }
      />
    </section>
  );
}

// ============================================================
// ICONO CARGANDO
// ============================================================

type IconProps = {
  className?:
    string;
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