import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
// import trash from "trash";
import { shell } from "electron";
import { EventEmitter } from "stream";
import { StaticPool } from "node-worker-threads-pool";
import { logger } from "../misc/logger";
import { EncodeFileArg } from "./EncodeFileArg";
import { EncodeOptions } from "./EncodeOptions";
import { cwd } from "process";
import { getResPath } from "../misc/getResPath";

export class Encoder {
    public encodeOptions: EncodeOptions;
    public static readonly pathToFfmpeg = path.join(getResPath(), "./bin/ffmpeg.exe");
    public static readonly defaultEncodeOptions = {
        bitrate: "24k",
        sampleRate: 11025,
        channels: 1,
        volume: 1.5
    };
    public readonly onConversionStart: EventEmitter;

    constructor(settings: EncodeOptions) {
        this.encodeOptions = {
            ...Encoder.defaultEncodeOptions,
            ...settings
        };
        this.onConversionStart = new EventEmitter();
        this.prepareFolders();
    }

    public async clearTmpDir(tmpDirPath = path.join(os.tmpdir(), "./seta-tts/output.tmp")) {
        if (!fs.existsSync(tmpDirPath)) {
            logger.debug(`tmpDirPath "${tmpDirPath} non esistente`);
            return;
        }
        logger.info(`I file dentro "${tmpDirPath}" verranno cestinati`);
        await Promise.all(
            fs.readdirSync(tmpDirPath).map(file => {
                logger.debug(`Cestino "${file}"...`);
                this.onConversionStart.emit("file-start", `Sto cestinando il file "${file}"`);
                return shell.trashItem(path.join(tmpDirPath, file));
            })
        );
    }

    private prepareFolders(inputDirName = "output.tmp", outputDirName = "output") {
        const inputPath = path.join(os.tmpdir(), "./seta-tts/", inputDirName);
        if (!fs.existsSync(inputPath)) {
            logger.debug(`Creo la cartella di input (tmp) in "${inputPath}"`);
            fs.mkdirSync(inputPath);
        }
        const outputPath = path.join(os.tmpdir(), "./seta-tts/", outputDirName);
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
            const { bitrate, channels, sampleRate, volume, sampleFormat } = this.encodeOptions;
            const outputName = output.replace(/\.[^/.]+$/, "") + path.extname(output);
            const fName = path.basename(outputName);

            if (fs.existsSync(outputName)) {
                logger.info(`"${fName}" esiste già e verrà cestinato`);
                this.onConversionStart.emit("file-start", `Sto cestinando il file "${fName}"`);
                await shell.trashItem(outputName);
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
                bitrate.toString()
            ];
            if (path.extname(output).endsWith("wav")) {
                args.push(...["-c:a", sampleFormat]);
            }
            args.push(outputName);

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
                logger.info(`Conversione completata (exit code ${code})`);
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

        // await Promise.all(
        //     files
        //         .map(file => {
        //             const fileInput = path.join(inputDir || inputPath, file);
        //             const fileName = path.basename(fileInput);
        //             const fileOutput = path.join(outputDir || outputPath, fileName);

        //             // Qua che hai accesso alla shell, cestina file già esistenti
        //             const outputName =
        //                 fileOutput.replace(/\.[^/.]+$/, "") + path.extname(fileOutput);
        //             const fName = path.basename(outputName);

        //             return { outputName, fName };
        //         })
        //         .filter(e => fs.existsSync((e as any).outputName))
        //         .map((e: any) => {
        //             if (fs.existsSync(e.outputName)) {
        //                 logger.info(`"${e.fName}" esiste gia' e verra' cestinato`);
        //                 this.onConversionStart.emit(
        //                     "file-start",
        //                     `Sto cestinando il file "${e.fName}"`
        //                 );
        //                 return shell.trashItem(e.outputName);
        //             }
        //         })
        // );

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

        const debugPath = path.resolve(__dirname, "../workers/encodeFile.js");
        const workerPath = fs.existsSync(debugPath)
            ? debugPath
            : path.resolve(cwd(), "./build/workers/encodeFile.js");
        const pool = new StaticPool({
            size: poolSize || os.cpus().length,
            task: workerPath
        });
        // await Promise.all(
        //     files
        //         .map(file => {
        //             const fileInput = path.join(inputDir || inputPath, file);
        //             const fileName = path.basename(fileInput);
        //             const fileOutput = path.join(outputDir || outputPath, fileName);

        //             // Qua che hai accesso alla shell, cestina file già esistenti
        //             const outputName =
        //                 fileOutput.replace(/\.[^/.]+$/, "") + path.extname(fileOutput);
        //             const fName = path.basename(outputName);

        //             return { outputName, fName };
        //         })
        //         .filter(e => fs.existsSync((e as any).outputName))
        //         .map((e: any) => {
        //             if (fs.existsSync(e.outputName)) {
        //                 logger.info(`"${e.fName}" esiste gia' e verra' cestinato`);
        //                 this.onConversionStart.emit(
        //                     "file-start",
        //                     `Sto cestinando il file "${e.fName}"`
        //                 );
        //                 return shell.trashItem(e.outputName);
        //             }
        //         })
        // );
        await Promise.all(
            files.map(async file => {
                const fileInput = path.join(inputDir || inputPath, file);
                const fileName = path.basename(fileInput);
                const fileOutput = path.join(outputDir || outputPath, fileName);

                // Qua che hai accesso alla shell, cestina file già esistenti
                const outputName = fileOutput.replace(/\.[^/.]+$/, "") + path.extname(fileOutput);
                const fName = path.basename(outputName);

                if (fs.existsSync(outputName)) {
                    logger.info(`"${fName}" esiste gia' e verra' cestinato`);
                    this.onConversionStart.emit("file-start", `Sto cestinando il file "${fName}"`);
                    await shell.trashItem(outputName);
                }

                logger.info(`Pool converte il file "${fileInput}" verso output "${fileOutput}"`);
                const args: EncodeFileArg = {
                    pathToFfmpeg: Encoder.pathToFfmpeg,
                    encodeOptions: this.encodeOptions,
                    fileInput,
                    fileOutput
                };
                return pool.exec(args);
            })
        );

        logger.debug("Codifica terminata");
    }
}
