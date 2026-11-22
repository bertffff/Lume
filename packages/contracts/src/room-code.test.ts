import { describe, expect, it } from "vitest";
import { formatRoomCode, parseRoomCode, ROOM_CODE_ALPHABET } from "./room-code.js";

describe("ROOM_CODE_ALPHABET", () => {
  it("matches the existing unambiguous invite-code alphabet", () => {
    expect(ROOM_CODE_ALPHABET).toBe("abcdefghjkmnpqrstuvwxyz23456789");
  });

  it("excludes ambiguous glyphs that are easy to confuse when typed", () => {
    for (const ambiguous of ["i", "l", "o", "0", "1"]) {
      expect(ROOM_CODE_ALPHABET).not.toContain(ambiguous);
    }
  });
});

describe("parseRoomCode", () => {
  it("accepts a canonical six-character lowercase code unchanged", () => {
    expect(parseRoomCode("7kq2mx")).toBe("7kq2mx");
    expect(parseRoomCode("abcd23")).toBe("abcd23");
  });

  it("normalizes uppercase input to canonical lowercase", () => {
    expect(parseRoomCode("7KQ2MX")).toBe("7kq2mx");
    expect(parseRoomCode("AbCd23")).toBe("abcd23");
  });

  it("accepts optional exactly 3-3 grouping", () => {
    expect(parseRoomCode("7kq-2mx")).toBe("7kq2mx");
    expect(parseRoomCode("7KQ-2MX")).toBe("7kq2mx");
    expect(parseRoomCode("abc-d23")).toBe("abcd23");
  });

  it("trims spaces at the edges", () => {
    expect(parseRoomCode(" 7KQ-2MX ")).toBe("7kq2mx");
    expect(parseRoomCode("  7kq2mx  ")).toBe("7kq2mx");
  });

  it("rejects ambiguous glyphs", () => {
    expect(parseRoomCode("7kq2m0")).toBeNull();
    expect(parseRoomCode("7kq2m1")).toBeNull();
    expect(parseRoomCode("7kq2mI")).toBeNull();
    expect(parseRoomCode("7kq2mL")).toBeNull();
    expect(parseRoomCode("7kq2mO")).toBeNull();
    expect(parseRoomCode("7KQ2M0")).toBeNull();
  });

  it("rejects wrong-length inputs of five, seven and eight characters", () => {
    expect(parseRoomCode("7kq2m")).toBeNull();
    expect(parseRoomCode("7kq2mx2")).toBeNull();
    expect(parseRoomCode("7kq2mx23")).toBeNull();
  });

  it("rejects malformed grouping", () => {
    expect(parseRoomCode("7k-q2mx")).toBeNull();
    expect(parseRoomCode("7kq2m-x")).toBeNull();
    expect(parseRoomCode("7-kq2mx")).toBeNull();
    expect(parseRoomCode("7kq--2mx")).toBeNull();
    expect(parseRoomCode("7kq-2mx-")).toBeNull();
    expect(parseRoomCode("7kq 2mx")).toBeNull();
  });

  it("does not allow punctuation other than the single 3-3 hyphen", () => {
    expect(parseRoomCode("7kq_2mx")).toBeNull();
    expect(parseRoomCode("7kq.2mx")).toBeNull();
  });
});

describe("formatRoomCode", () => {
  it("formats a canonical code as uppercase 3-3 display text", () => {
    expect(formatRoomCode("7kq2mx")).toBe("7KQ-2MX");
    expect(formatRoomCode("abcd23")).toBe("ABC-D23");
  });

  it("round-trips a parsed invite back to its canonical display form", () => {
    expect(formatRoomCode(parseRoomCode(" 7KQ-2MX ") as string)).toBe("7KQ-2MX");
  });
});
