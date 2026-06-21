# Assets públicos (servidos na raiz `/`)

Arquivos aqui são servidos pelo Vite na raiz do site (ex.: `public/logo-atelie.png` → `/logo-atelie.png`).

## Assets da marca "Ateliê ++" (gerados a partir do logo original)

| Arquivo | Uso | Observações |
|---------|-----|-------------|
| `logo-atelie.png` | Logo no header do cliente e do admin | **Horizontal** (emblema + nome), fundo transparente, ~691×264 |
| `favicon.png` | Favicon (aba do navegador) | Só o **emblema**, quadrado, transparente, 256×256 (legível em tamanho pequeno) |
| `favicon-64.png` | Favicon menor | 64×64 |
| `apple-touch-icon.png` | Ícone iOS | Emblema sobre fundo creme, 180×180 |
| `apresentacao-atelie.jpg` | Foto de apresentação na home | JPG otimizado, **4:3** (1200×900) — proporção usada pelo componente `Apresentacao` |

`index.html` aponta o favicon para `/favicon.png` e o apple-touch para `/apple-touch-icon.png`.
O header usa `/logo-atelie.png`; a apresentação usa `/apresentacao-atelie.jpg`.

> O arquivo `apresentacao-atelie.png` (original enviado pelo dono) não é mais usado pelo código
> (o componente referencia o `.jpg`). Pode ser removido.
