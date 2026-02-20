'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Comment } from '@/lib/supabase';
import { Send } from 'lucide-react';

interface CommentSectionProps {
    photoId: string;
    comments: Comment[];
    loading: boolean;
    onCommentAdded: () => void;
}

export default function CommentSection({ photoId, comments, loading, onCommentAdded }: CommentSectionProps) {
    const [name, setName] = useState('');
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const listRef = useRef<HTMLDivElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !text.trim()) return;
        setSubmitting(true);
        setError('');

        try {
            const res = await fetch('/api/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photo_id: photoId, author_name: name, body: text }),
            });

            if (!res.ok) throw new Error('Failed to post comment');

            setName('');
            setText('');
            await onCommentAdded();

            // Scroll to bottom
            setTimeout(() => {
                if (listRef.current) {
                    listRef.current.scrollTop = listRef.current.scrollHeight;
                }
            }, 100);
        } catch {
            setError('Something went wrong. Try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <>
            {/* Comment list */}
            <div
                ref={listRef}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '16px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}
            >
                {loading && (
                    <div style={{ display: 'flex', gap: '4px', paddingTop: '8px' }}>
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#444' }}
                                animate={{ opacity: [0.3, 1, 0.3] }}
                                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                            />
                        ))}
                    </div>
                )}

                {!loading && comments.length === 0 && (
                    <p className="font-mono" style={{ fontSize: '11px', color: '#444', letterSpacing: '0.08em' }}>
                        NO COMMENTS YET. BE FIRST.
                    </p>
                )}

                <AnimatePresence>
                    {comments.map((comment) => (
                        <motion.div
                            key={comment.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                                borderLeft: '2px solid #2a2a2a',
                                paddingLeft: '12px',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f5f2ed' }}>
                                    {comment.author_name}
                                </span>
                                <span className="font-mono" style={{ fontSize: '10px', color: '#444' }}>
                                    {formatTime(comment.created_at)}
                                </span>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: '#999', lineHeight: 1.5 }}>
                                {comment.body}
                            </p>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Comment form */}
            <form
                onSubmit={handleSubmit}
                style={{
                    padding: '16px 24px',
                    borderTop: '1px solid #2a2a2a',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                }}
            >
                <input
                    className="input-raw"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    disabled={submitting}
                />
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <input
                        className="input-raw"
                        placeholder="Leave a memory..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={500}
                        disabled={submitting}
                        style={{ flex: 1 }}
                    />
                    <button
                        type="submit"
                        disabled={submitting || !name.trim() || !text.trim()}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: (!name.trim() || !text.trim()) ? '#333' : '#f5f2ed',
                            cursor: 'crosshair',
                            padding: '0 0 8px 0',
                            transition: 'color 0.15s',
                            flexShrink: 0,
                        }}
                    >
                        <Send size={14} />
                    </button>
                </div>
                {error && (
                    <p className="font-mono" style={{ fontSize: '10px', color: '#ff3b30', letterSpacing: '0.05em' }}>
                        {error}
                    </p>
                )}
            </form>
        </>
    );
}
