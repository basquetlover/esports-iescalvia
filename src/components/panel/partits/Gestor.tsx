import { useState } from "react";

import Calendari from "./Calendari";
import Resultats from "./Resultats";

type Vista = "CALENDARI" | "RESULTATS";

type Props = {
  torneoID: string;
  edicionID: string;
};

export default function Gestor({ torneoID, edicionID }: Props) {
  const [vista, setVista] = useState<Vista>("CALENDARI");

  return (
    <div className="flex w-full flex-col gap-5 p-4 pt-0">
      <section className="rounded-2xl border border-border/50 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex gap-1 rounded-xl bg-background p-1">
            <button
              type="button"
              onClick={() => setVista("CALENDARI")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                vista === "CALENDARI"
                  ? "bg-card text-primary shadow-sm"
                  : "text-neutral hover:text-neutral-titulos"
              }`}
            >
              Calendari
            </button>

            <button
              type="button"
              onClick={() => setVista("RESULTATS")}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                vista === "RESULTATS"
                  ? "bg-card text-primary shadow-sm"
                  : "text-neutral hover:text-neutral-titulos"
              }`}
            >
              Resultats
            </button>
          </div>
        </div>
      </section>

      {vista === "CALENDARI" ? (
        <Calendari torneoID={torneoID} edicionID={edicionID} />
      ) : (
        <Resultats torneoID={torneoID} edicionID={edicionID} />
      )}
    </div>
  );
}
