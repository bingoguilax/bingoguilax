import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { Coupon } from "@/lib/types"

export async function GET(request: NextRequest) {
  try {
    console.log("📋 API - Listando todos os cupons...")
    
    // Buscar todos os cupons ordenados por data de criação
    const couponsSnapshot = await adminDb.collection("coupons")
      .orderBy("createdAt", "desc")
      .get()
    
    console.log("📋 API - Cupons encontrados:", couponsSnapshot.size)
    
    const coupons: Coupon[] = []
    couponsSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log("📄 API - Cupom:", doc.id, data)
      
      coupons.push({
        id: doc.id,
        code: data.code,
        drawId: data.drawId,
        drawTitle: data.drawTitle,
        cardsAmount: data.cardsAmount,
        maxUses: data.maxUses,
        currentUses: data.currentUses,
        isActive: data.isActive,
        createdAt: data.createdAt.toDate(),
        createdBy: data.createdBy,
        usedBy: data.usedBy || []
      })
    })
    
    console.log("📋 API - Cupons processados:", coupons.length)
    
    return NextResponse.json({
      success: true,
      coupons,
      total: coupons.length
    })
    
  } catch (error) {
    console.error("❌ API - Erro ao listar cupons:", error)
    return NextResponse.json(
      { 
        error: "Erro ao carregar cupons",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
