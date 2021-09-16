import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import { FileReader } from "../classes/FileReader";
import { logger } from "../misc/logger";
import { readFileSync } from "fs";
import { TTS } from "../classes/TTS";
import { AnyObj } from "../classes/AnyObj";
import { Encoder } from "../classes/Encoder";

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
        width: 800,
        show: false
    });
    mainWindow.maximize();
    mainWindow.show();

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(process.cwd(), "./index.html"));

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
    event.reply("file", {
        fileName: path.basename(filePath),
        columnNames: f.columnNames,
        jsonContent: f.jsonContent
    });
    logger.debug("File inviato");
});

ipcMain.on("output-path", async (event, args) => {
    if (!mainWindow) throw new Error("mainWindow not loaded yet");
    const files = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "createDirectory"]
    });
    logger.debug("Output directory: " + files.filePaths[0]);
    event.reply("output-path-ok", { outputPath: files.filePaths[0] });
});

ipcMain.on("latest-commit", event => {
    let commit = "-";
    try {
        commit = readFileSync(path.join(process.cwd(), "latest_commit.txt"), {
            encoding: "utf-8"
        });
    } catch (err) {
        logger.warn(err);
    }
    event.reply("latest-commit", commit);
});

function formatVariables(str: string, row: AnyObj): string {
    const matches = str.match(/\{(.*?)\}/g);
    if (!matches) return str;
    for (const match of matches) {
        const m = match.replace(/\{\ *|\ *}/g, "");
        if (m in <any>row) {
            str = str.replace(match, row[<any>m]);
        }
    }
    return str;
}

interface ConversionArg {
    jsonContent: AnyObj[];
    ttsString: string;
    fileName: string;
    format: "mp3" | "wav";
    bitrate: number;
    sampleRate: number;
    volume: number;
    outputPath: string;
}

ipcMain.on("start-conversion", async (event, arg) => {
    const {
        jsonContent,
        ttsString,
        fileName,
        format,
        bitrate,
        sampleRate,
        volume,
        outputPath
    }: ConversionArg = arg;
    const correctPath = path.join(outputPath);
    console.log(arg);
    // vado di fiducia, non stai a modificare l'html quindi non valido i tuoi input
    const tts = new TTS();
    // DEBUG!! Considera "format", ora è hard coded wav
    const encoder = new Encoder({ bitrate, sampleRate, volume } as any);
    await encoder.clearTmpDir();

    event.reply("conversion-status", "Inizio TTS");
    for (let i = 0; i < jsonContent.length; i++) {
        event.reply("conversion-status", `TTS... (Riga ${i + 1}/${jsonContent.length})`);
        const formattedStr = formatVariables(ttsString, jsonContent[i]);
        const formattedTitle = formatVariables(fileName, jsonContent[i]);
        await tts.speak(formattedStr, formattedTitle);
    }

    event.reply(
        "conversion-status",
        "Codifica dei file audio... (potrebbe richiedere molto tempo)"
    );
    await encoder.encodeAll(undefined, correctPath);

    event.reply("conversion-status", "Pulisco cartella temporanea...");
    await encoder.clearTmpDir();
    event.reply("conversion-status", `Finito! Ecco i tuoi file salvati in "${correctPath}"`);
    shell.openPath(correctPath);
});

ipcMain.on("close", e => {
    app.quit();
});
