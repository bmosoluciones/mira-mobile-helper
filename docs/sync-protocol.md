# Sync Protocol Notes

## Estado del contrato

El contrato entre `app/desktop` y `app/mobile-helper` se mantiene en la misma familia
de protocolo privada y experimental `v1` que usa `app/mobile`, pero el helper consume
solo el subconjunto necesario para captura rapida y envio.

En la fase actual, el helper opera principalmente en un flujo `mobile -> desktop`. Los puntos
siguientes estan implementados y probados:

| Punto del contrato | Estado |
|----|---|
| Desktop expone el servicio | OK `MobileSyncServer` con HTTPS, TLS efimero y mDNS |
| Movil descubre el servicio en red local | OK Plugin `ZeroconfDiscovery` via Android NSD |
| Sin fugas hacia el exterior | OK `_ensure_lan_client` bloquea cualquier IP no LAN/loopback |
| Movil envia transacciones (crear/actualizar) | OK `POST /api/mobile/v1/transactions/push` |
| Movil actualiza transacciones | OK operacion `update` con `base_version` para control de conflictos |
| Confirmacion del resultado de sincronizacion | OK evento en el servidor + `statusMessage` en el cliente |
| Metodo de sincronizacion robusto | OK reintentos multi-host, manejo de conflictos, rate limiting y TLS pinning |
| Capacidades opcionales de cursor disponibles | OK `changes` y `ack` existen sin convertir al helper en full mirror |

---

## Discovery

- Android usa un plugin Capacitor nativo (`ZeroconfDiscovery`) basado en NSD.
- El helper busca servicios `_mira-mobile-sync._tcp`.

## Pairing

- Desktop expone un payload de emparejamiento local con `api_base_url`, `pairing_code`,
  `pairing_token`, expiracion, `transport_scheme=https`,
  `tls_fingerprint_sha256` y direcciones anunciadas.
- Desktop muestra ese mismo payload como QR. El contenido del QR es JSON compacto y local.
- El helper puede usar el QR, el payload serializado completo o el codigo temporal manual.
- El backend devuelve un `device_id` y un token de sesion efimero.

## Direcciones y reconexion

- El payload contiene `host` como direccion preferida y `advertised_addresses` como lista de candidatos LAN.
- El helper intenta emparejar en este orden: `host`, cada `advertised_addresses`, servicios Zeroconf y desktop emparejado previamente.
- El `pairedDesktop` guardado en almacenamiento local conserva `transportScheme` y
  `tlsFingerprintSha256` para que la reconexion use TLS pinning sin necesidad de re-escanear el QR.
- En Flatpak y Snap se espera acceso de red habilitado para la sincronizacion local: Flatpak usa `--share=network` y Snap usa `network` + `network-bind`.
- No se requiere `network-observe`; el escritorio descubre IPs mediante sockets UDP locales y resolucion de hostname.
- `master-data` es un snapshot completo con `master_data_updated_at` y `global_id`
  para cuentas, categorias y etiquetas requeridas por el flujo de captura.
- `transactions/push` envia creates y updates usando `account_global_id`,
  `category_global_id`, `tag_global_ids`, `sync_id`, `base_version` y el
  marcador `master_data_base_at`.

## Transporte seguro

- El transporte activo es `HTTPS` en LAN local con certificado efimero de sesion.
- El helper aplica pinning por `tls_fingerprint_sha256` incluida en el payload QR/manual.
- Si el transporte no es seguro o la huella no coincide, el helper bloquea la sincronizacion antes de enviar datos.
- El `pairedDesktop` guardado incluye `tls_fingerprint_sha256` para reconexiones TLS sin re-escanear.

## Negociacion de capacidades

- `protocol_version=1` es la version soportada actualmente por el helper.
- Capacidades obligatorias del servidor para el helper actual:
  - `master-data`
  - `transactions-push`
  - `secure-transport-tls-pinned`
- Capacidades opcionales:
  - `transactions-changes`
  - `transactions-ack`
- Si faltan capacidades obligatorias, el helper falla con error de negociacion.
- Si faltan capacidades opcionales, el helper conserva sincronizacion unidireccional (`push`) sin marcar error.
- `app/mobile` comparte esta misma familia de protocolo, pero consume mas capacidades
  del servidor para su flujo bidireccional experimental.

## Alcance funcional actual

- El helper movil es cliente de captura y envio (`mobile -> desktop`).
- El helper no aplica sincronizacion bilateral ni replica cambios del desktop como espejo funcional en esta fase.
- El uso de `changes/ack` no convierte al helper en espejo funcional del desktop; esas
  capacidades solo mantienen abierta la evolucion del protocolo y el manejo de cursor.
- El protocolo soporta operaciones `create`, `update` y `delete`. En esta fase el helper movil
  solo emite `create` y `update`; la operacion `delete` esta reservada para la fase bidireccional.

## Persistencia

- Android usa SQLite mediante `@capacitor-community/sqlite`.
- En web/test se usa un fallback local para desarrollo.
- El helper migra en lectura estados locales viejos para completar `global_id`,
  `masterDataBaseAt` y el desktop emparejado sin perder pendientes.
- El `pairedDesktop` guardado preserva `transportScheme` y `tlsFingerprintSha256`
  para que la reconexion TLS funcione correctamente sin re-escanear el QR.

Para la comparacion completa con `app/mobile`, revisa [la guia central del workspace](../../../docs/relacion-entre-apps.md).
