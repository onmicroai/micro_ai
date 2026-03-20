from rest_framework.throttling import UserRateThrottle


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
