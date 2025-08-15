import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { AffiliateWithdrawal } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    console.log("📋 API - Listando saques de afiliados...")
    
    // Buscar todos os saques ordenados por data
    const withdrawalsSnapshot = await adminDb.collection("affiliateWithdrawals")
      .orderBy("createdAt", "desc")
      .get()
    
    console.log("📋 API - Documentos encontrados:", withdrawalsSnapshot.size)
    
    const withdrawals: AffiliateWithdrawal[] = []
    withdrawalsSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log("📄 API - Documento:", doc.id, data)
      
      withdrawals.push({
        id: doc.id,
        affiliateId: data.affiliateId,
        affiliateName: data.affiliateName,
        amount: data.amount,
        pixKeyType: data.pixKeyType,
        pixKey: data.pixKey,
        status: data.status,
        createdAt: data.createdAt.toDate(),
        approvedAt: data.approvedAt?.toDate(),
        approvedBy: data.approvedBy,
        rejectedAt: data.rejectedAt?.toDate(),
        rejectedBy: data.rejectedBy,
        rejectionReason: data.rejectionReason
      })
    })
    
    console.log("📋 API - Saques processados:", withdrawals.length)
    
    return NextResponse.json({
      success: true,
      withdrawals
    })
    
  } catch (error) {
    console.error("❌ API - Erro ao listar saques:", error)
    return NextResponse.json(
      { 
        error: "Erro ao carregar saques",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
