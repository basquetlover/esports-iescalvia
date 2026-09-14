import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { tienePermiso, tieneAccesoTorneo } from "../src/const/Permisos.ts";

// Ejecutar los handlers reales con Supabase simulado: ninguna escritura externa.
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const usuarioID = "33333333-3333-4333-8333-333333333333";
let numeroModulo = 0;

async function preparar({ rol = "Admin", permisos = null, sesion = true, fallo = "", existentes = [] } = {}) {
    const usuario = sesion ? { id: usuarioID, rol, permisos } : null;
    const estado = { usuario, escrituras: [], subidas: [], eliminadas: [], torneos: [...existentes], permisos };
    const supabaseAdmin = {
        from(tabla) {
            let operacion = "select", valores, filtros = [];
            const consulta = {
                select() { return consulta; },
                eq(campo, valor) { filtros.push([campo, valor]); return consulta; },
                is(campo, valor) { filtros.push([campo, valor]); return consulta; },
                insert(datos) { operacion = "insert"; valores = datos; return consulta; },
                update(datos) { operacion = "update"; valores = datos; return consulta; },
                maybeSingle() { return ejecutar(true); },
                then(resolve, reject) { return ejecutar(false).then(resolve, reject); },
            };
            async function ejecutar(single) {
                if (operacion !== "select") {
                    estado.escrituras.push({ tabla, operacion, valores, filtros });
                    if (tabla === "users") {
                        if (fallo === "asignacion") return { data: null, error: null };
                        estado.permisos = valores.permisos;
                        return { data: { id: usuarioID }, error: null };
                    }
                    if (fallo === "guardar") return { data: null, error: new Error("Fallo simulado al guardar") };
                    if (fallo === "version") return { data: null, error: null };
                    if (operacion === "insert") estado.torneos.push(valores);
                    else {
                        const existente = estado.torneos.find(t => t.id === filtros.find(([k]) => k === "id")?.[1]);
                        if (existente) Object.assign(existente, valores);
                    }
                    return { data: { id: valores.id || A }, error: null };
                }
                const filas = tabla === "torneos" ? estado.torneos : [];
                return { data: single ? filas.find(t => filtros.every(([k, v]) => t[k] === v)) || null : filas, error: null };
            }
            return consulta;
        },
        storage: {
            from(bucket) {
                assert.equal(bucket, "Torneos");
                return {
                    async upload(ruta) {
                        if (fallo === "banner" && ruta.includes("/banner-")) return { error: new Error("Fallo simulado de imagen") };
                        estado.subidas.push(ruta); return { error: null };
                    },
                    getPublicUrl(ruta) { return { data: { publicUrl: "https://storage.test/" + ruta } }; },
                    async remove(rutas) { estado.eliminadas.push(...rutas); return { error: null }; },
                };
            },
        },
    };
    globalThis.__torneosPrueba = { supabaseAdmin, obtenerUsuarioPorToken: async () => usuario, tienePermiso, tieneAccesoTorneo };
    const rutas = {};
    for (const nombre of ["crear", "info", "lista"]) {
        let codigo = await readFile(new URL("../src/pages/api/torneos/" + nombre + ".ts", import.meta.url), "utf8");
        codigo = codigo.split("\n").filter(linea => !linea.startsWith("import ")).join("\n");
        codigo = "const { supabaseAdmin, obtenerUsuarioPorToken, tienePermiso, tieneAccesoTorneo } = globalThis.__torneosPrueba;\n" + codigo;
        rutas[nombre] = await import("data:text/javascript;base64," + Buffer.from(stripTypeScriptTypes(codigo)).toString("base64") + "#" + numeroModulo++);
    }
    async function llamar(ruta, method = "GET", formulario, id, origen = "https://portal.test") {
        const url = new URL("https://portal.test/api/torneos/" + ruta);
        if (id) url.searchParams.set("torneoID", id);
        const request = new Request(url, { method, headers: { origin: origen }, ...(formulario ? { body: formulario } : {}) });
        return rutas[ruta][method]({ request, url, cookies: { get: () => sesion ? { value: "sesion-prueba" } : undefined } });
    }
    return { estado, llamar };
}

function formulario() {
    const data = new FormData();
    data.set("nombre", "  Copa del centre  ");
    data.set("deporte", "Voleibol");
    data.set("descripcion", "Descripció");
    data.set("normativa", JSON.stringify([{ numero: 5, titulo: "Bases", articulos: [{ numero: "5.8", texto: "Respecte" }] }]));
    data.set("updated_at", "");
    return data;
}
function png() { return new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])], { type: "image/png" }); }

test("API: sin sesión y sin nivel no hay escrituras", async () => {
    for (const opciones of [{ sesion: false }, { rol: "Voluntario" }]) {
        const { llamar, estado } = await preparar(opciones);
        const respuesta = await llamar("crear", "POST", formulario());
        assert.equal(respuesta.status, opciones.sesion === false ? 401 : 403);
        assert.equal(estado.escrituras.length, 0);
        assert.equal(estado.subidas.length, 0);
    }
});
test("API: origen ajeno, datos inválidos e imágenes falsas se rechazan antes de escribir", async () => {
    const { llamar, estado } = await preparar();
    assert.equal((await llamar("crear", "POST", formulario(), undefined, "https://otro.test")).status, 403);
    const datos = formulario(); datos.set("nombre", "");
    assert.equal((await llamar("crear", "POST", datos)).status, 400);
    const imagen = formulario(); imagen.set("logo", new Blob(["no es png"], { type: "image/png" }), "logo.png");
    assert.equal((await llamar("crear", "POST", imagen)).status, 400);
    const normativa = formulario(); normativa.set("normativa", '[{"titulo":"Bases","articulos":[null]}]');
    assert.equal((await llamar("crear", "POST", normativa)).status, 400);
    assert.equal(estado.escrituras.length, 0);
    assert.equal(estado.subidas.length, 0);
});
test("API: creación guarda UUID, normativa renumerada y rutas públicas", async () => {
    const { llamar, estado } = await preparar();
    const datos = formulario(); datos.set("logo", png(), "logo.png");
    const respuesta = await llamar("crear", "POST", datos);
    assert.equal(respuesta.status, 201);
    const { id } = await respuesta.json();
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.ok(estado.subidas[0].startsWith(id + "/logo-"));
    assert.equal(estado.torneos[0].nombre, "Copa del centre");
    assert.equal(JSON.parse(estado.torneos[0].normativa_base)[0].articulos[0].numero, "1.1");
    assert.equal(estado.eliminadas.length, 0);
});
test("API: Staff obtiene asignación al crear sin perder permisos globales", async () => {
    const permisos = { globales: { tornejos: { crear: true } }, torneos: { [B]: { acceso: true, permisos: {} } } };
    const { llamar, estado } = await preparar({ rol: "Staff", permisos });
    const respuesta = await llamar("crear", "POST", formulario());
    assert.equal(respuesta.status, 201);
    const { id } = await respuesta.json();
    assert.equal(estado.permisos.torneos[id].acceso, true);
    assert.deepEqual(estado.permisos.globales, permisos.globales);
    assert.deepEqual(estado.permisos.torneos[B], permisos.torneos[B]);
});
test("API: AdminTorneo no puede consultar ni editar otro torneo", async () => {
    const { llamar, estado } = await preparar({ rol: "AdminTorneo", permisos: { torneos: { [A]: { acceso: true, permisos: {} } } } });
    assert.equal((await llamar("info", "GET", undefined, B)).status, 403);
    assert.equal((await llamar("crear", "PATCH", formulario(), B)).status, 403);
    assert.equal(estado.escrituras.length, 0);
});
test("API: lista filtra torneos asignados", async () => {
    const { llamar } = await preparar({ rol: "AdminTorneo", permisos: { torneos: { [A]: { acceso: true, permisos: {} } } },
        existentes: [{ id: A }, { id: B }] });
    const respuesta = await llamar("lista");
    assert.equal(respuesta.status, 200);
    assert.deepEqual((await respuesta.json()).data.map(t => t.id), [A]);
});
test("API: editar conserva normativa e imágenes antiguas si no se cambian", async () => {
    const { llamar, estado } = await preparar({ existentes: [{ id: A, logo: "logo-antiguo", banner: "banner-antiguo", normativa_base: "Texto antiguo sin JSON", updated_at: null }] });
    const datos = formulario(); datos.set("normativa", "");
    const respuesta = await llamar("crear", "PATCH", datos, A);
    assert.equal(respuesta.status, 200);
    assert.equal(estado.torneos[0].logo, "logo-antiguo");
    assert.equal(estado.torneos[0].normativa_base, "Texto antiguo sin JSON");
});
test("API: versión antigua y torneo inexistente no se sobrescriben", async () => {
    const { llamar, estado } = await preparar({ existentes: [{ id: A, updated_at: "2026-09-01T00:00:00Z" }] });
    assert.equal((await llamar("crear", "PATCH", formulario(), A)).status, 409);
    assert.equal((await llamar("crear", "PATCH", formulario(), B)).status, 404);
    assert.equal(estado.escrituras.length, 0);
});
test("API: fallo de segunda imagen limpia solo la nueva subida", async (t) => {
    t.mock.method(console, "error", () => {});
    const { llamar, estado } = await preparar({ fallo: "banner" });
    const datos = formulario(); datos.set("logo", png(), "logo.png"); datos.set("banner", png(), "banner.png");
    const respuesta = await llamar("crear", "POST", datos);
    assert.equal(respuesta.status, 500);
    assert.deepEqual(estado.eliminadas, estado.subidas);
    assert.equal(estado.escrituras.length, 0);
});
test("API: fallo al guardar revierte la asignación y las imágenes nuevas", async (t) => {
    t.mock.method(console, "error", () => {});
    const { llamar, estado } = await preparar({ rol: "Staff", fallo: "guardar" });
    const datos = formulario(); datos.set("logo", png(), "logo.png");
    assert.equal((await llamar("crear", "POST", datos)).status, 500);
    assert.equal(estado.permisos, null);
    assert.deepEqual(estado.eliminadas, estado.subidas);
});
