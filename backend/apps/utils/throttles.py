from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class FederationPasswordCheckThrottle(SimpleRateThrottle):
    """
    Rate throttle for the REST federation password-check endpoint
    (apps/authentication/federation_views.py).

    Keycloak's own brute-force detection only covers users that already
    exist natively in Keycloak — a user still going through this migration
    path can be hit with unlimited password guesses, since every attempt
    looks like a fresh login to Keycloak (see upstream issue
    daniel-frak/keycloak-user-migration#178, open/unresolved). Django is the
    only place left to rate-limit these attempts.

    Keyed by the TARGET username being guessed, not by caller IP — every
    request legitimately originates from the same Keycloak container, so an
    IP-based limit would either block all real migrations together or do
    nothing to stop guessing one specific account. Only failed lookups
    count, mirroring AddAdminThrottle below, so a legitimate user's
    successful migration is never penalized.
    """
    scope = 'federation_password_check'

    def get_cache_key(self, request, view):
        username = (view.kwargs.get('username_or_email') or '').strip().lower()
        if not username:
            return None
        return self.cache_format % {'scope': self.scope, 'ident': username}

    def allow_request(self, request, view):
        if self.rate is None:
            return True

        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True

        self.history = self.cache.get(self.key, [])
        self.now = self.timer()

        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()

        if len(self.history) >= self.num_requests:
            return self.throttle_failure()

        # Do NOT call throttle_success() here — the view decides when to count.
        return True

    def record_failed_attempt(self):
        """Persist a failed attempt to the cache. Call this when a password
        check fails."""
        self.history.insert(0, self.now)
        self.cache.set(self.key, self.history, self.duration)


class AddAdminThrottle(UserRateThrottle):
    """
    Rate throttle for the add-admin-by-email endpoint.

    Only failed lookups (email not found in the system) increment the counter.
    Successfully adding a valid email address does not count against the limit,
    so an owner adding many real users is never penalized.
    """
    scope = 'add_admin'

    def allow_request(self, request, view):
        """Check the current limit without incrementing. The view calls
        record_failed_attempt() to increment only on a failed email lookup."""
        if self.rate is None:
            return True

        self.key = self.get_cache_key(request, view)
        if self.key is None:
            return True

        self.history = self.cache.get(self.key, [])
        self.now = self.timer()

        # Drop expired entries from the history window
        while self.history and self.history[-1] <= self.now - self.duration:
            self.history.pop()

        if len(self.history) >= self.num_requests:
            return self.throttle_failure()

        # Do NOT call throttle_success() here — the view decides when to count.
        return True

    def record_failed_attempt(self):
        """Persist a failed attempt to the cache. Call this when an email
        lookup returns no match."""
        self.history.insert(0, self.now)
        self.cache.set(self.key, self.history, self.duration)
