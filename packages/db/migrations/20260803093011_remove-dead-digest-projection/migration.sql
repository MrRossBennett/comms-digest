ALTER TABLE "digest_item_child" DROP CONSTRAINT "digest_item_child_digest_item_id_digest_item_id_fkey";--> statement-breakpoint
ALTER TABLE "digest_item_claim" DROP CONSTRAINT "digest_item_claim_digest_item_id_digest_item_id_fkey";--> statement-breakpoint
ALTER TABLE "digest_item_responsibility" DROP CONSTRAINT "digest_item_responsibility_digest_item_id_digest_item_id_fkey";--> statement-breakpoint
DROP TABLE "digest_item";--> statement-breakpoint
DROP TABLE "digest_item_child";--> statement-breakpoint
DROP TABLE "digest_item_claim";--> statement-breakpoint
DROP TABLE "digest_item_responsibility";
