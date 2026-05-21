import React, { useRef, memo, useMemo, useState } from 'react'; // Added memo, useState
import 'katex/dist/katex.min.css';

const LazyMarkdown = React.lazy(() => import('react-markdown'));
const remarkGfm = import('remark-gfm');
const remarkMath = import('remark-math');
const rehypeKatex = import('rehype-katex');

import CodeBlock from './CodeBlock';
import ResizeHandle from './ResizeHandle';
import { LOADER_FRAMES } from '../constants';
import { DotLoader } from './ui/dot-loader';
import { PromptInputBox } from './ui/ai-prompt-box';
function cleanResearchSteps(text) {
    if (!text || typeof text !== 'string') return text;
    const regex = /^(?:\*\s*\*|)\s*\[Step\s*\d+\]\s*(?:Initializing deep research interaction|Research agent is scanning sources and analyzing data)[\s\S]*?(?:\*(?:\n|$)|(?:\n|$))/gm;
    return text.replace(regex, '').trim();
}

// Markdown components definition - Memoized outside component or useMemo
const MARKDOWN_COMPONENTS = {
    code: CodeBlock,
    p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
    ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
    li: ({children}) => <li>{children}</li>,
    h1: ({children}) => <h1 className="text-xl font-bold mb-2 mt-4 border-b border-neutral-600 pb-1">{children}</h1>,
    h2: ({children}) => <h2 className="text-lg font-bold mb-2 mt-3">{children}</h2>,
    h3: ({children}) => <h3 className="text-md font-bold mb-2 mt-2">{children}</h3>,
    blockquote: ({children}) => <blockquote className="border-l-4 border-neutral-500 pl-3 italic mb-2 text-neutral-300">{children}</blockquote>,
    a: ({href, children}) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>,
    table: ({children}) => <div className="overflow-x-auto mb-3"><table className="min-w-full divide-y divide-neutral-700 text-sm">{children}</table></div>,
    thead: ({children}) => <thead className="bg-neutral-800">{children}</thead>,
    tbody: ({children}) => <tbody className="divide-y divide-neutral-700">{children}</tbody>,
    tr: ({children}) => <tr>{children}</tr>,
    th: ({children}) => <th className="px-3 py-2 text-left text-xs font-medium text-neutral-300 uppercase tracking-wider border-b border-neutral-600">{children}</th>,
    td: ({children}) => <td className="px-3 py-2 whitespace-nowrap text-neutral-300">{children}</td>,
};

// Extracted MessageItem
const MessageItem = memo(({ msg }) => {
    // Resolve plugins as they are promises in this lazy setup
    const [plugins, setPlugins] = React.useState({ remark: [], rehype: [] });

    React.useEffect(() => {
        Promise.all([remarkGfm, remarkMath, rehypeKatex]).then(([gfm, math, katex]) => {
            setPlugins({
                remark: [gfm.default, math.default],
                rehype: [katex.default]
            });
        });
    }, []);

    return (
        <div className={`text-sm flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-3 py-2 rounded-lg max-w-[90%] min-w-0 break-words overflow-hidden ${
                msg.role === 'user' 
                ? 'bg-emerald-500/30' 
                : (msg.isStreaming && !msg.text) ? 'bg-transparent' : 'bg-zinc-800/50'
            }`}>
                {msg.images && msg.images.map((img, i) => (
                    <img key={i} src={img} alt={`Attachment ${i}`} className="max-w-xs max-h-48 rounded mb-2 border border-neutral-600/50 block" />
                ))}
                {msg.image && !msg.images && (
                    <img src={msg.image} alt="Attachment" className="max-w-xs max-h-48 rounded mb-2 border border-neutral-600/50 block" />
                )}
                {msg.role === 'ai' ? (
                    <React.Suspense fallback={<div className="animate-pulse text-xs text-neutral-500 italic">Processing response...</div>}>
                        {msg.isStreaming && !msg.text ? (
                            <div className="flex items-center gap-2 py-1">
                                <DotLoader 
                                    frames={LOADER_FRAMES} 
                                    className="gap-0.5" 
                                    duration={200}
                                    dotClassName="bg-white/40 [&.active]:bg-white "
                                />
                                <span className="text-sm text-white  animate-pulse">Thinking...</span>
                            </div>
                        ) : (
                            <div className="relative">
                                <LazyMarkdown 
                                    remarkPlugins={plugins.remark}
                                    rehypePlugins={plugins.rehype}
                                    components={MARKDOWN_COMPONENTS}
                                >
                                    {msg.isStreaming ? msg.text : cleanResearchSteps(msg.text)}
                                </LazyMarkdown>
                                {msg.isStreaming && (
                                    <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse align-middle"></span>
                                )}
                            </div>
                        )}
                    </React.Suspense>
                ) : (
                    <span>{msg.text}</span>
                )}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom comparison to ensure strict equality check isn't missed on deep objects if needed
    // But usually shallow comparison of 'msg' object is fine if immutable updates are used
    return prevProps.msg === nextProps.msg; 
});

// Extracted MessageList
const MessageList = memo(({ messages }) => {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pt-12">
            {messages.map((msg, idx) => (
                <MessageItem key={idx} msg={msg} />
            ))}
        </div>
    );
});

const ChatInterface = ({
    messages,
    setMessages,
    inputValue,
    setInputValue,
    attachments,
    setAttachments,
    handleSend,
    handleCapture,
    handleSendAudio,
    inputRef,
    selectedModel,
    workingMode,
    setWorkingMode,
    isCapturing
}) => {
    return (
        <div className="flex-1 flex flex-col w-full relative overflow-hidden min-h-0">
            {/* Memoized Message List */}
            <MessageList messages={messages} />

            <div className="w-full p-3 relative py-2 bg-neutral-800/20 flex flex-col gap-2">
                <PromptInputBox
                    inputRef={inputRef}
                    value={inputValue}
                    onValueChange={setInputValue}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    onSend={(formattedInput) => handleSend(null, formattedInput)}
                    isLoading={messages.length > 0 && messages[messages.length - 1].isStreaming}
                    placeholder="Ask ZNinja..."
                    workingMode={workingMode}
                    setWorkingMode={setWorkingMode}
                    handleSendAudio={handleSendAudio}
                    handleCapture={handleCapture}
                    isCapturing={isCapturing}
                />
                
                <span className="text-xs w-full flex justify-center items-center text-neutral-500 select-none">
                    powered by CInfinite, developed by <a href="https://github.com/gajju44" target="_blank" rel="noopener noreferrer" className="hover:text-neutral-300 transition-colors">&nbsp;gajju44</a>
                </span>

                <button
                    id="instant-ai-trigger"
                    type="button"
                    className="hidden"
                    onClick={async () => {
                        if (!window.electron) return;
                        const result = await window.electron.captureScreen();
                        if (result.success) {
                            // Directly trigger Gemini with the captured image and current input
                            if (window.electron && window.electron.streamGemini) {
                                const userPrompt = inputValue || "give answer";
                                setMessages(prev => [...prev, { role: 'user', text: userPrompt, images: [result.image] }]);
                                setInputValue('');
                                setMessages(prev => [...prev, { role: 'ai', text: '', isStreaming: true }]);
                                
                                // Context-aware Instant AI
                                const history = messages
                                    .filter(m => !m.isTemp && !m.isStreaming && m.role !== 'system')
                                    .map(m => ({
                                        role: m.role === 'ai' ? 'model' : 'user',
                                        parts: [{ text: m.text }]
                                    }));

                                window.electron.streamGemini({ 
                                    prompt: userPrompt, 
                                    modelName: selectedModel, 
                                    images: [result.image],
                                    history: history,
                                    workingMode: workingMode
                                });
                            }
                        }
                    }}
                />
            </div>
            <ResizeHandle />
        </div>
    );
};

export default ChatInterface;
