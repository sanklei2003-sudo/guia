# GUIA — teu cogumelo explorador

App de produtividade em que você **conversa com o mascote** e ele cria tarefas, compromissos, lembretes e jornadas de verdade. Funciona offline, sem API de IA paga e sem conta.

O mascote é um personagem novo nascido do Sanso (Sanso Tattoo): amanita vermelho com olhos "pie-eye", luvas brancas, meião listrado e tênis amarelo, agora com óculos de aviador e cachecol de explorador. Tem 15 expressões e é todo desenhado em SVG próprio, no traço rubber hose dos desenhos dos anos 30.

---

## 1. Colocar no iPhone (GitHub Pages, igual ao app Espiral)

O iPhone só instala apps web servidos por **HTTPS**. O GitHub Pages faz isso de graça.

1. Entre em github.com com a conta **sanklei2003-sudo**.
2. Clique em **New repository**, dê o nome `guia`, deixe **Public** e crie.
3. Na página do repositório, clique em **uploading an existing file**.
4. Arraste **o conteúdo** da pasta `guia` (index.html, sw.js, manifest.webmanifest e as pastas css, js e icons). Não arraste a pasta em si.
5. Clique em **Commit changes**.
6. Vá em **Settings → Pages**. Em *Branch*, escolha `main` e `/ (root)` e salve.
7. Espere 1 a 2 minutos. O endereço será `https://sanklei2003-sudo.github.io/guia/`.
8. No iPhone, abra esse endereço no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início**.
9. Abra pelo ícone do cogumelo. Ele roda em tela cheia e funciona sem internet depois da primeira abertura.

**Atualizar depois:** suba os arquivos novos no mesmo repositório. O app avisa quando houver versão nova; feche e abra de novo.

## 2. No MacBook

- **Usar o mesmo endereço:** no Chrome, ícone de instalar na barra de endereço. No Safari 17+ (macOS Sonoma ou mais novo): Arquivo → Adicionar ao Dock. No Monterey, use o Chrome.
- **Rodar localmente** (necessário para a IA local): no Terminal, dentro da pasta `guia`:
  ```
  python3 -m http.server 8000
  ```
  e abra `http://localhost:8000`.

## 3. Testes automatizados

```
node --test tests/guia.test.js
```
22 testes cobrindo os fluxos críticos: criar e reencontrar após reabrir, "me lembra de estudar amanhã às 15h", datas e horários ambíguos, concluir e ganhar XP, remarcar sem duplicar, 3 adiamentos, jornada com etapas, horário livre, conflito, falha de gravação sem confirmação falsa, Me salva com autorização, cobrança suave e recorrência.

---

## O que funciona offline

Tudo, exceto a IA local opcional: tarefas, compromissos, recorrência, agenda dia/semana/mês, conversa por comandos, jornadas, gamificação, foco, Me salva, resumo e exportação.

## O que entende na conversa

- "me lembra de comprar tinta amanhã às 10h"
- "reunião sexta às 14h" · "tatuagem sábado às 14h por 3 horas"
- "marca 40 minutos pra estudar quarta de tarde" (sugere horário livre)
- "o que eu tenho hoje?" · "e amanhã?" · "minha semana" · "pendências"
- "terminei comprar tinta" · "remarca estudar pra sexta" · "apaga dentista"
- "novo objetivo: aprender inglês" · "tenho um trabalho enorme, me ajuda a organizar"
- "me salva" · "organiza minha semana" · "resumo do dia" · "não tô conseguindo cumprir meus objetivos"

Quando falta informação, ele pergunta ("Que horas?", "Hoje ou semana que vem?", "3h da manhã ou 15h?"). Ele só confirma o que foi gravado de fato.

---

## Limites (lista honesta)

| Recurso | Situação |
|---|---|
| Notificação com o app **fechado** | Não. Exige servidor de push (Web Push). Use **Agenda → ícone de download (.ics)** para mandar os compromissos ao Calendário do iPhone com alarme do sistema. |
| Notificação com o app aberto | Sim. No iPhone, só com o app instalado na Tela de Início (iOS 16.4+). |
| Sincronizar iPhone ↔ Mac | Não automática. Use Ajustes → Exportar backup e Importar backup (pelo Arquivos/iCloud Drive). |
| Google Agenda | Sem integração direta. O arquivo .ics é importado pelo Google Agenda. |
| Voz | Usa o reconhecimento de fala do navegador quando existe. No app instalado no iPhone pode não estar disponível; nesse caso, use o microfone do teclado. |
| Conversa livre e estratégia | Só com a IA local ligada (abaixo). Sem ela, o Guia diz que não sabe e oferece transformar o assunto em objetivo. |
| "Aprendizado" | Regras e contagens simples (adiamentos, horário em que você mais conclui, dias ativos). Nada de machine learning. Ajustes → "O que o Guia aprendeu" mostra e zera esses dados. |

## IA local opcional (Ollama, grátis)

1. Instale o Ollama em ollama.com. O Mac precisa de pelo menos 8 GB de RAM; o MacBook Air 2016 deve ficar lento.
2. No Terminal: `ollama pull llama3.2:3b`
3. Libere o acesso do app: `OLLAMA_ORIGINS=http://localhost:8000 ollama serve`
4. Rode o app localmente (seção 2) e ligue em Ajustes → IA local → Testar conexão.

O Ollama fica só no seu computador, sem exposição à internet. Uma página HTTPS (GitHub Pages) não consegue acessar `localhost`, por isso a IA local só funciona com o app rodando localmente no Mac. No iPhone não funciona.

## Sincronização no futuro (pesquisado, não implementado)

Opções com plano grátis: **Supabase** (Postgres + login; plano grátis pausa projeto parado por 1 semana) e **Firebase Firestore** (plano Spark; cota diária de leituras e gravações). As duas exigem criar conta e configurar chaves. O código já separa os dados em `js/store.js`, então dá para trocar o armazenamento sem mexer nas telas.

## Estrutura

```
index.html, manifest.webmanifest, sw.js   PWA e offline
css/app.css                               visual (paleta Sanso)
js/parser.js   interpretador de comandos pt-BR (datas, horários, intenções)
js/brain.js    conversa: perguntas, confirmações, ações reais
js/store.js    banco local (localStorage), XP, conquistas
js/planner.js  prioridades, Me salva, semana, modelos de etapas
js/mascot.js   mascote em SVG, 15 expressões
js/screens/    Hoje, Conversa, Agenda, Jornada e telas extras
tests/         testes automatizados
```

Para virar app nativo (App Store) no futuro: a pasta funciona como `webDir` do **Capacitor** sem mudanças.

## Por que essas mecânicas (psicologia aplicada)

- **Intenções de implementação** ("quando e onde"): o Guia pergunta o horário e sugere momentos livres. Planos "se X, então Y" aumentam a execução (Gollwitzer & Sheeran, 2006, meta-análise).
- **Três prioridades por vez e Me salva**: reduzem sobrecarga de escolha e atrito.
- **Divisão em partes de 15 min** após adiamentos: tarefas aversivas e grandes são as mais procrastinadas (Steel, 2007).
- **Autonomia, competência e vínculo** (Teoria da Autodeterminação): cobrança ajustável e desligável, feedback de progresso real, mascote com personalidade, sem punição.
- **Recompensas ligadas a ações reais e à retomada**, não a sequências ininterruptas: evita o efeito "quebrei a sequência, desisti" e valoriza voltar depois de uma pausa.
- Sem notificações excessivas, sem moeda compulsiva, sem culpa. O objetivo é fazer as tarefas, não passar tempo no app.
