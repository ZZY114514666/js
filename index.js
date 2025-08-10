// index.js
const TelegramBot = require('node-telegram-bot-api');

// === 你提供的 token & admin id（开发快速版：已写死） ===
const BOT_TOKEN = "8496529637:AAHHlPkT5YuVYdRPvxdyqcvywQ_YnCb0THw";
const ADMIN_ID = Number("8348390173");
// =========================================================

if (!BOT_TOKEN || !ADMIN_ID) {
  console.error("请设置 BOT_TOKEN 和 ADMIN_ID");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// mapping: admin_copied_message_id -> original_user_chat_id
const adminMsgToUser = new Map();

// Optional: last active user for admin (fallback)
let lastActiveUserForAdmin = null;

console.log("Bot starting...");

// 当任意用户（非管理员）发送消息 -> 复制到管理员，记录映射
bot.on('message', async (msg) => {
  try {
    const chatId = msg.chat.id;

    // Ignore service messages or channel posts
    if (!msg.from) return;

    // If sender is admin
    if (chatId === ADMIN_ID) {
      // If admin replies to a copied message -> route to original user
      if (msg.reply_to_message) {
        const repliedId = msg.reply_to_message.message_id;
        const target = adminMsgToUser.get(repliedId) || lastActiveUserForAdmin;
        if (target) {
          // copy admin message back to user
          await bot.copyMessage(target, ADMIN_ID, msg.message_id).catch((e) => {
            console.error("copy admin->user error:", e);
          });
        } else {
          // allow /to command handling below or notify admin
          if (msg.text && msg.text.startsWith('/to ')) {
            // handled later by command parser
          } else {
            bot.sendMessage(ADMIN_ID, "未找到目标用户（回复的消息未映射到任何用户）。");
          }
        }
      } else if (msg.text && msg.text.startsWith('/to ')) {
        // /to <user_id> <message>
        const parts = msg.text.split(' ');
        const targetId = Number(parts[1]);
        const text = parts.slice(2).join(' ');
        if (targetId && text) {
          await bot.sendMessage(targetId, text).catch((e) => {
            console.error("send /to error:", e);
            bot.sendMessage(ADMIN_ID, "发送失败：" + (e.message || e));
          });
        } else {
          bot.sendMessage(ADMIN_ID, "格式：/to <user_id> <文本>");
        }
      } else {
        // admin plain message without reply: optionally send help
        // do nothing
      }
      return;
    }

    // Normal user path
    // Save as last active for admin
    lastActiveUserForAdmin = chatId;

    // Copy the incoming message into admin's chat.
    // copyMessage returns a Promise resolving to the sent message (contains message_id)
    const copied = await bot.copyMessage(ADMIN_ID, chatId, msg.message_id);
    if (copied && copied.message_id) {
      // Map the copied admin-side message id -> original user id
      adminMsgToUser.set(copied.message_id, chatId);
      // Optional: cleanup mapping after some time to avoid memory growth
      setTimeout(() => {
        adminMsgToUser.delete(copied.message_id);
      }, 1000 * 60 * 60); // 1 hour
    }
  } catch (err) {
    console.error("on message error:", err);
  }
});
