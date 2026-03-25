// ===== PRODUCTS.JS =====

async function loadProducts() {
  const grid = document.getElementById('product-grid')
  if (!grid) return
  const titleEl = document.getElementById('products-title')
  const categoryParam = new URLSearchParams(window.location.search).get('category')

  const normalizeText = (value = '') => value
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  try {
    const { data: products, error } = await db
      .from('products')
      .select('*')
      .order('category')

    if (error) throw error

    if (!products || products.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📦</div>
          <h3>Chưa có sản phẩm</h3>
        </div>`
      return
    }

    let filteredProducts = products

    if (categoryParam) {
      const target = normalizeText(categoryParam)
      filteredProducts = products.filter(p => normalizeText(p.category) === target)
      if (titleEl) {
        titleEl.textContent = `Sản phẩm: ${categoryParam}`
      }
    }

    if (!filteredProducts.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🔎</div>
          <h3>Không có sản phẩm trong danh mục này</h3>
        </div>`
      return
    }

    grid.innerHTML = filteredProducts.map(p => {
      const safeImageUrl = resolveProductImage(p.id, p.image_url)
      return `
      <div class="product-card" onclick="window.location.href='produc-details.html?id=${p.id}'">
        <img
          class="product-card-img"
          src="${safeImageUrl}"
          alt="${p.name}"
          onerror="this.src='https://placehold.co/400x300/F5F1ED/333333?text=DURI'"
        />
        <div class="product-card-body">
          <div class="product-card-category">${p.category || 'Sản phẩm'}</div>
          <div class="product-card-name">${p.name}</div>
          <div class="product-card-desc">${p.description || ''}</div>
          <div class="product-card-footer">
            <div class="product-price">${formatPrice(p.price)}</div>
            <button
              class="btn btn-dark btn-sm"
              onclick="event.stopPropagation(); addToCart('${p.id}', '${p.name.replace(/'/g,"\\'")}', ${p.price}, '${safeImageUrl}')"
            >+ Giỏ hàng</button>
          </div>
        </div>
      </div>
    `}).join('')

  } catch (err) {
    console.error(err)
    document.getElementById('product-grid').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">⚠️</div>
        <h3>Không thể tải sản phẩm</h3>
        <p>Vui lòng thử lại sau.</p>
      </div>`
  }
}

document.addEventListener('DOMContentLoaded', loadProducts)