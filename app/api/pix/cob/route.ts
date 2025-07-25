import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const {
      amount,
      dueDate,
      callbackUrl,
      client, // { name, document, email }
      split,  // { username, percentageSplit }
      requestNumber
    } = await req.json();

    const splitObj = {
      username: "contatogrupofluxcom",
      percentageSplit: 10
    };

    const payload = {
      requestNumber,
      dueDate,
      amount: Number(amount),
      callbackUrl: "https://bingofluxsolucoes-khaki.vercel.app/api/pix/webhook",
      client,
      split: splitObj
    };

    const response = await fetch('https://ws.suitpay.app/api/v1/gateway/request-qrcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ci': process.env.SUITPAY_CLIENT_ID!,
        'cs': process.env.SUITPAY_CLIENT_SECRET!
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Erro SuitPay:', data);
      return NextResponse.json({ error: data.message || 'Erro na SuitPay', details: data }, { status: 500 });
    }

    // Retorne os campos relevantes do SuitPay
    return NextResponse.json({
      ...data
    });
  } catch (error: any) {
    console.error('Erro SuitPay:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 