# DESIGN.md — Portal Embaixadores Saint Germain

Tokens em `src/shared/theme/global.css` (`:root`). Estratégia de cor: **Restrained** — neutros aquecidos + tinta; sem accent colorido (a "cor" da marca é o contraste tinta/papel).

## Cor

| Token | Valor | Uso |
|---|---|---|
| `--paper` | `#fdfcfa` | fundo de página |
| `--ink` | `#1c1915` | texto principal, barras pretas, botões primários |
| `--ink-soft` | `#6f6a62` | texto secundário |
| `--ink-faint` | `#a39d94` | rótulos, placeholders |
| `--wash` | `#f6f3ee` | painéis suaves, callouts |
| `--line` | `#e8e4de` | hairlines, divisores |
| `--ok` | `#2f7a4d` | sucesso/confirmada |
| `--err` | `#b3352e` | erro/cancelada |

Nunca `#000`/`#fff` puros em novos estilos; usar os tokens (aquecidos na direção do âmbar da marca).

## Tipografia

- **Questrial** (sans): toda a UI. Rótulos caixa-alta: 10–11px, tracking 0.14–0.18em, `--ink-faint`. Corpo 13–14px.
- **Cormorant Garamond** (serif): exclusivamente números de dinheiro e display (stats 30–34px w400, saldo destaque 56–64px w300). Nunca em botões/labels.
- Hierarquia por contraste de tamanho serif×sans, não por peso.

## Componentes

- **Tabs**: barra horizontal sempre visível, hairline embaixo; ativa = tinta + filete 2px inferior; inativa = `--ink-faint`; rolagem horizontal no mobile.
- **Botões**: retos (radius 0), primário tinta cheia, secundário outline 1px; hover = leve opacidade/inversão; `:focus-visible` outline 2px tinta.
- **Superfícies**: filetes e washes, não cartões com sombra. Proibido `border-left` colorido como acento.
- **Stats**: grade com gap de 1px sobre `--line` (efeito filete), número serif, rótulo caixa-alta.
- **Movimento**: 160–220ms ease-out; só para estado (hover, reveal de conteúdo), nunca coreografia.

## Estados

Toda interação tem hover, focus-visible e disabled. Badges de status: outline 1px `currentColor`, verde confirmada / cinza pendente / vermelho cancelada.
