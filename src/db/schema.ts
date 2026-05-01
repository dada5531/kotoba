import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from "drizzle-orm/pg-core";

export const sourceKindEnum = pgEnum("source_kind", [
  "nhk",
  "nhk_easy",
  "paste",
  "url",
  "podcast",
]);

export const minedStatusEnum = pgEnum("mined_status", [
  "pending",
  "sent",
  "failed",
]);

export const cronKindEnum = pgEnum("cron_kind", [
  "daily_curate",
  "weekly_review",
  "anki_flush",
]);

export const cronStatusEnum = pgEnum("cron_status", [
  "ok",
  "error",
  "partial",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  jlptTarget: text("jlpt_target").default("N2"),
  dailyMinutesGoal: integer("daily_minutes_goal").default(45),
  ankiFunnelUrl: text("anki_funnel_url"),
  ankiAuthKey: text("anki_auth_key"),
  ankiMainDeckName: text("anki_main_deck_name").default("Default"),
  ankiNoteType: text("anki_note_type").default("Kotoba Mined"),
  voicevoxSpeakerId: integer("voicevox_speaker_id").default(3),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contentSources = pgTable(
  "content_sources",
  {
    id: serial("id").primaryKey(),
    kind: sourceKindEnum("kind").notNull(),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    urlIdx: uniqueIndex("content_sources_url_uniq").on(t.sourceUrl),
  }),
);

export const contentItems = pgTable(
  "content_items",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceId: integer("source_id").references(() => contentSources.id, {
      onDelete: "set null",
    }),
    titleJp: text("title_jp").notNull(),
    bodyJp: text("body_jp").notNull(),
    tokensJson: jsonb("tokens_json"),
    audioUrl: text("audio_url"),
    transcript: text("transcript"),
    generatedAidsJson: jsonb("generated_aids_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("content_items_user_idx").on(t.userId),
  }),
);

export const vocabulary = pgTable(
  "vocabulary",
  {
    id: serial("id").primaryKey(),
    lemma: text("lemma").notNull(),
    reading: text("reading"),
    jmdictId: integer("jmdict_id"),
    glossEn: text("gloss_en"),
    pos: text("pos"),
    frequencyRank: integer("frequency_rank"),
    jlptEstimate: text("jlpt_estimate"),
  },
  (t) => ({
    lemmaReadingIdx: uniqueIndex("vocabulary_lemma_reading_uniq").on(
      t.lemma,
      t.reading,
    ),
    jmdictIdx: index("vocabulary_jmdict_idx").on(t.jmdictId),
  }),
);

export const minedCards = pgTable(
  "mined_cards",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    vocabId: integer("vocab_id").references(() => vocabulary.id, {
      onDelete: "set null",
    }),
    targetWord: text("target_word").notNull(),
    targetReading: text("target_reading"),
    definition: text("definition"),
    sentenceJp: text("sentence_jp").notNull(),
    sentenceTranslation: text("sentence_translation"),
    sourceContentId: integer("source_content_id").references(
      () => contentItems.id,
      { onDelete: "set null" },
    ),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    audioPath: text("audio_path"),
    audioFilename: text("audio_filename"),
    ankiNoteId: text("anki_note_id"),
    status: minedStatusEnum("status").notNull().default("pending"),
    errorMsg: text("error_msg"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => ({
    userStatusIdx: index("mined_cards_user_status_idx").on(t.userId, t.status),
  }),
);

export const conversationSessions = pgTable("conversation_sessions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  topic: text("topic"),
  transcriptJson: jsonb("transcript_json"),
  claudeFeedback: text("claude_feedback"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const cronRuns = pgTable("cron_runs", {
  id: serial("id").primaryKey(),
  kind: cronKindEnum("kind").notNull(),
  status: cronStatusEnum("status").notNull(),
  summary: text("summary"),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const weeklyFocus = pgTable("weekly_focus", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  focusText: text("focus_text").notNull(),
  weekStarting: timestamp("week_starting", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
