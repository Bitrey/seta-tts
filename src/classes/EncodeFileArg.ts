import { EncodeOptions } from "./EncodeOptions";

export interface EncodeFileArg {
    pathToFfmpeg: string;
    encodeOptions: EncodeOptions;
    fileInput: string;
    fileOutput: string;
}
