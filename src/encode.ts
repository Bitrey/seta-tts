import fs from "fs";
import path from "path";
import { spawn } from "child_process";

const encodeOptions = require("../settings.json").encoding;

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
            require("../options.json").encoding
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

            console.log(`Converto "${path.basename(input)}" in "${path.basename(outputName)}"...`);

            const child = spawn(Encoder.pathToFfmpeg, args);

            child.stdout.on("data", chunk => {
                console.log(chunk);
            });
            child.on("close", code => {
                console.log("Conversione avvenuta con successo");
                resolve();
            });
            child.on("error", err => {
                console.error("piango :(\n", err);
                process.exit(1);
            });
        });
    }

    public async encodeAll() {
        const { inputPath, outputPath } = this.prepareFolders();
        const files = this.getFileNames();
        console.log("Lista file: " + files.join(", "));
        for (const file of files) {
            const fileInput = path.join(inputPath, file);
            const fileName = path.basename(fileInput);
            const fileOutput = path.join(outputPath, fileName);
            await this.encodeFile(fileInput, fileOutput);
        }
    }
}
