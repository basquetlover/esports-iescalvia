import { useRef, useState } from "react";

export default function CerrarSessio() {
    const [cerrando, setCerrando] = useState(false);
    const [error, setError] = useState("");
    const peticionEnCurso = useRef(false);

    async function cerrarSesion() {
        if (peticionEnCurso.current) return;

        peticionEnCurso.current = true;
        setCerrando(true);
        setError("");

        try {
            const respuesta = await fetch("/api/sesiones/cerrar", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                },
            });

            const contenido =
                respuesta.headers.get("content-type") ?? "";

            if (!contenido.includes("application/json")) {
                throw new Error(
                    "El servidor no ha retornat una resposta vàlida."
                );
            }

            const resultado = await respuesta.json();

            if (!respuesta.ok || resultado?.success !== true) {
                throw new Error(
                    typeof resultado?.mensaje === "string"
                        ? resultado.mensaje
                        : "No s'ha pogut tancar la sessió."
                );
            }

            window.location.replace("/");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "No s'ha pogut tancar la sessió. Torna-ho a provar."
            );

            peticionEnCurso.current = false;
            setCerrando(false);
        }
    }

    return (
        <div className="flex w-full flex-col items-center gap-2">
            <button
                type="button"
                onClick={() => void cerrarSesion()}
                disabled={cerrando}
                aria-busy={cerrando}
                className="flex cursor-pointer w-full items-center justify-center gap-x-2 rounded-md text-secondary-variant transition hover:text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary disabled:cursor-wait disabled:opacity-60"
            >
                {cerrando ? (
                    <span
                        className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                        aria-hidden="true"
                    />
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 fill-current"
                        viewBox="0 -960 960 960"
                        aria-hidden="true"
                    >
                        <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200z" />
                    </svg>
                )}

                <span aria-live="polite">
                    {cerrando ? "Tancant sessió..." : "Tancar sessió"}
                </span>
            </button>

            {error && (
                <p
                    className="text-center text-xs text-error"
                    role="alert"
                >
                    {error}
                </p>
            )}
        </div>
    );
}