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

  estado: string;

  fecha_hora: string | null;

  /*
   * Fuente real de la pista.
   */
  pista_id: string | null;

  /*
   * Campo antiguo.
   * No se utiliza para seleccionar la pista.
   */
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
// VISUALES
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

export default function Gestor({ torneoID, edicionID }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [avisos, setAvisos] = useState<AvisoConflicto[]>([]);

  const [vista, setVista] = useState<Vista>("CALENDARI");

  const [filtroFase, setFiltroFase] = useState("");

  const [filtroEstructura, setFiltroEstructura] = useState("");

  const [filtroEstado, setFiltroEstado] = useState("");

  const [mostrandoFormulario, setMostrandoFormulario] = useState(false);

  const [partidoEditando, setPartidoEditando] = useState<string | null>(null);

  const [borrador, setBorrador] = useState<BorradorPartido>(nuevoBorrador());

  // ========================================================
  // BLOQUEAR SCROLL CUANDO HAY MODAL
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
  // CERRAR MENSAJE DE ÉXITO
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
  // CARGA
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
        throw new Error(
          json?.mensaje ||
            `Error ${respuesta.status}: no s'ha pogut completar l'operació.`,
        );
      }

      if (Array.isArray(json.avisos)) {
        setAvisos(json.avisos as AvisoConflicto[]);
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
  // FASES / GRUPOS
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
  // PLAZAS
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

    if (plaza.origen_tipo === "LIBRE") {
      return "Lliure / bye";
    }

    if (plaza.origen_tipo === "EQUIPO") {
      return equipoPorID.get(plaza.equipo_origen_id ?? "")?.nombre ?? "Equip";
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
      const fase = plaza.origen_fase_id
        ? fasePorID.get(plaza.origen_fase_id)
        : null;

      return `${plaza.origen_posicion ?? "?"}a posició · ${
        fase?.nombre ?? "Fase"
      }`;
    }

    if (
      plaza.origen_tipo === "GANADOR_PARTIDO" ||
      plaza.origen_tipo === "PERDEDOR_PARTIDO"
    ) {
      const partido = plaza.origen_partido_id
        ? partidoPorID.get(plaza.origen_partido_id)
        : null;

      return `${
        plaza.origen_tipo === "GANADOR_PARTIDO" ? "Guanyador" : "Perdedor"
      } · ${partido?.nombre ?? partido?.codigo ?? "Partit"}`;
    }

    return "Per determinar";
  }

  // ========================================================
  // ABRIR MODAL NUEVO
  // ========================================================

  function abrirNuevo() {
    setPartidoEditando(null);

    setBorrador(nuevoBorrador());

    setAvisos([]);

    setError("");

    setMostrandoFormulario(true);
  }

  // ========================================================
  // ABRIR MODAL EDITAR
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

    setAvisos([]);

    setError("");

    setMostrandoFormulario(true);
  }

  // ========================================================
  // CERRAR MODAL
  // ========================================================

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

    setError("");

    const fechaHora = datetimeLocalAISO(borrador.fechaHora);

    try {
      // ====================================================
      // EDITAR EXISTENTE
      // ====================================================

      if (partidoEditando) {
        const actual = partidoPorID.get(partidoEditando);

        if (!actual) {
          throw new Error("No s'ha trobat el partit.");
        }

        if (borrador.publicado && !fechaHora) {
          throw new Error(
            "Indica la data i l'hora abans de publicar el partit.",
          );
        }

        if (borrador.publicado && !borrador.pistaID) {
          throw new Error("Selecciona una pista abans de publicar el partit.");
        }

        const cuerpo: Record<string, unknown> = {
          accion: "editar_partido",

          partidoID: partidoEditando,

          nombre: borrador.nombre,

          jornada: borrador.jornada,

          fechaHora,

          pistaID: borrador.pistaID || null,

          duracion: borrador.duracion ? Number(borrador.duracion) : null,

          publicado: borrador.publicado,
        };

        /*
         * Los equipos solo se modifican aquí
         * si es un partido de GRUPO en borrador.
         *
         * Las eliminatorias se configuran desde
         * Format de competició.
         */
        if (
          actual.tipo === "GRUPO" &&
          actual.estado === "BORRADOR" &&
          !actual.publicado
        ) {
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

        await peticion("PATCH", cuerpo);

        setMensaje("Partit actualitzat correctament.");
      }

      // ====================================================
      // CREAR PARTIDO DE GRUPO
      // ====================================================
      else {
        if (!borrador.faseID) {
          throw new Error("Selecciona una fase de grups.");
        }

        if (!borrador.grupoID) {
          throw new Error("Selecciona un grup.");
        }

        if (equiposGrupoSeleccionado.length < 2) {
          throw new Error("Aquest grup no té prou equips assignats.");
        }

        if (!borrador.localID || !borrador.visitanteID) {
          throw new Error("Selecciona l'equip local i el visitant.");
        }

        if (borrador.localID === borrador.visitanteID) {
          throw new Error(
            "L'equip local i el visitant no poden ser el mateix.",
          );
        }

        if (borrador.publicado && !fechaHora) {
          throw new Error(
            "Indica la data i l'hora abans de publicar el partit.",
          );
        }

        if (borrador.publicado && !borrador.pistaID) {
          throw new Error("Selecciona una pista abans de publicar el partit.");
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
  // PUBLICACIÓN
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
          : "No s'ha pogut canviar la publicació.",
      );
    }
  }

  // ========================================================
  // ESTADO
  // ========================================================

  async function cambiarEstado(partido: Partido, estado: string) {
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
  // ELIMINAR
  // ========================================================

  async function eliminarPartido(partido: Partido) {
    if (partido.tipo !== "GRUPO") {
      setError(
        "Els partits eliminatoris s'han de gestionar des de Format de competició.",
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
        accion: "eliminar_partido",

        partidoID: partido.id,
      });

      setMensaje("Partit eliminat correctament.");

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
      const finalizado =
        partido.estado === "FINALIZADO" || Boolean(partido.finalizado_at);

      if (finalizado) {
        return false;
      }

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
  // VISTAS
  // ========================================================

  function abrirCalendario() {
    setVista("CALENDARI");
  }

  function abrirResultados() {
    setVista("RESULTATS");

    setMostrandoFormulario(false);

    setPartidoEditando(null);

    setBorrador(nuevoBorrador());

    setError("");
  }

  // ========================================================
  // LOADING
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="flex min-h-96 w-full items-center justify-center p-6">
        <Cargando />
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="p-4">
        <Avisos
          error={error || "No s'ha pogut carregar el calendari."}
          mensaje=""
          avisos={[]}
          onCerrarError={() => setError("")}
          onCerrarMensaje={() => {}}
          onCerrarAvisos={() => {}}
        />
      </div>
    );
  }

  // ========================================================
  // PARTIDO ACTUAL
  // ========================================================

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
      <div className="flex w-full flex-col gap-5 p-4 pt-0">
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
            NAVEGACIÓN
        ================================================= */}

        <section className="rounded-2xl border border-border/50 bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-3">
            <div className="flex gap-1 rounded-xl bg-background p-1">
              <button
                type="button"
                onClick={abrirCalendario}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  vista === "CALENDARI"
                    ? "bg-card text-primary shadow-sm"
                    : "text-neutral"
                }`}
              >
                Calendari
              </button>

              <button
                type="button"
                onClick={abrirResultados}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  vista === "RESULTATS"
                    ? "bg-card text-primary shadow-sm"
                    : "text-neutral"
                }`}
              >
                Resultats
              </button>
            </div>

            {vista === "CALENDARI" && datos.capacidades.crear && (
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

          {/* FILTROS */}

          {vista === "CALENDARI" && (
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

                <option value="SUSPENDIDO">Suspès</option>

                <option value="CANCELADO">Cancel·lat</option>
              </select>
            </div>
          )}
        </section>

        {/* =================================================
            RESULTADOS
        ================================================= */}

        {vista === "RESULTATS" && (
          <Resultats torneoID={torneoID} edicionID={edicionID} />
        )}

        {/* =================================================
            CALENDARIO
        ================================================= */}

        {vista === "CALENDARI" && (
          <>
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
                            local={local}
                            visitante={visitante}
                            localNombre={nombreEquipoPlaza(local)}
                            visitanteNombre={nombreEquipoPlaza(visitante)}
                            equipoPorID={equipoPorID}
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
                              datos.capacidades.eliminar &&
                              partido.tipo === "GRUPO"
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
              <EstadoVacioCalendario
                puedeCrear={datos.capacidades.crear}
                onCrear={abrirNuevo}
              />
            )}
          </>
        )}
      </div>

      {/* ===================================================
          POPUP CENTRAL CREAR / EDITAR
      =================================================== */}

      {mostrandoFormulario && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={cerrarFormulario}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={partidoEditando ? "Editar partit" : "Crear partit"}
            className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            {/* HEADER */}

            <div className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-border bg-background p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  {partidoEditando ? "Editar partit" : "Nou partit de grup"}
                </p>

                <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                  {partidoActual
                    ? (partidoActual.nombre ?? partidoActual.codigo)
                    : "Crear partit"}
                </h2>

                {partidoActual && (
                  <p className="mt-1 text-xs text-neutral">
                    {partidoActual.codigo}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={guardando}
                onClick={cerrarFormulario}
                aria-label="Tancar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-xl text-neutral transition hover:bg-card disabled:opacity-40"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarPartido} className="flex flex-col gap-6 p-5">
              {/* ===========================================
                  CONTEXTO EXISTENTE
              =========================================== */}

              {partidoActual ? (
                <section>
                  <h3 className="font-bold text-neutral-titulos">Competició</h3>

                  <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-border bg-card/40 p-4">
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
                        {grupoPorID.get(partidoActual.grupo_id)?.nombre ??
                          "Grup"}
                      </span>
                    )}

                    {partidoActual.ronda_id && (
                      <span className="rounded-lg bg-background px-2.5 py-1 text-xs">
                        {rondaPorID.get(partidoActual.ronda_id)?.nombre ??
                          "Ronda"}
                      </span>
                    )}
                  </div>
                </section>
              ) : (
                <section>
                  <h3 className="font-bold text-neutral-titulos">Competició</h3>

                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <Campo titulo="Fase de grups" obligatorio>
                      <select
                        value={borrador.faseID}
                        disabled={guardando}
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
                        <option value="">Selecciona una fase...</option>

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
                        disabled={guardando || !borrador.faseID}
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
                        <option value="">Selecciona un grup...</option>

                        {gruposDisponibles.map((grupo) => (
                          <option key={grupo.id} value={grupo.id}>
                            {grupo.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                </section>
              )}

              {/* ===========================================
                  PARTICIPANTES GRUPO
              =========================================== */}

              {(!partidoActual ||
                (partidoActual.tipo === "GRUPO" &&
                  partidoActual.estado === "BORRADOR" &&
                  !partidoActual.publicado)) &&
                borrador.grupoID && (
                  <section className="border-t border-border pt-5">
                    <div>
                      <h3 className="font-bold text-neutral-titulos">
                        Participants
                      </h3>

                      <p className="mt-1 text-xs text-neutral">
                        {equiposGrupoSeleccionado.length} equips disponibles en
                        aquest grup.
                      </p>
                    </div>

                    <div className="mt-3 grid gap-4 lg:grid-cols-2">
                      <Campo titulo="Equip local" obligatorio>
                        <select
                          value={borrador.localID}
                          disabled={guardando}
                          onChange={(evento) =>
                            setBorrador((anterior) => ({
                              ...anterior,

                              localID: evento.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                        >
                          <option value="">Selecciona l'equip...</option>

                          {equiposGrupoSeleccionado
                            .filter(
                              (equipo) => equipo.id !== borrador.visitanteID,
                            )
                            .map((equipo) => (
                              <option key={equipo.id} value={equipo.id}>
                                {equipo.nombre}
                              </option>
                            ))}
                        </select>
                      </Campo>

                      <Campo titulo="Equip visitant" obligatorio>
                        <select
                          value={borrador.visitanteID}
                          disabled={guardando}
                          onChange={(evento) =>
                            setBorrador((anterior) => ({
                              ...anterior,

                              visitanteID: evento.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                        >
                          <option value="">Selecciona l'equip...</option>

                          {equiposGrupoSeleccionado
                            .filter((equipo) => equipo.id !== borrador.localID)
                            .map((equipo) => (
                              <option key={equipo.id} value={equipo.id}>
                                {equipo.nombre}
                              </option>
                            ))}
                        </select>
                      </Campo>
                    </div>
                  </section>
                )}

              {/* ===========================================
                  ELIMINATORIA
              =========================================== */}

              {partidoActual?.tipo === "ELIMINATORIA" && (
                <section className="border-t border-border pt-5">
                  <h3 className="font-bold text-neutral-titulos">
                    Encreuament
                  </h3>

                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <ResumenEquipo
                      titulo="Local"
                      nombre={nombreEquipoPlaza(localActual)}
                    />

                    <ResumenEquipo
                      titulo="Visitant"
                      nombre={nombreEquipoPlaza(visitanteActual)}
                    />
                  </div>

                  <p className="mt-3 text-xs text-neutral">
                    Els participants i les dependències del bracket es
                    modifiquen des de Format de competició.
                  </p>
                </section>
              )}

              {/* ===========================================
                  PROGRAMACIÓN
              =========================================== */}

              <section className="border-t border-border pt-5">
                <div>
                  <h3 className="font-bold text-neutral-titulos">
                    Programació
                  </h3>

                  <p className="mt-1 text-xs text-neutral">
                    Configura la jornada, data, hora, pista i duració estimada.
                  </p>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Campo titulo="Nom">
                    <input
                      value={borrador.nombre}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorrador((anterior) => ({
                          ...anterior,

                          nombre: evento.target.value,
                        }))
                      }
                      placeholder="Opcional"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    />
                  </Campo>

                  <Campo titulo="Jornada" obligatorio>
                    <input
                      type="number"
                      min={1}
                      value={borrador.jornada}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorrador((anterior) => ({
                          ...anterior,

                          jornada: Math.max(
                            1,
                            Number(evento.target.value) || 1,
                          ),
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2.5"
                    />
                  </Campo>

                  <Campo titulo="Data i hora">
                    <input
                      type="datetime-local"
                      value={borrador.fechaHora}
                      disabled={guardando}
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
                      disabled={guardando}
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

                    {datos.pistas.filter((pista) => pista.activa).length ===
                      0 && (
                      <p className="mt-2 text-xs font-medium text-error">
                        No hi ha pistes actives configurades.
                      </p>
                    )}
                  </Campo>

                  <Campo titulo="Duració estimada">
                    <div className="flex">
                      <input
                        type="number"
                        min={1}
                        value={borrador.duracion}
                        disabled={guardando}
                        onChange={(evento) =>
                          setBorrador((anterior) => ({
                            ...anterior,

                            duracion: evento.target.value,
                          }))
                        }
                        placeholder="45"
                        className="min-w-0 flex-1 rounded-l-xl border border-border bg-background px-3 py-2.5"
                      />

                      <span className="flex items-center rounded-r-xl border border-l-0 border-border bg-card px-3 text-xs text-neutral">
                        min
                      </span>
                    </div>
                  </Campo>
                </div>
              </section>

              {/* ===========================================
                  PUBLICACIÓN
              =========================================== */}

              <label className="flex items-start gap-3 rounded-xl border border-border bg-card/40 p-4">
                <input
                  type="checkbox"
                  checked={borrador.publicado}
                  disabled={guardando}
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

                  <p className="mt-1 text-xs leading-5 text-neutral">
                    Per publicar-lo és obligatori tenir data, hora, pista
                    configurada i participants.
                  </p>
                </div>
              </label>

              {/* ===========================================
                  FOOTER
              =========================================== */}

              <div className="sticky bottom-0 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-background p-5">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={cerrarFormulario}
                  className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
                >
                  Cancel·lar
                </button>

                <button
                  disabled={guardando}
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
        </div>
      )}
    </>
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
    <div
      className="
        pointer-events-none
        fixed
        inset-x-3
        top-3
        z-[150]
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
        <div className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-error/30 bg-card p-4 text-error shadow-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error/10">
            !
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              No s'ha pogut completar l'operació
            </p>

            <p className="mt-1 text-sm leading-5">{error}</p>
          </div>

          <button
            type="button"
            onClick={onCerrarError}
            aria-label="Tancar error"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-error/10"
          >
            ×
          </button>
        </div>
      )}

      {mensaje && (
        <div className="pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-secondary/30 bg-card p-4 text-secondary shadow-xl">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
            ✓
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Operació completada</p>

            <p className="mt-1 text-sm">{mensaje}</p>
          </div>

          <button
            type="button"
            onClick={onCerrarMensaje}
            aria-label="Tancar avís"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg hover:bg-secondary/10"
          >
            ×
          </button>
        </div>
      )}

      {avisos.length > 0 && (
        <div className="pointer-events-auto w-full rounded-xl border border-orange-500/30 bg-card p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 font-bold text-orange-600">
              !
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-neutral-titulos">
                Conflictes de programació
              </p>

              <div className="mt-2 flex flex-col gap-2">
                {avisos.map((aviso, indice) => (
                  <div
                    key={`${aviso.tipo}-${aviso.partido.id}-${indice}`}
                    className="rounded-lg bg-background p-2.5"
                  >
                    <p className="text-xs font-bold text-orange-600">
                      {aviso.tipo === "PISTA"
                        ? "Conflicte de pista"
                        : "Conflicte d'equip"}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-neutral">
                      {aviso.mensaje}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-2 text-[11px] text-neutral">
                El canvi s'ha guardat igualment.
              </p>
            </div>

            <button
              type="button"
              onClick={onCerrarAvisos}
              aria-label="Tancar avisos"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// RESUMEN
// ============================================================

function TarjetaResumen({ titulo, valor }: { titulo: string; valor: number }) {
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
// RESUMEN EQUIPO
// ============================================================

function ResumenEquipo({ titulo, nombre }: { titulo: string; nombre: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {titulo}
      </p>

      <p className="mt-2 font-semibold text-neutral-titulos">{nombre}</p>
    </div>
  );
}

// ============================================================
// PARTIDO CALENDARIO
// ============================================================

function PartidoFila({
  partido,
  pista,
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
  partido: Partido;

  pista: Pista | null;

  local: Plaza | null;

  visitante: Plaza | null;

  localNombre: string;

  visitanteNombre: string;

  equipoPorID: Map<string, Equipo>;

  fase: Fase | undefined;

  grupo: Grupo | undefined;

  ronda: Ronda | undefined;

  guardando: boolean;

  puedeEditar: boolean;

  puedeEliminar: boolean;

  onEditar: () => void;

  onPublicar: () => void;

  onEstado: (estado: string) => void;

  onEliminar: () => void;
}) {
  const localEquipo = local?.equipo_resuelto_id
    ? equipoPorID.get(local.equipo_resuelto_id)
    : null;

  const visitanteEquipo = visitante?.equipo_resuelto_id
    ? equipoPorID.get(visitante.equipo_resuelto_id)
    : null;

  const finalizado =
    partido.estado === "FINALIZADO" || Boolean(partido.finalizado_at);

  return (
    <article className="p-4">
      <div className="grid items-center gap-4 xl:grid-cols-[120px_minmax(0,1fr)_220px_auto]">
        {/* HORA / PISTA */}

        <div>
          <p className="text-2xl font-bold text-neutral-titulos">
            {formatearHora(partido.fecha_hora)}
          </p>

          <p
            className={
              pista
                ? "mt-1 text-xs font-medium text-neutral"
                : "mt-1 text-xs font-medium text-error"
            }
          >
            {pista ? pista.nombre : "Sense pista configurada"}
          </p>
        </div>

        {/* EQUIPOS */}

        <div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <EquipoPartido
              equipo={localEquipo ?? null}
              nombre={localNombre}
              derecha
            />

            <span className="text-xs font-bold text-neutral">VS</span>

            <EquipoPartido
              equipo={visitanteEquipo ?? null}
              nombre={visitanteNombre}
            />
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

          {puedeEditar && !finalizado && partido.estado !== "EN_CURSO" && (
            <select
              value={partido.estado}
              disabled={guardando}
              onChange={(evento) => onEstado(evento.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            >
              <option value="BORRADOR">Esborrany</option>

              <option value="PROGRAMADO">Programat</option>

              <option value="SUSPENDIDO">Suspès</option>

              <option value="CANCELADO">Cancel·lat</option>
            </select>
          )}
        </div>

        {/* ACCIONES */}

        <div className="flex flex-wrap justify-end gap-2">
          {puedeEditar && !finalizado && (
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

          {puedeEliminar &&
            partido.tipo === "GRUPO" &&
            partido.estado === "BORRADOR" &&
            !partido.publicado && (
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
// EQUIPO PARTIDO
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
// ESTADO VACÍO
// ============================================================

function EstadoVacioCalendario({
  puedeCrear,
  onCrear,
}: {
  puedeCrear: boolean;

  onCrear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-6 py-14 text-center">
      <h2 className="text-lg font-bold text-neutral-titulos">
        No hi ha partits
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm text-neutral">
        Els partits eliminatoris es generen des de Format de competició. Des
        d'aquí pots crear manualment partits de la fase de grups.
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
    </div>
  );
}
