import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"
import { CommissionTransaction } from "@/lib/types"
import { FieldValue } from "firebase-admin/firestore"

export async function POST(request: NextRequest) {
  try {
    const { transactionId, adminId } = await request.json()

    if (!transactionId || !adminId) {
      return NextResponse.json(
        { error: "ID da transação e do admin são obrigatórios" },
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

    // Buscar a transação de comissão
    const transactionDoc = await adminDb.collection("commissionTransactions").doc(transactionId).get()
    if (!transactionDoc.exists) {
      return NextResponse.json(
        { error: "Transação não encontrada" },
        { status: 404 }
      )
    }

    const transactionData = transactionDoc.data() as CommissionTransaction

    if (transactionData.status === "paid") {
      return NextResponse.json(
        { error: "Transação já foi paga" },
        { status: 400 }
      )
    }

    // Atualizar status da transação para "paid"
    await adminDb.collection("commissionTransactions").doc(transactionId).update({
      status: "paid",
      paidAt: new Date(),
      paidBy: adminId
    })

    // Adicionar comissão ao saldo do afiliado
    await adminDb.collection("users").doc(transactionData.affiliateId).update({
      balance: FieldValue.increment(transactionData.commissionAmount)
    })

    return NextResponse.json({
      success: true,
      message: "Comissão paga com sucesso"
    })

  } catch (error) {
    console.error("Erro ao pagar comissão:", error)
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    )
  }
}
