import type { EstadisticasPanelDatos } from "./ResumenPanel";

export default function EstadisticasPanel({
    modo,
    estadisticas,
    verTorneos,
    verEdiciones
}: {
    modo: "general" | "torneo";
    estadisticas: EstadisticasPanelDatos;
    verTorneos: boolean;
    verEdiciones: boolean;
}) {
    const tarjetas = modo === "general"
        ? [
            {
                nombre: "Tornejos",
                valor: estadisticas.torneos,
                descripcion: "Accessibles amb el teu compte",
                visible: verTorneos
            },
            {
                nombre: "Tornejos actius",
                valor: estadisticas.torneosActivos,
                descripcion: "Marcats com a actius",
                visible: verTorneos
            },
            {
                nombre: "Tornejos inactius",
                valor: estadisticas.torneosInactivos,
                descripcion: "Marcats com a inactius",
                visible: verTorneos
            },
            {
                nombre: "Edicions",
                valor: estadisticas.ediciones,
                descripcion: "Accessibles als teus tornejos",
                visible: verEdiciones
            }
        ]
        : [
            {
                nombre: "Edicions",
                valor: estadisticas.ediciones,
                descripcion: "Total del torneig",
                visible: verEdiciones
            },
            {
                nombre: "Esborranys",
                valor: estadisticas.edicionesBorrador,
                descripcion: "Edicions en preparació",
                visible: verEdiciones
            },
            {
                nombre: "Actives",
                valor: estadisticas.edicionesActivas,
                descripcion: "Edicions amb estat actiu",
                visible: verEdiciones
            },
            {
                nombre: "Finalitzades",
                valor: estadisticas.edicionesFinalizadas,
                descripcion: "Edicions finalitzades",
                visible: verEdiciones
            }
        ];

    const visibles = tarjetas.filter(tarjeta => tarjeta.visible);

    if (visibles.length === 0) return null;

    return (
        <section
            aria-label="Estadístiques"
            className="grid grid-cols-2 xl:grid-cols-4 gap-4"
        >
            {visibles.map(tarjeta => (
                <div
                    key={tarjeta.nombre}
                    className="rounded-lg border border-border bg-card p-4"
                >
                    <p className="text-xs uppercase tracking-wide text-neutral">
                        {tarjeta.nombre}
                    </p>

                    <p className="mt-2 text-3xl font-bold text-neutral-titulos">
                        {tarjeta.valor === null
                            ? "—"
                            : tarjeta.valor.toLocaleString("ca-ES")}
                    </p>

                    <p className="mt-1 text-xs text-neutral">
                        {tarjeta.descripcion}
                    </p>
                </div>
            ))}
        </section>
    );
}