from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from allauth.account.models import EmailAddress
from apps.microapps.models import Microapp, MicroAppUserJoin
from apps.collection.models import Collection, CollectionUserJoin, CollectionMaJoin
from apps.utils.global_variables import MicroappVariables
from apps.subscriptions.helpers import update_or_create_free_subscription, create_free_billing_cycle
from .test_constants import (
    TEST_USER_EMAIL,
    TEST_USER_PASSWORD,
    TEST_USER_FIRST_NAME,
    TEST_USER_LAST_NAME,
    TEST_APP_HASH_ID,
    TEST_APP_TITLE,
    TEST_APP_DESCRIPTION,
    TEST_APP_JSON,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds test user and test app for e2e testing"

    def handle(self, *args, **options):
        # Create or get test user
        user, created = User.objects.get_or_create(
            username=TEST_USER_EMAIL,
            email=TEST_USER_EMAIL,
            defaults={
                "first_name": TEST_USER_FIRST_NAME,
                "last_name": TEST_USER_LAST_NAME,
            }
        )
        
        if created:
            user.set_password(TEST_USER_PASSWORD)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created test user: {TEST_USER_EMAIL}')
            )
        else:
            # Update password in case it changed
            user.set_password(TEST_USER_PASSWORD)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'Test user already exists: {TEST_USER_EMAIL}')
            )
        
        # Verify email address
        email_address, email_created = EmailAddress.objects.get_or_create(
            user=user,
            email=TEST_USER_EMAIL,
            defaults={"verified": True, "primary": True}
        )
        
        if not email_address.verified:
            email_address.verified = True
            email_address.primary = True
            email_address.save()
            self.stdout.write(
                self.style.SUCCESS(f'Email address verified for: {TEST_USER_EMAIL}')
            )
        elif email_created:
            self.stdout.write(
                self.style.SUCCESS(f'Email address created and verified for: {TEST_USER_EMAIL}')
            )
        
        # Create or get default collection for user
        collection, collection_created = Collection.objects.get_or_create(
            name="My Apps",
            defaults={"description": "Default collection for test user"}
        )
        
        if collection_created:
            self.stdout.write(
                self.style.SUCCESS('Created default collection: My Apps')
            )
        
        # Add user to collection if not already added
        collection_user_join, cuj_created = CollectionUserJoin.objects.get_or_create(
            collection_id=collection,
            user_id=user,
            defaults={"role": "admin"}
        )
        
        if cuj_created:
            self.stdout.write(
                self.style.SUCCESS('Added user to collection')
            )
        
        # Create free subscription for test user
        subscription = update_or_create_free_subscription(user)
        create_free_billing_cycle(user, subscription)
        self.stdout.write(
            self.style.SUCCESS('Created free subscription for test user')
        )
        
        # Create test microapp with specific hash_id for tests
        # Determine privacy setting from app_json
        privacy_setting = TEST_APP_JSON.get("privacySettings", "private")
        privacy_map = {
            "public": Microapp.PUBLIC,
            "private": Microapp.PRIVATE,
            "restricted": Microapp.RESTRICTED,
        }
        privacy = privacy_map.get(privacy_setting, Microapp.PRIVATE)
        
        microapp, app_created = Microapp.objects.get_or_create(
            hash_id=TEST_APP_HASH_ID,
            defaults={
                "title": TEST_APP_TITLE,
                "explanation": TEST_APP_DESCRIPTION,
                "privacy": privacy,
                "temperature": TEST_APP_JSON.get("aiConfig", {}).get("temperature", 0.7),
                "ai_model": TEST_APP_JSON.get("aiConfig", {}).get("aiModel", MicroappVariables.DEFAULT_MICROAPP_AI_MODEL),
                "copy_allowed": TEST_APP_JSON.get("clonable", True),
                "app_json": TEST_APP_JSON,
            }
        )
        
        if app_created:
            self.stdout.write(
                self.style.SUCCESS(f'Created test microapp with hash_id: {TEST_APP_HASH_ID}')
            )
        else:
            # Update app_json in case it changed
            microapp.app_json = TEST_APP_JSON
            microapp.title = TEST_APP_TITLE
            microapp.explanation = TEST_APP_DESCRIPTION
            microapp.privacy = privacy
            microapp.temperature = TEST_APP_JSON.get("aiConfig", {}).get("temperature", 0.7)
            microapp.ai_model = TEST_APP_JSON.get("aiConfig", {}).get("aiModel", MicroappVariables.DEFAULT_MICROAPP_AI_MODEL)
            microapp.copy_allowed = TEST_APP_JSON.get("clonable", True)
            microapp.save()
            self.stdout.write(
                self.style.SUCCESS(f'Test microapp already exists with hash_id: {TEST_APP_HASH_ID}')
            )
        
        # Associate user with microapp
        user_join, join_created = MicroAppUserJoin.objects.get_or_create(
            ma_id=microapp,
            user_id=user,
            defaults={
                "role": MicroAppUserJoin.OWNER,
                "counts_toward_max": True,
            }
        )
        
        if join_created:
            self.stdout.write(
                self.style.SUCCESS('Associated user with test microapp')
            )
        
        # Add microapp to collection
        collection_microapp, cm_created = CollectionMaJoin.objects.get_or_create(
            collection_id=collection,
            ma_id=microapp,
        )
        
        if cm_created:
            self.stdout.write(
                self.style.SUCCESS('Added test microapp to collection')
            )
        
        self.stdout.write(
            self.style.SUCCESS('\n✓ Test data seeding completed successfully!')
        )
        self.stdout.write(f'  User: {TEST_USER_EMAIL}')
        self.stdout.write(f'  Password: {TEST_USER_PASSWORD}')
        self.stdout.write(f'  App hash_id: {TEST_APP_HASH_ID}')
        self.stdout.write(f'  App URL: /app/{TEST_APP_HASH_ID}')

