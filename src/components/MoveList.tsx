import type { ReactElement } from "react";
import type { MoveRecord } from "../game/gameState";

interface MoveListProps {
  readonly moves: readonly MoveRecord[];
  /** Number of half-moves currently shown on the board. */
  readonly viewPly: number;
  readonly onNavigate: (ply: number) => void;
}

/** Shows moves as numbered pairs. Clicking a move shows the position after it. */
export const MoveList = ({ moves, viewPly, onNavigate }: MoveListProps): ReactElement => {
  const rows: { number: number; white: MoveRecord | undefined; black: MoveRecord | undefined }[] = [];
  for (let index = 0; index < moves.length; index += 2) {
    rows.push({ number: index / 2 + 1, white: moves[index], black: moves[index + 1] });
  }
  return (
    <ol className="move-list" aria-label="Moves">
      {rows.map((row) => (
        <li key={row.number} className="move-row">
          <span className="move-number">{row.number}.</span>
          <MoveCell record={row.white} ply={(row.number - 1) * 2 + 1} viewPly={viewPly} onNavigate={onNavigate} />
          <MoveCell record={row.black} ply={(row.number - 1) * 2 + 2} viewPly={viewPly} onNavigate={onNavigate} />
        </li>
      ))}
    </ol>
  );
};

interface MoveCellProps {
  readonly record: MoveRecord | undefined;
  readonly ply: number;
  readonly viewPly: number;
  readonly onNavigate: (ply: number) => void;
}

const MoveCell = ({ record, ply, viewPly, onNavigate }: MoveCellProps): ReactElement => {
  if (record === undefined) {
    return <span className="move-cell move-empty" />;
  }
  return (
    <button
      type="button"
      className={viewPly === ply ? "move-cell move-current" : "move-cell"}
      aria-current={viewPly === ply ? "step" : undefined}
      onClick={() => onNavigate(ply)}
    >
      {record.san}
    </button>
  );
};
