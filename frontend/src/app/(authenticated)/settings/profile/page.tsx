'use client';

import { useEffect, useState } from 'react';
import axiosInstance from '@/utils/axiosInstance';
import { toast } from 'react-toastify';
import { z } from 'zod';
import Image from 'next/image';
import { useUserStore, User } from '@/store/userStore';

/**
 * Interface representing the structure of a user's profile data.
 * @interface UserProfile
 * @property {string} email - The user's email address
 * @property {string} first_name - The user's first name
 * @property {string} last_name - The user's last name
 * @property {string} [avatar_url] - Optional URL to the user's profile picture
 */
interface UserProfile {
  email: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

/**
 * Zod schema for validating profile form data.
 * Ensures first name and last name are non-empty strings if provided.
 */
const profileSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

/**
 * Profile page component that allows users to view and edit their profile information.
 * Handles profile photo uploads and basic user information updates.
 * @returns {JSX.Element} The rendered profile page component
 */
export default function ProfilePage() {
  const api = axiosInstance();
  const { user, setUser } = useUserStore();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatedFields, setValidatedFields] = useState<{ [key: string]: boolean }>({});
  const [editedProfile, setEditedProfile] = useState<Partial<UserProfile>>({});
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    const initializeProfile = async () => {
      try {
        // Use userStore data instead of fetching directly
        const currentUser = useUserStore.getState().user;
        if (currentUser) {
          const profileData: UserProfile = {
            email: currentUser.email,
            first_name: currentUser.firstName || '',
            last_name: currentUser.lastName || '',
            avatar_url: currentUser.profilePic
          };
          
          setProfile(profileData);
          setEditedProfile(profileData);
        }
      } catch (error: any) {
        toast.error('Failed to load profile: ' + error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeProfile();
  }, [user]);

  /**
   * Uploads profile image to the server and updates the UI
   * @param {File} file - The image file to upload
   * @returns {Promise<void>}
   */
  const uploadProfileImage = async (file: File): Promise<void> => {
    try {
      setSaving(true);
      const imageFormData = new FormData();
      imageFormData.append('avatar', file);
      const imageResponse = await api.post('/api/users/profile/upload-image/', imageFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      // Update the user store with the new profile picture
      if (user) {
        const updatedUser: User = {
          ...user,
          profilePic: imageResponse.data.avatar_url
        };
        setUser(updatedUser);
        
        // Update local state
        setProfile(prev => prev ? {...prev, avatar_url: imageResponse.data.avatar_url} : null);
      }
      
      toast.success('Profile picture updated successfully');
    } catch (error: any) {
      toast.error('Failed to update profile picture: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handles the file input change event for profile photo uploads.
   * Creates a preview of the selected image, stores the file for upload,
   * and automatically saves the new profile picture.
   * @param {React.ChangeEvent<HTMLInputElement>} e - The file input change event
   */
  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024; // 5MB in bytes
      if (file.size > maxSize) {
        toast.error('Image size must be less than 5MB');
        e.target.value = '';
        return;
      }

      // Validate file format (jpg, png only)
      const validFormats = ['image/jpeg', 'image/png'];
      if (!validFormats.includes(file.type)) {
        toast.error('Only JPG and PNG image formats are allowed');
        e.target.value = '';
        return;
      }

      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      // Auto-save the image immediately
      await uploadProfileImage(file);
    }
  };

  /**
   * Handles input focus
   * Clears errors for the field being focused and marks it as not validated
   * 
   * @param {React.FocusEvent<HTMLInputElement>} e - The focus event object
   */
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    
    // Clear error for this specific field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: [],
      }));
    }
    
    // Mark this specific field as not validated
    if (validatedFields[name]) {
      setValidatedFields((prev) => ({
        ...prev,
        [name]: false,
      }));
    }
  };

  /**
   * Handles the form submission for updating the user's profile.
   * Validates the form data, uploads new profile photo if selected,
   * and updates the user's profile information.
   * @param {React.FormEvent} e - The form submission event
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Mark all fields as validated
    const fields = ['first_name', 'last_name'];
    const newValidatedFields = fields.reduce((acc, field) => {
      acc[field] = true;
      return acc;
    }, {} as { [key: string]: boolean });
    setValidatedFields(newValidatedFields);
    
    // Validate form data
    const validationResult = profileSchema.safeParse(editedProfile);
    if (!validationResult.success) {
      const formattedErrors: { [key: string]: string[] } = {};
      validationResult.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        if (!formattedErrors[field]) {
          formattedErrors[field] = [];
        }
        formattedErrors[field].push(err.message);
      });
      setErrors(formattedErrors);
      return;
    }

    try {
      setSaving(true);
      if (photoFile) {
        await uploadProfileImage(photoFile);
      }

      // Update other profile information
      const response = await api.patch('/api/users/profile/', editedProfile);
      
      // Update the user store with the new data
      if (user) {
        const profilePic = photoFile ? user.profilePic : (response.data.avatar_url || user.profilePic);
        const updatedUser: User = {
          ...user,
          firstName: response.data.first_name,
          lastName: response.data.last_name,
          profilePic: profilePic
        };
        setUser(updatedUser);
      }
      
      toast.success('Profile updated successfully');
    } catch (error: any) {
      if (error.response?.data) {
        setErrors(error.response.data);
        // Show the first error message as a toast
        const firstError = Object.values(error.response.data)[0];
        if (Array.isArray(firstError) && firstError.length > 0) {
          toast.error(firstError[0]);
        }
      } else {
        toast.error('Failed to update profile: ' + error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  /**
   * Resets the form to its initial state by reverting any unsaved changes.
   * Clears the photo preview and selected file.
   */
  const handleCancel = () => {
    setEditedProfile(profile || {});
    setPhotoPreview(null);
    setPhotoFile(null);
  };

  const renderFieldError = (fieldName: string) => {
    if (validatedFields[fieldName] && errors[fieldName] && errors[fieldName].length > 0) {
      return (
        <p className="text-sm text-red-500 mt-1">
          {errors[fieldName][0]}
        </p>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-gray-500">
          Manage your account settings and profile information.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="grid gap-2">
          <label className="text-sm font-medium text-gray-700">Profile Photo</label>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24">
              <Image
                src={photoPreview || profile?.avatar_url || '/default-avatar.png'}
                alt="Profile"
                fill
                sizes="96px"
                className="rounded-full object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <input
                type="file"
                accept="image/jpeg, image/png"
                onChange={handlePhotoChange}
                className="text-sm"
                disabled={saving}
              />
              <p className="text-xs text-gray-500 mt-1">Max size: 5MB. Formats: JPG, PNG</p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <p className="text-gray-900">{profile?.email}</p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="first_name" className="text-sm font-medium text-gray-700">
            First Name
          </label>
          <input
            id="first_name"
            type="text"
            name="first_name"
            value={editedProfile.first_name || ''}
            onChange={(e) => {
              setEditedProfile({ ...editedProfile, first_name: e.target.value });
              setErrors((prev) => ({ ...prev, first_name: [] }));
            }}
            onFocus={handleFocus}
            disabled={saving}
            className={`px-3 py-2 border rounded-md ${
              validatedFields.first_name && errors.first_name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
            }`}
          />
          {renderFieldError('first_name')}
        </div>

        <div className="grid gap-2">
          <label htmlFor="last_name" className="text-sm font-medium text-gray-700">
            Last Name
          </label>
          <input
            id="last_name"
            type="text"
            name="last_name"
            disabled={saving}
            value={editedProfile.last_name || ''}
            onChange={(e) => {
              setEditedProfile({ ...editedProfile, last_name: e.target.value });
              setErrors((prev) => ({ ...prev, last_name: [] }));
            }}
            onFocus={handleFocus}
            className={`px-3 py-2 border rounded-md ${
              validatedFields.last_name && errors.last_name ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-primary'
            }`}
          />
          {renderFieldError('last_name')}
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none bg-primary text-primary-foreground h-10 py-2 px-4"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none border border-gray-300 text-gray-700 hover:bg-gray-50 h-10 py-2 px-4"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
