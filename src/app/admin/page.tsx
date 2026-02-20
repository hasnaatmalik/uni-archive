'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, CheckCircle, AlertCircle, Lock, Image as ImageIcon, X } from 'lucide-react';
import Link from 'next/link';

export default function AdminPage() {
    const [password, setPassword] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [authError, setAuthError] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [takenAt, setTakenAt] = useState('');
    const [uploading, setUploading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Quick server-side check via a test upload w/ empty file check
        // We validate on the backend. Client side just tracks state.
        if (!password.trim()) return;

        // Try a lightweight auth check
        const formData = new FormData();
        formData.append('password', password);
        formData.append('check_only', 'true');

        const res = await fetch('/api/admin/auth', { method: 'POST', body: formData });
        if (res.ok) {
            setAuthenticated(true);
            setAuthError('');
        } else {
            setAuthError('Wrong password.');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFile(f);
        setSuccess(false);
        setError('');
        const reader = new FileReader();
        reader.onloadend = () => setPreview(reader.result as string);
        reader.readAsDataURL(f);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f && f.type.startsWith('image/')) {
            setFile(f);
            setSuccess(false);
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result as string);
            reader.readAsDataURL(f);
        }
    };

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;
        setUploading(true);
        setError('');

        const formData = new FormData();
        formData.append('password', password);
        formData.append('file', file);
        formData.append('caption', caption);
        formData.append('taken_at', takenAt);

        try {
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Upload failed');
            }
            setSuccess(true);
            setFile(null);
            setPreview(null);
            setCaption('');
            setTakenAt('');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <main style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            position: 'relative',
        }}>
            {/* Back */}
            <div style={{ position: 'absolute', top: '28px', left: '28px' }}>
                <Link href="/" style={{ textDecoration: 'none' }}>
                    <span className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.12em' }}>
                        ← ARCHIVE
                    </span>
                </Link>
            </div>

            {/* Lock icon top */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ marginBottom: '32px' }}
            >
                <Lock size={16} color="#2a2a2a" />
            </motion.div>

            <AnimatePresence mode="wait">
                {!authenticated ? (
                    /* —— AUTH —— */
                    <motion.div
                        key="auth"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        style={{ width: '100%', maxWidth: '320px' }}
                    >
                        <h1 className="font-display" style={{ fontSize: '28px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>
                            ADMIN
                        </h1>
                        <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '32px' }}>
                            ENTER PASSWORD TO CONTINUE
                        </p>
                        <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <input
                                className="input-raw"
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoFocus
                            />
                            {authError && (
                                <p className="font-mono" style={{ fontSize: '10px', color: '#ff3b30', letterSpacing: '0.05em' }}>
                                    {authError}
                                </p>
                            )}
                            <button type="submit" className="btn-raw">
                                ENTER →
                            </button>
                        </form>
                    </motion.div>
                ) : (
                    /* —— UPLOAD FORM —— */
                    <motion.div
                        key="upload"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        style={{ width: '100%', maxWidth: '480px' }}
                    >
                        <h1 className="font-display" style={{ fontSize: '28px', fontWeight: 800, color: '#f5f2ed', marginBottom: '4px' }}>
                            ADD MEMORY
                        </h1>
                        <p className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', marginBottom: '32px' }}>
                            UPLOAD A PHOTO TO THE ARCHIVE
                        </p>

                        {success && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '12px 16px',
                                    border: '1px solid #1e3320',
                                    background: '#0d1f10',
                                    marginBottom: '24px',
                                }}
                            >
                                <CheckCircle size={14} color="#4caf50" />
                                <span className="font-mono" style={{ fontSize: '11px', color: '#4caf50', letterSpacing: '0.08em' }}>
                                    PHOTO ADDED TO ARCHIVE
                                </span>
                            </motion.div>
                        )}

                        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Drop zone */}
                            <div
                                onClick={() => fileRef.current?.click()}
                                onDrop={handleDrop}
                                onDragOver={(e) => e.preventDefault()}
                                style={{
                                    border: '1px dashed #2a2a2a',
                                    padding: '32px',
                                    textAlign: 'center',
                                    cursor: 'crosshair',
                                    position: 'relative',
                                    transition: 'border-color 0.2s',
                                    minHeight: '180px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#444')}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#2a2a2a')}
                            >
                                {preview ? (
                                    <div style={{ position: 'relative', width: '100%' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block' }} />
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                                            style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                background: 'rgba(10,10,10,0.8)',
                                                border: 'none',
                                                color: '#f5f2ed',
                                                cursor: 'crosshair',
                                                padding: '4px',
                                                display: 'flex',
                                            }}
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', pointerEvents: 'none' }}>
                                        <ImageIcon size={24} color="#2a2a2a" />
                                        <span className="font-mono" style={{ fontSize: '10px', color: '#333', letterSpacing: '0.1em' }}>
                                            DROP PHOTO HERE OR CLICK
                                        </span>
                                    </div>
                                )}
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            <div>
                                <label className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
                                    CAPTION
                                </label>
                                <textarea
                                    className="input-raw"
                                    placeholder="What's the story?"
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    maxLength={500}
                                    rows={3}
                                    style={{ resize: 'none' }}
                                />
                            </div>

                            <div>
                                <label className="font-mono" style={{ fontSize: '10px', color: '#444', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
                                    DATE TAKEN
                                </label>
                                <input
                                    className="input-raw"
                                    type="date"
                                    value={takenAt}
                                    onChange={(e) => setTakenAt(e.target.value)}
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>

                            {error && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <AlertCircle size={13} color="#ff3b30" />
                                    <p className="font-mono" style={{ fontSize: '10px', color: '#ff3b30' }}>{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="btn-raw"
                                disabled={!file || uploading}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                {uploading ? (
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                        style={{ width: '12px', height: '12px', border: '1px solid #000', borderTopColor: 'transparent', borderRadius: '50%' }}
                                    />
                                ) : (
                                    <>
                                        <Upload size={12} />
                                        ARCHIVE THIS MEMORY
                                    </>
                                )}
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}
