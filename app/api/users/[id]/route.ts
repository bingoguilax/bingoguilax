import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    console.log(`Iniciando deleção do usuário: ${userId}`);

    // Deletar do Authentication primeiro (mais rápido)
    try {
      console.log('Deletando do Authentication...');
      await adminAuth.deleteUser(userId);
      console.log('Usuário deletado do Authentication com sucesso');
    } catch (authError: any) {
      // Se o usuário não existir no Authentication, continuar
      if (authError.code !== 'auth/user-not-found') {
        console.error('Erro ao deletar usuário do Authentication:', authError);
        return NextResponse.json(
          { error: 'Erro ao deletar usuário do Authentication' },
          { status: 500 }
        );
      }
      console.log('Usuário não encontrado no Authentication, continuando...');
    }

    // Deletar do Firestore
    console.log('Deletando do Firestore...');
    await adminDb.collection('users').doc(userId).delete();
    console.log('Usuário deletado do Firestore com sucesso');

    return NextResponse.json(
      { message: 'Usuário deletado com sucesso' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
} 