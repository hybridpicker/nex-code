"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadRendererScript(relativePath, documentMock) {
  const filePath = path.join(__dirname, "..", relativePath);
  const context = {
    console,
    window: {},
    document: documentMock,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    encodeURIComponent,
    decodeURIComponent,
    HTMLElement: function HTMLElement() {},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(filePath, "utf8"), context, {
    filename: filePath,
  });
  return context;
}

function createElementStub() {
  return {
    innerHTML: "",
    textContent: "",
    style: {},
    className: "",
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
    },
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => []),
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
  };
}

describe("desktop renderer HTML escaping", () => {
  test("escapes completion banner project and phase text", () => {
    const elements = {
      "task-complete": createElementStub(),
      "complete-body": createElementStub(),
      "complete-actions": createElementStub(),
    };
    const context = loadRendererScript("desktop/renderer/js/app.js", {
      addEventListener: jest.fn(),
      getElementById: jest.fn((id) => elements[id] || null),
    });

    context.window.AppState.data.project = '<img src=x onerror="alert(1)">';
    context.window.AppState.data.branch = '<script>alert(2)</script>';
    context.window.AppState.data.agenticNodes = [
      {
        phase: '<svg onload="alert(3)">',
        detail: '<iframe srcdoc="<script>alert(4)</script>"></iframe>',
      },
    ];

    context.showTaskComplete();

    expect(elements["complete-body"].innerHTML).toContain("&lt;img");
    expect(elements["complete-body"].innerHTML).toContain("&lt;script&gt;");
    expect(elements["complete-body"].innerHTML).toContain("&lt;svg");
    expect(elements["complete-body"].innerHTML).toContain("&lt;iframe");
    expect(elements["complete-body"].innerHTML).not.toContain("<img");
    expect(elements["complete-body"].innerHTML).not.toContain("<script>");
    expect(elements["complete-body"].innerHTML).not.toContain("<svg");
    expect(elements["complete-body"].innerHTML).not.toContain("<iframe");
  });

  test("escapes model and tool sidebar values before assigning innerHTML", () => {
    const elements = {
      "session-state-badge": createElementStub(),
      "ss-state": createElementStub(),
      "ss-confidence": createElementStub(),
      "ss-last-action": createElementStub(),
      "model-activity-container": createElementStub(),
      "verify-badge": createElementStub(),
      "vr-tests-run": createElementStub(),
      "vr-passed": createElementStub(),
      "vr-failed": createElementStub(),
      "vr-changes": createElementStub(),
      "vr-status": createElementStub(),
      "tool-actions-container": createElementStub(),
    };
    const context = loadRendererScript(
      "desktop/renderer/js/components/right-panel.js",
      {
        getElementById: jest.fn((id) => elements[id] || null),
      },
    );

    context.initRightPanelComponents({
      project: "unsafe-project",
      sessionState: "running",
      model: '<img src=x onerror="alert(1)">',
      modelHistory: [
        {
          phase: '<script>alert(2)</script>',
          model: '<iframe src="x"></iframe>',
          tokens: 1,
          status: '<svg onload="alert(3)">',
        },
      ],
      toolActions: [
        {
          tool: '<img src=x onerror="alert(4)">',
          detail: '<script>alert(5)</script>',
          time: '<svg onload="alert(6)">',
          status: "running",
        },
      ],
    });

    const combinedHtml =
      elements["model-activity-container"].innerHTML +
      elements["tool-actions-container"].innerHTML;

    expect(combinedHtml).toContain("&lt;img");
    expect(combinedHtml).toContain("&lt;script&gt;");
    expect(combinedHtml).toContain("&lt;iframe");
    expect(combinedHtml).toContain("&lt;svg");
    expect(combinedHtml).not.toContain("<img");
    expect(combinedHtml).not.toContain("<script>");
    expect(combinedHtml).not.toContain("<iframe");
    expect(combinedHtml).not.toContain("<svg");
  });

  test("strips ANSI and redacts secrets in sidebar HTML", () => {
    const elements = {
      "session-state-badge": createElementStub(),
      "ss-state": createElementStub(),
      "ss-confidence": createElementStub(),
      "ss-last-action": createElementStub(),
      "model-activity-container": createElementStub(),
      "verify-badge": createElementStub(),
      "vr-tests-run": createElementStub(),
      "vr-passed": createElementStub(),
      "vr-failed": createElementStub(),
      "vr-changes": createElementStub(),
      "vr-status": createElementStub(),
      "tool-actions-container": createElementStub(),
    };
    const context = loadRendererScript(
      "desktop/renderer/js/components/right-panel.js",
      {
        getElementById: jest.fn((id) => elements[id] || null),
      },
    );

    context.initRightPanelComponents({
      project: "safe-project",
      sessionState: "running",
      model: "\u001b[31mollama\u001b[0m",
      modelHistory: [],
      testsRun: true,
      testPassed: 1,
      testFailed: 0,
      verificationCommand: "npm test",
      verificationStatus: "passed",
      toolActions: [
        {
          tool: "bash",
          detail: "\u001b[32mAPI_TOKEN=supersecretvalue\u001b[0m",
          time: "12:00",
          status: "complete",
        },
      ],
    });

    const combinedHtml =
      elements["model-activity-container"].innerHTML +
      elements["tool-actions-container"].innerHTML;

    expect(combinedHtml).not.toContain("\u001b");
    expect(combinedHtml).not.toContain("supersecretvalue");
    expect(combinedHtml).toContain("API_TOKEN=[REDACTED]");
    expect(elements["vr-status"].textContent).toBe("npm test passed");
  });

  test("escapes active project sidebar values before assigning innerHTML", () => {
    const elements = {
      "sidebar-nav": createElementStub(),
      "recent-projects": createElementStub(),
    };
    elements["sidebar-nav"].querySelectorAll = jest.fn(() => []);

    const context = loadRendererScript(
      "desktop/renderer/js/components/sidebar.js",
      {
        getElementById: jest.fn((id) => elements[id] || null),
      },
    );

    context.initSidebarComponents({
      project: '<img src=x onerror="alert(1)">',
      branch: '<script>alert(2)</script>',
      workspace: '<iframe srcdoc="<script>alert(3)</script>"></iframe>',
      isGitRepository: true,
      sessionState: "idle",
      agenticNodes: [],
      recentProjects: [],
    });

    const html = elements["sidebar-nav"].innerHTML;
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;iframe");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<iframe");
  });
});

describe("desktop renderer conversation state", () => {
  function loadAppController() {
    const elements = {
      welcome: createElementStub(),
      timeline: createElementStub(),
    };

    const context = loadRendererScript("desktop/renderer/js/app.js", {
      addEventListener: jest.fn(),
      getElementById: jest.fn((id) => elements[id] || createElementStub()),
    });

    return context;
  }

  test("renders multiple inline code spans in prompts independently", () => {
    const context = loadAppController();

    const html = context.parseMarkdown(
      "Create `src/main.js`, then run `node src/main.js`.",
    );

    expect(html).toContain("<code>src/main.js</code>");
    expect(html).toContain("<code>node src/main.js</code>");
    expect(html).not.toContain("src/main.js`, then run `node");
  });

  test("marks running user turns complete when an assistant turn completes", () => {
    const context = loadAppController();

    context.createUserConversationTurn("List project files");
    context.appendConversationItem(
      context.createConversationItem("assistant", "Done", {
        status: "running",
      }),
    );

    context.completeActiveConversation();
    context.settleRunningUserConversations("complete");

    expect(context.window.AppState.data.conversationItems).toEqual([
      expect.objectContaining({ kind: "user", status: "complete" }),
      expect.objectContaining({ kind: "assistant", status: "complete" }),
    ]);
  });

  test("uses corrected done summary over stale streamed fitness text", () => {
    const context = loadAppController();

    const finalText = context.extractFinalAssistantText(
      {
        success: true,
        summary:
          "Completed the requested edit. Changed web/templates/fitness/index.html.",
      },
      {
        text:
          "The remaining kcal field has already been added on line 1867.",
      },
    );

    expect(finalText).toContain("Completed the requested edit");
    expect(finalText).toContain("web/templates/fitness/index.html");
    expect(finalText).not.toContain("already been added");
  });

  test("uses corrected done response over stale streamed neutral text", () => {
    const context = loadAppController();

    const finalText = context.extractFinalAssistantText(
      {
        success: true,
        response:
          "Changed src/components/ProfileCard.jsx in this run and verified it.",
      },
      {
        text: "The status line was already present.",
      },
    );

    expect(finalText).toContain("Changed src/components/ProfileCard.jsx");
    expect(finalText).not.toContain("already present");
  });

  test("marks running user turns stopped when a run stalls", () => {
    const context = loadAppController();

    context.createUserConversationTurn("Inspect package scripts");
    context.appendConversationItem(
      context.createConversationItem("assistant", "", {
        status: "running",
      }),
    );

    context.markActiveConversationStopped("No final answer.");
    context.settleRunningUserConversations("stopped", "No final answer.");

    expect(context.window.AppState.data.conversationItems[0]).toEqual(
      expect.objectContaining({
        kind: "user",
        status: "stopped",
        error: "No final answer.",
      }),
    );
    expect(context.window.AppState.data.conversationItems[1]).toEqual(
      expect.objectContaining({
        kind: "assistant",
        status: "stopped",
        error: "No final answer.",
      }),
    );
  });

  test("marks running user turns failed when a server error occurs", () => {
    const context = loadAppController();

    context.createUserConversationTurn("Run verification");
    context.appendConversationItem(
      context.createConversationItem("assistant", "", {
        status: "running",
      }),
    );

    context.markActiveConversationError("Provider unavailable.");
    context.settleRunningUserConversations("error", "Provider unavailable.");

    expect(context.window.AppState.data.conversationItems[0]).toEqual(
      expect.objectContaining({
        kind: "user",
        status: "error",
        error: "Provider unavailable.",
      }),
    );
    expect(context.window.AppState.data.conversationItems[1]).toEqual(
      expect.objectContaining({
        kind: "assistant",
        status: "error",
        error: "Provider unavailable.",
      }),
    );
  });

  test("updates one tool action row across start and end events", () => {
    const context = loadAppController();

    const started = context.upsertToolActionStart({
      id: "msg-1",
      tool: "bash",
      args: { command: "npm test" },
    });
    context.applyVerificationFromToolStart({
      id: "msg-1",
      tool: "bash",
      args: { command: "npm test" },
    }, started);

    const completed = context.completeToolAction({
      id: "msg-1",
      tool: "bash",
      summary: "\u001b[32mTests: 2 passed, 0 failed\u001b[0m",
      ok: true,
    });
    context.applyVerificationFromToolEnd({
      id: "msg-1",
      tool: "bash",
      summary: "\u001b[32mTests: 2 passed, 0 failed\u001b[0m",
      ok: true,
    }, completed);

    expect(context.window.AppState.data.toolActions).toHaveLength(1);
    expect(context.window.AppState.data.toolActions[0]).toEqual(
      expect.objectContaining({
        tool: "bash",
        status: "complete",
        detail: "Tests: 2 passed, 0 failed",
      }),
    );
    expect(context.window.AppState.data.testsRun).toBe(true);
    expect(context.window.AppState.data.testPassed).toBe(2);
    expect(context.window.AppState.data.testFailed).toBe(0);
    expect(context.window.AppState.data.verificationStatus).toBe("passed");
  });

  test("marks running tool actions interrupted on terminal failures", () => {
    const context = loadAppController();

    context.upsertToolActionStart({
      id: "msg-2",
      tool: "grep",
      args: { pattern: "\u001b[31mTODO\u001b[0m" },
    });
    context.markRunningToolsInterrupted("error", "Server exited");

    expect(context.window.AppState.data.toolActions).toEqual([
      expect.objectContaining({
        status: "error",
        ok: false,
        detail: "Server exited",
      }),
    ]);
  });

  test("maps cancelled done payloads to cancelled session state", () => {
    const context = loadAppController();

    expect(
      context.getTerminalSessionState({
        status: "cancelled",
        success: false,
      }, false),
    ).toBe("cancelled");
  });

  test("marks command input ready only after controls are wired", () => {
    const input = createElementStub();
    input.value = "";
    const submit = createElementStub();
    const context = loadRendererScript("desktop/renderer/js/app.js", {
      addEventListener: jest.fn(),
      getElementById: jest.fn((id) => {
        if (id === "cmd-input") return input;
        if (id === "cmd-submit") return submit;
        return createElementStub();
      }),
    });

    expect(context.window.__nexCommandInputReady).toBeUndefined();

    context.setupCommandInput();

    expect(input.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    expect(submit.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(context.window.__nexCommandInputReady).toBe(true);
  });

  test("keeps server log collapsed until the header is clicked", () => {
    const classes = new Set(["collapsed"]);
    const output = createElementStub();
    output.classList = {
      add: jest.fn((name) => classes.add(name)),
      remove: jest.fn((name) => classes.delete(name)),
      contains: jest.fn((name) => classes.has(name)),
      toggle: jest.fn((name, force) => {
        if (force === undefined) {
          if (classes.has(name)) classes.delete(name);
          else classes.add(name);
          return classes.has(name);
        }
        if (force) classes.add(name);
        else classes.delete(name);
        return force;
      }),
    };
    const toggle = createElementStub();
    toggle.setAttribute = jest.fn();
    const stream = createElementStub();

    const context = loadRendererScript("desktop/renderer/js/app.js", {
      addEventListener: jest.fn(),
      createElement: jest.fn(() => createElementStub()),
      getElementById: jest.fn((id) => {
        if (id === "server-output") return output;
        if (id === "server-output-toggle") return toggle;
        if (id === "server-stream") return stream;
        return createElementStub();
      }),
    });

    context.setupServerLogToggle();
    context.addServerLog("ready");

    expect(classes.has("collapsed")).toBe(true);
    expect(toggle.setAttribute).toHaveBeenLastCalledWith("aria-expanded", "false");

    const clickHandler = toggle.addEventListener.mock.calls.find(
      ([eventName]) => eventName === "click",
    )[1];
    clickHandler();

    expect(classes.has("collapsed")).toBe(false);
    expect(toggle.setAttribute).toHaveBeenLastCalledWith("aria-expanded", "true");
    expect(stream.appendChild).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "log-line",
        textContent: "ready",
      }),
    );
  });
});

describe("desktop renderer timeline updates", () => {
  test("updates streamed assistant text without replacing the timeline", () => {
    const textElement = createElementStub();
    const stateElement = createElementStub();
    const turnElement = createElementStub();
    turnElement.dataset = { conversationId: "assistant-1" };
    turnElement.classList = {
      add: jest.fn(),
      remove: jest.fn(),
    };
    turnElement.querySelector = jest.fn((selector) => {
      if (selector === ".conversation-turn-text") return textElement;
      if (selector === ".conversation-turn-state") return stateElement;
      return null;
    });

    const track = createElementStub();
    track.querySelectorAll = jest.fn(() => [turnElement]);
    const context = loadRendererScript(
      "desktop/renderer/js/components/agentic-timeline.js",
      {
        getElementById: jest.fn((id) => id === "timeline-track" ? track : null),
      },
    );

    const updated = context.updateTimelineConversationItem({
      id: "assistant-1",
      kind: "assistant",
      status: "running",
      text: "Working on `desktop`",
    });

    expect(updated).toBe(true);
    expect(track.innerHTML).toBe("");
    expect(textElement.innerHTML).toBe("Working on `desktop`");
    expect(stateElement.textContent).toBe("active");
    expect(turnElement.classList.remove).toHaveBeenCalledWith(
      "running",
      "complete",
      "stopped",
      "error",
    );
    expect(turnElement.classList.add).toHaveBeenCalledWith("running");
  });
});
