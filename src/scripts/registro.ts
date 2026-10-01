// Pre-registro: pestañas usuario/especialista, contador, validación con zod y envío al backend.
// No se guarda nada en el navegador (ni localStorage ni cookies).

import { iniciarComun } from './comun';
import { festejar, girar, sacudir } from './animaciones';
import { CONTADOR_MINIMO, FORM_ENDPOINT, TIMEOUT_MS } from '../config';
import { type Contador, type Tipo, contadorSchema, preregistroSchema } from '../schema/preregistro';
import textos from '../content/registro.json';

iniciarComun();

const $ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => raiz.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, raiz: ParentNode = document) => [...raiz.querySelectorAll<T>(sel)];

const tabs = $$<HTMLButtonElement>('[data-tab]');
const forms: Record<Tipo, HTMLFormElement> = {
  usuario: $<HTMLFormElement>('[data-form="usuario"]')!,
  especialista: $<HTMLFormElement>('[data-form="especialista"]')!,
};
const tarjeta = $('[data-tarjeta]')!;
const cajaError = $('[data-estado-error]')!;
const exito = $('[data-exito]')!;
const contadorEl = $('[data-contador]')!;

const habilitado = FORM_ENDPOINT !== '';
const parametro = new URLSearchParams(location.search).get('tipo');
let tipo: Tipo = parametro === 'especialista' ? 'especialista' : 'usuario';
let contador: Contador | null = null;

// ── Pestañas ──────────────────────────────────────────────────────────────

function activar(t: Tipo, foco = false) {
  tipo = t;
  tabs.forEach((b) => {
    const activa = b.dataset.tab === t;
    b.setAttribute('aria-selected', String(activa));
    b.tabIndex = activa ? 0 : -1;
    if (activa && foco) b.focus();
  });
  (Object.keys(forms) as Tipo[]).forEach((k) => (forms[k].hidden = k !== t));
  cajaError.hidden = true;
  const u = new URL(location.href);
  u.searchParams.set('tipo', t);
  history.replaceState(null, '', u);
  mostrarContador();
}

tabs.forEach((b, i) => {
  b.addEventListener('click', () => activar(b.dataset.tab as Tipo));
  b.addEventListener('keydown', (e) => {
    const mover = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!mover) return;
    e.preventDefault();
    const sig = tabs[(i + mover + tabs.length) % tabs.length];
    activar(sig.dataset.tab as Tipo, true);
  });
});

// ── Contador ──────────────────────────────────────────────────────────────

function mostrarContador() {
  if (!habilitado) {
    contadorEl.hidden = true;
    return;
  }
  const n = contador ? (tipo === 'usuario' ? contador.usuarios : contador.especialistas) : null;
  contadorEl.textContent =
    n !== null && n >= CONTADOR_MINIMO
      ? textos.contador[tipo].replace('{n}', n.toLocaleString('es-AR'))
      : textos.contador.sumate;
  contadorEl.hidden = false;
}

async function pedirContador() {
  try {
    const r = await fetch(`${FORM_ENDPOINT}/preregistro/contador`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return;
    const ok = contadorSchema.safeParse(await r.json());
    if (ok.success) {
      contador = ok.data;
      mostrarContador();
    }
  } catch {
    // Sin contador: queda "Sumate a la lista".
  }
}

// ── Validación ────────────────────────────────────────────────────────────

const errores = textos.errores as Record<string, string>;

function leer(form: HTMLFormElement, t: Tipo): Record<string, unknown> {
  const fd = new FormData(form);
  const texto = (k: string) => String(fd.get(k) ?? '').trim();
  const opcional = (k: string) => texto(k) || undefined;
  const comunes = {
    tipo: t,
    nombre: texto('nombre'),
    email: texto('email'),
    acepta: fd.get('acepta') === 'on',
    sitio_web: opcional('sitio_web'),
  };
  const datos: Record<string, unknown> =
    t === 'usuario'
      ? { ...comunes, whatsapp: opcional('whatsapp'), barrio: texto('barrio'), necesidad: opcional('necesidad') }
      : {
          ...comunes,
          whatsapp: texto('whatsapp'),
          rubros: fd.getAll('rubros').map(String),
          zona: texto('zona'),
          cuit: opcional('cuit'),
        };
  // No mandar claves vacías: el backend recibe solo lo que se completó.
  Object.keys(datos).forEach((k) => datos[k] === undefined && delete datos[k]);
  return datos;
}

function limpiarErrores(form: HTMLFormElement) {
  $$('[data-error-de]', form).forEach((p) => (p.textContent = ''));
  $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  $$('.campo--invalido', form).forEach((el) => el.classList.remove('campo--invalido'));
  const resumen = $('[data-resumen]', form);
  if (resumen) resumen.textContent = '';
}

function marcarError(form: HTMLFormElement, campo: string) {
  const p = $(`[data-error-de="${campo}"]`, form);
  if (p) p.textContent = errores[campo] ?? errores.resumen;
  $(`[data-campo="${campo}"]`, form)?.classList.add('campo--invalido');
  $$<HTMLInputElement>(`[name="${campo}"]`, form).forEach((el) => el.setAttribute('aria-invalid', 'true'));
}

function validar(form: HTMLFormElement, datos: Record<string, unknown>) {
  limpiarErrores(form);
  const r = preregistroSchema.safeParse(datos);
  if (r.success) return r.data;
  const campos = [...new Set(r.error.issues.map((i) => String(i.path[0] ?? 'resumen')))];
  campos.forEach((c) => marcarError(form, c));
  const resumen = $('[data-resumen]', form);
  if (resumen) resumen.textContent = errores.resumen;
  // Foco en el primer campo con error, en el orden del formulario.
  const primero = $$<HTMLElement>('[aria-invalid="true"]', form)[0];
  primero?.focus();
  return null;
}

// Al corregir un campo se borra su error.
(Object.values(forms) as HTMLFormElement[]).forEach((form) => {
  form.addEventListener('input', (e) => {
    const nombre = (e.target as HTMLInputElement).name;
    if (!nombre) return;
    const p = $(`[data-error-de="${nombre}"]`, form);
    if (p) p.textContent = '';
    $(`[data-campo="${nombre}"]`, form)?.classList.remove('campo--invalido');
    $$(`[name="${nombre}"]`, form).forEach((el) => el.removeAttribute('aria-invalid'));
  });
});

// ── Envío ─────────────────────────────────────────────────────────────────

function cargando(form: HTMLFormElement, si: boolean): () => void {
  const boton = $<HTMLButtonElement>('[data-enviar]', form)!;
  const texto = $('[data-enviar-texto]', boton)!;
  boton.disabled = si;
  form.setAttribute('aria-busy', String(si));
  texto.textContent = si ? (boton.dataset.enviando ?? '') : (boton.dataset.texto ?? '');
  return si ? girar($('.form__engranaje', form)) : () => {};
}

function mostrarExito(t: Tipo, nombre: string) {
  tarjeta.hidden = true;
  contadorEl.hidden = true;
  const primerNombre = nombre.split(/\s+/)[0];
  const titulo = $('[data-exito-titulo]', exito)!;
  titulo.textContent = (titulo.dataset.plantilla ?? '').replace('{nombre}', primerNombre);
  const texto = $('[data-exito-texto]', exito)!;
  texto.textContent = (t === 'usuario' ? texto.dataset.usuario : texto.dataset.especialista) ?? '';
  const compartir = $<HTMLAnchorElement>('[data-compartir]', exito)!;
  const link = location.origin + import.meta.env.BASE_URL;
  compartir.href = 'https://wa.me/?text=' + encodeURIComponent((compartir.dataset.mensaje ?? '').replace('{url}', link));
  exito.hidden = false;
  exito.scrollIntoView({ behavior: 'smooth', block: 'center' });
  exito.focus({ preventScroll: true });
  festejar($('[data-festejo]', exito));
}

async function enviar(t: Tipo, datos: Record<string, unknown>) {
  const form = forms[t];
  cajaError.hidden = true;
  const frenar = cargando(form, true);
  try {
    const r = await fetch(`${FORM_ENDPOINT}/preregistro`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    frenar();
    cargando(form, false);
    mostrarExito(t, String(datos.nombre));
  } catch {
    frenar();
    cargando(form, false);
    cajaError.hidden = false;
    $<HTMLButtonElement>('[data-reintentar]', cajaError)?.focus();
    sacudir($('.estado__handy', cajaError));
  }
}

(Object.entries(forms) as [Tipo, HTMLFormElement][]).forEach(([t, form]) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!habilitado) return;
    const datos = leer(form, t);
    // Honeypot completo: es un bot. Le mostramos éxito sin mandar nada.
    if (datos.sitio_web) {
      mostrarExito(t, String(datos.nombre || ''));
      return;
    }
    const validos = validar(form, datos);
    if (validos) enviar(t, validos as Record<string, unknown>);
  });
});

// Reintentar vuelve a enviar lo que está en el formulario (por si se corrigió algo).
$('[data-reintentar]', cajaError)?.addEventListener('click', () => forms[tipo].requestSubmit());

// ── Arranque ──────────────────────────────────────────────────────────────

activar(tipo);

if (!habilitado) {
  $('[data-deshabilitado]')!.hidden = false;
  $$<HTMLButtonElement>('[data-enviar]').forEach((b) => {
    b.disabled = true;
    $('[data-enviar-texto]', b)!.textContent = b.dataset.deshabilitado ?? '';
  });
} else {
  pedirContador();
}
