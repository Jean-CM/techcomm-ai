# Prompt de revisión visual para Gemini

Adjuntar capturas de: Dashboard, Conversaciones, Clientes, Agenda y Órdenes, Inventario, Auditoría, sidebar expandido y sidebar colapsado. Incluir al menos una captura móvil si está disponible.

Usar este prompt:

Actúa como Senior Enterprise Product Designer y UX Reviewer. Evalúa únicamente la calidad visual y de experiencia de usuario de las capturas adjuntas de Techcomm Operations, una plataforma empresarial interna de Techcomm Wireless. No generes código y no propongas cambios de backend, arquitectura, Supabase, autenticación, ElevenLabs, WhatsApp, APIs ni reglas de negocio.

Contexto visual obligatorio: la identidad debe usar una base grafito/negro, azul/cian corporativo como color funcional principal, rojo corporativo solo como acento o estado crítico, y el logo oficial de Techcomm Wireless sin reinterpretarlo. El producto debe sentirse como una plataforma empresarial real, moderna, compacta, operativa y premium; no como un dashboard genérico generado por IA.

Revisa estas dimensiones: jerarquía visual, densidad de información, uso del espacio, legibilidad, tipografía, consistencia de cards/tablas/badges/botones, navegación y sidebar, claridad de acciones primarias/secundarias, color y contraste, uso correcto del azul/rojo corporativo, calidad del dashboard ejecutivo, escaneabilidad de tablas, estados vacíos/carga, drawers/modales, experiencia de Auditoría, reproductor de audio, coherencia entre módulos, responsive aparente y accesibilidad visual.

Para Auditoría, valida especialmente que la tabla principal priorice Fecha, Cliente, Teléfono, Motivo, Orden, Duración, Resultado, Audio y Detalle; que el resumen largo/transcripción no aparezca en la tabla; y que la interfaz se sienta como un centro de calidad/compliance empresarial.

Para Dashboard, valida especialmente si los KPI generan impacto ejecutivo sin ocupar espacio excesivo, si las tarjetas son suficientemente dinámicas pero sobrias, y si los bloques inferiores permiten entender rápidamente qué requiere atención.

Para Conversaciones, valida que la lista sea ligera y fácil de escanear y que la interfaz sugiera que el detalle/transcripción vive bajo demanda.

Devuélveme exactamente:
1. Nota global de 0 a 10.
2. Las 5 cosas mejor logradas.
3. Los 10 problemas visuales más importantes, ordenados por severidad (Crítico / Alto / Medio / Bajo).
4. Para cada problema: pantalla afectada, qué está mal, por qué afecta la experiencia y cambio visual concreto recomendado.
5. Inconsistencias entre pantallas.
6. Evaluación específica de identidad Techcomm (0 a 10).
7. Evaluación específica de apariencia enterprise/premium (0 a 10).
8. Evaluación específica de claridad operativa (0 a 10).
9. Lista final de máximo 8 ajustes que harías antes de presentar el producto a un socio o ejecutivo.
10. Veredicto final: APTO PARA PRESENTACIÓN / APTO CON AJUSTES MENORES / REQUIERE OTRA PASADA VISUAL.

No inventes funcionalidades que no estén visibles. No recomiendes rehacer toda la aplicación si el problema puede solucionarse con ajustes concretos de UI. Sé crítico y específico; evita elogios genéricos.
