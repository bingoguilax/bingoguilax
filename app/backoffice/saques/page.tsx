"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, deleteDoc, doc, updateDoc, orderBy, query } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Withdrawal } from "@/lib/types"
import { Trash2, CheckCircle, XCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AdminWithdrawalsPage() {
  const { user, loading } = useAuth()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(true)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchWithdrawals = async () => {
      try {
        const withdrawalsQuery = query(collection(db, "withdrawals"), orderBy("createdAt", "desc"))
        const withdrawalsSnapshot = await getDocs(withdrawalsQuery)
        const withdrawalsData = withdrawalsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Withdrawal[]

        setWithdrawals(withdrawalsData)
      } catch (error) {
        console.error("Error fetching withdrawals:", error)
      } finally {
        setLoadingWithdrawals(false)
      }
    }

    if (user?.role === "admin") {
      fetchWithdrawals()
    }
  }, [user])

  const handleDelete = async (withdrawalId: string) => {
    if (confirm("Tem certeza que deseja deletar este saque?")) {
      try {
        await deleteDoc(doc(db, "withdrawals", withdrawalId))
        setWithdrawals((prev) => prev.filter((w) => w.id !== withdrawalId))
        toast({
          title: "Saque deletado",
          description: "O saque foi removido com sucesso.",
        })
      } catch (error) {
        console.error("Error deleting withdrawal:", error)
        toast({
          title: "Erro",
          description: "Não foi possível deletar o saque.",
          variant: "destructive",
        })
      }
    }
  }

  const handleApprove = async (withdrawal: Withdrawal) => {
    if (withdrawal.status !== "pending") {
      toast({
        title: "Ação inválida",
        description: "Este saque já foi processado.",
        variant: "destructive",
      })
      return
    }

    if (confirm(`Tem certeza que deseja aprovar o saque de R$ ${withdrawal.amount.toFixed(2)}?`)) {
      try {
        await updateDoc(doc(db, "withdrawals", withdrawal.id), {
          status: "approved",
        })

        // Atualizar a lista local
        setWithdrawals((prev) => prev.map((w) => (w.id === withdrawal.id ? { ...w, status: "approved" as const } : w)))

        toast({
          title: "Saque aprovado",
          description: "O saque foi aprovado com sucesso.",
        })
      } catch (error) {
        console.error("Error approving withdrawal:", error)
        toast({
          title: "Erro",
          description: "Não foi possível aprovar o saque.",
          variant: "destructive",
        })
      }
    }
  }

  const handleReject = async (withdrawal: Withdrawal) => {
    if (withdrawal.status !== "pending") {
      toast({
        title: "Ação inválida",
        description: "Este saque já foi processado.",
        variant: "destructive",
      })
      return
    }

    if (confirm(`Tem certeza que deseja recusar o saque de R$ ${withdrawal.amount.toFixed(2)}?`)) {
      try {
        await updateDoc(doc(db, "withdrawals", withdrawal.id), {
          status: "rejected",
        })

        // Atualizar a lista local
        setWithdrawals((prev) => prev.map((w) => (w.id === withdrawal.id ? { ...w, status: "rejected" as const } : w)))

        toast({
          title: "Saque recusado",
          description: "O saque foi recusado com sucesso.",
        })
      } catch (error) {
        console.error("Error rejecting withdrawal:", error)
        toast({
          title: "Erro",
          description: "Não foi possível recusar o saque.",
          variant: "destructive",
        })
      }
    }
  }

  if (loading || loadingWithdrawals) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user || user.role !== "admin") {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Aprovado</Badge>
      case "rejected":
        return <Badge variant="destructive">Recusado</Badge>
      default:
        return <Badge variant="secondary">Pendente</Badge>
    }
  }

  const getPixKeyTypeLabel = (type: string) => {
    switch (type) {
      case "cpf":
        return "CPF"
      case "phone":
        return "Telefone"
      case "email":
        return "Email"
      case "random":
        return "Chave Aleatória"
      default:
        return type
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Saques</h1>
          <p className="text-muted-foreground">Gerencie todos os saques do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Saques</CardTitle>
            <CardDescription>Total de {withdrawals.length} saques registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {withdrawals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum saque encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Tipo de Chave</TableHead>
                      <TableHead>Chave PIX</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id}>
                        <TableCell className="font-medium">{withdrawal.userName}</TableCell>
                        <TableCell>{formatDateTime(withdrawal.createdAt)}</TableCell>
                        <TableCell>R$ {withdrawal.amount.toFixed(2)}</TableCell>
                        <TableCell>{getPixKeyTypeLabel(withdrawal.pixKeyType)}</TableCell>
                        <TableCell>
                          <span className="max-w-[150px] truncate block">{withdrawal.pixKey}</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(withdrawal.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {withdrawal.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700"
                                  onClick={() => handleApprove(withdrawal)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700"
                                  onClick={() => handleReject(withdrawal)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(withdrawal.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}
