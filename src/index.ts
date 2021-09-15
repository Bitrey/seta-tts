import { app, BrowserWindow } from "electron";

import { Encoder } from "./classes/Encoder";
import { TTS } from "./classes/TTS";

// DEBUG
import "./classes/FileReader";

// DEBUG
import "./gui/electron";

async function test() {
    const tts = new TTS();
    await tts.speak("Sono una prova. Prossima fermata: San Cesario.", "sancesario");
    const encoder = new Encoder();
    await encoder.encodeAll();
}

// test();
