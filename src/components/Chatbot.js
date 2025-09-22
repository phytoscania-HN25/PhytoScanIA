import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, X } from 'lucide-react';
import { askGemini } from "../api/geminiClient.js"; // IA Gemini

// Paleta (acentos)
const ACCENT_CYAN = "#017a9c";
const NAVY = "#114158";
const NEUTRAL = "#818182";
const GREEN = "#1bbd74";
const LIGHT_TEXT = "#0f151c";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = { sender: 'user', text: message.trim() };
    setChatHistory((prev) => [...prev, userMessage]);
    setMessage('');
    setIsTyping(true);

    try {
      const aiResponse = await askGemini(
        `Eres PhytoBot, un asistente agrícola experto en frijol.
         Responde en español con consejos claros, prácticos y breves.
         Pregunta del usuario: ${userMessage.text}`
      );

      setChatHistory((prev) => [...prev, { sender: 'bot', text: aiResponse }]);
    } catch (error) {
      console.error("Error Gemini:", error);
      setChatHistory((prev) => [
        ...prev,
        { sender: 'bot', text: "⚠️ No pude conectar con la IA en este momento." }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      <motion.button
        className="fixed bottom-20 right-8 z-50 p-4 rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300"
        style={{ backgroundColor: ACCENT_CYAN, color: "#fff", border: "2px solid rgba(17,65,88,0.25)" }}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label={isOpen ? "Cerrar PhytoBot" : "Abrir PhytoBot"}
      >
        {isOpen ? <X size={28} /> : <Bot size={28} />}
      </motion.button>

      {/* Ventana del chat */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed bottom-36 right-8 w-80 h-96 rounded-3xl shadow-2xl flex flex-col z-40 backdrop-blur-xl"
            style={{
              background: "rgba(255,255,255,0.95)",
              border: `1px solid ${NAVY}20`
            }}
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
          >
            {/* Encabezado */}
            <div
              className="p-4 rounded-t-3xl flex items-center justify-between"
              style={{
                background: `linear-gradient(90deg, ${NAVY} 0%, ${ACCENT_CYAN} 100%)`,
                color: "#e6e3e0"
              }}
            >
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bot size={20} style={{ color: GREEN }} />
                PhytoBot
              </h3>
              <button onClick={() => setIsOpen(false)} className="hover:opacity-80">
                <X size={20} />
              </button>
            </div>

            {/* Mensajes */}
            <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto">
              {chatHistory.length === 0 && (
                <div className="text-center mt-10" style={{ color: NEUTRAL }}>
                  <Bot size={40} className="mx-auto mb-2" style={{ color: ACCENT_CYAN }} />
                  <p>
                    👋 ¡Hola! Soy <span style={{ color: GREEN, fontWeight: 700 }}>PhytoBot</span>. ¿En qué puedo ayudarte hoy?
                  </p>
                </div>
              )}

              {chatHistory.map((msg, idx) => (
                <motion.div
                  key={idx}
                  className={`flex mb-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className={`max-w-[75%] p-3 rounded-xl shadow-sm ${
                      msg.sender === 'user'
                        ? 'text-white rounded-br-none'
                        : 'rounded-bl-none'
                    }`}
                    style={
                      msg.sender === 'user'
                        ? { backgroundColor: ACCENT_CYAN }
                        : { backgroundColor: "#f3f4f6", color: LIGHT_TEXT, border: `1px solid ${NAVY}15` }
                    }
                  >
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div
                  className="flex justify-start mb-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    className="p-3 rounded-xl rounded-bl-none"
                    style={{ backgroundColor: "#f3f4f6", color: LIGHT_TEXT, border: `1px solid ${NAVY}15` }}
                  >
                    <div className="flex space-x-1">
                      {[0, 0.2, 0.4].map((d, i) => (
                        <motion.span
                          key={i}
                          animate={{ y: [0, -2, 0] }}
                          transition={{ repeat: Infinity, duration: 0.6, delay: d }}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: NEUTRAL }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t flex gap-2" style={{ borderColor: `${NAVY}20` }}>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Escribe tu mensaje..."
                className="flex-1 px-4 py-2 rounded-xl transition-all duration-200"
                style={{
                  backgroundColor: "#ffffff",
                  color: LIGHT_TEXT,
                  border: `1px solid ${NAVY}20`,
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.boxShadow = `0 0 0 3px ${ACCENT_CYAN}30`)}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
                disabled={isTyping}
              />
              <motion.button
                type="submit"
                className="px-3 py-2 rounded-xl text-white transition-colors"
                style={{ backgroundColor: GREEN }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isTyping || !message.trim()}
                aria-label="Enviar mensaje"
              >
                <Send size={20} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Chatbot;
