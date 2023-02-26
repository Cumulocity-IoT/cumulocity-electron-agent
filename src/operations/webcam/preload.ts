// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  sendOffer: (offer: any) => ipcRenderer.send("offer", offer),
  handleAnswer: (callback: any) => ipcRenderer.on("answer", callback),
});
