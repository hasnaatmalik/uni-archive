'use client';

import { motion } from 'framer-motion';
import { Photo } from '@/lib/supabase';
import { MessageSquare } from 'lucide-react';

interface PhotoCardProps {
    photo: Photo;
    index: number;
    onClick: (photo: Photo) => void;
}

export default function PhotoCard({ photo, index, onClick }: PhotoCardProps) {
    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
                duration: 0.5,
                delay: index * 0.06,
                ease: [0.16, 1, 0.3, 1],
            }}
            className="photo-card"
            onClick={() => onClick(photo)}
            style={{
                position: 'relative',
                cursor: 'crosshair',
                background: '#111',
            }}
        >
            {/* The image */}
            <div style={{ position: 'relative', width: '100%' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={photo.image_url}
                    alt={photo.caption || 'Archive photo'}
                    style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                        objectFit: 'cover',
                    }}
                />
            </div>

            {/* Hover overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(10, 10, 10, 0.75)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    padding: '16px',
                }}
            >
                {photo.caption && (
                    <p style={{
                        fontSize: '0.8rem',
                        color: '#f5f2ed',
                        lineHeight: 1.4,
                        marginBottom: '8px',
                    }}>
                        {photo.caption}
                    </p>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {photo.taken_at && (
                        <span className="font-mono" style={{ fontSize: '10px', color: '#c9b99a', letterSpacing: '0.08em' }}>
                            {formatDate(photo.taken_at)}
                        </span>
                    )}
                    {(photo.comment_count ?? 0) > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageSquare size={10} color="#6b6b6b" />
                            <span className="font-mono" style={{ fontSize: '10px', color: '#6b6b6b' }}>
                                {photo.comment_count}
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* Date stamp — always visible, top-right corner */}
            {photo.taken_at && (
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(10,10,10,0.7)',
                    padding: '3px 6px',
                    pointerEvents: 'none',
                }}>
                    <span className="font-mono" style={{ fontSize: '9px', color: '#c9b99a', letterSpacing: '0.1em' }}>
                        {formatDate(photo.taken_at)}
                    </span>
                </div>
            )}
        </motion.div>
    );
}
