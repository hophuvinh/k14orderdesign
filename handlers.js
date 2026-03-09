// ============================================================
//  handlers.js — toàn bộ logic bot
// ============================================================
const db = require('./db');

const GROUP_DESIGN_ID = process.env.GROUP_DESIGN_ID;
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim());

function isAdmin(userId) { return ADMIN_IDS.includes(userId.toString()); }
function fmt(n) { return Number(n).toLocaleString('vi-VN'); }

// ── /help ─────────────────────────────────────────────────────
function cmdHelp(ctx) {
  const adminBlock = isAdmin(ctx.user.id)
    ? `\n<b>── Admin ──</b>\n/them_sp [tên] [giá] — Thêm loại sản phẩm\n/sua_gia [tên] [giá mới] — Sửa đơn giá\n/xoa_sp [tên] — Xóa loại sản phẩm\n/san_pham — Danh sách &amp; đơn giá`
    : '';
  ctx.send(
    `🤖 <b>Design Order Bot</b>\n\n` +
    `<b>── Người order ──</b>\n/order [nội dung] — Tạo order mới\n/order_info [ID] — Xem chi tiết\n\n` +
    `<b>── Designer ──</b>\n/xong [ORDER_ID] [link] — Báo hoàn thành phần của mình\n/mytasks — Xem order đang nhận\n\n` +
    `<b>── Biên tập viên ──</b>\n/publish [ORDER_ID] [link bài] — Xác nhận đăng bài\n/xacnhan [ORDER_ID] — Xác nhận không cần link` +
    adminBlock
  );
}

// ── /order ────────────────────────────────────────────────────
async function cmdOrder(ctx, text) {
  const content = text.replace(/^\/order\s*/i, '').trim();
  if (!content) {
    ctx.send('⚠️ Nhập nội dung order.\nVD: <code>/order Banner homepage 8/3, deadline 7/3 17h, file tại https://drive.google.com/...</code>');
    return;
  }

  const parsed  = parseContent(content);
  const seq     = await db.getNextSeq();
  const now     = new Date();
  const orderId = `ORD${String(now.getFullYear()).slice(-2)}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${String(seq).padStart(3,'0')}`;

  const order = await db.createOrder({
    order_id:           orderId,
    created_at:         now.toISOString(),
    requester_id:       ctx.user.id,
    requester_name:     ctx.user.name,
    content,
    deadline:           parsed.deadline,
    material_links:     parsed.links.join(', '),
    status:             'CHỜ NHẬN',
    contributors:       '[]',
    group_msg_id:       null,
    publish_link:       null,
    published_at:       null,
    products_breakdown: '{}',
    total_amount:       0,
  });

  ctx.send(
    `✅ <b>Order #${orderId} đã được tạo!</b>\n\n` +
    `📋 ${content}\n` +
    (parsed.deadline ? `⏰ Deadline: ${parsed.deadline}\n` : '') +
    `\n<i>Đang chờ designer nhận...</i>`
  );

  // Gửi vào group design
  const grpMsg = await ctx.bot.sendMessage(GROUP_DESIGN_ID,
    formatOrderCard(orderId, content, parsed, ctx.user.name, '🆕 ORDER MỚI', []),
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: [[
        { text: '✋ Tôi nhận một phần', callback_data: `ACCEPT:${orderId}` },
        { text: '📋 Chi tiết', callback_data: `INFO:${orderId}` },
      ]]}
    }
  );

  if (grpMsg) await db.updateOrder(orderId, { group_msg_id: grpMsg.message_id });
}

// ── CALLBACK: Nhận order ─────────────────────────────────────
async function cbAccept(ctx, q, orderId) {
  const order = await db.getOrder(orderId);
  if (!order) { ctx.answer('❌ Không tìm thấy order', true); return; }

  const contributors = JSON.parse(order.contributors || '[]');
  if (contributors.find(c => c.id === ctx.user.id)) {
    ctx.answer('⚠️ Bạn đã nhận order này rồi', true); return;
  }

  contributors.push({ id: ctx.user.id, name: ctx.user.name, done_at: '', link: '' });
  await db.updateOrder(orderId, {
    contributors: JSON.stringify(contributors),
    status: order.status === 'CHỜ NHẬN' ? 'ĐANG LÀM' : order.status,
  });

  ctx.answer('✅ Đã nhận! Dùng /xong ' + orderId + ' [link] khi xong phần của bạn.');
  await refreshGroupMessage(ctx.bot, orderId);

  ctx.bot.sendMessage(order.requester_id,
    `👋 <b>${ctx.user.name}</b> vừa nhận order <b>#${orderId}</b>\n` +
    (contributors.length > 1 ? `👥 Tổng ${contributors.length} người nhận` : ''),
    { parse_mode: 'HTML' }
  );
}

// ── CALLBACK: Info ────────────────────────────────────────────
async function cbInfo(ctx, q, orderId) {
  const order = await db.getOrder(orderId);
  if (!order) { ctx.answer('❌ Không tìm thấy', true); return; }
  ctx.answer();
  const contributors = JSON.parse(order.contributors || '[]');
  ctx.send(formatOrderDetail(order, contributors));
}

// ── /xong ─────────────────────────────────────────────────────
async function cmdDone(ctx, text) {
  const parts   = text.replace(/^\/xong\s*/i, '').trim().split(/\s+/);
  const orderId = parts[0];
  const link    = parts.slice(1).join(' ');

  if (!orderId) { ctx.send('⚠️ Cú pháp: <code>/xong ORDER_ID [link sản phẩm]</code>'); return; }

  const order = await db.getOrder(orderId);
  if (!order) { ctx.send(`❌ Không tìm thấy order #${orderId}`); return; }

  const contributors = JSON.parse(order.contributors || '[]');
  const me = contributors.find(c => c.id === ctx.user.id);
  if (!me) { ctx.send(`⚠️ Bạn chưa nhận order #${orderId}. Vào group design để bấm nhận trước.`); return; }

  me.done_at = new Date().toISOString();
  if (link) me.link = link;

  const allDone = contributors.every(c => !!c.done_at);
  await db.updateOrder(orderId, {
    contributors: JSON.stringify(contributors),
    ...(allDone ? { status: 'CHỜ DUYỆT' } : {}),
  });

  ctx.send(`✅ Đã ghi nhận phần của bạn trong order <b>#${orderId}</b>.` +
    (allDone ? '\n\n🔔 Tất cả thành viên đã xong — đang chờ biên tập viên xác nhận.' : ''));
  await refreshGroupMessage(ctx.bot, orderId);

  if (allDone) {
    const links = contributors.filter(c => c.link).map(c => `• ${c.name}: ${c.link}`).join('\n');
    ctx.bot.sendMessage(order.requester_id,
      `🎉 <b>Order #${orderId} đã hoàn thành thiết kế!</b>\n\n` +
      (links ? `🔗 Link sản phẩm:\n${links}\n\n` : '') +
      `Sau khi bài đăng, dùng: <code>/publish ${orderId} [link bài]</code>`,
      {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[
          { text: '✅ Xác nhận hoàn thành', callback_data: `CONFIRM_PUBLISH:${orderId}` }
        ]]}
      }
    );
  }
}

// ── /publish ──────────────────────────────────────────────────
async function cmdPublish(ctx, text) {
  const parts      = text.replace(/^\/(publish|xacnhan)\s*/i, '').trim().split(/\s+/);
  const orderId    = parts[0];
  const publishLink = parts.slice(1).join(' ');
  if (!orderId) { ctx.send('⚠️ Cú pháp: <code>/publish ORDER_ID [link bài đã đăng]</code>'); return; }
  await doPublish(ctx, orderId, publishLink);
}

async function cbConfirmPublish(ctx, q, orderId) {
  ctx.answer('✅ Đã xác nhận!');
  await doPublish(ctx, orderId, '');
}

async function doPublish(ctx, orderId, publishLink) {
  const order = await db.getOrder(orderId);
  if (!order) { ctx.send(`❌ Không tìm thấy order #${orderId}`); return; }

  await db.updateOrder(orderId, {
    status: 'NGHIỆM THU',
    published_at: new Date().toISOString(),
    ...(publishLink ? { publish_link: publishLink } : {}),
  });

  ctx.send(`✅ Đã xác nhận order <b>#${orderId}</b>.\n<i>Bot đang hỏi từng designer về sản phẩm...</i>`);
  await startReviewFlow(ctx.bot, orderId);
}

// ── FLOW NGHIỆM THU ───────────────────────────────────────────
async function startReviewFlow(bot, orderId) {
  const order        = await db.getOrder(orderId);
  const contributors = JSON.parse(order.contributors || '[]');
  const products     = await db.getProducts();

  if (!contributors.length) return;
  if (!products.length) {
    bot.sendMessage(order.requester_id, '⚠️ Chưa có danh sách sản phẩm. Admin dùng /them_sp để thêm.', { parse_mode: 'HTML' });
    return;
  }

  for (const c of contributors) {
    await db.setPendingState(c.id, {
      action: 'REVIEW', orderId, step: 'SELECT_PRODUCT', items: [],
    });
    const kb = buildProductKeyboard(orderId, c.id, products, []);
    bot.sendMessage(c.id,
      `📦 <b>Nghiệm thu order #${orderId}</b>\n\n` +
      `Bạn đã làm những sản phẩm gì?\n` +
      `<i>Bấm từng loại → nhập số lượng → bấm tiếp → Xác nhận xong khi đủ.</i>`,
      { parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }
    );
  }
}

// ── CALLBACK: Chọn loại SP ────────────────────────────────────
async function cbAddProduct(ctx, q, orderId, designerId, productId) {
  if (ctx.user.id !== designerId) { ctx.answer('⚠️ Đây là form của bạn khác', true); return; }

  const state = await db.getPendingState(ctx.user.id);
  if (!state || state.action !== 'REVIEW') { ctx.answer('⚠️ Phiên hết hạn, liên hệ admin'); return; }

  const product = await db.getProductById(productId);
  if (!product) { ctx.answer('❌ Không tìm thấy sản phẩm'); return; }

  state.step = 'ENTER_QTY';
  state.currentProductId = productId;
  await db.setPendingState(ctx.user.id, state);

  ctx.answer();
  ctx.send(`✏️ Bạn đã làm bao nhiêu <b>${product.name}</b>?\n<i>Nhập số lượng (VD: 3)</i>`);
}

// ── CALLBACK: Xác nhận xong SP ───────────────────────────────
async function cbDoneProducts(ctx, q, orderId, designerId) {
  if (ctx.user.id !== designerId) { ctx.answer('⚠️ Form của bạn khác', true); return; }

  const state = await db.getPendingState(ctx.user.id);
  if (!state || !state.items || state.items.length === 0) {
    ctx.answer('⚠️ Chưa chọn sản phẩm nào', true); return;
  }

  ctx.answer('✅ Đã lưu!');
  await db.clearPendingState(ctx.user.id);
  await finalizeDesignerProducts(ctx, orderId, designerId, ctx.user.name, state.items);
}

async function cbCancelProducts(ctx, q, orderId) {
  await db.clearPendingState(ctx.user.id);
  ctx.answer('❌ Đã huỷ');
  ctx.send(`❌ Đã huỷ nghiệm thu order #${orderId}.`);
}

// ── PENDING FLOW: nhận số lượng SP ───────────────────────────
async function handlePendingFlow(ctx, text) {
  const state = await db.getPendingState(ctx.user.id);
  if (!state || state.action !== 'REVIEW' || state.step !== 'ENTER_QTY') return false;

  const qty = parseInt(text);
  if (isNaN(qty) || qty <= 0) { ctx.send('⚠️ Nhập số lượng hợp lệ (VD: 3)'); return true; }

  const product  = await db.getProductById(state.currentProductId);
  const existing = state.items.findIndex(i => i.product_id === state.currentProductId);

  if (existing >= 0) {
    state.items[existing] = { ...state.items[existing], qty, amount: qty * product.price };
  } else {
    state.items.push({ product_id: product.id, product_name: product.name, qty, unit_price: product.price, amount: qty * product.price });
  }

  state.step = 'SELECT_PRODUCT';
  state.currentProductId = null;
  await db.setPendingState(ctx.user.id, state);

  const products = await db.getProducts();
  const kb       = buildProductKeyboard(state.orderId, ctx.user.id, products, state.items);
  const total    = state.items.reduce((s, i) => s + i.amount, 0);
  const summary  = state.items.map(i => `• ${i.product_name}: ${i.qty} × ${fmt(i.unit_price)}đ = ${fmt(i.amount)}đ`).join('\n');

  ctx.send(
    `✅ Đã thêm <b>${qty} ${product.name}</b>\n\n<b>Hiện tại:</b>\n${summary}\n<b>Tạm tính: ${fmt(total)}đ</b>\n\nThêm loại khác hoặc bấm Xác nhận xong:`,
    { reply_markup: { inline_keyboard: kb } }
  );
  return true;
}

// ── LƯU KẾT QUẢ NGHIỆM THU ───────────────────────────────────
async function finalizeDesignerProducts(ctx, orderId, designerId, designerName, items) {
  const order     = await db.getOrder(orderId);
  const breakdown = JSON.parse(order.products_breakdown || '{}');
  breakdown[designerId] = { name: designerName, items };

  let total = 0;
  Object.values(breakdown).forEach(d => d.items.forEach(i => total += i.amount));

  await db.updateOrder(orderId, {
    products_breakdown: JSON.stringify(breakdown),
    total_amount: total,
  });

  const contributors  = JSON.parse(order.contributors || '[]');
  const allConfirmed  = contributors.every(c => breakdown[c.id]);
  const myTotal       = items.reduce((s, i) => s + i.amount, 0);
  const summary       = items.map(i => `• ${i.product_name}: ${i.qty} × ${fmt(i.unit_price)}đ = ${fmt(i.amount)}đ`).join('\n');

  ctx.send(
    `✅ <b>Đã lưu nghiệm thu order #${orderId}</b>\n\n${summary}\n<b>Tổng của bạn: ${fmt(myTotal)}đ</b>` +
    (allConfirmed ? `\n\n✅ Tất cả đã confirm. Order hoàn tất!` : `\n\n<i>Đang chờ thành viên khác xác nhận...</i>`)
  );

  if (allConfirmed) {
    await db.updateOrder(orderId, { status: 'HOÀN THÀNH' });
    await refreshGroupMessage(ctx.bot, orderId);

    const fullSummary = Object.entries(breakdown).map(([id, d]) => {
      const sub      = d.items.map(i => `  · ${i.product_name}: ${i.qty} sp = ${fmt(i.amount)}đ`).join('\n');
      const subtotal = d.items.reduce((s, i) => s + i.amount, 0);
      return `👤 ${d.name} — ${fmt(subtotal)}đ\n${sub}`;
    }).join('\n\n');

    ctx.bot.sendMessage(order.requester_id,
      `🎯 <b>Order #${orderId} đã nghiệm thu xong!</b>\n\n${fullSummary}\n\n💰 <b>Tổng: ${fmt(total)}đ</b>`,
      { parse_mode: 'HTML' }
    );
  }
}

// ── QUẢN LÝ SẢN PHẨM ─────────────────────────────────────────
async function cmdAddProduct(ctx, text) {
  if (!isAdmin(ctx.user.id)) { ctx.send('⛔ Chỉ admin mới dùng được lệnh này.'); return; }
  const m = text.replace(/^\/them_sp\s*/i, '').match(/^(.+?)\s+(\d+)\s*$/);
  if (!m) { ctx.send('⚠️ Cú pháp: <code>/them_sp [tên sản phẩm] [đơn giá]</code>\nVD: <code>/them_sp Ảnh đơn 150000</code>'); return; }
  await db.addProduct(m[1].trim(), parseInt(m[2]));
  ctx.send(`✅ Đã thêm: <b>${m[1].trim()}</b> — ${fmt(parseInt(m[2]))}đ/sản phẩm`);
}

async function cmdUpdatePrice(ctx, text) {
  if (!isAdmin(ctx.user.id)) { ctx.send('⛔ Chỉ admin.'); return; }
  const m = text.replace(/^\/sua_gia\s*/i, '').match(/^(.+?)\s+(\d+)\s*$/);
  if (!m) { ctx.send('⚠️ Cú pháp: <code>/sua_gia [tên sản phẩm] [giá mới]</code>'); return; }
  const ok = await db.updateProductPrice(m[1].trim(), parseInt(m[2]));
  ctx.send(ok ? `✅ Đã cập nhật <b>${m[1].trim()}</b> → ${fmt(parseInt(m[2]))}đ` : `❌ Không tìm thấy "${m[1].trim()}". Dùng /san_pham để xem.`);
}

async function cmdDeleteProduct(ctx, text) {
  if (!isAdmin(ctx.user.id)) { ctx.send('⛔ Chỉ admin.'); return; }
  const name = text.replace(/^\/xoa_sp\s*/i, '').trim();
  if (!name) { ctx.send('⚠️ Cú pháp: <code>/xoa_sp [tên sản phẩm]</code>'); return; }
  const ok = await db.deleteProduct(name);
  ctx.send(ok ? `✅ Đã xóa <b>${name}</b>` : `❌ Không tìm thấy "${name}".`);
}

async function cmdListProducts(ctx) {
  const products = await db.getProducts();
  if (!products.length) { ctx.send('📭 Chưa có sản phẩm nào. Admin dùng /them_sp để thêm.'); return; }
  const list = products.map((p, i) => `${i+1}. <b>${p.name}</b> — ${fmt(p.price)}đ/sp`).join('\n');
  ctx.send(`📋 <b>Danh sách loại sản phẩm:</b>\n\n${list}`);
}

async function cmdMyOrders(ctx) {
  const orders = await db.getOrdersByDesigner(ctx.user.id);
  if (!orders.length) { ctx.send('📭 Bạn chưa nhận order nào đang active.'); return; }
  const list = orders.map(o => {
    const contributors = JSON.parse(o.contributors || '[]');
    const me = contributors.find(c => c.id === ctx.user.id);
    return `#${o.order_id} [${o.status}]\n${o.content.substring(0,60)}...` +
      (me && !me.done_at ? `\n→ <code>/xong ${o.order_id} [link]</code>` : ' ✅');
  }).join('\n\n');
  ctx.send(`📋 <b>Order của bạn:</b>\n\n${list}`);
}

async function cmdOrderInfo(ctx, text) {
  const orderId = text.replace(/^\/order_info\s*/i, '').trim();
  if (!orderId) { ctx.send('⚠️ Cú pháp: <code>/order_info ORDER_ID</code>'); return; }
  const order = await db.getOrder(orderId);
  if (!order) { ctx.send(`❌ Không tìm thấy #${orderId}`); return; }
  ctx.send(formatOrderDetail(order, JSON.parse(order.contributors || '[]')));
}

// ── HELPERS ───────────────────────────────────────────────────
function buildProductKeyboard(orderId, designerId, products, currentItems) {
  const rows = products.map(p => {
    const ex    = currentItems.find(i => i.product_id === p.id);
    const label = ex ? `✅ ${p.name} (${ex.qty}) = ${fmt(ex.amount)}đ` : `${p.name} — ${fmt(p.price)}đ/sp`;
    return [{ text: label, callback_data: `ADD_SP:${orderId}:${designerId}:${p.id}` }];
  });
  rows.push([{ text: '✅ Xác nhận xong', callback_data: `DONE_SP:${orderId}:${designerId}` }]);
  rows.push([{ text: '❌ Huỷ', callback_data: `CANCEL_SP:${orderId}` }]);
  return rows;
}

async function refreshGroupMessage(bot, orderId) {
  const order        = await db.getOrder(orderId);
  const contributors = JSON.parse(order.contributors || '[]');
  const parsed       = parseContent(order.content);
  if (!order.group_msg_id) return;

  const statusEmoji  = { 'CHỜ NHẬN':'🆕','ĐANG LÀM':'🟡','CHỜ DUYỆT':'🟠','NGHIỆM THU':'🔵','HOÀN THÀNH':'✅' };
  const emoji        = statusEmoji[order.status] || '📋';
  const kb           = order.status === 'HOÀN THÀNH' ? [] : [[
    { text: '✋ Tôi cũng nhận một phần', callback_data: `ACCEPT:${orderId}` },
    { text: '📋 Chi tiết', callback_data: `INFO:${orderId}` },
  ]];

  try {
    await bot.editMessageText(
      formatOrderCard(orderId, order.content, parsed, order.requester_name, `${emoji} ORDER #${orderId} — ${order.status}`, contributors),
      { chat_id: GROUP_DESIGN_ID, message_id: order.group_msg_id, parse_mode: 'HTML', reply_markup: { inline_keyboard: kb } }
    );
  } catch {}
}

function formatOrderCard(orderId, content, parsed, requesterName, title, contributors) {
  const memberList = contributors.length
    ? contributors.map(c => `  • ${c.name}` + (c.done_at ? ' ✅' : ' ⏳')).join('\n')
    : '  <i>Chưa có ai nhận</i>';
  return `${title}\n\n📋 <b>Nội dung:</b> ${content}\n👤 <b>Người order:</b> ${requesterName}\n` +
    (parsed.deadline ? `⏰ <b>Deadline:</b> ${parsed.deadline}\n` : '') +
    (parsed.links.length ? `🔗 <b>Link:</b> ${parsed.links[0]}\n` : '') +
    `\n👥 <b>Thực hiện:</b>\n${memberList}`;
}

function formatOrderDetail(order, contributors) {
  const memberDetail = contributors.map(c =>
    `• ${c.name}` + (c.done_at ? ` ✅` : ' ⏳ Đang làm') + (c.link ? `\n  🔗 ${c.link}` : '')
  ).join('\n');
  return `📋 <b>Order #${order.order_id}</b>\n\n` +
    `🔖 Trạng thái: <b>${order.status}</b>\n` +
    `👤 Người order: ${order.requester_name}\n` +
    (order.deadline ? `⏰ Deadline: ${order.deadline}\n` : '') +
    `\n📝 ${order.content}\n\n` +
    `👥 Thực hiện:\n${memberDetail || '<i>Chưa có</i>'}` +
    (order.publish_link ? `\n\n🌐 Bài đăng: ${order.publish_link}` : '') +
    (order.total_amount > 0 ? `\n💰 Tổng: ${fmt(order.total_amount)}đ` : '');
}

function parseContent(text) {
  const links = [];
  const urlRegex = /https?:\/\/[^\s]+/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) links.push(m[0]);
  let deadline = '';
  const patterns = [/deadline[:\s]+([^\n,]+)/i, /trước[:\s]+([^\n,]+)/i, /hạn[:\s]+([^\n,]+)/i,
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:trước\s*)?(\d{1,2}h\d{0,2})?/i];
  for (const p of patterns) {
    const match = text.match(p);
    if (match) { deadline = match[1] + (match[2] ? ' ' + match[2] : ''); break; }
  }
  return { links, deadline: deadline.trim() };
}

module.exports = {
  cmdHelp, cmdOrder, cmdDone, cmdPublish, cmdAddProduct, cmdUpdatePrice,
  cmdDeleteProduct, cmdListProducts, cmdMyOrders, cmdOrderInfo,
  cbAccept, cbInfo, cbConfirmPublish, cbAddProduct, cbDoneProducts, cbCancelProducts,
  handlePendingFlow,
};
