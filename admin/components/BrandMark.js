// Brand mark for SmartSetupUAE — replicates the official brand guidelines sheet.
// 3 elements composed together:
//   1. UAE skyline silhouette on the LEFT (Burj Khalifa tall spire + cluster of buildings)
//   2. Cursive/script S monogram with parallel gold accent stroke
//   3. Bold gold ascending swoosh sweeping up through the bottom of the S
// Brand palette: green #0A3D34, gold #D4AF37, off-white #F5F7FA
// Wordmark: Poppins SemiBold / 700 — "SMARTSETUP" (green) + "UAE" (gold)
// Tagline: Poppins Regular — flanked by decorative dashes — "— SETUP SMART. GROW FAST. —"

export default function BrandMark({
  size = 56,
  variant = 'default', // 'default' | 'dark' | 'mono-white' | 'mono-gold'
  showWordmark = false,
  showTagline = false,
}) {
  const GREEN = '#0A3D34';
  const GOLD = '#D4AF37';
  const WHITE = '#FFFFFF';

  let mainColor = GREEN;
  let accentColor = GOLD;
  let skylineColor = GREEN;
  let wordGreen = GREEN;
  let wordGold = GOLD;
  let tagColor = GREEN;
  let dashColor = GOLD;

  if (variant === 'dark') {
    mainColor = WHITE;
    accentColor = GOLD;
    skylineColor = WHITE;
    wordGreen = WHITE;
    wordGold = GOLD;
    tagColor = WHITE;
    dashColor = GOLD;
  } else if (variant === 'mono-white') {
    mainColor = WHITE; accentColor = WHITE; skylineColor = WHITE;
    wordGreen = WHITE; wordGold = WHITE; tagColor = WHITE; dashColor = WHITE;
  } else if (variant === 'mono-gold') {
    mainColor = GOLD; accentColor = GOLD; skylineColor = GOLD;
    wordGreen = GOLD; wordGold = GOLD; tagColor = GOLD; dashColor = GOLD;
  }

  return (
    <div className="inline-flex items-center gap-3" style={{ fontFamily: "'Poppins', system-ui, -apple-system, sans-serif" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 220 220"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="SmartSetupUAE"
      >
        {/* ===== UAE SKYLINE (left of S) ===== */}
        <g fill={skylineColor}>
          {/* Burj Khalifa — tall central spire, tapered */}
          <polygon points="62,52 66,52 67.5,158 60.5,158" />
          <polygon points="63.5,30 64.5,30 65.5,52 62,52" />
          <rect x="63.7" y="20" width="0.6" height="10" />
          {/* Right of Burj — stepped towers */}
          <rect x="70" y="92" width="5" height="66" />
          <polygon points="76,82 80,82 81,158 75,158" />
          <rect x="82" y="100" width="4" height="58" />
          {/* Left of Burj — smaller cluster */}
          <rect x="48" y="118" width="5" height="40" />
          <rect x="54" y="106" width="4" height="52" />
          <polygon points="38,128 41,128 41.5,158 37.5,158" />
          <rect x="44" y="138" width="3" height="20" />
        </g>

        {/* ===== ASCENDING GOLD SWOOSH (bottom, sweeping up-right) ===== */}
        <path
          d="M 18 178
             C 50 168, 92 158, 130 148
             C 160 140, 184 134, 208 124
             L 208 138
             C 184 152, 160 160, 130 168
             C 92 180, 50 188, 18 196 Z"
          fill={accentColor}
        />

        {/* ===== CURSIVE S MONOGRAM (main green stroke) ===== */}
        <path
          d="M 168 50
             C 168 38, 156 30, 138 30
             C 118 30, 104 40, 104 58
             C 104 76, 120 84, 138 88
             C 158 92, 174 102, 174 122
             C 174 142, 158 154, 134 154
             C 112 154, 96 144, 92 128"
          stroke={mainColor}
          strokeWidth="20"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* ===== GOLD PARALLEL ACCENT ON S (subtle, slightly offset, gives the dual-tone look) ===== */}
        <path
          d="M 158 56
             C 158 48, 150 42, 138 42"
          stroke={accentColor}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          opacity={variant === 'mono-white' ? '0.6' : '1'}
        />
        <path
          d="M 170 120
             C 170 132, 158 142, 142 142"
          stroke={accentColor}
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          opacity={variant === 'mono-white' ? '0.6' : '1'}
        />
      </svg>

      {showWordmark && (
        <div className="flex flex-col leading-none">
          <div
            className="tracking-tight"
            style={{
              fontSize: size * 0.46,
              letterSpacing: '0.005em',
              lineHeight: 1,
              fontWeight: 700,
            }}
          >
            <span style={{ color: wordGreen }}>SMARTSETUP</span>
            <span style={{ color: wordGold }}>UAE</span>
          </div>
          {showTagline && (
            <div
              className="mt-1.5 flex items-center gap-1.5"
              style={{
                fontSize: Math.max(8, size * 0.135),
                letterSpacing: '0.28em',
                color: tagColor,
                fontWeight: 500,
              }}
            >
              <span style={{ display: 'inline-block', width: '14px', height: '1px', background: dashColor }} />
              SETUP SMART. GROW FAST.
              <span style={{ display: 'inline-block', width: '14px', height: '1px', background: dashColor }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
