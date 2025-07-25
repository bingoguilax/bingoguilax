"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, query, where, addDoc, updateDoc, doc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserLayout } from "@/components/layout/user-layout"
import { AuthenticatedScheduler } from "@/components/authenticated-scheduler"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Draw, Purchase } from "@/lib/types"
import { Clock, Trophy, Users, ShoppingCart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { calculatePrize } from "@/lib/prize-utils"

export default function HomePage() {
  const { user, loading } = useAuth()
  const [draws, setDraws] = useState<Draw[]>([])
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([])
  const [loadingDraws, setLoadingDraws] = useState(true)
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedQuantity, setSelectedQuantity] = useState<number>(5)
  const [purchasing, setPurchasing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        // Buscar sorteios disponíveis
        const drawsQuery = query(collection(db, "draws"), where("status", "in", ["waiting", "active"]))
        const drawsSnapshot = await getDocs(drawsQuery)
        const drawsData = drawsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          dateTime: doc.data().dateTime.toDate(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Draw[]

        setDraws(drawsData.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()))

        // Buscar compras do usuário
        const purchasesQuery = query(collection(db, "purchases"), where("userId", "==", user.id))
        const purchasesSnapshot = await getDocs(purchasesQuery)
        const purchasesData = purchasesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Purchase[]

        setUserPurchases(purchasesData)
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoadingDraws(false)
      }
    }

    fetchData()
  }, [user])

  const handleBuyCards = (draw: Draw) => {
    setSelectedDraw(draw)
    setSelectedQuantity(5)
    setIsModalOpen(true)
  }

  const handlePurchase = async () => {
    if (!user || !selectedDraw) return

    const totalAmount = selectedQuantity * selectedDraw.cardPrice

    if (user.balance < totalAmount) {
      toast({
        title: "Saldo insuficiente",
        description: "Você não tem saldo suficiente para esta compra.",
        variant: "destructive",
      })
      return
    }

    setPurchasing(true)

    try {
      // Gerar cartelas
      const cardIds: string[] = []
      for (let i = 0; i < selectedQuantity; i++) {
        const numbers = generateBingoCard()
        const cardRef = await addDoc(collection(db, "cards"), {
          userId: user.id,
          drawId: selectedDraw.id,
          numbers, // Now this is a flat array of 25 numbers
          markedNumbers: Array(25).fill(false), // Flat array of 25 booleans
          purchaseDate: new Date(),
        })
        cardIds.push(cardRef.id)
      }

      // Criar registro de compra
      await addDoc(collection(db, "purchases"), {
        userId: user.id,
        drawId: selectedDraw.id,
        quantity: selectedQuantity,
        totalAmount,
        cardIds,
        createdAt: new Date(),
      })

      // Atualizar saldo do usuário
      await updateDoc(doc(db, "users", user.id), {
        balance: user.balance - totalAmount,
      })

      // Atualizar total de cartelas vendidas no sorteio (incrementar totalCards)
      const drawRef = doc(db, "draws", selectedDraw.id);
      await updateDoc(drawRef, {
        totalCards: ((selectedDraw as any).totalCards || 0) + selectedQuantity,
      });

      // Atualizar estado local
      setUserPurchases((prev) => [
        ...prev,
        {
          id: "temp",
          userId: user.id,
          drawId: selectedDraw.id,
          quantity: selectedQuantity,
          totalAmount,
          cardIds,
          createdAt: new Date(),
        },
      ])

      toast({
        title: "Compra realizada!",
        description: `${selectedQuantity} cartelas compradas com sucesso.`,
      })

      setIsModalOpen(false)

      // Recarregar a página para atualizar o saldo
      window.location.reload()
    } catch (error) {
      console.error("Error purchasing cards:", error)
      toast({
        title: "Erro na compra",
        description: "Não foi possível processar a compra. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setPurchasing(false)
    }
  }

  const generateBingoCard = (): number[] => {
    // Generate a flat array of 25 numbers (5x5 grid)
    const card: number[] = []
    const ranges = [
      [1, 15], // B column
      [16, 30], // I column
      [31, 45], // N column
      [46, 60], // G column
      [61, 75], // O column
    ]

    // Generate numbers for each column
    for (let col = 0; col < 5; col++) {
      const [min, max] = ranges[col]
      const availableNumbers = Array.from({ length: max - min + 1 }, (_, i) => min + i)

      for (let row = 0; row < 5; row++) {
        const index = row * 5 + col // Convert 2D position to 1D index

        if (col === 2 && row === 2) {
          // Center is always free space
          card[index] = 0
        } else {
          const randomIndex = Math.floor(Math.random() * availableNumbers.length)
          const number = availableNumbers.splice(randomIndex, 1)[0]
          card[index] = number
        }
      }
    }

    return card
  }

  const hasPurchasedCards = (drawId: string): boolean => {
    return userPurchases.some((purchase) => purchase.drawId === drawId)
  }

  const getTimeUntilDraw = (date: Date) => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff <= 0) return "Iniciado"

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    return `${hours}h ${minutes}m ${seconds}s`
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
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

  const quantityOptions = [5, 10, 20, 30, 40]

  return (
    <UserLayout>
      {/* Scheduler para iniciar sorteios automaticamente */}
      <AuthenticatedScheduler />

      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-2">Olá, {user.name}!</h1>
          <p className="text-blue-100 mb-4">Seu saldo atual: R$ {user.balance.toFixed(2)}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              onClick={() => router.push("/depositar")}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Recarregar Crédito
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/saque")}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              Sacar Agora
            </Button>
          </div>
        </div>

        {/* Available Draws */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Salas de Bingo Disponíveis</h2>
          {loadingDraws ? (
            <div className="text-center py-8">Carregando sorteios...</div>
          ) : draws.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum sorteio disponível no momento</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {draws.map((draw) => (
                <Card
                  key={draw.id}
                  className="hover:shadow-lg transition-shadow bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{draw.name}</CardTitle>
                      <Badge variant={draw.status === "active" ? "default" : "secondary"}>
                        {draw.status === "active" ? "Ativo" : "Aguardando"}
                      </Badge>
                    </div>
                    <CardDescription>
                      <div className="flex items-center gap-2 text-sm text-white">
                        <Clock className="h-4 w-4" />
                        {formatDateTime(draw.dateTime)}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Valor da Cartela:</span>
                        <span className="font-medium">R$ {draw.cardPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Tipo:</span>
                        <span className="font-medium">{draw.type === "fixed" ? "Fixo" : "Acumulado"}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Modo:</span>
                        <span className="font-medium">{draw.mode === "automatic" ? "Automático" : "Manual"}</span>
                      </div>
                      {/* Prêmios */}
                      <div className="bg-white/10 rounded p-2 mt-2">
                        <div className="font-semibold mb-1 text-white">Prêmios</div>
                        {draw.type === "fixed" ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span>Quadra:</span>
                              <span>R$ {(draw.prizes as any).quadra.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Quina:</span>
                              <span>R$ {(draw.prizes as any).quina.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Cheia:</span>
                              <span>R$ {(draw.prizes as any).cheia.toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between text-sm">
                              <span>Quadra:</span>
                              <span>R$ {calculatePrize("quadra", draw).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Quina:</span>
                              <span>R$ {calculatePrize("quina", draw).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>Cheia:</span>
                              <span>R$ {calculatePrize("cheia", draw).toFixed(2)}</span>
                            </div>
                          </>
                        )}
                      </div>
                      {draw.status === "waiting" && (
                        <div className="text-center py-2 bg-yellow-50 rounded text-yellow-700 text-sm">
                          Inicia em: {getTimeUntilDraw(draw.dateTime)}
                        </div>
                      )}

                      {hasPurchasedCards(draw.id) ? (
                        <Button
                          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black border-none"
                          onClick={() => router.push(`/sala/${draw.id}`)}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Entrar na Sala
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white border-none"
                          onClick={() => handleBuyCards(draw)}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Comprar Cartelas
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Modal de Compra de Cartelas */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Comprar Cartelas</DialogTitle>
              <DialogDescription>{selectedDraw && `Sorteio: ${selectedDraw.name}`}</DialogDescription>
            </DialogHeader>
            {selectedDraw && (
              <div className="space-y-4 py-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Valor por cartela</p>
                  <p className="text-2xl font-bold">R$ {selectedDraw.cardPrice.toFixed(2)}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantidade de cartelas:</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={selectedQuantity}
                    onChange={e => setSelectedQuantity(Math.max(1, Math.min(1000, Number(e.target.value))))}
                    className="w-full mb-2 rounded border px-2 py-1 text-black"
                    placeholder="Digite a quantidade desejada"
                  />
                  <div className="grid grid-cols-5 gap-2">
                    {quantityOptions.map((qty) => (
                      <Button
                        key={qty}
                        variant={selectedQuantity === qty ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedQuantity(qty)}
                      >
                        {qty}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex justify-between text-sm mb-2">
                    <span>Quantidade:</span>
                    <span>{selectedQuantity} cartelas</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Valor unitário:</span>
                    <span>R$ {selectedDraw.cardPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>R$ {(selectedQuantity * selectedDraw.cardPrice).toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-center text-sm text-muted-foreground">Seu saldo: R$ {user.balance.toFixed(2)}</div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handlePurchase}
                disabled={
                  purchasing || !selectedDraw || user.balance < selectedQuantity * (selectedDraw?.cardPrice || 0)
                }
              >
                {purchasing ? "Comprando..." : "Comprar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UserLayout>
  )
}
