/**
 * desktop/preload.js — Secure IPC Bridge
 *
 * Exposes a minimal, typed API to the renderer process via
 * contextBridge. All communication with the main process goes
 * through well-defined channels — no raw ipcRenderer in the UI.
 */

"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexAPI", {
  // ─── State ──────────────────────────────────────────────────
  getState: () => ipcRenderer.invoke("nex:get-state"),
  getDemoData: () => ipcRenderer.invoke("nex:get-demo-data"),

  // ─── Commands ───────────────────────────────────────────────
  sendCommand: (command) => ipcRenderer.send("nex:command", command),

  // ─── Project ────────────────────────────────────────────────
  openProject: () => ipcRenderer.invoke("nex:open-project"),

  // ─── External Links ─────────────────────────────────────────
  openExternal: (url) => ipcRenderer.send("nex:open-external", url),

  // ─── Window Controls ────────────────────────────────────────
  minimizeWindow: () => ipcRenderer.send("nex:window-minimize"),
  maximizeWindow: () => ipcRenderer.send("nex:window-maximize"),
  closeWindow: () => ipcRenderer.send("nex:window-close"),

  // ─── Event Listeners ────────────────────────────────────────
  onProjectOpened: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("nex:project-opened", handler);
    return () => ipcRenderer.removeListener("nex:project-opened", handler);
  },

  onWorkspaceScan: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("nex:workspace-scan", handler);
    return () => ipcRenderer.removeListener("nex:workspace-scan", handler);
  },

  onAgenticNode: (callback) => {
    const handler = (_event, node) => callback(node);
    ipcRenderer.on("nex:agentic-node", handler);
    return () => ipcRenderer.removeListener("nex:agentic-node", handler);
  },

  onAgentThinking: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("nex:agent-thinking", handler);
    return () => ipcRenderer.removeListener("nex:agent-thinking", handler);
  },

  onBackendMessage: (callback) => {
    const handler = (_event, msg) => callback(msg);
    ipcRenderer.on("nex:backend-message", handler);
    return () => ipcRenderer.removeListener("nex:backend-message", handler);
  },

  onBackendLog: (callback) => {
    const handler = (_event, log) => callback(log);
    ipcRenderer.on("nex:backend-log", handler);
    return () => ipcRenderer.removeListener("nex:backend-log", handler);
  },

  onBackendError: (callback) => {
    const handler = (_event, err) => callback(err);
    ipcRenderer.on("nex:backend-error", handler);
    return () => ipcRenderer.removeListener("nex:backend-error", handler);
  },

  onFocusCommand: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("nex:focus-command", handler);
    return () => ipcRenderer.removeListener("nex:focus-command", handler);
  },

  onCommand: (callback) => {
    const handler = (_event, cmd) => callback(cmd);
    ipcRenderer.on("nex:command", handler);
    return () => ipcRenderer.removeListener("nex:command", handler);
  },
});
