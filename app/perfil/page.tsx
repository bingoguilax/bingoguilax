"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserLayout } from "@/components/layout/user-layout"
import { useAuth } from "@/hooks/use-auth"
import { User, Mail, Phone, DollarSign, Trophy, Calendar } from "lucide-react"
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"

interface PrizeHistory {
  id: string;
  drawName: string;
  type: "quadra" | "quina" | "cheia";
  prize: number;
  date: Date;
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [prizeHistory, setPrizeHistory] = useState<PrizeHistory[]>([])
  const [loadingPrizes, setLoadingPrizes] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      loadPrizeHistory()
    }
  }, [user])

  const loadPrizeHistory = async () => {
    if (!user) return
    
    setLoadingPrizes(true)
    try {
      // Buscar cartelas do usuário que ganharam prêmios
      const cardsQuery = query(
        collection(db, "cards"),
        where("userId", "==", user.id),
        orderBy("purchaseDate", "desc"),
        limit(50)
      )
      const cardsSnapshot = await getDocs(cardsQuery)
      
      const prizes: PrizeHistory[] = []
      
      for (const cardDoc of cardsSnapshot.docs) {
        const cardData = cardDoc.data()
        
        // Buscar dados do sorteio
        const drawDoc = await getDoc(doc(db, "draws", cardData.drawId))
        if (!drawDoc.exists()) continue
        
        const drawData = drawDoc.data()
        const winners = drawData.winners || {}
        
        // Verificar se esta cartela ganhou algum prêmio
        for (const type of ["quadra", "quina", "cheia"] as const) {
          if (winners[type]?.includes(cardDoc.id)) {
            const prize = drawData.type === "fixed" 
              ? (drawData.prizes as any)[type] || 0
              : 100 // Valor padrão para sorteios acumulados
            
            prizes.push({
              id: cardDoc.id,
              drawName: drawData.name || "Sorteio",
              type,
              prize,
              date: drawData.dateTime?.toDate() || new Date()
            })
          }
        }
      }
      
      setPrizeHistory(prizes.sort((a, b) => b.date.getTime() - a.date.getTime()))
    } catch (error) {
      console.error("Erro ao carregar histórico de prêmios:", error)
    } finally {
      setLoadingPrizes(false)
    }
  }

  if (loading) {
    return (
      <UserLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2">Carregando...</p>
          </div>
        </div>
      </UserLayout>
    )
  }

  if (!user) {
    return null
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getTypeLabel = (type: "quadra" | "quina" | "cheia") => {
    switch (type) {
      case "quadra":
        return "Quadra"
      case "quina":
        return "Quina"
      case "cheia":
        return "Cartela Cheia"
      default:
        return type
    }
  }

  const getTypeColor = (type: "quadra" | "quina" | "cheia") => {
    switch (type) {
      case "quadra":
        return "bg-blue-100 text-blue-800"
      case "quina":
        return "bg-green-100 text-green-800"
      case "cheia":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const totalWinnings = prizeHistory.reduce((total, prize) => total + prize.prize, 0)

  return (
    <UserLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Meu Perfil</h1>
            <p className="text-muted-foreground">Suas informações pessoais e estatísticas</p>
          </div>
        </div>

        {/* Informações Pessoais */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{user.name}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                  <p className="font-medium">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{user.phone || "Não informado"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Membro desde</p>
                  <p className="font-medium">{formatDateTime(user.createdAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estatísticas Financeiras */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Saldo atual:</span>
                <span className="font-bold text-lg text-green-600">
                  R$ {user.balance.toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total depositado:</span>
                <span className="font-medium">
                  R$ {(user.totalDeposited || 0).toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total sacado:</span>
                <span className="font-medium">
                  R$ {(user.totalWithdrawn || 0).toFixed(2)}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total ganho em prêmios:</span>
                <span className="font-medium text-yellow-600">
                  R$ {totalWinnings.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de Prêmios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Histórico de Prêmios
            </CardTitle>
            <CardDescription>
              Todos os prêmios que você ganhou nos sorteios
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPrizes ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Carregando histórico...</p>
              </div>
            ) : prizeHistory.length > 0 ? (
              <div className="space-y-4">
                {prizeHistory.map((prize) => (
                  <div key={`${prize.id}-${prize.type}`} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{prize.drawName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDateTime(prize.date)}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <Badge className={getTypeColor(prize.type)}>
                        {getTypeLabel(prize.type)}
                      </Badge>
                      <span className="font-bold text-green-600">
                        R$ {prize.prize.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
                
                {prizeHistory.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total de Prêmios:</span>
                      <span className="text-green-600">
                        R$ {totalWinnings.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum prêmio ganho ainda</p>
                <p className="text-sm">Participe dos sorteios para ganhar prêmios incríveis!</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}