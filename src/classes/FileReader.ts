import fs from "fs";
import { csv2jsonAsync, ISharedOptions } from "json-2-csv";
import { join } from "path";
import { getResPath } from "../misc/getResPath";
import { logger } from "../misc/logger";

interface TranslationTable {
    [abbrev: string]: string;
}

export class FileReader {
    public readonly filePath: string;
    public readonly rawContent: string;
    public jsonContent: any[] | null = null;
    public columnNames: string[] | null = null;

    /**
     * Bisogna chiamare la funzione asincrona `csvToJson` dopo l'istanziazione
     */
    constructor(filePath: string) {
        this.filePath = filePath;
        this.rawContent = this.readFile();
    }

    private readFile(): string {
        // rimuovo CRLF per avere stringhe pulite
        return fs
            .readFileSync(this.filePath, { encoding: "utf-8" })
            .replace(/(\r\n|\n|\r)/gm, "\n");
    }

    public async csvToJson(csvContent?: string, options?: ISharedOptions): Promise<void> {
        this.jsonContent = await csv2jsonAsync(csvContent?.trim() || this.rawContent.trim(), {
            // visto che i CSV che ho ricevuto hanno come delimitatore un punto e virgola
            // al posto di una virgola, imposto ciò come opzione di default
            ...{ delimiter: { field: ";" } },
            ...(options || {})
        });
        this.columnNames = this.getColumnNames(this.jsonContent as any[]);

        if (this.fixPronunciation()) {
            logger.info("Alcune pronunce sono state risolte");
        } else {
            logger.info("Nessuna pronuncia risolta");
        }
    }

    private fixPronunciation(translationTablePath?: string): boolean {
        if (!this.jsonContent) {
            throw new Error("jsonContent not loaded yet");
        }

        try {
            const table = require(join(getResPath(), "./static/translationTable.json"));
            const abbreviations = Object.keys(table);
            for (const [index, row] of this.jsonContent.entries()) {
                if (typeof row === "object" && row !== null) {
                    for (const prop in row) {
                        while (typeof this.jsonContent[index][prop] === "string") {
                            const foundAbbrev = abbreviations.find(v =>
                                (row[prop] as string)
                                    .trim()
                                    .split(" ")
                                    .some((e: unknown) =>
                                        typeof e === "string" ? e.trim().includes(v) : false
                                    )
                            );
                            if (!foundAbbrev) break;
                            const newWord = (row[prop] as string)
                                .trim()
                                .split(" ")
                                .map((e: unknown) =>
                                    typeof e === "string"
                                        ? e.trim().includes(foundAbbrev)
                                            ? e.trim().replace(foundAbbrev, table[foundAbbrev])
                                            : e
                                        : e
                                );
                            this.jsonContent[index][prop] = newWord.join(" ");
                        }
                    }
                }
            }
            return true;
        } catch (err) {
            logger.error(err);
            return false;
        }
    }

    /**
     * Estrapola i nomi delle colonne
     * @param  {any[]} arr - un array di oggetti corrispondente al file CSV convertito in JSON
     */
    private getColumnNames(arr: any[]): string[] {
        return Array.from(new Set(...arr.map(e => Object.keys(e).map(v => v.trim())).slice(0, 10)));
    }
}

// DEBUG
// const f = new FileReader(
// "C:\\Users\\alessandro.amella\\Documents\\Amella\\fermata\\fermate\\re.csv"
// );
// console.log("ok");
// f.onJsonReady.on("ready", e => console.log(f.columnNames, f.jsonContent));
