// Chatbot Widget - להטמעה באתר יום כיף וeran-pro
(function() {
  const CHATBOT_API = '/.netlify/functions/chatbot-ai';
  
  // HTML Template
  const CHATBOT_HTML = `
    <div id="eran-chatbot-container" style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 380px;
      height: 600px;
      background: #0a0a12;
      border: 1px solid rgba(124,58,237,0.3);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(124,58,237,0.2);
      z-index: 10000;
      display: flex;
      flex-direction: column;
      font-family: 'Heebo', sans-serif;
      direction: rtl;
    ">
      <!-- Header -->
      <div style="
        padding: 16px;
        border-bottom: 1px solid rgba(124,58,237,0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #7c3aed, #2563eb);
      ">
        <h3 style="margin: 0; color: white; font-size: 16px;">עוזר אירועים 🎉</h3>
        <button id="eran-chatbot-close" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 20px;
        ">✕</button>
      </div>

      <!-- Messages -->
      <div id="eran-chatbot-messages" style="
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      "></div>

      <!-- Input -->
      <div style="
        padding: 12px;
        border-top: 1px solid rgba(124,58,237,0.2);
        display: flex;
        gap: 8px;
      ">
        <input 
          id="eran-chatbot-input" 
          type="text" 
          placeholder="שאל שאלה..." 
          style="
            flex: 1;
            background: #1a1a2e;
            border: 1px solid rgba(124,58,237,0.25);
            border-radius: 8px;
            color: #f0eeff;
            padding: 10px;
            font-family: 'Heebo', sans-serif;
            direction: rtl;
          "
        />
        <button id="eran-chatbot-send" style="
          background: #7c3aed;
          border: none;
          color: white;
          border-radius: 8px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: bold;
        ">שלח</button>
      </div>
    </div>

    <!-- Toggle Button (כשNUTH סגור) -->
    <div id="eran-chatbot-toggle" style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 16px rgba(124,58,237,0.4);
      z-index: 9999;
    ">
      💬
    </div>

    <style>
      #eran-chatbot-messages {
        scrollbar-width: thin;
        scrollbar-color: #7c3aed transparent;
      }
      #eran-chatbot-messages::-webkit-scrollbar {
        width: 6px;
      }
      #eran-chatbot-messages::-webkit-scrollbar-track {
        background: transparent;
      }
      #eran-chatbot-messages::-webkit-scrollbar-thumb {
        background: #7c3aed;
        border-radius: 3px;
      }
    </style>
  `;

  // Initialize
  window.initEranChatbot = function() {
    // Add HTML
    document.body.insertAdjacentHTML('beforeend', CHATBOT_HTML);

    // Add Font
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;600;700&display=swap';
    document.head.appendChild(link);

    // Variables
    const container = document.getElementById('eran-chatbot-container');
    const toggleBtn = document.getElementById('eran-chatbot-toggle');
    const closeBtn = document.getElementById('eran-chatbot-close');
    const input = document.getElementById('eran-chatbot-input');
    const sendBtn = document.getElementById('eran-chatbot-send');
    const messagesDiv = document.getElementById('eran-chatbot-messages');

    let isOpen = false;
    let conversationHistory = [];

    // Toggle
    function toggleChat() {
      isOpen = !isOpen;
      container.style.display = isOpen ? 'flex' : 'none';
      toggleBtn.style.display = isOpen ? 'none' : 'flex';
    }

    // Send message
    async function sendMessage() {
      const text = input.value.trim();
      if (!text) return;

      // Add user message
      addMessage(text, 'user');
      input.value = '';

      // Show typing
      addMessage('...', 'typing');

      try {
        const res = await fetch(CHATBOT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversationHistory,
          }),
        });

        if (!res.ok) throw new Error('שגיאה בשרת');
        const data = await res.json();

        // Remove typing
        const typingMsg = messagesDiv.querySelector('[data-typing="true"]');
        if (typingMsg) typingMsg.remove();

        // Add bot response
        addMessage(data.reply, 'bot');
        conversationHistory = data.conversation;
      } catch (err) {
        const typingMsg = messagesDiv.querySelector('[data-typing="true"]');
        if (typingMsg) typingMsg.remove();
        addMessage('מצטער, יש בעיה. נסה שוב.', 'bot');
      }
    }

    // Add message to DOM
    function addMessage(text, role) {
      const msgDiv = document.createElement('div');
      msgDiv.style.cssText = `
        padding: 10px 12px;
        border-radius: 8px;
        max-width: 90%;
        word-wrap: break-word;
        ${
          role === 'user'
            ? 'background: #7c3aed; color: white; align-self: flex-start;'
            : role === 'typing'
            ? 'background: #1a1a2e; color: #a78bfa; align-self: flex-end;'
            : 'background: #1a1a2e; color: #c4b5fd; align-self: flex-end;'
        }
      `;
      msgDiv.textContent = text;
      if (role === 'typing') msgDiv.setAttribute('data-typing', 'true');
      messagesDiv.appendChild(msgDiv);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    // Events
    toggleBtn.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Welcome message
    setTimeout(() => {
      if (isOpen === false) {
        toggleChat();
        addMessage('שלום! 👋 אני כאן כדי לעזור בתכנון האירוע שלך. מה בדעתך?', 'bot');
      }
    }, 1000);
  };

  // Auto-initialize if DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initEranChatbot);
  } else {
    window.initEranChatbot();
  }
})();