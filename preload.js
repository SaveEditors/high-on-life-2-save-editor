"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("saveEditorDesktop", {
  pickFiles: () => ipcRenderer.invoke("hol2:pick-files"),
  pickFolder: () => ipcRenderer.invoke("hol2:pick-folder"),
  saveWithBackupAndOverwrite: (payload) => ipcRenderer.invoke("hol2:save-with-backup", payload)
});
