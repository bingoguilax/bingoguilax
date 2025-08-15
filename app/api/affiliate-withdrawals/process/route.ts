import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { AffiliateWithdrawal } from "@/lib/types"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  console.log("🔄 API PROCESSAR SAQUE - INÍCIO")
  try {
    const { withdrawalId, action, adminId, reason } = await request.json()
    console.log("🔄 Dados recebidos:", { withdrawalId, action, adminId, reason })

    if (!withdrawalId || !action || !adminId) {
      console.log("❌ Dados obrigatórios faltando")
      return NextResponse.json(
        { error: "Dados obrigatórios faltando" },
        { status: 400 }
      )
    }

    // Verificar se o admin existe e tem permissão
    const adminDoc = await adminDb.collection("users").doc(adminId).get()
    if (!adminDoc.exists || adminDoc.data()?.role !== "admin") {
      return NextResponse.json(
        { error: "Acesso negado" },
        { status: 403 }
      )
    }

    // Buscar a solicitação de saque
    const withdrawalDoc = await adminDb.collection("affiliateWithdrawals").doc(withdrawalId).get()
    if (!withdrawalDoc.exists) {
      return NextResponse.json(
        { error: "Solicitação de saque não encontrada" },
        { status: 404 }
      )
    }

    const withdrawalData = withdrawalDoc.data() as AffiliateWithdrawal

    if (withdrawalData.status !== "pending") {
      return NextResponse.json(
        { error: "Solicitação já foi processada" },
        { status: 400 }
      )
    }

    if (action === "approve") {
      console.log("✅ Aprovando saque...")
      // Aprovar saque
      await adminDb.collection("affiliateWithdrawals").doc(withdrawalId).update({
        status: "approved",
        approvedAt: new Date(),
        approvedBy: adminId
      })

      console.log("✅ Saque aprovado com sucesso")
      // O valor já foi descontado do totalCommission quando a solicitação foi criada
      // Não precisa fazer mais nada no saldo

      return NextResponse.json({
        success: true,
        message: "Saque aprovado com sucesso"
      })

    } else if (action === "reject") {
      console.log("❌ Rejeitando saque...")
      // Rejeitar saque
      await adminDb.collection("affiliateWithdrawals").doc(withdrawalId).update({
        status: "rejected",
        rejectedAt: new Date(),
        rejectedBy: adminId,
        rejectionReason: reason || "Rejeitado pelo administrador"
      })

      console.log("💰 Devolvendo valor ao saldo do afiliado...")
      // Devolver o valor para o saldo de comissões do afiliado
      await adminDb.collection("users").doc(withdrawalData.affiliateId).update({
        totalCommission: FieldValue.increment(withdrawalData.amount)
      })

      console.log("❌ Saque rejeitado com sucesso")
      return NextResponse.json({
        success: true,
        message: "Saque rejeitado com sucesso"
      })

    } else {
      console.log("❌ Ação inválida:", action)
      return NextResponse.json(
        { error: "Ação inválida" },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error("Erro ao processar saque:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
