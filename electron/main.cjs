const { app, BrowserWindow, shell, ipcMain, net } = require("electron");
const path = require("node:path");
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 650,
    backgroundColor: "#101018",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, "../dist/index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}
ipcMain.handle("novelhub:fetch-page", async (_event, value) => {
  let target;
  try { target = new URL(value); } catch { throw new Error("Invalid source URL"); }
  if (target.protocol !== "https:" && target.protocol !== "http:") throw new Error("Only HTTP and HTTPS sources are allowed");
  const response = await net.fetch(target.href, { headers: { "User-Agent": "NovelHub/1.0 (desktop novel reader)" } });
  return { ok: response.ok, status: response.status, html: await response.text() };
});
app.whenReady().then(() => { createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
