import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  uniqueIndex,
  varchar,
  jsonb,
  integer,
  boolean,
  index,
  vector,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: text("github_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const watchlists = pgTable(
  "watchlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ticker: varchar("ticker", { length: 12 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("watchlists_owner_ticker").on(t.userId, t.ticker)],
);

export const dataCache = pgTable("data_cache", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const formulas = pgTable("formulas", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const formulaVersions = pgTable(
  "formula_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formulaId: uuid("formula_id")
      .notNull()
      .references(() => formulas.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("formula_version_unique").on(t.formulaId, t.version)],
);
export const valuationRuns = pgTable(
  "valuation_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    versionId: uuid("version_id").references(() => formulaVersions.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    inputs: jsonb("inputs").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("runs_user_date").on(t.userId, t.createdAt)],
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    title: text("title"),
    author: text("author"),
    category: text("category").notNull(),
    pathname: text("pathname").notNull().unique(),
    hash: text("hash"),
    status: text("status").notNull().default("pending"),
    error: text("error"),
    size: integer("size"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("documents_owner_hash").on(t.userId, t.hash),
    index("documents_owner").on(t.userId),
  ],
);
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    location: text("location").notNull(),
    content: text("content").notNull(),
  },
  (t) => [uniqueIndex("chunks_document_ordinal").on(t.documentId, t.ordinal)],
);

export const embeddings = pgTable("document_embeddings", {
  chunkId: uuid("chunk_id")
    .primaryKey()
    .references(() => documentChunks.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    documentIds: jsonb("document_ids").$type<string[]>().notNull(),
    question: text("question").notNull(),
    requestKey: text("request_key").unique(),
    reportDraft: text("report_draft"),
    answer: jsonb("answer").notNull(),
    sources: jsonb("sources").notNull(),
    model: text("model").notNull(),
    tokens: integer("tokens").notNull(),
    estimated: boolean("estimated").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("ai_user_date").on(t.userId, t.createdAt)],
);
export const requestLimits = pgTable("request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const syncJobs = pgTable(
  "sync_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull().unique(),
    sourceKey: text("source_key"),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: timestamp("available_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lockToken: uuid("lock_token"),
    result: text("result"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("jobs_status_due").on(t.status, t.availableAt),
    uniqueIndex("jobs_one_active_source")
      .on(t.sourceKey)
      .where(sql`${t.status} IN ('queued','running')`),
  ],
);
export const syncSources = pgTable("sync_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull().unique(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const leaseLocks = pgTable("lease_locks", {
  key: text("key").primaryKey(),
  token: uuid("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const companies = pgTable("companies", {
  cnpj: varchar("cnpj", { length: 14 }).primaryKey(),
  name: text("name").notNull(),
  cvmCode: text("cvm_code").notNull(),
  sector: text("sector").notNull(),
  website: text("website"),
  status: text("status").notNull(),
  source: text("source").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const officialDocuments = pgTable(
  "official_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyCnpj: varchar("company_cnpj", { length: 14 })
      .notNull()
      .references(() => companies.cnpj),
    externalId: text("external_id").notNull(),
    recordHash: text("record_hash").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    reference: text("reference"),
    published: text("published"),
    version: text("version").notNull(),
    url: text("url"),
    source: text("source").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("official_document_revision").on(t.externalId, t.recordHash),
    index("official_company_publication").on(t.companyCnpj, t.published),
  ],
);
export const financialStatements = pgTable(
  "financial_statements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyCnpj: varchar("company_cnpj", { length: 14 })
      .notNull()
      .references(() => companies.cnpj),
    documentType: text("document_type").notNull(),
    recordHash: text("record_hash").notNull().unique(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    currency: text("currency").notNull(),
    scale: text("scale").notNull(),
    period: text("period").notNull(),
    reference: text("reference").notNull(),
    version: text("version").notNull(),
    exercise: text("exercise").notNull(),
    group: text("group").notNull(),
    source: text("source").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("statements_company_period").on(
      t.companyCnpj,
      t.reference,
      t.version,
    ),
  ],
);
