// Tokens de marca de Handy. Fuente única: el build los inyecta como variables CSS
// (--color-*, --radio-*, --fuente-*) y los scripts los importan directo.

export const colores = {
  azul: '#1F57A8',
  azulUi: '#4A72B0',
  azulPersonajes: '#2F6BFF',
  gris: '#CFCFCF',
  amarillo: '#F5F59A',
  // Neutros y estados de apoyo, tomados de las pantallas de la app
  noche: '#1D2C4A', // pastillas oscuras ("Programado") y días marcados del calendario
  mosaico: '#ECECEC', // fondo de los mosaicos de rubros
  hueso: '#F7F6F1', // fondo cálido de secciones claras
  tinta: '#0E1D36',
  texto: '#26324A',
  textoSuave: '#5F6B84',
  fondo: '#FFFFFF',
  borde: '#DADFE8',
  naranja: '#F6A623', // "hoy" en el calendario
  error: '#D93025',
  exito: '#1E9E57',
  whatsapp: '#1FA855',
} as const;

export const tipografia = {
  titulos: "'Archivo', 'Arial Black', system-ui, sans-serif",
  texto: "'DM Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  googleFonts:
    'https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100..125,500..900&family=DM+Sans:opsz,wght@9..40,400..800&display=swap',
  pesoTexto: 400,
  pesoMedio: 600,
  pesoTitulo: 900,
} as const;

export const radios = {
  sm: '10px',
  md: '16px',
  lg: '24px',
  xl: '36px',
  pastilla: '999px',
} as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

export function variablesCss(): string {
  const lineas = [
    ...Object.entries(colores).map(([k, v]) => `--color-${kebab(k)}:${v};`),
    ...Object.entries(radios).map(([k, v]) => `--radio-${k}:${v};`),
    `--fuente:${tipografia.texto};`,
    `--fuente-titulos:${tipografia.titulos};`,
    `--peso-texto:${tipografia.pesoTexto};`,
    `--peso-medio:${tipografia.pesoMedio};`,
    `--peso-titulo:${tipografia.pesoTitulo};`,
  ];
  return `:root{${lineas.join('')}}`;
}
