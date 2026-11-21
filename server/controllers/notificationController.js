const { route } = require("../utils/http");
const notifications = require("../services/notificationService");
const push = require("../services/pushService");

module.exports = {
  getNotifications: route(notifications.getNotifications),
  getUnreadCount: route(notifications.getUnreadCount),
  markAsRead: route(notifications.markAsRead),
  markAllAsRead: route(notifications.markAllAsRead),
  markMatchAsRead: route(notifications.markMatchAsRead),
  getPushKey: route(push.getPublicKey),
  subscribePush: route(push.subscribe),
  unsubscribePush: route(push.unsubscribe),
};
