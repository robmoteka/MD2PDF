# MD2PDF — Architektura

## Procesy Electron

```
┌─────────────────────────────────────────────┐
│                Main Process                 │
│  - Okno aplikacji (BrowserWindow)           │
│  - Menu systemowe                           │
│  - Dialogi plików (open/save)               │
│  - Eksport PDF (printToPDF)                 │
│  - IPC handlers                             │
└──────────────────┬──────────────────────────┘
                   │ IPC (contextBridge)
┌──────────────────▼──────────────────────────┐
│              Renderer Process               │
│  ┌──────────────┬─────────────────────┐     │
│  │   Edytor     │   Podgląd Markdown  │     │
│  │  CodeMirror  │   markdown-it       │     │
│  │              │   + mermaid.js      │     │
│  └──────────────┴─────────────────────┘     │
└─────────────────────────────────────────────┘
```

## Struktura katalogów

```
MD2PDF/
├── package.json
├── tsconfig.json
├── electron-builder.yml          # konfiguracja AppImage
├── src/
│   ├── main/
│   │   ├── main.ts               # entry point procesu głównego
│   │   ├── menu.ts               # menu aplikacji
│   │   ├── ipc-handlers.ts       # obsługa IPC (pliki, PDF)
│   │   └── pdf-export.ts         # logika eksportu PDF
│   ├── preload/
│   │   └── preload.ts            # contextBridge API
│   ├── renderer/
│   │   ├── index.html            # główny HTML
│   │   ├── renderer.ts           # entry point renderera
│   │   ├── editor.ts             # inicjalizacja CodeMirror
│   │   ├── preview.ts            # podgląd Markdown + Mermaid
│   │   └── state.ts              # stan dokumentu
│   └── shared/
│       └── types.ts              # wspólne typy TS
├── assets/
│   ├── styles/
│   │   ├── app.css               # style aplikacji
│   │   ├── preview.css           # style podglądu MD
│   │   ├── pdf.css               # style eksportu PDF
│   │   └── themes/
│   │       ├── light.css
│   │       └── dark.css
│   └── icons/
│       └── icon.png              # ikona aplikacji
└── test-docs/
    ├── basic.md                  # test: tekst, listy, tabele
    ├── code.md                   # test: bloki kodu
    └── mermaid.md                # test: diagramy Mermaid
```

## Przepływ danych

```
Plik .md → [Otwórz] → CodeMirror (edycja)
                           │
                           ▼ (on change)
                      markdown-it
                           │
                    ┌──────┴──────┐
                    │ mermaid.js  │  (bloki ```mermaid)
                    └──────┬──────┘
                           │
                           ▼
                    Podgląd HTML (live)
                           │
                    [Eksport PDF]
                           │
                           ▼
                    printToPDF → plik .pdf
```

## IPC API (Preload → Main)

| Kanał                | Kierunek         | Opis                              |
|----------------------|------------------|-----------------------------------|
| `file:open`          | renderer → main  | Otwórz dialog i wczytaj plik      |
| `file:save`          | renderer → main  | Zapisz treść do pliku             |
| `file:save-as`       | renderer → main  | Zapisz jako nowy plik             |
| `pdf:export`         | renderer → main  | Eksportuj bieżący HTML do PDF     |
| `app:title`          | renderer → main  | Ustaw tytuł okna                  |
| `menu:action`        | main → renderer  | Przekaż akcję z menu do renderera |

## Decyzje techniczne

- **CodeMirror 6** zamiast textarea — podświetlanie składni, numeracja linii, undo/redo
- **markdown-it** zamiast marked — rozszerzalny, dobrze przetestowany
- **mermaid.js w rendererze** — renderuje diagramy po stronie Chromium, bez osobnego procesu
- **printToPDF** zamiast Puppeteer — korzysta z wbudowanego Chromium Electron, bez dodatkowej zależności
- **electron-builder** — najlepsze wsparcie dla AppImage na Linuxie
