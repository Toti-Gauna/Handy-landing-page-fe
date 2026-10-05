import assert from 'node:assert/strict';
import test from 'node:test';
import { camposRechazados, preregistroSchema } from './preregistro.ts';

test('el 400 del backend se traduce solo a campos conocidos del formulario', () => {
  assert.deepEqual(camposRechazados({ error: 'validacion', campos: ['email', 'zona', 'email'] }), ['email', 'zona']);
  assert.deepEqual(camposRechazados({ error: 'validacion', campos: ['"]evil', 'sitio_web'] }), []);
  assert.deepEqual(camposRechazados({ error: 'otro' }), []);
  assert.deepEqual(camposRechazados(null), []);
});

test('el cuerpo que manda el formulario de especialista cumple el contrato', () => {
  const r = preregistroSchema.safeParse({
    tipo: 'especialista',
    nombre: 'Ana',
    email: 'ANA@example.com ',
    whatsapp: '223 000-0001',
    rubros: ['gas'],
    zona: 'Centro',
    cuit: 'si',
    acepta: true,
  });
  assert.equal(r.success, true);
  assert.equal(r.success && r.data.email, 'ana@example.com');
});
