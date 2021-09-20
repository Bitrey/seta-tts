import dotenv from "dotenv";
import { join } from "path";
import { cwd } from "process";

export function loadEnv() {
    dotenv.config({ path: join(cwd(), "./.env") });
}
