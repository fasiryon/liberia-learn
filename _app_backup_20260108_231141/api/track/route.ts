import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

type TrackBody = {
  eventType: string;
  drugId?: string | null;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });
  const body = (await req.json()) as TrackBody;

  if (!body.eventType) {
    return NextResponse.json(
      { error: 'eventType is required' },
      { status: 400 }
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('analytics_events').insert({
    user_id: user?.id ?? null,
    session_id: body.sessionId ?? null,
    event_type: body.eventType,
    drug_id: body.drugId ?? null,
    metadata: body.metadata ?? {},
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}


