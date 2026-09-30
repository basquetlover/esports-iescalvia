import Cargando from "@components/Cargando";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormEvent, ReactNode } from "react";

// ============================================================
// TIPOS
// ============================================================

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

type EstadoPartido =
  | "BORRADOR"
  | "PROGRAMADO"
  | "EN_CURSO"
  | "FINALIZADO"
  | "SUSPENDIDO"
  | "CANCELADO";

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
  seed: number | null;
};

type Pista = {
  id: string;
  torneo_id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  activa: boolean;
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

  estado: EstadoPartido;

  fecha_hora: string | null;

  pista_id: string | null;

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

type AvisoConflicto = {
  tipo: "PISTA" | "EQUIPO";

  mensaje: string;

  partido: {
    id: string;

    codigo: string;

    nombre: string | null;

    fecha_hora: string | null;

    duracion_estimada_min: number | null;
  };

  equipo_id?: string;
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

  pistas: Pista[];

  fases: Fase[];

  partidos: Partido[];

  plazas: Plaza[];

  plazasGrupo: Plaza[];
};

type BorradorPartido = {
  faseID: string;

  grupoID: string;

  nombre: string;

  jornada: number;

  localID: string;

  visitanteID: string;

  fechaHora: string;

  pistaID: string;

  duracion: string;

  publicado: boolean;
};

type Props = {
  torneoID: string;

  edicionID: string;
};

// ============================================================
// BORRADOR
// ============================================================

function nuevoBorrador(): BorradorPartido {
  return {
    faseID: "",

    grupoID: "",

    nombre: "",

    jornada: 1,

    localID: "",

    visitanteID: "",

    fechaHora: "",

    pistaID: "",

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

  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);

  return local.toISOString().slice(0, 16);
}

function datetimeLocalAISO(valor: string) {
  if (!valor) {
    return null;
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha.toISOString();
}

function formatearDia(valor: string) {
  const fecha = new Date(valor);

  return new Intl.DateTimeFormat("ca-ES", {
    weekday: "long",

    day: "numeric",

    month: "long",

    year: "numeric",
  }).format(fecha);
}

function formatearHora(valor: string | null) {
  if (!valor) {
    return "--:--";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("ca-ES", {
    hour: "2-digit",

    minute: "2-digit",

    hour12: false,
  }).format(fecha);
}

function claveDia(partido: Partido) {
  if (!partido.fecha_hora) {
    return "SENSE_DATA";
  }

  const fecha = new Date(partido.fecha_hora);

  if (Number.isNaN(fecha.getTime())) {
    return "SENSE_DATA";
  }

  return [
    fecha.getFullYear(),

    String(fecha.getMonth() + 1).padStart(2, "0"),

    String(fecha.getDate()).padStart(2, "0"),
  ].join("-");
}

// ============================================================
// ESTADOS
// ============================================================

function nombreEstado(estado: string) {
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

function clasesEstado(estado: string) {
  switch (estado) {
    case "PROGRAMADO":
      return "border-primary/20 bg-primary/10 text-primary";

    case "EN_CURSO":
      return "border-orange-500/30 bg-orange-500/10 text-orange-600";

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

function iniciales(nombre: string) {
  return nombre.trim().slice(0, 2).toUpperCase() || "?";
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Calendari({ torneoID, edicionID }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [avisos, setAvisos] = useState<AvisoConflicto[]>([]);

  const [filtroFase, setFiltroFase] = useState("");

  const [filtroEstructura, setFiltroEstructura] = useState("");

  const [filtroEstado, setFiltroEstado] = useState("");

  const [mostrandoFormulario, setMostrandoFormulario] = useState(false);

  const [partidoEditando, setPartidoEditando] = useState<string | null>(null);

  const [borrador, setBorrador] = useState<BorradorPartido>(nuevoBorrador());

  // ========================================================
  // MODAL: BLOQUEAR SCROLL
  // ========================================================

  useEffect(() => {
    if (!mostrandoFormulario) {
      return;
    }

    const anterior = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = anterior;
    };
  }, [mostrandoFormulario]);

  // ========================================================
  // ÉXITO TEMPORAL
  // ========================================================

  useEffect(() => {
    if (!mensaje) {
      return;
    }

    const temporizador = window.setTimeout(() => {
      setMensaje("");
    }, 4500);

    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  // ========================================================
  // CARGAR
  // ========================================================

  const cargar = useCallback(async () => {
    setCargando(true);

    try {
      const parametros = new URLSearchParams({
        torneoID,
        edicionID,
      });

      const respuesta = await fetch(
        `/api/panell/partits?${parametros.toString()}`,
        {
          credentials: "same-origin",

          cache: "no-store",
        },
      );

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(
          json?.mensaje || "No s'ha pogut carregar el calendari.",
        );
      }

      setDatos(json as Datos);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut carregar el calendari.",
      );
    } finally {
      setCargando(false);
    }
  }, [torneoID, edicionID]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ========================================================
  // API
  // ========================================================

  async function peticion(
    metodo: "POST" | "PATCH" | "DELETE",

    cuerpo: Record<string, unknown>,
  ) {
    setGuardando(true);

    setError("");
    setMensaje("");
    setAvisos([]);

    try {
      const respuesta = await fetch("/api/panell/partits", {
        method: metodo,

        credentials: "same-origin",

        cache: "no-store",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          torneoID,
          edicionID,

          ...cuerpo,
        }),
      });

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(json?.mensaje || `Error ${respuesta.status}`);
      }

      if (Array.isArray(json.avisos)) {
        setAvisos(json.avisos);
      }

      return json;
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // MAPAS
  // ========================================================

  const equipoPorID = useMemo(
    () => new Map((datos?.equipos ?? []).map((equipo) => [equipo.id, equipo])),
    [datos],
  );

  const fasePorID = useMemo(
    () => new Map((datos?.fases ?? []).map((fase) => [fase.id, fase])),
    [datos],
  );

  const grupos = useMemo(
    () => datos?.fases.flatMap((fase) => fase.grupos) ?? [],
    [datos],
  );

  const rondas = useMemo(
    () => datos?.fases.flatMap((fase) => fase.rondas) ?? [],
    [datos],
  );

  const grupoPorID = useMemo(
    () => new Map(grupos.map((grupo) => [grupo.id, grupo])),
    [grupos],
  );

  const rondaPorID = useMemo(
    () => new Map(rondas.map((ronda) => [ronda.id, ronda])),
    [rondas],
  );

  const pistaPorID = useMemo(
    () => new Map((datos?.pistas ?? []).map((pista) => [pista.id, pista])),
    [datos],
  );

  const partidoPorID = useMemo(
    () =>
      new Map((datos?.partidos ?? []).map((partido) => [partido.id, partido])),
    [datos],
  );

  // ========================================================
  // FASES DE GRUPOS
  // ========================================================

  const fasesGrupo = useMemo(
    () => datos?.fases.filter((fase) => fase.tipo === "GRUPOS") ?? [],
    [datos],
  );

  const gruposDisponibles = borrador.faseID
    ? (fasePorID.get(borrador.faseID)?.grupos ?? [])
    : [];

  // ========================================================
  // EQUIPOS DEL GRUPO
  // ========================================================

  const equiposGrupoSeleccionado = useMemo(() => {
    if (!datos || !borrador.grupoID) {
      return [];
    }

    const ids = new Set(
      datos.plazasGrupo
        .filter(
          (plaza) =>
            plaza.destino_tipo === "GRUPO" &&
            plaza.grupo_id === borrador.grupoID,
        )
        .map((plaza) => plaza.equipo_resuelto_id)
        .filter((id): id is string => Boolean(id)),
    );

    return datos.equipos.filter((equipo) => ids.has(equipo.id));
  }, [datos, borrador.grupoID]);

  // ========================================================
  // PLAZA
  // ========================================================

  function plazaPartido(partidoID: string, lado: LadoPartido) {
    return (
      datos?.plazas.find(
        (plaza) => plaza.partido_id === partidoID && plaza.lado === lado,
      ) ?? null
    );
  }

  function nombreEquipoPlaza(plaza: Plaza | null) {
    if (!plaza) {
      return "Per determinar";
    }

    if (plaza.equipo_resuelto_id) {
      return equipoPorID.get(plaza.equipo_resuelto_id)?.nombre ?? "Equip";
    }

    if (plaza.origen_tipo === "POSICION_GRUPO") {
      const grupo = plaza.origen_grupo_id
        ? grupoPorID.get(plaza.origen_grupo_id)
        : null;

      return `${plaza.origen_posicion ?? "?"}a posició · ${
        grupo?.nombre ?? "Grup"
      }`;
    }

    if (plaza.origen_tipo === "POSICION_FASE") {
      return `${plaza.origen_posicion ?? "?"}a posició`;
    }

    if (
      plaza.origen_tipo === "GANADOR_PARTIDO" ||
      plaza.origen_tipo === "PERDEDOR_PARTIDO"
    ) {
      const origen = plaza.origen_partido_id
        ? partidoPorID.get(plaza.origen_partido_id)
        : null;

      return `${
        plaza.origen_tipo === "GANADOR_PARTIDO" ? "Guanyador" : "Perdedor"
      } · ${origen?.nombre ?? origen?.codigo ?? "Partit"}`;
    }

    if (plaza.origen_tipo === "LIBRE") {
      return "Lliure / bye";
    }

    return "Per determinar";
  }

  // ========================================================
  // NUEVO
  // ========================================================

  function abrirNuevo() {
    setPartidoEditando(null);

    setBorrador(nuevoBorrador());

    setError("");
    setAvisos([]);

    setMostrandoFormulario(true);
  }

  // ========================================================
  // EDITAR
  // ========================================================

  function abrirEditar(partido: Partido) {
    const local = plazaPartido(partido.id, "LOCAL");

    const visitante = plazaPartido(partido.id, "VISITANTE");

    setPartidoEditando(partido.id);

    setBorrador({
      faseID: partido.fase_id,

      grupoID: partido.grupo_id ?? "",

      nombre: partido.nombre ?? "",

      jornada: partido.jornada ?? 1,

      localID: local?.equipo_resuelto_id ?? "",

      visitanteID: visitante?.equipo_resuelto_id ?? "",

      fechaHora: isoADatetimeLocal(partido.fecha_hora),

      pistaID: partido.pista_id ?? "",

      duracion:
        partido.duracion_estimada_min !== null
          ? String(partido.duracion_estimada_min)
          : "",

      publicado: partido.publicado,
    });

    setError("");
    setAvisos([]);

    setMostrandoFormulario(true);
  }

  function cerrarFormulario() {
    if (guardando) {
      return;
    }

    setMostrandoFormulario(false);

    setPartidoEditando(null);

    setBorrador(nuevoBorrador());
  }

  // ========================================================
  // GUARDAR
  // ========================================================

  async function guardarPartido(evento: FormEvent) {
    evento.preventDefault();

    const fechaHora = datetimeLocalAISO(borrador.fechaHora);

    setError("");

    try {
      // ====================================================
      // EDITAR
      // ====================================================

      if (partidoEditando) {
        const actual = partidoPorID.get(partidoEditando);

        if (!actual) {
          throw new Error("No s'ha trobat el partit.");
        }

        if (borrador.publicado && !fechaHora) {
          throw new Error("Indica la data i l'hora abans de publicar.");
        }

        if (borrador.publicado && !borrador.pistaID) {
          throw new Error("Selecciona una pista abans de publicar.");
        }

        const cuerpo: Record<string, unknown> = {
          accion: "editar_partido",

          partidoID: actual.id,

          nombre: borrador.nombre,

          jornada: borrador.jornada,

          fechaHora,

          pistaID: borrador.pistaID || null,

          duracion: borrador.duracion ? Number(borrador.duracion) : null,

          publicado: borrador.publicado,
        };

        // ==================================================
        // CAMBIO DE EQUIPOS SOLO SI REALMENTE CAMBIARON
        // ==================================================

        if (actual.tipo === "GRUPO") {
          const localActual =
            plazaPartido(actual.id, "LOCAL")?.equipo_resuelto_id ?? "";

          const visitanteActual =
            plazaPartido(actual.id, "VISITANTE")?.equipo_resuelto_id ?? "";

          const equiposCambiados =
            borrador.localID !== localActual ||
            borrador.visitanteID !== visitanteActual;

          if (equiposCambiados) {
            if (!borrador.localID || !borrador.visitanteID) {
              throw new Error("Selecciona l'equip local i el visitant.");
            }

            if (borrador.localID === borrador.visitanteID) {
              throw new Error(
                "L'equip local i el visitant no poden ser el mateix.",
              );
            }

            cuerpo.localID = borrador.localID;

            cuerpo.visitanteID = borrador.visitanteID;
          }
        }

        await peticion("PATCH", cuerpo);

        setMensaje("Partit actualitzat correctament.");
      }

      // ====================================================
      // CREAR
      // ====================================================
      else {
        if (!borrador.faseID) {
          throw new Error("Selecciona una fase de grups.");
        }

        if (!borrador.grupoID) {
          throw new Error("Selecciona un grup.");
        }

        if (!borrador.localID || !borrador.visitanteID) {
          throw new Error("Selecciona l'equip local i el visitant.");
        }

        if (borrador.localID === borrador.visitanteID) {
          throw new Error(
            "L'equip local i el visitant no poden ser el mateix.",
          );
        }

        await peticion("POST", {
          accion: "crear_partido",

          tipo: "GRUPOS",

          faseID: borrador.faseID,

          grupoID: borrador.grupoID,

          nombre: borrador.nombre,

          jornada: borrador.jornada,

          localID: borrador.localID,

          visitanteID: borrador.visitanteID,

          fechaHora,

          pistaID: borrador.pistaID || null,

          duracion: borrador.duracion ? Number(borrador.duracion) : null,

          publicado: borrador.publicado,
        });

        setMensaje("Partit creat correctament.");
      }

      setMostrandoFormulario(false);

      setPartidoEditando(null);

      setBorrador(nuevoBorrador());

      await cargar();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No s'ha pogut guardar el partit.",
      );
    }
  }

  // ========================================================
  // ESTADO
  // ========================================================

  async function cambiarEstado(partido: Partido, estado: EstadoPartido) {
    try {
      await peticion("PATCH", {
        accion: "cambiar_estado",

        partidoID: partido.id,

        estado,
      });

      setMensaje("Estat actualitzat.");

      await cargar();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No s'ha pogut canviar l'estat.",
      );
    }
  }

  // ========================================================
  // PUBLICAR
  // ========================================================

  async function cambiarPublicacion(partido: Partido) {
    try {
      await peticion("PATCH", {
        accion: "editar_partido",

        partidoID: partido.id,

        publicado: !partido.publicado,
      });

      setMensaje(
        partido.publicado ? "Partit despublicat." : "Partit publicat.",
      );

      await cargar();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut modificar la publicació.",
      );
    }
  }

  // ========================================================
  // ELIMINAR
  // ========================================================

  async function eliminarPartido(partido: Partido) {
    if (partido.tipo !== "GRUPO") {
      setError(
        "Els partits eliminatoris es gestionen des de Format de competició.",
      );

      return;
    }

    if (
      !window.confirm(`Vols eliminar "${partido.nombre ?? partido.codigo}"?`)
    ) {
      return;
    }

    try {
      await peticion("DELETE", {
        partidoID: partido.id,
      });

      setMensaje("Partit eliminat.");

      await cargar();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut eliminar el partit.",
      );
    }
  }

  // ========================================================
  // FILTROS
  // ========================================================

  const opcionesEstructura = useMemo(() => {
    const fase = filtroFase ? fasePorID.get(filtroFase) : null;

    if (!fase) {
      return [];
    }

    return fase.tipo === "GRUPOS" ? fase.grupos : fase.rondas;
  }, [filtroFase, fasePorID]);

  const partidosFiltrados = useMemo(() => {
    if (!datos) {
      return [];
    }

    return datos.partidos.filter((partido) => {
      if (filtroFase && partido.fase_id !== filtroFase) {
        return false;
      }

      if (
        filtroEstructura &&
        partido.grupo_id !== filtroEstructura &&
        partido.ronda_id !== filtroEstructura
      ) {
        return false;
      }

      if (filtroEstado && partido.estado !== filtroEstado) {
        return false;
      }

      return true;
    });
  }, [datos, filtroFase, filtroEstructura, filtroEstado]);

  // ========================================================
  // AGRUPAR DÍAS
  // ========================================================

  const partidosPorDia = useMemo(() => {
    const mapa = new Map<string, Partido[]>();

    for (const partido of partidosFiltrados) {
      const clave = claveDia(partido);

      const lista = mapa.get(clave) ?? [];

      lista.push(partido);

      mapa.set(clave, lista);
    }

    for (const lista of mapa.values()) {
      lista.sort((a, b) => {
        if (!a.fecha_hora && !b.fecha_hora) {
          return a.orden - b.orden;
        }

        if (!a.fecha_hora) {
          return 1;
        }

        if (!b.fecha_hora) {
          return -1;
        }

        return (
          new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
        );
      });
    }

    return [...mapa.entries()].sort(([a], [b]) => {
      if (a === "SENSE_DATA") {
        return 1;
      }

      if (b === "SENSE_DATA") {
        return -1;
      }

      return a.localeCompare(b);
    });
  }, [partidosFiltrados]);

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Cargando />
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="rounded-xl border border-error/30 bg-card p-4 text-sm text-error">
        {error || "No s'ha pogut carregar el calendari."}
      </div>
    );
  }

  const partidoActual = partidoEditando
    ? (partidoPorID.get(partidoEditando) ?? null)
    : null;

  const localActual = partidoActual
    ? plazaPartido(partidoActual.id, "LOCAL")
    : null;

  const visitanteActual = partidoActual
    ? plazaPartido(partidoActual.id, "VISITANTE")
    : null;

  // ========================================================
  // UI
  // ========================================================

  return (
    <>
      <div className="flex flex-col gap-5">
        {/* =================================================
            AVISOS
        ================================================= */}

        <Avisos
          error={error}
          mensaje={mensaje}
          avisos={avisos}
          onCerrarError={() => setError("")}
          onCerrarMensaje={() => setMensaje("")}
          onCerrarAvisos={() => setAvisos([])}
        />

        {/* =================================================
            RESUMEN
        ================================================= */}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <TarjetaResumen titulo="Total" valor={datos.resumen.total} />

          <TarjetaResumen
            titulo="Esborranys"
            valor={datos.resumen.borradores}
          />

          <TarjetaResumen
            titulo="Programats"
            valor={datos.resumen.programados}
          />

          <TarjetaResumen titulo="Publicats" valor={datos.resumen.publicados} />

          <TarjetaResumen
            titulo="Finalitzats"
            valor={datos.resumen.finalizados}
          />
        </section>

        {/* =================================================
            FILTROS
        ================================================= */}

        <section className="rounded-2xl border border-border/50 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-4">
            <div>
              <h2 className="font-bold text-neutral-titulos">Calendari</h2>

              <p className="mt-1 text-xs text-neutral">
                Programa i modifica els partits de l'edició.
              </p>
            </div>

            {datos.capacidades.crear && (
              <button
                type="button"
                disabled={guardando}
                onClick={abrirNuevo}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                + Partit de grup
              </button>
            )}
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3">
            <select
              value={filtroFase}
              onChange={(evento) => {
                setFiltroFase(evento.target.value);

                setFiltroEstructura("");
              }}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Totes les fases</option>

              {datos.fases.map((fase) => (
                <option key={fase.id} value={fase.id}>
                  {fase.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroEstructura}
              disabled={!filtroFase}
              onChange={(evento) => setFiltroEstructura(evento.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm disabled:opacity-40"
            >
              <option value="">Tots els grups / rondes</option>

              {opcionesEstructura.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.nombre}
                </option>
              ))}
            </select>

            <select
              value={filtroEstado}
              onChange={(evento) => setFiltroEstado(evento.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Tots els estats</option>

              <option value="BORRADOR">Esborrany</option>

              <option value="PROGRAMADO">Programat</option>

              <option value="EN_CURSO">En curs</option>

              <option value="FINALIZADO">Finalitzat</option>

              <option value="SUSPENDIDO">Suspès</option>

              <option value="CANCELADO">Cancel·lat</option>
            </select>
          </div>
        </section>

        {/* =================================================
            PARTIDOS
        ================================================= */}

        {partidosPorDia.length > 0 ? (
          <div className="flex flex-col gap-6">
            {partidosPorDia.map(([dia, partidos]) => (
              <section
                key={dia}
                className="overflow-hidden rounded-2xl border border-border/50 bg-card"
              >
                <div className="border-b border-border bg-background/40 px-4 py-3">
                  <h2 className="font-bold capitalize text-neutral-titulos">
                    {dia === "SENSE_DATA"
                      ? "Sense data assignada"
                      : formatearDia(partidos[0].fecha_hora!)}
                  </h2>

                  <p className="text-xs text-neutral">
                    {partidos.length} partits
                  </p>
                </div>

                <div className="divide-y divide-border">
                  {partidos.map((partido) => {
                    const local = plazaPartido(partido.id, "LOCAL");

                    const visitante = plazaPartido(partido.id, "VISITANTE");

                    const pista = partido.pista_id
                      ? (pistaPorID.get(partido.pista_id) ?? null)
                      : null;

                    return (
                      <PartidoFila
                        key={partido.id}
                        partido={partido}
                        pista={pista}
                        localNombre={nombreEquipoPlaza(local)}
                        visitanteNombre={nombreEquipoPlaza(visitante)}
                        localEquipo={
                          local?.equipo_resuelto_id
                            ? (equipoPorID.get(local.equipo_resuelto_id) ??
                              null)
                            : null
                        }
                        visitanteEquipo={
                          visitante?.equipo_resuelto_id
                            ? (equipoPorID.get(visitante.equipo_resuelto_id) ??
                              null)
                            : null
                        }
                        fase={fasePorID.get(partido.fase_id)}
                        grupo={
                          partido.grupo_id
                            ? grupoPorID.get(partido.grupo_id)
                            : undefined
                        }
                        ronda={
                          partido.ronda_id
                            ? rondaPorID.get(partido.ronda_id)
                            : undefined
                        }
                        guardando={guardando}
                        puedeEditar={datos.capacidades.editar}
                        puedeEliminar={
                          datos.capacidades.eliminar && partido.tipo === "GRUPO"
                        }
                        onEditar={() => abrirEditar(partido)}
                        onPublicar={() => void cambiarPublicacion(partido)}
                        onEstado={(estado) =>
                          void cambiarEstado(partido, estado)
                        }
                        onEliminar={() => void eliminarPartido(partido)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EstadoVacio
            puedeCrear={datos.capacidades.crear}
            onCrear={abrirNuevo}
          />
        )}
      </div>

      {/* ===================================================
          MODAL CREAR / EDITAR
      =================================================== */}

      {mostrandoFormulario && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={cerrarFormulario}
        >
          <section
            role="dialog"
            aria-modal="true"
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-border bg-background p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  {partidoActual ? "Editar partit" : "Nou partit de grup"}
                </p>

                <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                  {partidoActual
                    ? (partidoActual.nombre ?? partidoActual.codigo)
                    : "Crear partit"}
                </h2>
              </div>

              <button
                type="button"
                disabled={guardando}
                onClick={cerrarFormulario}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarPartido} className="flex flex-col gap-6 p-5">
              {/* =========================================
                  ESTRUCTURA
              ========================================= */}

              {partidoActual ? (
                <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-card/40 p-4">
                  <span className="rounded-lg bg-background px-2.5 py-1 text-xs font-semibold">
                    {partidoActual.tipo === "GRUPO"
                      ? "Fase de grups"
                      : "Eliminatòria"}
                  </span>

                  <span className="rounded-lg bg-background px-2.5 py-1 text-xs">
                    {fasePorID.get(partidoActual.fase_id)?.nombre ?? "Fase"}
                  </span>

                  {partidoActual.grupo_id && (
                    <span className="rounded-lg bg-background px-2.5 py-1 text-xs">
                      {grupoPorID.get(partidoActual.grupo_id)?.nombre ?? "Grup"}
                    </span>
                  )}

                  {partidoActual.ronda_id && (
                    <span className="rounded-lg bg-background px-2.5 py-1 text-xs">
                      {rondaPorID.get(partidoActual.ronda_id)?.nombre ??
                        "Ronda"}
                    </span>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <Campo titulo="Fase" obligatorio>
                    <select
                      value={borrador.faseID}
                      onChange={(evento) =>
                        setBorrador((anterior) => ({
                          ...anterior,

                          faseID: evento.target.value,

                          grupoID: "",

                          localID: "",

                          visitanteID: "",
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    >
                      <option value="">Selecciona...</option>

                      {fasesGrupo.map((fase) => (
                        <option key={fase.id} value={fase.id}>
                          {fase.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>

                  <Campo titulo="Grup" obligatorio>
                    <select
                      value={borrador.grupoID}
                      disabled={!borrador.faseID}
                      onChange={(evento) =>
                        setBorrador((anterior) => ({
                          ...anterior,

                          grupoID: evento.target.value,

                          localID: "",

                          visitanteID: "",
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5 disabled:opacity-40"
                    >
                      <option value="">Selecciona...</option>

                      {gruposDisponibles.map((grupo) => (
                        <option key={grupo.id} value={grupo.id}>
                          {grupo.nombre}
                        </option>
                      ))}
                    </select>
                  </Campo>
                </div>
              )}

              {/* =========================================
                  EQUIPOS DE GRUPO
              ========================================= */}

              {(!partidoActual || partidoActual.tipo === "GRUPO") &&
                borrador.grupoID && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Campo titulo="Equip local" obligatorio>
                      <select
                        value={borrador.localID}
                        onChange={(evento) =>
                          setBorrador((anterior) => ({
                            ...anterior,

                            localID: evento.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                      >
                        <option value="">Selecciona...</option>

                        {equiposGrupoSeleccionado.map((equipo) => (
                          <option
                            key={equipo.id}
                            value={equipo.id}
                            disabled={equipo.id === borrador.visitanteID}
                          >
                            {equipo.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>

                    <Campo titulo="Equip visitant" obligatorio>
                      <select
                        value={borrador.visitanteID}
                        onChange={(evento) =>
                          setBorrador((anterior) => ({
                            ...anterior,

                            visitanteID: evento.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                      >
                        <option value="">Selecciona...</option>

                        {equiposGrupoSeleccionado.map((equipo) => (
                          <option
                            key={equipo.id}
                            value={equipo.id}
                            disabled={equipo.id === borrador.localID}
                          >
                            {equipo.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                )}

              {/* ELIMINATORIA */}

              {partidoActual?.tipo === "ELIMINATORIA" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <ResumenEquipo
                    titulo="Local"
                    nombre={nombreEquipoPlaza(localActual)}
                  />

                  <ResumenEquipo
                    titulo="Visitant"
                    nombre={nombreEquipoPlaza(visitanteActual)}
                  />

                  <p className="md:col-span-2 text-xs text-neutral">
                    Els participants d'una eliminatòria es modifiquen des de
                    Format de competició.
                  </p>
                </div>
              )}

              {/* =========================================
                  PROGRAMACIÓN
              ========================================= */}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Campo titulo="Nom">
                  <input
                    value={borrador.nombre}
                    onChange={(evento) =>
                      setBorrador((anterior) => ({
                        ...anterior,

                        nombre: evento.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  />
                </Campo>

                <Campo titulo="Jornada" obligatorio>
                  <input
                    type="number"
                    min={1}
                    value={borrador.jornada}
                    onChange={(evento) =>
                      setBorrador((anterior) => ({
                        ...anterior,

                        jornada: Math.max(1, Number(evento.target.value) || 1),
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  />
                </Campo>

                <Campo titulo="Data i hora">
                  <input
                    type="datetime-local"
                    value={borrador.fechaHora}
                    onChange={(evento) =>
                      setBorrador((anterior) => ({
                        ...anterior,

                        fechaHora: evento.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  />
                </Campo>

                <Campo titulo="Pista">
                  <select
                    value={borrador.pistaID}
                    onChange={(evento) =>
                      setBorrador((anterior) => ({
                        ...anterior,

                        pistaID: evento.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                  >
                    <option value="">Sense assignar</option>

                    {datos.pistas
                      .filter(
                        (pista) =>
                          pista.activa || pista.id === borrador.pistaID,
                      )
                      .map((pista) => (
                        <option key={pista.id} value={pista.id}>
                          {pista.nombre}

                          {!pista.activa ? " · Inactiva" : ""}
                        </option>
                      ))}
                  </select>
                </Campo>

                <Campo titulo="Duració">
                  <div className="flex">
                    <input
                      type="number"
                      min={1}
                      value={borrador.duracion}
                      onChange={(evento) =>
                        setBorrador((anterior) => ({
                          ...anterior,

                          duracion: evento.target.value,
                        }))
                      }
                      className="min-w-0 flex-1 rounded-l-xl border border-border bg-background px-3 py-2.5"
                    />

                    <span className="flex items-center rounded-r-xl border border-l-0 border-border bg-card px-3 text-xs text-neutral">
                      min
                    </span>
                  </div>
                </Campo>
              </div>

              <label className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
                <input
                  type="checkbox"
                  checked={borrador.publicado}
                  onChange={(evento) =>
                    setBorrador((anterior) => ({
                      ...anterior,

                      publicado: evento.target.checked,
                    }))
                  }
                  className="mt-1"
                />

                <div>
                  <p className="font-semibold text-neutral-titulos">
                    Publicar partit
                  </p>

                  <p className="mt-1 text-xs text-neutral">
                    Un partit publicat necessita data, hora, pista i
                    participants.
                  </p>
                </div>
              </label>

              <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-background p-5">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={cerrarFormulario}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel·lar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {guardando
                    ? "Guardant..."
                    : partidoActual
                      ? "Guardar canvis"
                      : "Crear partit"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

// ============================================================
// PARTIDO FILA
// ============================================================
//
// AHORA PartidoFila PERTENECE A Calendari.tsx,
// no a Gestor.tsx.
// ============================================================

function PartidoFila({
  partido,
  pista,
  localNombre,
  visitanteNombre,
  localEquipo,
  visitanteEquipo,
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
  partido: Partido;

  pista: Pista | null;

  localNombre: string;

  visitanteNombre: string;

  localEquipo: Equipo | null;

  visitanteEquipo: Equipo | null;

  fase: Fase | undefined;

  grupo: Grupo | undefined;

  ronda: Ronda | undefined;

  guardando: boolean;

  puedeEditar: boolean;

  puedeEliminar: boolean;

  onEditar: () => void;

  onPublicar: () => void;

  onEstado: (estado: EstadoPartido) => void;

  onEliminar: () => void;
}) {
  return (
    <article className="p-4">
      <div className="grid items-center gap-4 xl:grid-cols-[120px_minmax(0,1fr)_220px_auto]">
        {/* HORA */}

        <div>
          <p className="text-2xl font-bold text-neutral-titulos">
            {formatearHora(partido.fecha_hora)}
          </p>

          <p
            className={
              pista ? "mt-1 text-xs text-neutral" : "mt-1 text-xs text-error"
            }
          >
            {pista ? pista.nombre : "Sense pista"}
          </p>
        </div>

        {/* EQUIPOS */}

        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <EquipoPartido equipo={localEquipo} nombre={localNombre} derecha />

            <span className="text-xs font-bold text-neutral">VS</span>

            <EquipoPartido equipo={visitanteEquipo} nombre={visitanteNombre} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral">
            {fase && (
              <span className="rounded bg-background px-2 py-1">
                {fase.nombre}
              </span>
            )}

            {grupo && (
              <span className="rounded bg-background px-2 py-1">
                {grupo.nombre}
              </span>
            )}

            {ronda && (
              <span className="rounded bg-background px-2 py-1">
                {ronda.nombre}
              </span>
            )}

            {partido.jornada !== null && (
              <span className="rounded bg-background px-2 py-1">
                Jornada {partido.jornada}
              </span>
            )}

            <span className="rounded bg-background px-2 py-1">
              {partido.codigo}
            </span>
          </div>
        </div>

        {/* ESTADO */}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold ${clasesEstado(
                partido.estado,
              )}`}
            >
              {nombreEstado(partido.estado)}
            </span>

            <span className="rounded-lg border border-border px-2.5 py-1 text-[11px]">
              {partido.publicado ? "Publicat" : "No publicat"}
            </span>
          </div>

          {/* TODOS LOS ESTADOS */}

          {puedeEditar && (
            <select
              value={partido.estado}
              disabled={guardando}
              onChange={(evento) =>
                onEstado(evento.target.value as EstadoPartido)
              }
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="BORRADOR">Esborrany</option>

              <option value="PROGRAMADO">Programat</option>

              <option value="EN_CURSO">En curs</option>

              <option value="FINALIZADO">Finalitzat</option>

              <option value="SUSPENDIDO">Suspès</option>

              <option value="CANCELADO">Cancel·lat</option>
            </select>
          )}
        </div>

        {/* ACCIONES */}

        <div className="flex flex-wrap justify-end gap-2">
          {puedeEditar && (
            <>
              <button
                type="button"
                disabled={guardando}
                onClick={onEditar}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-40"
              >
                Editar
              </button>

              <button
                type="button"
                disabled={guardando}
                onClick={onPublicar}
                className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:opacity-40"
              >
                {partido.publicado ? "Despublicar" : "Publicar"}
              </button>
            </>
          )}

          {puedeEliminar && (
            <button
              type="button"
              disabled={guardando}
              onClick={onEliminar}
              className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ============================================================
// EQUIPO
// ============================================================

function EquipoPartido({
  equipo,
  nombre,
  derecha = false,
}: {
  equipo: Equipo | null;

  nombre: string;

  derecha?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        derecha ? "justify-end text-right" : ""
      }`}
    >
      {derecha && <p className="truncate text-sm font-bold">{nombre}</p>}

      {equipo?.escudo ? (
        <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-white p-1">
          <img
            src={equipo.escudo}
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
          {iniciales(nombre)}
        </div>
      )}

      {!derecha && <p className="truncate text-sm font-bold">{nombre}</p>}
    </div>
  );
}

// ============================================================
// CAMPO
// ============================================================

function Campo({
  titulo,
  obligatorio = false,
  children,
}: {
  titulo: string;

  obligatorio?: boolean;

  children: ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold text-neutral-titulos">
        {titulo}

        {obligatorio && <span className="ml-1 text-error">*</span>}
      </span>

      {children}
    </label>
  );
}

// ============================================================
// EQUIPO READONLY
// ============================================================

function ResumenEquipo({
  titulo,
  nombre,
}: {
  titulo: string;

  nombre: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <p className="text-xs uppercase tracking-wider text-neutral">{titulo}</p>

      <p className="mt-2 font-bold text-neutral-titulos">{nombre}</p>
    </div>
  );
}

// ============================================================
// RESUMEN
// ============================================================

function TarjetaResumen({
  titulo,
  valor,
}: {
  titulo: string;

  valor: number;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral">
        {titulo}
      </p>

      <p className="mt-2 text-2xl font-bold text-neutral-titulos">{valor}</p>
    </div>
  );
}

// ============================================================
// VACÍO
// ============================================================

function EstadoVacio({
  puedeCrear,
  onCrear,
}: {
  puedeCrear: boolean;

  onCrear: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <h2 className="text-lg font-bold text-neutral-titulos">
        No hi ha partits
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-neutral">
        No hi ha cap partit que coincideixi amb els filtres seleccionats.
      </p>

      {puedeCrear && (
        <button
          type="button"
          onClick={onCrear}
          className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
        >
          + Partit de grup
        </button>
      )}
    </section>
  );
}

// ============================================================
// AVISOS
// ============================================================

function Avisos({
  error,
  mensaje,
  avisos,
  onCerrarError,
  onCerrarMensaje,
  onCerrarAvisos,
}: {
  error: string;

  mensaje: string;

  avisos: AvisoConflicto[];

  onCerrarError: () => void;

  onCerrarMensaje: () => void;

  onCerrarAvisos: () => void;
}) {
  if (!error && !mensaje && avisos.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[160] flex w-[min(430px,calc(100vw-2rem))] flex-col gap-2">
      {error && (
        <div className="pointer-events-auto rounded-xl border border-error/30 bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-error">Error</p>

              <p className="mt-1 text-sm text-error">{error}</p>
            </div>

            <button type="button" onClick={onCerrarError}>
              ×
            </button>
          </div>
        </div>
      )}

      {mensaje && (
        <div className="pointer-events-auto rounded-xl border border-secondary/30 bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <p className="min-w-0 flex-1 text-sm font-semibold text-secondary">
              {mensaje}
            </p>

            <button type="button" onClick={onCerrarMensaje}>
              ×
            </button>
          </div>
        </div>
      )}

      {avisos.length > 0 && (
        <div className="pointer-events-auto rounded-xl border border-orange-500/30 bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-bold text-orange-600">
                Conflictes de programació
              </p>

              <div className="mt-2 flex flex-col gap-2">
                {avisos.map((aviso, indice) => (
                  <p
                    key={`${aviso.tipo}-${indice}`}
                    className="text-xs text-neutral"
                  >
                    {aviso.mensaje}
                  </p>
                ))}
              </div>

              <p className="mt-2 text-[11px] text-neutral">
                El canvi s'ha guardat igualment.
              </p>
            </div>

            <button type="button" onClick={onCerrarAvisos}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
