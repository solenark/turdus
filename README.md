# Turdus

Protótipo (PWA) que grava um canto de até 15 s, detecta as notas, mostra uma timeline (piano-roll), toca as notas para conferência e exporta um arquivo MIDI.

## Rodar

```sh
npm install
npm run dev -- --host   # abre em https://<ip-do-pc>:5173 no celular (aceite o certificado local)
npm test                # testes da lógica de áudio
npm run build
```

O microfone exige HTTPS; o `@vitejs/plugin-basic-ssl` gera um certificado local.

### Gravações de teste (ajuste fino)

Desligadas por padrão. Para o app salvar cada gravação (`.wav` + `.json` com ajustes, perfil e notas) em `recordings/`:

```sh
VITE_SAVE_RECORDINGS=1 npm run dev -- --host
npm run analyze -- [arquivo.wav] [--tolerance=0.8 ...]   # reanalisa com outros ajustes
```

## Como funciona

- `src/audio/recorder.ts`: grava o microfone (sem supressão de ruído nem AGC) e decodifica para mono.
- `src/audio/pitch.ts`: analisa o pitch em janelas de 2048 amostras com hop de 512, usando o algoritmo McLeod (`pitchy`).
- `src/audio/segment.ts`: filtro de mediana → agrupamento com histerese → descarte de notas curtas e união de buracos pequenos.
- `src/audio/player.ts`: reproduz as notas sintetizadas, a voz original ou as duas juntas.
- `src/midi/export.ts`: gera o `.mid` (`@tonejs/midi`, 120 BPM) e baixa o arquivo, ou compartilha no iOS.

Os parâmetros de detecção ficam em `DEFAULT_PITCH_OPTIONS` e `DEFAULT_SEGMENT_OPTIONS`.
