import { useEffect, useMemo, useReducer, useRef, useState, type ReactElement } from "react";
import { Board, type BoardHighlights } from "./components/Board";
import { ImportPanel } from "./components/ImportPanel";
import { MoveList } from "./components/MoveList";
import { SetupPanel } from "./components/SetupPanel";
import { PIECE_NAMES } from "./components/PieceIcon";
import { useGameBridge } from "./bridge/useGameBridge";
import { requestEngineMove } from "./engine/engineClient";
import { findKing, isInCheck } from "./engine/attacks";
import { generateLegalMoves, moveToUci } from "./engine/moveGen";
import type { Position } from "./engine/position";
import { toFen } from "./engine/position";
import { gameReducer, initialAppState } from "./game/gameReducer";
import { currentPosition, resultOf, type GameOutcome, type GameSession } from "./game/gameState";
import { importGameText, importGameValue } from "./game/importGame";
import { saveFileName, serializeGameState } from "./game/saveFile";
import { squareIndex, squareName, type PieceType, type Result } from "./engine/types";

const DRAW_TEXT: Record<string, string> = {
  stalemate: "stalemate",
  "fifty-move": "the fifty-move rule",
  "threefold-repetition": "threefold repetition",
  "insufficient-material": "insufficient material",
};

const describeOutcome = (outcome: GameOutcome, playerColor: "white" | "black"): string => {
  if (outcome.kind === "ongoing") {
    return "";
  }
  if (outcome.kind === "draw") {
    return `Draw by ${DRAW_TEXT[outcome.reason] ?? outcome.reason}.`;
  }
  const winner = outcome.winner === playerColor ? "You win" : "The engine wins";
  if (outcome.kind === "resigned") {
    return `${outcome.winner === playerColor ? "The engine resigned" : "You resigned"}. ${winner}.`;
  }
  return `Checkmate. ${winner}.`;
};

const lastMoveSquares = (session: GameSession, viewPly: number): readonly [number, number] | null => {
  const record = session.state.moves[viewPly - 1];
  if (viewPly === 0 || record === undefined) {
    return null;
  }
  const from = squareIndex(record.slice(0, 2));
  const to = squareIndex(record.slice(2, 4));
  return from === null || to === null ? null : [from, to];
};

const kingInCheckSquare = (position: Position): number | null =>
  isInCheck(position.board, position.sideToMove) ? findKing(position.board, position.sideToMove) : null;

const downloadState = (session: GameSession): void => {
  const blob = new Blob([serializeGameState(session.state)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = saveFileName(new Date());
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const describeError = (error: unknown): string => (error instanceof Error ? error.message : "unknown error");

export const App = (): ReactElement => {
  const [state, dispatch] = useReducer(gameReducer, initialAppState);
  const [promotionChoice, setPromotionChoice] = useState<{ readonly from: number; readonly to: number } | null>(null);
  const [showImport, setShowImport] = useState(false);
  const pendingGenerationRef = useRef<number | null>(null);

  const session = state.session;
  const viewPosition = session === null ? null : (session.positions[state.viewPly] ?? null);
  const live = session !== null && state.viewPly === session.state.moves.length && session.outcome.kind === "ongoing";
  const humanTurn = session !== null && currentPosition(session).sideToMove === session.state.playerColor;
  const interactive = live && humanTurn && !state.thinking;

  const legalMoves = useMemo(
    () => (viewPosition === null || !interactive ? [] : generateLegalMoves(viewPosition)),
    [viewPosition, interactive],
  );

  useGameBridge(session, {
    loadSession: (loaded: GameSession): void => dispatch({ type: "load", session: loaded }),
    importValue: (value: unknown): Result<GameSession> => importGameValue(value),
  });

  useEffect(() => {
    if (session === null || session.outcome.kind !== "ongoing") {
      return;
    }
    const engineToMove = currentPosition(session).sideToMove !== session.state.playerColor;
    const showingLatest = state.viewPly === session.state.moves.length;
    if (!engineToMove || !showingLatest) {
      return;
    }
    const generation = state.generation;
    if (pendingGenerationRef.current === generation) {
      return;
    }
    pendingGenerationRef.current = generation;
    dispatch({ type: "engine-started" });
    const fen = toFen(currentPosition(session));
    const difficulty = session.state.difficulty;

    const run = async (): Promise<void> => {
      try {
        const uci = await requestEngineMove(fen, difficulty);
        if (pendingGenerationRef.current === generation) {
          pendingGenerationRef.current = null;
        }
        dispatch({ type: "engine-move", generation, uci });
      } catch (error: unknown) {
        if (pendingGenerationRef.current === generation) {
          pendingGenerationRef.current = null;
        }
        dispatch({ type: "engine-failed", generation, message: `The engine failed: ${describeError(error)}. Use Next or Last to retry.` });
      }
    };
    void run();
  }, [session, state.viewPly, state.generation]);

  const handleSquare = (square: number): void => {
    if (!interactive) {
      return;
    }
    if (state.selected !== null) {
      const candidates = legalMoves.filter((move) => move.from === state.selected && move.to === square);
      const first = candidates[0];
      if (first !== undefined && candidates.some((move) => move.promotion !== null)) {
        setPromotionChoice({ from: state.selected, to: square });
        return;
      }
      if (first !== undefined) {
        dispatch({ type: "move", uci: moveToUci(first) });
        return;
      }
    }
    const ownMovable = legalMoves.some((move) => move.from === square);
    dispatch({ type: "select", square: ownMovable && square !== state.selected ? square : null });
  };

  const handlePromotion = (piece: PieceType): void => {
    if (promotionChoice === null) {
      return;
    }
    dispatch({ type: "move", uci: `${squareName(promotionChoice.from)}${squareName(promotionChoice.to)}${piece}` });
    setPromotionChoice(null);
  };

  const importText = (text: string): void => {
    const result = importGameText(text);
    if (!result.ok) {
      dispatch({ type: "notice", message: `Import failed: ${result.error}. The current game was not changed.` });
      return;
    }
    dispatch({ type: "load", session: result.value });
    setShowImport(false);
  };

  if (session === null) {
    return (
      <main className="app">
        <header className="app-header">
          <h1>Chess</h1>
        </header>
        <SetupPanel
          color={state.setupColor}
          difficulty={state.setupDifficulty}
          onColor={(color) => dispatch({ type: "setup-color", color })}
          onDifficulty={(difficulty) => dispatch({ type: "setup-difficulty", difficulty })}
          onStart={() => dispatch({ type: "start" })}
        />
        <button type="button" className="link-button" onClick={() => setShowImport((open) => !open)}>
          {showImport ? "Hide import" : "Import a saved game"}
        </button>
        {showImport ? <ImportPanel onImportText={importText} onClose={() => setShowImport(false)} /> : null}
        {state.notice === null ? null : <p role="alert" className="notice">{state.notice}</p>}
      </main>
    );
  }

  const selectedSquare = interactive ? state.selected : null;
  const targets = selectedSquare === null ? [] : legalMoves.filter((move) => move.from === selectedSquare).map((move) => move.to);
  const highlights: BoardHighlights = {
    selected: selectedSquare,
    targets,
    lastMove: lastMoveSquares(session, state.viewPly),
    checkedKing: viewPosition === null ? null : kingInCheckSquare(viewPosition),
  };
  const lastPly = session.state.moves.length;
  const outcomeText = describeOutcome(session.outcome, session.state.playerColor);
  const statusText =
    outcomeText !== ""
      ? outcomeText
      : state.thinking
        ? "The engine is thinking"
        : humanTurn
          ? "Your move"
          : "The engine is about to move";
  const finalResult = resultOf(session.outcome);

  return (
    <main className="app">
      <header className="app-header">
        <h1>Chess</h1>
        <p className="meta">
          You play {session.state.playerColor}, {session.state.difficulty}. Result {finalResult}
        </p>
      </header>

      <div className="game-layout">
        <section className="board-area" aria-label="Game">
          <Board
            position={viewPosition ?? session.positions[0] ?? currentPosition(session)}
            orientation={session.state.playerColor}
            highlights={highlights}
            interactive={interactive}
            onSquare={handleSquare}
          />
          {promotionChoice === null ? null : (
            <div className="promotion" role="group" aria-label="Choose promotion piece">
              {(["q", "r", "b", "n"] as const).map((piece) => (
                <button key={piece} type="button" onClick={() => handlePromotion(piece)}>
                  {PIECE_NAMES[piece]}
                </button>
              ))}
              <button type="button" onClick={() => setPromotionChoice(null)}>
                Cancel
              </button>
            </div>
          )}
        </section>

        <aside className="side-panel">
          <p className="status" role="status" aria-live="polite">
            {statusText}
          </p>
          <div className="button-row" aria-label="Navigation">
            <button type="button" onClick={() => dispatch({ type: "navigate", ply: 0 })} disabled={state.viewPly === 0}>
              First
            </button>
            <button type="button" onClick={() => dispatch({ type: "navigate", ply: state.viewPly - 1 })} disabled={state.viewPly === 0}>
              Previous
            </button>
            <button type="button" onClick={() => dispatch({ type: "navigate", ply: state.viewPly + 1 })} disabled={state.viewPly >= lastPly}>
              Next
            </button>
            <button type="button" onClick={() => dispatch({ type: "navigate", ply: lastPly })} disabled={state.viewPly >= lastPly}>
              Last
            </button>
          </div>
          {state.viewPly < lastPly ? (
            <button type="button" onClick={() => dispatch({ type: "resume" })}>
              Play from this position (discards later moves)
            </button>
          ) : null}
          <MoveList moves={session.moveRecords} viewPly={state.viewPly} onNavigate={(ply) => dispatch({ type: "navigate", ply })} />
          <div className="button-row">
            <button type="button" onClick={() => dispatch({ type: "resign" })} disabled={!live || session.outcome.kind !== "ongoing"}>
              Resign
            </button>
            <button type="button" onClick={() => downloadState(session)}>
              Export game
            </button>
            <button type="button" onClick={() => setShowImport((open) => !open)}>
              Import game
            </button>
            <button type="button" onClick={() => dispatch({ type: "new-game" })}>
              New game
            </button>
          </div>
          {showImport ? <ImportPanel onImportText={importText} onClose={() => setShowImport(false)} /> : null}
          {state.notice === null ? null : <p role="alert" className="notice">{state.notice}</p>}
        </aside>
      </div>
    </main>
  );
};
