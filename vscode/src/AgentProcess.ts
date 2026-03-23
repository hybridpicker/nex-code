import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as vscode from "vscode";

export type AgentEvent =
  | { type: "ready" }
  | { type: "token"; id: string; text: string }
  | {
      type: "tool_start";
      id: string;
      tool: string;
      args: Record<string, unknown>;
    }
  | { type: "tool_end"; id: string; tool: string; summary: string; ok: boolean }
  | {
      type: "confirm_request";
      id: string;
      question: string;
      tool: string;
      critical: boolean;
    }
  | { type: "done"; id: string }
  | { type: "error"; id: string; message: string }
  | { type: "crashed"; code: number | null };

export class AgentProcess extends EventEmitter {
  private child: ChildProcess | null = null;
  private buffer = "";
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    super();
    this.outputChannel = outputChannel;
  }

  spawn(
    executable: string,
    model: string,
    cwd: string,
    env: Record<string, string>,
  ) {
    this.kill();
    this.buffer = "";

    const args = ["--server"];
    if (model) {
      args.push("--model", model);
    }

    this.child = spawn(executable, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout!.on("data", (data: Buffer) => this.handleChunk(data));
    this.child.stderr!.on("data", (data: Buffer) => {
      this.outputChannel.append(data.toString());
    });
    this.child.on("exit", (code) => {
      this.emit("event", { type: "crashed", code } as AgentEvent);
    });
  }

  private handleChunk(data: Buffer) {
    this.buffer += data.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop()!;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      try {
        const event = JSON.parse(trimmed) as AgentEvent;
        this.emit("event", event);
      } catch {
        this.outputChannel.appendLine("[parse error] " + trimmed);
      }
    }
  }

  send(text: string) {
    if (!this.child?.stdin) {
      return;
    }
    const msgId = "msg-" + Date.now();
    this.child.stdin.write(
      JSON.stringify({ type: "chat", id: msgId, text }) + "\n",
    );
    return msgId;
  }

  confirm(id: string, answer: boolean) {
    if (!this.child?.stdin) {
      return;
    }
    this.child.stdin.write(
      JSON.stringify({ type: "confirm", id, answer }) + "\n",
    );
  }

  cancel() {
    if (!this.child?.stdin) {
      return;
    }
    this.child.stdin.write(JSON.stringify({ type: "cancel" }) + "\n");
  }

  clearChat() {
    if (!this.child?.stdin) {
      return;
    }
    this.child.stdin.write(JSON.stringify({ type: "clear" }) + "\n");
  }

  kill() {
    if (this.child) {
      this.child.removeAllListeners();
      this.child.kill();
      this.child = null;
    }
  }

  isAlive(): boolean {
    return this.child !== null && !this.child.killed;
  }
}
