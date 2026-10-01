// Copia sincronizada con Handy-landing-page-be; si cambiás uno, cambiá el otro.
//
// El esquema no lleva textos para el usuario: los mensajes de error salen de
// src/content/registro.json (en el front) según el campo que falló.

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

export const OPCIONES_CUIT = ['si', 'no', 'en_tramite'] as const;

const texto = (min: number, max: number) => z.string().trim().min(min).max(max);

// Acepta +54 9 223 123-4567, 2231234567, (223) 123 4567, etc. Entre 8 y 15 dígitos.
const whatsapp = z
  .string()
  .trim()
  .regex(/^\+?[\d\s().-]+$/)
  .refine((v) => {
    const digitos = v.replace(/\D/g, '').length;
    return digitos >= 8 && digitos <= 15;
  });

const comunes = {
  nombre: texto(2, 80),
  email: z.string().trim().toLowerCase().max(120).email(),
  // Checkbox de consentimiento: obligatorio.
  acepta: z.literal(true),
  // Honeypot: tiene que llegar vacío. Si viene completo, es un bot.
  sitio_web: z.string().max(0).optional(),
};

export const preregistroUsuarioSchema = z.object({
  tipo: z.literal('usuario'),
  ...comunes,
  whatsapp: whatsapp.optional(),
  barrio: texto(2, 80),
  necesidad: z.string().trim().max(500).optional(),
});

export const preregistroEspecialistaSchema = z.object({
  tipo: z.literal('especialista'),
  ...comunes,
  whatsapp,
  rubros: z.array(z.enum(RUBROS)).min(1).max(RUBROS.length),
  zona: texto(2, 120),
  cuit: z.enum(OPCIONES_CUIT),
});

export const preregistroSchema = z.discriminatedUnion('tipo', [
  preregistroUsuarioSchema,
  preregistroEspecialistaSchema,
]);

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
