import React, { useState } from 'react';
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism';
import { materialDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
const PrismHighlighter = SyntaxHighlighter as any;

interface CodeBlockProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export default function CodeBlock({ node: _node, inline, className, children, ...props }: CodeBlockProps) {
  const [copyStatus, setCopyStatus] = useState('Copy');
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  
  const copyCodeToClipboard = (event: React.MouseEvent) => {
    event.preventDefault();
    setCopyStatus('Copied!');
    navigator.clipboard.writeText(String(children || '').replace(/\n$/, ''))
      .then(() => {
        // Clipboard successfully set
        setTimeout(() => setCopyStatus('Copy'), 2000);
      }, (error) => {
        // Clipboard write failed
        setCopyStatus('Error: ' + error);
        setTimeout(() => setCopyStatus('Copy'), 3000);
      });
  };

  return !inline && !!language ? (
    <div className="code-block my-4">
      <div className="flex justify-between items-center bg-gray-800 text-white px-4 py-2 text-sm">
        <div className="font-medium">
          {language}
        </div>
        <div>
          {copyStatus === 'Copy' ? (
            <button 
              onClick={copyCodeToClipboard}
              className="text-gray-300 hover:text-white transition-colors"
            >
              {copyStatus}
            </button>
          ) : (
            <span className="text-gray-400">{copyStatus}</span>
          )}
        </div>
      </div>
      
      <PrismHighlighter 
        style={materialDark} 
        customStyle={{
          fontSize: "0.875rem",
          margin: 0,
          borderRadius: "0 0 0.5rem 0.5rem",
        }} 
        language={language} 
        {...props}
      >
        {String(children || '').replace(/\n$/, '')}
      </PrismHighlighter>
    </div>
  ) : (
    <code className={`${className} bg-gray-100 px-1 py-0.5 rounded text-sm font-mono`} {...props}>
      {children}
    </code>
  );
}
