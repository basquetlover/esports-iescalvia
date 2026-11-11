import { useState } from "react";

import Calendari from "./Calendari";
import Resultats from "./Resultats";
import ActesActives from "./ActesActives";

// ============================================================
// TIPOS
// ============================================================

type Vista = "CALENDARI" | "RESULTATS" | "ACTES";

type Props = {
  torneoID: string;
  edicionID: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

type Pestana = {
  id: Vista;
  titulo: string;
  descripcion: string;
};

// ============================================================
// CONFIGURACIÓN DE PESTAÑAS
// ============================================================

const PESTANAS: Pestana[] = [
  {
    id: "CALENDARI",
    titulo: "Calendari",
    descripcion: "Programació dels partits",
  },
  {
    id: "RESULTATS",
    titulo: "Resultats",
    descripcion: "Resultats de la competició",
  },
  {
    id: "ACTES",
    titulo: "Actes en actiu",
    descripcion: "Supervisió de les actes",
  },
];

// ============================================================
// GESTOR PRINCIPAL
// ============================================================

export default function Gestor({
  torneoID,
  edicionID,
  supabaseUrl = "",
  supabaseAnonKey = "",
}: Props) {
  const [vista, setVista] = useState<Vista>("CALENDARI");

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 p-4 pt-0">
      {/* =====================================================
          SELECTOR DE APARTADOS
          ===================================================== */}

      <section className="overflow-hidden rounded-2xl border border-border/50 bg-card">
        <div className="p-3">
          <div
            role="tablist"
            aria-label="Apartats de gestió dels partits"
            className="grid grid-cols-3 gap-1 rounded-xl bg-background p-1"
          >
            {PESTANAS.map((pestana) => {
              const activa = vista === pestana.id;

              return (
                <button
                  key={pestana.id}
                  id={`pestana-${pestana.id.toLowerCase()}`}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  aria-controls={`contingut-${pestana.id.toLowerCase()}`}
                  onClick={() => setVista(pestana.id)}
                  className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center transition sm:px-4 ${
                    activa
                      ? "bg-card text-primary shadow-sm"
                      : "text-neutral hover:bg-card/50 hover:text-neutral-titulos"
                  }`}
                >
                  <span className="text-xs font-semibold sm:text-sm">
                    {pestana.titulo}
                  </span>

                  <span
                    className={`hidden text-[11px] lg:block ${
                      activa ? "text-primary/70" : "text-neutral"
                    }`}
                  >
                    {pestana.descripcion}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* =====================================================
          CALENDARIO
          ===================================================== */}

      {vista === "CALENDARI" && (
        <div
          id="contingut-calendari"
          role="tabpanel"
          aria-labelledby="pestana-calendari"
          className="w-full min-w-0"
        >
          <Calendari torneoID={torneoID} edicionID={edicionID} />
        </div>
      )}

      {/* =====================================================
          RESULTADOS
          ===================================================== */}

      {vista === "RESULTATS" && (
        <div
          id="contingut-resultats"
          role="tabpanel"
          aria-labelledby="pestana-resultats"
          className="w-full min-w-0"
        >
          <Resultats torneoID={torneoID} edicionID={edicionID} />
        </div>
      )}

      {/* =====================================================
          ACTAS ACTIVAS
          ===================================================== */}

      {vista === "ACTES" && (
        <div
          id="contingut-actes"
          role="tabpanel"
          aria-labelledby="pestana-actes"
          className="w-full min-w-0"
        >
          <ActesActives
            torneoID={torneoID}
            edicionID={edicionID}
            supabaseUrl={supabaseUrl}
            supabaseAnonKey={supabaseAnonKey}
          />
        </div>
      )}
    </div>
  );
}
