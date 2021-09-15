import { spawn } from "child_process";
import path from "path";
import { logger } from "./logger";

export class TTS {
    speak(
        text: string,
        outputName: string,
        outputPath = path.join(__dirname, "../output.tmp")
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!outputName.endsWith(".wav")) outputName += ".wav";
            logger.info(`Inizio TTS di "${outputName}"...`);

            const fullPath = path.join(outputPath, outputName);
            const args = ["-t", text, "-n", "Loquendo Roberto", "-w", fullPath];
            const child = spawn(path.join(__dirname, "../bin/balcon.exe"), args);

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
