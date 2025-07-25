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
      
      setPrizeHistory(prizes)
    } catch (error) {
      console.error("Erro ao carregar histórico de prêmios:", error)
    } finally {
      setLoadingPrizes(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null
  }

  return (
    <UserLayout>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Meu Perfil</CardTitle>
            <CardDescription>Informações da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <User className="h-4 w-4" />
                  Nome Completo
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">{user.name}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <Mail className="h-4 w-4" />
                  Email
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">{user.email}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <Phone className="h-4 w-4" />
                  Telefone
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">{user.phone}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                  <DollarSign className="h-4 w-4" />
                  Saldo Atual
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-green-700 font-medium">
                  R$ {user.balance.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium mb-4">Estatísticas</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">R$ {user.totalDeposited.toFixed(2)}</div>
                  <div className="text-sm text-blue-600">Total Depositado</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">R$ {user.totalWithdrawn.toFixed(2)}</div>
                  <div className="text-sm text-purple-600">Total Sacado</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">R$ {(user.totalWon || 0).toFixed(2)}</div>
                  <div className="text-sm text-green-600">Total Ganho</div>
                </div>
              </div>
            </div>

            {/* Histórico de Prêmios */}
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-medium">Histórico de Prêmios</h3>
              </div>
              
              {loadingPrizes ? (
                <div className="text-center py-8 text-gray-500">Carregando prêmios...</div>
              ) : prizeHistory.length > 0 ? (
                <div className="space-y-3">
                  {prizeHistory.map((prize) => (
                    <div key={prize.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge 
                          className={
                            prize.type === "cheia" ? "bg-green-100 text-green-800" :
                            prize.type === "quina" ? "bg-blue-100 text-blue-800" :
                            "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {prize.type === "cheia" ? "Cartela Cheia" : 
                           prize.type === "quina" ? "Quina" : "Quadra"}
                        </Badge>
                        <div>
                          <div className="font-medium">{prize.drawName}</div>
                          <div className="text-sm text-gray-500">
                            {prize.date.toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-green-600">
                          R$ {prize.prize.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhum prêmio ganho ainda</p>
                  <p className="text-sm">Participe dos sorteios para ganhar prêmios!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
