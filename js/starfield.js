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

  // IAU stick figures (S&T/IAU) + Delporte 1930 boundaries via dieghernan/celestial_data
  var CONSTELLATION_DEFS = [
    {
      nameEn: 'Big Dipper',
      stars: [
        { x: 0.351, y: 0.5857 },
        { x: 0.4171, y: 0.5143 },
        { x: 0.5805, y: 0.5323 },
        { x: 0.7131, y: 0.5359 },
        { x: 0.8704, y: 0.6668 },
        { x: 0.3548, y: 0.4829 },
        { x: 0.1593, y: 0.3418 },
        { x: 0.1118, y: 0.4985 },
        { x: 0.3223, y: 0.6132 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [5, 6], [6, 7], [7, 8], [8, 0]],
      outlines: [
        [{ x: 0.06, y: 0.4932 }, { x: 0.3042, y: 0.6263 }, { x: 0.94, y: 0.6885 }, { x: 0.7575, y: 0.5366 }, { x: 0.1152, y: 0.3115 }],
      ]
    },
    {
      nameEn: 'Cassiopeia',
      stars: [
        { x: 0.6512, y: 0.4814 },
        { x: 0.5829, y: 0.5794 },
        { x: 0.4934, y: 0.5726 },
        { x: 0.4383, y: 0.6747 },
        { x: 0.343, y: 0.5984 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4]],
      outlines: [
        [{ x: 0.06, y: 0.6654 }, { x: 0.0996, y: 0.579 }, { x: 0.1299, y: 0.5142 }, { x: 0.1834, y: 0.5372 }, { x: 0.2196, y: 0.4457 }, { x: 0.2868, y: 0.469 }, { x: 0.3081, y: 0.3969 }, { x: 0.4201, y: 0.4199 }, { x: 0.4531, y: 0.1445 }, { x: 0.705, y: 0.0784 }, { x: 0.8399, y: 0.2665 }, { x: 0.8017, y: 0.2911 }, { x: 0.94, y: 0.5341 }, { x: 0.8148, y: 0.5911 }, { x: 0.8018, y: 0.5558 }, { x: 0.7034, y: 0.5859 }, { x: 0.7092, y: 0.6102 }, { x: 0.6683, y: 0.6191 }, { x: 0.6847, y: 0.7047 }, { x: 0.6124, y: 0.7157 }, { x: 0.6237, y: 0.8147 }, { x: 0.5638, y: 0.8198 }, { x: 0.5668, y: 0.8696 }, { x: 0.5041, y: 0.8716 }, { x: 0.5044, y: 0.9216 }, { x: 0.3222, y: 0.9096 }, { x: 0.3291, y: 0.8599 }, { x: 0.1852, y: 0.8305 }, { x: 0.1983, y: 0.7819 }, { x: 0.1402, y: 0.7645 }, { x: 0.1601, y: 0.7047 }],
      ]
    },
    {
      nameEn: 'Orion',
      stars: [
        { x: 0.7103, y: 0.2692 },
        { x: 0.6248, y: 0.1282 },
        { x: 0.6832, y: 0.1301 },
        { x: 0.7382, y: 0.2828 },
        { x: 0.6808, y: 0.4026 },
        { x: 0.6357, y: 0.4611 },
        { x: 0.4438, y: 0.4892 },
        { x: 0.2522, y: 0.3883 },
        { x: 0.2715, y: 0.6073 },
        { x: 0.2439, y: 0.5881 },
        { x: 0.2257, y: 0.5055 },
        { x: 0.2177, y: 0.4701 },
        { x: 0.224, y: 0.42 },
        { x: 0.2641, y: 0.3013 },
        { x: 0.3169, y: 0.2538 },
        { x: 0.349, y: 0.2495 },
        { x: 0.3741, y: 0.8666 },
        { x: 0.4389, y: 0.7151 },
        { x: 0.4877, y: 0.6608 },
        { x: 0.5077, y: 0.397 },
        { x: 0.5444, y: 0.7033 },
        { x: 0.5901, y: 0.9053 },
        { x: 0.515, y: 0.6841 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [8, 9], [9, 10], [10, 11], [11, 12], [12, 7], [7, 13], [13, 14], [14, 15], [16, 17], [17, 18], [18, 6], [6, 19], [19, 5], [5, 20], [20, 21], [20, 22], [22, 18]],
      outlines: [
        [{ x: 0.1724, y: 0.6444 }, { x: 0.1892, y: 0.2407 }, { x: 0.3207, y: 0.2468 }, { x: 0.3212, y: 0.2339 }, { x: 0.4581, y: 0.2377 }, { x: 0.4579, y: 0.2506 }, { x: 0.5575, y: 0.2516 }, { x: 0.5572, y: 0.3291 }, { x: 0.6202, y: 0.3291 }, { x: 0.6194, y: 0.1867 }, { x: 0.5947, y: 0.1869 }, { x: 0.5941, y: 0.0609 }, { x: 0.6606, y: 0.06 }, { x: 0.6612, y: 0.0949 }, { x: 0.7833, y: 0.0914 }, { x: 0.7872, y: 0.1964 }, { x: 0.8215, y: 0.1951 }, { x: 0.8263, y: 0.3389 }, { x: 0.8276, y: 0.391 }, { x: 0.802, y: 0.3916 }, { x: 0.805, y: 0.6521 }, { x: 0.8049, y: 0.757 }, { x: 0.6449, y: 0.756 }, { x: 0.6428, y: 0.94 }, { x: 0.3504, y: 0.9364 }, { x: 0.3527, y: 0.7525 }, { x: 0.1896, y: 0.7497 }, { x: 0.192, y: 0.6449 }],
      ]
    },
    {
      nameEn: 'Cygnus',
      stars: [
        { x: 0.7177, y: 0.864 },
        { x: 0.5575, y: 0.7807 },
        { x: 0.4253, y: 0.62 },
        { x: 0.2522, y: 0.4831 },
        { x: 0.2095, y: 0.3013 },
        { x: 0.1674, y: 0.249 },
        { x: 0.5133, y: 0.485 },
        { x: 0.286, y: 0.7518 },
        { x: 0.1229, y: 0.9265 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 2], [2, 7], [7, 8]],
      outlines: [
        [{ x: 0.0619, y: 0.924 }, { x: 0.0715, y: 0.8573 }, { x: 0.106, y: 0.8621 }, { x: 0.1292, y: 0.6902 }, { x: 0.1425, y: 0.692 }, { x: 0.1678, y: 0.5084 }, { x: 0.1015, y: 0.4975 }, { x: 0.1214, y: 0.3931 }, { x: 0.0993, y: 0.3887 }, { x: 0.1451, y: 0.1799 }, { x: 0.2196, y: 0.1942 }, { x: 0.2301, y: 0.128 }, { x: 0.3042, y: 0.1373 }, { x: 0.3077, y: 0.0972 }, { x: 0.3554, y: 0.1004 }, { x: 0.4649, y: 0.099 }, { x: 0.4623, y: 0.0609 }, { x: 0.4747, y: 0.06 }, { x: 0.4878, y: 0.2222 }, { x: 0.7958, y: 0.1548 }, { x: 0.8151, y: 0.2079 }, { x: 0.8924, y: 0.4309 }, { x: 0.8763, y: 0.4361 }, { x: 0.8783, y: 0.4425 }, { x: 0.8691, y: 0.4455 }, { x: 0.9294, y: 0.6454 }, { x: 0.8847, y: 0.6578 }, { x: 0.9381, y: 0.8681 }, { x: 0.8266, y: 0.8923 }, { x: 0.6502, y: 0.9192 }, { x: 0.6472, y: 0.8925 }, { x: 0.2105, y: 0.8999 }, { x: 0.2073, y: 0.94 }],
      ]
    },
    {
      nameEn: 'Scorpius',
      stars: [
        { x: 0.2399, y: 0.4803 },
        { x: 0.2401, y: 0.3998 },
        { x: 0.262, y: 0.333 },
        { x: 0.3535, y: 0.4599 },
        { x: 0.3963, y: 0.4771 },
        { x: 0.4301, y: 0.5167 },
        { x: 0.5003, y: 0.6541 },
        { x: 0.5071, y: 0.7396 },
        { x: 0.5171, y: 0.8383 },
        { x: 0.5901, y: 0.8618 },
        { x: 0.696, y: 0.8671 },
        { x: 0.7495, y: 0.8079 },
        { x: 0.7309, y: 0.7795 },
        { x: 0.6968, y: 0.7304 }
      ],
      lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
      outlines: [
        [{ x: 0.222, y: 0.0676 }, { x: 0.345, y: 0.06 }, { x: 0.3568, y: 0.2983 }, { x: 0.3923, y: 0.2967 }, { x: 0.3932, y: 0.3196 }, { x: 0.3581, y: 0.3213 }, { x: 0.3649, y: 0.443 }, { x: 0.5149, y: 0.4387 }, { x: 0.5147, y: 0.5617 }, { x: 0.7658, y: 0.5763 }, { x: 0.835, y: 0.5854 }, { x: 0.8102, y: 0.7452 }, { x: 0.7762, y: 0.94 }, { x: 0.4337, y: 0.917 }, { x: 0.4298, y: 0.8366 }, { x: 0.3225, y: 0.8452 }, { x: 0.2926, y: 0.5609 }, { x: 0.1938, y: 0.5727 }, { x: 0.165, y: 0.3557 }, { x: 0.246, y: 0.3469 }],
      ]
    },
    {
      nameEn: 'Gemini',
      stars: [
        { x: 0.165, y: 0.4899 },
        { x: 0.222, y: 0.4944 },
        { x: 0.3725, y: 0.4234 },
        { x: 0.5584, y: 0.2715 },
        { x: 0.71, y: 0.2169 },
        { x: 0.7881, y: 0.3303 },
        { x: 0.7268, y: 0.3685 },
        { x: 0.623, y: 0.5215 },
        { x: 0.5102, y: 0.5651 },
        { x: 0.3168, y: 0.6869 },
        { x: 0.3688, y: 0.7959 },
        { x: 0.6113, y: 0.6869 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [7, 11]],
      outlines: [
        [{ x: 0.2193, y: 0.819 }, { x: 0.2314, y: 0.6507 }, { x: 0.1914, y: 0.6475 }, { x: 0.2021, y: 0.5255 }, { x: 0.06, y: 0.5101 }, { x: 0.0652, y: 0.4693 }, { x: 0.0864, y: 0.3112 }, { x: 0.3488, y: 0.3383 }, { x: 0.3648, y: 0.1093 }, { x: 0.6771, y: 0.1156 }, { x: 0.821, y: 0.1072 }, { x: 0.826, y: 0.1687 }, { x: 0.9222, y: 0.1595 }, { x: 0.94, y: 0.3283 }, { x: 0.8927, y: 0.3327 }, { x: 0.912, y: 0.5772 }, { x: 0.8797, y: 0.5794 }, { x: 0.8914, y: 0.7786 }, { x: 0.7534, y: 0.7842 }, { x: 0.7543, y: 0.8148 }, { x: 0.5303, y: 0.8163 }, { x: 0.5293, y: 0.8928 }, { x: 0.4991, y: 0.8924 }, { x: 0.5002, y: 0.8311 }],
      ]
    },
    {
      nameEn: 'Leo',
      stars: [
        { x: 0.4041, y: 0.3672 },
        { x: 0.3905, y: 0.2903 },
        { x: 0.2773, y: 0.2278 },
        { x: 0.2395, y: 0.273 },
        { x: 0.3386, y: 0.5332 },
        { x: 0.3375, y: 0.4304 },
        { x: 0.6745, y: 0.3511 },
        { x: 0.8613, y: 0.4675 },
        { x: 0.6797, y: 0.4598 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [4, 5], [5, 0], [0, 6], [6, 7], [7, 8], [8, 4]],
      outlines: [
        [{ x: 0.5652, y: 0.808 }, { x: 0.5647, y: 0.6567 }, { x: 0.1904, y: 0.6458 }, { x: 0.0817, y: 0.6379 }, { x: 0.152, y: 0.06 }, { x: 0.325, y: 0.0815 }, { x: 0.316, y: 0.1897 }, { x: 0.4906, y: 0.1979 }, { x: 0.4891, y: 0.3048 }, { x: 0.5624, y: 0.3049 }, { x: 0.562, y: 0.2623 }, { x: 0.6344, y: 0.2607 }, { x: 0.6317, y: 0.1856 }, { x: 0.8775, y: 0.1652 }, { x: 0.9128, y: 0.4908 }, { x: 0.9183, y: 0.5562 }, { x: 0.8064, y: 0.5637 }, { x: 0.8171, y: 0.8036 }, { x: 0.8207, y: 0.9374 }, { x: 0.5653, y: 0.94 }],
      ]
    },
    {
      nameEn: 'Crux',
      stars: [
        { x: 0.741, y: 0.4519 },
        { x: 0.3472, y: 0.3436 },
        { x: 0.4773, y: 0.7604 },
        { x: 0.553, y: 0.1903 }
      ],
      lines: [[0, 1], [2, 3]],
      outlines: [
        [{ x: 0.0889, y: 0.064 }, { x: 0.1389, y: 0.06 }, { x: 0.2007, y: 0.9191 }, { x: 0.1623, y: 0.9223 }],
        [{ x: 0.7906, y: 0.94 }, { x: 0.2007, y: 0.9191 }, { x: 0.1389, y: 0.06 }, { x: 0.9111, y: 0.086 }],
      ]
    },
    {
      nameEn: 'Libra',
      stars: [
        { x: 0.351, y: 0.5257 },
        { x: 0.6691, y: 0.4878 },
        { x: 0.4491, y: 0.7973 },
        { x: 0.537, y: 0.3261 },
        { x: 0.6676, y: 0.8842 },
        { x: 0.6764, y: 0.9338 }
      ],
      lines: [[0, 1], [2, 0], [0, 3], [3, 1], [1, 4], [4, 5]],
      outlines: [
        [{ x: 0.4952, y: 0.06 }, { x: 0.4964, y: 0.1576 }, { x: 0.8709, y: 0.1601 }, { x: 0.8668, y: 0.303 }, { x: 0.8511, y: 0.6611 }, { x: 0.7463, y: 0.6565 }, { x: 0.7352, y: 0.94 }, { x: 0.4416, y: 0.9381 }, { x: 0.437, y: 0.789 }, { x: 0.1658, y: 0.8053 }, { x: 0.1592, y: 0.7305 }, { x: 0.1291, y: 0.3121 }, { x: 0.3141, y: 0.3035 }, { x: 0.3067, y: 0.0636 }],
      ]
    },
    {
      nameEn: 'Taurus',
      stars: [
        { x: 0.096, y: 0.6168 },
        { x: 0.0814, y: 0.6324 },
        { x: 0.1421, y: 0.8391 },
        { x: 0.3985, y: 0.4929 },
        { x: 0.2901, y: 0.5623 },
        { x: 0.2997, y: 0.713 },
        { x: 0.8197, y: 0.3513 },
        { x: 0.4875, y: 0.4732 },
        { x: 0.4475, y: 0.4878 },
        { x: 0.4164, y: 0.4492 },
        { x: 0.4477, y: 0.4119 },
        { x: 0.744, y: 0.1825 }
      ],
      lines: [[0, 1], [1, 2], [3, 4], [4, 0], [0, 5], [6, 7], [7, 8], [8, 3], [3, 9], [9, 10], [10, 11]],
      outlines: [
        [{ x: 0.06, y: 0.8768 }, { x: 0.0621, y: 0.8349 }, { x: 0.0775, y: 0.6007 }, { x: 0.0967, y: 0.3886 }, { x: 0.1242, y: 0.3913 }, { x: 0.154, y: 0.1186 }, { x: 0.4964, y: 0.1404 }, { x: 0.4963, y: 0.156 }, { x: 0.572, y: 0.1554 }, { x: 0.5727, y: 0.1904 }, { x: 0.9233, y: 0.1637 }, { x: 0.9249, y: 0.1755 }, { x: 0.94, y: 0.2979 }, { x: 0.8803, y: 0.3043 }, { x: 0.8907, y: 0.4177 }, { x: 0.913, y: 0.4158 }, { x: 0.9236, y: 0.5452 }, { x: 0.8662, y: 0.5491 }, { x: 0.8616, y: 0.4789 }, { x: 0.7718, y: 0.4843 }, { x: 0.7712, y: 0.4727 }, { x: 0.649, y: 0.4775 }, { x: 0.6493, y: 0.4891 }, { x: 0.533, y: 0.4906 }, { x: 0.5322, y: 0.8486 }, { x: 0.1689, y: 0.84 }, { x: 0.1673, y: 0.8814 }],
      ]
    },
    {
      nameEn: 'Aries',
      stars: [
        { x: 0.5991, y: 0.2825 },
        { x: 0.2557, y: 0.4184 },
        { x: 0.1483, y: 0.5083 },
        { x: 0.1362, y: 0.5618 }
      ],
      lines: [[0, 1], [1, 2], [2, 3]],
      outlines: [
        [{ x: 0.2374, y: 0.8803 }, { x: 0.06, y: 0.8724 }, { x: 0.0963, y: 0.3327 }, { x: 0.2173, y: 0.3405 }, { x: 0.2216, y: 0.2604 }, { x: 0.4589, y: 0.2667 }, { x: 0.4588, y: 0.1448 }, { x: 0.5971, y: 0.1422 }, { x: 0.898, y: 0.1197 }, { x: 0.94, y: 0.539 }, { x: 0.8975, y: 0.5425 }, { x: 0.9206, y: 0.8704 }],
      ]
    },
    {
      nameEn: 'Lyra',
      stars: [
        { x: 0.4557, y: 0.4678 },
        { x: 0.4547, y: 0.3887 },
        { x: 0.3967, y: 0.4192 },
        { x: 0.5316, y: 0.4966 },
        { x: 0.5684, y: 0.6622 },
        { x: 0.4952, y: 0.6357 }
      ],
      lines: [[0, 1], [1, 2], [2, 0], [0, 3], [3, 4], [4, 5], [5, 0]],
      outlines: [
        [{ x: 0.5549, y: 0.94 }, { x: 0.5545, y: 0.9202 }, { x: 0.287, y: 0.9162 }, { x: 0.295, y: 0.7577 }, { x: 0.1965, y: 0.7512 }, { x: 0.259, y: 0.06 }, { x: 0.2825, y: 0.0623 }, { x: 0.6252, y: 0.0678 }, { x: 0.6587, y: 0.0656 }, { x: 0.6701, y: 0.224 }, { x: 0.7703, y: 0.215 }, { x: 0.7995, y: 0.4904 }, { x: 0.7798, y: 0.4924 }, { x: 0.8035, y: 0.7482 }, { x: 0.7522, y: 0.7525 }, { x: 0.7596, y: 0.8512 }, { x: 0.7653, y: 0.9305 }],
      ]
    },
    {
      nameEn: 'Aquila',
      stars: [
        { x: 0.5421, y: 0.2951 },
        { x: 0.5743, y: 0.3447 },
        { x: 0.6069, y: 0.4146 },
        { x: 0.7225, y: 0.6203 },
        { x: 0.5876, y: 0.5687 },
        { x: 0.3956, y: 0.5088 },
        { x: 0.2574, y: 0.2002 },
        { x: 0.2574, y: 0.7371 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [1, 5], [5, 7]],
      outlines: [
        [{ x: 0.0792, y: 0.5922 }, { x: 0.0793, y: 0.5344 }, { x: 0.2015, y: 0.5345 }, { x: 0.2017, y: 0.4127 }, { x: 0.1141, y: 0.4121 }, { x: 0.1166, y: 0.2463 }, { x: 0.2031, y: 0.2478 }, { x: 0.2064, y: 0.06 }, { x: 0.2614, y: 0.061 }, { x: 0.2605, y: 0.1285 }, { x: 0.6059, y: 0.1259 }, { x: 0.6062, y: 0.1379 }, { x: 0.7345, y: 0.1334 }, { x: 0.7421, y: 0.342 }, { x: 0.8096, y: 0.3397 }, { x: 0.8151, y: 0.5268 }, { x: 0.9162, y: 0.5242 }, { x: 0.9176, y: 0.5822 }, { x: 0.9208, y: 0.845 }, { x: 0.6902, y: 0.8458 }, { x: 0.6906, y: 0.9341 }, { x: 0.2062, y: 0.94 }, { x: 0.2025, y: 0.7069 }, { x: 0.0799, y: 0.7081 }],
      ]
    },
    {
      nameEn: 'Sagittarius',
      stars: [
        { x: 0.2946, y: 0.6789 },
        { x: 0.3205, y: 0.621 },
        { x: 0.2963, y: 0.517 },
        { x: 0.3247, y: 0.4128 },
        { x: 0.2418, y: 0.3174 },
        { x: 0.5865, y: 0.8515 },
        { x: 0.5972, y: 0.7618 },
        { x: 0.5044, y: 0.5102 },
        { x: 0.4177, y: 0.4448 },
        { x: 0.5164, y: 0.3228 },
        { x: 0.479, y: 0.3081 },
        { x: 0.4603, y: 0.3461 },
        { x: 0.4669, y: 0.4278 },
        { x: 0.7321, y: 0.8046 },
        { x: 0.7737, y: 0.6539 },
        { x: 0.78, y: 0.4436 },
        { x: 0.6832, y: 0.4019 },
        { x: 0.6238, y: 0.3897 },
        { x: 0.5722, y: 0.4049 },
        { x: 0.2218, y: 0.5383 },
        { x: 0.5267, y: 0.4596 },
        { x: 0.5439, y: 0.3066 },
        { x: 0.5878, y: 0.2597 },
        { x: 0.6108, y: 0.2348 },
        { x: 0.6127, y: 0.1909 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 3], [9, 10], [10, 11], [11, 12], [13, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 12], [12, 8], [8, 2], [2, 19], [19, 1], [1, 7], [7, 20], [20, 12], [12, 9], [9, 21], [21, 22], [22, 23], [23, 24]],
      outlines: [
        [{ x: 0.4853, y: 0.0933 }, { x: 0.8772, y: 0.1079 }, { x: 0.8372, y: 0.4823 }, { x: 0.94, y: 0.4974 }, { x: 0.8601, y: 0.9067 }, { x: 0.5706, y: 0.87 }, { x: 0.5767, y: 0.6713 }, { x: 0.2065, y: 0.6957 }, { x: 0.1817, y: 0.5337 }, { x: 0.1115, y: 0.545 }, { x: 0.06, y: 0.2185 }, { x: 0.2797, y: 0.195 }, { x: 0.4866, y: 0.1859 }],
      ]
    },
    {
      nameEn: 'Cancer',
      stars: [
        { x: 0.5403, y: 0.5634 },
        { x: 0.3194, y: 0.8567 },
        { x: 0.6553, y: 0.7652 },
        { x: 0.5269, y: 0.4558 },
        { x: 0.5447, y: 0.2167 }
      ],
      lines: [[0, 1], [2, 0], [0, 3], [3, 4]],
      outlines: [
        [{ x: 0.8513, y: 0.9343 }, { x: 0.2792, y: 0.94 }, { x: 0.2018, y: 0.9378 }, { x: 0.2052, y: 0.8394 }, { x: 0.1487, y: 0.8371 }, { x: 0.1539, y: 0.7227 }, { x: 0.1647, y: 0.5108 }, { x: 0.1991, y: 0.5125 }, { x: 0.2126, y: 0.2515 }, { x: 0.2632, y: 0.254 }, { x: 0.2714, y: 0.0731 }, { x: 0.7893, y: 0.06 }],
      ]
    },
    {
      nameEn: 'Pegasus',
      stars: [
        { x: 0.373, y: 0.2395 },
        { x: 0.5068, y: 0.3013 },
        { x: 0.5947, y: 0.341 },
        { x: 0.8674, y: 0.2953 },
        { x: 0.9272, y: 0.5644 },
        { x: 0.6069, y: 0.5877 },
        { x: 0.5235, y: 0.6472 },
        { x: 0.4988, y: 0.673 },
        { x: 0.3474, y: 0.7598 },
        { x: 0.2254, y: 0.6816 },
        { x: 0.537, y: 0.4091 },
        { x: 0.522, y: 0.429 },
        { x: 0.3506, y: 0.3899 },
        { x: 0.2537, y: 0.376 }
      ],
      lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [5, 2], [2, 10], [10, 11], [11, 12], [12, 13]],
      outlines: [
        [{ x: 0.1275, y: 0.8207 }, { x: 0.1434, y: 0.6123 }, { x: 0.0808, y: 0.6061 }, { x: 0.0794, y: 0.6193 }, { x: 0.06, y: 0.6172 }, { x: 0.0788, y: 0.4656 }, { x: 0.1343, y: 0.4727 }, { x: 0.144, y: 0.3946 }, { x: 0.1887, y: 0.4001 }, { x: 0.1993, y: 0.3125 }, { x: 0.2807, y: 0.3214 }, { x: 0.2963, y: 0.1656 }, { x: 0.33, y: 0.1689 }, { x: 0.3597, y: 0.1713 }, { x: 0.3582, y: 0.1909 }, { x: 0.5538, y: 0.1954 }, { x: 0.554, y: 0.2051 }, { x: 0.5661, y: 0.2048 }, { x: 0.7186, y: 0.194 }, { x: 0.7236, y: 0.2411 }, { x: 0.7855, y: 0.2337 }, { x: 0.7875, y: 0.2484 }, { x: 0.85, y: 0.2392 }, { x: 0.8602, y: 0.3043 }, { x: 0.8775, y: 0.3016 }, { x: 0.895, y: 0.4189 }, { x: 0.9154, y: 0.4159 }, { x: 0.9183, y: 0.4355 }, { x: 0.94, y: 0.6027 }, { x: 0.8991, y: 0.6072 }, { x: 0.9041, y: 0.6565 }, { x: 0.8556, y: 0.6609 }, { x: 0.8596, y: 0.7101 }, { x: 0.5457, y: 0.7244 }, { x: 0.5469, y: 0.8314 }, { x: 0.3263, y: 0.8295 }, { x: 0.3261, y: 0.8344 }, { x: 0.2272, y: 0.8309 }, { x: 0.228, y: 0.8111 }, { x: 0.1684, y: 0.808 }, { x: 0.1676, y: 0.823 }],
      ]
    },
    {
      nameEn: 'Perseus',
      stars: [
        { x: 0.4424, y: 0.403 },
        { x: 0.3428, y: 0.408 },
        { x: 0.1133, y: 0.3284 },
        { x: 0.6255, y: 0.8211 },
        { x: 0.6782, y: 0.8256 },
        { x: 0.6904, y: 0.7258 },
        { x: 0.6705, y: 0.623 },
        { x: 0.6045, y: 0.5673 },
        { x: 0.5814, y: 0.441 },
        { x: 0.5542, y: 0.4336 },
        { x: 0.5027, y: 0.3958 },
        { x: 0.4273, y: 0.3072 },
        { x: 0.3797, y: 0.2462 },
        { x: 0.3877, y: 0.3241 },
        { x: 0.4436, y: 0.5196 },
        { x: 0.4371, y: 0.6153 },
        { x: 0.4517, y: 0.6484 },
        { x: 0.4224, y: 0.6671 },
        { x: 0.3924, y: 0.6461 },
        { x: 0.3978, y: 0.6126 },
        { x: 0.6669, y: 0.365 },
        { x: 0.709, y: 0.4057 },
        { x: 0.6871, y: 0.4276 }
      ],
      lines: [[0, 1], [1, 2], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [13, 0], [0, 14], [14, 15], [15, 16], [16, 17], [17, 18], [18, 19], [19, 15], [20, 21], [21, 22], [22, 8]],
      outlines: [
        [{ x: 0.3413, y: 0.8538 }, { x: 0.3467, y: 0.7711 }, { x: 0.3006, y: 0.7674 }, { x: 0.3069, y: 0.6996 }, { x: 0.2921, y: 0.6982 }, { x: 0.3287, y: 0.3618 }, { x: 0.2184, y: 0.344 }, { x: 0.2009, y: 0.4287 }, { x: 0.1084, y: 0.4063 }, { x: 0.1288, y: 0.3345 }, { x: 0.06, y: 0.3125 }, { x: 0.0939, y: 0.218 }, { x: 0.1638, y: 0.2408 }, { x: 0.1885, y: 0.1569 }, { x: 0.229, y: 0.168 }, { x: 0.2351, y: 0.1437 }, { x: 0.3358, y: 0.1634 }, { x: 0.3307, y: 0.2003 }, { x: 0.4652, y: 0.2095 }, { x: 0.4787, y: 0.2094 }, { x: 0.4794, y: 0.2588 }, { x: 0.5147, y: 0.2578 }, { x: 0.5176, y: 0.3193 }, { x: 0.8192, y: 0.2639 }, { x: 0.94, y: 0.6607 }, { x: 0.8831, y: 0.6756 }, { x: 0.9145, y: 0.8071 }, { x: 0.5503, y: 0.8563 }],
      ]
    },
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
    var cOutlines = []

    for (var s = 0; s < def.stars.length; s++) {
      var pt = def.stars[s]
      var lx = (pt.x - 0.5) * scale
      var ly = (pt.y - 0.5) * scale
      var star = createStar(1.0, 2.2, 0.45, 1, 0.012)
      star.x = cx + lx * cosA - ly * sinA
      star.y = cy + lx * sinA + ly * cosA
      cStars.push(star)
    }

    var outlineSrc = def.outlines || (def.outline ? [def.outline] : [])
    for (var r = 0; r < outlineSrc.length; r++) {
      var ring = outlineSrc[r]
      var cRing = []
      for (var o = 0; o < ring.length; o++) {
        var opt = ring[o]
        var olx = (opt.x - 0.5) * scale
        var oly = (opt.y - 0.5) * scale
        cRing.push({
          x: cx + olx * cosA - oly * sinA,
          y: cy + olx * sinA + oly * cosA
        })
      }
      cOutlines.push(cRing)
    }

    return { nameEn: def.nameEn, stars: cStars, lines: def.lines, outlines: cOutlines }
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
    var pts = con.stars
    if (con.outlines && con.outlines.length) {
      pts = []
      for (var r = 0; r < con.outlines.length; r++) {
        pts = pts.concat(con.outlines[r])
      }
    } else if (con.outline && con.outline.length) {
      pts = con.outline
    }
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
    if (!con || opacity <= 0.01) return
    var rings = con.outlines || (con.outline ? [con.outline] : [])
    if (!rings.length) return
    var envA = opacity * 0.24
    if (envA <= 0.01) return

    ctx.save()
    ctx.setLineDash([4, 5])
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(150,190,255,' + envA.toFixed(2) + ')'
    ctx.lineWidth = 1

    for (var r = 0; r < rings.length; r++) {
      var ring = rings[r]
      if (!ring || ring.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(ring[0].x, ring[0].y)
      for (var i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x, ring[i].y)
      }
      ctx.closePath()
      ctx.stroke()
    }
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
