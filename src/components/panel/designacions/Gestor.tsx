import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@supabase/supabase-js";

import PorPartidos from "./PorPartidos";
import PorPersonas from "./PorPersonas";

// ============================================================
// TIPOS COMPARTIDOS
// ============================================================

export type Funcion = "ARBITRE" | "OFICIAL_TAULA";

export type Modo = "partits" | "persones";

export type OrdenPartidos = "competicion" | "fecha" | "pista";

export type FiltroDesignados = "TODOS" | "DESIGNADOS" | "PENDIENTES";

export type TipoPersona = "TODOS" | "VOLUNTARI" | "ADMINISTRADOR";

export type Persona = {
  id: string;
  nombre: string | null;
  apellido1: string | null;
  apellido2: string | null;
  email: string | null;
  tipoAcceso?: "VOLUNTARI" | "ADMINISTRADOR";
};

export type Designacion = {
  id: string;
  partido_id: string;
  usuario_id: string;
  funcion: Funcion;
  revocada_at?: string | null;
  motivo_revocacion?: string | null;
  usuario: Persona | null;
};

export type Ronda = {
  id: string;
  fase_id?: string;
  nombre: string;
  tipo?: string;
  orden: number;
};

export type Fase = {
  id: string;
  nombre: string;
  tipo: string;
  orden: number;
  rondas: Ronda[];
};

export type Partido = {
  id: string;
  codigo: string;
  nombre: string | null;
  fecha_hora: string | null;
  pista: string | null;
  estado: string;
  orden?: number;

  fase: Fase | null;
  ronda: Ronda | null;

  grupo: {
    id: string;
    nombre: string;
    orden?: number;
  } | null;

  designaciones: Designacion[];

  totales: {
    arbitres: number;
    oficialsTaula: number;
  };
};

export type Permisos = {
  ver: boolean;
  asignar: boolean;
  revocar: boolean;
  revocacionDisponible: boolean;
};

export type Filtros = {
  buscarPartido: string;
  faseID: string;
  rondaID: string;
  estado: string;
  orden: OrdenPartidos;
  designados: FiltroDesignados;
  buscarPersona: string;
  tipoPersona: TipoPersona;
};

// ============================================================
// CONTRATO COMPARTIDO CON LAS DOS VISTAS
// ============================================================

export type PropsVista = {
  partidos: Partido[];
  personas: Persona[];
  fases: Fase[];
  rondas: Ronda[];

  permisos: Permisos;
  filtros: Filtros;

  seleccionadoPartidoID: string;
  seleccionadoPersonaID: string;

  designacionesSeleccionadas: Designacion[];

  detalleCargando: boolean;
  guardando: boolean;
  cargandoPersonas: boolean;
  errorDetalle: string;

  historial: boolean;

  onHistorial: (valor: boolean) => void;

  onSeleccionarPartido: (id: string) => void;
  onSeleccionarPersona: (id: string) => void;

  onFiltro: <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => void;

  onLimpiarFiltros: () => void;

  onAlternar: (partidoID: string, personaID: string, funcion: Funcion) => void;

  onRevocar: (designacion: Designacion) => void;

  estaAsignado: (
    partidoID: string,
    personaID: string,
    funcion: Funcion,
  ) => boolean;
};

// ============================================================
// PROPIEDADES DEL GESTOR
// ============================================================

type Props = {
  torneoID: string;
  edicionID: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type RespuestaLista = {
  success: true;
  partidos: Partido[];
  fases: Fase[];
  total: number;
  totalPaginas: number;
  permisos: Permisos;
};

type RespuestaPersonas = {
  success: true;
  candidatos: Persona[];
};

type RespuestaDetalle = {
  success: true;
  designaciones: Designacion[];
};

type RespuestaAccion = {
  success: true;
  mensaje: string;
};

type PeticionRevocacion = {
  designacion: Designacion;
  partidoID: string;
};

// ============================================================
// ESTILOS
// ============================================================

const CAMPO =
  "w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

const BOTON =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-neutral-titulos transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50";

// ============================================================
// UTILIDADES
// ============================================================

export function nombrePersona(persona: Persona | null | undefined): string {
  if (!persona) {
    return "Usuari no disponible";
  }

  return (
    [persona.nombre, persona.apellido1, persona.apellido2]
      .filter(Boolean)
      .join(" ")
      .trim() || "Sense nom"
  );
}

export function formatoPartido(partido: Partido): string {
  return partido.nombre?.trim() || `Partit ${partido.codigo}`;
}

export function formatearFecha(valor: string | null): string {
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

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function mensajeError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "S'ha produït un error inesperat.";
}

async function leerRespuesta<T>(respuesta: Response): Promise<T> {
  const contenido: unknown = await respuesta.json().catch(() => null);

  if (!contenido || typeof contenido !== "object" || Array.isArray(contenido)) {
    throw new Error("El servidor no ha retornat una resposta vàlida.");
  }

  const registro = contenido as Record<string, unknown>;

  if (!respuesta.ok || registro.success !== true) {
    throw new Error(
      typeof registro.mensaje === "string"
        ? registro.mensaje
        : `No s'ha pogut completar l'operació (${respuesta.status}).`,
    );
  }

  return contenido as T;
}

const FILTROS_INICIALES: Filtros = {
  buscarPartido: "",
  faseID: "",
  rondaID: "",
  estado: "",
  orden: "competicion",
  designados: "TODOS",
  buscarPersona: "",
  tipoPersona: "TODOS",
};

// ============================================================
// GESTOR PRINCIPAL
// ============================================================

export default function Gestor({
  torneoID,
  edicionID,
  supabaseUrl = "",
  supabaseAnonKey = "",
}: Props) {
  // ==========================================================
  // ESTADO GENERAL
  // ==========================================================

  const [modo, setModo] = useState<Modo>("partits");

  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);

  const [partidos, setPartidos] = useState<Partido[]>([]);

  const [fases, setFases] = useState<Fase[]>([]);

  const [personas, setPersonas] = useState<Persona[]>([]);

  const [permisos, setPermisos] = useState<Permisos>({
    ver: false,
    asignar: false,
    revocar: false,
    revocacionDisponible: false,
  });

  const [seleccionadoPartidoID, setSeleccionadoPartidoID] = useState("");

  const [seleccionadoPersonaID, setSeleccionadoPersonaID] = useState("");

  // ==========================================================
  // DETALLE DE DESIGNACIONES
  // ==========================================================

  const [detalle, setDetalle] = useState<Designacion[]>([]);

  const [detalleID, setDetalleID] = useState("");

  const [historial, setHistorial] = useState(false);

  // ==========================================================
  // CARGA Y ERRORES
  // ==========================================================

  const [cargandoPartidos, setCargandoPartidos] = useState(true);

  const [cargandoPersonas, setCargandoPersonas] = useState(false);

  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const [errorPartidos, setErrorPartidos] = useState("");

  const [errorPersonas, setErrorPersonas] = useState("");

  const [errorDetalle, setErrorDetalle] = useState("");

  const [aviso, setAviso] = useState<{
    tipo: "error" | "exito";
    mensaje: string;
  } | null>(null);

  const [operacion, setOperacion] = useState<string | null>(null);

  // ==========================================================
  // REVOCACIÓN
  // ==========================================================

  const [revocacion, setRevocacion] = useState<PeticionRevocacion | null>(null);

  const [motivo, setMotivo] = useState("Canvi de designació");

  // ==========================================================
  // ACTUALIZACIONES
  // ==========================================================

  const [version, setVersion] = useState(0);

  const [versionPersonas, setVersionPersonas] = useState(0);

  const [realtimeConectado, setRealtimeConectado] = useState(false);

  const parametrosBase = useMemo(
    () =>
      new URLSearchParams({
        torneoID,
        edicionID,
      }),
    [torneoID, edicionID],
  );

  const refrescar = useCallback(() => {
    setVersion((valor) => valor + 1);
  }, []);

  const refrescarTodo = useCallback(() => {
    refrescar();

    setVersionPersonas((valor) => valor + 1);
  }, [refrescar]);

  // ==========================================================
  // CARGAR TODOS LOS PARTIDOS DE LA EDICIÓN
  // ==========================================================

  useEffect(() => {
    const abortar = new AbortController();

    const obtenerPagina = async (pagina: number): Promise<RespuestaLista> => {
      const query = new URLSearchParams(parametrosBase);

      query.set("pagina", String(pagina));
      query.set("porPagina", "100");
      query.set("orden", "competicion");

      const respuesta = await fetch(`/api/panell/designacions?${query}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: abortar.signal,
      });

      return leerRespuesta<RespuestaLista>(respuesta);
    };

    async function cargar() {
      setCargandoPartidos(true);
      setErrorPartidos("");

      try {
        const primera = await obtenerPagina(1);

        if (!Array.isArray(primera.partidos) || !Array.isArray(primera.fases)) {
          throw new Error(
            "L'API no retorna les fases i els partits. Actualitza-la.",
          );
        }

        const paginas = Math.max(1, primera.totalPaginas ?? 1);

        if (paginas > 100) {
          throw new Error(
            "L'edició supera el límit de 10.000 partits del gestor.",
          );
        }

        const todos = [...primera.partidos];

        // Cargar páginas en bloques de cinco.
        for (let inicio = 2; inicio <= paginas; inicio += 5) {
          const indices = Array.from(
            {
              length: Math.min(5, paginas - inicio + 1),
            },
            (_, i) => inicio + i,
          );

          const bloques = await Promise.all(indices.map(obtenerPagina));

          for (const bloque of bloques) {
            todos.push(...bloque.partidos);
          }
        }

        if (abortar.signal.aborted) {
          return;
        }

        setPartidos(todos);
        setFases(primera.fases);
        setPermisos(primera.permisos);
      } catch (error) {
        if (abortar.signal.aborted) {
          return;
        }

        setErrorPartidos(mensajeError(error));
      } finally {
        if (!abortar.signal.aborted) {
          setCargandoPartidos(false);
        }
      }
    }

    void cargar();

    return () => abortar.abort();
  }, [parametrosBase, version]);

  // ==========================================================
  // CARGAR PERSONAS DISPONIBLES
  // ==========================================================

  useEffect(() => {
    if (!permisos.asignar) {
      setPersonas([]);
      return;
    }

    const abortar = new AbortController();

    async function cargar() {
      setCargandoPersonas(true);
      setErrorPersonas("");

      try {
        const query = new URLSearchParams(parametrosBase);

        query.set("candidatos", "true");

        const respuesta = await fetch(`/api/panell/designacions?${query}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: abortar.signal,
        });

        const datos = await leerRespuesta<RespuestaPersonas>(respuesta);

        if (!Array.isArray(datos.candidatos)) {
          throw new Error("L'API no retorna els candidats.");
        }

        if (!abortar.signal.aborted) {
          setPersonas(datos.candidatos);
        }
      } catch (error) {
        if (!abortar.signal.aborted) {
          setErrorPersonas(mensajeError(error));
        }
      } finally {
        if (!abortar.signal.aborted) {
          setCargandoPersonas(false);
        }
      }
    }

    void cargar();

    return () => abortar.abort();
  }, [parametrosBase, permisos.asignar, versionPersonas]);

  // ==========================================================
  // FILTROS DE FASE Y RONDA
  // ==========================================================

  const rondas = useMemo(
    () => fases.find((fase) => fase.id === filtros.faseID)?.rondas ?? [],
    [fases, filtros.faseID],
  );

  // ==========================================================
  // FILTRAR Y ORDENAR PARTIDOS
  // ==========================================================

  const partidosVisibles = useMemo(() => {
    const buscar = normalizar(filtros.buscarPartido);

    const resultado = partidos.filter((partido) => {
      if (filtros.faseID && partido.fase?.id !== filtros.faseID) {
        return false;
      }

      if (filtros.rondaID && partido.ronda?.id !== filtros.rondaID) {
        return false;
      }

      if (filtros.estado && partido.estado !== filtros.estado) {
        return false;
      }

      if (
        buscar &&
        !normalizar(
          [
            partido.codigo,
            partido.nombre,
            partido.pista,
            partido.fase?.nombre,
            partido.ronda?.nombre,
            partido.grupo?.nombre,
          ]
            .filter(Boolean)
            .join(" "),
        ).includes(buscar)
      ) {
        return false;
      }

      // Filtro por designaciones.
      if (filtros.designados !== "TODOS") {
        const designado =
          modo === "partits"
            ? partido.designaciones.some((d) => !d.revocada_at)
            : Boolean(seleccionadoPersonaID) &&
              partido.designaciones.some(
                (d) => d.usuario_id === seleccionadoPersonaID && !d.revocada_at,
              );

        if (filtros.designados === "DESIGNADOS" && !designado) {
          return false;
        }

        if (filtros.designados === "PENDIENTES" && designado) {
          return false;
        }
      }

      return true;
    });

    // El orden de competición viene de la API.
    // Solo reordenamos si se elige otro criterio.

    if (filtros.orden === "fecha") {
      resultado.sort(
        (a, b) =>
          (a.fecha_hora ?? "9999").localeCompare(b.fecha_hora ?? "9999") ||
          a.codigo.localeCompare(b.codigo),
      );
    } else if (filtros.orden === "pista") {
      resultado.sort(
        (a, b) =>
          (a.pista ?? "zzzz").localeCompare(b.pista ?? "zzzz", "ca") ||
          (a.fecha_hora ?? "9999").localeCompare(b.fecha_hora ?? "9999"),
      );
    }

    return resultado;
  }, [partidos, filtros, modo, seleccionadoPersonaID]);

  // ==========================================================
  // FILTRAR PERSONAS
  // ==========================================================

  const personasVisibles = useMemo(() => {
    const buscar = normalizar(filtros.buscarPersona);

    return personas.filter((persona) => {
      if (
        filtros.tipoPersona !== "TODOS" &&
        persona.tipoAcceso !== filtros.tipoPersona
      ) {
        return false;
      }

      if (!buscar) {
        return true;
      }

      return normalizar(
        `${nombrePersona(persona)} ${persona.email ?? ""}`,
      ).includes(buscar);
    });
  }, [personas, filtros.buscarPersona, filtros.tipoPersona]);

  // ==========================================================
  // SELECCIÓN AUTOMÁTICA DE PARTIDOS
  // ==========================================================

  useEffect(() => {
    if (
      partidosVisibles.length > 0 &&
      !partidosVisibles.some((partido) => partido.id === seleccionadoPartidoID)
    ) {
      setSeleccionadoPartidoID(partidosVisibles[0].id);
    } else if (partidosVisibles.length === 0 && seleccionadoPartidoID) {
      setSeleccionadoPartidoID("");
    }
  }, [partidosVisibles, seleccionadoPartidoID]);

  // ==========================================================
  // SELECCIÓN AUTOMÁTICA DE PERSONAS
  // ==========================================================

  useEffect(() => {
    if (
      personasVisibles.length > 0 &&
      !personasVisibles.some((persona) => persona.id === seleccionadoPersonaID)
    ) {
      setSeleccionadoPersonaID(personasVisibles[0].id);
    } else if (personasVisibles.length === 0 && seleccionadoPersonaID) {
      setSeleccionadoPersonaID("");
    }
  }, [personasVisibles, seleccionadoPersonaID]);

  // ==========================================================
  // DETALLE DEL PARTIDO SELECCIONADO
  // ==========================================================

  useEffect(() => {
    if (modo !== "partits" || !seleccionadoPartidoID) {
      setDetalleID("");
      setDetalle([]);
      return;
    }

    const abortar = new AbortController();

    async function cargar() {
      setCargandoDetalle(true);
      setErrorDetalle("");
      setDetalleID("");

      try {
        const query = new URLSearchParams(parametrosBase);

        query.set("partidoID", seleccionadoPartidoID);

        query.set("incluirRevocadas", String(historial));

        const respuesta = await fetch(`/api/panell/designacions?${query}`, {
          credentials: "same-origin",
          cache: "no-store",
          signal: abortar.signal,
        });

        const datos = await leerRespuesta<RespuestaDetalle>(respuesta);

        if (!Array.isArray(datos.designaciones)) {
          throw new Error("El detall de designacions no és vàlid.");
        }

        if (abortar.signal.aborted) {
          return;
        }

        setDetalle(datos.designaciones);
        setDetalleID(seleccionadoPartidoID);
      } catch (error) {
        if (!abortar.signal.aborted) {
          setErrorDetalle(mensajeError(error));
        }
      } finally {
        if (!abortar.signal.aborted) {
          setCargandoDetalle(false);
        }
      }
    }

    void cargar();

    return () => abortar.abort();
  }, [parametrosBase, seleccionadoPartidoID, historial, modo, version]);

  // ==========================================================
  // REALTIME DEL PARTIDO SELECCIONADO
  // ==========================================================

  useEffect(() => {
    if (
      modo !== "partits" ||
      !seleccionadoPartidoID ||
      !supabaseUrl ||
      !supabaseAnonKey
    ) {
      setRealtimeConectado(false);
      return;
    }

    let activo = true;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const channel = client
      .channel(`designacions-partit-${seleccionadoPartidoID}`)
      .on(
        "broadcast",
        {
          event: "actualitzada",
        },
        () => {
          if (activo) {
            refrescar();
          }
        },
      )
      .subscribe((estado) => {
        if (!activo) {
          return;
        }

        setRealtimeConectado(estado === "SUBSCRIBED");

        if (estado === "SUBSCRIBED") {
          refrescar();
        }
      });

    return () => {
      activo = false;
      void client.removeChannel(channel);
    };
  }, [modo, seleccionadoPartidoID, supabaseUrl, supabaseAnonKey, refrescar]);

  // ==========================================================
  // RECARGA AL REGRESAR A LA PESTAÑA
  // ==========================================================

  useEffect(() => {
    const recargarAlVolver = () => {
      if (document.visibilityState === "visible") {
        refrescar();
      }
    };

    document.addEventListener("visibilitychange", recargarAlVolver);

    return () =>
      document.removeEventListener("visibilitychange", recargarAlVolver);
  }, [refrescar]);

  // ==========================================================
  // DESIGNACIONES DEL PARTIDO ACTUAL
  // ==========================================================

  const designacionesSeleccionadas = useMemo(() => {
    if (modo === "partits" && detalleID === seleccionadoPartidoID) {
      return detalle;
    }

    return (
      partidos.find((partido) => partido.id === seleccionadoPartidoID)
        ?.designaciones ?? []
    );
  }, [modo, detalleID, seleccionadoPartidoID, detalle, partidos]);

  // ==========================================================
  // BUSCAR UNA DESIGNACIÓN ACTIVA
  // ==========================================================

  const buscarAsignacion = useCallback(
    (
      partidoID: string,
      personaID: string,
      funcion: Funcion,
    ): Designacion | undefined => {
      const partido = partidos.find((p) => p.id === partidoID);

      const fuentes =
        modo === "partits" && detalleID === partidoID
          ? detalle
          : (partido?.designaciones ?? []);

      return fuentes.find(
        (designacion) =>
          designacion.usuario_id === personaID &&
          designacion.funcion === funcion &&
          !designacion.revocada_at,
      );
    },
    [partidos, modo, detalleID, detalle],
  );

  const estaAsignado = useCallback(
    (partidoID: string, personaID: string, funcion: Funcion) =>
      Boolean(buscarAsignacion(partidoID, personaID, funcion)),
    [buscarAsignacion],
  );

  // ==========================================================
  // ALTERNAR ASIGNACIÓN
  // ==========================================================

  const onAlternar = useCallback(
    async (pid: string, uid: string, funcion: Funcion) => {
      if (operacion) {
        return;
      }

      const actual = buscarAsignacion(pid, uid, funcion);

      // Si existe, solicitar revocación.
      if (actual) {
        if (!permisos.revocar) {
          setAviso({
            tipo: "error",
            mensaje: "No tens permís per llevar aquesta designació.",
          });
          return;
        }

        setMotivo("Canvi de designació");

        setRevocacion({
          designacion: actual,
          partidoID: pid,
        });

        return;
      }

      // Si no existe, crearla.
      if (!permisos.asignar) {
        setAviso({
          tipo: "error",
          mensaje: "No tens permís per crear designacions.",
        });
        return;
      }

      setOperacion(`${pid}|${uid}|${funcion}`);

      setAviso(null);

      try {
        const query = new URLSearchParams(parametrosBase);

        query.set("partidoID", pid);

        const respuesta = await fetch(`/api/panell/designacions?${query}`, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            usuarioID: uid,
            funcion,
          }),
        });

        const datos = await leerRespuesta<RespuestaAccion>(respuesta);

        setAviso({
          tipo: "exito",
          mensaje: datos.mensaje,
        });

        refrescar();
      } catch (error) {
        setAviso({
          tipo: "error",
          mensaje: mensajeError(error),
        });
      } finally {
        setOperacion(null);
      }
    },
    [
      operacion,
      buscarAsignacion,
      permisos.asignar,
      permisos.revocar,
      parametrosBase,
      refrescar,
    ],
  );

  // ==========================================================
  // SOLICITAR REVOCACIÓN
  // ==========================================================

  const onRevocar = useCallback(
    (designacion: Designacion) => {
      if (!permisos.revocar) {
        setAviso({
          tipo: "error",
          mensaje: "No tens permís per llevar aquesta designació.",
        });
        return;
      }

      setMotivo("Canvi de designació");

      setRevocacion({
        designacion,
        partidoID: designacion.partido_id,
      });
    },
    [permisos.revocar],
  );

  // ==========================================================
  // CONFIRMAR REVOCACIÓN
  // ==========================================================

  const confirmarRevocacion = async () => {
    if (!revocacion || operacion || !motivo.trim()) {
      return;
    }

    const { designacion, partidoID } = revocacion;

    setOperacion(designacion.id);
    setAviso(null);

    try {
      const query = new URLSearchParams(parametrosBase);

      query.set("partidoID", partidoID);

      const respuesta = await fetch(
        `/api/panell/designacions/revocar?${query}`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            designacionID: designacion.id,
            motivo: motivo.trim(),
          }),
        },
      );

      const datos = await leerRespuesta<RespuestaAccion>(respuesta);

      setAviso({
        tipo: "exito",
        mensaje: datos.mensaje,
      });

      setRevocacion(null);
      refrescar();
    } catch (error) {
      setAviso({
        tipo: "error",
        mensaje: mensajeError(error),
      });
    } finally {
      setOperacion(null);
    }
  };

  // ==========================================================
  // CONTROL DE FILTROS
  // ==========================================================

  const onFiltro = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => {
    setFiltros((prev) => ({
      ...prev,
      [campo]: valor,
      ...(campo === "faseID" ? { rondaID: "" } : {}),
    }));
  };

  const onLimpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES);
  };

  const onModo = (nuevo: Modo) => {
    setModo(nuevo);

    setFiltros((prev) => ({
      ...prev,
      designados: "TODOS",
    }));

    setAviso(null);
  };

  // ==========================================================
  // RESUMEN
  // ==========================================================

  const resumen = useMemo(
    () => ({
      total: partidos.length,

      designaciones: partidos.reduce(
        (n, partido) =>
          n + partido.designaciones.filter((d) => !d.revocada_at).length,
        0,
      ),

      pendientes: partidos.filter(
        (partido) => !partido.designaciones.some((d) => !d.revocada_at),
      ).length,
    }),
    [partidos],
  );

  // ==========================================================
  // PROPIEDADES PARA LAS DOS VISTAS
  // ==========================================================

  const propsVista: PropsVista = {
    partidos: partidosVisibles,
    personas: personasVisibles,
    fases,
    rondas,

    permisos,
    filtros,

    seleccionadoPartidoID,
    seleccionadoPersonaID,

    designacionesSeleccionadas,

    detalleCargando:
      cargandoDetalle ||
      (modo === "partits" && detalleID !== seleccionadoPartidoID),

    guardando: Boolean(operacion),
    cargandoPersonas,
    errorDetalle,
    historial,

    onHistorial: setHistorial,

    onSeleccionarPartido: setSeleccionadoPartidoID,

    onSeleccionarPersona: setSeleccionadoPersonaID,

    onFiltro,
    onLimpiarFiltros,

    onAlternar: (pid, uid, funcion) => {
      void onAlternar(pid, uid, funcion);
    },

    onRevocar,
    estaAsignado,
  };

  // ==========================================================
  // INTERFAZ
  // ==========================================================

  return (
    <main className="mx-auto w-full max-w-[1740px] space-y-5 px-3 pb-10 sm:px-5">
      {/* CABECERA */}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">
            Gestió de competició
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-titulos">
            Designacions
          </h1>

          <p className="mt-2 text-sm text-neutral">
            Gestiona àrbitres i oficials de taula per partit o per persona.
          </p>
        </div>

        <button
          type="button"
          className={BOTON}
          onClick={refrescarTodo}
          disabled={cargandoPartidos}
        >
          <span aria-hidden="true">↻</span>
          Actualitzar
        </button>
      </header>

      {/* SELECTOR DEL MODO */}

      <nav
        aria-label="Modalitat de designació"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2"
      >
        <button
          type="button"
          aria-pressed={modo === "partits"}
          onClick={() => onModo("partits")}
          className={`rounded-xl px-3 py-3 text-left transition ${
            modo === "partits"
              ? "bg-primary text-white"
              : "bg-background text-neutral-titulos hover:bg-primary/5"
          }`}
        >
          <span className="block text-sm font-bold">Per partits</span>

          <span
            className={`mt-1 block text-xs ${
              modo === "partits" ? "text-white/80" : "text-neutral"
            }`}
          >
            Tria un partit i gestiona el personal
          </span>
        </button>

        <button
          type="button"
          aria-pressed={modo === "persones"}
          onClick={() => onModo("persones")}
          className={`rounded-xl px-3 py-3 text-left transition ${
            modo === "persones"
              ? "bg-primary text-white"
              : "bg-background text-neutral-titulos hover:bg-primary/5"
          }`}
        >
          <span className="block text-sm font-bold">Per persones</span>

          <span
            className={`mt-1 block text-xs ${
              modo === "persones" ? "text-white/80" : "text-neutral"
            }`}
          >
            Tria una persona i marca funcions per partit
          </span>
        </button>
      </nav>

      {/* RESUMEN */}

      <section
        className="grid grid-cols-3 gap-2 sm:gap-3"
        aria-label="Resum de designacions"
      >
        {[
          ["Partits", resumen.total],
          ["Designacions", resumen.designaciones],
          ["Sense designar", resumen.pendientes],
        ].map(([titulo, valor]) => (
          <div
            key={titulo}
            className="rounded-xl border border-border bg-card p-3 sm:p-4"
          >
            <p className="text-xs text-neutral">{titulo}</p>

            <p className="mt-1 text-xl font-bold tabular-nums text-neutral-titulos sm:text-2xl">
              {valor}
            </p>
          </div>
        ))}
      </section>

      {/* FILTROS COMPARTIDOS */}

      <section
        className="rounded-2xl border border-border bg-card p-3 sm:p-4"
        aria-label="Filtres de designacions"
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-neutral-titulos">
            Filtres de partits
          </h2>

          <button
            type="button"
            onClick={onLimpiarFiltros}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Netejar filtres
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* BUSCAR PARTIDO */}

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral">Cercar</span>

            <input
              type="search"
              className={CAMPO}
              value={filtros.buscarPartido}
              onChange={(e) => onFiltro("buscarPartido", e.target.value)}
              placeholder="Partit, fase o pista..."
            />
          </label>

          {/* FASE */}

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral">Fase</span>

            <select
              className={CAMPO}
              value={filtros.faseID}
              onChange={(e) => onFiltro("faseID", e.target.value)}
            >
              <option value="">Totes les fases</option>

              {fases.map((fase) => (
                <option key={fase.id} value={fase.id}>
                  {fase.nombre}
                </option>
              ))}
            </select>
          </label>

          {/* RONDA */}

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral">Ronda</span>

            <select
              className={CAMPO}
              value={filtros.rondaID}
              disabled={!filtros.faseID}
              onChange={(e) => onFiltro("rondaID", e.target.value)}
            >
              <option value="">Totes les rondes</option>

              {rondas.map((ronda) => (
                <option key={ronda.id} value={ronda.id}>
                  {ronda.nombre}
                </option>
              ))}
            </select>
          </label>

          {/* ESTADO */}

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral">Estat</span>

            <select
              className={CAMPO}
              value={filtros.estado}
              onChange={(e) => onFiltro("estado", e.target.value)}
            >
              <option value="">Tots els estats</option>
              <option value="BORRADOR">Esborrany</option>
              <option value="PROGRAMADO">Programat</option>
              <option value="EN_CURSO">En curs</option>
              <option value="FINALIZADO">Finalitzat</option>
              <option value="SUSPENDIDO">Suspès</option>
              <option value="CANCELADO">Cancel·lat</option>
            </select>
          </label>

          {/* ORDEN */}

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral">Ordre</span>

            <select
              className={CAMPO}
              value={filtros.orden}
              onChange={(e) =>
                onFiltro("orden", e.target.value as OrdenPartidos)
              }
            >
              <option value="competicion">Ordre de competició</option>

              <option value="fecha">Data i hora</option>

              <option value="pista">Pista</option>
            </select>
          </label>

          {/* FILTRO POR PARTIDOS DESIGNADOS */}

          <div className="space-y-1 sm:col-span-2 lg:col-span-3">
            <span className="text-xs font-medium text-neutral">
              Partits designats
            </span>

            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["TODOS", "Tots"],
                  [
                    "DESIGNADOS",
                    modo === "partits" ? "Amb designacions" : "Ja designats",
                  ],
                  [
                    "PENDIENTES",
                    modo === "partits" ? "Sense designar" : "Pendents",
                  ],
                ] as const
              ).map(([valor, titulo]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={filtros.designados === valor}
                  onClick={() => onFiltro("designados", valor)}
                  className={`min-h-10 rounded-lg border px-2 py-2 text-xs font-semibold transition ${
                    filtros.designados === valor
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-neutral-titulos hover:border-primary/40"
                  }`}
                >
                  {titulo}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-neutral">
          {modo === "persones"
            ? "El filtre de designats s'aplica a la persona seleccionada. Cada partit ofereix les dues funcions per separat."
            : "El filtre de designats mostra partits amb alguna assignació o sense cap assignació."}
        </p>
      </section>

      {/* ERRORES */}

      {errorPartidos && (
        <div
          role="alert"
          className="rounded-xl border border-red-300/40 bg-red-500/5 p-4 text-sm text-red-700"
        >
          {errorPartidos}
        </div>
      )}

      {errorPersonas && (
        <div
          role="alert"
          className="rounded-xl border border-red-300/40 bg-red-500/5 p-4 text-sm text-red-700"
        >
          {errorPersonas}
        </div>
      )}

      {/* RESULTADO DE OPERACIONES */}

      {aviso && (
        <div
          role={aviso.tipo === "error" ? "alert" : "status"}
          className={`rounded-xl border p-4 text-sm ${
            aviso.tipo === "error"
              ? "border-red-300/40 bg-red-500/5 text-red-700"
              : "border-emerald-300/40 bg-emerald-500/5 text-emerald-700"
          }`}
        >
          {aviso.mensaje}
        </div>
      )}

      {/* CARGA */}

      {cargandoPartidos && (
        <div
          role="status"
          className="rounded-xl border border-border bg-card p-4 text-sm text-neutral"
        >
          Carregant partits i designacions...
        </div>
      )}

      {/* VISTA SELECCIONADA */}

      {modo === "partits" ? (
        <PorPartidos {...propsVista} />
      ) : (
        <PorPersonas {...propsVista} />
      )}

      {/* REALTIME */}

      {modo === "partits" && supabaseUrl && supabaseAnonKey && (
        <p className="text-xs text-neutral">
          {realtimeConectado
            ? "Sincronització del partit seleccionat activa"
            : "La sincronització Realtime no està connectada. Pots actualitzar manualment."}
        </p>
      )}

      {/* CONFIRMACIÓN DE REVOCACIÓN */}

      {revocacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmar-revocacio"
            className="w-full max-w-lg space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl"
          >
            <div>
              <h2
                id="confirmar-revocacio"
                className="text-lg font-bold text-neutral-titulos"
              >
                Llevar designació
              </h2>

              <p className="mt-2 text-sm text-neutral">
                Vols revocar la funció de{" "}
                {nombrePersona(
                  revocacion.designacion.usuario ??
                    personas.find(
                      (p) => p.id === revocacion.designacion.usuario_id,
                    ),
                )}
                ? L'assignació quedarà a l'historial.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-semibold text-neutral">
                Motiu de la revocació
              </span>

              <textarea
                className={CAMPO}
                rows={3}
                maxLength={1000}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>

            <p className="text-xs text-neutral">
              Si aquesta persona està controlant l'acta, el servidor ha de
              rebutjar la revocació.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={BOTON}
                disabled={Boolean(operacion)}
                onClick={() => setRevocacion(null)}
              >
                Cancel·lar
              </button>

              <button
                type="button"
                className="inline-flex min-h-10 items-center rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                disabled={!motivo.trim() || Boolean(operacion)}
                onClick={() => void confirmarRevocacion()}
              >
                {operacion ? "Llevant..." : "Confirmar revocació"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
