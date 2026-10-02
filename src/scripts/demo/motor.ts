// Motor de la demo interactiva. Vuelve navegables las pantallas que se arman en build
// (ver el contrato en src/render/demo/tipos.ts) y maneja el recorrido, el modo automático
// y el modo presentación. Los comportamientos propios de cada rol viven en usuario.ts / especialista.ts.

import demo from '../../content/demo.json';

export type Rol = 'usuario' | 'especialista';

export interface Motor {
  /** Rol activo. */
  readonly rol: Rol;
  /** Id de la pantalla (u hoja) que está arriba de todo. */
  readonly actual: string;
  /** Navega a una pantalla (o abre una hoja) y la apila. */
  ir(id: string): void;
  /** Vuelve a la anterior (o cierra la hoja). */
  volver(): void;
  /** Cambia de pestaña: reinicia la pila con esa pantalla. */
  raiz(id: string): void;
  /** Elemento de una pantalla (por defecto, la actual). */
  pantalla(id?: string): HTMLElement;
  /** setTimeout que se cancela solo cuando la pantalla deja de verse. */
  timeout(fn: () => void, ms: number): void;
  /** setInterval que se cancela solo cuando la pantalla deja de verse. */
  intervalo(fn: () => void, ms: number): void;
  /** Marca a mano lo próximo para tocar (si no, se usa [data-guia] de la pantalla). */
  guia(el: Element | null): void;
  /** Mensaje para lectores de pantalla. */
  anunciar(texto: string): void;
  /** true si el usuario pidió reducir el movimiento: no animar. */
  readonly reducido: boolean;
  /** Estado compartido del rol (se vacía con "Volver a empezar" y al cambiar de rol). */
  estado: Record<string, unknown>;
}

export interface ModuloRol {
  /** Acciones para data-accion="nombre". */
  acciones?: Record<string, (el: HTMLElement, m: Motor) => void>;
  /** Al entrar a una pantalla. Puede devolver una función de limpieza (se llama al salir). */
  entrar?: Record<string, (pantalla: HTMLElement, m: Motor) => void | (() => void)>;
  /** Vuelve el DOM dinámico del rol a como salió del build (al reiniciar o cambiar de rol). */
  reiniciar?: (m: Motor) => void;
}

const modulos = new Map<Rol, ModuloRol>();

export function registrarRol(rol: Rol, modulo: ModuloRol) {
  modulos.set(rol, modulo);
}

const reducido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const DURACION = 380;
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export function iniciarDemo() {
  const raizDemo = document.querySelector<HTMLElement>('[data-demo]');
  const contenedor = document.querySelector<HTMLElement>('[data-demo-pantallas]');
  if (!raizDemo || !contenedor) return;
  const raizEl: HTMLElement = raizDemo;
  const cont: HTMLElement = contenedor;

  const pantallas = new Map<string, HTMLElement>();
  cont.querySelectorAll<HTMLElement>('[data-pantalla]').forEach((el) => pantallas.set(el.dataset.pantalla!, el));
  const anuncio = raizEl.querySelector<HTMLElement>('[data-demo-anuncio]')!;
  const dedo = cont.querySelector<HTMLElement>('[data-demo-dedo]')!;
  const progreso = raizEl.querySelector<HTMLElement>('[data-demo-progreso]');
  const botonPlay = raizEl.querySelector<HTMLButtonElement>('[data-demo-control="reproducir"]');

  const inicioDe = (r: Rol) =>
    raizEl.querySelector<HTMLElement>(`[data-demo-recorrido="${r}"]`)?.dataset.inicio ?? (r === 'usuario' ? 'u-inicio' : 'e-inicio');

  // ── Estado ──────────────────────────────────────────────────────────────
  let rol: Rol = 'usuario';
  let pila: string[] = [];
  let guiaManual: Element | null = null;
  let pasoActivo = 0;
  let reproduciendo = false;
  let ocupado = false;
  const limpiezas = new Map<string, (() => void)[]>();

  const top = () => pila[pila.length - 1];
  const esHoja = (id: string) => pantallas.get(id)?.dataset.tipo === 'hoja';
  /** Pantalla "de fondo" visible (la última que no es hoja). */
  const fondo = () => [...pila].reverse().find((id) => !esHoja(id))!;

  const motor: Motor = {
    get rol() {
      return rol;
    },
    get actual() {
      return top();
    },
    ir: (id) => void navegar(id, 'ir'),
    volver: () => void volver(),
    raiz: (id) => void navegar(id, 'raiz'),
    pantalla: (id) => pantallas.get(id ?? top())!,
    timeout(fn, ms) {
      const id = top();
      const t = window.setTimeout(fn, ms);
      agregarLimpieza(id, () => window.clearTimeout(t));
    },
    intervalo(fn, ms) {
      const id = top();
      const t = window.setInterval(fn, ms);
      agregarLimpieza(id, () => window.clearInterval(t));
    },
    guia(el) {
      guiaManual = el;
      pintarGuia();
    },
    anunciar(texto) {
      anuncio.textContent = '';
      window.setTimeout(() => (anuncio.textContent = texto), 30);
    },
    get reducido() {
      return reducido();
    },
    estado: {},
  };

  function agregarLimpieza(id: string, fn: () => void) {
    const l = limpiezas.get(id) ?? [];
    l.push(fn);
    limpiezas.set(id, l);
  }

  function salir(id: string) {
    limpiezas.get(id)?.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
    limpiezas.delete(id);
  }

  function entrar(id: string) {
    const fn = modulos.get(rol)?.entrar?.[id];
    if (!fn) return;
    try {
      const limpieza = fn(pantallas.get(id)!, motor);
      if (typeof limpieza === 'function') agregarLimpieza(id, limpieza);
    } catch (e) {
      console.error(e);
    }
  }

  // ── Transiciones ────────────────────────────────────────────────────────

  function animar(el: HTMLElement, frames: Keyframe[], ms = DURACION): Promise<void> {
    if (reducido() || !el.animate) return Promise.resolve();
    return el.animate(frames, { duration: ms, easing: CURVA }).finished.then(
      () => undefined,
      () => undefined,
    );
  }

  async function mostrarPantalla(nueva: string, anterior: string | undefined, modo: 'adelante' | 'atras' | 'fundido') {
    const elNueva = pantallas.get(nueva)!;
    const elVieja = anterior ? pantallas.get(anterior) : undefined;
    elNueva.hidden = false;
    elNueva.style.zIndex = '2';
    if (elVieja && elVieja !== elNueva) elVieja.style.zIndex = '1';
    const anims: Promise<void>[] = [];
    if (modo === 'adelante') {
      anims.push(animar(elNueva, [{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }]));
      if (elVieja) anims.push(animar(elVieja, [{ transform: 'translateX(0)', filter: 'brightness(1)' }, { transform: 'translateX(-28%)', filter: 'brightness(0.85)' }]));
    } else if (modo === 'atras') {
      elNueva.style.zIndex = '1';
      if (elVieja) elVieja.style.zIndex = '2';
      anims.push(animar(elNueva, [{ transform: 'translateX(-28%)', filter: 'brightness(0.85)' }, { transform: 'translateX(0)', filter: 'brightness(1)' }]));
      if (elVieja) anims.push(animar(elVieja, [{ transform: 'translateX(0)' }, { transform: 'translateX(100%)' }]));
    } else {
      anims.push(animar(elNueva, [{ opacity: 0 }, { opacity: 1 }], 220));
    }
    await Promise.all(anims);
    if (elVieja && elVieja !== elNueva) elVieja.hidden = true;
    elNueva.style.zIndex = '';
    if (elVieja) elVieja.style.zIndex = '';
  }

  async function abrirHoja(id: string) {
    const el = pantallas.get(id)!;
    el.hidden = false;
    const hoja = el.querySelector<HTMLElement>('.demo-hoja');
    const velo = el.querySelector<HTMLElement>('.demo-velo');
    await Promise.all([
      velo ? animar(velo, [{ opacity: 0 }, { opacity: 1 }], 260) : Promise.resolve(),
      hoja ? animar(hoja, [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }]) : Promise.resolve(),
    ]);
  }

  async function cerrarHoja(id: string) {
    const el = pantallas.get(id)!;
    const hoja = el.querySelector<HTMLElement>('.demo-hoja');
    const velo = el.querySelector<HTMLElement>('.demo-velo');
    await Promise.all([
      velo ? animar(velo, [{ opacity: 1 }, { opacity: 0 }], 260) : Promise.resolve(),
      hoja ? animar(hoja, [{ transform: 'translateY(0)' }, { transform: 'translateY(110%)' }], 300) : Promise.resolve(),
    ]);
    el.hidden = true;
  }

  // ── Navegación ──────────────────────────────────────────────────────────

  async function navegar(id: string, tipo: 'ir' | 'raiz') {
    if (!pantallas.has(id) || ocupado || id === top()) return;
    ocupado = true;
    try {
      guiaManual = null;
      if (esHoja(id)) {
        pila.push(id);
        await abrirHoja(id);
      } else {
        const fondoAnterior = fondo();
        // Cerrar las hojas abiertas antes de cambiar de pantalla.
        while (esHoja(top())) {
          const h = pila.pop()!;
          salir(h);
          await cerrarHoja(h);
        }
        if (tipo === 'raiz') {
          pila.forEach(salir);
          pila = [id];
        } else {
          pila.push(id);
        }
        if (tipo === 'raiz') salir(fondoAnterior);
        await mostrarPantalla(id, fondoAnterior, tipo === 'raiz' ? 'fundido' : 'adelante');
        if (tipo === 'ir') salir(fondoAnterior);
      }
      despuesDeNavegar();
    } finally {
      ocupado = false;
    }
  }

  async function volver() {
    if (pila.length < 2 || ocupado) return;
    ocupado = true;
    try {
      guiaManual = null;
      const sale = pila.pop()!;
      salir(sale);
      if (esHoja(sale)) {
        await cerrarHoja(sale);
      } else {
        // Si debajo hay una hoja, se muestra su fondo y la hoja vuelve a abrirse.
        const nuevoFondo = fondo();
        await mostrarPantalla(nuevoFondo, sale, 'atras');
        if (esHoja(top())) await abrirHoja(top());
        entrar(nuevoFondo);
      }
      despuesDeNavegar(false);
    } finally {
      ocupado = false;
    }
  }

  function despuesDeNavegar(conEntrada = true) {
    const id = top();
    if (conEntrada) entrar(id);
    const el = pantallas.get(id)!;
    motor.anunciar(el.dataset.titulo ?? '');
    const foco = esHoja(id) ? el.querySelector<HTMLElement>('.demo-hoja') : el;
    foco?.focus({ preventScroll: true });
    sincronizarRecorrido();
    pintarGuia();
  }

  /** Muestra una pantalla sin animación, con una pila nueva (al cambiar de rol o saltar a un paso). */
  function colocar(nuevaPila: string[]) {
    pila.forEach(salir);
    pantallas.forEach((el) => (el.hidden = true));
    pila = nuevaPila;
    const base = fondo();
    pantallas.get(base)!.hidden = false;
    entrar(base);
    const t = top();
    if (t !== base) {
      pantallas.get(t)!.hidden = false;
      entrar(t);
    }
    guiaManual = null;
    sincronizarRecorrido();
    pintarGuia();
  }

  // ── Recorrido ───────────────────────────────────────────────────────────

  const pasos = () => [...raizEl.querySelectorAll<HTMLButtonElement>(`[data-demo-recorrido="${rol}"] [data-demo-paso]`)];

  function sincronizarRecorrido() {
    const lista = pasos();
    const i = lista.findIndex((b) => b.dataset.pantalla === top());
    if (i >= 0) pasoActivo = i;
    lista.forEach((b, j) => {
      if (j === pasoActivo) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
      b.classList.toggle('demo-paso--hecho', j < pasoActivo);
    });
    if (progreso) {
      progreso.textContent = demo.pasoDe.replace('{n}', String(pasoActivo + 1)).replace('{total}', String(lista.length));
    }
    // Que el paso activo se vea en la lista (sin mover la página).
    const activo = lista[pasoActivo];
    const ol = activo?.closest<HTMLElement>('.demo__pasos');
    if (activo && ol && ol.scrollHeight > ol.clientHeight) {
      const arriba = activo.offsetTop - ol.offsetTop;
      if (arriba < ol.scrollTop || arriba > ol.scrollTop + ol.clientHeight - activo.offsetHeight) {
        ol.scrollTo({ top: arriba - 12, behavior: reducido() ? 'auto' : 'smooth' });
      }
    }
  }

  function saltarAPaso(i: number) {
    const b = pasos()[i];
    if (!b) return;
    const destino = b.dataset.pantalla!;
    const inicio = inicioDe(rol);
    const nuevaPila = [inicio];
    if (b.dataset.base && b.dataset.base !== inicio) nuevaPila.push(b.dataset.base);
    if (destino !== nuevaPila[nuevaPila.length - 1]) nuevaPila.push(destino);
    pasoActivo = i;
    colocar(nuevaPila);
    motor.anunciar(pantallas.get(destino)?.dataset.titulo ?? '');
  }

  // ── Guía (lo próximo para tocar) ────────────────────────────────────────

  function objetivoGuia(): HTMLElement | null {
    const el = pantallas.get(top());
    if (!el) return null;
    if (guiaManual && el.contains(guiaManual) && (guiaManual as HTMLElement).offsetParent !== null) return guiaManual as HTMLElement;
    return [...el.querySelectorAll<HTMLElement>('[data-guia]')].find((g) => g.offsetParent !== null && !(g as HTMLButtonElement).disabled) ?? null;
  }

  function pintarGuia() {
    cont.querySelectorAll('.demo-guia').forEach((g) => g.classList.remove('demo-guia'));
    objetivoGuia()?.classList.add('demo-guia');
  }

  async function tocarConDedo(el: HTMLElement) {
    const caja = cont.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = r.left - caja.left + r.width / 2;
    const y = r.top - caja.top + Math.min(r.height / 2, 40);
    if (!reducido()) {
      dedo.classList.add('demo-dedo--visible');
      const desde = dedo.dataset.pos ? JSON.parse(dedo.dataset.pos) : { x: caja.width / 2, y: caja.height * 0.85 };
      await dedo.animate(
        [
          { transform: `translate(${desde.x}px, ${desde.y}px) scale(1)` },
          { transform: `translate(${x}px, ${y}px) scale(1)` },
        ],
        { duration: 650, easing: CURVA, fill: 'forwards' },
      ).finished;
      await dedo.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(1)` },
          { transform: `translate(${x}px, ${y}px) scale(0.78)` },
          { transform: `translate(${x}px, ${y}px) scale(1)` },
        ],
        { duration: 260, easing: 'ease-in-out', fill: 'forwards' },
      ).finished;
      dedo.dataset.pos = JSON.stringify({ x, y });
    }
    el.click();
  }

  /**
   * Avanza el recorrido: toca lo marcado con la guía; si no hay nada para tocar, salta al paso siguiente.
   * En el último paso se detiene (así el modo automático no vuelve a empezar solo).
   */
  async function siguiente() {
    if (ocupado) return false;
    const lista = pasos();
    const enUltimo = pasoActivo === lista.length - 1 && lista[pasoActivo]?.dataset.pantalla === top();
    if (enUltimo) {
      motor.anunciar(demo.fin);
      raizEl.classList.add('demo--fin');
      return false;
    }
    raizEl.classList.remove('demo--fin');
    let objetivo = objetivoGuia();
    if (!objetivo) {
      // La pantalla puede estar animándose o esperando algo (un pedido que llega, una respuesta del chat).
      const desde = top();
      for (let t = 0; t < 3500 && !objetivo; t += 150) {
        await esperar(150);
        if (top() !== desde) return true;
        objetivo = objetivoGuia();
      }
    }
    if (objetivo) {
      await tocarConDedo(objetivo);
      return true;
    }
    if (pasoActivo < lista.length - 1) {
      saltarAPaso(pasoActivo + 1);
      return true;
    }
    motor.anunciar(demo.fin);
    return false;
  }

  function anterior() {
    if (pila.length > 1) volver();
    else if (pasoActivo > 0) saltarAPaso(pasoActivo - 1);
  }

  // ── Reproducción automática ─────────────────────────────────────────────

  function pintarPlay() {
    if (!botonPlay) return;
    const texto = reproduciendo ? demo.controles.pausar : demo.controles.reproducir;
    botonPlay.setAttribute('aria-label', texto);
    botonPlay.title = texto;
    botonPlay.classList.toggle('demo-control--activo', reproduciendo);
    raizEl.classList.toggle('demo--reproduciendo', reproduciendo);
  }

  async function reproducir() {
    if (reproduciendo) return;
    reproduciendo = true;
    pintarPlay();
    while (reproduciendo) {
      await esperar(2400);
      if (!reproduciendo) break;
      while (ocupado) await esperar(100);
      const siguio = await siguiente();
      if (!siguio) break;
    }
    reproduciendo = false;
    dedo.classList.remove('demo-dedo--visible');
    pintarPlay();
  }

  function pausar() {
    reproduciendo = false;
    dedo.classList.remove('demo-dedo--visible');
    pintarPlay();
  }

  // ── Rol ─────────────────────────────────────────────────────────────────

  function cambiarRol(nuevo: Rol, foco = false) {
    pausar();
    rol = nuevo;
    raizEl.dataset.rol = nuevo;
    raizEl.querySelectorAll<HTMLButtonElement>('[data-demo-rol]').forEach((b) => {
      const activo = b.dataset.demoRol === nuevo;
      b.setAttribute('aria-selected', String(activo));
      b.tabIndex = activo ? 0 : -1;
      if (activo && foco) b.focus();
    });
    raizEl.querySelectorAll<HTMLElement>('[role="tabpanel"]').forEach((p) => (p.hidden = p.id !== `demo-recorrido-${nuevo}`));
    raizEl.querySelectorAll<HTMLElement>('[data-demo-cta]').forEach((c) => (c.hidden = c.dataset.demoCta !== nuevo));
    const u = new URL(location.href);
    u.searchParams.set('rol', nuevo);
    history.replaceState(null, '', u);
    reiniciar();
  }

  function reiniciar() {
    pausar();
    motor.estado = {};
    modulos.forEach((m) => m.reiniciar?.(motor));
    pasoActivo = 0;
    dedo.removeAttribute('data-pos');
    colocar([inicioDe(rol)]);
  }

  // ── Eventos ─────────────────────────────────────────────────────────────

  cont.addEventListener('click', (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-ir],[data-volver],[data-ir-raiz],[data-accion]');
    if (!el || !cont.contains(el) || (el as HTMLButtonElement).disabled) return;
    if (e.isTrusted && reproduciendo) pausar();
    const accion = el.dataset.accion;
    if (accion) {
      const fn = modulos.get(rol)?.acciones?.[accion];
      if (fn) {
        try {
          fn(el, motor);
        } catch (err) {
          console.error(err);
        }
      }
      pintarGuia();
    }
    if (el.hasAttribute('data-volver')) volver();
    else if (el.dataset.irRaiz) navegar(el.dataset.irRaiz, 'raiz');
    else if (el.dataset.ir) navegar(el.dataset.ir, 'ir');
  });

  // Tocar la pantalla a mano frena el modo automático.
  cont.addEventListener('pointerdown', (e) => {
    if (e.isTrusted && reproduciendo) pausar();
  });

  raizEl.querySelectorAll<HTMLButtonElement>('[data-demo-rol]').forEach((b, i, todos) => {
    b.addEventListener('click', () => b.dataset.demoRol !== rol && cambiarRol(b.dataset.demoRol as Rol));
    b.addEventListener('keydown', (e) => {
      const mover = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!mover) return;
      e.preventDefault();
      const sig = todos[(i + mover + todos.length) % todos.length];
      cambiarRol(sig.dataset.demoRol as Rol, true);
    });
  });

  raizEl.addEventListener('click', (e) => {
    const paso = (e.target as Element).closest<HTMLElement>('[data-demo-paso]');
    if (paso) {
      pausar();
      saltarAPaso(Number(paso.dataset.demoPaso));
      return;
    }
    const control = (e.target as Element).closest<HTMLElement>('[data-demo-control]');
    if (!control) return;
    switch (control.dataset.demoControl) {
      case 'anterior':
        pausar();
        anterior();
        break;
      case 'siguiente':
        pausar();
        siguiente();
        break;
      case 'reproducir':
        if (reproduciendo) pausar();
        else reproducir();
        break;
      case 'reiniciar':
        reiniciar();
        break;
      case 'presentacion':
        presentacion();
        break;
    }
  });

  // Modo presentación: pantalla completa con el celular grande (para mostrar en un evento).
  const botonPresentacion = raizEl.querySelector<HTMLButtonElement>('[data-demo-control="presentacion"]');
  function pintarPresentacion(activo: boolean) {
    document.documentElement.classList.toggle('demo-presentando', activo);
    if (botonPresentacion) {
      const t = activo ? demo.controles.salirPresentacion : demo.controles.presentacion;
      botonPresentacion.setAttribute('aria-label', t);
      botonPresentacion.title = t;
      botonPresentacion.classList.toggle('demo-control--activo', activo);
    }
  }
  function presentacion() {
    const activo = document.documentElement.classList.contains('demo-presentando');
    if (activo) {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      pintarPresentacion(false);
    } else {
      pintarPresentacion(true);
      raizEl.requestFullscreen?.().catch(() => {});
    }
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) pintarPresentacion(false);
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, select, [contenteditable]')) return;
    const presentando = document.documentElement.classList.contains('demo-presentando');
    if (e.key === 'ArrowRight') {
      pausar();
      siguiente();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      pausar();
      anterior();
      e.preventDefault();
    } else if (presentando && (e.key === ' ' || e.key === 'Enter') && !t.closest('button, a')) {
      e.preventDefault();
      if (reproduciendo) pausar();
      else reproducir();
    } else if (presentando && e.key === 'Escape' && !document.fullscreenElement) {
      pintarPresentacion(false);
    }
  });

  // ── Arranque ────────────────────────────────────────────────────────────

  const pedido = new URLSearchParams(location.search).get('rol');
  const inicial: Rol = pedido === 'especialista' ? 'especialista' : 'usuario';
  if (inicial !== 'usuario') cambiarRol(inicial);
  else reiniciar();
  pintarPlay();
}
