# Chess (haiku_5-5_20261008)

A playable chess game against a self-written engine. Everything runs in the browser. No chess library, no external images or fonts.

## Stack

- **Vite + React + TypeScript** (strict mode). Vite gives a static build with the sub-path handling the site needs. React keeps the board and move list simple to update.
- **Vitest** for unit tests. Engine tests use the standard perft counts.
- No other runtime dependencies. Piece artwork is inline SVG in `src/components/PieceIcon.tsx`.

## Run it

```sh
npm ci
npm run dev        # local dev server
npm test           # unit tests (vitest run)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck, then production build into dist/
```

The site builds with `npm run build -- --base=/play/haiku_5-5_20261008/`.

## Engine

Source: `src/engine/`.

- `position.ts` holds the position type, FEN parsing with validation, and `makeMove` (copy-make).
- `attacks.ts` has precomputed knight, king, pawn and ray tables and the attack test.
- `moveGen.ts` generates pseudo-legal moves, then filters to legal ones. Castling checks the king's start square, the crossed square and the landing square. Castling rights are removed when a king or rook moves or is captured on its home square.
- `rules.ts` covers checkmate, stalemate, fifty-move rule, threefold repetition and insufficient material. Repetition keys include the en passant square only when a capture is legal.
- `search.ts` is negamax with alpha-beta, MVV-LVA move ordering, quiescence search over captures and promotions, and a material plus simple positional evaluation. It uses iterative deepening with a time budget and returns the best move from the last completed depth.
- `engine.worker.ts` runs the search in a Web Worker, so the interface stays responsive.

Difficulty levels (`SEARCH_LEVELS` in `search.ts`):

| Level  | Search | Time budget | Notes |
|--------|--------|-------------|-------|
| easy   | depth 1, no quiescence | 0.3 s | adds random noise of up to 2.5 pawns, so it blunders |
| medium | depth 2 with quiescence | 1 s | |
| hard   | up to depth 4 with quiescence | 2.5 s | |
| expert | up to depth 12 with quiescence | 4 s | searches as deep as the budget allows |

Hard and expert depths depend on the speed of the machine. Each reply finishes within 4 s plus the time to return the move.

## Game state and save bridge

- **Export game** downloads the state as `chess-game-YYYY-MM-DD.json`. The shape is the one in `game_state.json` at the repository root.
- **Import game** accepts a `.json` file or pasted JSON. It validates the whole state and replays every move through the rules engine. An invalid state leaves the current game unchanged and shows the reason.
- **Bridge.** `src/bridge/bridge.ts` implements `docs/save-bridge-protocol.md`. The game sends `ready` on load and answers `ping`, `request-state` and `load-state`. It accepts a message only when the origin matches `window.location.origin` and the sender is `window.parent`. Import from the interface and from the bridge share `src/game/importGame.ts`.

## Defaults and decisions

- Threefold repetition and the fifty-move rule end the game automatically. They are not claimed.
- Promotion asks for the piece with a small picker. Cancel keeps the pawn selected.
- You can step back through the moves with First, Previous, Next and Last, or click a move. To change the game from an earlier position, press "Play from this position". That discards the later moves.
- Playing as black makes the engine move first.
- The board is flipped when you play black.
- No sounds. No draw offers or undo.

## Known limitations

- The engine has no transposition table, opening book or endgame tables. Strength is modest at every level, and hard and expert differ mainly by search depth.
- The search does not detect threefold repetition, so it can walk into a repeated position that the game then declares drawn. It does treat insufficient material and the fifty-move rule as draws.
- Draws by agreement and undo are not implemented.
- Only the rules listed above are implemented.
- The bridge state is the documented five-field object. Extra fields in an imported file are dropped.
