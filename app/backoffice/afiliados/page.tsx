"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { collection, getDocs, query, where, doc, updateDoc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { User, AffiliateSettings, CommissionTransaction } from "@/lib/types"
import { Users, Settings, DollarSign, TrendingUp, Edit, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AffiliatesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [affiliates, setAffiliates] = useState<User[]>([])
  const [affiliateSettings, setAffiliateSettings] = useState<AffiliateSettings | null>(null)
  const [commissionTransactions, setCommissionTransactions] = useState<CommissionTransaction[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [globalCommissionRate, setGlobalCommissionRate] = useState(5)
  const [selectedAffiliate, setSelectedAffiliate] = useState<User | null>(null)
  const [customCommissionRate, setCustomCommissionRate] = useState("")

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user?.role === "admin") {
      loadData()
    }
  }, [user])

  const loadData = async () => {
    setLoadingData(true)
    try {
      await Promise.all([
        loadAffiliates(),
        loadAffiliateSettings(),
        loadCommissionTransactions()
      ])
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast({
        title: "Erro",
        description: "Erro ao carregar dados dos afiliados",
        variant: "destructive"
      })
    } finally {
      setLoadingData(false)
    }
  }

  const loadAffiliates = async () => {
    const usersQuery = query(
      collection(db, "users"),
      where("isActiveAffiliate", "==", true)
    )
    const querySnapshot = await getDocs(usersQuery)
    
    const affiliatesData: User[] = []
    querySnapshot.forEach((doc) => {
      const userData = doc.data() as User
      // Só incluir se tem código de afiliado E está marcado como afiliado ativo
      if (userData.affiliateCode && userData.isActiveAffiliate) {
        affiliatesData.push({ id: doc.id, ...userData })
      }
    })
    
    setAffiliates(affiliatesData)
  }

  const loadAffiliateSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "affiliate"))
      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        const settings: AffiliateSettings = {
          id: settingsDoc.id,
          ...data,
          lastUpdated: data.lastUpdated?.toDate ? data.lastUpdated.toDate() : new Date(data.lastUpdated || Date.now())
        } as AffiliateSettings
        setAffiliateSettings(settings)
        setGlobalCommissionRate(settings.globalCommissionRate || 5)
      } else {
        // Criar configurações padrão
        const defaultSettings: Omit<AffiliateSettings, 'id'> = {
          globalCommissionRate: 5,
          minWithdrawal: 50,
          dailyWithdrawalLimit: 1,
          isActive: true,
          lastUpdated: new Date(),
          updatedBy: user?.id || ""
        }
        await setDoc(doc(db, "settings", "affiliate"), defaultSettings)
        setAffiliateSettings({ id: "affiliate", ...defaultSettings })
        setGlobalCommissionRate(5)
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error)
    }
  }

  const loadCommissionTransactions = async () => {
    const transactionsSnapshot = await getDocs(collection(db, "commissionTransactions"))
    const transactions: CommissionTransaction[] = []
    
    transactionsSnapshot.forEach((doc) => {
      const data = doc.data()
      const transaction: CommissionTransaction = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : (data.paidAt ? new Date(data.paidAt) : undefined)
      } as CommissionTransaction
      transactions.push(transaction)
    })
    
    setCommissionTransactions(transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
  }

  const updateGlobalCommissionRate = async () => {
    if (!user) return
    
    try {
      await updateDoc(doc(db, "settings", "affiliate"), {
        globalCommissionRate,
        lastUpdated: new Date(),
        updatedBy: user.id
      })
      
      await loadAffiliateSettings()
      toast({
        title: "Sucesso",
        description: "Comissão global atualizada com sucesso"
      })
    } catch (error) {
      console.error("Erro ao atualizar comissão global:", error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar comissão global",
        variant: "destructive"
      })
    }
  }

  const updateAffiliateCommission = async () => {
    if (!selectedAffiliate) return
    
    try {
      const newRate = customCommissionRate ? parseFloat(customCommissionRate) : null
      
      await updateDoc(doc(db, "users", selectedAffiliate.id), {
        customCommissionRate: newRate
      })
      
      await loadAffiliates()
      setSelectedAffiliate(null)
      setCustomCommissionRate("")
      
      toast({
        title: "Sucesso",
        description: "Comissão do afiliado atualizada com sucesso"
      })
    } catch (error) {
      console.error("Erro ao atualizar comissão do afiliado:", error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar comissão do afiliado",
        variant: "destructive"
      })
    }
  }

  const getEffectiveCommissionRate = (affiliate: User) => {
    return affiliate.customCommissionRate ?? affiliateSettings?.globalCommissionRate ?? 5
  }

  const getTotalCommissionsPaid = (affiliateId: string) => {
    return commissionTransactions
      .filter(t => t.affiliateId === affiliateId && t.status === "paid")
      .reduce((sum, t) => sum + t.commissionAmount, 0)
  }

  const getTotalCommissionsPending = (affiliateId: string) => {
    return commissionTransactions
      .filter(t => t.affiliateId === affiliateId && t.status === "pending")
      .reduce((sum, t) => sum + t.commissionAmount, 0)
  }

  const payCommission = async (transactionId: string) => {
    if (!user) return
    
    try {
      const response = await fetch('/api/commissions/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transactionId,
          adminId: user.id
        })
      })
      
      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Comissão paga com sucesso"
        })
        await loadCommissionTransactions()
      } else {
        const error = await response.json()
        toast({
          title: "Erro",
          description: error.error || "Erro ao pagar comissão",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Erro ao pagar comissão:", error)
      toast({
        title: "Erro",
        description: "Erro ao pagar comissão",
        variant: "destructive"
      })
    }
  }

  if (loading || loadingData) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || user.role !== "admin") {
    return null
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Afiliados</h1>
            <p className="text-gray-600">Gerencie afiliados e configurações de comissão</p>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Afiliados</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{affiliates.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão Global</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{affiliateSettings?.globalCommissionRate || 0}%</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pagas</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {commissionTransactions
                  .filter(t => t.status === "paid")
                  .reduce((sum, t) => sum + t.commissionAmount, 0)
                  .toFixed(2)}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {commissionTransactions
                  .filter(t => t.status === "pending")
                  .reduce((sum, t) => sum + t.commissionAmount, 0)
                  .toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configurações Globais */}
        <Card>
          <CardHeader>
            <CardTitle>Configurações de Comissão</CardTitle>
            <CardDescription>
              Configure a taxa de comissão padrão para todos os afiliados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="globalRate">Taxa de Comissão Global (%)</Label>
                <Input
                  id="globalRate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={globalCommissionRate}
                  onChange={(e) => setGlobalCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-32"
                />
              </div>
              <Button onClick={updateGlobalCommissionRate}>
                Atualizar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Afiliados */}
        <Card>
          <CardHeader>
            <CardTitle>Afiliados Cadastrados</CardTitle>
            <CardDescription>
              Lista de todos os usuários com códigos de afiliado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Indicados</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Total Pago</TableHead>
                  <TableHead>Pendente</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {affiliates.map((affiliate) => (
                  <TableRow key={affiliate.id}>
                    <TableCell className="font-medium">{affiliate.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{affiliate.affiliateCode}</Badge>
                    </TableCell>
                    <TableCell>{affiliate.referredUsers?.length || 0}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getEffectiveCommissionRate(affiliate)}%
                        {affiliate.customCommissionRate && (
                          <Badge variant="outline" className="text-xs">
                            Custom
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>R$ {getTotalCommissionsPaid(affiliate.id).toFixed(2)}</TableCell>
                    <TableCell>R$ {getTotalCommissionsPending(affiliate.id).toFixed(2)}</TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAffiliate(affiliate)
                              setCustomCommissionRate(affiliate.customCommissionRate?.toString() || "")
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Comissão - {affiliate.name}</DialogTitle>
                            <DialogDescription>
                              Configure uma taxa de comissão personalizada para este afiliado.
                              Deixe vazio para usar a taxa global.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="customRate">Taxa de Comissão Personalizada (%)</Label>
                              <Input
                                id="customRate"
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={customCommissionRate}
                                onChange={(e) => setCustomCommissionRate(e.target.value)}
                                placeholder={`Padrão: ${affiliateSettings?.globalCommissionRate || 5}%`}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={updateAffiliateCommission}>
                                Salvar
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setSelectedAffiliate(null)
                                  setCustomCommissionRate("")
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Histórico de Comissões */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Comissões</CardTitle>
            <CardDescription>
              Últimas transações de comissão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Usuário Indicado</TableHead>
                  <TableHead>Depósito</TableHead>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissionTransactions.slice(0, 10).map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      {transaction.createdAt.toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{transaction.affiliateName}</TableCell>
                    <TableCell>{transaction.referredUserName}</TableCell>
                    <TableCell>R$ {transaction.depositAmount.toFixed(2)}</TableCell>
                    <TableCell>{transaction.commissionRate}%</TableCell>
                    <TableCell>R$ {transaction.commissionAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.status === "paid" ? "default" : "secondary"}>
                        {transaction.status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {transaction.status === "pending" && (
                        <Button
                          size="sm"
                          onClick={() => payCommission(transaction.id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
