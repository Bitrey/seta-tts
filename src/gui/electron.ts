import { app, BrowserWindow, ipcMain, dialog, shell } from "electron";
import { existsSync, readFileSync } from "fs";
import path from "path";
import moment from "moment";
import { FileReader } from "../classes/FileReader";
import { logger } from "../misc/logger";
import { TTS } from "../classes/TTS";
import { AnyObj } from "../classes/AnyObj";
import { Encoder } from "../classes/Encoder";
import { getResPath } from "../misc/getResPath";
import { Voices } from "../classes/Voices";
import { Substitutions } from "../classes/Substitutions";
// i types di questo modulo sono orrendi quindi usa require
const { elevate } = require("node-windows");

moment.locale("it");

let mainWindow: BrowserWindow | null = null;
export const getMainWindow = () => mainWindow;

function createWindow() {
    logger.info("resPath: " + getResPath());
    // Create the browser window.
    mainWindow = new BrowserWindow({
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nativeWindowOpen: true,
            nodeIntegration: true,
            nodeIntegrationInWorker: true,
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
    bitrate: string;
    sampleRate: number;
    volume: number;
    outputPath: string;
    multithreadedTTS: boolean;
    multithreadedEncoding: boolean;
    voice: "Loquendo Roberto" | "Loquendo Paola";
}

let selectedVoice = "Loquendo Roberto";

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
        multithreadedEncoding,
        voice
    }: ConversionArg = arg;
    selectedVoice = voice || "Loquendo Roberto";

    logger.info(arg);

    const correctPath = path.join(outputPath);

    logger.info("outputPath " + outputPath);

    // vado di fiducia, non stai a modificare l'html quindi non valido i tuoi input
    const tts = new TTS();
    event.reply("conversion-status", { msg: "TTS istanziato" });

    // DEBUG!! Considera "format", ora è hard coded wav
    const encoder = new Encoder({ bitrate, channels: 1, sampleRate, volume });
    event.reply("conversion-status", { msg: "Encoder istanziato" });

    event.reply("conversion-status", { msg: "Pulisco cartella temporanea..." });
    await encoder.clearTmpDir();

    event.reply("conversion-status", { msg: "TTS in corso... (potrebbe metterci un po')" });

    if (multithreadedTTS) {
        logger.info("TTS multithread");
        await tts.speakAllMultithread(voice, format, ttsString, fileName, jsonContent);
    } else {
        logger.info("TTS singlethread");
        tts.onTTSStart.on("tts-start", str => {
            event.reply("conversion-status", { msg: str });
        });
        await tts.speakAll(voice, ttsString, fileName, jsonContent, format);
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
    const v = new Voices();
    event.reply("voices", await v.listVoices());
});

ipcMain.on("install-voice", async (event, voiceName: string) => {
    try {
        event.reply("install-voice-status", { msg: "Controllo se la voce è già installata..." });

        const v = new Voices();
        if (await v.isVoiceInstalled(voiceName)) {
            return event.reply("install-voice-status", {
                msg: `La voce "${voiceName}" è già installata`,
                finished: true
            });
        }

        const setupPath = path.join(getResPath(), `./bin/${voiceName.split("Loquendo ")[1]}.exe`);
        logger.info(`apro setup di "${voiceName}" in ${setupPath}`);

        event.reply("install-voice-status", { msg: `Apro l'eseguibile...` });
        await shell.openExternal(setupPath);

        event.reply("install-voice-status", {
            msg: "Una volta fatto, seleziona il percorso di installazione premendo sull'apposito tasto",
            canInstall: true
        });
    } catch (err) {
        logger.error(err);
        event.reply("install-voice-status", {
            msg: "Si è verificato un errore: " + err,
            finished: true
        });
    }
});

// const isAdmin = () => new Promise(resolve => isAdminUser(resolve));
const runAsAdmin = (cmd: string) => new Promise(resolve => elevate(cmd, undefined, resolve));

ipcMain.on("voice-installed", async event => {
    if (!mainWindow) throw new Error("no mainWindow for voice-installed");

    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        defaultPath: getInstallPath(),
        title: "Cartella di installazione di LoqTTS6.dll",
        filters: [{ name: "LoqTTS6", extensions: ["dll"] }],
        properties: ["openFile", "showHiddenFiles", "dontAddToRecent"]
    });
    if (canceled) return;

    const fileDir = path.resolve(filePaths[0], "../");
    logger.info("Loq path selezionato: " + fileDir);

    const f = path.resolve(getResPath(), "./bin/LoqTTS6.dll");
    try {
        event.reply("install-voice-status", {
            msg: "Ho bisogno dei permessi per accedere al file"
        });
        await runAsAdmin(`copy ${f} ${fileDir} /y /q`);
        // copyFileSync(f, fileDir);
        logger.info("LoqTTS6 success");
        event.reply("install-voice-status", {
            msg: "Voce installata!",
            finished: true,
            success: true
        });
    } catch (err) {
        logger.error(err);
        event.reply("install-voice-status", {
            msg:
                err &&
                typeof (err as any).toString === "function" &&
                ((err as any).toString() as string).includes("EPERM")
                    ? "Non ho i permessi per accedere al file :("
                    : `Errore durante l'accesso al file LoqTTS6: ${err}`,
            finished: true
        });
    }
});

ipcMain.handle("format-string", (event, str: string, obj: AnyObj) => {
    return Substitutions.formatString(str, obj);
});

function getInstallPath(): string {
    let fPath = path.resolve("C:\\Program Files (x86)\\Loquendo\\LTTS\\LoqTTS6.dll");
    do {
        logger.info("Loq install path: " + fPath);
        if (existsSync(fPath)) return fPath;
        else fPath = path.resolve(fPath, "../");
    } while (fPath !== path.resolve("C:/"));
    return fPath;
}

ipcMain.on("close", e => {
    app.quit();
});
