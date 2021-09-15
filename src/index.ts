import { Encoder } from "./Encoder";
import { TTS } from "./TTS";

async function test() {
    const tts = new TTS();
    await tts.speak("Prossima fermata: Modena Autostazione.", "modena");
    const encoder = new Encoder();
    await encoder.encodeAll();
}

// test();

import "./FileReader";
