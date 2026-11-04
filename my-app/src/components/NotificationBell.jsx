import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import { authHeader } from "../utils/auth";
import { useTranslation } from "react-i18next";
import { locale } from "../i18n";

const POLL_INTERVAL = 30000;

function NotificationBell({ userId }) {
  const { t } = useTranslation();

  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const boxRef = useRef(null);

  const loadUnread = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/${userId}/unread`,
        { headers: authHeader() }
      );

      const data = await res.json();

      if (data.success) {
        setUnread(data.count);
      }

    } catch (error) {
      console.error(error);
    }
  };

  const loadNotifications = async () => {
    try {
      const res = await fetch(
        `${API_URL}/api/notifications/${userId}`,
        { headers: authHeader() }
      );

      const data = await res.json();

      if (data.success) {
        setNotifications(data.notifications);
      }

    } catch (error) {
      console.error(error);
    }
  };

  // Broj nepročitanih proveravamo periodično
  useEffect(() => {
    loadUnread();

    const interval = setInterval(loadUnread, POLL_INTERVAL);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Klik van prozora ga zatvara
  useEffect(() => {
    if (!open) return;

    const handleClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggle = () => {
    if (!open) {
      loadNotifications();
    }

    setOpen(!open);
  };

  const openNotification = async (notification) => {
    await markAsRead(notification);

    // Notifikacija vezana za termin (ili teren) vodi na njegovu stranicu,
    // a o rezervaciji na stranicu rezervacija
    if (notification.match_id) {
      setOpen(false);
      navigate(`/matches/${notification.match_id}`);
    } else if (notification.tournament_id) {
      setOpen(false);
      navigate(`/turniri/${notification.tournament_id}`);
    } else if (notification.reservation_id) {
      setOpen(false);
      navigate("/rezervacije");
    } else if (notification.venue_id) {
      setOpen(false);
      navigate(`/tereni/${notification.venue_id}`);
    }
  };

  const markAsRead = async (notification) => {
    if (notification.is_read) return;

    try {
      await fetch(
        `${API_URL}/api/notifications/read/${notification.id}`,
        {
          method: "PUT",
          headers: authHeader(),
        }
      );

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notification.id ? { ...n, is_read: true } : n
        )
      );

      setUnread((prev) => Math.max(0, prev - 1));

    } catch (error) {
      console.error(error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(
        `${API_URL}/api/notifications/${userId}/read-all`,
        {
          method: "PUT",
          headers: authHeader(),
        }
      );

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );

      setUnread(0);

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={toggle}
        className="relative p-2 rounded-full hover:bg-gray-100"
        aria-label={t("notificationBell.notifications")}
      >
        <Bell size={22} />

        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl border z-50">

          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-bold">
              {t("notificationBell.notifications")}
            </h3>

            {unread > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-green-600 hover:underline"
              >
                {t("notificationBell.markAllAsRead")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-center text-gray-500">
                {t("notificationBell.noNotifications")}
              </p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openNotification(n)}
                  className={`block w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 ${
                    n.is_read ? "text-gray-500" : "bg-green-50 font-semibold"
                  }`}
                >
                  <p>{n.message}</p>

                  <p className="text-xs text-gray-400 mt-1 font-normal">
                    {new Date(n.created_at).toLocaleString(locale())}
                  </p>
                </button>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}

export default NotificationBell;
