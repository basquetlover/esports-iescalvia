type Equip = {
  id: string;

  nombre: string;

  escudo: string | null;
};

type Fila = {
  equipo: Equip;

  posicion: number | null;

  puntos: number | null;
};

type Props = {
  grupNom: string;

  files: Fila[];

  teClassificacio: boolean;
};

export default function ClassificacioResum({
  grupNom,
  files,
  teClassificacio,
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
                    items-center
                    justify-between
                    gap-3
                    border-b
                    border-border/60
                    px-5
                    py-5
                "
      >
        <div className="min-w-0">
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
                            truncate
                            text-lg
                            font-bold
                            text-neutral-titulos
                        "
          >
            {grupNom}
          </h3>
        </div>

        <span
          className={`
                        inline-flex
                        shrink-0
                        items-center
                        gap-2
                        rounded-full
                        px-2.5
                        py-1
                        text-[10px]
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
                              teClassificacio ? "bg-green-500" : "bg-neutral/40"
                            }
                        `}
          />

          {teClassificacio ? "Actualitzada" : "Pendent"}
        </span>
      </div>

      {/* =============================================
                EQUIPOS
            ============================================= */}

      {files.length > 0 ? (
        <div
          className="
                        divide-y
                        divide-border/50
                    "
        >
          {files.map((fila, index) => (
            <div
              key={fila.equipo.id}
              className="
                                    grid
                                    min-h-16
                                    grid-cols-[36px_minmax(0,1fr)_auto]
                                    items-center
                                    gap-3
                                    px-4
                                    py-3
                                    transition
                                    hover:bg-background/40
                                "
            >
              {/* POSICIÓN */}

              <div
                className={`
                                        flex
                                        h-8
                                        w-8
                                        items-center
                                        justify-center
                                        rounded-lg
                                        text-xs
                                        font-black

                                        ${
                                          index < 2
                                            ? "bg-primary text-white"
                                            : "bg-primary/10 text-primary"
                                        }
                                    `}
              >
                {fila.posicion ?? index + 1}
              </div>

              {/* EQUIPO */}

              <div
                className="
                                        flex
                                        min-w-0
                                        items-center
                                        gap-3
                                    "
              >
                {fila.equipo.escudo ? (
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
                      src={fila.equipo.escudo}
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
                    {fila.equipo.nombre.charAt(0).toUpperCase()}
                  </div>
                )}

                <p
                  className="
                                            min-w-0
                                            truncate
                                            text-sm
                                            font-semibold
                                            text-neutral-titulos
                                        "
                >
                  {fila.equipo.nombre}
                </p>
              </div>

              {/* PUNTOS */}

              <div
                className="
                                        shrink-0
                                        text-right
                                    "
              >
                <p
                  className="
                                            text-lg
                                            font-black
                                            text-primary
                                        "
                >
                  {fila.puntos ?? "—"}
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
                  punts
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="
                        px-6
                        py-12
                        text-center
                    "
        >
          <p
            className="
                            text-sm
                            text-neutral
                        "
          >
            Encara no hi ha equips al grup.
          </p>
        </div>
      )}
    </section>
  );
}
