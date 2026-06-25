// Dados iniciais para um primeiro uso amigável (categorias e contas padrão).
import { uid } from './format'

export function seed() {
  const cat = (name, type, icon, color) => ({ id: uid(), name, type, icon, color })

  const categories = [
    // Gastos
    cat('Alimentação', 'gasto', '🍽️', '#ef4444'),
    cat('Mercado', 'gasto', '🛒', '#f97316'),
    cat('Transporte', 'gasto', '🚗', '#eab308'),
    cat('Moradia', 'gasto', '🏠', '#8b5cf6'),
    cat('Contas & Assinaturas', 'gasto', '📄', '#06b6d4'),
    cat('Saúde', 'gasto', '💊', '#ec4899'),
    cat('Lazer', 'gasto', '🎉', '#14b8a6'),
    cat('Educação', 'gasto', '📚', '#3b82f6'),
    cat('Compras', 'gasto', '🛍️', '#a855f7'),
    cat('Outros', 'gasto', '📦', '#64748b'),
    // Ganhos
    cat('Salário', 'ganho', '💼', '#22c55e'),
    cat('Freelance / Extra', 'ganho', '💸', '#10b981'),
    cat('Investimentos', 'ganho', '📈', '#16a34a'),
    cat('Presente / Outros', 'ganho', '🎁', '#84cc16'),
  ]

  const accounts = [
    { id: uid(), name: 'Conta Corrente', type: 'banco', initialBalance: 0, color: '#3b82f6' },
    { id: uid(), name: 'Dinheiro', type: 'carteira', initialBalance: 0, color: '#22c55e' },
  ]

  return {
    accounts,
    categories,
    transactions: [],
    bills: [],
    recurrences: [],
    installments: [],
    goals: [],
    meta: { createdAt: new Date().toISOString(), seeded: true },
  }
}
