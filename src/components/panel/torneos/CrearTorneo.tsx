import { obtenerIconoDeporte } from '@components/deporteIcono';
import Enviando from '@components/Enviando';
import { useState, useEffect, useRef } from 'react';


const DeportesList = [
    "Voleibol",
    "Futbol",
    "Basquet"
]

const torneoDefault = {
    "nombre": "",
    "deporte": "",
    "descripcion": "",
     normativa: [
    {
      numero: 1,
      titulo: "",
      articulos: [
        {
          numero: "1.1",
          texto: ""
        }
      ]
    }
  ]

}
export default function CrearTorneo() {
    const [deportesToggle, setDeportesToggle] = useState(false);
    const [data, setData] = useState(torneoDefault);

    const [previewLogo, setPreviewLogo] = useState<string | null>(null);
    const [fileNameLogo, setFileNameLogo] = useState<string>('');
    const [coverFileLogo, setCoverFileLogo] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [previewBanner, setPreviewBanner] = useState<string | null>(null);
    const [fileNameBanner, setFileNameBanner] = useState<string>('');
    const [coverFileBanner, setCoverFileBanner] = useState<File | null>(null);
    const fileInputBannerRef = useRef<HTMLInputElement>(null);

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


    const handleImageChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Por favor selecciona una imagen válida");
            return;
        }

        const imageUrl = URL.createObjectURL(file);

        setPreviewLogo(imageUrl);
        setFileNameLogo(file.name);
        setCoverFileLogo(file);
    };

    const handleImageChangeBanner = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Por favor selecciona una imagen válida");
            return;
        }

        const imageUrl = URL.createObjectURL(file);

        setPreviewBanner(imageUrl);
        setFileNameBanner(file.name);
        setCoverFileBanner(file);
    };

    // Añadir un apartado
    const agregarApartado = () => {
        setData(prev => ({
            ...prev,
            normativa: [
                ...prev.normativa,
                {
                    numero: prev.normativa.length + 1,
                    titulo: "",
                    articulos: []
                }
            ]
        }));
    };

// Eliminar un apartado
const eliminarApartado = (apartadoIndex: number) => {
    setData(prev => ({
        ...prev,
        normativa: prev.normativa.filter((_, i) => i !== apartadoIndex)
    }));
};

// Cambiar el título de un apartado
const actualizarTituloApartado = (
    apartadoIndex: number,
    titulo: string
) => {
    setData(prev => ({
        ...prev,
        normativa: prev.normativa.map((apartado, i) =>
            i === apartadoIndex
                ? { ...apartado, titulo }
                : apartado
        )
    }));
};

// Añadir un artículo
const agregarArticulo = (apartadoIndex: number) => {
    setData(prev => ({
        ...prev,
        normativa: prev.normativa.map((apartado, i) =>
            i === apartadoIndex
                ? {
                    ...apartado,
                    articulos: [
                        ...apartado.articulos,
                        {
                            numero: `${apartado.numero}.${apartado.articulos.length + 1}`,
                            texto: ""
                        }
                    ]
                }
                : apartado
        )
    }));
};

// Actualizar un artículo
const actualizarArticulo = (
    apartadoIndex: number,
    articuloIndex: number,
    texto: string
) => {
    setData(prev => ({
        ...prev,
        normativa: prev.normativa.map((apartado, i) =>
            i === apartadoIndex
                ? {
                      ...apartado,
                      articulos: apartado.articulos.map((articulo, j) =>
                          j === articuloIndex
                              ? { ...articulo, texto }
                              : articulo
                      )
                  }
                : apartado
        )
    }));
};

// Eliminar un artículo
const eliminarArticulo = (
    apartadoIndex: number,
    articuloIndex: number
) => {
    setData(prev => ({
        ...prev,
        normativa: prev.normativa.map((apartado, i) =>
            i === apartadoIndex
                ? {
                      ...apartado,
                      articulos: apartado.articulos.filter(
                          (_, j) => j !== articuloIndex
                      )
                  }
                : apartado
        )
    }));
};

    return(<>
        <div className="max-w-6xl w-full p-4 mb-10 mx-auto">
            <h1 className="text-3xl font-bold text-neutral-titulos">Crear nou torneig</h1>
            <p>Configura la informació general del torneig. Posteriorment podràs crear tantes edicions com necessitis.</p>

            <div className='w-full md:grid max-md:flex flex-col grid-cols-[2fr_1fr] gap-4 mt-5 max-md:mb-26'>
                <div className='space-y-5'>
                    {/* Informaicon General */}
                    <div className="w-full h-auto p-4 rounded-lg bg-card border border-border/50 flex flex-col gap-y-4 ">
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
                            <textarea onChange={(e) => actualizarCampo("descripcion", e.target.value)} className="w-full h-20 bg-muted/40 rounded-lg p-2 border border-border outline-none transition focus:border-primary" placeholder="Explica breument de què tracta aquest torneig..."></textarea>
                        </div>

                        <div className="w-full md:grid max-md:flex flex-col grid-cols-2 gap-4">
                            <div className='space-y-1'>
                                <p>Pujar Logo</p>
                                <div className='w-full h-20 bg-muted/40 rounded-lg border border-border border-dashed relative hover:border-secondary cursor-pointer'>

                                    {previewLogo ? (
                                        // Vista de previsualización (AHORA ES CLICKABLE)
                                        <div 
                                        className="absolute w-full h-full p-2 flex items-center place-content-center top-0 left-0 rounded-lg overflow-hidden group cursor-pointer"
                                        onClick={() => fileInputRef.current?.click()}  // ← Esto es lo importante
                                        >
                                        <img 
                                            src={previewLogo} 
                                            alt="Preview Logo" 
                                            className="w-auto h-full object-cover"
                                        />
                                        
                                        {/* Overlay al pasar el mouse */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <p className="text-white text-sm font-medium">Canviar imatge</p>
                                        </div>


                                        {/* {fileName && (
                                            <p className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded truncate max-w-35">
                                            {fileName}
                                            </p>
                                        )} */}
                                        </div>
                                    ) : (
                                        // Zona de carga (cuando no hay imagen)
                                        <label 
                                        htmlFor="image-upload"
                                        className="w-full h-full absolute top-0 left-0 z-10 rounded-lg flex flex-col items-center place-content-center gap-2 cursor-pointer"
                                        >
                                        <svg xmlns="http://www.w3.org/2000/svg" className='w-6 h-6 fill-neutral' viewBox="0 -960 960 960">
                                            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h320v80H200v560h560v-320h80v320q0 33-23.5 56.5T760-120zm40-160h480L570-480 450-320l-90-120zm440-320v-80h-80v-80h80v-80h80v80h80v80h-80v80z"/>
                                        </svg>
                                        <p>Format quadrat</p>
                                        </label>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                </div>
                            </div>

                            <div className='space-y-1'>
                                <p>Pujar Banner</p>
                                <div className='w-full h-20 bg-muted/40 rounded-lg border border-border border-dashed relative hover:border-secondary'>
                                    {previewBanner ? (
                                        // Vista de previsualización (AHORA ES CLICKABLE)
                                        <div 
                                        className="absolute w-full h-full flex items-center place-content-center top-0 left-0 rounded-lg overflow-hidden group cursor-pointer"
                                        onClick={() => fileInputBannerRef.current?.click()}  // ← Esto es lo importante
                                        >
                                        <img 
                                            src={previewBanner} 
                                            alt="Preview Banner" 
                                            className="w-full h-full object-cover"
                                        />
                                        
                                        {/* Overlay al pasar el mouse */}
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <p className="text-white text-sm font-medium">Canviar imatge</p>
                                        </div>


                                        {/* {fileName && (
                                            <p className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded truncate max-w-35">
                                            {fileName}
                                            </p>
                                        )} */}
                                        </div>
                                    ) : (
                                        // Zona de carga (cuando no hay imagen)
                                        <label 
                                        htmlFor="image-upload-banner"
                                        className="w-full h-full absolute top-0 left-0 z-10 rounded-lg flex flex-col items-center place-content-center gap-2 cursor-pointer"
                                        >
                                        <svg xmlns="http://www.w3.org/2000/svg" className='w-6 h-6 fill-neutral' viewBox="0 -960 960 960">
                                            <path d="m40-240 240-320 180 240h300L560-586 460-454l-50-66 150-200 360 480zm160-80h160l-80-107zm0 0h160z"/>
                                        </svg>
                                        <p>Format panoràmic (16:9)</p>
                                        </label>
                                    )}
                                    <input
                                        ref={fileInputBannerRef}
                                        id="image-upload-banner"
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChangeBanner}
                                        className="hidden"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    
                    {/* Normativa */}
                    <div className="w-full p-4 rounded-lg bg-card border border-border/50 flex flex-col gap-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xl font-semibold text-neutral-titulos flex items-center gap-x-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 fill-secondary" viewBox="0 -960 960 960">
                                    <path d="M160-120v-80h480v80zm226-194L160-540l84-86 228 226zm254-254L414-796l86-84 226 226zm184 408L302-682l56-56 522 522z"/>
                                </svg>
                                Normativa base
                            </p>

                            <button
                                type="button"
                                onClick={agregarApartado}
                                className="px-3 py-2 rounded-lg bg-primary text-secondary-variant hover:bg-primary/80"
                            >
                                + Apartat
                            </button>
                        </div>

                        {data.normativa.length === 0 ? (
                            <div className="border border-dashed border-border rounded-lg p-6 text-center text-neutral">
                                Encara no hi ha cap apartat de la normativa.
                            </div>
                        ) : (
                            data.normativa.map((apartado, i) => (
                                <div
                                    key={i}
                                    className="rounded-lg border border-border bg-muted/20 p-4 flex flex-col gap-y-3"
                                >
                                    <div className="flex gap-3 items-center">
                                        <span className="font-semibold text-secondary whitespace-nowrap">
                                            {i + 1}.
                                        </span>

                                        <input
                                            className="flex-1 bg-muted/40 px-3 py-2 rounded-lg border border-border outline-none focus:border-primary"
                                            placeholder="Títol de l'apartat"
                                            value={apartado.titulo}
                                            
                                            onChange={(e) =>
                                                actualizarTituloApartado(i, e.target.value)
                                            }
                                        />

                                        <button
                                            type="button"
                                            className="text-error hover:opacity-80"
                                            onClick={() => eliminarApartado(i)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>

                                    <div className="pl-6 flex flex-col gap-y-2">
                                        {apartado.articulos.map((articulo, j) => (
                                            <div key={j} className="flex gap-2 items-start">
                                                <span className="text-sm mt-3 whitespace-nowrap text-neutral">
                                                    {i + 1}.{j + 1}
                                                </span>

                                                <textarea
                                                    className="flex-1 h-20 bg-muted/40 rounded-lg p-2 border border-border outline-none focus:border-primary"
                                                    placeholder="Text de l'article..."
                                                    value={articulo.texto}
                                                    onChange={(e) =>
                                                        actualizarArticulo(i, j, e.target.value)
                                                    }
                                                />

                                                <button
                                                    type="button"
                                                    className="text-error mt-3 hover:opacity-80"
                                                     onClick={() => eliminarArticulo(i, j)}
                                                    
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}

                                        <button
                                            type="button"
                                            className="w-max px-3 py-2 rounded-lg border border-border hover:border-secondary hover:text-secondary"
                                            onClick={() => agregarArticulo(i)}
                                        >
                                            + Afegir article
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>
                {/* Resumen */}

                <div className='w-full h-max rounded-lg bg-card border border-border'>
                    <div className='h-36 relative  rounded-t-lg'>
                        <div className='w-full h-full rounded-t-lg absolute top-0 left-0 '>
                                {previewBanner ? (
                                    // Vista de previsualización (AHORA ES CLICKABLE)
                                    <div 
                                    className="absolute w-full h-full  flex items-center place-content-center top-0 left-0 rounded-t-lg overflow-hidden group degradado-img"
                                    >
                                    <img 
                                        src={previewBanner} 
                                        alt="Preview Banner" 
                                        className="w-full h-full object-cover"
                                    />
                                    
                                    </div>
                                    ) : (
                                        // Zona de carga (cuando no hay imagen)
                                        <label 
                                        className="w-full h-full absolute top-0 left-0 z-10 rounded-lg flex flex-col items-center place-content-center gap-2"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className='w-10 h-10 fill-neutral/80' viewBox="0 -960 960 960">
                                                <path d="m40-240 240-320 180 240h300L560-586 460-454l-50-66 150-200 360 480zm160-80h160l-80-107zm0 0h160z"/>
                                            </svg>
                                        
                                        </label>
                                    )}
                            </div>

                        <div className='h-18 flex flex-row items-center gap-x-2 absolute bottom-0 px-2'>
                            <span className='w-14 h-14 rounded bg-muted/40 relative'>
                                {previewLogo ? (
                                    // Vista de previsualización (AHORA ES CLICKABLE)
                                    <div 
                                    className="absolute w-full h-full p-2 flex items-center place-content-center top-0 left-0 rounded-lg overflow-hidden group"
                                    >
                                    <img 
                                        src={previewLogo} 
                                        alt="Preview Logo" 
                                        className="w-auto h-full object-cover"
                                    />
                                    
                                    </div>
                                ) : (
                                    // Zona de carga (cuando no hay imagen)
                                    <label 
                                    htmlFor="image-upload"
                                    className="w-full h-full absolute top-0 left-0 z-10 rounded-lg flex flex-col items-center place-content-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className='w-6 h-6 fill-neutral' viewBox="0 -960 960 960">
                                            <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h320v80H200v560h560v-320h80v320q0 33-23.5 56.5T760-120zm40-160h480L570-480 450-320l-90-120zm440-320v-80h-80v-80h80v-80h80v80h80v80h-80v80z"/>
                                        </svg>
                                    
                                    </label>
                                )}
                            </span>
                            <div>
                                <p className='uppercase text-xs bg-secondary/60 text-secondary-variant w-max h-max px-2 py-1 rounded'>Preview</p>
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
                            <div className='flex items-center gap-x-1'>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-secondary-variant" viewBox="0 -960 960 960">
                                    <path d="M160-120v-80h480v80zm226-194L160-540l84-86 228 226zm254-254L414-796l86-84 226 226zm184 408L302-682l56-56 522 522z"/>
                                </svg>
                                {
                                    data.normativa ? (<p>Normativa establerta</p>) : (<p>No hi ha normativa</p>)
                                }
                            </div>
                            <div className='w-full h-20 bg-muted/40 p-2 rounded-lg'>
                                {
                                    data.descripcion ? (
                                        <p className='line-clamp-3'>{data.descripcion}</p>
                                    ):(
                                        <p className='italic'>"Completa el formulari a l'esquerra per visualitzar com es veurà el torneig en el portal principal."</p>
                                    )
                                }
                            </div>
                        </div>

                        <div className='w-full flex flex-col p-4 space-y-4'>
                            <div className='w-full px-3 py-2 rounded-lg bg-primary text-secondary-variant cursor-pointer hover:bg-primary/80'>
                                <p className='text-center'>Crear torneig</p>
                            </div>

                            <a href='/panell/tornejos' className='w-full px-3 py-2 text-center rounded-lg border border-border text-neutral hover:border-error hover:text-error'>
                                    Cance·lar
                            </a>
                        </div>
                </div>
            </div>
        </div>
    </>)
}