# Instruções para Atualizar Regras do Firestore - Sistema de Afiliação

## Problema Identificado

O erro `Missing or insufficient permissions` indica que as regras do Firestore não permitem acesso às coleções necessárias para o sistema de afiliação.

## Solução

### 1. Atualize as Regras do Firestore

Copie o conteúdo do arquivo `firestore-rules-updated.rules` e cole no console do Firebase:

1. Acesse o [Console do Firebase](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá em **Firestore Database** > **Regras**
4. Substitua todo o conteúdo pelas regras atualizadas
5. Clique em **Publicar**

### 2. Principais Mudanças nas Regras

#### Coleção `commissions` (Nova)
```javascript
match /commissions/{commissionId} {
  // Admins podem ler todas as comissões
  // Afiliados podem ler apenas suas próprias comissões
  allow read: if isAdmin() || 
    (isAuthenticated() && resource.data.affiliateId == request.auth.uid);
  
  allow create: if isAuthenticated();
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

#### Coleção `users` (Atualizada)
```javascript
match /users/{userId} {
  // Permitir leitura para usuários autenticados (necessário para carregar usuários referidos)
  allow read: if isAuthenticated() || isAdmin();
  // ... resto das regras
}
```

#### Coleção `affiliateWithdrawals` (Nova)
```javascript
match /affiliateWithdrawals/{withdrawalId} {
  allow read: if isAdmin() || 
    (isAuthenticated() && resource.data.affiliateId == request.auth.uid);
  
  allow create: if isAuthenticated() &&
                  request.resource.data.affiliateId == request.auth.uid;
  
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

### 3. Comando Alternativo (Se você tem Firebase CLI configurado)

```bash
cd /Users/joao2708/Desktop/bingoaff/bingoguilax
firebase deploy --only firestore:rules
```

### 4. Verificação

Após atualizar as regras:

1. Recarregue a página `/afiliados`
2. Verifique no console do navegador se os logs aparecem:
   - "🔍 Carregando dados de afiliado para: [user-id]"
   - "💰 Comissões carregadas: [number]"
   - "👥 Usuários encontrados pelo código: [number]"

### 5. Teste Adicional

Acesse `/debug-afiliados` para ver todos os dados de afiliação do sistema e verificar se está funcionando.

## Notas Importantes

- As regras agora permitem que usuários autenticados leiam dados de outros usuários (necessário para carregar usuários referidos)
- A coleção `commissions` foi adicionada com permissões apropriadas
- Sistema agora tem tratamento de erro melhorado para coleções que podem não existir ainda
- Usuários só podem ver suas próprias comissões e saques de afiliado

## Se o Problema Persistir

1. Verifique se você está logado corretamente
2. Confirme se as regras foram aplicadas no console do Firebase
3. Limpe o cache do navegador
4. Verifique se a coleção `commissions` existe no Firestore (se não existir, é normal não ter dados)
