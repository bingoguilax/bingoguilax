"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, deleteDoc, doc, updateDoc, addDoc, orderBy, query } from "firebase/firestore"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AdminLayout } from "@/components/layout/admin-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import type { Draw } from "@/lib/types"
import { Trash2, Edit, Plus, Trophy, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface DrawFormData {
  name: string
  dateTime: string
  cardPrice: string
  type: "fixed" | "accumulated"
  mode: "manual" | "automatic"
  prizes: {
    quadra: string
    quina: string
    cheia: string
  }
  percentages: {
    quadraPercent: string
    quinaPercent: string
    cheiaPercent: string
  }
}

export default function AdminDrawsPage() {
  const { user, loading } = useAuth()
  const [draws, setDraws] = useState<Draw[]>([])
  const [loadingDraws, setLoadingDraws] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedDrawId, setSelectedDrawId] = useState<string | null>(null)
  const [formData, setFormData] = useState<DrawFormData>({
    name: "",
    dateTime: "",
    cardPrice: "",
    type: "fixed",
    mode: "automatic",
    prizes: {
      quadra: "",
      quina: "",
      cheia: "",
    },
    percentages: {
      quadraPercent: "10",
      quinaPercent: "30",
      cheiaPercent: "60",
    },
  })
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/backoffice/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchDraws = async () => {
      try {
        const drawsQuery = query(collection(db, "draws"), orderBy("dateTime", "desc"))
        const drawsSnapshot = await getDocs(drawsQuery)
        const drawsData = drawsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          dateTime: doc.data().dateTime.toDate(),
          createdAt: doc.data().createdAt.toDate(),
        })) as Draw[]

        setDraws(drawsData)
      } catch (error) {
        console.error("Error fetching draws:", error)
      } finally {
        setLoadingDraws(false)
      }
    }

    if (user?.role === "admin") {
      fetchDraws()
    }
  }, [user])

  const handleDelete = async (drawId: string) => {
    if (confirm("Tem certeza que deseja deletar este sorteio? Esta ação não pode ser desfeita.")) {
      try {
        await deleteDoc(doc(db, "draws", drawId))
        setDraws((prev) => prev.filter((d) => d.id !== drawId))
        toast({
          title: "Sorteio deletado",
          description: "O sorteio foi removido com sucesso.",
        })
      } catch (error) {
        console.error("Error deleting draw:", error)
        toast({
          title: "Erro",
          description: "Não foi possível deletar o sorteio.",
          variant: "destructive",
        })
      }
    }
  }

  const handleCreateDraw = () => {
    setIsEditing(false)
    setSelectedDrawId(null)
    setFormData({
      name: "",
      dateTime: new Date(Date.now() + 86400000).toISOString().slice(0, 16), // Amanhã
      cardPrice: "10",
      type: "fixed",
      mode: "automatic",
      prizes: {
        quadra: "100",
        quina: "300",
        cheia: "1000",
      },
      percentages: {
        quadraPercent: "10",
        quinaPercent: "30",
        cheiaPercent: "60",
      },
    })
    setIsDialogOpen(true)
  }

  const handleEditDraw = (draw: Draw) => {
    console.log("Editing draw:", draw)
    setIsEditing(true)
    setSelectedDrawId(draw.id)

    // Formatar data para o formato esperado pelo input datetime-local
    const dateTimeStr = new Date(draw.dateTime.getTime() - draw.dateTime.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16)

    if (draw.type === "fixed") {
      const prizes = draw.prizes as { quadra: number; quina: number; cheia: number }
      setFormData({
        name: draw.name,
        dateTime: dateTimeStr,
        cardPrice: draw.cardPrice.toString(),
        type: draw.type,
        mode: draw.mode,
        prizes: {
          quadra: prizes.quadra.toString(),
          quina: prizes.quina.toString(),
          cheia: prizes.cheia.toString(),
        },
        percentages: {
          quadraPercent: "10",
          quinaPercent: "30",
          cheiaPercent: "60",
        },
      })
    } else {
      const percentages = draw.prizes as { quadraPercent: number; quinaPercent: number; cheiaPercent: number }
      setFormData({
        name: draw.name,
        dateTime: dateTimeStr,
        cardPrice: draw.cardPrice.toString(),
        type: draw.type,
        mode: draw.mode,
        prizes: {
          quadra: "100",
          quina: "300",
          cheia: "1000",
        },
        percentages: {
          quadraPercent: percentages.quadraPercent.toString(),
          quinaPercent: percentages.quinaPercent.toString(),
          cheiaPercent: percentages.cheiaPercent.toString(),
        },
      })
    }

    setIsDialogOpen(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    if (name.includes(".")) {
      const [parent, child] = name.split(".")
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof typeof prev],
          [child]: value,
        },
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async () => {
    try {
      const dateTime = new Date(formData.dateTime)
      const cardPrice = Number.parseFloat(formData.cardPrice)

      if (isNaN(cardPrice) || cardPrice <= 0) {
        toast({
          title: "Valor inválido",
          description: "O valor da cartela deve ser maior que zero.",
          variant: "destructive",
        })
        return
      }

      let prizes: any
      if (formData.type === "fixed") {
        const quadra = Number.parseFloat(formData.prizes.quadra)
        const quina = Number.parseFloat(formData.prizes.quina)
        const cheia = Number.parseFloat(formData.prizes.cheia)

        if (isNaN(quadra) || isNaN(quina) || isNaN(cheia) || quadra <= 0 || quina <= 0 || cheia <= 0) {
          toast({
            title: "Valores inválidos",
            description: "Os valores dos prêmios devem ser maiores que zero.",
            variant: "destructive",
          })
          return
        }

        prizes = {
          quadra,
          quina,
          cheia,
        }
      } else {
        const quadraPercent = Number.parseFloat(formData.percentages.quadraPercent)
        const quinaPercent = Number.parseFloat(formData.percentages.quinaPercent)
        const cheiaPercent = Number.parseFloat(formData.percentages.cheiaPercent)

        if (
          isNaN(quadraPercent) ||
          isNaN(quinaPercent) ||
          isNaN(cheiaPercent) ||
          quadraPercent <= 0 ||
          quinaPercent <= 0 ||
          cheiaPercent <= 0 ||
          quadraPercent + quinaPercent + cheiaPercent !== 100
        ) {
          toast({
            title: "Percentuais inválidos",
            description: "Os percentuais devem ser maiores que zero e somar 100%.",
            variant: "destructive",
          })
          return
        }

        prizes = {
          quadraPercent,
          quinaPercent,
          cheiaPercent,
        }
      }

      const drawData = {
        name: formData.name,
        dateTime,
        cardPrice,
        type: formData.type,
        mode: formData.mode,
        prizes,
        // Só adicionar externalUrl se for modo manual
        ...(formData.mode === "manual" && {
          externalUrl:
            "https://gerador.livecenter.host/player.html?data=U2FsdGVkX1%2FjdQmVsznNeMJgbgOAnHaMmSc5q9vghBn7E81fcA1MDcqFiCpCB%2BOYbbW5NizD6A72OTAJ%2FidvXFacGg17j5VYN44PmJFI4ok%3D",
        }),
      }

      if (isEditing && selectedDrawId) {
        console.log("Updating draw:", selectedDrawId, drawData)

        // Atualizar sorteio existente
        await updateDoc(doc(db, "draws", selectedDrawId), drawData)

        // Atualizar a lista local
        setDraws((prev) =>
          prev.map((d) =>
            d.id === selectedDrawId
              ? {
                  ...d,
                  ...drawData,
                }
              : d,
          ),
        )

        toast({
          title: "Sorteio atualizado",
          description: "O sorteio foi atualizado com sucesso.",
        })
      } else {
        // Criar novo sorteio
        const newDrawData = {
          ...drawData,
          status: "waiting" as const,
          drawnNumbers: [],
          currentPhase: "quadra" as const,
          winners: {},
          createdAt: new Date(),
        }

        const docRef = await addDoc(collection(db, "draws"), newDrawData)

        // Adicionar à lista local
        setDraws((prev) => [
          {
            id: docRef.id,
            ...newDrawData,
          } as Draw,
          ...prev,
        ])

        toast({
          title: "Sorteio criado",
          description: "O sorteio foi criado com sucesso.",
        })
      }

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error saving draw:", error)
      toast({
        title: "Erro",
        description: `Não foi possível ${isEditing ? "atualizar" : "criar"} o sorteio. Tente novamente.`,
        variant: "destructive",
      })
    }
  }

  const handleAdminister = (drawId: string) => {
    router.push(`/backoffice/sorteios/${drawId}/administrar`)
  }

  if (loading || loadingDraws) {
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
      case "active":
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>
      case "finished":
        return <Badge variant="secondary">Finalizado</Badge>
      default:
        return <Badge variant="outline">Aguardando</Badge>
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sorteios</h1>
            <p className="text-muted-foreground">Gerencie todos os sorteios do sistema</p>
          </div>
          <Button onClick={handleCreateDraw}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Sorteio
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Sorteios</CardTitle>
            <CardDescription>Total de {draws.length} sorteios registrados</CardDescription>
          </CardHeader>
          <CardContent>
            {draws.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum sorteio encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Valor da Cartela</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Modo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {draws.map((draw) => (
                      <TableRow key={draw.id}>
                        <TableCell className="font-medium">{draw.name}</TableCell>
                        <TableCell>{formatDateTime(draw.dateTime)}</TableCell>
                        <TableCell>R$ {draw.cardPrice.toFixed(2)}</TableCell>
                        <TableCell>{draw.type === "fixed" ? "Fixo" : "Acumulado"}</TableCell>
                        <TableCell>{draw.mode === "automatic" ? "Automático" : "Manual"}</TableCell>
                        <TableCell>{getStatusBadge(draw.status)}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditDraw(draw)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {draw.mode === "manual" && draw.status !== "finished" && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                                onClick={() => handleAdminister(draw.id)}
                              >
                                Administrar
                              </Button>
                            )}
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(draw.id)}>
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

        {/* Modal de Criação/Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{isEditing ? "Editar Sorteio" : "Criar Sorteio"}</DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Edite as informações do sorteio existente."
                  : "Preencha as informações para criar um novo sorteio."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Sorteio</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Ex: Bingo da Sorte"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateTime">Data e Hora</Label>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                  <Input
                    id="dateTime"
                    name="dateTime"
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardPrice">Valor da Cartela (R$)</Label>
                <Input
                  id="cardPrice"
                  name="cardPrice"
                  type="number"
                  step="0.01"
                  min="1"
                  value={formData.cardPrice}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Sorteio</Label>
                <RadioGroup
                  value={formData.type}
                  onValueChange={(value) => handleSelectChange("type", value as "fixed" | "accumulated")}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fixed" id="fixed" />
                    <Label htmlFor="fixed">Fixo (valores pré-definidos)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="accumulated" id="accumulated" />
                    <Label htmlFor="accumulated">Acumulado (percentuais)</Label>
                  </div>
                </RadioGroup>
              </div>

              {formData.type === "fixed" ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prizes.quadra">Prêmio Quadra (R$)</Label>
                    <Input
                      id="prizes.quadra"
                      name="prizes.quadra"
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.prizes.quadra}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizes.quina">Prêmio Quina (R$)</Label>
                    <Input
                      id="prizes.quina"
                      name="prizes.quina"
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.prizes.quina}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizes.cheia">Prêmio Cartela Cheia (R$)</Label>
                    <Input
                      id="prizes.cheia"
                      name="prizes.cheia"
                      type="number"
                      step="0.01"
                      min="1"
                      value={formData.prizes.cheia}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="percentages.quadraPercent">Quadra (%)</Label>
                    <Input
                      id="percentages.quadraPercent"
                      name="percentages.quadraPercent"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.percentages.quadraPercent}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentages.quinaPercent">Quina (%)</Label>
                    <Input
                      id="percentages.quinaPercent"
                      name="percentages.quinaPercent"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.percentages.quinaPercent}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="percentages.cheiaPercent">Cartela Cheia (%)</Label>
                    <Input
                      id="percentages.cheiaPercent"
                      name="percentages.cheiaPercent"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.percentages.cheiaPercent}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Modo de Sorteio</Label>
                <Select
                  value={formData.mode}
                  onValueChange={(value) => handleSelectChange("mode", value as "manual" | "automatic")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatic">Automático</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Remover esta seção do JSX: */}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name || !formData.dateTime || !formData.cardPrice}>
                <Trophy className="h-4 w-4 mr-2" />
                {isEditing ? "Atualizar Sorteio" : "Criar Sorteio"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}
