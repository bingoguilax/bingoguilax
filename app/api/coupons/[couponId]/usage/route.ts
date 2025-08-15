import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { CouponUsage } from "@/lib/types"

export async function GET(
  request: NextRequest,
  { params }: { params: { couponId: string } }
) {
  try {
    const { couponId } = params
    console.log("📋 API - Buscando usos do cupom:", couponId)
    
    // Buscar cupom primeiro
    const couponDoc = await adminDb.collection("coupons").doc(couponId).get()
    
    if (!couponDoc.exists) {
      return NextResponse.json(
        { error: "Cupom não encontrado" },
        { status: 404 }
      )
    }
    
    const couponData = couponDoc.data()
    
    // Buscar usos do cupom (sem orderBy para evitar erro de índice)
    const usagesSnapshot = await adminDb.collection("couponUsages")
      .where("couponId", "==", couponId)
      .get()
    
    console.log("📋 API - Usos encontrados:", usagesSnapshot.size)
    
    const usages: CouponUsage[] = []
    const userIds: string[] = []
    
    usagesSnapshot.forEach((doc) => {
      try {
        const data = doc.data()
        
        // Verificar se os campos necessários existem
        if (!data.couponId || !data.userId) {
          console.warn("📋 API - Uso com dados incompletos:", doc.id, data)
          return
        }
        
        const usage: CouponUsage = {
          id: doc.id,
          couponId: data.couponId,
          couponCode: data.couponCode || "Código não encontrado",
          userId: data.userId,
          drawId: data.drawId || "",
          drawTitle: data.drawTitle || "Sorteio",
          cardsReceived: data.cardsReceived || 0,
          usedAt: data.usedAt ? data.usedAt.toDate() : new Date()
        }
        usages.push(usage)
        if (!userIds.includes(data.userId)) {
          userIds.push(data.userId)
        }
      } catch (docError) {
        console.error("📋 API - Erro ao processar uso:", doc.id, docError)
      }
    })
    
    // Ordenar por data de uso no JavaScript (mais recente primeiro)
    usages.sort((a, b) => b.usedAt.getTime() - a.usedAt.getTime())
    
    // Buscar nomes dos usuários
    const users: Record<string, string> = {}
    if (userIds.length > 0) {
      try {
        // Buscar usuários em lotes se necessário (Firestore permite máximo 10 no 'in')
        const batches = []
        for (let i = 0; i < userIds.length; i += 10) {
          const batch = userIds.slice(i, i + 10)
          batches.push(batch)
        }
        
        for (const batch of batches) {
          const usersSnapshot = await adminDb.collection("users")
            .where("__name__", "in", batch)
            .get()
          
          usersSnapshot.forEach((doc) => {
            const userData = doc.data()
            users[doc.id] = userData.name || "Usuário"
          })
        }
      } catch (userError) {
        console.error("📋 API - Erro ao buscar usuários:", userError)
        // Continuar mesmo se não conseguir buscar nomes dos usuários
      }
    }
    
    // Adicionar nomes aos usos
    const usagesWithUserNames = usages.map(usage => ({
      ...usage,
      userName: users[usage.userId] || "Usuário Desconhecido"
    }))
    
    console.log("📋 API - Usos processados:", usagesWithUserNames.length)
    
    return NextResponse.json({
      success: true,
      coupon: {
        id: couponDoc.id,
        code: couponData?.code || "Código não encontrado",
        cardsAmount: couponData?.cardsAmount || 0,
        maxUses: couponData?.maxUses || 0,
        currentUses: couponData?.currentUses || 0,
        isActive: couponData?.isActive !== false, // Default true
        drawTitle: couponData?.drawTitle || "Sorteio",
        createdAt: couponData?.createdAt ? couponData.createdAt.toDate() : new Date()
      },
      usages: usagesWithUserNames,
      totalUses: usages.length
    })
    
  } catch (error) {
    console.error("❌ API - Erro ao buscar usos do cupom:", error)
    return NextResponse.json(
      { 
        error: "Erro ao carregar usos do cupom",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
