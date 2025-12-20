ALTER TABLE "role" DROP CONSTRAINT "role_name_unique";--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "role_name_alive_unique" ON "role" USING btree ("name") WHERE "role"."deleted_at" is null;