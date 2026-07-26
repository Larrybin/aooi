DROP INDEX "idx_credit_order_no";--> statement-breakpoint
DROP INDEX "idx_subscription_provider_id";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_credit_order_no" ON "credit" USING btree ("order_no") WHERE "credit"."order_no" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_entitlement_grant_scope_reason" ON "entitlement_grant" USING btree ("user_id","site_key","product_key","environment","source","reason");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscription_provider_id" ON "subscription" USING btree ("subscription_id","payment_provider") WHERE "subscription"."subscription_id" is not null and "subscription"."payment_provider" is not null;