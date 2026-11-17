import { describe, expect, it } from "vitest";
import { issueRefresh, revokeRefresh, rotateStoredRefresh } from "./refresh-store.js";

describe("refresh revocation", () => {
  it("lets a live refresh token rotate", () => {
    const token = issueRefresh("user-1");
    expect(rotateStoredRefresh(token)?.userId).toBe("user-1");
  });

  it("rejects a refresh token after logout revokes it", () => {
    const token = issueRefresh("user-2");
    revokeRefresh(token);
    expect(rotateStoredRefresh(token)).toBeNull();
  });
});
