import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { AffiliateWithdrawal, AffiliateSettings } from "@/lib/types"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  console.log("🚀 API SAQUE - INÍCIO da requisição")
  try {
    console.log("📋 Parsear body da requisição...")
    const { amount, pixKeyType, pixKey } = await request.json()
    console.log("🏦 API Saque - Dados recebidos:", { amount, pixKeyType, pixKey })
    
    // Pegar userId do header (temporário, em produção usar autenticação adequada)
    const userId = request.headers.get('x-user-id')
    console.log("🏦 API Saque - User ID:", userId)
    console.log("🏦 API Saque - Headers completos:", Object.fromEntries(request.headers.entries()))

    if (!userId || !amount || !pixKeyType || !pixKey) {
      console.log("❌ Dados obrigatórios faltando")
      return NextResponse.json(
        { error: "Dados obrigatórios faltando" },
        { status: 400 }
      )
    }

    // Buscar dados do usuário
    console.log("🔍 Buscando usuário:", userId)
    const userDoc = await adminDb.collection("users").doc(userId).get()
    if (!userDoc.exists) {
      console.log("❌ Usuário não encontrado")
      return NextResponse.json(
        { error: "Usuário não encontrado" },
        { status: 404 }
      )
    }

    const userData = userDoc.data()
    const currentCommission = userData?.totalCommission || 0
    console.log("💰 Saldo atual do usuário:", currentCommission)

    // Buscar configurações de saque
    console.log("⚙️ Buscando configurações de saque...")
    const settingsDoc = await adminDb.collection("settings").doc("affiliate").get()
    let minWithdrawal = 10
    let dailyWithdrawalLimit = 1

    if (settingsDoc.exists) {
      const settings = settingsDoc.data() as AffiliateSettings
      minWithdrawal = settings.minWithdrawal || 10
      dailyWithdrawalLimit = settings.dailyWithdrawalLimit || 1
      console.log("⚙️ Configurações:", { minWithdrawal, dailyWithdrawalLimit })
    } else {
      console.log("⚙️ Usando configurações padrão")
    }

    // Validações
    if (amount < minWithdrawal) {
      return NextResponse.json(
        { error: `Valor mínimo para saque é R$ ${minWithdrawal.toFixed(2)}` },
        { status: 400 }
      )
    }

    if (amount > currentCommission) {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      )
    }

    // Verificar limite diário (versão simplificada sem índice composto)
    console.log("📅 Verificando limite diário...")
    
    // Buscar todos os saques do usuário e filtrar no código
    const userWithdrawals = await adminDb.collection("affiliateWithdrawals")
      .where("affiliateId", "==", userId)
      .get()

    // Filtrar saques de hoje
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayWithdrawalsCount = userWithdrawals.docs.filter(doc => {
      const createdAt = doc.data().createdAt.toDate()
      return createdAt >= today && createdAt < tomorrow
    }).length

    console.log("📅 Saques hoje:", todayWithdrawalsCount, "Limite:", dailyWithdrawalLimit)

    if (todayWithdrawalsCount >= dailyWithdrawalLimit) {
      console.log("❌ Limite diário atingido")
      return NextResponse.json(
        { error: `Limite de ${dailyWithdrawalLimit} saque(s) por dia atingido` },
        { status: 400 }
      )
    }

    // Criar solicitação de saque
    const withdrawal: Omit<AffiliateWithdrawal, 'id'> = {
      affiliateId: userId,
      affiliateName: userData?.name || "Usuário",
      amount: parseFloat(amount),
      pixKeyType,
      pixKey,
      status: "pending",
      createdAt: new Date()
    }

    // Salvar no banco
    console.log("💾 Salvando solicitação de saque...")
    const withdrawalRef = adminDb.collection("affiliateWithdrawals").doc()
    await withdrawalRef.set(withdrawal)
    console.log("💾 Solicitação salva:", withdrawalRef.id)

    // Descontar do saldo de comissões (reservar)
    console.log("💰 Descontando valor do saldo...")
    await adminDb.collection("users").doc(userId).update({
      totalCommission: FieldValue.increment(-amount)
    })
    console.log("✅ Saque criado com sucesso!")

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawalRef.id,
      message: "Solicitação de saque criada com sucesso"
    })

  } catch (error) {
    console.error("💥 ERRO COMPLETO na API:", error)
    console.error("💥 Stack trace:", error instanceof Error ? error.stack : "Não é uma instância de Error")
    console.error("💥 Tipo do erro:", typeof error)
    console.error("💥 Detalhes do erro:", JSON.stringify(error, null, 2))
    
    return NextResponse.json(
      { 
        error: "Erro interno do servidor",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
