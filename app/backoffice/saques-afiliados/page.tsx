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
import { collection, getDocs, query, orderBy, doc, updateDoc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { AffiliateWithdrawal, AffiliateSettings } from "@/lib/types"
import { CheckCircle, X, Settings, DollarSign, Clock, TrendingUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AffiliateWithdrawalsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  const [withdrawals, setWithdrawals] = useState<AffiliateWithdrawal[]>([])
  const [settings, setSettings] = useState<AffiliateSettings | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [processingWithdrawal, setProcessingWithdrawal] = useState<string | null>(null)
  
  // Estados para configurações
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)
  const [settingsForm, setSettingsForm] = useState({
    minWithdrawal: 10,
    dailyWithdrawalLimit: 1
  })

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
        loadWithdrawals(),
        loadSettings()
      ])
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
      toast({
        title: "Erro",
        description: "Erro ao carregar dados",
        variant: "destructive"
      })
    } finally {
      setLoadingData(false)
    }
  }

  const loadWithdrawals = async () => {
    try {
      console.log("📋 Carregando saques via API...")
      const response = await fetch('/api/affiliate-withdrawals/list')
      
      if (response.ok) {
        const data = await response.json()
        console.log("📋 Resposta da API:", data)
        
        if (data.success && data.withdrawals) {
          // Converter strings de data de volta para Date objects
          const withdrawalsData = data.withdrawals.map((withdrawal: any) => ({
            ...withdrawal,
            createdAt: new Date(withdrawal.createdAt),
            approvedAt: withdrawal.approvedAt ? new Date(withdrawal.approvedAt) : undefined,
            rejectedAt: withdrawal.rejectedAt ? new Date(withdrawal.rejectedAt) : undefined
          }))
          
          console.log("📋 Saques processados:", withdrawalsData)
          setWithdrawals(withdrawalsData)
        } else {
          console.log("❌ Formato de resposta inválido")
          setWithdrawals([])
        }
      } else {
        const error = await response.json()
        console.error("❌ Erro na API:", error)
        toast({
          title: "Erro",
          description: "Erro ao carregar saques de afiliados",
          variant: "destructive"
        })
        setWithdrawals([])
      }
    } catch (error) {
      console.error("❌ Erro ao carregar saques:", error)
      toast({
        title: "Erro",
        description: "Erro ao carregar saques de afiliados",
        variant: "destructive"
      })
      setWithdrawals([])
    }
  }

  const loadSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "affiliate"))
      if (settingsDoc.exists()) {
        const settingsData = { id: settingsDoc.id, ...settingsDoc.data() } as AffiliateSettings
        setSettings(settingsData)
        setSettingsForm({
          minWithdrawal: settingsData.minWithdrawal || 10,
          dailyWithdrawalLimit: settingsData.dailyWithdrawalLimit || 1
        })
      } else {
        // Criar configurações padrão
        const defaultSettings: Omit<AffiliateSettings, 'id'> = {
          globalCommissionRate: 5,
          isActive: true,
          minWithdrawal: 10,
          dailyWithdrawalLimit: 1,
          lastUpdated: new Date(),
          updatedBy: user?.id || ""
        }
        await setDoc(doc(db, "settings", "affiliate"), defaultSettings)
        setSettings({ id: "affiliate", ...defaultSettings })
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error)
    }
  }

  const updateSettings = async () => {
    if (!user) return
    
    try {
      await updateDoc(doc(db, "settings", "affiliate"), {
        minWithdrawal: settingsForm.minWithdrawal,
        dailyWithdrawalLimit: settingsForm.dailyWithdrawalLimit,
        lastUpdated: new Date(),
        updatedBy: user.id
      })
      
      await loadSettings()
      setSettingsDialogOpen(false)
      toast({
        title: "Sucesso",
        description: "Configurações atualizadas com sucesso"
      })
    } catch (error) {
      console.error("Erro ao atualizar configurações:", error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar configurações",
        variant: "destructive"
      })
    }
  }

  const processWithdrawal = async (withdrawalId: string, action: "approve" | "reject", reason?: string) => {
    if (!user) return
    
    setProcessingWithdrawal(withdrawalId)
    try {
      const response = await fetch('/api/affiliate-withdrawals/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          withdrawalId,
          action,
          adminId: user.id,
          reason
        })
      })
      
      if (response.ok) {
        toast({
          title: "Sucesso",
          description: `Saque ${action === "approve" ? "aprovado" : "rejeitado"} com sucesso`
        })
        await loadWithdrawals()
      } else {
        const error = await response.json()
        toast({
          title: "Erro",
          description: error.error || "Erro ao processar saque",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Erro ao processar saque:", error)
      toast({
        title: "Erro",
        description: "Erro ao processar saque",
        variant: "destructive"
      })
    } finally {
      setProcessingWithdrawal(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Aprovado</Badge>
      case "rejected":
        return <Badge variant="destructive">Rejeitado</Badge>
      default:
        return <Badge variant="secondary">Pendente</Badge>
    }
  }

  const getPixKeyTypeLabel = (type: string) => {
    switch (type) {
      case "cpf": return "CPF"
      case "phone": return "Telefone"
      case "email": return "Email"
      case "random": return "Chave Aleatória"
      default: return type
    }
  }

  if (loading || loadingData) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || user.role !== "admin") {
    return null
  }

  const totalPending = withdrawals.filter(w => w.status === "pending").reduce((sum, w) => sum + w.amount, 0)
  const totalApproved = withdrawals.filter(w => w.status === "approved").reduce((sum, w) => sum + w.amount, 0)

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Saques de Afiliados</h1>
            <p className="text-gray-600">Gerencie solicitações de saque de comissões</p>
          </div>
          
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Settings className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurações de Saque</DialogTitle>
                <DialogDescription>
                  Configure os limites e regras para saques de afiliados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="minWithdrawal">Valor Mínimo para Saque (R$)</Label>
                  <Input
                    id="minWithdrawal"
                    type="number"
                    step="0.01"
                    min="0"
                    value={settingsForm.minWithdrawal}
                    onChange={(e) => setSettingsForm(prev => ({
                      ...prev, 
                      minWithdrawal: parseFloat(e.target.value) || 0
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dailyLimit">Limite de Saques por Dia</Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    min="1"
                    value={settingsForm.dailyWithdrawalLimit}
                    onChange={(e) => setSettingsForm(prev => ({
                      ...prev, 
                      dailyWithdrawalLimit: parseInt(e.target.value) || 1
                    }))}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={updateSettings}>
                    Salvar
                  </Button>
                  <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Estatísticas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Solicitações</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{withdrawals.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalPending.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Aprovado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalApproved.toFixed(2)}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Mínimo</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {settings?.minWithdrawal?.toFixed(2) || "10.00"}</div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Saques */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitações de Saque</CardTitle>
            <CardDescription>
              Lista de todas as solicitações de saque de comissões
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Chave PIX</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell className="font-medium">{withdrawal.affiliateName}</TableCell>
                    <TableCell>R$ {withdrawal.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm">{getPixKeyTypeLabel(withdrawal.pixKeyType)}</div>
                        <div className="text-xs text-gray-500">{withdrawal.pixKey}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {withdrawal.createdAt.toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                    <TableCell>
                      {withdrawal.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => processWithdrawal(withdrawal.id, "approve")}
                            disabled={processingWithdrawal === withdrawal.id}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => processWithdrawal(withdrawal.id, "reject", "Rejeitado pelo admin")}
                            disabled={processingWithdrawal === withdrawal.id}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
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
