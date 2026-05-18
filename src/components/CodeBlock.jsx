import React, { useState } from 'react';
import { CheckIcon, ClipboardIcon } from './Icons';

// Lazy-load our lightweight PrismLight wrapper instead of the full Prism bundle.
// This keeps the initial JS parse budget tiny — the highlighter only downloads
// when the first code block is rendered.
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

const CodeBlock = ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const [isCopied, setIsCopied] = useState(false);
  
    const handleCopy = () => {
      navigator.clipboard.writeText(String(children));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    };
  
    if (inline) {
        return (
            <code className={`${className} bg-black/60 rounded px-1 py-0.5 font-mono text-xs`} {...props}>
                {children}
            </code>
        );
    }

    return (
      <div className="relative group w-full">
        <button 
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-700/50 hover:bg-neutral-600 text-neutral-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
        >
          {isCopied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
        <React.Suspense fallback={<pre className="bg-black/50 p-4 rounded-lg animate-pulse text-xs text-neutral-500">Loading highlighter...</pre>}>
            <SyntaxHighlighter
              language={match ? match[1] : 'text'}
              PreTag="div"
              wrapLongLines={true}
              codeTagProps={{
                style: {
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  display: 'inline-block'
                }
              }}
              customStyle={{ 
                backgroundColor: 'rgba(0, 0, 0, 0.5)', 
                margin: 0, 
                borderRadius: '0.5rem',
                width: '100%',
                maxWidth: '100%',
                display: 'grid',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                overflowX: 'auto',
                fontSize: '0.85rem'
              }}
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        </React.Suspense>
      </div>
    );
};

export default CodeBlock;
