export const terminalAuthErrorUrlCases = [
  {
    url: 'http://localhost:8787/api/auth/callback/google?error=access_denied',
    expected: false,
  },
  {
    url: 'http://localhost:8787/api/auth/error?error=access_denied',
    expected: false,
  },
  {
    url: 'http://localhost:8787/sign-in?callbackUrl=%2Fsettings%2Fprofile&error=access_denied',
    expected: true,
  },
  {
    url: 'http://localhost:8787/?error=please_restart_the_process',
    expected: true,
  },
] as const;
