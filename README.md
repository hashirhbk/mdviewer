This was purely vibdecoded using the model GPT-5.3 Codex Medium, use at your own risk.

# mdviewer

Cross-platform desktop Markdown viewer built with Electron.

## Features

- 3 view modes:
  - Markdown source view
  - Split view (source + rendered preview side by side)
  - Rendered-only view
- Top toolbar with:
  - `Open` button
  - `Markdown`, `Split`, `Rendered` mode toggle buttons
- Live debounced preview updates while typing
- Open `.md` / `.markdown` from app dialog or CLI argument

## Prerequisites

- Node.js 20+ (Node.js 22 recommended)
- npm 10+

## Install (All Platforms)

```bash
npm install
```

## Run (All Platforms)

```bash
npm start
```

Open a file directly:

```bash
npm start -- /path/to/file.md
```

Start in a specific mode:

```bash
npm start -- --mode=source /path/to/file.md
npm start -- --mode=split /path/to/file.md
npm start -- --mode=rendered /path/to/file.md
```

## Platform Notes

### Linux

Optional per-user file association installer:

```bash
./packaging/linux/install-user.sh
```

This registers `mdviewer` as default for:

- `text/markdown`
- `text/x-markdown`

### macOS

Run with `npm start`. File association packaging is not included in this repository yet.

### Windows

Run with `npm start` (PowerShell/CMD). File association packaging is not included in this repository yet.

## Development

```bash
npm run dev
```

## License

MIT License. You are free to use, modify, fork, and redistribute this project.
See `LICENSE` for details.

## Disclaimer

This project is provided as-is, with no warranty.
