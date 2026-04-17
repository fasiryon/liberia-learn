import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { recordSloEvent } from '@/lib/slo/tracker';

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const { email, password } = await request.json();

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.hashedPwd) {
      recordSloEvent({
        service: "login",
        success: false,
        latencyMs: Date.now() - startedAt,
        schoolId: user?.schoolId ?? null,
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.hashedPwd);

    if (!isValid) {
      recordSloEvent({
        service: "login",
        success: false,
        latencyMs: Date.now() - startedAt,
        schoolId: user.schoolId ?? null,
      });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Create JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('[login] JWT_SECRET env var is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const secret = new TextEncoder().encode(jwtSecret);

    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret);

    // Set cookie
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    recordSloEvent({
      service: "login",
      success: true,
      latencyMs: Date.now() - startedAt,
      schoolId: user.schoolId ?? null,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    recordSloEvent({
      service: "login",
      success: false,
      latencyMs: Date.now() - startedAt,
      schoolId: null,
    });
    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
