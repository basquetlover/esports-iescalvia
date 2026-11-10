/**
 * Motor de puntuación del acta de voleibol.
 *
 * Sin React, Supabase ni acceso a localStorage: puede utilizarse
 * tanto desde el navegador como desde las APIs del servidor.
 *
 * Convenciones:
 * - Un ERROR pertenece al equipo/jugador que lo comete;
 *   el punto se adjudica al adversario.
 * - El fin de set se deduce de las jugadas, no necesita
 *   un evento adicional FIN_SET.
 * - Las jugadas ANULADAS no influyen en ningún resultado.
 * - La finalización forzada no altera los sets ganados.
 */

export const TIPOS_PUNTO_VOLEIBOL = [
  "DIRECTO",
  "BLOQUEO",
  "REMATE",
  "ERROR",
] as const;

export type TipoPuntoVoleibol = (typeof TIPOS_PUNTO_VOLEIBOL)[number];
export type TipoSetVoleibol = "NORMAL" | "EXTRA";
export type ModoCierreVoleibol = "NORMAL" | "FORZADO_PUNTOS";

export type ConfiguracionVoleibol = {
  /** Sets que debe ganar un equipo para vencer. Por defecto, 2. */
  setsParaGanar: number;
  puntosSet: number;
  diferenciaSet: number;
  puntosExtraSet: number;
  diferenciaExtraSet: number;
};

export const CONFIGURACION_VOLEIBOL_PREDETERMINADA: Readonly<ConfiguracionVoleibol> =
  Object.freeze({
    setsParaGanar: 2,
    puntosSet: 10,
    diferenciaSet: 0,
    puntosExtraSet: 7,
    diferenciaExtraSet: 0,
  });

/**
 * Compatible por estructura con EventoLocalActa y con los registros
 * de acta_eventos devueltos por la API (snake_case).
 */
export type EventoCompatibleVoleibol = {
  id?: string;
  clienteEventoID?: string;
  cliente_evento_id?: string;
  tipoEvento?: string;
  tipo_evento?: string;
  equipoID?: string | null;
  equipo_id?: string | null;
  jugadorID?: string | null;
  jugador_id?: string | null;
  estado?: string;
  orden?: number | null;
};

export type SetVoleibol = {
  numero: number;
  tipo: TipoSetVoleibol;
  puntosLocal: number;
  puntosVisitante: number;
  finalizado: boolean;
  ganadorEquipoID: string | null;
};

export type PuntoVoleibol = {
  clienteEventoID: string;
  tipo: TipoPuntoVoleibol;
  equipoResponsableID: string;
  equipoBeneficiadoID: string;
  jugadorID: string | null;
  numeroSet: number;
  puntosLocal: number;
  puntosVisitante: number;
  cierraSet: boolean;
};

export type EstadisticasEquipoVoleibol = Record<TipoPuntoVoleibol, number>;

export type EstadoVoleibol = {
  equipoLocalID: string;
  equipoVisitanteID: string;
  configuracion: ConfiguracionVoleibol;
  setsFinalizados: SetVoleibol[];
  setActual: SetVoleibol | null;
  setsGanadosLocal: number;
  setsGanadosVisitante: number;
  /** Incluye los puntos del set en curso, si existe. */
  puntosTotalesLocal: number;
  puntosTotalesVisitante: number;
  estadisticasLocal: EstadisticasEquipoVoleibol;
  estadisticasVisitante: EstadisticasEquipoVoleibol;
  historial: PuntoVoleibol[];
  requiereExtraSet: boolean;
  finalizadoPorSets: boolean;
  ganadorPorSetsID: string | null;
};

export type EvaluacionCierreVoleibol = {
  permitido: boolean;
  modo: ModoCierreVoleibol;
  ganadorEquipoID: string | null;
  marcadorLocal: number;
  marcadorVisitante: number;
  puntosTotalesLocal: number;
  puntosTotalesVisitante: number;
  mensaje: string;
};

function enteroEnRango(
  valor: number,
  campo: string,
  minimo: number,
  maximo: number,
): number {
  if (!Number.isSafeInteger(valor) || valor < minimo || valor > maximo) {
    throw new Error(`Configuració de voleibol no vàlida: ${campo}.`);
  }
  return valor;
}

export function normalizarConfiguracionVoleibol(
  entrada: Partial<ConfiguracionVoleibol> = {},
): ConfiguracionVoleibol {
  const base = CONFIGURACION_VOLEIBOL_PREDETERMINADA;
  return {
    setsParaGanar: enteroEnRango(
      entrada.setsParaGanar ?? base.setsParaGanar,
      "setsParaGanar",
      1,
      5,
    ),
    puntosSet: enteroEnRango(
      entrada.puntosSet ?? base.puntosSet,
      "puntosSet",
      1,
      1000,
    ),
    diferenciaSet: enteroEnRango(
      entrada.diferenciaSet ?? base.diferenciaSet,
      "diferenciaSet",
      0,
      1000,
    ),
    puntosExtraSet: enteroEnRango(
      entrada.puntosExtraSet ?? base.puntosExtraSet,
      "puntosExtraSet",
      1,
      1000,
    ),
    diferenciaExtraSet: enteroEnRango(
      entrada.diferenciaExtraSet ?? base.diferenciaExtraSet,
      "diferenciaExtraSet",
      0,
      1000,
    ),
  };
}

function crearSet(numero: number, tipo: TipoSetVoleibol): SetVoleibol {
  return {
    numero,
    tipo,
    puntosLocal: 0,
    puntosVisitante: 0,
    finalizado: false,
    ganadorEquipoID: null,
  };
}

function crearEstadisticas(): EstadisticasEquipoVoleibol {
  return { DIRECTO: 0, BLOQUEO: 0, REMATE: 0, ERROR: 0 };
}

function tipoNormalizado(valor: string): TipoPuntoVoleibol | "FIN_SET" {
  const tipo = valor.trim().toUpperCase();
  if (tipo === "FINSET" || tipo === "FIN_SET") return "FIN_SET";
  if (TIPOS_PUNTO_VOLEIBOL.some((opcion) => opcion === tipo)) {
    return tipo as TipoPuntoVoleibol;
  }
  throw new Error(`Tipus de punt de voleibol desconegut: ${valor}.`);
}

function setTerminado(
  set: SetVoleibol,
  config: ConfiguracionVoleibol,
): boolean {
  const objetivo =
    set.tipo === "EXTRA" ? config.puntosExtraSet : config.puntosSet;
  const diferenciaMinima =
    set.tipo === "EXTRA" ? config.diferenciaExtraSet : config.diferenciaSet;
  const maximo = Math.max(set.puntosLocal, set.puntosVisitante);
  const diferenciaReal = Math.abs(set.puntosLocal - set.puntosVisitante);

  // Incluso con diferencia configurada a cero, un set no termina empatado.
  return maximo >= objetivo && diferenciaReal >= Math.max(1, diferenciaMinima);
}

/**
 * Recalcula el partido completo a partir de eventos válidos.
 *
 * La lista local conserva su orden de inserción. La lista del servidor
 * utiliza `orden` cuando TODOS los eventos lo tienen. Nunca se basa
 * en el marcador enviado por el navegador.
 */
export function calcularEstadoVoleibol(
  eventos: readonly EventoCompatibleVoleibol[],
  equipoLocalID: string,
  equipoVisitanteID: string,
  configuracionEntrada: Partial<ConfiguracionVoleibol> = {},
): EstadoVoleibol {
  if (!Array.isArray(eventos))
    throw new Error("La llista de jugades no és vàlida.");
  if (
    !equipoLocalID ||
    !equipoVisitanteID ||
    equipoLocalID === equipoVisitanteID
  ) {
    throw new Error("Els identificadors dels dos equips no són vàlids.");
  }

  const configuracion = normalizarConfiguracionVoleibol(configuracionEntrada);
  const setFinalizados: SetVoleibol[] = [];
  const historial: PuntoVoleibol[] = [];
  const estadisticasLocal = crearEstadisticas();
  const estadisticasVisitante = crearEstadisticas();
  const identificadores = new Set<string>();
  let setActual: SetVoleibol | null = crearSet(1, "NORMAL");
  let setsGanadosLocal = 0;
  let setsGanadosVisitante = 0;
  let puntosTotalesLocal = 0;
  let puntosTotalesVisitante = 0;

  const todosOrdenados = eventos.every(
    (evento) =>
      Number.isSafeInteger(evento.orden) && (evento.orden as number) >= 0,
  );
  const ordenados = todosOrdenados
    ? [...eventos].sort((a, b) => (a.orden as number) - (b.orden as number))
    : [...eventos];

  for (const evento of ordenados) {
    const identificador = (
      evento.clienteEventoID ??
      evento.cliente_evento_id ??
      evento.id ??
      ""
    ).trim();
    if (!identificador || identificadores.has(identificador)) {
      throw new Error(
        "Hi ha una jugada sense identificador o amb identificador duplicat.",
      );
    }
    identificadores.add(identificador);

    if (evento.estado === "ANULADO") continue;
    if (evento.estado !== undefined && evento.estado !== "ACTIVO") {
      throw new Error(`Estat de jugada no reconegut: ${evento.estado}.`);
    }

    const tipo = tipoNormalizado(evento.tipoEvento ?? evento.tipo_evento ?? "");
    // Compatibilidad con marcadores FIN_SET de la web antigua.
    if (tipo === "FIN_SET") continue;

    const responsableID = evento.equipoID ?? evento.equipo_id;
    if (
      responsableID !== equipoLocalID &&
      responsableID !== equipoVisitanteID
    ) {
      throw new Error(
        "La jugada correspon a un equip que no participa en el partit.",
      );
    }
    if (!setActual) {
      throw new Error(
        "S'ha registrat un punt després que el partit ja hagi finalitzat.",
      );
    }

    const beneficiadoID =
      tipo === "ERROR"
        ? responsableID === equipoLocalID
          ? equipoVisitanteID
          : equipoLocalID
        : responsableID;

    if (beneficiadoID === equipoLocalID) {
      setActual.puntosLocal += 1;
      puntosTotalesLocal += 1;
    } else {
      setActual.puntosVisitante += 1;
      puntosTotalesVisitante += 1;
    }

    const estadisticas =
      responsableID === equipoLocalID
        ? estadisticasLocal
        : estadisticasVisitante;
    estadisticas[tipo] += 1;
    const cierraSet = setTerminado(setActual, configuracion);

    historial.push({
      clienteEventoID: identificador,
      tipo,
      equipoResponsableID: responsableID,
      equipoBeneficiadoID: beneficiadoID,
      jugadorID: evento.jugadorID ?? evento.jugador_id ?? null,
      numeroSet: setActual.numero,
      puntosLocal: setActual.puntosLocal,
      puntosVisitante: setActual.puntosVisitante,
      cierraSet,
    });

    if (!cierraSet) continue;

    const ganadorID =
      setActual.puntosLocal > setActual.puntosVisitante
        ? equipoLocalID
        : equipoVisitanteID;
    setFinalizados.push({
      ...setActual,
      finalizado: true,
      ganadorEquipoID: ganadorID,
    });
    if (ganadorID === equipoLocalID) setsGanadosLocal += 1;
    else setsGanadosVisitante += 1;

    if (
      setsGanadosLocal >= configuracion.setsParaGanar ||
      setsGanadosVisitante >= configuracion.setsParaGanar
    ) {
      setActual = null;
    } else {
      const numeroSiguiente = setFinalizados.length + 1;
      const esExtra =
        setsGanadosLocal === configuracion.setsParaGanar - 1 &&
        setsGanadosVisitante === configuracion.setsParaGanar - 1;
      setActual = crearSet(numeroSiguiente, esExtra ? "EXTRA" : "NORMAL");
    }
  }

  const finalizadoPorSets = setActual === null;
  return {
    equipoLocalID,
    equipoVisitanteID,
    configuracion,
    setsFinalizados: setFinalizados,
    setActual,
    setsGanadosLocal,
    setsGanadosVisitante,
    puntosTotalesLocal,
    puntosTotalesVisitante,
    estadisticasLocal,
    estadisticasVisitante,
    historial,
    requiereExtraSet: setActual?.tipo === "EXTRA",
    finalizadoPorSets,
    ganadorPorSetsID: finalizadoPorSets
      ? setsGanadosLocal > setsGanadosVisitante
        ? equipoLocalID
        : equipoVisitanteID
      : null,
  };
}

/**
 * El cierre forzado es una decisión explícita, NUNCA automática.
 * En empate de sets se comparan TODOS los puntos registrados,
 * incluidos los de un extra set que se haya empezado y no terminado.
 * Si también hay empate a puntos, no se declara ganador.
 */
export function evaluarCierreVoleibol(
  estado: EstadoVoleibol,
  modo: ModoCierreVoleibol,
): EvaluacionCierreVoleibol {
  const base = {
    modo,
    marcadorLocal: estado.setsGanadosLocal,
    marcadorVisitante: estado.setsGanadosVisitante,
    puntosTotalesLocal: estado.puntosTotalesLocal,
    puntosTotalesVisitante: estado.puntosTotalesVisitante,
  };

  if (modo === "NORMAL") {
    return estado.finalizadoPorSets && estado.ganadorPorSetsID
      ? {
          ...base,
          permitido: true,
          ganadorEquipoID: estado.ganadorPorSetsID,
          mensaje: "Partit finalitzat per sets.",
        }
      : {
          ...base,
          permitido: false,
          ganadorEquipoID: null,
          mensaje:
            "El partit encara no té els sets necessaris. Cal jugar l'extra set si hi ha empat.",
        };
  }

  if (modo !== "FORZADO_PUNTOS") {
    throw new Error("Modalitat de tancament de l'acta desconeguda.");
  }
  if (
    estado.finalizadoPorSets ||
    estado.setsGanadosLocal !== estado.setsGanadosVisitante ||
    estado.setsGanadosLocal === 0
  ) {
    return {
      ...base,
      permitido: false,
      ganadorEquipoID: null,
      mensaje:
        "El tancament forçat només es permet amb sets acabats i empatats.",
    };
  }
  if (estado.puntosTotalesLocal === estado.puntosTotalesVisitante) {
    return {
      ...base,
      permitido: false,
      ganadorEquipoID: null,
      mensaje:
        "Els equips també estan empatats a punts. No es pot determinar un guanyador.",
    };
  }

  return {
    ...base,
    permitido: true,
    ganadorEquipoID:
      estado.puntosTotalesLocal > estado.puntosTotalesVisitante
        ? estado.equipoLocalID
        : estado.equipoVisitanteID,
    mensaje:
      "Tancament forçat: guanyador determinat per la suma de punts de tots els sets.",
  };
}
