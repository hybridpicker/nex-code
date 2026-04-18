const {
  scanDiffText,
  scanFileNames,
  isSafeExampleFile,
} = require("../scripts/secret-scan");

describe("secret-scan", () => {
  test("detects server IP assignments in added lines", () => {
    const violations = scanDiffText('+SERVER_IP="203.0.113.10"\n', []);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "Server IP Assignment" }),
      ]),
    );
  });

  test("detects SSH config hostnames in added lines", () => {
    const violations = scanDiffText("+HostName 10.0.0.12\n", []);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "SSH Config HostName" }),
      ]),
    );
  });

  test("detects sensitive env files", () => {
    const violations = scanFileNames([".env.production"], []);
    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "Sensitive Env File" }),
      ]),
    );
  });

  test("allows .env example files", () => {
    expect(isSafeExampleFile(".env.example")).toBe(true);
    expect(isSafeExampleFile(".env.production.example")).toBe(true);
    expect(scanFileNames([".env.example", ".env.production.example"], [])).toHaveLength(0);
  });

  test("allows allowlisted matches", () => {
    const violations = scanDiffText(
      '+DATABASE_URL="postgres://user:pass@10.0.0.8:5432/app"\n',
      ["postgres://user:pass@10.0.0.8:5432/app"],
    );
    expect(violations).toHaveLength(0);
  });

  test("ignores secret-like fixtures inside test files", () => {
    const diff = [
      "diff --git a/tests/example.test.js b/tests/example.test.js",
      "index 123..456 100644",
      "--- a/tests/example.test.js",
      "+++ b/tests/example.test.js",
      '+const url = "https://admin:secret123@example.com/internal";',
    ].join("\n");
    expect(scanDiffText(diff, [])).toHaveLength(0);
  });
});
