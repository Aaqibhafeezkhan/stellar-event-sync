export const SECRET_REDACTION_CASES = [
  {
    name: 'URL userinfo and query parameters',
    input:
      'request failed at https://sentinel-user:sentinel-password@rpc.example.test/rpc?api_key=sentinel-query-key#sentinel-fragment',
    expected: 'request failed at https://rpc.example.test/rpc',
    sentinels: ['sentinel-user', 'sentinel-password', 'sentinel-query-key', 'sentinel-fragment'],
  },
  {
    name: 'sensitive query keys while retaining safe context',
    input: 'request failed?api_key=sentinel-api-key&network=testnet',
    expected: 'request failed?api_key=[REDACTED]&network=testnet',
    sentinels: ['sentinel-api-key'],
  },
  {
    name: 'bearer authorization values',
    input: 'provider returned Bearer sentinel-bearer-token',
    expected: 'provider returned Bearer [REDACTED]',
    sentinels: ['sentinel-bearer-token'],
  },
  {
    name: 'authorization header with a bearer value',
    input: 'request failed authorization: Bearer sentinel-auth-header-token',
    expected: 'request failed authorization=[REDACTED]',
    sentinels: ['sentinel-auth-header-token'],
  },
  {
    name: 'JWT-like values',
    input:
      'provider returned eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZW50aW5lbCJ9.signatureSentinel123456',
    expected: 'provider returned [REDACTED]',
    sentinels: ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiJzZW50aW5lbCJ9', 'signatureSentinel123456'],
  },
  {
    name: 'mixed-case credential keys',
    input: 'request failed AcCeSs_ToKeN=sentinel-mixed-case-secret',
    expected: 'request failed AcCeSs_ToKeN=[REDACTED]',
    sentinels: ['sentinel-mixed-case-secret'],
  },
  {
    name: 'percent-encoded key and value',
    input: 'provider error access%5Ftoken%3Dsentinel%252Dencoded',
    expected: 'provider error access_token=[REDACTED]',
    sentinels: ['sentinel%252Dencoded', 'sentinel%2Dencoded', 'sentinel-encoded'],
  },
  {
    name: 'provider-specific token prefixes',
    input:
      'provider error ghp_sentinelGitHubToken1234567890 sk_fixture_sentinelStripeToken123456 xoxb-sentinelSlackToken123456',
    expected: 'provider error [REDACTED] [REDACTED] [REDACTED]',
    sentinels: [
      'ghp_sentinelGitHubToken1234567890',
      'sk_fixture_sentinelStripeToken123456',
      'xoxb-sentinelSlackToken123456',
    ],
  },
] as const;
