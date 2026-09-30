import Cargando from "@components/Cargando";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { FormEvent } from "react";

// ============================================================
// TIPOS
// ============================================================

type Equipo = {
  id: string;
  nombre: string;
  escudo: string | null;
};

type Plaza = {
  id: string;

  edicion_id: string;

  destino_fase_id: string;

  destino_tipo: "GRUPO";

  grupo_id: string | null;

  orden: number;

  equipo_resuelto_id: string | null;
};

type Grupo = {
  id: string;

  fase_id: string;

  nombre: string;

  orden: number;

  estado: string;

  version_clasificacion: number;

  cerrada_at: string | null;

  partidos: number;
};

type Fase = {
  id: string;

  edicion_id: string;

  nombre: string;

  tipo: "GRUPOS";

  orden: number;

  estado: string;

  publicada: boolean;

  configuracion: Record<string, unknown>;

  cerrada_at: string | null;

  grupos: Grupo[];
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

  plazas: Plaza[];

  equipos: Equipo[];
};

type Props = {
  torneoID: string;

  edicionID: string;
};

type EdicionNombre =
  | {
      tipo: "fase";

      id: string;

      nombre: string;
    }
  | {
      tipo: "grupo";

      id: string;

      nombre: string;
    }
  | null;

// ============================================================
// CONSTANTES
// ============================================================

const API = "/api/panell/competicio/grups";

// ============================================================
// COMPONENTE
// ============================================================

export default function FaseGrups({ torneoID, edicionID }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [error, setError] = useState("");

  const [mensaje, setMensaje] = useState("");

  const [faseID, setFaseID] = useState("");

  // ========================================================
  // NUEVA FASE
  // ========================================================

  const [mostrarNuevaFase, setMostrarNuevaFase] = useState(false);

  const [nombreFase, setNombreFase] = useState("");

  // ========================================================
  // NUEVO GRUPO
  // ========================================================

  const [mostrarNuevoGrupo, setMostrarNuevoGrupo] = useState(false);

  const [nombreGrupo, setNombreGrupo] = useState("");

  // ========================================================
  // SELECCIÓN DE EQUIPOS
  // ========================================================

  const [seleccionGrupo, setSeleccionGrupo] = useState<Record<string, string>>(
    {},
  );

  // ========================================================
  // EDICIÓN NOMBRE
  // ========================================================

  const [editando, setEditando] = useState<EdicionNombre>(null);

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

      const respuesta = await fetch(`${API}?${parametros.toString()}`, {
        credentials: "same-origin",

        cache: "no-store",
      });

      const json = await respuesta.json().catch(() => null);

      if (!respuesta.ok || json?.success !== true) {
        throw new Error(
          json?.mensaje ?? "No s'ha pogut carregar la fase de grups.",
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
          : "No s'ha pogut carregar la fase de grups.",
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
  // DERIVADOS
  // ========================================================

  const faseSeleccionada = useMemo(
    () => datos?.fases.find((fase) => fase.id === faseID) ?? null,
    [datos, faseID],
  );

  function plazasGrupo(grupoID: string) {
    return (
      datos?.plazas
        .filter((plaza) => plaza.grupo_id === grupoID)
        .sort((a, b) => a.orden - b.orden) ?? []
    );
  }

  function equipoPorID(id: string | null) {
    if (!id || !datos) {
      return null;
    }

    return datos.equipos.find((equipo) => equipo.id === id) ?? null;
  }

  function equiposDisponibles(fase: Fase) {
    if (!datos) {
      return [];
    }

    const utilizados = new Set(
      datos.plazas
        .filter((plaza) => plaza.destino_fase_id === fase.id)
        .map((plaza) => plaza.equipo_resuelto_id)
        .filter((id): id is string => Boolean(id)),
    );

    return datos.equipos.filter((equipo) => !utilizados.has(equipo.id));
  }

  // ========================================================
  // CREAR FASE
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
      },
      "Fase de grups creada.",
    );

    if (correcto) {
      setNombreFase("");

      setMostrarNuevaFase(false);
    }
  }

  // ========================================================
  // CREAR GRUPO
  // ========================================================

  async function crearGrupo(evento: FormEvent) {
    evento.preventDefault();

    if (!faseSeleccionada) {
      return;
    }

    const nombre = nombreGrupo.trim();

    if (!nombre) {
      setError("Escriu un nom per al grup.");

      return;
    }

    const correcto = await ejecutar(
      "POST",
      {
        accion: "crear_grupo",

        faseID: faseSeleccionada.id,

        nombre,
      },
      "Grup creat.",
    );

    if (correcto) {
      setNombreGrupo("");

      setMostrarNuevoGrupo(false);
    }
  }

  // ========================================================
  // EQUIPOS
  // ========================================================

  async function asignarEquipo(grupo: Grupo) {
    const equipoID = seleccionGrupo[grupo.id];

    if (!equipoID) {
      setError("Selecciona un equip.");

      return;
    }

    const correcto = await ejecutar(
      "POST",
      {
        accion: "asignar_equipo",

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

  async function quitarEquipo(plaza: Plaza) {
    await ejecutar(
      "DELETE",
      {
        accion: "quitar_equipo",

        plazaID: plaza.id,
      },
      "Equip eliminat del grup.",
    );
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
    } else {
      cuerpo.accion = "editar_grupo";

      cuerpo.grupoID = editando.id;
    }

    const correcto = await ejecutar("PATCH", cuerpo, "Nom actualitzat.");

    if (correcto) {
      setEditando(null);
    }
  }

  // ========================================================
  // ELIMINAR
  // ========================================================

  async function eliminarGrupo(grupo: Grupo) {
    if (!window.confirm(`Vols eliminar el grup "${grupo.nombre}"?`)) {
      return;
    }

    await ejecutar(
      "DELETE",
      {
        accion: "eliminar_grupo",

        grupoID: grupo.id,
      },
      "Grup eliminat.",
    );
  }

  async function eliminarFase(fase: Fase) {
    if (!window.confirm(`Vols eliminar la fase "${fase.nombre}"?`)) {
      return;
    }

    await ejecutar(
      "DELETE",
      {
        accion: "eliminar_fase",

        faseID: fase.id,
      },
      "Fase eliminada.",
    );
  }

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Cargando />
      </div>
    );
  }

  if (!datos) {
    return (
      <div className="rounded-xl border border-error bg-error-container p-4 text-error">
        {error || "No s'ha pogut carregar la fase de grups."}
      </div>
    );
  }

  // ========================================================
  // UI
  // ========================================================

  return (
    <div className="flex flex-col gap-5">
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

      {/* ===============================================
          CABECERA
      =============================================== */}

      <section className="rounded-2xl border border-border/50 bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Fase de grups
            </p>

            <h2 className="mt-1 text-xl font-bold text-neutral-titulos">
              Configuració dels grups
            </h2>

            <p className="mt-1 text-sm text-neutral">
              Crea els grups i distribueix els equips participants.
            </p>
          </div>

          {datos.capacidades.editar && (
            <button
              type="button"
              onClick={() => setMostrarNuevaFase((valor) => !valor)}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white"
            >
              + Fase de grups
            </button>
          )}
        </div>

        {mostrarNuevaFase && (
          <form onSubmit={crearFase} className="mt-4 flex gap-2">
            <input
              value={nombreFase}
              onChange={(evento) => setNombreFase(evento.target.value)}
              placeholder="Fase de grups"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2"
            />

            <button
              disabled={guardando}
              className="rounded-lg bg-secondary px-4 py-2 font-semibold text-white disabled:opacity-40"
            >
              Crear
            </button>
          </form>
        )}
      </section>

      {/* ===============================================
          SIN FASES
      =============================================== */}

      {datos.fases.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
          <h3 className="font-bold text-neutral-titulos">
            Encara no hi ha cap fase de grups
          </h3>

          <p className="mt-2 text-sm text-neutral">
            Crea una fase per començar a distribuir els equips.
          </p>
        </section>
      ) : (
        <>
          {/* ===========================================
              SELECTOR
          =========================================== */}

          <section className="flex gap-2 overflow-x-auto rounded-2xl border border-border/50 bg-card p-2">
            {datos.fases.map((fase) => (
              <button
                key={fase.id}
                type="button"
                onClick={() => setFaseID(fase.id)}
                className={
                  fase.id === faseID
                    ? "shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                    : "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-neutral hover:bg-background"
                }
              >
                {fase.nombre}
              </button>
            ))}
          </section>

          {faseSeleccionada && (
            <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
              {/* CABECERA FASE */}

              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 p-4">
                <div>
                  {editando?.tipo === "fase" &&
                  editando.id === faseSeleccionada.id ? (
                    <FormularioNombre
                      valor={editando.nombre}
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
                  ) : (
                    <>
                      <h3 className="text-lg font-bold text-neutral-titulos">
                        {faseSeleccionada.nombre}
                      </h3>

                      <p className="mt-1 text-xs text-neutral">
                        {faseSeleccionada.grupos.length} grups
                      </p>
                    </>
                  )}
                </div>

                {datos.capacidades.editar && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditando({
                          tipo: "fase",

                          id: faseSeleccionada.id,

                          nombre: faseSeleccionada.nombre,
                        })
                      }
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold"
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => setMostrarNuevoGrupo((valor) => !valor)}
                      className="rounded-lg border border-primary px-3 py-2 text-xs font-semibold text-primary"
                    >
                      + Grup
                    </button>

                    <button
                      type="button"
                      disabled={guardando}
                      onClick={() => void eliminarFase(faseSeleccionada)}
                      className="rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error disabled:opacity-40"
                    >
                      Eliminar fase
                    </button>
                  </div>
                )}
              </div>

              {/* NUEVO GRUPO */}

              {mostrarNuevoGrupo && (
                <form
                  onSubmit={crearGrupo}
                  className="flex gap-2 border-b border-border/40 bg-background/40 p-4"
                >
                  <input
                    value={nombreGrupo}
                    onChange={(evento) => setNombreGrupo(evento.target.value)}
                    placeholder="Grup A"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2"
                  />

                  <button
                    disabled={guardando}
                    className="rounded-lg bg-secondary px-4 py-2 font-semibold text-white disabled:opacity-40"
                  >
                    Crear
                  </button>
                </form>
              )}

              {/* GRUPOS */}

              <div className="grid gap-4 p-4 lg:grid-cols-2 xl:grid-cols-3">
                {faseSeleccionada.grupos.map((grupo) => (
                  <GrupoCard
                    key={grupo.id}
                    grupo={grupo}
                    plazas={plazasGrupo(grupo.id)}
                    equiposDisponibles={equiposDisponibles(faseSeleccionada)}
                    seleccion={seleccionGrupo[grupo.id] ?? ""}
                    equipoPorID={equipoPorID}
                    puedeEditar={datos.capacidades.editar}
                    guardando={guardando}
                    editando={
                      editando?.tipo === "grupo" && editando.id === grupo.id
                        ? editando
                        : null
                    }
                    onSeleccionar={(valor) =>
                      setSeleccionGrupo((anterior) => ({
                        ...anterior,

                        [grupo.id]: valor,
                      }))
                    }
                    onAsignar={() => void asignarEquipo(grupo)}
                    onQuitar={(plaza) => void quitarEquipo(plaza)}
                    onEditar={() =>
                      setEditando({
                        tipo: "grupo",

                        id: grupo.id,

                        nombre: grupo.nombre,
                      })
                    }
                    onEliminar={() => void eliminarGrupo(grupo)}
                    onCambiarNombre={(nombre) => {
                      if (!editando) {
                        return;
                      }

                      setEditando({
                        ...editando,
                        nombre,
                      });
                    }}
                    onGuardar={guardarNombre}
                    onCancelar={() => setEditando(null)}
                  />
                ))}

                {faseSeleccionada.grupos.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-border p-8 text-center text-sm text-neutral">
                    Encara no hi ha grups configurats.
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
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
  editando,
  onSeleccionar,
  onAsignar,
  onQuitar,
  onEditar,
  onEliminar,
  onCambiarNombre,
  onGuardar,
  onCancelar,
}: {
  grupo: Grupo;

  plazas: Plaza[];

  equiposDisponibles: Equipo[];

  seleccion: string;

  equipoPorID: (id: string | null) => Equipo | null;

  puedeEditar: boolean;

  guardando: boolean;

  editando: Extract<
    EdicionNombre,
    {
      tipo: "grupo";
    }
  > | null;

  onSeleccionar: (valor: string) => void;

  onAsignar: () => void;

  onQuitar: (plaza: Plaza) => void;

  onEditar: () => void;

  onEliminar: () => void;

  onCambiarNombre: (nombre: string) => void;

  onGuardar: (evento: FormEvent) => void;

  onCancelar: () => void;
}) {
  const bloqueado = grupo.partidos > 0 || grupo.estado !== "PREPARADO";

  return (
    <article className="overflow-hidden rounded-xl border border-border/50 bg-background/40">
      <div className="flex items-start justify-between gap-3 border-b border-border/40 p-4">
        <div className="min-w-0 flex-1">
          {editando ? (
            <FormularioNombre
              valor={editando.nombre}
              guardando={guardando}
              onChange={onCambiarNombre}
              onGuardar={onGuardar}
              onCancelar={onCancelar}
            />
          ) : (
            <>
              <p className="truncate font-bold text-neutral-titulos">
                {grupo.nombre}
              </p>

              <p className="mt-1 text-xs text-neutral">
                {plazas.length} {plazas.length === 1 ? "equip" : "equips"}
                {" · "}
                {grupo.partidos} {grupo.partidos === 1 ? "partit" : "partits"}
              </p>
            </>
          )}
        </div>

        {puedeEditar && !editando && (
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

      <div className="flex flex-col gap-2 p-4">
        {plazas.map((plaza, indice) => {
          const equipo = equipoPorID(plaza.equipo_resuelto_id);

          return (
            <div
              key={plaza.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-card p-2.5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {indice + 1}
              </div>

              <EquipoAvatar equipo={equipo} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-titulos">
                  {equipo?.nombre ?? "Equip"}
                </p>
              </div>

              {puedeEditar && !bloqueado && (
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

        {plazas.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-xs text-neutral">
            Cap equip assignat.
          </div>
        )}

        {puedeEditar && !bloqueado && (
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

        {bloqueado && (
          <p className="mt-1 text-[11px] leading-4 text-neutral">
            La composició del grup està bloquejada perquè ja té partits o ha
            començat.
          </p>
        )}
      </div>
    </article>
  );
}

// ============================================================
// AVATAR
// ============================================================

function EquipoAvatar({ equipo }: { equipo: Equipo | null }) {
  if (equipo?.escudo) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
        <img
          src={equipo.escudo}
          alt=""
          className="h-full w-full object-contain p-1"
        />
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
      {equipo?.nombre?.charAt(0).toUpperCase() ?? "?"}
    </div>
  );
}

// ============================================================
// FORMULARIO NOMBRE
// ============================================================

function FormularioNombre({
  valor,
  guardando,
  onChange,
  onGuardar,
  onCancelar,
}: {
  valor: string;

  guardando: boolean;

  onChange: (valor: string) => void;

  onGuardar: (evento: FormEvent) => void;

  onCancelar: () => void;
}) {
  return (
    <form onSubmit={onGuardar} className="flex min-w-0 gap-2">
      <input
        autoFocus
        value={valor}
        disabled={guardando}
        onChange={(evento) => onChange(evento.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <button
        disabled={guardando}
        className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
      >
        Guardar
      </button>

      <button
        type="button"
        disabled={guardando}
        onClick={onCancelar}
        className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-40"
      >
        ×
      </button>
    </form>
  );
}
