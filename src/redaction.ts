const SENSITIVE_KEY =
  /(?:token|secret|password|passwd|api[_-]?key|access[_-]?key|authorization|auth|signature|credential|jwt|private[_-]?key)/i;

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi;
const ASSIGNMENT_PATTERN =
  /(^|[?&#\s,;{])(["']?)([A-Za-z0-9_.%~-]+)(["']?)\s*(=|%3[dD]|:)\s*(["']?)([^&\s,;}"']+)(["']?)/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=:-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g;
const PROVIDER_TOKEN_PATTERN =
  /\b(?:sk_(?:live|test|fixture)_|rk_(?:live|test)_|gh[pousr]_|github_pat_|glpat-|xox[baprs]-|AIza[0-9A-Za-z_-]{20,}|ya29\.[0-9A-Za-z_-]+|npm_[0-9A-Za-z]{20,}|pypi-[A-Za-z0-9_-]{20,}|whsec_|sbp_|SG\.[A-Za-z0-9_-]{16,}\.)[A-Za-z0-9_.-]+/gi;

/** Remove credentials and secret-bearing values from operator-facing text. */
export function redactSecrets(value: string): string {
  const withoutControlBytes = stripControlCharacters(value);
  const withoutUrlSecrets = withoutControlBytes.replace(URL_PATTERN, (candidate) =>
    redactUrl(candidate),
  );
  const withoutKnownTokens = withoutUrlSecrets
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(JWT_PATTERN, '[REDACTED]')
    .replace(PROVIDER_TOKEN_PATTERN, '[REDACTED]');
  const withoutAssignments = withoutKnownTokens.replace(
    ASSIGNMENT_PATTERN,
    (match, prefix: string, _openingQuote: string, rawKey: string) => {
      let key = rawKey;
      try {
        key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      } catch {
        // Keep the original key if it contains malformed percent-encoding.
      }
      return SENSITIVE_KEY.test(key) ? `${prefix}${key}=[REDACTED]` : match;
    },
  );

  return withoutAssignments.replace(
    /(token|secret|password|passwd|api[_-]?key|access[_-]?key|authorization|auth|signature|credential|jwt|private[_-]?key)=\[REDACTED\]\s+\[REDACTED\]/gi,
    '$1=[REDACTED]',
  );
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127 ? ' ' : character;
    })
    .join('');
}

/** Remove URL userinfo, query parameters, and fragments before displaying a URL. */
export function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return '[invalid-url]';
  }
}
