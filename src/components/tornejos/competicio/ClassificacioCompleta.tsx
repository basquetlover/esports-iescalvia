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

type Fila = {
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

type Props = {
  grupNom: string;

  files: Fila[];

  esFutbol: boolean;

  etiquetaFavor: string;

  etiquetaContra: string;

  teClassificacio: boolean;

  /*
   * Opcional.
   *
   * Se utiliza, por ejemplo, en la página de un partido
   * para destacar local y visitante.
   */
  equipsDestacats?: string[];
};

// ============================================================
// ICONOS FORMA
// ============================================================

const ICONOS_FORMA: Record<
  EstadoForma,
  string
> = {
  GANADO:
    "/iconos/tornejos/forma/guanyat.svg",

  EMPATADO:
    "/iconos/tornejos/forma/empatat.svg",

  PERDIDO:
    "/iconos/tornejos/forma/perdut.svg",

  PENDIENTE:
    "/iconos/tornejos/forma/per-jugar.svg",
};

// ============================================================
// VALORES
// ============================================================

function valor(
  numero: number | null,
) {
  return numero === null
    ? "—"
    : numero;
}

function diferencia(
  numero: number | null,
) {
  if (
    numero === null
  ) {
    return "—";
  }

  return numero > 0
    ? `+${numero}`
    : numero;
}

// ============================================================
// COMPLETAR FORMA
// ============================================================

function completarForma(
  forma: FormaPartido[],
) {
  const resultado =
    forma.slice(
      0,
      5,
    );

  while (
    resultado.length < 5
  ) {
    resultado.push({
      partidoID:
        null,

      estado:
        "PENDIENTE",

      jornada:
        null,

      marcadorFavor:
        null,

      marcadorContra:
        null,
    });
  }

  return resultado;
}

// ============================================================
// COMPONENTE
// ============================================================

export default function ClassificacioCompleta({
  grupNom,
  files,
  esFutbol,
  etiquetaFavor,
  etiquetaContra,
  teClassificacio,
  equipsDestacats = [],
}: Props) {
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
          flex-col
          gap-3
          border-b
          border-border/60
          px-5
          py-5
          sm:flex-row
          sm:items-center
          sm:justify-between
          sm:px-6
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
            Classificació
          </p>

          <h3
            className="
              mt-1
              text-xl
              font-bold
              text-neutral-titulos
              sm:text-2xl
            "
          >
            {grupNom}
          </h3>
        </div>

        <span
          className={`
            inline-flex
            w-fit
            items-center
            gap-2
            rounded-full
            px-3
            py-1.5
            text-xs
            font-bold

            ${
              teClassificacio
                ? "bg-green-50 text-green-700"
                : "bg-background text-neutral"
            }
          `}
        >
          <span
            className={`
              h-2
              w-2
              rounded-full

              ${
                teClassificacio
                  ? "bg-green-500"
                  : "bg-neutral/40"
              }
            `}
          />

          {teClassificacio
            ? "Actualitzada"
            : "Pendent de calcular"}
        </span>
      </div>

      {/* =============================================
          DESKTOP
      ============================================= */}

      <div
        className="
          hidden
          overflow-x-auto
          md:block
        "
      >
        <table
          className="
            w-full
            min-w-[1020px]
            border-collapse
          "
        >
          <thead
            className="
              bg-background/55
            "
          >
            <tr
              className="
                border-b
                border-border/50
                text-[10px]
                font-bold
                uppercase
                tracking-wider
                text-neutral
              "
            >
              <th
                className="
                  w-16
                  px-4
                  py-3
                  text-center
                "
              >
                #
              </th>

              <th
                className="
                  px-4
                  py-3
                  text-left
                "
              >
                Equip
              </th>

              <th className="px-3 py-3 text-center">
                PJ
              </th>

              <th className="px-3 py-3 text-center">
                PG
              </th>

              <th className="px-3 py-3 text-center">
                PE
              </th>

              <th className="px-3 py-3 text-center">
                PP
              </th>

              <th className="px-3 py-3 text-center">
                {etiquetaFavor}
              </th>

              <th className="px-3 py-3 text-center">
                {etiquetaContra}
              </th>

              <th className="px-3 py-3 text-center">
                DIF
              </th>

              {esFutbol && (
                <>
                  <th className="px-3 py-3 text-center">
                    TA
                  </th>

                  <th className="px-3 py-3 text-center">
                    TR
                  </th>
                </>
              )}

              <th
                className="
                  px-4
                  py-3
                  text-center
                "
              >
                Forma
              </th>

              <th
                className="
                  px-5
                  py-3
                  text-center
                "
              >
                PTS
              </th>
            </tr>
          </thead>

          <tbody
            className="
              divide-y
              divide-border/50
            "
          >
            {files.map(
              (
                fila,
                index,
              ) => (
                <FilaDesktop
                  key={
                    fila.equipo.id
                  }
                  fila={
                    fila
                  }
                  index={
                    index
                  }
                  esFutbol={
                    esFutbol
                  }
                  destacada={
                    equipsDestacats.includes(
                      fila.equipo.id,
                    )
                  }
                />
              ),
            )}
          </tbody>
        </table>
      </div>

      {/* =============================================
          MOBILE
      ============================================= */}

      <div
        className="
          divide-y
          divide-border/60
          md:hidden
        "
      >
        {files.map(
          (
            fila,
            index,
          ) => (
            <FilaMobil
              key={
                fila.equipo.id
              }
              fila={
                fila
              }
              index={
                index
              }
              esFutbol={
                esFutbol
              }
              etiquetaFavor={
                etiquetaFavor
              }
              etiquetaContra={
                etiquetaContra
              }
              destacada={
                equipsDestacats.includes(
                  fila.equipo.id,
                )
              }
            />
          ),
        )}
      </div>

      {/* =============================================
          SIN EQUIPOS
      ============================================= */}

      {files.length === 0 && (
        <div
          className="
            px-6
            py-14
            text-center
          "
        >
          <p
            className="
              font-semibold
              text-neutral-titulos
            "
          >
            No hi ha equips en aquest grup.
          </p>
        </div>
      )}

      {/* =============================================
          LEYENDA
      ============================================= */}

      {files.length > 0 && (
        <Llegenda
          esFutbol={
            esFutbol
          }
          etiquetaFavor={
            etiquetaFavor
          }
          etiquetaContra={
            etiquetaContra
          }
        />
      )}
    </section>
  );
}

// ============================================================
// FILA DESKTOP
// ============================================================

function FilaDesktop({
  fila,
  index,
  esFutbol,
  destacada,
}: {
  fila: Fila;

  index: number;

  esFutbol: boolean;

  destacada: boolean;
}) {
  return (
    <tr
      className={`
        transition

        ${
          destacada
            ? "bg-primary/10 hover:bg-primary/15"
            : "hover:bg-background/40"
        }
      `}
    >
      <td
        className={`
          border-l-4
          px-4
          py-3
          text-center

          ${
            destacada
              ? "border-primary"
              : "border-transparent"
          }
        `}
      >
        <Posicio
          posicion={
            fila.posicion ??
            index + 1
          }
          destacada={
            index < 2
          }
        />
      </td>

      <td
        className="
          px-4
          py-3
        "
      >
        <Equip
          equip={
            fila.equipo
          }
        />
      </td>

      <Celda
        valor={
          fila.pj
        }
      />

      <Celda
        valor={
          fila.pg
        }
      />

      <Celda
        valor={
          fila.pe
        }
      />

      <Celda
        valor={
          fila.pp
        }
      />

      <Celda
        valor={
          fila.favor
        }
      />

      <Celda
        valor={
          fila.contra
        }
      />

      <td
        className="
          px-3
          py-3
          text-center
          text-sm
          font-semibold
          text-neutral-titulos
        "
      >
        {diferencia(
          fila.diferencia,
        )}
      </td>

      {esFutbol && (
        <>
          <Celda
            valor={
              fila.amarillas
            }
          />

          <Celda
            valor={
              fila.rojas
            }
          />
        </>
      )}

      <td
        className="
          px-4
          py-3
          text-center
        "
      >
        <Forma
          forma={
            completarForma(
              fila.forma ??
                [],
            )
          }
          centrada
        />
      </td>

      <td
        className="
          px-5
          py-3
          text-center
        "
      >
        <span
          className="
            inline-flex
            min-w-10
            items-center
            justify-center
            rounded-xl
            bg-secondary/10
            px-2
            py-1.5
            text-base
            font-black
            text-secondary
          "
        >
          {valor(
            fila.puntos,
          )}
        </span>
      </td>
    </tr>
  );
}

// ============================================================
// FILA MOBILE
// ============================================================

function FilaMobil({
  fila,
  index,
  esFutbol,
  etiquetaFavor,
  etiquetaContra,
  destacada,
}: {
  fila: Fila;

  index: number;

  esFutbol: boolean;

  etiquetaFavor: string;

  etiquetaContra: string;

  destacada: boolean;
}) {
  return (
    <article
      className={`
        border-l-4
        px-4
        py-4
        transition

        ${
          destacada
            ? "border-primary bg-primary/10"
            : "border-transparent"
        }
      `}
    >
      <div
        className="
          flex
          items-center
          gap-3
        "
      >
        <Posicio
          posicion={
            fila.posicion ??
            index + 1
          }
          destacada={
            index < 2
          }
        />

        <div
          className="
            min-w-0
            flex-1
          "
        >
          <Equip
            equip={
              fila.equipo
            }
          />

          <div
            className="
              mt-2
            "
          >
            <Forma
              forma={
                completarForma(
                  fila.forma ??
                    [],
                )
              }
            />
          </div>
        </div>

        <div
          className="
            shrink-0
            text-right
          "
        >
          <p
            className="
              text-[10px]
              font-bold
              uppercase
              tracking-wider
              text-neutral
            "
          >
            Punts
          </p>

          <p
            className="
              text-xl
              font-black
              text-primary
            "
          >
            {valor(
              fila.puntos,
            )}
          </p>
        </div>
      </div>

      <div
        className="
          mt-4
          grid
          grid-cols-4
          gap-2
        "
      >
        <DadaMobil
          etiqueta="PJ"
          valor={
            fila.pj
          }
        />

        <DadaMobil
          etiqueta="PG"
          valor={
            fila.pg
          }
        />

        <DadaMobil
          etiqueta="PE"
          valor={
            fila.pe
          }
        />

        <DadaMobil
          etiqueta="PP"
          valor={
            fila.pp
          }
        />

        <DadaMobil
          etiqueta={
            etiquetaFavor
          }
          valor={
            fila.favor
          }
        />

        <DadaMobil
          etiqueta={
            etiquetaContra
          }
          valor={
            fila.contra
          }
        />

        <DadaMobil
          etiqueta="DIF"
          valorTexto={
            diferencia(
              fila.diferencia,
            )
          }
        />

        {esFutbol ? (
          <DadaMobil
            etiqueta="TA / TR"
            valorTexto={`${valor(
              fila.amarillas,
            )} / ${valor(
              fila.rojas,
            )}`}
          />
        ) : (
          <div />
        )}
      </div>
    </article>
  );
}

// ============================================================
// FORMA
// ============================================================

function Forma({
  forma,
  centrada = false,
}: {
  forma: FormaPartido[];

  centrada?: boolean;
}) {
  return (
    <div
      className={`
        flex
        items-center
        gap-1.5

        ${
          centrada
            ? "justify-center"
            : ""
        }
      `}
    >
      {forma.map(
        (
          partido,
          index,
        ) => (
          <IndicadorForma
            key={`${partido.partidoID ?? "pendent"}-${index}`}
            partido={
              partido
            }
          />
        ),
      )}
    </div>
  );
}

// ============================================================
// INDICADOR FORMA
// ============================================================

function IndicadorForma({
  partido,
}: {
  partido: FormaPartido;
}) {
  const nombre =
    nombreEstadoForma(
      partido.estado,
    );

  const marcador =
    partido.marcadorFavor !==
      null &&
    partido.marcadorContra !==
      null
      ? ` · ${partido.marcadorFavor}-${partido.marcadorContra}`
      : "";

  const jornada =
    partido.jornada !==
    null
      ? `Jornada ${partido.jornada} · `
      : "";

  return (
    <img
      src={
        ICONOS_FORMA[
          partido.estado
        ]
      }
      alt={
        nombre
      }
      title={`${jornada}${nombre}${marcador}`}
      className="
        h-6
        w-6
        shrink-0
        object-contain
      "
    />
  );
}

// ============================================================
// NOMBRE ESTADO FORMA
// ============================================================

function nombreEstadoForma(
  estado: EstadoForma,
) {
  switch (
    estado
  ) {
    case "GANADO":
      return "Guanyat";

    case "EMPATADO":
      return "Empatat";

    case "PERDIDO":
      return "Perdut";

    case "PENDIENTE":
    default:
      return "Per jugar";
  }
}

// ============================================================
// LEYENDA
// ============================================================

function Llegenda({
  esFutbol,
  etiquetaFavor,
  etiquetaContra,
}: {
  esFutbol: boolean;

  etiquetaFavor: string;

  etiquetaContra: string;
}) {
  return (
    <footer
      className="
        border-t
        border-border/60
        bg-background/35
        px-5
        py-5
        sm:px-6
      "
    >
      <p
        className="
          mb-3
          text-[10px]
          font-bold
          uppercase
          tracking-[0.14em]
          text-neutral
        "
      >
        Llegenda
      </p>

      <div
        className="
          flex
          flex-wrap
          gap-x-5
          gap-y-2
          text-xs
          text-neutral
        "
      >
        <LlegendaAbreviatura
          abreviatura="PJ"
          descripcion="Partits jugats"
        />

        <LlegendaAbreviatura
          abreviatura="PG"
          descripcion="Partits guanyats"
        />

        <LlegendaAbreviatura
          abreviatura="PE"
          descripcion="Partits empatats"
        />

        <LlegendaAbreviatura
          abreviatura="PP"
          descripcion="Partits perduts"
        />

        <LlegendaAbreviatura
          abreviatura={
            etiquetaFavor
          }
          descripcion={
            esFutbol
              ? "Gols marcats"
              : "Punts a favor"
          }
        />

        <LlegendaAbreviatura
          abreviatura={
            etiquetaContra
          }
          descripcion={
            esFutbol
              ? "Gols rebuts"
              : "Punts en contra"
          }
        />

        <LlegendaAbreviatura
          abreviatura="DIF"
          descripcion={
            esFutbol
              ? "Diferència de gols"
              : "Diferència de punts"
          }
        />

        {esFutbol && (
          <>
            <LlegendaAbreviatura
              abreviatura="TA"
              descripcion="Targetes grogues"
            />

            <LlegendaAbreviatura
              abreviatura="TR"
              descripcion="Targetes vermelles"
            />
          </>
        )}

        <LlegendaAbreviatura
          abreviatura="PTS"
          descripcion="Punts de classificació"
        />
      </div>

      <div
        className="
          mt-4
          flex
          flex-wrap
          items-center
          gap-x-5
          gap-y-2
          border-t
          border-border/50
          pt-4
        "
      >
        <span
          className="
            text-xs
            font-semibold
            text-neutral-titulos
          "
        >
          Forma:
        </span>

        <LlegendaForma
          estado="GANADO"
          texto="Guanyat"
        />

        <LlegendaForma
          estado="EMPATADO"
          texto="Empatat"
        />

        <LlegendaForma
          estado="PERDIDO"
          texto="Perdut"
        />

        <LlegendaForma
          estado="PENDIENTE"
          texto="Per jugar"
        />
      </div>
    </footer>
  );
}

// ============================================================
// LEYENDA ABREVIATURA
// ============================================================

function LlegendaAbreviatura({
  abreviatura,
  descripcion,
}: {
  abreviatura: string;

  descripcion: string;
}) {
  return (
    <span
      className="
        inline-flex
        items-baseline
        gap-1.5
      "
    >
      <strong
        className="
          font-bold
          text-neutral-titulos
        "
      >
        {abreviatura}
      </strong>

      <span>
        {descripcion}
      </span>
    </span>
  );
}

// ============================================================
// LEYENDA FORMA
// ============================================================

function LlegendaForma({
  estado,
  texto,
}: {
  estado: EstadoForma;

  texto: string;
}) {
  return (
    <span
      className="
        inline-flex
        items-center
        gap-1.5
        text-xs
        text-neutral
      "
    >
      <img
        src={
          ICONOS_FORMA[
            estado
          ]
        }
        alt=""
        aria-hidden="true"
        className="
          h-5
          w-5
          shrink-0
          object-contain
        "
      />

      <span>
        {texto}
      </span>
    </span>
  );
}

// ============================================================
// POSICIÓN
// ============================================================

function Posicio({
  posicion,
  destacada,
}: {
  posicion: number;

  destacada: boolean;
}) {
  return (
    <span
      className={`
        inline-flex
        h-8
        w-8
        shrink-0
        items-center
        justify-center
        rounded-xl
        text-xs
        font-black

        ${
          destacada
            ? "bg-primary text-white"
            : "bg-background text-neutral-titulos"
        }
      `}
    >
      {posicion}
    </span>
  );
}

// ============================================================
// EQUIPO
// ============================================================

function Equip({
  equip,
}: {
  equip: Equip;
}) {
  return (
    <div
      className="
        flex
        min-w-0
        items-center
        gap-3
      "
    >
      {equip.escudo ? (
        <div
          className="
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            overflow-hidden
            rounded-xl
            border
            border-border
            bg-white
            p-1
          "
        >
          <img
            src={
              equip.escudo
            }
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
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-background
            text-sm
            font-black
            text-primary
          "
        >
          {equip.nombre
            .charAt(0)
            .toUpperCase()}
        </div>
      )}

      <span
        className="
          truncate
          font-semibold
          text-neutral-titulos
        "
      >
        {equip.nombre}
      </span>
    </div>
  );
}

// ============================================================
// CELDA
// ============================================================

function Celda({
  valor: numero,
}: {
  valor: number | null;
}) {
  return (
    <td
      className="
        px-3
        py-3
        text-center
        text-sm
        text-neutral-titulos
      "
    >
      {valor(
        numero,
      )}
    </td>
  );
}

// ============================================================
// DATO MOBILE
// ============================================================

function DadaMobil({
  etiqueta,
  valor: numero,
  valorTexto,
}: {
  etiqueta: string;

  valor?: number | null;

  valorTexto?: string | number;
}) {
  return (
    <div
      className="
        rounded-xl
        bg-background/70
        px-2
        py-2.5
        text-center
      "
    >
      <p
        className="
          text-[9px]
          font-bold
          uppercase
          tracking-wider
          text-neutral
        "
      >
        {etiqueta}
      </p>

      <p
        className="
          mt-1
          text-sm
          font-bold
          text-neutral-titulos
        "
      >
        {valorTexto ??
          valor(
            numero ??
              null,
          )}
      </p>
    </div>
  );
}