# Firebase: configuração e segurança

O QR PIX é código aberto, **inclusive a `apiKey` e as regras do banco**. Isso é seguro: a `apiKey` do Firebase só identifica o projeto; quem protege os dados são as **regras de segurança** (`firestore.rules`) e o login. Qualquer pessoa pode ler as regras e conferir o que é permitido.

## O que o Firebase faz hoje

| Parte | Serviço | Arquivo |
|---|---|---|
| Identidade do vendedor | Authentication (anônimo + Google) | `firebase.js` |
| Vitrine pública (loja e produtos) | Firestore | `firebase.js`, `firestore.rules` |

Tudo passa por `firebase.js`, o único arquivo que conhece o Firebase (ver `docs/ARQUITETURA-DADOS.md`).

## Configuração (uma vez só)

No [console do Firebase](https://console.firebase.google.com) do projeto:

1. **Authentication → Sign-in method → Anônimo → Ativar.** Cada aparelho recebe uma conta própria, sem pedir nada ao vendedor.
2. **Authentication → Sign-in method → Google → Ativar**, escolhendo um e-mail de suporte do projeto. É por aqui que o vendedor protege a loja e a recupera em outro aparelho.
3. **Authentication → Settings → Authorized domains:** adicionar `qrpix.site` (e `www.qrpix.site`, se usar). O `localhost` já vem autorizado.
4. **Firestore → Regras:** colar o conteúdo de `firestore.rules` e publicar. Ou, pela linha de comando:
   ```
   npx firebase-tools login
   npx firebase-tools deploy --only firestore:rules
   ```
   O projeto padrão está em `.firebaserc`.
5. **Recomendado: restringir a chave de API por domínio.** Google Cloud Console → APIs e serviços → Credenciais → a chave do navegador → "Restrições de aplicativos" → Referenciadores HTTP: `https://qrpix.site/*`. Isso impede que outros sites usem sua cota.
6. **Recomendado: orçamento com alerta** (Google Cloud → Faturamento → Orçamentos), para saber cedo se alguém estiver abusando das leituras.
7. **Recomendado: App Check** (reCAPTCHA v3/Enterprise), que recusa chamadas que não vêm do site oficial. Ainda **não está ligado no código**: exige criar a chave do reCAPTCHA no console.

> Sem o passo 4, as regras do projeto continuam sendo as antigas. Se estiverem no "modo de teste" do Firebase, qualquer pessoa poderá apagar ou sobrescrever dados. Publique as regras **antes** de divulgar o link das lojas.

## Modelo de dados

```
stores/{username}                  vitrine pública (leitura livre)
stores/{username}/products/{id}    produtos
owners/{uid}                       qual @ pertence a cada conta (privado)
profiles/{id}                      legado da v1.0 (somente leitura)
```

## O que as regras garantem

- Só o dono (`ownerUid`) altera ou apaga a própria loja e os produtos dela.
- **Uma loja por conta.** O registro `owners/{uid}` guarda o @ da conta, e trocar de @ exige apagar a loja antiga no mesmo lote. Isso impede reservar @ em massa com uma conta só.
- Campos validados em tipo e tamanho (nome até 60 caracteres, foto do perfil até 120 KB, foto de produto até 250 KB, preço inteiro e não negativo…). Campos desconhecidos são recusados.
- Nomes reservados (`admin`, `qrpix`, `suporte`…) não podem ser usados.
- Ninguém lê `owners/{uid}` de outra conta.

## O que as regras **não** garantem

- **Várias contas anônimas.** Um atacante pode criar muitas contas anônimas, e cada uma pode reservar um @. O custo disso sobe com o App Check e com um limite por IP (fora do Firestore).
- **Volume de leitura.** As lojas são públicas; alguém pode lê-las em massa. Mitigação: orçamento com alerta e restrição da chave.
- **Conteúdo ilegal ou ofensivo.** Precisa de denúncia e moderação (a fazer).
- **Quantidade de produtos por loja.** As regras não conseguem contar documentos.

## Login com Google

- O botão está em **Perfil → Conta**.
- Quem já publicou como anônimo e entra com o Google mantém a loja: o Firebase **vincula** o Google à conta anônima, e o `uid` não muda.
- Se esse Google já estava ligado a outra conta (por exemplo, usado em outro aparelho), o app passa a usar essa conta e oferece **recuperar a loja** dela (ou manter os dados deste aparelho).
- **Sair da conta** não apaga a loja do servidor, mas o aparelho vira uma conta anônima nova: a loja só pode ser editada entrando de novo com o mesmo Google.
- O e-mail e o nome da conta Google ficam apenas no Firebase Authentication. Eles não são gravados na loja pública.

## Testar as regras

Os testes rodam no emulador do Firestore (precisa de Java 11+):

```
cd tests/rules
npm install
npm test
```

Eles cobrem a publicação (inclusive um catálogo de 20 produtos), a troca de @, o ato de tirar do ar e as tentativas de ataque: editar ou apagar loja alheia, tomar @ de outro, gravar produto em loja alheia, acumular lojas, campos inválidos e acesso sem login.
