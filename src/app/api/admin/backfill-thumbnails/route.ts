import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
    const adminPassword = process.env.ADMIN_PASSWORD;

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    try {
        const body = await request.json();
        if (!body.password || body.password !== adminPassword) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch a small batch of photos that don't have a thumbnail yet
        // We limit to 5 per request to avoid Vercel serverless function timeouts (10s limit on free tier)
        const { data: photos, error: fetchError } = await supabase
            .from('photos')
            .select('id, image_url')
            .is('thumbnail_url', null)
            .limit(5);

        if (fetchError) {
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!photos || photos.length === 0) {
            return NextResponse.json({ processed: 0, done: true, message: 'All photos already have thumbnails' });
        }

        let processed = 0;
        let failed = 0;

        for (const photo of photos) {
            try {
                // Download the original image
                const response = await fetch(photo.image_url);
                if (!response.ok) { failed++; continue; }

                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);

                // Generate tiny thumbnail
                const thumbBuffer = await sharp(buffer)
                    .resize(20, null, { withoutEnlargement: true })
                    .jpeg({ quality: 20 })
                    .blur(2)
                    .toBuffer();

                // Extract original filename from URL to create a matching thumb name
                const url = new URL(photo.image_url);
                const originalName = url.pathname.split('/').pop() || `${photo.id}`;
                const thumbFileName = `thumb-${originalName.replace(/\.[^.]+$/, '.jpg')}`;

                // Upload thumbnail
                const { error: uploadError } = await supabase.storage
                    .from('photos')
                    .upload(thumbFileName, thumbBuffer, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });

                if (uploadError) { failed++; continue; }

                // Get public URL and update the photo record
                const { data: thumbUrlData } = supabase.storage.from('photos').getPublicUrl(thumbFileName);

                await supabase
                    .from('photos')
                    .update({ thumbnail_url: thumbUrlData.publicUrl })
                    .eq('id', photo.id);

                processed++;
            } catch (err) {
                console.error(`Failed to generate thumbnail for photo ${photo.id}:`, err);
                failed++;
            }
        }

        return NextResponse.json({
            processed,
            failed,
            total: photos.length,
            done: false, // Tell the client there might be more batches
            message: `Generated ${processed} thumbnails${failed > 0 ? `, ${failed} failed` : ''}`,
        });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
