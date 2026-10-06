import type { MemberRole } from '@agrovax/shared';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate`. */
      auth?: { userId: string };
      /** Preenchido pelo middleware `farmAccess`. */
      farm?: { id: string; role: MemberRole };
    }
  }
}

export {};
