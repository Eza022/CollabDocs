import { useState, useEffect, useCallback, useRef, ChangeEvent } from "react";
import { io, Socket } from "socket.io-client";
import { FileText, Users, Wifi, WifiOff, Plus, Hash, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const DOCUMENTS = ["welcome", "meeting-notes", "project-ideas", "shopping-list"];

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [documentId, setDocumentId] = useState("welcome");
  const [content, setContent] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(1);
  const [isSomeoneTyping, setIsSomeoneTyping] = useState(false);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Join document room
  useEffect(() => {
    if (!socket) return;

    socket.emit("join-document", documentId);

    socket.on("load-document", (loadedContent: string) => {
      setContent(loadedContent);
    });

    socket.on("user-count", (count: number) => {
      setOnlineUsers(count);
    });

    socket.on("user-typing", (isTyping: boolean) => {
      setIsSomeoneTyping(isTyping);
    });

    socket.on("ai-typing", (isTyping: boolean) => {
      setIsAiTyping(isTyping);
    });

    socket.on("receive-changes", (newContent: string) => {
      // Preserve cursor position if possible
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart;
      const end = textarea?.selectionEnd;

      setContent(newContent);

      // Restore cursor position after state update
      setTimeout(() => {
        if (textarea && start !== undefined && end !== undefined) {
          textarea.setSelectionRange(start, end);
        }
      }, 0);
    });

    return () => {
      socket.off("load-document");
      socket.off("receive-changes");
      socket.off("user-count");
      socket.off("user-typing");
      socket.off("ai-typing");
    };
  }, [socket, documentId]);

  const handleAiComplete = () => {
    if (socket && content.trim() !== "" && !isAiTyping) {
      socket.emit("ai-autocomplete", { documentId, content });
    }
  };

  const handleContentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    if (socket) {
      socket.emit("send-changes", { documentId, content: newContent });
      
      // Handle typing status
      socket.emit("typing", { documentId, isTyping: true });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("typing", { documentId, isTyping: false });
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FBFD] text-[#1A1C1E] font-sans flex flex-col">
      {/* Header */}
      <header className="h-16 bg-white border-b border-[#E1E2E4] px-6 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
            <FileText className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight flex items-center gap-2">
              CollabDocs Lite
              <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Beta</span>
            </h1>
            <p className="text-xs text-gray-500">Real-time collaborative editing</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <AnimatePresence>
            {isSomeoneTyping && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2 text-xs text-blue-500 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100"
              >
                <div className="flex gap-0.5">
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
                Someone is typing...
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isAiTyping && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex items-center gap-2 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded border border-purple-100"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                AI is thinking...
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{onlineUsers} online</span>
          </div>
          
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                <Wifi className="w-4 h-4" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-rose-600 text-sm font-medium">
                <WifiOff className="w-4 h-4" />
                <span>Disconnected</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-[#E1E2E4] flex flex-col">
          <div className="p-4 border-b border-[#E1E2E4]">
            <button className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium shadow-sm">
              <Plus className="w-4 h-4" />
              New Document
            </button>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            <p className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Documents</p>
            {DOCUMENTS.map((doc) => (
              <button
                key={doc}
                onClick={() => setDocumentId(doc)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  documentId === doc
                    ? "bg-blue-50 text-blue-700 font-medium border border-blue-100"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <Hash className={`w-4 h-4 ${documentId === doc ? "text-blue-500" : "text-gray-400"}`} />
                <span className="truncate capitalize">{doc.replace("-", " ")}</span>
              </button>
            ))}
          </nav>
          
          <div className="p-4 bg-gray-50 border-t border-[#E1E2E4]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                U
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">You (Anonymous)</p>
                <p className="text-[10px] text-gray-500 truncate">Editing {documentId}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Editor Area */}
        <main className="flex-1 flex flex-col bg-white relative">
          <div className="absolute inset-0 p-8 md:p-12 lg:p-16 overflow-y-auto">
            <div className="max-w-3xl mx-auto min-h-full flex flex-col">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={documentId}
                className="flex-1 flex flex-col"
              >
                <div className="mb-8 flex items-center justify-between">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={documentId.replace("-", " ")}
                      readOnly
                      className="text-4xl font-bold text-gray-900 bg-transparent border-none focus:outline-none w-full capitalize placeholder-gray-300"
                    />
                    <div className="h-1 w-20 bg-blue-500 mt-2 rounded-full"></div>
                  </div>
                  
                  <button
                    onClick={handleAiComplete}
                    disabled={isAiTyping || content.trim() === ""}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                      isAiTyping || content.trim() === ""
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700 text-white hover:shadow-md"
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Autocomplete
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  placeholder="Start typing your notes here..."
                  className="flex-1 w-full text-lg leading-relaxed text-gray-700 bg-transparent border-none focus:outline-none resize-none min-h-[500px] placeholder-gray-300"
                  spellCheck={false}
                />
              </motion.div>
            </div>
          </div>
          
          {/* Footer Status */}
          <div className="h-8 bg-white border-t border-[#E1E2E4] px-4 flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-widest">
            <div className="flex items-center gap-4">
              <span>Characters: {content.length}</span>
              <span>Words: {content.trim() ? content.trim().split(/\s+/).length : 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`}></div>
              <span>{isConnected ? "Live Sync Active" : "Offline Mode"}</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
