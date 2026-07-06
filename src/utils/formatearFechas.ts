export function formatearFechaCatalan(fechaISO: string): string {
    const fecha = new Date(fechaISO);

    const dia = fecha.toLocaleString("ca-ES", {
        day: "2-digit",
    });

    const mes = fecha.toLocaleString("ca-ES", {
        month: "short",
    }).replace(".", "");

    const any = fecha.toLocaleString("ca-ES", {
        year: "numeric",
    });

    return `${dia} ${mes.charAt(0).toUpperCase() + mes.slice(1)}. ${any}`;
}