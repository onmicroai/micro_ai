from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.users.mautic import MauticClient, MauticSyncError, sync_contacts


class Command(BaseCommand):
    help = (
        "Upsert Django users into Mautic. Runs only when PRODUCTION and "
        "MAUTIC_SYNC_ENABLED are both true, so dev and staging never sync."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count users and print one sample payload. Does not call Mautic, in any environment.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Sync at most this many users.",
        )

    def handle(self, *args, **options):
        if options["dry_run"]:
            self._dry_run(options["limit"])
            return

        if not (settings.PRODUCTION and settings.MAUTIC_SYNC_ENABLED):
            self.stdout.write(
                "Mautic sync skipped. It runs only when PRODUCTION and MAUTIC_SYNC_ENABLED are both true."
            )
            return

        missing = [
            name
            for name, value in (
                ("MAUTIC_BASE_URL", settings.MAUTIC_BASE_URL),
                ("MAUTIC_API_USER", settings.MAUTIC_API_USER),
                ("MAUTIC_API_PASSWORD", settings.MAUTIC_API_PASSWORD),
            )
            if not value
        ]
        if missing:
            raise CommandError(f"Mautic sync is enabled but missing settings: {', '.join(missing)}")

        client = MauticClient(
            settings.MAUTIC_BASE_URL,
            settings.MAUTIC_API_USER,
            settings.MAUTIC_API_PASSWORD,
        )
        try:
            synced = sync_contacts(client, limit=options["limit"])
        except MauticSyncError as exc:
            raise CommandError(str(exc)) from exc

        self.stdout.write(f"Mautic sync finished: {synced} users upserted.")

    def _dry_run(self, limit):
        from apps.users.mautic import contact_payload, iter_user_batches, plans_by_user_id

        count = 0
        sample = None
        for batch in iter_user_batches(limit=limit):
            plans = plans_by_user_id([user.id for user in batch])
            payloads = [contact_payload(user, plans.get(user.id, "Free")) for user in batch]
            count += len(payloads)
            if sample is None and payloads:
                sample = payloads[0]
        self.stdout.write(f"Dry run: {count} users would be sent to Mautic.")
        if sample:
            self.stdout.write(f"Sample payload: {sample}")
