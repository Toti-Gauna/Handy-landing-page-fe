// Motor de la demo interactiva. Vuelve navegables las pantallas que se arman en build
// (ver el contrato en src/render/demo/tipos.ts) y maneja el recorrido, el modo automático
// y el modo presentación. Los comportamientos propios de cada rol viven en usuario.ts / especialista.ts.
//
// Parámetros de la URL (para presentar desde un iPad):
//   ?rol=especialista   arranca del lado del especialista.
//   ?ritmo=lento        el modo automático se queda más tiempo en cada pantalla (para narrar en vivo).
//   ?stand=1            modo stand: arranca en presentación y reproduciendo; al terminar el recorrido pasa
//                       al otro lado y sigue, y si nadie la toca por un minuto vuelve a empezar sola.
//                       Mientras dura, pide que la pantalla no se apague (Wake Lock, si el navegador lo tiene).

import demo from '../../content/demo.json';
import { despuesDeIntro } from '../intro';

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
  /**
   * setTimeout que se cancela solo cuando sale su pantalla dueña: la que está corriendo entrar(),
   * la de la acción tocada o la del temporizador que lo programa (aunque haya una hoja abierta encima).
   */
  timeout(fn: () => void, ms: number): void;
  /** setInterval con la misma regla que timeout. */
  intervalo(fn: () => void, ms: number): void;
  /** Marca a mano lo próximo para tocar (si no, se usa [data-guia] de la pantalla). */
  guia(el: Element | null): void;
  /** Mensaje para lectores de pantalla. */
  anunciar(texto: string): void;
  /** true si el usuario pidió reducir el movimiento: no animar. */
  readonly reducido: boolean;
  /** true mientras entrar() corre porque se saltó a un paso desde el recorrido (o se volvió a empezar). */
  readonly saltando: boolean;
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
/** Pausa del modo automático entre un toque y el siguiente (cada paso puede pedir otra con data-pausa). */
const PAUSA = 2400;
const PAUSA_INICIAL = 900;
/** Multiplicador de las pausas con ?ritmo=lento. */
const LENTO = 1.6;
/** Modo stand: cuánto queda a la vista el aviso de fin antes de pasar al otro lado. */
const FIN_STAND = 7000;
/** Modo stand: sin toques durante este tiempo (y sin reproducir), vuelve a empezar solo. */
const INACTIVO_STAND = 60000;
/** Cuánto espera "Siguiente" (como mucho) a que aparezca lo próximo para tocar, si la pantalla está esperando algo. */
const ESPERA_GUIA = 3500;

/** Resultado de un avance: tocó algo o saltó de paso, llegó al final, o no pudo (ocupado o cancelado). */
type Avance = 'sigue' | 'fin' | 'nada';

export function iniciarDemo() {
  const parametros = new URLSearchParams(location.search);
  const stand = parametros.get('stand') === '1';
  const ritmo = parametros.get('ritmo') === 'lento' ? LENTO : 1;
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
  const telefono = raizEl.querySelector<HTMLElement>('.telefono--demo');

  const inicioDe = (r: Rol) =>
    raizEl.querySelector<HTMLElement>(`[data-demo-recorrido="${r}"]`)?.dataset.inicio ?? (r === 'usuario' ? 'u-inicio' : 'e-inicio');

  // ── Estado ──────────────────────────────────────────────────────────────
  let rol: Rol = 'usuario';
  let pila: string[] = [];
  let guiaManual: Element | null = null;
  let pasoActivo = 0;
  let reproduciendo = false;
  /** Hay una transición en curso (las navegaciones que llegan mientras tanto se ignoran). */
  let ocupado = false;
  /** Cambia con cada colocar(): las transiciones que quedaron a mitad de camino no siguen. */
  let generacion = 0;
  /** Cambia cuando el presentador interviene: el toque automático en vuelo (o su espera) no se hace. */
  let vuelo = 0;
  /** Cuenta los toques automáticos (para esconder el dedo solo si no empezó otro). */
  let toques = 0;
  /** Cambia al pausar: un bucle de reproducción viejo no sigue aunque se vuelva a reproducir enseguida. */
  let sesion = 0;
  /** Hay un "Siguiente" en curso (dos seguidos no tocan dos veces). */
  let avanzando = false;
  /** Modo stand: está mostrando el aviso de fin antes de pasar al otro lado. */
  let esperandoStand = false;
  /** Pantalla dueña de los temporizadores que se programan ahora (ver Motor.timeout). */
  let duenio: string | null = null;
  /** Navegación pedida por una pantalla (m.ir, m.raiz, m.volver) durante una transición: se hace al terminar. */
  let navDiferida: (() => void) | null = null;
  /** colocar() está corriendo los entrar() (ver Motor.saltando). */
  let saltando = false;
  const limpiezas = new Map<string, (() => void)[]>();
  /** Temporizadores (timeout) pendientes por pantalla: si hay, "Siguiente" espera a la guía. */
  const pendientes = new Map<string, number>();

  const top = () => pila[pila.length - 1];
  const esHoja = (id: string) => pantallas.get(id)?.dataset.tipo === 'hoja';
  /** Pantalla "de fondo" visible (la última que no es hoja). */
  const fondo = () => [...pila].reverse().find((id) => !esHoja(id))!;
  const duenioActual = () => (duenio && pila.includes(duenio) ? duenio : top());

  function conDuenio<T>(id: string | null, fn: () => T): T {
    const antes = duenio;
    duenio = id;
    try {
      return fn();
    } finally {
      duenio = antes;
    }
  }

  /**
   * Las pantallas pueden pedir navegar desde entrar() o un temporizador mientras otra transición está en curso:
   * en vez de perderse, se hace apenas termina (si quien la pidió sigue en la pila).
   */
  function pedirNavegacion(fn: () => void) {
    if (!ocupado) {
      fn();
      return;
    }
    const quien = duenioActual();
    const gen = generacion;
    navDiferida = () => {
      if (gen === generacion && pila.includes(quien)) fn();
    };
  }

  /** Termina una transición y hace la navegación que quedó pedida mientras tanto. */
  function liberar() {
    ocupado = false;
    const fn = navDiferida;
    navDiferida = null;
    fn?.();
  }

  function sumarPendiente(id: string, n: number) {
    const v = (pendientes.get(id) ?? 0) + n;
    if (v > 0) pendientes.set(id, v);
    else pendientes.delete(id);
  }

  const motor: Motor = {
    get rol() {
      return rol;
    },
    get actual() {
      return top();
    },
    get saltando() {
      return saltando;
    },
    ir: (id) => pedirNavegacion(() => void navegar(id, 'ir')),
    volver: () => pedirNavegacion(() => void volver()),
    raiz: (id) => pedirNavegacion(() => void navegar(id, 'raiz')),
    pantalla: (id) => pantallas.get(id ?? top())!,
    timeout(fn, ms) {
      const id = duenioActual();
      let hecho = false;
      const terminar = () => {
        if (hecho) return;
        hecho = true;
        sumarPendiente(id, -1);
      };
      sumarPendiente(id, 1);
      const t = window.setTimeout(() => {
        terminar();
        conDuenio(id, fn);
      }, ms);
      agregarLimpieza(id, () => {
        window.clearTimeout(t);
        terminar();
      });
    },
    intervalo(fn, ms) {
      const id = duenioActual();
      const t = window.setInterval(() => conDuenio(id, fn), ms);
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
    pendientes.delete(id);
  }

  function entrar(id: string) {
    const fn = modulos.get(rol)?.entrar?.[id];
    if (!fn) return;
    try {
      const limpieza = conDuenio(id, () => fn(pantallas.get(id)!, motor));
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

  /** `antes` corre con la pantalla nueva ya visible y antes de que entre (así entra pintada con sus datos). */
  async function mostrarPantalla(nueva: string, anterior: string | undefined, modo: 'adelante' | 'atras' | 'fundido', antes?: () => void) {
    const gen = generacion;
    const elNueva = pantallas.get(nueva)!;
    const elVieja = anterior ? pantallas.get(anterior) : undefined;
    elNueva.hidden = false;
    elNueva.style.zIndex = '2';
    if (elVieja && elVieja !== elNueva) elVieja.style.zIndex = '1';
    antes?.();
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
    // Si mientras tanto se saltó a otro paso, colocar() ya dejó todo en su lugar.
    if (gen !== generacion) return;
    if (elVieja && elVieja !== elNueva) elVieja.hidden = true;
    elNueva.style.zIndex = '';
    if (elVieja) elVieja.style.zIndex = '';
  }

  async function abrirHoja(id: string, antes?: () => void) {
    const el = pantallas.get(id)!;
    el.hidden = false;
    antes?.();
    const hoja = el.querySelector<HTMLElement>('.demo-hoja');
    const velo = el.querySelector<HTMLElement>('.demo-velo');
    await Promise.all([
      velo ? animar(velo, [{ opacity: 0 }, { opacity: 1 }], 260) : Promise.resolve(),
      hoja ? animar(hoja, [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }]) : Promise.resolve(),
    ]);
  }

  async function cerrarHoja(id: string) {
    const gen = generacion;
    const el = pantallas.get(id)!;
    const hoja = el.querySelector<HTMLElement>('.demo-hoja');
    const velo = el.querySelector<HTMLElement>('.demo-velo');
    await Promise.all([
      velo ? animar(velo, [{ opacity: 1 }, { opacity: 0 }], 260) : Promise.resolve(),
      hoja ? animar(hoja, [{ transform: 'translateY(0)' }, { transform: 'translateY(110%)' }], 300) : Promise.resolve(),
    ]);
    if (gen === generacion) el.hidden = true;
  }

  /** Con una hoja abierta, lo de atrás no se puede tocar ni enfocar. */
  function pintarInert() {
    const arriba = top();
    const conHoja = esHoja(arriba);
    pantallas.forEach((el, id) => el.toggleAttribute('inert', conHoja && id !== arriba && pila.includes(id)));
  }

  // ── Navegación ──────────────────────────────────────────────────────────

  async function navegar(id: string, tipo: 'ir' | 'raiz') {
    if (!pantallas.has(id) || ocupado || id === top()) return;
    ocupado = true;
    const gen = generacion;
    try {
      guiaManual = null;
      if (esHoja(id)) {
        pila.push(id);
        await abrirHoja(id, () => entrar(id));
        if (gen !== generacion) return;
      } else {
        const fondoAnterior = fondo();
        // Cerrar las hojas abiertas antes de cambiar de pantalla.
        while (esHoja(top())) {
          const h = pila.pop()!;
          salir(h);
          await cerrarHoja(h);
          if (gen !== generacion) return;
        }
        // La hoja llevaba a la pantalla que tenía debajo: alcanza con cerrarla.
        if (top() === id && tipo === 'ir') {
          despuesDeNavegar(tipo);
          return;
        }
        // Sale la de antes y entra la nueva (antes de la transición, así se ve con sus datos mientras entra).
        if (tipo === 'raiz') {
          pila.forEach(salir);
          pila = [id];
        } else {
          salir(fondoAnterior);
          pila.push(id);
        }
        await mostrarPantalla(id, fondoAnterior, tipo === 'raiz' ? 'fundido' : 'adelante', () => entrar(id));
        if (gen !== generacion) return;
      }
      despuesDeNavegar(tipo);
    } finally {
      if (gen === generacion) liberar();
    }
  }

  async function volver() {
    if (pila.length < 2 || ocupado) return;
    ocupado = true;
    const gen = generacion;
    try {
      guiaManual = null;
      const sale = pila.pop()!;
      salir(sale);
      if (esHoja(sale)) {
        await cerrarHoja(sale);
        if (gen !== generacion) return;
      } else {
        // Si debajo hay una hoja, se muestra su fondo y la hoja vuelve a abrirse.
        const nuevoFondo = fondo();
        await mostrarPantalla(nuevoFondo, sale, 'atras', () => entrar(nuevoFondo));
        if (gen !== generacion) return;
        if (esHoja(top())) await abrirHoja(top());
        if (gen !== generacion) return;
      }
      despuesDeNavegar('volver');
    } finally {
      if (gen === generacion) liberar();
    }
  }

  /** Después de la transición (entrar() ya corrió antes). */
  function despuesDeNavegar(tipo: 'ir' | 'raiz' | 'volver') {
    const id = top();
    const el = pantallas.get(id)!;
    pintarInert();
    motor.anunciar(el.dataset.titulo ?? '');
    enfocarPantalla();
    // Ir hacia adelante no hace retroceder el recorrido (p. ej., abrir un turno desde Cobros).
    sincronizarRecorrido(tipo === 'ir');
    pintarGuia();
  }

  function enfocarPantalla() {
    const id = top();
    const el = pantallas.get(id);
    const foco = el && esHoja(id) ? el.querySelector<HTMLElement>('.demo-hoja') : el;
    foco?.focus({ preventScroll: true });
  }

  /** Muestra una pantalla sin animación, con una pila nueva (al cambiar de rol o saltar a un paso). */
  function colocar(nuevaPila: string[]) {
    // Lo que estaba en curso (una transición, un toque automático) no sigue.
    generacion++;
    ocupado = false;
    navDiferida = null;
    cancelarToque();
    pila.forEach(salir);
    pantallas.forEach((el) => {
      [el, ...el.querySelectorAll<HTMLElement>(':scope > .demo-hoja, :scope > .demo-velo')].forEach((x) => x.getAnimations().forEach((a) => a.cancel()));
      el.hidden = true;
      el.style.zIndex = '';
    });
    pila = nuevaPila;
    guiaManual = null;
    const base = fondo();
    const t = top();
    saltando = true;
    try {
      pantallas.get(base)!.hidden = false;
      entrar(base);
      if (t !== base) {
        pantallas.get(t)!.hidden = false;
        entrar(t);
      }
    } finally {
      saltando = false;
    }
    pintarInert();
    sincronizarRecorrido();
    pintarGuia();
  }

  // ── Recorrido ───────────────────────────────────────────────────────────

  const pasos = () => [...raizEl.querySelectorAll<HTMLButtonElement>(`[data-demo-recorrido="${rol}"] [data-demo-paso]`)];
  const indiceDe = (lista: HTMLElement[], id: string | undefined) => lista.findIndex((b) => b.dataset.pantalla === id);

  /** Marca el paso de la pantalla de arriba. Con `adelante`, no vuelve a un paso anterior al activo. */
  function sincronizarRecorrido(adelante = false) {
    const lista = pasos();
    // La pantalla de arriba; si no es un paso (un detalle, una conversación), el último paso de la pila.
    let i = indiceDe(lista, top());
    if (i < 0) i = [...pila].reverse().map((id) => indiceDe(lista, id)).find((x) => x >= 0) ?? -1;
    if (i >= 0 && !(adelante && i < pasoActivo)) pasoActivo = i;
    // El aviso de fin se va apenas se sale del último paso.
    if (lista[lista.length - 1]?.dataset.pantalla !== top()) raizEl.classList.remove('demo--fin');
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
    const lista = pasos();
    const b = lista[i];
    if (!b) return;
    const destino = b.dataset.pantalla!;
    // Debajo quedan el inicio, la pantalla del paso anterior (si era una hoja, su fondo) y la base del paso:
    // así "Volver", la flecha y "Anterior" encadenado llevan al paso previo.
    const nuevaPila = [inicioDe(rol)];
    const apilar = (id: string | undefined) => {
      if (id && pantallas.has(id) && !nuevaPila.includes(id)) nuevaPila.push(id);
    };
    const prev = lista[i - 1];
    if (prev) apilar(esHoja(prev.dataset.pantalla!) ? prev.dataset.base : prev.dataset.pantalla);
    apilar(b.dataset.base);
    const ya = nuevaPila.indexOf(destino);
    if (ya >= 0) nuevaPila.length = ya + 1;
    else nuevaPila.push(destino);
    pasoActivo = i;
    colocar(nuevaPila);
    motor.anunciar(pantallas.get(destino)?.dataset.titulo ?? '');
  }

  /** En el celular (o el iPad vertical) el teléfono puede haber quedado fuera de la vista: lo trae. */
  function mostrarTelefono() {
    if (!telefono) return;
    const presentando = document.documentElement.classList.contains('demo-presentando');
    const tope = presentando ? 0 : Math.max(0, document.querySelector('.header')?.getBoundingClientRect().bottom ?? 0);
    const r = telefono.getBoundingClientRect();
    const alto = innerHeight - tope;
    const visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, tope);
    if (visible < Math.min(r.height, alto) * 0.6) telefono.scrollIntoView({ block: 'center', behavior: reducido() ? 'auto' : 'smooth' });
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

  /** La pantalla está esperando algo (un temporizador, un chat que escribe, un botón que se habilita). */
  function hayEspera() {
    if (pila.some((id) => pendientes.has(id))) return true;
    return !!pantallas.get(top())?.querySelector('[data-guia]:disabled, [aria-busy="true"]');
  }

  /** Corta el toque automático en vuelo y esconde el dedo donde está. */
  function cancelarToque() {
    vuelo++;
    const anims = dedo.getAnimations();
    if (anims.length) {
      const m = new DOMMatrixReadOnly(getComputedStyle(dedo).transform);
      dedo.style.transform = `translate(${m.e}px, ${m.f}px)`;
      dedo.dataset.pos = JSON.stringify({ x: m.e, y: m.f });
      anims.forEach((a) => a.cancel());
    }
    dedo.classList.remove('demo-dedo--visible');
  }

  async function tocarConDedo(el: HTMLElement): Promise<boolean> {
    const mio = vuelo;
    const n = ++toques;
    if (!reducido()) {
      const caja = cont.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const x = r.left - caja.left + r.width / 2;
      const y = r.top - caja.top + Math.min(r.height / 2, 40);
      dedo.classList.add('demo-dedo--visible');
      const desde = dedo.dataset.pos ? JSON.parse(dedo.dataset.pos) : { x: caja.width / 2, y: caja.height * 0.85 };
      try {
        await dedo.animate(
          [
            { transform: `translate(${desde.x}px, ${desde.y}px) scale(1)` },
            { transform: `translate(${x}px, ${y}px) scale(1)` },
          ],
          { duration: 650, easing: CURVA, fill: 'forwards' },
        ).finished;
        if (mio !== vuelo) return false;
        await dedo.animate(
          [
            { transform: `translate(${x}px, ${y}px) scale(1)` },
            { transform: `translate(${x}px, ${y}px) scale(0.78)` },
            { transform: `translate(${x}px, ${y}px) scale(1)` },
          ],
          { duration: 260, easing: 'ease-in-out', fill: 'forwards' },
        ).finished;
      } catch {
        return false; // animación cancelada: el presentador intervino
      }
      dedo.dataset.pos = JSON.stringify({ x, y });
    }
    // Solo si nadie intervino y lo que se iba a tocar sigue ahí, a la vista y habilitado.
    const sigueAhi =
      mio === vuelo && el.isConnected && el.offsetParent !== null && !!pantallas.get(top())?.contains(el) && !(el as HTMLButtonElement).disabled;
    if (sigueAhi) el.click();
    // El dedo no queda tapando la pantalla: se va enseguida (salvo que ya haya empezado otro toque).
    window.setTimeout(() => {
      if (n === toques) dedo.classList.remove('demo-dedo--visible');
    }, 600);
    return sigueAhi;
  }

  function terminarRecorrido() {
    raizEl.classList.add('demo--fin');
    motor.anunciar(demo.fin);
  }

  /**
   * Avanza el recorrido: toca lo marcado con la guía; si no hay nada para tocar, salta al paso siguiente
   * (si la pantalla está esperando algo, espera un poco antes). En el último paso se detiene.
   */
  async function siguiente(): Promise<Avance> {
    if (ocupado || avanzando) return 'nada';
    avanzando = true;
    try {
      const mio = vuelo;
      const lista = pasos();
      const enUltimo = pasoActivo === lista.length - 1 && lista[pasoActivo]?.dataset.pantalla === top();
      if (enUltimo) {
        terminarRecorrido();
        return 'fin';
      }
      raizEl.classList.remove('demo--fin');
      let objetivo = objetivoGuia();
      if (!objetivo && hayEspera()) {
        // La pantalla está esperando algo (un pedido que llega, una respuesta del chat): hasta que aparezca
        // lo próximo para tocar o termine de esperar (y un momento más, para que se vea cómo quedó).
        const desde = top();
        let resto = -1;
        for (let t = 0; t < ESPERA_GUIA && !objetivo && resto !== 0; t += 150) {
          await esperar(150);
          if (mio !== vuelo) return 'nada';
          if (top() !== desde) return 'sigue';
          objetivo = objetivoGuia();
          if (resto > 0) resto--;
          else if (resto < 0 && !hayEspera()) resto = 5;
        }
      }
      if (objetivo) return (await tocarConDedo(objetivo)) ? 'sigue' : 'nada';
      if (pasoActivo < lista.length - 1) {
        saltarAPaso(pasoActivo + 1);
        return 'sigue';
      }
      terminarRecorrido();
      return 'fin';
    } finally {
      avanzando = false;
    }
  }

  function anterior() {
    raizEl.classList.remove('demo--fin');
    // Si lo que queda debajo es el paso anterior (o una pantalla que no es paso), se vuelve; si no, se salta.
    if (pila.length > 1) {
      const i = indiceDe(pasos(), pila[pila.length - 2]);
      if (i === -1 || i >= pasoActivo - 1) {
        volver();
        return;
      }
    }
    if (pasoActivo > 0) saltarAPaso(pasoActivo - 1);
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

  /** Cuánto se queda el modo automático en el paso activo antes del próximo toque. */
  function pausaDelPaso() {
    const propia = Number(pasos()[pasoActivo]?.dataset.pausa);
    return (propia > 0 ? propia : PAUSA) * ritmo;
  }

  async function reproducir() {
    if (reproduciendo) return;
    // Con el recorrido terminado, arranca de nuevo desde el paso 1.
    if (raizEl.classList.contains('demo--fin')) reiniciar();
    reproduciendo = true;
    const mia = ++sesion;
    const sigue = () => reproduciendo && mia === sesion;
    pintarPlay();
    let terminado = false;
    let pausa = PAUSA_INICIAL * ritmo;
    while (sigue()) {
      await esperar(pausa);
      while (sigue() && ocupado) await esperar(100);
      if (!sigue()) break;
      if ((await siguiente()) === 'fin') {
        terminado = true;
        break;
      }
      // La pausa es la del paso al que llevó el toque: se mide cuando termina su transición.
      const desde = performance.now();
      while (sigue() && ocupado) await esperar(100);
      pausa = Math.max(0, pausaDelPaso() - (performance.now() - desde));
    }
    if (mia === sesion) {
      reproduciendo = false;
      pintarPlay();
      if (terminado && stand) void pasarAlOtroLado(mia);
    }
  }

  /** Modo stand: con el recorrido terminado y sin que nadie toque, pasa al otro lado y lo reproduce. */
  async function pasarAlOtroLado(mia: number) {
    esperandoStand = true;
    try {
      await esperar(FIN_STAND);
    } finally {
      esperandoStand = false;
    }
    // Si alguien tocó algo mientras tanto (pausar() cambia la sesión), se queda donde está.
    if (mia !== sesion || reproduciendo) return;
    cambiarRol(rol === 'usuario' ? 'especialista' : 'usuario');
    mostrarTelefono();
    void reproducir();
  }

  /** Frena el modo automático (un toque que ya está en vuelo termina). */
  function pausar() {
    sesion++;
    reproduciendo = false;
    pintarPlay();
  }

  /** Frena todo: el modo automático y el toque en vuelo. */
  function detener() {
    pausar();
    cancelarToque();
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
    raizEl.querySelectorAll<HTMLElement>('[data-demo-fin-rol]').forEach((c) => (c.hidden = c.dataset.demoFinRol !== nuevo));
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
    raizEl.classList.remove('demo--fin');
    colocar([inicioDe(rol)]);
    dedo.removeAttribute('data-pos');
    dedo.style.transform = '';
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
          conDuenio(el.closest<HTMLElement>('[data-pantalla]')?.dataset.pantalla ?? null, () => fn(el, motor));
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

  // Tocar la pantalla a mano frena el modo automático y el toque que estaba por hacer.
  cont.addEventListener('pointerdown', (e) => {
    if (!e.isTrusted || (e.target as Element).closest('[data-demo-fin]')) return;
    detener();
    raizEl.classList.remove('demo--fin');
  });

  raizEl.querySelectorAll<HTMLButtonElement>('[data-demo-rol]').forEach((b, i, todos) => {
    b.addEventListener('click', () => b.dataset.demoRol !== rol && cambiarRol(b.dataset.demoRol as Rol));
    b.addEventListener('keydown', (e) => {
      const mover = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      if (!mover) return;
      // La flecha mueve entre pestañas: no es además "Siguiente" / "Anterior".
      e.preventDefault();
      e.stopPropagation();
      const sig = todos[(i + mover + todos.length) % todos.length];
      cambiarRol(sig.dataset.demoRol as Rol, true);
    });
  });

  function avanzarAMano() {
    pausar();
    mostrarTelefono();
    void siguiente();
  }

  function retrocederAMano() {
    pausar();
    anterior();
    mostrarTelefono();
  }

  function alternarReproduccion() {
    if (reproduciendo) {
      detener();
    } else {
      mostrarTelefono();
      void reproducir();
    }
  }

  raizEl.addEventListener('click', (e) => {
    const t = e.target as Element;
    const paso = t.closest<HTMLElement>('[data-demo-paso]');
    if (paso) {
      pausar();
      saltarAPaso(Number(paso.dataset.demoPaso));
      mostrarTelefono();
      return;
    }
    const otro = t.closest<HTMLElement>('[data-demo-otro-rol]');
    if (otro) {
      cambiarRol(otro.dataset.demoOtroRol as Rol);
      mostrarTelefono();
      return;
    }
    const control = t.closest<HTMLElement>('[data-demo-control]');
    if (!control) return;
    switch (control.dataset.demoControl) {
      case 'anterior':
        retrocederAMano();
        break;
      case 'siguiente':
        avanzarAMano();
        break;
      case 'reproducir':
        alternarReproduccion();
        break;
      case 'reiniciar':
        reiniciar();
        mostrarTelefono();
        break;
      case 'presentacion':
        presentacion();
        break;
    }
  });

  // ── Pantalla completa y pantalla encendida ──────────────────────────────
  // Safari del iPad (hasta iPadOS 16.4) solo tiene la versión con prefijo webkit de la pantalla completa.

  type ElementoWebkit = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  type DocumentoWebkit = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
  const docW = document as DocumentoWebkit;
  const enPantallaCompleta = () => document.fullscreenElement ?? docW.webkitFullscreenElement ?? null;

  /** Puede fallar (sin gesto del usuario, en un iPhone, en un navegador que no la tiene): la presentación sigue igual. */
  function pedirPantallaCompleta() {
    const el = raizEl as ElementoWebkit;
    try {
      if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
      else void Promise.resolve(el.webkitRequestFullscreen?.()).catch(() => {});
    } catch {
      /* sin pantalla completa */
    }
  }

  function salirDePantallaCompleta() {
    if (!enPantallaCompleta()) return;
    try {
      if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
      else void Promise.resolve(docW.webkitExitFullscreen?.()).catch(() => {});
    } catch {
      /* nada */
    }
  }

  // Que el iPad no apague la pantalla mientras se presenta (o en el stand).
  type Bloqueo = { released: boolean; release(): Promise<void>; addEventListener(t: 'release', fn: () => void): void };
  const wakeLock = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Bloqueo> } }).wakeLock;
  let bloqueo: Bloqueo | null = null;
  let pidiendoBloqueo = false;
  const quiereBloqueo = () => stand || document.documentElement.classList.contains('demo-presentando');

  async function mantenerPantallaEncendida() {
    if (!wakeLock || bloqueo || pidiendoBloqueo || document.visibilityState !== 'visible' || !quiereBloqueo()) return;
    pidiendoBloqueo = true;
    try {
      const b = await wakeLock.request('screen');
      b.addEventListener('release', () => {
        if (bloqueo === b) bloqueo = null;
      });
      // Si mientras tanto se salió de la presentación, no hace falta.
      if (quiereBloqueo()) bloqueo = b;
      else void b.release().catch(() => {});
    } catch {
      /* el navegador no lo permite ahora (p. ej., sin un toque antes): se vuelve a pedir con el próximo toque */
    } finally {
      pidiendoBloqueo = false;
    }
  }

  function soltarPantalla() {
    const b = bloqueo;
    bloqueo = null;
    if (b && !b.released) void b.release().catch(() => {});
  }

  // El navegador suelta el bloqueo al esconder la página: se vuelve a pedir al volver.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void mantenerPantallaEncendida();
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
    if (activo) void mantenerPantallaEncendida();
    else if (!stand) soltarPantalla();
  }
  function presentacion() {
    const activo = document.documentElement.classList.contains('demo-presentando');
    if (activo) {
      salirDePantallaCompleta();
      pintarPresentacion(false);
    } else {
      pintarPresentacion(true);
      pedirPantallaCompleta();
      // El foco pasa al celular: así la barra espaciadora reproduce en vez de volver a tocar este botón.
      enfocarPantalla();
    }
  }
  const alCambiarPantallaCompleta = () => {
    // En el stand, salir de la pantalla completa (un gesto del iPad) no saca del modo presentación.
    if (!enPantallaCompleta() && !stand) pintarPresentacion(false);
  };
  document.addEventListener('fullscreenchange', alCambiarPantallaCompleta);
  document.addEventListener('webkitfullscreenchange', alCambiarPantallaCompleta);

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest?.('input, textarea, select, [contenteditable], [data-demo-rol]')) return;
    const presentando = document.documentElement.classList.contains('demo-presentando');
    // En presentación también responden Av Pág / Re Pág (los punteros de presentación mandan esas teclas).
    if (e.key === 'ArrowRight' || (presentando && e.key === 'PageDown')) {
      e.preventDefault();
      avanzarAMano();
    } else if (e.key === 'ArrowLeft' || (presentando && e.key === 'PageUp')) {
      e.preventDefault();
      retrocederAMano();
    } else if (presentando && (e.key === ' ' || e.key === 'Enter') && !t.closest?.('button, a')) {
      e.preventDefault();
      alternarReproduccion();
    } else if (presentando && e.key === 'Escape' && !enPantallaCompleta()) {
      pintarPresentacion(false);
    }
  });

  // ── Modo stand ──────────────────────────────────────────────────────────

  let ultimaActividad = Date.now();
  function iniciarStand() {
    const actividad = (e: Event) => {
      if (!e.isTrusted) return;
      ultimaActividad = Date.now();
      // Algunos navegadores solo dan el bloqueo de pantalla después de un toque.
      void mantenerPantallaEncendida();
    };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((t) => document.addEventListener(t, actividad, { passive: true, capture: true }));
    window.setInterval(() => {
      // Mientras reproduce (o espera para pasar al otro lado) no cuenta como inactivo.
      if (reproduciendo || esperandoStand || document.visibilityState !== 'visible') {
        ultimaActividad = Date.now();
        return;
      }
      if (Date.now() - ultimaActividad < INACTIVO_STAND) return;
      ultimaActividad = Date.now();
      // Nadie la toca: vuelve a empezar desde el lado del usuario.
      if (rol !== 'usuario') cambiarRol('usuario');
      else reiniciar();
      window.scrollTo({ top: 0 });
      void reproducir();
    }, 1000);
    pintarPresentacion(true);
    // El recorrido arranca cuando se fue la pantalla de carga (si la hay).
    despuesDeIntro(() => void reproducir());
  }

  // ── Arranque ────────────────────────────────────────────────────────────

  const pedido = parametros.get('rol');
  const inicial: Rol = pedido === 'especialista' ? 'especialista' : 'usuario';
  if (inicial !== 'usuario') cambiarRol(inicial);
  else reiniciar();
  pintarPlay();
  if (stand) iniciarStand();
}
