'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState, useCallback } from 'react';
import { X, MessageSquare, Calendar } from 'lucide-react';
import { Photo, Comment, supabase } from '@/lib/supabase';
import CommentSection from './CommentSection';

interface PhotoModalProps {
    photo: Photo | null;
    onClose: () => void;
}

export default function PhotoModal({ photo, onClose }: PhotoModalProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    const fetchComments = useCallback(async () => {
        if (!photo) return;
        setLoading(true);
        const { data } = await supabase
            .from('comments')
            .select('*')
            .eq('photo_id', photo.id)
            .order('created_at', { ascending: true });
        setComments(data || []);
        setLoading(false);
    }, [photo]);

    useEffect(() => {
        if (photo) {
            fetchComments();
            document.body.style.overflow = 'hidden';
        }
        return () => { document.body.style.overflow = ''; };
    }, [photo, fetchComments]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    return (
        <AnimatePresence>
            {photo && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 8, 8, 0.95)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: isMobile ? 'flex-end' : 'center',
                        justifyContent: 'center',
                        padding: isMobile ? '0' : '24px',
                    }}
                >
                    <motion.div
                        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 20 }}
                        animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: isMobile ? '100%' : '1080px',
                            height: isMobile ? '95vh' : '88vh',
                            maxHeight: isMobile ? '95vh' : '780px',
                            background: '#0f0f0f',
                            border: isMobile ? 'none' : '1px solid #222',
                            borderTop: isMobile ? '1px solid #222' : undefined,
                            borderRadius: isMobile ? '8px 8px 0 0' : '0',
                            display: 'flex',
                            flexDirection: isMobile ? 'column' : 'row',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        {/* ── IMAGE (top on mobile, left on desktop) ── */}
                        <div style={{
                            background: '#080808',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            // Mobile: fixed height at top. Desktop: flex fills left column
                            ...(isMobile
                                ? { width: '100%', height: '45vh', maxHeight: '340px', borderBottom: '1px solid #1e1e1e' }
                                : { flex: 1, height: '100%' }
                            ),
                        }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={photo.image_url}
                                alt={photo.caption || 'Archive photo'}
                                style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />
                        </div>

                        {/* ── INFO + COMMENTS ── */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            borderLeft: isMobile ? 'none' : '1px solid #1e1e1e',
                            overflow: 'hidden',
                            width: isMobile ? '100%' : '340px',
                            flexShrink: 0,
                            flex: isMobile ? 1 : undefined,
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid #1e1e1e',
                                flexShrink: 0,
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: photo.caption ? '10px' : '0',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <MessageSquare size={11} color="#444" />
                                        <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em' }}>
                                            {loading ? '—' : comments.length} COMMENT{comments.length !== 1 ? 'S' : ''}
                                        </span>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        style={{
                                            background: 'transparent', border: 'none',
                                            color: '#444', cursor: 'pointer', padding: '4px',
                                            display: 'flex', transition: 'color 0.15s', lineHeight: 0,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f2ed')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
                                    >
                                        <X size={15} />
                                    </button>
                                </div>

                                {photo.caption && (
                                    <p style={{ fontSize: '0.85rem', color: '#d0ccc5', lineHeight: 1.55, marginBottom: photo.taken_at ? '8px' : '0' }}>
                                        {photo.caption}
                                    </p>
                                )}

                                {photo.taken_at && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <Calendar size={10} color="#555" />
                                        <span className="font-mono" style={{ fontSize: '10px', color: '#555' }}>
                                            {formatDate(photo.taken_at)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Comments */}
                            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <CommentSection
                                    photoId={photo.id}
                                    comments={comments}
                                    loading={loading}
                                    onCommentAdded={fetchComments}
                                />
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
