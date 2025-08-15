rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Verifica se o usuário está autenticado
    function isAuthenticated() {
      return request.auth != null;
    }

    // Verifica se o usuário é admin
    function isAdmin() {
      return isAuthenticated() &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Verifica se o usuário é o dono dos dados
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Verifica se o usuário existe
    function userExists(userId) {
      return exists(/databases/$(database)/documents/users/$(userId));
    }

    // users - REGRA CORRIGIDA  
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isOwner(userId) || isAdmin() ||
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['balance']);
      allow delete: if isAdmin();
    }

    // deposits
    match /deposits/{depositId} {
      allow read: if isAuthenticated() &&
                    (resource.data.userId == request.auth.uid || isAdmin());

      allow create: if isAuthenticated() &&
                      request.resource.data.userId == request.auth.uid &&
                      userExists(request.auth.uid);

      // Atualização permitida:
      // - Se for admin autenticado
      // - Ou se for um webhook não autenticado que altera apenas o campo `status`
      //   e mantém o mesmo `userId`
      allow update: if isAdmin() || (
        request.auth == null &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']) &&
        request.resource.data.userId == resource.data.userId
      );

      allow delete: if isAdmin();
    }

    // withdrawals
    match /withdrawals/{withdrawalId} {
      allow read: if isAuthenticated() &&
                    (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() &&
                      request.resource.data.userId == request.auth.uid &&
                      userExists(request.auth.uid);
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // draws - REGRA CORRIGIDA
    match /draws/{drawId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin() || 
        (isAuthenticated() && 
         request.resource.data.createdBy == request.auth.uid &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isColaborador == true);
      allow update: if isAdmin() || 
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['winners', 'winnerDetails', 'currentPhase', 'status', 'drawnNumbers', 'totalCards']);
      allow delete: if isAdmin();
    }

    // cards
    match /cards/{cardId} {
  		allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
                      request.resource.data.userId == request.auth.uid &&
                      userExists(request.auth.uid);
      allow update: if isAdmin() ||
                      (isAuthenticated() && resource.data.userId == request.auth.uid);
      allow delete: if isAdmin();
    }

    // purchases
    match /purchases/{purchaseId} {
      allow read: if isAuthenticated() &&
                    (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() &&
                      request.resource.data.userId == request.auth.uid &&
                      userExists(request.auth.uid);
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // game_sessions
    match /game_sessions/{sessionId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // winners
    match /winners/{winnerId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // notifications
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() &&
                    (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // system_config
    match /system_config/{configId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // audit_logs
    match /audit_logs/{logId} {
      allow read: if isAdmin();
      allow create: if isAdmin();
      allow update: if false;
      allow delete: if isAdmin();
    }
    
    // colaboradorRequests - NOVA COLEÇÃO
    match /colaboradorRequests/{requestId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
                      request.resource.data.userId == request.auth.uid &&
                      request.resource.data.userName is string &&
                      request.resource.data.userEmail is string &&
                      request.resource.data.planType in ['basic', 'premium'] &&
                      request.resource.data.status == 'pending';
      allow update: if isAdmin();
      allow delete: if isAdmin();
    }

    // Segurança final: bloqueia qualquer acesso não especificado
    match /{document=**} {
      allow read: if request.auth != null;
    }
  }
}