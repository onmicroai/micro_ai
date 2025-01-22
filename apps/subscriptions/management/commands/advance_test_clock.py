from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.core.management import call_command
from apps.utils.billing import get_stripe_module

##COMMANDS TO ADVANCE TEST CLOCK
# Advance 1 month (default)
# docker exec web python manage.py advance_test_clock

# Advance multiple months
# docker exec web python manage.py advance_test_clock --months 3

# Use a specific clock ID
# docker exec web python manage.py advance_test_clock --clock-id clock_xxx


class Command(BaseCommand):
    help = 'Advances a Stripe test clock and syncs the resulting data'

    def add_arguments(self, parser):
        parser.add_argument('--months', type=int, default=1, help='Number of months to advance')
        parser.add_argument('--clock-id', type=str, help='Test clock ID. If not provided, will use the most recent one.')

    def handle(self, *args, **options):
        stripe = get_stripe_module()
        months = options['months']
        clock_id = options['clock_id']

        # If no clock ID provided, get the most recent one
        if not clock_id:
            clocks = stripe.test_helpers.TestClock.list(limit=1)
            if not clocks.data:
                self.stdout.write(self.style.ERROR('No test clocks found'))
                return
            clock_id = clocks.data[0].id

        try:
            # Get current clock time
            clock = stripe.test_helpers.TestClock.retrieve(clock_id)
            current_time = datetime.fromtimestamp(clock.frozen_time)
            
            # Calculate new time
            new_time = current_time + timedelta(days=30 * months)
            
            # Advance the clock
            self.stdout.write(f'Advancing clock {clock_id} from {current_time} to {new_time}')
            stripe.test_helpers.TestClock.advance(
                clock_id,
                frozen_time=int(new_time.timestamp())
            )

            # Sync the new data
            self.stdout.write('Syncing data from Stripe...')
            call_command('djstripe_sync_models', 'subscription', verbosity=0)
            call_command('djstripe_sync_models', 'invoice', verbosity=0)
            call_command('djstripe_sync_models', 'charge', verbosity=0)
            call_command('djstripe_sync_models', 'paymentintent', verbosity=0)

            self.stdout.write(self.style.SUCCESS('Successfully advanced clock and synced data'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}')) 