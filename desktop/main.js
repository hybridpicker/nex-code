/**
 * desktop/main.js — Electron Main Process
 *
 * Spawns the real nex-code CLI via --server mode (JSON-lines IPC).
 * No project → welcome screen. Open project → nex-code --server.
 */

"use strict";

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const readline = require("readline");

let mainWindow = null;
let serverProcess = null;
let serverReady = false;
let projectName = null;
let projectBranch = null;

function getNexCliPath() {
  if (app.isPackaged) return path.join(process.resourcesPath, "nex-code-cli", "nex-code.js");
  return path.join(__dirname, "..", "dist", "nex-code.js");
}

function spawnServer(dirPath) {
  killServer();
  const cliPath = getNexCliPath();
  if (!fs.existsSync(cliPath)) {
    send("nex:server-error", { message: "nex-code CLI not found. Run npm run build in project root." });
    return;
  }
  serverProcess = spawn("node", [cliPath, "--server"], {
    cwd: dirPath, stdio: ["pipe", "pipe", "pipe"],
    env: Object.assign({}, process.env, { NEX_SERVER: "1", FORCE_COLOR: "0" }),
  });
  serverReady = false;
  const rl = readline.createInterface({ input: serverProcess.stdout, terminal: false });
  rl.on("line", function (line) {
    try { handleMsg(JSON.parse(line.trim())); } catch (e) {}
  });
  serverProcess.stderr.on("data", function (d) {
    send("nex:server-log", { text: d.toString().trim() });
  });
  serverProcess.on("close", function (code) {
    serverProcess = null; serverReady = false;
    send("nex:server-closed", { code: code });
  });
  serverProcess.on("error", function (e) {
    send("nex:server-error", { message: e.message });
  });
}

function killServer() {
  if (serverProcess) {
    try { serverProcess.kill(); } catch (e) {}
    serverProcess = null;
    serverReady = false;
  }
}

function handleMsg(msg) {
  if (msg.type === "ready") { serverReady = true; send("nex:server-ready", {}); return; }
  if (msg.type === "token") { send("nex:server-token", msg); return; }
  if (msg.type === "tool_start") { send("nex:server-tool-start", msg); return; }
  if (msg.type === "tool_end") { send("nex:server-tool-end", msg); return; }
  if (msg.type === "confirm_request") { send("nex:server-confirm", msg); return; }
  if (msg.type === "done") { send("nex:server-done", msg); return; }
  if (msg.type === "error") { send("nex:server-error", msg); return; }
  
  // Fallback for other message types
  var ch = "nex:server-" + msg.type.replace(/_/g, "-");
  send(ch, msg);
}

function send(ch, data) {
  try { if (mainWindow && !mainWindow.webContents.isDestroyed()) mainWindow.webContents.send(ch, data); } catch (e) {}
}

function sendToServer(obj) {
  if (!serverProcess) {
    send("nex:server-error", { message: "No project open. Use File → Open Project." });
    return;
  }
  serverProcess.stdin.write(JSON.stringify(obj) + "\n");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 1000, minWidth: 1200, minHeight: 800,
    title: "nex-code", backgroundColor: "#0D1117",
    titleBarStyle: "hiddenInset", vibrancy: "dark", visualEffectState: "active",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    show: false,
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.once("ready-to-show", function () {
    mainWindow.show();
    if (process.argv.includes("--dev")) mainWindow.webContents.openDevTools({ mode: "detach" });
  });
  mainWindow.on("closed", function () { killServer(); mainWindow = null; });

  var isMac = process.platform === "darwin";
  var template = [];
  if (isMac) template.push({ label: "nex-code", submenu: [{ role: "about" }, { type: "separator" }, { role: "quit" }] });
  template.push({ label: "File", submenu: [{ label: "Open Project...", accelerator: "CmdOrCtrl+O", click: openDialog }, { type: "separator" }, { role: "quit" }] });
  template.push({ label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { role: "togglefullscreen" }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openDialog() {
  var r = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"], title: "Open Project" });
  if (!r.canceled && r.filePaths.length > 0) openProject(r.filePaths[0]);
}

function openProject(dirPath) {
  projectName = path.basename(dirPath);
  projectBranch = null;
  try {
    var hp = path.join(dirPath, ".git", "HEAD");
    if (fs.existsSync(hp)) projectBranch = fs.readFileSync(hp, "utf-8").trim().replace("ref: refs/heads/", "");
  } catch (e) {}
  spawnServer(dirPath);
  send("nex:project-opened", { project: projectName, branch: projectBranch || "unknown", path: dirPath });
}

ipcMain.handle("nex:get-state", function () {
  return { project: projectName, branch: projectBranch, serverReady: serverReady };
});
ipcMain.handle("nex:open-project", async function () { await openDialog(); return null; });
ipcMain.on("nex:command", function (_e, cmd) { sendToServer({ type: "chat", id: "c-" + Date.now(), text: cmd.trim() }); });
ipcMain.on("nex:confirm-answer", function (_e, d) { sendToServer({ type: "confirm", id: d.id, answer: d.answer }); });
ipcMain.on("nex:cancel", function () { sendToServer({ type: "cancel" }); });
ipcMain.on("nex:clear", function () { sendToServer({ type: "clear" }); });
ipcMain.on("nex:open-external", function (_e, url) { shell.openExternal(url); });

app.whenReady().then(createWindow);
app.on("window-all-closed", function () { killServer(); if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", killServer);
