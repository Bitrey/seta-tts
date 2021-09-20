import fs from "fs";
import os from "os";
import path from "path";

/**
 * Crea la cartella temporanea per file come log e output.tmp
 * @returns {string} Il percorso assoluto della cartella temporanea
 */
export function createTmpFolder(): string {
    const baseDir = path.resolve(os.tmpdir(), "./seta-tts");

    if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir);
    }

    return baseDir;
}
