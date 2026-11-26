export type UserRole = "SUBMITTER" | "APPROVER" | "ADMIN";

export type AuthUser = {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
};

export type LoginResponse = {
  success: true;
  message: string;
  user: AuthUser;
};
