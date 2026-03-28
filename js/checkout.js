// ===== CHECKOUT.JS =====

// ── Gửi email qua Apps Script ─────────────────────────────
async function sendEmail(to, subject, body) {
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: to, subject, body })
    })
  } catch (err) {
    console.error('Lỗi gửi email:', err)
  }
}

// ── Template email xác nhận đặt hàng ─────────────────────
function emailConfirmTemplate(order, items) {
  const itemsHTML = items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe5">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe5;text-align:center">x${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0ebe5;text-align:right;font-weight:600">${(i.price * i.qty).toLocaleString('vi-VN')}đ</td>
    </tr>`
  ).join('')

  return `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#ffffff">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1f2937,#111827);padding:32px 40px;text-align:center;border-radius:12px 12px 0 0">
      <h1 style="color:#ffffff;font-size:28px;margin:0;letter-spacing:4px">DURI</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px">Smart Baby Care from Korea</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;background:#ffffff">
      <div style="text-align:center;margin-bottom:28px">
        <h2 style="color:#111827;font-size:22px;margin:0 0 8px">Đặt hàng thành công!</h2>
        <p style="color:#6b7280;font-size:14px;margin:0">Cảm ơn <strong>${order.customer_name}</strong> đã tin tưởng DURI</p>
      </div>

      <!-- Order code -->
      <div style="background:#F5F1ED;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px">
        <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">Mã đơn hàng</p>
        <p style="color:#111827;font-size:22px;font-weight:700;margin:0;letter-spacing:2px">#${order.order_code}</p>
        <p style="color:#9ca3af;font-size:12px;margin:6px 0 0">Dùng mã này để tra cứu trạng thái đơn hàng</p>
      </div>

      <!-- Items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Sản phẩm</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">SL</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Thành tiền</th>
          </tr>
        </thead>
        <tbody>${itemsHTML}</tbody>
      </table>

      <!-- Total -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="border-top:2px solid #111827;padding-top:12px;font-weight:700;font-size:15px">Tổng cộng</td>
          <td style="border-top:2px solid #111827;padding-top:12px;font-weight:700;font-size:15px;color:#f97316;text-align:right">${order.total_price.toLocaleString('vi-VN')}đ</td>
        </tr>
      </table>

      <!-- Shipping info -->
      <div style="background:#f9fafb;border-radius:10px;padding:16px;margin-bottom:24px">
        <h3 style="color:#111827;font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:1px">Thông tin giao hàng</h3>
        <p style="color:#374151;font-size:14px;margin:4px 0">Họ tên: ${order.customer_name}</p>
        <p style="color:#374151;font-size:14px;margin:4px 0">Điện thoại: ${order.customer_phone}</p>
        <p style="color:#374151;font-size:14px;margin:4px 0">Địa chỉ: ${order.shipping_address}</p>
        ${order.note ? `<p style="color:#374151;font-size:14px;margin:4px 0">Ghi chú: ${order.note}</p>` : ''}
      </div>

      <!-- Status info -->
      <div style="background:#dbeafe;border-radius:10px;padding:16px;margin-bottom:24px">
        <p style="color:#1d4ed8;font-size:14px;margin:0;line-height:1.8">
          Đơn hàng của bạn đang được <strong>chuẩn bị</strong>.<br/>
          Chúng tôi sẽ thông báo email khi đơn hàng được giao đi.<br/>
          Tra cứu trạng thái tại website bằng mã đơn hàng.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:24px 40px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e8e3dd">
      <p style="color:#374151;font-size:13px;font-weight:600;margin:0 0 8px">DURI Smart Baby Care</p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0">
        Website: <a href="https://present-landing-page.vercel.app/" style="color:#1d4ed8;text-decoration:none">present-landing-page.vercel.app</a>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:4px 0">
        Email: <a href="mailto:durimall.vn@gmail.com" style="color:#1d4ed8;text-decoration:none">durimall.vn@gmail.com</a>
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:10px 0 0">&copy; 2025 DURI Vietnam &ndash; Smart Baby Care Solutions from Korea</p>
    </div>

  </div>`
}

// ── Render tóm tắt đơn hàng ──────────────────────────────
function renderCheckoutSummary() {
  const cart = getCart()
  if (cart.length === 0) { window.location.href = 'cart.html'; return }

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
  const shipping = 30000
  const total    = subtotal + shipping

  document.getElementById('checkout-items').innerHTML = cart.map(item => `
    <div style="display:flex;justify-content:space-between;font-size:0.85rem;padding:6px 0;border-bottom:1px solid #f0ebe5">
      <span style="color:#374151">${item.name} <span style="color:#9ca3af">x${item.qty}</span></span>
      <span style="font-weight:600">${formatPrice(item.price * item.qty)}</span>
    </div>
  `).join('')

  document.getElementById('co-subtotal').textContent = formatPrice(subtotal)
  document.getElementById('co-shipping').textContent = formatPrice(shipping)
  document.getElementById('co-total').textContent    = formatPrice(total)
}

// ── Đặt hàng ─────────────────────────────────────────────
async function placeOrder() {
  const name    = document.getElementById('checkout-name')?.value?.trim()
  const email   = document.getElementById('checkout-email')?.value?.trim()
  const phone   = document.getElementById('checkout-phone')?.value?.trim()
  const address = document.getElementById('checkout-address')?.value?.trim()
  const note    = document.getElementById('checkout-note')?.value?.trim()

  if (!name || !email || !phone || !address) {
    showToast('Vui lòng điền đầy đủ thông tin bắt buộc', 'error'); return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    showToast('Email không hợp lệ', 'error'); return
  }

  const cart = getCart()
  if (cart.length === 0) { showToast('Giỏ hàng trống!', 'error'); return }

  const btn = document.getElementById('place-order-btn')
  btn.disabled = true
  btn.textContent = 'Đang xử lý...'

  try {
    const subtotal  = cart.reduce((sum, i) => sum + i.price * i.qty, 0)
    const total     = subtotal + 30000
    const orderCode = 'DURI' + Date.now().toString().slice(-8)

    // Insert order
    const { data: order, error: orderError } = await db
      .from('orders')
      .insert({
        order_code:       orderCode,
        customer_name:    name,
        customer_email:   email,
        customer_phone:   phone,
        shipping_address: address,
        note:             note || null,
        total_price:      total,
        status:           'Đang chuẩn bị'
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Insert order items
    const { error: itemsError } = await db.from('order_items').insert(
      cart.map(item => ({
        order_id:     order.id,
        product_id:   item.id,
        product_name: item.name,
        quantity:     item.qty,
        unit_price:   item.price
      }))
    )
    if (itemsError) throw itemsError
    // Lưu / cập nhật customer
const { error: custError } = await db
  .from('customers')
  .upsert({
    email:      email,
    full_name:  name,
    phone:      phone,
    address:    address,
    updated_at: new Date().toISOString()
  }, { onConflict: 'email' })
if (custError) console.warn('Lưu customer lỗi (không ảnh hưởng đơn hàng):', custError)

    // Gửi email xác nhận
    await sendEmail(
      email,
      'DURI - Xác nhận đơn hàng #' + orderCode,
      emailConfirmTemplate(order, cart)
    )

    // Xóa giỏ hàng
    localStorage.removeItem('duri_cart')

    // Hiện modal thành công
    document.getElementById('modal-order-code').textContent = '#' + orderCode
    document.getElementById('success-modal').style.display = 'flex'

    window._lastOrderCode = orderCode

  } catch (err) {
    console.error('Lỗi đặt hàng:', err)
    showToast('Có lỗi xảy ra, vui lòng thử lại', 'error')
    btn.disabled = false
    btn.textContent = 'Đặt hàng ngay'
  }
}

document.addEventListener('DOMContentLoaded', renderCheckoutSummary)

function goToOrders() {
  window.location.href = `orders.html?success=1&code=${window._lastOrderCode}`
}