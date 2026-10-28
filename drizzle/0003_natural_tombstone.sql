CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"location" text NOT NULL,
	"content" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"author" text,
	"category" text NOT NULL,
	"pathname" text NOT NULL,
	"hash" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_pathname_unique" UNIQUE("pathname")
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chunks_document_ordinal" ON "document_chunks" USING btree ("document_id","ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_owner_hash" ON "documents" USING btree ("user_id","hash");--> statement-breakpoint
CREATE INDEX "documents_owner" ON "documents" USING btree ("user_id");