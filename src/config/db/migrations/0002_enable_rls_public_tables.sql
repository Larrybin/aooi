-- Enable Row Level Security (RLS) on tables in public schema.
-- This satisfies Supabase database linter: 0013_rls_disabled_in_public.
--
-- Note: This migration intentionally does NOT:
-- - FORCE RLS (table owners may still bypass unless forced)
-- - add policies (define them based on your exposure model)
ALTER TABLE "public"."config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."verification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."ai_task" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."apikey" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."chat" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."chat_message" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."credit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."order" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."post" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."role_permission" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."permission" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."subscription" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."taxonomy" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."user_role" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."role" ENABLE ROW LEVEL SECURITY;

