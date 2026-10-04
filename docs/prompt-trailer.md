# Prompt para actualizar los trailers de Handy (motion graphics)

> Copiá todo lo que sigue y dáselo a quien edita el trailer. Va junto con el pack de fotos de la demo
> (`handy-demo-fotos.zip`: pantallas como app a 1170×2532, dentro del celular con marco, errores y pestañas).

---

Sos motion designer. Tenés que **actualizar el trailer de Handy que ya hicimos** (no empezar de cero): conservá su
estructura, ritmo, música, personajes y cierre, y reemplazá o sumá las escenas de la app con las pantallas nuevas del
pack de fotos. Hay dos versiones: **usuario** ("Handy en un minuto", ~60 s) y **especialista** ("Handy Especialistas
en un minuto", ~60 s). Entregá también un corte de 15 s de cada una.

## Qué es Handy
App de Mar del Plata que conecta a vecinos con especialistas del hogar verificados (Electricidad, Plomería, Gas,
Cerrajería, Albañilería, Aire acondicionado). Sale en tiendas el **28/10/2026**. El objetivo del trailer es que la
gente se anote en la lista de pre-registro.

## Identidad (no cambiar)
- Colores: azul Handy `#1F57A8` (base), azul UI `#4A72B0`, amarillo marcador `#F5F59A`, gris mosaico `#ECECEC`,
  tinta `#0E1D36`, blanco. Verde éxito `#1E9E57` solo para montos que entran y tildes.
- Tipografía: títulos en **Archivo 900 ensanchado** (font-stretch 125%), texto en **DM Sans**. Una palabra clave de
  cada título va con el **marcador amarillo** por detrás (como "¿Qué necesitás ==hoy==?").
- Lenguaje visual: mosaicos grises redondeados (la grilla de rubros), botones azules cuadrados con una base que se
  hunde al tocarlos, hojas que suben desde abajo con manija, tickets troquelados para precios.
  Nada de gradientes, vidrio esmerilado, neón ni bordes laterales de color.
- Personajes (los Handys): gota y caño, lamparita (es HandIA, el asistente), engranaje, llave. Se mueven con rebote
  suave: flotan, saltan, festejan. Para un momento de "algo salió mal" existen sus versiones **rotas** (partidas al
  medio, ojos en X, chispas / gotas / humo): usalas solo como guiño de humor, nunca como escena principal.
- Celular: proporción real 9:19.5, marco oscuro fino, isla arriba. Los avisos en tiempo real salen **de la isla**,
  como una pastilla negra que se expande (es la firma de la app).

## Reglas de lenguaje (obligatorias en todo texto en pantalla y voz en off)
- Español rioplatense con voseo ("pedís", "elegís", "cobrás"). Nada de "tú" ni "usted".
- Plata en pesos con formato `$ 45.000`. Nunca dólares.
- Decí "verificados". No digas "matriculados" ni "despachamos".
- **No prometas tiempos**: nada de "inmediato", "al instante", "en minutos" ni relojes de llegada. El horario lo
  declara el especialista (se muestra como franja: "Hoy · 16 a 18 h").
- El especialista pone su precio; Handy **sugiere**, nunca impone.
- La plata va directo a la cuenta del especialista; Handy cobra solo su tarifa (cliente 5%, especialista 10%).
- Sin estadísticas, ratings, cantidad de usuarios ni testimonios inventados. Los nombres de la app son de ejemplo
  ("Especialista 1", "Cliente · La Perla"): mostralos tal cual o desenfocá.

## Trailer usuario — escenas a actualizar o sumar (en este orden)
1. **Inicio** (`usuario/app/01-u-inicio`): arriba, "Tu próximo turno"; los seis rubros en mosaicos. Toque en Plomería
   (el mosaico se hunde).
2. **Para cuándo** (`u-opciones`): Urgencia / Programado / Obra. Texto: "Lo antes posible, o el día y la hora que quieras."
3. **Elegís día y hora** (`u-programar` + `u-elegir-fecha` / `u-elegir-hora`): calendario propio y las ruedas de hora.
   Texto: "Pedís el día y la hora. El especialista te confirma o te propone otra."
4. **Propuestas claras** (`u-presupuestos`): tarjetas verticales con mano de obra, materiales, "Tarifa de Handy ·
   cliente (5%)" y "Total final para vos". Destacá el total ($ 47.250). Texto: "El total que ves es el que pagás."
5. **Elegís vos** (`u-perfil`, `u-historial`): perfil verificado e historial de trabajos.
6. **Trabajo en curso** (`u-seguimiento`): mapa de Mar del Plata con la costa, la ruta que se dibuja y el especialista
   que viaja; aviso de isla "Especialista 1 salió para tu casa". Sin botones de "confirmar llegada".
7. **Nada extra sin tu OK** (tarjeta de adicional en el seguimiento): "Llave de paso nueva · $ 8.000" → Aceptar.
   Texto: "Si hace falta algo más, te lo propone. Vos decidís."
8. **Chat** (`u-chat`): burbujas, "escribiendo…", chips "Programar turno" / "Quiero un turno ahora".
9. **¡Listo!** (`u-terminado`): Handys festejando, tilde verde, confeti de mosaicos azules, amarillos y grises.
10. **Tu agenda** (`u-turnos`): tocás un día y aparecen sus trabajos.
11. Cierre (mantené el actual): "Anotate y te avisamos el 28/10." + logo Handy + "Soluciones, no problemas".

## Trailer especialista — escenas a actualizar o sumar
1. **Disponible** (`e-inicio`): el interruptor se prende, radar en el mapa, aviso de isla "Nuevo pedido de plomería".
2. **Tu precio** (`e-precio`): Handy sugiere, vos decidís; el número cuenta y se ve "Recibís $ 39.600". Mostrá
   también "Prefiero elegir el horario". Texto: "El precio lo ponés vos."
3. **El cliente te eligió** (`e-aceptado`): tilde y confeti.
4. **En camino** (`e-en-camino`): mapa con la ruta; la llegada se marca sola (sin botón "Llegué"). Mostrá un segundo
   del aviso de ubicación ("solo durante este trabajo").
5. **Repuestos y mano de obra extra** (`e-trabajo` + `e-adicional`): lo agregás con su precio, el cliente lo acepta.
6. **Ganaste** (`e-fin`): "$ 47.700" contando, "La plata va directo a tu cuenta".
7. **Tu agenda y tu chat** (`e-turnos`, `e-conversacion`): turnos propuestos desde el chat, separado de WhatsApp.
8. Cierre (mantené el actual): camada fundadora "50 lugares · 5% durante 12 meses" + "Quiero sumarme".

## Animación (guía)
- Transiciones entre pantallas como iOS: la nueva entra desde la derecha, la anterior se corre un poco y se oscurece.
  Hojas: suben con un rebote corto.
- Toques: un punto blanco con aro azul y una onda amarilla al tocar.
- Montos: cuentan hasta el valor final (0,9 s, ease-out).
- Contenido: entra en cascada (cada bloque 55 ms después del anterior, sube 1 em y aparece).
- Ritmo: una idea por plano, textos cortos (máx. 8 palabras), 2 a 3 s por pantalla.

## Entregables
- Usuario y especialista: 16:9 (1920×1080) y 9:16 (1080×1920), ~60 s, más un corte de 15 s de cada uno.
- MP4 (H.264) de **menos de 25 MB** cada uno y una portada (`.webp` o `.jpg`) por video.
- Nombres: `trailer-usuario.mp4`, `trailer-usuario.webp`, `trailer-especialista.mp4`, `trailer-especialista.webp`
  (van en `assets/video/` del repo de la landing).
- Subtítulos quemados en la versión 9:16 (sin audio también se tiene que entender).
