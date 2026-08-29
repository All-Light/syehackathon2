/**
 * ElevenLabs text-to-speech over plain HTTP. Not @elevenlabs/react — that is
 * the conversational-agent client and this is one-shot narration.
 *
 * Voice ids below were read off GET /v2/voices on this account, not recalled
 * from memory: a wrong id is a 404 in the middle of a demo.
 */
const BAS = "https://api.elevenlabs.io/v1";
/** A ~60 second briefing takes the multilingual model a few seconds to render,
 *  and the whole clip arrives in one body — so the ceiling is generous. */
const TIMEOUT = Number(process.env.ELEVENLABS_TIMEOUT_MS ?? 60_000);

/** v2 is the model that actually speaks Swedish; turbo/flash clip the prosody
 *  on Swedish compounds and this is a one-off call, so latency is not the
 *  binding constraint. */
const MODELL = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

/** Anders — sv/standard/male/conversational. A native Swede, because
 *  multilingual v2 on an English voice gives Swedish an American accent. */
const ROST_SV = process.env.ELEVENLABS_VOICE_SV ?? "DSL3PSQNPbkOavwmnYl1";
/** Eric — en/american/male/conversational. Briefing tone, not broadcast. */
const ROST_EN = process.env.ELEVENLABS_VOICE_EN ?? "cjVigY5qzO86Huf0OWal";

export function harElevenLabs(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function rostFor(sprak: "sv" | "en"): string {
  return sprak === "sv" ? ROST_SV : ROST_EN;
}

/**
 * Returns the finished mp3 as bytes. Non-streaming on purpose: the clip is
 * about 300 kB, and a single buffered body is one failure mode instead of two.
 */
export async function talSyntes(
  text: string,
  val: { voiceId?: string; sprak?: "sv" | "en" } = {},
): Promise<ArrayBuffer> {
  const nyckel = process.env.ELEVENLABS_API_KEY;
  if (!nyckel) throw new Error("ELEVENLABS_API_KEY is missing from the environment.");

  const rost = val.voiceId ?? rostFor(val.sprak ?? "en");

  const r = await fetch(
    `${BAS}/text-to-speech/${rost}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": nyckel,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODELL,
        voice_settings: {
          // Steady over expressive: this is an adviser reading numbers back to
          // an owner, and a wandering delivery makes the figures sound guessed.
          stability: 0.45,
          similarity_boost: 0.8,
          style: 0.15,
          use_speaker_boost: true,
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    },
  );

  if (!r.ok) {
    throw new Error(
      `ElevenLabs responded ${r.status}: ${(await r.text()).slice(0, 200)}`,
    );
  }

  const ljud = await r.arrayBuffer();
  // A 200 with an empty body has happened on quota edges; it plays as silence,
  // which reads to the user as "the feature is broken" with no error to show.
  if (ljud.byteLength < 2_000) throw new Error("ElevenLabs returned no audio.");
  return ljud;
}
