CREATE TYPE "public"."cron_kind" AS ENUM('daily_curate', 'weekly_review', 'anki_flush');--> statement-breakpoint
CREATE TYPE "public"."cron_status" AS ENUM('ok', 'error', 'partial');--> statement-breakpoint
CREATE TYPE "public"."mined_status" AS ENUM('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_kind" AS ENUM('nhk', 'nhk_easy', 'paste', 'url', 'podcast');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source_id" integer,
	"title_jp" text NOT NULL,
	"body_jp" text NOT NULL,
	"tokens_json" jsonb,
	"audio_url" text,
	"transcript" text,
	"generated_aids_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "content_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "source_kind" NOT NULL,
	"source_url" text,
	"source_name" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "conversation_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"topic" text,
	"transcript_json" jsonb,
	"claude_feedback" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" "cron_kind" NOT NULL,
	"status" "cron_status" NOT NULL,
	"summary" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mined_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vocab_id" integer,
	"target_word" text NOT NULL,
	"target_reading" text,
	"definition" text,
	"sentence_jp" text NOT NULL,
	"sentence_translation" text,
	"source_content_id" integer,
	"source_title" text,
	"source_url" text,
	"audio_path" text,
	"audio_filename" text,
	"anki_note_id" text,
	"status" "mined_status" DEFAULT 'pending' NOT NULL,
	"error_msg" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"jlpt_target" text DEFAULT 'N2',
	"daily_minutes_goal" integer DEFAULT 45,
	"anki_funnel_url" text,
	"anki_auth_key" text,
	"anki_main_deck_name" text DEFAULT 'Default',
	"anki_note_type" text DEFAULT 'Kotoba Mined',
	"voicevox_speaker_id" integer DEFAULT 3,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vocabulary" (
	"id" serial PRIMARY KEY NOT NULL,
	"lemma" text NOT NULL,
	"reading" text,
	"jmdict_id" integer,
	"gloss_en" text,
	"pos" text,
	"frequency_rank" integer,
	"jlpt_estimate" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_focus" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"focus_text" text NOT NULL,
	"week_starting" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_items" ADD CONSTRAINT "content_items_source_id_content_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."content_sources"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mined_cards" ADD CONSTRAINT "mined_cards_vocab_id_vocabulary_id_fk" FOREIGN KEY ("vocab_id") REFERENCES "public"."vocabulary"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mined_cards" ADD CONSTRAINT "mined_cards_source_content_id_content_items_id_fk" FOREIGN KEY ("source_content_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "content_items_user_idx" ON "content_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "content_sources_url_uniq" ON "content_sources" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mined_cards_user_status_idx" ON "mined_cards" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vocabulary_lemma_reading_uniq" ON "vocabulary" USING btree ("lemma","reading");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vocabulary_jmdict_idx" ON "vocabulary" USING btree ("jmdict_id");