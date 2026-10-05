// Contactos guardados en la app (puros). Solo los que la persona agrega desde un chat: la demo no lee la agenda
// del teléfono ni muestra números.

export interface Contacto {
  id: string;
  nombre: string;
}

/** Agrega un contacto si no estaba (por id). Devuelve la lista nueva y si se agregó. */
export function agregarContacto<T extends Contacto>(lista: T[], c: T): { lista: T[]; agregado: boolean } {
  if (lista.some((x) => x.id === c.id)) return { lista, agregado: false };
  return { lista: [...lista, c], agregado: true };
}

export const esContacto = (lista: Contacto[], id: string) => lista.some((x) => x.id === id);
