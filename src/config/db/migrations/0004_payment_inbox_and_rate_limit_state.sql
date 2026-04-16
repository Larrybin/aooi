CREATE TABLE "payment_webhook_inbox" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_id" text,
	"event_type" text,
	"raw_body" text NOT NULL,
	"raw_headers" text NOT NULL,
	"raw_digest" text NOT NULL,
	"canonical_event" text,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"operator_user_id" text,
	"operator_note" text,
	"received_at" timestamp NOT NULL,
	"last_processed_at" timestamp,
	"last_error" text,
	"processing_attempt_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_rate_limit_state" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket" text NOT NULL,
	"scope_key" text NOT NULL,
	"last_action_at" timestamp,
	"window_started_at" timestamp,
	"count" integer DEFAULT 0 NOT NULL,
	"inflight" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_webhook_inbox" ADD CONSTRAINT "payment_webhook_inbox_operator_user_id_user_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_webhook_inbox_provider_digest" ON "payment_webhook_inbox" USING btree ("provider","raw_digest");
--> statement-breakpoint
CREATE INDEX "idx_payment_webhook_inbox_received_at" ON "payment_webhook_inbox" USING btree ("received_at");
--> statement-breakpoint
CREATE INDEX "idx_payment_webhook_inbox_event_id" ON "payment_webhook_inbox" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "idx_payment_webhook_inbox_status" ON "payment_webhook_inbox" USING btree ("status");
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_api_rate_limit_state_bucket_scope" ON "api_rate_limit_state" USING btree ("bucket","scope_key");
--> statement-breakpoint
CREATE INDEX "idx_api_rate_limit_state_expires_at" ON "api_rate_limit_state" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "idx_api_rate_limit_state_bucket" ON "api_rate_limit_state" USING btree ("bucket");
--> statement-breakpoint
ALTER TABLE "public"."payment_webhook_inbox" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."api_rate_limit_state" ENABLE ROW LEVEL SECURITY;
