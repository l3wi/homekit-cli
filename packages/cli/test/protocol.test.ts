import { describe, expect, it } from "vitest";

import { encodeRequest, protocolMajorMatches } from "../src/protocol.js";

describe("protocol helpers", () => {
  it("matches only major protocol versions", () => {
    expect(protocolMajorMatches("1.0.0", "1.2.3")).toBe(true);
    expect(protocolMajorMatches("1.0.0", "2.0.0")).toBe(false);
  });

  it("encodes newline-delimited JSON requests", () => {
    expect(encodeRequest({ id: "1", method: "status" })).toBe(
      '{"id":"1","method":"status"}\n',
    );
  });
});
