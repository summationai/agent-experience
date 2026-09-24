import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index";

describe("@axe/express", () => {
  it("exports its package name", () => {
    expect(PACKAGE_NAME).toBe("@axe/express");
  });
});
