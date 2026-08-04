export default function CerrarSessio() {
    return(
        <>
            <div className="w-full flex items-center place-content-center gap-x-2 fill-secondary-variant text-secondary-variant hover:underline cursor-pointer hover:fill-secondary hover:text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 -960 960 960">
                    <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200z"/>
                </svg>
                <p>Tancar Sessió</p>
            </div>
        </>
    )
}