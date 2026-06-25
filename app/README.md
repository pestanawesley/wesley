# 💰 Minha Carteira

App pessoal de finanças: registre **gastos, ganhos, contas futuras, metas e patrimônio** num lugar só. Foco em lançamento rápido e em te ajudar a sobrar dinheiro e construir patrimônio.

Feito como **PWA** (React + Vite): funciona no navegador do PC e instala como app no celular.

## Funcionalidades

**Camada 1 — controle**
- **Dashboard**: saldo disponível, entrou/saiu/sobrou no mês, saldo projetado do fim do mês, patrimônio líquido, gráfico de gastos por categoria e evolução dos últimos 6 meses.
- **Lançamentos**: gasto/ganho rápido com categoria, conta e data; filtro por mês; editar e excluir.
- **Contas futuras**: a pagar / a receber com vencimento, avisos de atraso e "marcar como pago" (vira lançamento real).
- **Metas**: objetivos de poupança (reserva de emergência, viagem...) com barra de progresso.
- **Contas & Cartões**: saldo por conta; backup (exportar/importar `.json`); zerar dados.

**Camada 2 — recorrência & calendário**
- **Recorrentes**: salário/aluguel/assinaturas que geram lançamentos ou contas automaticamente nas datas certas (idempotente).
- **Calendário** de vencimentos do mês, com marcações por dia.

**Camada 3 — automação & inteligência**
- **Importar extrato CSV**: detecta colunas, número/data BR, auto-categoriza por palavra-chave e mostra prévia antes de importar.
- **Foto do comprovante**: tira/anexa foto (comprimida, guardada em IndexedDB) no lançamento.
- **Alertas inteligentes**: avisos de contas atrasadas/a vencer, gastos acima da média, estouro por categoria e reforço positivo quando sobra dinheiro.

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

- **Publicar online** — colocar numa URL (Vercel/Netlify) para usar no celular e PC.
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
