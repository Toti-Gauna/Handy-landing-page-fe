// Configuración del pre-registro.

// URL base del backend (Handy-landing-page-be), sin barra final.
// Vacío = el registro muestra "Registro habilitado en breve" y no se pide el contador.
// Se puede definir en el build con la variable VITE_FORM_ENDPOINT (en GitHub: Settings → Variables → FORM_ENDPOINT).
export const FORM_ENDPOINT: string = (import.meta.env.VITE_FORM_ENDPOINT ?? '').replace(/\/+$/, '');

// El contador de anotados se muestra solo si el número de ese tipo llega a este mínimo.
export const CONTADOR_MINIMO = 20;

// Tiempo máximo de espera de cada pedido al backend.
export const TIMEOUT_MS = 15000;
