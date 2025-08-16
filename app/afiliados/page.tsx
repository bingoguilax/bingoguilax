"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserLayout } from "@/components/layout/user-layout"
import { useAuth } from "@/hooks/use-auth"
import { DollarSign, Users, Share2, Copy, CreditCard, Wallet, TrendingUp } from "lucide-react"
import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

interface Commission {
  id: string
  referredUserName: string
  depositAmount: number
  commissionAmount: number
  commissionRate: number
  createdAt: Date
  status: "pending" | "paid"
}

interface ReferredUser {
  id: string
  name: string
  email: string
  totalDeposited: number
  joinedAt: Date
}

export default function AffiliatePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([])
  const [loadingData, setLoadingData] = useState(false)
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
      loadAffiliateData()
      loadWithdrawalSettings()
    }
  }, [user])

  const loadAffiliateData = async () => {
    if (!user) return
    
    setLoadingData(true)
    try {
      console.log("🔍 Carregando dados de afiliado para:", user.id)
      console.log("🔍 Usuários referidos no perfil:", user.referredUsers)
      
      // Carregar comissões com tratamento de erro
      let commissionsData: Commission[] = []
      try {
        const commissionsQuery = query(
          collection(db, "commissions"),
          where("affiliateId", "==", user.id),
          orderBy("createdAt", "desc")
        )
        const commissionsSnapshot = await getDocs(commissionsQuery)
        commissionsData = commissionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate()
        })) as Commission[]
        console.log("💰 Comissões carregadas:", commissionsData.length)
      } catch (commissionsError) {
        console.warn("⚠️ Erro ao carregar comissões (coleção pode não existir):", commissionsError)
        // Continuar sem comissões se a coleção não existir ou não tiver permissão
      }
      setCommissions(commissionsData)

      // Método 1: Carregar usuários através da lista referredUsers
      let usersData: ReferredUser[] = []
      if (user.referredUsers && user.referredUsers.length > 0) {
        console.log("👥 Carregando usuários da lista referredUsers...")
        for (const userId of user.referredUsers) {
          try {
            const userDoc = await getDoc(doc(db, "users", userId))
            if (userDoc.exists()) {
              const userData = userDoc.data()
              usersData.push({
                id: userId,
                name: userData.name || "Usuário",
                email: userData.email || "",
                totalDeposited: userData.totalDeposited || 0,
                joinedAt: userData.createdAt?.toDate() || new Date()
              })
            }
          } catch (error) {
            console.error("Erro ao carregar usuário referido:", error)
          }
        }
      }

      // Método 2: Buscar usuários que têm este afiliado como referenciador
      console.log("🔍 Buscando usuários que foram referidos por:", user.affiliateCode)
      if (user.affiliateCode) {
        try {
          const referredQuery = query(
            collection(db, "users"),
            where("referredBy", "==", user.affiliateCode)
          )
          const referredSnapshot = await getDocs(referredQuery)
          console.log("👥 Usuários encontrados pelo código:", referredSnapshot.size)
          
          referredSnapshot.docs.forEach(doc => {
            const userData = doc.data()
            // Verificar se já não está na lista para evitar duplicatas
            const exists = usersData.find(u => u.id === doc.id)
            if (!exists) {
              usersData.push({
                id: doc.id,
                name: userData.name || "Usuário",
                email: userData.email || "",
                totalDeposited: userData.totalDeposited || 0,
                joinedAt: userData.createdAt?.toDate() || new Date()
              })
            }
          })
        } catch (error) {
          console.error("Erro ao buscar usuários referidos:", error)
        }
      }

      // Ordenar por data de cadastro mais recente
      usersData.sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
      
      console.log("👥 Total de usuários referidos encontrados:", usersData.length)
      setReferredUsers(usersData)
    } catch (error) {
      console.error("Erro ao carregar dados de afiliado:", error)
    } finally {
      setLoadingData(false)
    }
  }

  const generateAffiliateCode = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
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
      toast({
        title: "Erro",
        description: "Não foi possível gerar seu código de afiliado.",
        variant: "destructive"
      })
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
      toast({
        title: "Link copiado!",
        description: "Seu link de afiliado foi copiado para a área de transferência."
      })
    } catch (error) {
      console.error("Erro ao copiar link:", error)
      toast({
        title: "Erro",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
      })
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

    const amount = parseFloat(withdrawalForm.amount)
    const availableCommission = user.totalCommission || 0

    if (amount < withdrawalSettings.minWithdrawal) {
      toast({
        title: "Valor mínimo",
        description: `O valor mínimo para saque é R$ ${withdrawalSettings.minWithdrawal.toFixed(2)}.`,
        variant: "destructive"
      })
      return
    }

    if (amount > availableCommission) {
      toast({
        title: "Saldo insuficiente",
        description: "Você não tem comissão suficiente para este saque.",
        variant: "destructive"
      })
      return
    }

    setSubmittingWithdrawal(true)
    try {
      const response = await fetch("/api/affiliate-withdrawals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          affiliateId: user.id,
          amount,
          pixKeyType: withdrawalForm.pixKeyType,
          pixKey: withdrawalForm.pixKey
        })
      })

      if (response.ok) {
        toast({
          title: "Saque solicitado!",
          description: "Sua solicitação de saque foi enviada para análise."
        })
        setWithdrawalDialogOpen(false)
        setWithdrawalForm({ amount: "", pixKeyType: "cpf", pixKey: "" })
        // Recarregar dados
        window.location.reload()
      } else {
        throw new Error("Erro na API")
      }
    } catch (error) {
      console.error("Erro ao solicitar saque:", error)
      toast({
        title: "Erro",
        description: "Não foi possível processar sua solicitação.",
        variant: "destructive"
      })
    } finally {
      setSubmittingWithdrawal(false)
    }
  }

  if (loading || loadingData) {
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

  const totalCommissions = commissions.reduce((total, commission) => total + commission.commissionAmount, 0)
  const pendingCommissions = commissions.filter(c => c.status === "pending").reduce((total, commission) => total + commission.commissionAmount, 0)
  const paidCommissions = commissions.filter(c => c.status === "paid").reduce((total, commission) => total + commission.commissionAmount, 0)

  return (
    <UserLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Programa de Afiliados</h1>
            <p className="text-muted-foreground">Ganhe comissões indicando novos usuários</p>
          </div>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão Disponível</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                R$ {(user.totalCommission || 0).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Disponível para saque
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Comissões</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {totalCommissions.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Total ganho até hoje
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Usuários Referidos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {referredUsers.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Pessoas que você indicou
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                R$ {pendingCommissions.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">
                Aguardando processamento
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Seção de Link de Afiliado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Seu Link de Afiliado
              </CardTitle>
              <CardDescription>
                Compartilhe este link para ganhar comissões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user.affiliateCode ? (
                <>
                  <div className="space-y-2">
                    <Label>Seu Código</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={user.affiliateCode} 
                        readOnly 
                        className="font-mono"
                      />
                      <Badge variant="secondary">Ativo</Badge>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Link de Indicação</Label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/registro?ref=${user.affiliateCode}`}
                        readOnly 
                        className="text-sm"
                      />
                      <Button 
                        onClick={copyAffiliateLink}
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        {copied ? "Copiado!" : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground mb-4">
                    Você ainda não possui um código de afiliado
                  </p>
                  <Button 
                    onClick={ensureAffiliateCode}
                    disabled={generatingCode}
                  >
                    {generatingCode ? "Gerando..." : "Gerar Código de Afiliado"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Seção de Saque de Comissões */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Saque de Comissões
              </CardTitle>
              <CardDescription>
                Solicite o saque das suas comissões
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex justify-between text-sm mb-2">
                  <span>Saldo disponível:</span>
                  <span className="font-medium">R$ {(user.totalCommission || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Valor mínimo:</span>
                  <span>R$ {withdrawalSettings.minWithdrawal.toFixed(2)}</span>
                </div>
              </div>

              <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    className="w-full" 
                    disabled={(user.totalCommission || 0) < withdrawalSettings.minWithdrawal}
                  >
                    Solicitar Saque
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Solicitar Saque de Comissão</DialogTitle>
                    <DialogDescription>
                      Preencha os dados para solicitar o saque das suas comissões.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="amount">Valor (R$)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min={withdrawalSettings.minWithdrawal}
                        max={user.totalCommission || 0}
                        value={withdrawalForm.amount}
                        onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                        placeholder="Digite o valor"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
                      <Select
                        value={withdrawalForm.pixKeyType}
                        onValueChange={(value: "cpf" | "phone" | "email" | "random") => 
                          setWithdrawalForm(prev => ({ ...prev, pixKeyType: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpf">CPF</SelectItem>
                          <SelectItem value="phone">Telefone</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="random">Chave Aleatória</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pixKey">Chave PIX</Label>
                      <Input
                        id="pixKey"
                        value={withdrawalForm.pixKey}
                        onChange={(e) => setWithdrawalForm(prev => ({ ...prev, pixKey: e.target.value }))}
                        placeholder="Digite sua chave PIX"
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setWithdrawalDialogOpen(false)}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={submittingWithdrawal}
                        className="flex-1"
                      >
                        {submittingWithdrawal ? "Processando..." : "Solicitar"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de Comissões */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Comissões</CardTitle>
            <CardDescription>
              Suas comissões recebidas por indicações
            </CardDescription>
          </CardHeader>
          <CardContent>
            {commissions.length > 0 ? (
              <div className="space-y-4">
                {commissions.map((commission) => (
                  <div key={commission.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{commission.referredUserName}</p>
                      <p className="text-sm text-muted-foreground">
                        Depósito de R$ {commission.depositAmount.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {commission.createdAt.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-green-600">
                        +R$ {commission.commissionAmount.toFixed(2)}
                      </p>
                      <Badge variant={commission.status === "paid" ? "default" : "secondary"}>
                        {commission.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma comissão recebida ainda</p>
                <p className="text-sm">Comece indicando amigos com seu link de afiliado!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usuários Referidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Usuários Referidos</CardTitle>
              <CardDescription>
                Pessoas que se cadastraram através do seu link
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadAffiliateData}
              disabled={loadingData}
            >
              {loadingData ? "Carregando..." : "Atualizar"}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingData ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-muted-foreground">Carregando usuários referidos...</p>
              </div>
            ) : referredUsers.length > 0 ? (
              <div className="space-y-4">
                {referredUsers.map((referredUser) => (
                  <div key={referredUser.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{referredUser.name}</p>
                      <p className="text-sm text-muted-foreground">{referredUser.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrou-se em {referredUser.joinedAt.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        R$ {referredUser.totalDeposited.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total depositado</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Share2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">Nenhum usuário referido ainda</p>
                <p className="text-sm mb-4">Compartilhe seu link de afiliado para começar!</p>
                {user?.affiliateCode ? (
                  <div className="bg-blue-50 p-4 rounded-lg text-blue-700 text-sm">
                    <p className="font-medium">💡 Dica:</p>
                    <p>Seu código: <span className="font-mono font-bold">{user.affiliateCode}</span></p>
                    <p>Compartilhe o link da seção acima para ganhar comissões!</p>
                  </div>
                ) : (
                  <div className="bg-yellow-50 p-4 rounded-lg text-yellow-700 text-sm">
                    <p>Gere seu código de afiliado na seção acima para começar a indicar usuários.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
