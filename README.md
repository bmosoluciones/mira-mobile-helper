# MIRA Mobile Helper

Aplicacion accesoria para Android construida con Vue 3, TypeScript y Capacitor.

## Objetivo

- Capturar transacciones "on the go" sin depender del escritorio.
- Mantener una cola temporal local de transacciones pendientes.
- Sincronizar por LAN con MIRA Desktop usando QR, pairing temporal y Zeroconf.
- Descargar master data desde escritorio y subir transacciones del helper hacia MIRA.

## Stack

- Vue 3
- Pinia
- Vue Router
- vue-i18n
- Capacitor Android
- `@capacitor-community/sqlite`

## Flujo principal

1. En el primer inicio, elegir idioma y tema.
2. Abrir MIRA Desktop y activar `Mobil > Sincronizar`.
3. Escanear el QR del escritorio desde el helper Android. Como fallback, copiar el codigo temporal o pegar el payload JSON.
4. Tocar `Sincronizar datos`.
5. El helper prueba primero el `host` del QR, luego las `advertised_addresses` del payload y finalmente los servicios Zeroconf o el desktop emparejado previamente.
6. El helper descarga master data y sube los pendientes al primer host LAN que responda correctamente.

## Comandos

```bash
npm install
npm test
npm run build
npm run android:sync
npm run android:open
```

## Notas

- El almacenamiento local del helper es temporal.
- Las transacciones aceptadas por escritorio se eliminan de la lista pendiente local.
- La captura de transacciones se bloquea hasta descargar una master data inicial usable con cuentas y categorias.
- Cuentas, categorias y etiquetas son master data bajo gobierno de MIRA Desktop; el helper movil no las crea, edita ni elimina.
- El menu de configuracion permite cambiar idioma y tema despues del setup inicial.
- La pantalla de transacciones muestra un contador discreto de dias desde la ultima sincronizacion exitosa.
- La discovery Zeroconf usa un plugin Android nativo basado en NSD.
- El QR codifica el mismo `pairing_payload` local visible en el dialogo desktop.
- El helper conserva el fallback manual para casos de camara denegada, QR expirado o permisos de red revocados por el usuario.
- La master data local del helper conserva `global_id`, `sync_version` y `master_data_updated_at`
  para rechazar referencias viejas de forma segura.
- La documentacion inicial propia del helper vive en `tools/mobile-helper/docs/`.
