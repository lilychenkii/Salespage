function initCountdown() {
  const hoursEl = document.getElementById('countdown-hours')
  const minutesEl = document.getElementById('countdown-minutes')
  const secondsEl = document.getElementById('countdown-seconds')
  if (!hoursEl || !minutesEl || !secondsEl) return

  function tick() {
    const now = new Date()
    const target = new Date(now)
    target.setHours(23, 59, 59, 999)
    const diff = Math.max(0, target - now)

    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)

    hoursEl.textContent = String(hours).padStart(2, '0')
    minutesEl.textContent = String(minutes).padStart(2, '0')
    secondsEl.textContent = String(seconds).padStart(2, '0')
  }

  tick()
  setInterval(tick, 1000)
}

function initReviewCarousel() {
  const track = document.getElementById('review-track')
  const prevBtn = document.getElementById('review-prev')
  const nextBtn = document.getElementById('review-next')
  if (!track || !prevBtn || !nextBtn) return

  let index = 0

  function maxIndex() {
    return window.innerWidth <= 900 ? 3 : 2
  }

  function render() {
    const cardWidth = track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width : 0
    const gap = 16
    track.style.transform = `translateX(-${index * (cardWidth + gap)}px)`
    prevBtn.disabled = index === 0
    nextBtn.disabled = index >= maxIndex()
  }

  prevBtn.addEventListener('click', () => {
    index = Math.max(0, index - 1)
    render()
  })

  nextBtn.addEventListener('click', () => {
    index = Math.min(maxIndex(), index + 1)
    render()
  })

  window.addEventListener('resize', () => {
    index = Math.min(index, maxIndex())
    render()
  })

  render()
}

function initConsultForm() {
  const form = document.getElementById('landing-consult-form')
  if (!form) return

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    showToast('Đã nhận thông tin. DURI sẽ liên hệ bạn sớm nhất!', 'success')
    form.reset()
  })
}

document.addEventListener('DOMContentLoaded', () => {
  initCountdown()
  initReviewCarousel()
  initConsultForm()
})
