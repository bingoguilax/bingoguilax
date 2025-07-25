export interface User {
  id: string
  name: string
  email: string
  phone: string
  balance: number
  role: "user" | "admin"
  totalDeposited: number
  totalWithdrawn: number
  totalWon?: number
  lastWin?: Date
  createdAt: Date
}

export interface Deposit {
  id: string
  userId: string
  userName: string
  amount: number
  cpf: string
  status: "pending" | "approved" | "rejected"
  createdAt: Date
}

export interface Withdrawal {
  id: string
  userId: string
  userName: string
  amount: number
  pixKeyType: "cpf" | "phone" | "email" | "random"
  pixKey: string
  status: "pending" | "approved" | "rejected"
  createdAt: Date
}

export interface Draw {
  id: string
  name: string
  dateTime: Date
  cardPrice: number
  type: "fixed" | "accumulated"
  mode: "manual" | "automatic"
  totalPrize?: number; // Adicione esta linha
  prizes:
    | {
        quadra: number
        quina: number
        cheia: number
      }
    | {
        quadraPercent: number
        quinaPercent: number
        cheiaPercent: number
      }
  status: "waiting" | "active" | "finished"
  drawnNumbers: number[]
  currentPhase: "quadra" | "quina" | "cheia"
  externalUrl?: string
  createdAt: Date
  winners?: Record<"quadra" | "quina" | "cheia", string[]>  
  winnerDetails?: Record<"quadra" | "quina" | "cheia", WinnerDetail[]>  
}

export interface Card {
  id: string
  userId: string
  drawId: string
  numbers: number[] // Changed from number[][] to number[] (flat array of 25 numbers)
  markedNumbers: boolean[] // Changed from boolean[][] to boolean[] (flat array of 25 booleans)
  purchaseDate: Date
}

export interface Purchase {
  id: string
  userId: string
  drawId: string
  quantity: number
  totalAmount: number
  cardIds: string[]
  createdAt: Date
}

export interface WinnerDetail {
  userId: string
  userName: string
  cardId: string
  prize: number
  type: "quadra" | "quina" | "cheia"
}