"use client"

import { useState, useEffect } from "react"
import { AdminLayout } from "@/components/layout/admin-layout"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

export default function ConfiguracoesPage() {
  const [depositoMin, setDepositoMin] = useState(0)
  const [depositoMax, setDepositoMax] = useState(0)
  const [saqueMin, setSaqueMin] = useState(0)
  const [saqueMax, setSaqueMax] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState("")
  const [erro, setErro] = useState("")
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const fetchConfig = async () => {
      setCarregando(true)
      setErro("")
      try {
        const docRef = doc(db, "system_config", "geral")
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          setDepositoMin(data.depositoMin ?? 0)
          setDepositoMax(data.depositoMax ?? 0)
          setSaqueMin(data.saqueMin ?? 0)
          setSaqueMax(data.saqueMax ?? 0)
        }
      } catch (e) {
        setErro("Erro ao carregar configurações")
      } finally {
        setCarregando(false)
      }
    }
    fetchConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setMensagem("")
    setErro("")
    try {
      console.log({
        depositoMin,
        depositoMax,
        saqueMin,
        saqueMax,
      })
      await setDoc(doc(db, "system_config", "geral"), {
        depositoMin: Number(depositoMin),
        depositoMax: Number(depositoMax),
        saqueMin: Number(saqueMin),
        saqueMax: Number(saqueMax),
      })
      setMensagem("Configurações salvas com sucesso!")
    } catch (e) {
      setErro("Erro ao salvar configurações")
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="min-h-screen flex items-center justify-center">Carregando configurações...</div>
  }

  return (
    <AdminLayout>
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Configurações do Sistema</CardTitle>
            <CardDescription>
              Defina os valores mínimos e máximos para depósito e saque, além do limite de saques por dia.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Valor mínimo para depósito</label>
                <Input
                  type="number"
                  min={0}
                  value={depositoMin}
                  onChange={e => setDepositoMin(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor máximo para depósito</label>
                <Input
                  type="number"
                  min={0}
                  value={depositoMax}
                  onChange={e => setDepositoMax(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor mínimo para saque</label>
                <Input
                  type="number"
                  min={0}
                  value={saqueMin}
                  onChange={e => setSaqueMin(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Valor máximo para saque</label>
                <Input
                  type="number"
                  min={0}
                  value={saqueMax}
                  onChange={e => setSaqueMax(Number(e.target.value))}
                  required
                />
              </div>
              {mensagem && <div className="text-green-600 text-sm font-medium">{mensagem}</div>}
              {erro && <div className="text-red-600 text-sm font-medium">{erro}</div>}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={salvando}>
                {salvando ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </AdminLayout>
  )
} 