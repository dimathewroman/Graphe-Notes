
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"requests_this_hour" integer DEFAULT 0 NOT NULL,
	"hour_window_start" timestamp with time zone NOT NULL,
	"requests_this_month" integer DEFAULT 0 NOT NULL,
	"month_window_start" timestamp with time zone NOT NULL,
	"total_tokens_used" integer,
	"last_request_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_usage_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"storage_path" text,
	"display_mode" text,
	"master_path" text,
	"proxy_path" text,
	"master_format" text,
	"proxy_format" text DEFAULT 'webp',
	"is_animated" boolean DEFAULT false,
	"master_size_bytes" integer,
	"proxy_size_bytes" integer,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);


CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"storage_tier" varchar DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"parent_id" integer,
	"color" text,
	"icon" text,
	"tag_rules" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "note_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_text" text,
	"label" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"content_text" text,
	"folder_id" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"cover_image" text,
	"vaulted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"auto_delete_at" timestamp with time zone,
	"deleted_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "vault_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "quick_bit_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"default_expiration_days" integer DEFAULT 3 NOT NULL,
	"default_notification_hours" integer[] DEFAULT '{24}'::integer[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quick_bit_settings_user_id_unique" UNIQUE("user_id")
);

CREATE TABLE "quick_bits" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"content_text" text,
	"expires_at" timestamp with time zone NOT NULL,
	"notification_hours" integer[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "smart_folders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"tag_rules" text[] DEFAULT '{}' NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"endpoint_url" text,
	"model_override" text,
	"fast_model_override" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_api_keys_user_id_provider_unique" UNIQUE("user_id","provider")
);

CREATE TABLE "user_settings" (
	"user_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"active_ai_provider" text,
	"has_completed_ai_setup" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"content" jsonb NOT NULL,
	"is_preset" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "note_versions" ADD CONSTRAINT "note_versions_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "user_api_keys" ADD CONSTRAINT "user_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "ai_usage_user_id_idx" ON "ai_usage" USING btree ("user_id");
CREATE INDEX "attachments_user_id_idx" ON "attachments" USING btree ("user_id");
CREATE INDEX "attachments_note_id_idx" ON "attachments" USING btree ("note_id");
CREATE INDEX "attachments_note_id_created_at_idx" ON "attachments" USING btree ("note_id","created_at");
CREATE INDEX "folders_user_id_idx" ON "folders" USING btree ("user_id");
CREATE INDEX "note_versions_note_id_created_at_idx" ON "note_versions" USING btree ("note_id","created_at");
CREATE INDEX "note_versions_user_id_idx" ON "note_versions" USING btree ("user_id");
CREATE INDEX "notes_user_id_deleted_at_idx" ON "notes" USING btree ("user_id","deleted_at");
CREATE INDEX "notes_folder_id_idx" ON "notes" USING btree ("folder_id");
CREATE INDEX "quick_bits_user_id_idx" ON "quick_bits" USING btree ("user_id");
CREATE INDEX "user_api_keys_user_id_idx" ON "user_api_keys" USING btree ("user_id");
CREATE INDEX "templates_user_id_idx" ON "templates" USING btree ("user_id");
CREATE INDEX "templates_is_preset_idx" ON "templates" USING btree ("is_preset");
