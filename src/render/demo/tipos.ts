// Contrato de la demo interactiva (/demo/).
//
// Cada rol (usuario / especialista) aporta sus pantallas y su recorrido. El HTML se arma en build
// (como el resto del sitio) y src/scripts/demo/motor.ts lo vuelve navegable con estos atributos:
//
//   data-ir="u-presupuestos"   → navega a esa pantalla (se apila: "Volver" regresa)
//   data-volver                → vuelve a la pantalla anterior (o cierra la hoja abierta)
//   data-ir-raiz="u-turnos"    → cambia de pestaña (barra inferior): reinicia la pila
//   data-accion="nombre"       → llama a la acción registrada por el módulo del rol (src/scripts/demo/<rol>.ts);
//                                puede combinarse con data-ir / data-volver (primero corre la acción)
//   data-valor="…"             → dato opcional para la acción
//   data-guia                  → "lo próximo para tocar" en el recorrido: se resalta y lo toca el modo automático
//
// Todo lo que se toca es un <button type="button"> (usar las piezas de piezas.ts).
// Ids: usuario con prefijo "u-", especialista con "e-".
// Ids obligatorios por rol (los usan la barra inferior y la campana): <p>-inicio, <p>-turnos,
// <p>-mensajes, <p>-cuenta, <p>-notificaciones.

export type RolDemo = 'usuario' | 'especialista';

export interface PantallaDemo {
  /** "u-…" o "e-…" */
  id: string;
  /** Nombre corto para lectores de pantalla (se anuncia al entrar). */
  titulo: string;
  /**
   * "pantalla" (por defecto): html es un <div class="app">…</div> completo que ocupa todo el celular.
   * "hoja": html es SOLO el contenido de una hoja inferior; se muestra encima de la pantalla anterior,
   * con velo. El contenedor .app-sheet lo pone la página.
   */
  tipo?: 'pantalla' | 'hoja';
  html: string;
}

export interface PasoRecorrido {
  /** Id de la pantalla que muestra este paso. */
  pantalla: string;
  /**
   * Pantalla sobre la que se abre este paso cuando se salta directo a él (queda debajo en la pila, encima
   * del inicio): para una hoja, la pantalla de fondo; para una pantalla, la del paso anterior, así
   * "Volver" y la flecha llevan ahí.
   */
  base?: string;
  titulo: string;
  /** Qué contar en la presentación: una o dos oraciones. */
  texto: string;
}

export interface DemoRol {
  /** Pantalla con la que arranca el rol (y a la que vuelve "Volver a empezar"). */
  inicio: string;
  pantallas: PantallaDemo[];
  recorrido: PasoRecorrido[];
}
