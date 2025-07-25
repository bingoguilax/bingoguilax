"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 px-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-red-600">404</span>
          </div>
          <CardTitle className="text-2xl">Página não encontrada</CardTitle>
          <CardDescription>A página que você está procurando não existe ou foi movida.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="default">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Ir para Home
              </Link>
            </Button>
            <Button asChild variant="outline" onClick={() => window.history.back()}>
              <span className="cursor-pointer">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </span>
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Se você acredita que isso é um erro, entre em contato conosco.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
