const {
  initTree,
  getActiveMessages,
  setActiveMessages,
  createBranch,
  switchBranch,
  gotoMessage,
  deleteBranch,
  renderTree,
  renderTimeline,
} = require("../cli/session-tree");

describe("session-tree.js", () => {
  const sampleMessages = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there!" },
    { role: "user", content: "Write code" },
    { role: "assistant", content: "Here is code..." },
    { role: "user", content: "Fix the bug" },
    { role: "assistant", content: "Fixed!" },
  ];

  describe("initTree()", () => {
    it("creates tree from session without existing tree", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(tree.activeBranch).toBe("main");
      expect(tree.branches.main).toBeDefined();
      expect(tree.branches.main.messages).toEqual(sampleMessages);
      expect(tree.branches.main.parentBranch).toBeNull();
    });

    it("returns existing tree if present", () => {
      const existing = {
        branches: { main: { messages: [], parentBranch: null, forkIndex: 0 } },
        activeBranch: "main",
      };
      const tree = initTree({ messages: [], tree: existing });
      expect(tree).toBe(existing);
    });

    it("handles empty messages", () => {
      const tree = initTree({ messages: [] });
      expect(tree.branches.main.messages).toEqual([]);
    });
  });

  describe("getActiveMessages()", () => {
    it("returns messages from active branch", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(getActiveMessages(tree)).toEqual(sampleMessages);
    });

    it("returns empty array for missing branch", () => {
      const tree = initTree({ messages: sampleMessages });
      tree.activeBranch = "nonexistent";
      expect(getActiveMessages(tree)).toEqual([]);
    });
  });

  describe("setActiveMessages()", () => {
    it("updates messages on active branch", () => {
      const tree = initTree({ messages: sampleMessages });
      const newMsgs = [{ role: "user", content: "New" }];
      setActiveMessages(tree, newMsgs);
      expect(tree.branches.main.messages).toEqual(newMsgs);
    });
  });

  describe("createBranch()", () => {
    it("creates a branch at specified index", () => {
      const tree = initTree({ messages: sampleMessages });
      const { branchName } = createBranch(tree, 2);
      expect(branchName).toBe("branch-1");
      expect(tree.activeBranch).toBe("branch-1");
      // Branch gets messages 0..2 (inclusive)
      expect(tree.branches["branch-1"].messages).toHaveLength(3);
      expect(tree.branches["branch-1"].parentBranch).toBe("main");
      expect(tree.branches["branch-1"].forkIndex).toBe(2);
    });

    it("uses custom branch name", () => {
      const tree = initTree({ messages: sampleMessages });
      const { branchName } = createBranch(tree, 1, "my-experiment");
      expect(branchName).toBe("my-experiment");
      expect(tree.branches["my-experiment"]).toBeDefined();
    });

    it("auto-increments branch numbers", () => {
      const tree = initTree({ messages: sampleMessages });
      createBranch(tree, 2);
      // Switch back to main to fork again
      tree.activeBranch = "main";
      tree.branches.main.messages = sampleMessages;
      const { branchName } = createBranch(tree, 3);
      expect(branchName).toBe("branch-2");
    });

    it("throws on out-of-range index", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(() => createBranch(tree, -1)).toThrow("out of range");
      expect(() => createBranch(tree, 100)).toThrow("out of range");
    });

    it("switches active branch to new branch", () => {
      const tree = initTree({ messages: sampleMessages });
      createBranch(tree, 0);
      expect(tree.activeBranch).toBe("branch-1");
    });
  });

  describe("switchBranch()", () => {
    it("switches to existing branch", () => {
      const tree = initTree({ messages: sampleMessages });
      createBranch(tree, 2);
      switchBranch(tree, "main");
      expect(tree.activeBranch).toBe("main");
    });

    it("throws on nonexistent branch", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(() => switchBranch(tree, "nope")).toThrow('not found');
    });
  });

  describe("gotoMessage()", () => {
    it("truncates messages after index", () => {
      const tree = initTree({ messages: [...sampleMessages] });
      const { truncated } = gotoMessage(tree, 2);
      expect(truncated).toBe(3); // 6 messages, keep 3 (0,1,2)
      expect(tree.branches.main.messages).toHaveLength(3);
    });

    it("goto last message truncates nothing", () => {
      const tree = initTree({ messages: [...sampleMessages] });
      const { truncated } = gotoMessage(tree, 5);
      expect(truncated).toBe(0);
      expect(tree.branches.main.messages).toHaveLength(6);
    });

    it("throws on out-of-range index", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(() => gotoMessage(tree, -1)).toThrow("out of range");
      expect(() => gotoMessage(tree, 10)).toThrow("out of range");
    });
  });

  describe("deleteBranch()", () => {
    it("deletes a non-active branch", () => {
      const tree = initTree({ messages: sampleMessages });
      createBranch(tree, 2, "temp");
      switchBranch(tree, "main");
      deleteBranch(tree, "temp");
      expect(tree.branches.temp).toBeUndefined();
    });

    it("throws when deleting main", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(() => deleteBranch(tree, "main")).toThrow("Cannot delete");
    });

    it("throws when deleting active branch", () => {
      const tree = initTree({ messages: sampleMessages });
      createBranch(tree, 2, "active-branch");
      expect(() => deleteBranch(tree, "active-branch")).toThrow(
        "Cannot delete the active branch",
      );
    });

    it("throws on nonexistent branch", () => {
      const tree = initTree({ messages: sampleMessages });
      expect(() => deleteBranch(tree, "nope")).toThrow("not found");
    });
  });

  describe("renderTree()", () => {
    it("renders tree with branches", () => {
      const tree = initTree({ messages: sampleMessages });
      createBranch(tree, 2, "experiment");
      const output = renderTree(tree);
      expect(output).toContain("Session Tree");
      expect(output).toContain("main");
      expect(output).toContain("experiment");
      expect(output).toContain("forked from main@2");
    });

    it("marks active branch with *", () => {
      const tree = initTree({ messages: sampleMessages });
      const output = renderTree(tree);
      expect(output).toContain("* ");
    });
  });

  describe("renderTimeline()", () => {
    it("renders message timeline", () => {
      const tree = initTree({ messages: sampleMessages });
      const output = renderTimeline(tree);
      expect(output).toContain("Timeline: main");
      expect(output).toContain("6 messages");
      expect(output).toContain("user");
      expect(output).toContain("assistant");
    });

    it("respects maxItems limit", () => {
      const tree = initTree({ messages: sampleMessages });
      const output = renderTimeline(tree, 2);
      // Should show "earlier messages not shown"
      expect(output).toContain("earlier messages");
    });

    it("handles empty branch", () => {
      const tree = initTree({ messages: [] });
      const output = renderTimeline(tree);
      expect(output).toContain("0 messages");
    });
  });

  describe("full workflow", () => {
    it("fork, edit, switch, compare", () => {
      const tree = initTree({ messages: [...sampleMessages] });

      // Fork at message 2
      createBranch(tree, 2, "alt");
      expect(getActiveMessages(tree)).toHaveLength(3);

      // Add a message on the fork
      const altMsgs = getActiveMessages(tree);
      altMsgs.push({ role: "user", content: "Alternative path" });
      setActiveMessages(tree, altMsgs);
      expect(getActiveMessages(tree)).toHaveLength(4);

      // Switch back to main — should still have original 6
      switchBranch(tree, "main");
      expect(getActiveMessages(tree)).toHaveLength(6);

      // Switch to alt — should have 4
      switchBranch(tree, "alt");
      expect(getActiveMessages(tree)).toHaveLength(4);
      expect(getActiveMessages(tree)[3].content).toBe("Alternative path");
    });
  });
});
