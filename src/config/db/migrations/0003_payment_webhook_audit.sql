CREATE TABLE "payment_webhook_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"event_id" text,
	"raw_digest" text NOT NULL,
	"received_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payment_webhook_audit_provider_digest" ON "payment_webhook_audit" USING btree ("provider","raw_digest");
--> statement-breakpoint
CREATE INDEX "idx_payment_webhook_audit_received_at" ON "payment_webhook_audit" USING btree ("received_at");
--> statement-breakpoint
CREATE INDEX "idx_payment_webhook_audit_event_id" ON "payment_webhook_audit" USING btree ("event_id");
--> statement-breakpoint
ALTER TABLE "public"."payment_webhook_audit" ENABLE ROW LEVEL SECURITY;
