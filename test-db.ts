import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function test() {
    // Let's see what the thumbnail_urls actually look like for a few rows
    const { data: photos, error } = await supabase
        .from('photos')
        .select('id, image_url, thumbnail_url')
        .limit(10);

    console.log('Error:', error);
    photos?.forEach(p => console.log(`Photo ${p.id} thumb:`, p.thumbnail_url));
}

test();
