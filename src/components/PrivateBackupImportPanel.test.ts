import { describe, expect, it } from "vitest";
import { isPrivateBackupImportPanelVisible } from "./PrivateBackupImportPanel";

describe("PrivateBackupImportPanel helpers", () => {
  it("bleibt nur bei aktiviertem Feature sichtbar", () => {
    expect(isPrivateBackupImportPanelVisible(true)).toBe(true);
    expect(isPrivateBackupImportPanelVisible(false)).toBe(false);
  });
});
