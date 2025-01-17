import os from "os";
import path from "path";
import { spawn } from "child_process";
import { EventEmitter } from "stream";
import { StaticPool } from "node-worker-threads-pool";
import { logger } from "../misc/logger";
import { AnyObj } from "./AnyObj";
import { TTSFileArg } from "./TTSFileArg";
import { getResPath } from "../misc/getResPath";
import { Substitutions } from "./Substitutions";

export class TTS {
    public readonly onTTSStart: EventEmitter;

    constructor() {
        this.onTTSStart = new EventEmitter();
    }

    /**
     * Metodo principale per convertire una stringa in file audio con TTS.
     * Sotto utilizza la CLI di Balabolka, Balcon.
     * @param  {string} text - la stringa da convertire in file audio
     * @param  {string} outputName - nome del file audio di output
     * @param  {string} [outputPath] - percorso assoluto della cartella di output
     */
    speak(
        voice: string,
        finalFormat: string,
        text: string,
        outputName: string,
        outputPath = path.join(os.tmpdir(), "./seta-tts/output.tmp")
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!outputName.endsWith(finalFormat)) outputName += "." + finalFormat;

            logger.info("Voce selezionata: " + voice);

            const fullPath = path.join(outputPath, outputName);
            logger.info(`Inizio TTS di "${outputName}" con output in "${fullPath}"...`);
            // console.log(readdirSync(path.join(fullPath, "../../")));
            const args = ["-t", text, "-n", voice, "-w", fullPath];
            const child = spawn(path.join(getResPath(), "./bin/balcon.exe"), args);

            child.stdout.on("data", chunk => {
                logger.info(`stdout di "${outputName}": ${chunk.toString().trim()}`);
            });
            child.stderr.on("data", chunk => {
                logger.info(`stderr di "${outputName}": ${chunk.toString().trim()}`);
            });
            child.on("close", code => {
                logger.info(`TTS completato (exit code ${code})`);
                resolve();
            });
            child.on("error", err => {
                logger.error(err);
                process.exit(1);
            });
        });
    }

    async speakAll(
        voice: string,
        ttsString: string,
        fileName: string,
        jsonContent: AnyObj[],
        finalFormat: string
    ) {
        for (let i = 0; i < jsonContent.length; i++) {
            this.onTTSStart.emit(
                "tts-start",
                `TTS in corso... (Riga ${i + 1}/${jsonContent.length})`
            );
            const formattedStr = Substitutions.formatString(ttsString, jsonContent[i]);
            const formattedTitle = Substitutions.formatString(fileName, jsonContent[i]);
            await this.speak(voice, finalFormat, formattedStr, formattedTitle);
        }
    }

    async speakAllMultithread(
        voice: string,
        finalFormat: string,
        ttsString: string,
        fileName: string,
        jsonContent: AnyObj[],
        poolSize?: number
    ) {
        const workerPath = path.resolve(__dirname, "../workers/speak.js");
        const pool = new StaticPool({
            size: poolSize || os.cpus().length,
            task: workerPath
        });
        await Promise.all(
            jsonContent.map(row => {
                const arg: TTSFileArg = { voice, ttsString, fileName, row, finalFormat };
                return pool.exec(arg);
            })
        );
    }
}
