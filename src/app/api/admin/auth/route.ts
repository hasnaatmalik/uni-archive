import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const formData = await request.formData();
    const password = formData.get('password') as string;

    if (!password || password !== adminPassword) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
}
