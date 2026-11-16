
import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        role: UserRole;
        fullName: string;
        email: string;
      };
      requestId?: string;
    }
  }
}

export {};
