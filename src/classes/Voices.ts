import { spawn } from "child_process";
import { join } from "path";
import { getResPath } from "../misc/getResPath";
import { logger } from "../misc/logger";

export interface VoicesReturn {
    expectedVoices: string[];
    voices: VoicesObj;
    voicesArr: string[];
    hasVoices: boolean;
    missingVoices: string[];
    msg: string;
}

export interface VoicesObj {
    [SAPI: string]: string[];
}

export class Voices {
    expectedVoices: string[];

    constructor(expectedVoices = ["Loquendo Roberto", "Loquendo Paola"]) {
        this.expectedVoices = expectedVoices;
    }

    private outputToObj(output: string): VoicesObj {
        const obj: VoicesObj = {};
        for (const str of output.trim().split(/\r\n|\n/g)) {
            if (!str.startsWith(" ")) {
                obj[(str.endsWith(":") ? str.slice(0, str.length - 1) : str).trim()] = [];
            } else {
                const k = Object.keys(obj);
                obj[k[k.length - 1]].push(str.trim());
            }
        }
        return obj;
    }

    public listVoices(): Promise<VoicesReturn> {
        return new Promise((resolve, reject) => {
            logger.info("Cerco le voci installate");
            let output = "";
            let voices: string[] = [];

            const child = spawn(join(getResPath(), "./bin/balcon.exe"), ["-l"]);

            child.stdout.on("data", (chunk: Buffer) => {
                logger.info(`stdout in listVoices": ${chunk.toString().trim()}`);
                output += chunk.toString();
                voices.push(
                    ...chunk
                        .toString()
                        .trim()
                        .split(/\r\n|\n/g)
                        .map(e => e.trim())
                );
            });
            child.stderr.on("data", chunk => {
                logger.info(`stderr in listVoices": ${chunk.toString().trim()}`);
            });
            child.on("close", code => {
                logger.info(`listVoices terminato (exit code ${code})`);
                const obj = this.outputToObj(output);
                const voicesArr: string[] = [].concat.apply([], Object.values(obj) as any);

                const hasAllVoices = this.expectedVoices.every(v => voicesArr.includes(v));
                const hasSomeVoices = this.expectedVoices.some(v => voicesArr.includes(v));
                const missingVoices = this.expectedVoices.filter(v => !voicesArr.includes(v));

                resolve({
                    expectedVoices: this.expectedVoices,
                    voices: obj,
                    voicesArr,
                    hasVoices: hasSomeVoices,
                    missingVoices,
                    msg: hasAllVoices
                        ? "Voci installate correttamente"
                        : hasSomeVoices
                        ? "Però alcune voci non sono installate"
                        : "Nessuna voce installata"
                });
            });
            child.on("error", err => {
                logger.error(err);
                process.exit(1);
            });
        });
    }

    public async isVoiceInstalled(voiceName: string) {
        return (await this.listVoices()).voicesArr.includes(voiceName);
    }
}
