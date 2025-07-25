"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Deposit } from "@/lib/types"
import { Trash2 } from "lucide-react"

export default function AdminDepositsPage() {
  const { user, loading } = useAuth()
  const [deposits, setDeposits] = useState<Deposit[]>([])
  const [loadingDeposits, setLoadingDeposits] = useState(true)
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
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(deposit.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
