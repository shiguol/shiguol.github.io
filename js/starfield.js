/**
 * Starfield Canvas Animation for #page-header
 * Background twinkling stars + rotating famous constellations + shooting stars
 */
!function () {
  var canvas, ctx, w, h
  var stars = [], shootingStars = [], raf
  var activeConstellation = null
  var fadeOutConstellation = null
  var fadeInConstellation = null
  var isTransitioning = false
  var transitionStart = 0
  var shootingTimer = null
  var constellationTimer = null
  var lastConstellationIdx = -1
  var currentConstellationDef = null
  var STAR_COUNT = 200
  var SHOOTING_INTERVAL = 3000
  var CONSTELLATION_ROTATE_MS = 10000
  var CONSTELLATION_FADE_MS = 1800

  // Normalized star positions (0–1 bounding box) + line indices
  var CONSTELLATION_DEFS = [
    {
      name: '北斗七星',
      stars: [
        { x: 0.82, y: 0.12 }, { x: 0.78, y: 0.38 }, { x: 0.52, y: 0.42 },
        { x: 0.48, y: 0.18 }, { x: 0.32, y: 0.52 }, { x: 0.18, y: 0.68 },
        { x: 0.02, y: 0.88 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]
    },
    {
      name: '仙后座',
      stars: [
        { x: 0.08, y: 0.32 }, { x: 0.28, y: 0.10 }, { x: 0.50, y: 0.36 },
        { x: 0.72, y: 0.10 }, { x: 0.92, y: 0.32 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4]]
    },
    {
      name: '猎户座',
      stars: [
        { x: 0.18, y: 0.14 }, { x: 0.82, y: 0.18 }, { x: 0.36, y: 0.50 },
        { x: 0.50, y: 0.52 }, { x: 0.64, y: 0.54 }, { x: 0.78, y: 0.86 },
        { x: 0.24, y: 0.88 }
      ],
      lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 6], [4, 5]]
    },
    {
      name: '天鹅座',
      stars: [
        { x: 0.50, y: 0.06 }, { x: 0.50, y: 0.38 }, { x: 0.50, y: 0.72 },
        { x: 0.14, y: 0.44 }, { x: 0.86, y: 0.44 }
      ],
      lines: [[0, 1], [1, 2], [3, 1], [1, 4]]
    },
    {
      name: '天蝎座',
      stars: [
        { x: 0.10, y: 0.55 }, { x: 0.28, y: 0.42 }, { x: 0.44, y: 0.38 },
        { x: 0.58, y: 0.48 }, { x: 0.68, y: 0.62 }, { x: 0.78, y: 0.78 },
        { x: 0.88, y: 0.90 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]]
    },
    {
      name: '双子座',
      stars: [
        { x: 0.35, y: 0.12 }, { x: 0.58, y: 0.10 }, { x: 0.38, y: 0.44 },
        { x: 0.60, y: 0.42 }, { x: 0.32, y: 0.76 }, { x: 0.62, y: 0.74 }
      ],
      lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [2, 3]]
    },
    {
      name: '狮子座',
      stars: [
        { x: 0.12, y: 0.78 }, { x: 0.22, y: 0.58 }, { x: 0.38, y: 0.38 },
        { x: 0.54, y: 0.26 }, { x: 0.70, y: 0.30 }, { x: 0.84, y: 0.46 },
        { x: 0.76, y: 0.68 }, { x: 0.54, y: 0.82 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 5]]
    },
    {
      name: '南十字座',
      stars: [
        { x: 0.50, y: 0.08 }, { x: 0.50, y: 0.92 },
        { x: 0.18, y: 0.52 }, { x: 0.82, y: 0.48 }
      ],
      lines: [[0, 1], [2, 3]]
    },
    {
      name: '天秤座',
      stars: [
        { x: 0.08, y: 0.50 }, { x: 0.32, y: 0.28 }, { x: 0.50, y: 0.54 },
        { x: 0.68, y: 0.28 }, { x: 0.92, y: 0.50 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3]]
    },
    {
      name: '金牛座',
      stars: [
        { x: 0.50, y: 0.78 }, { x: 0.28, y: 0.22 }, { x: 0.72, y: 0.22 },
        { x: 0.38, y: 0.42 }, { x: 0.62, y: 0.42 }
      ],
      lines: [[1, 3], [3, 0], [0, 4], [4, 2], [1, 2]]
    },
    {
      name: '白羊座',
      stars: [
        { x: 0.12, y: 0.62 }, { x: 0.42, y: 0.40 }, { x: 0.72, y: 0.24 },
        { x: 0.90, y: 0.12 }
      ],
      lines: [[0, 1], [1, 2], [2, 3]]
    },
    {
      name: '天琴座',
      stars: [
        { x: 0.50, y: 0.06 }, { x: 0.34, y: 0.34 }, { x: 0.66, y: 0.34 },
        { x: 0.40, y: 0.56 }, { x: 0.50, y: 0.88 }
      ],
      lines: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]]
    },
    {
      name: '天鹰座',
      stars: [
        { x: 0.50, y: 0.08 }, { x: 0.28, y: 0.40 }, { x: 0.50, y: 0.54 },
        { x: 0.72, y: 0.40 }, { x: 0.50, y: 0.90 }
      ],
      lines: [[0, 2], [1, 2], [3, 2], [2, 4], [1, 3]]
    },
    {
      name: '人马座',
      stars: [
        { x: 0.18, y: 0.34 }, { x: 0.34, y: 0.24 }, { x: 0.54, y: 0.28 },
        { x: 0.70, y: 0.44 }, { x: 0.66, y: 0.64 }, { x: 0.44, y: 0.76 },
        { x: 0.28, y: 0.60 }, { x: 0.38, y: 0.48 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1], [2, 7]]
    },
    {
      name: '巨蟹座',
      stars: [
        { x: 0.18, y: 0.38 }, { x: 0.38, y: 0.22 }, { x: 0.62, y: 0.28 },
        { x: 0.78, y: 0.48 }, { x: 0.56, y: 0.66 }, { x: 0.34, y: 0.60 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]]
    },
    {
      name: '飞马座',
      stars: [
        { x: 0.14, y: 0.28 }, { x: 0.54, y: 0.12 }, { x: 0.86, y: 0.38 },
        { x: 0.46, y: 0.54 }, { x: 0.24, y: 0.76 }, { x: 0.66, y: 0.80 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]]
    },
    {
      name: '英仙座',
      stars: [
        { x: 0.50, y: 0.08 }, { x: 0.34, y: 0.32 }, { x: 0.66, y: 0.30 },
        { x: 0.22, y: 0.58 }, { x: 0.50, y: 0.72 }, { x: 0.78, y: 0.56 }
      ],
      lines: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5]]
    }
  ]

  function init () {
    var header = document.getElementById('page-header')
    if (!header) return

    canvas = document.getElementById('starfield')
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.id = 'starfield'
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;'
      header.insertBefore(canvas, header.firstChild)
      window.addEventListener('resize', onResize)
      shootingTimer = setInterval(addShootingStar, SHOOTING_INTERVAL)
      constellationTimer = setInterval(rotateConstellation, CONSTELLATION_ROTATE_MS)
    }

    resize()
    createStars()
    spawnConstellation()
    if (!raf) animate()
  }

  function onResize () {
    resize()
    spawnConstellation(currentConstellationDef, true)
  }

  function resize () {
    var header = document.getElementById('page-header')
    if (!header || !canvas) return
    var dpr = window.devicePixelRatio || 1
    w = header.offsetWidth
    h = header.offsetHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = w + 'px'
    canvas.style.height = h + 'px'
    if (!ctx) ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function pickRandomConstellationDef () {
    var idx
    do {
      idx = Math.floor(Math.random() * CONSTELLATION_DEFS.length)
    } while (idx === lastConstellationIdx && CONSTELLATION_DEFS.length > 1)
    lastConstellationIdx = idx
    return CONSTELLATION_DEFS[idx]
  }

  function easeInOut (t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }

  function peekTransitionProgress () {
    if (!isTransitioning) return 1
    var p = (performance.now() - transitionStart) / CONSTELLATION_FADE_MS
    return p >= 1 ? 1 : easeInOut(p)
  }

  function transitionProgress () {
    if (!isTransitioning) return 1
    var p = (performance.now() - transitionStart) / CONSTELLATION_FADE_MS
    if (p >= 1) {
      activeConstellation = fadeInConstellation
      fadeOutConstellation = null
      fadeInConstellation = null
      isTransitioning = false
      return 1
    }
    return easeInOut(p)
  }

  function buildConstellation (def) {
    var scale = Math.min(w, h) * (0.14 + Math.random() * 0.10)
    var angle = Math.random() * Math.PI * 2
    var cosA = Math.cos(angle)
    var sinA = Math.sin(angle)
    var margin = Math.min(w, h) * 0.16
    var cx = margin + Math.random() * (w - margin * 2)
    var cy = margin + Math.random() * (h - margin * 2)
    var cStars = []

    for (var s = 0; s < def.stars.length; s++) {
      var pt = def.stars[s]
      var lx = (pt.x - 0.5) * scale
      var ly = (pt.y - 0.5) * scale
      var star = createStar(1.0, 2.2, 0.45, 1, 0.012)
      star.x = cx + lx * cosA - ly * sinA
      star.y = cy + lx * sinA + ly * cosA
      cStars.push(star)
    }

    return { name: def.name, stars: cStars, lines: def.lines }
  }

  function beginConstellationTransition (def) {
    if (!w || !h) return
    if (!def) def = pickRandomConstellationDef()
    currentConstellationDef = def

    fadeOutConstellation = fadeInConstellation || activeConstellation
    fadeInConstellation = buildConstellation(def)
    activeConstellation = null
    transitionStart = performance.now()
    isTransitioning = true
  }

  function spawnConstellation (def, instant) {
    if (!w || !h) return
    if (!def) def = pickRandomConstellationDef()
    currentConstellationDef = def

    if (instant) {
      activeConstellation = buildConstellation(def)
      fadeOutConstellation = null
      fadeInConstellation = null
      isTransitioning = false
      return
    }

    if (!activeConstellation && !fadeInConstellation) {
      fadeInConstellation = buildConstellation(def)
      fadeOutConstellation = null
      transitionStart = performance.now()
      isTransitioning = true
      return
    }

    beginConstellationTransition(def)
  }

  function rotateConstellation () {
    beginConstellationTransition(pickRandomConstellationDef())
  }

  function createStar (rMin, rMax, aMin, aMax, daScale) {
    return {
      x: Math.random() * 2000,
      y: Math.random() * 2000,
      r: Math.random() * (rMax - rMin) + rMin,
      a: Math.random() * (aMax - aMin) + aMin,
      da: (Math.random() - 0.5) * daScale
    }
  }

  function createStars () {
    stars = []
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push(createStar(0.3, 1.8, 0, 1, 0.02))
    }
  }

  function tickStar (s) {
    s.a += s.da
    if (s.a <= 0.1 || s.a >= 1) s.da = -s.da
  }

  function drawStar (s) {
    tickStar(s)
    ctx.beginPath()
    ctx.arc(s.x % w, s.y % h, s.r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,' + s.a.toFixed(2) + ')'
    ctx.fill()
  }

  function drawConstellationLine (a, b, opacity) {
    var lineA = Math.max(0.21, (a.a + b.a) * 0.275) * opacity
    if (lineA <= 0.01) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = 'rgba(180,210,255,' + (lineA * 0.35).toFixed(2) + ')'
    ctx.lineWidth = 3.2
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.strokeStyle = 'rgba(255,255,255,' + lineA.toFixed(2) + ')'
    ctx.lineWidth = 1.4
    ctx.stroke()
  }

  function drawConstellation (con, opacity) {
    if (!con || opacity <= 0.01) return
    for (var s = 0; s < con.stars.length; s++) {
      tickStar(con.stars[s])
    }
    for (var l = 0; l < con.lines.length; l++) {
      var pair = con.lines[l]
      drawConstellationLine(con.stars[pair[0]], con.stars[pair[1]], opacity)
    }
    for (var s2 = 0; s2 < con.stars.length; s2++) {
      var cs = con.stars[s2]
      var starA = cs.a * opacity
      if (starA <= 0.01) continue
      ctx.beginPath()
      ctx.arc(cs.x, cs.y, cs.r, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,' + starA.toFixed(2) + ')'
      ctx.fill()
    }
  }

  function addShootingStar () {
    if (!w || !h || shootingStars.length > 2) return
    shootingStars.push({
      x: Math.random() * w * 0.7,
      y: Math.random() * h * 0.4,
      len: Math.random() * 60 + 40,
      speed: Math.random() * 6 + 4,
      a: 1
    })
  }

  function animate () {
    if (!canvas) return
    if (!ctx) ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, w, h)

    for (var i = 0; i < stars.length; i++) {
      drawStar(stars[i])
    }

    var fadeIn = transitionProgress()
    var fadeOut = 1 - fadeIn

    if (fadeOutConstellation) drawConstellation(fadeOutConstellation, fadeOut)
    if (fadeInConstellation) drawConstellation(fadeInConstellation, fadeIn)
    if (!isTransitioning && activeConstellation) drawConstellation(activeConstellation, 1)

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

  function start () {
    if (raf) cancelAnimationFrame(raf)
    raf = null
    if (constellationTimer) {
      clearInterval(constellationTimer)
      constellationTimer = null
    }
    if (shootingTimer) {
      clearInterval(shootingTimer)
      shootingTimer = null
    }
    shootingStars = []
    activeConstellation = null
    fadeOutConstellation = null
    fadeInConstellation = null
    isTransitioning = false
    lastConstellationIdx = -1
    currentConstellationDef = null
    init()
  }

  window.__starfieldDebug = function () {
    var con = fadeInConstellation || activeConstellation
    return {
      count: (fadeOutConstellation ? 1 : 0) + (con ? 1 : 0),
      name: con && con.name,
      stars: con && con.stars.length,
      anchor: con && { x: Math.round(con.stars[0].x), y: Math.round(con.stars[0].y) },
      transitioning: isTransitioning,
      fadeIn: peekTransitionProgress()
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start)
  } else {
    start()
  }
  document.addEventListener('pjax:complete', start)
}()
