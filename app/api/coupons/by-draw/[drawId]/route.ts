import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { Coupon } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: { drawId: string } }
) {
  try {
    const { drawId } = params
    console.log("🎫 API - Buscando cupons para sorteio:", drawId)
    
    // Verificar se adminDb está funcionando
    if (!adminDb) {
      console.error("❌ API - adminDb não está inicializado")
      return NextResponse.json(
        { error: "Erro de configuração do banco de dados" },
        { status: 500 }
      )
    }
    
    console.log("🎫 API - adminDb inicializado, criando query...")
    
    // Buscar cupons específicos do sorteio (versão mais simples)
    const couponsSnapshot = await adminDb
      .collection("coupons")
      .where("drawId", "==", drawId)
      .get()
    
    console.log("🎫 API - Query executada, cupons encontrados:", couponsSnapshot.size)
    
    if (couponsSnapshot.empty) {
      console.log("🎫 API - Nenhum cupom encontrado para o sorteio:", drawId)
      return NextResponse.json({
        success: true,
        coupons: [],
        total: 0,
        message: "Nenhum cupom encontrado para este sorteio"
      })
    }
    
    const coupons: Coupon[] = []
    couponsSnapshot.forEach((doc) => {
      try {
        const data = doc.data()
        console.log("🎫 API - Processando cupom:", doc.id)
        
        // Verificar campos obrigatórios
        if (!data.code) {
          console.warn("⚠️ API - Cupom sem código:", doc.id)
          return
        }
        
        coupons.push({
          id: doc.id,
          code: data.code,
          drawId: data.drawId || drawId,
          drawTitle: data.drawTitle || "Sorteio",
          cardsAmount: Number(data.cardsAmount) || 0,
          maxUses: Number(data.maxUses) || 0,
          currentUses: Number(data.currentUses) || 0,
          isActive: Boolean(data.isActive !== false), // Default true
          createdAt: data.createdAt?.toDate() || new Date(),
          createdBy: data.createdBy || "",
          usedBy: Array.isArray(data.usedBy) ? data.usedBy : []
        })
      } catch (docError) {
        console.error("❌ API - Erro ao processar cupom:", doc.id, docError)
      }
    })
    
    console.log("🎫 API - Total de cupons válidos:", coupons.length)
    
    // Ordenar por data (mais recentes primeiro)
    coupons.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    
    return NextResponse.json({
      success: true,
      coupons,
      total: coupons.length
    })
    
  } catch (error) {
    console.error("❌ API - Erro completo:", error)
    console.error("❌ API - Stack trace:", error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        error: "Erro ao carregar cupons do sorteio",
        details: error instanceof Error ? error.message : "Erro desconhecido",
        drawId: params?.drawId || "unknown"
      },
      { status: 500 }
    )
  }
}
