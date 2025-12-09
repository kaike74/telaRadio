# 🔍 Guia de Debug - Pingas Não Aparecem

## 🚨 Problema: Pingas não estão aparecendo no mapa

Siga este checklist para diagnosticar:

---

## 1️⃣ **Abra o Console do Navegador (F12)**

Vá na aba **Console** e você verá logs como:

```
🚀 Dashboard iniciado
   Use window.DEBUG.ativar() para ver logs de coordenadas
   Use window.DEBUG.status() para ver status geral
   Use window.DEBUG.verPingas() para listar pingas no mapa
```

---

## 2️⃣ **Verifique o Status Geral**

Digite no console:
```javascript
window.DEBUG.status()
```

**Você verá:**
```
📊 Status do Dashboard:
   Animações ativas: 0
   Dashboard data: Carregado
   Inserções recentes: 45
   Métricas: { campanhasAtivas: 6, emissorasAtivas: 12, insercoesHoje: 45 }
```

### 🔴 Se "Animações ativas: 0" e há inserções recentes:
- **Problema:** O backend está retornando `animacoes: []` vazio
- **Ir para:** Passo 3

### 🟢 Se "Animações ativas > 0":
- **Bom!** Pingas foram criadas
- **Problema:** Elas não estão visíveis (CSS ou posição)
- **Ir para:** Passo 4

---

## 3️⃣ **Verifique a Resposta do Backend**

Abra a aba **Network** do F12 e clique em `/api/insercoes/recentes`

**Você verá algo como:**

### ✅ Resposta Correta (com animações):
```json
{
  "success": true,
  "animacoes": [
    {
      "id": "São Paulo-14:35:00-Rádio XYZ",
      "lat": -23.5505,
      "lng": -46.6333,
      "dados": {
        "emissora": "Rádio XYZ FM",
        "cidade": "São Paulo",
        "uf": "SP",
        "horario": "14:35:00"
      }
    }
  ],
  "metricas": {...}
}
```

### ❌ Resposta Errada (animações vazio):
```json
{
  "success": true,
  "animacoes": [],
  "metricas": {...}
}
```

---

## 4️⃣ **Se Há Animações, Verifique Posição**

Digite no console:
```javascript
window.DEBUG.verPingas()
```

**Você verá:**
```
🔍 Pingas no mapa:
   - São Paulo-14:35:00-Rádio XYZ
     Position: left=150.23px, top=250.45px
   - Rio de Janeiro-14:34:30-Rádio ABC
     Position: left=200.12px, top=320.89px
```

### ✅ Se há pingas com posições:
- Pingas existem no DOM
- **Problema:** Elemento CSS ou visibilidade
- **Ir para:** Passo 5

### ❌ Se lista está vazia:
- **Problema:** `criarPinga()` não está funcionando
- **Ir para:** Passo 6

---

## 5️⃣ **Ative Debug de Coordenadas**

Digite:
```javascript
window.DEBUG.ativar()
```

Aguarde uma nova pinga ser criada (5 segundos) e veja:

```
📡 Resposta /api/insercoes/recentes recebida
   success: true
   animacoes: 1
   debug: {...}

📊 atualizarAnimacoes() chamada
   Animações recebidas: 1
   Animações ativas agora: 0
   
   ➕ Criando nova pinga: São Paulo-14:35:00-Rádio XYZ
      Coordenadas: lat=-23.5505, lng=-46.6333
      Dados: Rádio XYZ - São Paulo/SP
      
   🔍 Posição calculada para Rádio XYZ:
      x=150.23, y=250.45
      
   ✅ Pinga adicionada ao DOM - ID: São Paulo-14:35:00-Rádio XYZ
   📍 Total no mapa agora: 1
```

---

## 6️⃣ **Inspecione o Elemento HTML**

Abra **DevTools (F12)** → **Elements/Inspector**

Procure por um elemento como:
```html
<div id="animacoes-layer">
  <div class="pinga" id="São Paulo-14:35:00-Rádio XYZ" style="left: 150.23px; top: 250.45px;">
    <div class="pinga-circle"></div>
    <div class="pinga-ripple"></div>
    <div class="tooltip-auto">
      <div class="tooltip-auto-content">
        <strong>Rádio XYZ FM</strong>
        <div>São Paulo/SP</div>
        <div>14:35:00</div>
      </div>
    </div>
  </div>
</div>
```

### ❌ Se `<div id="animacoes-layer">` está **vazio**:
- **Problema:** `container.appendChild(pinga)` não funciona
- **Verificar:** Se `#animacoes-layer` existe no HTML
- **Ir para:** Passo 8

### ✅ Se a pinga está lá:
- **Problema:** CSS não está renderizando
- **Ir para:** Passo 7

---

## 7️⃣ **Verifique o CSS**

No DevTools, selecione o elemento `.pinga` e veja **Computed Styles**

### ❌ Problemas comuns:

| CSS | Esperado | ❌ Errado |
|-----|----------|----------|
| `position` | `absolute` | `static` ou `relative` |
| `width` | `16px` | `0px` ou não definido |
| `height` | `16px` | `0px` ou não definido |
| `left` | `150.23px` | `0px` ou não definido |
| `top` | `250.45px` | `0px` ou não definido |
| `display` | (não é `none`) | `display: none` |
| `pointer-events` | `auto` | `none` |

### ✅ Se CSS está correto:
- **Problema:** Pinga está fora do viewport
- **Verificar:** Se x e y estão dentro dos limites do mapa

---

## 8️⃣ **Verifique o Container**

Digite no console:
```javascript
document.getElementById('animacoes-layer')
```

### ✅ Resposta correta:
```
<div id="animacoes-layer">...</div>
```

### ❌ Se retorna `null`:
- **ERRO CRÍTICO:** O container não existe no HTML
- **Solução:** Verifique se `index.html` tem:
```html
<div id="mapa-container">
    <img id="mapa-brasil" src="mapa-brasil.svg" alt="Mapa do Brasil" />
    <!-- Container de animações -->
    <div id="animacoes-layer"></div>
</div>
```

---

## 📋 Resumo de Checklist

- [ ] Console mostra "Dashboard iniciado"
- [ ] `window.DEBUG.status()` mostra animações > 0
- [ ] Network mostra `animacoes: []` ou `animacoes: [...]`?
- [ ] Se vazio: problema é no backend (/api/insercoes/recentes)
- [ ] Se com itens: problema é no frontend (CSS ou posição)
- [ ] `window.DEBUG.verPingas()` mostra pingas?
- [ ] HTML tem `<div id="animacoes-layer">`?
- [ ] CSS do `.pinga` está correto?
- [ ] Posições x/y estão dentro do mapa?

---

## 🚀 Próximos Passos

1. **Envie os logs** do console quando tiver o debug ativado
2. **Verifique** qual é a resposta do backend
3. **Valide** se pingas existem no DOM
4. **Inspecione** o CSS dos elementos

Boa sorte! 🍀

