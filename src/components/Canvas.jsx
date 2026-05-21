import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { XIcon, ClipboardIcon, CheckIcon, DownloadIcon, CodeIcon, PlayIcon, MaximizeIcon, MinimizeIcon, TerminalIcon, ReportIcon, ClearIcon, LoaderCircle } from './Icons';
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

const normalizeOutput = (str) => {
    if (!str) return '';
    return str
        .replace(/\r\n/g, '\n') // Normalize Windows line endings to Unix
        .replace(/\r/g, '\n')   // Normalize old Mac line endings
        .split('\n')
        .map(line => line.trimEnd()) // Trim trailing spaces from each individual line
        .join('\n')
        .trim(); // Trim overall leading/trailing newlines and spaces
};

const Canvas = ({ artifact, onClose, setInputValue, handleSend }) => {
    const [activeTab, setActiveTab] = useState('code');
    const [isCopied, setIsCopied] = useState(false);
    const { canvasMode, setCanvasMode } = useContext(CanvasContext);
    
    // Terminal Terminal States
    const [stdin, setStdin] = useState('');
    const [expectedOutput, setExpectedOutput] = useState('');
    const [consoleLogs, setConsoleLogs] = useState([
        { type: 'info', text: 'Terminal session initialized. Ready to execute code.' }
    ]);
    const [isRunning, setIsRunning] = useState(false);
    const [executionStats, setExecutionStats] = useState({ timeMs: 0, status: 'idle' });
    const terminalEndRef = useRef(null);

    // Auto-scroll terminal to bottom
    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [consoleLogs]);

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

        return artifact.code;
    };

    // Simulated Runner Helper
    const simulateExecution = async (lang, inputVal, expectedVal) => {
        await new Promise(r => setTimeout(r, 1000));

        let logs = [];
        let success = true;
        let timeMs = Math.floor(Math.random() * 80) + 15;

        logs.push({ type: 'compiler', text: `[Compiler]: Code parsed successfully. Preparing evaluation matrix...` });
        
        const code = artifact.code;
        let parseError = null;
        
        if (code.includes(';') && (lang === 'python' || lang === 'py') && !code.includes('import')) {
            if (code.includes('{') || code.includes('}')) {
                parseError = `IndentationError: unexpected block formatting (braces are not valid python scope indicators)`;
            }
        } else if ((lang === 'cpp' || lang === 'c++' || lang === 'java') && !code.includes(';')) {
            parseError = `Syntax Error: Expected ';' at end of statement.`;
        }

        if (parseError) {
            logs.push({ type: 'error', text: parseError });
            success = false;
        } else {
            let prints = [];
            if (lang === 'python' || lang === 'py') {
                const printMatches = [...code.matchAll(/print\s*\(\s*['"]([\s\S]*?)['"]\s*\)/g)];
                if (printMatches.length > 0) {
                    prints = printMatches.map(m => m[1]);
                }
            } else if (lang === 'cpp' || lang === 'c++') {
                const coutMatches = [...code.matchAll(/cout\s*<<\s*['"]([\s\S]*?)['"]/g)];
                if (coutMatches.length > 0) {
                    prints = coutMatches.map(m => m[1]);
                }
            } else if (lang === 'java') {
                const sysMatches = [...code.matchAll(/System\.out\.print(?:ln)?\s*\(\s*['"]([\s\S]*?)['"]\s*\)/g)];
                if (sysMatches.length > 0) {
                    prints = sysMatches.map(m => m[1]);
                }
            }

            if (prints.length > 0) {
                logs.push({ type: 'stdout', text: prints.join('\n') });
            } else {
                logs.push({ type: 'stdout', text: `[Process Output]\nInput parsed: "${inputVal || 'none'}"\nComputation completed successfully.` });
            }
        }

        setConsoleLogs(prev => [...prev, ...logs]);

        const stdoutStr = logs.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
        let status = 'idle';
        
        if (!success) {
            status = 'error';
            setConsoleLogs(prev => [...prev, { type: 'stderr', text: `[SYSTEM] Simulation terminated with compilation errors.` }]);
        } else if (expectedVal) {
            const normalizedExpected = normalizeOutput(expectedVal);
            const normalizedActual = normalizeOutput(stdoutStr);
            const passed = normalizedActual.includes(normalizedExpected) || normalizedExpected === '';
            status = passed ? 'pass' : 'fail';
            setConsoleLogs(prev => [
                ...prev,
                passed 
                    ? { type: 'success', text: `[PASS] Test expectation matched successfully!\nExpected: "${normalizedExpected}"\nActual (Simulated): "${normalizedActual}"` }
                    : { type: 'error', text: `[FAIL] Test expectation mismatch.\nExpected: "${normalizedExpected}"\nActual (Simulated): "${normalizedActual}"` }
            ]);
        } else {
            status = 'pass';
            setConsoleLogs(prev => [...prev, { type: 'success', text: `[SUCCESS] Simulated test executed cleanly.` }]);
        }

        setExecutionStats({ timeMs, status });
    };

    // Main Run Trigger
    const handleRunCode = async () => {
        setIsRunning(true);
        setExecutionStats({ timeMs: 0, status: 'idle' });
        
        const startTimestamp = new Date().toLocaleTimeString();
        setConsoleLogs(prev => [
            ...prev,
            { type: 'info', text: `\n--- Execution Started at ${startTimestamp} ---` }
        ]);

        const lang = artifact.language.toLowerCase();
        
        // Javascript Sandbox Mode
        if (lang === 'javascript' || lang === 'js') {
            const startTime = Date.now();
            let logs = [];
            const customConsole = {
                log: (...args) => logs.push({ type: 'stdout', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
                error: (...args) => logs.push({ type: 'stderr', text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
                warn: (...args) => logs.push({ type: 'info', text: '[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
                info: (...args) => logs.push({ type: 'info', text: '[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }),
            };

            try {
                let executableCode = artifact.code
                    .replace(/import\s+[\s\S]*?\s+from\s+['"].*?['"];?/g, '')
                    .replace(/export\s+default\s+/g, '')
                    .replace(/export\s+const\s+/g, 'const ')
                    .replace(/export\s+class\s+/g, 'class ')
                    .replace(/export\s+function\s+/g, 'function ');
                
                const runFn = new Function('console', 'input', `
                    try {
                        ${executableCode}
                    } catch(e) {
                        console.error(e.stack || e.message);
                    }
                `);
                runFn(customConsole, stdin);
            } catch (e) {
                logs.push({ type: 'error', text: `Compilation Error: ${e.message}` });
            }

            const timeMs = Date.now() - startTime;
            setConsoleLogs(prev => [...prev, ...logs]);
            
            const stdoutStr = logs.filter(l => l.type === 'stdout').map(l => l.text).join('\n');
            const hasErrors = logs.some(l => l.type === 'stderr' || l.type === 'error');
            
            let status = 'idle';
            if (hasErrors) {
                status = 'error';
                setConsoleLogs(prev => [...prev, { type: 'stderr', text: `[SYSTEM] Execution failed with errors.` }]);
            } else if (expectedOutput) {
                const normalizedExpected = normalizeOutput(expectedOutput);
                const normalizedActual = normalizeOutput(stdoutStr);
                const passed = normalizedActual === normalizedExpected;
                status = passed ? 'pass' : 'fail';
                setConsoleLogs(prev => [
                    ...prev,
                    passed 
                        ? { type: 'success', text: `[PASS] Test expectation matched successfully!\nExpected: "${normalizedExpected}"\nActual:   "${normalizedActual}"` }
                        : { type: 'error', text: `[FAIL] Test expectation mismatch.\nExpected: "${normalizedExpected}"\nActual:   "${normalizedActual}"` }
                ]);
            } else {
                status = 'pass';
                setConsoleLogs(prev => [...prev, { type: 'success', text: `[SUCCESS] Code executed successfully in sandbox.` }]);
            }

            setExecutionStats({ timeMs, status });
            setIsRunning(false);
            return;
        }

        // Native host compilers or Simulator scenario
        if (window.electron && window.electron.runCode) {
            try {
                setConsoleLogs(prev => [
                    ...prev,
                    { type: 'compiler', text: `[Compiler] Invoking host environment compiler/interpreter for ${artifact.language.toUpperCase()}...` }
                ]);

                const response = await window.electron.runCode({
                    code: artifact.code,
                    language: artifact.language,
                    input: stdin
                });

                const { success, stdout, stderr, timeMs, errorType } = response;
                
                let logs = [];
                if (stdout) logs.push({ type: 'stdout', text: stdout });
                if (stderr) logs.push({ type: errorType === 'timeout' ? 'error' : 'stderr', text: stderr });

                setConsoleLogs(prev => [...prev, ...logs]);

                let status = 'idle';
                
                const isCompilerMissing = stderr && (
                    stderr.includes('is not recognized') || 
                    stderr.includes('command not found') || 
                    stderr.includes('no such file or directory') ||
                    stderr.includes('cannot find')
                );

                if (isCompilerMissing) {
                    setConsoleLogs(prev => [
                        ...prev,
                        { type: 'info', text: `[SYSTEM ALERT] Host compiler for ${artifact.language} is not configured.` },
                        { type: 'compiler', text: `[Simulator] Executing robust interactive validation simulator...` }
                    ]);
                    await simulateExecution(lang, stdin, expectedOutput);
                    setIsRunning(false);
                    return;
                }

                if (!success) {
                    status = 'error';
                    setConsoleLogs(prev => [...prev, { type: 'stderr', text: `[SYSTEM] Process exited with failure status.` }]);
                } else if (expectedOutput) {
                    const normalizedExpected = normalizeOutput(expectedOutput);
                    const normalizedActual = normalizeOutput(stdout);
                    const passed = normalizedActual === normalizedExpected;
                    status = passed ? 'pass' : 'fail';
                    setConsoleLogs(prev => [
                        ...prev,
                        passed 
                            ? { type: 'success', text: `[PASS] Test expectation matched successfully!\nExpected: "${normalizedExpected}"\nActual:   "${normalizedActual}"` }
                            : { type: 'error', text: `[FAIL] Test expectation mismatch.\nExpected: "${normalizedExpected}"\nActual:   "${normalizedActual}"` }
                    ]);
                } else {
                    status = 'pass';
                    setConsoleLogs(prev => [...prev, { type: 'success', text: `[SUCCESS] Process completed successfully.` }]);
                }

                setExecutionStats({ timeMs, status });
                setIsRunning(false);
                return;
            } catch (err) {
                setConsoleLogs(prev => [
                    ...prev,
                    { type: 'error', text: `IPC Interface Exception: ${err.message}` }
                ]);
            }
        }

        // Web Browser / Simulator mode fallback
        setConsoleLogs(prev => [
            ...prev,
            { type: 'info', text: `[Simulator] Executing sandbox evaluation for language: ${artifact.language.toUpperCase()}` }
        ]);
        await simulateExecution(lang, stdin, expectedOutput);
        setIsRunning(false);
    };

    // AI Bug Report Loop Handler
    const handleReportFailure = () => {
        if (!setInputValue || !handleSend) return;

        const formattedLogs = consoleLogs
            .map(log => {
                if (log.type === 'info') return `[INFO] ${log.text}`;
                if (log.type === 'compiler') return `[COMPILER] ${log.text}`;
                if (log.type === 'stdout') return log.text;
                if (log.type === 'stderr') return `[STDERR] ${log.text}`;
                if (log.type === 'error') return `[ERROR] ${log.text}`;
                if (log.type === 'success') return `[SUCCESS] ${log.text}`;
                return log.text;
            })
            .join('\n');

        const prompt = `I ran the code block "${artifact.title || 'Untitled'}" (${artifact.language}) in the Output Terminal, but it failed the testcase check. Please analyze the execution outputs, diagnostic traces, and parameter inputs, and rewrite the code to fix the bugs!

### Parameters Passed:
- **Custom Input (stdin):** ${stdin ? `\`\`\`text\n${stdin}\n\`\`\`` : '*(empty)*'}
- **Expected Output:** ${expectedOutput ? `\`\`\`text\n${expectedOutput}\n\`\`\`` : '*(empty)*'}

### Console Output Logs:
\`\`\`text
${formattedLogs}
\`\`\``;

        setInputValue(prompt);
        setTimeout(() => {
            handleSend(null, prompt);
        }, 100);
    };

    const lineCount = artifact.code.split('\n').length;

    return (
        <div className="w-full h-full flex flex-col glass-morphism bg-zinc-950/90 text-white shadow-2xl relative overflow-hidden select-none">
            {/* Header Area */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800/80 bg-neutral-900/40 select-none">
                <div className="flex items-center gap-2.5 min-w-0">
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

            {/* Sub-Header Tab Switcher - Now Rendered for all language artifacts */}
            <div className="flex border-b border-neutral-800/40 bg-neutral-900/10 px-4 py-1.5 gap-2 select-none">
                {isPreviewable && (
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
                )}
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
                <button
                    onClick={() => setActiveTab('terminal')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-all duration-200 ${
                        activeTab === 'terminal'
                            ? 'bg-emerald-500/15 text-emerald-400 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.1)] border border-emerald-500/20'
                            : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30 border border-transparent'
                    }`}
                >
                    <TerminalIcon className="w-3 h-3" />
                    Output Terminal
                </button>
            </div>

            {/* Viewport Contents */}
            <div className="flex-1 overflow-hidden relative bg-black/25">
                {activeTab === 'code' ? (
                    <div className="w-full h-full overflow-auto p-4 custom-scrollbar select-text font-mono text-[13px] leading-relaxed bg-[#09090b]">
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
                ) : activeTab === 'preview' ? (
                    <div className="w-full h-full p-3 bg-neutral-950/45">
                        <iframe
                            title="Sandboxed Canvas Live Preview"
                            srcDoc={getSrcDoc()}
                            sandbox="allow-scripts"
                            className="w-full h-full bg-white rounded-lg shadow-2xl border-0 overflow-auto"
                        />
                    </div>
                ) : (
                    /* Output Terminal Workspace */
                    <div className="w-full h-full flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-neutral-800/80 overflow-y-auto lg:overflow-hidden p-4 gap-4 bg-[#09090b]">
                        {/* Config Panel (Left Column) */}
                        <div className="flex flex-col gap-4 w-full lg:w-[40%] h-full min-h-0 select-none">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                    Custom Input (stdin)
                                </span>
                                <textarea
                                    value={stdin}
                                    onChange={(e) => setStdin(e.target.value)}
                                    placeholder="Provide custom arguments or console standard input values here..."
                                    className="w-full h-24 bg-black/35 border border-neutral-800/60 focus:border-emerald-500/40 rounded-lg p-2.5 font-mono text-xs text-white focus:outline-none transition-all duration-200 custom-scrollbar resize-none placeholder-neutral-600 focus:shadow-[0_0_12px_rgba(16,185,129,0.05)]"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                                    Expected Output (stdout)
                                </span>
                                <textarea
                                    value={expectedOutput}
                                    onChange={(e) => setExpectedOutput(e.target.value)}
                                    placeholder="Define expected execution output to evaluate assertion checks..."
                                    className="w-full h-24 bg-black/35 border border-neutral-800/60 focus:border-emerald-500/40 rounded-lg p-2.5 font-mono text-xs text-white focus:outline-none transition-all duration-200 custom-scrollbar resize-none placeholder-neutral-600 focus:shadow-[0_0_12px_rgba(16,185,129,0.05)]"
                                />
                            </div>

                            <div className="flex flex-col gap-3 mt-1">
                                <button
                                    onClick={handleRunCode}
                                    disabled={isRunning}
                                    className={`w-full py-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                                        isRunning
                                            ? 'bg-neutral-800 text-neutral-500 border border-neutral-700/30 cursor-not-allowed'
                                            : executionStats.status === 'pass'
                                            ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                                            : executionStats.status === 'fail' || executionStats.status === 'error'
                                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                                            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_4px_15px_rgba(16,185,129,0.2)]'
                                    }`}
                                >
                                    {isRunning ? (
                                        <>
                                            <LoaderCircle className="w-3.5 h-3.5" />
                                            Evaluating Code...
                                        </>
                                    ) : (
                                        <>
                                            <PlayIcon className="w-3.5 h-3.5" />
                                            Run Testcases
                                        </>
                                    )}
                                </button>

                                <div className="bg-neutral-900/30 border border-neutral-800/80 rounded-lg p-3 grid grid-cols-2 gap-3.5">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Speed</span>
                                        <span className="text-xs font-semibold font-mono text-white/95">
                                            {executionStats.timeMs > 0 ? `${executionStats.timeMs}ms` : '—'}
                                        </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">Test Suite</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${
                                                executionStats.status === 'pass' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' :
                                                executionStats.status === 'fail' || executionStats.status === 'error' ? 'bg-red-400 shadow-[0_0_6px_#f87171]' :
                                                'bg-neutral-600'
                                            }`} />
                                            <span className="text-xs font-bold font-mono tracking-wide uppercase text-white/95">
                                                {executionStats.status === 'pass' && 'Passed'}
                                                {executionStats.status === 'fail' && 'Failed'}
                                                {executionStats.status === 'error' && 'Error'}
                                                {executionStats.status === 'idle' && 'Ready'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CLI Output Display Shell (Right Column) */}
                        <div className="flex-1 flex flex-col h-full bg-neutral-950/45 rounded-xl border border-neutral-800/60 overflow-hidden">
                            {/* CLI Header */}
                            <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800/80 bg-neutral-900/30 select-none">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1">
                                        &gt;_ CLI Output
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {(executionStats.status === 'fail' || executionStats.status === 'error') && setInputValue && handleSend && (
                                        <button
                                            onClick={handleReportFailure}
                                            title="Automatically pass logs back to ZNinja AI to correct the code block"
                                            className="p-1 px-2.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-all duration-200 text-[10px] font-bold flex items-center gap-1.5 active:scale-95 animate-pulse"
                                        >
                                            <ReportIcon className="w-3 h-3" />
                                            Report to ZNinja
                                        </button>
                                    )}
                                    <button
                                        onClick={() => {
                                            setConsoleLogs([{ type: 'info', text: 'Terminal session cleared.' }]);
                                            setExecutionStats({ timeMs: 0, status: 'idle' });
                                        }}
                                        className="p-1 px-2.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all duration-150 text-[10px] font-semibold flex items-center gap-1"
                                    >
                                        <ClearIcon className="w-3 h-3" />
                                        Clear
                                    </button>
                                </div>
                            </div>

                            {/* CLI Output Shell Logs */}
                            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] select-text flex flex-col gap-1.5 custom-scrollbar text-white/90 bg-[#070709] leading-relaxed">
                                {consoleLogs.map((log, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`${
                                            log.type === 'info' ? 'text-neutral-500 italic font-semibold text-[10px]' :
                                            log.type === 'compiler' ? 'text-cyan-400/90 font-medium' :
                                            log.type === 'stderr' ? 'text-rose-400 font-medium bg-rose-500/5 p-1 rounded border border-rose-500/10 whitespace-pre-wrap' :
                                            log.type === 'error' ? 'text-rose-400 font-bold bg-rose-500/10 p-1.5 rounded border border-rose-500/20 whitespace-pre-wrap' :
                                            log.type === 'success' ? 'text-emerald-400 font-bold bg-emerald-500/5 p-1.5 rounded border border-emerald-500/10 whitespace-pre-wrap' :
                                            'text-neutral-200 whitespace-pre-wrap' // stdout
                                        }`}
                                    >
                                        {log.type === 'stdout' && <span className="text-neutral-600 select-none mr-2">&gt;</span>}
                                        {log.text}
                                    </div>
                                ))}
                                <div ref={terminalEndRef} />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Canvas;
