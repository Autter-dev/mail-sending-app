CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"confirmation_from_email" text,
	"confirmation_from_name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
