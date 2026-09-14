import { test } from "node:test";
import assert from "node:assert/strict";
import { NIVELES_PERMISOS, tienePermiso, tieneAccesoTorneo } from "./Permisos.ts";

const torneoA = "11111111-1111-4111-8111-111111111111";
const torneoB = "22222222-2222-4222-8222-222222222222";

test("crear: nivel inferior denegado, igual respeta false, superior lo supera", () => {
    for (const valor of [undefined, true, false]) {
        const permisos = { globales: { tornejos: valor === undefined ? {} : { crear: valor } } };
        assert.equal(tienePermiso({ rol: "Voluntario", permisos }, "tornejos", "crear"), false);
        assert.equal(tienePermiso({ rol: "Staff", permisos }, "tornejos", "crear"), valor !== false);
        assert.equal(tienePermiso({ rol: "AdminTorneo", permisos }, "tornejos", "crear"), true);
    }
});

test("eliminar exige Admin general", () => {
    assert.equal(tienePermiso({ rol: "AdminTorneo", permisos: { globales: { tornejos: { eliminar: true } } } }, "tornejos", "eliminar"), false);
    assert.equal(tienePermiso({ rol: "Admin", permisos: { globales: { tornejos: { eliminar: false } } } }, "tornejos", "eliminar"), false);
    assert.equal(tienePermiso({ rol: "Desarrollador", permisos: { globales: { tornejos: { eliminar: false } } } }, "tornejos", "eliminar"), true);
});

test("JSON null permite por nivel pero no asigna torneos a Staff o AdminTorneo", () => {
    assert.equal(tienePermiso({ rol: "Staff", permisos: null }, "tornejos", "crear"), true);
    assert.equal(tieneAccesoTorneo({ rol: "Staff", permisos: null }, torneoA), false);
    assert.equal(tieneAccesoTorneo({ rol: "AdminTorneo", permisos: null }, torneoA), false);
    assert.equal(tieneAccesoTorneo({ rol: "Admin", permisos: null }, torneoA), true);
    assert.equal(tieneAccesoTorneo({ rol: "Desarrollador", permisos: null }, torneoA), true);
});

test("asignaciones y permisos aislados por torneo y ámbito global", () => {
    const usuario = { rol: "Staff", permisos: {
        globales: { tornejos: { editar: true } },
        torneos: {
            [torneoA]: { acceso: true, permisos: { tornejos: { editar: false } } },
            [torneoB]: { acceso: true, permisos: {} },
        }
    } };
    assert.equal(tienePermiso(usuario, "tornejos", "editar"), true);
    assert.equal(tienePermiso(usuario, "tornejos", "editar", torneoA), false);
    assert.equal(tienePermiso(usuario, "tornejos", "editar", torneoB), true);
    assert.equal(tienePermiso(usuario, "tornejos", "editar", "otro"), false);
    assert.equal(tieneAccesoTorneo({ rol: "AdminTorneo", permisos: { torneos: { [torneoA]: { acceso: false } } } }, torneoA), false);
    assert.equal(tieneAccesoTorneo({ rol: "AdminTorneo", permisos: { globales: { tornejos: { ver: true } } } }, torneoA), false);
});

test("acciones heredan el nivel de sección; false no equivale a ausente", () => {
    const anterior = NIVELES_PERMISOS.pistes.nivel;
    NIVELES_PERMISOS.pistes.nivel = 2;
    try {
        assert.equal(tienePermiso({ rol: "Staff", permisos: null }, "pistes"), true);
        assert.equal(tienePermiso({ rol: "Staff", permisos: { globales: { pistes: { ver: false } } } }, "pistes"), false);
        assert.equal(tienePermiso({ rol: "AdminTorneo", permisos: { globales: { pistes: { ver: false } } } }, "pistes"), true);
        assert.equal(tienePermiso({ rol: "Voluntario" }, "pistes"), false);
    } finally { NIVELES_PERMISOS.pistes.nivel = anterior; }
});

test("roles, secciones y valores mal formados no conceden acceso", () => {
    assert.equal(tienePermiso({ rol: " staff " }, "tornejos", "crear"), true);
    for (const valor of [null, "false", 1]) {
        assert.equal(tienePermiso({ rol: "Staff", permisos: { globales: { tornejos: { crear: valor } } } }, "tornejos", "crear"), false);
    }
    for (const rol of ["", "Otro", "constructor"]) assert.equal(tienePermiso({ rol }, "panell"), false);
    assert.equal(tienePermiso({ rol: "Desarrollador" }, "constructor"), false);
    assert.equal(tienePermiso({ rol: "Desarrollador" }, "no-configurada"), false);
    assert.equal(tienePermiso(null, "panell"), false);
});
