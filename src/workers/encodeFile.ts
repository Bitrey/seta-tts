/**
 * Questa funzione è in un file separato in quanto può essere eseguita
 * in modo puro, permettendo di usare un worker thread e andare di
 * multithreading
 */

import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import trash from "trash";
import { parentPort } from "worker_threads";
import { AnyObj } from "../classes/AnyObj";
import { EncodeFileArg } from "../classes/EncodeFileArg";
import { Encoder } from "../classes/Encoder";
import { logger } from "../misc/logger";

function encodeFile(encodeOptions: AnyObj, input: string, output: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const { bitrate, channels, sampleRate, volume } = encodeOptions;
        const outputName = output.replace(/\.[^/.]+$/, "") + path.extname(output);
        const fName = path.basename(outputName);

        if (fs.existsSync(outputName)) {
            logger.info(`"${fName}" esiste già e verrà cestinato`);
            await trash(outputName);
        }

        const args = [
            "-hide_banner", // meno verboose
            "-nostats",
            "-loglevel",
            "warning", // stampa >= warning
            "-y", // sovrascrivi se già esistente
            "-i", // seleziona file di input
            input,
            "-vn", // assicurati che sia soltanto audio
            "-ar", // seleziona sample rate
            sampleRate.toString(),
            "-filter:a", // alza il volume (default 150%)
            `volume=${volume}`,
            "-ac", // imposta il numero di canali (default 1, mono)
            channels.toString(),
            "-b:a", // seleziona bitrate
            bitrate.toString(),
            outputName
        ];
        // console.log(args);
        logger.info(`Converto "${path.basename(input)}" in "${fName}"...`);

        // Aggiorna thread principale
        // parentPort?.postMessage({ action: "file-start", payload: fName });

        const child = spawn(Encoder.pathToFfmpeg, args);

        child.stdout.on("data", chunk => {
            logger.info(`stdout di "${fName}": ${chunk.toString().trim()}`);
        });
        child.stderr.on("data", chunk => {
            logger.info(`stderr di "${fName}": ${chunk.toString().trim()}`);
        });
        child.on("close", code => {
            logger.info(
                `Conversione in "${path.basename(
                    outputName
                )}" avvenuta con successo (exit code ${code})`
            );
            resolve();
        });
        child.on("error", err => {
            logger.error(err);
            process.exit(1);
        });
    });
}

parentPort?.on("message", async ({ encodeOptions, fileInput, fileOutput }: EncodeFileArg) => {
    if (!encodeOptions || typeof encodeOptions !== "object") {
        throw new Error("encodeOptions must be an object");
    } else if (typeof fileInput !== "string") {
        throw new Error("input must be a string");
    } else if (typeof fileOutput !== "string") {
        throw new Error("output must be a string");
    }

    await encodeFile(encodeOptions, fileInput, fileOutput);

    parentPort?.postMessage(path.basename(fileOutput));
});
