# Remove retired recognition storage

The owner requested deletion of redundant first-machine versions, not business orders or their ordinary raw sources. The website no longer captures those versions or runs a global source self-audit.

## Hosted cleanup

Open the existing Supabase project, then **SQL Editor → New query**. Paste and run the complete committed migration:

`supabase/migrations/202611080001_retire_first_recognition.sql`

The script deletes only `firstRecognition` keys from active order JSON, preserves array ordering and all other fields, advances the order revision only when cleanup is needed, and installs a trigger preventing older clients/imports from adding that field back. Its final verification query should return `remaining_first_recognition_copies = 0`. It is repeatable. Refresh other employee sessions after cleanup to obtain the new data revision.

This migration has local PostgreSQL tests. Frontend publication does not execute it in Supabase. The assistant has no hosted database credentials in this environment and cannot claim hosted completion without the owner's execution result.

## Storage accounting

Removing a JSON key reduces live logical payload and future transfers. PostgreSQL may retain old row space until maintenance reclaims it for reuse, and the provider's dashboard metrics can lag. This script does not run blocking `VACUUM FULL`, delete orders/worker files or erase previously downloaded/provider backups. A high-CPU warning is a separate metric from storage usage; inspect the actual database/storage chart before attributing all resource use to these snapshots.
