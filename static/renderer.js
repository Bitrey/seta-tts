// Materialize CSS
M.AutoInit();

// FilePond
// FilePond.parse(document.body);
// FilePond.setOptions(filepondIt);

const { ipcRenderer } = require("electron");
const path = require("path");

function csvInfo(text) {
    document.getElementById("csv-info").textContent = text;
}

ipcRenderer.on("bad-file", (event, arg) => {
    csvInfo(arg);
});

ipcRenderer.on("file-ok", (event, filePath) => {
    csvInfo(`Caricamento "${path.basename(filePath)}"...`);
    ipcRenderer.send("file", filePath);
});

ipcRenderer.on("file", (event, { columnNames, jsonContent }) => {
    csvInfo("FUNZIONA!!!!!!!!! PER OGGI HO FINITO");
    console.log(columnNames, jsonContent);
});

//
document.getElementById("file-picker").addEventListener("click", () => {
    ipcRenderer.send("choose-file");
});

document.addEventListener("drop", event => {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer.files.length < 1) {
        return csvInfo("Nessun file rilasciato");
    }

    if (!Array.from(event.dataTransfer.files).some(e => e.name.endsWith(".csv"))) {
        return csvInfo("Il file deve avere estensione .csv");
    }

    const filePath = Array.from(event.dataTransfer.files).find(e => e.name.endsWith(".csv")).path;
    csvInfo(`Caricamento "${path.basename(filePath)}"...`);
    ipcRenderer.send("file", filePath);
});

document.addEventListener("dragover", e => {
    e.preventDefault();
    e.stopPropagation();
});

document.addEventListener("dragenter", event => {
    csvInfo("Rilascia il file");
});

document.addEventListener("dragleave", event => {
    csvInfo("Caccia dentro il CSV");
});
