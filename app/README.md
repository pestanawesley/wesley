# 💰 Minha Carteira

App pessoal de finanças: registre **gastos, ganhos, contas futuras, metas e patrimônio** num lugar só. Foco em lançamento rápido e em te ajudar a sobrar dinheiro e construir patrimônio.

Feito como **PWA** (React + Vite): funciona no navegador do PC e instala como app no celular.

## Funcionalidades (Camada 1 — pronta)

- **Dashboard**: saldo disponível, entrou/saiu/sobrou no mês, saldo projetado do fim do mês, patrimônio líquido, gráfico de gastos por categoria e evolução dos últimos 6 meses.
- **Lançamentos**: gasto/ganho rápido com categoria, conta e data; filtro por mês; editar e excluir.
- **Contas futuras**: a pagar / a receber com vencimento, avisos de atraso e "marcar como pago" (vira lançamento real).
- **Metas**: objetivos de poupança (reserva de emergência, viagem...) com barra de progresso.
- **Contas & Cartões**: saldo por conta; backup (exportar/importar `.json`); zerar dados.

## Rodar localmente

```bash
cd app
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # gera a versão de produção em dist/
```

## Onde os dados ficam

Hoje tudo é **local-first**: os dados ficam no `localStorage` do navegador/celular (privacidade total, funciona offline). A camada de dados está isolada em `src/lib/db.js`.

## Próximos passos (roadmap)

- **Camada 2** — recorrentes automáticos (salário, aluguel, assinaturas) e calendário.
- **Camada 3** — importar extrato CSV do banco, foto do comprovante, alertas inteligentes.
- **Nuvem (Supabase)** — login + sincronização entre celular e PC. Para ligar, basta
  reimplementar `load()`/`save()` em `src/lib/db.js` usando o cliente do Supabase;
  o resto do app não muda.

## Estrutura

```
src/
  lib/        # format (BRL/datas), db (persistência), seed (dados iniciais)
  store.jsx   # estado global + cálculos (saldos, resumos, projeção, patrimônio)
  components/  # Sheet (modal), TransactionForm (lançamento)
  pages/      # Dashboard, Transactions, Bills, Goals, Accounts
```
