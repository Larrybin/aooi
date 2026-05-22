CREATE TABLE "entitlement_grant" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"site_key" text NOT NULL,
	"product_key" text NOT NULL,
	"environment" text NOT NULL,
	"source" text NOT NULL,
	"status" text NOT NULL,
	"entitlements_json" text NOT NULL,
	"reason" text NOT NULL,
	"granted_by_user_id" text,
	"starts_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "entitlement_grant" ADD CONSTRAINT "entitlement_grant_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_entitlement_grant_user_scope" ON "entitlement_grant" USING btree ("user_id","site_key","product_key","environment","status");
--> statement-breakpoint
CREATE INDEX "idx_entitlement_grant_status_window" ON "entitlement_grant" USING btree ("status","starts_at","expires_at");
--> statement-breakpoint
CREATE INDEX "idx_entitlement_grant_granted_by" ON "entitlement_grant" USING btree ("granted_by_user_id");
