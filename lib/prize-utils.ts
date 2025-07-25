import { doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface Winner {
  userId: string;
  userName: string;
  cardId: string;
  type: "quadra" | "quina" | "cheia";
  prize: number;
}

export interface Draw {
  id: string;
  type: "fixed" | "accumulated";
  prizes?: {
    quadra: number;
    quina: number;
    cheia: number;
  } | {
    quadraPercent: number;
    quinaPercent: number;
    cheiaPercent: number;
  };
  totalCards?: number;
  cardPrice?: number;
}

/**
 * Credita o saldo para um usuário vencedor
 */
export async function creditUserPrize(
  userId: string,
  prize: number,
  type: "quadra" | "quina" | "cheia",
  cardId: string
): Promise<boolean> {
  try {
    // Buscar dados do usuário
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      console.error(`Usuário ${userId} não encontrado`);
      return false;
    }

    const userData = userDoc.data();
    const userName = userData.name || "Usuário";
    const currentBalance = userData.balance || 0;
    const newBalance = currentBalance + prize;

    // Atualizar saldo do usuário
    await updateDoc(doc(db, "users", userId), {
      balance: newBalance,
      totalWon: (userData.totalWon || 0) + prize,
      lastWin: new Date(),
    });

    console.log(`✅ Saldo creditado para ${userName}: R$ ${prize.toFixed(2)} (${type})`);
    return true;
  } catch (error) {
    console.error(`❌ Erro ao creditar prêmio para usuário ${userId}:`, error);
    return false;
  }
}

/**
 * Calcula o prêmio baseado no tipo de sorteio
 */
export function calculatePrize(
  type: "quadra" | "quina" | "cheia",
  draw: Draw
): number {
  if (draw.type === "fixed" && draw.prizes) {
    // Verificar se é o tipo com valores fixos
    if ('quadra' in draw.prizes && 'quina' in draw.prizes && 'cheia' in draw.prizes) {
      return draw.prizes[type] || 0;
    }
    // Se for o tipo com percentuais, usar valores padrão
    return 0;
  } else if (draw.type === "accumulated") {
    return calculateAccumulatedPrize(type, draw);
  }
  return 0;
}

/**
 * Calcula prêmio para sorteios acumulados
 */
export function calculateAccumulatedPrize(
  type: "quadra" | "quina" | "cheia",
  draw: Draw
): number {
  const totalCards = draw.totalCards || 0;
  const cardPrice = draw.cardPrice || 0;
  const totalRevenue = totalCards * cardPrice;
  
  // Distribuir 70% do total arrecadado entre os prêmios
  const totalPrizePool = totalRevenue * 0.7;
  
  // Usar percentuais configurados no sorteio, se existirem
  let quadraPercent = 20;
  let quinaPercent = 30;
  let cheiaPercent = 50;
  if (draw.prizes && 'quadraPercent' in draw.prizes && 'quinaPercent' in draw.prizes && 'cheiaPercent' in draw.prizes) {
    quadraPercent = draw.prizes.quadraPercent;
    quinaPercent = draw.prizes.quinaPercent;
    cheiaPercent = draw.prizes.cheiaPercent;
  }
  // Garantir que os percentuais somam 100 (opcional: pode lançar erro ou normalizar)
  const percentMap = {
    quadra: quadraPercent,
    quina: quinaPercent,
    cheia: cheiaPercent,
  };
  return totalPrizePool * (percentMap[type] / 100);
}

/**
 * Verifica se uma cartela é vencedora
 */
export function checkCardWinner(
  card: { numbers: number[] },
  drawnNumbers: number[]
): "quadra" | "quina" | "cheia" | null {
  // Verificar se a cartela está cheia (todos os números marcados)
  let totalMarked = 0;
  card.numbers.forEach((number, index) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const isFree = col === 2 && row === 2; // Casa do meio é livre
    if (isFree || drawnNumbers.includes(number)) {
      totalMarked++;
    }
  });
  if (totalMarked === 25) return "cheia";

  // Verificar linhas para quina ou quadra
  let foundQuina = false;
  let foundQuadra = false;
  
  for (let row = 0; row < 5; row++) {
    let markedInRow = 0;
    for (let col = 0; col < 5; col++) {
      const index = row * 5 + col;
      const number = card.numbers[index];
      const isFree = col === 2 && row === 2;
      if (isFree || drawnNumbers.includes(number)) {
        markedInRow++;
      }
    }
    if (markedInRow === 5) foundQuina = true;
    else if (markedInRow === 4) foundQuadra = true;
  }
  
  if (foundQuina) return "quina";
  if (foundQuadra) return "quadra";
  return null;
}

/**
 * Processa novos vencedores e credita prêmios
 */
export async function processNewWinners(
  previousWinners: Record<string, string[]>,
  updatedWinners: Record<string, string[]>,
  draw: Draw,
  getCardData: (cardId: string) => Promise<{ userId: string; userName: string } | null>
): Promise<Winner[]> {
  const winnerTypes: ("quadra" | "quina" | "cheia")[] = ["quadra", "quina", "cheia"];
  const newWinners: Winner[] = [];
  
  for (const type of winnerTypes) {
    const previousCards = new Set(previousWinners[type] || []);
    const currentCards = new Set(updatedWinners[type] || []);
    
    // Encontrar novos vencedores
    const newWinnerCards = Array.from(currentCards).filter(cardId => !previousCards.has(cardId));
    
    for (const cardId of newWinnerCards) {
      try {
        const cardData = await getCardData(cardId);
        if (!cardData) continue;
        
        const prize = calculatePrize(type, draw);
        
        if (prize > 0) {
          const success = await creditUserPrize(cardData.userId, prize, type, cardId);
          
          if (success) {
            newWinners.push({
              userId: cardData.userId,
              userName: cardData.userName,
              cardId,
              type,
              prize
            });
          }
        }
      } catch (error) {
        console.error(`Erro ao processar vencedor ${cardId}:`, error);
      }
    }
  }
  
  return newWinners;
} 