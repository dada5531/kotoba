// Thin client over a self-hosted VOICEVOX engine.
// Two-step API: POST /audio_query?text=...&speaker=N → POST /synthesis?speaker=N

const BASE = process.env.VOICEVOX_BASE_URL?.replace(/\/$/, "") ?? "";
const SPEAKER = Number(process.env.VOICEVOX_SPEAKER_ID ?? 3);

export async function synthesize(
  text: string,
  speaker: number = SPEAKER,
): Promise<ArrayBuffer> {
  if (!BASE) throw new Error("VOICEVOX_BASE_URL not set");

  const queryRes = await fetch(
    `${BASE}/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`,
    { method: "POST", signal: AbortSignal.timeout(20_000) },
  );
  if (!queryRes.ok) {
    throw new Error(`voicevox audio_query failed: ${queryRes.status}`);
  }
  const query = await queryRes.json();

  const synthRes = await fetch(`${BASE}/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(60_000),
  });
  if (!synthRes.ok) {
    throw new Error(`voicevox synthesis failed: ${synthRes.status}`);
  }
  return await synthRes.arrayBuffer();
}

export function audioFilename(seed: string) {
  // Anki media filenames must be unique per file content.
  const hash = simpleHash(seed);
  return `kotoba_${hash}.wav`;
}

function simpleHash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export function bufferToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64");
}
