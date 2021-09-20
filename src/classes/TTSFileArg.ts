import { AnyObj } from "./AnyObj";

export interface TTSFileArg {
    voice: string;
    ttsString: string;
    fileName: string;
    row: AnyObj;
    finalFormat: string;
    outputPath?: string;
}
