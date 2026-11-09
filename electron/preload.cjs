const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("novelHub", {
  fetchPage: (url) => ipcRenderer.invoke("novelhub:fetch-page", url)
});
