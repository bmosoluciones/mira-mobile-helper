# Mobile Helper Overview

`tools/mobile-helper` nace dentro del repo principal para coordinar cambios con MIRA Desktop, pero esta preparado para evolucionar luego como proyecto independiente.

## Alcance actual

- Setup inicial con seleccion de idioma, tema y primera sincronizacion obligatoria.
- Captura offline de ingresos y gastos.
- Parser local en TypeScript alineado con el normalizador determinista de escritorio.
- Cola temporal local de transacciones pendientes.
- Sync LAN iniciada manualmente desde escritorio.
- Menu de configuracion para cambiar idioma y tema luego del onboarding.

## Coordinacion con escritorio

- El helper depende del menu `Mobil > Sincronizar` en MIRA Desktop.
- La master data baja desde escritorio hacia el helper.
- Cuentas, categorias y etiquetas se consideran master data gobernada por escritorio; el helper no implementa CRUD para esos registros.
- El helper bloquea la captura hasta tener al menos una cuenta y una categoria sincronizadas.
- Las transacciones del helper suben hacia escritorio con `ULID`, `base_version` y conflictos explicitos.

## Futuro desacople

- README y docs ya viven dentro del subproyecto.
- La arquitectura del helper evita imports desde `src/mira`.
- El siguiente paso natural seria mover `tools/mobile-helper` a un repo propio o a un submodulo.
