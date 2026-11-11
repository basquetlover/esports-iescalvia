import { useCallback, useEffect, useRef, useState } from "react";

import { createPortal } from "react-dom";

import Gestor from "@components/panel/acta/Gestor";

import PantallaBloqueigRealtime from "@components/acta/PantallaBloqueigRealtime";

import { obtenerClaveActaLocal } from "@utils/acta/localStorage";

type Props = {
  partidoID: string;
  torneoID: string;
  edicionID: string;
};

export default function GestorAmbBloqueig({
  partidoID,
  torneoID,
  edicionID,
}: Props) {
  const [version, setVersion] = useState(0);

  const [sincronizando, setSincronizando] = useState(false);

  const [error, setError] = useState("");

  const sincronizacionRef = useRef(false);

  // ==========================================================
  // RECONCILIACIÓN DESPUÉS DEL DESBLOQUEO
  // ==========================================================

  const reconciliar = useCallback(async () => {
    if (sincronizacionRef.current) {
      return;
    }

    sincronizacionRef.current = true;
    setSincronizando(true);
    setError("");

    try {
      // Antes de sustituir los datos locales,
      // comprobar que la lectura oficial funciona.
      const respuesta = await fetch(
        `/api/panell/acta/eventos?partidoID=${encodeURIComponent(partidoID)}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        },
      );

      const datos = await respuesta.json();

      if (
        !respuesta.ok ||
        datos.success !== true ||
        !Array.isArray(datos.eventos)
      ) {
        throw new Error(
          datos.mensaje ?? "No s'ha pogut recuperar l'acta del servidor.",
        );
      }

      // La copia de los eventos de Supabase prevalece.
      // Se descarta la cola local de este partido.
      window.localStorage.removeItem(obtenerClaveActaLocal(partidoID));

      // Reconstruir la interfaz desde las APIs
      // existentes, sin abandonar la página.
      setVersion((valor) => valor + 1);
    } catch (fallo) {
      setError(
        fallo instanceof Error
          ? fallo.message
          : "No s'ha pogut sincronitzar l'acta.",
      );
    } finally {
      sincronizacionRef.current = false;
      setSincronizando(false);
    }
  }, [partidoID]);

  // ==========================================================
  // EVENTO DE DESBLOQUEO
  // ==========================================================

  useEffect(() => {
    const escoltar = (event: Event) => {
      const detall = (event as CustomEvent<{ partidoID?: string }>).detail;

      if (detall?.partidoID !== partidoID) {
        return;
      }

      void reconciliar();
    };

    window.addEventListener("acta:reconciliar-servidor", escoltar);

    return () => {
      window.removeEventListener("acta:reconciliar-servidor", escoltar);
    };
  }, [partidoID, reconciliar]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <PantallaBloqueigRealtime
        mode="gestor"
        torneoID={torneoID}
        edicionID={edicionID}
        partidoID={partidoID}
      >
        <Gestor
          key={version}
          torneoID={torneoID}
          edicionID={edicionID}
          partidoID={partidoID}
        />
      </PantallaBloqueigRealtime>

      {typeof document !== "undefined" &&
        (sincronizando || error) &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 p-5 text-white"
          >
            <div className="w-full max-w-md text-center">
              <h2 className="text-2xl font-bold">
                {error ? "Error de sincronització" : "Sincronitzant l'acta"}
              </h2>

              <p className="mt-4 text-sm leading-6 text-white/75">
                {error || "Recuperant les dades oficials del servidor..."}
              </p>

              {error && (
                <button
                  type="button"
                  onClick={() => void reconciliar()}
                  className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black"
                >
                  Tornar a intentar
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
