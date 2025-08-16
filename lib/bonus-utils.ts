import type { CardBonus } from "./types"

/**
 * Calcula quantas cartelas bônus um usuário deve receber baseado na quantidade comprada
 * @param quantity Quantidade de cartelas compradas
 * @param cardBonuses Array de bonificações configuradas para o sorteio
 * @returns Quantidade total de cartelas bônus a serem creditadas
 */
export function calculateCardBonuses(quantity: number, cardBonuses?: CardBonus[]): number {
  if (!cardBonuses || cardBonuses.length === 0) {
    return 0
  }

  let totalBonusCards = 0

  // Filtrar apenas bonificações ativas e ordenar por quantidade mínima (menor para maior)
  const activeBonuses = cardBonuses
    .filter(bonus => bonus.isActive)
    .sort((a, b) => a.minQuantity - b.minQuantity)

  // Aplicar todas as bonificações que se qualificam
  for (const bonus of activeBonuses) {
    if (quantity >= bonus.minQuantity) {
      totalBonusCards += bonus.bonusCards
    }
  }

  return totalBonusCards
}

/**
 * Obter descrição das bonificações aplicáveis para uma quantidade específica
 * @param quantity Quantidade de cartelas que o usuário pretende comprar
 * @param cardBonuses Array de bonificações configuradas para o sorteio
 * @returns Array de descrições das bonificações que serão aplicadas
 */
export function getApplicableBonuses(quantity: number, cardBonuses?: CardBonus[]): string[] {
  if (!cardBonuses || cardBonuses.length === 0) {
    return []
  }

  const applicableBonuses: string[] = []

  // Filtrar apenas bonificações ativas
  const activeBonuses = cardBonuses
    .filter(bonus => bonus.isActive)
    .sort((a, b) => a.minQuantity - b.minQuantity)

  for (const bonus of activeBonuses) {
    if (quantity >= bonus.minQuantity) {
      applicableBonuses.push(bonus.description)
    }
  }

  return applicableBonuses
}

/**
 * Formatar texto de bonificações para exibição ao usuário
 * @param quantity Quantidade de cartelas
 * @param cardBonuses Array de bonificações
 * @returns Texto formatado descrevendo as bonificações
 */
export function formatBonusText(quantity: number, cardBonuses?: CardBonus[]): string {
  const bonusCards = calculateCardBonuses(quantity, cardBonuses)
  const applicableBonuses = getApplicableBonuses(quantity, cardBonuses)

  if (bonusCards === 0) {
    return ""
  }

  if (applicableBonuses.length === 1) {
    return `🎁 Bônus: +${bonusCards} cartela${bonusCards > 1 ? 's' : ''} grátis (${applicableBonuses[0]})`
  }

  return `🎁 Bônus: +${bonusCards} cartela${bonusCards > 1 ? 's' : ''} grátis`
}
