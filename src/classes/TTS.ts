import { spawn } from "child_process";
import path from "path";
import { logger } from "../misc/logger";

export class TTS {
    /**
     * Metodo principale per convertire una stringa in file audio con TTS.
     * Sotto utilizza la CLI di Balabolka, Balcon.
     * @param  {string} text - la stringa da convertire in file audio
     * @param  {string} outputName - nome del file audio di output
     * @param  {string} [outputPath] - percorso assoluto della cartella di output
     */
    speak(
        text: string,
        outputName: string,
        outputPath = path.join(process.cwd(), "./output.tmp")
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!outputName.endsWith(".wav")) outputName += ".wav";
            logger.info(`Inizio TTS di "${outputName}"...`);

            const fullPath = path.join(outputPath, outputName);
            const args = ["-t", text, "-n", "Loquendo Roberto", "-w", fullPath];
            const child = spawn(path.join(process.cwd(), "./bin/balcon.exe"), args);

            child.stdout.on("data", chunk => {
                logger.info("stdout:");
                logger.debug(chunk);
            });
            child.stderr.on("data", chunk => {
                logger.info("stderr:");
                logger.warn(chunk);
            });
            child.on("close", code => {
                logger.info("TTS avvenuto con successo");
                resolve();
            });
            child.on("error", err => {
                logger.error(err);
                process.exit(1);
            });
        });
    }
}
