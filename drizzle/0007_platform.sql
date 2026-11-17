CREATE TABLE IF NOT EXISTS "platform_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" text DEFAULT '' NOT NULL,
	"password_hash" text NOT NULL,
	"salt" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_email_uq" ON "platform_users" USING btree ("email");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_sessions_user_idx" ON "platform_sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_sessions_expires_idx" ON "platform_sessions" USING btree ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_auth_tokens_user_idx" ON "platform_auth_tokens" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_auth_tokens_hash_uq" ON "platform_auth_tokens" USING btree ("token_hash");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"icon" text DEFAULT 'message-circle' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forum_categories_slug_uq" ON "forum_categories" USING btree ("slug");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"last_post_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "forum_topics_slug_uq" ON "forum_topics" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topics_category_idx" ON "forum_topics" USING btree ("category_id","last_post_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_topics_author_idx" ON "forum_topics" USING btree ("author_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_topic_idx" ON "forum_posts" USING btree ("topic_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_posts_author_idx" ON "forum_posts" USING btree ("author_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_likes" (
	"post_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_likes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_subscriptions" (
	"topic_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forum_subscriptions_topic_id_user_id_pk" PRIMARY KEY("topic_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_notifications_user_idx" ON "forum_notifications" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "forum_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "forum_reports_status_idx" ON "forum_reports" USING btree ("status","created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_publishers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"website" text,
	"payout_iban" text,
	"flouci_payment_id" text,
	"paid_at" timestamp with time zone,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mp_publishers_user_uq" ON "mp_publishers" USING btree ("user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_products" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"kind" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"short_desc" text DEFAULT '' NOT NULL,
	"long_desc" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'Autres' NOT NULL,
	"price_millimes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"icon" text DEFAULT 'package' NOT NULL,
	"screenshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"engines" jsonb DEFAULT '{"snapify":"^1.0.0"}'::jsonb NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rejection_reason" text,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mp_products_slug_uq" ON "mp_products" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_products_status_idx" ON "mp_products" USING btree ("status","kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_products_publisher_idx" ON "mp_products" USING btree ("publisher_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"version" text NOT NULL,
	"changelog" text DEFAULT '' NOT NULL,
	"package_path" text NOT NULL,
	"sha256" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"signed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mp_versions_product_ver_uq" ON "mp_versions" USING btree ("product_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_versions_product_idx" ON "mp_versions" USING btree ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mp_reviews_product_user_uq" ON "mp_reviews" USING btree ("product_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_reviews_product_idx" ON "mp_reviews" USING btree ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"buyer_id" text NOT NULL,
	"total_millimes" integer NOT NULL,
	"commission_millimes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"flouci_payment_id" text,
	"flouci_tracking_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_orders_buyer_idx" ON "mp_orders" USING btree ("buyer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_orders_status_idx" ON "mp_orders" USING btree ("status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
	"version_id" text NOT NULL,
	"unit_price_millimes" integer NOT NULL,
	"license_key" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_order_items_order_idx" ON "mp_order_items" USING btree ("order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_order_items_product_idx" ON "mp_order_items" USING btree ("product_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_downloads" (
	"id" text PRIMARY KEY NOT NULL,
	"order_item_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mp_downloads_token_uq" ON "mp_downloads" USING btree ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_downloads_item_idx" ON "mp_downloads" USING btree ("order_item_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"publisher_id" text NOT NULL,
	"amount_millimes" integer NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"period" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mp_payouts_publisher_idx" ON "mp_payouts" USING btree ("publisher_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mp_carts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
