import type { FirebaseError } from 'firebase/app';

export const EMAIL_LINK_STORAGE_KEY = 'framelex_email_for_signin';

export function getFirebaseAuthCode(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as FirebaseError).code === 'string'
  ) {
    return (error as FirebaseError).code;
  }
  return '';
}

export function formatFirebaseAuthError(
  error: unknown,
  providerLabel = 'this sign-in method'
): string {
  const code = getFirebaseAuthCode(error);
  const rawMessage = error instanceof Error ? error.message : String(error);

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Sign-in window was closed before completing. Please try again.';
    case 'auth/popup-blocked':
      return 'Browser blocked the sign-in popup. Allow popups for this site and try again.';
    case 'auth/cancelled-popup-request':
      return 'Another sign-in window is already open. Complete or close it first.';
    case 'auth/operation-not-allowed':
      return `${providerLabel} is not yet enabled in Firebase Console (Authentication → Sign-in method). Enable it in your Firebase project or use Google sign-in right now.`;
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorized in Firebase Console → Authentication → Settings → Authorized domains.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Sign In, use a Magic Link, or sign in with Google.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password did not match an account. Double-check your details, try a Magic Link, or reset your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts detected. Wait a minute before trying again, or use Google / Magic Link sign-in.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using another sign-in provider (such as Google). Sign in with that method first, then link additional logins in Account Settings.';
    case 'auth/credential-already-in-use':
      return 'This sign-in method is already connected to another FrameLex account.';
    case 'auth/provider-already-linked':
      return 'This sign-in method is already linked to your account.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign back in before linking a password.';
    case 'auth/expired-action-code':
    case 'auth/invalid-action-code':
      return 'This sign-in link has expired or has already been used. Request a fresh Magic Link below.';
    case 'auth/network-request-failed':
      return 'Network connection error while contacting authentication servers. Check your internet connection and retry.';
    default:
      return rawMessage || 'Unable to complete authentication. Please try again.';
  }
}

export function getProviderDisplayName(providerId: string): string {
  switch (providerId) {
    case 'google.com':
      return 'Google';
    case 'password':
      return 'Email & Password';
    case 'emailLink':
      return 'Magic Email Link';
    case 'github.com':
      return 'GitHub';
    case 'microsoft.com':
      return 'Microsoft';
    default:
      return providerId || 'Connected Account';
  }
}
