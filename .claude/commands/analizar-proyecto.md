# Análisis Profundo del Proyecto — Senior Developer & Analyst

Eres un Senior Developer y Analista de Software con 15+ años de experiencia. Tu tarea es analizar este proyecto React/TypeScript/Supabase en profundidad y producir un informe estructurado y accionable.

## Fase 1 — Relevamiento del proyecto

Antes de analizar, hacé un relevamiento completo:
- Leé `App.tsx`, `src/supabaseClient.ts`, `package.json` y todos los archivos en `src/`
- Identificá las tablas Supabase que se usan (`reagents`, `transactions`, `image_cache`, `config`)
- Identificá los flujos principales de la app (inventario, escaneo IA, vencimientos, transacciones)
- Relevá la estructura de componentes y el estado global

## Fase 2 — Análisis técnico

Analizá en profundidad cada una de estas áreas:

### 1. Bugs y fallas reales
- Condiciones de carrera (race conditions) en operaciones asíncronas
- Estados inconsistentes (loading/error/data mal manejados)
- Efectos secundarios no limpiados (useEffect sin cleanup)
- Mutaciones de estado directo
- Manejo de errores ausente o incompleto
- Edge cases que pueden causar crashes

### 2. Pérdida de datos — riesgo crítico
- Operaciones de escritura a Supabase sin confirmación ni rollback
- Transacciones sin manejo de error que dejan datos corruptos
- Flujos donde el usuario puede perder trabajo no guardado
- Datos en localStorage que pueden desincronizarse con Supabase
- Operaciones destructivas (delete, update) sin validación previa
- Falta de optimistic updates que pueden confundir al usuario

### 3. Seguridad
- Credenciales hardcodeadas o expuestas en cliente
- Ausencia de validación de inputs del usuario
- Operaciones que deberían requerir autenticación pero no la tienen
- Datos sensibles en localStorage sin protección

### 4. Performance
- Re-renders innecesarios (falta de memo, useCallback, useMemo)
- Queries a Supabase sin paginación que pueden traer demasiados datos
- Imágenes o assets sin optimizar
- Lógica pesada en el hilo principal

### 5. Calidad de código
- Duplicación de lógica que debería estar en hooks o utils
- Componentes demasiado grandes (>300 líneas) que mezclan responsabilidades
- Tipado TypeScript débil (uso excesivo de `any`, tipos poco descriptivos)
- Props drilling profundo que debería usar contexto

### 6. Mejoras de UX/UI
- Flujos de usuario que requieren demasiados pasos
- Feedback visual ausente en operaciones largas
- Estados vacíos sin mensaje informativo
- Formularios sin validación en tiempo real
- Navegación confusa o poco intuitiva
- Accesibilidad (a11y): falta de labels, contraste, keyboard navigation
- Responsividad en distintos tamaños de pantalla
- Consistencia visual entre secciones

## Fase 3 — Informe final

Presentá el informe con este formato exacto:

---

## INFORME DE ANÁLISIS — [nombre del proyecto]

### RESUMEN EJECUTIVO
[2-3 párrafos con el estado general del proyecto, nivel de madurez, y los 3 problemas más urgentes]

---

### 🔴 CRÍTICO — Requiere atención inmediata
[Problemas que pueden causar pérdida de datos, crashes, o vulnerabilidades de seguridad]
Para cada item:
- **Problema:** descripción clara
- **Ubicación:** archivo:línea
- **Impacto:** qué puede pasar si no se corrige
- **Solución propuesta:** cómo corregirlo

---

### 🟠 IMPORTANTE — Deuda técnica significativa
[Bugs, mal manejo de errores, performance, código duplicado]
Mismo formato que arriba.

---

### 🟡 MEJORA — Calidad y mantenibilidad
[Refactors, tipado, separación de responsabilidades]
Mismo formato que arriba.

---

### 🎨 UI/UX — Experiencia de usuario
[Mejoras visuales y de flujo organizadas por sección de la app]
Para cada item:
- **Sección:** qué parte de la app
- **Problema actual:** qué está mal o falta
- **Mejora propuesta:** qué cambiar y cómo debería verse/funcionar

---

### 📊 MÉTRICAS DEL ANÁLISIS
- Total de archivos analizados: X
- Bugs críticos encontrados: X
- Riesgos de pérdida de datos: X
- Mejoras UI identificadas: X
- Deuda técnica estimada: X horas/días

---

### PLAN DE ACCIÓN RECOMENDADO
Priorización en 3 sprints:
- **Sprint 1 (esta semana):** los más urgentes
- **Sprint 2 (próxima semana):** importantes pero no críticos
- **Sprint 3 (después):** mejoras y calidad

---

Sé específico, directo y accionable. No generalices. Cada hallazgo debe tener una ubicación exacta en el código y una solución concreta.
