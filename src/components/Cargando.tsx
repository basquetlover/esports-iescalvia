export default function Cargando() {
    return (
        <div className="w-full h-full relative z-100 top-0 left-0 flex flex-col items-center place-content-center bg-background/60 backdrop-blur-sm">
            <div className="w-full max-w-100 bg-background p-10 rounded-xl p-xl shadow-xxl border border-border flex flex-col gap-y-3 items-center text-center animate-in fade-in zoom-in duration-300">
            {/* <!-- Loading Illustration/Animation Container --> */}
            <div className="relative w-20 h-20 mb-lg">
            {/* <!-- Circular Spinner Base --> */}
            <div className="absolute inset-0 border-4 border-primary/10 rounded-full"></div>
            {/* <!-- Spinning Top Part --> */}
            <div className="absolute inset-0 border-4 border-t-secondary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin"></div>
            {/* <!-- Icon in the middle --> */}
            <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined fill-secondary text-4xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" viewBox="0 -960 960 960">
                    <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q17-72 85-137t145-65q33 0 56.5 23.5T520-716v242l64-62 56 56-160 160-160-160 56-56 64 62v-242q-76 14-118 73.5T280-520h-20q-58 0-99 41t-41 99 41 99 99 41h480q42 0 71-29t29-71-29-71-71-29h-60v-80q0-48-22-89.5T600-680v-93q74 35 117 103.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160zm220-358"/>
                </svg>
            </span>
            </div>
            </div>
            {/* <!-- Text Content --> */}
            <h3 className="text-lg font-semibold mb-sm">Carregant informació...</h3>
            <p className="text-gray-300 font-light mb-xl px-md">
                Si us plau, espera mentre es carrega la informació. No tanquis aquesta finestra.
            </p>
            {/* <!-- Custom Progress Bar --> */}
            <div className="loading-progress-bar">
            <div className="loading-progress-fill"></div>
            </div>
            {/* <!-- Footer Help Text --> */}
            <div className="mt-lg flex items-center gap-xs text-secondary">
            <span className="fill-secondary" >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 -960 960 960">
                    <path d="m438-338 226-226-57-57-169 169-84-84-57 57zm42 258q-139-35-229.5-159.5T160-516v-244l320-120 320 120v244q0 152-90.5 276.5T480-80m0-84q104-33 172-132t68-220v-189l-240-90-240 90v189q0 121 68 220t172 132m0-316"/>
                </svg>
            </span>
            <span className="font-ajuda-text text-ajuda-text">Connexió segura establerta</span>
            </div>
            </div>
        </div>
    )
}