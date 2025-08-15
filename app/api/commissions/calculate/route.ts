import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { CommissionTransaction, User, AffiliateSettings } from "@/lib/types"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  try {
    const { depositId, userId, amount } = await request.json()
    console.log("🔍 API Comissão - Recebido:", { depositId, userId, amount })

    if (!depositId || !userId || !amount) {
      console.log("❌ Dados obrigatórios faltando")
      return NextResponse.json(
        { error: "Dados obrigatórios faltando" },
        { status: 400 }
      )
    }

    // Buscar dados do usuário que fez o depósito
    const userDoc = await adminDb.collection("users").doc(userId).get()
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    const userData = userDoc.data() as User
    console.log("👤 Dados do usuário:", { 
      name: userData.name, 
      referredBy: userData.referredBy,
      hasReferredBy: !!userData.referredBy 
    })
    
    // Verificar se o usuário foi indicado por alguém
    if (!userData.referredBy) {
      console.log("❌ Usuário não foi indicado por ninguém")
      return NextResponse.json(
        { message: "Usuário não foi indicado por ninguém" },
        { status: 200 }
      )
    }

    // Buscar o afiliado que indicou
    console.log("🔎 Buscando afiliado com código:", userData.referredBy)
    const affiliatesSnapshot = await adminDb.collection("users")
      .where("affiliateCode", "==", userData.referredBy)
      .get()
    
    console.log("📊 Afiliados encontrados:", affiliatesSnapshot.size)
    
    if (affiliatesSnapshot.empty) {
      console.log("❌ Afiliado indicador não encontrado")
      return NextResponse.json(
        { error: "Afiliado indicador não encontrado" },
        { status: 404 }
      )
    }

    const affiliateDoc = affiliatesSnapshot.docs[0]
    const affiliateData = affiliateDoc.data() as User
    console.log("💼 Dados do afiliado:", { 
      name: affiliateData.name, 
      id: affiliateDoc.id,
      affiliateCode: affiliateData.affiliateCode,
      customCommissionRate: affiliateData.customCommissionRate
    })

    // Buscar configurações de comissão
    const settingsDoc = await adminDb.collection("settings").doc("affiliate").get()
    let globalCommissionRate = 5 // Padrão
    
    if (settingsDoc.exists) {
      const settings = settingsDoc.data() as AffiliateSettings
      if (!settings.isActive) {
        return NextResponse.json(
          { message: "Sistema de comissões está desativado" },
          { status: 200 }
        )
      }
      globalCommissionRate = settings.globalCommissionRate
    }

    // Determinar a taxa de comissão (personalizada ou global)
    const commissionRate = affiliateData.customCommissionRate ?? globalCommissionRate
    const commissionAmount = (amount * commissionRate) / 100

    console.log("💰 Cálculo da comissão:", {
      globalCommissionRate,
      customCommissionRate: affiliateData.customCommissionRate,
      commissionRate,
      depositAmount: amount,
      commissionAmount
    })

    // Criar transação de comissão
    const commissionTransaction: Omit<CommissionTransaction, 'id'> = {
      affiliateId: affiliateDoc.id,
      affiliateName: affiliateData.name,
      referredUserId: userId,
      referredUserName: userData.name,
      depositId,
      depositAmount: amount,
      commissionRate,
      commissionAmount,
      status: "pending",
      createdAt: new Date()
    }

    // Salvar transação no banco
    const transactionRef = adminDb.collection("commissionTransactions").doc()
    await transactionRef.set(commissionTransaction)
    console.log("💾 Transação de comissão salva:", transactionRef.id)

    // Atualizar total de comissões do afiliado
    await adminDb.collection("users").doc(affiliateDoc.id).update({
      totalCommission: FieldValue.increment(commissionAmount)
    })
    console.log("✅ Total de comissões do afiliado atualizado")

    return NextResponse.json({
      success: true,
      commissionAmount,
      commissionRate,
      transactionId: transactionRef.id
    })

  } catch (error) {
    console.error("Erro ao calcular comissão:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
