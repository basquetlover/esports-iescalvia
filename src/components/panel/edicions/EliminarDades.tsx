import { useCallback, useEffect, useMemo, useState } from "react";

import Cargando from "@components/Cargando";

// ============================================================
// TIPOS
// ============================================================

type Accion =
  | "RESULTADOS"
  | "ACTAS"
  | "PARTIDOS"
  | "EQUIPOS"
  | "VOLUNTARIOS"
  | "EDICION";

type PreviewResultado = {
  resultados: number;
  estadisticasEquipo: number;
  estadisticasIndividuales: number;
  total: number;
};

type PreviewActa = {
  id: string;
  partidoID: string;
  estado: string | null;
};

type PreviewPartido = {
  id: string;
  codigo: string | null;
  nombre: string | null;
  estado: string | null;
  tipo: string | null;
  publicado: boolean | null;
};

type PreviewEquipo = {
  id: string;
  nombre: string | null;
  plazaEstado: string | null;
  validacionEstado: string | null;
};

type PreviewVoluntario = {
  id: string;
  nombre: string;
  email: string | null;
  tipo: string | null;
  plazaEstado: string | null;
  validacionEstado: string | null;
};

type Preview = {
  resultados: PreviewResultado;

  actas: {
    actas: number;
    eventos: number;
    total: number;
    elementos: PreviewActa[];
  };

  partidos: {
    partidos: number;
    plazas: number;

    estados: {
      borrador: number;
      programados: number;
      enCurso: number;
      finalizados: number;
      suspendidos: number;
      cancelados: number;
    };

    elementos: PreviewPartido[];
  };

  equipos: {
    formularios: number;
    equipos: number;
    participantes: number;
    competicion: number;
    elementos: PreviewEquipo[];
  };

  voluntarios: {
    formularios: number;
    voluntarios: number;
    elementos: PreviewVoluntario[];
  };

  estructura: {
    fases: number;
    grupos: number;
    rondas: number;
    plazas: number;
    estadisticas: number;
    configuracion: number;

    fasesDetalle: Array<{
      id: string;
      nombre: string | null;
      tipo: string | null;
    }>;
  };

  edicionCompleta: {
    formularios: number;
    equipos: number;
    participantes: number;
    voluntarios: number;
    partidos: number;
    actas: number;
    eventos: number;
    resultados: number;
    estadisticasEquipo: number;
    estadisticasIndividuales: number;
    equiposCompeticion: number;
    fases: number;
    grupos: number;
    rondas: number;
    plazas: number;
    definicionesEstadisticas: number;
    configuracion: number;
  };
};

type Datos = {
  success: boolean;

  mensaje?: string;

  restringido?: boolean;

  edicion?: {
    id: string;
    nombre: string | null;
    estado: string | null;
  };

  preview?: Preview;
};

type RespuestaCodigo = {
  success: boolean;

  mensaje?: string;

  verificacioRequerida?: boolean;

  accion?: Accion;

  accionTexto?: string;

  email?: string;

  caducaAt?: string;
};

type RespuestaEliminar = {
  success: boolean;

  mensaje?: string;

  accion?: Accion;

  edicionEliminada?: boolean;

  antes?: Preview;

  despues?: Preview;
};

type Props = {
  torneoID: string;
  edicionID: string;
};

type PasoModal = "CONTRASENA" | "CODIGO";

// ============================================================
// CONFIGURACIÓN ACCIONES
// ============================================================

const ACCIONES: Array<{
  id: Accion;
  titulo: string;
  descripcion: string;
  peligroMaximo?: boolean;
}> = [
  {
    id: "RESULTADOS",
    titulo: "Eliminar resultats",
    descripcion:
      "Elimina els resultats i totes les estadístiques calculades de l'edició.",
  },
  {
    id: "ACTAS",
    titulo: "Eliminar actes",
    descripcion:
      "Elimina totes les actes, els seus esdeveniments i les dades derivades dels resultats.",
  },
  {
    id: "PARTIDOS",
    titulo: "Eliminar partits",
    descripcion:
      "Elimina tots els partits, actes, resultats, estadístiques i places associades als partits.",
  },
  {
    id: "EQUIPOS",
    titulo: "Eliminar equips",
    descripcion:
      "Elimina els equips inscrits, participants, formularis i la seva vinculació amb la competició.",
  },
  {
    id: "VOLUNTARIOS",
    titulo: "Eliminar voluntaris",
    descripcion:
      "Elimina els voluntaris i els formularis de voluntariat d'aquesta edició.",
  },
  {
    id: "EDICION",
    titulo: "Eliminar edició",
    descripcion:
      "Elimina definitivament l'edició i totes les dades vinculades. Aquesta operació no es pot desfer.",
    peligroMaximo: true,
  },
];

// ============================================================
// FORMATEAR
// ============================================================

function numero(valor: number) {
  return new Intl.NumberFormat("ca-ES").format(valor);
}

// ============================================================
// TOTAL POR ACCIÓN
// ============================================================

function totalAccion(preview: Preview, accion: Accion) {
  switch (accion) {
    case "RESULTADOS":
      return preview.resultados.total;

    case "ACTAS":
      return preview.actas.total + preview.resultados.total;

    case "PARTIDOS":
      return (
        preview.partidos.partidos +
        preview.partidos.plazas +
        preview.actas.total +
        preview.resultados.total
      );

    case "EQUIPOS":
      return (
        preview.equipos.formularios +
        preview.equipos.equipos +
        preview.equipos.participantes +
        preview.equipos.competicion +
        preview.estructura.plazas
      );

    case "VOLUNTARIOS":
      return preview.voluntarios.formularios + preview.voluntarios.voluntarios;

    case "EDICION": {
      const total = preview.edicionCompleta;

      return (
        1 +
        total.formularios +
        total.equipos +
        total.participantes +
        total.voluntarios +
        total.partidos +
        total.actas +
        total.eventos +
        total.resultados +
        total.estadisticasEquipo +
        total.estadisticasIndividuales +
        total.equiposCompeticion +
        total.fases +
        total.grupos +
        total.rondas +
        total.plazas +
        total.definicionesEstadisticas +
        total.configuracion
      );
    }
  }
}

// ============================================================
// FILA PREVIEW
// ============================================================

function FilaPreview({
  nombre,
  valor,
  importante = false,
}: {
  nombre: string;
  valor: number;
  importante?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-4 py-1.5 text-sm",

        importante ? "font-semibold text-neutral-titulos" : "text-neutral",
      ].join(" ")}
    >
      <span>{nombre}</span>

      <span
        className={[
          "shrink-0 font-semibold tabular-nums",

          importante ? "text-error" : "text-neutral-titulos",
        ].join(" ")}
      >
        {numero(valor)}
      </span>
    </div>
  );
}

// ============================================================
// LISTA ELEMENTOS
// ============================================================

function ListaElementos({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border/50 bg-background">
      <div className="divide-y divide-border/40">{children}</div>
    </div>
  );
}

// ============================================================
// PREVIEW RESULTADOS
// ============================================================

function PreviewResultados({ preview }: { preview: Preview }) {
  return (
    <div>
      <FilaPreview nombre="Resultats" valor={preview.resultados.resultados} />

      <FilaPreview
        nombre="Estadístiques d'equip"
        valor={preview.resultados.estadisticasEquipo}
      />

      <FilaPreview
        nombre="Estadístiques individuals"
        valor={preview.resultados.estadisticasIndividuales}
      />

      <div className="mt-2 border-t border-border/50 pt-2">
        <FilaPreview
          nombre="Registres eliminats"
          valor={preview.resultados.total}
          importante
        />
      </div>
    </div>
  );
}

// ============================================================
// PREVIEW ACTAS
// ============================================================

function PreviewActas({ preview }: { preview: Preview }) {
  return (
    <div>
      <FilaPreview nombre="Actes" valor={preview.actas.actas} />

      <FilaPreview
        nombre="Esdeveniments d'acta"
        valor={preview.actas.eventos}
      />

      <FilaPreview nombre="Resultats" valor={preview.resultados.resultados} />

      <FilaPreview
        nombre="Estadístiques d'equip"
        valor={preview.resultados.estadisticasEquipo}
      />

      <FilaPreview
        nombre="Estadístiques individuals"
        valor={preview.resultados.estadisticasIndividuales}
      />

      {preview.actas.elementos.length > 0 && (
        <ListaElementos>
          {preview.actas.elementos.map((acta) => (
            <div key={acta.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-neutral-titulos">
                  Acta
                </span>

                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {acta.estado || "Sense estat"}
                </span>
              </div>

              <p className="mt-1 break-all font-mono text-[10px] text-neutral">
                Partit: {acta.partidoID}
              </p>
            </div>
          ))}
        </ListaElementos>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW PARTIDOS
// ============================================================

function PreviewPartidos({ preview }: { preview: Preview }) {
  const estados = preview.partidos.estados;

  return (
    <div>
      <FilaPreview nombre="Partits" valor={preview.partidos.partidos} />

      <FilaPreview
        nombre="Places de competició"
        valor={preview.partidos.plazas}
      />

      <FilaPreview nombre="Actes" valor={preview.actas.actas} />

      <FilaPreview nombre="Esdeveniments" valor={preview.actas.eventos} />

      <FilaPreview nombre="Resultats" valor={preview.resultados.resultados} />

      <FilaPreview
        nombre="Estadístiques"
        valor={
          preview.resultados.estadisticasEquipo +
          preview.resultados.estadisticasIndividuales
        }
      />

      <div className="mt-3 rounded-lg bg-background px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral">
          Estat dels partits
        </p>

        <div className="mt-2 grid grid-cols-2 gap-x-4 xl:grid-cols-3">
          <FilaPreview nombre="Esborrany" valor={estados.borrador} />

          <FilaPreview nombre="Programats" valor={estados.programados} />

          <FilaPreview nombre="En curs" valor={estados.enCurso} />

          <FilaPreview nombre="Finalitzats" valor={estados.finalizados} />

          <FilaPreview nombre="Suspesos" valor={estados.suspendidos} />

          <FilaPreview nombre="Cancel·lats" valor={estados.cancelados} />
        </div>
      </div>

      {preview.partidos.elementos.length > 0 && (
        <ListaElementos>
          {preview.partidos.elementos.map((partido) => (
            <div key={partido.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-titulos">
                    {partido.nombre || partido.codigo || "Partit sense nom"}
                  </p>

                  {partido.codigo && partido.nombre && (
                    <p className="mt-0.5 text-xs text-neutral">
                      {partido.codigo}
                    </p>
                  )}
                </div>

                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {partido.estado || "Sense estat"}
                </span>
              </div>
            </div>
          ))}
        </ListaElementos>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW EQUIPOS
// ============================================================

function PreviewEquipos({ preview }: { preview: Preview }) {
  return (
    <div>
      <FilaPreview nombre="Equips" valor={preview.equipos.equipos} />

      <FilaPreview
        nombre="Participants"
        valor={preview.equipos.participantes}
      />

      <FilaPreview
        nombre="Formularis d'equip"
        valor={preview.equipos.formularios}
      />

      <FilaPreview
        nombre="Equips vinculats a competició"
        valor={preview.equipos.competicion}
      />

      <FilaPreview
        nombre="Places de competició"
        valor={preview.estructura.plazas}
      />

      {preview.equipos.elementos.length > 0 && (
        <ListaElementos>
          {preview.equipos.elementos.map((equipo) => (
            <div key={equipo.id} className="px-3 py-2.5">
              <p className="text-sm font-semibold text-neutral-titulos">
                {equipo.nombre || "Equip sense nom"}
              </p>

              <div className="mt-1 flex flex-wrap gap-1.5">
                {equipo.plazaEstado && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {equipo.plazaEstado}
                  </span>
                )}

                {equipo.validacionEstado && (
                  <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-semibold text-neutral">
                    {equipo.validacionEstado}
                  </span>
                )}
              </div>
            </div>
          ))}
        </ListaElementos>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW VOLUNTARIOS
// ============================================================

function PreviewVoluntarios({ preview }: { preview: Preview }) {
  return (
    <div>
      <FilaPreview
        nombre="Voluntaris"
        valor={preview.voluntarios.voluntarios}
      />

      <FilaPreview
        nombre="Formularis de voluntariat"
        valor={preview.voluntarios.formularios}
      />

      {preview.voluntarios.elementos.length > 0 && (
        <ListaElementos>
          {preview.voluntarios.elementos.map((voluntario) => (
            <div key={voluntario.id} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-titulos">
                    {voluntario.nombre || "Voluntari sense nom"}
                  </p>

                  {voluntario.email && (
                    <p className="mt-0.5 truncate text-xs text-neutral">
                      {voluntario.email}
                    </p>
                  )}
                </div>

                {voluntario.tipo && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {voluntario.tipo}
                  </span>
                )}
              </div>
            </div>
          ))}
        </ListaElementos>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW EDICIÓN
// ============================================================

function PreviewEdicion({ preview }: { preview: Preview }) {
  const total = preview.edicionCompleta;

  return (
    <div>
      <div className="grid gap-x-6 md:grid-cols-2">
        <div>
          <FilaPreview nombre="Equips" valor={total.equipos} />

          <FilaPreview nombre="Participants" valor={total.participantes} />

          <FilaPreview nombre="Voluntaris" valor={total.voluntarios} />

          <FilaPreview nombre="Formularis" valor={total.formularios} />

          <FilaPreview nombre="Partits" valor={total.partidos} />

          <FilaPreview nombre="Actes" valor={total.actas} />

          <FilaPreview nombre="Esdeveniments" valor={total.eventos} />
        </div>

        <div>
          <FilaPreview nombre="Resultats" valor={total.resultados} />

          <FilaPreview
            nombre="Estadístiques d'equip"
            valor={total.estadisticasEquipo}
          />

          <FilaPreview
            nombre="Estadístiques individuals"
            valor={total.estadisticasIndividuales}
          />

          <FilaPreview nombre="Fases" valor={total.fases} />

          <FilaPreview nombre="Grups" valor={total.grupos} />

          <FilaPreview nombre="Rondes" valor={total.rondas} />

          <FilaPreview nombre="Places" valor={total.plazas} />

          <FilaPreview nombre="Configuració" valor={total.configuracion} />
        </div>
      </div>

      {preview.estructura.fasesDetalle.length > 0 && (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral">
            Fases que s'eliminaran
          </p>

          <ListaElementos>
            {preview.estructura.fasesDetalle.map((fase) => (
              <div
                key={fase.id}
                className="flex items-center justify-between gap-4 px-3 py-2.5"
              >
                <span className="text-sm font-semibold text-neutral-titulos">
                  {fase.nombre || "Fase sense nom"}
                </span>

                {fase.tipo && (
                  <span className="text-xs text-neutral">{fase.tipo}</span>
                )}
              </div>
            ))}
          </ListaElementos>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW SEGÚN ACCIÓN
// ============================================================

function ContenidoPreview({
  accion,
  preview,
}: {
  accion: Accion;
  preview: Preview;
}) {
  switch (accion) {
    case "RESULTADOS":
      return <PreviewResultados preview={preview} />;

    case "ACTAS":
      return <PreviewActas preview={preview} />;

    case "PARTIDOS":
      return <PreviewPartidos preview={preview} />;

    case "EQUIPOS":
      return <PreviewEquipos preview={preview} />;

    case "VOLUNTARIOS":
      return <PreviewVoluntarios preview={preview} />;

    case "EDICION":
      return <PreviewEdicion preview={preview} />;
  }
}

// ============================================================
// CARD DE ACCIÓN
// ============================================================

function BloqueAccion({
  accion,
  titulo,
  descripcion,
  preview,
  deshabilitado,
  motivoBloqueo,
  peligroMaximo,
  onEliminar,
}: {
  accion: Accion;
  titulo: string;
  descripcion: string;
  preview: Preview;
  deshabilitado: boolean;
  motivoBloqueo?: string;
  peligroMaximo?: boolean;
  onEliminar: (accion: Accion) => void;
}) {
  const total = totalAccion(preview, accion);

  return (
    <section
      className={[
        "overflow-hidden rounded-2xl border bg-card shadow-sm",

        peligroMaximo ? "border-error/40" : "border-border/50",
      ].join(" ")}
    >
      {/* CABECERA */}

      <div
        className={["p-5 md:p-6", peligroMaximo ? "bg-error/[0.035]" : ""].join(
          " ",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {peligroMaximo && (
                <span className="rounded-full bg-error/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-error">
                  Perill màxim
                </span>
              )}

              <span className="text-xs font-semibold text-neutral">
                {numero(total)} registres afectats
              </span>
            </div>

            <h2
              className={[
                "mt-2 text-lg font-bold tracking-tight",

                peligroMaximo ? "text-error" : "text-neutral-titulos",
              ].join(" ")}
            >
              {titulo}
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-neutral">
              {descripcion}
            </p>
          </div>

          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => onEliminar(accion)}
            className={[
              "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",

              deshabilitado
                ? "cursor-not-allowed bg-neutral/10 text-neutral/50"
                : "bg-error text-white hover:opacity-90 active:scale-[0.98]",
            ].join(" ")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 6h18" />

              <path d="M8 6V4h8v2" />

              <path d="M19 6l-1 14H6L5 6" />

              <path d="M10 11v5" />

              <path d="M14 11v5" />
            </svg>

            {titulo}
          </button>
        </div>

        {motivoBloqueo && (
          <div className="mt-4 rounded-lg bg-error/10 px-3 py-2 text-xs font-medium text-error">
            {motivoBloqueo}
          </div>
        )}
      </div>

      {/* PREVIEW */}

      <div className="border-t border-border/50 bg-background/40 p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-titulos">
            S'eliminarà
          </p>

          <span className="text-xs text-neutral">Preview actual</span>
        </div>

        {total === 0 && accion !== "EDICION" ? (
          <div className="rounded-lg border border-border/50 bg-background px-4 py-4 text-sm text-neutral">
            No hi ha dades per eliminar.
          </div>
        ) : (
          <ContenidoPreview accion={accion} preview={preview} />
        )}
      </div>
    </section>
  );
}

// ============================================================
// MODAL
// ============================================================

function ModalConfirmacion({
  accion,
  paso,
  edicionNombre,
  email,
  contrasena,
  codigo,
  confirmacion,
  procesando,
  error,
  caducaAt,
  onCambiarContrasena,
  onCambiarCodigo,
  onCambiarConfirmacion,
  onCerrar,
  onSolicitarCodigo,
  onEliminar,
}: {
  accion: Accion;
  paso: PasoModal;

  edicionNombre: string;

  email: string;

  contrasena: string;
  codigo: string;
  confirmacion: string;

  procesando: boolean;

  error: string;

  caducaAt: string;

  onCambiarContrasena: (valor: string) => void;

  onCambiarCodigo: (valor: string) => void;

  onCambiarConfirmacion: (valor: string) => void;

  onCerrar: () => void;

  onSolicitarCodigo: () => void;

  onEliminar: () => void;
}) {
  const accionInfo = ACCIONES.find((elemento) => elemento.id === accion)!;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-eliminar-titulo"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        {/* HEADER */}

        <div className="flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-error">
              Operació destructiva
            </p>

            <h2
              id="modal-eliminar-titulo"
              className="mt-1 text-lg font-bold text-neutral-titulos"
            >
              {accionInfo.titulo}
            </h2>
          </div>

          <button
            type="button"
            disabled={procesando}
            onClick={onCerrar}
            className="rounded-lg p-2 text-neutral transition hover:bg-background hover:text-neutral-titulos disabled:opacity-40"
            aria-label="Tancar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18" />

              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* BODY */}

        <div className="overflow-y-auto p-5">
          <div className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
            Aquesta operació elimina dades de manera definitiva i no es pot
            desfer.
          </div>

          {/* PASSWORD */}

          {paso === "CONTRASENA" && (
            <div className="mt-5">
              <p className="text-sm text-neutral">
                Per continuar, introdueix la contrasenya del teu compte de
                desenvolupador.
              </p>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Contrasenya
                </span>

                <input
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  value={contrasena}
                  onChange={(evento) =>
                    onCambiarContrasena(evento.target.value)
                  }
                  onKeyDown={(evento) => {
                    if (evento.key === "Enter" && !procesando) {
                      onSolicitarCodigo();
                    }
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-error/50 focus:ring-2 focus:ring-error/10"
                />
              </label>
            </div>
          )}

          {/* CÓDIGO */}

          {paso === "CODIGO" && (
            <div className="mt-5">
              <p className="text-sm leading-relaxed text-neutral">
                S'ha enviat un codi de sis xifres a{" "}
                <strong className="text-neutral-titulos">{email}</strong>.
              </p>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-neutral-titulos">
                  Codi de verificació
                </span>

                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={codigo}
                  onChange={(evento) => {
                    const valor = evento.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);

                    onCambiarCodigo(valor);
                  }}
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-2xl font-bold tracking-[0.35em] text-neutral-titulos outline-none transition focus:border-error/50 focus:ring-2 focus:ring-error/10"
                />
              </label>

              {caducaAt && (
                <p className="mt-2 text-xs text-neutral">
                  El codi només és vàlid durant uns minuts.
                </p>
              )}

              {/* CONFIRMACIÓN EDICIÓN */}

              {accion === "EDICION" && (
                <div className="mt-5 border-t border-border/50 pt-5">
                  <p className="text-sm leading-relaxed text-neutral">
                    Per eliminar l'edició completa, escriu exactament:
                  </p>

                  <div className="mt-2 select-all rounded-lg bg-background px-3 py-2 font-mono text-sm font-bold text-error">
                    {edicionNombre}
                  </div>

                  <label className="mt-3 block">
                    <span className="text-xs font-semibold text-neutral-titulos">
                      Nom de l'edició
                    </span>

                    <input
                      type="text"
                      value={confirmacion}
                      onChange={(evento) =>
                        onCambiarConfirmacion(evento.target.value)
                      }
                      className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-neutral-titulos outline-none transition focus:border-error/50 focus:ring-2 focus:ring-error/10"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* ERROR */}

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-error/10 px-3 py-2.5 text-sm text-error"
            >
              {error}
            </div>
          )}
        </div>

        {/* FOOTER */}

        <div className="flex flex-col-reverse gap-2 border-t border-border/50 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={procesando}
            onClick={onCerrar}
            className="rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-neutral-titulos transition hover:bg-card disabled:opacity-50"
          >
            Cancel·lar
          </button>

          {paso === "CONTRASENA" ? (
            <button
              type="button"
              disabled={procesando || !contrasena}
              onClick={onSolicitarCodigo}
              className="rounded-lg bg-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {procesando
                ? "Verificant..."
                : "Verificar contrasenya i enviar codi"}
            </button>
          ) : (
            <button
              type="button"
              disabled={
                procesando ||
                codigo.length !== 6 ||
                (accion === "EDICION" && confirmacion !== edicionNombre)
              }
              onClick={onEliminar}
              className="rounded-lg bg-error px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {procesando
                ? "Eliminant..."
                : accion === "EDICION"
                  ? "ELIMINAR EDICIÓ"
                  : "Eliminar definitivament"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function EliminarDades({ torneoID, edicionID }: Props) {
  // ========================================================
  // DATOS
  // ========================================================

  const [datos, setDatos] = useState<Datos | null>(null);

  const [cargando, setCargando] = useState(true);

  const [errorCarga, setErrorCarga] = useState("");

  const [mensaje, setMensaje] = useState("");

  // ========================================================
  // MODAL
  // ========================================================

  const [accion, setAccion] = useState<Accion | null>(null);

  const [paso, setPaso] = useState<PasoModal>("CONTRASENA");

  const [contrasena, setContrasena] = useState("");

  const [codigo, setCodigo] = useState("");

  const [confirmacion, setConfirmacion] = useState("");

  const [email, setEmail] = useState("");

  const [caducaAt, setCaducaAt] = useState("");

  const [procesando, setProcesando] = useState(false);

  const [errorModal, setErrorModal] = useState("");

  // ========================================================
  // CARGAR
  // ========================================================

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);

      setErrorCarga("");

      try {
        const parametros = new URLSearchParams({
          torneoID,
          edicionID,
        });

        const respuesta = await fetch(
          `/api/panell/edicio/eliminar-dades?${parametros.toString()}`,
          {
            credentials: "same-origin",

            cache: "no-store",

            signal,
          },
        );

        const contenido: Datos = await respuesta.json();

        if (
          !respuesta.ok ||
          !contenido.success ||
          !contenido.preview ||
          !contenido.edicion
        ) {
          throw new Error(
            contenido.mensaje || "No s'han pogut carregar les dades.",
          );
        }

        if (!signal?.aborted) {
          setDatos(contenido);
        }
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        setErrorCarga(
          error instanceof Error
            ? error.message
            : "No s'han pogut carregar les dades.",
        );
      } finally {
        if (!signal?.aborted) {
          setCargando(false);
        }
      }
    },
    [torneoID, edicionID],
  );

  // ========================================================
  // INICIAL
  // ========================================================

  useEffect(() => {
    const controlador = new AbortController();

    void cargar(controlador.signal);

    return () => controlador.abort();
  }, [cargar]);

  // ========================================================
  // BLOQUEAR SCROLL MODAL
  // ========================================================

  useEffect(() => {
    if (!accion) {
      return;
    }

    const anterior = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = anterior;
    };
  }, [accion]);

  // ========================================================
  // NOMBRE EDICIÓN
  // ========================================================

  const edicionNombre = datos?.edicion?.nombre?.trim() || edicionID;

  // ========================================================
  // BLOQUEO EQUIPOS
  // ========================================================

  const bloqueoEquipos = useMemo(() => {
    if (!datos?.preview) {
      return false;
    }

    return (
      datos.preview.partidos.partidos > 0 ||
      datos.preview.actas.actas > 0 ||
      datos.preview.resultados.resultados > 0
    );
  }, [datos]);

  // ========================================================
  // ABRIR
  // ========================================================

  function abrir(nuevaAccion: Accion) {
    setAccion(nuevaAccion);

    setPaso("CONTRASENA");

    setContrasena("");

    setCodigo("");

    setConfirmacion("");

    setEmail("");

    setCaducaAt("");

    setErrorModal("");

    setMensaje("");
  }

  // ========================================================
  // CERRAR
  // ========================================================

  function cerrar() {
    if (procesando) {
      return;
    }

    setAccion(null);

    setErrorModal("");

    setContrasena("");

    setCodigo("");

    setConfirmacion("");
  }

  // ========================================================
  // SOLICITAR CÓDIGO
  // ========================================================

  async function solicitarCodigo() {
    if (!accion || procesando) {
      return;
    }

    if (!contrasena) {
      setErrorModal("Introdueix la contrasenya.");

      return;
    }

    setProcesando(true);

    setErrorModal("");

    try {
      const respuesta = await fetch("/api/panell/edicio/eliminar-dades", {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          torneoID,
          edicionID,
          accion,
          contrasena,
        }),
      });

      const contenido: RespuestaCodigo = await respuesta.json();

      if (!respuesta.ok || !contenido.success) {
        throw new Error(contenido.mensaje || "No s'ha pogut enviar el codi.");
      }

      setContrasena("");

      setCodigo("");

      setEmail(contenido.email ?? "");

      setCaducaAt(contenido.caducaAt ?? "");

      setPaso("CODIGO");
    } catch (error) {
      setErrorModal(
        error instanceof Error
          ? error.message
          : "No s'ha pogut enviar el codi.",
      );
    } finally {
      setProcesando(false);
    }
  }

  // ========================================================
  // ELIMINAR
  // ========================================================

  async function eliminar() {
    if (!accion || procesando) {
      return;
    }

    if (!/^\d{6}$/.test(codigo)) {
      setErrorModal("Introdueix el codi de 6 xifres.");

      return;
    }

    if (accion === "EDICION" && confirmacion !== edicionNombre) {
      setErrorModal(`Escriu exactament: ${edicionNombre}`);

      return;
    }

    setProcesando(true);

    setErrorModal("");

    try {
      const respuesta = await fetch("/api/panell/edicio/eliminar-dades", {
        method: "DELETE",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          torneoID,
          edicionID,
          accion,
          codigo,

          confirmacion: accion === "EDICION" ? confirmacion : undefined,
        }),
      });

      const contenido: RespuestaEliminar = await respuesta.json();

      if (!respuesta.ok || !contenido.success) {
        throw new Error(
          contenido.mensaje || "No s'ha pogut completar l'eliminació.",
        );
      }

      // =================================================
      // EDICIÓN COMPLETA
      // =================================================

      if (contenido.edicionEliminada) {
        window.location.href = `/panell?${new URLSearchParams({
          torneoID,
        }).toString()}`;

        return;
      }

      // =================================================
      // ACTUALIZAR PREVIEW
      // =================================================

      if (contenido.despues && datos) {
        setDatos({
          ...datos,

          preview: contenido.despues,
        });
      } else {
        await cargar();
      }

      setAccion(null);

      setCodigo("");

      setConfirmacion("");

      setMensaje(contenido.mensaje || "Les dades s'han eliminat correctament.");
    } catch (error) {
      setErrorModal(
        error instanceof Error
          ? error.message
          : "No s'ha pogut completar l'eliminació.",
      );
    } finally {
      setProcesando(false);
    }
  }

  // ========================================================
  // CARGANDO
  // ========================================================

  if (cargando && !datos) {
    return (
      <div className="w-full py-16">
        <Cargando />
      </div>
    );
  }

  // ========================================================
  // ERROR
  // ========================================================

  if (errorCarga && !datos) {
    return (
      <div className="rounded-2xl border border-error/20 bg-error/10 p-5">
        <h2 className="font-bold text-error">
          No s'ha pogut carregar la zona de perill
        </h2>

        <p className="mt-1 text-sm text-error">{errorCarga}</p>

        <button
          type="button"
          onClick={() => void cargar()}
          className="mt-4 rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white"
        >
          Tornar-ho a provar
        </button>
      </div>
    );
  }

  if (!datos?.preview || !datos.edicion) {
    return null;
  }

  const preview = datos.preview;

  // ========================================================
  // RENDER
  // ========================================================

  return (
    <>
      <div className="space-y-5">
        {/* AVISO */}

        <div className="rounded-2xl border border-error/30 bg-error/[0.04] p-5 md:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 9v4" />

                <path d="M12 17h.01" />

                <path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z" />
              </svg>
            </span>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-error">
                Zona de perill
              </p>

              <h2 className="mt-1 text-lg font-bold text-neutral-titulos">
                Eliminació definitiva de dades
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-relaxed text-neutral">
                Totes les accions d'aquesta pàgina són destructives. Cada
                eliminació exigeix la contrasenya actual del desenvolupador i un
                codi de verificació enviat per correu electrònic.
              </p>
            </div>
          </div>
        </div>

        {/* SUCCESS */}

        {mensaje && (
          <div
            role="status"
            className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-primary"
          >
            {mensaje}
          </div>
        )}

        {/* ERROR RECARGA */}

        {errorCarga && (
          <div
            role="alert"
            className="rounded-xl bg-error/10 px-4 py-3 text-sm text-error"
          >
            {errorCarga}
          </div>
        )}

        {/* ACCIONES */}

        {ACCIONES.map((elemento) => {
          const total = totalAccion(preview, elemento.id);

          const sinDatos = elemento.id !== "EDICION" && total === 0;

          const bloqueadoPorPartidos =
            elemento.id === "EQUIPOS" && bloqueoEquipos;

          return (
            <BloqueAccion
              key={elemento.id}
              accion={elemento.id}
              titulo={elemento.titulo}
              descripcion={elemento.descripcion}
              preview={preview}
              peligroMaximo={elemento.peligroMaximo}
              deshabilitado={sinDatos || bloqueadoPorPartidos}
              motivoBloqueo={
                bloqueadoPorPartidos
                  ? "Abans d'eliminar els equips has d'eliminar els partits, actes i resultats de l'edició."
                  : undefined
              }
              onEliminar={abrir}
            />
          );
        })}
      </div>

      {/* MODAL */}

      {accion && (
        <ModalConfirmacion
          accion={accion}
          paso={paso}
          edicionNombre={edicionNombre}
          email={email}
          contrasena={contrasena}
          codigo={codigo}
          confirmacion={confirmacion}
          procesando={procesando}
          error={errorModal}
          caducaAt={caducaAt}
          onCambiarContrasena={setContrasena}
          onCambiarCodigo={setCodigo}
          onCambiarConfirmacion={setConfirmacion}
          onCerrar={cerrar}
          onSolicitarCodigo={() => void solicitarCodigo()}
          onEliminar={() => void eliminar()}
        />
      )}
    </>
  );
}
