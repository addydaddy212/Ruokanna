# UI_DOCTRINE

## Intended product feel
- Tactical, calm, and high-signal.
- More like a meal operations console than a recipe blog.
- The UI should help the user decide what to cook and why it fits.

## Visual identity rules
- Preserve the dark tactical palette: near-black backgrounds, charcoal surfaces, neon green as the main action color, amber/purple/blue for semantic accents.
- Rounded cards, crisp borders, restrained glow, and dense but readable typography are part of the identity.
- Image support is helpful, but the product should still feel intentional when only gradients/placeholders are available.
- Small uppercase labels and status chips are a core pattern.

## Layout principles
- Dashboard is the center of gravity. Prioritize today/tonight decisions first, then macro intelligence, then weekly structure, then evidence.
- Prefer card-based composition over generic admin tables.
- Use modals for focused actions like picking a meal, swapping, getting a recommendation, or reviewing groceries.
- Mobile should preserve the same information architecture, not become a different product.

## Search/navigation/content hierarchy rules
- Primary nav stays planner-first: Dashboard, Recipes, Macros, Fridge, Debrief, Assistant.
- Search/filtering should be fast and utilitarian, especially in the recipe library and picker modal.
- Recommendations should always be shown next to the constraints that shaped them.
- Surface time, protein, fridge match, source, and confidence before low-value metadata.

## UX tone/copy rules
- Copy should be concise, practical, and encouraging.
- Explain fit and tradeoffs, not just outputs.
- Be explicit when data is inferred, estimated, fallback-generated, or confidence-limited.
- Avoid fluffy wellness language and avoid over-selling AI certainty.

## What the UI should not become
- Not a social feed.
- Not a Pinterest-style discovery gallery.
- Not a pastel wellness tracker.
- Not a generic admin dashboard.
- Not a chaotic AI playground with speculative widgets.
- Not a light-theme/default-component-library reskin that erases the current product identity.
