import { loadEnv } from "./loadEnv";
import { createTmpFolder } from "./tmpFolder";

loadEnv();
const tmpDir = createTmpFolder();

import { logger } from "../misc/logger";
logger.info("tmpDir: " + tmpDir);
logger.info("NODE_ENV: " + process.env.NODE_ENV);

import "./handleExceptions";
logger.info("uncaughtException fallback loaded");
