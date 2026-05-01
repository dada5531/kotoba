"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Initial {
  ankiFunnelUrl: string;
  ankiAuthKey: string;
  ankiMainDeckName: string;
  ankiNoteType: string;
  jlptTarget: string;
  dailyMinutesGoal: number;
  voicevoxSpeakerId: number;
}

export default function SettingsForm({ initial }: { initial: Initial }) {
  const [form, setForm] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const update = <K extends keyof Initial>(k: K, v: Initial[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = () =>
    startSaving(async () => {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSavedAt(new Date().toLocaleTimeString());
    });

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/anki/test", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTestResult(`✓ Connected. ${data.deckCount} decks found.`);
      } else {
        setTestResult(`✗ ${data.error}`);
      }
    } catch (e) {
      setTestResult(`✗ ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Anki bridge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tailscale Funnel URL</Label>
            <Input
              placeholder="https://your-laptop.tail-xxx.ts.net"
              value={form.ankiFunnelUrl}
              onChange={(e) => update("ankiFunnelUrl", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Anki proxy auth key</Label>
            <Input
              type="password"
              placeholder="32+ char random string"
              value={form.ankiAuthKey}
              onChange={(e) => update("ankiAuthKey", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Main deck name</Label>
              <Input
                value={form.ankiMainDeckName}
                onChange={(e) => update("ankiMainDeckName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Note type</Label>
              <Input
                value={form.ankiNoteType}
                onChange={(e) => update("ankiNoteType", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={test} disabled={testing} variant="outline">
              {testing ? "Testing…" : "Test connection"}
            </Button>
            {testResult && (
              <span className="text-sm text-muted-foreground">{testResult}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Study targets</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>JLPT target</Label>
            <Input
              value={form.jlptTarget}
              onChange={(e) => update("jlptTarget", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Daily minutes goal</Label>
            <Input
              type="number"
              value={form.dailyMinutesGoal}
              onChange={(e) =>
                update("dailyMinutesGoal", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>VOICEVOX speaker id</Label>
            <Input
              type="number"
              value={form.voicevoxSpeakerId}
              onChange={(e) =>
                update("voicevoxSpeakerId", Number(e.target.value))
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {savedAt && (
          <span className="text-sm text-muted-foreground">
            Saved at {savedAt}
          </span>
        )}
      </div>
    </div>
  );
}
