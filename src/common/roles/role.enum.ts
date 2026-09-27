/** Role names as they exist for the "infra-hub-api" application in iam-api's
 * `apps_roles` table. infra-hub-api has a single caller (the ticket-hub-api
 * service user), so a single role is enough -- no need for the granularity
 * ticket-hub-api has across multiple human-facing roles. */
export enum Role {
  ADMIN = 'ADMIN',
}
