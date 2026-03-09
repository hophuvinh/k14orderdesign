// ============================================================
//  index.js — entry point
// ============================================================
const TelegramBot = require('node-telegram-bot-api');
const express     = require('express');
const db          = require('./db');
const handlers    = require('./handlers');

// Validate env
['BOT_TOKEN','SUPABASE_URL','SUPABASE_KEY','GROUP_DESIGN_ID'].forEach(k => {
  if (!process.env[k]) { console.error(`❌ Thiếu ${k} trong environment variables!`); process.exit(1); }
});

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log('🤖 Design Order Bot đang chạy...');

// ── ROUTE TIN NHẮN ────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!msg.text) return;
  const text = msg.text.trim();
  const ctx  = buildCtx(bot, msg);
  try {
    if (await handlers.handlePendingFlow(ctx, text)) return;
    const cmd = text.split(/\s+/)[0].toLowerCase().replace(/@\w+/, '');
    switch (cmd) {
      case '/order':      handlers.cmdOrder(ctx, text); break;
      case '/xong':       handlers.cmdDone(ctx, text); break;
      case '/publish':
      case '/xacnhan':    handlers.cmdPublish(ctx, text); break;
      case '/them_sp':    handlers.cmdAddProduct(ctx, text); break;
      case '/sua_gia':    handlers.cmdUpdatePrice(ctx, text); break;
      case '/xoa_sp':     handlers.cmdDeleteProduct(ctx, text); break;
      case '/san_pham':
      case '/gia':        handlers.cmdListProducts(ctx); break;
      case '/mytasks':    handlers.cmdMyOrders(ctx); break;
      case '/order_info': handlers.cmdOrderInfo(ctx, text); break;
      case '/start':
      case '/help':       handlers.cmdHelp(ctx); break;
    }
  } catch (err) {
    console.error('Message handler error:', err);
    ctx.send('⚠️ Có lỗi xảy ra, thử lại sau.');
  }
});

// ── ROUTE CALLBACK ────────────────────────────────────────────
bot.on('callback_query', async (q) => {
  const ctx = buildCtxCB(bot, q);
  const [action, ...args] = q.data.split(':');
  try {
    switch (action) {
      case 'ACCEPT':          handlers.cbAccept(ctx, q, args[0]); break;
      case 'INFO':            handlers.cbInfo(ctx, q, args[0]); break;
      case 'CONFIRM_PUBLISH': handlers.cbConfirmPublish(ctx, q, args[0]); break;
      case 'ADD_SP':          handlers.cbAddProduct(ctx, q, args[0], args[1], args[2]); break;
      case 'DONE_SP':         handlers.cbDoneProducts(ctx, q, args[0], args[1]); break;
      case 'CANCEL_SP':       handlers.cbCancelProducts(ctx, q, args[0]); break;
      default: bot.answerCallbackQuery(q.id); break;
    }
  } catch (err) {
    console.error('Callback error:', err);
    bot.answerCallbackQuery(q.id, { text: '⚠️ Lỗi, thử lại sau.', show_alert: true });
  }
});

bot.on('polling_error', (err) => console.error('Polling error:', err.message));

// ── EXPRESS (Railway cần có HTTP server) ─────────────────────
const app = express();
app.get('/', (req, res) => res.send('🤖 Design Order Bot is running!'));
app.listen(process.env.PORT || 3000, () => console.log('HTTP server ready'));

// ── BUILD CONTEXT ─────────────────────────────────────────────
function buildCtx(bot, msg) {
  const send = (text, extra = {}) => bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML', ...extra });
  return {
    bot,
    chatId: msg.chat.id.toString(),
    user:   { id: msg.from.id.toString(), name: getFullName(msg.from) },
    send,
    sendTo: (chatId, text, extra = {}) => bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra }),
  };
}

function buildCtxCB(bot, q) {
  return {
    bot,
    chatId: q.message.chat.id.toString(),
    msgId:  q.message.message_id,
    user:   { id: q.from.id.toString(), name: getFullName(q.from) },
    send:   (text, extra = {}) => bot.sendMessage(q.message.chat.id, text, { parse_mode: 'HTML', ...extra }),
    sendTo: (chatId, text, extra = {}) => bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra }),
    edit:   (text, extra = {}) => bot.editMessageText(text, { chat_id: q.message.chat.id, message_id: q.message.message_id, parse_mode: 'HTML', ...extra }),
    answer: (text = '', alert = false) => bot.answerCallbackQuery(q.id, { text, show_alert: alert }),
  };
}

function getFullName(from) {
  return from.first_name + (from.last_name ? ' ' + from.last_name : '');
}
