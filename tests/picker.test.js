const { pickFromList } = require('../cli/picker');

describe('picker.js', () => {
  describe('pickFromList()', () => {
    let mockRl;

    beforeEach(() => {
      mockRl = {
        pause: jest.fn(),
        resume: jest.fn(),
      };
    });

    it('resolves null when items list is empty', async () => {
      const result = await pickFromList(mockRl, [], { title: 'Test' });
      expect(result).toBeNull();
    });

    it('resolves null when all items are headers', async () => {
      const items = [
        { label: 'Group A', value: null, isHeader: true },
        { label: 'Group B', value: null, isHeader: true },
      ];
      const result = await pickFromList(mockRl, items, { title: 'Test' });
      expect(result).toBeNull();
    });

    it('selects item on Enter keypress', async () => {
      const items = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ];

      const originalOn = process.stdin.on;
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;
      const originalIsTTY = process.stdin.isTTY;
      const originalIsRaw = process.stdin.isRaw;
      const originalWrite = process.stdout.write;
      const originalRows = process.stdout.rows;

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === 'keypress') keypressHandler = handler;
        return process.stdin;
      });
      process.stdin.removeListener = jest.fn();

      const promise = pickFromList(mockRl, items, { title: 'Test' });

      if (keypressHandler) {
        keypressHandler(null, { name: 'return' });
      }

      const result = await promise;
      expect(result).toBe('a');

      process.stdin.on = originalOn;
      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.isRaw = originalIsRaw;
      process.stdout.write = originalWrite;
      process.stdout.rows = originalRows;
    });

    it('resolves null on Escape keypress', async () => {
      const items = [
        { label: 'Option A', value: 'a' },
      ];

      const originalOn = process.stdin.on;
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;
      const originalIsTTY = process.stdin.isTTY;
      const originalIsRaw = process.stdin.isRaw;
      const originalWrite = process.stdout.write;
      const originalRows = process.stdout.rows;

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === 'keypress') keypressHandler = handler;
        return process.stdin;
      });
      process.stdin.removeListener = jest.fn();

      const promise = pickFromList(mockRl, items, { title: 'Test' });

      if (keypressHandler) {
        keypressHandler(null, { name: 'escape' });
      }

      const result = await promise;
      expect(result).toBeNull();

      process.stdin.on = originalOn;
      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.isRaw = originalIsRaw;
      process.stdout.write = originalWrite;
      process.stdout.rows = originalRows;
    });

    it('navigates down and selects second item', async () => {
      const items = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
        { label: 'Option C', value: 'c' },
      ];

      const originalOn = process.stdin.on;
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;
      const originalIsTTY = process.stdin.isTTY;
      const originalIsRaw = process.stdin.isRaw;
      const originalWrite = process.stdout.write;
      const originalRows = process.stdout.rows;

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === 'keypress') keypressHandler = handler;
        return process.stdin;
      });
      process.stdin.removeListener = jest.fn();

      const promise = pickFromList(mockRl, items, { title: 'Test' });

      if (keypressHandler) {
        keypressHandler(null, { name: 'down' });
        keypressHandler(null, { name: 'return' });
      }

      const result = await promise;
      expect(result).toBe('b');

      process.stdin.on = originalOn;
      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.isRaw = originalIsRaw;
      process.stdout.write = originalWrite;
      process.stdout.rows = originalRows;
    });

    it('starts at current item when isCurrent is set', async () => {
      const items = [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b', isCurrent: true },
        { label: 'Option C', value: 'c' },
      ];

      const originalOn = process.stdin.on;
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;
      const originalIsTTY = process.stdin.isTTY;
      const originalIsRaw = process.stdin.isRaw;
      const originalWrite = process.stdout.write;
      const originalRows = process.stdout.rows;

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === 'keypress') keypressHandler = handler;
        return process.stdin;
      });
      process.stdin.removeListener = jest.fn();

      const promise = pickFromList(mockRl, items, { title: 'Test' });

      if (keypressHandler) {
        keypressHandler(null, { name: 'return' });
      }

      const result = await promise;
      expect(result).toBe('b');

      process.stdin.on = originalOn;
      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.isRaw = originalIsRaw;
      process.stdout.write = originalWrite;
      process.stdout.rows = originalRows;
    });

    it('skips header items during navigation', async () => {
      const items = [
        { label: 'Group', value: null, isHeader: true },
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' },
      ];

      const originalOn = process.stdin.on;
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;
      const originalIsTTY = process.stdin.isTTY;
      const originalIsRaw = process.stdin.isRaw;
      const originalWrite = process.stdout.write;
      const originalRows = process.stdout.rows;

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === 'keypress') keypressHandler = handler;
        return process.stdin;
      });
      process.stdin.removeListener = jest.fn();

      const promise = pickFromList(mockRl, items, { title: 'Test' });

      if (keypressHandler) {
        keypressHandler(null, { name: 'return' });
      }

      const result = await promise;
      expect(result).toBe('a');

      process.stdin.on = originalOn;
      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.isRaw = originalIsRaw;
      process.stdout.write = originalWrite;
      process.stdout.rows = originalRows;
    });

    it('pauses and resumes readline', async () => {
      const items = [{ label: 'Option A', value: 'a' }];

      const originalOn = process.stdin.on;
      const originalSetRawMode = process.stdin.setRawMode;
      const originalResume = process.stdin.resume;
      const originalIsTTY = process.stdin.isTTY;
      const originalIsRaw = process.stdin.isRaw;
      const originalWrite = process.stdout.write;
      const originalRows = process.stdout.rows;

      process.stdin.isTTY = true;
      process.stdin.isRaw = false;
      process.stdin.setRawMode = jest.fn();
      process.stdin.resume = jest.fn();
      process.stdout.write = jest.fn();
      process.stdout.rows = 30;

      let keypressHandler;
      process.stdin.on = jest.fn((event, handler) => {
        if (event === 'keypress') keypressHandler = handler;
        return process.stdin;
      });
      process.stdin.removeListener = jest.fn();

      const promise = pickFromList(mockRl, items, { title: 'Test' });

      expect(mockRl.pause).toHaveBeenCalled();

      if (keypressHandler) {
        keypressHandler(null, { name: 'return' });
      }

      await promise;
      expect(mockRl.resume).toHaveBeenCalled();

      process.stdin.on = originalOn;
      process.stdin.setRawMode = originalSetRawMode;
      process.stdin.resume = originalResume;
      process.stdin.isTTY = originalIsTTY;
      process.stdin.isRaw = originalIsRaw;
      process.stdout.write = originalWrite;
      process.stdout.rows = originalRows;
    });
  });
});
