import Cargando from "@components/Cargando";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormEvent } from "react";

// ============================================================
// TIPOS
// ============================================================

type TipoFase = "GRUPOS" | "ELIMINATORIA";

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

type LadoPartido = "LOCAL" | "VISITANTE";

type TipoOrigen =
  | "EQUIPO"
  | "POSICION_GRUPO"
  | "GANADOR_PARTIDO"
  | "PERDEDOR_PARTIDO"
  | "LIBRE";

type Grupo = {
  id: string;
  fase_id: string;
  nombre: string;
  orden: number;
  estado: string;
  version_clasificacion: number;
  cerrada_at: string | null;
};

type Ronda = {
  id: string;
  fase_id: string;
  tipo: TipoRonda;
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

  configuracion: Record<string, unknown>;

  cerrada_at: string | null;

  grupos: Grupo[];

  rondas: Ronda[];
};

type EquipoCompeticion = {
  id: string;
  nombre: string;
  escudo: string | null;

  formulario_estado: string | null;

  validacion_estado: string | null;

  plaza_estado: string | null;

  elegible: boolean;

  competicion: {
    estado: string;
    seed: number | null;
    origen: string;
  } | null;
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

  origen_tipo: string;

  equipo_origen_id: string | null;

  origen_grupo_id: string | null;

  origen_fase_id: string | null;

  origen_posicion: number | null;

  origen_partido_id: string | null;

  equipo_resuelto_id: string | null;

  resuelta_at: string | null;
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
  estado: string;
  fecha_hora: string | null;
  pista: string | null;

  duracion_estimada_min: number | null;

  publicado: boolean;

  finalizado_at: string | null;
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

  configuracion: Record<string, unknown>;

  resumen: {
    fases: number;
    grupos: number;
    rondas: number;
    equipos: number;
    partidos: number;
  };

  capacidades: {
    editar: boolean;
  };

  equipos: EquipoCompeticion[];

  plazasGrupo: Plaza[];

  partidos: Partido[];

  plazasPartido: Plaza[];

  fases: Fase[];
};

type TipoEdicion = "fase" | "grupo" | "ronda" | "partido";

type EdicionActiva = {
  tipo: TipoEdicion;

  id: string;

  nombre: string;
} | null;

type BorradorPlaza = {
  origenTipo: TipoOrigen;

  equipoID: string;

  grupoID: string;

  posicion: number;

  partidoOrigenID: string;
};

type Props = {
  torneoID: string;

  edicionID: string;
};

// ============================================================
// CONSTANTES
// ============================================================

const TIPOS_RONDA: {
  valor: TipoRonda;

  nombre: string;
}[] = [
  {
    valor: "TREINTADOSAVOS",

    nombre: "Trenta-dosens",
  },
  {
    valor: "DIECISEISAVOS",

    nombre: "Setzens",
  },
  {
    valor: "OCTAVOS",

    nombre: "Vuitens",
  },
  {
    valor: "CUARTOS",

    nombre: "Quarts",
  },
  {
    valor: "SEMIFINAL",

    nombre: "Semifinal",
  },
  {
    valor: "FINAL",

    nombre: "Final",
  },
  {
    valor: "TERCER_PUESTO",

    nombre: "Tercer lloc",
  },
  {
    valor: "CLASIFICACION",

    nombre: "Classificació",
  },
  {
    valor: "PERSONALIZADA",

    nombre: "Personalitzada",
  },
];

const BORRADOR_PLAZA_INICIAL: BorradorPlaza = {
  origenTipo: "EQUIPO",

  equipoID: "",

  grupoID: "",

  posicion: 1,

  partidoOrigenID: "",
};

// ============================================================
// HELPERS
// ============================================================

function nombreTipoFase(tipo: TipoFase) {
  return tipo === "GRUPOS" ? "Fase de grups" : "Eliminatòria";
}

function nombreTipoRonda(tipo: TipoRonda) {
  return TIPOS_RONDA.find((opcion) => opcion.valor === tipo)?.nombre ?? tipo;
}

function nombreEstado(estado: string) {
  switch (estado) {
    case "BORRADOR":
      return "Esborrany";

    case "PREPARADA":
      return "Preparada";

    case "PREPARADO":
      return "Preparat";

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

    case "CERRADA":
    case "CERRADO":
      return "Tancat";

    case "ACTIVO":
      return "Actiu";

    case "RETIRADO":
      return "Retirat";

    case "DESCALIFICADO":
      return "Desqualificat";

    default:
      return estado;
  }
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

  // ========================================================
  // NUEVA FASE
  // ========================================================

  const [mostrarNuevaFase, setMostrarNuevaFase] = useState(false);

  const [nombreFase, setNombreFase] = useState("");

  const [tipoFase, setTipoFase] = useState<TipoFase>("GRUPOS");

  // ========================================================
  // NUEVO GRUPO / RONDA
  // ========================================================

  const [creandoDentro, setCreandoDentro] = useState<string | null>(null);

  const [nombreElemento, setNombreElemento] = useState("");

  const [tipoNuevaRonda, setTipoNuevaRonda] = useState<TipoRonda>("CUARTOS");

  // ========================================================
  // EDICIÓN
  // ========================================================

  const [editando, setEditando] = useState<EdicionActiva>(null);

  // ========================================================
  // GRUPOS
  // ========================================================

  const [seleccionGrupo, setSeleccionGrupo] = useState<Record<string, string>>(
    {},
  );

  // ========================================================
  // PARTIDOS
  // ========================================================

  const [creandoPartidoRonda, setCreandoPartidoRonda] = useState<string | null>(
    null,
  );

  const [nombrePartido, setNombrePartido] = useState("");

  // ========================================================
  // PLAZAS
  // ========================================================

  const [editandoPlaza, setEditandoPlaza] = useState<string | null>(null);

  const [borradorPlaza, setBorradorPlaza] = useState<BorradorPlaza>(
    BORRADOR_PLAZA_INICIAL,
  );

  // ========================================================
  // CARGAR
  // ========================================================

  const cargar = useCallback(async () => {
    setCargando(true);

    setError("");

    try {
      const parametros = new URLSearchParams({
        torneoID,
        edicionID,
      });

      const respuesta = await fetch(
        `/api/panell/competicio?${parametros.toString()}`,
        {
          credentials: "same-origin",

          cache: "no-store",
        },
      );

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(
          json?.mensaje || "No s'ha pogut carregar la competició.",
        );
      }

      setDatos(json as Datos);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut carregar la competició.",
      );
    } finally {
      setCargando(false);
    }
  }, [torneoID, edicionID]);

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
    setGuardando(true);

    setError("");

    setMensaje("");

    try {
      const respuesta = await fetch("/api/panell/competicio", {
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
        throw new Error(json?.mensaje || "No s'ha pogut completar l'operació.");
      }

      return json;
    } finally {
      setGuardando(false);
    }
  }

  async function ejecutar(
    metodo: "POST" | "PATCH" | "DELETE",

    cuerpo: Record<string, unknown>,

    mensajeCorrecto: string,
  ) {
    try {
      await peticion(metodo, cuerpo);

      setMensaje(mensajeCorrecto);

      await cargar();

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No s'ha pogut completar l'operació.",
      );

      return false;
    }
  }

  // ========================================================
  // FASE
  // ========================================================

  async function crearFase(evento: FormEvent) {
    evento.preventDefault();

    const nombre = nombreFase.trim();

    if (!nombre) {
      setError("Escriu un nom per a la fase.");

      return;
    }

    const correcto = await ejecutar(
      "POST",
      {
        accion: "crear_fase",

        nombre,

        tipo: tipoFase,
      },
      "Fase creada correctament.",
    );

    if (correcto) {
      setNombreFase("");

      setMostrarNuevaFase(false);
    }
  }

  // ========================================================
  // GRUPO / RONDA
  // ========================================================

  async function crearElemento(
    evento: FormEvent,

    fase: Fase,
  ) {
    evento.preventDefault();

    const nombre = nombreElemento.trim();

    if (!nombre) {
      setError("Escriu un nom.");

      return;
    }

    const correcto =
      fase.tipo === "GRUPOS"
        ? await ejecutar(
            "POST",
            {
              accion: "crear_grupo",

              faseID: fase.id,

              nombre,
            },
            "Grup creat correctament.",
          )
        : await ejecutar(
            "POST",
            {
              accion: "crear_ronda",

              faseID: fase.id,

              nombre,

              tipo: tipoNuevaRonda,
            },
            "Ronda creada correctament.",
          );

    if (correcto) {
      setCreandoDentro(null);

      setNombreElemento("");
    }
  }

  // ========================================================
  // PARTIDO
  // ========================================================

  async function crearPartido(ronda: Ronda) {
    const correcto = await ejecutar(
      "POST",
      {
        accion: "crear_partido",

        rondaID: ronda.id,

        nombre: nombrePartido.trim(),
      },
      "Partit creat correctament.",
    );

    if (correcto) {
      setCreandoPartidoRonda(null);

      setNombrePartido("");
    }
  }

  async function eliminarPartido(partido: Partido) {
    const nombre = partido.nombre ?? partido.codigo;

    if (
      !window.confirm(
        `Vols eliminar el partit "${nombre}"? Aquesta acció també eliminarà la configuració de local i visitant.`,
      )
    ) {
      return;
    }

    const correcto = await ejecutar(
      "DELETE",
      {
        accion: "eliminar_partido",

        partidoID: partido.id,
      },
      "Partit eliminat correctament.",
    );

    if (correcto) {
      setEditando(null);

      setEditandoPlaza(null);
    }
  }

  // ========================================================
  // EDITAR NOMBRE
  // ========================================================

  async function guardarNombre(evento: FormEvent) {
    evento.preventDefault();

    if (!editando) {
      return;
    }

    const nombre = editando.nombre.trim();

    if (!nombre) {
      setError("El nom no pot quedar buit.");

      return;
    }

    const cuerpo: Record<string, unknown> = {
      nombre,
    };

    if (editando.tipo === "fase") {
      cuerpo.accion = "editar_fase";

      cuerpo.faseID = editando.id;
    }

    if (editando.tipo === "grupo") {
      cuerpo.accion = "editar_grupo";

      cuerpo.grupoID = editando.id;
    }

    if (editando.tipo === "ronda") {
      cuerpo.accion = "editar_ronda";

      cuerpo.rondaID = editando.id;
    }

    if (editando.tipo === "partido") {
      cuerpo.accion = "editar_partido";

      cuerpo.partidoID = editando.id;
    }

    const correcto = await ejecutar(
      "PATCH",
      cuerpo,
      "Nom actualitzat correctament.",
    );

    if (correcto) {
      setEditando(null);
    }
  }

  // ========================================================
  // ELIMINAR ESTRUCTURA
  // ========================================================

  async function eliminar(
    tipo: Exclude<TipoEdicion, "partido">,

    id: string,

    nombre: string,
  ) {
    if (!window.confirm(`Segur que vols eliminar "${nombre}"?`)) {
      return;
    }

    const cuerpo: Record<string, unknown> = {};

    if (tipo === "fase") {
      cuerpo.accion = "eliminar_fase";

      cuerpo.faseID = id;
    }

    if (tipo === "grupo") {
      cuerpo.accion = "eliminar_grupo";

      cuerpo.grupoID = id;
    }

    if (tipo === "ronda") {
      cuerpo.accion = "eliminar_ronda";

      cuerpo.rondaID = id;
    }

    await ejecutar("DELETE", cuerpo, "Element eliminat correctament.");
  }

  // ========================================================
  // EQUIPOS
  // ========================================================

  async function activarEquipo(equipo: EquipoCompeticion) {
    await ejecutar(
      "POST",
      {
        accion: "activar_equipo",

        equipoID: equipo.id,
      },
      `${equipo.nombre} s'ha afegit a la competició.`,
    );
  }

  async function retirarEquipo(equipo: EquipoCompeticion) {
    if (!window.confirm(`Vols retirar "${equipo.nombre}"?`)) {
      return;
    }

    await ejecutar(
      "DELETE",
      {
        accion: "retirar_equipo",

        equipoID: equipo.id,
      },
      `${equipo.nombre} s'ha retirat.`,
    );
  }

  // ========================================================
  // EQUIPO -> GRUPO
  // ========================================================

  async function asignarEquipoGrupo(grupo: Grupo) {
    const equipoID = seleccionGrupo[grupo.id];

    if (!equipoID) {
      setError("Selecciona un equip.");

      return;
    }

    const correcto = await ejecutar(
      "POST",
      {
        accion: "asignar_equipo_grupo",

        grupoID: grupo.id,

        equipoID,
      },
      "Equip assignat al grup.",
    );

    if (correcto) {
      setSeleccionGrupo((anterior) => ({
        ...anterior,

        [grupo.id]: "",
      }));
    }
  }

  async function quitarEquipoGrupo(plaza: Plaza) {
    await ejecutar(
      "DELETE",
      {
        accion: "quitar_equipo_grupo",

        plazaID: plaza.id,
      },
      "Equip eliminat del grup.",
    );
  }

  // ========================================================
  // PLAZA PARTIDO
  // ========================================================

  function abrirPlaza(
    partido: Partido,

    lado: LadoPartido,

    plaza: Plaza | null,
  ) {
    setEditandoPlaza(`${partido.id}:${lado}`);

    if (!plaza) {
      setBorradorPlaza(BORRADOR_PLAZA_INICIAL);

      return;
    }

    setBorradorPlaza({
      origenTipo: plaza.origen_tipo as TipoOrigen,

      equipoID: plaza.equipo_origen_id ?? "",

      grupoID: plaza.origen_grupo_id ?? "",

      posicion: plaza.origen_posicion ?? 1,

      partidoOrigenID: plaza.origen_partido_id ?? "",
    });
  }

  async function guardarPlaza(
    partido: Partido,

    lado: LadoPartido,
  ) {
    const cuerpo: Record<string, unknown> = {
      accion: "configurar_plaza_partido",

      partidoID: partido.id,

      lado,

      origenTipo: borradorPlaza.origenTipo,
    };

    if (borradorPlaza.origenTipo === "EQUIPO") {
      if (!borradorPlaza.equipoID) {
        setError("Selecciona un equip.");

        return;
      }

      cuerpo.equipoID = borradorPlaza.equipoID;
    }

    if (borradorPlaza.origenTipo === "POSICION_GRUPO") {
      if (!borradorPlaza.grupoID) {
        setError("Selecciona un grup.");

        return;
      }

      cuerpo.grupoID = borradorPlaza.grupoID;

      cuerpo.posicion = borradorPlaza.posicion;
    }

    if (
      borradorPlaza.origenTipo === "GANADOR_PARTIDO" ||
      borradorPlaza.origenTipo === "PERDEDOR_PARTIDO"
    ) {
      if (!borradorPlaza.partidoOrigenID) {
        setError("Selecciona el partit d'origen.");

        return;
      }

      cuerpo.partidoOrigenID = borradorPlaza.partidoOrigenID;
    }

    const correcto = await ejecutar("POST", cuerpo, "Encreuament actualitzat.");

    if (correcto) {
      setEditandoPlaza(null);
    }
  }

  async function eliminarPlazaPartido(plaza: Plaza) {
    const correcto = await ejecutar(
      "DELETE",
      {
        accion: "eliminar_plaza_partido",

        plazaID: plaza.id,
      },
      "Plaça eliminada.",
    );

    if (correcto) {
      setEditandoPlaza(null);
    }
  }

  // ========================================================
  // DERIVADOS
  // ========================================================

  const equiposActivos = useMemo(
    () =>
      datos?.equipos.filter(
        (equipo) => equipo.competicion?.estado === "ACTIVO",
      ) ?? [],
    [datos],
  );

  function equipoPorID(id: string | null) {
    if (!id || !datos) {
      return null;
    }

    return datos.equipos.find((equipo) => equipo.id === id) ?? null;
  }

  function grupoPorID(id: string | null) {
    if (!id || !datos) {
      return null;
    }

    for (const fase of datos.fases) {
      const grupo = fase.grupos.find((elemento) => elemento.id === id);

      if (grupo) {
        return grupo;
      }
    }

    return null;
  }

  function rondaPorID(id: string | null) {
    if (!id || !datos) {
      return null;
    }

    for (const fase of datos.fases) {
      const ronda = fase.rondas.find((elemento) => elemento.id === id);

      if (ronda) {
        return ronda;
      }
    }

    return null;
  }

  function partidoPorID(id: string | null) {
    if (!id || !datos) {
      return null;
    }

    return datos.partidos.find((partido) => partido.id === id) ?? null;
  }

  function plazasDeGrupo(grupoID: string) {
    return (
      datos?.plazasGrupo
        .filter((plaza) => plaza.grupo_id === grupoID)
        .sort((a, b) => a.orden - b.orden) ?? []
    );
  }

  function partidosDeRonda(rondaID: string) {
    return (
      datos?.partidos
        .filter(
          (partido) =>
            partido.ronda_id === rondaID && partido.tipo === "ELIMINATORIA",
        )
        .sort((a, b) => a.orden - b.orden) ?? []
    );
  }

  function equiposDisponiblesFase(faseID: string) {
    if (!datos) {
      return [];
    }

    const utilizados = new Set(
      datos.plazasGrupo
        .filter((plaza) => plaza.destino_fase_id === faseID)
        .map((plaza) => plaza.equipo_resuelto_id)
        .filter((id): id is string => Boolean(id)),
    );

    return equiposActivos.filter((equipo) => !utilizados.has(equipo.id));
  }

  function partidosOrigenDisponibles(partidoDestino: Partido) {
    if (!datos) {
      return [];
    }

    const faseDestino = datos.fases.find(
      (fase) => fase.id === partidoDestino.fase_id,
    );

    const rondaDestino = rondaPorID(partidoDestino.ronda_id);

    if (!faseDestino || !rondaDestino) {
      return [];
    }

    return datos.partidos.filter((partido) => {
      if (partido.id === partidoDestino.id || partido.tipo !== "ELIMINATORIA") {
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

      if (faseOrigen.id !== faseDestino.id) {
        return false;
      }

      const rondaOrigen = rondaPorID(partido.ronda_id);

      return Boolean(rondaOrigen && rondaOrigen.orden < rondaDestino.orden);
    });
  }

  function descripcionPlaza(plaza: Plaza | null) {
    if (!plaza) {
      return "Sense configurar";
    }

    if (plaza.origen_tipo === "LIBRE") {
      return "Lliure";
    }

    if (plaza.origen_tipo === "EQUIPO") {
      return (
        equipoPorID(plaza.equipo_resuelto_id ?? plaza.equipo_origen_id)
          ?.nombre ?? "Equip"
      );
    }

    if (plaza.origen_tipo === "POSICION_GRUPO") {
      const grupo = grupoPorID(plaza.origen_grupo_id);

      return `${plaza.origen_posicion ?? "?"}º ${grupo?.nombre ?? "grup"}`;
    }

    if (plaza.origen_tipo === "GANADOR_PARTIDO") {
      const partido = partidoPorID(plaza.origen_partido_id);

      return `Guanyador · ${partido?.nombre ?? partido?.codigo ?? "partit"}`;
    }

    if (plaza.origen_tipo === "PERDEDOR_PARTIDO") {
      const partido = partidoPorID(plaza.origen_partido_id);

      return `Perdedor · ${partido?.nombre ?? partido?.codigo ?? "partit"}`;
    }

    return plaza.origen_tipo;
  }

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="flex min-h-80 w-full items-center justify-center p-6">
        <Cargando />
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="p-4">
        <div className="rounded-xl border border-error bg-error-container p-4 text-error">
          {error || "No s'ha pogut carregar la competició."}
        </div>
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="flex w-full flex-col gap-5 p-4 pt-0">
      {error && (
        <div className="rounded-xl border border-error bg-error-container p-4 text-sm text-error">
          {error}
        </div>
      )}

      {mensaje && (
        <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-medium text-secondary">
          {mensaje}
        </div>
      )}

      {/* =================================================
                RESUMEN
            ================================================= */}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TarjetaResumen titulo="Fases" valor={datos.resumen.fases} />

        <TarjetaResumen titulo="Grups" valor={datos.resumen.grupos} />

        <TarjetaResumen titulo="Rondes" valor={datos.resumen.rondas} />

        <TarjetaResumen titulo="Equips" valor={datos.resumen.equipos} />

        <TarjetaResumen titulo="Partits" valor={datos.resumen.partidos} />
      </section>

      {/* =================================================
                EQUIPOS
            ================================================= */}

      <section className="rounded-2xl border border-border/50 bg-card">
        <div className="border-b border-border/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            Participants
          </p>

          <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
            Equips de la competició
          </h2>

          <p className="mt-1 text-sm text-neutral">
            {equiposActivos.length} equips actius.
          </p>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {datos.equipos.map((equipo) => {
            const activo = equipo.competicion?.estado === "ACTIVO";

            return (
              <article
                key={equipo.id}
                className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3"
              >
                <EquipoAvatar equipo={equipo} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-neutral-titulos">
                    {equipo.nombre}
                  </p>

                  <p className="mt-0.5 text-xs text-neutral">
                    {activo ? "Actiu" : "Disponible"}
                  </p>
                </div>

                {datos.capacidades.editar &&
                  (activo ? (
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => void retirarEquipo(equipo)}
                      className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
                    >
                      Retirar
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={guardando || !equipo.elegible}
                      onClick={() => void activarEquipo(equipo)}
                      className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:opacity-40"
                    >
                      Afegir
                    </button>
                  ))}
              </article>
            );
          })}
        </div>
      </section>

      {/* =================================================
                CABECERA ESTRUCTURA
            ================================================= */}

      <section className="rounded-2xl border border-border/50 bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Estructura
            </p>

            <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
              {datos.edicion.nombre}
            </h2>
          </div>

          {datos.capacidades.editar && (
            <button
              type="button"
              disabled={guardando}
              onClick={() => setMostrarNuevaFase((valor) => !valor)}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              + Afegir fase
            </button>
          )}
        </div>

        {mostrarNuevaFase && (
          <form
            onSubmit={crearFase}
            className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]"
          >
            <input
              value={nombreFase}
              onChange={(evento) => setNombreFase(evento.target.value)}
              placeholder="Nom de la fase"
              className="rounded-lg border border-border bg-background px-3 py-2"
            />

            <select
              value={tipoFase}
              onChange={(evento) =>
                setTipoFase(evento.target.value as TipoFase)
              }
              className="rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="GRUPOS">Grups</option>

              <option value="ELIMINATORIA">Eliminatòria</option>
            </select>

            <button
              disabled={guardando}
              className="rounded-lg bg-secondary px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              Crear
            </button>
          </form>
        )}
      </section>

      {/* =================================================
                FASES
            ================================================= */}

      {datos.fases.map((fase, indice) => (
        <section
          key={fase.id}
          className="overflow-hidden rounded-2xl border border-border/50 bg-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">
                {indice + 1}
              </div>

              <div>
                <h3 className="text-lg font-bold text-neutral-titulos">
                  {fase.nombre}
                </h3>

                <p className="text-xs text-neutral">
                  {nombreTipoFase(fase.tipo)} · {nombreEstado(fase.estado)}
                </p>
              </div>
            </div>

            {datos.capacidades.editar && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditando({
                      tipo: "fase",

                      id: fase.id,

                      nombre: fase.nombre,
                    })
                  }
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                >
                  Editar
                </button>

                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => void eliminar("fase", fase.id, fase.nombre)}
                  className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>

          {editando?.tipo === "fase" && editando.id === fase.id && (
            <FormularioNombre
              editando={editando}
              guardando={guardando}
              onChange={(nombre) =>
                setEditando({
                  ...editando,
                  nombre,
                })
              }
              onGuardar={guardarNombre}
              onCancelar={() => setEditando(null)}
            />
          )}

          <div className="p-4">
            <div className="mb-4 flex justify-end">
              {datos.capacidades.editar && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => {
                    setCreandoDentro(fase.id);

                    setNombreElemento("");
                  }}
                  className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary disabled:opacity-40"
                >
                  {fase.tipo === "GRUPOS" ? "+ Grup" : "+ Ronda"}
                </button>
              )}
            </div>

            {creandoDentro === fase.id && (
              <form
                onSubmit={(evento) => crearElemento(evento, fase)}
                className="mb-4 grid gap-3 rounded-xl border border-border bg-background/40 p-4 md:grid-cols-[1fr_220px_auto]"
              >
                <input
                  value={nombreElemento}
                  onChange={(evento) => setNombreElemento(evento.target.value)}
                  placeholder={
                    fase.tipo === "GRUPOS" ? "Grup A" : "Quarts de final"
                  }
                  className="rounded-lg border border-border bg-background px-3 py-2"
                />

                {fase.tipo === "ELIMINATORIA" ? (
                  <select
                    value={tipoNuevaRonda}
                    onChange={(evento) =>
                      setTipoNuevaRonda(evento.target.value as TipoRonda)
                    }
                    className="rounded-lg border border-border bg-background px-3 py-2"
                  >
                    {TIPOS_RONDA.map((tipo) => (
                      <option key={tipo.valor} value={tipo.valor}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div />
                )}

                <button
                  disabled={guardando}
                  className="rounded-lg bg-secondary px-4 py-2 font-semibold text-white disabled:opacity-40"
                >
                  Crear
                </button>
              </form>
            )}

            {fase.tipo === "GRUPOS" ? (
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {fase.grupos.map((grupo) => (
                  <GrupoCard
                    key={grupo.id}
                    grupo={grupo}
                    plazas={plazasDeGrupo(grupo.id)}
                    equiposDisponibles={equiposDisponiblesFase(fase.id)}
                    seleccion={seleccionGrupo[grupo.id] ?? ""}
                    equipoPorID={equipoPorID}
                    puedeEditar={datos.capacidades.editar}
                    guardando={guardando}
                    onSeleccionar={(valor) =>
                      setSeleccionGrupo((anterior) => ({
                        ...anterior,

                        [grupo.id]: valor,
                      }))
                    }
                    onAsignar={() => void asignarEquipoGrupo(grupo)}
                    onQuitar={(plaza) => void quitarEquipoGrupo(plaza)}
                    onEditar={() =>
                      setEditando({
                        tipo: "grupo",

                        id: grupo.id,

                        nombre: grupo.nombre,
                      })
                    }
                    onEliminar={() =>
                      void eliminar("grupo", grupo.id, grupo.nombre)
                    }
                    editando={
                      editando?.tipo === "grupo" && editando.id === grupo.id
                        ? editando
                        : null
                    }
                    onCambiarNombre={(nombre) =>
                      editando &&
                      setEditando({
                        ...editando,

                        nombre,
                      })
                    }
                    onGuardar={guardarNombre}
                    onCancelar={() => setEditando(null)}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div className="flex min-w-max items-start gap-5">
                  {fase.rondas.map((ronda) => (
                    <RondaBracket
                      key={ronda.id}
                      ronda={ronda}
                      partidos={partidosDeRonda(ronda.id)}
                      plazasPartido={datos.plazasPartido}
                      equipos={equiposActivos}
                      gruposOrigen={datos.fases
                        .filter(
                          (origen) =>
                            origen.tipo === "GRUPOS" &&
                            origen.orden < fase.orden,
                        )
                        .flatMap((origen) =>
                          origen.grupos.map((grupo) => ({
                            ...grupo,

                            faseNombre: origen.nombre,
                          })),
                        )}
                      partidosOrigenDisponibles={partidosOrigenDisponibles}
                      descripcionPlaza={descripcionPlaza}
                      puedeEditar={datos.capacidades.editar}
                      guardando={guardando}
                      creandoPartido={creandoPartidoRonda === ronda.id}
                      nombrePartido={nombrePartido}
                      onNombrePartido={setNombrePartido}
                      onAbrirCrearPartido={() => {
                        setCreandoPartidoRonda(ronda.id);

                        setNombrePartido("");
                      }}
                      onCancelarCrearPartido={() =>
                        setCreandoPartidoRonda(null)
                      }
                      onCrearPartido={() => void crearPartido(ronda)}
                      onEditarRonda={() =>
                        setEditando({
                          tipo: "ronda",

                          id: ronda.id,

                          nombre: ronda.nombre,
                        })
                      }
                      onEliminarRonda={() =>
                        void eliminar("ronda", ronda.id, ronda.nombre)
                      }
                      editandoRonda={
                        editando?.tipo === "ronda" && editando.id === ronda.id
                          ? editando
                          : null
                      }
                      onCambiarNombreRonda={(nombre) =>
                        editando &&
                        setEditando({
                          ...editando,

                          nombre,
                        })
                      }
                      onGuardarNombre={guardarNombre}
                      onCancelarNombre={() => setEditando(null)}
                      editandoPlaza={editandoPlaza}
                      borradorPlaza={borradorPlaza}
                      onBorradorPlaza={setBorradorPlaza}
                      onAbrirPlaza={abrirPlaza}
                      onCerrarPlaza={() => setEditandoPlaza(null)}
                      onGuardarPlaza={guardarPlaza}
                      onEliminarPlaza={(plaza) =>
                        void eliminarPlazaPartido(plaza)
                      }
                      onEliminarPartido={(partido) =>
                        void eliminarPartido(partido)
                      }
                      onEditarPartido={(partido) =>
                        setEditando({
                          tipo: "partido",

                          id: partido.id,

                          nombre: partido.nombre ?? partido.codigo,
                        })
                      }
                      editando={editando}
                      onCambiarNombrePartido={(nombre) =>
                        editando &&
                        setEditando({
                          ...editando,

                          nombre,
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      ))}
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
// AVATAR
// ============================================================

function EquipoAvatar({ equipo }: { equipo: EquipoCompeticion }) {
  if (equipo.escudo) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
        <img
          src={equipo.escudo}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
      {equipo.nombre.charAt(0).toUpperCase()}
    </div>
  );
}

// ============================================================
// FORMULARIO NOMBRE
// ============================================================

function FormularioNombre({
  editando,
  guardando,
  onChange,
  onGuardar,
  onCancelar,
}: {
  editando: NonNullable<EdicionActiva>;

  guardando: boolean;

  onChange: (nombre: string) => void;

  onGuardar: (evento: FormEvent) => void;

  onCancelar: () => void;
}) {
  return (
    <form
      onSubmit={onGuardar}
      className="m-4 flex gap-2 rounded-xl border border-border bg-background/40 p-3"
    >
      <input
        autoFocus
        value={editando.nombre}
        disabled={guardando}
        onChange={(evento) => onChange(evento.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2"
      />

      <button
        disabled={guardando}
        className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Guardar
      </button>

      <button
        type="button"
        disabled={guardando}
        onClick={onCancelar}
        className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-40"
      >
        Cancel·lar
      </button>
    </form>
  );
}

// ============================================================
// GRUPO
// ============================================================

function GrupoCard({
  grupo,
  plazas,
  equiposDisponibles,
  seleccion,
  equipoPorID,
  puedeEditar,
  guardando,
  onSeleccionar,
  onAsignar,
  onQuitar,
  onEditar,
  onEliminar,
  editando,
  onCambiarNombre,
  onGuardar,
  onCancelar,
}: {
  grupo: Grupo;

  plazas: Plaza[];

  equiposDisponibles: EquipoCompeticion[];

  seleccion: string;

  equipoPorID: (id: string | null) => EquipoCompeticion | null;

  puedeEditar: boolean;

  guardando: boolean;

  onSeleccionar: (valor: string) => void;

  onAsignar: () => void;

  onQuitar: (plaza: Plaza) => void;

  onEditar: () => void;

  onEliminar: () => void;

  editando: EdicionActiva;

  onCambiarNombre: (nombre: string) => void;

  onGuardar: (evento: FormEvent) => void;

  onCancelar: () => void;
}) {
  return (
    <article className="rounded-xl border border-border/50 bg-background/40">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 p-4">
        <div>
          <p className="font-bold text-neutral-titulos">{grupo.nombre}</p>

          <p className="text-xs text-neutral">{plazas.length} equips</p>
        </div>

        {puedeEditar && (
          <div className="flex gap-1">
            <button
              type="button"
              disabled={guardando}
              onClick={onEditar}
              className="rounded-lg border border-border px-2 py-1 text-xs disabled:opacity-40"
            >
              Editar
            </button>

            <button
              type="button"
              disabled={guardando}
              onClick={onEliminar}
              className="rounded-lg border border-error/30 px-2 py-1 text-xs text-error disabled:opacity-40"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>

      {editando && (
        <FormularioNombre
          editando={editando}
          guardando={guardando}
          onChange={onCambiarNombre}
          onGuardar={onGuardar}
          onCancelar={onCancelar}
        />
      )}

      <div className="flex flex-col gap-2 p-4">
        {plazas.map((plaza, indice) => {
          const equipo = equipoPorID(plaza.equipo_resuelto_id);

          return (
            <div
              key={plaza.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card p-2"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {indice + 1}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {equipo?.nombre ?? "Equip"}
                </p>
              </div>

              {puedeEditar && grupo.estado === "PREPARADO" && (
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() => onQuitar(plaza)}
                  className="text-xs font-semibold text-error disabled:opacity-40"
                >
                  Llevar
                </button>
              )}
            </div>
          );
        })}

        {puedeEditar && grupo.estado === "PREPARADO" && (
          <div className="mt-2 flex gap-2">
            <select
              value={seleccion}
              disabled={guardando}
              onChange={(evento) => onSeleccionar(evento.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
            >
              <option value="">Equip...</option>

              {equiposDisponibles.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </select>

            <button
              type="button"
              disabled={guardando || !seleccion}
              onClick={onAsignar}
              className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              +
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

// ============================================================
// RONDA
// ============================================================

function RondaBracket({
  ronda,
  partidos,
  plazasPartido,
  equipos,
  gruposOrigen,
  partidosOrigenDisponibles,
  descripcionPlaza,
  puedeEditar,
  guardando,
  creandoPartido,
  nombrePartido,
  onNombrePartido,
  onAbrirCrearPartido,
  onCancelarCrearPartido,
  onCrearPartido,
  onEditarRonda,
  onEliminarRonda,
  editandoRonda,
  onCambiarNombreRonda,
  onGuardarNombre,
  onCancelarNombre,
  editandoPlaza,
  borradorPlaza,
  onBorradorPlaza,
  onAbrirPlaza,
  onCerrarPlaza,
  onGuardarPlaza,
  onEliminarPlaza,
  onEliminarPartido,
  onEditarPartido,
  editando,
  onCambiarNombrePartido,
}: {
  ronda: Ronda;

  partidos: Partido[];

  plazasPartido: Plaza[];

  equipos: EquipoCompeticion[];

  gruposOrigen: Array<
    Grupo & {
      faseNombre: string;
    }
  >;

  partidosOrigenDisponibles: (partido: Partido) => Partido[];

  descripcionPlaza: (plaza: Plaza | null) => string;

  puedeEditar: boolean;

  guardando: boolean;

  creandoPartido: boolean;

  nombrePartido: string;

  onNombrePartido: (valor: string) => void;

  onAbrirCrearPartido: () => void;

  onCancelarCrearPartido: () => void;

  onCrearPartido: () => void;

  onEditarRonda: () => void;

  onEliminarRonda: () => void;

  editandoRonda: EdicionActiva;

  onCambiarNombreRonda: (nombre: string) => void;

  onGuardarNombre: (evento: FormEvent) => void;

  onCancelarNombre: () => void;

  editandoPlaza: string | null;

  borradorPlaza: BorradorPlaza;

  onBorradorPlaza: (valor: BorradorPlaza) => void;

  onAbrirPlaza: (
    partido: Partido,

    lado: LadoPartido,

    plaza: Plaza | null,
  ) => void;

  onCerrarPlaza: () => void;

  onGuardarPlaza: (
    partido: Partido,

    lado: LadoPartido,
  ) => void;

  onEliminarPlaza: (plaza: Plaza) => void;

  onEliminarPartido: (partido: Partido) => void;

  onEditarPartido: (partido: Partido) => void;

  editando: EdicionActiva;

  onCambiarNombrePartido: (nombre: string) => void;
}) {
  return (
    <div className="w-80 shrink-0 rounded-xl border border-border/50 bg-background/40">
      <div className="border-b border-border/40 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-neutral-titulos">{ronda.nombre}</p>

            <p className="mt-0.5 text-xs text-neutral">
              {nombreTipoRonda(ronda.tipo)} · {partidos.length} partits
            </p>
          </div>

          {puedeEditar && (
            <div className="flex gap-1">
              <button
                type="button"
                disabled={guardando}
                onClick={onEditarRonda}
                className="rounded border border-border px-2 py-1 text-[11px] disabled:opacity-40"
              >
                Editar
              </button>

              <button
                type="button"
                disabled={guardando}
                onClick={onEliminarRonda}
                className="rounded border border-error/30 px-2 py-1 text-[11px] text-error disabled:opacity-40"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {editandoRonda && (
          <FormularioNombre
            editando={editandoRonda}
            guardando={guardando}
            onChange={onCambiarNombreRonda}
            onGuardar={onGuardarNombre}
            onCancelar={onCancelarNombre}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 p-3">
        {partidos.map((partido) => {
          const local =
            plazasPartido.find(
              (plaza) =>
                plaza.partido_id === partido.id && plaza.lado === "LOCAL",
            ) ?? null;

          const visitante =
            plazasPartido.find(
              (plaza) =>
                plaza.partido_id === partido.id && plaza.lado === "VISITANTE",
            ) ?? null;

          return (
            <article
              key={partido.id}
              className="rounded-xl border border-border bg-card shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/40 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-neutral-titulos">
                    {partido.nombre ?? partido.codigo}
                  </p>

                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-neutral">
                    {partido.codigo}
                  </p>
                </div>

                {puedeEditar && partido.estado === "BORRADOR" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => onEditarPartido(partido)}
                      className="text-[11px] font-semibold text-primary disabled:opacity-40"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => onEliminarPartido(partido)}
                      title="Eliminar partit"
                      className="text-[11px] font-semibold text-error disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>

              {editando?.tipo === "partido" && editando.id === partido.id && (
                <FormularioNombre
                  editando={editando}
                  guardando={guardando}
                  onChange={onCambiarNombrePartido}
                  onGuardar={onGuardarNombre}
                  onCancelar={onCancelarNombre}
                />
              )}

              <SlotPartido
                lado="LOCAL"
                plaza={local}
                descripcion={descripcionPlaza(local)}
                equipos={equipos}
                grupos={gruposOrigen}
                partidosOrigen={partidosOrigenDisponibles(partido)}
                editando={editandoPlaza === `${partido.id}:LOCAL`}
                borrador={borradorPlaza}
                puedeEditar={puedeEditar && partido.estado === "BORRADOR"}
                guardando={guardando}
                onAbrir={() => onAbrirPlaza(partido, "LOCAL", local)}
                onCerrar={onCerrarPlaza}
                onBorrador={onBorradorPlaza}
                onGuardar={() => onGuardarPlaza(partido, "LOCAL")}
                onEliminar={local ? () => onEliminarPlaza(local) : undefined}
              />

              <div className="border-t border-border/40" />

              <SlotPartido
                lado="VISITANTE"
                plaza={visitante}
                descripcion={descripcionPlaza(visitante)}
                equipos={equipos}
                grupos={gruposOrigen}
                partidosOrigen={partidosOrigenDisponibles(partido)}
                editando={editandoPlaza === `${partido.id}:VISITANTE`}
                borrador={borradorPlaza}
                puedeEditar={puedeEditar && partido.estado === "BORRADOR"}
                guardando={guardando}
                onAbrir={() => onAbrirPlaza(partido, "VISITANTE", visitante)}
                onCerrar={onCerrarPlaza}
                onBorrador={onBorradorPlaza}
                onGuardar={() => onGuardarPlaza(partido, "VISITANTE")}
                onEliminar={
                  visitante ? () => onEliminarPlaza(visitante) : undefined
                }
              />
            </article>
          );
        })}

        {creandoPartido ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <input
              autoFocus
              value={nombrePartido}
              disabled={guardando}
              onChange={(evento) => onNombrePartido(evento.target.value)}
              placeholder="Nom opcional"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={guardando}
                onClick={onCrearPartido}
                className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                Crear partit
              </button>

              <button
                type="button"
                disabled={guardando}
                onClick={onCancelarCrearPartido}
                className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
              >
                Cancel·lar
              </button>
            </div>
          </div>
        ) : (
          puedeEditar && (
            <button
              type="button"
              disabled={guardando}
              onClick={onAbrirCrearPartido}
              className="rounded-xl border border-dashed border-primary/40 p-3 text-sm font-semibold text-primary disabled:opacity-40"
            >
              + Afegir partit
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ============================================================
// SLOT PARTIDO
// ============================================================

function SlotPartido({
  lado,
  plaza,
  descripcion,
  equipos,
  grupos,
  partidosOrigen,
  editando,
  borrador,
  puedeEditar,
  guardando,
  onAbrir,
  onCerrar,
  onBorrador,
  onGuardar,
  onEliminar,
}: {
  lado: LadoPartido;

  plaza: Plaza | null;

  descripcion: string;

  equipos: EquipoCompeticion[];

  grupos: Array<
    Grupo & {
      faseNombre: string;
    }
  >;

  partidosOrigen: Partido[];

  editando: boolean;

  borrador: BorradorPlaza;

  puedeEditar: boolean;

  guardando: boolean;

  onAbrir: () => void;

  onCerrar: () => void;

  onBorrador: (valor: BorradorPlaza) => void;

  onGuardar: () => void;

  onEliminar?: () => void;
}) {
  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-neutral">
          {lado === "LOCAL" ? "Local" : "Visitant"}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-neutral-titulos">
            {descripcion}
          </p>
        </div>

        {puedeEditar && !editando && (
          <button
            type="button"
            disabled={guardando}
            onClick={onAbrir}
            className="text-xs font-semibold text-primary disabled:opacity-40"
          >
            Configurar
          </button>
        )}
      </div>

      {editando && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-background/50 p-3">
          <select
            value={borrador.origenTipo}
            disabled={guardando}
            onChange={(evento) =>
              onBorrador({
                ...BORRADOR_PLAZA_INICIAL,

                origenTipo: evento.target.value as TipoOrigen,
              })
            }
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
          >
            <option value="EQUIPO">Equip directe</option>

            <option value="POSICION_GRUPO">Posició d'un grup</option>

            <option value="GANADOR_PARTIDO">Guanyador d'un partit</option>

            <option value="PERDEDOR_PARTIDO">Perdedor d'un partit</option>

            <option value="LIBRE">Lliure / bye</option>
          </select>

          {borrador.origenTipo === "EQUIPO" && (
            <select
              value={borrador.equipoID}
              disabled={guardando}
              onChange={(evento) =>
                onBorrador({
                  ...borrador,

                  equipoID: evento.target.value,
                })
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
            >
              <option value="">Selecciona equip...</option>

              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </select>
          )}

          {borrador.origenTipo === "POSICION_GRUPO" && (
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <select
                value={borrador.grupoID}
                disabled={guardando}
                onChange={(evento) =>
                  onBorrador({
                    ...borrador,

                    grupoID: evento.target.value,
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
              >
                <option value="">Grup...</option>

                {grupos.map((grupo) => (
                  <option key={grupo.id} value={grupo.id}>
                    {grupo.faseNombre} · {grupo.nombre}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={1}
                value={borrador.posicion}
                disabled={guardando}
                onChange={(evento) =>
                  onBorrador({
                    ...borrador,

                    posicion: Number(evento.target.value),
                  })
                }
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
              />
            </div>
          )}

          {(borrador.origenTipo === "GANADOR_PARTIDO" ||
            borrador.origenTipo === "PERDEDOR_PARTIDO") && (
            <select
              value={borrador.partidoOrigenID}
              disabled={guardando}
              onChange={(evento) =>
                onBorrador({
                  ...borrador,

                  partidoOrigenID: evento.target.value,
                })
              }
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-40"
            >
              <option value="">Partit d'origen...</option>

              {partidosOrigen.map((partido) => (
                <option key={partido.id} value={partido.id}>
                  {partido.nombre ?? partido.codigo}
                </option>
              ))}
            </select>
          )}

          {borrador.origenTipo === "LIBRE" && (
            <p className="rounded-lg bg-muted p-2 text-xs text-neutral">
              Aquesta plaça quedarà lliure. Es pot utilitzar per representar un
              bye.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={guardando}
              onClick={onGuardar}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Guardar
            </button>

            <button
              type="button"
              disabled={guardando}
              onClick={onCerrar}
              className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
            >
              Cancel·lar
            </button>

            {plaza && onEliminar && (
              <button
                type="button"
                disabled={guardando}
                onClick={onEliminar}
                className="ml-auto rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
              >
                Eliminar plaça
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
