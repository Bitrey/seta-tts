import fs from "fs";
import { csv2jsonAsync, ISharedOptions } from "json-2-csv";
import { join } from "path";
import { getResPath } from "../misc/getResPath";
import { logger } from "../misc/logger";
import { Substitutions } from "./Substitutions";

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

        this.jsonContent = Substitutions.fixJsonPronunciation(this.jsonContent);
        logger.info("Alcune pronunce sono state risolte");
    }

    /**
     * Estrapola i nomi delle colonne
     * @param  {any[]} arr - un array di oggetti corrispondente al file CSV convertito in JSON
     */
    private getColumnNames(arr: any[]): string[] {
        return Array.from(new Set(...arr.map(e => Object.keys(e).map(v => v.trim())).slice(0, 10)));
    }
}
