import { app, BrowserWindow } from "electron";
import * as path from "path";
import { ipcMain } from "electron";
import { dialog } from "electron";
import { FileReader } from "../classes/FileReader";
import { logger } from "../misc/logger";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nativeWindowOpen: true,
            nodeIntegration: true,
            contextIsolation: false
        },
        width: 800
    });

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, "../../index.html"));

    // Open the DevTools.
    mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", () => {
    createWindow();

    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

ipcMain.on("choose-file", async (event, args) => {
    if (!mainWindow) throw new Error("mainWindow not loaded yet");
    const files = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile"],
        filters: [{ name: "File CSV", extensions: ["csv"] }]
    });
    if (!files.filePaths.every(e => e.endsWith(".csv"))) {
        return event.reply("bad-file", "Il file deve avere estensione .csv");
    } else if (files.canceled || files.filePaths.length < 1) return;

    logger.debug("File ok");
    event.reply("file-ok", files.filePaths[0]);
});

ipcMain.on("file", async (event, filePath) => {
    logger.debug("Invio file...");
    const f = new FileReader(filePath);
    await f.csvToJson();
    event.reply("file", { columnNames: f.columnNames, jsonContent: f.jsonContent });
    logger.debug("File inviato");
});
