"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserLayout } from "@/components/layout/user-layout"
import { useAuth } from "@/hooks/use-auth"
import { User, Mail, Phone, DollarSign, Trophy, Calendar, Users, Share2, Copy, CreditCard } from "lucide-react"
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

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
  const [copied, setCopied] = useState(false)
  const [generatingCode, setGeneratingCode] = useState(false)
  
  // Estados para saque de comissão
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false)
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: "",
    pixKeyType: "cpf" as "cpf" | "phone" | "email" | "random",
    pixKey: ""
  })
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false)
  const [withdrawalSettings, setWithdrawalSettings] = useState({
    minWithdrawal: 10,
    dailyWithdrawalLimit: 1
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user) {
      loadPrizeHistory()
      loadWithdrawalSettings()
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

  // Função para gerar código de afiliado único
  const generateAffiliateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = ''
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  // Gerar código de afiliado se o usuário não tiver um
  const ensureAffiliateCode = async (): Promise<string | null> => {
    if (!user?.id || user?.affiliateCode) return user?.affiliateCode || null
    
    setGeneratingCode(true)
    try {
      const newCode = generateAffiliateCode()
      await updateDoc(doc(db, "users", user.id), {
        affiliateCode: newCode,
        isActiveAffiliate: true,
        referredUsers: user.referredUsers || [],
        totalCommission: user.totalCommission || 0
      })
      
      // Atualizar o usuário localmente (seria melhor recarregar do hook useAuth)
      window.location.reload()
      return newCode
    } catch (error) {
      console.error("Erro ao gerar código de afiliado:", error)
      return null
    } finally {
      setGeneratingCode(false)
    }
  }

  const copyAffiliateLink = async () => {
    let code: string | null | undefined = user?.affiliateCode
    
    if (!code) {
      code = await ensureAffiliateCode()
      if (!code) return
    }
    
    const affiliateLink = `${window.location.origin}/registro?ref=${code}`
    
    try {
      await navigator.clipboard.writeText(affiliateLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Erro ao copiar link:", error)
    }
  }

  const loadWithdrawalSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "affiliate"))
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data()
        setWithdrawalSettings({
          minWithdrawal: settings.minWithdrawal || 10,
          dailyWithdrawalLimit: settings.dailyWithdrawalLimit || 1
        })
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error)
    }
  }

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    console.log("💳 INÍCIO - Processando solicitação de saque")
    console.log("👤 Usuário:", { id: user.id, name: user.name, totalCommission: user.totalCommission })
    console.log("📝 Formulário:", withdrawalForm)
    console.log("⚙️ Configurações:", withdrawalSettings)

    const amount = parseFloat(withdrawalForm.amount)
    console.log("💰 Valor convertido:", amount)
    
    // Validações
    if (amount < withdrawalSettings.minWithdrawal) {
      console.log("❌ Valor menor que o mínimo:", amount, "<", withdrawalSettings.minWithdrawal)
      alert(`Valor mínimo para saque é R$ ${withdrawalSettings.minWithdrawal.toFixed(2)}`)
      return
    }

    if (amount > (user.totalCommission || 0)) {
      console.log("❌ Valor maior que saldo:", amount, ">", user.totalCommission)
      alert("Valor maior que o saldo disponível")
      return
    }

    console.log("✅ Validações passaram, enviando para API...")

    setSubmittingWithdrawal(true)
    try {
      const requestData = {
        amount,
        pixKeyType: withdrawalForm.pixKeyType,
        pixKey: withdrawalForm.pixKey
      }

      console.log("📤 Dados da requisição:", requestData)
      console.log("🔑 Headers:", {
        'Content-Type': 'application/json',
        'x-user-id': user.id
      })

      const response = await fetch('/api/affiliate-withdrawals/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
        },
        body: JSON.stringify(requestData)
      })

      console.log("📥 Resposta da API:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (response.ok) {
        const result = await response.json()
        console.log("✅ Sucesso:", result)
        alert("Solicitação de saque enviada com sucesso!")
        setWithdrawalDialogOpen(false)
        setWithdrawalForm({
          amount: "",
          pixKeyType: "cpf",
          pixKey: ""
        })
        // Recarregar página para atualizar saldo
        window.location.reload()
      } else {
        console.log("❌ Erro na resposta:", response.status)
        try {
          const error = await response.json()
          console.log("❌ Erro detalhado:", error)
          alert(error.error || "Erro ao solicitar saque")
        } catch (parseError) {
          console.log("❌ Erro ao parsear resposta de erro:", parseError)
          alert("Erro ao solicitar saque")
        }
      }
    } catch (error) {
      console.error("💥 Erro na requisição:", error)
      alert("Erro ao solicitar saque")
    } finally {
      setSubmittingWithdrawal(false)
      console.log("🏁 FIM - Processamento finalizado")
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

            {/* Seção de Afiliado */}
            <div className="border-t pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-medium">Programa de Afiliado</h3>
              </div>
              
              <div className="grid gap-4 md:grid-cols-3 mb-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{user.referredUsers?.length || 0}</div>
                  <div className="text-sm text-blue-600">Pessoas Indicadas</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">R$ {(user.totalCommission || 0).toFixed(2)}</div>
                  <div className="text-sm text-green-600">Saldo Disponível</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-2 text-center">
                    Mínimo: R$ {withdrawalSettings.minWithdrawal.toFixed(2)}
                  </div>
                  <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        className="w-full bg-purple-600 hover:bg-purple-700"
                        disabled={!user.totalCommission || user.totalCommission < withdrawalSettings.minWithdrawal}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Sacar Comissões
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Solicitar Saque de Comissões</DialogTitle>
                        <DialogDescription>
                          Saldo disponível: R$ {(user.totalCommission || 0).toFixed(2)}
                          <br />
                          Valor mínimo: R$ {withdrawalSettings.minWithdrawal.toFixed(2)}
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="amount">Valor do Saque</Label>
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min={withdrawalSettings.minWithdrawal}
                            max={user.totalCommission || 0}
                            value={withdrawalForm.amount}
                            onChange={(e) => setWithdrawalForm(prev => ({...prev, amount: e.target.value}))}
                            placeholder="0.00"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
                          <Select 
                            value={withdrawalForm.pixKeyType} 
                            onValueChange={(value: "cpf" | "phone" | "email" | "random") => 
                              setWithdrawalForm(prev => ({...prev, pixKeyType: value}))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cpf">CPF</SelectItem>
                              <SelectItem value="phone">Telefone</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="random">Chave Aleatória</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="pixKey">Chave PIX</Label>
                          <Input
                            id="pixKey"
                            value={withdrawalForm.pixKey}
                            onChange={(e) => setWithdrawalForm(prev => ({...prev, pixKey: e.target.value}))}
                            placeholder="Digite sua chave PIX"
                            required
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button type="submit" disabled={submittingWithdrawal} className="flex-1">
                            {submittingWithdrawal ? "Processando..." : "Solicitar Saque"}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setWithdrawalDialogOpen(false)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <Share2 className="h-4 w-4" />
                    Seu Código de Afiliado
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-gray-50 rounded-lg font-mono text-lg">
                      {user.affiliateCode || (generatingCode ? "Gerando..." : "Clique para gerar")}
                    </div>
                    <button
                      onClick={user.affiliateCode ? copyAffiliateLink : ensureAffiliateCode}
                      disabled={generatingCode}
                      className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Copy className="h-4 w-4" />
                      {generatingCode 
                        ? "Gerando..." 
                        : user.affiliateCode 
                          ? (copied ? "Copiado!" : "Copiar Link")
                          : "Gerar Código"
                      }
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Como funciona?</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Compartilhe seu link de afiliado com amigos</li>
                    <li>• Quando alguém se cadastrar usando seu link, será contabilizado como indicado</li>
                    <li>• Você ganha comissão pelas atividades dos seus indicados</li>
                    <li>• Acompanhe suas estatísticas aqui no seu perfil</li>
                  </ul>
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
