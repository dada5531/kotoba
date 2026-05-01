"use client";
import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/utils";

interface MinedRow {
  id: number;
  targetWord: string;
  sentenceJp: string;
  status: "pending" | "sent" | "failed";
  errorMsg: string | null;
  createdAt: string;
}

export default function RecentMines({ initial }: { initial: MinedRow[] }) {
  const [cards, setCards] = useState<MinedRow[]>(initial);
  const [flushing, setFlushing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const res = await fetch("/api/mine/recent");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
  };

  useEffect(() => {
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, []);

  const flush = async () => {
    setFlushing(true);
    setMsg(null);
    try {
      const res = await fetch("/api/anki/flush", { method: "POST" });
      const data = await res.json();
      setMsg(
        `${data.sent ?? 0} sent, ${data.pending ?? 0} pending, ${data.failed ?? 0} failed`,
      );
      await refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "error");
    } finally {
      setFlushing(false);
    }
  };

  const pending = cards.filter((c) => c.status === "pending").length;
  const failed = cards.filter((c) => c.status === "failed").length;

  return (
    <Card className="lg:sticky lg:top-4 self-start">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Recent mines
          <div className="flex gap-1 text-xs font-normal">
            {pending > 0 && (
              <Badge variant="warning">{pending} pending</Badge>
            )}
            {failed > 0 && (
              <Badge variant="destructive">{failed} failed</Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex gap-2">
          <Button
            size="sm"
            onClick={flush}
            disabled={flushing}
            variant="outline"
          >
            {flushing ? "Syncing…" : "Sync now"}
          </Button>
          {msg && (
            <span className="self-center text-xs text-muted-foreground">
              {msg}
            </span>
          )}
        </div>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto text-sm">
          {cards.length === 0 && (
            <li className="text-muted-foreground">No mines yet.</li>
          )}
          {cards.map((c) => (
            <li
              key={c.id}
              className="rounded-md border p-2 leading-snug"
              title={c.errorMsg ?? undefined}
            >
              <div className="flex items-center justify-between">
                <span className="font-jp font-medium">{c.targetWord}</span>
                <StatusBadge status={c.status} />
              </div>
              <div className="line-clamp-2 text-muted-foreground">
                {c.sentenceJp}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatRelative(c.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: MinedRow["status"] }) {
  if (status === "sent") return <Badge variant="success">sent</Badge>;
  if (status === "pending") return <Badge variant="warning">pending</Badge>;
  return <Badge variant="destructive">failed</Badge>;
}
