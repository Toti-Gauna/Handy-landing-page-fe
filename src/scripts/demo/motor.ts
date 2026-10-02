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
/** Pausa del modo automático entre un toque y el siguiente (y antes del primero). */
const PAUSA = 2400;
const PAUSA_INICIAL = 900;
/** Cuánto espera "Siguiente" (como mucho) a que aparezca lo próximo para tocar, si la pantalla está esperando algo. */
const ESPERA_GUIA = 3500;

/** Resultado de un avance: tocó algo o saltó de paso, llegó al final, o no pudo (ocupado o cancelado). */
type Avance = 'sigue' | 'fin' | 'nada';

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
  /** Pantalla dueña de los temporizadores que se programan ahora (ver Motor.timeout). */
  let duenio: string | null = null;
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
    ir: (id) => void navegar(id, 'ir'),
    volver: () => void volver(),
    raiz: (id) => void navegar(id, 'raiz'),
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

  async function mostrarPantalla(nueva: string, anterior: string | undefined, modo: 'adelante' | 'atras' | 'fundido') {
    const gen = generacion;
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
    // Si mientras tanto se saltó a otro paso, colocar() ya dejó todo en su lugar.
    if (gen !== generacion) return;
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
        await abrirHoja(id);
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
        if (tipo === 'raiz') {
          pila.forEach(salir);
          pila = [id];
        } else {
          pila.push(id);
        }
        if (tipo === 'raiz') salir(fondoAnterior);
        await mostrarPantalla(id, fondoAnterior, tipo === 'raiz' ? 'fundido' : 'adelante');
        if (gen !== generacion) return;
        if (tipo === 'ir') salir(fondoAnterior);
      }
      despuesDeNavegar();
    } finally {
      if (gen === generacion) ocupado = false;
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
        await mostrarPantalla(nuevoFondo, sale, 'atras');
        if (gen !== generacion) return;
        if (esHoja(top())) await abrirHoja(top());
        if (gen !== generacion) return;
        entrar(nuevoFondo);
      }
      despuesDeNavegar(false);
    } finally {
      if (gen === generacion) ocupado = false;
    }
  }

  function despuesDeNavegar(conEntrada = true) {
    const id = top();
    if (conEntrada) entrar(id);
    const el = pantallas.get(id)!;
    pintarInert();
    motor.anunciar(el.dataset.titulo ?? '');
    const foco = esHoja(id) ? el.querySelector<HTMLElement>('.demo-hoja') : el;
    foco?.focus({ preventScroll: true });
    sincronizarRecorrido();
    pintarGuia();
  }

  /** Muestra una pantalla sin animación, con una pila nueva (al cambiar de rol o saltar a un paso). */
  function colocar(nuevaPila: string[]) {
    // Lo que estaba en curso (una transición, un toque automático) no sigue.
    generacion++;
    ocupado = false;
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
    pantallas.get(base)!.hidden = false;
    entrar(base);
    const t = top();
    if (t !== base) {
      pantallas.get(t)!.hidden = false;
      entrar(t);
    }
    pintarInert();
    sincronizarRecorrido();
    pintarGuia();
  }

  // ── Recorrido ───────────────────────────────────────────────────────────

  const pasos = () => [...raizEl.querySelectorAll<HTMLButtonElement>(`[data-demo-recorrido="${rol}"] [data-demo-paso]`)];
  const indiceDe = (lista: HTMLElement[], id: string | undefined) => lista.findIndex((b) => b.dataset.pantalla === id);

  function sincronizarRecorrido() {
    const lista = pasos();
    // La pantalla de arriba; si no es un paso (un detalle, una conversación), el último paso de la pila.
    let i = indiceDe(lista, top());
    if (i < 0) i = [...pila].reverse().map((id) => indiceDe(lista, id)).find((x) => x >= 0) ?? -1;
    if (i >= 0) pasoActivo = i;
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
    const b = pasos()[i];
    if (!b) return;
    const destino = b.dataset.pantalla!;
    const inicio = inicioDe(rol);
    // Debajo queda el inicio y, si el paso la tiene, su base (así "Volver" y la flecha llevan ahí).
    const nuevaPila = [inicio];
    if (b.dataset.base && b.dataset.base !== inicio) nuevaPila.push(b.dataset.base);
    if (destino !== nuevaPila[nuevaPila.length - 1]) nuevaPila.push(destino);
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

  async function reproducir() {
    if (reproduciendo) return;
    // Con el recorrido terminado, arranca de nuevo desde el paso 1.
    if (raizEl.classList.contains('demo--fin')) reiniciar();
    reproduciendo = true;
    const mia = ++sesion;
    const sigue = () => reproduciendo && mia === sesion;
    pintarPlay();
    let pausa = PAUSA_INICIAL;
    while (sigue()) {
      await esperar(pausa);
      pausa = PAUSA;
      while (sigue() && ocupado) await esperar(100);
      if (!sigue()) break;
      if ((await siguiente()) === 'fin') break;
    }
    if (mia === sesion) {
      reproduciendo = false;
      pintarPlay();
    }
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
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    if (t.closest?.('input, textarea, select, [contenteditable], [data-demo-rol]')) return;
    const presentando = document.documentElement.classList.contains('demo-presentando');
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      avanzarAMano();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      retrocederAMano();
    } else if (presentando && (e.key === ' ' || e.key === 'Enter') && !t.closest?.('button, a')) {
      e.preventDefault();
      alternarReproduccion();
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
