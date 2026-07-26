-- Enable Row Level Security (RLS) on public tables added after 0002.
--
-- 0002 established the convention and 0003/0004 followed it, but every table
-- created from 0006 onwards missed it, leaving them as the only public tables
-- reachable by a non-owner role. Like 0002 this intentionally does NOT:
-- - FORCE RLS (table owners still bypass unless forced, which is how the app
--   connects today)
-- - add policies (ENABLE with no policy is deny-by-default for other roles)
ALTER TABLE "public"."remover_image_asset" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."remover_quota_reservation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."remover_job" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."entitlement_grant" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."product_quota_reservation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."background_remover_image" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."text_to_speech_generation" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- order.invoice_id is read twice on every subscription renewal webhook but had
-- no index, so each lookup was a sequential scan over the whole order table.
CREATE INDEX IF NOT EXISTS "idx_order_invoice_id" ON "order" USING btree ("invoice_id");
