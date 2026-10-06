import { describe, it, expect } from 'vitest'
import { parseCSV } from '@/lib/import-csv'

describe('parseCSV', () => {
  it('parses a simple ;-delimited file with Russian export headers', () => {
    const rows = parseCSV(
      '"Название (укр)";"Название (рус)";"Артикул";"Цена";"Остаток"\n' +
        '"Павербанк";"Павербанк";"PB-1";"1000";"5"',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name_uk: 'Павербанк',
      name_ru: 'Павербанк',
      sku: 'PB-1',
      price: '1000',
      quantity: '5',
    })
  })

  it('keeps multiline quoted descriptions as a single row', () => {
    const csv =
      '"Название (укр)";"Артикул";"Цена";"Описание (укр)"\n' +
      '"Товар";"SKU-1";"100";"<p>Рядок 1</p>\n<p>Рядок 2</p>"\n' +
      '"Товар 2";"SKU-2";"200";"<p>Один рядок</p>"\n'
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].description_uk).toBe('<p>Рядок 1</p>\n<p>Рядок 2</p>')
    expect(rows[0].sku).toBe('SKU-1')
    expect(rows[1].sku).toBe('SKU-2')
  })

  it('handles escaped quotes and delimiters inside quoted fields', () => {
    const rows = parseCSV('"name_uk";"price"\n"Каже ""супер""; товар";"100"')
    expect(rows).toHaveLength(1)
    expect(rows[0].name_uk).toBe('Каже "супер"; товар')
  })

  it('auto-detects comma delimiter', () => {
    const rows = parseCSV('"name_uk","sku","price"\n"Товар","S1","10"')
    expect(rows).toHaveLength(1)
    expect(rows[0].sku).toBe('S1')
  })

  it('strips BOM and skips blank lines', () => {
    const rows = parseCSV('﻿"name_uk";"sku"\n\n"Товар";"S1"\n\n')
    expect(rows).toHaveLength(1)
    expect(rows[0].name_uk).toBe('Товар')
  })

  it('returns [] for header-only or empty input', () => {
    expect(parseCSV('"a";"b"')).toEqual([])
    expect(parseCSV('')).toEqual([])
  })

  it('parses meta_description columns via English keys and Russian aliases', () => {
    const rows = parseCSV(
      '"name_uk";"sku";"price";"meta_description_uk";"Мета-описание (рус)"\n' +
        '"Товар";"S1";"100";"Купити Товар в PowerFox.";"Купить Товар в PowerFox."',
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      meta_description_uk: 'Купити Товар в PowerFox.',
      meta_description_ru: 'Купить Товар в PowerFox.',
    })
  })
})
