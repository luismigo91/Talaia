## ADDED Requirements

### Requirement: Collector Hidrosur sin clave
El collector DEBE leer `resumen/rios` (nivel+caudal de última hora con su
"Datos actualizados a"), `resumen/embalses` (%+hm³) y `grafica/{codigo}` por
estación (histórico horario 48 h de lluvia y nivel) de
`redhidrosurmedioambiente.es/saih`, sin autenticación, y escribir
`observations` con `source='hidrosur'` y sensores `hidrosur:{numero}:{variable}`.
Las horas de las etiquetas van en `Europe/Madrid` → UTC. Los códigos de
gráfica de ríos y embalses DEBEN salir de los enlaces de las propias tablas;
en pluviómetros vale `{numero}P01` verificado por `sensorTipo`.

#### Scenario: Tablas y gráficas reales del 01-10-2026
- **Dado** las capturas en `collectors/hidrosur/fixtures/`
- **Entonces** Cártama 38 da nivel 0,01 m y caudal 0,01 m³/s, Limonero 20 da
  100 % y 14 hm³, y la gráfica 086P01 suma 1,9 mm.

#### Scenario: Pluviómetro sin lluvia
- **Dado** una gráfica con `labels = []`
- **Entonces** no genera observaciones y no es un error.

### Requirement: Caudal Hidrosur como contexto
Los sensores `river_flow_m3s` de Hidrosur NO DEBEN llevar umbrales hasta
calibrar con episodios reales; la lluvia usa los globales de AEMET. El ciclo
DEBE devolver `warning` (no error) si alguna estación falla habiendo escrito
datos.
