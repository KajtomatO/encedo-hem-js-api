// Device address parsing.
// implements: REQ-NET-002

import { HemValidationError } from "../errors.js";

/**
 * Parses the device URL into the base that `/api/…` paths are appended to.
 * Hostnames, IPv4 and IPv6 literals, ports and a path prefix are accepted;
 * a trailing slash is ignored. Credentials, queries and fragments are refused.
 */
export function parseDeviceUrl(input: unknown): { base: string; secure: boolean } {
  if (typeof input !== "string" && !(input instanceof URL)) {
    throw new HemValidationError("url", "the device URL is required");
  }
  let url: URL;
  try {
    url = new URL(String(input));
  } catch {
    throw new HemValidationError("url", "is not a valid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HemValidationError("url", "must use https: or http:");
  }
  if (url.username !== "" || url.password !== "") {
    throw new HemValidationError("url", "must not contain a username or password");
  }
  if (url.search !== "" || url.hash !== "") {
    throw new HemValidationError("url", "must not contain a query or fragment");
  }
  const prefix = url.pathname.replace(/\/+$/, "");
  return { base: url.origin + prefix, secure: url.protocol === "https:" };
}
