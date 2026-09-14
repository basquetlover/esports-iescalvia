import { obtenerIconoDeporte } from "@components/deporteIcono";
import { formatearFechaCatalan } from "@utils/formatearFechas";
import { useEffect, useState } from "react";

interface Torneig {
    id: string;
    nombre: string;
    banner: string;
    logo: string;
    deporte: string;
    numeroEdicions: number;
    fecha_creacion: string;
    estado: string;
}

export default function Lista() {
    const [tornejos, setTornejos] = useState<Torneig[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [puedeCrear, setPuedeCrear] = useState(false);
    const [guardado, setGuardado] = useState("");

    useEffect(() => {
        const estado = new URLSearchParams(window.location.search).get("guardado");
        if (estado === "creado" || estado === "editado") setGuardado("Torneig desat correctament.");
    }, []);

    useEffect(() => {
        async function carregarTornejos() {
            try {
                const response = await fetch("/api/torneos/lista");

                const json = await response.json();
                if (!response.ok) throw new Error(json.mensaje || "Error en carregar els tornejos");
                setPuedeCrear(json.puedeCrear);

                setTornejos(json.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Error en carregar els tornejos");
            } finally {
                setCargando(false);
            }
        }

        carregarTornejos();
    }, []);


    return(
        <div className="w-full h-auto relative p-4 flex items-center max-md:place-content-center gap-4 flex-wrap">
            {cargando && <p className="w-full" role="status">Carregant tornejos...</p>}
            {error && <p className="w-full text-error" role="alert">{error}</p>}
            {guardado && <p className="w-full text-secondary" role="status">{guardado}</p>}
            {!cargando && !error && tornejos.length === 0 && <p className="w-full">No hi ha tornejos disponibles.</p>}
            {tornejos.map((torneig) => (
                <div className="w-64 h-105 bg-card rounded-lg" key={torneig.id}>
                    <div className="w-full h-32 bg-card rounded-t-lg flex items-center  justify-center relative">
                        {torneig.banner && <img src={torneig.banner} alt={torneig.nombre} className="w-full h-full object-cover rounded-t-lg" />}

                        <div className="absolute w-16 h-16 p-px rounded-lg overflow-hidden bg-card z-30  left-4 shadow-border shadow-sm -bottom-8">
                            {torneig.logo && <img src={torneig.logo} alt={torneig.nombre} className="w-full h-full object-cover" />}
                        </div>

                        <p className="absolute z-30 top-2 right-2 w-max h-max px-2 py-px rounded-full text-neutral-titulos bg-primary text-sm">{torneig.estado}</p>
                        {
                            torneig.estado === "Inactiu" && (
                                <div className="w-full h-full bg-card/60 absolute top-0 left-0 z-20 rounded-t-lg">&nbsp;</div>
                            )
                        }
                        
                    </div>

                    <div className="w-full h-full mt-10 p-2 flex flex-col gap-y-1">

                        <p className="text-base font-bold text-neutral-titulos">{torneig.nombre}</p>
                        <div className="text-sm flex items-center gap-x-1">
                            
                            {obtenerIconoDeporte(torneig.deporte, "w-4 h-4 fill-neutral")}
                            
                            <p>{torneig.deporte}</p>
                        </div>

                        <div className="w-full h-0.5 bg-muted/40 rounded my-3">&nbsp;</div>
                        
                        <div className="w-full grid grid-cols-2 gap-x-2 place-items-center text-sm">
                            <div className="w-full px-2">
                                <p className="uppercase">Edicions</p>
                                <p className="text-neutral-titulos">{torneig.numeroEdicions}</p>
                            </div>

                            <div className="w-full px-2">
                                <p className="uppercase">Creat el</p>
                                <p className="text-neutral-titulos">{torneig.fecha_creacion ? formatearFechaCatalan(torneig.fecha_creacion) : "—"}</p>
                            </div>
                        </div>

                        <div className="w-full h-0.5 bg-muted/40 rounded my-3">&nbsp;</div>

                        <a href={`/panell/info/torneig?accio=ver&torneoID=${torneig.id}`} className="mx-auto w-max h-max px-4 py-2 bg-background/80 border-primary rounded-lg border text-secondary hover:bg-background/60 duration-300">
                            Administrar
                        </a>

                    </div>

                </div>
            ))}

            {puedeCrear && <div className="w-64 h-105 bg-card rounded-lg relative">
                    <div className="w-full h-32 bg-primary/30 rounded-t-lg flex items-center  justify-center relative">
                        <svg xmlns="http://www.w3.org/2000/svg" className="fill-secondary w-12 h-12" viewBox="0 -960 960 960">
                            <path d="M440-280h80v-160h160v-80H520v-160h-80v160H280v80h160zm40 200q-83 0-156-31.5T197-197t-85.5-127T80-480t31.5-156T197-763t127-85.5T480-880t156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80m0-80q134 0 227-93t93-227-93-227-227-93-227 93-93 227 93 227 227 93m0-320"/>
                        </svg>
                        
                    </div>

                    <div className="w-full h-full mt-10 p-2 flex flex-col items-center relative gap-y-5">
                        
                            <p className="text-base font-bold text-neutral-titulos">Nou Torneig</p>
                            <p className="text-sm text-center">Crea un nou torneig perquè puguis afegir-hi edicions en el futur.</p>
                        
                        

                        <a href={`/panell/info/torneig?accio=crear`} className=" mx-auto w-max h-max px-4 py-2 bg-background/80 border-primary rounded-lg border text-secondary hover:bg-background/60 duration-300">
                            Començar
                        </a>

                    </div>

                </div>}

        </div>
    )
}