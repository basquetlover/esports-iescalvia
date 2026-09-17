export const MENU = [
    {
        nombre: 'Inici',
        enlace: `/`,
        estado: 'Activa'
    },
    {
        nombre: 'Tornejos',
        enlace: `/tornejos`,
        estado: 'Activa'
    },
    {
        nombre: 'Calendari',
        enlace: `/calenadri`,
        estado: 'Pròximament'
    },
    {
        nombre: 'Notícies',
        enlace: `/noticies`,
        estado: 'Activa'
    },
    {
        nombre: 'Contacte',
        enlace: `/contacte`,
        estado: 'Activa'
    },
    {
        nombre: 'Galeria',
        enlace: `/galeria`,
        estado: 'Pròximament'
    }
];

export const MENU_PERFIL = [
    {
        nombre: 'El meu resum',
        enlace: `/perfil`,
        estado: 'Activa',
        icono: '<path d="M520-600v-240h320v240zM120-440v-400h320v400zm400 320v-400h320v400zm-400 0v-240h320v240zm80-400h160v-240H200zm400 320h160v-240H600zm0-480h160v-80H600zM200-200h160v-80H200zm160-80"/>',
    },
    {
        nombre: 'Les meves inscripcions',
        enlace: `/perfil/inscripcions`,
        estado: 'Pròximament',
        icono: '<path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h168q13-36 43.5-58t68.5-22 68.5 22 43.5 58h168q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120zm0-80h560v-560H200zm80-80h280v-80H280zm0-160h400v-80H280zm0-160h400v-80H280zm221.5-198.5Q510-807 510-820t-8.5-21.5T480-850t-21.5 8.5T450-820t8.5 21.5T480-790t21.5-8.5M200-200v-560z"/>',
    },
    {
        nombre: 'Pròxims partits',
        enlace: `/perfil/partits`,
        estado: 'Pròximament',
        icono: '<path d="M509-269q-29-29-29-71t29-71 71-29 71 29 29 71-29 71-71 29-71-29M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80zm0-80h560v-400H200zm0-480h560v-80H200zm0 0v-80z"/>',
    },
    {
        nombre: 'Historial de resultats',
        enlace: `/perfil/historial`,
        estado: 'Pròximament',
        icono: '<path d="M480-120q-138 0-240.5-91.5T122-440h82q14 104 92.5 172T480-200q117 0 198.5-81.5T760-480t-81.5-198.5T480-760q-69 0-129 32t-101 88h110v80H120v-240h80v94q51-64 124.5-99T480-840q75 0 140.5 28.5t114 77 77 114T840-480t-28.5 140.5-77 114-114 77T480-120m112-192L440-464v-216h80v184l128 128z"/>',
    },
]

export const MENU_ADMIN = [
    {
        nombre: 'Inici',
        enlace: '/panell',
        id: "panel",
        estado: 'Activa',
        icono: '<path d="M520-600v-240h320v240zM120-440v-400h320v400zm400 320v-400h320v400zm-400 0v-240h320v240zm80-400h160v-240H200zm400 320h160v-240H600zm0-480h160v-80H600zM200-200h160v-80H200zm160-80"/>',
    },
    {
        nombre: 'Notícies',
        enlace: '/panell/noticies',
        id:"noticies",
        estado: 'Activa',
        icono: '<path d="M160-120q-33 0-56.5-23.5T80-200v-640l67 67 66-67 67 67 67-67 66 67 67-67 67 67 66-67 67 67 67-67 66 67 67-67v640q0 33-23.5 56.5T800-120zm0-80h280v-240H160zm360 0h280v-80H520zm0-160h280v-80H520zM160-520h640v-120H160z"/>',
    },
    {
        nombre: 'Tornejos',
        enlace: '/panell/tornejos',
        id:"tornejos",
        estado: 'Activa',
        icono: '<path d="M280-120v-80h160v-124q-49-11-87.5-41.5T296-442q-75-9-125.5-65.5T120-640v-40q0-33 23.5-56.5T200-760h80v-80h400v80h80q33 0 56.5 23.5T840-680v40q0 76-50.5 132.5T664-442q-18 46-56.5 76.5T520-324v124h160v80zm0-408v-152h-80v40q0 38 22 68.5t58 43.5m285 93q35-35 35-85v-240H360v240q0 50 35 85t85 35 85-35m115-93q36-13 58-43.5t22-68.5v-40h-80zm-200-52"/>',
    },
    {
        nombre: `Gestió d'usuaris`,
        enlace: '/panell/usuaris',
        id:"usuarios",
        estado: 'Activa',
        icono: '<path d="M287-527q-47-47-47-113t47-113 113-47 113 47 47 113-47 113-113 47-113-47M80-160v-112q0-33 17-62t47-44q51-26 115-44t141-18h14q6 0 12 2-8 18-13.5 37.5T404-360h-4q-71 0-127.5 18T180-306q-9 5-14.5 14t-5.5 20v32h252q6 21 16 41.5t22 38.5zm560 40-12-60q-12-5-22.5-10.5T584-204l-58 18-40-68 46-40q-2-14-2-26t2-26l-46-40 40-68 58 18q11-8 21.5-13.5T628-460l12-60h80l12 60q12 5 22.5 11t21.5 15l58-20 40 70-46 40q2 12 2 25t-2 25l46 40-40 68-58-18q-11 8-21.5 13.5T732-180l-12 60zm96.5-143.5Q760-287 760-320t-23.5-56.5T680-400t-56.5 23.5T600-320t23.5 56.5T680-240t56.5-23.5m-280-320Q480-607 480-640t-23.5-56.5T400-720t-56.5 23.5T320-640t23.5 56.5T400-560t56.5-23.5M412-240"/>',
    },
    {
        nombre: 'Gestió de permisos',
        enlace: '/panell/permisos',
        id: "permisos",
        estado: 'Activa',
        icono: '<path d="M511-160H160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440v80q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32h245q4 21 10.5 41t15.5 39m209 80q-73-18-116.5-80T560-298v-102l160-80 160 80v102q0 76-43.5 138T720-80m0-84q38-18 59-55t21-79v-52l-80-40-80 40v52q0 42 21 79t59 55M367-527q-47-47-47-113t47-113 113-47 113 47 47 113-47 113-113 47-113-47m169.5-56.5Q560-607 560-640t-23.5-56.5T480-720t-56.5 23.5T400-640t23.5 56.5T480-560t56.5-23.5M720-277"/>',
    },
    {
        nombre: 'Configuració de la plataforma',
        enlace: '/panell/configuracio',
        id: "configuracion",
        estado: 'Activa',
        icono: '<path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5-2-31.5-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266zm42-180q58 0 99-41t41-99-41-99-99-41q-59 0-99.5 41T342-480t40.5 99 99.5 41m-2-140"/>',
    }
]
