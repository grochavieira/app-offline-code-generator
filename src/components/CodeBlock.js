// src/components/CodeBlock.js
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { FaRegCopy } from 'react-icons/fa';
import './CodeBlock.css';

const codeBlockStyles = {
    background: 'black', 
    borderRadius: 0, 
    borderBottomLeftRadius: 8, 
    borderBottomRightRadius: 8,
    marginTop: 0, 
};

const CodeBlock = ({ language, code, title }) => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code);
    alert('Código copiado para a área de transferência!');
  };

  return (
    <div className="code-block-container">
      <div className="code-block-header">
        <span>{title ? title : language}</span>
        <button onClick={copyToClipboard} className="copy-button">
          <FaRegCopy /> Copiar
        </button>
      </div>
      <SyntaxHighlighter language={language} style={dracula} showLineNumbers={true} customStyle={codeBlockStyles} >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
