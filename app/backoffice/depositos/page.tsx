"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, deleteDoc, doc, orderBy, query, updateDoc, getDoc, increment } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Deposit } from "@/lib/types"
import { Trash2, CheckCircle } from "lucide-react"

export default function AdminDepositsPage() {
  const { user, loading } = useAuth()
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loadingDeposits, setLoadingDeposits] = useState(true)
  const [approvingDeposit, setApprovingDeposit] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDeposits = async () => {
      try {
        const depositsQuery = query(collection(db, "deposits"), orderBy("createdAt", "desc"))
        const depositsSnapshot = await getDocs(depositsQuery)
        const depositsData = depositsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Deposit[]

        setDeposits(depositsData)
      } catch (error) {
        console.error("Error fetching deposits:", error)
      } finally {
        setLoadingDeposits(false)
      }
    }

    if (user?.role === "admin") {
      fetchDeposits()
    }
  }, [user])

  const handleDelete = async (depositId: string) => {
    if (confirm("Tem certeza que deseja deletar este depósito?")) {
      try {
        await deleteDoc(doc(db, "deposits", depositId))
        setDeposits((prev) => prev.filter((d) => d.id !== depositId))
      } catch (error) {
        console.error("Error deleting deposit:", error)
      }
    }
  }

  const handleApprove = async (deposit: Deposit) => {
    if (deposit.status === "approved") return
    
    setApprovingDeposit(deposit.id)
    try {
      // Atualizar status do depósito
      await updateDoc(doc(db, "deposits", deposit.id), {
        status: "approved"
      })

      // Buscar dados do usuário
      const userDoc = await getDoc(doc(db, "users", deposit.userId))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        const currentBalance = userData.balance || 0
        const currentTotalDeposited = userData.totalDeposited || 0

        // Atualizar saldo e total depositado do usuário
        await updateDoc(doc(db, "users", deposit.userId), {
          balance: currentBalance + deposit.amount,
          totalDeposited: currentTotalDeposited + deposit.amount
        })

        // Calcular comissão se aplicável
        try {
          console.log('🚀 Aprovação Manual - Iniciando cálculo de comissão para:', {
            depositId: deposit.id,
            userId: deposit.userId,
            amount: deposit.amount
          })
          
          const commissionResponse = await fetch('/api/commissions/calculate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              depositId: deposit.id,
              userId: deposit.userId,
              amount: deposit.amount
            })
          })
          
          if (commissionResponse.ok) {
            const commissionData = await commissionResponse.json()
            console.log('✅ Aprovação Manual - Comissão calculada:', commissionData)
          } else {
            const errorData = await commissionResponse.json()
            console.log('❌ Aprovação Manual - Erro na API de comissão:', errorData)
          }
        } catch (commissionError) {
          console.error("💥 Aprovação Manual - Erro ao calcular comissão:", commissionError)
        }

        // Atualizar lista local
        setDeposits((prev) => 
          prev.map((d) => 
            d.id === deposit.id ? { ...d, status: "approved" } : d
          )
        )
      }
    } catch (error) {
      console.error("Error approving deposit:", error)
      alert("Erro ao aprovar depósito")
    } finally {
      setApprovingDeposit(null)
    }
  }

  if (loading || loadingDeposits) {
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
        return <Badge variant="destructive">Rejeitado</Badge>
      default:
        return <Badge variant="secondary">Pendente</Badge>
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Depósitos</h1>
          <p className="text-muted-foreground">Gerencie todos os depósitos do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Depósitos</CardTitle>
            <CardDescription>Total de {deposits.length} depósitos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum depósito encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell className="font-medium">{deposit.userName}</TableCell>
                        <TableCell>{formatDateTime(deposit.createdAt)}</TableCell>
                        <TableCell>R$ {deposit.amount.toFixed(2)}</TableCell>
                        <TableCell>{deposit.cpf}</TableCell>
                        <TableCell>{getStatusBadge(deposit.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {deposit.status === "pending" && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleApprove(deposit)}
                                disabled={approvingDeposit === deposit.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {approvingDeposit === deposit.id ? (
                                  "Aprovando..."
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Aprovar
                                  </>
                                )}
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(deposit.id)}>
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
