import axios from "axios";

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export interface ElevenLabsVoiceover {
  buffer: Buffer;
  contentType: string;
  fileExtension: "mp3";
}

export async function generateNarratorVoiceover(
  text: string
): Promise<ElevenLabsVoiceover> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";

  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured");
  }

  const response = await axios.post<ArrayBuffer>(
    `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
    {
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.35,
        use_speaker_boost: true,
      },
    },
    {
      params: { output_format: "mp3_44100_128" },
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
    }
  );

  return {
    buffer: Buffer.from(response.data),
    contentType: "audio/mpeg",
    fileExtension: "mp3",
  };
}
