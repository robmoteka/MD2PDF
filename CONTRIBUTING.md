# Contributing to MD2PDF

Ten dokument opisuje zasady pracy z repozytorium: nazewnictwo branchy, format commitów i przebieg Pull Request-ów.

## Branche

Gałąź `main` jest gałęzią chronioną (produkcyjną). Cały rozwój odbywa się na branchach tematycznych mergowanych przez Pull Request.

Konwencja nazewnictwa:

```
<typ>/<krótki-opis-z-myślnikami>
```

Typy:

- `feat/` — nowa funkcjonalność (np. `feat/laneflow-dark-theme`)
- `fix/` — poprawka błędu (np. `fix/pdf-margin-overflow`)
- `docs/` — wyłącznie zmiany w dokumentacji
- `refactor/` — zmiany w kodzie bez wpływu na zachowanie
- `chore/` — utrzymanie repo, zależności, build
- `test/` — dodanie lub poprawa testów

Branche tworzone automatycznie przez Claude Code (`claude/...`) są dopuszczalne — po zmergowaniu PR-u należy je usunąć.

## Commity — Conventional Commits

Każdy commit powinien być zgodny z [Conventional Commits](https://www.conventionalcommits.org/):

```
<typ>(<zakres opcjonalny>): <krótki opis w trybie rozkazującym>

[opcjonalne ciało wyjaśniające "dlaczego"]

[opcjonalne stopki, np. BREAKING CHANGE, Refs #123]
```

Dozwolone typy: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Przykłady:

```
feat(cli): add --theme flag for LaneFlow rendering
fix(preview): prevent flicker when toggling dark mode
docs: update installation steps for Linux ARM
chore(deps): bump electron to 32.1.0
```

Zasady:

- Krótki opis: do ~72 znaków, mała litera na początku, bez kropki na końcu.
- Język opisu: angielski (preferowany dla spójności z ekosystemem) lub polski — wybierz jeden i trzymaj się go w obrębie PR-u.
- Jeden commit = jedna logiczna zmiana. Unikaj commitów typu „misc fixes”.

## Pull Requesty

1. Utwórz branch z aktualnego `main`:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/nazwa-funkcji
   ```
2. Wprowadź zmiany, commituj zgodnie z Conventional Commits.
3. Wypchnij branch i otwórz PR do `main`.
4. Tytuł PR-a w formacie Conventional Commit (np. `feat(cli): add --theme flag`).
5. Opis PR-a powinien zawierać:
   - **Summary** — co i po co
   - **Key Changes** — lista kluczowych zmian
   - **Test plan** — jak zweryfikowano działanie
6. Po zmergowaniu — **usuń branch** (lokalnie i na zdalnym).

## Przed wypchnięciem zmian

Lokalnie uruchom:

```bash
npm run lint
npm test
npm run build
```

PR nie powinien być mergowany dopóki CI nie przejdzie zielono.

## Submoduły

Repo używa submodułu `vendor/laneflow`. Po `git pull` z migracją submodułu wykonaj:

```bash
git submodule update --init --recursive
```
