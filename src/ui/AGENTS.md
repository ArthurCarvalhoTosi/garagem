# src/ui: design system

A identidade visual e seus motivos estão na seção 10 do doc de decisões (`../garagem-docs`, ver o `AGENTS.md` da raiz). Telas novas montam a interface com estes componentes em vez de estilizar do zero.

## Tokens (`theme.ts`)

- Cor só por `useTheme().c` ou pela prop `color` do `AppText` (nome do token). Nenhum hex fora de `theme.ts`; cor nova é token novo nas duas paletas, clara e escura.
- Texto sempre com `<AppText variant=…>`: Barlow na interface, Barlow Condensed (`number`, `odometer`) para km e R$. Caixa de frase, nunca rótulo todo em maiúsculas.
- Espaçamento por `space`; raio por `radius` (quadro 16, botão 10, plaquinha 6, tambor 3, linha 0).
- Sem sombras: a separação é feita com linhas de 1px (`c.line`) e espaço.
- Itens de manutenção são linhas de largura total com barra de urgência (`ItemRow`), não grade de cards.
- O quadro de instrumentos (`InstrumentPanel`: hodômetro de tambores, luzes-espia e frase de estado, em `c.panel` escuro nos dois temas) é o único elemento chamativo; o resto fica discreto. As luzes são decorativas: a frase leva o sentido para o leitor de tela.
- No Painel, o `ItemRow` recebe `life` (fração do intervalo já usada, de `lifeUsed`) e troca a barra lateral pela barra de vida útil.
- A `PlateChip` (apelido numa placa Mercosul) é branca nos dois temas, com tokens próprios (`plateBody`, `plateInk`, `plateBand`): uma placa não muda de cor.
- Listas de lugares para ir (Ajustes) usam `ListRow`; listas de manutenção usam `ItemRow`.
- Pedidos que podem esperar (lembrete, backup) usam `Notice`, no fim da tela: nunca um segundo destaque.
- A linha do tempo do Histórico monta cada parada com `TimelineRow` (trilho `forecast` claro ou `done` escuro, marcador vazio ou cheio). O gráfico de meses é o `MonthBars`: uma série, sem legenda, todos os valores no rótulo do leitor de tela.

## Acessibilidade (obrigatória)

- Urgência nunca só por cor: ícone com forma própria mais a palavra (veja `ItemRow`).
- Alvos de toque ≥ 48dp.
- Todo controle tem `accessibilityRole`, `accessibilityLabel` e `accessibilityState` corretos. Ícones são decorativos e ficam ocultos do leitor de tela; o rótulo ao redor carrega o sentido.
- Mensagem que surge depois de uma ação: `accessibilityLiveRegion` (Android) e `AccessibilityInfo.announceForAccessibility` (iOS), como em `FormError`.
- Animações respeitam "reduzir movimento" (`useReducedMotion`, como no `Odometer`).
- Contraste WCAG AA nas duas paletas.

## Ícones

`Icon` usa `expo-symbols` com nomes no padrão MaterialCommunityIcons. Ícone novo é uma entrada em `glyphs` com o SF Symbol (iOS) e o Material Symbol (Android). Não instale `@expo/vector-icons`: o SDK 58 não o traz mais.

## Componentes novos

Exporte em `index.ts`. Teste em `__tests__/` com React Native Testing Library, buscando por papel e rótulo (`getByRole('button', { name })`); é isso que prova a acessibilidade. Sem snapshots.
