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
                /* Overlay — flex centering */
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(8, 8, 8, 0.94)',
                        backdropFilter: 'blur(6px)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                    }}
                >
                    {/* Modal panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 20 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: '100%',
                            maxWidth: '1080px',
                            height: '88vh',
                            maxHeight: '780px',
                            background: '#0f0f0f',
                            border: '1px solid #222',
                            display: 'grid',
                            gridTemplateColumns: '1fr 340px',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        {/* ── LEFT: image ── */}
                        <div style={{
                            background: '#080808',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
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

                        {/* ── RIGHT: info + comments ── */}
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            borderLeft: '1px solid #1e1e1e',
                            overflow: 'hidden',
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '20px 24px',
                                borderBottom: '1px solid #1e1e1e',
                                flexShrink: 0,
                            }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: photo.caption ? '14px' : '0',
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
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#444',
                                            cursor: 'crosshair',
                                            padding: '4px',
                                            display: 'flex',
                                            transition: 'color 0.15s',
                                            lineHeight: 0,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f5f2ed')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = '#444')}
                                    >
                                        <X size={15} />
                                    </button>
                                </div>

                                {photo.caption && (
                                    <p style={{
                                        fontSize: '0.875rem',
                                        color: '#d0ccc5',
                                        lineHeight: 1.55,
                                        marginBottom: photo.taken_at ? '10px' : '0',
                                    }}>
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

                            {/* Comments — fills remaining space */}
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
