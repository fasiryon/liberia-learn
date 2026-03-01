import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string | null;
      schoolId?: string | null;
      isPlatformAdmin?: boolean;
      iat?: number | null;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string | null;
    schoolId?: string | null;
    isPlatformAdmin?: boolean;
    iat?: number;
  }
}
