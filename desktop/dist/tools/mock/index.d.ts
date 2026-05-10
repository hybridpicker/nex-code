/**
 * src/tools/mock/index.ts — Mock Tool Implementations
 *
 * Provides safe, no-side-effect mock implementations of system tools
 * (filesystem, shell, Git, SSH, Docker) for terminal testing.
 * All operations are simulated and state is kept in memory.
 */
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
export declare class MockFileSystem {
    private files;
    private cwd;
    /** Add a simulated file to the virtual filesystem */
    addFile(path: string, content: string): void;
    /** Read a file's content */
    readFile(path: string): string | null;
    /** Write content to a file */
    writeFile(path: string, content: string): void;
    /** Delete a file */
    deleteFile(path: string): boolean;
    /** List files in a directory */
    listDir(dirPath?: string): FileEntry[];
    /** Get current working directory */
    getCwd(): string;
    /** Set current working directory */
    setCwd(path: string): void;
    /** Check if a file exists */
    exists(path: string): boolean;
    /** Get total file count */
    getFileCount(): number;
    /** Reset filesystem */
    reset(): void;
}
export declare class MockShell {
    private responses;
    private history;
    /** Set a predefined response for a command */
    setResponse(command: string, result: ShellResult): void;
    /** Simulate running a command */
    run(command: string): ShellResult;
    /** Get command history */
    getHistory(): readonly string[];
    /** Get the last run command */
    getLastCommand(): string | undefined;
    /** Reset shell history */
    reset(): void;
}
export declare class MockGit {
    private status;
    private diffs;
    private branches;
    private remotes;
    private stashes;
    constructor(branch?: string);
    /** Get git status */
    getStatus(): GitStatus;
    /** Set git status */
    setStatus(status: Partial<GitStatus>): void;
    /** Simulate git diff */
    getDiff(): GitDiff[];
    /** Add a simulated diff */
    addDiff(diff: GitDiff): void;
    /** Simulate git add */
    stage(...files: string[]): void;
    /** Simulate git commit */
    commit(message: string): ShellResult;
    /** Simulate git push */
    push(): ShellResult;
    /** Simulate git branch */
    getBranches(): string[];
    /** Simulate git checkout */
    checkout(branch: string): ShellResult;
    /** Simulate git stash */
    stash(): void;
    /** Simulate git stash pop */
    stashPop(): ShellResult;
    /** Reset mock state */
    reset(): void;
}
export declare class MockSSH {
    private connections;
    private executedCommands;
    /** Add a simulated host */
    addHost(host: string, user?: string, port?: number): void;
    /** Simulate SSH connection */
    connect(host: string): SSHConnection | null;
    /** Simulate SSH disconnect */
    disconnect(host: string): void;
    /** Simulate remote command execution */
    exec(host: string, command: string): ShellResult;
    /** Get executed commands */
    getExecutedCommands(): Array<{
        host: string;
        command: string;
    }>;
    /** Check if connected to a host */
    isConnected(host: string): boolean;
    /** Reset */
    reset(): void;
}
export declare class MockDocker {
    private containers;
    private images;
    /** Add a simulated container */
    addContainer(container: DockerContainer): void;
    /** List containers */
    listContainers(status?: string): DockerContainer[];
    /** Start a container */
    start(containerId: string): ShellResult;
    /** Stop a container */
    stop(containerId: string): ShellResult;
    /** Add an image */
    addImage(image: string): void;
    /** List images */
    listImages(): string[];
    /** Reset */
    reset(): void;
}
