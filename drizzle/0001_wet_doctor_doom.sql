CREATE TABLE "data_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
