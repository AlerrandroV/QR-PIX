# Arquitetura de dados do QR PIX

## Resumo

1. **O aparelho é a fonte da verdade do vendedor.** Perfil, catálogo, chaves e preferências ficam no IndexedDB/localStorage e funcionam offline.
2. **O backend só guarda o que é público**: a vitrine (loja + produtos) que o cliente abre pelo link.
3. **O app nunca fala direto com o backend.** Toda leitura e escrita passa por `data.js` (`window.QrData`), que carrega um **adaptador** com 4 funções. Hoje o adaptador é o `firebase.js`. Para trocar de backend, basta escrever outro arquivo com as mesmas funções.

```
 telas (profile.js, catalog.html, store.js…)
            │
            ▼
        data.js  ── IndexedDB (perfil, produtos)      ← sempre funciona offline
            │
            ▼  import(REMOTE_ADAPTER)
   firebase.js  hoje   →   supabase.js  amanhã   →   api-propria.js  depois
```

### A interface do adaptador

| Função | O que faz |
|---|---|
| `isUsernameAvailable(username)` | `true` se o @ está livre ou já é do aparelho atual |
| `publishStore({ profile, products, previousUsername })` | Publica ou atualiza a loja inteira. Remove produtos apagados e, se o @ mudou, apaga a loja antiga |
| `unpublishStore(username)` | Tira a loja do ar |
| `fetchStore(username)` | Retorna `{ profile, products }` ou `null` (usado pela página pública) |

O que vai para o backend é filtrado em `publicProfile()` e `publicProduct()` (`data.js`). Campos locais como rascunhos e estado de sincronização nunca saem do aparelho.

---

## Situação atual (Firebase)

- Coleção `stores/{username}` com o perfil público e `stores/{username}/products/{id}` com os produtos.
- Cada aparelho recebe um **login anônimo**. O `uid` é gravado como `ownerUid`, e as regras em `firestore.rules` só deixam o dono alterar a loja.
- As imagens são JPEG pequenos (avatar 256 px, produto 600 px) gravados como data URL dentro do documento. Isso funciona para catálogos pequenos, mas não escala.

### Passos para ativar em produção
1. Firebase console → **Authentication → Sign-in method → Anônimo → Ativar**.
2. Firebase console → **Firestore → Regras**: colar o conteúdo de `firestore.rules` e publicar.
   - Sem isso, qualquer pessoa pode sobrescrever qualquer loja (as regras atuais do projeto são desconhecidas para o app).
   - A coleção antiga `profiles` (v1.0) fica somente leitura.

### Por que não ficar no Firebase a longo prazo
- **Aprisionamento:** o Firestore é proprietário. Não dá para hospedar por conta própria nem levar as consultas para outro banco.
- **Custo por leitura:** cada visita a uma loja lê 1 documento por produto. Com lojas sendo divulgadas no Instagram, o custo cresce com o público do vendedor, não com o número de vendedores.
- **Modelo de dados:** pedidos, pagamentos (Mercado Pago, BTC) e relatórios são dados relacionais. Num banco de documentos isso vira código de consistência no cliente.
- **Imagens em base64** no documento (limite de 1 MB) não têm CDN nem miniaturas.

---

## Opções avaliadas

| | **Supabase** | PocketBase | Cloudflare (Workers + D1 + R2) | Backend próprio (Node + Postgres) |
|---|---|---|---|---|
| Banco | Postgres | SQLite | SQLite distribuído | Postgres |
| Sair depois | **Fácil**: é Postgres padrão (dump/restore) | Fácil | Médio | — |
| Hospedar por conta própria | Sim (open source) | Sim (1 binário) | Não | Sim |
| Login (anônimo, Google, telefone) | Pronto | Pronto | Fazer à mão | Fazer à mão |
| Imagens | Storage + CDN | Arquivos locais | R2 (sem custo de saída) | S3/R2 |
| Funções de servidor (webhooks de pagamento) | Edge Functions | Hooks em Go/JS | Workers | Sim |
| Operação | Gerenciado | Você mantém o servidor | Gerenciado | Você mantém tudo |
| Custo inicial | Grátis → US$ 25/mês (Pro) | VPS ~US$ 5/mês | Quase zero | VPS + tempo |

### Recomendação: **Supabase**, com imagens no Storage (ou no Cloudflare R2)

- **Postgres é a saída de emergência.** Se o Supabase encarecer ou mudar, o mesmo banco roda no Neon, no RDS ou numa VPS, sem reescrever o modelo de dados.
- **Row Level Security** substitui as regras do Firestore quase 1:1 (`owner_id = auth.uid()`).
- **Login anônimo existe**, então o comportamento atual se mantém. Depois dá para vincular Google, telefone ou e-mail sem perder a loja.
- **Edge Functions** cobrem o que vem a seguir: webhooks do Mercado Pago e checagem de pagamentos em BTC (por exemplo via BTCPay Server). Esse código **precisa** estar num servidor, porque tokens de pagamento nunca podem ir para o app.
- **Atenção ao plano grátis:** projetos parados por uma semana são pausados. Para lojas públicas em produção, conte com o plano Pro.

PocketBase é a melhor alternativa se o objetivo for custo mínimo e você aceitar manter um servidor.

### Esboço do schema (Supabase / Postgres)

```sql
create table stores (
  username     text primary key check (username ~ '^[a-z0-9_.]{3,20}$'),
  owner_id     uuid not null references auth.users(id),
  name         text not null,
  bio          text, city text,
  whatsapp     text, instagram text,
  avatar_path  text,                     -- caminho no Storage, não base64
  bank text, key_type text, pix_key text,
  updated_at   timestamptz default now()
);

create table products (
  id           text primary key,
  store        text not null references stores(username) on delete cascade on update cascade,
  owner_id     uuid not null references auth.users(id),
  name         text not null,
  description  text,
  price_cents  integer not null default 0,
  image_path   text,
  available    boolean not null default true,
  position     integer not null default 0,
  updated_at   timestamptz default now()
);

alter table stores   enable row level security;
alter table products enable row level security;
create policy "público lê"   on stores   for select using (true);
create policy "dono escreve" on stores   for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "público lê"   on products for select using (true);
create policy "dono escreve" on products for all    using (owner_id = auth.uid()) with check (owner_id = auth.uid());
```

### Plano de migração
1. Criar `supabase.js` com as 4 funções da interface.
2. Trocar `REMOTE_ADAPTER` em `data.js`.
3. Copiar `stores` do Firestore para o Postgres com um script único. Ou, como o aparelho é a fonte da verdade, marcar tudo como `dirty` e deixar cada vendedor republicar na próxima abertura do app.
4. Reservar no novo banco os @ que já existiam, para ninguém tomar o nome de outra loja.

---

## Riscos a resolver antes de escalar

1. **Identidade presa ao aparelho.** Com login anônimo, quem limpar os dados do navegador ou trocar de celular perde o direito de editar a própria loja; os dados locais se salvam pelo backup em Ajustes. **Próximo passo:** vincular uma conta (telefone por SMS/WhatsApp é o mais natural para o público).
2. **Imagens em base64.** Migrar para armazenamento de objetos com CDN reduz o tamanho das lojas em cerca de 90%.
3. **Moderação.** Lojas públicas precisam de um canal de denúncia e de um jeito de tirar uma loja do ar (campo `blocked` + regra).
4. **LGPD.** A loja pública expõe nome, cidade, WhatsApp e chave PIX, o que é intencional, já que é o que o cliente precisa para pagar. Isso deve estar escrito nos Termos de uso e o vendedor precisa poder apagar tudo (o botão "Tirar do ar" já remove os dados do servidor).
