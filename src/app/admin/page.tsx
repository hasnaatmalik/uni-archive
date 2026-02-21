'use client';

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Lock, Image as ImageIcon, X, Save, Loader } from 'lucide-react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────────────────
type UploadStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error';

interface QueueItem {
    id: string;          // local temp id
    file: File;
    preview: string;
    exifDate: string | null;
    status: UploadStatus;
    error?: string;
    // filled after upload
    photoId?: string;
    caption: string;
    captionSaved: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
        const MAX_WIDTH = 1600;
        const QUALITY = 0.82;
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, MAX_WIDTH / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    if (!blob) { resolve(file); return; }
                    const out = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
                    resolve(out);
                },
                'image/jpeg',
                QUALITY
            );
        };
        img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

async function extractExifDate(file: File): Promise<string | null> {
    try {
        const exifr = (await import('exifr')).default;
        const result = await exifr.parse(file, ['DateTimeOriginal', 'DateTime', 'CreateDate']);
        const raw: Date | string | undefined =
            result?.DateTimeOriginal ?? result?.CreateDate ?? result?.DateTime;
        if (!raw) return null;
        const d = raw instanceof Date ? raw : new Date(raw);
        if (isNaN(d.getTime())) return null;
        // Return as YYYY-MM-DD for the date input
        return d.toISOString().split('T')[0];
    } catch {
        return null;
    }
}

function makePreview(file: File): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Auth ──
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) return;
        const fd = new FormData();
        fd.append('password', password);
        const res = await fetch('/api/admin/auth', { method: 'POST', body: fd });
        if (res.ok) { setAuthenticated(true); setAuthError(''); }
        else setAuthError('Wrong password.');
    };

    // ── File selection ──
    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (!arr.length) return;

        const items: QueueItem[] = await Promise.all(arr.map(async (f) => {
            const [preview, exifDate] = await Promise.all([makePreview(f), extractExifDate(f)]);
            return {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file: f,
                preview,
                exifDate,
                status: 'pending' as UploadStatus,
                caption: '',
                captionSaved: false,
            };
        }));

        setQueue(prev => [...prev, ...items]);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) handleFiles(e.target.files);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    };

    const removeItem = (id: string) =>
        setQueue(prev => prev.filter(item => item.id !== id));

    // ── Upload all pending ──
    const uploadAll = async () => {
        const pending = queue.filter(item => item.status === 'pending');
        if (!pending.length) return;
        setUploading(true);

        for (const item of pending) {
            // compressing
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'compressing' } : i));
            const compressed = await compressImage(item.file);

            // uploading
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
            const fd = new FormData();
            fd.append('password', password);
            fd.append('file', compressed);
            fd.append('caption', '');
            fd.append('taken_at', item.exifDate ?? '');

            try {
                const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error((await res.json()).error ?? 'Upload failed');
                const { photo } = await res.json();
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? { ...i, status: 'done', photoId: photo.id } : i
                ));
            } catch (err: unknown) {
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Failed' } : i
                ));
            }
        }

        setUploading(false);
    };

    // ── Save caption ──
    const saveCaption = async (item: QueueItem) => {
        if (!item.photoId) return;
        setQueue(prev => prev.map(i => i.id === item.id ? { ...i, captionSaved: false } : i));
        const res = await fetch(`/api/admin/photos/${item.photoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, caption: item.caption }),
        });
        if (res.ok) {
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, captionSaved: true } : i));
        }
    };

    const updateCaption = (id: string, caption: string) =>
        setQueue(prev => prev.map(i => i.id === id ? { ...i, caption, captionSaved: false } : i));

    const pendingCount = queue.filter(i => i.status === 'pending').length;
    const doneCount = queue.filter(i => i.status === 'done').length;

    return (
        <main style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            padding: '48px 24px',
            position: 'relative',
        }}>
            {/* Back */}
            <div style={{ marginBottom: '40px' }}>
                <Link href="/" style={{ textDecoration: 'none' }}>
                    <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em' }}>
                        ← ARCHIVE
                    </span>
                </Link>
            </div>

            <AnimatePresence mode="wait">
                {!authenticated ? (
                    /* ── AUTH ── */
                    <motion.div
                        key="auth"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ maxWidth: '320px', margin: '0 auto', paddingTop: '80px' }}
                    >
                        <Lock size={16} color="#2a2a2a" style={{ marginBottom: '32px' }} />
                        <h1 className="font-display" style={{ fontSize: '28px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>
                            ADMIN
                        </h1>
                        <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '32px' }}>
                            ENTER PASSWORD TO CONTINUE
                        </p>
                        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input className="input-raw" type="password" placeholder="Password"
                                value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                            {authError && (
                                <p className="font-mono" style={{ fontSize: '10px', color: '#ff3b30' }}>{authError}</p>
                            )}
                            <button type="submit" className="btn-raw">ENTER →</button>
                        </form>
                    </motion.div>
                ) : (
                    /* ── UPLOAD WORKSPACE ── */
                    <motion.div
                        key="workspace"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        style={{ maxWidth: '900px', margin: '0 auto' }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
                            <div>
                                <h1 className="font-display" style={{ fontSize: '28px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>
                                    ADD MEMORIES
                                </h1>
                                <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em' }}>
                                    SELECT MULTIPLE PHOTOS — DATES EXTRACTED AUTOMATICALLY
                                </p>
                            </div>
                            {pendingCount > 0 && (
                                <button
                                    onClick={uploadAll}
                                    disabled={uploading}
                                    className="btn-raw"
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    {uploading ? (
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            style={{ width: '12px', height: '12px', border: '1px solid #000', borderTopColor: 'transparent', borderRadius: '50%' }}
                                        />
                                    ) : <Upload size={12} />}
                                    UPLOAD {pendingCount} PHOTO{pendingCount !== 1 ? 'S' : ''}
                                </button>
                            )}
                        </div>

                        {/* Drop zone */}
                        <div
                            onClick={() => fileRef.current?.click()}
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#444')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1e1e1e')}
                            style={{
                                border: '1px dashed #1e1e1e',
                                padding: '40px',
                                textAlign: 'center',
                                cursor: 'crosshair',
                                marginBottom: '32px',
                                transition: 'border-color 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '12px',
                            }}
                        >
                            <ImageIcon size={22} color="#2a2a2a" />
                            <div>
                                <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', display: 'block' }}>
                                    DROP PHOTOS HERE OR CLICK TO SELECT
                                </span>
                                <span className="font-mono" style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.08em', display: 'block', marginTop: '4px' }}>
                                    MULTIPLE FILES SUPPORTED · EXIF DATES AUTO-EXTRACTED
                                </span>
                            </div>
                            <input ref={fileRef} type="file" accept="image/*" multiple
                                onChange={handleInputChange} style={{ display: 'none' }} />
                        </div>

                        {/* Stats bar */}
                        {queue.length > 0 && (
                            <div style={{
                                display: 'flex', gap: '24px', marginBottom: '24px',
                                paddingBottom: '16px', borderBottom: '1px solid #1a1a1a',
                            }}>
                                {[
                                    { label: 'QUEUED', value: pendingCount, color: '#666' },
                                    { label: 'UPLOADED', value: doneCount, color: '#4caf50' },
                                    { label: 'TOTAL', value: queue.length, color: '#f5f2ed' },
                                ].map(({ label, value, color }) => (
                                    <div key={label}>
                                        <div className="font-mono" style={{ fontSize: '9px', color: '#333', letterSpacing: '0.1em', marginBottom: '2px' }}>{label}</div>
                                        <div style={{ fontSize: '20px', fontWeight: 600, color }}>{value}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Queue grid */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                            gap: '16px',
                        }}>
                            <AnimatePresence>
                                {queue.map((item) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ duration: 0.25 }}
                                        style={{
                                            background: '#111',
                                            border: '1px solid #1e1e1e',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        {/* Image preview */}
                                        <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: '#080808' }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

                                            {/* Status overlay */}
                                            {item.status !== 'pending' && (
                                                <div style={{
                                                    position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.7)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {item.status === 'compressing' && (
                                                        <div style={{ textAlign: 'center' }}>
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                                style={{ width: '20px', height: '20px', border: '2px solid #333', borderTopColor: '#f5f2ed', borderRadius: '50%', margin: '0 auto 8px' }}
                                                            />
                                                            <span className="font-mono" style={{ fontSize: '9px', color: '#666', letterSpacing: '0.1em' }}>COMPRESSING</span>
                                                        </div>
                                                    )}
                                                    {item.status === 'uploading' && (
                                                        <div style={{ textAlign: 'center' }}>
                                                            <motion.div
                                                                animate={{ rotate: 360 }}
                                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                                style={{ width: '20px', height: '20px', border: '2px solid #333', borderTopColor: '#f5f2ed', borderRadius: '50%', margin: '0 auto 8px' }}
                                                            />
                                                            <span className="font-mono" style={{ fontSize: '9px', color: '#666', letterSpacing: '0.1em' }}>UPLOADING</span>
                                                        </div>
                                                    )}
                                                    {item.status === 'done' && (
                                                        <CheckCircle size={28} color="#4caf50" />
                                                    )}
                                                    {item.status === 'error' && (
                                                        <div style={{ textAlign: 'center', padding: '8px' }}>
                                                            <AlertCircle size={22} color="#ff3b30" style={{ marginBottom: '6px' }} />
                                                            <span className="font-mono" style={{ fontSize: '9px', color: '#ff3b30', display: 'block', letterSpacing: '0.05em' }}>
                                                                {item.error?.slice(0, 40)}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Remove button (pending only) */}
                                            {item.status === 'pending' && (
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    style={{
                                                        position: 'absolute', top: '6px', right: '6px',
                                                        background: 'rgba(10,10,10,0.8)', border: 'none',
                                                        color: '#f5f2ed', cursor: 'pointer', padding: '4px',
                                                        display: 'flex', lineHeight: 0,
                                                    }}
                                                >
                                                    <X size={11} />
                                                </button>
                                            )}

                                            {/* EXIF date badge */}
                                            {item.exifDate && (
                                                <div style={{
                                                    position: 'absolute', bottom: '6px', left: '6px',
                                                    background: 'rgba(10,10,10,0.85)', padding: '3px 6px',
                                                }}>
                                                    <span className="font-mono" style={{ fontSize: '9px', color: '#c9b99a', letterSpacing: '0.08em' }}>
                                                        {new Date(item.exifDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Filename + caption */}
                                        <div style={{ padding: '12px' }}>
                                            <p className="font-mono" style={{ fontSize: '9px', color: '#333', letterSpacing: '0.06em', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {item.file.name}
                                            </p>

                                            {/* Caption — editable once uploaded */}
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                                                <input
                                                    className="input-raw"
                                                    placeholder={item.status === 'done' ? 'Add a caption...' : 'Caption after upload'}
                                                    value={item.caption}
                                                    onChange={(e) => updateCaption(item.id, e.target.value)}
                                                    disabled={item.status !== 'done'}
                                                    style={{ flex: 1, fontSize: '12px', opacity: item.status === 'done' ? 1 : 0.3 }}
                                                />
                                                {item.status === 'done' && (
                                                    <button
                                                        onClick={() => saveCaption(item)}
                                                        disabled={item.captionSaved || !item.caption.trim()}
                                                        title="Save caption"
                                                        style={{
                                                            background: 'transparent', border: 'none',
                                                            color: item.captionSaved ? '#4caf50' : item.caption.trim() ? '#f5f2ed' : '#333',
                                                            cursor: item.captionSaved || !item.caption.trim() ? 'default' : 'pointer',
                                                            padding: '0 0 8px 0', flexShrink: 0, display: 'flex',
                                                            transition: 'color 0.15s',
                                                        }}
                                                    >
                                                        {item.captionSaved ? <CheckCircle size={13} /> : <Save size={13} />}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {/* All done message */}
                        {queue.length > 0 && doneCount === queue.length && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    marginTop: '32px', padding: '16px 20px',
                                    border: '1px solid #1e3320', background: '#0d1f10',
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                }}
                            >
                                <CheckCircle size={14} color="#4caf50" />
                                <span className="font-mono" style={{ fontSize: '11px', color: '#4caf50', letterSpacing: '0.08em' }}>
                                    ALL {doneCount} PHOTOS ARCHIVED — ADD CAPTIONS ABOVE, THEN{' '}
                                    <Link href="/" style={{ color: '#4caf50' }}>VIEW ARCHIVE →</Link>
                                </span>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
