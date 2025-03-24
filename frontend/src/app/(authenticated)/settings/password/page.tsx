/**
 * @fileoverview Password change page component that allows users to update their password
 * with validation and error handling.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/utils/axiosInstance";
import { toast } from "react-toastify";
import { z } from "zod";
import { passwordChangeSchema } from "@/utils/passwordValidation";

/**
 * ChangePasswordPage component that provides a form for users to change their password.
 * Includes client-side validation, server-side validation handling, and loading states.
 * 
 * @returns {JSX.Element} The rendered password change form
 */
export default function ChangePasswordPage() {
  const api = axiosInstance();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    old_password: "",
    new_password1: "",
    new_password2: "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});

  /**
   * Validates the form data against the password schema
   * Sets validation errors in the component state if validation fails
   * 
   * @returns {boolean} True if validation passes, false otherwise
   */
  const validateForm = () => {
    try {
      passwordChangeSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors: { [key: string]: string[] } = {};
        error.errors.forEach((err) => {
          const field = err.path[0] as string;
          if (!formattedErrors[field]) {
            formattedErrors[field] = [];
          }
          formattedErrors[field].push(err.message);
        });
        setErrors(formattedErrors);
      }
      return false;
    }
  };

  /**
   * Handles input changes in the form fields
   * Updates the form data state and clears errors for the changed field
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} e - The change event object
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    
    // Clear error for the field being edited
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: [],
      }));
    }
  };

  /**
   * Handles input focus
   * Clears errors for the field being focused
   * 
   * @param {React.FocusEvent<HTMLInputElement>} e - The focus event object
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: [],
      }));
    }
  };

  /**
   * Handles form submission
   * Validates the form data and sends the password change request to the server
   * Displays success/error messages using toast notifications
   * 
   * @param {React.FormEvent} e - The form submission event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    
    // First do frontend validation
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/password/change/", formData);
      toast.success("Password changed successfully");
    } catch (error: any) {
      if (error.response?.data) {
        // Handle backend validation errors
        setErrors(error.response.data);
        // Show the first error message as a toast
        const firstError = Object.values(error.response.data)[0];
        if (Array.isArray(firstError) && firstError.length > 0) {
          toast.error(firstError[0]);
        }
      } else {
        toast.error("Failed to change password: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Renders error messages for a specific form field
   * 
   * @param {string} fieldName - The name of the field to render errors for
   * @returns {JSX.Element | null} The rendered error message or null if no errors
   */
  const renderFieldError = (fieldName: string) => {
    if (errors[fieldName] && errors[fieldName].length > 0) {
      return (
        <p className="text-sm text-red-500 mt-1">
          {errors[fieldName][0]}
        </p>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Change Password</h3>
          <p className="text-sm text-gray-500">
            Update your password to keep your account secure.
          </p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="old_password" className="text-sm font-medium text-gray-700">
              Current Password <span className="text-red-500">*</span>
            </label>
            <input
              id="old_password"
              name="old_password"
              type="password"
              value={formData.old_password}
              onChange={handleChange}
              onFocus={handleFocus}
              disabled={loading}
              className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                formSubmitted && errors.old_password?.length ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formSubmitted && renderFieldError("old_password")}
          </div>

          <div className="grid gap-2">
            <label htmlFor="new_password1" className="text-sm font-medium text-gray-700">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              id="new_password1"
              name="new_password1"
              type="password"
              value={formData.new_password1}
              onChange={handleChange}
              onFocus={handleFocus}
              disabled={loading}
              className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                formSubmitted && errors.new_password1?.length ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formSubmitted && renderFieldError("new_password1")}
          </div>

          <div className="grid gap-2">
            <label htmlFor="new_password2" className="text-sm font-medium text-gray-700">
              Confirm New Password <span className="text-red-500">*</span>
            </label>
            <input
              id="new_password2"
              name="new_password2"
              type="password"
              value={formData.new_password2}
              onChange={handleChange}
              onFocus={handleFocus}
              disabled={loading}
              className={`flex h-10 w-full rounded-md border px-3 py-2 text-sm placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-50 ${
                formSubmitted && errors.new_password2?.length ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {formSubmitted && renderFieldError("new_password2")}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => router.push("/settings/profile")}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 text-gray-700 hover:bg-gray-50 h-10 py-2 px-4"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground h-10 py-2 px-4"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Changing Password...
              </>
            ) : (
              "Change Password"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
