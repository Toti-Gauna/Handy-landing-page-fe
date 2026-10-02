// Íconos SVG de línea (24×24, currentColor). Decorativos: llevan aria-hidden.

const trazos: Record<string, string> = {
  // Rubros
  rayo: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  canilla:
    '<path d="M4 9h7a3 3 0 0 1 3 3v1"/><path d="M4 6v6"/><path d="M8 9V6h3"/><path d="M7 5h5"/><path d="M14 13h3a2 2 0 0 1 2 2v1"/><path d="M19 19.5c0 .8-.7 1.5-1.5 1.5S16 20.3 16 19.5c0-1 1.5-2.5 1.5-2.5s1.5 1.5 1.5 2.5Z"/>',
  llama:
    '<path d="M12 22c4 0 7-2.7 7-6.7 0-3.4-2.3-5.9-4-7.8-.4 1.8-1.4 3-2.6 3.5C12.9 8 12 4.6 9.5 2 9.6 5.4 5 8.6 5 15.3 5 19.3 8 22 12 22Z"/><path d="M12 22c-1.7 0-3-1.2-3-3 0-2 1.8-3.2 3-4.8 1.2 1.6 3 2.8 3 4.8 0 1.8-1.3 3-3 3Z"/>',
  llave:
    '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8"/><path d="m16 7 3 3"/><path d="m18.5 4.5 2 2"/>',
  ladrillos:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.3h18M3 14.7h18"/><path d="M9 4v5.3M15 4v5.3M12 9.3v5.4M7 14.7V20M17 14.7V20"/>',
  aire:
    '<rect x="2.5" y="4" width="19" height="9" rx="2"/><path d="M6 10h12"/><path d="M8 16.5c0 1.5-1 2-1 3.5M12 16.5v4M16 16.5c0 1.5 1 2 1 3.5"/>',
  // Confianza
  escudo: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  telefono:
    '<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M11 18h2"/><path d="M3 3l18 18"/>',
  billetera:
    '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/><path d="M3 7h16a2 2 0 0 1 2 2v3h-5a2 2 0 0 0 0 4h5"/>',
  // Herramientas del especialista
  interruptor: '<rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="17" cy="12" r="3"/>',
  etiqueta:
    '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/><path d="M11 14.5c.4.9 1.3 1.5 2.3 1.4 1.2-.1 1.9-1 1.7-2s-1.2-1.3-2.2-1.6-1.9-.8-2-1.8.6-1.8 1.7-1.9c1-.1 1.8.4 2.2 1.2"/>',
  calendario:
    '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12Z"/><path d="M8.5 11h7M8.5 14h4"/>',
  caja:
    '<path d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9Z"/><path d="M5 10 7 4h10l2 6"/><path d="M9 15h6"/><path d="M10 7h4"/>',
  // Interfaz
  mas: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  enviar: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5L21 3Z"/>',
  imagen: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  prohibido: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  caminar: '<circle cx="13" cy="4.5" r="2"/><path d="M10 21l2-6 3 3v3"/><path d="M8 11l3-3h3l2 4 3 1"/><path d="m12 8-1.5 5"/>',
  abajo: '<path d="m6 9 6 6 6-6"/>',
  izquierda: '<path d="m15 6-6 6 6 6"/>',
  derecha: '<path d="m9 6 6 6-6 6"/>',
  maletin: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.5" r="3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  expandir: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  pausa: '<path d="M8 5v14M16 5v14"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  flecha: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  atras: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  play: '<path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5Z"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pin: '<path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12Z"/><circle cx="12" cy="10" r="2.5"/>',
  campana:
    '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path d="M10 21h4"/>',
  casa: '<path d="M3 11 12 3l9 8"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  alerta: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
  verificado:
    '<path d="m12 2 2.4 1.8 3 .1.9 2.9 2.4 1.8-.9 2.9.9 2.9-2.4 1.8-.9 2.9-3 .1L12 22l-2.4-1.8-3-.1-.9-2.9-2.4-1.8.9-2.9-.9-2.9 2.4-1.8.9-2.9 3-.1Z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>',
  reintentar: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
  // Demo (cuenta, avisos, chat, calificación)
  arriba: '<path d="m6 15 6-6 6 6"/>',
  engranaje: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  tacho: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M9 7V4h6v3"/>',
  pregunta: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.6"/><path d="M12 17h.01"/>',
  salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5"/><path d="M5 12h11"/>',
  contactos: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.6 0 4.5 1.9 4.5 4.5"/>',
  checkCirculo: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16.5 9.5"/>',
  editar: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  estrella: '<path stroke-width="1.8" d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z"/>',
  whatsapp:
    '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3.1l-4.7 1.4Z"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.6-2-1-1 1c-1.2-.5-2.4-1.7-2.9-2.9l1-1-1-2L9 8.5Z"/>',
};

export function icono(nombre: string, clase = 'icono'): string {
  const d = trazos[nombre];
  if (!d) throw new Error(`Ícono inexistente: ${nombre}`);
  return `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}
