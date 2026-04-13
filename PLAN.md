# MD2PDF — Plan aplikacji

## Cel

Desktopowa aplikacja dla Linuxa do edycji plików Markdown z podglądem na żywo, poprawnym renderowaniem diagramów Mermaid i eksportem do PDF.

## Stack technologiczny

- **Electron** — powłoka desktopowa (Chromium + Node.js)
- **TypeScript** — język główny
- **Plain HTML/CSS/DOM** — UI bez frameworków (bez React/Vue)
- **markdown-it** — parser Markdown
- **mermaid.js** — renderowanie diagramów Mermaid do SVG
- **Puppeteer / Electron printToPDF** — eksport HTML → PDF
- **CodeMirror 6** — edytor tekstu z podświetlaniem składni
- **electron-builder** — pakowanie AppImage dla Linuxa

## Kroki implementacji

### 1. Szkielet projektu
- Inicjalizacja `package.json`, TypeScript, Electron
- Konfiguracja procesu głównego (main) i renderera
- Preload script z bezpiecznym IPC

### 2. Podstawowa struktura
- Okno główne z menu (Plik → Otwórz / Zapisz / Eksport PDF)
- Dialogi otwierania i zapisywania plików `.md`
- Stan aktywnego dokumentu (ścieżka, tytuł, zmiany)

### 3. Edytor i podgląd Markdown
- Split-view: edytor CodeMirror po lewej, podgląd HTML po prawej
- Odświeżanie podglądu na żywo przy każdej zmianie tekstu
- Synchronizacja przewijania między edytorem a podglądem

### 4. Pipeline Mermaid
- Wykrywanie bloków ` ```mermaid ` w Markdown
- Renderowanie do SVG przez mermaid.js w podglądzie
- Ten sam pipeline używany przy eksporcie PDF

### 5. Eksport PDF
- Generowanie pełnego HTML z osadzonym CSS i wyrenderowanymi diagramami
- Eksport przez `BrowserWindow.webContents.printToPDF()` lub Puppeteer
- Ustawienia: format strony (A4), marginesy, orientacja, nazwa pliku

### 6. Style i motywy CSS
- Wspólny CSS dla podglądu i PDF (typografia, kod, tabele, cytaty, obrazy)
- Dedykowane style dla diagramów Mermaid
- Możliwość przełączania motywów (jasny/ciemny)

### 7. Obsługa błędów
- Komunikaty o błędach składni Mermaid
- Ostrzeżenie przed zamknięciem z niezapisanymi zmianami
- Informacja o problemach z eksportem PDF

### 8. Pakowanie AppImage
- Konfiguracja `electron-builder` dla Linuxa
- AppImage jako domyślny format dystrybucji
- Ikona i metadane aplikacji

### 9. Testy i weryfikacja
- Dokumenty testowe z tabelami, kodem, listami i diagramami Mermaid
- Porównanie podglądu z wynikowym PDF
- Sprawdzenie AppImage na czystym środowisku Linux

## Poza zakresem (na teraz)

- Synchronizacja chmurowa
- Współpraca wielu użytkowników
- System pluginów
- Obsługa Windows/macOS (tylko Linux)
