import { obtenerIconoDeporte } from '@components/deporteIcono';
import Enviando from '@components/Enviando';
import { useState, useEffect } from 'react';


const DeportesList = [
    "Voleibol",
    "Futbol"
]

const torneoDefault = {
    "nombre": "",
    "deporte": "",
    "descripcion": "",

}
export default function CrearTorneo() {
    const [deportesToggle, setDeportesToggle] = useState(false);
    const [data, setData] = useState(torneoDefault)

    const toggleDeportes = (() =>{
        if(deportesToggle){
            setDeportesToggle(false)
        } else (
            setDeportesToggle(true)
        )
    })

    const actualizarCampo = (
        field: keyof typeof torneoDefault,
        value: string
    ) => {
        setData(prev => ({
            ...prev,
            [field]: value
        }));
    }

    const actualizarDeporte = (deporte: string) => {
        toggleDeportes() 
        actualizarCampo("deporte", deporte);
        
    };

    return(<>
        <div className="max-w-6xl w-full p-4">
            <h1 className="text-3xl font-bold text-neutral-titulos">Crear nou torneig</h1>
            <p>Configura la informació general del torneig. Posteriorment podràs crear tantes edicions com necessitis.</p>

            <div className='w-full md:grid max-md:flex flex-col grid-cols-[2fr_1fr] gap-4 mt-5 max-md:mb-26'>
                <div className="max-w-xl w-full h-auto p-4 rounded-lg bg-card border border-border/50 flex flex-col gap-y-4 ">
                    <p className="text-xl font-semibold text-neutral-titulos flex items-center gap-x-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-secondary" viewBox="0 -960 960 960">
                            <path d="M440-280h80v-240h-80zm68.5-331.5Q520-623 520-640t-11.5-28.5T480-680t-28.5 11.5T440-640t11.5 28.5T480-600t28.5-11.5M480-80q-83 0-156-31.5T197-197t-85.5-127T80-480t31.5-156T197-763t127-85.5T480-880t156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80m0-80q134 0 227-93t93-227-93-227-227-93-227 93-93 227 93 227 227 93m0-320"/>
                        </svg>
                        Informació general
                    </p>

                    <div className="w-full md:grid max-md:flex flex-col grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p>Nom del torneig</p>
                            <input value={data.nombre} onChange={(e) => actualizarCampo("nombre", e.target.value)} className="w-full bg-muted/40 px-3 py-2 rounded-lg border border-border outline-none transition focus:border-primary" placeholder="Ex: Copa Futbol 7"/>
                        </div>

                        <div className="space-y-1">
                            <p>Esport</p>
                            <div className="relative">
                                <div onClick={() => toggleDeportes()} className={`w-full rounded-lg border relative pl-11 border-border bg-muted/40 px-3 py-2 outline-none transition focus:border-primary`}>
                                    {/* Aquí irá el nombre del curso seleccionado */}
                                    {
                                        data.deporte ? (
                                            <p>{data.deporte}</p>
                                        ):(
                                            <p>Selecciona un esport</p>
                                        )
                                    }  
                                </div>
                                {obtenerIconoDeporte(data.deporte, "absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 fill-neutral pointer-events-none")}

                                <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 fill-neutral cursor-pointer" viewBox="0 -960 960 960">
                                    <path d="M480-344 240-584l56-56 184 184 184-184 56 56z"/>
                                </svg>

                                <div className={`absolute w-full max-h-50 bg-muted z-10 rounded-2xl overflow-y-scroll scroll-personalizada ${!deportesToggle && "hidden"}`}>
                                    <div className='flex flex-col gap-y-1 p-2'>
                                    {DeportesList.map((deporte) => (
                                            <div onClick={() => actualizarDeporte(deporte)} className="cursor-pointer px-3 py-2 hover:bg-secondary/40 rounded-lg" key={deporte} >
                                                <p className='w-full flex items-center place-content-between'>
                                                    {deporte}
                                                    {obtenerIconoDeporte(deporte, "w-4 h-4 fill-neutral")}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full space-y-1">
                        <p>Descripció</p>
                        <textarea className="w-full h-20 bg-muted/40 rounded-lg p-2 border border-border outline-none transition focus:border-primary" placeholder="Explica breument de què tracta aquest torneig..."></textarea>
                    </div>

                    <div className="w-full md:grid max-md:flex flex-col grid-cols-2 gap-4">
                        <div className='space-y-1'>
                            <p>Pujar Logo</p>
                            <div className='w-full h-20 bg-muted/40 rounded-lg border border-border border-dashed'>

                            </div>
                        </div>

                        <div className='space-y-1'>
                            <p>Pujar Banner</p>
                            <div className='w-full h-20 bg-muted/40 rounded-lg border border-border border-dashed'>

                            </div>
                        </div>
                    </div>
                </div>

                <div className='w-full rounded-lg bg-card border border-border'>
                    <div className='h-36 relative  rounded-t-lg'>
                        <div className='h-18 flex flex-row items-center gap-x-2 absolute bottom-0 px-2'>
                            <span className='w-14 h-14 rounded bg-muted/40'>
                                &nbsp;
                            </span>
                            <div>
                                <p className='uppercase text-xs bg-secondary/15 text-secondary-variant w-max h-max px-2 py-1 rounded'>Preview</p>
                                <span className='text-2xl text-neutral-titulos'>
                                    {
                                        data.nombre ? (<p>{data.nombre}</p>) : (<p>Nou Torneig</p>)
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className='p-4 flex flex-col gap-y-2 text-sm'>
                            <p className='text-base uppercase'>Resum del torneig</p>
                            <div className='flex items-center gap-x-1'>
                                {obtenerIconoDeporte(data.deporte, "w-4 h-4 fill-secondary-variant")}
                                <p>
                                    {
                                        data.deporte ? (<p>{data.deporte}</p>) : (<p>Selecciona un esport</p>)
                                    }
                                </p>
                            </div>
                        </div>
                </div>
            </div>
        </div>
    </>)
}