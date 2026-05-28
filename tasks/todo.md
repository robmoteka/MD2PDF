# Lista zadań: wybór formatu i orientacji PDF

## Faza 1: Backend PDF
- [x] Zadanie 1: `pdf-export.ts` — przyjmij `PdfOptions`, wstrzyknij `@page` CSS, przekaż do `printToPDF`

## Faza 2: IPC bridge
- [x] Zadanie 2: `ipc-handlers.ts` + `preload.ts` — dodaj `PdfOptions` do `pdf:export` i `pdf:export-all`

## Checkpoint 1
- [x] `npx tsc -p tsconfig.main.json --noEmit` — brak błędów

## Faza 3: UI
- [x] Zadanie 3: `index.html` + `app.css` — dialog wyboru formatu/orientacji PDF
- [x] Zadanie 4: `renderer.ts` + `global.d.ts` — podłącz dialog, przekaż opcje do IPC

## Checkpoint 2 (end-to-end)
- [x] `npm run build` — sukces
- [ ] Eksport PDF z każdą z 4 kombinacji (A4/A3 × pionowa/pozioma) — weryfikacja ręczna
- [ ] Treść nie jest skalowana, reflowuje naturalnie do szerokości strony
