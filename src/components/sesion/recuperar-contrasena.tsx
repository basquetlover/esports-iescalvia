import Enviando from '@components/Enviando';
import { useState, useEffect } from 'react';
type ErrorData = {
    seccion: Seccion;
    mensaje: string;
};

type Seccion =
    | "nombre"
    | "apellido1"
    | "apellido2"
    | "curso"
    | "email"
    | "contrasena"
    | "contrasena2"
    | "terminos"
    | "general";

const defaultDataEnvio = {
    "contrasena": "",
    "email": "",
}
const defaultDataCambio = {
    "contrasena2": "",
    "contrasena": "",
    "token_recuperar": "",
    "email": "",
}



export default function RecuperarContrasena({ token_recuperar }: { token_recuperar: string | null }) {
    const [error, setError] = useState<ErrorData | null>(null);
    const [enviado, setEnviado] = useState(false);
    const [paso1, setPaso1] = useState(false);

    const [tokenRecuperar, setTokenRecuperar] = useState(token_recuperar);
    
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [mostrarPassword2, setMostrarPassword2] = useState(false);

    const [terminos, setTerminos] = useState(false);
    const [data, setData] = useState(defaultDataEnvio);
    const [dataCambio, setDataCambio] = useState(defaultDataCambio);


    const toggleTerminos = (() =>{
        if(terminos){
            setTerminos(false)
        } else (
            setTerminos(true)
        )
    })

    useEffect(() =>{
        if (!token_recuperar) return;
        setDataCambio(prev => ({
            ...prev,
            token_recuperar: token_recuperar
        }));
    },[token_recuperar]);


    const actualizarCampo = (
        field: keyof typeof defaultDataEnvio,
        value: string
    ) => {
        // setError(null)
        setData(prev => ({
            ...prev,
            [field]: value
        }));
    }

    const actualizarCampoCambio = (
        field: keyof typeof defaultDataCambio,
        value: string
    ) => {
        // setError(null)
        setDataCambio(prev => ({
            ...prev,
            [field]: value
        }));
    }

    const togglePassword = (campo: "p1" | "p2") => {
        if (campo === "p1") {
            setMostrarPassword(prev => !prev);
        } else {
            setMostrarPassword2(prev => !prev);
        }
    };

    const enviarFormEmail = async () =>{
        setError(null)
        setEnviado(true)

        if(!data.email){
            setError( {
                seccion: "email",
                mensaje: "El correu és obligatori."
            });
            setEnviado(false)
            return
        }


        try {
        const response = await fetch("/api/sesiones/enviar-email", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
            setError({
                seccion: "general",
                mensaje: result.mensaje,
            });
            setEnviado(false)
            return;
        }

        console.log("OK:", result.mensaje);
        setEnviado(false);

    } catch (error) {
        setError({
            seccion: "general",
            mensaje: "Error de conexión con el servidor.",
        });
        setEnviado(false)
    }
    console.log("Enviando formulario con datos:", data);
    setEnviado(false)
    setPaso1(true)

    
    //window.location.href = "/";
        

    }

    const enviarFormCambio = async () =>{
        setError(null)
        setEnviado(true)

        if(!dataCambio.contrasena){
            setError( {
                seccion: "contrasena",
                mensaje: "La contrasenya és obligatòria."
            });
            setEnviado(false)
            return
        }

        if(!dataCambio.contrasena2){
            setError( {
                seccion: "contrasena2",
                mensaje: "La confirmació de la contrasenya és obligatòria."
            });
            setEnviado(false)
            return
        }


        try {
        const response = await fetch("/api/sesiones/restablecer-contrasena", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(dataCambio),
        });

        const result = await response.json();

        if (!response.ok) {
            setError({
                seccion: "general",
                mensaje: result.mensaje,
            });
            setEnviado(false)
            return;
        }

        console.log("OK:", result.mensaje);
        setEnviado(false);

    } catch (error) {
        setError({
            seccion: "general",
            mensaje: "Error de conexión con el servidor.",
        });
        setEnviado(false)
    }
    console.log("Enviando formulario con datos:", dataCambio);
    setEnviado(false)
    setPaso1(true)

    
    window.location.href = "/";
        

    }
    
  return (
    <>
    {
        !tokenRecuperar ? (
            <div className="w-full my-5 space-y-5 p-4 rounded-2xl bg-muted/40 border border-border">
            <div>
                <h1 className="font-bold text-2xl text-neutral-titulos text-center">Has oblidat la contrasenya?</h1>
                <p className="text-center">
                    Introdueix el teu correu electrònic i t'enviarem instruccions per recuperar la teva contrasenya.
                </p>
            </div>
            

            {/* Email */}

            <div className="space-y-1">

                <label className={`text-sm font-medium ${error?.seccion === "email" && 'text-error'}`}>Email</label>

                <div className="relative">

                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 -960 960 960"
                        className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 fill-neutral pointer-events-none"
                    >
                        <path d="M160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h640q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160zm320-280L160-640v400h640v-400zm0-80 320-200H160z"/>
                    </svg>

                    <input
                        type="email"
                        placeholder="usuari@alu.ibeducacio.es"
                        value={data.email}
                        onChange={(e) => actualizarCampo("email", e.target.value)}
                        className={`w-full rounded-xl border border-border bg-muted/40 py-3 pl-11 pr-4 outline-none transition focus:border-primary ${error?.seccion === "email" && 'border-error-foreground'}`}
                    />

                </div>

                {
                    error?.seccion === "email" &&(
                        <p className='text-sm text-error mt-1 ml-0.5'>{error.mensaje}</p>
                    )
                }

            </div>

            

            {
                error?.seccion === "general" &&(
                    <p className='text-sm text-error text-center mt-1 ml-0.5'>{error.mensaje}</p>
                )
            }
            

            {/* Botón */}

            <div
            onClick={() => enviarFormEmail()}
                className={`w-full rounded-2xl relative flex place-content-center group px-5 py-3 text-lg font-semibold transition hover:opacity-90 cursor-pointer text-center bg-primary text-secondary-variant ${paso1 && 'opacity-50 cursor-not-allowed'}`}
            >
                Enviar instruccions
            </div>

            

            {
                enviado && (
                    <Enviando />
                )
            }

        </div>
        ):(
            <>
            <div className="w-full my-5 space-y-5 p-4 rounded-2xl bg-muted/40 border border-border">
                <div>
                    <h1 className="font-bold text-2xl text-neutral-titulos text-center">
                        Estableix una nova contrasenya
                    </h1>

                    <p className="text-center">
                        Introdueix la teva nova contrasenya per completar el canvi i recuperar l’accés al teu compte.
                    </p>
                </div>
                

                {/* Email */}

                <div className="grid gap-4 ">

                <div className="space-y-1">

                    <label className={`text-sm font-medium ${error?.seccion === "contrasena" && 'text-error'}`}>Contrasenya</label>

                    <div className="relative">

                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 -960 960 960"
                            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 fill-neutral pointer-events-none"
                        >
                           <path d="M240-80q-33 0-56.5-23.5T160-160v-400q0-33 23.5-56.5T240-640h40v-80q0-83 58.5-141.5T480-920t141.5 58.5T680-720v80h40q33 0 56.5 23.5T800-560v400q0 33-23.5 56.5T720-80zm0-80h480v-400H240zm296.5-143.5Q560-327 560-360t-23.5-56.5T480-440t-56.5 23.5T400-360t23.5 56.5T480-280t56.5-23.5M360-640h240v-80q0-50-35-85t-85-35-85 35-35 85zM240-160v-400z"/>
                           
                        </svg>

                        <input
                            type={mostrarPassword ? "text" : "password"}
                            value={dataCambio.contrasena}
                            onChange={(e) => actualizarCampoCambio("contrasena", e.target.value)}
                            className="w-full rounded-xl border border-border bg-muted/40 py-3 px-11  outline-none transition focus:border-primary"
                        />

                        <span onClick={() => togglePassword("p1")} className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 fill-neutral hover:fill-secondary-variant duration-300 cursor-pointer">
                            {
                                mostrarPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960">
                                        <path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428m128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302m20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736zM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21zm168 168"/>
                                    </svg>
                                ):(
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960">
                                        <path d="M607.5-372.5Q660-425 660-500t-52.5-127.5T480-680t-127.5 52.5T300-500t52.5 127.5T480-320t127.5-52.5m-204-51Q372-455 372-500t31.5-76.5T480-608t76.5 31.5T588-500t-31.5 76.5T480-392t-76.5-31.5M214-281.5Q94-363 40-500q54-137 174-218.5T480-800t266 81.5T920-500q-54 137-174 218.5T480-200t-266-81.5m473.5-58Q782-399 832-500q-50-101-144.5-160.5T480-720t-207.5 59.5T128-500q50 101 144.5 160.5T480-280t207.5-59.5"/>
                                    </svg>
                                )
                            }
                            

                             
                        </span>

                    </div>

                    {
                        error?.seccion === "contrasena" &&(
                            <p className='text-sm text-error mt-1 ml-0.5'>{error.mensaje}</p>
                        )
                    }

                </div>

                <div className="space-y-1">

                    <label className={`text-sm font-medium ${error?.seccion === "contrasena2" && 'text-error'}`}>Confirmar Contrasenya</label>

                    <div className="relative">

                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 -960 960 960"
                            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 fill-neutral pointer-events-none"
                        >
                            <path d="M480-80q-83 0-156-31.5T197-197t-85.5-127T80-480h80q0 66 25 124.5t68.5 102 102 69T480-159q134 0 227-93t93-227-93-227-227-93q-89 0-161.5 43.5T204-640h116v80H80v-240h80v80q55-73 138-116.5T480-880q83 0 156 31.5T763-763t85.5 127T880-480t-31.5 156T763-197t-127 85.5T480-80m-80-240q-17 0-28.5-11.5T360-360v-120q0-17 11.5-28.5T400-520v-40q0-33 23.5-56.5T480-640t56.5 23.5T560-560v40q17 0 28.5 11.5T600-480v120q0 17-11.5 28.5T560-320zm40-200h80v-40q0-17-11.5-28.5T480-600t-28.5 11.5T440-560z"/>
                        </svg>

                        <input
                            type={mostrarPassword2 ? "text" : "password"}
                            value={dataCambio.contrasena2}
                            onChange={(e) => actualizarCampoCambio("contrasena2", e.target.value)}
                            className="w-full rounded-xl border border-border bg-muted/40 py-3 px-11 outline-none transition focus:border-primary"
                        />

                        <span onClick={() => togglePassword("p2")} className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 fill-neutral hover:fill-secondary-variant duration-300 cursor-pointer">
                            {
                                mostrarPassword2 ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960">
                                        <path d="m644-428-58-58q9-47-27-88t-93-32l-58-58q17-8 34.5-12t37.5-4q75 0 127.5 52.5T660-500q0 20-4 37.5T644-428m128 126-58-56q38-29 67.5-63.5T832-500q-50-101-143.5-160.5T480-720q-29 0-57 4t-55 12l-62-62q41-17 84-25.5t90-8.5q151 0 269 83.5T920-500q-23 59-60.5 109.5T772-302m20 246L624-222q-35 11-70.5 16.5T480-200q-151 0-269-83.5T40-500q21-53 53-98.5t73-81.5L56-792l56-56 736 736zM222-624q-29 26-53 57t-41 67q50 101 143.5 160.5T480-280q20 0 39-2.5t39-5.5l-36-38q-11 3-21 4.5t-21 1.5q-75 0-127.5-52.5T300-500q0-11 1.5-21t4.5-21zm168 168"/>
                                    </svg>
                                ):(
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960">
                                        <path d="M607.5-372.5Q660-425 660-500t-52.5-127.5T480-680t-127.5 52.5T300-500t52.5 127.5T480-320t127.5-52.5m-204-51Q372-455 372-500t31.5-76.5T480-608t76.5 31.5T588-500t-31.5 76.5T480-392t-76.5-31.5M214-281.5Q94-363 40-500q54-137 174-218.5T480-800t266 81.5T920-500q-54 137-174 218.5T480-200t-266-81.5m473.5-58Q782-399 832-500q-50-101-144.5-160.5T480-720t-207.5 59.5T128-500q50 101 144.5 160.5T480-280t207.5-59.5"/>
                                    </svg>
                                )
                            }
                        </span>

                    </div>

                    {
                        error?.seccion === "contrasena2" &&(
                            <p className='text-sm text-error mt-1 ml-0.5'>{error.mensaje}</p>
                        )
                    }

                </div>

            </div>

                

                {
                    error?.seccion === "general" &&(
                        <p className='text-sm text-error text-center mt-1 ml-0.5'>{error.mensaje}</p>
                    )
                }
                

                {/* Botón */}

                <div
                onClick={() => enviarFormCambio()}
                    className={`w-full rounded-2xl relative flex place-content-center group px-5 py-3 text-lg font-semibold transition hover:opacity-90 cursor-pointer text-center bg-primary text-secondary-variant ${paso1 && 'opacity-50 cursor-not-allowed'}`}
                >
                    Restablir contrasenya
                </div>

                

                {
                    enviado && (
                        <Enviando />
                    )
                }

            </div>
            </>
        )
    }

        
    </>
        
  );
}