# IBM Hackathon 2026 — EcoPrompt

Monorepo for the AI sustainability project.

## Projects

- [extension/](extension/) — Chrome extension integrating with ChatGPT (React + TypeScript, Redux Toolkit, mock analysis backend).
- The team's web application can be added in a separate directory, for example `web/`.

## Run the extension

```bash
cd extension
npm install
npm run build
```

In Chrome, open `chrome://extensions`, enable Developer mode, then choose **Load unpacked** and select `extension/dist`.

See [extension/README.md](extension/README.md) for extension details.

The water/energy calculations currently use illustrative mock coefficients, not measured AI consumption.
