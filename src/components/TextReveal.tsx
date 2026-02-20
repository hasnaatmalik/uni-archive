'use client';

import { useEffect, useRef } from 'react';

interface TextRevealProps {
    text: string;
    className?: string;
    delay?: number;
    tag?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

export default function TextReveal({ text, className = '', delay = 0, tag: Tag = 'h1' }: TextRevealProps) {
    const ref = useRef<HTMLElement>(null);

    useEffect(() => {
        const init = async () => {
            const animeModule = await import('animejs');
            // animejs v4 exports differently — handle both CJS default and named export
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anime: any = (animeModule as any).default ?? animeModule;

            if (!ref.current) return;

            const chars = ref.current.querySelectorAll('.char-inner');
            anime({
                targets: chars,
                translateY: ['100%', '0%'],
                opacity: [0, 1],
                duration: 700,
                delay: anime.stagger ? anime.stagger(35, { start: delay }) : (_: unknown, i: number) => delay + i * 35,
                easing: 'cubicBezier(0.16, 1, 0.3, 1)',
            });
        };

        init();
    }, [delay, text]);

    return (
        // @ts-expect-error – generic tag ref typing
        <Tag ref={ref} className={className} style={{ overflow: 'hidden', display: 'inline-block' }}>
            {text.split('').map((char, i) => (
                <span
                    key={i}
                    style={{ display: 'inline-block', overflow: 'hidden', lineHeight: 1.1 }}
                >
                    <span
                        className="char-inner"
                        style={{ display: 'inline-block', opacity: 0, transform: 'translateY(100%)', whiteSpace: char === ' ' ? 'pre' : 'normal' }}
                    >
                        {char === ' ' ? '\u00A0' : char}
                    </span>
                </span>
            ))}
        </Tag>
    );
}
