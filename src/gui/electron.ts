import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import * as path from "path";
import { FileReader } from "../classes/FileReader";
import { logger } from "../misc/logger";
import { readFileSync } from "fs";
import { TTS } from "../classes/TTS";
import { AnyObj } from "../classes/AnyObj";
import { Encoder } from "../classes/Encoder";
import moment from "moment";
import { listVoices } from "../misc/listVoices";

moment.locale("it");

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
    mainWindow.removeMenu();
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
    if (files.canceled) return;
    logger.info("Cartella di output: " + files.filePaths[0]);
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

interface ConversionArg {
    jsonContent: AnyObj[];
    ttsString: string;
    fileName: string;
    format: "mp3" | "wav";
    bitrate: number;
    sampleRate: number;
    volume: number;
    outputPath: string;
    multithreadedTTS: boolean;
    multithreadedEncoding: boolean;
}

ipcMain.on("start-conversion", async (event, arg) => {
    event.reply("conversion-status", { msg: "Inizio conversione..." });
    const startDate = moment();

    const {
        jsonContent,
        ttsString,
        fileName,
        format,
        bitrate,
        sampleRate,
        volume,
        outputPath,
        multithreadedTTS,
        multithreadedEncoding
    }: ConversionArg = arg;

    const correctPath = path.join(outputPath);

    // vado di fiducia, non stai a modificare l'html quindi non valido i tuoi input
    const tts = new TTS();
    // DEBUG!! Considera "format", ora è hard coded wav
    const encoder = new Encoder({ bitrate, sampleRate, volume } as any);

    event.reply("conversion-status", { msg: "Pulisco cartella temporanea..." });
    await encoder.clearTmpDir();

    event.reply("conversion-status", { msg: "TTS in corso... (potrebbe metterci un po')" });

    if (multithreadedTTS) {
        logger.info("TTS multithread");
        await tts.speakAllMultithread(format, ttsString, fileName, jsonContent);
    } else {
        logger.info("TTS singlethread");
        tts.onTTSStart.on("tts-start", str => {
            event.reply("conversion-status", { msg: str });
        });
        await tts.speakAll(ttsString, fileName, jsonContent, format);
    }

    event.reply("conversion-status", { msg: "Codifica in corso... (potrebbe metterci un po')" });

    if (multithreadedEncoding) {
        logger.info("Codifica multithread");
        await encoder.encodeAllMultithread(undefined, correctPath);
    } else {
        logger.info("Codifica singlethread");
        encoder.onConversionStart.on("file-start", str => {
            event.reply("conversion-status", { msg: str });
        });
        await encoder.encodeAll(undefined, correctPath);
    }

    // Codifica terminata, mentre vengono eliminati i temp file l'utente può guardare quelli finiti
    shell.openPath(correctPath);

    event.reply("conversion-status", { msg: "Pulisco cartella temporanea..." });
    // await encoder.clearTmpDir();

    const sDiff = moment().diff(startDate, "s");
    event.reply("conversion-status", {
        msg: `Finito in ${sDiff} secondi! Ecco i tuoi file salvati in "${correctPath}"`,
        finished: true
    });

    logger.info("TTS e codifica terminati");
});

ipcMain.on("get-voices", async event => {
    event.reply("voices", await listVoices("Loquendo Roberto"));
});

ipcMain.on("close", e => {
    app.quit();
});
