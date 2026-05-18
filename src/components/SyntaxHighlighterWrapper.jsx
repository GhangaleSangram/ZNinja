/**
 * SyntaxHighlighterWrapper.jsx
 *
 * Lightweight alternative to the full react-syntax-highlighter bundle.
 * Uses PrismLight, which starts with zero languages and only loads what
 * we explicitly register — eliminating ~140 unused language chunks from
 * the production build.
 *
 * Languages covered: the most common ones found in AI-generated code responses.
 */
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ─── Language registrations ───────────────────────────────────────────────────
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import jsx       from 'react-syntax-highlighter/dist/esm/languages/prism/jsx';
import tsx       from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import python    from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import rust      from 'react-syntax-highlighter/dist/esm/languages/prism/rust';
import go        from 'react-syntax-highlighter/dist/esm/languages/prism/go';
import java      from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import c         from 'react-syntax-highlighter/dist/esm/languages/prism/c';
import cpp       from 'react-syntax-highlighter/dist/esm/languages/prism/cpp';
import csharp    from 'react-syntax-highlighter/dist/esm/languages/prism/csharp';
import markup    from 'react-syntax-highlighter/dist/esm/languages/prism/markup'; // html/xml
import css       from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import json      from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import sql       from 'react-syntax-highlighter/dist/esm/languages/prism/sql';
import bash      from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import yaml      from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import markdown  from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import diff      from 'react-syntax-highlighter/dist/esm/languages/prism/diff';
import swift     from 'react-syntax-highlighter/dist/esm/languages/prism/swift';
import kotlin    from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin';
import ruby      from 'react-syntax-highlighter/dist/esm/languages/prism/ruby';
import php       from 'react-syntax-highlighter/dist/esm/languages/prism/php';
import powershell from 'react-syntax-highlighter/dist/esm/languages/prism/powershell';
import graphql   from 'react-syntax-highlighter/dist/esm/languages/prism/graphql';
import docker    from 'react-syntax-highlighter/dist/esm/languages/prism/docker';
import toml      from 'react-syntax-highlighter/dist/esm/languages/prism/toml';
import ini       from 'react-syntax-highlighter/dist/esm/languages/prism/ini';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('js',         javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('ts',         typescript);
SyntaxHighlighter.registerLanguage('jsx',        jsx);
SyntaxHighlighter.registerLanguage('tsx',        tsx);
SyntaxHighlighter.registerLanguage('python',     python);
SyntaxHighlighter.registerLanguage('py',         python);
SyntaxHighlighter.registerLanguage('rust',       rust);
SyntaxHighlighter.registerLanguage('rs',         rust);
SyntaxHighlighter.registerLanguage('go',         go);
SyntaxHighlighter.registerLanguage('java',       java);
SyntaxHighlighter.registerLanguage('c',          c);
SyntaxHighlighter.registerLanguage('cpp',        cpp);
SyntaxHighlighter.registerLanguage('c++',        cpp);
SyntaxHighlighter.registerLanguage('csharp',     csharp);
SyntaxHighlighter.registerLanguage('cs',         csharp);
SyntaxHighlighter.registerLanguage('html',       markup);
SyntaxHighlighter.registerLanguage('xml',        markup);
SyntaxHighlighter.registerLanguage('markup',     markup);
SyntaxHighlighter.registerLanguage('css',        css);
SyntaxHighlighter.registerLanguage('json',       json);
SyntaxHighlighter.registerLanguage('sql',        sql);
SyntaxHighlighter.registerLanguage('bash',       bash);
SyntaxHighlighter.registerLanguage('sh',         bash);
SyntaxHighlighter.registerLanguage('shell',      bash);
SyntaxHighlighter.registerLanguage('yaml',       yaml);
SyntaxHighlighter.registerLanguage('yml',        yaml);
SyntaxHighlighter.registerLanguage('markdown',   markdown);
SyntaxHighlighter.registerLanguage('md',         markdown);
SyntaxHighlighter.registerLanguage('diff',       diff);
SyntaxHighlighter.registerLanguage('swift',      swift);
SyntaxHighlighter.registerLanguage('kotlin',     kotlin);
SyntaxHighlighter.registerLanguage('ruby',       ruby);
SyntaxHighlighter.registerLanguage('rb',         ruby);
SyntaxHighlighter.registerLanguage('php',        php);
SyntaxHighlighter.registerLanguage('powershell', powershell);
SyntaxHighlighter.registerLanguage('ps1',        powershell);
SyntaxHighlighter.registerLanguage('graphql',    graphql);
SyntaxHighlighter.registerLanguage('docker',     docker);
SyntaxHighlighter.registerLanguage('dockerfile', docker);
SyntaxHighlighter.registerLanguage('toml',       toml);
SyntaxHighlighter.registerLanguage('ini',        ini);

export { SyntaxHighlighter, vscDarkPlus };
