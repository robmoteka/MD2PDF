# Plan implementacji: wybór formatu i orientacji strony przy eksporcie PDF

## Przegląd

Dodanie możliwości wyboru wielkości (A4, A3) i orientacji (pionowa, pozioma) strony przed eksportem do PDF.

**Kluczowe wymaganie:** treść nie jest skalowana — silnik layoutu CSS naturalnie reflowuje ją do szerokości/wysokości danej strony (A3 poziomo = więcej treści w wierszu, nie powiększone litery).

## Aktualny stan

- `types.ts`: `PdfOptions` już istnieje (`pageSize: 'A4' | 'A3' | 'Letter'`, `landscape: boolean`) — brak zmian tu potrzebny
- `pdf-export.ts`: hardcoduje A4, nie przyjmuje `PdfOptions`
- `ipc-handlers.ts`: `pdf:export` i `pdf:export-all` nie przekazują opcji
- `preload.ts`: API nie eksponuje `PdfOptions` w sygnaturach
- `renderer.ts`: brak UI do wyboru formatu
- `index.html`: brak dialogu ustawień PDF
- `pdf.css`: brak reguły `@page` (potrzebna dla poprawnego reflowu)

## Decyzje architektoniczne

- **Brak skalowania**: używamy CSS `@page { size: A4 portrait }` wstrzykniętego w `<head>` generowanego HTML + odpowiadającego `pageSize`/`landscape` w `printToPDF`. Żadnego `zoom`, `transform: scale()`.
- **Dialog HTML natywny**: używamy `<dialog>` (element HTML5) — spójny z istniejącym stylem aplikacji.
- **`PdfOptions` w każdym IPC call**: `pdf:export` i `pdf:export-all` przyjmują `PdfOptions` jako dodatkowy argument.
- **`ExportAllItem` bez `PdfOptions`**: opcje strony są globalne dla całego eksportu (jeden dialog przed eksportem wszystkich).

## Graf zależności

```
types.ts (PdfOptions — już OK)
    │
    ├── pdf-export.ts (przyjmuje PdfOptions)
    │       │
    │       └── ipc-handlers.ts (przekazuje PdfOptions do exportPdf)
    │               │
    │               └── preload.ts (eksponuje nowe sygnatury)
    │                       │
    │                       └── renderer.ts (dialog + przekazanie opcji)
    │                               │
    │                               └── index.html (HTML dialogu)
    │
    └── pdf.css (@page rule — niezbędna dla reflowu)
```

## Lista zadań

### Faza 1: Backend PDF

- [ ] Zadanie 1: Zaktualizuj `pdf-export.ts` — przyjmij `PdfOptions`, emituj `@page`

### Faza 2: Warstwa IPC

- [ ] Zadanie 2: Zaktualizuj `ipc-handlers.ts` i `preload.ts`

### Checkpoint 1: Backend + IPC

- [ ] Kompilacja TypeScript bez błędów: `npm run build`
- [ ] Brak regresji w logice eksportu

### Faza 3: UI

- [ ] Zadanie 3: Dodaj dialog ustawień PDF do `index.html` + style
- [ ] Zadanie 4: Podłącz dialog w `renderer.ts`

### Checkpoint 2: Pełny end-to-end

- [ ] Aplikacja buduje się i uruchamia
- [ ] Eksport pojedynczego pliku: dialog pojawia się, wszystkie 4 kombinacje (A4/A3 × pionowa/pozioma) generują poprawny PDF
- [ ] Eksport wszystkich: dialog pojawia się raz, wszystkie pliki eksportowane z wybranymi opcjami
- [ ] Treść nie jest skalowana — na A3 poziomej tekst reflowuje szerzej, nie jest powiększony

## Ryzyka i mitygacje

| Ryzyko | Wpływ | Mitygacja |
|--------|-------|-----------|
| Electron `printToPDF` i CSS `@page` mogą się kłócić | Wysoki | CSS `@page` ma pierwszeństwo; ustawiamy identyczne wartości w obu miejscach |
| `pdf:export-all` różne opcje dla każdego pliku | Niski | Jeden wspólny dialog przed całym eksportem — ta sama opcja dla wszystkich plików (MVP) |

## Otwarte pytania

- Czy eksport CLI (`src/cli/cli.ts`) też powinien obsługiwać format/orientację? (brak CLI w zakresie tej iteracji)

---

## Szczegóły zadań

### Zadanie 1: `pdf-export.ts` — przyjmij `PdfOptions`, wstrzyknij `@page`

**Opis:** Zmienić sygnaturę `exportPdf` tak, by przyjmowała `PdfOptions`. Wstrzyknąć do generowanego HTML regułę `@page { size: <format> <orientacja>; }`, która nakazuje silnikowi CSS reflow treści do wymiarów strony bez skalowania. Przekazać `pageSize` i `landscape` do `printToPDF`.

**Kryteria akceptacji:**
- [ ] `exportPdf(html, css, outputPath, options: PdfOptions)` — czwarty parametr wymagany
- [ ] Generowany HTML zawiera `<style>@page { size: A4 portrait; margin: 1cm; }</style>` (lub A3/landscape zgodnie z opcją) przed `${css}`
- [ ] `printToPDF` wywołuje `{ pageSize: 'A4'|'A3', landscape: true|false, printBackground: true, margins: ... }`
- [ ] `margins` w `printToPDF` ustawione na 0 (marginesy kontroluje `@page` w CSS)

**Weryfikacja:**
- [ ] Kompilacja: `npx tsc -p tsconfig.main.json --noEmit`

**Zależności:** Brak

**Pliki:**
- [src/main/pdf-export.ts](src/main/pdf-export.ts)

**Rozmiar:** S (1 plik)

---

### Zadanie 2: IPC bridge — `ipc-handlers.ts` + `preload.ts`

**Opis:** Zaktualizować handlery IPC i preload, by `PdfOptions` był przekazywany od renderera do procesu głównego. `pdf:export` i `pdf:export-all` przyjmują `PdfOptions` jako dodatkowy argument.

**Kryteria akceptacji:**
- [ ] `ipcMain.handle('pdf:export', (_e, html, css, options: PdfOptions))` — `options` przekazane do `exportPdf`
- [ ] `ipcMain.handle('pdf:export-all', (_e, items, options: PdfOptions))` — `options` przekazane do każdego wywołania `exportPdf`
- [ ] W `preload.ts`: `exportPdf(html, css, options)` i `exportAllPdf(items, options)` — zaktualizowane sygnatury

**Weryfikacja:**
- [ ] Kompilacja: `npx tsc -p tsconfig.main.json --noEmit && npx tsc -p tsconfig.json --noEmit`

**Zależności:** Zadanie 1

**Pliki:**
- [src/main/ipc-handlers.ts](src/main/ipc-handlers.ts)
- [src/preload/preload.ts](src/preload/preload.ts)

**Rozmiar:** S (2 pliki, małe zmiany)

---

### Zadanie 3: Dialog ustawień PDF — HTML + style

**Opis:** Dodać `<dialog id="pdf-settings-dialog">` do `index.html` z wyborem formatu (A4/A3) i orientacji (pionowa/pozioma). Dodać style do `app.css` — wygląd zgodny z istniejącym designem aplikacji.

**Kryteria akceptacji:**
- [ ] Dialog zawiera dwie grupy radio: format (A4 / A3) i orientacja (pionowa / pozioma)
- [ ] Przyciski: „Eksportuj" (potwierdź) i „Anuluj"
- [ ] Domyślne zaznaczenie: A4 + pionowa
- [ ] Styl dialogu spójny z resztą UI (CSS variablen `--bg`, `--text`, `--border`, `--accent`)

**Weryfikacja:**
- [ ] Sprawdzenie wizualne w uruchomionej aplikacji

**Zależności:** Brak (niezależne od zadań 1-2)

**Pliki:**
- [src/renderer/index.html](src/renderer/index.html)
- [assets/styles/app.css](assets/styles/app.css)

**Rozmiar:** S (2 pliki)

---

### Zadanie 4: Podłącz dialog w `renderer.ts`

**Opis:** Dodać funkcję `showPdfSettingsDialog(): Promise<PdfOptions | null>` w `renderer.ts`. Wywołać ją przed `actionExportPdf` i `actionExportAll`. Przekazać zwrócone opcje do `window.api.exportPdf` / `window.api.exportAllPdf`. Zaktualizować też `global.d.ts` z nowymi sygnaturami API.

**Kryteria akceptacji:**
- [ ] Dialog otwiera się po kliknięciu „Eksportuj PDF" lub „Eksportuj wszystkie"
- [ ] Wybrany format i orientacja są przekazywane do IPC
- [ ] Anulowanie dialogu anuluje eksport (status „Anulowano eksport PDF")
- [ ] `global.d.ts` odzwierciedla zaktualizowane sygnatury `exportPdf` i `exportAllPdf`

**Weryfikacja:**
- [ ] Test ręczny: eksport A4 pionowa, A4 pozioma, A3 pionowa, A3 pozioma — każdy generuje poprawny PDF
- [ ] Kompilacja: `npm run build`

**Zależności:** Zadanie 2, Zadanie 3

**Pliki:**
- [src/renderer/renderer.ts](src/renderer/renderer.ts)
- [src/renderer/global.d.ts](src/renderer/global.d.ts)

**Rozmiar:** S (2 pliki)
