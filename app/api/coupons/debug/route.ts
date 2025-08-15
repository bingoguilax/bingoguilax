import { NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function GET() {
  try {
    console.log("🔍 DEBUG - Iniciando debug de cupons...")
    
    // Verificar se a coleção existe
    const couponsRef = adminDb.collection("coupons")
    console.log("🔍 DEBUG - Referência da coleção criada")
    
    // Buscar todos os cupons sem filtros
    const allCouponsSnapshot = await couponsRef.get()
    console.log("🔍 DEBUG - Total de cupons na base:", allCouponsSnapshot.size)
    
    const allCoupons: any[] = []
    allCouponsSnapshot.forEach((doc) => {
      const data = doc.data()
      console.log("🔍 DEBUG - Cupom encontrado:", doc.id, data)
      allCoupons.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
      })
    })
    
    // Agrupar por drawId
    const couponsByDraw: Record<string, any[]> = {}
    allCoupons.forEach(coupon => {
      const drawId = coupon.drawId
      if (!couponsByDraw[drawId]) {
        couponsByDraw[drawId] = []
      }
      couponsByDraw[drawId].push(coupon)
    })
    
    console.log("🔍 DEBUG - Cupons agrupados por sorteio:", Object.keys(couponsByDraw))
    
    return NextResponse.json({
      success: true,
      totalCoupons: allCoupons.length,
      couponsByDraw,
      allCoupons
    })
    
  } catch (error) {
    console.error("❌ DEBUG - Erro:", error)
    return NextResponse.json(
      { 
        error: "Erro no debug",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
