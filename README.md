# Daiyo

Plataforma de estudos e foco para organizar sessoes, controlar o tempo e acompanhar o aprendizado.

## Executar

```bash
npm install
npm run dev
```

## Validacao

```bash
npm run type-check
npm run lint
npm run build
```

O timer usa timestamps como fonte de verdade, persiste sessoes no IndexedDB e usa `localStorage` apenas como fallback e para preferencias simples. A V1 e focada no fluxo principal: criar, pausar, continuar, finalizar, cancelar, recuperar e revisar sessoes.
