import Cargando from "@components/Cargando";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormEvent, ReactNode } from "react";

import Resultats from "./Resultats";

// ============================================================
// TIPOS
// ============================================================

type Vista = "CALENDARI" | "RESULTATS";

type TipoFase = "GRUPOS" | "ELIMINATORIA";

type TipoPartido = "GRUPO" | "ELIMINATORIA";

type TipoOrigen =
  | "EQUIPO"
  | "POSICION_GRUPO"
  | "POSICION_FASE"
  | "GANADOR_PARTIDO"
  | "PERDEDOR_PARTIDO"
  | "LIBRE";

type LadoPartido = "LOCAL" | "VISITANTE";

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
  seed: number | null;
};

type Grupo = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
  estado: string;
};

type Ronda = {
  id: string;
  fase_id: string;
  tipo: string;
  nombre: string;
  orden: number;
};

type Fase = {
  id: string;
  edicion_id: string;

  nombre: string;

  tipo: TipoFase;

  orden: number;

  estado: string;

  publicada: boolean;

  grupos: Grupo[];

  rondas: Ronda[];
};

type Partido = {
  id: string;

  edicion_id: string;

  fase_id: string;

  fase_tipo: TipoFase;

  tipo: TipoPartido;

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

type Plaza = {
  id: string;

  edicion_id: string;

  destino_fase_id: string;

  destino_tipo: "GRUPO" | "PARTIDO";

  grupo_id: string | null;

  partido_id: string | null;

  lado: LadoPartido | null;

  orden: number;

  origen_tipo: TipoOrigen;

  equipo_origen_id: string | null;

  origen_grupo_id: string | null;

  origen_fase_id: string | null;

  origen_posicion: number | null;

  origen_partido_id: string | null;

  equipo_resuelto_id: string | null;

  resuelta_at: string | null;
};

type Datos = {
  success: true;

  torneo: {
    id: string;
    nombre: string | null;
    deporte: string | null;
  };

  edicion: {
    id: string;
    nombre: string | null;
    estado: string | null;
    sede: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
  };

  capacidades: {
    crear: boolean;
    editar: boolean;
    eliminar: boolean;
  };

  resumen: {
    total: number;
    borradores: number;
    programados: number;
    publicados: number;
    finalizados: number;
  };

  equipos: Equipo[];

  fases: Fase[];

  partidos: Partido[];

  plazas: Plaza[];

  plazasGrupo: Plaza[];
};

type OrigenBorrador = {
  tipo: TipoOrigen;

  equipoID: string;

  grupoID: string;

  faseID: string;

  posicion: number;

  partidoID: string;
};

type BorradorPartido = {
  tipo: TipoFase;

  faseID: string;

  grupoID: string;

  rondaID: string;

  nombre: string;

  jornada: number;

  localID: string;

  visitanteID: string;

  local: OrigenBorrador;

  visitante: OrigenBorrador;

  fechaHora: string;

  pista: string;

  duracion: string;

  publicado: boolean;
};

type Props = {
  torneoID: string;

  edicionID: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const ORIGEN_INICIAL: OrigenBorrador = {
  tipo: "EQUIPO",

  equipoID: "",

  grupoID: "",

  faseID: "",

  posicion: 1,

  partidoID: "",
};

function nuevoBorrador(): BorradorPartido {
  return {
    tipo: "GRUPOS",

    faseID: "",

    grupoID: "",

    rondaID: "",

    nombre: "",

    jornada: 1,

    localID: "",

    visitanteID: "",

    local: {
      ...ORIGEN_INICIAL,
    },

    visitante: {
      ...ORIGEN_INICIAL,
    },

    fechaHora: "",

    pista: "",

    duracion: "",

    publicado: false,
  };
}

// ============================================================
// FECHAS
// ============================================================

function isoADatetimeLocal(valor: string | null) {
  if (!valor) {
    return "";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "";
  }

  const local = new Date(
    fecha.getTime() -
      fecha.getTimezoneOffset() * 60000,
  );

  return local
    .toISOString()
    .slice(0, 16);
}

function datetimeLocalAISO(valor: string) {
  if (!valor) {
    return null;
  }

  const fecha = new Date(valor);

  return Number.isNaN(fecha.getTime())
    ? null
    : fecha.toISOString();
}

function formatearDia(valor: string) {
  const fecha = new Date(valor);

  return new Intl.DateTimeFormat(
    "ca-ES",
    {
      weekday: "long",

      day: "numeric",

      month: "long",

      year: "numeric",
    },
  ).format(fecha);
}

function formatearHora(
  valor: string | null,
) {
  if (!valor) {
    return "--:--";
  }

  const fecha = new Date(valor);

  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return "--:--";
  }

  return new Intl.DateTimeFormat(
    "ca-ES",
    {
      hour: "2-digit",

      minute: "2-digit",

      hour12: false,
    },
  ).format(fecha);
}

function claveDia(
  partido: Partido,
) {
  if (
    !partido.fecha_hora
  ) {
    return "SENSE_DATA";
  }

  const fecha =
    new Date(
      partido.fecha_hora,
    );

  if (
    Number.isNaN(
      fecha.getTime(),
    )
  ) {
    return "SENSE_DATA";
  }

  return [
    fecha.getFullYear(),

    String(
      fecha.getMonth() + 1,
    ).padStart(
      2,
      "0",
    ),

    String(
      fecha.getDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

// ============================================================
// VISUALES
// ============================================================

function nombreEstado(
  estado: string,
) {
  switch (estado) {
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

function clasesEstado(
  estado: string,
) {
  switch (estado) {
    case "PROGRAMADO":
      return "border-primary/20 bg-primary/10 text-primary";

    case "EN_CURSO":
    case "FINALIZADO":
      return "border-secondary/30 bg-secondary/10 text-secondary";

    case "SUSPENDIDO":
      return "border-orange-500/20 bg-orange-500/10 text-orange-600";

    case "CANCELADO":
      return "border-error/20 bg-error/10 text-error";

    default:
      return "border-border bg-background text-neutral";
  }
}

function iniciales(
  nombre: string,
) {
  return (
    nombre
      .trim()
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Gestor({
  torneoID,
  edicionID,
}: Props) {
  const [
    datos,
    setDatos,
  ] =
    useState<Datos | null>(
      null,
    );

  const [
    cargando,
    setCargando,
  ] =
    useState(
      true,
    );

  const [
    guardando,
    setGuardando,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  const [
    mensaje,
    setMensaje,
  ] =
    useState(
      "",
    );

  const [
    vista,
    setVista,
  ] =
    useState<Vista>(
      "CALENDARI",
    );

  const [
    filtroFase,
    setFiltroFase,
  ] =
    useState(
      "",
    );

  const [
    filtroEstructura,
    setFiltroEstructura,
  ] =
    useState(
      "",
    );

  const [
    filtroEstado,
    setFiltroEstado,
  ] =
    useState(
      "",
    );

  const [
    mostrandoFormulario,
    setMostrandoFormulario,
  ] =
    useState(
      false,
    );

  const [
    partidoEditando,
    setPartidoEditando,
  ] =
    useState<string | null>(
      null,
    );

  const [
    borrador,
    setBorrador,
  ] =
    useState<BorradorPartido>(
      nuevoBorrador(),
    );

  // ========================================================
  // CERRAR ÉXITO AUTOMÁTICAMENTE
  // ========================================================

  useEffect(
    () => {
      if (
        !mensaje
      ) {
        return;
      }

      const temporizador =
        window.setTimeout(
          () => {
            setMensaje(
              "",
            );
          },
          4500,
        );

      return () =>
        window.clearTimeout(
          temporizador,
        );
    },
    [
      mensaje,
    ],
  );

  // ========================================================
  // CARGA
  // ========================================================

  const cargar =
    useCallback(
      async () => {
        setCargando(
          true,
        );

        try {
          const parametros =
            new URLSearchParams({
              torneoID,

              edicionID,
            });

          const respuesta =
            await fetch(
              `/api/panell/partits?${parametros}`,
              {
                credentials:
                  "same-origin",

                cache:
                  "no-store",
              },
            );

          const json =
            await respuesta
              .json()
              .catch(
                () =>
                  null,
              );

          if (
            !respuesta.ok ||
            json?.success !==
              true
          ) {
            throw new Error(
              json?.mensaje ||
                "No s'ha pogut carregar el calendari.",
            );
          }

          setDatos(
            json as Datos,
          );
        } catch (
          err
        ) {
          setError(
            err instanceof
              Error
              ? err.message
              : "No s'ha pogut carregar el calendari.",
          );
        } finally {
          setCargando(
            false,
          );
        }
      },
      [
        torneoID,
        edicionID,
      ],
    );

  useEffect(
    () => {
      void cargar();
    },
    [
      cargar,
    ],
  );

  // ========================================================
  // PETICIÓN
  // ========================================================

  async function peticion(
    metodo:
      | "POST"
      | "PATCH"
      | "DELETE",

    cuerpo:
      Record<
        string,
        unknown
      >,
  ) {
    setGuardando(
      true,
    );

    setError(
      "",
    );

    setMensaje(
      "",
    );

    try {
      const respuesta =
        await fetch(
          "/api/panell/partits",
          {
            method:
              metodo,

            credentials:
              "same-origin",

            cache:
              "no-store",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  torneoID,

                  edicionID,

                  ...cuerpo,
                },
              ),
          },
        );

      const json =
        await respuesta
          .json()
          .catch(
            () =>
              null,
          );

      if (
        !respuesta.ok ||
        json?.success !==
          true
      ) {
        throw new Error(
          json?.mensaje ||
            `Error ${respuesta.status}: no s'ha pogut completar l'operació.`,
        );
      }

      return json;
    } finally {
      setGuardando(
        false,
      );
    }
  }

  // ========================================================
  // MAPAS
  // ========================================================

  const equipoPorID =
    useMemo(
      () =>
        new Map(
          (
            datos?.equipos ??
            []
          ).map(
            equipo => [
              equipo.id,
              equipo,
            ],
          ),
        ),
      [
        datos,
      ],
    );

  const fasePorID =
    useMemo(
      () =>
        new Map(
          (
            datos?.fases ??
            []
          ).map(
            fase => [
              fase.id,
              fase,
            ],
          ),
        ),
      [
        datos,
      ],
    );

  const grupos =
    useMemo(
      () =>
        datos?.fases.flatMap(
          fase =>
            fase.grupos,
        ) ??
        [],
      [
        datos,
      ],
    );

  const rondas =
    useMemo(
      () =>
        datos?.fases.flatMap(
          fase =>
            fase.rondas,
        ) ??
        [],
      [
        datos,
      ],
    );

  const grupoPorID =
    useMemo(
      () =>
        new Map(
          grupos.map(
            grupo => [
              grupo.id,
              grupo,
            ],
          ),
        ),
      [
        grupos,
      ],
    );

  const rondaPorID =
    useMemo(
      () =>
        new Map(
          rondas.map(
            ronda => [
              ronda.id,
              ronda,
            ],
          ),
        ),
      [
        rondas,
      ],
    );

  const partidoPorID =
    useMemo(
      () =>
        new Map(
          (
            datos?.partidos ??
            []
          ).map(
            partido => [
              partido.id,
              partido,
            ],
          ),
        ),
      [
        datos,
      ],
    );

  // ========================================================
  // EQUIPOS DEL GRUPO SELECCIONADO
  // ========================================================

  const equiposGrupoSeleccionado =
    useMemo(
      () => {
        if (
          !datos ||
          !borrador.grupoID
        ) {
          return [];
        }

        const ids =
          new Set(
            datos.plazasGrupo
              .filter(
                plaza =>
                  plaza.destino_tipo ===
                    "GRUPO" &&
                  plaza.grupo_id ===
                    borrador.grupoID,
              )
              .map(
                plaza =>
                  plaza.equipo_resuelto_id,
              )
              .filter(
                (
                  id,
                ): id is string =>
                  Boolean(
                    id,
                  ),
              ),
          );

        return datos.equipos.filter(
          equipo =>
            ids.has(
              equipo.id,
            ),
        );
      },
      [
        datos,
        borrador.grupoID,
      ],
    );

  // ========================================================
  // PLAZAS PARTIDOS
  // ========================================================

  function plazaPartido(
    partidoID:
      string,

    lado:
      LadoPartido,
  ) {
    return (
      datos?.plazas.find(
        plaza =>
          plaza.partido_id ===
            partidoID &&
          plaza.lado ===
            lado,
      ) ??
      null
    );
  }

  function nombreEquipoPlaza(
    plaza:
      Plaza | null,
  ) {
    if (
      !plaza
    ) {
      return "Per determinar";
    }

    if (
      plaza.equipo_resuelto_id
    ) {
      return (
        equipoPorID.get(
          plaza.equipo_resuelto_id,
        )?.nombre ??
        "Equip"
      );
    }

    if (
      plaza.origen_tipo ===
      "LIBRE"
    ) {
      return "Lliure / bye";
    }

    if (
      plaza.origen_tipo ===
      "POSICION_GRUPO"
    ) {
      const grupo =
        plaza.origen_grupo_id
          ? grupoPorID.get(
              plaza.origen_grupo_id,
            )
          : null;

      return `${
        plaza.origen_posicion ??
        "?"
      }a posició · ${
        grupo?.nombre ??
        "Grup"
      }`;
    }

    if (
      plaza.origen_tipo ===
      "POSICION_FASE"
    ) {
      const fase =
        plaza.origen_fase_id
          ? fasePorID.get(
              plaza.origen_fase_id,
            )
          : null;

      return `${
        plaza.origen_posicion ??
        "?"
      }a posició · ${
        fase?.nombre ??
        "Fase"
      }`;
    }

    if (
      plaza.origen_tipo ===
        "GANADOR_PARTIDO" ||
      plaza.origen_tipo ===
        "PERDEDOR_PARTIDO"
    ) {
      const partido =
        plaza.origen_partido_id
          ? partidoPorID.get(
              plaza.origen_partido_id,
            )
          : null;

      return `${
        plaza.origen_tipo ===
        "GANADOR_PARTIDO"
          ? "Guanyador"
          : "Perdedor"
      } · ${
        partido?.nombre ??
        partido?.codigo ??
        "Partit"
      }`;
    }

    return "Per determinar";
  }

  function origenDesdePlaza(
    plaza:
      Plaza | null,
  ): OrigenBorrador {
    if (
      !plaza
    ) {
      return {
        ...ORIGEN_INICIAL,
      };
    }

    return {
      tipo:
        plaza.origen_tipo,

      equipoID:
        plaza.equipo_origen_id ??
        plaza.equipo_resuelto_id ??
        "",

      grupoID:
        plaza.origen_grupo_id ??
        "",

      faseID:
        plaza.origen_fase_id ??
        "",

      posicion:
        plaza.origen_posicion ??
        1,

      partidoID:
        plaza.origen_partido_id ??
        "",
    };
  }

  // ========================================================
  // ESTRUCTURA
  // ========================================================

  const fasesDisponibles =
    useMemo(
      () =>
        datos?.fases.filter(
          fase =>
            fase.tipo ===
            borrador.tipo,
        ) ??
        [],
      [
        datos,
        borrador.tipo,
      ],
    );

  const gruposDisponibles =
    borrador.faseID
      ? fasePorID.get(
          borrador.faseID,
        )?.grupos ??
        []
      : [];

  const rondasDisponibles =
    borrador.faseID
      ? fasePorID.get(
          borrador.faseID,
        )?.rondas ??
        []
      : [];

  const faseDestino =
    borrador.faseID
      ? fasePorID.get(
          borrador.faseID,
        ) ??
        null
      : null;

  const rondaDestino =
    borrador.rondaID
      ? rondaPorID.get(
          borrador.rondaID,
        ) ??
        null
      : null;

  const gruposOrigen =
    useMemo(
      () => {
        if (
          !datos ||
          !faseDestino
        ) {
          return [];
        }

        return datos.fases
          .filter(
            fase =>
              fase.tipo ===
                "GRUPOS" &&
              fase.orden <
                faseDestino.orden,
          )
          .flatMap(
            fase =>
              fase.grupos.map(
                grupo => ({
                  ...grupo,

                  faseNombre:
                    fase.nombre,
                }),
              ),
          );
      },
      [
        datos,
        faseDestino,
      ],
    );

  const fasesOrigen =
    useMemo(
      () => {
        if (
          !datos ||
          !faseDestino
        ) {
          return [];
        }

        return datos.fases.filter(
          fase =>
            fase.orden <
            faseDestino.orden,
        );
      },
      [
        datos,
        faseDestino,
      ],
    );

  const partidosOrigen =
    useMemo(
      () => {
        if (
          !datos ||
          !faseDestino ||
          !rondaDestino
        ) {
          return [];
        }

        return datos.partidos.filter(
          partido => {
            if (
              partido.tipo !==
              "ELIMINATORIA"
            ) {
              return false;
            }

            if (
              partido.id ===
              partidoEditando
            ) {
              return false;
            }

            const fase =
              fasePorID.get(
                partido.fase_id,
              );

            if (
              !fase
            ) {
              return false;
            }

            if (
              fase.orden <
              faseDestino.orden
            ) {
              return true;
            }

            if (
              fase.id !==
                faseDestino.id ||
              !partido.ronda_id
            ) {
              return false;
            }

            const ronda =
              rondaPorID.get(
                partido.ronda_id,
              );

            return Boolean(
              ronda &&
                ronda.orden <
                  rondaDestino.orden,
            );
          },
        );
      },
      [
        datos,
        faseDestino,
        rondaDestino,
        fasePorID,
        rondaPorID,
        partidoEditando,
      ],
    );

  // ========================================================
  // ABRIR / CERRAR
  // ========================================================

  function abrirNuevo() {
    setPartidoEditando(
      null,
    );

    setBorrador(
      nuevoBorrador(),
    );

    setMostrandoFormulario(
      true,
    );

    setError(
      "",
    );
  }

  function cerrarFormulario() {
    setMostrandoFormulario(
      false,
    );

    setPartidoEditando(
      null,
    );

    setBorrador(
      nuevoBorrador(),
    );
  }

  function abrirEditar(
    partido:
      Partido,
  ) {
    const local =
      plazaPartido(
        partido.id,
        "LOCAL",
      );

    const visitante =
      plazaPartido(
        partido.id,
        "VISITANTE",
      );

    setPartidoEditando(
      partido.id,
    );

    setBorrador({
      tipo:
        partido.tipo ===
        "GRUPO"
          ? "GRUPOS"
          : "ELIMINATORIA",

      faseID:
        partido.fase_id,

      grupoID:
        partido.grupo_id ??
        "",

      rondaID:
        partido.ronda_id ??
        "",

      nombre:
        partido.nombre ??
        "",

      jornada:
        partido.jornada ??
        1,

      localID:
        local?.equipo_resuelto_id ??
        "",

      visitanteID:
        visitante?.equipo_resuelto_id ??
        "",

      local:
        origenDesdePlaza(
          local,
        ),

      visitante:
        origenDesdePlaza(
          visitante,
        ),

      fechaHora:
        isoADatetimeLocal(
          partido.fecha_hora,
        ),

      pista:
        partido.pista ??
        "",

      duracion:
        partido.duracion_estimada_min !==
        null
          ? String(
              partido.duracion_estimada_min,
            )
          : "",

      publicado:
        partido.publicado,
    });

    setMostrandoFormulario(
      true,
    );

    setError(
      "",
    );
  }

  // ========================================================
  // GUARDAR
  // ========================================================

  async function guardarPartido(
    evento:
      FormEvent,
  ) {
    evento.preventDefault();

    setError(
      "",
    );

    if (
      !borrador.faseID
    ) {
      setError(
        "Selecciona una fase.",
      );

      return;
    }

    if (
      borrador.tipo ===
      "GRUPOS"
    ) {
      if (
        !borrador.grupoID
      ) {
        setError(
          "Selecciona un grup.",
        );

        return;
      }

      if (
        equiposGrupoSeleccionado.length <
        2
      ) {
        setError(
          "Aquest grup no té prou equips assignats per crear un partit.",
        );

        return;
      }

      if (
        !borrador.localID ||
        !borrador.visitanteID
      ) {
        setError(
          "Selecciona l'equip local i el visitant.",
        );

        return;
      }

      if (
        borrador.localID ===
        borrador.visitanteID
      ) {
        setError(
          "L'equip local i el visitant no poden ser el mateix.",
        );

        return;
      }
    } else if (
      !borrador.rondaID
    ) {
      setError(
        "Selecciona una ronda.",
      );

      return;
    }

    const fechaHora =
      datetimeLocalAISO(
        borrador.fechaHora,
      );

    try {
      if (
        partidoEditando
      ) {
        const actual =
          partidoPorID.get(
            partidoEditando,
          );

        if (
          !actual
        ) {
          throw new Error(
            "No s'ha trobat el partit.",
          );
        }

        const cuerpo:
          Record<
            string,
            unknown
          > = {
            accion:
              "editar_partido",

            partidoID:
              partidoEditando,

            nombre:
              borrador.nombre,

            fechaHora,

            pista:
              borrador.pista,

            duracion:
              borrador.duracion
                ? Number(
                    borrador.duracion,
                  )
                : null,

            publicado:
              borrador.publicado,
          };

        if (
          actual.tipo ===
          "GRUPO"
        ) {
          cuerpo.jornada =
            borrador.jornada;

          if (
            !actual.publicado &&
            actual.estado ===
              "BORRADOR"
          ) {
            cuerpo.localID =
              borrador.localID;

            cuerpo.visitanteID =
              borrador.visitanteID;
          }
        } else if (
          !actual.publicado &&
          actual.estado ===
            "BORRADOR"
        ) {
          cuerpo.local =
            borrador.local;

          cuerpo.visitante =
            borrador.visitante;
        }

        await peticion(
          "PATCH",
          cuerpo,
        );

        setMensaje(
          "Partit actualitzat correctament.",
        );
      } else {
        const cuerpo:
          Record<
            string,
            unknown
          > = {
            accion:
              "crear_partido",

            tipo:
              borrador.tipo,

            nombre:
              borrador.nombre,

            fechaHora,

            pista:
              borrador.pista,

            duracion:
              borrador.duracion
                ? Number(
                    borrador.duracion,
                  )
                : null,

            publicado:
              borrador.publicado,
          };

        if (
          borrador.tipo ===
          "GRUPOS"
        ) {
          cuerpo.grupoID =
            borrador.grupoID;

          cuerpo.jornada =
            borrador.jornada;

          cuerpo.localID =
            borrador.localID;

          cuerpo.visitanteID =
            borrador.visitanteID;
        } else {
          cuerpo.rondaID =
            borrador.rondaID;

          cuerpo.local =
            borrador.local;

          cuerpo.visitante =
            borrador.visitante;
        }

        await peticion(
          "POST",
          cuerpo,
        );

        setMensaje(
          "Partit creat correctament.",
        );
      }

      cerrarFormulario();

      await cargar();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "No s'ha pogut guardar el partit.",
      );
    }
  }

  // ========================================================
  // ACCIONES
  // ========================================================

  async function cambiarPublicacion(
    partido:
      Partido,
  ) {
    try {
      await peticion(
        "PATCH",
        {
          accion:
            "editar_partido",

          partidoID:
            partido.id,

          publicado:
            !partido.publicado,
        },
      );

      setMensaje(
        partido.publicado
          ? "Partit despublicat."
          : "Partit publicat.",
      );

      await cargar();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "No s'ha pogut canviar la publicació.",
      );
    }
  }

  async function cambiarEstado(
    partido:
      Partido,

    estado:
      string,
  ) {
    try {
      await peticion(
        "PATCH",
        {
          accion:
            "cambiar_estado",

          partidoID:
            partido.id,

          estado,
        },
      );

      setMensaje(
        "Estat actualitzat.",
      );

      await cargar();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "No s'ha pogut canviar l'estat.",
      );
    }
  }

  async function eliminarPartido(
    partido:
      Partido,
  ) {
    if (
      !window.confirm(
        `Vols eliminar "${
          partido.nombre ??
          partido.codigo
        }"?`,
      )
    ) {
      return;
    }

    try {
      await peticion(
        "DELETE",
        {
          accion:
            "eliminar_partido",

          partidoID:
            partido.id,
        },
      );

      setMensaje(
        "Partit eliminat correctament.",
      );

      await cargar();
    } catch (
      err
    ) {
      setError(
        err instanceof
          Error
          ? err.message
          : "No s'ha pogut eliminar el partit.",
      );
    }
  }

  // ========================================================
  // FILTROS DEL CALENDARIO
  // ========================================================

  const opcionesEstructura =
    useMemo(
      () => {
        const fase =
          filtroFase
            ? fasePorID.get(
                filtroFase,
              )
            : null;

        if (
          !fase
        ) {
          return [];
        }

        return fase.tipo ===
          "GRUPOS"
          ? fase.grupos
          : fase.rondas;
      },
      [
        filtroFase,
        fasePorID,
      ],
    );

  /*
   * IMPORTANTE:
   *
   * Esta lista pertenece SOLO a Calendari.
   *
   * Los partidos finalizados se muestran en Resultats mediante
   * el componente independiente Resultats.tsx.
   */
  const partidosFiltrados =
    useMemo(
      () => {
        if (
          !datos
        ) {
          return [];
        }

        return datos.partidos.filter(
          partido => {
            const finalizado =
              partido.estado ===
                "FINALIZADO" ||
              Boolean(
                partido.finalizado_at,
              );

            if (
              finalizado
            ) {
              return false;
            }

            if (
              filtroFase &&
              partido.fase_id !==
                filtroFase
            ) {
              return false;
            }

            if (
              filtroEstructura &&
              partido.grupo_id !==
                filtroEstructura &&
              partido.ronda_id !==
                filtroEstructura
            ) {
              return false;
            }

            if (
              filtroEstado &&
              partido.estado !==
                filtroEstado
            ) {
              return false;
            }

            return true;
          },
        );
      },
      [
        datos,
        filtroFase,
        filtroEstructura,
        filtroEstado,
      ],
    );

  const partidosPorDia =
    useMemo(
      () => {
        const mapa =
          new Map<
            string,
            Partido[]
          >();

        for (
          const partido
          of partidosFiltrados
        ) {
          const clave =
            claveDia(
              partido,
            );

          const lista =
            mapa.get(
              clave,
            ) ??
            [];

          lista.push(
            partido,
          );

          mapa.set(
            clave,
            lista,
          );
        }

        return [
          ...mapa.entries(),
        ].sort(
          (
            [a],
            [b],
          ) => {
            if (
              a ===
              "SENSE_DATA"
            ) {
              return 1;
            }

            if (
              b ===
              "SENSE_DATA"
            ) {
              return -1;
            }

            return a.localeCompare(
              b,
            );
          },
        );
      },
      [
        partidosFiltrados,
      ],
    );

  // ========================================================
  // CAMBIAR VISTA
  // ========================================================

  function abrirCalendario() {
    setVista(
      "CALENDARI",
    );
  }

  function abrirResultados() {
    setVista(
      "RESULTATS",
    );

    /*
     * El formulario pertenece al calendario.
     * No debe permanecer abierto detrás de Resultats.
     */
    cerrarFormulario();

    setError(
      "",
    );
  }

  // ========================================================
  // CARGA INICIAL
  // ========================================================

  if (
    cargando &&
    !datos
  ) {
    return (
      <div className="flex min-h-96 w-full items-center justify-center p-6">
        <Avisos
          error={
            error
          }
          mensaje={
            mensaje
          }
          onCerrarError={() =>
            setError(
              "",
            )
          }
          onCerrarMensaje={() =>
            setMensaje(
              "",
            )
          }
        />

        <Cargando />
      </div>
    );
  }

  if (
    !datos
  ) {
    return (
      <div className="p-4">
        <Avisos
          error={
            error ||
            "No s'ha pogut carregar el calendari."
          }
          mensaje=""
          onCerrarError={() =>
            setError(
              "",
            )
          }
          onCerrarMensaje={() => {}}
        />
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="flex w-full flex-col gap-5 p-4 pt-0">
      {/* =====================================================
          AVISOS FLOTANTES
      ===================================================== */}

      <Avisos
        error={
          error
        }
        mensaje={
          mensaje
        }
        onCerrarError={() =>
          setError(
            "",
          )
        }
        onCerrarMensaje={() =>
          setMensaje(
            "",
          )
        }
      />

      {/* =====================================================
          RESUMEN
      ===================================================== */}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TarjetaResumen
          titulo="Total"
          valor={
            datos.resumen.total
          }
        />

        <TarjetaResumen
          titulo="Esborranys"
          valor={
            datos.resumen.borradores
          }
        />

        <TarjetaResumen
          titulo="Programats"
          valor={
            datos.resumen.programados
          }
        />

        <TarjetaResumen
          titulo="Publicats"
          valor={
            datos.resumen.publicados
          }
        />

        <TarjetaResumen
          titulo="Finalitzats"
          valor={
            datos.resumen.finalizados
          }
        />
      </section>

      {/* =====================================================
          NAVEGACIÓN
      ===================================================== */}

      <section className="rounded-2xl border border-border/50 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-3">
          <div className="flex gap-1 rounded-xl bg-background p-1">
            <button
              type="button"
              onClick={
                abrirCalendario
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                vista ===
                "CALENDARI"
                  ? "bg-card text-primary shadow-sm"
                  : "text-neutral"
              }`}
            >
              Calendari
            </button>

            <button
              type="button"
              onClick={
                abrirResultados
              }
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                vista ===
                "RESULTATS"
                  ? "bg-card text-primary shadow-sm"
                  : "text-neutral"
              }`}
            >
              Resultats
            </button>
          </div>

          {vista ===
            "CALENDARI" &&
            datos.capacidades
              .crear && (
              <button
                type="button"
                disabled={
                  guardando
                }
                onClick={
                  abrirNuevo
                }
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                + Afegir partit
              </button>
            )}
        </div>

        {/* ===================================================
            FILTROS SOLO CALENDARIO
        =================================================== */}

        {vista ===
          "CALENDARI" && (
          <div className="grid gap-3 p-4 md:grid-cols-3">
            <select
              value={
                filtroFase
              }
              onChange={
                evento => {
                  setFiltroFase(
                    evento
                      .target
                      .value,
                  );

                  setFiltroEstructura(
                    "",
                  );
                }
              }
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">
                Totes les fases
              </option>

              {datos.fases.map(
                fase => (
                  <option
                    key={
                      fase.id
                    }
                    value={
                      fase.id
                    }
                  >
                    {
                      fase.nombre
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                filtroEstructura
              }
              disabled={
                !filtroFase
              }
              onChange={
                evento =>
                  setFiltroEstructura(
                    evento
                      .target
                      .value,
                  )
              }
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-40"
            >
              <option value="">
                Tots els grups / rondes
              </option>

              {opcionesEstructura.map(
                opcion => (
                  <option
                    key={
                      opcion.id
                    }
                    value={
                      opcion.id
                    }
                  >
                    {
                      opcion.nombre
                    }
                  </option>
                ),
              )}
            </select>

            <select
              value={
                filtroEstado
              }
              onChange={
                evento =>
                  setFiltroEstado(
                    evento
                      .target
                      .value,
                  )
              }
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">
                Tots els estats
              </option>

              <option value="BORRADOR">
                Esborrany
              </option>

              <option value="PROGRAMADO">
                Programat
              </option>

              <option value="EN_CURSO">
                En curs
              </option>

              <option value="SUSPENDIDO">
                Suspès
              </option>

              <option value="CANCELADO">
                Cancel·lat
              </option>
            </select>
          </div>
        )}
      </section>

      {/* =====================================================
          RESULTATS
      ===================================================== */}

      {vista ===
        "RESULTATS" && (
        <Resultats
          torneoID={
            torneoID
          }
          edicionID={
            edicionID
          }
        />
      )}

      {/* =====================================================
          CALENDARI
      ===================================================== */}

      {vista ===
        "CALENDARI" && (
        <>
          {/* =================================================
              FORMULARIO
          ================================================= */}

          {mostrandoFormulario && (
            <section className="overflow-hidden rounded-2xl border border-primary/30 bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-primary/5 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    {partidoEditando
                      ? "Editar"
                      : "Nou partit"}
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                    {partidoEditando
                      ? "Editar partit"
                      : "Crear partit"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={
                    cerrarFormulario
                  }
                  className="rounded-lg border border-border px-3 py-2 text-sm"
                >
                  Tancar
                </button>
              </div>

              <form
                onSubmit={
                  guardarPartido
                }
                className="flex flex-col gap-5 p-4"
              >
                {/* ===========================================
                    TIPO
                =========================================== */}

                <div>
                  <p className="mb-2 text-sm font-semibold text-neutral-titulos">
                    Tipus de partit
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={Boolean(
                        partidoEditando,
                      )}
                      onClick={() =>
                        setBorrador(
                          anterior => ({
                            ...anterior,

                            tipo:
                              "GRUPOS",

                            faseID:
                              "",

                            grupoID:
                              "",

                            rondaID:
                              "",

                            localID:
                              "",

                            visitanteID:
                              "",
                          }),
                        )
                      }
                      className={`rounded-xl border p-4 text-left ${
                        borrador.tipo ===
                        "GRUPOS"
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <p className="font-bold text-neutral-titulos">
                        Fase de grups
                      </p>

                      <p className="mt-1 text-xs text-neutral">
                        Partit entre equips del mateix grup.
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={Boolean(
                        partidoEditando,
                      )}
                      onClick={() =>
                        setBorrador(
                          anterior => ({
                            ...anterior,

                            tipo:
                              "ELIMINATORIA",

                            faseID:
                              "",

                            grupoID:
                              "",

                            rondaID:
                              "",
                          }),
                        )
                      }
                      className={`rounded-xl border p-4 text-left ${
                        borrador.tipo ===
                        "ELIMINATORIA"
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                    >
                      <p className="font-bold text-neutral-titulos">
                        Eliminatòria
                      </p>

                      <p className="mt-1 text-xs text-neutral">
                        Vuitens, quarts, semifinals, final...
                      </p>
                    </button>
                  </div>
                </div>

                {/* ===========================================
                    FASE / GRUPO / RONDA
                =========================================== */}

                <div className="grid gap-4 lg:grid-cols-2">
                  <Campo
                    titulo="Fase"
                    obligatorio
                  >
                    <select
                      value={
                        borrador.faseID
                      }
                      disabled={
                        guardando ||
                        Boolean(
                          partidoEditando,
                        )
                      }
                      onChange={
                        evento =>
                          setBorrador(
                            anterior => ({
                              ...anterior,

                              faseID:
                                evento
                                  .target
                                  .value,

                              grupoID:
                                "",

                              rondaID:
                                "",

                              localID:
                                "",

                              visitanteID:
                                "",
                            }),
                          )
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <option value="">
                        Selecciona una fase...
                      </option>

                      {fasesDisponibles.map(
                        fase => (
                          <option
                            key={
                              fase.id
                            }
                            value={
                              fase.id
                            }
                          >
                            {
                              fase.nombre
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </Campo>

                  {borrador.tipo ===
                  "GRUPOS" ? (
                    <Campo
                      titulo="Grup"
                      obligatorio
                    >
                      <select
                        value={
                          borrador.grupoID
                        }
                        disabled={
                          guardando ||
                          Boolean(
                            partidoEditando,
                          ) ||
                          !borrador.faseID
                        }
                        onChange={
                          evento =>
                            setBorrador(
                              anterior => ({
                                ...anterior,

                                grupoID:
                                  evento
                                    .target
                                    .value,

                                localID:
                                  "",

                                visitanteID:
                                  "",
                              }),
                            )
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 disabled:opacity-40"
                      >
                        <option value="">
                          Selecciona un grup...
                        </option>

                        {gruposDisponibles.map(
                          grupo => (
                            <option
                              key={
                                grupo.id
                              }
                              value={
                                grupo.id
                              }
                            >
                              {
                                grupo.nombre
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </Campo>
                  ) : (
                    <Campo
                      titulo="Ronda"
                      obligatorio
                    >
                      <select
                        value={
                          borrador.rondaID
                        }
                        disabled={
                          guardando ||
                          Boolean(
                            partidoEditando,
                          ) ||
                          !borrador.faseID
                        }
                        onChange={
                          evento =>
                            setBorrador(
                              anterior => ({
                                ...anterior,

                                rondaID:
                                  evento
                                    .target
                                    .value,
                              }),
                            )
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 disabled:opacity-40"
                      >
                        <option value="">
                          Selecciona una ronda...
                        </option>

                        {rondasDisponibles.map(
                          ronda => (
                            <option
                              key={
                                ronda.id
                              }
                              value={
                                ronda.id
                              }
                            >
                              {
                                ronda.nombre
                              }
                            </option>
                          ),
                        )}
                      </select>
                    </Campo>
                  )}
                </div>

                {/* ===========================================
                    EQUIPOS DE GRUPO
                =========================================== */}

                {borrador.tipo ===
                  "GRUPOS" &&
                  borrador.grupoID && (
                    <>
                      <div className="rounded-xl border border-border bg-background/50 p-3 text-xs text-neutral">
                        {
                          equiposGrupoSeleccionado.length
                        }{" "}
                        equips assignats a aquest grup.
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <Campo
                          titulo="Equip local"
                          obligatorio
                        >
                          <select
                            value={
                              borrador.localID
                            }
                            disabled={
                              guardando
                            }
                            onChange={
                              evento =>
                                setBorrador(
                                  anterior => ({
                                    ...anterior,

                                    localID:
                                      evento
                                        .target
                                        .value,
                                  }),
                                )
                            }
                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                          >
                            <option value="">
                              Selecciona l'equip...
                            </option>

                            {equiposGrupoSeleccionado
                              .filter(
                                equipo =>
                                  equipo.id !==
                                  borrador.visitanteID,
                              )
                              .map(
                                equipo => (
                                  <option
                                    key={
                                      equipo.id
                                    }
                                    value={
                                      equipo.id
                                    }
                                  >
                                    {
                                      equipo.nombre
                                    }
                                  </option>
                                ),
                              )}
                          </select>
                        </Campo>

                        <Campo
                          titulo="Equip visitant"
                          obligatorio
                        >
                          <select
                            value={
                              borrador.visitanteID
                            }
                            disabled={
                              guardando
                            }
                            onChange={
                              evento =>
                                setBorrador(
                                  anterior => ({
                                    ...anterior,

                                    visitanteID:
                                      evento
                                        .target
                                        .value,
                                  }),
                                )
                            }
                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                          >
                            <option value="">
                              Selecciona l'equip...
                            </option>

                            {equiposGrupoSeleccionado
                              .filter(
                                equipo =>
                                  equipo.id !==
                                  borrador.localID,
                              )
                              .map(
                                equipo => (
                                  <option
                                    key={
                                      equipo.id
                                    }
                                    value={
                                      equipo.id
                                    }
                                  >
                                    {
                                      equipo.nombre
                                    }
                                  </option>
                                ),
                              )}
                          </select>
                        </Campo>
                      </div>

                      <div className="max-w-xs">
                        <Campo
                          titulo="Jornada"
                          obligatorio
                        >
                          <input
                            type="number"
                            min={
                              1
                            }
                            value={
                              borrador.jornada
                            }
                            onChange={
                              evento =>
                                setBorrador(
                                  anterior => ({
                                    ...anterior,

                                    jornada:
                                      Math.max(
                                        1,
                                        Number(
                                          evento
                                            .target
                                            .value,
                                        ) ||
                                          1,
                                      ),
                                  }),
                                )
                            }
                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                          />
                        </Campo>
                      </div>
                    </>
                  )}

                {/* ===========================================
                    ELIMINATORIA
                =========================================== */}

                {borrador.tipo ===
                  "ELIMINATORIA" &&
                  borrador.rondaID && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <OrigenPartido
                        titulo="Local"
                        valor={
                          borrador.local
                        }
                        disabled={
                          guardando
                        }
                        equipos={
                          datos.equipos
                        }
                        grupos={
                          gruposOrigen
                        }
                        fases={
                          fasesOrigen
                        }
                        partidos={
                          partidosOrigen
                        }
                        onChange={
                          valor =>
                            setBorrador(
                              anterior => ({
                                ...anterior,

                                local:
                                  valor,
                              }),
                            )
                        }
                      />

                      <OrigenPartido
                        titulo="Visitant"
                        valor={
                          borrador.visitante
                        }
                        disabled={
                          guardando
                        }
                        equipos={
                          datos.equipos
                        }
                        grupos={
                          gruposOrigen
                        }
                        fases={
                          fasesOrigen
                        }
                        partidos={
                          partidosOrigen
                        }
                        onChange={
                          valor =>
                            setBorrador(
                              anterior => ({
                                ...anterior,

                                visitante:
                                  valor,
                              }),
                            )
                        }
                      />
                    </div>
                  )}

                {/* ===========================================
                    DATOS
                =========================================== */}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Campo titulo="Nom">
                    <input
                      value={
                        borrador.nombre
                      }
                      onChange={
                        evento =>
                          setBorrador(
                            anterior => ({
                              ...anterior,

                              nombre:
                                evento
                                  .target
                                  .value,
                            }),
                          )
                      }
                      placeholder="Opcional"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    />
                  </Campo>

                  <Campo titulo="Data i hora">
                    <input
                      type="datetime-local"
                      value={
                        borrador.fechaHora
                      }
                      onChange={
                        evento =>
                          setBorrador(
                            anterior => ({
                              ...anterior,

                              fechaHora:
                                evento
                                  .target
                                  .value,
                            }),
                          )
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    />
                  </Campo>

                  <Campo titulo="Pista">
                    <input
                      value={
                        borrador.pista
                      }
                      onChange={
                        evento =>
                          setBorrador(
                            anterior => ({
                              ...anterior,

                              pista:
                                evento
                                  .target
                                  .value,
                            }),
                          )
                      }
                      placeholder="Pista 1"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    />
                  </Campo>

                  <Campo titulo="Duració">
                    <input
                      type="number"
                      min={
                        1
                      }
                      value={
                        borrador.duracion
                      }
                      onChange={
                        evento =>
                          setBorrador(
                            anterior => ({
                              ...anterior,

                              duracion:
                                evento
                                  .target
                                  .value,
                            }),
                          )
                      }
                      placeholder="45"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    />
                  </Campo>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4">
                  <input
                    type="checkbox"
                    checked={
                      borrador.publicado
                    }
                    onChange={
                      evento =>
                        setBorrador(
                          anterior => ({
                            ...anterior,

                            publicado:
                              evento
                                .target
                                .checked,
                          }),
                        )
                    }
                    className="mt-1"
                  />

                  <div>
                    <p className="font-semibold text-neutral-titulos">
                      Publicar partit
                    </p>

                    <p className="mt-1 text-xs text-neutral">
                      Per publicar-lo és obligatori indicar data i hora.
                    </p>
                  </div>
                </label>

                <div className="flex justify-end gap-2 border-t border-border pt-4">
                  <button
                    type="button"
                    onClick={
                      cerrarFormulario
                    }
                    className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
                  >
                    Cancel·lar
                  </button>

                  <button
                    disabled={
                      guardando
                    }
                    className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {guardando
                      ? "Guardant..."
                      : partidoEditando
                        ? "Guardar canvis"
                        : "Crear partit"}
                  </button>
                </div>
              </form>
            </section>
          )}

          {/* =================================================
              LISTA CALENDARIO
          ================================================= */}

          {partidosPorDia.length >
          0 ? (
            <div className="flex flex-col gap-6">
              {partidosPorDia.map(
                ([
                  dia,
                  partidos,
                ]) => (
                  <section
                    key={
                      dia
                    }
                    className="overflow-hidden rounded-2xl border border-border/50 bg-card"
                  >
                    <div className="border-b border-border bg-background/40 px-4 py-3">
                      <h2 className="font-bold capitalize text-neutral-titulos">
                        {dia ===
                        "SENSE_DATA"
                          ? "Sense data assignada"
                          : formatearDia(
                              partidos[0]
                                .fecha_hora!,
                            )}
                      </h2>

                      <p className="text-xs text-neutral">
                        {
                          partidos.length
                        }{" "}
                        partits
                      </p>
                    </div>

                    <div className="divide-y divide-border">
                      {partidos.map(
                        partido => {
                          const local =
                            plazaPartido(
                              partido.id,
                              "LOCAL",
                            );

                          const visitante =
                            plazaPartido(
                              partido.id,
                              "VISITANTE",
                            );

                          return (
                            <PartidoFila
                              key={
                                partido.id
                              }
                              partido={
                                partido
                              }
                              local={
                                local
                              }
                              visitante={
                                visitante
                              }
                              localNombre={
                                nombreEquipoPlaza(
                                  local,
                                )
                              }
                              visitanteNombre={
                                nombreEquipoPlaza(
                                  visitante,
                                )
                              }
                              equipoPorID={
                                equipoPorID
                              }
                              fase={
                                fasePorID.get(
                                  partido.fase_id,
                                )
                              }
                              grupo={
                                partido.grupo_id
                                  ? grupoPorID.get(
                                      partido.grupo_id,
                                    )
                                  : undefined
                              }
                              ronda={
                                partido.ronda_id
                                  ? rondaPorID.get(
                                      partido.ronda_id,
                                    )
                                  : undefined
                              }
                              guardando={
                                guardando
                              }
                              puedeEditar={
                                datos
                                  .capacidades
                                  .editar
                              }
                              puedeEliminar={
                                datos
                                  .capacidades
                                  .eliminar
                              }
                              onEditar={() =>
                                abrirEditar(
                                  partido,
                                )
                              }
                              onPublicar={() =>
                                void cambiarPublicacion(
                                  partido,
                                )
                              }
                              onEstado={
                                estado =>
                                  void cambiarEstado(
                                    partido,
                                    estado,
                                  )
                              }
                              onEliminar={() =>
                                void eliminarPartido(
                                  partido,
                                )
                              }
                            />
                          );
                        },
                      )}
                    </div>
                  </section>
                ),
              )}
            </div>
          ) : (
            <EstadoVacioCalendario
              puedeCrear={
                datos
                  .capacidades
                  .crear
              }
              onCrear={
                abrirNuevo
              }
            />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// AVISOS FLOTANTES
// ============================================================

function Avisos({
  error,
  mensaje,
  onCerrarError,
  onCerrarMensaje,
}: {
  error: string;

  mensaje: string;

  onCerrarError:
    () => void;

  onCerrarMensaje:
    () => void;
}) {
  if (
    !error &&
    !mensaje
  ) {
    return null;
  }

  return (
    <div
      className="
        pointer-events-none
        fixed
        inset-x-3
        top-3
        z-[100]
        flex
        flex-col
        items-end
        gap-2
        sm:left-auto
        sm:right-4
        sm:top-4
        sm:w-[430px]
      "
      aria-live="assertive"
    >
      {error && (
        <div
          role="alert"
          className="
            pointer-events-auto
            flex
            w-full
            items-start
            gap-3
            rounded-xl
            border
            border-error/30
            bg-card
            p-4
            text-error
            shadow-xl
          "
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error/10">
            !
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              No s'ha pogut completar l'operació
            </p>

            <p className="mt-1 text-sm leading-5">
              {error}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onCerrarError
            }
            aria-label="Tancar error"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-error/10"
          >
            ×
          </button>
        </div>
      )}

      {mensaje && (
        <div
          role="status"
          className="
            pointer-events-auto
            flex
            w-full
            items-start
            gap-3
            rounded-xl
            border
            border-secondary/30
            bg-card
            p-4
            text-secondary
            shadow-xl
          "
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
            ✓
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              Operació completada
            </p>

            <p className="mt-1 text-sm">
              {mensaje}
            </p>
          </div>

          <button
            type="button"
            onClick={
              onCerrarMensaje
            }
            aria-label="Tancar avís"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-secondary/10"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTES PEQUEÑOS
// ============================================================

function TarjetaResumen({
  titulo,
  valor,
}: {
  titulo:
    string;

  valor:
    number;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold text-neutral-titulos">
        {valor}
      </p>
    </div>
  );
}

function Campo({
  titulo,
  obligatorio = false,
  children,
}: {
  titulo:
    string;

  obligatorio?:
    boolean;

  children:
    ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold text-neutral-titulos">
        {titulo}

        {obligatorio && (
          <span className="ml-1 text-error">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}

// ============================================================
// ORIGEN ELIMINATORIA
// ============================================================

function OrigenPartido({
  titulo,
  valor,
  disabled,
  equipos,
  grupos,
  fases,
  partidos,
  onChange,
}: {
  titulo:
    string;

  valor:
    OrigenBorrador;

  disabled:
    boolean;

  equipos:
    Equipo[];

  grupos:
    Array<
      Grupo & {
        faseNombre:
          string;
      }
    >;

  fases:
    Fase[];

  partidos:
    Partido[];

  onChange:
    (
      valor:
        OrigenBorrador,
    ) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="font-bold text-neutral-titulos">
        {titulo}
      </p>

      <div className="mt-3 flex flex-col gap-3">
        <select
          value={
            valor.tipo
          }
          disabled={
            disabled
          }
          onChange={
            evento =>
              onChange({
                ...ORIGEN_INICIAL,

                tipo:
                  evento
                    .target
                    .value as TipoOrigen,
              })
          }
          className="rounded-xl border border-border bg-background px-3 py-2.5"
        >
          <option value="EQUIPO">
            Equip directe
          </option>

          <option value="POSICION_GRUPO">
            Posició de grup
          </option>

          <option value="POSICION_FASE">
            Posició de fase
          </option>

          <option value="GANADOR_PARTIDO">
            Guanyador d'un partit
          </option>

          <option value="PERDEDOR_PARTIDO">
            Perdedor d'un partit
          </option>

          <option value="LIBRE">
            Lliure / bye
          </option>
        </select>

        {valor.tipo ===
          "EQUIPO" && (
          <select
            value={
              valor.equipoID
            }
            onChange={
              evento =>
                onChange({
                  ...valor,

                  equipoID:
                    evento
                      .target
                      .value,
                })
            }
            className="rounded-xl border border-border bg-background px-3 py-2.5"
          >
            <option value="">
              Equip...
            </option>

            {equipos.map(
              equipo => (
                <option
                  key={
                    equipo.id
                  }
                  value={
                    equipo.id
                  }
                >
                  {
                    equipo.nombre
                  }
                </option>
              ),
            )}
          </select>
        )}

        {valor.tipo ===
          "POSICION_GRUPO" && (
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <select
              value={
                valor.grupoID
              }
              onChange={
                evento =>
                  onChange({
                    ...valor,

                    grupoID:
                      evento
                        .target
                        .value,
                  })
              }
              className="rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <option value="">
                Grup...
              </option>

              {grupos.map(
                grupo => (
                  <option
                    key={
                      grupo.id
                    }
                    value={
                      grupo.id
                    }
                  >
                    {
                      grupo.faseNombre
                    }{" "}
                    ·{" "}
                    {
                      grupo.nombre
                    }
                  </option>
                ),
              )}
            </select>

            <input
              type="number"
              min={
                1
              }
              value={
                valor.posicion
              }
              onChange={
                evento =>
                  onChange({
                    ...valor,

                    posicion:
                      Math.max(
                        1,
                        Number(
                          evento
                            .target
                            .value,
                        ),
                      ),
                  })
              }
              className="rounded-xl border border-border bg-background px-2 py-2.5"
            />
          </div>
        )}

        {valor.tipo ===
          "POSICION_FASE" && (
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <select
              value={
                valor.faseID
              }
              onChange={
                evento =>
                  onChange({
                    ...valor,

                    faseID:
                      evento
                        .target
                        .value,
                  })
              }
              className="rounded-xl border border-border bg-background px-3 py-2.5"
            >
              <option value="">
                Fase...
              </option>

              {fases.map(
                fase => (
                  <option
                    key={
                      fase.id
                    }
                    value={
                      fase.id
                    }
                  >
                    {
                      fase.nombre
                    }
                  </option>
                ),
              )}
            </select>

            <input
              type="number"
              min={
                1
              }
              value={
                valor.posicion
              }
              onChange={
                evento =>
                  onChange({
                    ...valor,

                    posicion:
                      Math.max(
                        1,
                        Number(
                          evento
                            .target
                            .value,
                        ),
                      ),
                  })
              }
              className="rounded-xl border border-border bg-background px-2 py-2.5"
            />
          </div>
        )}

        {(valor.tipo ===
          "GANADOR_PARTIDO" ||
          valor.tipo ===
            "PERDEDOR_PARTIDO") && (
          <select
            value={
              valor.partidoID
            }
            onChange={
              evento =>
                onChange({
                  ...valor,

                  partidoID:
                    evento
                      .target
                      .value,
                })
            }
            className="rounded-xl border border-border bg-background px-3 py-2.5"
          >
            <option value="">
              Partit...
            </option>

            {partidos.map(
              partido => (
                <option
                  key={
                    partido.id
                  }
                  value={
                    partido.id
                  }
                >
                  {partido.nombre ??
                    partido.codigo}
                </option>
              ),
            )}
          </select>
        )}
      </div>
    </div>
  );
}

// ============================================================
// PARTIDO CALENDARIO
// ============================================================

function PartidoFila({
  partido,
  local,
  visitante,
  localNombre,
  visitanteNombre,
  equipoPorID,
  fase,
  grupo,
  ronda,
  guardando,
  puedeEditar,
  puedeEliminar,
  onEditar,
  onPublicar,
  onEstado,
  onEliminar,
}: {
  partido:
    Partido;

  local:
    Plaza | null;

  visitante:
    Plaza | null;

  localNombre:
    string;

  visitanteNombre:
    string;

  equipoPorID:
    Map<
      string,
      Equipo
    >;

  fase:
    Fase | undefined;

  grupo:
    Grupo | undefined;

  ronda:
    Ronda | undefined;

  guardando:
    boolean;

  puedeEditar:
    boolean;

  puedeEliminar:
    boolean;

  onEditar:
    () => void;

  onPublicar:
    () => void;

  onEstado:
    (
      estado:
        string,
    ) => void;

  onEliminar:
    () => void;
}) {
  const localEquipo =
    local?.equipo_resuelto_id
      ? equipoPorID.get(
          local.equipo_resuelto_id,
        )
      : null;

  const visitanteEquipo =
    visitante?.equipo_resuelto_id
      ? equipoPorID.get(
          visitante.equipo_resuelto_id,
        )
      : null;

  const finalizado =
    partido.estado ===
      "FINALIZADO" ||
    Boolean(
      partido.finalizado_at,
    );

  return (
    <article className="p-4">
      <div className="grid items-center gap-4 xl:grid-cols-[100px_minmax(0,1fr)_220px_auto]">
        <div>
          <p className="text-2xl font-bold text-neutral-titulos">
            {formatearHora(
              partido.fecha_hora,
            )}
          </p>

          <p className="text-xs text-neutral">
            {partido.pista ||
              "Sense pista"}
          </p>
        </div>

        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <EquipoPartido
              equipo={
                localEquipo ??
                null
              }
              nombre={
                localNombre
              }
              derecha
            />

            <span className="text-xs font-bold text-neutral">
              VS
            </span>

            <EquipoPartido
              equipo={
                visitanteEquipo ??
                null
              }
              nombre={
                visitanteNombre
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral">
            {fase && (
              <span className="rounded bg-background px-2 py-1">
                {
                  fase.nombre
                }
              </span>
            )}

            {grupo && (
              <span className="rounded bg-background px-2 py-1">
                {
                  grupo.nombre
                }
              </span>
            )}

            {ronda && (
              <span className="rounded bg-background px-2 py-1">
                {
                  ronda.nombre
                }
              </span>
            )}

            {partido.jornada !==
              null && (
              <span className="rounded bg-background px-2 py-1">
                Jornada{" "}
                {
                  partido.jornada
                }
              </span>
            )}

            <span className="rounded bg-background px-2 py-1">
              {
                partido.codigo
              }
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <span
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${clasesEstado(
                partido.estado,
              )}`}
            >
              {nombreEstado(
                partido.estado,
              )}
            </span>

            <span className="rounded-lg border border-border px-2.5 py-1 text-[11px]">
              {partido.publicado
                ? "Publicat"
                : "No publicat"}
            </span>
          </div>

          {puedeEditar &&
            !finalizado &&
            partido.estado !==
              "EN_CURSO" && (
              <select
                value={
                  partido.estado
                }
                disabled={
                  guardando
                }
                onChange={
                  evento =>
                    onEstado(
                      evento
                        .target
                        .value,
                    )
                }
                className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
              >
                <option value="BORRADOR">
                  Esborrany
                </option>

                <option value="PROGRAMADO">
                  Programat
                </option>

                <option value="SUSPENDIDO">
                  Suspès
                </option>

                <option value="CANCELADO">
                  Cancel·lat
                </option>
              </select>
            )}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {puedeEditar &&
            !finalizado && (
              <>
                <button
                  type="button"
                  onClick={
                    onEditar
                  }
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={
                    onPublicar
                  }
                  className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary"
                >
                  {partido.publicado
                    ? "Despublicar"
                    : "Publicar"}
                </button>
              </>
            )}

          {puedeEliminar &&
            partido.estado ===
              "BORRADOR" &&
            !partido.publicado && (
              <button
                type="button"
                onClick={
                  onEliminar
                }
                className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error"
              >
                Eliminar
              </button>
            )}
        </div>
      </div>
    </article>
  );
}

function EquipoPartido({
  equipo,
  nombre,
  derecha = false,
}: {
  equipo:
    Equipo | null;

  nombre:
    string;

  derecha?:
    boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        derecha
          ? "justify-end text-right"
          : ""
      }`}
    >
      {derecha && (
        <p className="truncate text-sm font-bold">
          {nombre}
        </p>
      )}

      {equipo?.escudo ? (
        <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white p-1">
          <img
            src={
              equipo.escudo
            }
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {iniciales(
            nombre,
          )}
        </div>
      )}

      {!derecha && (
        <p className="truncate text-sm font-bold">
          {nombre}
        </p>
      )}
    </div>
  );
}

// ============================================================
// ESTADO VACÍO CALENDARIO
// ============================================================

function EstadoVacioCalendario({
  puedeCrear,
  onCrear,
}: {
  puedeCrear:
    boolean;

  onCrear:
    () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <h2 className="text-lg font-bold text-neutral-titulos">
        No hi ha partits
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-neutral">
        Crea els partits de la competició i programa el calendari.
      </p>

      {puedeCrear && (
        <button
          type="button"
          onClick={
            onCrear
          }
          className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          + Crear partit
        </button>
      )}
    </div>
  );
}