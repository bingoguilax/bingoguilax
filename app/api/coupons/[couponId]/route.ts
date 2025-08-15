import { NextRequest, NextResponse } from "next/server"
import { adminDb } from "@/lib/firebase-admin"

export async function PUT(
  request: NextRequest,
  { params }: { params: { couponId: string } }
) {
  try {
    const { couponId } = params
    const body = await request.json()
    console.log("✏️ API - Editando cupom:", couponId, body)
    
    const { code, cardsAmount, maxUses, isActive } = body
    
    // Validações
    if (!code || !cardsAmount || !maxUses) {
      return NextResponse.json(
        { error: "Código, quantidade de cartelas e usos máximos são obrigatórios" },
        { status: 400 }
      )
    }
    
    // Verificar se cupom existe
    const couponDoc = await adminDb.collection("coupons").doc(couponId).get()
    
    if (!couponDoc.exists) {
      return NextResponse.json(
        { error: "Cupom não encontrado" },
        { status: 404 }
      )
    }
    
    const currentData = couponDoc.data()
    
    // Verificar se o novo código já existe (se foi alterado)
    if (code !== currentData?.code) {
      const existingCouponSnapshot = await adminDb.collection("coupons")
        .where("code", "==", code)
        .where("drawId", "==", currentData?.drawId)
        .get()
      
      if (!existingCouponSnapshot.empty) {
        return NextResponse.json(
          { error: "Já existe um cupom com este código neste sorteio" },
          { status: 400 }
        )
      }
    }
    
    // Atualizar cupom
    const updateData = {
      code,
      cardsAmount: parseInt(cardsAmount),
      maxUses: parseInt(maxUses),
      isActive: isActive !== undefined ? isActive : currentData?.isActive,
      updatedAt: new Date()
    }
    
    await adminDb.collection("coupons").doc(couponId).update(updateData)
    
    console.log("✅ API - Cupom editado com sucesso:", couponId)
    
    return NextResponse.json({
      success: true,
      message: "Cupom editado com sucesso"
    })
    
  } catch (error) {
    console.error("❌ API - Erro ao editar cupom:", error)
    return NextResponse.json(
      { 
        error: "Erro ao editar cupom",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { couponId: string } }
) {
  try {
    const { couponId } = params
    console.log("🗑️ API - Excluindo cupom:", couponId)
    
    // Verificar se cupom existe
    const couponDoc = await adminDb.collection("coupons").doc(couponId).get()
    
    if (!couponDoc.exists) {
      return NextResponse.json(
        { error: "Cupom não encontrado" },
        { status: 404 }
      )
    }
    
    const couponData = couponDoc.data()
    
    // Verificar se cupom já foi usado
    if (couponData?.currentUses && couponData.currentUses > 0) {
      return NextResponse.json(
        { error: "Não é possível excluir um cupom que já foi usado" },
        { status: 400 }
      )
    }
    
    // Excluir cupom
    await adminDb.collection("coupons").doc(couponId).delete()
    
    console.log("✅ API - Cupom excluído com sucesso:", couponId)
    
    return NextResponse.json({
      success: true,
      message: "Cupom excluído com sucesso"
    })
    
  } catch (error) {
    console.error("❌ API - Erro ao excluir cupom:", error)
    return NextResponse.json(
      { 
        error: "Erro ao excluir cupom",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      },
      { status: 500 }
    )
  }
}
