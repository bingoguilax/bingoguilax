"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signInWithEmailAndPassword } from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth, db } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"
import { useEffect } from "react"
import { Eye, EyeOff } from "lucide-react"
import { sendPasswordResetEmail } from "firebase/auth"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { user } = useAuth()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [resetEmail, setResetEmail] = useState("")
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMessage, setResetMessage] = useState("")
  const [resetError, setResetError] = useState("")

  useEffect(() => {
    if (user) {
      router.push("/home")
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid))

      if (userDoc.exists()) {
        router.push("/home")
      } else {
        setError("Usuário não encontrado")
      }
    } catch (error: any) {
      setError("Email ou senha incorretos")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setResetLoading(true)
    setResetMessage("")
    setResetError("")
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      setResetMessage("E-mail de redefinição enviado! Verifique sua caixa de entrada.")
      setResetEmail("")
    } catch (error: any) {
      setResetError("Não foi possível enviar o e-mail. Verifique o endereço informado.")
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#000732' }}>
      {/* Modal de redefinição de senha */}
      {showResetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-md shadow-lg w-full max-w-sm p-6 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
              onClick={() => {
                setShowResetPassword(false)
                setResetMessage("")
                setResetError("")
                setResetEmail("")
              }}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="text-lg font-semibold mb-2 text-center">Redefinir senha</h2>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">E-mail</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {resetMessage && <div className="text-green-600 text-sm text-center">{resetMessage}</div>}
              {resetError && <div className="text-red-600 text-sm text-center">{resetError}</div>}
              <Button type="submit" className="w-full" disabled={resetLoading}>
                {resetLoading ? "Enviando..." : "Enviar e-mail de redefinição"}
              </Button>
            </form>
          </div>
        </div>
      )}
      <div className="w-full max-w-md flex flex-col items-center">
        <img
          src="https://i.imgur.com/1odU7L2.png"
          alt="Banner do Bingo"
          className="w-full h-52 sm:h-64 object-contain rounded-t-md -mt-8 z-10 relative"
          style={{ marginBottom: '-2rem' }}
        />
        <Card className="w-full relative z-0 rounded-b-md !rounded-t-none">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Entrar</CardTitle>
            <CardDescription>Entre com sua conta para acessar o Bingo</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={passwordVisible ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    tabIndex={-1}
                    aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <div className="text-sm text-red-600 text-center">{error}</div>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              Não tem uma conta?{" "}
              <Link href="/registro" className="text-primary hover:underline">
                Registre-se
              </Link>
            </div>
            <div className="mt-2 text-center text-sm">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => setShowResetPassword(true)}
              >
                Esqueceu a senha?
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
