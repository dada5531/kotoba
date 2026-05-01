// Client for the Python Sudachi sidecar (see services/sudachi/).
// Falls back to a naive whitespace-by-character splitter if the sidecar
// isn't reachable, so the UI degrades instead of crashing.

export interface Token {
  surface: string;
  lemma: string;
  reading: string | null;
  pos: string | null;
  jmdict_id: number | null;
}

const BASE = process.env.SUDACHI_BASE_URL?.replace(/\/$/, "") ?? "";

export async function tokenize(text: string): Promise<Token[]> {
  if (BASE) {
    try {
      const res = await fetch(`${BASE}/tokenize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const data = (await res.json()) as { tokens: Token[] };
        return data.tokens;
      }
    } catch {
      // fall through to fallback
    }
  }
  return fallbackTokens(text);
}

// Character-level fallback. Groups runs of the same script (kanji, kana,
// latin, digits, punct) so the UI is still usable without Sudachi.
function fallbackTokens(text: string): Token[] {
  const out: Token[] = [];
  let buf = "";
  let bufKind = "";
  for (const ch of text) {
    const k = scriptKind(ch);
    if (k !== bufKind && buf.length > 0) {
      out.push(toToken(buf));
      buf = "";
    }
    bufKind = k;
    buf += ch;
  }
  if (buf.length > 0) out.push(toToken(buf));
  return out;
}

function toToken(surface: string): Token {
  return {
    surface,
    lemma: surface,
    reading: null,
    pos: null,
    jmdict_id: null,
  };
}

function scriptKind(ch: string): string {
  const c = ch.charCodeAt(0);
  if (c >= 0x3040 && c <= 0x309f) return "hira";
  if (c >= 0x30a0 && c <= 0x30ff) return "kata";
  if (c >= 0x4e00 && c <= 0x9fff) return "kanji";
  if (/\s/.test(ch)) return "space";
  if (/[a-zA-Z]/.test(ch)) return "latin";
  if (/[0-9０-９]/.test(ch)) return "digit";
  return "punct";
}

export function isContentToken(t: Token) {
  if (!t.surface.trim()) return false;
  if (/^[\p{P}\p{S}]+$/u.test(t.surface)) return false;
  if (t.pos && /記号|助詞|助動詞/.test(t.pos)) return false;
  return true;
}
