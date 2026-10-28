CREATE TABLE "lease_locks" (
	"key" text PRIMARY KEY NOT NULL,
	"token" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
