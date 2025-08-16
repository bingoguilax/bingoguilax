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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserLayout } from "@/components/layout/user-layout"
import { AuthenticatedScheduler } from "@/components/authenticated-scheduler"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Draw, Purchase } from "@/lib/types"
import { Clock, Trophy, Users, ShoppingCart, Ticket, Gift } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { calculatePrize } from "@/lib/prize-utils"
import { calculateCardBonuses, formatBonusText } from "@/lib/bonus-utils"

export default function HomePage() {
  const { user, loading } = useAuth()
  const [draws, setDraws] = useState<Draw[]>([])
  const [userPurchases, setUserPurchases] = useState<Purchase[]>([])
  const [loadingDraws, setLoadingDraws] = useState(true)
  const [selectedDraw, setSelectedDraw] = useState<Draw | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedQuantity, setSelectedQuantity] = useState<number>(5)
  const [purchasing, setPurchasing] = useState(false)

  // Estados para cupom específico do sorteio
  const [selectedDrawForCoupon, setSelectedDrawForCoupon] = useState<Draw | null>(null)
  const [drawCouponCode, setDrawCouponCode] = useState("")
  const [redeemingDrawCoupon, setRedeemingDrawCoupon] = useState(false)
  const [drawCouponDialogOpen, setDrawCouponDialogOpen] = useState(false)
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

  const handleOpenCouponForDraw = (draw: Draw) => {
    setSelectedDrawForCoupon(draw)
    setDrawCouponCode("")
    setDrawCouponDialogOpen(true)
  }



  const handleRedeemDrawCoupon = async () => {
    if (!user || !drawCouponCode.trim()) {
      toast({
        title: "Erro",
        description: "Digite um código de cupom válido",
        variant: "destructive"
      })
      return
    }

    setRedeemingDrawCoupon(true)

    try {
      console.log("🎫 Resgatando cupom para sorteio:", drawCouponCode)
      const response = await fetch('/api/coupons/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: drawCouponCode.trim(),
          userId: user.id
        })
      })

      const data = await response.json()
      console.log("🎫 Resposta:", data)

      if (response.ok && data.success) {
        toast({
          title: "🎉 Cupom Resgatado!",
          description: data.message,
        })
        
        setDrawCouponCode("")
        setDrawCouponDialogOpen(false)
        
        // Recarregar os dados para mostrar as novas cartelas
        window.location.reload()
      } else {
        toast({
          title: "Erro ao resgatar cupom",
          description: data.error || "Erro desconhecido",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Erro ao resgatar cupom:", error)
      toast({
        title: "Erro",
        description: "Erro ao conectar com o servidor",
        variant: "destructive"
      })
    } finally {
      setRedeemingDrawCoupon(false)
    }
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

    // Calcular cartelas bônus
    const bonusCards = calculateCardBonuses(selectedQuantity, selectedDraw.cardBonuses)
    const totalCards = selectedQuantity + bonusCards

    setPurchasing(true)

    try {
      // Gerar cartelas (compradas + bônus)
      const cardIds: string[] = []
      const bonusCardIds: string[] = []
      
      // Cartelas compradas
      for (let i = 0; i < selectedQuantity; i++) {
        const numbers = generateBingoCard()
        const cardRef = await addDoc(collection(db, "cards"), {
          userId: user.id,
          drawId: selectedDraw.id,
          numbers,
          markedNumbers: Array(25).fill(false),
          purchaseDate: new Date(),
          isPaid: true
        })
        cardIds.push(cardRef.id)
      }

      // Cartelas bônus
      for (let i = 0; i < bonusCards; i++) {
        const numbers = generateBingoCard()
        const cardRef = await addDoc(collection(db, "cards"), {
          userId: user.id,
          drawId: selectedDraw.id,
          numbers,
          markedNumbers: Array(25).fill(false),
          purchaseDate: new Date(),
          isPaid: false,
          isBonus: true,
          fromBonus: true
        })
        bonusCardIds.push(cardRef.id)
      }

      // Criar registro de compra
      await addDoc(collection(db, "purchases"), {
        userId: user.id,
        drawId: selectedDraw.id,
        quantity: selectedQuantity,
        totalAmount,
        cardIds,
        bonusCardIds: bonusCards > 0 ? bonusCardIds : undefined,
        totalCards,
        createdAt: new Date(),
      })

      // Atualizar saldo do usuário
      await updateDoc(doc(db, "users", user.id), {
        balance: user.balance - totalAmount,
      })

      // Atualizar total de cartelas vendidas no sorteio (incrementar totalCards)
      const drawRef = doc(db, "draws", selectedDraw.id);
      await updateDoc(drawRef, {
        totalCards: ((selectedDraw as any).totalCards || 0) + totalCards,
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
          cardIds: [...cardIds, ...bonusCardIds],
          createdAt: new Date(),
        },
      ])

      const bonusMessage = bonusCards > 0 ? ` + ${bonusCards} cartela${bonusCards > 1 ? 's' : ''} bônus!` : ""
      toast({
        title: "Compra realizada!",
        description: `${selectedQuantity} cartela${selectedQuantity > 1 ? 's' : ''} comprada${selectedQuantity > 1 ? 's' : ''}${bonusMessage}`,
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
                      
                      {/* Mostrar bonificações disponíveis */}
                      {draw.cardBonuses && draw.cardBonuses.length > 0 && draw.cardBonuses.some(bonus => bonus.isActive) && (
                        <div className="bg-green-500/20 border border-green-400 rounded p-2 mt-2">
                          <div className="flex items-center gap-1 text-green-100 font-semibold text-sm mb-1">
                            <Gift className="h-4 w-4" />
                            Bonificações Ativas
                          </div>
                          {draw.cardBonuses
                            .filter(bonus => bonus.isActive)
                            .sort((a, b) => a.minQuantity - b.minQuantity)
                            .map((bonus, index) => (
                              <div key={bonus.id} className="text-xs text-green-100 flex justify-between">
                                <span>Compre {bonus.minQuantity}+:</span>
                                <span className="font-medium">+{bonus.bonusCards} grátis</span>
                              </div>
                            ))}
                        </div>
                      )}

                      {draw.status === "waiting" && (
                        <div className="text-center py-2 bg-yellow-50 rounded text-yellow-700 text-sm">
                          Inicia em: {getTimeUntilDraw(draw.dateTime)}
                        </div>
                      )}

                      {hasPurchasedCards(draw.id) ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <Button
                              className="bg-blue-600 hover:bg-blue-700 text-white border-none"
                              onClick={() => handleBuyCards(draw)}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Comprar</span>
                              <span className="sm:hidden">+</span>
                            </Button>
                            <Button
                              className="bg-green-600 hover:bg-green-700 text-white border-none"
                              onClick={() => handleOpenCouponForDraw(draw)}
                            >
                              <Ticket className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Cupom</span>
                              <span className="sm:hidden">🎫</span>
                            </Button>
                          </div>
                          <Button
                            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black border-none"
                            onClick={() => router.push(`/sala/${draw.id}`)}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            Entrar na Sala
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white border-none"
                            onClick={() => handleBuyCards(draw)}
                          >
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Comprar</span>
                            <span className="sm:hidden">💳</span>
                          </Button>
                          <Button
                            className="bg-purple-600 hover:bg-purple-700 text-white border-none"
                            onClick={() => handleOpenCouponForDraw(draw)}
                          >
                            <Ticket className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Cupom</span>
                            <span className="sm:hidden">🎫</span>
                          </Button>
                        </div>
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
                  
                  {/* Mostrar bonificações se aplicável */}
                  {selectedDraw.cardBonuses && calculateCardBonuses(selectedQuantity, selectedDraw.cardBonuses) > 0 && (
                    <div className="flex justify-between text-sm mb-2 text-green-600 font-medium">
                      <span>🎁 Cartelas bônus:</span>
                      <span>+{calculateCardBonuses(selectedQuantity, selectedDraw.cardBonuses)} grátis</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between font-bold">
                    <span>Total a pagar:</span>
                    <span>R$ {(selectedQuantity * selectedDraw.cardPrice).toFixed(2)}</span>
                  </div>
                  
                  {/* Total de cartelas incluindo bônus */}
                  {selectedDraw.cardBonuses && calculateCardBonuses(selectedQuantity, selectedDraw.cardBonuses) > 0 && (
                    <div className="flex justify-between text-sm mt-2 text-green-600 font-medium">
                      <span>Total de cartelas:</span>
                      <span>{selectedQuantity + calculateCardBonuses(selectedQuantity, selectedDraw.cardBonuses)} cartelas</span>
                    </div>
                  )}
                </div>

                {/* Exibir descrição das bonificações */}
                {selectedDraw.cardBonuses && formatBonusText(selectedQuantity, selectedDraw.cardBonuses) && (
                  <div className="bg-green-50 border border-green-200 p-3 rounded-lg">
                    <p className="text-sm text-green-700 font-medium">
                      {formatBonusText(selectedQuantity, selectedDraw.cardBonuses)}
                    </p>
                  </div>
                )}

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



        {/* Modal de Resgate de Cupom para Sorteio Específico */}
        <Dialog open={drawCouponDialogOpen} onOpenChange={setDrawCouponDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Resgatar Cupom
              </DialogTitle>
              <DialogDescription>
                {selectedDrawForCoupon ? (
                  <>Resgate um cupom para o sorteio: <strong>{selectedDrawForCoupon.name}</strong></>
                ) : (
                  "Digite o código do seu cupom para ganhar cartelas gratuitas"
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {selectedDrawForCoupon && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-800 text-sm mb-2">
                    <Trophy className="h-4 w-4" />
                    <span className="font-medium">Sorteio Selecionado:</span>
                  </div>
                  <div className="text-blue-700">
                    <p className="font-semibold">{selectedDrawForCoupon.name}</p>
                    <p className="text-sm">Data: {formatDateTime(selectedDrawForCoupon.dateTime)}</p>
                    <p className="text-sm">Valor por cartela: R$ {selectedDrawForCoupon.cardPrice.toFixed(2)}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="draw-coupon-code">Código do Cupom</Label>
                <Input
                  id="draw-coupon-code"
                  placeholder="Ex: CUPOM10"
                  value={drawCouponCode}
                  onChange={(e) => setDrawCouponCode(e.target.value.toUpperCase())}
                  className="text-center text-lg font-mono tracking-wider"
                />
              </div>
              
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-green-800 text-sm">
                  <Gift className="h-4 w-4" />
                  <span className="font-medium">Importante:</span>
                </div>
                <ul className="text-green-700 text-sm mt-2 space-y-1">
                  <li>• O cupom deve ser válido para este sorteio específico</li>
                  <li>• Cada cupom pode ser usado apenas uma vez</li>
                  <li>• As cartelas serão adicionadas automaticamente</li>
                  <li>• Verifique se o código está correto</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDrawCouponDialogOpen(false)
                  setDrawCouponCode("")
                  setSelectedDrawForCoupon(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRedeemDrawCoupon}
                disabled={redeemingDrawCoupon || !drawCouponCode.trim()}
                className="bg-green-600 hover:bg-green-700"
              >
                {redeemingDrawCoupon ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Resgatando...
                  </>
                ) : (
                  <>
                    <Ticket className="h-4 w-4 mr-2" />
                    Resgatar Cupom
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UserLayout>
  )
}
