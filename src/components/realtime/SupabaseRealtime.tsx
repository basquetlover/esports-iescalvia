import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export type EstadoBroadcast =
  | "SIN_CONFIGURACION"
  | "CONECTANDO"
  | "CONECTADO"
  | "DESCONECTADO";

type ConfiguracionBroadcast = {
  canal: string;
  evento: string;
  onCambio: () => void;
};

const url = "https://aimtsdmsojunxazbxfue.supabase.co";

const anonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpbXRzZG1zb2p1bnhhemJ4ZnVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzIwMDg5MjAsImV4cCI6MjA0NzU4NDkyMH0.WcyPnX9pJTVtWng9_WJ2ghAAQH6lRZ3hzU91i1zVbUQ";

let clienteCompartido: ReturnType<typeof createClient> | null = null;

function obtenerCliente() {
  if (!url || !anonKey) return null;

  if (!clienteCompartido) {
    clienteCompartido = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return clienteCompartido;
}

export function useRealtimeBroadcast({
  canal,
  evento,
  onCambio,
}: ConfiguracionBroadcast): EstadoBroadcast {
  const [estado, setEstado] = useState<EstadoBroadcast>("SIN_CONFIGURACION");

  const callbackRef = useRef(onCambio);

  useEffect(() => {
    callbackRef.current = onCambio;
  }, [onCambio]);

  useEffect(() => {
    const cliente = obtenerCliente();

    if (!cliente || !canal || !evento) {
      setEstado("SIN_CONFIGURACION");
      return;
    }

    let activo = true;

    setEstado("CONECTANDO");

    const canalRealtime = cliente
      .channel(canal)
      .on("broadcast", { event: evento }, () => {
        if (activo) callbackRef.current();
      })
      .subscribe((situacion) => {
        if (!activo) return;

        if (situacion === "SUBSCRIBED") {
          setEstado("CONECTADO");

          // Recuperar cambios ocurridos
          // antes de completar la conexión.
          callbackRef.current();
        } else if (
          situacion === "CHANNEL_ERROR" ||
          situacion === "TIMED_OUT" ||
          situacion === "CLOSED"
        ) {
          setEstado("DESCONECTADO");
        }
      });

    return () => {
      activo = false;
      void cliente.removeChannel(canalRealtime);
    };
  }, [canal, evento]);

  return estado;
}
