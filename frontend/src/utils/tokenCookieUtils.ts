"use client";

import Cookies from 'js-cookie';

/**
 * Constants for cookie names
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const ACCESS_TOKEN_EXPIRATION_COOKIE = 'access_token_expiration';

/**
 * Get access token from cookie
 * @returns {string | null} The access token or null if not found
 */
export const getAccessToken = (): string | null => {
  return Cookies.get(ACCESS_TOKEN_COOKIE) || null;
};

/**
 * Get access token expiration from cookie
 * @returns {string | null} The access token expiration or null if not found
 */
export const getAccessTokenExpiration = (): string | null => {
  return Cookies.get(ACCESS_TOKEN_EXPIRATION_COOKIE) || null;
};

/**
 * Set access token and its expiration in cookies
 * @param {string} token The access token to store
 * @param {string} expiration The expiration time for the token
 */
export const setAccessToken = (token: string, expiration: string): void => {
  // Parse the expiration date to determine cookie expiry
  const expirationDate = new Date(expiration);
  const options = {
    expires: expirationDate,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const
  };

  Cookies.set(ACCESS_TOKEN_COOKIE, token, options);
  Cookies.set(ACCESS_TOKEN_EXPIRATION_COOKIE, expiration, options);
};

/**
 * Remove access token and its expiration from cookies
 */
export const removeAccessToken = (): void => {
  Cookies.remove(ACCESS_TOKEN_COOKIE);
  Cookies.remove(ACCESS_TOKEN_EXPIRATION_COOKIE);
}; 