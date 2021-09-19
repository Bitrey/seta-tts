import path from "path";
import { spawn } from "child_process";
import { parentPort } from "worker_threads";
import { formatVariables } from "../misc/formatVariables";
import { logger } from "../misc/logger";
import { TTSFileArg } from "../classes/TTSFileArg";

function speak(
    finalFormat: string,
    text: string,
    outputName: string,
    outputPath = path.join(process.cwd(), "./output.tmp")
): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!outputName.endsWith(finalFormat)) outputName += "." + finalFormat;

        const fullPath = path.join(outputPath, outputName);
        logger.info(`Inizio TTS di "${outputName}" con output in "${fullPath}"...`);
        // console.log(readdirSync(path.join(fullPath, "../../")));
        const args = ["-t", text, "-n", "Loquendo Roberto", "-w", fullPath];
        const child = spawn(path.join(process.cwd(), "./bin/balcon.exe"), args);

        child.stdout.on("data", chunk => {
            logger.info(`stdout di "${outputName}": ${chunk.toString().trim()}`);
        });
        child.stderr.on("data", chunk => {
            logger.info(`stderr di "${outputName}": ${chunk.toString().trim()}`);
        });
        child.on("close", code => {
            logger.info(`TTS avvenuto con successo (exit code ${code})`);
            resolve();
        });
        child.on("error", err => {
            logger.error(err);
            process.exit(1);
        });
    });
}

parentPort?.on(
    "message",
    async ({ ttsString, fileName, row, finalFormat, outputPath }: TTSFileArg) => {
        if (!row || typeof row !== "object") {
            throw new Error("encodeOptions must be an object");
        } else if (typeof ttsString !== "string") {
            throw new Error("input must be a string");
        } else if (typeof fileName !== "string") {
            throw new Error("output must be a string");
        }

        const outputName = formatVariables(fileName, row);
        const correctPath = outputPath || path.join(process.cwd(), "./output.tmp");

        await speak(finalFormat, formatVariables(ttsString, row), outputName, correctPath);
        logger.debug(`TTS di "${outputName}" completato"`);

        parentPort?.postMessage(fileName);
    }
);
