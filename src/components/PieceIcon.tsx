import type { ReactElement } from "react";
import type { Color, PieceType } from "../engine/types";

/**
 * Hand-drawn piece artwork, shipped inline so the game needs no image files or fonts.
 * Each piece is a set of shapes in a 45 by 45 box. White pieces use light fill and dark outline,
 * black pieces the reverse.
 */
const SHAPES: Record<PieceType, readonly string[]> = {
  p: ["M22.5 9a4.5 4.5 0 1 1 0 9a4.5 4.5 0 1 1 0-9z", "M17 21 Q22.5 27 28 21 L31 34 H14 Z", "M11 35 H34 V40 H11 Z"],
  r: [
    "M12 11 H17 V15 H21 V11 H24 V15 H28 V11 H33 V18 H12 Z",
    "M15 18 H30 L28 34 H17 Z",
    "M11 34 H34 V40 H11 Z",
  ],
  n: [
    "M14 35 V28 C14 21 19 18 20 12 L23 8 L28 9 L31 15 C34 19 33 28 33 35 Z",
    "M18 13 L17 15 M22 12 L24 13",
  ],
  b: [
    "M22.5 7 C26 10 27 13 22.5 16 C18 13 19 10 22.5 7 Z",
    "M16 34 C17 26 19 21 22.5 17 C26 21 28 26 29 34 Z",
    "M11 34 H34 V40 H11 Z",
  ],
  q: [
    "M9 16 L13 33 H32 L36 16 L28 24 L22.5 12 L17 24 Z",
    "M11 35 H34 V40 H11 Z",
    "M9 14 a2.2 2.2 0 1 1 0.1 0 M18 10 a2.2 2.2 0 1 1 0.1 0 M27 10 a2.2 2.2 0 1 1 0.1 0 M36 14 a2.2 2.2 0 1 1 0.1 0",
  ],
  k: [
    "M22.5 4 V13 M19 8 H26",
    "M16 33 L19 17 H26 L29 33 Z",
    "M11 35 H34 V40 H11 Z",
  ],
};

interface PieceIconProps {
  readonly color: Color;
  readonly type: PieceType;
}

export const PieceIcon = ({ color, type }: PieceIconProps): ReactElement => {
  const fill = color === "white" ? "#fbfbf6" : "#262626";
  const stroke = color === "white" ? "#1d1d1d" : "#f4f4ee";
  return (
    <svg className="piece" viewBox="0 0 45 45" aria-hidden="true" focusable="false">
      {SHAPES[type].map((path) => (
        <path key={path} d={path} fill={fill} stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  );
};

/** Human-readable name used for square labels, so screen readers announce pieces. */
export const PIECE_NAMES: Record<PieceType, string> = {
  p: "pawn",
  n: "knight",
  b: "bishop",
  r: "rook",
  q: "queen",
  k: "king",
};
