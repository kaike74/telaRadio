# News Ticker Visual Preview

## Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                    DASHBOARD (100vh - 60px)                     │
│  ┌───────────────────────┐  ┌───────────────────────────────┐  │
│  │   LEFT COLUMN (50%)    │  │   RIGHT COLUMN (50%)          │  │
│  │  ┌─────────────────┐   │  │  ┌───────────────────────┐    │  │
│  │  │  MAPA + PINGAS  │   │  │  │  MÉTRICAS             │    │  │
│  │  │                 │   │  │  │  ┌─────────────────┐  │    │  │
│  │  │  🔴 Pinga dots  │   │  │  │  │ Campanhas       │  │    │  │
│  │  │                 │   │  │  │  │ Emissoras       │  │    │  │
│  │  │                 │   │  │  │  │ Inserções       │  │    │  │
│  │  └─────────────────┘   │  │  │  └─────────────────┘  │    │  │
│  │  ┌─────────────────┐   │  │  │                       │    │  │
│  │  │ LATEST INSERTS  │   │  │  │  ┌───────────────┐   │    │  │
│  │  │ • Emissora 1    │   │  │  │  │ GRÁFICOS      │   │    │  │
│  │  │ • Emissora 2    │   │  │  │  │ • Top Estações│   │    │  │
│  │  │ • Cidade        │   │  │  │  │ • Top Cidades │   │    │  │
│  │  └─────────────────┘   │  │  │  └───────────────┘   │    │  │
│  └───────────────────────┘  └───────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ 📰 Notícias ao vivo │▶▶▶ [Items scrolling continuously] ▶▶▶     │
│                     │ • Emissora: Station Name (5)               │
│                     │ • Cidade: City Name (8)                    │
│                     │ • Última: Insert Info                      │
└─────────────────────────────────────────────────────────────────┘
```

## Ticker Animation Flow

```
FRAME 0s (Start)
┌────────────────────────────────────────────────────────────────┐
│ 📰 │ • Item 1 • Item 2 • Item 3 • Item 4 • Item 5 • Item 1     │
└────────────────────────────────────────────────────────────────┘
                    ↑ All items visible

FRAME 15s (Mid-animation)
┌────────────────────────────────────────────────────────────────┐
│ 📰 │        • Item 3 • Item 4 • Item 5 • Item 1 • Item 2      │
└────────────────────────────────────────────────────────────────┘
                    ↑ Scrolled 50%

FRAME 30s (Complete cycle)
┌────────────────────────────────────────────────────────────────┐
│ 📰 │ • Item 1 • Item 2 • Item 3 • Item 4 • Item 5 • Item 1    │
└────────────────────────────────────────────────────────────────┘
                    ↑ Back to start (loop continues)
```

## Color Scheme

| Element | Color | Usage |
|---------|-------|-------|
| Border/Label | #E03D99 | Magenta primary accent |
| Background | #001B4D | Dark blue base |
| Highlight | #5A5FFF | Blue secondary |
| Tint | #7B2CBF | Purple accent |
| Text | #ffffff | White main text |

## Responsive Breakpoints

### Desktop (1080p+)
```
┌─────────────────────────────────────────────────────────────────┐
│ 📰 Notícias ao vivo │▶▶▶ [Scroll 30s] ▶▶▶ [Next Items]        │
└─────────────────────────────────────────────────────────────────┘
Height: 60px | Font: 16px | Gap: 30px
```

### Tablet (768-1023px)
```
┌─────────────────────────────────────────────────────────────────┐
│ 📰 Notícias │▶▶▶ [Scroll 25s] ▶▶▶ [Items]                      │
└─────────────────────────────────────────────────────────────────┘
Height: 50px | Font: 13px | Gap: 20px
```

### Mobile (<768px)
```
┌─────────────────────────────────────────────────────────────────┐
│ 📰 │▶ [Scroll 20s] ▶ [Items]                                    │
└─────────────────────────────────────────────────────────────────┘
Height: 45px | Font: 12px | Gap: 15px
```

## Data Item Format

```javascript
// Default Empty State
"Monitorando inserções em tempo real..."

// Populated State (from polling every 5s)
{
    icon: true,
    text: "Emissora:",
    highlight: "Rádio Globo (12)",  // Number = insertion count
    color: "#E03D99"
}

// City Item
{
    icon: true,
    text: "Cidade:",
    highlight: "São Paulo (25)",
    color: "#5A5FFF"
}

// Latest Insertion
{
    icon: true,
    text: "Última inserção:",
    highlight: "Rio de Janeiro - Rádio FM",
    color: "#E03D99"
}
```

## Animation Properties

- **Type:** CSS 3D Transform (GPU accelerated)
- **Property:** `transform: translateX(-100%)`
- **Duration:** 30s (desktop), 25s (tablet), 20s (mobile)
- **Timing:** `linear` (constant speed)
- **Loop:** `infinite` (continuous)
- **Pulse:** Label pulses at 1.5s interval
- **Hover Effect:** Item expands and highlights on hover

## Performance Characteristics

- **CSS Animation:** Native GPU acceleration
- **No JavaScript Animation Loop:** Pure CSS animations
- **Polling Integration:** Updates every 5 seconds
- **Memory Efficient:** Items duplicated only for loop effect
- **Smooth 60fps:** Using transform properties (no reflows)

## Integration Points

1. **Initialization:** `DOMContentLoaded` event
2. **Data Source:** `/api/insercoes/recentes` endpoint (5s polling)
3. **Rendering:** `renderizarTicker()` function
4. **Updates:** `atualizarTicker()` function
5. **HTML Escape:** `escapeHtml()` security function
