# Uni Archive

A personal university photo archive — only you can post, everyone can comment.

## Quick Start

### 1. Supabase Setup (one time)

1. Create a free project at [supabase.com](https://supabase.com)

2. In the **SQL Editor**, run:

```sql
-- Photos table
create table photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  taken_at date,
  created_at timestamptz default now()
);

-- Comments table
create table comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid references photos(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz default now()
);

-- Row Level Security
alter table photos enable row level security;
alter table comments enable row level security;

create policy "public read photos" on photos for select using (true);
create policy "public read comments" on comments for select using (true);
create policy "public insert comments" on comments for insert with check (true);
```

3. Go to **Storage** → Create a new bucket called `photos` → set it to **Public**

4. Go to **Project Settings → API** → copy your **Project URL** and **anon public** key

### 2. Environment Variables

```bash
cp .env.local.example .env.local
```

Then fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
ADMIN_PASSWORD=your_secret_password
NEXT_PUBLIC_SITE_TITLE=My Uni Archive
```

> **Optional**: for production uploads, also add `SUPABASE_SERVICE_ROLE_KEY` (from Project Settings → API → service_role key) to your Vercel env vars.

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add the environment variables in Vercel dashboard (Project Settings → Environment Variables)
4. Deploy 🚀

## Usage

- **Viewing photos**: anyone with the link can see the archive at `/`
- **Adding photos**: go to `/admin` → enter your password → upload with caption + date
- **Commenting**: anyone can leave a comment with their name on any photo
