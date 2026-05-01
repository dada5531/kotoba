// AnkiConnect client. Talks to a Tailscale Funnel URL fronted by a Caddy
// reverse proxy that enforces the X-Anki-Key header (AnkiConnect itself
// has no auth).

export interface AnkiConfig {
  funnelUrl: string;
  authKey: string;
}

export interface AnkiResponse<T> {
  result: T | null;
  error: string | null;
}

export class AnkiError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "connection"
      | "auth"
      | "duplicate"
      | "missing_deck"
      | "missing_model"
      | "other",
  ) {
    super(message);
  }
}

export async function ankiInvoke<T>(
  cfg: AnkiConfig,
  action: string,
  params: Record<string, unknown> = {},
): Promise<T> {
  const url = cfg.funnelUrl.replace(/\/$/, "");
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Anki-Key": cfg.authKey,
      },
      body: JSON.stringify({ action, version: 6, params }),
      cache: "no-store",
      // Keep the call short — laptop offline is the common case.
      signal: AbortSignal.timeout(8_000),
    });
  } catch (e) {
    throw new AnkiError(
      `cannot reach AnkiConnect: ${e instanceof Error ? e.message : String(e)}`,
      "connection",
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new AnkiError("auth rejected by proxy", "auth");
  }
  if (!res.ok) {
    throw new AnkiError(`http ${res.status}`, "other");
  }
  const body = (await res.json()) as AnkiResponse<T>;
  if (body.error) {
    if (/duplicate/i.test(body.error))
      throw new AnkiError(body.error, "duplicate");
    if (/deck/i.test(body.error) && /not.*found|exist/i.test(body.error))
      throw new AnkiError(body.error, "missing_deck");
    if (/model/i.test(body.error) && /not.*found|exist/i.test(body.error))
      throw new AnkiError(body.error, "missing_model");
    throw new AnkiError(body.error, "other");
  }
  return body.result as T;
}

export const KOTOBA_NOTE_TYPE = {
  modelName: "Kotoba Mined",
  inOrderFields: [
    "Expression",
    "TargetWord",
    "Reading",
    "Definition",
    "SentenceAudio",
    "SourceTitle",
    "SourceUrl",
    "MinedAt",
  ],
  css:
    ".card { font-family: 'Hiragino Sans', 'Yu Gothic', sans-serif; font-size: 22px; text-align: center; }\n" +
    ".target { font-size: 28px; margin-top: 12px; }\n" +
    ".def { color: #444; margin-top: 6px; }\n" +
    ".source { color: #888; font-size: 12px; margin-top: 12px; }",
  cardTemplates: [
    {
      Name: "Sentence → Meaning",
      Front: "{{Expression}}<br>{{SentenceAudio}}",
      Back:
        "{{FrontSide}}<hr>" +
        "<div class='target'>{{TargetWord}}【{{Reading}}】</div>" +
        "<div class='def'>{{Definition}}</div>" +
        "<div class='source'>{{SourceTitle}}</div>",
    },
  ],
};

export async function ensureNoteType(cfg: AnkiConfig) {
  const names = await ankiInvoke<string[]>(cfg, "modelNames");
  if (names.includes(KOTOBA_NOTE_TYPE.modelName)) return;
  await ankiInvoke(cfg, "createModel", {
    modelName: KOTOBA_NOTE_TYPE.modelName,
    inOrderFields: KOTOBA_NOTE_TYPE.inOrderFields,
    css: KOTOBA_NOTE_TYPE.css,
    cardTemplates: KOTOBA_NOTE_TYPE.cardTemplates,
  });
}

export async function ensureDeck(cfg: AnkiConfig, deckName: string) {
  await ankiInvoke(cfg, "createDeck", { deck: deckName });
}

export interface AnkiNoteInput {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags?: string[];
  audio?: { filename: string; data: string }[]; // base64 data
}

export async function addNote(cfg: AnkiConfig, note: AnkiNoteInput) {
  return ankiInvoke<number>(cfg, "addNote", {
    note: {
      deckName: note.deckName,
      modelName: note.modelName,
      fields: note.fields,
      tags: note.tags ?? ["kotoba"],
      audio: note.audio?.map((a) => ({
        filename: a.filename,
        data: a.data,
        fields: ["SentenceAudio"],
      })),
      options: { allowDuplicate: false, duplicateScope: "deck" },
    },
  });
}

export async function findNotesByExpression(cfg: AnkiConfig, sentence: string) {
  // Anki search escapes are minimal: just escape quotes.
  const escaped = sentence.replace(/"/g, '\\"');
  return ankiInvoke<number[]>(cfg, "findNotes", {
    query: `Expression:"${escaped}"`,
  });
}

export async function deckNames(cfg: AnkiConfig) {
  return ankiInvoke<string[]>(cfg, "deckNames");
}
