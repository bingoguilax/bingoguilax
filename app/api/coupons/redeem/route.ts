import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  console.log("🎫 API RESGATAR CUPOM - INÍCIO")
  try {
    const { code, userId } = await request.json()
    console.log("🎫 Dados recebidos:", { code, userId })

    if (!code || !userId) {
      console.log("❌ Dados obrigatórios faltando")
      return NextResponse.json(
        { error: "Código do cupom e ID do usuário são obrigatórios" },
        { status: 400 }
      )
    }

    // Buscar o cupom pelo código
    console.log("🔍 Buscando cupom:", code.toUpperCase())
    const couponsSnapshot = await adminDb.collection("coupons")
      .where("code", "==", code.toUpperCase())
      .where("isActive", "==", true)
      .get()

    if (couponsSnapshot.empty) {
      console.log("❌ Cupom não encontrado ou inativo")
      return NextResponse.json(
        { error: "Código de cupom inválido ou expirado" },
        { status: 404 }
      )
    }

    const couponDoc = couponsSnapshot.docs[0]
    const couponData = couponDoc.data()
    console.log("✅ Cupom encontrado:", couponData)

    // Verificar se o usuário já usou este cupom
    if (couponData.usedBy && couponData.usedBy.includes(userId)) {
      console.log("❌ Usuário já usou este cupom")
      return NextResponse.json(
        { error: "Você já resgatou este cupom" },
        { status: 400 }
      )
    }

    // Verificar se o cupom ainda tem usos disponíveis
    if (couponData.currentUses >= couponData.maxUses) {
      console.log("❌ Cupom sem usos disponíveis")
      return NextResponse.json(
        { error: "Este cupom já atingiu o limite máximo de usos" },
        { status: 400 }
      )
    }

    // Verificar se o sorteio ainda existe e está ativo
    const drawDoc = await adminDb.collection("draws").doc(couponData.drawId).get()
    if (!drawDoc.exists) {
      console.log("❌ Sorteio não encontrado")
      return NextResponse.json(
        { error: "Sorteio associado ao cupom não encontrado" },
        { status: 404 }
      )
    }

    const drawData = drawDoc.data()
    if (drawData.status === "finished") {
      console.log("❌ Sorteio já finalizado")
      return NextResponse.json(
        { error: "Este sorteio já foi finalizado" },
        { status: 400 }
      )
    }

    // Buscar dados do usuário
    const userDoc = await adminDb.collection("users").doc(userId).get()
    if (!userDoc.exists) {
      console.log("❌ Usuário não encontrado")
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    console.log("👤 Usuário encontrado:", userData.name)

    // Gerar cartelas gratuitas
    console.log("🎲 Gerando", couponData.cardsAmount, "cartelas gratuitas...")
    const cardIds: string[] = []
    
    for (let i = 0; i < couponData.cardsAmount; i++) {
      // Gerar números aleatórios para a cartela de bingo
      const numbers = generateBingoCard()
      
      const cardRef = await adminDb.collection("cards").add({
        userId: userId,
        drawId: couponData.drawId,
        numbers: numbers,
        markedNumbers: Array(25).fill(false),
        purchaseDate: new Date(),
        fromCoupon: true,
        couponCode: code.toUpperCase()
      })
      
      cardIds.push(cardRef.id)
    }

    // Criar registro de compra (gratuita)
    await adminDb.collection("purchases").add({
      userId: userId,
      drawId: couponData.drawId,
      quantity: couponData.cardsAmount,
      totalAmount: 0, // Gratuito
      cardIds: cardIds,
      fromCoupon: true,
      couponCode: code.toUpperCase(),
      createdAt: new Date()
    })

    // Registrar uso do cupom
    await adminDb.collection("couponUsages").add({
      couponId: couponDoc.id,
      couponCode: code.toUpperCase(),
      userId: userId,
      userName: userData.name,
      drawId: couponData.drawId,
      cardsReceived: couponData.cardsAmount,
      redeemedAt: new Date()
    })

    // Atualizar o cupom
    await adminDb.collection("coupons").doc(couponDoc.id).update({
      currentUses: FieldValue.increment(1),
      usedBy: FieldValue.arrayUnion(userId)
    })

    // Atualizar total de cartelas no sorteio
    await adminDb.collection("draws").doc(couponData.drawId).update({
      totalCards: FieldValue.increment(couponData.cardsAmount)
    })

    console.log("✅ Cupom resgatado com sucesso!")

    return NextResponse.json({
      success: true,
      message: `Cupom resgatado! Você ganhou ${couponData.cardsAmount} cartelas gratuitas!`,
      cardsReceived: couponData.cardsAmount,
      drawTitle: couponData.drawTitle
    })

  } catch (error) {
    console.error("❌ Erro ao resgatar cupom:", error)
    return NextResponse.json(
      { 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}

// Função para gerar números da cartela de bingo
function generateBingoCard(): number[] {
  const card: number[] = []
  
  // Colunas B (1-15), I (16-30), N (31-45), G (46-60), O (61-75)
  const columns = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 }   // O
  ]
  
  for (let col = 0; col < 5; col++) {
    const usedNumbers = new Set<number>()
    
    for (let row = 0; row < 5; row++) {
      // Centro é sempre livre
      if (col === 2 && row === 2) {
        card.push(0) // 0 representa espaço livre
        continue
      }
      
      let number: number
      do {
        number = Math.floor(Math.random() * (columns[col].max - columns[col].min + 1)) + columns[col].min
      } while (usedNumbers.has(number))
      
      usedNumbers.add(number)
      card.push(number)
    }
  }
  
  return card
}
