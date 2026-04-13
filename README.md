# MIRA Mobile Helper

Auxiliary Android capture client for MIRA Desktop.

`app/mobile-helper` remains the lightweight companion app used to record transactions quickly and sync them back to desktop. It now follows the same visual language as `app/mobile` so users see one coherent product family.

## Scope

The helper is intentionally smaller than `app/mobile`.

It is built for:

- quick transaction capture
- local temporary queue management
- LAN pairing and sync with desktop
- natural-language assistance for income and expense entry

It does not own the full mobile product scope. In particular, it does not manage:

- full account/category/tag CRUD
- advanced analysis
- desktop reports
- local AI or `.gguf` features

## Relationship To MIRA Mobile

- `app/mobile` is the new private mobile product
- `app/mobile-helper` is the companion capture client
- both apps should feel visually consistent
- transaction entry and edit should follow the same interaction order and form language

This means users can move between helper and full mobile without relearning the transaction form.

## Stack

- Vue 3
- TypeScript
- Pinia
- Vue Router
- vue-i18n
- Capacitor Android
- `@capacitor-community/sqlite`

## Main Flow

1. Open the helper.
2. Complete initial setup.
3. Pair with desktop using QR or pairing payload.
4. Download master data from desktop.
5. Capture transactions locally.
6. Push pending transactions to desktop over the local experimental sync flow.

## Sync Notes

- Sync is experimental.
- The contract remains `v1`.
- The contract is private.
- Desktop remains the authority for helper master data.
- Accepted helper transactions are removed from the local pending queue.

The helper must remain compatible with desktop even while desktop evolves to support the fuller sync behavior required by `app/mobile`.

## Development

Most helper work can be developed with Node.js alone:

```bash
npm install
npm test
npm run build
```

For Capacitor workflow:

```bash
npm run android:sync
```

## Android Studio

Android Studio is mainly needed for native Android tasks:

- opening the generated native project
- emulator and device debugging
- Gradle and SDK management
- APK or AAB generation

For normal Vue and TypeScript work, Node.js is enough most of the time.

## UX Direction

The helper now tracks the look and feel of `app/mobile`:

- same top bar and bottom navigation language
- same card system
- same button hierarchy
- same overall tone for transaction entry

That consistency is intentional and should be preserved when helper screens are updated.

## License

`app/mobile-helper` is GPLv3-or-later.
