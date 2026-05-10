"use strict";
/**
 * src/tools/mock/index.ts — Mock Tool Implementations
 *
 * Provides safe, no-side-effect mock implementations of system tools
 * (filesystem, shell, Git, SSH, Docker) for terminal testing.
 * All operations are simulated and state is kept in memory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockDocker = exports.MockSSH = exports.MockGit = exports.MockShell = exports.MockFileSystem = void 0;
// ─── Mock FileSystem ──────────────────────────────────────────────────────────
class MockFileSystem {
    files = new Map();
    cwd = '/home/project';
    /** Add a simulated file to the virtual filesystem */
    addFile(path, content) {
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
    readFile(path) {
        const entry = this.files.get(path);
        return entry ? entry.content : null;
    }
    /** Write content to a file */
    writeFile(path, content) {
        this.addFile(path, content);
    }
    /** Delete a file */
    deleteFile(path) {
        return this.files.delete(path);
    }
    /** List files in a directory */
    listDir(dirPath = '/') {
        const result = [];
        const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
        for (const [path, entry] of this.files) {
            if (path.startsWith(prefix)) {
                result.push(entry);
            }
        }
        return result;
    }
    /** Get current working directory */
    getCwd() {
        return this.cwd;
    }
    /** Set current working directory */
    setCwd(path) {
        this.cwd = path;
    }
    /** Check if a file exists */
    exists(path) {
        return this.files.has(path);
    }
    /** Get total file count */
    getFileCount() {
        return this.files.size;
    }
    /** Reset filesystem */
    reset() {
        this.files.clear();
        this.cwd = '/home/project';
    }
}
exports.MockFileSystem = MockFileSystem;
// ─── Mock Shell ───────────────────────────────────────────────────────────────
class MockShell {
    responses = new Map();
    history = [];
    /** Set a predefined response for a command */
    setResponse(command, result) {
        this.responses.set(command, result);
    }
    /** Simulate running a command */
    run(command) {
        this.history.push(command);
        const response = this.responses.get(command);
        if (response)
            return response;
        // Default: success with empty output
        return { stdout: '', stderr: '', exitCode: 0 };
    }
    /** Get command history */
    getHistory() {
        return this.history;
    }
    /** Get the last run command */
    getLastCommand() {
        return this.history[this.history.length - 1];
    }
    /** Reset shell history */
    reset() {
        this.history = [];
        this.responses.clear();
    }
}
exports.MockShell = MockShell;
// ─── Mock Git ─────────────────────────────────────────────────────────────────
class MockGit {
    status;
    diffs = [];
    branches = ['main', 'devel'];
    remotes = ['origin'];
    stashes = [];
    constructor(branch = 'feat/telemetry-refactor') {
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
    getStatus() {
        return { ...this.status };
    }
    /** Set git status */
    setStatus(status) {
        this.status = { ...this.status, ...status };
    }
    /** Simulate git diff */
    getDiff() {
        return [...this.diffs];
    }
    /** Add a simulated diff */
    addDiff(diff) {
        this.diffs.push(diff);
    }
    /** Simulate git add */
    stage(...files) {
        for (const file of files) {
            if (!this.status.staged.includes(file)) {
                this.status.staged.push(file);
            }
        }
    }
    /** Simulate git commit */
    commit(message) {
        if (this.status.staged.length === 0) {
            return { stdout: '', stderr: 'nothing to commit', exitCode: 1 };
        }
        this.status.staged = [];
        this.status.clean = true;
        return { stdout: `[${this.status.branch} abc1234] ${message}`, stderr: '', exitCode: 0 };
    }
    /** Simulate git push */
    push() {
        this.status.ahead = 0;
        return { stdout: 'Pushed to origin', stderr: '', exitCode: 0 };
    }
    /** Simulate git branch */
    getBranches() {
        return [...this.branches];
    }
    /** Simulate git checkout */
    checkout(branch) {
        if (!this.branches.includes(branch)) {
            return { stdout: '', stderr: `error: pathspec '${branch}' did not match`, exitCode: 1 };
        }
        this.status.branch = branch;
        return { stdout: `Switched to branch '${branch}'`, stderr: '', exitCode: 0 };
    }
    /** Simulate git stash */
    stash() {
        this.stashes.push(`stash@{${this.stashes.length}}`);
    }
    /** Simulate git stash pop */
    stashPop() {
        if (this.stashes.length === 0) {
            return { stdout: '', stderr: 'No stash entries found.', exitCode: 1 };
        }
        this.stashes.pop();
        return { stdout: 'Dropped refs/stash', stderr: '', exitCode: 0 };
    }
    /** Reset mock state */
    reset() {
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
exports.MockGit = MockGit;
// ─── Mock SSH ─────────────────────────────────────────────────────────────────
class MockSSH {
    connections = new Map();
    executedCommands = [];
    /** Add a simulated host */
    addHost(host, user = 'root', port = 22) {
        this.connections.set(host, {
            host,
            user,
            port,
            connected: false,
        });
    }
    /** Simulate SSH connection */
    connect(host) {
        const conn = this.connections.get(host);
        if (conn) {
            conn.connected = true;
            this.connections.set(host, conn);
            return conn;
        }
        return null;
    }
    /** Simulate SSH disconnect */
    disconnect(host) {
        const conn = this.connections.get(host);
        if (conn) {
            conn.connected = false;
        }
    }
    /** Simulate remote command execution */
    exec(host, command) {
        const conn = this.connections.get(host);
        if (!conn || !conn.connected) {
            return { stdout: '', stderr: 'Connection refused', exitCode: 1 };
        }
        this.executedCommands.push({ host, command });
        return { stdout: `[${host}] ${command}`, stderr: '', exitCode: 0 };
    }
    /** Get executed commands */
    getExecutedCommands() {
        return [...this.executedCommands];
    }
    /** Check if connected to a host */
    isConnected(host) {
        return this.connections.get(host)?.connected ?? false;
    }
    /** Reset */
    reset() {
        this.connections.clear();
        this.executedCommands = [];
    }
}
exports.MockSSH = MockSSH;
// ─── Mock Docker ──────────────────────────────────────────────────────────────
class MockDocker {
    containers = new Map();
    images = [];
    /** Add a simulated container */
    addContainer(container) {
        this.containers.set(container.id, container);
    }
    /** List containers */
    listContainers(status) {
        const all = Array.from(this.containers.values());
        if (status) {
            return all.filter((c) => c.status === status);
        }
        return all;
    }
    /** Start a container */
    start(containerId) {
        const container = this.containers.get(containerId);
        if (!container) {
            return { stdout: '', stderr: 'No such container', exitCode: 1 };
        }
        container.status = 'running';
        return { stdout: containerId, stderr: '', exitCode: 0 };
    }
    /** Stop a container */
    stop(containerId) {
        const container = this.containers.get(containerId);
        if (!container) {
            return { stdout: '', stderr: 'No such container', exitCode: 1 };
        }
        container.status = 'stopped';
        return { stdout: containerId, stderr: '', exitCode: 0 };
    }
    /** Add an image */
    addImage(image) {
        this.images.push(image);
    }
    /** List images */
    listImages() {
        return [...this.images];
    }
    /** Reset */
    reset() {
        this.containers.clear();
        this.images = [];
    }
}
exports.MockDocker = MockDocker;
//# sourceMappingURL=index.js.map