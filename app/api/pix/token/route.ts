import { NextRequest, NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = await fetch(`${process.env.SUITPAY_BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.SUITPAY_CLIENT_ID,
        client_secret: process.env.SUITPAY_CLIENT_SECRET,
        grant_type: 'client_credentials'
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.message || 'Erro ao autenticar na SuitPay' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 