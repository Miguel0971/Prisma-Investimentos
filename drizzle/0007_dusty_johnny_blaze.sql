ALTER TABLE "ai_conversations" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD COLUMN "report_draft" text;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_request_key_unique" UNIQUE("request_key");