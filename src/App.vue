<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from 'vue';
import { io, Socket } from 'socket.io-client';
import { FileText, Users, Wifi, WifiOff, Plus, Hash, Sparkles } from 'lucide-vue-next';

const DOCUMENTS = ['welcome', 'meeting-notes', 'project-ideas', 'shopping-list'];

const socket = ref<Socket | null>(null);
const documentId = ref('welcome');
const content = ref('');
const isConnected = ref(false);
const onlineUsers = ref(1);
const isSomeoneTyping = ref(false);
const isAiTyping = ref(false);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const typingTimeoutRef = ref<ReturnType<typeof setTimeout> | null>(null);

const documentTitle = computed(() => documentId.value.replace('-', ' '));
const wordCount = computed(() => content.value.trim() ? content.value.trim().split(/\s+/).length : 0);

const joinDocument = (id: string) => {
  if (!socket.value) return;

  // Cleanup old listeners if any
  socket.value.off('load-document');
  socket.value.off('receive-changes');
  socket.value.off('user-count');
  socket.value.off('user-typing');
  socket.value.off('ai-typing');

  socket.value.emit('join-document', id);

  socket.value.on('load-document', (loadedContent: string) => {
    content.value = loadedContent;
  });

  socket.value.on('user-count', (count: number) => {
    onlineUsers.value = count;
  });

  socket.value.on('user-typing', (isTyping: boolean) => {
    isSomeoneTyping.value = isTyping;
  });

  socket.value.on('ai-typing', (isTyping: boolean) => {
    isAiTyping.value = isTyping;
  });

  socket.value.on('receive-changes', async (newContent: string) => {
    const textarea = textareaRef.value;
    const start = textarea?.selectionStart;
    const end = textarea?.selectionEnd;

    content.value = newContent;

    await nextTick();
    if (textarea && start !== undefined && end !== undefined && start !== null) {
      textarea.setSelectionRange(start, end);
    }
  });
};

onMounted(() => {
  const newSocket = io();
  socket.value = newSocket;

  newSocket.on('connect', () => {
    isConnected.value = true;
  });

  newSocket.on('disconnect', () => {
    isConnected.value = false;
  });

  // Join initial document
  joinDocument(documentId.value);
});

onUnmounted(() => {
  if (socket.value) {
    socket.value.close();
  }
});

watch(documentId, (newId) => {
  joinDocument(newId);
});

const changeDocument = (id: string) => {
  documentId.value = id;
};

const handleAiComplete = () => {
  if (socket.value && content.value.trim() !== '' && !isAiTyping.value) {
    socket.value.emit('ai-autocomplete', { documentId: documentId.value, content: content.value });
  }
};

const handleContentChange = () => {
  if (socket.value) {
    socket.value.emit('send-changes', { documentId: documentId.value, content: content.value });
    
    socket.value.emit('typing', { documentId: documentId.value, isTyping: true });
    
    if (typingTimeoutRef.value) {
      clearTimeout(typingTimeoutRef.value);
    }
    
    typingTimeoutRef.value = setTimeout(() => {
      if(socket.value) socket.value.emit('typing', { documentId: documentId.value, isTyping: false });
    }, 2000);
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#F9FBFD] text-[#1A1C1E] font-sans flex flex-col">
    <!-- Header -->
    <header class="h-16 bg-white border-b border-[#E1E2E4] px-6 flex items-center justify-between sticky top-0 z-10">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
          <FileText class="text-white w-6 h-6" />
        </div>
        <div>
          <h1 class="text-lg font-semibold leading-tight flex items-center gap-2">
            CollabDocs Lite
            <span class="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Beta</span>
          </h1>
          <p class="text-xs text-gray-500">Real-time collaborative editing</p>
        </div>
      </div>

      <div class="flex items-center gap-6">
        <Transition name="fade">
          <div v-if="isSomeoneTyping" class="flex items-center gap-2 text-xs text-blue-500 font-medium bg-blue-50 px-2 py-1 rounded border border-blue-100">
            <div class="flex gap-0.5">
              <span class="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
              <span class="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
              <span class="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
            </div>
            Someone is typing...
          </div>
        </Transition>

        <Transition name="fade">
          <div v-if="isAiTyping" class="flex items-center gap-2 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-1 rounded border border-purple-100">
            <Sparkles class="w-3.5 h-3.5 animate-pulse" />
            AI is thinking...
          </div>
        </Transition>

        <div class="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
          <Users class="w-4 h-4 text-blue-500" />
          <span class="font-medium">{{ onlineUsers }} online</span>
        </div>
        
        <div class="flex items-center gap-2">
          <div v-if="isConnected" class="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
            <Wifi class="w-4 h-4" />
            <span>Connected</span>
          </div>
          <div v-else class="flex items-center gap-1.5 text-rose-600 text-sm font-medium">
            <WifiOff class="w-4 h-4" />
            <span>Disconnected</span>
          </div>
        </div>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <aside class="w-64 bg-white border-r border-[#E1E2E4] flex flex-col">
        <div class="p-4 border-b border-[#E1E2E4]">
          <button class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors text-sm font-medium shadow-sm">
            <Plus class="w-4 h-4" />
            New Document
          </button>
        </div>
        
        <nav class="flex-1 overflow-y-auto p-2 space-y-1">
          <p class="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent Documents</p>
          <button
            v-for="doc in DOCUMENTS"
            :key="doc"
            @click="changeDocument(doc)"
            :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all', documentId === doc ? 'bg-blue-50 text-blue-700 font-medium border border-blue-100' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900']"
          >
            <Hash :class="['w-4 h-4', documentId === doc ? 'text-blue-500' : 'text-gray-400']" />
            <span class="truncate capitalize">{{ doc.replace("-", " ") }}</span>
          </button>
        </nav>
        
        <div class="p-4 bg-gray-50 border-t border-[#E1E2E4]">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
              U
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-gray-900 truncate">You (Anonymous)</p>
              <p class="text-[10px] text-gray-500 truncate">Editing {{ documentId }}</p>
            </div>
          </div>
        </div>
      </aside>

      <!-- Editor Area -->
      <main class="flex-1 flex flex-col bg-white relative">
        <div class="absolute inset-0 p-8 md:p-12 lg:p-16 overflow-y-auto">
          <div class="max-w-3xl mx-auto min-h-full flex flex-col fade-in relative" :key="documentId">
            <div class="flex-1 flex flex-col h-full">
              <div class="mb-8 flex items-center justify-between">
                <div class="flex-1">
                  <input
                    type="text"
                    :value="documentTitle"
                    readonly
                    class="text-4xl font-bold text-gray-900 bg-transparent border-none focus:outline-none w-full capitalize placeholder-gray-300"
                  />
                  <div class="h-1 w-20 bg-blue-500 mt-2 rounded-full"></div>
                </div>
                
                <button
                  @click="handleAiComplete"
                  :disabled="isAiTyping || content.trim() === ''"
                  :class="['flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm', isAiTyping || content.trim() === '' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white hover:shadow-md']"
                >
                  <Sparkles class="w-4 h-4" />
                  AI Autocomplete
                </button>
              </div>

              <textarea
                ref="textareaRef"
                v-model="content"
                @input="handleContentChange"
                placeholder="Start typing your notes here..."
                class="flex-1 w-full text-lg leading-relaxed text-gray-700 bg-transparent border-none focus:outline-none resize-none min-h-[500px] placeholder-gray-300"
                :spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>
        
        <!-- Footer Status -->
        <div class="h-8 bg-white border-t border-[#E1E2E4] px-4 flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-widest absolute bottom-0 w-full z-10">
          <div class="flex items-center gap-4">
            <span>Characters: {{ content.length }}</span>
            <span>Words: {{ wordCount }}</span>
          </div>
          <div class="flex items-center gap-2">
            <div :class="['w-1.5 h-1.5 rounded-full', isConnected ? 'bg-emerald-500' : 'bg-rose-500']"></div>
            <span>{{ isConnected ? "Live Sync Active" : "Offline Mode" }}</span>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
.fade-in {
  animation: fadeIn 0.3s ease-in-out;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
