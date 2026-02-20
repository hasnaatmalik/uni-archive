import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { photo_id, author_name, body: commentBody } = body;

        if (!photo_id || !author_name?.trim() || !commentBody?.trim()) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const { data: comment, error } = await supabase
            .from('comments')
            .insert({
                photo_id,
                author_name: author_name.trim(),
                body: commentBody.trim(),
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ comment }, { status: 201 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
