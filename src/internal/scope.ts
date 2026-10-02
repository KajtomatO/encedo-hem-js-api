import { HemValidationError } from "../errors.js";

/** A scope requested at login: 1 to 127 printable ASCII characters without spaces [YAML]. */
export function validateScope(scope: unknown, parameter = "scope", max = 127): string {
  if (typeof scope !== "string" || scope.length < 1 || scope.length > max || !/^[\x21-\x7e]+$/.test(scope)) {
    throw new HemValidationError(parameter, `must be 1 to ${max} printable ASCII characters without spaces`);
  }
  return scope;
}
