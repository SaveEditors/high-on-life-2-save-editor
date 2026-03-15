"use strict";

const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

async function readEntry(filePath, rootPath = "") {
  const bytes = await fs.readFile(filePath);
  return {
    name: path.basename(filePath),
    path: filePath,
    rootPath,
    relativePath: rootPath ? path.relative(rootPath, filePath) : path.basename(filePath),
    bytes: Array.from(bytes)
  };
}

async function collectFolderEntries(rootPath) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else {
        out.push(await readEntry(fullPath, rootPath));
      }
    }
  }
  await walk(rootPath);
  return out;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1160,
    minHeight: 720,
    backgroundColor: "#0b0f14",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("hol2:pick-files", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Save files", extensions: ["sav", "dat", "bin"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map((filePath) => readEntry(filePath)));
});

ipcMain.handle("hol2:pick-folder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return [];
  return collectFolderEntries(result.filePaths[0]);
});

ipcMain.handle("hol2:save-with-backup", async (_event, payload) => {
  const sourcePath = payload?.sourcePath;
  if (!sourcePath) return { path: "", backupPath: "" };
  const modifiedBytes = Buffer.from(payload?.bytes || []);
  const originalBytes = await fs.readFile(sourcePath);

  const dir = path.dirname(sourcePath);
  const base = path.parse(sourcePath).name;
  let suffix = 1;
  let backupPath = "";
  while (!backupPath) {
    const candidate = path.join(dir, `${base}.bak${suffix}`);
    try {
      await fs.access(candidate);
      suffix += 1;
    } catch {
      backupPath = candidate;
    }
  }
  await fs.writeFile(backupPath, originalBytes);
  await fs.writeFile(sourcePath, modifiedBytes);
  return { path: sourcePath, backupPath };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
