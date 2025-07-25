import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Webhook recebido:", body);

    // Ajuste os campos conforme o payload real do webhook SuitPay
    const txid = body.txid || body.idTransaction;
    const valor = body.valor || body.amount || body.value;
    const status = body.statusTransaction;

    // Considere como aprovado se statusTransaction for PAID_OUT ou PAYMENT_ACCEPT
    if (!txid || !valor || !(status === 'PAID_OUT' || status === 'PAYMENT_ACCEPT')) {
      return NextResponse.json({ error: 'Dados inválidos ou pagamento não aprovado.' }, { status: 400 });
    }

    // Buscar depósito pelo txid
    const depositsSnapshot = await adminDb.collection('deposits').where('txid', '==', txid).get();
    if (depositsSnapshot.empty) {
      return NextResponse.json({ error: 'Depósito não encontrado.' }, { status: 404 });
    }
    const depositDoc = depositsSnapshot.docs[0];
    const depositData = depositDoc.data();
    if (depositData.status === 'approved') {
      return NextResponse.json({ message: 'Depósito já aprovado.' });
    }

    // Aprovar depósito
    await adminDb.collection('deposits').doc(depositDoc.id).update({
      status: 'approved',
    });

    // Buscar usuário antes de atualizar
    const userRef = adminDb.collection('users').doc(depositData.userId);
    const userSnap = await userRef.get();
    const userData = userSnap.data();
    const saldoAtual = userData?.balance || 0;
    const totalDepositedAtual = userData?.totalDeposited || 0;
    const valorNumerico = Number(valor);

    // Atualizar saldo do usuário
    await userRef.update({
      balance: saldoAtual + valorNumerico,
      totalDeposited: totalDepositedAtual + valorNumerico,
    });

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Erro no webhook SuitPay:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 