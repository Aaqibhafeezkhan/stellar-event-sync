---
name: Stellar Event Sync
description: A restrained ledger-proof interface for reliable Stellar event ingestion.
colors:
  ledger-ink: '#111111'
  warm-paper: '#f5f4ef'
  panel-white: '#ffffff'
  graphite: '#686762'
  rule-line: '#d4d2ca'
  verified-green: '#276749'
  failure-red: '#9b2c2c'
typography:
  display:
    fontFamily: 'SESans, ui-sans-serif, sans-serif'
    fontSize: 'clamp(3.2rem, 8vw, 7rem)'
    fontWeight: 720
    lineHeight: 0.91
    letterSpacing: '-0.04em'
  body:
    fontFamily: 'SESans, ui-sans-serif, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: 'ui-monospace, SFMono-Regular, monospace'
    fontSize: '0.82rem'
    fontWeight: 400
rounded:
  surface: '14px'
  action: '999px'
spacing:
  xs: '0.5rem'
  sm: '0.75rem'
  md: '1rem'
  lg: '2rem'
  xl: '4rem'
components:
  button-primary:
    backgroundColor: '{colors.ledger-ink}'
    textColor: '{colors.panel-white}'
    rounded: '{rounded.action}'
    padding: '0.62rem 1rem'
  button-secondary:
    backgroundColor: '{colors.warm-paper}'
    textColor: '{colors.ledger-ink}'
    rounded: '{rounded.action}'
    padding: '0.62rem 1rem'
  search-input:
    backgroundColor: '{colors.panel-white}'
    textColor: '{colors.ledger-ink}'
    rounded: '8px'
    padding: '0.7rem'
---

# Design System: Stellar Event Sync

## Overview

**Creative North Star: "The Ledger Proof Sheet"**

The interface should feel like a technical record that can withstand inspection: calm, precise, and
public about state. Warm paper, dark ink, fine rules, and a single verification signal create an
editorial surface rather than a generic software dashboard.

Density is purposeful. Large statements establish the promise, while monospace records make the
mechanism tangible. Decoration never competes with evidence.

**Key Characteristics:**

- Warm monochrome surfaces with restrained semantic color.
- Ruled records and checkpoints as the signature visual language.
- Large, tightly set headlines paired with highly legible body copy.
- Flat surfaces; borders and tonal inversion provide structure.

## Colors

The palette is predominantly warm paper and near-black ink. Green and red remain semantic signals,
not decoration.

### Primary

- **Ledger Ink:** Primary text, dark proof surfaces, and primary actions.
- **Verified Green:** Focus rings and successful validation states.

### Neutral

- **Warm Paper:** Page background and secondary action surface.
- **Panel White:** Code, callout, and input surfaces.
- **Graphite:** Supporting copy and quiet labels.
- **Rule Line:** Dividers, grids, and container boundaries.

**The Signal Rarity Rule.** Green and red appear only when they communicate state.

## Typography

**Display Font:** SESans / Manrope (with ui-sans-serif fallback)  
**Body Font:** SESans / Manrope (with ui-sans-serif fallback)  
**Label/Mono Font:** ui-monospace (with SFMono-Regular fallback)

**Character:** A contemporary grotesk supplies clarity and authority; monospace is reserved for
records, cursors, code, and machine state.

### Hierarchy

- **Display:** Heavy, fluid, tightly tracked; hero and documentation titles only.
- **Headline:** Compact, bold section statements with generous separation.
- **Body:** Regular weight with a 72-character maximum measure for sustained reading.
- **Label:** Small monospace or uppercase sans text for machine status and record metadata.

**The Two Voices Rule.** Sans explains; monospace proves.

## Layout

The homepage alternates a split first viewport with full-width ruled sections. Documentation uses a
280px sticky navigation rail and a bounded reading column. Spacing is generous around claims and
compact inside records. At 800px, split layouts collapse, navigation becomes explicit toggles, and
documentation content follows a collapsed browser control. At 480px, actions become full width and
record columns simplify without horizontal overflow.

## Elevation & Depth

The system uses no box shadows. Depth comes from dark/light inversion, one-pixel rules, and the
sticky header's subtle translucent blur.

**The Flat Evidence Rule.** A surface earns hierarchy through contrast and structure, never ornamental shadow.

## Shapes

Content containers use gently rounded 14px corners when they need enclosure. Actions are pill-shaped
for clear affordance. Ledger rows, navigation rails, and page regions remain square and ruled.

## Components

### Buttons

- **Shape:** Pill silhouette with a 44px minimum target.
- **Primary:** Ink fill with white text; secondary actions use a transparent paper fill and ink rule.
- **Hover / Focus:** Hover lifts by one pixel; keyboard focus receives a three-pixel verified-green outline.

### Cards / Containers

- **Corner Style:** 14px for callouts and code shells; square for proof ledgers.
- **Background:** White on warm paper, or ink for the proof surface.
- **Shadow Strategy:** None.
- **Border:** One-pixel rule line; darker internal rules on inverted surfaces.

### Inputs / Fields

- **Style:** White field, one-pixel rule, eight-pixel radius, comfortable 0.7rem padding.
- **Focus:** Global verified-green focus outline with three-pixel offset.

### Navigation

The sticky header uses quiet text links and one primary contribution action. Mobile primary and docs
navigation remain real buttons with synchronized `aria-expanded` state.

### Proof Ledger

The signature component is an inverted ledger of event rows ending in a visibly bounded atomic
checkpoint. It demonstrates the product model using real vocabulary rather than decorative terminal text.

## Do's and Don'ts

### Do:

- **Do** use rules, alignment, and whitespace to make technical relationships inspectable.
- **Do** reserve monospace for code and machine state.
- **Do** preserve visible focus, 44px targets, and reduced-motion behavior.

### Don't:

- **Don't** introduce decorative gradients, glass cards, or generic dashboard widgets.
- **Don't** use semantic colors as ambient brand accents.
- **Don't** imply product activity with fake charts, counters, partnerships, or testimonials.
