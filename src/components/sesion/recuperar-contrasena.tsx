import Enviando from "@components/Enviando";

import { useEffect, useState } from "react";

// ============================================================
// TIPOS
// ============================================================

type Props = {
  token_recuperar: string | null;
};

type EstadoToken = "SIN_TOKEN" | "COMPROBANDO" | "VALIDO" | "INVALIDO";

type RespuestaAPI = {
  success: boolean;

  mensaje?: string;

  valido?: boolean;

  sesionIniciada?: boolean;

  redirect?: string;
};

type ErrorFormulario = {
  campo: "email" | "contrasena" | "contrasena2" | "general";

  mensaje: string;
};

// ============================================================
// COMPONENTE
// ============================================================

export default function RecuperarContrasena({ token_recuperar }: Props) {
  // ========================================================
  // RECUPERACIÓN POR EMAIL
  // ========================================================

  const [email, setEmail] = useState("");

  const [correoSolicitado, setCorreoSolicitado] = useState(false);

  // ========================================================
  // TOKEN
  // ========================================================

  const [estadoToken, setEstadoToken] = useState<EstadoToken>(
    token_recuperar ? "COMPROBANDO" : "SIN_TOKEN",
  );

  const [mensajeToken, setMensajeToken] = useState("");

  // ========================================================
  // CONTRASEÑAS
  // ========================================================

  const [contrasena, setContrasena] = useState("");

  const [contrasena2, setContrasena2] = useState("");

  const [mostrarPassword, setMostrarPassword] = useState(false);

  const [mostrarPassword2, setMostrarPassword2] = useState(false);

  // ========================================================
  // ESTADO GENERAL
  // ========================================================

  const [enviando, setEnviando] = useState(false);

  const [error, setError] = useState<ErrorFormulario | null>(null);

  const [restablecida, setRestablecida] = useState(false);

  // ========================================================
  // COMPROBAR TOKEN
  // ========================================================

  useEffect(() => {
    if (!token_recuperar) {
      setEstadoToken("SIN_TOKEN");

      return;
    }

    // Guardamos el token ya validado como string.
    // Así TypeScript sabe que nunca será null.
    const tokenActual = token_recuperar;

    const controlador = new AbortController();

    async function comprobar() {
      setEstadoToken("COMPROBANDO");

      setMensajeToken("");

      try {
        const parametros = new URLSearchParams({
          token: tokenActual,
        });

        const respuesta = await fetch(
          `/api/sesiones/restablecer-contrasena?${parametros.toString()}`,
          {
            method: "GET",

            credentials: "same-origin",

            cache: "no-store",

            signal: controlador.signal,
          },
        );

        const resultado = (await respuesta.json()) as RespuestaAPI;

        if (!respuesta.ok || !resultado.success || resultado.valido !== true) {
          setEstadoToken("INVALIDO");

          setMensajeToken(
            resultado.mensaje || "Aquest enllaç de recuperació ja no és vàlid.",
          );

          return;
        }

        setEstadoToken("VALIDO");
      } catch (errorPeticion) {
        if (controlador.signal.aborted) {
          return;
        }

        console.error("Error comprovant el token:", errorPeticion);

        setEstadoToken("INVALIDO");

        setMensajeToken("No s'ha pogut comprovar l'enllaç de recuperació.");
      }
    }

    void comprobar();

    return () => {
      controlador.abort();
    };
  }, [token_recuperar]);

  // ========================================================
  // VALIDAR EMAIL
  // ========================================================

  function validarEmail() {
    const normalizado = email.trim();

    if (!normalizado) {
      setError({
        campo: "email",

        mensaje: "El correu electrònic és obligatori.",
      });

      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) {
      setError({
        campo: "email",

        mensaje: "Introdueix un correu electrònic vàlid.",
      });

      return false;
    }

    return true;
  }

  // ========================================================
  // SOLICITAR EMAIL
  // ========================================================

  async function enviarFormEmail() {
    if (enviando || correoSolicitado) {
      return;
    }

    setError(null);

    if (!validarEmail()) {
      return;
    }

    setEnviando(true);

    try {
      const respuesta = await fetch("/api/sesiones/enviar-email", {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          email: email.trim(),
        }),
      });

      const resultado = (await respuesta.json()) as RespuestaAPI;

      if (!respuesta.ok || !resultado.success) {
        setError({
          campo: "general",

          mensaje:
            resultado.mensaje || "No s'ha pogut processar la sol·licitud.",
        });

        return;
      }

      /*
       * La resposta és genèrica independentment de
       * si existeix o no el compte.
       */

      setCorreoSolicitado(true);
    } catch (errorPeticion) {
      console.error("Error sol·licitant recuperació:", errorPeticion);

      setError({
        campo: "general",

        mensaje: "No s'ha pogut connectar amb el servidor.",
      });
    } finally {
      setEnviando(false);
    }
  }

  // ========================================================
  // RESTABLECER CONTRASEÑA
  // ========================================================

  async function enviarFormCambio() {
    if (enviando || !token_recuperar) {
      return;
    }

    setError(null);

    // ====================================================
    // CONTRASEÑA
    // ====================================================

    if (!contrasena) {
      setError({
        campo: "contrasena",

        mensaje: "La contrasenya és obligatòria.",
      });

      return;
    }

    // ====================================================
    // CONFIRMACIÓN
    // ====================================================

    if (!contrasena2) {
      setError({
        campo: "contrasena2",

        mensaje: "Confirma la nova contrasenya.",
      });

      return;
    }

    // ====================================================
    // COINCIDENCIA
    // ====================================================

    if (contrasena !== contrasena2) {
      setError({
        campo: "contrasena2",

        mensaje: "Les dues contrasenyes no coincideixen.",
      });

      return;
    }

    // ====================================================
    // LONGITUD MÁXIMA
    // ====================================================

    if (contrasena.length > 500) {
      setError({
        campo: "contrasena",

        mensaje: "La contrasenya introduïda no és vàlida.",
      });

      return;
    }

    setEnviando(true);

    try {
      const respuesta = await fetch("/api/sesiones/restablecer-contrasena", {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          contrasena,

          contrasena2,

          token_recuperar: token_recuperar,
        }),
      });

      const resultado = (await respuesta.json()) as RespuestaAPI;

      if (!respuesta.ok || !resultado.success) {
        /*
         * Los 410 significan normalmente:
         *
         * - token caducado
         * - token utilizado
         * - token invalidado
         */

        if (respuesta.status === 410) {
          setEstadoToken("INVALIDO");

          setMensajeToken(resultado.mensaje || "Aquest enllaç ja no és vàlid.");

          return;
        }

        setError({
          campo: "general",

          mensaje:
            resultado.mensaje || "No s'ha pogut restablir la contrasenya.",
        });

        return;
      }

      // =================================================
      // ÉXITO
      // =================================================

      setRestablecida(true);

      setContrasena("");

      setContrasena2("");

      /*
       * Si crearSesion() funcionó, iremos a "/".
       *
       * Si la contraseña cambió pero no pudo iniciarse
       * automáticamente la sesión, iremos al login.
       */

      window.location.href =
        resultado.redirect ||
        (resultado.sesionIniciada ? "/" : "/iniciar-sessio");
    } catch (errorPeticion) {
      console.error("Error restablint contrasenya:", errorPeticion);

      setError({
        campo: "general",

        mensaje: "No s'ha pogut connectar amb el servidor.",
      });
    } finally {
      setEnviando(false);
    }
  }

  // ========================================================
  // ENTER
  // ========================================================

  function gestionarEnterEmail(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Enter") {
      evento.preventDefault();

      void enviarFormEmail();
    }
  }

  function gestionarEnterPassword(
    evento: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (evento.key === "Enter") {
      evento.preventDefault();

      void enviarFormCambio();
    }
  }

  // ========================================================
  // COMPROBANDO TOKEN
  // ========================================================

  if (estadoToken === "COMPROBANDO") {
    return (
      <div
        className="
                    w-full
                    my-5
                    rounded-2xl
                    border
                    border-border
                    bg-muted/40
                    p-6
                "
      >
        <div
          className="
                        flex
                        flex-col
                        items-center
                        justify-center
                        gap-4
                        py-8
                        text-center
                    "
        >
          <div
            className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-full
                            bg-primary/10
                            text-primary
                        "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              className="h-6 w-6 fill-current"
              aria-hidden="true"
            >
              <path
                d="
                                    M480-80
                                    q-83 0-156-31.5
                                    T197-197
                                    t-85.5-127
                                    T80-480
                                    q0-83 31.5-156
                                    T197-763
                                    t127-85.5
                                    T480-880
                                    q83 0 156 31.5
                                    T763-763
                                    t85.5 127
                                    T880-480
                                    q0 83-31.5 156
                                    T763-197
                                    t-127 85.5
                                    T480-80
                                    m0-80
                                    q134 0 227-93
                                    t93-227
                                    q0-134-93-227
                                    t-227-93
                                    q-134 0-227 93
                                    t-93 227
                                    q0 134 93 227
                                    t227 93
                                    m-40-160
                                    h80v-200h-80zm0-280
                                    q17 0 28.5-11.5
                                    T520-600
                                    t-11.5-28.5
                                    T480-640
                                    t-28.5 11.5
                                    T440-600
                                    t11.5 28.5
                                    T480-560
                                "
              />
            </svg>
          </div>

          <div>
            <h1
              className="
                                text-xl
                                font-bold
                                text-neutral-titulos
                            "
            >
              Comprovant l'enllaç
            </h1>

            <p
              className="
                                mt-1
                                text-sm
                                text-neutral
                            "
            >
              Estam comprovant que l'enllaç de recuperació encara sigui vàlid.
            </p>
          </div>
        </div>

        <Enviando />
      </div>
    );
  }

  // ========================================================
  // TOKEN INVÁLIDO
  // ========================================================

  if (estadoToken === "INVALIDO") {
    return (
      <div
        className="
                    w-full
                    my-5
                    space-y-5
                    rounded-2xl
                    border
                    border-border
                    bg-muted/40
                    p-5
                "
      >
        <div
          className="
                        flex
                        flex-col
                        items-center
                        text-center
                    "
        >
          <div
            className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-full
                            bg-error/10
                            text-error
                        "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              className="h-6 w-6 fill-current"
              aria-hidden="true"
            >
              <path
                d="
                                    M480-280
                                    q17 0 28.5-11.5
                                    T520-320
                                    t-11.5-28.5
                                    T480-360
                                    t-28.5 11.5
                                    T440-320
                                    t11.5 28.5
                                    T480-280
                                    m-40-160
                                    h80v-240h-80zm40 360
                                    q-83 0-156-31.5
                                    T197-197
                                    t-85.5-127
                                    T80-480
                                    q0-83 31.5-156
                                    T197-763
                                    t127-85.5
                                    T480-880
                                    q83 0 156 31.5
                                    T763-763
                                    t85.5 127
                                    T880-480
                                    q0 83-31.5 156
                                    T763-197
                                    t-127 85.5
                                    T480-80
                                    m0-80
                                    q134 0 227-93
                                    t93-227
                                    q0-134-93-227
                                    t-227-93
                                    q-134 0-227 93
                                    t-93 227
                                    q0 134 93 227
                                    t227 93
                                "
              />
            </svg>
          </div>

          <h1
            className="
                            mt-4
                            text-2xl
                            font-bold
                            text-neutral-titulos
                        "
          >
            Enllaç no disponible
          </h1>

          <p
            className="
                            mt-2
                            max-w-md
                            text-sm
                            leading-relaxed
                            text-neutral
                        "
          >
            {mensajeToken || "Aquest enllaç de recuperació ja no és vàlid."}
          </p>
        </div>

        <div
          className="
                        rounded-xl
                        border
                        border-border
                        bg-background/50
                        p-4
                        text-sm
                        leading-relaxed
                        text-neutral
                    "
        >
          Els enllaços de recuperació tenen una validesa de 15 minuts i només es
          poden utilitzar una vegada.
        </div>

        <a
          href="/recupera-contrasena"
          className="
                        flex
                        w-full
                        items-center
                        justify-center
                        rounded-xl
                        bg-primary
                        px-5
                        py-3
                        font-semibold
                        text-secondary-variant
                        transition
                        hover:opacity-90
                    "
        >
          Sol·licitar un nou enllaç
        </a>

        <a
          href="/iniciar-sessio"
          className="
                        block
                        text-center
                        text-sm
                        font-semibold
                        text-secondary
                        hover:underline
                    "
        >
          Tornar a iniciar sessió
        </a>
      </div>
    );
  }

  // ========================================================
  // SIN TOKEN — EMAIL ENVIADO
  // ========================================================

  if (estadoToken === "SIN_TOKEN" && correoSolicitado) {
    return (
      <div
        className="
                    w-full
                    my-5
                    space-y-5
                    rounded-2xl
                    border
                    border-border
                    bg-muted/40
                    p-5
                "
      >
        <div
          className="
                        flex
                        flex-col
                        items-center
                        text-center
                    "
        >
          <div
            className="
                            flex
                            h-12
                            w-12
                            items-center
                            justify-center
                            rounded-full
                            bg-primary/10
                            text-primary
                        "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              className="h-6 w-6 fill-current"
              aria-hidden="true"
            >
              <path
                d="
                                    M160-160
                                    q-33 0-56.5-23.5
                                    T80-240
                                    v-480
                                    q0-33 23.5-56.5
                                    T160-800
                                    h640
                                    q33 0 56.5 23.5
                                    T880-720
                                    v480
                                    q0 33-23.5 56.5
                                    T800-160zm320-280
                                    L160-640
                                    v400h640v-400zm0-80
                                    320-200H160zm-320-120v-80
                                    80 80-80 80
                                    80-80-80-80v80z
                                "
              />
            </svg>
          </div>

          <h1
            className="
                            mt-4
                            text-2xl
                            font-bold
                            text-neutral-titulos
                        "
          >
            Revisa el teu correu
          </h1>

          <p
            className="
                            mt-2
                            max-w-md
                            text-sm
                            leading-relaxed
                            text-neutral
                        "
          >
            Si existeix un compte associat a aquest correu electrònic, rebràs un
            missatge amb les instruccions per restablir la contrasenya.
          </p>
        </div>

        <div
          className="
                        rounded-xl
                        border
                        border-border
                        bg-background/50
                        p-4
                    "
        >
          <p
            className="
                            text-sm
                            font-semibold
                            text-neutral-titulos
                        "
          >
            L'enllaç serà vàlid durant 15 minuts.
          </p>

          <p
            className="
                            mt-1
                            text-sm
                            leading-relaxed
                            text-neutral
                        "
          >
            Per seguretat, no podràs sol·licitar un altre correu de recuperació
            fins que hagin passat 15 minuts.
          </p>
        </div>

        <div
          className="
                        rounded-xl
                        bg-primary/5
                        p-4
                        text-sm
                        leading-relaxed
                        text-neutral
                    "
        >
          Si no trobes el missatge, comprova també la carpeta de correu brossa o
          spam.
        </div>

        <a
          href="/iniciar-sessio"
          className="
                        flex
                        w-full
                        items-center
                        justify-center
                        rounded-xl
                        border
                        border-border
                        bg-background
                        px-5
                        py-3
                        font-semibold
                        text-neutral-titulos
                        transition
                        hover:bg-card
                    "
        >
          Tornar a iniciar sessió
        </a>
      </div>
    );
  }

  // ========================================================
  // SIN TOKEN — SOLICITAR RECUPERACIÓN
  // ========================================================

  if (estadoToken === "SIN_TOKEN") {
    return (
      <div
        className="
                    w-full
                    my-5
                    space-y-5
                    rounded-2xl
                    border
                    border-border
                    bg-muted/40
                    p-5
                "
      >
        {/* ============================================
                    CABECERA
                ============================================= */}

        <div className="text-center">
          <h1
            className="
                            text-2xl
                            font-bold
                            text-neutral-titulos
                        "
          >
            Has oblidat la contrasenya?
          </h1>

          <p
            className="
                            mt-2
                            text-sm
                            leading-relaxed
                            text-neutral
                        "
          >
            Introdueix el teu correu electrònic i t'enviarem un enllaç per
            establir una nova contrasenya.
          </p>
        </div>

        {/* ============================================
                    EMAIL
                ============================================= */}

        <div className="space-y-1">
          <label
            htmlFor="recuperar-email"
            className={[
              "text-sm font-medium",

              error?.campo === "email" ? "text-error" : "text-neutral-titulos",
            ].join(" ")}
          >
            Correu electrònic
          </label>

          <div className="relative">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              className="
                                pointer-events-none
                                absolute
                                left-3
                                top-1/2
                                h-5
                                w-5
                                -translate-y-1/2
                                fill-neutral
                            "
              aria-hidden="true"
            >
              <path
                d="
                                    M160-160
                                    q-33 0-56.5-23.5
                                    T80-240
                                    v-480
                                    q0-33 23.5-56.5
                                    T160-800
                                    h640
                                    q33 0 56.5 23.5
                                    T880-720
                                    v480
                                    q0 33-23.5 56.5
                                    T800-160zm320-280
                                    L160-640
                                    v400h640v-400zm0-80
                                    320-200H160z
                                "
              />
            </svg>

            <input
              id="recuperar-email"
              type="email"
              autoComplete="email"
              placeholder="usuari@alu.ibeducacio.es"
              value={email}
              disabled={enviando}
              onChange={(evento) => {
                setEmail(evento.target.value);

                if (error?.campo === "email") {
                  setError(null);
                }
              }}
              onKeyDown={gestionarEnterEmail}
              className={[
                "w-full rounded-xl border bg-muted/40 py-3 pl-11 pr-4 outline-none transition disabled:cursor-not-allowed disabled:opacity-60",

                error?.campo === "email"
                  ? "border-error focus:border-error"
                  : "border-border focus:border-primary",
              ].join(" ")}
            />
          </div>

          {error?.campo === "email" && (
            <p
              className="
                                    ml-0.5
                                    mt-1
                                    text-sm
                                    text-error
                                "
            >
              {error.mensaje}
            </p>
          )}
        </div>

        {/* ============================================
                    PRIVACIDAD
                ============================================= */}

        <div
          className="
                        rounded-xl
                        bg-background/50
                        p-3
                        text-xs
                        leading-relaxed
                        text-neutral
                    "
        >
          Per seguretat, no indicarem si el correu introduït està registrat o no
          a la plataforma.
        </div>

        {/* ============================================
                    ERROR GENERAL
                ============================================= */}

        {error?.campo === "general" && (
          <div
            role="alert"
            className="
                                rounded-xl
                                bg-error/10
                                px-4
                                py-3
                                text-sm
                                text-error
                            "
          >
            {error.mensaje}
          </div>
        )}

        {/* ============================================
                    BOTÓN
                ============================================= */}

        <button
          type="button"
          disabled={enviando}
          onClick={() => void enviarFormEmail()}
          className="
                        flex
                        w-full
                        items-center
                        justify-center
                        rounded-xl
                        bg-primary
                        px-5
                        py-3
                        text-base
                        font-semibold
                        text-secondary-variant
                        transition
                        hover:opacity-90
                        disabled:cursor-not-allowed
                        disabled:opacity-50
                    "
        >
          {enviando ? "Enviant..." : "Enviar instruccions"}
        </button>

        <a
          href="/iniciar-sessio"
          className="
                        block
                        text-center
                        text-sm
                        font-semibold
                        text-secondary
                        hover:underline
                    "
        >
          Tornar a iniciar sessió
        </a>

        {enviando && <Enviando />}
      </div>
    );
  }

  // ========================================================
  // CONTRASEÑA RESTABLECIDA
  // ========================================================

  if (restablecida) {
    return (
      <div
        className="
                    w-full
                    my-5
                    rounded-2xl
                    border
                    border-border
                    bg-muted/40
                    p-5
                    text-center
                "
      >
        <h1
          className="
                        text-2xl
                        font-bold
                        text-neutral-titulos
                    "
        >
          Contrasenya modificada
        </h1>

        <p
          className="
                        mt-2
                        text-sm
                        text-neutral
                    "
        >
          La contrasenya s'ha restablert correctament.
        </p>
      </div>
    );
  }

  // ========================================================
  // TOKEN VÁLIDO — NUEVA CONTRASEÑA
  // ========================================================

  return (
    <div
      className="
                w-full
                my-5
                space-y-5
                rounded-2xl
                border
                border-border
                bg-muted/40
                p-5
            "
    >
      {/* ================================================
                CABECERA
            ================================================= */}

      <div className="text-center">
        <h1
          className="
                        text-2xl
                        font-bold
                        text-neutral-titulos
                    "
        >
          Estableix una nova contrasenya
        </h1>

        <p
          className="
                        mt-2
                        text-sm
                        leading-relaxed
                        text-neutral
                    "
        >
          Introdueix la nova contrasenya dues vegades per completar la
          recuperació del compte.
        </p>
      </div>

      {/* ================================================
                CONTRASEÑA
            ================================================= */}

      <div className="space-y-1">
        <label
          htmlFor="nova-contrasenya"
          className={[
            "text-sm font-medium",

            error?.campo === "contrasena"
              ? "text-error"
              : "text-neutral-titulos",
          ].join(" ")}
        >
          Nova contrasenya
        </label>

        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -960 960 960"
            className="
                            pointer-events-none
                            absolute
                            left-3
                            top-1/2
                            h-5
                            w-5
                            -translate-y-1/2
                            fill-neutral
                        "
            aria-hidden="true"
          >
            <path
              d="
                                M240-80
                                q-33 0-56.5-23.5
                                T160-160
                                v-400
                                q0-33 23.5-56.5
                                T240-640
                                h40v-80
                                q0-83 58.5-141.5
                                T480-920
                                t141.5 58.5
                                T680-720
                                v80h40
                                q33 0 56.5 23.5
                                T800-560
                                v400
                                q0 33-23.5 56.5
                                T720-80zm0-80
                                h480v-400H240zm240-120
                                q33 0 56.5-23.5
                                T560-360
                                t-23.5-56.5
                                T480-440
                                t-56.5 23.5
                                T400-360
                                t23.5 56.5
                                T480-280M360-640
                                h240v-80
                                q0-50-35-85
                                t-85-35
                                t-85 35
                                t-35 85z
                            "
            />
          </svg>

          <input
            id="nova-contrasenya"
            type={mostrarPassword ? "text" : "password"}
            autoComplete="new-password"
            value={contrasena}
            disabled={enviando}
            onChange={(evento) => {
              setContrasena(evento.target.value);

              if (error?.campo === "contrasena") {
                setError(null);
              }
            }}
            onKeyDown={gestionarEnterPassword}
            className={[
              "w-full rounded-xl border bg-muted/40 py-3 pl-11 pr-11 outline-none transition disabled:opacity-60",

              error?.campo === "contrasena"
                ? "border-error focus:border-error"
                : "border-border focus:border-primary",
            ].join(" ")}
          />

          <button
            type="button"
            aria-label={
              mostrarPassword ? "Amagar contrasenya" : "Mostrar contrasenya"
            }
            onClick={() => setMostrarPassword((valor) => !valor)}
            className="
                            absolute
                            right-3
                            top-1/2
                            -translate-y-1/2
                            rounded-md
                            p-1
                            text-neutral
                            transition
                            hover:text-secondary
                        "
          >
            {mostrarPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-5 w-5 fill-current"
              >
                <path
                  d="
                                            m644-428-58-58
                                            q9-47-27-88
                                            t-93-32l-58-58
                                            q17-8 34.5-12
                                            t37.5-4
                                            q75 0 127.5 52.5
                                            T660-500
                                            q0 20-4 37.5
                                            t-12 34.5
                                            m128 126-58-56
                                            q38-29 67.5-63.5
                                            T832-500
                                            q-50-101-143.5-160.5
                                            T480-720
                                            q-29 0-57 4
                                            t-55 12l-62-62
                                            q41-17 84-25.5
                                            t90-8.5
                                            q151 0 269 83.5
                                            T920-500
                                            q-23 59-60.5 109.5
                                            T772-302
                                            m20 246L624-222
                                            q-35 11-70.5 16.5
                                            T480-200
                                            q-151 0-269-83.5
                                            T40-500
                                            q21-53 53-98.5
                                            t73-81.5L56-792
                                            l56-56 736 736z
                                        "
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-5 w-5 fill-current"
              >
                <path
                  d="
                                            M607.5-372.5
                                            Q660-425 660-500
                                            t-52.5-127.5
                                            T480-680
                                            t-127.5 52.5
                                            T300-500
                                            t52.5 127.5
                                            T480-320
                                            t127.5-52.5
                                            m-204-51
                                            Q372-455 372-500
                                            t31.5-76.5
                                            T480-608
                                            t76.5 31.5
                                            T588-500
                                            t-31.5 76.5
                                            T480-392
                                            t-76.5-31.5
                                            M214-281.5
                                            Q94-363 40-500
                                            q54-137 174-218.5
                                            T480-800
                                            t266 81.5
                                            T920-500
                                            q-54 137-174 218.5
                                            T480-200
                                            t-266-81.5
                                        "
                />
              </svg>
            )}
          </button>
        </div>

        {error?.campo === "contrasena" && (
          <p
            className="
                                ml-0.5
                                mt-1
                                text-sm
                                text-error
                            "
          >
            {error.mensaje}
          </p>
        )}
      </div>

      {/* ================================================
                CONFIRMAR CONTRASEÑA
            ================================================= */}

      <div className="space-y-1">
        <label
          htmlFor="confirmar-contrasenya"
          className={[
            "text-sm font-medium",

            error?.campo === "contrasena2"
              ? "text-error"
              : "text-neutral-titulos",
          ].join(" ")}
        >
          Confirmar contrasenya
        </label>

        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -960 960 960"
            className="
                            pointer-events-none
                            absolute
                            left-3
                            top-1/2
                            h-5
                            w-5
                            -translate-y-1/2
                            fill-neutral
                        "
            aria-hidden="true"
          >
            <path
              d="
                                M240-80
                                q-33 0-56.5-23.5
                                T160-160
                                v-400
                                q0-33 23.5-56.5
                                T240-640
                                h40v-80
                                q0-83 58.5-141.5
                                T480-920
                                t141.5 58.5
                                T680-720
                                v80h40
                                q33 0 56.5 23.5
                                T800-560
                                v400
                                q0 33-23.5 56.5
                                T720-80zm0-80
                                h480v-400H240
                            "
            />
          </svg>

          <input
            id="confirmar-contrasenya"
            type={mostrarPassword2 ? "text" : "password"}
            autoComplete="new-password"
            value={contrasena2}
            disabled={enviando}
            onChange={(evento) => {
              setContrasena2(evento.target.value);

              if (error?.campo === "contrasena2") {
                setError(null);
              }
            }}
            onKeyDown={gestionarEnterPassword}
            className={[
              "w-full rounded-xl border bg-muted/40 py-3 pl-11 pr-11 outline-none transition disabled:opacity-60",

              error?.campo === "contrasena2"
                ? "border-error focus:border-error"
                : "border-border focus:border-primary",
            ].join(" ")}
          />

          <button
            type="button"
            aria-label={
              mostrarPassword2 ? "Amagar contrasenya" : "Mostrar contrasenya"
            }
            onClick={() => setMostrarPassword2((valor) => !valor)}
            className="
                            absolute
                            right-3
                            top-1/2
                            -translate-y-1/2
                            rounded-md
                            p-1
                            text-neutral
                            transition
                            hover:text-secondary
                        "
          >
            {mostrarPassword2 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-5 w-5 fill-current"
              >
                <path
                  d="
                                            m644-428-58-58
                                            q9-47-27-88
                                            t-93-32l-58-58
                                            q17-8 34.5-12
                                            t37.5-4
                                            q75 0 127.5 52.5
                                            T660-500
                                            q0 20-4 37.5
                                            t-12 34.5
                                            m128 126-58-56
                                            q38-29 67.5-63.5
                                            T832-500
                                            q-50-101-143.5-160.5
                                            T480-720
                                            q-29 0-57 4
                                            t-55 12l-62-62
                                            q41-17 84-25.5
                                            t90-8.5
                                            q151 0 269 83.5
                                            T920-500
                                            q-23 59-60.5 109.5
                                            T772-302
                                            m20 246L624-222
                                            q-35 11-70.5 16.5
                                            T480-200
                                            q-151 0-269-83.5
                                            T40-500
                                            q21-53 53-98.5
                                            t73-81.5L56-792
                                            l56-56 736 736z
                                        "
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 -960 960 960"
                className="h-5 w-5 fill-current"
              >
                <path
                  d="
                                            M607.5-372.5
                                            Q660-425 660-500
                                            t-52.5-127.5
                                            T480-680
                                            t-127.5 52.5
                                            T300-500
                                            t52.5 127.5
                                            T480-320
                                            t127.5-52.5
                                            m-204-51
                                            Q372-455 372-500
                                            t31.5-76.5
                                            T480-608
                                            t76.5 31.5
                                            T588-500
                                            t-31.5 76.5
                                            T480-392
                                            t-76.5-31.5
                                            M214-281.5
                                            Q94-363 40-500
                                            q54-137 174-218.5
                                            T480-800
                                            t266 81.5
                                            T920-500
                                            q-54 137-174 218.5
                                            T480-200
                                            t-266-81.5
                                        "
                />
              </svg>
            )}
          </button>
        </div>

        {error?.campo === "contrasena2" && (
          <p
            className="
                                ml-0.5
                                mt-1
                                text-sm
                                text-error
                            "
          >
            {error.mensaje}
          </p>
        )}
      </div>

      {/* ================================================
                SEGURIDAD
            ================================================= */}

      <div
        className="
                    rounded-xl
                    bg-background/50
                    p-4
                    text-sm
                    leading-relaxed
                    text-neutral
                "
      >
        Quan canviïs la contrasenya, totes les sessions que tinguis obertes en
        altres dispositius quedaran revocades.
      </div>

      {/* ================================================
                ERROR GENERAL
            ================================================= */}

      {error?.campo === "general" && (
        <div
          role="alert"
          className="
                            rounded-xl
                            bg-error/10
                            px-4
                            py-3
                            text-sm
                            text-error
                        "
        >
          {error.mensaje}
        </div>
      )}

      {/* ================================================
                BOTÓN
            ================================================= */}

      <button
        type="button"
        disabled={enviando}
        onClick={() => void enviarFormCambio()}
        className="
                    flex
                    w-full
                    items-center
                    justify-center
                    rounded-xl
                    bg-primary
                    px-5
                    py-3
                    text-base
                    font-semibold
                    text-secondary-variant
                    transition
                    hover:opacity-90
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                "
      >
        {enviando ? "Restablint..." : "Restablir la contrasenya"}
      </button>

      {enviando && <Enviando />}
    </div>
  );
}
