// Copia sincronizada con Handy-landing-page-fe (src/schema/preregistro.ts): si cambiás uno, cambiá
// el otro, y los enums de handy-internal-portal/src/contracts/landing-api.ts. Contrato objetivo
// alineado con LEG-04 04-A (docs/contract-delta.md): sin CUIT; usuario solo con email.
//
// El esquema no lleva textos para el usuario: los mensajes salen del front según el campo fallido.

import { z } from 'zod';

export const TIPOS = ['usuario', 'especialista'] as const;

export const RUBROS = [
  'electricidad',
  'plomeria',
  'gas',
  'cerrajeria',
  'albanileria',
  'aire_acondicionado',
] as const;

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

// Sin caracteres de control ni invisibles/bidireccionales (\p{C}): ni NUL (rompe PostgreSQL) ni texto
// que engañe a una pantalla del CRM.
const sinControl = (v: string): boolean => !/\p{C}/u.test(v);

// Zona de Mar del Plata: letras, números y puntuación simple; sin "=+-@<>" iniciales (fórmulas de planilla,
// HTML) y sin saltos de línea. Es un filtro, no una dirección exacta: no se piden calles ni números.
const zona = texto(2, 120).regex(/^[\p{L}\p{N}][\p{L}\p{N} .,'()/-]*$/u);

// Acepta +54 9 223 123-4567, 2231234567, (223) 123 4567, etc. Entre 8 y 15 dígitos.
const whatsapp = z
  .string()
  .trim()
  .max(40)
  .regex(/^\+?[\d\s().-]+$/)
  .refine((v) => {
    const digitos = v.replace(/\D/g, '').length;
    return digitos >= 8 && digitos <= 15;
  });

const comunes = {
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(120)
    .email()
    .regex(/^[\x21-\x7e]+$/),
  // Checkbox de consentimiento: obligatorio y sin tildar por defecto.
  acepta: z.literal(true),
  // Versión del aviso de privacidad que se mostró. El servidor tiene su propia lista de versiones
  // permitidas y fija el hash del texto: el navegador nunca manda el texto.
  aviso: z.string().regex(/^[a-z0-9._-]{1,64}$/),
  // Honeypot: tiene que llegar vacío. El servidor lo evalúa antes de validar y no lo guarda.
  sitio_web: z.string().max(0).optional(),
};

export const preregistroUsuarioSchema = z.strictObject({
  tipo: z.literal('usuario'),
  email: comunes.email,
  acepta: comunes.acepta,
  aviso: comunes.aviso,
  sitio_web: comunes.sitio_web,
});

export const preregistroEspecialistaSchema = z.strictObject({
  tipo: z.literal('especialista'),
  nombre: texto(2, 80).refine(sinControl),
  whatsapp,
  rubros: z
    .array(z.enum(RUBROS))
    .min(1)
    .max(RUBROS.length)
    .refine((v) => new Set(v).size === v.length),
  zona,
  // Opcional: si se completa, tiene que ser válido.
  email: comunes.email.optional(),
  acepta: comunes.acepta,
  aviso: comunes.aviso,
  sitio_web: comunes.sitio_web,
});

export const preregistroSchema = z.discriminatedUnion('tipo', [
  preregistroUsuarioSchema,
  preregistroEspecialistaSchema,
]);

// Campos que el backend puede rechazar: los mismos nombres que el formulario.
export const CAMPOS = ['nombre', 'email', 'whatsapp', 'rubros', 'zona', 'acepta', 'aviso'] as const;

// Respuesta 400 de POST /preregistro cuando la validación del servidor rechaza campos.
export const errorValidacionSchema = z.object({
  error: z.literal('validacion'),
  campos: z.array(z.string()),
});

// Respuesta de GET /preregistro/contador
export const contadorSchema = z.object({
  usuarios: z.number().int().nonnegative(),
  especialistas: z.number().int().nonnegative(),
});

export type Tipo = (typeof TIPOS)[number];
export type Rubro = (typeof RUBROS)[number];
export type Preregistro = z.infer<typeof preregistroSchema>;
export type PreregistroUsuario = z.infer<typeof preregistroUsuarioSchema>;
export type PreregistroEspecialista = z.infer<typeof preregistroEspecialistaSchema>;
export type Contador = z.infer<typeof contadorSchema>;
export type Campo = (typeof CAMPOS)[number];
