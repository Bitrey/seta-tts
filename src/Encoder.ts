import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { logger } from "./logger";

interface Obj {
    [key: string]: string;
}

export class Encoder {
    public encodeOptions: Obj;
    private static pathToFfmpeg: string = require("ffmpeg-static");
    private static defaultEncodeOptions = {
        bitrate: "24k",
        sampleRate: 11025,
        channels: 1,
        volume: 1.5
    };

    constructor() {
        this.encodeOptions = Object.assign(
            Encoder.defaultEncodeOptions,
            require("../settings.json").encoding
        );
    }

    private prepareFolders(inputDirName = "input", outputDirName = "output") {
        const inputPath = path.join(__dirname, "../", inputDirName);
        if (!fs.existsSync(inputPath)) fs.mkdirSync(inputPath);
        const outputPath = path.join(__dirname, "../", outputDirName);
        if (!fs.existsSync(outputPath)) fs.mkdirSync(outputPath);
        return { inputPath, outputPath };
    }

    private getFileNames(): string[] {
        const { inputPath } = this.prepareFolders();
        return fs.readdirSync(inputPath);
    }

    public encodeFile(input: string, output: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const { bitrate, channels, sampleRate, volume } = this.encodeOptions;
            const outputName = output.replace(/\.[^/.]+$/, "") + ".mp3";

            if (fs.existsSync(outputName)) fs.unlinkSync(outputName);

            const args = [
                "-i",
                input,
                "-vn",
                "-ar",
                sampleRate.toString(),
                "-filter:a",
                `"volume=${volume}"`,
                "-ac",
                channels.toString(),
                "-b:a",
                bitrate.toString(),
                outputName
            ];

            logger.info(`Converto "${path.basename(input)}" in "${path.basename(outputName)}"...`);

            const child = spawn(Encoder.pathToFfmpeg, args);

            child.stdout.on("data", chunk => {
                logger.debug(chunk);
            });
            child.on("close", code => {
                logger.info("Conversione avvenuta con successo");
                resolve();
            });
            child.on("error", err => {
                logger.error(err);
                process.exit(1);
            });
        });
    }

    public async encodeAll() {
        const { inputPath, outputPath } = this.prepareFolders();
        const files = this.getFileNames();
        logger.info("Lista file: " + files.join(", "));
        for (const file of files) {
            const fileInput = path.join(inputPath, file);
            const fileName = path.basename(fileInput);
            const fileOutput = path.join(outputPath, fileName);
            await this.encodeFile(fileInput, fileOutput);
        }
    }
}
