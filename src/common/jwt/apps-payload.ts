/** Mirrors iam-api's `apps.application` JWT claim shape exactly -- this
 * service only ever verifies tokens iam-api issued, never signs its own. */

/** One role the logged-in user has assigned for the application it logged into. */
export interface RolePayload {
  id: number;
  name: string;
  description: string;
}

/** The application resolved from `X-Application-Name`, plus the caller's roles on it. */
export interface ApplicationPayload {
  id: number;
  name: string;
  description: string;
  roles: RolePayload[];
}

/** Top-level `apps` claim carried by the JWT. */
export interface AppsPayload {
  application: ApplicationPayload;
}
