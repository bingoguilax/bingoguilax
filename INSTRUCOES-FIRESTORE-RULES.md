# 🔧 Instruções para Atualizar Regras do Firestore

## ❌ **Problema Identificado:**
As regras do Firestore não incluem permissões para as novas coleções do sistema de cupons:
- `coupons` - Cupons criados pelos admins
- `couponUsages` - Registros de uso dos cupons
- `affiliateWithdrawals` - Saques de afiliados (já existente mas pode ter problemas)

## ✅ **Solução:**

### **1. Copie as Regras Atualizadas**
O arquivo `firestore-rules-updated.rules` contém suas regras atuais + as novas regras para cupons.

### **2. Aplicar no Firebase Console**
1. **Acesse**: [Console do Firebase](https://console.firebase.google.com)
2. **Vá para**: Firestore Database > Rules
3. **Substitua** suas regras atuais pelas do arquivo `firestore-rules-updated.rules`
4. **Clique em**: "Publicar"

### **3. Novas Regras Adicionadas:**

#### **📋 Coleção `coupons`:**
```javascript
match /coupons/{couponId} {
  // Admins podem ler todos os cupons
  // Usuários autenticados podem ler cupons ativos (para validação)
  allow read: if isAdmin() || (isAuthenticated() && resource.data.isActive == true);
  
  // Apenas admins podem criar cupons
  allow create: if isAdmin();
  
  // Admins podem atualizar tudo
  // Sistema pode atualizar currentUses e usedBy para registrar uso
  allow update: if isAdmin() || 
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['currentUses', 'usedBy']);
  
  allow delete: if isAdmin();
}
```

#### **📋 Coleção `couponUsages`:**
```javascript
match /couponUsages/{usageId} {
  // Admins podem ler todos os usos
  // Usuários podem ler apenas seus próprios usos
  allow read: if isAdmin() || 
    (isAuthenticated() && resource.data.userId == request.auth.uid);
  
  // Sistema pode criar registros de uso
  // Usuários podem criar registros do próprio uso
  allow create: if isAuthenticated();
  
  // Apenas admins podem atualizar (não deveria ser necessário)
  allow update: if isAdmin();
  
  // Apenas admins podem deletar
  allow delete: if isAdmin();
}
```

#### **📋 Coleção `affiliateWithdrawals`:**
```javascript
match /affiliateWithdrawals/{withdrawalId} {
  // Admins podem ler todos os saques
  // Afiliados podem ler apenas seus próprios saques
  allow read: if isAdmin() || 
    (isAuthenticated() && resource.data.affiliateId == request.auth.uid);
  
  // Afiliados podem criar solicitações de saque
  allow create: if isAuthenticated() &&
                  request.resource.data.affiliateId == request.auth.uid;
  
  // Apenas admins podem atualizar (aprovar/rejeitar)
  allow update: if isAdmin();
  
  // Apenas admins podem deletar
  allow delete: if isAdmin();
}
```

## 🎯 **O Que Isso Resolve:**

### ✅ **Criação de Cupons:**
- Admins podem criar cupons normalmente
- Cupons são salvos na coleção `coupons`

### ✅ **Resgate de Cupons:**
- Usuários podem validar cupons ativos
- Sistema pode atualizar contador de usos
- Registros de uso são salvos em `couponUsages`

### ✅ **Saques de Afiliados:**
- Afiliados podem criar solicitações
- Admins podem aprovar/rejeitar
- Dados são salvos em `affiliateWithdrawals`

## 🚨 **IMPORTANTE:**
Depois de aplicar as regras, teste:

1. **Criar um sorteio com cupom**
2. **Resgatar o cupom na home**
3. **Verificar se as cartelas aparecem**

## 📱 **Como Testar:**

### **Teste 1: Criar Cupom**
1. Vá para `/backoffice/sorteios`
2. Crie um novo sorteio
3. Adicione um cupom (ex: `TESTE10`, 5 cartelas, 100 usos)
4. Salve o sorteio

### **Teste 2: Resgatar Cupom**
1. Vá para `/home`
2. Clique no botão "Cupom" de um sorteio
3. Digite `TESTE10`
4. Clique "Resgatar Cupom"
5. Deve aparecer sucesso e recarregar a página

### **Teste 3: Verificar Cartelas**
1. Depois do resgate, verifique se as cartelas aparecem
2. Vá para a sala do sorteio
3. Deve mostrar as cartelas gratuitas

---

**⚡ Após aplicar essas regras, o sistema de cupons deve funcionar completamente!**
