import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { authHeader } from "../utils/auth";
import { API_URL } from "../config";
import { useTranslation } from "react-i18next";
import { locale } from "../i18n";

const POLL_INTERVAL = 3000;

function MatchChat({ matchId, canWrite, linkKey = null }) {
  const { t } = useTranslation();

  const user = JSON.parse(localStorage.getItem("user"));

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const lastIdRef = useRef(0);
  const listRef = useRef(null);

  // Učitavamo samo poruke novije od poslednje koju imamo
  const loadMessages = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/matches/${matchId}/messages?after=${lastIdRef.current}${
          linkKey ? `&key=${encodeURIComponent(linkKey)}` : ""
        }`,
        { headers: authHeader() }
      );

      const data = await res.json();

      if (data.success && data.messages.length > 0) {
        lastIdRef.current = Math.max(
          lastIdRef.current,
          data.messages[data.messages.length - 1].id
        );

        // Dva zahteva mogu da se preklope, pa preskačemo poruke koje već imamo
        setMessages((prev) => {
          const lastId = prev.length ? prev[prev.length - 1].id : 0;
          return [...prev, ...data.messages.filter((m) => m.id > lastId)];
        });
      }

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadMessages();

    const interval = setInterval(loadMessages, POLL_INTERVAL);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  useEffect(() => {
    // Skrolujemo samo listu poruka, ne celu stranicu
    const list = listRef.current;

    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!text.trim() || sending) return;

    setSending(true);

    try {
      const res = await fetch(
        `${API_URL}/api/matches/${matchId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(),
          },
          body: JSON.stringify({
            user_id: user.id,
            message: text,
          }),
        }
      );

      const data = await res.json();

      if (data.success) {
        setText("");
        loadMessages();
      } else {
        alert(data.message);
      }

    } catch (error) {
      console.error(error);
      alert(t("matchChat.couldNotSendTheMessage"));
    } finally {
      setSending(false);
    }
  };

  return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col h-[32rem]">

        <div className="p-4 border-b">
          <h2 className="text-2xl font-bold">
            {t("matchChat.gameChat")}
          </h2>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-gray-500">
              {t("matchChat.noMessagesYet")}
            </p>
          )}

          {messages.map((msg) => {
            const mine = msg.user_id === user?.id;

            return (
              <div
                key={msg.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    mine
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {!mine && (
                    <p className="text-xs font-bold text-green-700">
                      {msg.name}
                    </p>
                  )}

                  <p className="break-words whitespace-pre-wrap">
                    {msg.message}
                  </p>

                  <p
                    className={`text-xs mt-1 ${
                      mine ? "text-green-100" : "text-gray-500"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString(locale(), {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {canWrite ? (
          <form
            onSubmit={sendMessage}
            className="flex gap-2 p-4 border-t"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              placeholder={t("matchChat.writeAMessage")}
              className="flex-1 border rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-600"
            />

            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-xl px-4"
            >
              <Send size={20} />
            </button>
          </form>
        ) : (
          <p className="p-4 border-t text-center text-gray-500 text-sm">
            {t("matchChat.joinTheGameToWrite")}
          </p>
        )}

      </div>
  );
}

export default MatchChat;
