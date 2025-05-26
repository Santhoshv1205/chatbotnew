import React from 'react';
import './ShareModal.css';

const ShareModal = ({ isOpen, onClose, onCopy, onGeneratePdf, onShare, chatContent }) => {
  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay">
      <div className="share-modal-content">
        <button className="close-button" onClick={onClose}>&times;</button>
        <h2>Share Chat</h2>
        <p>Choose how you'd like to share this chat conversation:</p>
        <div className="share-options">
          <button onClick={() => onCopy(chatContent)}>Copy to Clipboard</button>
          <button onClick={() => onGeneratePdf(chatContent)}>Generate PDF & Download</button>
          <button onClick={() => onShare(chatContent)}>Share via...</button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;