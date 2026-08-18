/**
 * Firebase surfaces auth failures as codes wrapped in strings like
 * "Firebase: Error (auth/invalid-credential).", which is what the sign-in form
 * was showing people. This maps the ones a user can actually hit onto messages
 * that say what to do next.
 */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address does not look right.",
  "auth/user-disabled": "This account has been disabled. Contact support if that seems wrong.",
  "auth/user-not-found": "No account uses that email address.",
  "auth/wrong-password": "That password is not right.",
  "auth/invalid-credential": "That email and password do not match an account.",
  "auth/email-already-in-use": "An account already uses that email address. Try logging in instead.",
  "auth/weak-password": "Use a password of at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Could not reach the server. Check your connection and try again.",
  "auth/popup-closed-by-user": "The Google window closed before sign-in finished.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/account-exists-with-different-credential":
    "That email is already registered with a different sign-in method.",
  "auth/requires-recent-login": "For security, log in again before making this change.",
};

export function authErrorMessage(error: unknown, fallback = "Something went wrong. Try again.") {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (MESSAGES[code]) return MESSAGES[code];

  // Some SDK paths throw plain Errors we raise ourselves; those are already readable.
  if (error instanceof Error && !error.message.startsWith("Firebase:")) {
    return error.message;
  }

  return fallback;
}
