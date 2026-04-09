import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = 3000;

  // In-memory store for documents
  // In a real app, this would be a database
  const documents: Record<string, string> = {
    "welcome": "# Welcome to CollabDocs Lite\n\nThis is a real-time collaborative editor. Share the URL with others to edit together!",
  };

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-document", (documentId: string) => {
      socket.join(documentId);
      console.log(`User ${socket.id} joined document: ${documentId}`);
      
      // Update and broadcast user count for this room
      const room = io.sockets.adapter.rooms.get(documentId);
      const count = room ? room.size : 0;
      io.to(documentId).emit("user-count", count);
      
      // Send initial content
      const content = documents[documentId] || "";
      socket.emit("load-document", content);
    });

    socket.on("disconnecting", () => {
      // Broadcast updated user count to all rooms this socket was in
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          const roomObj = io.sockets.adapter.rooms.get(room);
          const count = roomObj ? roomObj.size - 1 : 0;
          io.to(room).emit("user-count", count);
        }
      });
    });

    socket.on("send-changes", ({ documentId, content }: { documentId: string; content: string }) => {
      documents[documentId] = content;
      // Broadcast to everyone else in the room
      socket.to(documentId).emit("receive-changes", content);
    });

    socket.on("typing", ({ documentId, isTyping }: { documentId: string; isTyping: boolean }) => {
      socket.to(documentId).emit("user-typing", isTyping);
    });

    socket.on("ai-autocomplete", async ({ documentId, content }: { documentId: string; content: string }) => {
      if (!ai) return;
      try {
        io.to(documentId).emit("ai-typing", true);
        const prompt = `Continue the following document text naturally and seamlessly. Only provide the continuation, nothing else. Do not repeat the existing text. Keep it concise.\n\nText:\n${content}\n\nContinuation:`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        if (response.text) {
            // Append generated text
            const newContent = documents[documentId] + response.text;
            documents[documentId] = newContent;
            io.to(documentId).emit("receive-changes", newContent);
        }
      } catch (error) {
        console.error("AI Generation Error:", error);
      } finally {
        io.to(documentId).emit("ai-typing", false);
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
