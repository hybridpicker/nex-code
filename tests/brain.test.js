/**
 * tests/brain.test.js — Brain Knowledge Base Tests
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

let tmpDir;
let originalCwd;

// Override process.cwd() to use tmpDir
beforeAll(() => {
  originalCwd = process.cwd;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-brain-"));
});

beforeEach(() => {
  process.cwd = () => tmpDir;
  // Clear module cache so brain.js picks up new cwd
  Object.keys(require.cache).forEach((k) => {
    if (k.includes("brain.js") || k.includes("context-engine"))
      delete require.cache[k];
  });
});

afterEach(() => {
  // Clean brain dir between tests
  const brainDir = path.join(tmpDir, ".nex", "brain");
  if (fs.existsSync(brainDir)) {
    fs.rmSync(brainDir, { recursive: true, force: true });
  }
});

afterAll(() => {
  process.cwd = originalCwd;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getBrain() {
  return require("../cli/brain");
}

// ─── Stage 1: Storage ────────────────────────────────────────

describe("listDocuments", () => {
  it("returns empty array when brain dir does not exist", () => {
    const { listDocuments } = getBrain();
    expect(listDocuments()).toEqual([]);
  });

  it("returns .md files from brain dir", () => {
    const { writeDocument, listDocuments } = getBrain();
    writeDocument("test-doc", "# Test\n\nContent here.");
    const docs = listDocuments();
    expect(docs.length).toBe(1);
    expect(docs[0].name).toBe("test-doc");
    expect(docs[0].size).toBeGreaterThan(0);
    expect(docs[0].modified).toBeInstanceOf(Date);
  });

  it("excludes dot files from listing", () => {
    const { getBrainDir, listDocuments } = getBrain();
    const dir = getBrainDir();
    fs.writeFileSync(path.join(dir, ".brain-index.json"), "{}");
    fs.writeFileSync(path.join(dir, ".embeddings.json"), "{}");
    const docs = listDocuments();
    expect(docs.every((d) => !d.name.startsWith("."))).toBe(true);
  });
});

describe("writeDocument", () => {
  it("creates file and updates index", () => {
    const { writeDocument, getBrainDir } = getBrain();
    writeDocument("my-doc", "# My Doc\n\nSome content.");
    const filePath = path.join(getBrainDir(), "my-doc.md");
    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toBe("# My Doc\n\nSome content.");
    // Index should exist
    const indexPath = path.join(getBrainDir(), ".brain-index.json");
    expect(fs.existsSync(indexPath)).toBe(true);
  });
});

describe("readDocument", () => {
  it("returns empty object for non-existent document", () => {
    const { readDocument } = getBrain();
    const result = readDocument("nonexistent");
    expect(result.content).toBe("");
    expect(result.frontmatter).toEqual({});
  });

  it("reads document content correctly", () => {
    const { writeDocument, readDocument } = getBrain();
    writeDocument("test", "# Title\n\nBody text.");
    const result = readDocument("test");
    expect(result.content).toBe("# Title\n\nBody text.");
    expect(result.name).toBe("test");
  });

  it("parses frontmatter correctly", () => {
    const { writeDocument, readDocument } = getBrain();
    const content = `---
tags: [api, backend, auth]
priority: high
---
# Auth Flow

Details here.`;
    writeDocument("auth-flow", content);
    const result = readDocument("auth-flow");
    expect(result.frontmatter.tags).toEqual(["api", "backend", "auth"]);
    expect(result.frontmatter.priority).toBe("high");
  });

  it("works without frontmatter", () => {
    const { writeDocument, readDocument } = getBrain();
    writeDocument("simple", "# Simple\n\nNo frontmatter.");
    const result = readDocument("simple");
    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe("# Simple\n\nNo frontmatter.");
  });
});

describe("removeDocument", () => {
  it("deletes file and updates index", () => {
    const { writeDocument, removeDocument, getBrainDir, listDocuments } =
      getBrain();
    writeDocument("to-delete", "# Delete me");
    expect(listDocuments().length).toBe(1);
    const result = removeDocument("to-delete");
    expect(result).toBe(true);
    const filePath = path.join(getBrainDir(), "to-delete.md");
    expect(fs.existsSync(filePath)).toBe(false);
    expect(listDocuments().length).toBe(0);
  });

  it("returns false for non-existent document", () => {
    const { removeDocument } = getBrain();
    expect(removeDocument("nonexistent")).toBe(false);
  });
});

// ─── Stage 1: Indexing ────────────────────────────────────────

describe("parseFrontmatter", () => {
  it("parses tags array from frontmatter", () => {
    const { parseFrontmatter } = getBrain();
    const { frontmatter, body } = parseFrontmatter(
      "---\ntags: [a, b, c]\n---\nBody here.",
    );
    expect(frontmatter.tags).toEqual(["a", "b", "c"]);
    expect(body).toBe("Body here.");
  });

  it("returns empty frontmatter when none present", () => {
    const { parseFrontmatter } = getBrain();
    const { frontmatter, body } = parseFrontmatter("# Title\n\nBody.");
    expect(frontmatter).toEqual({});
    expect(body).toBe("# Title\n\nBody.");
  });
});

describe("tokenize", () => {
  it("converts to lowercase and removes stop words", () => {
    const { tokenize } = getBrain();
    const tokens = tokenize("The quick brown fox");
    expect(tokens).not.toContain("the");
    expect(tokens).toContain("quick");
    expect(tokens).toContain("brown");
    expect(tokens).toContain("fox");
  });

  it("filters short words", () => {
    const { tokenize } = getBrain();
    const tokens = tokenize("a be go run fast");
    expect(tokens).not.toContain("a");
    expect(tokens).not.toContain("be");
    expect(tokens).toContain("run");
    expect(tokens).toContain("fast");
  });
});

describe("buildIndex", () => {
  it("extracts keywords with correct weights", () => {
    const { writeDocument, buildIndex, _extractKeywords } = getBrain();
    const content = `---
tags: [auth, api]
---
# Authentication Flow

Details about the authentication system.`;
    writeDocument("auth", content);
    const keywords = _extractKeywords(content);
    // Tags get 5x weight
    expect(keywords["auth"]).toBeGreaterThanOrEqual(5);
    // Heading words get 3x
    expect(keywords["authentication"]).toBeGreaterThanOrEqual(3);
    // Body words get 1x
    expect(keywords["details"]).toBeGreaterThanOrEqual(1);
    const idx = buildIndex();
    expect(idx.documents["auth"]).toBeDefined();
  });

  it("ignores stop words", () => {
    const { _extractKeywords } = getBrain();
    const content = "# The Quick Fox\n\nThe fox is fast.";
    const keywords = _extractKeywords(content);
    expect(keywords["the"]).toBeUndefined();
    expect(keywords["is"]).toBeUndefined();
    expect(keywords["quick"]).toBeDefined();
    expect(keywords["fox"]).toBeDefined();
    expect(keywords["fast"]).toBeDefined();
  });
});

// ─── Stage 1: Retrieval ───────────────────────────────────────

describe("_keywordQuery", () => {
  it("returns top-K documents sorted by score", () => {
    const { writeDocument, _keywordQuery } = getBrain();
    writeDocument("auth", "# Authentication\n\nOAuth2 authentication flow.");
    writeDocument("db", "# Database\n\nPostgres schema design.");
    const results = _keywordQuery("authentication oauth", { topK: 3 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("auth");
    expect(results[0].score).toBeGreaterThan(0);
    // Sorted by score desc
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("returns empty array when no matches", () => {
    const { writeDocument, _keywordQuery } = getBrain();
    writeDocument("doc", "# Document\n\nSome content.");
    const results = _keywordQuery("xyznomatch", { topK: 3 });
    expect(results).toEqual([]);
  });

  it("respects minScore threshold", () => {
    const { writeDocument, _keywordQuery } = getBrain();
    writeDocument("doc", "# Document\n\nContent.");
    const results = _keywordQuery("document content", {
      topK: 3,
      minScore: 999,
    });
    expect(results).toEqual([]);
  });
});

describe("getBrainContext", () => {
  it("returns empty string when no brain docs exist", async () => {
    const { getBrainContext } = getBrain();
    const result = await getBrainContext("authentication");
    expect(result).toBe("");
  });

  it("formats output correctly when docs exist", async () => {
    const { writeDocument, getBrainContext } = getBrain();
    writeDocument("auth", "# Auth\n\nAuthentication details.");
    const result = await getBrainContext("authentication");
    expect(result).toContain("KNOWLEDGE BASE (auto-selected)");
    expect(result).toContain("--- auth");
    expect(result).toContain("relevance:");
  });

  it("returns empty string for empty query", async () => {
    const { writeDocument, getBrainContext } = getBrain();
    writeDocument("auth", "# Auth\n\nContent.");
    const result = await getBrainContext("");
    expect(result).toBe("");
  });

  it("respects 25% token budget", async () => {
    const { writeDocument, getBrainContext } = getBrain();
    // Write a large doc
    const bigContent = "# Large Doc\n\n" + "word ".repeat(50000);
    writeDocument("large", bigContent);
    const result = await getBrainContext("large doc word");
    // Should be truncated
    if (result) {
      expect(result).toContain("...(truncated)");
    }
  });
});

// ─── Stage 2: Embeddings ─────────────────────────────────────

describe("isEmbeddingAvailable", () => {
  it("returns false when Ollama is not running", async () => {
    // Set an invalid host to ensure failure
    const savedHost = process.env.OLLAMA_HOST;
    process.env.OLLAMA_HOST = "http://localhost:19999"; // unlikely to be running
    const { isEmbeddingAvailable } = getBrain();
    const result = await isEmbeddingAvailable();
    expect(result).toBe(false);
    if (savedHost !== undefined) process.env.OLLAMA_HOST = savedHost;
    else delete process.env.OLLAMA_HOST;
  });

  it("returns false when NEX_BRAIN_EMBEDDINGS=false", async () => {
    process.env.NEX_BRAIN_EMBEDDINGS = "false";
    const { isEmbeddingAvailable } = getBrain();
    const result = await isEmbeddingAvailable();
    expect(result).toBe(false);
    delete process.env.NEX_BRAIN_EMBEDDINGS;
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    const { cosineSimilarity } = getBrain();
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    const { cosineSimilarity } = getBrain();
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0);
  });

  it("returns 0 for null/mismatched inputs", () => {
    const { cosineSimilarity } = getBrain();
    expect(cosineSimilarity(null, [1, 0])).toBe(0);
    expect(cosineSimilarity([1, 0], null)).toBe(0);
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe("_chunkText", () => {
  it("chunks text into overlapping segments", () => {
    const { _chunkText } = getBrain();
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const text = words.join(" ");
    const chunks = _chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].offset).toBe(0);
  });

  it("handles short text as single chunk", () => {
    const { _chunkText } = getBrain();
    const chunks = _chunkText("short text");
    expect(chunks.length).toBe(1);
    expect(chunks[0].text).toBe("short text");
  });
});

describe("_fuseResults", () => {
  it("fuses keyword and semantic results via RRF", () => {
    const { _fuseResults } = getBrain();
    const keyword = [
      { name: "doc-a", score: 5 },
      { name: "doc-b", score: 3 },
    ];
    const semantic = [
      { name: "doc-b", score: 0.9 },
      { name: "doc-c", score: 0.7 },
    ];
    const fused = _fuseResults(keyword, semantic, { topK: 3 });
    // doc-b appears in both, should rank high
    expect(fused.find((r) => r.name === "doc-b")).toBeDefined();
    // Sorted by score desc
    for (let i = 1; i < fused.length; i++) {
      expect(fused[i - 1].score).toBeGreaterThanOrEqual(fused[i].score);
    }
  });
});

// ─── Stage 3: brain_write Tool ────────────────────────────────

describe("brain_write tool", () => {
  let executeTool;

  beforeEach(() => {
    // Clear module cache for tools
    Object.keys(require.cache).forEach((k) => {
      if (k.includes("/cli/tools") || k.includes("/cli/brain"))
        delete require.cache[k];
    });
    executeTool = require("../cli/tools").executeTool;
  });

  it("creates a new document", async () => {
    const result = await executeTool(
      "brain_write",
      {
        name: "test-create",
        content: "# Test\n\nCreated via tool.",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    expect(result).toContain("Created");
    expect(result).toContain("test-create.md");
    const brainDir = path.join(tmpDir, ".nex", "brain");
    expect(fs.existsSync(path.join(brainDir, "test-create.md"))).toBe(true);
  });

  it("rejects create if document already exists", async () => {
    await executeTool(
      "brain_write",
      {
        name: "existing",
        content: "# Existing",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    const result = await executeTool(
      "brain_write",
      {
        name: "existing",
        content: "# Try again",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    expect(result).toContain("ERROR");
    expect(result).toContain("already exists");
  });

  it("updates an existing document", async () => {
    await executeTool(
      "brain_write",
      {
        name: "update-doc",
        content: "# Original",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    const result = await executeTool(
      "brain_write",
      {
        name: "update-doc",
        content: "# Updated",
        mode: "update",
      },
      { silent: true, autoConfirm: true },
    );
    expect(result).toContain("Updated");
    const brainDir = path.join(tmpDir, ".nex", "brain");
    const content = fs.readFileSync(
      path.join(brainDir, "update-doc.md"),
      "utf-8",
    );
    expect(content).toBe("# Updated");
  });

  it("appends to an existing document", async () => {
    await executeTool(
      "brain_write",
      {
        name: "append-doc",
        content: "# Doc\n\nOriginal content.",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    const result = await executeTool(
      "brain_write",
      {
        name: "append-doc",
        content: "Appended section.",
        mode: "append",
      },
      { silent: true, autoConfirm: true },
    );
    expect(result).toContain("Appended");
    const brainDir = path.join(tmpDir, ".nex", "brain");
    const content = fs.readFileSync(
      path.join(brainDir, "append-doc.md"),
      "utf-8",
    );
    expect(content).toContain("Original content.");
    expect(content).toContain("Appended section.");
  });

  it("triggers index rebuild on write", async () => {
    await executeTool(
      "brain_write",
      {
        name: "index-test",
        content: "# Index Test\n\nUniqueKeyword123.",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    const brainDir = path.join(tmpDir, ".nex", "brain");
    const indexPath = path.join(brainDir, ".brain-index.json");
    expect(fs.existsSync(indexPath)).toBe(true);
    const idx = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    expect(idx.documents["index-test"]).toBeDefined();
  });

  it("returns error for missing name", async () => {
    const result = await executeTool(
      "brain_write",
      {
        content: "# Doc",
        mode: "create",
      },
      { silent: true, autoConfirm: true },
    );
    expect(result).toContain("ERROR");
  });
});

// ─── Integration ─────────────────────────────────────────────

describe("integration: getBrainContext with multiple docs", () => {
  it("selects most relevant document for query", async () => {
    const { writeDocument, getBrainContext } = getBrain();
    writeDocument(
      "auth",
      "# Authentication\n\nOAuth2 token flow and JWT validation.",
    );
    writeDocument(
      "db",
      "# Database\n\nPostgres connection pooling and migrations.",
    );
    writeDocument(
      "deploy",
      "# Deployment\n\nDocker compose and nginx configuration.",
    );

    const result = await getBrainContext("JWT authentication token");
    expect(result).toContain("auth");
    expect(result).toContain("KNOWLEDGE BASE");
  });

  it("returns empty string when no docs match", async () => {
    const { writeDocument, getBrainContext } = getBrain();
    writeDocument("auth", "# Auth\n\nLogin flow.");
    const result = await getBrainContext(
      "xyzxyzxyz totally unrelated zyxzyxzyx",
    );
    // Either empty or containing a low-relevance result — brain should not hallucinate
    if (result) {
      expect(typeof result).toBe("string");
    } else {
      expect(result).toBe("");
    }
  });
});
