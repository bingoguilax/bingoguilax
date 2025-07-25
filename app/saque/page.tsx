"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { collection, addDoc, doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserLayout } from "@/components/layout/user-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { Banknote, DollarSign } from "lucide-react"

export default function WithdrawPage() {
  const { user, loading } = useAuth()
  const [amount, setAmount] = useState("")
  const [pixKeyType, setPixKeyType] = useState("")
  const [pixKey, setPixKey] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const [saqueMin, setSaqueMin] = useState(1)
  const [saqueMax, setSaqueMax] = useState(10000)
  const [configLoading, setConfigLoading] = useState(true)
  const [inputError, setInputError] = useState("")

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchConfig = async () => {
      setConfigLoading(true)
      try {
        const docRef = doc(db, "system_config", "geral")
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const data = docSnap.data()
          setSaqueMin(data.saqueMin ?? 1)
          setSaqueMax(data.saqueMax ?? 10000)
        }
      } catch (e) {
        // erro silencioso
      } finally {
        setConfigLoading(false)
      }
    }
    fetchConfig()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    const withdrawAmount = Number.parseFloat(amount)

    if (withdrawAmount > user.balance) {
      setError("Saldo insuficiente")
      return
    }

    setSubmitting(true)
    setError("")

    try {
      await addDoc(collection(db, "withdrawals"), {
        userId: user.id,
        userName: user.name,
        amount: withdrawAmount,
        pixKeyType,
        pixKey,
        status: "pending",
        createdAt: new Date(),
      })

      setSuccess(true)
      setAmount("")
      setPixKeyType("")
      setPixKey("")

      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("Error creating withdrawal:", error)
      setError("Erro ao processar saque. Tente novamente.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value)
    setInputError("")
    const value = Number(e.target.value)
    if (value < saqueMin) {
      setInputError(`Valor mínimo para saque: R$ ${saqueMin}`)
    } else if (value > saqueMax) {
      setInputError(`Valor máximo para saque: R$ ${saqueMax}`)
    } else if (user && value > user.balance) {
      setInputError("Saldo insuficiente")
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null
  }

  const pixKeyTypes = [
    { value: "cpf", label: "CPF" },
    { value: "phone", label: "Telefone" },
    { value: "email", label: "Email" },
    { value: "random", label: "Chave Aleatória" },
  ]

  return (
    <UserLayout>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Banknote className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Saque</CardTitle>
            <CardDescription>Retire seus créditos via PIX</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <DollarSign className="h-5 w-5" />
                <span className="font-medium">Saldo Disponível: R$ {user.balance.toFixed(2)}</span>
              </div>
            </div>

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Solicitação de saque enviada com sucesso! Aguarde a aprovação.
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
            )}

            {configLoading ? (
              <div className="text-center py-8">Carregando configurações...</div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min={saqueMin}
                    max={Math.min(saqueMax, user?.balance ?? saqueMax)}
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    required
                  />
                  {inputError && <div className="text-red-600 text-xs mt-1">{inputError}</div>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixKeyType">Tipo de Chave PIX</Label>
                  <Select value={pixKeyType} onValueChange={setPixKeyType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de chave" />
                    </SelectTrigger>
                    <SelectContent>
                      {pixKeyTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pixKey">Chave PIX</Label>
                  <Input
                    id="pixKey"
                    value={pixKey}
                    onChange={(e) => setPixKey(e.target.value)}
                    placeholder={
                      pixKeyType === "cpf"
                        ? "000.000.000-00"
                        : pixKeyType === "phone"
                          ? "(11) 99999-9999"
                          : pixKeyType === "email"
                            ? "email@exemplo.com"
                            : "Chave aleatória"
                    }
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !amount || !pixKeyType || !pixKey || !!inputError}>
                  {submitting ? "Processando..." : "Sacar"}
                </Button>
              </form>
            )}

            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="font-medium mb-2">Informações:</p>
              <ul className="space-y-1 text-xs">
                <li>• Saques são processados em até 24 horas</li>
                <li>• Valor mínimo: R$ 1,00</li>
                <li>• Disponível apenas via PIX</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
