import React, { useState, useEffect, useMemo, useContext } from 'react';
import { XIcon, ClipboardIcon, CheckIcon, DownloadIcon, CodeIcon, PlayIcon, MaximizeIcon, MinimizeIcon } from './Icons';
import { CanvasContext } from './CanvasContext';

const SyntaxHighlighter = React.lazy(() =>
    import('./SyntaxHighlighterWrapper').then(module => ({
        default: (props) => (
            <module.SyntaxHighlighter
                style={module.vscDarkPlus}
                {...props}
            />
        )
    }))
);

const Canvas = ({ artifact, onClose }) => {
    const [activeTab, setActiveTab] = useState('code');
    const [isCopied, setIsCopied] = useState(false);
    const { canvasMode, setCanvasMode } = useContext(CanvasContext);

    // Auto-select preview tab for previewable content when newly opened
    const isPreviewable = useMemo(() => {
        if (!artifact) return false;
        const lang = artifact.language.toLowerCase();
        return ['html', 'svg', 'xml', 'css'].includes(lang) || 
               (lang === 'javascript' && artifact.code.includes('document.'));
    }, [artifact]);

    useEffect(() => {
        if (isPreviewable) {
            setActiveTab('preview');
        } else {
            setActiveTab('code');
        }
    }, [artifact, isPreviewable]);

    if (!artifact) return null;

    const handleCopy = () => {
        navigator.clipboard.writeText(artifact.code);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleDownload = () => {
        const blob = new Blob([artifact.code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Formulate a beautiful filename
        let ext = artifact.language;
        if (ext === 'javascript') ext = 'js';
        if (ext === 'typescript') ext = 'ts';
        if (ext === 'markup') ext = 'html';
        
        const safeTitle = (artifact.title || 'code')
            .toLowerCase()
            .replace(/[^a-z0-9_.-]/g, '_');
        
        a.download = safeTitle.includes('.') ? safeTitle : `${safeTitle}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getSrcDoc = () => {
        const lang = artifact.language.toLowerCase();
        if (lang === 'svg') {
            return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: #121214;
            color: #ffffff;
            overflow: hidden;
            font-family: system-ui, sans-serif;
        }
        svg {
            max-width: 90%;
            max-height: 90vh;
            filter: drop-shadow(0 10px 20px rgba(0,0,0,0.3));
        }
    </style>
</head>
<body>
    ${artifact.code}
</body>
</html>`;
        }
        
        if (lang === 'css') {
            return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 2rem;
            background: #121214;
            color: #ffffff;
            font-family: system-ui, sans-serif;
        }
        ${artifact.code}
    </style>
</head>
<body>
    <div style="border: 1px solid rgba(255,255,255,0.1); padding: 2rem; border-radius: 8px; background: rgba(255,255,255,0.02);">
        <h1 style="margin-top: 0; color: #10b981;">CSS Playground Live Render</h1>
        <p>Your custom stylesheet has been loaded into this sandboxed workspace.</p>
        <button style="padding: 0.5rem 1rem; border-radius: 4px; border: none; font-weight: bold; cursor: pointer;">Test Active Button</button>
    </div>
</body>
</html>`;
        }

        // HTML & JavaScript
        return artifact.code;
    };

    // Calculate line counts
    const lineCount = artifact.code.split('\n').length;

    return (
        <div className="w-full h-full flex flex-col glass-morphism bg-zinc-950/90 text-white shadow-2xl relative overflow-hidden select-none">
            {/* Header Area */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/40 select-none">
                <div className="flex items-center gap-2.5 min-w-0">
                    {/* Badge */}
                    {/* <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CodeIcon className="w-4.5 h-4.5" />
                    </div> */}
                    
                    <div className="min-w-0">
                        <div className="text-xs font-semibold text-white/90 truncate tracking-wide max-w-[200px]" title={artifact.title}>
                            {artifact.title || 'Untitled Code'}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono tracking-wider">
                            {artifact.language.toUpperCase()} &bull; {lineCount} lines
                        </div>
                    </div>
                </div>

                {/* Toolbar controls */}
                <div className="flex items-center gap-1.5 no-drag">
                    <button 
                        onClick={handleCopy}
                        title="Copy code"
                        className="p-1.5 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/80 text-neutral-400 hover:text-white transition-all duration-200 active:scale-95 border border-neutral-700/30"
                    >
                        {isCopied ? <CheckIcon /> : <ClipboardIcon />}
                    </button>
                    <button 
                        onClick={handleDownload}
                        title="Download file"
                        className="p-1.5 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/80 text-neutral-400 hover:text-white transition-all duration-200 active:scale-95 border border-neutral-700/30"
                    >
                        <DownloadIcon />
                    </button>
                    <button 
                        onClick={() => setCanvasMode(prev => prev === 'cover' ? 'split' : 'cover')}
                        title={canvasMode === 'cover' ? "Show side-by-side" : "Show full screen"}
                        className="p-1.5 rounded-lg bg-neutral-800/50 hover:bg-neutral-700/80 text-neutral-400 hover:text-white transition-all duration-200 active:scale-95 border border-neutral-700/30"
                    >
                        {canvasMode === 'cover' ? <MinimizeIcon /> : <MaximizeIcon />}
                    </button>
                    <button 
                        onClick={onClose}
                        title="Close Canvas"
                        className="ml-1 p-1.5 rounded-lg bg-neutral-800/50 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 transition-all duration-200 active:scale-95 border border-neutral-700/30"
                    >
                        <XIcon />
                    </button>
                </div>
            </div>

            {/* Sub-Header Tab Switcher */}
            {isPreviewable && (
                <div className="flex border-b border-neutral-800/40 bg-neutral-900/10 px-4 py-1.5 gap-2 select-none">
                    <button
                        onClick={() => setActiveTab('preview')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-all duration-200 ${
                            activeTab === 'preview'
                                ? 'bg-emerald-500/15 text-emerald-400 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)] border border-emerald-500/20'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30 border border-transparent'
                        }`}
                    >
                        <PlayIcon className="w-3 h-3" />
                        Live Preview
                    </button>
                    <button
                        onClick={() => setActiveTab('code')}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-all duration-200 ${
                            activeTab === 'code'
                                ? 'bg-emerald-500/15 text-emerald-400 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)] border border-emerald-500/20'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30 border border-transparent'
                        }`}
                    >
                        <CodeIcon className="w-3 h-3" />
                        Source Code
                    </button>
                </div>
            )}

            {/* Viewport Contents */}
            <div className="flex-1 overflow-hidden relative bg-black/25">
                {activeTab === 'code' ? (
                    <div className="w-full h-full overflow-auto p-4 custom-scrollbar select-text font-mono text-[13px] leading-relaxed">
                        <React.Suspense fallback={
                            <div className="w-full h-full flex items-center justify-center text-xs text-neutral-500 italic animate-pulse">
                                Illuminating workspace...
                            </div>
                        }>
                            <SyntaxHighlighter
                                language={artifact.language}
                                PreTag="div"
                                showLineNumbers={true}
                                lineNumberStyle={{ color: 'rgba(255,255,255,0.15)', minWidth: '2.5em', textAlign: 'right', paddingRight: '1.25em', selectNone: 'true' }}
                                wrapLongLines={false}
                                codeTagProps={{
                                    style: {
                                        whiteSpace: 'pre',
                                        display: 'inline-block',
                                        minWidth: '100%'
                                    }
                                }}
                                customStyle={{ 
                                    backgroundColor: 'transparent', 
                                    margin: 0, 
                                    padding: 0,
                                    borderRadius: 0,
                                    width: '100%',
                                    display: 'grid',
                                    whiteSpace: 'pre',
                                    fontSize: '0.825rem'
                                }}
                            >
                                {artifact.code}
                            </SyntaxHighlighter>
                        </React.Suspense>
                    </div>
                ) : (
                    <div className="w-full h-full p-3 bg-neutral-950/45">
                        <iframe
                            title="Sandboxed Canvas Live Preview"
                            srcDoc={getSrcDoc()}
                            sandbox="allow-scripts"
                            className="w-full h-full bg-white rounded-lg shadow-2xl border-0 overflow-auto"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default Canvas;
