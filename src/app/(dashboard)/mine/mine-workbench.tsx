"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import TokenizedReader, { type Token } from "./tokenized-reader";

interface IngestResult {
  contentId: number;
  title: string;
  body: string;
  tokens: Token[];
  sourceUrl?: string;
}

export default function MineWorkbench() {
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IngestResult | null>(null);
  const [furigana, setFurigana] = useState(false);

  async function ingest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url || undefined,
          text: paste || undefined,
          title: title || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ingest failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ingest failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mine new content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Source URL (NHK, NHK Easy, or any article)</Label>
            <Input
              placeholder="https://www3.nhk.or.jp/news/easy/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="text-center text-xs text-muted-foreground">— or —</div>
          <div className="space-y-2">
            <Label>Paste Japanese text</Label>
            <Textarea
              rows={6}
              placeholder="Paste a sentence, paragraph, tweet, manga line — anything."
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short label for this passage"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button
              onClick={ingest}
              disabled={loading || (!url && !paste.trim())}
            >
              {loading ? "Ingesting…" : "Tokenize"}
            </Button>
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{result.title}</CardTitle>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={furigana}
                  onChange={(e) => setFurigana(e.target.checked)}
                />
                Furigana
              </label>
            </div>
          </CardHeader>
          <CardContent>
            <TokenizedReader
              contentId={result.contentId}
              tokens={result.tokens}
              showFurigana={furigana}
              sourceTitle={result.title}
              sourceUrl={result.sourceUrl}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
