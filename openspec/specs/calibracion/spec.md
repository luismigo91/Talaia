# Capacidad: calibracion

> Comportamiento **vigente**. Origen: `calibracion-y-avamet` (Fase 9: calibración y AVAMET), archivado el 05-09-2026.

## Requirements

### Requirement: Descarga de histórico
El collector del SAIH DEBE ofrecer una descarga histórica por ventanas de 30 días entre dos fechas, para un subconjunto de sensores o para todos, sin interferir con el ciclo normal.

#### Scenario: Rango largo
- **Dado** un rango de 20 meses
- **Entonces** se trocea en ventanas y una que falle no impide las demás.

### Requirement: Informe de calibración
El sistema DEBE poder informar, por sensor vigilado con umbrales: periodo y número de muestras, mediana y percentiles 90/99/99,9, máximo, horas por encima de cada umbral, los mayores episodios y un veredicto en español sobre si el umbral separa lo normal de lo excepcional.

#### Scenario: Umbral demasiado frecuente
- **Dado** un sensor cuyo umbral amarillo se supera más de 200 h al año
- **Entonces** el veredicto dice que es demasiado frecuente para avisar de algo.

#### Scenario: Umbral nunca alcanzado
- **Dado** un sensor que jamás llega a su umbral amarillo en el periodo
- **Entonces** el veredicto dice que no sabemos si avisa.

#### Scenario: Sensor sin histórico
- **Dado** un sensor sin datos descargados
- **Entonces** se indica y no se calculan estadísticas inventadas.

### Requirement: Lecturas de caudal plausibles
Ver `semaforo-riesgo`: el filtro `lastPlausible` vive al leer y usa `RISK_MAX_FLOW_JUMP`.

