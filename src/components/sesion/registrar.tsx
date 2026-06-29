import { useState, useEffect } from 'react';

export default function Registro() {

  return (
   <div className='w-full h-auto my-5 space-y-2'>

        {/* Nombre + 1r Apellido */}
        <div className='w-full md:grid grid-cols-2 gap-2 space-y-2'>
            <div>
                <label>Nom</label>
                <input type='text' className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary' placeholder='El teu nom' />
            </div>

            <div>
                <label>Primer Cognom</label>
                <input type='text' className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary' placeholder='Cognom' />
            </div>
        </div>

        {/* 2n Apellido + Curso */}
        <div className='w-full md:grid grid-cols-2 gap-2 space-y-2'>
            <div>
                <label>Segon Cognom</label>
                <input type='text' className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary' placeholder='Segon congom' />
            </div>
            
            <div>
                <label>Curs</label>
                <div className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary'>
                &nbsp;
                </div>
            </div>
        </div>

        {/* Email */}
        <div className='w-full'>
            <label>Email</label>
            <input type='email' className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary' placeholder='usuari@alu.ibeducacio' />
        </div>

        {/* Contrasña + Confirmar contraseña */}
        <div className='w-full md:grid grid-cols-2 gap-2 space-y-2'>
            <div>
                <label>Cotrasenya</label>
                <input type='password' className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary' placeholder='' />
            </div>
            
            <div>
                <label>Confirmar Contrasenya</label>
                <input type='password' className='w-full bg-muted/40 px-3 py-2 rounded-lg border border-transparent ring:border-secondary' />
            </div>
        </div>

        {/* Terminos y condiciones */}
        <div className='flex flex-row gap-x-2 items-center'>
            <div  className='bg-muted w-5 h-5 rounded select-none active:bg-secondary'>&nbsp;</div>
            <p>Accepto els <a className='text-primary hover:underline'>Termes d'us</a> i la <a className='text-primary hover:underline'>Política de Privacitat</a></p>
        </div>

        {/* Enviar */}
        <div className='w-full px-4 py-3 font-semibold bg-primary text-secondary2 text-lg cursor-pointer hover:bg-primary/80 duration-300 text-center rounded-2xl'>
            <p>Finalitzar Registre</p>
        </div>
   </div>
  );
}