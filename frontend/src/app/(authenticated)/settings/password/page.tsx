"use client";

import { useEffect } from "react";

const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "";
const KEYCLOAK_REALM = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "onmicro";

// Password/credential management is Keycloak's job now — Django no longer
// holds a meaningful password for a migrated user (federation severs the
// link on first login; JIT-created users get set_unusable_password()).
// Keycloak's own Account Console is where "change password" actually means
// something.
export default function ChangePasswordPage() {
  useEffect(() => {
    window.location.href = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/account/#/security/signingin`;
  }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Change Password</h3>
      <p className="text-sm text-gray-500">
        Redirecting you to your account&apos;s sign-in security settings…
      </p>
    </div>
  );
}
