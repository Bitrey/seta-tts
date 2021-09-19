import { spawn } from "child_process";
import { join } from "path";
import { logger } from "./logger";

interface VoicesReturn {
    expectedVoice: string;
    voices: Voices;
    hasVoice: boolean;
}

interface Voices {
    [SAPI: string]: string[];
}

function outputToObj(output: string): Voices {
    const obj: Voices = {};
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

export function listVoices(expectedVoice: string): Promise<VoicesReturn> {
    return new Promise((resolve, reject) => {
        logger.info("Cerco le voci installate");
        let output = "";
        let voices: string[] = [];

        const child = spawn(join(process.cwd(), "./bin/balcon.exe"), ["-l"]);

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
            // console.log({ output });
            resolve({
                expectedVoice,
                voices: outputToObj(output),
                hasVoice: voices.includes(expectedVoice)
            });
        });
        child.on("error", err => {
            logger.error(err);
            process.exit(1);
        });
    });
}
