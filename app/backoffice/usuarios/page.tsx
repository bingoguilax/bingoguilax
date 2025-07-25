"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, deleteDoc, doc, updateDoc, orderBy, query } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { User } from "@/lib/types"
import { Trash2, Edit, DollarSign } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function AdminUsersPage() {
  const { user: currentUser, loading } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [newBalance, setNewBalance] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && (!currentUser || currentUser.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [currentUser, loading, router])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"))
        const usersSnapshot = await getDocs(usersQuery)
        const usersData = usersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
        })) as User[]

        setUsers(usersData)
      } catch (error) {
        console.error("Error fetching users:", error)
      } finally {
        setLoadingUsers(false)
      }
    }

    if (currentUser?.role === "admin") {
      fetchUsers()
    }
  }, [currentUser])

  const handleDelete = async (userId: string) => {
    if (userId === currentUser?.id) {
      toast({
        title: "Ação inválida",
        description: "Você não pode deletar sua própria conta.",
        variant: "destructive",
      })
      return
    }

    if (confirm("Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.")) {
      try {
        await deleteDoc(doc(db, "users", userId))
        setUsers((prev) => prev.filter((u) => u.id !== userId))
        toast({
          title: "Usuário deletado",
          description: "O usuário foi removido com sucesso.",
        })
      } catch (error) {
        console.error("Error deleting user:", error)
        toast({
          title: "Erro",
          description: "Não foi possível deletar o usuário.",
          variant: "destructive",
        })
      }
    }
  }

  const handleEdit = (user: User) => {
    setSelectedUser(user)
    setNewBalance(user.balance.toString())
    setIsDialogOpen(true)
  }

  const handleUpdateBalance = async () => {
    if (!selectedUser) return

    try {
      const balanceValue = Number.parseFloat(newBalance)
      if (isNaN(balanceValue) || balanceValue < 0) {
        toast({
          title: "Valor inválido",
          description: "Por favor, insira um valor válido para o saldo.",
          variant: "destructive",
        })
        return
      }

      await updateDoc(doc(db, "users", selectedUser.id), {
        balance: balanceValue,
      })

      // Atualizar a lista local
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, balance: balanceValue } : u)))

      setIsDialogOpen(false)
      toast({
        title: "Saldo atualizado",
        description: `O saldo de ${selectedUser.name} foi atualizado com sucesso.`,
      })
    } catch (error) {
      console.error("Error updating user balance:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o saldo do usuário.",
        variant: "destructive",
      })
    }
  }

  const handlePromoteToAdmin = async (userId: string) => {
    if (confirm("Tem certeza que deseja promover este usuário a administrador?")) {
      try {
        await updateDoc(doc(db, "users", userId), {
          role: "admin",
        })

        // Atualizar a lista local
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: "admin" as const } : u)))

        toast({
          title: "Usuário promovido",
          description: "O usuário foi promovido a administrador com sucesso.",
        })
      } catch (error) {
        console.error("Error promoting user:", error)
        toast({
          title: "Erro",
          description: "Não foi possível promover o usuário.",
          variant: "destructive",
        })
      }
    }
  }

  if (loading || loadingUsers) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!currentUser || currentUser.role !== "admin") {
    return null
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Usuários</h1>
          <p className="text-muted-foreground">Gerencie todos os usuários do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
            <CardDescription>Total de {users.length} usuários registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.phone}</TableCell>
                        <TableCell>R$ {user.balance.toFixed(2)}</TableCell>
                        <TableCell>
                          {user.role === "admin" ? (
                            <Badge className="bg-purple-100 text-purple-800">Admin</Badge>
                          ) : (
                            <Badge variant="secondary">Usuário</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEdit(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {user.role !== "admin" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-purple-50 text-purple-600 hover:bg-purple-100 hover:text-purple-700"
                                onClick={() => handlePromoteToAdmin(user.id)}
                              >
                                Promover
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              disabled={user.id === currentUser.id}
                            >
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

        {/* Modal de Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Usuário</DialogTitle>
              <DialogDescription>Ajuste o saldo e veja as estatísticas do usuário.</DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <h3 className="font-medium">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-xs text-blue-600">Total Depositado</p>
                    <p className="text-lg font-semibold">R$ {selectedUser.totalDeposited?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-md">
                    <p className="text-xs text-purple-600">Total Sacado</p>
                    <p className="text-lg font-semibold">R$ {selectedUser.totalWithdrawn?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="balance">Saldo</Label>
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 text-muted-foreground" />
                    <Input
                      id="balance"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newBalance}
                      onChange={(e) => setNewBalance(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateBalance}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
