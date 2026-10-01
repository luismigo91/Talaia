# Capacidad: web-semaforo

> Comportamiento **vigente**. Origen: `frontend-web` (Fase 6), archivado el 05-09-2026.

## ADDED Requirements

### Requirement: Pantalla de inicio con todas las localizaciones
La página `/` DEBE mostrar una tarjeta por localización objetivo, con su nombre, su nivel y la señal que lo determina (si el máximo es rojo, rojo con su motivo), ordenadas con la principal primero y las de mayor riesgo antes que las de menor. El desglose completo de componentes vive en `/l/{id}`, enlazado desde la tarjeta con el número de señales.

#### Scenario: Orden por riesgo
- **Dado** Albal en `verde` y Benaguasil en `naranja`
- **Entonces** Benaguasil aparece antes que Albal.

#### Scenario: Empate
- **Dado** todas las localizaciones en el mismo nivel
- **Entonces** la principal (Albal) aparece primera.

### Requirement: El nivel se distingue sin depender del color
Cada nivel DEBE mostrarse con su **nombre en texto** además del color, y la tarjeta DEBE llevar un texto accesible que lo indique.

#### Scenario: Daltonismo
- **Dado** una localización en `naranja`
- **Entonces** en la tarjeta aparece la palabra "naranja", no solo el color.

### Requirement: Explicación visible
El detalle por localidad (`/l/{id}`) DEBE mostrar cada componente del riesgo con
su `detail` en español, y las advertencias de frescura DEBEN ser visibles, no
ocultarse tras un desplegable. La tarjeta de inicio muestra solo la señal que
manda; el resto no se duplica en la home.

#### Scenario: Datos obsoletos
- **Dado** una localización con advertencias de datos obsoletos
- **Entonces** se muestran junto al nivel, indicando que el verde puede no ser fiable.

#### Scenario: Sin datos
- **Dado** una localización sin componentes evaluables
- **Entonces** se indica explícitamente que no hay datos, en lugar de mostrar un verde limpio.

### Requirement: Histórico reciente
La página DEBE mostrar las últimas transiciones de nivel con su localidad, niveles anterior y nuevo, y el momento en hora local de Madrid.

#### Scenario: Sin transiciones
- **Dado** que no ha habido cambios de nivel
- **Entonces** se indica que no hay cambios registrados, sin dejar un hueco vacío.

### Requirement: Frescura de la propia página
La página DEBE indicar de cuándo son los datos y refrescarlos al menos cada 60 segundos.

#### Scenario: Marca de tiempo
- **Dado** una carga de la página
- **Entonces** se muestra la hora de cálculo en `Europe/Madrid`.
