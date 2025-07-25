"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut } from "firebase/auth"
import { Menu, Home, CreditCard, Banknote, User, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/hooks/use-auth"

interface UserLayoutProps {
  children: React.ReactNode
}

export function UserLayout({ children }: UserLayoutProps) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  const menuItems = [
    { href: "/home", icon: Home, label: "Home" },
    { href: "/depositar", icon: CreditCard, label: "Depositar" },
    { href: "/saque", icon: Banknote, label: "Saque" },
    { href: "/perfil", icon: User, label: "Perfil" },
  ]

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-white">
        <div className="flex h-16 items-center px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64">
              <div className="flex flex-col h-full">
                <div className="py-4">
                  <h2 className="text-lg font-semibold">Bingo App</h2>
                  {user && <p className="text-sm text-muted-foreground">Olá, {user.name}</p>}
                </div>
                <nav className="flex-1 space-y-2">
                  {menuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent"
                      onClick={() => setOpen(false)}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <div className="border-t pt-4">
                  <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <div className="hidden md:flex items-center space-x-6 ml-6">
            <Link href="/home" className="text-lg font-semibold">
              Bingo App
            </Link>
            <nav className="flex items-center space-x-6">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="ml-auto flex items-center space-x-4">
            {user && <div className="hidden md:block text-sm">Saldo: R$ {user.balance.toFixed(2)}</div>}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden md:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
