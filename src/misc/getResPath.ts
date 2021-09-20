import { resolve } from "path";
import { cwd, env, resourcesPath } from "process";

export function getResPath() {
    return env.NODE_ENV !== "debug" ? resolve(resourcesPath, "./res") : resolve(cwd(), "./res");
}
