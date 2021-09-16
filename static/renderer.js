const state = {
    canUploadFile: true,
    fileName: null,
    columnNames: null,
    jsonContent: null,
    outputPath: null
};

// Materialize CSS
M.AutoInit();

const { ipcRenderer } = require("electron");
const path = require("path");

document.getElementById("close-btn").addEventListener("click", () => ipcRenderer.send("close"));

function csvInfo(text) {
    document.getElementById("csv-info").textContent = text;
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
    csvInfo("FUNZIONA!!!!!!!!!");
    // console.log(columnNames, jsonContent);
    state.fileName = fileName;
    state.columnNames = columnNames;
    state.jsonContent = jsonContent;
    renderTable();
});

//
document.getElementById("file-picker").addEventListener("click", () => {
    ipcRenderer.send("choose-file");
});

document.addEventListener("drop", event => {
    if (!state.canUploadFile) return;
    state.canUploadFile = false;

    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files.length < 1) {
        state.canUploadFile = true;
        return csvInfo("Nessun file rilasciato");
    }

    if (!Array.from(event.dataTransfer.files).some(e => e.name.endsWith(".csv"))) {
        state.canUploadFile = true;
        return csvInfo("Il file deve avere estensione .csv");
    }

    const filePath = Array.from(event.dataTransfer.files).find(e => e.name.endsWith(".csv")).path;
    csvInfo(`Caricamento "${path.basename(filePath)}"...`);
    ipcRenderer.send("file", filePath);
});

document.addEventListener("dragover", e => {
    if (!state.canUploadFile) return;
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener("dragenter", event => {
    if (!state.canUploadFile) return;
    csvInfo("Rilascia il file");
});

document.addEventListener("dragleave", event => {
    if (!state.canUploadFile) return;
    csvInfo("Caccia dentro il CSV");
});

function renderTable() {
    const { fileName, columnNames, jsonContent } = state;

    document.getElementById("file-name").textContent = fileName;

    const tHeadTr = document.getElementById("table-thead-tr");
    const tBody = document.getElementById("table-tbody");

    document.getElementById("header-num").textContent = columnNames.length;
    const headers = document.getElementById("headers");
    headers.innerHTML = "";

    let i = 0;
    for (const col of columnNames) {
        const th = document.createElement("th");
        th.style.fontWeight = 600;
        th.textContent = col;
        tHeadTr.appendChild(th);

        const h = document.createElement("span");
        h.style.fontWeight = 600;
        h.textContent = col;
        headers.appendChild(h);
        if (++i < columnNames.length) {
            headers.innerHTML += i !== columnNames.length - 1 ? ", " : " e ";
        }
    }

    document.querySelectorAll(".first-col").forEach(e => (e.textContent = columnNames[0]));

    // non mostrare tabella eccessivamente lunga
    const len = Object.values(jsonContent).length;
    let shown = len > 10 ? 8 : len;
    const subtracted = len - shown;

    for (const obj of jsonContent) {
        if (!shown) break;
        const tr = document.createElement("tr");
        for (const col of columnNames) {
            const td = document.createElement("td");
            td.textContent = col in obj ? obj[col] : "";
            tr.appendChild(td);
        }
        tBody.appendChild(tr);
        shown--;
    }
    if (!shown) {
        const p = document.getElementById("hidden-rows-num");
        p.textContent = `...e altre ${subtracted} righe`;
        p.classList.remove("hide");
    }

    document.querySelector(".csv-upload-container").classList.add("hide");
    document.querySelector(".csv-file-container").classList.remove("hide");

    accordion.open();
}

// se si vuole ricominciare da capo con un nuovo file
function newFile() {
    document.getElementById("table-thead-tr").innerHTML = "";
    document.getElementById("table-tbody").innerHTML = "";

    document.getElementById("hidden-rows-num").classList.add("hide");

    csvInfo("Fai un drag and drop del CSV oppure");
    document.querySelector(".csv-file-container").classList.add("hide");
    document.querySelector(".csv-upload-container").classList.remove("hide");

    accordion.close();

    audioError(null, true);

    state.canUploadFile = true;
    state.fileName = null;
    state.columnNames = null;
    state.jsonContent = null;
    state.outputPath = null;
    state.canUploadFile = true;
}
document.getElementById("new-file").addEventListener("click", () => newFile());

const accordion = M.Collapsible.getInstance(document.querySelector(".collapsible"));
accordion.options.onOpenStart = () => {
    document.querySelectorAll(".accordion-arrow").forEach(e => e.classList.add("expanded"));
};
accordion.options.onCloseStart = () => {
    document.querySelectorAll(".accordion-arrow").forEach(e => e.classList.remove("expanded"));
};

ipcRenderer.send("latest-commit");
ipcRenderer.on("latest-commit", (event, commit) => {
    document.getElementById("latest-commit").textContent = commit;
});

function formatVariables(str) {
    const matches = str.match(/\{(.*?)\}/g);
    if (!matches) return str;
    for (const match of matches) {
        // const span = document.createElement("span");
        const m = match.replace(/\{\ *|\ *}/g, "");
        // console.log({ match, m, b: m in state.jsonContent[0], s: state.jsonContent[0][m] });
        if (m in state.jsonContent[0]) {
            str = str.replace(match, state.jsonContent[0][m]);
            // span.style.color = "green";
        }
        // else {
        // span.style.color = "red";
        // }
        // parent.appendChild(span);
    }
    return str;
}

const ttsStringPreview = document.getElementById("tts-string-preview");
document.getElementById("tts-string-input").addEventListener("input", event => {
    const { value } = event.target;
    document.getElementById("tts-string-preview-container").style.visibility = !!value
        ? "visible"
        : "hidden";
    ttsStringPreview.textContent = formatVariables(value);
});

// audio-format-input

const fileNamePreview = document.getElementById("file-name-preview");
document.getElementById("file-name-input").addEventListener("input", event => {
    const { value } = event.target;
    document.getElementById("file-name-preview-container").style.visibility = !!value
        ? "visible"
        : "hidden";
    const format = document.getElementById("audio-format-input").value;
    fileNamePreview.textContent = `${formatVariables(value)}.${format}`;
});

document.getElementById("audio-format-input").addEventListener("change", event => {
    fileNamePreview.textContent = fileNamePreview.textContent.replace(
        /\.[^/.]+$/,
        "." + event.target.value
    );
});

function outputPath(event) {
    event.preventDefault();
    console.log("send output-path");
    ipcRenderer.send("output-path");
    return false;
}

ipcRenderer.on("output-path-ok", (event, { outputPath }) => {
    state.outputPath = outputPath;
    document.getElementById("output-path-txt").value = state.outputPath;
});

document.getElementById("volume").addEventListener("input", event => {
    document.getElementById("volume-txt").textContent = event.target.value + "%";
});

function audioError(err, hide = false) {
    const elem = document.getElementById("audio-errors");
    if (hide) {
        elem.textContent = "-";
        elem.style.visibility = "hidden";
    } else {
        document.getElementById("convert").setAttribute("disabled", true);
        document.getElementById("convert").textContent = "Caricamento...";
        elem.textContent = err;
        elem.style.visibility = "visible";
    }
}

document.getElementById("convert").addEventListener("click", event => {
    event.target.setAttribute("disabled", true);
    event.target.textContent = "Caricamento...";

    if (!state.outputPath) {
        event.target.setAttribute("disabled", false);
        event.target.textContent = "Avvia conversione";
        return audioError("Specifica una cartella di output");
    }

    audioError(null, true);

    ipcRenderer.send("start-conversion", {
        jsonContent: state.jsonContent,
        ttsString: document.getElementById("tts-string-input").value,
        fileName: document.getElementById("file-name-input").value,
        format: document.getElementById("audio-format-input").value,
        bitrate: document.getElementById("bitrate").value,
        sampleRate: document.getElementById("sample-rate").value,
        volume: document.getElementById("volume").value / 100,
        outputPath: state.outputPath
    });
});

ipcRenderer.on("conversion-status", (event, status) => {
    audioError(status);
});
