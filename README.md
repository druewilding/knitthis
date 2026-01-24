# KnitThis

A mobile-optimized web app for following knitting patterns step-by-step.

## Features

- **Step-by-step guidance** - View one instruction at a time with Next/Previous navigation
- **Progress tracking** - See your progress with a visual progress bar
- **Overview mode** - View all steps with completed ones ticked, jump to any step
- **Size support** - Patterns can define multiple sizes with variable substitution
- **Sections** - Organize patterns into logical sections (e.g., "Heel", "Toe")
- **Repeat blocks** - Define instructions that repeat a configurable number of times
- **Pattern metadata** - Display materials, gauge, abbreviations, and notes

## Project Structure

```
knitthis/
├── index.html              # Main HTML document
├── css/
│   └── styles.css          # Mobile-first styles
├── js/
│   └── app.js              # Pattern loader and step navigator
├── patterns/
│   └── sample-pattern.yaml # Example pattern
├── package.json
└── README.md
```

## Getting Started

### Running Locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

### Deploying to GitHub Pages

Simply push to GitHub and enable GitHub Pages from the repository settings. The app is pure HTML/CSS/JS with no build step required.

## Pattern Format (YAML)

Patterns are defined in YAML files in the `patterns/` directory.

### Basic Example

```yaml
name: Simple Scarf
description: A beginner-friendly garter stitch scarf
notes: Use any worsted weight yarn you like!

materials:
  - Worsted weight yarn, 200 yards
  - US 8 (5mm) needles

gauge:
  stitches: 18
  rows: 24
  unit: 4 inches

abbreviations:
  k: knit
  p: purl
  sts: stitches

instructions:
  - Cast on 30 stitches
  - Knit every row until piece measures 60 inches
  - Bind off all stitches
  - Weave in ends
```

### With Sizes and Sections

```yaml
name: Dishcloth
description: A textured dishcloth in multiple sizes

sizes:
  - name: Small (8")
    stitches: 34
    repeats: 3
  - name: Large (12")
    stitches: 50
    repeats: 5

sections:
  - name: Cast On
    instructions:
      - Cast on {stitches} stitches

  - name: Border
    instructions:
      - repeat: "{repeats}"
        steps:
          - "Row 1: Knit all stitches"
          - "Row 2: Knit 3, purl to last 3, knit 3"

  - name: Bind Off
    instructions:
      - Bind off all stitches
      - Weave in ends
```

### Pattern Schema

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Pattern title |
| `description` | string | Short description |
| `notes` | string | Tips or notes before starting |
| `materials` | list | Required materials |
| `gauge` | object | `{ stitches, rows, unit }` |
| `abbreviations` | object | Key-value pairs of abbreviations |
| `sizes` | list | Size options with variables |
| `sections` | list | Named sections with instructions |
| `instructions` | list | Simple list (if not using sections) |

### Variables

Use `{variableName}` in instructions to substitute values from the selected size:

```yaml
sizes:
  - name: Small
    stitches: 34

instructions:
  - Cast on {stitches} stitches  # Becomes "Cast on 34 stitches"
```

### Repeat Blocks

Repeat a group of steps multiple times:

```yaml
instructions:
  - repeat: 10  # or "{variableName}" for size-dependent repeats
    steps:
      - Knit one row
      - Purl one row
```

## Adding New Patterns

1. Create a new `.yaml` file in the `patterns/` directory
2. Add the pattern to the `PATTERNS` array in `js/app.js`:

```javascript
const PATTERNS = [
    { file: 'sample-pattern.yaml', name: 'Sample Pattern' },
    { file: 'my-new-pattern.yaml', name: 'My New Pattern' }
];
```

## License

ISC

## License
This project is licensed under the ISC License.