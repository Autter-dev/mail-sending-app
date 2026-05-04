ALTER TABLE "contacts" ADD COLUMN "confirmation_token" uuid;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN "require_double_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_confirmation_token_unique" UNIQUE("confirmation_token");
