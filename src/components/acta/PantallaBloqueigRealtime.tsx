import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { createPortal } from "react-dom";
import { createClient } from "@supabase/supabase-js";

type Mode = "gestor" | "voluntari";

type Props = {
  partidoID: string;
  torneoID: string;
  edicionID: string;
  mode: Mode;
  children: ReactNode;
};

type Estat = {
  success: boolean;
  existeix: boolean;
  bloqueada: boolean;
  estat: string | null;
  estatOperatiu: string | null;
  motiu: string | null;
  potBloquejar: boolean;
  potDesbloquejar: boolean;
  mensaje?: string;
};

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export default function PantallaBloqueigRealtime({
  partidoID,
  torneoID,
  edicionID,
  mode,
  children,
}: Props) {
  const [estat, setEstat] = useState<Estat | null>(null);
  const [error, setError] = useState("");
  const [errorAccio, setErrorAccio] = useState("");
  const [revisio, setRevisio] = useState(0);
  const [executant, setExecutant] = useState(false);
  const [formulari, setFormulari] = useState(false);
  const [motiu, setMotiu] = useState("");
  const [realtimeConnectat, setRealtimeConnectat] = useState(false);

  const contingutRef = useRef<HTMLDivElement>(null);

  const bloqueigAnteriorRef = useRef<boolean | null>(null);

  const actualitzar = useCallback(() => {
    setRevisio((valor) => valor + 1);
  }, []);

  const urlBase =
    mode === "gestor"
      ? "/api/panell/acta/bloqueo"
      : "/api/perfil/voluntariat/acta/estado";

  const parametros = useMemo(
    () =>
      new URLSearchParams({
        torneoID,
        edicionID,
        partidoID,
      }).toString(),
    [torneoID, edicionID, partidoID],
  );

  // ==========================================================
  // REALTIME
  // ==========================================================

  useEffect(() => {
    const url = import.meta.env.PUBLIC_SUPABASE_URL;
    const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setRealtimeConnectat(false);
      return;
    }

    const cliente = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    let activo = true;

    const canal = cliente
      .channel(`acta-estat-partit-${partidoID}`)
      .on("broadcast", { event: "actualitzada" }, () => {
        if (activo) actualitzar();
      })
      .subscribe((estado) => {
        if (!activo) return;

        const conectado = estado === "SUBSCRIBED";

        setRealtimeConnectat(conectado);

        if (conectado) {
          actualitzar();
        }
      });

    return () => {
      activo = false;
      void cliente.removeChannel(canal);
    };
  }, [partidoID, actualitzar]);

  // ==========================================================
  // CONSULTA AL SERVIDOR
  // ==========================================================

  useEffect(() => {
    const controlador = new AbortController();

    async function carregar() {
      try {
        const resposta = await fetch(`${urlBase}?${parametros}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controlador.signal,
        });

        const contingut = (await resposta.json()) as Estat;

        if (!resposta.ok || contingut.success !== true) {
          throw new Error(
            contingut.mensaje ?? "No s'ha pogut verificar l'estat de l'acta.",
          );
        }

        if (controlador.signal.aborted) return;

        const estabaBloqueada = bloqueigAnteriorRef.current;

        setEstat(contingut);
        setError("");

        bloqueigAnteriorRef.current = contingut.bloqueada;

        // El gestor ha desbloqueado el acta.
        // Recuperar los datos oficiales antes
        // de continuar con los datos locales.
        if (estabaBloqueada === true && !contingut.bloqueada) {
          window.dispatchEvent(
            new CustomEvent("acta:reconciliar-servidor", {
              detail: { partidoID },
            }),
          );
        }
      } catch (err) {
        if (controlador.signal.aborted) return;

        setEstat(null);

        setError(
          err instanceof Error
            ? err.message
            : "No s'ha pogut consultar l'acta.",
        );
      }
    }

    void carregar();

    return () => controlador.abort();
  }, [urlBase, parametros, revisio, partidoID]);

  // ==========================================================
  // RECUPERACIÓN DE CONEXIÓN
  // ==========================================================

  useEffect(() => {
    const recuperar = () => actualitzar();

    window.addEventListener("online", recuperar);
    window.addEventListener("focus", recuperar);

    return () => {
      window.removeEventListener("online", recuperar);
      window.removeEventListener("focus", recuperar);
    };
  }, [actualitzar]);

  // ==========================================================
  // PROTECCIÓN DE LA INTERFAZ
  // ==========================================================

  const bloqueada = !estat || estat.bloqueada || Boolean(error);

  useEffect(() => {
    const elemento = contingutRef.current;

    if (!elemento) return;

    elemento.inert = bloqueada;

    return () => {
      elemento.inert = false;
    };
  }, [bloqueada]);

  // ==========================================================
  // ACCIONES ADMINISTRATIVAS
  // ==========================================================

  async function executarAccio(accion: "bloquear" | "desbloquear") {
    if (mode !== "gestor" || executant) return;

    setExecutant(true);
    setErrorAccio("");

    try {
      const resposta = await fetch("/api/panell/acta/bloqueo", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          torneoID,
          edicionID,
          partidoID,
          accion,
          ...(accion === "bloquear" ? { motivo: motiu.trim() } : {}),
        }),
      });

      const contingut = await resposta.json();

      if (!resposta.ok || contingut.success !== true) {
        throw new Error(
          contingut.mensaje ?? "No s'ha pogut modificar el bloqueig.",
        );
      }

      setFormulari(false);
      setMotiu("");

      actualitzar();
    } catch (err) {
      setErrorAccio(
        err instanceof Error ? err.message : "No s'ha pogut completar l'acció.",
      );
    } finally {
      setExecutant(false);
    }
  }

  // ==========================================================
  // PANTALLA DE BLOQUEO
  // ==========================================================

  const pantallaBloqueig = bloqueada ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titol-bloqueig-acta"
      className="fixed inset-0 z-[99999] flex min-h-dvh items-center justify-center overflow-y-auto bg-black/90 px-4 py-8 text-white backdrop-blur-md"
    >
      <div className="w-full max-w-xl text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10"
            aria-hidden="true"
          >
            <rect x="5" y="10" width="14" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
          {estat?.bloqueada
            ? "Bloqueig de l'organització"
            : "Verificant l'accés"}
        </p>

        <h1
          id="titol-bloqueig-acta"
          className="mt-3 text-3xl font-bold sm:text-4xl"
        >
          {estat?.bloqueada
            ? "Acta bloquejada"
            : error
              ? "No es pot verificar l'acta"
              : "Comprovant l'acta"}
        </h1>

        <p className="mx-auto mt-5 max-w-md text-base leading-7 text-white/80">
          {estat?.bloqueada
            ? estat.motiu ||
              "L'organització ha bloquejat temporalment aquesta acta."
            : error || "S'està consultant l'estat oficial de l'acta."}
        </p>

        {estat?.bloqueada && (
          <p className="mt-5 text-sm text-white/50">
            L'acta continua oberta. No s'ha tancat ni finalitzat.
          </p>
        )}

        {mode === "gestor" && estat?.bloqueada && estat.potDesbloquejar && (
          <button
            type="button"
            disabled={executant}
            onClick={() => void executarAccio("desbloquear")}
            className={`${BTN} mt-8 bg-white text-black hover:bg-white/90`}
          >
            {executant ? "Desbloquejant..." : "Desbloquejar acta"}
          </button>
        )}

        {errorAccio && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {errorAccio}
          </p>
        )}

        {error && (
          <button
            type="button"
            onClick={actualitzar}
            className={`${BTN} mt-6 border border-white/30`}
          >
            Tornar a comprovar
          </button>
        )}

        <p className="mt-6 text-xs text-white/40">
          {realtimeConnectat
            ? "Connexió en temps real activa"
            : "Realtime no disponible"}
        </p>
      </div>
    </div>
  ) : null;

  // ==========================================================
  // BOTÓN DEL GESTOR
  // ==========================================================

  const puedeMostrarBloqueo =
    mode === "gestor" &&
    estat &&
    estat.existeix &&
    !estat.bloqueada &&
    estat.potBloquejar &&
    ["DISPONIBLE", "CONTROLADA", "EN_SUPERVISION"].includes(
      estat.estatOperatiu ?? "",
    );

  const botonGestor = puedeMostrarBloqueo ? (
    <div className="fixed bottom-5 right-5 z-[9000]">
      <button
        type="button"
        onClick={() => setFormulari(true)}
        className={`${BTN} bg-amber-600 text-white shadow-xl hover:bg-amber-700`}
      >
        Bloquejar acta
      </button>
    </div>
  ) : null;

  // ==========================================================
  // MODAL MOTIVO
  // ==========================================================

  const modalMotivo =
    mode === "gestor" && formulari && !bloqueada ? (
      <div className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/70 p-4">
        <section className="w-full max-w-md rounded-2xl bg-card p-6 text-neutral-titulos shadow-2xl">
          <h2 className="text-xl font-bold">Bloquejar acta</h2>

          <p className="mt-2 text-sm text-neutral">
            El motiu apareixerà a la pantalla dels usuaris que tinguin l'acta
            oberta.
          </p>

          <label
            htmlFor="motiu-bloqueig-acta"
            className="mt-5 block text-sm font-semibold"
          >
            Motiu del bloqueig
          </label>

          <textarea
            id="motiu-bloqueig-acta"
            value={motiu}
            onChange={(e) => setMotiu(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Escriu el motiu..."
            className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"
          />

          {errorAccio && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {errorAccio}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={executant}
              onClick={() => setFormulari(false)}
              className={`${BTN} border border-border`}
            >
              Cancel·lar
            </button>

            <button
              type="button"
              disabled={executant || !motiu.trim()}
              onClick={() => void executarAccio("bloquear")}
              className={`${BTN} bg-amber-600 text-white`}
            >
              {executant ? "Bloquejant..." : "Confirmar bloqueig"}
            </button>
          </div>
        </section>
      </div>
    ) : null;

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <div ref={contingutRef}>{children}</div>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            {pantallaBloqueig}
            {botonGestor}
            {modalMotivo}
          </>,
          document.body,
        )}
    </>
  );
}
