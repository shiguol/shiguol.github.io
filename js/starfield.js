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

  // Normalized coords (0–1): stars, solid lines, outline = textbook silhouette polygon
  var CONSTELLATION_DEFS = [
    {
      nameEn: 'Big Dipper',
      stars: [
        { x: 0.82, y: 0.12 }, { x: 0.78, y: 0.38 }, { x: 0.52, y: 0.42 },
        { x: 0.48, y: 0.18 }, { x: 0.32, y: 0.52 }, { x: 0.18, y: 0.68 },
        { x: 0.02, y: 0.88 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
      outline: [
        { x: 0.92, y: 0.06 }, { x: 0.86, y: 0.44 }, { x: 0.54, y: 0.50 },
        { x: 0.42, y: 0.12 }, { x: 0.24, y: 0.58 }, { x: 0.06, y: 0.76 },
        { x: -0.04, y: 0.98 }, { x: 0.04, y: 0.48 }, { x: 0.38, y: 0.04 }
      ]
    },
    {
      nameEn: 'Cassiopeia',
      stars: [
        { x: 0.08, y: 0.32 }, { x: 0.28, y: 0.10 }, { x: 0.50, y: 0.36 },
        { x: 0.72, y: 0.10 }, { x: 0.92, y: 0.32 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
      outline: [
        { x: 0.02, y: 0.40 }, { x: 0.24, y: 0.02 }, { x: 0.50, y: 0.44 },
        { x: 0.76, y: 0.02 }, { x: 0.98, y: 0.40 }, { x: 0.50, y: 0.18 }
      ]
    },
    {
      nameEn: 'Orion',
      stars: [
        { x: 0.18, y: 0.14 }, { x: 0.82, y: 0.18 }, { x: 0.36, y: 0.50 },
        { x: 0.50, y: 0.52 }, { x: 0.64, y: 0.54 }, { x: 0.78, y: 0.86 },
        { x: 0.24, y: 0.88 }
      ],
      lines: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 6], [4, 5]],
      outline: [
        { x: 0.10, y: 0.06 }, { x: 0.90, y: 0.10 }, { x: 0.74, y: 0.60 },
        { x: 0.86, y: 0.96 }, { x: 0.14, y: 0.98 }, { x: 0.26, y: 0.58 }
      ]
    },
    {
      nameEn: 'Cygnus',
      stars: [
        { x: 0.50, y: 0.06 }, { x: 0.50, y: 0.38 }, { x: 0.50, y: 0.72 },
        { x: 0.14, y: 0.44 }, { x: 0.86, y: 0.44 }
      ],
      lines: [[0, 1], [1, 2], [3, 1], [1, 4]],
      outline: [
        { x: 0.50, y: -0.02 }, { x: 0.94, y: 0.44 }, { x: 0.56, y: 0.52 },
        { x: 0.50, y: 0.82 }, { x: 0.44, y: 0.52 }, { x: 0.06, y: 0.44 }
      ]
    },
    {
      nameEn: 'Scorpius',
      stars: [
        { x: 0.10, y: 0.55 }, { x: 0.28, y: 0.42 }, { x: 0.44, y: 0.38 },
        { x: 0.58, y: 0.48 }, { x: 0.68, y: 0.62 }, { x: 0.78, y: 0.78 },
        { x: 0.88, y: 0.90 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
      outline: [
        { x: 0.04, y: 0.62 }, { x: 0.22, y: 0.36 }, { x: 0.42, y: 0.30 },
        { x: 0.60, y: 0.40 }, { x: 0.72, y: 0.56 }, { x: 0.82, y: 0.74 },
        { x: 0.96, y: 0.98 }
      ]
    },
    {
      nameEn: 'Gemini',
      stars: [
        { x: 0.35, y: 0.12 }, { x: 0.58, y: 0.10 }, { x: 0.38, y: 0.44 },
        { x: 0.60, y: 0.42 }, { x: 0.32, y: 0.76 }, { x: 0.62, y: 0.74 }
      ],
      lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [2, 3]],
      outline: [
        { x: 0.28, y: 0.04 }, { x: 0.64, y: 0.02 }, { x: 0.68, y: 0.48 },
        { x: 0.70, y: 0.84 }, { x: 0.54, y: 0.86 }, { x: 0.52, y: 0.50 },
        { x: 0.34, y: 0.48 }, { x: 0.28, y: 0.84 }, { x: 0.18, y: 0.82 },
        { x: 0.22, y: 0.46 }
      ]
    },
    {
      nameEn: 'Leo',
      stars: [
        { x: 0.12, y: 0.78 }, { x: 0.22, y: 0.58 }, { x: 0.38, y: 0.38 },
        { x: 0.54, y: 0.26 }, { x: 0.70, y: 0.30 }, { x: 0.84, y: 0.46 },
        { x: 0.76, y: 0.68 }, { x: 0.54, y: 0.82 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 5]],
      outline: [
        { x: 0.06, y: 0.88 }, { x: 0.14, y: 0.52 }, { x: 0.30, y: 0.26 },
        { x: 0.52, y: 0.14 }, { x: 0.76, y: 0.18 }, { x: 0.94, y: 0.44 },
        { x: 0.84, y: 0.76 }, { x: 0.48, y: 0.92 }
      ]
    },
    {
      nameEn: 'Crux',
      stars: [
        { x: 0.50, y: 0.08 }, { x: 0.50, y: 0.92 },
        { x: 0.18, y: 0.52 }, { x: 0.82, y: 0.48 }
      ],
      lines: [[0, 1], [2, 3]],
      outline: [
        { x: 0.50, y: 0.00 }, { x: 0.90, y: 0.48 }, { x: 0.50, y: 1.00 },
        { x: 0.10, y: 0.52 }
      ]
    },
    {
      nameEn: 'Libra',
      stars: [
        { x: 0.08, y: 0.50 }, { x: 0.32, y: 0.28 }, { x: 0.50, y: 0.54 },
        { x: 0.68, y: 0.28 }, { x: 0.92, y: 0.50 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 3]],
      outline: [
        { x: 0.02, y: 0.56 }, { x: 0.28, y: 0.18 }, { x: 0.50, y: 0.62 },
        { x: 0.72, y: 0.18 }, { x: 0.98, y: 0.56 }
      ]
    },
    {
      nameEn: 'Taurus',
      stars: [
        { x: 0.50, y: 0.78 }, { x: 0.28, y: 0.22 }, { x: 0.72, y: 0.22 },
        { x: 0.38, y: 0.42 }, { x: 0.62, y: 0.42 }
      ],
      lines: [[1, 3], [3, 0], [0, 4], [4, 2], [1, 2]],
      outline: [
        { x: 0.18, y: 0.12 }, { x: 0.34, y: 0.40 }, { x: 0.46, y: 0.90 },
        { x: 0.54, y: 0.90 }, { x: 0.66, y: 0.40 }, { x: 0.82, y: 0.12 }
      ]
    },
    {
      nameEn: 'Aries',
      stars: [
        { x: 0.12, y: 0.62 }, { x: 0.42, y: 0.40 }, { x: 0.72, y: 0.24 },
        { x: 0.90, y: 0.12 }
      ],
      lines: [[0, 1], [1, 2], [2, 3]],
      outline: [
        { x: 0.04, y: 0.70 }, { x: 0.18, y: 0.58 }, { x: 0.36, y: 0.46 },
        { x: 0.54, y: 0.32 }, { x: 0.72, y: 0.18 }, { x: 0.88, y: 0.06 },
        { x: 0.78, y: 0.22 }, { x: 0.58, y: 0.38 }, { x: 0.38, y: 0.52 },
        { x: 0.18, y: 0.66 }
      ]
    },
    {
      nameEn: 'Lyra',
      stars: [
        { x: 0.50, y: 0.06 }, { x: 0.34, y: 0.34 }, { x: 0.66, y: 0.34 },
        { x: 0.40, y: 0.56 }, { x: 0.50, y: 0.88 }
      ],
      lines: [[0, 1], [0, 2], [1, 3], [2, 3], [3, 4]],
      outline: [
        { x: 0.50, y: -0.02 }, { x: 0.26, y: 0.32 }, { x: 0.74, y: 0.30 },
        { x: 0.54, y: 0.62 }, { x: 0.50, y: 0.98 }, { x: 0.32, y: 0.62 }
      ]
    },
    {
      nameEn: 'Aquila',
      stars: [
        { x: 0.50, y: 0.08 }, { x: 0.28, y: 0.40 }, { x: 0.50, y: 0.54 },
        { x: 0.72, y: 0.40 }, { x: 0.50, y: 0.90 }
      ],
      lines: [[0, 2], [1, 2], [3, 2], [2, 4], [1, 3]],
      outline: [
        { x: 0.50, y: 0.00 }, { x: 0.18, y: 0.40 }, { x: 0.50, y: 0.62 },
        { x: 0.82, y: 0.40 }, { x: 0.50, y: 0.98 }
      ]
    },
    {
      nameEn: 'Sagittarius',
      stars: [
        { x: 0.18, y: 0.34 }, { x: 0.34, y: 0.24 }, { x: 0.54, y: 0.28 },
        { x: 0.70, y: 0.44 }, { x: 0.66, y: 0.64 }, { x: 0.44, y: 0.76 },
        { x: 0.28, y: 0.60 }, { x: 0.38, y: 0.48 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1], [2, 7]],
      outline: [
        { x: 0.10, y: 0.40 }, { x: 0.26, y: 0.14 }, { x: 0.54, y: 0.18 },
        { x: 0.78, y: 0.36 }, { x: 0.76, y: 0.62 }, { x: 0.58, y: 0.78 },
        { x: 0.36, y: 0.86 }, { x: 0.18, y: 0.68 }
      ]
    },
    {
      nameEn: 'Cancer',
      stars: [
        { x: 0.18, y: 0.38 }, { x: 0.38, y: 0.22 }, { x: 0.62, y: 0.28 },
        { x: 0.78, y: 0.48 }, { x: 0.56, y: 0.66 }, { x: 0.34, y: 0.60 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
      outline: [
        { x: 0.10, y: 0.44 }, { x: 0.32, y: 0.12 }, { x: 0.68, y: 0.18 },
        { x: 0.88, y: 0.46 }, { x: 0.62, y: 0.76 }, { x: 0.26, y: 0.68 }
      ]
    },
    {
      nameEn: 'Pegasus',
      stars: [
        { x: 0.14, y: 0.28 }, { x: 0.54, y: 0.12 }, { x: 0.86, y: 0.38 },
        { x: 0.46, y: 0.54 }, { x: 0.24, y: 0.76 }, { x: 0.66, y: 0.80 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [2, 5]],
      outline: [
        { x: 0.06, y: 0.24 }, { x: 0.52, y: 0.04 }, { x: 0.94, y: 0.32 },
        { x: 0.74, y: 0.56 }, { x: 0.72, y: 0.88 }, { x: 0.42, y: 0.58 },
        { x: 0.16, y: 0.84 }
      ]
    },
    {
      nameEn: 'Perseus',
      stars: [
        { x: 0.50, y: 0.08 }, { x: 0.34, y: 0.32 }, { x: 0.66, y: 0.30 },
        { x: 0.22, y: 0.58 }, { x: 0.50, y: 0.72 }, { x: 0.78, y: 0.56 }
      ],
      lines: [[0, 1], [0, 2], [1, 3], [2, 5], [3, 4], [4, 5]],
      outline: [
        { x: 0.48, y: 0.00 }, { x: 0.24, y: 0.28 }, { x: 0.12, y: 0.64 },
        { x: 0.44, y: 0.80 }, { x: 0.86, y: 0.58 }, { x: 0.72, y: 0.22 }
      ]
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
    var cOutline = []

    for (var s = 0; s < def.stars.length; s++) {
      var pt = def.stars[s]
      var lx = (pt.x - 0.5) * scale
      var ly = (pt.y - 0.5) * scale
      var star = createStar(1.0, 2.2, 0.45, 1, 0.012)
      star.x = cx + lx * cosA - ly * sinA
      star.y = cy + lx * sinA + ly * cosA
      cStars.push(star)
    }

    if (def.outline) {
      for (var o = 0; o < def.outline.length; o++) {
        var opt = def.outline[o]
        var olx = (opt.x - 0.5) * scale
        var oly = (opt.y - 0.5) * scale
        cOutline.push({
          x: cx + olx * cosA - oly * sinA,
          y: cy + olx * sinA + oly * cosA
        })
      }
    }

    return { nameEn: def.nameEn, stars: cStars, lines: def.lines, outline: cOutline }
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

  function drawRoundedRect (x, y, rw, rh, r) {
    r = Math.min(r, rw / 2, rh / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + rw - r, y)
    ctx.quadraticCurveTo(x + rw, y, x + rw, y + r)
    ctx.lineTo(x + rw, y + rh - r)
    ctx.quadraticCurveTo(x + rw, y + rh, x + rw - r, y + rh)
    ctx.lineTo(x + r, y + rh)
    ctx.quadraticCurveTo(x, y + rh, x, y + rh - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  function getConstellationBounds (con) {
    var pts = (con.outline && con.outline.length) ? con.outline : con.stars
    var minX = Infinity
    var minY = Infinity
    var maxX = -Infinity
    var maxY = -Infinity
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i]
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
    var pad = Math.max(10, Math.min(w, h) * 0.012)
    return {
      cx: (minX + maxX) / 2,
      top: minY - pad
    }
  }

  function drawConstellationOutline (con, opacity) {
    if (!con || !con.outline || con.outline.length < 3 || opacity <= 0.01) return
    var envA = opacity * 0.24
    if (envA <= 0.01) return

    ctx.save()
    ctx.setLineDash([4, 5])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(con.outline[0].x, con.outline[0].y)
    for (var i = 1; i < con.outline.length; i++) {
      ctx.lineTo(con.outline[i].x, con.outline[i].y)
    }
    ctx.closePath()
    ctx.strokeStyle = 'rgba(150,190,255,' + envA.toFixed(2) + ')'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.restore()
  }

  function drawConstellationLabel (con, opacity) {
    if (!con || !con.nameEn || opacity <= 0.01) return
    var b = getConstellationBounds(con)
    var labelA = opacity * 0.75
    if (labelA <= 0.01) return

    var fontSize = Math.max(11, Math.min(14, Math.min(w, h) * 0.017))
    ctx.save()
    ctx.font = '500 ' + fontSize + 'px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'

    var text = con.nameEn
    var tw = ctx.measureText(text).width
    var tx = b.cx
    var ty = b.top - 4
    var padX = 7
    var padY = 3
    var boxW = tw + padX * 2
    var boxH = fontSize + padY * 2
    var boxX = tx - boxW / 2
    var boxY = ty - boxH + padY

    drawRoundedRect(boxX, boxY, boxW, boxH, 5)
    ctx.fillStyle = 'rgba(8,16,32,' + (labelA * 0.5).toFixed(2) + ')'
    ctx.fill()
    ctx.strokeStyle = 'rgba(150,190,255,' + (labelA * 0.3).toFixed(2) + ')'
    ctx.lineWidth = 0.7
    ctx.setLineDash([])
    ctx.stroke()

    ctx.fillStyle = 'rgba(215,230,255,' + labelA.toFixed(2) + ')'
    ctx.fillText(text, tx, ty)
    ctx.restore()
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
    drawConstellationOutline(con, opacity)
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
    drawConstellationLabel(con, opacity)
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
      nameEn: con && con.nameEn,
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
