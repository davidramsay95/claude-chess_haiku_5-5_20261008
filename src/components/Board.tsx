import type { ReactElement } from "react";
import { PieceIcon, PIECE_NAMES } from "./PieceIcon";
import { codeColor, codeType, EMPTY_CELL, squareName, type Color } from "../engine/types";
import type { Position } from "../engine/position";

export interface BoardHighlights {
  readonly selected: number | null;
  readonly targets: readonly number[];
  readonly lastMove: readonly [number, number] | null;
  readonly checkedKing: number | null;
}

interface BoardProps {
  readonly position: Position;
  readonly orientation: Color;
  readonly highlights: BoardHighlights;
  readonly interactive: boolean;
  readonly onSquare: (square: number) => void;
}

/** Renders an 8x8 board as buttons so every square is keyboard reachable and labelled. */
export const Board = ({ position, orientation, highlights, interactive, onSquare }: BoardProps): ReactElement => {
  const flipped = orientation === "black";
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const columns = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="board" role="grid" aria-label="Chess board">
      {rows.map((displayRow) => (
        <div className="board-row" role="row" key={displayRow}>
          {columns.map((displayColumn) => {
            const rank = flipped ? displayRow : 7 - displayRow;
            const file = flipped ? 7 - displayColumn : displayColumn;
            const square = rank * 8 + file;
            return renderSquare({ square, position, highlights, interactive, onSquare, displayRow, displayColumn });
          })}
        </div>
      ))}
    </div>
  );
};

interface SquareArgs {
  readonly square: number;
  readonly position: Position;
  readonly highlights: BoardHighlights;
  readonly interactive: boolean;
  readonly onSquare: (square: number) => void;
  readonly displayRow: number;
  readonly displayColumn: number;
}

const renderSquare = ({ square, position, highlights, interactive, onSquare, displayRow, displayColumn }: SquareArgs): ReactElement => {
  const cell = position.board[square] ?? EMPTY_CELL;
  const type = codeType(cell);
  const isLight = (square + Math.floor(square / 8)) % 2 === 1;
  const classes = ["square", isLight ? "square-light" : "square-dark"];
  if (highlights.selected === square) {
    classes.push("square-selected");
  }
  if (highlights.lastMove?.includes(square)) {
    classes.push("square-last");
  }
  if (highlights.checkedKing === square) {
    classes.push("square-check");
  }
  const isTarget = highlights.targets.includes(square);
  if (isTarget) {
    classes.push(cell === EMPTY_CELL ? "square-target" : "square-capture");
  }
  const pieceLabel = type === null ? "empty" : `${codeColor(cell)} ${PIECE_NAMES[type]}`;
  const label = `${squareName(square)}, ${pieceLabel}${isTarget ? ", legal destination" : ""}`;
  const showFileLabel = displayRow === 7;
  const showRankLabel = displayColumn === 0;
  return (
    <button
      type="button"
      role="gridcell"
      key={square}
      className={classes.join(" ")}
      aria-label={label}
      aria-pressed={highlights.selected === square}
      disabled={!interactive && highlights.selected !== square}
      onClick={() => onSquare(square)}
    >
      {showRankLabel ? <span className="coord coord-rank">{squareName(square).charAt(1)}</span> : null}
      {showFileLabel ? <span className="coord coord-file">{squareName(square).charAt(0)}</span> : null}
      {type === null ? null : <PieceIcon color={codeColor(cell)} type={type} />}
    </button>
  );
};
