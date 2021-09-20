import { ipcRenderer } from "electron";
import path from "path";
import fs from "fs";

const mDebugPath = path.join(__dirname, "../../res/static/materialize.min.js");
const isDebug = fs.existsSync(mDebugPath);

(
    require(isDebug
        ? mDebugPath
        : path.join(process.resourcesPath, "./res/static/materialize.min.js")) as any
).AutoInit();

function addCSS() {
    const materializeLink = document.createElement("link");
    materializeLink.rel = "stylesheet";
    materializeLink.href = path.join(process.resourcesPath, "./res/static/materialize.min.css");
    document.querySelector("head")?.appendChild(materializeLink);
    const guiLink = document.createElement("link");
    guiLink.rel = "stylesheet";
    guiLink.href = path.join(process.resourcesPath, "./res/static/gui.css");
    document.querySelector("head")?.appendChild(guiLink);
}
if (!isDebug) addCSS();

interface AnyObj {
    [key: string]: string;
}

interface State {
    canUploadFile: boolean;
    fileName: string | null;
    columnNames: string[] | null;
    jsonContent: AnyObj[] | null;
    outputPath: string | null;
}
const state: State = {
    canUploadFile: false,
    fileName: null,
    columnNames: null,
    jsonContent: null,
    outputPath: null
};

document.getElementById("close-btn")?.addEventListener("click", () => ipcRenderer.send("close"));

function csvInfo(text: string) {
    (document.getElementById("csv-info") as HTMLElement).textContent = text;
}

ipcRenderer.on("bad-file", (event, arg) => {
    state.canUploadFile = true;
    csvInfo(arg);
});

ipcRenderer.on("file-ok", (event, filePath) => {
    state.canUploadFile = false;
    csvInfo(`Caricamento "${path.basename(filePath)}"...`);
    ipcRenderer.send("file", filePath);
});

ipcRenderer.on("file", (event, { fileName, columnNames, jsonContent }) => {
    state.canUploadFile = false;
    state.fileName = fileName;
    state.columnNames = columnNames;
    state.jsonContent = jsonContent;
    renderTable();
});

document.getElementById("file-picker")?.addEventListener("click", () => {
    ipcRenderer.send("choose-file");
});

document.addEventListener("drop", event => {
    console.log("drop event");

    if (!state.canUploadFile) return;
    state.canUploadFile = false;

    event.preventDefault();
    event.stopPropagation();

    if (!event.dataTransfer?.files?.length || event.dataTransfer.files.length < 1) {
        state.canUploadFile = true;
        return csvInfo("Nessun file rilasciato");
    }

    if (!Array.from(event.dataTransfer.files).some(e => e.name.endsWith(".csv"))) {
        state.canUploadFile = true;
        return csvInfo("Il file deve avere estensione .csv");
    }

    const filePath = Array.from(event.dataTransfer.files).find(e => e.name.endsWith(".csv"))?.path;
    if (!filePath) throw new Error("no filePath");
    csvInfo(`Caricamento "${path.basename(filePath)}"...`);
    ipcRenderer.send("file", filePath);
});

document.addEventListener("dragover", e => {
    console.log("file dragover");
    if (!state.canUploadFile) return;
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener("dragenter", event => {
    console.log("file dragenter");
    if (!state.canUploadFile) return;
    csvInfo("Rilascia il file");
});

document.addEventListener("dragleave", event => {
    console.log("file dragleave");
    if (!state.canUploadFile) return;
    csvInfo("Caccia dentro il CSV");
});

function renderTable() {
    const { fileName, columnNames, jsonContent } = state;

    console.log("renderTable con", { fileName, columnNames, jsonContent });

    (document.getElementById("file-name") as HTMLElement).textContent = fileName;

    const tHeadTr = document.getElementById("table-thead-tr");
    const tBody = document.getElementById("table-tbody");

    if (!Array.isArray(columnNames)) throw new Error("no columnNames");

    (document.getElementById("header-num") as HTMLElement).textContent =
        columnNames.length.toString();

    const headers = document.getElementById("headers");
    if (!headers) throw new Error("no headers");
    headers.innerHTML = "";

    let i = 0;
    for (const col of columnNames) {
        const th = document.createElement("th");
        th.style.fontWeight = "600";
        th.textContent = col;
        (tHeadTr as HTMLElement).appendChild(th);

        const h = document.createElement("span");
        h.style.fontWeight = "600";
        h.textContent = col;
        headers.appendChild(h);
        if (++i < columnNames.length) {
            headers.innerHTML += i !== columnNames.length - 1 ? ", " : " e ";
        }
    }

    document.querySelectorAll(".first-col").forEach(e => (e.textContent = columnNames[0]));

    // non mostrare tabella eccessivamente lunga
    if (!jsonContent) throw new Error("jsonContent not loaded yet");

    const len = Object.values(jsonContent).length;
    let shown = len > 10 ? 8 : len;
    const subtracted = len - shown;

    for (const obj of jsonContent) {
        if (!shown) break;
        const tr = document.createElement("tr");

        columnNames.forEach(col => {
            const td = document.createElement("td");
            td.textContent = col in obj ? obj[col] : "";
            tr.appendChild(td);
        });

        (tBody as HTMLElement).appendChild(tr);
        shown--;
    }
    if (!shown) {
        const p = document.getElementById("hidden-rows-num");
        if (!p) throw new Error("no p");
        p.textContent = `...e altre ${subtracted} righe`;
        p.classList.remove("hide");
    }

    document.querySelector(".csv-upload-container")?.classList.add("hide");
    document.querySelector(".csv-file-container")?.classList.remove("hide");

    // accordion.open(0);
}

document.getElementById("output-path-input")?.addEventListener("click", outputPath);

// se si vuole ricominciare da capo con un nuovo file
function newFile() {
    console.log("newFile resetto GUI");

    (document.getElementById("table-thead-tr") as HTMLElement).innerHTML = "";
    (document.getElementById("table-tbody") as HTMLElement).innerHTML = "";

    document.getElementById("hidden-rows-num")?.classList.add("hide");

    csvInfo("Fai un drag and drop del CSV oppure");
    (document.querySelector(".csv-file-container") as HTMLElement).classList.add("hide");
    (document.querySelector(".csv-upload-container") as HTMLElement).classList.remove("hide");

    // accordion.close(0);

    audioLog(null, true);

    state.canUploadFile = true;
    state.fileName = null;
    state.columnNames = null;
    state.jsonContent = null;
    // state.outputPath = null;
    state.canUploadFile = true;
}
document.getElementById("new-file")?.addEventListener("click", () => newFile());

ipcRenderer.send("latest-commit");
ipcRenderer.on("latest-commit", (event, commit) => {
    (document.getElementById("latest-commit") as HTMLElement).textContent = commit;
});

function formatVariables(str: string) {
    if (!state.jsonContent) {
        throw new Error("jsonContent not loaded yet");
    }
    const matches = str.match(/\{(.*?)\}/g);
    if (!matches) return str;
    for (const match of matches) {
        const m = match.replace(/\{\ *|\ *}/g, "");
        if (m in state.jsonContent[0]) {
            str = str.replace(match, state.jsonContent[0][m]);
        }
    }
    console.log("formatVariables", matches, str);
    return str;
}

const ttsStringPreview = document.getElementById("tts-string-preview") as HTMLElement;
document.getElementById("tts-string-input")?.addEventListener("input", event => {
    const { value } = event.target as any;
    (document.getElementById("tts-string-preview-container") as HTMLElement).style.visibility =
        !!value ? "visible" : "hidden";
    ttsStringPreview.textContent = formatVariables(value);
});

// audio-format-input

const fileNamePreview = document.getElementById("file-name-preview") as HTMLElement;
document.getElementById("file-name-input")?.addEventListener("input", event => {
    const { value } = event.target as any;
    (document.getElementById("file-name-preview-container") as HTMLElement).style.visibility =
        !!value ? "visible" : "hidden";
    const format = (document.getElementById("audio-format-input") as HTMLInputElement).value;
    fileNamePreview.textContent = `${formatVariables(value)}.${format}`;
});

document.getElementById("audio-format-input")?.addEventListener("change", event => {
    fileNamePreview.textContent =
        fileNamePreview.textContent?.replace(/\.[^/.]+$/, "." + (event.target as any).value) || "";
});

function outputPath(event: Event) {
    console.log("ipcRenderer output-path");
    event.preventDefault();
    ipcRenderer.send("output-path");
    return false;
}

ipcRenderer.on("output-path-ok", (event, { outputPath }) => {
    console.log("Ricevuto outputPath", { outputPath });
    state.outputPath = outputPath;
    (document.getElementById("output-path-txt") as HTMLInputElement).value = outputPath;
});

document.getElementById("volume")?.addEventListener("input", event => {
    console.log(
        "Volume: " + (parseInt((event.target as HTMLInputElement).value) / 100).toFixed(2) + "%"
    );
    (document.getElementById("volume-txt") as HTMLElement).textContent =
        (event.target as HTMLInputElement).value + "%";
});

function audioLog(err: string | null, hide = false, disable = false) {
    const elem = document.getElementById("audio-errors");
    if (!elem) throw new Error("no audio-errors elem");

    if (hide) {
        elem.textContent = "-";
        elem.style.visibility = "hidden";
    } else {
        if (err) elem.textContent = err;
        elem.style.visibility = "visible";
    }

    const convertElem = document.getElementById("convert");
    if (!convertElem) throw new Error("no convertElem");
    if (disable) {
        convertElem.setAttribute("disabled", "true");
        convertElem.textContent = "Caricamento...";
    } else {
        convertElem.removeAttribute("disabled");
        convertElem.textContent = "Avvia conversione";
    }
}

document.getElementById("convert")?.addEventListener("click", event => {
    audioLog(null, true, true);

    const ttsString = (document.getElementById("tts-string-input") as HTMLInputElement).value;
    const fileName = (document.getElementById("file-name-input") as HTMLInputElement).value;

    if (!state.jsonContent) {
        return audioLog("Errore nel caricamento del contenuto CSV in JSON");
    } else if (!ttsString) {
        return audioLog("Specifica il testo da pronunciare");
    } else if (!fileName) {
        return audioLog("Specifica il nome del file");
    } else if (!state.outputPath) {
        return audioLog("Specifica una cartella di output");
    }

    console.log("start-conversion");
    ipcRenderer.send("start-conversion", {
        jsonContent: state.jsonContent,
        ttsString,
        fileName,
        format: (document.getElementById("audio-format-input") as HTMLInputElement).value,
        bitrate: (document.getElementById("bitrate") as HTMLInputElement).value,
        sampleRate: (document.getElementById("sample-rate") as HTMLInputElement).value,
        volume: parseInt((document.getElementById("volume") as HTMLInputElement).value) / 100,
        outputPath: state.outputPath,
        multithreadedTTS: (document.getElementById("multithreaded-tts") as HTMLInputElement)
            .checked,
        multithreadedEncoding: (
            document.getElementById("multithreaded-encoding") as HTMLInputElement
        ).checked
    });
});

interface ConversionStatus {
    msg: string;
    finished?: boolean;
}
ipcRenderer.on("conversion-status", (event, data: ConversionStatus) => {
    const { msg, finished } = data;
    console.log("conversion-status", { msg, finished });
    audioLog(msg, false, true);
    if (finished) {
        (document.getElementById("convert") as HTMLElement).textContent = "Riavvia conversione";
        audioLog(null, false, false);
    }
});

interface VoicesReturn {
    expectedVoice: string;
    voices: Voices;
    hasVoice: boolean;
}
interface Voices {
    [SAPI: string]: string[];
}

ipcRenderer.send("get-voices");
ipcRenderer.on("voices", (event, { expectedVoice, voices, hasVoice }: VoicesReturn) => {
    console.log("Voices", { expectedVoice, voices, hasVoice });

    (document.getElementById("voice-name") as HTMLElement).textContent = expectedVoice;

    const ul = document.createElement("ul");
    ul.classList.add("collection");
    ul.classList.add("with-header");

    let found = false;

    for (const sapi in voices) {
        const header = document.createElement("li");
        header.classList.add("collection-header");
        header.style.fontWeight = "600";
        header.textContent = sapi;
        ul.appendChild(header);

        for (const voice of voices[sapi]) {
            const item = document.createElement("li");
            item.classList.add("collection-item");
            item.textContent = voice;
            if (!found && voice === expectedVoice) {
                found = true;
                item.style.fontWeight = "600";
                item.style.textDecoration = "underline";
            }
            ul.appendChild(item);
        }
    }
    document.getElementById("voices-list")?.appendChild(ul);

    document
        .querySelectorAll(hasVoice ? ".voice-ok" : ".voice-error")
        .forEach(e => e.classList.remove("hide"));
    document.getElementById("voices-loading")?.classList.add("hide");
    document.querySelector(".csv-upload-container")?.classList.remove("hide");

    state.canUploadFile = true;
});
