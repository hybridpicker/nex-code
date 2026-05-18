"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("nexAPI", {
  getState: () => ipcRenderer.invoke("nex:get-state"),
  getModelState: () => ipcRenderer.invoke("nex:get-model-state"),
  setActiveModel: (spec) => ipcRenderer.invoke("nex:set-active-model", spec),
  getGitState: () => ipcRenderer.invoke("nex:get-git-state"),
  checkoutBranch: (branchName) => ipcRenderer.invoke("nex:checkout-branch", branchName),
  createBranch: (branchName) => ipcRenderer.invoke("nex:create-branch", branchName),
  sendCommand: (cmd) => ipcRenderer.send("nex:command", cmd),
  sendConfirm: (id, answer) => ipcRenderer.send("nex:confirm-answer", { id: id, answer: answer }),
  sendCancel: () => ipcRenderer.send("nex:cancel"),
  sendClear: () => ipcRenderer.send("nex:clear"),
  openProject: () => ipcRenderer.invoke("nex:open-project"),
  openProjectPath: (projectPath) => ipcRenderer.invoke("nex:open-project-path", projectPath),
  openProjectFolder: () => ipcRenderer.invoke("nex:open-project-folder"),
  openExternal: (url) => ipcRenderer.send("nex:open-external", url),
  minimizeWindow: function () { ipcRenderer.send("nex:window-minimize"); },
  maximizeWindow: function () { ipcRenderer.send("nex:window-maximize"); },
  closeWindow: function () { ipcRenderer.send("nex:window-close"); },

  onServerReady: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-ready", h); return function () { ipcRenderer.removeListener("nex:server-ready", h); }; },
  onServerToken: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-token", h); return function () { ipcRenderer.removeListener("nex:server-token", h); }; },
  onServerToolStart: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-tool-start", h); return function () { ipcRenderer.removeListener("nex:server-tool-start", h); }; },
  onServerToolEnd: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-tool-end", h); return function () { ipcRenderer.removeListener("nex:server-tool-end", h); }; },
  onServerConfirm: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-confirm", h); return function () { ipcRenderer.removeListener("nex:server-confirm", h); }; },
  onServerDone: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-done", h); return function () { ipcRenderer.removeListener("nex:server-done", h); }; },
  onServerError: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-error", h); return function () { ipcRenderer.removeListener("nex:server-error", h); }; },
  onServerLog: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-log", h); return function () { ipcRenderer.removeListener("nex:server-log", h); }; },
  onServerClosed: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:server-closed", h); return function () { ipcRenderer.removeListener("nex:server-closed", h); }; },
  onProjectOpened: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:project-opened", h); return function () { ipcRenderer.removeListener("nex:project-opened", h); }; },
  onModelState: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:model-state", h); return function () { ipcRenderer.removeListener("nex:model-state", h); }; },
  onGitState: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:git-state", h); return function () { ipcRenderer.removeListener("nex:git-state", h); }; },
  onFocusCommand: function (cb) { var h = function () { cb(); }; ipcRenderer.on("nex:focus-command", h); return function () { ipcRenderer.removeListener("nex:focus-command", h); }; },
  onPlatform: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:platform", h); return function () { ipcRenderer.removeListener("nex:platform", h); }; },
  
  // High-level events for app.js
  onStateUpdated: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:state-updated", h); return function () { ipcRenderer.removeListener("nex:state-updated", h); }; },
  onAgenticNode: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:agentic-node", h); return function () { ipcRenderer.removeListener("nex:agentic-node", h); }; },
  onAgentThinking: function (cb) { var h = function (e, d) { cb(d); }; ipcRenderer.on("nex:agent-thinking", h); return function () { ipcRenderer.removeListener("nex:agent-thinking", h); }; },
});
