const utf8 = new TextEncoder();

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(text)));
}

/**
 * Whether a request may open a room. With no `ACCESS_TOKEN` configured
 * every request may (local dev); with one, `?token=` must match it.
 * Both sides are hashed first so the constant-time compare also hides
 * the token's length.
 *
 * A token compiled into the mobile app or the dashboard keeps random
 * scanners out; anyone holding a client build has it. It is not
 * authentication.
 */
export async function hasAccess(url: URL, accessToken: string | undefined) {
  if (!accessToken) {
    return true;
  }
  const given = url.searchParams.get('token');
  if (given === null) {
    return false;
  }
  const [expected, actual] = await Promise.all([
    sha256(accessToken),
    sha256(given),
  ]);
  return crypto.subtle.timingSafeEqual(expected, actual);
}
