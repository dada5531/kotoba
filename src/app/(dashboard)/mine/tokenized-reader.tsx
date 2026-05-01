"use client";
import { useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export interface Token {
  surface: string;
  lemma: string;
  reading: string | null;
  pos: string | null;
  jmdict_id: number | null;
}

interface DictHit {
  id: number;
  lemma: string;
  reading: string | null;
  glossEn: string | null;
  pos: string | null;
  frequencyRank: number | null;
  jlptEstimate: string | null;
}

interface Props {
  contentId: number;
  tokens: Token[];
  showFurigana: boolean;
  sourceTitle: string;
  sourceUrl?: string;
}

const SENTENCE_END = /[。！？]/;

export default function TokenizedReader({
  contentId,
  tokens,
  showFurigana,
  sourceTitle,
  sourceUrl,
}: Props) {
  const sentences = useMemo(() => splitSentences(tokens), [tokens]);

  return (
    <div className="space-y-3 font-jp text-lg leading-loose">
      {sentences.map((sent, i) => (
        <SentenceBlock
          key={i}
          tokens={sent}
          showFurigana={showFurigana}
          contentId={contentId}
          sourceTitle={sourceTitle}
          sourceUrl={sourceUrl}
        />
      ))}
    </div>
  );
}

function splitSentences(tokens: Token[]): Token[][] {
  const out: Token[][] = [];
  let cur: Token[] = [];
  for (const t of tokens) {
    cur.push(t);
    if (SENTENCE_END.test(t.surface)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

function SentenceBlock(props: {
  tokens: Token[];
  showFurigana: boolean;
  contentId: number;
  sourceTitle: string;
  sourceUrl?: string;
}) {
  const sentence = props.tokens.map((t) => t.surface).join("");
  return (
    <p>
      {props.tokens.map((t, i) => (
        <TokenSpan
          key={i}
          token={t}
          showFurigana={props.showFurigana}
          sentence={sentence}
          contentId={props.contentId}
          sourceTitle={props.sourceTitle}
          sourceUrl={props.sourceUrl}
        />
      ))}
    </p>
  );
}

function TokenSpan({
  token,
  showFurigana,
  sentence,
  contentId,
  sourceTitle,
  sourceUrl,
}: {
  token: Token;
  showFurigana: boolean;
  sentence: string;
  contentId: number;
  sourceTitle: string;
  sourceUrl?: string;
}) {
  const [hit, setHit] = useState<DictHit | null>(null);
  const [loading, setLoading] = useState(false);
  const [mineState, setMineState] = useState<
    "idle" | "mining" | "mined" | "error"
  >("idle");
  const [mineMsg, setMineMsg] = useState<string | null>(null);

  const lookup = async () => {
    if (hit || loading) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dict?lemma=${encodeURIComponent(token.lemma)}` +
          (token.reading ? `&reading=${encodeURIComponent(token.reading)}` : ""),
      );
      if (res.ok) {
        const data = await res.json();
        setHit(data.entry);
      }
    } finally {
      setLoading(false);
    }
  };

  const mine = async () => {
    setMineState("mining");
    setMineMsg(null);
    try {
      const res = await fetch("/api/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetWord: token.lemma,
          targetReading: token.reading ?? hit?.reading ?? null,
          definition: hit?.glossEn ?? null,
          sentence,
          contentId,
          sourceTitle,
          sourceUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "mine failed");
      setMineState("mined");
      setMineMsg(data.flushed ? "Sent to Anki" : "Queued (laptop offline?)");
    } catch (e) {
      setMineState("error");
      setMineMsg(e instanceof Error ? e.message : "error");
    }
  };

  const isContent = !/^[\s\p{P}\p{S}]+$/u.test(token.surface);
  if (!isContent) return <span>{token.surface}</span>;

  const display =
    showFurigana && token.reading && token.reading !== token.surface ? (
      <ruby>
        {token.surface}
        <rt>{token.reading}</rt>
      </ruby>
    ) : (
      token.surface
    );

  return (
    <Popover onOpenChange={(o) => o && lookup()}>
      <PopoverTrigger asChild>
        <span className="token token-known">{display}</span>
      </PopoverTrigger>
      <PopoverContent>
        <div className="space-y-3">
          <div>
            <div className="font-jp text-2xl">{token.lemma}</div>
            <div className="text-sm text-muted-foreground">
              {hit?.reading ?? token.reading ?? ""}
              {hit?.pos ? ` · ${hit.pos}` : ""}
              {hit?.jlptEstimate ? ` · ${hit.jlptEstimate}` : ""}
            </div>
          </div>
          <div className="text-sm">
            {loading ? "Looking up…" : (hit?.glossEn ?? "(no entry — Claude can fill in on mine)")}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={mine}
              disabled={mineState === "mining" || mineState === "mined"}
            >
              {mineState === "mining"
                ? "Mining…"
                : mineState === "mined"
                  ? "Mined ✓"
                  : "Mine to Anki"}
            </Button>
            {mineMsg && (
              <span
                className={
                  mineState === "error"
                    ? "text-xs text-destructive"
                    : "text-xs text-muted-foreground"
                }
              >
                {mineMsg}
              </span>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
