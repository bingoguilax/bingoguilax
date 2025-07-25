"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { collection, addDoc, doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserLayout } from "@/components/layout/user-layout"
import { useAuth } from "@/hooks/use-auth"
import { db } from "@/lib/firebase"
import { CreditCard, DollarSign, Copy } from "lucide-react"
import axios from "axios"

export default function DepositPage() {
  const { user, loading } = useAuth()
  const [amount, setAmount] = useState("")
  const [cpf, setCpf] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [qrCode, setQrCode] = useState("")
  const [copiaECola, setCopiaECola] = useState("")
  const router = useRouter()
  const [depositoMin, setDepositoMin] = useState(1)
  const [depositoMax, setDepositoMax] = useState(10000)
  const [configLoading, setConfigLoading] = useState(true)
  const [inputError, setInputError] = useState("")
  const [copiado, setCopiado] = useState(false)

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
          setDepositoMin(data.depositoMin ?? 1)
          setDepositoMax(data.depositoMax ?? 10000)
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

    setSubmitting(true)
    try {
      // Dados para SuitPay
      const now = new Date()
      const dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) // +1 dia
      const requestNumber = `${user.id}-${Date.now()}`
      const callbackUrl = "https://bingo-cwij.vercel.app/depositar" // ajuste para sua URL real
      const client = {
        name: user.name,
        document: cpf,
        email: user.email || "email@exemplo.com"
      }
      const split = {
        username: "contatogrupofluxcom", // ajuste conforme necessário
        percentageSplit: 10
      }

      // Chama a API interna já no padrão SuitPay
      const cobRes = await axios.post("/api/pix/cob", {
        amount,
        dueDate,
        callbackUrl,
        client,
        split,
        requestNumber
      })
      console.log('Resposta SuitPay:', cobRes.data)
      const { paymentCodeBase64, paymentCode, idTransaction } = cobRes.data
      if (!paymentCodeBase64 || !paymentCode) {
        throw new Error("Resposta inesperada da SuitPay. Verifique os dados enviados e tente novamente.")
      }
      const qrCodeImage = `data:image/png;base64,${paymentCodeBase64}`
      const qrCode = paymentCode
      const txid = idTransaction
      if (!txid) throw new Error("Erro ao criar cobrança Pix")

      // Salvar depósito no Firestore
      await addDoc(collection(db, "deposits"), {
        userId: user.id,
        userName: user.name,
        amount: Number(amount),
        cpf,
        status: "pending",
        createdAt: new Date(),
        txid,
      });

      setQrCode(qrCodeImage)
      setCopiaECola(qrCode)
      setSuccess(true)
      setAmount("")
      setCpf("")

      setTimeout(() => {
        setSuccess(false)
      }, 3000)
    } catch (error) {
      console.error("Error creating deposit:", error)
      alert("Erro ao processar depósito: " + (error as any)?.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(e.target.value)
    setInputError("")
    const value = Number(e.target.value)
    if (value < depositoMin) {
      setInputError(`Valor mínimo para depósito: R$ ${depositoMin}`)
    } else if (value > depositoMax) {
      setInputError(`Valor máximo para depósito: R$ ${depositoMax}`)
    }
  }

  const handleCopyPix = () => {
    if (copiaECola) {
      navigator.clipboard.writeText(copiaECola)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>
  }

  if (!user) {
    return null
  }

  return (
    <UserLayout>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Depositar</CardTitle>
            <CardDescription>Adicione créditos à sua conta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700">
                <DollarSign className="h-5 w-5" />
                <span className="font-medium">Saldo Atual: R$ {user.balance.toFixed(2)}</span>
              </div>
            </div>

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                Solicitação de depósito enviada com sucesso! Aguarde a aprovação.
              </div>
            )}

            {qrCode && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm text-center">
                <div className="mb-2 font-medium">Escaneie o QR Code para pagar:</div>
                <img src={qrCode} alt="QR Code Pix" className="mx-auto mb-2 w-48 h-48" />
                <div className="mb-1">Ou copie e cole:</div>
                <div className="flex items-center bg-white p-2 rounded text-xs break-all border select-all justify-between">
                  <span className="truncate flex-1">{copiaECola}</span>
                  <div className="flex items-center ml-2 gap-2">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-gray-100"
                      onClick={handleCopyPix}
                      title="Copiar código Pix"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {copiado && <span className="text-green-600 font-medium whitespace-nowrap">Copiado!</span>}
                  </div>
                </div>
              </div>
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
                    min={depositoMin}
                    max={depositoMax}
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    required
                  />
                  {inputError && <div className="text-red-600 text-xs mt-1">{inputError}</div>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !!inputError}>
                  {submitting ? "Processando..." : "Depositar"}
                </Button>
              </form>
            )}

            <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
              <p className="font-medium mb-2">Instruções:</p>
              <ul className="space-y-1 text-xs">
                <li>• O depósito será processado em até 24 horas</li>
                <li>• Mantenha o comprovante de pagamento</li>
                <li>• Em caso de dúvidas, entre em contato</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </UserLayout>
  )
}
