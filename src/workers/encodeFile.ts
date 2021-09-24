/**
 * Questa funzione è in un file separato in quanto può essere eseguita
 * in modo puro, permettendo di usare un worker thread e andare di
 * multithreading
 */

import fs from "fs";
import path from "path";
import { cwd } from "process";
import { spawn } from "child_process";
import winston from "winston"; // just for typechecking
import { parentPort } from "worker_threads"; // just for typechecking
import { EncodeFileArg } from "../classes/EncodeFileArg"; // just for typechecking

const lPath = path.resolve(cwd(), "./build/misc/logger.js");
let logger: winston.Logger | null = fs.existsSync(lPath) ? require(lPath) : null;
if (typeof logger?.info !== "function") logger = null;

function encodeFile({
    pathToFfmpeg,
    encodeOptions,
    fileInput,
    fileOutput
}: EncodeFileArg): Promise<void> {
    return new Promise(async (resolve, reject) => {
        const { bitrate, channels, sampleRate, volume, sampleFormat } = encodeOptions;
        const outputName = fileOutput.replace(/\.[^/.]+$/, "") + path.extname(fileOutput);
        const fName = path.basename(outputName);

        const args = [
            "-hide_banner", // meno verboose
            "-nostats",
            "-loglevel",
            "warning", // stampa >= warning
            "-y", // sovrascrivi se già esistente
            "-i", // seleziona file di input
            fileInput,
            "-vn", // assicurati che sia soltanto audio
            "-ar", // seleziona sample rate
            sampleRate.toString(),
            "-filter:a", // alza il volume (default 150%)
            `volume=${volume}`,
            "-ac", // imposta il numero di canali (default 1, mono)
            channels.toString(),
            "-b:a", // seleziona bitrate
            bitrate.toString()
        ];
        if (path.extname(fileOutput).endsWith("wav")) {
            args.push(...["-c:a", sampleFormat]);
        }
        args.push(outputName);
        // console.log(args);
        logger?.info(`Converto "${path.basename(fileInput)}" in "${fName}"...`);

        const child = spawn(pathToFfmpeg, args);

        child.stdout.on("data", chunk => {
            logger?.info(`stdout di "${fName}": ${chunk.toString().trim()}`);
        });
        child.stderr.on("data", chunk => {
            logger?.info(`stderr di "${fName}": ${chunk.toString().trim()}`);
        });
        child.on("close", code => {
            logger?.info(
                `Conversione in "${path.basename(outputName)}" terminata (exit code ${code})`
            );
            resolve();
        });
        child.on("error", err => {
            logger?.error(err);
            process.exit(1);
        });
    });
}

parentPort?.on(
    "message",
    async ({ pathToFfmpeg, encodeOptions, fileInput, fileOutput }: EncodeFileArg) => {
        if (!encodeOptions || typeof encodeOptions !== "object") {
            throw new Error("encodeOptions must be an object");
        } else if (typeof fileInput !== "string") {
            throw new Error("input must be a string");
        } else if (typeof fileOutput !== "string") {
            throw new Error("output must be a string");
        }

        await encodeFile({ pathToFfmpeg, encodeOptions, fileInput, fileOutput });

        parentPort?.postMessage(path.basename(fileOutput));
    }
);
