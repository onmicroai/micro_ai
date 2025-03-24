import { z } from "zod";

/**
 * Shared password validation schema
 * Enforces the following rules:
 * - Must be at least 8 characters long
 * - Must contain at least one uppercase letter
 */
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .refine((password) => /[A-Z]/.test(password), "Password must contain at least one uppercase letter")

/**
 * Validation schema for password change
 * Includes validation for old password, new password, and confirmation
 */
export const passwordChangeSchema = z.object({
  old_password: z.string().min(1, "Current password is required"),
  new_password1: passwordSchema,
  new_password2: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.new_password1 === data.new_password2, {
  message: "Passwords don't match",
  path: ["new_password2"],
}).refine((data) => data.old_password !== data.new_password1, {
  message: "New password must be different from current password",
  path: ["new_password1"],
});

/**
 * Validation schema for password reset
 * Includes validation for new password and confirmation
 */
export const passwordResetSchema = z.object({
  new_password1: passwordSchema,
  new_password2: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.new_password1 === data.new_password2, {
  message: "Passwords don't match",
  path: ["new_password2"],
});

/**
 * Validation schema for registration
 * Includes validation for password and confirmation
 */
export const registrationPasswordSchema = z.object({
  password1: passwordSchema,
  password2: z.string().min(1, "Password confirmation is required"),
}).refine((data) => data.password1 === data.password2, {
  message: "Passwords don't match",
  path: ["password2"],
}); 