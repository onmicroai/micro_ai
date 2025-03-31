from django.apps import AppConfig

class UtilsConfig(AppConfig):
    name = 'apps.utils'
    verbose_name = 'Utilities'

    def ready(self):
        """
        Update site domain when Django starts
        """
        # Only run this in application code, not in migrations or tests
        import sys
        if 'migrate' not in sys.argv and 'makemigrations' not in sys.argv:
            try:
                self.update_site_domain()
            except Exception:
                # This will fail during initial migrations when the sites table doesn't exist yet
                # That's okay, it will be created later
                pass

    def update_site_domain(self):
        from django.conf import settings
        from django.contrib.sites.models import Site
        
        # Get the domain from settings
        domain = settings.DOMAIN
        
        # Remove http:// or https:// prefix and any trailing slash
        if domain.startswith('http://'):
            domain = domain[7:]
        elif domain.startswith('https://'):
            domain = domain[8:]
        domain = domain.rstrip('/')

        # Don't try to update if Site model table doesn't exist yet
        from django.db import connection
        if 'django_site' not in connection.introspection.table_names():
            return
        
        # Update the default site
        try:
            site = Site.objects.get(id=settings.SITE_ID)
            if site.domain != domain:
                site.domain = domain
                site.name = domain
                site.save()
                print(f"Updated site domain to {domain}")
        except Site.DoesNotExist:
            # Create if doesn't exist
            Site.objects.create(id=settings.SITE_ID, domain=domain, name=domain)
            print(f"Created site with domain {domain}") 