import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormEvent } from "react";

// ============================================================
// TIPOS
// ============================================================

type TipoRonda =
  | "TREINTADOSAVOS"
  | "DIECISEISAVOS"
  | "OCTAVOS"
  | "CUARTOS"
  | "SEMIFINAL"
  | "FINAL"
  | "TERCER_PUESTO"
  | "CLASIFICACION"
  | "PERSONALIZADA";

type TipoRondaPrincipal =
  | "TREINTADOSAVOS"
  | "DIECISEISAVOS"
  | "OCTAVOS"
  | "CUARTOS"
  | "SEMIFINAL"
  | "FINAL";

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

type Fase = {
  id: string;
  edicion_id: string;
  nombre: string;
  tipo: "ELIMINATORIA";
  orden: number;
  estado: string;
  publicada: boolean;
  configuracion: unknown;
  cerrada_at: string | null;
};

type Ronda = {
  id: string;
  fase_id: string;
  tipo: TipoRonda;
  nombre: string;
  orden: number;
};

type Partido = {
  id: string;
  edicion_id: string;
  fase_id: string;
  fase_tipo: string;
  tipo: string;

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
};

type Plaza = {
  id: string;

  edicion_id: string;

  destino_fase_id: string;

  destino_tipo: "PARTIDO" | "GRUPO";

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

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Pista = {
  id: string;
  torneo_id: string;
  nombre: string;
  descripcion: string;
  ubicacion: string;
  activa: boolean;
};

type GrupoOrigen = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
  estado: string;

  faseNombre: string;
  faseOrden: number;
};

type Aviso = {
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
  };

  capacidades: {
    editar: boolean;
  };

  fases: Fase[];

  rondas: Ronda[];

  partidos: Partido[];

  plazas: Plaza[];

  equipos: Equipo[];

  pistas: Pista[];

  gruposOrigen: GrupoOrigen[];
};

type Props = {
  torneoID: string;
  edicionID: string;
};

type DraftPlaza = {
  origenTipo: "" | TipoOrigen;

  equipoID: string;

  grupoID: string;

  faseOrigenID: string;

  posicion: string;

  partidoOrigenID: string;
};

type DraftPartido = {
  nombre: string;

  jornada: string;

  fecha: string;

  hora: string;

  duracion: string;

  pistaID: string;

  estado: EstadoPartido;

  publicado: boolean;
};

// ============================================================
// CONSTANTES
// ============================================================

const API = "/api/panell/competicio/eliminatoria";

const TIPOS_RONDA_PRINCIPAL: readonly TipoRondaPrincipal[] = [
  "TREINTADOSAVOS",
  "DIECISEISAVOS",
  "OCTAVOS",
  "CUARTOS",
  "SEMIFINAL",
  "FINAL",
];

const OPCIONES_RONDA: {
  valor: TipoRondaPrincipal;
  nombre: string;
}[] = [
  {
    valor: "TREINTADOSAVOS",
    nombre: "Trenta-dosens de final",
  },
  {
    valor: "DIECISEISAVOS",
    nombre: "Setzens de final",
  },
  {
    valor: "OCTAVOS",
    nombre: "Vuitens de final",
  },
  {
    valor: "CUARTOS",
    nombre: "Quarts de final",
  },
  {
    valor: "SEMIFINAL",
    nombre: "Semifinals",
  },
  {
    valor: "FINAL",
    nombre: "Final",
  },
];

const OPCIONES_ESTADO: {
  valor: EstadoPartido;
  nombre: string;
}[] = [
  {
    valor: "BORRADOR",
    nombre: "Esborrany",
  },
  {
    valor: "PROGRAMADO",
    nombre: "Programat",
  },
  {
    valor: "EN_CURSO",
    nombre: "En curs",
  },
  {
    valor: "FINALIZADO",
    nombre: "Finalitzat",
  },
  {
    valor: "SUSPENDIDO",
    nombre: "Suspès",
  },
  {
    valor: "CANCELADO",
    nombre: "Cancel·lat",
  },
];

const DRAFT_PLAZA_VACIO: DraftPlaza = {
  origenTipo: "",

  equipoID: "",

  grupoID: "",

  faseOrigenID: "",

  posicion: "1",

  partidoOrigenID: "",
};

// ============================================================
// HELPERS
// ============================================================

function esRondaPrincipal(tipo: TipoRonda): tipo is TipoRondaPrincipal {
  return TIPOS_RONDA_PRINCIPAL.includes(tipo as TipoRondaPrincipal);
}

function nombreEstado(estado: EstadoPartido) {
  return (
    OPCIONES_ESTADO.find((opcion) => opcion.valor === estado)?.nombre ?? estado
  );
}

function partesFecha(fechaISO: string | null) {
  if (!fechaISO) {
    return {
      fecha: "",
      hora: "",
    };
  }

  const fecha = new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) {
    return {
      fecha: "",
      hora: "",
    };
  }

  const pad = (numero: number) => String(numero).padStart(2, "0");

  return {
    fecha:
      `${fecha.getFullYear()}-` +
      `${pad(fecha.getMonth() + 1)}-` +
      `${pad(fecha.getDate())}`,

    hora: `${pad(fecha.getHours())}:` + `${pad(fecha.getMinutes())}`,
  };
}

function draftPartido(partido: Partido): DraftPartido {
  const fecha = partesFecha(partido.fecha_hora);

  return {
    nombre: partido.nombre ?? partido.codigo,

    jornada: String(partido.jornada ?? 1),

    fecha: fecha.fecha,

    hora: fecha.hora,

    duracion: partido.duracion_estimada_min
      ? String(partido.duracion_estimada_min)
      : "",

    pistaID: partido.pista_id ?? "",

    estado: partido.estado,

    publicado: partido.publicado,
  };
}

function draftPlaza(plaza: Plaza | null): DraftPlaza {
  if (!plaza) {
    return {
      ...DRAFT_PLAZA_VACIO,
    };
  }

  return {
    origenTipo: plaza.origen_tipo,

    equipoID: plaza.equipo_origen_id ?? "",

    grupoID: plaza.origen_grupo_id ?? "",

    faseOrigenID: plaza.origen_fase_id ?? "",

    posicion: String(plaza.origen_posicion ?? 1),

    partidoOrigenID: plaza.origen_partido_id ?? "",
  };
}

function fechaHoraISO(fecha: string, hora: string): string | null {
  if (!fecha && !hora) {
    return null;
  }

  if (!fecha || !hora) {
    throw new Error("Indica tant la data com l'hora del partit.");
  }

  const resultado = new Date(`${fecha}T${hora}:00`);

  if (Number.isNaN(resultado.getTime())) {
    throw new Error("La data o l'hora no són vàlides.");
  }

  return resultado.toISOString();
}

function formatoFechaHora(fechaISO: string | null) {
  if (!fechaISO) {
    return null;
  }

  const fecha = new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return fecha.toLocaleString("ca-ES", {
    day: "2-digit",

    month: "2-digit",

    hour: "2-digit",

    minute: "2-digit",
  });
}

// ============================================================
// COMPONENTE
// ============================================================

export default function Eliminatoria({ torneoID, edicionID }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [faseID, setFaseID] = useState("");

  // ========================================================
  // GENERADOR
  // ========================================================

  const [mostrarGenerador, setMostrarGenerador] = useState(false);

  const [rondaInicial, setRondaInicial] =
    useState<TipoRondaPrincipal>("OCTAVOS");

  const [tercerPuesto, setTercerPuesto] = useState(false);

  // ========================================================
  // CONSOLACIÓN
  // ========================================================

  const [mostrarConsolacion, setMostrarConsolacion] = useState(false);

  const [nombreConsolacion, setNombreConsolacion] = useState("");

  const [jornadaConsolacion, setJornadaConsolacion] = useState("1");

  // ========================================================
  // MODAL PARTIDO
  // ========================================================

  const [partidoModal, setPartidoModal] = useState<Partido | null>(null);

  const [borradorPartido, setBorradorPartido] = useState<DraftPartido | null>(
    null,
  );

  const [borradorLocal, setBorradorLocal] = useState<DraftPlaza>({
    ...DRAFT_PLAZA_VACIO,
  });

  const [borradorVisitante, setBorradorVisitante] = useState<DraftPlaza>({
    ...DRAFT_PLAZA_VACIO,
  });

  const [avisosModal, setAvisosModal] = useState<Aviso[]>([]);

  const [mensajeModal, setMensajeModal] = useState("");

  const [errorModal, setErrorModal] = useState("");

  // ========================================================
  // CARGAR
  // ========================================================

  const cargar = useCallback(
    async (mostrarCarga = true) => {
      if (mostrarCarga) {
        setCargando(true);
      }

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(`${API}?${parametros.toString()}`, {
          credentials: "same-origin",

          cache: "no-store",
        });

        const json = await respuesta.json().catch(() => null);

        if (!respuesta.ok || json?.success !== true) {
          throw new Error(
            json?.mensaje ?? "No s'ha pogut carregar l'eliminatòria.",
          );
        }

        const nuevosDatos = json as Datos;

        setDatos(nuevosDatos);

        setFaseID((anterior) => {
          if (nuevosDatos.fases.some((fase) => fase.id === anterior)) {
            return anterior;
          }

          return nuevosDatos.fases[0]?.id ?? "";
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No s'ha pogut carregar l'eliminatòria.",
        );
      } finally {
        if (mostrarCarga) {
          setCargando(false);
        }
      }
    },
    [torneoID, edicionID],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // ========================================================
  // PETICIÓN
  // ========================================================

  async function peticion(
    metodo: "POST" | "PATCH" | "DELETE",

    cuerpo: Record<string, unknown>,
  ) {
    const respuesta = await fetch(API, {
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
      throw new Error(json?.mensaje ?? "No s'ha pogut completar l'operació.");
    }

    return json as Record<string, unknown>;
  }

  // ========================================================
  // DERIVADOS
  // ========================================================

  const faseSeleccionada = useMemo(
    () => datos?.fases.find((fase) => fase.id === faseID) ?? null,
    [datos, faseID],
  );

  const rondasFase = useMemo(() => {
    if (!datos || !faseSeleccionada) {
      return [];
    }

    return datos.rondas
      .filter((ronda) => ronda.fase_id === faseSeleccionada.id)
      .sort((a, b) => a.orden - b.orden);
  }, [datos, faseSeleccionada]);

  const rondasBracket = useMemo(
    () => rondasFase.filter((ronda) => esRondaPrincipal(ronda.tipo)),
    [rondasFase],
  );

  const rondaTercerPuesto = useMemo(
    () => rondasFase.find((ronda) => ronda.tipo === "TERCER_PUESTO") ?? null,
    [rondasFase],
  );

  const rondasConsolacion = useMemo(
    () =>
      rondasFase.filter(
        (ronda) =>
          ronda.tipo === "CLASIFICACION" || ronda.tipo === "PERSONALIZADA",
      ),
    [rondasFase],
  );

  function partidosRonda(rondaID: string) {
    return (
      datos?.partidos
        .filter((partido) => partido.ronda_id === rondaID)
        .sort((a, b) => a.orden - b.orden) ?? []
    );
  }

  const partidosBracket = useMemo(() => {
    if (!datos) {
      return [];
    }

    const ids = new Set(rondasBracket.map((ronda) => ronda.id));

    return datos.partidos.filter(
      (partido) => partido.ronda_id && ids.has(partido.ronda_id),
    );
  }, [datos, rondasBracket]);

  const partidosConsolacion = useMemo(() => {
    if (!datos) {
      return [];
    }

    const ids = new Set(rondasConsolacion.map((ronda) => ronda.id));

    return datos.partidos
      .filter((partido) => partido.ronda_id && ids.has(partido.ronda_id))
      .sort((a, b) => a.orden - b.orden);
  }, [datos, rondasConsolacion]);

  const partidoTercerPuesto = rondaTercerPuesto
    ? (partidosRonda(rondaTercerPuesto.id)[0] ?? null)
    : null;

  function plazaPartido(partidoID: string, lado: LadoPartido) {
    return (
      datos?.plazas.find(
        (plaza) => plaza.partido_id === partidoID && plaza.lado === lado,
      ) ?? null
    );
  }

  function equipoPorID(id: string | null) {
    if (!datos || !id) {
      return null;
    }

    return datos.equipos.find((equipo) => equipo.id === id) ?? null;
  }

  function pistaPorID(id: string | null) {
    if (!datos || !id) {
      return null;
    }

    return datos.pistas.find((pista) => pista.id === id) ?? null;
  }

  function partidoPorID(id: string | null) {
    if (!datos || !id) {
      return null;
    }

    return datos.partidos.find((partido) => partido.id === id) ?? null;
  }

  function grupoPorID(id: string | null) {
    if (!datos || !id) {
      return null;
    }

    return datos.gruposOrigen.find((grupo) => grupo.id === id) ?? null;
  }

  function nombreFaseOrigen(id: string | null) {
    if (!datos || !id) {
      return "";
    }

    const eliminatoria = datos.fases.find((fase) => fase.id === id);

    if (eliminatoria) {
      return eliminatoria.nombre;
    }

    return (
      datos.gruposOrigen.find((grupo) => grupo.fase_id === id)?.faseNombre ??
      "Fase"
    );
  }

  function descripcionPlaza(plaza: Plaza | null) {
    if (!plaza) {
      return "Per definir";
    }

    if (plaza.equipo_resuelto_id) {
      return equipoPorID(plaza.equipo_resuelto_id)?.nombre ?? "Equip";
    }

    if (plaza.origen_tipo === "LIBRE") {
      return "Lliure";
    }

    if (plaza.origen_tipo === "EQUIPO") {
      return equipoPorID(plaza.equipo_origen_id)?.nombre ?? "Equip";
    }

    if (plaza.origen_tipo === "POSICION_GRUPO") {
      const grupo = grupoPorID(plaza.origen_grupo_id);

      return (
        `${plaza.origen_posicion ?? "?"}r · ` + `${grupo?.nombre ?? "Grup"}`
      );
    }

    if (plaza.origen_tipo === "POSICION_FASE") {
      return (
        `${plaza.origen_posicion ?? "?"}r · ` +
        nombreFaseOrigen(plaza.origen_fase_id)
      );
    }

    if (plaza.origen_tipo === "GANADOR_PARTIDO") {
      return (
        "Guanyador · " +
        (partidoPorID(plaza.origen_partido_id)?.nombre ?? "Partit")
      );
    }

    if (plaza.origen_tipo === "PERDEDOR_PARTIDO") {
      return (
        "Perdedor · " +
        (partidoPorID(plaza.origen_partido_id)?.nombre ?? "Partit")
      );
    }

    return "Per definir";
  }

  // ========================================================
  // GENERAR ELIMINATORIA
  // ========================================================

  async function generarEliminatoria(evento: FormEvent) {
    evento.preventDefault();

    setGuardando(true);

    setError("");
    setMensaje("");

    try {
      const respuesta = await peticion("POST", {
        accion: "generar_eliminatoria",

        rondaInicial,

        tercerPuesto,
      });

      const fase = respuesta.fase as Fase | undefined;

      await cargar(false);

      if (fase?.id) {
        setFaseID(fase.id);
      }

      setMostrarGenerador(false);

      setMensaje("Eliminatòria generada correctament.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut generar l'eliminatòria.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // CONSOLACIÓN
  // ========================================================

  async function crearConsolacion(evento: FormEvent) {
    evento.preventDefault();

    if (!faseSeleccionada) {
      return;
    }

    const jornada = Number(jornadaConsolacion);

    if (!Number.isSafeInteger(jornada) || jornada < 1) {
      setError("La jornada ha de ser un número superior a 0.");

      return;
    }

    setGuardando(true);

    setError("");
    setMensaje("");

    try {
      await peticion("POST", {
        accion: "crear_partido_consolacion",

        faseID: faseSeleccionada.id,

        nombre: nombreConsolacion.trim(),

        jornada,
      });

      setNombreConsolacion("");

      setJornadaConsolacion("1");

      setMostrarConsolacion(false);

      await cargar(false);

      setMensaje("Partit de consolació creat.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No s'ha pogut crear el partit.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // ABRIR MODAL
  // ========================================================

  function abrirPartido(partido: Partido) {
    setPartidoModal(partido);

    setBorradorPartido(draftPartido(partido));

    setBorradorLocal(draftPlaza(plazaPartido(partido.id, "LOCAL")));

    setBorradorVisitante(draftPlaza(plazaPartido(partido.id, "VISITANTE")));

    setAvisosModal([]);

    setMensajeModal("");

    setErrorModal("");
  }

  function cerrarModal() {
    if (guardando) {
      return;
    }

    setPartidoModal(null);

    setBorradorPartido(null);

    setAvisosModal([]);

    setMensajeModal("");

    setErrorModal("");
  }

  // ========================================================
  // GUARDAR PLAZA MODAL
  // ========================================================

  async function guardarPlazaModal(
    partido: Partido,
    lado: LadoPartido,
    draft: DraftPlaza,
    existente: Plaza | null,
  ) {
    if (draft.origenTipo === "") {
      if (existente) {
        await peticion("DELETE", {
          accion: "eliminar_plaza",

          plazaID: existente.id,
        });
      }

      return;
    }

    const cuerpo: Record<string, unknown> = {
      accion: "configurar_plaza",

      partidoID: partido.id,

      lado,

      origenTipo: draft.origenTipo,
    };

    if (draft.origenTipo === "EQUIPO") {
      if (!draft.equipoID) {
        throw new Error(
          `Selecciona l'equip ${lado === "LOCAL" ? "local" : "visitant"}.`,
        );
      }

      cuerpo.equipoID = draft.equipoID;
    }

    if (draft.origenTipo === "POSICION_GRUPO") {
      if (!draft.grupoID) {
        throw new Error("Selecciona el grup d'origen.");
      }

      cuerpo.grupoID = draft.grupoID;

      cuerpo.posicion = Number(draft.posicion);
    }

    if (draft.origenTipo === "POSICION_FASE") {
      if (!draft.faseOrigenID) {
        throw new Error("Selecciona la fase d'origen.");
      }

      cuerpo.faseOrigenID = draft.faseOrigenID;

      cuerpo.posicion = Number(draft.posicion);
    }

    if (
      draft.origenTipo === "GANADOR_PARTIDO" ||
      draft.origenTipo === "PERDEDOR_PARTIDO"
    ) {
      if (!draft.partidoOrigenID) {
        throw new Error("Selecciona el partit d'origen.");
      }

      cuerpo.partidoOrigenID = draft.partidoOrigenID;
    }

    await peticion("POST", cuerpo);
  }

  // ========================================================
  // GUARDAR MODAL
  // ========================================================

  async function guardarPartido(evento: FormEvent) {
    evento.preventDefault();

    if (!partidoModal || !borradorPartido) {
      return;
    }

    const jornada = Number(borradorPartido.jornada);

    if (!Number.isSafeInteger(jornada) || jornada < 1) {
      setErrorModal("La jornada ha de ser un número superior a 0.");

      return;
    }

    const duracion = borradorPartido.duracion
      ? Number(borradorPartido.duracion)
      : null;

    if (
      duracion !== null &&
      (!Number.isSafeInteger(duracion) || duracion < 1)
    ) {
      setErrorModal("La duració ha de ser un nombre de minuts superior a 0.");

      return;
    }

    setGuardando(true);

    setErrorModal("");

    setMensajeModal("");

    setAvisosModal([]);

    try {
      /*
       * Las plazas se guardan antes.
       *
       * Así se pueden editar los participantes y, en el
       * mismo guardado, cambiar BORRADOR -> PROGRAMADO.
       */
      if (partidoModal.estado === "BORRADOR") {
        await guardarPlazaModal(
          partidoModal,
          "LOCAL",
          borradorLocal,
          plazaPartido(partidoModal.id, "LOCAL"),
        );

        await guardarPlazaModal(
          partidoModal,
          "VISITANTE",
          borradorVisitante,
          plazaPartido(partidoModal.id, "VISITANTE"),
        );
      }

      const fechaHora = fechaHoraISO(
        borradorPartido.fecha,
        borradorPartido.hora,
      );

      const respuesta = await peticion("PATCH", {
        accion: "editar_partido",

        partidoID: partidoModal.id,

        nombre: borradorPartido.nombre.trim(),

        jornada,

        fechaHora,

        duracionEstimadaMin: duracion,

        pistaID: borradorPartido.pistaID || null,

        estado: borradorPartido.estado,

        publicado: borradorPartido.publicado,
      });

      const partido = respuesta.partido as Partido | undefined;

      const avisos = Array.isArray(respuesta.avisos)
        ? (respuesta.avisos as Aviso[])
        : [];

      if (partido) {
        setPartidoModal(partido);

        setBorradorPartido(draftPartido(partido));
      }

      setAvisosModal(avisos);

      setMensajeModal(
        avisos.length > 0
          ? "Partit guardat. Revisa els avisos de programació."
          : "Partit guardat correctament.",
      );

      await cargar(false);
    } catch (err) {
      setErrorModal(
        err instanceof Error ? err.message : "No s'ha pogut guardar el partit.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // ELIMINAR CONSOLACIÓN
  // ========================================================

  async function eliminarConsolacion(partido: Partido) {
    if (
      !window.confirm(`Vols eliminar "${partido.nombre ?? partido.codigo}"?`)
    ) {
      return;
    }

    setGuardando(true);

    setError("");

    try {
      await peticion("DELETE", {
        accion: "eliminar_partido_consolacion",

        partidoID: partido.id,
      });

      cerrarModal();

      await cargar(false);

      setMensaje("Partit eliminat.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut eliminar el partit.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // ELIMINAR ELIMINATORIA
  // ========================================================

  async function eliminarEliminatoria() {
    if (!faseSeleccionada) {
      return;
    }

    if (
      !window.confirm(
        `Vols eliminar l'eliminatòria "${faseSeleccionada.nombre}" completa?`,
      )
    ) {
      return;
    }

    setGuardando(true);

    setError("");

    try {
      await peticion("DELETE", {
        accion: "eliminar_eliminatoria",

        faseID: faseSeleccionada.id,
      });

      setFaseID("");

      await cargar(false);

      setMensaje("Eliminatòria eliminada.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut eliminar l'eliminatòria.",
      );
    } finally {
      setGuardando(false);
    }
  }

  // ========================================================
  // ORÍGENES DISPONIBLES
  // ========================================================

  function partidosOrigenDisponibles(partidoDestino: Partido) {
    if (!datos) {
      return [];
    }

    const faseDestino = datos.fases.find(
      (fase) => fase.id === partidoDestino.fase_id,
    );

    const rondaDestino = datos.rondas.find(
      (ronda) => ronda.id === partidoDestino.ronda_id,
    );

    if (!faseDestino) {
      return [];
    }

    return datos.partidos
      .filter((partido) => {
        if (partido.id === partidoDestino.id) {
          return false;
        }

        const faseOrigen = datos.fases.find(
          (fase) => fase.id === partido.fase_id,
        );

        if (!faseOrigen) {
          return false;
        }

        if (faseOrigen.orden < faseDestino.orden) {
          return true;
        }

        if (faseOrigen.id !== faseDestino.id || !rondaDestino) {
          return false;
        }

        const rondaOrigen = datos.rondas.find(
          (ronda) => ronda.id === partido.ronda_id,
        );

        return (
          Boolean(rondaOrigen) && (rondaOrigen?.orden ?? 0) < rondaDestino.orden
        );
      })
      .sort((a, b) => {
        const rondaA = datos.rondas.find((ronda) => ronda.id === a.ronda_id);

        const rondaB = datos.rondas.find((ronda) => ronda.id === b.ronda_id);

        return (rondaA?.orden ?? 0) - (rondaB?.orden ?? 0) || a.orden - b.orden;
      });
  }

  function gruposOrigenDisponibles(partido: Partido) {
    if (!datos) {
      return [];
    }

    const faseDestino = datos.fases.find((fase) => fase.id === partido.fase_id);

    if (!faseDestino) {
      return [];
    }

    return datos.gruposOrigen.filter(
      (grupo) => grupo.faseOrden < faseDestino.orden,
    );
  }

  function fasesOrigenDisponibles(partido: Partido) {
    if (!datos) {
      return [];
    }

    const faseDestino = datos.fases.find((fase) => fase.id === partido.fase_id);

    if (!faseDestino) {
      return [];
    }

    const mapa = new Map<
      string,
      {
        id: string;
        nombre: string;
        orden: number;
      }
    >();

    for (const grupo of datos.gruposOrigen) {
      if (grupo.faseOrden < faseDestino.orden) {
        mapa.set(grupo.fase_id, {
          id: grupo.fase_id,

          nombre: grupo.faseNombre,

          orden: grupo.faseOrden,
        });
      }
    }

    for (const fase of datos.fases) {
      if (fase.orden < faseDestino.orden) {
        mapa.set(fase.id, {
          id: fase.id,

          nombre: fase.nombre,

          orden: fase.orden,
        });
      }
    }

    return Array.from(mapa.values()).sort((a, b) => a.orden - b.orden);
  }

  // ========================================================
  // LOADING
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="flex min-h-80 items-center justify-center rounded-2xl border border-border/50 bg-card">
        <div className="flex items-center gap-3 text-sm text-neutral">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Carregant eliminatòries...
        </div>
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
        {error || "No s'ha pogut carregar la competició."}
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <>
      <div className="flex flex-col gap-5">
        {error && (
          <div className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
            {error}
          </div>
        )}

        {mensaje && (
          <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-medium text-secondary">
            {mensaje}
          </div>
        )}

        {/* =============================================
            CABECERA
        ============================================= */}

        <section className="rounded-2xl border border-border/50 bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                Eliminatòria
              </p>

              <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                Quadres eliminatoris
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral">
                Genera el bracket complet a partir de la ronda inicial. Les
                rondes següents es connecten automàticament, però totes les
                connexions continuen sent editables.
              </p>
            </div>

            {datos.capacidades.editar && (
              <button
                type="button"
                onClick={() => setMostrarGenerador((valor) => !valor)}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
              >
                + Nova eliminatòria
              </button>
            )}
          </div>

          {/* GENERADOR */}

          {mostrarGenerador && (
            <form
              onSubmit={generarEliminatoria}
              className="mt-4 grid gap-4 rounded-xl border border-border/50 bg-background/40 p-4 md:grid-cols-[1fr_auto]"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-neutral-titulos">
                    Ronda inicial
                  </span>

                  <select
                    value={rondaInicial}
                    disabled={guardando}
                    onChange={(evento) =>
                      setRondaInicial(evento.target.value as TipoRondaPrincipal)
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
                  >
                    {OPCIONES_RONDA.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 self-end rounded-lg border border-border bg-background px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={tercerPuesto}
                    disabled={guardando || rondaInicial === "FINAL"}
                    onChange={(evento) =>
                      setTercerPuesto(evento.target.checked)
                    }
                  />

                  <span className="text-sm font-medium text-neutral-titulos">
                    Crear partit 3r / 4t lloc
                  </span>
                </label>
              </div>

              <button
                disabled={guardando}
                className="self-end rounded-xl bg-secondary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {guardando ? "Generant..." : "Generar bracket"}
              </button>
            </form>
          )}
        </section>

        {/* =============================================
            SIN ELIMINATORIAS
        ============================================= */}

        {datos.fases.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-border p-12 text-center">
            <h3 className="font-bold text-neutral-titulos">
              Encara no hi ha cap eliminatòria
            </h3>

            <p className="mt-2 text-sm text-neutral">
              Crea el primer bracket seleccionant la ronda inicial.
            </p>
          </section>
        ) : (
          <>
            {/* =========================================
                SELECTOR DE CUADRO
            ========================================= */}

            <section className="flex gap-2 overflow-x-auto rounded-2xl border border-border/50 bg-card p-2">
              {datos.fases.map((fase) => (
                <button
                  key={fase.id}
                  type="button"
                  onClick={() => setFaseID(fase.id)}
                  className={
                    fase.id === faseID
                      ? "shrink-0 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                      : "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral hover:bg-background"
                  }
                >
                  {fase.nombre}
                </button>
              ))}
            </section>

            {faseSeleccionada && (
              <>
                {/* =====================================
                    CABECERA FASE
                ===================================== */}

                <section className="rounded-2xl border border-border/50 bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                        Bracket principal
                      </p>

                      <h3 className="mt-1 text-2xl font-bold text-neutral-titulos">
                        {faseSeleccionada.nombre}
                      </h3>

                      <p className="mt-1 text-sm text-neutral">
                        {partidosBracket.length} partits al quadre principal
                      </p>
                    </div>

                    {datos.capacidades.editar && (
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => void eliminarEliminatoria()}
                        className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
                      >
                        Eliminar eliminatòria
                      </button>
                    )}
                  </div>
                </section>

                {/* =====================================
                    BRACKET
                ===================================== */}

                <Bracket
                  rondas={rondasBracket}
                  partidos={partidosBracket}
                  plazas={datos.plazas}
                  pistaPorID={pistaPorID}
                  descripcionPlaza={descripcionPlaza}
                  onPartido={abrirPartido}
                />

                {/* =====================================
                    3r / 4t
                ===================================== */}

                {partidoTercerPuesto && (
                  <section className="rounded-2xl border border-border/50 bg-card p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      Classificació
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-neutral-titulos">
                      3r / 4t lloc
                    </h3>

                    <div className="mt-4 max-w-sm">
                      <TarjetaPartido
                        partido={partidoTercerPuesto}
                        plazaLocal={plazaPartido(
                          partidoTercerPuesto.id,
                          "LOCAL",
                        )}
                        plazaVisitante={plazaPartido(
                          partidoTercerPuesto.id,
                          "VISITANTE",
                        )}
                        pista={pistaPorID(partidoTercerPuesto.pista_id)}
                        descripcionPlaza={descripcionPlaza}
                        onClick={() => abrirPartido(partidoTercerPuesto)}
                      />
                    </div>
                  </section>
                )}

                {/* =====================================
                    CONSOLACIÓN
                ===================================== */}

                <section className="rounded-2xl border border-border/50 bg-card p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      Fora del bracket
                    </p>

                    <h3 className="mt-1 text-lg font-bold text-neutral-titulos">
                      Partits de consolació
                    </h3>

                    <p className="mt-1 max-w-2xl text-sm text-neutral">
                      Aquests partits formen part de l'eliminatòria, però no
                      modifiquen l'arbre principal.
                    </p>

                    {/* El botón queda JUSTO debajo del título */}

                    {datos.capacidades.editar && (
                      <button
                        type="button"
                        onClick={() => setMostrarConsolacion((valor) => !valor)}
                        className="mt-3 rounded-lg border border-primary px-3 py-2 text-sm font-semibold text-primary"
                      >
                        + Afegir partit de consolació
                      </button>
                    )}
                  </div>

                  {mostrarConsolacion && (
                    <form
                      onSubmit={crearConsolacion}
                      className="mt-4 grid gap-3 rounded-xl border border-border/50 bg-background/40 p-4 sm:grid-cols-[1fr_120px_auto]"
                    >
                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold">Nom</span>

                        <input
                          value={nombreConsolacion}
                          disabled={guardando}
                          onChange={(evento) =>
                            setNombreConsolacion(evento.target.value)
                          }
                          placeholder="5è / 6è lloc"
                          className="rounded-lg border border-border bg-background px-3 py-2"
                        />
                      </label>

                      <label className="flex flex-col gap-1">
                        <span className="text-xs font-semibold">Jornada</span>

                        <input
                          type="number"
                          min="1"
                          value={jornadaConsolacion}
                          disabled={guardando}
                          onChange={(evento) =>
                            setJornadaConsolacion(evento.target.value)
                          }
                          className="rounded-lg border border-border bg-background px-3 py-2"
                        />
                      </label>

                      <button
                        disabled={guardando}
                        className="self-end rounded-lg bg-secondary px-4 py-2 font-semibold text-white disabled:opacity-40"
                      >
                        Crear
                      </button>
                    </form>
                  )}

                  {partidosConsolacion.length > 0 ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {partidosConsolacion.map((partido) => (
                        <TarjetaPartido
                          key={partido.id}
                          partido={partido}
                          plazaLocal={plazaPartido(partido.id, "LOCAL")}
                          plazaVisitante={plazaPartido(partido.id, "VISITANTE")}
                          pista={pistaPorID(partido.pista_id)}
                          descripcionPlaza={descripcionPlaza}
                          onClick={() => abrirPartido(partido)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-neutral">
                      No hi ha partits de consolació.
                    </div>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>

      {/* ===================================================
          MODAL CENTRAL
      =================================================== */}

      {partidoModal && borradorPartido && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          onMouseDown={cerrarModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl"
            onMouseDown={(evento) => evento.stopPropagation()}
          >
            {/* HEADER */}

            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border bg-background p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  Configuració del partit
                </p>

                <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
                  {partidoModal.nombre}
                </h2>

                <p className="mt-1 text-xs text-neutral">
                  {partidoModal.codigo}
                </p>
              </div>

              <button
                type="button"
                disabled={guardando}
                onClick={cerrarModal}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-xl text-neutral"
              >
                ×
              </button>
            </div>

            <form onSubmit={guardarPartido} className="flex flex-col gap-6 p-5">
              {errorModal && (
                <div className="rounded-xl border border-error/30 bg-error/5 p-4 text-sm text-error">
                  {errorModal}
                </div>
              )}

              {mensajeModal && (
                <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-medium text-secondary">
                  {mensajeModal}
                </div>
              )}

              {/* AVISOS */}

              {avisosModal.length > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="font-bold text-neutral-titulos">
                    Avisos de programació
                  </p>

                  {avisosModal.map((aviso, indice) => (
                    <div
                      key={`${aviso.tipo}-${aviso.partido.id}-${indice}`}
                      className="rounded-lg bg-background/70 p-3 text-sm"
                    >
                      <p className="font-semibold text-neutral-titulos">
                        {aviso.tipo === "PISTA"
                          ? "Conflicte de pista"
                          : "Conflicte d'equip"}
                      </p>

                      <p className="mt-1 text-neutral">{aviso.mensaje}</p>
                    </div>
                  ))}

                  <p className="text-xs text-neutral">
                    Aquests conflictes són informatius. El partit s'ha guardat
                    igualment.
                  </p>
                </div>
              )}

              {/* =========================================
                    INFORMACIÓN
                ========================================= */}

              <section>
                <h3 className="font-bold text-neutral-titulos">
                  Informació del partit
                </h3>

                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-xs font-semibold">Nom</span>

                    <input
                      value={borradorPartido.nombre}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          nombre: evento.target.value,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold">Jornada</span>

                    <input
                      type="number"
                      min="1"
                      value={borradorPartido.jornada}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          jornada: evento.target.value,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold">Data</span>

                    <input
                      type="date"
                      value={borradorPartido.fecha}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          fecha: evento.target.value,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold">Hora</span>

                    <input
                      type="time"
                      value={borradorPartido.hora}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          hora: evento.target.value,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold">
                      Duració estimada
                    </span>

                    <div className="flex">
                      <input
                        type="number"
                        min="1"
                        value={borradorPartido.duracion}
                        disabled={guardando}
                        onChange={(evento) =>
                          setBorradorPartido({
                            ...borradorPartido,

                            duracion: evento.target.value,
                          })
                        }
                        placeholder="45"
                        className="min-w-0 flex-1 rounded-l-lg border border-border bg-background px-3 py-2.5"
                      />

                      <span className="flex items-center rounded-r-lg border border-l-0 border-border bg-card px-3 text-xs text-neutral">
                        min
                      </span>
                    </div>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold">Pista</span>

                    <select
                      value={borradorPartido.pistaID}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          pistaID: evento.target.value,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      <option value="">Sense pista</option>

                      {datos.pistas
                        .filter(
                          (pista) =>
                            pista.activa ||
                            pista.id === borradorPartido.pistaID,
                        )
                        .map((pista) => (
                          <option key={pista.id} value={pista.id}>
                            {pista.nombre}
                            {!pista.activa ? " · Inactiva" : ""}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold">Estat</span>

                    <select
                      value={borradorPartido.estado}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          estado: evento.target.value as EstadoPartido,
                        })
                      }
                      className="rounded-lg border border-border bg-background px-3 py-2.5"
                    >
                      {OPCIONES_ESTADO.map((opcion) => (
                        <option key={opcion.valor} value={opcion.valor}>
                          {opcion.nombre}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-3 self-end rounded-lg border border-border px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={borradorPartido.publicado}
                      disabled={guardando}
                      onChange={(evento) =>
                        setBorradorPartido({
                          ...borradorPartido,

                          publicado: evento.target.checked,
                        })
                      }
                    />

                    <span className="text-sm font-medium">Partit publicat</span>
                  </label>
                </div>
              </section>

              {/* =========================================
                    PARTICIPANTES
                ========================================= */}

              <section className="border-t border-border pt-5">
                <div>
                  <h3 className="font-bold text-neutral-titulos">
                    Participants
                  </h3>

                  <p className="mt-1 text-xs text-neutral">
                    Les connexions creades automàticament pel bracket són valors
                    per defecte i es poden substituir.
                  </p>
                </div>

                {partidoModal.estado === "BORRADOR" ? (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <EditorOrigen
                      titulo="Local"
                      partido={partidoModal}
                      draft={borradorLocal}
                      equipos={datos.equipos}
                      grupos={gruposOrigenDisponibles(partidoModal)}
                      fases={fasesOrigenDisponibles(partidoModal)}
                      partidos={partidosOrigenDisponibles(partidoModal)}
                      disabled={guardando}
                      onChange={setBorradorLocal}
                    />

                    <EditorOrigen
                      titulo="Visitant"
                      partido={partidoModal}
                      draft={borradorVisitante}
                      equipos={datos.equipos}
                      grupos={gruposOrigenDisponibles(partidoModal)}
                      fases={fasesOrigenDisponibles(partidoModal)}
                      partidos={partidosOrigenDisponibles(partidoModal)}
                      disabled={guardando}
                      onChange={setBorradorVisitante}
                    />
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <ResumenOrigen
                      titulo="Local"
                      texto={descripcionPlaza(
                        plazaPartido(partidoModal.id, "LOCAL"),
                      )}
                    />

                    <ResumenOrigen
                      titulo="Visitant"
                      texto={descripcionPlaza(
                        plazaPartido(partidoModal.id, "VISITANTE"),
                      )}
                    />

                    <p className="col-span-full text-xs text-neutral">
                      Per modificar els participants, torna primer el partit a
                      estat d'esborrany i guarda els canvis.
                    </p>
                  </div>
                )}
              </section>

              {/* =========================================
                    FOOTER
                ========================================= */}

              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap justify-between gap-3 border-t border-border bg-background p-5">
                <div>
                  {partidosConsolacion.some(
                    (partido) => partido.id === partidoModal.id,
                  ) && (
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => void eliminarConsolacion(partidoModal)}
                      className="rounded-lg border border-error/30 px-4 py-2.5 text-sm font-semibold text-error disabled:opacity-40"
                    >
                      Eliminar partit
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={cerrarModal}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold"
                  >
                    Tancar
                  </button>

                  <button
                    disabled={guardando}
                    className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {guardando ? "Guardant..." : "Guardar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// BRACKET
// ============================================================

function Bracket({
  rondas,
  partidos,
  plazas,
  pistaPorID,
  descripcionPlaza,
  onPartido,
}: {
  rondas: Ronda[];

  partidos: Partido[];

  plazas: Plaza[];

  pistaPorID: (id: string | null) => Pista | null;

  descripcionPlaza: (plaza: Plaza | null) => string;

  onPartido: (partido: Partido) => void;
}) {
  const ANCHO = 292;

  const GAP_X = 84;

  const ALTO = 134;

  const SLOT = 174;

  if (rondas.length === 0) {
    return (
      <section className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-neutral">
        Aquesta eliminatòria encara no té rondes.
      </section>
    );
  }

  const partidosPorRonda = new Map<string, Partido[]>();

  for (const ronda of rondas) {
    partidosPorRonda.set(
      ronda.id,
      partidos
        .filter((partido) => partido.ronda_id === ronda.id)
        .sort((a, b) => a.orden - b.orden),
    );
  }

  const primeraRonda = partidosPorRonda.get(rondas[0].id) ?? [];

  const altoBracket = Math.max(primeraRonda.length, 1) * SLOT;

  const anchoBracket =
    rondas.length * ANCHO + Math.max(rondas.length - 1, 0) * GAP_X;

  const posiciones = new Map<
    string,
    {
      x: number;
      y: number;
    }
  >();

  rondas.forEach((ronda, indiceRonda) => {
    const lista = partidosPorRonda.get(ronda.id) ?? [];

    const factor = 2 ** indiceRonda;

    lista.forEach((partido, indice) => {
      const centroY = (indice + 0.5) * factor * SLOT;

      posiciones.set(partido.id, {
        x: indiceRonda * (ANCHO + GAP_X),

        y: centroY - ALTO / 2,
      });
    });
  });

  const conexiones = plazas.filter(
    (plaza) =>
      plaza.partido_id &&
      plaza.origen_partido_id &&
      posiciones.has(plaza.partido_id) &&
      posiciones.has(plaza.origen_partido_id),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
      <div className="border-b border-border/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          Bracket
        </p>

        <p className="mt-1 text-sm text-neutral">
          Prem qualsevol partit per configurar-lo.
        </p>
      </div>

      <div className="overflow-x-auto p-5">
        <div
          className="relative"
          style={{
            width: anchoBracket,

            minWidth: anchoBracket,
          }}
        >
          {/* CABECERAS */}

          <div className="relative mb-4 h-16">
            {rondas.map((ronda, indice) => (
              <div
                key={ronda.id}
                className="absolute top-0"
                style={{
                  width: ANCHO,

                  left: indice * (ANCHO + GAP_X),
                }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
                  Ronda {indice + 1}
                </p>

                <h3 className="mt-1 truncate font-bold text-neutral-titulos">
                  {ronda.nombre}
                </h3>

                <p className="mt-0.5 text-xs text-neutral">
                  {(partidosPorRonda.get(ronda.id) ?? []).length} partits
                </p>
              </div>
            ))}
          </div>

          {/* LIENZO */}

          <div
            className="relative"
            style={{
              width: anchoBracket,

              minWidth: anchoBracket,

              height: altoBracket,

              minHeight: altoBracket,
            }}
          >
            {/* CONEXIONES */}

            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${anchoBracket} ${altoBracket}`}
              preserveAspectRatio="none"
            >
              {conexiones.map((plaza) => {
                const origen = posiciones.get(plaza.origen_partido_id!);

                const destino = posiciones.get(plaza.partido_id!);

                if (!origen || !destino) {
                  return null;
                }

                const x1 = origen.x + ANCHO;

                const y1 = origen.y + ALTO / 2;

                const x2 = destino.x;

                const y2 = destino.y + ALTO / 2;

                const medio = x1 + (x2 - x1) / 2;

                return (
                  <path
                    key={plaza.id}
                    d={
                      `M ${x1} ${y1} ` + `H ${medio} ` + `V ${y2} ` + `H ${x2}`
                    }
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-border"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })}
            </svg>

            {/* PARTIDOS */}

            {partidos.map((partido) => {
              const posicion = posiciones.get(partido.id);

              if (!posicion) {
                return null;
              }

              const local =
                plazas.find(
                  (plaza) =>
                    plaza.partido_id === partido.id && plaza.lado === "LOCAL",
                ) ?? null;

              const visitante =
                plazas.find(
                  (plaza) =>
                    plaza.partido_id === partido.id &&
                    plaza.lado === "VISITANTE",
                ) ?? null;

              return (
                <div
                  key={partido.id}
                  className="absolute z-[2]"
                  style={{
                    left: posicion.x,

                    top: posicion.y,

                    width: ANCHO,

                    height: ALTO,
                  }}
                >
                  <TarjetaPartido
                    partido={partido}
                    plazaLocal={local}
                    plazaVisitante={visitante}
                    pista={pistaPorID(partido.pista_id)}
                    descripcionPlaza={descripcionPlaza}
                    onClick={() => onPartido(partido)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// TARJETA PARTIDO
// ============================================================

function TarjetaPartido({
  partido,
  plazaLocal,
  plazaVisitante,
  pista,
  descripcionPlaza,
  onClick,
}: {
  partido: Partido;

  plazaLocal: Plaza | null;

  plazaVisitante: Plaza | null;

  pista: Pista | null;

  descripcionPlaza: (plaza: Plaza | null) => string;

  onClick: () => void;
}) {
  const fecha = formatoFechaHora(partido.fecha_hora);

  const pistaNombre = pista?.nombre ?? partido.pista ?? null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-background text-left shadow-sm transition hover:border-primary/50 hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
        <p className="min-w-0 truncate text-xs font-bold text-neutral-titulos">
          {partido.nombre ?? partido.codigo}
        </p>

        <span className="shrink-0 rounded-md bg-card px-2 py-1 text-[10px] font-semibold text-neutral">
          {nombreEstado(partido.estado)}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <SlotResumen texto={descripcionPlaza(plazaLocal)} />

        <SlotResumen texto={descripcionPlaza(plazaVisitante)} />
      </div>

      <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2 text-[10px] text-neutral">
        <span className="font-semibold">J{partido.jornada ?? "—"}</span>

        <span>·</span>

        <span className="truncate">{fecha ?? "Sense programar"}</span>

        {pistaNombre && (
          <>
            <span>·</span>

            <span className="truncate">{pistaNombre}</span>
          </>
        )}
      </div>
    </button>
  );
}

// ============================================================
// SLOT RESUMEN
// ============================================================

function SlotResumen({ texto }: { texto: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center border-b border-border/30 px-3">
      <p className="truncate text-xs font-semibold text-neutral-titulos">
        {texto}
      </p>
    </div>
  );
}

// ============================================================
// EDITOR ORIGEN
// ============================================================

function EditorOrigen({
  titulo,
  draft,
  equipos,
  grupos,
  fases,
  partidos,
  disabled,
  onChange,
}: {
  titulo: string;

  partido: Partido;

  draft: DraftPlaza;

  equipos: Equipo[];

  grupos: GrupoOrigen[];

  fases: {
    id: string;
    nombre: string;
    orden: number;
  }[];

  partidos: Partido[];

  disabled: boolean;

  onChange: (draft: DraftPlaza) => void;
}) {
  function cambiarTipo(tipo: "" | TipoOrigen) {
    onChange({
      ...DRAFT_PLAZA_VACIO,

      origenTipo: tipo,
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <p className="font-bold text-neutral-titulos">{titulo}</p>

      <div className="mt-3 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold">Origen</span>

          <select
            value={draft.origenTipo}
            disabled={disabled}
            onChange={(evento) =>
              cambiarTipo(evento.target.value as "" | TipoOrigen)
            }
            className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">Sense configurar</option>

            <option value="EQUIPO">Equip concret</option>

            <option value="POSICION_GRUPO">Posició d'un grup</option>

            <option value="POSICION_FASE">Posició d'una fase</option>

            <option value="GANADOR_PARTIDO">Guanyador d'un partit</option>

            <option value="PERDEDOR_PARTIDO">Perdedor d'un partit</option>

            <option value="LIBRE">Lliure / Bye</option>
          </select>
        </label>

        {draft.origenTipo === "EQUIPO" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold">Equip</span>

            <select
              value={draft.equipoID}
              disabled={disabled}
              onChange={(evento) =>
                onChange({
                  ...draft,

                  equipoID: evento.target.value,
                })
              }
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Selecciona...</option>

              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </select>
          </label>
        )}

        {draft.origenTipo === "POSICION_GRUPO" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Grup</span>

              <select
                value={draft.grupoID}
                disabled={disabled}
                onChange={(evento) =>
                  onChange({
                    ...draft,

                    grupoID: evento.target.value,
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="">Selecciona...</option>

                {grupos.map((grupo) => (
                  <option key={grupo.id} value={grupo.id}>
                    {grupo.faseNombre} · {grupo.nombre}
                  </option>
                ))}
              </select>
            </label>

            <PosicionInput
              value={draft.posicion}
              disabled={disabled}
              onChange={(posicion) =>
                onChange({
                  ...draft,

                  posicion,
                })
              }
            />
          </div>
        )}

        {draft.origenTipo === "POSICION_FASE" && (
          <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold">Fase</span>

              <select
                value={draft.faseOrigenID}
                disabled={disabled}
                onChange={(evento) =>
                  onChange({
                    ...draft,

                    faseOrigenID: evento.target.value,
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              >
                <option value="">Selecciona...</option>

                {fases.map((fase) => (
                  <option key={fase.id} value={fase.id}>
                    {fase.nombre}
                  </option>
                ))}
              </select>
            </label>

            <PosicionInput
              value={draft.posicion}
              disabled={disabled}
              onChange={(posicion) =>
                onChange({
                  ...draft,

                  posicion,
                })
              }
            />
          </div>
        )}

        {(draft.origenTipo === "GANADOR_PARTIDO" ||
          draft.origenTipo === "PERDEDOR_PARTIDO") && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold">Partit d'origen</span>

            <select
              value={draft.partidoOrigenID}
              disabled={disabled}
              onChange={(evento) =>
                onChange({
                  ...draft,

                  partidoOrigenID: evento.target.value,
                })
              }
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
            >
              <option value="">Selecciona...</option>

              {partidos.map((partido) => (
                <option key={partido.id} value={partido.id}>
                  {partido.nombre ?? partido.codigo}
                </option>
              ))}
            </select>
          </label>
        )}

        {draft.origenTipo === "LIBRE" && (
          <div className="rounded-lg border border-dashed border-border p-3 text-xs text-neutral">
            Aquesta plaça quedarà lliure.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// POSICIÓN
// ============================================================

function PosicionInput({
  value,
  disabled,
  onChange,
}: {
  value: string;

  disabled: boolean;

  onChange: (valor: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold">Posició</span>

      <input
        type="number"
        min="1"
        value={value}
        disabled={disabled}
        onChange={(evento) => onChange(evento.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
      />
    </label>
  );
}

// ============================================================
// RESUMEN ORIGEN
// ============================================================

function ResumenOrigen({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
        {titulo}
      </p>

      <p className="mt-2 font-semibold text-neutral-titulos">{texto}</p>
    </div>
  );
}
