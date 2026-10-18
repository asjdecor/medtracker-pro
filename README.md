# MedTracker Pro

Gestão inteligente de medicamentos em português: doses do dia, adesão, estoque, consultas, diário de sintomas, cartão de emergência, relatório para o médico e IA clínica (leitura de receita por foto, resumo de exames, interações e assistente por voz).

**App:** https://asjdecor.github.io/medtracker-pro/

## Funcionalidades

- **Hoje**: linha do tempo das doses com "Tomei / Pular / Desfazer", contagem para a próxima dose, adesão de 7 dias, sequência de dias completos e alerta de estoque.
- **Medicamentos**: horários fixos, intervalo (a cada X horas) ou "se necessário"; início/fim do tratamento; estoque que baixa sozinho a cada dose; reposição; pausa.
- **Lembretes**: notificações do navegador e arquivo `.ics` com alarmes diários para Google Agenda, iPhone e Outlook (funcionam com o app fechado).
- **IA Clínica** (chave do próprio usuário, Claude ou Gemini): foto da receita → medicamentos prontos para cadastrar; resumo de exames; checagem de interações usando alergias e condições; assistente com voz.
- **Consultas** com perguntas para o médico e alarmes (1 dia e 2 horas antes); **Médicos** com ligar/WhatsApp; **Diário** com intensidade 0–10 e gráfico de 30 dias.
- **Relatório** imprimível/PDF com adesão por medicamento e doses esquecidas; **Cartão de emergência** com tipo sanguíneo, alergias e contatos; botão **SOS** (192, 193, 190, Disque-Intoxicação).
- PWA instalável e offline, tema escuro, texto ampliado, backup/restauração em JSON.

## Dados: local ou nuvem

Sem configuração, o app roda em **modo local**: os dados ficam no navegador do usuário.

Para ativar contas e sincronização entre aparelhos com **Supabase**:

1. Crie um projeto em https://supabase.com (plano gratuito).
2. No **SQL Editor**, rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
3. Em **Authentication → URL Configuration**, coloque `https://asjdecor.github.io/medtracker-pro/` em *Site URL* e em *Redirect URLs*.
4. (Opcional) Em **Authentication → Providers → Google**, ative o login com Google.
5. Crie `.env.local` na raiz com `VITE_SUPABASE_URL=...` e `VITE_SUPABASE_ANON_KEY=...` (em Supabase → Project Settings → API).
6. Publique de novo: `npm run deploy`.

A chave `anon` é pública por design; a proteção vem das políticas RLS do `schema.sql` (cada usuário só lê e grava as próprias linhas). As chaves de IA nunca são sincronizadas: ficam só no aparelho.

## Desenvolvimento

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # gera dist/
```

Crie um `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` para testar o modo nuvem localmente.

### Publicação

`npm run deploy` compila e envia `dist/` para o branch `gh-pages` (GitHub Pages → *Deploy from a branch*).

Para deploy automático a cada push: autorize o escopo de workflows (`gh auth refresh -s workflow`), mova `deploy/github-actions-deploy.yml` para `.github/workflows/deploy.yml`, troque o Pages para *GitHub Actions* em **Settings → Pages** e cadastre as duas variáveis do Supabase em **Settings → Secrets and variables → Actions → Variables**.

> O MedTracker Pro organiza informações; não substitui orientação de médico ou farmacêutico.
