import { useState, useEffect, useRef } from 'react';
import './index.css';
import Lottie from "lottie-react";
import AIAnimation from './assets/Animation_AI.json';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import CodeBlock from './components/CodeBlock';
import ShareModal from './components/ShareModal';
import html2pdf from 'html2pdf.js';
import SantrixLogo from './assets/logo.png'; // Assuming logo.png is in assets
import ThemeToggle from './components/ThemeToggle'; // Import the new ThemeToggle component

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const AI_MODEL_NAME = "gemini-1.5-flash-latest";
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

// Helper function to get history from local storage
const getHistoryFromLocalStorage = () => {
  try {
    const storedHistory = localStorage.getItem('chatHistory');
    return storedHistory ? JSON.parse(storedHistory) : [];
  } catch (error) {
    console.error("Failed to parse chat history from local storage", error);
    return [];
  }
};

// Helper function to save history to local storage
const saveHistoryToLocalStorage = (history) => {
  try {
    localStorage.setItem('chatHistory', JSON.stringify(history));
  } catch (error) {
    console.error("Failed to save chat history to local storage", error);
  }
};

// Helper function to get theme from local storage
const getThemeFromLocalStorage = () => {
  try {
    return localStorage.getItem('theme') || 'dark'; // Default to dark
  } catch (error) {
    console.error("Failed to get theme from local storage", error);
    return 'dark';
  }
};

// Helper function to save theme to local storage
const saveThemeToLocalStorage = (theme) => {
  try {
    localStorage.setItem('theme', theme);
  } catch (error) {
    console.error("Failed to save theme to local storage", error);
  }
};


// Helper function to convert file to Gemini API's format
const fileToGenerativePart = async (file) => {
  const base64EncodedDataPromise = new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
  try {
    const data = await base64EncodedDataPromise;
    return {
      inlineData: { data, mimeType: file.type },
    };
  } catch (error) {
    console.error("Error converting file to base64:", error);
    throw error;
  }
};


function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false); // Start closed by default
  const [sidebarOpenedByHover, setSidebarOpenedByHover] = useState(false); // New state to track hover open
  const [history, setHistory] = useState(getHistoryFromLocalStorage());
  const [isLoading, setIsLoading] = useState(false);

  const [currentFile, setCurrentFile] = useState(null);
  const [currentFilePreview, setCurrentFilePreview] = useState(null);

  const [activeHistoryDropdown, setActiveHistoryDropdown] = useState(null);
  const historyDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatBodyRef = useRef(null);
  const sidebarRef = useRef(null); // Ref for sidebar for click outside logic
  const toggleButtonRef = useRef(null); // Ref for toggle button to exclude it from closing

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalContent, setShareModalContent] = useState('');
  const [showCopiedNotification, setShowCopiedNotification] = useState(false);
  const notificationTimerRef = useRef(null); // Ref for notification timer

  // Theme state
  const [theme, setTheme] = useState(getThemeFromLocalStorage());

  // Apply theme class to body on theme change
  useEffect(() => {
    document.body.className = theme;
    saveThemeToLocalStorage(theme);
  }, [theme]);

  // Effect for auto-scrolling chat body
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages]);

  // Effect to save history to local storage
  useEffect(() => {
    saveHistoryToLocalStorage(history);
  }, [history]);

  // Effect for handling click outside history dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(event.target) &&
          !event.target.closest('.history-options-button')) {
        setActiveHistoryDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeHistoryDropdown]);

  // Effect to hide "Copied!" notification after a delay
  useEffect(() => {
    if (showCopiedNotification) {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      notificationTimerRef.current = setTimeout(() => {
        setShowCopiedNotification(false);
      }, 2000); // Hide after 2 seconds
      return () => {
        if (notificationTimerRef.current) {
          clearTimeout(notificationTimerRef.current);
        }
      };
    }
  }, [showCopiedNotification]);


  // UPDATED useEffect for sidebar behavior with hover and click distinction
  useEffect(() => {
    const handleMouseEnter = () => {
      // Only open on hover if on desktop and sidebar is currently closed by default/hover
      if (window.innerWidth > 768 && !sidebarOpen) {
        setSidebarOpen(true);
        setSidebarOpenedByHover(true); // Mark as opened by hover
      }
    };

    const handleMouseLeave = () => {
      // Only close on mouse leave if on desktop AND it was opened by hover
      if (window.innerWidth > 768 && sidebarOpenedByHover) {
        setSidebarOpen(false);
        setSidebarOpenedByHover(false); // Reset hover flag
      }
    };

    // Attach/detach mouse listeners only for desktop
    if (window.innerWidth > 768 && sidebarRef.current) {
      sidebarRef.current.addEventListener('mouseenter', handleMouseEnter);
      sidebarRef.current.addEventListener('mouseleave', handleMouseLeave);
    }

    // Cleanup function
    return () => {
      if (window.innerWidth > 768 && sidebarRef.current) {
        sidebarRef.current.removeEventListener('mouseenter', handleMouseEnter);
        sidebarRef.current.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [sidebarOpen, sidebarOpenedByHover]); // Re-run if sidebarOpen or sidebarOpenedByHover changes


  // Handle click outside sidebar for mobile or when sidebar is opened by click on desktop
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If sidebar is open, click is outside sidebarRef, and click is not on toggleButtonRef
      // And it was NOT opened by hover (i.e., it was opened by click)
      if (sidebarOpen && !sidebarOpenedByHover && sidebarRef.current && !sidebarRef.current.contains(event.target) &&
          toggleButtonRef.current && !toggleButtonRef.current.contains(event.target)) {
        setSidebarOpen(false);
      }
      // For mobile, always close if clicking outside the sidebar when it's open
      if (window.innerWidth <= 768 && sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(event.target) &&
          toggleButtonRef.current && !toggleButtonRef.current.contains(event.target)) {
        setSidebarOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, sidebarOpenedByHover]); // Depend on sidebarOpen and sidebarOpenedByHover


  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setCurrentFile(file);

      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCurrentFilePreview(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        setCurrentFilePreview(null);
      }
    } else {
      setCurrentFile(null);
      setCurrentFilePreview(null);
    }
  };

  const removeSelectedFile = () => {
    setCurrentFile(null);
    setCurrentFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (isLoading || (!input.trim() && !currentFile)) {
      if (!input.trim() && !currentFile) return;
    }

    setIsLoading(true);

    let userMessageText = input.trim();
    let userMessageForDisplay = {
      role: "user",
      text: userMessageText,
      filePreviewUrl: currentFilePreview,
      fileName: currentFile ? currentFile.name : null,
      fileType: currentFile ? currentFile.type : null
    };

    let apiMessageParts = [];
    if (userMessageText) {
      apiMessageParts.push({ text: userMessageText });
    }

    if (currentFile) {
      try {
        const filePart = await fileToGenerativePart(currentFile);
        apiMessageParts.push(filePart);
      } catch (error) {
        console.error("Error processing file for API:", error);
        setMessages(prevMessages => [...prevMessages, { role: "model", text: "Error processing your file. Please try again." }]);
        setIsLoading(false);
        removeSelectedFile();
        return;
      }
    }

    if (apiMessageParts.length === 0) {
        setIsLoading(false);
        return;
    }

    const messagesAtSubmitStart = [...messages];
    const updatedMessagesWithUser = [...messagesAtSubmitStart, userMessageForDisplay];
    setMessages(updatedMessagesWithUser);

    setInput("");
    removeSelectedFile();

    try {
      const conversationHistoryForAPI = messagesAtSubmitStart.map(msg => {
        let parts = [];
        if (msg.text) parts.push({ text: msg.text });
        // Handle image data in history if needed by the API, otherwise filter it out for text-only models
        // For Gemini 1.5 Flash with multimodal capabilities, you might need to preserve image data if it's sent previously.
        // For simplicity, we'll assume text-only history for the API in this mapping.
        return { role: msg.role, parts: parts.length > 0 ? parts : [{text: " "}] };
      }).filter(msg => msg.parts.some(p => p.text?.trim())); // Filter out messages with no text content for API

      conversationHistoryForAPI.push({ role: "user", parts: apiMessageParts });

      const response = await axios.post(AI_API_URL, {
        contents: conversationHistoryForAPI,
      });

      const botReply = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I didn't understand or couldn't process the request.";
      const aiMessage = { role: "model", text: botReply };
      setMessages(prevMessages => [...prevMessages, aiMessage]);

      setHistory(prevHistory => {
        const currentChatMessages = [...updatedMessagesWithUser, aiMessage];
        if (messagesAtSubmitStart.length === 0) {
          let title = userMessageForDisplay.text.substring(0, 30);
          if (!title && userMessageForDisplay.fileName) {
            title = `Chat with ${userMessageForDisplay.fileName.substring(0,20)}`;
          } else if (!title) {
            title = "New Chat";
          }
          if (userMessageForDisplay.text.length > 30 || (userMessageForDisplay.fileName && userMessageForDisplay.fileName.length > 20 && !userMessageForDisplay.text)) title += "...";

          return [{ title: title, messages: currentChatMessages }, ...prevHistory];
        } else {
          const updatedHistory = [...prevHistory];
          // Find the current chat in history based on its initial messages (or just update the first one if it's a new chat session but not a brand new history entry)
          // For simplicity, we assume we are always updating the latest chat in history if it exists, or adding a new one.
          if (updatedHistory.length > 0 && JSON.stringify(updatedHistory[0].messages.slice(0, messagesAtSubmitStart.length)) === JSON.stringify(messagesAtSubmitStart)) {
              updatedHistory[0] = { ...updatedHistory[0], messages: currentChatMessages };
          } else {
              // This case handles when you start a new chat, but there might be existing history,
              // or if you loaded an old chat and continued it.
              // To properly handle continuing an old chat and making it the "current" one,
              // you might need an `activeChatIndex` state. For now, we'll push new chats to the top.
              let title = userMessageForDisplay.text.substring(0, 30) || (userMessageForDisplay.fileName || "Chat").substring(0,30);
              if (userMessageForDisplay.text.length > 30 || (userMessageForDisplay.fileName && userMessageForDisplay.fileName.length > 20 && !userMessageForDisplay.text)) title += "...";
              updatedHistory.unshift({ title: title, messages: currentChatMessages });
          }
          return updatedHistory;
        }
      });

    } catch (error) {
      console.error("Error communicating with AI:", error.response ? error.response.data : error.message);
      let errorText = "Error connecting to AI. Please try again.";
      if (error.response && error.response.data && error.response.data.error && error.response.data.error.message) {
        errorText = `AI Error: ${error.response.data.error.message}`;
      }
      const errorMessage = { role: "model", text: errorText };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleSidebar = () => {
    // When the button is clicked, it's never a 'hover' open
    setSidebarOpen(prev => !prev);
    setSidebarOpenedByHover(false); // Ensure the hover flag is false when explicitly toggled
  };

  const startNewChat = () => {
    setMessages([]);
    removeSelectedFile();
    setActiveHistoryDropdown(null);
    setSidebarOpen(false); // Close sidebar after starting new chat
    setSidebarOpenedByHover(false); // Reset hover flag
  };

  const loadChat = (chatToLoad) => {
    setMessages(chatToLoad.messages);
    removeSelectedFile();
    setSidebarOpen(false); // Close sidebar after loading chat
    setSidebarOpenedByHover(false); // Reset hover flag
    setActiveHistoryDropdown(null);

    // Optional: Move the loaded chat to the top of the history
    setHistory(prevHistory => {
        const updatedHistory = prevHistory.filter(chat => chat !== chatToLoad);
        return [chatToLoad, ...updatedHistory];
    });
  };

  const handleFileUploadClick = () => {
    fileInputRef.current.click();
  };

  const prepareChatContentForShare = (chatData, isFullChat = true) => {
    let content = "";
    let messagesToProcess = isFullChat ? chatData : chatData.messages;

    content = messagesToProcess.map(msg => {
        if (msg.type === 'pdf') return ''; // Don't include PDF messages in text share

        let msgText = msg.text || '';
        let fileInfo = msg.fileName ? ` (File: ${msg.fileName})` : '';
        if (msg.role === 'user') {
            return `**User:** ${msgText}${fileInfo}`; // Add "User:" prefix for clarity
        } else if (msg.role === 'model') {
            return `**Santrix:** ${msgText}${fileInfo}`; // Add "Santrix:" prefix for clarity
        }
        return '';
    }).filter(line => line.trim() !== '').join('\n\n');

    if (!isFullChat) {
        content = `Chat History: "${chatData.title}"\n\n${content}`;
    } else {
        content = `Santrix Chat Transcript\n\n${content}`;
    }
    return content;
  };

  const openShareModal = (content) => {
    setShareModalContent(content);
    setIsShareModalOpen(true);
    setActiveHistoryDropdown(null);
  };

  const closeShareModal = () => {
    setIsShareModalOpen(false);
    setShareModalContent('');
  };

  const handleCopyToClipboard = (content) => {
    // Retain markdown bold for copying, as some apps might render it.
    // If truly plain text is needed, use: const plainTextContent = content.replace(/\*\*(.*?)\*\*/g, '$1');
    navigator.clipboard.writeText(content)
      .then(() => {
        setShowCopiedNotification(true);
        closeShareModal();
      })
      .catch(err => {
        console.error("Could not copy chat content: ", err);
        alert("Failed to copy chat content. Please try again.");
      });
  };

  const handleGeneratePdf = async () => {
    try {
      let messagesToProcessForPdf;
      let pdfTitle = "Santrix Chat Transcript";

      const chatTitleMatch = shareModalContent.match(/Chat History: "(.*?)"/);
      if (chatTitleMatch && chatTitleMatch[1]) {
          const chatToFind = history.find(chat => chat.title === chatTitleMatch[1]);
          messagesToProcessForPdf = chatToFind ? chatToLoad.messages : messages; // Use chatToLoad.messages if available
          pdfTitle = `Chat History - ${chatTitleMatch[1]}`;
      } else {
          messagesToProcessForPdf = messages;
      }

      const filteredMessages = messagesToProcessForPdf.filter(msg => msg.type !== 'pdf');

      if (filteredMessages.length === 0) {
        alert("No chat content to generate PDF for.");
        closeShareModal();
        return;
      }

      let htmlContent = `
        <div style="padding: 20mm; font-family: Arial, sans-serif; color: #333; line-height: 1.5;">
          <h1 style="text-align: center; margin-bottom: 20px; font-size: 24px; color: #0056b3;">${pdfTitle}</h1>
      `;

      filteredMessages.forEach(msg => {
        let messageText = msg.text || '';
        let fileInfo = msg.fileName ? ` (File: ${msg.fileName})` : '';
        const escapedMessageText = messageText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        const formattedText = escapedMessageText.replace(/\n/g, '<br/>');


        if (msg.role === 'user') {
          htmlContent += `
            <p style="margin-bottom: 15px; word-break: break-word; white-space: pre-wrap;">
              <span style="font-weight: bold; font-size: 1.1em;">User: </span>${formattedText}${fileInfo}
            </p>
          `;
        } else {
          htmlContent += `
            <p style="margin-bottom: 15px; word-break: break-word; white-space: pre-wrap;">
              <span style="font-weight: bold; font-size: 1.1em;">Santrix: </span>${formattedText}${fileInfo}
            </p>
          `;
        }
      });

      htmlContent += `</div>`;

      const options = {
        margin: [10, 10, 10, 10],
        filename: `${pdfTitle.replace(/ /g, '_')}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          logging: false,
          dpi: 192,
          letterRendering: true,
          useCORS: true,
          allowTaint: true,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const pdfBlob = await html2pdf().from(htmlContent).set(options).output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Add the PDF link to the current chat messages for display
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: "system", // Using 'system' role for internal actions/files
          type: "pdf",
          pdfUrl: pdfUrl,
          fileName: `${pdfTitle.replace(/ /g, '_')}.pdf`,
          text: `PDF Transcript: ${pdfTitle}` // Added text for better display
        }
      ]);

      closeShareModal();
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again: " + error.message);
    }
  };


  const handleNativeShare = (content) => {
    const plainTextContent = content.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove markdown bold for native share

    if (navigator.share) {
      navigator.share({
        title: 'Santrix Chat',
        text: plainTextContent,
      })
      .then(() => {
        console.log('Content shared successfully');
        closeShareModal();
      })
      .catch((error) => {
        console.error('Error sharing:', error);
        alert("Failed to share content. Please try again.");
      });
    } else {
      alert("Web Share API is not supported in your browser.");
    }
    closeShareModal();
  };


  const handleHistoryOptionClick = (index, event) => {
    event.stopPropagation();
    setActiveHistoryDropdown(activeHistoryDropdown === index ? null : index);
  };

  const handleDeleteHistory = (index) => {
    const updatedHistory = history.filter((_, i) => i !== index);
    setHistory(updatedHistory);
    setActiveHistoryDropdown(null);
    // If the currently loaded chat is deleted, start a new chat
    if (history[index] && JSON.stringify(messages) === JSON.stringify(history[index].messages)) {
        startNewChat();
    }
  };

  // Theme toggle function
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className="app-wrapper">
      {/* Sidebar with dynamic class based on sidebarOpen state */}
      <div
        ref={sidebarRef}
        className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`} // Use 'closed' class for styling when collapsed
      >
        <div className="sidebar-header">
          <button className="new-chat-btn" onClick={startNewChat}>
            <span className="plus-icon">+</span> <span className="new-chat-text">New Chat</span>
          </button>
        </div>
        <div className="chat-history">
          <h4>History</h4>
          {history.length === 0 ? (
            <p className="no-history">No history yet. Start a new chat!</p>
          ) : (
            history.map((chat, index) => (
              <div key={index} className="history-item-wrapper">
                  <div className="history-item" onClick={() => loadChat(chat)}>
                      <p title={chat.title}>{chat.title}</p>
                      <button
                          className="history-options-button"
                          onClick={(e) => handleHistoryOptionClick(index, e)}
                          title="Chat options"
                      >
                          &#x22EF;
                      </button>
                  </div>
                  {activeHistoryDropdown === index && (
                      <div className="options-dropdown" ref={historyDropdownRef}>
                          <button onClick={(e) => { e.stopPropagation(); openShareModal(prepareChatContentForShare(chat, false)); }}>Share</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteHistory(index); }}>Delete</button>
                      </div>
                  )}
              </div>
            ))
          )}
        </div>
        {/* Removed Settings icon from the bottom of the sidebar */}
        {/* <div className="sidebar-footer">
          <button className="settings-btn" title="Settings">
            ⚙️
          </button>
        </div> */}
      </div>

      {/* Conditional overlay for mobile or when sidebar opened by click on desktop */}
      {(sidebarOpen && !sidebarOpenedByHover && window.innerWidth > 768) || (sidebarOpen && window.innerWidth <= 768) ? (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      ) : null}


      {/* Main chat area */}
      <div className={`main-chat ${sidebarOpen ? 'sidebar-shifted' : ''}`}>
        <div className="chat-header">
            {/* The primary toggle button for sidebar in the main chat header */}
            <button
                ref={toggleButtonRef} // Attach ref here
                onClick={toggleSidebar}
                className="header-toggle-sidebar-btn" // New class for this button
                title={sidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
                {sidebarOpen ? '❮' : '☰'} {/* Left arrow when open, Hamburger when closed */}
            </button>
            {/* Logo added here */}
            <div className="header-logo-container">
              <img src={SantrixLogo} alt="Santrix Logo" className="santrix-logo" />
              <span className="chat-title">Santrix</span>
            </div>
            {/* Theme Toggle and Share buttons */}
            <div className="header-actions">
              <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
              <button className="header-share-button" onClick={() => openShareModal(prepareChatContentForShare(messages, true))}>
                  <span role="img" aria-label="share">🔗</span> Share
              </button>
            </div>
        </div>

        <div className="chat-body" ref={chatBodyRef}>
          {messages.length === 0 && !isLoading && (
            <div className="initial-message">
              {/* Lottie animation moved here for initial message display */}
              <Lottie animationData={AIAnimation} style={{ width: "5rem", height: "5rem" }} />
              <h1>How can I help you today?</h1>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`chat-message ${msg.role === "user" ? "user" : msg.type === "pdf" ? "system" : "bot"}`}
            >
              <div className="message-content">
                {msg.type === "pdf" ? (
                  <div className="generated-pdf-container">
                    <p>PDF Transcript: {msg.fileName}</p>
                    <a href={msg.pdfUrl} download={msg.fileName} className="download-pdf-button">
                      Download PDF
                    </a>
                  </div>
                ) : msg.role === "model" ? (
                  <ReactMarkdown components={{ code: CodeBlock }}>
                    {msg.text}
                  </ReactMarkdown>
                ) : (
                  <>
                    {msg.text && <p className="user-message-text">{msg.text}</p>}
                    {(msg.filePreviewUrl && (msg.fileType?.startsWith('image/') || msg.fileType?.startsWith('video/'))) ? (
                      msg.fileType?.startsWith('image/') ? (
                        <img
                          src={msg.filePreviewUrl}
                          alt={msg.fileName || "uploaded image"}
                          style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', marginTop: msg.text ? '10px' : '0' }}
                        />
                      ) : (
                        <video
                          src={msg.filePreviewUrl}
                          controls
                          style={{ maxWidth: '200px', maxHeight: '200px', borderRadius: '8px', marginTop: msg.text ? '10px' : '0' }}
                        />
                      )
                    ) : msg.fileName && (
                      <p className="file-name-display">
                          📎 {msg.fileName}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="chat-message bot loading-message">
              <div className="message-content">
                <p>Thinking...</p>
              </div>
            </div>
          )}
        </div>

        <div className="chat-footer">
          <div className="input-container">
            <button onClick={handleFileUploadClick} className="file-upload-button" title="Upload File">
              {/* Modern Upload Icon (SVG) */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-upload">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
            </button>
            {(currentFilePreview && (currentFile?.type.startsWith('image/') || currentFile?.type.startsWith('video/'))) ? (
              <div className="file-preview-active">
                {currentFile?.type.startsWith('image/') ? (
                  <img src={currentFilePreview} alt="Preview" />
                ) : (
                  <video src={currentFilePreview} controls />
                )}
                <button onClick={removeSelectedFile} className="remove-file-btn" title="Remove File">
                  &times;
                </button>
              </div>
            ) : currentFile && (
                <div className="file-preview-active" style={{padding: '5px 15px', maxWidth: '200px', height: 'auto'}}>
                  <span style={{whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem'}}>
                      📎 {currentFile.name}
                  </span>
                  <button onClick={removeSelectedFile} className="remove-file-btn" title="Remove File">
                      &times;
                  </button>
                </div>
            )}
            <textarea
              rows="1"
              placeholder={currentFile ? `Add a message for ${currentFile.name}...` : "Message Santrix..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            ></textarea>
            <button onClick={handleSubmit} disabled={isLoading || (!input.trim() && !currentFile)} className="send-button">
              {/* Send Icon (SVG) - Styled for black/white */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-send">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
            accept="image/*, application/pdf, audio/*, video/*, text/plain"
          />
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={closeShareModal}
        onCopy={handleCopyToClipboard}
        onGeneratePdf={handleGeneratePdf}
        onShare={handleNativeShare}
        chatContent={shareModalContent}
      />

      {/* Custom Copied Notification */}
      {showCopiedNotification && (
        <div className="copied-notification-center">
          Copied to clipboard!
        </div>
      )}
    </div>
  );
}

export default App;