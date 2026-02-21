import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

function checkPassword(password: string) {
    return password && password === process.env.ADMIN_PASSWORD;
}

// PATCH — update caption and/or date
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getSupabase();
    const body = await request.json();
    const { password, caption, taken_at } = body;

    if (!checkPassword(password)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updates: Record<string, unknown> = {};
    if (caption !== undefined) updates.caption = caption || null;
    if (taken_at !== undefined) updates.taken_at = taken_at || null;

    const { data, error } = await supabase
        .from('photos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ photo: data });
}

// DELETE — remove photo from DB + Storage
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = getSupabase();
    const body = await request.json();

    if (!checkPassword(body.password)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get image_url first so we can delete from storage too
    const { data: photo } = await supabase
        .from('photos')
        .select('image_url')
        .eq('id', id)
        .single();

    // Delete from DB (cascade deletes comments too)
    const { error } = await supabase.from('photos').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Delete from Storage (best-effort, don't fail if it errors)
    if (photo?.image_url) {
        try {
            const url = new URL(photo.image_url);
            const filePath = url.pathname.split('/object/public/photos/')[1];
            if (filePath) {
                await supabase.storage.from('photos').remove([filePath]);
            }
        } catch { /* ignore storage errors */ }
    }

    return NextResponse.json({ ok: true });
}
