# Security policy

The project is experimental and currently supports the latest `0.x` release line.

Do not open a public issue for a vulnerability. Use GitHub's **Report a vulnerability** private
reporting flow for this repository. Include affected versions, impact, reproduction steps, and any
suggested mitigation. Do not include private keys, tokens, or live user data.

The maintainer will acknowledge a report within five working days when possible. No bug bounty or
payment is promised. Public disclosure should wait until a fix or coordinated disclosure plan is
agreed.

## Credential handling

The library rejects RPC endpoint URLs that contain userinfo, such as `https://user:password@host`,
with a typed `RpcConfigurationError` before any request is made. Credentials in URLs leak through
process listings, logs, and copied diagnostics, so they are refused rather than stripped. Configure
provider-supported header authentication through a custom `fetch` wrapper instead of placing secrets
in URLs, command lines, or checked-in configuration.

Diagnostics expose only the endpoint origin (scheme, host, and port) and remove query strings and
fragments. Request bodies are never echoed in configuration errors.
