import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET() {
  try {
    console.log("🧪 Testando conexão com Firebase Admin...")
    
    // Testar conexão básica
    const testDoc = await adminDb.collection("users").limit(1).get()
    console.log("✅ Conexão com Firestore funcionando. Documentos encontrados:", testDoc.size)
    
    // Buscar usuários com affiliateCode
    const affiliatesSnapshot = await adminDb.collection("users")
      .where("affiliateCode", "!=", null)
      .get()
    
    const affiliates = affiliatesSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      affiliateCode: doc.data().affiliateCode,
      referredUsers: doc.data().referredUsers?.length || 0
    }))
    
    // Buscar usuários com referredBy
    const referredSnapshot = await adminDb.collection("users")
      .where("referredBy", "!=", null)
      .get()
    
    const referredUsers = referredSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      referredBy: doc.data().referredBy
    }))
    
    // Verificar configurações de afiliado
    const settingsDoc = await adminDb.collection("settings").doc("affiliate").get()
    const settings = settingsDoc.exists ? settingsDoc.data() : null
    
    return NextResponse.json({
      success: true,
      stats: {
        totalAffiliates: affiliates.length,
        totalReferredUsers: referredUsers.length,
        settings: settings
      },
      affiliates,
      referredUsers
    })
    
  } catch (error) {
    console.error("❌ Erro no teste:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido"
    }, { status: 500 })
  }
}
