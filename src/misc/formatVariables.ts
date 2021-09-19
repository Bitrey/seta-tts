import { AnyObj } from "../classes/AnyObj";

export function formatVariables(str: string, row: AnyObj): string {
    const matches = str.match(/\{(.*?)\}/g);
    if (!matches) return str;
    for (const match of matches) {
        const m = match.replace(/\{\ *|\ *}/g, "");
        if (m in <any>row) {
            str = str.replace(match, row[<any>m]);
        }
    }
    return str;
}
