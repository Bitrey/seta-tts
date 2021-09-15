import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { logger } from "./logger";

interface Obj {
    [key: string]: string;
}

export class Encoder {
    public encodeOptions: Obj;
    public static readonly pathToFfmpeg: string = require("ffmpeg-static");
    public static readonly defaultEncodeOptions = {
        bitrate: "24k",
        sampleRate: 11025,
        channels: 1,
        volume: 1.5
    };

    constructor(settingsPath = "../settings.json") {
        this.encodeOptions = Object.assign(
            Encoder.defaultEncodeOptions,
            require(settingsPath).encoding
        );
    }

    private prepareFolders(inputDirName = "output.tmp", outputDirName = "output") {
        const inputPath = path.join(__dirname, "../", inputDirName);
        if (!fs.existsSync(inputPath)) fs.mkdirSync(inputPath);
        const outputPath = path.join(__dirname, "../", outputDirName);
        if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath);
        return { inputPath, outputPath };
    }

    private getFileNames(path?: string): string[] {
        const { inputPath } = this.prepareFolders();
        return fs.readdirSync(path || inputPath);
    }

    public encodeFile(input: string, output: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { bitrate, channels, sampleRate, volume } = this.encodeOptions;
            const outputName = output.replace(/\.[^/.]+$/, "") + ".mp3";

            if (fs.existsSync(outputName)) {
                logger.info(`"${path.basename(outputName)}" esiste già e verrà sovrascritto`);
                fs.unlinkSync(outputName);
            }

            const args = [
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

            logger.info(`Converto "${path.basename(input)}" in "${path.basename(outputName)}"...`);

            const child = spawn(Encoder.pathToFfmpeg, args);

            // DEBUG
            // console.log(Encoder.pathToFfmpeg, args.join(" "));

            child.stdout.on("data", chunk => {
                logger.info("stdout:");
                logger.debug(chunk);
            });
            child.stderr.on("data", chunk => {
                logger.info("stderr:");
                logger.warn(chunk);
            });
            child.on("close", code => {
                logger.info(`Conversione avvenuta con successo (exit code ${code})`);
                resolve();
            });
            child.on("error", err => {
                logger.error(err);
                process.exit(1);
            });
        });
    }

    public async encodeAll(inputDir?: string, outputDir?: string) {
        const { inputPath, outputPath } = this.prepareFolders();
        const files = this.getFileNames(inputDir || undefined);
        const f = '"' + files.join('", "') + '"' || `${path.basename(inputDir || inputPath)} vuoto`;
        logger.info("Inizio conversione dei file: " + f);
        for (const file of files) {
            const fileInput = path.join(inputDir || inputPath, file);
            const fileName = path.basename(fileInput);
            const fileOutput = path.join(outputDir || outputPath, fileName);
            await this.encodeFile(fileInput, fileOutput);
        }
    }
}
