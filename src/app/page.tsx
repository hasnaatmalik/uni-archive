'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { supabase, Photo } from '@/lib/supabase';
import PhotoCard from '@/components/PhotoCard';
import PhotoModal from '@/components/PhotoModal';
import { Lock } from 'lucide-react';

const ParticleField = dynamic(() => import('@/components/ParticleField'), { ssr: false });

const TICKER_ITEMS = ['FAST NU CFD', 'BS COMPUTER SCIENCE', '2022 — 2026', 'CAMPUS MEMORIES', 'THE PEOPLE ●', 'THE PLACE', 'FOUR YEARS', 'FAST NU CFD', 'BS COMPUTER SCIENCE', '2022 — 2026', 'CAMPUS MEMORIES', 'THE PEOPLE ●', 'THE PLACE', 'FOUR YEARS'];

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [loading, setLoading] = useState(true);
  const [heroVisible, setHeroVisible] = useState(false);
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');
  const siteTitle = process.env.NEXT_PUBLIC_SITE_TITLE || 'Uni Archive';

  useEffect(() => {
    fetchPhotos();
    setTimeout(() => setHeroVisible(true), 100);
  }, []);

  const fetchPhotos = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('photos')
      .select(`*, comment_count:comments(count)`);

    const photos = (data || []).map((p: Photo & { comment_count: { count: number }[] }) => ({
      ...p,
      comment_count: p.comment_count?.[0]?.count ?? 0,
    }));

    setPhotos(photos);
    setLoading(false);
  };

  // Sort client-side so toggling is instant
  const sortedPhotos = [...photos].sort((a, b) => {
    const dateA = a.taken_at ? new Date(a.taken_at).getTime() : new Date(a.created_at).getTime();
    const dateB = b.taken_at ? new Date(b.taken_at).getTime() : new Date(b.created_at).getTime();
    return sortOrder === 'oldest' ? dateA - dateB : dateB - dateA;
  });

  // Masonry split into 3 columns
  const columns: Photo[][] = [[], [], []];
  sortedPhotos.forEach((photo, i) => columns[i % 3].push(photo));

  return (
    <main style={{ position: 'relative', minHeight: '100vh', background: '#0a0a0a' }}>
      <ParticleField />

      {/* —— HERO —— */}
      <section style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 clamp(24px, 6vw, 96px)',
        borderBottom: '1px solid #1e1e1e',
      }}>
        {/* Top bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '28px clamp(24px, 6vw, 96px)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #1a1a1a',
        }}>
          <span className="font-mono" style={{ fontSize: '11px', color: '#444', letterSpacing: '0.12em' }}>
            {siteTitle.toUpperCase()}
          </span>
          <a
            href="/admin"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
          >
            <Lock size={11} color="#333" />
          </a>
        </div>

        {/* Main headline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: heroVisible ? 1 : 0 }}
          transition={{ duration: 0.01 }}
        >
          <h1 className="font-display" style={{
            fontSize: 'clamp(64px, 14vw, 200px)',
            fontWeight: 800,
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            color: '#f5f2ed',
            mixBlendMode: 'normal',
          }}>
            <AnimatedWord text="THE" delay={0} />
            <br />
            <AnimatedWord text="ARCHIVE" delay={200} />
          </h1>
        </motion.div>

        {/* Sub info row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          style={{
            marginTop: '48px',
            display: 'flex',
            gap: 'clamp(24px, 6vw, 80px)',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em', marginBottom: '6px' }}>
              MEMORIES
            </div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#f5f2ed' }}>
              {loading ? '—' : photos.length}
            </div>
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em', marginBottom: '6px' }}>
              BATCH
            </div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#f5f2ed' }}>
              2022–26
            </div>
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em', marginBottom: '6px' }}>
              CAMPUS
            </div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#f5f2ed' }}>
              CFD
            </div>
          </div>
          <div>
            <div className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em', marginBottom: '6px' }}>
              DEGREE
            </div>
            <div style={{ fontSize: '28px', fontWeight: 600, color: '#f5f2ed' }}>
              BS CS
            </div>
          </div>
        </motion.div>

        {/* Scroll cue */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          style={{
            position: 'absolute',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span className="font-mono" style={{ fontSize: '10px', color: '#333', letterSpacing: '0.12em' }}>
            SCROLL
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '1px', height: '32px', background: '#2a2a2a' }}
          />
        </motion.div>
      </section>

      {/* —— TICKER —— */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
        borderBottom: '1px solid #1a1a1a',
        padding: '14px 0',
        background: '#0a0a0a',
      }}>
        <div className="ticker-inner">
          {TICKER_ITEMS.map((item, i) => (
            <span
              key={i}
              className="font-mono"
              style={{
                fontSize: '11px',
                color: '#2a2a2a',
                letterSpacing: '0.15em',
                marginRight: '48px',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* —— INTRO BLURB —— */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'relative',
          zIndex: 1,
          padding: 'clamp(48px, 8vw, 96px) clamp(24px, 6vw, 96px)',
          borderBottom: '1px solid #1a1a1a',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '48px',
          alignItems: 'start',
        }}
      >
        <div>
          <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em', marginBottom: '16px' }}>
            THE STORY
          </p>
          <p style={{ fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)', fontWeight: 500, color: '#f5f2ed', lineHeight: 1.5 }}>
            Four years. One campus. Countless late nights, bad chai, study sessions that turned into something more — this is where it all happened.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ borderLeft: '2px solid #1e1e1e', paddingLeft: '20px' }}>
            <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '6px' }}>UNIVERSITY</p>
            <p style={{ fontSize: '0.95rem', color: '#f5f2ed' }}>FAST NU — CFD Campus</p>
          </div>
          <div style={{ borderLeft: '2px solid #1e1e1e', paddingLeft: '20px' }}>
            <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '6px' }}>DEGREE</p>
            <p style={{ fontSize: '0.95rem', color: '#f5f2ed' }}>BS Computer Science</p>
          </div>
          <div style={{ borderLeft: '2px solid #1e1e1e', paddingLeft: '20px' }}>
            <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '6px' }}>BATCH</p>
            <p style={{ fontSize: '0.95rem', color: '#f5f2ed' }}>2022 — 2026</p>
          </div>
        </div>
      </motion.section>

      {/* —— GRID —— */}
      <section style={{
        position: 'relative',
        zIndex: 1,
        padding: 'clamp(48px, 8vw, 96px) clamp(16px, 4vw, 48px)',
      }}>
        {/* Sort toggle */}
        {!loading && photos.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
          }}>
            <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em' }}>
              {photos.length} MEMORIES
            </span>
            <button
              onClick={() => setSortOrder(s => s === 'oldest' ? 'newest' : 'oldest')}
              style={{
                background: 'transparent',
                border: '1px solid #222',
                color: '#666',
                cursor: 'pointer',
                padding: '6px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#f5f2ed'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#666'; }}
            >
              <span className="font-mono" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>
                {sortOrder === 'oldest' ? '↑ OLDEST FIRST' : '↓ NEWEST FIRST'}
              </span>
            </button>
          </div>
        )}
        {loading ? (
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', paddingTop: '96px' }}>
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2a2a2a' }}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
              />
            ))}
          </div>
        ) : photos.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: '96px' }}>
            <p className="font-mono" style={{ fontSize: '12px', color: '#333', letterSpacing: '0.12em' }}>
              NO PHOTOS YET
            </p>
            <p style={{ fontSize: '0.8rem', color: '#2a2a2a', marginTop: '8px' }}>
              Head to <a href="/admin" style={{ color: '#444' }}>/admin</a> to add the first memory.
            </p>
          </div>
        ) : (
          <div className="masonry-grid">
            {columns.map((col, ci) => (
              <div key={ci} className="masonry-column">
                {col.map((photo, pi) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    index={ci * Math.ceil(photos.length / 3) + pi}
                    priority={pi < 2}
                    onClick={setSelectedPhoto}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* —— FOOTER —— */}
      <footer style={{
        position: 'relative',
        zIndex: 1,
        borderTop: '1px solid #1a1a1a',
        padding: '28px clamp(24px, 6vw, 96px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span className="font-mono" style={{ fontSize: '10px', color: '#2a2a2a', letterSpacing: '0.1em' }}>
          {siteTitle.toUpperCase()} © {new Date().getFullYear()}
        </span>
        <span className="font-mono" style={{ fontSize: '10px', color: '#2a2a2a', letterSpacing: '0.1em' }}>
          FAST NU CFD · BS CS · 2022–2026
        </span>
      </footer>

      {/* Modal */}
      <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
    </main>
  );
}

// Inline word-by-word animator using CSS-only approach with staggered letter spans
function AnimatedWord({ text, delay = 0 }: { text: string; delay?: number }) {
  return (
    <span style={{ display: 'inline-block' }}>
      {text.split('').map((char, i) => (
        <motion.span
          key={i}
          initial={{ y: '100%', opacity: 0, display: 'inline-block' }}
          animate={{ y: '0%', opacity: 1 }}
          transition={{
            duration: 0.6,
            delay: delay / 1000 + i * 0.04,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ display: 'inline-block', overflow: 'hidden' }}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
}
