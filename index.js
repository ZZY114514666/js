const TelegramBot = require('node-telegram-bot-api');

// === 配置（直接写死） ===
const BOT_TOKEN = '8496529637:AAHHlPkT5YuVYdRPvxdyqcvywQ_YnCb0THw';
const ADMIN_ID = 8348390173;

// 启动 Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// 用户会话映射 { userId: adminId / 目标用户Id }
const userMap = new Map();

// 所有用户集合（去重）
const users = new Set();

// /start 欢迎语
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    users.add(chatId);
    if (chatId === ADMIN_ID) {
        bot.sendMessage(chatId, "欢迎使用应才双向bot（管理员模式）。\n可使用 /sendall 群发消息。");
    } else {
        bot.sendMessage(chatId, "欢迎使用应才双向bot。口水哥滚");
    }
});

// 普通消息转发
bot.on('message', (msg) => {
    const chatId = msg.chat.id;

    // 过滤 /start
    if (msg.text && msg.text.startsWith('/')) return;

    users.add(chatId);

    if (chatId === ADMIN_ID) {
        // 管理员发消息时弹出按钮选择用户
        let userButtons = Array.from(users)
            .filter(u => u !== ADMIN_ID)
            .map(u => [{ text: `用户 ${u}`, callback_data: `sendto_${u}_${msg.message_id}` }]);

        if (userButtons.length === 0) {
            bot.sendMessage(chatId, "没有可发送的用户。");
            return;
        }

        bot.sendMessage(chatId, "请选择要发送消息的用户：", {
            reply_markup: { inline_keyboard: userButtons }
        });

    } else {
        // 普通用户的消息转发给管理员
        bot.forwardMessage(ADMIN_ID, chatId, msg.message_id);
        userMap.set(ADMIN_ID, chatId);
    }
});

// 处理按钮回调
bot.on('callback_query', (query) => {
    const [cmd, targetId, messageId] = query.data.split('_');
    if (cmd === 'sendto') {
        bot.forwardMessage(targetId, ADMIN_ID, messageId)
            .then(() => bot.answerCallbackQuery(query.id, { text: '已发送给指定用户' }))
            .catch(() => bot.answerCallbackQuery(query.id, { text: '发送失败' }));
    }
});

// 群发功能（管理员）
bot.onText(/\/sendall (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    if (chatId !== ADMIN_ID) return;

    const text = match[1];
    users.forEach(uid => {
        if (uid !== ADMIN_ID) {
            bot.sendMessage(uid, text);
        }
    });
    bot.sendMessage(chatId, "已群发。");
});
