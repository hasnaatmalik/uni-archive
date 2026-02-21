'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, CheckCircle, AlertCircle, Lock, Image as ImageIcon,
    X, Save, Trash2, ChevronDown, ChevronUp, MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { supabase, Photo, Comment } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────
type UploadStatus = 'pending' | 'compressing' | 'uploading' | 'done' | 'error';
type Tab = 'upload' | 'manage';

interface QueueItem {
    id: string;
    file: File;
    preview: string;
    exifDate: string | null;
    status: UploadStatus;
    error?: string;
    photoId?: string;
    caption: string;
    captionSaved: boolean;
}

interface ManagedPhoto extends Photo {
    editCaption: string;
    editDate: string;
    saving: boolean;
    deleting: boolean;
    commentsOpen: boolean;
    comments: Comment[];
    commentsLoaded: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const scale = Math.min(1, 1600 / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (blob) => {
                    if (!blob) { resolve(file); return; }
                    resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
                },
                'image/jpeg', 0.82
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
        const raw = result?.DateTimeOriginal ?? result?.CreateDate ?? result?.DateTime;
        if (!raw) return null;
        const d = raw instanceof Date ? raw : new Date(raw);
        return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
    } catch { return null; }
}

function makePreview(file: File): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
    });
}

function fmtDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [tab, setTab] = useState<Tab>('upload');

    // Upload state
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // Manage state
    const [managed, setManaged] = useState<ManagedPhoto[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [backfillStatus, setBackfillStatus] = useState<string | null>(null);
    const [backfilling, setBackfilling] = useState(false);

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

    // ── Load photos for manage tab ──
    const loadPhotos = useCallback(async () => {
        setLoadingPhotos(true);
        const { data } = await supabase
            .from('photos')
            .select('*')
            .order('taken_at', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: true });
        setManaged((data || []).map((p: Photo) => ({
            ...p,
            editCaption: p.caption ?? '',
            editDate: p.taken_at ?? '',
            saving: false,
            deleting: false,
            commentsOpen: false,
            comments: [],
            commentsLoaded: false,
        })));
        setLoadingPhotos(false);
    }, []);

    useEffect(() => {
        if (authenticated && tab === 'manage') loadPhotos();
    }, [authenticated, tab, loadPhotos]);

    // ── Manage: save edits ──
    const savePhoto = async (photo: ManagedPhoto) => {
        setManaged(prev => prev.map(p => p.id === photo.id ? { ...p, saving: true } : p));
        await fetch(`/api/admin/photos/${photo.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, caption: photo.editCaption, taken_at: photo.editDate }),
        });
        setManaged(prev => prev.map(p => p.id === photo.id ? { ...p, saving: false, caption: photo.editCaption, taken_at: photo.editDate } : p));
    };

    // ── Manage: delete photo ──
    const deletePhoto = async (id: string) => {
        if (!confirm('Delete this memory? This cannot be undone.')) return;
        setManaged(prev => prev.map(p => p.id === id ? { ...p, deleting: true } : p));
        await fetch(`/api/admin/photos/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        setManaged(prev => prev.filter(p => p.id !== id));
    };

    // ── Manage: toggle comments ──
    const toggleComments = async (photo: ManagedPhoto) => {
        if (!photo.commentsLoaded) {
            const { data } = await supabase
                .from('comments').select('*')
                .eq('photo_id', photo.id)
                .order('created_at', { ascending: true });
            setManaged(prev => prev.map(p =>
                p.id === photo.id ? { ...p, commentsOpen: true, commentsLoaded: true, comments: data || [] } : p
            ));
        } else {
            setManaged(prev => prev.map(p =>
                p.id === photo.id ? { ...p, commentsOpen: !p.commentsOpen } : p
            ));
        }
    };

    // ── Manage: delete comment ──
    const deleteComment = async (photoId: string, commentId: string) => {
        await fetch(`/api/admin/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        setManaged(prev => prev.map(p =>
            p.id === photoId ? { ...p, comments: p.comments.filter(c => c.id !== commentId) } : p
        ));
    };

    // ── Manage: generate thumbnails for existing photos ──
    const backfillThumbnails = async () => {
        if (!confirm('This will process photos in batches. Please keep this tab open until it finishes.')) return;

        setBackfilling(true);
        let totalProcessed = 0;
        let isDone = false;

        while (!isDone) {
            setBackfillStatus(`Processing... (${totalProcessed} done so far)`);
            try {
                const res = await fetch('/api/admin/backfill-thumbnails', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password }),
                });
                const data = await res.json();

                if (res.ok) {
                    totalProcessed += data.processed || 0;
                    isDone = data.done;

                    // If it processed nothing and says done, we're completely finished
                    if (isDone) {
                        setBackfillStatus(`Finished! Processed ${totalProcessed} total thumbnails.`);
                        loadPhotos(); // refresh the list
                    } else if (data.processed === 0 && !data.done) {
                        // Failsafe to prevent infinite loop if API is misbehaving
                        setBackfillStatus('Error: API returned 0 processed but not done.');
                        break;
                    }
                } else {
                    setBackfillStatus(`Error: ${data.error}`);
                    break;
                }
            } catch {
                setBackfillStatus('Failed to connect. The process might have timed out.');
                break;
            }
        }
        setBackfilling(false);
    };

    // ── Upload tab logic ──
    const handleFiles = useCallback(async (files: FileList | File[]) => {
        const arr = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (!arr.length) return;
        const items: QueueItem[] = await Promise.all(arr.map(async (f) => {
            const [preview, exifDate] = await Promise.all([makePreview(f), extractExifDate(f)]);
            return {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file: f, preview, exifDate,
                status: 'pending' as UploadStatus,
                caption: '', captionSaved: false,
            };
        }));
        setQueue(prev => [...prev, ...items]);
    }, []);

    const uploadAll = async () => {
        const pending = queue.filter(i => i.status === 'pending');
        if (!pending.length) return;
        setUploading(true);
        for (const item of pending) {
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'compressing' } : i));
            const compressed = await compressImage(item.file);
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));
            const fd = new FormData();
            fd.append('password', password);
            fd.append('file', compressed);
            fd.append('caption', '');
            fd.append('taken_at', item.exifDate ?? '');
            try {
                const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
                if (!res.ok) throw new Error((await res.json()).error ?? 'Failed');
                const { photo } = await res.json();
                setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'done', photoId: photo.id } : i));
            } catch (err: unknown) {
                setQueue(prev => prev.map(i =>
                    i.id === item.id ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Failed' } : i
                ));
            }
        }
        setUploading(false);
    };

    const saveCaption = async (item: QueueItem) => {
        if (!item.photoId) return;
        const res = await fetch(`/api/admin/photos/${item.photoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, caption: item.caption }),
        });
        if (res.ok) setQueue(prev => prev.map(i => i.id === item.id ? { ...i, captionSaved: true } : i));
    };

    const pendingCount = queue.filter(i => i.status === 'pending').length;
    const doneCount = queue.filter(i => i.status === 'done').length;

    // ── Render ──
    return (
        <main style={{ minHeight: '100vh', background: '#0a0a0a', padding: '40px 24px', position: 'relative' }}>
            <div style={{ marginBottom: '32px' }}>
                <Link href="/" style={{ textDecoration: 'none' }}>
                    <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em' }}>← ARCHIVE</span>
                </Link>
            </div>

            <AnimatePresence mode="wait">
                {!authenticated ? (
                    /* ── AUTH ── */
                    <motion.div key="auth" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.3 }} style={{ maxWidth: '320px', margin: '0 auto', paddingTop: '60px' }}>
                        <Lock size={16} color="#2a2a2a" style={{ marginBottom: '28px' }} />
                        <h1 className="font-display" style={{ fontSize: '28px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>ADMIN</h1>
                        <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '28px' }}>ENTER PASSWORD TO CONTINUE</p>
                        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input className="input-raw" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
                            {authError && <p className="font-mono" style={{ fontSize: '10px', color: '#ff3b30' }}>{authError}</p>}
                            <button type="submit" className="btn-raw">ENTER →</button>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div key="workspace" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                        style={{ maxWidth: '960px', margin: '0 auto' }}>

                        {/* Tab bar */}
                        <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #1e1e1e', marginBottom: '40px' }}>
                            {(['upload', 'manage'] as Tab[]).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTab(t)}
                                    className="font-mono"
                                    style={{
                                        background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === t ? '#f5f2ed' : 'transparent'}`,
                                        color: tab === t ? '#f5f2ed' : '#444', cursor: 'pointer',
                                        padding: '10px 20px', fontSize: '10px', letterSpacing: '0.12em',
                                        transition: 'color 0.15s', marginBottom: '-1px',
                                    }}
                                >
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {/* ══ UPLOAD TAB ══ */}
                        {tab === 'upload' && (
                            <div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
                                    <div>
                                        <h1 className="font-display" style={{ fontSize: '24px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>ADD MEMORIES</h1>
                                        <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em' }}>SELECT MULTIPLE — DATES EXTRACTED AUTOMATICALLY</p>
                                    </div>
                                    {pendingCount > 0 && (
                                        <button onClick={uploadAll} disabled={uploading} className="btn-raw"
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {uploading
                                                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    style={{ width: '12px', height: '12px', border: '1px solid #000', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                                : <Upload size={12} />}
                                            UPLOAD {pendingCount}
                                        </button>
                                    )}
                                </div>

                                {/* Drop zone */}
                                <div onClick={() => fileRef.current?.click()} onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                                    onDragOver={e => e.preventDefault()}
                                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#444')}
                                    onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e1e1e')}
                                    style={{ border: '1px dashed #1e1e1e', padding: '36px', textAlign: 'center', cursor: 'crosshair', marginBottom: '28px', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                    <ImageIcon size={20} color="#2a2a2a" />
                                    <div>
                                        <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', display: 'block' }}>DROP PHOTOS HERE OR CLICK</span>
                                        <span className="font-mono" style={{ fontSize: '9px', color: '#2a2a2a', letterSpacing: '0.08em', display: 'block', marginTop: '4px' }}>MULTIPLE FILES · EXIF DATES AUTO-EXTRACTED</span>
                                    </div>
                                    <input ref={fileRef} type="file" accept="image/*" multiple onChange={e => { handleFiles(e.target.files!); e.target.value = ''; }} style={{ display: 'none' }} />
                                </div>

                                {queue.length > 0 && (
                                    <div style={{ display: 'flex', gap: '24px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #1a1a1a' }}>
                                        {[{ label: 'QUEUED', value: pendingCount, color: '#666' }, { label: 'UPLOADED', value: doneCount, color: '#4caf50' }, { label: 'TOTAL', value: queue.length, color: '#f5f2ed' }]
                                            .map(({ label, value, color }) => (
                                                <div key={label}>
                                                    <div className="font-mono" style={{ fontSize: '9px', color: '#333', letterSpacing: '0.1em', marginBottom: '2px' }}>{label}</div>
                                                    <div style={{ fontSize: '20px', fontWeight: 600, color }}>{value}</div>
                                                </div>
                                            ))}
                                    </div>
                                )}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                                    <AnimatePresence>
                                        {queue.map(item => (
                                            <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                                                transition={{ duration: 0.2 }} style={{ background: '#111', border: '1px solid #1e1e1e', overflow: 'hidden' }}>
                                                <div style={{ position: 'relative', aspectRatio: '4/3', overflow: 'hidden', background: '#080808' }}>
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={item.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                    {item.status !== 'pending' && (
                                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,10,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            {(item.status === 'compressing' || item.status === 'uploading') && (
                                                                <div style={{ textAlign: 'center' }}>
                                                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                                        style={{ width: '18px', height: '18px', border: '2px solid #333', borderTopColor: '#f5f2ed', borderRadius: '50%', margin: '0 auto 6px' }} />
                                                                    <span className="font-mono" style={{ fontSize: '8px', color: '#666', letterSpacing: '0.1em' }}>
                                                                        {item.status === 'compressing' ? 'COMPRESSING' : 'UPLOADING'}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {item.status === 'done' && <CheckCircle size={24} color="#4caf50" />}
                                                            {item.status === 'error' && (
                                                                <div style={{ textAlign: 'center', padding: '8px' }}>
                                                                    <AlertCircle size={20} color="#ff3b30" style={{ marginBottom: '4px' }} />
                                                                    <span className="font-mono" style={{ fontSize: '8px', color: '#ff3b30', letterSpacing: '0.05em' }}>{item.error?.slice(0, 30)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {item.status === 'pending' && (
                                                        <button onClick={() => setQueue(prev => prev.filter(i => i.id !== item.id))}
                                                            style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(10,10,10,0.8)', border: 'none', color: '#f5f2ed', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                                                            <X size={10} />
                                                        </button>
                                                    )}
                                                    {item.exifDate && (
                                                        <div style={{ position: 'absolute', bottom: '6px', left: '6px', background: 'rgba(10,10,10,0.85)', padding: '2px 5px' }}>
                                                            <span className="font-mono" style={{ fontSize: '8px', color: '#c9b99a', letterSpacing: '0.08em' }}>{fmtDate(item.exifDate)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ padding: '10px' }}>
                                                    <p className="font-mono" style={{ fontSize: '8px', color: '#333', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</p>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                                                        <input className="input-raw" placeholder={item.status === 'done' ? 'Add caption…' : 'After upload'} value={item.caption}
                                                            onChange={e => setQueue(prev => prev.map(i => i.id === item.id ? { ...i, caption: e.target.value, captionSaved: false } : i))}
                                                            disabled={item.status !== 'done'} style={{ flex: 1, fontSize: '11px', opacity: item.status === 'done' ? 1 : 0.3 }} />
                                                        {item.status === 'done' && (
                                                            <button onClick={() => saveCaption(item)} disabled={item.captionSaved || !item.caption.trim()}
                                                                style={{ background: 'transparent', border: 'none', color: item.captionSaved ? '#4caf50' : item.caption.trim() ? '#f5f2ed' : '#333', cursor: 'pointer', padding: '0 0 8px 0', display: 'flex' }}>
                                                                {item.captionSaved ? <CheckCircle size={12} /> : <Save size={12} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                </div>

                                {queue.length > 0 && doneCount === queue.length && (
                                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        style={{ marginTop: '28px', padding: '14px 18px', border: '1px solid #1e3320', background: '#0d1f10', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <CheckCircle size={13} color="#4caf50" />
                                        <span className="font-mono" style={{ fontSize: '10px', color: '#4caf50', letterSpacing: '0.08em' }}>
                                            ALL DONE — <button onClick={() => setTab('manage')} style={{ background: 'none', border: 'none', color: '#4caf50', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', padding: 0 }}>MANAGE ARCHIVE →</button>
                                        </span>
                                    </motion.div>
                                )}
                            </div>
                        )}

                        {/* ══ MANAGE TAB ══ */}
                        {tab === 'manage' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div>
                                        <h1 className="font-display" style={{ fontSize: '24px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>MANAGE ARCHIVE</h1>
                                        <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em' }}>EDIT CAPTIONS, DATES AND DELETE MEMORIES</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button onClick={backfillThumbnails} disabled={backfilling} className="btn-ghost" style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {backfilling && (
                                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                                    style={{ width: '10px', height: '10px', border: '1px solid #666', borderTopColor: '#f5f2ed', borderRadius: '50%' }} />
                                            )}
                                            GENERATE THUMBNAILS
                                        </button>
                                        <button onClick={loadPhotos} className="btn-ghost" style={{ fontSize: '9px' }}>REFRESH</button>
                                    </div>
                                </div>
                                {backfillStatus && (
                                    <div style={{ marginBottom: '16px', padding: '10px 14px', border: '1px solid #1e3320', background: '#0d1f10', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <CheckCircle size={12} color="#4caf50" />
                                        <span className="font-mono" style={{ fontSize: '10px', color: '#4caf50', letterSpacing: '0.08em' }}>{backfillStatus}</span>
                                        <button onClick={() => setBackfillStatus(null)} style={{ background: 'none', border: 'none', color: '#4caf50', cursor: 'pointer', marginLeft: 'auto', display: 'flex' }}>
                                            <X size={10} />
                                        </button>
                                    </div>
                                )}

                                {loadingPhotos ? (
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', paddingTop: '64px' }}>
                                        {[0, 1, 2].map(i => (
                                            <motion.div key={i} style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#2a2a2a' }}
                                                animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        {managed.map((photo, idx) => (
                                            <motion.div key={photo.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: idx * 0.03 }}
                                                style={{ border: '1px solid #1a1a1a', background: '#0e0e0e', overflow: 'hidden' }}>

                                                {/* Main row */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '0' }}>
                                                    {/* Thumb */}
                                                    <div style={{ aspectRatio: '1', overflow: 'hidden', background: '#080808', flexShrink: 0 }}>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={photo.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: photo.deleting ? 0.3 : 1 }} />
                                                    </div>

                                                    {/* Controls */}
                                                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                                                        {/* Caption row */}
                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                            <input
                                                                className="input-raw"
                                                                placeholder="Caption…"
                                                                value={photo.editCaption}
                                                                onChange={e => setManaged(prev => prev.map(p => p.id === photo.id ? { ...p, editCaption: e.target.value } : p))}
                                                                style={{ flex: 1, fontSize: '12px' }}
                                                            />
                                                            <input
                                                                className="input-raw"
                                                                type="date"
                                                                value={photo.editDate}
                                                                onChange={e => setManaged(prev => prev.map(p => p.id === photo.id ? { ...p, editDate: e.target.value } : p))}
                                                                style={{ width: '130px', fontSize: '11px', colorScheme: 'dark' }}
                                                            />
                                                            <button onClick={() => savePhoto(photo)} disabled={photo.saving} title="Save changes"
                                                                style={{ background: 'transparent', border: 'none', color: '#f5f2ed', cursor: 'pointer', padding: '4px', display: 'flex', opacity: photo.saving ? 0.5 : 1 }}>
                                                                {photo.saving
                                                                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: '13px', height: '13px', border: '1px solid #333', borderTopColor: '#f5f2ed', borderRadius: '50%' }} />
                                                                    : <Save size={13} />}
                                                            </button>
                                                            <button onClick={() => deletePhoto(photo.id)} disabled={photo.deleting} title="Delete photo"
                                                                style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: '4px', display: 'flex', opacity: photo.deleting ? 0.5 : 1 }}>
                                                                <Trash2 size={13} />
                                                            </button>
                                                            <button onClick={() => toggleComments(photo)} title="Toggle comments"
                                                                style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <MessageSquare size={12} />
                                                                {photo.commentsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Comments panel */}
                                                <AnimatePresence>
                                                    {photo.commentsOpen && (
                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.2 }} style={{ overflow: 'hidden', borderTop: '1px solid #1a1a1a' }}>
                                                            <div style={{ padding: '10px 16px 10px 96px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                                {photo.comments.length === 0 ? (
                                                                    <span className="font-mono" style={{ fontSize: '9px', color: '#333', letterSpacing: '0.1em' }}>NO COMMENTS</span>
                                                                ) : photo.comments.map(comment => (
                                                                    <div key={comment.id} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', justifyContent: 'space-between' }}>
                                                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', minWidth: 0 }}>
                                                                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#f5f2ed', flexShrink: 0 }}>{comment.author_name}</span>
                                                                            <span style={{ fontSize: '11px', color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{comment.body}</span>
                                                                        </div>
                                                                        <button onClick={() => deleteComment(photo.id, comment.id)}
                                                                            style={{ background: 'transparent', border: 'none', color: '#ff3b30', cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0, opacity: 0.6 }}
                                                                            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                                                                            onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                                                                        >
                                                                            <X size={10} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
