const { route } = require("../utils/http");
const notifications = require("../services/notificationService");

module.exports = {
  getNotifications: route(notifications.getNotifications),
  getUnreadCount: route(notifications.getUnreadCount),
  markAsRead: route(notifications.markAsRead),
  markAllAsRead: route(notifications.markAllAsRead),
  markMatchAsRead: route(notifications.markMatchAsRead),
};
