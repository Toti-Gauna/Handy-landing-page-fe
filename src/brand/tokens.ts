// Tokens de marca de Handy. Fuente única: el build los inyecta como variables CSS
// (--color-*, --radio-*, --fuente-*) y los scripts los importan directo.

export const colores = {
  azul: '#1F57A8',
  azulUi: '#4A72B0',
  azulPersonajes: '#2F6BFF',
  gris: '#CFCFCF',
  amarillo: '#F5F59A',
  // Neutros y estados de apoyo
  tinta: '#0E1D36',
  texto: '#2A3550',
  textoSuave: '#5B6782',
  fondo: '#FFFFFF',
  fondoSuave: '#F2F5FA',
  borde: '#DCE3EE',
  error: '#B3261E',
  exito: '#1B7F4B',
  whatsapp: '#1FA855',
} as const;

export const tipografia = {
  familia: "'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  googleFonts:
    'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..900&display=swap',
  pesoTexto: 400,
  pesoMedio: 600,
  pesoTitulo: 800,
  pesoLogo: 900,
} as const;

export const radios = {
  sm: '10px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  pastilla: '999px',
} as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export function variablesCss(): string {
  const lineas = [
    ...Object.entries(colores).map(([k, v]) => `--color-${kebab(k)}:${v};`),
    ...Object.entries(radios).map(([k, v]) => `--radio-${k}:${v};`),
    `--fuente:${tipografia.familia};`,
    `--peso-texto:${tipografia.pesoTexto};`,
    `--peso-medio:${tipografia.pesoMedio};`,
    `--peso-titulo:${tipografia.pesoTitulo};`,
    `--peso-logo:${tipografia.pesoLogo};`,
  ];
  return `:root{${lineas.join('')}}`;
}
