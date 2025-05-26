import React, { useState, useEffect, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const CodeBlock = ({ inline, className, children }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const match = /language-(\w+)/.exec(className || "");
  const lang = match ? match[1] : "text";
  const codeString = String(children).replace(/\n$/, "");

  useEffect(() => {
    if (copied) {
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [copied]);


  const handleCopy = () => {
    navigator.clipboard.writeText(codeString)
      .then(() => {
        setCopied(true);
      })
      .catch(err => {
        console.error("Failed to copy code: ", err);
      });
  };

  if (inline) {
    return (
      <code className={className} style={{
        backgroundColor: 'var(--code-inline-bg)',
        padding: '2px 4px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '0.9em',
        color: 'var(--primary-color)'
      }}>
        {children}
      </code>
    );
  }

  return (
    <div style={{ position: "relative", marginBottom: "1rem" }}>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          backgroundColor: copied ? "#28a745" : "var(--button-bg)",
          color: "white",
          border: "none",
          padding: "0.3rem 0.6rem",
          borderRadius: "5px",
          cursor: "pointer",
          fontSize: "0.8rem",
          zIndex: 10,
          transition: "background-color 0.2s ease"
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <SyntaxHighlighter
        style={coldarkDark}
        language={lang}
        PreTag="div"
        customStyle={{
          paddingTop: "2.5rem",
          borderRadius: "8px",
          fontSize: "0.9em",
          backgroundColor: "var(--code-block-bg)",
          color: "var(--text-color)",
          margin: 0,
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}
        codeTagProps={{
            style: {
                fontFamily: 'monospace',
                fontSize: '1em'
            }
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;