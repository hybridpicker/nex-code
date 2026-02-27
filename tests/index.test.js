// Test the REPL command handling logic
jest.mock('../cli/agent', () => ({
  processInput: jest.fn().mockResolvedValue(undefined),
  clearConversation: jest.fn(),
  getConversationLength: jest.fn().mockReturnValue(0),
  getConversationMessages: jest.fn().mockReturnValue([]),
  setConversationMessages: jest.fn(),
}));

jest.mock('../cli/ollama', () => ({
  getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
  setActiveModel: jest.fn(),
  getModelNames: jest.fn().mockReturnValue(['kimi-k2.5', 'qwen3-coder']),
}));

jest.mock('../cli/providers/registry', () => ({
  listProviders: jest.fn().mockReturnValue([
    {
      provider: 'ollama',
      configured: true,
      models: [
        { id: 'kimi-k2.5', name: 'Kimi K2.5', active: true },
        { id: 'qwen3-coder', name: 'Qwen3 Coder', active: false },
      ],
    },
    {
      provider: 'openai',
      configured: false,
      models: [{ id: 'gpt-4o', name: 'GPT-4o', active: false }],
    },
  ]),
  getActiveProviderName: jest.fn().mockReturnValue('ollama'),
  getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
  listAllModels: jest.fn().mockReturnValue([
    { spec: 'ollama:kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama', configured: true },
  ]),
  setFallbackChain: jest.fn(),
  getFallbackChain: jest.fn().mockReturnValue([]),
  getProvider: jest.fn().mockReturnValue(null),
}));

jest.mock('../cli/context', () => ({
  printContext: jest.fn(),
  gatherProjectContext: jest.fn().mockReturnValue(''),
}));

jest.mock('../cli/safety', () => ({
  setAutoConfirm: jest.fn(),
  getAutoConfirm: jest.fn().mockReturnValue(false),
  setReadlineInterface: jest.fn(),
}));

jest.mock('../cli/context-engine', () => ({
  getUsage: jest.fn().mockReturnValue({
    used: 1500,
    limit: 128000,
    percentage: 1.2,
    breakdown: { system: 500, conversation: 800, toolResults: 100, toolDefinitions: 100 },
    messageCount: 5,
  }),
}));

jest.mock('../cli/tools', () => ({
  TOOL_DEFINITIONS: [],
}));

jest.mock('../cli/session', () => ({
  saveSession: jest.fn().mockReturnValue({ path: '/tmp/test.json', name: 'test' }),
  loadSession: jest.fn().mockReturnValue(null),
  listSessions: jest.fn().mockReturnValue([]),
  getLastSession: jest.fn().mockReturnValue(null),
}));

jest.mock('../cli/memory', () => ({
  remember: jest.fn(),
  forget: jest.fn().mockReturnValue(false),
  listMemories: jest.fn().mockReturnValue([]),
}));

jest.mock('../cli/permissions', () => ({
  listPermissions: jest.fn().mockReturnValue([
    { tool: 'bash', mode: 'ask' },
    { tool: 'read_file', mode: 'allow' },
  ]),
  setPermission: jest.fn().mockReturnValue(true),
  savePermissions: jest.fn(),
}));

jest.mock('../cli/planner', () => ({
  createPlan: jest.fn(),
  getActivePlan: jest.fn().mockReturnValue(null),
  setPlanMode: jest.fn(),
  isPlanMode: jest.fn().mockReturnValue(false),
  approvePlan: jest.fn().mockReturnValue(false),
  startExecution: jest.fn(),
  formatPlan: jest.fn().mockReturnValue('No active plan'),
  savePlan: jest.fn(),
  listPlans: jest.fn().mockReturnValue([]),
  clearPlan: jest.fn(),
  setAutonomyLevel: jest.fn().mockReturnValue(true),
  getAutonomyLevel: jest.fn().mockReturnValue('interactive'),
  AUTONOMY_LEVELS: ['interactive', 'semi-auto', 'autonomous'],
}));

jest.mock('../cli/git', () => ({
  isGitRepo: jest.fn().mockReturnValue(true),
  getCurrentBranch: jest.fn().mockReturnValue('main'),
  formatDiffSummary: jest.fn().mockReturnValue('No changes'),
  analyzeDiff: jest.fn().mockReturnValue(null),
  commit: jest.fn().mockReturnValue(null),
  createBranch: jest.fn().mockReturnValue('feat/test-branch'),
}));

jest.mock('../cli/mcp', () => ({
  listServers: jest.fn().mockReturnValue([]),
  connectAll: jest.fn().mockResolvedValue([]),
  disconnectAll: jest.fn(),
}));

jest.mock('../cli/hooks', () => ({
  listHooks: jest.fn().mockReturnValue([]),
  runHooks: jest.fn().mockReturnValue([]),
  HOOK_EVENTS: ['pre-tool', 'post-tool', 'pre-commit', 'post-response', 'session-start', 'session-end'],
}));

jest.mock('../cli/costs', () => ({
  formatCosts: jest.fn().mockReturnValue('No token usage recorded this session.'),
  resetCosts: jest.fn(),
}));

jest.mock('../cli/skills', () => ({
  loadAllSkills: jest.fn().mockReturnValue([]),
  listSkills: jest.fn().mockReturnValue([]),
  enableSkill: jest.fn().mockReturnValue(false),
  disableSkill: jest.fn().mockReturnValue(false),
  getSkillCommands: jest.fn().mockReturnValue([]),
  handleSkillCommand: jest.fn().mockReturnValue(false),
}));

describe('index.js (REPL commands)', () => {
  let logSpy, writeSpy, exitSpy;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    logSpy.errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    writeSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    logSpy.errorSpy.mockRestore();
    writeSpy.mockRestore();
    exitSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe('startREPL()', () => {
    it('exits with error when no provider is configured', () => {
      // Reset modules to get fresh instance with no configured providers
      jest.resetModules();
      jest.mock('../cli/agent', () => ({
        processInput: jest.fn().mockResolvedValue(undefined),
        clearConversation: jest.fn(),
        getConversationLength: jest.fn().mockReturnValue(0),
        getConversationMessages: jest.fn().mockReturnValue([]),
        setConversationMessages: jest.fn(),
      }));
      jest.mock('../cli/context-engine', () => ({
        getUsage: jest.fn().mockReturnValue({
          used: 1500, limit: 128000, percentage: 1.2,
          breakdown: { system: 500, conversation: 800, toolResults: 100, toolDefinitions: 100 },
          messageCount: 5,
        }),
      }));
      jest.mock('../cli/tools', () => ({ TOOL_DEFINITIONS: [] }));
      jest.mock('../cli/session', () => ({
        saveSession: jest.fn().mockReturnValue({ path: '/tmp/test.json', name: 'test' }),
        loadSession: jest.fn().mockReturnValue(null),
        listSessions: jest.fn().mockReturnValue([]),
        getLastSession: jest.fn().mockReturnValue(null),
      }));
      jest.mock('../cli/memory', () => ({
        remember: jest.fn(),
        forget: jest.fn().mockReturnValue(false),
        listMemories: jest.fn().mockReturnValue([]),
      }));
      jest.mock('../cli/permissions', () => ({
        listPermissions: jest.fn().mockReturnValue([]),
        setPermission: jest.fn().mockReturnValue(true),
        savePermissions: jest.fn(),
      }));
      jest.mock('../cli/planner', () => ({
        createPlan: jest.fn(), getActivePlan: jest.fn().mockReturnValue(null),
        setPlanMode: jest.fn(), isPlanMode: jest.fn().mockReturnValue(false),
        approvePlan: jest.fn().mockReturnValue(false), startExecution: jest.fn(),
        formatPlan: jest.fn().mockReturnValue('No active plan'),
        savePlan: jest.fn(), listPlans: jest.fn().mockReturnValue([]), clearPlan: jest.fn(),
        setAutonomyLevel: jest.fn().mockReturnValue(true),
        getAutonomyLevel: jest.fn().mockReturnValue('interactive'),
        AUTONOMY_LEVELS: ['interactive', 'semi-auto', 'autonomous'],
      }));
      jest.mock('../cli/git', () => ({
        isGitRepo: jest.fn().mockReturnValue(true),
        getCurrentBranch: jest.fn().mockReturnValue('main'),
        formatDiffSummary: jest.fn().mockReturnValue('No changes'),
        analyzeDiff: jest.fn().mockReturnValue(null),
        commit: jest.fn().mockReturnValue(null),
        createBranch: jest.fn().mockReturnValue('feat/test-branch'),
      }));
      jest.mock('../cli/mcp', () => ({
        listServers: jest.fn().mockReturnValue([]),
        connectAll: jest.fn().mockResolvedValue([]),
        disconnectAll: jest.fn(),
      }));
      jest.mock('../cli/hooks', () => ({
        listHooks: jest.fn().mockReturnValue([]),
        runHooks: jest.fn().mockReturnValue([]),
        HOOK_EVENTS: ['pre-tool', 'post-tool', 'pre-commit', 'post-response', 'session-start', 'session-end'],
      }));
      jest.mock('../cli/ollama', () => ({
        getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5' }),
        setActiveModel: jest.fn(),
        getModelNames: jest.fn().mockReturnValue([]),
      }));
      jest.mock('../cli/providers/registry', () => ({
        listProviders: jest.fn().mockReturnValue([
          { provider: 'ollama', configured: false, models: [] },
          { provider: 'openai', configured: false, models: [] },
        ]),
        getActiveProviderName: jest.fn().mockReturnValue('ollama'),
        getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5' }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock('../cli/context', () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn().mockReturnValue(''),
      }));
      jest.mock('../cli/safety', () => ({
        setAutoConfirm: jest.fn(),
        getAutoConfirm: jest.fn().mockReturnValue(false),
        setReadlineInterface: jest.fn(),
      }));
      jest.mock('../cli/costs', () => ({
        formatCosts: jest.fn().mockReturnValue('No token usage recorded this session.'),
        resetCosts: jest.fn(),
      }));
      jest.mock('../cli/skills', () => ({
        loadAllSkills: jest.fn().mockReturnValue([]),
        listSkills: jest.fn().mockReturnValue([]),
        enableSkill: jest.fn().mockReturnValue(false),
        disableSkill: jest.fn().mockReturnValue(false),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn().mockReturnValue(false),
      }));

      const { startREPL } = require('../cli/index');
      startREPL();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('starts REPL when a provider is configured', () => {
      jest.resetModules();
      jest.mock('../cli/agent', () => ({
        processInput: jest.fn().mockResolvedValue(undefined),
        clearConversation: jest.fn(),
        getConversationLength: jest.fn().mockReturnValue(0),
        getConversationMessages: jest.fn().mockReturnValue([]),
        setConversationMessages: jest.fn(),
      }));
      jest.mock('../cli/context-engine', () => ({
        getUsage: jest.fn().mockReturnValue({
          used: 1500, limit: 128000, percentage: 1.2,
          breakdown: { system: 500, conversation: 800, toolResults: 100, toolDefinitions: 100 },
          messageCount: 5,
        }),
      }));
      jest.mock('../cli/tools', () => ({ TOOL_DEFINITIONS: [] }));
      jest.mock('../cli/session', () => ({
        saveSession: jest.fn().mockReturnValue({ path: '/tmp/test.json', name: 'test' }),
        loadSession: jest.fn().mockReturnValue(null),
        listSessions: jest.fn().mockReturnValue([]),
        getLastSession: jest.fn().mockReturnValue(null),
      }));
      jest.mock('../cli/memory', () => ({
        remember: jest.fn(),
        forget: jest.fn().mockReturnValue(false),
        listMemories: jest.fn().mockReturnValue([]),
      }));
      jest.mock('../cli/permissions', () => ({
        listPermissions: jest.fn().mockReturnValue([]),
        setPermission: jest.fn().mockReturnValue(true),
        savePermissions: jest.fn(),
      }));
      jest.mock('../cli/planner', () => ({
        createPlan: jest.fn(), getActivePlan: jest.fn().mockReturnValue(null),
        setPlanMode: jest.fn(), isPlanMode: jest.fn().mockReturnValue(false),
        approvePlan: jest.fn().mockReturnValue(false), startExecution: jest.fn(),
        formatPlan: jest.fn().mockReturnValue('No active plan'),
        savePlan: jest.fn(), listPlans: jest.fn().mockReturnValue([]), clearPlan: jest.fn(),
        setAutonomyLevel: jest.fn().mockReturnValue(true),
        getAutonomyLevel: jest.fn().mockReturnValue('interactive'),
        AUTONOMY_LEVELS: ['interactive', 'semi-auto', 'autonomous'],
      }));
      jest.mock('../cli/git', () => ({
        isGitRepo: jest.fn().mockReturnValue(true),
        getCurrentBranch: jest.fn().mockReturnValue('main'),
        formatDiffSummary: jest.fn().mockReturnValue('No changes'),
        analyzeDiff: jest.fn().mockReturnValue(null),
        commit: jest.fn().mockReturnValue(null),
        createBranch: jest.fn().mockReturnValue('feat/test-branch'),
      }));
      jest.mock('../cli/mcp', () => ({
        listServers: jest.fn().mockReturnValue([]),
        connectAll: jest.fn().mockResolvedValue([]),
        disconnectAll: jest.fn(),
      }));
      jest.mock('../cli/hooks', () => ({
        listHooks: jest.fn().mockReturnValue([]),
        runHooks: jest.fn().mockReturnValue([]),
        HOOK_EVENTS: ['pre-tool', 'post-tool', 'pre-commit', 'post-response', 'session-start', 'session-end'],
      }));
      jest.mock('../cli/ollama', () => ({
        getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
        setActiveModel: jest.fn(),
        getModelNames: jest.fn().mockReturnValue(['kimi-k2.5', 'qwen3-coder']),
      }));
      jest.mock('../cli/providers/registry', () => ({
        listProviders: jest.fn().mockReturnValue([
          { provider: 'ollama', configured: true, models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5', active: true }] },
        ]),
        getActiveProviderName: jest.fn().mockReturnValue('ollama'),
        getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock('../cli/context', () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn().mockReturnValue(''),
      }));
      jest.mock('../cli/safety', () => ({
        setAutoConfirm: jest.fn(),
        getAutoConfirm: jest.fn().mockReturnValue(false),
        setReadlineInterface: jest.fn(),
      }));
      jest.mock('../cli/costs', () => ({
        formatCosts: jest.fn().mockReturnValue('No token usage recorded this session.'),
        resetCosts: jest.fn(),
      }));
      jest.mock('../cli/skills', () => ({
        loadAllSkills: jest.fn().mockReturnValue([]),
        listSkills: jest.fn().mockReturnValue([]),
        enableSkill: jest.fn().mockReturnValue(false),
        disableSkill: jest.fn().mockReturnValue(false),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn().mockReturnValue(false),
      }));

      const mockRl = {
        prompt: jest.fn(),
        on: jest.fn().mockReturnThis(),
        close: jest.fn(),
      };
      jest.spyOn(require('readline'), 'createInterface').mockReturnValueOnce(mockRl);

      const { startREPL } = require('../cli/index');
      startREPL();

      expect(exitSpy).not.toHaveBeenCalledWith(1);
    });
  });

  describe('slash commands via readline', () => {
    let lineHandler, closeHandler, mockRl;

    beforeEach(() => {
      mockRl = {
        prompt: jest.fn(),
        on: jest.fn(function (event, handler) {
          if (event === 'line') lineHandler = handler;
          if (event === 'close') closeHandler = handler;
          return this;
        }),
        close: jest.fn(),
      };
      jest.spyOn(require('readline'), 'createInterface').mockReturnValueOnce(mockRl);

      // Clear module cache to get fresh instance
      jest.resetModules();
      jest.mock('../cli/agent', () => ({
        processInput: jest.fn().mockResolvedValue(undefined),
        clearConversation: jest.fn(),
        getConversationLength: jest.fn().mockReturnValue(0),
        getConversationMessages: jest.fn().mockReturnValue([
          { role: 'user', content: 'test' },
          { role: 'assistant', content: 'reply' },
        ]),
        setConversationMessages: jest.fn(),
      }));
      jest.mock('../cli/context-engine', () => ({
        getUsage: jest.fn().mockReturnValue({
          used: 1500, limit: 128000, percentage: 1.2,
          breakdown: { system: 500, conversation: 800, toolResults: 100, toolDefinitions: 100 },
          messageCount: 5,
        }),
      }));
      jest.mock('../cli/tools', () => ({ TOOL_DEFINITIONS: [] }));
      jest.mock('../cli/session', () => ({
        saveSession: jest.fn().mockReturnValue({ path: '/tmp/test.json', name: 'test' }),
        loadSession: jest.fn().mockImplementation((name) => {
          if (name === 'my-session') return { name: 'my-session', messageCount: 3, messages: [{ role: 'user', content: 'hi' }] };
          return null;
        }),
        listSessions: jest.fn().mockReturnValue([
          { name: 'session-1', updatedAt: '2025-06-01T00:00:00Z', messageCount: 5 },
          { name: '_autosave', updatedAt: '2025-06-02T00:00:00Z', messageCount: 8 },
        ]),
        getLastSession: jest.fn().mockReturnValue({ name: '_autosave', messageCount: 8, messages: [{ role: 'user', content: 'last' }] }),
      }));
      jest.mock('../cli/memory', () => ({
        remember: jest.fn(),
        forget: jest.fn().mockImplementation((key) => key === 'existing-key'),
        listMemories: jest.fn().mockReturnValue([
          { key: 'lang', value: 'TypeScript', updatedAt: '2025-06-01T00:00:00Z' },
        ]),
      }));
      jest.mock('../cli/permissions', () => ({
        listPermissions: jest.fn().mockReturnValue([
          { tool: 'bash', mode: 'ask' },
          { tool: 'read_file', mode: 'allow' },
        ]),
        setPermission: jest.fn().mockReturnValue(true),
        savePermissions: jest.fn(),
      }));
      jest.mock('../cli/planner', () => ({
        createPlan: jest.fn(), getActivePlan: jest.fn().mockReturnValue(null),
        setPlanMode: jest.fn(), isPlanMode: jest.fn().mockReturnValue(false),
        approvePlan: jest.fn().mockReturnValue(false), startExecution: jest.fn(),
        formatPlan: jest.fn().mockReturnValue('No active plan'),
        savePlan: jest.fn(), listPlans: jest.fn().mockReturnValue([]), clearPlan: jest.fn(),
        setAutonomyLevel: jest.fn().mockReturnValue(true),
        getAutonomyLevel: jest.fn().mockReturnValue('interactive'),
        AUTONOMY_LEVELS: ['interactive', 'semi-auto', 'autonomous'],
      }));
      jest.mock('../cli/git', () => ({
        isGitRepo: jest.fn().mockReturnValue(true),
        getCurrentBranch: jest.fn().mockReturnValue('main'),
        formatDiffSummary: jest.fn().mockReturnValue('No changes'),
        analyzeDiff: jest.fn().mockReturnValue(null),
        commit: jest.fn().mockReturnValue(null),
        createBranch: jest.fn().mockReturnValue('feat/test-branch'),
      }));
      jest.mock('../cli/mcp', () => ({
        listServers: jest.fn().mockReturnValue([]),
        connectAll: jest.fn().mockResolvedValue([]),
        disconnectAll: jest.fn(),
      }));
      jest.mock('../cli/hooks', () => ({
        listHooks: jest.fn().mockReturnValue([]),
        runHooks: jest.fn().mockReturnValue([]),
        HOOK_EVENTS: ['pre-tool', 'post-tool', 'pre-commit', 'post-response', 'session-start', 'session-end'],
      }));
      jest.mock('../cli/ollama', () => ({
        getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
        setActiveModel: jest.fn().mockImplementation((name) => name === 'qwen3-coder' || name === 'openai:gpt-4o'),
        getModelNames: jest.fn().mockReturnValue(['kimi-k2.5', 'qwen3-coder']),
      }));
      jest.mock('../cli/providers/registry', () => ({
        listProviders: jest.fn().mockReturnValue([
          {
            provider: 'ollama',
            configured: true,
            models: [
              { id: 'kimi-k2.5', name: 'Kimi K2.5', active: true },
              { id: 'qwen3-coder', name: 'Qwen3 Coder', active: false },
            ],
          },
          {
            provider: 'openai',
            configured: false,
            models: [{ id: 'gpt-4o', name: 'GPT-4o', active: false }],
          },
        ]),
        getActiveProviderName: jest.fn().mockReturnValue('ollama'),
        getActiveModel: jest.fn().mockReturnValue({ id: 'kimi-k2.5', name: 'Kimi K2.5', provider: 'ollama' }),
        listAllModels: jest.fn().mockReturnValue([]),
        setFallbackChain: jest.fn(),
        getFallbackChain: jest.fn().mockReturnValue([]),
        getProvider: jest.fn().mockReturnValue(null),
      }));
      jest.mock('../cli/costs', () => ({
        formatCosts: jest.fn().mockReturnValue('No token usage recorded this session.'),
        resetCosts: jest.fn(),
      }));
      jest.mock('../cli/context', () => ({
        printContext: jest.fn(),
        gatherProjectContext: jest.fn().mockReturnValue(''),
      }));
      jest.mock('../cli/safety', () => ({
        setAutoConfirm: jest.fn(),
        getAutoConfirm: jest.fn().mockReturnValue(false),
        setReadlineInterface: jest.fn(),
      }));
      jest.mock('../cli/skills', () => ({
        loadAllSkills: jest.fn().mockReturnValue([]),
        listSkills: jest.fn().mockReturnValue([]),
        enableSkill: jest.fn().mockReturnValue(false),
        disableSkill: jest.fn().mockReturnValue(false),
        getSkillCommands: jest.fn().mockReturnValue([]),
        handleSkillCommand: jest.fn().mockReturnValue(false),
      }));

      const { startREPL } = require('../cli/index');
      startREPL();
    });

    afterEach(() => {
      delete process.env.OLLAMA_API_KEY;
    });

    it('handles /help command', async () => {
      await lineHandler('/help');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('/help');
      expect(output).toContain('/model');
      expect(output).toContain('/clear');
      expect(output).toContain('/providers');
    });

    it('handles /model without args (shows current)', async () => {
      await lineHandler('/model');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('kimi-k2.5');
    });

    it('handles /model with valid name', async () => {
      const { setActiveModel } = require('../cli/ollama');
      setActiveModel.mockReturnValueOnce(true);
      await lineHandler('/model qwen3-coder');
      expect(setActiveModel).toHaveBeenCalledWith('qwen3-coder');
    });

    it('handles /model with provider:model format', async () => {
      const { setActiveModel } = require('../cli/ollama');
      setActiveModel.mockReturnValueOnce(true);
      await lineHandler('/model openai:gpt-4o');
      expect(setActiveModel).toHaveBeenCalledWith('openai:gpt-4o');
    });

    it('handles /model with invalid name', async () => {
      const { setActiveModel } = require('../cli/ollama');
      setActiveModel.mockReturnValueOnce(false);
      await lineHandler('/model invalid');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Unknown model');
    });

    it('handles /model list', async () => {
      await lineHandler('/model list');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('ollama');
    });

    it('handles /providers command', async () => {
      await lineHandler('/providers');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('ollama');
      expect(output).toContain('openai');
    });

    it('handles /tokens command', async () => {
      await lineHandler('/tokens');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Token Usage');
      expect(output).toContain('128k context');
    });

    it('handles /clear command', async () => {
      const { clearConversation } = require('../cli/agent');
      await lineHandler('/clear');
      expect(clearConversation).toHaveBeenCalled();
    });

    it('handles /context command', async () => {
      const { printContext } = require('../cli/context');
      await lineHandler('/context');
      expect(printContext).toHaveBeenCalled();
    });

    it('handles /autoconfirm toggle', async () => {
      const { setAutoConfirm } = require('../cli/safety');
      await lineHandler('/autoconfirm');
      expect(setAutoConfirm).toHaveBeenCalled();
    });

    it('handles /exit command', async () => {
      await lineHandler('/exit');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('handles /quit command', async () => {
      await lineHandler('/quit');
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('handles unknown slash command', async () => {
      await lineHandler('/unknown');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Unknown command');
    });

    it('skips empty input', async () => {
      const { processInput } = require('../cli/agent');
      await lineHandler('');
      expect(processInput).not.toHaveBeenCalled();
    });

    it('sends non-command input to agent', async () => {
      const { processInput } = require('../cli/agent');
      await lineHandler('write a function');
      expect(processInput).toHaveBeenCalledWith('write a function');
    });

    it('handles readline close', () => {
      closeHandler();
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    // ─── Session commands ───────────────────────────────
    it('handles /save command', async () => {
      const { saveSession } = require('../cli/session');
      await lineHandler('/save my-backup');
      expect(saveSession).toHaveBeenCalledWith(
        'my-backup',
        expect.any(Array),
        expect.objectContaining({ model: 'kimi-k2.5', provider: 'ollama' })
      );
    });

    it('handles /save without name (generates timestamp)', async () => {
      const { saveSession } = require('../cli/session');
      await lineHandler('/save');
      expect(saveSession).toHaveBeenCalled();
      const name = saveSession.mock.calls[0][0];
      expect(name).toMatch(/^session-\d+$/);
    });

    it('handles /save with empty conversation', async () => {
      // Override getConversationMessages to return empty
      const agent = require('../cli/agent');
      agent.getConversationMessages.mockReturnValueOnce([]);
      await lineHandler('/save test');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No conversation');
    });

    it('handles /load with valid session', async () => {
      const { setConversationMessages } = require('../cli/agent');
      await lineHandler('/load my-session');
      expect(setConversationMessages).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Loaded session');
    });

    it('handles /load with non-existent session', async () => {
      await lineHandler('/load nonexistent');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Session not found');
    });

    it('handles /load without name', async () => {
      await lineHandler('/load');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Usage');
    });

    it('handles /sessions command', async () => {
      await lineHandler('/sessions');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('session-1');
      expect(output).toContain('_autosave');
    });

    it('handles /resume command', async () => {
      const { setConversationMessages } = require('../cli/agent');
      await lineHandler('/resume');
      expect(setConversationMessages).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Resumed');
    });

    // ─── Memory commands ────────────────────────────────
    it('handles /remember with key=value', async () => {
      const { remember } = require('../cli/memory');
      await lineHandler('/remember lang=TypeScript');
      expect(remember).toHaveBeenCalledWith('lang', 'TypeScript');
    });

    it('handles /remember with freeform text', async () => {
      const { remember } = require('../cli/memory');
      await lineHandler('/remember always use yarn');
      expect(remember).toHaveBeenCalled();
      const [key, value] = remember.mock.calls[0];
      expect(value).toBe('always use yarn');
    });

    it('handles /remember without text', async () => {
      await lineHandler('/remember');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Usage');
    });

    it('handles /forget with existing key', async () => {
      await lineHandler('/forget existing-key');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Forgotten');
    });

    it('handles /forget with non-existent key', async () => {
      await lineHandler('/forget nope');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('not found');
    });

    it('handles /forget without key', async () => {
      await lineHandler('/forget');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Usage');
    });

    it('handles /memory command', async () => {
      await lineHandler('/memory');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('lang');
      expect(output).toContain('TypeScript');
    });

    // ─── Permission commands ────────────────────────────
    it('handles /permissions command', async () => {
      await lineHandler('/permissions');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('bash');
      expect(output).toContain('ask');
    });

    it('handles /allow command', async () => {
      const { setPermission, savePermissions } = require('../cli/permissions');
      await lineHandler('/allow bash');
      expect(setPermission).toHaveBeenCalledWith('bash', 'allow');
      expect(savePermissions).toHaveBeenCalled();
    });

    it('handles /deny command', async () => {
      const { setPermission, savePermissions } = require('../cli/permissions');
      await lineHandler('/deny bash');
      expect(setPermission).toHaveBeenCalledWith('bash', 'deny');
      expect(savePermissions).toHaveBeenCalled();
    });

    it('handles /allow without tool name', async () => {
      await lineHandler('/allow');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Usage');
    });

    it('handles /deny without tool name', async () => {
      await lineHandler('/deny');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Usage');
    });

    // ─── Plan commands ──────────────────────────────────
    it('handles /plan command (enter plan mode)', async () => {
      const { setPlanMode } = require('../cli/planner');
      await lineHandler('/plan');
      expect(setPlanMode).toHaveBeenCalledWith(true);
    });

    it('handles /plan with task description', async () => {
      const { setPlanMode } = require('../cli/planner');
      await lineHandler('/plan refactor auth module');
      expect(setPlanMode).toHaveBeenCalledWith(true);
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Plan mode activated');
    });

    it('handles /plan status', async () => {
      const { formatPlan } = require('../cli/planner');
      await lineHandler('/plan status');
      expect(formatPlan).toHaveBeenCalled();
    });

    it('handles /plan approve with no plan', async () => {
      await lineHandler('/plan approve');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No plan');
    });

    it('handles /plans command', async () => {
      await lineHandler('/plans');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No saved plans');
    });

    it('handles /auto without level', async () => {
      await lineHandler('/auto');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('interactive');
    });

    it('handles /auto with valid level', async () => {
      const { setAutonomyLevel } = require('../cli/planner');
      await lineHandler('/auto semi-auto');
      expect(setAutonomyLevel).toHaveBeenCalledWith('semi-auto');
    });

    it('handles /auto with invalid level', async () => {
      const { setAutonomyLevel } = require('../cli/planner');
      setAutonomyLevel.mockReturnValueOnce(false);
      await lineHandler('/auto invalid');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Unknown level');
    });

    // ─── Git commands ───────────────────────────────────
    it('handles /diff command', async () => {
      const { formatDiffSummary } = require('../cli/git');
      await lineHandler('/diff');
      expect(formatDiffSummary).toHaveBeenCalled();
    });

    it('handles /branch without name', async () => {
      await lineHandler('/branch');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('main');
    });

    it('handles /branch with name', async () => {
      const { createBranch } = require('../cli/git');
      await lineHandler('/branch add new feature');
      expect(createBranch).toHaveBeenCalledWith('add new feature');
    });

    it('handles /commit without changes', async () => {
      await lineHandler('/commit');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No changes');
    });

    it('handles /commit with message', async () => {
      const { commit } = require('../cli/git');
      commit.mockReturnValueOnce('abc1234');
      await lineHandler('/commit fix: bug fix');
      expect(commit).toHaveBeenCalledWith('fix: bug fix');
    });

    // ─── MCP commands ──────────────────────────────────
    it('handles /mcp command (no servers)', async () => {
      await lineHandler('/mcp');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No MCP servers configured');
    });

    it('handles /mcp disconnect', async () => {
      const { disconnectAll } = require('../cli/mcp');
      await lineHandler('/mcp disconnect');
      expect(disconnectAll).toHaveBeenCalled();
    });

    // ─── Hooks commands ────────────────────────────────
    it('handles /hooks command (no hooks)', async () => {
      await lineHandler('/hooks');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No hooks configured');
    });

    // ─── Costs commands ─────────────────────────────────
    it('handles /costs command', async () => {
      await lineHandler('/costs');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No token usage');
    });

    it('handles /costs reset', async () => {
      const { resetCosts } = require('../cli/costs');
      await lineHandler('/costs reset');
      expect(resetCosts).toHaveBeenCalled();
    });

    // ─── Fallback commands ──────────────────────────────
    it('handles /fallback without args (no chain)', async () => {
      await lineHandler('/fallback');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No fallback chain');
    });

    it('handles /fallback with chain', async () => {
      const { setFallbackChain } = require('../cli/providers/registry');
      await lineHandler('/fallback anthropic,openai,local');
      expect(setFallbackChain).toHaveBeenCalledWith(['anthropic', 'openai', 'local']);
    });

    // ─── Additional session commands ────────────────────
    it('handles /sessions with empty list', async () => {
      const session = require('../cli/session');
      session.listSessions.mockReturnValueOnce([]);
      await lineHandler('/sessions');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No saved sessions');
    });

    it('handles /resume with no session', async () => {
      const session = require('../cli/session');
      session.getLastSession.mockReturnValueOnce(null);
      await lineHandler('/resume');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No session');
    });

    // ─── Additional memory commands ─────────────────────
    it('handles /memory with empty list', async () => {
      const memory = require('../cli/memory');
      memory.listMemories.mockReturnValueOnce([]);
      await lineHandler('/memory');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('No memories');
    });

    // ─── Additional plan commands ───────────────────────
    it('handles /plan approve with active plan', async () => {
      const planner = require('../cli/planner');
      planner.approvePlan.mockReturnValueOnce(true);
      await lineHandler('/plan approve');
      expect(planner.startExecution).toHaveBeenCalled();
      expect(planner.setPlanMode).toHaveBeenCalledWith(false);
    });

    it('handles /plans with saved plans', async () => {
      const planner = require('../cli/planner');
      planner.listPlans.mockReturnValueOnce([
        { name: 'plan-1', task: 'refactor', steps: 3, status: 'completed' },
        { name: 'plan-2', task: 'feature', steps: 5, status: 'executing' },
      ]);
      await lineHandler('/plans');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('plan-1');
      expect(output).toContain('plan-2');
    });

    // ─── Additional git commands ────────────────────────
    it('handles /commit when commit succeeds', async () => {
      const git = require('../cli/git');
      git.commit.mockReturnValueOnce('abc1234');
      await lineHandler('/commit feat: add feature');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('abc1234');
    });

    it('handles /commit when commit fails', async () => {
      const git = require('../cli/git');
      git.commit.mockReturnValueOnce(null);
      await lineHandler('/commit test message');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Commit failed');
    });

    it('handles /branch creation failure', async () => {
      const git = require('../cli/git');
      git.createBranch.mockReturnValueOnce(null);
      await lineHandler('/branch broken-branch');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Failed to create branch');
    });

    it('handles /diff not in git repo', async () => {
      const git = require('../cli/git');
      git.isGitRepo.mockReturnValueOnce(false);
      await lineHandler('/diff');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Not a git repository');
    });

    it('handles /commit not in git repo', async () => {
      const git = require('../cli/git');
      git.isGitRepo.mockReturnValueOnce(false);
      await lineHandler('/commit test');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Not a git repository');
    });

    it('handles /branch not in git repo', async () => {
      const git = require('../cli/git');
      git.isGitRepo.mockReturnValueOnce(false);
      await lineHandler('/branch test');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Not a git repository');
    });

    // ─── MCP commands extended ──────────────────────────
    it('handles /mcp connect', async () => {
      const mcp = require('../cli/mcp');
      mcp.connectAll.mockResolvedValueOnce([
        { name: 'server1', tools: 3 },
        { name: 'server2', tools: 0, error: 'Connection failed' },
      ]);
      await lineHandler('/mcp connect');
      // Need to wait for async .then()
      await new Promise((r) => setTimeout(r, 10));
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('server1');
    });

    it('handles /mcp with servers configured', async () => {
      const mcp = require('../cli/mcp');
      mcp.listServers.mockReturnValueOnce([
        { name: 'test-srv', command: 'node', connected: true, toolCount: 5 },
      ]);
      await lineHandler('/mcp');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('test-srv');
      expect(output).toContain('connected');
    });

    // ─── Hooks with hooks configured ────────────────────
    it('handles /hooks with hooks configured', async () => {
      const hooks = require('../cli/hooks');
      hooks.listHooks.mockReturnValueOnce([
        { event: 'pre-tool', commands: ['echo "before"'] },
        { event: 'post-tool', commands: ['echo "after"'] },
      ]);
      await lineHandler('/hooks');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('pre-tool');
      expect(output).toContain('post-tool');
    });

    // ─── Agent error handling ───────────────────────────
    it('handles agent processInput error', async () => {
      const agent = require('../cli/agent');
      agent.processInput.mockRejectedValueOnce(new Error('Provider error'));
      await lineHandler('do something');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Provider error');
    });

    // ─── /commit with smart commit flow ─────────────────
    it('handles /commit smart commit with changes', async () => {
      const git = require('../cli/git');
      git.analyzeDiff.mockReturnValueOnce({ files: 3, additions: 10, deletions: 5 });
      git.formatDiffSummary.mockReturnValueOnce('3 files changed');
      await lineHandler('/commit');
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('3 files changed');
    });
  });
});
