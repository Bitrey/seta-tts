import { join } from "path";
import { getResPath } from "../misc/getResPath";
import { logger } from "../misc/logger";
import { AnyObj } from "./AnyObj";

export class Substitutions {
    static table: AnyObj = {};

    private static _loadTable = (function () {
        Substitutions.loadTranslationTable();
    })();

    public static loadTranslationTable(): boolean {
        try {
            Substitutions.table = require(join(getResPath(), "./static/translationTable.json"));
            return true;
        } catch (err) {
            logger.error(err);
            return false;
        }
    }

    public static fixPronunciation(str: string): string {
        const abbreviations = Object.keys(Substitutions.table);

        let maxIterations = 20;
        while (maxIterations--) {
            const foundAbbrev = abbreviations.find(v =>
                str
                    .trim()
                    .split(" ")
                    .some((e: unknown) => (typeof e === "string" ? e.trim().includes(v) : false))
            );
            if (!foundAbbrev) break;
            const newWord = str
                .trim()
                .split(" ")
                .map((e: unknown) =>
                    typeof e === "string"
                        ? e.trim().includes(foundAbbrev)
                            ? e.trim().replace(foundAbbrev, this.table[foundAbbrev])
                            : e
                        : e
                );
            return newWord.join(" ");
        }
        return str;
    }

    public static fixJsonPronunciation(jsonArr: AnyObj[]): AnyObj[] {
        const arr = [...jsonArr];
        for (const [index, row] of arr.entries()) {
            if (typeof row === "object" && row !== null) {
                for (const prop in row) {
                    if (typeof arr[index][prop] === "string") {
                        arr[index][prop] = Substitutions.fixPronunciation(arr[index][prop]);
                    }
                }
            }
        }
        return arr;
    }

    /**
     * Usata per rimpiazzare solo le variabili, SENZA APPLICARE LE SOSTITUZIONI
     */
    private static formatVariables(str: string, row: AnyObj): string {
        let newStr = str;
        const matches = newStr.match(/\{(.*?)\}/g);
        if (!matches) return newStr;
        for (const match of matches) {
            const m = match.replace(/\{\ *|\ *}/g, "");
            if (m in row) {
                newStr = this.fixPronunciation(newStr.replace(match, row[m]));
            }
        }
        return newStr;
    }

    public static formatString(str: string, row: AnyObj): string {
        let newStr = str;
        if (row) newStr = Substitutions.formatVariables(newStr, row);
        newStr = Substitutions.fixPronunciation(newStr);
        logger.debug("formatString " + str + " -> " + newStr);
        return newStr;
    }
}
