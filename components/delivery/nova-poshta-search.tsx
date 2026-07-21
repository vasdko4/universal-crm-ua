'use client'

import { useState, useTransition } from 'react'
import { npSearchCities, npSearchWarehouses } from '@/app/actions/settings'
import type { NpCity, NpWarehouse } from '@/lib/delivery/nova-poshta'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, MapPin, Building2, Package, Search } from 'lucide-react'

export function NovaPoshtaSearch() {
  const [isPending, startTransition] = useTransition()
  const [cityQuery, setCityQuery] = useState('')
  const [cities, setCities] = useState<NpCity[]>([])
  const [selectedCity, setSelectedCity] = useState<NpCity | null>(null)
  const [demo, setDemo] = useState(false)

  const [type, setType] = useState<'branch' | 'postomat'>('branch')
  const [whQuery, setWhQuery] = useState('')
  const [warehouses, setWarehouses] = useState<NpWarehouse[]>([])
  const [searched, setSearched] = useState(false)

  function handleCitySearch() {
    if (!cityQuery.trim()) return
    startTransition(async () => {
      const res = await npSearchCities(cityQuery)
      if (res.ok) {
        setCities(res.cities)
        setDemo(res.demo)
      }
    })
  }

  function pickCity(city: NpCity) {
    setSelectedCity(city)
    setCities([])
    setCityQuery(city.name)
    setWarehouses([])
    setSearched(false)
    loadWarehouses(city, type, '')
  }

  function loadWarehouses(city: NpCity, t: 'branch' | 'postomat', q: string) {
    startTransition(async () => {
      const res = await npSearchWarehouses({
        cityName: city.name,
        cityRef: city.ref,
        query: q,
        type: t,
      })
      if (res.ok) {
        setWarehouses(res.items)
        setDemo(res.demo)
        setSearched(true)
      }
    })
  }

  function handleTypeChange(t: string) {
    const nt = t as 'branch' | 'postomat'
    setType(nt)
    if (selectedCity) loadWarehouses(selectedCity, nt, whQuery)
  }

  return (
    <div className="flex flex-col gap-4">
      {demo && (
        <Badge variant="outline" className="w-fit border-warning/40 text-warning">
          Демо-режим (укажите API-ключ для реальных данных)
        </Badge>
      )}

      {/* Шаг 1: город */}
      <div className="flex flex-col gap-2">
        <Label className="text-xs">1. Город получения</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MapPin className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={cityQuery}
              placeholder="Начните вводить город, например Київ"
              onChange={(e) => setCityQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleCitySearch()
                }
              }}
            />
          </div>
          <Button variant="secondary" onClick={handleCitySearch} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Найти
          </Button>
        </div>
        {cities.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border bg-background p-1">
            {cities.map((c) => (
              <button
                key={c.ref}
                type="button"
                onClick={() => pickCity(c)}
                className="flex items-center justify-between rounded px-2.5 py-2 text-left text-sm hover:bg-muted"
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.area} обл.</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Шаг 2: тип и поиск отделений */}
      {selectedCity && (
        <div className="flex flex-col gap-2">
          <Label className="text-xs">
            2. Пункт выдачи в городе <span className="font-medium text-foreground">{selectedCity.name}</span>
          </Label>
          <Tabs value={type} onValueChange={handleTypeChange}>
            <TabsList>
              <TabsTrigger value="branch" className="gap-1.5">
                <Building2 className="size-4" /> Отделения
              </TabsTrigger>
              <TabsTrigger value="postomat" className="gap-1.5">
                <Package className="size-4" /> Почтоматы
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={whQuery}
              placeholder="Фильтр по номеру или адресу"
              onChange={(e) => setWhQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  loadWarehouses(selectedCity, type, whQuery)
                }
              }}
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-md border">
            {isPending ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Загрузка...
              </div>
            ) : warehouses.length === 0 && searched ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Ничего не найдено
              </div>
            ) : (
              <ul className="divide-y">
                {warehouses.map((w) => (
                  <li key={w.ref} className="flex items-start gap-3 p-3 hover:bg-muted/50">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {w.type === 'postomat' ? (
                        <Package className="size-4" />
                      ) : (
                        <Building2 className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{w.description}</p>
                      <p className="truncate text-xs text-muted-foreground">{w.shortAddress}</p>
                    </div>
                    {w.maxWeight && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        до {w.maxWeight} кг
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
