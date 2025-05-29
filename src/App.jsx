import { useState, useEffect, useRef } from 'react';
import './index.css'; // Ensure this path is correct
import Lottie from "lottie-react";
import AIAnimation from './assets/Animation_AI.json'; // Ensure this path is correct
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import CodeBlock from './components/CodeBlock'; // Ensure this path is correct
import ShareModal from './components/ShareModal';
import html2pdf from 'html2pdf.js';
import SantrixLogo from './assets/logo.png';
import ThemeToggle from './components/ThemeToggle'; // Ensure this path is correct

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const AI_MODEL_NAME = "gemini-1.5-flash-latest";
const AI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

// --- NEW: Backend API URL for Java ---
const BACKEND_API_URL = "http://localhost:8080/api/data/upload-csv-excel";
// Adjust endpoint if different

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
    return localStorage.getItem('theme') ||
    'dark'; // Default to dark
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
    console.error("Failed to save chat history to local storage", error);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Start closed by default
  const [sidebarOpenedByHover, setSidebarOpenedByHover] = useState(false);
  // New state to track hover open
  const [history, setHistory] = useState(getHistoryFromLocalStorage());
  const [isLoading, setIsLoading] = useState(false);
  // --- MODIFIED: To support multiple files ---
  const [currentFiles, setCurrentFiles] = useState([]);
  const [currentFilePreviews, setCurrentFilePreviews] = useState([]);
  const [activeHistoryDropdown, setActiveHistoryDropdown] = useState(null);
  const historyDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatBodyRef = useRef(null);
  const sidebarRef = useRef(null);
  // Ref for sidebar for click outside logic
  const toggleButtonRef = useRef(null);
  // Ref for toggle button to exclude it from closing
  const messageInputRef = useRef(null);
  // Ref for the message input textarea

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareModalContent, setShareModalContent] = useState('');
  const [showCopiedNotification, setShowCopiedNotification] = useState(false);
  const notificationTimerRef = useRef(null); // Ref for notification timer

  // Theme state
  const [theme, setTheme] = useState(getThemeFromLocalStorage());
  // State for controlling the fade-in animation of the initial text
  const [initialTextVisible, setInitialTextVisible] = useState(false);
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
  // Effect to trigger the fade-in animation for initial message
  useEffect(() => {
    // Only show animation if no messages are present and not loading
    if (messages.length === 0 && !isLoading) {
      const timer = setTimeout(() => {
        setInitialTextVisible(true);
      }, 500); // Adjust the delay as needed
      return () => clearTimeout(timer);
    } else {
      setInitialTextVisible(false); // Hide if messages appear or loading starts
 
    }
  }, [messages, isLoading]); // Depend on messages and isLoading

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
  }, [sidebarOpen, sidebarOpenedByHover]);
  // Re-run if sidebarOpen or sidebarOpenedByHover changes


  // Handle click outside sidebar for mobile or when sidebar is opened by click on desktop
  useEffect(() => {
    const handleClickOutside = (event) => {
      // If sidebar is open, click is outside sidebarRef, and click is not on toggleButtonRef
      // And it was NOT opened by hover (i.e., it was opened by click)
      if (sidebarOpen && !sidebarOpenedByHover && sidebarRef.current && !sidebarRef.current.contains(event.target) &&
          toggleButtonRef.current 
          && !toggleButtonRef.current.contains(event.target)) {
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
      // FIX: Changed handleClickB2B_Sales to handleClickOutside as it was causing a ReferenceError
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [sidebarOpen, sidebarOpenedByHover]);
  // Depend on sidebarOpen and sidebarOpenedByHover


  // Effect to focus the message input on initial load and after messages are sent/loaded
  useEffect(() => {
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  }, [messages, isLoading]);
  // Re-focus when messages update or loading state changes

  // --- MODIFIED: handleFileChange to accept multiple files and append ---
  const handleFileChange = (event) => {
    const newlySelectedFiles = Array.from(event.target.files);
    // Convert FileList to Array

    // If the file dialog was cancelled, event.target.files will be empty
    if (newlySelectedFiles.length === 0) {
      return;
      // Do nothing if no new files were selected
    }

    let updatedFiles = [...currentFiles];
    let updatedFilePreviews = [...currentFilePreviews];

    newlySelectedFiles.forEach(newFile => {
      // Check for duplicates based on name and size (simple check)
      const isDuplicate = updatedFiles.some(existingFile =>
        existingFile.name === newFile.name && existingFile.size === newFile.size
      );

      if (!isDuplicate) {
        updatedFiles.push(newFile);

        // Generate preview for image and video files
        if (newFile.type.startsWith('image/') || newFile.type.startsWith('video/')) {
     
          const reader = new FileReader();
          reader.onloadend = () => {
            updatedFilePreviews.push(reader.result);
            // Update state with new preview only when all new previews are ready
            // (or when this specific one is ready, depending on desired update frequency)
            setCurrentFilePreviews([...updatedFilePreviews]);
     
          };
          reader.readAsDataURL(newFile);
        } else {
          updatedFilePreviews.push(null); // No preview for other file types
        }
      }
    });
    setCurrentFiles(updatedFiles);
    // Ensure previews are updated after all files have been processed
    // This is important if async FileReader operations are still pending
    // or updating previews in `reader.onloadend` as shown above.
    setCurrentFilePreviews(updatedFilePreviews);

    // Clear the input field value to allow selecting the same file(s) again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- NEW: Function to remove a single file ---
  const removeIndividualFile = (indexToRemove) => {
    setCurrentFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    setCurrentFilePreviews(prevPreviews => prevPreviews.filter((_, index) => index !== indexToRemove));
    // Clear the input field's value to ensure proper re-selection
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // --- RENAMED: removeSelectedFile to removeAllSelectedFiles ---
  const removeAllSelectedFiles = () => {
    setCurrentFiles([]);
    setCurrentFilePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      // Clear the input field's value
    }
  };
  const handleSubmit = async () => {
    // --- MODIFIED: Check currentFiles.length ---
    if (isLoading || (!input.trim() && currentFiles.length === 0)) {
      if (!input.trim() && currentFiles.length === 0) return;
    }

    setIsLoading(true);

    let userMessageText = input.trim();
    // --- MODIFIED: userMessageForDisplay for multiple files ---
    let userMessageForDisplay = {
      role: "user",
      text: userMessageText,
      filePreviews: currentFilePreviews,
      fileNames: currentFiles.map(f => f.name),
      fileTypes: currentFiles.map(f => f.type)
    };
    const messagesAtSubmitStart = [...messages];
    const updatedMessagesWithUser = [...messagesAtSubmitStart, userMessageForDisplay];
    setMessages(updatedMessagesWithUser);

    setInput("");
    removeAllSelectedFiles();
    // Clears all selected files and previews after submission

    // --- NEW: Handle CSV and Excel file uploads to Java Backend ---
    // --- MODIFIED: Check currentFiles.length and iterate ---
    if (currentFiles.length > 0) {
        const hasCsvExcel = currentFiles.some(file =>
            file.type === 'text/csv' ||
            file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
        );
        if (hasCsvExcel) {
            try {
                const formData = new FormData();
                currentFiles.forEach(file => {
                    formData.append('files', file); // Use 'files' for multiple files on backend
                });
                formData.append('prompt', userMessageText); // Send user prompt along with the file

                const backendResponse = await axios.post(BACKEND_API_URL, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
   
                });

                const backendReply = backendResponse?.data?.message ||
                backendResponse?.data || "Successfully processed file(s)!";
                const aiMessage = { role: "model", text: `Backend Response: ${backendReply}` };
                setMessages(prevMessages => [...prevMessages, aiMessage]);
                // Update history with the backend interaction
                setHistory(prevHistory => {
                    const currentChatMessages = [...updatedMessagesWithUser, aiMessage];
                    if (messagesAtSubmitStart.length === 0) {
                        let title = userMessageForDisplay.text.substring(0, 
                        30);
                        if (!title && userMessageForDisplay.fileNames.length > 0) {
                            title = `File Analysis: ${userMessageForDisplay.fileNames.join(', ').substring(0,20)}`;
                        } else if (!title) {
         
                            title = "New Chat";
                        }
                        if (userMessageForDisplay.text.length > 30 || (userMessageForDisplay.fileNames.length > 0 && userMessageForDisplay.fileNames.join(', ').length > 20 && !userMessageForDisplay.text)) title += "...";
             
                        return [{ title: title, messages: currentChatMessages }, ...prevHistory];
                    } else {
                        const updatedHistory = [...prevHistory];
                        if (updatedHistory.length > 0 && JSON.stringify(updatedHistory[0].messages.slice(0, messagesAtSubmitStart.length)) === JSON.stringify(messagesAtSubmitStart)) {
                            updatedHistory[0] = { ...updatedHistory[0], messages: currentChatMessages };
                        } else {
                            let title = userMessageForDisplay.text.substring(0, 30) ||
                            (userMessageForDisplay.fileNames.length > 0 ? `File Analysis: ${userMessageForDisplay.fileNames.join(', ').substring(0,30)}` : "Chat").substring(0,30);
                            if (userMessageForDisplay.text.length > 30 || (userMessageForDisplay.fileNames.length > 0 && userMessageForDisplay.fileNames.join(', ').length > 20 && !userMessageForDisplay.text)) title += "...";
                            updatedHistory.unshift({ title: title, messages: currentChatMessages });
                        }
                        return updatedHistory;
                    }
                });
            } catch (error) {
                console.error("Error sending file(s) to backend:", error.response ? error.response.data : error.message);
                let errorText = "Error communicating with the backend for file processing. Please try again.";
                if (error.response && error.response.data && error.response.data.message) {
                    errorText = `Backend Error: ${error.response.data.message}`;
                } else if (error.message) {
                    errorText = `Network Error: ${error.message}`;
                }
                setMessages(prevMessages => [...prevMessages, { role: "model", text: errorText }]);
            } finally {
                setIsLoading(false);
                if (messageInputRef.current) {
                    messageInputRef.current.focus();
                }
            }
            return;
            // Exit after handling CSV/Excel
        }
    }
    // --- END NEW FILE HANDLING ---


    // --- Existing Gemini API logic (only if not CSV/Excel) ---
    let apiMessageParts = [];
    if (userMessageText) {
      apiMessageParts.push({ text: userMessageText });
    }

    // --- MODIFIED: Iterate currentFiles for Gemini API ---
    if (currentFiles.length > 0) { // This currentFiles will be non-CSV/Excel files (images, PDFs, etc.)
      try {
        for (const file of currentFiles) {
          const filePart = await fileToGenerativePart(file);
          apiMessageParts.push(filePart);
        }
      } catch (error) {
        console.error("Error processing file(s) for API:", error);
        setMessages(prevMessages => [...prevMessages, { role: "model", text: "Error processing your file(s). Please try again." }]);
        setIsLoading(false);
        removeAllSelectedFiles();
        // Use the renamed function
        // Keep focus on input after error
        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
        return;
      }
    }

    if (apiMessageParts.length === 0) {
        setIsLoading(false);
        // Keep focus on input if nothing to send
        if (messageInputRef.current) {
          messageInputRef.current.focus();
        }
        return;
    }


    try {
      const conversationHistoryForAPI = messagesAtSubmitStart.map(msg => {
        let parts = [];
        if (msg.text) parts.push({ text: msg.text });
        // Handle image data in history if needed by the API, otherwise filter it out for text-only models
        // For simplicity, we'll assume text-only history for the API in this mapping.
      
        return { role: 
          msg.role, parts: parts.length > 0 ? parts : [{text: " "}] };
      }).filter(msg => msg.parts.some(p => p.text?.trim()));
      // Filter out messages with no text content for API

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
          // --- MODIFIED: History title for multiple files ---
          if (!title && userMessageForDisplay.fileNames.length > 0) {
            title = `Chat with ${userMessageForDisplay.fileNames.join(', ').substring(0,20)}`;
         
          } else if (!title) {
            title = "New Chat";
 
          }
          if (userMessageForDisplay.text.length > 30 || (userMessageForDisplay.fileNames.length > 0 && userMessageForDisplay.fileNames.join(', ').length > 20 && !userMessageForDisplay.text)) title += "...";

          return [{ title: title, messages: currentChatMessages }, ...prevHistory];
        } else {
          const updatedHistory = [...prevHistory];
  
          // For simplicity, we assume we are always updating the latest chat in history if it 
          // or adding a new one.
          if (updatedHistory.length > 0 && JSON.stringify(updatedHistory[0].messages.slice(0, messagesAtSubmitStart.length)) === JSON.stringify(messagesAtSubmitStart)) {
              updatedHistory[0] = { ...updatedHistory[0], messages: currentChatMessages };
          } else {
              let title = userMessageForDisplay.text.substring(0, 30) ||
              // --- MODIFIED: History title for multiple files ---
              (userMessageForDisplay.fileNames.length > 0 ? `Chat with ${userMessageForDisplay.fileNames.join(', ').substring(0,30)}` : "Chat").substring(0,30);
              if (userMessageForDisplay.text.length > 30 || (userMessageForDisplay.fileNames.length > 0 && userMessageForDisplay.fileNames.join(', ').length > 20 && !userMessageForDisplay.text)) title += "...";
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
      // Keep focus on input after AI response (success or error)
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
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
    removeAllSelectedFiles(); // Clears all selected files
    setActiveHistoryDropdown(null);
    setSidebarOpen(false);
    // Close sidebar after starting new chat
    setSidebarOpenedByHover(false); // Reset hover flag
    setInitialTextVisible(false);
    // Reset animation state
    // Focus input after starting new chat
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
  };

  const loadChat = (chatToLoad) => {
    setMessages(chatToLoad.messages);
    removeAllSelectedFiles();
    // Clears all selected files
    setSidebarOpen(false);
    // Close sidebar after loading chat
    setSidebarOpenedByHover(false);
    // Reset hover flag
    setActiveHistoryDropdown(null);
    setInitialTextVisible(false);
    // Ensure animation state is off when history is loaded

    // Optional: Move the loaded chat to the top of the history
    setHistory(prevHistory => {
        const updatedHistory = prevHistory.filter(chat => chat !== chatToLoad);
        return [chatToLoad, ...updatedHistory];
    });
    // Focus input after loading chat
    if (messageInputRef.current) {
      messageInputRef.current.focus();
    }
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
        // --- MODIFIED: File info for multiple files ---
        let fileInfo = msg.fileNames && msg.fileNames.length > 0 ? ` (Files: ${msg.fileNames.join(', ')})` : '';
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
    document.execCommand('copy'); // Using document.execCommand for clipboard access in iframes
    setShowCopiedNotification(true);
    closeShareModal();
  };

  const handleGeneratePdf = async () => {
    try {
      let messagesToProcessForPdf;
      let pdfTitle = "Santrix Chat Transcript";

      const chatTitleMatch = shareModalContent.match(/Chat History: "(.*?)"/);
      if (chatTitleMatch && chatTitleMatch[1]) {
          const chatToFind = history.find(chat => chat.title === chatTitleMatch[1]);
          messagesToProcessForPdf = chatToFind ? chatToFind.messages : messages;
          pdfTitle = `Chat History - ${chatTitleMatch[1]}`;
      } else {
          messagesToProcessForPdf = messages;
      }

      const filteredMessages = messagesToProcessForPdf.filter(msg => msg.type !== 'pdf');
      if (filteredMessages.length === 0) {
        // Using alert for fallback, consider a custom modal in future
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
        // --- MODIFIED: File info for multiple files in PDF ---
        let fileInfo = msg.fileNames && msg.fileNames.length > 0 ? ` (Files: ${msg.fileNames.join(', ')})` : '';
        const escapedMessageText = messageText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
        const formattedText = escapedMessageText.replace(/\n/g, '<br/>');


        if (msg.role === 'user') {
     
          htmlContent += `
            <p style="margin-bottom: 15px; word-break: 
            break-word; white-space: pre-wrap;">
              <span style="font-weight: bold; font-size: 1.1em;">User: </span>${formattedText}${fileInfo}
            </p>
          `;
        } else {
          htmlContent += 
          `
            <p style="margin-bottom: 15px; word-break: break-word; white-space: pre-wrap;">
     
            <span style="font-weight: bold;
            font-size: 1.1em;">Santrix: </span>${formattedText}${fileInfo}
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
      // Using alert for fallback, consider a custom modal in future
      alert("Failed to generate PDF. Please try again: " + error.message);
    }
  };


  const handleNativeShare = (content) => {
    const plainTextContent = content.replace(/\*\*(.*?)\*\*/g, '$1');
    // Remove markdown bold for native share

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
       
        // Using alert for fallback, consider a custom modal in future
        alert("Failed to share content. Please try again.");
      });
    } else {
      // Using alert for fallback, consider a custom modal in future
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
            <span className="plus-icon">+</span> <span className="new-chat-text">New 
            Chat</span>
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
      </div>

      {/* Conditional overlay for mobile or when sidebar opened by click on desktop */}
      {(sidebarOpen && !sidebarOpenedByHover && window.innerWidth > 768) ||
      (sidebarOpen && window.innerWidth <= 768) ? (
        <div className="sidebar-overlay" onClick={toggleSidebar}></div>
      ) : null}


      {/* Main chat area */}
      <div className={`main-chat ${sidebarOpen ?
      'sidebar-shifted' : ''}`}>
        <div className="chat-header">
            {/* The primary toggle button for sidebar in the main chat header */}
            <button
                ref={toggleButtonRef} // Attach ref here
                onClick={toggleSidebar}
                className="header-toggle-sidebar-btn" 
                // New class for this button
                title={sidebarOpen ?
                "Collapse Sidebar" : "Expand Sidebar"}
            >
                {sidebarOpen ?
                (
                    // SVG for Left Arrow Icon (when sidebar is open)
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
         
                    </svg>
                ) : (
                    // SVG for Hamburger Icon (when sidebar is closed)
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
           
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
       
                )}
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
                  {/* Share Icon (SVG) */}
             
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                    <polyline points="16 6 12 2 8 6"></polyline>
                    <line x1="12" y1="2" x2="12" 
                    y2="15"></line>
                  </svg>
                  Share
              
              </button>
            </div>
        </div>

        <div className="chat-body" ref={chatBodyRef}>
      
          {messages.length === 0 && !isLoading && (
            <div className="initial-message">
              {/* Lottie animation increased size */}
      
              <Lottie animationData={AIAnimation} style={{ width: "10rem", height: "10rem" }} 
              />
              {/* Animated 
              initial text */}
              <div className={`initial-text-container ${initialTextVisible ?
              'visible' : ''}`}>
                <h1>Hi, I'm SANTRIX</h1>
                <h1>How can I help you today?</h1>
              </div>
            </div>
          )}

          {messages.map((msg, index) => (
          
            <div
              key={index}
              className={`chat-message ${msg.role === "user" ? "user" : msg.type === "pdf" ? "system" : "bot"}`}
            >
              <div className="message-content">
                {msg.type === "pdf" ? 
                (
          
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
                   
                    {/* --- MODIFIED: Display multiple files --- */}
                    {msg.fileNames && msg.fileNames.length > 0 && (
                      <div className="uploaded-files-display">
                        {msg.fileNames.map((fileName, fileIndex) => {
                          const isImage = msg.fileTypes[fileIndex]?.startsWith('image/');
                          const isVideo = msg.fileTypes[fileIndex]?.startsWith('video/');
                          const isDocument = !isImage && !isVideo;
                          return (
                            <div key={fileIndex} className={`file-item-display ${isImage ? 'image-only' : 'document-style'}`}>
                              {isImage ? (
                                <img
                                  src={msg.filePreviews[fileIndex]}
                                  alt={String(fileName)}
                                  className="small-left-image"
                                />
                              ) : isVideo ? (
                                <video
                                  src={msg.filePreviews[fileIndex]}
                                  controls
                                  className="small-left-image"
                                />
                              ) : (
                                <div className="document-file-display">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: 'middle', marginRight: '5px'}}>
                                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                                    <polyline points="13 2 13 9 20 9"></polyline>
                                  </svg>
                                  <span className="document-file-name">{String(fileName)}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
            {/* --- MODIFIED: Display multiple file previews with individual remove buttons --- */}
            {currentFiles.length > 0 && 
            (
              <div className="file-previews-container">
                {currentFiles.map((file, index) => {
                  const isImage = file.type.startsWith('image/');
                  const isVideo = file.type.startsWith('video/');
                  const isDocument = !isImage && !isVideo;
                  return (
                    <div key={index} className={`file-preview-item ${isImage ? 'file-preview-image' : 'file-preview-document'}`}>
                      {currentFilePreviews[index] && (isImage || isVideo) ? (
                        isImage ? (
                          <img src={currentFilePreviews[index]} alt="Preview" className="small-left-image" />
                        ) : (
                          <video src={currentFilePreviews[index]} controls className="small-left-image" />
                        )
                      ) : (
                        <div className="file-icon-wrapper">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                              <polyline points="13 2 13 9 20 9"></polyline>
                          </svg>
                          <div className="file-info-text">
                            <span className="file-name-display-text">{String(file.name)}</span>
                            <span className="file-type-label">Document</span> {/* Or derive from file.type */}
                          </div>
                        </div>
                      )}
                      <button onClick={() => removeIndividualFile(index)} className="remove-file-btn" title={`Remove ${file.name}`}>
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
    
            <textarea
            
            
            ref={messageInputRef} // Assign the ref to the textarea
              rows="1"
              placeholder={currentFiles.length > 0 ?
              `Add a message for ${currentFiles.length} file(s)...` : "Message Santrix..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isLoading}
            ></textarea>
            <button onClick={handleSubmit} disabled={isLoading ||
            (!input.trim() && currentFiles.length === 0)} className="send-button">
              {/* Send Icon (SVG) - Styled for black/white */}
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-send">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 
                22 2"></polygon>
 
              </svg>
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileChange}
 
            // --- MODIFIED: Add multiple attribute ---
            multiple
            // Updated accept attribute to include CSV and Excel MIME types
            accept="image/*, application/pdf, audio/*, video/*, text/plain, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
          {/* Santrix disclaimer text added here */}
     
          <p className="app-disclaimer-text">Santrix can make mistakes, so double-check it</p>
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
