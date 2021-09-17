import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import trash from "trash";
import { EventEmitter } from "stream";
import { StaticPool } from "node-worker-threads-pool";
import { logger } from "../misc/logger";
import { AnyObj } from "./AnyObj";
import { EncodeFileArg } from "./EncodeFileArg";

export class Encoder {
    public encodeOptions: AnyObj;
    public static readonly pathToFfmpeg: string = require("ffmpeg-static");
    public static readonly defaultEncodeOptions = {
        bitrate: "24k",
        sampleRate: 11025,
        channels: 1,
        volume: 1.5
    };
    public readonly onConversionStart: EventEmitter;

    constructor(
        settings: AnyObj,
        defaultSettingsPath = path.join(process.cwd(), "./settings.json")
    ) {
        this.encodeOptions = {
            ...Encoder.defaultEncodeOptions,
            ...require(defaultSettingsPath).encoding,
            settings
        };
        this.onConversionStart = new EventEmitter();
        this.prepareFolders();
    }

    public async clearTmpDir(tmpDirPath = path.join(process.cwd(), "./output.tmp")) {
        if (!fs.existsSync(tmpDirPath)) {
            logger.debug(`tmpDirPath "${tmpDirPath} non esistente`);
            return;
        }
        logger.info(`I file dentro "${tmpDirPath}" verranno cestinati`);
        await Promise.all(
            fs.readdirSync(tmpDirPath).map(file => {
                logger.debug(`Cestino "${file}"...`);
                return trash(path.join(tmpDirPath, file));
            })
        );
    }

    private prepareFolders(inputDirName = "output.tmp", outputDirName = "output") {
        const inputPath = path.join(process.cwd(), "./", inputDirName);
        if (!fs.existsSync(inputPath)) {
            logger.debug(`Creo la cartella di input (tmp) in "${inputPath}"`);
            fs.mkdirSync(inputPath);
        }
        const outputPath = path.join(process.cwd(), "./", outputDirName);
        if (!fs.existsSync(outputPath)) {
            logger.debug(`Creo la cartella di output in "${outputPath}"`);
            fs.mkdirSync(outputPath);
        }
        return { inputPath, outputPath };
    }

    private getFileNames(path?: string): string[] {
        const { inputPath } = this.prepareFolders();
        return fs.readdirSync(path || inputPath);
    }

    public encodeFile(input: string, output: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            const { bitrate, channels, sampleRate, volume } = this.encodeOptions;
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

            logger.info(`Converto "${path.basename(input)}" in "${fName}"...`);

            const child = spawn(Encoder.pathToFfmpeg, args);

            // DEBUG
            // console.log(Encoder.pathToFfmpeg, args.join(" "));

            child.stdout.on("data", chunk => {
                logger.info(`stdout di "${fName}": ${chunk.toString().trim()}`);
            });
            child.stderr.on("data", chunk => {
                logger.info(`stderr di "${fName}": ${chunk.toString().trim()}`);
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

    private startConversionLog(inputDir: string, files: string[]): void {
        const f = '"' + files.join('", "') + '"' || `${path.basename(inputDir)} vuoto`;
        logger.info("Inizio conversione dei file: " + f);
    }

    public async encodeAll(inputDir?: string, outputDir?: string): Promise<void> {
        const { inputPath, outputPath } = this.prepareFolders();
        const files = this.getFileNames(inputDir || undefined);
        this.startConversionLog(inputDir || inputPath, files);

        let processedFiles = 0;
        for (const file of files) {
            const fileInput = path.join(inputDir || inputPath, file);
            const fileName = path.basename(fileInput);
            const fileOutput = path.join(outputDir || outputPath, fileName);
            this.onConversionStart.emit(
                "file-start",
                `Codifica del file "${path.basename(fileInput)}"... (File ${++processedFiles}/${
                    files.length
                })`
            );
            await this.encodeFile(fileInput, fileOutput);
        }
        logger.debug("Codifica terminata");
    }

    /**
     * Codifica audio con multithreading tramite worker pool
     * @param  {string} inputDir - Percorso assoluto della cartella con i file audio
     * @param  {string} outputDir - Percorso assoluto dove salvare i file codificati
     * @param  {number} poolSize - Dimensione della worker pool, default = num di CPU
     */
    public async encodeAllMultithread(
        inputDir?: string,
        outputDir?: string,
        poolSize?: number
    ): Promise<void> {
        const { inputPath, outputPath } = this.prepareFolders();
        const files = this.getFileNames(inputDir || undefined);
        this.startConversionLog(inputDir || inputPath, files);

        const workerPath = path.resolve(__dirname, "../workers/encodeFile.js");
        const pool = new StaticPool({
            size: poolSize || os.cpus().length,
            task: workerPath
        });
        await Promise.all(
            files.map(file => {
                const fileInput = path.join(inputDir || inputPath, file);
                const fileName = path.basename(fileInput);
                const fileOutput = path.join(outputDir || outputPath, fileName);
                // logger.debug(`Pool converte il file "${fileInput}" verso output "${fileOutput}"`);
                return pool.exec({
                    encodeOptions: this.encodeOptions,
                    fileInput,
                    fileOutput
                } as EncodeFileArg);
            })
        );

        logger.debug("Codifica terminata");
    }
}
