"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Smartphone, Download, Home, Share, Plus, MoreVertical } from "lucide-react"
import { usePWAInstall } from "@/hooks/use-pwa-install"

export function PWAInstallGuide() {
  const { isInstallable, isInstalled, installPWA } = usePWAInstall()
  const [isOpen, setIsOpen] = useState(false)

  const handleInstall = async () => {
    const success = await installPWA()
    if (success) {
      setIsOpen(false)
    }
  }

  if (isInstalled) {
    return null // Não mostrar se já está instalado
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white border-0 shadow-lg"
          size="lg"
        >
          <Download className="h-5 w-5 mr-2" />
          Baixar App
          <Badge variant="secondary" className="ml-2 bg-white/20 text-white border-0">
            Grátis
          </Badge>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Smartphone className="h-6 w-6 text-blue-600" />
            Instalar Bingo Guilax
          </DialogTitle>
          <DialogDescription>
            Adicione o app à sua tela inicial para uma experiência completa
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Botão de instalação automática para Chrome/Edge */}
          {isInstallable && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-green-800">🚀 Instalação Rápida</CardTitle>
                <CardDescription className="text-green-700">
                  Seu navegador suporta instalação automática
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={handleInstall}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Instalar Agora
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tutorial manual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Adicionar à Tela Inicial
              </CardTitle>
              <CardDescription>
                Siga as instruções para seu dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="android" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="android" className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded-sm"></div>
                    Android
                  </TabsTrigger>
                  <TabsTrigger value="ios" className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-800 rounded-sm"></div>
                    iOS
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="android" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                      <div>
                        <p className="font-medium">Abra o menu do navegador</p>
                        <p className="text-sm text-gray-600">Toque nos três pontos (⋮) no canto superior direito</p>
                      </div>
                      <MoreVertical className="h-5 w-5 text-gray-400" />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                      <div>
                        <p className="font-medium">Encontre "Adicionar à tela inicial"</p>
                        <p className="text-sm text-gray-600">Ou "Instalar app" dependendo do navegador</p>
                      </div>
                      <Plus className="h-5 w-5 text-gray-400" />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                      <div>
                        <p className="font-medium">Confirme a instalação</p>
                        <p className="text-sm text-gray-600">Toque em "Adicionar" para instalar o app</p>
                      </div>
                      <Download className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                    <p className="text-sm text-green-800">
                      <strong>💡 Dica:</strong> O ícone do Bingo Guilax aparecerá na sua tela inicial como um app normal!
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="ios" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                      <div>
                        <p className="font-medium">Abra no Safari</p>
                        <p className="text-sm text-gray-600">Use apenas o Safari para instalar no iOS</p>
                      </div>
                      <div className="w-5 h-5 bg-blue-500 rounded"></div>
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                      <div>
                        <p className="font-medium">Toque no botão compartilhar</p>
                        <p className="text-sm text-gray-600">Ícone de compartilhamento na parte inferior</p>
                      </div>
                      <Share className="h-5 w-5 text-gray-400" />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                      <div>
                        <p className="font-medium">Adicionar à Tela de Início</p>
                        <p className="text-sm text-gray-600">Role para baixo e encontre esta opção</p>
                      </div>
                      <Plus className="h-5 w-5 text-gray-400" />
                    </div>

                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">4</div>
                      <div>
                        <p className="font-medium">Confirme a adição</p>
                        <p className="text-sm text-gray-600">Toque em "Adicionar" no canto superior direito</p>
                      </div>
                      <Download className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>⚠️ Importante:</strong> No iOS, use apenas o Safari. Outros navegadores não suportam instalação de PWA.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Benefícios */}
          <Card className="border-purple-200 bg-purple-50">
            <CardHeader>
              <CardTitle className="text-purple-800">🎯 Vantagens do App</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-purple-700">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Acesso mais rápido</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Funciona offline</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Notificações de sorteios</span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Experiência nativa</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
