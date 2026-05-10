/**
 * src/tools/mock/index.ts — Mock Tool Implementations
 *
 * Provides safe, no-side-effect mock implementations of system tools
 * (filesystem, shell, Git, SSH, Docker) for terminal testing.
 * All operations are simulated and state is kept in memory.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  content: string;
  size: number;
  modified: number;
}

export interface GitStatus {
  branch: string;
  clean: boolean;
  staged: string[];
  unstaged: string[];
  untracked: string[];
  ahead: number;
  behind: number;
}

export interface GitDiff {
  file: string;
  added: number;
  removed: number;
  patch: string;
}

export interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  status: 'running' | 'stopped' | 'paused';
  ports: string[];
}

export interface SSHConnection {
  host: string;
  user: string;
  port: number;
  connected: boolean;
}

// ─── Mock FileSystem ──────────────────────────────────────────────────────────

export class MockFileSystem {
  private files: Map<string, FileEntry> = new Map();
  private cwd: string = '/home/project';

  /** Add a simulated file to the virtual filesystem */
  addFile(path: string, content: string): void {
    const name = path.split('/').pop() || path;
    this.files.set(path, {
      name,
      path,
      content,
      size: content.length,
      modified: Date.now(),
    });
  }

  /** Read a file's content */
  readFile(path: string): string | null {
    const entry = this.files.get(path);
    return entry ? entry.content : null;
  }

  /** Write content to a file */
  writeFile(path: string, content: string): void {
    this.addFile(path, content);
  }

  /** Delete a file */
  deleteFile(path: string): boolean {
    return this.files.delete(path);
  }

  /** List files in a directory */
  listDir(dirPath: string = '/'): FileEntry[] {
    const result: FileEntry[] = [];
    const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
    for (const [path, entry] of this.files) {
      if (path.startsWith(prefix)) {
        result.push(entry);
      }
    }
    return result;
  }

  /** Get current working directory */
  getCwd(): string {
    return this.cwd;
  }

  /** Set current working directory */
  setCwd(path: string): void {
    this.cwd = path;
  }

  /** Check if a file exists */
  exists(path: string): boolean {
    return this.files.has(path);
  }

  /** Get total file count */
  getFileCount(): number {
    return this.files.size;
  }

  /** Reset filesystem */
  reset(): void {
    this.files.clear();
    this.cwd = '/home/project';
  }
}

// ─── Mock Shell ───────────────────────────────────────────────────────────────

export class MockShell {
  private responses: Map<string, ShellResult> = new Map();
  private history: string[] = [];

  /** Set a predefined response for a command */
  setResponse(command: string, result: ShellResult): void {
    this.responses.set(command, result);
  }

  /** Simulate running a command */
  run(command: string): ShellResult {
    this.history.push(command);

    const response = this.responses.get(command);
    if (response) return response;

    // Default: success with empty output
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /** Get command history */
  getHistory(): readonly string[] {
    return this.history;
  }

  /** Get the last run command */
  getLastCommand(): string | undefined {
    return this.history[this.history.length - 1];
  }

  /** Reset shell history */
  reset(): void {
    this.history = [];
    this.responses.clear();
  }
}

// ─── Mock Git ─────────────────────────────────────────────────────────────────

export class MockGit {
  private status: GitStatus;
  private diffs: GitDiff[] = [];
  private branches: string[] = ['main', 'devel'];
  private remotes: string[] = ['origin'];
  private stashes: string[] = [];

  constructor(branch: string = 'feat/telemetry-refactor') {
    this.status = {
      branch,
      clean: true,
      staged: [],
      unstaged: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    };
  }

  /** Get git status */
  getStatus(): GitStatus {
    return { ...this.status };
  }

  /** Set git status */
  setStatus(status: Partial<GitStatus>): void {
    this.status = { ...this.status, ...status };
  }

  /** Simulate git diff */
  getDiff(): GitDiff[] {
    return [...this.diffs];
  }

  /** Add a simulated diff */
  addDiff(diff: GitDiff): void {
    this.diffs.push(diff);
  }

  /** Simulate git add */
  stage(...files: string[]): void {
    for (const file of files) {
      if (!this.status.staged.includes(file)) {
        this.status.staged.push(file);
      }
    }
  }

  /** Simulate git commit */
  commit(message: string): ShellResult {
    if (this.status.staged.length === 0) {
      return { stdout: '', stderr: 'nothing to commit', exitCode: 1 };
    }
    this.status.staged = [];
    this.status.clean = true;
    return { stdout: `[${this.status.branch} abc1234] ${message}`, stderr: '', exitCode: 0 };
  }

  /** Simulate git push */
  push(): ShellResult {
    this.status.ahead = 0;
    return { stdout: 'Pushed to origin', stderr: '', exitCode: 0 };
  }

  /** Simulate git branch */
  getBranches(): string[] {
    return [...this.branches];
  }

  /** Simulate git checkout */
  checkout(branch: string): ShellResult {
    if (!this.branches.includes(branch)) {
      return { stdout: '', stderr: `error: pathspec '${branch}' did not match`, exitCode: 1 };
    }
    this.status.branch = branch;
    return { stdout: `Switched to branch '${branch}'`, stderr: '', exitCode: 0 };
  }

  /** Simulate git stash */
  stash(): void {
    this.stashes.push(`stash@{${this.stashes.length}}`);
  }

  /** Simulate git stash pop */
  stashPop(): ShellResult {
    if (this.stashes.length === 0) {
      return { stdout: '', stderr: 'No stash entries found.', exitCode: 1 };
    }
    this.stashes.pop();
    return { stdout: 'Dropped refs/stash', stderr: '', exitCode: 0 };
  }

  /** Reset mock state */
  reset(): void {
    this.status = {
      branch: 'feat/telemetry-refactor',
      clean: true,
      staged: [],
      unstaged: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    };
    this.diffs = [];
    this.stashes = [];
  }
}

// ─── Mock SSH ─────────────────────────────────────────────────────────────────

export class MockSSH {
  private connections: Map<string, SSHConnection> = new Map();
  private executedCommands: Array<{ host: string; command: string }> = [];

  /** Add a simulated host */
  addHost(host: string, user: string = 'root', port: number = 22): void {
    this.connections.set(host, {
      host,
      user,
      port,
      connected: false,
    });
  }

  /** Simulate SSH connection */
  connect(host: string): SSHConnection | null {
    const conn = this.connections.get(host);
    if (conn) {
      conn.connected = true;
      this.connections.set(host, conn);
      return conn;
    }
    return null;
  }

  /** Simulate SSH disconnect */
  disconnect(host: string): void {
    const conn = this.connections.get(host);
    if (conn) {
      conn.connected = false;
    }
  }

  /** Simulate remote command execution */
  exec(host: string, command: string): ShellResult {
    const conn = this.connections.get(host);
    if (!conn || !conn.connected) {
      return { stdout: '', stderr: 'Connection refused', exitCode: 1 };
    }
    this.executedCommands.push({ host, command });
    return { stdout: `[${host}] ${command}`, stderr: '', exitCode: 0 };
  }

  /** Get executed commands */
  getExecutedCommands(): Array<{ host: string; command: string }> {
    return [...this.executedCommands];
  }

  /** Check if connected to a host */
  isConnected(host: string): boolean {
    return this.connections.get(host)?.connected ?? false;
  }

  /** Reset */
  reset(): void {
    this.connections.clear();
    this.executedCommands = [];
  }
}

// ─── Mock Docker ──────────────────────────────────────────────────────────────

export class MockDocker {
  private containers: Map<string, DockerContainer> = new Map();
  private images: string[] = [];

  /** Add a simulated container */
  addContainer(container: DockerContainer): void {
    this.containers.set(container.id, container);
  }

  /** List containers */
  listContainers(status?: string): DockerContainer[] {
    const all = Array.from(this.containers.values());
    if (status) {
      return all.filter((c) => c.status === status);
    }
    return all;
  }

  /** Start a container */
  start(containerId: string): ShellResult {
    const container = this.containers.get(containerId);
    if (!container) {
      return { stdout: '', stderr: 'No such container', exitCode: 1 };
    }
    container.status = 'running';
    return { stdout: containerId, stderr: '', exitCode: 0 };
  }

  /** Stop a container */
  stop(containerId: string): ShellResult {
    const container = this.containers.get(containerId);
    if (!container) {
      return { stdout: '', stderr: 'No such container', exitCode: 1 };
    }
    container.status = 'stopped';
    return { stdout: containerId, stderr: '', exitCode: 0 };
  }

  /** Add an image */
  addImage(image: string): void {
    this.images.push(image);
  }

  /** List images */
  listImages(): string[] {
    return [...this.images];
  }

  /** Reset */
  reset(): void {
    this.containers.clear();
    this.images = [];
  }
}
