export interface AuthUser {
  userId: string;
  organizationId: string;
  email: string;
  roleKey: string;
  isOwner: boolean;
  permissions: string[];
  sessionId: string;
}
