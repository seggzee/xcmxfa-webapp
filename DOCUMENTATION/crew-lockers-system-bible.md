# Crew Lockers System Bible (V2)

Last Updated: 2026-02-15 12:47 UTC

------------------------------------------------------------------------

## 1. System Purpose

Crew Lockers allows authenticated users to manage their Keynius lockers
without retrieving historic emails.

Integration is achieved via:

1.  Inbound email ingestion (forwarded email from @klm.com)
2.  Periodic scraping of the Keynius locker page
3.  Reminder generation (email now, push-ready later)
4.  Persistent in-app Messages feed

------------------------------------------------------------------------

## 2. Idiot Guide (Non-Technical)

What the crew member does: - Rent locker via Keynius - Forward
confirmation email to lockers@xcmxfa.com - Open xcmxfa → Crew Lockers -
Tap "Open / manage"

What the system does: - Verifies sender is @klm.com - Maps sender email
to users_v2.email - Extracts locker UUID - Stores locker record -
Scrapes page for end date - Generates reminders at 14/7/3/0 days -
Displays reminders in Messages and Home banner

------------------------------------------------------------------------

## 3. Architecture Overview

Client (Web): - Home tile → /crew-lockers - CrewLockers page - Messages
page - AuthStore provides PSN

Backend (PHP): - lockers_pipe_script.php - lockers_scrape_cron.php -
lockers_notifications_cron.php - /api/crew_lockers endpoints

Database: - crew_lockers - crew_locker_events - notifications -
notification_prefs - crew_locker_ingest_failures

------------------------------------------------------------------------

## 4. Process Flows

Flow A --- Email Ingestion - Pipe script reads email - Verifies
@klm.com - Extracts Keynius URL + UUID - Upserts into crew_lockers -
Logs event

Flow B --- Scraper Sync - Cron fetches Keynius page - Parses end date
and details - Updates crew_lockers - Logs renewals/expiry

Flow C --- Notifications - Cron checks thresholds - Inserts into
notifications - Sends email if enabled

Flow D --- Client Rendering - Crew Lockers page lists lockers - Messages
shows reminders - Home banner shows unread count

------------------------------------------------------------------------

## 5. Security Model (Current)

Endpoints accept PSN from client (interim model). Future: derive PSN
from bearer token.

------------------------------------------------------------------------

## 6. Troubleshooting

Forwarded email not working? → Check crew_locker_ingest_failures

Locker not updating? → Check last_http_status & consecutive_failures

No reminders? → Check notifications table & cron execution

Banner not showing? → Ensure unread \> 0 (read_at is NULL)

------------------------------------------------------------------------

## 7. Bootstrap Checklist

1.  DB tables exist
2.  Pipe configured in cPanel
3.  Cron jobs active
4.  Scraper tested
5.  Notifications visible
6.  Home banner verified

------------------------------------------------------------------------

End of Document.
