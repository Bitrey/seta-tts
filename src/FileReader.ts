import fs from "fs";
import path from "path";
import { csv2jsonAsync, ISharedOptions } from "json-2-csv";

export class FileReader {
    public readFile(): string {
        return fs.readFileSync(path.join(__dirname, "../fermate/re.csv"), { encoding: "utf-8" });
    }

    public async csvToJson(csvContent: string, options?: ISharedOptions) {
        return await csv2jsonAsync(csvContent, {
            // visto che i CSV che ho ricevuto hanno come delimitatore un punto e virgola
            // al posto di una virgola, imposto ciò come opzione di default
            ...{ delimiter: { field: ";" } },
            ...(options || {})
        });
    }

    /**
     * Estrapola i nomi delle colonne
     * @param  {any[]} arr - un array di oggetti corrispondente al file CSV convertito in JSON
     */
    private columnNames(arr: any[]): string[] {
        return Array.from(new Set(...arr.map(e => Object.keys(e).map(v => v.trim())).slice(0, 10)));
    }
}
