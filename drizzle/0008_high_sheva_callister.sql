CREATE TABLE "companies" (
	"cnpj" varchar(14) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cvm_code" text NOT NULL,
	"sector" text NOT NULL,
	"website" text,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_cnpj" varchar(14) NOT NULL,
	"document_type" text NOT NULL,
	"record_hash" text NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"value" text NOT NULL,
	"currency" text NOT NULL,
	"scale" text NOT NULL,
	"period" text NOT NULL,
	"reference" text NOT NULL,
	"version" text NOT NULL,
	"exercise" text NOT NULL,
	"group" text NOT NULL,
	"source" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_statements_record_hash_unique" UNIQUE("record_hash")
);
--> statement-breakpoint
CREATE TABLE "official_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_cnpj" varchar(14) NOT NULL,
	"external_id" text NOT NULL,
	"record_hash" text NOT NULL,
	"title" text NOT NULL,
	"category" text NOT NULL,
	"reference" text,
	"published" text,
	"version" text NOT NULL,
	"url" text,
	"source" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_statements" ADD CONSTRAINT "financial_statements_company_cnpj_companies_cnpj_fk" FOREIGN KEY ("company_cnpj") REFERENCES "public"."companies"("cnpj") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "official_documents" ADD CONSTRAINT "official_documents_company_cnpj_companies_cnpj_fk" FOREIGN KEY ("company_cnpj") REFERENCES "public"."companies"("cnpj") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "statements_company_period" ON "financial_statements" USING btree ("company_cnpj","reference","version");--> statement-breakpoint
CREATE UNIQUE INDEX "official_document_revision" ON "official_documents" USING btree ("external_id","record_hash");--> statement-breakpoint
CREATE INDEX "official_company_publication" ON "official_documents" USING btree ("company_cnpj","published");