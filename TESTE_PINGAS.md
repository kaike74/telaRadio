# 🧪 Teste de Pingas no Mapa

## Passo 1: Abra o Console (F12)

Você verá o status inicial:
```
🚀 Dashboard iniciado
   Use window.DEBUG.ativar() para ver logs de coordenadas
   Use window.DEBUG.status() para ver status geral
   Use window.DEBUG.verPingas() para listar pingas no mapa
```

---

## Passo 2: Crie uma Pinga de Teste

Digite no console:
```javascript
window.DEBUG.testarPinga(300, 250)
```

**Você verá:**
```
🧪 Criando pinga de teste em (300, 250)...
   ✅ Pinga criada! ID: teste-1732823451234
   Elemento: <div class="pinga" id="teste-1732823451234" style="left: 300px; top: 250px;">...
   offsetHeight: 16
   offsetWidth: 16
   Visível: SIM ✅
   Computed styles:
     position: absolute
     left: 300px
     top: 250px
     width: 16px
     height: 16px
     display: block
     visibility: visible
```

### ✅ Se "Visível: SIM" aparece:
- **BOM!** CSS está funcionando
- Pinga deve aparecer no mapa (círculo rosa com ondas azuis)
- **Próxima etapa:** Verificar por que as pingas reais não aparecem

### ❌ Se "Visível: NÃO" aparece:
- **PROBLEMA:** CSS não está renderizando
- Verifique `style.css` - seção `.pinga`
- Verifique se há conflitos de CSS

---

## Passo 3: Verifique o Container

Digite no console:
```javascript
document.getElementById('animacoes-layer')
```

**Esperado:**
```
<div id="animacoes-layer">
  <div class="pinga" id="teste-..." style="left: 300px; top: 250px;">...</div>
</div>
```

**Se retorna `null`:**
- HTML não tem `<div id="animacoes-layer">`
- Verifique `index.html`

---

## Passo 4: Teste com Posições Diferentes

```javascript
window.DEBUG.testarPinga(100, 100);   // Canto superior esquerdo
window.DEBUG.testarPinga(500, 400);   // Centro
window.DEBUG.testarPinga(150, 300);   // Esquerda
```

Se aparecem em diferentes posições = **CSS está ok!**

---

## Passo 5: Limpe os Testes

```javascript
window.DEBUG.removerTestePingas()
```

---

## Passo 6: Verifique Pingas Reais

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

### 🔴 Se "Animações ativas: 0":
- **PROBLEMA:** Backend não retorna animações
- Pode ser:
  - Nenhuma inserção nos últimos 30 segundos
  - Coordenadas não carregadas
  - Filtro de tempo muito rigoroso

### 🟢 Se "Animações ativas > 0":
- **BOM!** Animações foram calculadas
- Se não aparecem = problema é CSS

---

## 📋 Checklist Final

- [ ] `DEBUG.testarPinga()` cria pinga visível? **Sim / Não**
- [ ] Pinga teste aparece no mapa? **Sim / Não**
- [ ] `#animacoes-layer` existe no DOM? **Sim / Não**
- [ ] Há "Animações ativas > 0" em `DEBUG.status()`? **Sim / Não**
- [ ] Pingas reais aparecem no mapa? **Sim / Não**

---

## 🎯 Próximas Ações

Se pingas de teste aparecem mas pingas reais não:

1. **Redeploy o worker** (Cloudflare)
2. **Aguarde 1 minuto** para dados estarem em cache
3. **Abra F12 → Network**
4. **Veja resposta de `/api/insercoes/recentes`**
   - Deve ter `"animacoes": [...]` com itens

Se não há animações na resposta:
- Backend não está encontrando coordenadas
- Use `window.DEBUG.ativar()` para ver logs
- Verifique logs do worker (Cloudflare)

---

## 💡 Dicas

**Ativar logs de debug:**
```javascript
window.DEBUG.ativar()
```

**Ver status completo:**
```javascript
window.DEBUG.status()
window.DEBUG.verPingas()
```

**Abrir Network tab:**
- F12 → Network
- Procure por `/api/insercoes/recentes`
- Veja a resposta JSON
- Conta `animacoes.length`

---

Boa sorte! 🍀

