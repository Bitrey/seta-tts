import { dialog } from "electron";
import process from "process";
import { logger } from "../misc/logger";
import { getMainWindow } from "../gui/electron";

process.on("uncaughtException", (err, origin) => {
    logger.error(err);
    logger.error(origin);
    const win = getMainWindow();
    if (win) {
        dialog.showMessageBoxSync(win, {
            message: "Errore: " + err.message + "\nOrigine: " + origin,
            type: "error",
            buttons: [],
            title: "Errore"
        });
    }
    process.exit(1);
});
