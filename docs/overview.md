# Mobile Helper Overview

`app/mobile-helper` es la companion app ligera de la familia MIRA para registrar
transacciones rapidamente desde el celular y transferirlas luego a `app/desktop`.

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
- El helper no replica desktop como espejo funcional completo ni implementa sincronizacion bidireccional total.

## Relacion con `app/mobile`

- `app/mobile` es el producto movil mas completo y offline-first.
- `app/mobile-helper` comparte la misma direccion visual y una experiencia de captura parecida.
- Ambas apps usan la misma familia de protocolo `v1` contra desktop.
- El helper consume solo el subconjunto necesario para captura y envio.

## Futuro desacople

- README y docs ya viven dentro del subproyecto.
- La arquitectura del helper evita imports desde `src/mira`.
- El siguiente paso natural seria mover `app/mobile-helper` a un repo propio o a un submodulo.

Para una vista comparativa entre las tres apps, revisa [la guia central del workspace](../../../docs/relacion-entre-apps.md).
