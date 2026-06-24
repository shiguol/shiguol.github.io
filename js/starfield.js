/**
 * Starfield Canvas Animation for #page-header
 * Renders animated stars + occasional shooting stars
 * Matches WALL-E space theme
 */
!function () {
  var canvas, ctx, w, h, stars = [], shootingStars = [], raf
  var STAR_COUNT = 200
  var SHOOTING_INTERVAL = 3000

  function init () {
    var header = document.getElementById('page-header')
    if (!header) return

    canvas = document.createElement('canvas')
    canvas.id = 'starfield'
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;'
    header.insertBefore(canvas, header.firstChild)

    resize()
    createStars()
    animate()
    setInterval(addShootingStar, SHOOTING_INTERVAL)
    window.addEventListener('resize', resize)
  }

  function resize () {
    var header = document.getElementById('page-header')
    if (!header || !canvas) return
    w = canvas.width = header.offsetWidth
    h = canvas.height = header.offsetHeight
  }

  function createStars () {
    stars = []
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random(),
        da: (Math.random() - 0.5) * 0.02
      })
    }
  }

  function addShootingStar () {
    if (shootingStars.length > 2) return
    shootingStars.push({
      x: Math.random() * w * 0.7,
      y: Math.random() * h * 0.4,
      len: Math.random() * 60 + 40,
      speed: Math.random() * 6 + 4,
      a: 1
    })
  }

  function animate () {
    if (!ctx) ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)

    // Draw stars
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i]
      s.a += s.da
      if (s.a <= 0.1 || s.a >= 1) s.da = -s.da
      ctx.beginPath()
      ctx.arc(s.x % w, s.y % h, s.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,' + s.a.toFixed(2) + ')'
      ctx.fill()
    }

    // Draw shooting stars
    for (var j = shootingStars.length - 1; j >= 0; j--) {
      var ss = shootingStars[j]
      ctx.beginPath()
      ctx.moveTo(ss.x, ss.y)
      ctx.lineTo(ss.x - ss.len, ss.y - ss.len * 0.4)
      ctx.strokeStyle = 'rgba(255,255,255,' + ss.a.toFixed(2) + ')'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ss.x += ss.speed
      ss.y += ss.speed * 0.4
      ss.a -= 0.015
      if (ss.a <= 0) shootingStars.splice(j, 1)
    }

    raf = requestAnimationFrame(animate)
  }

  // Support Pjax: re-init on page change
  function start () {
    if (raf) cancelAnimationFrame(raf)
    shootingStars = []
    init()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
  document.addEventListener('pjax:complete', start)
}()
