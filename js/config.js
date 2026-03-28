const SUPABASE_URL = 'https://xwuyxkrnhdusgwzuvivd.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3dXl4a3JuaGR1c2d3enV2aXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMjYwNzUsImV4cCI6MjA4OTcwMjA3NX0._A693D9jlvMmiC8ef7D0NuVjqW1GFZwaEOIXNeJdgyQ'

const { createClient } = supabase
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Format giá VND
function formatPrice(price) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(price)
}

// Chuẩn hóa URL ảnh để xử lý tên file có dấu/khoảng trắng mà không bị encode lặp.
function normalizeImageUrl(url = '') {
  const value = String(url).trim()
  if (!value) return ''
  if (/^(data:|blob:)/i.test(value)) return value

  const encodePathSegments = (path = '') => path
    .split('/')
    .map((segment, index) => {
      if (index === 0 && segment === '') return ''
      try {
        return encodeURIComponent(decodeURIComponent(segment))
      } catch {
        return encodeURIComponent(segment)
      }
    })
    .join('/')

  try {
    const parsed = new URL(value, window.location.origin)
    parsed.pathname = encodePathSegments(parsed.pathname)

    // Nếu là URL tuyệt đối thì trả tuyệt đối, nếu là đường dẫn tương đối thì trả tương đối.
    if (/^https?:\/\//i.test(value)) {
      return parsed.toString()
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`.replace(/^\//, '')
  } catch {
    return encodePathSegments(value)
  }
}

// Một số record DB đang lưu sai tên file ảnh (bị rút gọn thành ....jpg),
// map theo product id để đảm bảo luôn render đúng ảnh thật.
const PRODUCT_IMAGE_OVERRIDES = {
  '1a5ad762-bfe2-4a5f-9b9e-9ec40f062033': 'images/Phòng tắm/Doori Ultra Filter Washbasin Faucet, Baby Faucet, Toddler Faucet, Water Tap Premium Model.jpg',
  'c0788567-679c-4a39-8e80-d92b13b30118': 'images/Sinh hoạt/Doori Bebiskin Water-Dissolvable Natural Pulp Bidet Wipes Refill 60 Sheets (16 Packs) + 2 Cases.jpg'
}

function resolveProductImage(productId, imageUrl) {
  if (productId && PRODUCT_IMAGE_OVERRIDES[productId]) {
    return normalizeImageUrl(PRODUCT_IMAGE_OVERRIDES[productId])
  }
  return normalizeImageUrl(imageUrl)
}

// Toast notification
function showToast(message, type = '') {
  const toast = document.getElementById('toast')
  if (!toast) return
  toast.textContent = message
  toast.className = `toast ${type} show`
  setTimeout(() => { toast.className = 'toast' }, 2500)
}

// Cart (localStorage)
function getCart() {
  return JSON.parse(localStorage.getItem('duri_cart') || '[]')
}

function saveCart(cart) {
  localStorage.setItem('duri_cart', JSON.stringify(cart))
  updateCartCount()
}

function updateCartCount() {
  const count = document.getElementById('cart-count')
  if (!count) return
  const total = getCart().reduce((sum, i) => sum + i.qty, 0)
  count.textContent = total
  count.style.display = total > 0 ? 'flex' : 'none'
}

function addToCart(id, name, price, image_url) {
  const cart = getCart()
  const existing = cart.find(i => i.id === id)
  const safeImageUrl = resolveProductImage(id, image_url)
  if (existing) {
    existing.qty += 1
    if (!existing.image_url && safeImageUrl) existing.image_url = safeImageUrl
  } else {
    cart.push({ id, name, price, image_url: safeImageUrl, qty: 1 })
  }
  saveCart(cart)
  showToast('Đã thêm vào giỏ hàng', 'success')
}

document.addEventListener('DOMContentLoaded', updateCartCount)

// ── Apps Script URL ───────────────────────────────────────
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_2Q80SYzIqDlJX7HvMgWFil6nMBrLgwbStuDT5vv0WI7qOUKXG9dh2PV4w3LGwbnC/exec'

// ── Gửi email thông báo trạng thái đơn hàng ──────────────
async function sendOrderEmail({ email, subject, orderCode, customerName, status, items = [], total = 0, address = '' }) {
  try {
    const statusLabel = {
      'Đặt hàng thành công': 'Đặt hàng thành công',
      'Đang chuẩn bị':       'Đang chuẩn bị hàng',
      'Đang giao':           'Đơn hàng đang được giao',
      'Đã giao':             'Đã giao hàng thành công',
      'Đã hủy':              'Đơn hàng đã hủy'
    }

    const statusColor = {
      'Đặt hàng thành công': '#16a34a',
      'Đang chuẩn bị':       '#d97706',
      'Đang giao':           '#0284c7',
      'Đã giao':             '#16a34a',
      'Đã hủy':              '#dc2626'
    }

    const statusBg = {
      'Đặt hàng thành công': '#dcfce7',
      'Đang chuẩn bị':       '#fef9c3',
      'Đang giao':           '#e0f2fe',
      'Đã giao':             '#dcfce7',
      'Đã hủy':              '#fee2e2'
    }

    const label  = statusLabel[status]  || status
    const color  = statusColor[status]  || '#374151'
    const bgColor = statusBg[status]    || '#f9fafb'

    const itemsHTML = items.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#f1f5f9">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Sản phẩm</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase">SL</th>
            <th style="padding:8px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase">Tiền</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px">${i.product_name || i.name}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:14px">${i.quantity || i.qty}</td>
              <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:14px">${((i.unit_price || i.price) * (i.quantity || i.qty)).toLocaleString('vi-VN')}đ</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p style="text-align:right;font-weight:700;font-size:15px;margin:0 0 16px">Tổng: ${total.toLocaleString('vi-VN')}đ</p>
    ` : ''

    const body = `
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:580px;margin:0 auto;background:#ffffff">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1f2937,#111827);padding:32px 40px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#ffffff;font-size:28px;margin:0;letter-spacing:4px">DURI</h1>
    <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px">Smart Baby Care from Korea</p>
  </div>

  <!-- Body -->
  <div style="padding:32px 40px">

    <!-- Status badge -->
    <div style="background:${bgColor};border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center">
      <p style="color:${color};font-size:18px;font-weight:700;margin:0">${label}</p>
    </div>

    <p style="color:#374151;font-size:15px;margin:0 0 20px">Xin chào <strong>${customerName}</strong>,</p>

    <!-- Order code -->
    <div style="background:#F5F1ED;border-radius:10px;padding:16px;text-align:center;margin-bottom:24px">
      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">Mã đơn hàng</p>
      <p style="color:#111827;font-size:22px;font-weight:700;margin:0;letter-spacing:2px">#${orderCode}</p>
    </div>

    ${itemsHTML}

    ${address ? `
    <div style="background:#f9fafb;border-radius:10px;padding:14px 16px;margin-bottom:16px">
      <p style="color:#6b7280;font-size:13px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px">Địa chỉ giao hàng</p>
      <p style="color:#374151;font-size:14px;margin:0">${address}</p>
    </div>` : ''}

    <p style="text-align:center;color:#9ca3af;font-size:13px;margin-top:24px">Cảm ơn bạn đã tin tưởng DURI Smart Baby Care</p>
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

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, subject, body }),
      mode: 'no-cors'
    })

  } catch (err) {
    console.error('Lỗi gửi email:', err)
  }
}