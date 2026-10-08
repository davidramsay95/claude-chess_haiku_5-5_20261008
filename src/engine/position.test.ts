import { describe, expect, it } from "vitest";
import { parseFen, toFen } from "./position";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("FEN parsing", () => {
  it("round-trips the start position", () => {
    const result = parseFen(START_FEN);
    expect(result.ok && toFen(result.value)).toBe(START_FEN);
  });

  it("rejects a placement with the wrong number of ranks", () => {
    expect(parseFen("8/8/8/8/8/8/8 w - - 0 1").ok).toBe(false);
  });

  it("rejects a rank that does not sum to eight squares", () => {
    expect(parseFen("9/8/8/8/8/8/8/8 w - - 0 1").ok).toBe(false);
  });

  it("rejects a position without exactly one king per side", () => {
    expect(parseFen("8/8/8/8/8/8/8/K7 w - - 0 1").ok).toBe(false);
  });

  it("rejects pawns on the first or last rank", () => {
    expect(parseFen("P3k3/8/8/8/8/8/8/4K3 w - - 0 1").ok).toBe(false);
  });

  it("rejects castling rights without the king and rook on their home squares", () => {
    expect(parseFen("4k3/8/8/8/8/8/8/R3K3 w K - 0 1").ok).toBe(false);
  });

  it("rejects an en passant square that no pawn could have created", () => {
    expect(parseFen("4k3/8/8/8/8/8/8/4K3 w - e3 0 1").ok).toBe(false);
  });

  it("rejects a position where the side not to move is in check", () => {
    expect(parseFen("4k3/8/8/8/8/8/8/r3K3 b - - 0 1").ok).toBe(false);
  });
});
