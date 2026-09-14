# Esports IES Calvià

## Desarrollo

```sh
npm install
npm run dev -- --background
npm test
npm run build
```

Variables existentes en `.env`: `SUPABASE_URL`, `SUPABASE_KEY` y `SUPABASE_SERVICE_ROLE_KEY`.
Las credenciales se utilizan en el servidor. El bucket público para imágenes se llama `Torneos`.

## Roles y permisos

Los niveles están en `src/const/Permisos.ts`:

| Rol | Nivel |
| --- | --- |
| Voluntario | 1 |
| Staff | 2 |
| AdminTorneo | 3 |
| Admin | 4 |
| Desarrollador | 5 |

Las secciones pendientes tienen nivel 0. En tornejos, crear y editar requieren Staff (2), y eliminar requiere Admin general (4).
El permiso de eliminar está definido para futuras operaciones; todavía no se ha añadido una operación de borrado.

- Por debajo del nivel requerido: denegado, incluso con `true`.
- Al mismo nivel: ausente permite; `true` permite; `false` deniega.
- Por encima del nivel requerido: permitido, incluso con `false`.
- Una acción sin nivel específico hereda el de su sección.
- Una sección sin configurar o un rol desconocido no concede acceso.
- Con nivel 0, todos los roles reconocidos están por encima: un `false` no les deniega la acción. Es el comportamiento temporal solicitado.

`users.permisos` puede ser `null`. El nuevo formato separa los ámbitos:

```json
{
  "globales": {
    "tornejos": { "crear": true }
  },
  "torneos": {
    "UUID-DEL-TORNEO": {
      "acceso": true,
      "permisos": {
        "tornejos": { "editar": true },
        "edicions": { "crear": true },
        "partits": { "editar": false }
      }
    }
  }
}
```

Admin y Desarrollador acceden a todos los torneos. Voluntario, Staff y AdminTorneo solo a los que tengan asignados con `acceso: true`, independientemente del nivel de las acciones.
El rol sigue estando en `users.rol`; no se obtiene del JSON enviado por el navegador. No se modifica `origen_permisos` ni se introduce caducidad.

El JSON antiguo sin `globales` y `torneos` no se migra automáticamente. Los usuarios existentes con JSON null funcionan según su rol; una cuenta Admin o Desarrollador puede gestionar la plataforma sin asignaciones.

## Gestión de torneos

- Lista: `/panell/tornejos`.
- Crear: `/panell/info/torneig?accio=crear`.
- Consultar o editar: `/panell/info/torneig?accio=ver|editar&torneoID=UUID`.
- `api/torneos/crear.ts`: POST crea, PATCH actualiza. Validación, subida y guardado están en el mismo archivo.
- `api/torneos/info.ts`: GET consulta un torneo autorizado.
- `api/torneos/lista.ts`: GET devuelve los torneos accesibles.

Las imágenes PNG, JPG o WebP admiten hasta 2 MB cada una y se guardan bajo `Torneos/{UUID}/` con nombres únicos.
Si Staff o AdminTorneo crea un torneo, recibe la asignación en su JSON conservando el resto de sus permisos.
La asignación y el torneo son escrituras separadas: se intenta revertir la asignación y las nuevas imágenes si falla el guardado; no se trata de una transacción entre Storage y la base de datos.

Se reutiliza el formulario y el diseño existente para consulta y edición. La normativa antigua se conserva sin cambios cuando no se edita. Las imágenes anteriores no se borran al sustituirlas, para facilitar la futura migración. `updated_at` se comprueba para evitar sobrescribir una edición simultánea.

## Validación y migración

`npm test` comprueba las reglas de acceso y los handlers con Supabase simulado. No escribe en la base de datos ni en Storage.
La compilación y estas pruebas no sustituyen una comprobación con una cuenta real.

No se han ejecutado cambios de esquema ni migraciones de ediciones, equipos o partidos. Para preparar esa migración hacen falta las tablas antiguas y sus relaciones.
