# Guia para Novo Projeto - Portabilidade em TV

## 🎯 Problema
Seu novo projeto está esticado e com zoom ruim porque está faltando as configurações responsivas e os valores relativos que fazem o layout se adaptar à TV.

---

## 📋 Checklist - O que você precisa

### 1️⃣ **META TAGS no HTML** (CRÍTICO!)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="theme-color" content="#001B4D">
    <title>Seu Projeto</title>
    <link rel="stylesheet" href="style.css">
</head>
```

**Por que é importante:**
- `viewport-fit=cover` - Usa toda a tela da TV
- `user-scalable=no` - Impede zoom manual
- `initial-scale=1.0` - Começa sem zoom

---

### 2️⃣ **CSS GLOBAL** (Base)
```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #001B4D;
    color: #ffffff;
    overflow: hidden;
    height: 100vh;
    width: 100vw;
    font-size: clamp(12px, 1.5vw, 20px);  /* ⭐ IMPORTANTE: Font responsivo */
    margin: 0;
    padding: 0;
}
```

**Chave secreta:** `clamp(min, preferido, max)`
- `clamp(12px, 1.5vw, 20px)` = Fonte entre 12px e 20px, escalando com a viewport

---

### 3️⃣ **CONTAINER PRINCIPAL** (Layout Flexbox)
```css
.dashboard-container {
    display: flex;
    flex-direction: row;
    height: calc(100vh - 45px);  /* 45px reservado para ticker no rodapé */
    width: 100vw;
    padding: 0;
    gap: clamp(8px, 1vw, 20px);  /* Gap responsivo */
    overflow: hidden;
    box-sizing: border-box;
    align-items: stretch;
}

/* Coluna Esquerda (50%) */
.left-column {
    flex: 0 0 50% !important;     /* 50% fixo, não crescer/encolher */
    display: flex;
    flex-direction: column;
    gap: clamp(15px, 2vh, 30px);  /* Gap vertical responsivo */
    min-height: 0;                /* ⭐ CRÍTICO para flex funcionar */
    min-width: 0;                 /* ⭐ CRÍTICO para flex funcionar */
    overflow: hidden;
    width: 50% !important;
}

/* Coluna Direita (50%) */
.right-column {
    flex: 0 0 50% !important;
    display: flex;
    flex-direction: column;
    gap: clamp(12px, 1.5vh, 20px);
    min-height: 0;
    min-width: 0;
    overflow: hidden;
    width: 50% !important;
}
```

**Regras de Ouro:**
1. `flex: 0 0 50%` = Não cresce, não encolhe, fica 50%
2. `min-height: 0` e `min-width: 0` = Permite que filhos façam overflow corretamente
3. `gap: clamp(...)` = Espaçamento que cresce/encolhe com a tela
4. `overflow: hidden` = Nada sai do container

---

### 4️⃣ **MAPA E ANIMAÇÕES** (Posicionamento crítico)
```css
#mapa-container {
    flex: 0 0 75%;               /* 75% da coluna esquerda */
    position: relative;
    background: rgba(0, 0, 0, 0.2);
    border-radius: clamp(8px, 1.2vw, 16px);
    overflow: visible;           /* ⭐ Deixa pingas aparecerem */
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
}

#mapa-brasil {
    width: auto;
    height: auto;
    max-width: 100%;             /* Não ultrapassa 100% */
    max-height: 100%;
    display: block;
    margin: auto;                /* Centraliza */
    object-fit: contain;         /* Mantém proporção */
    object-position: center;
}

#animacoes-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;        /* Deixa clicar no mapa */
    z-index: 10;                 /* Pingas acima do mapa */
}
```

---

### 5️⃣ **RESPONSIVIDADE - Media Queries** (Não pule isso!)
```css
/* Google TV / Smart TV 1080p (1920x1080) */
@media (min-width: 1920px) and (max-height: 1200px) {
    .dashboard-container {
        flex-direction: row;
        padding: 12px;
        gap: 12px;
    }

    .left-column {
        flex: 0 0 58%;
    }

    .right-column {
        flex: 0 0 42%;
        overflow-y: auto;
        gap: 15px;
    }

    /* Ajuste de fonte para 1080p */
    body {
        font-size: clamp(12px, 1.8vw, 18px);
    }

    .metrica-valor {
        font-size: 32px;
    }

    .mapa-section h2 {
        font-size: 24px;
    }
}

/* Google TV / Smart TV 4K (3840x2160) */
@media (min-width: 3840px) and (min-height: 2160px) {
    .dashboard-container {
        flex-direction: row;
        padding: 20px;
        gap: 20px;
    }

    .left-column {
        flex: 0 0 58%;
        gap: 25px;
    }

    .right-column {
        flex: 0 0 42%;
        overflow-y: auto;
        gap: 25px;
    }

    body {
        font-size: clamp(14px, 2vw, 24px);
    }

    .metrica-valor {
        font-size: 56px;
    }

    .mapa-section h2 {
        font-size: 40px;
    }
}
```

---

## 🔑 Propriedades Responsivas Essenciais

| Propriedade | Valor | Uso |
|------------|-------|-----|
| `font-size` | `clamp(12px, 1.5vw, 20px)` | Fonte que cresce com a tela |
| `gap` | `clamp(8px, 1vw, 20px)` | Espaço entre elementos |
| `border-radius` | `clamp(8px, 1.2vw, 16px)` | Raio da borda responsivo |
| `padding` | `clamp(10px, 2vw, 20px)` | Padding responsivo |
| `width/height` | `100vw` / `100vh` | Sempre em unidades de viewport |
| `flex` | `0 0 50%` | Tamanho fixo em flex |

---

## ⚠️ Erros Comuns (Evite!)

❌ **NÃO use:**
```css
width: 500px;           /* Fixo - ruim em TV */
font-size: 16px;        /* Fixo - não escala */
overflow: auto;         /* TV não tem scroll */
position: fixed;        /* Quebra em TV */
```

✅ **USE:**
```css
width: 50vw;            /* Relativo ao viewport */
font-size: clamp(12px, 1.5vw, 20px);  /* Responsivo */
overflow: hidden;       /* Nada sai da tela */
position: absolute;     /* Relativo ao pai */
```

---

## 📐 Estrutura HTML Recomendada

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">
    <meta name="theme-color" content="#001B4D">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="dashboard-container">
        <div class="left-column">
            <!-- Conteúdo 50% esquerda -->
        </div>
        <div class="right-column">
            <!-- Conteúdo 50% direita -->
        </div>
    </div>

    <!-- Ticker/Footer (45px) -->
    <div class="news-ticker">
        <!-- Conteúdo do ticker -->
    </div>

    <script src="script.js"></script>
</body>
</html>
```

---

## 🎬 Testando em Diferentes Resoluções

Abra o DevTools e teste:

1. **1920x1080** (TV Full HD)
   - `@media (min-width: 1920px) and (max-height: 1200px)`

2. **3840x2160** (TV 4K)
   - `@media (min-width: 3840px) and (min-height: 2160px)`

3. **Desktop 1366x768**
   - `@media (min-width: 1366px) and (max-width: 1439px)`

---

## 💡 Dicas Finais

1. **Sempre use `clamp()`** para font-size, gaps e paddings
2. **Sempre defina `min-height: 0` e `min-width: 0`** em containers flex
3. **Use `overflow: hidden`** em tudo que não deveria scroll
4. **Teste em múltiplas resoluções** antes de enviar para TV
5. **Use unidades relativas** (`vw`, `vh`, `%`) nunca fixas (`px`)
6. **Meta tag `viewport-fit=cover`** é essencial para TV

---

## 📁 Arquivos do Projeto Original

Copie do projeto funcionando:
- ✅ `telaRadio/index.html` - Estrutura HTML
- ✅ `telaRadio/style.css` - Todo o CSS com media queries
- ✅ `telaRadio/script.js` - Lógica JavaScript

Essas três coisas juntas = Sistema que funciona perfeitamente em TV! 🎯
